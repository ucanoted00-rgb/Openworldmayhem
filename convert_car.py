#!/usr/bin/env python3
"""Open World Mayhem — converte o glTF "Broken Car" (maregajavier) em car.js para o minigame "Achar os tokens".
Uso: python3 convert_car.py <pasta com scene.gltf, f.bin e textures/> car.js [--preview arquivo.png]
O modelo original já vem com as 4 rodas soldadas na malha do carro. Aqui elas são SEPARADAS (componentes conexos de 46 triângulos):
o corpo fica sem rodas e cada roda vira uma malha própria, centrada na origem, com a posição do encaixe guardada em 's'.
Eixos finais (antes da escala do jogo): +x = frente do carro, +y = cima, +z = lado direito; origem no centro do carro, y=0 na base das rodas.
Só precisa de numpy e pillow."""
import sys,os,json,base64,io
import numpy as np
from PIL import Image

def b64(a,dt):return base64.b64encode(np.ascontiguousarray(a).astype(dt).tobytes()).decode()

def ler(pasta):
    g=json.load(open(os.path.join(pasta,'scene.gltf')));buf=open(os.path.join(pasta,'f.bin'),'rb').read()
    def acc(i):
        a=g['accessors'][i];bv=g['bufferViews'][a['bufferView']];off=bv.get('byteOffset',0)+a.get('byteOffset',0)
        t={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']];dt={5126:'<f4',5125:'<u4'}[a['componentType']];st=bv.get('byteStride',t*4)
        return np.array([np.frombuffer(buf,dtype=dt,count=t,offset=off+k*st) for k in range(a['count'])])
    out=[]
    for m in g['meshes']:
        p=m['primitives'][0];at=p['attributes'];P=acc(at['POSITION']);N=acc(at['NORMAL']);U=acc(at['TEXCOORD_0']);I=acc(p['indices']).reshape(-1,3).astype(int)
        # o nó raiz do glTF gira o modelo (z-up → y-up): (x,y,z) → (x,z,-y)
        out.append((np.stack([P[:,0],P[:,2],-P[:,1]],1),np.stack([N[:,0],N[:,2],-N[:,1]],1),U,I))
    return out

def componentes(P,I):
    chave={};rm=np.zeros(len(P),int)
    for i,p in enumerate(P):rm[i]=chave.setdefault(tuple(np.round(p,3)),len(chave))
    par=list(range(len(chave)))
    def f(a):
        while par[a]!=a:par[a]=par[par[a]];a=par[a]
        return a
    for t in I:
        a,b,c=[rm[v] for v in t]
        for x,y in((a,b),(b,c)):
            ra,rb=f(x),f(y)
            if ra!=rb:par[ra]=rb
    return np.array([f(rm[t[0]]) for t in I])

def recorta(P,N,U,I):
    """pega só os vértices usados por I e reindexa"""
    u=np.unique(I);novo={v:i for i,v in enumerate(u)}
    return P[u],N[u],U[u],np.array([[novo[v] for v in t] for t in I])

def pacote(P,N,U,I):
    return {'p':b64(P,'<f4'),'n':b64(np.round(N*127),'i1'),'u':b64(U,'<f4'),'i':b64(I.reshape(-1),'<u2'),'t':len(I)}

def main():
    pasta,saida=sys.argv[1],sys.argv[2]
    (P0,N0,U0,I0),(P1,N1,U1,I1)=ler(pasta)
    comp=componentes(P0,I0)
    # rodas: componentes finos (≈0,5 de largura em z) e altos (≈1,6) — são 4 de 46 triângulos
    rodas=[]
    for c in np.unique(comp):
        pts=P0[np.unique(I0[comp==c])];ext=pts.max(0)-pts.min(0)
        if ext[2]<.7 and ext[1]>1.5 and ext[0]>1.2:rodas.append(c)
    assert len(rodas)==4,'esperava 4 rodas, achei %d'%len(rodas)
    corpo=I0[~np.isin(comp,rodas)]
    # centro do carro: x/z pelo corpo; y=0 na média da base das rodas
    bp=P0[np.unique(corpo)];cx=(bp[:,0].min()+bp[:,0].max())/2;cz=(bp[:,2].min()+bp[:,2].max())/2
    rp=[P0[np.unique(I0[comp==c])] for c in rodas];y0=np.mean([p[:,1].min() for p in rp])
    off=np.array([cx,y0,cz])
    wheels=[]
    # ordem dos encaixes: traseira-esquerda, traseira-direita, frente-esquerda, frente-direita (z<0 = esquerda)
    cen=[(p.min(0)+p.max(0))/2-off for p in rp]
    ordem=sorted(range(4),key=lambda k:(round(cen[k][0]),cen[k][2]))
    for k in ordem:
        c=rodas[k];tri=I0[comp==c];Pw,Nw,Uw,Iw=recorta(P0,N0,U0,tri)
        ce=(Pw.min(0)+Pw.max(0))/2
        wheels.append({'s':[round(float(v),4) for v in cen[k]],'g':pacote(Pw-ce,Nw,Uw,Iw)})
    Pb,Nb,Ub,Ib=recorta(P0,N0,U0,corpo);Pb=Pb-off
    Pl,Nl,Ul,Il=recorta(P1,N1,U1,I1);Pl=Pl-off   # peças sem textura (Part1Mtl): lanternas/espelho
    # textura: 512×512 → JPEG (o original em PNG tem 260 KB)
    im=Image.open(os.path.join(pasta,'textures','Meshpart1Mtl_baseColor.png')).convert('RGB');bio=io.BytesIO();im.save(bio,'JPEG',quality=86,optimize=True)
    tex='data:image/jpeg;base64,'+base64.b64encode(bio.getvalue()).decode()
    todos=np.vstack([Pb,Pl]);ext=todos.max(0)-todos.min(0)
    pack={'body':pacote(Pb,Nb,Ub,Ib),'lamps':pacote(Pl,Nl,Ul,Il),'wheels':wheels,'tex':tex,
          'len':round(float(ext[0]),3),'wid':round(float(ext[2]),3),'hgt':round(float(todos.max(0)[1]),3),
          'wr':round(float((rp[0].max(0)[1]-rp[0].min(0)[1])/2),3),   # raio da roda
          'drop':round(float(bp[:,1].min()-y0),3)}                    # quanto o corpo fica acima do chão com as rodas (sem elas o carro "senta" esse tanto)
    cab=('/* Open World Mayhem — carro quebrado do minigame. Modelo \"Broken Car\" por maregajavier (https://sketchfab.com/maregajavier), CC-BY-4.0 (ver CREDITS.txt) — modificado: as 4 rodas foram separadas do corpo\n'
         '   (convert_car.py), textura recomprimida em JPEG. body/lamps = malhas sem rodas; wheels[] = 4 rodas centradas na origem, s = posição do encaixe no carro.\n'
         '   p=pos (float32) n=normal (int8/127) u=uv (float32, glTF: flipY=false) i=índices (uint16). Eixos: +x frente, +y cima, +z direita; y=0 na base das rodas. */\n')
    open(saida,'w',encoding='utf-8').write(cab+'window.OWM=window.OWM||{};\nOWM.carPack='+json.dumps(pack,separators=(',',':'))+';\n')
    print('gravado %s (%d KB) | corpo %d tris, lamps %d tris, rodas %s | len %.2f wid %.2f hgt %.2f raio %.3f drop %.3f'%(saida,os.path.getsize(saida)//1024,len(Ib),len(Il),[w['g']['t'] for w in wheels],pack['len'],pack['wid'],pack['hgt'],pack['wr'],pack['drop']))
    for w in wheels:print('encaixe',w['s'])
    if '--preview' in sys.argv:
        import matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
        from matplotlib.collections import PolyCollection
        tx=np.array(im).astype(float)/255
        def cor(U,I):
            h,w=tx.shape[:2];x=np.clip((U[:,0]%1)*w,0,w-1).astype(int);y=np.clip((U[:,1]%1)*h,0,h-1).astype(int);return tx[y,x][I].mean(1)
        fig,ax=plt.subplots(1,2,figsize=(14,4))
        for a,(i1,i2,tt) in zip(ax,((0,1,'lado'),(2,1,'frente'))):
            tr=Pb[Ib];o=np.argsort(tr[:,:,2 if i1==0 else 0].mean(1));c=cor(Ub,Ib)
            a.add_collection(PolyCollection([t[:,[i1,i2]] for t in tr[o]],facecolors=c[o],edgecolors='none'))
            for w in wheels:
                g=w['g'];pw=np.frombuffer(base64.b64decode(g['p']),'<f4').reshape(-1,3)+np.array(w['s']);iw=np.frombuffer(base64.b64decode(g['i']),'<u2').reshape(-1,3);uw=np.frombuffer(base64.b64decode(g['u']),'<f4').reshape(-1,2)
                t3=pw[iw];oo=np.argsort(t3[:,:,2 if i1==0 else 0].mean(1));cw=cor(uw,iw)
                a.add_collection(PolyCollection([t[:,[i1,i2]] for t in t3[oo]],facecolors=cw[oo],edgecolors='k',linewidths=.2))
            a.set_xlim(-5.5,5.5) if i1==0 else a.set_xlim(-2.5,2.5);a.set_ylim(-.2,4.6);a.set_aspect('equal');a.set_title(tt)
        plt.tight_layout();plt.savefig(sys.argv[sys.argv.index('--preview')+1],dpi=60)
if __name__=='__main__':main()
