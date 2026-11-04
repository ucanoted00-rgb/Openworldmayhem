#!/usr/bin/env python3
"""Open World Mayhem — extrai o MAPA DE ALTURA do modelo "Dune - Arrakis (WIP)" (Rostenbach, CC-BY-4.0) para dunes.js.
Uso: python3 convert_dunes.py <pasta com scene.gltf e scene.bin> dunes.js
O modelo é um terreno de 160 mil triângulos (20×20 un, relevo 0,1–1,1 × escala 10 do nó = 0–10 m): vira uma grade 192×192 de 8 bits (1 texel ≈ 1 m),
levemente suavizada (tira picos de 1 vértice) e sem a borda (onde a interpolação do modelo falha). O jogo amostra essa grade espelhada como forma das dunas do deserto.
Só precisa de numpy, scipy e pillow."""
import sys,json,base64
import numpy as np
from scipy.interpolate import griddata
from scipy.ndimage import gaussian_filter,zoom

def main():
    pasta,saida=sys.argv[1].rstrip('/')+'/',sys.argv[2]
    js=json.load(open(pasta+'scene.gltf'));binb=open(pasta+'scene.bin','rb').read();bv=js['bufferViews']
    def acc(i):
        a=js['accessors'][i];v=bv[a['bufferView']];ct={5126:np.float32,5123:np.uint16,5125:np.uint32}[a['componentType']];nc={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
        sz=nc*np.dtype(ct).itemsize;st=v.get('byteStride',sz);o=v.get('byteOffset',0)+a.get('byteOffset',0)
        if st==sz:return np.frombuffer(binb,ct,a['count']*nc,o).reshape(a['count'],nc).astype(float)
        return np.array([np.frombuffer(binb,ct,nc,o+k*st) for k in range(a['count'])]).astype(float)
    P=np.vstack([acc(m['primitives'][0]['attributes']['POSITION']) for m in js['meshes']])
    x,y,z=P[:,0],P[:,1],P[:,2]                  # x,y = plano; z = altura (o nó gira e escala ×10)
    N0=384;gx=np.linspace(x.min(),x.max(),N0);gy=np.linspace(y.min(),y.max(),N0);GX,GY=np.meshgrid(gx,gy)
    Z=griddata((x,y),z,(GX,GY),method='linear');bad=np.isnan(Z)
    if bad.any():Z[bad]=griddata((x,y),z,(GX[bad],GY[bad]),method='nearest')
    m=int(N0*.06);Z=Z[m:-m,m:-m]                 # corta 6% de cada borda
    Z=gaussian_filter(Z,1.6)                      # tira picos de 1 vértice (terreno de jogo tem vértices a cada 1 m)
    N=192;Z=zoom(Z,N/Z.shape[0],order=1)
    larg=(x.max()-x.min())*(1-.12)*10             # metros do trecho cortado (escala ×10 do nó)
    z0=(Z.min()-.1)*10;h=(Z.max()-Z.min())*10     # altura total em metros
    u8=np.uint8(np.round((Z-Z.min())/(Z.max()-Z.min())*255))
    gxm,gzm=np.gradient(Z*10,larg/N);sl=np.hypot(gxm,gzm)
    print('grade %dx%d, %.0f m de lado (%.2f m/texel), relevo %.1f m'%(N,N,larg,larg/N,h))
    print('inclinação 1:1 -> mediana %.2f p95 %.2f p99 %.2f máx %.2f'%(np.median(sl),np.percentile(sl,95),np.percentile(sl,99),sl.max()))
    cab='/* Open World Mayhem — forma das dunas do deserto: mapa de altura extraído de "Dune - Arrakis (WIP)" por Rostenbach (https://sketchfab.com/Rostenbach), CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)\n   https://sketchfab.com/3d-models/dune-arrakis-wip-58bd8be249944f1b892a52eb52e06024 — modificado: convertido por convert_dunes.py (grade 192x192, 8 bits, suavizada). m=metros por texel, h=relevo em metros. */\n'
    open(saida,'w',encoding='utf-8').write(cab+'OWM.dunePack='+json.dumps({'n':N,'m':round(larg/N,3),'h':round(h,2),'d':base64.b64encode(u8.tobytes()).decode()},separators=(',',':'))+';\n')
    print('gravado',saida)
    return Z
if __name__=='__main__':main()
