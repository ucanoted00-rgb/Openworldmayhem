#!/usr/bin/env python3
"""OWM — troca o clipe 'idle' de OWM.ual (avatar.js) por um GLB Quaternius UAL (ex.: Idle_-_relaxed.glb).

Uso:  python3 convert_idle.py Idle_-_relaxed.glb [avatar.js]

Retarget em espaço de mundo (mesmo método de convert_punches.py para braços e pernas: Δ·S). A diferença é o TRONCO:
  hip   = Δ do pelve
  upper = rotação que leva a linha pelve→pescoço do bind à da pose (inclinação) + giro dos ombros em torno dela
(copiar só a vértebra spine_03 dava um tronco curvado: ela gira sozinha ~27° enquanto o corpo todo fica reto).
Formato do ualanim.js: Int16 por frame = [hip x,y,z mm] + 10 quaternions (sem 'hm'); o jogo faz q_final = UAREF·q, com
UAREF = inverso do frame 0 do idle ANTIGO. Para que a pose final seja exatamente a calculada aqui, grava-se q = F0·q_local,
e o frame 0 antigo vai para OWM.ual.ref (os outros clipes — walk/jog/sprint/pulo — continuam idênticos).
"""
import sys, re, base64
import numpy as np
from scipy.spatial.transform import Rotation as R
import convert_punches as cp

glb = sys.argv[1]; js = sys.argv[2] if len(sys.argv) > 2 else 'avatar.js'
src = open(js, encoding='utf-8').read()
S = 3 + 10 * 4
m = re.search(r'"idle":\{"dur":([\d.]+),"n":(\d+),"loop":true,"dist":0\.0,"d":"([^"]*)"\}', src)
n_old, b64 = int(m.group(2)), m.group(3)
old = np.frombuffer(base64.b64decode(b64), dtype='<i2').reshape(n_old, S)
# se já foi trocado antes, a referência verdadeira está em OWM.ual.ref
mr = re.search(r'const refB64="([^"]*)"', src)
if mr: old = np.frombuffer(base64.b64decode(mr.group(1)), dtype='<i2').reshape(1, S)
F0q = old[0, 3:].reshape(10, 4) / 32767.0
F0p = old[0, :3].astype(int)
REFB64 = base64.b64encode(old[0].tobytes()).decode()

j, b = cp.load(glb)
nodes = j['nodes']; sk = j['skins'][0]; jn = sk['joints']
names = [nodes[i].get('name') for i in jn]; byname = {n: jn[k] for k, n in enumerate(names)}
par = {}
for i, nd in enumerate(nodes):
    for c in nd.get('children', []): par[c] = i
ibm = cp.acc(j, b, sk['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
Wb = {n: np.linalg.inv(ibm[k]) for k, n in enumerate(names)}
chans = {}
for ch in j['animations'][0]['channels']:
    s = j['animations'][0]['samplers'][ch['sampler']]
    chans[(ch['target']['node'], ch['target']['path'])] = (cp.acc(j, b, s['input']), cp.acc(j, b, s['output']))
dep = lambda i: 0 if i not in par else 1 + dep(par[i])
allnodes = sorted(range(len(nodes)), key=dep)
dur = float(max(c[0][-1] for c in chans.values()))
nf = int(round(dur * cp.FPS))
norm = lambda M: M[:3, :3] / np.cbrt(abs(np.linalg.det(M[:3, :3])))

def unit(v): return v / np.linalg.norm(v)
def twist_about(axis, a, bb):  # rotação em torno de 'axis' que leva a (projetado) em bb (projetado)
    axis = unit(axis)
    pa = a - axis * (a @ axis); pb = bb - axis * (bb @ axis)
    if np.linalg.norm(pa) < 1e-9 or np.linalg.norm(pb) < 1e-9: return R.identity()
    pa, pb = unit(pa), unit(pb)
    ang = np.arctan2(axis @ np.cross(pa, pb), pa @ pb)
    return R.from_rotvec(axis * ang)

bp = lambda n: Wb[n][:3, 3]
out_q = np.zeros((nf, 10, 4)); out_p = np.zeros((nf, 3)); pel0 = None
ORD10 = [k for k in cp.ORDER if k != 'hm']
for f in range(nf):
    t = f / cp.FPS; W = {}
    for i in allnodes:
        nd = nodes[i]; tr = np.array(nd.get('translation', [0, 0, 0]), float); ro = np.array(nd.get('rotation', [0, 0, 0, 1]), float)
        sc = np.array(nd.get('scale', [1, 1, 1]), float)
        if (i, 'translation') in chans: tt, vv = chans[(i, 'translation')]; tr = cp.sample_channel(tt, vv, t, False)
        if (i, 'rotation') in chans: tt, vv = chans[(i, 'rotation')]; ro = cp.sample_channel(tt, vv, t, True)
        M = np.eye(4); M[:3, :3] = R.from_quat(ro).as_matrix() @ np.diag(sc); M[:3, 3] = tr
        W[i] = (W[par[i]] @ M) if i in par else M
    P = lambda n: W[byname[n]][:3, 3]
    Rw = {}
    for bn in cp.ORDER:
        u, chd = cp.MAP[bn]
        Rp = R.from_matrix(norm(W[byname[u]])); Rb = R.from_matrix(norm(Wb[u])); delta = Rp * Rb.inv()
        Sw = R.identity()
        if chd: Sw = cp.swing(cp.avdir(bn), bp(chd) - bp(u))
        Rw[bn] = delta * Sw
    # tronco: inclinação da linha pelve→pescoço + giro dos ombros em torno dela
    d_b = unit(bp('neck_01') - bp('pelvis')); d_p = unit(P('neck_01') - P('pelvis'))
    R1 = cp.swing(d_b, d_p)
    v_b = bp('upperarm_l') - bp('upperarm_r'); v_p = P('upperarm_l') - P('upperarm_r')
    Rw['upper'] = twist_about(d_p, R1.apply(v_b), v_p) * R1
    for k, bn in enumerate(cp.ORDER):
        if bn == 'hm': continue
        p = cp.PARENT[bn]; loc = (Rw[p].inv() * Rw[bn]) if p else Rw[bn]
        q = loc.as_quat()
        if q[3] < 0: q = -q
        out_q[f, ORD10.index(bn)] = q
    pel = P('pelvis')
    if pel0 is None: pel0 = Wb['pelvis'][:3, 3].copy()
    out_p[f] = (pel - pel0) * (cp.HIPY / pel0[1])

if __name__ == '__main__' and '--dump' in sys.argv:
    np.save('/tmp/idle_local.npy', out_q); sys.exit()
out = np.zeros((nf, S), dtype='<i2')
for f in range(nf):
    for k in range(10):
        qq = (R.from_quat(F0q[k]) * R.from_quat(out_q[f, k])).as_quat()   # UAREF·q = pose local
        if qq[3] < 0: qq = -qq
        out[f, 3 + k * 4:3 + k * 4 + 4] = np.clip(np.round(qq * 32767), -32767, 32767)
    out[f, :3] = np.clip(np.round(F0p + out_p[f] * 1000), -32767, 32767)
new = '"idle":{"dur":%s,"n":%d,"loop":true,"dist":0.0,"d":"%s"}' % ('%.8g' % (nf / cp.FPS), nf, base64.b64encode(out.tobytes()).decode())
src = src[:m.start()] + new + src[m.end():]
if not mr:
    src = src.replace('OWM.ual={clips,ORDER,STRIDE,ref};', 'OWM.ual={clips,ORDER,STRIDE,ref};', 1)
open(js, 'w', encoding='utf-8').write(src)
print('idle: %d frames, %.4f s' % (nf, nf / cp.FPS))
