#!/usr/bin/env python3
"""Converte o modelo "Low Poly Zombie Game Animation" (Jerome Angeles, CC-BY-4.0) em zombie.js (OWM.zombiePack + OWM.Zombie).

Uso:  python3 convert_zombie.py <pasta com scene.gltf/scene.bin/textures/> [saida=zombie.js]

O que é gravado:
  mesh : só a malha do corpo (1723 vértices). Descartados: as 2 esferas dos olhos (no GLB ficam ~4 unidades ACIMA da cabeça),
         a casca preta de contorno (Skin_blinn1_0) e os mapas de normal/metal-rugosidade (pesados e inúteis no estilo PS1).
  skel : só as juntas que têm peso na pele + seus ancestrais (as juntas IK/FK de controle são descartadas)
  clips: os 4 clipes foram exportados com enormes trechos PARADOS (Walk só se mexe em 4,2–5,8 s, Attack em 5,9–7,5 s, Death em 7,5–9,2 s);
         aqui cada um é recortado só no trecho com movimento e reamostrado a 30 fps (keys originais: 40 fps)
  tex  : textura base reduzida para 512 px (JPEG)
O código de OWM.Zombie (depois do marcador /* ===== CODIGO ===== */) é mantido ao regerar.
"""
import base64, io, json, os, sys
import numpy as np
from PIL import Image
from scipy.spatial.transform import Rotation as R

src = sys.argv[1] if len(sys.argv) > 1 else 'zombie_src'
out = sys.argv[2] if len(sys.argv) > 2 else 'zombie.js'
SC = 0.08          # metros por unidade do esqueleto (hunched idle ≈ 1,6 m; em pé, 1,9 m)
FPS = 30
# janelas (s do clipe original). loop=True: o último quadro NÃO é repetido
WINDOWS = {'idle': (0.0, 125 / 30, True), 'walk': (4.1667, 5.8333, True), 'attack': (5.8333, 7.5, False), 'death': (7.5, 9.1667, False)}
NAMES = {'idle': 'Idle', 'walk': 'Walk', 'attack': 'Attack', 'death': 'Death'}

g = json.load(open(os.path.join(src, 'scene.gltf')))
buf = open(os.path.join(src, 'scene.bin'), 'rb').read()
N = g['nodes']
CT = {5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1'}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def acc(i):
    a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]; n = NC[a['type']]; dt = np.dtype(CT[a['componentType']])
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); st = bv.get('byteStride', 0); sz = dt.itemsize * n
    if st and st != sz:
        arr = np.frombuffer(buf, dtype=np.uint8, count=a['count'] * st, offset=off).reshape(a['count'], st)[:, :sz].copy().view(dt)
    else:
        arr = np.frombuffer(buf, dtype=dt, count=a['count'] * n, offset=off)
    return arr.reshape(a['count'], n).astype(float) if n > 1 else arr.astype(float)


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


par_node = {}
for i, n in enumerate(N):
    for c in n.get('children', []):
        par_node[c] = i
sk = g['skins'][0]; JN = sk['joints']; NJ = len(JN)
jpar = [JN.index(par_node[n]) if par_node.get(n) in JN else -1 for n in JN]
IBM = acc(sk['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)

# ---- malha do corpo ----
mesh = next(m for m in g['meshes'] if m['name'] == 'Skin_lambert1_0')['primitives'][0]
at = mesh['attributes']
P = acc(at['POSITION']); NR = acc(at['NORMAL']); UV = acc(at['TEXCOORD_0']); J = acc(at['JOINTS_0']).astype(int); W = acc(at['WEIGHTS_0']); I = acc(mesh['indices']).astype(int)

# ---- juntas mantidas: com peso + ancestrais ----
need = set(J[W > 0].ravel().tolist())
for b in list(need):
    while jpar[b] >= 0:
        b = jpar[b]; need.add(b)
keep = sorted(need)                     # mantém a ordem original (pai antes do filho)
remap = {b: k for k, b in enumerate(keep)}
NB = len(keep)
kpar = [remap[jpar[b]] if jpar[b] >= 0 else -1 for b in keep]
assert all(kpar[k] < k for k in range(NB)), 'pai depois do filho'
# a raiz tem que ter mundo = identidade (o pai da raiz no glTF é só Sketchfab_model/…)
anc = []; p = par_node.get(JN[keep[0]])
M = np.eye(4)
while p is not None:
    n = N[p]
    if 'matrix' in n: m = np.array(n['matrix']).reshape(4, 4).T
    else:
        m = np.eye(4); m[:3, :3] = R.from_quat(n.get('rotation', [0, 0, 0, 1])).as_matrix() @ np.diag(n.get('scale', [1, 1, 1])); m[:3, 3] = n.get('translation', [0, 0, 0])
    M = m @ M; p = par_node.get(p)
assert np.allclose(M, np.eye(4), atol=1e-6), 'ancestrais da raiz não são identidade'

Jn = np.vectorize(lambda b: remap.get(int(b), 0))(J)
Jn = np.where(W > 0, Jn, 0)
Wq = np.zeros(W.shape, dtype=int)
for v in range(len(W)):   # pesos uint8 somando exatamente 255
    w = W[v] / max(W[v].sum(), 1e-9) * 255; f = np.floor(w).astype(int); r = 255 - f.sum()
    for k in np.argsort(-(w - f))[:r]: f[k] += 1
    Wq[v] = f
SCP_ = 32767 / np.ceil(np.abs(P).max())      # int16: vértices em unidades da malha
mesh_pack = {'sc': float(SCP_), 'pos': b64(np.round(P * SCP_).astype('<i2')), 'nor': b64(np.round(NR * 127).astype('i1')),
             'uv': b64(np.round(UV * 65535).astype('<u2')), 'jnt': b64(Jn.astype('u1')), 'wgt': b64(Wq.astype('u1')), 'idx': b64(I.astype('<u2'))}

# ---- esqueleto (repouso dos nós) ----
T0 = np.array([N[JN[b]].get('translation', [0, 0, 0]) for b in keep], dtype='<f4')
Q0 = np.array([N[JN[b]].get('rotation', [0, 0, 0, 1]) for b in keep], dtype='<f4')
S0 = np.array([N[JN[b]].get('scale', [1, 1, 1]) for b in keep], dtype='<f4')
assert np.allclose(S0, 1, atol=1e-4), 'escala nos nós das juntas'
skel_pack = {'par': kpar, 't': b64(T0), 'q': b64(Q0), 's': b64(S0), 'ibm': b64(np.array([IBM[b].T for b in keep], dtype='<f4'))}

# ---- animações ----
def slerp(a, b, t):
    d = float(np.dot(a, b))
    if d < 0: b = -b; d = -d
    if d > 0.9995: r = a + (b - a) * t
    else:
        th = np.arccos(d); r = (np.sin((1 - t) * th) * a + np.sin(t * th) * b) / np.sin(th)
    return r / np.linalg.norm(r)

anims = {}
for a in g['animations']:
    trk = {}
    for ch in a['channels']:
        s = a['samplers'][ch['sampler']]
        trk[(ch['target']['node'], ch['target']['path'])] = (acc(s['input']).reshape(-1), acc(s['output']))
    anims[a['name']] = trk


def sample(trk, node, path, t, rest):
    k = (node, path)
    if k not in trk: return np.array(rest, float)
    ts, vs = trk[k]
    if len(ts) == 1 or t <= ts[0]: return vs[0]
    if t >= ts[-1]: return vs[-1]
    i = int(np.searchsorted(ts, t)) - 1; a = (t - ts[i]) / (ts[i + 1] - ts[i])
    return slerp(vs[i], vs[i + 1], a) if path == 'rotation' else vs[i] * (1 - a) + vs[i + 1] * a


def frames_of(name):
    a, b, loop = WINDOWS[name]
    n = int(round((b - a) * FPS)) + (0 if loop else 1)
    return [a + i / FPS for i in range(n)], loop

# juntas cuja translação muda em algum clipe → tj
tj = set()
for name in WINDOWS:
    trk = anims[NAMES[name]]; ts, _ = frames_of(name)
    for k, b in enumerate(keep):
        key = (JN[b], 'translation')
        if key in trk:
            v = np.array([sample(trk, JN[b], 'translation', t, T0[k]) for t in ts])
            if np.ptp(v, axis=0).max() > 1e-3: tj.add(k)
tj = sorted(tj)

clips = {}; clipdat = {}
for name in WINDOWS:
    trk = anims[NAMES[name]]; ts, loop = frames_of(name); n = len(ts)
    q = np.zeros((n, NB, 4)); t = np.zeros((n, len(tj), 3))
    for f, tt in enumerate(ts):
        for k, b in enumerate(keep):
            v = sample(trk, JN[b], 'rotation', tt, Q0[k]); v = v / np.linalg.norm(v)
            if f and np.dot(v, q[f - 1, k]) < 0: v = -v
            q[f, k] = v
        for m, k in enumerate(tj):
            t[f, m] = sample(trk, JN[keep[k]], 'translation', tt, T0[k])
    clipdat[name] = (q, t, loop)
    clips[name] = {'n': n, 'loop': 1 if loop else 0, 'q': b64(np.round(q * 32767).astype('<i2')), 't': b64(np.round(t * 1000).astype('<i2'))}
    assert np.abs(t).max() < 32.7, 'translação não cabe em int16/1000'

# ---- pose mundial a partir dos dados quantizados (verificação e métricas) ----
def local_m(k, qv, tv):
    m = np.eye(4); m[:3, :3] = R.from_quat(qv).as_matrix(); m[:3, 3] = tv; return m

def world_pose(name, f):
    q, t, _ = clipdat[name]; Wd = []
    for k in range(NB):
        tv = T0[k].astype(float)
        if k in tj: tv = t[f, tj.index(k)]
        m = local_m(k, q[f, k], tv); Wd.append(Wd[kpar[k]] @ m if kpar[k] >= 0 else m)
    return Wd

names_keep = [N[JN[b]]['name'] for b in keep]
def jidx(sub, side):
    c = [k for k, nm in enumerate(names_keep) if sub in nm and nm.startswith(side)]
    return c[0] if c else None

# momento do golpe: máxima extensão à frente (z) de qualquer mão
hands = [k for k, nm in enumerate(names_keep) if 'Hand' in nm or 'Wrist' in nm]
q_, t_, _ = clipdat['attack']; best = (-1e9, 0)
for f in range(len(q_)):
    Wd = world_pose('attack', f); z = max(Wd[k][2, 3] for k in hands)
    if z > best[0]: best = (z, f)
hit_f = best[1]; hit = hit_f / (len(q_) - 1)

# velocidade natural do passo: velocidade (para trás) do pé em contato com o chão, em unidades/s
feet = [k for k, nm in enumerate(names_keep) if 'Ball' in nm or 'Toe' in nm]
nW = len(clipdat['walk'][0]); speeds = []
for k in feet:
    ys = []; zs = []
    for f in range(nW):
        Wd = world_pose('walk', f); ys.append(Wd[k][1, 3]); zs.append(Wd[k][2, 3])
    ys = np.array(ys); zs = np.array(zs); ground = ys.min()
    vel = -(np.diff(zs) * FPS); cont = (ys[:-1] < ground + 0.35) & (ys[1:] < ground + 0.35) & (vel > 0.5)
    if cont.sum() > 3: speeds.append(float(np.median(vel[cont])))
v0 = float(np.mean(speeds)) if speeds else float('nan')

# altura / alcance (métricas para o jogo)
def skinned_bbox(name, f):
    Wd = world_pose(name, f)
    mats = np.array([Wd[k] @ IBM[keep[k]] for k in range(NB)])
    Ph = np.c_[P, np.ones(len(P))]; o = np.zeros((len(P), 3))
    for c in range(4): o += W[:, c:c + 1] * np.einsum('vij,vj->vi', mats[Jn[:, c]], Ph)[:, :3]
    return o.min(0), o.max(0)
bb_idle = skinned_bbox('idle', 0); bb_hit = skinned_bbox('attack', hit_f)

# ---- textura ----
im = Image.open(os.path.join(src, 'textures', 'lambert1_baseColor.jpeg')).convert('RGB').resize((512, 512), Image.LANCZOS)
bio = io.BytesIO(); im.save(bio, 'JPEG', quality=82, optimize=True)
tex = 'data:image/jpeg;base64,' + base64.b64encode(bio.getvalue()).decode()

pack = {'fps': FPS, 'sc': SC, 'mesh': mesh_pack, 'skel': skel_pack, 'tj': tj, 'clips': clips, 'hit': round(hit, 4), 'tex': tex,
        'bbox': {'idle': [bb_idle[0].round(2).tolist(), bb_idle[1].round(2).tolist()], 'hit': [bb_hit[0].round(2).tolist(), bb_hit[1].round(2).tolist()]},
        'walkV0': round(v0 * SC, 3)}
head = open(out, encoding='utf-8').read().split('/* ===== CODIGO ===== */')[1] if os.path.exists(out) and '/* ===== CODIGO ===== */' in open(out, encoding='utf-8').read() else None
if head is None:
    head = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'zombie_code.js'), encoding='utf-8').read()
hdr = ('/* ═══════════════════ [zombie.js] Zumbi (OWM.Zombie) ═══════════════════ */\n'
       '/* "Low Poly Zombie (Game Animation)" por Jerome Angeles — CC-BY-4.0 (https://sketchfab.com/3d-models/low-poly-zombie-game-animation-9f8f0885b2f94c6890c4debaceac9421). Gerado por convert_zombie.py; veja CREDITS.txt. */\n'
       'OWM.zombiePack=' + json.dumps(pack, separators=(',', ':')) + ';\n/* ===== CODIGO ===== */')
open(out, 'w', encoding='utf-8').write(hdr + head)
print('juntas', NB, 'de', NJ, '| tj', [names_keep[k] for k in tj])
for nme in clips: print(' clipe', nme, 'quadros', clips[nme]['n'], 'loop', clips[nme]['loop'], 'dur(s)', round(clips[nme]['n'] / FPS if clips[nme]['loop'] else (clips[nme]['n'] - 1) / FPS, 3))
print('momento do golpe: quadro', hit_f, '→ fração', round(hit, 3), '| v0 do passo (m/s a 1×):', round(v0 * SC, 3))
print('bbox idle (un):', bb_idle[0].round(1), bb_idle[1].round(1), '| alcance no golpe z máx:', round(bb_hit[1][2], 1), '→ m:', round(bb_hit[1][2] * SC, 2))
print('tamanho do pack (KB):', round(len(json.dumps(pack)) / 1024))
