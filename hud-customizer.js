/* Open World Mayhem — personalização dos controles do HUD (estilo "Personalizar controles" do Minecraft).
   - Edição direto na tela do jogo: os botões REAIS ficam visíveis e você arrasta cada um com o dedo/mouse.
   - Ímã de alinhamento (bordas, centro e outros botões) com linhas-guia.
   - Tamanho, opacidade, visibilidade e "voltar ao padrão" por botão.
   - Layouts separados para Retrato e Paisagem (gire o aparelho para editar o outro).
   - Posição guardada como ÂNCORA (canto mais próximo + distância em px), então não quebra em telas diferentes.
   - Layout salvo é ESPARSO: só o que você mexeu é gravado; o resto continua vindo do CSS original do jogo. */
(()=>{
'use strict';
const O=window.OWM;
if(!O||!O.screens||!O.screens.settings||!O.screens.pause)return;
const {E,B,go,ld,st,toast,$}=O;
const KEY='bc.hud.layout.v3',V2='bc.hud.layout.v2',V1='bc.hud.layout.v1';
const IDS=['joy','bJump','bPunch','bDash','bInv','bSprint','bPause','collect'];
const SEL={};IDS.forEach(id=>SEL[id]='#'+id);
const META={
 joy:{label:'Joystick',min:80,max:200,drag:true,round:true},
 bJump:{label:'Pular',min:40,max:112,drag:true},
 bPunch:{label:'Socar',min:40,max:112,drag:true},
 bDash:{label:'Dash',min:40,max:112,drag:true},
 bInv:{label:'Inventário',min:40,max:112,drag:true},
 bSprint:{label:'Sprint',min:40,max:112,drag:true},
 bPause:{label:'Pausa',min:32,max:88,drag:true},
 collect:{label:'Coletar',min:36,max:96,drag:false}
};
const COLLECT_BASE=52;
const clone=v=>JSON.parse(JSON.stringify(v));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fin=v=>v!=null&&v!==''&&Number.isFinite(+v);
const ORI=()=>innerWidth>=innerHeight?'landscape':'portrait';
const ORI_LABEL={portrait:'Retrato',landscape:'Paisagem'};
const emptyCfg=()=>({schema:'owm-hud-layout',version:3,profiles:{portrait:{controls:{}},landscape:{controls:{}}}});
const isEmpty=c=>!c||['portrait','landscape'].every(o=>!Object.keys(c.profiles[o].controls).length);
const entry=(cfg,id,create)=>{const p=cfg.profiles[ORI()].controls;return p[id]||(create?(p[id]={}):null)};

let active=null,draft=null,editing=false,selected=null,returnScreen='pause',snapOn=true,hudWasHidden=false;

/* ---------- medidas: safe areas e tamanhos originais (vindos do CSS) ---------- */
const probe=E('div',null,null,document.body);
probe.style.cssText='position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
function insets(){const cs=getComputedStyle(probe);return{t:parseFloat(cs.paddingTop)||0,r:parseFloat(cs.paddingRight)||0,b:parseFloat(cs.paddingBottom)||0,l:parseFloat(cs.paddingLeft)||0}}

const CLEAR=['display','left','top','right','bottom','width','height','font-size','padding','opacity','transform'];
function clearEl(el,id){
 el.classList.remove('hud-custom-hidden');
 for(const p of CLEAR)el.style.removeProperty(p);
 if(id==='joy'){const k=el.querySelector('#knob');if(k)for(const p of ['left','top','width','height'])k.style.removeProperty(p)}
}
let defCache=null,defKey='';
function defaults(){
 const key=innerWidth+'x'+innerHeight;
 if(defCache&&defKey===key)return defCache;
 for(const id of IDS){const el=$(SEL[id]);if(el)clearEl(el,id)}
 defCache={};
 for(const id of IDS){
  const el=$(SEL[id]);
  if(id==='collect'||!el){defCache[id]={size:COLLECT_BASE,font:13};continue}
  const cs=getComputedStyle(el);   // mesmo com display:none o width/font-size computados vêm do CSS
  defCache[id]={size:parseFloat(cs.width)||64,font:parseFloat(cs.fontSize)||13};
 }
 defKey=key;return defCache;
}

/* ---------- aplicar layout nos botões reais ---------- */
function apply(cfg,isEditing){
 const d=defaults(),W=innerWidth,H=innerHeight,ins=insets();
 const ctl=cfg?cfg.profiles[ORI()].controls:{};
 for(const id of IDS){
  const el=$(SEL[id]);if(!el)continue;
  clearEl(el,id);
  const e=ctl[id]||{},m=META[id];
  const hidden=e.visible===false&&id!=='bPause';
  if(e.opacity!=null)el.style.opacity=String(clamp(+e.opacity,.15,1));
  if(hidden){if(isEditing)el.style.opacity='.28';else el.style.display='none'}
  const size=e.size!=null?clamp(+e.size,m.min,m.max):d[id].size;
  if(id==='collect'){   // a posição do Coletar é calculada pelo sistema de coleta; só tamanho/opacidade/visibilidade
   if(e.size!=null){const s=size/COLLECT_BASE;el.style.fontSize=(13*s)+'px';el.style.padding=(6*s)+'px '+(14*s)+'px'}
   continue;
  }
  if(e.size!=null){
   el.style.width=size+'px';el.style.height=size+'px';
   el.style.fontSize=(d[id].font*size/d[id].size)+'px';
   if(id==='joy'){const k=el.querySelector('#knob');if(k){const inner=size*.3387;k.style.width=inner+'px';k.style.height=inner+'px';k.style.left=((size-inner)/2)+'px';k.style.top=((size-inner)/2)+'px'}}
  }
  const p=e.pos;
  if(p&&m.drag){
   if(p.ax==='l'){el.style.left=clamp(p.ox,ins.l,W-size-ins.r)+'px';el.style.right='auto'}
   else{el.style.right=clamp(p.ox,ins.r,W-size-ins.l)+'px';el.style.left='auto'}
   if(p.ay==='t'){el.style.top=clamp(p.oy,ins.t,H-size-ins.b)+'px';el.style.bottom='auto'}
   else{el.style.bottom=clamp(p.oy,ins.b,H-size-ins.t)+'px';el.style.top='auto'}
  }
 }
}
function posFromRect(left,top,w,h){
 const W=innerWidth,H=innerHeight,ax=left+w/2<W/2?'l':'r',ay=top+h/2<H/2?'t':'b';
 return{ax,ay,ox:Math.round(ax==='l'?left:W-left-w),oy:Math.round(ay==='t'?top:H-top-h)};
}

/* ---------- validação / migração ---------- */
function sanitize(raw){
 if(!raw||typeof raw!=='object')return null;
 if(raw.version===3&&raw.profiles){
  const out=emptyCfg();
  for(const o of ['portrait','landscape']){
   const src=(raw.profiles[o]&&raw.profiles[o].controls)||{};
   for(const id of IDS){
    const s=src[id];if(!s||typeof s!=='object')continue;const m=META[id],e={};
    const p=s.pos;
    if(m.drag&&p&&(p.ax==='l'||p.ax==='r')&&(p.ay==='t'||p.ay==='b')&&fin(p.ox)&&fin(p.oy))e.pos={ax:p.ax,ay:p.ay,ox:clamp(+p.ox,0,4000),oy:clamp(+p.oy,0,4000)};
    if(fin(s.size))e.size=clamp(+s.size,m.min,m.max);
    if(fin(s.opacity)&&+s.opacity<.999)e.opacity=clamp(+s.opacity,.15,1);
    if(s.visible===false&&id!=='bPause')e.visible=false;
    if(Object.keys(e).length)out.profiles[o].controls[id]=e;
   }
  }
  if(raw.savedAt)out.savedAt=raw.savedAt;
  return out;
 }
 return migrateOld(raw);
}
/* formatos antigos (v1/v2): centro em % da tela. Convertido para a orientação atual. */
function migrateOld(raw){
 const src=raw&&raw.controls;
 if(!src||raw.mode==='original'||raw.coordinateSystem==='css-anchor-offsets')return null;
 const bad={joy:[24,81,124],bJump:[86,86,64],bPunch:[65,86,64],bDash:[65,94,64],bInv:[86,76,64],bSprint:[86,94,64],bPause:[91,4,44],collect:[50,60,52]};
 const flagged=IDS.some(id=>src[id]&&['customPosition','customSize','customVisibility'].some(k=>typeof src[id][k]==='boolean'));
 const out=emptyCfg(),ctl=out.profiles[ORI()].controls,d=defaults();
 for(const id of IDS){
  const s=src[id];if(!s)continue;const m=META[id],e={};
  const posC=flagged?s.customPosition===true:(Number(s.x)!==bad[id][0]||Number(s.y)!==bad[id][1]);
  const sizeC=flagged?s.customSize===true:Number(s.size)!==bad[id][2];
  const visC=flagged?s.customVisibility===true:s.visible===false;
  if(sizeC&&fin(s.size))e.size=clamp(+s.size,m.min,m.max);
  if(posC&&m.drag&&fin(s.x)&&fin(s.y)){const sz=e.size!=null?e.size:d[id].size;e.pos=posFromRect(clamp(+s.x,0,100)/100*innerWidth-sz/2,clamp(+s.y,0,100)/100*innerHeight-sz/2,sz,sz)}
  if(visC&&s.visible===false&&id!=='bPause')e.visible=false;
  if(Object.keys(e).length)ctl[id]=e;
 }
 return isEmpty(out)?null:out;
}
function dropLegacy(){try{localStorage.removeItem(V1);localStorage.removeItem(V2)}catch(e){}}

/* ---------- carga inicial ---------- */
{
 const raw=ld(KEY,null);
 if(raw)active=sanitize(raw);
 else{const old=ld(V2,null)||ld(V1,null);if(old){const m=migrateOld(old);if(m){active=m;st(KEY,m)}dropLegacy()}}
 if(isEmpty(active))active=null;
 apply(active,false);
}

/* ---------- interface do editor ---------- */
const hudEl=$('#hud');
const root=E('div',null,null,document.body);root.id='hud-ed';root.classList.add('hidden');
const bg=E('div','hud-ed-bg',null,root);
E('div','hud-ed-safe',null,root);
const guideV=E('div','hud-ed-guide v hidden',null,root),guideH=E('div','hud-ed-guide h hidden',null,root);
const layer=E('div','hud-ed-layer',null,root);
const handles={};
for(const id of IDS){
 const h=E('button','hud-ed-h'+(META[id].round?' round':'')+(id==='collect'?' collect':''),null,layer);
 h.type='button';h.setAttribute('aria-label','Editar '+META[id].label);
 if(id==='collect')E('span','hud-ed-lbl','Coletar',h);
 E('span','hud-ed-tag',META[id].label,h);
 handles[id]=h;
 h.addEventListener('pointerdown',e=>onDown(id,e));
}
const tbar=E('div','hud-ed-top',null,root);
const bCancel=E('button','hud-ed-tbtn','✕ Cancelar',tbar),bReset=E('button','hud-ed-tbtn','↺ Resetar',tbar);
E('div','hud-ed-spacer',null,tbar);
const bMore=E('button','hud-ed-tbtn more','⋯',tbar),bSave=E('button','hud-ed-tbtn save','✓ Salvar',tbar);
for(const b of [bCancel,bReset,bMore,bSave])b.type='button';
const menu=E('div','hud-ed-menu hidden',null,root);
const mSnap=E('button','hud-ed-mi',null,menu),mExp=E('button','hud-ed-mi','Exportar JSON',menu),mImp=E('button','hud-ed-mi','Importar JSON',menu);
const fileInput=E('input',null,null,root);fileInput.type='file';fileInput.accept='.json,application/json';fileInput.hidden=true;

const stack=E('div','hud-ed-stack',null,root);
const hint=E('div','hud-ed-hint','Toque em um botão para selecionar · arraste para mover',stack);
const panel=E('div','hud-ed-panel hidden',null,stack);
const ph=E('div','hud-ed-ph',null,panel);
const uiName=E('span','hud-ed-name',null,ph),uiVis=E('button','hud-ed-pbtn',null,ph),uiReset=E('button','hud-ed-pbtn','↺ Padrão',ph);
uiVis.type=uiReset.type='button';
function slider(label,onInput){
 const row=E('label','hud-ed-row',null,panel);E('span',null,label,row);
 const input=E('input',null,null,row);input.type='range';input.step=1;
 const out=E('output',null,null,row);
 input.addEventListener('input',()=>onInput(+input.value));
 return{input,out};
}
const uiSize=slider('Tamanho',v=>{const e=entry(draft,selected,true);e.size=v;refresh()});
const uiOp=slider('Opacidade',v=>{const e=entry(draft,selected,true);if(v>=100)delete e.opacity;else e.opacity=v/100;refresh()});
uiOp.input.min=15;uiOp.input.max=100;
const uiNote=E('div','hud-ed-note hidden','Este botão aparece sobre o item coletável quando você chega perto — a posição é automática.',panel);
const uiOri=E('div','hud-ed-ori',null,stack);

function oriText(){return 'Editando layout de '+ORI_LABEL[ORI()]+' · gire o aparelho para editar o outro'}
function refresh(){apply(draft,true);positionHandles();renderPanel()}
function positionHandles(){
 for(const id of IDS){
  const h=handles[id],e=entry(draft,id,false)||{};
  h.classList.toggle('off',e.visible===false&&id!=='bPause');
  if(id==='collect'){
   const s=(e.size!=null?e.size:COLLECT_BASE)/COLLECT_BASE;
   h.style.fontSize=(13*s)+'px';h.style.padding=(6*s)+'px '+(14*s)+'px';
   h.style.opacity=e.visible===false?.35:(e.opacity!=null?e.opacity:1);continue;
  }
  const el=$(SEL[id]);if(!el)continue;
  const r=el.getBoundingClientRect();
  h.style.left=r.left+'px';h.style.top=r.top+'px';h.style.width=r.width+'px';h.style.height=r.height+'px';
  h.classList.toggle('tag-below',r.top<34);
 }
}
function renderPanel(){
 const has=!!selected;
 hint.classList.toggle('hidden',has);panel.classList.toggle('hidden',!has);
 uiOri.textContent=oriText();
 for(const id of IDS)handles[id].classList.toggle('sel',id===selected);
 if(!has)return;
 const id=selected,m=META[id],e=entry(draft,id,false)||{},d=defaults()[id];
 uiName.textContent=m.label;
 const size=e.size!=null?e.size:d.size;
 uiSize.input.min=m.min;uiSize.input.max=m.max;uiSize.input.value=Math.round(size);
 uiSize.out.textContent=id==='collect'?Math.round(size/COLLECT_BASE*100)+'%':Math.round(size)+' px';
 const op=e.opacity!=null?e.opacity:1;uiOp.input.value=Math.round(op*100);uiOp.out.textContent=Math.round(op*100)+'%';
 const vis=e.visible!==false;
 uiVis.textContent=id==='bPause'?'● Sempre visível':(vis?'● Visível':'○ Oculto');
 uiVis.disabled=id==='bPause';uiVis.classList.toggle('off',!vis);
 uiNote.classList.toggle('hidden',id!=='collect');
 uiReset.disabled=!(entry(draft,id,false)&&Object.keys(entry(draft,id,false)).length);
}
function select(id){selected=id;renderPanel()}
bg.addEventListener('pointerdown',e=>{e.preventDefault();menu.classList.add('hidden');if(selected){selected=null;renderPanel()}});
uiVis.onclick=()=>{if(!selected||selected==='bPause')return;const e=entry(draft,selected,true);if(e.visible===false)delete e.visible;else e.visible=false;refresh()};
uiReset.onclick=()=>{if(!selected)return;delete draft.profiles[ORI()].controls[selected];refresh()};

/* ---------- arrastar + ímã ---------- */
function targets(id){
 const ins=insets(),xs=[ins.l,innerWidth/2,innerWidth-ins.r],ys=[ins.t,innerHeight/2,innerHeight-ins.b];
 for(const o of IDS){
  if(o===id||o==='collect')continue;const el=$(SEL[o]);if(!el)continue;
  const r=el.getBoundingClientRect();xs.push(r.left,r.left+r.width/2,r.right);ys.push(r.top,r.top+r.height/2,r.bottom);
 }
 return{xs,ys};
}
function snap(left,top,w,h,t){
 if(!snapOn)return{left,top};
 const TH=7;let bx=null,by=null;
 for(const off of [0,w/2,w])for(const x of t.xs){const d=x-(left+off);if(Math.abs(d)<=TH&&(!bx||Math.abs(d)<Math.abs(bx.d)))bx={d,at:x}}
 for(const off of [0,h/2,h])for(const y of t.ys){const d=y-(top+off);if(Math.abs(d)<=TH&&(!by||Math.abs(d)<Math.abs(by.d)))by={d,at:y}}
 return{left:bx?left+bx.d:left,top:by?top+by.d:top,gx:bx&&bx.at,gy:by&&by.at};
}
function showGuides(gx,gy){
 guideV.classList.toggle('hidden',gx==null);if(gx!=null)guideV.style.left=gx+'px';
 guideH.classList.toggle('hidden',gy==null);if(gy!=null)guideH.style.top=gy+'px';
}
function moveTo(id,left,top,w,h){
 const ins=insets();
 left=clamp(left,ins.l,innerWidth-w-ins.r);top=clamp(top,ins.t,innerHeight-h-ins.b);
 entry(draft,id,true).pos=posFromRect(left,top,w,h);
 refresh();
}
function onDown(id,e){
 e.preventDefault();menu.classList.add('hidden');select(id);
 if(!META[id].drag)return;
 const h=handles[id],el=$(SEL[id]);if(!el)return;
 const r=el.getBoundingClientRect(),sx=e.clientX,sy=e.clientY,t=targets(id),pid=e.pointerId;
 let moved=false;
 try{h.setPointerCapture(pid)}catch(_){}
 const mv=ev=>{
  if(ev.pointerId!==pid)return;
  const dx=ev.clientX-sx,dy=ev.clientY-sy;
  if(!moved&&Math.hypot(dx,dy)<4)return;
  moved=true;h.classList.add('drag');
  const ins=insets();
  let left=clamp(r.left+dx,ins.l,innerWidth-r.width-ins.r),top=clamp(r.top+dy,ins.t,innerHeight-r.height-ins.b);
  const s=snap(left,top,r.width,r.height,t);
  showGuides(s.gx,s.gy);
  moveTo(id,s.left,s.top,r.width,r.height);
 };
 const up=ev=>{
  if(ev.pointerId!==pid)return;
  h.removeEventListener('pointermove',mv);h.removeEventListener('pointerup',up);h.removeEventListener('pointercancel',up);
  h.classList.remove('drag');showGuides(null,null);
 };
 h.addEventListener('pointermove',mv);h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up);
}
function onKey(e){
 if(!editing)return;
 if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel();return}
 if(!selected||!META[selected].drag||!e.key.startsWith('Arrow'))return;
 if(e.target&&e.target.tagName==='INPUT')return;
 const el=$(SEL[selected]);if(!el)return;
 const step=e.shiftKey?10:1,r=el.getBoundingClientRect();
 const dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;
 e.preventDefault();moveTo(selected,r.left+dx,r.top+dy,r.width,r.height);
}

/* ---------- ações ---------- */
function open(from){
 returnScreen=from||'pause';draft=clone(active||emptyCfg());selected=null;editing=true;
 hudWasHidden=hudEl.classList.contains('hidden');hudEl.classList.remove('hidden');
 document.body.classList.add('hud-editing');
 for(const k in O.screens)O.screens[k].classList.add('hidden');   // sem go(): não troca a música
 root.classList.remove('hidden');menu.classList.add('hidden');
 mSnap.textContent='Ímã de alinhamento: '+(snapOn?'ligado':'desligado');
 refresh();
}
function close(){
 editing=false;selected=null;root.classList.add('hidden');menu.classList.add('hidden');showGuides(null,null);
 document.body.classList.remove('hud-editing');
 if(hudWasHidden)hudEl.classList.add('hidden');
 apply(active,false);go(returnScreen);
}
function cancel(){close()}
function save(){
 const c=sanitize(draft);
 if(isEmpty(c)){active=null;try{localStorage.removeItem(KEY)}catch(e){}dropLegacy();close();toast('Controles originais mantidos');return}
 c.savedAt=new Date().toISOString();active=c;st(KEY,c);dropLegacy();close();toast('Controles salvos!');
}
function resetCurrent(){draft.profiles[ORI()].controls={};selected=null;refresh();toast('Original restaurado ('+ORI_LABEL[ORI()]+') — toque em Salvar para confirmar')}
function exportJSON(){
 const data=JSON.stringify(sanitize(draft)||emptyCfg(),null,2),url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');
 a.href=url;a.download='owm-hud-personalizado.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
bCancel.onclick=cancel;bSave.onclick=save;bReset.onclick=resetCurrent;
bMore.onclick=()=>menu.classList.toggle('hidden');
mSnap.onclick=()=>{snapOn=!snapOn;mSnap.textContent='Ímã de alinhamento: '+(snapOn?'ligado':'desligado');menu.classList.add('hidden')};
mExp.onclick=()=>{menu.classList.add('hidden');exportJSON()};
mImp.onclick=()=>{menu.classList.add('hidden');fileInput.click()};
fileInput.addEventListener('change',async()=>{
 const f=fileInput.files&&fileInput.files[0];if(!f)return;
 try{const c=sanitize(JSON.parse(await f.text()));if(!c)throw new Error('formato');draft=c;selected=null;refresh();toast('JSON importado — toque em Salvar para aplicar')}
 catch(e){toast('Não foi possível ler esse JSON')}
 fileInput.value='';
});
root.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('keydown',onKey,true);
let rq=0;
const onResize=()=>{cancelAnimationFrame(rq);rq=requestAnimationFrame(()=>{if(editing)refresh();else apply(active,false)})};
addEventListener('resize',onResize);addEventListener('orientationchange',onResize);

const settings=O.screens.settings.querySelector('.grid');
if(settings)B('Personalizar HUD',()=>open('settings'),settings);
B('Personalizar HUD',()=>open('pause'),O.screens.pause);
O.hudCustomization={open,apply:()=>apply(active,false),get:()=>clone(active||emptyCfg()),storageKey:KEY};
})();
