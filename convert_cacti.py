#!/usr/bin/env python3
"""Open World Mayhem — converte a vegetação do pack "Poly Desert Free v1.1" (Runemark Studio) em cacti.js.
Uso: python3 convert_cacti.py "<pasta OBJ>" "<atlas.png>" cacti.js [--preview pasta]
Mesma ideia das coníferas: o atlas do pack são só amostras de cor chapadas, então a cor vai GRAVADA NOS VÉRTICES (sem textura no jogo).
Os modelos têm milhares de triângulos (os espinhos são estrelinhas minúsculas): cada um ganha 2 LODs por simplificação de malha
(quadrics, de meshtools.py), com normais copiadas do vértice original mais próximo. Só precisa de numpy, scipy e pillow."""
import sys,os,json,base64
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from meshtools import simplificar,b64

# nome -> (grupo, razão do LOD perto, razão do LOD longe)
MODELOS=[('cactus01','pad',.45,.15),('cactus02','saguaro',.35,.11),('cactus03','barrel',.55,.2),('aloe','aloe',.5,.17)]

def amostra(tex,uv):
    h,w=tex.shape[:2];x=np.clip(uv[:,0]*w-.5,0,w-1.001);y=np.clip((1-uv[:,1])*h-.5,0,h-1.001)   # OBJ: v de baixo pra cima
    x0=x.astype(int);y0=y.astype(int);fx=(x-x0)[:,None];fy=(y-y0)[:,None]
    return tex[y0,x0]*(1-fx)*(1-fy)+tex[y0,x0+1]*fx*(1-fy)+tex[y0+1,x0]*(1-fx)*fy+tex[y0+1,x0+1]*fx*fy

def ler_obj(path,tex):
    V=[];VT=[];VN=[];cantos={};P=[];N=[];UV=[];F=[]
    for l in open(path,encoding='utf-8',errors='ignore'):
        t=l.split()
        if not t:continue
        if t[0]=='v':V.append([float(x) for x in t[1:4]])
        elif t[0]=='vt':VT.append([float(x) for x in t[1:3]])
        elif t[0]=='vn':VN.append([float(x) for x in t[1:4]])
        elif t[0]=='f':
            ids=[]
            for c in t[1:]:
                a=c.split('/');vi=int(a[0])-1;ti=int(a[1])-1 if len(a)>1 and a[1] else -1;ni=int(a[2])-1 if len(a)>2 and a[2] else -1
                k=(vi,ti,ni)
                if k not in cantos:cantos[k]=len(P);P.append(V[vi]);UV.append(VT[ti] if ti>=0 else [0,0]);N.append(VN[ni] if ni>=0 else [0,1,0])
                ids.append(cantos[k])
            for i in range(1,len(ids)-1):F.append([ids[0],ids[i],ids[i+1]])
    P=np.array(P);UV=np.array(UV);N=np.array(N);F=np.array(F)
    return P,N,F,amostra(tex,UV)

def lod(P,N,F,C,razao):
    # solda por (posição, cor): a fronteira de cor (espinho/flor × corpo) vira borda e é protegida na simplificação
    chave={};remap=np.zeros(len(P),int);Pw=[];Cw=[]
    for i in range(len(P)):
        k=(tuple(np.round(P[i],4)),tuple(np.round(C[i]/4)))
        if k not in chave:chave[k]=len(Pw);Pw.append(P[i]);Cw.append(C[i])
        remap[i]=chave[k]
    Fw=np.array([f for f in (tuple(remap[t]) for t in F) if len(set(f))==3])
    alvo=max(80,int(len(Fw)*razao));Ps,Cs,Fs=simplificar(np.array(Pw),Fw,np.array(Cw),alvo)
    usados=np.unique(Fs);novo={v:i for i,v in enumerate(usados)};Fn=np.array([[novo[v] for v in f] for f in Fs])
    Pn=Ps[usados];Cn=Cs[usados];arv=cKDTree(P);_,j=arv.query(Pn);Nn=N[j]   # normal do vértice original mais próximo
    return Pn,Nn,Cn,Fn

def pacote(P,N,C,F):
    C=np.clip(np.round(C),0,255)
    return {'p':b64(np.round(P*100),'<i2'),'n':b64(np.round(N*127),'i1'),'c':b64(C,'u1'),'l':b64(np.zeros(len(P)),'u1'),'i':b64(F.reshape(-1),'<u2')}

def main():
    pasta,atlas,saida=sys.argv[1],sys.argv[2],sys.argv[3];prev=sys.argv[sys.argv.index('--preview')+1] if '--preview' in sys.argv else None
    tex=np.array(Image.open(atlas).convert('RGB')).astype(float);modelos=[]
    for nome,g,r0,r1 in MODELOS:
        P,N,F,C=ler_obj(os.path.join(pasta,nome+'.obj'),tex)
        P=P.copy();P[:,1]-=P[:,1].min();baixo=P[:,1]<.05;P[:,0]-=P[baixo,0].mean();P[:,2]-=P[baixo,2].mean()   # base em (0,0,0)
        ext=P.max(0)-P.min(0);hx=max(.05,ext[0]/2);hz=max(.05,ext[2]/2)
        L=[lod(P,N,F,C,r0),lod(P,N,F,C,r1)]
        modelos.append({'g':g,'h':round(float(P[:,1].max()),3),'hx':round(float(hx),3),'hz':round(float(hz),3),'lod':[pacote(*l) for l in L]})
        print('%s: %d -> LOD0 %d -> LOD1 %d tris | altura %.2f meia-largura %.2f'%(nome,len(F),len(L[0][3]),len(L[1][3]),P[:,1].max(),hx))
        if prev:
            import matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
            from matplotlib.collections import PolyCollection
            fig,ax=plt.subplots(1,3,figsize=(12,4.2))
            for a,(PP,FF,CC,tit) in zip(ax,((P,F,C,'original %d'%len(F)),(L[0][0],L[0][3],L[0][2],'LOD0 %d'%len(L[0][3])),(L[1][0],L[1][3],L[1][2],'LOD1 %d'%len(L[1][3])))):
                tris=PP[FF];col=CC[FF].mean(1)/255;o=np.argsort(tris[:,:,2].mean(1))
                a.add_collection(PolyCollection([t[:,[0,1]] for t in tris[o]],facecolors=col[o],edgecolors='none'))
                a.set_xlim(P[:,0].min()-.2,P[:,0].max()+.2);a.set_ylim(-.05,P[:,1].max()+.1);a.set_aspect('equal');a.set_title(tit);a.axis('off')
            os.makedirs(prev,exist_ok=True);plt.tight_layout();plt.savefig('%s/%s.png'%(prev,nome),dpi=55);plt.close()
    cab='/* Open World Mayhem — vegetação do deserto: pack "Poly Desert Free v1.1" por Runemark Studio — modificado: convertido por convert_cacti.py, cor do atlas gravada nos vértices (sem textura), 2 LODs por simplificação de malha.\n   Posições em cm (int16), base em (0,0,0). p=pos n=normal c=cor sRGB l=peso de folha (0) i=índices. */\n'
    open(saida,'w',encoding='utf-8').write(cab+'OWM.cactusPack='+json.dumps({'models':modelos},separators=(',',':'))+';\n');print('gravado',saida)
if __name__=='__main__':main()
