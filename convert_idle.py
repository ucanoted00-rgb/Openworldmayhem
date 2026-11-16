#!/usr/bin/env python3
"""OWM — troca o clipe 'idle' de OWM.ual (avatar.js) por um GLB Quaternius UAL (ex.: Idle_-_relaxed.glb).

Uso:  python3 convert_idle.py Idle_-_relaxed.glb [avatar.js]

Reaproveita o retarget de convert_punches.py (11 ossos, quaternions relativos ao bind do avatar) e converte para o formato
do ualanim.js: Int16 por frame = [hip x,y,z em mm] + 10 quaternions brutos (sem 'hm'); o jogo faz  q_final = UAREF·q,
com UAREF = inverso do frame 0 do idle ANTIGO. Para walk/jog/sprint/pulo continuarem idênticos, o frame 0 do idle antigo
é lido do avatar.js antes de ser sobrescrito e gravado em OWM.ual.ref — UAREF/UAROOT não mudam. Só o clipe 'idle' é substituído.
"""
import sys, re, base64
import numpy as np
from scipy.spatial.transform import Rotation as R
import convert_punches as cp

glb = sys.argv[1]; js = sys.argv[2] if len(sys.argv) > 2 else 'avatar.js'
src = open(js, encoding='utf-8').read()
S = 3 + 10 * 4
m = re.search(r'"idle":\{"dur":([\d.]+),"n":(\d+),"loop":true,"dist":0\.0,"d":"([^"]*)"\}', src)
dur, n, b64 = float(m.group(1)), int(m.group(2)), m.group(3)
old = np.frombuffer(base64.b64decode(b64), dtype='<i2').reshape(n, S)
F0q = old[0, 3:].reshape(10, 4) / 32767.0       # referência do idle antigo (UAREF = inverso disto)
F0p = old[0, :3].astype(int)                     # UAROOT (mm)

j, b = cp.load(glb)
gdur = float(max(cp.acc(j, b, s['input'])[-1] for s in j['animations'][0]['samplers']))
nf = int(round(gdur * cp.FPS))                   # loop: o último instante == frame 0, não entra
q, p, _ = cp.convert(glb, nf)
keep = [k for k, bn in enumerate(cp.ORDER) if bn != 'hm']   # o rig UAL do jogo não tem 'hm'
q = q[:, keep]
out = np.zeros((nf, S), dtype='<i2')
for f in range(nf):
    for k in range(10):
        qq = q[f, k].copy()                                # bruto (Δ·S), como os demais clipes do ualanim.js
        if qq[3] < 0: qq = -qq
        out[f, 3 + k * 4:3 + k * 4 + 4] = np.clip(np.round(qq * 32767), -32767, 32767)
    out[f, :3] = np.clip(np.round(F0p + p[f] * 1000), -32767, 32767)
new_b64 = base64.b64encode(out.tobytes()).decode()
new = '"idle":{"dur":%s,"n":%d,"loop":true,"dist":0.0,"d":"%s"}' % ('%.8g' % (nf / cp.FPS), nf, new_b64)
src = src[:m.start()] + new + src[m.end():]
# guarda a referência antiga (UAREF/UAROOT) em OWM.ual.ref, usada por avatar.js no lugar de clips.idle
ref = base64.b64encode(old[0].tobytes()).decode()
if 'OWM.ual={clips,ORDER,STRIDE' in src and 'refB64' not in src:
    src = src.replace('OWM.ual={clips,ORDER,STRIDE};', 'const refB64="%s",refS=atob(refB64),refU=new Uint8Array(refS.length);for(let i=0;i<refS.length;i++)refU[i]=refS.charCodeAt(i);\nconst refI=new Int16Array(refU.buffer),ref=new Float32Array(refI.length);for(let i=0;i<refI.length;i++)ref[i]=(i<3)?refI[i]/1000:refI[i]/32767;\nOWM.ual={clips,ORDER,STRIDE,ref};' % ref, 1)
    src = src.replace('const F=UA.clips.idle.f,o=3+i*4;', 'const F=UA.ref,o=3+i*4;', 1)
    src = src.replace('Array.from(UA.clips.idle.f.slice(0,3))', 'Array.from(UA.ref.slice(0,3))', 1)
open(js, 'w', encoding='utf-8').write(src)
print('idle: %d frames, %.4f s' % (nf, nf / cp.FPS))
