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
const RGB=(r,g,b)=>(CLAMP(r)<<16)|(CLAMP(g)<<8)|CLAMP(b);   // cor empacotada 0xRRGGBB
let AI=null;const PCOL={};   // AI: buffer do atlas; PCOL: cache da cor das partículas por bloco
function putPx(x,y,c){const d=AI.data,i=(y*AI.width+x)*4;d[i]=c>>16;d[i+1]=(c>>8)&255;d[i+2]=c&255;d[i+3]=255}

function genPixel(idx,fn){const r=rng(idx*77+3);for(let y=0;y<16;y++)for(let x=0;x<16;x++)putPx(idx*16+x,y,fn(x,y,r()))}
function genHD(idx,fn){const r=rng(idx*77+3);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const u=(x/64)*16,v=(y/64)*16;putPx(idx*64+x,y,fn(u,v,r))}}
const RNOISE=(r,amt)=>(r()-0.5)*amt;

function buildAtlas(hd){
 const res=hd?64:16;AT.width=NT*res;AT.height=res;ag=AT.getContext('2d');ag.clearRect(0,0,AT.width,AT.height);AI=ag.createImageData(AT.width,AT.height);for(const k in PCOL)delete PCOL[k];
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
  genHD(3,(u,v,r)=>{const w=.3927,n=RNOISE(r,22),blot=Math.sin(u*w*2+Math.sin(v*w)*1.3)*Math.sin(v*w*2+Math.cos(u*w)*1.1)*10,crk=Math.abs(Math.sin(u*w+Math.sin(v*w*2)*.9))<.07?-26:0,q=r(),spk=q<.02?16:q>.985?-16:0,t=n+blot+crk+spk;return RGB(128+t*.98,128+t,128+t*1.04)});
  genHD(5,(u,v,r)=>{const n=RNOISE(r,25);const grain=Math.sin(u*3.2+v*0.3)*12;return RGB(102+n+grain,81+n+grain*0.75,49+n+grain*0.45)});
  genHD(6,(u,v,r)=>{const n=RNOISE(r,22);const d=Math.sqrt((u-8)**2+(v-8)**2);const ring=Math.sin(d*2.2)>0.35?-16:0;return RGB(170+n+ring,140+n+ring*0.7,90+n+ring*0.5)});
  genHD(7,(u,v,r)=>{const n=RNOISE(r,45);if(r()<0.18) return RGB(25,60,22);return RGB(55+n,125+n,45+n*0.55)});
 }
 ag.putImageData(AI,0,0);
 if(atlas)atlas.dispose();
 atlas=new THREE.CanvasTexture(AT);atlas.magFilter=hd?THREE.LinearFilter:THREE.NearestFilter;atlas.minFilter=hd?THREE.LinearMipmapLinearFilter:THREE.NearestFilter;atlas.generateMipmaps=hd;atlas.encoding=THREE.sRGBEncoding;atlas.anisotropy=hd?(OWM.touch?1:4):1;
 if(chunkMat){chunkMat.map=atlas;chunkMat.needsUpdate=true;}
 
}
function initMaterials(){if(!chunkMat){chunkMat=new THREE.MeshLambertMaterial({map:atlas,vertexColors:true});OWM.extraMats.push(()=>[chunkMat]);}}
let lastHQ=(S.rq===4&&S.hdTex&&!OWM.touch)?1:0,lastHdTex=null;buildAtlas(S.hdTex);lastHdTex=S.hdTex;initMaterials();


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
const PGEO=new THREE.BoxGeometry(0.07,0.07,0.07);
function spawnBreakParticles(bx,by,bz,id){const b=BL[id];if(!b)return;let col=PCOL[id];if(!col){const res=S.hdTex?64:16;const px=ag.getImageData(b.s*res+res/2,(res/2)|0,1,1).data;col=PCOL[id]=new THREE.Color(px[0]/255,px[1]/255,px[2]/255)}const mt=new THREE.MeshBasicMaterial({color:col});for(let i=0;i<10;i++){const m=new THREE.Mesh(PGEO,mt);m.position.set(bx+0.5+(Math.random()-0.5)*0.6,by+0.5+Math.random()*0.6,bz+0.5+(Math.random()-0.5)*0.6);scene.add(m);particles.push({m,vx:(Math.random()-0.5)*4,vy:Math.random()*4+2,vz:(Math.random()-0.5)*4,life:0.8});}}
function updateParticles(dt){rbxUpdate(dt);shkUpdate(dt);for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.vy-=(p.g===undefined?20:p.g)*dt;if(p.sh)p.m.scale.setScalar(Math.max(.05,p.life/p.l0));p.m.position.x+=p.vx*dt;p.m.position.y+=p.vy*dt;p.m.position.z+=p.vz*dt;if(p.life<=0){scene.remove(p.m);if(!particles.some(q=>q!==p&&q.m.material===p.m.material))p.m.material.dispose();particles.splice(i,1)}}}

/* ---------- Mundo ---------- */
const world={seed:1,chunks:new Map(),meshes:new Map(),col:new Map(),edits:{}};
OWM.leaves.setGround(groundH);   // folhas caindo pousam no chão (bioflorest.js)
const TMPHIDE=new Set(),TFX=new Map();   // árvores soltas do chunk enquanto tremem/caem (não persiste)
let NZ=null;
function mkNoise(seed){const h=(x,z)=>{let n=(Math.imul(x,374761393)+Math.imul(z,668265263)+Math.imul(seed,1274126177))|0;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296};return(x,z)=>{const xi=Math.floor(x),zi=Math.floor(z),fx=x-xi,fz=z-zi,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz),a=h(xi,zi),b=h(xi+1,zi),c=h(xi,zi+1),d=h(xi+1,zi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}}
/*TERRAIN-BEGIN*/
/* ---------- Terreno suave (heightfield) estilo Roblox ---------- */
const sstep=(a,b,v)=>{v=Math.max(0,Math.min(1,(v-a)/(b-a)));return v*v*(3-2*v)};
function fbm(x,z,oct){let a=.5,f=1,s=0,n=0;for(let i=0;i<oct;i++){s+=NZ((x*.8+z*.6)*f+i*17.3,(z*.8-x*.6)*f+i*9.1)*a;n+=a;a*=.5;f*=2.03}return s/n}
let H0=null,PLATE=false,LOBBY=false,CAMB=false,MAPY=0;const PLATE_H=18,PLATE_REP=16;   // PLATE: mundo "Test plate" = chão plano infinito (sem biomas, lagos, rios, montanhas nem props). PLATE_REP = metros por repetição da textura (2×2 tiles de 8 m)
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
const DES_SCALE=230*1.3*1.5,DES_THR=.555,DES_EDGE=.1,DES_CLEAR_A=120,DES_CLEAR_B=200; // escala +30% e depois +50% (v40)
const desertRaw=(x,z)=>fbm(x/DES_SCALE+137.5,z/DES_SCALE-61.2,3);
function desertW(x,z){
 if(PLATE)return 0;const d=Math.hypot(x,z);if(d<DES_CLEAR_A)return 0;
 return sstep(DES_THR,DES_THR+DES_EDGE,desertRaw(x,z))*sstep(DES_CLEAR_A,DES_CLEAR_B,d);
}
/* ---------- Bioma de cerejeiral ----------
   Mesmo esquema do deserto (função pura da semente, sem costura entre chunks), mas com ruído próprio: o mundo é dividido em MUITAS manchas
   independentes de cada bioma (estilo Minecraft), então o mesmo bioma aparece várias vezes, em lugares diferentes. Nunca dentro do deserto
   (o deserto tem prioridade; a borda se mistura) e nunca colado no spawn. */
const CH_SCALE=150*1.3*1.5,CH_THR=.55,CH_EDGE=.08,CH_CLEAR_A=60,CH_CLEAR_B=130; // escala +30% e depois +50% (v40)
const cherryRaw=(x,z)=>fbm(x/CH_SCALE+311.7,z/CH_SCALE-205.3,3);
function cherryW(x,z){
 if(PLATE)return 0;const d=Math.hypot(x,z);if(d<CH_CLEAR_A)return 0;
 return sstep(CH_THR,CH_THR+CH_EDGE,cherryRaw(x,z))*sstep(CH_CLEAR_A,CH_CLEAR_B,d)*(1-sstep(.02,.35,desertW(x,z)));
}
/* Bioma dominante em (x,z): '' = planície/floresta padrão. Usado pelo aviso de bioma, clima e música. */
const BIOMES=[['desert','Deserto',desertW,.3,.2],['cherry','Cerejeiral',cherryW,.3,.2]];   // [id, nome, peso(x,z), limiar p/ entrar, limiar p/ sair]
/* Relevo do deserto: mantém um pouco da forma original (morros viram mesas baixas) e soma dunas suaves. */
function desertH(x,z,b){return DUNE?20.4+(b-18)*.18+(duneAt(x,z)-.53)*DUP.h*1.05:18.6+(b-18)*.32+(fbm(x/46+21,z/31+5,3)-.5)*9}   // dunas do mapa de altura de dunes.js (sem o pack, volta ao relevo antigo)
function baseTerrain(x,z){
 if(H0===null)H0=rawH(0,0);
 const b=H0+(rawH(x,z)-H0)*sstep(14,46,Math.hypot(x,z));             // planície ao redor do spawn
 const w=desertW(x,z);let r=b;if(w>0)r=b+(desertH(x,z,b)-b)*sstep(0,.55,w);   // deserto: dunas
 if(MT.length&&mtnStamp(x,z)){if(MTf>0)r+=(MT_LVL-r)*Math.min(1,MTf);if(MTh>r)r=MTh}   // montanhas: chão aplainado em volta e silhueta do modelo gravada no mapa de altura (colisão sólida)
 return r;
}

/* ---------- Lagos (função pura de x,z + seed → sem costura entre chunks) ----------
   Uma célula de LAKE_CELL m pode ter 1 lago. O nível d'água é único por lago (o ponto mais baixo do anel em volta),
   a bacia é escavada com suavização e a margem sobe até o terreno original. Lagos só em terreno bem plano e longe do spawn. */
const LAKE_CELL=110,LAKE_CHANCE=.5,LAKE_CHANCE_DESERT=.07,DESERT_LAKE_CHANCE=.07,DESERT_LAKE_COUNT=3,LAKE_DESERT_THR=.3,LAKE_MIN_R=13,LAKE_MAX_R=30,LAKE_MIN_D=2,LAKE_MAX_D=4.5,LAKE_MAXSLOPE=3.2,LAKE_SPAWN_CLEAR=20;   // margem livre (m) entre a área de influência do lago e o spawn
const lakeCache=new Map(),lakeGeomCache=new Map(),desertLakeRegions=new Map();
/* Geometria do lago da célula (cx,cz): sempre sorteia na mesma ordem (u0 primeiro), então os lagos fora do deserto continuam idênticos.
   A validade (longe do spawn e terreno plano) só é calculada quando precisa (é a parte cara). */
function lakeGeom(cx,cz){
 const k=cx+','+cz;let G=lakeGeomCache.get(k);if(G)return G;
 const r=rng(hash('lk'+world.seed+','+k));
 const u0=r(),px=(cx+.2+r()*.6)*LAKE_CELL,pz=(cz+.2+r()*.6)*LAKE_CELL,R=LAKE_MIN_R+r()*(LAKE_MAX_R-LAKE_MIN_R),dep=LAKE_MIN_D+r()*(LAKE_MAX_D-LAKE_MIN_D),sx=r()*100,sz=r()*100;
 G={u0,px,pz,R,dep,sx,sz,L:undefined};lakeGeomCache.set(k,G);return G;
}
function lakeValid(G){   // devolve o lago pronto ({px,pz,R,dep,wl,sx,sz}) ou null se o terreno/spawn não permite
 if(G.L!==undefined)return G.L;
 let L=null;
 if(Math.hypot(G.px,G.pz)-G.R*2.44>LAKE_SPAWN_CLEAR){
  let mn=baseTerrain(G.px,G.pz),mx=mn;
  for(let i=0;i<8;i++){const a=i*.7854,hh=baseTerrain(G.px+Math.cos(a)*G.R*1.25,G.pz+Math.sin(a)*G.R*1.25);if(hh<mn)mn=hh;if(hh>mx)mx=hh}
  if(mx-mn<LAKE_MAXSLOPE)L={px:G.px,pz:G.pz,R:G.R,dep:G.dep,wl:mn-.15,sx:G.sx,sz:G.sz};
 }
 G.L=L;return L;
}
/* Deserto: cada região (do tamanho do bioma) sorteia pela semente se tem lagos (DESERT_LAKE_CHANCE = 7%); se tiver, ficam DESERT_LAKE_COUNT (3) lagos,
   escolhidos entre as células válidas e dentro do deserto da região. Devolve o Set de chaves "cx,cz" das células que ganham lago. */
const regionOfLakeCell=(c)=>Math.floor((c+.5)*LAKE_CELL/DES_SCALE);
function desertLakeCells(rx,rz){
 const key=rx+','+rz;let s=desertLakeRegions.get(key);if(s)return s;
 s=new Set();
 if(rng(hash('deslk'+world.seed+','+key))()<DESERT_LAKE_CHANCE){
  const x0=Math.floor(rx*DES_SCALE/LAKE_CELL)-1,x1=Math.ceil((rx+1)*DES_SCALE/LAKE_CELL)+1,z0=Math.floor(rz*DES_SCALE/LAKE_CELL)-1,z1=Math.ceil((rz+1)*DES_SCALE/LAKE_CELL)+1,cand=[];
  for(let cx=x0;cx<=x1;cx++)for(let cz=z0;cz<=z1;cz++){
   if(regionOfLakeCell(cx)!==rx||regionOfLakeCell(cz)!==rz)continue;
   const G=lakeGeom(cx,cz);if(desertW(G.px,G.pz)<LAKE_DESERT_THR)continue;
   if(!lakeValid(G))continue;
   cand.push({k:cx+','+cz,s:hash('deslk-pick'+world.seed+','+cx+','+cz)});
  }
  cand.sort((a,b)=>a.s-b.s);
  for(let i=0;i<DESERT_LAKE_COUNT&&i<cand.length;i++)s.add(cand[i].k);
 }
 desertLakeRegions.set(key,s);return s;
}
function lakeParams(cx,cz){
 const k=cx+','+cz;let L=lakeCache.get(k);if(L!==undefined)return L;
 L=null;const G=lakeGeom(cx,cz),dwl=desertW(G.px,G.pz);
 if(dwl>=LAKE_DESERT_THR){   // dentro do deserto: 7% por região, 3 lagos (oásis raros)
  if(desertLakeCells(regionOfLakeCell(cx),regionOfLakeCell(cz)).has(k))L=lakeValid(G);
 }else if(G.u0<LAKE_CHANCE+(LAKE_CHANCE_DESERT-LAKE_CHANCE)*dwl)L=lakeValid(G);   // fora do deserto: como antes
 lakeCache.set(k,L);return L;
}
const lakeT=(L,x,z)=>Math.hypot(x-L.px,z-L.pz)/(L.R*(.78+.44*NZ(x/15+L.sx,z/15+L.sz)));   // 0 = centro, ~.8 = margem
function lakeInfo(x,z){
 if(PLATE)return null;const cx=Math.floor(x/LAKE_CELL),cz=Math.floor(z/LAKE_CELL);let best=null,bt=2;
 for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const L=lakeParams(cx+a,cz+b);if(!L)continue;const t=lakeT(L,x,z);if(t<bt){bt=t;best=L}}
 return best?{t:bt,wl:best.wl,dep:best.dep,L:best}:null;
}

/* ---------- Rios por bioma ----------
   Cada bioma (deserto, cerejeiral e planície) é dividido em "células de rio" (tamanho proporcional à escala do bioma). Cada célula sorteia,
   pela semente, se tem rio: só RIVER_BIOME_CHANCE (60%) têm; os outros 40% ficam sem rio. Uma célula com rio recebe 2 ou 3 canais paralelos
   que passam pelo ponto mais "interno" do bioma dentro da célula. O rio NUNCA sai do bioma/célula: ele afina e termina na borda, então
   rios de biomas diferentes não se cruzam nem se misturam. Células maiores (biomas maiores) cobrem mais área e ganham mais rios.
   Tudo é função pura da semente (nenhuma ordem de carregamento de chunk muda o resultado). */
const RIVER_BIOME_CHANCE=.6,RIVER_MEMBER_A=.015,RIVER_MEMBER_B=.07;
const RIVER_CELLS=[Math.round(DES_SCALE),Math.round(CH_SCALE*1.25),420];   // tipo 0 = deserto, 1 = cerejeiral, 2 = planície
const RIVER_SWAY=22,RIVER_HALF_WIDTH=5.85,RIVER_BANK=4.5,RIVER_DEPTH=3,RIVER_SPAWN_CLEAR=40,RIVER_BORDER=60;   // largura 13 m -10% = 11,7 m
const RIVER_WALL_SLOPE=.72,RIVER_WALL_MAX=24,RIVER_REACH=RIVER_HALF_WIDTH+RIVER_BANK;
let riverAxisSeed=null;const riverLaneCache=new Map();
/* pertencimento (0..1) de um ponto ao interior do bioma do tipo t; cai a zero ANTES da borda real do bioma para o rio afinar dentro dele */
function riverMember(t,x,z){
 const d=Math.hypot(x,z);
 if(t===0)return d<DES_CLEAR_A?0:sstep(DES_THR+RIVER_MEMBER_A,DES_THR+RIVER_MEMBER_B,desertRaw(x,z))*sstep(DES_CLEAR_A,DES_CLEAR_B,d);
 if(t===1){if(d<CH_CLEAR_A)return 0;const c=sstep(CH_THR+RIVER_MEMBER_A,CH_THR+RIVER_MEMBER_B,cherryRaw(x,z))*sstep(CH_CLEAR_A,CH_CLEAR_B,d);return c>0?c*(1-sstep(DES_THR-.09,DES_THR-.03,desertRaw(x,z))):0}
 const dm=d<DES_CLEAR_A-40?0:sstep(DES_THR-.05,DES_THR-.005,desertRaw(x,z))*sstep(DES_CLEAR_A-40,DES_CLEAR_B-40,d);
 const cm=d<CH_CLEAR_A-20?0:sstep(CH_THR-.05,CH_THR-.005,cherryRaw(x,z))*sstep(CH_CLEAR_A-20,CH_CLEAR_B-20,d);
 return 1-Math.max(dm,cm);
}

const riverNum=s=>{let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%100003;return h};
/* configuração da célula (t,cx,cz): {active,key,t,ax,az,cos,sin,count,offsets,ks} */
function riverCell(t,cx,cz){
 if(riverAxisSeed!==world.seed){riverAxisSeed=world.seed;riverLaneCache.clear()}
 const nk=(t*4096+cx+2048)*4096+cz+2048;let c=riverLaneCache.get(nk);if(c!==undefined)return c;
 const key=t+':'+cx+':'+cz,r=rng(hash('river-cell-'+world.seed+'-'+key)),dec=OWMRiverLogic.decide(r(),r()),ang=r()*Math.PI,C=RIVER_CELLS[t];
 c={active:false,key,t,cx,cz};
 if(dec.active&&t!==0){   // t===0 = deserto: NUNCA tem rio (só lagos/oásis)
  const x0=cx*C,z0=cz*C,mid0=x0+C/2,mid1=z0+C/2;let best=-1,bx=0,bz=0;const N=9;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=x0+(i+.5)*C/N,z=z0+(j+.5)*C/N,sc=riverMember(t,x,z)-Math.hypot(x-mid0,z-mid1)*1e-4;if(sc>best){best=sc;bx=x;bz=z}}
  if(best>=.9){const f=C*.1;c={active:true,key,t,cx,cz,ax:bx,az:bz,cos:Math.cos(ang),sin:Math.sin(ang),count:dec.count,offsets:dec.count===2?[-f,f]:[-1.8*f,0,1.8*f],ks:riverNum(key)}}
 }
 if(riverLaneCache.size>8192)riverLaneCache.clear();
 riverLaneCache.set(nk,c);return c;
}
function riverSway(along,c){
 const broad=fbm(along/185+c.ks*.173+43.4,c.ks*.123+77.5,3),detail=fbm(along/61+c.ks*.057-14,c.ks*.316+3.3,2);
 return (broad-.5)*RIVER_SWAY+(detail-.5)*8;
}
/* ponto central do canal na mesma posição "along": {along,center,px,pz,wl} */
function riverPathAt(x,z,c,channelOffset=0){
 const dx=x-c.ax,dz=z-c.az,along=dx*c.cos+dz*c.sin,center=riverSway(along,c)+channelOffset;
 const px=c.ax+along*c.cos-center*c.sin,pz=c.az+along*c.sin+center*c.cos;
 return {along,center,px,pz,wl:baseTerrain(px,pz)-.28};
}
/* canal mais próximo do ponto dentro da célula do tipo t (ou null) — barato: só geometria */
function riverCandidate(x,z,t){
 const C=RIVER_CELLS[t],cfg=riverCell(t,Math.floor(x/C),Math.floor(z/C));if(!cfg.active)return null;
 const dx=x-cfg.ax,dz=z-cfg.az,along=dx*cfg.cos+dz*cfg.sin,cross=-dx*cfg.sin+dz*cfg.cos,sway=riverSway(along,cfg);
 let channel=0,off=cfg.offsets[0],center=sway+off,dist=Math.abs(cross-center);
 for(let i=1;i<cfg.offsets.length;i++){const cc=sway+cfg.offsets[i],d=Math.abs(cross-cc);if(d<dist){channel=i;off=cfg.offsets[i];center=cc;dist=d}}
 return {cfg,t,channel,channelOffset:off,along,cross,center,dist};
}
/* seção do rio: afina (largura, margem, profundidade) conforme o pertencimento ao bioma + borda da célula + zona do spawn */
function riverSection(c,x,z,spawnS){
 const cfg=c.cfg,px=cfg.ax+c.along*cfg.cos-c.center*cfg.sin,pz=cfg.az+c.along*cfg.sin+c.center*cfg.cos,C=RIVER_CELLS[c.t];
 const m=riverMember(c.t,px,pz);if(m<=0)return null;
 const bx=Math.min(px-cfg.cx*C,(cfg.cx+1)*C-px,pz-cfg.cz*C,(cfg.cz+1)*C-pz),S=m*sstep(0,RIVER_BORDER,bx)*spawnS;
 if(S<.015)return null;
 c.px=px;c.pz=pz;c.S=S;c.width=RIVER_HALF_WIDTH*(.35+.65*sstep(0,1,S));c.bank=RIVER_BANK*(.5+.5*S);c.depth=RIVER_DEPTH*(.3+.7*S);c.reach=c.width+c.bank;
 c.wl=baseTerrain(px,pz)-.28;return c;
}
const riverProfile=(c,dist)=>{const bed=c.wl-c.depth,top=c.wl+.22;return dist<c.reach?bed+(top-bed)*sstep(0,c.reach,dist):top+(dist-c.reach)*RIVER_WALL_SLOPE};
const riverSpawnS=(x,z)=>sstep(RIVER_SPAWN_CLEAR,RIVER_SPAWN_CLEAR+40,Math.hypot(x,z));
/* rio dominante em (x,z) (o de leito mais fundo onde dois se encontram) ou null; terreno, água e peixes usam o MESMO rio */
function riverInfo(x,z){
 if(PLATE)return null;const spawnS=riverSpawnS(x,z);if(spawnS<.015)return null;
 let best=null,bp=1e9;
 for(let t=0;t<3;t++){
  const c=riverCandidate(x,z,t);if(!c||c.dist>=RIVER_REACH+2)continue;
  if(!riverSection(c,x,z,spawnS)||c.dist>=c.reach+2)continue;
  const p=c.dist<c.reach?riverProfile(c,c.dist):1e8+c.dist;if(p<bp){bp=p;best=c}
 }
 if(!best)return null;
 return {cfg:best.cfg,lane:best.cfg.key,type:best.t,channel:best.channel,channelOffset:best.channelOffset,along:best.along,cross:best.cross,center:best.center,dist:best.dist,width:best.width,bank:best.bank,depth:best.depth,strength:best.S,wl:best.wl};
}
/* Escava o leito + margens. Em encostas/morros o vale ganha paredes inclinadas (RIVER_WALL_SLOPE) até encontrar o terreno. */
function riverCarve(x,z,h){
 const spawnS=riverSpawnS(x,z);if(spawnS<.015)return h;
 let out=h;
 for(let t=0;t<3;t++){
  const c=riverCandidate(x,z,t);if(!c||c.dist>=RIVER_REACH+RIVER_WALL_MAX)continue;
  if(!riverSection(c,x,z,spawnS)||c.dist>=c.reach+RIVER_WALL_MAX)continue;
  const carved=Math.min(h,riverProfile(c,c.dist)),v=h+(carved-h)*sstep(0,.45,c.S);if(v<out)out=v;
 }
 return out;
}
function terrainFn(x,z){
 if(PLATE)return PLATE_H;
 const b=baseTerrain(x,z),k=lakeInfo(x,z);let h=b;
 if(k){
  const t=k.t,wl=k.wl,rim=Math.max(b,wl+.25),u=Math.min(1,t/.8),core=wl-k.dep*(1-u*u*(3-2*u)),h1=core+(rim-core)*sstep(.7,1.25,t);
  h=h1+(b-h1)*sstep(1.25,2,t);
 }
 h=riverCarve(x,z,h);
 return h;
}
/* nível da água em (x,z), ou -Infinity se não há água ali */
function waterLvl(x,z){const k=lakeInfo(x,z);if(!k||k.t>1.3)return -Infinity;return groundH(x,z)<k.wl?k.wl:-Infinity}
/*TERRAIN-END*/
const hgt=(x,z)=>terrainFn(x,z);
/*SPAWN-BEGIN*/
/* ---------- Bioma inicial ----------
   O mundo é função pura da semente, então dá pra procurar (em anéis crescentes ao redor da origem) o ponto mais próximo que esteja
   bem DENTRO do bioma escolhido, em terra firme, sem lago por perto e em terreno quase plano. Resultado fica salvo em w.sxz. */
const SPAWN_BIOMES=['plain','cherry','desert'];
const SPAWN_TYPE={desert:0,cherry:1,plain:2};
/* O jogador sempre nasce num bioma que TEM rio: exige um rio desse mesmo bioma, bem formado, a uma distância curta (entre ~16 e ~100 m)
   e o ponto de nascimento fora da margem. */
function spawnRiverOk(x,z,type){
 const q=riverInfo(x,z);if(q&&q.dist<q.width+q.bank+8)return false;
 for(let a=0;a<24;a++){const ca=Math.cos(a*.2618),sa=Math.sin(a*.2618);
  for(let R=16;R<=100;R+=6){const r=riverInfo(x+ca*R,z+sa*R);if(r&&r.type===type&&r.strength>.85&&r.dist<r.width*.6)return true}}
 return false;
}
function spawnOk(x,z,fn,type){
 if(fn(x,z)<.92)return false;
 const h=terrainFn(x,z);if(h<SEA+1.5)return false;
 let k=lakeInfo(x,z);if(k&&k.t<1.8)return false;
 for(let i=0;i<8;i++){
  const a=i*.7854,xx=x+Math.cos(a)*6,zz=z+Math.sin(a)*6;
  if(Math.abs(terrainFn(xx,zz)-h)>2.2)return false;
  k=lakeInfo(xx,zz);if(k&&k.t<1.8)return false;
 }
 return type===0||spawnRiverOk(x,z,type);   // deserto não tem rio: o nascimento lá só exige terreno firme e plano
}
function pickSpawn(w){
 if(w.biome==='lobby')return[Math.round(-.65*LOBBY_SXZ),Math.round(2.5*LOBBY_SXZ),'plain'];   // lobby: meio da sala
 if(w.biome==='testplate')return[0,0,'plain'];
 let b=w.biome||'plain',s=(w.seed|0)^0x9e3779b9;
 const rnd=()=>{s=Math.imul(s^(s>>>15),0x2c1b3c6d);s=Math.imul(s^(s>>>12),0x297a2d39);s^=s>>>15;return(s>>>0)/4294967296};
 if(b==='random')b=SPAWN_BIOMES[(rnd()*3)|0];
 const find=bb=>{
  const type=SPAWN_TYPE[bb],fn=bb==='desert'?desertW:bb==='cherry'?cherryW:((x,z)=>riverMember(2,x,z));
  if(bb==='plain'&&spawnOk(0,0,fn,type))return[0,0,bb];
  for(let R=40;R<=3200;R+=16){
   const n=Math.max(8,Math.ceil(R*.35)),a0=rnd()*Math.PI*2;
   for(let i=0;i<n;i++){
    const a=a0+i/n*Math.PI*2,x=Math.round(Math.cos(a)*R),z=Math.round(Math.sin(a)*R);
    if(spawnOk(x,z,fn,type))return[x,z,bb];
   }
  }
  return null;
 };
 return find(b)||(b!=='plain'&&find('plain'))||[0,0,'plain'];   // não achou: cai na planície de sempre
}
/*SPAWN-END*/
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

/* ---------- VENTO: direção e força variam devagar; rajadas viajam pelo mapa na direção do vento. As copas balançam no vertex shader (windify). ---------- */
const WIND={uWT:{value:0},uWD:{value:new THREE.Vector2(.8,.6)},uWS:{value:1}};
OWM.windNow={x:.8,z:.6,s:1};   // lido por OWM.leaves: folhas caindo derivam com o mesmo vento
function updWind(t){const a=.9+Math.sin(t*.011)*.7+Math.sin(t*.027+1.3)*.4,st=Math.max(.12,.8+.38*Math.sin(t*.043+.5)+.25*Math.sin(t*.091)+.12*Math.sin(t*.23)),dx=Math.cos(a),dz=Math.sin(a);
 const k=OWM.fx&&OWM.fx.wind!==undefined?OWM.fx.wind:1;   // Shaders > Natureza > Vento (0 = parado, 2 = tempestade)
 WIND.uWT.value=t;WIND.uWD.value.set(dx,dz);WIND.uWS.value=st*k;const w=OWM.windNow;w.x=dx;w.z=dz;w.s=st*k}
/* Atributo tw por vértice: x = amplitude de curvatura do tronco (m, cresce com a altura), y = peso do tremular da folha, z = fase da árvore. */
function windify(m){m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,WIND);
 sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 tw;uniform float uWT;uniform vec2 uWD;uniform float uWS;')
 .replace('#include <begin_vertex>',`#include <begin_vertex>
 {vec3 wp=position;float ph=uWT*1.1-dot(wp.xz,uWD)*.07;
  float gu=max(.55+.45*sin(ph)+.25*sin(ph*2.3+tw.z)+.12*sin(uWT*.31+wp.x*.01),.05);
  vec2 pr=vec2(-uWD.y,uWD.x);
  transformed.xz+=uWD*(tw.x*uWS*gu)+pr*(tw.x*uWS*.22*sin(uWT*1.9+tw.z*3.));
  float fl=tw.y*(.35+uWS*.65)*(.5+.5*gu);
  transformed+=fl*.07*vec3(sin(uWT*6.1+wp.x*2.3+tw.z),.6*sin(uWT*5.2+wp.z*2.1+tw.z*1.7),cos(uWT*5.7+wp.y*1.9+tw.z*.7));}`)};return m}
const TWK={oak:1,spruce:.55,deadoak:.3,deadspruce:.2,ds:1};
const twb=(ly,hh,p)=>Math.pow(Math.min(1,Math.max(0,ly/hh)),1.8)*hh*.05*(TWK[p.k]===undefined?1:TWK[p.k]);
const twf=p=>(p.k==='spruce'||p.k==='deadspruce')?.45:1;
const tnt=p=>{const t=p.pr.tint||[1,1,1],j=p.tj;return j?[t[0]*j[0],t[1]*j[1],t[2]*j[2]]:t};
/* ---------- Árvores: pack "Trees Low Poly" (bioflorest.js) ----------
   round -> oak/deadoak, tall -> spruce/deadspruce (as mortas = só a casca, mais escura). */
const TP=OWM.treePack,TREE={},TM={lo:null,hi:null};
const f32=(a,k)=>{const o=new Float32Array(a.length);for(let i=0;i<a.length;i++)o[i]=a[i]*k;return o};
if(TP)for(const n in TP.trees){if(TP.trees[n].bt)continue;const t=TP.trees[n],B=t.bark,L=t.leaf,nq=L.nq,lp=f32(unb64(L.pos,Int16Array),.01),ctr=new Float32Array(nq*3);
 for(let q=0;q<nq;q++)for(let c=0;c<3;c++){let a=0;for(let v=0;v<4;v++)a+=lp[(q*4+v)*3+c];ctr[q*3+c]=a/4}
 const mesh=(p,nr,uv,idx)=>({pos:f32(unb64(p,Int16Array),.01),nor:f32(unb64(nr,Int8Array),1/127),uv:f32(unb64(uv,Int16Array),1/2048),idx:unb64(idx,Uint16Array)});
 TREE[n]={h:t.h,hx:t.hx,hz:t.hz,bark:mesh(B.pos,B.nor,B.uv,B.idx),trunk:mesh(B.tpos,B.tnor,B.tuv,B.tidx),
  leaf:{nq,pos:lp,ctr,nor:f32(unb64(L.nor,Int8Array),1/127),uv:f32(unb64(L.uv,Int16Array),1/2048),pat:unb64(L.pat,Uint8Array)}};}
/* Bétulas (pack "Tree low poly lowpoly", 00amza, CC-BY-4.0): malha única com atlas (galhos recortados + casca). lw[i]=1 nos vértices da parte de folhas (u<.66 do atlas) = só eles recebem o tom de folha. */
if(TP)for(const n in TP.trees){const t=TP.trees[n];if(!t.bt)continue;const b=t.bt,uv=f32(unb64(b.uv,Int16Array),1/2048),lw=new Uint8Array(uv.length/2);for(let i=0;i<lw.length;i++)lw[i]=uv[i*2]<.66?1:0;
 TREE[n]={h:t.h,hx:t.hx,hz:t.hz,bt:1,pos:f32(unb64(b.pos,Int16Array),.01),nor:f32(unb64(b.nor,Int8Array),1/127),uv,idx:unb64(b.idx,Uint16Array),lw}}
/* Variações: mesma malha do pack com largura (sx), altura (sy) e tom das folhas (tint) diferentes. [peso, sx, sy, tint]; o peso repete o proto na lista (pick uniforme). */
const TV={
 oak:[[4,1,1,[1,1,1]],[2,1.3,.88,[1.05,1,.95]],[2,.8,1.25,[.95,1,.95]],[2,.65,.6,[1.1,1.08,.9]],[1,1,1,[2.1,.95,.3]],[1,1.1,1.05,[.75,.82,.75]],[1,.45,.2,[1,1.05,.9]]],   // normal, larga, esguia, jovem, outono, escura, arbusto
 spruce:[[4,1,1,[1,1,1]],[2,.75,1.2,[.9,1,1]],[2,1.2,.8,[1,1,1]],[2,1,1.05,[.7,.85,.9]],[2,.6,.55,[1.1,1.15,.95]],[1,1,1,[1.35,1.1,.6]]],                              // normal, fina, robusta, azulada, jovem, amarelada
 deadoak:[[3,1,1,[1,1,1]],[1,1.2,.9,[1,1,1]],[1,.85,1.15,[1,1,1]],[1,.7,.65,[1,1,1]]],
 deadspruce:[[3,1,1,[1,1,1]],[1,.75,1.15,[1,1,1]],[1,1.1,.8,[1,1,1]]]};
/* Mix de espécies por tipo (pesos): carvalho = copa redonda + copa oval + bétulas; "spruce" (frio/alto) = bétulas + copa oval; mortas = só a casca das duas do pack Trees Low Poly. */
const TSPM={oak:[['round',3],['tall',2],['birch1',1],['birch2',1]],spruce:[['birch1',3],['birch2',3],['tall',2]],deadoak:[['round',1],['tall',1]],deadspruce:[['tall',1],['round',1]]};
for(const k in TSPM){const dead=k.startsWith('dead'),pm=new Map();PROTO[k]=[];
 for(const[w,sx,sy,tint]of TV[k])for(const[n,wt]of TSPM[k]){const T=TREE[n];if(!T||(sy<=.25&&n!=='round'))continue;   // sy<=.25 = "arbusto": só a copa redonda
  const key=n+'|'+sx+'|'+sy+'|'+tint;let o=pm.get(key);if(!o){o={k,tree:T,dead,h:T.h*sy,hx:T.hx*sx,hz:T.hz*sx,hy:T.h*sy,sx,sy,tint};pm.set(key,o)}
  for(let i=0;i<w*wt;i++)PROTO[k].push(o)}
 if(!PROTO[k].length)delete PROTO[k]}
/* Decodifica os LODs de um modelo de cacti (biodesert.js) (cor sRGB uint8 -> linear; dIdx = só triângulos sem folha). */
const fpLods=m=>m.lod.map(l=>{const c8=unb64(l.c,Uint8Array),col=new Float32Array(c8.length),idx=unb64(l.i,Uint16Array),lw=unb64(l.l,Uint8Array),dI=[];
 for(let i=0;i<c8.length;i++)col[i]=s2l(c8[i]);
 for(let t=0;t<idx.length;t+=3)if(!lw[idx[t]]&&!lw[idx[t+1]]&&!lw[idx[t+2]])dI.push(idx[t],idx[t+1],idx[t+2]);
 return{pos:f32(unb64(l.p,Int16Array),.01),nor:f32(unb64(l.n,Int8Array),1/127),col,lw,idx,dIdx:dI}});
/* ---------- Árvores e arbustos da floresta (bioflorest.js) ----------
   Pack "PS1 TREES AND BUSHES" (12buuk12, CC-BY-4.0): 3 árvores (tronco 68-400 tris + copa de planos cruzados 8-44 tris) e 3 arbustos (cartões), estilo PS1 com textura recortada.
   Só 2 materiais por chunk: casca (opaca, repete) e cartões (atlas com alphaTest). Os cartões são duplicados com a face invertida e material FrontSide, pra poder usar normais "de copa"
   (mistura de pra-cima com radial: luz suave e sem lado escuro). Substituem oak/spruce/deadoak/deadspruce; o "arbusto" achatado vira arbusto de verdade. Os sorteios (rng) não mudam:
   ids dos props, saves e edições seguem valendo. Árvores comuns dentro do bioma de cerejeira (cherryW>0) continuam com os modelos antigos (PROTO[k+'C']). Morta = só o tronco, escurecido. */
const PS1ON=false;   // true = volta às árvores PS1 (Trees and Bushes) no lugar do pack Trees Low Poly + bétulas
const PP=OWM.ps1Pack,PS1=[];
if(PP)for(const m of PP.models){
 const o={k:m.k,n:m.n,h:m.h,hx:m.hx,hz:m.hz,p1:1};
 if(m.b)o.b={pos:f32(unb64(m.b.p,Int16Array),.01),nor:f32(unb64(m.b.n,Int8Array),1/127),uv:f32(unb64(m.b.u,Int16Array),1/8192),idx:unb64(m.b.i,Uint16Array)};
 const P=f32(unb64(m.c.p,Int16Array),.01),U=f32(unb64(m.c.u,Uint16Array),1/65535),I=unb64(m.c.i,Uint16Array),n=P.length/3,N=new Float32Array(n*3);
 for(let i=0;i<n;i++){const x=P[i*3],z=P[i*3+2],r=Math.hypot(x,z),k=r>.05?.4/r:0,nx=x*k,nz=z*k,l=Math.hypot(nx,.9,nz);N[i*3]=nx/l;N[i*3+1]=.9/l;N[i*3+2]=nz/l}
 const P2=new Float32Array(n*6),N2=new Float32Array(n*6),U2=new Float32Array(n*4),I2=new Uint16Array(I.length*2);
 P2.set(P);P2.set(P,n*3);N2.set(N);N2.set(N,n*3);U2.set(U);U2.set(U,n*2);I2.set(I);
 for(let t=0;t<I.length;t+=3){I2[I.length+t]=I[t]+n;I2[I.length+t+1]=I[t+2]+n;I2[I.length+t+2]=I[t+1]+n}   // cópia com winding invertido
 o.c={pos:P2,nor:N2,uv:U2,idx:I2};PS1.push(o)}
if(PS1ON&&PS1.length>=6){
 const byN=n=>PS1.find(m=>m.n===n),SET={oak:[['tree2','tree1'],['bush1','bush2','bush3']],spruce:[['tree1','tree3'],['bush2','bush3']],deadoak:[['tree2','tree1','tree3'],null],deadspruce:[['tree1','tree3','tree2'],null]},
  MS={oak:1,spruce:1.35,deadoak:1,deadspruce:1.35},cache=new Map();   // MS: spruce mais alto que oak, como era (oak ≈6,3 blocos, spruce ≈6,6)
 for(const k in SET){PROTO[k+'C']=PROTO[k];const L=[],dead=k.startsWith('dead');
  for(const[w,sx0,sy0,tint]of TV[k]){const bush=!dead&&SET[k][1]&&sy0<=.25,set=bush?SET[k][1]:SET[k][0],sx=(bush?1:sx0)*MS[k],sy=(bush?1:sy0)*MS[k],rep=Math.max(1,Math.round(w*SET[k][0].length/set.length));   // sy<=.25 era o "arbusto" achatado
   for(const nm of set){const key=k+'|'+nm+'|'+sx0+'|'+sy0+'|'+tint;let o=cache.get(key);if(!o){const T=byN(nm);o={k,tree:T,dead,h:T.h*sy,hx:T.hx*sx,hz:T.hz*sx,hy:T.h*sy,sx,sy,tint};cache.set(key,o)}
    for(let i=0;i<rep;i++)L.push(o)}}
  PROTO[k]=L}}
let PM=null;
function ps1Mats(){if(PM)return PM;const X=PP.tex,bark=treeTex(X.bark,1),atl=treeTex(X.atlas,1);atl.wrapS=atl.wrapT=THREE.ClampToEdgeWrapping;
 PM={bark:windify(new THREE.MeshLambertMaterial({map:bark,vertexColors:true,side:THREE.DoubleSide})),card:windify(new THREE.MeshLambertMaterial({map:atl,vertexColors:true,alphaTest:.5}))};return PM}
OWM.extraMats.push(()=>PM?[PM.bark,PM.card]:[]);
function addBirch(p,tier,hq,F){
 const T=p.pr.tree,s=p.s,cr=Math.cos(p.rot),sr=Math.sin(p.rot),sx=(p.pr.sx||1)*(p.ax||1),sy=(p.pr.sy||1)*(p.ay||1),hh=Math.max(.01,T.h*s*sy),j=(p.sd-.5)*.16,tn=tnt(p),n=T.pos.length/3,b0=F.pos.length/3;
 for(let i=0;i<n;i++){const lx=T.pos[i*3]*s*sx,ly=T.pos[i*3+1]*s*sy,lz=T.pos[i*3+2]*s*sx,nx=T.nor[i*3],nz=T.nor[i*3+2],g=p.b*(.74+.26*Math.min(1,ly/hh)),lf=T.lw[i];
  F.pos.push(p.x+(lx+ly*(p.l1||0))*cr+(lz+ly*(p.l2||0))*sr,p.y+ly,p.z-(lx+ly*(p.l1||0))*sr+(lz+ly*(p.l2||0))*cr);F.nor.push(nx*cr+nz*sr,T.nor[i*3+1],-nx*sr+nz*cr);F.uv.push(T.uv[i*2],T.uv[i*2+1]);
  if(lf)F.col.push(g*(1+j)*tn[0],g*tn[1],g*(1-j*.6)*tn[2]);else F.col.push(g*(1+j),g,g*(1-j*.5));
  if(F.tw)F.tw.push(twb(ly,hh,p),lf?twf(p):0,p.ph||0)}
 for(let i=0;i<T.idx.length;i++)F.idx.push(b0+T.idx[i])}
let BTM=null;const btMat=()=>BTM||(BTM=windify(new THREE.MeshLambertMaterial({map:treeTex(TP.tex.bt,1),vertexColors:true,alphaTest:.5,side:THREE.DoubleSide})));
OWM.extraMats.push(()=>BTM?[BTM]:[]);
function addPs1(p,tier,hq,F){
 const T=p.pr.tree,dead=p.pr.dead,s=p.s,cr=Math.cos(p.rot),sr=Math.sin(p.rot),sx=(p.pr.sx||1)*(p.ax||1),sy=(p.pr.sy||1)*(p.ay||1),hh=Math.max(.01,T.h*s*sy),j=(p.sd-.5)*.16,tn=tnt(p);
 const put=(G,A,leaf)=>{const n=G.pos.length/3,b0=A.pos.length/3;
  for(let i=0;i<n;i++){const lx=G.pos[i*3]*s*sx,ly=G.pos[i*3+1]*s*sy,lz=G.pos[i*3+2]*s*sx,nx=G.nor[i*3],nz=G.nor[i*3+2],g=p.b*(.74+.26*Math.min(1,ly/hh));
   A.pos.push(p.x+(lx+ly*(p.l1||0))*cr+(lz+ly*(p.l2||0))*sr,p.y+ly,p.z-(lx+ly*(p.l1||0))*sr+(lz+ly*(p.l2||0))*cr);A.nor.push(nx*cr+nz*sr,G.nor[i*3+1],-nx*sr+nz*cr);A.uv.push(G.uv[i*2],G.uv[i*2+1]);
   if(dead)A.col.push(g*.5,g*.46,g*.42);else if(leaf)A.col.push(g*(1+j)*tn[0],g*tn[1],g*(1-j*.6)*tn[2]);else A.col.push(g*(1+j),g,g*(1-j*.5));if(A.tw)A.tw.push(twb(ly,hh,p),leaf&&!dead?twf(p):0,p.ph||0)}
  for(let i=0;i<G.idx.length;i++)A.idx.push(b0+G.idx[i])};
 if(T.b)put(T.b,F.b,0);if(!dead)put(T.c,F.c,1)}
/* ---------- Cerejeiras (bioflorest.js) ----------
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
   A.pos.push(p.x+(lx+ly*(p.l1||0))*cr+(lz+ly*(p.l2||0))*sr,p.y+ly,p.z-(lx+ly*(p.l1||0))*sr+(lz+ly*(p.l2||0))*cr);A.nor.push(nx*cr+nz*sr,N[i*3+1],-nx*sr+nz*cr);A.uv.push(U[i*2],U[i*2+1]);
   if(cardLum)A.col.push(g*(1+j)*tn[0],g*tn[1],g*(1-j*.6)*tn[2]);else A.col.push(g*(1+j),g,g*(1-j*.5))}
  for(let i=0;i<m.idx.length;i++)A.idx.push(b0+m.idx[i])};
 put(lv.b,CA.b,0);put(lv.l,CA.l,1)}
/* Qualidade máxima (sem otimização) só com "Resolução alta" + "Texturas HD" ligadas. */
const HQ=()=>S.rq===4&&S.hdTex&&!touch?1:0;
const treeTex=(u,srgb)=>{const t=new THREE.TextureLoader().load(u,tx=>{if(R.initTexture)setTimeout(()=>{try{R.initTexture(tx)}catch(e){}},0)});   /* pré-upload: o custo de enviar/gerar mipmaps de cada textura (as HD têm normal e rugosidade) sai do quadro em que a árvore aparece */
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.flipY=false;if(srgb)t.encoding=THREE.sRGBEncoding;t.anisotropy=Math.min(8,R.capabilities.getMaxAnisotropy());return t};
function treeMats(hq){
 const k=hq?'hi':'lo';if(TM[k])return TM[k];const X=TP.tex[k],D=THREE.DoubleSide;
 TM[k]=hq?{bark:new THREE.MeshStandardMaterial({map:treeTex(X.bark,1),normalMap:treeTex(X.normal),roughnessMap:treeTex(X.rough),roughness:1,metalness:0,vertexColors:true}),
           leaf:new THREE.MeshStandardMaterial({map:treeTex(X.leaf,1),alphaTest:.4,side:D,roughness:.7,metalness:0,vertexColors:true})}
         :{bark:new THREE.MeshLambertMaterial({map:treeTex(X.bark,1),vertexColors:true}),
           leaf:new THREE.MeshLambertMaterial({map:treeTex(X.leaf,1),alphaTest:.45,side:D,vertexColors:true})};
 windify(TM[k].bark);windify(TM[k].leaf);return TM[k]}
OWM.extraMats.push(()=>{const a=[];for(const k in TM)if(TM[k])a.push(TM[k].bark,TM[k].leaf);return a});

/* ---------- Dunas e montanhas do deserto ----------
   DUNAS: mapa de altura de "Dune - Arrakis (WIP)" (Rostenbach, CC-BY-4.0; biodesert.js, 192×192 de 8 bits), amostrado espelhado e com leve distorção de baixa frequência (some a simetria do espelho).
   MONTANHAS: 20 modelos low-poly do pack "Free Desert Mountain" (CraftPix; biodesert.js: 10 montanhas, 5 platôs, 5 colinas). Cada uma é um landmark colocado de forma determinística
   por célula de MT_CELL m (só no miolo do deserto). O modelo é desenhado como malha própria (mkMountain) e sua silhueta é GRAVADA no mapa de altura (baseTerrain): chão aplainado
   em volta, paredões bloqueiam o jogador, encostas suaves dão pra subir, e plantas/escorpiões não nascem dentro. O topo respeita H=48. */
const DUP=OWM.dunePack,DUN=DUP?DUP.n:0,DUNE=DUP?unb64(DUP.d,Uint8Array):null,DUNE_SC=1.25;   // 1 texel = DUP.m*DUNE_SC metros no mundo
function duneSamp(u,v){   // amostra bilinear do tile espelhado (onda triangular 0..1: sem emenda); 0..1
 u=Math.abs((((u%2)+2)%2)-1);v=Math.abs((((v%2)+2)%2)-1);
 const fx=u*(DUN-1),fz=v*(DUN-1),ix=Math.min(DUN-2,fx|0),iz=Math.min(DUN-2,fz|0),tx=fx-ix,tz=fz-iz,i=iz*DUN+ix;
 return (DUNE[i]*(1-tx)*(1-tz)+DUNE[i+1]*tx*(1-tz)+DUNE[i+DUN]*(1-tx)*tz+DUNE[i+DUN+1]*tx*tz)/255}
/* Duas camadas do MESMO mapa de altura: principal (75%, girada 27°) + uma maior (25%, escala ×1,65, girada -41°). Os eixos de espelhamento de cada camada caem em lugares diferentes, então não surge vinco reto;
   o ×1,265 devolve a amplitude de uma camada só (soma de duas fontes descorrelacionadas tem desvio √(.75²+.25²)=.79). Retorna ~0,53 ± relevo, como uma amostra única. */
function duneAt(x,z){
 const L=DUN*DUP.m*DUNE_SC,wx=(NZ(x/190+3,z/190-9)-.5)*.2,wz=(NZ(x/190-20,z/190+11)-.5)*.2,L2=L*1.65,
  u1=(x*.891-z*.454)/L+.37+wx,v1=(x*.454+z*.891)/L-.21+wz,u2=(x*.755+z*.656)/L2+.61+wz*.6,v2=(-x*.656+z*.755)/L2+.18+wx*.6;
 return .53+(duneSamp(u1,v1)-.53)*.75*1.265+(duneSamp(u2,v2)-.53)*.25*1.265}
const MT_CELL=170,MT_LVL=20.4,MT_EMB=.6,MT_TOP=26,MT=[],MTC=new Map(),MTM=new Map();   // MT_TOP: altura máxima (m) acima da base; MT_EMB: quanto a base do modelo afunda no chão
let MTf=0,MTh=-1e9,SF=0,SH=0,mtX=1e9,mtZ=1e9,mtMat=null;
function boxBlur(src,W,D,r){const t=new Float32Array(W*D),o=new Float32Array(W*D),n=2*r+1;
 for(let j=0;j<D;j++){let a=0;for(let i=-r;i<=r;i++)a+=src[j*W+Math.max(0,Math.min(W-1,i))];for(let i=0;i<W;i++){t[j*W+i]=a/n;a+=src[j*W+Math.min(W-1,i+r+1)]-src[j*W+Math.max(0,i-r)]}}
 for(let i=0;i<W;i++){let a=0;for(let j=-r;j<=r;j++)a+=t[Math.max(0,Math.min(D-1,j))*W+i];for(let j=0;j<D;j++){o[j*W+i]=a/n;a+=t[Math.min(D-1,j+r+1)*W+i]-t[Math.max(0,j-r)*W+i]}}
 return o}
/* Mapa de altura (1 m) do modelo visto de cima: maior y de qualquer triângulo em cada célula; cv = cobertura; fl = peso de aplainamento (cobertura borrada, ~10 m de rampa). */
function mtnRaster(pos,idx,rx,rz){
 const M=12,minx=-rx-M,minz=-rz-M,W=Math.ceil(2*rx+2*M),D=Math.ceil(2*rz+2*M),hm=new Float32Array(W*D),cv=new Float32Array(W*D);
 for(let t=0;t<idx.length;t+=3){const a=idx[t]*3,b=idx[t+1]*3,c=idx[t+2]*3,ax=pos[a]-minx,az=pos[a+2]-minz,ay=pos[a+1],bx=pos[b]-minx,bz=pos[b+2]-minz,by=pos[b+1],cx=pos[c]-minx,cz=pos[c+2]-minz,cy=pos[c+1],den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
  if(Math.abs(den)<1e-9)continue;
  const x0=Math.max(0,Math.floor(Math.min(ax,bx,cx))),x1=Math.min(W-1,Math.ceil(Math.max(ax,bx,cx))),z0=Math.max(0,Math.floor(Math.min(az,bz,cz))),z1=Math.min(D-1,Math.ceil(Math.max(az,bz,cz)));
  for(let j=z0;j<=z1;j++)for(let i=x0;i<=x1;i++){const px=i+.5,pz=j+.5,l1=((bz-cz)*(px-cx)+(cx-bx)*(pz-cz))/den,l2=((cz-az)*(px-cx)+(ax-cx)*(pz-cz))/den,l3=1-l1-l2;
   if(l1<-.02||l2<-.02||l3<-.02)continue;const y=l1*ay+l2*by+l3*cy,k=j*W+i;if(!cv[k]||y>hm[k]){hm[k]=y;cv[k]=1}}}
 for(let pass=0;pass<2;pass++){const add=[];   // fecha furos de 1 célula entre triângulos finos
  for(let j=1;j<D-1;j++)for(let i=1;i<W-1;i++){const k=j*W+i;if(cv[k])continue;let n=0,sm=0;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const q=k+dj*W+di;if(cv[q]){n++;sm+=hm[q]}}if(n>=5)add.push(k,sm/n)}
  for(let q=0;q<add.length;q+=2){hm[add[q]]=add[q+1];cv[add[q]]=1}}
 const fl=boxBlur(boxBlur(cv,W,D,5),W,D,5);for(let i=0;i<fl.length;i++)fl[i]=Math.min(1,fl[i]*2.4);
 return{hm,fl,W,D,minx,minz}}
if(OWM.mountainPack)for(const m of OWM.mountainPack.models){const pos=f32(unb64(m.p,Int16Array),.01),idx=unb64(m.i,Uint16Array);MT.push(Object.assign({k:m.k,h:m.h,rx:m.rx,rz:m.rz,r:m.r,pos,idx,id:MT.length},mtnRaster(pos,idx,m.rx,m.rz)))}
function mtnSample(m,u,v){const gx=u-m.minx-.5,gz=v-m.minz-.5;
 if(gx<0||gz<0||gx>=m.W-1||gz>=m.D-1){SF=0;SH=0;return}
 const i=gx|0,j=gz|0,fx=gx-i,fz=gz-j,k=j*m.W+i,W=m.W,f=m.fl,h=m.hm,a=(1-fx)*(1-fz),b=fx*(1-fz),c=(1-fx)*fz,d=fx*fz;
 SF=f[k]*a+f[k+1]*b+f[k+W]*c+f[k+W+1]*d;SH=h[k]*a+h[k+1]*b+h[k+W]*c+h[k+W+1]*d}
const mtKey=(i,j)=>(i+8192)*16384+(j+8192);
function mtnCell(ci,cj){const key=mtKey(ci,cj);let a=MTC.get(key);if(a)return a;a=[];MTC.set(key,a);if(!MT.length)return a;
 const r=rng(hash('mt'+world.seed+','+ci+','+cj)),px=(ci+.5+(r()-.5)*.6)*MT_CELL,pz=(cj+.5+(r()-.5)*.6)*MT_CELL,u=r(),kv=r(),mv=r(),sv=r(),rot=r()*6.2832,sat=r(),sa=r()*6.2832,sm=r(),ss=r();
 if(Math.hypot(px,pz)<300||desertW(px,pz)<.8||u>.62)return a;   // só no miolo do deserto (~60% das células)
 const kind=kv<.55?'mountain':kv<.8?'plateau':'hill',pool=MT.filter(m=>m.k===kind),m=pool[Math.floor(mv*pool.length)]||MT[0],s=Math.min(1.15+sv*.55,MT_TOP/m.h);
 a.push({x:px,z:pz,m,s,rot,yb:MT_LVL-MT_EMB,rr:m.r*s+14});
 if(sat<.5&&kind!=='hill'){const hp=MT.filter(q=>q.k==='hill'),h=hp[Math.floor(sm*hp.length)];if(h){const hs=Math.min(1+ss*.5,MT_TOP/h.h),d=(m.r*s+h.r*hs)*.8;a.push({x:px+Math.cos(sa)*d,z:pz+Math.sin(sa)*d,m:h,s:hs,rot:sa*2,yb:MT_LVL-MT_EMB,rr:h.r*hs+14})}}   // colina satélite
 return a}
/* Altura/aplainamento das montanhas em (x,z): devolve true se há alguma por perto; resultado em MTf (0..1, aplainamento) e MTh (altura do modelo no mundo). */
function mtnStamp(x,z){MTf=0;MTh=-1e9;if(!MT.length)return false;
 const ci=Math.floor(x/MT_CELL),cj=Math.floor(z/MT_CELL);let hit=false;
 for(let i=ci-1;i<=ci+1;i++)for(let j=cj-1;j<=cj+1;j++){const a=mtnCell(i,j);for(let q=0;q<a.length;q++){const p=a[q],dx=x-p.x,dz=z-p.z;if(dx*dx+dz*dz>p.rr*p.rr)continue;
  const c=Math.cos(p.rot),sn=Math.sin(p.rot);mtnSample(p.m,(dx*c-dz*sn)/p.s,(dx*sn+dz*c)/p.s);   // rotação inversa → coordenadas do modelo
  if(SF>MTf)MTf=SF;if(SH>.001){const h=p.yb+SH*p.s;if(h>MTh)MTh=h}hit=true}}
 return hit}
/* Cor da montanha: pé na cor da areia, estratos horizontais (3 tons de arenito, 1 estrato a cada ~2,4 m) e poeira de areia nas faces viradas pra cima. Facetado (normal de face). */
function mkMountain(p){
 const m=p.m,P=m.pos,I=m.idx,n=I.length,pos=new Float32Array(n*3),nor=new Float32Array(n*3),col=new Float32Array(n*3),
  SAND=[236,172,114].map(s2l),RK=[[190,96,54],[158,74,44],[212,124,72]].map(c=>c.map(s2l));
 for(let t=0;t<n;t+=3){const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3;
  const ax=P[a],ay=P[a+1],az=P[a+2],bx=P[b],by=P[b+1],bz=P[b+2],cx=P[c],cy=P[c+1],cz=P[c+2],ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;
  let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
  const hs=((ay+by+cy)/3)*p.s,k=Math.floor(hs/2.4+m.id*1.7),hh=Math.abs(Math.sin(k*12.9898+m.id*78.233)*43758.5453)%1,rk=RK[Math.floor(hh*3)%3],jit=.94+((t*.6180339)%1)*.12,
   mix=Math.max(1-sstep(1,6,hs),ny>.8?.55:0);
  for(let q=0;q<3;q++){const o=(t+q)*3,vi=q===0?a:q===1?b:c;pos[o]=P[vi];pos[o+1]=P[vi+1];pos[o+2]=P[vi+2];nor[o]=nx;nor[o+1]=ny;nor[o+2]=nz;
   for(let ch=0;ch<3;ch++)col[o+ch]=(rk[ch]+(SAND[ch]-rk[ch])*mix)*jit}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeBoundingSphere();
 mtMat=mtMat||new THREE.MeshLambertMaterial({vertexColors:true});
 const o=new THREE.Mesh(g,mtMat);o.position.set(p.x,p.yb,p.z);o.rotation.y=p.rot;o.scale.setScalar(p.s);o.castShadow=false;o.receiveShadow=true;scene.add(o);return o}
OWM.extraMats.push(()=>mtMat?[mtMat]:[]);
function mtnUpdate(px,pz,rad){   // cria/remove as malhas das montanhas ao redor do jogador (rad em metros; vai um pouco além da distância de chunks)
 if(!MT.length||Math.hypot(px-mtX,pz-mtZ)<20)return;mtX=px;mtZ=pz;
 const R=rad+84,need=new Set(),i0=Math.floor((px-R)/MT_CELL),i1=Math.floor((px+R)/MT_CELL),j0=Math.floor((pz-R)/MT_CELL),j1=Math.floor((pz+R)/MT_CELL);
 for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const a=mtnCell(i,j);for(let q=0;q<a.length;q++){const p=a[q];if(Math.hypot(p.x-px,p.z-pz)>R+p.rr)continue;const k=i+','+j+','+q;need.add(k);if(!MTM.has(k))MTM.set(k,mkMountain(p))}}
 for(const[k,o]of MTM)if(!need.has(k)){scene.remove(o);o.geometry.dispose();MTM.delete(k)}}
function mtnClear(){for(const o of MTM.values()){scene.remove(o);o.geometry.dispose()}MTM.clear();MTC.clear();mtX=mtZ=1e9}
/* ---------- Vegetação do deserto (biodesert.js) ----------
   Pack "Poly Desert Free v1.1" (Runemark Studio): opúncia, saguaro, cacto-barril e aloe. Cor nos vértices (sem textura), 2 LODs (perto 594-1.086 tris · longe 202-340),
   mesma malha/material das coníferas (TA.f). Substitui por inteiro as plantas do pack antigo (desert.js, removido). Os sorteios (rng) são os mesmos de antes: ids dos props não mudam. */
const DG={},DGL=[];
if(OWM.cactusPack){
 const GC={pad:[2.5,1.8,0,1],saguaro:[1.5,1.25,'a',1],barrel:[2.5,1.7,0,1],aloe:[3,1.5,'b',0]};   // [peso, escala, zona, sólido]
 for(const m of OWM.cactusPack.models){const c=GC[m.g];let g=DG[m.g];if(!g){g=DG[m.g]={n:m.g,w:c[0],s:c[1],z:c[2],solid:!!c[3],p:[]};DGL.push(g)}
  g.p.push({shrub:1,g:m.g,h:m.h,hx:m.hx,hz:m.hz,cr:Math.max(.18,Math.min(m.hx,m.hz)*.35),solid:g.solid,tree:{h:m.h,hx:m.hx,hz:m.hz,fp:1,lod:fpLods(m)}})}
}
const pickDG=(r,zn)=>{let t=0;const w=DGL.map(g=>{const k=g.w*((g.z==='a'&&zn<.38)||(g.z==='b'&&zn>.62)?2.4:1);t+=k;return k});let u=r()*t;for(let i=0;i<DGL.length;i++){u-=w[i];if(u<=0)return DGL[i]}return DGL[DGL.length-1]};
/* LOD por distância (só no modo otimizado): perto = 50% das folhas; longe (>3,7 chunks) = 22% das folhas e só o tronco. Histerese evita ficar trocando. */
/* Detalhe das árvores. Tiers de chunk: 0 = perto (tudo) · 2 = médio (igual ao 0, mas a casca vira o "trunk" simplificado do pack: carvalho 602→72 tris, pinheiro 1.719→546) · 1 = longe (casca simples + 22% das folhas, sem sombra).
   S.tq (árvores normais): 0 Alto = como era (só tiers 0/1, LOD longe a 3,7 chunks) · 1 Médio = tier 2 a partir de 2,1 chunks · 2 Leve = tier 2 a partir de 1,7 e LOD longe a 3,0.
   S.chq (cerejeiras, só em chunks com cerejeiral): 0 Alto = como era · 1 Médio = LOD longe a 2,7 chunks (cerejeira perto = 2.420 tris, longe = ~680) · 2 Leve = só LOD longe.
   "Resolução alta + Texturas HD" (HQ) continua forçando o máximo. Trocar a opção remalha os chunks aos poucos (o laço de stream() já faz isso quando o tier muda). */
const CHC=new Map(),CHD=new Map();   // chunk tem cerejeiral / deserto? (cache por mundo; limpo em clearWorld)
function desertChunk(cx,cz){const k=cx+','+cz;let v=CHD.get(k);if(v===undefined){const ox=cx*16,oz=cz*16;v=desertW(ox+8,oz+8)>0||desertW(ox,oz)>0||desertW(ox+16,oz)>0||desertW(ox,oz+16)>0||desertW(ox+16,oz+16)>0;CHD.set(k,v)}return v}
function cherryChunk(cx,cz){const k=cx+','+cz;let v=CHC.get(k);if(v===undefined){const ox=cx*16,oz=cz*16;v=cherryW(ox+8,oz+8)>0||cherryW(ox,oz)>0||cherryW(ox+16,oz)>0||cherryW(ox,oz+16)>0||cherryW(ox+16,oz+16)>0;CHC.set(k,v)}return v}
function treeTier(cx,cz,prev){const d=Math.hypot(cx-(P.p.x>>4),cz-(P.p.z>>4));
 if(HQ()){   // modo HD (Alta + Texturas HD): casca e folhas completas, material PBR; só o anel mais distante usa o LOD longe (mesmo material), conforme S.tq (Médio 5,0 chunks · Leve 4,2). Alto = HD exatamente como era
  let f=S.tq>=2?4.2:S.tq>=1?5:0;
  if(S.chq&&cherryChunk(cx,cz)){if(S.chq>=2)return 1;f=f?Math.min(f,2.7):2.7}
  return f&&(prev===1?d>f-.4:d>f)?1:0}
 let far=3.7,farB=3,mid=0;
 if(PS1ON&&PS1.length>=6){if(S.tq>=1){far=3;farB=2.6}if(S.tq>=2){far=2.4;farB=2}}   // árvores PS1: mesma malha perto/longe; o raio só decide até onde há sombra (Médio 3,0 · Leve 2,4 chunks)
 else{if(S.tq>=1)mid=S.tq>=2?1.7:2.1;if(S.tq>=2){far=3;farB=2.6}}   // modelos antigos: tier 2 = casca simples
 if(S.tq>=1&&desertChunk(cx,cz)){far=Math.min(far,S.tq>=2?2:2.6);farB=Math.min(farB,S.tq>=2?1.7:2.2)}   // deserto: cactos/aloes baixos e esparsos, LOD longe mais cedo
 if(S.chq&&cherryChunk(cx,cz)){if(S.chq>=2)return 1;far=Math.min(far,2.7);farB=Math.min(farB,2.3)}
 if(prev===1?d>farB:d>far)return 1;
 if(mid&&(prev===2?d>mid-.3:d>mid))return 2;
 return 0}
function addTree(p,tier,hq,A){
 const tr=p.pr.tree,dead=p.pr.dead,s=p.s,cr=Math.cos(p.rot),sr=Math.sin(p.rot),sx=(p.pr.sx||1)*(p.ax||1),sy=(p.pr.sy||1)*(p.ay||1),hh=Math.max(.01,tr.h*s*sy),j=(p.sd-.5)*.16,tn=tnt(p);
 if(tr.bt)return addBirch(p,tier,hq,A.bt);
 if(tr.p1)return addPs1(p,tier,hq,A.p);
 if(tr.fp)return addForest(p,tier,hq,A.f);
 const tr_=dead?.62:1+j,tg=dead?.58:1,tb=dead?.55:1-j*.5,B=A.b;
 const bk=(tier>=1&&!hq)?tr.trunk:tr.bark,nb=bk.pos.length/3,b0=B.pos.length/3;
 for(let i=0;i<nb;i++){const lx=bk.pos[i*3]*s*sx,ly=bk.pos[i*3+1]*s*sy,lz=bk.pos[i*3+2]*s*sx,nx=bk.nor[i*3],nz=bk.nor[i*3+2],g=p.b*(.8+.2*Math.min(1,ly/hh));
  B.pos.push(p.x+(lx+ly*(p.l1||0))*cr+(lz+ly*(p.l2||0))*sr,p.y+ly,p.z-(lx+ly*(p.l1||0))*sr+(lz+ly*(p.l2||0))*cr);B.nor.push(nx*cr+nz*sr,bk.nor[i*3+1],-nx*sr+nz*cr);B.uv.push(bk.uv[i*2],bk.uv[i*2+1]);B.col.push(g*tr_,g*tg,g*tb);if(B.tw)B.tw.push(twb(ly,hh,p),0,p.ph||0)}
 for(let i=0;i<bk.idx.length;i++)B.idx.push(b0+bk.idx[i]);
 if(dead)return;
 const L=tr.leaf,Lf=A.l,frac=hq?1:tier===1?.22:.5,nq=Math.round(L.nq*frac),sc=frac<1?.92/Math.sqrt(frac):1,l0=Lf.pos.length/3;
 for(let q=0;q<nq;q++){const v=(q*.6180339+p.sd)%1,qb=1+(v-.5)*.12;
  for(let k=0;k<4;k++){const o=q*4+k,cx=L.ctr[q*3],cy=L.ctr[q*3+1],cz=L.ctr[q*3+2],lx=(cx+(L.pos[o*3]-cx)*sc)*s*sx,ly=(cy+(L.pos[o*3+1]-cy)*sc)*s*sy,lz=(cz+(L.pos[o*3+2]-cz)*sc)*s*sx,nx=L.nor[o*3],nz=L.nor[o*3+2],g=p.b*qb*(.74+.26*Math.min(1,ly/hh));
   Lf.pos.push(p.x+(lx+ly*(p.l1||0))*cr+(lz+ly*(p.l2||0))*sr,p.y+ly,p.z-(lx+ly*(p.l1||0))*sr+(lz+ly*(p.l2||0))*cr);Lf.nor.push(nx*cr+nz*sr,L.nor[o*3+1],-nx*sr+nz*cr);Lf.uv.push(L.uv[o*2],L.uv[o*2+1]);Lf.col.push(g*(1+j)*tn[0],g*tn[1],g*(1-j*.6)*tn[2]);if(Lf.tw)Lf.tw.push(twb(ly,hh,p),twf(p),p.ph||0)}
  for(let t=0;t<6;t++)Lf.idx.push(l0+q*4+L.pat[q*6+t])}
}
/* Conífera da floresta: uma malha só (tronco + folhagem), cor por vértice. Tingimento (tint/variação) só nos vértices de folha (lw=1); sombreamento de base como nas outras árvores. */
function addForest(p,tier,hq,F){
 const T=p.pr.tree,dead=p.pr.dead,s=p.s,cr=Math.cos(p.rot),sr=Math.sin(p.rot),sx=(p.pr.sx||1)*(p.ax||1),sy=(p.pr.sy||1)*(p.ay||1),hh=Math.max(.01,T.h*s*sy),j=(p.sd-.5)*.16,tn=tnt(p),
  L=T.lod[(tier===1&&!hq)?1:0],n=L.pos.length/3,b0=F.pos.length/3;
 for(let i=0;i<n;i++){const lx=L.pos[i*3]*s*sx,ly=L.pos[i*3+1]*s*sy,lz=L.pos[i*3+2]*s*sx,nx=L.nor[i*3],nz=L.nor[i*3+2],g=p.b*(.74+.26*Math.min(1,ly/hh)),r=L.col[i*3]*g,gg=L.col[i*3+1]*g,b=L.col[i*3+2]*g;
  F.pos.push(p.x+(lx+ly*(p.l1||0))*cr+(lz+ly*(p.l2||0))*sr,p.y+ly,p.z-(lx+ly*(p.l1||0))*sr+(lz+ly*(p.l2||0))*cr);F.nor.push(nx*cr+nz*sr,L.nor[i*3+1],-nx*sr+nz*cr);
  if(dead)F.col.push(r*.5,gg*.44,b*.4);
  else if(L.lw[i])F.col.push(r*(1+j)*tn[0],gg*tn[1],b*(1-j*.6)*tn[2]);
  else F.col.push(r*(1+j),gg,b*(1-j*.5));
  if(F.tw)F.tw.push(twb(ly,hh,p),(L.lw[i]&&!dead)?twf(p):0,p.ph||0)}
 const ix=dead?L.dIdx:L.idx;for(let i=0;i<ix.length;i++)F.idx.push(b0+ix[i])}
let FMAT=null;const forestMat=()=>FMAT||(FMAT=windify(new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide})));
OWM.extraMats.push(()=>FMAT?[FMAT]:[]);
function mkForestMesh(A,shadow){
 if(!A.idx.length)return null;const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(A.pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(A.nor,3));g.setAttribute('color',new THREE.Float32BufferAttribute(A.col,3));if(A.tw&&A.tw.length)g.setAttribute('tw',new THREE.Float32BufferAttribute(A.tw,3));
 g.setIndex(new THREE.BufferAttribute(new Uint32Array(A.idx),1));g.computeBoundingSphere();
 const m=new THREE.Mesh(g,forestMat());m.castShadow=shadow;m.receiveShadow=true;m.matrixAutoUpdate=false;m.updateMatrix();scene.add(m);return m}
function mkTreeMesh(A,mat,shadow){
 if(!A.idx.length)return null;const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(A.pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(A.nor,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(A.uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(A.col,3));if(A.tw&&A.tw.length)g.setAttribute('tw',new THREE.Float32BufferAttribute(A.tw,3));
 g.setIndex(new THREE.BufferAttribute(new Uint32Array(A.idx),1));g.computeBoundingSphere();
 const m=new THREE.Mesh(g,mat);m.castShadow=shadow;m.receiveShadow=true;m.matrixAutoUpdate=false;m.updateMatrix();scene.add(m);return m}
/* ---------- Texturas procedurais (tileáveis) de grama e pedra ---------- */
const GRASS_TILE=5;   // 1 repetição da textura do chão = 5 m
const STONE_SCALE=.75; // repetições da textura de pedra por metro (mapeamento triplanar)
function wrapNoise(N,seed){const r=rng(seed),L=new Float32Array(N*N);for(let i=0;i<L.length;i++)L[i]=r();
 return(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),
  a=L[(((yi%N)+N)%N)*N+(((xi%N)+N)%N)],b=L[(((yi%N)+N)%N)*N+((((xi+1)%N)+N)%N)],c=L[((((yi+1)%N)+N)%N)*N+(((xi%N)+N)%N)],d=L[((((yi+1)%N)+N)%N)*N+((((xi+1)%N)+N)%N)];
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}}
function fbmT(nz,x,y,per,oct){let s=0,a=.5,t=0;for(let o=0;o<oct;o++){s+=a*nz(x*per,y*per);t+=a;per*=2;a*=.5}return s/t}
const lin255=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};
/* Textura do chão, ESTILIZADA e LEVE: 128×128 só de RELEVO (média ≈ 1), sem foto e sem cor. R = grama (manchas macias de 2 tons + tufinhos), G = areia (ondulações suaves de duna
   + pedrinhas raras). Guardada como dado linear (valor × 1/170 → relevo de 0 a 1,5); o shader multiplica a cor por vértice pelo relevo, então a cor de cada bioma vem inteira dos vértices. */
function makeGroundCanvas(){
 const N=128,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d'),img=g.createImageData(N,N),d=img.data,
  n1=wrapNoise(4,31),n2=wrapNoise(8,47),n3=wrapNoise(16,59),r=rng(777),RG=new Float32Array(N*N),RS=new Float32Array(N*N),ss=(a,b,x)=>{x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x)};
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=x/N,v=y/N,m=fbmT(n2,u,v,8,2),w=fbmT(n1,u,v,4,1),f=fbmT(n3,u,v,16,1);
  RG[y*N+x]=.92+.16*ss(.44,.56,m)+(f-.5)*.05;                                   // grama: manchas macias claras/escuras
  RS[y*N+x]=1+.055*Math.sin((v*6+(w-.5)*1.8)*6.2832)+(f-.5)*.05}              // areia: ondulações de duna (periódicas, sem emenda)
 for(let k=0;k<46;k++){const x0=r()*N,y0=r()*N;                                // tufinhos de grama: 3 riscos claros em leque
  for(let b=-1;b<=1;b++){const ang=-Math.PI/2+b*.5+(r()-.5)*.3,len=4+r()*3;
   for(let t=0;t<len;t++){const px=Math.floor(x0+Math.cos(ang)*t+N*4)%N,py=Math.floor(y0+Math.sin(ang)*t+N*4)%N;RG[py*N+px]+=.16*(1-t/len)}}}
 for(let k=0;k<34;k++){const x0=Math.floor(r()*N),y0=Math.floor(r()*N);RS[y0*N+x0]-=.09;RS[y0*N+(x0+1)%N]-=.05}   // pedrinhas raras na areia
 for(const A of [RG,RS]){let m=0;for(let i=0;i<A.length;i++)m+=A[i];m/=A.length;for(let i=0;i<A.length;i++)A[i]=Math.max(.7,Math.min(1.5,A[i]/m))}   // média exatamente 1
 for(let i=0;i<N*N;i++){d[i*4]=Math.round(RG[i]*170);d[i*4+1]=Math.round(RS[i]*170);d[i*4+2]=128;d[i*4+3]=255}
 g.putImageData(img,0,0);return{c}}
function makeStoneCanvas(){
 const N=256,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d'),img=g.createImageData(N,N),d=img.data,
  n1=wrapNoise(8,5),n2=wrapNoise(32,9),n3=wrapNoise(64,13),r=rng(333),G=6,pts=[];
 for(let j=0;j<G;j++)for(let i=0;i<G;i++)pts.push([(i+.15+r()*.7)/G,(j+.15+r()*.7)/G,r()]);
 let sum=0;
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=x/N,v=y/N;
  let f1=9,f2=9,id=0,bx=0,by=0;
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const gi=((Math.floor(u*G)+i)%G+G)%G,gj=((Math.floor(v*G)+j)%G+G)%G,p=pts[gj*G+gi],ox=Math.floor(u*G)+i-gi,oy=Math.floor(v*G)+j-gj,
    dx=u-(p[0]+ox/G),dy=v-(p[1]+oy/G),dd=Math.sqrt(dx*dx+dy*dy);if(dd<f1){f2=f1;f1=dd;id=p[2];bx=dx;by=dy}else if(dd<f2)f2=dd}
  const edge=(f2-f1)*G,crack=1-Math.min(1,edge/.18),fa=fbmT(n1,u,v,8,1),fb=fbmT(n2,u,v,32,1),fc=fbmT(n3,u,v,64,1);   // per = tamanho do reticulado => a textura agora fecha sem emenda
  let l=.62+.2*(id-.5)+.18*(fa-.5)*2+.10*(fb-.5)*2+.06*(fc-.5)*2+(r()-.5)*.07;
  l+=Math.sin((v*7+(fa-.5)*1.6)*6.2832)*.035*(.4+id);                       // estratos sutis (periódicos: sem emenda)
  const bev=Math.pow(1-Math.min(1,edge/.34),1.5),dl=f1>1e-4?-(bx*.6+by*.8)/f1:0;l+=bev*dl*.13;   // chanfro: borda clara voltada pra luz, escura no lado oposto
  l-=Math.max(0,fb-.68)*.6;                                                  // pequenas cavidades
  l-=crack*crack*.34;
  const sp=r();if(sp<.012)l+=.13;else if(sp>.992)l-=.13;                      // grãos minerais claros/escuros
  l=Math.max(.2,Math.min(1,l));const i=(y*N+x)*4,vv=l*255,t2=(id*5.17)%1;d[i]=vv*(.94+.1*t2);d[i+1]=vv;d[i+2]=vv*(1.05-.1*t2);d[i+3]=255;sum+=lin255(vv)}
 g.putImageData(img,0,0);return{c,mean:sum/(N*N)}}
const mkTex=c=>{const t=new THREE.CanvasTexture(OWM.touch?OWM.shrinkSrc(c,OWM.perf.texMax):c);   /* celular: textura menor */ t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;t.anisotropy=OWM.touch?1:Math.min(8,R.capabilities.getMaxAnisotropy());t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;return t};
const ST=makeStoneCanvas(),stoneTex=mkTex(ST.c),groundTex=(()=>{const t=new THREE.CanvasTexture(makeGroundCanvas().c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=OWM.touch?1:Math.min(4,R.capabilities.getMaxAnisotropy());t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;return t})();   // dado linear (sem sRGB)

/* Chão ESTILIZADO: a cor de cada bioma vem inteira dos vértices (grama, areia, terra, arenito); a textura só dá relevo suave (1 leitura, 128×128):
   canal R na grama, G na areia/terra/pedra de encosta (o relevo da foto de grama que aparecia na areia do deserto saiu). GRASS_MATCH mantém o brilho médio da grama de antes. */
/* Chão do TEST PLATE: tabuleiro de tiles grandes (claro/escuro) de 8 m; cada tile tem 5×5 células de 1,6 m separadas por linhas finas mais escuras.
   Uma repetição da textura = 2×2 tiles (PLATE_REP = 16 m). Cores medidas na imagem de referência. */
function makePlateCanvas(){
 const N=1024,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d'),T=N/2,C=T/5;
 for(let j=0;j<2;j++)for(let i=0;i<2;i++){
  const lt=(i+j)%2===0;g.fillStyle=lt?'#707888':'#626a7c';g.fillRect(i*T,j*T,T,T);
  g.fillStyle=lt?'#5d6577':'#575f73';
  for(let k=1;k<5;k++){g.fillRect(i*T+k*C-1.5,j*T,3,T);g.fillRect(i*T,j*T+k*C-1.5,T,3)}
 }
 g.fillStyle='#505769';   // junta entre tiles (metade em cada borda → a textura fecha sem emenda)
 for(let k=0;k<2;k++){const p=k*T;g.fillRect(p-3,0,6,N);g.fillRect(0,p-3,N,6)}
 g.fillRect(N-3,0,3,N);g.fillRect(0,N-3,N,3);
 return c;
}
const plateMat=new THREE.MeshStandardMaterial({map:mkTex(makePlateCanvas()),roughness:.93,metalness:0});
const GRASS_MATCH=1;   // grama verde escuro: a cor dos vértices vale inteira (antes ×0,8 pra casar com a foto antiga)
const gA=[58,118,44].map(s2l),gB=[74,130,44].map(s2l),gRef=[0,1,2].map(c=>(gA[c]+gB[c])/2);   // cor média (linear) da grama por vértice
const terrMat=new THREE.MeshStandardMaterial({map:groundTex,vertexColors:true,roughness:GLOSS.rough,metalness:GLOSS.metal});
terrMat.onBeforeCompile=sh=>{
 sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`
 #ifdef USE_MAP
  vec2 rl=texture2D(map,vUv).rg*1.5;
  vec3 gr=vec3(${gRef[0].toFixed(5)},${gRef[1].toFixed(5)},${gRef[2].toFixed(5)});
  float gw=smoothstep(.95,.995,dot(normalize(vColor),normalize(gr)));            // 1 = chão de grama, 0 = terra/areia/pedra
  diffuseColor.rgb*=vColor*mix(rl.g,rl.r*${GRASS_MATCH.toFixed(3)},gw);
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
OWM.extraMats.push(()=>[propMat,terrMat,plateMat]);

/* Variação natural das árvores (determinística pela posição). Idade: muitas jovens/médias, poucas grandes e raras gigantes (distribuição inclinada);
   cada árvore ainda ganha proporção (copa larga/estreita), leve inclinação do tronco, tom de folha próprio (verde-amarelado ↔ azulado/escuro) e fase de vento. */
const hsh=(x,z,n)=>{const v=Math.sin(x*12.9898+z*78.233+n*37.719)*43758.5453;return v-Math.floor(v)};
function treeSize(x,z,k){const a=hsh(x,z,1),b=hsh(x,z,2),dead=k[0]==='d';
 let m=a<.22?.5+b*.22:a<.72?.8+b*.3:a<.94?1.1+b*.25:1.35+b*.35;   // 22% jovens · 50% adultas · 22% maiores · 6% veteranas
 return dead?Math.min(m,1.25):m}
function treeVar(x,z,k){const a=hsh(x,z,3),b=hsh(x,z,4),c=hsh(x,z,5),d=hsh(x,z,6),e=hsh(x,z,7),f=hsh(x,z,8),g=hsh(x,z,9);
 const w=.86+a*.3,hy=.9+b*.2;
 return{ax:w,ay:hy,l1:(c-.5)*.07,l2:(d-.5)*.07,
  tj:[.88+e*.24+(g>.9?.22:0),.9+f*.2-(g>.9?.06:0),.86+(1-e)*.24-(g>.9?.25:0)],ph:hsh(x,z,10)*6.2832}}
/* Decide onde ficam árvores/pedras de um chunk. Só depende da semente + chunk, então é igual sempre. */
function genProps(cx,cz,hv){
 if(PLATE)return [];
 const out=[],r=rng(hash('pk'+world.seed+','+cx+','+cz)),ox=cx*CS,oz=cz*CS;
 const dens=NZ((ox+8)/64+300,(oz+8)/64+300);                        // densidade de floresta: muda devagar pelo mapa
 const pick=(a,pw)=>a[Math.min(a.length-1,Math.floor(Math.pow(r(),pw||1)*a.length))];
 const free=(x,z,rad)=>{if(Math.abs(x)<5&&Math.abs(z)<5)return false;for(const p of out)if(Math.hypot(p.x-x,p.z-z)<rad+p.rad)return false;return true};
 const add=(k,x,z,h,rad,sj,oc)=>{const lk=lakeInfo(x,z),rv=riverInfo(x,z);if(lk&&lk.t<1.0)return;if(rv&&rv.strength>.2&&rv.dist<rv.width+rv.bank+1)return;const pr=pick((oc&&PROTO[k+'C'])||PROTO[k],k==='rock'?1.8:1);if(!pr)return;const isT=k==='oak'||k==='spruce'||k==='deadoak'||k==='deadspruce',s=PSC[k]*(1-sj+r()*sj*2)*(isT?treeSize(x,z,k):1),rd=Math.max(rad,pr.hx*s*1.6);if(!free(x,z,rd))return;const lx=x-ox,lz=z-oz,rr=Math.min(.9,pr.hx*s*.6),gy=Math.min(hvAt(hv,lx,lz),hvAt(hv,lx-rr,lz),hvAt(hv,lx+rr,lz),hvAt(hv,lx,lz-rr),hvAt(hv,lx,lz+rr))-.12;out.push({id:out.length,k,pr,x,z,y:gy,s,rot:r()*6.2832,rad:rd,b:.9+r()*.2,sd:r(),...(isT?treeVar(x,z,k):null)})};
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
  add(k,x,z,h,1.9,.18,cwT>0);
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
  const rd=rng(hash('ds'+world.seed+','+cx+','+cz)),zv=NZ((ox+8)/70+700,(oz+8)/70+300),nD=Math.round((1.5+zv*5.5+rd()*2)*.35);   // zv: manchas mais ou menos vegetadas · ×0,35 = 65% menos plantas (mais areia, menos mato)
  for(let a=0,n=0;a<nD*4&&n<nD;a++){
   const lx=1+(rd()*14|0),lz=1+(rd()*14|0),x=ox+lx+.5+(rd()-.5)*.8,z=oz+lz+.5+(rd()-.5)*.8,dw=desertW(x,z),u=rd();
   if(dw<.15||u>dw+.4)continue;
   if(mtnStamp(x,z)&&MTf>.05)continue;   // nada de planta dentro/embaixo de montanha
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
   const lk=lakeInfo(x,z),rv=riverInfo(x,z);if(lk&&lk.t<1.2)continue;if(rv&&rv.strength>.2&&rv.dist<rv.width+rv.bank+1)continue;
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
 const rem=world.edits['p'+ch.cx+','+ch.cz]||{},pos=[],nor=[],col=[],wd=[],list=[],old=world.meshes.get(ck(ch.cx,ch.cz)),hq=HQ(),tier=treeTier(ch.cx,ch.cz,old&&old.tier),hg=hq&&tier===0,TA={bt:{pos:[],nor:[],uv:[],col:[],idx:[],tw:[]},b:{pos:[],nor:[],uv:[],col:[],idx:[],tw:[]},l:{pos:[],nor:[],uv:[],col:[],idx:[],tw:[]},f:{pos:[],nor:[],col:[],idx:[],tw:[]},p:{b:{pos:[],nor:[],uv:[],col:[],idx:[],tw:[]},c:{pos:[],nor:[],uv:[],col:[],idx:[],tw:[]}}},CA={b:{pos:[],nor:[],uv:[],col:[],idx:[]},l:{pos:[],nor:[],uv:[],col:[],idx:[]}};
 for(const p of ch.props){
  if(rem[p.id])continue;
  if(p.k==='ds'){addForest(p,tier,hg,TA.f);const q=p.pr,hs=q.solid?Math.max(.18,q.cr*p.s):Math.max(.2,Math.min(q.hx,q.hz)*p.s*.5);list.push({id:p.id,cx:ch.cx,cz:ch.cz,k:'ds',x:p.x,z:p.z,hx:hs,hz:hs,y0:p.y,hy:q.h*p.s,solid:q.solid,hard:.5+q.h*p.s*.4});continue}
  const pr=p.pr,s=p.s,cr=Math.cos(p.rot),sr=Math.sin(p.rot),P=pr.pos,I=pr.idx,hh=Math.max(.01,pr.h*s);
  const hid=TMPHIDE.size&&TMPHIDE.has('p'+ch.cx+','+ch.cz+','+p.id);   // árvore que está tremendo/caindo: some do chunk, vira malha própria
  if(pr.cherry){if(!hid)addCherry(p,tier,hg,CA)}else if(pr.tree){if(!hid)addTree(p,tier,hg,TA)}else{
  const j=(p.sd-.5)*.14,cl=pr.pal.map(c=>[c[0]*p.b*(1+j),c[1]*p.b*(1+j*.4),c[2]*p.b*(1-j*.3)]);
  const NR=pr.nor;
  for(let t=0;t<I.length;t+=3){
   for(let q=0;q<3;q++){const i=I[t+q],lx=P[i*3]/100*s,ly=P[i*3+1]/100*s,lz=P[i*3+2]/100*s,nx=NR[i*3],nz=NR[i*3+2];
    pos.push(p.x+(lx+ly*(p.l1||0))*cr+(lz+ly*(p.l2||0))*sr,p.y+ly,p.z-(lx+ly*(p.l1||0))*sr+(lz+ly*(p.l2||0))*cr);nor.push(nx*cr+nz*sr,NR[i*3+1],-nx*sr+nz*cr);
    const g=.82+.18*Math.min(1,Math.max(0,ly/hh)),cc=cl[pr.col[i]];col.push(cc[0]*g,cc[1]*g,cc[2]*g);wd.push(p.k==='log'?1:0)}
  }}
  const hy=pr.hy*s,tree=p.k==='oak'||p.k==='spruce'||p.k==='cherry',dead=p.k==='deadoak'||p.k==='deadspruce';
  const lg=p.k==='log',ca=Math.abs(cr),sa=Math.abs(sr);
  list.push({id:p.id,cx:ch.cx,cz:ch.cz,k:p.k,x:p.x,z:p.z,hx:Math.max(.2,lg?pr.hx*s*ca+pr.hz*s*sa:pr.hx*s),hz:Math.max(.2,lg?pr.hx*s*sa+pr.hz*s*ca:pr.hz*s),y0:p.y,hy,solid:hy>=.55&&!lg,hard:tree?2.2:dead?1.6:p.k==='bigrock'?3.2:.8+hy*.3});
 }
 let pm=null;
 if(pos.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(nor),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(col),3));g.setAttribute('wd',new THREE.BufferAttribute(new Float32Array(wd),1));g.computeBoundingSphere();pm=new THREE.Mesh(g,propMat);pm.castShadow=pm.receiveShadow=true;pm.matrixAutoUpdate=false;pm.updateMatrix();scene.add(pm)}
 world.col.set(ck(ch.cx,ch.cz),list);
 const tm=TP&&(TA.b.idx.length||TA.l.idx.length)?treeMats(hq):null,cm=CA.b.idx.length?cherryMats():null;
 return{pm,tier,bm:tm?mkTreeMesh(TA.b,tm.bark,tier!==1):null,lm:tm?mkTreeMesh(TA.l,tm.leaf,tier!==1):null,sm:(cm?[mkTreeMesh(CA.b,cm.bark,true),mkTreeMesh(CA.l,cm.leaf,true)]:[]).concat(TA.f.idx.length?[mkForestMesh(TA.f,tier!==1)]:[]).concat(TA.bt.idx.length?[mkTreeMesh(TA.bt,btMat(),tier!==1)]:[]).concat(TA.p.b.idx.length||TA.p.c.idx.length?[mkTreeMesh(TA.p.b,ps1Mats().bark,tier!==1),mkTreeMesh(TA.p.c,ps1Mats().card,tier!==1)]:[]).filter(Boolean)};
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
const TC={cg:[134,181,94],pk:[240,178,198],grass:[58,118,44],grass2:[74,130,44],dirt:[121,98,66],rock:[124,126,130],sand:[218,200,142],dsA:[236,172,114],dsB:[222,148,96],dsR:[186,104,66],lit:[78,58,34],hum:[46,36,24],moss:[52,84,36],ndl:[104,76,46],dgr:[40,74,34],lgr:[96,118,52]};for(const k in TC)TC[k]=TC[k].map(s2l);   // dsA/dsB: areia de duna (alaranjada quente, como o modelo Dune - Arrakis), dsR: arenito nas encostas
function terrColor(wx,wz,h,ny,o,i){
 const v=.93+NZ(wx/5+300,wz/5)*.14,w=NZ(wx/23-90,wz/23+40),g=TC.grass,g2=TC.grass2,d=TC.dirt,rk=TC.rock,sd=TC.sand;
 const dt=sstep(.94,.85,ny),rt=sstep(.84,.72,ny),sa=sstep(SEA+1.4,SEA+.2,h)*(1-rt*.8);
 const lk=lakeInfo(wx,wz);let lsa=0,lw=1;if(lk){lsa=sstep(lk.wl+1.1,lk.wl+.1,h)*sstep(1.5,.9,lk.t);lw=1-.28*sstep(lk.wl+.3,lk.wl-.3,h)}   // margem/fundo de areia, mais escura molhada
 const cw=sstep(.04,.5,cherryW(wx,wz)),cp=cw>0?sstep(.5,.8,NZ(wx/3.2+410,wz/3.2-90))*.55*cw:0,cg=TC.cg,pk=TC.pk;   // cerejeiral: grama mais clara e manchas de pétalas
 const dw=sstep(.04,.55,desertW(wx,wz)),dv=dw>0?NZ(wx/11+60,wz/11-20):0,dA=TC.dsA,dB=TC.dsB,dR=TC.dsR;
 /* Chão de FLORESTA: onde a mata é densa (mesmo ruído de genProps) a grama rala e some sob serapilheira (folhas secas marrons), húmus escuro, musgo úmido e agulhas de pinheiro;
    nas clareiras fica grama alta mais clara. Manchas em 3 escalas (~40 m, ~9 m, ~2 m) dão o aspecto irregular de chão de mata real. */
 const fd=NZ((wx+8)/64+300,(wz+8)/64+300),ff0=sstep(.32,.68,fd)*(1-dw)*(1-cw)*(1-sstep(.2,.6,lsa+rt)),
  fa=NZ(wx/9+120,wz/9-60),fb=NZ(wx/2.2-40,wz/2.2+75),fc=NZ(wx/38+500,wz/38-210),
  coni=sstep(.55,.8,NZ(wx/80+900,wz/80-400)),   // mesmo mapa de pinheiros: sob coníferas o chão é mais coberto de agulhas
  clr=sstep(.42,.2,fd)*(1-dw)*(1-cw)*(1-lsa);   // clareira: capim mais claro
 const FL=TC.lit,FH=TC.hum,FM=TC.moss,FN=TC.ndl,FD=TC.dgr,FG=TC.lgr;   // deserto: areia com variação de tom; encosta íngreme vira arenito
 for(let c=0;c<3;c++){let x=g[c]+(g2[c]-g[c])*w;
  if(clr>0)x+=(FG[c]-x)*clr*.42*sstep(.35,.7,fc);
  if(ff0>0){x+=(FD[c]-x)*ff0*.55;                                                  // sombra: grama verde escura e rala
   const lit=ff0*sstep(.38,.62,fa*.6+fb*.4+(fc-.5)*.5)*(.55+.35*coni);               // serapilheira marrom em manchas
   x+=(FL[c]+(FN[c]-FL[c])*coni-x)*lit*.85;
   x+=(FH[c]-x)*ff0*sstep(.62,.9,fb)*.7;                                            // húmus escuro nos pontos mais fundos
   x+=(FM[c]-x)*ff0*sstep(.66,.88,fa)*(1-lit*.6)*.8}                                // musgo nas manchas úmidas
  if(cw>0){x+=(cg[c]-x)*cw*.65;x+=(pk[c]-x)*cp}x+=(d[c]-x)*dt;x+=(sd[c]-x)*sa;x+=(rk[c]-x)*rt;if(dw>0){const ds=dA[c]+(dB[c]-dA[c])*dv;x+=(ds+(dR[c]-ds)*Math.min(1,rt*.9+dt*.25)-x)*dw}x+=(sd[c]-x)*lsa;o[i+c]=x*v*lw}
}
/* Malha suave do terreno: 1 quad = 2 triângulos (diagonal igual à da colisão), normais por vértice. */
function buildTerrain(ch){
 if(PLATE)return null;   // Test plate: o chão visível é o plano único de plateGround() (vai até onde a câmera enxerga); os chunks só guardam colisão
 const hv=ch.hv,ox=ch.cx*CS,oz=ch.cz*CS,V=CS+1,pos=new Float32Array(V*V*3),nor=new Float32Array(V*V*3),col=new Float32Array(V*V*3),idx=new Uint16Array(CS*CS*6);
 for(let z=0;z<V;z++)for(let x=0;x<V;x++){const i=z*V+x,k=(z+1)*HP+x+1,h=hv[k],gx=(hv[k-1]-hv[k+1])/2,gz=(hv[k-HP]-hv[k+HP])/2,l=Math.hypot(gx,1,gz);
  pos[i*3]=x;pos[i*3+1]=h;pos[i*3+2]=z;nor[i*3]=gx/l;nor[i*3+1]=1/l;nor[i*3+2]=gz/l;if(PLATE){col[i*3]=col[i*3+1]=col[i*3+2]=1}else terrColor(ox+x,oz+z,h,1/l,col,i*3)}
 let n=0;for(let z=0;z<CS;z++)for(let x=0;x<CS;x++){const a=z*V+x,b=a+1,c=a+V,d=c+1;idx[n++]=a;idx[n++]=c;idx[n++]=b;idx[n++]=b;idx[n++]=c;idx[n++]=d}
 const uvs=new Float32Array(V*V*2);for(let z=0;z<V;z++)for(let x=0;x<V;x++){uvs[(z*V+x)*2]=(ox+x)/(PLATE?PLATE_REP:GRASS_TILE);uvs[(z*V+x)*2+1]=(oz+z)/(PLATE?PLATE_REP:GRASS_TILE)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));g.setAttribute('uv',new THREE.BufferAttribute(uvs,2));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setIndex(new THREE.BufferAttribute(idx,1));
 let mn=1e9,mx=-1e9;for(let i=1;i<pos.length;i+=3){if(pos[i]<mn)mn=pos[i];if(pos[i]>mx)mx=pos[i]}
 g.boundingBox=new THREE.Box3(new THREE.Vector3(0,mn,0),new THREE.Vector3(CS,mx,CS));g.boundingSphere=new THREE.Sphere(new THREE.Vector3(CS/2,(mn+mx)/2,CS/2),Math.hypot(CS/2,CS/2,(mx-mn)/2)+1);
 const m=new THREE.Mesh(g,PLATE?plateMat:terrMat);m.position.set(ox,0,oz);m.castShadow=false;m.receiveShadow=true;m.matrixAutoUpdate=false;m.updateMatrix();scene.add(m);return m;   // o chão só recebe sombra (não projeta em si mesmo → sem faixas de "shadow acne")
}

/* Chão do TEST PLATE: um único quad que acompanha o jogador e cobre todo o alcance da câmera (cam.far). Anda de PLATE_REP em PLATE_REP metros,
   então o desenho do tabuleiro (UV = metros ÷ PLATE_REP) fica parado no mundo. A geometria só é refeita se o alcance da câmera mudar. */
let plateGM=null,plateHalf=0;
function plateGround(px,pz){
 if(!PLATE||LOBBY||CAMB){if(plateGM)plateGM.visible=false;return}
 const half=Math.ceil((cam.far+PLATE_REP*2)/PLATE_REP)*PLATE_REP;
 if(!plateGM||half!==plateHalf){
  if(plateGM){scene.remove(plateGM);plateGM.geometry.dispose()}
  const h=half,u=h/PLATE_REP,g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array([-h,0,-h,h,0,-h,-h,0,h,h,0,h]),3));
  g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0]),3));
  g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array([-u,-u,u,-u,-u,u,u,u]),2));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array([0,2,1,1,2,3]),1));
  plateGM=new THREE.Mesh(g,plateMat);plateGM.frustumCulled=false;plateGM.castShadow=false;plateGM.receiveShadow=true;plateHalf=half;scene.add(plateGM);
 }
 plateGM.visible=true;plateGM.position.set(Math.round(px/PLATE_REP)*PLATE_REP,PLATE_H,Math.round(pz/PLATE_REP)*PLATE_REP);
}

/* ---------- Água dos lagos: simulação de ondas (campo de alturas) + shader ----------
   Cada lago tem uma grade própria (equação da onda discreta): a altura h e a velocidade v de cada célula evoluem juntas, então
   marolas nascem, se espalham, refletem nas margens e morrem sozinhas. Nas partes rasas a onda anda mais devagar e perde energia
   (como na vida real). Chuva fraca de gotas faz o lago "respirar"; o jogador gera respingo ao entrar e esteira ao nadar/andar.
   A grade vira textura float (R=altura, G/B=inclinação, A=máscara de água) lida pelo shader (vértices + normais) e pela física. */
const SIM_DT=1/60,SIM_MAXN=160,SIM_RANGE=70,SIM_C=3.2;   // passo fixo (s), células por lado, alcance de atividade (m), velocidade da onda em água funda (m/s)
const sims=new Map(),lakeKey=L=>L.px.toFixed(1)+','+L.pz.toFixed(1);
let riverMat=null;   // criado depois do shader dos lagos (mesmo material, sem simulação de ondas)
const FLOW0=new THREE.DataTexture(new Float32Array(4),1,1,THREE.RGBAFormat,THREE.FloatType);FLOW0.minFilter=FLOW0.magFilter=THREE.NearestFilter;FLOW0.generateMipmaps=false;FLOW0.needsUpdate=true;
const WSH={uFlow:{value:FLOW0},uFlowOn:{value:0},uTime:{value:0},uDay:{value:1},uLin:{value:0},uCam:{value:new THREE.Vector3()},uSun:{value:new THREE.Vector3(0,1,0)},uSunC:{value:new THREE.Color(1,.95,.86)},uSky:{value:new THREE.Color(.5,.7,.95)},uFogC:{value:new THREE.Color(.72,.86,.98)},uFogN:{value:60},uFogF:{value:150}};
const SIMGLSL=`vec4 simS(vec2 p){vec2 t=(p-uSimO)/uSimDx-.5,i=floor(t),f=fract(t),a=clamp(i,0.,uSimN-1.),b=clamp(i+1.,0.,uSimN-1.);
 vec4 s00=texture2D(uSim,(a+.5)/uSimN),s10=texture2D(uSim,(vec2(b.x,a.y)+.5)/uSimN),s01=texture2D(uSim,(vec2(a.x,b.y)+.5)/uSimN),s11=texture2D(uSim,(b+.5)/uSimN);
 return mix(mix(s00,s10,f.x),mix(s01,s11,f.x),f.y);}`;
const WVS=`precision highp sampler2D;attribute float dp;uniform sampler2D uSim;uniform float uSimN,uSimDx;uniform vec2 uSimO;varying vec3 vWP;varying float vDp;
 ${SIMGLSL}
 void main(){vec4 wp=modelMatrix*vec4(position,1.);wp.y+=simS(wp.xz).x*smoothstep(0.,.5,dp);vWP=wp.xyz;vDp=dp;gl_Position=projectionMatrix*viewMatrix*wp;}`;
const WFS=`precision highp sampler2D;uniform float uTime,uDay,uLin,uFogN,uFogF;uniform vec3 uCam,uSun,uSunC,uSky,uFogC;uniform sampler2D uSim,uFlow;uniform float uSimN,uSimDx,uFlowOn;uniform vec2 uSimO;varying vec3 vWP;varying float vDp;
 ${SIMGLSL}
 float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
 float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
 float wv0(vec2 p){return vn(p*3.7-uTime*vec2(.28,.45))*.5+vn(p*8.1+uTime*vec2(.5,-.4))*.25;}
 vec2 flowAt(vec2 p){vec2 i=floor((p-uSimO)/uSimDx);if(i.x<0.||i.y<0.||i.x>=uSimN||i.y>=uSimN)return vec2(0.);return texture2D(uFlow,(i+.5)/uSimN).xy;}
 float wv(vec2 p){   // correnteza (rios): o micro-detalhe anda com a água; duas fases defasadas evitam o "esticamento" do ruído
  if(uFlowOn<.5)return wv0(p);
  vec2 f=flowAt(p);float ph=fract(uTime*.4);
  return mix(wv0(p-f*fract(ph+.5)*2.5),wv0(p-f*ph*2.5),abs(2.*ph-1.));}   // só micro-detalhe; as ondas grandes vêm da simulação
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
 return{L,n,dx,ox,oz,half,h,v,kk,dmp,data,tex,mat,on:false,k0:Math.pow(2*SIM_DT*SIM_C/dx,2),qx:new Float32Array(N),qz:new Float32Array(N),fu:null,fv:null,mode:0};
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
/* ---------- Água: ondas nos rios · correnteza · fluido 2D (Configurações: wRiver / wFlow / wFluid; podem ficar ligadas juntas) ----------
   Rios: uma janela de simulação (grade RW.n × RW.n, RW.dx m) acompanha o jogador e usa a MESMA simulação dos lagos (respingo, esteira, gotas, ondas dos peixes).
   A máscara de água e a correnteza de cada célula vêm de riverInfo() e são calculadas aos poucos (orçamento de tempo por quadro) quando a janela anda.
   Correnteza: velocidade ao longo do eixo do rio (maior no centro); empurra o jogador e faz o micro-detalhe da água fluir (mapa de fluxo no shader).
   Fluido 2D: equações de águas rasas (altura + fluxos nas faces da grade) com advecção pela correnteza: as ondas viajam com a água e os passos empurram a água. */
const FLOW_V=1.8;
function riverWaterAt(x,z){const r=riverInfo(x,z);return(r&&r.dist<=r.width*.98&&r.strength>.2&&groundH(x,z)<r.wl-.03)?r:null}
function riverFlowVec(r,out){   // correnteza (m/s) no ponto descrito por riverInfo r (sentido = +along)
 const c=r.cfg,ds=(riverSway(r.along+.6,c)-riverSway(r.along-.6,c))/1.2;
 let tx=c.cos-ds*c.sin,tz=c.sin+ds*c.cos;const l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;
 const q=Math.max(0,1-(r.dist/r.width)*(r.dist/r.width)),sp=FLOW_V*(.35+.65*q)*Math.min(1,r.strength*1.4);
 out.x=tx*sp;out.z=tz*sp;return out;
}
const _flow={x:0,z:0};
function simStepFluid(s){   // águas rasas em grade desencontrada: q* = fluxo na face +x / +z da célula; c² ∝ profundidade (kk)
 const{n,h,kk,dmp,qx,qz,fu,fv}=s,ca=SIM_C*SIM_C*SIM_DT/s.dx,cb=SIM_DT/s.dx;
 for(let j=1;j<n-1;j++)for(let i=1;i<n-1;i++){const id=j*n+i,k=kk[id];if(!k){qx[id]=qz[id]=0;continue}
  const kx=kk[id+1],kz=kk[id+n];
  qx[id]=kx?(qx[id]-ca*.5*(k+kx)*(h[id+1]-h[id]))*dmp[id]:0;
  qz[id]=kz?(qz[id]-ca*.5*(k+kz)*(h[id+n]-h[id]))*dmp[id]:0}
 for(let j=1;j<n-1;j++)for(let i=1;i<n-1;i++){const id=j*n+i;if(!kk[id])continue;
  let nh=h[id]-cb*(qx[id]-(kk[id-1]?qx[id-1]:0)+qz[id]-(kk[id-n]?qz[id-n]:0));
  if(fu){const u=fu[id],w=fv[id],c=nh;   // advecção por upwind: a onda anda com a correnteza
   if(u>0)nh-=u*(c-(kk[id-1]?h[id-1]:c));else if(u<0)nh-=u*((kk[id+1]?h[id+1]:c)-c);
   if(w>0)nh-=w*(c-(kk[id-n]?h[id-n]:c));else if(w<0)nh-=w*((kk[id+n]?h[id+n]:c)-c)}
  h[id]=nh*.9985}   // relaxa o nível médio (as gotas tiram volume e a correnteza o empilharia na borda)
}
/* empurra a água (vx,vz m/s) numa mancha gaussiana: os passos criam esteira de verdade (fluido 2D) */
function simPush(s,x,z,r,vx,vz,dt){
 const{n,dx,qx,qz,kk}=s,ci=(x-s.ox)/dx-.5,cj=(z-s.oz)/dx-.5,rr=r/dx,R=Math.ceil(rr*1.8),g=.03*Math.min(1,dt*60);
 for(let j=Math.max(1,Math.floor(cj)-R);j<=Math.min(n-2,Math.ceil(cj)+R);j++)for(let i=Math.max(1,Math.floor(ci)-R);i<=Math.min(n-2,Math.ceil(ci)+R);i++){
  const id=j*n+i;if(!kk[id])continue;const d2=((i-ci)**2+(j-cj)**2)/(rr*rr);if(d2<3.2){const w=g*Math.exp(-d2);qx[id]+=vx*w;qz[id]+=vz*w}}
}
const RW={n:96,dx:.6,s:null,live:false,sp:0,dirty:false,nWet:0};
function mkRiverWin(){
 const n=RW.n,dx=RW.dx,N=n*n,mkTex=d=>{const t=new THREE.DataTexture(d,n,n,THREE.RGBAFormat,THREE.FloatType);t.minFilter=t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;return t};
 const data=new Float32Array(N*4),fdata=new Float32Array(N*4);
 return{L:null,n,dx,ox:0,oz:0,half:n*dx/2,h:new Float32Array(N),v:new Float32Array(N),kk:new Float32Array(N),dmp:new Float32Array(N),qx:new Float32Array(N),qz:new Float32Array(N),
  fu:new Float32Array(N),fv:new Float32Array(N),todo:new Uint8Array(N),scr:new Float32Array(N),data,tex:mkTex(data),fdata,ftex:mkTex(fdata),on:true,k0:Math.pow(2*SIM_DT*SIM_C/dx,2),init:false,mode:0,oi:0,oj:0};
}
function riverWinShift(s,ci,cj){   // move a janela (em células inteiras); o que sai se perde e as células novas entram na fila de máscara
 const n=s.n,di=ci-s.oi,dj=cj-s.oj,t=s.scr;
 for(const a of[s.h,s.v,s.kk,s.dmp,s.qx,s.qz,s.fu,s.fv,s.todo]){
  t.fill(0);
  for(let j=0;j<n;j++){const sj=j+dj;if(sj<0||sj>=n)continue;for(let i=0;i<n;i++){const si=i+di;if(si>=0&&si<n)t[j*n+i]=a[sj*n+si]}}
  a.set(t)}
 for(let j=0;j<n;j++){const sj=j+dj;for(let i=0;i<n;i++){const si=i+di;if(sj<0||sj>=n||si<0||si>=n)s.todo[j*n+i]=1}}
 // o mapa de fluxo (RGBA) acompanha as células
 const f=s.fdata,o=new Float32Array(f);f.fill(0);
 for(let j=0;j<n;j++){const sj=j+dj;if(sj<0||sj>=n)continue;for(let i=0;i<n;i++){const si=i+di;if(si>=0&&si<n){const a=(sj*n+si)*4,b=(j*n+i)*4;f[b]=o[a];f[b+1]=o[a+1]}}}
 s.oi=ci;s.oj=cj;s.ox=ci*s.dx;s.oz=cj*s.dx;s.dirty=true;
}
function riverWinMask(s,budgetMs){   // calcula a máscara/correnteza das células pendentes, no máximo budgetMs por quadro
 const n=s.n,N=n*n,t0=performance.now();let did=0;
 for(let c=0;c<N;c++){
  const id=s.sp;s.sp=(s.sp+1)%N;if(!s.todo[id])continue;
  const i=id%n,j=(id/n)|0;s.todo[id]=0;did++;const o=id*4;
  let k=0;s.fu[id]=s.fv[id]=0;s.fdata[o]=s.fdata[o+1]=0;
  if(i>0&&j>0&&i<n-1&&j<n-1){
   const x=s.ox+(i+.5)*s.dx,z=s.oz+(j+.5)*s.dx,r=riverWaterAt(x,z);
   if(r){const d=r.wl-groundH(x,z);if(d>.05){k=Math.max(.12,Math.min(1,d/3));riverFlowVec(r,_flow);s.fdata[o]=_flow.x;s.fdata[o+1]=_flow.z;s.fu[id]=_flow.x*SIM_DT/s.dx;s.fv[id]=_flow.z*SIM_DT/s.dx}}}
  s.kk[id]=k;s.dmp[id]=k?(k<.35?.982:.9975):0;if(!k){s.h[id]=s.v[id]=s.qx[id]=s.qz[id]=0}
  if((did&63)===0&&performance.now()-t0>budgetMs)break;
 }
 if(did){s.dirty=true;let w=0;for(let id=0;id<N;id++)if(s.kk[id])w++;RW.nWet=w}
}
function updateRiverSim(dt,steps,fluid){
 const want=!!(S.wRiver||S.wFlow||S.wFluid),mat=getRiverMat();
 if(!want){
  if(RW.live&&RW.s){const s=RW.s;s.h.fill(0);s.v.fill(0);s.qx.fill(0);s.qz.fill(0);simPack(s);mat.uniforms.uFlowOn.value=0;RW.live=false}
  return;
 }
 if(!RW.s)RW.s=mkRiverWin();const s=RW.s,n=s.n;
 if(!RW.live){RW.live=true;mat.uniforms.uSim.value=s.tex;mat.uniforms.uSimN.value=n;mat.uniforms.uSimDx.value=s.dx;mat.uniforms.uFlow.value=s.ftex;s.init=false}
 const ci=Math.round(P.p.x/s.dx-n/2),cj=Math.round(P.p.z/s.dx-n/2);
 if(RW.seed!==world.seed){RW.seed=world.seed;s.init=false}   // outro mundo: recalcula a máscara
 if(!s.init){s.init=true;s.oi=ci;s.oj=cj;s.ox=ci*s.dx;s.oz=cj*s.dx;s.todo.fill(1);s.kk.fill(0);s.h.fill(0);s.v.fill(0);s.qx.fill(0);s.qz.fill(0);s.fu.fill(0);s.fv.fill(0);s.fdata.fill(0);s.sp=0}
 else if(Math.abs(ci-s.oi)>10||Math.abs(cj-s.oj)>10)riverWinShift(s,ci,cj);
 riverWinMask(s,1.6);
 mat.uniforms.uSimO.value.set(s.ox,s.oz);mat.uniforms.uFlowOn.value=S.wFlow?1:0;
 if(s.dirty){s.dirty=false;s.ftex.needsUpdate=true}
 const waves=!!(S.wRiver||S.wFluid);
 if(waves&&RW.nWet>0){
  if(Math.random()<dt*10)simDrop(s,s.ox+Math.random()*n*s.dx,s.oz+Math.random()*n*s.dx,.5+Math.random()*.5,-(.006+Math.random()*.014));   // gotas / vento
  if(s.mode!==(fluid?1:0)){s.mode=fluid?1:0;s.v.fill(0);s.qx.fill(0);s.qz.fill(0)}
  for(let i=0;i<steps;i++)fluid?simStepFluid(s):simStep(s);
  simPack(s);
 }else if(s.mode!==-1){s.mode=-1;s.h.fill(0);s.qx.fill(0);s.qz.fill(0);simPack(s)}
}
/* Nível real da superfície da água: combina lagos com rios e mantém a física de natação existente. */
function waterSurf(x,z){
 let y=-Infinity;const k=lakeInfo(x,z);
 if(k&&k.t<=1.3&&groundH(x,z)<k.wl){const sim=sims.get(lakeKey(k.L));y=k.wl+(sim&&sim.on?simH(sim,x,z):0)}
 const r=riverInfo(x,z);
 if(r&&r.dist<=r.width*.98&&r.strength>.2&&groundH(x,z)<r.wl-.03)y=Math.max(y,r.wl);
 return y;
}
/* ---------- Peixes low-poly dos rios + carne coletável ----------
   Modelo CC-BY-4.0 "Low Poly Fish" por Floreswa. Os spawns são determinísticos pela semente;
   peixes abatidos e carne no chão são persistidos em world.edits. */
const FISH_SEGMENT=4.5,FISH_HP=17.5,FISH_SPAWN_CHANCE=.95,FISH_ACTIVE_RADIUS=90,FISH_SIZE=.92,FISH_MEAT_DROP=3,FISH_MEAT_FOOD=17,FISH_HIT_R=1.44,FISH_EXTRA_REACH=.6;   // drop: 3 carnes; cada carne recupera 17 de fome; hitbox esférica e alcance extra pra acertar mais fácil
const FISH_NAMES=['fish','fish.001','fish.002'];
let fishBaseScene=null,fishModelsReady=false,fishSyncTimer=0,fishMeatSyncTimer=0,fishClock=0;
const fishActors=new Map(),fishMeatMeshes=new Map(),fishMeatRay=new THREE.Raycaster();
const FISH_MEAT_GEO=new THREE.DodecahedronGeometry(.19,0);
const FISH_MEAT_MAT=new THREE.MeshStandardMaterial({color:0xf1796c,roughness:.92,metalness:0});
const FISH_BONE_GEO=new THREE.CylinderGeometry(.018,.018,.19,5);
const FISH_BONE_MAT=new THREE.MeshStandardMaterial({color:0xffe8ce,roughness:.9});const fishStateKey=(cx,cz)=>'pf'+cx+','+cz;
const fishMeatKey=(cx,cz)=>'pm'+cx+','+cz;
function fishWasCaught(cx,cz,id){const a=world.edits[fishStateKey(cx,cz)];return !!(a&&a[id])}
function findFishMeatDrop(cx,cz,id){const a=world.edits[fishMeatKey(cx,cz)];return Array.isArray(a)?a.find(d=>String(d.id)===String(id)):null}
function makeFishActor(id,lane,seg,along0,crossOffset,phase,x,z,cx,cz,channel){
 if(!fishModelsReady||fishActors.has(id))return null;
 const model=fishBaseScene.clone(true),variant=model.getObjectByName(FISH_NAMES[Math.abs(hash(id))%FISH_NAMES.length]);
 if(!variant){console.warn('[OWM] Variante de peixe ausente:',id);return null}
 for(const name of FISH_NAMES){const o=model.getObjectByName(name);if(o)o.visible=o===variant}
 model.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(variant),size=new THREE.Vector3(),center=new THREE.Vector3();box.getSize(size);box.getCenter(center);
 const scale=FISH_SIZE/Math.max(size.x,size.y,size.z,1e-3),visual=new THREE.Group();
 visual.scale.setScalar(scale);visual.position.set(-center.x*scale,-center.y*scale,-center.z*scale);visual.add(model);
 const group=new THREE.Group();group.add(visual);group.userData.fishId=id;group.frustumCulled=false;
 const f={id,cfg:lane,seg,along0,crossOffset,phase,group,x,z,cx,cz,channel,lastX:x,lastZ:z,hp:FISH_HP,hb:null,barT:0,fill:null};
 fishActors.set(id,f);scene.add(group);return f;
}
function syncFish(){
 fishSyncTimer=1.2;if(!fishModelsReady||state!=='play')return;
 const px=P.p.x,pz=P.p.z,keep=new Set(),span=Math.ceil(FISH_ACTIVE_RADIUS/FISH_SEGMENT)+1;
 for(let t=0;t<3;t++){
  const C=RIVER_CELLS[t],pcx=Math.floor(px/C),pcz=Math.floor(pz/C);
  for(let cx=pcx-1;cx<=pcx+1;cx++)for(let cz=pcz-1;cz<=pcz+1;cz++){
   const cfg=riverCell(t,cx,cz);if(!cfg.active)continue;
   const along=(px-cfg.ax)*cfg.cos+(pz-cfg.az)*cfg.sin,baseSeg=Math.floor(along/FISH_SEGMENT);
   for(let seg=baseSeg-span;seg<=baseSeg+span;seg++)for(let channel=0;channel<cfg.count;channel++){
    const id='f'+cfg.key+'_'+seg+'_'+channel,rr=rng(hash('owm-fish-v3-'+world.seed+'-'+id));
    if(rr()>FISH_SPAWN_CHANCE)continue;
    const a=(seg+.5)*FISH_SEGMENT+(rr()-.5)*FISH_SEGMENT*.6,crossOffset=(rr()-.5)*RIVER_HALF_WIDTH*.8,center=riverSway(a,cfg)+cfg.offsets[channel]+crossOffset;
    const x=cfg.ax+a*cfg.cos-center*cfg.sin,z=cfg.az+a*cfg.sin+center*cfg.cos;
    if(Math.hypot(x-px,z-pz)>FISH_ACTIVE_RADIUS)continue;
    const rv=riverInfo(x,z);if(!rv||rv.lane!==cfg.key||rv.channel!==channel||rv.strength<.45||rv.dist>rv.width*.88||groundH(x,z)>=rv.wl-.05)continue;
    const fcx=Math.floor(x/CS),fcz=Math.floor(z/CS);if(fishWasCaught(fcx,fcz,id))continue;
    keep.add(id);let f=fishActors.get(id);
    if(!f)f=makeFishActor(id,cfg,seg,a,crossOffset,rr()*Math.PI*2,x,z,fcx,fcz,channel);
    if(f){f.along0=a;f.crossOffset=crossOffset;f.cx=fcx;f.cz=fcz;f.channel=channel;f.cfg=cfg}
   }
  }
 }
 for(const [id,f] of fishActors)if(!keep.has(id))fishRemove(f);
}
function syncFishMeatDrops(){
 const pcx=Math.floor(P.p.x/CS),pcz=Math.floor(P.p.z/CS),keep=new Set();
 for(let cx=pcx-3;cx<=pcx+3;cx++)for(let cz=pcz-3;cz<=pcz+3;cz++){
  const list=world.edits[fishMeatKey(cx,cz)];if(!Array.isArray(list))continue;
  for(const d of list){if(!d||d.id==null||!Number.isFinite(d.x)||!Number.isFinite(d.z))continue;
   const id=String(d.id);keep.add(id);let m=fishMeatMeshes.get(id);
   if(!m){m=new THREE.Group();const flesh=new THREE.Mesh(FISH_MEAT_GEO,FISH_MEAT_MAT);flesh.scale.set(1.18,.76,.72);flesh.rotation.z=.22;m.add(flesh);const bone=new THREE.Mesh(FISH_BONE_GEO,FISH_BONE_MAT);bone.rotation.z=Math.PI/2;bone.position.set(.12,.045,0);m.add(bone);m.userData.fishMeatPickup={id:d.id,cx,cz};scene.add(m);fishMeatMeshes.set(id,m)}
   m.position.set(d.x,groundH(d.x,d.z)+.16,d.z);m.rotation.y=Number(d.r)||0;
  }
 }
 for(const[id,m]of fishMeatMeshes)if(!keep.has(id)){scene.remove(m);fishMeatMeshes.delete(id)}
}
function addFishMeatDrop(x,z){
 const cx=Math.floor(x/CS),cz=Math.floor(z/CS),key=fishMeatKey(cx,cz),list=world.edits[key]||(world.edits[key]=[]);
 const id='meat-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
 list.push({id,x,z,r:Math.random()*Math.PI*2});fishMeatSyncTimer=0;
}
function fishRemove(f){if(f.hb){scene.remove(f.hb);f.hb.traverse(o=>{if(o.material)o.material.dispose()});f.hb=null}scene.remove(f.group);fishActors.delete(f.id)}
/* Abate o peixe: a carne vai DIRETO para o inventário (só cai no chão se a mochila estiver cheia). */
function killFish(f){
 if(!f||!fishActors.has(f.id))return false;
 const x=f.x,z=f.z;fishRemove(f);
 const key=fishStateKey(f.cx,f.cz),caught=world.edits[key]||(world.edits[key]={});caught[f.id]=1;
 let got=0;for(let i=0;i<FISH_MEAT_DROP;i++){if(invAdd('fish_meat',1))got++;else addFishMeatDrop(x+(Math.random()-.5)*.8,z+(Math.random()-.5)*.8)}   // cada carne vai pro inventário; o que não couber cai no chão
 toast(got===FISH_MEAT_DROP?'+'+got+' Carne de peixe':got>0?'+'+got+' Carne de peixe — o resto caiu no chão':'Inventário cheio — a carne caiu no chão');if(invOpen)invRender();
 saveWorld();return true;
}
/* Barra de vida do peixe (igual à dos escorpiões), aparece ao atacar e some depois de alguns segundos sem dano. */
const FISH_BAR_GEO=new THREE.PlaneGeometry(1,1);
function fishShowBar(f){
 if(!f.hb){
  const hb=new THREE.Group(),bg=new THREE.Mesh(FISH_BAR_GEO,new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.7,depthTest:false})),fill=new THREE.Mesh(FISH_BAR_GEO,new THREE.MeshBasicMaterial({color:0xe04a3a,depthTest:false}));
  bg.scale.set(.62,.1,1);fill.scale.set(.58,.06,1);fill.position.z=.001;bg.renderOrder=998;fill.renderOrder=999;hb.add(bg,fill);scene.add(hb);f.hb=hb;f.fill=fill;
 }
 const r=Math.max(0,f.hp/FISH_HP);f.fill.scale.x=Math.max(.001,.58*r);f.fill.position.x=-(1-r)*.29;f.hb.visible=true;f.barT=4;
}
function fishHurt(f,amount){
 if(!f||!fishActors.has(f.id))return;f.hp-=amount;f.flash=.15;
 if(f.hp<=0){killFish(f);return}
 fishShowBar(f);
}
/* golpe no peixe: mesmo ritmo/dano dos golpes nos escorpiões (arma ou punho) */
function fishPunch(f){
 if(pDmgT>0)return;const punchPower=archetypeMul('punchDamage'),w=OWM.weapon.id&&WPS[OWM.weapon.id];
 if(w){if(!(anim.strike&&anim.strike()))return;pDmgT=w.cd*.9;fishHurt(f,w.dmg*punchPower);lmbHitFx(f.group.position);return}
 pDmgT=SCP.PUNCH_CD;fishHurt(f,SCP.PUNCH*punchPower);lmbHitFx(f.group.position);
}
function rayFish(origin,direction){
 if(!fishActors.size)return null;
 let best=null;
 /* 1) hitbox esférica generosa em volta do peixe (FISH_HIT_R), com alcance um pouco maior: não precisa mais acertar a malha fina do modelo */
 for(const f of fishActors.values()){
  if(!f.group.visible)continue;
  const p=f.group.position,ox=p.x-origin.x,oy=p.y-origin.y,oz=p.z-origin.z,tca=ox*direction.x+oy*direction.y+oz*direction.z;
  if(tca<0||tca>REACH+FISH_EXTRA_REACH+FISH_HIT_R)continue;
  const d2=ox*ox+oy*oy+oz*oz-tca*tca,r2=FISH_HIT_R*FISH_HIT_R;if(d2>r2)continue;
  const t=Math.max(0,tca-Math.sqrt(r2-d2));if(t>REACH+FISH_EXTRA_REACH)continue;
  if(!best||t<best.t)best={f,t};
 }
 /* 2) acerto exato na malha continua valendo */
 fishMeatRay.set(origin,direction);
 const hits=fishMeatRay.intersectObjects([...fishActors.values()].map(f=>f.group),true);
 for(const h of hits){if(h.distance>REACH+FISH_EXTRA_REACH)break;let o=h.object;while(o&&o!==scene&&!(o.userData&&o.userData.fishId))o=o.parent;
  const f=o&&fishActors.get(o.userData.fishId);if(f&&f.group.visible){if(!best||h.distance<best.t)best={f,t:h.distance};break}}
 return best;
}
function updateFish(dt){
 fishClock+=dt;fishSyncTimer-=dt;fishMeatSyncTimer-=dt;
 if(fishSyncTimer<=0)syncFish();if(fishMeatSyncTimer<=0){fishMeatSyncTimer=.55;syncFishMeatDrops()}
 for(const f of fishActors.values()){
  const cfg=f.cfg,a=f.along0+Math.sin(fishClock*.57+f.phase)*2.2;
  const cross=riverSway(a,cfg)+cfg.offsets[f.channel]+f.crossOffset,x=cfg.ax+a*cfg.cos-cross*cfg.sin,z=cfg.az+a*cfg.sin+cross*cfg.cos,rv=riverInfo(x,z);
  if(!rv||rv.lane!==cfg.key||rv.channel!==f.channel){f.group.visible=false;if(f.hb)f.hb.visible=false;continue}f.group.visible=true;
  const y=rv.wl-.1+Math.sin(fishClock*2.1+f.phase)*.04;f.group.position.set(x,y,z);
  const dx=x-f.lastX,dz=z-f.lastZ;if(Math.hypot(dx,dz)>.001)f.group.rotation.y=Math.atan2(dx,dz);
  f.lastX=x;f.lastZ=z;f.x=x;f.z=z;
  if(RW.live&&RW.s&&RW.nWet>0&&(S.wRiver||S.wFluid)&&Math.random()<dt*2.2)simDrop(RW.s,x,z,.45,-.012);   // marolas dos peixes
  if(f.hb){f.barT-=dt;if(f.barT<=0)f.hb.visible=false;else{f.hb.visible=true;f.hb.position.set(x,y+.55,z);f.hb.quaternion.copy(cam.quaternion)}}
 }
}
function clearFish(){
 for(const f of [...fishActors.values()])fishRemove(f);
 for(const m of fishMeatMeshes.values())scene.remove(m);fishMeatMeshes.clear();fishSyncTimer=0;fishMeatSyncTimer=0;fishClock=0;
}
if(THREE.GLTFLoader&&OWM.fishPack){new THREE.GLTFLoader().parse(JSON.stringify(OWM.fishPack),'',g=>{fishBaseScene=g.scene;for(let i=0;i<FISH_NAMES.length;i++)if(!fishBaseScene.getObjectByName(FISH_NAMES[i]))FISH_NAMES[i]=FISH_NAMES[i].replace(/[\[\]\.:\/]/g,'');fishModelsReady=FISH_NAMES.every(n=>!!fishBaseScene.getObjectByName(n));if(!fishModelsReady)console.warn('[OWM] Pack de peixes carregou sem todas as variantes.');else console.info('[OWM] Pack Low Poly Fish carregado:',FISH_NAMES.length,'variantes')},e=>console.error('[OWM] Falha ao carregar o pack de peixes',e))}

const lakesNear=(x,z)=>{if(PLATE)return [];const cx=Math.floor(x/LAKE_CELL),cz=Math.floor(z/LAKE_CELL),a=[];for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const L=lakeParams(cx+i,cz+j);if(L&&Math.hypot(L.px-x,L.pz-z)<L.R*1.7+12)a.push(L)}return a};
/* Água dos rios: MESMO shader dos lagos (cor por profundidade, espuma na margem, reflexo, névoa). A grade de ondas é uma textura 1x1 zerada. */
const RIVER_DP_CAP=1.5;
function getRiverMat(){
 if(riverMat)return riverMat;
 const data=new Float32Array(4),tex=new THREE.DataTexture(data,1,1,THREE.RGBAFormat,THREE.FloatType);tex.minFilter=tex.magFilter=THREE.NearestFilter;tex.generateMipmaps=false;tex.needsUpdate=true;
 riverMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{...WSH,uFlow:{value:FLOW0},uFlowOn:{value:0},uSim:{value:tex},uSimN:{value:1},uSimDx:{value:1},uSimO:{value:new THREE.Vector2(0,0)}},vertexShader:WVS,fragmentShader:WFS});
 return riverMat;
}
function buildRiverWater(ch){
 const ox=ch.cx*CS,oz=ch.cz*CS,hv=ch.hv,V=CS+1,pos=[],dpa=[],idx=[],vid=new Int32Array(V*V).fill(-1),vwl=new Float32Array(V*V);
 const vert=(x,z)=>{const k=z*V+x;if(vid[k]>=0)return vid[k];const r=riverInfo(ox+x,oz+z);let wl;
  if(r)wl=riverPathAt(ox+x,oz+z,r.cfg,r.channelOffset).wl;else wl=-1e3;
  const id=pos.length/3;pos.push(x,wl,z);dpa.push(Math.min(RIVER_DP_CAP,wl-hv[(z+1)*HP+x+1])) /*prof. limitada: rio mais claro, peixes aparecem*/;vid[k]=id;return id};
 for(let z=0;z<CS;z++)for(let x=0;x<CS;x++){
  const wx=ox+x+.5,wz=oz+z+.5,r=riverInfo(wx,wz);
  if(!r||r.strength<=.2||r.dist>r.width+r.bank)continue;
  const lake=lakeInfo(wx,wz);if(lake&&lake.t<1.28)continue;
  const a=vert(x,z),b=vert(x+1,z),c=vert(x,z+1),d=vert(x+1,z+1);
  const m=Math.max(dpa[a],dpa[b],dpa[c],dpa[d]);if(m<-.05)continue;
  if(Math.min(pos[a*3+1],pos[b*3+1],pos[c*3+1],pos[d*3+1])<-100)continue;   // vértice fora de qualquer rio
  idx.push(a,c,b,b,c,d);
 }
 if(!idx.length)return null;
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('dp',new THREE.Float32BufferAttribute(dpa,1));g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx),1));g.computeBoundingSphere();g.boundingSphere.radius+=.6;
 const m=new THREE.Mesh(g,getRiverMat());m.position.set(ox,0,oz);m.castShadow=m.receiveShadow=false;m.renderOrder=3;m.matrixAutoUpdate=false;m.updateMatrix();scene.add(m);return m;
}
function buildWater(ch){
 const ox=ch.cx*CS,oz=ch.cz*CS,ls=lakesNear(ox+CS/2,oz+CS/2),hv=ch.hv,V=CS+1,out=[];
 for(const L of ls){const pos=[],dpa=[],idx=[];
  for(let z=0;z<V;z++)for(let x=0;x<V;x++){pos.push(x,L.wl,z);dpa.push(L.wl-hv[(z+1)*HP+x+1])}
  for(let z=0;z<CS;z++)for(let x=0;x<CS;x++){const a=z*V+x,m=Math.max(dpa[a],dpa[a+1],dpa[a+V],dpa[a+V+1]);
   if(m<-.05||lakeT(L,ox+x+.5,oz+z+.5)>1.3)continue;idx.push(a,a+V,a+1,a+1,a+V,a+V+1)}
  if(!idx.length)continue;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('dp',new THREE.Float32BufferAttribute(dpa,1));g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx),1));g.computeBoundingSphere();g.boundingSphere.radius+=.6;
  const m=new THREE.Mesh(g,getSim(L).mat);m.position.set(ox,0,oz);m.castShadow=m.receiveShadow=false;m.renderOrder=3;m.matrixAutoUpdate=false;m.updateMatrix();scene.add(m);out.push(m)}
 const river=buildRiverWater(ch);if(river)out.push(river);
 return out.length?out:null;
}
/* O chão é uma superfície contínua; o grid de voxels (d) guarda só os blocos que o jogador coloca (nulo até existir algum). */
function gen(cx,cz,hv0){const hv=hv0||hvBuild(cx,cz);let d=null;const e=world.edits[cx+','+cz];if(e){d=new Uint8Array(CS*H*CS);for(const i in e)d[i]=e[i]}const props=genProps(cx,cz,hv);return{d,hv,cx,cz,props}}
function chunk(cx,cz){const k=ck(cx,cz);let c=world.chunks.get(k);if(!c){c=gen(cx,cz);world.chunks.set(k,c)}return c}
function getB(x,y,z){if(y<0||y>=H)return 0;const d=chunk(x>>4,z>>4).d;return d?d[(y*CS+(z&15))*CS+(x&15)]:0}
function groundH(x,z){if(CAMB)return cambGround(x,z,MAPY);const cx=Math.floor(x/CS),cz=Math.floor(z/CS);return hvAt(chunk(cx,cz).hv,x-cx*CS,z-cz*CS)}
function sup(x,z){const r=.3;let g=groundH(x,z),a=groundH(x-r,z);if(a>g)g=a;a=groundH(x+r,z);if(a>g)g=a;a=groundH(x,z-r);if(a>g)g=a;a=groundH(x,z+r);return a>g?a:g}
let mpApplying=false;
function setB(x,y,z,id){if(y<0||y>=H)return;const cx=x>>4,cz=z>>4,lx=x&15,lz=z&15,i=(y*CS+lz)*CS+lx;const ch0=chunk(cx,cz);if(!ch0.d)ch0.d=new Uint8Array(CS*H*CS);ch0.d[i]=id;const k=cx+','+cz;(world.edits[k]||(world.edits[k]={}))[i]=id;const rb=(a,b)=>{if(world.meshes.has(ck(a,b)))meshChunk(a,b)};rb(cx,cz);if(lx===0)rb(cx-1,cz);if(lx===15)rb(cx+1,cz);if(lz===0)rb(cx,cz-1);if(lz===15)rb(cx,cz+1);if(!mpApplying&&OWM.multiplayer)OWM.multiplayer.localEdit({kind:'block',x,y,z,id})}

const FACES=[{d:[1,0,0],s:.88,c:[[1,1,1],[1,1,0],[1,0,1],[1,0,0]]},{d:[-1,0,0],s:.88,c:[[0,1,0],[0,1,1],[0,0,0],[0,0,1]]},{d:[0,1,0],s:1,c:[[0,1,0],[1,1,0],[0,1,1],[1,1,1]]},{d:[0,-1,0],s:.7,c:[[0,0,1],[1,0,1],[0,0,0],[1,0,0]]},{d:[0,0,1],s:.94,c:[[0,1,1],[1,1,1],[0,0,1],[1,0,1]]},{d:[0,0,-1],s:.94,c:[[1,1,0],[0,1,0],[1,0,0],[0,0,0]]}];
/* ---------- Montagem de chunks em etapas ----------
   Antes cada chunk novo era montado inteiro num quadro só (relevo + props + árvores = vários ms, vários por segundo andando) e isso era a "trava do panorama".
   Agora chunkJob é um gerador: cada yield é um ponto de pausa. stream() avança as etapas só enquanto houver orçamento de tempo no quadro.
   As malhas novas ficam invisíveis até o fim (commitJob) e só então trocam as antigas; o jogo nunca vê um chunk pela metade. */
function blockMesh(ch){const cx=ch.cx,cz=ch.cz,d=ch.d,ox=cx*CS,oz=cz*CS,pos=[],nor=[],uv=[],col=[],idx=[];for(let y=0;d&&y<H;y++)for(let z=0;z<CS;z++)for(let x=0;x<CS;x++){const b=d[(y*CS+z)*CS+x];if(!b)continue;const bl=BL[b];for(let f=0;f<6;f++){const F=FACES[f],dd=F.d,nx=x+dd[0],ny=y+dd[1],nz=z+dd[2];let nb;if(ny<0)continue;if(ny>=H)nb=0;else if(nx>=0&&nx<CS&&nz>=0&&nz<CS)nb=d[(ny*CS+nz)*CS+nx];else nb=getB(ox+nx,ny,oz+nz);if(nb)continue;const t=f===2?bl.t:f===3?bl.b:bl.s,u0=t/NT+.001,u1=(t+1)/NT-.001,base=pos.length/3;for(let q=0;q<4;q++){const c=F.c[q];pos.push(x+c[0],y+c[1],z+c[2]);nor.push(dd[0],dd[1],dd[2]);col.push(F.s,F.s,F.s);uv.push(q%2?u1:u0,q<2?1:0)}idx.push(base,base+2,base+1,base+1,base+2,base+3)}}let m=null;if(idx.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(nor),3));g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(uv),2));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(col),3));g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx),1));m=new THREE.Mesh(g,chunkMat);m.position.set(ox,0,oz);m.castShadow=m.receiveShadow=true;m.matrixAutoUpdate=false;m.updateMatrix();scene.add(m)}return m}
const hideParts=p=>{const h=o=>{if(o)o.visible=false};h(p.m);h(p.pm);h(p.bm);h(p.lm);h(p.tm);if(p.sm)p.sm.forEach(h);if(p.wm)p.wm.forEach(h)};
const showParts=p=>{const h=o=>{if(o)o.visible=true};h(p.m);h(p.pm);h(p.bm);h(p.lm);h(p.tm);if(p.sm)p.sm.forEach(h);if(p.wm)p.wm.forEach(h)};
function* chunkJob(cx,cz,part){
 const k=ck(cx,cz);let ch=world.chunks.get(k);
 if(!ch){const hv=hvBuild(cx,cz);yield;ch=gen(cx,cz,hv);world.chunks.set(k,ch);yield}
 part.m=ch.d?blockMesh(ch):null;hideParts(part);yield;
 const pp=buildProps(ch);part.pm=pp.pm;part.bm=pp.bm;part.lm=pp.lm;part.sm=pp.sm;part.tier=pp.tier;hideParts(part);yield;
 part.tm=buildTerrain(ch);hideParts(part);yield;
 part.wm=buildWater(ch);hideParts(part);
}
let curJob=null;
function cancelJob(){const j=curJob;if(!j)return;curJob=null;dropMesh(j.part);if(!world.meshes.has(j.k))world.col.delete(j.k)}
function startJob(cx,cz,d2){const k=ck(cx,cz),part={cx,cz,m:null,pm:null,bm:null,lm:null,sm:null,tm:null,wm:null,tier:0};curJob={k,cx,cz,d2,part,g:chunkJob(cx,cz,part)}}
function commitJob(j){const old=world.meshes.get(j.k);if(old)dropMesh(old);showParts(j.part);world.meshes.set(j.k,j.part);curJob=null}
/* versão síncrona (editar bloco, quebrar prop, trocar textura HD): cancela o trabalho em andamento desse chunk e monta tudo agora */
function meshChunk(cx,cz){const k=ck(cx,cz);if(curJob&&curJob.k===k)cancelJob();const old=world.meshes.get(k);if(old)dropMesh(old);world.col.delete(k);const part={cx,cz,m:null,pm:null,bm:null,lm:null,sm:null,tm:null,wm:null,tier:0},g=chunkJob(cx,cz,part);while(!g.next().done);showParts(part);world.meshes.set(k,part)}
function clearWorld(){CHC.clear();CHD.clear();mtnClear();cancelJob();for(const v of world.meshes.values())dropMesh(v);world.meshes.clear();world.chunks.clear();world.col.clear()}
function initWorld(w){CAMB=false;strReset();cambShow(false);LOBBY=w.biome==='lobby';PLATE=w.biome==='testplate'||LOBBY;lobbyShow(LOBBY);lobbyUI(LOBBY);if((!PLATE||LOBBY)&&plateGM)plateGM.visible=false;clearWorld();clearLeafDropMeshes();clearAppleDropMeshes();clearTableMeshes();clearFish();world.seed=w.seed;world.edits=w.edits;NZ=mkNoise(w.seed);H0=null;lakeCache.clear();lakeGeomCache.clear();desertLakeRegions.clear();riverAxisSeed=null;riverLaneCache.clear();for(const q of sims.values()){q.tex.dispose();q.mat.dispose()}sims.clear()}
const OFF=[];for(let a=-30;a<=30;a++)for(let b=-30;b<=30;b++)OFF.push([a,b,a*a+b*b]);OFF.sort((p,q)=>p[2]-q[2]);
function stream(pcx,pcz,rad,lim){
 plateGround(P.p.x,P.p.z);
 if(!PLATE)mtnUpdate(P.p.x,P.p.z,rad*CS);
 let dd=99; const t0=performance.now(),r2=rad*rad+1,u=(rad+2)*(rad+2),base=(state!=='play'?9:touch?2.5:6)*(state==='play'&&post.targetFps?Math.min(1,60/post.targetFps()):1);   // ms por quadro; menu/pausa podem gastar mais
 if(curJob&&(curJob.cx-pcx)**2+(curJob.cz-pcz)**2>u)cancelJob();
 for(;;){
  if(!curJob){
   let cx=0,cz=0,d2=0,found=false;
   for(const o of OFF){if(o[2]>r2)break;cx=pcx+o[0];cz=pcz+o[1];if(!world.meshes.has(ck(cx,cz))){found=true;d2=o[2];break}}
   if(!found){   // nada faltando: refaz (em etapas) um chunk cuja árvore precisa trocar de nível de detalhe
    for(const v of world.meshes.values()){if((v.cx-pcx)**2+(v.cz-pcz)**2<=r2&&v.tier!==treeTier(v.cx,v.cz,v.tier)){cx=v.cx;cz=v.cz;d2=99;found=true;break}}
   }
   if(!found)break;
   startJob(cx,cz,d2);dd=d2;
  }
  if(curJob.g.next().done)commitJob(curJob);
  if(performance.now()-t0>base*(dd<=8?2.5:1))break;   // chão sob os pés tem prioridade: orçamento maior
 }
 for(const[k,v]of world.meshes){if((v.cx-pcx)**2+(v.cz-pcz)**2>u){dropMesh(v);world.col.delete(k);world.meshes.delete(k)}}
}


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
   if(s.mode!==(S.wFluid?1:0)){s.mode=S.wFluid?1:0;s.v.fill(0);s.qx.fill(0);s.qz.fill(0)}
   for(let i=0;i<steps;i++)S.wFluid?simStepFluid(s):simStep(s);simPack(s)}
  else if(s.on){s.on=false;s.h.fill(0);s.v.fill(0);s.qx.fill(0);s.qz.fill(0);simPack(s)}
 }
 updateRiverSim(dt,steps,!!S.wFluid);
}
/* Jogador mexe na água: respingo ao entrar (proporcional à velocidade de queda) e esteira enquanto se move */
function playerWake(dt){
 const x=P.p.x,z=P.p.z;let sm=null,wl=0;const k=lakeInfo(x,z);
 if(k&&k.t<=1.3&&groundH(x,z)<k.wl){const ls=sims.get(lakeKey(k.L));if(ls&&ls.on){sm=ls;wl=k.wl}}
 if(!sm&&RW.live&&RW.s&&RW.nWet>0&&(S.wRiver||S.wFluid)){const r=riverWaterAt(x,z);if(r){sm=RW.s;wl=r.wl}}   // rios usam a mesma esteira dos lagos
 const wd=sm?wl-P.p.y:-1,inW=!!sm&&wd>.05;
 if(inW){const spd=Math.hypot(P.vel.x,P.vel.z);
  if(!pw.in)simDrop(sm,x,z,1.3,-cl(.07+Math.abs(Math.min(0,pw.vy))*.045+spd*.02,.08,.5));
  else if(spd>.3||Math.abs(P.vel.y)>.5)simDrop(sm,x-P.vel.x*.05,z-P.vel.z*.05,.9,-cl((spd*.22+Math.abs(P.vel.y)*.1)*cl(wd,0,1)*dt,0,.06));
  if(S.wFluid&&spd>.25)simPush(sm,x,z,1.0,P.vel.x,P.vel.z,dt)}   // fluido 2D: o corpo empurra a água
 else pw.vy=P.vel.y;
 pw.in=inW;
}
function updateWater(dt){
 updateSims(dt);wTime+=dt;const lin=!!(post.bloomActive&&post.bloomActive()),sl=post.sunLight,su=post.skyDome.material.uniforms;
 WU.uTime.value=wTime;updWind(wTime);WU.uCam.value.copy(cam.position);WU.uLin.value=lin?1:0;
 WU.uSun.value.copy(post.sunOff).normalize();WU.uSunC.value.copy(sl.color);WU.uDay.value=cl(sl.intensity/1.1,.06,1);
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
const SURV=window.OWMSurvival,MAXHUNGER=SURV.MAX,MAXTHIRST=SURV.MAX;
const P={p:new THREE.Vector3(),vel:new THREE.Vector3(),yaw:0,pitch:0,og:false,hp:MAXHP,st:MAXST,hunger:MAXHUNGER,thirst:MAXTHIRST,hungerZeroT:0,thirstZeroT:0,thirstDrainDuration:240,peak:0,hpT:0,landV:0};
function activeArchetypeMods(){const a=OWM.archetypes&&OWM.archetypes.get?OWM.archetypes.get(cur&&cur.archetype):null;return a&&a.mods||{}}
function archetypeMul(key){const v=Number(activeArchetypeMods()[key]);return Number.isFinite(v)&&v>0?v:1}
let sprintTog=false,stLock=false,stIdle=0,stVis=0,isSprint=false;
let spawn=[.5,30,.5],cur=null,state='menu',tp3=!!S.shiftLock||S.camMode===1,breaking=false,mining=false,swT=0,prog=0,tgtKey='',hit=null,phit=null,bobT=0,jumpHeld=false,saveT=0;
// Presença usada pelo sistema de amigos: só informa o nome do mundo durante uma sessão ativa.
OWM.getAccountPresence=()=>{
 const active=!!cur&&(state==='loading'||state==='play'||state==='pause');
 const worldName=active&&typeof cur.name==='string'?cur.name.trim().slice(0,32):'';
 return active&&worldName?{status:'playing',worldName}:{status:'online'};
};
const LK={s:null,R:28,BREAK:42,sw:0,swT:0,mk:null,tex:null,btn:null};   // LOCK-ON: s = criatura travada; R = alcance pra travar; BREAK = distância em que o lock solta; sw = acumulado do arrasto (troca de alvo)
const keys={},joy={x:0,y:0};let rmbDown=false,rmbT=0,rmbMoved=0;
function syncShiftLockButton(){
 const b=$('#bShiftLock');if(!b)return;
 const on=!!S.shiftLock;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));
 b.title=on?'Shift Lock ativo — sem mira visível':'Shift Lock invisível (C)';
}
function setShiftLock(on){
 S.shiftLock=on?1:0;tp3=!!S.shiftLock||S.camMode===1;
 syncShiftLockButton();st('bc.s',S);
 if(on&&!touch&&state==='play'&&!document.pointerLockElement)lock(true);
 else if(!on&&!S.lockMouse&&!touch&&document.pointerLockElement&&document.exitPointerLock)document.exitPointerLock();
}
const shiftLockBtn=$('#bShiftLock');
if(shiftLockBtn)shiftLockBtn.addEventListener('click',()=>setShiftLock(!S.shiftLock));
syncShiftLockButton();
/* ---------- Dash (Q / botão móvel) ---------- */
/* ---------- JETPACK: configuração (tudo ajustável) ---------- */
const JP={PRICE:170,FUEL:100,DRAIN:28,REGEN_GROUND:40,REGEN_AIR:8,UP_V:7.5,UP_ACC:6,AIR_CTRL:10,JUMP_MUL:1.35,DASH_SPEED:22,DASH_LIFT:2.5,STOMP_MIN_FALL:2.5,STOMP_R:5.5,STOMP_DMG_BASE:12,STOMP_DMG_PER_M:3,STOMP_DMG_MAX:45,owned:false,fuel:100,locked:false,fly:false,PERSIST:false,
 H:.7,BACK:.25,UP:1.15,ROTY:0,FLAME:22};   // extras: H = altura do modelo (m) · BACK/UP = posição nas costas (m) · ROTY = giro extra do modelo (rad) · FLAME = partículas/s por bocal
const DASH={DURATION:.308,SPEED:15.5*1.1,COOLDOWN:6,TRAIL_STEP:.035}; // duração +40%: aumenta a distância sem tornar o dash mais brusco
const dashBtn=$('#bDash'),dashCdEl=$('#dash-cd'),dashFlashEl=$('#dash-flash');
/* Movimento mais solto (estilo jogos de Roblox, mas equilibrado): pulo com "coyote time" (pula até .12 s depois de sair da beirada), pulo "bufferizado"
   (aperte um pouco antes de pousar), pulo de altura variável (solte cedo = pulo baixo), controle moderado no ar, queda mais rápida que a subida. Sem pulo duplo. */
const JUMP_V=8.8*Math.sqrt(1.3),   // pulo +30% mais alto
  GUP=25,GDN=34,COYOTE=.12,JBUF=.14;let coyoteT=0,jumpBufT=0,jumpPrev=false;
let dashHold=false,dashHoldT=0,dashRunOn=false,dashRunWas=false,stDashT=0,stDashHi=false;   // segurar dash correndo
let dashT=0,dashCooldown=0,dashReadyAt=0,dashPauseAt=0,dashDirX=0,dashDirZ=-1,dashTrailAcc=0,dashScreenT=0,dashCdShown=-1;
const dashFX=[];
function updateDashHUD(){
 // Relógio monotônico: o cooldown conta segundos reais e não depende do FPS.
 dashCooldown=dashReadyAt>0?Math.max(0,(dashReadyAt-performance.now())/1000):0;
 if(dashCooldown<=0){dashCooldown=0;dashReadyAt=0}
 const sec=Math.ceil(dashCooldown-1e-4);
 if(sec!==dashCdShown){dashCdShown=sec;dashCdEl.textContent=dashCooldown>0?'CD '+Math.max(1,sec):''}
 dashBtn.classList.toggle('cooldown',dashCooldown>0);
 dashBtn.setAttribute('aria-disabled',dashCooldown>0?'true':'false');
}
function useDash(){
 updateDashHUD();
 if(state!=='play'||COIL.on||dashCooldown>0)return false;
 let mx=(keys.KeyD?1:0)-(keys.KeyA?1:0)+joy.x;
 let mz=(keys.KeyS?1:0)-(keys.KeyW?1:0)+joy.y;
 let len=Math.hypot(mx,mz);
 if(len>.12){mx/=len;mz/=len;const c=Math.cos(P.yaw),s=Math.sin(P.yaw);dashDirX=c*mx+s*mz;dashDirZ=-s*mx+c*mz}
 else{dashDirX=-Math.sin(P.yaw);dashDirZ=-Math.cos(P.yaw)}
 if(JP.owned){dashDirX=-Math.sin(P.yaw);dashDirZ=-Math.cos(P.yaw)}   // jetpack: avanço SEMPRE pra frente do jogador, ignora o input
 len=Math.hypot(dashDirX,dashDirZ)||1;dashDirX/=len;dashDirZ/=len;
 const dsp=JP.owned?JP.DASH_SPEED:DASH.SPEED;
 dashT=DASH.DURATION;dashReadyAt=performance.now()+DASH.COOLDOWN*1000;dashCooldown=DASH.COOLDOWN;dashTrailAcc=0;dashScreenT=.24;if(JP.owned)jpDashBurst();else spawnDashBurst();
 P.vel.x=dashDirX*dsp*archetypeMul('moveSpeed');P.vel.z=dashDirZ*dsp*archetypeMul('moveSpeed');if(JP.owned)P.vel.y=Math.max(P.vel.y,JP.DASH_LIFT);
 dashFlashEl.style.opacity='.58';addTrauma(.035);updateDashHUD();return true;
}
function spawnDashTrail(){
 /* dash estilo Roblox: sprites (clarão + estrelas + poeira + anel) atrás do jogador, no mesmo sistema RBX dos golpes LMB/M1/M2.
    Cada passo do rastro solta um clarão atrás do corpo, estrelas que ficam no ar e um pouco de poeira no chão. */
 const bx=-dashDirX,bz=-dashDirZ,px=-dashDirZ,pz=dashDirX,pal=RPAL.dash;
 const o={x:P.p.x,y:P.p.y+.9,z:P.p.z};
 rbxAdd('glow',pal.core,o.x+bx*.35,o.y,o.z+bz*.35,bx*1.2,0,bz*1.2,.2,1.1,{peak:.3,drag:3});
 for(let i=0;i<3;i++){
  const side=R4()*.4,back=.2+Math.random()*.9,y=P.p.y+.25+Math.random()*1.4;
  rbxAdd('star',pal.st[i%pal.st.length],P.p.x+px*side+bx*back,y,P.p.z+pz*side+bz*back,bx*(1.5+Math.random()*2.2)+px*R4()*.8,R4()*.5,bz*(1.5+Math.random()*2.2)+pz*R4()*.8,.26+Math.random()*.2,.2+Math.random()*.2,{drag:3.4,spin:R4()*9});
 }
 for(let i=0;i<2;i++)rbxAdd('glow',pal.st[(i+1)%pal.st.length],P.p.x+px*R4()*.3+bx*.3,P.p.y+.2+Math.random()*1.2,P.p.z+pz*R4()*.3+bz*.3,bx*Math.random()*2+px*R4()*.6,Math.random()*.7,bz*Math.random()*2+pz*R4()*.6,.3+Math.random()*.2,.26,{drag:3});
 rbxDust({x:P.p.x+bx*.3,y:P.p.y+.15,z:P.p.z+bz*.3},1,0xb9b2a2);
}
/* estouro de partida do dash: anel de choque + estrelas em leque pra trás (chamado uma vez por dash) */
function spawnDashBurst(){
 const bx=-dashDirX,bz=-dashDirZ,px=-dashDirZ,pz=dashDirX,pal=RPAL.dash,y=P.p.y+.9;
 rbxAdd('ring',pal.ring,P.p.x,P.p.y+.2,P.p.z,0,0,0,.3,2.2,{ring:1});
 if(tp3){rbxAdd('glow',pal.core,P.p.x,y,P.p.z,0,0,0,.18,1.6,{peak:.3});rbxAdd('star',pal.core,P.p.x,y,P.p.z,0,0,0,.2,1.3,{spin:5,peak:.3})}   // na 1ª pessoa não pisca na frente da câmera
 for(let i=0;i<10;i++){const sp=3+Math.random()*3.5,l=R4()*.9;rbxAdd('star',pal.st[i%pal.st.length],P.p.x,P.p.y+.3+Math.random()*1.3,P.p.z,(bx+px*l)*sp,Math.random()*1.2,(bz+pz*l)*sp,.3+Math.random()*.25,.22+Math.random()*.16,{g:3,drag:3.2,spin:R4()*9})}
 rbxDust({x:P.p.x,y:P.p.y+.1,z:P.p.z},4,0xb9b2a2);
}
function updateDashFX(dt){
 if(dashScreenT>0){dashScreenT=Math.max(0,dashScreenT-dt);dashFlashEl.style.opacity=String(.58*(dashScreenT/.24))}else dashFlashEl.style.opacity='0';
 for(let i=dashFX.length-1;i>=0;i--){const f=dashFX[i];f.life-=dt;f.mat.opacity=.8*Math.max(0,f.life/f.max);if(f.life<=0){scene.remove(f.lines);f.geo.dispose();f.mat.dispose();dashFX.splice(i,1)}}
}

/* ---------- HUD ---------- */
const hud=$('#hud');
const healthFill=$('#health-fill'),healthText=$('#health-text');
function refreshHealth(){const pct=Math.max(0,P.hp)/MAXHP*100;healthFill.style.width=pct+'%';healthFill.classList.toggle('low',pct<=50&&pct>25);healthFill.classList.toggle('critical',pct<=25);healthText.textContent=Math.max(0,Math.ceil(P.hp))+' / '+MAXHP;}
const hungerFill=$('#hunger-fill'),thirstFill=$('#thirst-fill'),hungerBar=$('#hunger-bar'),thirstBar=$('#thirst-bar');
function refreshSurvivalHUD(){const h=Math.max(0,Math.min(MAXHUNGER,P.hunger)),t=Math.max(0,Math.min(MAXTHIRST,P.thirst));hungerFill.style.width=(h/MAXHUNGER*100)+'%';thirstFill.style.width=(t/MAXTHIRST*100)+'%';hungerBar.setAttribute('aria-valuenow',String(Math.round(h)));thirstBar.setAttribute('aria-valuenow',String(Math.round(t)));hungerBar.classList.toggle('empty',h<=0);thirstBar.classList.toggle('empty',t<=0)}
function updateSurvival(dt,swim){
 if(PLATE){P.hunger=MAXHUNGER;P.thirst=MAXTHIRST;P.hungerZeroT=P.thirstZeroT=0;return}   // Test plate: sem fome nem sede
 P.hunger=SURV.drain(P.hunger,dt,SURV.HUNGER_SECONDS/Math.max(.05,archetypeMul('hungerDrain')));
 P.thirst=swim?SURV.recover(P.thirst,dt,SURV.SWIM_RECOVERY_PER_SECOND):SURV.drain(P.thirst,dt,P.thirstDrainDuration/Math.max(.05,archetypeMul('thirstDrain')));
 if(P.hunger<=0){const q=SURV.periodicTicks(P.hungerZeroT,dt,SURV.DAMAGE_INTERVAL_SECONDS);P.hungerZeroT=q.remainder;for(let i=0;i<q.count;i++)if(SURV.hungerDamageRoll(Math.random())){const hp=P.hp;hurt(SURV.DAMAGE_AMOUNT,true);if(P.hp<hp)toast('A fome extrema causou dano!')}}else P.hungerZeroT=0;
 if(P.thirst<=0){const q=SURV.periodicTicks(P.thirstZeroT,dt,SURV.DAMAGE_INTERVAL_SECONDS);P.thirstZeroT=q.remainder;for(let i=0;i<q.count;i++){const hp=P.hp;hurt(SURV.DAMAGE_AMOUNT,true);if(P.hp<hp)toast('A desidratação causou dano!')}}else P.thirstZeroT=0;
 refreshSurvivalHUD();
}
const stFill=$('#stamina-fill'),stBar=$('#stamina-bar'),stText=$('#stamina-text'),bSprint=$('#bSprint');let stShown=-1;
function updateStamina(run,dt){stVis=run?1.5:Math.max(0,stVis-dt);stFill.style.width=(P.st/MAXST*100)+'%';const sv=Math.ceil(P.st);if(sv!==stShown){stShown=sv;stText.textContent=sv+' / '+MAXST}stBar.classList.toggle('show',stVis>0);bSprint.classList.toggle('on',run)}

const hudShow=v=>hud.classList.toggle('hidden',!v);

/* ---------- Animação customizada ---------- */
let playingAnim=null,animTime=0;
function playAnimByIndex(i){const anims=ld('bc.anims',[]);if(!anims[i]){toast('Nenhuma animação no slot F'+(i+1));return}playingAnim=anims[i];animTime=0;toast('▶ '+anims[i].name);}

/* ---------- Configurações ---------- */
function applyAll(){
 const uiPixel=Math.max(0,Math.min(100,Number(S.uiPixel)||0)),uiPixelStrength=uiPixel/100,uiRoot=document.documentElement;uiRoot.style.setProperty('--ui-pixel-strength',uiPixelStrength.toFixed(2));uiRoot.style.setProperty('--ui-pixel-cell',(2+uiPixelStrength*6)+'px');uiRoot.style.setProperty('--ui-pixel-tint',(uiPixelStrength*.14).toFixed(3));uiRoot.style.setProperty('--ui-pixel-radius',(8*(1-uiPixelStrength))+'px');uiRoot.style.setProperty('--ui-pixel-border',(2+uiPixelStrength*2)+'px');uiRoot.style.setProperty('--ui-pixel-shadow',(2+uiPixelStrength*4)+'px');document.body.classList.toggle('ui-pixelated',uiPixel>0);const uiVhs=Math.max(0,Math.min(100,Number(S.uiVhs)||0)),uiVhsStrength=uiVhs/100;uiRoot.style.setProperty('--ui-vhs-strength',uiVhsStrength.toFixed(2));uiRoot.style.setProperty('--ui-vhs-scan',(1+uiVhsStrength*3)+'px');document.body.classList.toggle('ui-vhs',uiVhs>0);const uiCrt=Math.max(0,Math.min(100,Number(S.uiCrt)||0)),uiCrtStrength=uiCrt/100;uiRoot.style.setProperty('--ui-crt-strength',uiCrtStrength.toFixed(2));uiRoot.style.setProperty('--ui-crt-scan',(2+uiCrtStrength*3)+'px');document.body.classList.toggle('ui-crt',uiCrt>0);document.body.classList.toggle('ui-square-buttons',Number(S.uiSquare)===1);
 cam.fov=S.fov;
 if(anim.setQuality)anim.setQuality(2,true);   // sem opções de otimização do personagem: sempre qualidade máxima e física ligada
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
const SS=mkScreen('settings','Configurações'),sg=E('div','grid settings-grid',null,SS),vg=E('div','grid visual-grid hidden',null,SS);
function slider(label,key,min,max,parent=sg){const d=E('div','btn sl',null,parent),i=E('i','',null,d),sp=E('span','',null,d),inp=E('input','',null,d);d.style.textAlign='center';inp.type='range';inp.min=min;inp.max=max;inp.value=S[key];const upd=()=>{sp.textContent=label+': '+S[key];d.style.setProperty('--p',(S[key]-min)/(max-min))};upd();inp.oninput=()=>{S[key]=+inp.value;upd();st('bc.s',S);applyAll()}}
function cycle(label,key,names,parent=sg){const b=B('',()=>{S[key]=(S[key]+1)%names.length;upd();st('bc.s',S);applyAll()},parent),upd=()=>b.textContent=label+': '+names[S[key]];upd()}
const OF=['Não','Sim'];OWM.applyAll=applyAll;
/* Configurações gerais: controles e áudio. */
slider('Sensibilidade','sens',20,200);slider('Volume da música','mvol',0,100);
cycle('Inverter eixo Y','invert',OF);cycle('Travar mouse (lock on)','lockMouse',OF);
/* Visuais: qualquer opção que altera câmera, imagem, iluminação, renderização ou HUD. */
B('✨ Shaders (editor visual)…',()=>OWM.shaders&&OWM.shaders.open(),vg);slider('Campo de visão','fov',50,110,vg);slider('Distância (chunks)','dist',2,30,vg);slider('Brilho','bright',0,100,vg);cycle('Aplicar efeitos em','fxScope',['Só UI','UI + jogo'],vg);slider('Pixelização','uiPixel',0,100,vg);slider('Efeito VHS (UI + jogo)','uiVhs',0,100,vg);slider('Efeito CRT (UI + jogo)','uiCrt',0,100,vg);cycle('Formato dos botões','uiSquare',['Arredondados','Quadrados'],vg);
cycle('Sombras','shadow',['Desligadas','Médias','Altas'],vg);
cycle('Tone mapping','tone',['Nenhum','Linear','Reinhard','Cineon','ACES'],vg);
cycle('Texturas HD','hdTex',OF,vg);cycle('Física do cabelo','hairPhys',OF,vg);cycle('Física da roupa','cloth',OF,vg);
cycle('Ondas nos rios','wRiver',['Desligadas','Ligadas'],vg);cycle('Correnteza dos rios','wFlow',['Desligada','Ligada'],vg);cycle('Fluido 2D (ondas empurradas)','wFluid',['Desligado','Ligado'],vg);
cycle('Bloom','bloom',OF,vg);cycle('Névoa volumétrica','vfog',['Desligada','Normal','Alta'],vg);cycle('Tempestade de areia','sand',['Desligada','Ligada'],vg);cycle('Fundo da tela inicial','titleBg',['Panorama','Tempestade de areia'],vg);if(S.jpPlate===undefined)S.jpPlate=0;cycle('Jetpack no Baseplate','jpPlate',['Desligado','Ligado'],vg);
cycle('Resolução','rq',['Baixa (480p)','550p','640p','Padrão (740p)','Alta (1080p)','Automática (pelo aparelho)'],vg);cycle('Detalhe das árvores','tq',['Alto','Médio','Leve'],vg);cycle('Detalhe das cerejeiras','chq',['Alto','Médio','Leve'],vg);cycle('Resolução dinâmica','dyn',OF,vg);cycle('Taxa de quadros alvo','hz',['Automática','60 Hz','90 Hz','120 Hz'],vg);cycle('Suavização de bordas (FXAA)','aa',OF,vg);cycle('Texto "Coletar"','collect',['Invisível','Visível'],vg);cycle('Mostrar FPS','fps',OF,vg);cycle('Balanço da câmera','bob',OF,vg);cycle('Vinheta','vig',OF,vg);cycle('Câmera','camMode',['1ª pessoa','3ª pessoa'],vg);cycle('Modo Shift Lock','shiftStyle',['Atual','Roblox','Travado (corpo fixo pra frente)'],vg);
E('div','dsc fx-note','Escolha se Pixelização, VHS e CRT aparecem apenas na interface ou também no mundo 3D e no panorama.',vg);
E('div','dsc np','Chill Synthwave - Digital Sunset — Karl Casey @ White Bat Audio',SS);
E('div','dsc np','Jetpack — Elite Big Speakerman (Sketchfab, CC-BY-4.0)',SS);
const srow=E('div','srow',null,SS);
B('Restaurar padrão',()=>{Object.assign(S,DEF);st('bc.s',S);applyAll();location.reload()},srow);
let animStudioPrev='menu',animEditorFromHub=false,animStudioFromHub=false;
OWM.animstudio.onClose=()=>{state=animStudioPrev;if(animStudioFromHub){mainHub.classList.remove('hidden');OWM.showMainHubScreen('anims')}else go(setBack||'settings');animStudioFromHub=false};
const openSettings=b=>{setBack=b||'title';OWM.openMainHub('settings',setBack)};

/* ---------- Mundos ---------- */
let WL=ld('bc.w2',[]),selW=null;
const SPL=['Agora com blocos!','Quebre tudo!','Mundo infinito*','Feito para caos','Construa alto!','100% pixelado'];
const TS=mkScreen('title',null,'title');
E('div','blob blob-1',null,TS);E('div','blob blob-2',null,TS);E('div','blob blob-3',null,TS);
const lw=E('div','lw',null,TS),lg=E('div','logo-image-wrap',null,lw),logoImg=E('img','title-logo-img',null,lg);logoImg.src='title-logo.png';logoImg.alt='OPEN WORLD MAYHEM';logoImg.draggable=false;
E('div','ed','EDIÇÃO BLOCOS',lw);E('div','splash',SPL[Math.random()*SPL.length|0],lw);
B('Jogar',()=>go('mode'),TS);B('Mais',()=>OWM.openMainHub('friends','title'),TS).classList.add('title-more-btn');E('div','dsc np','The Show Must Go On — Toilet Takeover OST',TS);
const ft=E('div','foot',null,TS);E('span','','Open World Mayhem',ft);E('span','',touch?'Toque para jogar':'WASD • Espaço • F1-F4',ft);

const WS=mkScreen('worlds','Mundos'),wlist=E('div','list',null,WS),wrow=E('div','row',null,WS);
const bPlay=B('Jogar mundo',()=>{const w=WL.find(x=>x.id===selW);if(w)startWorld(w)},wrow),bDel=B('Apagar',()=>{WL=WL.filter(x=>x.id!==selW);selW=null;st('bc.w2',WL);renderWL()},wrow);
B('Criar novo mundo',()=>{nName.value='Meu mundo '+(WL.length+1);nSeed.value='';NS.resetBiome&&NS.resetBiome();go('new')},WS);
B('Mundos multiplayer',()=>{updateMPUI();go('multiplayer')},WS);
B('Voltar',()=>go('mode'),WS);
const MPS=mkScreen('multiplayer','Mundos multiplayer'),mpCode=fld('Código do anfitrião (ex.: NOME-ABCD)',MPS),mpMyCode=E('div','dsc','Entre na sua conta para obter seu código.',MPS),mpStatus=E('div','dsc','Sessão não iniciada.',MPS);
function updateMPUI(){const a=OWM.account;mpMyCode.textContent=a&&a.loggedIn?'Seu código: '+(a.peerId||'conectando…'):'Entre na sua conta para hospedar ou entrar em um mundo.';mpStatus.textContent=OWM.multiplayer?OWM.multiplayer.statusText:'Sistema multiplayer carregando…'}
B('Abrir conta / amigos',()=>{if(OWM.account)OWM.openMainHub('friends','multiplayer')},MPS);
B('Copiar meu código',()=>{const code=OWM.account&&OWM.account.peerId;if(!code){toast('Crie ou entre em uma conta primeiro.');return}if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(code).then(()=>toast('Código copiado!')).catch(()=>toast('Código: '+code));else toast('Código: '+code)},MPS);
B('Hospedar mundo selecionado',()=>{const w=WL.find(x=>x.id===selW);if(!w){toast('Selecione um mundo na tela anterior.');return}if(!OWM.multiplayer){toast('Multiplayer ainda não carregou.');return}OWM.multiplayer.hostWorld(w).then(updateMPUI).catch(e=>{toast(e.message||'Não foi possível hospedar.');updateMPUI()})},MPS);
B('Entrar no mundo pelo código',()=>{if(!OWM.multiplayer){toast('Multiplayer ainda não carregou.');return}OWM.multiplayer.join(mpCode.value).then(updateMPUI).catch(e=>{toast(e.message||'Não foi possível entrar.');updateMPUI()})},MPS);
B('Encerrar sessão multiplayer',()=>{if(OWM.multiplayer)OWM.multiplayer.leave();updateMPUI();toast('Sessão multiplayer encerrada.')},MPS);
B('Voltar',()=>go('worlds'),MPS);
function renderWL(){wlist.textContent='';if(!WL.length)E('div','dsc','Nenhum mundo ainda. Crie um!',wlist);WL.forEach(w=>{const d=E('div','w'+(w.id===selW?' on':''),null,wlist),t=E('div','',null,d);E('p','',w.name,t);E('p','','Semente '+w.seed+({cherry:' • Cerejeiral',desert:' • Deserto',testplate:' • Baseplate',random:' • Bioma aleatório'}[w.biome]||'')+' • '+new Date(w.t).toLocaleDateString('pt-BR'),t);d.onclick=()=>{selW=w.id;renderWL()}});bPlay.disabled=bDel.disabled=selW==null}
/* ---------- LOBBY: sala "Camera Base Ep 76". Não é um mundo: não vai pra lista de mundos nem tem terreno/biomas.
   Mapa embutido em lobby-data.js. O chão da sala é plano e fica em PLATE_H (mesma física do Baseplate);
   paredes e móveis viram caixas de colisão (AABB de cada peça) e a sala é fechada por 4 paredes invisíveis no contorno do chão. ---------- */
const LB={group:null,boxes:[],promise:null};
const LOBBY_S=2.2;                         // escala base do mapa (1 = tamanho original; a sala original tem ~9,5 × 10,9 m e teto de 2,8 m)
const LOBBY_W=2;                           // largura/comprimento: 2× maior que antes
const LOBBY_H=1.5;                         // altura (pé-direito): 1,5× maior que antes
const LOBBY_SXZ=LOBBY_S*LOBBY_W,LOBBY_SY=LOBBY_S*LOBBY_H;   // escala final: X/Z = 4,4 e Y = 3,3
const LOBBY_RECT=[-5.2*LOBBY_SXZ,3.9*LOBBY_SXZ,-1.75*LOBBY_SXZ,8.45*LOBBY_SXZ];   // x0,x1,z0,z1 interno da sala (dentro das paredes)
/* Colisão exata de peças altas (arcos/pilares das paredes): em vez de uma caixa única (AABB) — que tampava o vão aberto do arco e criava uma
   PAREDE INVISÍVEL no meio da sala — a malha é "voxelizada": cada triângulo marca os cubinhos (v metros) que ele realmente toca, e os cubinhos
   são juntados em poucas caixas. Só o que existe de verdade bloqueia; o vão do arco fica livre. */
function lobbyVoxelBoxes(mesh,v){
 const geo=mesh.geometry,pos=geo&&geo.attributes&&geo.attributes.position;if(!pos)return null;
 mesh.updateMatrixWorld(true);
 const m=mesh.matrixWorld,n=pos.count,W=new Float32Array(n*3),t=new THREE.Vector3();
 for(let i=0;i<n;i++){t.fromBufferAttribute(pos,i).applyMatrix4(m);W[i*3]=t.x;W[i*3+1]=t.y;W[i*3+2]=t.z}
 const ix=geo.index,nt=ix?Math.floor(ix.count/3):Math.floor(n/3),vox=new Set();
 const enc=(a,b,c)=>((a+1024)*2048+(b+1024))*2048+(c+1024);
 const mark=(x,y,z)=>{vox.add(enc(Math.floor(x/v),Math.floor(y/v),Math.floor(z/v)))};
 for(let f=0;f<nt;f++){
  const i0=ix?ix.getX(f*3):f*3,i1=ix?ix.getX(f*3+1):f*3+1,i2=ix?ix.getX(f*3+2):f*3+2;
  const ax=W[i0*3],ay=W[i0*3+1],az=W[i0*3+2],bx=W[i1*3],by=W[i1*3+1],bz=W[i1*3+2],cx=W[i2*3],cy=W[i2*3+1],cz=W[i2*3+2];
  const L=Math.max(Math.hypot(bx-ax,by-ay,bz-az),Math.hypot(cx-ax,cy-ay,cz-az),Math.hypot(cx-bx,cy-by,cz-bz));
  const N=Math.min(160,Math.max(1,Math.ceil(L/(v*.5))));
  for(let i=0;i<=N;i++)for(let j=0;j<=N-i;j++){const u=i/N,w=j/N;mark(ax+(bx-ax)*u+(cx-ax)*w,ay+(by-ay)*u+(cy-ay)*w,az+(bz-az)*u+(cz-az)*w)}
 }
 /* preenche a espessura (z) entre as duas faces do arco: pilares e vigas ficam sólidos; o vão aberto não tem cubinhos e continua livre */
 {const g=new Map();
  for(const k of vox){const c=k%2048-1024,b=Math.floor(k/2048)%2048-1024,a=Math.floor(k/4194304)-1024,gk=enc(a,b,0);let l=g.get(gk);if(!l)g.set(gk,l=[a,b,[]]);l[2].push(c)}
  for(const[a,b,cs]of g.values()){cs.sort((p,q)=>p-q);for(let i=1;i<cs.length;i++){const gap=cs[i]-cs[i-1]-1;if(gap>0&&gap<=5)for(let c=cs[i-1]+1;c<cs[i];c++)vox.add(enc(a,b,c))}}}
 /* cubinhos → colunas (mesmo x,z; y contíguo) → caixas (colunas vizinhas em x com o mesmo intervalo de y) */
 const cols=new Map();
 for(const k of vox){const c=k%2048-1024,b=Math.floor(k/2048)%2048-1024,a=Math.floor(k/4194304)-1024,ck=enc(a,0,c);let l=cols.get(ck);if(!l)cols.set(ck,l=[a,c,[]]);l[2].push(b)}
 const rows=new Map();
 for(const[a,c,ys]of cols.values()){
  ys.sort((p,q)=>p-q);let s0=ys[0],pv=ys[0];
  const push=(y0,y1)=>{const rk=c+'|'+y0+'|'+y1;let r=rows.get(rk);if(!r)rows.set(rk,r={c,y0,y1,xs:[]});r.xs.push(a)};
  for(let i=1;i<ys.length;i++){if(ys[i]!==pv+1){push(s0,pv);s0=ys[i]}pv=ys[i]}
  push(s0,pv);
 }
 const out=[];
 for(const r of rows.values()){
  r.xs.sort((p,q)=>p-q);let s0=r.xs[0],pv=r.xs[0];
  const box=(a0,a1)=>out.push({x0:a0*v,x1:(a1+1)*v,y0:r.y0*v,y1:(r.y1+1)*v,z0:r.c*v,z1:(r.c+1)*v});
  for(let i=1;i<r.xs.length;i++){if(r.xs[i]!==pv+1){box(s0,pv);s0=r.xs[i]}pv=r.xs[i]}
  box(s0,pv);
 }
 return out;
}
function lobbyLoad(){
 if(LB.promise)return LB.promise;
 LB.promise=new Promise((res,rej)=>{
  if(!THREE.GLTFLoader){rej(new Error('GLTFLoader indisponível'));return}
  const ok=g=>{
   const root=g.scene,SX=LOBBY_SXZ,SY=LOBBY_SY;
   root.scale.set(SX,SY,SX);root.position.set(0,PLATE_H+.1*SY,0);root.updateMatrixWorld(true);   // chão do modelo (y=-0,1) fica em PLATE_H
   const boxes=[],bx=new THREE.Box3(),far=[];
   root.traverse(o=>{
    if(!o.isMesh)return;
    bx.setFromObject(o);
    const sx=bx.max.x-bx.min.x,sy=bx.max.y-bx.min.y,sz=bx.max.z-bx.min.z;
    if(Math.max(sx,sz)>30*SX||sy>30*SY){far.push(o);return}   // peça gigante e distante do mapa (anel a ~90 m): fora da sala, não entra
    o.castShadow=true;o.receiveShadow=true;o.frustumCulled=true;
    if(sy<.66||bx.min.y-PLATE_H>2.1)return;                 // chão/tapete (< 0,66 m) ou coisa acima da cabeça do jogador: não bloqueia
    if(sx*sz>12*SX*SX&&Math.min(sx,sz)>2*SX)return;          // peça enorme (casca da sala): AABB bloquearia a sala toda
    if(sy>2*SY){                                              // peça alta (arcos e pilares das paredes): colisão exata, sem tampar o vão
     const vb=lobbyVoxelBoxes(o,.4);
     if(vb&&vb.length){for(const q of vb)boxes.push(q);return}
    }
    boxes.push({x0:bx.min.x,x1:bx.max.x,y0:bx.min.y,y1:bx.max.y,z0:bx.min.z,z1:bx.max.z});
   });
   far.forEach(o=>o.parent&&o.parent.remove(o));
   const [x0,x1,z0,z1]=LOBBY_RECT,t=2,y0=PLATE_H-6,y1=PLATE_H+20;
   boxes.push({x0:x0-t,x1:x0,y0,y1,z0:z0-t,z1:z1+t},{x0:x1,x1:x1+t,y0,y1,z0:z0-t,z1:z1+t},{x0:x0-t,x1:x1+t,y0,y1,z0:z0-t,z1:z0},{x0:x0-t,x1:x1+t,y0,y1,z0:z1,z1:z1+t});
   /* aberturas em arco das paredes da frente (z≈-2) e de trás (z≈8,7): painéis escuros no meio da espessura da parede fecham a sala */
   const capM=new THREE.MeshStandardMaterial({color:0x3b3f45,roughness:.85,metalness:.1,side:THREE.DoubleSide});
   for(const zc of[-1.95,8.7]){const m=new THREE.Mesh(new THREE.PlaneGeometry(9.7,3.0),capM);m.position.set(-.65,1.4,zc);m.receiveShadow=true;root.add(m)}
   /* luz interna (o teto bloqueia o sol): 4 lâmpadas no teto, só existem enquanto o lobby está visível.
      O alcance (distância) dobrou junto com a sala, então a iluminação cobre tudo como antes. */
   for(const[lx,lz]of[[-3,0.5],[1.8,0.5],[-3,6.5],[1.8,6.5]]){const l=new THREE.PointLight(0xfff0d8,1.2,42*LOBBY_W,1.4);l.position.set(lx,2.3,lz);root.add(l)}
   root.visible=false;scene.add(root);LB.group=root;LB.boxes=boxes;res(root);
  },bad=e=>rej(e||new Error('falha ao carregar o mapa do lobby'));
  if(window.LOBBY_GLTF)new THREE.GLTFLoader().parse(typeof window.LOBBY_GLTF==='string'?window.LOBBY_GLTF:JSON.stringify(window.LOBBY_GLTF),'',ok,bad);   // mapa embutido em lobby-data.js
  else new THREE.GLTFLoader().load('lobby/scene.gltf',ok,undefined,bad);          // alternativa: pasta lobby/ ao lado do index.html
 });
 return LB.promise;
}
function lobbyShow(on){if(LB.group)LB.group.visible=!!on}
/* ---------- CAMERA BASE: o mapa completo (camera-data.js, carregado só quando o jogador aperta "Pronto" no lobby) ----------
   O modelo vem em metros (portas de ~2,3 m). Fica centrado no ponto de nascimento e com o piso dele em CAMB_Y (assim os andares de baixo
   não caem abaixo de y=-20, onde o jogo mata o jogador). Colisão: por TRIÂNGULO (grade espacial), não por caixas — o mapa tem andares,
   rampas, escadas e vãos que caixas fechariam. Chão = superfície de cima mais alta que os pés alcançam (degrau automático até CAMB_STEP);
   parede = qualquer triângulo que invade a faixa entre os joelhos e a cabeça. */
const CAMB_S=1.5;                              // escala do mapa (1 = metros do modelo)
const CAMB_Y=40;                               // altura (mundo) do piso do ponto de nascimento
const CAMB_PARTS=4;                            // o mapa vem em camera-data-1.js … camera-data-N.js (arquivos menores; o jogo junta). Gerado por build_camera_data.py
const CAMB_SPAWN=[-181.35,-9.66,-196.02];     // ponto de nascimento no modelo: centro de um salão aberto (~24 m livres em volta), andar térreo
const CAMB_STEP=.5;                            // degrau que sobe sozinho (m)
const CAMB_VOID=-200;                          // "chão" onde não há mapa: o jogador cai
const CB={promise:null,group:null,light:null,col:null};
/* TANQUES ALIADOS da Camera Base (tank-data.js). Laser vermelho pelo canhão: carrega TK_CHARGE s e dispara um feixe contínuo que causa TK_DMG de dano a cada tick (TK_TICK s). */
const TK_N=3,TK_SC=.34,TK_DMG=7,TK_TICK=.1,TK_RANGE=70,TK_CHARGE=1,TK_BEAM=2.6,TK_COOL=1.2;   // qtde, escala do modelo (27 m -> ~9 m), dano por tick, intervalo do tick (s), alcance (m), carga (s), duração do feixe (s), recarga (s)
const TK_SPD=4.2,TK_BACK=2.2,TK_TURN=.85,TK_KEEP=34,TK_LEASH=55,TK_WAND=30;   // andar: vel. (m/s), vel. de ré, giro do casco (rad/s), distância que tenta manter do alvo, limite longe do salão, raio de patrulha
const TK_SND={c:'tank-charge.mp3',l:'tank-laser.mp3'},TK_SNDR=95;   // sons: carregamento do laser / disparo do laser (ficam na mesma pasta do index.html); alcance (m)
const TK_PAL={core:0xffffff,ring:0xff3030,st:[0xffffff,0xff8a7a,0xff2a2a]};   // branco / rosa / vermelho
const ATNK={tpl:null,promise:null,busy:false,list:[],t:0,v:new THREE.Vector3(),v2:new THREE.Vector3(),q:new THREE.Quaternion(),up:new THREE.Vector3(0,1,0),bgeo:null};
function cambShow(on){if(!on)tkClearPlate();document.body.classList.toggle('camb-on',!!on);if(on&&typeof lobbyRenderBars==='function')lobbyRenderBars();if(CB.group)CB.group.visible=!!on;if(CB.light)CB.light.visible=!!on;tkShow(on)}
function cambBuildCol(root){
 const meshes=[];root.updateMatrixWorld(true);
 root.traverse(o=>{if(o.isMesh&&o.geometry&&o.geometry.attributes&&o.geometry.attributes.position){const mn=String(o.material&&o.material.name||'').toUpperCase();if(mn.indexOf('SKYBOX')>=0||mn.indexOf('DOOR')>=0)return;meshes.push(o)}});   // céu e portas aparecem mas não têm colisão (portas ficam passáveis; o céu gigante estouraria a grade)
 let nt=0;for(const m of meshes){const g=m.geometry;nt+=g.index?Math.floor(g.index.count/3):Math.floor(g.attributes.position.count/3)}
 const T=new Float32Array(nt*9),NY=new Float32Array(nt),MINY=new Float32Array(nt),MAXY=new Float32Array(nt),BB=new Float32Array(nt*4);   // BB: minX,maxX,minZ,maxZ
 let k=0,x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
 for(const m of meshes){
  const g=m.geometry,pos=g.attributes.position,ix=g.index,e=m.matrixWorld.elements,n=ix?Math.floor(ix.count/3):Math.floor(pos.count/3);
  const W=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);W[i*3]=e[0]*x+e[4]*y+e[8]*z+e[12];W[i*3+1]=e[1]*x+e[5]*y+e[9]*z+e[13];W[i*3+2]=e[2]*x+e[6]*y+e[10]*z+e[14]}
  for(let f=0;f<n;f++){
   const i0=ix?ix.getX(f*3):f*3,i1=ix?ix.getX(f*3+1):f*3+1,i2=ix?ix.getX(f*3+2):f*3+2,o=k*9;
   for(let c=0;c<3;c++){const ii=[i0,i1,i2][c];T[o+c*3]=W[ii*3];T[o+c*3+1]=W[ii*3+1];T[o+c*3+2]=W[ii*3+2]}
   const ux=T[o+3]-T[o],uy=T[o+4]-T[o+1],uz=T[o+5]-T[o+2],vx=T[o+6]-T[o],vy=T[o+7]-T[o+1],vz=T[o+8]-T[o+2];
   const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,l=Math.hypot(nx,ny,nz);
   NY[k]=l>1e-12?Math.abs(ny)/l:0;
   MINY[k]=Math.min(T[o+1],T[o+4],T[o+7]);MAXY[k]=Math.max(T[o+1],T[o+4],T[o+7]);
   const a=Math.min(T[o],T[o+3],T[o+6]),b=Math.max(T[o],T[o+3],T[o+6]),c2=Math.min(T[o+2],T[o+5],T[o+8]),d=Math.max(T[o+2],T[o+5],T[o+8]);
   BB[k*4]=a;BB[k*4+1]=b;BB[k*4+2]=c2;BB[k*4+3]=d;
   if(a<x0)x0=a;if(b>x1)x1=b;if(c2<z0)z0=c2;if(d>z1)z1=d;
   k++;
  }
 }
 const cs=4,gw=Math.ceil((x1-x0)/cs)+1,gh=Math.ceil((z1-z0)/cs)+1,cnt=new Int32Array(gw*gh+1);
 const cells=t=>[Math.floor((BB[t*4]-x0)/cs),Math.floor((BB[t*4+1]-x0)/cs),Math.floor((BB[t*4+2]-z0)/cs),Math.floor((BB[t*4+3]-z0)/cs)];
 for(let t=0;t<nt;t++){if(NY[t]===0&&MAXY[t]-MINY[t]<1e-6)continue;const[a,b,c,d]=cells(t);for(let gz=c;gz<=d;gz++)for(let gx=a;gx<=b;gx++)cnt[gz*gw+gx+1]++}
 for(let i=0;i<gw*gh;i++)cnt[i+1]+=cnt[i];
 const items=new Int32Array(cnt[gw*gh]),fill=cnt.slice(0,gw*gh);
 for(let t=0;t<nt;t++){if(NY[t]===0&&MAXY[t]-MINY[t]<1e-6)continue;const[a,b,c,d]=cells(t);for(let gz=c;gz<=d;gz++)for(let gx=a;gx<=b;gx++)items[fill[gz*gw+gx]++]=t}
 return{T,NY,MINY,MAXY,BB,x0,z0,cs,gw,gh,start:cnt,items,nt};
}
/* chão: maior superfície caminhável (face quase horizontal) com y <= yRef+0,6 sob (x,z) */
function cambGround(x,z,yRef){
 if(!CAMB)return PLATE?PLATE_H:CAMB_VOID;   // Baseplate: chão plano (Striders e Farben Tires usam as mesmas funções)
 const C=CB.col;if(!C)return CAMB_VOID;
 const gx=Math.floor((x-C.x0)/C.cs),gz=Math.floor((z-C.z0)/C.cs);if(gx<0||gz<0||gx>=C.gw||gz>=C.gh)return CAMB_VOID;
 const lim=yRef+.6,c=gz*C.gw+gx,T=C.T;let best=-1e9;
 for(let q=C.start[c],e=C.start[c+1];q<e;q++){
  const t=C.items[q];if(C.NY[t]<.5||C.MINY[t]>lim)continue;
  const o=t*9,ax=T[o],az=T[o+2],bx=T[o+3],bz=T[o+5],cx=T[o+6],cz=T[o+8],d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(d>-1e-9&&d<1e-9)continue;
  const l1=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,l2=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d,l3=1-l1-l2;
  if(l1<-1e-4||l2<-1e-4||l3<-1e-4)continue;
  const y=l1*T[o+1]+l2*T[o+4]+l3*T[o+7];if(y<=lim&&y>best)best=y;
 }
 return best>-1e8?best:CAMB_VOID;
}
const _cA=new Float64Array(36),_cB=new Float64Array(36);
function cambClipY(src,n,dst,val,above){
 let m=0;
 for(let i=0;i<n;i++){
  const j=(i+1)%n,ya=src[i*3+1],yb=src[j*3+1],ia=above?ya>=val:ya<=val,ib=above?yb>=val:yb<=val;
  if(ia){dst[m*3]=src[i*3];dst[m*3+1]=ya;dst[m*3+2]=src[i*3+2];m++}
  if(ia!==ib){const u=(val-ya)/(yb-ya);dst[m*3]=src[i*3]+(src[j*3]-src[i*3])*u;dst[m*3+1]=val;dst[m*3+2]=src[i*3+2]+(src[j*3+2]-src[i*3+2])*u;m++}
 }
 return m;
}
/* parede: o triângulo, cortado na faixa [lo,hi] (joelhos → cabeça), chega a menos de r do jogador? */
function cambTriHit(T,o,x,z,r2,lo,hi){
 for(let i=0;i<9;i++)_cA[i]=T[o+i];
 let n=cambClipY(_cA,3,_cB,lo,true);if(n<1)return false;
 n=cambClipY(_cB,n,_cA,hi,false);if(n<1)return false;
 for(let i=0;i<n;i++){
  const j=(i+1)%n,ax=_cA[i*3],az=_cA[i*3+2],bx=_cA[j*3],bz=_cA[j*3+2],dx=bx-ax,dz=bz-az,L=dx*dx+dz*dz;
  let u=L>1e-12?((x-ax)*dx+(z-az)*dz)/L:0;u=u<0?0:u>1?1:u;
  const px=ax+dx*u-x,pz=az+dz*u-z;if(px*px+pz*pz<=r2)return true;
 }
 if(n>=3){let inside=false;for(let i=0,j=n-1;i<n;j=i++){const zi=_cA[i*3+2],zj=_cA[j*3+2],xi=_cA[i*3],xj=_cA[j*3];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside}if(inside)return true}
 return false;
}
function cambHit(x,y,z){
 if(!CAMB)return false;const C=CB.col;if(!C)return false;
 const r=.32,r2=r*r,lo=y+CAMB_STEP,hi=y+1.79,T=C.T;
 const ga=Math.floor((x-r-C.x0)/C.cs),gb=Math.floor((x+r-C.x0)/C.cs),gc=Math.floor((z-r-C.z0)/C.cs),gd=Math.floor((z+r-C.z0)/C.cs);
 for(let gz=gc;gz<=gd;gz++)for(let gx=ga;gx<=gb;gx++){
  if(gx<0||gz<0||gx>=C.gw||gz>=C.gh)continue;
  const c=gz*C.gw+gx;
  for(let q=C.start[c],e=C.start[c+1];q<e;q++){
   const t=C.items[q];if(C.MAXY[t]<=lo||C.MINY[t]>=hi)continue;
   const b=t*4;if(C.BB[b]>x+r||C.BB[b+1]<x-r||C.BB[b+2]>z+r||C.BB[b+3]<z-r)continue;
   if(cambTriHit(T,t*9,x,z,r2,lo,hi))return true;
  }
 }
 return false;
}
function cambLoad(){
 if(CB.promise)return CB.promise;
 CB.promise=new Promise((res,rej)=>{
  const parse=()=>{
   if(!THREE.GLTFLoader){rej(new Error('GLTFLoader indisponível'));return}
   const src=window.CAMERA_GLTF||(window.CAMERA_PARTS&&window.CAMERA_PARTS.join(''));if(!src){rej(new Error('camera-data vazio'));return}
   new THREE.GLTFLoader().parse(typeof src==='string'?src:JSON.stringify(src),'',g=>{
    const root=g.scene,S=CAMB_S;window.CAMERA_GLTF=null;window.CAMERA_PARTS=null;
    root.scale.set(S,S,S);root.position.set(-CAMB_SPAWN[0]*S,CAMB_Y-CAMB_SPAWN[1]*S,-CAMB_SPAWN[2]*S);root.updateMatrixWorld(true);
    root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;o.frustumCulled=true}});   // 302 peças separadas, cada uma cortada pela câmera (culling por peça); sem sombra do sol: os tetos não apagam o interior
    CB.col=cambBuildCol(root);
    const l=new THREE.PointLight(0xfff3dd,.9,45,1.5);l.visible=false;scene.add(l);CB.light=l;   // lâmpada que acompanha o jogador (interior/noite)
    root.visible=false;scene.add(root);CB.group=root;res(root);
   },e=>rej(e||new Error('falha ao ler o mapa da Camera Base')));
  };
  const loadPart=i=>{const sc=document.createElement('script');sc.src='camera-data-'+i+'.js';sc.onload=()=>i<CAMB_PARTS?loadPart(i+1):parse();sc.onerror=()=>rej(new Error('camera-data-'+i+'.js não encontrado (as '+CAMB_PARTS+' partes devem ficar na mesma pasta do index.html)'));document.head.appendChild(sc)};
  if(window.CAMERA_GLTF||(window.CAMERA_PARTS&&window.CAMERA_PARTS.length>=CAMB_PARTS))parse();else loadPart(1);
 });
 return CB.promise;
}
function cambTick(dt){if(CB.light)CB.light.position.set(P.p.x,P.p.y+2.4,P.p.z);strUpdate(dt);cnUpdate(dt);tkUpdate(dt)}
/* "Pronto": teletransporta do lobby para a Camera Base (sem recarregar o mundo: vida, inventário e personagem continuam) */
function enterCambase(){
 if(!LOBBY||CAMB||CIN.active)return;
 cinPre(true);   // tela preta já no clique; a cutscene só começa com tudo carregado
 const t0=performance.now();
 const tankP=tkLoad().then(()=>true,e=>{ATNK.promise=null;console.error('[OWM] tanques aliados:',e);return false});
 Promise.all([cambLoad(),tankP]).then(r=>new Promise(ok=>setTimeout(()=>ok(r),Math.max(0,700-(performance.now()-t0))))).then(r=>{
  if(!LOBBY||CAMB){cinPre(false);return}
  const tankOK=r[1];
  LOBBY=false;CAMB=true;
  lobbyShow(false);cambShow(true);lobbyUI(false);
  spawn=[0,CAMB_Y+.3,0];
  P.p.set(spawn[0],spawn[1],spawn[2]);P.vel.set(0,0,0);P.og=false;P.yaw=P.pitch=0;P.peak=P.p.y;MAPY=P.p.y;
  if(plateGM)plateGM.visible=false;
  plateHud();refreshHealth();
  if(tankOK&&!ATNK.list.length){try{tkSpawnAll()}catch(e){console.error('[OWM] tanques aliados:',e)}}
  tkShow(true);
  let ok=false;
  try{ok=cinBasePlay(tankOK)}catch(e){console.error('[OWM] cinemática da base:',e);cinFinish(true);cinBaseDone();ok=false}
  if(!ok){cinPre(false);toast('Camera Base')}
  if(!tankOK)toast('Não consegui carregar os tanques aliados.');
 }).catch(e=>{CB.promise=null;console.error('[OWM] camera base:',e);cinPre(false);toast('Não consegui carregar a Camera Base. '+(e&&e.message||''))});
}

/* ---------- MODO ONDAS na Camera Base: Striders (Half-Life 2) ----------
   Modelo: "Half-Life 2 - Strider" de fake gman (sketchfab.com/tricky_modeler), CC-BY 4.0 — crédito obrigatório.
   O arquivo original não tem esqueleto nem animação (é uma pose parada), então o modelo foi cortado em peças rígidas (corpo, canhão, 3 pernas)
   e TODA a animação é procedural:
   · ANDAR: cada perna é uma cadeia de 2 ossos (coxa + canela, com joelho) resolvida por cinemática inversa (IK). Cada pé fica PARADO no mundo enquanto
     apoiado (não "patina"); quando fica muito atrás da posição ideal a perna dá um passo: sobe em arco (o joelho dobra), avança e pousa com poeira e
     um leve tremor de tela. No máx. 2 pés no ar (normalmente 1). O corpo se inclina com a velocidade e joga o peso pro lado das pernas de apoio.
     Funciona igual andando pra qualquer lado, de ré, girando ou parado (passos de ajuste). A canela é dobrada deformando os vértices em volta do joelho.
   · PERNA ACERTADA: 3 golpes na mesma perna e ele fica de pé, com aquela perna levantada e TREMENDO por 3 s (não cai mais).
   · PISÃO: levanta a perna da frente (aviso no chão), bate o pé e solta uma onda de choque que só acerta quem está no chão (pule ou use o dash).
   Tiro: o canhão mira no jogador, carrega 0,7 s (brilho azul) e solta uma bola de plasma azul; a explosão usa o mesmo sistema de partículas
   estilo Roblox (RBX) que os golpes: clarão + estrelas + anel de choque + poeira. */
const STR_PAL={core:0xffffff,ring:0x4aa8ff,st:[0xffffff,0x9fd4ff,0x3d8bff]};   // branco / azul-gelo / azul
const STR_LEG=['legA','legB','legC'];
const SG={RMAX:.99,HALF:1.6,TSW:.42,LIFT:1.5,IDLE:1.4,URGENT:1.2,CENTER:.6};   // andar: alcance máx. da perna, meio-passo (m), duração do passo (s), altura do pé (m), folga parado (m), atraso p/ furar a fila, quanto o passo se aproxima do quadril
const SKS={R:15,SPD:14,WIND:.85,HOLD:.16,SLAM:.13,REC:.7,H:3.3,RANGE:13.5,K:{IFRAME:true,MSG:'Um Strider te pisoteou!'}};   // pisão: raio e velocidade da onda, tempos (s), altura do pé, distância pra usar
const STR={tpl:null,promise:null,list:[],shots:[],pending:0,spawnT:0,v:null,mkG:null};
const CN={drops:[],turrets:[],shots:[],carry:false,mount:null,ghost:null,geo:null,sc:0,ui:null,uiKey:'',t:0,DROP:0};   // DROP:0 = o Strider não larga mais o canhão (torreta desativada)   // CANHÃO do Strider (drop, torre colocável)
/* ONDAS: inimigos por onda (Striders) = 6, 10, 14, ... até 70. No máx. WV_ALIVE vivos ao mesmo tempo: os outros nascem aos poucos conforme os primeiros morrem.
   RECOMPENSAS: pontos por inimigo derrotado, cents por onda vencida. */
const WV_FIRST=6,WV_STEP=4,WV_MAX=70,WV_ALIVE=6,WV_PTS_STR=5,WV_PTS_MOB=2,WV_CENT=10,WV_CENT_WAVE=2,WV_PTS_GROW=.15,WV_CENT_GROW=.2;
function wvCount(w){return w<=1?WV_FIRST:Math.min(WV_MAX,WV_FIRST+WV_STEP*(w-1))}
function wvReward(cent,pts){
 if(!cur||cur.biome!=='lobby'||typeof lobbySetStats!=='function')return;
 if(pts)pts=Math.round(pts*(1+WV_PTS_GROW*Math.max(0,STM.wave-1)));   // pontos crescem a cada onda
 lobbySetStats(cent?(cur.cent||0)+cent:null,pts?(cur.pontos||0)+pts:null);
}
const STM={on:false,wave:0,t:0,clr:false,inter:0,hudA:'',hudB:'',hudC:''};
const VH={tpl:null,promise:null,failed:false,list:[],shopEl:null,shopV:null};   // veículos da Legião Vermelha (fim da onda antes do chefe) + loja
(function(){
 if(document.getElementById('wave-hud-css'))return;
 const css=document.createElement('style');css.id='wave-hud-css';
 css.textContent=
 '#wave-hud{display:none;position:absolute;top:8px;left:50%;transform:translateX(-50%);flex-direction:column;align-items:center;gap:4px;pointer-events:none;z-index:6;font-family:Montserrat,system-ui,sans-serif;font-weight:800;color:#fff;text-shadow:0 1px 3px #000}'+
 'body.wave-on #wave-hud{display:flex}'+
 '#wave-hud .wv-top{display:flex;gap:10px;align-items:center;padding:4px 16px;font-size:16px;background:rgba(10,12,18,.72);border:2px solid rgba(143,208,255,.35);border-radius:8px;letter-spacing:.4px}'+
 '#wave-hud .wv-top i{font-style:normal;opacity:.5}'+
 '#wave-hud .wv-sub{padding:2px 12px;font-size:12px;background:rgba(10,12,18,.6);border-radius:6px;letter-spacing:.3px}';
 document.head.appendChild(css);
})();
function strHudEnsure(){
 let h=document.getElementById('wave-hud');if(h)return h;
 h=document.createElement('div');h.id='wave-hud';
 h.innerHTML='<div class="wv-top"><span id="wv-wave"></span><i>|</i><span id="wv-time"></span></div><div class="wv-sub" id="wv-left"></div>';
 (document.getElementById('hud')||document.body).appendChild(h);return h;
}
function strHud(){
 if(!STM.on)return;strHudEnsure();
 let alive=0;for(const t of STR.list)if(t.hp>0)alive++;
 const left=alive+STR.pending+scs.filter(q=>q.k.isFB&&q.st!=='dead'&&!q.rm&&!q.fr).length,a='Onda '+Math.max(1,STM.wave),m=Math.floor(STM.t/60),sec=Math.floor(STM.t%60),b=(m<10?'0':'')+m+':'+(sec<10?'0':'')+sec;
 const c=STM.vhMsg?STM.vhMsg:STM.clr?('Onda concluída! Próxima em '+Math.max(1,Math.ceil(STM.inter))+'s'):('Inimigos restantes: '+left);
 if(a!==STM.hudA){STM.hudA=a;document.getElementById('wv-wave').textContent=a}
 if(b!==STM.hudB){STM.hudB=b;document.getElementById('wv-time').textContent=b}
 if(c!==STM.hudC){STM.hudC=c;document.getElementById('wv-left').textContent=c}
}
function strLoad(){
 if(STR.promise)return STR.promise;
 STR.promise=new Promise((res,rej)=>{
  const parse=()=>{
   if(!THREE.GLTFLoader){rej(new Error('GLTFLoader indisponível'));return}
   const src=window.STRIDER_GLTF;if(!src){rej(new Error('strider-data.js vazio'));return}
   new THREE.GLTFLoader().parse(typeof src==='string'?src:JSON.stringify(src),'',g=>{
    try{window.STRIDER_GLTF=null;STR.tpl=strPrep(g.scene);STR.v=new THREE.Vector3();res(STR.tpl)}catch(e){rej(e)}
   },e=>rej(e||new Error('falha ao ler o Strider')));
  };
  if(window.STRIDER_GLTF)parse();
  else{const sc=document.createElement('script');sc.src='strider-data.js';sc.onload=parse;sc.onerror=()=>rej(new Error('strider-data.js não encontrado (deve ficar na mesma pasta do index.html)'));document.head.appendChild(sc)}
 });
 return STR.promise;
}
/* acha os pivôs: quadril = centro dos vértices mais altos da perna, pé = centro dos mais baixos; canhão: pivô atrás, boca na frente (+Z) */
/* ---------- ANDAR PROCEDURAL (IK de 2 ossos) ----------
   Matemática em arrays simples (sem THREE): matrizes 3x3 em linhas [m00,m01,m02,m10,...]. */
function sgCross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function sgUnit(a){const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l]}
function sgFrame(u,n){const w=sgCross(u,n);return[u[0],n[0],w[0],u[1],n[1],w[1],u[2],n[2],w[2]]}   // base com colunas u, n, u×n
function sgMul(A,B){const C=new Array(9);for(let r=0;r<3;r++)for(let c=0;c<3;c++)C[r*3+c]=A[r*3]*B[c]+A[r*3+1]*B[3+c]+A[r*3+2]*B[6+c];return C}
function sgTr(A){return[A[0],A[3],A[6],A[1],A[4],A[7],A[2],A[5],A[8]]}
function sgQuat(M){   // rotação 3x3 -> quaternion [x,y,z,w]
 const t=M[0]+M[4]+M[8];let x,y,z,w,s;
 if(t>0){s=Math.sqrt(t+1)*2;w=s/4;x=(M[7]-M[5])/s;y=(M[2]-M[6])/s;z=(M[3]-M[1])/s}
 else if(M[0]>M[4]&&M[0]>M[8]){s=Math.sqrt(1+M[0]-M[4]-M[8])*2;w=(M[7]-M[5])/s;x=s/4;y=(M[1]+M[3])/s;z=(M[2]+M[6])/s}
 else if(M[4]>M[8]){s=Math.sqrt(1+M[4]-M[0]-M[8])*2;w=(M[2]-M[6])/s;x=(M[1]+M[3])/s;y=s/4;z=(M[5]+M[7])/s}
 else{s=Math.sqrt(1+M[8]-M[0]-M[4])*2;w=(M[3]-M[1])/s;x=(M[2]+M[6])/s;y=(M[5]+M[7])/s;z=s/4}
 return[x,y,z,w];
}
/* atitude do corpo = Ry(yaw)·Rx(rx)·Rz(rz) (mesma ordem do THREE: g.rotation.y e tilt.rotation.x/z) */
function sgRb(psi,rx,rz){
 const cy=Math.cos(psi),sy=Math.sin(psi),cx=Math.cos(rx),sx=Math.sin(rx),cz=Math.cos(rz),sz=Math.sin(rz);
 const a0=cz,a1=-sz,a2=0,b0=cx*sz,b1=cx*cz,b2=-sx,c0=sx*sz,c1=sx*cz,c2=cx;
 return[cy*a0+sy*c0,cy*a1+sy*c1,cy*a2+sy*c2, b0,b1,b2, -sy*a0+cy*c0,-sy*a1+cy*c1,-sy*a2+cy*c2];
}
/* Prepara UMA perna (geometria com o quadril na origem): acha o joelho, os comprimentos coxa/canela, o "joelho pra onde" (pole),
   e o peso de cada vértice (0 = acompanha a coxa, 1 = acompanha a canela, transição suave em volta do joelho: malha contínua, sem fresta). */
function sgPrepLeg(g,hip,foot){
 const p=g.attributes.position,nm=g.attributes.normal,n=p.count,f=[foot.x,foot.y,foot.z],Lt=Math.hypot(f[0],f[1],f[2]),e0=[f[0]/Lt,f[1]/Lt,f[2]/Lt];
 const rp=new Float32Array(n*3),rn=new Float32Array(n*3),h=new Float32Array(n);
 for(let i=0;i<n;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);rp[i*3]=x;rp[i*3+1]=y;rp[i*3+2]=z;rn[i*3]=nm.getX(i);rn[i*3+1]=nm.getY(i);rn[i*3+2]=nm.getZ(i);h[i]=x*e0[0]+y*e0[1]+z*e0[2]}
 let bc=-1,bh=Lt*.5;   // joelho = centro do aglomerado de vértices mais denso (a "bola" do joelho) entre 25% e 75% da perna
 for(let c=Lt*.25;c<=Lt*.75;c+=.05){let k=0;for(let i=0;i<n;i++)if(Math.abs(h[i]-c)<=.4)k++;if(k>bc){bc=k;bh=c}}
 let kx=0,ky=0,kz=0,kn=0;for(let i=0;i<n;i++)if(Math.abs(h[i]-bh)<=.55){kx+=rp[i*3];ky+=rp[i*3+1];kz+=rp[i*3+2];kn++}
 const k0=kn?[kx/kn,ky/kn,kz/kn]:[f[0]*.4,f[1]*.4,f[2]*.4];
 const kd=k0[0]*e0[0]+k0[1]*e0[1]+k0[2]*e0[2];let pole=[k0[0]-e0[0]*kd,k0[1]-e0[1]*kd,k0[2]-e0[2]*kd];
 if(Math.hypot(pole[0],pole[1],pole[2])<.05)pole=sgCross(e0,[0,0,1]);   // perna reta (não deve acontecer): escolhe um lado
 pole=sgUnit(pole);
 const s0=sgUnit([f[0]-k0[0],f[1]-k0[1],f[2]-k0[2]]),a0=sgUnit(k0),n0=sgUnit(sgCross(e0,pole)),idx=[],wt=[];
 for(let i=0;i<n;i++){const d=(rp[i*3]-k0[0])*s0[0]+(rp[i*3+1]-k0[1])*s0[1]+(rp[i*3+2]-k0[2])*s0[2],u=Math.max(0,Math.min(1,(d+.2)/1.05)),w=u*u*(3-2*u);if(w>.002){idx.push(i);wt.push(w)}}
 return{hip:[hip.x,hip.y,hip.z],hx:hip.x+foot.x,hz:hip.z+foot.z,k0,f0:f,L1:Math.hypot(k0[0],k0[1],k0[2]),L2:Math.hypot(f[0]-k0[0],f[1]-k0[1],f[2]-k0[2]),pole,
  FtT:sgTr(sgFrame(a0,n0)),FsT:sgTr(sgFrame(s0,n0)),idx:Uint32Array.from(idx),wt:Float32Array.from(wt),rp,rn};
}
/* IK de 2 ossos. F = alvo do pé relativo ao quadril (referencial do corpo). Saída em o:
   q = rotação da coxa (quaternion), Rk = dobra do joelho (relativa à coxa), K = joelho, F = pé (já limitado ao alcance da perna). */
function sgSolve(L,F,o){
 let fx=F[0],fy=F[1],fz=F[2],d=Math.hypot(fx,fy,fz);const dmax=(L.L1+L.L2)*SG.RMAX,dmin=Math.abs(L.L1-L.L2)+.3;
 if(d<1e-6){fx=0;fy=-dmin;fz=0;d=dmin}
 else if(d>dmax||d<dmin){const t=(d>dmax?dmax:dmin)/d;fx*=t;fy*=t;fz*=t;d=d>dmax?dmax:dmin}
 const e=[fx/d,fy/d,fz/d],pd=L.pole[0]*e[0]+L.pole[1]*e[1]+L.pole[2]*e[2];
 let p=[L.pole[0]-e[0]*pd,L.pole[1]-e[1]*pd,L.pole[2]-e[2]*pd];
 if(Math.hypot(p[0],p[1],p[2])<1e-4)p=sgCross(e,[1,0,0]);
 p=sgUnit(p);
 const cA=Math.max(-1,Math.min(1,(L.L1*L.L1+d*d-L.L2*L.L2)/(2*L.L1*d))),sA=Math.sqrt(1-cA*cA);
 const a=[e[0]*cA+p[0]*sA,e[1]*cA+p[1]*sA,e[2]*cA+p[2]*sA],K=[a[0]*L.L1,a[1]*L.L1,a[2]*L.L1];
 const s=sgUnit([fx-K[0],fy-K[1],fz-K[2]]),n=sgUnit(sgCross(e,p));
 const Rt=sgMul(sgFrame(a,n),L.FtT),Rs=sgMul(sgFrame(s,n),L.FsT);
 o.q=sgQuat(Rt);o.Rk=sgMul(sgTr(Rt),Rs);o.K=K;o.F=[fx,fy,fz];
}
/* dobra a canela: cada vértice gira em volta do joelho pelo peso dele (mistura entre a pose de repouso e a pose dobrada) */
function sgDeform(L,geo,R){
 const pa=geo.attributes.position,na=geo.attributes.normal,idx=L.idx,wt=L.wt,rp=L.rp,rn=L.rn,k=L.k0;
 for(let j=0;j<idx.length;j++){
  const i=idx[j],w=wt[j],o=i*3,px=rp[o],py=rp[o+1],pz=rp[o+2],x=px-k[0],y=py-k[1],z=pz-k[2];
  pa.setXYZ(i,px+(k[0]+R[0]*x+R[1]*y+R[2]*z-px)*w,py+(k[1]+R[3]*x+R[4]*y+R[5]*z-py)*w,pz+(k[2]+R[6]*x+R[7]*y+R[8]*z-pz)*w);
  const nx=rn[o],ny=rn[o+1],nz=rn[o+2];
  na.setXYZ(i,nx+(R[0]*nx+R[1]*ny+R[2]*nz-nx)*w,ny+(R[3]*nx+R[4]*ny+R[5]*nz-ny)*w,nz+(R[6]*nx+R[7]*ny+R[8]*nz-nz)*w);
 }
 pa.needsUpdate=true;na.needsUpdate=true;
}
/* posição de repouso do pé i no mundo (corpo em bx,bz com giro psi) */
function sgHome(t,i,bx,bz,psi){   // t.hc = quanto o centro do passo se aproxima do quadril (só andando: o corpo não precisa afundar pra alcançar os pés)
 const L=STR.tpl.leg[i],c=Math.cos(psi),s=Math.sin(psi),k=t.hc||0,lx=L.hx-k*(L.hx-L.hip[0]),lz=L.hz-k*(L.hz-L.hip[2]);
 return[bx+c*lx+s*lz,bz-s*lx+c*lz];
}
/* altura do chão sob um pé (com plano de segurança: se não achar chão plausível, usa o do corpo) */
function sgGround(t,x,z){const g=cambGround(x,z,t.gy+.5);return(g>CAMB_VOID+1&&Math.abs(g-t.gy)<1.2)?g:t.gy}
function sgInit(t){
 const z3=()=>[0,0,0];
 t.fx=z3();t.fz=z3();t.fy=z3();t.fg=[t.gy,t.gy,t.gy];t.sw=[-1,-1,-1];t.sx=z3();t.sz=z3();t.ex=z3();t.ez=z3();t.ls=[1,1,1];t.jx=z3();t.jy=z3();t.jz=z3();
 t.kw=[z3(),z3(),z3()];t.fw=[z3(),z3(),z3()];t.tg=[z3(),z3(),z3()];t.ik=[{},{},{}];
 t.vx=t.vz=t.yr=0;t.dd=0;t.dv=0;t.cr=0;t.rx=t.rz=0;t.ar=t.ac=0;t.jr=t.jc=0;
 for(let i=0;i<3;i++){const h=sgHome(t,i,t.x,t.z,t.yaw);t.fx[i]=h[0];t.fz[i]=h[1];t.fg[i]=sgGround(t,h[0],h[1])}
 for(let k=0;k<20;k++)sgPose(t,.02);   // assenta a altura do corpo
}
/* Monta a pose a partir dos alvos dos pés (t.fx/fz + altura t.fy + tremor t.jx/jy/jz): altura do corpo (mola amortecida, limitada pelo alcance
   das pernas), IK de cada perna, dobra da canela, posição do joelho/pé no mundo e alvos do soco. */
function sgPose(t,dt){
 const T=STR.tpl,gy=t.gy,Rb=sgRb(t.yaw,t.rx+t.jr,t.rz+t.jc);let dl=1e9;
 for(let i=0;i<3;i++){   // 1) alvo de cada pé no mundo e quanto o corpo pode subir sem esticar demais a perna
  const L=T.leg[i],h=L.hip,hx=Rb[0]*h[0]+Rb[1]*h[1]+Rb[2]*h[2],hy=Rb[3]*h[0]+Rb[4]*h[1]+Rb[5]*h[2],hz=Rb[6]*h[0]+Rb[7]*h[1]+Rb[8]*h[2];
  const o=t.tg[i],x=t.fx[i]+t.jx[i],y=t.fg[i]+t.fy[i]+t.jy[i],z=t.fz[i]+t.jz[i];o[0]=x;o[1]=y;o[2]=z;
  const hd=Math.hypot(x-(t.x+hx),z-(t.z+hz)),rm=(L.L1+L.L2)*SG.RMAX,lim=y+Math.sqrt(Math.max(rm*rm-hd*hd,36))-gy-hy;
  if(lim<dl)dl=lim;
 }
 const want=Math.min(dl,t.cr),n=Math.max(1,Math.ceil(dt/.016)),hs=dt/n;   // 2) altura do corpo
 for(let k=0;k<n;k++){t.dv+=(150*(want-t.dd)-24*t.dv)*hs;t.dd+=t.dv*hs}
 if(t.dd>dl+.04){t.dd=dl+.04;if(t.dv>0)t.dv=0}
 const by=gy+t.dd;t.by=by;
 for(let i=0;i<3;i++){   // 3) IK
  const L=T.leg[i],o=t.tg[i],r=t.ik[i],wx=o[0]-t.x,wy=o[1]-by,wz=o[2]-t.z;
  sgSolve(L,[Rb[0]*wx+Rb[3]*wy+Rb[6]*wz-L.hip[0],Rb[1]*wx+Rb[4]*wy+Rb[7]*wz-L.hip[1],Rb[2]*wx+Rb[5]*wy+Rb[8]*wz-L.hip[2]],r);
  const q=r.q;t.legs[i].quaternion.set(q[0],q[1],q[2],q[3]);sgDeform(L,t.lgeo[i],r.Rk);
  const kx=L.hip[0]+r.K[0],ky=L.hip[1]+r.K[1],kz=L.hip[2]+r.K[2],fx=L.hip[0]+r.F[0],fy=L.hip[1]+r.F[1],fz=L.hip[2]+r.F[2],K=t.kw[i],F=t.fw[i];
  K[0]=t.x+Rb[0]*kx+Rb[1]*ky+Rb[2]*kz;K[1]=by+Rb[3]*kx+Rb[4]*ky+Rb[5]*kz;K[2]=t.z+Rb[6]*kx+Rb[7]*ky+Rb[8]*kz;
  F[0]=t.x+Rb[0]*fx+Rb[1]*fy+Rb[2]*fz;F[1]=by+Rb[3]*fx+Rb[4]*fy+Rb[5]*fz;F[2]=t.z+Rb[6]*fx+Rb[7]*fy+Rb[8]*fz;
 }
 t.g.position.set(t.x,by,t.z);t.g.rotation.y=t.yaw;t.tilt.rotation.x=t.rx+t.jr;t.tilt.rotation.z=t.rz+t.jc;t.g.updateMatrixWorld(true);
 for(let i=0;i<3;i++){const q=t.prox[i],F=t.fw[i];q.x=F[0];q.z=F[2];q.y=Math.max(gy,Math.min(F[1],gy+1.8))}   // alvos do soco = pés (pé muito alto: mantém no alcance)
}
/* inclinação do corpo: se joga pra frente/lado com a velocidade e se afasta da perna levantada (peso nas pernas de apoio) */
function sgAttitude(t,dt){
 const T=STR.tpl,cy=Math.cos(t.yaw),sy=Math.sin(t.yaw),vl=cy*t.vx-sy*t.vz,vf=sy*t.vx+cy*t.vz;
 let rx=Math.max(-.05,Math.min(.05,vf*.011))+t.ar+Math.sin(t.age*.9)*.003,rz=Math.max(-.05,Math.min(.05,-vl*.011))+t.ac+Math.sin(t.age*1.3+1)*.004;
 for(let i=0;i<3;i++){const l=Math.min(1.3,t.fy[i]/1.5),h=T.leg[i].hip;rz+=.03*h[0]*l;rx-=.04*(h[2]-T.hzc)*l}
 const a=Math.min(1,dt*6);t.rx+=(rx-t.rx)*a;t.rz+=(rz-t.rz)*a;
}
/* pé pousa: peso cai no corpo, poeira e um tremorzinho de tela (só perto do jogador) */
function sgLand(t,i){
 const x=t.fx[i],z=t.fz[i];t.fg[i]=sgGround(t,x,z);t.dv-=1.4;
 const d=Math.hypot(P.p.x-x,P.p.z-z);
 if(d<70){rbxDust({x,y:t.fg[i]+.35,z},3,0xb9b2a2);if(d<42)addTrauma(.045*(1-d/42))}
}
/* começa o passo da perna i: sai de onde está e pousa à frente da posição de repouso (prevendo onde o corpo estará quando o pé chegar) */
function sgSwing(t,i,ux,uz,L){
 const T=SG.TSW,h=sgHome(t,i,t.x+t.vx*T,t.z+t.vz*T,t.yaw+t.yr*T);
 t.sx[i]=t.fx[i];t.sz[i]=t.fz[i];t.ex[i]=h[0]+ux*L;t.ez[i]=h[1]+uz*L;
 const d=Math.hypot(t.ex[i]-t.sx[i],t.ez[i]-t.sz[i]);t.ls[i]=Math.max(.4,Math.min(1,.35+d/4.2));t.sw[i]=0;
}
/* Passos. mvx/mvz = velocidade do corpo neste quadro (m/s), yr = velocidade de giro (rad/s).
   O pé fica PARADO no mundo enquanto apoiado; quando fica a mais de 2×meio-passo da posição ideal (ou, parado, a mais de SG.IDLE dela),
   a perna mais "atrasada" dá um passo (um de cada vez; a seguinte pode começar quando a anterior passa de 80%). */
function sgWalk(t,dt,mvx,mvz,yr){
 const a=Math.min(1,dt*5);t.vx+=(mvx-t.vx)*a;t.vz+=(mvz-t.vz)*a;t.yr+=(yr-t.yr)*a;
 const v=Math.hypot(t.vx,t.vz),mv=v>.25,ux=mv?t.vx/v:0,uz=mv?t.vz/v:0,L=Math.min(SG.HALF,v*.41);
 t.hc=SG.CENTER*Math.min(1,v/3.91);t.cr=-.16*Math.min(1,v/3.91);   // andando, o corpo fica um pouco mais baixo (joelhos dobrados)
 let busy=false,air=0;
 for(let i=0;i<3;i++){
  if(t.sw[i]<0)continue;
  t.sw[i]+=dt/SG.TSW;const u=Math.min(1,t.sw[i]),e=u*u*u*(u*(u*6-15)+10);   // avanço suave (velocidade zero na saída e na chegada)
  t.fx[i]=t.sx[i]+(t.ex[i]-t.sx[i])*e;t.fz[i]=t.sz[i]+(t.ez[i]-t.sz[i])*e;
  t.fy[i]=SG.LIFT*t.ls[i]*Math.pow(Math.max(0,Math.sin(Math.PI*Math.pow(u,.85))),1.3);   // arco: sobe cedo, desce devagar (pouso macio)
  if(t.sw[i]>=1){t.sw[i]=-1;t.fy[i]=0;sgLand(t,i)}else{air++;if(t.sw[i]<.8)busy=true}
 }
 if(t.sk>0)return;
 let bi=-1,bo=0;
 for(let i=0;i<3;i++){if(t.sw[i]>=0||t.fy[i]>.05)continue;
  const h=sgHome(t,i,t.x,t.z,t.yaw),ov=Math.hypot(h[0]+ux*L-t.fx[i],h[1]+uz*L-t.fz[i])/Math.max(2*L,SG.IDLE);
  if(ov>=1&&ov>bo){bo=ov;bi=i}}
 if(bi>=0&&air<2&&(!busy||bo>=SG.URGENT))sgSwing(t,bi,ux,uz,L);   // perna muito atrasada passa na frente (evita o corpo afundar esperando a vez)
}

function strPrep(sc){
 const T={geo:{},mat:null,hip:{},foot:{},cPivot:null,muzzle:null,leg:[],hzc:0};
 const find=n=>{let r=null;sc.traverse(o=>{if(o.isMesh&&o.name===n)r=o});if(!r)throw new Error('peça "'+n+'" ausente no strider-data.js');return r};
 for(const n of['body','cannon','legA','legB','legC']){const m=find(n);T.geo[n]=m.geometry;if(!T.mat)T.mat=m.material}
 const ends=(g,ax,tol)=>{const p=g.attributes.position;let lo=1e9,hi=-1e9;for(let i=0;i<p.count;i++){const v=ax==='y'?p.getY(i):p.getZ(i);if(v<lo)lo=v;if(v>hi)hi=v}
  const a=new THREE.Vector3(),b=new THREE.Vector3();let na=0,nb=0;
  for(let i=0;i<p.count;i++){const v=ax==='y'?p.getY(i):p.getZ(i);if(v<lo+tol){a.x+=p.getX(i);a.y+=p.getY(i);a.z+=p.getZ(i);na++}if(v>hi-tol){b.x+=p.getX(i);b.y+=p.getY(i);b.z+=p.getZ(i);nb++}}
  return{lo:a.divideScalar(Math.max(1,na)),hi:b.divideScalar(Math.max(1,nb))}};
 T.leg=[];
 for(const n of STR_LEG){const g=T.geo[n],e=ends(g,'y',.3),hip=e.hi.clone(),foot=e.lo.clone().sub(hip);g.translate(-hip.x,-hip.y,-hip.z);T.hip[n]=hip;T.foot[n]=foot;T.leg.push(sgPrepLeg(g,hip,foot))}
 T.hzc=(T.leg[0].hip[2]+T.leg[1].hip[2]+T.leg[2].hip[2])/3;
 {const g=T.geo.cannon,e=ends(g,'z',.25),back=e.lo.clone(),front=e.hi.clone().sub(back);g.translate(-back.x,-back.y,-back.z);T.cPivot=back;T.muzzle=front}
 return T;
}
/* cria um Strider em (x,y,z) olhando pro jogador */
/* cria um Strider em (x,y,z) olhando pro jogador */
function strMake(x,y,z,hp){
 const T=STR.tpl,mat=T.mat.clone();mat.emissive=new THREE.Color(0x000000);
 const g=new THREE.Group(),tilt=new THREE.Group();g.add(tilt);
 const mk=(geo,parent)=>{const m=new THREE.Mesh(geo,mat);m.castShadow=true;m.frustumCulled=false;parent.add(m);return m};
 mk(T.geo.body,tilt);
 const cg=new THREE.Group();cg.position.copy(T.cPivot);tilt.add(cg);mk(T.geo.cannon,cg);
 const lgeo=[],legs=STR_LEG.map(n=>{   // cada Strider tem a sua cópia da geometria das pernas (a canela é deformada no joelho a cada quadro)
  const lg=new THREE.Group();lg.position.copy(T.hip[n]);tilt.add(lg);
  const geo=T.geo[n].clone();geo.attributes.position.setUsage(35048);geo.attributes.normal.setUsage(35048);lgeo.push(geo);mk(geo,lg);return lg});
 g.position.set(x,y,z);scene.add(g);
 // barra de vida (sprites sempre de frente pra câmera)
 const bgM=new THREE.SpriteMaterial({color:0x000000,transparent:true,opacity:.65,depthTest:false,fog:false}),fiM=new THREE.SpriteMaterial({color:0x4aa8ff,transparent:true,depthTest:false,fog:false});
 const bg=new THREE.Sprite(bgM),fi=new THREE.Sprite(fiM);bg.scale.set(4.2,.36,1);bg.center.set(.5,.5);fi.scale.set(4,.24,1);fi.center.set(.5,.5);bg.renderOrder=998;fi.renderOrder=999;bg.frustumCulled=fi.frustumCulled=false;scene.add(bg);scene.add(fi);
 // barras das pernas (aparecem quando a perna apanha; 3 golpes na mesma perna a deixam tremendo)
 const lb=[0,1,2].map(()=>{const b=new THREE.Sprite(new THREE.SpriteMaterial({color:0x000000,transparent:true,opacity:.75,depthTest:false,fog:false})),f=new THREE.Sprite(new THREE.SpriteMaterial({color:0xffa030,transparent:true,depthTest:false,fog:false}));
  b.scale.set(1.8,.26,1);f.scale.set(1.7,.17,1);b.center.set(.5,.5);f.center.set(.5,.5);b.renderOrder=998;f.renderOrder=999;b.frustumCulled=f.frustumCulled=false;b.visible=f.visible=false;scene.add(b);scene.add(f);return{bg:b,fi:f}});
 const t={lb,sT:-1,hl:-1,lh:[0,0,0],lt:[0,0,0],land:0,smk:0,g,tilt,cg,legs,lgeo,mat,bg,fi,x,z,gy:y,by:y,yaw:Math.atan2(P.p.x-x,P.p.z-z),hp,mhp:hp,age:0,cd:1.5+Math.random()*1.5,charge:0,quick:0,burst:0,bT:0,recoil:0,flash:0,orb:Math.random()<.5?1:-1,orbT:2+Math.random()*3,sp0:3.91,dead:0,xT:0,boom:0,rm:0,prox:[],
  sk:0,skT:0,sj:0,skCd:4+Math.random()*3,tk:0,mk:null,f0x:0,f0z:0,k1x:0,k1z:0,k1g:0};   // sp0 = 3,4 m/s +15%
 for(let i=0;i<3;i++)t.prox.push({isStrider:true,owner:t,x,y,z,k:{BODY_R:1.6},st:'alive',fr:false,bur:0,leg:i});
 sgInit(t);strBar(t);return t;
}
function strBar(t){const r=Math.max(0,t.hp/t.mhp);t.fi.scale.x=Math.max(.001,4*r);t.fi.center.x=.5/Math.max(.001,r)}
function strDispose(t){for(const b of t.lb){scene.remove(b.bg);scene.remove(b.fi);b.bg.material.dispose();b.fi.material.dispose()}scene.remove(t.g);scene.remove(t.bg);scene.remove(t.fi);t.bg.material.dispose();t.fi.material.dispose();t.mat.dispose();
 for(const g of t.lgeo)g.dispose();if(t.mk){scene.remove(t.mk);t.mk.material.dispose()}}

function strFree(t,x,z){const R=2.6;for(let k=0;k<4;k++){const px=x+(k&1?R:-R),pz=z+(k&2?R:-R);if(cambHit(px,t.gy,pz))return false;if(Math.abs(cambGround(px,pz,t.gy+.5)-t.gy)>.6)return false}return true}
function strLOS(ax,ay,az,bx,by,bz){for(let i=1;i<=8;i++){const k=i/9;if(cambHit(ax+(bx-ax)*k,ay+(by-ay)*k-.9,az+(bz-az)*k))return false}return true}
/* pose da caminhada: phase 0..1, k = quanto está andando (0 parado → pernas em repouso) */
function strFindSpot(){
 for(let k=0;k<50;k++){
  const a=Math.random()*6.2832,r=22+Math.random()*10,x=P.p.x+Math.cos(a)*r,z=P.p.z+Math.sin(a)*r,gy=cambGround(x,z,P.p.y+.4);
  if(Math.abs(gy-P.p.y)>.7)continue;
  let ok=true;for(let j=0;j<8&&ok;j++){const b=j*.785,xx=x+Math.cos(b)*3,zz=z+Math.sin(b)*3;if(cambHit(xx,gy,zz)||Math.abs(cambGround(xx,zz,gy+.4)-gy)>.7)ok=false}
  if(ok)return[x,gy,z];
 }
 return[0,CAMB_Y,0];   // fallback: centro do salão de nascimento
}
function strSpawnOne(){
 const[x,y,z]=CIN.far?strFindSpotFar():strFindSpot(),hp=150+40*(Math.max(1,STM.wave)-1),t=strMake(x,y,z,hp);STR.list.push(t);
 const o={x,y:y+.4,z};rbxHit(o,STR_PAL,{n:14,sp:8,size:.5,flash:2.6,ring:6,fin:true});rbxAdd('ring',0x9fd4ff,x,y+.3,z,0,0,0,.6,10,{ring:1});rbxDust(o,6,0x8fa8c8);
 if(Math.hypot(x-P.p.x,z-P.p.z)<40)addTrauma(.12);
}
/* zumbis: só nascem no INÍCIO de cada onda (1 na onda 1, +1 por onda, até ZK.MAX vivos), no mesmo andar do jogador */
function strSpawnZombies(){
 if(!ZF)return;const ZK=SPC.zombie;
 let want=Math.min(STM.wave,ZK.MAX)-scs.filter(q=>q.k===ZK&&q.st!=='dead').length;
 for(let a=0;a<120&&want>0;a++){
  const an=Math.random()*6.2832,r=14+Math.random()*16,x=P.p.x+Math.sin(an)*r,z=P.p.z+Math.cos(an)*r;
  const gy=cambGround(x,z,P.p.y+.4);if(Math.abs(gy-P.p.y)>.7)continue;
  let ok=true;for(let j=0;j<8&&ok;j++){const b=j*.785,xx=x+Math.cos(b)*1.2,zz=z+Math.sin(b)*1.2;if(cambHit(xx,gy,zz)||Math.abs(cambGround(xx,zz,gy+.4)-gy)>.7)ok=false}
  if(!ok||scs.some(o=>Math.hypot(o.x-x,o.z-z)<8))continue;
  try{const zs=scSpawn(x,z,'zombie');if(zs){zs.mhp=zs.hp=Math.max(1,Math.round(zs.k.HP*.65));zs.dm=.65;zs.din=1.15;want--}}catch(e){console.error('[OWM] Erro ao criar zumbi:',e)}   // Camera Base: -35% de vida e de dano, +15% de dano recebido
 }
}
/* ONDA DE CHEFE (a cada 5): o Farben Tire gigante + 4 pequenos. O modelo carrega na hora (farben-data.js); a onda só acaba quando todos morrem. */
function fbPlace(r0,r1,rad){
 for(let a=0;a<80;a++){
  const an=Math.random()*6.2832,r=r0+Math.random()*(r1-r0),x=P.p.x+Math.sin(an)*r,z=P.p.z+Math.cos(an)*r,gy=cambGround(x,z,P.p.y+.4);
  if(Math.abs(gy-P.p.y)>.7)continue;
  let ok=true;for(let j=0;j<8&&ok;j++){const b=j*.785,xx=x+Math.cos(b)*rad,zz=z+Math.sin(b)*rad;if(cambHit(xx,gy,zz)||Math.abs(cambGround(xx,zz,gy+.4)-gy)>.7)ok=false}
  if(ok&&!scs.some(o=>Math.hypot(o.x-x,o.z-z)<6))return[x,z];
 }
 return null}
function fbBossAlive(){return STM.fbWait||scs.some(s=>s.k.isFB&&s.st!=='dead'&&!s.rm&&!s.fr)}
function fbSpawnBossWave(){
 STM.fbWait=true;
 fbLoad().then(()=>{
  STM.fbWait=false;if(!CAMB||!STM.on)return;
  const b=fbPlace(24,34,7),bs=b&&scSpawn(b[0],b[1],'farbenB');
  if(bs){bs.hb.scale.setScalar(9);bs.mhp=bs.hp=SPC.farbenB.HP*(1+.25*Math.floor(STM.wave/5-1));bs.sees=true}
  for(let i=0;i<4;i++){const q=fbPlace(14,26,1.2),ms=q&&scSpawn(q[0],q[1],'farbenS');if(ms)ms.sees=true}
  try{const o={x:P.p.x,y:P.p.y,z:P.p.z};addTrauma(.2)}catch(e){}
 }).catch(e=>{STM.fbWait=false;console.error('[OWM] Farben Tire:',e);toast('Não consegui carregar o Farben Tire. '+(e&&e.message||''))});
}
/* ---------- VEÍCULOS DA LEGIÃO VERMELHA + LOJA ----------
   Pacote "Destiny 2 Red Legion Vehicles" (scene.gltf): extraia o zip numa pasta vehicles/ ao lado do index.html (vehicles/scene.gltf + textures/).
   Quando a onda ANTES do chefe (4, 9, 14...) é vencida, o Interceptor, o Thresher e o Scorpius chegam voando de longe, descem e POUSAM perto do jogador.
   · Chegando perto de qualquer um abre a LOJA (vazia por enquanto); afastando, fecha.
   · Ficam VH_STAY segundos (contados depois que o último pousou), decolam e somem. SÓ ENTÃO a onda do chefe começa. */
const VH_STAY=50,VH_DESC=1.7,VH_H=3.4;
const VH_PRESET=[   // pre: prefixo do nome no glTF · n: nome na loja · len: comprimento (m) · dl: atraso da chegada (s) · T: tempo de voo (s) · side: deslocamento lateral (m) · hov: altura parado · bob: balanço
 {pre:'Interceptor_ARM',n:'Interceptor',len:6.5,dl:0,T:6,side:12,hov:.35,bob:.1},
 {pre:'Thresher_ARM',n:'Thresher',len:15,dl:1.4,T:8,side:0,hov:0,bob:0,hide:['Object_95']},   // Object_95 = cone do holofote (feixe), escondido
 {pre:'Scorpius_ARM',n:'Scorpius',len:3.2,dl:2.6,T:6.5,side:-11,hov:0,bob:0}];
(function(){
 if(document.getElementById('vh-css'))return;
 const css=document.createElement('style');css.id='vh-css';
 css.textContent='#vh-shop{position:fixed;top:92px;left:50%;transform:translate(-50%,-8px);min-width:230px;max-width:86vw;padding:10px 14px;background:rgba(10,12,18,.88);border:2px solid rgba(255,90,70,.55);border-radius:10px;color:#fff;font-family:Montserrat,system-ui,sans-serif;text-align:center;z-index:7;opacity:0;pointer-events:none;transition:opacity .18s,transform .18s}'+
 '#vh-shop.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}'+
 '#vh-shop .vs-t{font-weight:800;font-size:15px;letter-spacing:.6px}'+
 '#vh-shop .vs-s{font-size:11px;opacity:.65;margin-top:2px}'+
 '#vh-shop .vs-b{margin-top:8px;padding:10px 10px 12px;border:1px solid rgba(255,255,255,.22);border-radius:8px;background:rgba(255,255,255,.05)}'+
 '#vh-shop .vs-it{font-weight:800;font-size:14px}'+
 '#vh-shop .vs-id{font-size:11px;opacity:.75;margin:3px 0 8px;line-height:1.35}'+
 '#vh-shop .vs-buy{width:100%;padding:10px 8px;font:800 13px Montserrat,system-ui,sans-serif;color:#fff;background:linear-gradient(#ff8a3c,#e8590c);border:2px solid #05060a;border-radius:6px;cursor:pointer;touch-action:manipulation}'+
 '#vh-shop .vs-buy:disabled{background:#3a3d46;color:#aeb2bd;cursor:default}'+
 '#vh-shop .vs-buy.own{background:#1f6b3a;color:#fff}'+
 '#vh-shop .vs-k{font-size:10px;opacity:.6;margin-top:5px}'+
 'body.owm-cin-on #vh-shop{display:none!important}';
 document.head.appendChild(css);
})();
function vhLoad(){
 if(VH.promise)return VH.promise;
 VH.promise=new Promise((res,rej)=>{
  if(!THREE.GLTFLoader){rej(new Error('GLTFLoader indisponível'));return}
  const ok=g=>{try{
   g.scene.traverse(o=>{if(!o.isMesh)return;o.castShadow=false;o.receiveShadow=false;o.frustumCulled=false;   // malhas com esqueleto: sem culling (a caixa original não acompanha a pose)
    for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m&&m.transparent)m.depthWrite=false});
   VH.tpl=g.scene;res(g.scene)}catch(e){rej(e)}};
  const bad=e=>rej(e||new Error('falha ao ler os veículos'));
  const src=window.VEHICLES_GLTF;   // opcional: glTF embutido num vehicles-data.js; senão lê a pasta vehicles/
  if(src)new THREE.GLTFLoader().parse(typeof src==='string'?src:JSON.stringify(src),'',ok,bad);
  else new THREE.GLTFLoader().load('vehicles/scene.gltf',ok,undefined,bad);
 });
 VH.promise.catch(()=>{VH.promise=null});
 return VH.promise;
}
function vhFind(root,pre){let f=null;root.traverse(o=>{if(!f&&o.name&&o.name.indexOf(pre)===0)f=o});return f}
function vhBox(root){   // caixa do modelo JÁ com o esqueleto aplicado (a caixa da geometria sozinha não serve)
 root.updateMatrixWorld(true);const box=new THREE.Box3(),v=new THREE.Vector3();
 root.traverse(o=>{
  if(!o.isSkinnedMesh||!o.visible)return;
  o.skeleton.update();const pos=o.geometry.attributes.position;
  for(let i=0;i<pos.count;i+=2){
   if(o.applyBoneTransform){v.fromBufferAttribute(pos,i);o.applyBoneTransform(i,v)}else o.boneTransform(i,v);
   box.expandByPoint(v.applyMatrix4(o.matrixWorld));
  }
 });
 return box;
}
function vhMake(d){
 const src=vhFind(VH.tpl,d.pre);if(!src){console.warn('[OWM] veículo não achado no glTF:',d.pre);return null}
 const inner=fbClone(src);
 for(const h of d.hide||[]){const o=inner.getObjectByName(h);if(o)o.visible=false}
 const g=new THREE.Group();g.add(inner);g.updateMatrixWorld(true);
 const b=vhBox(inner),sz=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3()),s=d.len/Math.max(.01,sz.z);   // +Z = frente (faróis na frente, jatos atrás)
 inner.scale.setScalar(s);inner.position.set(-c.x*s,-b.min.y*s,-c.z*s);   // centro no chão, escala em metros
 g.rotation.order='YXZ';g.visible=false;scene.add(g);
 return{g,d,r:Math.max(sz.x,sz.z)*s/2+3.5,st:'wait',t:0,age:Math.random()*6,x:0,z:0,gy:0,yaw:0,roll:0,yawPrev:0,dT:0,gone:false};
}
function vhSpot(){   // área livre perto do jogador, grande o bastante p/ os 3 veículos
 for(const rad of[17,12,8]){const q=fbPlace(16,32,rad);if(q)return q}
 return[P.p.x-Math.sin(P.yaw)*14,P.p.z-Math.cos(P.yaw)*14];
}
function vhBegin(){
 STM.vh={ph:'load',t:0,stay:VH_STAY};STM.clr=true;STM.inter=VH_STAY;STM.vhMsg='Veículos chegando…';
 vhLoad().then(()=>{if(!STM.vh||STM.vh.ph!=='load'||!STM.on||!CAMB)return;vhLaunch()})
  .catch(e=>{VH.failed=true;console.error('[OWM] veículos:',e);toast('Não consegui carregar os veículos (pasta vehicles/ ao lado do index.html). '+(e&&e.message||''));vhFinish()});
}
function vhLaunch(){
 try{
  const sp=vhSpot(),cx=sp[0],cz=sp[1],cy=cambGround(cx,cz,P.p.y+.4);
  let fx=P.p.x-cx,fz=P.p.z-cz;const fl=Math.hypot(fx,fz)||1;fx/=fl;fz/=fl;const sx=fz,sz=-fx;   // f = direção até o jogador, s = lado
  const a0=Math.random()*6.2832,list=[];
  VH_PRESET.forEach((d,i)=>{
   const v=vhMake(d);if(!v)return;
   const x=cx+sx*d.side,z=cz+sz*d.side;let gy=cambGround(x,z,cy+.6);if(Math.abs(gy-cy)>1.2)gy=cy;
   const a=a0+i*2.1,far=85+i*12;
   v.x=x;v.z=z;v.gy=gy+d.hov;v.yaw=Math.atan2(fx,fz);v.yawPrev=v.yaw;   // pousam virados pro jogador
   v.p0={x:x+Math.cos(a)*far,y:gy+42+i*7,z:z+Math.sin(a)*far};          // começa longe e alto
   v.p1={x:x+Math.cos(a)*26,y:gy+17,z:z+Math.sin(a)*26};                 // curva de aproximação
   list.push(v);
  });
  if(!list.length){VH.failed=true;toast('Nenhum veículo encontrado no glTF.');vhFinish();return}
  VH.list=list;STM.vh.ph='in';STM.vh.t=0;
  toast('Veículos da Legião Vermelha! Chegue perto para abrir a loja.');
 }catch(e){VH.failed=true;console.error('[OWM] veículos:',e);vhFinish()}
}
function vhAng(a,b,k){let d=b-a;d=Math.atan2(Math.sin(d),Math.cos(d));return a+d*k}
function vhDust(v,dt,every,n){v.dT-=dt;if(v.dT>0)return;v.dT=every;const a=Math.random()*6.2832,r=v.d.len*.18;rbxDust({x:v.x+Math.cos(a)*r,y:v.gy-v.d.hov+.3,z:v.z+Math.sin(a)*r},n,0xb9b2a2)}
function vhStep(v,dt,t){
 const g=v.g,d=v.d;v.age+=dt;
 if(v.st==='ground'){g.position.set(v.x,v.gy+(d.bob?Math.sin(v.age*2)*d.bob:0),v.z);g.rotation.set(0,v.yaw,0,'YXZ');return}
 if(v.st==='out'){
  v.t+=dt;const k=v.t,dir=v.yaw+3.1416,ah=3.2*Math.pow(Math.max(0,k-1.2),2),y=v.gy+1.4*k*k;
  const yaw=vhAng(v.yaw,dir,Math.min(1,k/1.6));
  g.position.set(v.x+Math.sin(dir)*ah,y,v.z+Math.cos(dir)*ah);g.rotation.set(-Math.min(.5,k*.12),yaw,0,'YXZ');
  if(y-v.gy<8)vhDust(v,dt,.08,3);
  if(k>=5.5){g.visible=false;v.gone=true}
  return;
 }
 const e=t-d.dl;if(e<0)return;g.visible=true;
 let x,y,z,yaw,pitch,roll;
 if(e<d.T){
  const u=e/d.T,k=1-Math.pow(1-u,2.4),m=1-k,p0=v.p0,p1=v.p1,ex=v.x,ey=v.gy+VH_H,ez=v.z;
  x=m*m*p0.x+2*m*k*p1.x+k*k*ex;y=m*m*p0.y+2*m*k*p1.y+k*k*ey;z=m*m*p0.z+2*m*k*p1.z+k*k*ez;
  const dx=2*m*(p1.x-p0.x)+2*k*(ex-p1.x),dy=2*m*(p1.y-p0.y)+2*k*(ey-p1.y),dz=2*m*(p1.z-p0.z)+2*k*(ez-p1.z),hs=Math.hypot(dx,dz)||1;
  const w=Math.min(1,Math.max(0,(u-.7)/.3));
  yaw=vhAng(Math.atan2(dx,dz),v.yaw,w*w*(3-2*w));   // olha pra onde voa; no final vira pro jogador
  pitch=Math.max(-.5,Math.min(.5,-Math.atan(dy/hs)*.55))*(1-w*.9);
  const rate=vhAng(0,yaw-v.yawPrev,1)/Math.max(dt,.001);
  roll=v.roll+(-Math.max(-.6,Math.min(.6,rate*.5))*(1-w)-v.roll)*Math.min(1,dt*4);
  if(y-v.gy<10)vhDust(v,dt,.09,2);
 }else{
  const q=Math.min(1,(e-d.T)/VH_DESC),sm=q*q*(3-2*q);
  x=v.x;z=v.z;y=v.gy+VH_H*(1-sm);yaw=v.yaw;pitch=0;roll=v.roll*(1-sm);
  vhDust(v,dt,.06,4);
  if(q>=1){v.st='ground';if(Math.hypot(v.x-P.p.x,v.z-P.p.z)<45)addTrauma(d.len>10?.16:.07)}
 }
 v.roll=roll;v.yawPrev=yaw;g.position.set(x,y,z);g.rotation.set(pitch,yaw,roll,'YXZ');
}
function vhShopEl(){
 if(VH.shopEl)return VH.shopEl;
 const h=document.createElement('div');h.id='vh-shop';
 h.innerHTML='<div class="vs-t">🛒 LOJA</div><div class="vs-s" id="vs-name"></div><div class="vs-b"><div class="vs-it">🚀 Jetpack — '+JP.PRICE+' pontos</div><div class="vs-id">Voe segurando o botão, dash vira avanço de fogo e o pulo maior termina em pisão que machuca inimigos.</div><button type="button" class="vs-buy" id="vs-buy">Comprar</button>'+((typeof touch!=='undefined'&&touch)?'':'<div class="vs-k">ou tecle N</div>')+'</div>';
 document.body.appendChild(h);VH.shopEl=h;
 const bb=h.querySelector('#vs-buy');if(bb)bb.addEventListener('click',e=>{e.stopPropagation();jpBuy()});
 return h;
}
function vhShop(active){   // abre quando o jogador chega perto de um veículo pousado; fecha quando se afasta (com folga de 3 m pra não piscar)
 let best=null,bd=1e9;
 if(active)for(const v of VH.list){
  if(v.st!=='ground')continue;
  const d=Math.hypot(P.p.x-v.x,P.p.z-v.z);if(Math.abs(P.p.y-v.gy)<8&&d<bd){bd=d;best=v}
 }
 const on=!!best&&bd<best.r+(VH.shopV===best?3:0);
 const el=vhShopEl();
 if(on){if(VH.shopV!==best){VH.shopV=best;document.getElementById('vs-name').textContent=best.d.n}}else VH.shopV=null;
 el.classList.toggle('on',on);
 if(on)jpShopRender();   // só mexe no DOM se o estado do botão mudou
}
function vhUpdate(dt){
 const S=STM.vh;if(!S)return;
 if(S.ph==='load'){STM.vhMsg='Veículos chegando…';return}
 S.t+=dt;
 let landed=true,gone=true;
 for(const v of VH.list){vhStep(v,dt,S.t);if(v.st!=='ground')landed=false;if(!v.gone)gone=false}
 if(S.ph==='in'){
  STM.vhMsg='Veículos chegando…';
  if(landed){S.ph='stay';S.stay=VH_STAY}
 }else if(S.ph==='stay'){
  S.stay-=dt;STM.inter=Math.max(0,S.stay);
  STM.vhMsg='Loja aberta · os veículos saem em '+Math.max(1,Math.ceil(S.stay))+'s';
  if(S.stay<=0){S.ph='out';for(const v of VH.list){v.st='out';v.t=0}}
 }else if(S.ph==='out'){
  STM.vhMsg='Veículos partindo…';
  if(gone){vhFinish();return}
 }
 vhShop(S.ph==='in'||S.ph==='stay');
}
function vhReset(){
 for(const v of VH.list)scene.remove(v.g);
 VH.list.length=0;VH.shopV=null;if(VH.shopEl)VH.shopEl.classList.remove('on');
 STM.vh=null;STM.vhMsg='';
}
function vhFinish(){   // veículos sumiram -> agora sim a próxima onda (a do chefe)
 if(!STM.vh)return;
 vhReset();
 if(STM.on)strNextWave(STM.wave);
}
/* ---------- JETPACK ----------
   Modelo: jetpack/scene.gltf (CC-BY-4.0, Elite Big Speakerman, Sketchfab) ou window.JETPACK_GLTF (jetpack-data.js embutido).
   · Comprado na LOJA dos veículos (ondas 4, 9, 14...) por JP.PRICE pontos. Tudo ajustável no objeto JP (logo antes do DASH).
   · Voar: segurar o botão #bFly (celular) ou a tecla Y (PC). Combustível JP.FUEL; gasta JP.DRAIN/s e recarrega parado; ao zerar trava até encher.
   · Com jetpack: dash vira avanço sempre pra frente, pulo maior e pouso com PISÃO (dano em área, sem dano de queda).
   · Modelo nas costas: o módulo OWM.anim não está no game.js, então usamos o fallback (Group na cena seguindo P.p, girando com o corpo). */
const JPM={plate:false,tpl:null,promise:null,g:null,thrL:null,thrR:null,yaw:0,on:false,puff:0,warned:false,err:false,acc:[0,0]};
const JPUI={btn:null,bar:null,fill:null,txt:null,css:false,shopKey:'',pc:-1,lock:null,barOn:null,btnOn:null,place:0};
const _jw=[new THREE.Vector3(),new THREE.Vector3()];
function jpLoadFail(e){if(JPM.warned)return;JPM.warned=true;console.warn('[OWM] jetpack:',e);toast('Não consegui carregar o modelo do jetpack (pasta jetpack/ ao lado do index.html). O resto do jogo segue normal.')}
function jpLoad(){
 if(JPM.promise)return JPM.promise;
 JPM.promise=new Promise((res,rej)=>{
  try{
   if(!THREE.GLTFLoader){rej(new Error('GLTFLoader indisponível'));return}
   const ok=g=>{try{
    g.scene.traverse(o=>{if(!o.isMesh)return;o.castShadow=false;o.receiveShadow=false;o.frustumCulled=false});   // malhas com esqueleto: sem culling
    JPM.tpl=g.scene;res(g.scene)}catch(e){rej(e)}};
   const bad=e=>rej(e||new Error('falha ao ler o jetpack'));
   const src=window.JETPACK_GLTF;   // opcional: glTF embutido num jetpack-data.js; senão lê a pasta jetpack/
   if(src)new THREE.GLTFLoader().parse(typeof src==='string'?src:JSON.stringify(src),'',ok,bad);
   else new THREE.GLTFLoader().load('jetpack/scene.gltf',ok,undefined,bad);
  }catch(e){rej(e)}
 });
 JPM.promise.catch(()=>{JPM.promise=null});
 return JPM.promise;
}
/* monta o modelo: mede (com o esqueleto aplicado), acha o eixo longo dos tubos (= "para cima"), centraliza, escala pra JP.H metros e cria os bocais */
function jpBuild(){
 if(JPM.g||!JPM.tpl)return JPM.g;
 try{
  const inner=fbClone(JPM.tpl),pivot=new THREE.Group(),g=new THREE.Group();
  pivot.add(inner);g.add(pivot);g.visible=false;
  const skm=[];inner.traverse(o=>{if(o.isSkinnedMesh)skm.push(o)});
  if(!skm.length)throw new Error('o glTF do jetpack não tem malhas com esqueleto');
  let tubes=skm.filter(o=>/^Object_(70|73)$/.test(o.name));
  if(tubes.length<2)tubes=skm.slice(0,2);
  const V=()=>new THREE.Vector3();
  const boxOf=list=>{g.updateMatrixWorld(true);const keep=skm.map(o=>o.visible);skm.forEach(o=>{o.visible=list.indexOf(o)>=0});const b=vhBox(inner);skm.forEach((o,i)=>{o.visible=keep[i]});return b};
  const ts=boxOf(tubes).getSize(V());   // eixo mais longo dos tubos = eixo "para cima" (medido: Y neste arquivo; X/Z são tratados por segurança)
  if(ts.x>ts.y&&ts.x>=ts.z)pivot.rotation.z=Math.PI/2;else if(ts.z>ts.y&&ts.z>ts.x)pivot.rotation.x=-Math.PI/2;
  const all=boxOf(skm),sz=all.getSize(V()),c=all.getCenter(V()),s=JP.H/Math.max(.01,sz.y);
  const tb=tubes.map(t=>boxOf([t]));   // caixas dos tubos (antes de escalar)
  pivot.scale.setScalar(s);pivot.position.copy(c).multiplyScalar(-s);   // centro do conjunto na origem de g, escala em metros
  const anc=tb.map(b=>{const a=new THREE.Object3D();a.position.set(((b.min.x+b.max.x)/2-c.x)*s,(b.min.y-c.y)*s,((b.min.z+b.max.z)/2-c.z)*s);g.add(a);return a});
  anc.sort((a,b)=>a.position.x-b.position.x);JPM.thrL=anc[0]||null;JPM.thrR=anc[1]||anc[0]||null;   // -X = esquerda do jogador, +X = direita
  if(JPM.thrL)JPM.thrL.name='jpThrL';if(JPM.thrR)JPM.thrR.name='jpThrR';
  scene.add(g);JPM.g=g;g.updateMatrixWorld(true);return g;
 }catch(e){jpLoadFail(e);return null}
}
/* posições (mundo) dos dois bocais; sem modelo, aproxima pelas costas do jogador */
function jpNozzles(){
 const g=JPM.g;
 if(g&&JPM.thrL&&JPM.thrR){g.updateMatrixWorld(true);JPM.thrL.getWorldPosition(_jw[0]);JPM.thrR.getWorldPosition(_jw[1]);return _jw}
 const yw=JPM.yaw,bx=Math.sin(yw),bz=Math.cos(yw),rx=Math.cos(yw),rz=-Math.sin(yw);
 for(let i=0;i<2;i++){const sg=i?1:-1;_jw[i].set(P.p.x+bx*JP.BACK+rx*sg*.17,P.p.y+JP.UP-.3,P.p.z+bz*JP.BACK+rz*sg*.17)}
 return _jw;
}
/* chama: glow aditivo descendo + faísca ocasional + fumaça cinza. mul = taxa (1 = voo ~22/s por bocal; 4 = dash ~90/s) */
function jpFlame(dt,mul){
 if(RBX.live.length>350)return;
 const pal=RPAL.jp,dsh=dashT>0,bx=dsh?-dashDirX:0,bz=dsh?-dashDirZ:0,nz=jpNozzles();
 for(let i=0;i<2;i++){
  let a=JPM.acc[i]+dt*JP.FLAME*mul;const n=Math.min(5,Math.floor(a));a-=Math.floor(a);JPM.acc[i]=a;
  const p=nz[i];
  for(let k=0;k<n;k++){
   rbxAdd('glow',Math.random()<.45?pal.core:pal.st[1+(k&1)],p.x+R4()*.03,p.y,p.z+R4()*.03,R4()*.4+bx*(dsh?5:0),-(3+Math.random()*3)*(dsh?.5:1),R4()*.4+bz*(dsh?5:0),.25+Math.random()*.2,.35+Math.random()*.25,{drag:3});
   if(Math.random()<.18)rbxAdd('star',pal.st[(Math.random()*pal.st.length)|0],p.x,p.y-.05,p.z,R4()*1.2+bx*(dsh?4:0),-(2+Math.random()*3),R4()*1.2+bz*(dsh?4:0),.3+Math.random()*.25,.16+Math.random()*.14,{g:3,drag:2.5,spin:R4()*9});
   if(Math.random()<.3)rbxAdd('glow',0x8a8a8a,p.x+R4()*.05,p.y-.25,p.z+R4()*.05,R4()*.5+bx*(dsh?2:0),-(.4+Math.random()),R4()*.5+bz*(dsh?2:0),.55+Math.random()*.3,.5+Math.random()*.3,{norm:1,grow:1,drag:2,g:-1.2});   // fumaça
  }
 }
}
function jpPuff(){JPM.puff=.22}   // chama curta nos bocais ao pular
/* dash de FOGO (mesma estrutura do dash normal, paleta RPAL.jp) */
function jpDashBurst(){
 const bx=-dashDirX,bz=-dashDirZ,px=-dashDirZ,pz=dashDirX,pal=RPAL.jp,y=P.p.y+.9;
 rbxAdd('ring',pal.ring,P.p.x,P.p.y+.2,P.p.z,0,0,0,.3,2.2,{ring:1});
 if(tp3){rbxAdd('glow',pal.core,P.p.x,y,P.p.z,0,0,0,.18,1.6,{peak:.3});rbxAdd('star',pal.core,P.p.x,y,P.p.z,0,0,0,.2,1.3,{spin:5,peak:.3})}
 for(let i=0;i<10;i++){const sp=3+Math.random()*3.5,l=R4()*.9;rbxAdd('star',pal.st[i%pal.st.length],P.p.x,P.p.y+.3+Math.random()*1.3,P.p.z,(bx+px*l)*sp,Math.random()*1.2,(bz+pz*l)*sp,.3+Math.random()*.25,.22+Math.random()*.16,{g:3,drag:3.2,spin:R4()*9})}
 rbxDust({x:P.p.x,y:P.p.y+.1,z:P.p.z},3,0xb9b2a2);
}
function jpDashTrail(){
 const bx=-dashDirX,bz=-dashDirZ,px=-dashDirZ,pz=dashDirX,pal=RPAL.jp,o={x:P.p.x,y:P.p.y+.9,z:P.p.z};
 rbxAdd('glow',pal.core,o.x+bx*.35,o.y,o.z+bz*.35,bx*1.2,0,bz*1.2,.2,1.1,{peak:.3,drag:3});
 for(let i=0;i<3;i++){
  const side=R4()*.4,back=.2+Math.random()*.9,y=P.p.y+.25+Math.random()*1.4;
  rbxAdd('star',pal.st[i%pal.st.length],P.p.x+px*side+bx*back,y,P.p.z+pz*side+bz*back,bx*(1.5+Math.random()*2.2)+px*R4()*.8,R4()*.5,bz*(1.5+Math.random()*2.2)+pz*R4()*.8,.26+Math.random()*.2,.2+Math.random()*.2,{drag:3.4,spin:R4()*9});
 }
 for(let i=0;i<2;i++)rbxAdd('glow',pal.st[(i+1)%pal.st.length],P.p.x+px*R4()*.3+bx*.3,P.p.y+.2+Math.random()*1.2,P.p.z+pz*R4()*.3+bz*.3,bx*Math.random()*2+px*R4()*.6,Math.random()*.7,bz*Math.random()*2+pz*R4()*.6,.3+Math.random()*.2,.3,{drag:3});
}
/* física do voo (chamada dentro de physics, depois de calcular `swim`): devolve true se o jato está ligado neste quadro */
function jpPhysics(dt,swim){
 if(!JP.owned){JPM.on=false;return false}
 const can=!!JP.fly&&!JP.locked&&JP.fuel>0&&!swim&&!COIL.on&&!CIN.active;
 JPM.on=can;
 if(can){
  JP.fuel=Math.max(0,JP.fuel-JP.DRAIN*dt);
  if(JP.fuel<=0)JP.locked=true;   // acabou: trava até encher
  P.vel.y+=(JP.UP_V-P.vel.y)*(1-Math.exp(-dt*JP.UP_ACC));P.og=false;P.peak=P.p.y;
 }else{
  JP.fuel=Math.min(JP.FUEL,JP.fuel+(P.og?JP.REGEN_GROUND:JP.REGEN_AIR)*dt);
  if(JP.locked&&JP.fuel>=JP.FUEL){JP.locked=false}
 }
 return can;
}
/* pisão ao pousar de uma queda >= STOMP_MIN_FALL: dano em área + anel/estrelas/poeira/tremor */
function jpStomp(fd){
 if(CIN.active||COIL.on)return;
 const R=JP.STOMP_R,dmg=Math.min(JP.STOMP_DMG_MAX,JP.STOMP_DMG_BASE+fd*JP.STOMP_DMG_PER_M),px=P.p.x,pz=P.p.z;
 for(let i=0;i<scs.length;i++){
  const s=scs[i];if(!s||s.st==='dead'||s.fr||s.rm||s.bur||s.isStrider)continue;
  if(Math.hypot(s.x-px,s.z-pz)<R&&Math.abs(s.y-P.p.y)<6)scHurt(s,dmg,6,{x:px,z:pz});
 }
 for(const t of STR.list){
  if(!t||t.rm||t.hp<=0)continue;
  if(Math.hypot(t.x-px,t.z-pz)<R+1.6)strHurt(t,dmg);
 }
 shkRing(px,P.p.y+.1,pz,R,R/18,{K:{},fr:true,dmg:0,by:null});   // fr:true = não machuca o jogador (o dano já foi aplicado acima)
 rbxHit({x:px,y:P.p.y+.25,z:pz},RPAL.jp,{n:14,sp:7,size:.32,flash:1.5,ring:3.2,fin:true});
 rbxHit({x:px,y:P.p.y+.15,z:pz},RPAL.land,{n:10,sp:5.4,size:.3,flash:1.1,ring:2.2,fin:false});
 rbxDust({x:px,y:P.p.y+.15,z:pz},10);
 addTrauma(Math.min(.7,.25+fd*.06));
}
/* ---------- loja ---------- */
function jpShopRender(){   // só mexe no DOM quando o estado muda
 const btn=document.getElementById('vs-buy');if(!btn)return;
 const pts=Math.max(0,Math.floor((cur&&cur.pontos)||0));
 const key=JP.owned?'o':(pts>=JP.PRICE?'y':'n'+pts);
 if(key===JPUI.shopKey)return;JPUI.shopKey=key;
 if(JP.owned){btn.textContent='Equipado ✓';btn.disabled=true;btn.className='vs-buy own'}
 else if(pts>=JP.PRICE){btn.textContent='Comprar';btn.disabled=false;btn.className='vs-buy'}
 else{btn.textContent=pts+'/'+JP.PRICE;btn.disabled=true;btn.className='vs-buy'}
}
function jpBuy(){
 if(JP.owned||!VH.shopV||!cur||state!=='play')return false;
 const pts=Math.max(0,Math.floor(cur.pontos||0));
 if(pts<JP.PRICE){toast('Pontos insuficientes: '+pts+'/'+JP.PRICE);return false}
 lobbySetStats(null,pts-JP.PRICE);
 JP.owned=true;JP.fuel=JP.FUEL;JP.locked=false;JP.fly=false;JPUI.shopKey='';   // equipa
 jpLoad().then(()=>{if(JP.owned)jpBuild()}).catch(jpLoadFail);
 jpShopRender();toast('Jetpack comprado!');return true;
}
function jpReset(){   // nova partida / fim do modo: zera o jetpack (a posse só dura a partida, a menos que JP.PERSIST)
 if(!JP.PERSIST)JP.owned=false;
 JPM.plate=false;
 JP.fuel=JP.FUEL;JP.locked=false;JP.fly=false;JPM.on=false;JPM.puff=0;JPUI.shopKey='';
 if(JPM.g)JPM.g.visible=false;
 if(JPUI.btn){JPUI.btnOn=false;JPUI.btn.style.display='none';JPUI.btn.classList.remove('fly-on')}
 if(JPUI.bar){JPUI.barOn=false;JPUI.bar.classList.remove('on','lock')}
}
/* ---------- botão #bFly + barra de combustível ---------- */
function jpUiEnsure(){
 if(JPUI.btn)return;
 if(!JPUI.css){JPUI.css=true;const css=document.createElement('style');css.id='jp-css';
  css.textContent='#bFly{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;display:none}'+
   '#bFly.fly-on{filter:brightness(1.45);transform:scale(.94)}#bFly.dis{opacity:.45}'+
   '#jp-fuel{position:fixed;box-sizing:border-box;height:14px;width:104px;border:2px solid #05060a;border-radius:3px;overflow:hidden;background:linear-gradient(#1b1e26,#0c0e13);box-shadow:0 0 0 1px rgba(255,255,255,.14);pointer-events:none;z-index:6;opacity:0;transition:opacity .35s,box-shadow .2s,border-color .2s}'+
   '#jp-fuel.on{opacity:1}'+
   '#jp-fuel .jf-f{position:absolute;left:0;top:0;bottom:0;width:100%;background:linear-gradient(#ffb347,#e8590c);transition:width .12s}'+
   '#jp-fuel .jf-t{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;font:800 9px/1 Montserrat,system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000;letter-spacing:.3px}'+
   '#jp-fuel.lock{border-color:#ff2b2b;box-shadow:0 0 0 1px #ff2b2b,0 0 8px rgba(255,43,43,.7)}'+
   'body.lobby-mode #bFly,body.owm-cin-on #bFly,body.lobby-mode #jp-fuel,body.owm-cin-on #jp-fuel{display:none!important}';
  document.head.appendChild(css)}
 const m2=document.getElementById('bM2'),host=(m2&&m2.parentNode)||document.getElementById('hud')||document.body;
 const b=document.createElement('button');b.id='bFly';b.type='button';
 if(m2)b.className=m2.className.replace(/\b(alt|blocking|on|cooldown|active|pressed)\b/g,'').replace(/\s+/g,' ').trim();
 b.innerHTML='<span class="cmb-k">FLY</span><span class="cmb-d">🚀</span>';
 b.setAttribute('aria-label','Jetpack — segure para voar');
 const down=e=>{if(!JP.owned||state!=='play'||COIL.on)return;JP.fly=true;b.classList.add('fly-on');try{b.setPointerCapture(e.pointerId)}catch(_){}e.preventDefault()};
 const up=e=>{JP.fly=false;b.classList.remove('fly-on');try{b.releasePointerCapture(e.pointerId)}catch(_){}};
 b.addEventListener('pointerdown',down);
 for(const n of['pointerup','pointercancel','lostpointercapture'])b.addEventListener(n,up);
 b.addEventListener('contextmenu',e=>e.preventDefault());
 host.appendChild(b);
 const bar=document.createElement('div');bar.id='jp-fuel';
 bar.innerHTML='<div class="jf-f"></div><div class="jf-t"></div>';
 document.body.appendChild(bar);
 JPUI.btn=b;JPUI.bar=bar;JPUI.fill=bar.firstChild;JPUI.txt=bar.lastChild;JPUI.btnOn=false;JPUI.barOn=false;JPUI.pc=-1;JPUI.lock=null;
 addEventListener('resize',()=>{JPUI.place=0});
}
function jpPlace(r){   // botão logo ACIMA do #bM2 (mesmo pai, mesma forma de posicionamento) e barra acima do botão
 const m2=document.getElementById('bM2'),b=JPUI.btn,bar=JPUI.bar;if(!m2||!b||!r)return;
 const cs=getComputedStyle(m2),fixed=cs.position==='fixed';let ox=0,oy=0;
 b.style.position=fixed?'fixed':'absolute';
 if(!fixed){const op=b.offsetParent;if(op&&op!==document.body&&op!==document.documentElement){const o=op.getBoundingClientRect();ox=o.left+op.clientLeft-op.scrollLeft;oy=o.top+op.clientTop-op.scrollTop}}
 const gap=Math.max(6,r.height*.14),top=r.top-r.height-gap;
 b.style.width=r.width+'px';b.style.height=r.height+'px';b.style.right='auto';b.style.bottom='auto';b.style.margin='0';
 b.style.left=(r.left-ox)+'px';b.style.top=(top-oy)+'px';
 if(cs.zIndex&&cs.zIndex!=='auto')b.style.zIndex=cs.zIndex;
 const bw=bar.offsetWidth||104,bh=bar.offsetHeight||14;
 bar.style.left=Math.max(4,Math.min(innerWidth-bw-4,r.left+r.width/2-bw/2))+'px';bar.style.top=Math.max(4,top-bh-5)+'px';bar.style.bottom='auto';
}
function jpUiTick(){
 const bd=document.body.classList;
 const vis=JP.owned&&state==='play'&&!CIN.active&&!bd.contains('lobby-mode')&&!bd.contains('owm-cin-on');
 if(!JPUI.btn){if(!vis)return;jpUiEnsure()}
 const m2=document.getElementById('bM2'),r=m2?m2.getBoundingClientRect():null,hasM2=!!(r&&r.width>2&&r.height>2);
 const showBtn=vis&&hasM2;
 if(showBtn!==JPUI.btnOn){JPUI.btnOn=showBtn;JPUI.btn.style.display=showBtn?'':'none';JPUI.place=0;if(!showBtn)JPUI.btn.classList.remove('fly-on')}
 const showBar=vis&&(JPM.on||JP.fuel<JP.FUEL-.01||JP.locked);
 if(showBar!==JPUI.barOn){JPUI.barOn=showBar;JPUI.bar.classList.toggle('on',showBar);JPUI.place=0}
 if(vis&&JPUI.place--<=0){
  JPUI.place=25;
  if(hasM2)jpPlace(r);
  else{const bar=JPUI.bar;bar.style.left=Math.round(innerWidth/2-52)+'px';bar.style.top=Math.max(4,innerHeight-130)+'px';bar.style.bottom='auto'}   // PC: sem botão, barra embaixo no centro
 }
 if(JPUI.btnOn)JPUI.btn.classList.toggle('dis',JP.locked);
 const pc=Math.round(JP.fuel/JP.FUEL*100);
 if(pc!==JPUI.pc||JP.locked!==JPUI.lock){
  JPUI.pc=pc;JPUI.lock=JP.locked;JPUI.fill.style.width=Math.max(0,Math.min(100,pc))+'%';
  JPUI.txt.textContent=JP.locked?'RECARREGANDO':'🚀 '+pc+'%';JPUI.bar.classList.toggle('lock',!!JP.locked);
 }
}
/* modelo nas costas (3ª pessoa) + chamas + HUD; chamado todo quadro no tick */
function jpUpdateModel(dt){
 if(JP.owned&&!JPM.g&&JPM.tpl)jpBuild();
 let want=P.yaw;if(!S.shiftLock){const sp=Math.hypot(P.vel.x,P.vel.z);if(sp>.6)want=Math.atan2(-P.vel.x,-P.vel.z)}   // corpo vira pra onde anda (ou pra câmera com shift lock)
 JPM.yaw=vhAng(JPM.yaw,want,1-Math.exp(-dt*10));
 const g=JPM.g;if(!g)return;
 g.visible=!!JP.owned&&!!tp3&&!CIN.active;   // 1ª pessoa: escondido
 const yw=JPM.yaw;   // costas = oposto da frente (-sin yaw, -cos yaw)
 g.position.set(P.p.x+Math.sin(yw)*JP.BACK,P.p.y+JP.UP,P.p.z+Math.cos(yw)*JP.BACK);g.rotation.set(0,yw+JP.ROTY,0);
}
/* Baseplate: com a opção 'Jetpack no Baseplate' ligada (Configurações), o jetpack vem equipado de graça; ao sair do Baseplate ou desligar, é retirado */
function jpPlateSync(){
 const want=!!(S.jpPlate&&cur&&cur.biome==='testplate');
 if(want&&!JP.owned){JP.owned=true;JPM.plate=true;JP.fuel=JP.FUEL;JP.locked=false;JPUI.shopKey='';jpLoad().then(()=>{if(JP.owned)jpBuild()}).catch(jpLoadFail)}
 else if(!want&&JPM.plate){JPM.plate=false;JP.owned=false;JP.fly=false;JPM.on=false}
}
function jpUpdate(dt){
 try{
  jpPlateSync();
  jpUpdateModel(dt);
  if(JP.owned&&state==='play'&&!CIN.active&&!COIL.on){
   if(JPM.on)jpFlame(dt,1);
   if(dashT>0)jpFlame(dt,4);
   if(JPM.puff>0){JPM.puff-=dt;jpFlame(dt,3)}
  }
  jpUiTick();
 }catch(e){if(!JPM.err){JPM.err=true;console.error('[OWM] jetpack:',e)}}
}
function strNextWave(prev){
 let c=0;if(prev>0){c=Math.round(WV_CENT*(1+WV_CENT_GROW*(prev-1)));wvReward(c,0)}   // onda vencida = cents
 STM.wave++;STM.clr=false;STM.inter=0;const boss=STM.wave%5===0;STR.pending=boss?0:wvCount(STM.wave);STR.spawnT=.35;
 toast((prev?('Onda '+prev+' concluída! +'+c+' cent · '):'')+(boss?('CHEFE! Onda '+STM.wave):('Onda '+STM.wave)));
 if(boss)fbSpawnBossWave();else if(!CIN.far)strSpawnZombies()}

function strModeStart(){
 if(!CAMB||STM.on||CIN.active)return;
 toast('Carregando o Strider…');
 strLoad().then(()=>{
  if(!CAMB||STM.on||CIN.active)return;
  if(!cinWaveIntro())strModeBegin();   // com cutscene: a onda começa dentro dela
 }).catch(e=>{STR.promise=null;console.error('[OWM] strider:',e);toast('Não consegui carregar o Strider. '+(e&&e.message||''))});
}
function strModeBegin(){
 STM.on=true;STM.wave=0;STM.t=0;STM.clr=false;STM.inter=0;STM.hudA=STM.hudB=STM.hudC='';STR.pending=0;
 document.body.classList.add('wave-on');vhLoad().catch(()=>{});lobbySetStats(null,0);jpReset();jpLoad().catch(jpLoadFail);strNextWave();strHud();
}
function strShotDispose(s){scene.remove(s.h1);scene.remove(s.h2);s.h1.material.dispose();s.h2.material.dispose()}
function strReset(){
 cnReset();vhReset();lobbySetStats(null,0);jpReset();STM.on=false;STM.fbWait=false;STM.clr=false;STR.pending=0;
 for(const t of STR.list)strDispose(t);STR.list.length=0;
 for(const s of STR.shots)strShotDispose(s);STR.shots.length=0;
 document.body.classList.remove('wave-on');
}
function strModeStop(msg){strReset();if(msg)toast(msg)}
function strHurt(t,amt,raw){
 if(!t||t.hp<=0)return;
 t.hp=Math.max(0,t.hp-(raw?amt:amt*.92));t.flash=.14;strBar(t);
 if(t.hp<=0){if(STM.on)wvReward(0,WV_PTS_STR);t.dead=0;t.xT=0;t.boom=0;t.cd=99;t.charge=0;t.burst=0;t.quick=0;t.sT=-1;t.hl=-1;strStompAbort(t);t.skCd=99;for(const b of t.lb)b.bg.visible=b.fi.visible=false}
}
function strFire(t,m){
 const d=Math.hypot(P.p.x-m.x,P.p.z-m.z),lead=Math.min(.6,d/26)*.6;
 const tx=P.p.x+P.vel.x*lead,ty=P.p.y+1.1,tz=P.p.z+P.vel.z*lead;
 let dx=tx-m.x,dy=ty-m.y,dz=tz-m.z;const l=Math.hypot(dx,dy,dz)||1;dx/=l;dy/=l;dz/=l;const SP=26;
 const sm=c=>new THREE.Sprite(new THREE.SpriteMaterial({map:rbxTextures().glow,color:c,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
 const h1=sm(0x4aa8ff),h2=sm(0xffffff);h1.scale.set(2.4,2.4,1);h2.scale.set(1.1,1.1,1);h1.frustumCulled=h2.frustumCulled=false;h1.position.set(m.x,m.y,m.z);h2.position.copy(h1.position);scene.add(h1);scene.add(h2);
 STR.shots.push({x:m.x,y:m.y,z:m.z,vx:dx*SP,vy:dy*SP,vz:dz*SP,life:4,h1,h2,dmg:12+Math.max(0,STM.wave-1),tr:0});
 // clarão do cano: estrelas em leque pra frente + anel
 const hl=Math.hypot(dx,dz)||1,fx=dx/hl,fz=dz/hl;
 rbxHit(m,STR_PAL,{n:14,sp:8,size:.5,flash:3,ring:2.4,fin:false,dir:[fx,fz,-fz,fx,0,.25,1.6]});
 t.recoil=1;if(d<35)addTrauma(.1);
}
/* TIROS RÁPIDOS: bolinhas de plasma fracas, disparadas em rajada com um pouco de dispersão */
/* PERNAS: cada soco numa perna conta 1 golpe (barra de 3). Com 3 golpes na mesma perna o Strider cai e fica atordoado 3 s no chão.
   Os golpes de uma perna se perdem se ela ficar 4 s sem apanhar. O soco também continua tirando vida do Strider. */
function strLegHit(q,amt){
 const t=q.owner;if(!t||t.hp<=0)return;
 strHurt(t,amt);if(t.hp<=0||t.sT>=0)return;
 const i=q.leg;t.lh[i]++;t.lt[i]=4;
 if(t.lh[i]>=3)strStunStart(t,i);
}
/* PERNA ACERTADA (3 golpes na mesma perna): o Strider NÃO cai. Fica de pé, apoiado nas outras duas pernas (o corpo cede um pouco e o canhão pende),
   e a perna acertada sobe, dobra o joelho e TREME por 3 s (com fumaça e faíscas no joelho). Depois o tremor some e a perna desce de volta ao chão.
   Durante isso ele não anda nem atira. */
function strStunStart(t,leg){
 t.sT=0;t.hl=leg;t.charge=0;t.quick=0;t.burst=0;t.lh=[0,0,0];t.lt=[0,0,0];t.smk=0;t.land=0;strStompAbort(t);
 for(let i=0;i<3;i++)if(t.sw[i]>=0){t.sw[i]=-1;t.fg[i]=sgGround(t,t.fx[i],t.fz[i])}   // pé que estava no ar pousa onde está
 for(const b of t.lb)b.bg.visible=b.fi.visible=false;
 const f=t.fw[leg];rbxHit({x:f[0],y:f[1]+.4,z:f[2]},STR_PAL,{n:10,sp:6,size:.4,flash:2.2,ring:3,fin:false});   // faísca do golpe na perna
 if(Math.hypot(P.p.x-t.x,P.p.z-t.z)<40)addTrauma(.2);
}
function strStun(t,dt){
 const T=STR.tpl,F=.35,D=3,Rz=.75,h=t.hl;t.sT+=dt;const u=t.sT;
 let up,tr;   // up = quão levantada está a perna acertada (0..1,1); tr = intensidade do tremor (0..1)
 if(u<F){const k=u/F-1;up=1+2.7*k*k*k+1.7*k*k;tr=u/F}   // sobe rápido com um pequeno excesso (reação ao golpe)
 else if(u<F+D){up=1;tr=.8+.2*Math.sin(u*5.1)}
 else{const k=Math.min(1,(u-F-D)/Rz),s=k*k*(3-2*k);up=1-s;tr=1-s}
 if(t.flash>0){t.flash-=dt;t.mat.emissive.setHex(t.flash>0?0x2260d8:0)}
 const w=u*6.2832;
 t.fy[h]=1.4*up;   // a perna sobe e o joelho dobra (IK); o pé fica no mesmo lugar em x/z
 t.jx[h]=tr*.3*(Math.sin(w*17)*.6+Math.sin(w*23+1.1)*.4);t.jz[h]=tr*.3*(Math.sin(w*19+2.3)*.6+Math.sin(w*29+.4)*.4);t.jy[h]=tr*.12*Math.sin(w*21+.7);   // tremor
 for(let i=0;i<3;i++)if(i!==h){t.fy[i]*=Math.exp(-dt*9);t.jx[i]=t.jy[i]=t.jz[i]=0}   // as outras pernas seguram o corpo
 t.vx*=Math.exp(-dt*5);t.vz*=Math.exp(-dt*5);t.cr=-.5*Math.min(1,up);t.ar=.06*Math.min(1,up);t.ac=0;
 t.jr=tr*.006*Math.sin(w*13);t.jc=tr*.008*Math.sin(w*11+.5);   // o tremor passa um pouco pro corpo
 sgAttitude(t,dt);sgPose(t,dt);
 t.cg.rotation.x+=(up*.3+tr*.015*Math.sin(w*15)-t.cg.rotation.x)*Math.min(1,dt*8);t.recoil=Math.max(0,t.recoil-dt*3.5);t.cg.position.z=T.cPivot.z-t.recoil*.7;t.g.updateMatrixWorld(true);
 const by=t.by+11.6;t.bg.position.set(t.x,by,t.z);t.fi.position.set(t.x,by,t.z);
 t.smk-=dt;if(t.smk<=0&&u<F+D){t.smk=.2;const k=t.kw[h],f=t.fw[h];   // fumaça no joelho machucado + faíscas no pé
  rbxAdd('glow',0x2a2a2e,k[0]+R4()*.4,k[1]+R4()*.4,k[2]+R4()*.4,R4()*.6,1.4,R4()*.6,1.2,2.4,{norm:1,grow:1,drag:1.5});
  if(Math.random()<.6)rbxAdd('glow',0xffa040,f[0]+R4()*.3,f[1]+.3+R4()*.3,f[2]+R4()*.3,R4()*1.5,1.5,R4()*1.5,.4,.45,{g:4,drag:2});
  if(Math.random()<.4)rbxAdd('star',0xbfe3ff,k[0],k[1],k[2],R4()*3,1+Math.random()*2,R4()*3,.3,.35,{g:6,drag:1.5,spin:R4()*8})}
 if(!t.land&&u>=F+D+Rz*.9){t.land=1;const f=t.fw[h],o={x:f[0],y:t.fg[h]+.3,z:f[2]};rbxDust(o,6,0x8fa8c8);rbxAdd('ring',0x9fd4ff,o.x,o.y,o.z,0,0,0,.5,7,{ring:1});t.dv-=1.2;if(Math.hypot(P.p.x-f[0],P.p.z-f[2])<45)addTrauma(.15)}   // a perna volta a apoiar
 if(u>=F+D+Rz){t.sT=-1;t.hl=-1;t.cd=1.2+Math.random();t.vx=t.vz=0;t.fy[h]=0;t.jx[h]=t.jy[h]=t.jz[h]=0;t.cr=0;t.ar=t.ac=0;t.jr=t.jc=0;t.skCd=Math.max(t.skCd,1.5)}
}
/* ---------- PISÃO do Strider ----------
   Quando o jogador chega perto (SKS.RANGE) e a skill está pronta: ele para, assenta as pernas, LEVANTA a perna da frente (aviso: anel laranja no chão com o
   raio do golpe + brilho no pé), segura um instante e BATE o pé no chão. O impacto solta uma onda de choque (mesma do pisão do zumbi) que só acerta quem
   está no chão: pular ou usar o dash (Q) desvia. Se 3 golpes derrubarem a perna dele no meio do pisão, a skill é cancelada. */
function strStompStart(t){t.sk=1;t.skT=0;const cy=Math.cos(t.yaw),sy=Math.sin(t.yaw),dx=P.p.x-t.x,dz=P.p.z-t.z,l=Math.hypot(dx,dz)||1,lx=(cy*dx-sy*dz)/l,lz=(sy*dx+cy*dz)/l;
 let best=0,bs=-9;for(let i=0;i<3;i++){const L=STR.tpl.leg[i],s=(L.hx*lx+L.hz*lz)/(Math.hypot(L.hx,L.hz)||1)+Math.random()*.15;if(s>bs){bs=s;best=i}}   // perna mais virada pro jogador
 t.sj=best}
function strStompAbort(t){if(t.sk>0){t.sk=0;t.skCd=5+Math.random()*3;if(t.mk)t.mk.visible=false}}
function strMark(t,x,g,z,op){   // anel de aviso no chão com o raio da onda de choque
 if(!t.mk){if(!STR.mkG)STR.mkG=new THREE.RingGeometry(.9,1,72).rotateX(-Math.PI/2);t.mk=new THREE.Mesh(STR.mkG,new THREE.MeshBasicMaterial({color:0xff6a20,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,fog:false}));t.mk.renderOrder=5;t.mk.frustumCulled=false;scene.add(t.mk)}
 const m=t.mk;m.visible=true;m.position.set(x,g+.1,z);m.scale.set(SKS.R,1,SKS.R);m.material.opacity=op;
}
function strStompHit(t){
 const j=t.sj,x=t.fx[j],z=t.fz[j],g=sgGround(t,x,z);t.fg[j]=g;t.fy[j]=0;t.jx[j]=t.jy[j]=t.jz[j]=0;
 const dmg=Math.min(38,14+2*Math.max(0,STM.wave-1)),o={x,y:g+.3,z};
 shkRing(x,g+.1,z,SKS.R,SKS.R/SKS.SPD,{K:SKS.K,fr:false,dmg,by:null});   // onda de choque (dano em quem está no chão)
 rbxHit(o,RPAL.land,{n:16,sp:7,size:.4,flash:2.6,ring:0,fin:false});rbxDust(o,10,0xb9b2a2);rbxAdd('ring',0xffc080,x,g+.25,z,0,0,0,.6,10,{ring:1});
 for(let i=0;i<14;i++){const a=i/14*6.2832+Math.random()*.4,v=3+Math.random()*2.5;rbxAdd('glow',0xc9bfa8,x+Math.cos(a)*.8,g+.2,z+Math.sin(a)*.8,Math.cos(a)*v,.6+Math.random()*.8,Math.sin(a)*v,.6,.9,{norm:1,grow:1,drag:2.2})}
 addTrauma(.05+.45*Math.max(0,1-Math.hypot(P.p.x-x,P.p.z-z)/38));t.dv-=2.4;
}
function strStomp(t,dt){
 const S=SKS,j=t.sj;t.skT+=dt;
 if(t.sk===1){   // espera as pernas terminarem o passo e então começa
  if(t.sw[0]<0&&t.sw[1]<0&&t.sw[2]<0){
   const dx=P.p.x-t.x,dz=P.p.z-t.z,l=Math.hypot(dx,dz)||1,h=sgHome(t,j,t.x,t.z,t.yaw);
   t.f0x=t.fx[j];t.f0z=t.fz[j];t.k1x=h[0]+dx/l*1.4;t.k1z=h[1]+dz/l*1.4;t.k1g=sgGround(t,t.k1x,t.k1z);t.sk=2;t.skT=0;t.tk=0}
  else if(t.skT>1.2)strStompAbort(t);   // segurança
  return;
 }
 if(t.sk===2){   // sobe a perna (aviso)
  const u=Math.min(1,t.skT/S.WIND),e=1-Math.pow(1-u,3),m=u*u*(3-2*u);
  t.fy[j]=S.H*e;t.fx[j]=t.f0x+(t.k1x-t.f0x)*m;t.fz[j]=t.f0z+(t.k1z-t.f0z)*m;t.cr=-.3*m;
  strMark(t,t.k1x,t.k1g,t.k1z,.1+.4*u);
  t.tk-=dt;if(t.tk<=0){t.tk=.22;rbxAdd('ring',0xff8a3a,t.k1x,t.k1g+.2,t.k1z,0,0,0,.5,6,{ring:1})}
  const f=t.fw[j];rbxAdd('glow',0xff9a4a,f[0],f[1]+.3,f[2],0,0,0,.12,.8+u*2,{peak:.5});
  if(t.skT>=S.WIND){t.sk=3;t.skT=0}
 }else if(t.sk===3){   // segura no alto, tremendo
  const w=t.skT*6.2832;t.fy[j]=S.H;t.jx[j]=.08*Math.sin(w*14);t.jz[j]=.08*Math.sin(w*17+1);t.jy[j]=.08*Math.sin(w*19);t.cr=-.3;
  strMark(t,t.k1x,t.k1g,t.k1z,.35+.25*Math.sin(w*5));
  const f=t.fw[j];rbxAdd('glow',0xffc080,f[0],f[1]+.3,f[2],0,0,0,.12,2.8,{peak:.5});
  if(t.skT>=S.HOLD){t.sk=4;t.skT=0;t.jx[j]=t.jy[j]=t.jz[j]=0}
 }else if(t.sk===4){   // desce rápido
  const u=Math.min(1,t.skT/S.SLAM);t.fy[j]=S.H*(1-u*u);t.cr=-.3-.25*u;strMark(t,t.k1x,t.k1g,t.k1z,.6);
  if(t.skT>=S.SLAM){strStompHit(t);t.sk=5;t.skT=0}
 }else if(t.sk===5){   // recupera
  const u=Math.min(1,t.skT/S.REC);t.fy[j]=0;t.cr=-.3*(1-u);if(t.mk)t.mk.material.opacity=.5*(1-u);
  if(t.skT>=S.REC){t.sk=0;t.skCd=Math.max(5,9-.4*STM.wave)+Math.random()*3;t.cr=0;if(t.mk)t.mk.visible=false;t.cd=Math.max(t.cd,.8)}
 }
}

function strFireQuick(t,m){
 const d=Math.hypot(P.p.x-m.x,P.p.z-m.z),lead=Math.min(.6,d/34)*.6;
 const tx=P.p.x+P.vel.x*lead+R4()*1.2,ty=P.p.y+1.1+R4()*.7,tz=P.p.z+P.vel.z*lead+R4()*1.2;
 let dx=tx-m.x,dy=ty-m.y,dz=tz-m.z;const l=Math.hypot(dx,dy,dz)||1;dx/=l;dy/=l;dz/=l;const SP=36;
 const sm=c=>new THREE.Sprite(new THREE.SpriteMaterial({map:rbxTextures().glow,color:c,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
 const h1=sm(0x4aa8ff),h2=sm(0xffffff);h1.scale.set(1,1,1);h2.scale.set(.45,.45,1);h1.frustumCulled=h2.frustumCulled=false;h1.position.set(m.x,m.y,m.z);h2.position.copy(h1.position);scene.add(h1);scene.add(h2);
 STR.shots.push({x:m.x,y:m.y,z:m.z,vx:dx*SP,vy:dy*SP,vz:dz*SP,life:3,h1,h2,dmg:3+Math.floor(Math.max(0,STM.wave-1)/3),tr:0,fast:1});
 rbxAdd('glow',0x6fb6ff,m.x,m.y,m.z,0,0,0,.1,1.5,{peak:.3});
 t.recoil=.55;if(d<35)addTrauma(.03);
}
/* explosão de plasma laranja + fumaça. k = tamanho (1 = tiro grande, ~.4 = tiro rápido, >1 = morte do Strider) */
function strBoom(o,k){
 const R=(a,b)=>a+Math.random()*(b-a),sm=k<.6,q=Math.sqrt(k);
 const FC=[0xff9a2a,0xff6a12,0xffc04a,0xff4a0a],SC=[0x1f1f22,0x34343a,0x4c4a48,0x6a6660];
 rbxAdd('glow',0xfff0c8,o.x,o.y,o.z,0,0,0,.16,5*k,{peak:.3});                 // clarão branco-amarelado
 rbxAdd('glow',0xff8a2a,o.x,o.y,o.z,0,0,0,.3,8*k,{peak:.35});                 // halo laranja
 if(!sm)rbxAdd('ring',0xff7a1a,o.x,o.y,o.z,0,0,0,.36,7*k,{ring:1});           // onda de choque
 const nf=sm?3:Math.round(8+3*k),ns=sm?3:Math.round(7+3*k),ne=sm?2:Math.round(5+2*k);
 for(let i=0;i<nf;i++){const u=R4(),a=Math.random()*6.283,r=Math.sqrt(1-u*u),sp=R(1.5,5.5)*q;   // bolas de fogo/plasma
  rbxAdd('glow',FC[i%4],o.x+R4()*.2*k,o.y+R4()*.2*k,o.z+R4()*.2*k,r*Math.cos(a)*sp,u*sp*.8+.8,r*Math.sin(a)*sp,R(.35,.65),R(2,3.6)*k+.4,{grow:1,drag:3.2})}
 for(let i=0;i<ns;i++){const a=Math.random()*6.283,sp=R(.4,2.4)*q;                              // fumaça escura subindo
  rbxAdd('glow',SC[i%4],o.x+R4()*.3*k,o.y+R4()*.2*k,o.z+R4()*.3*k,Math.cos(a)*sp,R(1,3.2),Math.sin(a)*sp,R(.9,1.7)*(.7+.3*Math.min(k,1.5)),R(2.6,4.6)*k+.6,{norm:1,grow:1,drag:1.6})}
 for(let i=0;i<ne;i++){const a=Math.random()*6.283,sp=R(2,7)*q;                                 // brasas
  rbxAdd('glow',0xffa040,o.x,o.y,o.z,Math.cos(a)*sp,R(1.5,5)*q,Math.sin(a)*sp,R(.4,.8),R(.18,.34)*(.6+.4*Math.min(k,1.5)),{g:6,drag:2})}
}
function strExplode(s){
 const o={x:s.x,y:s.y,z:s.z};
 strBoom(o,s.fast?.38:1);
 const d=Math.hypot(P.p.x-o.x,P.p.y+1-o.y,P.p.z-o.z);
 if(d<(s.fast?1.7:2.6))hurt(s.dmg*(d<1.3?1:.6),false,'Um Strider te matou!');
 if(d<28)addTrauma((.1+.3*(1-d/28))*(s.fast?.25:1));
}
function strShots(dt){
 for(let i=STR.shots.length-1;i>=0;i--){
  const s=STR.shots[i];s.life-=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;
  s.h1.position.set(s.x,s.y,s.z);s.h2.position.set(s.x,s.y,s.z);
  const pulse=1+Math.sin(performance.now()*.03)*.12,b0=s.fast?1:2.4;s.h1.scale.set(b0*pulse,b0*pulse,1);
  s.tr-=dt;if(s.tr<=0){s.tr=s.fast?.07:.035;rbxAdd('glow',0x3d8bff,s.x+R4()*.12,s.y+R4()*.12,s.z+R4()*.12,R4()*.5,R4()*.5,R4()*.5,.3,s.fast?.35:.7,{drag:3});if(!s.fast&&Math.random()<.5)rbxAdd('star',0xbfe3ff,s.x,s.y,s.z,R4()*1.5,R4()*1.5,R4()*1.5,.2,.35,{spin:R4()*8})}
  const dx=P.p.x-s.x,dy=P.p.y+1-s.y,dz=P.p.z-s.z,hitP=dx*dx+dy*dy+dz*dz<1.4;
  const hitW=!hitP&&(s.y<cambGround(s.x,s.z,s.y+.6)+.15||cambHit(s.x,s.y-.9,s.z)||s.life<=0||s.y<CAMB_Y-60);
  if(hitP||hitW){strExplode(s);strShotDispose(s);STR.shots[i]=STR.shots[STR.shots.length-1];STR.shots.pop()}
 }
}
function strDead(t,dt){
 t.dead+=dt;const u=t.dead,e=Math.min(1,u/1.7);
 t.xT-=dt;
 if(t.xT<=0&&u<1.7){t.xT=.18;const o={x:t.x+R4()*2.2,y:t.by+6+Math.random()*4,z:t.z+R4()*2.2};strBoom(o,.75)}
 // desmorona: os pés ficam onde estão, o corpo desce (os joelhos dobram sozinhos pela IK) e tomba um pouco pra frente
 for(let i=0;i<3;i++){t.fy[i]*=Math.exp(-dt*8);t.jx[i]=t.jy[i]=t.jz[i]=0;t.sw[i]=-1}
 t.vx=t.vz=0;t.cr=-4.2*e*e;t.rx+=(e*.3-t.rx)*Math.min(1,dt*3);t.rz=Math.sin(u*30)*.02*(1-e);t.jr=t.jc=0;
 sgPose(t,dt);
 if(u>=1.8&&!t.boom){t.boom=1;const o={x:t.x,y:t.by+5,z:t.z};strBoom(o,2.6);addTrauma(.35);t.g.visible=false;t.bg.visible=false;t.fi.visible=false;if(Math.random()<CN.DROP)cnDrop(t.x+R4()*1.5,t.gy,t.z+R4()*1.5)}
 if(u>2.4)t.rm=1;
}
function strTick(t,dt){
 if(t.hp<=0){strDead(t,dt);return}
 if(t.sT>=0){strStun(t,dt);return}
 const T=STR.tpl;t.age+=dt;t.ar=t.ac=0;t.jr=t.jc=0;
 if(t.flash>0){t.flash-=dt;t.mat.emissive.setHex(t.flash>0?0x2260d8:0)}
 const dx=P.p.x-t.x,dz=P.p.z-t.z,dist=Math.hypot(dx,dz)||1;
 let de=Math.atan2(dx,dz)-t.yaw;de=Math.atan2(Math.sin(de),Math.cos(de));
 const turn=t.sk>=4?0:t.sk>0?.6:t.charge>0?.5:t.burst>0?.8:1.1,dyaw=Math.max(-turn*dt,Math.min(turn*dt,de));t.yaw+=dyaw;
 const fx=Math.sin(t.yaw),fz=Math.cos(t.yaw);let sp=0,mx=0,mz=0;
 if(t.sk===0)t.skCd-=dt;
 const hunt=t.sk===0&&t.skCd<=0&&dist>SKS.RANGE-.7;   // pisão pronto: chega mais perto do jogador
 if(t.sk>0||t.charge>0||t.burst>0)sp=0;
 else if(hunt){sp=t.sp0*.85;mx=fx;mz=fz}
 else if(dist>22){sp=t.sp0;mx=fx;mz=fz}
 else if(dist<11){sp=t.sp0*.65;mx=-fx;mz=-fz}
 else{sp=t.sp0*.55;mx=fz*t.orb;mz=-fx*t.orb;t.orbT-=dt;if(t.orbT<=0){t.orb=-t.orb;t.orbT=3+Math.random()*4}}
 const ox=t.x,oz=t.z;
 if(sp>0){
  const nx=t.x+mx*sp*dt,nz=t.z+mz*sp*dt;let blk=false;
  if(strFree(t,nx,t.z))t.x=nx;else blk=true;
  if(strFree(t,t.x,nz))t.z=nz;else blk=true;
  if(blk&&dist>=11&&dist<=22)t.orb=-t.orb;   // bateu numa parede enquanto circulava: inverte o lado
 }
 for(const o of STR.list){if(o===t||o.hp<=0)continue;const ex=t.x-o.x,ez=t.z-o.z,ed=Math.hypot(ex,ez);if(ed<8&&ed>.01){const pu=(8-ed)*.6*dt;if(strFree(t,t.x+ex/ed*pu,t.z))t.x+=ex/ed*pu;if(strFree(t,t.x,t.z+ez/ed*pu))t.z+=ez/ed*pu}}
 const gnd=cambGround(t.x,t.z,t.gy+.5);if(gnd>CAMB_VOID+1)t.gy+=(gnd-t.gy)*Math.min(1,dt*8);
 // pisão: começa quando o jogador está no alcance da onda, de frente, e a skill está pronta
 if(t.sk===0&&t.skCd<=0&&t.charge<=0&&t.burst<=0&&dist<SKS.RANGE&&dist>2.5&&Math.abs(de)<.6&&Math.random()<dt*1.6)strStompStart(t);
 // andar (passos com IK) + pisão + pose
 sgWalk(t,dt,(t.x-ox)/dt,(t.z-oz)/dt,dyaw/dt);
 if(t.sk>0)strStomp(t,dt);
 sgAttitude(t,dt);sgPose(t,dt);
 // canhão: levanta/abaixa pra mirar; recuo depois do tiro
 const aimY=P.p.y+1.2,pitch=Math.max(-.6,Math.min(.6,Math.atan2(aimY-(t.by+T.cPivot.y),dist)));
 t.cg.rotation.x+=(-pitch-t.cg.rotation.x)*Math.min(1,dt*6);t.recoil=Math.max(0,t.recoil-dt*3.5);t.cg.position.z=T.cPivot.z-t.recoil*.7;
 t.g.updateMatrixWorld(true);
 // boca do canhão no mundo (os pés = alvos do soco já foram calculados em sgPose)
 const m=STR.v.copy(T.muzzle).applyMatrix4(t.cg.matrixWorld);
 // barras das pernas: aparecem sobre a perna que apanhou (enchem 1/3 por golpe) e somem se ela ficar 4 s sem apanhar
 for(let i=0;i<3;i++){const b=t.lb[i],q=t.prox[i];if(t.lt[i]>0){t.lt[i]-=dt;if(t.lt[i]<=0)t.lh[i]=0}
  const vis=t.lh[i]>0;b.bg.visible=b.fi.visible=vis;
  if(vis){const r=t.lh[i]/3,y=q.y+1.9;b.bg.position.set(q.x,y,q.z);b.fi.position.set(q.x,y,q.z);b.fi.scale.x=1.7*r;b.fi.center.x=.5/r}}
 // barra de vida acima do corpo
 const by=t.by+11.6;t.bg.position.set(t.x,by,t.z);t.fi.position.set(t.x,by,t.z);
 // disparo: mira → carrega → atira. Dois ataques: TIRO GRANDE (carrega 0,7 s, 1 bola forte) ou RAJADA (carrega 0,4 s, vários tiros rápidos e fracos)
 t.cd-=dt;
 if(t.charge>0){
  const W=t.quick?.4:.7;t.charge-=dt;const u=1-t.charge/W;
  rbxAdd('glow',0x6fb6ff,m.x,m.y,m.z,0,0,0,.12,.5+u*1.8,{peak:.5});
  if(Math.random()<.6){const a=Math.random()*6.2832,r=1.4*(1-u)+.3;rbxAdd('star',0xbfe3ff,m.x+Math.cos(a)*r,m.y+Math.sin(a)*r,m.z,-Math.cos(a)*r*5,-Math.sin(a)*r*5,0,.2,.3,{spin:R4()*8})}   // faíscas convergindo pro cano
  if(t.charge<=0){
   if(t.quick){t.quick=0;t.burst=10+Math.floor(Math.random()*5)+Math.min(6,STM.wave);t.bT=0}
   else{const mm={x:m.x,y:m.y,z:m.z};strFire(t,mm);t.cd=Math.max(1.6,3.6-.25*STM.wave)+Math.random()*1.4}
  }
 }else if(t.burst>0){
  t.bT-=dt;
  if(t.bT<=0){t.bT=.085;t.burst--;strFireQuick(t,{x:m.x,y:m.y,z:m.z});if(t.burst<=0)t.cd=Math.max(1.8,3.8-.25*STM.wave)+Math.random()*1.4}
 }else if(t.sk===0&&t.cd<=0&&dist<48&&dist>5&&Math.abs(de)<.35&&strLOS(m.x,m.y,m.z,P.p.x,P.p.y+1.1,P.p.z)){
  if(dist<38&&Math.random()<.4+Math.min(.2,STM.wave*.03)){t.quick=1;t.charge=.4}else t.charge=.7;
 }
}
function strUpdate(dt){
 if(!STM.on&&!STR.list.length&&!STR.shots.length)return;
 if(dt>.1)dt=.1;
 if(STM.on){
  STM.t+=dt;
  let alive=0;for(const t of STR.list)if(t.hp>0)alive++;
  if(STR.pending>0&&alive<WV_ALIVE){STR.spawnT-=dt;if(STR.spawnT<=0){strSpawnOne();STR.pending--;alive++;STR.spawnT=1.5}}   // só repõe quando há menos de WV_ALIVE vivos
  if(STR.pending===0&&alive===0&&!fbBossAlive()){   // onda acabou
   if(STM.vh)vhUpdate(dt);                                   // veículos aí: a próxima onda só vem quando eles sumirem
   else if(STM.wave%5===4&&!VH.failed)vhBegin();             // onda antes do chefe (4, 9, 14...): chegam os veículos
   else strNextWave(STM.wave);                               // senão a próxima começa NA HORA (sem intervalo)
  }
 }
 for(let i=STR.list.length-1;i>=0;i--){const t=STR.list[i];strTick(t,dt);if(t.rm){strDispose(t);STR.list.splice(i,1)}}
 strShots(dt);strHud();
}


/* ---------- CANHÃO DO STRIDER ----------
   Cada Strider tem 10% de chance de largar o canhão ao morrer. [F] perto dele pega; carregando, aparece um fantasma à frente e [F] coloca no chão.
   Torre colocada: AUTOMÁTICA por padrão (mira o inimigo mais próximo com linha de visão: Strider, zumbi etc. e escolhe sozinha entre tiro grande e rajada).
   [F] perto dela = operar na mão: o ataque (clique / botão de ataque) atira o tipo escolhido; [B] troca TIRO GRANDE ↔ RÁPIDO; [H] liga/desliga o automático;
   [J] recolhe (ou larga, se estiver carregando). Os botões na tela fazem o mesmo (celular). Os tiros da torre não machucam o jogador. */
(function(){
 if(document.getElementById('cn-css'))return;
 const css=document.createElement('style');css.id='cn-css';
 css.textContent='#cn-ui{display:none;position:fixed;left:50%;bottom:132px;transform:translateX(-50%);gap:8px;z-index:7;flex-wrap:wrap;justify-content:center;max-width:92vw}'+
 '#cn-ui.on{display:flex}'+
 '#cn-ui button{pointer-events:auto;font:800 13px Montserrat,system-ui,sans-serif;color:#fff;background:rgba(10,12,18,.8);border:2px solid rgba(143,208,255,.45);border-radius:10px;padding:9px 14px;cursor:pointer;text-shadow:0 1px 3px #000}'+
 '#cn-ui button.hot{border-color:#ffa030;color:#ffd9a0}';
 document.head.appendChild(css);
})();
function cnSc(){return 2.8/(STR.tpl.muzzle.length()||1)}
function cnBuild(ghost){
 const T=STR.tpl;if(!CN.geo)CN.geo={base:new THREE.CylinderGeometry(.75,.95,.5,14),post:new THREE.CylinderGeometry(.28,.34,.7,10)};
 const bm=new THREE.MeshStandardMaterial({color:0x3a3f48,metalness:.5,roughness:.55}),cm=T.mat.clone();cm.emissive=new THREE.Color(0x000000);
 if(ghost){bm.transparent=cm.transparent=true;bm.opacity=cm.opacity=.55}
 const g=new THREE.Group(),base=new THREE.Mesh(CN.geo.base,bm),post=new THREE.Mesh(CN.geo.post,bm),head=new THREE.Group(),cg=new THREE.Group();
 base.position.y=.25;post.position.y=.85;head.position.y=1.25;head.add(cg);
 const can=new THREE.Mesh(T.geo.cannon,cm);can.scale.setScalar(cnSc());can.frustumCulled=false;can.castShadow=!ghost;cg.add(can);
 base.castShadow=post.castShadow=!ghost;g.add(base,post,head);
 return{g,head,cg,can,bm,cm};
}
function cnDisp(b){scene.remove(b.g);b.bm.dispose();b.cm.dispose()}
function cnDrop(x,y,z,quiet){
 if(!STR.tpl)return;const T=STR.tpl,gy=cambGround(x,z,y+.6);if(gy>CAMB_VOID+1)y=gy;
 const g=new THREE.Group(),cm=T.mat.clone(),can=new THREE.Mesh(T.geo.cannon,cm);can.scale.setScalar(cnSc()*.55);can.position.copy(T.muzzle).multiplyScalar(-.5*cnSc()*.55);can.frustumCulled=false;g.add(can);
 const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:rbxTextures().glow,color:0x4aa8ff,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));gl.scale.set(4,4,1);gl.frustumCulled=false;g.add(gl);
 g.position.set(x,y+1.1,z);scene.add(g);CN.drops.push({g,gl,cm,x,y,z,t:Math.random()*6,sp:0});
 rbxAdd('ring',0x9fd4ff,x,y+.3,z,0,0,0,.7,7,{ring:1});
 if(!quiet)toast('O Strider largou o canhão! Chegue perto e use [F]');
}
function cnNearDrop(){let b=null,bd=3.4;for(const d of CN.drops){const e=Math.hypot(d.x-P.p.x,d.z-P.p.z);if(e<bd&&Math.abs(d.y-P.p.y)<3){bd=e;b=d}}return b}
function cnNearTur(){let b=null,bd=4;for(const t of CN.turrets){const e=Math.hypot(t.x-P.p.x,t.z-P.p.z);if(e<bd&&Math.abs(t.y-P.p.y)<3){bd=e;b=t}}return b}
function cnPlacePos(){
 const x=P.p.x-Math.sin(P.yaw)*3.2,z=P.p.z-Math.cos(P.yaw)*3.2,y=cambGround(x,z,P.p.y+.4);let ok=y>CAMB_VOID+1&&Math.abs(y-P.p.y)<=.7;
 for(let k=0;k<4&&ok;k++){const px=x+(k&1?.9:-.9),pz=z+(k&2?.9:-.9);if(cambHit(px,y,pz)||Math.abs(cambGround(px,pz,y+.4)-y)>.4)ok=false}
 if(ok)for(const t of CN.turrets)if(Math.hypot(t.x-x,t.z-z)<2)ok=false;
 return{x,y,z,ok};
}
function cnPickDrop(d){
 scene.remove(d.g);d.cm.dispose();d.gl.material.dispose();CN.drops.splice(CN.drops.indexOf(d),1);
 CN.carry=true;CN.ghost=cnBuild(true);scene.add(CN.ghost.g);toast('Canhão na mão: [F] coloca no chão · [J] larga');
}
function cnGhostOff(){if(CN.ghost){cnDisp(CN.ghost);CN.ghost=null}}
function cnPlace(){
 const p=cnPlacePos();if(!p.ok){toast('Não dá pra colocar o canhão aqui');return}
 const b=cnBuild(false);b.g.position.set(p.x,p.y,p.z);scene.add(b.g);
 const yaw=Math.atan2(-Math.sin(P.yaw),-Math.cos(P.yaw));b.head.rotation.y=yaw;
 CN.turrets.push(Object.assign(b,{x:p.x,y:p.y,z:p.z,yaw,pit:0,auto:true,type:'big',cdB:0,cdQ:0,burst:0,bT:0,rc:0,tgt:null,scanT:0,err:9}));
 CN.carry=false;cnGhostOff();rbxAdd('ring',0x9fd4ff,p.x,p.y+.3,p.z,0,0,0,.6,6,{ring:1});toast('Canhão colocado (automático). [F] perto dele pra operar');
}
function cnTake(t){cnDisp(t);CN.turrets.splice(CN.turrets.indexOf(t),1);if(CN.mount===t)CN.mount=null;CN.carry=true;CN.ghost=cnBuild(true);scene.add(CN.ghost.g);toast('Canhão recolhido')}
function cnLetGo(){CN.carry=false;cnGhostOff();cnDrop(P.p.x-Math.sin(P.yaw)*1.5,P.p.y,P.p.z-Math.cos(P.yaw)*1.5,true);toast('Canhão largado')}
function cnInteract(){
 if(state!=='play'||!CAMB)return false;
 if(CN.mount){CN.mount=null;toast('Você saiu do canhão');return true}
 if(CN.carry){cnPlace();return true}
 const d=cnNearDrop();if(d){cnPickDrop(d);return true}
 const t=cnNearTur();if(t){CN.mount=t;toast('Operando o canhão — ataque atira · B troca o tiro ('+(t.type==='big'?'grande':'rápido')+') · F sai');return true}
 return false;
}
function cnKey(code){
 if(state!=='play'||!CAMB)return;
 const t=CN.mount||cnNearTur();
 if(code==='KeyB'){if(!t)return;t.type=t.type==='big'?'quick':'big';toast('Tiro: '+(t.type==='big'?'GRANDE':'RÁPIDO'))}
 else if(code==='KeyH'){if(!t)return;t.auto=!t.auto;toast('Automático: '+(t.auto?'LIGADO':'DESLIGADO'))}
 else if(code==='KeyJ'){if(CN.carry)cnLetGo();else if(t&&!CN.mount)cnTake(t)}
}
function cnReset(){
 for(const d of CN.drops){scene.remove(d.g);d.cm.dispose();d.gl.material.dispose()}CN.drops.length=0;
 for(const t of CN.turrets)cnDisp(t);CN.turrets.length=0;
 for(const s of CN.shots){scene.remove(s.h1);scene.remove(s.h2);s.h1.material.dispose();s.h2.material.dispose()}CN.shots.length=0;
 cnGhostOff();CN.carry=false;CN.mount=null;if(CN.ui)CN.ui.classList.remove('on');
}
function cnMuzzle(t){t.g.updateMatrixWorld(true);return STR.v.copy(STR.tpl.muzzle).applyMatrix4(t.can.matrixWorld)}
function cnFire(t,m,dx,dy,dz,big){
 const l=Math.hypot(dx,dy,dz)||1;dx/=l;dy/=l;dz/=l;const SP=big?28:38;
 const sm=c=>new THREE.Sprite(new THREE.SpriteMaterial({map:rbxTextures().glow,color:c,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
 const h1=sm(0x4aa8ff),h2=sm(0xffffff);h1.scale.set(big?2.4:1,big?2.4:1,1);h2.scale.set(big?1.1:.45,big?1.1:.45,1);h1.frustumCulled=h2.frustumCulled=false;h1.position.set(m.x,m.y,m.z);h2.position.copy(h1.position);scene.add(h1);scene.add(h2);
 CN.shots.push({x:m.x,y:m.y,z:m.z,vx:dx*SP,vy:dy*SP,vz:dz*SP,life:big?3:2.5,h1,h2,big,dmg:big?38:4,tr:0});
 rbxAdd('glow',0x9fd4ff,m.x,m.y,m.z,0,0,0,.14,big?3:1.4,{peak:.3});t.rc=big?1:.5;
}
function cnAim(t,ty,tp,dt,rate){
 let d=ty-t.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));const dp=tp-t.pit;
 t.yaw+=Math.max(-rate*dt,Math.min(rate*dt,d));t.pit+=Math.max(-rate*dt,Math.min(rate*dt,dp));
 t.head.rotation.y=t.yaw;t.cg.rotation.x=-t.pit;return Math.abs(d)+Math.abs(dp);
}
function cnScan(t){
 const hx=t.x,hy=t.y+1.5,hz=t.z;let best=null,bd=1e9;
 for(const q of STR.list){if(q.hp<=0)continue;const d=Math.hypot(q.x-hx,q.z-hz);if(d>55||d>=bd)continue;if(!strLOS(hx,hy,hz,q.x,q.by+6,q.z))continue;best={k:'s',r:q};bd=d}
 for(const m of scs){if(m.st==='dead'||m.fr||m.rm||m.bur)continue;const d=Math.hypot(m.x-hx,m.z-hz);if(d>38||d>=bd||Math.abs(m.y-t.y)>6)continue;if(!strLOS(hx,hy,hz,m.x,m.y+1.1,m.z))continue;best={k:'m',r:m};bd=d}
 t.tgt=best;
}
function cnTgtPt(t){
 const g=t.tgt;if(!g)return null;
 if(g.k==='s'){const q=g.r;return q.hp>0&&q.g.visible?[q.x,q.by+6,q.z]:null}
 const m=g.r;return(m.st!=='dead'&&!m.rm&&scs.includes(m))?[m.x,m.y+1.1,m.z]:null;
}
function cnTurret(t,dt){
 t.cdB-=dt;t.cdQ-=dt;t.rc=Math.max(0,t.rc-dt*4);t.cg.position.z=-t.rc*.5;
 if(CN.mount===t){
  if(Math.hypot(P.p.x-t.x,P.p.z-t.z)>5.5){CN.mount=null;toast('Você saiu do canhão')}
 }
 if(CN.mount===t){
  cnAim(t,Math.atan2(fwd.x,fwd.z),Math.asin(Math.max(-1,Math.min(1,fwd.y))),dt,14);
  if(breaking){
   if(t.type==='big'){if(t.cdB<=0){const m=cnMuzzle(t);cnFire(t,{x:m.x,y:m.y,z:m.z},eye.x+fwd.x*70-m.x,eye.y+fwd.y*70-m.y,eye.z+fwd.z*70-m.z,true);t.cdB=1.4;if(Math.hypot(P.p.x-t.x,P.p.z-t.z)<25)addTrauma(.08)}}
   else if(t.cdQ<=0){const m=cnMuzzle(t);cnFire(t,{x:m.x,y:m.y,z:m.z},eye.x+fwd.x*70-m.x+R4()*.9,eye.y+fwd.y*70-m.y+R4()*.9,eye.z+fwd.z*70-m.z+R4()*.9,false);t.cdQ=.085}
  }
 }else if(t.auto){
  t.scanT-=dt;if(t.scanT<=0||!cnTgtPt(t)){t.scanT=.25;cnScan(t)}
  const p=cnTgtPt(t);
  if(p){
   const dx=p[0]-t.x,dy=p[1]-(t.y+1.5),dz=p[2]-t.z;
   t.err=cnAim(t,Math.atan2(dx,dz),Math.max(-.9,Math.min(.9,Math.atan2(dy,Math.hypot(dx,dz)))),dt,3.2);
   if(t.burst>0){t.bT-=dt;if(t.bT<=0){t.bT=.09;t.burst--;const m=cnMuzzle(t);cnFire(t,{x:m.x,y:m.y,z:m.z},p[0]-m.x+R4()*.8,p[1]-m.y+R4()*.8,p[2]-m.z+R4()*.8,false);if(t.burst<=0)t.cdQ=1.6}}
   else if(t.err<.12){
    if(t.tgt.k==='s'&&t.cdB<=0){const m=cnMuzzle(t);cnFire(t,{x:m.x,y:m.y,z:m.z},p[0]-m.x,p[1]-m.y,p[2]-m.z,true);t.cdB=2.6}
    else if(t.cdQ<=0){t.burst=8;t.bT=0}
   }
  }
 }
 t.g.updateMatrixWorld(true);
}
function cnShotsUpdate(dt){
 for(let i=CN.shots.length-1;i>=0;i--){
  const s=CN.shots[i];s.life-=dt;
  const sp=Math.hypot(s.vx,s.vy,s.vz),n=Math.max(1,Math.ceil(sp*dt/.45)),sd=dt/n;let hit=null;
  for(let k=0;k<n&&!hit;k++){
   s.x+=s.vx*sd;s.y+=s.vy*sd;s.z+=s.vz*sd;
   if(s.y<cambGround(s.x,s.z,s.y+.6)+.15||cambHit(s.x,s.y-.9,s.z)||s.y<CAMB_Y-60){hit={w:1};break}
   for(const q of STR.list){if(q.hp<=0)continue;if(Math.hypot(s.x-q.x,s.z-q.z)<3.4&&s.y>q.by-.3&&s.y<q.by+11.5){hit={st:q};break}}
   if(hit)break;
   for(const m of scs){if(m.st==='dead'||m.fr||m.rm||m.bur)continue;if(Math.hypot(s.x-m.x,s.z-m.z)<m.k.BODY_R+.45&&Math.abs(s.y-(m.y+1))<1.5){hit={mob:m};break}}
  }
  s.h1.position.set(s.x,s.y,s.z);s.h2.position.set(s.x,s.y,s.z);
  s.tr-=dt;if(s.tr<=0){s.tr=s.big?.035:.07;rbxAdd('glow',0x3d8bff,s.x+R4()*.12,s.y+R4()*.12,s.z+R4()*.12,R4()*.5,R4()*.5,R4()*.5,.3,s.big?.7:.35,{drag:3})}
  if(hit||s.life<=0){
   const o={x:s.x,y:s.y,z:s.z};strBoom(o,s.big?1:.38);
   if(hit&&hit.st)strHurt(hit.st,s.dmg);
   if(hit&&hit.mob)scHurt(hit.mob,s.dmg,s.big?5:1.5,{x:o.x-s.vx*.1,z:o.z-s.vz*.1});
   if(s.big){for(const m of scs){if(m.st==='dead'||m.fr||m.rm||m.bur||(hit&&m===hit.mob))continue;if(Math.hypot(m.x-o.x,m.z-o.z)<3.4&&Math.abs(m.y+1-o.y)<2.5)scHurt(m,s.dmg*.7,5,{x:o.x,z:o.z})}if(Math.hypot(P.p.x-o.x,P.p.z-o.z)<30)addTrauma(.1)}
   scene.remove(s.h1);scene.remove(s.h2);s.h1.material.dispose();s.h2.material.dispose();CN.shots[i]=CN.shots[CN.shots.length-1];CN.shots.pop();
  }
 }
}
function cnUI(){
 if(!CN.ui){
  const u=document.createElement('div');u.id='cn-ui';document.body.appendChild(u);CN.ui=u;
  u.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});u.addEventListener('mousedown',e=>e.stopPropagation());
  u.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;e.preventDefault();e.stopPropagation();const a=b.dataset.a;if(a==='f')cnInteract();else if(a==='b')cnKey('KeyB');else if(a==='h')cnKey('KeyH');else if(a==='j')cnKey('KeyJ')});
  setInterval(()=>{if(CN.ui&&(state!=='play'||!CAMB))CN.ui.classList.remove('on')},150);
 }
 let ctx='',t=CN.mount||null;
 if(CN.mount)ctx='m';else if(CN.carry)ctx='c';else if(cnNearDrop())ctx='d';else if((t=cnNearTur()))ctx='t';
 const key=ctx+(t?t.type+(t.auto?1:0):'')+(CN.carry&&CN.ghost&&CN.ghost.ok?'k':'');
 if(key===CN.uiKey)return;CN.uiKey=key;
 const h=touch?(()=>''):(k=>' ['+k+']'),b=(a,txt,k,hot)=>'<button data-a="'+a+'"'+(hot?' class="hot"':'')+'>'+txt+h(k)+'</button>';
 let html='';
 if(ctx==='d')html=b('f','Pegar canhão','F',1);
 else if(ctx==='c')html=b('f','Colocar no chão','F',1)+b('j','Largar','J');
 else if(ctx==='t')html=b('f','Operar','F',1)+b('h','Automático: '+(t.auto?'LIGADO':'DESLIGADO'),'H')+b('b','Tiro: '+(t.type==='big'?'grande':'rápido'),'B')+b('j','Recolher','J');
 else if(ctx==='m')html=b('b','Tiro: '+(t.type==='big'?'GRANDE':'RÁPIDO'),'B',1)+b('h','Auto ao sair: '+(t.auto?'SIM':'NÃO'),'H')+b('f','Sair','F');
 CN.ui.innerHTML=html;CN.ui.classList.toggle('on',!!html);
}
function cnUpdate(dt){
 if(!CAMB)return;if(dt>.1)dt=.1;CN.t+=dt;
 for(const d of CN.drops){d.t+=dt;d.g.rotation.y+=dt*1.2;d.g.position.y=d.y+1.1+Math.sin(d.t*2)*.15;const p=1+Math.sin(d.t*4)*.12;d.gl.scale.set(4*p,4*p,1);d.sp-=dt;if(d.sp<=0){d.sp=.3;rbxAdd('star',0xbfe3ff,d.x+R4()*.8,d.y+.6+Math.random()*1.6,d.z+R4()*.8,0,.8,0,.5,.3,{spin:R4()*6})}}
 if(CN.ghost){const p=cnPlacePos();CN.ghost.g.position.set(p.x,p.y,p.z);CN.ghost.head.rotation.y=Math.atan2(-Math.sin(P.yaw),-Math.cos(P.yaw));CN.ghost.ok=p.ok;CN.ghost.cm.color.setHex(p.ok?0x88ffaa:0xff6666);CN.ghost.bm.color.setHex(p.ok?0x55aa77:0xaa4444)}
 for(const t of CN.turrets)cnTurret(t,dt);
 cnShotsUpdate(dt);cnUI();
}

/* ---------- TANQUES ALIADOS (Camera Base) ----------
   Modelo: "Big Tank (Spidarrund)" de Eveston - Elite Big Speakerman - Hugo (sketchfab.com/EvesStudio2008), CC-BY 4.0 — crédito obrigatório.
   O tank-data.js tem o casco (parado) e a torre com o canhão (gira em volta do pivô, o cano passa pelo pivô) + o nó "muzzle" (boca do cano).
   Nascem em volta do salão de nascimento, viradas pro centro. Cada um escolhe sozinho o inimigo mais próximo com linha de visão (Strider ou zumbi),
   mira, CARREGA (orbe vermelho + faíscas convergindo no cano) e dispara um LASER vermelho contínuo na direção do cano. O feixe para na primeira
   parede/inimigo e causa TK_DMG (7) de dano a cada tick de TK_TICK s. Não machuca o jogador e os tanques não sofrem dano. */
function tkLoad(){
 if(ATNK.promise)return ATNK.promise;
 ATNK.promise=new Promise((res,rej)=>{
  const parse=()=>{
   if(!THREE.GLTFLoader){rej(new Error('GLTFLoader indisponível'));return}
   const src=window.TANK_GLTF;if(!src){rej(new Error('tank-data.js vazio'));return}
   new THREE.GLTFLoader().parse(typeof src==='string'?src:JSON.stringify(src),'',g=>{
    try{
     window.TANK_GLTF=null;const r=g.scene;
     if(!r.getObjectByName('hull')||!r.getObjectByName('turret')||!r.getObjectByName('muzzle'))throw new Error('peças hull/turret/muzzle ausentes no tank-data.js');
     r.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false}});
     ATNK.tpl=r;res(r);
    }catch(e){rej(e)}
   },e=>rej(e||new Error('falha ao ler o tanque')));
  };
  if(window.TANK_GLTF)parse();
  else{const sc=document.createElement('script');sc.src='tank-data.js';sc.onload=parse;sc.onerror=()=>rej(new Error('tank-data.js não encontrado (deve ficar na mesma pasta do index.html)'));document.head.appendChild(sc)}
 });
 return ATNK.promise;
}
function tkEnsure(){
 if(ATNK.list.length){tkShow(true);return}
 if(ATNK.busy)return;ATNK.busy=true;
 tkLoad().then(()=>{ATNK.busy=false;if(!CAMB||ATNK.list.length)return;tkSpawnAll();tkShow(true)})
  .catch(e=>{ATNK.busy=false;ATNK.promise=null;console.error('[OWM] tanques aliados:',e);toast('Não consegui carregar os tanques aliados. '+(e&&e.message||''))});
}
function tkShow(on){for(const t of ATNK.list){if(t.plate)continue;t.g.visible=!!on;if(!on){tkBeamOff(t);tkSndHard(t)}}}
/* tanques do BASEPLATE (criados pelo menu Spawn): somem ao trocar de mundo e ao "Remover todos" */
function tkClearPlate(){for(let i=ATNK.list.length-1;i>=0;i--){const t=ATNK.list[i];if(!t.plate)continue;tkBeamOff(t);tkSndHard(t);scene.remove(t.g);ATNK.list.splice(i,1)}}
function plateSpawnTank(){
 toast('Carregando tanque laser…');
 tkLoad().then(()=>{
  if(!PLATE||LOBBY||CAMB)return;
  const gy=cambGround(P.p.x,P.p.z,P.p.y);let spot=null;
  for(let k=0;k<60&&!spot;k++){const a=P.yaw+(Math.random()-.5)*1.4,r=16+Math.random()*6+k*.2,x=P.p.x-Math.sin(a)*r,z=P.p.z-Math.cos(a)*r,hy=Math.atan2(P.p.x-x,P.p.z-z);if(tkFree(x,z,hy,gy)&&!ATNK.list.some(o=>o.plate&&Math.hypot(o.g.position.x-x,o.g.position.z-z)<11))spot=[x,z,hy]}
  if(!spot){toast('Não foi possível criar o tanque aqui.');return}
  const t=tkMake(spot[0],gy,spot[1],spot[2]);t.plate=1;t.hx=spot[0];t.hz=spot[1];ATNK.list.push(t);
  rbxHit({x:spot[0],y:gy+.5,z:spot[1]},TK_PAL,{n:14,sp:8,size:.5,flash:2.6,ring:6,fin:true});toast('Tanque laser criado.');refreshSpawnCount();
 }).catch(e=>{ATNK.promise=null;console.error('[OWM] tanque laser:',e);toast('Não consegui carregar o tanque. '+(e&&e.message||''))});
}
/* a pegada do tank (≈9 x 5 m) precisa estar livre e no mesmo nível do piso do salão */
function tkFree(x,z,hy,gy0){
 const fx=Math.sin(hy),fz=Math.cos(hy),rx=Math.cos(hy),rz=-Math.sin(hy);
 for(let a=-4.8;a<=4.81;a+=1.6)for(let b=-2.8;b<=2.81;b+=1.4){
  const px=x+fx*a+rx*b,pz=z+fz*a+rz*b,gy=cambGround(px,pz,gy0+.5);
  if(Math.abs(gy-gy0)>.45||cambHit(px,gy0,pz))return false;
 }
 return true;
}
function tkSpawnAll(){
 const cy=CAMB_Y+.3,gy0=cambGround(0,0,cy),a0=Math.random()*6.2832,pts=[];
 for(let i=0;i<TK_N;i++){
  let spot=null;
  for(let k=0;k<90&&!spot;k++){
   const a=a0+i*6.2832/TK_N+R4()*(.25+k*.012),r=10+Math.random()*5+k*.05,x=Math.sin(a)*r,z=Math.cos(a)*r,hy=Math.atan2(-x,-z);
   if(pts.some(q=>Math.hypot(q[0]-x,q[1]-z)<11))continue;
   if(tkFree(x,z,hy,gy0))spot=[x,z,hy];
  }
  if(!spot){console.warn('[OWM] tanque aliado',i+1,': sem espaço livre perto do salão de nascimento');continue}
  pts.push(spot);ATNK.list.push(tkMake(spot[0],gy0,spot[1],spot[2]));
 }
}
function tkMake(x,y,z,hy){
 const g=new THREE.Group(),root=ATNK.tpl.clone(true);root.scale.setScalar(TK_SC);g.add(root);
 g.position.set(x,y,z);g.rotation.y=hy;scene.add(g);
 const tur=root.getObjectByName('turret'),mz=root.getObjectByName('muzzle');tur.rotation.order='YXZ';
 g.updateMatrixWorld(true);const pv=new THREE.Vector3();tur.getWorldPosition(pv);
 // feixe: cilindro unitário no eixo Y (esticado e girado a cada quadro) em 2 camadas + brilhos na boca do cano e no ponto de impacto
 if(!ATNK.bgeo)ATNK.bgeo=new THREE.CylinderGeometry(1,1,1,10,1,true);
 const bm=(c,o)=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:o,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,side:THREE.DoubleSide});
 const b1=new THREE.Mesh(ATNK.bgeo,bm(0xff1a1a,.5)),b2=new THREE.Mesh(ATNK.bgeo,bm(0xffd8d8,.95));
 const sm=c=>new THREE.Sprite(new THREE.SpriteMaterial({map:rbxTextures().glow,color:c,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
 const m1=sm(0xff2a2a),m2=sm(0xffffff),i1=sm(0xff3030),i2=sm(0xffffff);
 for(const o of[b1,b2,m1,m2,i1,i2]){o.frustumCulled=false;o.visible=false;scene.add(o)}
 return{g,tur,mz,pv,hy,yaw:hy,pit:0,tgt:null,scanT:Math.random()*.3,st:'idle',ct:0,ft:0,cd:Math.random()*1.5,acc:0,len:0,rl:0,hit:null,pT:0,b1,b2,m1,m2,i1,i2,sp:0,ck:Math.random()*.12,ok:true,blk:0,rev:0,pz:0,wx:x,wz:z,wt:0,dust:0,sn:null};
}
/* sons do tanque: cada tanque tem o seu "carregando" (c) e o seu "laser" (l); o volume cai com a distância do jogador e tem fade in/out */
function tkSndGet(t,k){
 if(typeof Audio==='undefined')return null;
 if(!t.sn)t.sn={};let s=t.sn[k];
 if(!s){const a=new Audio(TK_SND[k]);a.preload='auto';s=t.sn[k]={a,on:0,g:0,p:0}}
 return s;
}
function tkSnd(t,k,on){
 const s=tkSndGet(t,k);if(!s)return;
 if(on){
  if(s.on&&s.p)return;
  s.on=1;s.p=1;s.g=on===2?1:.25;
  try{s.a.currentTime=0;const pr=s.a.play();if(pr&&pr.catch)pr.catch(()=>{s.p=0;s.on=0})}catch(e){s.p=0;s.on=0}
 }else s.on=0;   // fade out; o update pausa quando zerar
}
function tkSndHard(t){if(!t.sn)return;for(const k in t.sn){const s=t.sn[k];s.on=0;s.g=0;if(s.p){try{s.a.pause()}catch(e){}s.p=0}}}
function tkSndUpdate(t,dt){
 if(!t.sn)return;
 const d=Math.hypot(t.g.position.x-P.p.x,t.g.position.z-P.p.z),base=Math.min(1,Math.pow(cl(S.mvol,0,100)/100,2)*Math.pow(Math.max(0,1-d/TK_SNDR),1.4)*1.3);
 for(const k in t.sn){
  const s=t.sn[k];if(!s.p)continue;
  s.g+=((s.on?1:0)-s.g)*Math.min(1,dt*(s.on?16:14));
  if(s.a.ended||(!s.on&&s.g<.02)){try{s.a.pause()}catch(e){}s.p=0;s.on=0;continue}
  try{s.a.volume=Math.max(0,Math.min(1,base*s.g))}catch(e){}
 }
}
function tkBeamOff(t){t.b1.visible=t.b2.visible=t.m1.visible=t.m2.visible=t.i1.visible=t.i2.visible=false}
function tkTgtPt(t){
 const k=t.tgt;if(!k)return null;
 if(k.k==='s'){const q=k.r;return q.hp>0&&q.g.visible?[q.x,q.by+6,q.z]:null}
 const m=k.r;return(m.st!=='dead'&&!m.rm&&!m.bur&&scs.includes(m))?[m.x,m.y+1.1,m.z]:null;
}
function tkScan(t){
 const hx=t.pv.x,hy=t.pv.y,hz=t.pv.z;let best=null,bd=1e9;
 for(const q of STR.list){if(q.hp<=0||!q.g.visible)continue;const d=Math.hypot(q.x-hx,q.z-hz);if(d>TK_RANGE||d>=bd)continue;if(!strLOS(hx,hy,hz,q.x,q.by+6,q.z))continue;best={k:'s',r:q};bd=d}
 for(const m of scs){if(m.st==='dead'||m.fr||m.rm||m.bur)continue;const d=Math.hypot(m.x-hx,m.z-hz);if(d>45||d>=bd||Math.abs(m.y-t.g.position.y)>8)continue;if(!strLOS(hx,hy,hz,m.x,m.y+1.1,m.z))continue;best={k:'m',r:m};bd=d}
 t.tgt=best;
}
function tkAim(t,p,dt,rate){
 const dx=p[0]-t.pv.x,dy=p[1]-t.pv.y,dz=p[2]-t.pv.z,ty=Math.atan2(dx,dz),tp=Math.max(-.3,Math.min(.95,Math.atan2(dy,Math.hypot(dx,dz))));
 let d=ty-t.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));const dp=tp-t.pit;
 t.yaw+=Math.max(-rate*dt,Math.min(rate*dt,d));t.pit+=Math.max(-rate*dt,Math.min(rate*dt,dp));
 t.tur.rotation.y=t.yaw-t.hy;t.tur.rotation.x=-t.pit;
 return Math.abs(d)+Math.abs(dp);
}
/* boca do cano e direção do feixe = orientação REAL do cano (o feixe sai exatamente por onde o canhão aponta). Retorna a posição em ATNK.v e a direção em ATNK.v2 */
function tkMuzzle(t){t.g.updateMatrixWorld(true);t.mz.getWorldPosition(ATNK.v);t.mz.getWorldQuaternion(ATNK.q);ATNK.v2.set(0,0,1).applyQuaternion(ATNK.q);return ATNK.v}
/* raio do laser: anda de .5 em .5 m até a 1ª parede, chão ou inimigo */
function tkRay(ox,oy,oz,dx,dy,dz){
 for(let s=.5;s<=TK_RANGE;s+=.5){
  const x=ox+dx*s,y=oy+dy*s,z=oz+dz*s;
  if(y<cambGround(x,z,y+.6)+.15||cambHit(x,y-.9,z)||y<CAMB_Y-60)return{L:s,hit:{w:1}};
  for(const q of STR.list){if(q.hp<=0||!q.g.visible)continue;if(Math.hypot(x-q.x,z-q.z)<3.4&&y>q.by-.3&&y<q.by+11.5)return{L:s,hit:{st:q}}}
  for(const m of scs){if(m.st==='dead'||m.fr||m.rm||m.bur)continue;if(Math.hypot(x-m.x,z-m.z)<m.k.BODY_R+.45&&Math.abs(y-(m.y+1))<1.5)return{L:s,hit:{mob:m}}}
 }
 return{L:TK_RANGE,hit:null};
}
/* 1 tick de dano (TK_DMG) no que o feixe está acertando */
function tkTickDmg(t,r,x,y,z){
 const h=r.hit;if(!h)return;
 if(h.st)strHurt(h.st,TK_DMG,true);   // true = sem a redução de 8% do Strider: exatamente 7
 else if(h.mob){const m=h.mob,f=Math.max(.05,(1-(m.k.ARMOR||0))*(m.din||1));scHurt(m,TK_DMG/f,.8,{x:t.g.position.x,z:t.g.position.z})}   // compensa armadura/dano extra do zumbi: 7 líquidos
 rbxAdd('glow',0xff3030,x,y,z,0,0,0,.2,h.w?1.1:1.7,{peak:.3});
 for(let i=0;i<2;i++)rbxAdd('star',i?0xff8a7a:0xffffff,x+R4()*.1,y+R4()*.1,z+R4()*.1,R4()*5,Math.random()*4+1,R4()*5,.28,.32,{g:7,drag:3,spin:R4()*9});
}
function tkWrap(a){return Math.atan2(Math.sin(a),Math.cos(a))}
/* o ponto (x,z) é seguro pro tanque: pegada livre e sem chegar perto demais de outro tanque ou do jogador */
function tkSpotOk(t,x,z,hy){
 const px=t.g.position.x,pz=t.g.position.z;
 for(const o of ATNK.list){if(o===t||!o.g.visible)continue;const dn=Math.hypot(o.g.position.x-x,o.g.position.z-z);if(dn<11&&dn<Math.hypot(o.g.position.x-px,o.g.position.z-pz))return false}
 const dp=Math.hypot(P.p.x-x,P.p.z-z);if(dp<6&&dp<Math.hypot(P.p.x-px,P.p.z-pz))return false;
 return tkFree(x,z,hy,t.g.position.y);
}
/* anda em direção a (gx,gz): gira o casco primeiro (como um tanque de verdade), só avança com o casco quase alinhado; parou perto (stopD) ou bloqueado → recua e escolhe outro caminho */
function tkDrive(t,dt,gx,gz,stopD){
 const px=t.g.position.x,pz=t.g.position.z,dx=gx-px,dz=gz-pz,d=Math.hypot(dx,dz);let want=0;
 if(t.rev>0){t.rev-=dt;want=-TK_BACK;t.hy+=Math.max(-TK_TURN*dt,Math.min(TK_TURN*dt,t.revTurn||0))}
 else if(d>stopD){
  const e=tkWrap(Math.atan2(dx,dz)-t.hy);t.hy+=Math.max(-TK_TURN*dt,Math.min(TK_TURN*dt,e));
  if(Math.abs(e)<.55)want=TK_SPD*Math.max(.35,Math.min(1,(d-stopD)/10));
 }
 t.ck-=dt;
 if(t.ck<=0){t.ck=.12;const sg=want<0?-1:1,la=2+Math.abs(t.sp)*.5;t.ok=tkSpotOk(t,px+Math.sin(t.hy)*la*sg,pz+Math.cos(t.hy)*la*sg,t.hy)}
 if(!t.ok&&want!==0){
  want=0;t.blk+=dt;
  if(t.rev<=0&&t.blk>.4){t.rev=1.3;t.revTurn=(Math.random()<.5?-1:1)*TK_TURN;t.blk=0;t.wt=0}   // encostou: dá ré girando e sorteia outro destino
  else if(t.rev>0&&t.blk>.5){t.rev=0;t.blk=0}
 }else if(t.ok)t.blk=0;
 t.sp+=(want-t.sp)*Math.min(1,dt*2.5);if(Math.abs(t.sp)<.03&&want===0)t.sp=0;
 if(t.sp!==0){
  const nx=px+Math.sin(t.hy)*t.sp*dt,nz=pz+Math.cos(t.hy)*t.sp*dt,gy=cambGround(nx,nz,t.g.position.y+.5);
  if(Math.abs(gy-t.g.position.y)<.6&&gy>CAMB_VOID+1){t.g.position.x=nx;t.g.position.z=nz;t.g.position.y+=(gy-t.g.position.y)*Math.min(1,dt*10)}
  else{t.sp=0;t.ok=false}
  t.dust-=dt;
  if(t.dust<=0&&Math.abs(t.sp)>1){   // poeirinha atrás das esteiras
   t.dust=.12;const fx=Math.sin(t.hy),fz=Math.cos(t.hy),rx=fz,rz=-fx;
   for(const sd of[-1.9,1.9])rbxAdd('glow',0x8a7f6a,t.g.position.x-fx*4.2+rx*sd,t.g.position.y+.3,t.g.position.z-fz*4.2+rz*sd,R4()*.4,.5+Math.random()*.4,R4()*.4,.7,1.4,{peak:.25,drag:2});
  }
 }
 t.g.rotation.y=t.hy;
}
/* decide pra onde ir: com alvo, chega a TK_KEEP m dele (só quando parado, atira); sem alvo, patrulha pontos aleatórios em volta do salão */
function tkMove(t,dt,p,canMove){
 if(!canMove){t.sp+=(0-t.sp)*Math.min(1,dt*6);if(Math.abs(t.sp)<.03)t.sp=0;return}
 const pos=t.g.position,hx=t.hx||0,hz=t.hz||0,home=Math.hypot(pos.x-hx,pos.z-hz);   // hx/hz = ponto de origem (0,0 na Camera Base; onde nasceu no Baseplate)
 if(p&&home<TK_LEASH&&Math.hypot(p[0]-pos.x,p[2]-pos.z)>TK_KEEP){tkDrive(t,dt,p[0],p[2],TK_KEEP);return}
 if(p){t.sp+=(0-t.sp)*Math.min(1,dt*4);if(Math.abs(t.sp)<.03)t.sp=0;return}   // alvo ao alcance: fica parado mirando
 if(t.pz>0){t.pz-=dt;t.sp+=(0-t.sp)*Math.min(1,dt*4);if(Math.abs(t.sp)<.03)t.sp=0;return}   // parada de descanso
 t.wt-=dt;
 const dw=Math.hypot(t.wx-pos.x,t.wz-pos.z);
 if(t.wt<=0||dw<4){
  if(dw<4&&Math.random()<.5){t.pz=2+Math.random()*4;t.wt=0;return}
  const a=Math.random()*6.2832,r=8+Math.random()*TK_WAND;t.wx=hx+Math.sin(a)*r;t.wz=hz+Math.cos(a)*r;t.wt=7+Math.random()*7;
 }
 tkDrive(t,dt,t.wx,t.wz,3);
}
function tkTick(t,dt){
 t.pT-=dt;t.cd-=dt;
 const turn=t.st==='fire'?1.5:2.4;
 // alvo: reavalia a cada .25 s (ou na hora, se o alvo morreu)
 if(t.st!=='cool'){t.scanT-=dt;if(t.scanT<=0||!tkTgtPt(t)){t.scanT=.25;tkScan(t)}}
 const p=tkTgtPt(t);
 // ANDAR: só se movem fora do carregamento/disparo; a torre mantém a mira no mundo enquanto o casco gira
 tkMove(t,dt,p,t.st==='idle'||t.st==='cool');
 t.g.updateMatrixWorld(true);t.tur.getWorldPosition(t.pv);
 if(!p&&(t.st==='idle'||t.st==='cool')){   // sem alvo: a torre volta a olhar pra frente do casco
  const d=tkWrap(t.hy-t.yaw);t.yaw+=Math.max(-1.4*dt,Math.min(1.4*dt,d));t.pit+=(0-t.pit)*Math.min(1,dt*3);
 }
 t.tur.rotation.y=t.yaw-t.hy;t.tur.rotation.x=-t.pit;
 tkSndUpdate(t,dt);
 if(t.st==='idle'){
  if(p){const e=tkAim(t,p,dt,turn);if(e<.07&&t.cd<=0){t.st='charge';t.ct=0;t.sp=0;tkSnd(t,'c',1);const m=tkMuzzle(t);rbxAdd('ring',0xff4040,m.x,m.y,m.z,0,0,0,.5,4.5,{ring:1})}}
 }else if(t.st==='charge'){
  if(!p){t.st='idle';t.cd=.3;tkSnd(t,'c',0);return}
  tkAim(t,p,dt,turn);t.ct+=dt;const u=Math.min(1,t.ct/TK_CHARGE),m=tkMuzzle(t),d=ATNK.v2;
  // partícula de CARREGAMENTO: orbe vermelho que cresce na boca do cano + faíscas convergindo
  rbxAdd('glow',0xff3030,m.x,m.y,m.z,0,0,0,.12,.7+u*2.6,{peak:.5});
  rbxAdd('glow',0xffffff,m.x,m.y,m.z,0,0,0,.1,.3+u*1,{peak:.5});
  if(Math.random()<.75){
   const rx=Math.cos(t.yaw),rz=-Math.sin(t.yaw),a=Math.random()*6.2832,r=1.9*(1-u)+.4,ca=Math.cos(a),sa=Math.sin(a);
   const ux=-d.y*d.x,uy=d.x*d.x+d.z*d.z,uz=-d.y*d.z,ul=Math.hypot(ux,uy,uz)||1;   // eixo "cima" perpendicular ao cano
   const ox=(rx*ca+ux/ul*sa)*r,oy=(uy/ul*sa)*r,oz=(rz*ca+uz/ul*sa)*r;
   rbxAdd('star',0xff9a8a,m.x+ox+d.x*.4,m.y+oy+d.y*.4,m.z+oz+d.z*.4,-ox*5,-oy*5,-oz*5,.2,.32,{spin:R4()*8});
  }
  if(t.ct>=TK_CHARGE){t.st='fire';t.ft=0;tkSnd(t,'c',0);tkSnd(t,'l',2);t.acc=0;t.len=0;t.rl=0;t.hit=null;
   const hl=Math.hypot(d.x,d.z)||1;
   rbxHit(m,TK_PAL,{n:14,sp:9,size:.5,flash:3.2,ring:3,fin:false,dir:[d.x/hl,d.z/hl,-d.z/hl,d.x/hl,0,.25,1.6]});   // clarão do disparo
   if(Math.hypot(P.p.x-m.x,P.p.z-m.z)<40)addTrauma(.05)}
 }else if(t.st==='fire'){
  t.ft+=dt;
  if(p)tkAim(t,p,dt,turn);
  const m=tkMuzzle(t),dx=ATNK.v2.x,dy=ATNK.v2.y,dz=ATNK.v2.z,mx=m.x,my=m.y,mz=m.z;
  t.acc+=dt;let ticks=0;while(t.acc>=TK_TICK){t.acc-=TK_TICK;ticks++}
  if(ticks||!t.hit){   // raio no ritmo dos ticks (10/s): barato e igual pro dano e pro visual
   const r=tkRay(mx,my,mz,dx,dy,dz);t.rl=r.L;t.hit=r;
   const hx=mx+dx*r.L,hy=my+dy*r.L,hz=mz+dz*r.L;
   for(let k=0;k<ticks;k++)tkTickDmg(t,r,hx,hy,hz);
  }
  t.len+=(t.rl-t.len)*Math.min(1,dt*30);
  const L=Math.max(.2,t.len),w=Math.max(0,Math.min(1,t.ft/.12)*Math.min(1,(TK_BEAM-t.ft)/.18)),pul=1+Math.sin(ATNK.t*60)*.12;
  const cx=mx+dx*L/2,cy=my+dy*L/2,cz=mz+dz*L/2;ATNK.q.setFromUnitVectors(ATNK.up,ATNK.v2);
  for(const[b,rad]of[[t.b1,.2*pul*w],[t.b2,.075*pul*w]]){b.visible=true;b.position.set(cx,cy,cz);b.quaternion.copy(ATNK.q);b.scale.set(Math.max(.001,rad),L,Math.max(.001,rad))}
  t.m1.visible=t.m2.visible=true;t.m1.position.set(mx,my,mz);t.m2.position.set(mx,my,mz);t.m1.scale.setScalar(Math.max(.01,(2.6+Math.sin(ATNK.t*45)*.4)*w));t.m2.scale.setScalar(Math.max(.01,1.2*w));
  const ex=mx+dx*L,ey=my+dy*L,ez=mz+dz*L;t.i1.visible=t.i2.visible=!!t.hit.hit;t.i1.position.set(ex,ey,ez);t.i2.position.set(ex,ey,ez);t.i1.scale.setScalar(Math.max(.01,(2.2+Math.sin(ATNK.t*50)*.5)*w));t.i2.scale.setScalar(Math.max(.01,.9*w));
  // partículas do LASER: faíscas soltas ao longo do feixe + chuva de faíscas no impacto
  if(t.pT<=0){t.pT=.03;const s=Math.random()*L;rbxAdd('glow',0xff4040,mx+dx*s+R4()*.25,my+dy*s+R4()*.25,mz+dz*s+R4()*.25,R4()*.8,R4()*.8,R4()*.8,.3,.4,{drag:2});
   if(t.hit.hit)rbxAdd('star',0xff8a7a,ex,ey,ez,R4()*6,Math.random()*5+1,R4()*6,.3,.34,{g:7,drag:3,spin:R4()*9})}
  if(t.ft>=TK_BEAM||(!p&&t.ft>.4)){t.st='cool';t.cd=TK_COOL;tkBeamOff(t);tkSnd(t,'l',0)}
 }else if(t.st==='cool'){
  if(t.cd<=0)t.st='idle';
 }
}
function tkUpdate(dt){
 if(!ATNK.list.length)return;if(dt>.1)dt=.1;ATNK.t+=dt;
 for(const t of ATNK.list){if(!t.g.visible)continue;try{tkTick(t,dt)}catch(e){console.error('[OWM] tanque aliado:',e);t.st='cool';t.cd=2;tkBeamOff(t);tkSndHard(t)}}
}

/* ---------- HUD do lobby: só joystick + botão de pular (+ botão de menu), e duas barras no lugar da vida: "0 cent" e "0 pontos" ---------- */
const LBS={maxCent:100,maxPontos:100};   // valor que enche cada barra (a barra fica vazia com 0)
(function(){
 if(document.getElementById('lobby-hud-css'))return;
 const css=document.createElement('style');css.id='lobby-hud-css';
 css.textContent=
 'body.lobby-mode #bPunch,body.lobby-mode #bM1,body.lobby-mode #bM2,body.lobby-mode #bSwap,body.lobby-mode #bDash,'+
 'body.lobby-mode #collect,body.lobby-mode #bSprint,body.lobby-mode #bLock,body.lobby-mode #bShiftLock,body.lobby-mode #hint,'+
 'body.lobby-mode #combo-ui,body.lobby-mode #slashfx,body.lobby-mode #stamina-bar,body.lobby-mode #health-bar{display:none!important}'+   // vida só na Camera Base
 '#lobby-bars{display:none;flex-direction:column;gap:4px;margin-top:5px;pointer-events:none}'+
 'body.lobby-mode #lobby-bars,body.camb-on #lobby-bars{display:flex}'+
 'body.camb-on #lobby-bars{gap:3px;margin-top:4px}'+   // Camera Base: abaixo da barra de vida, um pouco menores que no lobby (texto continua legível)
 'body.camb-on #lobby-bars .lb-bar{height:13px;width:min(26vw,125px);border-width:1.5px;border-radius:3px}'+
 'body.camb-on #lobby-bars .lb-txt{font-size:9.5px;letter-spacing:.2px}'+
 '#lobby-bars .lb-bar{position:relative;box-sizing:border-box;height:15px;width:min(30vw,150px);border:2px solid #05060a;border-radius:3px;overflow:hidden;background:linear-gradient(#1b1e26,#0c0e13);box-shadow:0 0 0 1px rgba(255,255,255,.14)}'+
 '#lobby-bars .lb-fill{position:absolute;left:0;top:0;bottom:0;width:0;transition:width .25s}'+
 '#lb-cent .lb-fill{background:linear-gradient(#ffe27a,#e0a21a)}'+
 '#lb-pts .lb-fill{background:linear-gradient(#8fd2ff,#2a74d6)}'+
 '#lobby-bars .lb-txt{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;font:800 10px/1 Montserrat,system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000;letter-spacing:.2px}';
 document.head.appendChild(css);
})();
function lobbyEnsureBars(){
 let w=document.getElementById('lobby-bars');if(w)return w;
 const host=document.getElementById('health-wrap')||document.getElementById('hud');if(!host)return null;
 w=document.createElement('div');w.id='lobby-bars';
 for(const[id,fid,tid]of[['lb-cent','lb-cent-fill','lb-cent-txt'],['lb-pts','lb-pts-fill','lb-pts-txt']]){
  const b=document.createElement('div');b.className='lb-bar';b.id=id;
  const f=document.createElement('div');f.className='lb-fill';f.id=fid;
  const t=document.createElement('span');t.className='lb-txt';t.id=tid;
  b.appendChild(f);b.appendChild(t);w.appendChild(b);
 }
 host.appendChild(w);return w;
}
function lobbyRenderBars(){
 if(!lobbyEnsureBars())return;
 const c=Math.max(0,Math.floor((cur&&cur.cent)||0)),p=Math.max(0,Math.floor((cur&&cur.pontos)||0));
 document.getElementById('lb-cent-txt').textContent=c+' cent';
 document.getElementById('lb-pts-txt').textContent=p+(p===1?' ponto':' pontos');
 document.getElementById('lb-cent-fill').style.width=Math.min(100,c/LBS.maxCent*100)+'%';
 document.getElementById('lb-pts-fill').style.width=Math.min(100,p/LBS.maxPontos*100)+'%';
}
/* define os valores das duas barras (e salva no perfil do lobby). Uso: lobbySetStats(cent, pontos) — passe null para não mudar um deles */
function lobbySetStats(cent,pontos){
 if(cur&&cur.biome==='lobby'){
  if(cent!=null)cur.cent=Math.max(0,Math.floor(cent));
  if(pontos!=null)cur.pontos=Math.max(0,Math.floor(pontos));
  try{st('bc.lobby',cur)}catch(e){}
 }
 lobbyRenderBars();
}
window.lobbySetStats=lobbySetStats;if(window.OWM)window.OWM.lobbySetStats=lobbySetStats;
function lobbyUI(on){document.body.classList.toggle('lobby-mode',!!on);const bi=document.getElementById('bInv');if(bi){if(bi.dataset.orig===undefined)bi.dataset.orig=bi.innerHTML;bi.innerHTML=on?'+':bi.dataset.orig}if(on)lobbyRenderBars()}

function lobbyHit(x,y,z){const r=.3,top=y+1.79;for(const b of LB.boxes)if(x+r>b.x0&&x-r<b.x1&&z+r>b.z0&&z-r<b.z1&&top>b.y0&&y<b.y1-.02)return true;return false}
function startLobby(){
 toast('Carregando lobby…');
 lobbyLoad().then(()=>{
  let w=ld('bc.lobby',null);
  if(!w||typeof w!=='object')w={id:'lobby',name:'Lobby',seed:1,biome:'lobby',edits:{},pos:null,hp:MAXHP,hpv:2,t:Date.now()};
  w.biome='lobby';w.pos=null;w.sxz=null;w.edits={};w.t=Date.now();w.cent=Math.max(0,Math.floor(w.cent||0));w.pontos=0;
  if(w.lobbyReady){startWorld(w);return}   // personagem já criado antes: entra direto
  openCreator({from:'mode',profile:w,confirmLabel:'Entrar no lobby',back:()=>go('mode'),after:ok=>{if(!ok)return;w.lobbyReady=true;st('bc.lobby',w);startWorld(w)}});
 }).catch(e=>{LB.promise=null;console.error('[OWM] lobby:',e);toast('Não consegui carregar o lobby.')});
}
/* ---------- Modo de jogo: Baseplate (chão plano para testes) ou Jogo principal (o menu de criação de sempre) ---------- */
const MODS=mkScreen('mode','Modo de jogo');
B('Baseplate',()=>{
 const w={id:Date.now(),name:'Baseplate '+(WL.length+1),seed:Math.random()*1e9|0,biome:'testplate',edits:{},pos:null,hp:MAXHP,hpv:2,t:Date.now()};
 openCreator({from:'mode',profile:w,confirmLabel:'Começar a jogar',back:()=>go('mode'),after:ok=>{if(!ok)return;WL.unshift(w);st('bc.w2',WL);startWorld(w)}});
},MODS);
B('Jogo principal',()=>{selW=null;renderWL();go('worlds')},MODS);
B('Lobby',startLobby,MODS);
B('Voltar',()=>go('title'),MODS);
const NS=mkScreen('new','Novo mundo'),nName=fld('Nome do mundo',NS),nSeed=fld('Semente (opcional)',NS);
/* escolha do bioma inicial: onde o jogador nasce */
const BIOME_OPTS=[['plain','Planície','Campo aberto com florestas — o início de sempre.'],['cherry','Cerejeiral','Comece entre cerejeiras em flor.'],['desert','Deserto','Comece no calor das dunas. Cuidado com o sol e os escorpiões!'],['random','Aleatório','Um bioma sorteado pela semente.']];
let nBiome='plain';
{const bf=E('div','fld',null,NS);E('label','','Bioma inicial',bf);
 const br=E('div','row biome-row',null,bf),bd=E('div','dsc',BIOME_OPTS[0][2],NS),bb={};
 BIOME_OPTS.forEach(([id,n,d])=>{bb[id]=B(n,()=>{nBiome=id;bd.textContent=d;for(const k in bb)bb[k].classList.toggle('on',k===id)},br,'tab')});
 bb.plain.classList.add('on');
 NS.resetBiome=()=>{nBiome='plain';bd.textContent=BIOME_OPTS[0][2];for(const k in bb)bb[k].classList.toggle('on',k==='plain')}}
B('Criar',()=>{
 const sd=nSeed.value.trim(),w={id:Date.now(),name:nName.value.trim()||'Meu mundo',seed:sd?(/^-?\d+$/.test(sd)?+sd|0:hash(sd)):(Math.random()*1e9|0),biome:nBiome,edits:{},pos:null,hp:MAXHP,hpv:2,t:Date.now()};
 /* o mundo só é salvo depois que o personagem é confirmado */
 openCreator({from:'new',profile:w,confirmLabel:'Começar a jogar',back:()=>go('new'),after:ok=>{if(!ok)return;WL.unshift(w);st('bc.w2',WL);startWorld(w)}});
},NS);B('Voltar',()=>go('worlds'),NS);
/* criador de personagem: abre a tela nova e devolve o estado do jogo quando fecha */
OWM.miniState=on=>{if(on){OWM.miniPrev=state;state='mini'}else state=OWM.miniPrev||'menu'};
function openCreator(o){
 const prev=state;state='creator';
 OWM.creator.open({confirmLabel:o.confirmLabel,profile:o.profile,onClose:ok=>{state=prev;if(ok){if(o.profile&&o.profile===cur)saveWorld();o.after&&o.after(true)}else o.back&&o.back()}});
}

/* ---------- Loading / pausa ---------- */
const LS=mkScreen('loading','Carregando mundo');E('i','',E('div','pg',null,LS));
function startWorld(w){if(scene.visible===false){scene.visible=true;scene.background=menuBg0;menuBg0=null}benchCraft.fill(null);if(post.dynReset)post.dynReset();bCur='';bInit=false;cWt=0;if(PET.pts)PET.pts.visible=false;musDes=false;if(OWM.musicBiome)OWM.musicBiome('');heatReset();poisonReset();scReset();treesReset();OWM.sand.reset();if(OWM.wind)OWM.wind.reset();if(OWM.cherryFog)OWM.cherryFog.reset();cur=w;inv=loadInv(w.inv);assemblyCraft=inv.a;syncWeapon();carry=null;invOpen=false;invSel=null;initWorld(w);state='loading';hudShow(false);go('loading');if(!w._mpKeepEdits)for(const k in w.edits)if(k[0]!=='p')delete w.edits[k];P.hp=(w.hp&&w.hpv===2)?w.hp:MAXHP;P.st=MAXST;P.hunger=Number.isFinite(w.hunger)?Math.max(0,Math.min(MAXHUNGER,w.hunger)):MAXHUNGER;P.thirst=Number.isFinite(w.thirst)?Math.max(0,Math.min(MAXTHIRST,w.thirst)):MAXTHIRST;P.thirstDrainDuration=Number.isFinite(w.thirstDrainDuration)?Math.max(SURV.THIRST_MIN_SECONDS,Math.min(SURV.THIRST_MAX_SECONDS,w.thirstDrainDuration)):SURV.thirstSecondsFromRoll(rng(hash('owm-thirst-duration-'+w.seed))());w.thirstDrainDuration=P.thirstDrainDuration;P.hungerZeroT=Number.isFinite(w.hungerZeroT)?Math.max(0,w.hungerZeroT):0;P.thirstZeroT=Number.isFinite(w.thirstZeroT)?Math.max(0,w.thirstZeroT):0;sprintTog=false;stLock=false;stIdle=0;stVis=0;dashT=0;dashCooldown=0;dashReadyAt=0;dashPauseAt=0;dashTrailAcc=0;dashScreenT=0;dashCdShown=-1;dashFX.forEach(f=>{scene.remove(f.lines);f.geo.dispose();f.mat.dispose()});dashFX.length=0;updateDashHUD();P.vel.set(0,0,0);P.og=false;P.landV=0;tp3=!!S.shiftLock||S.camMode===1;syncShiftLockButton();breaking=false;prog=0;playingAnim=null;const sp=w.sxz||(w.sxz=pickSpawn(w));spawn=[sp[0]+.5,hgt(sp[0],sp[1])+(w.biome==='lobby'?.05:3),sp[1]+.5];if(w.pos){P.p.set(w.pos[0],w.pos[1],w.pos[2]);P.yaw=w.pos[3];P.pitch=w.pos[4]}else{P.p.set(spawn[0],spawn[1],spawn[2]);P.yaw=P.pitch=0}P.peak=P.p.y;const pc=P.p.x>>4,pz=P.p.z>>4,need=OFF.filter(o=>o[2]<=5).reverse();const step=()=>{if(state!=='loading')return;let n=0;while(need.length&&n++<4){const o=need.pop();meshChunk(pc+o[0],pz+o[1])}need.length?requestAnimationFrame(step):beginPlay()};step()}
function lock(force=false){if(!touch&&(S.lockMouse||force)){const p=$('#c').requestPointerLock&&$('#c').requestPointerLock();if(p&&p.catch)p.catch(()=>{})}}
function beginPlay(){state='play';{const g=sup(P.p.x,P.p.z);if(P.p.y<g||P.p.y>g+8)P.p.y=g+.02;P.peak=P.p.y}unstuck();syncLeafDrops();syncAppleDrops();syncTableMeshes();syncFishMeatDrops();go('');hudShow(true);plateHud();applyAll();refreshHealth();refreshSurvivalHUD();saveT=0;lock(!!S.shiftLock);if(!touch)toast(S.lockMouse||S.shiftLock?'Clique na tela se o mouse não travar':'Mouse livre: botão direito + arrastar gira a câmera')}
function saveWorld(){if(!cur)return;cur.inv=inv;cur.pos=[P.p.x,P.p.y,P.p.z,P.yaw,P.pitch];cur.hp=P.hp;cur.hpv=2;cur.hunger=P.hunger;cur.thirst=P.thirst;cur.thirstDrainDuration=P.thirstDrainDuration;cur.hungerZeroT=P.hungerZeroT;cur.thirstZeroT=P.thirstZeroT;cur.t=Date.now();st('bc.w2',WL)}
/* Companheiro autônomo do anfitrião: entidade local, independente do jogador humano. */
const BUDDY_PEER_ID='OWM-CHATGPT-BOT';
let buddyAgent=null;
function buddyStart(){
 if(!cur)throw new Error('Entre em um mundo como anfitrião antes de chamar o ChatGPT.');
 if(buddyAgent)return true;
 const a=Math.random()*Math.PI*2,d=3.5+Math.random()*1.5,x=P.p.x+Math.cos(a)*d,z=P.p.z+Math.sin(a)*d;
 buddyAgent={x,z,y:groundH(x,z),yaw:Math.atan2(-(P.p.x-x),-(P.p.z-z)),target:null,think:0,blocked:0,mode:'explorando',bag:{},hunger:100,thirst:100,age:0};
 return true;
}
function buddyStop(){buddyAgent=null;return true}
function buddyFindProp(){
 if(!buddyAgent)return null;
 const cx=Math.floor(buddyAgent.x/CS),cz=Math.floor(buddyAgent.z/CS);let best=null,bd=15;
 for(let a=cx-1;a<=cx+1;a++)for(let b=cz-1;b<=cz+1;b++){
  const list=world.col.get(ck(a,b));if(!list)continue;
  for(const c of list){
   if(!isSmall(c))continue;
   const rem=world.edits['p'+c.cx+','+c.cz];if(rem&&rem[c.id])continue;
   const d=Math.hypot(c.x-buddyAgent.x,c.z-buddyAgent.z);
   if(d<bd&&Math.abs(c.y0-buddyAgent.y)<2.5){bd=d;best=c}
  }
 }
 return best?{x:best.x,z:best.z,kind:'prop',prop:best,d:bd}:null;
}
function buddyCollectProp(c){
 if(!buddyAgent||!c)return false;
 const remKey='p'+c.cx+','+c.cz,rem=world.edits[remKey]||(world.edits[remKey]={});
 if(rem[c.id])return false;
 rem[c.id]=1;buddyAgent.bag[c.k]=(buddyAgent.bag[c.k]||0)+1;
 if(!mpApplying&&OWM.multiplayer)OWM.multiplayer.localEdit({kind:'prop',cx:c.cx,cz:c.cz,id:c.id});
 meshChunk(c.cx,c.cz);buddyAgent.mode='coletando';buddyAgent.think=1.2;return true;
}
function buddyUpdate(dt){
 if(!buddyAgent||state!=='play')return;
 const a=buddyAgent;a.age+=dt;a.hunger=Math.max(0,a.hunger-dt*.018);a.thirst=Math.max(0,a.thirst-dt*.026);
 a.think-=dt;
 if(!a.target||a.think<=0){
  const resource=buddyFindProp();
  if(resource){a.target={x:resource.x,z:resource.z,kind:resource.kind};a.mode='procurando recursos';a.think=1.4}
  else{
   const dx=a.x-P.p.x,dz=a.z-P.p.z,dist=Math.hypot(dx,dz),ang=Math.random()*Math.PI*2,r=7+Math.random()*13;
   if(dist>31){const back=Math.atan2(-dz,-dx);a.target={x:P.p.x+Math.cos(back)*7,z:P.p.z+Math.sin(back)*7,kind:'return'};a.mode='voltando para perto'}
   else{let tx=a.x+Math.cos(ang)*r,tz=a.z+Math.sin(ang)*r;if(Math.hypot(tx-P.p.x,tz-P.p.z)>35){tx=P.p.x+Math.cos(ang)*12;tz=P.p.z+Math.sin(ang)*12}a.target={x:tx,z:tz,kind:'wander'};a.mode='explorando'}
   a.think=3.5+Math.random()*3.5;
  }
 }
 if(!a.target)return;
 const dx=a.target.x-a.x,dz=a.target.z-a.z,dist=Math.hypot(dx,dz);
 if(dist<1.35){
  if(a.target.kind==='prop'){
   const c=buddyFindProp();if(c&&Math.hypot(c.x-a.x,c.z-a.z)<1.8)buddyCollectProp(c.prop);
  }
  a.target=null;a.think=.25;return;
 }
 const step=Math.min(dist,2.75*dt),nx=a.x+dx/dist*step,nz=a.z+dz/dist*step,gy=groundH(nx,nz),oldY=a.y;
 const water=waterSurf(nx,nz),wet=Number.isFinite(water)&&water-gy>.22;
 const blocked=wet||Math.abs(gy-oldY)>1.15||hitsObj(nx,gy,nz);
 if(!blocked){a.x=nx;a.z=nz;a.y=gy;a.blocked=0}
 else{
  a.blocked+=dt;
  const sx=a.x+dx/dist*step,sz=a.z;
  if(!wet&&Math.abs(groundH(sx,sz)-oldY)<=1.15&&!hitsObj(sx,groundH(sx,sz),sz)){a.x=sx;a.y=groundH(sx,sz)}
  else{const tx=a.x,tz=a.z+dz/dist*step,ty=groundH(tx,tz);if(!wet&&Math.abs(ty-oldY)<=1.15&&!hitsObj(tx,ty,tz)){a.z=tz;a.y=ty}}
  if(a.blocked>1.2){a.target=null;a.think=0;a.blocked=0}
 }
 a.yaw=Math.atan2(-dx,-dz);
 const reached=Math.hypot(a.target.x-a.x,a.target.z-a.z);
 if(reached<1.35){if(a.target.kind==='prop'){const c=buddyFindProp();if(c&&Math.hypot(c.x-a.x,c.z-a.z)<1.9)buddyCollectProp(c.prop)}a.target=null;a.think=.3}
}
function buddyState(){return buddyAgent?{peerId:BUDDY_PEER_ID,name:'ChatGPT',x:buddyAgent.x,y:buddyAgent.y,z:buddyAgent.z,yaw:buddyAgent.yaw}:null}
/* API estreita para o módulo multiplayer: não expõe o estado interno inteiro do jogo. */
OWM.gameBridge={
 isPlaying:()=>state==='play',
 startHostWorld:w=>{if(!w||!w.id)throw new Error('Mundo inválido.');w._mpKeepEdits=true;try{startWorld(w)}finally{delete w._mpKeepEdits}return true},
 getWorldSnapshot:()=>{if(!cur)return null;saveWorld();return{id:cur.id,name:String(cur.name||'Mundo').slice(0,32),seed:cur.seed,biome:cur.biome||'plain',sxz:Array.isArray(cur.sxz)?cur.sxz.slice(0,2):null,edits:JSON.parse(JSON.stringify(cur.edits||{})),_mpKeepEdits:true}},
 startMultiplayerWorld:snap=>{if(!snap||!Number.isFinite(snap.seed)||!snap.edits||typeof snap.edits!=='object')throw new Error('Dados do mundo recebidos são inválidos.');const w={id:Date.now()+Math.floor(Math.random()*1000),name:String(snap.name||'Mundo multiplayer').slice(0,32),seed:snap.seed|0,biome:['plain','cherry','desert','random'].includes(snap.biome)?snap.biome:'plain',sxz:Array.isArray(snap.sxz)?snap.sxz.slice(0,2):null,edits:snap.edits,_mpKeepEdits:true,inv:null,pos:null,hp:MAXHP,hpv:2};const sp=w.sxz||(w.sxz=pickSpawn(w));const angle=Math.random()*Math.PI*2,off=2.5+Math.random()*2.5,x=sp[0]+.5+Math.cos(angle)*off,z=sp[1]+.5+Math.sin(angle)*off;w.pos=[x,hgt(x,z)+3,z,0,0];startWorld(w);return true},
 getPlayerState:()=>({x:P.p.x,y:P.p.y,z:P.p.z,yaw:P.yaw,name:OWM.account&&OWM.account.username||'Jogador'}),
 startBuddy:buddyStart,stopBuddy:buddyStop,updateBuddy:buddyUpdate,getBuddyState:buddyState,getBuddyInfo:()=>buddyAgent?{mode:buddyAgent.mode,bag:{...buddyAgent.bag},hunger:buddyAgent.hunger,thirst:buddyAgent.thirst}:null,
 applyEdit:edit=>{if(!edit||typeof edit!=='object')return false;mpApplying=true;try{if(edit.kind==='block'&&[edit.x,edit.y,edit.z,edit.id].every(Number.isInteger)&&Math.abs(edit.x)<100000&&Math.abs(edit.z)<100000&&edit.y>=0&&edit.y<H&&edit.id>=0&&edit.id<=255){setB(edit.x,edit.y,edit.z,edit.id);return true}if(edit.kind==='prop'&&Number.isInteger(edit.cx)&&Number.isInteger(edit.cz)&&Math.abs(edit.cx)<8192&&Math.abs(edit.cz)<8192&&(typeof edit.id==='number'||typeof edit.id==='string')&&String(edit.id).length<=32){const key='p'+edit.cx+','+edit.cz,rem=world.edits[key]||(world.edits[key]={});rem[edit.id]=1;meshChunk(edit.cx,edit.cz);return true}return false}finally{mpApplying=false}}
};
const PS=mkScreen('pause','Pausado','dim');
B('Continuar',resume,PS);B('Criador de personagem',()=>openCreator({from:'pause',profile:cur,confirmLabel:'Salvar',after:()=>go('pause'),back:()=>go('pause')}),PS);B('Configurações',()=>openSettings('pause'),PS);B('Copiar código multiplayer',()=>{const code=OWM.account&&OWM.account.peerId;if(!code){toast('Entre em uma conta primeiro.');return}if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(code).then(()=>toast('Código copiado: '+code)).catch(()=>toast('Código: '+code));else toast('Código: '+code)},PS);
const buddyPauseBtn=B('Remover ChatGPT da partida',()=>{if(!OWM.multiplayer||OWM.multiplayer.mode!=='host'){toast('Só o anfitrião pode controlar o companheiro.');return}try{const active=OWM.multiplayer.toggleBuddy();buddyPauseBtn.textContent=active?'Remover ChatGPT da partida':'Chamar ChatGPT para a partida';toast(active?'ChatGPT voltou para o mundo.':'ChatGPT saiu da partida.')}catch(e){toast(e.message||'Não foi possível alterar o companheiro.')}},PS);
function updateBuddyPauseButton(){const host=!!(OWM.multiplayer&&OWM.multiplayer.mode==='host');buddyPauseBtn.disabled=!host;buddyPauseBtn.textContent=host?(OWM.multiplayer.buddyEnabled?'Remover ChatGPT da partida':'Chamar ChatGPT para a partida'):'ChatGPT controlado pelo anfitrião'}
B('Encerrar sessão multiplayer',()=>{if(OWM.multiplayer)OWM.multiplayer.leave();toast('Sessão multiplayer encerrada.')},PS);E('div','dsc np','Rush Hour — ST: Blockade OST',PS);B('Salvar e sair',()=>{saveWorld();if(OWM.multiplayer)OWM.multiplayer.leave();coilEnd();cur=null;hudShow(false);showMenu()},PS);
function pause(){if(state!=='play')return;m2Up();JP.fly=false;craftingPrompt.classList.add('hidden');if(tablePlacement)cancelTablePlacement(false);if(dashReadyAt>0)dashPauseAt=performance.now();state='pause';cEl.classList.add('hidden');qteVis(false);breaking=false;mining=false;saveWorld();if(document.exitPointerLock)document.exitPointerLock();updateBuddyPauseButton();go('pause')}
function resume(){if(dashPauseAt>0&&dashReadyAt>0)dashReadyAt+=performance.now()-dashPauseAt;dashPauseAt=0;state='play';updateDashHUD();go('');lock()}
/* Fundo da tela inicial: 0 = panorama de sempre; 1 = SEM mundo 3D, só o efeito de tela da tempestade de areia do deserto (sandstorm.js + passe final do postprocess.js) */
let menuBg0=null;
function menuSand(dt){
 const on=S.titleBg===1,SD=OWM.sand&&OWM.sand.state;if(!SD)return false;
 if(!on){if(scene.visible===false){scene.visible=true;scene.background=menuBg0;menuBg0=null}if(SD.menu){SD.menu=false;OWM.sand.reset()}return false}
 if(scene.visible!==false){menuBg0=scene.background;scene.visible=false;scene.background=new THREE.Color(0x9a6a38)}
 if(!SD.menu||!SD.on){SD.menu=true;SD.on=true;SD.t=20;SD.dur=1e9;const a=Math.random()*6.28;SD.wx=Math.cos(a);SD.wz=Math.sin(a)}   // tempestade permanente, sem aviso
 SD.t=Math.max(SD.t,20);const sv=S.sand;S.sand=1;OWM.sand.update(dt,1);S.sand=sv;return true;
}
function showMenu(){state='menu';if(OWM.cherryFog)OWM.cherryFog.reset();if(OWM.sand)OWM.sand.reset();if(OWM.wind)OWM.wind.reset();initWorld({seed:Math.random()*1e9|0,edits:{}});go('title');applyAll()}

/* ---------- Tela de animações ---------- */
let curCat='Idle',selAnim=-1;
const AS=mkScreen('anims','Animações','dim');
const catTabs=E('div','cat-tabs',null,AS);
const catBtns={};
CATS.forEach(c=>{const b=B(c,()=>{curCat=c;updateCatTabs();renderAnims()},catTabs,'tab');catBtns[c]=b});
function updateCatTabs(){Object.entries(catBtns).forEach(([k,b])=>b.classList.toggle('on',k===curCat))}
const aList=E('div','list',null,AS),aRow=E('div','row',null,AS);
const aPlay=B('Tocar',()=>{if(selAnim<0)return;const anims=ld('bc.anims',[]),a=anims[selAnim];if(!a)return;if(OWM.isMainHubOpen&&OWM.isMainHubOpen())OWM.closeMainHub();playingAnim=a;animTime=0;state='play';go('');lock();},aRow);
const aEdit=B('Editar',()=>{if(selAnim>=0)openAnimEditor(selAnim,curCat)},aRow);
const aDel=B('Apagar',()=>{if(selAnim<0)return;const a=ld('bc.anims',[]);a.splice(selAnim,1);st('bc.anims',a);selAnim=-1;renderAnims()},aRow);
B('Nova animação',()=>openAnimEditor(-1,curCat),AS);
function renderAnims(){aList.textContent='';const anims=ld('bc.anims',[]);const filtered=anims.map((a,i)=>({a,i})).filter(x=>x.a.category===curCat);if(!filtered.length)E('div','dsc','Nenhuma animação em "'+curCat+'"',aList);filtered.forEach(({a,i})=>{const d=E('div','w'+(i===selAnim?' on':''),null,aList),t=E('div','',null,d);E('p','',a.name,t);E('p','','Duração: '+a.duration.toFixed(1)+'s',t);d.onclick=()=>{selAnim=i;renderAnims()}});aPlay.disabled=aEdit.disabled=aDel.disabled=selAnim<0}
function openAnimEditor(index,cat){animEditorFromHub=!!(OWM.isMainHubOpen&&OWM.isMainHubOpen());if(animEditorFromHub)mainHub.classList.add('hidden');state='animedit';OWM.animedit.open(index,cat)}

/* ---------- Menu principal em tela cheia ---------- */
const mainHub=E('div','main-hub hidden',null,document.body);
const mainHubNav=E('nav','main-hub-nav',null,mainHub);mainHubNav.setAttribute('aria-label','Menu principal');
const mainHubContent=E('main','main-hub-content',null,mainHub);
const mainHubClose=E('button','main-hub-close','×',mainHub);mainHubClose.type='button';mainHubClose.setAttribute('aria-label','Fechar menu');
let mainHubReturn='title',mainHubCurrent='friends';
const hubSections=[
 {id:'friends',label:'Amigos',svg:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>'},
 {id:'minigames',label:'Minigame',svg:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h4m-2-2v4m8-3h.01M18 13h.01M7 6h10a4 4 0 0 1 3.9 3.1l1 4.2a3 3 0 0 1-4.8 3L14 14H10l-3.1 2.3a3 3 0 0 1-4.8-3l1-4.2A4 4 0 0 1 7 6Z"/></svg>'},
 {id:'settings',label:'Configurações',svg:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" transform="translate(-1 -1)"/></svg>'},
 {id:'visuals',label:'Visuais',svg:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>'},
 {id:'animations',label:'Animações',svg:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM8 3v4m8-4v4M4 9h16M9 13l-1 3m7-3 1 3m-7-3 1 3"/><path d="m11 12 2 2-2 2"/></svg>'}
];
const hubNavButtons={};
function attachMainHubScreen(id){const el=OWM.screens&&OWM.screens[id];if(el&&el.parentElement!==mainHubContent){mainHubContent.appendChild(el);el.classList.add('hub-embedded-screen')}return el||null}
function setHubActive(id){Object.entries(hubNavButtons).forEach(([key,b])=>b.classList.toggle('on',key===id));mainHubCurrent=id}
function showMainHubScreen(id){attachMainHubScreen(id);go(id);}
function showMainHubSection(id){setHubActive(id);
 if(id==='settings'||id==='visuals'){attachMainHubScreen('settings');SS.querySelector('h2').textContent=id==='visuals'?'Visuais':'Configurações';sg.classList.toggle('hidden',id==='visuals');vg.classList.toggle('hidden',id!=='visuals');showMainHubScreen('settings');return}
 if(id==='animations'){updateCatTabs();renderAnims();showMainHubScreen('anims');return}
 if(id==='friends'){if(OWM.account&&OWM.account.open)OWM.account.open();else{attachMainHubScreen('friends');showMainHubScreen('friends')}return}
 if(id==='minigames'){if(OWM.tokensOpen)OWM.tokensOpen();else{attachMainHubScreen('tokens');showMainHubScreen('tokens')}return}
}
function openMainHub(section='friends',returnScreen){mainHubReturn=returnScreen||(state==='pause'?'pause':'title');mainHub.classList.remove('hidden');showMainHubSection(section)}
function closeMainHub(){mainHub.classList.add('hidden');go(mainHubReturn||'title')}
for(const item of hubSections){const b=E('button','main-hub-item',null,mainHubNav);b.type='button';b.title=item.label;b.setAttribute('aria-label',item.label);b.innerHTML=item.svg+`<span>${item.label}</span>`;b.onclick=()=>showMainHubSection(item.id);hubNavButtons[item.id]=b}
mainHubClose.onclick=closeMainHub;
attachMainHubScreen('settings');attachMainHubScreen('anims');attachMainHubScreen('tokens');
OWM.attachMainHubScreen=attachMainHubScreen;OWM.isMainHubOpen=()=>!mainHub.classList.contains('hidden');OWM.showMainHubScreen=showMainHubScreen;OWM.showMainHubSection=showMainHubSection;OWM.openMainHub=openMainHub;OWM.closeMainHub=closeMainHub;
OWM.animedit.onClose=(savedCat)=>{if(savedCat){curCat=savedCat;updateCatTabs()}state='menu';if(animEditorFromHub){mainHub.classList.remove('hidden');OWM.showMainHubScreen('anims')}else go('anims');animEditorFromHub=false;renderAnims();anim.reloadIdle()};
B('Estúdio de animação',()=>{animStudioPrev=state;animStudioFromHub=!!(OWM.isMainHubOpen&&OWM.isMainHubOpen());if(animStudioFromHub)mainHub.classList.add('hidden');state='animstudio';OWM.animstudio.open()},AS);


/* ---------- Inventário, fabricação, armas e coleta ---------- */
/* Mochila 4x10 + grade de fabricação 3x3 com slot de resultado + visualizador de arma (slot 'w').
   Um clique seleciona, o 2º clique em outro slot move/junta/troca. Dois cliques no MESMO slot: descrição, separar pilha e equipar.
   Separar: escolhe a quantidade (padrão = metade), ela fica "na mão" e vai pra qualquer slot; o resto fica onde estava. */
const INV_N=40,CR_N=9,BENCH_ROWS=3,BENCH_COLS=6,BENCH_N=BENCH_ROWS*BENCH_COLS,STACK=64;
const WPS=OWM.weapons||{};
const ITEMS={
 log:{n:'Tora',d:'Um tronco robusto. Dois deles formam o cabo de ferramentas e armas.'},
 rock:{n:'Pedra',d:'Pedra pequena e dura. Boa para fazer lâminas.'},
 wood:{n:'Madeira',d:'Madeira cortada de uma árvore derrubada no soco.'},
 leaf:{n:'Folha',d:'Uma folha verde caída de uma árvore.'},
 fish_meat:{n:'Carne de peixe',d:'Carne fresca de um peixe de rio. Comer recupera 17 pontos de fome.',stack:64},
 table:{n:'Mesa de trabalho',d:'Mesa de madeira para usar como estação de fabricação. Receita: 3 madeiras na fileira central e 1 madeira em cada canto inferior. Use “Colocar” para posicionar a mesa no mundo.',stack:16}
};
if(WPS.knife)ITEMS.knife={n:WPS.knife.n,d:WPS.knife.d,stack:1,equip:true,w:'knife'};
ITEMS.knife_handle={n:'Haste da faca',d:'Haste de madeira preparada para montar uma faca. Receita: duas toras na vertical.',stack:16};
ITEMS.knife_blade={n:'Parte cortante de pedra',d:'Pedaço de pedra lascada em formato de lâmina. Receita: duas pedras na vertical.',stack:16};
if(WPS.knife_intermediate)ITEMS.knife_intermediate={n:WPS.knife_intermediate.n,d:WPS.knife_intermediate.d,stack:1,equip:true,w:'knife_intermediate'};
if(WPS.stone_knife)ITEMS.stone_knife={n:WPS.stone_knife.n,d:WPS.stone_knife.d,stack:1,equip:true,w:'stone_knife'};
/* Maçã: pode cair de árvores derrubadas (ver dropApples). APPLE_TREE_CHANCE = chance de a árvore soltar maçãs; APPLE_MAX_DROP = máximo por árvore. */
const APPLE_FOOD=20,APPLE_TREE_CHANCE=.5,APPLE_MAX_DROP=3;
ITEMS.apple={n:'Maçã',d:'Uma maçã fresca caída de uma árvore. Comer recupera '+APPLE_FOOD+' pontos de fome.',stack:64};
/* Itens comestíveis: item -> fome recuperada. Aparece o botão “Comer” no detalhe do item. */
const FOOD={fish_meat:FISH_MEAT_FOOD,apple:APPLE_FOOD};
const maxStack=t=>(ITEMS[t]&&ITEMS[t].stack)||STACK,isEq=t=>!!(ITEMS[t]&&ITEMS[t].equip);
/* Receitas em padrão de linhas × colunas. Itens {t,n} pedem uma quantidade mínima na pilha do slot. */
const RECIPES=[
 {out:'knife_handle',n:1,pat:[['log'],['log']],hint:'duas toras, uma sobre a outra (vertical).'}, // duas toras verticais viram a haste
 {out:'knife_blade',n:1,pat:[['rock'],['rock']],hint:'duas pedras, uma sobre a outra (vertical).'}, // duas pedras verticais viram a parte cortante
 {out:'table',n:1,exact:true,pat:[[null,null,null],['wood','wood','wood'],['wood',null,'wood']],hint:'3 madeiras na fileira central e 1 em cada canto de baixo (grade 3×3).'}, // mesa: fileira central + cantos inferiores
 {out:'knife_intermediate',n:1,pat:[['knife_handle'],[{t:'leaf',n:5}],['knife_blade']],hint:'haste, pilha de 5 folhas e lâmina, na vertical.'}, // haste, uma pilha de 5 folhas, lâmina: tudo na vertical; pode fabricar no inventário
 {out:'stone_knife',n:1,station:true,assembly:true,pat:[['knife_handle'],['knife_blade']],hint:'montagem: encaixe uma haste e uma lâmina nos espaços próprios da mesa de trabalho.'} // faca normal: montagem exclusiva na bancada
];
const newInv=()=>({s:Array(INV_N).fill(null),c:Array(CR_N).fill(null),w:[null],a:[null,null]});
// A grade da bancada é independente da grade 3×3 do inventário: 18 slots (6×3).
let benchCraft=Array(BENCH_N).fill(null);
function loadInv(o){const r=newInv();if(o)for(const k of['s','c','w','a'])for(let i=0;i<r[k].length;i++){const it=o[k]&&o[k][i];if(it&&ITEMS[it.t]&&it.n>0){if(k==='a'&&!assemblySlotAccepts(i,it.t))continue;r[k][i]={t:it.t,n:Math.min(maxStack(it.t),it.n|0)}}}if(r.w[0]&&!isEq(r.w[0].t)){const i=r.s.findIndex(x=>!x);if(i>=0)r.s[i]=r.w[0];r.w[0]=null}return r}
let inv=newInv(),assemblyCraft=inv.a,invSel=null,invOpen=false,carry=null,popOpen=false,lastSel=null;
function invRoom(t){const M=maxStack(t);let r=0;for(const it of inv.s){if(!it)r+=M;else if(it.t===t)r+=M-it.n}return r}
function invAdd(t,n){if(invRoom(t)<n)return false;const M=maxStack(t);for(const it of inv.s)if(it&&it.t===t&&n>0){const m=Math.min(n,M-it.n);it.n+=m;n-=m}for(let i=0;i<INV_N&&n>0;i++)if(!inv.s[i]){const m=Math.min(n,M);inv.s[i]={t,n:m};n-=m}return true}
function syncWeapon(){const it=inv.w[0];OWM.weapon.id=it&&ITEMS[it.t]?ITEMS[it.t].w:null}
function findRecipe(atBench=false){
 const grid=atBench?benchCraft:inv.c,rows=atBench?BENCH_ROWS:3,cols=atBench?BENCH_COLS:3;
 for(const rc of RECIPES){if(rc.assembly||rc.station&&!atBench)continue;const ph=rc.pat.length,pw=Math.max(...rc.pat.map(r=>r.length));
  if(ph>rows||pw>cols)continue;
  const maxY=rc.exact?0:rows-ph,maxX=rc.exact?0:cols-pw;
  for(let oy=0;oy<=maxY;oy++)for(let ox=0;ox<=maxX;ox++){
   let ok=true;const used=[];
   for(let r=0;r<rows&&ok;r++)for(let c=0;c<cols;c++){
    const pr=r-oy,pc=c-ox,raw=(pr>=0&&pr<ph&&pc>=0&&pc<rc.pat[pr].length)?rc.pat[pr][pc]:null;
    const want=raw&&typeof raw==='object'?raw.t:raw,need=raw&&typeof raw==='object'?(raw.n||1):1,cell=grid[r*cols+c];
    if(want){if(!cell||cell.t!==want||cell.n<need){ok=false;break}used.push({i:r*cols+c,n:need})}
    else if(cell){ok=false;break}
   }
   if(ok)return{rc,used,grid};
  }
 }
 return null;
}
function doCraft(atBench=false){
 const m=findRecipe(atBench);if(!m){toast(atBench?'Receita inválida: confira a ordem e a quantidade dos ingredientes.':'Receita inválida no inventário.');return}
 const{rc,used,grid}=m;
 if(invRoom(rc.out)<rc.n){toast('Inventário cheio');return}
 for(const u of used){const it=grid[u.i];it.n-=u.n;if(it.n<=0)grid[u.i]=null}
 invAdd(rc.out,rc.n);toast('Fabricado: '+ITEMS[rc.out].n);invRender();if(typeof benchRender==='function')benchRender();
}

/* ---------- Livro de receitas: lista as receitas e fabrica direto da mochila, se houver os recursos ---------- */
function recipeNeeds(rc){const m=new Map();for(const row of rc.pat)for(const raw of row){if(!raw)continue;const t=typeof raw==='object'?raw.t:raw,n=typeof raw==='object'?(raw.n||1):1;m.set(t,(m.get(t)||0)+n)}return[...m]}
function invCount(t){let n=0;for(const it of inv.s)if(it&&it.t===t)n+=it.n;return n}
function bookCraft(rc){
 if(rc.station&&!benchOpen){toast('Esta receita precisa da mesa de trabalho');return}
 if(rc.assembly){if(!benchOpen){toast('Esta receita precisa da mesa de trabalho');return}closePop();setBenchMode('assembly');toast('Coloque a haste e a lâmina nos espaços de montagem.');return}
 const needs=recipeNeeds(rc);
 for(const[t,n]of needs)if(invCount(t)<n){toast('Faltam recursos');return}
 const snap=inv.s.map(it=>it?{t:it.t,n:it.n}:null);   // cópia para desfazer se o resultado não couber
 for(const[t,n]of needs){let left=n;for(let i=INV_N-1;i>=0&&left>0;i--){const it=inv.s[i];if(it&&it.t===t){const m=Math.min(left,it.n);it.n-=m;left-=m;if(it.n<=0)inv.s[i]=null}}}
 if(!invAdd(rc.out,rc.n)){snap.forEach((v,i)=>{inv.s[i]=v});toast('Inventário cheio');return}
 invSel=null;toast('Fabricado: '+ITEMS[rc.out].n);invRender();renderBook();
}

const IS=mkScreen('inv','Inventário','dim'),pnE=E('div','pn inv-shell',null,IS),piE=E('div','pi',null,pnE);
const cbnE=E('div','cbn hidden',null,piE);
const invHeader=E('div','inv-header',null,piE),invHeadTitle=E('div','inv-head-title','Mochila',invHeader),invSummary=E('div','inv-summary','0/40 espaços ocupados',invHeader);
const invTabs=E('div','inv-tabs',null,piE),invBagBtn=B('Mochila',()=>switchInvTab('bag'),invTabs,'tab inv-tab'),invManualBtn=B('Preparação manual',()=>switchInvTab('manual'),invTabs,'tab inv-tab');
const invBagPanel=E('div','inv-panel inv-bag-panel',null,piE),colsE=E('div','cols inv-cols',null,invBagPanel),col1=E('div','col inv-bag-col',null,colsE),col2=E('div','col inv-equipment-col',null,colsE);
E('div','ih','Itens carregados',col1);const mgE=E('div','ig backpack-grid',null,col1);
E('div','chint','Toque em um item e depois em outro espaço para mover. Toque duas vezes para ver detalhes.',col1);
const bookBtn=B('Livro de receitas',()=>openBook(),col1,'bookbtn');bookBtn.title='Ver receitas e fabricar com os itens da mochila';
E('div','ih','Equipamento',col2);const equipCard=E('div','equip-card',null,col2);E('div','equip-label','Mão principal',equipCard);
const wvE=E('div','slot wv',null,equipCard),wvCv=E('canvas','',null,wvE),wvTx=E('div','wvt',null,wvE),wvNm=E('div','wvn',null,wvE);
const equipHint=E('div','equip-hint','Nenhuma arma equipada.',col2);
const invManualPanel=E('div','inv-panel inv-manual-panel hidden',null,piE),manualCol=E('div','col',null,invManualPanel);
E('div','ih','Preparação manual · 3×3',manualCol);
const crE=E('div','crow',null,manualCol),cgE=E('div','ig cg',null,crE);E('div','car','➜',crE);const resE=E('div','slot res',null,crE);
E('div','chint','Use a grade para preparar componentes e objetos simples. As receitas completas continuam no livro.',manualCol);
E('div','chint','A faca normal não é fabricada nesta grade: ela exige montagem na mesa de trabalho.',manualCol);
B('Livro de receitas',()=>openBook(),manualCol,'bookbtn');
let invTab='bag';
function switchInvTab(tab){invTab=tab;const bag=tab==='bag';invBagPanel.classList.toggle('hidden',!bag);invManualPanel.classList.toggle('hidden',bag);invBagBtn.classList.toggle('on',bag);invManualBtn.classList.toggle('on',!bag);invHeadTitle.textContent=bag?'Mochila':'Preparação manual'}
B('Fechar',()=>closeInv(),IS);
const popE=E('div','ipop hidden',null,IS),carryE=E('div','carry hidden',null,IS);
const bookE=E('div','ipop hidden',null,IS);let bookOpen=false;
function iconInto(p,t,cls){const src=t==='log'?'log-inventory.png':ICON[t];if(src){const im=E('img',cls,null,p);im.src=src;im.draggable=false}else E('i','it '+t+' '+cls,null,p)}
function renderBook(){
 const prev=bookE.querySelector('.bk-list'),st=prev?prev.scrollTop:0;
 bookE.textContent='';bookE.onclick=e=>{if(e.target===bookE)closePop()};
 const c=E('div','ipc bk',null,bookE),h=E('div','bk-h',null,c);
 if(ICON.recipe_book){const im=E('img','',null,h);im.src=ICON.recipe_book;im.draggable=false}
 const ht=E('div','',null,h);E('div','ipn','Livro de receitas',ht);
 E('div','ipq',benchOpen?'Você está na mesa de trabalho: todas as receitas estão liberadas.':'Receitas marcadas com “mesa” só podem ser fabricadas na mesa de trabalho.',ht);
 E('div','chint','As receitas usam os itens da mochila. Receitas de montagem exigem a mesa de trabalho. Vermelho = falta; verde = disponível.',c);
 const list=E('div','bk-list',null,c);
 for(const rc of RECIPES){
  const needs=recipeNeeds(rc),card=E('div','bk-card',null,list),top=E('div','bk-top',null,card);
  iconInto(top,rc.out,'bk-ic');
  const nm=E('div','',null,top);E('div','bk-n',(rc.n>1?rc.n+'× ':'')+ITEMS[rc.out].n,nm);
  if(rc.assembly)E('div','bk-tag','Montagem na mesa de trabalho',nm);else if(rc.station)E('div','bk-tag','Requer mesa de trabalho',nm);
  const ing=E('div','bk-ing',null,card);let ok=true;
  for(const[t,n]of needs){const have=invCount(t),enough=have>=n;if(!enough)ok=false;
   const chip=E('div','bk-chip '+(enough?'ok':'no'),null,ing);iconInto(chip,t,'bk-ci');E('span','',ITEMS[t].n+' '+have+'/'+n,chip)}
  if(rc.hint)E('div','bk-hint',(rc.assembly?'Montagem: ':'Fabricação manual: ')+rc.hint,card);
  const needBench=!!rc.station&&!benchOpen;
  const actionLabel=needBench?'Precisa da mesa de trabalho':rc.assembly?(ok?'Abrir montagem':'Faltam recursos'):ok?'Fabricar':'Faltam recursos';
  const b=B(actionLabel,()=>bookCraft(rc),card,'ipb bk-go');
  b.disabled=needBench||!ok;
 }
 const row=E('div','ipr',null,c);B('Fechar',closePop,row,'ipb');
 list.scrollTop=st;
}
function openBook(){if(!invOpen&&!benchOpen)return;closePop();popOpen=true;bookOpen=true;bookE.classList.remove('hidden');renderBook()}
const slotEl={s:[],c:[],w:[wvE]};
function mkSlots(g,k,n){for(let i=0;i<n;i++){const d=E('div','slot',null,g);d.onclick=()=>slotClick(k,i);slotEl[k].push(d)}}
mkSlots(cgE,'c',CR_N);mkSlots(mgE,'s',INV_N);
resE.onclick=()=>{if(carry)return;doCraft()};wvE.onclick=()=>slotClick('w',0);
IS.addEventListener('pointermove',e=>{if(carry){carryE.style.left=e.clientX+'px';carryE.style.top=e.clientY+'px'}});
IS.addEventListener('pointerdown',e=>{if(carry){carryE.style.left=e.clientX+'px';carryE.style.top=e.clientY+'px'}});

/* Ícones = render dos próprios modelos 3D (tora, pedra pequena e faca), feito uma vez com um renderer temporário. */
const ICON={leaf:'leaf-pickup.png'};let iconsDone=false;
function makePartIcon(kind){const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');g.clearRect(0,0,96,96);g.lineJoin='round';g.lineCap='round';
 if(kind==='knife_handle'){g.fillStyle='#79502e';g.strokeStyle='#352416';g.lineWidth=4;g.beginPath();g.moveTo(42,13);g.lineTo(55,18);g.lineTo(53,79);g.lineTo(40,83);g.closePath();g.fill();g.stroke();g.strokeStyle='#b88651';g.lineWidth=3;for(let y=28;y<74;y+=14){g.beginPath();g.moveTo(43,y);g.lineTo(52,y+2);g.stroke()}}
 else if(kind==='knife_blade'){g.fillStyle='#999da5';g.strokeStyle='#444750';g.lineWidth=4;g.beginPath();g.moveTo(38,80);g.lineTo(31,51);g.lineTo(37,27);g.lineTo(49,10);g.lineTo(62,31);g.lineTo(65,54);g.lineTo(55,80);g.closePath();g.fill();g.stroke();g.fillStyle='#d4d6dc';g.beginPath();g.moveTo(38,77);g.lineTo(37,28);g.lineTo(49,10);g.lineTo(46,53);g.closePath();g.fill()}
 else {g.fillStyle='#79502e';g.strokeStyle='#352416';g.lineWidth=4;g.beginPath();g.moveTo(42,53);g.lineTo(54,53);g.lineTo(53,85);g.lineTo(41,85);g.closePath();g.fill();g.stroke();g.fillStyle='#969aa2';g.beginPath();g.moveTo(38,55);g.lineTo(31,35);g.lineTo(49,8);g.lineTo(65,34);g.lineTo(57,55);g.closePath();g.fill();g.stroke();if(kind==='knife_intermediate'){g.strokeStyle='#79aa37';g.lineWidth=5;for(let y=47;y<=55;y+=4){g.beginPath();g.moveTo(36,y);g.lineTo(59,y-3);g.stroke()}}}
 return c.toDataURL('image/png')}
ICON.knife_handle=makePartIcon('knife_handle');ICON.knife_blade=makePartIcon('knife_blade');ICON.knife_intermediate=makePartIcon('knife_intermediate');ICON.stone_knife=makePartIcon('stone_knife');
// Ícone da maçã (desenhado; o modelo 3D é usado só para a maçã caída no chão).
{const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');g.lineJoin='round';g.lineCap='round';
 g.fillStyle='#c62d24';g.strokeStyle='#5a120e';g.lineWidth=4;g.beginPath();g.moveTo(48,32);g.bezierCurveTo(40,22,16,26,16,54);g.bezierCurveTo(16,76,32,89,42,87);g.bezierCurveTo(46,86,50,86,54,87);g.bezierCurveTo(64,89,80,76,80,54);g.bezierCurveTo(80,26,56,22,48,32);g.closePath();g.fill();g.stroke();
 g.fillStyle='#ee6f60';g.beginPath();g.ellipse(32,52,5.5,11,.35,0,Math.PI*2);g.fill();
 g.strokeStyle='#5a3a1a';g.lineWidth=5;g.beginPath();g.moveTo(48,33);g.quadraticCurveTo(48,22,54,13);g.stroke();
 g.fillStyle='#5aa83a';g.strokeStyle='#2c5a1c';g.lineWidth=3;g.beginPath();g.moveTo(52,24);g.quadraticCurveTo(62,9,79,15);g.quadraticCurveTo(70,30,52,24);g.closePath();g.fill();g.stroke();
 ICON.apple=c.toDataURL('image/png')}
// Ícone do livro de receitas.
{const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');g.lineJoin='round';g.lineCap='round';
 g.fillStyle='#efe3c2';g.strokeStyle='#3b2412';g.lineWidth=4;g.beginPath();g.rect(26,14,56,70);g.fill();g.stroke();
 g.fillStyle='#8a3b2b';g.beginPath();g.moveTo(14,18);g.lineTo(70,10);g.lineTo(70,80);g.lineTo(14,88);g.closePath();g.fill();g.stroke();
 g.strokeStyle='#e0b24a';g.lineWidth=3;g.beginPath();g.moveTo(24,28);g.lineTo(60,23);g.moveTo(24,74);g.lineTo(60,69);g.stroke();
 g.fillStyle='#e0b24a';g.beginPath();g.arc(42,49,9,0,Math.PI*2);g.fill();g.strokeStyle='#8a5a12';g.lineWidth=2;g.stroke();
 g.fillStyle='#c62d24';g.beginPath();g.moveTo(58,10);g.lineTo(66,9);g.lineTo(66,34);g.lineTo(62,30);g.lineTo(58,35);g.closePath();g.fill();
 ICON.recipe_book=c.toDataURL('image/png')}
// Ícone próprio da mesa para mochila e janela de detalhes.
{const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');g.clearRect(0,0,96,96);g.lineJoin='round';g.fillStyle='#8e5428';g.strokeStyle='#482b17';g.lineWidth=4;g.beginPath();g.moveTo(13,28);g.lineTo(49,12);g.lineTo(84,29);g.lineTo(48,46);g.closePath();g.fill();g.stroke();g.fillStyle='#b77a3b';g.beginPath();g.moveTo(13,28);g.lineTo(48,46);g.lineTo(84,29);g.lineTo(49,12);g.closePath();g.fill();g.stroke();g.fillStyle='#71421f';g.beginPath();g.moveTo(20,39);g.lineTo(30,43);g.lineTo(28,76);g.lineTo(19,72);g.closePath();g.fill();g.stroke();g.beginPath();g.moveTo(69,43);g.lineTo(79,38);g.lineTo(80,70);g.lineTo(70,75);g.closePath();g.fill();g.stroke();g.fillStyle='#d9a15d';g.lineWidth=2;g.beginPath();g.moveTo(20,27);g.lineTo(48,15);g.lineTo(75,28);g.lineTo(48,40);g.closePath();g.stroke();ICON.table=c.toDataURL('image/png')}
function buildIcons(){
 if(iconsDone)return;iconsDone=true;
 try{
  const W=160,rr=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
  rr.setPixelRatio(1);rr.setSize(W,W,false);rr.outputEncoding=THREE.sRGBEncoding;rr.setClearColor(0x000000,0);
  const sc=new THREE.Scene();sc.add(new THREE.HemisphereLight(0xffffff,0x6f685f,.95));const dl=new THREE.DirectionalLight(0xfff0d8,1.05);dl.position.set(-2,3.2,2.4);sc.add(dl);
  const srcs={log:PROTO.log[0],wood:PROTO.log[0],rock:PROTO.rock[3]||PROTO.rock[0]};
  for(const k in srcs){const pr=srcs[k];if(!pr)continue;
   const P=pr.pos,n=P.length/3,pp=new Float32Array(P.length),cc=new Float32Array(P.length);
   for(let i=0;i<P.length;i++)pp[i]=P[i]/100;
   const tw=k==='wood'?[1.45,1.2,.8]:[1,1,1];   // madeira: mesmo modelo da tora, mais clara/alaranjada
   for(let i=0;i<n;i++){const c=pr.pal[pr.col[i]];cc[i*3]=c[0]*tw[0];cc[i*3+1]=c[1]*tw[1];cc[i*3+2]=c[2]*tw[2]}
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pp,3));geo.setAttribute('normal',new THREE.BufferAttribute(pr.nor,3));geo.setAttribute('color',new THREE.BufferAttribute(cc,3));geo.setIndex(new THREE.BufferAttribute(pr.idx,1));
   geo.computeBoundingBox();const bb=geo.boundingBox,ctr=bb.getCenter(new THREE.Vector3()),r=bb.getSize(new THREE.Vector3()).length()*.43;
   const m=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({vertexColors:true}));m.position.copy(ctr).negate();const holder=new THREE.Group();holder.add(m);if(k==='log'||k==='wood')holder.rotation.y=-.55;sc.add(holder);
   const oc=new THREE.OrthographicCamera(-r,r,r,-r,.1,r*10);oc.position.set(r*1.5,r*1.2,r*2.2);oc.lookAt(0,0,0);
   rr.render(sc,oc);ICON[k]=rr.domElement.toDataURL('image/png');
   sc.remove(holder);geo.dispose();m.material.dispose();
  }
  if(OWM.makeKnife&&WPS.knife){   // faca de combate na diagonal, mostrando a face plana da lâmina
   const kn=OWM.makeKnife(),h=new THREE.Group();kn.position.y=-.085;h.add(kn);h.rotation.set(0,-.35,-.8);sc.add(h);
   const r=.2,oc=new THREE.OrthographicCamera(-r,r,r,-r,.05,5);oc.position.set(.25,.2,.5);oc.lookAt(0,0,0);
   rr.render(sc,oc);ICON.knife=rr.domElement.toDataURL('image/png');sc.remove(h);
  }
  if(OWM.makeWeapon&&OWM.stoneKnifeModelReady){ // o ícone da faca normal usa o mesmo modelo GLTF equipado pelo jogador
   const kn=OWM.makeWeapon('stone_knife'),h=new THREE.Group();kn.position.y=-.085;h.add(kn);h.rotation.set(.12,-.45,-.72);sc.add(h);
   const r=.24,oc=new THREE.OrthographicCamera(-r,r,r,-r,.05,5);oc.position.set(.25,.19,.58);oc.lookAt(0,.03,0);
   rr.render(sc,oc);ICON.stone_knife=rr.domElement.toDataURL('image/png');sc.remove(h);
  }
  rr.dispose();if(rr.forceContextLoss)rr.forceContextLoss();
 }catch(e){console.warn('[OWM] Ícones 3D indisponíveis, usando formas simples.',e)}
}

/* ---------- Visualizador de arma (renderer próprio, só roda com o inventário aberto) ---------- */
const WV={ok:null,r:null,sc:null,cam:null,pivot:null,obj:null,id:null,modelVersion:0,ry:.6,t:0,raf:0,w:0,h:0,drag:false,moved:false,px:0};
function wvInit(){
 if(WV.ok!==null)return WV.ok;
 try{
  const r=new THREE.WebGLRenderer({canvas:wvCv,alpha:true,antialias:true});r.outputEncoding=THREE.sRGBEncoding;r.setClearColor(0x000000,0);
  const sc=new THREE.Scene();sc.add(new THREE.HemisphereLight(0xffffff,0x6f685f,.95));
  const d1=new THREE.DirectionalLight(0xfff0d8,1.1);d1.position.set(-1.5,2.5,2);sc.add(d1);
  const d2=new THREE.DirectionalLight(0x9db8ff,.55);d2.position.set(2,.6,-2);sc.add(d2);
  const cam=new THREE.PerspectiveCamera(32,1.5,.05,5);cam.position.set(0,.02,.74);cam.lookAt(0,0,0);
  const pivot=new THREE.Group();sc.add(pivot);
  Object.assign(WV,{ok:true,r,sc,cam,pivot});
  wvE.addEventListener('pointerdown',e=>{WV.drag=true;WV.moved=false;WV.px=e.clientX});
  addEventListener('pointermove',e=>{if(!WV.drag)return;const dx=e.clientX-WV.px;if(Math.abs(dx)>3)WV.moved=true;if(WV.moved){WV.ry+=dx*.012;WV.px=e.clientX}});
  addEventListener('pointerup',()=>{WV.drag=false});
 }catch(e){WV.ok=false;console.warn('[OWM] Visualizador de arma indisponível.',e)}
 return WV.ok;
}
function wvSet(id){
 const modelVersion=OWM.stoneKnifeModelVersion||0;
 if(!WV.ok||(WV.id===id&&WV.modelVersion===modelVersion))return;WV.id=id;WV.modelVersion=modelVersion;
 if(WV.obj){WV.pivot.remove(WV.obj);WV.obj=null}
 if(id&&WPS[id]&&OWM.makeWeapon){const tilt=new THREE.Group(),kn=OWM.makeWeapon(id);kn.position.y=-.085;tilt.add(kn);tilt.rotation.z=-.5;WV.pivot.add(tilt);WV.obj=tilt}
}
function wvLoop(now){
 WV.raf=0;if(!invOpen||!WV.ok)return;WV.raf=requestAnimationFrame(wvLoop);
 if(WV.id&&(WV.modelVersion!==(OWM.stoneKnifeModelVersion||0)))wvSet(WV.id);
 const dt=Math.min(.05,(now-WV.t)/1000);WV.t=now;
 const w=wvE.clientWidth,h=wvE.clientHeight;if(!w||!h||!WV.obj)return;
 if(w!==WV.w||h!==WV.h){WV.w=w;WV.h=h;WV.r.setPixelRatio(Math.min(2,devicePixelRatio||1));WV.r.setSize(w,h,false);WV.cam.aspect=w/h;WV.cam.updateProjectionMatrix()}
 if(!WV.drag)WV.ry+=dt*.9;WV.pivot.rotation.y=WV.ry;WV.r.render(WV.sc,WV.cam);
}
/* Se o GLTF termina de carregar depois da primeira abertura do inventário, refaz o ícone e a lista visível. */
OWM.onStoneKnifeModelReady=()=>{
 iconsDone=false;
 if(invOpen){buildIcons();invRender()}
 if(benchOpen){buildIcons();benchRender()}
};
function wvRefresh(){
 const it=inv.w[0],id=it&&ITEMS[it.t]?ITEMS[it.t].w:null,W=id&&WPS[id];
 wvCv.style.display=W?'block':'none';
 wvTx.textContent=W?'':'Nenhuma arma equipada';
 wvNm.textContent=W?W.n+' · dano '+W.dmg:'Punhos · dano '+SCP.PUNCH;
 if(W&&wvInit()){wvSet(id);if(invOpen&&!WV.raf){WV.t=performance.now();WV.raf=requestAnimationFrame(wvLoop)}}
 wvE.title=W?W.n:'';
}

/* ---------- Render e interação ---------- */
const fillSlot=(d,it)=>{d.textContent='';d.title=it?ITEMS[it.t].n:'';if(it){const src=it.t==='log'?'log-inventory.png':ICON[it.t];if(src){const im=E('img','it',null,d);im.src=src;im.draggable=false}else E('i','it '+it.t,null,d);if(it.n>1)E('b','',it.n,d)}};
function invRender(){
 for(const k of['s','c'])inv[k].forEach((it,i)=>{const d=slotEl[k][i];fillSlot(d,it);d.classList.toggle('sel',!!invSel&&invSel.k===k&&invSel.i===i)});
 const occupied=inv.s.filter(Boolean).length;invSummary.textContent=occupied+'/'+INV_N+' espaços ocupados';equipHint.textContent=inv.w[0]?'Equipado: '+ITEMS[inv.w[0].t].n:'Nenhuma arma equipada.';
 const m=findRecipe(false);fillSlot(resE,m?{t:m.rc.out,n:m.rc.n}:null);resE.classList.toggle('on',!!m);if(m)resE.title='Fabricar: '+ITEMS[m.rc.out].n;
 wvRefresh();wvE.classList.toggle('sel',!!invSel&&invSel.k==='w');
 cbnE.classList.toggle('hidden',!carry);carryE.classList.toggle('hidden',!carry);
 if(carry){cbnE.textContent='Na mão: '+carry.n+'× '+ITEMS[carry.t].n+' — clique num slot para soltar (Esc cancela)';fillSlot(carryE,carry)}
 if(benchOpen)benchRender();
}
function slotsFor(k){return k==='bc'?benchCraft:k==='ac'?assemblyCraft:inv[k]}
function assemblySlotAccepts(i,t){return i===0?t==='knife_handle':i===1?t==='knife_blade':false}
function moveItem(a,k,i){
 const src=slotsFor(a.k)[a.i],dst=slotsFor(k)[i];if(!src)return;
 if(k==='ac'&&!assemblySlotAccepts(i,src.t)){toast(i===0?'Este espaço aceita apenas a haste.':'Este espaço aceita apenas a lâmina.');return}
 if(a.k==='ac'&&dst&&!assemblySlotAccepts(a.i,dst.t)){toast('Esse componente não cabe neste espaço.');return}
 if(k==='w'){if(!isEq(src.t)){toast('Só armas podem ser equipadas aqui');return}}
 else if(a.k==='w'&&dst&&!isEq(dst.t)){toast('Slot ocupado');return}
 if(!dst){slotsFor(k)[i]=src;slotsFor(a.k)[a.i]=null}
 else if(dst.t===src.t&&maxStack(dst.t)>1){const m=Math.min(src.n,maxStack(dst.t)-dst.n);dst.n+=m;src.n-=m;if(src.n<=0)slotsFor(a.k)[a.i]=null}
 else{slotsFor(k)[i]=src;slotsFor(a.k)[a.i]=dst}
 if(k==='w'||a.k==='w'){syncWeapon();if(inv.w[0])toast('Equipado: '+ITEMS[inv.w[0].t].n)}
}
function slotClick(k,i){
 if(k==='w'&&WV.moved){WV.moved=false;return}   // arrastou o visualizador pra girar: não conta como clique
 if(carry){placeCarry(k,i);if(benchOpen)saveWorld();return}
 const now=performance.now(),it=slotsFor(k)[i];
 if(it&&lastSel&&lastSel.k===k&&lastSel.i===i&&now-lastSel.t<420){lastSel=null;invSel=null;invRender();openPop(k,i);return}
 if(!invSel){if(it){invSel={k,i};lastSel={k,i,t:now}}invRender();return}
 lastSel=null;const a=invSel;invSel=null;
 if(a.k!==k||a.i!==i)moveItem(a,k,i);
 invRender();if(benchOpen)saveWorld();
}
/* separar: tira 'n' do slot (k,i) e segura na mão */
function startCarry(k,i,n){const arr=slotsFor(k),it=arr[i];if(!it||n<1||n>=it.n)return;it.n-=n;carry={t:it.t,n,k,i};closePop();invRender();if(benchOpen)saveWorld()}
function placeCarry(k,i){
 const arr=slotsFor(k),dst=arr[i],M=maxStack(carry.t);
 if(k==='ac'&&!assemblySlotAccepts(i,carry.t)){toast(i===0?'Este espaço aceita apenas a haste.':'Este espaço aceita apenas a lâmina.');return}
 if(k==='w'){if(!isEq(carry.t)||carry.n>1||dst){toast('Não dá pra equipar isso aqui');return}}
 if(!dst){arr[i]={t:carry.t,n:carry.n};carry=null}
 else if(dst.t===carry.t){const m=Math.min(carry.n,M-dst.n);if(m<=0){toast('Slot cheio');return}dst.n+=m;carry.n-=m;if(carry.n<=0)carry=null}
 else{toast('Slot ocupado');return}
 if(k==='w')syncWeapon();invRender();if(benchOpen)saveWorld();
}
function dropCarry(){
 if(!carry)return;const c=carry;carry=null;const arr=slotsFor(c.k),o=arr[c.i];
 if(!o)arr[c.i]={t:c.t,n:c.n};else if(o.t===c.t&&o.n+c.n<=maxStack(c.t))o.n+=c.n;else if(!invAdd(c.t,c.n))toast('Sem espaço: itens da mão perdidos');
 invRender();if(benchOpen)saveWorld();
}
function equipSlot(k,i){
 const arr=slotsFor(k),it=arr[i];if(!it||!isEq(it.t)||k==='w')return;
 const old=inv.w[0];inv.w[0]=it;arr[i]=old||null;syncWeapon();toast('Equipado: '+ITEMS[it.t].n);invRender();
}
function unequip(){
 const it=inv.w[0];if(!it)return;
 if(!invAdd(it.t,it.n)){toast('Inventário cheio');return}
 inv.w[0]=null;syncWeapon();invRender();
}
/* Comer uma unidade de carne pelo menu de detalhes do inventário. */
function eatItem(k,i){const arr=slotsFor(k),it=arr[i];if(!it||!FOOD[it.t])return;if(P.hunger>=MAXHUNGER-.001){toast('A fome já está cheia');return}const amt=FOOD[it.t];P.hunger=SURV.eat(P.hunger,amt);it.n--;if(it.n<=0)arr[i]=null;closePop();refreshSurvivalHUD();saveWorld();invRender();toast('+'+amt+' de fome');}
/* janelinha de detalhes (duplo clique) */
function openPop(k,i){
 const it=slotsFor(k)[i];if(!it)return;const I=ITEMS[it.t],W=I.w&&WPS[I.w];
 popE.textContent='';popE.classList.remove('hidden');popOpen=true;
 popE.onclick=e=>{if(e.target===popE)closePop()};
 const c=E('div','ipc',null,popE),h=E('div','iph',null,c);
 const itemIcon=it.t==='log'?'log-inventory.png':ICON[it.t];if(itemIcon){const im=E('img','',null,h);im.src=itemIcon;im.draggable=false}else E('i','it '+it.t,null,h);
 const hh=E('div','',null,h);E('div','ipn',I.n,hh);E('div','ipq','Quantidade: '+it.n,hh);
 E('div','ipd',I.d,c);
 if(W){const s=E('div','ips',null,c);E('span','','Dano '+W.dmg,s);E('span','','Golpe a cada '+W.cd.toFixed(2).replace('.',',')+' s',s);E('span','','Punhos: dano '+SCP.PUNCH,s)}
 if(it.n>=2&&maxStack(it.t)>1){
  const sp=E('div','ipsp',null,c),lb=E('div','ipl',null,sp),rg=E('input','',null,sp);
  rg.type='range';rg.min=1;rg.max=it.n-1;rg.value=Math.floor(it.n/2);
  const upd=()=>{lb.textContent='Separar: '+rg.value+' (fica '+(it.n-rg.value)+' aqui)'};upd();rg.oninput=upd;
  B('Separar',()=>startCarry(k,i,+rg.value),sp,'ipb');
 }
 const row=E('div','ipr',null,c);
 if(FOOD[it.t])B('Comer',()=>eatItem(k,i),row,'ipb');
 if(it.t==='table'&&k!=='bc')B('Colocar',()=>{closePop();if(k==='s')closeInv();startTablePlacement(k,i)},row,'ipb');
 if(isEq(it.t)){if(k==='w')B('Desequipar',()=>{closePop();unequip()},row,'ipb');else B('Equipar',()=>{closePop();equipSlot(k,i)},row,'ipb')}
 B('Fechar',closePop,row,'ipb');
}
function closePop(){popOpen=false;popE.classList.add('hidden');popE.textContent='';bookOpen=false;bookE.classList.add('hidden');bookE.textContent=''}
function openInv(){if(state!=='play')return;craftingPrompt.classList.add('hidden');state='pause';breaking=false;mining=false;cEl.classList.add('hidden');qteVis(false);if(document.exitPointerLock)document.exitPointerLock();invOpen=true;invSel=null;lastSel=null;switchInvTab('bag');buildIcons();invRender();go('inv')}
function closeInv(){if(!invOpen)return;dropCarry();closePop();invOpen=false;invSel=null;saveWorld();resume()}
/* ---------- Interface dedicada da mesa: grade grande à esquerda e mochila à direita ---------- */
const BS=mkScreen('bench','Mesa de trabalho','dim'),benchTabs=E('div','bench-tabs',null,BS),benchRecipesBtn=B('Receitas e grade',()=>setBenchMode('recipes'),benchTabs,'tab'),benchAssemblyBtn=B('Montagem',()=>setBenchMode('assembly'),benchTabs,'tab');
const benchLayout=E('div','bench-layout',null,BS),benchCraftCol=E('div','bench-col bench-crafting',null,benchLayout),benchAssemblyCol=E('div','bench-col bench-assembly hidden',null,benchLayout),benchInvCol=E('div','bench-col bench-backpack',null,benchLayout);
E('div','ih','Preparação manual · grade 6×3',benchCraftCol);E('div','bench-desc','Combine os itens na grade para criar componentes e objetos simples. A montagem da faca normal fica na aba Montagem.',benchCraftCol);
const benchCraftRow=E('div','bench-craft-row',null,benchCraftCol),benchGrid=E('div','ig bench-grid',null,benchCraftRow);E('div','car bench-arrow','➜',benchCraftRow);const benchRes=E('div','slot res bench-result',null,benchCraftRow);
const benchHint=E('div','chint bench-hint','A faca intermediária continua disponível pela receita vertical: haste / 5 folhas / lâmina.',benchCraftCol);
E('div','ih','Montagem de componentes',benchAssemblyCol);E('div','bench-desc','A faca normal é montada aqui. Coloque uma haste e uma lâmina nos espaços correspondentes.',benchAssemblyCol);
const assemblyRow=E('div','assembly-row',null,benchAssemblyCol),assemblySlotEls=[];
[['Haste','knife_handle'],['Lâmina','knife_blade']].forEach(([label],i)=>{const wrap=E('div','assembly-part',null,assemblyRow);E('div','assembly-part-label',label,wrap);const slot=E('div','slot assembly-slot',null,wrap);slot.onclick=()=>slotClick('ac',i);assemblySlotEls.push(slot);if(i===0)E('div','assembly-plus','+',assemblyRow)});
E('div','assembly-arrow','➜',assemblyRow);const benchAssemblyResult=E('div','slot res assembly-result',null,assemblyRow);
const assemblyStatus=E('div','chint bench-hint','Use uma haste preparada e uma parte cortante de pedra.',benchAssemblyCol);
const assembleBtn=B('Montar faca de pedra',assembleStoneKnife,benchAssemblyCol,'assemble-btn');
const returnAssemblyBtn=B('Devolver componentes',returnAssemblyComponents,benchAssemblyCol,'assemble-return');
E('div','ih','Mochila',benchInvCol);const benchInvGrid=E('div','ig bench-inv-grid',null,benchInvCol);E('div','chint','Selecione itens e mova para a grade ou para os espaços de montagem.',benchInvCol);const benchBookBtn=B('Livro de receitas',()=>openBook(),benchInvCol,'bookbtn');
const benchSlotEl=[];for(let i=0;i<BENCH_N;i++){const d=E('div','slot bench-slot',null,benchGrid);d.onclick=()=>slotClick('bc',i);benchSlotEl.push(d)}
const benchInvSlotEl=[];for(let i=0;i<INV_N;i++){const d=E('div','slot bench-inv-slot',null,benchInvGrid);d.onclick=()=>slotClick('s',i);benchInvSlotEl.push(d)}
benchRes.onclick=()=>{if(!carry)doCraft(true)};
BS.addEventListener('pointermove',e=>{if(carry){carryE.style.left=e.clientX+'px';carryE.style.top=e.clientY+'px'}});
B('Fechar',closeBench,BS);
let benchOpen=false,benchMode='recipes';
function setBenchMode(mode){benchMode=mode==='assembly'?'assembly':'recipes';const a=benchMode==='assembly';benchCraftCol.classList.toggle('hidden',a);benchAssemblyCol.classList.toggle('hidden',!a);benchRecipesBtn.classList.toggle('on',!a);benchAssemblyBtn.classList.toggle('on',a);benchLayout.classList.toggle('assembly-mode',a);if(a)benchRender()}
function assemblyReady(){return !!(assemblyCraft[0]&&assemblyCraft[0].t==='knife_handle'&&assemblyCraft[0].n>0&&assemblyCraft[1]&&assemblyCraft[1].t==='knife_blade'&&assemblyCraft[1].n>0)}
function assembleStoneKnife(){
 if(!benchOpen){toast('A faca normal só pode ser montada na mesa de trabalho.');return}
 if(!assemblyReady()){toast('Coloque uma haste e uma lâmina nos espaços de montagem.');return}
 if(invRoom('stone_knife')<1){toast('Mochila sem espaço para a faca.');return}
 assemblyCraft[0].n--;if(assemblyCraft[0].n<=0)assemblyCraft[0]=null;assemblyCraft[1].n--;if(assemblyCraft[1].n<=0)assemblyCraft[1]=null;
 invAdd('stone_knife',1);toast('Faca de pedra montada!');invRender();benchRender();saveWorld();
}
function returnAssemblyComponents(){
 for(let i=0;i<assemblyCraft.length;i++){const it=assemblyCraft[i];if(!it)continue;if(!invAdd(it.t,it.n)){toast('Abra espaço na mochila antes de devolver os componentes.');if(cur)saveWorld();return false}assemblyCraft[i]=null;if(cur)saveWorld()}
 if(typeof benchRender==='function')benchRender();return true;
}
function benchRender(){
 for(let i=0;i<BENCH_N;i++){const d=benchSlotEl[i],it=benchCraft[i];fillSlot(d,it);d.classList.toggle('sel',!!invSel&&invSel.k==='bc'&&invSel.i===i)}
 for(let i=0;i<INV_N;i++){const d=benchInvSlotEl[i],it=inv.s[i];fillSlot(d,it);d.classList.toggle('sel',!!invSel&&invSel.k==='s'&&invSel.i===i)}
 const m=findRecipe(true);fillSlot(benchRes,m?{t:m.rc.out,n:m.rc.n}:null);benchRes.classList.toggle('on',!!m);benchRes.title=m?'Fabricar: '+ITEMS[m.rc.out].n:'';
 for(let i=0;i<assemblySlotEls.length;i++){const d=assemblySlotEls[i];fillSlot(d,assemblyCraft[i]);d.classList.toggle('sel',!!invSel&&invSel.k==='ac'&&invSel.i===i);d.title=i===0?'Espaço para haste': 'Espaço para lâmina'}
 const ready=assemblyReady();fillSlot(benchAssemblyResult,ready?{t:'stone_knife',n:1}:null);benchAssemblyResult.classList.toggle('on',ready);benchAssemblyResult.title=ready?'Faca de pedra pronta para montagem':'Aguardando componentes';
 assemblyStatus.textContent=ready?'Componentes prontos. A montagem consome 1 haste e 1 lâmina.':'Coloque uma haste preparada e uma parte cortante de pedra.';
 assembleBtn.disabled=!ready||invRoom('stone_knife')<1;returnAssemblyBtn.disabled=!assemblyCraft.some(Boolean);
 cbnE.classList.toggle('hidden',!carry);carryE.classList.toggle('hidden',!carry);
 if(carry){cbnE.textContent='Na mão: '+carry.n+'× '+ITEMS[carry.t].n+' — clique num slot para soltar (Esc cancela)';fillSlot(carryE,carry)}
}
function openBench(){if(state!=='play')return;state='pause';craftingPrompt.classList.add('hidden');breaking=false;mining=false;cEl.classList.add('hidden');qteVis(false);if(document.exitPointerLock)document.exitPointerLock();invOpen=false;invSel=null;lastSel=null;benchOpen=true;setBenchMode('recipes');BS.appendChild(popE);BS.appendChild(bookE);BS.appendChild(carryE);buildIcons();benchRender();go('bench')}
function closeBench(){if(!benchOpen)return;dropCarry();if(!returnAssemblyComponents())return;closePop();benchOpen=false;IS.appendChild(popE);IS.appendChild(bookE);IS.appendChild(carryE);invSel=null;saveWorld();state='play';go('');lock()}

addEventListener('keydown',e=>{
 if(benchOpen){if(bookOpen&&(e.code==='Escape'||e.code==='KeyE'||e.code==='KeyR')){e.preventDefault();closePop();return}if(e.code==='KeyR'){e.preventDefault();openBook();return}if(e.code==='Escape'||e.code==='KeyE'){e.preventDefault();closeBench()}return}
 if(!invOpen)return;
 if(e.code==='KeyR'){e.preventDefault();if(bookOpen)closePop();else openBook();return}
 if(e.code==='Escape'){e.preventDefault();if(popOpen)closePop();else if(carry)dropCarry();else closeInv()}
 else if(e.code==='KeyE'){e.preventDefault();if(popOpen)closePop();else closeInv()}
});
/* Folhas persistentes no chão: o item fica salvo nos edits do mundo até ser coletado. */
const LEAF_DROP_GEO=new THREE.PlaneGeometry(.82,.43);
const LEAF_DROP_TEX=new THREE.TextureLoader().load('leaf-pickup.png');
LEAF_DROP_TEX.encoding=THREE.sRGBEncoding;LEAF_DROP_TEX.anisotropy=Math.min(4,R.capabilities.getMaxAnisotropy());
const LEAF_DROP_MAT=new THREE.MeshBasicMaterial({map:LEAF_DROP_TEX,transparent:true,alphaTest:.12,side:THREE.DoubleSide,depthWrite:false});
const leafDropMeshes=new Map();let leafSyncT=0;
const leafDropKey=(cx,cz)=>'pl'+cx+','+cz;
function clearLeafDropMeshes(){for(const m of leafDropMeshes.values())scene.remove(m);leafDropMeshes.clear();leafSyncT=0}
function addGroundLeaf(x,z){
 const y=groundH(x,z);if(waterSurf(x,z)-y>.12)return;
 const cx=Math.floor(x/CS),cz=Math.floor(z/CS),key=leafDropKey(cx,cz),list=world.edits[key]||(world.edits[key]=[]);
 // No item should be generated in a lake or river; otherwise it remains until picked up.
 const id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
 list.push({id,x,z,r:Math.random()*Math.PI*2});leafSyncT=0;
}
function findLeafDrop(cx,cz,id){const list=world.edits[leafDropKey(cx,cz)];return Array.isArray(list)?list.find(v=>String(v.id)===String(id)):null}
function syncLeafDrops(){
 const pcx=Math.floor(P.p.x/CS),pcz=Math.floor(P.p.z/CS),keep=new Set();
 for(let cx=pcx-3;cx<=pcx+3;cx++)for(let cz=pcz-3;cz<=pcz+3;cz++){
  const list=world.edits[leafDropKey(cx,cz)];if(!Array.isArray(list))continue;
  for(const d of list){if(!d||d.id==null||!Number.isFinite(d.x)||!Number.isFinite(d.z))continue;
   const id=String(d.id);keep.add(id);let m=leafDropMeshes.get(id);
   if(!m){m=new THREE.Mesh(LEAF_DROP_GEO,LEAF_DROP_MAT);m.rotation.x=-Math.PI/2+.07;m.rotation.y=Number(d.r)||0;m.renderOrder=2;m.userData.leafPickup={id:d.id,cx,cz};scene.add(m);leafDropMeshes.set(id,m)}
   m.position.set(d.x,groundH(d.x,d.z)+.035,d.z);
  }
 } for(const[id,m]of leafDropMeshes)if(!keep.has(id)){scene.remove(m);leafDropMeshes.delete(id)}
}
function updateLeafDrops(dt){leafSyncT-=dt;if(leafSyncT<=0){leafSyncT=.45;syncLeafDrops()}}
function leafCollectTarget(d,cx,cz){return{k:'leaf',id:d.id,cx,cz,x:d.x,z:d.z,y0:groundH(d.x,d.z),hy:.04,hx:.41,hz:.22}}
OWM.leaves.setLandingCallback(addGroundLeaf);

/* ---------- Maçãs: caem das árvores derrubadas e ficam salvas no mundo até serem coletadas ---------- */
const APPLE_SIZE=.3;   // tamanho (m) da maçã no chão
let appleBase=null;
if(THREE.GLTFLoader&&OWM.applePack){
 try{new THREE.GLTFLoader().parse(JSON.stringify(OWM.applePack),'',g=>{
  try{const root=g.scene;root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),size=new THREE.Vector3(),ctr=new THREE.Vector3();box.getSize(size);box.getCenter(ctr);
   const sc=APPLE_SIZE/Math.max(size.x,size.y,size.z,1e-4),inner=new THREE.Group(),holder=new THREE.Group();
   root.position.set(-ctr.x,-box.min.y,-ctr.z);inner.add(root);inner.scale.setScalar(sc);holder.add(inner);appleBase=holder}
  catch(e){console.warn('[OWM] Maçã: falha ao preparar o modelo; usando modelo simples.',e)}
 },e=>console.warn('[OWM] Maçã: modelo GLB não carregou; usando modelo simples.',e))}
 catch(e){console.warn('[OWM] Maçã: modelo indisponível; usando modelo simples.',e)}
}
const APPLE_FB_GEO=new THREE.SphereGeometry(APPLE_SIZE*.5,10,8),APPLE_FB_MAT=new THREE.MeshStandardMaterial({color:0xc8261c,roughness:.7}),APPLE_HIT_GEO=new THREE.SphereGeometry(.42,6,4);
function makeAppleMesh(){
 if(appleBase)return appleBase.clone(true);
 const g=new THREE.Group(),b=new THREE.Mesh(APPLE_FB_GEO,APPLE_FB_MAT);b.position.y=APPLE_SIZE*.5;g.add(b);return g;
}
const appleDropKey=(cx,cz)=>'pa'+cx+','+cz;
const appleDropMeshes=new Map();let appleSyncT=0;
function clearAppleDropMeshes(){for(const m of appleDropMeshes.values())scene.remove(m);appleDropMeshes.clear();appleSyncT=0}
function findAppleDrop(cx,cz,id){const l=world.edits[appleDropKey(cx,cz)];return Array.isArray(l)?l.find(v=>String(v.id)===String(id)):null}
function addAppleDrop(x,z){
 const cx=Math.floor(x/CS),cz=Math.floor(z/CS),key=appleDropKey(cx,cz),list=world.edits[key]||(world.edits[key]=[]);
 const id='apple-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
 list.push({id,x,z,r:Math.random()*Math.PI*2,b:Date.now()});appleSyncT=0;
}
function syncAppleDrops(){
 const pcx=Math.floor(P.p.x/CS),pcz=Math.floor(P.p.z/CS),keep=new Set(),now=Date.now();
 for(let cx=pcx-3;cx<=pcx+3;cx++)for(let cz=pcz-3;cz<=pcz+3;cz++){
  const list=world.edits[appleDropKey(cx,cz)];if(!Array.isArray(list))continue;
  for(const d of list){if(!d||d.id==null||!Number.isFinite(d.x)||!Number.isFinite(d.z))continue;
   const id=String(d.id);keep.add(id);let m=appleDropMeshes.get(id);
   if(!m){m=new THREE.Group();const body=makeAppleMesh();body.rotation.y=Number(d.r)||0;m.add(body);
    const hit=new THREE.Mesh(APPLE_HIT_GEO,APPLE_FB_MAT);hit.visible=false;hit.position.y=.15;m.add(hit);   // área de toque generosa (invisível)
    m.userData.applePickup={id:d.id,cx,cz};m.userData.dy=(now-(Number(d.b)||0)<1500)?2.2+Math.random()*.8:0;m.userData.vy=0;   // recém-caída: cai da copa
    scene.add(m);appleDropMeshes.set(id,m)}
   m.userData.gy=groundH(d.x,d.z)+.01;m.position.set(d.x,m.userData.gy+m.userData.dy,d.z);
  }
 }
 for(const[id,m]of appleDropMeshes)if(!keep.has(id)){scene.remove(m);appleDropMeshes.delete(id)}
}
function updateAppleDrops(dt){
 appleSyncT-=dt;if(appleSyncT<=0){appleSyncT=.45;syncAppleDrops()}
 for(const m of appleDropMeshes.values()){const u=m.userData;if(u.dy>0){u.vy-=16*dt;u.dy+=u.vy*dt;if(u.dy<=0){if(u.vy<-3.2){u.dy=1e-4;u.vy=-u.vy*.32}else{u.dy=0;u.vy=0}}m.position.y=u.gy+u.dy}}
}
/* Ao terminar de derrubar a árvore: chance de soltar de 1 a APPLE_MAX_DROP maçãs ao redor da copa caída. Árvores mortas não dão maçã. */
function dropApples(f){
 if(String(f.c.k).startsWith('dead')||Math.random()>=APPLE_TREE_CHANCE)return 0;
 const n=1+Math.floor(Math.random()*APPLE_MAX_DROP);let placed=0;
 for(let i=0;i<n;i++){
  let x=f.c.x,z=f.c.z,ok=false;
  for(let t=0;t<8&&!ok;t++){const d=1.6+Math.random()*2.8,side=(Math.random()-.5)*2.6,px=f.c.x+f.dx*d-f.dz*side,pz=f.c.z+f.dz*d+f.dx*side;if(waterSurf(px,pz)-groundH(px,pz)>.12)continue;x=px;z=pz;ok=true}
  if(!ok&&waterSurf(x,z)-groundH(x,z)>.12)continue;   // nada de maçã dentro d'água
  addAppleDrop(x,z);placed++;
 }
 return placed;
}

/* ---------- Mesa de trabalho: modelo, posicionamento e persistência ---------- */
const tableMeshes=new Map();
let tableBase=null,tableLoading=true,tableLoadFailed=false,tablePlacement=null,tablePreview=null,tableSyncT=0,tableTapStart=null,tableTouchStart=null,tablePlacedAt=0;
const tableKey=(cx,cz)=>'pt'+cx+','+cz;
const craftingPrompt=document.createElement('button');craftingPrompt.id='craft-use';craftingPrompt.className='hidden';craftingPrompt.type='button';craftingPrompt.textContent='Crafting';craftingPrompt.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openBench()});document.body.appendChild(craftingPrompt);
let nearbyCraftTable=null;
function updateBenchPrompt(){
 if(state!=='play'||tablePlacement||!tableMeshes.size){craftingPrompt.classList.add('hidden');nearbyCraftTable=null;return}
 let best=null,bd=3.25;
 for(const m of tableMeshes.values()){const d=Math.hypot(m.position.x-P.p.x,m.position.z-P.p.z);if(d<bd){bd=d;best=m}}
 nearbyCraftTable=best;
 if(!best){craftingPrompt.classList.add('hidden');return}
 cam.updateMatrixWorld();const q=new THREE.Vector3(best.position.x,best.position.y+1.0,best.position.z).project(cam);
 if(q.z>1||Math.abs(q.x)>1.05||Math.abs(q.y)>1.05){craftingPrompt.classList.add('hidden');return}
 craftingPrompt.style.left=((q.x*.5+.5)*innerWidth)+'px';craftingPrompt.style.top=((-q.y*.5+.5)*innerHeight)+'px';craftingPrompt.classList.remove('hidden');
}

function normalizeTableModel(root){
 const wrap=new THREE.Group();wrap.add(root);wrap.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(root),center=bounds.getCenter(new THREE.Vector3());
 root.position.x-=center.x;root.position.y-=bounds.min.y;root.position.z-=center.z;root.updateMatrixWorld(true);
 root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
 tableBase=wrap;tableLoading=false;tableLoadFailed=false;
 if(tablePlacement)ensureTablePreview();tableSyncT=0;syncTableMeshes();
}
function fallbackTableModel(){
 const g=new THREE.Group(),wood=new THREE.MeshStandardMaterial({color:0x93602f,roughness:.86}),topMat=new THREE.MeshStandardMaterial({color:0xb47a43,roughness:.8});
 const add=(x,y,z,sx,sy,sz,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m)};
 add(0,.72,0,1.8,.12,.9,topMat);for(const x of[-.75,.75])for(const z of[-.32,.32])add(x,.36,z,.12,.66,.12,wood);return g;
}
function cloneTableModel(ghost=false){
 if(!tableBase)return null;const obj=tableBase.clone(true);
 obj.traverse(o=>{if(!o.isMesh)return;o.castShadow=!ghost;o.receiveShadow=!ghost;if(ghost){o.material=new THREE.MeshBasicMaterial({color:0x36ff62,transparent:true,opacity:.42,depthWrite:false,side:THREE.DoubleSide});o.renderOrder=8}});
 return obj;
}
function ensureTablePreview(){if(!tablePlacement||tablePreview||!tableBase)return;tablePreview=cloneTableModel(true);if(tablePreview){tablePreview.userData.tablePreview=true;scene.add(tablePreview)}}
function removeTablePreview(){if(!tablePreview)return;scene.remove(tablePreview);tablePreview.traverse(o=>{if(o.isMesh&&o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose()}});tablePreview=null}
function tableTargetPosition(){const yaw=P.yaw||0,dist=3.0,x=P.p.x-Math.sin(yaw)*dist,z=P.p.z-Math.cos(yaw)*dist;return{x,z,y:groundH(x,z),yaw}}
function updateTablePlacement(){
 if(!tablePlacement)return;ensureTablePreview();const pos=tableTargetPosition();tablePlacement.pos=pos;
 if(tablePreview){tablePreview.position.set(pos.x,pos.y+.025,pos.z);tablePreview.rotation.set(0,pos.yaw,0)}
}
function clearTableMeshes(){
 for(const m of tableMeshes.values())scene.remove(m);tableMeshes.clear();
 removeTablePreview();tablePlacement=null;tableTapStart=null;tableTouchStart=null;tableSyncT=0;
}
function syncTableMeshes(){
 if(!tableBase||!world.edits||!P||!P.p)return;
 const pcx=Math.floor(P.p.x/CS),pcz=Math.floor(P.p.z/CS),keep=new Set();
 for(let cx=pcx-3;cx<=pcx+3;cx++)for(let cz=pcz-3;cz<=pcz+3;cz++){
  const list=world.edits[tableKey(cx,cz)];if(!Array.isArray(list))continue;
  for(const d of list){if(!d||d.id==null||!Number.isFinite(d.x)||!Number.isFinite(d.z))continue;const id=String(d.id);keep.add(id);let m=tableMeshes.get(id);
   if(!m){m=cloneTableModel(false);if(!m)continue;m.userData.tablePlacedId=id;scene.add(m);tableMeshes.set(id,m)}
   m.position.set(d.x,groundH(d.x,d.z)+.008,d.z);m.rotation.set(0,Number(d.yaw)||0,0);
  }
 }
 for(const[id,m]of tableMeshes)if(!keep.has(id)){scene.remove(m);tableMeshes.delete(id)}
}
function updatePlacedTables(dt){tableSyncT-=dt;if(tableSyncT<=0){tableSyncT=.45;syncTableMeshes()}}
function startTablePlacement(k,i){
 const it=inv[k]&&inv[k][i];if(!it||it.t!=='table'){toast('Mesa não encontrada no inventário');return}
 removeTablePreview();
 tablePlacement={k,i,pos:null,lastTap:0,tapX:0,tapY:0};ensureTablePreview();updateTablePlacement();
 toast(tableBase?'Mesa: toque/clique duas vezes na tela para colocar. Esc cancela.':'Carregando modelo da mesa…');
}
function cancelTablePlacement(show=true){
 if(!tablePlacement)return;removeTablePreview();tablePlacement=null;tableTapStart=null;tableTouchStart=null;if(show)toast('Posicionamento cancelado');
}
function commitTablePlacement(){
 if(!tablePlacement||state!=='play')return;const p=tablePlacement,pos=p.pos||tableTargetPosition();let it=inv[p.k]&&inv[p.k][p.i];
 if(!it||it.t!=='table'||it.n<1){const idx=inv.s.findIndex(q=>q&&q.t==='table'&&q.n>0);if(idx<0){cancelTablePlacement(false);toast('Você não tem mais uma mesa');return}p.k='s';p.i=idx;it=inv.s[idx]}
 const cx=Math.floor(pos.x/CS),cz=Math.floor(pos.z/CS),key=tableKey(cx,cz),list=world.edits[key]||(world.edits[key]=[]),id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
 list.push({id,x:pos.x,z:pos.z,yaw:pos.yaw});it.n--;if(it.n<=0)inv[p.k][p.i]=null;
 removeTablePreview();tablePlacement=null;tableTapStart=null;tableTouchStart=null;tablePlacedAt=performance.now();tableSyncT=0;syncTableMeshes();invRender();saveWorld();toast('Mesa colocada!');
}
function handleTablePlacementTap(x,y){
 if(!tablePlacement||state!=='play')return false;const now=performance.now(),p=tablePlacement;
 if(p.lastTap&&now-p.lastTap<=460&&Math.hypot(x-p.tapX,y-p.tapY)<=90){commitTablePlacement();return true}
 p.lastTap=now;p.tapX=x;p.tapY=y;toast('Toque/clique novamente para colocar a mesa');return true;
}
// GLB com texturas PBR. O modelo fallback mantém a receita jogável se a carga do arquivo falhar.
if(THREE.GLTFLoader){new THREE.GLTFLoader().load('wood_table_pbr_low-poly.glb',g=>normalizeTableModel(g.scene),undefined,e=>{tableLoadFailed=true;console.warn('[OWM] Não foi possível carregar a mesa GLB; usando modelo simples.',e);normalizeTableModel(fallbackTableModel())})}
else{tableLoadFailed=true;normalizeTableModel(fallbackTableModel())}

/* coleta: texto "Coletar" sobre a tora, pedra pequena ou folha mais próxima */
const cEl=$('#collect'),_cv=new THREE.Vector3();let cTgt=null,cT=0;
cEl.textContent=touch?'Coletar':'Coletar [F]';
/* coletável = toda tora, ou pedra pequena (até ~0,6 m de altura e ~1,4 m de largura) */
const isSmall=c=>c.k==='log'||(c.k==='rock'&&c.hy<=.6&&c.hx<=.7&&c.hz<=.7);
function findCollect(){
 let best=null,bd=2.4;const px=P.p.x,pz=P.p.z,pcx=Math.floor(px/CS),pcz=Math.floor(pz/CS);
 for(let a=pcx-1;a<=pcx+1;a++)for(let b=pcz-1;b<=pcz+1;b++){const l=world.col.get(ck(a,b));if(!l)continue;
  for(const c of l){if(!isSmall(c))continue;if(Math.abs(c.y0-P.p.y)>2.5)continue;
   const d=Math.hypot(c.x-px,c.z-pz)-Math.max(c.hx,c.hz);if(d<bd){bd=d;best=c}}}
 for(let a=pcx-3;a<=pcx+3;a++)for(let b=pcz-3;b<=pcz+3;b++){
  const list=world.edits[leafDropKey(a,b)];if(!Array.isArray(list))continue;
  for(const d of list){if(!d||!Number.isFinite(d.x)||!Number.isFinite(d.z))continue;const gy=groundH(d.x,d.z);if(Math.abs(gy-P.p.y)>2.5)continue;
   const dist=Math.hypot(d.x-px,d.z-pz)-.42;if(dist<bd){bd=dist;best=leafCollectTarget(d,a,b)}}}
 for(let a=pcx-3;a<=pcx+3;a++)for(let b=pcz-3;b<=pcz+3;b++){
  const list=world.edits[fishMeatKey(a,b)];if(!Array.isArray(list))continue;
  for(const d of list){if(!d||!Number.isFinite(d.x)||!Number.isFinite(d.z))continue;const gy=groundH(d.x,d.z);if(Math.abs(gy-P.p.y)>2.5)continue;
   const dist=Math.hypot(d.x-px,d.z-pz)-.28;if(dist<bd){bd=dist;best={k:'fish_meat',id:d.id,cx:a,cz:b,x:d.x,z:d.z,y0:gy,hy:.22,hx:.24,hz:.2}}}}
 for(let a=pcx-3;a<=pcx+3;a++)for(let b=pcz-3;b<=pcz+3;b++){
  const list=world.edits[appleDropKey(a,b)];if(!Array.isArray(list))continue;
  for(const d of list){if(!d||!Number.isFinite(d.x)||!Number.isFinite(d.z))continue;const gy=groundH(d.x,d.z);if(Math.abs(gy-P.p.y)>2.5)continue;
   const dist=Math.hypot(d.x-px,d.z-pz)-.3;if(dist<bd){bd=dist;best={k:'apple',id:d.id,cx:a,cz:b,x:d.x,z:d.z,y0:gy,hy:.3,hx:.2,hz:.2}}}}
 return best}
function updateCollect(dt){
 cT-=dt;if(cT<=0){cT=.12;cTgt=findCollect()}
 if(cTgt&&cTgt.k==='leaf'){if(!findLeafDrop(cTgt.cx,cTgt.cz,cTgt.id))cTgt=null}
 else if(cTgt&&cTgt.k==='fish_meat'){if(!findFishMeatDrop(cTgt.cx,cTgt.cz,cTgt.id))cTgt=null}
 else if(cTgt&&cTgt.k==='apple'){if(!findAppleDrop(cTgt.cx,cTgt.cz,cTgt.id))cTgt=null}
 else if(cTgt){const rem=world.edits['p'+cTgt.cx+','+cTgt.cz];if(rem&&rem[cTgt.id])cTgt=null}
 if(!cTgt||!S.collect){cEl.classList.add('hidden');return}
 cam.updateMatrixWorld();_cv.set(cTgt.x,cTgt.y0+Math.min(cTgt.hy,1.2)+.35,cTgt.z).project(cam);
 if(_cv.z>1||Math.abs(_cv.x)>1.05||Math.abs(_cv.y)>1.05){cEl.classList.add('hidden');return}
 cEl.style.left=(_cv.x*.5+.5)*innerWidth+'px';cEl.style.top=(-_cv.y*.5+.5)*innerHeight+'px';cEl.classList.remove('hidden');
}
function doCollect(){
 if(cnInteract())return;
 if(state!=='play'||!cTgt)return;const c=cTgt;
 if(c.k==='leaf'){
  if(!invAdd('leaf',1)){toast('Inventário cheio');return}
  const key=leafDropKey(c.cx,c.cz),list=world.edits[key],idx=Array.isArray(list)?list.findIndex(v=>String(v.id)===String(c.id)):-1;
  if(idx>=0)list.splice(idx,1);if(Array.isArray(list)&&!list.length)delete world.edits[key];
  const m=leafDropMeshes.get(String(c.id));if(m){scene.remove(m);leafDropMeshes.delete(String(c.id))}
  saveWorld();toast('+1 Folha');cTgt=null;cT=0;cEl.classList.add('hidden');return;
 }
 if(c.k==='fish_meat'){
  if(!invAdd('fish_meat',1)){toast('Inventário cheio');return}
  const key=fishMeatKey(c.cx,c.cz),list=world.edits[key],idx=Array.isArray(list)?list.findIndex(v=>String(v.id)===String(c.id)):-1;
  if(idx>=0)list.splice(idx,1);if(Array.isArray(list)&&!list.length)delete world.edits[key];
  const m=fishMeatMeshes.get(String(c.id));if(m){scene.remove(m);fishMeatMeshes.delete(String(c.id))}
  saveWorld();toast('+1 Carne de peixe');cTgt=null;cT=0;cEl.classList.add('hidden');return;
 }
 if(c.k==='apple'){
  if(!invAdd('apple',1)){toast('Inventário cheio');return}
  const key=appleDropKey(c.cx,c.cz),list=world.edits[key],idx=Array.isArray(list)?list.findIndex(v=>String(v.id)===String(c.id)):-1;
  if(idx>=0)list.splice(idx,1);if(Array.isArray(list)&&!list.length)delete world.edits[key];
  const m=appleDropMeshes.get(String(c.id));if(m){scene.remove(m);appleDropMeshes.delete(String(c.id))}
  saveWorld();toast('+1 Maçã');cTgt=null;cT=0;cEl.classList.add('hidden');return;
 }
 if(!invAdd(c.k,1)){toast('Inventário cheio');return}
 const key='p'+c.cx+','+c.cz,rem=world.edits[key]||(world.edits[key]={});rem[c.id]=1;if(!mpApplying&&OWM.multiplayer)OWM.multiplayer.localEdit({kind:'prop',cx:c.cx,cz:c.cz,id:c.id});meshChunk(c.cx,c.cz);
 toast('+1 '+ITEMS[c.k].n);cTgt=null;cT=0;cEl.classList.add('hidden');
}
cEl.addEventListener('click',doCollect);
{const b=$('#bInv');if(b){b.addEventListener('touchstart',e=>{if(LOBBY)openLobbyPanel();else openInv();e.preventDefault()},{passive:false});b.addEventListener('click',()=>{if(LOBBY)openLobbyPanel();else openInv()})}}

/* tocar/clicar direto na tora ou pedra pequena também coleta (funciona com o texto invisível) */
const _ray=new THREE.Raycaster(),_nd=new THREE.Vector2();
function tapCollect(x,y){
 if(state!=='play')return false;
 if(tablePlacement||performance.now()-tablePlacedAt<500)return true; // os toques de colocação não coletam itens acidentalmente
 cam.updateMatrixWorld();_nd.set(x/innerWidth*2-1,-(y/innerHeight)*2+1);_ray.setFromCamera(_nd,cam);
 const tableHits=_ray.intersectObjects([...tableMeshes.values()],true);
 if(tableHits.length){let root=tableHits[0].object;while(root&&root!==scene&&(!root.userData||root.userData.tablePlacedId==null))root=root.parent;const hitTable=root&&root.userData&&root.userData.tablePlacedId!=null?tableMeshes.get(String(root.userData.tablePlacedId)):null;if(hitTable&&Math.hypot(hitTable.position.x-P.p.x,hitTable.position.z-P.p.z)<=3.8){openBench();return true}}
 const leafHits=_ray.intersectObjects([...leafDropMeshes.values()],false);
 if(leafHits.length){const u=leafHits[0].object.userData.leafPickup;if(u){const d=findLeafDrop(u.cx,u.cz,u.id);if(d){if(Math.hypot(d.x-P.p.x,d.z-P.p.z)>3.2){toast('Chegue mais perto');return true}cTgt=leafCollectTarget(d,u.cx,u.cz);doCollect();return true}}}
 const meatHits=_ray.intersectObjects([...fishMeatMeshes.values()],true);
 if(meatHits.length){let o=meatHits[0].object;while(o&&o!==scene&&!(o.userData&&o.userData.fishMeatPickup))o=o.parent;const u=o&&o.userData.fishMeatPickup;const d=u&&findFishMeatDrop(u.cx,u.cz,u.id);if(d){if(Math.hypot(d.x-P.p.x,d.z-P.p.z)>3.2){toast('Chegue mais perto');return true}cTgt={k:'fish_meat',id:d.id,cx:u.cx,cz:u.cz,x:d.x,z:d.z,y0:groundH(d.x,d.z),hy:.22,hx:.24,hz:.2};doCollect();return true}}
 const appleHits=_ray.intersectObjects([...appleDropMeshes.values()],true);
 if(appleHits.length){let o=appleHits[0].object;while(o&&o!==scene&&!(o.userData&&o.userData.applePickup))o=o.parent;const u=o&&o.userData.applePickup;const d=u&&findAppleDrop(u.cx,u.cz,u.id);if(d){if(Math.hypot(d.x-P.p.x,d.z-P.p.z)>3.2){toast('Chegue mais perto');return true}cTgt={k:'apple',id:d.id,cx:u.cx,cz:u.cz,x:d.x,z:d.z,y0:groundH(d.x,d.z),hy:.3,hx:.2,hz:.2};doCollect();return true}}
 const fishHits=_ray.intersectObjects([...fishActors.values()].map(f=>f.group),true);
 if(fishHits.length){let o=fishHits[0].object;while(o&&o!==scene&&!(o.userData&&o.userData.fishId))o=o.parent;const f=o&&fishActors.get(o.userData.fishId);if(f){const fp=f.group.position;if(Math.hypot(fp.x-eye.x,fp.y-eye.y,fp.z-eye.z)>REACH+FISH_EXTRA_REACH+FISH_HIT_R){toast('Chegue mais perto do peixe');return true}punchT=.3;return true}}
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

/* Cliques/toques curtos no mundo: dois em sequência colocam a mesa, sem bater ou coletar por engano. */
addEventListener('pointerdown',e=>{if(tablePlacement&&e.pointerType==='mouse')tableTapStart={x:e.clientX,y:e.clientY,t:performance.now(),id:e.pointerId}},true);
addEventListener('pointerup',e=>{if(!tablePlacement||e.pointerType!=='mouse'||!tableTapStart)return;const q=tableTapStart;tableTapStart=null;if(performance.now()-q.t<460&&Math.hypot(e.clientX-q.x,e.clientY-q.y)<20)handleTablePlacementTap(e.clientX,e.clientY)},true);
document.addEventListener('touchstart',e=>{if(tablePlacement&&e.changedTouches.length){const t=e.changedTouches[0];tableTouchStart={x:t.clientX,y:t.clientY,t:performance.now(),id:t.identifier}}},{capture:true,passive:true});
document.addEventListener('touchend',e=>{if(!tablePlacement||!tableTouchStart)return;const t=[...e.changedTouches].find(v=>v.identifier===tableTouchStart.id);if(!t)return;const q=tableTouchStart;tableTouchStart=null;if(performance.now()-q.t<460&&Math.hypot(t.clientX-q.x,t.clientY-q.y)<20)handleTablePlacementTap(t.clientX,t.clientY)},{capture:true,passive:true});

/* ---------- Entrada ---------- */
addEventListener('keydown',e=>{keys[e.code]=true;if(state==='play'){
 if(COIL.on&&!e.repeat&&(e.code==='Space'||e.code==='Enter')){e.preventDefault();qteClick();return}
 if(e.code==='Escape'){if(tablePlacement){e.preventDefault();cancelTablePlacement();return}pause()}else if(e.code==='KeyQ'&&!e.repeat){dashHold=true;useDash()}else if(e.code==='KeyY'){if(JP.owned&&!COIL.on)JP.fly=true}else if(e.code==='KeyN'&&!e.repeat&&VH.shopV)jpBuy();else if(e.code==='KeyT'&&!e.repeat)lockToggle();else if(e.code==='KeyR'&&!e.repeat)lockCycle(1);else if(e.code==='KeyC'&&!e.repeat)setShiftLock(!S.shiftLock);else if(e.code==='KeyV'){if(S.shiftLock)setShiftLock(false);S.camMode=(S.camMode+1)%2;tp3=S.camMode===1;st('bc.s',S);syncShiftLockButton()}else if(e.code==='KeyE'){if(nearbyCraftTable)openBench();else openInv()}else if(e.code==='KeyF')doCollect();else if(e.code==='KeyZ'&&!e.repeat)m1Press();else if(e.code==='KeyX'&&!e.repeat)m2Down();else if(e.code==='KeyG'&&!e.repeat)altToggle();else if((e.code==='KeyB'||e.code==='KeyH'||e.code==='KeyJ')&&!e.repeat)cnKey(e.code);else if(/^F[1-4]$/.test(e.code)){e.preventDefault();playAnimByIndex(+e.code[1]-1)}if(e.code==='Space')e.preventDefault();}});
addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='KeyX')m2Up();if(e.code==='KeyQ')dashHold=false;if(e.code==='KeyY')JP.fly=false});addEventListener('blur',()=>{dashHold=false;JP.fly=false});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;m2Up();breaking=false;jumpHeld=false;rmbDown=false;sprintTog=false});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(DSC.active)desertCineFinish();if(CIN.active)cinFinish(true);pause()}});
document.addEventListener('pointerlockchange',()=>{if(!DSC.active&&!CIN.active&&!document.pointerLockElement&&state==='play'&&!touch&&(S.lockMouse||S.shiftLock))pause()});
addEventListener('mousemove',e=>{if(state!=='play'||touch)return;if(document.pointerLockElement)look(e.movementX,e.movementY,.0022);else if(!S.lockMouse&&rmbDown){rmbMoved+=Math.abs(e.movementX)+Math.abs(e.movementY);look(e.movementX,e.movementY,.0022)}});
function look(dx,dy,k){if(DSC.active||CIN.active)return;if(LK.s){lockSwipe(dx);return}const s=k*S.sens/100;P.yaw-=dx*s;P.pitch=cl(P.pitch-dy*s*(S.invert?-1:1),-1.55,1.55)}
addEventListener('mousedown',e=>{if(state!=='play'||touch)return;if(tablePlacement)return;const control=e.target.closest&&e.target.closest('#hud button,#collect,#ui,.screen,button');if(e.button===0&&S.lockMouse&&document.pointerLockElement&&nearbyCraftTable){_nd.set(0,0);_ray.setFromCamera(_nd,cam);if(_ray.intersectObjects([...tableMeshes.values()],true).length){openBench();return}}if(e.button===0&&!control&&qteClick())return;if(control)return;if((S.lockMouse||S.shiftLock)&&!document.pointerLockElement){lock(!!S.shiftLock);return}if(e.button===0)breaking=true;else if(e.button===2){if(!S.lockMouse){rmbDown=true;rmbT=performance.now();rmbMoved=0;$('#c').style.cursor='none'}}});
addEventListener('mouseup',e=>{if(e.button===0)breaking=false;if(e.button===2&&rmbDown){rmbDown=false;$('#c').style.cursor=S.lockMouse?'':'crosshair';}});
addEventListener('contextmenu',e=>e.preventDefault());
if(touch)addEventListener('touchstart',e=>{if(state!=='play'||!COIL.on)return;const t=e.target,skip=t&&t.closest&&t.closest('#joy,#bPause,#bInv,#bJump,#bPunch,#bM1,#bM2,#bFly,#bDash,#bSprint,#collect,#ui,.screen,button');if(!skip)qteClick()},{capture:true,passive:true});   // QTE ignora joystick e botões de interface

if(touch){let lid=null,lx=0,ly=0,jid=null;const joyE=$('#joy'),knob=$('#knob'),lk=$('#look');const tch=(e,id)=>[...e.changedTouches].find(t=>t.identifier===id);lk.addEventListener('touchstart',e=>{if(lid!=null)return;const t=e.changedTouches[0];lid=t.identifier;lx=t.clientX;ly=t.clientY;e.preventDefault()},{passive:false});lk.addEventListener('touchmove',e=>{const t=tch(e,lid);if(!t)return;if(state==='play')look(t.clientX-lx,t.clientY-ly,.005);lx=t.clientX;ly=t.clientY;e.preventDefault()},{passive:false});const lend=e=>{if(tch(e,lid))lid=null};lk.addEventListener('touchend',lend);lk.addEventListener('touchcancel',lend);const jm=t=>{const r=joyE.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=t.clientX-cx,dy=t.clientY-cy;const radius=Math.max(20,r.width*.4),l=Math.hypot(dx,dy);if(l>radius){dx*=radius/l;dy*=radius/l}joy.x=dx/radius;joy.y=dy/radius;knob.style.left=((r.width-knob.offsetWidth)/2+dx)+'px';knob.style.top=((r.height-knob.offsetHeight)/2+dy)+'px'};joyE.addEventListener('touchstart',e=>{const t=e.changedTouches[0];jid=t.identifier;jm(t);e.preventDefault()},{passive:false});joyE.addEventListener('touchmove',e=>{const t=tch(e,jid);if(t)jm(t);e.preventDefault()},{passive:false});const jend=e=>{if(tch(e,jid)){jid=null;joy.x=joy.y=0;knob.style.left=((joyE.clientWidth-knob.offsetWidth)/2)+'px';knob.style.top=((joyE.clientHeight-knob.offsetHeight)/2)+'px'}};joyE.addEventListener('touchend',jend);joyE.addEventListener('touchcancel',jend);const hold=(id,on,off)=>{const b=$(id);if(!b)return;b.addEventListener('touchstart',e=>{on();e.preventDefault()},{passive:false});b.addEventListener('touchend',off);b.addEventListener('touchcancel',off)};hold('#bJump',()=>{if(!COIL.on)jumpHeld=true},()=>jumpHeld=false);hold('#bPunch',()=>{if(state==='play'&&!COIL.on){breaking=true;punchT=.3}},()=>{breaking=false});hold('#bM1',()=>m1Press(),()=>{});hold('#bM2',()=>m2Down(),()=>m2Up());/* lazy: m1Press/m2Down/m2Up são const declarados mais abaixo (TDZ no celular) */{const sw=$('#bSwap');if(sw){sw.addEventListener('touchstart',e=>{altToggle();e.preventDefault()},{passive:false});sw.addEventListener('click',altToggle)}}/* segurar o botão = bater, igual ao botão esquerdo do mouse */$('#bPause').onclick=pause;dashBtn.addEventListener('touchstart',e=>{dashHold=true;useDash();e.preventDefault()},{passive:false});dashBtn.addEventListener('touchend',()=>{dashHold=false});dashBtn.addEventListener('touchcancel',()=>{dashHold=false});dashBtn.addEventListener('mousedown',()=>{dashHold=true});addEventListener('mouseup',()=>{dashHold=false});dashBtn.addEventListener('click',()=>useDash());$('#bSprint').addEventListener('touchstart',e=>{if(!COIL.on)sprintTog=!sprintTog;e.preventDefault()},{passive:false});}else dashBtn.addEventListener('click',()=>useDash());

/* ---------- Física ---------- */
function hitsObj(x,y,z){for(let ix=Math.floor(x-.3);ix<=Math.floor(x+.3);ix++)for(let iz=Math.floor(z-.3);iz<=Math.floor(z+.3);iz++)for(let iy=Math.floor(y);iy<=Math.floor(y+1.79);iy++)if(getB(ix,iy,iz))return true;return propHits(x,y,z)||(LOBBY&&lobbyHit(x,y,z))||(CAMB&&cambHit(x,y,z))}
/* Terreno: al = quanto o chão pode subir à frente do pé (degrau/inclinação). Eixo Y não tem tolerância. */
function hits(x,y,z,al){if(CAMB){MAPY=y;if(al>0&&al<CAMB_STEP)al=CAMB_STEP}return sup(x,z)>y+(al||0)||hitsObj(x,y,z)}
function moveAxis(ax,d){if(!d)return false;const p=P.p,o=p[ax],al=ax==='y'?0:.04+Math.abs(d)*1.5;p[ax]=o+d;if(!hits(p.x,p.y,p.z,al))return false;let a=0,b=d;for(let i=0;i<8;i++){const m=(a+b)/2;p[ax]=o+m;if(hits(p.x,p.y,p.z,al))b=m;else a=m}p[ax]=o+a;return true}
function physics(dt){if(CAMB){MAPY=P.p.y;cambTick(dt)}else if(PLATE&&!LOBBY){if(STR.list.length||STR.shots.length)strUpdate(dt);if(ATNK.list.length)tkUpdate(dt)}if(COIL.on){keys.Space=false;jumpHeld=false;dashT=0}const jumpDown=!!(keys.Space||jumpHeld);if(dashReadyAt>0)updateDashHUD();const dashActive=dashT>0;if(dashT>0)dashT=Math.max(0,dashT-dt);let mx=(keys.KeyD?1:0)-(keys.KeyA?1:0)+joy.x,mz=(keys.KeyS?1:0)-(keys.KeyW?1:0)+joy.y;const l=Math.hypot(mx,mz);if(l>1){mx/=l;mz/=l}if(l<.1)sprintTog=false;if(P.st<=0)stLock=true;else if(P.st>=5)stLock=false;if(stLock)sprintTog=false;
const wLv=waterSurf(P.p.x,P.p.z),wd=wLv-P.p.y,swim=wd>.75;   // wd = quanto os pés estão abaixo da superfície; nada com a água acima da cintura
updateSurvival(dt,swim);const jpThrust=jpPhysics(dt,swim);if(P.hunger<=0)sprintTog=false;
const sprinting=(keys.ShiftLeft||keys.ShiftRight||sprintTog)&&l>=.1&&!stLock&&P.st>0&&SURV.canSprint(P.hunger)&&!COIL.on;
dashHoldT=(dashHold&&!dashActive)?dashHoldT+dt:0;
const dashRun=dashHold&&dashHoldT>.12&&sprinting&&!dashActive;dashRunOn=dashRun;   // Sprint ligado + DASH segurado + andando
if(sprinting){let dr=ST_DRAIN;if(dashRun){stDashT-=dt;if(stDashT<=0){stDashT=.35+Math.random()*.5;stDashHi=Math.random()<.3}dr=stDashHi?4:3}else stDashT=0;P.st=Math.max(0,P.st-dr*archetypeMul('staminaDrain')*dt);stIdle=0}else{stIdle+=dt;if(stIdle>1)P.st=Math.min(MAXST,P.st+ST_REGEN*archetypeMul('staminaRegen')*dt)}
isSprint=sprinting||dashActive;updateStamina(sprinting,dt);
const sp=(dashRun?1.5:1)*(sprinting?6.2*1.18:4.3*1.1)*(swim?.6:wd>0?.85:1)*(sprinting&&wd>0?1.2:1)*(COIL.on?COIL.SLOW:1)*archetypeMul('moveSpeed');const c=Math.cos(P.yaw),s=Math.sin(P.yaw);let tx=(c*mx+s*mz)*sp,tz=(-s*mx+c*mz)*sp;
if(S.wFlow&&!dashActive&&wd>0){const rw=riverWaterAt(P.p.x,P.p.z);if(rw){riverFlowVec(rw,_flow);const fw=swim?1:cl(wd,0,1)*.7;tx+=_flow.x*fw;tz+=_flow.z*fw}}   // correnteza arrasta quem está na água do rio
const accel=swim?6:P.og?(l>0?20:24):(l>0?(jpThrust?JP.AIR_CTRL:8):2.4);const k=1-Math.exp(-dt*accel);if(dashActive){const dsp=JP.owned?JP.DASH_SPEED:DASH.SPEED;P.vel.x=dashDirX*dsp*archetypeMul('moveSpeed');P.vel.z=dashDirZ*dsp*archetypeMul('moveSpeed')}else{P.vel.x+=(tx-P.vel.x)*k;P.vel.z+=(tz-P.vel.z)*k}const jumpPressed=jumpDown&&!jumpPrev;jumpPrev=jumpDown;
if(P.og||swim)coyoteT=COYOTE;else coyoteT=Math.max(0,coyoteT-dt);
jumpBufT=jumpPressed?JBUF:Math.max(0,jumpBufT-dt);
if(!swim&&!COIL.on){
 if((jumpBufT>0||(jumpDown&&P.og))&&coyoteT>0){P.vel.y=JUMP_V*(JP.owned?JP.JUMP_MUL:1);if(JP.owned)jpPuff();P.og=false;coyoteT=0;jumpBufT=0}
}
if(swim){let tv=cl((wLv-1.1-P.p.y)*3,-2.5,2.5);if((keys.Space||jumpHeld)&&!COIL.on)tv=3.2;else if(stLock)tv=-.8;P.vel.y+=(tv-P.vel.y)*(1-Math.exp(-dt*(P.vel.y<-3?9:4)));P.peak=P.p.y}   // flutua com a cabeça fora; pulo = braçada pra cima; sem dano de queda na água
const n=Math.ceil(dt/.016),sd=dt/n;for(let i=0;i<n;i++){if(!swim){const gv=jpThrust?0:(P.vel.y>0?(jumpDown?GUP:GUP*2.2):GDN);P.vel.y=Math.max(-38,P.vel.y-gv*sd)}if(moveAxis('x',P.vel.x*sd))P.vel.x=0;if(moveAxis('z',P.vel.z*sd))P.vel.z=0;{const q=P.p;if(CAMB)MAPY=q.y;const sg=sup(q.x,q.z);if(sg>q.y){if(!hitsObj(q.x,sg,q.z))q.y=sg}else if(P.og&&P.vel.y<=0&&q.y-sg<.36)q.y=sg}const was=P.og,dy=P.vel.y*sd;if(moveAxis('y',dy)){if(dy<0){P.og=true;if(!was){P.landV=-P.vel.y;const fd=P.peak-P.p.y;if(JP.owned){if(fd>=JP.STOMP_MIN_FALL)jpStomp(fd)}else if(fd>3.4){hurt(FALL_DMG);addTrauma(Math.min(0.6,fd*0.08))}}P.peak=P.p.y}P.vel.y=0}else{P.og=false;P.peak=Math.max(P.peak,P.p.y)}}if(dashActive){dashTrailAcc+=dt;if(dashTrailAcc>=DASH.TRAIL_STEP){dashTrailAcc=0;if(JP.owned)jpDashTrail();else spawnDashTrail()}if(dashT<=0){P.vel.x*=.42;P.vel.z*=.42}}else if(dashRun){const hl=Math.hypot(P.vel.x,P.vel.z)||1;dashDirX=P.vel.x/hl;dashDirZ=P.vel.z/hl;if(!dashRunWas){dashScreenT=.16;spawnDashBurst()}dashTrailAcc+=dt;if(dashTrailAcc>=DASH.TRAIL_STEP*2){dashTrailAcc=0;spawnDashTrail()}}dashRunWas=dashRun;if(P.og||swim)P.peak=P.p.y;if(P.p.y<-20)hurt(MAXHP);P.hpT+=dt;if(P.hp<MAXHP&&P.hpT>Math.max(.15,.6/archetypeMul('healthRegen'))&&P.hunger>0&&P.thirst>0&&!HT.over&&!PZ.on&&!COIL.on){P.hp++;P.hpT=0;refreshHealth()}}
/* ---------- Biomas: aviso ao entrar, névoa climática e pétalas ----------
   BIOMES (acima) lista os biomas por peso. bCur = bioma atual (com histerese pra não piscar na borda); cWt = peso suavizado do cerejeiral. */
let bCur='',bInit=false,cWt=0,forestWt=1;
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
 let cwNow=0;for(const[id,,fn,tin,tout]of BIOMES){const w=fn(x,z);if(id==='cherry')cwNow=w;if(w>=(bCur===id?tout:tin)&&w>bw){best=id;bw=w}}
 if(best!==bCur){
  const previous=bCur;bCur=best;
  // A cutscene plays on every real transition into OR out of the desert.
  // The first biome sample after loading a world is initialization, not an entry event.
  if(bInit&&(previous==='desert'||best==='desert'))desertCineStart(previous,best);
 }
 bInit=true;
 cWt+=(cwNow-cWt)*(1-Math.exp(-dt*1.2));
 const dwNow=desertW(x,z);
 forestWt=PLATE?0:(1-sstep(.18,.40,dwNow))*(1-sstep(.18,.40,cwNow));
 if(OWM.post.setBiome)OWM.post.setBiome(cWt);
 updatePetals(dt,cWt);
}

/* ---------- Cutscene de transição do deserto ----------
   Usa a câmera e os modelos 3D reais do mundo. As faixas têm a mesma altura/animação
   da cutscene do Shadow Man em Echos. É local por jogador no multiplayer. */
const DSC={active:false,t:0,from:'',to:'',root:null,black:null,actors:[],actorKind:'',tempMountain:null,tempMountains:[],
 playerPos:new THREE.Vector3(),camPos:new THREE.Vector3(),camQuat:new THREE.Quaternion(),camFov:0,camFar:200,
 mountainA:new THREE.Vector3(),mountainB:new THREE.Vector3(),mountainLook:new THREE.Vector3(),
 actorA:new THREE.Vector3(),actorB:new THREE.Vector3(),actorLook:new THREE.Vector3(),
 actorCenter:new THREE.Vector3(),innerDir:new THREE.Vector3(),sideDir:new THREE.Vector3(),
 savedPitch:0,savedYaw:0};
function desertCineDOM(){
 if(DSC.root)return;
 const root=document.createElement('div');root.id='owm-desert-cine';root.setAttribute('aria-label','Cutscene de transição do deserto');
 root.innerHTML='<div class="owm-cine-black"></div><div class="mg-bar t"></div><div class="mg-bar b"></div><button class="owm-cine-skip" type="button" aria-label="Pular cutscene">PULAR</button>';
 document.body.appendChild(root);DSC.root=root;DSC.black=root.querySelector('.owm-cine-black');
 const skip=root.querySelector('.owm-cine-skip');skip.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation()});skip.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(DSC.active&&DSC.t>1.25)desertCineFinish()});
}
function desertCineFindDesertDirection(){
 const px=P.p.x,pz=P.p.z;let bestX=px,bestZ=pz,best=desertW(px,pz),bestScore=best;
 for(const radius of [18,32,50,72,100,135])for(let i=0;i<16;i++){
  const a=i*Math.PI/8,x=px+Math.cos(a)*radius,z=pz+Math.sin(a)*radius,w=desertW(x,z),score=w-radius*.00055;
  if(score>bestScore){bestScore=score;best=w;bestX=x;bestZ=z}
 }
 const dx=bestX-px,dz=bestZ-pz,l=Math.hypot(dx,dz);
 if(l>.01)DSC.innerDir.set(dx/l,0,dz/l);else DSC.innerDir.set(Math.sin(P.yaw),0,-Math.cos(P.yaw));
 DSC.sideDir.set(DSC.innerDir.z,0,-DSC.innerDir.x);
}
function desertCineFindMountain(){
 // Não usa uma montanha distante do mundo: em aparelhos com alcance reduzido a câmera
 // ficava fora do alcance de renderização e mostrava apenas o céu. Monta uma paisagem
 // cinematográfica com os mesmos modelos do bioma, sempre a poucos metros do jogador.
 if(!MT.length)return null;
 const pick=(kind)=>MT.filter(m=>m.k===kind).sort((a,b)=>(b.r+b.h*.35)-(a.r+a.h*.35))[0]||MT[0];
 const hero=pick('mountain'),plateau=pick('plateau'),hill=pick('hill');
 const px=P.p.x,pz=P.p.z,d=DSC.innerDir,sd=DSC.sideDir;
 const place=(model,sideOffset,forwardOffset,rot,scale)=>{
  const x=px+d.x*forwardOffset+sd.x*sideOffset,z=pz+d.z*forwardOffset+sd.z*sideOffset;
  const y=groundH(x,z),p={x,z,m:model,s:scale,rot,yb:y-MT_EMB};
  const mesh=mkMountain(p);mesh.userData.owmDesertCine=true;mesh.userData.cineHeight=model.h*scale;
  DSC.tempMountains.push(mesh);return mesh;
 };
 const hs=Math.min(1.32,MT_TOP/hero.h)*1.18;
 const main=place(hero,0,48,.12,hs);
 // Silhuetas laterais em profundidades diferentes criam a leitura de uma cadeia montanhosa.
 place(plateau,38,67,-.38,Math.min(1.22,MT_TOP/plateau.h)*1.12);
 place(hill,69,82,.54,Math.min(1.42,MT_TOP/hill.h)*1.15);
 place(hero,-30,91,-.22,Math.min(1.28,MT_TOP/hero.h)*1.05);
 place(plateau,8,112,.31,Math.min(1.2,MT_TOP/plateau.h)*.92);
 DSC.tempMountain=main;
 return{mesh:main,temporary:true};
}
function desertCineClearActors(){
 for(const a of DSC.actors){try{scene.remove(a.inst.group);a.inst.dispose()}catch(e){}}
 DSC.actors.length=0;DSC.actorKind='';
}
function desertCineSpawnActors(kind){
 desertCineClearActors();DSC.actorKind=kind;
 const F=kind==='scorpion'?SCF:SNF;if(!F)return;
 const center=DSC.actorCenter,dir=DSC.innerDir,side=DSC.sideDir;
 for(let i=0;i<2;i++){
  let inst;try{inst=F.create()}catch(e){console.warn('[OWM] Não foi possível criar modelo da cutscene:',e);continue}
  const offset=(i-.5)*1.9,back=(i===0?-1.2:1.1);
  const sx=center.x+side.x*(-4.2+offset)+dir.x*back,sz=center.z+side.z*(-4.2+offset)+dir.z*back;
  const ex=center.x+side.x*(4.2+offset)+dir.x*(-back),ez=center.z+side.z*(4.2+offset)+dir.z*(-back);
  const yaw=Math.atan2(ex-sx,ez-sz),g=inst.group;
  g.scale.setScalar(F.SCALE);g.rotation.order='YXZ';g.rotation.set(0,yaw,0);
  g.position.set(sx,groundH(sx,sz),sz);scene.add(g);inst.play('run',.08,true);
  DSC.actors.push({inst,x0:sx,z0:sz,x1:ex,z1:ez,yaw,age:i*.24,speed:kind==='scorpion'?(SPC.scorpion.WALK_ANIM||.35):(SPC.snake.WALK_ANIM||1)});
 }
}
function desertCineUpdateActors(dt){
 for(const a of DSC.actors){
  a.age+=dt;const k=Math.min(1,a.age/2.05),e=k*k*(3-2*k),x=a.x0+(a.x1-a.x0)*e,z=a.z0+(a.z1-a.z0)*e;
  a.inst.update(dt,a.speed);a.inst.group.position.set(x,groundH(x,z),z);
 }
}
function desertCineStart(from,to){
 if(DSC.active||state!=='play')return;
 desertCineDOM();DSC.active=true;DSC.t=0;DSC.from=from;DSC.to=to;
 DSC.playerPos.copy(P.p);DSC.savedYaw=P.yaw;DSC.savedPitch=P.pitch;
 DSC.camPos.copy(cam.position);DSC.camQuat.copy(cam.quaternion);DSC.camFov=cam.fov;DSC.camFar=cam.far;
 P.vel.set(0,0,0);breaking=false;mining=false;punchT=0;for(const k in keys)keys[k]=false;joy.x=joy.y=0;
 DSC.root.style.display='block';DSC.root.classList.add('active','cine');DSC.black.style.transition='none';DSC.black.style.opacity='0';
 document.body.classList.add('owm-desert-cine-active');
 desertCineFindDesertDirection();
 DSC.actorCenter.set(P.p.x+DSC.innerDir.x*13,0,P.p.z+DSC.innerDir.z*13);
 DSC.actorCenter.y=groundH(DSC.actorCenter.x,DSC.actorCenter.z);
 const mountain=desertCineFindMountain();
 if(mountain){
  const m=mountain.mesh.position,dx=P.p.x-m.x,dz=P.p.z-m.z,l=Math.hypot(dx,dz)||1;
  const h=mountain.mesh.userData.cineHeight||20;
  DSC.mountainLook.set(m.x,m.y+Math.max(7,h*.4),m.z);
  // A câmera fica perto do jogador e olha para a paisagem montada a ~48 m à frente.
  DSC.mountainA.set(m.x+dx/l*72+DSC.sideDir.x*24,m.y+39,m.z+dz/l*72+DSC.sideDir.z*24);
  DSC.mountainB.set(m.x+dx/l*54+DSC.sideDir.x*12,m.y+28,m.z+dz/l*54+DSC.sideDir.z*12);
 }else{
  DSC.mountainLook.set(DSC.actorCenter.x+DSC.innerDir.x*24,DSC.actorCenter.y+8,DSC.actorCenter.z+DSC.innerDir.z*24);
  DSC.mountainA.set(P.p.x-DSC.innerDir.x*20+DSC.sideDir.x*28,groundH(P.p.x-DSC.innerDir.x*20+DSC.sideDir.x*28,P.p.z-DSC.innerDir.z*20+DSC.sideDir.z*28)+24,P.p.z-DSC.innerDir.z*20+DSC.sideDir.z*28);
  DSC.mountainB.set(P.p.x-DSC.innerDir.x*10+DSC.sideDir.x*18,groundH(P.p.x-DSC.innerDir.x*10+DSC.sideDir.x*18,P.p.z-DSC.innerDir.z*10+DSC.sideDir.z*18)+20,P.p.z-DSC.innerDir.z*10+DSC.sideDir.z*18);
 }
 cam.far=Math.max(cam.far,320);cam.updateProjectionMatrix();
 const c=DSC.actorCenter,d=DSC.innerDir,sd=DSC.sideDir;
 DSC.actorLook.set(c.x,c.y+.55,c.z);
 DSC.actorA.set(c.x+d.x*11-sd.x*2,c.y+5.6,c.z+d.z*11-sd.z*2);
 DSC.actorB.set(c.x+d.x*9+sd.x*2,c.y+4.9,c.z+d.z*9+sd.z*2);
 // Mantém o pointer lock; a câmera é controlada pela cutscene até ela terminar.
}
function desertCineFinish(){
 if(!DSC.active)return;
 DSC.active=false;desertCineClearActors();
 for(const m of DSC.tempMountains){scene.remove(m);if(m.geometry)m.geometry.dispose()}
 DSC.tempMountains.length=0;DSC.tempMountain=null;
 P.p.copy(DSC.playerPos);P.yaw=DSC.savedYaw;P.pitch=DSC.savedPitch;P.vel.set(0,0,0);for(const k in keys)keys[k]=false;joy.x=joy.y=0;
 cam.position.copy(DSC.camPos);cam.quaternion.copy(DSC.camQuat);cam.fov=DSC.camFov;cam.far=DSC.camFar;cam.updateProjectionMatrix();
 DSC.black.style.transition='opacity .5s ease';DSC.black.style.opacity='0';DSC.root.classList.remove('active','cine');document.body.classList.remove('owm-desert-cine-active');
 setTimeout(()=>{if(!DSC.active&&DSC.root)DSC.root.style.display='none'},900);
}
function desertCineTick(dt){
 if(!DSC.active)return;
 DSC.t+=dt;const t=DSC.t;
 // Montanhas (0–2,8 s), fade para preto, escorpiões, fade, cobras e saída.
 if(t<2.8){const k=Math.min(1,t/2.8),e=k*k*(3-2*k);cam.position.lerpVectors(DSC.mountainA,DSC.mountainB,e);cam.lookAt(DSC.mountainLook);DSC.black.style.opacity='0';}
 else if(t<3.35){DSC.black.style.opacity=String(Math.min(1,(t-2.8)/.55));}
 else if(t<5.45){if(DSC.actorKind!=='scorpion')desertCineSpawnActors('scorpion');const k=Math.min(1,(t-3.35)/.48),e=k*k*(3-2*k);cam.position.lerpVectors(DSC.actorA,DSC.actorB,e);cam.lookAt(DSC.actorLook);DSC.black.style.opacity=String(1-e);desertCineUpdateActors(dt);}
 else if(t<5.95){DSC.black.style.opacity=String(Math.min(1,(t-5.45)/.5));desertCineClearActors();}
 else if(t<8.05){if(DSC.actorKind!=='snake')desertCineSpawnActors('snake');const k=Math.min(1,(t-5.95)/.48),e=k*k*(3-2*k);cam.position.lerpVectors(DSC.actorA,DSC.actorB,e);cam.lookAt(DSC.actorLook);DSC.black.style.opacity=String(1-e);desertCineUpdateActors(dt);}
 else if(t<8.8){DSC.black.style.opacity=String(Math.min(1,(t-8.05)/.75));desertCineClearActors();}
 else{desertCineFinish();return}
 cam.fov=47;cam.updateProjectionMatrix();
}
// Durante a sequência, qualquer tecla é bloqueada; Esc/Espaço/Enter ou toque pulam após o primeiro instante.
document.addEventListener('keydown',e=>{if(!DSC.active)return;e.preventDefault();e.stopImmediatePropagation();if(DSC.t>1.25&&(e.code==='Escape'||e.code==='Space'||e.code==='Enter'))desertCineFinish()},true);
document.addEventListener('keyup',e=>{if(DSC.active){e.preventDefault();e.stopImmediatePropagation()}},true);

/* ---------- CINEMÁTICAS (motor próprio) ----------
   Duas cutscenes usam este motor:
   · "base":  clicou em Pronto no lobby → tela preta → cortes mostrando partes da Camera Base → os tanques aliados chegando.
   · "wave":  começou o modo ondas → alerta → os Striders chegando de longe → vista de cima, e o jogo começa de verdade.
   Como funciona: cada "plano" (shot) tem duração, um trilho de câmera (curva suave que nunca atravessa parede: a posição é encurtada por raio contra o mapa),
   um alvo de olhar, FOV, tremor de mão, e opcionalmente título, legenda e fade. Os planos se cortam a seco. A cutscene congela o jogador (o jogo não roda a física),
   esconde o HUD e dá dano zero. Esc/Espaço/Enter ou o botão PULAR encerram depois de ~1 s. */
const CIN={active:false,far:false,keepYaw:false,tkOn:false,t:0,ts:0,i:0,shots:[],done:null,kind:'',el:null,blk:null,ttl:null,tag:null,
 pos:new THREE.Vector3(),look:new THREE.Vector3(),lk:new THREE.Vector3(),v1:new THREE.Vector3(),v2:new THREE.Vector3(),v3:new THREE.Vector3(),
 sv:{yaw:0,pitch:0,fov:60,far:200},li:null,ld:null,rc:null,meshes:null,sched:[],titleT:0,rumble:0,tk:null,tk0:0,dirOut:0};
const cinSm=(a,b,x)=>{const k=Math.max(0,Math.min(1,(x-a)/(b-a)));return k*k*(3-2*k)};
const cinV=(x,y,z)=>new THREE.Vector3(x,y,z);
function cinDOM(){
 if(CIN.el)return;
 const css=document.createElement('style');css.id='owm-cin-css';
 css.textContent=
 '#owm-cin{position:fixed;inset:0;z-index:9500;display:none;pointer-events:none;overflow:hidden;font-family:Montserrat,system-ui,sans-serif;color:#fff}'+
 '#owm-cin.on{display:block}'+
 '#owm-cin .vg{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 50%,rgba(0,0,0,.62) 100%)}'+
 '#owm-cin .blk{position:absolute;inset:0;background:#000;opacity:0}'+
 '#owm-cin .cb{position:absolute;left:0;right:0;height:0;background:#000;transition:height .85s cubic-bezier(.2,.8,.2,1)}'+
 '#owm-cin .cb.t{top:0}#owm-cin .cb.b{bottom:0}'+
 '#owm-cin.bars .cb{height:11.5vh}'+
 '#owm-cin .tg{position:absolute;left:max(5vw,env(safe-area-inset-left));bottom:calc(11.5vh + 16px);display:flex;gap:10px;align-items:stretch;opacity:0;transform:translateX(-18px);transition:opacity .5s,transform .7s cubic-bezier(.2,.8,.2,1)}'+
 '#owm-cin .tg.show{opacity:1;transform:none}'+
 '#owm-cin .tg i{width:3px;background:#8fd0ff;box-shadow:0 0 10px rgba(143,208,255,.85)}'+
 '#owm-cin .tg b{display:block;font-size:clamp(11px,2.1vh,16px);font-weight:800;letter-spacing:.32em;text-shadow:0 1px 5px #000}'+
 '#owm-cin .tg span{display:block;margin-top:3px;font-size:clamp(9px,1.6vh,12px);font-weight:600;letter-spacing:.22em;opacity:.78;text-shadow:0 1px 4px #000}'+
 '#owm-cin .ttl{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;opacity:0;transition:opacity .7s ease}'+
 '#owm-cin .ttl.show{opacity:1}'+
 '#owm-cin .ttl .l1{font-size:clamp(26px,9.5vh,84px);font-weight:900;font-style:italic;letter-spacing:.2em;padding-left:.2em;text-shadow:0 4px 30px rgba(0,0,0,.75);transform:scale(1.14);transition:transform 3s cubic-bezier(.1,.7,.2,1),letter-spacing 3s cubic-bezier(.1,.7,.2,1)}'+
 '#owm-cin .ttl.show .l1{transform:scale(1);letter-spacing:.32em}'+
 '#owm-cin .ttl .ln{width:0;height:2px;margin:1.6vh auto;background:linear-gradient(90deg,transparent,#8fd0ff,transparent);transition:width 1.5s cubic-bezier(.2,.8,.2,1)}'+
 '#owm-cin .ttl.show .ln{width:min(60vw,520px)}'+
 '#owm-cin .ttl .l2{font-size:clamp(10px,2.3vh,18px);font-weight:700;letter-spacing:.5em;padding-left:.5em;opacity:.88;text-shadow:0 2px 8px #000}'+
 '#owm-cin .ld{position:absolute;left:0;right:0;bottom:12vh;text-align:center;font-size:12px;font-weight:700;letter-spacing:.5em;padding-left:.5em;opacity:0;transition:opacity .4s}'+
 '#owm-cin.wait .ld{opacity:.7;animation:owmcinp 1.2s ease-in-out infinite}'+
 '@keyframes owmcinp{50%{opacity:.25}}'+
 '#owm-cin .skp{position:absolute;right:max(16px,env(safe-area-inset-right));bottom:calc(env(safe-area-inset-bottom,0px) + 1.4vh);pointer-events:auto;font:800 12px Montserrat,system-ui,sans-serif;letter-spacing:.2em;color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:7px 14px;opacity:0;transition:opacity .4s;cursor:pointer}'+
 '#owm-cin.sk .skp{opacity:.85}'+
 'body.owm-cin-on #hud,body.owm-cin-on #wave-hud,body.owm-cin-on #toast,body.owm-cin-on #lobby-bars,body.owm-cin-on #vig,body.owm-cin-on #pois,body.owm-cin-on #heat{display:none!important}';
 document.head.appendChild(css);
 const el=document.createElement('div');el.id='owm-cin';el.setAttribute('aria-label','Cutscene');
 el.innerHTML='<div class="vg"></div><div class="blk"></div><div class="cb t"></div><div class="cb b"></div>'+
  '<div class="tg"><i></i><div><b></b><span></span></div></div>'+
  '<div class="ttl"><div class="l1"></div><div class="ln"></div><div class="l2"></div></div>'+
  '<div class="ld">CARREGANDO…</div><button class="skp" type="button" aria-label="Pular cutscene">PULAR ▸</button>';
 document.body.appendChild(el);
 CIN.el=el;CIN.blk=el.querySelector('.blk');CIN.ttl=el.querySelector('.ttl');CIN.tag=el.querySelector('.tg');
 const sk=el.querySelector('.skp');
 sk.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation()});
 sk.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(CIN.active&&CIN.t>.9)cinFinish(true)});
}
/* tela preta enquanto carrega (on=true) / some se a cutscene não vier (on=false) */
function cinPre(on){
 cinDOM();const el=CIN.el,b=CIN.blk;
 if(on){el.classList.add('on','wait');b.style.transition='none';b.style.opacity='0';void b.offsetWidth;b.style.transition='opacity .6s ease';b.style.opacity='1'}
 else{el.classList.remove('wait');b.style.transition='opacity .6s ease';b.style.opacity='0';setTimeout(()=>{if(!CIN.active)el.classList.remove('on')},700)}
}
function cinAt(t,fn){CIN.sched.push({t,fn});CIN.sched.sort((a,b)=>a.t-b.t)}
/* sons sintetizados (mesmo áudio da cobra; respeita o volume do jogo) */
function cinTone(f0,f1,dur,wave,gain){try{coilAudioWake();coilTone(f0,f1,dur,wave,gain)}catch(e){}}
function cinNoise(dur,gain,freq){
 try{coilAudioWake();const ac=COIL_AUDIO.ctx;if(!ac||!COIL_AUDIO.master||!COIL_AUDIO.noise)return;
  const t=ac.currentTime,s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();
  s.buffer=COIL_AUDIO.noise;s.loop=true;f.type='lowpass';f.frequency.value=freq||200;
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+Math.min(.45,dur*.3));g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  s.connect(f);f.connect(g);g.connect(COIL_AUDIO.master);s.start(t);s.stop(t+dur+.05)}catch(e){}
}
/* ---- câmera que não atravessa parede: raio contra as malhas do mapa (sem céu e sem portas, como a colisão) ---- */
function cinMeshes(){
 if(CIN.meshes)return CIN.meshes;const L=[];
 if(CB.group)CB.group.traverse(o=>{if(o.isMesh&&o.geometry){const mn=String(o.material&&o.material.name||'').toUpperCase();if(mn.indexOf('SKYBOX')>=0||mn.indexOf('DOOR')>=0)return;L.push(o)}});
 return CIN.meshes=L;
}
function cinRay(from,dir,maxD){
 const rc=CIN.rc||(CIN.rc=new THREE.Raycaster());rc.set(from,dir);rc.near=.01;rc.far=maxD;
 const h=rc.intersectObjects(cinMeshes(),false);return h.length?h[0].distance:maxD;
}
function cinPlace(anc,p){   // encurta a posição p (vista de anc) se houver parede no caminho
 const v=CIN.v1.copy(p).sub(anc),d=v.length();if(d<.01)return p.clone();
 v.multiplyScalar(1/d);const r=cinRay(anc,v,d+.01);
 return r<d?anc.clone().addScaledVector(v,Math.max(.5,r-.6)):p.clone();
}
function cinPath(anc,pts){return new THREE.CatmullRomCurve3(pts.map(p=>cinPlace(anc,p)),false,'centripetal')}
function cinClearAngle(c,maxD,h){   // direção horizontal mais livre a partir de c
 let ba=0,bd=-1;const o=CIN.v3.copy(c);o.y+=h||0;
 for(let i=0;i<12;i++){const a=i*Math.PI/6,d=cinRay(o,CIN.v2.set(Math.sin(a),0,Math.cos(a)),maxD);if(d>bd+.5){bd=d;ba=a}}
 return{a:ba,d:bd};
}
/* ---- motor ---- */
function cinEnter(s){
 CIN.ts=0;if(s.enter)s.enter(s);
 const tg=CIN.tag;tg.classList.remove('show');
 if(s.tag){tg.querySelector('b').textContent=s.tag[0];tg.querySelector('span').textContent=s.tag[1]||'';void tg.offsetWidth;tg.classList.add('show')}
 if(s.title){const t=CIN.ttl;t.classList.remove('show');t.querySelector('.l1').textContent=s.title[0];t.querySelector('.l2').textContent=s.title[1]||'';void t.offsetWidth;t.classList.add('show');CIN.titleT=s.titleT||2.8}
}
function cinStart(kind,shots,done){
 if(CIN.active||!shots.length)return false;
 cinDOM();
 CIN.active=true;CIN.kind=kind;CIN.t=0;CIN.ts=0;CIN.i=0;CIN.shots=shots;CIN.done=done||null;CIN.sched.length=0;CIN.rumble=0;CIN.titleT=0;
 CIN.sv.yaw=P.yaw;CIN.sv.pitch=P.pitch;CIN.sv.fov=cam.fov;CIN.sv.far=cam.far;
 P.vel.set(0,0,0);breaking=false;mining=false;punchT=0;for(const k in keys)keys[k]=false;joy.x=joy.y=0;
 if(typeof lockClear==='function')lockClear();
 cam.far=Math.max(cam.far,320);cam.updateProjectionMatrix();
 if(CB.light){CIN.li=CB.light.intensity;CIN.ld=CB.light.distance;CB.light.intensity=1.35;CB.light.distance=70}
 document.body.classList.add('owm-cin-on');
 const el=CIN.el;el.classList.add('on');el.classList.remove('wait','sk');
 CIN.blk.style.transition='none';CIN.blk.style.opacity='1';
 setTimeout(()=>{if(CIN.active)el.classList.add('bars')},150);
 cinEnter(shots[0]);
 return true;
}
function cinTick(dt){
 if(!CIN.active)return;
 if(dt>.05)dt=.05;
 CIN.t+=dt;CIN.ts+=dt;
 breaking=false;mining=false;punchT=0;joy.x=joy.y=0;
 if(CIN.t>.9)CIN.el.classList.add('sk');
 while(CIN.sched.length&&CIN.sched[0].t<=CIN.t){const f=CIN.sched.shift();try{f.fn()}catch(e){console.error('[OWM] cinemática:',e)}}
 let s=CIN.shots[CIN.i];
 if(CIN.ts>=s.d){CIN.i++;s=CIN.shots[CIN.i];if(!s){cinFinish(false);return}cinEnter(s)}
 const k=Math.min(1,CIN.ts/s.d),e=s.ease==='lin'?k:s.ease==='out'?1-Math.pow(1-k,3):k*k*k*(k*(6*k-15)+10);
 if(CIN.tk&&CIN.tkOn)cinTanks(dt);
 if(CIN.kind==='wave')cinWaveStep(dt);
 s.f(k,e,dt);   // o plano preenche CIN.pos e CIN.look
 // tremor de mão + trepidação dos tanques + leve inclinação
 const T=CIN.t,h=s.hand===undefined?1:s.hand,rm=CIN.rumble;
 const nx=(Math.sin(T*1.3)*.7+Math.sin(T*2.7+2)*.3)*.035*h+Math.sin(T*47)*.022*rm;
 const ny=(Math.sin(T*1.1+1)*.7+Math.sin(T*3.1)*.3)*.03*h+Math.sin(T*53+1)*.022*rm;
 const nz=Math.sin(T*1.7+4)*.03*h;
 cam.fov=s.fov[0]+(s.fov[1]-s.fov[0])*e;cam.updateProjectionMatrix();
 // o avatar do jogador (continua parado onde está)
 try{anim.update(dt,{inGame:true,lockFwd:false,attack:false,sprint:false,tp3:true,p:P.p,vel:P.vel,og:true,mining:false,swT:0,cp:0,landV:0,coil:false,dash:-1,custom:null})}catch(er){}
 P.landV=0;updateParticles(dt);
 cam.position.set(CIN.pos.x+nx,CIN.pos.y+ny,CIN.pos.z+nz);
 cam.lookAt(CIN.look.x+nx*.4,CIN.look.y+ny*.4,CIN.look.z+nz*.4);
 cam.rotateZ(Math.sin(T*.6)*.012*h);
 // a lâmpada do mapa acompanha o que a câmera está vendo (ela normalmente segue o jogador)
 if(CB.light){const lp=CIN.v2.copy(CIN.look).sub(cam.position),ll=lp.length();if(ll>20)lp.multiplyScalar(20/ll);CB.light.position.copy(cam.position).add(lp);CB.light.position.y+=1.2}
 // fade (entrada/saída do plano)
 let b=0;if(s.fi&&CIN.ts<s.fi)b=1-CIN.ts/s.fi;if(s.fo&&CIN.ts>s.d-s.fo)b=Math.max(b,(CIN.ts-(s.d-s.fo))/s.fo);
 b=Math.max(0,Math.min(1,b));CIN.blk.style.transition='none';CIN.blk.style.opacity=String(b*b*(3-2*b));
 if(CIN.titleT>0){CIN.titleT-=dt;if(CIN.titleT<=0)CIN.ttl.classList.remove('show')}
 post.setGround(groundH(P.p.x,P.p.z));post.update(dt);stream(P.p.x>>4,P.p.z>>4,S.dist,1);
}
function cinFinish(abort){
 if(!CIN.active)return;
 CIN.active=false;
 const done=CIN.done;CIN.done=null;CIN.sched.length=0;
 if(CIN.keepYaw)P.pitch=0;else{P.yaw=CIN.sv.yaw;P.pitch=CIN.sv.pitch}
 CIN.keepYaw=false;CIN.far=false;
 P.vel.set(0,0,0);for(const k in keys)keys[k]=false;joy.x=joy.y=0;breaking=false;mining=false;punchT=0;
 cam.fov=CIN.sv.fov;cam.far=CIN.sv.far;cam.updateProjectionMatrix();
 if(CB.light&&CIN.li!==null){CB.light.intensity=CIN.li;CB.light.distance=CIN.ld;CIN.li=CIN.ld=null}
 document.body.classList.remove('owm-cin-on');
 const el=CIN.el,b=CIN.blk;el.classList.remove('bars','sk','wait');CIN.ttl.classList.remove('show');CIN.tag.classList.remove('show');
 b.style.transition='none';b.style.opacity='1';void b.offsetWidth;b.style.transition='opacity .8s ease';b.style.opacity='0';   // volta pro jogo saindo do preto
 setTimeout(()=>{if(!CIN.active)el.classList.remove('on')},950);
 try{if(done)done(!!abort)}catch(e){console.error('[OWM] cinemática (fim):',e)}
}
// durante a cutscene o teclado fica bloqueado; Esc/Espaço/Enter pulam depois do primeiro instante
document.addEventListener('keydown',e=>{if(!CIN.active)return;e.preventDefault();e.stopImmediatePropagation();if(CIN.t>.9&&(e.code==='Escape'||e.code==='Space'||e.code==='Enter'))cinFinish(true)},true);
document.addEventListener('keyup',e=>{if(CIN.active){e.preventDefault();e.stopImmediatePropagation()}},true);

/* ---------- CUTSCENE 1: entrada na Camera Base ---------- */
/* procura "partes" da base: pontos livres e distantes do salão, escolhendo os que têm a vista mais longa (corredores/salas grandes) */
function cinPickSpots(fl){
 const C=CB.col;if(!C)return[];
 const x0=Math.max(C.x0,-130),x1=Math.min(C.x0+C.gw*C.cs,130),z0=Math.max(C.z0,-130),z1=Math.min(C.z0+C.gh*C.cs,130),cands=[];
 for(let x=Math.ceil(x0/9)*9;x<x1;x+=9)for(let z=Math.ceil(z0/9)*9;z<z1;z+=9){
  if(Math.hypot(x,z)<24)continue;
  let last=-1e9;
  for(const off of[0,6,12,-6]){
   const g=cambGround(x,z,fl+off+.4);if(g<=CAMB_VOID+1||Math.abs(g-last)<1)continue;last=g;
   if(cambHit(x,g,z)||cambHit(x,g+1.3,z))continue;
   let ring=true;for(let j=0;j<8&&ring;j++){const b=j*.785;if(cambHit(x+Math.cos(b)*2.5,g,z+Math.sin(b)*2.5))ring=false}
   if(ring)cands.push({x,y:g,z});
  }
 }
 cands.sort((p,q)=>(((p.x*73856093)^(p.z*19349663))&1023)-(((q.x*73856093)^(q.z*19349663))&1023));   // embaralha sempre do mesmo jeito
 const ev=[];
 for(const c of cands.slice(0,44)){
  let best=0,ba=0,open=0;
  for(let j=0;j<16;j++){
   const a=j*Math.PI/8,dx=Math.cos(a),dz=Math.sin(a);let d=0;
   for(let s=2;s<=44;s+=2){if(cambHit(c.x+dx*s,c.y,c.z+dz*s))break;d=s}
   if(d>10)open++;if(d>best){best=d;ba=a}
  }
  if(best>=12)ev.push({x:c.x,y:c.y,z:c.z,a:ba,dist:best,score:Math.min(best,38)+open*1.2});
 }
 ev.sort((p,q)=>q.score-p.score);
 const out=[];
 for(const e of ev){if(out.length>=3)break;if(out.every(o=>Math.hypot(o.x-e.x,o.z-e.z)>26||Math.abs(o.y-e.y)>3))out.push(e)}
 return out;
}
function cinShotHall(fl){   // descida de guindaste no salão principal, com o título
 const c=cinV(0,fl+1.5,0),up=cinRay(c,CIN.v1.set(0,1,0),24),top=Math.max(4,Math.min(13,1.5+up-1));
 const ca=cinClearAngle(c,40,.3),a0=ca.a,r0=Math.max(5,Math.min(15,ca.d*.8));
 const pol=(a,r,h)=>cinV(Math.sin(a)*r,fl+h,Math.cos(a)*r);
 const path=cinPath(c,[pol(a0,r0,top),pol(a0+.45,r0*.75,top*.55+1),pol(a0+.9,Math.max(4.5,r0*.5),2.4)]);
 const l0=cinV(0,fl+1.2,0),l1=cinV(0,fl+1.9,0);
 return{d:4.8,fi:1.1,fov:[66,50],hand:.5,title:['CAMERA BASE','CENTRO DE OPERAÇÕES'],titleT:3.3,tag:['SETOR 00','SALÃO CENTRAL'],
  f:(k,e)=>{path.getPoint(e,CIN.pos);CIN.look.lerpVectors(l0,l1,e)}};
}
function cinShotSpot(s,i){   // três tipos de plano: avanço pelo corredor, guindaste baixo, panorâmica
 const dx=Math.cos(s.a),dz=Math.sin(s.a),px=-dz,pz=dx,L=Math.min(s.dist*.9,34),eye=s.y+1.7,anc=cinV(s.x,eye,s.z);
 const names=[['SETOR 01','ÁREA OPERACIONAL'],['SETOR 02','CORREDOR PRINCIPAL'],['SETOR 03','SALA TÁTICA']];
 let path,look,fov,hand=.8;
 if(i%3===0){
  path=cinPath(anc,[cinV(s.x,eye,s.z),cinV(s.x+dx*4,eye+.15,s.z+dz*4),cinV(s.x+dx*8,eye+.3,s.z+dz*8)]);
  look=(e,o)=>o.set(s.x+dx*L,s.y+2.3,s.z+dz*L);fov=[68,54];
 }else if(i%3===1){
  path=cinPath(anc,[cinV(s.x,s.y+.7,s.z),cinV(s.x+px*2,s.y+2,s.z+pz*2),cinV(s.x+px*4,s.y+3.5,s.z+pz*4)]);
  look=(e,o)=>o.set(s.x+dx*L*.8,s.y+1.8+e*1.4,s.z+dz*L*.8);fov=[60,50];hand=.5;
 }else{
  path=cinPath(anc,[cinV(s.x,eye+.2,s.z),cinV(s.x-dx*1.5,eye+.2,s.z-dz*1.5),cinV(s.x-dx*3,eye+.2,s.z-dz*3)]);
  look=(e,o)=>{const a=s.a-.75+1.5*e;o.set(s.x+Math.cos(a)*22,s.y+2.4,s.z+Math.sin(a)*22)};fov=[62,62];
 }
 return{d:3.2,fov,hand,tag:names[i%3],f:(k,e)=>{path.getPoint(e,CIN.pos);look(e,CIN.look)}};
}
/* tanques: cada um sai de longe (em linha reta, pelo lado de fora do salão) e freia até o ponto onde nasceu */
function cinTankPlan(){
 const W=[[0,3.8],[2.4,6.2],[4.4,8.4]],out=[];let n=0;
 for(const t of ATNK.list){
  if(t.plate)continue;
  const gx=t.g.position.x,gz=t.g.position.z,gy=t.g.position.y,hf=t.hy,base=Math.atan2(gx,gz);
  let bD=0,bA=base;
  for(const da of[0,.3,-.3,.6,-.6,.95,-.95]){
   const a=base+da,ox=Math.sin(a),oz=Math.cos(a);let D=0;
   for(let d=4;d<=32;d+=2){
    const x=gx+ox*d,z=gz+oz*d,g=cambGround(x,z,gy+.5);
    if(g<=CAMB_VOID+1||Math.abs(g-gy)>.45||cambHit(x,gy,z)||cambHit(x+oz*2.4,gy,z-ox*2.4)||cambHit(x-oz*2.4,gy,z+ox*2.4))break;
    D=d;
   }
   if(D>bD+2){bD=D;bA=a}
  }
  const w=W[n%3],ox=Math.sin(bA),oz=Math.cos(bA);
  out.push({t,i:n,ex:gx,ey:gy,ez:gz,sx:gx+ox*bD,sz:gz+oz*bD,D:bD,hf,ha:Math.atan2(-ox,-oz),base:bA,w0:w[0],w1:w[1],warp:bD<10,on:0,dust:0});
  t.g.visible=false;n++;
 }
 return out;
}
function cinTanks(dt){
 const tt=CIN.t-CIN.tk0;let rum=0;
 for(const q of CIN.tk){
  const t=q.t,g=t.g;
  if(tt<q.w0){g.visible=false;continue}
  g.visible=true;
  if(!q.on){q.on=1;cinNoise(2.8,.32,150);if(q.warp)rbxHit({x:q.ex,y:q.ey+.5,z:q.ez},TK_PAL,{n:14,sp:8,size:.5,flash:2.6,ring:6,fin:true})}
  if(q.warp){g.position.set(q.ex,q.ey,q.ez);g.rotation.y=q.hf;t.hy=q.hf;t.yaw=q.hf+Math.sin(tt*1.1+q.i*2)*.5;t.tur.rotation.y=t.yaw-q.hf;continue}
  const u=Math.max(0,Math.min(1,(tt-q.w0)/(q.w1-q.w0))),e=1-Math.pow(1-u,1.8),px=q.sx+(q.ex-q.sx)*e,pz=q.sz+(q.ez-q.sz)*e;
  const gnd=cambGround(px,pz,g.position.y+.5);
  g.position.x=px;g.position.z=pz;if(gnd>CAMB_VOID+1)g.position.y+=(gnd-g.position.y)*Math.min(1,dt*10);
  const h=q.ha+tkWrap(q.hf-q.ha)*cinSm(.62,1,u);g.rotation.y=h;t.hy=h;
  t.yaw=h+(u>=1?Math.sin((tt-q.w1)*1.2+q.i*2)*.55:0);t.tur.rotation.y=t.yaw-h;t.tur.rotation.x=0;   // depois de parar, a torre varre em volta
  const sp=1.8*Math.pow(1-u,.8)*q.D/(q.w1-q.w0);
  q.dust-=dt;
  if(q.dust<=0&&sp>1.2){q.dust=.07;const fx=Math.sin(h),fz=Math.cos(h),rx=fz,rz=-fx;for(const sd of[-1.9,1.9])rbxAdd('glow',0x8a7f6a,px-fx*4.2+rx*sd,g.position.y+.3,pz-fz*4.2+rz*sd,R4()*.6,.6+Math.random()*.6,R4()*.6,.9,1.9,{peak:.3,drag:2})}
  const dd=Math.hypot(P.p.x-px,P.p.z-pz);if(sp>1)rum=Math.max(rum,Math.min(1,sp/8)*Math.max(0,1-dd/55));
 }
 CIN.rumble=rum;
}
function cinTankShots(tk,fl){
 const A=tk[0],B=tk[1%tk.length],Cn=tk[2%tk.length],sh=[];
 const tp=(q,o,dy)=>o.set(q.t.g.position.x,q.t.g.position.y+dy,q.t.g.position.z);
 // T1: plano baixo de frente, o tanque vem na direção da câmera
 {const inx=-Math.sin(A.base),inz=-Math.cos(A.base),px=-inz,pz=inx;let path=null;
  sh.push({d:3.6,fov:[54,62],hand:.9,tag:['TANQUES ALIADOS','CHEGANDO À BASE'],
   enter:()=>{CIN.tkOn=true;CIN.tk0=CIN.t;const anc=cinV(A.ex+inx*5,A.ey+2,A.ez+inz*5);
    path=cinPath(anc,[cinV(A.ex+inx*11+px*3.4,A.ey+1.1,A.ez+inz*11+pz*3.4),cinV(A.ex+inx*14+px*2.8,A.ey+1.5,A.ez+inz*14+pz*2.8),cinV(A.ex+inx*17+px*2,A.ey+1.9,A.ez+inz*17+pz*2)]);
    CIN.lk.set(A.sx,A.ey+2.3,A.sz)},
   f:(k,e,dt)=>{path.getPoint(e,CIN.pos);tp(A,CIN.v3,2.3);CIN.lk.lerp(CIN.v3,1-Math.exp(-dt*5));CIN.look.copy(CIN.lk)}})}
 // T2: lateral com lente longa, acompanhando o segundo tanque
 {const ox=Math.sin(B.base),oz=Math.cos(B.base),px=oz,pz=-ox;let path=null;
  sh.push({d:3.0,fov:[40,34],hand:.9,tag:['UNIDADE 02','ENTRANDO EM POSIÇÃO'],
   enter:()=>{const mx=(B.sx+B.ex)/2,mz=(B.sz+B.ez)/2,y=B.ey,anc=cinV(mx,y+2.5,mz);
    const side=cinRay(anc,cinV(px,0,pz),18)>=cinRay(anc,cinV(-px,0,-pz),18)?1:-1;
    path=cinPath(anc,[cinV(mx+px*side*16+ox*4,y+3.4,mz+pz*side*16+oz*4),cinV(mx+px*side*15,y+3,mz+pz*side*15),cinV(mx+px*side*14-ox*5,y+2.6,mz+pz*side*14-oz*5)]);
    tp(B,CIN.lk,2)},
   f:(k,e,dt)=>{path.getPoint(e,CIN.pos);tp(B,CIN.v3,2);CIN.lk.lerp(CIN.v3,1-Math.exp(-dt*5));CIN.look.copy(CIN.lk)}})}
 // T3: guindaste subindo do jogador até uma vista alta da defesa completa
 {const c=cinV(0,fl+1.5,0);let path=null;const l0=cinV(0,fl+1.7,0),l1=cinV(Cn.ex,fl+1.2,Cn.ez);
  sh.push({d:4.2,fo:1.1,fov:[52,62],hand:.6,tag:['DEFESA ATIVADA','LASER · '+tk.length+(tk.length>1?' UNIDADES':' UNIDADE')],
   enter:()=>{const up=cinRay(c,CIN.v1.set(0,1,0),24),top=Math.max(4,Math.min(13,1.5+up-1)),ca=cinClearAngle(c,30,.3),a=ca.a,r=Math.max(4,Math.min(8,ca.d*.7));
    path=cinPath(c,[cinV(Math.sin(a)*r,fl+1.3,Math.cos(a)*r),cinV(Math.sin(a+.4)*r*.8,fl+top*.5,Math.cos(a+.4)*r*.8),cinV(Math.sin(a+.8)*3,fl+top,Math.cos(a+.8)*3)])},
   f:(k,e)=>{path.getPoint(e,CIN.pos);CIN.look.lerpVectors(l0,l1,e)}})}
 return sh;
}
function cinBaseDone(){   // termina (ou pula): todos os tanques ficam no lugar de origem, ligados e prontos
 const tk=CIN.tk;CIN.tk=null;CIN.tkOn=false;CIN.rumble=0;
 if(tk)for(const q of tk){const t=q.t,g=t.g;g.visible=true;g.position.set(q.ex,q.ey,q.ez);g.rotation.y=q.hf;t.hy=q.hf;t.yaw=q.hf;t.pit=0;t.sp=0;t.st='idle';t.cd=1.2;t.tgt=null;t.tur.rotation.y=0;t.tur.rotation.x=0;t.wx=q.ex;t.wz=q.ez;t.pz=2}
}
function cinBasePlay(withTanks){
 CIN.tk=null;CIN.tkOn=false;
 const g0=cambGround(0,0,CAMB_Y+.4),fl=g0>CAMB_VOID+1?g0:CAMB_Y,shots=[cinShotHall(fl)];
 cinPickSpots(fl).forEach((s,i)=>shots.push(cinShotSpot(s,i)));
 if(withTanks){const tk=cinTankPlan();if(tk.length){CIN.tk=tk;for(const s of cinTankShots(tk,fl))shots.push(s)}}
 const last=shots[shots.length-1];last.fo=Math.max(last.fo||0,1);
 const ok=cinStart('base',shots,cinBaseDone);
 if(ok)cinAt(1.0,()=>{cinTone(78,30,1.4,'sine',.6);cinNoise(1.8,.3,220)});
 else cinBaseDone();
 return ok;
}

/* ---------- CUTSCENE 2: início do modo ondas ---------- */
/* nascimento dos Striders durante a cutscene: bem longe, na direção mais livre, à vista do jogador (sem isso o normal é 22–32 m) */
function strFindSpotFar(){
 const ba=CIN.dirOut;
 for(let k=0;k<70;k++){
  const a=ba+(Math.random()-.5)*2.2,r=Math.max(28,64-k*.5)-Math.random()*8,x=P.p.x+Math.sin(a)*r,z=P.p.z+Math.cos(a)*r,gy=cambGround(x,z,P.p.y+.4);
  if(Math.abs(gy-P.p.y)>.7)continue;
  let ok=true;for(let j=0;j<8&&ok;j++){const b=j*.785,xx=x+Math.cos(b)*3,zz=z+Math.sin(b)*3;if(cambHit(xx,gy,zz)||Math.abs(cambGround(xx,zz,gy+.4)-gy)>.7)ok=false}
  if(!ok)continue;
  if(k<45&&!strLOS(P.p.x,P.p.y+1.5,P.p.z,x,gy+4,z))continue;
  if(k<55&&STR.list.some(o=>Math.hypot(o.x-x,o.z-z)<9))continue;
  return[x,gy,z];
 }
 return strFindSpot();
}
function cinWaveStep(dt){   // os Striders andam (devagar) mas não atiram nem pisam durante a cutscene
 if(!STM.on)return;
 for(const t of STR.list){if(t.cd<2.4)t.cd=2.4;if(t.skCd<3.5)t.skCd=3.5}
 if(STR.pending>0&&STR.spawnT>.55)STR.spawnT=.55;
 strUpdate(dt*.55);
}
function cinWaveDone(){
 CIN.far=false;
 if(!STM.on)strModeBegin();
 if(STM.on&&STM.wave%5!==0)strSpawnZombies();   // zumbis só aparecem agora (escondidos pelo fade de volta pro jogo)
 for(const t of STR.list){t.cd=Math.max(t.cd,2.6);t.skCd=Math.max(t.skCd,4)}
}
function cinWaveIntro(){
 if(CIN.active)return false;
 try{
  const x0=P.p.x,y0=P.p.y,z0=P.p.z;
  // direção de onde eles vêm: a linha de visão mais longa e plana a partir do jogador
  let ba=0,bd=-1;
  for(let i=0;i<16;i++){const a=i*Math.PI/8,sx=Math.sin(a),cz=Math.cos(a);let d=0;
   for(let s=3;s<=72;s+=3){const x=x0+sx*s,z=z0+cz*s;if(cambHit(x,y0,z)||Math.abs(cambGround(x,z,y0+.5)-y0)>1.2)break;d=s}
   if(d>bd+2){bd=d;ba=a}}
  CIN.dirOut=ba;
  const dx=Math.sin(ba),dz=Math.cos(ba),px=dz,pz=-dx,c=cinV(x0,y0+1.5,z0),sh=[];
  P.yaw=Math.atan2(-dx,-dz);P.pitch=0;CIN.keepYaw=true;   // o jogador já fica de frente pra onda
  const cen=o=>{let n=0,sx=0,sz=0,sy=0;for(const t of STR.list)if(t.hp>0){sx+=t.x;sz+=t.z;sy+=t.by;n++}return n?o.set(sx/n,sy/n+6,sz/n):o.set(x0+dx*46,y0+5,z0+dz*46)};
  // W1: atrás do jogador, olhando pro horizonte; alerta e título
  {const path=cinPath(c,[cinV(x0-dx*5.5+px*1.6,y0+1.9,z0-dz*5.5+pz*1.6),cinV(x0-dx*4+px*1.3,y0+1.8,z0-dz*4+pz*1.3),cinV(x0-dx*2.2+px*.9,y0+1.7,z0-dz*2.2+pz*.9)]),l=cinV(x0+dx*30,y0+4.5,z0+dz*30);
   sh.push({d:3.4,fi:.8,fov:[62,50],hand:1,title:['ONDA 1','INIMIGOS DETECTADOS'],titleT:2.8,tag:['ALERTA','HOSTIS SE APROXIMANDO'],f:(k,e)=>{path.getPoint(e,CIN.pos);CIN.look.copy(l)}})}
  // W2: lateral, lente longa, acompanhando o grupo de Striders marchando
  {let path=null;
   sh.push({d:3.2,fov:[44,36],hand:.9,ease:'lin',tag:['CONTATO','STRIDERS EM MARCHA'],
    enter:()=>{const m=cen(CIN.v1);let ux=m.x-x0,uz=m.z-z0;const ul=Math.hypot(ux,uz)||1;ux/=ul;uz/=ul;const qx=-uz,qz=ux,anc=cinV(x0+ux*8,y0+2.2,z0+uz*8);
     path=cinPath(anc,[cinV(x0+ux*14+qx*10,y0+2.2,z0+uz*14+qz*10),cinV(x0+ux*15+qx*9,y0+2.5,z0+uz*15+qz*9),cinV(x0+ux*17+qx*8,y0+2.8,z0+uz*17+qz*8)]);CIN.lk.copy(m)},
    f:(k,e,dt)=>{path.getPoint(e,CIN.pos);cen(CIN.v3);CIN.lk.lerp(CIN.v3,1-Math.exp(-dt*3));CIN.look.copy(CIN.lk)}})}
  // W3: guindaste atrás do jogador, olhando a horda se aproximar
  {let path=null;
   sh.push({d:3.8,fo:1.1,fov:[58,52],hand:.6,tag:['PREPARE-SE','ONDA 1 INICIANDO'],
    enter:()=>{const up=cinRay(c,CIN.v1.set(0,1,0),24),top=Math.max(4,Math.min(14,1.5+up-1));
     path=cinPath(c,[cinV(x0-dx*3+px*3,y0+3.5,z0-dz*3+pz*3),cinV(x0-dx*5+px*4,y0+top*.6,z0-dz*5+pz*4),cinV(x0-dx*8+px*3,y0+top,z0-dz*8+pz*3)]);cen(CIN.lk)},
    f:(k,e,dt)=>{path.getPoint(e,CIN.pos);cen(CIN.v3);CIN.lk.lerp(CIN.v3,1-Math.exp(-dt*3));CIN.look.copy(CIN.lk)}})}
  CIN.far=true;
  if(!cinStart('wave',sh,cinWaveDone)){CIN.far=false;CIN.keepYaw=false;return false}
  cinAt(.4,()=>{if(!STM.on)strModeBegin()});   // a onda começa de verdade logo no começo da cutscene
  cinAt(.8,()=>{cinTone(620,620,.2,'square',.1)});cinAt(1.1,()=>{cinTone(620,620,.2,'square',.1)});cinAt(1.4,()=>{cinTone(620,620,.2,'square',.1)});
  cinAt(.9,()=>{cinTone(70,26,1.3,'sine',.55);cinNoise(1.6,.28,200)});
  return true;
 }catch(e){console.error('[OWM] cinemática da onda:',e);CIN.far=false;CIN.keepYaw=false;return false}
}

/* ---------- Calor do deserto ----------
   HT.t = segundos do relógio de calor. Ele avança 1 segundo a cada 0,8 s reais dentro do deserto (limite de 3:20); o dano por excesso continua medido em segundos reais.
   Fora do deserto desce COOL/s. Dentro de água (rasa) para de esquentar; nadando refresca rápido e aumenta o limite (bônus). */
const HEAT={LIMIT:200,DMG:4,COOL:3,WADE:4,SWIM:10,BONUS:6,BONUS_MAX:150,BONUS_DECAY:3,THR:.3,SECOND_REAL:.8}; // LIMIT 200 = 3:20 no relógio; 1 s do relógio de calor = 0,8 s reais (≈160 s reais até o dano)
const HT={t:0,b:0,over:false,dt:0,fx:0,fxd:-1,sec:-1,cls:''};
function heatFx(v,over){HT.fxd=v;const e=$('#heat');e.style.opacity=Math.min(1,v);e.classList.toggle('over',!!over);OWM.post.setHeat(v)}
function heatReset(){HT.t=0;HT.b=0;HT.over=false;HT.dt=0;HT.fx=0;HT.sec=-1;HT.cls='';heatFx(0,false);$('#heat-ic').className=''}
let musDes=false;
function updateHeat(dt,realDt=dt){
 const heatDt=Math.max(0,realDt)/HEAT.SECOND_REAL;
 const dw=desertW(P.p.x,P.p.z),inD=dw>=HEAT.THR;
 if(OWM.musicBiome){const m=musDes?dw>=.2:dw>=.3;if(m!==musDes){musDes=m;OWM.musicBiome(m?'desert':'')}}   // música do deserto, com histerese
 const wd=waterSurf(P.p.x,P.p.z)-P.p.y,swim=wd>.75,wade=wd>.15;
 if(swim){HT.t=Math.max(0,HT.t-HEAT.SWIM*heatDt);if(inD)HT.b=Math.min(HEAT.BONUS_MAX,HT.b+HEAT.BONUS*heatDt)}
 else if(wade)HT.t=Math.max(0,HT.t-HEAT.WADE*heatDt);
 else if(inD)HT.t+=heatDt;
 else HT.t=Math.max(0,HT.t-HEAT.COOL*heatDt);
 if(!inD&&HT.t<=0)HT.b=Math.max(0,HT.b-HEAT.BONUS_DECAY*heatDt);
 const lim=HEAT.LIMIT+HT.b;HT.t=Math.min(HT.t,lim+8);
 const over=inD&&HT.t>lim;if(over&&!HT.over)HT.dt=1;HT.over=over;   // o primeiro tick de dano vem na hora
 if(over){HT.dt+=Math.max(0,realDt);while(HT.dt>=1){HT.dt-=1;hurt(HEAT.DMG,true,'Você morreu de calor!')}}else HT.dt=0;
 /* HUD: ícone ao lado da barra de vida + tempo restante */
 const left=Math.max(0,lim-HT.t),sec=Math.ceil(left),frac=Math.min(1,left/lim),cls=(inD||HT.t>.5?'show ':'')+(over?'over crit':frac<.25?'crit':frac<.5?'hot':'');
 if(sec!==HT.sec||cls!==HT.cls){const ic=$('#heat-ic');ic.className=cls;$('#heat-t').textContent=Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');$('#heat-ring').setAttribute('stroke-dashoffset',(100.53*(1-frac)).toFixed(2));HT.sec=sec;HT.cls=cls}
 /* efeito: miragem + tom quente + vinheta; some na água */
 const tgt=sstep(.1,.6,dw)*(.5+.5*Math.min(1,HT.t/lim))*(wade?.2:1)*(1-.5*OWM.sand.k);HT.fx+=(tgt-HT.fx)*Math.min(1,dt*2.5);
 if(Math.abs(HT.fx-HT.fxd)>.01||over!==HT.ov){HT.ov=over;heatFx(HT.fx,over)}
}
/* ---------- Veneno (escorpião) ----------
   O primeiro golpe aplica veneno: POISON_DUR s com 1 de dano por segundo; depois do efeito vem POISON_CD s em que não dá pra envenenar de novo. */
const PZ={on:false,el:0,n:0,cd:0,sec:-1,cls:'',fx:0,dur:3,dps:1,cdT:3};   // dur/dps/cdT = parâmetros do veneno em curso (cada espécie traz os seus; ver SPC)
function poisonReset(){PZ.on=false;PZ.el=0;PZ.n=0;PZ.cd=0;PZ.sec=-1;PZ.cls='';PZ.fx=0;PZ.dur=3;PZ.dps=1;PZ.cdT=3;$('#pois-ic').className='';$('#pois').style.opacity=0}
function poisonApply(k){if(PZ.on||PZ.cd>0)return false;PZ.on=true;PZ.el=0;PZ.n=0;PZ.dur=k?k.POISON_DUR:3;PZ.dps=k?k.POISON_DPS:1;PZ.cdT=k?k.POISON_CD:3;return true}   // k = espécie que mordeu (escorpião 1×3 s + 3 s de espera; cobra 3×2 s + 4 s de espera)
function updatePoison(dt){
 if(PZ.on){PZ.el+=dt;while(PZ.n<PZ.dur&&PZ.el>=PZ.n+1){PZ.n++;hurt(PZ.dps,true,'Você morreu envenenado!')}if(PZ.el>=PZ.dur&&PZ.n>=PZ.dur){PZ.on=false;PZ.cd=PZ.cdT}}
 else if(PZ.cd>0)PZ.cd=Math.max(0,PZ.cd-dt);
 const left=PZ.on?PZ.dur-PZ.el:PZ.cd,tot=PZ.on?PZ.dur:PZ.cdT,sec=Math.ceil(left),cls=PZ.on?'show on':PZ.cd>0?'show cd':'';
 if(sec!==PZ.sec||cls!==PZ.cls){PZ.sec=sec;PZ.cls=cls;$('#pois-ic').className=cls;$('#pois-t').textContent=sec>0?sec+'s':'';$('#pois-ring').setAttribute('stroke-dashoffset',(100.53*(1-Math.min(1,left/tot))).toFixed(2))}
 else if(cls)$('#pois-ring').setAttribute('stroke-dashoffset',(100.53*(1-Math.min(1,left/tot))).toFixed(2));
 PZ.fx+=((PZ.on?.55:0)-PZ.fx)*Math.min(1,dt*5);const o=PZ.fx>.01?PZ.fx:0;if(o!==PZ.o){PZ.o=o;$('#pois').style.opacity=o}
}

/* ---------- Escorpiões ----------
   Nascem no deserto (spawner dinâmico ao redor do jogador). Se veem o jogador (alcance + campo de visão + linha de visada) correm nele e atacam:
   SCP.DMG de dano por golpe e veneno no primeiro golpe. Têm SCP.HP de vida e SCP.ARMOR de proteção (o soco de SCP.PUNCH vira PUNCH*(1-ARMOR)). */
const SCP={HP:100,ARMOR:.2,PUNCH:7,PUNCH_CD:.5,PUNCH_RANGE:3,BODY_R:.7,DMG:4,SPEED:7*1.1,CHASE_ANIM:1.45*1.1,WALK:1.3*1.1,SIGHT:20,FOV_COS:-.2,ATK_RANGE:2,ATK_CD:.25,ATK_SPEED:1.7,TURN_ATK:7,MAX:6,SPAWN_MIN:24,SPAWN_MAX:50,DESPAWN:85,POISON_DUR:3,POISON_DPS:1,POISON_CD:3};
/* ---------- IA de combate (valores ajustáveis) ----------
   Base mesclada nas 3 espécies (Object.assign({},AI,...)); cada espécie sobrescreve o que quiser em SPC. Também em OWM.AI (a constante se chama AIC).
   Tempos em segundos, distâncias em metros. Faixas [a,b] sorteiam um valor entre a e b. */
const rr=a=>a[0]+Math.random()*(a[1]-a[0]);
const AIC={
 MAX_ATK:2,          // no máximo quantos inimigos atacam ao mesmo tempo (os outros circulam e esperam; quem espera há mais tempo ataca primeiro)
 TOKEN_R:18,         // só disputam vaga de ataque os inimigos a menos de tantos metros
 COMMIT_MAX:5,       // quanto tempo (s) quem tem a vaga pode tentar chegar antes de devolvê-la
 GRAV:26,            // gravidade dos pulos/quedas (m/s²)
 CIRCLE_R:4.2,       // distância em que circulam o jogador enquanto esperam a vez
 WAIT_R:6.2,         // distância de espera quando as vagas de ataque estão cheias
 STRAFE:.8,          // velocidade ao circular (fração da SPEED)
 SEP_R:1.8,SEP_F:2.2,// separação: raio em que se afastam dos vizinhos e força (evita formar fila)
 ZZ_AMP:.45,ZZ_HZ:1.6,// zigue-zague na aproximação: desvio máximo (rad) e frequência (Hz)
 MODE_T:[1.8,3.5],   // quanto tempo (s) ficam num modo de circular antes de sortear outro
 FLANK_P:.3,         // chance de, ao trocar de modo, contornar pelo lado/trás do jogador (×1.8 se o lock-on do jogador está em outro alvo)
 TELE:.4,            // aviso antes do golpe (s): pausa + brilho laranja + pose; o clipe de ataque é pareado a esse tempo
 COMBO_P:.3,COMBO_TELE:.6, // chance de combo de 2–3 golpes e fração do aviso nos golpes seguintes
 HITRUN_P:0,HITRUN_T:1.1,  // chance de recuar depois de bater (hit-and-run) e por quanto tempo
 STAGGER_MIN:8,STAGGER_T:.45,STAGGER_IMM:.8, // dano mínimo que desequilibra (cancela o ataque), duração e imunidade a novo stagger
 ARMOR_ACT:false,    // true = não leva stagger enquanto prepara/executa um ataque (super-armor)
 DODGE_P:.3,DODGE_CD:[3,5],DODGE_DIST:2.2,DODGE_T:.25,DODGE_RANGE:4.5, // esquiva ao ver o jogador começar um golpe: chance, espera, deslocamento, duração, alcance
 RAGE_T:4,RAGE_SPD:1.12,RAGE_CD:.6, // depois de apanhar: tempo agressivo, ×velocidade, ×espera entre golpes
 FLEE_HP:0,FLEE_T:2.5, // foge ao ficar com menos desta fração de vida (0 = nunca) e por quanto tempo
 LOST_T:6,HEAR:5,LOOK_T:2.5, // sem ver o jogador: vai ao último ponto visto, olha em volta e desiste após LOST_T; HEAR = distância em que sente o jogador mesmo fora do campo de visão
 IFRAME:true,        // golpes pesados (dash/pulo) erram se o jogador está no dash (Q)
 /* só o ZUMBI usa (P = 0 desliga): DASH/investida e PULO de ataque */
 LG_P:0,LG_TELE:.4,LG_SPD:12,LG_DIST:6.5,LG_MIN:3,LG_REC:.6,LG_CD:[5,8],LG_DMG:1,
 JP_P:0,JP_TELE:.6,JP_MIN:4,JP_MAX:7,JP_T:.7,JP_R:2.2,JP_REC:.6,JP_CD:[6,9],JP_DMG:1.2,JP_SHAKE:.4375,   // JP_SHAKE = tremor da tela ao aterrissar (cai com a distância)
 /* PISÃO (só o zumbi): ST_P chance de escolher, ST_TELE aviso (s), ST_START distância pra começar, ST_R raio máx. da onda de choque (m), ST_SPD velocidade da onda (m/s),
    ST_REC recuperação (s), ST_CD espera [min,max], ST_DMG × DMG, ST_SHAKE tremor da tela. A onda só acerta quem está NO CHÃO: pular ou usar o dash (Q) desvia. */
 ST_P:0,ST_TELE:.7,ST_START:3.4,ST_R:5.5,ST_SPD:11,ST_REC:.7,ST_CD:[7,11],ST_DMG:.8,ST_SHAKE:.625,
 /* ENTRAR NA TERRA (só o escorpião): afunda na areia, corre por baixo (montinho de areia, sem poder ser atingido), sai e PULA no jogador; repete BR_N vezes e depois fica de fora.
    BR_P chance de escolher · BR_CD espera (s) depois de terminar a sequência · BR_N quantos pulos · BR_TELE aviso antes de afundar · BR_SINK tempo afundando · BR_DEPTH profundidade ·
    BR_SPD velocidade debaixo da terra · BR_TRAVEL tempo máx. de viagem · BR_START distância pra começar · BR_MIN perto demais (ataque comum) · BR_EMERGE distância em que sai ·
    BR_RISE aviso (montinho tremendo) antes de sair · BR_JUMP_T duração do pulo · BR_JMAX alcance do pulo · BR_R raio do dano no pouso · BR_DMG × DMG · BR_REC recuperação · BR_SHAKE tremor da tela */
 BR_P:0,BR_CD:15,BR_N:3,BR_TELE:.35,BR_SINK:.45,BR_DEPTH:1.1,BR_SPD:9,BR_TRAVEL:2.6,BR_START:9,BR_MIN:3.2,BR_EMERGE:2.6,BR_RISE:.45,BR_JUMP_T:.4,BR_JMAX:4.2,BR_R:1.7,BR_DMG:1.3,BR_REC:.4,BR_SHAKE:.2,
 OBS_JUMP:false,OBS_WAIT:.35 // pula obstáculos baixos/degraus que o bloqueiam depois de OBS_WAIT s
};
let SCF=null,SNF=null,ZF=null;
/* Os dois packs são opcionais de forma independente: uma falha ao montar um modelo
   não pode interromper o jogo nem bloquear o spawn da outra espécie. */
try{if(OWM.Scorpion&&OWM.scorpionPack)SCF=OWM.Scorpion(THREE)}catch(e){console.error('[OWM] Falha ao montar escorpião:',e)}
try{if(OWM.Snake&&OWM.snakePack)SNF=OWM.Snake(THREE)}catch(e){console.error('[OWM] Falha ao montar cobra:',e)}
try{if(OWM.Zombie&&OWM.zombiePack)ZF=OWM.Zombie(THREE)}catch(e){console.error('[OWM] Falha ao montar zumbi:',e)}
let ZID=0;   // ordem de nascimento dos inimigos (usada pra distribuir as skills do zumbi)
const scs=[],scBarGeo=new THREE.PlaneGeometry(1,1);let scSpawnT=2,zSpawnT=3,pDmgT=0,punchT=0,fightT=0,fightOn=false;
/* Espécies de inimigo do deserto. Todos os campos que o código dos inimigos lê ficam aqui:
   HP/ARMOR/BODY_R (vida, proteção, raio do cone do soco), DMG (golpe direto), SPEED (perseguição, m/s), WALK (passeio, m/s), SIGHT/FOV_COS (visão), ATK_RANGE/ATK_CD/ATK_SPEED/TURN_ATK (bote),
   CHASE_ANIM/WALK_ANIM (velocidade de reprodução da animação), LUNGE (avanço do bote; só se a distância for > LUNGE_MIN, pra não atravessar o jogador), CLOSE (distância em que para de se aproximar durante o bote), HB_Y (altura da barra de vida), DEAD_Y (altura do corpo virado), MSG (mensagem de morte),
   COIL_P (chance de, em vez de morder, se ENROLAR no jogador) / COIL_CD (espera, em s, até poder enrolar de novo depois de soltar) / COIL_DPS (dano por segundo enquanto enrolada) / COIL_MISS (dano ao errar o QTE) / COIL_MSG,
   POISON_DUR/POISON_DPS/POISON_CD (veneno: segundos de efeito, dano a cada segundo, espera até poder envenenar de novo), SPAWN_P (chance de a próxima vaga ser dessa espécie). */
/* ---------- FARBEN TIRE: animações procedurais (poses por osso, sem dependência do THREE) ----------
   Cada pose é {b:{osso:[rx,ry,rz]}, dy, pit}: rotações em torno dos eixos do MODELO (x = esquerda do personagem, y = pra cima, z = pra frente) aplicadas sobre a pose de repouso.
   Convenção: pra membros que apontam pra baixo, rx > 0 balança PRA TRÁS (rx < 0 = pra frente); pro tronco, rx > 0 = inclina pra frente; ry > 0 = gira pra esquerda; rz > 0 = levanta o lado esquerdo.
   dy = deslocamento vertical do quadril (m do modelo, já com os pés no chão), pit = inclinação do corpo todo em volta dos pés (queda). */
const FBL={L1:.53,L2:.49};
const fbSm=u=>u<=0?0:u>=1?1:u*u*(3-2*u);
const fbLp=(a,b,u)=>a+(b-a)*u;
function fbAdd(p,k,x,y,z){const q=p.b[k]||(p.b[k]=[0,0,0]);q[0]+=x||0;q[1]+=y||0;q[2]+=z||0}
function fbNew(){return{b:{},dy:0,pit:0}}
function fbMirror(p){   // espelha esquerda/direita
 const o=fbNew();o.dy=p.dy;o.pit=p.pit;
 for(const k in p.b){const v=p.b[k],last=k[k.length-1],base=k.slice(0,-1);
  if(last==='L'||last==='R')o.b[base+(last==='L'?'R':'L')]=[v[0],-v[1],-v[2]];else o.b[k]=[v[0],-v[1],-v[2]]}
 return o}
function fbBlend(a,b,u){   // mistura linear de duas poses
 if(u<=0)return a;if(u>=1)return b;
 const o=fbNew();o.dy=fbLp(a.dy,b.dy,u);o.pit=fbLp(a.pit,b.pit,u);
 for(const k in a.b){const x=a.b[k],y=b.b[k]||[0,0,0];o.b[k]=[fbLp(x[0],y[0],u),fbLp(x[1],y[1],u),fbLp(x[2],y[2],u)]}
 for(const k in b.b)if(!a.b[k]){const y=b.b[k];o.b[k]=[y[0]*u,y[1]*u,y[2]*u]}
 return o}
function fbKeys(T,K){   // keyframes [[t,pose],...] com suavização entre eles
 if(T<=K[0][0])return K[0][1];
 for(let i=1;i<K.length;i++)if(T<=K[i][0]){const a=K[i-1],b=K[i];return fbBlend(a[1],b[1],fbSm((T-a[0])/(b[0]-a[0])))}
 return K[K.length-1][1]}
/* quadril: desce o quanto as pernas se abrem/dobram, pra o pé de apoio ficar no chão */
function fbGround(p){
 let best=0;
 for(const s of['L','R']){const t=p.b['thigh'+s]||[0,0,0],c=p.b['calf'+s]||[0,0,0],f=-t[0],k=c[0];best=Math.max(best,FBL.L1*Math.cos(f)+FBL.L2*Math.cos(f-k))}
 return best-(FBL.L1+FBL.L2)}

/* ---- estilos: 's' = pequeno e rápido, 'b' = chefe gigante ---- */
const FBS={
 s:{lean:.26,A:.78,bias:.06,k0:.28,K:1.3,arm:.95,elb:1.45,tw:.34,sw:0,hop:.025,abd:.18,idleLean:.1,stance:1},
 b:{lean:.14,A:.58,bias:.1,k0:.16,K:.75,arm:.4,elb:.55,tw:.16,sw:.07,hop:0,abd:.12,idleLean:.12,stance:0}
};
function fbStance(p,S,e){   // base de pé (também é a pose de "pronto" do idle)
 const s=S==='s'?1:0;
 if(s){   // boxeador: pé esquerdo na frente, punhos erguidos
  fbAdd(p,'thighL',-.28,0,.04);fbAdd(p,'calfL',.36);fbAdd(p,'footL',-.08);
  fbAdd(p,'thighR',.22,0,-.04);fbAdd(p,'calfR',.4);fbAdd(p,'footR',-.5);
  fbAdd(p,'spine',.05);fbAdd(p,'spine1',.05);fbAdd(p,'spine2',.04);fbAdd(p,'neck',-.06);fbAdd(p,'head',-.04);
  fbAdd(p,'armL',-.75,0,.2);fbAdd(p,'foreL',-1.75);fbAdd(p,'armR',-.85,0,-.2);fbAdd(p,'foreR',-1.85);
  fbAdd(p,'spine1',0,.12);fbAdd(p,'spine2',0,.1);
 }else{   // gigante: pernas afastadas, ombros caídos, braços pendurados e fechados
  fbAdd(p,'thighL',-.04,0,.14);fbAdd(p,'thighR',-.04,0,-.14);fbAdd(p,'calfL',.1);fbAdd(p,'calfR',.1);
  fbAdd(p,'spine',.07);fbAdd(p,'spine1',.08);fbAdd(p,'spine2',.07);fbAdd(p,'neck',-.08);fbAdd(p,'head',.02);
  fbAdd(p,'armL',-.15,0,.2);fbAdd(p,'armR',-.15,0,-.2);fbAdd(p,'foreL',-.55);fbAdd(p,'foreR',-.55);
  fbAdd(p,'clavL',0,0,-.06);fbAdd(p,'clavR',0,0,.06);
 }
}
function fbIdle(t,S){   // t em ciclos (1 ciclo = 1 respiração completa)
 const p=fbNew(),s=Math.sin(t*6.2832),c=Math.cos(t*6.2832);fbStance(p,S);
 if(S==='s'){
  fbAdd(p,'spine1',.02*s);fbAdd(p,'spine2',.02*s);fbAdd(p,'head',0,.08*Math.sin(t*3.1+1));
  fbAdd(p,'armL',.04*s);fbAdd(p,'armR',-.04*s);fbAdd(p,'pelvis',0,0,.03*c);fbAdd(p,'spine',0,.05*c);
 }else{
  fbAdd(p,'spine1',.03*s);fbAdd(p,'spine2',.035*s);fbAdd(p,'neck',-.02*s);fbAdd(p,'head',0,.1*Math.sin(t*3.1+1));
  fbAdd(p,'clavL',0,0,.03*s);fbAdd(p,'clavR',0,0,-.03*s);fbAdd(p,'armL',.03*c,0,.02*s);fbAdd(p,'armR',-.03*c,0,-.02*s);
  fbAdd(p,'pelvis',0,0,.045*c);fbAdd(p,'spine',0,0,-.03*c);
 }
 p.dy=fbGround(p)+.004*s;return p}
function fbRun(t,S){   // t em ciclos (1 ciclo = 2 passos)
 const st=FBS[S],p=fbNew(),ph=t*6.2832;
 for(let side=0;side<2;side++){
  const sd=side?'R':'L',psi=ph+side*Math.PI,sn=Math.sin(psi),cs=Math.cos(psi);
  const fwd=st.bias+st.A*sn,knee=st.k0+st.K*Math.pow(Math.max(0,cs),S==='s'?1.1:1.4)+(S==='s'?0:.25*Math.max(0,-sn));
  fbAdd(p,'thigh'+sd,-fwd);fbAdd(p,'calf'+sd,knee);
  fbAdd(p,'foot'+sd,fwd-knee+(.55*Math.max(0,-sn-.2)));   // pé nivelado e ponta no impulso
  fbAdd(p,'thigh'+sd,0,0,(side?-1:1)*st.abd*.35);
  // braços opostos às pernas
  const af=st.arm*Math.sin(psi+Math.PI);
  fbAdd(p,'arm'+sd,-af*(S==='s'?1:1)-(S==='s'?.5:.12),0,(side?-1:1)*st.abd);
  fbAdd(p,'fore'+sd,-(st.elb+(S==='s'?.25*Math.max(0,Math.sin(psi+Math.PI)):.3*Math.max(0,Math.sin(psi+Math.PI)))));
 }
 const lean=st.lean,tw=st.tw*Math.sin(ph);
 fbAdd(p,'spine',lean*.3,-tw*.35);fbAdd(p,'spine1',lean*.35,tw*.35,S==='b'?st.sw*Math.sin(ph)*-.4:0);fbAdd(p,'spine2',lean*.35,tw*.45);
 fbAdd(p,'neck',-lean*.5);fbAdd(p,'head',-lean*.35,-tw*.4);
 fbAdd(p,'pelvis',0,-tw*.35,st.sw*Math.sin(ph));
 fbAdd(p,'clavL',0,0,S==='b'?-.05:.0);fbAdd(p,'clavR',0,0,S==='b'?.05:.0);
 p.dy=fbGround(p)+st.hop*Math.abs(Math.cos(ph))*(S==='s'?1:0);
 return p}
/* ---- ataques (T de 0 a 1; o impacto é em T = .5 — o jogo sincroniza o aviso pra terminar exatamente aí) ---- */
function fbAtkPunchS(alt){   // soco rápido em gancho/direto (mão direita; alt espelha)
 const g=fbNew();fbStance(g,'s');g.dy=fbGround(g);
 const w=fbNew();fbStance(w,'s');   // preparação: gira o tronco pra trás, cotovelo atrás
 fbAdd(w,'spine',-.05,-.12);fbAdd(w,'spine1',-.06,-.14);fbAdd(w,'spine2',-.05,-.14);fbAdd(w,'pelvis',0,-.1);
 fbAdd(w,'armR',.35,0,-.1);fbAdd(w,'foreR',-.9);fbAdd(w,'armL',-.2,0,.1);fbAdd(w,'head',0,.35);
 fbAdd(w,'thighR',.18);fbAdd(w,'thighL',-.12);fbAdd(w,'calfR',.2);w.dy=fbGround(w);
 const h=fbNew();fbStance(h,'s');   // impacto: tronco gira pra frente, braço estendido, passo à frente
 fbAdd(h,'spine',.12,.12);fbAdd(h,'spine1',.14,.16);fbAdd(h,'spine2',.12,.14);fbAdd(h,'pelvis',0,.12);
 fbAdd(h,'armR',-.9,0,.15);fbAdd(h,'foreR',1.55);fbAdd(h,'armL',.1,0,.2);fbAdd(h,'foreL',-.2);fbAdd(h,'head',-.1,-.35);
 fbAdd(h,'thighL',-.38);fbAdd(h,'calfL',.1);fbAdd(h,'thighR',.28);fbAdd(h,'calfR',-.05);fbAdd(h,'footR',-.35);h.dy=fbGround(h);
 const K=[[0,g],[.28,w],[.5,h],[.78,h],[1,g]];
 return alt?K.map(k=>[k[0],fbMirror(k[1])]):K}
function fbAtkPunchB(){   // gigante: soco por cima, de cima pra baixo, com o corpo todo
 const g=fbNew();fbStance(g,'b');g.dy=fbGround(g);
 const w=fbNew();fbStance(w,'b');
 fbAdd(w,'spine',-.12,-.11);fbAdd(w,'spine1',-.13,-.13);fbAdd(w,'spine2',-.12,-.13);fbAdd(w,'neck',.1);fbAdd(w,'pelvis',0,-.1);
 fbAdd(w,'armR',-2.75,0,-.35);fbAdd(w,'foreR',.2);fbAdd(w,'clavR',0,0,.18);fbAdd(w,'armL',-.5,0,.25);fbAdd(w,'foreL',-.5);
 fbAdd(w,'thighL',-.18);fbAdd(w,'calfL',.3);fbAdd(w,'thighR',.14);fbAdd(w,'calfR',.2);w.dy=fbGround(w);
 const pk=fbNew();fbStance(pk,'b');
 fbAdd(pk,'spine',-.16,-.14);fbAdd(pk,'spine1',-.17,-.16);fbAdd(pk,'spine2',-.15,-.16);fbAdd(pk,'neck',.14);fbAdd(pk,'pelvis',0,-.12);
 fbAdd(pk,'armR',-3.05,0,-.4);fbAdd(pk,'foreR',.1);fbAdd(pk,'clavR',0,0,.22);fbAdd(pk,'armL',-.5,0,.25);fbAdd(pk,'foreL',-.5);
 fbAdd(pk,'thighL',-.2);fbAdd(pk,'calfL',.34);fbAdd(pk,'thighR',.18);fbAdd(pk,'calfR',.24);pk.dy=fbGround(pk);
 const h=fbNew();fbStance(h,'b');
 fbAdd(h,'spine',.16,.12);fbAdd(h,'spine1',.2,.15);fbAdd(h,'spine2',.16,.15);fbAdd(h,'neck',-.18);fbAdd(h,'pelvis',.05,.1);
 fbAdd(h,'armR',-1.05,0,-.1);fbAdd(h,'foreR',.05);fbAdd(h,'clavR',0,0,-.1);fbAdd(h,'armL',.25,0,.3);fbAdd(h,'foreL',-.4);
 fbAdd(h,'thighL',-.6);fbAdd(h,'calfL',.55);fbAdd(h,'footL',-.05);fbAdd(h,'thighR',.3);fbAdd(h,'calfR',.05);h.dy=fbGround(h);
 return[[0,g],[.3,w],[.45,pk],[.5,h],[.78,h],[1,g]]}
function fbAtkStomp(S){   // pisão: levanta a perna, segura, e SOCA o pé no chão no impacto
 const g=fbNew();fbStance(g,S);g.dy=fbGround(g);
 const u=fbNew();fbStance(u,S);   // perna direita lá em cima, braços abertos pra equilíbrio
 fbAdd(u,'thighR',-1.2);fbAdd(u,'calfR',1.35);fbAdd(u,'footR',.35);fbAdd(u,'thighL',.05);fbAdd(u,'calfL',.12);
 fbAdd(u,'spine',-.1);fbAdd(u,'spine1',-.1);fbAdd(u,'spine2',-.08);fbAdd(u,'neck',.06);
 fbAdd(u,'armL',-.2,0,.55);fbAdd(u,'armR',-.2,0,-.55);fbAdd(u,'foreL',-.3);fbAdd(u,'foreR',-.3);u.dy=fbGround(u);
 const pk=fbNew();fbStance(pk,S);
 fbAdd(pk,'thighR',-1.42);fbAdd(pk,'calfR',1.2);fbAdd(pk,'footR',.45);fbAdd(pk,'thighL',.08);fbAdd(pk,'calfL',.16);
 fbAdd(pk,'spine',-.16);fbAdd(pk,'spine1',-.14);fbAdd(pk,'spine2',-.12);fbAdd(pk,'neck',.1);
 fbAdd(pk,'armL',-.25,0,.7);fbAdd(pk,'armR',-.25,0,-.7);fbAdd(pk,'foreL',-.25);fbAdd(pk,'foreR',-.25);pk.dy=fbGround(pk);
 const h=fbNew();fbStance(h,S);   // pé bate no chão: tronco desce, joelho da perna de apoio flexiona
 fbAdd(h,'thighR',-.42);fbAdd(h,'calfR',.1);fbAdd(h,'footR',.3);fbAdd(h,'thighL',.18);fbAdd(h,'calfL',.34);
 fbAdd(h,'spine',.14);fbAdd(h,'spine1',.14);fbAdd(h,'spine2',.12);fbAdd(h,'neck',-.1);
 fbAdd(h,'armL',.15,0,.42);fbAdd(h,'armR',.15,0,-.42);fbAdd(h,'foreL',-.4);fbAdd(h,'foreR',-.4);h.dy=fbGround(h)-.03;
 return[[0,g],[.22,u],[.44,pk],[.5,h],[.8,h],[1,g]]}
function fbAtkSlam(S){   // bate no chão com as duas mãos
 const g=fbNew();fbStance(g,S);g.dy=fbGround(g);
 const u=fbNew();fbStance(u,S);
 fbAdd(u,'spine',-.12);fbAdd(u,'spine1',-.14);fbAdd(u,'spine2',-.12);fbAdd(u,'neck',.1);
 fbAdd(u,'armL',-2.7,0,.12);fbAdd(u,'armR',-2.7,0,-.12);fbAdd(u,'foreL',-.55);fbAdd(u,'foreR',-.55);fbAdd(u,'clavL',0,0,.16);fbAdd(u,'clavR',0,0,-.16);
 fbAdd(u,'thighL',-.12);fbAdd(u,'thighR',-.12);fbAdd(u,'calfL',.28);fbAdd(u,'calfR',.28);u.dy=fbGround(u);
 const pk=fbNew();fbStance(pk,S);
 fbAdd(pk,'spine',-.18);fbAdd(pk,'spine1',-.2);fbAdd(pk,'spine2',-.16);fbAdd(pk,'neck',.14);
 fbAdd(pk,'armL',-3.05,0,.14);fbAdd(pk,'armR',-3.05,0,-.14);fbAdd(pk,'foreL',-.4);fbAdd(pk,'foreR',-.4);fbAdd(pk,'clavL',0,0,.2);fbAdd(pk,'clavR',0,0,-.2);
 fbAdd(pk,'thighL',-.1);fbAdd(pk,'thighR',-.1);fbAdd(pk,'calfL',.2);fbAdd(pk,'calfR',.2);pk.dy=fbGround(pk);
 const h=fbNew();fbStance(h,S);
 fbAdd(h,'spine',.3);fbAdd(h,'spine1',.32);fbAdd(h,'spine2',.26);fbAdd(h,'neck',-.22);fbAdd(h,'pelvis',.04);
 fbAdd(h,'armL',-1.15,0,.12);fbAdd(h,'armR',-1.15,0,-.12);fbAdd(h,'foreL',-.1);fbAdd(h,'foreR',-.1);fbAdd(h,'clavL',0,0,-.12);fbAdd(h,'clavR',0,0,.12);
 fbAdd(h,'thighL',-.5);fbAdd(h,'thighR',-.5);fbAdd(h,'calfL',.75);fbAdd(h,'calfR',.75);fbAdd(h,'footL',-.2);fbAdd(h,'footR',-.2);h.dy=fbGround(h);
 return[[0,g],[.32,u],[.45,pk],[.5,h],[.8,h],[1,g]]}
function fbAtk(S,atk,alt){return atk===4?fbAtkStomp(S):atk===6?fbAtkSlam(S):(S==='b'?fbAtkPunchB():fbAtkPunchS(alt))}
const FBA={};   // cache de keyframes por estilo/ataque/alternância
function fbAtkPose(S,atk,alt,T){const k=S+atk+(alt?1:0);return fbKeys(T,FBA[k]||(FBA[k]=fbAtk(S,atk,alt)))}
/* recuperação depois do impacto (pisão/bate-chão): volta devagar do impacto pra pose de pé */
function fbRec(S,atk,alt,t,dur){const u=fbSm(t/dur);return fbBlend(fbAtkPose(S,atk,alt,.5),fbIdle(0,S),u)}
/* morte: joelhos cedem, o corpo tomba de costas em volta dos pés */
function fbDeath(S,T){
 const g=fbIdle(0,S),k=fbNew();fbStance(k,S);   // fase 1: golpe final, cambaleia
 fbAdd(k,'thighL',-.75);fbAdd(k,'thighR',-.55);fbAdd(k,'calfL',1.5);fbAdd(k,'calfR',1.6);fbAdd(k,'spine',-.15);fbAdd(k,'spine1',-.18);fbAdd(k,'neck',.2);fbAdd(k,'head',.15);
 fbAdd(k,'armL',-.5,0,.8);fbAdd(k,'armR',-.5,0,-.8);fbAdd(k,'foreL',-.3);fbAdd(k,'foreR',-.3);k.dy=fbGround(k)-.02;
 const f=fbNew();   // fase 2: deitado, braços abertos
 fbAdd(f,'thighL',.05,0,.1);fbAdd(f,'thighR',.02,0,-.12);fbAdd(f,'calfL',.12);fbAdd(f,'calfR',.2);fbAdd(f,'neck',.12);fbAdd(f,'head',.1);
 fbAdd(f,'armL',-.2,0,.9);fbAdd(f,'armR',-.1,0,-1.0);fbAdd(f,'foreL',-.25);fbAdd(f,'foreR',-.15);fbAdd(f,'spine1',-.05);
 f.dy=.3;f.pit=-1.5;
 // dy do estágio 2 é absoluto (já deitado): o tombo gira o corpo todo em volta dos pés
 const a=fbBlend(g,k,fbSm(T/.38));
 if(T<.38)return a;
 const u=fbSm((T-.34)/.66),o=fbBlend(k,f,u);
 // enquanto cai, o corpo gira; a perna estica só no fim
 return o}

/* ---------- FARBEN TIRE (chefe gigante + capangas): modelo completo (farben-data.js) + instância com ossos animados por código ---------- */
const FB={tpl:null,promise:null,A:{},Ai:{},rest:{},keys:[]};
const FB_BONES={pelvis:'Pelvis',spine:'Spine',spine1:'Spine1',spine2:'Spine2',spine4:'Spine4',neck:'Neck1',head:'Head1',clavL:'L_Clavicle',clavR:'R_Clavicle',armL:'L_UpperArm',armR:'R_UpperArm',foreL:'L_Forearm',foreR:'R_Forearm',handL:'L_Hand',handR:'R_Hand',thighL:'L_Thigh',thighR:'R_Thigh',calfL:'L_Calf',calfR:'R_Calf',footL:'L_Foot',footR:'R_Foot',toeL:'L_Toe0',toeR:'R_Toe0'};
function fbBase(n){return String(n||'').replace(/^.*Bip01_/,'').replace(/(?:_\d+)+$/,'')}   // 'ValveBiped.Bip01_L_Thigh_55_7' (com ou sem os pontos) -> 'L_Thigh'
function fbFind(root,k){let f=null;root.traverse(o=>{if(!f&&o.name&&fbBase(o.name)===FB_BONES[k])f=o});return f}
function fbLoad(){
 if(FB.promise)return FB.promise;
 FB.promise=new Promise((res,rej)=>{
  const parse=()=>{
   if(!THREE.GLTFLoader){rej(new Error('GLTFLoader indisponível'));return}
   const src=window.FARBEN_GLTF;if(!src){rej(new Error('farben-data.js vazio'));return}
   new THREE.GLTFLoader().parse(typeof src==='string'?src:JSON.stringify(src),'',g=>{
    try{
     window.FARBEN_GLTF=null;const r=g.scene;r.updateMatrixWorld(true);
     const p=new THREE.Vector3(),q=new THREE.Quaternion(),sc=new THREE.Vector3();
     const nm=[];r.traverse(o=>{if(o.name)nm.push(o.name)});
     for(const k in FB_BONES){const b=fbFind(r,k);if(!b){console.warn('[OWM] Farben Tire: osso '+k+' não achado. Nomes no modelo:',nm.slice(0,40));continue}b.matrixWorld.decompose(p,q,sc);FB.A[k]=q.clone();FB.Ai[k]=q.clone().invert?q.clone().invert():q.clone().inverse();FB.rest[k]=b.quaternion.clone();FB.keys.push(k)}
     r.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false}});
     FB.tpl=r;res(r);
    }catch(e){rej(e)}
   },e=>rej(e||new Error('falha ao ler o Farben Tire')));
  };
  if(window.FARBEN_GLTF)parse();
  else{const sc=document.createElement('script');sc.src='farben-data.js';sc.onload=parse;sc.onerror=()=>rej(new Error('farben-data.js não encontrado (deve ficar na mesma pasta do index.html)'));document.head.appendChild(sc)}
 });
 return FB.promise;
}
function fbClone(src){   // clone de malha com esqueleto (cada inimigo tem os próprios ossos)
 const a=[],b=[],clone=src.clone();
 (function walk(x,y){a.push(x);b.push(y);for(let i=0;i<x.children.length;i++)walk(x.children[i],y.children[i])})(src,clone);
 clone.traverse(n=>{
  if(!n.isSkinnedMesh)return;const sn=a[b.indexOf(n)],bones=sn.skeleton.bones.map(bn=>b[a.indexOf(bn)]);
  n.skeleton=new THREE.Skeleton(bones,sn.skeleton.boneInverses);n.bind(n.skeleton,sn.bindMatrix);
 });
 return clone;
}
const _fbE=new THREE.Euler(),_fbQ=new THREE.Quaternion(),_fbZ=[0,0,0];
function fbCreate(S){
 if(!FB.tpl)throw new Error('Farben Tire ainda não carregou');
 const root=fbClone(FB.tpl),group=new THREE.Group(),holder=new THREE.Group();holder.add(root);group.add(holder);
 const em=new THREE.Color(0,0,0),mats=[],meshes=[],B={};
 root.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.emissive=em;mats.push(o.material);meshes.push(o);o.frustumCulled=false}});
 for(const k of FB.keys)B[k]=fbFind(root,k);
 if(!FB.keys.length)throw new Error('o modelo do Farben Tire não tem os ossos esperados (veja o console)');
 const dur={death:S==='b'?2.4:1.3,rec:.7};
 const inst={group,mat:{emissive:em},clip:'',t:0,w:1,once:false,done:false,fade:0,snap:null,last:null,coil:0,atk:0,alt:0,
  mesh:{set castShadow(v){for(const m of meshes)m.castShadow=v},set receiveShadow(v){for(const m of meshes)m.receiveShadow=v}},
  play(name,fade,once){
   if(name===this.clip&&!once)return;
   this.snap=this.last;this.clip=name;this.t=0;this.once=!!once;this.done=false;this.fade=fade||0;this.w=fade>0&&this.snap?0:1;
   if(name==='attack'&&once)this.alt^=1;
  },
  update(dt,speed){
   const c=this.clip;if(!c)return;speed=speed||1;
   if(c==='attack'){this.t=Math.min(1,this.t+dt*speed);if(this.t>=1)this.done=true}
   else if(c==='rec'||c==='death'){this.t=Math.min(dur[c],this.t+dt*(c==='rec'?speed:1));if(this.t>=dur[c]&&c==='rec')this.done=true}
   else if(c==='idle')this.t=(this.t+dt*speed/3.5)%1;
   else this.t=(this.t+dt*speed)%1;
   let p=c==='attack'?fbAtkPose(S,this.atk===4||this.atk===6?this.atk:0,this.alt,this.t):c==='rec'?fbRec(S,this.atk===6?6:4,this.alt,this.t,dur.rec):c==='death'?fbDeath(S,this.t/dur.death):c==='run'?fbRun(this.t,S):fbIdle(this.t,S);
   if(this.w<1&&this.snap){this.w=Math.min(1,this.w+dt/Math.max(.001,this.fade));p=fbBlend(this.snap,p,fbSm(this.w))}
   this.last=p;
   for(const k of FB.keys){
    const v=p.b[k]||_fbZ;_fbE.set(v[0],v[1],v[2],'XYZ');_fbQ.setFromEuler(_fbE);
    B[k].quaternion.copy(FB.rest[k]).multiply(FB.Ai[k].clone().multiply(_fbQ).multiply(FB.A[k]));
   }
   holder.position.y=p.dy;holder.rotation.x=p.pit;
  },
  dispose(){for(const m of mats)m.dispose()}
 };
 return inst;
}
const FBF_S={SCALE:.9,walkV0:2.16,clips:{attack:{dur:1,hit:.5}},create(){return fbCreate('s')}};
const FBF_B={SCALE:5.4,walkV0:10.2,clips:{attack:{dur:1,hit:.5},rec:{dur:.7}},create(){return fbCreate('b')}};
const SPC={
 scorpion:Object.assign({},AIC,SCP,{F:SCF,WALK_ANIM:SCP.WALK/4.6*1.2,LUNGE:.25,LUNGE_MIN:0,CLOSE:1.2,HB_Y:1.15,DEAD_Y:0,MSG:'Um escorpião te matou!',SPAWN_P:.7,
  DMG:5,ATK_CD:.8,CIRCLE_R:3,HITRUN_P:.25,FLEE_HP:.25,DODGE_P:.35,BR_P:.4}),   // escorpião: golpe rápido, esquiva bem, foge com pouca vida, entra na terra e pula no jogador (BR_*)
 snake:Object.assign({},AIC,{F:SNF,HP:80,ARMOR:0,BODY_R:.6,DMG:3,SPEED:5,WALK:1.1,SIGHT:16,FOV_COS:-.2,ATK_RANGE:2.2,ATK_CD:.6,ATK_SPEED:2.4,TURN_ATK:8,CHASE_ANIM:1.9,WALK_ANIM:1,LUNGE:.35,LUNGE_MIN:1.7,CLOSE:1.7,HB_Y:.75,DEAD_Y:.1,MSG:'Uma cobra te matou!',POISON_DUR:2,POISON_DPS:3,POISON_CD:4,SPAWN_P:.3,COIL_P:.4,COIL_CD:9,COIL_DPS:2,COIL_MISS:3,COIL_MSG:'Uma cobra te estrangulou!',
  CIRCLE_R:3.4,ZZ_AMP:.75,HITRUN_P:.7,FLEE_HP:.35}),   // cobra: zigue-zague largo, bate e recua, foge cedo
 /* Zumbi: floresta, SÓ À NOITE (spawn em updateScorpions). HAB = bioma onde vive; DEATH_CLIP = clipe de morte (em vez de tombar de lado); DEAD_HOLD = quanto tempo o corpo fica antes de sumir.
    Passo natural da animação = ZF.walkV0 m/s a 1×, então WALK_ANIM/CHASE_ANIM = velocidade ÷ walkV0 (pés quase sem deslizar). Sem veneno nem enrolar. */
 zombie:Object.assign({},AIC,{F:ZF,HAB:'forest',HP:140,ARMOR:0,BODY_R:.6,DMG:15,SPEED:2.8,WALK:.9,SIGHT:22,FOV_COS:-.35,ATK_RANGE:1.6,ATK_CD:1.3,ATK_SPEED:1.2,TURN_ATK:4,CHASE_ANIM:2.8/(ZF?ZF.walkV0:.66),WALK_ANIM:.9/(ZF?ZF.walkV0:.66),LUNGE:.3,LUNGE_MIN:.9,CLOSE:1.2,HB_Y:1.95,DEAD_Y:0,MSG:'Um zumbi te matou!',DEATH_CLIP:'death',DEAD_HOLD:6,SPAWN_P:0,MAX:5,
  TELE:.5,COMBO_P:.4,DODGE_P:.15,ARMOR_ACT:true,OBS_JUMP:true,   // aviso maior, combos, esquiva pouco, super-armor ao atacar, pula obstáculos
  LG_P:.5,LG_TELE:.4,LG_SPD:12,LG_DIST:6.5,LG_CD:[5,8],   // DASH/investida (só o zumbi)
  JP_P:.45,JP_TELE:.6,JP_MIN:4,JP_MAX:7,JP_T:.7,JP_CD:[6,9],   // PULO de ataque com marcador no chão (só o zumbi)
  ST_P:.4,ST_TELE:.7,ST_START:3.4,ST_R:5.5,ST_SPD:11,ST_REC:.7,ST_CD:[7,11],ST_DMG:.8,ST_SHAKE:.625})   // PISÃO com onda de choque (só o zumbi)
};
/* Farben Tire (só nas ondas de chefe, a cada 5): gigante (3× o jogador: soco por cima, PISÃO e BATE-CHÃO com onda de choque) + 4 capangas pequenos e rápidos (corrida, soco, combo, esquiva) */
SPC.farbenB=Object.assign({},AIC,{F:FBF_B,isFB:1,boss:1,NOSND:1,HAB:'forest',HP:3200,ARMOR:.1,BODY_R:3.8,DMG:30,SPEED:8,WALK:3.6,SIGHT:80,FOV_COS:-1,HEAR:40,ATK_RANGE:9.2,ATK_CD:1.6,ATK_SPEED:1.1,TURN_ATK:2.2,TURN:2,
 CHASE_ANIM:8/FBF_B.walkV0,WALK_ANIM:3.6/FBF_B.walkV0,LUNGE:.6,LUNGE_MIN:7,CLOSE:7.6,HB_Y:11.6,DEAD_Y:0,MSG:'O Farben Tire gigante te esmagou!',DEATH_CLIP:'death',DEAD_HOLD:7,SPAWN_P:0,PTS:50,
 TELE:.9,COMBO_P:.15,COMBO_TELE:.7,DODGE_P:0,HITRUN_P:0,FLEE_HP:0,ARMOR_ACT:true,STAGGER_MIN:99999,CIRCLE_R:12,WAIT_R:18,SEP_R:8,
 ST_P:.4,ST_TELE:1,ST_START:12,ST_R:26,ST_SPD:26,ST_REC:1,ST_CD:[6,9],ST_DMG:.7,ST_SHAKE:1.3,
 SL_P:.4,SL_TELE:1.1,SL_START:13,SL_R:8.4,SL_REACH:9.6,SL_REC:1.1,SL_CD:[6,10],SL_DMG:1.2,SL_SHAKE:1.2});
SPC.farbenS=Object.assign({},AIC,{F:FBF_S,isFB:1,NOSND:1,HAB:'forest',HP:90,ARMOR:0,BODY_R:.5,DMG:9,SPEED:5.2,WALK:1.6,SIGHT:80,FOV_COS:-1,HEAR:30,ATK_RANGE:1.7,ATK_CD:.6,ATK_SPEED:1.5,TURN_ATK:8,
 CHASE_ANIM:5.2/FBF_S.walkV0,WALK_ANIM:1.6/FBF_S.walkV0,LUNGE:.5,LUNGE_MIN:.9,CLOSE:1.1,HB_Y:2.2,DEAD_Y:0,MSG:'Um Farben Tire te nocauteou!',DEATH_CLIP:'death',DEAD_HOLD:3,SPAWN_P:0,PTS:3,
 TELE:.35,COMBO_P:.35,DODGE_P:.3,HITRUN_P:.3});
SPC.scorpion.HAB=SPC.snake.HAB='desert';
const forestAt=(x,z)=>(1-sstep(.18,.40,desertW(x,z)))*(1-sstep(.18,.40,cherryW(x,z)));   // mesmo peso de forestWt, para qualquer ponto
const scHab=(K,x,z)=>PLATE?1:K.HAB==='forest'?forestAt(x,z):desertW(x,z);
/* ---------- Cobra enrolada (habilidade) + Quick Time Event ----------
   O QTE usa uma barra horizontal, uma zona verde e uma linha vertical que varre a barra rapidamente de um lado ao outro. O jogador precisa acertar a zona verde 5–7 vezes; cada acerto avança o contador, enquanto erro/tempo esgotado causa dano e inicia outra tentativa. */
const COIL={on:false,s:null,dmgT:0,cd:0,SLOW:.55,WRAP:.55,UNWRAP:.38,DESERT_EXIT:.12,SHAKE:.012,debugForced:false};
const QTE={
 TIME:2.05,ZONE:.24,SWEEP_SECONDS:.36,GRACE:.22,FREEZE:.42,GOOD_FREEZE:.22,
 TARGET_MIN:5,TARGET_MAX:7,
 PROGRESSIVE:false,MISS_SHRINK:.10,MIN_ZONE:.12,TRAIL_POINTS:10,PULSE_SPEED:5.5,VIBRATE_MS:100,FLASH_MS:190,
 t:0,g0:0,g1:0,cur:0,hits:0,target:6,res:'',resT:0,wave:0,shown:false,zone:.24,trail:[],
 el:null,cv:null,cx:null,tx:null,sx:null
};
const COIL_AUDIO={ctx:null,master:null,noise:null};
function coilAudioInit(){
 try{if(COIL_AUDIO.ctx)return true;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
  const ac=COIL_AUDIO.ctx=new AC(),n=Math.max(1,Math.floor(ac.sampleRate*.8)),buf=ac.createBuffer(1,n,ac.sampleRate),d=buf.getChannelData(0);
  let b=0;for(let i=0;i<n;i++){const w=Math.random()*2-1;b=.82*b+.18*w;d[i]=w*.72+b*.28}
  COIL_AUDIO.noise=buf;COIL_AUDIO.master=ac.createGain();COIL_AUDIO.master.gain.value=0;COIL_AUDIO.master.connect(ac.destination);
  const vol=Math.pow(cl(S.mvol,0,100)/100,2)*.9;COIL_AUDIO.master.gain.setTargetAtTime(vol,ac.currentTime,.02);
  if(ac.state==='suspended')ac.resume().catch(()=>{});return true
 }catch(e){return false}
}
function coilAudioWake(){if(coilAudioInit()){const ac=COIL_AUDIO.ctx;if(ac&&ac.state==='suspended')ac.resume().catch(()=>{})}}
function coilTone(freq0,freq1,dur,wave,gain){
 const ac=COIL_AUDIO.ctx;if(!ac||!COIL_AUDIO.master)return;const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();
 o.type=wave||'triangle';o.frequency.setValueAtTime(Math.max(25,freq0),t);o.frequency.exponentialRampToValueAtTime(Math.max(25,freq1),t+dur);
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
 o.connect(g);g.connect(COIL_AUDIO.master);o.start(t);o.stop(t+dur+.02)
}
function coilNoise(dur,low,high,gain){
 const ac=COIL_AUDIO.ctx;if(!ac||!COIL_AUDIO.noise||!COIL_AUDIO.master)return;const t=ac.currentTime,src=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();
 src.buffer=COIL_AUDIO.noise;f.type='bandpass';f.frequency.setValueAtTime(high,t);f.frequency.exponentialRampToValueAtTime(Math.max(60,low),t+dur);f.Q.value=.72;
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+.018);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
 src.connect(f);f.connect(g);g.connect(COIL_AUDIO.master);src.start(t);src.stop(t+dur+.025)
}
function coilSound(kind){
 try{if(!coilAudioInit())return;const ac=COIL_AUDIO.ctx,t=ac.currentTime,vol=Math.pow(cl(S.mvol,0,100)/100,2)*.9;
  COIL_AUDIO.master.gain.setTargetAtTime(vol,t,.025);if(ac.state==='suspended')ac.resume().catch(()=>{});if(vol<.001)return;
  if(kind==='wrap'){coilNoise(.62,230,1450,.12);coilTone(460,210,.32,'sawtooth',.025)}
  else if(kind==='tick'){coilNoise(.12,85,620,.12);coilTone(105,48,.15,'triangle',.085);coilTone(210,125,.09,'square',.025)}
  else if(kind==='release'){coilTone(240,620,.19,'triangle',.075);coilTone(470,880,.22,'sine',.045)}
  else if(kind==='success'){coilTone(520,760,.095,'triangle',.055);coilTone(760,980,.075,'sine',.028)}
  else if(kind==='error'){coilTone(190,82,.22,'sawtooth',.085);setTimeout(()=>{try{coilTone(125,62,.16,'triangle',.045)}catch(e){}},65)}
 }catch(e){}
}
addEventListener('pointerdown',coilAudioWake,{once:true,passive:true});
addEventListener('touchstart',coilAudioWake,{once:true,passive:true});
function qteInit(){if(QTE.el)return true;QTE.el=$('#qte');QTE.cv=$('#qte-c');QTE.tx=$('#qte-t');QTE.sx=$('#qte-s');QTE.pp=$('#qte-pips');QTE.nn=$('#qte-n');if(!QTE.el||!QTE.cv)return false;QTE.cx=QTE.cv.getContext('2d');return true}
function qteVis(v){if(!qteInit()||QTE.shown===v)return;QTE.shown=v;QTE.el.classList.toggle('hidden',!v);if(!v)QTE.el.classList.remove('win','miss','good','in');else{QTE.el.classList.remove('in');void QTE.el.offsetWidth;QTE.el.classList.add('in');clearTimeout(QTE._it);QTE._it=setTimeout(()=>QTE.el&&QTE.el.classList.remove('in'),320)}}
/* indicadores de acerto (um por acerto necessário) + contador */
function qtePips(){
 if(!qteInit()||!QTE.pp)return;
 if(QTE.pp.children.length!==QTE.target){QTE.pp.textContent='';for(let i=0;i<QTE.target;i++){const p=document.createElement('i');QTE.pp.appendChild(p)}}
 for(let i=0;i<QTE.target;i++)QTE.pp.children[i].classList.toggle('on',i<QTE.hits);
 if(QTE.nn)QTE.nn.textContent=QTE.hits+'/'+QTE.target;
}
function qteFlash(c,ms){if(!qteInit())return;QTE.el.classList.remove('good','miss');void QTE.el.offsetWidth;QTE.el.classList.add(c);clearTimeout(QTE._ft);QTE._ft=setTimeout(()=>QTE.el&&QTE.el.classList.remove(c),ms)}
function qteResetDifficulty(){QTE.zone=QTE.ZONE;QTE.trail.length=0}
function qteProgressText(prefix){qtePips();if(QTE.sx)QTE.sx.textContent=(prefix?prefix+' · ':'')+'Clique, toque ou pressione Espaço na zona verde'}
function qteNew(){QTE.t=0;QTE.res='';QTE.resT=0;QTE.trail.length=0;const half=QTE.zone/2,c=.15+Math.random()*.70;QTE.g0=c-half;QTE.g1=c+half;QTE.cur=0;qteProgressText()}
function qteReady(){return COIL.on&&COIL.s&&COIL.s.ck>=.85&&QTE.res===''&&QTE.t>=QTE.GRACE}
function coilFlash(impact=false){const e=$('#coil-flash');if(!e)return;e.classList.remove('flash','impact');void e.offsetWidth;e.classList.add('flash');if(impact)e.classList.add('impact')}
function qteDamageFeedback(amount){const e=$('#qte-damage');if(!e)return;e.textContent='ERROU!  −'+amount+' HP';e.classList.remove('show');void e.offsetWidth;e.classList.add('show')}
function coilHudUpdate(){
 const e=$('#coil-ic');if(!e)return;
 if(!COIL.on){e.classList.remove('show','on');return}
 e.classList.add('show','on');const waiting=QTE.res==='wait',left=waiting?QTE.TIME:Math.max(0,QTE.TIME-QTE.t),frac=waiting?1:Math.min(1,left/QTE.TIME);
 const ring=$('#coil-ring'),txt=$('#coil-t'),label=$('#coil-label');if(ring)ring.setAttribute('stroke-dashoffset',(100.53*(1-frac)).toFixed(2));
 if(label)label.textContent=waiting?'Enrolado':QTE.res==='miss'?'Errou':'Enrolado';if(txt)txt.textContent=waiting?'QTE':Math.ceil(left)+'s';
}
function qteMiss(why){
 if(QTE.res==='miss'||!COIL.on)return;QTE.res='miss';QTE.resT=QTE.FREEZE;
 const damage=COIL.s?COIL.s.k.COIL_MISS:3;
 if(QTE.sx)QTE.sx.textContent=why||'Errou!  −'+damage+' HP';QTE.bu=QTE.cur;qteFlash('miss',450);
 if(QTE.PROGRESSIVE)QTE.zone=Math.max(QTE.MIN_ZONE,QTE.zone*(1-QTE.MISS_SHRINK));
 coilSound('error');if(touch&&QTE.VIBRATE_MS>0&&navigator.vibrate){try{navigator.vibrate(QTE.VIBRATE_MS)}catch(e){}}
 qteDamageFeedback(damage);hurt(damage,false,COIL.s?COIL.s.k.COIL_MSG:'Uma cobra te estrangulou!',true)
}
function qteClick(){   // consome o clique/toque enquanto enrolado; evita soco/mineração acidental
 if(!COIL.on)return false;
 if(QTE.res!==''||!COIL.s||COIL.s.ck<.85||QTE.t<QTE.GRACE)return true;
 if(QTE.cur>=QTE.g0&&QTE.cur<=QTE.g1){
  QTE.hits++;
  if(QTE.hits>=QTE.target){QTE.bu=QTE.cur;qtePips();if(qteInit())QTE.el.classList.add('win');QTE.res='hit';QTE.resT=QTE.FREEZE;if(QTE.sx)QTE.sx.textContent='Você se soltou!';coilSound('release');coilRelease(COIL.s,true)}
  else{QTE.bu=QTE.cur;qtePips();qteFlash('good',260);QTE.res='good';QTE.resT=QTE.GOOD_FREEZE;if(QTE.sx)QTE.sx.textContent='Acerto! Continue...';coilSound('success');if(touch&&navigator.vibrate){try{navigator.vibrate(22)}catch(e){}}}
 }else qteMiss('Errou!  −'+(COIL.s.k.COIL_MISS||3)+' HP');
 return true
}
function qRR(x,a,b,w,h,r){x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath()}
function qteDraw(){
 const x=QTE.cx,W=320,H=92,dpr=Math.min(2,window.devicePixelRatio||1);if(QTE.cv.width!==W*dpr){QTE.cv.width=W*dpr;QTE.cv.height=H*dpr}
 x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);
 const L=14,R=W-14,Y=36,TH=30,T0=Y-TH/2,xAt=u=>L+u*(R-L),shake=QTE.res==='miss'?Math.sin(QTE.resT*90)*4*(QTE.resT/QTE.FREEZE):0;
 const near=QTE.cur>=QTE.g0&&QTE.cur<=QTE.g1,pulse=.72+.28*(.5+.5*Math.sin(QTE.wave*QTE.PULSE_SPEED)),won=QTE.res==='hit';
 x.save();x.translate(shake,0);x.lineCap='round';x.lineJoin='round';
 /* trilho com textura de escamas */
 let g=x.createLinearGradient(0,T0,0,T0+TH);g.addColorStop(0,'#0c1116');g.addColorStop(.5,'#1a232b');g.addColorStop(1,'#0c1116');
 qRR(x,L-4,T0-3,R-L+8,TH+6,13);x.fillStyle='#04070a';x.fill();
 qRR(x,L,T0,R-L,TH,10);x.fillStyle=g;x.fill();
 x.save();qRR(x,L,T0,R-L,TH,10);x.clip();x.strokeStyle='rgba(120,255,170,.06)';x.lineWidth=1;
 for(let i=L-TH;i<R;i+=9){x.beginPath();x.moveTo(i,T0+TH);x.lineTo(i+TH,T0);x.stroke()}x.restore();
 qRR(x,L,T0,R-L,TH,10);x.strokeStyle='rgba(255,255,255,.12)';x.lineWidth=1;x.stroke();
 /* zona verde (brilha mais quando a linha está dentro) */
 const zx0=xAt(QTE.g0),zx1=xAt(QTE.g1),zc=(zx0+zx1)/2;
 x.save();x.shadowColor='#3dff7a';x.shadowBlur=near?24:11;
 g=x.createLinearGradient(0,T0,0,T0+TH);g.addColorStop(0,won?'#d4ffe0':'rgba(110,255,160,'+(.55+.4*pulse)+')');g.addColorStop(1,won?'#9affb8':'rgba(25,200,85,'+(.7+.3*pulse)+')');
 qRR(x,zx0,T0+2,zx1-zx0,TH-4,8);x.fillStyle=g;x.fill();x.restore();
 x.strokeStyle='rgba(235,255,240,.95)';x.lineWidth=1.6;x.beginPath();x.moveTo(zx0,T0+2);x.lineTo(zx0,T0+TH-2);x.moveTo(zx1,T0+2);x.lineTo(zx1,T0+TH-2);x.stroke();
 x.strokeStyle='rgba(4,40,18,.55)';x.lineWidth=1.5;x.setLineDash([2,3]);x.beginPath();x.moveTo(zc,T0+5);x.lineTo(zc,T0+TH-5);x.stroke();x.setLineDash([]);
 /* rastro da linha */
 if(QTE.trail.length>1){for(let i=1;i<QTE.trail.length;i++){const a=QTE.trail[i-1],b=QTE.trail[i],al=i/QTE.trail.length;
  x.beginPath();x.moveTo(xAt(a.u),Y);x.lineTo(xAt(b.u),Y);x.strokeStyle='rgba(200,240,255,'+(al*.5)+')';x.lineWidth=TH*.55*al;x.stroke()}}
 /* marcador: cápsula brilhante com setas */
 const mx=xAt(QTE.cur),mc=QTE.res==='miss'?'#ff655d':near?'#b6ffc4':'#f3fbff';
 x.save();x.shadowColor=near?'#5dff8d':'#bfe6ff';x.shadowBlur=near?22:10;
 qRR(x,mx-2.6,T0-5,5.2,TH+10,2.6);x.fillStyle=mc;x.fill();x.restore();
 x.fillStyle=mc;x.beginPath();x.moveTo(mx-6,T0-9);x.lineTo(mx+6,T0-9);x.lineTo(mx,T0-2);x.closePath();x.fill();
 x.beginPath();x.moveTo(mx-6,T0+TH+9);x.lineTo(mx+6,T0+TH+9);x.lineTo(mx,T0+TH+2);x.closePath();x.fill();
 /* explosão de acerto / X de erro */
 if((QTE.res==='good'||won)&&QTE.bu!=null){const dur=won?QTE.FREEZE:QTE.GOOD_FREEZE,p=Math.min(1,Math.max(0,1-QTE.resT/dur)),bx=xAt(QTE.bu);
  x.strokeStyle='rgba(160,255,190,'+(1-p)+')';x.lineWidth=1+3*(1-p);x.beginPath();x.arc(bx,Y,5+p*(won?34:24),0,Math.PI*2);x.stroke();
  for(let i=0;i<8;i++){const a=i*.785+.2,r0=6+p*10,r1=10+p*(won?30:22);x.beginPath();x.moveTo(bx+Math.cos(a)*r0,Y+Math.sin(a)*r0);x.lineTo(bx+Math.cos(a)*r1,Y+Math.sin(a)*r1);x.stroke()}}
 if(QTE.res==='miss'){const k=Math.max(0,QTE.resT/QTE.FREEZE);qRR(x,L,T0,R-L,TH,10);x.fillStyle='rgba(255,40,40,'+(.32*k)+')';x.fill();
  x.strokeStyle='rgba(255,110,100,'+k+')';x.lineWidth=3;x.beginPath();x.moveTo(mx-8,Y-8);x.lineTo(mx+8,Y+8);x.moveTo(mx+8,Y-8);x.lineTo(mx-8,Y+8);x.stroke()}
 /* tempo da tentativa */
 const fr=Math.max(0,1-QTE.t/QTE.TIME),TY=H-17;
 qRR(x,L,TY,R-L,8,4);x.fillStyle='#04070a';x.fill();
 if(fr>0){g=x.createLinearGradient(L,0,R,0);const c=fr>.5?['#ffe066','#ffb02e']:fr>.25?['#ffb02e','#ff7a2a']:['#ff6a3a','#ff3a3a'];g.addColorStop(0,c[0]);g.addColorStop(1,c[1]);qRR(x,L+1,TY+1,Math.max(6,(R-L-2)*fr),6,3);x.fillStyle=g;x.fill()}
 qRR(x,L,TY,R-L,8,4);x.strokeStyle='rgba(255,255,255,.12)';x.lineWidth=1;x.stroke();
 x.restore();
}
function coilStart(s){
 COIL.on=true;COIL.s=s;COIL.dmgT=0;s.st='coil';s.ck=0;s.kx=s.kz=0;s.inst.coil=0;s.inst.play('idle',.1);breaking=false;mining=false;punchT=0;jumpHeld=false;keys.Space=false;sprintTog=false;qteResetDifficulty();QTE.hits=0;QTE.target=QTE.TARGET_MIN+Math.floor(Math.random()*(QTE.TARGET_MAX-QTE.TARGET_MIN+1));qteNew();QTE.res='wait';coilAudioWake();coilSound('wrap');coilHudUpdate();
 if(QTE.tx)QTE.tx.textContent='SOLTE-SE!';if(QTE.sx)QTE.sx.textContent='Prepare-se... você precisa de '+QTE.target+' acertos verdes'
}
function coilRelease(s,fling,reason){
 if(!COIL.on)return;COIL.on=false;COIL.dmgT=0;COIL.cd=s?s.k.COIL_CD:9;COIL.s=null;COIL.debugForced=false;
 if(s&&s.st==='coil'){s.st='chase';s.cd=2.5;s.sees=true;s.lost=0;s.inst.play('run',.15);
  const a=P.yaw+(Math.random()<.5?1:-1)*(1.2+Math.random()*.8),dx=Math.sin(a),dz=Math.cos(a);s.x=P.p.x+dx*.5;s.z=P.p.z+dz*.5;s.y=P.p.y;
  if(fling){s.kx=dx*15;s.kz=dz*15}}
 if(reason==='retreat'){if(QTE.sx)QTE.sx.textContent='A cobra recuou para o deserto'}
 if(QTE.res==='hit')QTE.res='hit';else QTE.res='';QTE.zone=QTE.ZONE;QTE.trail.length=0;coilHudUpdate()
}
function coilEnd(){
 const s=COIL.s;if(COIL.on&&s)coilRelease(s,false,'abort');else{COIL.on=false;COIL.s=null;COIL.dmgT=0}
 QTE.res='';QTE.resT=0;qteResetDifficulty();qteVis(false);coilHudUpdate()
}
function coilReset(){
 COIL.on=false;COIL.s=null;COIL.dmgT=0;COIL.cd=0;COIL.debugForced=false;QTE.res='';QTE.resT=0;QTE.t=0;qteResetDifficulty();qteVis(false);coilHudUpdate();
 const f=$('#coil-flash');if(f)f.classList.remove('flash')
}
function coilUpdate(s,dt){   // estado 'coil' da cobra: acompanha o jogador, dano por segundo
 if(!COIL.debugForced&&!PLATE&&desertW(P.p.x,P.p.z)<COIL.DESERT_EXIT){coilRelease(s,false,'retreat');QTE.res='';QTE.resT=0;qteVis(false);return}
 const K=s.k,g=s.inst.group,f=Math.min(1,dt*10);
 s.x+=(P.p.x-s.x)*f;s.z+=(P.p.z-s.z)*f;s.y+=(P.p.y-s.y)*f;
 let d=P.yaw-s.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));s.yaw+=d*Math.min(1,dt*6);
 s.ck=Math.min(1,s.ck+dt/COIL.WRAP);s.inst.coil=s.ck;s.inst.update(dt,1);
 g.rotation.set(0,s.yaw,0);g.position.set(s.x,s.y,s.z);s.hb.visible=false;s.inst.mesh.castShadow=true;
 if(s.inst.mat.emissive.r)s.inst.mat.emissive.setRGB(0,0,0);
 COIL.dmgT+=dt;while(COIL.dmgT>=1&&s.st==='coil'){COIL.dmgT-=1;coilSound('tick');hurt(K.COIL_DPS,true,K.COIL_MSG)}   // 1º tick 1 s depois de se enrolar
 coilHudUpdate()
}
function updateQte(dt){
 if(!COIL.on){if(QTE.res==='hit'&&QTE.resT>0){QTE.resT-=dt;QTE.wave+=dt*5;qteDraw();if(QTE.resT<=0){QTE.res='';qteVis(false)}}else if(QTE.shown&&QTE.res==='')qteVis(false);coilHudUpdate();return}
 const s=COIL.s;if(!s)return;coilHudUpdate();breaking=false;punchT=0;mining=false;
 if(QTE.res==='wait'){if(s.ck>=.85){QTE.res='';QTE.t=0;QTE.cur=0;QTE.trail.length=0;if(QTE.tx)QTE.tx.textContent='SOLTE-SE!';qteProgressText('');}else return}
 qteVis(true);QTE.wave+=dt*5;
 if(QTE.res==='miss'||QTE.res==='good'){
  QTE.resT-=dt;
  if(QTE.resT<=0)qteNew();
 }else if(QTE.res===''){
  QTE.t+=dt;
  /* Varrimento linear com inversão nas pontas: uma passagem completa é rápida e previsível. */
  const sweep=(QTE.t/QTE.SWEEP_SECONDS)%2;QTE.cur=sweep<=1?sweep:2-sweep;
  QTE.trail.push({u:QTE.cur});if(QTE.trail.length>QTE.TRAIL_POINTS)QTE.trail.shift();
  if(QTE.t>=QTE.TIME)qteMiss('Tempo esgotado!  −'+(s.k.COIL_MISS||3)+' HP');
 }
 if(QTE.res===''&&QTE.tx&&QTE.tx.textContent!=='SOLTE-SE!')QTE.tx.textContent='SOLTE-SE!';
 qteDraw();coilHudUpdate()
}
function scBlocked(s,x,z){if(s.air)return (CAMB&&cambHit(x,s.y,z))||propHits(x,s.y-.35,z);   // no ar: só props bloqueiam (sobrevoa água e degraus); na Camera Base, também as paredes do mapa
 const gy=groundH(x,z);if(CAMB&&(gy<CAMB_VOID+1||cambHit(x,s.y,z)))return true;   // Camera Base: não atravessa parede nem anda pro vazio
 if(waterSurf(x,z)-gy>.15)return true;if(gy-s.y>1.1)return true;return propHits(x,gy-1.2,z)}
function scMove(s,dx,dz){let m=false;if(!scBlocked(s,s.x+dx,s.z)){s.x+=dx;m=true}if(!scBlocked(s,s.x,s.z+dz)){s.z+=dz;m=true}return m}   // devolve se andou
function scLOS(s,tx,ty,tz){const ex=s.x,ey=s.y+.5,ez=s.z;if(CAMB){for(let i=1;i<=6;i++){const k=i/7;if(cambHit(ex+(tx-ex)*k,ey+(ty-ey)*k-.9,ez+(tz-ez)*k))return false}return true}   // Camera Base: paredes bloqueiam a visão
 for(let i=1;i<=6;i++){const k=i/7;if(groundH(ex+(tx-ex)*k,ez+(tz-ez)*k)>ey+(ty-ey)*k+.15)return false}return true}
function scRemove(s){s.rm=1;if(LK.s===s)lockClear();if(COIL.on&&COIL.s===s)coilEnd();scene.remove(s.inst.group);scene.remove(s.hb);s.inst.dispose();s.bgM.dispose();s.fillM.dispose();if(s.mk){scene.remove(s.mk);s.mk.material.dispose()}if(s.mound)scene.remove(s.mound);const i=scs.indexOf(s);if(i>=0)scs.splice(i,1)}
function scReset(){fightT=0;if(fightOn){fightOn=false;if(OWM.musicFight)OWM.musicFight(false)}while(scs.length)scRemove(scs[0]);scSpawnT=2;zSpawnT=3;pDmgT=0;punchT=0;coilReset()}
function scSpawn(x,z,kind){
 const K=SPC[kind||'scorpion'];if(!K||!K.F)return;const inst=K.F.create(),g=inst.group;g.scale.setScalar(K.F.SCALE);g.rotation.order='YXZ';inst.mesh.castShadow=inst.mesh.receiveShadow=true;scene.add(g);inst.play('idle',0);
 const hb=new THREE.Group(),bgM=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.7,depthTest:false}),fillM=new THREE.MeshBasicMaterial({color:0xe04a3a,depthTest:false}),bg=new THREE.Mesh(scBarGeo,bgM),fill=new THREE.Mesh(scBarGeo,fillM);
 bg.scale.set(1.05,.17,1);fill.scale.set(1,.11,1);fill.position.z=.001;bg.renderOrder=998;fill.renderOrder=999;hb.add(bg,fill);hb.visible=false;scene.add(hb);
 const s={zid:++ZID,inst,k:K,hb,bgM,fillM,fill,x,z,y:groundH(x,z),yaw:Math.random()*6.2832,hp:K.HP,st:'idle',t:1+Math.random()*3,tx:0,tz:0,cd:0,flash:0,kx:0,kz:0,dead:0,sees:false,seeT:Math.random()*.2,lost:0,aT:Math.random()*.03,ck:0,
  snT:2+Math.random()*3,pnT:0,mhp:K.HP,fr:false,dm:1,tg:null,tgT:0,tgL:0,rm:0,fol:0,mode:'circle',mt:0,dir:Math.random()<.5?1:-1,ph:'',at:0,plan:0,step:0,cn:1,lk:0,hit:0,pt:0,tl:0,asp:1,tel:0,wt:0,tok:false,ct:0,lx:x,lz:z,lookT:0,stg:0,imm:0,dgT:1+Math.random()*2,dg:0,dgx:0,dgz:0,rage:0,flee:0,fled:0,
  air:0,vy:0,jx:0,jz:0,airT:0,ax:0,az:0,dirx:0,dirz:1,dd:0,lgCd:1+Math.random()*2,jpCd:1.5+Math.random()*3,stCd:2+Math.random()*3,slCd:2+Math.random()*3,brCd:3+Math.random()*4,bn:0,bt:0,sk:0,bur:0,blk:0,hopCd:0,zp:Math.random()*6.2832,zt:0,sq:1,sqd:0,mk:null};
 scs.push(s);return s;
}
function debugForceCoil(){
 if(state!=='play'){toast('Inicie um mundo antes de usar OWM.debugCoil()');return false}
 if(COIL.on){toast('A cobra já está enrolada');return false}
 let s=scs.filter(q=>q.k===SPC.snake&&q.st!=='dead').sort((a,b)=>Math.hypot(a.x-P.p.x,a.z-P.p.z)-Math.hypot(b.x-P.p.x,b.z-P.p.z))[0];
 if(!s){const a=P.yaw,x=P.p.x+Math.sin(a)*1.35,z=P.p.z-Math.cos(a)*1.35;s=scSpawn(x,z,'snake')}
 if(!s){toast('Não foi possível criar a cobra de teste');return false}
 COIL.cd=0;COIL.debugForced=desertW(P.p.x,P.p.z)<COIL.DESERT_EXIT;s.cd=0;s.sees=true;s.lost=0;coilStart(s);toast('Debug: cobra enrolada — V alterna a câmera');return true
}
OWM.SPC=SPC;OWM.AI=AIC;OWM.debugCoil=debugForceCoil;OWM.spawnMob=(kind='zombie')=>{const a=P.yaw;return scSpawn(P.p.x-Math.sin(a)*4,P.p.z-Math.cos(a)*4,kind)};   // depuração (console): OWM.spawnMob('zombie') nasce 4 m à frente, a qualquer hora
OWM.mobStatus=()=>({scorpionReady:!!SCF,snakeReady:!!SNF,zombieReady:!!ZF,active:scs.filter(s=>s.st!=='dead').length,desertWeight:desertW(P.p.x,P.p.z)});OWM.debugScorpion=()=>{if(state!=='play'){toast('Inicie um mundo antes do teste.');return false}if(!SCF){toast('Pack do escorpião não foi carregado. Verifique o console.');return false}const a=P.yaw,x=P.p.x+Math.sin(a)*3,z=P.p.z-Math.cos(a)*3;let s;try{s=scSpawn(x,z,'scorpion')}catch(e){console.error('[OWM] Falha no spawn manual do escorpião:',e)}if(!s){toast('Não foi possível criar o escorpião (ver console).');return false}toast('Escorpião de teste criado.');return true};

/* ---------- TEST PLATE: botão "Spawn" (no lugar das barras de fome e sede) + menu para criar criaturas ---------- */
function plateHud(){lobbyUI(LOBBY);const b=$('#bSpawn'),sb=$('#survival-bars');if(sb)sb.classList.toggle('hidden',PLATE);if(b){b.classList.toggle('hidden',!PLATE||LOBBY);if(b.dataset.orig===undefined)b.dataset.orig=b.innerHTML;b.innerHTML=CAMB?'Modo':b.dataset.orig}}
const SPM=mkScreen('spawnmenu','Painel de spawn','dim');let spawnOpen=false;
/* Painel de testes (Test plate): criar inimigos, opções do PRÓXIMO inimigo a nascer (amigável, vida, dano) e dar itens.
   SPO só vale para quem nascer DEPOIS da opção ser mexida; quem já está no mundo não muda.
   LAYOUT: o painel nunca rola. fitSpawnMenu() mede a tela (visualViewport) e (1) escolhe 1 ou 2 colunas, (2) ajusta a altura dos botões/fonte
   e (3) se ainda assim passar da tela, reduz a escala do painel inteiro até caber. Refaz o ajuste ao girar/redimensionar a tela. */
const SPO={fr:false,hp:1,dm:1,qty:1},SPO_STEPS=[.25,.5,1,2,3,5,10,20],SPO_QTY=[1,5,16,32,64];
{const st=document.createElement('style');st.textContent=[
/* tela do painel: nunca deixa nada vazar; o ajuste em fitSpawnMenu() diminui --u até caber (rolagem só como último recurso) */
'.screen[data-scr=spawnmenu]{justify-content:safe center;gap:6px;overflow-x:hidden;overflow-y:hidden;padding-left:max(10px,env(safe-area-inset-left,0px));padding-right:max(10px,env(safe-area-inset-right,0px))}',
'.screen[data-scr=spawnmenu]>h2{margin:0;line-height:1.1;flex:0 0 auto}',
'.spp{--u:34px;--fs:13px;--mc:4;--ic:3;box-sizing:border-box;display:flex;flex-direction:column;gap:calc(var(--u)*.22);width:min(900px,96vw);flex:0 0 auto;margin:0 auto;padding:0;text-align:left;font-size:var(--fs);line-height:1.2}',
'.spp *{box-sizing:border-box;min-width:0}',
'.spp .cols{display:flex;flex-direction:column;gap:calc(var(--u)*.22);width:100%}',
'.spp.wide .cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:16px;align-items:start}',
'.spp .col,.spp .sec{display:flex;flex-direction:column;gap:calc(var(--u)*.18);width:100%;min-width:0}',
'.spp .col{gap:calc(var(--u)*.22)}',
'.spp .hd{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:calc(var(--u)*.8)}',
'.spp h3{margin:0;font-size:calc(var(--fs)*.95);letter-spacing:.08em;text-transform:uppercase;opacity:.85;min-width:0}',
'.spp .dsc,.spp .cnt{font-size:calc(var(--fs)*.85);opacity:.75;line-height:1.15;margin:0}',
'.spp .cnt{flex:0 0 auto;white-space:nowrap}',
/* TODO botão do painel: largura 100% da célula, altura fixa pela escala --u (nada de altura/largura herdadas do .btn global) */
'.spp .btn{position:relative;width:100%;max-width:none;height:var(--u);min-height:0;margin:0;padding:0 6px;font-size:var(--fs);line-height:1.05;display:flex;align-items:center;justify-content:center;text-align:center;white-space:normal;overflow-wrap:anywhere;transform:none}',
'.spp .btn:hover:not(:disabled),.spp .btn:focus-visible{transform:none}',
'.spp .btn:active:not(:disabled){transform:translateY(2px)}',
'.spp .btn.on{border-color:#5dff8d;color:#5dff8d}',
'.spp .btn.sm{flex:0 0 calc(var(--u)*1.2);width:calc(var(--u)*1.2);padding:0}',
'.spp .btn.qty{flex:0 0 auto;width:auto;padding:0 12px;white-space:nowrap}',
'.spp .mobs{display:grid;grid-template-columns:repeat(var(--mc),minmax(0,1fr));gap:6px;width:100%}',
'.spp .mobs .btn{height:calc(var(--u)*1.15);padding:0 3px}',
'.spp .opts{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:calc(var(--u)*.2) 10px;width:100%}',
'.spp .opts .full{grid-column:1/-1}',
'.spp .stp{display:flex;flex-direction:column;gap:3px;min-width:0}',
'.spp .lab{font-size:calc(var(--fs)*.88);opacity:.85}',
'.spp .ctl{display:flex;gap:5px;align-items:center;width:100%}',
'.spp .ctl .val{flex:1 1 auto;text-align:center;font-weight:700}',
'.spp .items{display:grid;grid-template-columns:repeat(var(--ic),minmax(0,1fr));gap:6px;width:100%}',
'.spp .items .btn{height:calc(var(--u)*1.3);font-size:calc(var(--fs)*.92);padding:0 4px;line-height:1.05}',
'.spp .btn.close{width:100%;height:calc(var(--u)*1.2);margin-top:calc(var(--u)*.1);flex:0 0 auto}'
].join('');document.head.appendChild(st)}
const spp=E('div','spp',null,SPM),spCols=E('div','cols',null,spp),spL=E('div','col',null,spCols),spR=E('div','col',null,spCols);
/* ---- seção 1: criar inimigo ---- */
const secA=E('div','sec',null,spL),hdA=E('div','hd',null,secA);
E('h3','','Criar inimigo',hdA);
const spCount=E('span','cnt','',hdA);
function refreshSpawnCount(){spCount.textContent='Ativas: '+(scs.filter(s=>s.st!=='dead').length+STR.list.filter(t=>t.hp>0).length+ATNK.list.filter(t=>t.plate).length)}
E('div','dsc','Cada toque cria uma criatura à sua frente. No Test plate elas não nascem sozinhas.',secA);
function plateSpawnLoad(kind,label,rmin){   // Farben Tire: o modelo carrega na hora do primeiro spawn
 toast('Carregando '+label+'…');
 fbLoad().then(()=>plateSpawn(kind,label,rmin)).catch(e=>{console.error('[OWM] Farben Tire:',e);toast('Não consegui carregar o Farben Tire. '+(e&&e.message||''))});
}
function plateSpawnStrider(){   // Strider (modelo carrega na hora): nasce à frente do jogador, hostil
 toast('Carregando Strider…');
 strLoad().then(()=>{
  const a=P.yaw+(Math.random()-.5)*.9,r=20+Math.random()*6,x=P.p.x-Math.sin(a)*r,z=P.p.z-Math.cos(a)*r,y=cambGround(x,z,P.p.y),t=strMake(x,y,z,Math.max(1,Math.round(150*SPO.hp)));
  STR.list.push(t);rbxHit({x,y:y+.4,z},STR_PAL,{n:14,sp:8,size:.5,flash:2.6,ring:6,fin:true});toast('Strider criado.');refreshSpawnCount();
 }).catch(e=>{console.error('[OWM] Strider:',e);toast('Não consegui carregar o Strider. '+(e&&e.message||''))});
}
function plateSpawn(kind,label,rmin){
 if(!(SPC[kind]&&SPC[kind].F)){toast(label+' indisponível: o modelo não carregou.');return}
 const a=P.yaw+(Math.random()-.5)*.9,r=(rmin||4.5)+Math.random()*2.5;   // à frente do jogador (frente = -sin/-cos do yaw), com um pouco de espalhamento
 const s=scSpawn(P.p.x-Math.sin(a)*r,P.p.z-Math.cos(a)*r,kind);
 if(s){   // aplica as opções ligadas no painel
  s.mhp=s.hp=Math.max(1,Math.round(s.k.HP*SPO.hp));s.dm=SPO.dm;s.fr=SPO.fr;
  if(s.fr){s.fillM.color.setHex(0x4acb5a);s.hb.visible=true}
  if(s.k.boss)s.hb.scale.setScalar(9)}
 toast(s?label+(s.fr?' amigável':'')+' criado.':'Não foi possível criar aqui.');refreshSpawnCount();
}
{const r=E('div','mobs',null,secA);B('Escorpião',()=>plateSpawn('scorpion','Escorpião'),r);B('Cobra',()=>plateSpawn('snake','Cobra'),r);B('Zumbi',()=>plateSpawn('zombie','Zumbi'),r);B('Farben Tire gigante',()=>plateSpawnLoad('farbenB','Farben Tire gigante',32),r);B('Farben Tire pequeno',()=>plateSpawnLoad('farbenS','Farben Tire pequeno'),r);B('Strider',plateSpawnStrider,r);B('Tanque laser',plateSpawnTank,r);B('Remover todos',()=>{while(scs.length)scRemove(scs[0]);for(const t of STR.list)strDispose(t);STR.list.length=0;tkClearPlate();toast('Criaturas removidas.');refreshSpawnCount()},r)}
/* ---- seção 2: opções do próximo inimigo ---- */
const secB=E('div','sec',null,spL);
E('h3','','Opções do próximo inimigo',secB);
E('div','dsc','Só afetam quem nascer depois. Amigável: ataca os hostis e os hostis atacam ele.',secB);
const opts=E('div','opts',null,secB);
{const b=B('',()=>{SPO.fr=!SPO.fr;sync()},opts,'full');const sync=()=>{b.textContent=SPO.fr?'IA amigável: LIGADO':'IA amigável: desligado';b.classList.toggle('on',SPO.fr)};sync()}
function stepRow(label,key){const c=E('div','stp',null,opts);E('span','lab',label,c);const r=E('div','ctl',null,c);const mv=d=>{let i=SPO_STEPS.indexOf(SPO[key]);i=Math.max(0,Math.min(SPO_STEPS.length-1,i+d));SPO[key]=SPO_STEPS[i];sync()};B('−',()=>mv(-1),r,'sm');const v=E('span','val','',r);B('+',()=>mv(1),r,'sm');const sync=()=>{v.textContent='×'+SPO[key]};sync()}
stepRow('Vida (× o normal)','hp');stepRow('Dano (× o normal)','dm');
/* ---- seção 3: dar item (coluna da direita no layout largo) ---- */
const secC=E('div','sec',null,spR),hdC=E('div','hd',null,secC);
E('h3','','Dar item ao jogador',hdC);
/* (sem botão de quantidade: as facas empilham de 1 em 1) */
const spItems=E('div','items',null,secC);
/* itens do painel de spawn: SÓ as facas (sem recursos nem peças de fabricação) */
const SPAWN_ITEMS=['knife','knife_intermediate','stone_knife'];
function buildSpawnItems(){   // montado ao abrir o painel (pega itens/armas adicionados depois)
 spItems.textContent='';
 for(const t of SPAWN_ITEMS){if(!ITEMS[t])continue;const b=B(ITEMS[t].n,()=>{
  const n=Math.max(1,Math.min(SPO.qty,maxStack(t)||SPO.qty));
  if(invAdd(t,n))toast('+'+n+' '+ITEMS[t].n);else toast('Inventário sem espaço para '+ITEMS[t].n);
  try{invRender()}catch(e){}},spItems);b.title=ITEMS[t].n}}
B('Fechar',()=>closeSpawnMenu(),spp,'close');
/* ---- ajuste automático à tela: sem rolagem em nenhum eixo ---- */
function fitSpawnMenu(){
 if(!spawnOpen)return;
 const vv=window.visualViewport,vw=Math.floor((vv&&vv.width)||innerWidth),vh=Math.floor((vv&&vv.height)||innerHeight);
 const cs=getComputedStyle(SPM),num=v=>parseFloat(v)||0;
 const padH=num(cs.paddingLeft)+num(cs.paddingRight);
 spp.style.transform='';spp.style.marginBottom='';   // (versões antigas usavam scale: agora não)
 const maxW=Math.max(220,Math.min(900,vw-padH)),wide=maxW>=520&&vw>vh*1.1;   // 2 colunas em tela larga (paisagem/tablet/PC)
 spp.classList.toggle('wide',wide);spp.style.width=Math.floor(wide?maxW:Math.min(560,maxW))+'px';
 const colW=wide?(maxW-16)/2:Math.min(560,maxW);   // largura útil de uma coluna
 spp.style.setProperty('--mc',colW>=330?4:2);       // botões de criar inimigo: 4 em linha ou 2×2
 spp.style.setProperty('--ic',(wide||colW>=400)?3:2);   // itens: 3 ou 2 colunas
 const ttl=SPM.querySelector('h2');
 let u=Math.max(24,Math.min(42,vh*.075));
 const apply=()=>{spp.style.setProperty('--u',u+'px');spp.style.setProperty('--fs',Math.max(10,Math.min(15,u*.4))+'px');if(ttl)ttl.style.fontSize=Math.max(14,Math.min(24,u*.62))+'px'};
 SPM.style.overflowY='hidden';
 for(let i=0;i<20;i++){apply();if(SPM.scrollHeight<=SPM.clientHeight+1||u<=18)break;u-=1.5}   // diminui os botões até tudo caber na tela
 if(SPM.scrollHeight>SPM.clientHeight+1)SPM.style.overflowY='auto';   // último recurso (tela minúscula): rola em vez de sobrepor
}
addEventListener('resize',fitSpawnMenu);addEventListener('orientationchange',()=>{fitSpawnMenu();setTimeout(fitSpawnMenu,250)});
if(window.visualViewport)visualViewport.addEventListener('resize',fitSpawnMenu);
function openSpawnMenu(){if(CAMB){openModePanel();return}if(state!=='play'||!PLATE)return;craftingPrompt.classList.add('hidden');state='pause';breaking=false;mining=false;cEl.classList.add('hidden');qteVis(false);if(document.exitPointerLock)document.exitPointerLock();spawnOpen=true;refreshSpawnCount();buildSpawnItems();go('spawnmenu');fitSpawnMenu();requestAnimationFrame(fitSpawnMenu)}
function closeSpawnMenu(){if(!spawnOpen)return;spawnOpen=false;resume()}
addEventListener('keydown',e=>{if(spawnOpen&&e.code==='Escape'){e.preventDefault();closeSpawnMenu()}});
/* ---------- LOBBY: botão "+" (no lugar do Inv) abre o painel portátil: Pronto · Inventário · Shop ---------- */
const LPM=mkScreen('lobbypanel','Painel portátil','dim');let lpOpen=false;
E('div','dsc','Escolha uma opção.',LPM);
B('Pronto',()=>{closeLobbyPanel();enterCambase()},LPM);
B('Inventário',()=>{closeLobbyPanel();requestAnimationFrame(()=>{if(state==='play')openInv()})},LPM);
B('Shop',()=>{closeLobbyPanel();const f=OWM.lobbyShop;if(typeof f==='function')f();else toast('Shop: em breve')},LPM);
B('Fechar',()=>closeLobbyPanel(),LPM);
function openLobbyPanel(){if(state!=='play'||!LOBBY||lpOpen)return;craftingPrompt.classList.add('hidden');state='pause';breaking=false;mining=false;cEl.classList.add('hidden');qteVis(false);if(document.exitPointerLock)document.exitPointerLock();lpOpen=true;go('lobbypanel')}
function closeLobbyPanel(){if(!lpOpen)return;lpOpen=false;resume()}
addEventListener('keydown',e=>{if(lpOpen&&e.code==='Escape'){e.preventDefault();closeLobbyPanel()}});
/* ---------- painel "Modo" (o botão Spawn vira "Modo" na Camera Base) ---------- */
const MDM=mkScreen('modepanel','Modo','dim');let mdOpen=false;
E('div','dsc','Enfrente ondas de Striders na Camera Base. Strider: modelo de fake gman (CC-BY 4.0). Tanque aliado: "Big Tank (Spidarrund)" de Eveston (CC-BY 4.0).',MDM);
const mdStart=B('Começar modo',()=>{closeModePanel();strModeStart()},MDM);
const mdStop=B('Encerrar modo',()=>{closeModePanel();strModeStop('Modo encerrado')},MDM);
B('Fechar',()=>closeModePanel(),MDM);
function openModePanel(){if(state!=='play'||!CAMB||mdOpen)return;craftingPrompt.classList.add('hidden');state='pause';breaking=false;mining=false;cEl.classList.add('hidden');qteVis(false);if(document.exitPointerLock)document.exitPointerLock();mdStart.classList.toggle('hidden',STM.on);mdStop.classList.toggle('hidden',!STM.on);mdOpen=true;go('modepanel')}
function closeModePanel(){if(!mdOpen)return;mdOpen=false;resume()}
addEventListener('keydown',e=>{if(mdOpen&&e.code==='Escape'){e.preventDefault();closeModePanel()}});

{const b=$('#bSpawn');if(b){b.addEventListener('touchstart',e=>{openSpawnMenu();e.preventDefault()},{passive:false});b.addEventListener('click',openSpawnMenu)}}
/* ---------- LOCK-ON em inimigos (botão "LOCK" no toque · T no teclado · R troca de alvo) ----------
   Travado: a câmera gira sozinha pra manter o alvo no centro (yaw e pitch suaves), o movimento fica relativo ao alvo (dá pra circular em volta),
   o soco já sai na direção dele e um marcador vermelho aparece sobre ele. Solta ao tocar de novo, quando o alvo morre/some ou passa de LK.BREAK metros.
   Com o lock ativo, arrastar a tela (ou mover o mouse rápido) pro lado troca para o inimigo vizinho naquela direção. */
const lkYaw=s=>Math.atan2(-(s.x-P.p.x),-(s.z-P.p.z));
const lkWrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function lkCands(){const o=[];for(const s of scs){if(s.st==='dead'||s.st==='coil'||s.fr||s.bur)continue;const d=Math.hypot(s.x-P.p.x,s.z-P.p.z);if(d<=LK.R&&Math.abs(s.y-P.p.y)<12)o.push({s,d})}return o}
function lkSync(){if(!LK.btn)LK.btn=$('#bLock');if(LK.btn){LK.btn.classList.toggle('on',!!LK.s);LK.btn.setAttribute('aria-pressed',String(!!LK.s))}}
function lockClear(){const s=LK.s;LK.s=null;LK.sw=0;if(s&&s.hb&&s.hp>=s.mhp)s.hb.visible=false;if(LK.mk)LK.mk.visible=false;lkSync()}
function lockSet(s){if(LK.s&&LK.s!==s&&LK.s.hb&&LK.s.hp>=LK.s.mhp)LK.s.hb.visible=false;LK.s=s;LK.sw=0;LK.swT=.35;s.hb.visible=true;lkSync()}
function lockToggle(){
 if(state!=='play'||COIL.on)return;
 if(LK.s){lockClear();return}
 const c=lkCands();if(!c.length){toast('Nenhum inimigo por perto');return}
 let best=null,bs=1e9;
 for(const q of c){const a=Math.abs(lkWrap(lkYaw(q.s)-P.yaw)),sc=q.d*(1+a*1.3);if(sc<bs){bs=sc;best=q.s}}   // perto e na direção da câmera
 lockSet(best);
}
function lockCycle(dir){   // dir>0: alvo mais à direita do atual · dir<0: mais à esquerda (yaw menor = mais à direita)
 if(!LK.s)return;
 const base=lkYaw(LK.s);let best=null,bd=1e9;
 for(const q of lkCands()){if(q.s===LK.s)continue;const df=lkWrap(lkYaw(q.s)-base),w=dir>0?-df:df;if(w>.02&&w<bd){bd=w;best=q.s}}
 if(best)lockSet(best);
}
function lockSwipe(dx){if(LK.swT>0)return;LK.sw+=dx;if(Math.abs(LK.sw)>90){const d=LK.sw>0?1:-1;LK.sw=0;LK.swT=.4;lockCycle(d)}}
function lockTick(dt){
 if(LK.swT>0)LK.swT-=dt;LK.sw*=Math.exp(-dt*3);
 const s=LK.s;if(!s)return;
 if(state!=='play'||COIL.on||P.hp<=0||s.st==='dead'||s.st==='coil'||s.bur||scs.indexOf(s)<0){lockClear();return}
 const dx=s.x-P.p.x,dz=s.z-P.p.z,d=Math.hypot(dx,dz);
 if(d>LK.BREAK){lockClear();toast('Alvo perdido');return}
 if(d>.35)P.yaw+=lkWrap(lkYaw(s)-P.yaw)*(1-Math.exp(-dt*12));
 const dy=s.y+s.k.HB_Y*.5-(P.p.y+1.62),want=cl(Math.atan2(dy,Math.max(d,1.5)),-.75,.5);
 P.pitch+=(want-P.pitch)*(1-Math.exp(-dt*8));
 s.hb.visible=true;
}
function lockMarker(dt){
 const s=LK.s;
 if(!s){if(LK.mk)LK.mk.visible=false;return}
 if(!LK.mk){
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.lineCap='round';
  x.strokeStyle='rgba(0,0,0,.55)';x.lineWidth=13;for(let i=0;i<4;i++){x.beginPath();x.arc(64,64,44,i*1.5708+.28,i*1.5708+1.29);x.stroke()}
  x.strokeStyle='#ff4a3a';x.lineWidth=8;for(let i=0;i<4;i++){x.beginPath();x.arc(64,64,44,i*1.5708+.28,i*1.5708+1.29);x.stroke()}
  LK.tex=new THREE.CanvasTexture(c);
  LK.mk=new THREE.Sprite(new THREE.SpriteMaterial({map:LK.tex,transparent:true,depthTest:false,depthWrite:false,fog:false,toneMapped:false}));
  LK.mk.renderOrder=1000;LK.mk.frustumCulled=false;scene.add(LK.mk);
 }
 const m=LK.mk,y=s.y+s.k.HB_Y*.5;m.visible=true;m.position.set(s.x,y,s.z);
 const dist=cam.position.distanceTo(m.position),sz=cl(dist*Math.tan(cam.fov*Math.PI/360)*2*.085,.7,2.4);
 m.scale.set(sz,sz,1);m.material.rotation+=dt*1.1;
}
{const b=$('#bLock');if(b){LK.btn=b;b.addEventListener('touchstart',e=>{lockToggle();e.preventDefault()},{passive:false});b.addEventListener('click',lockToggle)}}

/* ---------- Colisão com inimigos ----------
   Cada criatura viva é um cilindro (raio BODY_R, altura ~HB_Y). O jogador (raio .35) não atravessa: a sobreposição é desfeita empurrando o jogador (60%)
   e a criatura (40%), e a velocidade do jogador na direção dela é cortada. Pular em cima de uma criatura passa por cima. Criaturas também se afastam entre si. */
const PL_R=.35;
function scCollide(dt){
 const n=scs.length;if(!n)return;
 if(!COIL.on&&P.hp>0){
  for(let i=0;i<n;i++){const s=scs[i];if(s.st==='dead'||s.st==='coil'||s.bur)continue;
   const top=s.y+Math.max(.6,s.k.HB_Y-.1);if(P.p.y>=top-.1||P.p.y+1.7<=s.y)continue;
   let dx=P.p.x-s.x,dz=P.p.z-s.z,d=Math.hypot(dx,dz);const min=s.k.BODY_R+PL_R;if(d>=min)continue;
   const o=min-d;   // quanto está dentro
   if(d<.001){dx=Math.sin(P.yaw);dz=Math.cos(P.yaw);d=1}   // exatamente em cima: empurra pra trás
   const nx=dx/d,nz=dz/d;
   moveAxis('x',nx*o*.6);moveAxis('z',nz*o*.6);
   scMove(s,-nx*o*.4,-nz*o*.4);
   const vn=P.vel.x*nx+P.vel.z*nz;if(vn<0){P.vel.x-=vn*nx;P.vel.z-=vn*nz}}
 }
 for(let i=0;i<n;i++){const a=scs[i];if(a.st==='dead'||a.st==='coil')continue;
  for(let j=i+1;j<n;j++){const b=scs[j];if(b.st==='dead'||b.st==='coil')continue;
   const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),min=(a.k.BODY_R+b.k.BODY_R)*.9;if(d>=min||Math.abs(a.y-b.y)>1.5)continue;
   const nx=d>.001?dx/d:1,nz=d>.001?dz/d:0,o=(min-d)*.5;scMove(a,-nx*o,-nz*o);scMove(b,nx*o,nz*o)}}
}
function scHurt(s,amount,force=3.4,from=null,by=null){   // from = quem empurra (padrão: jogador); by = inimigo atacante
 if(s.isStrider)return strLegHit(s,amount);   // perna de um Strider (modo ondas)
 if(s.st==='dead'||s.bur)return;const K=s.k,d=amount*(1-K.ARMOR)*(s.din||1);s.hp=Math.max(0,s.hp-d);s.flash=.18;
 const arm=K.ARMOR_ACT&&s.st==='attack'&&s.ph!=='rec',f=arm?force*.3:force;   // super-armor: quase não é empurrado enquanto ataca
 const fx=from?from.x:P.p.x,fz=from?from.z:P.p.z,dx=s.x-fx,dz=s.z-fz,l=Math.hypot(dx,dz)||1;s.kx=dx/l*f;s.kz=dz/l*f;
 s.hb.visible=true;if(s.pnT<=0||s.hp<=0){scSound(s,'pain');s.pnT=.6}const r=s.hp/(s.mhp||K.HP);s.fill.scale.x=Math.max(.001,r);s.fill.position.x=-(1-r)*.5;
 if(s.hp<=0){if(STM.on&&!s.fr)wvReward(0,s.k.PTS||WV_PTS_MOB);s.st='dead';s.dead=0;s.tok=false;s.air=0;s.tel=0;s.ph='';scUnmark(s);scSurf(s);if(s.sq!==1){s.sq=1;s.inst.group.scale.y=s.inst.group.scale.x}s.inst.play(K.DEATH_CLIP||'idle',.1,!!K.DEATH_CLIP);return}
 s.sees=true;s.lost=0;s.lx=fx;s.lz=fz;s.rage=K.RAGE_T;if(by){s.tg=by;s.tgL=2.5;s.tgT=.4}   // apanhou: fica agressivo por um tempo
 if(s.st==='coil')return;
 if(s.st==='idle'||s.st==='wander'){s.st='chase';s.mode='circle';s.mt=rr(K.MODE_T);s.inst.play('run',.1)}
 if(s.air)return;
 if(K.FLEE_HP&&!s.fled&&s.hp/s.mhp<K.FLEE_HP){s.fled=1;scCancel(s);s.flee=K.FLEE_T}   // vida baixa: foge
 else if(d>=K.STAGGER_MIN&&s.imm<=0&&!arm){scCancel(s);s.stg=K.STAGGER_T;s.imm=K.STAGGER_T+K.STAGGER_IMM;s.inst.play('idle',.08)}   // golpe forte: stagger (cancela o ataque)
}
function scAim(){   // alvo do soco: escorpião mais próximo dentro do alcance e de um cone HORIZONTAL à frente do jogador; a inclinação da câmera (pitch) não importa
 const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw);let best=null;
 for(const s of scs){if(s.st==='dead'||s.st==='coil'||s.fr||s.bur)continue;   // amigáveis e quem está debaixo da terra não são alvo do soco
  const dx=s.x-P.p.x,dz=s.z-P.p.z,d=Math.hypot(dx,dz);
  if(d>SCP.PUNCH_RANGE||Math.abs(s.y-P.p.y)>2)continue;
  if(d>.05){const ca=Math.max(-1,Math.min(1,(dx*fx+dz*fz)/d)),lim=Math.max(.5,Math.atan2(s.k.BODY_R+.3,d));if(Math.acos(ca)>lim)continue}   // cone: no mínimo ~29°, e mais largo quanto mais perto
  const t=Math.hypot(dx,s.y+.35-eye.y,dz);if(!best||t<best.t)best={s,t}}
 if(CAMB)for(const t of STR.list){if(t.hp<=0)continue;for(const q of t.prox){   // pernas do Strider: alcance um pouco maior (as pernas são grossas)
  const dx=q.x-P.p.x,dz=q.z-P.p.z,d=Math.hypot(dx,dz);if(d>SCP.PUNCH_RANGE+.8||Math.abs(q.y-P.p.y)>2.2)continue;
  if(d>.05){const ca=Math.max(-1,Math.min(1,(dx*fx+dz*fz)/d)),lim=Math.max(.5,Math.atan2(1.6,d));if(Math.acos(ca)>lim)continue}
  const tt=Math.hypot(dx,q.y+.9-eye.y,dz);if(!best||tt<best.t)best={s:q,t:tt}}}
 return best;
}
function scPunch(s){if(pDmgT>0)return;scSwingReact(s);const punchPower=archetypeMul('punchDamage'),w=OWM.weapon.id&&WPS[OWM.weapon.id];if(w){if(!(anim.strike&&anim.strike()))return;pDmgT=w.cd*.9;scHurt(s,w.dmg*punchPower);lmbHitFx({x:s.x,y:s.y+.45,z:s.z});return}pDmgT=SCP.PUNCH_CD;scHurt(s,SCP.PUNCH*punchPower);lmbHitFx({x:s.x,y:s.y+.45,z:s.z})}   // com arma: o dano cai no instante do golpe da animação
function scFace(s,dx,dz,rate,dt){const want=Math.atan2(dx,dz);let d=want-s.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));s.yaw+=Math.max(-rate*dt,Math.min(rate*dt,d))}
/* ---------- Sons dos inimigos ----------
   Cada MP3 é uma compilação longa; aqui ficam os trechos [início s, duração s] usados: alert = aviso/rosnado ao ver o jogador e de vez em quando na perseguição,
   atk = no começo do aviso do ataque, pain = ao levar dano/morrer. Volume = volume da música × distância (some a 34 m). Máx. 4 vozes ao mesmo tempo. */
const MOBSND={
 scorpion:{src:'scorpion.mp3',alert:[[.66,1.6],[3.69,1.4]],atk:[[8.7,.45],[9.62,.3],[10.16,.3],[11.31,.45],[12.28,.45],[13.25,.45],[14.21,.45],[15.18,.45]],pain:[[16.14,.4],[17.1,.4],[18.07,.4]]},
 snake:{src:'snake.mp3',alert:[[.87,1.6],[4.22,1.6],[9.8,1.6]],atk:[[27.46,1.1],[13.34,.9],[5.2,.9]],pain:[[1.2,.7],[10.5,.7]]},
 zombie:{src:'zombie.mp3',alert:[[1.67,1.4],[5.25,1.5],[7.43,1.1],[12.96,1.2]],atk:[[3.49,1.0],[8.98,.85],[10.58,.6]],pain:[[6,.6],[11.8,.45]]}
};
const MSV={pool:{},act:[]};
function scSound(s,kind){
 if(s.k.NOSND||typeof Audio==='undefined'||MSV.act.length>=4)return;
 const sp=s.k===SPC.zombie?'zombie':s.k===SPC.snake?'snake':'scorpion',D=MOBSND[sp],L=D[kind];if(!L)return;
 const d=Math.hypot(s.x-P.p.x,s.z-P.p.z);if(d>34)return;
 const vol=Math.min(1,Math.pow(cl(S.mvol,0,100)/100,2)*Math.pow(1-d/34,1.5)*1.2);if(vol<.01)return;
 let p=MSV.pool[sp];if(!p){p=MSV.pool[sp]=[];for(let i=0;i<2;i++){const a=new Audio(D.src);a.preload='auto';p.push(a)}}
 const a=p.find(x=>!x._u);if(!a)return;const c=L[Math.floor(Math.random()*L.length)];
 a._u=1;a.volume=vol;try{a.currentTime=c[0];const pr=a.play();if(pr&&pr.catch)pr.catch(()=>{a._u=0})}catch(e){a._u=0;return}
 MSV.act.push({a,end:performance.now()+c[1]*1000,vol})}
function scVoiceTick(){   // encerra os trechos com um fade curto no fim
 if(!MSV.act.length)return;const now=performance.now();
 for(let i=MSV.act.length-1;i>=0;i--){const v=MSV.act[i],left=v.end-now;if(left<=0){try{v.a.pause()}catch(e){}v.a._u=0;MSV.act.splice(i,1)}else if(left<150)v.a.volume=Math.max(0,v.vol*left/150)}}
/* ---------- IA de combate: funções auxiliares ---------- */
const _sep={x:0,z:0};
function scSep(s){let x=0,z=0;const R=s.k.SEP_R;for(const o of scs){if(o===s||o.st==='dead'||o.st==='coil')continue;const dx=s.x-o.x,dz=s.z-o.z,d=Math.hypot(dx,dz);if(d<R&&d>.001){const w=(R-d)/R/d;x+=dx*w;z+=dz*w}}_sep.x=x;_sep.z=z}
let scMkG=null;
function scMark(s,kind,x,z,sx,sz,yaw,op){   // marcador de aviso no chão (1 mesh por mob, criado só quando precisa; geometria compartilhada): kind 0 = círculo (pulo), 1 = faixa (dash)
 if(!s.mk){if(!scMkG)scMkG={c:new THREE.CircleGeometry(1,28).rotateX(-Math.PI/2),p:new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2)};s.mk=new THREE.Mesh(scMkG.c,new THREE.MeshBasicMaterial({color:0xff4020,transparent:true,opacity:.4,depthWrite:false,side:THREE.DoubleSide}));s.mk.renderOrder=5;s.mk.frustumCulled=false;scene.add(s.mk)}
 const m=s.mk;m.geometry=kind?scMkG.p:scMkG.c;m.visible=true;m.position.set(x,groundH(x,z)+.08,z);m.scale.set(sx,1,sz);m.rotation.y=yaw;m.material.opacity=.18+.5*op}
function scUnmark(s){if(s.mk)s.mk.visible=false}
function scPace(s){const a=s.k.F.clips&&s.k.F.clips.attack;s.asp=a&&a.dur?a.dur*(a.hit==null?.5:a.hit)/s.tl:1}   // wind-up do clipe termina junto com o aviso
function scEnd(s,run){   // fim do ataque: devolve a vaga e volta a circular (ou recua, se hit-and-run)
 const K=s.k;s.tok=false;s.wt=0;s.tel=0;s.st='chase';s.ph='';s.cd=K.ATK_CD*(s.rage>0?K.RAGE_CD:1);scUnmark(s);scSurf(s);
 s.mode='circle';s.mt=rr(K.MODE_T);if(run&&K.HITRUN_P&&Math.random()<K.HITRUN_P){s.mode='retreat';s.mt=K.HITRUN_T}
 s.inst.play('run',.1)}
function scCancel(s){   // stagger/fuga: aborta o ataque e libera a vaga
 if(s.at===5&&s.st==='attack'){if(s.brCd<=0)s.brCd=s.k.BR_CD;scSurf(s)}
 if(s.st==='attack')s.st='chase';s.tok=false;s.wt=0;s.ph='';s.tel=0;scUnmark(s);s.cd=Math.max(s.cd,.4);s.mode='circle';s.mt=rr(s.k.MODE_T)}
/* Skills do zumbi por grupo: com 3 ou mais zumbis em combate, cada um fica com UMA das 3 skills (pulo, pisão, dash), na ordem em que nasceram;
   numa onda maior as skills se repetem em rodízio (4º = skill do 1º, 5º = do 2º...) e vão sendo usadas aos poucos, conforme a fila de ataque (AI.MAX_ATK) libera cada zumbi
   e a skill dele sai do cooldown. Com menos de 3, vale o sorteio normal de sempre. Retorna o plano (0 = golpe comum) ou null = sorteio normal. */
const Z_SKILLS=[3,4,2];   // planos: 3 = PULO, 4 = PISÃO, 2 = DASH
function zSkillPlan(s){
 const K=s.k,grp=scs.filter(o=>o.k===K&&!o.fr&&!o.rm&&(o.st==='chase'||o.st==='attack')).sort((a,b)=>a.zid-b.zid);
 if(grp.length<3)return null;
 const i=grp.indexOf(s);if(i<0)return null;
 const plan=Z_SKILLS[i%3],cd=plan===3?s.jpCd:plan===4?s.stCd:s.lgCd;
 return cd>0?0:plan;   // skill em cooldown: golpe comum até ela voltar
}
function scPlan(s){const K=s.k;s.plan=0;if(K===SPC.zombie){const zp=zSkillPlan(s);if(zp!==null){s.plan=zp;return}}if(K.BR_P&&s.brCd<=0&&Math.random()<K.BR_P)s.plan=5;else if(K.JP_P&&s.jpCd<=0&&Math.random()<K.JP_P)s.plan=3;else if(K.ST_P&&s.stCd<=0&&Math.random()<K.ST_P)s.plan=4;else if(K.SL_P&&s.slCd<=0&&Math.random()<K.SL_P)s.plan=6;else if(K.LG_P&&s.lgCd<=0&&Math.random()<K.LG_P)s.plan=2}
function scStart(s){
 const K=s.k;
 if(s.plan===0&&K.COIL_P&&!COIL.on&&COIL.cd<=0&&P.hp>0&&!s.fr&&!s.tg&&Math.random()<K.COIL_P){s.tok=false;s.mode='circle';coilStart(s);return}   // cobra: enrolar só no momento do golpe corpo a corpo
 s.st='attack';s.at=s.plan;s.step=0;s.lk=0;s.hit=0;s.cn=1;
 let tl=s.at===5?K.BR_TELE:s.at===6?K.SL_TELE:s.at===4?K.ST_TELE:s.at===3?K.JP_TELE:s.at===2?K.LG_TELE:K.TELE;
 if(s.at===0&&Math.random()<K.COMBO_P)s.cn=2+(Math.random()<.5?1:0);
 if(s.rage>0)tl*=.85;
 s.tl=s.pt=tl;s.ph='tele';s.inst.atk=s.at;s.inst.play('attack',.08,true);scPace(s);scSound(s,'atk')}
function scLaunch(s,tx,tz,T){s.air=1;s.airT=0;s.vy=(groundH(tx,tz)-s.y)/T+s.k.GRAV*T/2;s.jx=(tx-s.x)/T;s.jz=(tz-s.z)/T}   // arco que pousa em (tx,tz) após T s
/* ---------- Onda de choque do zumbi (PISÃO) + efeitos de chão (aterrissagem do pulo) ----------
   Anel achatado no chão que cresce (mistura aditiva) + poeira/estrelas do sistema RBX. A onda causa dano UMA vez em quem está no chão quando ela passa
   (pulando ou no dash de i-frames: desvia). A tela treme com força que cai com a distância do jogador até o impacto. */
const SHK={live:[],pool:[],geo:null};
function shkRing(x,y,z,max,life,w){   // w = onda com dano {K,fr,dmg,spd} ou null (só visual)
 if(!SHK.geo)SHK.geo=new THREE.RingGeometry(.78,1,64).rotateX(-Math.PI/2);
 let m=SHK.pool.pop();
 if(!m){m=new THREE.Mesh(SHK.geo,new THREE.MeshBasicMaterial({color:0xffe2b0,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,fog:false}));m.frustumCulled=false;m.renderOrder=6}
 m.position.set(x,y,z);m.scale.set(.3,1,.3);m.material.opacity=0;m.visible=true;scene.add(m);
 SHK.live.push({m,x,y,z,r:.3,max,life,l0:life,w,hit:false,acc:0,hit0:new Set()});
}
function shkUpdate(dt){
 for(let i=SHK.live.length-1;i>=0;i--){
  const f=SHK.live[i];f.life-=dt;
  if(f.life<=0){scene.remove(f.m);f.m.visible=false;SHK.pool.push(f.m);SHK.live[i]=SHK.live[SHK.live.length-1];SHK.live.pop();continue}
  const a=1-f.life/f.l0,prev=f.r;f.r=Math.max(.3,f.max*(1-Math.pow(1-a,2.2)));   // sai rápido e desacelera
  f.m.scale.set(f.r,1,f.r);f.m.material.opacity=Math.pow(1-a,1.3)*.85;
  /* poeira correndo na frente da onda */
  f.acc+=dt;
  while(f.acc>.04){f.acc-=.04;for(let k=0;k<2;k++){const an=Math.random()*6.2832;rbxAdd('glow',0xcfc6b0,f.x+Math.cos(an)*f.r,f.y+.12,f.z+Math.sin(an)*f.r,Math.cos(an)*.6,.5+Math.random()*.7,Math.sin(an)*.6,.4+Math.random()*.25,.5+Math.random()*.3,{norm:1,grow:1,drag:2})}}
  const w=f.w;if(!w)continue;
  /* dano: quando a frente da onda passa pelo alvo (entre o raio anterior e o atual), só em quem está no chão */
  const hitBand=d=>d>=prev-.7&&d<=f.r+.7;
  if(!w.fr&&!f.hit&&P.hp>0&&state==='play'){const d=Math.hypot(P.p.x-f.x,P.p.z-f.z);
   if(hitBand(d)&&P.p.y-f.y<.7&&P.p.y-f.y>-2.5){f.hit=true;if(!(w.K.IFRAME&&dashT>0)){hurt(w.dmg,false,w.K.MSG,true);addTrauma(.3)}}}
  for(const o of scs){if(o.st==='dead'||o.st==='coil'||o.fr===w.fr||f.hit0.has(o))continue;
   const d=Math.hypot(o.x-f.x,o.z-f.z);if(hitBand(d)&&o.y-f.y<.7){f.hit0.add(o);scHurt(o,w.dmg,4.2,{x:f.x,z:f.z},w.by)}}
 }
}
/* poeira radial + estrelas + clarão + anel no chão. R = tamanho do anel, tr = força do tremor da tela */
function scGroundFx(s,R,tr){
 const o={x:s.x,y:s.y+.15,z:s.z},pal=RPAL.land;
 shkRing(s.x,s.y+.1,s.z,R*1.6,.42,null);
 rbxHit(o,pal,{n:11,sp:5.4,size:.3,flash:1.2,ring:0,fin:false});
 for(let i=0;i<12;i++){const a=i/12*6.2832+Math.random()*.4,v=2.6+Math.random()*1.8;rbxAdd('glow',0xc9bfa8,o.x+Math.cos(a)*.5,o.y,o.z+Math.sin(a)*.5,Math.cos(a)*v,.5+Math.random()*.7,Math.sin(a)*v,.5+Math.random()*.3,.7,{norm:1,grow:1,drag:2.2})}
 const d=Math.hypot(s.x-P.p.x,s.z-P.p.z);addTrauma(tr*Math.max(0,1-d/20));
}
/* ---------- ENTRAR NA TERRA (escorpião): helpers ---------- */
let scMoundG=null,scMoundM=null;
function scMound(s,k,shake){   // montinho de areia no chão (1 por escorpião, só visível debaixo da terra)
 if(!s.mound){if(!scMoundG){scMoundG=new THREE.SphereGeometry(1,12,8);scMoundM=new THREE.MeshLambertMaterial({color:0xb59a68})}s.mound=new THREE.Mesh(scMoundG,scMoundM);s.mound.frustumCulled=false;scene.add(s.mound)}
 const m=s.mound,j=shake?.07:.012;
 m.visible=true;m.position.set(s.x+(Math.random()-.5)*j*2,groundH(s.x,s.z)-.03,s.z+(Math.random()-.5)*j*2);m.scale.set(.62*k,.27*k+(shake?Math.random()*.06:0),.62*k);
}
function scSurf(s){s.bur=0;s.sk=0;s.inst.group.visible=true;if(s.mound)s.mound.visible=false}   // volta pra superfície (fim do ataque, stagger, morte)
function scDigPuff(s,n,up){   // poeira + fagulhas de areia na posição do escorpião
 const gy=groundH(s.x,s.z)+.12;
 for(let i=0;i<n;i++){const a=Math.random()*6.2832,v=.6+Math.random()*1.6;rbxAdd('glow',0xc9b48a,s.x+Math.cos(a)*.3,gy,s.z+Math.sin(a)*.3,Math.cos(a)*v,up*(.6+Math.random()*.8),Math.sin(a)*v,.35+Math.random()*.3,.4+Math.random()*.3,{norm:1,grow:1,drag:2})}
 for(let i=0;i<Math.ceil(n/3);i++){const a=Math.random()*6.2832,v=1.5+Math.random()*2;rbxAdd('star',0xf0e0b8,s.x,gy,s.z,Math.cos(a)*v,up*1.6+Math.random()*1.5,Math.sin(a)*v,.3+Math.random()*.2,.14+Math.random()*.1,{g:9,drag:1.6,spin:R4()*8})}
}
/* PISÃO: pé no chão -> onda de choque que se espalha até ST_R e treme a tela */
function scStomp(s){
 const K=s.k;
 shkRing(s.x,s.y+.1,s.z,K.ST_R,K.ST_R/K.ST_SPD,{K,fr:s.fr,dmg:K.DMG*K.ST_DMG*s.dm,by:s});
 scGroundFx(s,1.4,0);
 const d=Math.hypot(s.x-P.p.x,s.z-P.p.z);addTrauma(K.ST_SHAKE*Math.max(0,1-d/22));
}
/* BATE-CHÃO (chefe): as duas mãos batem no chão à frente; dano em área no ponto do impacto + onda de choque só visual */
function scSlam(s){
 const K=s.k,ax=s.ax,az=s.az,y=s.y,dm=K.DMG*K.SL_DMG*s.dm;
 shkRing(ax,y+.1,az,K.SL_R*2.4,.55,null);scGroundFx({x:ax,y,z:az},K.SL_R*.8,0);
 if(!s.fr&&P.hp>0&&Math.hypot(P.p.x-ax,P.p.z-az)<K.SL_R&&Math.abs(P.p.y-y)<2&&!(K.IFRAME&&dashT>0)){hurt(dm,false,K.MSG,true);spawnMobHitFx(s)}
 for(const o of scs){if(o===s||o.st==='dead'||o.st==='coil'||o.fr===s.fr)continue;if(Math.hypot(o.x-ax,o.z-az)<K.SL_R+o.k.BODY_R&&Math.abs(o.y-y)<2)scHurt(o,dm,5,{x:ax,z:az},s)}
 addTrauma(K.SL_SHAKE*Math.max(0,1-Math.hypot(ax-P.p.x,az-P.p.z)/26));
}
function scLand(s){
 const K=s.k;s.air=0;s.vy=0;s.jx=s.jz=0;
 if(s.st==='attack'&&s.ph==='air'&&s.at===5){   // pouso do pulo saindo da terra: dano em área pequena + poeira; repete até acabar os pulos
  const dm=K.DMG*K.BR_DMG*s.dm;
  if(!s.fr&&P.hp>0&&Math.hypot(P.p.x-s.x,P.p.z-s.z)<K.BR_R&&Math.abs(P.p.y-s.y)<1.8&&!(K.IFRAME&&dashT>0)){hurt(dm,false,K.MSG);spawnMobHitFx(s);if(K.POISON_DUR)poisonApply(K)}
  for(const o of scs){if(o===s||o.st==='dead'||o.st==='coil'||o.fr===s.fr)continue;if(Math.hypot(o.x-s.x,o.z-s.z)<K.BR_R+o.k.BODY_R&&Math.abs(o.y-s.y)<1.8)scHurt(o,dm,3.4,s,s)}
  scGroundFx(s,K.BR_R,K.BR_SHAKE);
  s.bn--;
  if(s.bn>0){s.ph='sink';s.pt=K.BR_SINK;s.bt=0;s.sq=.85;s.inst.play('run',.1)}   // entra na terra de novo
  else{s.ph='rec';s.pt=K.BR_REC;s.brCd=K.BR_CD;s.sq=.8;s.inst.play('idle',.1)}   // acabou: fica de fora e começa a espera (BR_CD)
  return}
 if(s.st==='attack'&&s.ph==='air'){
  const dm=K.DMG*K.JP_DMG*s.dm;   // dano só no raio da aterrissagem (jogador e inimigos do outro lado)
  if(!s.fr&&P.hp>0&&Math.hypot(P.p.x-s.x,P.p.z-s.z)<K.JP_R&&Math.abs(P.p.y-s.y)<1.8&&!(K.IFRAME&&dashT>0))hurt(dm,false,K.MSG);
  for(const o of scs){if(o===s||o.st==='dead'||o.st==='coil'||o.fr===s.fr)continue;if(Math.hypot(o.x-s.x,o.z-s.z)<K.JP_R+o.k.BODY_R&&Math.abs(o.y-s.y)<1.8)scHurt(o,dm,3.4,s,s)}
  scGroundFx(s,K.JP_R,K.JP_SHAKE);   // poeira + estrelas + anel no chão + tela treme (cai com a distância)
  s.ph='rec';s.pt=K.JP_REC;s.sq=.78;s.jpCd=rr(K.JP_CD);s.inst.play('idle',.1)}
 else s.sq=.9}
function scHop(s,vx,vz){   // pula obstáculo baixo/degrau que bloqueia o caminho
 const l=Math.hypot(vx,vz)||1,ux=vx/l,uz=vz/l,tx=s.x+ux*2.2,tz=s.z+uz*2.2,gy=groundH(tx,tz);
 s.blk=0;s.hopCd=.8;
 if(waterSurf(tx,tz)-gy>.15||gy-s.y>1.6||propHits(tx,gy-1.2,tz)||propHits(s.x+ux*.7,s.y+.75,s.z+uz*.7)||propHits(s.x+ux*1.2,s.y+.75,s.z+uz*1.2))return;   // não pula em água, em props altos nem pra onde não pode pousar
 scLaunch(s,tx,tz,.7);s.hopCd=2}
function scGo(s,vx,vz,dt){   // anda; conta o tempo bloqueado e, se OBS_JUMP, pula o obstáculo
 const m=scMove(s,vx*dt,vz*dt);
 if(!m&&(vx||vz)){s.blk+=dt;if(s.k.OBS_JUMP&&s.blk>s.k.OBS_WAIT&&!s.air&&s.hopCd<=0&&s.st==='chase')scHop(s,vx,vz)}else s.blk=Math.max(0,s.blk-dt*2);
 return m}
function scSwingReact(skip){   // o jogador começou um golpe (M1/M2/soco): inimigos por perto podem esquivar pro lado
 for(const s of scs){const K=s.k;if(s===skip||s.fr||s.tg||s.st!=='chase'||s.air||s.dg>0||s.stg>0||s.flee>0||s.dgT>0||!s.sees)continue;
  const dx=s.x-P.p.x,dz=s.z-P.p.z,d=Math.hypot(dx,dz);if(d>K.DODGE_RANGE||d<.01)continue;
  if(Math.random()>K.DODGE_P){s.dgT=.35;continue}
  const sg=Math.random()<.5?1:-1,k=K.DODGE_DIST/K.DODGE_T/d;s.dg=K.DODGE_T;s.dgT=rr(K.DODGE_CD);s.dgx=-dz*sg*k;s.dgz=dx*sg*k}}
function scPickTarget(s){   // amigável ataca o hostil mais próximo; hostil prefere um amigável próximo, a menos que o jogador esteja bem mais perto
 let best=null,bd=1e9;const rng=s.fr?s.k.SIGHT:14;
 if(s.tg&&s.tgL>0)return;   // foi atacado por esse inimigo: mantém o alvo por um tempo
 for(const o of scs){if(o===s||o.st==='dead'||o.st==='coil'||o.bur||o.fr===s.fr)continue;const d=Math.hypot(o.x-s.x,o.z-s.z);if(d<rng&&d<bd){bd=d;best=o}}
 if(!s.fr&&best&&Math.hypot(P.p.x-s.x,P.p.z-s.z)<bd*.8)best=null;
 s.tg=best}
function scDmg(s,amt){if(s.tg)scHurt(s.tg,amt,3.4,s,s);else hurt(amt,false,s.k.MSG);spawnMobHitFx(s)}   // golpe do inimigo (zumbi, cobra e escorpião usam as mesmas partículas): no jogador ou no inimigo-alvo
const TK={n:0,full:false};
function scTokens(){   // fila de ataque: conta quem ataca e dá a vaga a quem espera há mais tempo
 let n=0;for(const s of scs){if(s.tok&&s.st!=='chase'&&s.st!=='attack')s.tok=false;if((s.fr||s.tg)&&s.st==='chase'&&s.sees&&!s.tok&&!s.air&&s.stg<=0&&s.flee<=0&&s.mode!=='retreat'){s.tok=true;s.mode='commit';s.ct=0;scPlan(s)}   // vaga só vale contra o jogador; luta entre inimigos não disputa vaga
  if(s.tok&&!s.fr&&!s.tg)n++}
 while(n<AIC.MAX_ATK){let b=null;
  for(const s of scs){if(s.fr||s.tg||s.st!=='chase'||s.tok||!s.sees||s.air||s.stg>0||s.flee>0||s.mode==='retreat'||Math.hypot(s.x-P.p.x,s.z-P.p.z)>s.k.TOKEN_R)continue;if(!b||s.wt>b.wt)b=s}
  if(!b)break;b.tok=true;b.mode='commit';b.ct=0;scPlan(b);n++}
 TK.n=n;TK.full=n>=AIC.MAX_ATK}
function scUpdate(s,dt){
 const K=s.k,g=s.inst.group,gy=groundH(s.x,s.z);
 s.zt+=dt;
 if(!s.air){if(gy<s.y-1.5&&s.st!=='dead'&&s.st!=='coil'){s.air=1;s.vy=0;s.jx=s.jz=0;s.airT=0}else s.y+=(gy-s.y)*Math.min(1,dt*14)}   // cai de barrancos de verdade
 if(s.st==='dead'){if(s.ck>0){s.ck=Math.max(0,s.ck-dt*3);s.inst.coil=s.ck}s.dead+=dt;const dc=K.DEATH_CLIP,hold=K.DEAD_HOLD||3.5;
  if(dc){g.rotation.set(0,s.yaw,0);g.position.set(s.x,s.y+K.DEAD_Y,s.z)}   // espécie com animação de morte: o próprio clipe derruba o corpo
  else{g.rotation.set(0,s.yaw,Math.PI*Math.min(1,s.dead/.4));g.position.set(s.x,s.y+K.DEAD_Y+(s.dead<.4?Math.sin(Math.min(1,s.dead/.4)*Math.PI)*.25:0),s.z)}
  if(s.dead>hold)g.scale.setScalar(K.F.SCALE*Math.max(.001,1-(s.dead-hold)));s.inst.update(dt,dc?1:.3);s.hb.visible=false;if(s.dead>hold+1)scRemove(s);return}
 if(s.st==='coil'){coilUpdate(s,dt);return}
 if(s.ck>0)s.ck=Math.max(0,s.ck-dt*3);   // soltou: a espiral desfaz rápido
 s.tgT-=dt;s.tgL-=dt;if(s.tgT<=0){s.tgT=.4;scPickTarget(s)}if(s.tg&&(s.tg.st==='dead'||s.tg.rm))s.tg=null;   // alvo: o jogador ou outro inimigo (amigável x hostil)
 const T=s.tg,has=!!T||(!s.fr&&P.hp>0),tx=T?T.x:P.p.x,ty=T?T.y:P.p.y,tz=T?T.z:P.p.z;
 const dx=tx-s.x,dz=tz-s.z,dist=Math.hypot(dx,dz),dy=Math.abs(ty-s.y),ux=dist>.001?dx/dist:0,uz=dist>.001?dz/dist:1;
 s.cd-=dt;s.snT-=dt;s.pnT-=dt;s.imm-=dt;s.dgT-=dt;s.lgCd-=dt;s.jpCd-=dt;s.stCd-=dt;s.slCd-=dt;s.brCd-=dt;s.hopCd-=dt;if(s.rage>0)s.rage-=dt;
 if(s.kx||s.kz){scMove(s,s.kx*dt,s.kz*dt);const k=Math.exp(-dt*9);s.kx*=k;s.kz*=k;if(Math.abs(s.kx)+Math.abs(s.kz)<.1)s.kx=s.kz=0}
 s.seeT-=dt;if(s.seeT<=0){s.seeT=.2+Math.random()*.1;s.sees=has&&dist<K.SIGHT&&(dist<K.HEAR||(Math.sin(s.yaw)*dx+Math.cos(s.yaw)*dz)/dist>K.FOV_COS)&&scLOS(s,tx,ty+(T?.8:1.2),tz)}
 if(s.sees){s.lost=0;s.lx=tx;s.lz=tz}else s.lost+=dt;
 let spd=1;
 if(s.air){   // no ar (pulo de ataque, pulo de obstáculo ou queda): gravidade e pouso
  s.airT+=dt;s.vy-=K.GRAV*dt;s.y+=s.vy*dt;
  if(s.jx||s.jz){if(!scMove(s,s.jx*dt,s.jz*dt))s.jx=s.jz=0}
  const g2=groundH(s.x,s.z);
  if((s.y<=g2&&s.vy<=0)||s.airT>3){s.y=g2;scLand(s)}else if(s.y<g2)s.y=g2;
 }
 else if(s.st==='idle'||s.st==='wander'){
  if(s.sees){s.st='chase';s.mode='circle';s.mt=rr(K.MODE_T);s.wt=0;s.inst.play('run',.12);scSound(s,'alert');s.snT=rr([5,9])}
  else if(s.st==='idle'){s.t-=dt;const pdf=s.fr?Math.hypot(P.p.x-s.x,P.p.z-s.z):0;
   if(s.t<=0&&pdf>7){s.tx=P.p.x+(Math.random()-.5)*5;s.tz=P.p.z+(Math.random()-.5)*5;s.st='wander';s.fol=1;s.t=pdf/(K.SPEED*.7)+1.5;s.inst.play('run',.2)}   // amigável: segue o jogador
   else if(s.t<=0){const a=Math.random()*6.2832,r=3+Math.random()*6,tx=s.x+Math.sin(a)*r,tz=s.z+Math.cos(a)*r;if(scHab(K,tx,tz)>.4){s.tx=tx;s.tz=tz;s.st='wander';s.t=r/K.WALK+.5;s.inst.play('run',.2)}else s.t=1.5}}
  else{const wx=s.tx-s.x,wz=s.tz-s.z,wl=Math.hypot(wx,wz);s.t-=dt;if(wl<.4||s.t<=0){s.st='idle';s.t=(s.fr?.6:2)+Math.random()*4;s.fol=0;s.inst.play('idle',.25)}else{const ws=s.fol?K.SPEED*.7:K.WALK;scFace(s,wx,wz,s.fol?6:3,dt);scMove(s,Math.sin(s.yaw)*ws*dt,Math.cos(s.yaw)*ws*dt);spd=s.fol?K.CHASE_ANIM*.7:K.WALK_ANIM}}
 }
 else if(s.st==='chase'){
  if(s.mode==='commit'&&!s.tok)s.mode='circle';   // (também cobre a cobra solta do enrolar)
  const sp=K.SPEED*(s.rage>0?K.RAGE_SPD:1);let vx=0,vz=0;
  if(s.stg>0){s.stg-=dt;if(s.inst.clip!=='idle')s.inst.play('idle',.08)}   // desequilibrado
  else if(!has||s.lost>K.LOST_T){s.st='idle';s.t=1.5;s.tok=false;s.inst.play('idle',.25)}   // desistiu
  else if(!s.sees){   // vai ao último ponto visto; chegando lá, olha em volta
   s.tok=false;s.mode='circle';const lx=s.lx-s.x,lz=s.lz-s.z,ld=Math.hypot(lx,lz);
   if(ld>1.2){scFace(s,lx,lz,6,dt);vx=Math.sin(s.yaw)*sp*.85;vz=Math.cos(s.yaw)*sp*.85}
   else{s.lookT+=dt;s.yaw+=Math.sin(s.lookT*2.4)*1.6*dt}
  }
  else{
   s.lookT=0;if(!s.tok)s.wt+=dt;s.mt-=dt;
   if(s.snT<=0){s.snT=rr([5,10]);scSound(s,'alert')}   // rosnado/chiado de vez em quando na perseguição
   if(s.dg>0){s.dg-=dt;vx=s.dgx;vz=s.dgz;scFace(s,dx,dz,9,dt)}   // esquiva reativa
   else if(s.flee>0){s.flee-=dt;vx=-ux*sp*1.05;vz=-uz*sp*1.05;scFace(s,vx,vz,9,dt);if(s.flee<=0){s.rage=K.RAGE_T;s.mode='circle'}}   // fuga com pouca vida; volta furioso
   else if(s.mode==='retreat'){vx=-ux*sp*.9;vz=-uz*sp*.9;scFace(s,dx,dz,9,dt);if(s.mt<=0||dist>K.CIRCLE_R+1){s.mode='circle';s.mt=rr(K.MODE_T)}}   // hit-and-run
   else if(s.mode==='commit'){
    s.ct+=dt;
    if(s.ct>K.COMMIT_MAX){s.tok=false;s.wt=0;s.mode='circle';s.mt=rr(K.MODE_T)}
    else{
     let go=false;
     if(s.plan===3&&dist<K.JP_MIN)s.plan=0;else if(s.plan===2&&dist<K.LG_MIN)s.plan=0;else if(s.plan===5&&dist<K.BR_MIN)s.plan=0;   // perto demais pra pular/investir: ataque comum
     let inR=false;   // dentro do alcance do pulo/dash; o dash só sai com o zumbi virado pro jogador (a direção trava no aviso)
     if(s.plan===3){inR=dist<=K.JP_MAX&&dy<2;go=inR}
     else if(s.plan===4){inR=dist<=K.ST_START&&dy<2;go=inR}
     else if(s.plan===6){inR=dist<=K.SL_START&&dy<2;go=inR}
     else if(s.plan===5){inR=dist<=K.BR_START&&dy<2;go=inR}
     else if(s.plan===2){inR=dist<=K.LG_DIST+1&&dy<2;let fa=Math.atan2(dx,dz)-s.yaw;fa=Math.abs(Math.atan2(Math.sin(fa),Math.cos(fa)));go=inR&&fa<.5}
     else go=dist<K.ATK_RANGE&&s.cd<=0&&dy<1.5;
     if(go){scStart(s)}
     else if(inR)scFace(s,dx,dz,9,dt);
     else if(s.plan!==0||dist>K.ATK_RANGE*.85){   // aproxima em zigue-zague (some perto do alvo)
      const h=Math.atan2(dx,dz)+K.ZZ_AMP*Math.sin(s.zt*K.ZZ_HZ*6.2832+s.zp)*Math.min(1,dist/6)*(dist>2.5?1:0);
      vx=Math.sin(h)*sp;vz=Math.cos(h)*sp;scFace(s,vx,vz,9,dt)}
     else scFace(s,dx,dz,9,dt);
    }
   }
   else{   // espera a vez: circula / contorna pelos lados
    if(s.mt<=0){const fp=K.FLANK_P*(LK.s&&LK.s!==s?1.8:1);s.mode=Math.random()<fp?'flank':'circle';s.mt=rr(K.MODE_T);if(Math.random()<.4)s.dir=-s.dir}
    const R0=TK.full?K.WAIT_R:K.CIRCLE_R;
    if(s.mode==='flank'){
     const tyw=T?T.yaw+Math.PI:P.yaw,bx=Math.sin(tyw),bz=Math.cos(tyw),px=tx+(bx*.7+bz*s.dir*.7)*R0,pz=tz+(bz*.7-bx*s.dir*.7)*R0,fx=px-s.x,fz=pz-s.z,fd=Math.hypot(fx,fz);   // ponto atrás/ao lado do jogador
     if(fd>1){vx=fx/fd*sp*.9;vz=fz/fd*sp*.9}else{s.mode='circle';s.mt=rr(K.MODE_T)}
     scFace(s,dx,dz,9,dt)}
    else if(dist>R0+1.2){const h=Math.atan2(dx,dz)+K.ZZ_AMP*Math.sin(s.zt*K.ZZ_HZ*6.2832+s.zp)*Math.min(1,dist/6);vx=Math.sin(h)*sp;vz=Math.cos(h)*sp;scFace(s,vx,vz,9,dt)}
    else{const vr=Math.max(-.6,Math.min(.6,(dist-R0)*.5))*sp;vx=ux*vr-uz*s.dir*K.STRAFE*sp;vz=uz*vr+ux*s.dir*K.STRAFE*sp;scFace(s,dx,dz,9,dt)}
   }
   if(s.st==='chase'&&s.mode!=='commit'&&s.dg<=0){scSep(s);vx+=_sep.x*K.SEP_F;vz+=_sep.z*K.SEP_F;const v=Math.hypot(vx,vz),mx=sp*1.1;if(v>mx){vx*=mx/v;vz*=mx/v}}
  }
  if(s.st==='chase'){
   if(vx||vz){scGo(s,vx,vz,dt);if(s.inst.clip!=='run')s.inst.play('run',.12);spd=K.CHASE_ANIM*Math.max(.5,Math.min(1.4,Math.hypot(vx,vz)/K.SPEED))}
   else{s.blk=0;if(s.inst.clip!=='idle')s.inst.play('idle',.15)}}
 }
 else if(s.st==='attack'){
  const ph=s.ph;spd=s.asp;
  if(ph==='tele'){   // aviso: pausa, brilho e pose; a mira trava nos últimos 40% (dá pra desviar)
   s.pt-=dt;s.tel=Math.max(0,Math.min(1,1-s.pt/s.tl));
   if(s.pt>s.tl*.4){scFace(s,dx,dz,K.TURN_ATK*1.5,dt);if(s.step>0&&dist>K.CLOSE)scMove(s,Math.sin(s.yaw)*K.SPEED*.5*dt,Math.cos(s.yaw)*K.SPEED*.5*dt);
    if(s.at===3){const r=Math.max(K.JP_MIN,Math.min(K.JP_MAX,dist));s.ax=s.x+ux*r;s.az=s.z+uz*r}
    if(s.at===6){s.ax=s.x+Math.sin(s.yaw)*K.SL_REACH;s.az=s.z+Math.cos(s.yaw)*K.SL_REACH}}
   else if(!s.lk){s.lk=1;s.dirx=Math.sin(s.yaw);s.dirz=Math.cos(s.yaw)}
   if(s.at===3)scMark(s,0,s.ax,s.az,K.JP_R,K.JP_R,0,s.tel);
   else if(s.at===4)scMark(s,0,s.x,s.z,K.ST_R,K.ST_R,0,s.tel);
   else if(s.at===6)scMark(s,0,s.ax,s.az,K.SL_R,K.SL_R,0,s.tel);
   else if(s.at===2)scMark(s,1,s.x+Math.sin(s.yaw)*K.LG_DIST*.5,s.z+Math.cos(s.yaw)*K.LG_DIST*.5,1.3,K.LG_DIST,s.yaw,s.tel);
   if(s.pt<=0){s.tel=0;
    if(s.at<2){   // golpe
     if(dist<K.ATK_RANGE+.5&&dy<1.7&&has){scDmg(s,K.DMG*s.dm);if(K.POISON_DUR&&!T)poisonApply(K)}
     if(dist>K.LUNGE_MIN)scMove(s,Math.sin(s.yaw)*K.LUNGE,Math.cos(s.yaw)*K.LUNGE);
     s.ph='act';s.pt=.9;s.asp=K.ATK_SPEED}
    else if(s.at===2){scUnmark(s);s.ph='dash';s.dd=K.LG_DIST;s.hit=0;s.inst.play('run',.05)}
    else if(s.at===5){scUnmark(s);s.bn=K.BR_N;s.ph='sink';s.pt=K.BR_SINK;s.bt=0;scDigPuff(s,8,1.5)}   // fim do aviso: começa a afundar
    else if(s.at===6){scUnmark(s);scSlam(s);s.ph='rec';s.pt=K.SL_REC;s.sq=.95;s.slCd=rr(K.SL_CD);s.inst.play('rec',.03,true)}
    else if(s.at===4){scUnmark(s);scStomp(s);s.ph='rec';s.pt=K.ST_REC;s.sq=K.boss?.97:.78;s.stCd=rr(K.ST_CD);if(K.F.clips&&K.F.clips.rec)s.inst.play('rec',.03,true);else s.inst.play('idle',.1)}
    else{scUnmark(s);if(scBlocked(s,s.ax,s.az))scEnd(s,false);else{s.ph='air';scLaunch(s,s.ax,s.az,K.JP_T);s.inst.play('run',.1)}}
   }
  }
  else if(ph==='act'){
   s.pt-=dt;if(dist>K.CLOSE&&dist<K.ATK_RANGE+1.5)scMove(s,Math.sin(s.yaw)*K.SPEED*.3*dt,Math.cos(s.yaw)*K.SPEED*.3*dt);
   if(s.inst.done||s.pt<=0){
    if(s.cn>1){s.cn--;s.step++;s.tl=s.pt=K.TELE*K.COMBO_TELE*(s.rage>0?.85:1);s.ph='tele';s.lk=0;s.inst.play('attack',.04,true);scPace(s)}   // próximo golpe do combo
    else scEnd(s,true)}
  }
  else if(ph==='dash'){   // investida em linha reta; dano no contato (erra se o jogador está no dash)
   spd=K.CHASE_ANIM*1.6;const st=Math.min(s.dd,K.LG_SPD*dt),m=scMove(s,s.dirx*st,s.dirz*st);s.dd-=st;
   if(!s.hit&&has&&dist<K.BODY_R+(T?T.k.BODY_R:PL_R)+.55&&dy<1.7){s.hit=1;if(T||!(K.IFRAME&&dashT>0)){scDmg(s,K.DMG*K.LG_DMG*s.dm);s.dd=0}}
   if(s.dd<=1e-4||!m){s.ph='rec';s.pt=K.LG_REC;s.lgCd=rr(K.LG_CD);s.inst.play('idle',.1)}
  }
  else if(ph==='sink'){   // afunda na areia (poeira subindo); ainda pode ser atingido até sumir
   s.pt-=dt;const p=Math.max(0,Math.min(1,1-s.pt/K.BR_SINK));s.sk=-K.BR_DEPTH*p*p;spd=K.CHASE_ANIM*1.4;
   scFace(s,dx,dz,9,dt);s.bt-=dt;if(s.bt<=0){s.bt=.05;scDigPuff(s,3,1.2)}
   if(s.pt<=0){s.bur=1;g.visible=false;s.hb.visible=false;s.ph='dig';s.pt=K.BR_TRAVEL;s.bt=0;scDigPuff(s,10,1.8)}
  }
  else if(ph==='dig'){   // debaixo da terra: corre até o jogador deixando um montinho de areia; não pode ser atingido nem travado
   s.pt-=dt;s.bur=1;scFace(s,dx,dz,14,dt);
   if(dist>K.BR_EMERGE){const st=Math.min(dist-K.BR_EMERGE,K.BR_SPD*dt);scMove(s,ux*st,uz*st)}
   scMound(s,1,false);s.bt-=dt;if(s.bt<=0){s.bt=.06;scDigPuff(s,2,.5)}
   if(dist<=K.BR_EMERGE+.05||s.pt<=0){s.ph='rise';s.pt=K.BR_RISE;s.bt=0}
  }
  else if(ph==='rise'){   // o montinho treme e solta poeira: aviso de onde ele vai sair
   s.pt-=dt;scFace(s,dx,dz,14,dt);scMound(s,1+(1-Math.max(0,s.pt)/K.BR_RISE)*.5,true);s.bt-=dt;if(s.bt<=0){s.bt=.04;scDigPuff(s,3,1.4)}
   if(s.pt<=0){   // sai da terra e PULA no jogador
    s.bur=0;g.visible=true;if(s.mound)s.mound.visible=false;s.sk=-K.BR_DEPTH*.55;
    const r=Math.max(1,Math.min(K.BR_JMAX,dist));s.ax=s.x+ux*r;s.az=s.z+uz*r;
    s.ph='air';scLaunch(s,s.ax,s.az,K.BR_JUMP_T);s.inst.play('run',.05);
    scDigPuff(s,16,2.8);const dd=Math.hypot(s.x-P.p.x,s.z-P.p.z);addTrauma(K.BR_SHAKE*.6*Math.max(0,1-dd/20));
   }
  }
  else if(ph==='rec'){spd=1;s.pt-=dt;if(s.pt<=0)scEnd(s,false)}
  else scEnd(s,false)   // ph 'air' sem estar no ar (não deve ocorrer)
 }
 /* animação por distância: de longe o pose só é recalculado em intervalos (o tempo acumula, então a velocidade é a mesma); longe demais não projeta sombra */
 s.aT+=dt;const ai=(s.st==='attack'||s.air||dist<28||s.ck>0)?0:dist<40?.033:dist<60?.066:.1;
 if(ai===0||s.aT>=ai){s.inst.coil=s.ck;s.inst.update(s.aT,s.air?K.CHASE_ANIM*1.3:s.st==='attack'?spd:s.st==='chase'||s.st==='wander'?spd:1);s.aT=0}
 s.inst.mesh.castShadow=dist<55;
 /* pose procedural (não há clipe de pulo/dash): inclinação, balanço e achatamento */
 let lean=0,roll=0,sqT=1;
 if(s.air)lean=Math.max(-.35,Math.min(.35,-s.vy*.03));
 else if(s.st==='attack'){if(s.ph==='tele'){lean=-.3*s.tel;if(s.at===3)sqT=1-.2*s.tel;else if(s.at===4){sqT=1+.09*s.tel;lean=-.4*s.tel}}else if(s.ph==='dash'){lean=.35;roll=Math.sin(s.zt*28)*.12}}
 s.sq+=(sqT-s.sq)*Math.min(1,dt*(sqT<s.sq?12:8));if(Math.abs(s.sq-1)<.004&&sqT===1)s.sq=1;
 if(s.sq!==1){g.scale.y=K.F.SCALE*s.sq;s.sqd=1}else if(s.sqd){g.scale.y=g.scale.x;s.sqd=0}
 if(s.sk&&!s.bur&&s.ph!=='sink'){s.sk+=(0-s.sk)*Math.min(1,dt*14);if(Math.abs(s.sk)<.01)s.sk=0}   // sobe da terra suavemente
 g.rotation.set(lean,s.yaw,roll);g.position.set(s.x,s.y+(s.sk||0),s.z);
 {const f=s.flash>0?(s.flash=Math.max(0,s.flash-dt))/.18:0,t=s.tel,r=Math.max(f*.9,t*.9);   // brilho: vermelho ao levar dano, laranja no aviso
  if(r>0||s.inst.mat.emissive.r)s.inst.mat.emissive.setRGB(r,Math.max(f*.12,t*.32),f*.05)}
 if(s.bur)s.hb.visible=false;if(s.hb.visible){s.hb.position.set(s.x,s.y+K.HB_Y+(s.sk||0),s.z);s.hb.quaternion.copy(cam.quaternion)}
}
function updateScorpions(dt){
 scVoiceTick();pDmgT=Math.max(0,pDmgT-dt);   // o intervalo entre golpes (peixes e escorpiões) tem que contar SEMPRE
 COIL.cd=Math.max(0,COIL.cd-dt);
 if(!SCF&&!SNF&&!ZF){updateQte(dt);return}
 const dwP=desertW(P.p.x,P.p.z),fwP=forestAt(P.p.x,P.p.z),nf=OWM.post.getNightFactor();
 scSpawnT-=dt;
 if(scSpawnT<=0){scSpawnT=1.0+Math.random()*1.1;
  const alive=scs.filter(s=>s.st!=='dead'&&s.k.HAB!=='forest').length,maxN=dwP<.025?0:Math.min(SCP.MAX,Math.round(2+4*sstep(.025,.45,dwP)));
  if((SCF||SNF)&&!PLATE&&alive<maxN){
   let spawned=false;
   // Mais amostras e anel um pouco menor: manchas estreitas/bordas do deserto não ficam sem spawn.
   for(let a=0;a<64&&!spawned;a++){
    const an=Math.random()*6.2832,r=14+Math.random()*34,x=P.p.x+Math.sin(an)*r,z=P.p.z+Math.cos(an)*r,dw=desertW(x,z);
    if(dw<Math.max(.10,dwP<.3?dwP*.55:.22))continue;
    const gy=groundH(x,z),water=waterSurf(x,z);
    if(Number.isFinite(water)&&water>gy+.15)continue;
    if(propHits(x,gy-1.2,z))continue;
    if(mtnStamp(x,z)&&MTf>.35)continue;
    if(scs.some(o=>Math.hypot(o.x-x,o.z-z)<7))continue;
    const kind=SCF&&SNF&&Math.random()<.3?'snake':(SCF?'scorpion':'snake');
    try{spawned=!!scSpawn(x,z,kind)}catch(e){console.error('[OWM] Erro ao criar mob '+kind+':',e);spawned=false}
   }
   // A área pode estar bloqueada por props/água. O próximo ciclo tenta novamente, sem travar o QTE.
  }
 }
 /* ZUMBIS: só nascem de NOITE (fator de noite > .55) com o jogador na floresta; até ZF.MAX vivos, num anel de 18–42 m, também em floresta */
 zSpawnT-=dt;
 if(zSpawnT<=0){zSpawnT=1.4+Math.random()*1.6;
  const ZK=SPC.zombie,aliveZ=scs.filter(s=>s.k===ZK&&s.st!=='dead').length;
  if(ZF&&!PLATE&&nf>.55&&fwP>.45&&aliveZ<ZK.MAX){
   let spawned=false;
   for(let a=0;a<48&&!spawned;a++){
    const an=Math.random()*6.2832,r=18+Math.random()*24,x=P.p.x+Math.sin(an)*r,z=P.p.z+Math.cos(an)*r;
    if(forestAt(x,z)<.6)continue;
    const gy=groundH(x,z),water=waterSurf(x,z);
    if(Number.isFinite(water)&&water>gy+.15)continue;
    if(propHits(x,gy-1.2,z))continue;
    if(mtnStamp(x,z)&&MTf>.35)continue;
    if(scs.some(o=>Math.hypot(o.x-x,o.z-z)<8))continue;
    try{spawned=!!scSpawn(x,z,'zombie')}catch(e){console.error('[OWM] Erro ao criar zumbi:',e);spawned=false}
   }
  }
 }
 scTokens();   // fila de ataque (AI.MAX_ATK)
 for(let i=scs.length-1;i>=0;i--){const s=scs[i];
  const d=Math.hypot(s.x-P.p.x,s.z-P.p.z),forest=s.k.HAB==='forest',engaged=s.st==='chase'||s.st==='attack'||s.st==='coil';
  if(d>SCP.DESPAWN||(!PLATE&&(forest?fwP:dwP)<.1&&d>40&&!engaged)){scRemove(s);continue}
  if(forest&&!PLATE&&s.st!=='dead'){   // amanheceu: zumbi que não está atrás do jogador se desfaz em ~5 s (encolhe no fim)
   if(nf<.25&&!engaged)s.sun=(s.sun||0)+dt;else s.sun=Math.max(0,(s.sun||0)-dt*2);
   if(s.sun>3.5){const k=1-(s.sun-3.5)/1.5;if(k<=0){scRemove(s);continue}s.inst.group.scale.setScalar(s.k.F.SCALE*k)}else if(s.sun>0||s.inst.group.scale.x!==s.k.F.SCALE)s.inst.group.scale.setScalar(s.k.F.SCALE)}
  scUpdate(s,dt)}
 {   // música de luta: liga com inimigo vivo perseguindo/atacando a menos de 16 m; desliga 5 s depois que a luta acaba
  let eng=false;if(P.hp>0)for(const s of scs){if(!s.fr&&!s.tg&&(s.st==='attack'||s.st==='coil'||(s.st==='chase'&&s.sees))&&Math.hypot(s.x-P.p.x,s.z-P.p.z)<16){eng=true;break}}
  if(eng)fightT=5;else fightT=Math.max(0,fightT-dt);
  const f=fightT>0;if(f!==fightOn){fightOn=f;if(OWM.musicFight)OWM.musicFight(f)}}
 updateQte(dt);
}

function hurt(n,soft,msg,impact=false){if(CIN.active)return;if(COIL.on)coilFlash(impact);n=Math.max(0,Number(n)||0)*archetypeMul('damageTaken');if(ALT.block&&!soft&&!COIL.on)n*=1-BLOCK.REDUCE;P.hp-=n;P.hpT=0;addTrauma(soft?.12:0.5);if(anim.hit)anim.hit(soft?.3:Math.min(1,n/8+.25));if(P.hp<=0){/* solta a cobra ANTES de mover o jogador: evita teletransportá-la para o ponto de respawn */coilEnd();JP.fly=false;P.hp=MAXHP;P.st=MAXST;dashT=0;dashCooldown=0;dashReadyAt=0;dashPauseAt=0;dashCdShown=-1;updateDashHUD();P.p.set(spawn[0],spawn[1],spawn[2]);P.vel.set(0,0,0);P.peak=P.p.y;heatReset();poisonReset();for(const q of scs)q.sees=false;toast(msg||'Você morreu!')}refreshHealth()}

/* ---------- Raio ---------- */
function rayB(o,d,max){let x=Math.floor(o.x),y=Math.floor(o.y),z=Math.floor(o.z);const sx=Math.sign(d.x),sy=Math.sign(d.y),sz=Math.sign(d.z),dx=d.x?Math.abs(1/d.x):Infinity,dy=d.y?Math.abs(1/d.y):Infinity,dz=d.z?Math.abs(1/d.z):Infinity;let tx=d.x>0?(x+1-o.x)*dx:d.x<0?(o.x-x)*dx:Infinity,ty=d.y>0?(y+1-o.y)*dy:d.y<0?(o.y-y)*dy:Infinity,tz=d.z>0?(z+1-o.z)*dz:d.z<0?(o.z-z)*dz:Infinity,t=0,n=[0,0,0];while(t<=max){if(y>=0&&y<H&&getB(x,y,z))return{x,y,z,n,t};if(tx<ty&&tx<tz){x+=sx;t=tx;tx+=dx;n=[-sx,0,0]}else if(ty<tz){y+=sy;t=ty;ty+=dy;n=[0,-sy,0]}else{z+=sz;t=tz;tz+=dz;n=[0,0,-sz]}}return null}
function ray(o,d,max){const b=rayB(o,d,max),tm=b?b.t:max;let pv=0;
 for(let t=.2;t<=tm;t+=.2){if(o.y+d.y*t<groundH(o.x+d.x*t,o.z+d.z*t)){let a=pv,c=t;for(let i=0;i<8;i++){const m=(a+c)/2;if(o.y+d.y*m<groundH(o.x+d.x*m,o.z+d.z*m))c=m;else a=m}
   return{terr:true,x:Math.floor(o.x+d.x*c),y:Math.floor(o.y+d.y*c),z:Math.floor(o.z+d.z*c),n:[0,0,0],t:c}}pv=t}
 return b}
function breakAt(h){const b=getB(h.x,h.y,h.z);setB(h.x,h.y,h.z,0);spawnBreakParticles(h.x,h.y,h.z,b);addTrauma(0.35)}
function breakProp(c){
 const key='p'+c.cx+','+c.cz,rem=world.edits[key]||(world.edits[key]={});rem[c.id]=1;if(!mpApplying&&OWM.multiplayer)OWM.multiplayer.localEdit({kind:'prop',cx:c.cx,cz:c.cz,id:c.id});
 const rock=c.k==='rock'||c.k==='bigrock';
 spawnBreakParticles(Math.floor(c.x),Math.floor(c.y0+Math.min(c.hy,2)/2),Math.floor(c.z),rock?3:5);
 addTrauma(rock?.4:.3);meshChunk(c.cx,c.cz);
}

/* ---------- Árvores: 5 socos -> tremem -> caem -> 5 madeiras ----------
   No 1º soco a árvore sai do mesh do chunk (TMPHIDE) e vira um grupo próprio com pivô na base, pra poder tremer e tombar.
   Só ao terminar de cair é que ela é removida de verdade (world.edits). Se o jogador largar a árvore por 8 s, ela volta ao normal. */
const TREE_HITS=5,TREE_DROP=5,TREE_GAP=520,TREE_FALL=1.15,TREE_IDLE=8;let lastTreeHit=0;
const isTreeK=k=>k==='oak'||k==='spruce'||k==='deadoak'||k==='deadspruce'||k==='cherry';
const treeKey=c=>'p'+c.cx+','+c.cz+','+c.id;
function treeDispose(f){scene.remove(f.g);f.g.traverse(o=>{if(o.geometry)o.geometry.dispose()})}
function treeStart(c){
 const ch=chunk(c.cx,c.cz),p=ch.props.find(q=>q.id===c.id);if(!p)return null;
 const hq=HQ(),g=new THREE.Group(),mk=()=>({pos:[],nor:[],uv:[],col:[],idx:[]});
 g.position.set(p.x,p.y,p.z);
 const add=(A,mat)=>{const m=mkTreeMesh(A,mat,true);if(!m)return;scene.remove(m);m.matrixAutoUpdate=true;m.position.set(-p.x,-p.y,-p.z);g.add(m)};
 if(p.pr.cherry){const CA={b:mk(),l:mk()};addCherry(p,0,hq,CA);const cm=cherryMats();add(CA.b,cm.bark);add(CA.l,cm.leaf)}
 else if(p.pr.tree&&p.pr.tree.p1){const PA={b:mk(),c:mk()};addPs1(p,0,hq,PA);const pm=ps1Mats();add(PA.b,pm.bark);add(PA.c,pm.card)}
 else if(p.pr.tree&&p.pr.tree.bt){const BA=mk();addBirch(p,0,hq,BA);add(BA,btMat())}
 else if(p.pr.tree&&p.pr.tree.fp){const FA={pos:[],nor:[],col:[],idx:[]};addForest(p,0,hq,FA);const m=mkForestMesh(FA,true);if(m){scene.remove(m);m.matrixAutoUpdate=true;m.position.set(-p.x,-p.y,-p.z);g.add(m)}}
 else if(p.pr.tree&&TP){const TA={b:mk(),l:mk()};addTree(p,0,hq,TA);const tm=treeMats(hq);add(TA.b,tm.bark);add(TA.l,tm.leaf)}
 else return null;
 g.userData.tint=p.pr&&p.pr.tint||null;
 scene.add(g);return g}
function treeTry(c){
 const now=performance.now();if(now-lastTreeHit<TREE_GAP)return;
 let f=TFX.get(treeKey(c));if(f&&f.state==='fall')return;
 if(f&&f.n===TREE_HITS-1&&invRoom('wood')<TREE_DROP){toast('Inventário cheio');lastTreeHit=now;return}   // o 5º soco derruba: precisa caber as 5 madeiras
 lastTreeHit=now;
 if(!f){const g=treeStart(c);if(!g)return;let dx=c.x-P.p.x,dz=c.z-P.p.z;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
  f={g,c,k:treeKey(c),n:0,sh:9,idle:0,state:'idle',t:0,ax:new THREE.Vector3(dz,0,-dx),dx,dz,amp:.03,pal:OWM.leaves.palette(c.k,g.userData.tint)};TFX.set(f.k,f);TMPHIDE.add(f.k);meshChunk(c.cx,c.cz)}
 f.n++;f.sh=0;f.idle=0;f.amp=.03+.014*f.n;
 spawnBreakParticles(Math.floor(c.x),Math.floor(c.y0+Math.min(c.hy,2.5)*.6),Math.floor(c.z),5);   // lascas do tronco
 OWM.leaves.hit(c,f.pal,f.n>=TREE_HITS?1.6:1);   // folhas/pétalas flutuando da copa (verde, amarelo, rosa... conforme a árvore)
 addTrauma(.14);
 if(f.n>=TREE_HITS){f.state='fall';f.t=0}
}
function treeFinish(f){
 treeDispose(f);TFX.delete(f.k);TMPHIDE.delete(f.k);
 const c=f.c,key='p'+c.cx+','+c.cz,rem=world.edits[key]||(world.edits[key]={});rem[c.id]=1;if(!mpApplying&&OWM.multiplayer)OWM.multiplayer.localEdit({kind:'prop',cx:c.cx,cz:c.cz,id:c.id});meshChunk(c.cx,c.cz);
 for(const d of[1.8,4.2])spawnBreakParticles(Math.floor(c.x+f.dx*d),Math.floor(c.y0),Math.floor(c.z+f.dz*d),2);
 OWM.leaves.landBurst(f);
 addTrauma(.5);
 let got=0;for(let i=0;i<TREE_DROP;i++)if(invAdd('wood',1))got++;
 const ap=dropApples(f);
 toast('+'+got+' Madeira'+(ap?' · '+(ap===1?'caiu 1 maçã':'caíram '+ap+' maçãs')+' (colete no chão)':''));
}
function updateTrees(dt){
 if(!TFX.size)return;
 for(const f of[...TFX.values()]){
  if(f.state==='fall'){
   f.t+=dt;OWM.leaves.fallEmit(f,dt);const u=Math.min(1,f.t/TREE_FALL),k=.12;
   const a=u<k?-.05*Math.sin(u/k*Math.PI):1.53*Math.pow((u-k)/(1-k),2);   // estala pra trás e tomba acelerando
   f.g.quaternion.setFromAxisAngle(f.ax,a);
   if(u>=1)treeFinish(f);
  }else{
   f.sh+=dt;f.idle+=dt;f.g.quaternion.setFromAxisAngle(f.ax,f.amp*Math.sin(f.sh*38)*Math.exp(-f.sh*5));
   if(f.idle>TREE_IDLE){treeDispose(f);TFX.delete(f.k);TMPHIDE.delete(f.k);meshChunk(f.c.cx,f.c.cz)}
  }
 }
}
function treesReset(){for(const f of TFX.values())treeDispose(f);TFX.clear();TMPHIDE.clear();OWM.leaves.reset()}
function unstuck(){if(!hits(P.p.x,P.p.y,P.p.z))return;for(let r=1;r<=8;r++)for(let a=0;a<8;a++){const x=P.p.x+Math.cos(a*.785)*r,z=P.p.z+Math.sin(a*.785)*r;if(!hits(x,P.p.y,z)){P.p.x=x;P.p.z=z;return}}for(let i=0;i<H&&hits(P.p.x,P.p.y,P.p.z);i++)P.p.y++}

/* ---------- Combo M1 / M2 ----------
   M1 = golpe leve (6 de dano, rápido), M2 = golpe pesado (8 de dano, lento). Encadear dentro da janela de combo troca o corte:
     M1 → alterna entre 2 cortes (diagonal ↙ e varrida →←)
     M2 de abertura → estocada · M2 depois de M1 → machadada vertical · M2 depois de M2 → corte ascendente
     M2 como 4º golpe em diante = FINISHER (mais partículas e tremor de câmera; o combo reinicia)
   Com faca o dano cai no instante do corte da animação; sem arma, jab (M1) e cruzado (M2) com um pequeno atraso. */
const CMB={n:0,prev:0,t:0,fist:null,ut:0,queue:null,hitStop:0};
/* ---------- Modo CHUTE / BLOCK (botão de troca ⇄, tecla G) ----------
   Ligado, o M1 vira CHUTE (14 de dano, sem animação por enquanto) e o M2 vira BLOCK (segurar = recebe 25% menos dano de golpes). Desligado, volta ao combo M1/M2. */
const ALT={on:false,kickCd:0,block:false},KICK={DMG:14,CD:.55,FORCE:4.6},BLOCK={REDUCE:.25};
function altSync(){
 const b1=$('#bM1'),b2=$('#bM2'),sw=$('#bSwap');
 const lab=(b,on,txt,aria)=>{if(!b)return;b.classList.toggle('alt',on);const ke=b.querySelector('.cmb-k'),de=b.querySelector('.cmb-d');if(ke)ke.textContent=txt[0];if(de)de.textContent=txt[1];b.setAttribute('aria-label',aria)};
 lab(b1,ALT.on,ALT.on?['CHUTE',String(KICK.DMG)]:['M1','6'],ALT.on?'Chute — '+KICK.DMG+' de dano':'M1 — golpe leve (6 de dano)');
 lab(b2,ALT.on,ALT.on?['BLOCK','-'+Math.round(BLOCK.REDUCE*100)+'%']:['M2','8'],ALT.on?'Block — segure para receber '+Math.round(BLOCK.REDUCE*100)+'% menos dano':'M2 — golpe pesado (8 de dano)');
 if(b2)b2.classList.toggle('blocking',ALT.block);
 if(sw){sw.classList.toggle('on',ALT.on);sw.setAttribute('aria-pressed',String(ALT.on))}
}
function blockSet(v){v=!!v&&ALT.on&&state==='play'&&!COIL.on;if(ALT.block===v)return;ALT.block=v;if(anim.block)anim.block(v);altSync()}
function altToggle(){if(state!=='play'||COIL.on)return;ALT.on=!ALT.on;if(!ALT.on)blockSet(false);altSync();}
function kickPress(){
 if(state!=='play'||COIL.on||tablePlacement||CN.mount||ALT.kickCd>0)return false;
 ALT.kickCd=KICK.CD;
 const dmg=KICK.DMG*archetypeMul('punchDamage'),stg=scAim();let pos=null;
 if(stg){scHurt(stg.s,dmg,KICK.FORCE);pos={x:stg.s.x,y:stg.s.y+.45,z:stg.s.z}}
 else{const ft=rayFish(eye,fwd);if(ft&&ft.f){fishHurt(ft.f,dmg);const fp=ft.f.group.position;pos={x:fp.x,y:fp.y,z:fp.z}}}
 if(pos){spawnImpactFx(pos,2,false);CMB.hitStop=Math.max(CMB.hitStop,.045)}
 addTrauma(pos?.22:.04);scSwingReact();
 const el=$('#combo-ui');if(el){el.className='';void el.offsetWidth;el.textContent='CHUTE\n'+Math.round(dmg)+' dano';el.className='on hv';clearTimeout(CMB.ut);CMB.ut=setTimeout(()=>el.classList.remove('on'),900)}
 return true;
}
const m1Press=()=>ALT.on?kickPress():comboPress(1);
const m2Down=()=>ALT.on?blockSet(true):comboPress(2);
const m2Up=()=>{if(ALT.block)blockSet(false)};
function comboArmed(){return !!(OWM.weapon.id&&WPS[OWM.weapon.id])}
function comboPress(kind,fromBuffer=false){
 if(state!=='play'||COIL.on||tablePlacement||CN.mount||!anim.combo)return false;
 const armed=comboArmed(),chain=CMB.t>0,step=chain?CMB.n+1:0,prev=chain?CMB.prev:0;
 const idx=kind===1?step%2:(step===0?2:(prev===1?3:4)),fin=kind===2&&step>=3;
 if(!anim.combo(kind,idx,armed,step)){
  if(!fromBuffer&&CMB.t>0)CMB.queue={kind,t:.3};
  return false;
 }
 CMB.queue=null;CMB.n=step;CMB.prev=kind;CMB.t=kind===1?.9:1.15;
 if(fin){CMB.n=0;CMB.prev=0;CMB.t=0}
 // Pequeno avanço na direção do golpe: M2 compromete um pouco mais que M1.
 const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw),lunge=kind===1?.72:1.08;
 P.vel.x+=fx*lunge;P.vel.z+=fz*lunge;
 if(!armed)CMB.fist={kind,step,idx,t:(anim.studioHit&&anim.studioHit(kind===1?'m1':'m2'))||(kind===1?.15:.24)};
 comboUi(step+1,kind,fin);scSwingReact();return true;
}
function comboDamage(kind){
 const id=OWM.weapon&&OWM.weapon.id;
 const base=id==='knife_intermediate'?(kind===1?15:22):
  (id==='knife'||id==='stone_knife')?(kind===1?24:28):(kind===1?6:8);
 return base*archetypeMul('punchDamage');
}
function comboUi(count,kind,fin){
 const el=$('#combo-ui');if(!el)return;
 el.className='';void el.offsetWidth;
 el.textContent=fin?'FINISHER!':(count>1?'COMBO x'+count:(kind===1?'M1':'M2'))+'\n'+Math.round(comboDamage(kind))+' dano';
 el.className='on'+(kind===2?' hv':'')+(fin?' fin':'');
 clearTimeout(CMB.ut);CMB.ut=setTimeout(()=>el.classList.remove('on'),fin?1300:1100);
}
function slashFx(idx,kind,fin,imp){
 const el=$('#slashfx');if(!el)return;
 el.className='';void el.offsetWidth;
 el.className=(imp?'imp':'s'+idx)+(kind===2?' hv':'')+(fin?' fin':'')+' go';   // imp = clarão de impacto (soco), sem traço de corte
}
/* ---------- Partículas de impacto estilo Roblox ----------
   Referência: ParticleEmitter do Roblox. Sprites que olham pra câmera (nada de cubos), textura de estrela de 4 pontas / círculo suave / anel,
   mistura aditiva ("neon" + bloom), tamanho que cresce rápido e some (0 → pico → 0), transparência no fim, giro e vida curta (0,15–0,6 s).
   Um impacto = clarão central + estrelas/faíscas + anel de choque (+ poeira). Pool de sprites: nada é alocado por golpe. */
const RBX={tex:null,pool:[],live:[],MAX:320};
function rbxTextures(){
 if(RBX.tex)return RBX.tex;
 const mk=draw=>{const c=document.createElement('canvas');c.width=c.height=128;draw(c.getContext('2d'));return new THREE.CanvasTexture(c)};
 RBX.tex={
  glow:mk(x=>{const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,255,255,.75)');g.addColorStop(.6,'rgba(255,255,255,.18)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128)}),
  star:mk(x=>{const g=x.createRadialGradient(64,64,0,64,64,36);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);
   x.fillStyle='#fff';x.beginPath();x.moveTo(64,2);x.quadraticCurveTo(70,58,126,64);x.quadraticCurveTo(70,70,64,126);x.quadraticCurveTo(58,70,2,64);x.quadraticCurveTo(58,58,64,2);x.fill()}),
  ring:mk(x=>{const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.68,'rgba(255,255,255,0)');g.addColorStop(.86,'rgba(255,255,255,1)');g.addColorStop(.96,'rgba(255,255,255,.25)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128)})
 };
 return RBX.tex;
}
/* o:{g gravidade, drag, spin rad/s, ring (cresce e some), grow (fumaça: cresce), norm (mistura normal em vez de aditiva), peak (fração da vida em que atinge o tamanho máx.)} */
function rbxAdd(kind,color,x,y,z,vx,vy,vz,life,size,o){
 if(RBX.live.length>=RBX.MAX)return;
 const T=rbxTextures();o=o||{};
 let sp=RBX.pool.pop();
 if(!sp){sp=new THREE.Sprite(new THREE.SpriteMaterial({map:T.glow,transparent:true,depthWrite:false,fog:false}));sp.frustumCulled=false}
 const m=sp.material;m.map=T[kind];m.color.setHex(color);m.blending=o.norm?THREE.NormalBlending:THREE.AdditiveBlending;m.rotation=Math.random()*6.283;m.opacity=0;
 sp.position.set(x,y,z);sp.scale.set(.001,.001,1);sp.visible=true;scene.add(sp);
 RBX.live.push({sp,vx,vy,vz,life,l0:life,size,g:o.g||0,drag:o.drag||0,spin:o.spin||0,ring:!!o.ring,grow:!!o.grow,peak:o.peak||.18});
}
function rbxUpdate(dt){
 for(let i=RBX.live.length-1;i>=0;i--){
  const p=RBX.live[i];p.life-=dt;
  if(p.life<=0){scene.remove(p.sp);p.sp.visible=false;RBX.pool.push(p.sp);RBX.live[i]=RBX.live[RBX.live.length-1];RBX.live.pop();continue}
  const a=1-p.life/p.l0,k=Math.exp(-p.drag*dt),m=p.sp.material;
  p.vx*=k;p.vz*=k;p.vy=p.vy*k-p.g*dt;
  p.sp.position.x+=p.vx*dt;p.sp.position.y+=p.vy*dt;p.sp.position.z+=p.vz*dt;
  let sz,op;
  if(p.ring){sz=p.size*(1-Math.pow(1-a,3));op=Math.pow(1-a,1.4)}
  else if(p.grow){sz=p.size*(.45+.55*a);op=Math.min(1,a*6)*(1-a)*.8}
  else{sz=p.size*(a<p.peak?a/p.peak:Math.pow(1-(a-p.peak)/(1-p.peak),1.2));op=Math.min(1,(1-a)*2.6)}
  p.sp.scale.set(Math.max(.01,sz),Math.max(.01,sz),1);m.opacity=op;m.rotation+=p.spin*dt;
 }
}
const R4=()=>Math.random()*2-1;
/* explosão base: clarão + estrela grande + anel + estrelas/faíscas em esfera (ou em leque, se vier dir) + pontinhos de brilho.
   pal={core,ring,st:[cores]}; q={n,sp,size,flash,ring,fin,dir:[fx,fz,rx,rz,lat,up,fw]} */
function rbxHit(o,pal,q){
 rbxAdd('glow',pal.core,o.x,o.y,o.z,0,0,0,.15,q.flash,{peak:.3});
 rbxAdd('star',pal.core,o.x,o.y,o.z,0,0,0,.18,q.flash*.85,{spin:5*(Math.random()<.5?-1:1),peak:.3});
 if(q.ring)rbxAdd('ring',pal.ring,o.x,o.y,o.z,0,0,0,q.fin?.34:.24,q.ring,{ring:1});
 for(let i=0;i<q.n;i++){
  let vx,vy,vz;const s=q.sp*(.45+Math.random()*.75);
  if(q.dir){const d=q.dir;const lat=d[4]*s*.7+R4()*q.sp*.35,up=d[5]*s*.5+(Math.random()-.2)*q.sp*.5,fw=d[6]*s*Math.random();vx=d[2]*lat+d[0]*fw;vy=up;vz=d[3]*lat+d[1]*fw}
  else{const u=R4(),a=Math.random()*6.283,r=Math.sqrt(1-u*u);vx=r*Math.cos(a)*s;vy=u*s*.8+1;vz=r*Math.sin(a)*s}
  rbxAdd('star',pal.st[i%pal.st.length],o.x+R4()*.08,o.y+R4()*.08,o.z+R4()*.08,vx,vy,vz,.28+Math.random()*.3,q.size*(.55+Math.random()*.9),{g:7,drag:3.2,spin:R4()*9});
 }
 for(let i=0;i<Math.ceil(q.n*.6);i++){
  const u=R4(),a=Math.random()*6.283,r=Math.sqrt(1-u*u),s=q.sp*.55*(.4+Math.random()*.7);
  rbxAdd('glow',pal.st[(i+1)%pal.st.length],o.x,o.y,o.z,r*Math.cos(a)*s,u*s+.6,r*Math.sin(a)*s,.4+Math.random()*.25,q.size*.55,{g:4,drag:4});
 }
}
function rbxDust(o,n,col){for(let i=0;i<n;i++)rbxAdd('glow',col||0xb9b2a2,o.x+R4()*.18,o.y-.1,o.z+R4()*.18,R4()*1.4,Math.random()*1.1+.3,R4()*1.4,.5+Math.random()*.3,.5+Math.random()*.3,{norm:1,grow:1,drag:2.2})}
const RPAL={
 k1:{core:0xffffff,ring:0x8fd0ff,st:[0xffffff,0xbfe8ff,0x8fd0ff]},      // faca M1: branco/azul-gelo
 k2:{core:0xfff2c0,ring:0xffb04a,st:[0xffd36b,0xff9a3c,0xff5a2a]},      // faca M2: dourado/laranja
 f1:{core:0xffffff,ring:0xffe08a,st:[0xffffff,0xffe9a8,0xffd25a]},      // soco M1
 f2:{core:0xfff0c8,ring:0xff9a3c,st:[0xffe08a,0xff9a3c,0xff5a2a]},      // soco M2
 lmb:{core:0xffffff,ring:0xfff0b0,st:[0xffffff,0xfff0b0,0xffd870]},     // ataque básico
 mob:{core:0xffffff,ring:0xff4a3a,st:[0xffffff,0xff7a6a,0xd62a2a]},     // golpe do zumbi/cobra/escorpião
 dash:{core:0xffffff,ring:0xbfe8ff,st:[0xffffff,0xd8f1ff,0x8fd0ff]},
 land:{core:0xfff3d6,ring:0xd9c9a0,st:[0xffffff,0xf0e0b8,0xc9b48a]},   // dash: branco/azul-gelo
 jp:{core:0xfff2c0,ring:0xff9a3c,st:[0xffe08a,0xff7a1a,0xff3a10]}      // jetpack: fogo
};
/* soco sem faca: clarão + estrelas em esfera + poeira + anel de choque no ponto do impacto */
function spawnImpactFx(pos,kind,fin){
 rbxHit(pos,kind===1?RPAL.f1:RPAL.f2,{n:(kind===1?9:13)+(fin?10:0),sp:kind===1?4.6:6.4,size:kind===1?.26:.32,flash:kind===1?.9:1.3,ring:kind===1?1.2:(fin?2.8:1.9),fin});
 rbxDust(pos,kind===1?3:5);
}
/* faca: faíscas em leque no ponto do impacto (ou no ar, se errou), cor/quantidade variam com M1/M2/finisher */
function spawnComboFx(pos,kind,idx,fin,landed){
 const yaw=P.yaw,fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw);
 const dirs=[[-.6,-.5],[-1,0],[0,0],[0,-1],[.8,.9]][idx]||[0,0];
 const pal=kind===1?RPAL.k1:RPAL.k2;
 const o=pos||{x:eye.x+fx*1.5+rx*dirs[0]*.4,y:eye.y-.1+dirs[1]*.3,z:eye.z+fz*1.5+rz*dirs[0]*.4};
 const dir=[fx,fz,rx,rz,dirs[0],dirs[1],idx===2?1.6:.4];
 if(landed)rbxHit(o,pal,{n:(kind===1?8:12)+(fin?10:0),sp:kind===1?4.8:6.4,size:kind===1?.26:.33,flash:kind===1?1:1.5,ring:kind===1?1.3:(fin?2.8:1.9),fin,dir});
 else rbxHit(o,pal,{n:4+(fin?6:0),sp:kind===1?4:5.2,size:.2,flash:.35,ring:0,fin,dir});   // errou: só um brilho curto no ar
 if(landed)for(let i=0;i<5;i++)rbxAdd('glow',0x9bd23a,o.x,o.y,o.z,R4()*3,Math.random()*2.6+.8,R4()*3,.45+Math.random()*.3,.2,{g:9,drag:2});   // verde do alvo
 if(fin){for(let i=0;i<12;i++){const a=i/12*6.283;rbxAdd('star',pal.st[1],o.x,Math.max(o.y-.3,eye.y-1.4),o.z,Math.cos(a)*6.5,.6,Math.sin(a)*6.5,.45,.3,{drag:3,spin:R4()*6})}}   // onda de choque do finisher
}
/* ataque básico (LMB): impacto curto e discreto no alvo */
function spawnLmbFx(pos,armed){rbxHit(pos,RPAL.lmb,{n:armed?6:5,sp:armed?4.2:3.6,size:.22,flash:armed?.8:.7,ring:armed?1:.8,fin:false});if(!armed)rbxDust(pos,2)}
function lmbHitFx(pos){if(anim.strikeInfo&&anim.strikeInfo())return;spawnLmbFx(pos,comboArmed())}
/* golpe do zumbi (e de outros inimigos): impacto vermelho no corpo de quem apanhou; no jogador, um pouco à frente dos olhos pra não encher a tela */
function spawnMobHitFx(s){
 let pos;
 if(s.tg)pos={x:s.tg.x,y:s.tg.y+.45,z:s.tg.z};
 else{const dx=s.x-P.p.x,dz=s.z-P.p.z,l=Math.hypot(dx,dz)||1;pos={x:P.p.x+dx/l*.55,y:eye.y-.5,z:P.p.z+dz/l*.55}}
 rbxHit(pos,RPAL.mob,{n:8,sp:4.2,size:.22,flash:.9,ring:1.3,fin:false});
}
function comboHit(kind,step,idx){
 const fin=kind===2&&step>=3,dmg=comboDamage(kind);
 const stg=scAim();let pos=null;
 if(stg){scHurt(stg.s,dmg,fin?7.2:(kind===2?5.2:3.8));pos={x:stg.s.x,y:stg.s.y+.45,z:stg.s.z}}
 else{const ft=rayFish(eye,fwd);if(ft&&ft.f){fishHurt(ft.f,dmg);const fp=ft.f.group.position;pos={x:fp.x,y:fp.y,z:fp.z}}}
 if(comboArmed()){slashFx(idx,kind,fin);spawnComboFx(pos,kind,idx,fin,!!pos)}   // faca: traço de corte + faíscas
 else if(pos){slashFx(idx,kind,fin,true);spawnImpactFx(pos,kind,fin)}            // punho: só impacto
 if(pos)CMB.hitStop=Math.max(CMB.hitStop,fin?.078:(kind===2?.052:.032));
 addTrauma(pos?(kind===1?.14:.28)+(fin?.35:0):(fin?.2:.05));
}
function comboTick(dt){
 if(ALT.kickCd>0)ALT.kickCd-=dt;if(ALT.block&&COIL.on)blockSet(false);
 if(CMB.t>0){CMB.t-=dt;if(CMB.t<=0){CMB.n=0;CMB.prev=0;CMB.queue=null}}
 if(COIL.on){CMB.fist=null;CMB.queue=null;return}
 if(CMB.queue){CMB.queue.t-=dt;if(CMB.queue.t<=0)CMB.queue=null;else{const q=CMB.queue;if(comboPress(q.kind,true))CMB.queue=null}}
 const si=anim.strikeInfo&&anim.strikeInfo();
 if(si)comboHit(si.kind,si.step,si.idx);
 if(CMB.fist){CMB.fist.t-=dt;if(CMB.fist.t<=0){const f=CMB.fist;CMB.fist=null;comboHit(f.kind,f.step,f.idx)}}
}

/* ---------- Loop ---------- */
const eye=new THREE.Vector3(),fwd=new THREE.Vector3();let ma=0,fc=0,ft0=performance.now(),camLean=0,camLand=0;
function tick(dt,realDt=dt){if(CIN.active){cinTick(dt);return}if(DSC.active){desertCineTick(dt);post.setGround(groundH(P.p.x,P.p.z));post.update(dt);stream(P.p.x>>4,P.p.z>>4,S.dist,1);return}lockTick(dt);physics(dt);scCollide(dt);updateDashFX(dt);updateHeat(dt,realDt);updateBiome(dt);if(DSC.active){desertCineTick(dt);post.setGround(groundH(P.p.x,P.p.z));post.update(dt);stream(P.p.x>>4,P.p.z>>4,S.dist,1);return}if(OWM.cherryFog)OWM.cherryFog.update(dt,cWt,forestWt);updatePoison(dt);updateScorpions(dt);lockMarker(dt);playerWake(dt);eye.set(P.p.x,P.p.y+1.62,P.p.z);const cp=Math.cos(P.pitch);fwd.set(-Math.sin(P.yaw)*cp,Math.sin(P.pitch),-Math.cos(P.yaw)*cp);comboTick(dt);hit=ray(eye,fwd,REACH);phit=rayProp(eye,fwd,REACH);if(phit&&hit&&hit.t<phit.t)phit=null;else if(phit)hit=null;
const stg=scAim(),scFirst=stg&&(!hit||hit.terr||stg.t<hit.t+.6)&&(!phit||stg.t<phit.t+.6),wantHit=(breaking||punchT>0)&&!COIL.on&&!CN.mount;const fishTarget=wantHit?rayFish(eye,fwd):null;punchT=Math.max(0,punchT-dt);
if(wantHit&&scFirst){scPunch(stg.s);mining=breaking;prog=0;tgtKey='';crackMesh.visible=false}
else if(wantHit&&fishTarget&&(!hit||hit.terr||fishTarget.t<hit.t)&&(!phit||fishTarget.t<phit.t)){fishPunch(fishTarget.f);mining=false;prog=0;tgtKey='';crackMesh.visible=false}
else if(breaking&&phit&&isTreeK(phit.c.k)){mining=true;prog=0;tgtKey='';crackMesh.visible=false;treeTry(phit.c)}
else if(breaking&&phit){const c=phit.c,key='p'+c.cx+','+c.cz+','+c.id;if(key!==tgtKey){tgtKey=key;prog=0}prog+=dt;mining=true;const stage=Math.min(9,Math.floor(prog/c.hard*10)),ch=Math.min(c.hy,2.2);crackMesh.visible=true;crackMesh.scale.set(c.hx*2+.06,ch,c.hz*2+.06);crackMesh.position.set(c.x,c.y0+ch/2,c.z);if(crackMat.map!==crackTextures[stage]){crackMat.map=crackTextures[stage];crackMat.needsUpdate=true}if(prog>=c.hard){breakProp(c);prog=0;tgtKey='';crackMesh.visible=false}}
else if(breaking&&hit&&!hit.terr&&hit.y>0){const key=hit.x+','+hit.y+','+hit.z;if(key!==tgtKey){tgtKey=key;prog=0}prog+=dt;mining=true;const hard=BL[getB(hit.x,hit.y,hit.z)].h;const stage=Math.min(9,Math.floor((prog/hard)*10));crackMesh.visible=true;crackMesh.scale.set(1,1,1);crackMesh.position.set(hit.x+.5,hit.y+.5,hit.z+.5);if(crackMat.map!==crackTextures[stage]){crackMat.map=crackTextures[stage];crackMat.needsUpdate=true}if(prog>=hard){breakAt(hit);prog=0;tgtKey=''}}else{mining=false;prog=0;tgtKey='';crackMesh.visible=false}if(mining)swT+=dt*12;const sp=Math.hypot(P.vel.x,P.vel.z);bobT+=sp*dt*1.7;const bobA=S.bob&&P.og?Math.min(1,sp/4.8)*(isSprint?1.3:1):0,bobY=Math.sin(bobT*2)*.02*bobA;const lateral=P.vel.x*Math.cos(P.yaw)-P.vel.z*Math.sin(P.yaw);camLean+=(cl(-lateral*.006,-.045,.045)-camLean)*(1-Math.exp(-dt*9));if(P.landV>1)camLand=Math.max(camLand,cl(P.landV*.0035,0,.105));camLand*=Math.exp(-dt*12);if(playingAnim){animTime+=dt;if(animTime>playingAnim.duration){playingAnim=null;animTime=0}}if(tp3){const robloxShift=!!S.shiftLock&&(S.shiftStyle===1||S.shiftStyle===2),shoulder=S.shiftLock?(robloxShift?1.05:.68):0,sx=Math.cos(P.yaw)*shoulder,sz=-Math.sin(P.yaw)*shoulder;let t=0;while(t<(S.shiftLock?(robloxShift?4.8:4.15):3.5)){const q=t+.25,x=eye.x-fwd.x*q+sx,y=eye.y-fwd.y*q,z=eye.z-fwd.z*q+sz;if(getB(Math.floor(x),Math.floor(y),Math.floor(z))||y<groundH(x,z)+.15)break;t=q}cam.position.set(eye.x-fwd.x*t+sx,eye.y-fwd.y*t+bobY-camLand,eye.z-fwd.z*t+sz);}else{cam.position.copy(eye);cam.position.x-=Math.sin(P.yaw)*.03;cam.position.z-=Math.cos(P.yaw)*.03;   /* câmera um pouco à frente do pescoço: olhando pra baixo aparece o tronco */
cam.position.y+=anim.fx.dip+bobY-camLand;cam.position.x+=Math.cos(bobT)*.008*bobA}cam.rotation.set(P.pitch,P.yaw,(tp3?camLean*.7:anim.fx.roll+camLean));const targetFov=S.fov+cl((sp-4.8)*2.4,0,8)+((dashT>0||dashRunOn)?2.5:0);cam.fov+=(targetFov-cam.fov)*(1-Math.exp(-dt*8));cam.updateProjectionMatrix();updateTablePlacement();if(COIL.on){const ct=performance.now()*.001;cam.position.x+=Math.sin(ct*31)*COIL.SHAKE;cam.position.y+=Math.cos(ct*23)*COIL.SHAKE*.62;cam.rotation.z+=Math.sin(ct*27)*.006;}updateCamShake(dt);try{anim.update(dt,{inGame:true,lockFwd:!!S.shiftLock&&S.shiftStyle===2,attack:(breaking||punchT>0)&&!CN.mount,sprint:isSprint,tp3,p:P.p,vel:P.vel,og:P.og,mining,swT,cp:P.pitch,landV:P.landV,coil:COIL.on,dash:dashT>0?1-dashT/DASH.DURATION:-1,custom:playingAnim?{anim:playingAnim,time:animTime}:null});}catch(e){const em=String(e&&e.message||e);if((tick.ae=tick.ae||{})[em]===undefined&&Object.keys(tick.ae).length<4){tick.ae[em]=1;console.error('[OWM] anim.update: '+em+' | '+String(e&&e.stack||'').split('\n').slice(0,4).join(' <- '))}}P.landV=0;jpUpdate(dt);updateParticles(dt);updateTrees(dt);OWM.leaves.update(dt);updateLeafDrops(dt);updateAppleDrops(dt);updateFish(dt);updatePlacedTables(dt);updateBenchPrompt();{const dzn=sstep(.18,.55,desertW(P.p.x,P.p.z));OWM.sand.update(dt,dzn);if(OWM.wind)OWM.wind.update(dt,dzn,waterSurf(P.p.x,P.p.z)>P.p.y+1.55)}post.setGround(groundH(P.p.x,P.p.z));post.update(dt);updateWater(dt);if((saveT+=dt)>20){saveT=0;saveWorld()}updateCollect(dt);stream(P.p.x>>4,P.p.z>>4,S.dist,2);}

let last=performance.now();
addEventListener('visibilitychange',()=>{last=performance.now()});
function loop(now){requestAnimationFrame(loop);const raw=Math.max(0,now-last),realDt=document.hidden?0:raw/1000,dt=Math.min(.05,raw/1000);last=now;if(state!=='play'&&QTE.shown)qteVis(false);if(state!=='play'&&HT.fx>0){HT.fx=0;heatFx(0,false)}if(state==='play'){post.sample(raw);let simDt=dt;if(CMB.hitStop>0){CMB.hitStop=Math.max(0,CMB.hitStop-realDt);simDt*=.16}tick(simDt,realDt)}else if(state!=='play'&&CMB.hitStop>0)CMB.hitStop=0;else if(state==='menu'){ma+=dt*.08;if(menuSand(dt)){cam.position.set(0,40,0);cam.lookAt(0,40,-10);post.update(dt)}else{const h=hgt(0,0);cam.position.set(Math.cos(ma)*26,h+16,Math.sin(ma)*26);cam.lookAt(0,h-2,0);anim.update(dt,{inGame:false});post.setGround(h);post.update(dt);stream(0,0,4,2);}}else if(state==='pause'){stream(P.p.x>>4,P.p.z>>4,S.dist,1);post.update(dt)}if(state==='animstudio'){if(OWM.animstudio)OWM.animstudio.tick(dt)}else if(state==='animedit'){if(OWM.animedit)OWM.animedit.tick(dt)}else if(state==='creator'){if(OWM.creator)OWM.creator.tick(dt)}else if(state==='mini'){if(OWM.mini)OWM.mini.tick(dt)}else{post.render();}if(OWM.multiplayer)OWM.multiplayer.tick(dt);if(++fc>=30){const t=performance.now();const fp=fc*1000/(t-ft0);if(S.fps)$('#fps').textContent=Math.round(fp)+' FPS · '+post.info();fc=0;ft0=t}}
addEventListener('beforeunload',saveWorld);
applyAll();showMenu();requestAnimationFrame(loop);
})();