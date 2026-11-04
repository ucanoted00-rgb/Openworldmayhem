#!/usr/bin/env python3
"""Open World Mayhem — converte o pack "Free Pack - Tree" (PolyOne Studio, CC-BY-4.0) em conifers.js.
Uso: python3 convert_conifers.py free_pack_-_tree.glb conifers.js [--preview pasta]

O que faz:
 - lê o GLB (Y para cima), aplica as transformações dos nós e põe a base do tronco em (0,0,0);
 - a textura do pack é só uma PALETA de cores: amostra a cor de cada vértice e GRAVA NO VÉRTICE (sem textura no jogo);
 - marca cada vértice como folha (1) ou tronco (0) pela cor, pra o jogo poder tingir só a folhagem (outono, azulada...);
 - gera um LOD longe por simplificação de malha (quadrics, colapso de arestas), com as bordas de cor preservadas;
 - grava posições em cm (int16), normais int8, cor sRGB uint8, peso de folha uint8 e índices uint16, tudo em base64.
Só precisa de numpy e pillow."""
import sys,io,json,struct,heapq,base64
import numpy as np
from PIL import Image

LOD1_RATIO=.36   # fração dos triângulos que sobra no LOD longe

def ler_glb(caminho):
    f=open(caminho,'rb').read();off=12;js=None;binb=None
    while off<len(f):
        cl,ct=struct.unpack('<I4s',f[off:off+8]);d=f[off+8:off+8+cl]
        if ct==b'JSON':js=json.loads(d)
        else:binb=d
        off+=8+cl
    bv=js['bufferViews']
    def acc(i):
        a=js['accessors'][i];v=bv[a['bufferView']];ct={5126:np.float32,5123:np.uint16,5125:np.uint32}[a['componentType']];nc={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
        sz=nc*np.dtype(ct).itemsize;st=v.get('byteStride',sz);o=v.get('byteOffset',0)+a.get('byteOffset',0)
        return np.array([np.frombuffer(binb,ct,nc,o+k*st) for k in range(a['count'])])
    def mat(n):
        if 'matrix' in n:return np.array(n['matrix']).reshape(4,4).T
        M=np.eye(4);t=n.get('translation',[0,0,0]);q=n.get('rotation',[0,0,0,1]);s=n.get('scale',[1,1,1]);x,y,z,w=q
        R=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
        M[:3,:3]=R@np.diag(s);M[:3,3]=t;return M
    mundo={}
    def andar(i,P):
        n=js['nodes'][i];M=P@mat(n)
        if 'mesh' in n:mundo[n['mesh']]=M
        for c in n.get('children',[]):andar(c,M)
    for r in js['scenes'][0]['nodes']:andar(r,np.eye(4))
    im=js['images'][0];b=bv[im['bufferView']]
    tex=np.array(Image.open(io.BytesIO(binb[b['byteOffset']:b['byteOffset']+b['byteLength']])).convert('RGB')).astype(float)
    out=[]
    for mi in range(len(js['meshes'])):
        p=js['meshes'][mi]['primitives'][0]
        P=acc(p['attributes']['POSITION']).astype(float);N=acc(p['attributes']['NORMAL']).astype(float)
        UV=acc(p['attributes']['TEXCOORD_0']).astype(float);I=acc(p['indices']).reshape(-1,3).astype(int)
        M=mundo[mi];Pw=(np.c_[P,np.ones(len(P))]@M.T)[:,:3];Nw=N@np.linalg.inv(M[:3,:3]).T
        Nw/=np.linalg.norm(Nw,axis=1,keepdims=True)+1e-12
        out.append(dict(P=Pw,N=Nw,UV=UV,I=I))
    return out,tex

def amostra(tex,uv):   # bilinear, origem do UV no canto superior esquerdo (convenção glTF)
    h,w=tex.shape[:2];x=np.clip(uv[:,0]*w-.5,0,w-1.001);y=np.clip(uv[:,1]*h-.5,0,h-1.001)
    x0=x.astype(int);y0=y.astype(int);fx=(x-x0)[:,None];fy=(y-y0)[:,None]
    return (tex[y0,x0]*(1-fx)*(1-fy)+tex[y0,x0+1]*fx*(1-fy)+tex[y0+1,x0]*(1-fx)*fy+tex[y0+1,x0+1]*fx*fy)

def folha(c):   # c: (n,3) sRGB 0..255 — verde predominante = folhagem; marrom/cinza = tronco
    return ((c[:,1]>c[:,0]*1.06)&(c[:,1]>c[:,2]*1.1)).astype(np.uint8)

def simplificar(P,F,C,alvo):
    """Colapso de arestas com quadrics. P (n,3), F (m,3), C (n,3) cor. Vértices com cor diferente nunca estão soldados, então
    a fronteira tronco/folha vira borda aberta e ganha plano de penalidade (não é comida)."""
    n=len(P);Q=np.zeros((n,4,4));F=[tuple(f) for f in F];vivo=[True]*len(F)
    def plano(a,b,c):
        nr=np.cross(P[b]-P[a],P[c]-P[a]);ar=np.linalg.norm(nr)
        if ar<1e-12:return None,0
        nr/=ar;return np.array([nr[0],nr[1],nr[2],-nr.dot(P[a])]),ar/2
    arestas={}
    for fi,(a,b,c) in enumerate(F):
        pl,ar=plano(a,b,c)
        if pl is not None:
            K=np.outer(pl,pl)*ar
            for v in (a,b,c):Q[v]+=K
        for u,v in ((a,b),(b,c),(c,a)):arestas.setdefault((min(u,v),max(u,v)),[]).append(fi)
    for (u,v),fs in arestas.items():
        if len(fs)==1:   # borda: plano perpendicular à face passando pela aresta
            a,b,c=F[fs[0]];pl,ar=plano(a,b,c)
            if pl is None:continue
            e=P[v]-P[u];l=np.linalg.norm(e)
            if l<1e-12:continue
            bn=np.cross(e/l,pl[:3]);bn/=np.linalg.norm(bn)+1e-12
            q=np.array([bn[0],bn[1],bn[2],-bn.dot(P[u])]);K=np.outer(q,q)*(l*l*8+1e-6)
            Q[u]+=K;Q[v]+=K
    vf=[set() for _ in range(n)]
    for fi,f in enumerate(F):
        for v in f:vf[v].add(fi)
    P=P.copy();C=C.copy();ver=[0]*n;heap=[];nf=len(F)
    def custo(u,v):
        Qs=Q[u]+Q[v];melhor=None
        for x in (P[u],P[v],(P[u]+P[v])/2):
            h=np.append(x,1.);e=h@Qs@h
            if melhor is None or e<melhor[0]:melhor=(e,x)
        # não deixa inverter triângulos vizinhos
        for fi in vf[u]|vf[v]:
            a,b,c=F[fi]
            if (u in (a,b,c)) and (v in (a,b,c)):continue
            old=np.cross(P[b]-P[a],P[c]-P[a])
            q=[melhor[1] if t in (u,v) else P[t] for t in (a,b,c)]
            new=np.cross(q[1]-q[0],q[2]-q[0]);ln=np.linalg.norm(old)*np.linalg.norm(new)
            if ln<1e-14 or old.dot(new)/ln<.2:return None
        return melhor
    def empurra(u,v):
        r=custo(u,v)
        if r is not None:heapq.heappush(heap,(r[0],u,v,ver[u],ver[v],r[1]))
    for (u,v) in arestas:empurra(u,v)
    while nf>alvo and heap:
        e,u,v,vu,vv,x=heapq.heappop(heap)
        if ver[u]!=vu or ver[v]!=vv or not vf[u] or not vf[v]:continue
        if v not in {t for fi in vf[u] for t in F[fi]}:continue
        # funde v em u
        P[u]=x;C[u]=(C[u]+C[v])/2;Q[u]=Q[u]+Q[v]
        for fi in list(vf[v]):
            a,b,c=F[fi]
            if u in (a,b,c):   # face contém a aresta: morre
                vivo[fi]=False;nf-=1
                for t in (a,b,c):vf[t].discard(fi)
            else:
                F[fi]=tuple(u if t==v else t for t in (a,b,c));vf[u].add(fi)
        vf[v]=set();ver[u]+=1;ver[v]+=1
        viz={t for fi in vf[u] for t in F[fi] if t!=u}
        for t in viz:empurra(min(u,t),max(u,t))
    faces=[F[i] for i in range(len(F)) if vivo[i] and len(set(F[i]))==3]
    return P,C,np.array(faces)

def lod_plano(P,F,C):   # desfaz o compartilhamento: 3 vértices por triângulo, normal de face (visual facetado, como o pack)
    pos=[];nor=[];cor=[];idx=[]
    for a,b,c in F:
        nr=np.cross(P[b]-P[a],P[c]-P[a]);l=np.linalg.norm(nr)
        if l<1e-12:continue
        nr/=l
        for v in (a,b,c):pos.append(P[v]);nor.append(nr);cor.append(C[v]);idx.append(len(idx))
    return np.array(pos),np.array(nor),np.array(cor),np.array(idx)

def b64(a,dt):return base64.b64encode(np.ascontiguousarray(a).astype(dt).tobytes()).decode()

def pacote_lod(pos,nor,cor,idx):
    cor=np.clip(np.round(cor),0,255)
    return {'p':b64(np.round(pos*100),'<i2'),'n':b64(np.round(nor*127),'i1'),'c':b64(cor,'u1'),'l':b64(folha(cor),'u1'),'i':b64(idx,'<u2')}

def main():
    glb,saida=sys.argv[1],sys.argv[2];prev=sys.argv[sys.argv.index('--preview')+1] if '--preview' in sys.argv else None
    malhas,tex=ler_glb(glb);modelos=[];info=[]
    for k,m in enumerate(malhas):
        P,N,UV,I=m['P'],m['N'],m['UV'],m['I'];cor=amostra(tex,UV)
        # base do tronco em (0,0,0): y mínimo = 0; centro XZ = média dos vértices dos 15 cm mais baixos
        P=P.copy();P[:,1]-=P[:,1].min();baixo=P[:,1]<.15;P[:,0]-=P[baixo,0].mean();P[:,2]-=P[baixo,2].mean()
        h=P[:,1].max();tr=P[(P[:,1]<1.0)&(folha(cor)==0)];rr=np.percentile(np.hypot(tr[:,0],tr[:,2]),90) if len(tr) else .2;rx=rz=min(max(.15,rr),.6)   # raio do tronco só com vértices de tronco (galhos baixos não contam)
        lod0=pacote_lod(P,N,cor,I.reshape(-1))
        # LOD longe: solda por (posição, cor) e simplifica
        chave={};remap=np.zeros(len(P),int);Pw=[];Cw=[]
        for i in range(len(P)):
            kk=(tuple(np.round(P[i],4)),tuple(np.round(cor[i]/4)))
            if kk not in chave:chave[kk]=len(Pw);Pw.append(P[i]);Cw.append(cor[i])
            remap[i]=chave[kk]
        Fw=np.array([tuple(remap[t]) for t in I]);Fw=np.array([f for f in Fw if len(set(f))==3])
        alvo=max(120,int(len(Fw)*LOD1_RATIO))
        Ps,Cs,Fs=simplificar(np.array(Pw),Fw,np.array(Cw),alvo)
        pos,nor,cs,ix=lod_plano(Ps,Fs,Cs);lod1=pacote_lod(pos,nor,cs,ix)
        modelos.append({'h':round(h,3),'hx':round(rx,3),'hz':round(rz,3),'lod':[lod0,lod1]})
        info.append((k,len(I),len(Fs),round(h,2),round(rx,2)))
        if prev:
            import matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
            from matplotlib.collections import PolyCollection
            fig,ax=plt.subplots(1,2,figsize=(8,6))
            for a,(PP,FF,CC,tit) in zip(ax,((P,I,cor,'LOD0 %d'%len(I)),(Ps,Fs,Cs,'LOD1 %d'%len(Fs)))):
                tris=PP[FF];col=CC[FF].mean(1)/255;o=np.argsort(tris[:,:,2].mean(1))
                a.add_collection(PolyCollection([t[:,[0,1]] for t in tris[o]],facecolors=col[o],edgecolors='none'))
                a.set_xlim(-6,6);a.set_ylim(0,13);a.set_aspect('equal');a.set_title(tit);a.axis('off')
            import os;os.makedirs(prev,exist_ok=True);plt.savefig('%s/m%d.png'%(prev,k),dpi=60);plt.close()
    for i in info:print('modelo %d: %d -> %d tris, altura %.2f, raio tronco %.2f'%i)
    cab='/* Open World Mayhem — coníferas da floresta: pack "Free Pack - Tree" por PolyOne Studio (https://sketchfab.com/polyone), CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)\n   https://sketchfab.com/3d-models/free-pack-tree-196525a9936a40c1ba7e74ce5c071d59 — modificado: convertido por convert_conifers.py, cor da paleta gravada nos vértices (sem textura), LOD longe gerado.\n   Posições em cm (int16), base do tronco em (0,0,0). p=pos n=normal c=cor sRGB l=folha(1)/tronco(0) i=índices. */\n'
    open(saida,'w',encoding='utf-8').write(cab+'OWM.coniferPack='+json.dumps({'models':modelos},separators=(',',':'))+';\n')
    print('gravado',saida)
if __name__=="__main__":main()
