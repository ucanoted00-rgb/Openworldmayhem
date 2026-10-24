/* Open World Mayhem — jogo principal. */
(()=>{
const {$,cl,E,B,touch,hash,rng,ld,st,S,DEF,R,scene,cam,mkScreen,go,fld,toast}=OWM,{post,anim,skin}=OWM;
const CS=16,H=48,SEA=12,NT=11,REACH=6;
const CATS=['Idle','Ataque','Corrida','Pulo','Especial','Outro'];

/* ---------- Blocos ---------- */
const BL=[null,
 {n:'Grama',t:0,s:1,b:2,h:.6,d:2},{n:'Terra',t:2,s:2,b:2,h:.5},{n:'Pedra',t:3,s:3,b:3,h:1.5,d:8},null,
 {n:'Tronco',t:6,s:5,b:6,h:1},{n:'Folhas',t:7,s:7,b:7,h:.2}];

/* ---------- Atlas de texturas ---------- */
const AT=document.createElement('canvas');
let ag=null,atlas=null,chunkMat=null;

const CLAMP=(v,mx)=>Math.max(0,Math.min(mx||255,v|0));
const RGB=(r,g,b)=>`rgb(${CLAMP(r)},${CLAMP(g)},${CLAMP(b)})`;

function genPixel(idx,fn){const r=rng(idx*77+3);for(let y=0;y<16;y++)for(let x=0;x<16;x++){ag.fillStyle=fn(x,y,r());ag.fillRect(idx*16+x,y,1,1)}}
function genHD(idx,fn){const r=rng(idx*77+3);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const u=(x/64)*16,v=(y/64)*16;ag.fillStyle=fn(u,v,r);ag.fillRect(idx*64+x,y,1,1)}}
const RNOISE=(r,amt)=>(r()-0.5)*amt;

function buildAtlas(hd){
 const res=hd?64:16;AT.width=NT*res;AT.height=res;ag=AT.getContext('2d');ag.clearRect(0,0,AT.width,AT.height);
 if(!hd){
  genPixel(0,(x,y,r)=>RGB(95*(1+(r-.5)*.25),160*(1+(r-.5)*.25),60*(1+(r-.5)*.25)));
  genPixel(1,(x,y,r)=>y<4?RGB(95*(1+(r-.5)*.25),160*(1+(r-.5)*.25),60*(1+(r-.5)*.25)):RGB(134*(1+(r-.5)*.25),96*(1+(r-.5)*.25),67*(1+(r-.5)*.25)));
  genPixel(2,(x,y,r)=>RGB(134*(1+(r-.5)*.25),96*(1+(r-.5)*.25),67*(1+(r-.5)*.25)));
  genPixel(3,(x,y,r)=>RGB(128*(1+(r-.5)*.2),128*(1+(r-.5)*.2),128*(1+(r-.5)*.2)));
  genPixel(5,(x,y,r)=>RGB(102*(x%4===0?.8+r*.1:1+(r-.5)*.15),81*(x%4===0?.8+r*.1:1+(r-.5)*.15),49*(x%4===0?.8+r*.1:1+(r-.5)*.15)));
  genPixel(6,(x,y,r)=>{const d=Math.max(Math.abs(x-7.5),Math.abs(y-7.5));const c=d>6?[102,81,49]:[170,140,90];const k=d%3===1?.85:1+(r-.5)*.1;return RGB(c[0]*k,c[1]*k,c[2]*k)});
  genPixel(7,(x,y,r)=>r<.2?RGB(30,70,25):RGB(55*(1+(r-.5)*.3),125*(1+(r-.5)*.3),45*(1+(r-.5)*.3)));
 } else {
  genHD(0,(u,v,r)=>{const n=RNOISE(r,55);const wave=Math.sin(u*0.45)*Math.cos(v*0.4)*14;return RGB(95+n+wave,160+n+wave,60+n*0.55+wave*0.5)});
  genHD(1,(u,v,r)=>{const n=RNOISE(r,45);const boundary=4+Math.sin(u*0.9)*1.3;if(v<boundary) return RGB(95+n,160+n,60+n*0.55);return RGB(134+n,96+n*0.75,67+n*0.5)});
  genHD(2,(u,v,r)=>{const n=RNOISE(r,48);const clump=Math.sin(u*0.8)*Math.cos(v*0.7)*10;return RGB(134+n+clump,96+n*0.8+clump*0.7,67+n*0.5+clump*0.4)});
  genHD(3,(u,v,r)=>{const n=RNOISE(r,28);const vein=Math.sin(u*1.3+v*0.8)>0.65?-18:0;return RGB(128+n+vein,128+n+vein,128+n+vein)});
  genHD(5,(u,v,r)=>{const n=RNOISE(r,25);const grain=Math.sin(u*3.2+v*0.3)*12;return RGB(102+n+grain,81+n+grain*0.75,49+n+grain*0.45)});
  genHD(6,(u,v,r)=>{const n=RNOISE(r,22);const d=Math.sqrt((u-8)**2+(v-8)**2);const ring=Math.sin(d*2.2)>0.35?-16:0;return RGB(170+n+ring,140+n+ring*0.7,90+n+ring*0.5)});
  genHD(7,(u,v,r)=>{const n=RNOISE(r,45);if(r()<0.18) return RGB(25,60,22);return RGB(55+n,125+n,45+n*0.55)});
 }
 if(atlas)atlas.dispose();
 atlas=new THREE.CanvasTexture(AT);atlas.magFilter=hd?THREE.LinearFilter:THREE.NearestFilter;atlas.minFilter=hd?THREE.LinearMipmapLinearFilter:THREE.NearestFilter;atlas.generateMipmaps=hd;atlas.encoding=THREE.sRGBEncoding;atlas.anisotropy=hd?4:1;
 if(chunkMat){chunkMat.map=atlas;chunkMat.needsUpdate=true;}
 
}
function initMaterials(){if(!chunkMat){chunkMat=new THREE.MeshLambertMaterial({map:atlas,vertexColors:true});OWM.extraMats.push(()=>[chunkMat]);}}
let lastHQ=(S.fancy&&S.hdTex)?1:0,lastHdTex=null;buildAtlas(S.hdTex);lastHdTex=S.hdTex;initMaterials();


/* ---------- Crack ---------- */
function makeCrackCanvas(stage){const c=document.createElement('canvas');c.width=c.height=16;const g=c.getContext('2d');const r=rng(stage*17+7),intensity=(stage+1)/10;g.strokeStyle='rgba(0,0,0,'+(0.55+intensity*0.4)+')';g.lineWidth=1;const numCracks=2+Math.floor(intensity*4);for(let i=0;i<numCracks;i++){let x=8+(r()-.5)*3,y=8+(r()-.5)*3;const angle=r()*Math.PI*2,len=3+r()*(intensity*6),segments=Math.ceil(len);g.beginPath();g.moveTo(x,y);for(let j=0;j<segments;j++){const a=angle+(r()-.5)*1.0;x+=Math.cos(a);y+=Math.sin(a);g.lineTo(x,y)}g.stroke();}if(intensity>0.55){g.strokeStyle='rgba(0,0,0,'+(intensity*0.5)+')';for(let i=0;i<4;i++){g.beginPath();g.moveTo(r()*16,r()*16);g.lineTo(r()*16,r()*16);g.stroke()}}return c;}
const crackTextures=[];for(let s=0;s<10;s++){const t=new THREE.CanvasTexture(makeCrackCanvas(s));t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;crackTextures.push(t)}
const crackMat=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,alphaTest:0.15,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
const crackMesh=new THREE.Mesh(new THREE.BoxGeometry(1.006,1.006,1.006),crackMat);
crackMesh.visible=false;crackMesh.renderOrder=1;scene.add(crackMesh);

/* ---------- Efeitos ---------- */
const particles=[];let camTrauma=0,camShakeT=0;
function addTrauma(t){camTrauma=Math.min(1,camTrauma+t)}
function updateCamShake(dt){camTrauma=Math.max(0,camTrauma-dt*2.2);const shake=camTrauma*camTrauma;if(shake<0.001)return;camShakeT+=dt;const ox=(Math.sin(camShakeT*37)+Math.sin(camShakeT*17))*.5*shake*.07;const oy=(Math.cos(camShakeT*43)+Math.cos(camShakeT*13))*.5*shake*.07;const rz=(Math.sin(camShakeT*29)+Math.sin(camShakeT*7))*.5*shake*.035;cam.position.x+=ox;cam.position.y+=oy;cam.rotation.z+=rz;}
function spawnBreakParticles(bx,by,bz,id){const b=BL[id];if(!b)return;const res=S.hdTex?64:16;const px=ag.getImageData(b.s*res+res/2,(res/2)|0,1,1).data;const col=new THREE.Color(px[0]/255,px[1]/255,px[2]/255);for(let i=0;i<10;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.07,0.07),new THREE.MeshBasicMaterial({color:col}));m.position.set(bx+0.5+(Math.random()-0.5)*0.6,by+0.5+Math.random()*0.6,bz+0.5+(Math.random()-0.5)*0.6);scene.add(m);particles.push({m,vx:(Math.random()-0.5)*4,vy:Math.random()*4+2,vz:(Math.random()-0.5)*4,life:0.8});}}
function updateParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.vy-=20*dt;p.m.position.x+=p.vx*dt;p.m.position.y+=p.vy*dt;p.m.position.z+=p.vz*dt;if(p.life<=0){scene.remove(p.m);p.m.geometry.dispose();p.m.material.dispose();particles.splice(i,1)}}}

/* ---------- Mundo ---------- */
const world={seed:1,chunks:new Map(),meshes:new Map(),col:new Map(),edits:{}};
let NZ=null;
function mkNoise(seed){const h=(x,z)=>{let n=(Math.imul(x,374761393)+Math.imul(z,668265263)+Math.imul(seed,1274126177))|0;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296};return(x,z)=>{const xi=Math.floor(x),zi=Math.floor(z),fx=x-xi,fz=z-zi,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz),a=h(xi,zi),b=h(xi+1,zi),c=h(xi,zi+1),d=h(xi+1,zi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}}
/*TERRAIN-BEGIN*/
/* ---------- Terreno suave (heightfield) estilo Roblox ---------- */
const sstep=(a,b,v)=>{v=Math.max(0,Math.min(1,(v-a)/(b-a)));return v*v*(3-2*v)};
function fbm(x,z,oct){let a=.5,f=1,s=0,n=0;for(let i=0;i<oct;i++){s+=NZ((x*.8+z*.6)*f+i*17.3,(z*.8-x*.6)*f+i*9.1)*a;n+=a;a*=.5;f*=2.03}return s/n}
let H0=null;
function rawH(x,z){
 const mask=sstep(.38,.56,fbm(x/200+11,z/200+7,2));                  // 0 = planície, 1 = região de morros
 const plain=(fbm(x/85,z/85,2)-.5)*7;                                // ondulação leve das planícies
 const hills=(fbm(x/72+9,z/72+3,3)-.5)*40;                           // morros, vales e descidas
 const ridge=Math.pow(sstep(.52,.78,fbm(x/120-40,z/120+25,2)),1.5)*11; // serras ocasionais
 let h=18+plain+mask*(hills+ridge)+(NZ(x/7+5,z/7-3)-.5)*.02;   // microrelevo quase zero: o chão não faz faixas de luz/sombra
 if(h<13)h=13-(13-h)*.5;                                             // vales suaves, sem buracos fundos
 if(h>32)h=32+(h-32)*.45;                                           // topos arredondados (limite de altura do mundo)
 return h;
}
function baseTerrain(x,z){
 if(H0===null)H0=rawH(0,0);
 return H0+(rawH(x,z)-H0)*sstep(14,46,Math.hypot(x,z));             // planície ao redor do spawn
}

/* ---------- Lagos (função pura de x,z + seed → sem costura entre chunks) ----------
   Uma célula de LAKE_CELL m pode ter 1 lago. O nível d'água é único por lago (o ponto mais baixo do anel em volta),
   a bacia é escavada com suavização e a margem sobe até o terreno original. Lagos só em terreno bem plano e longe do spawn. */
const LAKE_CELL=110,LAKE_CHANCE=.5,LAKE_MIN_R=13,LAKE_MAX_R=30,LAKE_MIN_D=2,LAKE_MAX_D=4.5,LAKE_MAXSLOPE=3.2,LAKE_SPAWN_CLEAR=20;   // margem livre (m) entre a área de influência do lago e o spawn
const lakeCache=new Map();
function lakeParams(cx,cz){
 const k=cx+','+cz;let L=lakeCache.get(k);if(L!==undefined)return L;
 L=null;const r=rng(hash('lk'+world.seed+','+k));
 if(r()<LAKE_CHANCE){
  const px=(cx+.2+r()*.6)*LAKE_CELL,pz=(cz+.2+r()*.6)*LAKE_CELL,R=LAKE_MIN_R+r()*(LAKE_MAX_R-LAKE_MIN_R),dep=LAKE_MIN_D+r()*(LAKE_MAX_D-LAKE_MIN_D),sx=r()*100,sz=r()*100;
  if(Math.hypot(px,pz)-R*2.44>LAKE_SPAWN_CLEAR){
   let mn=baseTerrain(px,pz),mx=mn;
   for(let i=0;i<8;i++){const a=i*.7854,hh=baseTerrain(px+Math.cos(a)*R*1.25,pz+Math.sin(a)*R*1.25);if(hh<mn)mn=hh;if(hh>mx)mx=hh}
   if(mx-mn<LAKE_MAXSLOPE)L={px,pz,R,dep,wl:mn-.15,sx,sz};
  }
 }
 lakeCache.set(k,L);return L;
}
const lakeT=(L,x,z)=>Math.hypot(x-L.px,z-L.pz)/(L.R*(.78+.44*NZ(x/15+L.sx,z/15+L.sz)));   // 0 = centro, ~.8 = margem
function lakeInfo(x,z){
 const cx=Math.floor(x/LAKE_CELL),cz=Math.floor(z/LAKE_CELL);let best=null,bt=2;
 for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const L=lakeParams(cx+a,cz+b);if(!L)continue;const t=lakeT(L,x,z);if(t<bt){bt=t;best=L}}
 return best?{t:bt,wl:best.wl,dep:best.dep,L:best}:null;
}
function terrainFn(x,z){
 const b=baseTerrain(x,z),k=lakeInfo(x,z);if(!k)return b;
 const t=k.t,wl=k.wl,rim=Math.max(b,wl+.25),u=Math.min(1,t/.8),core=wl-k.dep*(1-u*u*(3-2*u)),h1=core+(rim-core)*sstep(.7,1.25,t);
 return h1+(b-h1)*sstep(1.25,2,t);
}
/* nível da água em (x,z), ou -Infinity se não há água ali */
function waterLvl(x,z){const k=lakeInfo(x,z);if(!k||k.t>1.3)return -Infinity;return groundH(x,z)<k.wl?k.wl:-Infinity}
/*TERRAIN-END*/
const hgt=(x,z)=>terrainFn(x,z);
/* Grade de alturas por chunk (com 1 vértice de folga em volta pra normais sem emenda). Física e malha usam a MESMA superfície. */
const HP=CS+3;
function hvBuild(cx,cz){const a=new Float32Array(HP*HP);for(let z=-1;z<=CS+1;z++)for(let x=-1;x<=CS+1;x++)a[(z+1)*HP+x+1]=terrainFn(cx*CS+x,cz*CS+z);return a}
function hvAt(hv,x,z){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,i=(iz+1)*HP+ix+1,h00=hv[i],h10=hv[i+1],h01=hv[i+HP],h11=hv[i+HP+1];
 return fx+fz<=1?h00+fx*(h10-h00)+fz*(h01-h00):h11+(1-fx)*(h01-h11)+(1-fz)*(h10-h11)}
const slopeN=(hv,lx,lz)=>{const i=(lz+1)*HP+lx+1,gx=(hv[i+1]-hv[i-1])/2,gz=(hv[i+HP]-hv[i-HP])/2;return 1/Math.hypot(1,gx,gz)};
const ck=(cx,cz)=>(cx+4096)*8192+(cz+4096);
/*PROPS-BEGIN*/
/* ---------- Props do pack "Low Poly Forest": árvores e pedras no mundo ---------- */
const PK=OWM.pack||{trees:[],rocks:[]};
const PSC={oak:.8,spruce:.72,deadoak:.8,deadspruce:.72,rock:.45,bigrock:.3};   // o pack vem em escala ~10 m; 1 bloco = 1 m
const unb64=(s,T)=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return new T(u.buffer)};
const s2l=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};
const PROTO={oak:[],spruce:[],deadoak:[],deadspruce:[],rock:[],bigrock:[]};
for(const e of PK.trees.concat(PK.rocks))if(PROTO[e.k])PROTO[e.k].push({k:e.k,pos:unb64(e.p,Int16Array),col:unb64(e.c,Uint8Array),idx:unb64(e.i,Uint16Array),pal:e.pal.map(c=>c.map(s2l)),h:e.h,hx:e.hx,hz:e.hz,hy:e.hy});
/* Brilho/suavidade dos meshes de chão, árvores e pedras. rough:0 = smoothness máxima. */
const GLOSS={rough:0,metal:0};
/* Normais suaves por vértice (médias ponderadas pela área) — fim do visual facetado. */
function mkNor(pr){const P=pr.pos,I=pr.idx,N=new Float32Array(P.length);
 for(let t=0;t<I.length;t+=3){const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3,ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
  for(const k of [a,b,c]){N[k]+=nx;N[k+1]+=ny;N[k+2]+=nz}}
 for(let i=0;i<N.length;i+=3){const l=Math.hypot(N[i],N[i+1],N[i+2])||1;N[i]/=l;N[i+1]/=l;N[i+2]/=l}
 pr.nor=N}
for(const k in PROTO)PROTO[k].forEach(mkNor);

/* ---------- Árvores: pack "Trees Low Poly" (trees.js) ----------
   round -> oak/deadoak, tall -> spruce/deadspruce (as mortas = só a casca, mais escura). */
const TP=OWM.treePack,TREE={},TM={lo:null,hi:null};
const f32=(a,k)=>{const o=new Float32Array(a.length);for(let i=0;i<a.length;i++)o[i]=a[i]*k;return o};
if(TP)for(const n in TP.trees){const t=TP.trees[n],B=t.bark,L=t.leaf,nq=L.nq,lp=f32(unb64(L.pos,Int16Array),.01),ctr=new Float32Array(nq*3);
 for(let q=0;q<nq;q++)for(let c=0;c<3;c++){let a=0;for(let v=0;v<4;v++)a+=lp[(q*4+v)*3+c];ctr[q*3+c]=a/4}
 const mesh=(p,nr,uv,idx)=>({pos:f32(unb64(p,Int16Array),.01),nor:f32(unb64(nr,Int8Array),1/127),uv:f32(unb64(uv,Int16Array),1/2048),idx:unb64(idx,Uint16Array)});
 TREE[n]={h:t.h,hx:t.hx,hz:t.hz,bark:mesh(B.pos,B.nor,B.uv,B.idx),trunk:mesh(B.tpos,B.tnor,B.tuv,B.tidx),
  leaf:{nq,pos:lp,ctr,nor:f32(unb64(L.nor,Int8Array),1/127),uv:f32(unb64(L.uv,Int16Array),1/2048),pat:unb64(L.pat,Uint8Array)}};}
for(const[k,[n,dead]]of Object.entries({oak:['round',0],spruce:['tall',0],deadoak:['round',1],deadspruce:['tall',1]}))
 if(TREE[n])PROTO[k]=[{k,tree:TREE[n],dead:!!dead,h:TREE[n].h,hx:TREE[n].hx,hz:TREE[n].hz,hy:TREE[n].h}];
/* Qualidade máxima (sem otimização) só com "Resolução alta" + "Texturas HD" ligadas. */
const HQ=()=>S.fancy&&S.hdTex?1:0;
const treeTex=(u,srgb)=>{const t=new THREE.TextureLoader().load(u);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.flipY=false;if(srgb)t.encoding=THREE.sRGBEncoding;t.anisotropy=Math.min(8,R.capabilities.getMaxAnisotropy());return t};
function treeMats(hq){
 const k=hq?'hi':'lo';if(TM[k])return TM[k];const X=TP.tex[k],D=THREE.DoubleSide;
 TM[k]=hq?{bark:new THREE.MeshStandardMaterial({map:treeTex(X.bark,1),normalMap:treeTex(X.normal),roughnessMap:treeTex(X.rough),roughness:1,metalness:0,vertexColors:true}),
           leaf:new THREE.MeshStandardMaterial({map:treeTex(X.leaf,1),alphaTest:.4,side:D,roughness:.7,metalness:0,vertexColors:true})}
         :{bark:new THREE.MeshLambertMaterial({map:treeTex(X.bark,1),vertexColors:true}),
           leaf:new THREE.MeshLambertMaterial({map:treeTex(X.leaf,1),alphaTest:.45,side:D,vertexColors:true})};
 return TM[k]}
OWM.extraMats.push(()=>{const a=[];for(const k in TM)if(TM[k])a.push(TM[k].bark,TM[k].leaf);return a});
/* LOD por distância (só no modo otimizado): perto = 50% das folhas; longe (>3,7 chunks) = 22% das folhas e só o tronco. Histerese evita ficar trocando. */
function treeTier(cx,cz,prev){if(HQ())return 0;const d=Math.hypot(cx-(P.p.x>>4),cz-(P.p.z>>4));return prev===1?(d>3?1:0):(d>3.7?1:0)}
function addTree(p,tier,hq,A){
 const tr=p.pr.tree,dead=p.pr.dead,s=p.s,cr=Math.cos(p.rot),sr=Math.sin(p.rot),hh=Math.max(.01,tr.h*s),j=(p.sd-.5)*.16;
 const tr_=dead?.62:1+j,tg=dead?.58:1,tb=dead?.55:1-j*.5,B=A.b;
 const bk=(tier===1&&!hq)?tr.trunk:tr.bark,nb=bk.pos.length/3,b0=B.pos.length/3;
 for(let i=0;i<nb;i++){const lx=bk.pos[i*3]*s,ly=bk.pos[i*3+1]*s,lz=bk.pos[i*3+2]*s,nx=bk.nor[i*3],nz=bk.nor[i*3+2],g=p.b*(.8+.2*Math.min(1,ly/hh));
  B.pos.push(p.x+lx*cr+lz*sr,p.y+ly,p.z-lx*sr+lz*cr);B.nor.push(nx*cr+nz*sr,bk.nor[i*3+1],-nx*sr+nz*cr);B.uv.push(bk.uv[i*2],bk.uv[i*2+1]);B.col.push(g*tr_,g*tg,g*tb)}
 for(let i=0;i<bk.idx.length;i++)B.idx.push(b0+bk.idx[i]);
 if(dead)return;
 const L=tr.leaf,Lf=A.l,frac=hq?1:tier===1?.22:.5,nq=Math.round(L.nq*frac),sc=frac<1?.92/Math.sqrt(frac):1,l0=Lf.pos.length/3;
 for(let q=0;q<nq;q++){const v=(q*.6180339+p.sd)%1,qb=1+(v-.5)*.12;
  for(let k=0;k<4;k++){const o=q*4+k,cx=L.ctr[q*3],cy=L.ctr[q*3+1],cz=L.ctr[q*3+2],lx=(cx+(L.pos[o*3]-cx)*sc)*s,ly=(cy+(L.pos[o*3+1]-cy)*sc)*s,lz=(cz+(L.pos[o*3+2]-cz)*sc)*s,nx=L.nor[o*3],nz=L.nor[o*3+2],g=p.b*qb*(.74+.26*Math.min(1,ly/hh));
   Lf.pos.push(p.x+lx*cr+lz*sr,p.y+ly,p.z-lx*sr+lz*cr);Lf.nor.push(nx*cr+nz*sr,L.nor[o*3+1],-nx*sr+nz*cr);Lf.uv.push(L.uv[o*2],L.uv[o*2+1]);Lf.col.push(g*(1+j),g,g*(1-j*.6))}
  for(let t=0;t<6;t++)Lf.idx.push(l0+q*4+L.pat[q*6+t])}
}
function mkTreeMesh(A,mat,shadow){
 if(!A.idx.length)return null;const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(A.pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(A.nor,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(A.uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(A.col,3));
 g.setIndex(new THREE.BufferAttribute(new Uint32Array(A.idx),1));g.computeBoundingSphere();
 const m=new THREE.Mesh(g,mat);m.castShadow=shadow;m.receiveShadow=true;scene.add(m);return m}
/* ---------- Texturas procedurais (tileáveis) de grama e pedra ---------- */
const GRASS_TILE=4;   // 1 repetição da textura de grama = 4 m de chão
const STONE_SCALE=.75; // repetições da textura de pedra por metro (mapeamento triplanar)
function wrapNoise(N,seed){const r=rng(seed),L=new Float32Array(N*N);for(let i=0;i<L.length;i++)L[i]=r();
 return(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),
  a=L[(((yi%N)+N)%N)*N+(((xi%N)+N)%N)],b=L[(((yi%N)+N)%N)*N+((((xi+1)%N)+N)%N)],c=L[((((yi+1)%N)+N)%N)*N+(((xi%N)+N)%N)],d=L[((((yi+1)%N)+N)%N)*N+((((xi+1)%N)+N)%N)];
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}}
function fbmT(nz,x,y,per,oct){let s=0,a=.5,t=0;for(let o=0;o<oct;o++){s+=a*nz(x*per,y*per);t+=a;per*=2;a*=.5}return s/t}
const lin255=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};
function makeGrassCanvas(){
 const N=256,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d'),img=g.createImageData(N,N),d=img.data,
  n1=wrapNoise(8,11),n2=wrapNoise(32,23),r=rng(901);
 const lum=new Float32Array(N*N);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=x/N,v=y/N;lum[y*N+x]=.78+.16*(fbmT(n1,u,v,1,1)-.5)*2+.10*(fbmT(n2,u,v,1,3)-.5)*2+(r()-.5)*.1}
 // folhinhas de grama: riscos curtos claros/escuros, com wrap nas bordas
 for(let k=0;k<2600;k++){const x0=r()*N,y0=r()*N,len=3+r()*7,ang=-Math.PI/2+(r()-.5)*1.1,bright=r()<.55,amt=bright?.12+r()*.1:-(.1+r()*.12);
  for(let s=0;s<len;s++){const px=Math.floor(x0+Math.cos(ang)*s+N*4)%N,py=Math.floor(y0+Math.sin(ang)*s+N*4)%N,f=1-s/len;lum[py*N+px]+=amt*(bright?f:1-f*.4)}}
 for(let i=0;i<N*N;i++){const l=Math.max(.35,Math.min(1,lum[i])),v=l*255;d[i*4]=v*.96;d[i*4+1]=v;d[i*4+2]=v*.88;d[i*4+3]=255}
 g.putImageData(img,0,0);
 let m=0;for(let i=0;i<N*N;i++)m+=lin255(d[i*4+1]);
 return{c,mean:m/(N*N)}}
function makeStoneCanvas(){
 const N=256,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d'),img=g.createImageData(N,N),d=img.data,
  n1=wrapNoise(8,5),n2=wrapNoise(32,9),n3=wrapNoise(64,13),r=rng(333),G=6,pts=[];
 for(let j=0;j<G;j++)for(let i=0;i<G;i++)pts.push([(i+.15+r()*.7)/G,(j+.15+r()*.7)/G,r()]);
 let sum=0;
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=x/N,v=y/N;
  let f1=9,f2=9,id=0;
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const gi=((Math.floor(u*G)+i)%G+G)%G,gj=((Math.floor(v*G)+j)%G+G)%G,p=pts[gj*G+gi],ox=Math.floor(u*G)+i-gi,oy=Math.floor(v*G)+j-gj,
    dx=u-(p[0]+ox/G),dy=v-(p[1]+oy/G),dd=Math.sqrt(dx*dx+dy*dy);if(dd<f1){f2=f1;f1=dd;id=p[2]}else if(dd<f2)f2=dd}
  const edge=(f2-f1)*G,crack=1-Math.min(1,edge/.18);
  let l=.62+.2*(id-.5)+.22*(fbmT(n1,u,v,1,1)-.5)*2+.16*(fbmT(n2,u,v,1,3)-.5)*2+.1*(fbmT(n3,u,v,1,2)-.5)*2+(r()-.5)*.09;
  l-=crack*crack*.34;
  l=Math.max(.2,Math.min(1,l));const i=(y*N+x)*4,vv=l*255;d[i]=vv*.98;d[i+1]=vv;d[i+2]=vv*1.03;d[i+3]=255;sum+=lin255(vv)}
 g.putImageData(img,0,0);return{c,mean:sum/(N*N)}}
const mkTex=c=>{const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;t.anisotropy=Math.min(8,R.capabilities.getMaxAnisotropy());t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;return t};
const GR=makeGrassCanvas(),ST=makeStoneCanvas(),grassTex=mkTex(GR.c),stoneTex=mkTex(ST.c);

/* Chão: textura de grama por UV (duas escalas misturadas pra esconder a repetição). A cor por vértice continua tingindo
   (grama / terra / areia / pedra de encosta); a "mean" compensa o escurecimento da textura. */
const terrMat=new THREE.MeshStandardMaterial({map:grassTex,vertexColors:true,roughness:GLOSS.rough,metalness:GLOSS.metal});
terrMat.color.setScalar(1/GR.mean);
terrMat.onBeforeCompile=sh=>{
 sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`
 #ifdef USE_MAP
  vec4 t1=texture2D(map,vUv);vec4 t2=texture2D(map,vUv*.23+vec2(.37,.11));
  t1=mapTexelToLinear(t1);float mac=clamp(1.+(t2.g-.78)*.5,.88,1.12);
  diffuseColor*=vec4(t1.rgb*mac,1.);
 #endif`)};
/* Pedras (props): textura de pedra triplanar em coordenadas de mundo — a malha dos props não tem UV. */
const propMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:GLOSS.rough,metalness:GLOSS.metal});
propMat.onBeforeCompile=sh=>{
 sh.uniforms.uStone={value:stoneTex};sh.uniforms.uStoneK={value:1/ST.mean};sh.uniforms.uStoneS={value:STONE_SCALE};
 sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;varying vec3 vWN;')
  .replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*vec4(position,1.)).xyz;vWN=normalize(normal);');
 sh.fragmentShader='uniform sampler2D uStone;uniform float uStoneK;uniform float uStoneS;varying vec3 vWP;varying vec3 vWN;\n'+sh.fragmentShader.replace('#include <map_fragment>',`
  vec3 bw=pow(abs(normalize(vWN)),vec3(4.));bw/=(bw.x+bw.y+bw.z);
  vec3 sx=pow(texture2D(uStone,vWP.zy*uStoneS).rgb,vec3(2.2));
  vec3 sy=pow(texture2D(uStone,vWP.xz*uStoneS+.31).rgb,vec3(2.2));
  vec3 sz=pow(texture2D(uStone,vWP.xy*uStoneS+.67).rgb,vec3(2.2));
  diffuseColor.rgb*=(sx*bw.x+sy*bw.y+sz*bw.z)*uStoneK;`)};
OWM.extraMats.push(()=>[propMat,terrMat]);

/* Decide onde ficam árvores/pedras de um chunk. Só depende da semente + chunk, então é igual sempre. */
function genProps(cx,cz,hv){
 const out=[],r=rng(hash('pk'+world.seed+','+cx+','+cz)),ox=cx*CS,oz=cz*CS;
 const dens=NZ((ox+8)/64+300,(oz+8)/64+300);                        // densidade de floresta: muda devagar pelo mapa
 const pick=(a,pw)=>a[Math.min(a.length-1,Math.floor(Math.pow(r(),pw||1)*a.length))];
 const free=(x,z,rad)=>{if(Math.abs(x)<5&&Math.abs(z)<5)return false;for(const p of out)if(Math.hypot(p.x-x,p.z-z)<rad+p.rad)return false;return true};
 const add=(k,x,z,h,rad,sj)=>{const lk=lakeInfo(x,z);if(lk&&lk.t<1.0)return;const pr=pick(PROTO[k],k==='rock'?1.8:1);if(!pr)return;const s=PSC[k]*(1-sj+r()*sj*2),rd=Math.max(rad,pr.hx*s*1.6);if(!free(x,z,rd))return;const lx=x-ox,lz=z-oz,rr=Math.min(.9,pr.hx*s*.6),gy=Math.min(hvAt(hv,lx,lz),hvAt(hv,lx-rr,lz),hvAt(hv,lx+rr,lz),hvAt(hv,lx,lz-rr),hvAt(hv,lx,lz+rr))-.12;out.push({id:out.length,k,pr,x,z,y:gy,s,rot:r()*6.2832,rad:rd,b:.9+r()*.2,sd:r()})};
 const nT=Math.floor(dens*dens*7+r()*1.6);
 for(let a=0;a<nT*3&&out.length<nT;a++){
  const lx=1+(r()*14|0),lz=1+(r()*14|0),h=hvAt(hv,lx+.5,lz+.5);if(h<=SEA+1||slopeN(hv,lx,lz)<.82)continue;
  const x=ox+lx+.5+(r()-.5)*.6,z=oz+lz+.5+(r()-.5)*.6,t=NZ(x/80+900,z/80-400);
  let k;
  if(t<.24)k=r()<.6?'deadoak':'deadspruce';                         // zona morta
  else if(h>=24||t>.7)k=r()<.9?'spruce':'oak';                      // terreno alto / frio: pinheiros
  else k=r()<.88?'oak':'spruce';                                    // floresta normal: carvalhos
  add(k,x,z,h,1.9,.18);
 }
 const nR=1+(r()<.6?1:0)+(r()<.35?1:0)+(dens<.4?1:0);
 for(let a=0,n=0;a<nR*3&&n<nR;a++){
  const lx=1+(r()*14|0),lz=1+(r()*14|0),h=hvAt(hv,lx+.5,lz+.5);if(h<=SEA)continue;
  const before=out.length;add('rock',ox+lx+.5,oz+lz+.5,h,1.2,.3);if(out.length>before)n++;
 }
 if(r()<(.05+(dens<.35?.05:0))){const lx=2+(r()*12|0),lz=2+(r()*12|0),h=hvAt(hv,lx+.5,lz+.5);if(h>SEA+1)add('bigrock',ox+lx+.5,oz+lz+.5,h,3,.2)}
 return out;
}

function dropMesh(v){if(v.wm){for(const w of v.wm){scene.remove(w);w.geometry.dispose()}}if(v.tm){scene.remove(v.tm);v.tm.geometry.dispose()}if(v.m){scene.remove(v.m);v.m.geometry.dispose()}if(v.pm){scene.remove(v.pm);v.pm.geometry.dispose()}if(v.bm){scene.remove(v.bm);v.bm.geometry.dispose()}if(v.lm){scene.remove(v.lm);v.lm.geometry.dispose()}}

/* Monta UMA malha com todos os props do chunk (normais suaves por vértice) e registra colisores. */
function buildProps(ch){
 const rem=world.edits['p'+ch.cx+','+ch.cz]||{},pos=[],nor=[],col=[],list=[],old=world.meshes.get(ck(ch.cx,ch.cz)),hq=HQ(),tier=treeTier(ch.cx,ch.cz,old&&old.tier),TA={b:{pos:[],nor:[],uv:[],col:[],idx:[]},l:{pos:[],nor:[],uv:[],col:[],idx:[]}};
 for(const p of ch.props){
  if(rem[p.id])continue;
  const pr=p.pr,s=p.s,cr=Math.cos(p.rot),sr=Math.sin(p.rot),P=pr.pos,I=pr.idx,hh=Math.max(.01,pr.h*s);
  if(pr.tree)addTree(p,tier,hq,TA);else{
  const j=(p.sd-.5)*.14,cl=pr.pal.map(c=>[c[0]*p.b*(1+j),c[1]*p.b*(1+j*.4),c[2]*p.b*(1-j*.3)]);
  const NR=pr.nor;
  for(let t=0;t<I.length;t+=3){
   for(let q=0;q<3;q++){const i=I[t+q],lx=P[i*3]/100*s,ly=P[i*3+1]/100*s,lz=P[i*3+2]/100*s,nx=NR[i*3],nz=NR[i*3+2];
    pos.push(p.x+lx*cr+lz*sr,p.y+ly,p.z-lx*sr+lz*cr);nor.push(nx*cr+nz*sr,NR[i*3+1],-nx*sr+nz*cr);
    const g=.82+.18*Math.min(1,Math.max(0,ly/hh)),cc=cl[pr.col[i]];col.push(cc[0]*g,cc[1]*g,cc[2]*g)}
  }}
  const hy=pr.hy*s,tree=p.k==='oak'||p.k==='spruce',dead=p.k==='deadoak'||p.k==='deadspruce';
  list.push({id:p.id,cx:ch.cx,cz:ch.cz,k:p.k,x:p.x,z:p.z,hx:Math.max(.2,pr.hx*s),hz:Math.max(.2,pr.hz*s),y0:p.y,hy,solid:hy>=.55,hard:tree?2.2:dead?1.6:p.k==='bigrock'?3.2:.8+hy*.3});
 }
 let pm=null;
 if(pos.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(nor),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(col),3));g.computeBoundingSphere();pm=new THREE.Mesh(g,propMat);pm.castShadow=pm.receiveShadow=true;scene.add(pm)}
 world.col.set(ck(ch.cx,ch.cz),list);
 const tm=TP?treeMats(hq):null;
 return{pm,tier,bm:tm?mkTreeMesh(TA.b,tm.bark,tier===0):null,lm:tm?mkTreeMesh(TA.l,tm.leaf,tier===0):null};
}

/* Colisão: só o tronco / a pedra bloqueiam (copa não). Pedrinhas baixas (<0.55 m) dá pra pisar. */
function propHits(x,y,z){
 const c0=(Math.floor(x-.3)-3)>>4,c1=(Math.floor(x+.3)+3)>>4,d0=(Math.floor(z-.3)-3)>>4,d1=(Math.floor(z+.3)+3)>>4;
 for(let a=c0;a<=c1;a++)for(let b=d0;b<=d1;b++){const l=world.col.get(ck(a,b));if(!l)continue;for(const c of l)if(c.solid&&Math.abs(x-c.x)<c.hx+.3&&Math.abs(z-c.z)<c.hz+.3&&y<c.y0+c.hy&&y+1.79>c.y0)return true}
 return false;
}
function propBlocks(bx,by,bz){
 for(let a=(bx-4)>>4;a<=(bx+4)>>4;a++)for(let b=(bz-4)>>4;b<=(bz+4)>>4;b++){const l=world.col.get(ck(a,b));if(!l)continue;for(const c of l)if(c.solid&&bx<c.x+c.hx&&bx+1>c.x-c.hx&&bz<c.z+c.hz&&bz+1>c.z-c.hz&&by<c.y0+c.hy&&by+1>c.y0)return true}
 return false;
}
/* Raio contra a caixa de cada prop (pra mirar/quebrar árvore e pedra). Devolve o mais próximo. */
function rayProp(o,d,max){
 let best=null;
 for(let a=(Math.floor(o.x-max)-4)>>4;a<=(Math.floor(o.x+max)+4)>>4;a++)for(let b=(Math.floor(o.z-max)-4)>>4;b<=(Math.floor(o.z+max)+4)>>4;b++){
  const l=world.col.get(ck(a,b));if(!l)continue;
  for(const c of l){
   const lo=[c.x-c.hx-.08,c.y0,c.z-c.hz-.08],hi=[c.x+c.hx+.08,c.y0+c.hy,c.z+c.hz+.08],ov=[o.x,o.y,o.z],dv=[d.x,d.y,d.z];
   let t0=0,t1=max,ok=true;
   for(let q=0;q<3&&ok;q++){
    if(Math.abs(dv[q])<1e-9){if(ov[q]<lo[q]||ov[q]>hi[q])ok=false}
    else{let u=(lo[q]-ov[q])/dv[q],w=(hi[q]-ov[q])/dv[q];if(u>w){const t=u;u=w;w=t}t0=Math.max(t0,u);t1=Math.min(t1,w);if(t0>t1)ok=false}
   }
   if(ok&&(!best||t0<best.t))best={c,t:t0};
  }
 }
 return best;
}
/*PROPS-END*/
const TC={grass:[98,156,64],grass2:[120,164,62],dirt:[121,98,66],rock:[124,126,130],sand:[218,200,142]};for(const k in TC)TC[k]=TC[k].map(s2l);
function terrColor(wx,wz,h,ny,o,i){
 const v=.93+NZ(wx/5+300,wz/5)*.14,w=NZ(wx/23-90,wz/23+40),g=TC.grass,g2=TC.grass2,d=TC.dirt,rk=TC.rock,sd=TC.sand;
 const dt=sstep(.94,.85,ny),rt=sstep(.84,.72,ny),sa=sstep(SEA+1.4,SEA+.2,h)*(1-rt*.8);
 const lk=lakeInfo(wx,wz);let lsa=0,lw=1;if(lk){lsa=sstep(lk.wl+1.1,lk.wl+.1,h)*sstep(1.5,.9,lk.t);lw=1-.28*sstep(lk.wl+.3,lk.wl-.3,h)}   // margem/fundo de areia, mais escura molhada
 for(let c=0;c<3;c++){let x=g[c]+(g2[c]-g[c])*w;x+=(d[c]-x)*dt;x+=(sd[c]-x)*sa;x+=(rk[c]-x)*rt;x+=(sd[c]-x)*lsa;o[i+c]=x*v*lw}
}
/* Malha suave do terreno: 1 quad = 2 triângulos (diagonal igual à da colisão), normais por vértice. */
function buildTerrain(ch){
 const hv=ch.hv,ox=ch.cx*CS,oz=ch.cz*CS,V=CS+1,pos=new Float32Array(V*V*3),nor=new Float32Array(V*V*3),col=new Float32Array(V*V*3),idx=new Uint16Array(CS*CS*6);
 for(let z=0;z<V;z++)for(let x=0;x<V;x++){const i=z*V+x,k=(z+1)*HP+x+1,h=hv[k],gx=(hv[k-1]-hv[k+1])/2,gz=(hv[k-HP]-hv[k+HP])/2,l=Math.hypot(gx,1,gz);
  pos[i*3]=x;pos[i*3+1]=h;pos[i*3+2]=z;nor[i*3]=gx/l;nor[i*3+1]=1/l;nor[i*3+2]=gz/l;terrColor(ox+x,oz+z,h,1/l,col,i*3)}
 let n=0;for(let z=0;z<CS;z++)for(let x=0;x<CS;x++){const a=z*V+x,b=a+1,c=a+V,d=c+1;idx[n++]=a;idx[n++]=c;idx[n++]=b;idx[n++]=b;idx[n++]=c;idx[n++]=d}
 const uvs=new Float32Array(V*V*2);for(let z=0;z<V;z++)for(let x=0;x<V;x++){uvs[(z*V+x)*2]=(ox+x)/GRASS_TILE;uvs[(z*V+x)*2+1]=(oz+z)/GRASS_TILE}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));g.setAttribute('uv',new THREE.BufferAttribute(uvs,2));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setIndex(new THREE.BufferAttribute(idx,1));
 let mn=1e9,mx=-1e9;for(let i=1;i<pos.length;i+=3){if(pos[i]<mn)mn=pos[i];if(pos[i]>mx)mx=pos[i]}
 g.boundingBox=new THREE.Box3(new THREE.Vector3(0,mn,0),new THREE.Vector3(CS,mx,CS));g.boundingSphere=new THREE.Sphere(new THREE.Vector3(CS/2,(mn+mx)/2,CS/2),Math.hypot(CS/2,CS/2,(mx-mn)/2)+1);
 const m=new THREE.Mesh(g,terrMat);m.position.set(ox,0,oz);m.castShadow=false;m.receiveShadow=true;scene.add(m);return m;   // o chão só recebe sombra (não projeta em si mesmo → sem faixas de "shadow acne")
}

/* ---------- Água dos lagos: simulação de ondas (campo de alturas) + shader ----------
   Cada lago tem uma grade própria (equação da onda discreta): a altura h e a velocidade v de cada célula evoluem juntas, então
   marolas nascem, se espalham, refletem nas margens e morrem sozinhas. Nas partes rasas a onda anda mais devagar e perde energia
   (como na vida real). Chuva fraca de gotas faz o lago "respirar"; o jogador gera respingo ao entrar e esteira ao nadar/andar.
   A grade vira textura float (R=altura, G/B=inclinação, A=máscara de água) lida pelo shader (vértices + normais) e pela física. */
const SIM_DT=1/60,SIM_MAXN=160,SIM_RANGE=70,SIM_C=3.2;   // passo fixo (s), células por lado, alcance de atividade (m), velocidade da onda em água funda (m/s)
const sims=new Map(),lakeKey=L=>L.px.toFixed(1)+','+L.pz.toFixed(1);
const WSH={uTime:{value:0},uDay:{value:1},uLin:{value:0},uCam:{value:new THREE.Vector3()},uSun:{value:new THREE.Vector3(0,1,0)},uSunC:{value:new THREE.Color(1,.95,.86)},uSky:{value:new THREE.Color(.5,.7,.95)},uFogC:{value:new THREE.Color(.72,.86,.98)},uFogN:{value:60},uFogF:{value:150}};
const SIMGLSL=`vec4 simS(vec2 p){vec2 t=(p-uSimO)/uSimDx-.5,i=floor(t),f=fract(t),a=clamp(i,0.,uSimN-1.),b=clamp(i+1.,0.,uSimN-1.);
 vec4 s00=texture2D(uSim,(a+.5)/uSimN),s10=texture2D(uSim,(vec2(b.x,a.y)+.5)/uSimN),s01=texture2D(uSim,(vec2(a.x,b.y)+.5)/uSimN),s11=texture2D(uSim,(b+.5)/uSimN);
 return mix(mix(s00,s10,f.x),mix(s01,s11,f.x),f.y);}`;
const WVS=`precision highp sampler2D;attribute float dp;uniform sampler2D uSim;uniform float uSimN,uSimDx;uniform vec2 uSimO;varying vec3 vWP;varying float vDp;
 ${SIMGLSL}
 void main(){vec4 wp=modelMatrix*vec4(position,1.);wp.y+=simS(wp.xz).x*smoothstep(0.,.5,dp);vWP=wp.xyz;vDp=dp;gl_Position=projectionMatrix*viewMatrix*wp;}`;
const WFS=`precision highp sampler2D;uniform float uTime,uDay,uLin,uFogN,uFogF;uniform vec3 uCam,uSun,uSunC,uSky,uFogC;uniform sampler2D uSim;uniform float uSimN,uSimDx;uniform vec2 uSimO;varying vec3 vWP;varying float vDp;
 ${SIMGLSL}
 float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
 float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
 float wv(vec2 p){return vn(p*3.7-uTime*vec2(.28,.45))*.5+vn(p*8.1+uTime*vec2(.5,-.4))*.25;}   // só micro-detalhe; as ondas grandes vêm da simulação
 void main(){
  vec2 p=vWP.xz;vec4 s=simS(p);float e=.06,h0=wv(p);
  vec3 n=normalize(vec3(-s.y*6.-(wv(p+vec2(e,0.))-h0)*.5,1.,-s.z*6.-(wv(p+vec2(0.,e))-h0)*.5));
  vec3 V=normalize(uCam-vWP);if(V.y<0.){n.y=-n.y;}
  float fr=pow(1.-max(dot(n,V),0.),3.)*.75+.04;
  float dp=max(vDp,0.);
  vec3 col=mix(vec3(.32,.66,.62),vec3(.03,.2,.33),smoothstep(0.,3.6,dp));
  col*=1.+s.x*1.4;
  col=mix(col,uSky,fr);
  vec3 H=normalize(normalize(uSun)+V);
  col+=uSunC*pow(max(dot(n,H),0.),140.)*1.6*uDay;
  float foam=smoothstep(.1,.3,s.x)+smoothstep(.45,.9,length(s.yz))*.6;foam*=.55+.45*vn(p*6.+uTime*.7);
  float edge=1.-smoothstep(0.,.3,vDp);
  col=mix(col,vec3(1.),clamp(edge*.4*(.55+.45*vn(p*5.+uTime*.8))+foam*.8,0.,1.));
  col*=.14+.86*uDay;
  float a=(.5+.42*smoothstep(0.,2.6,dp)+fr*.25+foam*.3)*smoothstep(-.02,.42,vDp);
  float fg=smoothstep(uFogN,uFogF,distance(uCam,vWP));col=mix(col,uFogC,fg);
  if(uLin>.5)col=pow(col,vec3(2.2));
  gl_FragColor=vec4(col,clamp(a,0.,1.));}`;
function mkSim(L){
 const half=L.R*1.6+2,n=Math.min(SIM_MAXN,Math.ceil(half*2/.5)),dx=half*2/n,ox=L.px-half,oz=L.pz-half,N=n*n;
 const h=new Float32Array(N),v=new Float32Array(N),kk=new Float32Array(N),dmp=new Float32Array(N),data=new Float32Array(N*4);
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=ox+(i+.5)*dx,z=oz+(j+.5)*dx,id=j*n+i,d=lakeT(L,x,z)>1.3?-1:L.wl-groundH(x,z);
  if(d>.05&&i>0&&j>0&&i<n-1&&j<n-1){const k=Math.max(.12,Math.min(1,d/3));kk[id]=k;dmp[id]=k<.35?.982:.9975}}
 const tex=new THREE.DataTexture(data,n,n,THREE.RGBAFormat,THREE.FloatType);tex.minFilter=tex.magFilter=THREE.NearestFilter;tex.generateMipmaps=false;tex.needsUpdate=true;
 const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
  uniforms:{...WSH,uSim:{value:tex},uSimN:{value:n},uSimDx:{value:dx},uSimO:{value:new THREE.Vector2(ox,oz)}},vertexShader:WVS,fragmentShader:WFS});
 return{L,n,dx,ox,oz,half,h,v,kk,dmp,data,tex,mat,on:false,k0:Math.pow(2*SIM_DT*SIM_C/dx,2)};
}
function getSim(L){const k=lakeKey(L);let s=sims.get(k);if(!s){s=mkSim(L);sims.set(k,s)}return s}
function simStep(s){
 const{n,h,v,kk,dmp,k0}=s;
 for(let j=1;j<n-1;j++)for(let i=1;i<n-1;i++){const id=j*n+i,k=kk[id];if(!k)continue;const c=h[id];
  const l=kk[id-1]?h[id-1]:c,r=kk[id+1]?h[id+1]:c,u=kk[id-n]?h[id-n]:c,d=kk[id+n]?h[id+n]:c;   // margem = parede (reflete)
  v[id]=(v[id]+((l+r+u+d)*.25-c)*k0*k)*dmp[id]}
 for(let id=0,N=n*n;id<N;id++)h[id]+=v[id];
}
function simPack(s){
 const{n,h,kk,data,dx}=s,inv=1/(2*dx);
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const id=j*n+i,o=id*4;
  if(!kk[id]){data[o]=data[o+1]=data[o+2]=data[o+3]=0;continue}
  data[o]=h[id];data[o+1]=(h[id+1]-h[id-1])*inv;data[o+2]=(h[id+n]-h[id-n])*inv;data[o+3]=1}
 s.tex.needsUpdate=true;
}
/* empurra a superfície (amt<0 afunda, >0 sobe) numa mancha gaussiana de raio r (m) */
function simDrop(s,x,z,r,amt){
 const{n,dx,h,kk}=s,ci=(x-s.ox)/dx-.5,cj=(z-s.oz)/dx-.5,rr=r/dx,R=Math.ceil(rr*1.8);
 for(let j=Math.max(1,Math.floor(cj)-R);j<=Math.min(n-2,Math.ceil(cj)+R);j++)for(let i=Math.max(1,Math.floor(ci)-R);i<=Math.min(n-2,Math.ceil(ci)+R);i++){
  const id=j*n+i;if(!kk[id])continue;const d2=((i-ci)**2+(j-cj)**2)/(rr*rr);if(d2<3.2)h[id]+=amt*Math.exp(-d2)}
}
function simH(s,x,z){   // altura bilinear da onda (m) na posição de mundo
 const{n,dx,h}=s,t=(x-s.ox)/dx-.5,u=(z-s.oz)/dx-.5,i=Math.floor(t),j=Math.floor(u);if(i<0||j<0||i>=n-1||j>=n-1)return 0;
 const fx=t-i,fz=u-j,a=j*n+i;return(h[a]*(1-fx)+h[a+1]*fx)*(1-fz)+(h[a+n]*(1-fx)+h[a+n+1]*fx)*fz;
}
/* nível real da superfície (com a onda) ou -Infinity */
function waterSurf(x,z){const k=lakeInfo(x,z);if(!k||k.t>1.3||groundH(x,z)>=k.wl)return -Infinity;const s=sims.get(lakeKey(k.L));return k.wl+(s&&s.on?simH(s,x,z):0)}
const lakesNear=(x,z)=>{const cx=Math.floor(x/LAKE_CELL),cz=Math.floor(z/LAKE_CELL),a=[];for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const L=lakeParams(cx+i,cz+j);if(L&&Math.hypot(L.px-x,L.pz-z)<L.R*1.7+12)a.push(L)}return a};
function buildWater(ch){
 const ox=ch.cx*CS,oz=ch.cz*CS,ls=lakesNear(ox+CS/2,oz+CS/2);if(!ls.length)return null;
 const hv=ch.hv,V=CS+1,out=[];
 for(const L of ls){const pos=[],dpa=[],idx=[];
  for(let z=0;z<V;z++)for(let x=0;x<V;x++){pos.push(x,L.wl,z);dpa.push(L.wl-hv[(z+1)*HP+x+1])}
  for(let z=0;z<CS;z++)for(let x=0;x<CS;x++){const a=z*V+x,m=Math.max(dpa[a],dpa[a+1],dpa[a+V],dpa[a+V+1]);
   if(m<-.05||lakeT(L,ox+x+.5,oz+z+.5)>1.3)continue;idx.push(a,a+V,a+1,a+1,a+V,a+V+1)}
  if(!idx.length)continue;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('dp',new THREE.Float32BufferAttribute(dpa,1));g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx),1));g.computeBoundingSphere();g.boundingSphere.radius+=.6;
  const m=new THREE.Mesh(g,getSim(L).mat);m.position.set(ox,0,oz);m.castShadow=m.receiveShadow=false;m.renderOrder=3;scene.add(m);out.push(m)}
 return out.length?out:null;
}
/* O chão é uma superfície contínua; o grid de voxels (d) guarda só os blocos que o jogador coloca (nulo até existir algum). */
function gen(cx,cz){const hv=hvBuild(cx,cz);let d=null;const e=world.edits[cx+','+cz];if(e){d=new Uint8Array(CS*H*CS);for(const i in e)d[i]=e[i]}const props=genProps(cx,cz,hv);return{d,hv,cx,cz,props}}
function chunk(cx,cz){const k=ck(cx,cz);let c=world.chunks.get(k);if(!c){c=gen(cx,cz);world.chunks.set(k,c)}return c}
function getB(x,y,z){if(y<0||y>=H)return 0;const d=chunk(x>>4,z>>4).d;return d?d[(y*CS+(z&15))*CS+(x&15)]:0}
function groundH(x,z){const cx=Math.floor(x/CS),cz=Math.floor(z/CS);return hvAt(chunk(cx,cz).hv,x-cx*CS,z-cz*CS)}
function sup(x,z){const r=.3;let g=groundH(x,z),a=groundH(x-r,z);if(a>g)g=a;a=groundH(x+r,z);if(a>g)g=a;a=groundH(x,z-r);if(a>g)g=a;a=groundH(x,z+r);return a>g?a:g}
function setB(x,y,z,id){if(y<0||y>=H)return;const cx=x>>4,cz=z>>4,lx=x&15,lz=z&15,i=(y*CS+lz)*CS+lx;const ch0=chunk(cx,cz);if(!ch0.d)ch0.d=new Uint8Array(CS*H*CS);ch0.d[i]=id;const k=cx+','+cz;(world.edits[k]||(world.edits[k]={}))[i]=id;const rb=(a,b)=>{if(world.meshes.has(ck(a,b)))meshChunk(a,b)};rb(cx,cz);if(lx===0)rb(cx-1,cz);if(lx===15)rb(cx+1,cz);if(lz===0)rb(cx,cz-1);if(lz===15)rb(cx,cz+1)}

const FACES=[{d:[1,0,0],s:.88,c:[[1,1,1],[1,1,0],[1,0,1],[1,0,0]]},{d:[-1,0,0],s:.88,c:[[0,1,0],[0,1,1],[0,0,0],[0,0,1]]},{d:[0,1,0],s:1,c:[[0,1,0],[1,1,0],[0,1,1],[1,1,1]]},{d:[0,-1,0],s:.7,c:[[0,0,1],[1,0,1],[0,0,0],[1,0,0]]},{d:[0,0,1],s:.94,c:[[0,1,1],[1,1,1],[0,0,1],[1,0,1]]},{d:[0,0,-1],s:.94,c:[[1,1,0],[0,1,0],[1,0,0],[0,0,0]]}];
function meshChunk(cx,cz){const k=ck(cx,cz),old=world.meshes.get(k);if(old)dropMesh(old);world.col.delete(k);const ch=chunk(cx,cz),d=ch.d,ox=cx*CS,oz=cz*CS,pos=[],nor=[],uv=[],col=[],idx=[];for(let y=0;d&&y<H;y++)for(let z=0;z<CS;z++)for(let x=0;x<CS;x++){const b=d[(y*CS+z)*CS+x];if(!b)continue;const bl=BL[b];for(let f=0;f<6;f++){const F=FACES[f],dd=F.d,nx=x+dd[0],ny=y+dd[1],nz=z+dd[2];let nb;if(ny<0)continue;if(ny>=H)nb=0;else if(nx>=0&&nx<CS&&nz>=0&&nz<CS)nb=d[(ny*CS+nz)*CS+nx];else nb=getB(ox+nx,ny,oz+nz);if(nb)continue;const t=f===2?bl.t:f===3?bl.b:bl.s,u0=t/NT+.001,u1=(t+1)/NT-.001,base=pos.length/3;for(let q=0;q<4;q++){const c=F.c[q];pos.push(x+c[0],y+c[1],z+c[2]);nor.push(dd[0],dd[1],dd[2]);col.push(F.s,F.s,F.s);uv.push(q%2?u1:u0,q<2?1:0)}idx.push(base,base+2,base+1,base+1,base+2,base+3)}}let m=null;if(idx.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(nor),3));g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(uv),2));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(col),3));g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx),1));m=new THREE.Mesh(g,chunkMat);m.position.set(ox,0,oz);m.castShadow=m.receiveShadow=true;scene.add(m)}const pp=buildProps(ch),tm=buildTerrain(ch),wm=buildWater(ch);world.meshes.set(k,{m,pm:pp.pm,bm:pp.bm,lm:pp.lm,tier:pp.tier,tm,wm,cx,cz})}
function clearWorld(){for(const v of world.meshes.values())dropMesh(v);world.meshes.clear();world.chunks.clear();world.col.clear()}
function initWorld(w){clearWorld();world.seed=w.seed;world.edits=w.edits;NZ=mkNoise(w.seed);H0=null;lakeCache.clear();for(const q of sims.values()){q.tex.dispose();q.mat.dispose()}sims.clear()}
const OFF=[];for(let a=-12;a<=12;a++)for(let b=-12;b<=12;b++)OFF.push([a,b,a*a+b*b]);OFF.sort((p,q)=>p[2]-q[2]);
function stream(pcx,pcz,rad,lim){let n=0;const r2=rad*rad+1;for(const o of OFF){if(o[2]>r2)break;const cx=pcx+o[0],cz=pcz+o[1];if(!world.meshes.has(ck(cx,cz))){meshChunk(cx,cz);if(++n>=lim)break}}const u=(rad+2)*(rad+2);let rl=1;for(const[k,v]of world.meshes){if((v.cx-pcx)**2+(v.cz-pcz)**2>u){dropMesh(v);world.col.delete(k);world.meshes.delete(k)}else if(rl&&v.tier!==treeTier(v.cx,v.cz,v.tier)){rl=0;meshChunk(v.cx,v.cz)}}}


/* ---------- Água: uniforms por frame e efeito de câmera submersa ---------- */
const WU=WSH,_wc=new THREE.Color(),uwEl=$('#uw');let wTime=0,uwFog=null;
const toDisp=(c,o,lin)=>{o.copy(c);if(lin){o.r=Math.pow(o.r,1/2.2);o.g=Math.pow(o.g,1/2.2);o.b=Math.pow(o.b,1/2.2)}return o};
/* Atividade das simulações: só os lagos perto da câmera rodam (os outros ficam planos e parados) */
let simAcc=0;const pw={in:false,vy:0};
function updateSims(dt){
 simAcc=Math.min(simAcc+dt,SIM_DT*3);let steps=0;while(simAcc>=SIM_DT){simAcc-=SIM_DT;steps++}
 for(const s of sims.values()){
  const near=Math.hypot(cam.position.x-s.L.px,cam.position.z-s.L.pz)<s.half+SIM_RANGE;
  if(near){
   if(!s.on){s.on=true;for(let q=0;q<6;q++)simDrop(s,s.ox+Math.random()*s.half*2,s.oz+Math.random()*s.half*2,1.4,-.03)}
   if(Math.random()<dt*14)simDrop(s,s.ox+Math.random()*s.half*2,s.oz+Math.random()*s.half*2,.7+Math.random()*.8,-(.012+Math.random()*.03))   // gotas / vento
   for(let i=0;i<steps;i++)simStep(s);simPack(s)}
  else if(s.on){s.on=false;s.h.fill(0);s.v.fill(0);simPack(s)}
 }
}
/* Jogador mexe na água: respingo ao entrar (proporcional à velocidade de queda) e esteira enquanto se move */
function playerWake(dt){
 const x=P.p.x,z=P.p.z,k=lakeInfo(x,z),s=k&&k.t<=1.3?sims.get(lakeKey(k.L)):null;
 const wd=s?k.wl-P.p.y:-1,inW=!!s&&s.on&&wd>.05&&groundH(x,z)<k.wl;
 if(inW){const spd=Math.hypot(P.vel.x,P.vel.z);
  if(!pw.in)simDrop(s,x,z,1.3,-cl(.07+Math.abs(Math.min(0,pw.vy))*.045+spd*.02,.08,.5));
  else if(spd>.3||Math.abs(P.vel.y)>.5)simDrop(s,x-P.vel.x*.05,z-P.vel.z*.05,.9,-cl((spd*.22+Math.abs(P.vel.y)*.1)*cl(wd,0,1)*dt,0,.06))}
 else pw.vy=P.vel.y;
 pw.in=inW;
}
function updateWater(dt){
 updateSims(dt);wTime+=dt;const lin=!!(post.bloomActive&&post.bloomActive()),sl=post.sunLight,su=post.skyDome.material.uniforms;
 WU.uTime.value=wTime;WU.uCam.value.copy(cam.position);WU.uLin.value=lin?1:0;
 WU.uSun.value.copy(sl.position).sub(cam.position).normalize();WU.uSunC.value.copy(sl.color);WU.uDay.value=cl(sl.intensity/1.1,.06,1);
 _wc.copy(su.topColor.value).lerp(su.bottomColor.value,.45);toDisp(_wc,WU.uSky.value,lin);
 toDisp(su.bottomColor.value,WU.uFogC.value,lin);
 if(scene.fog){WU.uFogN.value=uwFog?.5:scene.fog.near;WU.uFogF.value=uwFog?28:scene.fog.far}
 const under=cam.position.y<waterSurf(cam.position.x,cam.position.z)-.03;
 if(uwEl)uwEl.style.opacity=under?1:0;
 if(scene.fog){
  if(under){if(!uwFog)uwFog={n:scene.fog.near,f:scene.fog.far};scene.fog.near=.5;scene.fog.far=28;scene.fog.color.setRGB(.07,.3,.42).multiplyScalar(WU.uDay.value)}
  else if(uwFog){scene.fog.near=uwFog.n;scene.fog.far=uwFog.f;uwFog=null}
 }
}

/* ---------- Jogador ---------- */
const MAXHP=100,MAXST=50,FALL_DMG=15,ST_DRAIN=3,ST_REGEN=5;   // vida máx., estamina máx., dano de queda, gasto/s ao correr, recuperação/s
const P={p:new THREE.Vector3(),vel:new THREE.Vector3(),yaw:0,pitch:0,og:false,hp:MAXHP,st:MAXST,peak:0,hpT:0,landV:0};
let sprintTog=false,stLock=false,stIdle=0,stVis=0,isSprint=false;
let spawn=[.5,30,.5],cur=null,state='menu',tp3=false,breaking=false,mining=false,swT=0,prog=0,tgtKey='',hit=null,phit=null,bobT=0,jumpHeld=false,saveT=0;
const keys={},joy={x:0,y:0};let rmbDown=false,rmbT=0,rmbMoved=0;

/* ---------- HUD ---------- */
const hud=$('#hud');
const healthFill=$('#health-fill'),healthText=$('#health-text');
function refreshHealth(){const pct=Math.max(0,P.hp)/MAXHP*100;healthFill.style.width=pct+'%';healthFill.classList.toggle('low',pct<=50&&pct>25);healthFill.classList.toggle('critical',pct<=25);healthText.textContent=Math.max(0,Math.ceil(P.hp))+' / '+MAXHP;}
const stFill=$('#stamina-fill'),stBar=$('#stamina-bar'),stText=$('#stamina-text'),bSprint=$('#bSprint');let stShown=-1;
function updateStamina(run,dt){stVis=run?1.5:Math.max(0,stVis-dt);stFill.style.width=(P.st/MAXST*100)+'%';const sv=Math.ceil(P.st);if(sv!==stShown){stShown=sv;stText.textContent=sv+' / '+MAXST}stBar.classList.toggle('show',stVis>0);bSprint.classList.toggle('on',run)}

const hudShow=v=>hud.classList.toggle('hidden',!v);

/* ---------- Animação customizada ---------- */
let playingAnim=null,animTime=0;
function playAnimByIndex(i){const anims=ld('bc.anims',[]);if(!anims[i]){toast('Nenhuma animação no slot F'+(i+1));return}playingAnim=anims[i];animTime=0;toast('▶ '+anims[i].name);}

/* ---------- Configurações ---------- */
function applyAll(){
 cam.fov=S.fov;
 post.apply(Math.max(S.dist,3)*CS);
 $('#fps').classList.toggle('hidden',!S.fps);
 tp3=S.camMode===1;
 if(!S.lockMouse&&document.pointerLockElement&&document.exitPointerLock)document.exitPointerLock();
 $('#c').style.cursor=(!touch&&!S.lockMouse)?'crosshair':'';

 if(lastHdTex!==S.hdTex||lastHQ!==HQ()){
  lastHdTex=S.hdTex;lastHQ=HQ();
  buildAtlas(S.hdTex);
  const all=[];
  for(const[k,v]of world.meshes) all.push([v.cx,v.cz]);
  for(const[cx,cz]of all) meshChunk(cx,cz);
  refreshHealth();
 }
}
let setBack='title';
const SS=mkScreen('settings','Configurações'),sg=E('div','grid',null,SS);
function slider(label,key,min,max){const d=E('div','btn sl',null,sg),i=E('i','',null,d),sp=E('span','',null,d),inp=E('input','',null,d);d.style.textAlign='center';inp.type='range';inp.min=min;inp.max=max;inp.value=S[key];const upd=()=>{sp.textContent=label+': '+S[key];d.style.setProperty('--p',(S[key]-min)/(max-min))};upd();inp.oninput=()=>{S[key]=+inp.value;upd();st('bc.s',S);applyAll()}}
function cycle(label,key,names){const b=B('',()=>{S[key]=(S[key]+1)%names.length;upd();st('bc.s',S);applyAll()},sg),upd=()=>b.textContent=label+': '+names[S[key]];upd()}
const OF=['Não','Sim'];
slider('Campo de visão','fov',50,110);slider('Distância (chunks)','dist',2,10);slider('Sensibilidade','sens',20,200);slider('Brilho','bright',0,100);
cycle('Sombras','shadow',['Desligadas','Médias','Altas']);
cycle('Tone mapping','tone',['Nenhum','Linear','Reinhard','Cineon','ACES']);
cycle('Texturas HD','hdTex',OF);
cycle('Bloom','bloom',OF);cycle('Névoa volumétrica','vfog',['Desligada','Normal','Alta']);
cycle('Resolução alta','fancy',OF);cycle('Mostrar FPS','fps',OF);cycle('Inverter eixo Y','invert',OF);cycle('Balanço da câmera','bob',OF);cycle('Vinheta','vig',OF);
cycle('Câmera','camMode',['1ª pessoa','3ª pessoa']);cycle('Travar mouse (lock on)','lockMouse',OF);

B('Animações',()=>{updateCatTabs();renderAnims();go('anims')},SS);

B('Restaurar padrão',()=>{Object.assign(S,DEF);st('bc.s',S);applyAll();location.reload()},SS);
B('Voltar',()=>go(setBack),SS);
const openSettings=b=>{setBack=b;go('settings')};

/* ---------- Mundos ---------- */
let WL=ld('bc.w2',[]),selW=null;
const SPL=['Agora com blocos!','Quebre tudo!','Mundo infinito*','Feito para caos','Construa alto!','100% pixelado'];
const TS=mkScreen('title',null,'title');
E('div','blob blob-1',null,TS);E('div','blob blob-2',null,TS);E('div','blob blob-3',null,TS);
const lw=E('div','lw',null,TS),lg=E('div','logo',null,lw);E('span','','OPEN WORLD',lg);E('span','m','MAYHEM',lg);
E('div','ed','EDIÇÃO BLOCOS',lw);E('div','splash',SPL[Math.random()*SPL.length|0],lw);
B('Jogar',()=>{selW=null;renderWL();go('worlds')},TS);B('Criador de skin',()=>skin.open('title'),TS);B('Configurações',()=>openSettings('title'),TS);
const ft=E('div','foot',null,TS);E('span','','Open World Mayhem',ft);E('span','',touch?'Toque para jogar':'WASD • Espaço • F1-F4',ft);

const WS=mkScreen('worlds','Mundos'),wlist=E('div','list',null,WS),wrow=E('div','row',null,WS);
const bPlay=B('Jogar mundo',()=>{const w=WL.find(x=>x.id===selW);if(w)startWorld(w)},wrow),bDel=B('Apagar',()=>{WL=WL.filter(x=>x.id!==selW);selW=null;st('bc.w2',WL);renderWL()},wrow);
B('Criar novo mundo',()=>{nName.value='Meu mundo '+(WL.length+1);nSeed.value='';go('new')},WS);B('Voltar',()=>go('title'),WS);
function renderWL(){wlist.textContent='';if(!WL.length)E('div','dsc','Nenhum mundo ainda. Crie um!',wlist);WL.forEach(w=>{const d=E('div','w'+(w.id===selW?' on':''),null,wlist),t=E('div','',null,d);E('p','',w.name,t);E('p','','Semente '+w.seed+' • '+new Date(w.t).toLocaleDateString('pt-BR'),t);d.onclick=()=>{selW=w.id;renderWL()}});bPlay.disabled=bDel.disabled=selW==null}
const NS=mkScreen('new','Novo mundo'),nName=fld('Nome do mundo',NS),nSeed=fld('Semente (opcional)',NS);
B('Criar',()=>{const sd=nSeed.value.trim(),w={id:Date.now(),name:nName.value.trim()||'Meu mundo',seed:sd?(/^-?\d+$/.test(sd)?+sd|0:hash(sd)):(Math.random()*1e9|0),edits:{},pos:null,hp:MAXHP,hpv:2,t:Date.now()};WL.unshift(w);st('bc.w2',WL);startWorld(w)},NS);B('Voltar',()=>go('worlds'),NS);

/* ---------- Loading / pausa ---------- */
const LS=mkScreen('loading','Carregando mundo');E('i','',E('div','pg',null,LS));
function startWorld(w){cur=w;initWorld(w);state='loading';hudShow(false);go('loading');for(const k in w.edits)if(k[0]!=='p')delete w.edits[k];P.hp=(w.hp&&w.hpv===2)?w.hp:MAXHP;P.st=MAXST;sprintTog=false;stLock=false;stIdle=0;stVis=0;P.vel.set(0,0,0);P.og=false;P.landV=0;tp3=S.camMode===1;breaking=false;prog=0;playingAnim=null;spawn=[.5,hgt(0,0)+3,.5];if(w.pos){P.p.set(w.pos[0],w.pos[1],w.pos[2]);P.yaw=w.pos[3];P.pitch=w.pos[4]}else{P.p.set(spawn[0],spawn[1],spawn[2]);P.yaw=P.pitch=0}P.peak=P.p.y;const pc=P.p.x>>4,pz=P.p.z>>4,need=OFF.filter(o=>o[2]<=5).reverse();const step=()=>{if(state!=='loading')return;let n=0;while(need.length&&n++<4){const o=need.pop();meshChunk(pc+o[0],pz+o[1])}need.length?requestAnimationFrame(step):beginPlay()};step()}
function lock(){if(!touch&&S.lockMouse){const p=$('#c').requestPointerLock&&$('#c').requestPointerLock();if(p&&p.catch)p.catch(()=>{})}}
function beginPlay(){state='play';{const g=sup(P.p.x,P.p.z);if(P.p.y<g||P.p.y>g+8)P.p.y=g+.02;P.peak=P.p.y}unstuck();go('');hudShow(true);applyAll();refreshHealth();saveT=0;lock();if(!touch)toast(S.lockMouse?'Clique na tela se o mouse não travar':'Mouse livre: botão direito + arrastar gira a câmera')}
function saveWorld(){if(!cur)return;cur.pos=[P.p.x,P.p.y,P.p.z,P.yaw,P.pitch];cur.hp=P.hp;cur.hpv=2;cur.t=Date.now();st('bc.w2',WL)}
const PS=mkScreen('pause','Pausado','dim');
B('Continuar',resume,PS);B('Criador de skin',()=>skin.open('pause'),PS);B('Configurações',()=>openSettings('pause'),PS);B('Salvar e sair',()=>{saveWorld();cur=null;hudShow(false);showMenu()},PS);
function pause(){if(state!=='play')return;state='pause';breaking=false;mining=false;saveWorld();if(document.exitPointerLock)document.exitPointerLock();go('pause')}
function resume(){state='play';go('');lock()}
function showMenu(){state='menu';initWorld({seed:Math.random()*1e9|0,edits:{}});go('title');applyAll()}

/* ---------- Tela de animações ---------- */
let curCat='Idle',selAnim=-1;
const AS=mkScreen('anims','Animações','dim');
const catTabs=E('div','cat-tabs',null,AS);
const catBtns={};
CATS.forEach(c=>{const b=B(c,()=>{curCat=c;updateCatTabs();renderAnims()},catTabs,'tab');catBtns[c]=b});
function updateCatTabs(){Object.entries(catBtns).forEach(([k,b])=>b.classList.toggle('on',k===curCat))}
const aList=E('div','list',null,AS),aRow=E('div','row',null,AS);
const aPlay=B('Tocar',()=>{if(selAnim<0)return;const anims=ld('bc.anims',[]),a=anims[selAnim];if(!a)return;playingAnim=a;animTime=0;state='play';go('');lock();},aRow);
const aEdit=B('Editar',()=>{if(selAnim>=0)openAnimEditor(selAnim,curCat)},aRow);
const aDel=B('Apagar',()=>{if(selAnim<0)return;const a=ld('bc.anims',[]);a.splice(selAnim,1);st('bc.anims',a);selAnim=-1;renderAnims()},aRow);
B('Nova animação',()=>openAnimEditor(-1,curCat),AS);B('Voltar',()=>go('settings'),AS);
function renderAnims(){aList.textContent='';const anims=ld('bc.anims',[]);const filtered=anims.map((a,i)=>({a,i})).filter(x=>x.a.category===curCat);if(!filtered.length)E('div','dsc','Nenhuma animação em "'+curCat+'"',aList);filtered.forEach(({a,i})=>{const d=E('div','w'+(i===selAnim?' on':''),null,aList),t=E('div','',null,d);E('p','',a.name,t);E('p','','Duração: '+a.duration.toFixed(1)+'s',t);d.onclick=()=>{selAnim=i;renderAnims()}});aPlay.disabled=aEdit.disabled=aDel.disabled=selAnim<0}
function openAnimEditor(index,cat){state='animedit';OWM.animedit.open(index,cat)}
OWM.animedit.onClose=(savedCat)=>{if(savedCat){curCat=savedCat;updateCatTabs()}state='pause';go('anims');renderAnims();anim.reloadIdle()};


/* ---------- Entrada ---------- */
addEventListener('keydown',e=>{keys[e.code]=true;if(state==='play'){if(e.code==='Escape')pause();else if(e.code==='KeyV'){S.camMode=(S.camMode+1)%2;tp3=S.camMode===1;st('bc.s',S)}else if(/^F[1-4]$/.test(e.code)){e.preventDefault();playAnimByIndex(+e.code[1]-1)}if(e.code==='Space')e.preventDefault();}});
addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;breaking=false;jumpHeld=false;rmbDown=false;sprintTog=false});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&state==='play'&&!touch&&S.lockMouse)pause()});
addEventListener('mousemove',e=>{if(state!=='play'||touch)return;if(document.pointerLockElement)look(e.movementX,e.movementY,.0022);else if(!S.lockMouse&&rmbDown){rmbMoved+=Math.abs(e.movementX)+Math.abs(e.movementY);look(e.movementX,e.movementY,.0022)}});
function look(dx,dy,k){const s=k*S.sens/100;P.yaw-=dx*s;P.pitch=cl(P.pitch-dy*s*(S.invert?-1:1),-1.55,1.55)}
addEventListener('mousedown',e=>{if(state!=='play'||touch)return;if(e.target.closest&&e.target.closest('#hud button'))return;if(S.lockMouse&&!document.pointerLockElement){lock();return}if(e.button===0)breaking=true;else if(e.button===2){if(!S.lockMouse){rmbDown=true;rmbT=performance.now();rmbMoved=0;$('#c').style.cursor='none'}}});
addEventListener('mouseup',e=>{if(e.button===0)breaking=false;if(e.button===2&&rmbDown){rmbDown=false;$('#c').style.cursor=S.lockMouse?'':'crosshair';}});
addEventListener('contextmenu',e=>e.preventDefault());

if(touch){let lid=null,lx=0,ly=0,jid=null;const joyE=$('#joy'),knob=$('#knob'),lk=$('#look');const tch=(e,id)=>[...e.changedTouches].find(t=>t.identifier===id);lk.addEventListener('touchstart',e=>{if(lid!=null)return;const t=e.changedTouches[0];lid=t.identifier;lx=t.clientX;ly=t.clientY;e.preventDefault()},{passive:false});lk.addEventListener('touchmove',e=>{const t=tch(e,lid);if(!t)return;if(state==='play')look(t.clientX-lx,t.clientY-ly,.005);lx=t.clientX;ly=t.clientY;e.preventDefault()},{passive:false});const lend=e=>{if(tch(e,lid))lid=null};lk.addEventListener('touchend',lend);lk.addEventListener('touchcancel',lend);const jm=t=>{const r=joyE.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=t.clientX-cx,dy=t.clientY-cy;const l=Math.hypot(dx,dy);if(l>50){dx*=50/l;dy*=50/l}joy.x=dx/50;joy.y=dy/50;knob.style.left=41+dx+'px';knob.style.top=41+dy+'px'};joyE.addEventListener('touchstart',e=>{const t=e.changedTouches[0];jid=t.identifier;jm(t);e.preventDefault()},{passive:false});joyE.addEventListener('touchmove',e=>{const t=tch(e,jid);if(t)jm(t);e.preventDefault()},{passive:false});const jend=e=>{if(tch(e,jid)){jid=null;joy.x=joy.y=0;knob.style.left=knob.style.top='41px'}};joyE.addEventListener('touchend',jend);joyE.addEventListener('touchcancel',jend);const hold=(id,on,off)=>{const b=$(id);b.addEventListener('touchstart',e=>{on();e.preventDefault()},{passive:false});b.addEventListener('touchend',off);b.addEventListener('touchcancel',off)};hold('#bJump',()=>jumpHeld=true,()=>jumpHeld=false);$('#bPause').onclick=pause;$('#bSprint').addEventListener('touchstart',e=>{sprintTog=!sprintTog;e.preventDefault()},{passive:false});}

/* ---------- Física ---------- */
function hitsObj(x,y,z){for(let ix=Math.floor(x-.3);ix<=Math.floor(x+.3);ix++)for(let iz=Math.floor(z-.3);iz<=Math.floor(z+.3);iz++)for(let iy=Math.floor(y);iy<=Math.floor(y+1.79);iy++)if(getB(ix,iy,iz))return true;return propHits(x,y,z)}
/* Terreno: al = quanto o chão pode subir à frente do pé (degrau/inclinação). Eixo Y não tem tolerância. */
function hits(x,y,z,al){return sup(x,z)>y+(al||0)||hitsObj(x,y,z)}
function moveAxis(ax,d){if(!d)return false;const p=P.p,o=p[ax],al=ax==='y'?0:.04+Math.abs(d)*1.5;p[ax]=o+d;if(!hits(p.x,p.y,p.z,al))return false;let a=0,b=d;for(let i=0;i<8;i++){const m=(a+b)/2;p[ax]=o+m;if(hits(p.x,p.y,p.z,al))b=m;else a=m}p[ax]=o+a;return true}
function physics(dt){let mx=(keys.KeyD?1:0)-(keys.KeyA?1:0)+joy.x,mz=(keys.KeyS?1:0)-(keys.KeyW?1:0)+joy.y;const l=Math.hypot(mx,mz);if(l>1){mx/=l;mz/=l}if(l<.1)sprintTog=false;if(P.st<=0)stLock=true;else if(P.st>=5)stLock=false;if(stLock)sprintTog=false;
const wLv=waterSurf(P.p.x,P.p.z),wd=wLv-P.p.y,swim=wd>.75;   // wd = quanto os pés estão abaixo da superfície; nada com a água acima da cintura
const sprinting=(keys.ShiftLeft||keys.ShiftRight||sprintTog)&&l>=.1&&!stLock&&P.st>0;
if(sprinting){P.st=Math.max(0,P.st-ST_DRAIN*dt);stIdle=0}else{stIdle+=dt;if(stIdle>1)P.st=Math.min(MAXST,P.st+ST_REGEN*dt)}
isSprint=sprinting;updateStamina(sprinting,dt);
const sp=(sprinting?6.2:4.3)*(swim?.6:wd>0?.85:1);const c=Math.cos(P.yaw),s=Math.sin(P.yaw),tx=(c*mx+s*mz)*sp,tz=(-s*mx+c*mz)*sp;const accel=swim?6:P.og?(l>0?18:22):4;const k=1-Math.exp(-dt*accel);P.vel.x+=(tx-P.vel.x)*k;P.vel.z+=(tz-P.vel.z)*k;if((keys.Space||jumpHeld)&&P.og&&!swim){P.vel.y=8.4;P.og=false}
if(swim){let tv=cl((wLv-1.1-P.p.y)*3,-2.5,2.5);if(keys.Space||jumpHeld)tv=3.2;else if(stLock)tv=-.8;P.vel.y+=(tv-P.vel.y)*(1-Math.exp(-dt*(P.vel.y<-3?9:4)));P.peak=P.p.y}   // flutua com a cabeça fora; pulo = braçada pra cima; sem dano de queda na água
const n=Math.ceil(dt/.016),sd=dt/n;for(let i=0;i<n;i++){if(!swim)P.vel.y=Math.max(-32,P.vel.y-26*sd);if(moveAxis('x',P.vel.x*sd))P.vel.x=0;if(moveAxis('z',P.vel.z*sd))P.vel.z=0;{const q=P.p,sg=sup(q.x,q.z);if(sg>q.y){if(!hitsObj(q.x,sg,q.z))q.y=sg}else if(P.og&&P.vel.y<=0&&q.y-sg<.36)q.y=sg}const was=P.og,dy=P.vel.y*sd;if(moveAxis('y',dy)){if(dy<0){P.og=true;if(!was){P.landV=-P.vel.y;const fd=P.peak-P.p.y;if(fd>3.4){hurt(FALL_DMG);addTrauma(Math.min(0.6,fd*0.08))}}P.peak=P.p.y}P.vel.y=0}else{P.og=false;P.peak=Math.max(P.peak,P.p.y)}}if(P.og||swim)P.peak=P.p.y;if(P.p.y<-20)hurt(MAXHP);P.hpT+=dt;if(P.hp<MAXHP&&P.hpT>.6){P.hp++;P.hpT=0;refreshHealth()}}
function hurt(n){P.hp-=n;P.hpT=0;addTrauma(0.5);if(anim.hit)anim.hit(Math.min(1,n/8+.25));if(P.hp<=0){P.hp=MAXHP;P.st=MAXST;P.p.set(spawn[0],spawn[1],spawn[2]);P.vel.set(0,0,0);P.peak=P.p.y;toast('Você morreu!')}refreshHealth()}

/* ---------- Raio ---------- */
function rayB(o,d,max){let x=Math.floor(o.x),y=Math.floor(o.y),z=Math.floor(o.z);const sx=Math.sign(d.x),sy=Math.sign(d.y),sz=Math.sign(d.z),dx=d.x?Math.abs(1/d.x):Infinity,dy=d.y?Math.abs(1/d.y):Infinity,dz=d.z?Math.abs(1/d.z):Infinity;let tx=d.x>0?(x+1-o.x)*dx:d.x<0?(o.x-x)*dx:Infinity,ty=d.y>0?(y+1-o.y)*dy:d.y<0?(o.y-y)*dy:Infinity,tz=d.z>0?(z+1-o.z)*dz:d.z<0?(o.z-z)*dz:Infinity,t=0,n=[0,0,0];while(t<=max){if(y>=0&&y<H&&getB(x,y,z))return{x,y,z,n,t};if(tx<ty&&tx<tz){x+=sx;t=tx;tx+=dx;n=[-sx,0,0]}else if(ty<tz){y+=sy;t=ty;ty+=dy;n=[0,-sy,0]}else{z+=sz;t=tz;tz+=dz;n=[0,0,-sz]}}return null}
function ray(o,d,max){const b=rayB(o,d,max),tm=b?b.t:max;let pv=0;
 for(let t=.2;t<=tm;t+=.2){if(o.y+d.y*t<groundH(o.x+d.x*t,o.z+d.z*t)){let a=pv,c=t;for(let i=0;i<8;i++){const m=(a+c)/2;if(o.y+d.y*m<groundH(o.x+d.x*m,o.z+d.z*m))c=m;else a=m}
   return{terr:true,x:Math.floor(o.x+d.x*c),y:Math.floor(o.y+d.y*c),z:Math.floor(o.z+d.z*c),n:[0,0,0],t:c}}pv=t}
 return b}
function breakAt(h){const b=getB(h.x,h.y,h.z);setB(h.x,h.y,h.z,0);spawnBreakParticles(h.x,h.y,h.z,b);addTrauma(0.35)}
function breakProp(c){
 const key='p'+c.cx+','+c.cz,rem=world.edits[key]||(world.edits[key]={});rem[c.id]=1;
 const rock=c.k==='rock'||c.k==='bigrock';
 spawnBreakParticles(Math.floor(c.x),Math.floor(c.y0+Math.min(c.hy,2)/2),Math.floor(c.z),rock?3:5);
 addTrauma(rock?.4:.3);meshChunk(c.cx,c.cz);
}
function unstuck(){if(!hits(P.p.x,P.p.y,P.p.z))return;for(let r=1;r<=8;r++)for(let a=0;a<8;a++){const x=P.p.x+Math.cos(a*.785)*r,z=P.p.z+Math.sin(a*.785)*r;if(!hits(x,P.p.y,z)){P.p.x=x;P.p.z=z;return}}for(let i=0;i<H&&hits(P.p.x,P.p.y,P.p.z);i++)P.p.y++}

/* ---------- Loop ---------- */
const eye=new THREE.Vector3(),fwd=new THREE.Vector3();let ma=0,fc=0,ft0=performance.now();
function tick(dt){physics(dt);playerWake(dt);eye.set(P.p.x,P.p.y+1.62,P.p.z);const cp=Math.cos(P.pitch);fwd.set(-Math.sin(P.yaw)*cp,Math.sin(P.pitch),-Math.cos(P.yaw)*cp);hit=ray(eye,fwd,REACH);phit=rayProp(eye,fwd,REACH);if(phit&&hit&&hit.t<phit.t)phit=null;else if(phit)hit=null;
if(breaking&&phit){const c=phit.c,key='p'+c.cx+','+c.cz+','+c.id;if(key!==tgtKey){tgtKey=key;prog=0}prog+=dt;mining=true;const stage=Math.min(9,Math.floor(prog/c.hard*10)),ch=Math.min(c.hy,2.2);crackMesh.visible=true;crackMesh.scale.set(c.hx*2+.06,ch,c.hz*2+.06);crackMesh.position.set(c.x,c.y0+ch/2,c.z);if(crackMat.map!==crackTextures[stage]){crackMat.map=crackTextures[stage];crackMat.needsUpdate=true}if(prog>=c.hard){breakProp(c);prog=0;tgtKey='';crackMesh.visible=false}}
else if(breaking&&hit&&!hit.terr&&hit.y>0){const key=hit.x+','+hit.y+','+hit.z;if(key!==tgtKey){tgtKey=key;prog=0}prog+=dt;mining=true;const hard=BL[getB(hit.x,hit.y,hit.z)].h;const stage=Math.min(9,Math.floor((prog/hard)*10));crackMesh.visible=true;crackMesh.scale.set(1,1,1);crackMesh.position.set(hit.x+.5,hit.y+.5,hit.z+.5);if(crackMat.map!==crackTextures[stage]){crackMat.map=crackTextures[stage];crackMat.needsUpdate=true}if(prog>=hard){breakAt(hit);prog=0;tgtKey=''}}else{mining=false;prog=0;tgtKey='';crackMesh.visible=false}if(mining)swT+=dt*12;const sp=Math.hypot(P.vel.x,P.vel.z);bobT+=sp*dt*1.7;if(playingAnim){animTime+=dt;if(animTime>playingAnim.duration){playingAnim=null;animTime=0}}if(tp3){let t=0;while(t<3.5){const q=t+.25,x=eye.x-fwd.x*q,y=eye.y-fwd.y*q,z=eye.z-fwd.z*q;if(getB(Math.floor(x),Math.floor(y),Math.floor(z))||y<groundH(x,z)+.15)break;t=q}cam.position.set(eye.x-fwd.x*t,eye.y-fwd.y*t,eye.z-fwd.z*t);}else{cam.position.copy(eye);cam.position.y+=anim.fx.dip;if(S.bob&&P.og){const bA=Math.min(1,sp/4.5);cam.position.y+=Math.sin(bobT*2)*0.012*bA;cam.position.x+=Math.cos(bobT)*0.008*bA}}cam.rotation.set(P.pitch,P.yaw,tp3?0:anim.fx.roll);const targetFov=S.fov+(sp>5?6:0);cam.fov+=(targetFov-cam.fov)*(1-Math.exp(-dt*8));cam.updateProjectionMatrix();updateCamShake(dt);anim.update(dt,{inGame:true,sprint:isSprint,tp3,p:P.p,vel:P.vel,og:P.og,mining,swT,cp:P.pitch,landV:P.landV,custom:playingAnim?{anim:playingAnim,time:animTime}:null});P.landV=0;updateParticles(dt);post.setGround(groundH(P.p.x,P.p.z));post.update(dt);updateWater(dt);if((saveT+=dt)>20){saveT=0;saveWorld()}stream(P.p.x>>4,P.p.z>>4,S.dist,2);}

let last=performance.now();
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;if(state==='play'){tick(dt)}else if(state==='menu'){ma+=dt*.08;const h=hgt(0,0);cam.position.set(Math.cos(ma)*26,h+16,Math.sin(ma)*26);cam.lookAt(0,h-2,0);anim.update(dt,{inGame:false});post.setGround(h);post.update(dt);stream(0,0,4,2);}else if(state==='pause'){stream(P.p.x>>4,P.p.z>>4,S.dist,1);post.update(dt)}if(state!=='animedit'){post.render();}else{if(OWM.animedit)OWM.animedit.tick(dt);}if(++fc>=30){const t=performance.now();if(S.fps)$('#fps').textContent=Math.round(fc*1000/(t-ft0))+' FPS';fc=0;ft0=t}}
addEventListener('beforeunload',saveWorld);
applyAll();showMenu();requestAnimationFrame(loop);
})();