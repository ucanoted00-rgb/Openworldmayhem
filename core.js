/* Open World Mayhem — núcleo. */
(()=>{
const $=s=>document.querySelector(s),cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const E=(t,c,x,p)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;if(p)p.appendChild(e);return e};
const B=(t,f,p,c)=>{const b=E('button','btn'+(c?' '+c:''),t,p);b.onclick=f;return b};
const touch=matchMedia('(pointer:coarse)').matches||'ontouchstart' in window;
if(touch)document.body.classList.add('touch');
function hash(s){let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))|0;return h}
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const ld=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}};
const st=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
function px(n,f){const c=document.createElement('canvas');c.width=c.height=n;const g=c.getContext('2d');for(let y=0;y<n;y++)for(let x=0;x<n;x++){g.fillStyle=f(x,y);g.fillRect(x,y,1,1)}return c.toDataURL()}

/* ---------- Configurações ---------- */
/* tone: 0=none 1=linear 2=Reinhard 3=Cineon 4=ACES — padrão Reinhard */
const DEF={fov:70,dist:6,sens:100,bright:50,rq:5,fps:0,invert:0,bob:1,shadow:touch?1:2,tone:2,vig:1,camMode:0,hdTex:0,bloom:1,vfog:touch?1:2,lockMouse:1,dyn:1,mvol:50,collect:1,charQ:touch?1:2,cloth:1,sand:1};
const saved=ld('bc.s',{});
if(!saved.v){saved.tone=2;try{localStorage.setItem('bc.s',JSON.stringify(saved))}catch(e){}}
const S={...DEF,...saved};S.v=1;

/* ---------- Renderer, cena e câmera ---------- */
const R=new THREE.WebGLRenderer({canvas:$('#c'),antialias:false,powerPreference:'high-performance'});
R.outputEncoding=THREE.sRGBEncoding;
R.toneMapping=THREE.ReinhardToneMapping;
R.toneMappingExposure=1.2;

/* ---------- Nível do aparelho (0 fraco · 1 médio · 2 bom · 3 topo) ----------
   Mistura a GPU (nome real via WEBGL_debug_renderer_info) com núcleos de CPU e RAM. Só serve de PONTO DE PARTIDA: a resolução dinâmica (postprocess.js)
   ajusta depois, em tempo real, pelo FPS que o aparelho realmente entrega. */
function detectDevice(){
 const nav=navigator,cores=nav.hardwareConcurrency||4,mem=nav.deviceMemory||0;   // deviceMemory não existe no Safari/Firefox (0 = desconhecido)
 let gpu='';
 try{const gl=R.getContext(),x=gl.getExtension('WEBGL_debug_renderer_info');gpu=String(x?gl.getParameter(x.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)||'')}catch(e){}
 const g=gpu.toLowerCase();let gt=-1,m;
 if(/swiftshader|llvmpipe|software|basic render/.test(g))gt=0;
 else if((m=g.match(/adreno[^0-9]*(\d{3})/))){const n=+m[1];gt=n>=730?3:n>=650?2:n>=610?1:0}   // 5xx e abaixo = fraco; 6xx = médio; 650+ = bom; 730+ = topo
 else if((m=g.match(/mali-?g?(\d{2,3})/))&&/mali-g/.test(g)){const n=+m[1];gt=n<=52||n===71||n===72?0:(n===57||n===68||n===76||n===610)?1:n>=715||n>=810?3:2}
 else if(/mali-t|mali-4|powervr|sgx|videocore/.test(g))gt=0;
 else if(/apple/.test(g))gt=cores>=8?3:cores>=6?2:1;   // Safari esconde o modelo: A12+ e M têm 6+ núcleos
 else if(/rtx|geforce|radeon rx|radeon pro|arc a|rx \d/.test(g))gt=3;
 else if(/iris|xe graphics|radeon\(tm\) graphics|radeon graphics|vega/.test(g))gt=2;
 else if(/intel|uhd|hd graphics|gma/.test(g))gt=1;
 else if(/nvidia|amd|ati/.test(g))gt=2;
 const ct=cores>=8?3:cores>=6?2:cores>=4?1:0,mt=mem?(mem>=8?3:mem>=4?2:mem>=3?1:0):ct;
 const hw=Math.round((ct+mt)/2),tier=gt<0?hw:Math.min(gt,Math.round((gt+hw)/2));   // GPU conhecida manda (CPU/RAM só podem baixar: celular barato com 8 núcleos fracos não engana)
 /* celular nunca passa do nível 2 (bateria/calor); PC/notebook sem GPU dedicada identificada parte de 1 */
 return{tier:Math.max(0,Math.min(touch?2:3,tier)),gpu:gpu||'?',cores,mem,gt};
}
const scene=new THREE.Scene();
const DEVICE=detectDevice();
const cam=new THREE.PerspectiveCamera(85,1,.1,200);cam.rotation.order='YXZ';scene.add(cam);

/* ---------- Sistema de telas ---------- */
const screens={};
function mkScreen(id,title,cls){const s=E('div','screen '+(cls||'solid')+' hidden',null,$('#ui'));s.dataset.scr=id;if(title)E('h2','',title,s);return screens[id]=s}
const go=id=>{for(const k in screens)screens[k].classList.toggle('hidden',k!==id);if(OWM.onScreen)OWM.onScreen(id)};
const row=p=>E('div','row',null,p);
const fld=(l,p)=>{const d=E('div','fld',null,p);E('label','',l,d);return E('input','',null,d)};
function toast(t){const e=$('#toast');e.textContent=t;e.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.add('hidden'),2200)}

/* Primeira execução desta versão: resolução "Automática" + dinâmica ligada, e (só em aparelho fraco/médio) alcance e efeitos pesados mais leves.
   Depois disso, tudo que o jogador mexer nas Configurações é respeitado. */
if(!S.v2){
 S.v2=1;S.rq=5;S.dyn=1;
 if(DEVICE.tier<=0){S.dist=Math.min(S.dist,4);S.shadow=Math.min(S.shadow,1);S.vfog=0;S.bloom=0;S.charQ=Math.min(S.charQ,0);S.cloth=0}
 else if(DEVICE.tier===1){S.dist=Math.min(S.dist,5);S.shadow=Math.min(S.shadow,1);S.vfog=Math.min(S.vfog,1);S.charQ=Math.min(S.charQ,1)}
 st('bc.s',S);
}
window.OWM={tier:DEVICE.tier,device:DEVICE,$,cl,E,B,touch,hash,rng,ld,st,px,DEF,S,R,scene,cam,screens,mkScreen,go,row,fld,toast,extraMats:[]};
})();