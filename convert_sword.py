#!/usr/bin/env python3
"""OWM — golpes de espada/faca (GLBs Quaternius UAL, 66 juntas) -> rig de 11 ossos do avatar.

Uso:  python3 convert_sword.py <pasta com os 3 GLBs> [sword-clips.js]
      python3 convert_sword.py . sword-clips.js            (comando de regeneração usado no cabeçalho do .js)

Reaproveita por import o retarget de convert_punches.py (espaço de mundo: Δ·S, local = R_pai⁻¹·R) sem reescrever a
matemática; este arquivo só acrescenta o que é específico da espada:
  1. recorte da janela de frames de cada golpe;
  2. root motion XZ do pelve ZERADO em todos os frames (os GLBs andam até ~4 m; os golpes são in-place porque o jogo já
     aplica o avanço em comboPress). Fica só o Y relativo ao bind (agachado). A distância removida vai em `travel` (metros
     do GLB, só metadado);
  3. a trilha da mão de 1ª pessoa (6 valores/frame, espaço da câmera, -Z = frente), validada contra o envelope das
     trilhas `v` de KSW (avatar.js). Posição vem do GLB; a orientação vem da trilha KSW equivalente (híbrido, ver fp_track).
Formato idêntico ao punch-clips.js: 53 Int16/frame = 3 pos do quadril (/10000) + 44 quaternions (11 ossos × 4, /32767) +
6 da mão FP (/8000, ±4,09). dur=(frames-1)/30. Quaternions gravados com w>=0.
"""
import sys, os, base64
import numpy as np
from scipy.spatial.transform import Rotation as R
import convert_punches as cp          # load, acc, sample_channel, convert (retarget), ORDER, AVB, HIPY, FPS

FPS = cp.FPS
# janela [start,end] em frames do GLB, frame do acerto (pico de velocidade da mão, medido), corte equivalente do KSW (avatar.js)
CLIPS = {
    'lmb': dict(file='Sword_-_slash.glb',      start=0, end=22, hit=11, ksw=0),   # 47 frames -> 23 (0,733 s)
    'm1':  dict(file='Sword_-_slash_B.glb',    start=0, end=16, hit=7,  ksw=5),   # 17 frames, sem recorte (0,533 s)
    'm2':  dict(file='Sword_-_dash_slash.glb', start=0, end=20, hit=9,  ksw=7),   # 48 frames -> 21 (0,667 s)
}
# Trilhas v de KSW em avatar.js (mão de 1ª pessoa: [u, x,y,z, rx,ry,rz], espaço da câmera). Só as 3 usadas como orientação do híbrido.
KSW_V = {
    0: [[0,.21,-.22,-.44,0,0,0],[.2,.3,0,-.38,.15,0,-.55],[.42,.02,-.2,-.46,-.55,0,.5],[.6,-.12,-.28,-.42,-.8,0,1],[1,.21,-.22,-.44,0,0,0]],
    5: [[0,.21,-.22,-.44,0,0,0],[.22,-.02,.3,-.38,.2,0,.8],[.42,.3,-.22,-.5,-.6,0,-.45],[.6,.34,-.28,-.44,-.8,0,-.7],[1,.21,-.22,-.44,0,0,0]],
    7: [[0,.21,-.22,-.44,0,0,0],[.28,.3,-.3,-.2,.5,0,.5],[.5,-.04,-.14,-.72,-.4,0,-.25],[.68,-.02,-.16,-.66,-.4,0,-.2],[1,.21,-.22,-.44,0,0,0]],
}
KSW_HIT = {0: .4, 5: .4, 7: .5}      # fração do golpe em que o KSW acerta (campo `hit` de cada corte)
ENV = np.array([[-.12, .34], [-.34, 0.0], [-.72, -.2]])   # envelope x,y,z das trilhas v de KSW
FP_SHOULDER = np.array([.25, -.34, .22])                   # _S em avatar.js: ombro fixo da 1ª pessoa, no espaço da câmera
FP_LIM = 32767 / 8000.0                                     # Int16/8000 só guarda ±4,0959


def crn(Rr, u):
    """Catmull-Rom não uniforme, igual a crN() de avatar.js."""
    n = len(Rr); m = len(Rr[0])
    if u <= Rr[0][0]: return list(Rr[0][1:])
    if u >= Rr[n - 1][0]: return list(Rr[n - 1][1:])
    i = 0
    while i < n - 2 and u > Rr[i + 1][0]: i += 1
    a = Rr[i]; b = Rr[i + 1]; p = Rr[i - 1] if i > 0 else None; q = Rr[i + 2] if i + 2 < n else None
    h = b[0] - a[0]; t = (u - a[0]) / h; t2 = t * t; t3 = t2 * t
    h00 = 2 * t3 - 3 * t2 + 1; h10 = t3 - 2 * t2 + t; h01 = -2 * t3 + 3 * t2; h11 = t3 - t2
    o = []
    for k in range(1, m):
        m0 = (b[k] - p[k]) / (b[0] - p[0]) if p else (b[k] - a[k]) / h
        m1 = (q[k] - a[k]) / (q[0] - a[0]) if q else (b[k] - a[k]) / h
        o.append(h00 * a[k] + h10 * h * m0 + h01 * b[k] + h11 * h * m1)
    return o


def world_points(path, nframes):
    """Cinemática direta (só posições/rotações de mundo p/ a trilha FP e o root motion). O retarget em si vem de cp.convert."""
    j, b = cp.load(path); nodes = j['nodes']; sk = j['skins'][0]; jn = sk['joints']
    names = [nodes[i].get('name') for i in jn]; byname = {n: jn[k] for k, n in enumerate(names)}
    par = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []): par[c] = i
    ibm = cp.acc(j, b, sk['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    Wbind = {n: np.linalg.inv(ibm[k]) for k, n in enumerate(names)}
    chans = {}
    for ch in j['animations'][0]['channels']:
        s = j['animations'][0]['samplers'][ch['sampler']]
        chans[(ch['target']['node'], ch['target']['path'])] = (cp.acc(j, b, s['input']), cp.acc(j, b, s['output']))

    def depth(i):
        d = 0
        while i in par: i = par[i]; d += 1
        return d
    order = sorted(range(len(nodes)), key=depth)
    dur = max(c[0][-1] for c in chans.values())
    pts = {k: np.zeros((nframes, 3)) for k in ('pelvis', 'Head', 'hand_r')}
    fwd = np.zeros((nframes, 3))     # frente do pelve (Δ·+Z) em cada frame
    for f in range(nframes):
        t = min(f / FPS, dur); W = {}
        for i in order:
            n = nodes[i]; tr = np.array(n.get('translation', [0, 0, 0]), float); ro = np.array(n.get('rotation', [0, 0, 0, 1]), float); sc = np.array(n.get('scale', [1, 1, 1]), float)
            if (i, 'translation') in chans: tt, vv = chans[(i, 'translation')]; tr = cp.sample_channel(tt, vv, t, False)
            if (i, 'rotation') in chans: tt, vv = chans[(i, 'rotation')]; ro = cp.sample_channel(tt, vv, t, True)
            M = np.eye(4); M[:3, :3] = R.from_quat(ro).as_matrix() @ np.diag(sc); M[:3, 3] = tr
            W[i] = (W[par[i]] @ M) if i in par else M
        for k in pts: pts[k][f] = W[byname[k]][:3, 3]
        Wp = W[byname['pelvis']][:3, :3]; Wb = Wbind['pelvis'][:3, :3]
        rp = R.from_matrix(Wp / np.cbrt(abs(np.linalg.det(Wp)))); rb = R.from_matrix(Wb / np.cbrt(abs(np.linalg.det(Wb))))
        fwd[f] = (rp * rb.inv()).apply([0, 0, 1.0])
    return pts, fwd, Wbind['pelvis'][1, 3]


def eye_offset():
    """Posição da câmera em relação ao osso hm, no referencial do corpo (x esquerda, y cima, z frente), deduzida do ombro fixo
    _S da 1ª pessoa: ombro(RA) - hm = (-.193,-.037,0) e o ombro está em _S no espaço da câmera -> câmera = RA - (-Sx, Sy, -Sz)."""
    bn = cp.AVB['bones']
    ra = np.array(bn['RA'][1], float); hm = np.array(bn['hm'][1], float)
    return (ra - hm) - np.array([-FP_SHOULDER[0], FP_SHOULDER[1], -FP_SHOULDER[2]])


def fp_track(cid, spec, nframes):
    """Mão de 1ª pessoa, 6 valores/frame (x,y,z,rx,ry,rz no espaço da câmera, -Z = frente).
    Posição: (hand_r - Head) x HIPY/altura do pelve no bind, no referencial do corpo girado para o heading do frame do
    acerto, menos o offset da câmera (eye_offset); corpo -> câmera (x=-x, z=-z). O heading é o azimute da mão em relação à
    cabeça no acerto (para onde o golpe cai): com o heading do pelve a mão ficava ao lado/atrás da câmera (z>0) no acerto.
    O caminho da mão no GLB é bem maior que o envelope das trilhas v de KSW (a mão sai da tela), então ele é ajustado SEM
    achatar: escala por eixo só se não couber (ganho<=1), ancorado na posição de acerto do KSW equivalente, e deslocado o
    mínimo para caber (nada de clamp por amostra, que viraria patamar).
    Orientação: o mapa antebraço-GLB -> Euler da câmera (vmPose) não casa com a guarda do KSW em nenhuma das 24 orientações de
    eixos testadas (menor desvio ~40°); sem ver o braço renderizado não há convenção segura. Por isso o HÍBRIDO previsto no
    plano: posição do GLB + orientação da trilha KSW equivalente, com o tempo deformado para o acerto do KSW coincidir com
    o do clipe."""
    pts, fwd, pelH = world_points(os.path.join(spec['_dir'], spec['file']), spec['end'] + 1)
    scale = cp.HIPY / pelH
    s, e, hit = spec['start'], spec['end'], spec['hit']
    rel = (pts['hand_r'][s:e + 1] - pts['Head'][s:e + 1]) * scale
    yaw = float(np.arctan2(rel[hit - s][0], rel[hit - s][2]))
    body = R.from_euler('y', -yaw).apply(rel) - eye_offset()
    cam = np.stack([-body[:, 0], body[:, 1], -body[:, 2]], axis=1)
    out_of = int(np.sum(np.any((cam < ENV[:, 0] - 1e-9) | (cam > ENV[:, 1] + 1e-9), axis=1)))
    kid = spec['ksw']; tr = KSW_V[kid]; kh = KSW_HIT[kid]; uh = (hit - s) / float(e - s)
    anchor = np.array(crn(tr, kh)[0:3])                      # posição da mão do KSW no instante do acerto
    pos = np.zeros_like(cam); gains = []
    for k in range(3):
        lo, hi = ENV[k]; v = cam[:, k]; hv = v[hit - s]; rng = float(v.max() - v.min())
        g = min(1.0, (hi - lo) / rng) if rng > 1e-9 else 1.0
        w = anchor[k] + (v - hv) * g
        over = w.max() - hi; under = lo - w.min()
        if over > 0: w = w - over
        elif under > 0: w = w + under
        pos[:, k] = np.clip(w, lo, hi); gains.append(float(g))
    ori = np.zeros((nframes, 3))
    for f in range(nframes):
        u = f / float(nframes - 1)
        uk = u / uh * kh if u < uh else kh + (u - uh) / (1 - uh) * (1 - kh)    # acerto do KSW alinhado ao acerto do clipe
        ori[f] = crn(tr, uk)[3:6]
    ori = (ori + np.pi) % (2 * np.pi) - np.pi                                 # wrap: Int16/8000 só guarda ±4,09
    fp = np.concatenate([pos, ori], axis=1)
    assert np.all(np.abs(fp) < FP_LIM), (cid, np.abs(fp).max())
    travel = float(np.sum(np.linalg.norm(np.diff(pts['pelvis'][s:e + 1][:, [0, 2]], axis=0), axis=1)))
    # pico de velocidade da mão relativa ao pelve (verificação do frame de acerto)
    hr = pts['hand_r'] - pts['pelvis']; sp = np.zeros(len(hr)); sp[1:-1] = np.linalg.norm(hr[2:] - hr[:-2], axis=1) * FPS / 2
    return fp, travel, dict(yaw=float(np.degrees(yaw)), out_of=out_of, peak=int(np.argmax(sp[:e + 1])), gains=gains)


def encode(q, p, fp):
    n = q.shape[0]; buf = np.zeros((n, 53), dtype='<i2')
    buf[:, :3] = np.clip(np.round(p * 10000), -32767, 32767)
    buf[:, 3:47] = np.clip(np.round(q.reshape(n, 44) * 32767), -32767, 32767)
    buf[:, 47:] = np.clip(np.round(fp * 8000), -32767, 32767)
    return base64.b64encode(buf.tobytes()).decode()


JS_HEAD = '''/* OWM — golpes de espada/faca: LMB = Sword - slash, M1 = Sword - slash B, M2 = Sword - dash slash (GLBs Quaternius UAL,
   retargetados ao rig de 11 ossos do avatar por convert_sword.py, que reaproveita o retarget de convert_punches.py).
   Mesmo formato do punch-clips.js. Frame: translação do quadril (3, SEM root motion XZ: só o Y relativo ao bind) +
   11 quaternions locais absolutos em relação ao bind do avatar (44) + mão de 1ª pessoa (6).
   Cada clipe: frames, dur=(frames-1)/30, hit (s), travel (m do GLB removidos do root motion; só metadado), source.
   Regenerar:  python3 convert_sword.py . sword-clips.js     (precisa de numpy + scipy e dos 3 GLBs na pasta)
*/
(()=>{
'use strict';
const OWM=window.OWM||(window.OWM={}),STRIDE=53;
function decode(b64){const s=atob(b64),bytes=new Uint8Array(s.length);for(let i=0;i<s.length;i++)bytes[i]=s.charCodeAt(i);const src=new Int16Array(bytes.buffer),out=new Float32Array(src.length);for(let i=0;i<src.length;i++){const k=i%STRIDE;out[i]=k<3?src[i]/10000:k<47?src[i]/32767:src[i]/8000}return out}
const clips={
'''

JS_TAIL = '''};
const qa=new THREE.Quaternion(),qb=new THREE.Quaternion();
const order=['hip','upper','hm','LA','LE','RA','RE','LL','LK','RL','RK'];
function sample(id,t,outQ,outPos,outFP){const c=clips[id];if(!c)return false;const f=Math.max(0,Math.min(c.frames-1,(+t||0)/c.dur*(c.frames-1))),i=Math.floor(f),j=Math.min(c.frames-1,i+1),u=f-i,a=i*STRIDE,b=j*STRIDE,d=c.data;if(outPos)outPos.set(d[a]+(d[b]-d[a])*u,d[a+1]+(d[b+1]-d[a+1])*u,d[a+2]+(d[b+2]-d[a+2])*u);if(outQ){
 const targetOrder=OWM.ual&&OWM.ual.ORDER;
 for(let k=0;k<outQ.length;k++){
  const sourceBone=targetOrder?order.indexOf(targetOrder[k]):k;
  if(sourceBone<0)continue;
  const x=a+3+sourceBone*4,y=b+3+sourceBone*4;
  qa.set(d[x],d[x+1],d[x+2],d[x+3]);
  qb.set(d[y],d[y+1],d[y+2],d[y+3]);
  outQ[k].copy(qa).slerp(qb,u).normalize();
 }
}if(outFP){const x=a+47,y=b+47;for(let k=0;k<6;k++)outFP[k]=d[x+k]+(d[y+k]-d[x+k])*u}return true}
OWM.swordClips={order,clips,sample};
})();
'''


def main():
    d = sys.argv[1] if len(sys.argv) > 1 else '.'
    js = sys.argv[2] if len(sys.argv) > 2 else 'sword-clips.js'
    blocks = []; report = []
    for cid, spec in CLIPS.items():
        spec = dict(spec, _dir=d)
        path = os.path.join(d, spec['file']); s, e = spec['start'], spec['end']
        qa_, pa_, gdur = cp.convert(path, e + 1)                       # retarget do convert_punches (frames 0..end)
        q = qa_[s:e + 1].copy(); p = pa_[s:e + 1].copy(); n = q.shape[0]
        p[:, 0] = 0.0; p[:, 2] = 0.0                                   # sem root motion XZ; Y relativo ao bind
        fp, travel, info = fp_track(cid, spec, n)
        hit = (spec['hit'] - s) / FPS; dur = (n - 1) / FPS
        assert 0 < hit < dur, (cid, hit, dur)
        b64 = encode(q, p, fp)
        lines = [b64[i:i + 120] for i in range(0, len(b64), 120)]
        body = '\n' + ' +\n'.join('"%s"' % l for l in lines) + '\n'
        blocks.append('%s:{dur:%.8g,frames:%d,hit:%.8g,travel:%.2f,source:"%s",data:decode(%s)},\n' % (cid, dur, n, hit, travel, spec['file'], body))
        report.append((cid, n, dur, hit, travel, info, float(p[:, 1].min()), float(p[:, 1].max())))
    open(js, 'w', encoding='utf-8').write(JS_HEAD + ''.join(blocks) + JS_TAIL)
    for cid, n, dur, hit, travel, info, ymin, ymax in report:
        print('%-3s frames %2d dur %.4f hit %.4f travel %.2f m | hipY [%.3f, %.3f] | heading %.1f° | FP fora do envelope (antes do ajuste): %d/%d, ganhos xyz %s | pico da mão: frame %d' % (cid, n, dur, hit, travel, ymin, ymax, info['yaw'], info['out_of'], n, [round(g, 2) for g in info['gains']], info['peak']))
    print('gravado', js, os.path.getsize(js), 'bytes')


if __name__ == '__main__':
    main()
