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

/* ---------- menu de minigames: lista à esquerda, prévia animada + detalhes à direita ---------- */
const TS=mkScreen('tokens',null,'title tokens');
counter(TS,'tk-corner');
E('h2','tk-title','Tokens',TS);
const wrap=E('div','tk-wrap',null,TS),list=E('div','tk-list',null,wrap),side=E('div','tk-side',null,wrap);
const pvBox=E('div','tk-pv',null,side),pv=E('canvas','',null,pvBox);pv.width=480;pv.height=270;
const sName=E('h3','tk-sname',null,side),sRw=E('div','tk-rw',null,side),sDesc=E('p','tk-sdesc',null,side),sBest=E('p','tk-best',null,side);
const sPlay=B('Jogar',()=>{const g=GAMES.find(x=>x.id===sel);g&&g.play()},side);
B('← Voltar',()=>go('title'),TS).classList.add('tk-back');
/* prévia: cada minigame desenha a sua em 2D (sem criar outro contexto WebGL) */
const pvRnd=(()=>{let a=7;return()=>{a=(a*16807)%2147483647;return a/2147483647}})();
const PV_TREES=Array.from({length:22},()=>({x:pvRnd(),h:.18+pvRnd()*.3,w:.05+pvRnd()*.05,l:pvRnd()}));
const PV_FF=Array.from({length:18},()=>({x:pvRnd(),y:.35+pvRnd()*.5,p:pvRnd()*6,s:.3+pvRnd()}));
function drawFind(g,W,H,T){
 const sk=g.createLinearGradient(0,0,0,H);sk.addColorStop(0,'#04060b');sk.addColorStop(.6,'#0a1018');sk.addColorStop(1,'#050806');g.fillStyle=sk;g.fillRect(0,0,W,H);
 g.fillStyle='#bcd0ff';for(let i=0;i<40;i++){const x=(i*97%100)/100*W,y=(i*53%45)/100*H;g.globalAlpha=.25+.3*Math.sin(T*2+i);g.fillRect(x,y,1.5,1.5)}g.globalAlpha=1;
 const gy=H*.68;g.fillStyle='#070d0a';g.fillRect(0,gy,W,H-gy);
 /* jogador (lanterna) passeia pela cena */
 const px=W*(.28+.12*Math.sin(T*.5)),py=H*.78,lx=px+W*.22,ly=H*.66;
 for(const t of PV_TREES){const x=t.x*W,h=t.h*H,w=t.w*W,b=gy+t.l*H*.08;
  const dl=Math.hypot(x-lx,b-ly),lit=Math.max(0,1-dl/(W*.3));g.fillStyle='rgb('+(6+lit*14|0)+','+(14+lit*46|0)+','+(10+lit*28|0)+')';
  g.beginPath();g.moveTo(x-w,b);g.lineTo(x,b-h);g.lineTo(x+w,b);g.fill();g.fillStyle='#1a1109';g.fillRect(x-w*.12,b,w*.24,h*.08)}
 /* moeda brilhando ao fundo, à direita */
 const cx=W*.8,cy=H*.6,pu=.5+.5*Math.sin(T*3);
 let k=g.createRadialGradient(cx,cy,0,cx,cy,W*.14);k.addColorStop(0,'rgba(255,210,60,'+(.45+.2*pu)+')');k.addColorStop(1,'rgba(255,160,0,0)');g.fillStyle=k;g.fillRect(cx-W*.14,cy-W*.14,W*.28,W*.28);
 const sw=Math.abs(Math.cos(T*2.2))*.9+.1,r=H*.065;g.fillStyle='#ffd21f';g.strokeStyle='#8a5d00';g.lineWidth=2;g.beginPath();g.ellipse(cx,cy+Math.sin(T*2)*3,r*sw,r,0,0,6.283);g.fill();g.stroke();
 /* cone da lanterna */
 g.save();g.globalCompositeOperation='lighter';k=g.createRadialGradient(px+W*.04,py-H*.08,2,px+W*.2,ly,W*.36);k.addColorStop(0,'rgba(255,220,160,.55)');k.addColorStop(1,'rgba(255,200,120,0)');g.fillStyle=k;
 g.beginPath();g.moveTo(px+W*.03,py-H*.09);g.lineTo(px+W*.6,ly-H*.26);g.lineTo(px+W*.6,ly+H*.2);g.closePath();g.fill();g.restore();
 /* silhueta do jogador */
 g.fillStyle='#000';g.beginPath();g.arc(px,py-H*.2,H*.04,0,6.283);g.fill();g.fillRect(px-H*.03,py-H*.17,H*.06,H*.17);
 /* vaga-lumes */
 g.fillStyle='#bfff8a';for(const f of PV_FF){g.globalAlpha=.4+.5*Math.sin(T*1.5+f.p);g.beginPath();g.arc((f.x+Math.sin(T*.4*f.s+f.p)*.03)*W,(f.y+Math.sin(T*.6*f.s+f.p)*.03)*H,1.6,0,6.283);g.fill()}g.globalAlpha=1;
 /* vinheta */
 k=g.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,W*.65);k.addColorStop(0,'rgba(0,0,0,0)');k.addColorStop(1,'rgba(0,0,0,.6)');g.fillStyle=k;g.fillRect(0,0,W,H);
}
const GAMES=[
 {id:'find',name:'Achar os tokens',desc:'Um mundo escuro, só você e uma lanterna. Encontre os 2 tokens amarelos escondidos pela floresta.',reward:'+1 token por moeda',draw:drawFind,best:()=>{const b=+ld(BEST,0);return b?'Melhor tempo: '+fmt(b):'Ainda sem recorde'},play:()=>startFind()},
];
let sel=GAMES[0].id;const items={};
for(const g of GAMES){const b=E('button','tk-item',null,list);E('b','',g.name,b);E('span','',g.reward,b);b.onclick=()=>{sel=g.id;refreshMenu()};items[g.id]=b}
E('div','tk-soon','Mais minigames em breve…',list);
const fmt=t=>{t=Math.max(0,t);const m=Math.floor(t/60),s=Math.floor(t%60);return m+':'+String(s).padStart(2,'0')};
function refreshMenu(){
 const g=GAMES.find(x=>x.id===sel)||GAMES[0];
 for(const k in items)items[k].classList.toggle('on',k===g.id);
 sName.textContent=g.name;sRw.textContent=g.reward;sDesc.textContent=g.desc;sBest.textContent=g.best?g.best():'';
}
let pvRaf=0;
function pvLoop(now){
 if(TS.classList.contains('hidden')){pvRaf=0;return}
 pvRaf=requestAnimationFrame(pvLoop);
 const g=GAMES.find(x=>x.id===sel)||GAMES[0],c=pv.getContext('2d');c.setTransform(1,0,0,1,0,0);g.draw(c,pv.width,pv.height,now/1000);
}
OWM.tokensOpen=()=>{refreshMenu();go('tokens');if(!pvRaf)pvRaf=requestAnimationFrame(pvLoop)};

/* ---------- minigame 1: achar os tokens ---------- */
const MS=mkScreen('mg-find',null,'mg');
const cv=E('canvas','mg-cv',null,MS);
const hud=E('div','mg-hud',null,MS);
const hFound=E('div','mg-pill',null,hud),hTime=E('div','mg-pill mg-time',null,hud);
const hTok=counter(hud,'tk-corner');
const hCross=E('div','mg-cross',null,MS);
const hFlash=E('div','mg-flash',null,MS);
const hMsg=E('div','mg-msg',null,MS);
const hVhs=E('div','mg-vhs',null,MS),hPlay=E('span','mg-vplay','PLAY ▶',hVhs),hRec=E('span','mg-vrec','● REC',hVhs),hVt=E('span','mg-vt','00:00:00',hVhs);
if(touch)hPlay.style.marginLeft='64px';   // não fica atrás do botão de pausa
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
 /* efeito VHS: a cena vai para um render target e um quad de tela cheia aplica o shader (tremor por linha, barra de tracking, aberração cromática, scanlines, granulado, glitch) */
 const rt=new THREE.WebGLRenderTarget(2,2,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat});
 const vhs=new THREE.ShaderMaterial({
  uniforms:{tD:{value:rt.texture},t:{value:0},res:{value:new THREE.Vector2(2,2)},k:{value:0}},
  depthTest:false,depthWrite:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:[
   'precision highp float;uniform sampler2D tD;uniform float t,k;uniform vec2 res;varying vec2 vUv;',
   'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
   'void main(){',
   ' vec2 uv=vUv;float y=uv.y;',
   ' float wob=sin(y*170.+t*3.)*.0007+(h(vec2(floor(y*res.y*.5),floor(t*12.)))-.5)*.0014;',   // tremor horizontal por linha
   ' float bar=1.-fract(t*.075);float d=abs(y-bar);float ib=smoothstep(.07,0.,d);',               // barra de tracking subindo
   ' wob+=ib*(sin(y*55.+t*18.)*.010+(h(vec2(floor(y*70.),floor(t*30.)))-.5)*.018);',
   ' float gl=step(.982-.03*k,h(vec2(floor(t*6.),7.)));',                                         // glitch ocasional (mais frequente perto do token)
   ' float band=step(.88,h(vec2(floor(y*16.),floor(t*10.))));',
   ' wob+=gl*band*(h(vec2(floor(t*22.),floor(y*16.)))-.5)*.09;',
   ' uv.x+=wob;',
   ' float ca=.0013+.0016*k+ib*.004+gl*band*.012;',                                               // aberração cromática
   ' vec3 c;c.r=texture2D(tD,uv+vec2(ca,0.)).r;c.g=texture2D(tD,uv).g;c.b=texture2D(tD,uv-vec2(ca,0.)).b;',
   ' vec3 b=texture2D(tD,uv+vec2(2.5/res.x,0.)).rgb+texture2D(tD,uv-vec2(2.5/res.x,0.)).rgb;',    // "sangramento" de cor da fita
   ' c=c*.7+b*.15;',
   ' float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,.84)*vec3(1.03,1.0,.95);',
   ' c=c*1.1+.012;',
   ' c*=.86+.14*sin(uv.y*res.y*3.14159);',                                                        // scanlines
   ' c+=(h(uv*res+fract(t)*91.)-.5)*(.075+.05*k);',                                               // granulado
   ' c+=ib*((h(uv*res*.5+t)-.5)*.30+.035);',                                                      // chuvisco na barra de tracking
   ' float dr=step(.9965,h(vec2(floor(y*res.y*.5),floor(t*18.))));c+=dr*.22*step(.5,h(vec2(floor(uv.x*9.),floor(t*18.))));',
   ' vec2 q=vUv-.5;c*=1.-dot(q,q)*.95;',                                                          // vinheta
   ' gl_FragColor=vec4(c,1.);}'
  ].join('\n')});
 const pq=new THREE.Mesh(new THREE.PlaneGeometry(2,2),vhs);pq.frustumCulled=false;
 const ps=new THREE.Scene();ps.add(pq);const pc=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 return{renderer,scene,cam,lamp,H,R,obst,coins,ff,fl,gt,rt,vhs,ps,pc,disposables:[gg,gt,sg,fg,trunk.geometry,c1.geometry,c2.geometry,rocks.geometry,rt,vhs,pq.geometry]};
}

function startFind(){
 if(G)stopFind(true);
 const seed=(Math.random()*1e9)|0,W=build(seed);
 G={...W,yaw:Math.random()*6.283,pitch:0,x:0,z:0,y:W.H(0,0)+1.65,vy:0,t:0,found:0,state:'ready',bob:0,pingT:0,pingBuf:null,ac:null,seed,msgT:0,flash:0,touches:new Map(),tension:0,tkT:0,mus:null,tcT:0};
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
 try{musicStart(G)}catch(e){console.warn('[OWM] música de tensão:',e)}
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
 if(!silent){OWM.miniState&&OWM.miniState(false);OWM.tokensOpen()}
}
function resize(){if(!G)return;const w=innerWidth,h=innerHeight;G.renderer.setSize(w,h,false);G.cam.aspect=w/h;G.cam.updateProjectionMatrix();const pr=G.renderer.getPixelRatio(),bw=Math.max(2,Math.floor(w*pr)),bh=Math.max(2,Math.floor(h*pr));G.rt.setSize(bw,bh);G.vhs.uniforms.res.value.set(bw,bh)}
addEventListener('resize',resize);
function updHud(){if(!G)return;hFound.textContent='Tokens: '+G.found+' / 2';hTime.textContent=fmt(G.t)}
function say(t,ms){hMsg.textContent=t;hMsg.classList.add('on');if(G)G.msgT=ms||2.2}

/* som: ping que acelera e fica mais agudo perto do token mais próximo; moeda pega = acorde curto */
function beep(f,d,v,type){const ac=G&&G.ac;if(!ac||ac.state!=='running')return;const o=ac.createOscillator(),g=ac.createGain();o.type=type||'sine';o.frequency.value=f;g.gain.setValueAtTime(v,ac.currentTime);g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+d);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+d+.02)}

/* ---------- música de tensão (sintetizada no WebAudio, sem arquivo): drone grave desafinado + vento + pad dissonante + batimento cardíaco.
   Tudo fica mais intenso (batimento acelera, drone abre o filtro) quanto mais perto você está de um token; um rangido agudo aparece de vez em quando. ---------- */
const mvl=()=>{const v=OWM.S&&typeof OWM.S.mvol==='number'?OWM.S.mvol:70;return Math.pow(Math.max(0,Math.min(100,v))/100,2)};
function thump(ac,dst,t,v){const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.setValueAtTime(95,t);o.frequency.exponentialRampToValueAtTime(38,t+.16);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.24);o.connect(g);g.connect(dst);o.start(t);o.stop(t+.28)}
function sting(ac,m,t){const o=ac.createOscillator(),f=ac.createBiquadFilter(),g=ac.createGain(),b=520+Math.random()*700;o.type='sawtooth';o.frequency.setValueAtTime(b,t);o.frequency.exponentialRampToValueAtTime(b*(Math.random()<.5?.84:1.19),t+2.8);f.type='bandpass';f.frequency.value=b*1.4;f.Q.value=7;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.05,t+1.3);g.gain.exponentialRampToValueAtTime(.0001,t+3.2);o.connect(f);f.connect(g);g.connect(m.bus);o.start(t);o.stop(t+3.4)}
function musicStart(g){
 const ac=g.ac;if(!ac||g.mus)return;
 const out=ac.createGain();out.gain.value=0;out.connect(ac.destination);
 /* eco longo e escuro (dá ar de caverna/floresta) */
 const dl=ac.createDelay(1),fb=ac.createGain(),dlp=ac.createBiquadFilter(),wet=ac.createGain();dl.delayTime.value=.41;fb.gain.value=.4;dlp.type='lowpass';dlp.frequency.value=1300;wet.gain.value=.5;
 dl.connect(dlp);dlp.connect(fb);fb.connect(dl);dlp.connect(wet);wet.connect(out);
 const bus=ac.createGain();bus.connect(out);bus.connect(dl);
 /* drone: dois dentes-de-serra levemente desafinados + trítono, passa-baixa que respira */
 const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=160;lp.Q.value=4;lp.connect(bus);
 const dg=ac.createGain();dg.gain.value=.4;dg.connect(lp);
 for(const[f,d]of[[55,0],[55,7],[77.8,-4]]){const o=ac.createOscillator();o.type='sawtooth';o.frequency.value=f;o.detune.value=d;o.connect(dg);o.start()}
 const sub=ac.createOscillator(),sg=ac.createGain();sub.type='sine';sub.frequency.value=36.7;sg.gain.value=.5;sub.connect(sg);sg.connect(bus);sub.start();
 const lfo=ac.createOscillator(),lg=ac.createGain();lfo.frequency.value=.07;lg.gain.value=90;lfo.connect(lg);lg.connect(lp.frequency);lfo.start();
 /* pad dissonante (segunda menor + sexta) com tremolo lento */
 const pg=ac.createGain();pg.gain.value=.02;pg.connect(bus);
 for(const f of[466.16,493.88,659.25]){const o=ac.createOscillator();o.type='sine';o.frequency.value=f;o.connect(pg);o.start()}
 const tl=ac.createOscillator(),tg=ac.createGain();tl.frequency.value=.23;tg.gain.value=.018;tl.connect(tg);tg.connect(pg.gain);tl.start();
 /* vento */
 const nb=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
 const ns=ac.createBufferSource(),nf=ac.createBiquadFilter(),ng=ac.createGain();ns.buffer=nb;ns.loop=true;nf.type='bandpass';nf.frequency.value=420;nf.Q.value=.7;ng.gain.value=.035;ns.connect(nf);nf.connect(ng);ng.connect(bus);ns.start();
 const nl=ac.createOscillator(),nlg=ac.createGain();nl.frequency.value=.11;nlg.gain.value=.025;nl.connect(nlg);nlg.connect(ng.gain);nl.start();
 g.mus={out,bus,lp,dg,pg,beat:0,sting:ac.currentTime+7};
}
function musicTick(g,dt){
 const m=g.mus,ac=g.ac;if(!m||!ac||ac.state!=='running')return;
 const now=ac.currentTime,k=g.tension,st=g.state;
 m.out.gain.setTargetAtTime(mvl()*.6*(st==='play'?1:st==='pause'?.25:0),now,.5);   // pausa: abaixa; fim: some
 m.lp.frequency.setTargetAtTime(150+k*520,now,.3);
 m.dg.gain.setTargetAtTime(.35+k*.4,now,.3);
 m.pg.gain.setTargetAtTime(.015+k*.05,now,.3);
 if(st!=='play')return;
 if(m.beat<now)m.beat=now+.05;
 const per=1.35-k*.85;                                                                // batimento: ~44 bpm longe → ~120 bpm colado no token
 while(m.beat<now+.12){thump(ac,m.out,m.beat,.5+.4*k);thump(ac,m.out,m.beat+.21,.32+.3*k);m.beat+=per}
 if(now>m.sting){sting(ac,m,now+.05);m.sting=now+7+Math.random()*9-k*4}
}

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
  g.tkT=near<42?Math.pow(1-near/42,1.5):0;g.pingT-=dt;if(near<42&&g.pingT<=0){const q=Math.max(0,Math.min(1,near/42));beep(380+(1-q)*620,.09,.045+.05*(1-q));g.pingT=.25+q*1.9}
  if(Math.floor(g.t*4)!==Math.floor((g.t-dt)*4))updHud();
 }
 g.tension+=((g.state==='play'?g.tkT:0)-g.tension)*Math.min(1,dt*2);musicTick(g,dt);
 /* câmera, lanterna e animações (continuam em pausa/fim para a cena não congelar feia) */
 g.cam.position.set(g.x,g.y,g.z);g.cam.rotation.set(g.pitch,g.yaw,0,'YXZ');
 const fl=1+Math.sin(performance.now()*.017)*.03+Math.sin(performance.now()*.041)*.02;
 g.lamp.position.set(g.x,g.y-.15,g.z);g.lamp.intensity=1.5*fl;
 const T=performance.now()*.001;
 for(const k of g.coins){if(k.got)continue;k.g.rotation.y+=dt*2.2;k.g.position.y=k.y+Math.sin(T*2+k.ph)*.12;k.gl.material.opacity=.34+.12*Math.sin(T*3+k.ph);k.pl.intensity=.7+.25*Math.sin(T*3+k.ph)}
 const fp=g.ff.geometry.attributes.position;for(let i=0;i<g.fl.length;i++){const f=g.fl[i];fp.setY(i,g.H(f[0],f[1])+1.4+Math.sin(T*.8+f[2])*.6);fp.setX(i,f[0]+Math.sin(T*.5+f[2])*.8)}fp.needsUpdate=true;
 if(g.msgT>0){g.msgT-=dt;if(g.msgT<=0)hMsg.classList.remove('on')}
 if(g.flash>0){g.flash-=dt;hFlash.style.opacity=Math.max(0,g.flash*1.2)}else hFlash.style.opacity=0;
 g.vhs.uniforms.t.value=T%1000;g.vhs.uniforms.k.value=g.tension;
 g.renderer.setRenderTarget(g.rt);g.renderer.render(g.scene,g.cam);g.renderer.setRenderTarget(null);g.renderer.render(g.ps,g.pc);
 const nowMs=performance.now();if(nowMs-g.tcT>250){g.tcT=nowMs;const s=Math.floor(g.t);hVt.textContent='00:'+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0');hRec.style.opacity=Math.floor(nowMs/700)%2?'.15':'1'}
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
