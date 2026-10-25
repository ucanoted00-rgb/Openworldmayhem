#!/usr/bin/env python3
"""Converte "Low-poly Combat Knife" (maurisnosram123, CC-BY-4.0) em knife.js para o Open World Mayhem.
Uso: python3 convert_knife.py <arquivo.glb> <saida knife.js>
- aplica a transformação do nó raiz (modelo fica com a lâmina pra +Y, gume pra +X, faces planas em ±Z);
- origem = centro do cabo; comprimento total ~0,32 m;
- sem texturas (normal maps do cabo eram só detalhe fino): 5 partes com cor/brilho próprios;
- cada parte é soldada, decimada por colapso de arestas (quádricas) e as normais são recalculadas com quebra em arestas vivas;
- posições int16 em 0,1 mm, normais int8, índices uint16 (tudo em base64).
Peças: lamina, gume, pomo, cabo, empunhadura."""
import sys, json, struct, base64, heapq
import numpy as np

src = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else 'knife.js'
LENGTH = 0.32                      # comprimento final da faca em metros
RATIO = {'BLAE': .34, 'SHARP_SIDE': .40, 'material': .45, 'HANDLE': .38, 'GRIP': .5}
INFO = {  # nome do material no GLB -> (id, cor sRGB, especular 0..1, brilho)
    'BLAE': ('lamina', '#cdd1d8', .75, 90),
    'SHARP_SIDE': ('gume', '#a3a9b2', .8, 110),
    'material': ('pomo', '#b9bdc4', .6, 70),
    'HANDLE': ('cabo', '#2c2e35', .22, 28),
    'GRIP': ('empunhadura', '#1b1c20', .08, 14),
}
CREASE = np.cos(np.radians(38))

f = open(src, 'rb').read()
cl, ct = struct.unpack('<II', f[12:20]); j = json.loads(f[20:20 + cl])
o = 20 + cl; bl, bt = struct.unpack('<II', f[o:o + 8]); buf = f[o + 8:o + 8 + bl]


def acc(i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
    t = {5126: ('f', 4), 5125: ('I', 4), 5123: ('H', 2)}[a['componentType']]
    nc = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); st = bv.get('byteStride', t[1] * nc)
    r = np.zeros((a['count'], nc))
    for k in range(nc):
        r[:, k] = np.ndarray((a['count'],), dtype=np.dtype('<' + t[0]), buffer=buf, offset=off + k * t[1], strides=(st,))
    return r


S = 0.06428602337837219          # escala do nó raiz; (x,y,z) -> (x, z, -y)
def bake(P): return np.stack([P[:, 0], P[:, 2], -P[:, 1]], 1) * S


def qem(V, F, target):
    """Decimação por colapso de arestas (quádricas), com bordas protegidas por planos extras."""
    nv = len(V); Q = np.zeros((nv, 4, 4)); faces = [list(x) for x in F]; alive = [True] * len(faces)
    vf = [set() for _ in range(nv)]
    def plane(a, b, c):
        n = np.cross(b - a, c - a); ar = np.linalg.norm(n)
        if ar < 1e-14: return None, 0
        n /= ar; return np.array([*n, -n @ a]), ar / 2
    for i, fc in enumerate(faces):
        for v in fc: vf[v].add(i)
        p, ar = plane(V[fc[0]], V[fc[1]], V[fc[2]])
        if p is not None:
            m = ar * np.outer(p, p)
            for v in fc: Q[v] += m
    # arestas de borda (usadas por 1 face): plano perpendicular, impede encolher o contorno aberto
    ec = {}
    for i, fc in enumerate(faces):
        for k in range(3):
            a, b = fc[k], fc[(k + 1) % 3]; ec.setdefault((min(a, b), max(a, b)), []).append(i)
    for (a, b), fl in ec.items():
        if len(fl) == 1:
            fc = faces[fl[0]]; p, ar = plane(V[fc[0]], V[fc[1]], V[fc[2]])
            if p is None: continue
            e = V[b] - V[a]; n = np.cross(e, p[:3]); l = np.linalg.norm(n)
            if l < 1e-14: continue
            n /= l; pl = np.array([*n, -n @ V[a]]); m = 40 * np.linalg.norm(e) ** 2 * np.outer(pl, pl)
            Q[a] += m; Q[b] += m
    ver = [0] * nv; dead = [False] * nv; nf = len(faces)
    def cost(a, b):
        M = Q[a] + Q[b]; best = None
        for p in (V[a], V[b], (V[a] + V[b]) / 2):
            h = np.append(p, 1.); c = h @ M @ h
            if best is None or c < best[0]: best = (c, p)
        return best
    heap = []
    def push(a, b):
        if a > b: a, b = b, a
        c, p = cost(a, b); heapq.heappush(heap, (c, a, b, ver[a], ver[b], p))
    for (a, b) in ec: push(a, b)
    while nf > target and heap:
        c, a, b, va, vb, p = heapq.heappop(heap)
        if dead[a] or dead[b] or va != ver[a] or vb != ver[b]: continue
        bad = False; shared = vf[a] & vf[b]
        for i in (vf[a] | vf[b]) - shared:
            fc = faces[i]
            old = [V[v] for v in fc]; new = [p if v in (a, b) else V[v] for v in fc]
            n0 = np.cross(old[1] - old[0], old[2] - old[0]); n1 = np.cross(new[1] - new[0], new[2] - new[0])
            l0 = np.linalg.norm(n0); l1 = np.linalg.norm(n1)
            if l1 < 1e-16 or (l0 > 0 and n0 @ n1 / (l0 * l1) < .5): bad = True; break
        if bad: continue
        V[a] = p; Q[a] = Q[a] + Q[b]; dead[b] = True; ver[a] += 1
        for i in list(vf[b]):
            faces[i] = [a if v == b else v for v in faces[i]]; vf[a].add(i)
        for i in list(vf[a]):
            fc = faces[i]
            if len(set(fc)) < 3:
                if alive[i]: alive[i] = False; nf -= 1
                for v in fc: vf[v].discard(i)
        vf[b] = set()
        nb = set()
        for i in vf[a]:
            for v in faces[i]:
                if v != a: nb.add(v)
        for v in nb: push(a, v)
    keep = np.array([faces[i] for i in range(len(faces)) if alive[i]])
    used = np.unique(keep); remap = -np.ones(nv, int); remap[used] = np.arange(len(used))
    return V[used], remap[keep]


def shade(V, F):
    """normais suaves com quebra em arestas vivas (> ~38°): devolve vértices/normais/índices novos."""
    fa, fb, fc = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    fn = np.cross(fb - fa, fc - fa); ar = np.linalg.norm(fn, axis=1); fn /= ar[:, None] + 1e-20
    vfl = [[] for _ in range(len(V))]
    for i, t in enumerate(F):
        for k in range(3): vfl[t[k]].append((i, k))
    P = []; N = []; I = np.zeros(F.shape, int)
    for v in range(len(V)):
        groups = []   # lista de (normal acumulada, [(face, k)])
        for (i, k) in vfl[v]:
            for g in groups:
                gn = g[0] / (np.linalg.norm(g[0]) + 1e-20)
                if gn @ fn[i] > CREASE: g[0] += fn[i] * ar[i]; g[1].append((i, k)); break
            else: groups.append([fn[i] * ar[i], [(i, k)]])
        for g in groups:
            n = g[0] / (np.linalg.norm(g[0]) + 1e-20); idx = len(P); P.append(V[v]); N.append(n)
            for (i, k) in g[1]: I[i, k] = idx
    return np.array(P), np.array(N), I


parts = []
for m in j['meshes']:
    p = m['primitives'][0]; a = p['attributes']; mat = j['materials'][p['material']]['name']
    P = bake(acc(a['POSITION'])); I = acc(p['indices'])[:, 0].astype(np.int64).reshape(-1, 3)
    parts.append((mat, P, I))

allp = np.concatenate([p[1] for p in parts])
# origem: centro do cabo (empunhadura), plano médio da espessura; lâmina pra +Y
grip = [p for p in parts if p[0] == 'GRIP'][0][1]
ctr = np.array([(allp[:, 0].min() + allp[:, 0].max()) / 2, (grip[:, 1].min() + grip[:, 1].max()) / 2, (allp[:, 2].min() + allp[:, 2].max()) / 2])
length = allp[:, 1].max() - allp[:, 1].min(); K = LENGTH / length
print('comprimento original %.3f m -> %.3f m' % (length, LENGTH))

res = []; tot_t = tot_v = 0
for mat, P, I in parts:
    P = (P - ctr) * K
    # solda por posição (0,02 mm)
    key = np.round(P * 5e4).astype(np.int64); _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.reshape(-1)
    V = P[first].copy(); F = inv[I]; ok = (F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2]); F = F[ok]
    t0 = len(F); target = max(120, int(t0 * RATIO[mat]))
    V, F = qem(V, F, target)
    Pn, Nn, In = shade(V, F)
    print('%-11s %5d -> %5d tris, %5d verts' % (mat, t0, len(F), len(Pn)))
    tot_t += len(F); tot_v += len(Pn)
    pid, col, spec, shin = INFO[mat]
    pos = np.clip(np.round(Pn * 1e4), -32767, 32767).astype('<i2'); nor = np.clip(np.round(Nn * 127), -127, 127).astype('i1')
    b64 = lambda a: base64.b64encode(a.tobytes()).decode()
    res.append({'id': pid, 'col': col, 'spec': spec, 'shin': shin, 'nv': len(Pn), 'ni': int(In.size),
                'pos': b64(pos), 'nor': b64(nor), 'idx': b64(In.reshape(-1).astype('<u2'))})
print('total', tot_t, 'tris', tot_v, 'verts')
ext = np.concatenate([(p[1] - ctr) * K for p in parts])
hdr = '''/* Open World Mayhem — faca de combate (item "Faca", arma equipável).
   Modelo: "Low-poly Combat Knife" por maurisnosram123 — CC-BY-4.0
   https://sketchfab.com/3d-models/low-poly-combat-knife-9279c83fa97a4d1897fa0a6a2bcc0b8b
   Otimizado por convert_knife.py: sem texturas, 5 partes com cor própria, ~%d triângulos.
   Unidade: metros (posição int16 em 0,1 mm). Origem = centro do cabo, lâmina pra +Y, gume pra +X, faces planas em ±Z. */
''' % tot_t
js = hdr + 'OWM.knifePack=' + json.dumps({'len': LENGTH, 'min': [round(float(x), 4) for x in ext.min(0)], 'max': [round(float(x), 4) for x in ext.max(0)], 'parts': res}, separators=(',', ':')) + ';\n'
open(out, 'w').write(js)
print('escrito', out, len(js) // 1024, 'KB')
