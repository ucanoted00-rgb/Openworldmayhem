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
const DEF={fov:70,dist:6,sens:100,bright:50,fancy:0,fps:0,invert:0,bob:1,shadow:touch?1:2,tone:2,vig:1,camMode:0,hdTex:0,bloom:1,vfog:touch?1:2,lockMouse:1,dyn:1,mvol:50,collect:1};
const saved=ld('bc.s',{});
if(!saved.v){saved.tone=2;try{localStorage.setItem('bc.s',JSON.stringify(saved))}catch(e){}}
const S={...DEF,...saved};S.v=1;

/* ---------- Renderer, cena e câmera ---------- */
const R=new THREE.WebGLRenderer({canvas:$('#c'),antialias:false,powerPreference:'high-performance'});
R.outputEncoding=THREE.sRGBEncoding;
R.toneMapping=THREE.ReinhardToneMapping;
R.toneMappingExposure=1.2;
const scene=new THREE.Scene();
const cam=new THREE.PerspectiveCamera(85,1,.1,200);cam.rotation.order='YXZ';scene.add(cam);

/* ---------- Sistema de telas ---------- */
const screens={};
function mkScreen(id,title,cls){const s=E('div','screen '+(cls||'solid')+' hidden',null,$('#ui'));if(title)E('h2','',title,s);return screens[id]=s}
const go=id=>{for(const k in screens)screens[k].classList.toggle('hidden',k!==id);if(OWM.onScreen)OWM.onScreen(id)};
const row=p=>E('div','row',null,p);
const fld=(l,p)=>{const d=E('div','fld',null,p);E('label','',l,d);return E('input','',null,d)};
function toast(t){const e=$('#toast');e.textContent=t;e.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.add('hidden'),2200)}

window.OWM={$,cl,E,B,touch,hash,rng,ld,st,px,DEF,S,R,scene,cam,screens,mkScreen,go,row,fld,toast,extraMats:[]};
})();