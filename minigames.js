/* Open World Mayhem — Tokens e minigames.
   Tela inicial → "Tokens": menu de minigames; a quantidade de tokens fica no canto superior direito (salva em localStorage 'bc.tokens').
   Minigame 1 — "Achar os tokens": um mundo escuro, com pouca luz (só a sua lanterna), e dois tokens (moedas amarelas) escondidos.
   Cada token vale +1 token. Um brilho fraco e um "ping" que acelera ajudam a achar o caminho. Cena própria (renderer próprio, como o criador de personagem):
   o jogo principal só chama OWM.mini.tick(dt) enquanto state==='mini'. Controles: WASD/setas + mouse (Shift corre) · toque: arraste a metade esquerda
   para andar e a direita para olhar. */
(()=>{
const {E,B,mkScreen,go,ld,st}=OWM,touch=!!OWM.touch||('ontouchstart' in window);
const KEY='bc.tokens',BEST='bc.mg1best';

/* ---------- tokens (moeda do jogo) ---------- */
const subs=new Set();
const tokens={
 get(){const v=Math.floor(+ld(KEY,0));return v>0?v:0},
 add(k){st(KEY,tokens.get()+Math.max(0,k|0));subs.forEach(f=>f())},
 on(f){subs.add(f)},
};
OWM.tokens=tokens;
const coinIcon=p=>E('span','tk-coin',null,p);
function counter(parent,cls){const d=E('div','tk-count '+(cls||''),null,parent);coinIcon(d);const n=E('b','',null,d);const up=()=>{n.textContent=tokens.get()};up();tokens.on(up);return d}

/* ---------- menu de minigames ---------- */
const TS=mkScreen('tokens',null,'title tokens');
counter(TS,'tk-corner');
E('h2','tk-title','Tokens',TS);
E('div','dsc','Jogue minigames para ganhar tokens.',TS);
const list=E('div','tk-list',null,TS);
const GAMES=[
 {id:'find',name:'Achar os tokens',desc:'Um mundo escuro, só você e uma lanterna. Encontre os 2 tokens amarelos escondidos.',reward:'+1 token por moeda',play:()=>startFind()},
];
const cards={};
for(const g of GAMES){
 const c=E('div','tk-card',null,list),h=E('div','tk-ch',null,c);E('b','',g.name,h);E('span','tk-rw',g.reward,h);
 E('p','',g.desc,c);const best=E('p','tk-best',null,c);cards[g.id]=best;
 B('Jogar',g.play,c);
}
E('div','dsc tk-soon','Mais minigames em breve…',TS);
B('Voltar',()=>go('title'),TS);
function refreshMenu(){const b=+ld(BEST,0);cards.find.textContent=b?'Melhor tempo: '+fmt(b):'Ainda sem recorde';}
const fmt=t=>{t=Math.max(0,t);const m=Math.floor(t/60),s=Math.floor(t%60);return m+':'+String(s).padStart(2,'0')};
OWM.tokensOpen=()=>{refreshMenu();go('tokens')};

/* ---------- minigame 1: achar os tokens ---------- */
const MS=mkScreen('mg-find',null,'mg');
const cv=E('canvas','mg-cv',null,MS);
const hud=E('div','mg-hud',null,MS);
const hFound=E('div','mg-pill',null,hud),hTime=E('div','mg-pill mg-time',null,hud);
const hTok=counter(hud,'tk-corner');
const hCross=E('div','mg-cross',null,MS);
const hFlash=E('div','mg-flash',null,MS);
const hMsg=E('div','mg-msg',null,MS);
const hPause=touch?B('☰',()=>pause(true),MS):null;if(hPause)hPause.classList.add('mg-pbtn');
const ov=E('div','mg-ov',null,MS),ovBox=E('div','mg-box',null,ov);

let G=null,keys={},mx=0,mz=0;   // G = estado da partida em andamento
const mulberry=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
function glowTex(){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,230,120,1)');r.addColorStop(.35,'rgba(255,190,40,.45)');r.addColorStop(1,'rgba(255,160,0,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)}

function build(seed){
 const rnd=mulberry(seed),R=62,ph=[0,1,2,3,4,5].map(()=>rnd()*6.28);
 const H=(x,z)=>Math.sin(x*.045+ph[0])*Math.cos(z*.04+ph[1])*2.2+Math.sin(x*.11+ph[2]+z*.07)*.8+Math.cos(z*.13+ph[3]-x*.05)*.6;
 const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:!touch,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,touch?1.5:2));
 const scene=new THREE.Scene(),FOG=0x04060b;scene.background=new THREE.Color(FOG);scene.fog=new THREE.FogExp2(FOG,.052);
 const cam=new THREE.PerspectiveCamera(72,1,.1,160);
 scene.add(new THREE.AmbientLight(0x20304a,.5));
 const moon=new THREE.DirectionalLight(0x6a86c8,.22);moon.position.set(-30,50,20);scene.add(moon);
 const lamp=new THREE.PointLight(0xffd9a0,1.5,15,2);scene.add(lamp);   // lanterna do jogador
 /* chão */
 const SEG=62,gg=new THREE.PlaneGeometry(R*2+30,R*2+30,SEG,SEG);gg.rotateX(-Math.PI/2);
 const pos=gg.attributes.position,col=new Float32Array(pos.count*3);
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),y=H(x,z);pos.setY(i,y);const v=.7+.5*rnd();col[i*3]=.07*v;col[i*3+1]=.12*v;col[i*3+2]=.09*v}
 gg.setAttribute('color',new THREE.BufferAttribute(col,3));gg.computeVertexNormals();
 scene.add(new THREE.Mesh(gg,new THREE.MeshLambertMaterial({vertexColors:true})));
 /* estrelas (sem névoa) */
 const sp=new Float32Array(300*3);for(let i=0;i<300;i++){const a=rnd()*6.283,e=.15+rnd()*1.2,r=140;sp[i*3]=Math.cos(a)*Math.cos(e)*r;sp[i*3+1]=Math.sin(e)*r;sp[i*3+2]=Math.sin(a)*Math.cos(e)*r}
 const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
 scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xbcd0ff,size:1.4,sizeAttenuation:false,fog:false,transparent:true,opacity:.7})));
 /* árvores e pedras (instanciadas) + colisão por círculos */
 const obst=[],M=new THREE.Matrix4(),Q=new THREE.Quaternion(),Pp=new THREE.Vector3(),Sc=new THREE.Vector3(),C=new THREE.Color();
 const NT=300,trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.24,2.4,6),new THREE.MeshLambertMaterial({color:0x2a1c12}),NT);
 const c1=new THREE.InstancedMesh(new THREE.ConeGeometry(1.4,3,7),new THREE.MeshLambertMaterial({color:0xffffff}),NT),c2=new THREE.InstancedMesh(new THREE.ConeGeometry(1,2.4,7),new THREE.MeshLambertMaterial({color:0xffffff}),NT);
 let nt=0;
 for(let tries=0;nt<NT&&tries<NT*6;tries++){
  const a=rnd()*6.283,d=Math.sqrt(rnd())*(R+8);if(d<7)continue;const x=Math.cos(a)*d,z=Math.sin(a)*d,y=H(x,z),s=.8+rnd()*.8;
  trunk.setMatrixAt(nt,M.compose(Pp.set(x,y+1.2*s,z),Q.identity(),Sc.set(s,s,s)));
  c1.setMatrixAt(nt,M.compose(Pp.set(x,y+3.2*s,z),Q.identity(),Sc.set(s,s,s)));c2.setMatrixAt(nt,M.compose(Pp.set(x,y+5*s,z),Q.identity(),Sc.set(s,s,s)));
  C.setRGB(.03+.05*rnd(),.1+.1*rnd(),.07+.06*rnd());c1.setColorAt(nt,C);c2.setColorAt(nt,C);
  obst.push([x,z,.42*s+.1]);nt++;
 }
 trunk.count=c1.count=c2.count=nt;scene.add(trunk,c1,c2);
 const NR=70,rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:0x2b2f36}),NR);let nr=0;
 for(let tries=0;nr<NR&&tries<NR*6;tries++){const a=rnd()*6.283,d=Math.sqrt(rnd())*(R+4);if(d<6)continue;const x=Math.cos(a)*d,z=Math.sin(a)*d,s=.5+rnd()*1.1;
  rocks.setMatrixAt(nr,M.compose(Pp.set(x,H(x,z)+s*.35,z),Q.setFromEuler(new THREE.Euler(rnd()*3,rnd()*3,rnd()*3)),Sc.set(s*1.2,s*.75,s)));obst.push([x,z,s*.85]);nr++}
 rocks.count=nr;scene.add(rocks);
 /* moedas: longe do início e longe uma da outra, fora de árvores/pedras */
 const free=(x,z,m)=>{for(const o of obst)if(Math.hypot(o[0]-x,o[1]-z)<o[2]+m)return false;return true};
 const spots=[];
 for(let tries=0;spots.length<2&&tries<400;tries++){
  const a=rnd()*6.283,d=24+rnd()*(R-30),x=Math.cos(a)*d,z=Math.sin(a)*d;
  if(!free(x,z,1.6))continue;if(spots.some(s=>Math.hypot(s[0]-x,s[1]-z)<38))continue;spots.push([x,z]);
 }
 while(spots.length<2)spots.push([spots.length?-30:30,spots.length?-30:30]);
 const gt=glowTex(),coins=[],gold=new THREE.MeshStandardMaterial({color:0xffd21f,emissive:0xff9d00,emissiveIntensity:.6,metalness:.7,roughness:.35});
 for(const[x,z]of spots){
  const g=new THREE.Group(),disc=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.07,28),gold);disc.rotation.x=Math.PI/2;g.add(disc);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.27,.025,8,28),gold);g.add(ring);
  const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:gt,transparent:true,opacity:.42,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));gl.scale.set(1.7,1.7,1);g.add(gl);
  const pl=new THREE.PointLight(0xffc233,.8,4.2,2);g.add(pl);
  g.position.set(x,H(x,z)+1.05,z);scene.add(g);coins.push({g,x,z,y:g.position.y,got:false,gl,pl,ph:rnd()*6});
 }
 /* vaga-lumes decorativos (ajudam a dar escala) */
 const NF=40,fp=new Float32Array(NF*3),fl=[];for(let i=0;i<NF;i++){const a=rnd()*6.283,d=rnd()*R,x=Math.cos(a)*d,z=Math.sin(a)*d;fl.push([x,z,rnd()*6]);fp[i*3]=x;fp[i*3+1]=H(x,z)+1+rnd()*2;fp[i*3+2]=z}
 const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.BufferAttribute(fp,3));
 const ff=new THREE.Points(fg,new THREE.PointsMaterial({color:0xbfff8a,size:.14,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(ff);
 return{renderer,scene,cam,lamp,H,R,obst,coins,ff,fl,gt,disposables:[gg,gt,sg,fg,trunk.geometry,c1.geometry,c2.geometry,rocks.geometry]};
}

function startFind(){
 if(G)stopFind(true);
 const seed=(Math.random()*1e9)|0,W=build(seed);
 G={...W,yaw:Math.random()*6.283,pitch:0,x:0,z:0,y:W.H(0,0)+1.65,vy:0,t:0,found:0,state:'ready',bob:0,pingT:0,pingBuf:null,ac:null,seed,msgT:0,flash:0,touches:new Map()};
 OWM.miniState&&OWM.miniState(true);go('mg-find');resize();updHud();showIntro();
 hMsg.textContent='';
}
function showIntro(){
 ovBox.textContent='';ov.classList.add('on');
 E('h2','','Achar os tokens',ovBox);
 E('p','','Está escuro… Só a sua lanterna ilumina o caminho.',ovBox);
 E('p','','Encontre os 2 tokens amarelos escondidos pela floresta. Um brilho fraco e um “ping” ficam mais fortes quando você chega perto.',ovBox);
 E('p','mg-keys',touch?'Arraste a metade esquerda da tela para andar e a direita para olhar.':'WASD / setas: andar · Shift: correr · Mouse: olhar · Esc: pausar',ovBox);
 B(touch?'Toque para começar':'Clique para começar',()=>begin(),ovBox);
 B('Voltar',()=>stopFind(),ovBox);
}
function begin(){
 if(!G)return;ov.classList.remove('on');G.state='play';
 if(!touch){try{const p=cv.requestPointerLock&&cv.requestPointerLock();if(p&&p.catch)p.catch(()=>{})}catch(e){}}
 try{const AC=window.AudioContext||window.webkitAudioContext;if(AC&&!G.ac){G.ac=new AC()}if(G.ac&&G.ac.state==='suspended')G.ac.resume()}catch(e){}
}
function pause(on){
 if(!G||G.state==='done'||G.state==='ready')return;
 if(on){G.state='pause';ovBox.textContent='';ov.classList.add('on');E('h2','','Pausado',ovBox);B('Continuar',()=>begin(),ovBox);B('Sair',()=>stopFind(),ovBox);try{document.exitPointerLock&&document.exitPointerLock()}catch(e){}}
}
function stopFind(silent){
 if(!G)return;const g=G;G=null;keys={};
 try{document.exitPointerLock&&document.exitPointerLock()}catch(e){}
 for(const d of g.disposables)try{d.dispose()}catch(e){}
 try{g.scene.traverse(o=>{if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m.map&&m.map!==g.gt)m.map.dispose();m.dispose()})}if(o.geometry)o.geometry.dispose()})}catch(e){}
 try{g.renderer.dispose();g.renderer.forceContextLoss&&g.renderer.forceContextLoss()}catch(e){}
 try{g.ac&&g.ac.close()}catch(e){}
 ov.classList.remove('on');
 if(!silent){OWM.miniState&&OWM.miniState(false);refreshMenu();go('tokens')}
}
function resize(){if(!G)return;const w=innerWidth,h=innerHeight;G.renderer.setSize(w,h,false);G.cam.aspect=w/h;G.cam.updateProjectionMatrix()}
addEventListener('resize',resize);
function updHud(){if(!G)return;hFound.textContent='Tokens: '+G.found+' / 2';hTime.textContent=fmt(G.t)}
function say(t,ms){hMsg.textContent=t;hMsg.classList.add('on');if(G)G.msgT=ms||2.2}

/* som: ping que acelera e fica mais agudo perto do token mais próximo; moeda pega = acorde curto */
function beep(f,d,v,type){const ac=G&&G.ac;if(!ac||ac.state!=='running')return;const o=ac.createOscillator(),g=ac.createGain();o.type=type||'sine';o.frequency.value=f;g.gain.setValueAtTime(v,ac.currentTime);g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+d);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+d+.02)}

function finish(){
 G.state='done';try{document.exitPointerLock&&document.exitPointerLock()}catch(e){}
 const t=G.t,best=+ld(BEST,0),nb=!best||t<best;if(nb)st(BEST,t);
 ovBox.textContent='';ov.classList.add('on');
 E('h2','','Você achou os dois tokens!',ovBox);
 const r=E('div','mg-reward',null,ovBox);coinIcon(r);E('b','','+2 tokens',r);
 E('p','','Tempo: '+fmt(t)+(nb?'  ·  novo recorde!':'  ·  recorde: '+fmt(best)),ovBox);
 E('p','','Você tem '+tokens.get()+' tokens.',ovBox);
 B('Jogar de novo',()=>startFind(),ovBox);B('Voltar ao menu',()=>stopFind(),ovBox);
}

const _f=new THREE.Vector3();
function tick(dt){
 const g=G;if(!g)return;
 dt=Math.min(dt,.05);
 /* movimento */
 if(g.state==='play'){
  g.t+=dt;
  let ax=0,az=0;
  if(keys.KeyW||keys.ArrowUp)az-=1;if(keys.KeyS||keys.ArrowDown)az+=1;if(keys.KeyA||keys.ArrowLeft)ax-=1;if(keys.KeyD||keys.ArrowRight)ax+=1;
  ax+=mx;az+=mz;const l=Math.hypot(ax,az);if(l>1){ax/=l;az/=l}
  const sp=(keys.ShiftLeft||keys.ShiftRight?7:4.4)*(touch?Math.min(1,l):1),c=Math.cos(g.yaw),s=Math.sin(g.yaw);
  let vx=(c*ax+s*az)*sp,vz=(-s*ax+c*az)*sp,nx=g.x+vx*dt,nz=g.z+vz*dt;
  const d=Math.hypot(nx,nz);if(d>g.R){nx*=g.R/d;nz*=g.R/d}
  for(const o of g.obst){const dx=nx-o[0],dz=nz-o[1],dd=Math.hypot(dx,dz),m=o[2]+.35;if(dd<m&&dd>1e-4){nx=o[0]+dx/dd*m;nz=o[1]+dz/dd*m}}
  const moved=Math.hypot(nx-g.x,nz-g.z);g.x=nx;g.z=nz;g.bob+=moved*2.1;
  const gy=g.H(g.x,g.z)+1.65+Math.sin(g.bob)*.035*Math.min(1,moved/dt/4);g.y+=(gy-g.y)*Math.min(1,dt*14);
  /* moedas */
  let near=1e9;
  for(const k of g.coins){if(k.got)continue;const dd=Math.hypot(k.x-g.x,k.z-g.z);near=Math.min(near,dd);
   if(dd<1.6&&Math.abs(k.y-g.y)<2.4){k.got=true;k.g.visible=false;g.found++;tokens.add(1);g.flash=.5;say(g.found<2?'Token encontrado! Falta 1.':'Último token!',2.4);
    beep(880,.14,.12,'triangle');setTimeout(()=>beep(1320,.22,.1,'triangle'),110);updHud();if(g.found>=2)setTimeout(()=>{if(G===g&&g.state==='play')finish()},700)}}
  /* ping de proximidade */
  g.pingT-=dt;if(near<42&&g.pingT<=0){const q=Math.max(0,Math.min(1,near/42));beep(380+(1-q)*620,.09,.045+.05*(1-q));g.pingT=.25+q*1.9}
  if(Math.floor(g.t*4)!==Math.floor((g.t-dt)*4))updHud();
 }
 /* câmera, lanterna e animações (continuam em pausa/fim para a cena não congelar feia) */
 g.cam.position.set(g.x,g.y,g.z);g.cam.rotation.set(g.pitch,g.yaw,0,'YXZ');
 const fl=1+Math.sin(performance.now()*.017)*.03+Math.sin(performance.now()*.041)*.02;
 g.lamp.position.set(g.x,g.y-.15,g.z);g.lamp.intensity=1.5*fl;
 const T=performance.now()*.001;
 for(const k of g.coins){if(k.got)continue;k.g.rotation.y+=dt*2.2;k.g.position.y=k.y+Math.sin(T*2+k.ph)*.12;k.gl.material.opacity=.34+.12*Math.sin(T*3+k.ph);k.pl.intensity=.7+.25*Math.sin(T*3+k.ph)}
 const fp=g.ff.geometry.attributes.position;for(let i=0;i<g.fl.length;i++){const f=g.fl[i];fp.setY(i,g.H(f[0],f[1])+1.4+Math.sin(T*.8+f[2])*.6);fp.setX(i,f[0]+Math.sin(T*.5+f[2])*.8)}fp.needsUpdate=true;
 if(g.msgT>0){g.msgT-=dt;if(g.msgT<=0)hMsg.classList.remove('on')}
 if(g.flash>0){g.flash-=dt;hFlash.style.opacity=Math.max(0,g.flash*1.2)}else hFlash.style.opacity=0;
 g.renderer.render(g.scene,g.cam);
}

/* ---------- entrada ---------- */
addEventListener('keydown',e=>{if(!G)return;keys[e.code]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault()});
addEventListener('keyup',e=>{keys[e.code]=false});
addEventListener('blur',()=>{keys={}});
document.addEventListener('mousemove',e=>{if(!G||G.state!=='play'||document.pointerLockElement!==cv)return;const k=.0022*((OWM.S&&OWM.S.sens)||100)/100;G.yaw-=e.movementX*k;G.pitch=Math.max(-1.45,Math.min(1.45,G.pitch-e.movementY*k))});
document.addEventListener('pointerlockchange',()=>{if(G&&G.state==='play'&&document.pointerLockElement!==cv&&!touch)pause(true)});
cv.addEventListener('click',()=>{if(G&&G.state==='play'&&!touch&&document.pointerLockElement!==cv){try{cv.requestPointerLock()}catch(e){}}});
/* toque: metade esquerda = andar (joystick flutuante), direita = olhar */
function tpos(t){return[t.clientX,t.clientY]}
cv.addEventListener('touchstart',e=>{if(!G||G.state!=='play')return;e.preventDefault();for(const t of e.changedTouches){const[x,y]=tpos(t);G.touches.set(t.identifier,{x,y,sx:x,sy:y,left:x<innerWidth/2})}},{passive:false});
cv.addEventListener('touchmove',e=>{if(!G||G.state!=='play')return;e.preventDefault();for(const t of e.changedTouches){const o=G.touches.get(t.identifier);if(!o)continue;const[x,y]=tpos(t);
 if(o.left){mx=Math.max(-1,Math.min(1,(x-o.sx)/55));mz=Math.max(-1,Math.min(1,(y-o.sy)/55))}
 else{const k=.005*((OWM.S&&OWM.S.sens)||100)/100;G.yaw-=(x-o.x)*k;G.pitch=Math.max(-1.45,Math.min(1.45,G.pitch-(y-o.y)*k));o.x=x;o.y=y}}},{passive:false});
const tend=e=>{if(!G)return;for(const t of e.changedTouches){const o=G.touches.get(t.identifier);if(o&&o.left){mx=mz=0}G.touches.delete(t.identifier)}};
cv.addEventListener('touchend',tend);cv.addEventListener('touchcancel',tend);

OWM.mini={tick,start:startFind,stop:stopFind,tokens};
})();
