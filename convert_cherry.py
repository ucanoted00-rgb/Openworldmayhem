#!/usr/bin/env python3
"""Converte 'Cherry Blossom Trees' (Jagobo, CC-BY-4.0) em cherry.js para o Open World Mayhem.
Uso: python3 convert_cherry.py <pasta com scene.gltf> <saida cherry.js>
- 3 árvores; casca decimada por clustering (pos+uv), folhagem = cartões 6x6 originais (16 tris) -> 4 tris dobrados, LOD por fração.
- Texturas originais (cor) redimensionadas e em WebP. Posições int16 em cm, base y=0, tronco x=z=0."""
import sys,json,base64,io
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt
src=sys.argv[1] if len(sys.argv)>1 else '/home/claude/trees'; out=sys.argv[2] if len(sys.argv)>2 else 'cherry.js'
g=json.load(open(src+'/scene.gltf')); buf=open(src+'/scene.bin','rb').read()
def acc(i):
    a=g['accessors'][i]; bv=g['bufferViews'][a['bufferView']]
    ct={5126:('f',4),5125:('I',4)}[a['componentType']]; nc={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    off=bv.get('byteOffset',0)+a.get('byteOffset',0); st=bv.get('byteStride',ct[1]*nc)
    o=np.zeros((a['count'],nc))
    for k in range(nc): o[:,k]=np.ndarray((a['count'],),dtype=np.dtype('<'+ct[0]),buffer=buf,offset=off+k*ct[1],strides=(st,))
    return o
def mat(n): return np.array(n['matrix']).reshape(4,4).T if 'matrix' in n else np.eye(4)
par={}
for i,n in enumerate(g['nodes']):
    for c in n.get('children',[]): par[c]=i
def world(i):
    m=mat(g['nodes'][i])
    while i in par: i=par[i]; m=mat(g['nodes'][i])@m
    return m
def md(node):
    p=g['meshes'][g['nodes'][node]['mesh']]['primitives'][0]; a=p['attributes']
    P=acc(a['POSITION']);N=acc(a['NORMAL']);UV=acc(a['TEXCOORD_0']);I=acc(p['indices'])[:,0].astype(np.int64)
    W=world(node);P=(W[:3,:3]@P.T).T+W[:3,3];N=(W[:3,:3]@N.T).T;N/=np.linalg.norm(N,axis=1,keepdims=True)+1e-12
    return P,N,UV,I
K=.1   # unidades do modelo -> metros
TREES=[(4,[6]),(8,[10,11]),(13,[15])]
rng=np.random.default_rng(7)
import heapq
def qem(P,I,target):
    """Decimação por colapso de arestas (quádricas) numa malha soldada por posição."""
    _,first,inv=np.unique(np.round(P,3),axis=0,return_index=True,return_inverse=True); inv=inv.reshape(-1)
    V=P[first].copy(); F=inv[I].reshape(-1,3); ok=(F[:,0]!=F[:,1])&(F[:,1]!=F[:,2])&(F[:,0]!=F[:,2]); F=F[ok]
    nv=len(V); Q=np.zeros((nv,4,4))
    def plane(f):
        a,b,c=V[f[0]],V[f[1]],V[f[2]]; n=np.cross(b-a,c-a); ar=np.linalg.norm(n)
        if ar<1e-12: return None,0
        n/=ar; return np.array([*n,-n@a]),ar/2
    faces=[list(f) for f in F]; alive=[True]*len(faces); vf=[set() for _ in range(nv)]
    for i,f in enumerate(faces):
        for v in f: vf[v].add(i)
        p,ar=plane(f)
        if p is not None:
            m=ar*np.outer(p,p)
            for v in f: Q[v]+=m
    ver=[0]*nv; dead=[False]*nv; nf=len(faces)
    def cost(a,b):
        M=Q[a]+Q[b]; best=None
        for p in (V[a],V[b],(V[a]+V[b])/2):
            h=np.append(p,1.); c=h@M@h
            if best is None or c<best[0]: best=(c,p)
        return best
    heap=[]; seen=set()
    def push(a,b):
        if a>b: a,b=b,a
        c,p=cost(a,b); heapq.heappush(heap,(c,a,b,ver[a],ver[b],p))
    for f in faces:
        for k in range(3):
            a,b=f[k],f[(k+1)%3]
            e=(min(a,b),max(a,b))
            if e not in seen: seen.add(e); push(*e)
    while nf>target and heap:
        c,a,b,va,vb,p=heapq.heappop(heap)
        if dead[a] or dead[b] or va!=ver[a] or vb!=ver[b]: continue
        # rejeita se inverter faces vizinhas
        bad=False; shared=vf[a]&vf[b]
        for i in (vf[a]|vf[b])-shared:
            f=faces[i]; g=[a if v==b else v for v in f] if b in f else f
            old=[V[v] for v in f]; new=[p if v in (a,b) else V[v] for v in f]
            n0=np.cross(old[1]-old[0],old[2]-old[0]); n1=np.cross(new[1]-new[0],new[2]-new[0])
            l0=np.linalg.norm(n0);l1=np.linalg.norm(n1)
            if l1<1e-10 or (l0>0 and n0@n1/(l0*l1)<.3): bad=True;break
        if bad: continue
        V[a]=p; Q[a]=Q[a]+Q[b]; dead[b]=True; ver[a]+=1
        for i in list(vf[b]):
            f=faces[i]; faces[i]=[a if v==b else v for v in f]; vf[a].add(i)
        for i in list(vf[a]):
            f=faces[i]
            if len(set(f))<3:
                if alive[i]: alive[i]=False; nf-=1
                for v in f: vf[v].discard(i)
        vf[b]=set()
        nb=set()
        for i in vf[a]:
            for v in faces[i]:
                if v!=a: nb.add(v)
        for v in nb: push(a,v)
    keep=[faces[i] for i in range(len(faces)) if alive[i]]
    return V,np.array(keep)
# escala UV original (unidades de UV por metro) pra manter a densidade de textura da casca
def uvscale(P,UV,I):
    t=I.reshape(-1,3); a=t[:,0];b=t[:,1]
    dp=np.linalg.norm(P[a]-P[b],axis=1);du=np.linalg.norm(UV[a]-UV[b],axis=1); m=(dp>1e-4)&(du>1e-6)&(du<.3)
    return float(np.median(du[m]/dp[m]))
def bark_mesh(V,F,us):
    nv=len(V); N=np.zeros((nv,3))
    for f in F:
        n=np.cross(V[f[1]]-V[f[0]],V[f[2]]-V[f[0]])
        for v in f: N[v]+=n
    N/=np.linalg.norm(N,axis=1,keepdims=True)+1e-12
    P=[];NN=[];UV=[];I=[]
    for f in F:   # UV planar por triângulo (eixo dominante da normal da face) -> textura da casca sem emendas visíveis
        fn=np.cross(V[f[1]]-V[f[0]],V[f[2]]-V[f[0]]); ax=np.argmax(np.abs(fn))
        for v in f:
            p=V[v]; uv=(p[0]+p[2],p[1]) if ax==0 else (p[0],p[1]) if ax==2 else (p[0],p[2]+p[1]*.3)
            if ax==0: uv=(p[2],p[1])
            I.append(len(P));P.append(p);NN.append(N[v]);UV.append((uv[0]*us,uv[1]*us))
    return np.array(P),np.array(NN),np.array(UV),np.array(I)
def q16(a,s): return np.clip(np.round(a*s),-32767,32767).astype('<i2')
def b64(a): return base64.b64encode(a.tobytes()).decode()
def pack_mesh(P,N,UV,I,us=2048):
    return {'pos':b64(q16(P,100)),'nor':b64(np.clip(np.round(N*127),-127,127).astype('i1')),'uv':b64(q16(UV,us)),'idx':b64(I.astype('<u2'))}
def cards(foliage):
    """lista de cartões: 6 vértices (u 0,.5,1 x v 0,1) + uv"""
    out=[]
    for node in foliage:
        P,N,UV,I=md(node); tri=I.reshape(-1,3)
        for c in range(len(tri)//16):
            t=tri[c*16:(c+1)*16].reshape(-1); d={}
            for v in t: d[(round(UV[v,0],2),round(UV[v,1],2))]=P[v]
            ks=[(0,0),(.5,0),(1,0),(0,1),(.5,1),(1,1)]
            if all(k in d for k in ks): out.append(np.array([d[k] for k in ks]))
    return np.array(out)
UVc=np.array([(0,0),(.5,0),(1,0),(0,1),(.5,1),(1,1)],float)
TRI=np.array([[0,1,3],[1,4,3],[1,2,4],[2,5,4]])
def leaf_mesh(C,crown,sc):
    P=[];N=[];UV=[];I=[]
    for c in C:
        ctr=c.mean(0); c=ctr+(c-ctr)*sc
        out=(ctr-crown); out/=np.linalg.norm(out)+1e-9
        nrm=out*.75+np.array([0,.45,0]); nrm/=np.linalg.norm(nrm)
        base=len(P)
        # flip winding so the geometric normal faces outward
        gn=np.cross(c[2]-c[0],c[3]-c[0]); tri=TRI if np.dot(gn,out)>=0 else TRI[:,::-1]
        for k in range(6): P.append(c[k]);N.append(nrm);UV.append(UVc[k])
        for t in tri: I.extend(base+t)
    return np.array(P),np.array(N),np.array(UV),np.array(I)
def prep(bn,fn):
    P,N,UV,I=md(bn)
    base=P[:,1]<1.5; cx,cz=P[base][:,0].mean(),P[base][:,2].mean(); y0=P[:,1].min()
    off=np.array([cx,y0,cz])
    P=(P-off)*K
    C=(cards(fn)-off)*K
    return P,N,UV,I,C
res=[];tot=0
for bn,fn in TREES:
    P,N,UV,I,C=prep(bn,fn)
    crown=C.reshape(-1,3).mean(0)*np.array([1,.6,1])+np.array([0,0,0]); crown[1]=C.reshape(-1,3)[:,1].min()*.4+C.reshape(-1,3)[:,1].max()*.2
    order=rng.permutation(len(C)); Cs=C[order]
    allp=np.vstack([P,C.reshape(-1,3)]); h=allp[:,1].max()
    hx=np.abs(P[P[:,1]<h*.25][:,0]).max(); hz=np.abs(P[P[:,1]<h*.25][:,2]).max()
    lods=[]; USC=uvscale(P,UV,I)
    for bt,nl,ucm in [(900,380,.01),(200,120,.05)]:
        Vq,Fq=qem(P,I,bt//1); bp=bark_mesh(Vq,Fq,USC)
        nl=min(nl,len(Cs)); sc=min(2.4,(len(Cs)/nl)**.42); lp=leaf_mesh(Cs[:nl],crown,sc)
        lods.append({'b':pack_mesh(*bp),'l':pack_mesh(*lp)}); print('tree',bn,'LOD',len(lods)-1,'bark tris',len(bp[3])//3,'cards',nl,'leaf tris',len(lp[3])//3)
    # bbox da copa (para colisor/raio/escala)
    res.append({'h':round(float(h),3),'hx':round(float(max(hx,.25)),3),'hz':round(float(max(hz,.25)),3),'w':round(float(max(np.abs(allp[:,0]).max(),np.abs(allp[:,2]).max())),2),'lod':lods})
def webp(path,size,alpha=False,q=80):
    im=Image.open(path).convert('RGBA' if alpha else 'RGB').resize((size,size),Image.LANCZOS)
    if alpha:   # sangra a cor das bordas pra dentro da área transparente (mipmap sem halo escuro)
        a=np.array(im); m=a[...,3]>10; idx=distance_transform_edt(~m,return_distances=False,return_indices=True)
        a[...,:3]=a[idx[0],idx[1],:3]; im=Image.fromarray(a,'RGBA')
    b=io.BytesIO(); im.save(b,'WEBP',quality=q,method=6); return 'data:image/webp;base64,'+base64.b64encode(b.getvalue()).decode()
tex={'bark':webp(src+'/textures/bark_baseColor.png',512,False,78),'leaf':webp(src+'/textures/foliage_baseColor.png',512,True,82)}
js='/* Open World Mayhem — cerejeiras. "Cherry Blossom Trees" por Jagobo (https://sketchfab.com/Jagobo), CC-BY-4.0.\n   Gerado por convert_cherry.py. Mesma textura do original (cor), reduzida p/ 512 e WebP; casca decimada; folhas = cartões de 4 tris em 2 LODs.\n   Formato: tex{bark,leaf}; trees[]{h,hx,hz,w (m), lod[2]{b,l:{pos int16 cm, nor int8, uv int16/2048, idx uint16}}}. */\nOWM.cherryPack='+json.dumps({'tex':tex,'trees':res},separators=(',',':'))+';\n'
open(out,'w').write(js); print('bytes',len(js),'trees',[(t['h'],t['hx'],t['w']) for t in res])
