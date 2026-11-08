/* Open World Mayhem — Estúdio de Animação (Configurações → Estúdio de animação).
   Cada categoria de ação (Parado, Andar, Sprint, Pulo, Queda, Dash, LMB, M1, M2) pode ter UMA animação sua, feita com keyframes numa timeline.
   • Corpo: rotação de cabeça, tronco, braços, cotovelos, pernas, joelhos + posição do quadril (3ª pessoa).
   • Mão 1ª pessoa: posição/rotação da mão e da arma em espaço da câmera (o que se vê com a câmera em 1ª pessoa).
   • Ossos/canais sem keyframe continuam com a animação normal do jogo; a do estúdio entra por cima com transição suave.
   • Golpes (LMB/M1/M2): a animação passa a ditar a duração do golpe e o "momento do golpe" (instante em que o dano cai).
   Armazenamento: localStorage 'owm.animstudio.v1'. Exportar/importar: arquivo .json ou texto colado.
   Para o jogo: OWM.animstudio.clip(cat) devolve o clipe ativo (ou null) e OWM.animstudio.sample(trilha,t,canais) amostra uma trilha. */
(()=>{
const {E,B,mkScreen,go,ld,st,toast}=OWM;
const THREE=window.THREE;
const KEY='owm.animstudio.v1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const clone=o=>JSON.parse(JSON.stringify(o));

/* ---------- Definições ---------- */
const CATS=[
 {id:'idle',n:'Parado',dur:2,loop:true},
 {id:'walk',n:'Andar',dur:1,loop:true},
 {id:'sprint',n:'Sprint',dur:.7,loop:true},
 {id:'jump',n:'Pulo',dur:.6},
 {id:'fall',n:'Queda',dur:.6,loop:true},
 {id:'dash',n:'Dash',dur:.35},
 {id:'lmb',n:'LMB',dur:.45,hit:.4,atk:true},
 {id:'m1',n:'M1',dur:.35,hit:.45,atk:true},
 {id:'m2',n:'M2',dur:.55,hit:.5,atk:true}
];
const CAT=Object.fromEntries(CATS.map(c=>[c.id,c]));
/* trilhas do corpo: id, rótulo, osso (em OWM.anim.bones), tipo: r = rotação XYZ, x = só rotação X (cotovelo/joelho), p = posição XYZ */
const BT=[
 {id:'head',label:'Cabeça',bone:'hm',type:'r'},
 {id:'torso',label:'Tronco',bone:'upper',type:'r'},
 {id:'armL',label:'Braço E',bone:'LA',type:'r'},
 {id:'elbowL',label:'Cotovelo E',bone:'LE',type:'x'},
 {id:'armR',label:'Braço D',bone:'RA',type:'r'},
 {id:'elbowR',label:'Cotovelo D',bone:'RE',type:'x'},
 {id:'legL',label:'Perna E',bone:'LL',type:'r'},
 {id:'kneeL',label:'Joelho E',bone:'LK',type:'x'},
 {id:'legR',label:'Perna D',bone:'RL',type:'r'},
 {id:'kneeR',label:'Joelho D',bone:'RK',type:'x'},
 {id:'hip',label:'Quadril (pos.)',bone:'hip',type:'p'}
];
const BTID=Object.fromEntries(BT.map(t=>[t.id,t]));
const FPK=['x','y','z','rx','ry','rz'];
const FPDEF={x:.21,y:-.22,z:-.44,rx:0,ry:0,rz:0};   // pose de guarda (a mesma do jogo)
const CH={r:['x','y','z'],x:['x'],p:['x','y','z']};
const EASE=['Suave','Linear','Degrau'];
const MAXKF=200;

/* ---------- Amostragem (também usada pelo jogo) ---------- */
function sample(tr,t,keys){
 const n=tr.length,o={};
 if(!n){for(const k of keys)o[k]=0;return o}
 const f=tr[0],l=tr[n-1];
 if(n===1||t<=f.t){for(const k of keys)o[k]=f[k]||0;return o}
 if(t>=l.t){for(const k of keys)o[k]=l[k]||0;return o}
 let i=0;while(i<n-2&&t>tr[i+1].t)i++;
 const a=tr[i],b=tr[i+1],p=tr[i-1],q=tr[i+2],h=Math.max(1e-4,b.t-a.t),u=(t-a.t)/h;
 if(a.e===2){for(const k of keys)o[k]=a[k]||0;return o}
 if(a.e===1){for(const k of keys)o[k]=(a[k]||0)+((b[k]||0)-(a[k]||0))*u;return o}
 const u2=u*u,u3=u2*u,h00=2*u3-3*u2+1,h10=u3-2*u2+u,h01=-2*u3+3*u2,h11=u3-u2;
 for(const k of keys){
  const ak=a[k]||0,bk=b[k]||0;
  const m0=p?(bk-(p[k]||0))/Math.max(1e-4,b.t-p.t):(bk-ak)/h;
  const m1=q?((q[k]||0)-ak)/Math.max(1e-4,q.t-a.t):(bk-ak)/h;
  o[k]=h00*ak+h10*h*m0+h01*bk+h11*h*m1;
 }
 return o;
}

/* ---------- Dados ---------- */
const num=(v,d=0)=>{v=+v;return Number.isFinite(v)?v:d};
function cleanTrack(arr,keys,dur,lim){
 if(!Array.isArray(arr))return[];
 const out=[];
 for(const k of arr.slice(0,MAXKF*2)){
  if(!k||typeof k!=='object')continue;
  const kf={t:+clamp(num(k.t),0,dur).toFixed(3)};
  for(const c of keys)kf[c]=+clamp(num(k[c]),-lim[c],lim[c]).toFixed(4);
  if(k.e===1||k.e===2)kf.e=k.e;
  out.push(kf);
 }
 out.sort((a,b)=>a.t-b.t);
 const res=[];
 for(const kf of out){if(res.length&&Math.abs(res[res.length-1].t-kf.t)<.004)res[res.length-1]=kf;else res.push(kf)}
 return res.slice(0,MAXKF);
}
const limOf=(keys,pos)=>Object.fromEntries(keys.map(k=>[k,pos.includes(k)?.9:3.2]));
function cleanClip(c,id){
 if(!c||typeof c!=='object'||!CAT[id])return null;
 const d=CAT[id],dur=+clamp(num(c.dur,d.dur),.1,10).toFixed(3);
 const o={name:String(c.name||d.n).slice(0,40),dur,loop:!!c.loop,speed:+clamp(num(c.speed,1),.1,4).toFixed(2),
  hit:+clamp(num(c.hit,d.hit==null?.5:d.hit),.02,.98).toFixed(3),on:c.on!==false,tracks:{},fp:[]};
 const tr=c.tracks&&typeof c.tracks==='object'?c.tracks:{};
 for(const T of BT)o.tracks[T.id]=cleanTrack(tr[T.id],CH[T.type],dur,limOf(CH[T.type],T.type==='p'?['x','y','z']:[]));
 o.fp=cleanTrack(c.fp,FPK,dur,limOf(FPK,['x','y','z']));
 return o;
}
const hasKeys=c=>!!c&&(c.fp.length>0||BT.some(T=>c.tracks[T.id]&&c.tracks[T.id].length>0));
function newClip(id){
 const d=CAT[id],o={name:d.n,dur:d.dur,loop:!!d.loop,speed:1,hit:d.hit==null?.5:d.hit,on:true,tracks:{},fp:[]};
 for(const T of BT)o.tracks[T.id]=[];
 return o;
}
let D={v:1,clips:{}};
function load(){
 let raw=null;try{raw=ld(KEY,null)}catch(e){}
 D={v:1,clips:{}};
 if(raw&&raw.clips&&typeof raw.clips==='object')for(const id in raw.clips){const c=cleanClip(raw.clips[id],id);if(c&&hasKeys(c))D.clips[id]=c}
}
function persist(){try{st(KEY,D)}catch(e){toast('Não foi possível salvar (armazenamento cheio?)')}}
load();

/* ---------- API pro jogo ---------- */
OWM.animstudio={
 CATS,sample,
 clip:id=>{const c=D.clips[id];return c&&c.on?c:null},
 any:()=>Object.keys(D.clips).length>0,
 hitTime:id=>{const c=D.clips[id];return c&&c.on?c.hit*c.dur/c.speed:null},
 open:null,tick:null,onClose:null
};

/* ---------- Estado da UI ---------- */
let built=false,active=false;
let catId='m1',work=null,dirty=false,mode='body',trkId='armR',time=0,playing=false,sel=null;
let hist=[],editing=false,hipBase=null;
let pvR=null,pvScene=null,pvCam=null,pvCanvas=null,grid=null,lw=0,lh=0;
let ES,root,pvWrap,catBtn={},modeBtn={},chipWrap,slWrap,tlIn,tlBox,timeLbl,btnPlay,easeSel,hitRow,hitSl,hitVal,durSl,durVal,spdSl,spdVal,nameInp,onChk,loopChk,fileInp,modal,modalTa,modalTitle,modalOk;
let sl={},rowEl={},phEl=null,hitEl=null;

const trackList=()=>mode==='fp'?[{id:'fp',label:'Mão 1ª pessoa',type:'fp'}]:BT;
const keysOf=id=>id==='fp'?FPK:CH[BTID[id].type];
const getTrack=id=>id==='fp'?work.fp:work.tracks[id];
const rangeOf=(id,ch)=>{
 if(id==='fp')return ch.length===1?[-.9,.9]:[-3.14,3.14];
 return BTID[id].type==='p'?[-.6,.6]:[-3.14,3.14];
};
const labelOf=(id,ch)=>{
 if(id==='fp')return{x:'Mão X',y:'Mão Y',z:'Mão Z',rx:'Giro X',ry:'Giro Y',rz:'Giro Z'}[ch];
 return(BTID[id].type==='p'?'Pos ':'Rot ')+ch.toUpperCase();
};
function curVals(id,t){
 const tr=getTrack(id);
 if(!tr.length)return id==='fp'?Object.assign({},FPDEF):Object.fromEntries(keysOf(id).map(k=>[k,0]));
 return sample(tr,t,keysOf(id));
}
const snapT=t=>+clamp(Math.round(t*100)/100,0,work.dur).toFixed(2);

/* ---------- Histórico ---------- */
function snap(){hist.push(JSON.stringify(work));if(hist.length>60)hist.shift()}
function beginEdit(){if(!editing){snap();editing=true}dirty=true;playing=false;updPlayBtn()}
function endEdit(){editing=false}
function undo(){
 if(!hist.length){toast('Nada pra desfazer');return}
 work=JSON.parse(hist.pop());dirty=true;sel=null;syncMeta();renderTL();buildSliders();applyPose(time);
}

/* ---------- Persistência ---------- */
function commit(){
 if(!work||!dirty)return;
 const c=cleanClip(work,catId);
 if(c&&hasKeys(c))D.clips[catId]=c;else delete D.clips[catId];
 persist();dirty=false;refreshCats();
}

/* ---------- Prévia 3D ---------- */
function openPreview(){
 closePreview();
 pvCanvas=document.createElement('canvas');pvWrap.appendChild(pvCanvas);
 pvR=new THREE.WebGLRenderer({canvas:pvCanvas,alpha:true,antialias:true});
 pvR.setPixelRatio(Math.min(2,devicePixelRatio||1));
 pvR.outputEncoding=THREE.sRGBEncoding;pvR.setClearColor(0x000000,0);
 pvScene=new THREE.Scene();
 pvCam=new THREE.PerspectiveCamera(38,.7,.05,20);
 pvScene.add(pvCam);
 pvScene.add(new THREE.HemisphereLight(0xffffff,0x445566,1.3));
 const sun=new THREE.DirectionalLight(0xfff2dc,1.2);sun.position.set(2,4,2);pvScene.add(sun);
 grid=new THREE.GridHelper(2,8,0x3a3d4a,0x2a2d38);grid.position.y=.001;pvScene.add(grid);
 lw=lh=0;
}
function closePreview(){
 if(pvR){try{pvR.dispose();pvR.forceContextLoss()}catch(e){}}
 if(pvCanvas&&pvCanvas.parentNode)pvCanvas.parentNode.removeChild(pvCanvas);
 pvR=pvCanvas=pvScene=pvCam=grid=null;
}
function setCamForMode(){
 if(!pvCam)return;
 const av=OWM.anim.av;
 if(mode==='fp'){
  pvCam.fov=OWM.cam.fov||70;pvCam.position.set(0,0,0);pvCam.rotation.set(0,0,0);
  if(grid)grid.visible=false;if(av)av.visible=false;
 }else{
  pvCam.fov=38;pvCam.position.set(0,1,3);pvCam.lookAt(0,1,0);
  if(grid)grid.visible=true;if(av)av.visible=true;
  if(OWM.anim.vmPreview)OWM.anim.vmPreview(null);
 }
 pvCam.updateProjectionMatrix();
}
function applyPose(t){
 const A=OWM.anim;if(!A||!A.bones||!work)return;
 const b=A.bones;
 for(const T of BT){
  const bone=b[T.bone];if(!bone)continue;
  const tr=work.tracks[T.id],v=tr&&tr.length?sample(tr,t,CH[T.type]):null;
  if(T.type==='p'&&hipBase)bone.position.set(hipBase.x+(v?v.x:0),hipBase.y+(v?v.y:0),hipBase.z+(v?v.z:0));
  else if(T.type==='x')bone.rotation.set(v?v.x:0,0,0);
  else if(T.type==='r')bone.rotation.set(v?v.x:0,v?v.y:0,v?v.z:0);
 }
 if(mode==='fp'&&A.vmPreview&&pvCam){
  const f=work.fp.length?sample(work.fp,t,FPK):FPDEF;
  A.vmPreview(pvCam,[f.x,f.y,f.z,f.rx,f.ry,f.rz]);
 }
}

/* ---------- Edição ---------- */
function setChannel(id,ch,val){
 beginEdit();
 const tr=getTrack(id);
 let kf=tr.find(k=>Math.abs(k.t-time)<.012);
 if(!kf){
  if(tr.length>=MAXKF){toast('Limite de keyframes nessa trilha');return}
  kf=Object.assign({t:snapT(time)},curVals(id,time));
  tr.push(kf);tr.sort((a,b)=>a.t-b.t);
  renderTL();
 }
 kf[ch]=+val.toFixed(4);
 sel={trk:id,kf};
 markSel();applyPose(time);
}
function keyHere(id){
 snap();dirty=true;
 const tr=getTrack(id);
 let kf=tr.find(k=>Math.abs(k.t-time)<.012);
 if(!kf){
  if(tr.length>=MAXKF){toast('Limite de keyframes nessa trilha');return}
  kf=Object.assign({t:snapT(time)},curVals(id,time));tr.push(kf);tr.sort((a,b)=>a.t-b.t);
 }
 sel={trk:id,kf};renderTL();syncSliders();syncEase();
}
function keyAll(){
 if(mode==='fp'){keyHere('fp');return}
 snap();dirty=true;
 for(const T of BT){
  const tr=work.tracks[T.id];
  if(tr.some(k=>Math.abs(k.t-time)<.012)||tr.length>=MAXKF)continue;
  tr.push(Object.assign({t:snapT(time)},curVals(T.id,time)));tr.sort((a,b)=>a.t-b.t);
 }
 renderTL();toast('Keyframe em todas as trilhas em '+time.toFixed(2)+'s');
}
function delKey(){
 const id=sel?sel.trk:trkId,tr=getTrack(id);
 let i=sel&&sel.trk===id?tr.indexOf(sel.kf):-1;
 if(i<0)i=tr.findIndex(k=>Math.abs(k.t-time)<.012);
 if(i<0){toast('Nenhum keyframe selecionado');return}
 snap();dirty=true;tr.splice(i,1);sel=null;renderTL();syncSliders();applyPose(time);
}
function dupKey(){
 if(!sel||!getTrack(sel.trk).includes(sel.kf)){toast('Selecione um keyframe pra duplicar');return}
 const tr=getTrack(sel.trk);
 if(tr.some(k=>k!==sel.kf&&Math.abs(k.t-time)<.012)){toast('Já existe keyframe nesse instante');return}
 snap();dirty=true;
 const kf=Object.assign({},sel.kf,{t:snapT(time)});tr.push(kf);tr.sort((a,b)=>a.t-b.t);
 sel={trk:sel.trk,kf};renderTL();
}
function mirror(){
 if(mode==='fp'){toast('Espelhar só vale pro corpo');return}
 snap();dirty=true;
 const pairs=[['armL','armR'],['elbowL','elbowR'],['legL','legR'],['kneeL','kneeR']];
 const flip=(tr,type)=>tr.map(k=>{const o=Object.assign({},k);if(type==='r'){o.y=-(k.y||0);o.z=-(k.z||0)}return o});
 for(const[a,b]of pairs){const ta=work.tracks[a],tb=work.tracks[b],ty=BTID[a].type;work.tracks[a]=flip(tb,ty);work.tracks[b]=flip(ta,ty)}
 for(const id of['head','torso']){work.tracks[id]=work.tracks[id].map(k=>Object.assign({},k,{y:-(k.y||0),z:-(k.z||0)}))}
 work.tracks.hip=work.tracks.hip.map(k=>Object.assign({},k,{x:-(k.x||0)}));
 sel=null;renderTL();syncSliders();applyPose(time);toast('Esquerda ↔ direita espelhadas');
}

/* ---------- Troca de categoria / modo / trilha ---------- */
function selectCat(id){
 commit();
 catId=id;
 work=D.clips[id]?clone(D.clips[id]):newClip(id);
 hist=[];editing=false;dirty=false;time=0;playing=false;sel=null;
 trkId=mode==='fp'?'fp':'armR';
 Object.entries(catBtn).forEach(([k,b])=>b.classList.toggle('on',k===id));
 syncMeta();renderTL();buildSliders();updPlayBtn();applyPose(0);
}
function setMode(m){
 if(mode===m)return;
 mode=m;trkId=m==='fp'?'fp':'armR';sel=null;
 Object.entries(modeBtn).forEach(([k,b])=>b.classList.toggle('on',k===m));
 setCamForMode();buildChips();renderTL();buildSliders();applyPose(time);
 if(m==='fp'&&!(OWM.anim.vmPreview)){toast('Prévia de 1ª pessoa indisponível')}
}
function selectTrack(id){
 trkId=id;sel=null;
 for(const k in rowEl)rowEl[k].classList.toggle('on',k===id);
 chipWrap.querySelectorAll('.btn').forEach(b=>b.classList.toggle('on',b.dataset.id===id));
 buildSliders();syncEase();
}

/* ---------- Construção da UI ---------- */
function build(){
 if(built)return;built=true;
 ES=mkScreen('animstudio',null,'animedit-bg');
 root=E('div','as',null,ES);
 const top=E('div','as-top',null,root);
 const cats=E('div','as-cats',null,top);
 CATS.forEach(c=>{catBtn[c.id]=B(c.n,()=>selectCat(c.id),cats,'tab')});
 B('Sair',closeStudio,top,'danger');

 const main=E('div','as-main',null,root);
 pvWrap=E('div','as-pv',null,main);
 let dragX=null;
 pvWrap.onpointerdown=e=>{dragX=e.clientX;try{pvWrap.setPointerCapture(e.pointerId)}catch(_){}};
 pvWrap.onpointermove=e=>{if(dragX==null||mode==='fp')return;const av=OWM.anim.av;if(av)av.rotation.y+=(e.clientX-dragX)*.012;dragX=e.clientX};
 pvWrap.onpointerup=pvWrap.onpointercancel=()=>{dragX=null};

 const panel=E('div','as-panel',null,main);
 // nome / ativa / loop
 const r1=E('div','as-r',null,panel);
 nameInp=E('input','as-name',null,r1);nameInp.type='text';nameInp.maxLength=40;nameInp.placeholder='Nome da animação';
 nameInp.oninput=()=>{work.name=nameInp.value;dirty=true};
 const mk=(txt,parent)=>{const l=E('label','as-chk',null,parent),i=E('input','',null,l);i.type='checkbox';E('span','',txt,l);return i};
 onChk=mk('Ativa no jogo',r1);onChk.onchange=()=>{snap();work.on=onChk.checked;dirty=true};
 loopChk=mk('Repetir',r1);loopChk.onchange=()=>{snap();work.loop=loopChk.checked;dirty=true};
 // modos
 const r2=E('div','as-r',null,panel);
 modeBtn.body=B('Corpo (3ª pessoa)',()=>setMode('body'),r2,'tab on');
 modeBtn.fp=B('Mão (1ª pessoa)',()=>setMode('fp'),r2,'tab');
 chipWrap=E('div','as-chips',null,panel);
 slWrap=E('div','as-sl',null,panel);
 // ações de keyframe
 const r3=E('div','as-r wrap',null,panel);
 B('◆ Keyframe',()=>keyHere(trkId),r3,'play');
 B('◆ Todos',keyAll,r3);
 B('Duplicar',dupKey,r3);
 B('Apagar',delKey,r3,'danger');
 B('Espelhar',mirror,r3);
 easeSel=document.createElement('select');easeSel.className='as-sel';
 EASE.forEach((n,i)=>{const o=document.createElement('option');o.value=i;o.textContent='Curva: '+n;easeSel.appendChild(o)});
 r3.appendChild(easeSel);
 easeSel.onchange=()=>{if(!sel||!getTrack(sel.trk).includes(sel.kf)){toast('Selecione um keyframe');syncEase();return}snap();dirty=true;const v=+easeSel.value;if(v)sel.kf.e=v;else delete sel.kf.e;applyPose(time)};
 // duração / velocidade / golpe
 const rng=(label,min,max,step,parent)=>{const r=E('div','as-f',null,parent);E('label','',label,r);const i=E('input','',null,r);i.type='range';i.min=min;i.max=max;i.step=step;const v=E('span','',null,r);return[i,v,r]};
 [durSl,durVal]=rng('Duração',.1,6,.05,panel);
 durSl.oninput=()=>{beginEdit();work.dur=+durSl.value;for(const T of BT)work.tracks[T.id].forEach(k=>{if(k.t>work.dur)k.t=+work.dur.toFixed(3)});work.fp.forEach(k=>{if(k.t>work.dur)k.t=+work.dur.toFixed(3)});time=Math.min(time,work.dur);durVal.textContent=work.dur.toFixed(2)+'s';renderTL();applyPose(time)};
 durSl.onchange=endEdit;
 [spdSl,spdVal]=rng('Velocidade',.25,3,.05,panel);
 spdSl.oninput=()=>{beginEdit();work.speed=+spdSl.value;spdVal.textContent='×'+work.speed.toFixed(2)};spdSl.onchange=endEdit;
 [hitSl,hitVal,hitRow]=rng('Momento do golpe',.05,.95,.01,panel);
 hitSl.oninput=()=>{beginEdit();work.hit=+hitSl.value;hitVal.textContent=Math.round(work.hit*100)+'%';placeHit()};hitSl.onchange=endEdit;

 // timeline + transporte + ações
 const bot=E('div','as-bot',null,root);
 const tr=E('div','as-r',null,bot);
 btnPlay=B('▶',()=>{if(playing)playing=false;else{if(time>=work.dur-.001)time=0;playing=true}updPlayBtn()},tr,'play');
 B('■',()=>{playing=false;time=0;updPlayBtn();syncSliders();applyPose(0);updatePlayhead()},tr);
 B('⏮',()=>{playing=false;updPlayBtn();stepKey(-1)},tr);
 B('⏭',()=>{playing=false;updPlayBtn();stepKey(1)},tr);
 timeLbl=E('span','as-time','0.00 / 0.00s',tr);
 tlBox=E('div','as-tl',null,bot);
 tlIn=E('div','as-tlin',null,tlBox);
 const ac=E('div','as-r wrap',null,bot);
 B('Salvar',()=>{dirty=true;commit();toast('Salvo: '+CAT[catId].n)},ac,'play');
 B('↶ Desfazer',undo,ac);
 B('Restaurar padrão',()=>{if(!confirm('Apagar a animação de "'+CAT[catId].n+'" e voltar ao padrão do jogo?'))return;snap();delete D.clips[catId];persist();work=newClip(catId);dirty=false;sel=null;syncMeta();renderTL();buildSliders();applyPose(0);refreshCats();toast('Voltou ao padrão')},ac);
 B('Exportar categoria',()=>exportJSON(false),ac);
 B('Exportar tudo',()=>exportJSON(true),ac);
 B('Importar arquivo',()=>fileInp.click(),ac);
 B('Colar JSON',()=>showModal('Colar JSON de animações','',txt=>importText(txt),'Importar'),ac);
 fileInp=document.createElement('input');fileInp.type='file';fileInp.accept='.json,application/json';fileInp.style.display='none';ES.appendChild(fileInp);
 fileInp.onchange=()=>{const f=fileInp.files&&fileInp.files[0];fileInp.value='';if(!f)return;if(f.size>6e6){toast('Arquivo grande demais');return}const r=new FileReader();r.onload=()=>importText(String(r.result||''));r.onerror=()=>toast('Não consegui ler o arquivo');r.readAsText(f)};

 // modal (colar / copiar texto)
 modal=E('div','as-modal hidden',null,ES);
 const mb=E('div','as-mbox',null,modal);
 modalTitle=E('div','as-mt','',mb);
 modalTa=E('textarea','as-ta',null,mb);modalTa.spellcheck=false;
 const mr=E('div','as-r',null,mb);
 modalOk=B('OK',()=>{},mr,'play');
 B('Fechar',()=>modal.classList.add('hidden'),mr);

 buildChips();
 // atalhos
 window.addEventListener('keydown',e=>{
  if(!active||!modal.classList.contains('hidden'))return;
  const tg=e.target&&e.target.tagName;if(tg==='INPUT'&&e.target.type==='text'||tg==='TEXTAREA'||tg==='SELECT')return;
  if(e.code==='Space'){e.preventDefault();btnPlay.click()}
  else if(e.code==='Delete'||e.code==='Backspace'){e.preventDefault();delKey()}
  else if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){e.preventDefault();undo()}
  else if(e.code==='KeyK')keyHere(trkId);
 });
}
function showModal(title,text,onOk,okLabel){
 modalTitle.textContent=title;modalTa.value=text;modal.classList.remove('hidden');
 modalOk.style.display=onOk?'':'none';modalOk.textContent=okLabel||'OK';
 modalOk.onclick=()=>{if(onOk){const t=modalTa.value;modal.classList.add('hidden');onOk(t)}};
 setTimeout(()=>{modalTa.focus();if(!onOk)modalTa.select()},30);
}
function buildChips(){
 chipWrap.textContent='';
 for(const T of trackList()){const b=B(T.label,()=>selectTrack(T.id),chipWrap,'tab'+(T.id===trkId?' on':''));b.dataset.id=T.id}
}
function buildSliders(){
 slWrap.textContent='';sl={};
 const id=trkId;
 for(const ch of keysOf(id)){
  const [mn,mx]=rangeOf(id,ch),r=E('div','as-f',null,slWrap);
  E('label','',labelOf(id,ch),r);
  const i=E('input','',null,r);i.type='range';i.min=mn;i.max=mx;i.step=.01;
  const n=E('input','as-num',null,r);n.type='number';n.min=mn;n.max=mx;n.step=.01;
  i.oninput=()=>{const v=+i.value;n.value=v.toFixed(2);setChannel(id,ch,v)};
  i.onchange=endEdit;
  n.onchange=()=>{let v=clamp(num(n.value),mn,mx);n.value=v.toFixed(2);i.value=v;setChannel(id,ch,v);endEdit()};
  sl[ch]={i,n};
 }
 syncSliders();
}
function syncSliders(){
 if(!work)return;
 const v=curVals(trkId,time);
 for(const ch in sl){const x=v[ch]||0;sl[ch].i.value=x;sl[ch].n.value=x.toFixed(2)}
 timeLbl.textContent=time.toFixed(2)+' / '+work.dur.toFixed(2)+'s';
}
function syncEase(){
 easeSel.value=sel&&getTrack(sel.trk).includes(sel.kf)?(sel.kf.e||0):0;
}
function syncMeta(){
 if(!work)return;
 nameInp.value=work.name;onChk.checked=work.on;loopChk.checked=work.loop;
 durSl.value=work.dur;durVal.textContent=work.dur.toFixed(2)+'s';
 spdSl.value=work.speed;spdVal.textContent='×'+work.speed.toFixed(2);
 const atk=!!CAT[catId].atk;hitRow.style.display=atk?'':'none';
 hitSl.value=work.hit;hitVal.textContent=Math.round(work.hit*100)+'%';
 refreshCats();
}
function refreshCats(){
 for(const c of CATS){const has=!!D.clips[c.id]||(c.id===catId&&work&&hasKeys(work));catBtn[c.id].textContent=(has?'● ':'')+c.n}
}
function updPlayBtn(){if(btnPlay)btnPlay.textContent=playing?'⏸':'▶'}
function stepKey(dir){
 const times=new Set();
 for(const T of trackList())for(const k of getTrack(T.id))times.add(k.t);
 const arr=[...times].sort((a,b)=>a-b);
 let t=null;
 if(dir>0)t=arr.find(x=>x>time+.006);else for(const x of arr)if(x<time-.006)t=x;
 if(t==null)t=dir>0?work.dur:0;
 time=t;syncSliders();applyPose(time);updatePlayhead();
}

/* ---------- Timeline ---------- */
const pct=t=>(clamp(t/work.dur,0,1)*100)+'%';
function timeFromEvent(e,lane){const r=lane.getBoundingClientRect();return snapT((e.clientX-r.left)/Math.max(1,r.width)*work.dur)}
function renderTL(){
 if(!work)return;
 tlIn.textContent='';rowEl={};
 // régua
 const rr=E('div','as-row as-ruler',null,tlIn);E('div','as-rl','',rr);
 const rl=E('div','as-lane',null,rr);
 const step=work.dur<=1?.1:work.dur<=3?.25:.5;
 for(let t=0;t<=work.dur+1e-6;t+=step){
  const tk=E('i','as-tick'+(Math.abs(t-Math.round(t))<1e-6?' sec':''),null,rl);tk.style.left=pct(t);
  if(Math.abs(t-Math.round(t))<1e-6)E('b','',String(Math.round(t)),tk);
 }
 hitEl=null;
 if(CAT[catId].atk){hitEl=E('u','as-hit',null,rl);hitEl.title='Momento do golpe';placeHit()}
 rl.onpointerdown=e=>scrubStart(e,rl);
 for(const T of trackList()){
  const row=E('div','as-row'+(T.id===trkId?' on':''),null,tlIn);rowEl[T.id]=row;
  const lb=E('div','as-rl',T.label,row);lb.onclick=()=>selectTrack(T.id);
  const lane=E('div','as-lane',null,row);
  lane.onpointerdown=e=>{if(e.target!==lane)return;if(trkId!==T.id)selectTrack(T.id);scrubStart(e,lane)};
  for(const kf of getTrack(T.id)){
   const d=E('div','as-kf'+(sel&&sel.kf===kf?' sel':''),null,lane);d.style.left=pct(kf.t);
   d.title=kf.t.toFixed(2)+'s';
   d.onpointerdown=e=>kfStart(e,T.id,kf,lane,d);
  }
 }
 phEl=E('div','as-ph',null,tlIn);E('i','',null,phEl);
 updatePlayhead();
}
function placeHit(){if(hitEl)hitEl.style.left=(work.hit*100)+'%'}
function updatePlayhead(){
 if(!phEl||!work)return;
 phEl.firstChild.style.left=pct(time);
 timeLbl.textContent=time.toFixed(2)+' / '+work.dur.toFixed(2)+'s';
}
function markSel(){
 tlIn.querySelectorAll('.as-kf.sel').forEach(d=>d.classList.remove('sel'));
}
function scrubStart(e,lane){
 e.preventDefault();playing=false;updPlayBtn();
 const mv=ev=>{time=timeFromEvent(ev,lane);syncSliders();applyPose(time);updatePlayhead()};
 mv(e);
 try{lane.setPointerCapture(e.pointerId)}catch(_){}
 lane.onpointermove=mv;
 lane.onpointerup=lane.onpointercancel=()=>{lane.onpointermove=null;lane.onpointerup=lane.onpointercancel=null};
}
function kfStart(e,id,kf,lane,dot){
 e.preventDefault();e.stopPropagation();
 playing=false;updPlayBtn();
 if(trkId!==id)selectTrack(id);
 sel={trk:id,kf};
 tlIn.querySelectorAll('.as-kf.sel').forEach(d=>d.classList.remove('sel'));dot.classList.add('sel');
 time=kf.t;syncSliders();syncEase();applyPose(time);updatePlayhead();
 let moved=false;const x0=e.clientX;
 try{dot.setPointerCapture(e.pointerId)}catch(_){}
 dot.onpointermove=ev=>{
  if(!moved&&Math.abs(ev.clientX-x0)<4)return;
  if(!moved){snap();dirty=true;moved=true}
  kf.t=timeFromEvent(ev,lane);time=kf.t;dot.style.left=pct(kf.t);dot.title=kf.t.toFixed(2)+'s';
  syncSliders();applyPose(time);updatePlayhead();
 };
 dot.onpointerup=dot.onpointercancel=()=>{
  dot.onpointermove=dot.onpointerup=dot.onpointercancel=null;
  if(!moved)return;
  const tr=getTrack(id);
  for(let i=tr.length-1;i>=0;i--)if(tr[i]!==kf&&Math.abs(tr[i].t-kf.t)<.004)tr.splice(i,1);
  tr.sort((a,b)=>a.t-b.t);renderTL();
 };
}

/* ---------- Exportar / importar ---------- */
function exportJSON(all){
 dirty=true;commit();
 const data={schema:'owm-animstudio',version:1,exported:new Date().toISOString(),clips:{}};
 if(all)Object.assign(data.clips,clone(D.clips));
 else if(D.clips[catId])data.clips[catId]=clone(D.clips[catId]);
 if(!Object.keys(data.clips).length){toast(all?'Nenhuma animação salva ainda':'Essa categoria ainda não tem keyframes');return}
 const text=JSON.stringify(data,null,1),name='owm-animacoes-'+(all?'tudo':catId)+'.json';
 let ok=false;
 try{
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=name;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);ok=true;
 }catch(e){}
 let copied=false;
 try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).catch(()=>{});copied=true}}catch(e){}
 toast(ok?'Exportado: '+name+(copied?' (e copiado)':''):'Copie o texto da janela');
 if(!ok)showModal('Exportar — copie este JSON',text,null);
}
function importText(text){
 let data;
 try{data=JSON.parse(String(text).trim())}catch(e){toast('JSON inválido');return}
 let clips=null;
 if(data&&data.schema==='owm-animstudio'&&data.clips&&typeof data.clips==='object')clips=data.clips;
 else if(data&&data.tracks&&typeof data.tracks==='object')clips={[catId]:data};   // clipe solto: vai pra categoria atual
 else if(data&&typeof data==='object'&&Object.keys(data).some(k=>CAT[k]))clips=data;
 if(!clips){toast('Esse arquivo não é de animações do OWM');return}
 let n=0;
 snap();
 for(const id in clips){
  if(!CAT[id])continue;
  const c=cleanClip(clips[id],id);
  if(c&&hasKeys(c)){D.clips[id]=c;n++}
 }
 if(!n){toast('Nada aproveitável no arquivo');return}
 persist();
 work=D.clips[catId]?clone(D.clips[catId]):newClip(catId);dirty=false;sel=null;time=0;playing=false;
 syncMeta();renderTL();buildSliders();updPlayBtn();applyPose(0);refreshCats();
 toast(n+(n===1?' animação importada':' animações importadas'));
}

/* ---------- Abrir / fechar / loop ---------- */
function open(cat){
 build();load();
 active=true;playing=false;
 const A=OWM.anim;
 if(A.resetPose)A.resetPose();
 const hp=A.bones&&A.bones.hip;hipBase=hp?{x:hp.position.x,y:hp.position.y,z:hp.position.z}:null;
 openPreview();
 pvScene.add(A.av);A.av.position.set(0,0,0);A.av.rotation.set(0,0,0);A.av.visible=true;
 if(OWM.skin&&OWM.skin.mat)OWM.skin.mat.colorWrite=OWM.skin.mat.depthWrite=true;
 mode='body';Object.entries(modeBtn).forEach(([k,b])=>b.classList.toggle('on',k==='body'));
 buildChips();setCamForMode();
 selectCat(cat&&CAT[cat]?cat:catId);
 go('animstudio');
}
function closeStudio(){
 commit();
 active=false;playing=false;
 const A=OWM.anim;
 if(A.vmPreview)A.vmPreview(null);
 if(A.bones&&A.bones.hip&&hipBase)A.bones.hip.position.set(hipBase.x,hipBase.y,hipBase.z);
 try{OWM.scene.add(A.av)}catch(e){}
 A.av.visible=false;
 if(A.resetPose)A.resetPose();
 closePreview();
 modal.classList.add('hidden');
 if(OWM.animstudio.onClose)OWM.animstudio.onClose();
}
function tick(dt){
 if(!active||!pvR)return;
 const w=pvWrap.clientWidth,h=pvWrap.clientHeight;
 if(w>8&&h>8&&(w!==lw||h!==lh)){pvR.setSize(w,h,false);pvCam.aspect=w/h;pvCam.updateProjectionMatrix();lw=w;lh=h;if(mode==='fp')applyPose(time)}
 if(playing){
  time+=dt*work.speed;
  if(time>=work.dur){if(work.loop)time%=work.dur;else{time=work.dur;playing=false;updPlayBtn()}}
  syncSliders();applyPose(time);updatePlayhead();
 }
 pvR.render(pvScene,pvCam);
}
OWM.animstudio.open=open;
OWM.animstudio.tick=tick;
})();
