/* Open World Mayhem — customização do HUD de controles.
   IMPORTANTE: sem um layout salvo pelo jogador, o CSS original é a única fonte de verdade.
   O editor apenas mede as posições atuais para a prévia; não injeta posições no HUD até o jogador salvar uma edição. */
(()=>{
'use strict';
const O=window.OWM;
if(!O||!O.screens||!O.screens.settings||!O.screens.pause)return;
const {E,B,mkScreen,go,ld,st,toast}=O;
const STORAGE_KEY='bc.hud.layout.v2';
const LEGACY_STORAGE_KEY='bc.hud.layout.v1';
const FALLBACK_SPEC={
 schema:'owm-hud-layout',version:2,mode:'original',coordinateSystem:'css-anchor-offsets',
 description:'Layout original do HUD. As posições são definidas pelo CSS do jogo e preservam safe areas e regras responsivas.',
 responsive:{landscape:'orientation:landscape and max-height:520px'},
 controls:{
  joy:{label:'Joystick',anchor:'left-bottom',offsetX:24,offsetY:90,safeAreaX:true,safeAreaY:true,size:124,visible:true,draggable:true,landscape:{offsetX:20,offsetY:36,safeAreaX:true,safeAreaY:true,size:112}},
  bJump:{label:'Pular',anchor:'right-bottom',offsetX:18,offsetY:84,safeAreaX:false,safeAreaY:true,size:64,visible:true,draggable:true,landscape:{offsetX:16,offsetY:68,safeAreaX:true,safeAreaY:true,size:56}},
  bPunch:{label:'Socar',anchor:'right-bottom',offsetX:94,offsetY:84,safeAreaX:false,safeAreaY:true,size:64,visible:true,draggable:true,landscape:{offsetX:82,offsetY:68,safeAreaX:true,safeAreaY:true,size:56}},
  bDash:{label:'Dash',anchor:'right-bottom',offsetX:94,offsetY:12,safeAreaX:false,safeAreaY:true,size:64,visible:true,draggable:true,landscape:{offsetX:82,offsetY:8,safeAreaX:true,safeAreaY:true,size:56}},
  bInv:{label:'Inventário',anchor:'right-bottom',offsetX:18,offsetY:158,safeAreaX:false,safeAreaY:true,size:64,visible:true,draggable:true,landscape:{offsetX:16,offsetY:128,safeAreaX:true,safeAreaY:true,size:56}},
  bSprint:{label:'Sprint',anchor:'right-bottom',offsetX:18,offsetY:12,safeAreaX:false,safeAreaY:true,size:64,visible:true,draggable:true,landscape:{offsetX:16,offsetY:8,safeAreaX:true,safeAreaY:true,size:56}},
  bPause:{label:'Pausa',anchor:'right-top',offsetX:12,offsetY:10,safeAreaX:false,safeAreaY:true,size:44,visible:true,draggable:true,landscape:{offsetX:12,offsetY:10,safeAreaX:true,safeAreaY:true,size:44}},
  collect:{label:'Coletar',anchor:'dynamic',offsetX:null,offsetY:null,size:52,visible:true,draggable:false,dynamic:true}
 }
};
const IDS=Object.keys(FALLBACK_SPEC.controls);
const SELECTORS={joy:'#joy',bJump:'#bJump',bPunch:'#bPunch',bDash:'#bDash',bInv:'#bInv',bSprint:'#bSprint',bPause:'#bPause',collect:'#collect'};
const clone=v=>JSON.parse(JSON.stringify(v));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):0));
let originalSpec=clone(FALLBACK_SPEC),active=null,draft=null,returnScreen='pause',selected='joy',defaultsReady=null;

function px(v,fallback){const n=parseFloat(v);return Number.isFinite(n)?n:fallback}
function readOriginalSnapshot(){
 const w=Math.max(1,window.innerWidth||390),h=Math.max(1,window.innerHeight||844);
 const controls={};
 for(const id of IDS){
  const spec=originalSpec.controls[id];
  const el=document.querySelector(SELECTORS[id]);
  let x=50,y=60,size=spec.size;
  if(id!=='collect'&&el){
   const cs=getComputedStyle(el);size=Math.max(1,px(cs.width,spec.size));
   const height=Math.max(1,px(cs.height,size));
   const left=cs.left!=='auto'?px(cs.left,0):w-px(cs.right,0)-size;
   const top=cs.top!=='auto'?px(cs.top,0):h-px(cs.bottom,0)-height;
   x=((left+size/2)/w)*100;y=((top+height/2)/h)*100;
  }
  controls[id]={label:spec.label,x:clamp(x,0,100),y:clamp(y,0,100),size,visible:true,draggable:!!spec.draggable,customPosition:false,customSize:false,customVisibility:false};
 }
 return {schema:'owm-hud-layout',version:2,mode:'original',coordinateSystem:'normalized-screen-center',controls};
}
function normalize(raw){
 const base=readOriginalSnapshot();
 if(!raw||!raw.controls||raw.mode==='original'||raw.coordinateSystem==='css-anchor-offsets')return base;
 const hasPropertyFlags=IDS.some(id=>{const c=raw.controls[id];return c&&['customPosition','customSize','customVisibility'].some(k=>typeof c[k]==='boolean')});
 if(!hasPropertyFlags&&(raw.version===1||raw.coordinateSystem==='normalized-screen-center'))return migrateLegacy(raw)||base;
 let hasAnyCustomization=false;
 for(const id of IDS){const d=base.controls[id],s=raw.controls[id];if(!s)continue;
  const hasFlags=['customPosition','customSize','customVisibility'].some(k=>typeof s[k]==='boolean');
  d.customPosition=hasFlags?s.customPosition===true:d.draggable;
  d.customSize=hasFlags?s.customSize===true:true;
  d.customVisibility=hasFlags?s.customVisibility===true:s.visible===false;
  if(d.customPosition&&d.draggable){d.x=clamp(s.x,0,100);d.y=clamp(s.y,0,100)}
  if(d.customSize)d.size=clamp(s.size,id==='joy'?84:id==='bPause'?34:40,id==='joy'?190:id==='bPause'?88:112);
  if(d.customVisibility)d.visible=id==='bPause'?true:s.visible!==false;
  if(d.customPosition||d.customSize||d.customVisibility)hasAnyCustomization=true;
 }
 base.mode=hasAnyCustomization?'custom':'original';
 return base;
}
function clearOverrides(){
 for(const id of IDS){const el=document.querySelector(SELECTORS[id]);if(!el)continue;
  el.classList.remove('hud-custom-hidden');
  for(const prop of ['display','position','left','top','right','bottom','width','height','transform','font-size','padding'])el.style.removeProperty(prop);
  if(id==='joy'){const knob=el.querySelector('#knob');if(knob)for(const prop of ['left','top','width','height'])knob.style.removeProperty(prop)}
 }
}
function apply(cfg){
 if(!cfg||cfg.mode!=='custom'){clearOverrides();return}
 for(const id of IDS){
  const el=document.querySelector(SELECTORS[id]),c=cfg.controls[id];if(!el||!c)continue;
  const customPosition=id!=='collect'&&c.customPosition===true;
  const customSize=c.customSize===true;
  const customVisibility=c.customVisibility===true;
  if(customVisibility){
   const visible=id==='bPause'?true:c.visible!==false;
   el.classList.toggle('hud-custom-hidden',!visible);el.style.display=visible?'':'none';
  }else{el.classList.remove('hud-custom-hidden');el.style.removeProperty('display')}
  if(customPosition){el.style.left=c.x+'%';el.style.top=c.y+'%';el.style.right='auto';el.style.bottom='auto';el.style.transform='translate(-50%,-50%)'}
  else for(const prop of ['left','top','right','bottom','transform'])el.style.removeProperty(prop);
  if(id==='collect'){
   if(customSize){const scale=c.size/52;el.style.fontSize=(13*scale)+'px';el.style.padding=(6*scale)+'px '+(14*scale)+'px'}
   else{el.style.removeProperty('font-size');el.style.removeProperty('padding')}
   continue; // a posição do botão Coletar continua sendo calculada pelo sistema de coleta.
  }
  if(customSize){el.style.width=c.size+'px';el.style.height=c.size+'px'}
  else{el.style.removeProperty('width');el.style.removeProperty('height')}
  if(id==='joy'){
   const knob=el.querySelector('#knob');if(knob){
    if(customSize){const inner=c.size*.3387;knob.style.width=inner+'px';knob.style.height=inner+'px';knob.style.left=((c.size-inner)/2)+'px';knob.style.top=((c.size-inner)/2)+'px'}
    else for(const prop of ['left','top','width','height'])knob.style.removeProperty(prop);
   }
  }
 }
}
function exportJSON(cfg,kind){
 const payload=kind==='default'?originalSpec:cfg;
 const data=JSON.stringify(payload,null,2),blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=kind==='default'?'owm-hud-original.json':'owm-hud-personalizado.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function migrateLegacy(raw){
 const src=raw&&raw.controls;if(!src)return null;
 const bad={joy:[24,81,124],bJump:[86,86,64],bPunch:[65,86,64],bDash:[65,94,64],bInv:[86,76,64],bSprint:[86,94,64],bPause:[91,4,44],collect:[50,60,52]};
 const migrated=readOriginalSnapshot();let changed=false;migrated.mode='custom';
 for(const id of IDS){const v=src[id],b=bad[id],d=migrated.controls[id];if(!v)continue;
  if(Number(v.x)!==b[0]){d.x=clamp(v.x,0,100);d.customPosition=true;changed=true}
  if(Number(v.y)!==b[1]){d.y=clamp(v.y,0,100);d.customPosition=true;changed=true}
  if(Number(v.size)!==b[2]){d.size=clamp(v.size,id==='joy'?84:id==='bPause'?34:40,id==='joy'?190:id==='bPause'?88:112);d.customSize=true;changed=true}
  if(v.visible===false&&id!=='bPause'){d.visible=false;d.customVisibility=true;changed=true}
 }
 if(!changed)return null;
 migrated.savedAt=raw.savedAt||new Date().toISOString();return migrated;
}
async function loadOriginal(){
 if(defaultsReady)return defaultsReady;
 defaultsReady=(async()=>{
  try{const r=await fetch('hud-default.json',{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();if(j&&j.schema==='owm-hud-layout'&&j.version===2&&j.controls)originalSpec=j}
  catch(e){console.warn('[OWM HUD] Usando especificação original embutida; hud-default.json não pôde ser carregado.',e);originalSpec=clone(FALLBACK_SPEC)}
  clearOverrides();
  let saved=ld(STORAGE_KEY,null);
  if(!saved){
   const legacy=ld(LEGACY_STORAGE_KEY,null);
   if(legacy){saved=migrateLegacy(legacy);if(saved)st(STORAGE_KEY,saved)}
  }
  if(saved){active=normalize(saved);active.mode='custom';apply(active)}
  else{active=readOriginalSnapshot();clearOverrides()}
 })();
 return defaultsReady;
}

const SC=mkScreen('hud-customizer','Personalizar HUD','dim hud-customizer');
E('p','hud-ed-desc','Arraste os controles na prévia. Selecione um botão para ajustar o tamanho ou ocultá-lo. Sem personalização salva, o jogo mantém exatamente o posicionamento original.',SC);
const preview=E('div','hud-ed-preview',null,SC);
E('div','hud-ed-preview-label','PRÉVIA DA TELA DO JOGO',preview);
const proxyLayer=E('div','hud-ed-proxies',null,preview);
const selector=E('div','hud-ed-selector',null,SC);
const editor=E('div','hud-ed-fields',null,SC);
E('div','hud-ed-info','Dica: arraste cada controle para a posição desejada.',SC);
const actions=E('div','hud-ed-actions',null,SC);
const fileInput=E('input','hud-ed-file',null,SC);fileInput.type='file';fileInput.accept='.json,application/json';fileInput.hidden=true;
const proxy={},selectBtn={};
function updatePreview(){
 if(!draft)return;
 for(const id of IDS){const c=draft.controls[id],el=proxy[id];el.style.left=c.x+'%';el.style.top=c.y+'%';el.style.width=(id==='joy'?Math.max(54,c.size*.62):Math.max(36,c.size*.68))+'px';el.style.height=(id==='joy'?Math.max(54,c.size*.62):Math.max(36,c.size*.68))+'px';el.classList.toggle('is-hidden',!c.visible);el.classList.toggle('selected',id===selected);el.textContent=id==='joy'?'✥':(id==='bPause'?'≡':id==='collect'?'E':c.label);}
 for(const id of IDS)selectBtn[id].classList.toggle('on',id===selected);
}
function makeSelection(){
 selector.textContent='';
 for(const id of IDS){const c=draft.controls[id],b=B(c.label,()=>{selected=id;updatePreview();renderFields()},selector,'hud-ed-select');selectBtn[id]=b}
}
function markCustom(id,property){draft.mode='custom';draft.coordinateSystem='normalized-screen-center';if(id&&property)draft.controls[id][property]=true}
function field(label,type,value,min,max,step,onChange,disabled=false){
 const row=E('label','hud-ed-field',null,editor);E('span','',label,row);const input=E('input','',null,row);input.type=type;input.value=value;input.min=min;input.max=max;input.step=step;input.disabled=disabled;input.oninput=()=>onChange(+input.value);return input;
}
function renderFields(){
 editor.textContent='';const c=draft.controls[selected];
 E('div','hud-ed-picked',c.label+' '+(c.visible?'· visível':'· oculto'),editor);
 if(c.draggable){field('Posição horizontal','range',c.x,0,100,1,v=>{markCustom(selected,'customPosition');c.x=v;updatePreview()});field('Posição vertical','range',c.y,0,100,1,v=>{markCustom(selected,'customPosition');c.y=v;updatePreview()})}
 else E('div','hud-ed-note','Este botão aparece sobre o item coletável quando você chega perto. A posição é automática.',editor);
 field('Tamanho','range',c.size,selected==='joy'?84:selected==='bPause'?34:40,selected==='joy'?190:selected==='bPause'?88:112,1,v=>{markCustom(selected,'customSize');c.size=v;updatePreview()});
 const row=E('label','hud-ed-visible',null,editor),visInput=E('input','',null,row);visInput.type='checkbox';visInput.checked=c.visible;visInput.disabled=selected==='bPause';visInput.onchange=()=>{markCustom(selected,'customVisibility');c.visible=visInput.checked;updatePreview();renderFields()};E('span','',selected==='bPause'?'Pausa sempre visível para manter o acesso ao menu':'Mostrar '+c.label,row);
}
function pointerDown(id,e){
 if(id==='collect')return;
 selected=id;updatePreview();renderFields();const rect=preview.getBoundingClientRect(),startX=e.clientX,startY=e.clientY,baseX=draft.controls[id].x,baseY=draft.controls[id].y;
 const move=ev=>{const c=draft.controls[id];markCustom(id,'customPosition');c.x=clamp(baseX+(ev.clientX-startX)/rect.width*100,0,100);c.y=clamp(baseY+(ev.clientY-startY)/rect.height*100,0,100);updatePreview()};
 const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)};
 window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);e.preventDefault();
}
for(const id of IDS){const p=E('button','hud-ed-proxy',null,proxyLayer);p.type='button';p.setAttribute('aria-label','Mover '+FALLBACK_SPEC.controls[id].label);proxy[id]=p;p.addEventListener('pointerdown',e=>pointerDown(id,e))}
B('Salvar layout',()=>{if(draft.mode!=='custom'||!IDS.some(id=>{const c=draft.controls[id];return c.customPosition||c.customSize||c.customVisibility})){active=readOriginalSnapshot();active.mode='original';clearOverrides();try{localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(LEGACY_STORAGE_KEY)}catch(e){}go(returnScreen);toast('Layout original mantido!');return}active=normalize(draft);active.mode='custom';active.savedAt=new Date().toISOString();st(STORAGE_KEY,active);apply(active);go(returnScreen);toast('HUD personalizado salvo!')},actions,'hud-ed-primary');
B('Restaurar original',()=>{active=readOriginalSnapshot();active.mode='original';draft=clone(active);clearOverrides();try{localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(LEGACY_STORAGE_KEY)}catch(e){}selected='joy';updatePreview();renderFields();go(returnScreen);toast('Posições originais restauradas!')},actions);
B('Exportar meu JSON',()=>exportJSON(normalize(draft),'player'),actions);
B('Importar JSON',()=>fileInput.click(),actions);
B('Baixar JSON original',()=>exportJSON(originalSpec,'default'),actions);
B('Cancelar',()=>go(returnScreen),actions);
fileInput.addEventListener('change',async()=>{const f=fileInput.files&&fileInput.files[0];if(!f)return;try{const parsed=JSON.parse(await f.text());draft=normalize(parsed);if(parsed.mode==='original'||parsed.coordinateSystem==='css-anchor-offsets')draft.mode='original';selected='joy';makeSelection();updatePreview();renderFields();toast('JSON importado. Salve para aplicar.')}catch(e){toast('Não foi possível ler esse JSON')}fileInput.value=''});
async function open(from){await loadOriginal();returnScreen=from||'pause';draft=active&&active.mode==='custom'?clone(active):readOriginalSnapshot();selected='joy';makeSelection();updatePreview();renderFields();go('hud-customizer')}
const settings=O.screens.settings.querySelector('.grid');if(settings)B('Personalizar HUD',()=>open('settings'),settings);
B('Personalizar HUD',()=>open('pause'),O.screens.pause);
O.hudCustomization={open,apply,get:()=>clone(active||readOriginalSnapshot()),defaults:()=>clone(originalSpec),storageKey:STORAGE_KEY};
loadOriginal();
})();
