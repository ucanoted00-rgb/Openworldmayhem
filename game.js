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
/* ---------- Bioma de deserto ----------
   Peso do deserto (0..1) em (x,z): função pura da semente, sem costura entre chunks. Grandes manchas (~DES_SCALE m) vindas de ruído de baixa
   frequência; nunca perto do spawn (DES_CLEAR_A..B m). Dentro (peso >= HEAT_THR) o jogador sofre calor. */
const DES_SCALE=230,DES_THR=.555,DES_EDGE=.1,DES_CLEAR_A=120,DES_CLEAR_B=200;
function desertW(x,z){
 const d=Math.hypot(x,z);if(d<DES_CLEAR_A)return 0;
 return sstep(DES_THR,DES_THR+DES_EDGE,fbm(x/DES_SCALE+137.5,z/DES_SCALE-61.2,3))*sstep(DES_CLEAR_A,DES_CLEAR_B,d);
}
/* ---------- Bioma de cerejeiral ----------
   Mesmo esquema do deserto (função pura da semente, sem costura entre chunks), mas com ruído próprio: o mundo é dividido em MUITAS manchas
   independentes de cada bioma (estilo Minecraft), então o mesmo bioma aparece várias vezes, em lugares diferentes. Nunca dentro do deserto
   (o deserto tem prioridade; a borda se mistura) e nunca colado no spawn. */
const CH_SCALE=150,CH_THR=.55,CH_EDGE=.08,CH_CLEAR_A=60,CH_CLEAR_B=130;
function cherryW(x,z){
 const d=Math.hypot(x,z);if(d<CH_CLEAR_A)return 0;
 return sstep(CH_THR,CH_THR+CH_EDGE,fbm(x/CH_SCALE+311.7,z/CH_SCALE-205.3,3))*sstep(CH_CLEAR_A,CH_CLEAR_B,d)*(1-sstep(.02,.35,desertW(x,z)));
}
/* Bioma dominante em (x,z): '' = planície/floresta padrão. Usado pelo aviso de bioma, clima e música. */
const BIOMES=[['desert','Deserto',desertW,.3,.2],['cherry','Cerejeiral',cherryW,.3,.2]];   // [id, nome, peso(x,z), limiar p/ entrar, limiar p/ sair]
/* Relevo do deserto: mantém um pouco da forma original (morros viram mesas baixas) e soma dunas suaves. */
function desertH(x,z,b){return 18.6+(b-18)*.32+(fbm(x/46+21,z/31+5,3)-.5)*9}
function baseTerrain(x,z){
 if(H0===null)H0=rawH(0,0);
 const b=H0+(rawH(x,z)-H0)*sstep(14,46,Math.hypot(x,z));             // planície ao redor do spawn
 const w=desertW(x,z);if(w<=0)return b;
 return b+(desertH(x,z,b)-b)*sstep(0,.55,w);                          // deserto: terreno mais plano com dunas
}

/* ---------- Lagos (função pura de x,z + seed → sem costura entre chunks) ----------
   Uma célula de LAKE_CELL m pode ter 1 lago. O nível d'água é único por lago (o ponto mais baixo do anel em volta),
   a bacia é escavada com suavização e a margem sobe até o terreno original. Lagos só em terreno bem plano e longe do spawn. */
const LAKE_CELL=110,LAKE_CHANCE=.5,LAKE_CHANCE_DESERT=.07,LAKE_MIN_R=13,LAKE_MAX_R=30,LAKE_MIN_D=2,LAKE_MAX_D=4.5,LAKE_MAXSLOPE=3.2,LAKE_SPAWN_CLEAR=20;   // margem livre (m) entre a área de influência do lago e o spawn
const lakeCache=new Map();
function lakeParams(cx,cz){
 const k=cx+','+cz;let L=lakeCache.get(k);if(L!==undefined)return L;
 L=null;const r=rng(hash('lk'+world.seed+','+k));
 const u0=r(),px=(cx+.2+r()*.6)*LAKE_CELL,pz=(cz+.2+r()*.6)*LAKE_CELL,R=LAKE_MIN_R+r()*(LAKE_MAX_R-LAKE_MIN_R),dep=LAKE_MIN_D+r()*(LAKE_MAX_D-LAKE_MIN_D),sx=r()*100,sz=r()*100;
 const dwl=desertW(px,pz);   // no deserto o lago é raro (oásis)
 if(u0<LAKE_CHANCE+(LAKE_CHANCE_DESERT-LAKE_CHANCE)*dwl){
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
const PSC={oak:.8,spruce:.72,deadoak:.8,deadspruce:.72,rock:.45,bigrock:.3,log:.36};   // o pack vem em escala ~10 m; 1 bloco = 1 m
const unb64=(s,T)=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return new T(u.buffer)};
const s2l=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};
const PROTO={oak:[],spruce:[],deadoak:[],deadspruce:[],rock:[],bigrock:[],log:[]};
for(const e of PK.trees.concat(PK.rocks,(OWM.logPack||{logs:[]}).logs))if(PROTO[e.k])PROTO[e.k].push({k:e.k,pos:unb64(e.p,Int16Array),col:unb64(e.c,Uint8Array),idx:unb64(e.i,Uint16Array),pal:e.pal.map(c=>c.map(s2l)),h:e.h,hx:e.hx,hz:e.hz,hy:e.hy});
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
/* Variações: mesma malha do pack com largura (sx), altura (sy) e tom das folhas (tint) diferentes. [peso, sx, sy, tint]; o peso repete o proto na lista (pick uniforme). */
const TV={
 oak:[[4,1,1,[1,1,1]],[2,1.3,.88,[1.05,1,.95]],[2,.8,1.25,[.95,1,.95]],[2,.65,.6,[1.1,1.08,.9]],[1,1,1,[2.1,.95,.3]],[1,1.1,1.05,[.75,.82,.75]],[1,.45,.2,[1,1.05,.9]]],   // normal, larga, esguia, jovem, outono, escura, arbusto
 spruce:[[4,1,1,[1,1,1]],[2,.75,1.2,[.9,1,1]],[2,1.2,.8,[1,1,1]],[2,1,1.05,[.7,.85,.9]],[2,.6,.55,[1.1,1.15,.95]],[1,1,1,[1.35,1.1,.6]]],                              // normal, fina, robusta, azulada, jovem, amarelada
 deadoak:[[3,1,1,[1,1,1]],[1,1.2,.9,[1,1,1]],[1,.85,1.15,[1,1,1]],[1,.7,.65,[1,1,1]]],
 deadspruce:[[3,1,1,[1,1,1]],[1,.75,1.15,[1,1,1]],[1,1.1,.8,[1,1,1]]]};
for(const[k,[n,dead]]of Object.entries({oak:['round',0],spruce:['tall',0],deadoak:['round',1],deadspruce:['tall',1]}))
  if(TREE[n]){const T=TREE[n];PROTO[k]=[];for(const[w,sx,sy,tint]of TV[k])for(let i=0;i<w;i++)PROTO[k].push(PROTO[k].find(p=>p.sx===sx&&p.sy===sy&&p.tint[0]===tint[0]&&p.tint[1]===tint[1])||{k,tree:T,dead:!!dead,h:T.h*sy,hx:T.hx*sx,hz:T.hz*sx,hy:T.h*sy,sx,sy,tint})}
/* ---------- Cerejeiras (cherry.js) ----------
   3 modelos do pack "Cherry Blossom Trees" (Jagobo, CC-BY-4.0), texturas originais; cada um com 2 LODs (perto/longe) já assados no pack.
   Variações: largura (sx), altura (sy) e tom das flores (tint: mais branca, mais rosa-escura...). */
const CHL=[],CHT=[];
if(OWM.cherryPack){
 const mesh=m=>({pos:f32(unb64(m.pos,Int16Array),.01),nor:f32(unb64(m.nor,Int8Array),1/127),uv:f32(unb64(m.uv,Int16Array),1/2048),idx:unb64(m.idx,Uint16Array)});
 for(const t of OWM.cherryPack.trees)CHT.push({h:t.h,hx:t.hx,hz:t.hz,lod:t.lod.map(l=>({b:mesh(l.b),l:mesh(l.l)}))});
 const CV=[[1,1,[1,1,1]],[1.15,.9,[1.03,1.03,1.04]],[.85,1.12,[1,.93,.96]],[.7,.7,[1.06,1.06,1.06]],[1.1,1.05,[.98,.88,.94]],[.9,.95,[1.05,1,1]]];   // [sx, sy, tint]
 CHT.forEach((T,i)=>CV.forEach(([sx,sy,tint],j)=>{if((i+j)%2===0||j<2)CHL.push({k:'cherry',cherry:T,h:T.h*sy,hx:T.hx*sx,hz:T.hz*sx,hy:T.h*sy,sx,sy,tint})}))
}
const CM={};
function cherryMats(){
 if(CM.bark||!OWM.cherryPack)return CM;const X=OWM.cherryPack.tex;
 CM.bark=new THREE.MeshLambertMaterial({map:treeTex(X.bark,1),vertexColors:true});
 CM.leaf=new THREE.MeshLambertMaterial({map:treeTex(X.leaf,1),alphaTest:.4,side:THREE.DoubleSide,vertexColors:true});
 return CM}
OWM.extraMats.push(()=>CM.bark?[CM.bark,CM.leaf]:[]);
function addCherry(p,tier,hq,CA){
 const T=p.pr.cherry,lv=T.lod[(tier===1&&!hq)?1:0],s=p.s,cr=Math.cos(p.rot),sr=Math.sin(p.rot),sx=p.pr.sx,sy=p.pr.sy,tn=p.pr.tint,hh=Math.max(.01,T.h*s*sy),j=(p.sd-.5)*.14;
 const put=(m,A,cardLum)=>{const P=m.pos,N=m.nor,U=m.uv,n=P.length/3,b0=A.pos.length/3;
  for(let i=0;i<n;i++){const lx=P[i*3]*s*sx,ly=P[i*3+1]*s*sy,lz=P[i*3+2]*s*sx,nx=N[i*3],nz=N[i*3+2],g=p.b*(cardLum?.8+.2*Math.min(1,ly/hh):.78+.22*Math.min(1,ly/hh));
   A.pos.push(p.x+lx*cr+lz*sr,p.y+ly,p.z-lx*sr+lz*cr);A.nor.push(nx*cr+nz*sr,N[i*3+1],-nx*sr+nz*cr);A.uv.push(U[i*2],U[i*2+1]);
   if(cardLum)A.col.push(g*(1+j)*tn[0],g*tn[1],g*(1-j*.6)*tn[2]);else A.col.push(g*(1+j),g,g*(1-j*.5))}
  for(let i=0;i<m.idx.length;i++)A.idx.push(b0+m.idx[i])};
 put(lv.b,CA.b,0);put(lv.l,CA.l,1)}
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

/* ---------- Plantas do deserto (desert.js) ---------- */
const DG={},DGL=[],DSM=[];
if(OWM.desertPack){
 const b64=(t,T)=>{const bin=atob(t),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new T(u.buffer)};
 const GC={bush:[3,1.5,0],agave:[2.5,1.7,'b'],yucca:[1.5,1.7,0],dry:[.8,1.6,0],ocot:[2,2.2,'b'],cholla:[1.5,1.5,'a'],silver:[1.5,1.5,'a'],dead:[.8,2,'b'],twig:[.8,1.7,'b']},SOLID={dead:1,cholla:1,silver:1};   // [peso, escala, zona]
 for(const p of OWM.desertPack.plants){
  let g=DG[p.g];if(!g){const c=GC[p.g];g=DG[p.g]={n:p.g,w:c[0],s:c[1],z:c[2],solid:!!SOLID[p.g],p:[]};DGL.push(g)}
  const lod=p.v.map(v=>{const a=b64(v.pos,Int16Array),b=b64(v.nor,Int8Array),c=b64(v.uv,Int16Array),P=new Float32Array(a.length),N=new Float32Array(b.length),U=new Float32Array(c.length);
   for(let i=0;i<a.length;i++){P[i]=a[i]/100;N[i]=b[i]/127}for(let i=0;i<c.length;i++)U[i]=c[i]/v.us;return{pos:P,nor:N,uv:U,idx:b64(v.idx,Uint16Array)}});
  g.p.push({shrub:1,g:p.g,m:p.m,h:p.h,hx:p.hx,hz:p.hz,cr:Math.max(.18,Math.min(p.hx,p.hz)*.35),solid:g.solid,lod});
 }
}
const pickDG=(r,zn)=>{let t=0;const w=DGL.map(g=>{const k=g.w*((g.z==='a'&&zn<.38)||(g.z==='b'&&zn>.62)?2.4:1);t+=k;return k});let u=r()*t;for(let i=0;i<DGL.length;i++){u-=w[i];if(u<=0)return DGL[i]}return DGL[DGL.length-1]};
function dsMat(mi){let m=DSM[mi];if(m)return m;const d=OWM.desertPack.mats[mi];m=DSM[mi]=new THREE.MeshLambertMaterial({map:treeTex(d.tex,1),vertexColors:true,side:d.dbl?THREE.DoubleSide:THREE.FrontSide,alphaTest:d.a?.32:0});return m}
OWM.extraMats.push(()=>DSM.filter(Boolean));
function addShrub(p,tier,SA){
 const pr=p.pr,lv=pr.lod[tier&&pr.lod.length>1?1:0],s=p.s,cr=Math.cos(p.rot),sr=Math.sin(p.rot),hh=Math.max(.01,pr.h*s),P=lv.pos,N=lv.nor,U=lv.uv,n=P.length/3;
 const A=SA[pr.m]||(SA[pr.m]={pos:[],nor:[],uv:[],col:[],idx:[]}),b0=A.pos.length/3,j=(p.sd-.5)*.16;
 for(let i=0;i<n;i++){const lx=P[i*3]*s,ly=P[i*3+1]*s,lz=P[i*3+2]*s,nx=N[i*3],nz=N[i*3+2],g=p.b*(.74+.26*Math.min(1,Math.max(0,ly/hh)));
  A.pos.push(p.x+lx*cr+lz*sr,p.y+ly,p.z-lx*sr+lz*cr);A.nor.push(nx*cr+nz*sr,N[i*3+1],-nx*sr+nz*cr);A.uv.push(U[i*2],U[i*2+1]);A.col.push(g*(1+j),g,g*(1-j*.7))}
 for(let i=0;i<lv.idx.length;i++)A.idx.push(b0+lv.idx[i]);
}
/* LOD por distância (só no modo otimizado): perto = 50% das folhas; longe (>3,7 chunks) = 22% das folhas e só o tronco. Histerese evita ficar trocando. */
function treeTier(cx,cz,prev){if(HQ())return 0;const d=Math.hypot(cx-(P.p.x>>4),cz-(P.p.z>>4));return prev===1?(d>3?1:0):(d>3.7?1:0)}
function addTree(p,tier,hq,A){
 const tr=p.pr.tree,dead=p.pr.dead,s=p.s,cr=Math.cos(p.rot),sr=Math.sin(p.rot),hh=Math.max(.01,tr.h*s*(p.pr.sy||1)),j=(p.sd-.5)*.16,sx=p.pr.sx||1,sy=p.pr.sy||1,tn=p.pr.tint||[1,1,1];
 const tr_=dead?.62:1+j,tg=dead?.58:1,tb=dead?.55:1-j*.5,B=A.b;
 const bk=(tier===1&&!hq)?tr.trunk:tr.bark,nb=bk.pos.length/3,b0=B.pos.length/3;
 for(let i=0;i<nb;i++){const lx=bk.pos[i*3]*s*sx,ly=bk.pos[i*3+1]*s*sy,lz=bk.pos[i*3+2]*s*sx,nx=bk.nor[i*3],nz=bk.nor[i*3+2],g=p.b*(.8+.2*Math.min(1,ly/hh));
  B.pos.push(p.x+lx*cr+lz*sr,p.y+ly,p.z-lx*sr+lz*cr);B.nor.push(nx*cr+nz*sr,bk.nor[i*3+1],-nx*sr+nz*cr);B.uv.push(bk.uv[i*2],bk.uv[i*2+1]);B.col.push(g*tr_,g*tg,g*tb)}
 for(let i=0;i<bk.idx.length;i++)B.idx.push(b0+bk.idx[i]);
 if(dead)return;
 const L=tr.leaf,Lf=A.l,frac=hq?1:tier===1?.22:.5,nq=Math.round(L.nq*frac),sc=frac<1?.92/Math.sqrt(frac):1,l0=Lf.pos.length/3;
 for(let q=0;q<nq;q++){const v=(q*.6180339+p.sd)%1,qb=1+(v-.5)*.12;
  for(let k=0;k<4;k++){const o=q*4+k,cx=L.ctr[q*3],cy=L.ctr[q*3+1],cz=L.ctr[q*3+2],lx=(cx+(L.pos[o*3]-cx)*sc)*s*sx,ly=(cy+(L.pos[o*3+1]-cy)*sc)*s*sy,lz=(cz+(L.pos[o*3+2]-cz)*sc)*s*sx,nx=L.nor[o*3],nz=L.nor[o*3+2],g=p.b*qb*(.74+.26*Math.min(1,ly/hh));
   Lf.pos.push(p.x+lx*cr+lz*sr,p.y+ly,p.z-lx*sr+lz*cr);Lf.nor.push(nx*cr+nz*sr,L.nor[o*3+1],-nx*sr+nz*cr);Lf.uv.push(L.uv[o*2],L.uv[o*2+1]);Lf.col.push(g*(1+j)*tn[0],g*tn[1],g*(1-j*.6)*tn[2])}
  for(let t=0;t<6;t++)Lf.idx.push(l0+q*4+L.pat[q*6+t])}
}
function mkTreeMesh(A,mat,shadow){
 if(!A.idx.length)return null;const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(A.pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(A.nor,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(A.uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(A.col,3));
 g.setIndex(new THREE.BufferAttribute(new Uint32Array(A.idx),1));g.computeBoundingSphere();
 const m=new THREE.Mesh(g,mat);m.castShadow=shadow;m.receiveShadow=true;m.matrixAutoUpdate=false;m.updateMatrix();scene.add(m);return m}
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
/* troca o canvas procedural (reserva) pela foto de grama assim que ela carregar */
if(OWM.grassSrc){const gi=new Image();gi.onload=()=>{grassTex.image=gi;grassTex.needsUpdate=true};gi.src=OWM.grassSrc}

/* Chão: textura de grama (foto fornecida, tile 256 sem emenda — grass.js) por UV, em duas escalas misturadas pra esconder a repetição.
   Onde o terreno é grama a cor vem da própria textura; nas áreas de terra/areia/pedra de encosta a textura vira só relevo (luminância)
   e a cor por vértice assume. GRASS_GAIN clareia a foto pra ela não ficar escura sob a iluminação do jogo. */
const GRASS_GAIN=1.55,GST=OWM.grassStat||{lum:.133,rawG:.412};
const gA=[98,156,64].map(s2l),gB=[120,164,62].map(s2l),gRef=[0,1,2].map(c=>(gA[c]+gB[c])/2);   // cor média (linear) da grama por vértice
const terrMat=new THREE.MeshStandardMaterial({map:grassTex,vertexColors:true,roughness:GLOSS.rough,metalness:GLOSS.metal});
terrMat.onBeforeCompile=sh=>{
 sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`
 #ifdef USE_MAP
  vec4 t1=texture2D(map,vUv);vec4 t2=texture2D(map,vUv*.23+vec2(.37,.11));
  t1=mapTexelToLinear(t1);float mac=clamp(1.+(t2.g-${GST.rawG.toFixed(4)})*.5,.88,1.12);
  vec3 tx=t1.rgb*mac;
  vec3 gr=vec3(${gRef[0].toFixed(5)},${gRef[1].toFixed(5)},${gRef[2].toFixed(5)});
  float gw=smoothstep(.95,.995,dot(normalize(vColor),normalize(gr)));            // 1 = chão de grama, 0 = terra/areia/pedra
  vec3 grassC=tx*${GRASS_GAIN.toFixed(3)}*clamp(vColor/gr,vec3(.7),vec3(1.35));
  vec3 otherC=vColor*(dot(tx,vec3(.2126,.7152,.0722))/${GST.lum.toFixed(5)});
  diffuseColor.rgb*=mix(otherC,grassC,gw);
 #endif`).replace('#include <color_fragment>','')};
/* Pedras (props): textura de pedra triplanar em coordenadas de mundo — a malha dos props não tem UV. */
const propMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:GLOSS.rough,metalness:GLOSS.metal});
propMat.onBeforeCompile=sh=>{
 sh.uniforms.uStone={value:stoneTex};sh.uniforms.uStoneK={value:1/ST.mean};sh.uniforms.uStoneS={value:STONE_SCALE};
 sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;varying vec3 vWN;attribute float wd;varying float vWd;')
  .replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*vec4(position,1.)).xyz;vWN=normalize(normal);vWd=wd;');
 sh.fragmentShader='uniform sampler2D uStone;uniform float uStoneK;uniform float uStoneS;varying vec3 vWP;varying vec3 vWN;varying float vWd;\n'+sh.fragmentShader.replace('#include <map_fragment>',`
  vec3 bw=pow(abs(normalize(vWN)),vec3(4.));bw/=(bw.x+bw.y+bw.z);
  vec3 sx=pow(texture2D(uStone,vWP.zy*uStoneS).rgb,vec3(2.2));
  vec3 sy=pow(texture2D(uStone,vWP.xz*uStoneS+.31).rgb,vec3(2.2));
  vec3 sz=pow(texture2D(uStone,vWP.xy*uStoneS+.67).rgb,vec3(2.2));
  diffuseColor.rgb*=mix((sx*bw.x+sy*bw.y+sz*bw.z)*uStoneK,vec3(1.),vWd);`)};
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
  const dwT=desertW(x,z);if(dwT>0&&dwT*3.5>r())continue;           // deserto: sem árvores
  const cwT=cherryW(x,z);if(cwT>0&&cwT*.9>r())continue;            // cerejeiral: poucas árvores comuns (as cerejeiras entram no fim da lista)
  let k;
  if(t<.24)k=r()<.6?'deadoak':'deadspruce';                         // zona morta
  else if(h>=24||t>.7)k=r()<.9?'spruce':'oak';                      // terreno alto / frio: pinheiros
  else k=r()<.88?'oak':'spruce';                                    // floresta normal: carvalhos
  add(k,x,z,h,1.9,.18);
 }
 const r7=rng(hash('r7'+world.seed+','+cx+','+cz));
 const nR=1+(r()<.6?1:0)+(r()<.35?1:0)+(dens<.4?1:0);
 for(let a=0,n=0;a<nR*3&&n<nR;a++){
  const lx=1+(r()*14|0),lz=1+(r()*14|0),h=hvAt(hv,lx+.5,lz+.5);if(h<=SEA)continue;
  if(desertW(ox+lx+.5,oz+lz+.5)>.15)continue;            // deserto: sem pedras
  const before=out.length;add('rock',ox+lx+.5,oz+lz+.5,h,1.2,.3);if(out.length>before){n++;if(r7()<.07)out.pop()}   // 7% das pedras não nascem (rng própria: não muda o resto do chunk)
 }
 if(r()<(.05+(dens<.35?.05:0))){const lx=2+(r()*12|0),lz=2+(r()*12|0),h=hvAt(hv,lx+.5,lz+.5);if(h>SEA+1&&desertW(ox+lx+.5,oz+lz+.5)<=.15)add('bigrock',ox+lx+.5,oz+lz+.5,h,3,.2)}
 /* Dos pontos de pedra: 20% viram toras e 80% continuam pedra (rng própria: o resto do chunk e os ids não mudam).
    Se a tora não couber (declive, lago, colisão), a pedra fica no lugar — a proporção se mantém. */
 const r2=rng(hash('lg'+world.seed+','+cx+','+cz)),LG=PROTO.log;
 for(let i=0;i<out.length;i++){
  const p=out[i];if(p.k!=='rock')continue;
  const u=r2();if(u>=.2||!LG.length||desertW(p.x,p.z)>.5)continue;
  const pr=LG[Math.floor(r2()*LG.length)],s=PSC.log*(.8+r2()*.4),rot=r2()*6.2832,hl=pr.hz*s,sx=Math.sin(rot),sz=Math.cos(rot),rd=Math.max(1,hl*.9),b=.9+r2()*.2,sd=r2();
  let lo=1e9,hi=-1e9,bad=false;
  for(let t=-1;t<=1;t+=.5){const x=p.x+sx*t*hl,z=p.z+sz*t*hl,lk=lakeInfo(x,z);if(lk&&lk.t<1.3){bad=true;break}const h=terrainFn(x,z);lo=Math.min(lo,h);hi=Math.max(hi,h)}
  if(bad||hi-lo>.35||lo<=SEA)continue;
  out.splice(i,1);
  if(!free(p.x,p.z,rd)){out.splice(i,0,p);continue}
  out.splice(i,0,{id:p.id,k:'log',pr,x:p.x,z:p.z,y:(lo+hi)/2-.12,s,rot,rad:rd,b,sd});
 }
 /* Arbustos/cactos do deserto (rng própria: não muda o resto do chunk; entram no fim da lista, então os ids antigos não mudam) */
 if(DGL.length&&(desertW(ox+8,oz+8)>0||desertW(ox,oz)>0||desertW(ox+16,oz)>0||desertW(ox,oz+16)>0||desertW(ox+16,oz+16)>0)){
  const rd=rng(hash('ds'+world.seed+','+cx+','+cz)),zv=NZ((ox+8)/70+700,(oz+8)/70+300),nD=Math.round(1.5+zv*5.5+rd()*2);   // zv: manchas mais ou menos vegetadas
  for(let a=0,n=0;a<nD*4&&n<nD;a++){
   const lx=1+(rd()*14|0),lz=1+(rd()*14|0),x=ox+lx+.5+(rd()-.5)*.8,z=oz+lz+.5+(rd()-.5)*.8,dw=desertW(x,z),u=rd();
   if(dw<.15||u>dw+.4)continue;
   if(hvAt(hv,lx+.5,lz+.5)<=SEA+1||slopeN(hv,lx,lz)<.7)continue;
   const lk=lakeInfo(x,z);if(lk&&lk.t<1.1)continue;
   const g=pickDG(rd,NZ(x/45+700,z/45+300)),pr=g.p[Math.floor(rd()*g.p.length)],s=g.s*(.75+rd()*.55),rr=Math.max(.5,pr.hx*s*.8);
   if(!free(x,z,rr))continue;
   const rl=x-ox,rz=z-oz,q=Math.min(.6,pr.hx*s*.4),gy=Math.min(hvAt(hv,rl,rz),hvAt(hv,rl-q,rz),hvAt(hv,rl+q,rz),hvAt(hv,rl,rz-q),hvAt(hv,rl,rz+q))-.1;
   out.push({id:out.length,k:'ds',pr,x,z,y:gy,s,rot:rd()*6.2832,rad:rr,b:.9+rd()*.2,sd:rd()});n++;
  }
 }
 /* Cerejeiras (rng própria: não muda o resto do chunk; entram no fim da lista, então os ids antigos não mudam) */
 if(CHL.length&&(cherryW(ox+8,oz+8)>0||cherryW(ox,oz)>0||cherryW(ox+16,oz)>0||cherryW(ox,oz+16)>0||cherryW(ox+16,oz+16)>0)){
  const rc=rng(hash('ch'+world.seed+','+cx+','+cz)),zc=NZ((ox+8)/55+520,(oz+8)/55-130),nC=Math.round(3+zc*5+rc()*2.5);   // zc: bosques mais ou menos fechados
  for(let a=0,n=0;a<nC*4&&n<nC;a++){
   const lx=1+(rc()*14|0),lz=1+(rc()*14|0),x=ox+lx+.5+(rc()-.5)*.8,z=oz+lz+.5+(rc()-.5)*.8,cw=cherryW(x,z),u=rc();
   if(cw<.12||u>cw+.45)continue;
   if(hvAt(hv,lx+.5,lz+.5)<=SEA+1||slopeN(hv,lx,lz)<.8)continue;
   const lk=lakeInfo(x,z);if(lk&&lk.t<1.2)continue;
   const pr=CHL[Math.floor(rc()*CHL.length)],s=.85+rc()*.35,rr=Math.max(1.5,pr.hx*s*2.2);
   if(!free(x,z,rr))continue;
   const rl=x-ox,rz=z-oz,q=Math.min(.7,pr.hx*s*.8),gy=Math.min(hvAt(hv,rl,rz),hvAt(hv,rl-q,rz),hvAt(hv,rl+q,rz),hvAt(hv,rl,rz-q),hvAt(hv,rl,rz+q))-.12;
   out.push({id:out.length,k:'cherry',pr,x,z,y:gy,s,rot:rc()*6.2832,rad:rr,b:.92+rc()*.16,sd:rc()});n++;
  }
 }
 return out;
}

function dropMesh(v){if(v.sm){for(const o of v.sm){scene.remove(o);o.geometry.dispose()}}if(v.wm){for(const w of v.wm){scene.remove(w);w.geometry.dispose()}}if(v.tm){scene.remove(v.tm);v.tm.geometry.dispose()}if(v.m){scene.remove(v.m);v.m.geometry.dispose()}if(v.pm){scene.remove(v.pm);v.pm.geometry.dispose()}if(v.bm){scene.remove(v.bm);v.bm.geometry.dispose()}if(v.lm){scene.remove(v.lm);v.lm.geometry.dispose()}}

/* Monta UMA malha com todos os props do chunk (normais suaves por vértice) e registra colisores. */
function buildProps(ch){
 const rem=world.edits['p'+ch.cx+','+ch.cz]||{},pos=[],nor=[],col=[],wd=[],list=[],old=world.meshes.get(ck(ch.cx,ch.cz)),hq=HQ(),tier=treeTier(ch.cx,ch.cz,old&&old.tier),TA={b:{pos:[],nor:[],uv:[],col:[],idx:[]},l:{pos:[],nor:[],uv:[],col:[],idx:[]}},CA={b:{pos:[],nor:[],uv:[],col:[],idx:[]},l:{pos:[],nor:[],uv:[],col:[],idx:[]}},SA={};
 for(const p of ch.props){
  if(rem[p.id])continue;
  if(p.k==='ds'){addShrub(p,tier,SA);const q=p.pr,hs=q.solid?Math.max(.18,q.cr*p.s):Math.max(.2,Math.min(q.hx,q.hz)*p.s*.5);list.push({id:p.id,cx:ch.cx,cz:ch.cz,k:'ds',x:p.x,z:p.z,hx:hs,hz:hs,y0:p.y,hy:q.h*p.s,solid:q.solid,hard:.5+q.h*p.s*.4});continue}
  const pr=p.pr,s=p.s,cr=Math.cos(p.rot),sr=Math.sin(p.rot),P=pr.pos,I=pr.idx,hh=Math.max(.01,pr.h*s);
  if(pr.cherry)addCherry(p,tier,hq,CA);else if(pr.tree)addTree(p,tier,hq,TA);else{
  const j=(p.sd-.5)*.14,cl=pr.pal.map(c=>[c[0]*p.b*(1+j),c[1]*p.b*(1+j*.4),c[2]*p.b*(1-j*.3)]);
  const NR=pr.nor;
  for(let t=0;t<I.length;t+=3){
   for(let q=0;q<3;q++){const i=I[t+q],lx=P[i*3]/100*s,ly=P[i*3+1]/100*s,lz=P[i*3+2]/100*s,nx=NR[i*3],nz=NR[i*3+2];
    pos.push(p.x+lx*cr+lz*sr,p.y+ly,p.z-lx*sr+lz*cr);nor.push(nx*cr+nz*sr,NR[i*3+1],-nx*sr+nz*cr);
    const g=.82+.18*Math.min(1,Math.max(0,ly/hh)),cc=cl[pr.col[i]];col.push(cc[0]*g,cc[1]*g,cc[2]*g);wd.push(p.k==='log'?1:0)}
  }}
  const hy=pr.hy*s,tree=p.k==='oak'||p.k==='spruce'||p.k==='cherry',dead=p.k==='deadoak'||p.k==='deadspruce';
  const lg=p.k==='log',ca=Math.abs(cr),sa=Math.abs(sr);
  list.push({id:p.id,cx:ch.cx,cz:ch.cz,k:p.k,x:p.x,z:p.z,hx:Math.max(.2,lg?pr.hx*s*ca+pr.hz*s*sa:pr.hx*s),hz:Math.max(.2,lg?pr.hx*s*sa+pr.hz*s*ca:pr.hz*s),y0:p.y,hy,solid:hy>=.55&&!lg,hard:tree?2.2:dead?1.6:p.k==='bigrock'?3.2:.8+hy*.3});
 }
 let pm=null;
 if(pos.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(nor),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(col),3));g.setAttribute('wd',new THREE.BufferAttribute(new Float32Array(wd),1));g.computeBoundingSphere();pm=new THREE.Mesh(g,propMat);pm.castShadow=pm.receiveShadow=true;pm.matrixAutoUpdate=false;pm.updateMatrix();scene.add(pm)}
 world.col.set(ck(ch.cx,ch.cz),list);
 const tm=TP?treeMats(hq):null,cm=CA.b.idx.length?cherryMats():null;
 return{pm,tier,bm:tm?mkTreeMesh(TA.b,tm.bark,tier===0):null,lm:tm?mkTreeMesh(TA.l,tm.leaf,tier===0):null,sm:Object.keys(SA).map(m=>mkTreeMesh(SA[m],dsMat(+m),tier===0)).concat(cm?[mkTreeMesh(CA.b,cm.bark,tier===0),mkTreeMesh(CA.l,cm.leaf,tier===0)]:[]).filter(Boolean)};
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
const TC={cg:[134,181,94],pk:[240,178,198],grass:[98,156,64],grass2:[120,164,62],dirt:[121,98,66],rock:[124,126,130],sand:[218,200,142],dsA:[234,206,148],dsB:[216,176,114],dsR:[178,124,86]};for(const k in TC)TC[k]=TC[k].map(s2l);   // dsA/dsB: areia do deserto (clara/alaranjada), dsR: arenito nas encostas
function terrColor(wx,wz,h,ny,o,i){
 const v=.93+NZ(wx/5+300,wz/5)*.14,w=NZ(wx/23-90,wz/23+40),g=TC.grass,g2=TC.grass2,d=TC.dirt,rk=TC.rock,sd=TC.sand;
 const dt=sstep(.94,.85,ny),rt=sstep(.84,.72,ny),sa=sstep(SEA+1.4,SEA+.2,h)*(1-rt*.8);
 const lk=lakeInfo(wx,wz);let lsa=0,lw=1;if(lk){lsa=sstep(lk.wl+1.1,lk.wl+.1,h)*sstep(1.5,.9,lk.t);lw=1-.28*sstep(lk.wl+.3,lk.wl-.3,h)}   // margem/fundo de areia, mais escura molhada
 const cw=sstep(.04,.5,cherryW(wx,wz)),cp=cw>0?sstep(.5,.8,NZ(wx/3.2+410,wz/3.2-90))*.55*cw:0,cg=TC.cg,pk=TC.pk;   // cerejeiral: grama mais clara e manchas de pétalas
 const dw=sstep(.04,.55,desertW(wx,wz)),dv=dw>0?NZ(wx/11+60,wz/11-20):0,dA=TC.dsA,dB=TC.dsB,dR=TC.dsR;   // deserto: areia com variação de tom; encosta íngreme vira arenito
 for(let c=0;c<3;c++){let x=g[c]+(g2[c]-g[c])*w;if(cw>0){x+=(cg[c]-x)*cw*.65;x+=(pk[c]-x)*cp}x+=(d[c]-x)*dt;x+=(sd[c]-x)*sa;x+=(rk[c]-x)*rt;if(dw>0){const ds=dA[c]+(dB[c]-dA[c])*dv;x+=(ds+(dR[c]-ds)*Math.min(1,rt*.9+dt*.25)-x)*dw}x+=(sd[c]-x)*lsa;o[i+c]=x*v*lw}
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
 const m=new THREE.Mesh(g,terrMat);m.position.set(ox,0,oz);m.castShadow=false;m.receiveShadow=true;m.matrixAutoUpdate=false;m.updateMatrix();scene.add(m);return m;   // o chão só recebe sombra (não projeta em si mesmo → sem faixas de "shadow acne")
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
  const m=new THREE.Mesh(g,getSim(L).mat);m.position.set(ox,0,oz);m.castShadow=m.receiveShadow=false;m.renderOrder=3;m.matrixAutoUpdate=false;m.updateMatrix();scene.add(m);out.push(m)}
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
function meshChunk(cx,cz){const k=ck(cx,cz),old=world.meshes.get(k);if(old)dropMesh(old);world.col.delete(k);const ch=chunk(cx,cz),d=ch.d,ox=cx*CS,oz=cz*CS,pos=[],nor=[],uv=[],col=[],idx=[];for(let y=0;d&&y<H;y++)for(let z=0;z<CS;z++)for(let x=0;x<CS;x++){const b=d[(y*CS+z)*CS+x];if(!b)continue;const bl=BL[b];for(let f=0;f<6;f++){const F=FACES[f],dd=F.d,nx=x+dd[0],ny=y+dd[1],nz=z+dd[2];let nb;if(ny<0)continue;if(ny>=H)nb=0;else if(nx>=0&&nx<CS&&nz>=0&&nz<CS)nb=d[(ny*CS+nz)*CS+nx];else nb=getB(ox+nx,ny,oz+nz);if(nb)continue;const t=f===2?bl.t:f===3?bl.b:bl.s,u0=t/NT+.001,u1=(t+1)/NT-.001,base=pos.length/3;for(let q=0;q<4;q++){const c=F.c[q];pos.push(x+c[0],y+c[1],z+c[2]);nor.push(dd[0],dd[1],dd[2]);col.push(F.s,F.s,F.s);uv.push(q%2?u1:u0,q<2?1:0)}idx.push(base,base+2,base+1,base+1,base+2,base+3)}}let m=null;if(idx.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(nor),3));g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(uv),2));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(col),3));g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx),1));m=new THREE.Mesh(g,chunkMat);m.position.set(ox,0,oz);m.castShadow=m.receiveShadow=true;m.matrixAutoUpdate=false;m.updateMatrix();scene.add(m)}const pp=buildProps(ch),tm=buildTerrain(ch),wm=buildWater(ch);world.meshes.set(k,{m,pm:pp.pm,bm:pp.bm,lm:pp.lm,sm:pp.sm,tier:pp.tier,tm,wm,cx,cz})}
function clearWorld(){for(const v of world.meshes.values())dropMesh(v);world.meshes.clear();world.chunks.clear();world.col.clear()}
function initWorld(w){clearWorld();world.seed=w.seed;world.edits=w.edits;NZ=mkNoise(w.seed);H0=null;lakeCache.clear();for(const q of sims.values()){q.tex.dispose();q.mat.dispose()}sims.clear()}
const OFF=[];for(let a=-12;a<=12;a++)for(let b=-12;b<=12;b++)OFF.push([a,b,a*a+b*b]);OFF.sort((p,q)=>p[2]-q[2]);
function stream(pcx,pcz,rad,lim){let n=0;const t0=performance.now();const r2=rad*rad+1;for(const o of OFF){if(o[2]>r2)break;const cx=pcx+o[0],cz=pcz+o[1];if(!world.meshes.has(ck(cx,cz))){meshChunk(cx,cz);if(++n>=lim||performance.now()-t0>7)break}}const u=(rad+2)*(rad+2);let rl=1;for(const[k,v]of world.meshes){if((v.cx-pcx)**2+(v.cz-pcz)**2>u){dropMesh(v);world.col.delete(k);world.meshes.delete(k)}else if(rl&&v.tier!==treeTier(v.cx,v.cz,v.tier)){rl=0;meshChunk(v.cx,v.cz)}}}


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
 if(anim.setQuality)anim.setQuality(S.charQ,S.cloth!==0);
 post.apply(Math.max(S.dist,3)*CS);
 $('#fps').classList.toggle('hidden',!S.fps);
 if(OWM.music)OWM.music.vol();
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
slider('Campo de visão','fov',50,110);slider('Distância (chunks)','dist',2,10);slider('Sensibilidade','sens',20,200);slider('Brilho','bright',0,100);slider('Volume da música','mvol',0,100);
cycle('Sombras','shadow',['Desligadas','Médias','Altas']);
cycle('Tone mapping','tone',['Nenhum','Linear','Reinhard','Cineon','ACES']);
cycle('Texturas HD','hdTex',OF);
cycle('Qualidade do personagem','charQ',['Baixa (2 mil tris)','Média (9 mil)','Alta (35 mil)']);cycle('Física da roupa','cloth',['Desligada','Ligada']);
cycle('Bloom','bloom',OF);cycle('Névoa volumétrica','vfog',['Desligada','Normal','Alta']);
cycle('Resolução alta','fancy',OF);cycle('Resolução dinâmica','dyn',OF);cycle('Texto "Coletar"','collect',['Invisível','Visível']);cycle('Mostrar FPS','fps',OF);cycle('Inverter eixo Y','invert',OF);cycle('Balanço da câmera','bob',OF);cycle('Vinheta','vig',OF);
cycle('Câmera','camMode',['1ª pessoa','3ª pessoa']);cycle('Travar mouse (lock on)','lockMouse',OF);

E('div','dsc np','Chill Synthwave - Digital Sunset — Karl Casey @ White Bat Audio',SS);
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
B('Jogar',()=>{selW=null;renderWL();go('worlds')},TS);B('Criador de skin',()=>skin.open('title'),TS);B('Configurações',()=>openSettings('title'),TS);E('div','dsc np','The Show Must Go On — Toilet Takeover OST',TS);
const ft=E('div','foot',null,TS);E('span','','Open World Mayhem',ft);E('span','',touch?'Toque para jogar':'WASD • Espaço • F1-F4',ft);

const WS=mkScreen('worlds','Mundos'),wlist=E('div','list',null,WS),wrow=E('div','row',null,WS);
const bPlay=B('Jogar mundo',()=>{const w=WL.find(x=>x.id===selW);if(w)startWorld(w)},wrow),bDel=B('Apagar',()=>{WL=WL.filter(x=>x.id!==selW);selW=null;st('bc.w2',WL);renderWL()},wrow);
B('Criar novo mundo',()=>{nName.value='Meu mundo '+(WL.length+1);nSeed.value='';go('new')},WS);B('Voltar',()=>go('title'),WS);
function renderWL(){wlist.textContent='';if(!WL.length)E('div','dsc','Nenhum mundo ainda. Crie um!',wlist);WL.forEach(w=>{const d=E('div','w'+(w.id===selW?' on':''),null,wlist),t=E('div','',null,d);E('p','',w.name,t);E('p','','Semente '+w.seed+' • '+new Date(w.t).toLocaleDateString('pt-BR'),t);d.onclick=()=>{selW=w.id;renderWL()}});bPlay.disabled=bDel.disabled=selW==null}
const NS=mkScreen('new','Novo mundo'),nName=fld('Nome do mundo',NS),nSeed=fld('Semente (opcional)',NS);
B('Criar',()=>{const sd=nSeed.value.trim(),w={id:Date.now(),name:nName.value.trim()||'Meu mundo',seed:sd?(/^-?\d+$/.test(sd)?+sd|0:hash(sd)):(Math.random()*1e9|0),edits:{},pos:null,hp:MAXHP,hpv:2,t:Date.now()};WL.unshift(w);st('bc.w2',WL);startWorld(w)},NS);B('Voltar',()=>go('worlds'),NS);

/* ---------- Loading / pausa ---------- */
const LS=mkScreen('loading','Carregando mundo');E('i','',E('div','pg',null,LS));
function startWorld(w){bCur='';bInit=false;cWt=0;if(PET.pts)PET.pts.visible=false;musDes=false;if(OWM.musicBiome)OWM.musicBiome('');heatReset();poisonReset();scReset();cur=w;inv=loadInv(w.inv);invOpen=false;invSel=null;initWorld(w);state='loading';hudShow(false);go('loading');for(const k in w.edits)if(k[0]!=='p')delete w.edits[k];P.hp=(w.hp&&w.hpv===2)?w.hp:MAXHP;P.st=MAXST;sprintTog=false;stLock=false;stIdle=0;stVis=0;P.vel.set(0,0,0);P.og=false;P.landV=0;tp3=S.camMode===1;breaking=false;prog=0;playingAnim=null;spawn=[.5,hgt(0,0)+3,.5];if(w.pos){P.p.set(w.pos[0],w.pos[1],w.pos[2]);P.yaw=w.pos[3];P.pitch=w.pos[4]}else{P.p.set(spawn[0],spawn[1],spawn[2]);P.yaw=P.pitch=0}P.peak=P.p.y;const pc=P.p.x>>4,pz=P.p.z>>4,need=OFF.filter(o=>o[2]<=5).reverse();const step=()=>{if(state!=='loading')return;let n=0;while(need.length&&n++<4){const o=need.pop();meshChunk(pc+o[0],pz+o[1])}need.length?requestAnimationFrame(step):beginPlay()};step()}
function lock(){if(!touch&&S.lockMouse){const p=$('#c').requestPointerLock&&$('#c').requestPointerLock();if(p&&p.catch)p.catch(()=>{})}}
function beginPlay(){state='play';{const g=sup(P.p.x,P.p.z);if(P.p.y<g||P.p.y>g+8)P.p.y=g+.02;P.peak=P.p.y}unstuck();go('');hudShow(true);applyAll();refreshHealth();saveT=0;lock();if(!touch)toast(S.lockMouse?'Clique na tela se o mouse não travar':'Mouse livre: botão direito + arrastar gira a câmera')}
function saveWorld(){if(!cur)return;cur.inv=inv;cur.pos=[P.p.x,P.p.y,P.p.z,P.yaw,P.pitch];cur.hp=P.hp;cur.hpv=2;cur.t=Date.now();st('bc.w2',WL)}
const PS=mkScreen('pause','Pausado','dim');
B('Continuar',resume,PS);B('Criador de skin',()=>skin.open('pause'),PS);B('Configurações',()=>openSettings('pause'),PS);E('div','dsc np','Rush Hour — ST: Blockade OST',PS);B('Salvar e sair',()=>{saveWorld();cur=null;hudShow(false);showMenu()},PS);
function pause(){if(state!=='play')return;state='pause';cEl.classList.add('hidden');breaking=false;mining=false;saveWorld();if(document.exitPointerLock)document.exitPointerLock();go('pause')}
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


/* ---------- Inventário e coleta ---------- */
/* 4 fileiras x 10 slots + grade de fabricação 3x3 (sem receitas ainda). Toque/clique num slot seleciona; no outro, move/junta/troca. */
const INV_N=40,CR_N=9,STACK=64,ITEMS={log:{n:'Tora'},rock:{n:'Pedra'}};
const newInv=()=>({s:Array(INV_N).fill(null),c:Array(CR_N).fill(null)});
function loadInv(o){const r=newInv();if(o)for(const k of['s','c'])for(let i=0;i<r[k].length;i++){const it=o[k]&&o[k][i];if(it&&ITEMS[it.t]&&it.n>0)r[k][i]={t:it.t,n:Math.min(STACK,it.n|0)}}return r}
let inv=newInv(),invSel=null,invOpen=false;
function invRoom(t){let r=0;for(const it of inv.s){if(!it)r+=STACK;else if(it.t===t)r+=STACK-it.n}return r}
function invAdd(t,n){if(invRoom(t)<n)return false;for(const it of inv.s)if(it&&it.t===t&&n>0){const m=Math.min(n,STACK-it.n);it.n+=m;n-=m}for(let i=0;i<INV_N&&n>0;i++)if(!inv.s[i]){const m=Math.min(n,STACK);inv.s[i]={t,n:m};n-=m}return true}
const IS=mkScreen('inv','Inventário','dim'),pnE=E('div','pn',null,IS),piE=E('div','pi',null,pnE);
const colsE=E('div','cols',null,piE),col1=E('div','col',null,colsE),col2=E('div','col',null,colsE);
E('div','ih','Fabricação',col1);const cgE=E('div','ig cg',null,col1);
E('div','ih','Mochila',col2);const mgE=E('div','ig',null,col2);
B('Fechar',()=>closeInv(),IS);
const slotEl={s:[],c:[]};
function mkSlots(g,k,n){for(let i=0;i<n;i++){const d=E('div','slot',null,g);d.onclick=()=>slotClick(k,i);slotEl[k].push(d)}}
mkSlots(cgE,'c',CR_N);mkSlots(mgE,'s',INV_N);
/* Ícones = render dos próprios modelos 3D (tora e pedra pequena), feito uma vez com um renderer temporário. */
const ICON={};let iconsDone=false;
function buildIcons(){
 if(iconsDone)return;iconsDone=true;
 try{
  const W=160,rr=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
  rr.setPixelRatio(1);rr.setSize(W,W,false);rr.outputEncoding=THREE.sRGBEncoding;rr.setClearColor(0x000000,0);
  const sc=new THREE.Scene();sc.add(new THREE.HemisphereLight(0xffffff,0x6f685f,.95));const dl=new THREE.DirectionalLight(0xfff0d8,1.05);dl.position.set(-2,3.2,2.4);sc.add(dl);
  const srcs={log:PROTO.log[0],rock:PROTO.rock[3]||PROTO.rock[0]};
  for(const k in srcs){const pr=srcs[k];if(!pr)continue;
   const P=pr.pos,n=P.length/3,pp=new Float32Array(P.length),cc=new Float32Array(P.length);
   for(let i=0;i<P.length;i++)pp[i]=P[i]/100;
   for(let i=0;i<n;i++){const c=pr.pal[pr.col[i]];cc[i*3]=c[0];cc[i*3+1]=c[1];cc[i*3+2]=c[2]}
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pp,3));geo.setAttribute('normal',new THREE.BufferAttribute(pr.nor,3));geo.setAttribute('color',new THREE.BufferAttribute(cc,3));geo.setIndex(new THREE.BufferAttribute(pr.idx,1));
   geo.computeBoundingBox();const bb=geo.boundingBox,ctr=bb.getCenter(new THREE.Vector3()),r=bb.getSize(new THREE.Vector3()).length()*.43;
   const m=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({vertexColors:true}));m.position.copy(ctr).negate();const holder=new THREE.Group();holder.add(m);if(k==='log')holder.rotation.y=-.55;sc.add(holder);
   const oc=new THREE.OrthographicCamera(-r,r,r,-r,.1,r*10);oc.position.set(r*1.5,r*1.2,r*2.2);oc.lookAt(0,0,0);
   rr.render(sc,oc);ICON[k]=rr.domElement.toDataURL('image/png');
   sc.remove(holder);geo.dispose();m.material.dispose();
  }
  rr.dispose();if(rr.forceContextLoss)rr.forceContextLoss();
 }catch(e){console.warn('[OWM] Ícones 3D indisponíveis, usando formas simples.',e)}
}
function invRender(){for(const k of['s','c'])inv[k].forEach((it,i)=>{const d=slotEl[k][i];d.textContent='';d.title=it?ITEMS[it.t].n:'';if(it){if(ICON[it.t]){const im=E('img','it',null,d);im.src=ICON[it.t];im.draggable=false}else E('i','it '+it.t,null,d);if(it.n>1)E('b','',it.n,d)}d.classList.toggle('sel',!!invSel&&invSel.k===k&&invSel.i===i)})}
function slotClick(k,i){
 if(!invSel){if(inv[k][i])invSel={k,i};invRender();return}
 const a=invSel;invSel=null;
 if(a.k!==k||a.i!==i){const src=inv[a.k][a.i],dst=inv[k][i];
  if(src){if(!dst){inv[k][i]=src;inv[a.k][a.i]=null}
   else if(dst.t===src.t){const m=Math.min(src.n,STACK-dst.n);dst.n+=m;src.n-=m;if(src.n<=0)inv[a.k][a.i]=null}
   else{inv[k][i]=src;inv[a.k][a.i]=dst}}}
 invRender();
}
function openInv(){if(state!=='play')return;state='pause';breaking=false;mining=false;cEl.classList.add('hidden');if(document.exitPointerLock)document.exitPointerLock();invOpen=true;invSel=null;buildIcons();invRender();go('inv')}
function closeInv(){if(!invOpen)return;invOpen=false;invSel=null;saveWorld();resume()}
addEventListener('keydown',e=>{if(invOpen&&(e.code==='KeyE'||e.code==='Escape')){e.preventDefault();closeInv()}});
/* coleta: texto "Coletar" sobre a tora/pedra pequena mais próxima */
const cEl=$('#collect'),_cv=new THREE.Vector3();let cTgt=null,cT=0;
cEl.textContent=touch?'Coletar':'Coletar [F]';
/* coletável = toda tora, ou pedra pequena (até ~0,6 m de altura e ~1,4 m de largura) */
const isSmall=c=>c.k==='log'||(c.k==='rock'&&c.hy<=.6&&c.hx<=.7&&c.hz<=.7);
function findCollect(){
 let best=null,bd=2.4;const px=P.p.x,pz=P.p.z,pcx=px>>4,pcz=pz>>4;
 for(let a=pcx-1;a<=pcx+1;a++)for(let b=pcz-1;b<=pcz+1;b++){const l=world.col.get(ck(a,b));if(!l)continue;
  for(const c of l){if(!isSmall(c))continue;if(Math.abs(c.y0-P.p.y)>2.5)continue;
   const d=Math.hypot(c.x-px,c.z-pz)-Math.max(c.hx,c.hz);if(d<bd){bd=d;best=c}}}
 return best}
function updateCollect(dt){
 cT-=dt;if(cT<=0){cT=.12;cTgt=findCollect()}
 if(cTgt){const rem=world.edits['p'+cTgt.cx+','+cTgt.cz];if(rem&&rem[cTgt.id])cTgt=null}
 if(!cTgt||!S.collect){cEl.classList.add('hidden');return}
 cam.updateMatrixWorld();_cv.set(cTgt.x,cTgt.y0+Math.min(cTgt.hy,1.2)+.35,cTgt.z).project(cam);
 if(_cv.z>1||Math.abs(_cv.x)>1.05||Math.abs(_cv.y)>1.05){cEl.classList.add('hidden');return}
 cEl.style.left=(_cv.x*.5+.5)*innerWidth+'px';cEl.style.top=(-_cv.y*.5+.5)*innerHeight+'px';cEl.classList.remove('hidden');
}
function doCollect(){
 if(state!=='play'||!cTgt)return;const c=cTgt;
 if(!invAdd(c.k,1)){toast('Inventário cheio');return}
 const key='p'+c.cx+','+c.cz,rem=world.edits[key]||(world.edits[key]={});rem[c.id]=1;meshChunk(c.cx,c.cz);
 toast('+1 '+ITEMS[c.k].n);cTgt=null;cT=0;cEl.classList.add('hidden');
}
cEl.addEventListener('click',doCollect);
{const b=$('#bInv');if(b){b.addEventListener('touchstart',e=>{openInv();e.preventDefault()},{passive:false});b.addEventListener('click',openInv)}}

/* tocar/clicar direto na tora ou pedra pequena também coleta (funciona com o texto invisível) */
const _ray=new THREE.Raycaster(),_nd=new THREE.Vector2();
function tapCollect(x,y){
 if(state!=='play')return false;
 cam.updateMatrixWorld();_nd.set(x/innerWidth*2-1,-(y/innerHeight)*2+1);_ray.setFromCamera(_nd,cam);
 const o=_ray.ray.origin,d=_ray.ray.direction,ph=rayProp(o,d,14);
 if(!ph||!isSmall(ph.c))return false;
 const bh=ray(o,d,14);if(bh&&bh.t<ph.t)return false;
 const c=ph.c;
 if(Math.hypot(c.x-P.p.x,c.z-P.p.z)-Math.max(c.hx,c.hz)>3.2||Math.abs(c.y0-P.p.y)>3){toast('Chegue mais perto');return true}
 cTgt=c;doCollect();return true;
}
if(touch){const lk2=$('#look');let tid=null,t0=0,sx=0,sy=0;
 lk2.addEventListener('touchstart',e=>{if(tid==null){const t=e.changedTouches[0];tid=t.identifier;t0=performance.now();sx=t.clientX;sy=t.clientY}},{passive:true});
 lk2.addEventListener('touchend',e=>{for(const t of e.changedTouches)if(t.identifier===tid){tid=null;if(performance.now()-t0<350&&Math.hypot(t.clientX-sx,t.clientY-sy)<14)tapCollect(t.clientX,t.clientY)}},{passive:true});
 lk2.addEventListener('touchcancel',()=>{tid=null},{passive:true})}
else addEventListener('mousedown',e=>{if(e.button===0&&state==='play'&&!document.pointerLockElement&&!S.lockMouse&&!(e.target.closest&&e.target.closest('#hud button')))tapCollect(e.clientX,e.clientY)});

/* ---------- Entrada ---------- */
addEventListener('keydown',e=>{keys[e.code]=true;if(state==='play'){if(e.code==='Escape')pause();else if(e.code==='KeyV'){S.camMode=(S.camMode+1)%2;tp3=S.camMode===1;st('bc.s',S)}else if(e.code==='KeyE')openInv();else if(e.code==='KeyF')doCollect();else if(/^F[1-4]$/.test(e.code)){e.preventDefault();playAnimByIndex(+e.code[1]-1)}if(e.code==='Space')e.preventDefault();}});
addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;breaking=false;jumpHeld=false;rmbDown=false;sprintTog=false});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&state==='play'&&!touch&&S.lockMouse)pause()});
addEventListener('mousemove',e=>{if(state!=='play'||touch)return;if(document.pointerLockElement)look(e.movementX,e.movementY,.0022);else if(!S.lockMouse&&rmbDown){rmbMoved+=Math.abs(e.movementX)+Math.abs(e.movementY);look(e.movementX,e.movementY,.0022)}});
function look(dx,dy,k){const s=k*S.sens/100;P.yaw-=dx*s;P.pitch=cl(P.pitch-dy*s*(S.invert?-1:1),-1.55,1.55)}
addEventListener('mousedown',e=>{if(state!=='play'||touch)return;if(e.target.closest&&e.target.closest('#hud button'))return;if(S.lockMouse&&!document.pointerLockElement){lock();return}if(e.button===0)breaking=true;else if(e.button===2){if(!S.lockMouse){rmbDown=true;rmbT=performance.now();rmbMoved=0;$('#c').style.cursor='none'}}});
addEventListener('mouseup',e=>{if(e.button===0)breaking=false;if(e.button===2&&rmbDown){rmbDown=false;$('#c').style.cursor=S.lockMouse?'':'crosshair';}});
addEventListener('contextmenu',e=>e.preventDefault());

if(touch){let lid=null,lx=0,ly=0,jid=null;const joyE=$('#joy'),knob=$('#knob'),lk=$('#look');const tch=(e,id)=>[...e.changedTouches].find(t=>t.identifier===id);lk.addEventListener('touchstart',e=>{if(lid!=null)return;const t=e.changedTouches[0];lid=t.identifier;lx=t.clientX;ly=t.clientY;e.preventDefault()},{passive:false});lk.addEventListener('touchmove',e=>{const t=tch(e,lid);if(!t)return;if(state==='play')look(t.clientX-lx,t.clientY-ly,.005);lx=t.clientX;ly=t.clientY;e.preventDefault()},{passive:false});const lend=e=>{if(tch(e,lid))lid=null};lk.addEventListener('touchend',lend);lk.addEventListener('touchcancel',lend);const jm=t=>{const r=joyE.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=t.clientX-cx,dy=t.clientY-cy;const l=Math.hypot(dx,dy);if(l>50){dx*=50/l;dy*=50/l}joy.x=dx/50;joy.y=dy/50;knob.style.left=41+dx+'px';knob.style.top=41+dy+'px'};joyE.addEventListener('touchstart',e=>{const t=e.changedTouches[0];jid=t.identifier;jm(t);e.preventDefault()},{passive:false});joyE.addEventListener('touchmove',e=>{const t=tch(e,jid);if(t)jm(t);e.preventDefault()},{passive:false});const jend=e=>{if(tch(e,jid)){jid=null;joy.x=joy.y=0;knob.style.left=knob.style.top='41px'}};joyE.addEventListener('touchend',jend);joyE.addEventListener('touchcancel',jend);const hold=(id,on,off)=>{const b=$(id);if(!b)return;b.addEventListener('touchstart',e=>{on();e.preventDefault()},{passive:false});b.addEventListener('touchend',off);b.addEventListener('touchcancel',off)};hold('#bJump',()=>jumpHeld=true,()=>jumpHeld=false);hold('#bPunch',()=>{if(state==='play'){if(anim.punch)anim.punch();punchT=.3}},()=>{});$('#bPause').onclick=pause;$('#bSprint').addEventListener('touchstart',e=>{sprintTog=!sprintTog;e.preventDefault()},{passive:false});}

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
const n=Math.ceil(dt/.016),sd=dt/n;for(let i=0;i<n;i++){if(!swim)P.vel.y=Math.max(-32,P.vel.y-26*sd);if(moveAxis('x',P.vel.x*sd))P.vel.x=0;if(moveAxis('z',P.vel.z*sd))P.vel.z=0;{const q=P.p,sg=sup(q.x,q.z);if(sg>q.y){if(!hitsObj(q.x,sg,q.z))q.y=sg}else if(P.og&&P.vel.y<=0&&q.y-sg<.36)q.y=sg}const was=P.og,dy=P.vel.y*sd;if(moveAxis('y',dy)){if(dy<0){P.og=true;if(!was){P.landV=-P.vel.y;const fd=P.peak-P.p.y;if(fd>3.4){hurt(FALL_DMG);addTrauma(Math.min(0.6,fd*0.08))}}P.peak=P.p.y}P.vel.y=0}else{P.og=false;P.peak=Math.max(P.peak,P.p.y)}}if(P.og||swim)P.peak=P.p.y;if(P.p.y<-20)hurt(MAXHP);P.hpT+=dt;if(P.hp<MAXHP&&P.hpT>.6&&!HT.over&&!PZ.on){P.hp++;P.hpT=0;refreshHealth()}}
/* ---------- Biomas: aviso ao entrar, clima do cerejeiral e pétalas ----------
   BIOMES (acima) lista os biomas por peso. bCur = bioma atual (com histerese pra não piscar na borda); cWt = peso suavizado do cerejeiral. */
let bCur='',bInit=false,cWt=0;
const PN=150,PET={pts:null,pos:null,vel:null,ph:null,mat:null};
function mkPetals(){
 const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d');
 g.translate(16,16);g.rotate(.6);const gr=g.createRadialGradient(0,0,1,0,0,14);gr.addColorStop(0,'rgba(255,226,236,1)');gr.addColorStop(.65,'rgba(246,166,196,.95)');gr.addColorStop(1,'rgba(246,166,196,0)');
 g.fillStyle=gr;g.beginPath();g.ellipse(0,0,14,8,0,0,6.2832);g.fill();
 const tex=new THREE.CanvasTexture(c);tex.encoding=THREE.sRGBEncoding;
 PET.mat=new THREE.PointsMaterial({map:tex,size:.2,sizeAttenuation:true,transparent:true,depthWrite:false,alphaTest:.02,opacity:0});
 PET.pos=new Float32Array(PN*3);PET.vel=new Float32Array(PN*3);PET.ph=new Float32Array(PN);
 for(let i=0;i<PN;i++){PET.pos[i*3+1]=-999;PET.ph[i]=Math.random()*6.2832}
 const g2=new THREE.BufferGeometry();g2.setAttribute('position',new THREE.BufferAttribute(PET.pos,3));
 PET.pts=new THREE.Points(g2,PET.mat);PET.pts.frustumCulled=false;PET.pts.renderOrder=2;scene.add(PET.pts);
}
function updatePetals(dt,w){
 if(w<.04){if(PET.pts)PET.pts.visible=false;return}
 if(!PET.pts)mkPetals();
 PET.pts.visible=true;PET.mat.opacity=Math.min(1,w*1.6);
 const px=P.p.x,py=P.p.y,pz=P.p.z,pos=PET.pos,vel=PET.vel;
 for(let i=0;i<PN;i++){
  const o=i*3;let x=pos[o],y=pos[o+1],z=pos[o+2];
  PET.ph[i]+=dt*(1.2+(i%5)*.15);
  if(y<-900||Math.abs(x-px)>20||Math.abs(z-pz)>20||y>py+11||y<groundH(x,z)+.03){
   x=px+(Math.random()-.5)*38;z=pz+(Math.random()-.5)*38;const gy=groundH(x,z);y=Math.max(gy+.5,py-1)+Math.random()*(py+10-Math.max(gy+.5,py-1));
   vel[o]=.35+Math.random()*.5;vel[o+1]=-(.35+Math.random()*.35);vel[o+2]=(Math.random()-.5)*.4}
  x+=(vel[o]+Math.sin(PET.ph[i])*.45)*dt;z+=(vel[o+2]+Math.cos(PET.ph[i]*.8)*.4)*dt;y+=vel[o+1]*dt;
  pos[o]=x;pos[o+1]=y;pos[o+2]=z}
 PET.pts.geometry.attributes.position.needsUpdate=true;
}
function updateBiome(dt){
 const x=P.p.x,z=P.p.z;let best='',bw=0;
 for(const[id,,fn,tin,tout]of BIOMES){const w=fn(x,z);if(w>=(bCur===id?tout:tin)&&w>bw){best=id;bw=w}}
 if(best!==bCur){bCur=best;if(bInit&&best)toast('Bioma: '+BIOMES.find(b=>b[0]===best)[1])}
 bInit=true;
 cWt+=(cherryW(x,z)-cWt)*(1-Math.exp(-dt*1.2));
 if(OWM.post.setBiome)OWM.post.setBiome(cWt);
 updatePetals(dt,cWt);
}

/* ---------- Calor do deserto ----------
   HT.t = segundos de exposição acumulados. Dentro do deserto sobe 1/s; ao passar de LIMIT+bônus toma DMG de dano por segundo.
   Fora do deserto desce COOL/s. Dentro de água (rasa) para de esquentar; nadando refresca rápido e aumenta o limite (bônus). */
const HEAT={LIMIT:150,DMG:4,COOL:3,WADE:4,SWIM:10,BONUS:6,BONUS_MAX:150,BONUS_DECAY:3,THR:.3};
const HT={t:0,b:0,over:false,dt:0,fx:0,fxd:-1,sec:-1,cls:''};
function heatFx(v,over){HT.fxd=v;const e=$('#heat');e.style.opacity=Math.min(1,v);e.classList.toggle('over',!!over);OWM.post.setHeat(v)}
function heatReset(){HT.t=0;HT.b=0;HT.over=false;HT.dt=0;HT.fx=0;HT.sec=-1;HT.cls='';heatFx(0,false);$('#heat-ic').className=''}
let musDes=false;
function updateHeat(dt){
 const dw=desertW(P.p.x,P.p.z),inD=dw>=HEAT.THR;
 if(OWM.musicBiome){const m=musDes?dw>=.2:dw>=.3;if(m!==musDes){musDes=m;OWM.musicBiome(m?'desert':'')}}   // música do deserto, com histerese
 const wd=waterSurf(P.p.x,P.p.z)-P.p.y,swim=wd>.75,wade=wd>.15;
 if(swim){HT.t=Math.max(0,HT.t-HEAT.SWIM*dt);if(inD)HT.b=Math.min(HEAT.BONUS_MAX,HT.b+HEAT.BONUS*dt)}
 else if(wade)HT.t=Math.max(0,HT.t-HEAT.WADE*dt);
 else if(inD)HT.t+=dt;
 else HT.t=Math.max(0,HT.t-HEAT.COOL*dt);
 if(!inD&&HT.t<=0)HT.b=Math.max(0,HT.b-HEAT.BONUS_DECAY*dt);
 const lim=HEAT.LIMIT+HT.b;HT.t=Math.min(HT.t,lim+8);
 const over=inD&&HT.t>lim;if(over&&!HT.over)HT.dt=1;HT.over=over;   // o primeiro tick de dano vem na hora
 if(over){HT.dt+=dt;while(HT.dt>=1){HT.dt-=1;hurt(HEAT.DMG,true,'Você morreu de calor!')}}else HT.dt=0;
 /* HUD: ícone ao lado da barra de vida + tempo restante */
 const left=Math.max(0,lim-HT.t),sec=Math.ceil(left),frac=Math.min(1,left/lim),cls=(inD||HT.t>.5?'show ':'')+(over?'over crit':frac<.25?'crit':frac<.5?'hot':'');
 if(sec!==HT.sec||cls!==HT.cls){const ic=$('#heat-ic');ic.className=cls;$('#heat-t').textContent=Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');$('#heat-ring').setAttribute('stroke-dashoffset',(100.53*(1-frac)).toFixed(2));HT.sec=sec;HT.cls=cls}
 /* efeito: miragem + tom quente + vinheta; some na água */
 const tgt=sstep(.1,.6,dw)*(.5+.5*Math.min(1,HT.t/lim))*(wade?.2:1);HT.fx+=(tgt-HT.fx)*Math.min(1,dt*2.5);
 if(Math.abs(HT.fx-HT.fxd)>.01||over!==HT.ov){HT.ov=over;heatFx(HT.fx,over)}
}
/* ---------- Veneno (escorpião) ----------
   O primeiro golpe aplica veneno: POISON_DUR s com 1 de dano por segundo; depois do efeito vem POISON_CD s em que não dá pra envenenar de novo. */
const PZ={on:false,el:0,n:0,cd:0,sec:-1,cls:'',fx:0};
function poisonReset(){PZ.on=false;PZ.el=0;PZ.n=0;PZ.cd=0;PZ.sec=-1;PZ.cls='';PZ.fx=0;$('#pois-ic').className='';$('#pois').style.opacity=0}
function poisonApply(){if(PZ.on||PZ.cd>0)return false;PZ.on=true;PZ.el=0;PZ.n=0;return true}
function updatePoison(dt){
 if(PZ.on){PZ.el+=dt;while(PZ.n<SCP.POISON_DUR&&PZ.el>=PZ.n+1){PZ.n++;hurt(SCP.POISON_DPS,true,'Você morreu envenenado!')}if(PZ.el>=SCP.POISON_DUR&&PZ.n>=SCP.POISON_DUR){PZ.on=false;PZ.cd=SCP.POISON_CD}}
 else if(PZ.cd>0)PZ.cd=Math.max(0,PZ.cd-dt);
 const left=PZ.on?SCP.POISON_DUR-PZ.el:PZ.cd,tot=PZ.on?SCP.POISON_DUR:SCP.POISON_CD,sec=Math.ceil(left),cls=PZ.on?'show on':PZ.cd>0?'show cd':'';
 if(sec!==PZ.sec||cls!==PZ.cls){PZ.sec=sec;PZ.cls=cls;$('#pois-ic').className=cls;$('#pois-t').textContent=sec>0?sec+'s':'';$('#pois-ring').setAttribute('stroke-dashoffset',(100.53*(1-Math.min(1,left/tot))).toFixed(2))}
 else if(cls)$('#pois-ring').setAttribute('stroke-dashoffset',(100.53*(1-Math.min(1,left/tot))).toFixed(2));
 PZ.fx+=((PZ.on?.55:0)-PZ.fx)*Math.min(1,dt*5);const o=PZ.fx>.01?PZ.fx:0;if(o!==PZ.o){PZ.o=o;$('#pois').style.opacity=o}
}

/* ---------- Escorpiões ----------
   Nascem no deserto (spawner dinâmico ao redor do jogador). Se veem o jogador (alcance + campo de visão + linha de visada) correm nele e atacam:
   SCP.DMG de dano por golpe e veneno no primeiro golpe. Têm SCP.HP de vida e SCP.ARMOR de proteção (o soco de SCP.PUNCH vira PUNCH*(1-ARMOR)). */
const SCP={HP:100,ARMOR:.2,PUNCH:7,PUNCH_CD:.5,PUNCH_RANGE:3,BODY_R:.7,DMG:4,SPEED:7,CHASE_ANIM:1.45,WALK:1.3,SIGHT:20,FOV_COS:-.2,ATK_RANGE:2,ATK_CD:.25,ATK_SPEED:1.7,TURN_ATK:7,MAX:6,SPAWN_MIN:24,SPAWN_MAX:50,DESPAWN:85,POISON_DUR:3,POISON_DPS:1,POISON_CD:3};
const SCF=(OWM.Scorpion&&OWM.scorpionPack)?OWM.Scorpion(THREE):null,scs=[],scBarGeo=new THREE.PlaneGeometry(1,1);let scSpawnT=2,pDmgT=0,punchT=0;
function scBlocked(s,x,z){const gy=groundH(x,z);if(waterSurf(x,z)-gy>.15)return true;if(gy-s.y>1.1)return true;return propHits(x,gy-1.2,z)}
function scMove(s,dx,dz){if(!scBlocked(s,s.x+dx,s.z))s.x+=dx;if(!scBlocked(s,s.x,s.z+dz))s.z+=dz}
function scLOS(s){const ex=s.x,ey=s.y+.5,ez=s.z,tx=P.p.x,ty=P.p.y+1.2,tz=P.p.z;for(let i=1;i<=6;i++){const k=i/7;if(groundH(ex+(tx-ex)*k,ez+(tz-ez)*k)>ey+(ty-ey)*k+.15)return false}return true}
function scRemove(s){scene.remove(s.inst.group);scene.remove(s.hb);s.inst.dispose();s.bgM.dispose();s.fillM.dispose();const i=scs.indexOf(s);if(i>=0)scs.splice(i,1)}
function scReset(){while(scs.length)scRemove(scs[0]);scSpawnT=2;pDmgT=0;punchT=0}
function scSpawn(x,z){
 if(!SCF)return;const inst=SCF.create(),g=inst.group;g.scale.setScalar(SCF.SCALE);g.rotation.order='YXZ';inst.mesh.castShadow=inst.mesh.receiveShadow=true;scene.add(g);inst.play('idle',0);
 const hb=new THREE.Group(),bgM=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.7,depthTest:false}),fillM=new THREE.MeshBasicMaterial({color:0xe04a3a,depthTest:false}),bg=new THREE.Mesh(scBarGeo,bgM),fill=new THREE.Mesh(scBarGeo,fillM);
 bg.scale.set(1.05,.17,1);fill.scale.set(1,.11,1);fill.position.z=.001;bg.renderOrder=998;fill.renderOrder=999;hb.add(bg,fill);hb.visible=false;scene.add(hb);
 const s={inst,hb,bgM,fillM,fill,x,z,y:groundH(x,z),yaw:Math.random()*6.2832,hp:SCP.HP,st:'idle',t:1+Math.random()*3,tx:0,tz:0,cd:0,flash:0,kx:0,kz:0,dead:0,sees:false,seeT:Math.random()*.2,lost:0};
 scs.push(s);return s;
}
function scHurt(s,amount){
 if(s.st==='dead')return;const d=amount*(1-SCP.ARMOR);s.hp=Math.max(0,s.hp-d);s.flash=.18;
 const dx=s.x-P.p.x,dz=s.z-P.p.z,l=Math.hypot(dx,dz)||1;s.kx=dx/l*3.4;s.kz=dz/l*3.4;
 s.hb.visible=true;const r=s.hp/SCP.HP;s.fill.scale.x=Math.max(.001,r);s.fill.position.x=-(1-r)*.5;
 if(s.hp<=0){s.st='dead';s.dead=0;s.inst.play('idle',.1);return}
 if(s.st!=='attack'){s.st='chase';s.inst.play('run',.1)}s.sees=true;s.lost=0;
}
function scAim(){   // alvo do soco: escorpião mais próximo dentro do alcance e de um cone HORIZONTAL à frente do jogador; a inclinação da câmera (pitch) não importa
 const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw);let best=null;
 for(const s of scs){if(s.st==='dead')continue;
  const dx=s.x-P.p.x,dz=s.z-P.p.z,d=Math.hypot(dx,dz);
  if(d>SCP.PUNCH_RANGE||Math.abs(s.y-P.p.y)>2)continue;
  if(d>.05){const ca=Math.max(-1,Math.min(1,(dx*fx+dz*fz)/d)),lim=Math.max(.5,Math.atan2(SCP.BODY_R+.3,d));if(Math.acos(ca)>lim)continue}   // cone: no mínimo ~29°, e mais largo quanto mais perto
  const t=Math.hypot(dx,s.y+.35-eye.y,dz);if(!best||t<best.t)best={s,t}}
 return best;
}
function scPunch(s){if(pDmgT>0)return;pDmgT=SCP.PUNCH_CD;scHurt(s,SCP.PUNCH)}
function scFace(s,dx,dz,rate,dt){const want=Math.atan2(dx,dz);let d=want-s.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));s.yaw+=Math.max(-rate*dt,Math.min(rate*dt,d))}
function scUpdate(s,dt){
 const g=s.inst.group,gy=groundH(s.x,s.z);s.y+=(gy-s.y)*Math.min(1,dt*14);
 if(s.st==='dead'){s.dead+=dt;g.rotation.set(0,s.yaw,Math.PI*Math.min(1,s.dead/.4));g.position.set(s.x,s.y+(s.dead<.4?Math.sin(Math.min(1,s.dead/.4)*Math.PI)*.25:0),s.z);
  if(s.dead>3.5)g.scale.setScalar(SCF.SCALE*Math.max(.001,1-(s.dead-3.5)));s.inst.update(dt,.3);s.hb.visible=false;if(s.dead>4.5)scRemove(s);return}
 const dx=P.p.x-s.x,dz=P.p.z-s.z,dist=Math.hypot(dx,dz),dy=Math.abs(P.p.y-s.y);
 s.cd-=dt;
 if(s.kx||s.kz){scMove(s,s.kx*dt,s.kz*dt);const k=Math.exp(-dt*9);s.kx*=k;s.kz*=k;if(Math.abs(s.kx)+Math.abs(s.kz)<.1)s.kx=s.kz=0}
 s.seeT-=dt;if(s.seeT<=0){s.seeT=.2+Math.random()*.1;s.sees=P.hp>0&&dist<SCP.SIGHT&&(dist<5||(Math.sin(s.yaw)*dx+Math.cos(s.yaw)*dz)/dist>SCP.FOV_COS)&&scLOS(s)}
 if(s.sees)s.lost=0;else s.lost+=dt;
 let spd=1;
 if(s.st==='idle'||s.st==='wander'){
  if(s.sees){s.st='chase';s.inst.play('run',.12)}
  else if(s.st==='idle'){s.t-=dt;if(s.t<=0){const a=Math.random()*6.2832,r=3+Math.random()*6,tx=s.x+Math.sin(a)*r,tz=s.z+Math.cos(a)*r;if(desertW(tx,tz)>.4){s.tx=tx;s.tz=tz;s.st='wander';s.t=r/SCP.WALK+.5;s.inst.play('run',.2)}else s.t=1.5}}
  else{const wx=s.tx-s.x,wz=s.tz-s.z,wl=Math.hypot(wx,wz);s.t-=dt;if(wl<.4||s.t<=0){s.st='idle';s.t=2+Math.random()*4;s.inst.play('idle',.25)}else{scFace(s,wx,wz,3,dt);scMove(s,Math.sin(s.yaw)*SCP.WALK*dt,Math.cos(s.yaw)*SCP.WALK*dt);spd=SCP.WALK/4.6*1.2}}
 }
 else if(s.st==='chase'){
  if(s.lost>4||P.hp<=0){s.st='idle';s.t=1.5;s.inst.play('idle',.25)}
  else{scFace(s,dx,dz,9,dt);
   if(dist<SCP.ATK_RANGE&&s.cd<=0&&dy<1.5){s.st='attack';s.inst.play('attack',.08,true)}
   else if(dist>SCP.ATK_RANGE*.85){scMove(s,Math.sin(s.yaw)*SCP.SPEED*dt,Math.cos(s.yaw)*SCP.SPEED*dt);if(s.inst.clip!=='run')s.inst.play('run',.12)}
   else if(s.inst.clip!=='idle')s.inst.play('idle',.15)}
 }
 else if(s.st==='attack'){scFace(s,dx,dz,SCP.TURN_ATK,dt);if(dist>1.2)scMove(s,Math.sin(s.yaw)*SCP.SPEED*.5*dt,Math.cos(s.yaw)*SCP.SPEED*.5*dt)}
 const ev=s.inst.update(dt,s.st==='attack'?SCP.ATK_SPEED:s.st==='chase'?SCP.CHASE_ANIM:s.st==='wander'?spd:1);
 if(s.st==='attack'){
  if(ev){const reach=SCP.ATK_RANGE+.5;if(dist<reach&&dy<1.7){hurt(SCP.DMG,false,'Um escorpião te matou!');poisonApply()}scMove(s,Math.sin(s.yaw)*.25,Math.cos(s.yaw)*.25)}
  if(s.inst.done){s.st='chase';s.cd=SCP.ATK_CD;s.inst.play('run',.1)}
 }
 g.rotation.set(0,s.yaw,0);g.position.set(s.x,s.y,s.z);
 if(s.flash>0){s.flash=Math.max(0,s.flash-dt);const f=s.flash/.18;s.inst.mat.emissive.setRGB(f*.9,f*.12,f*.05)}else if(s.inst.mat.emissive.r)s.inst.mat.emissive.setRGB(0,0,0);
 if(s.hb.visible){s.hb.position.set(s.x,s.y+1.15,s.z);s.hb.quaternion.copy(cam.quaternion)}
}
function updateScorpions(dt){
 if(!SCF)return;pDmgT=Math.max(0,pDmgT-dt);
 const dwP=desertW(P.p.x,P.p.z);
 scSpawnT-=dt;
 if(scSpawnT<=0){scSpawnT=1.2+Math.random()*1.5;
  const alive=scs.filter(s=>s.st!=='dead').length,maxN=dwP<.15?0:Math.round(2+4*sstep(.3,.8,dwP));
  if(alive<Math.min(maxN,SCP.MAX))for(let a=0;a<8;a++){const an=Math.random()*6.2832,r=SCP.SPAWN_MIN+Math.random()*(SCP.SPAWN_MAX-SCP.SPAWN_MIN),x=P.p.x+Math.sin(an)*r,z=P.p.z+Math.cos(an)*r;
   if(desertW(x,z)<.5)continue;const gy=groundH(x,z);if(waterSurf(x,z)-gy>-.5||propHits(x,gy-1.2,z))continue;if(scs.some(o=>Math.hypot(o.x-x,o.z-z)<6))continue;scSpawn(x,z);break}
 }
 for(let i=scs.length-1;i>=0;i--){const s=scs[i];
  const d=Math.hypot(s.x-P.p.x,s.z-P.p.z);if(d>SCP.DESPAWN||(dwP<.1&&d>40&&s.st!=='chase'&&s.st!=='attack')){scRemove(s);continue}
  scUpdate(s,dt)}
}

function hurt(n,soft,msg){P.hp-=n;P.hpT=0;addTrauma(soft?.12:0.5);if(anim.hit)anim.hit(soft?.3:Math.min(1,n/8+.25));if(P.hp<=0){P.hp=MAXHP;P.st=MAXST;P.p.set(spawn[0],spawn[1],spawn[2]);P.vel.set(0,0,0);P.peak=P.p.y;heatReset();poisonReset();for(const q of scs)q.sees=false;toast(msg||'Você morreu!')}refreshHealth()}

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
function tick(dt){physics(dt);updateHeat(dt);updateBiome(dt);updatePoison(dt);updateScorpions(dt);playerWake(dt);eye.set(P.p.x,P.p.y+1.62,P.p.z);const cp=Math.cos(P.pitch);fwd.set(-Math.sin(P.yaw)*cp,Math.sin(P.pitch),-Math.cos(P.yaw)*cp);hit=ray(eye,fwd,REACH);phit=rayProp(eye,fwd,REACH);if(phit&&hit&&hit.t<phit.t)phit=null;else if(phit)hit=null;
const stg=scAim(),scFirst=stg&&(!hit||hit.terr||stg.t<hit.t+.6)&&(!phit||stg.t<phit.t+.6),wantHit=breaking||punchT>0;punchT=Math.max(0,punchT-dt);
if(wantHit&&scFirst){scPunch(stg.s);mining=breaking;prog=0;tgtKey='';crackMesh.visible=false}
else if(breaking&&phit){const c=phit.c,key='p'+c.cx+','+c.cz+','+c.id;if(key!==tgtKey){tgtKey=key;prog=0}prog+=dt;mining=true;const stage=Math.min(9,Math.floor(prog/c.hard*10)),ch=Math.min(c.hy,2.2);crackMesh.visible=true;crackMesh.scale.set(c.hx*2+.06,ch,c.hz*2+.06);crackMesh.position.set(c.x,c.y0+ch/2,c.z);if(crackMat.map!==crackTextures[stage]){crackMat.map=crackTextures[stage];crackMat.needsUpdate=true}if(prog>=c.hard){breakProp(c);prog=0;tgtKey='';crackMesh.visible=false}}
else if(breaking&&hit&&!hit.terr&&hit.y>0){const key=hit.x+','+hit.y+','+hit.z;if(key!==tgtKey){tgtKey=key;prog=0}prog+=dt;mining=true;const hard=BL[getB(hit.x,hit.y,hit.z)].h;const stage=Math.min(9,Math.floor((prog/hard)*10));crackMesh.visible=true;crackMesh.scale.set(1,1,1);crackMesh.position.set(hit.x+.5,hit.y+.5,hit.z+.5);if(crackMat.map!==crackTextures[stage]){crackMat.map=crackTextures[stage];crackMat.needsUpdate=true}if(prog>=hard){breakAt(hit);prog=0;tgtKey=''}}else{mining=false;prog=0;tgtKey='';crackMesh.visible=false}if(mining)swT+=dt*12;const sp=Math.hypot(P.vel.x,P.vel.z);bobT+=sp*dt*1.7;if(playingAnim){animTime+=dt;if(animTime>playingAnim.duration){playingAnim=null;animTime=0}}if(tp3){let t=0;while(t<3.5){const q=t+.25,x=eye.x-fwd.x*q,y=eye.y-fwd.y*q,z=eye.z-fwd.z*q;if(getB(Math.floor(x),Math.floor(y),Math.floor(z))||y<groundH(x,z)+.15)break;t=q}cam.position.set(eye.x-fwd.x*t,eye.y-fwd.y*t,eye.z-fwd.z*t);}else{cam.position.copy(eye);cam.position.y+=anim.fx.dip;if(S.bob&&P.og){const bA=Math.min(1,sp/4.5);cam.position.y+=Math.sin(bobT*2)*0.012*bA;cam.position.x+=Math.cos(bobT)*0.008*bA}}cam.rotation.set(P.pitch,P.yaw,tp3?0:anim.fx.roll);const targetFov=S.fov+(sp>5?6:0);cam.fov+=(targetFov-cam.fov)*(1-Math.exp(-dt*8));cam.updateProjectionMatrix();updateCamShake(dt);anim.update(dt,{inGame:true,sprint:isSprint,tp3,p:P.p,vel:P.vel,og:P.og,mining,swT,cp:P.pitch,landV:P.landV,custom:playingAnim?{anim:playingAnim,time:animTime}:null});P.landV=0;updateParticles(dt);post.setGround(groundH(P.p.x,P.p.z));post.update(dt);updateWater(dt);if((saveT+=dt)>20){saveT=0;saveWorld()}updateCollect(dt);stream(P.p.x>>4,P.p.z>>4,S.dist,2);}

let last=performance.now();
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;if(state!=='play'&&HT.fx>0){HT.fx=0;heatFx(0,false)}if(state==='play'){tick(dt)}else if(state==='menu'){ma+=dt*.08;const h=hgt(0,0);cam.position.set(Math.cos(ma)*26,h+16,Math.sin(ma)*26);cam.lookAt(0,h-2,0);anim.update(dt,{inGame:false});post.setGround(h);post.update(dt);stream(0,0,4,2);}else if(state==='pause'){stream(P.p.x>>4,P.p.z>>4,S.dist,1);post.update(dt)}if(state!=='animedit'){post.render();}else{if(OWM.animedit)OWM.animedit.tick(dt);}if(++fc>=30){const t=performance.now();const fp=fc*1000/(t-ft0);if(S.fps)$('#fps').textContent=Math.round(fp)+' FPS';if(state==='play')post.adapt(fp);fc=0;ft0=t}}
addEventListener('beforeunload',saveWorld);
applyAll();showMenu();requestAnimationFrame(loop);
})();