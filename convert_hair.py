#!/usr/bin/env python3
"""Open World Mayhem — converte os cabelos "Spiky Hair" e "SSJ5 Hair" (glTF) para o jogo.

  python3 convert_hair.py <pasta spiky_hair> <pasta ssj5_hair> [saída=.]

Gera:
  hair-data.js         dados embutidos (base64) lidos por hair.js
  spiky_hair_1mb.glb   spiky otimizado (<= 1 MB, com textura), já no tamanho/posição do Goku (+Y cima, +Z frente)
O spiky tem ~970 mil triângulos; é simplificado por colapso de arestas com métrica de quádricas (qem_simplify.cpp, compilado
com g++ na primeira execução) e a UV de cada canto é mantida pelo mapa afim da face. Texturas: spiky 512² JPEG (cor nativa);
ssj5 1024² em tons de cinza (luminância — recebe a cor escolhida no criador, como o cabelo do Goku).
Requer numpy + Pillow + g++.
"""
import sys, os, json, struct, base64, io, subprocess
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SPIKY_DIR, SSJ5_DIR = sys.argv[1], sys.argv[2]
OUT = sys.argv[3] if len(sys.argv) > 3 else HERE
GLB_LIMIT = 1_000_000          # bytes (incluindo a textura)
TEX_PX, TEX_Q = 512, 84

# ---- encaixe na cabeça do Goku (espaço do jogo: +Y cima, +Z frente, cabeça em (0,1.635,.04)) ----
SPIKY_S, SPIKY_Y0, SPIKY_Z0 = 0.37, 1.603, 0.0075     # ajustado por raios do crânio do Goku contra a casca interna; modelo: frente = +X, cima = +Y
SSJ5_S, SSJ5_D = 0.055, (0.0, 0.673, 0.126)          # idem; modelo: nó raiz gira -90° em X (Z do arquivo = cima, -Y = frente)


def read_gltf(d):
    g = json.load(open(os.path.join(d, 'scene.gltf')))
    b = open(os.path.join(d, g['buffers'][0]['uri']), 'rb').read()
    bv = g['bufferViews']

    def acc(i):
        a = g['accessors'][i]; v = bv[a['bufferView']]; o = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        n = {'VEC3': 3, 'VEC2': 2, 'SCALAR': 1}[a['type']]; dt = {5126: '<f4', 5125: '<u4', 5123: '<u2'}[a['componentType']]
        st = v.get('byteStride')
        if st and st != n * np.dtype(dt).itemsize:
            raw = np.frombuffer(b, np.uint8)[o:o + a['count'] * st].reshape(a['count'], st)
            return np.frombuffer(raw[:, :n * 4].tobytes(), dt).reshape(-1, n)
        r = np.frombuffer(b, dt, a['count'] * n, o)
        return r.reshape(-1, n) if n > 1 else r
    return g, acc


def build_spiky_input(path):
    g, acc = read_gltf(SPIKY_DIR)
    P, U, I, off = [], [], [], 0
    for m in g['meshes']:
        p = m['primitives'][0]
        P.append(acc(p['attributes']['POSITION'])); U.append(acc(p['attributes']['TEXCOORD_0']))
        I.append(acc(p['indices']).ravel().astype(np.int64) + off); off += len(P[-1])
    P = np.concatenate(P).astype(np.float64); U = np.concatenate(U); I = np.concatenate(I).reshape(-1, 3)
    q = np.round(P * 32768).astype(np.int64)                                   # solda duplicatas (posições já vêm quantizadas)
    _, first, inv = np.unique(q, axis=0, return_index=True, return_inverse=True)
    V = P[first].astype(np.float32); T = inv.reshape(-1)[I]
    ok = (T[:, 0] != T[:, 1]) & (T[:, 1] != T[:, 2]) & (T[:, 0] != T[:, 2])
    T = T[ok]; UV = U[I[ok]].astype(np.float32)
    _, ui = np.unique(np.sort(T, axis=1), axis=0, return_index=True); ui = np.sort(ui); T, UV = T[ui], UV[ui]
    with open(path, 'wb') as f:
        np.array([len(V), len(T)], np.int32).tofile(f); V.tofile(f); T.astype(np.int32).tofile(f); UV.astype(np.float32).tofile(f)
    print('spiky: %d vértices soldados, %d triângulos' % (len(V), len(T)))


def run_qem(inp, outp, target):
    exe = os.path.join(OUT, '.qem_simplify')
    if not os.path.exists(exe):
        subprocess.check_call(['g++', '-O2', '-o', exe, os.path.join(HERE, 'qem_simplify.cpp')])
    subprocess.check_call([exe, inp, outp, str(target)])
    b = open(outp, 'rb').read(); nv, nf = np.frombuffer(b[:8], np.int32); o = 8
    P = np.frombuffer(b, np.float32, nv * 3, o).reshape(-1, 3); o += nv * 12
    T = np.frombuffer(b, np.int32, nf * 3, o).reshape(-1, 3); o += nf * 12
    U = np.frombuffer(b, np.float32, nf * 6, o).reshape(-1, 3, 2)
    return P.copy(), T.copy(), U.copy()


def smooth_normals(P, T):
    fn = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]]); N = np.zeros_like(P)
    for k in range(3): np.add.at(N, T[:, k], fn)
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)


def unique_corners(P, T, U, N, tol=128):
    """vértices únicos por (posição, uv): cantos com UV a menos de ~1 texel viram o mesmo vértice (a UV vira a média);
    emendas reais de UV ficam duplicadas, mas as normais continuam suaves"""
    uq = np.round(np.clip(U, 0, 1) * tol).astype(np.int64)
    key = np.concatenate([T.reshape(-1, 1).astype(np.int64), uq.reshape(-1, 2)], 1)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.reshape(-1); cnt = np.bincount(inv).astype(np.float64)
    Uf = np.clip(U, 0, 1).reshape(-1, 2).astype(np.float64)
    um = np.stack([np.bincount(inv, Uf[:, k]) / cnt for k in (0, 1)], 1)
    v = T.reshape(-1)[first]
    return P[v], N[v], np.round(um * 65535).astype(np.uint16), inv.reshape(-1, 3).astype(np.uint32)


def quantize(P, N):
    mn, mx = P.min(0), P.max(0); c = (mn + mx) / 2; h = (mx - mn) / 2 * 1.0001
    qp = np.round((P - c) / h * 32767).astype(np.int16)
    qn = np.round(np.clip(N, -1, 1) * 127).astype(np.int8)
    return qp, qn, c.astype(np.float32), h.astype(np.float32)


def jpeg(img, px, q):
    buf = io.BytesIO(); img.convert('RGB').resize((px, px), Image.LANCZOS).save(buf, 'JPEG', quality=q, optimize=True, progressive=True); return buf.getvalue()


def write_glb(fn, qp, qn, qu, idx, c, h, tex):
    n = len(qp); pad4 = lambda b: b + b'\0' * (-len(b) % 4)
    pb = pad4(np.concatenate([qp, np.zeros((n, 1), np.int16)], 1).tobytes())          # 8 B por vértice
    nb = np.concatenate([qn, np.zeros((n, 1), np.int8)], 1).tobytes()                 # 4 B
    ub = qu.tobytes(); ib = pad4(idx.astype(np.uint16).tobytes()); tb = pad4(tex)
    parts = [ib, pb, nb, ub, tb]; offs = np.cumsum([0] + [len(p) for p in parts])
    bvs = [dict(buffer=0, byteOffset=int(offs[0]), byteLength=len(ib), target=34963),
           dict(buffer=0, byteOffset=int(offs[1]), byteLength=len(pb), byteStride=8, target=34962),
           dict(buffer=0, byteOffset=int(offs[2]), byteLength=len(nb), byteStride=4, target=34962),
           dict(buffer=0, byteOffset=int(offs[3]), byteLength=len(ub), byteStride=4, target=34962),
           dict(buffer=0, byteOffset=int(offs[4]), byteLength=len(tex))]
    j = {'asset': {'version': '2.0', 'generator': 'convert_hair.py (Open World Mayhem)',
                   'extras': {'title': 'Spiky Hair (otimizado)', 'license': 'ver license.txt do modelo original'}},
         'extensionsUsed': ['KHR_mesh_quantization'], 'extensionsRequired': ['KHR_mesh_quantization'],
         'scene': 0, 'scenes': [{'nodes': [0]}],
         'nodes': [{'mesh': 0, 'name': 'spiky_hair', 'translation': [float(x) for x in c], 'scale': [float(x) for x in h]}],
         'meshes': [{'primitives': [{'attributes': {'POSITION': 1, 'NORMAL': 2, 'TEXCOORD_0': 3}, 'indices': 0, 'material': 0}]}],
         'materials': [{'name': 'spiky', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0.0, 'roughnessFactor': 0.9}}],
         'textures': [{'source': 0, 'sampler': 0}], 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
         'images': [{'bufferView': 4, 'mimeType': 'image/jpeg'}],
         'accessors': [dict(bufferView=0, componentType=5123, count=int(idx.size), type='SCALAR'),
                       dict(bufferView=1, componentType=5122, normalized=True, count=n, type='VEC3', min=[-1, -1, -1], max=[1, 1, 1]),
                       dict(bufferView=2, componentType=5120, normalized=True, count=n, type='VEC3'),
                       dict(bufferView=3, componentType=5123, normalized=True, count=n, type='VEC2')],
         'bufferViews': bvs, 'buffers': [{'byteLength': int(offs[-1])}]}
    js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
    body = b''.join(parts)
    glb = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(body)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(body), b'BIN\0') + body
    open(fn, 'wb').write(glb); return len(glb)


def b64(a): return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def main():
    os.makedirs(OUT, exist_ok=True)
    tmp_in, tmp_out = os.path.join(OUT, '.spiky_in.bin'), os.path.join(OUT, '.spiky_out.bin')
    build_spiky_input(tmp_in)
    tex = jpeg(Image.open(os.path.join(SPIKY_DIR, 'textures', [f for f in os.listdir(os.path.join(SPIKY_DIR, 'textures'))][0])), TEX_PX, TEX_Q)
    target = 62000
    for _ in range(6):
        P, T, U = run_qem(tmp_in, tmp_out, target)
        # modelo (+X frente, +Y cima) → jogo (+Z frente, +Y cima): gira -90° em Y; escala e posiciona na cabeça
        G = np.stack([-P[:, 2] * SPIKY_S, SPIKY_Y0 + (P[:, 1] + .1) * SPIKY_S, SPIKY_Z0 + P[:, 0] * SPIKY_S], 1).astype(np.float32)
        N = smooth_normals(G, T)
        Pv, Nv, Uv, Iv = unique_corners(G, T, U, N)
        qp, qn, c, h = quantize(Pv, Nv)
        size = write_glb(os.path.join(OUT, 'spiky_hair_1mb.glb'), qp, qn, Uv, Iv, c, h, tex)
        print('alvo %d tris → %d vértices, %d tris, glb %d bytes' % (target, len(Pv), len(Iv), size))
        if size <= GLB_LIMIT and size > GLB_LIMIT * .93: break
        target = int(target * (GLB_LIMIT * .965 / size) ** .85)
    assert size <= GLB_LIMIT, 'glb acima do limite'
    spiky = dict(pos=b64(qp), pc=[float(x) for x in c], ph=[float(x) for x in h], nrm=b64(qn), uv=b64(Uv), idx=b64(Iv.astype(np.uint16)),
                 tex='data:image/jpeg;base64,' + base64.b64encode(tex).decode(), n=len(Pv), nt=len(Iv))

    # ---- ssj5 (925 vértices) ----
    g, acc = read_gltf(SSJ5_DIR); p = g['meshes'][0]['primitives'][0]
    P5, N5, U5, I5 = acc(p['attributes']['POSITION']), acc(p['attributes']['NORMAL']), acc(p['attributes']['TEXCOORD_0']), acc(p['indices']).ravel()
    R = lambda a: np.stack([a[:, 0], a[:, 2], -a[:, 1]], 1)                      # gira o nó raiz (-90° X) → +Y cima, +Z frente
    G5 = (R(P5) * SSJ5_S + np.array(SSJ5_D)).astype(np.float32); N5 = R(N5)
    qp5, qn5, c5, h5 = quantize(G5, N5)
    qu5 = np.round(np.clip(U5, 0, 1) * 65535).astype(np.uint16)
    timg = Image.open(os.path.join(SSJ5_DIR, 'textures', os.listdir(os.path.join(SSJ5_DIR, 'textures'))[0])).convert('L').resize((1024, 1024), Image.LANCZOS)
    bio = io.BytesIO(); timg.save(bio, 'PNG', optimize=True)
    ssj5 = dict(pos=b64(qp5), pc=[float(x) for x in c5], ph=[float(x) for x in h5], nrm=b64(qn5), uv=b64(qu5), idx=b64(I5.astype(np.uint16)),
                tex='data:image/png;base64,' + base64.b64encode(bio.getvalue()).decode(), n=len(qp5), nt=len(I5) // 3)

    js = ('/* Open World Mayhem — dados dos cabelos novos (GERADO por convert_hair.py; não edite à mão).\n'
          '   Spiky Hair (autor/licença: ver CREDITS.txt) e SSJ5 Hair por Nemix (CC-BY-4.0). pos = int16 normalizado (centro pc, meia-extensão ph),\n'
          '   nrm = int8, uv = uint16 normalizado, idx = uint16. Já no espaço do personagem (+Y cima, +Z frente, cabeça em 0,1.635,.04). */\n'
          'window.OWM=window.OWM||{};OWM.hairData=' + json.dumps({'spiky': spiky, 'ssj5': ssj5}, separators=(',', ':')) + ';\n')
    open(os.path.join(OUT, 'hair-data.js'), 'w').write(js)
    print('hair-data.js: %d bytes' % len(js))
    for f in (tmp_in, tmp_out): os.remove(f)


main()
