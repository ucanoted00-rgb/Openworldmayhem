/* Open World Mayhem — criador de personagem.
   Esquerda: visualizador 3D do personagem completo (arraste p/ girar, role/pinça p/ aproximar).
   Direita: opções por categoria (Looks, Pele, Cabelo, Camisa, Calça, Sapatos).
   Reaproveita o MESMO avatar do jogo (OWM.anim.av): enquanto a tela está aberta ele é movido p/ uma cena própria, e devolvido ao fechar. */
(()=>{
const {E,B,mkScreen,go}=OWM,SK=OWM.skin,C=SK.colors,anim=OWM.anim,HAIR=OWM.hair;
const av=anim.av;

/* ---------- paletas ---------- */
const PAL={
 skin:['#fefcac','#fbe3d0','#f6d8c4','#f0c89a','#e8b98a','#dc9659','#c68a5a','#a8693f','#8a5030','#6b3b22','#4a2a18','#9aa0b4','#8fd0a0'],
 hair:['#0d0d12','#1a1109','#3b2a1a','#5a3a20','#7a4a24','#a8693f','#d9a441','#e8cc7a','#f2e8c9','#c8c8d0','#8a8a96','#b5301f','#e8579a','#8e3b6d','#2a6fd6','#1e1ea0','#2fa36b','#8e5bd6'],
 cloth:['#ffffff','#ebebeb','#8a8a96','#2b2f3a','#15151b','#c8281a','#e8301f','#e29b28','#e8cc7a','#28c83c','#287f47','#1fa8c9','#2f6fb5','#1e1ea0','#8e5bd6','#e8579a','#6e4a1e','#4b3a2a'],
};
const CATS=[['looks','Looks'],['skin','Pele'],['hair','Cabelo'],['shirt','Roupa'],['pants','Calça'],['sash','Faixa'],['shoes','Sapatos']];
const PAL_OF=k=>k==='skin'?PAL.skin:k==='hair'?PAL.hair:PAL.cloth;
/* para onde a câmera olha em cada categoria: [altura do alvo, altura da região visível, largura da região] */
const FOCUS={looks:[.93,2.15,1.0],skin:[.93,2.15,1.0],hair:[1.7,.72,.6],shirt:[1.2,1.3,.95],pants:[.55,1.3,.7],sash:[1.15,1.45,1.0],shoes:[.2,.75,.7]};

/* ---------- DOM ---------- */
const SC=mkScreen('creator',null,'solid creator');
const left=E('div','cr-left',null,SC),cv=E('canvas','',null,left);
E('div','cr-hint','Arraste para girar • role para aproximar',left);
const tools=E('div','cr-ltools',null,left);
const right=E('div','cr-right',null,SC);
E('h2','cr-title','Criar personagem',right);
const tabsEl=E('div','cr-tabs',null,right),body=E('div','cr-body',null,right),act=E('div','cr-actions',null,right);
let curTab='looks',opts={},snap=null,opened=false;

/* ---------- 3D ---------- */
let pvR=null,pvScene=null,pvCam=null,platform=null;
function ensureGL(){
 if(pvR)return;
 pvR=new THREE.WebGLRenderer({canvas:cv,alpha:true,antialias:true});
 pvR.setPixelRatio(Math.min(2,devicePixelRatio));pvR.outputEncoding=THREE.sRGBEncoding;pvR.setClearColor(0x000000,0);
 pvScene=new THREE.Scene();
 pvCam=new THREE.PerspectiveCamera(30,1,.1,30);
 pvScene.add(new THREE.HemisphereLight(0xffffff,0x4a5570,1.15));
 const key=new THREE.DirectionalLight(0xfff0d8,1.25);key.position.set(2.5,4,3.5);pvScene.add(key);
 const rim=new THREE.DirectionalLight(0x88aaff,.7);rim.position.set(-3,2.5,-3);pvScene.add(rim);
 /* plataforma + sombra de contato */
 platform=new THREE.Group();
 const disc=new THREE.Mesh(new THREE.CylinderGeometry(.62,.66,.05,40),new THREE.MeshLambertMaterial({color:0x1b1d2b}));disc.position.y=-.03;platform.add(disc);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.6,.012,6,48),new THREE.MeshBasicMaterial({color:0xe03a4c}));ring.rotation.x=Math.PI/2;ring.position.y=-.003;platform.add(ring);
 const sc=document.createElement('canvas');sc.width=sc.height=64;const g=sc.getContext('2d'),gr=g.createRadialGradient(32,32,2,32,32,32);
 gr.addColorStop(0,'rgba(0,0,0,.55)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);
 const sh=new THREE.Mesh(new THREE.PlaneGeometry(.95,.95),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sc),transparent:true,depthWrite:false}));
 sh.rotation.x=-Math.PI/2;sh.position.y=.002;platform.add(sh);
 pvScene.add(platform);
}
let yaw=.5,zoom=1,auto=true,drag=false,tt=0,fy=.93,fd=4.4,lw=0,lh=0;
const camFit=(cat,aspect)=>{const f=FOCUS[cat]||FOCUS.looks,t=2*Math.tan(pvCam.fov*Math.PI/360);return[f[0],Math.max(f[1]/t,f[2]/(aspect*t))+.35]};
function fit(){
 const w=left.clientWidth,h=left.clientHeight;if(!w||!h||(w===lw&&h===lh))return;
 lw=w;lh=h;pvR.setSize(w,h,false);pvCam.aspect=w/h;pvCam.updateProjectionMatrix();
}
function tick(dt){
 if(!opened)return;
 fit();tt+=dt;
 if(auto&&!drag)yaw+=dt*.45;
 av.rotation.y=yaw;
 const b=anim.bones;
 if(b){b.upper.rotation.x=Math.sin(tt*1.7)*.012;b.hm.rotation.y=Math.sin(tt*.7)*.1;b.hm.rotation.x=Math.sin(tt*.9)*.02}
 const[ty,td]=camFit(curTab,pvCam.aspect||1),k=Math.min(1,dt*6);
 fy+=(ty-fy)*k;fd+=(td*zoom-fd)*k;
 pvCam.position.set(0,fy+fd*.07,fd);pvCam.lookAt(0,fy,0);
 pvR.render(pvScene,pvCam);
}
/* girar / aproximar */
const ptr=new Map();let pinch=0;
left.addEventListener('pointerdown',e=>{if(e.target.closest('.cr-ltools'))return;ptr.set(e.pointerId,[e.clientX,e.clientY]);left.setPointerCapture(e.pointerId);drag=true;pinch=0});
left.addEventListener('pointermove',e=>{
 if(!ptr.has(e.pointerId))return;const p=ptr.get(e.pointerId);
 if(ptr.size===1){yaw+=(e.clientX-p[0])*.012}
 ptr.set(e.pointerId,[e.clientX,e.clientY]);
 if(ptr.size===2){const[a,c]=[...ptr.values()],d=Math.hypot(a[0]-c[0],a[1]-c[1]);if(pinch)zoom=Math.max(.5,Math.min(1.5,zoom*pinch/d));pinch=d}
});
const up=e=>{ptr.delete(e.pointerId);pinch=0;if(!ptr.size)drag=false};
left.addEventListener('pointerup',up);left.addEventListener('pointercancel',up);
left.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.5,Math.min(1.5,zoom*(e.deltaY>0?1.08:.92)))},{passive:false});

/* ---------- miniaturas dos cabelos (renderizadas no próprio modelo) ---------- */
const thumbs={};
function buildThumbs(){
 const R=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
 R.setPixelRatio(1);R.setSize(112,112,false);R.outputEncoding=THREE.sRGBEncoding;R.setClearColor(0x000000,0);
 const cam=new THREE.PerspectiveCamera(24,1,.1,10);cam.position.set(.62,1.78,1.12);cam.lookAt(0,1.7,.03);
 const keep={...C},ry=av.rotation.y,hy=anim.bones&&anim.bones.hm.rotation.y;
 Object.assign(C,{skin:'#e8b98a',hair:'#7a4a24',shirt:'#2f6fb5'});SK.apply();
 av.rotation.y=0;if(anim.bones)anim.bones.hm.rotation.y=0;
 for(const s of HAIR.styles){anim.setHair(s.id);R.render(pvScene,cam);thumbs[s.id]=R.domElement.toDataURL()}
 Object.assign(C,keep);SK.apply();anim.setHair(C.hairStyle);
 av.rotation.y=ry;if(anim.bones)anim.bones.hm.rotation.y=hy;
 R.dispose();R.forceContextLoss&&R.forceContextLoss();
}

/* ---------- opções ---------- */
const commit=(hairChanged)=>{SK.save();if(hairChanged)anim.setHair(C.hairStyle);mark()};
function section(title){const d=E('div','cr-sec',null,body);E('h3','',title,d);return d}
function swatches(key,parent){
 const g=E('div','cr-sw',null,parent);
 PAL_OF(key).forEach(c=>{
  const b=E('button','',null,g);b.style.background=c;b.dataset.k=key;b.dataset.c=c;b.setAttribute('aria-label',c);
  b.onclick=()=>{C[key]=c;commit()};
 });
 const r=E('label','cr-custom',null,parent);E('span','','Cor personalizada',r);
 const inp=E('input','',null,r);inp.type='color';inp.dataset.k=key;inp.value=C[key];
 inp.oninput=()=>{C[key]=inp.value;SK.save();mark()};
}
function mark(){
 body.querySelectorAll('.cr-sw button').forEach(b=>b.classList.toggle('on',C[b.dataset.k].toLowerCase()===b.dataset.c));
 body.querySelectorAll('.cr-custom input').forEach(i=>{if(document.activeElement!==i)i.value=C[i.dataset.k]});
 body.querySelectorAll('.cr-card[data-h]').forEach(b=>b.classList.toggle('on',b.dataset.h===C.hairStyle));
}
function renderBody(){
 body.textContent='';body.scrollTop=0;
 if(curTab==='looks'){
  const s=section('Looks prontos'),g=E('div','cr-cards',null,s);
  SK.PRESETS.forEach(([n,c])=>{
   const b=E('button','cr-card',null,g),cvs=E('canvas','',null,b);cvs.width=40;cvs.height=64;
   SK.drawFront(cvs.getContext('2d'),40,64,c);E('span','',n,b);
   b.onclick=()=>{Object.assign(C,c);commit(true)};
  });
 }else if(curTab==='hair'){
  const s=section('Estilo'),g=E('div','cr-cards',null,s);
  HAIR.styles.forEach(h=>{
   const b=E('button','cr-card',null,g);b.dataset.h=h.id;
   if(thumbs[h.id]){const im=E('img','',null,b);im.src=thumbs[h.id];im.alt=h.name}
   E('span','',h.name,b);
   b.onclick=()=>{C.hairStyle=h.id;commit(true)};
  });
  swatches('hair',section('Cor do cabelo'));
 }else{
  const label={skin:'Tom de pele',shirt:'Cor da roupa (parte de cima)',pants:'Cor da calça',sash:'Cor da faixa, pulseiras e gola',shoes:'Cor dos sapatos'}[curTab];
  const sec=section(label);swatches(curTab,sec);
  if(curTab==='shirt'){const r=E('div','cr-custom',null,sec);B('Usar a mesma cor na calça',()=>{C.pants=C.shirt;commit()},r)}
 }
 mark();
}
function setTab(id){
 curTab=id;
 tabsEl.querySelectorAll('.btn').forEach(b=>b.classList.toggle('on',b.dataset.t===id));
 renderBody();
}
CATS.forEach(([id,n])=>{const b=B(n,()=>setTab(id),tabsEl,'tab');b.dataset.t=id});

function randomize(){
 const pick=a=>a[Math.random()*a.length|0];
 C.skin=pick(PAL.skin.slice(0,10));C.hair=pick(PAL.hair);C.shirt=pick(PAL.cloth);C.pants=pick(PAL.cloth);C.sash=pick(PAL.cloth);C.shoes=pick(PAL.cloth);
 C.hairStyle=pick(HAIR.styles).id;
 commit(true);
}
const bRand=B('🎲 Aleatório',randomize,tools),bAuto=B('Girar: ligado',()=>{auto=!auto;bAuto.textContent='Girar: '+(auto?'ligado':'desligado')},tools);
const bBack=B('Voltar',()=>close(false),act),bOk=B('Confirmar',()=>close(true),act);bOk.classList.add('primary');

/* ---------- abrir / fechar ---------- */
let was=null;
function open(o){
 opts=o||{};ensureGL();
 snap=JSON.parse(JSON.stringify(C));
 was={parent:av.parent,vis:av.visible,pos:av.position.clone(),ry:av.rotation.y};
 pvScene.add(av);av.visible=true;anim.resetPose();av.position.set(0,0,0);
 yaw=.5;zoom=1;auto=true;bAuto.textContent='Girar: ligado';tt=0;lw=lh=0;
 fy=.93;fd=4.4;
 anim.setHair(C.hairStyle);
 if(!thumbs.classic)buildThumbs();
 bOk.textContent=opts.confirmLabel||'Confirmar';
 opened=true;go('creator');setTab('looks');
}
function close(ok){
 if(!opened)return;opened=false;
 if(ok)SK.save();
 else{Object.keys(snap).forEach(k=>C[k]=snap[k]);SK.save();anim.setHair(C.hairStyle)}
 const b=anim.bones;if(b){b.upper.rotation.x=0;b.hm.rotation.set(0,0,0)}
 (was.parent||OWM.scene).add(av);av.visible=was.vis;av.position.copy(was.pos);av.rotation.y=was.ry;
 const f=opts.onClose;if(f)f(ok);
}
OWM.creator={open,tick,isOpen:()=>opened};
})();
