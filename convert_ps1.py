#!/usr/bin/env python3
"""Open World Mayhem — converte o pack "PS1 TREES AND BUSHES" (12buuk12, CC-BY-4.0) em ps1trees.js.
Uso: python3 convert_ps1.py <pasta com scene.gltf, scene.bin e textures/> ps1trees.js [--preview pasta]

O pack tem 3 árvores (tronco + copa de planos cruzados "estilo PS1") e 3 arbustos (cartões). O script:
 - aplica as matrizes dos nós (Y para cima), põe a base de cada árvore em (0,0,0) e a escala numa altura de jogo;
 - recorta o fundo PRETO opaco das copas de abeto (flood-fill a partir das bordas) e dilata a cor pra dentro da área transparente (sem halo escuro);
 - monta UM atlas 1024x512 (copas, galho, arbustos) + a casca (tile 256, repete) em WebP: o jogo usa só 2 materiais (casca opaca + cartões com alphaTest);
 - grava posições (int16, cm), normais do tronco (int8), UVs (uint16 do atlas / int16 da casca) e índices (uint16).
Só precisa de numpy, scipy e pillow."""
import sys,os,json,base64,io
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt,binary_dilation,label

AW,AH=1024,512
# nome -> (textura de origem, slot x, y, tamanho útil w,h)  — slot de 256 com 8 px de margem dilatada
SLOTS={'cone1':('Material.003',0,0,240,240),'cone3':('Material.008',256,0,240,240),'ramo':('Material.004',512,0,240,240),'arb3':('Material.011',768,0,240,240),
       'arb1':('Material.009',0,256,240,120),'arb2':('Material.010',256,256,240,120)}
# alturas finais (m, antes da escala PSC do jogo) e peças:  modelo -> (tipo, malha do tronco, malha da copa, slot da copa, altura alvo)
MODELOS=[('tree1','tree',6,1,'cone1',7.5),('tree2','tree',7,0,'ramo',10.5),('tree3','tree',8,2,'cone3',7.0),
         ('bush1','bush',None,3,'arb1',2.2),('bush2','bush',None,4,'arb2',2.2),('bush3','bush',None,5,'arb3',2.2)]

def b64(a,dt):return base64.b64encode(np.ascontiguousarray(a).astype(dt).tobytes()).decode()

def ler(pasta):
    js=json.load(open(pasta+'scene.gltf'));binb=open(pasta+'scene.bin','rb').read();bv=js['bufferViews']
    def acc(i):
        a=js['accessors'][i];v=bv[a['bufferView']];ct={5126:np.float32,5123:np.uint16,5125:np.uint32}[a['componentType']];nc={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
        sz=nc*np.dtype(ct).itemsize;st=v.get('byteStride',sz);o=v.get('byteOffset',0)+a.get('byteOffset',0)
        return np.array([np.frombuffer(binb,ct,nc,o+k*st) for k in range(a['count'])]).astype(float)
    def nm(n):
        if 'matrix' in n:return np.array(n['matrix']).reshape(4,4).T
        return np.eye(4)
    mundo={}
    def andar(i,P):
        n=js['nodes'][i];M=P@nm(n)
        if 'mesh' in n:mundo[n['mesh']]=M
        for c in n.get('children',[]):andar(c,M)
    for r in js['scenes'][0]['nodes']:andar(r,np.eye(4))
    out={}
    for mi,m in enumerate(js['meshes']):
        p=m['primitives'][0];P=acc(p['attributes']['POSITION']);N=acc(p['attributes']['NORMAL']);UV=acc(p['attributes']['TEXCOORD_0']);I=acc(p['indices']).astype(int).reshape(-1,3)
        M=mundo[mi];Pw=(np.c_[P,np.ones(len(P))]@M.T)[:,:3];Nw=N@np.linalg.inv(M[:3,:3]).T;Nw/=np.linalg.norm(Nw,axis=1,keepdims=True)+1e-12
        out[mi]=dict(P=Pw,N=Nw,UV=UV,I=I)
    return out

def dilatar(rgb,mask):   # copia a cor do pixel opaco mais próximo pra dentro da área transparente (evita halo escuro nos mipmaps/bilinear)
    idx=distance_transform_edt(~mask,return_distances=False,return_indices=True)
    return rgb[idx[0],idx[1]]

def recortar_preto(rgba,limiar=16):   # fundo preto opaco -> transparente, só o preto conectado às bordas (preserva sombras escuras dentro da copa)
    a=np.array(rgba);mx=a[...,:3].max(2);esc=mx<=limiar;lab,n=label(esc)
    borda=set(np.unique(np.r_[lab[0],lab[-1],lab[:,0],lab[:,-1]]))-{0}
    fundo=np.isin(lab,list(borda));fundo=binary_dilation(fundo,iterations=1)&esc   # +1 px: tira a franja escura da borda
    a[...,3]=np.where(fundo,0,a[...,3]);return a

def atlas(pasta):
    A=np.zeros((AH,AW,4),np.uint8);rects={}
    for nome,(tx,sx,sy,w,h) in SLOTS.items():
        im=Image.open('%stextures/%s_baseColor.png'%(pasta,tx)).convert('RGBA')
        a=np.array(im)
        if nome.startswith('cone'):a=recortar_preto(im)
        m=a[...,3]>127;rgb=dilatar(a[...,:3],m)                       # cor dilatada antes de reduzir
        r=Image.fromarray(rgb).resize((w,h),Image.LANCZOS);al=Image.fromarray(np.where(m,255,0).astype(np.uint8)).resize((w,h),Image.LANCZOS)
        slot=np.zeros((256 if nome[:3]!='arb' or nome=='arb3' else 128,256,4),np.uint8)
        sw=256;sh=slot.shape[0]
        # imagem centralizada no slot, margem preenchida com a cor da borda (alfa 0)
        rgbs=np.array(r);als=np.array(al)
        full=np.zeros((sh,sw,3),np.uint8);fa=np.zeros((sh,sw),np.uint8);ox=(sw-w)//2;oy=(sh-h)//2
        full[oy:oy+h,ox:ox+w]=rgbs;fa[oy:oy+h,ox:ox+w]=als
        mk=np.zeros((sh,sw),bool);mk[oy:oy+h,ox:ox+w]=True;full=dilatar(full,mk)
        A[sy:sy+sh,sx:sx+sw,:3]=full;A[sy:sy+sh,sx:sx+sw,3]=fa
        rects[nome]=((sx+ox)/AW,(sy+oy)/AH,w/AW,h/AH)
    return A,rects

def webp(arr,q,alpha):
    b=io.BytesIO();Image.fromarray(arr).save(b,'WEBP',quality=q,method=6,alpha_quality=90 if alpha else 100);return b.getvalue()

def main():
    pasta=sys.argv[1].rstrip('/')+'/';saida=sys.argv[2];prev=sys.argv[sys.argv.index('--preview')+1] if '--preview' in sys.argv else None
    M=ler(pasta);A,rects=atlas(pasta)
    casca=np.array(Image.open(pasta+'textures/Material.002_baseColor.png').convert('RGB'))
    modelos=[]
    for nome,tipo,mt,mc,slot,alvo in MODELOS:
        copa=M[mc];tronco=M[mt] if mt is not None else None
        alt=(copa['P'][:,1].max() if tronco is None else max(tronco['P'][:,1].max(),copa['P'][:,1].max()))-(copa['P'][:,1].min() if tronco is None else tronco['P'][:,1].min())
        ref=tronco if tronco is not None else copa
        cx=(ref['P'][:,0].max()+ref['P'][:,0].min())/2;cz=(ref['P'][:,2].max()+ref['P'][:,2].min())/2
        y0=tronco['P'][:,1].min() if tronco is not None else copa['P'][:,1].min()+.12*(copa['P'][:,1].max()-copa['P'][:,1].min())   # arbusto: afunda 12% no chão
        k=alvo/alt
        def xf(P):
            Q=P.copy();Q[:,0]=(Q[:,0]-cx)*k;Q[:,1]=(Q[:,1]-y0)*k;Q[:,2]=(Q[:,2]-cz)*k;return Q
        d={'k':tipo,'n':nome,'h':round(float(alvo),2)}
        if tronco is not None:
            P=xf(tronco['P']);r=np.hypot(P[P[:,1]<alvo*.15][:,0],P[P[:,1]<alvo*.15][:,2]).max()
            d['hx']=d['hz']=round(float(max(.12,r)),3)
            d['b']={'p':b64(np.round(P*100),'<i2'),'n':b64(np.round(tronco['N']*127),'i1'),'u':b64(np.round(tronco['UV']*8192),'<i2'),'i':b64(tronco['I'].reshape(-1),'<u2')}
        else:d['hx']=d['hz']=.35
        P=xf(copa['P']);u0,v0,uw,vh=rects[slot];UV=copa['UV'];ua=np.clip(UV[:,0],0,1)*uw+u0;va=np.clip(UV[:,1],0,1)*vh+v0
        d['c']={'p':b64(np.round(P*100),'<i2'),'u':b64(np.round(np.c_[ua,va]*65535),'<u2'),'i':b64(copa['I'].reshape(-1),'<u2')}
        modelos.append(d)
        print('%-6s %-5s altura %5.2f m (escala %.2f)  tronco %s tris  copa %d tris'%(nome,tipo,alvo,k,len(tronco['I']) if tronco is not None else '-',len(copa['I'])))
        if prev:render(nome,tronco,copa,xf,A,casca,rects[slot],prev)
    tex={'atlas':'data:image/webp;base64,'+base64.b64encode(webp(A,82,True)).decode(),'bark':'data:image/webp;base64,'+base64.b64encode(webp(casca,78,False)).decode()}
    print('atlas %d KB, casca %d KB'%(len(tex['atlas'])*3//4//1024,len(tex['bark'])*3//4//1024))
    cab='/* Open World Mayhem — árvores e arbustos da floresta: pack "PS1 TREES AND BUSHES" por 12buuk12 (https://sketchfab.com/12buuk12), CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)\n   https://sketchfab.com/3d-models/ps1-trees-and-bushes-262d0c30b8df4782bc1dfbdadf76a1b9 — modificado: convertido por convert_ps1.py (fundo preto das copas recortado, texturas reduzidas e reunidas num atlas, árvores recentradas/escaladas).\n   b = tronco (p cm int16, n int8, u int16/8192 repete, i uint16) · c = copa/cartões (p, u uint16/65535 no atlas, i). */\n'
    open(saida,'w',encoding='utf-8').write(cab+'OWM.ps1Pack='+json.dumps({'models':modelos,'tex':tex},separators=(',',':'))+';\n');print('gravado',saida,os.path.getsize(saida)//1024,'KB')
    Image.fromarray(A).save('/tmp/ps1_atlas.png')

def render(nome,tronco,copa,xf,A,casca,rect,prev):   # prévia: z-buffer simples, vista frontal, amostragem do atlas/casca com alpha test
    W,H=360,440;img=np.full((H,W,3),(214,226,236),np.uint8);zb=np.full((H,W),1e9)
    partes=[(copa,'c')]+([(tronco,'b')] if tronco is not None else [])
    allp=np.vstack([xf(p['P']) for p,_ in partes]);hmax=allp[:,1].max();esc=(H-30)/hmax
    for p,tipo in partes:
        P=xf(p['P']);UV=p['UV'];tex=A if tipo=='c' else None
        for tri in p['I']:
            q=P[tri];uv=UV[tri];xs=W/2+q[:,0]*esc;ys=H-10-q[:,1]*esc
            x0,x1=int(max(0,np.floor(xs.min()))),int(min(W-1,np.ceil(xs.max())));y0,y1=int(max(0,np.floor(ys.min()))),int(min(H-1,np.ceil(ys.max())))
            if x1<x0 or y1<y0:continue
            gx,gy=np.meshgrid(np.arange(x0,x1+1)+.5,np.arange(y0,y1+1)+.5)
            d=(ys[1]-ys[2])*(xs[0]-xs[2])+(xs[2]-xs[1])*(ys[0]-ys[2])
            if abs(d)<1e-9:continue
            l1=((ys[1]-ys[2])*(gx-xs[2])+(xs[2]-xs[1])*(gy-ys[2]))/d;l2=((ys[2]-ys[0])*(gx-xs[2])+(xs[0]-xs[2])*(gy-ys[2]))/d;l3=1-l1-l2
            ins=(l1>=0)&(l2>=0)&(l3>=0)
            if not ins.any():continue
            u=l1*uv[0,0]+l2*uv[1,0]+l3*uv[2,0];v=l1*uv[0,1]+l2*uv[1,1]+l3*uv[2,1];z=l1*q[0,2]+l2*q[1,2]+l3*q[2,2]
            if tipo=='c':
                u0,v0,uw,vh=rect;px=((np.clip(u,0,1)*uw+u0)*AW).astype(int).clip(0,AW-1);py=((np.clip(v,0,1)*vh+v0)*AH).astype(int).clip(0,AH-1);t=A[py,px];ok=ins&(t[...,3]>127);col=t[...,:3]
            else:
                px=((u%1)*255).astype(int);py=((v%1)*255).astype(int);col=casca[py,px];ok=ins
            for yy,xx in zip(*np.nonzero(ok)):
                Y,X=y0+yy,x0+xx
                if z[yy,xx]<zb[Y,X]:zb[Y,X]=z[yy,xx];img[Y,X]=col[yy,xx]
    os.makedirs(prev,exist_ok=True);Image.fromarray(img).save('%s/%s.png'%(prev,nome))

if __name__=='__main__':main()
