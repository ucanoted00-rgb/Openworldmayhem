/* Open World Mayhem — customização do HUD de controles.
   O layout original vem de hud-default.json. O layout do jogador fica em localStorage como JSON
   (bc.hud.layout.v1), com importação/exportação para que possa ser levado entre aparelhos. */
(()=>{
'use strict';
const O=window.OWM;
if(!O||!O.screens||!O.screens.settings||!O.screens.pause)return;
const {E,B,mkScreen,go,ld,st,toast}=O;
const STORAGE_KEY='bc.hud.layout.v1';
const FALLBACK={
 schema:'owm-hud-layout',version:1,coordinateSystem:'normalized-screen-center',
 description:'Layout original dos controles de toque do Open World Mayhem.',
 controls:{
  joy:{label:'Joystick',x:24,y:81,size:124,visible:true,draggable:true},
  bJump:{label:'Pular',x:86,y:86,size:64,visible:true,draggable:true},
  bPunch:{label:'Socar',x:65,y:86,size:64,visible:true,draggable:true},
  bDash:{label:'Dash',x:65,y:94,size:64,visible:true,draggable:true},
  bInv:{label:'Inventário',x:86,y:76,size:64,visible:true,draggable:true},
  bSprint:{label:'Sprint',x:86,y:94,size:64,visible:true,draggable:true},
  bPause:{label:'Pausa',x:91,y:4,size:44,visible:true,draggable:true},
  collect:{label:'Coletar',x:50,y:60,size:52,visible:true,draggable:false}
 }
};
const IDS=Object.keys(FALLBACK.controls);
const SELECTORS={joy:'#joy',bJump:'#bJump',bPunch:'#bPunch',bDash:'#bDash',bInv:'#bInv',bSprint:'#bSprint',bPause:'#bPause',collect:'#collect'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const clone=v=>JSON.parse(JSON.stringify(v));
let original=clone(FALLBACK),active=null,draft=null,returnScreen='pause',selected='joy',defaultsReady=null;
function normalize(raw){
 const src=raw&&raw.controls?raw.controls:{};
 const cfg=clone(original);
 for(const id of IDS){const d=cfg.controls[id],s=src[id];if(!s)continue;
  d.x=clamp(s.x,d.draggable?3:0,97);d.y=clamp(s.y,3,97);
  d.size=clamp(s.size,id==='joy'?84: id==='bPause'?34:40,id==='joy'?190: id==='bPause'?88:112);
  d.visible=id==='bPause'?true:s.visible!==false;
 }
 cfg.schema='owm-hud-layout';cfg.version=1;cfg.coordinateSystem='normalized-screen-center';
 return cfg;
}
async function loadOriginal(){
 if(defaultsReady)return defaultsReady;
 defaultsReady=(async()=>{
  try{const r=await fetch('hud-default.json',{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();if(j&&j.schema==='owm-hud-layout'&&j.version===1&&j.controls)original=normalize(j)}
  catch(e){console.warn('[OWM HUD] Usando layout original embutido; hud-default.json não pôde ser carregado.',e);original=clone(FALLBACK)}
  active=normalize(ld(STORAGE_KEY,null)||original);apply(active);
 })();
 return defaultsReady;
}
function apply(cfg){
 if(!cfg)return;
 for(const id of IDS){
  const el=document.querySelector(SELECTORS[id]),c=cfg.controls[id];if(!el||!c)continue;
  el.classList.toggle('hud-custom-hidden',!c.visible);
  el.style.display=c.visible?'':'none';
  if(id==='collect'){
   el.style.display=c.visible?'':'none';
   const scale=c.size/52;el.style.fontSize=(13*scale)+'px';el.style.padding=(6*scale)+'px '+(14*scale)+'px';
   continue;
  }
  el.style.left=c.x+'%';el.style.top=c.y+'%';el.style.right='auto';el.style.bottom='auto';
  el.style.width=c.size+'px';el.style.height=c.size+'px';
  el.style.transform='translate(-50%,-50%)';
  if(id==='joy'){
   const knob=el.querySelector('#knob');if(knob){knob.style.left='33.06%';knob.style.top='33.06%';knob.style.width='33.87%';knob.style.height='33.87%'}
  }
 }
}
function exportJSON(cfg,kind){
 const data=JSON.stringify(cfg,null,2),blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=kind==='default'?'owm-hud-original.json':'owm-hud-personalizado.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const SC=mkScreen('hud-customizer','Personalizar HUD','dim hud-customizer');
E('p','hud-ed-desc','Arraste os controles na prévia. Selecione um botão para ajustar o tamanho ou ocultá-lo. As posições são proporcionais à tela e se adaptam a diferentes celulares.',SC);
const preview=E('div','hud-ed-preview',null,SC);
E('div','hud-ed-preview-label','PRÉVIA DA TELA DO JOGO',preview);
const proxyLayer=E('div','hud-ed-proxies',null,preview);
const selector=E('div','hud-ed-selector',null,SC);
const editor=E('div','hud-ed-fields',null,SC);
const info=E('div','hud-ed-info','Dica: arraste cada controle para a posição desejada.',SC);
const actions=E('div','hud-ed-actions',null,SC);
const fileInput=E('input','hud-ed-file',null,SC);fileInput.type='file';fileInput.accept='.json,application/json';fileInput.hidden=true;
const proxy={};const selectBtn={};
function updatePreview(){
 if(!draft)return;
 for(const id of IDS){const c=draft.controls[id],el=proxy[id];el.style.left=c.x+'%';el.style.top=c.y+'%';el.style.width=(id==='joy'?Math.max(54,c.size*.62):Math.max(36,c.size*.68))+'px';el.style.height=(id==='joy'?Math.max(54,c.size*.62):Math.max(36,c.size*.68))+'px';el.classList.toggle('is-hidden',!c.visible);el.classList.toggle('selected',id===selected);el.textContent=id==='joy'?'✥':(id==='bPause'?'≡':id==='collect'?'E':c.label);}
 for(const id of IDS)selectBtn[id].classList.toggle('on',id===selected);
}
function makeSelection(){selector.textContent='';for(const id of IDS){const c=draft.controls[id],b=B(c.label,()=>{selected=id;updatePreview()},selector,'hud-ed-select');selectBtn[id]=b}}
function field(label,type,value,min,max,step,onChange,disabled=false){
 const row=E('label','hud-ed-field',null,editor);E('span','',label,row);const input=E('input','',null,row);input.type=type;input.value=value;input.min=min;input.max=max;input.step=step;input.disabled=disabled;input.oninput=()=>onChange(+input.value);return input;
}
let visInput=null;
function renderFields(){
 editor.textContent='';const c=draft.controls[selected];
 E('div','hud-ed-picked',c.label+' '+(c.visible?'· visível':'· oculto'),editor);
 if(c.draggable){field('Posição horizontal', 'range',c.x,3,97,1,v=>{c.x=v;updatePreview()});field('Posição vertical','range',c.y,3,97,1,v=>{c.y=v;updatePreview()})}
 else E('div','hud-ed-note','Este botão aparece sobre o item coletável quando você chega perto. A posição é automática.',editor);
 field('Tamanho','range',c.size,selected==='joy'?84:selected==='bPause'?34:40,selected==='joy'?190:selected==='bPause'?88:112,1,v=>{c.size=v;updatePreview()});
 const row=E('label','hud-ed-visible',null,editor);visInput=E('input','',null,row);visInput.type='checkbox';visInput.checked=c.visible;visInput.disabled=selected==='bPause';visInput.onchange=()=>{c.visible=visInput.checked;updatePreview()};E('span','',selected==='bPause'?'Pausa sempre visível para manter o acesso ao menu':'Mostrar '+c.label,row);
}
function pointerDown(id,e){
 if(id==='collect')return;selected=id;updatePreview();const rect=preview.getBoundingClientRect(),startX=e.clientX,startY=e.clientY,baseX=draft.controls[id].x,baseY=draft.controls[id].y;
 const move=ev=>{const c=draft.controls[id];c.x=cl(baseX+(ev.clientX-startX)/rect.width*100,3,97);c.y=cl(baseY+(ev.clientY-startY)/rect.height*100,3,97);updatePreview()};
 const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)};
 window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);e.preventDefault();
}
for(const id of IDS){const p=E('button','hud-ed-proxy',null,proxyLayer);p.type='button';p.setAttribute('aria-label','Mover '+FALLBACK.controls[id].label);proxy[id]=p;p.addEventListener('pointerdown',e=>pointerDown(id,e))}
const saveBtn=B('Salvar layout',()=>{active=normalize(draft);active.savedAt=new Date().toISOString();st(STORAGE_KEY,active);apply(active);go(returnScreen);toast('HUD personalizado salvo!')},actions,'hud-ed-primary');
B('Restaurar original',()=>{draft=clone(original);selected='joy';updatePreview();toast('Prévia restaurada. Toque em Salvar layout para aplicar.')},actions);
B('Exportar meu JSON',()=>exportJSON(normalize(draft),'player'),actions);
B('Importar JSON',()=>fileInput.click(),actions);
B('Baixar JSON original',()=>exportJSON(original,'default'),actions);
B('Cancelar',()=>go(returnScreen),actions);
fileInput.addEventListener('change',async()=>{const f=fileInput.files&&fileInput.files[0];if(!f)return;try{const parsed=JSON.parse(await f.text());draft=normalize(parsed);selected='joy';updatePreview();toast('JSON importado. Salve para aplicar.')}catch(e){toast('Não foi possível ler esse JSON')}fileInput.value=''});
async function open(from){await loadOriginal();returnScreen=from||'pause';draft=clone(active||original);selected='joy';makeSelection();updatePreview();renderFields();go('hud-customizer')}
// Acesso pelas Configurações e diretamente pelo menu de pausa.
const settings=O.screens.settings.querySelector('.grid');if(settings)B('Personalizar HUD',()=>open('settings'),settings);
B('Personalizar HUD',()=>open('pause'),O.screens.pause);
O.hudCustomization={open,apply,get:()=>clone(active||original),defaults:()=>clone(original),storageKey:STORAGE_KEY};
loadOriginal();
})();
