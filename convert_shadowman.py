#!/usr/bin/env python3
"""Open World Mayhem — converte o glTF "Shadow Man" (christopher, CC-BY-4.0) em shadowman.js para o minigame "Achar os tokens".
Uso: python3 convert_shadowman.py <pasta com scene.gltf, scene.bin e textures/> shadowman.js
- Só a malha do corpo é usada (o plano "pPlane1" é uma sombra falsa no chão, o jogo já tem a própria iluminação).
- Escala para 1,9 m de altura, pés em y=0, centrado em x/z. Frente do personagem = +z (olhos calculados pela textura emissiva).
- Textura: o modelo é preto; só os olhos são brancos (textura emissiva) → vira PNG pequeno em escala de cinza.
Só precisa de numpy e pillow."""
import sys,os,json,base64,io
import numpy as np
from PIL import Image

def b64(a,dt):return base64.b64encode(np.ascontiguousarray(a).astype(dt).tobytes()).decode()

def main():
    pasta,saida=sys.argv[1],sys.argv[2]
    g=json.load(open(os.path.join(pasta,'scene.gltf')));buf=open(os.path.join(pasta,'scene.bin'),'rb').read()
    def acc(i):
        a=g['accessors'][i];bv=g['bufferViews'][a['bufferView']];off=bv.get('byteOffset',0)+a.get('byteOffset',0)
        t={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']];dt={5126:'<f4',5125:'<u4'}[a['componentType']];st=bv.get('byteStride',t*4)
        return np.array([np.frombuffer(buf,dtype=dt,count=t,offset=off+k*st) for k in range(a['count'])])
    p=g['meshes'][0]['primitives'][0];at=p['attributes']
    P=acc(at['POSITION']).astype(np.float64);N=acc(at['NORMAL']);U=acc(at['TEXCOORD_0']);I=acc(p['indices']).reshape(-1,3).astype(int)
    # os nós do glTF só escalam (0,01 × 0,066) e giram z-up↔y-up duas vezes (se anulam): y continua sendo "para cima"
    ymin,ymax=P[:,1].min(),P[:,1].max();k=1.9/(ymax-ymin)
    cx,cz=(P[:,0].min()+P[:,0].max())/2,(P[:,2].min()+P[:,2].max())/2
    P=np.stack([(P[:,0]-cx)*k,(P[:,1]-ymin)*k,(P[:,2]-cz)*k],1)
    # olhos: pixels brancos da textura emissiva → UV → posição 3D (baricêntrica)
    em=np.array(Image.open(os.path.join(pasta,'textures','HumanBodystandardSurface2_emissive.png')).convert('L'))
    H,W=em.shape;ys,xs=np.nonzero(em>128);assert len(xs)>0,'sem pixels brancos na textura emissiva'
    def uv_to_3d(u,v):
        A,B,C=U[I[:,0]],U[I[:,1]],U[I[:,2]];d=(B[:,1]-C[:,1])*(A[:,0]-C[:,0])+(C[:,0]-B[:,0])*(A[:,1]-C[:,1])
        with np.errstate(all='ignore'):
            l1=((B[:,1]-C[:,1])*(u-C[:,0])+(C[:,0]-B[:,0])*(v-C[:,1]))/d;l2=((C[:,1]-A[:,1])*(u-C[:,0])+(A[:,0]-C[:,0])*(v-C[:,1]))/d
        l3=1-l1-l2;ok=np.nonzero((l1>=-1e-3)&(l2>=-1e-3)&(l3>=-1e-3)&np.isfinite(l1))[0]
        if len(ok)==0:return None
        out=np.array([l1[t]*P[I[t,0]]+l2[t]*P[I[t,1]]+l3[t]*P[I[t,2]] for t in ok]);return out[np.argmax(out[:,1])]   # vários triângulos no mesmo UV: pega o mais alto
    # a textura emissiva tem 3 manchas brancas: 2 olhos + boca. Rotula as manchas (BFS) e pega as 2 mais altas na cabeça = olhos
    m=em>128;seen=np.zeros_like(m);comps=[]
    from collections import deque
    for y0,x0 in zip(ys,xs):
        if seen[y0,x0]:continue
        q=deque([(y0,x0)]);seen[y0,x0]=1;pts=[]
        while q:
            y,x=q.popleft();pts.append((y,x))
            for dy,dx in((1,0),(-1,0),(0,1),(0,-1)):
                yy,xx=y+dy,x+dx
                if 0<=yy<H and 0<=xx<W and m[yy,xx] and not seen[yy,xx]:seen[yy,xx]=1;q.append((yy,xx))
        if len(pts)>=100:pts=np.array(pts);comps.append((pts[:,1].mean(),pts[:,0].mean()))
    cand=[q for q in (uv_to_3d(cx_/W,cy_/H) for cx_,cy_ in comps) if q is not None]
    cand.sort(key=lambda q:-q[1]);eyes=cand[:2] if len(cand)>=2 else cand
    eyes=np.array(eyes);ey=eyes.mean(0)
    # frente = +z: se os olhos estão atrás do centro, gira 180° em y
    flip=ey[2]<0
    if flip:
        P[:,0]*=-1;P[:,2]*=-1;N=N*np.array([-1,1,-1]);eyes=eyes*np.array([-1,1,-1])
    # textura: em escala de cinza, 1024² (os olhos são manchas grandes) — PNG
    im=Image.open(os.path.join(pasta,'textures','HumanBodystandardSurface2_emissive.png')).convert('L').resize((1024,1024),Image.LANCZOS)
    bio=io.BytesIO();im.save(bio,'PNG',optimize=True);tex='data:image/png;base64,'+base64.b64encode(bio.getvalue()).decode()
    pack={'body':{'p':b64(P,'<f4'),'n':b64(np.round(N*127),'i1'),'u':b64(U,'<f4'),'i':b64(I.reshape(-1),'<u2'),'t':len(I)},
          'tex':tex,'eyes':[[round(float(v),4) for v in e] for e in eyes],'hgt':1.9,'wid':round(float(P[:,0].max()-P[:,0].min()),3)}
    head='''/* Open World Mayhem — Shadow Man do minigame "Achar os tokens". Modelo "Shadow Man" por christopher (https://sketchfab.com/christopher139139),
   CC-BY-4.0 (ver CREDITS.txt) — modificado: só a malha do corpo, escalada para 1,9 m, pés em y=0, frente = +z (convert_shadowman.py), textura emissiva (olhos) recomprimida.
   p=pos (float32) n=normal (int8/127) u=uv (float32, glTF: flipY=false) i=índices (uint16). eyes = posição dos olhos (já na escala final). */
window.OWM=window.OWM||{};
OWM.shadowPack='''
    open(saida,'w').write(head+json.dumps(pack,separators=(',',':'))+';\n')
    print('ok',len(P),'verts',len(I),'tris','olhos',eyes.tolist(),'flip',flip,'wid',pack['wid'],'bytes',os.path.getsize(saida))

main()
