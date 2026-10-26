#!/usr/bin/env python3
"""Converte o modelo "Snake" (ChristineDesigns, CC-BY-4.0) em snake.js (OWM.snakePack).

Uso:  python3 convert_snake.py <pasta com scene.gltf/scene.bin/textures/> [saida=snake_pack.js]

Entrada: o glTF do Sketchfab (snake.zip descompactado).
Saída:   um arquivo JS com `OWM.snakePack={...}`; o snake.js do jogo é esse arquivo + o código de
         OWM.Snake (a parte depois do marcador "/* ===== CODIGO ===== */" é mantida ao regerar).

O que é gravado:
  mesh  : 485 vértices (pos int16/sc, nor int8/127, uv uint16/65535, jnt uint8x4, wgt uint8x4, idx uint16)
  skel  : 21 juntas (par, t, q, s, ibm — float32 em base64)
  clip  : o único clipe do modelo ("Take 001", 17,33 s, 30 fps, loop perfeito), amostrado quadro a quadro:
          q int16/32767 [n][junta][4] + translação int16/1000 só das juntas que se mexem (tj)
  tex   : textura base (JPEG 512) como data URL
"""
import base64, io, json, struct, sys, os
import numpy as np
from PIL import Image

src = sys.argv[1] if len(sys.argv) > 1 else 'snake_src'
out = sys.argv[2] if len(sys.argv) > 2 else 'snake_pack.js'

g = json.load(open(os.path.join(src, 'scene.gltf')))
buf = open(os.path.join(src, 'scene.bin'), 'rb').read()
N = g['nodes']


def acc(i):
    a = g['accessors'][i]
    bv = g['bufferViews'][a['bufferView']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    dt = {5126: '<f4', 5125: '<u4', 5123: '<u2'}[a['componentType']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    st = bv.get('byteStride', 0)
    sz = np.dtype(dt).itemsize * n
    if st and st != sz:
        arr = np.frombuffer(buf, dtype=np.uint8, count=a['count'] * st, offset=off).reshape(a['count'], st)[:, :sz].copy().view(dt)
    else:
        arr = np.frombuffer(buf, dtype=dt, count=a['count'] * n, offset=off)
    return arr.reshape(a['count'], n) if n > 1 else arr.copy()


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


par_node = {}
for i, n in enumerate(N):
    for c in n.get('children', []):
        par_node[c] = i

sk = g['skins'][0]
JN = sk['joints']
NJ = len(JN)
jpar = [JN.index(par_node[n]) if par_node.get(n) in JN else -1 for n in JN]


def qmat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def local(n):
    if 'matrix' in n:
        return np.array(n['matrix']).reshape(4, 4).T
    M = np.eye(4)
    if 'scale' in n:
        M[:3, :3] = np.diag(n['scale'])
    if 'rotation' in n:
        M[:3, :3] = qmat(n['rotation']) @ M[:3, :3]
    if 'translation' in n:
        M[:3, 3] = n['translation']
    return M


def world(i):
    M = local(N[i])
    while i in par_node:
        i = par_node[i]
        M = local(N[i]) @ M
    return M


# a raiz da cobra (_rootJoint) precisa ter mundo = identidade para o modelo ficar em pé, de frente pra +Z
assert np.allclose(world(JN[0]), np.eye(4), atol=1e-6), 'raiz não é identidade: aplicar a matriz na junta 0'

# ---- malha ----
prim = g['meshes'][0]['primitives'][0]['attributes']
P = acc(prim['POSITION'])
Nn = acc(prim['NORMAL'])
UV = acc(prim['TEXCOORD_0'])
JI = acc(prim['JOINTS_0']).astype(np.uint8)
W = acc(prim['WEIGHTS_0'])
IDX = acc(g['meshes'][0]['primitives'][0]['indices']).astype(np.uint16)
IBM = acc(sk['inverseBindMatrices'])  # (21,16) coluna-maior, como o three.js

sc = float(32000.0 / np.abs(P).max())
pos = np.round(P * sc).astype(np.int16)
nor = np.round(np.clip(Nn, -1, 1) * 127).astype(np.int8)
uv = np.round(np.clip(UV, 0, 1) * 65535).astype(np.uint16)
Wn = W / np.maximum(W.sum(1, keepdims=True), 1e-9)
wgt = np.round(Wn * 255).astype(np.int32)
for v in range(len(wgt)):  # soma exatamente 255
    wgt[v, int(np.argmax(wgt[v]))] += 255 - wgt[v].sum()
wgt = wgt.astype(np.uint8)

# ---- esqueleto (pose de repouso) ----
rt = np.array([N[n].get('translation', [0, 0, 0]) for n in JN], np.float32)
rq = np.array([N[n].get('rotation', [0, 0, 0, 1]) for n in JN], np.float32)
rs = np.array([N[n].get('scale', [1, 1, 1]) for n in JN], np.float32)

# ---- clipe ----
A = g['animations'][0]
FPS = 30
DUR = max(float(acc(s['input']).max()) for s in A['samplers'])
NF = int(round(DUR * FPS)) + 1
trk = {}
for ch in A['channels']:
    s = A['samplers'][ch['sampler']]
    trk[(ch['target']['node'], ch['target']['path'])] = (acc(s['input']).reshape(-1), acc(s['output']))


def slerp(a, b, t):
    d = float(np.dot(a, b))
    if d < 0:
        b = -b
        d = -d
    if d > 0.9995:
        r = a + (b - a) * t
    else:
        th = np.arccos(d)
        r = (np.sin((1 - t) * th) * a + np.sin(t * th) * b) / np.sin(th)
    return r / np.linalg.norm(r)


def ev(node, path, t, rest):
    k = (node, path)
    if k not in trk:
        return np.array(rest, float)
    ts, vs = trk[k]
    if len(ts) == 1 or t <= ts[0]:
        return vs[0].astype(float)
    if t >= ts[-1]:
        return vs[-1].astype(float)
    i = int(np.searchsorted(ts, t)) - 1
    a = (t - ts[i]) / (ts[i + 1] - ts[i])
    if path == 'rotation':
        return slerp(vs[i].astype(float), vs[i + 1].astype(float), a)
    return vs[i] * (1 - a) + vs[i + 1] * a


CQ = np.zeros((NF, NJ, 4))
CT = np.zeros((NF, NJ, 3))
for f in range(NF):
    t = f / FPS
    for j, n in enumerate(JN):
        CQ[f, j] = ev(n, 'rotation', t, N[n].get('rotation', [0, 0, 0, 1]))
        CT[f, j] = ev(n, 'translation', t, N[n].get('translation', [0, 0, 0]))
        sv = ev(n, 'scale', t, N[n].get('scale', [1, 1, 1]))
        assert np.allclose(sv, rs[j], atol=1e-3), 'escala animada: precisa gravar escala no clipe'

# só as juntas cuja translação muda ao longo do clipe
tj = [j for j in range(NJ) if (CT[:, j].max(0) - CT[:, j].min(0)).max() > 1e-3]
for j in range(NJ):
    if j not in tj:
        assert np.allclose(CT[:, j], rt[j], atol=1e-3), 'translação divergente do repouso na junta %d' % j
CTs = CT[:, tj, :]
assert np.abs(CTs).max() * 1000 < 32760, 'translação estoura int16'
# loop perfeito?
loop_err = float(np.abs(np.abs((CQ[0] * CQ[-1]).sum(1)) - 1).max())
print('quadros', NF, 'fps', FPS, 'dur', DUR, 'juntas c/ translação', tj, 'erro de loop', loop_err)

q16 = np.round(CQ * 32767).astype(np.int16)
t16 = np.round(CTs * 1000).astype(np.int16)

# ---- textura ----
im = Image.open(os.path.join(src, g['images'][0]['uri'])).convert('RGB')
bio = io.BytesIO()
im.save(bio, 'JPEG', quality=86, optimize=True)
tex = 'data:image/jpeg;base64,' + base64.b64encode(bio.getvalue()).decode()

bb = P.min(0).tolist() + P.max(0).tolist()
pack = {
    'mesh': {'n': int(len(P)), 'sc': sc, 'pos': b64(pos), 'nor': b64(nor), 'uv': b64(uv), 'jnt': b64(JI), 'wgt': b64(wgt), 'idx': b64(IDX)},
    'skel': {'par': jpar, 't': b64(rt), 'q': b64(rq), 's': b64(rs), 'ibm': b64(IBM.astype(np.float32))},
    'clip': {'n': NF, 'fps': FPS, 'nb': NJ, 'tj': tj, 'q': b64(q16), 't': b64(t16)},
    'tex': tex,
    'bbox': [round(x, 3) for x in bb],
}

MARK = '/* ===== CODIGO ===== */'
head = ('/* Open World Mayhem — cobra (SkinnedMesh).\n'
        '   Modelo "Snake" por ChristineDesigns (https://sketchfab.com/ChristineDesigns), CC-BY-4.0 — rig, textura e animação originais\n'
        '   (um único clipe de 17,33 s em loop perfeito; idle/andar/correr/bote usam trechos dele, ver OWM.Snake).\n'
        '   Gerado por convert_snake.py. Formato: mesh {pos int16/sc, nor int8/127, uv uint16/65535, jnt uint8x4, wgt uint8x4/255, idx uint16};\n'
        '   skel {par,t,q,s,ibm float32}; clip {n,fps,nb,tj, q int16/32767 [n][junta][4], t int16/1000 [n][tj][3]}; tex = data URL JPEG. */\n')
body = 'OWM.snakePack=' + json.dumps(pack, separators=(',', ':')) + ';\n'
code = ''
if os.path.exists('snake.js'):
    old = open('snake.js', encoding='utf-8').read()
    if MARK in old:
        code = old[old.index(MARK):]
open(out, 'w', encoding='utf-8').write(head + body + (code or MARK + '\n'))
print('gravado', out, len(head + body) // 1024, 'KB')
