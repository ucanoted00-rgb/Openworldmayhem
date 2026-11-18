/* Open World Mayhem — SHADERS (shaders.js)
   Sistema de shaders sem código: estilos prontos, ajustes com sliders, estimativa de custo (FPS), salvar/exportar/importar.
   Como funciona por baixo: tudo roda DENTRO do passe final que já existia (postprocess.js → OWM.post.setFx). Trocar de shader só muda uniforms
   (sem recompilar nada, sem travar), e cada efeito só custa GPU enquanto está ligado. Os ajustes de desempenho mexem nas opções que já existem
   (sombras, névoa volumétrica, FXAA, distância, detalhe das árvores), então um estilo "leve" realmente sobe o FPS.
   Carrega logo depois de core.js. Usa: OWM.S, OWM.post, OWM.applyAll, OWM.ld/st, OWM.toast. Expõe OWM.shaders = {open, close, apply, presets} e OWM.fx = {wind}. */
(()=>{
const {S,E,ld,st}=OWM;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------- Parâmetros (a UI inteira é gerada desta tabela) ---------- */
const PARAMS=[
 {k:'exposure',g:'Cor',l:'Brilho da imagem',d:'Clareia ou escurece tudo.',min:-1,max:1,def:0,step:.05},
 {k:'contrast',g:'Cor',l:'Contraste',d:'Mais forte = sombras mais fundas e luzes mais claras.',min:.6,max:1.6,def:1,step:.02},
 {k:'saturation',g:'Cor',l:'Intensidade das cores',d:'0 = preto e branco · 1 = normal · 2 = cores fortíssimas.',min:0,max:2,def:1,step:.02},
 {k:'vibrance',g:'Cor',l:'Cores vivas',d:'Realça só as cores apagadas, sem estourar as fortes.',min:-1,max:1,def:0,step:.05},
 {k:'warmth',g:'Cor',l:'Temperatura',d:'Esquerda: frio e azulado · direita: quente e alaranjado.',min:-1,max:1,def:0,step:.05},
 {k:'tint',g:'Cor',l:'Matiz',d:'Esquerda: esverdeado · direita: rosado.',min:-1,max:1,def:0,step:.05},
 {k:'bloom',g:'Luz',l:'Brilho do sol e da lua',d:'Halo de luz em volta do sol. 0 desliga (ganha FPS).',min:0,max:2,def:1,step:.05},
 {k:'rays',g:'Luz',l:'God rays (raios de sol)',d:'Feixes de luz entre as árvores, em qualquer direção (até de costas pro sol). Tem meio fino próprio: não depende da névoa. Usa as sombras do sol (liga sozinho). 0 = desligado.',min:0,max:2,def:.6,step:.05},
 {k:'vol',g:'Luz',l:'Luz volumétrica',d:'Feixes de luz do sol atravessando a névoa, mais fortes olhando na direção do sol. Em “Névoa volumétrica: Alta” (aba Desempenho) os feixes passam entre as árvores.',min:0,max:3,def:1,step:.05},
 {k:'volDens',g:'Luz',l:'Densidade da névoa',d:'Mais névoa = feixes de luz mais visíveis. 0 = ar limpo.',min:0,max:3,def:1,step:.05},
 {k:'sunInt',g:'Luz',l:'Luz do sol',d:'Força da luz direta e das sombras.',min:0,max:2,def:1,step:.05},
 {k:'amb',g:'Luz',l:'Luz ambiente',d:'Luz geral do céu que clareia as sombras.',min:0,max:2,def:1,step:.05},
 {k:'tod',g:'Luz',l:'Hora do dia',d:'Automático segue o ciclo normal. Arraste para fixar o horário (6h nascer do sol · 12h meio-dia · 18h pôr do sol · 0h noite).',min:-1,max:23,def:-1,step:1,fmt:v=>v<0?'Automático':String(Math.round(v)).padStart(2,'0')+':00'},
 {k:'sharpen',g:'Imagem',l:'Nitidez',d:'Realça os detalhes e as bordas.',min:0,max:1,def:0,step:.05},
 {k:'vig',g:'Imagem',l:'Escurecer as bordas',d:'Foco no centro da tela, como numa lente.',min:0,max:1,def:0,step:.05},
 {k:'grain',g:'Imagem',l:'Granulado de filme',d:'Ruído fino, mais visível nas partes escuras.',min:0,max:1,def:0,step:.05},
 {k:'post',g:'Imagem',l:'Cartoon (nº de tons)',d:'0 = desligado · menor = mais “desenho animado”.',min:0,max:12,def:0,step:1,fmt:v=>v<2?'Desligado':v+' tons'},
 {k:'wind',g:'Natureza',l:'Vento nas árvores',d:'Quanto as copas balançam e as folhas voam. 0 = parado.',min:0,max:2,def:1,step:.05}
];
const DEFP={};PARAMS.forEach(p=>DEFP[p.k]=p.def);
const PERFK=['shadow','vfog','aa','dist','tq','dyn'];

/* ---------- Estilos prontos ---------- */
const PRESETS=[
 {id:'padrao',n:'Padrão',d:'O visual original do jogo.',sw:'#4c8a3c,#b8dbfa',p:{}},
 {id:'leve',n:'Desempenho máximo',d:'Mais FPS: sem bloom nem névoa pesada, sombras simples e menos distância.',sw:'#5d7a4a,#9fb8c8',p:{bloom:0,saturation:1.08,contrast:1.05},perf:{shadow:1,vfog:0,aa:0,dist:4,tq:2,dyn:1}},
 {id:'equil',n:'Equilibrado',d:'Cores um pouco mais ricas sem pesar.',sw:'#4f8a3a,#c7dff2',p:{saturation:1.1,contrast:1.08,vig:.2,bloom:.8},perf:{shadow:1,vfog:1,aa:0,dist:5,tq:1}},
 {id:'real',n:'Realista',d:'Luz natural, raios de sol, nitidez e sombras altas.',sw:'#3f7a34,#e8dcc0',p:{contrast:1.1,saturation:1.05,warmth:.12,bloom:1,rays:.35,sharpen:.35,vig:.25,grain:.04,vol:1.5},perf:{shadow:2,vfog:1,aa:1,dist:6,tq:0}},
 {id:'cinema',n:'Cinematográfico',d:'Tons de filme: laranja nas luzes, azulado nas sombras, bordas escuras.',sw:'#2b4a55,#e8a867',p:{contrast:1.22,saturation:.88,warmth:.2,tint:-.12,bloom:1.3,rays:.5,vig:.5,grain:.15,exposure:-.1,vol:1.8,volDens:1.2},perf:{shadow:2,vfog:1,aa:1}},
 {id:'vivid',n:'Vívido',d:'Cores fortes e alegres.',sw:'#2fa83a,#58b8ff',p:{saturation:1.35,vibrance:.5,contrast:1.1,exposure:.08,bloom:1},perf:{shadow:1}},
 {id:'cartoon',n:'Cartoon',d:'Poucos tons de cor e contornos nítidos, estilo desenho.',sw:'#3fbf4a,#ffd24a',p:{post:7,saturation:1.4,contrast:1.15,sharpen:.6,bloom:.6,vig:.15,wind:1.2},perf:{shadow:1,vfog:0}},
 {id:'retro',n:'Nostalgia',d:'Cores desbotadas, quentes e com granulado, de filme antigo.',sw:'#8a7a5a,#d9c49a',p:{saturation:.55,warmth:.45,contrast:1.1,grain:.3,vig:.55,bloom:.7,exposure:-.05},perf:{shadow:1,vfog:0,aa:0}},
 {id:'outono',n:'Outono dourado',d:'Luz quente de fim de tarde e raios de sol.',sw:'#b8782a,#ffd08a',p:{warmth:.4,saturation:1.2,tint:.08,contrast:1.1,bloom:1.1,rays:.4,vig:.25,vol:2,volDens:1.3,sunInt:1.1},perf:{shadow:2,vfog:1}},
 {id:'frio',n:'Frio de montanha',d:'Tons azulados, ar gelado e limpo.',sw:'#3a6a8a,#cfe6f5',p:{warmth:-.4,saturation:.9,contrast:1.12,vig:.3,bloom:1,sharpen:.2,vol:1.2},perf:{shadow:1,vfog:1}}
];

/* Perfis de desempenho por nível do aparelho (OWM.tier: 0 fraco … 3 topo) — botão "Otimizar para meu aparelho" */
const TIERP=[{shadow:1,vfog:0,aa:0,dist:3,tq:2,dyn:1,bloom:0},{shadow:1,vfog:0,aa:0,dist:4,tq:2,dyn:1,bloom:.6},{shadow:1,vfog:1,aa:1,dist:6,tq:1,dyn:1,bloom:1},{shadow:2,vfog:1,aa:1,dist:8,tq:0,dyn:1,bloom:1}];

/* ---------- Estado ---------- */
const saved=ld('bc.fx',null);
const cur={id:saved&&saved.id||'padrao',n:saved&&saved.n||'Padrão',p:{...DEFP,bloom:S.bloom?1:0,...(saved&&saved.p||{})}};
OWM.fx={wind:cur.p.wind};
const customs=ld('bc.fxl',[]);
let saveT=0;const persist=()=>{clearTimeout(saveT);saveT=setTimeout(()=>{st('bc.fx',cur);st('bc.fxl',customs)},250)};

/* ---------- Custo estimado (pontos aproximados de GPU; só serve para comparar) ---------- */
function cost(p,s){
 s=s||S;const c={};
 c['Sombras']=[0,8,14][s.shadow]||0;
 c['Névoa volumétrica']=[0,10,18][s.vfog]||0;
 c['Bordas suaves (FXAA)']=s.aa?4:0;
 c['Bloom']=p.bloom>0?4+3*Math.min(1.5,p.bloom):0;
 c['God rays']=p.rays>0?4+2*Math.min(2,p.rays):0;
 c['Nitidez']=p.sharpen>0?2.5:0;
 c['Cores, contraste e vinheta']=(p.exposure||p.contrast!==1||p.saturation!==1||p.vibrance||p.warmth||p.tint||p.vig||p.grain||p.post>1)?.8:0;
 c['Distância de visão']=Math.max(0,(s.dist-3)*2.2);
 c['Detalhe das árvores']=[3,1.5,0][s.tq]||0;
 c['Vento nas árvores']=p.wind>0?.6:0;
 let t=0;for(const k in c)t+=c[k];return{t,parts:c};
}
const level=t=>t<14?['Leve','#5fd36b']:t<30?['Médio','#ffcf4a']:['Pesado','#ff6a5a'];

/* ---------- Aplicação ---------- */
function toFx(p,forceOn){
 const w=p.warmth||0,t=p.tint||0;
 const tint=[(1+.2*w)*(1+.06*t),(1+.03*w)*(1-.14*t),(1-.24*w)*(1+.06*t)];
 const on=forceOn!==undefined?forceOn:(p.exposure!==0||p.contrast!==1||p.saturation!==1||p.vibrance!==0||w!==0||t!==0||p.sharpen>0||p.rays>0||p.vig>0||p.grain>0||p.post>1);
 return{on,exposure:Math.pow(2,p.exposure||0),contrast:p.contrast,saturation:p.saturation,vibrance:p.vibrance,tint,sharpen:p.sharpen,rays:p.rays,post:p.post>1?p.post:0,vig:p.vig,grain:p.grain,bloom:Math.max(0,p.bloom),bloomRadius:1,vol:p.vol,volDens:p.volDens,sunInt:p.sunInt,amb:p.amb,tod:p.tod};
}
let lastS='';
function apply(syncGame){
 OWM.fx.wind=cur.p.wind;
 if(cur.p.rays>0&&S.shadow===0)S.shadow=1;   // god rays usam o shadow map do sol: sombras ligadas sempre que o efeito estiver ativo
 S.bloom=cur.p.bloom>0?1:0;
 if(OWM.post&&OWM.post.setFx)OWM.post.setFx(toFx(cur.p));
 const now=PERFK.map(k=>S[k]).join()+S.bloom;
 if(syncGame!==false&&lastS&&now!==lastS){st('bc.s',S);if(OWM.applyAll)OWM.applyAll()}
 lastS=now;persist();
}
function setPerf(perf){if(!perf)return;for(const k of PERFK)if(perf[k]!==undefined)S[k]=perf[k]}
function applyPreset(pr){
 cur.id=pr.id||'custom';cur.n=pr.n;cur.p={...DEFP,...pr.p};setPerf(pr.perf);
 if(pr.perf&&pr.perf.bloom!==undefined&&pr.p.bloom===undefined)cur.p.bloom=pr.perf.bloom;
 if(pr.id==='padrao')cur.p.bloom=1;
 apply();refreshUI();
}
const clampP=p=>{const o={...DEFP};for(const q of PARAMS)if(typeof p[q.k]==='number'&&isFinite(p[q.k]))o[q.k]=clamp(p[q.k],q.min,q.max);return o};

/* ---------- Código para compartilhar ---------- */
const exportCode=()=>{const perf={};PERFK.forEach(k=>perf[k]=S[k]);return'OWMFX1:'+btoa(unescape(encodeURIComponent(JSON.stringify({n:cur.n,p:cur.p,perf}))))};
function importCode(code){
 try{code=String(code||'').trim();if(!code.startsWith('OWMFX1:'))throw 0;
  const o=JSON.parse(decodeURIComponent(escape(atob(code.slice(7)))));
  const perf={};if(o.perf)for(const k of PERFK)if(typeof o.perf[k]==='number')perf[k]=clamp(Math.round(o.perf[k]),0,k==='dist'?30:2);
  return{id:'custom',n:String(o.n||'Importado').slice(0,28),p:clampP(o.p||{}),perf}
 }catch(e){return null}
}

/* ---------- Interface ---------- */
const css=document.createElement('style');css.textContent=`
body.fx-editing #ui,body.fx-editing .main-hub,body.fx-editing #hud,body.fx-editing #look,body.fx-editing #joy,body.fx-editing .tb,body.fx-editing #collect,body.fx-editing #hint,body.fx-editing #bPause{visibility:hidden!important;pointer-events:none!important}
#fxp{position:fixed;top:0;right:0;bottom:0;width:min(390px,100vw);z-index:2147483000;display:none;touch-action:pan-y;overscroll-behavior:contain;flex-direction:column;background:rgba(14,15,22,.93);border-left:2px solid #3a3d4a;color:#fff;font-family:var(--f,system-ui);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
#fxp.on{display:flex}
#fxp *{box-sizing:border-box}
#fxp .fh{flex:none;display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--ln,#fff3)}
#fxp .fh h3{margin:0;font-size:17px;font-weight:800;flex:1}
#fxp .fps{font:700 12px var(--fp,monospace);padding:3px 7px;border-radius:6px;background:#0008}
#fxp button{font-family:inherit;cursor:pointer}
#fxp .x{width:32px;height:32px;border-radius:8px;border:2px solid #3a3d4a;background:#23252f;color:#fff;font-size:18px}
#fxp .tools{display:flex;gap:6px;padding:0}
#fxp .tb2{flex:1;min-height:36px;padding:6px 8px;border-radius:8px;border:2px solid #3a3d4a;background:linear-gradient(#2e303c,#23252f);color:#fff;font-weight:700;font-size:12.5px;touch-action:manipulation;user-select:none;-webkit-user-select:none}
#fxp .tb2:hover{border-color:#fff}
#fxp .meter{margin:8px 0 0;padding:8px 10px;border-radius:10px;background:#0006;border:1px solid var(--ln,#fff3)}
#fxp .meter .mt{display:flex;justify-content:space-between;font-size:12px;font-weight:700}
#fxp .bar{height:8px;border-radius:5px;background:#fff2;margin-top:6px;overflow:hidden}
#fxp .bar i{display:block;height:100%;width:0;border-radius:5px;transition:width .2s,background .2s}
#fxp .mdet{font-size:11px;opacity:.72;margin-top:5px;line-height:1.35}
#fxp .tabs{display:flex;gap:4px;padding:6px 12px 0;flex:none}
#fxp .tab{flex:1;padding:8px 2px;border:0;border-bottom:3px solid transparent;background:none;color:#fffa;font-weight:800;font-size:13px}
#fxp .tab.a{color:#fff;border-bottom-color:var(--ac,#ff3b4e)}
#fxp .body{flex:1 1 0;min-height:0;overflow-y:auto;overflow-x:hidden;padding:10px 12px 28px;-webkit-overflow-scrolling:touch;touch-action:pan-y}
#fxp .content{display:block}
#fxp input[type=range]{touch-action:pan-x}
#fxp .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#fxp .card{position:relative;text-align:left;padding:0;border-radius:10px;border:2px solid #3a3d4a;background:#1b1d27;color:#fff;overflow:hidden;min-height:100px}
#fxp .card:hover{border-color:#fff}
#fxp .card.a{border-color:var(--ac,#ff3b4e);box-shadow:0 0 0 2px #ff3b4e55}
#fxp .card .sw{height:30px}
#fxp .card .ct{padding:6px 8px 8px}
#fxp .card b{display:block;font-size:13px;margin-bottom:2px}
#fxp .card span.d{display:block;font-size:10.5px;opacity:.75;line-height:1.3}
#fxp .card em{position:absolute;top:6px;right:6px;font:700 10px var(--f,sans-serif);font-style:normal;padding:2px 6px;border-radius:9px;background:#000a}
#fxp h4{margin:14px 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7}
#fxp h4:first-child{margin-top:2px}
#fxp .sl2{margin-bottom:11px}
#fxp .sl2 .t{display:flex;justify-content:space-between;font-size:13px;font-weight:700;gap:8px}
#fxp .sl2 .t span:last-child{font-family:var(--fp,monospace);opacity:.85;white-space:nowrap}
#fxp .sl2 .d{font-size:10.5px;opacity:.62;margin:1px 0 3px;line-height:1.3}
#fxp input[type=range]{width:100%;margin:2px 0;accent-color:#ff3b4e;height:22px}
#fxp .seg{display:flex;gap:4px;margin:3px 0 11px}
#fxp .seg button{flex:1;padding:8px 2px;border-radius:7px;border:2px solid #3a3d4a;background:#1b1d27;color:#fff;font-weight:700;font-size:12px}
#fxp .seg button.a{background:#ff3b4e;border-color:#ff3b4e}
#fxp .lbl{font-size:13px;font-weight:700}
#fxp .hint{font-size:11px;opacity:.7;line-height:1.4;margin:4px 0 10px}
#fxp input[type=text],#fxp textarea{width:100%;padding:9px;border-radius:8px;border:2px solid #3a3d4a;background:#0b0c12;color:#fff;font:600 13px var(--f,sans-serif)}
#fxp textarea{min-height:64px;resize:vertical;font-size:11px}
#fxp .row2{display:flex;gap:6px;margin:6px 0}
#fxp .it{display:flex;align-items:center;gap:6px;padding:7px 8px;border-radius:8px;background:#1b1d27;border:1px solid #fff2;margin-bottom:6px;font-size:13px;font-weight:700}
#fxp .it b{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fxp .it button{padding:5px 9px;border-radius:6px;border:2px solid #3a3d4a;background:#2a2d38;color:#fff;font-weight:700;font-size:12px}
@media (max-width:700px) and (orientation:portrait){
 #fxp{top:auto;left:0;right:0;width:100%;height:72vh;height:72dvh;border-left:0;border-top:2px solid #3a3d4a}
 #fxp .grid{grid-template-columns:1fr 1fr}
}
@media (orientation:landscape) and (max-height:600px){
 #fxp{top:0;bottom:0;right:0;left:auto;height:100%;width:min(460px,52vw);border-top:0;border-left:2px solid #3a3d4a}
 #fxp .fh{padding:6px 10px}#fxp .fh h3{font-size:15px}
 #fxp .x{width:30px;height:30px}
 #fxp .tb2{min-height:32px;font-size:12px}
 #fxp .meter{padding:6px 8px}#fxp .mdet{display:none}
 #fxp .tab{padding:6px 2px;font-size:12px}
 #fxp .grid{grid-template-columns:1fr 1fr}
}
`;
document.head.appendChild(css);

let panel=null,tabEl=null,scrollEl,bodyEl,meterEl,fpsEl,tab='estilos',open_=false,prevHub=null,raf=0;

function mk(t,c,x,p){return E(t,c,x,p)}
function build(){
 panel=mk('div','',null,document.body);panel.id='fxp';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Editor de shaders');
 panel.addEventListener('keydown',e=>{if(e.key==='Escape')close();e.stopPropagation()});panel.addEventListener('keyup',e=>e.stopPropagation());
 const h=mk('div','fh',null,panel);mk('h3','','✨ Shaders',h);fpsEl=mk('span','fps','-- FPS',h);
 const x=mk('button','x','✕',h);x.setAttribute('aria-label','Fechar');x.onclick=close;
 const tabs=mk('div','tabs',null,panel);tabEl={};
 for(const[id,l]of[['estilos','Estilos'],['ajustes','Ajustes'],['perf','Desempenho'],['meus','Meus']]){const b=mk('button','tab',l,tabs);b.onclick=()=>{tab=id;refreshUI()};tabEl[id]=b}
 scrollEl=mk('div','body',null,panel);
 const tools=mk('div','tools',null,scrollEl);
 const cmp=mk('button','tb2','👁 Segurar para comparar',tools);
 const off=()=>{if(OWM.post.setFx)OWM.post.setFx(toFx({...DEFP,bloom:cur.p.bloom},false))},on=()=>{if(OWM.post.setFx)OWM.post.setFx(toFx(cur.p))};
 cmp.addEventListener('pointerdown',e=>{cmp.setPointerCapture&&cmp.setPointerCapture(e.pointerId);off()});['pointerup','pointercancel','pointerleave'].forEach(n=>cmp.addEventListener(n,on));
 mk('button','tb2','↺ Restaurar padrão',tools).onclick=()=>applyPreset(PRESETS[0]);
 meterEl=mk('div','meter',null,scrollEl);
 bodyEl=mk('div','content',null,scrollEl);bodyEl.style.marginTop='10px';
}
function refreshMeter(){
 const c=cost(cur.p),[lv,col]=level(c.t);meterEl.textContent='';
 const t=mk('div','mt',null,meterEl);mk('span','','Custo estimado: '+lv,t).style.color=col;mk('span','','+'+c.t.toFixed(0)+' pts',t);
 const b=mk('div','bar',null,meterEl),i=mk('i','',null,b);i.style.width=clamp(c.t/60*100,3,100)+'%';i.style.background=col;
 const top=Object.entries(c.parts).filter(a=>a[1]>=2).sort((a,b)=>b[1]-a[1]).slice(0,3).map(a=>a[0]).join(' · ');
 mk('div','mdet',top?'Mais pesados agora: '+top+'. Veja a aba Desempenho para reduzir.':'Tudo leve: este visual quase não custa FPS.',meterEl);
}
function sliderRow(parent,q){
 const d=mk('div','sl2',null,parent),t=mk('div','t',null,d),l=mk('span','',q.l,t),v=mk('span','',null,t);
 const fmt=q.fmt||(x=>(Math.round(x*100)/100).toString());
 mk('div','d',q.d,d);const inp=mk('input','',null,d);inp.type='range';inp.min=q.min;inp.max=q.max;inp.step=q.step;inp.value=cur.p[q.k];
 const sync=()=>{v.textContent=fmt(+inp.value)};sync();
 inp.oninput=()=>{cur.p[q.k]=+inp.value;sync();cur.id='custom';cur.n='Personalizado';
  if(q.k==='rays'&&cur.p.rays>0&&S.shadow===0){S.shadow=1;OWM.toast&&OWM.toast('Sombras ligadas para os god rays aparecerem')}
  if((q.k==='vol'||q.k==='volDens')&&cur.p[q.k]>0&&S.vfog===0&&OWM.post.hasVolFog&&OWM.post.hasVolFog()){S.vfog=1;OWM.toast&&OWM.toast('Névoa volumétrica ligada para a luz aparecer')}
  apply();refreshMeter()};
 l.title='Toque duas vezes para voltar ao normal';l.ondblclick=()=>{cur.p[q.k]=q.def;inp.value=q.def;sync();apply();refreshMeter()};
}
function seg(parent,label,key,names,min=0){
 mk('div','lbl',label,parent);const s=mk('div','seg',null,parent);
 names.forEach((n,i)=>{const b=mk('button',S[key]===i+min?'a':'',n,s);b.onclick=()=>{S[key]=i+min;cur.id='custom';cur.n='Personalizado';apply();refreshUI()}})}
function viewEstilos(){
 const g=mk('div','grid',null,bodyEl);
 const card=(pr,del)=>{const b=mk('button','card'+(cur.id===pr.id&&cur.n===pr.n?' a':''),null,g);
  const sw=mk('div','sw',null,b);sw.style.background='linear-gradient(90deg,'+(pr.sw||'#555,#999')+')';
  const t=mk('div','ct',null,b);mk('b','',pr.n,t);mk('span','d',pr.d||'Estilo salvo por você.',t);
  const c=cost({...DEFP,...pr.p},{...S,...(pr.perf||{})}),[lv,col]=level(c.t);const e=mk('em','',lv,b);e.style.color=col;
  b.onclick=()=>applyPreset(pr)};
 PRESETS.forEach(p=>card(p));customs.forEach((c,i)=>card({id:'c'+i,n:c.n,p:c.p,perf:c.perf,sw:'#6a5acd,#c9a0ff',d:'Seu estilo salvo.'}));
 mk('div','hint','Dica: escolha um estilo e depois ajuste do seu jeito na aba “Ajustes”. A etiqueta de cada cartão mostra o quanto ele pesa no FPS.',bodyEl).style.marginTop='10px';
}
function viewAjustes(){
 let gr='';for(const q of PARAMS){if(q.g!==gr){gr=q.g;mk('h4','',gr,bodyEl)}sliderRow(bodyEl,q)}
}
function viewPerf(){
 const tn=['Fraco','Médio','Bom','Topo'][OWM.tier]||'?';
 mk('div','hint','Seu aparelho foi detectado como nível “'+tn+'”. O botão abaixo escolhe sozinho as opções ideais e liga a resolução dinâmica, que baixa a resolução só quando o FPS cai.',bodyEl);
 const o=mk('button','tb2','⚡ Otimizar para o meu aparelho',bodyEl);o.style.width='100%';o.style.marginBottom='12px';
 o.onclick=()=>{const t=TIERP[clamp(OWM.tier|0,0,3)];setPerf(t);cur.p.bloom=t.bloom;cur.id='custom';cur.n='Otimizado';apply();refreshUI();OWM.toast&&OWM.toast('Otimizado para o nível '+tn)};
 seg(bodyEl,'Sombras','shadow',['Desligadas','Médias','Altas']);
 seg(bodyEl,'Névoa volumétrica','vfog',['Desligada','Normal','Alta']);
 seg(bodyEl,'Bordas suaves (FXAA)','aa',['Não','Sim']);
 seg(bodyEl,'Detalhe das árvores','tq',['Alto','Médio','Leve']);
 seg(bodyEl,'Resolução dinâmica','dyn',['Não','Sim']);
 const d=mk('div','sl2',null,bodyEl),t=mk('div','t',null,d);mk('span','','Distância de visão',t);const v=mk('span','',S.dist+' chunks',t);
 mk('div','d','Quanto do mundo aparece (até 30). É o que mais pesa: acima de 12 só em aparelhos potentes, senão o FPS despenca e os chunks demoram a carregar.',d);
 const inp=mk('input','',null,d);inp.type='range';inp.min=2;inp.max=30;inp.step=1;inp.value=S.dist;
 inp.oninput=()=>{S.dist=+inp.value;v.textContent=S.dist+' chunks';cur.id='custom';cur.n='Personalizado';apply();refreshMeter()};
 mk('h4','','Quanto cada efeito pesa',bodyEl);
 const c=cost(cur.p);for(const[k,val]of Object.entries(c.parts).sort((a,b)=>b[1]-a[1])){const r=mk('div','sl2',null,bodyEl),tt=mk('div','t',null,r);mk('span','',k,tt);mk('span','','+'+val.toFixed(1),tt);const b=mk('div','bar',null,r),i=mk('i','',null,b);i.style.width=clamp(val/20*100,val>0?4:0,100)+'%';i.style.background=level(val*2)[1]}
 mk('div','hint','Os pontos são uma estimativa para comparar efeitos entre si; o FPS real depende do seu aparelho (o contador no topo mostra o valor ao vivo).',bodyEl);
}
function viewMeus(){
 mk('div','lbl','Salvar o visual atual',bodyEl);
 const nm=mk('input','',null,bodyEl);nm.type='text';nm.placeholder='Dê um nome (ex.: Meu verão)';nm.maxLength=28;nm.value=cur.id==='custom'||cur.id==='padrao'?'':cur.n;
 const r=mk('div','row2',null,bodyEl);
 mk('button','tb2','💾 Salvar',r).onclick=()=>{const n=nm.value.trim()||('Shader '+(customs.length+1)),perf={};PERFK.forEach(k=>perf[k]=S[k]);customs.push({n,p:{...cur.p},perf});cur.n=n;cur.id='c'+(customs.length-1);persist();OWM.toast&&OWM.toast('Salvo: '+n);refreshUI()};
 mk('h4','','Meus shaders',bodyEl);
 if(!customs.length)mk('div','hint','Nenhum ainda. Ajuste o visual e salve acima.',bodyEl);
 customs.forEach((c,i)=>{const it=mk('div','it',null,bodyEl);mk('b','',c.n,it);mk('button','','Usar',it).onclick=()=>applyPreset({id:'c'+i,n:c.n,p:c.p,perf:c.perf});mk('button','','🗑',it).onclick=()=>{customs.splice(i,1);persist();refreshUI()}});
 mk('h4','','Compartilhar',bodyEl);
 mk('div','hint','Copie o código para mandar a um amigo, ou cole o código de outro jogador para usar o visual dele.',bodyEl);
 const ta=mk('textarea','',null,bodyEl);ta.placeholder='Cole aqui um código OWMFX1:…';
 const r2=mk('div','row2',null,bodyEl);
 mk('button','tb2','📋 Copiar meu código',r2).onclick=()=>{const code=exportCode();ta.value=code;ta.select();let ok=false;try{ok=navigator.clipboard&&navigator.clipboard.writeText(code)}catch(e){}try{if(!ok)ok=document.execCommand('copy')}catch(e){}OWM.toast&&OWM.toast(ok?'Código copiado!':'Código gerado — copie do campo acima')};
 mk('button','tb2','📥 Usar código',r2).onclick=()=>{const o=importCode(ta.value);if(!o){OWM.toast&&OWM.toast('Código inválido');return}applyPreset(o);OWM.toast&&OWM.toast('Shader “'+o.n+'” aplicado')};
}
function refreshUI(){
 if(!panel)return;for(const k in tabEl)tabEl[k].classList.toggle('a',k===tab);
 const sc=scrollEl.scrollTop;bodyEl.textContent='';refreshMeter();
 ({estilos:viewEstilos,ajustes:viewAjustes,perf:viewPerf,meus:viewMeus})[tab]();scrollEl.scrollTop=sc;
}
function fpsLoop(){
 let n=0,t0=performance.now();
 const f=now=>{if(!open_)return;n++;if(now-t0>500){const v=Math.round(n*1000/(now-t0));fpsEl.textContent=v+' FPS';fpsEl.style.color=v>=55?'#5fd36b':v>=35?'#ffcf4a':'#ff6a5a';n=0;t0=now}raf=requestAnimationFrame(f)};
 raf=requestAnimationFrame(f);
}
function open(){
 if(!panel)build();
 if(OWM.post&&OWM.post.hasFx&&!OWM.post.hasFx()){OWM.toast&&OWM.toast('Seu aparelho não suporta pós-processamento: os shaders ficam indisponíveis.');return}
 open_=true;panel.classList.add('on');document.body.classList.add('fx-editing');
 if(document.pointerLockElement&&document.exitPointerLock)document.exitPointerLock();
 refreshUI();fpsLoop();
}
function close(){
 if(!open_)return;open_=false;cancelAnimationFrame(raf);panel.classList.remove('on');document.body.classList.remove('fx-editing');
 st('bc.fx',cur);st('bc.fxl',customs);st('bc.s',S);
}

OWM.shaders={open,close,apply,presets:PRESETS,cost,exportCode,importCode,get current(){return cur}};
/* aplica o shader salvo quando tudo (incl. postprocess.js) já carregou */
addEventListener('load',()=>{apply(false)});
})();
