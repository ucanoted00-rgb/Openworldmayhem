#!/usr/bin/env python3
"""Open World Mayhem — converte as montanhas do pack "Free Desert Mountain 3D Low Poly Models" (CraftPix) em mountains.js.
Uso: python3 convert_mountains.py <pasta Fbx> mountains.js [--preview pasta]
Lê FBX binário (fbxread.py, sem dependências), centraliza em XZ, apoia a base em y=0 e confere o sentido das faces (normais pra fora).
Grava só posições (int16, cm) e índices (uint16): o jogo calcula normais de face (visual facetado), cores por altura/estrato e o mapa de altura da colisão.
O pack só tem UMA cor na textura (177,70,18), então não há textura nenhuma. Só precisa de numpy (e matplotlib pra --preview)."""
import sys,os,glob,json,base64
import numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from fbxread import malhas

def b64(a,dt):return base64.b64encode(np.ascontiguousarray(a).astype(dt).tobytes()).decode()

def main():
    pasta,saida=sys.argv[1],sys.argv[2];prev=sys.argv[sys.argv.index('--preview')+1] if '--preview' in sys.argv else None
    out=[];arqs=sorted(glob.glob(os.path.join(pasta,'*.fbx')))
    for f in arqs:
        nome=os.path.basename(f)[:-4];kind=nome.split('_')[0].lower()   # mountain / plateau / hill
        ms=malhas(f);P=np.vstack([m['P'] for m in ms]);off=0;F=[]
        for m in ms:F.append(m['F']+off);off+=len(m['P'])
        F=np.vstack(F);P=P.copy()
        P[:,1]-=P[:,1].min();cx=(P[:,0].max()+P[:,0].min())/2;cz=(P[:,2].max()+P[:,2].min())/2;P[:,0]-=cx;P[:,2]-=cz
        # remove triângulos degenerados
        a,b,c=P[F[:,0]],P[F[:,1]],P[F[:,2]];nr=np.cross(b-a,c-a);ar=np.linalg.norm(nr,axis=1);F=F[ar>1e-6];nr=nr[ar>1e-6];a=a[ar>1e-6];b=b[ar>1e-6];c=c[ar>1e-6]
        cen=(a+b+c)/3;ctr=np.array([0,P[:,1].mean(),0])
        # sentido das faces: normais devem apontar pra fora do centro (usa só a parte de cima da malha; o fundo é plano)
        up=cen[:,1]>P[:,1].max()*.15;fora=(nr[up]*(cen[up]-ctr)).sum(1);frac=(fora>0).mean()
        flip=frac<.5
        if flip:F=F[:,[0,2,1]]
        ymax=P[:,1].max()/100;rx=(P[:,0].max()-P[:,0].min())/200;rz=(P[:,2].max()-P[:,2].min())/200;r=float(np.hypot(P[:,0],P[:,2]).max()/100)
        out.append({'k':kind,'n':nome,'h':round(float(ymax),2),'rx':round(float(rx),2),'rz':round(float(rz),2),'r':round(r,2),'p':b64(np.round(P),'<i2'),'i':b64(F.reshape(-1),'<u2')})
        print('%-22s %-8s %5d tris  altura %5.1f m  meia-base %4.1f x %4.1f m  normais p/ fora: %3.0f%%%s'%(nome,kind,len(F),ymax,rx,rz,100*(1-frac if flip else frac),'  (invertido)' if flip else ''))
        if prev:
            import matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
            from matplotlib.collections import PolyCollection
            a,b,c=P[F[:,0]],P[F[:,1]],P[F[:,2]];n=np.cross(b-a,c-a);n/=np.linalg.norm(n,axis=1,keepdims=True)
            L=np.array([-.45,.8,.4]);L/=np.linalg.norm(L);sh=np.clip(n@L,0,1)*.75+.25;col=np.c_[sh*.88,sh*.5,sh*.28]
            tri=np.stack([a,b,c],1);o=np.argsort(tri[:,:,2].mean(1));fig,ax=plt.subplots(figsize=(5,3.4))
            ax.add_collection(PolyCollection([t[:,[0,1]] for t in tri[o]],facecolors=col[o],edgecolors='none'));ax.set_xlim(P[:,0].min(),P[:,0].max());ax.set_ylim(0,P[:,1].max()*1.05);ax.set_aspect('equal');ax.axis('off');ax.set_title(nome)
            os.makedirs(prev,exist_ok=True);plt.savefig('%s/%s.png'%(prev,nome),dpi=50);plt.close()
    cab='/* Open World Mayhem — montanhas, platôs e colinas do deserto: pack "Free Desert Mountain 3D Low Poly Models" (CraftPix, https://craftpix.net/file-licenses/) — modificado: convertido por convert_mountains.py (só geometria, base em y=0).\n   Posições em cm (int16), centro em XZ; i = índices de triângulos (uint16); k = montanha/platô/colina; h,rx,rz,r em metros. */\n'
    open(saida,'w',encoding='utf-8').write(cab+'OWM.mountainPack='+json.dumps({'models':out},separators=(',',':'))+';\n');print('gravado',saida,'(%d modelos)'%len(out))
if __name__=='__main__':main()
