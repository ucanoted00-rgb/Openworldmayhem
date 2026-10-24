/* Open World Mayhem — Editor de animações com gizmo 3D e categorias. */
(()=>{
const {$,E,B,mkScreen,go,ld,st,toast}=OWM;
const THREE=window.THREE;
const CATS=['Idle','Ataque','Corrida','Pulo','Especial','Outro'];

/* Renderer do preview */
const pvCanvas=document.createElement('canvas');
pvCanvas.width=440;pvCanvas.height=640;
const pvR=new THREE.WebGLRenderer({canvas:pvCanvas,alpha:true,antialias:true});
pvR.setPixelRatio(Math.min(2,devicePixelRatio));
pvR.outputEncoding=THREE.sRGBEncoding;
pvR.setClearColor(0x000000,0);
const pvScene=new THREE.Scene();
const pvCam=new THREE.PerspectiveCamera(38,440/640,.1,10);
pvCam.position.set(0,1.0,3.0);pvCam.lookAt(0,1.0,0);
pvScene.add(new THREE.HemisphereLight(0xffffff,0x445566,1.3));
const pvSun=new THREE.DirectionalLight(0xfff2dc,1.2);pvSun.position.set(2,4,2);pvScene.add(pvSun);
const grid=new THREE.GridHelper(2,8,0x3a3d4a,0x2a2d38);grid.position.y=0.001;pvScene.add(grid);

let tc=null,tcDragging=false;
if(typeof THREE.TransformControls==='function'){
 tc=new THREE.TransformControls(pvCam,pvR.domElement);
 tc.setMode('rotate');tc.setSize(0.85);tc.visible=false;
 pvScene.add(tc);
 tc.addEventListener('dragging-changed',e=>{
  tcDragging=e.value;
  if(e.value&&playing){playing=false;btnPlay.textContent='▶ Tocar'}
 });
}

const ES=mkScreen('animedit',null,'animedit-bg');
const aed=E('div','aed',null,ES);
const previewWrap=E('div','aed-preview',null,aed);previewWrap.appendChild(pvCanvas);
const controls=E('div','aed-controls',null,aed);

const nameRow=E('div','aed-field',null,controls);E('label','','Nome',nameRow);
const nameInp=E('input','',null,nameRow);nameInp.type='text';nameInp.value='Nova animação';

const catRow=E('div','aed-field',null,controls);E('label','','Categoria',catRow);
const catSel=E('select','',null,catRow);
catSel.style.cssText='flex:1;height:34px;padding:0 8px;background:#0b0c11;border:2px solid #33364a;border-radius:6px;color:#fff;font:700 13px var(--f);outline:0;cursor:pointer';
CATS.forEach(c=>{const o=document.createElement('option');o.textContent=c;o.value=c;catSel.appendChild(o)});

const durRow=E('div','aed-field',null,controls);E('label','','Duração',durRow);
const durInp=E('input','',null,durRow);durInp.type='range';durInp.min='0.5';durInp.max='8';durInp.step='.1';durInp.value='2';
const durVal=E('span','','2.0s',durRow);

const bonesRow=E('div','aed-bones',null,controls);
const boneDefs=[['armL','Braço E'],['armR','Braço D'],['legL','Perna E'],['legR','Perna D'],['head','Cabeça']];
const boneBtns={};
boneDefs.forEach(([k,n])=>{const b=B(n,()=>setBone(k),bonesRow,'tab');boneBtns[k]=b});

const rxRow=E('div','aed-field',null,controls);E('label','','Rot X',rxRow);
const rxInp=E('input','',null,rxRow);rxInp.type='range';rxInp.min='-3.14';rxInp.max='3.14';rxInp.step='.05';rxInp.value='0';
const rxVal=E('span','','0.00',rxRow);
const ryRow=E('div','aed-field',null,controls);E('label','','Rot Y',ryRow);
const ryInp=E('input','',null,ryRow);ryInp.type='range';ryInp.min='-3.14';ryInp.max='3.14';ryInp.step='.05';ryInp.value='0';
const ryVal=E('span','','0.00',ryRow);
const rzRow=E('div','aed-field',null,controls);E('label','','Rot Z',rzRow);
const rzInp=E('input','',null,rzRow);rzInp.type='range';rzInp.min='-3.14';rzInp.max='3.14';rzInp.step='.05';rzInp.value='0';
const rzVal=E('span','','0.00',rzRow);

B('+ Adicionar keyframe',addKeyframe,controls);

const tlWrap=E('div','aed-timeline',null,ES);
const tlInp=E('input','',null,tlWrap);tlInp.type='range';tlInp.min='0';tlInp.max='2';tlInp.step='.01';tlInp.value='0';
const tlInfo=E('div','',null,tlWrap);
tlInfo.style.cssText='display:flex;justify-content:space-between;font:700 11px var(--f);color:#9aa0b4;margin-top:2px';
const tlLeft=E('span','','0.00s',tlInfo);
const tlRight=E('span','','2.00s',tlInfo);
const kfsBar=E('div','aed-kfs',null,tlWrap);

const actions=E('div','aed-actions',null,ES);
const btnPlay=B('▶ Tocar',()=>{playing=!playing;if(playing){playTime=currentTime}btnPlay.textContent=playing?'⏸ Pausar':'▶ Tocar'},actions,'play');
B('■ Parar',()=>{playing=false;currentTime=0;tlInp.value=0;tlLeft.textContent='0.00s';btnPlay.textContent='▶ Tocar';applyPose(currentAnim,0);updateSliders()},actions);
B('Salvar',save,actions);
B('Fechar',closeEditor,actions,'danger');

let active=false;
let currentAnim={name:'Nova animação',duration:2,category:'Idle',tracks:{armL:[],armR:[],legL:[],legR:[],head:[]}};
let currentBone='armL',currentTime=0,editIndex=-1,playing=false,playTime=0;

function getBoneByName(k){const b=OWM.anim.bones;return k==='armL'?b.LA:k==='armR'?b.RA:k==='legL'?b.LL:k==='legR'?b.RL:k==='head'?b.hm:null}
function setBone(k){currentBone=k;Object.entries(boneBtns).forEach(([kk,bt])=>bt.classList.toggle('on',kk===k));if(tc){const bone=getBoneByName(k);if(bone)tc.attach(bone);else tc.detach()}updateSliders()}
function updateSliders(){const bone=getBoneByName(currentBone);if(!bone)return;rxInp.value=bone.rotation.x;rxVal.textContent=bone.rotation.x.toFixed(2);ryInp.value=bone.rotation.y;ryVal.textContent=bone.rotation.y.toFixed(2);rzInp.value=bone.rotation.z;rzVal.textContent=bone.rotation.z.toFixed(2)}
function addKeyframe(){const bone=getBoneByName(currentBone);if(!bone)return;const track=currentAnim.tracks[currentBone]||(currentAnim.tracks[currentBone]=[]);const t=+currentTime.toFixed(2);const kf={t,x:+bone.rotation.x.toFixed(3),y:+bone.rotation.y.toFixed(3),z:+bone.rotation.z.toFixed(3)};const existing=track.findIndex(f=>Math.abs(f.t-t)<0.05);if(existing>=0)track[existing]=kf;else{track.push(kf);track.sort((a,b)=>a.t-b.t)}renderKeyframes();toast('Keyframe em '+t.toFixed(2)+'s')}
function renderKeyframes(){kfsBar.textContent='';const track=currentAnim.tracks[currentBone]||[];track.forEach(f=>{const dot=E('div','aed-kf',null,kfsBar);dot.style.left=(f.t/currentAnim.duration*100)+'%';dot.title='t='+f.t.toFixed(2)+'s';dot.onclick=e=>{e.stopPropagation();currentTime=f.t;tlInp.value=f.t;tlLeft.textContent=f.t.toFixed(2)+'s';applyPose(currentAnim,currentTime);updateSliders();renderKeyframes()}})}
function applyPose(anim,t){const b=OWM.anim.bones;const set=(bone,track)=>{if(track&&track.length){const v=OWM.anim.sampleTrack(track,t);bone.rotation.set(v.x,v.y,v.z)}else bone.rotation.set(0,0,0)};set(b.LA,anim.tracks.armL);set(b.RA,anim.tracks.armR);set(b.LL,anim.tracks.legL);set(b.RL,anim.tracks.legR);set(b.hm,anim.tracks.head)}
function save(){currentAnim.name=nameInp.value.trim()||'Sem nome';currentAnim.duration=+durInp.value;currentAnim.category=catSel.value;const anims=ld('bc.anims',[]);if(editIndex>=0)anims[editIndex]=JSON.parse(JSON.stringify(currentAnim));else{anims.push(JSON.parse(JSON.stringify(currentAnim)));editIndex=anims.length-1}st('bc.anims',anims);toast('✓ Animação salva')}
function openEditor(index,defaultCat){editIndex=index;active=true;playing=false;playTime=0;if(index>=0){const anims=ld('bc.anims',[]);if(anims[index])currentAnim=JSON.parse(JSON.stringify(anims[index]))}else{currentAnim={name:'Nova animação',duration:2,category:defaultCat||'Idle',tracks:{armL:[],armR:[],legL:[],legR:[],head:[]}}}nameInp.value=currentAnim.name;durInp.value=currentAnim.duration;durVal.textContent=currentAnim.duration.toFixed(1)+'s';catSel.value=currentAnim.category;tlInp.max=currentAnim.duration;tlRight.textContent=currentAnim.duration.toFixed(2)+'s';currentTime=0;tlInp.value=0;tlLeft.textContent='0.00s';btnPlay.textContent='▶ Tocar';pvScene.add(OWM.anim.av);OWM.anim.av.position.set(0,0,0);OWM.anim.av.rotation.set(0,0,0);OWM.anim.av.visible=true;if(OWM.anim.resetPose)OWM.anim.resetPose();OWM.skin.mat.colorWrite=OWM.skin.mat.depthWrite=true;setBone('armL');applyPose(currentAnim,0);updateSliders();renderKeyframes();go('animedit')}
function closeEditor(){active=false;playing=false;OWM.scene.add(OWM.anim.av);OWM.anim.av.visible=false;if(tc)tc.detach();if(OWM.animedit.onClose)OWM.animedit.onClose(currentAnim.category)}

rxInp.oninput=()=>{rxVal.textContent=(+rxInp.value).toFixed(2);const b=getBoneByName(currentBone);if(b)b.rotation.x=+rxInp.value};
ryInp.oninput=()=>{ryVal.textContent=(+ryInp.value).toFixed(2);const b=getBoneByName(currentBone);if(b)b.rotation.y=+ryInp.value};
rzInp.oninput=()=>{rzVal.textContent=(+rzInp.value).toFixed(2);const b=getBoneByName(currentBone);if(b)b.rotation.z=+rzInp.value};
durInp.oninput=()=>{durVal.textContent=(+durInp.value).toFixed(1)+'s';currentAnim.duration=+durInp.value;tlInp.max=durInp.value;tlRight.textContent=currentAnim.duration.toFixed(2)+'s';renderKeyframes()};
tlInp.oninput=()=>{currentTime=+tlInp.value;tlLeft.textContent=currentTime.toFixed(2)+'s';applyPose(currentAnim,currentTime);updateSliders()};

OWM.animedit={
 open:openEditor,
 onClose:null,
 tick(dt){
  if(!active)return;
  if(playing){
   playTime+=dt;
   if(playTime>currentAnim.duration)playTime=0;
   currentTime=playTime;
   tlInp.value=playTime;tlLeft.textContent=playTime.toFixed(2)+'s';
   if(!tcDragging){applyPose(currentAnim,currentTime);updateSliders()}
  }
  pvR.render(pvScene,pvCam);
 },
};
})();