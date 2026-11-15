#!/usr/bin/env python3
"""OWM — conversor dos golpes de espada para o rig UAL de 11 ossos.
Uso: python3 convert_sword.py <pasta com GLBs> [sword-clips.js]
Importa o retarget world-space de convert_punches.py sem o alterar.
"""
import os, sys, base64, json, math
import numpy as np
from scipy.spatial.transform import Rotation as R
import convert_punches as cp

FPS = cp.FPS
ORDER = cp.ORDER
HIPY = cp.HIPY
STRIDE = 53
SWORD = {
    'lmb': {'file':'Sword_-_slash.glb', 'frames':23, 'hit_frame':11, 'speed':1.50, 'fallback':0},
    'm1':  {'file':'Sword_-_slash_B.glb', 'frames':17, 'hit_frame':7,  'speed':1.25, 'fallback':5},
    'm2':  {'file':'Sword_-_dash_slash.glb','frames':21,'hit_frame':9, 'speed':1.20, 'fallback':7},
}
FP_BOUNDS = ((-.12,.34),(-.34,0.0),(-.72,-.20))
# Ângulos [tempo, rx, ry, rz] das trilhas FP equivalentes em KSW[0], KSW[5] e KSW[7].
# Usados como orientação híbrida somente quando a posição calculada do GLB sai do envelope.
FP_FALLBACK = {
 0:[[0,0,0,0],[.2,.15,0,-.55],[.42,-.55,0,.5],[.6,-.8,0,1],[1,0,0,0]],
 5:[[0,0,0,0],[.22,.2,0,.8],[.42,-.6,0,-.45],[.6,-.8,0,-.7],[1,0,0,0]],
 7:[[0,0,0,0],[.28,.5,0,.5],[.5,-.4,0,-.25],[.68,-.4,0,-.2],[1,0,0,0]],
}

def world_frames(path, nframes):
    """Matrizes de mundo para Head/mão/quadril; o retarget corporal é cp.convert()."""
    j, blob = cp.load(path)
    nodes = j['nodes']; skin = j['skins'][0]
    joints = skin['joints']
    names = [nodes[i].get('name') for i in joints]
    byname = {name:joints[k] for k,name in enumerate(names)}
    parents = {}
    for i,node in enumerate(nodes):
        for child in node.get('children',[]): parents[child] = i
    channels = {}
    for channel in j['animations'][0]['channels']:
        sampler = j['animations'][0]['samplers'][channel['sampler']]
        channels[(channel['target']['node'],channel['target']['path'])] = (
            cp.acc(j,blob,sampler['input']), cp.acc(j,blob,sampler['output']))
    def depth(i):
        d=0
        while i in parents: i=parents[i]; d+=1
        return d
    allnodes = sorted(range(len(nodes)), key=depth)
    wanted = {byname[n] for n in ('root','pelvis','Head','lowerarm_r','hand_r')}
    needed=set(wanted)
    for idx in list(wanted):
        p=idx
        while p in parents: p=parents[p]; needed.add(p)
    out=[]
    for f in range(nframes):
        t=f/FPS; W={}
        for i in allnodes:
            if i not in needed: continue
            node=nodes[i]
            tr=np.array(node.get('translation',[0,0,0]),float)
            ro=np.array(node.get('rotation',[0,0,0,1]),float)
            sc=np.array(node.get('scale',[1,1,1]),float)
            if (i,'translation') in channels:
                tt,vv=channels[(i,'translation')]; tr=cp.sample_channel(tt,vv,t,False)
            if (i,'rotation') in channels:
                tt,vv=channels[(i,'rotation')]; ro=cp.sample_channel(tt,vv,t,True)
            if 'matrix' in node:
                M=np.asarray(node['matrix'],float).reshape(4,4).T
            else:
                M=np.eye(4); M[:3,:3]=R.from_quat(ro).as_matrix() @ np.diag(sc); M[:3,3]=tr
            W[i]=(W[parents[i]] @ M) if i in parents else M
        out.append({name:W[byname[name]] for name in ('root','pelvis','Head','lowerarm_r','hand_r')})
    ibm=cp.acc(j,blob,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    bind={name:np.linalg.inv(ibm[k]) for k,name in enumerate(names)}
    pelvis_h=float(bind['pelvis'][1,3])
    if abs(pelvis_h)<1e-6: raise ValueError('altura do pelvis no bind inválida')
    return out, pelvis_h

def yaw_quat(mat):
    # Heading pelo root não animado; o pelvis pode girar muito durante os golpes.
    fwd=mat[:3,:3] @ np.array([0.,1.,0.])
    return R.from_euler('y',math.atan2(-fwd[0],-fwd[2]))

def wrap(a):
    return (a+math.pi)%(2*math.pi)-math.pi

def fallback_orientation(idx, u):
    track=FP_FALLBACK[idx]
    if u<=track[0][0]: return np.asarray(track[0][1:4],float)
    if u>=track[-1][0]: return np.asarray(track[-1][1:4],float)
    i=0
    while i<len(track)-2 and u>track[i+1][0]: i+=1
    a,b=track[i],track[i+1]; p=track[i-1] if i>0 else None; q=track[i+2] if i+2<len(track) else None
    h=b[0]-a[0]; t=(u-a[0])/h; t2=t*t; t3=t2*t
    h00=2*t3-3*t2+1; h10=t3-2*t2+t; h01=-2*t3+3*t2; h11=t3-t2
    out=[]
    for k in range(1,4):
        m0=(b[k]-p[k])/(b[0]-p[0]) if p else (b[k]-a[k])/h
        m1=(q[k]-a[k])/(q[0]-a[0]) if q else (b[k]-a[k])/h
        out.append(h00*a[k]+h10*h*m0+h01*b[k]+h11*h*m1)
    return np.asarray(out)

def fp_track(path, nframes, hit_frame, fallback_idx):
    worlds, bind_y=world_frames(path,nframes)
    scale=HIPY/bind_y
    # A referência de heading usa o frame de acerto e o root, nunca o pelvis animado.
    inv_heading=yaw_quat(worlds[min(hit_frame,nframes-1)]['root']).inv()
    out=np.zeros((nframes,6),dtype=float); fallback_frames=[]
    for f,w in enumerate(worlds):
        rel=inv_heading.apply(w['hand_r'][:3,3]-w['Head'][:3,3])*scale
        pos=rel.copy()
        hand_m=w['hand_r'][:3,:3]
        q_hand=R.from_matrix(hand_m/np.cbrt(abs(np.linalg.det(hand_m))))
        q_rel=inv_heading*q_hand
        eul=np.asarray([wrap(v) for v in q_rel.as_euler('XYZ')])
        outside=any(pos[k]<lo-1e-6 or pos[k]>hi+1e-6 for k,(lo,hi) in enumerate(FP_BOUNDS))
        if outside:
            # Híbrido: posição GLB mantida, orientação KSW equivalente.
            eul=fallback_orientation(fallback_idx,f/(nframes-1))
            fallback_frames.append(f)
        pos=np.asarray([np.clip(pos[k],*FP_BOUNDS[k]) for k in range(3)])
        out[f,:3]=pos; out[f,3:]=[wrap(v) for v in eul]
    return out, fallback_frames

def encode(q,p,fp):
    n=q.shape[0]; buf=np.zeros((n,STRIDE),dtype='<i2')
    buf[:,:3]=np.clip(np.round(p*10000),-32767,32767).astype('<i2')
    qq=q.copy()
    for f in range(n):
        for b in range(11):
            v=qq[f,b]; norm=np.linalg.norm(v)
            if not np.isfinite(norm) or norm<1e-8: raise ValueError('quaternion inválido')
            v/=norm
            if v[3]<0: v*=-1
    buf[:,3:47]=np.clip(np.round(qq.reshape(n,44)*32767),-32767,32767).astype('<i2')
    fpw=fp.copy()
    for f in range(n):
        for k in range(3,6): fpw[f,k]=wrap(fpw[f,k])
    buf[:,47:]=np.clip(np.round(fpw*8000),-32767,32767).astype('<i2')
    return base64.b64encode(buf.tobytes()).decode('ascii')

def main():
    folder=sys.argv[1] if len(sys.argv)>1 else '.'
    output=sys.argv[2] if len(sys.argv)>2 else 'sword-clips.js'
    clips=[]
    for cid,cfg in SWORD.items():
        path=os.path.join(folder,cfg['file'])
        if not os.path.isfile(path): raise FileNotFoundError(path)
        q,p,source_dur=cp.convert(path,cfg['frames'])
        if not np.isfinite(q).all() or not np.isfinite(p).all(): raise ValueError(cid+': NaN no retarget')
        world,_=world_frames(path,cfg['frames'])
        pelvis_xz=np.asarray([w['pelvis'][:3,3][[0,2]] for w in world])
        travel=float(np.linalg.norm(pelvis_xz[-1]-pelvis_xz[0]))
        p[:,0]=0.0; p[:,2]=0.0
        if np.max(np.abs(p[:,1]))>.5+1e-8: raise ValueError(cid+': pelvis Y fora de ±0,5 m')
        fp,fallback=fp_track(path,cfg['frames'],cfg['hit_frame'],cfg['fallback'])
        q=np.asarray(q,dtype=float)
        for f in range(len(q)):
            for b in range(len(ORDER)):
                n=np.linalg.norm(q[f,b])
                if n<1e-8 or not np.isfinite(n): raise ValueError(cid+': quaternion inválido')
                q[f,b]/=n
                if f and np.dot(q[f-1,b],q[f,b])<0:q[f,b]*=-1
                if q[f,b,3]<0:q[f,b]*=-1
        b64=encode(q,p,fp)
        dur=(cfg['frames']-1)/FPS; hit=cfg['hit_frame']/FPS
        clip={'dur':round(dur,8),'frames':cfg['frames'],'hit':round(hit,8),
              'speed':cfg['speed'],'travel':round(travel,5),'source':cfg['file'],
              'fallbackFrames':fallback,'data':b64}
        clips.append((cid,clip))
        print(f"{cid}: frames={cfg['frames']} dur={dur:.6f}s hit={hit:.6f}s travel={travel:.4f}m fp-hybrid={fallback}")
    header='''/* OWM — Sword GLB clips retargeted offline to the 11-bone avatar rig.
   Regenerate: python3 convert_sword.py . sword-clips.js
   Requires the 3 source GLBs beside the script and unchanged convert_punches.py.
   Frame: pelvis translation (3), 11 absolute bind-space local quaternions (44), FP hand pose (6).
*/
(()=>{
'use strict';
const OWM=window.OWM||(window.OWM={}),STRIDE=53;
function decode(b64){const s=atob(b64),bytes=new Uint8Array(s.length);for(let i=0;i<s.length;i++)bytes[i]=s.charCodeAt(i);const src=new Int16Array(bytes.buffer),out=new Float32Array(src.length);for(let i=0;i<src.length;i++){const k=i%STRIDE;out[i]=src[i]/(k<3?10000:k<47?32767:8000)}return out}
const clips={
'''
    rows=[]
    for cid,c in clips:
        meta={k:v for k,v in c.items() if k!='data'}
        chunks=[c['data'][i:i+120] for i in range(0,len(c['data']),120)]
        body=' +\n'.join(json.dumps(x) for x in chunks)
        rows.append(f"{cid}:{{{','.join(json.dumps(k)+':'+json.dumps(v,ensure_ascii=False,separators=(',',':')) for k,v in meta.items())},data:decode(\n{body}\n)}},")
    footer=''' 
};
const qa=new THREE.Quaternion(),qb=new THREE.Quaternion();
const order=['hip','upper','hm','LA','LE','RA','RE','LL','LK','RL','RK'];
function sample(id,t,outQ,outPos,outFP){
 const c=clips[id];if(!c)return false;
 const f=Math.max(0,Math.min(c.frames-1,(+t||0)*30)),i=Math.floor(f),j=Math.min(c.frames-1,i+1),u=f-i,a=i*STRIDE,b=j*STRIDE,d=c.data;
 if(outPos)outPos.set(d[a]+(d[b]-d[a])*u,d[a+1]+(d[b+1]-d[a+1])*u,d[a+2]+(d[b+2]-d[a+2])*u);
 if(outQ){
  const targetOrder=OWM.ual&&OWM.ual.ORDER;
  for(let k=0;k<outQ.length;k++){
   const sourceBone=targetOrder?order.indexOf(targetOrder[k]):k;if(sourceBone<0)continue;
   const x=a+3+sourceBone*4,y=b+3+sourceBone*4;
   qa.set(d[x],d[x+1],d[x+2],d[x+3]).normalize();
   qb.set(d[y],d[y+1],d[y+2],d[y+3]).normalize();
   outQ[k].copy(qa).slerp(qb,u).normalize();
  }
 }
 if(outFP){const x=a+47,y=b+47;for(let k=0;k<6;k++)outFP[k]=d[x+k]+(d[y+k]-d[x+k])*u}
 return true;
}
OWM.swordClips={order,clips,sample};
})();
'''
    with open(output,'w',encoding='utf-8') as f: f.write(header+'\n'.join(rows)+footer)
    print('written',output,os.path.getsize(output),'bytes')

if __name__=='__main__':
    main()
