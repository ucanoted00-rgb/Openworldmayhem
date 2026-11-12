#!/usr/bin/env python3
"""OWM — retarget dos golpes (GLBs Quaternius UAL, 66 juntas) para o rig de 11 ossos do avatar.

Uso:  python3 convert_punches.py <pasta com os 3 GLBs> [punch-clips.js]
Reescreve os blocos m1/m2/lmb de punch-clips.js (dur/frames/hit/source são mantidos; a mão de 1ª pessoa é preservada).

Método (retarget em espaço de mundo, independente dos eixos locais de cada rig):
  Δ(f)  = R_pose_mundo(f) · R_bind_mundo⁻¹        rotação de mundo da junta UAL em relação ao bind (inverseBindMatrices)
  S     = menor rotação que leva a direção de repouso do osso do avatar (A-pose) à direção de bind da junta UAL (T-pose)
  R_av  = Δ(f) · S                                orientação de mundo do osso do avatar → mesma direção absoluta do GLB
  local = R_pai_av⁻¹ · R_av                       o que vai em bone.quaternion (identidade = bind do avatar)
Os quaternions são ABSOLUTOS em relação ao bind do avatar (frame 0 = postura de guarda, não identidade).
Posição do quadril: deslocamento do pelve relativo ao bind (inclui o agachado da guarda e o passo do M2), escalado pela altura do quadril do avatar.
"""
import sys,os,re,base64,json,struct
import numpy as np
from scipy.spatial.transform import Rotation as R

# ---- leitor mínimo de GLB ----
def load(path):
    b=open(path,'rb').read()
    l=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+l])
    off=20+l; bl=struct.unpack('<I',b[off:off+4])[0]; bin_=b[off+8:off+8+bl]
    return j,bin_
CT={5126:'<f4',5123:'<u2',5125:'<u4',5121:'u1',5122:'<i2',5120:'i1'}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def acc(j,bin_,i):
    a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]
    n=NC[a['type']]; dt=np.dtype(CT[a['componentType']])
    o=bv.get('byteOffset',0)+a.get('byteOffset',0)
    arr=np.frombuffer(bin_,dtype=dt,count=a['count']*n,offset=o).astype(float)
    return arr.reshape(a['count'],n) if n>1 else arr
def local_mat(n):
    M=np.eye(4)
    if 'matrix' in n: return np.array(n['matrix']).reshape(4,4).T
    S=np.diag(list(n.get('scale',[1,1,1]))+[1])
    Rm=np.eye(4); Rm[:3,:3]=R.from_quat(n.get('rotation',[0,0,0,1])).as_matrix()
    T=np.eye(4); T[:3,3]=n.get('translation',[0,0,0])
    return T@Rm@S


ORDER=['hip','upper','hm','LA','LE','RA','RE','LL','LK','RL','RK']
PARENT={'hip':None,'upper':'hip','hm':'upper','LA':'upper','LE':'LA','RA':'upper','RE':'RA','LL':'hip','LK':'LL','RL':'hip','RK':'RL'}
# osso do avatar -> (junta UAL que dá a orientação, junta filha p/ direção de bind | None = sem swing de bind)
MAP={'hip':('pelvis',None),'upper':('spine_03',None),'hm':('Head',None),
     'LA':('upperarm_l','lowerarm_l'),'LE':('lowerarm_l','hand_l'),'RA':('upperarm_r','lowerarm_r'),'RE':('lowerarm_r','hand_r'),
     'LL':('thigh_l','calf_l'),'LK':('calf_l','foot_l'),'RL':('thigh_r','calf_r'),'RK':('calf_r','foot_r')}
# direção de repouso (A-pose) de cada osso do avatar
AVB={'bones':{"hip": [None, [0, 0.8451807228915663, 0]], "upper": ["hip", [0, 0, 0]], "hm": ["upper", [0, 0.6246987951807229, 0]], "LA": ["upper", [0.19292168674698795, 0.5879518072289157, 0]], "LE": ["LA", [0.14698795180722893, -0.3582831325301206, 0]], "LL": ["hip", [0.11024096385542168, -0.01837349397590363, 0]], "LK": ["LL", [0.02756024096385542, -0.3674698795180723, 0]], "RA": ["upper", [-0.19292168674698795, 0.5879518072289157, 0]], "RE": ["RA", [-0.14698795180722893, -0.3582831325301206, 0]], "RL": ["hip", [-0.11024096385542168, -0.01837349397590363, 0]], "RK": ["RL", [-0.02756024096385542, -0.3674698795180723, 0]]},'hipY':0.8451807228915663}   # esqueleto do avatar (lowpoly.js / avatar.js): pai e posição local de cada osso
def avdir(b):
    v=lambda n:np.array(AVB['bones'][n][1],float)
    d={'LA':v('LE'),'RA':v('RE'),'LL':v('LK'),'RL':v('RK')}
    if b in d:return d[b]/np.linalg.norm(d[b])
    if b=='LE':return avdir('LA')   # antebraço continua a direção do braço
    if b=='RE':return avdir('RA')
    if b=='LK':return avdir('LL')
    if b=='RK':return avdir('RL')
    return None
HIPY=AVB['hipY']
FPS=30.0

def swing(a,b):
    a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);c=np.cross(a,b);s=np.linalg.norm(c);d=float(np.dot(a,b))
    if s<1e-9:return R.identity() if d>0 else R.from_rotvec(np.pi*np.array([0,0,1.0]))
    return R.from_rotvec(c/s*np.arctan2(s,d))

def sample_channel(times,vals,t,quat):
    if t<=times[0]:return vals[0]
    if t>=times[-1]:return vals[-1]
    i=int(np.searchsorted(times,t,side='right')-1);u=(t-times[i])/(times[i+1]-times[i])
    if quat:
        a=vals[i];b=vals[i+1]
        if np.dot(a,b)<0:b=-b
        q=a*(1-u)+b*u;return q/np.linalg.norm(q)   # nlerp (30 fps, passos curtos)
    return vals[i]*(1-u)+vals[i+1]*u

def convert(path,nframes):
    j,b=load(path);nodes=j['nodes'];sk=j['skins'][0];jn=sk['joints']
    names=[nodes[i].get('name') for i in jn];jidx={n:i for i,n in enumerate(jn)};byname={n:jn[k] for k,n in enumerate(names)}
    par={}
    for i,n in enumerate(nodes):
        for c in n.get('children',[]):par[c]=i
    ibm=acc(j,b,sk['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    Wbind={n:np.linalg.inv(ibm[k]) for k,n in enumerate(names)}
    chans={}
    for ch in j['animations'][0]['channels']:
        s=j['animations'][0]['samplers'][ch['sampler']]
        chans[(ch['target']['node'],ch['target']['path'])]=(acc(j,b,s['input']),acc(j,b,s['output']))
    order=[]  # nós em ordem pai→filho
    def depth(i):
        d=0
        while i in par:i=par[i];d+=1
        return d
    allnodes=sorted(range(len(nodes)),key=depth)
    dur=max(c[0][-1] for c in chans.values())
    out_q=np.zeros((nframes,len(ORDER),4));out_p=np.zeros((nframes,3))
    pel0=None
    for f in range(nframes):
        t=min(f/FPS,dur);W={}
        for i in allnodes:
            n=nodes[i];tr=np.array(n.get('translation',[0,0,0]),float);ro=np.array(n.get('rotation',[0,0,0,1]),float);sc=np.array(n.get('scale',[1,1,1]),float)
            if (i,'translation') in chans:tt,vv=chans[(i,'translation')];tr=sample_channel(tt,vv,t,False)
            if (i,'rotation') in chans:tt,vv=chans[(i,'rotation')];ro=sample_channel(tt,vv,t,True)
            M=np.eye(4);M[:3,:3]=R.from_quat(ro).as_matrix()@np.diag(sc);M[:3,3]=tr
            W[i]=(W[par[i]]@M) if i in par else M
        Rw={}
        for bn in ORDER:
            u,ch=MAP[bn];ui=byname[u]
            Rpose=R.from_matrix(W[ui][:3,:3]/np.cbrt(abs(np.linalg.det(W[ui][:3,:3]))));Rb=R.from_matrix(Wbind[u][:3,:3]/np.cbrt(abs(np.linalg.det(Wbind[u][:3,:3]))))
            delta=Rpose*Rb.inv()
            S=R.identity()
            if ch:
                ubind=Wbind[ch][:3,3]-Wbind[u][:3,3];S=swing(avdir(bn),ubind)
            Rw[bn]=delta*S
        for k,bn in enumerate(ORDER):
            p=PARENT[bn];loc=(Rw[p].inv()*Rw[bn]) if p else Rw[bn]
            q=loc.as_quat()
            if q[3]<0:q=-q
            out_q[f,k]=q
        pel=W[byname['pelvis']][:3,3].copy()
        out_p[f]=(pel-Wbind['pelvis'][:3,3])*(HIPY/Wbind['pelvis'][1,3])   # relativo ao bind: preserva o agachado da guarda
    return out_q,out_p,dur

def encode(q,p,fp_old):
    n=q.shape[0];buf=np.zeros((n,53),dtype='<i2')
    buf[:,:3]=np.clip(np.round(p*10000),-32767,32767)
    buf[:,3:47]=np.clip(np.round(q.reshape(n,44)*32767),-32767,32767)
    buf[:,47:]=fp_old
    return base64.b64encode(buf.tobytes()).decode()

def main():
    d=sys.argv[1];js=sys.argv[2] if len(sys.argv)>2 else 'punch-clips.js'
    src=open(js,encoding='utf-8').read()
    files={'m1':'Punch_-_jab_left_2.glb','m2':'Punch_-_hook_right_2.glb','lmb':'Punch_-_cross_right_2.glb'}
    for cid,fn in files.items():
        m=re.search(cid+r':\{dur:([\d.]+),frames:(\d+),hit:([\d.]+),source:"[^"]*",data:decode\((.*?)\)\},',src,re.S)
        dur,frames,hit,body=m.group(1),int(m.group(2)),m.group(3),m.group(4)
        old=np.frombuffer(base64.b64decode(''.join(re.findall(r'"([^"]*)"',body))),dtype='<i2').reshape(frames,53)
        q,p,gdur=convert(os.path.join(d,fn),frames)
        assert abs(gdur-float(dur))<0.01,(cid,gdur,dur)
        b64=encode(q,p,old[:,47:])
        lines=[b64[i:i+120] for i in range(0,len(b64),120)]
        newbody='\n'+' +\n'.join('"%s"'%l for l in lines)+'\n'
        new=f'{cid}:{{dur:{dur},frames:{frames},hit:{hit},source:"{fn}",data:decode({newbody})}},'
        src=src[:m.start()]+new+src[m.end():]
        print(cid,'frames',frames,'ok')
    open(js,'w',encoding='utf-8').write(src)
if __name__=='__main__':main()
