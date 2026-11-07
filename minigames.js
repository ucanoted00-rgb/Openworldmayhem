/* Open World Mayhem — Tokens e minigames.
   Tela inicial → "Tokens": menu de minigames; a quantidade de tokens fica no canto superior direito (salva em localStorage 'bc.tokens').
   Minigame 1 — "Echos" (Ato 1; antes chamado "Achar os tokens"): um mundo escuro, com pouca luz (só a sua lanterna), e dois tokens (moedas amarelas) escondidos.
   Cada token vale +1 token. Um brilho fraco e um "ping" que acelera ajudam a achar o caminho. Cena própria (renderer próprio, como o criador de personagem):
   o jogo principal só chama OWM.mini.tick(dt) enquanto state==='mini'. Controles: WASD/setas + mouse (Shift corre) · toque: arraste a metade esquerda
   para andar e a direita para olhar.
   Rodas do carro: ao coletar uma roda ela NÃO vai direto pro carro — ela fica no chão, ao lado do encaixe dela. O jogador chega perto e aperta E (ou toca em "Encaixar roda"):
   começa um QTE em formato de roda (aro circular, zona verde no pneu e um ponteiro girando). São 4 acertos para prender a roda no carro. */
(()=>{
const {E,B,mkScreen,go,ld,st}=OWM,touch=!!OWM.touch||('ontouchstart' in window);
const KEY='bc.tokens',BEST='bc.mg1best2';   // recorde novo: o objetivo agora inclui as 4 rodas do carro (o recorde antigo era só de tokens)

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
const sName=E('h3','tk-sname',null,side),sRw=E('div','tk-rw',null,side),sDesc=E('p','tk-sdesc',null,side),sActsT=E('div','tk-acts-t','Atos',side),sActs=E('div','tk-acts',null,side),sBest=E('p','tk-best',null,side);
const selAct={},sPlay=B('Jogar',()=>{const g=GAMES.find(x=>x.id===sel);g&&g.play(selAct[g.id]||1)},side,'tk-play');   // o botão de jogar fica no fim (embaixo) do painel
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
 /* Shadow Man: de vez em quando aparece (piscando) ao fundo — só uma silhueta com os olhos acesos */
 {const c=(T%8)/8;if(c>.5&&c<.7&&((c>.53&&c<.67)||Math.sin(T*70)>0)){const sx=W*.6,sb=gy+H*.02,sh=H*.36,hy=sb-sh*.93;
  let k2=g.createRadialGradient(sx,sb-sh*.5,0,sx,sb-sh*.5,sh*.7);k2.addColorStop(0,'rgba(150,175,235,.22)');k2.addColorStop(1,'rgba(150,175,235,0)');g.fillStyle=k2;g.fillRect(sx-sh,sb-sh*1.3,sh*2,sh*1.6);
  g.strokeStyle='#000';g.fillStyle='#000';g.lineCap='round';g.lineWidth=sh*.12;g.beginPath();g.moveTo(sx,sb-sh*.8);g.lineTo(sx,sb-sh*.4);g.stroke();
  g.lineWidth=sh*.05;g.beginPath();g.moveTo(sx,sb-sh*.78);g.lineTo(sx-sh*.2,sb-sh*.45);g.moveTo(sx,sb-sh*.78);g.lineTo(sx+sh*.2,sb-sh*.45);g.moveTo(sx-sh*.04,sb-sh*.4);g.lineTo(sx-sh*.06,sb);g.moveTo(sx+sh*.04,sb-sh*.4);g.lineTo(sx+sh*.06,sb);g.stroke();
  g.beginPath();g.ellipse(sx,hy,sh*.06,sh*.09,0,0,6.283);g.fill();
  g.fillStyle='#fff';g.shadowColor='#fff';g.shadowBlur=8;g.fillRect(sx-sh*.035,hy-sh*.01,sh*.02,sh*.012);g.fillRect(sx+sh*.015,hy-sh*.01,sh*.02,sh*.012);g.shadowBlur=0}}
 /* vinheta */
 k=g.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,W*.65);k.addColorStop(0,'rgba(0,0,0,0)');k.addColorStop(1,'rgba(0,0,0,.6)');g.fillStyle=k;g.fillRect(0,0,W,H);
}
const GAMES=[
 {id:'find',name:'Echos',acts:[{n:1,name:'Ato 1'},{n:2,name:'Ato 2',locked:true},{n:3,name:'Ato 3',locked:true}],desc:'Um mundo escuro, só você e uma lanterna. Encontre os 2 tokens amarelos e as 4 rodas do carro quebrado escondidos pela floresta. As rodas ficam ao lado do carro e você precisa encaixar cada uma manualmente (QTE com 4 acertos). Precisa de tudo para zerar.',reward:'+1 token por moeda',draw:drawFind,best:()=>{const b=+ld(BEST,0);return b?'Melhor tempo: '+fmt(b):'Ainda sem recorde'},play:act=>startFind()},   // act: por enquanto só o Ato 1 existe; os próximos atos entram aqui

];
let sel=GAMES[0].id;const items={};
for(const g of GAMES){const b=E('button','tk-item',null,list);E('b','',g.name,b);E('span','',g.reward,b);b.onclick=()=>{sel=g.id;refreshMenu()};items[g.id]=b}
E('div','tk-soon','Mais minigames em breve…',list);
const fmt=t=>{t=Math.max(0,t);const m=Math.floor(t/60),s=Math.floor(t%60);return m+':'+String(s).padStart(2,'0')};
function refreshMenu(){
 const g=GAMES.find(x=>x.id===sel)||GAMES[0];
 for(const k in items)items[k].classList.toggle('on',k===g.id);
 sName.textContent=g.name;sRw.textContent=g.reward;sDesc.textContent=g.desc;sBest.textContent=g.best?g.best():'';
 /* atos do minigame: o atual é o Ato 1; os outros aparecem trancados */
 sActs.textContent='';const act=selAct[g.id]||1;
 for(const a of g.acts||[]){const b=E('button','tk-act'+(a.n===act?' on':''),(a.locked?'🔒 ':'')+a.name,sActs);if(a.locked){b.disabled=true;b.title='Em breve'}else b.onclick=()=>{selAct[g.id]=a.n;refreshMenu()}}
 const cur=(g.acts||[]).find(a=>a.n===act);sPlay.textContent='Jogar'+(cur?' — '+cur.name:'');
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
const hFound=E('div','mg-pill',null,hud),hWheels=E('div','mg-pill',null,hud),hTime=E('div','mg-pill mg-time',null,hud);
const hTok=counter(hud,'tk-corner');
const hCross=E('div','mg-cross',null,MS);
const hFlash=E('div','mg-flash',null,MS);
const hMsg=E('div','mg-msg',null,MS),hSh=E('div','mg-sh',null,MS);   // hSh = fala do Shadow Man (verde VHS, meio inferior)
const hVhs=E('div','mg-vhs',null,MS),hPlay=E('span','mg-vplay','PLAY ▶',hVhs),hRec=E('span','mg-vrec','● REC',hVhs),hVt=E('span','mg-vt','00:00:00',hVhs);
if(touch)hPlay.style.marginLeft='64px';   // não fica atrás do botão de pausa
const hPause=touch?B('☰',()=>pause(true),MS):null;if(hPause)hPause.classList.add('mg-pbtn');
const ov=E('div','mg-ov',null,MS),ovBox=E('div','mg-box',null,ov);

let G=null,keys={},mx=0,mz=0;   // G = estado da partida em andamento
const mulberry=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
function glowTex(a,b){a=a||'255,230,120';b=b||'255,190,40';const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba('+a+',1)');r.addColorStop(.35,'rgba('+b+',.45)');r.addColorStop(1,'rgba('+b+',0)');g.fillStyle=r;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)}

/* ---------- floresta PS1 (mesmos modelos e mesmo chão da floresta do jogo) ----------
   Árvores e arbustos vêm do pack OWM.ps1Pack (ps1trees.js): tronco com casca + copa de cartões recortados. Decodificação igual à do game.js;
   tudo é fundido em 2 malhas (casca e cartões). O chão usa as cores de grama da floresta (verde escuro com manchas + terra) e a textura de tufos. */
const unb64=(s,T)=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return new T(u.buffer)};
const f32=(a,k)=>{const o=new Float32Array(a.length);for(let i=0;i<a.length;i++)o[i]=a[i]*k;return o};
const s2l=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};
const sst=(a,b,x)=>{x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x)};
let PS1M=null;
function ps1Models(){
 if(PS1M)return PS1M;PS1M={};
 for(const m of OWM.ps1Pack.models){
  const o={k:m.k,h:m.h,hx:m.hx};
  if(m.b)o.b={pos:f32(unb64(m.b.p,Int16Array),.01),nor:f32(unb64(m.b.n,Int8Array),1/127),uv:f32(unb64(m.b.u,Int16Array),1/8192),idx:unb64(m.b.i,Uint16Array)};
  const P=f32(unb64(m.c.p,Int16Array),.01),U=f32(unb64(m.c.u,Uint16Array),1/65535),I=unb64(m.c.i,Uint16Array),n=P.length/3,N=new Float32Array(n*3);
  for(let i=0;i<n;i++){const x=P[i*3],z=P[i*3+2],r=Math.hypot(x,z),k=r>.05?.4/r:0,nx=x*k,nz=z*k,l=Math.hypot(nx,.9,nz);N[i*3]=nx/l;N[i*3+1]=.9/l;N[i*3+2]=nz/l}   // normais de copa: pra cima + radial
  const P2=new Float32Array(n*6),N2=new Float32Array(n*6),U2=new Float32Array(n*4),I2=new Uint16Array(I.length*2);
  P2.set(P);P2.set(P,n*3);N2.set(N);N2.set(N,n*3);U2.set(U);U2.set(U,n*2);I2.set(I);
  for(let t=0;t<I.length;t+=3){I2[I.length+t]=I[t]+n;I2[I.length+t+1]=I[t+2]+n;I2[I.length+t+2]=I[t+1]+n}   // cópia com winding invertido (cartão visível dos dois lados)
  o.c={pos:P2,nor:N2,uv:U2,idx:I2};PS1M[m.n]=o}
 return PS1M}
/* Planta árvores e arbustos PS1; devolve true se o pack existe. Preenche obst (colisão por círculos) e disp (geometrias a descartar). */
function ps1Forest(scene,rnd,H,R,obst,disp,total,ex,bushes){   // ex=[x,z,raio]: zona sem árvores (onde fica o carro)
 const PP=OWM.ps1Pack;if(!PP||!PP.models||PP.models.length<6)return false;
 const M=ps1Models(),TR=['tree1','tree2','tree3'],BU=['bush1','bush2','bush3'],mk=()=>({pos:[],nor:[],uv:[],col:[],idx:[]}),AB=mk(),AC=mk();
 const put=(G,A,x,y,z,cr,sr,sx,sy,b,tn,hh)=>{const n=G.pos.length/3,b0=A.pos.length/3;
  for(let i=0;i<n;i++){const lx=G.pos[i*3]*sx,ly=G.pos[i*3+1]*sy,lz=G.pos[i*3+2]*sx,nx=G.nor[i*3],nz=G.nor[i*3+2],g=b*(.74+.26*Math.min(1,ly/hh));
   A.pos.push(x+lx*cr+lz*sr,y+ly,z-lx*sr+lz*cr);A.nor.push(nx*cr+nz*sr,G.nor[i*3+1],-nx*sr+nz*cr);A.uv.push(G.uv[i*2],G.uv[i*2+1]);A.col.push(g*tn[0],g*tn[1],g*tn[2])}
  for(let i=0;i<G.idx.length;i++)A.idx.push(b0+G.idx[i])};
 let nt=0;
 for(let tries=0;nt<total&&tries<total*6;tries++){
  const a=rnd()*6.283,d=Math.sqrt(rnd())*(R+8);if(d<7)continue;
  if(ex&&Math.hypot(Math.cos(a)*d-ex[0],Math.sin(a)*d-ex[1])<ex[2])continue;
  const x=Math.cos(a)*d,z=Math.sin(a)*d,y=H(x,z)-.08,rot=rnd()*6.283,cr=Math.cos(rot),sr=Math.sin(rot),bush=rnd()<.3,m=M[(bush?BU:TR)[Math.floor(rnd()*3)]],
   th=bush?1.5+rnd()*1.2:5.5+rnd()*3,sy=th/m.h,sx=sy*(.9+.25*rnd()),j=(rnd()-.5)*.16,tn=[1+j,1,1-.6*j],b=.5+.3*rnd();   // alturas parecidas com as da floresta do jogo (~6,5 blocos)
  if(m.b)put(m.b,AB,x,y,z,cr,sr,sx,sy,b,tn,th);put(m.c,AC,x,y,z,cr,sr,sx,sy,b,tn,th);
  const orad=bush?m.hx*sx*1.1+.1:m.hx*sx*.9+.15;obst.push([x,z,orad]);if(bush&&bushes)bushes.push([x,z,orad]);nt++}   // bushes: onde o jogador pode se esconder (evento do Shadow Man)
 const tl=new THREE.TextureLoader(),tex=u=>{const t=tl.load(u);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.flipY=false;t.anisotropy=4;return t};
 const bark=tex(PP.tex.bark),atl=tex(PP.tex.atlas);atl.wrapS=atl.wrapT=THREE.ClampToEdgeWrapping;
 const mb=new THREE.MeshLambertMaterial({map:bark,vertexColors:true,side:THREE.DoubleSide}),mc=new THREE.MeshLambertMaterial({map:atl,vertexColors:true,alphaTest:.5});
 const mesh=(A,mat)=>{if(!A.idx.length)return;const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(A.pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(A.nor,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(A.uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(A.col,3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(A.idx),1));g.computeBoundingSphere();scene.add(new THREE.Mesh(g,mat));disp.push(g)};
 mesh(AB,mb);mesh(AC,mc);return true}
/* textura de tufos de grama (128×128 tileável, cinza; média 0,8 — as cores dos vértices compensam), no mesmo espírito da do jogo */
function grassTex(){
 const N=128,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d'),img=g.createImageData(N,N),d=img.data,A=new Float32Array(N*N),r=mulberry(777),G8=8,lat=Array.from({length:G8*G8},()=>r());
 const vn=(u,v)=>{u*=G8;v*=G8;const x0=Math.floor(u),y0=Math.floor(v),fx=u-x0,fy=v-y0,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),a=lat[(y0%G8)*G8+x0%G8],b=lat[(y0%G8)*G8+(x0+1)%G8],c2=lat[((y0+1)%G8)*G8+x0%G8],d2=lat[((y0+1)%G8)*G8+(x0+1)%G8];return a+(b-a)*sx+(c2-a)*sy+(a-b-c2+d2)*sx*sy};
 for(let y=0;y<N;y++)for(let x=0;x<N;x++)A[y*N+x]=.92+.16*sst(.44,.56,vn(x/N,y/N))+(r()-.5)*.05;   // manchas macias claras/escuras
 for(let k=0;k<46;k++){const x0=r()*N,y0=r()*N;for(let b=-1;b<=1;b++){const ang=-Math.PI/2+b*.5+(r()-.5)*.3,len=4+r()*3;   // tufinhos: 3 riscos claros em leque
  for(let t=0;t<len;t++){const px=Math.floor(x0+Math.cos(ang)*t+N*4)%N,py=Math.floor(y0+Math.sin(ang)*t+N*4)%N;A[py*N+px]+=.16*(1-t/len)}}}
 let m=0;for(let i=0;i<A.length;i++)m+=A[i];m/=A.length;
 for(let i=0;i<N*N;i++){const v=Math.round(Math.max(.7,Math.min(1.5,A[i]/m))*204);d[i*4]=d[i*4+1]=d[i*4+2]=Math.min(255,v);d[i*4+3]=255}
 g.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;return t}

function build(seed,yaw){
 const rnd=mulberry(seed),R=62,ph=[0,1,2,3,4,5].map(()=>rnd()*6.28);
 const H=(x,z)=>Math.sin(x*.045+ph[0])*Math.cos(z*.04+ph[1])*2.2+Math.sin(x*.11+ph[2]+z*.07)*.8+Math.cos(z*.13+ph[3]-x*.05)*.6;
 /* carro: nasce ATRÁS do jogador (o jogador começa em 0,0 olhando para (-sen yaw, -cos yaw)), de lado, a ~8,5 m */
 const CP=OWM.carPack,CS=.46,CD=8.5,carX=Math.sin(yaw)*CD,carZ=Math.cos(yaw)*CD,ex=[carX,carZ,4.6];
 const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:!touch,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,touch?1.5:2));
 const scene=new THREE.Scene(),FOG=0x04060b;scene.background=new THREE.Color(FOG);scene.fog=new THREE.FogExp2(FOG,.052);
 const cam=new THREE.PerspectiveCamera(72,1,.1,160);
 scene.add(new THREE.AmbientLight(0x20304a,.5));
 const moon=new THREE.DirectionalLight(0x6a86c8,.22);moon.position.set(-30,50,20);scene.add(moon);
 const lamp=new THREE.PointLight(0xffd9a0,1.5,15,2);scene.add(lamp);   // lanterna do jogador
 /* chão: grama da floresta do jogo (verde escuro com manchas macias, terra em alguns trechos) + textura de tufos */
 const SEG=62,gg=new THREE.PlaneGeometry(R*2+30,R*2+30,SEG,SEG);gg.rotateX(-Math.PI/2);
 const pos=gg.attributes.position,col=new Float32Array(pos.count*3),GA=[58,118,44].map(s2l),GB=[74,130,44].map(s2l),GD=[121,98,66].map(s2l),DK=.81;
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),y=H(x,z);pos.setY(i,y);
  const w=.5+.5*Math.sin(x*.09+ph[4]+Math.sin(z*.05+ph[5])*1.6)*Math.cos(z*.083+ph[5]),dt=.5*sst(.78,.92,.5+.5*Math.sin(x*.21+ph[0]*2)*Math.sin(z*.19+ph[1]*3)),v=(.9+.2*rnd())*DK;
  for(let c=0;c<3;c++){const gr=GA[c]+(GB[c]-GA[c])*w;col[i*3+c]=(gr+(GD[c]-gr)*dt)*v}}
 gg.setAttribute('color',new THREE.BufferAttribute(col,3));gg.computeVertexNormals();
 const gtex=grassTex();gtex.repeat.set((R*2+30)/5,(R*2+30)/5);   // 1 repetição = 5 m, como no jogo
 scene.add(new THREE.Mesh(gg,new THREE.MeshLambertMaterial({map:gtex,vertexColors:true})));
 /* estrelas (sem névoa) */
 const sp=new Float32Array(300*3);for(let i=0;i<300;i++){const a=rnd()*6.283,e=.15+rnd()*1.2,r=140;sp[i*3]=Math.cos(a)*Math.cos(e)*r;sp[i*3+1]=Math.sin(e)*r;sp[i*3+2]=Math.sin(a)*Math.cos(e)*r}
 const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
 scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xbcd0ff,size:1.4,sizeAttenuation:false,fog:false,transparent:true,opacity:.7})));
 /* árvores PS1 da floresta (+ arbustos) e pedras; colisão por círculos. Sem o pack, cai nas coníferas simples de antes. */
 const obst=[],bushes=[],M=new THREE.Matrix4(),Q=new THREE.Quaternion(),Pp=new THREE.Vector3(),Sc=new THREE.Vector3(),C=new THREE.Color(),disp=[];
 let trunk,c1,c2;
 if(!ps1Forest(scene,rnd,H,R,obst,disp,300,ex,bushes)){
  const NT=300;trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.24,2.4,6),new THREE.MeshLambertMaterial({color:0x2a1c12}),NT);
  c1=new THREE.InstancedMesh(new THREE.ConeGeometry(1.4,3,7),new THREE.MeshLambertMaterial({color:0xffffff}),NT);c2=new THREE.InstancedMesh(new THREE.ConeGeometry(1,2.4,7),new THREE.MeshLambertMaterial({color:0xffffff}),NT);
  let nt=0;
  for(let tries=0;nt<NT&&tries<NT*6;tries++){
   const a=rnd()*6.283,d=Math.sqrt(rnd())*(R+8);if(d<7)continue;if(Math.hypot(Math.cos(a)*d-ex[0],Math.sin(a)*d-ex[1])<ex[2])continue;const x=Math.cos(a)*d,z=Math.sin(a)*d,y=H(x,z),s=.8+rnd()*.8;
   trunk.setMatrixAt(nt,M.compose(Pp.set(x,y+1.2*s,z),Q.identity(),Sc.set(s,s,s)));
   c1.setMatrixAt(nt,M.compose(Pp.set(x,y+3.2*s,z),Q.identity(),Sc.set(s,s,s)));c2.setMatrixAt(nt,M.compose(Pp.set(x,y+5*s,z),Q.identity(),Sc.set(s,s,s)));
   C.setRGB(.03+.05*rnd(),.1+.1*rnd(),.07+.06*rnd());c1.setColorAt(nt,C);c2.setColorAt(nt,C);
   obst.push([x,z,.42*s+.1]);nt++;
  }
  trunk.count=c1.count=c2.count=nt;scene.add(trunk,c1,c2);disp.push(trunk.geometry,c1.geometry,c2.geometry);
 }
 const NR=70,rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:0x2b2f36}),NR);let nr=0;
 for(let tries=0;nr<NR&&tries<NR*6;tries++){const a=rnd()*6.283,d=Math.sqrt(rnd())*(R+4);if(d<6)continue;const x=Math.cos(a)*d,z=Math.sin(a)*d,s=.5+rnd()*1.1;if(Math.hypot(x-ex[0],z-ex[1])<ex[2]-.6)continue;
  rocks.setMatrixAt(nr,M.compose(Pp.set(x,H(x,z)+s*.35,z),Q.setFromEuler(new THREE.Euler(rnd()*3,rnd()*3,rnd()*3)),Sc.set(s*1.2,s*.75,s)));obst.push([x,z,s*.85]);nr++}
 rocks.count=nr;scene.add(rocks);

 /* ---------- carro quebrado (sem rodas) + 4 rodas espalhadas como os tokens ---------- */
 const th=yaw+1.9,hx=-Math.sin(th),hz=-Math.cos(th),sx=-hz,sz=hx;   // hx,hz = frente do carro; sx,sz = lado direito
 let car=null,wheels=[],staged=[];
 if(CP){
  for(const o of[-1.4,0,1.4])obst.push([carX+hx*o,carZ+hz*o,1.05]);   // colisão: 3 círculos ao longo do carro
  const mkGeo=p=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(unb64(p.p,Float32Array),3));g.setAttribute('normal',new THREE.BufferAttribute(f32(unb64(p.n,Int8Array),1/127),3));
   g.setAttribute('uv',new THREE.BufferAttribute(unb64(p.u,Float32Array),2));g.setIndex(new THREE.BufferAttribute(unb64(p.i,Uint16Array),1));g.computeBoundingSphere();return g};
  const ct=new THREE.TextureLoader().load(CP.tex);ct.flipY=false;ct.anisotropy=4;
  const mCar=new THREE.MeshLambertMaterial({map:ct,emissive:0x262626,emissiveMap:ct,side:THREE.DoubleSide}),   // um pouco de auto-iluminação: no escuro o carro continua legível
   mPick=new THREE.MeshLambertMaterial({map:ct,emissive:0x555555,emissiveMap:ct,side:THREE.DoubleSide}),mLamp=new THREE.MeshLambertMaterial({color:0xb8b8b8,emissive:0x202020,side:THREE.DoubleSide});
  const cg=new THREE.Group();cg.add(new THREE.Mesh(mkGeo(CP.body),mCar),new THREE.Mesh(mkGeo(CP.lamps),mLamp));
  const wgeo=CP.wheels.map(w=>mkGeo(w.g)),mounted=[];
  CP.wheels.forEach((w,i)=>{const m=new THREE.Mesh(wgeo[i],mCar);m.position.set(w.s[0],w.s[1],w.s[2]);m.visible=false;m.scale.setScalar(.001);cg.add(m);mounted.push({m,t:1,on:false})});
  cg.scale.setScalar(CS);
  /* assenta o carro no terreno: inclinação pelo gradiente da altura ao longo/ao lado do carro */
  const hc=[[0,0],[1.7,0],[-1.7,0],[0,.8],[0,-.8]].reduce((a,o)=>a+H(carX+hx*o[0]+sx*o[1],carZ+hz*o[0]+sz*o[1]),0)/5,
   dF=(H(carX+hx*2,carZ+hz*2)-H(carX-hx*2,carZ-hz*2))/4,dS=(H(carX+sx*.9,carZ+sz*.9)-H(carX-sx*.9,carZ-sz*.9))/1.8,
   up=new THREE.Vector3(-dF*hx-dS*sx,1,-dF*hz-dS*sz).normalize(),fw=new THREE.Vector3(hx,0,hz);fw.addScaledVector(up,-fw.dot(up)).normalize();
  cg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fw,up,new THREE.Vector3().crossVectors(fw,up)));
  cg.position.set(carX,hc,carZ);scene.add(cg);
  car={g:cg,mounted,base:hc,sink:(CP.drop-.1)*CS,k:1};   // sem rodas o carro "senta" no chão; a cada roda ele sobe
  /* rodas: mesmos critérios dos tokens (fora de árvores/pedras e do carro, longe do início e entre si) */
  const freeW=(x,z,m)=>{for(const o of obst)if(Math.hypot(o[0]-x,o[1]-z)<o[2]+m)return false;return true};
  const wsp=[];
  for(let sep=24;sep>=8&&wsp.length<4;sep-=4)for(let tries=0;wsp.length<4&&tries<500;tries++){
   const a=rnd()*6.283,d=16+rnd()*(R-22),x=Math.cos(a)*d,z=Math.sin(a)*d;
   if(!freeW(x,z,1.8)||Math.hypot(x-carX,z-carZ)<14)continue;if(wsp.some(s=>Math.hypot(s[0]-x,s[1]-z)<sep))continue;wsp.push([x,z])}
  const FB=[[34,0],[-34,0],[0,34],[0,-34]];while(wsp.length<4)wsp.push(FB[wsp.length]);
  const gw=glowTex('205,235,255','90,170,255'),PS=CS*1.6;
  wsp.forEach(([x,z],i)=>{
   const g=new THREE.Group(),wh=new THREE.Mesh(wgeo[i],mPick);wh.scale.setScalar(PS);
   if(CP.wheels[i].s[2]<0)wh.rotation.y=Math.PI;   // lado esquerdo: face de fora virada pra fora
   g.add(wh);
   const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:gw,transparent:true,opacity:.42,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));gl.scale.set(2.2,2.2,1);g.add(gl);
   const pl=new THREE.PointLight(0x8fc8ff,.8,4.4,2);g.add(pl);
   g.position.set(x,H(x,z)+1.0,z);scene.add(g);wheels.push({g,x,z,y:g.position.y,got:false,gl,pl,ph:rnd()*6,i});
  });
  /* rodas "em espera": cada roda coletada aparece no chão ao lado do carro, junto do encaixe dela, até o jogador encaixar (QTE) */
  const SW=CS*1.25;
  CP.wheels.forEach((w,i)=>{
   const sgn=w.s[2]<0?-1:1,lat=sgn*(CP.wid/2*CS+1.3),lon=w.s[0]*CS,x=carX+hx*lon+sx*lat,z=carZ+hz*lon+sz*lat,
    g=new THREE.Group(),wh=new THREE.Mesh(wgeo[i],mPick);wh.scale.setScalar(SW);if(sgn<0)wh.rotation.y=Math.PI;g.add(wh);
   const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:gw,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));gl.scale.set(1.5,1.5,1);g.add(gl);
   g.rotation.y=th+Math.PI/2;   // eixo x do modelo = frente do carro: a roda fica de lado, alinhada com ele
   const y=H(x,z)+CP.wr*SW+.02;g.position.set(x,y,z);g.visible=false;scene.add(g);staged.push({g,gl,x,z,y,ph:rnd()*6,st:0,pop:0});
  });
  disp.push(gw,ct,...wgeo);
 }
 /* moedas: longe do início e longe uma da outra, fora de árvores/pedras */
 const free=(x,z,m)=>{for(const o of obst)if(Math.hypot(o[0]-x,o[1]-z)<o[2]+m)return false;return true};
 const spots=[];
 for(let tries=0;spots.length<2&&tries<400;tries++){
  const a=rnd()*6.283,d=24+rnd()*(R-30),x=Math.cos(a)*d,z=Math.sin(a)*d;
  if(!free(x,z,1.6))continue;if(spots.some(s=>Math.hypot(s[0]-x,s[1]-z)<38)||wheels.some(w=>Math.hypot(w.x-x,w.z-z)<10))continue;spots.push([x,z]);
 }
 while(spots.length<2)spots.push([spots.length?-30:30,spots.length?-30:30]);
 const gt=glowTex(),coins=[],goldM=()=>new THREE.MeshStandardMaterial({color:0xffd21f,emissive:0xff9d00,emissiveIntensity:.6,metalness:.7,roughness:.35});   // 1 material por moeda: o falso fica vermelho sozinho
 for(const[x,z]of spots){
  const gold=goldM(),g=new THREE.Group(),disc=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.07,28),gold);disc.rotation.x=Math.PI/2;g.add(disc);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.27,.025,8,28),gold);g.add(ring);
  const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:gt,transparent:true,opacity:.42,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));gl.scale.set(1.7,1.7,1);g.add(gl);
  const pl=new THREE.PointLight(0xffc233,.8,4.2,2);g.add(pl);
  g.position.set(x,H(x,z)+1.05,z);scene.add(g);coins.push({g,x,z,y:g.position.y,got:false,gl,pl,ph:rnd()*6,gm:gold,fx:-1,safe:false,pop:0});
 }
 /* vaga-lumes decorativos (ajudam a dar escala) */
 const NF=40,fp=new Float32Array(NF*3),fl=[];for(let i=0;i<NF;i++){const a=rnd()*6.283,d=rnd()*R,x=Math.cos(a)*d,z=Math.sin(a)*d;fl.push([x,z,rnd()*6]);fp[i*3]=x;fp[i*3+1]=H(x,z)+1+rnd()*2;fp[i*3+2]=z}
 const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.BufferAttribute(fp,3));
 const ff=new THREE.Points(fg,new THREE.PointsMaterial({color:0xbfff8a,size:.14,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(ff);
 /* Shadow Man (modelo em shadowman.js): malha preta que só tem os olhos/boca brilhando (textura emissiva) + 2 brilhos de olho que atravessam a névoa,
    assim ele é percebido de longe mesmo no escuro. Começa invisível; quem manda nele é smTick(). Se o pack não carregar, o minigame funciona sem ele. */
 let shadow=null;const SP=OWM.shadowPack;
 if(SP){
  const sgeo=new THREE.BufferGeometry();
  const spos=unb64(SP.body.p,Float32Array),base=spos.slice(),eyePts=SP.eyes.map(e=>[e[0],e[1],e[2]+.025]),sk=smSkinInit(base,eyePts);   // base = corpo em repouso; spos é reescrito a cada pose
  sgeo.setAttribute('position',new THREE.BufferAttribute(spos,3).setUsage(THREE.DynamicDrawUsage));sgeo.setAttribute('normal',new THREE.BufferAttribute(f32(unb64(SP.body.n,Int8Array),1/127),3));
  sgeo.setAttribute('uv',new THREE.BufferAttribute(unb64(SP.body.u,Float32Array),2));sgeo.setIndex(new THREE.BufferAttribute(unb64(SP.body.i,Uint16Array),1));sgeo.computeBoundingSphere();
  const stex=new THREE.TextureLoader().load(SP.tex);stex.flipY=false;
  const smat=new THREE.MeshBasicMaterial({map:stex,fog:false,transparent:true,opacity:0,side:THREE.DoubleSide});   // corpo preto puro + olhos/boca brancos da textura; sem névoa: de longe vira uma silhueta
  const sgrp=new THREE.Group(),smesh=new THREE.Mesh(sgeo,smat);smesh.frustumCulled=false;sgrp.add(smesh);
  const egl=glowTex('255,255,255','205,215,255'),hgl=glowTex('150,175,235','80,105,185');
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:hgl,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));halo.scale.set(2.8,4.4,1);halo.visible=false;scene.add(halo);   // brilho pálido ATRÁS dele: a silhueta preta aparece contra ele
  const glows=SP.eyes.map(e=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:egl,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));sp.position.set(e[0],e[1],e[2]+.02);sp.scale.set(.25,.25,1);sgrp.add(sp);return sp});
  const ringMat=new THREE.MeshBasicMaterial({color:0x6dff8c,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,fog:false}),beamMat=new THREE.MeshBasicMaterial({color:0x4dff7c,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,fog:false});
  const ring=new THREE.Group(),rm=new THREE.Mesh(new THREE.RingGeometry(.9,1,48),ringMat),bm=new THREE.Mesh(new THREE.CylinderGeometry(1,1,6,24,1,true),beamMat);rm.rotation.x=-Math.PI/2;bm.position.y=3;ring.add(rm,bm);ring.visible=false;scene.add(ring);   // marcador do arbusto onde se esconder
  sgrp.visible=false;scene.add(sgrp);disp.push(sgeo,stex,egl,hgl,smat);
  shadow={g:sgrp,mat:smat,glows,halo,ring,ringMat,beamMat,geo:sgeo,pos:spos,base,sk,eyePts,hh:1.78,lastPose:'',first:true,st:'idle',cd:rv(SM.FIRST),a:0,fo:SM.FADE_OUT,x:0,z:0,yaw:0,idleYaw:0,life:0,stare:0,stareT:0,seen:false,near:false};
 }
 /* efeito VHS: a cena vai para um render target e um quad de tela cheia aplica o shader (tremor por linha, barra de tracking, aberração cromática, scanlines, granulado, glitch) */
 const rt=new THREE.WebGLRenderTarget(2,2,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat});
 const vhs=new THREE.ShaderMaterial({
  uniforms:{tD:{value:rt.texture},t:{value:0},res:{value:new THREE.Vector2(2,2)},k:{value:0},gx:{value:0}},
  depthTest:false,depthWrite:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:[
   'precision highp float;uniform sampler2D tD;uniform float t,k,gx;uniform vec2 res;varying vec2 vUv;',
   'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
   'void main(){',
   ' vec2 uv=vUv;float y=uv.y;float tt=floor(t*22.);',
   ' float wob=sin(y*170.+t*3.)*.0007+(h(vec2(floor(y*res.y*.5),floor(t*12.)))-.5)*.0014;',   // tremor horizontal por linha
   ' float bar=1.-fract(t*.075);float d=abs(y-bar);float ib=smoothstep(.07,0.,d);',               // barra de tracking subindo
   ' wob+=ib*(sin(y*55.+t*18.)*.010+(h(vec2(floor(y*70.),floor(t*30.)))-.5)*.018);',
   ' float gl=step(.982-.03*k,h(vec2(floor(t*6.),7.)));',                                         // glitch ocasional (mais frequente perto do token)
   ' float band=step(.88,h(vec2(floor(y*16.),floor(t*10.))));',
   ' wob+=gl*band*(h(vec2(floor(t*22.),floor(y*16.)))-.5)*.09;',
   ' uv.x+=wob;',
   ' if(gx>0.){',                                                                                   // GLITCH do token falso (gx 0..1): faixas deslocadas, saltos verticais, tremor por linha
   '  float rb=floor(y*(6.+h(vec2(tt,1.))*28.));float on=step(1.-.9*gx,h(vec2(rb,tt)));',
   '  uv.x+=on*(h(vec2(tt,rb))-.5)*.5*gx;',
   '  uv.y+=step(.9,h(vec2(tt,3.)))*(h(vec2(tt,5.))-.5)*.25*gx;',
   '  uv.x+=(h(vec2(floor(y*res.y*.5),tt))-.5)*.03*gx;',
   ' }',
   ' float ca=.0013+.0016*k+ib*.004+gl*band*.012+gx*(.012+.03*h(vec2(tt,9.)));',                                               // aberração cromática
   ' vec3 c;c.r=texture2D(tD,uv+vec2(ca,0.)).r;c.g=texture2D(tD,uv).g;c.b=texture2D(tD,uv-vec2(ca,0.)).b;',
   ' vec3 b=texture2D(tD,uv+vec2(2.5/res.x,0.)).rgb+texture2D(tD,uv-vec2(2.5/res.x,0.)).rgb;',    // "sangramento" de cor da fita
   ' c=c*.7+b*.15;',
   ' float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,.84)*vec3(1.03,1.0,.95);',
   ' c=c*1.1+.012;',
   ' c*=.86+.14*sin(uv.y*res.y*3.14159);',                                                        // scanlines
   ' c+=(h(uv*res+fract(t)*91.)-.5)*(.075+.05*k);',                                               // granulado
   ' c+=ib*((h(uv*res*.5+t)-.5)*.30+.035);',                                                      // chuvisco na barra de tracking
   ' float dr=step(.9965,h(vec2(floor(y*res.y*.5),floor(t*18.))));c+=dr*.22*step(.5,h(vec2(floor(uv.x*9.),floor(t*18.))));',
   ' if(gx>0.){',                                                                                   // blocos de cor aleatória, tom vermelho, flashes invertidos e chuvisco
   '  vec2 bq=floor(uv*vec2(12.,20.));float bn=step(1.-.16*gx,h(bq+tt));',
   '  c=mix(c,vec3(h(bq*1.7+tt),h(bq*2.3+tt),h(bq*3.1+tt)),bn*.9);',
   '  c=mix(c,c*vec3(1.7,.45,.45)+vec3(.08,0.,0.),gx*.45);',
   '  c=mix(c,1.-c,step(.94,h(vec2(tt,13.)))*gx);',
   '  c+=(h(uv*res+t)-.5)*.35*gx;',
   ' }',
   ' vec2 q=vUv-.5;c*=1.-dot(q,q)*.95;',                                                          // vinheta
   ' gl_FragColor=vec4(c,1.);}'
  ].join('\n')});
 const pq=new THREE.Mesh(new THREE.PlaneGeometry(2,2),vhs);pq.frustumCulled=false;
 const ps=new THREE.Scene();ps.add(pq);const pc=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 return{renderer,scene,cam,lamp,H,R,obst,bushes,coins,car,wheels,staged,sm:shadow,wneed:car?4:0,ff,fl,gt,rt,vhs,ps,pc,disposables:[gg,gt,sg,fg,...disp,rocks.geometry,rt,vhs,pq.geometry]};
}

function startFind(){
 if(G)stopFind(true);hQ.classList.remove('on','good','miss','win');hPr.classList.remove('on');hSh.classList.remove('on');hSh.textContent='';
 const seed=(Math.random()*1e9)|0,yaw0=Math.random()*6.283,W=build(seed,yaw0);
 G={...W,yaw:yaw0,wcount:0,wgot:0,q:null,pitch:0,x:0,z:0,y:W.H(0,0)+1.65,vy:0,t:0,found:0,state:'ready',bob:0,pingT:0,pingBuf:null,ac:null,seed,msgT:0,flash:0,touches:new Map(),tension:0,tkT:0,mus:null,tcT:0,glT:-1,jn:0,jx:0,jy:0,jz:0};
 OWM.miniState&&OWM.miniState(true);go('mg-find');resize();updHud();showIntro();
 hMsg.textContent='';
}
function showIntro(){
 ovBox.textContent='';ov.classList.add('on');
 E('h2','','Echos — Ato 1',ovBox);
 E('p','','Está escuro… Só a sua lanterna ilumina o caminho.',ovBox);
 E('p','','Encontre os 2 tokens amarelos escondidos pela floresta.'+(G&&G.wneed?' O carro atrás de você está sem as 4 rodas: elas também estão espalhadas pelo mapa (brilho azulado). Ao pegar uma, ela fica no chão ao lado do carro: chegue perto, aperte E e acerte 4 vezes o ponteiro na zona verde para encaixá-la. Sem as 4 rodas encaixadas, não dá para zerar — mesmo com os tokens.':'')+' Um brilho fraco e um “ping” ficam mais fortes quando você chega perto.',ovBox);
 E('p','mg-keys',touch?'Arraste a metade esquerda da tela para andar e a direita para olhar. Toque em “Encaixar roda” perto do carro.':'WASD / setas: andar · Shift: correr · Mouse: olhar · E: encaixar roda · Esc: pausar',ovBox);
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
 ov.classList.remove('on');hQ.classList.remove('on','good','miss','win');hPr.classList.remove('on');hSh.classList.remove('on');hSh.textContent='';
 if(!silent){OWM.miniState&&OWM.miniState(false);OWM.tokensOpen()}
}
function resize(){if(!G)return;const w=innerWidth,h=innerHeight;G.renderer.setSize(w,h,false);G.cam.aspect=w/h;G.cam.updateProjectionMatrix();const pr=G.renderer.getPixelRatio(),bw=Math.max(2,Math.floor(w*pr)),bh=Math.max(2,Math.floor(h*pr));G.rt.setSize(bw,bh);G.vhs.uniforms.res.value.set(bw,bh)}
addEventListener('resize',resize);
function updHud(){if(!G)return;hFound.textContent='Tokens: '+G.found+' / 2';hWheels.textContent='Rodas: '+G.wgot+' / '+G.wneed+' · Encaixadas: '+G.wcount+' / '+G.wneed;hWheels.style.display=G.wneed?'':'none';hTime.textContent=fmt(G.t)}
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
 G.state='done';G.ev=null;G.lock=false;G.hid=false;smHide(G.sm);hSh.classList.remove('on');G.shMsg=null;try{document.exitPointerLock&&document.exitPointerLock()}catch(e){}
 const t=G.t,best=+ld(BEST,0),nb=!best||t<best;if(nb)st(BEST,t);
 ovBox.textContent='';ov.classList.add('on');
 E('h2','',G&&G.wneed?'Você achou os tokens e montou as 4 rodas!':'Você achou os dois tokens!',ovBox);
 const r=E('div','mg-reward',null,ovBox);coinIcon(r);E('b','','+2 tokens',r);
 E('p','','Tempo: '+fmt(t)+(nb?'  ·  novo recorde!':'  ·  recorde: '+fmt(best)),ovBox);
 E('p','','Você tem '+tokens.get()+' tokens.',ovBox);
 B('Jogar de novo',()=>startFind(),ovBox);B('Voltar ao menu',()=>stopFind(),ovBox);
}

/* ---------- token falso: fica vermelho, encolhe e some (0,7 s) → 2 s de glitch na câmera → um token de verdade reaparece no mesmo lugar ---------- */
const GOLDC=new THREE.Color(0xffd21f),GOLDE=new THREE.Color(0xff9d00),REDC=new THREE.Color(0xff1010),WHT=new THREE.Color(0xffffff),PLC=new THREE.Color(0xffc233);
function glitchSfx(){for(let i=0;i<14;i++)setTimeout(()=>{if(G)beep(60+Math.random()*1400,.05+Math.random()*.07,.07,Math.random()<.5?'sawtooth':'square')},i*(120+Math.random()*40))}
function curse(g,k){
 k.fx=0;k.gs=0;g.flash=.7;hFlash.style.background='radial-gradient(circle,#ff000077,#ff000000 70%)';say('Esse token era falso…',2.2);
 beep(330,.35,.12,'sawtooth');setTimeout(()=>beep(170,.5,.12,'sawtooth'),160);
}
function coinFx(g,k,dt){
 k.fx+=dt;const f=k.fx,T=performance.now()*.001;
 if(f<.7){const u=Math.min(1,f/.3),v=Math.max(0,(f-.3)/.4);   // 0–0,3 s: vermelho · 0,3–0,7 s: encolhe e some
  k.gm.color.copy(GOLDC).lerp(REDC,u);k.gm.emissive.copy(GOLDE).lerp(REDC,u);k.gm.emissiveIntensity=.6+.6*u;
  k.gl.material.color.copy(WHT).lerp(REDC,u);k.gl.material.opacity=.4*(1-v);k.pl.color.copy(PLC).lerp(REDC,u);k.pl.intensity=(.8+.8*u)*(1-v);
  k.g.rotation.y+=dt*(2.2+14*u);k.g.position.y=k.y+Math.sin(T*2+k.ph)*.12+(Math.random()-.5)*.06*u;k.g.scale.setScalar(Math.max(.001,1-v*v));
 }else{
  k.g.visible=false;
  if(!k.gs){k.gs=1;g.glT=0;glitchSfx()}   // some o token → começa o glitch
  if(f>=2.7){   // glitch acabou → outro token (de verdade) no mesmo lugar
   k.gm.color.copy(GOLDC);k.gm.emissive.copy(GOLDE);k.gm.emissiveIntensity=.6;k.gl.material.color.copy(WHT);k.pl.color.copy(PLC);
   k.fx=-1;k.safe=true;k.g.visible=true;k.g.scale.setScalar(.01);k.pop=.45;k.g.position.y=k.y;beep(660,.14,.08,'triangle');
  }
 }
}

function chk(g){if(g.found>=2&&g.wcount>=g.wneed)setTimeout(()=>{if(G===g&&g.state==='play')finish()},700)}
/* pegar uma roda: ela some do mapa e vai para o chão, ao lado do encaixe dela no carro — o jogador ainda precisa encaixar (QTE) */
function takeWheel(g,w){
 w.got=true;w.g.visible=false;g.wgot++;g.flash=.4;hFlash.style.background='';
 const sg=g.staged[w.i];sg.st=1;sg.pop=.45;sg.g.visible=true;sg.g.scale.setScalar(.01);
 say('Roda coletada! Leve até o carro (ela está ao lado dele) e aperte '+(touch?'“Encaixar roda”.':'E.'),3);
 beep(520,.12,.1,'triangle');setTimeout(()=>beep(780,.18,.09,'triangle'),100);updHud();
}
/* ---------- encaixe manual: QTE em formato de roda ----------
   Um aro circular (o pneu) com uma zona verde e um ponteiro que gira. Clique / toque / E / Espaço quando o ponteiro estiver na zona verde.
   WQ.TARGET acertos prendem a roda. Errar (ou deixar o tempo da tentativa acabar) tira 1 acerto; cancelar (Q ou botão) zera. */
const WQ={TARGET:4,SWEEP:1.05,TIME:2.6,ZONE:.15,GRACE:.2,GOOD:.22,WIN:.55,MISS:.45,REACH:3.2};
const hQ=E('div','mg-qte',null,MS),hQt=E('div','mg-qte-top',null,hQ);E('b','','ENCAIXAR A RODA',hQt);const hQn=E('span','mg-qte-n','0/'+WQ.TARGET,hQt);
const hQp=E('div','mg-qte-pips',null,hQ);for(let i=0;i<WQ.TARGET;i++)E('i','',null,hQp);
const hQc=E('canvas','mg-qte-c',null,hQ),hQx=hQc.getContext('2d'),hQs=E('div','mg-qte-s',null,hQ);
const hQb=B('Cancelar',()=>qCancel(),hQ);hQb.classList.add('mg-qte-x');
hQc.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();qHit()});
hQ.addEventListener('pointerdown',e=>e.stopPropagation());
const hPr=B(touch?'Encaixar roda':'E — Encaixar roda',()=>interact(),MS);hPr.classList.add('mg-prompt');
hPr.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});
function qUi(q){hQn.textContent=q.hits+'/'+WQ.TARGET;for(let i=0;i<hQp.children.length;i++)hQp.children[i].classList.toggle('on',i<q.hits)}
function qText(t){hQs.textContent=t}
function qFlash(c,ms){hQ.classList.remove('good','miss');void hQ.offsetWidth;hQ.classList.add(c);setTimeout(()=>hQ.classList.remove(c),ms)}
function qNew(q){q.t=0;q.cur=0;q.res='';q.resT=0;q.c=.3+Math.random()*.6;qUi(q);qText(touch?'Toque quando o ponteiro cruzar a zona verde':'Clique / E / Espaço quando o ponteiro cruzar a zona verde')}
function nearStaged(g){let b=null,bd=WQ.REACH;for(const s of g.staged){if(s.st!==1)continue;const d=Math.hypot(s.x-g.x,s.z-g.z);if(d<bd){bd=d;b=s}}return b}
function interact(){
 const g=G;if(!g||g.state!=='play'||g.q)return;const s=nearStaged(g);if(!s)return;
 g.q={i:g.staged.indexOf(s),hits:0,t:0,cur:0,c:.5,res:'',resT:0,bu:0};qNew(g.q);hQ.classList.remove('good','miss','win');hQ.classList.add('on');hPr.classList.remove('on');
 beep(300,.08,.06,'triangle');
}
function qCancel(){
 const g=G;if(!g||!g.q)return;g.q=null;hQ.classList.remove('on','good','miss','win');say('Encaixe cancelado. A roda continua ao lado do carro.',2.2);
}
function qHit(){
 const g=G,q=g&&g.q;if(!q||g.state!=='play'||q.res||q.t<WQ.GRACE)return;
 let d=Math.abs(q.cur-q.c);d=Math.min(d,1-d);q.bu=q.cur;
 if(d<=WQ.ZONE/2){
  q.hits++;qUi(q);
  if(q.hits>=WQ.TARGET){q.res='hit';q.resT=WQ.WIN;hQ.classList.add('win');qText('Roda encaixada!');beep(660,.1,.1,'triangle');setTimeout(()=>beep(990,.2,.1,'triangle'),90)}
  else{q.res='good';q.resT=WQ.GOOD;qFlash('good',260);qText('Acerto! Continue...');beep(560+q.hits*110,.08,.08,'triangle')}
 }else qMiss(g,'Errou! Perdeu 1 acerto.');
}
function qMiss(g,why){
 const q=g.q;if(!q||q.res)return;q.res='miss';q.resT=WQ.MISS;q.hits=Math.max(0,q.hits-1);qUi(q);qFlash('miss',450);qText(why);beep(170,.2,.1,'sawtooth');
}
function qDone(g){
 const q=g.q,sg=g.staged[q.i];g.q=null;hQ.classList.remove('on','good','miss','win');
 sg.st=2;sg.g.visible=false;g.wcount++;g.flash=.5;hFlash.style.background='';
 const m=g.car.mounted[q.i];m.on=true;m.t=0;m.m.visible=true;
 const left=g.wneed-g.wcount;
 say(left?(g.wcount+' / '+g.wneed+' rodas encaixadas.'):(g.found<2?'Rodas completas! Falta '+(2-g.found)+' token'+(g.found<1?'s':'')+'.':'Última roda!'),2.6);
 updHud();chk(g);
}
function qUpdate(g,dt){
 const q=g.q;if(!q||g.state!=='play')return;
 if(q.res){q.resT-=dt;if(q.resT<=0){if(q.res==='hit')qDone(g);else qNew(q)}return}
 q.t+=dt;q.cur=(q.t/WQ.SWEEP)%1;
 if(q.t>=WQ.TIME)qMiss(g,'Tempo esgotado! Perdeu 1 acerto.');
}
function qDraw(q){
 const W=220,C=W/2,R=80,TW=28,dpr=Math.min(2,window.devicePixelRatio||1),x=hQx;
 if(hQc.width!==W*dpr){hQc.width=hQc.height=W*dpr}
 x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,W);
 const A=u=>-Math.PI/2+u*Math.PI*2,hw=WQ.ZONE/2,d0=Math.min(Math.abs(q.cur-q.c),1-Math.abs(q.cur-q.c)),near=!q.res&&d0<=hw,won=q.res==='hit',miss=q.res==='miss';
 const shake=miss?Math.sin(q.resT*90)*4*(q.resT/WQ.MISS):0,pulse=.5+.5*Math.sin(performance.now()*.008);
 x.save();x.translate(shake,0);x.lineCap='round';
 /* fundo */
 let g=x.createRadialGradient(C,C,10,C,C,C);g.addColorStop(0,'rgba(14,18,26,.92)');g.addColorStop(1,'rgba(4,6,10,.85)');x.fillStyle=g;x.beginPath();x.arc(C,C,C-4,0,7);x.fill();
 /* pneu */
 x.lineWidth=TW+8;x.strokeStyle='#05070a';x.beginPath();x.arc(C,C,R,0,7);x.stroke();
 x.lineWidth=TW;x.strokeStyle='#161b24';x.beginPath();x.arc(C,C,R,0,7);x.stroke();
 x.lineWidth=2;x.strokeStyle='rgba(255,255,255,.18)';x.beginPath();x.arc(C,C,R+TW/2,0,7);x.stroke();x.beginPath();x.arc(C,C,R-TW/2,0,7);x.stroke();
 x.lineWidth=1.5;x.strokeStyle='rgba(255,255,255,.08)';for(let i=0;i<40;i++){const a=i/40*Math.PI*2;x.beginPath();x.moveTo(C+Math.cos(a)*(R-TW/2+3),C+Math.sin(a)*(R-TW/2+3));x.lineTo(C+Math.cos(a)*(R+TW/2-3),C+Math.sin(a)*(R+TW/2-3));x.stroke()}   // desenho da banda de rodagem
 /* zona verde (arco no pneu) */
 const a0=A(q.c-hw),a1=A(q.c+hw);
 x.save();x.shadowColor='#3dff7a';x.shadowBlur=near?26:12;x.lineWidth=TW-6;x.strokeStyle=won?'#d4ffe0':'rgba(70,235,120,'+(.65+.3*pulse)+')';x.beginPath();x.arc(C,C,R,a0,a1);x.stroke();x.restore();
 x.lineWidth=2;x.strokeStyle='rgba(235,255,240,.95)';for(const a of[a0,a1]){x.beginPath();x.moveTo(C+Math.cos(a)*(R-TW/2+1),C+Math.sin(a)*(R-TW/2+1));x.lineTo(C+Math.cos(a)*(R+TW/2-1),C+Math.sin(a)*(R+TW/2-1));x.stroke()}
 /* rastro do ponteiro */
 if(!q.res||q.res==='good'||miss){const n=10;for(let i=0;i<n;i++){const ua=q.cur-(i+1)*.012,ub=q.cur-i*.012;x.strokeStyle='rgba(200,240,255,'+(.38*(1-i/n))+')';x.lineWidth=TW*.7*(1-i/n);x.beginPath();x.arc(C,C,R,A(ua),A(ub));x.stroke()}}
 /* cubo da roda (aro + raios), gira junto com o ponteiro */
 const hub=A(q.cur);x.lineWidth=3;x.strokeStyle='#8a93a6';x.beginPath();x.arc(C,C,R-TW/2-14,0,7);x.stroke();
 x.lineWidth=3;x.strokeStyle='#5d6678';for(let i=0;i<5;i++){const a=hub+i*Math.PI*2/5;x.beginPath();x.moveTo(C+Math.cos(a)*8,C+Math.sin(a)*8);x.lineTo(C+Math.cos(a)*(R-TW/2-16),C+Math.sin(a)*(R-TW/2-16));x.stroke()}
 x.fillStyle='#aab3c5';x.beginPath();x.arc(C,C,8,0,7);x.fill();x.fillStyle='#2a303c';x.beginPath();x.arc(C,C,3.2,0,7);x.fill();
 /* tempo da tentativa (arco interno) */
 const fr=Math.max(0,1-q.t/WQ.TIME),tc=fr>.5?'#ffe066':fr>.25?'#ff9a2e':'#ff4a3a';
 x.lineWidth=4;x.strokeStyle='rgba(255,255,255,.1)';x.beginPath();x.arc(C,C,R-TW/2-6,0,7);x.stroke();
 if(fr>0){x.strokeStyle=tc;x.beginPath();x.arc(C,C,R-TW/2-6,-Math.PI/2,-Math.PI/2+Math.PI*2*fr);x.stroke()}
 /* ponteiro */
 const mc=miss?'#ff655d':near?'#b6ffc4':'#f3fbff',ca=Math.cos(hub),sa=Math.sin(hub);
 x.save();x.shadowColor=near?'#5dff8d':'#bfe6ff';x.shadowBlur=near?22:10;x.lineWidth=5;x.strokeStyle=mc;x.beginPath();x.moveTo(C+ca*(R-TW/2-5),C+sa*(R-TW/2-5));x.lineTo(C+ca*(R+TW/2+8),C+sa*(R+TW/2+8));x.stroke();x.restore();
 /* explosão de acerto / X de erro */
 if((q.res==='good'||won)){const dur=won?WQ.WIN:WQ.GOOD,p=Math.min(1,Math.max(0,1-q.resT/dur)),ba=A(q.bu);x.strokeStyle='rgba(160,255,190,'+(1-p)+')';x.lineWidth=1+3*(1-p);
  const bx=C+Math.cos(ba)*R,by=C+Math.sin(ba)*R;x.beginPath();x.arc(bx,by,5+p*(won?34:22),0,7);x.stroke();
  for(let i=0;i<8;i++){const a=i*.785+.2,r0=6+p*10,r1=10+p*(won?30:20);x.beginPath();x.moveTo(bx+Math.cos(a)*r0,by+Math.sin(a)*r0);x.lineTo(bx+Math.cos(a)*r1,by+Math.sin(a)*r1);x.stroke()}}
 if(miss){const k=Math.max(0,q.resT/WQ.MISS);x.strokeStyle='rgba(255,110,100,'+k+')';x.lineWidth=5;x.beginPath();x.moveTo(C-14,C-14);x.lineTo(C+14,C+14);x.moveTo(C+14,C-14);x.lineTo(C-14,C+14);x.stroke()}
 x.restore();
}
/* ---------- Poses do Shadow Man ----------
   O modelo é uma malha estática (sem ossos). Aqui criamos um esqueleto simples por cima: cada vértice recebe os 3 ossos mais próximos (pesos por distância)
   e cada pose é uma lista de rotações por junta, em graus [x,y,z]. Convenções (frente do modelo = +z, braço +x = "L"):
     rx>0 inclina o tronco/cabeça para a frente; braço/perna/antebraço com rx<0 vão para a frente · ry = giro · rz>0 abre o braço L para fora / inclina o tronco para -x.
   Cada aparição sorteia uma pose diferente: 55% normais, 45% contorcidas. */
const SMB=[   // [nome, índice do pai, pivô da junta, início do osso, fim do osso]  (os pais vêm antes dos filhos)
 ['pelvis',-1,[0,.92,-.03],[0,.85,-.03],[0,1,-.03]],
 ['spine',0,[0,1,-.03],[0,1,-.03],[0,1.3,-.03]],
 ['chest',1,[0,1.3,-.03],[0,1.3,-.03],[0,1.55,-.03]],
 ['neck',2,[0,1.56,-.02],[0,1.55,-.03],[0,1.68,-.02]],
 ['head',3,[0,1.68,-.02],[0,1.68,-.02],[0,1.9,-.02]],
 ['armL',2,[.22,1.5,-.04],[.22,1.5,-.04],[.36,1.17,-.03]],['elbowL',5,[.36,1.17,-.03],[.36,1.17,-.03],[.47,.78,-.02]],
 ['armR',2,[-.22,1.5,-.04],[-.22,1.5,-.04],[-.36,1.17,-.03]],['elbowR',7,[-.36,1.17,-.03],[-.36,1.17,-.03],[-.47,.78,-.02]],
 ['legL',0,[.12,.9,-.03],[.12,.9,-.03],[.14,.5,-.05]],['kneeL',9,[.14,.5,-.05],[.14,.5,-.05],[.16,.03,-.05]],
 ['legR',0,[-.12,.9,-.03],[-.12,.9,-.03],[-.14,.5,-.05]],['kneeR',11,[-.14,.5,-.05],[-.14,.5,-.05],[-.16,.03,-.05]]
];
const SMP={   // poses normais
 estatua:{spine:[0,0,6],head:[0,0,14],armL:[0,0,26],armR:[-10,0,-4],legL:[0,0,5]},
 adoracao:{head:[-30,0,0],spine:[-6,0,0],armL:[0,0,168],armR:[0,0,-168],elbowL:[0,0,8],elbowR:[0,0,-8]},
 espreita:{spine:[24,0,0],chest:[12,0,0],head:[-20,0,0],armL:[-28,0,4],armR:[-28,0,-4],legL:[-8,0,0],kneeL:[16,0,0],legR:[8,0,0]},
 alcance:{spine:[10,0,0],armL:[-95,0,6],elbowL:[-8,0,0],armR:[24,0,-8],head:[-8,0,18]},
 agachado:{spine:[28,0,0],head:[-30,0,0],legL:[-78,0,8],kneeL:[118,0,0],legR:[-78,0,-8],kneeR:[118,0,0],armL:[-50,0,6],armR:[-50,0,-6],elbowL:[-30,0,0],elbowR:[-30,0,0]},
 cabecatorta:{neck:[0,0,18],head:[0,0,52],spine:[0,0,-6],armL:[0,0,10],armR:[0,0,-10]},
 bracosnorosto:{spine:[8,0,0],head:[14,0,0],armL:[-40,0,-14],elbowL:[-120,0,0],armR:[-40,0,14],elbowR:[-120,0,0]}
};
const SMC={   // poses contorcidas
 sobreombro:{pelvis:[0,-25,0],spine:[0,40,0],chest:[0,45,0],neck:[0,50,0],head:[0,60,0],armL:[-10,0,14],armR:[-10,-30,-14]},   // corpo virado, cabeça girada quase 180° em relação aos pés
 arco:{spine:[-30,0,0],chest:[-32,0,0],neck:[-30,0,0],head:[-24,0,0],armL:[0,0,115],elbowL:[0,0,80],armR:[0,0,-115],elbowR:[0,0,-80],legL:[8,0,18],legR:[8,0,-18]},
 dobrado:{spine:[0,0,50],chest:[0,0,38],neck:[0,0,-30],head:[0,0,-62],armL:[0,0,155],elbowL:[0,0,20],armR:[0,0,-14],elbowR:[-40,0,0]},
 aranha:{spine:[44,0,0],chest:[16,0,0],head:[-60,0,0],legL:[-56,0,62],kneeL:[104,0,0],legR:[-56,0,-62],kneeR:[104,0,0],armL:[-30,0,105],elbowL:[-60,0,0],armR:[-30,0,-105],elbowR:[-60,0,0]},
 bracostorcidos:{spine:[14,0,0],head:[0,0,34],armL:[-170,-60,18],elbowL:[-90,0,0],armR:[-20,110,-30],elbowR:[-100,70,0],kneeL:[20,0,0]},
 torcidoeassimetrico:{pelvis:[0,30,10],spine:[10,-45,-25],chest:[0,-30,-20],head:[10,-80,40],armL:[-60,40,150],elbowL:[0,0,70],armR:[40,-20,-40],legL:[-18,0,0],kneeL:[50,0,0],legR:[10,0,-22]}
};
const SMX={   // poses do evento de perseguição
 corrida:{spine:[26,0,0],chest:[10,0,0],head:[-14,0,0],armL:[28,0,4],elbowL:[-80,0,0],armR:[-40,0,-4],elbowR:[-80,0,0],legL:[-52,0,0],kneeL:[70,0,0],legR:[30,0,0],kneeR:[20,0,0]},
 garra:{spine:[16,0,0],head:[-12,0,0],armL:[-100,0,22],elbowL:[-10,0,0],armR:[-100,0,-22],elbowR:[-10,0,0]}
};
function smRot(r){const d=Math.PI/180,a=r[0]*d,b=r[1]*d,c=r[2]*d,sa=Math.sin(a),ca=Math.cos(a),sb=Math.sin(b),cb=Math.cos(b),sc=Math.sin(c),cc=Math.cos(c);   // Rz·Ry·Rx
 return[cc*cb,cc*sb*sa-sc*ca,cc*sb*ca+sc*sa, sc*cb,sc*sb*sa+cc*ca,sc*sb*ca-cc*sa, -sb,cb*sa,cb*ca]}
function smMul(a,b){const o=new Array(9);for(let i=0;i<3;i++)for(let j=0;j<3;j++)o[i*3+j]=a[i*3]*b[j]+a[i*3+1]*b[3+j]+a[i*3+2]*b[6+j];return o}
function smSegD(p,a,b){const abx=b[0]-a[0],aby=b[1]-a[1],abz=b[2]-a[2],L=abx*abx+aby*aby+abz*abz;let t=L>0?((p[0]-a[0])*abx+(p[1]-a[1])*aby+(p[2]-a[2])*abz)/L:0;t=Math.max(0,Math.min(1,t));
 return Math.hypot(p[0]-a[0]-abx*t,p[1]-a[1]-aby*t,p[2]-a[2]-abz*t)}
function smWeights(p){   // 3 ossos mais próximos, peso ~ 1/d^4
 const w=SMB.map((b,i)=>[i,1/(Math.pow(smSegD(p,b[3],b[4]),4)+1e-6)]).sort((x,y)=>y[1]-x[1]).slice(0,3),s=w[0][1]+w[1][1]+w[2][1];
 return w.map(x=>[x[0],x[1]/s]);
}
function smSkinInit(pos,pts){   // pos: Float32Array xyz; pts: pontos extras (olhos) → {bi,w,pbi,pw}
 const n=pos.length/3,bi=new Uint8Array(n*3),w=new Float32Array(n*3);
 for(let v=0;v<n;v++){const k=smWeights([pos[v*3],pos[v*3+1],pos[v*3+2]]);for(let j=0;j<3;j++){bi[v*3+j]=k[j][0];w[v*3+j]=k[j][1]}}
 return{bi,w,pw:pts.map(smWeights)};
}
function smMats(pose){
 const R=[],T=[];
 for(let i=0;i<SMB.length;i++){const b=SMB[i],r=smRot(pose[b[0]]||[0,0,0]),c=b[2],lt=[c[0]-(r[0]*c[0]+r[1]*c[1]+r[2]*c[2]),c[1]-(r[3]*c[0]+r[4]*c[1]+r[5]*c[2]),c[2]-(r[6]*c[0]+r[7]*c[1]+r[8]*c[2])];
  if(b[1]<0){R[i]=r;T[i]=lt}else{const pr=R[b[1]],pt=T[b[1]];R[i]=smMul(pr,r);T[i]=[pr[0]*lt[0]+pr[1]*lt[1]+pr[2]*lt[2]+pt[0],pr[3]*lt[0]+pr[4]*lt[1]+pr[5]*lt[2]+pt[1],pr[6]*lt[0]+pr[7]*lt[1]+pr[8]*lt[2]+pt[2]]}}
 return{R,T};
}
/* aplica a pose: escreve em out (Float32Array) e devolve as posições dos pontos extras (olhos) já no chão */
function smPoseApply(base,sk,pts,pose,out){
 const M=smMats(pose),n=base.length/3;let minY=1e9;
 for(let v=0;v<n;v++){const x=base[v*3],y=base[v*3+1],z=base[v*3+2];let X=0,Y=0,Z=0;
  for(let j=0;j<3;j++){const i=sk.bi[v*3+j],w=sk.w[v*3+j],R=M.R[i],T=M.T[i];X+=w*(R[0]*x+R[1]*y+R[2]*z+T[0]);Y+=w*(R[3]*x+R[4]*y+R[5]*z+T[1]);Z+=w*(R[6]*x+R[7]*y+R[8]*z+T[2])}
  out[v*3]=X;out[v*3+1]=Y;out[v*3+2]=Z;if(Y<minY)minY=Y}
 for(let v=0;v<n;v++)out[v*3+1]-=minY;   // pés no chão
 const eo=pts.map((p,k)=>{let X=0,Y=0,Z=0;for(const [i,w] of sk.pw[k]){const R=M.R[i],T=M.T[i];X+=w*(R[0]*p[0]+R[1]*p[1]+R[2]*p[2]+T[0]);Y+=w*(R[3]*p[0]+R[4]*p[1]+R[5]*p[2]+T[1]);Z+=w*(R[6]*p[0]+R[7]*p[1]+R[8]*p[2]+T[2])}return[X,Y-minY,Z]});
 return eo;
}
function smMakePose(spec,k,jit){   // k = intensidade, jit = variação aleatória em graus
 const o={};for(const n in spec)o[n]=spec[n].map(a=>a*k+(Math.random()*2-1)*jit);return o;
}

/* ---------- Shadow Man ----------
   Aparece sozinho — às vezes PERTO, na frente do jogador; às vezes LONGE (de longe só se vêem os olhos brilhando) — e fica parado, virado para o lado oposto.
   Ele só "observa" (vira para o jogador e encara) quando o jogador olha DIRETAMENTE para ele: mira dentro de um cone e sem árvore/pedra no caminho.
   Depois de encarar um instante — ou NA HORA, com chance SM.P_INSTANT — ele some. Também some sozinho depois de um tempo, perto ou longe, e some se o jogador chegar perto demais.
   Nunca persegue nem machuca. Tudo ajustável aqui: tempos em segundos, distâncias em metros, ângulos em radianos. */
const SM={
 FIRST:[5,9],        // 1ª aparição (sempre PERTO e na frente): segundos depois de começar a partida
 CD:[7,16],          // espera entre o sumiço e a próxima aparição (diminui até 50% conforme o tempo passa)
 P_NEAR:.5,          // chance de aparecer PERTO (dentro do campo de visão); senão aparece LONGE
 NEAR:[5,11],        // distância quando aparece perto
 FAR:[16,32],        // distância quando aparece longe
 LIFE_NEAR:[8,18],   // quanto tempo fica, se ninguém olhar, quando apareceu perto
 LIFE_FAR:[16,36],   // idem, quando apareceu longe
 LOOK:.14,           // "olhar diretamente": ângulo máximo entre a mira e ele (~8°)
 MAXD:70,            // distância máxima em que o olhar conta
 STARE:[.9,2.8],     // quanto tempo ele encara antes de sumir
 P_INSTANT:.3,       // chance de sumir NA HORA em que o jogador olha para ele
 FADE_IN:.4,FADE_OUT:.45,
 MIN_D:2.4,          // se o jogador chegar tão perto, ele some
 /* evento "Fugir não vai te livrar de tudo": ele corre até o jogador, que tem CH_WIN segundos para se esconder num arbusto (2 cliques/toques) */
 P_CHASE:.3,         // chance de a fala de perseguição sair quando ele aparece perto ou é olhado
 CH_MIN_T:30,        // só depois de tantos segundos de partida
 CH_CD:60,           // pausa entre dois eventos
 CH_TALK:.9,         // pausa depois que a fala termina de aparecer, antes da contagem começar (o jogador fica paralisado olhando para ele)
 CH_WIN:3,           // segundos para se esconder (a contagem só começa DEPOIS que ele fala)
 BUSH_REACH:11,      // o evento só rola se houver arbusto a menos de tantos metros (da borda)
 BUSH_IN:.95         // basta encostar/entrar no arbusto (distância da borda) para se esconder: a cutscene começa sozinha
};
const rr=(a,b)=>a+Math.random()*(b-a),rv=r=>rr(r[0],r[1]);
const SM_DEV=/[?&](shadow|chase)=1/.test(location.search),SM_CH=/[?&]chase=1/.test(location.search);   // modo teste: ?shadow=1 → ele aparece PERTO a cada ~4 s (V chama na hora); ?chase=1 → além disso, o evento de perseguição sempre rola quando há arbusto por perto
/* áudio do susto (WebAudio, sem arquivo) — respeita o volume de música das configurações */
function smNoise(ac,t,d,v,f,q){const n=Math.max(1,Math.floor(ac.sampleRate*d)),b=ac.createBuffer(1,n,ac.sampleRate),a=b.getChannelData(0);for(let i=0;i<n;i++)a[i]=Math.random()*2-1;
 const s=ac.createBufferSource(),fl=ac.createBiquadFilter(),g=ac.createGain();s.buffer=b;fl.type='bandpass';fl.frequency.value=f;fl.Q.value=q||.8;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+Math.min(.03,d/3));g.gain.exponentialRampToValueAtTime(.0001,t+d);s.connect(fl);fl.connect(g);g.connect(ac.destination);s.start(t)}
function smSfx(kind){
 const ac=G&&G.ac;if(!ac||ac.state!=='running')return;const t=ac.currentTime+.01,m=mvl();if(m<=0)return;
 if(kind==='near'){   // apareceu perto: estática curta + grave que cresce
  smNoise(ac,t,.35,.22*m,2400,.6);
  const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.setValueAtTime(42,t);o.frequency.linearRampToValueAtTime(58,t+1.6);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.5*m,t+1.1);g.gain.exponentialRampToValueAtTime(.0001,t+2.2);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+2.3);
 }else if(kind==='chase'){   // alarme grave + batimentos acelerando
  smNoise(ac,t,.5,.3*m,500,.5);const dst=ac.createGain();dst.gain.value=m;dst.connect(ac.destination);[0,.5,1,1.4,1.8,2.15,2.5,2.8].forEach((d,i)=>thump(ac,dst,t+d,.45+.07*i));
 }else if(kind==='hide'){   // escondido: zumbido grave e abafado
  const o=ac.createOscillator(),g2=ac.createGain();o.type='triangle';o.frequency.setValueAtTime(52,t);o.frequency.linearRampToValueAtTime(40,t+6);g2.gain.setValueAtTime(.0001,t);g2.gain.exponentialRampToValueAtTime(.4*m,t+1.2);g2.gain.exponentialRampToValueAtTime(.0001,t+7);o.connect(g2);g2.connect(ac.destination);o.start(t);o.stop(t+7.1);smNoise(ac,t,3,.05*m,400,.7);
 }else if(kind==='catch'){   // ele pega o jogador: grito de ruído + guinchos + baque
  smNoise(ac,t,1.2,.8*m,650,.4);
  for(const f0 of[2100,1400]){const o=ac.createOscillator(),g2=ac.createGain();o.type='sawtooth';o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(70,t+1);g2.gain.setValueAtTime(.0001,t);g2.gain.exponentialRampToValueAtTime(.22*m,t+.02);g2.gain.exponentialRampToValueAtTime(.0001,t+1.1);o.connect(g2);g2.connect(ac.destination);o.start(t);o.stop(t+1.15)}
  const dst=ac.createGain();dst.gain.value=m;dst.connect(ac.destination);thump(ac,dst,t,1);thump(ac,dst,t+.18,.8);
 }else if(kind==='txt'){   // chiado curto quando o texto aparece
  smNoise(ac,t,.14,.07*m,3200,1.2);
 }else if(kind==='far'){   // apareceu longe: sopro/sussurro distante
  smNoise(ac,t,1.6,.05*m,1700,3);
 }else if(kind==='scare'){   // o jogador olhou: estouro de ruído + guincho descendo + baque
  smNoise(ac,t,.5,.5*m,900,.5);
  const o=ac.createOscillator(),g=ac.createGain();o.type='sawtooth';o.frequency.setValueAtTime(1500,t);o.frequency.exponentialRampToValueAtTime(90,t+.6);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.18*m,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.65);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+.7);
  const dst=ac.createGain();dst.gain.value=m;dst.connect(ac.destination);thump(ac,dst,t,.9);
 }
}
function smScare(g){smSfx('scare');smSay(g,'scare');if(g.glT<0)g.glT=1.25;g.flash=Math.max(g.flash,.25);hFlash.style.background='radial-gradient(circle,#ffffff44,#ffffff00 70%)'}   // glitch curto na câmera ao ser olhado
/* fala do Shadow Man: de vez em quando aparece um texto verde de fita VHS no meio inferior da tela, "digitando" com caracteres corrompidos.
   P = chance de falar em cada situação; CD = pausa mínima entre falas; HOLD = quanto tempo o texto fica inteiro. */
const SAY={
 P:{near:.45,far:.2,scare:.55,gone:.3},CD:12,HOLD:3,
 L:{near:['Eu estou te vendo.','Você não devia estar aqui.','Olhe para mim.','Está escuro, não é?','Eu estava aqui o tempo todo.','Pare de procurar.'],
    far:['Estou aqui.','Não olhe para trás.','Quase lá...','Eu sinto você.'],
    scare:['Você me viu.','Agora é tarde.','Não desvie o olhar.','Eu vejo você também.'],
    gone:['Eu volto.','Ainda estou aqui.','Corra.','Não foi nada...']}
};
const SAY_GL='#@%&?/\\<>=+*';
function smSay(g,ev){
 if((ev==='near'||ev==='scare')&&g.sm&&g.sm.st==='on'&&(SM_CH||Math.random()<SM.P_CHASE)&&smChaseOK(g,g.sm)){smChase(g,g.sm);return}   // às vezes a fala é "Fugir não vai te livrar de tudo."
 if(g.shMsg||g.shC>0||g.q||g.ev)return;
 if(!SM_DEV&&Math.random()>SAY.P[ev])return;
 const L=SAY.L[ev],txt=L[(Math.random()*L.length)|0];
 g.shMsg={txt,t:0,shown:''};g.shC=SAY.CD+txt.length/24+SAY.HOLD;smSfx('txt');
}
function smSayTick(g,dt){
 if(g.shC>0)g.shC-=dt;
 const m=g.shMsg;if(!m)return;
 if(g.q){hSh.classList.remove('on');g.shMsg=null;return}   // encaixando a roda: a fala some
 m.t+=dt;const n=m.txt.length,sp=m.sp||24,type=n/sp,end=type+SAY.HOLD,out=.4;
 if(m.t>=end+out){hSh.classList.remove('on');hSh.textContent='';g.shMsg=null;return}
 const k=Math.min(n,Math.floor(m.t*sp)),bad=m.t<type?.05:(m.t>end?Math.min(.6,(m.t-end)/out):.012);   // corrompe letras: pouco ao digitar, bastante ao sumir
 let o='';for(let i=0;i<k;i++){const c=m.txt[i];o+=(c!==' '&&Math.random()<bad)?SAY_GL[(Math.random()*SAY_GL.length)|0]:c}
 if(o!==m.shown){m.shown=o;hSh.textContent=o}
 hSh.classList.add('on');
}
function smFree(g,x,z){   // dentro da área e fora de árvores/pedras/carro
 if(Math.hypot(x,z)>g.R-2)return false;
 for(const o of g.obst)if(Math.hypot(o[0]-x,o[1]-z)<o[2]+.7)return false;
 return true;
}
function smBlocked(g,x0,z0,x1,z1){   // tem árvore/pedra/carro entre os dois pontos? (segmento × círculos de colisão)
 const dx=x1-x0,dz=z1-z0,L2=dx*dx+dz*dz;if(L2<1e-6)return false;
 for(const o of g.obst){const t=Math.max(0,Math.min(1,((o[0]-x0)*dx+(o[1]-z0)*dz)/L2)),px=x0+dx*t-o[0],pz=z0+dz*t-o[1];if(px*px+pz*pz<o[2]*o[2])return true}
 return false;
}
function smGaze(g,sm){   // o jogador está olhando direto para ele?
 const tx=sm.x,tz=sm.z,ty=sm.g.position.y+(sm.hh||1.5),dx=tx-g.x,dy=ty-g.y,dz=tz-g.z,d=Math.hypot(dx,dy,dz);
 if(d<.01||d>SM.MAXD)return false;
 const cp=Math.cos(g.pitch),fx=-Math.sin(g.yaw)*cp,fy=Math.sin(g.pitch),fz=-Math.cos(g.yaw)*cp;   // direção da câmera (mesma ordem YXZ do tick)
 if((fx*dx+fy*dy+fz*dz)/d<Math.cos(SM.LOOK))return false;
 return !smBlocked(g,g.x,g.z,tx,tz);
}
function smShow(g,sm){   // sorteia um lugar e faz ele aparecer; false se não achou lugar (tenta de novo logo depois)
 const near=sm.first||SM_DEV||Math.random()<SM.P_NEAR,fx=-Math.sin(g.yaw),fz=-Math.cos(g.yaw);
 for(let k=0;k<40;k++){
  const d=near?rv(SM.NEAR):rv(SM.FAR),a=near?(sm.first?rr(-.3,.3):rr(-.55,.55)):(Math.random()<.55?rr(-.9,.9):rr(-Math.PI,Math.PI)),ca=Math.cos(a),sa=Math.sin(a);   // perto: sempre à frente (±32°); longe: 55% à frente, 45% em qualquer direção
  const x=g.x+(fx*ca-fz*sa)*d,z=g.z+(fx*sa+fz*ca)*d;
  if(!smFree(g,x,z))continue;
  if(near&&smBlocked(g,g.x,g.z,x,z))continue;   // perto: tem que dar para ver
  sm.x=x;sm.z=z;sm.near=near;sm.g.position.set(x,g.H(x,z),z);smPoseRandom(sm);
  sm.idleYaw=Math.atan2(g.x-x,g.z-z)+(Math.random()<.5?-1:1)*rr(1.7,3.1);sm.yaw=sm.idleYaw;sm.g.rotation.y=sm.yaw;   // parado, de costas/de lado para o jogador
  sm.life=near?rv(SM.LIFE_NEAR):rv(SM.LIFE_FAR);sm.stare=0;sm.stareT=0;sm.seen=false;sm.fo=SM.FADE_OUT;sm.a=0;sm.st='on';sm.g.visible=true;
  sm.first=false;smSfx(near?'near':'far');smSay(g,near?'near':'far');if(SM_DEV)console.log('[OWM] Shadow Man apareceu',near?'PERTO':'LONGE',Math.hypot(x-g.x,z-g.z).toFixed(1)+' m · pose '+sm.lastPose);
  return true;
 }
 return false;
}
function smVanish(sm,fast){if(sm.st!=='on')return;sm.st='out';sm.fo=fast?.07:SM.FADE_OUT}
function smPoseSet(sm,spec){   // aplica uma pose: reescreve a malha, reposiciona os olhos e guarda a altura da cabeça (para o olhar e a câmera)
 const eo=smPoseApply(sm.base,sm.sk,sm.eyePts,spec,sm.pos);sm.geo.attributes.position.needsUpdate=true;
 eo.forEach((e,i)=>sm.glows[i].position.set(e[0],e[1],e[2]));sm.hh=(eo[0][1]+eo[1][1])/2;
}
function smPoseRandom(sm){   // pose diferente a cada aparição (nunca repete a anterior): 55% normais, 45% contorcidas
 const c=Math.random()<.45,tab=c?SMC:SMP,names=Object.keys(tab).filter(n=>n!==sm.lastPose),n=names[(Math.random()*names.length)|0];
 sm.lastPose=n;smPoseSet(sm,smMakePose(tab[n],c?.9+Math.random()*.3:.85+Math.random()*.3,c?7:5));
}
function smHide(sm){if(!sm)return;sm.st='idle';sm.a=0;sm.g.visible=false;sm.halo.visible=false;if(sm.ring)sm.ring.visible=false}
function smTick(g,dt){
 const sm=g.sm;if(!sm)return;
 smSayTick(g,dt);
 if(g.evC>0)g.evC-=dt;
 if(g.ev){smEv(g,dt);return}   // evento de perseguição: ele assume o controle do Shadow Man e da câmera
 if(sm.st==='idle'){g.smT=Math.max(0,(g.smT||0)-dt*.8);g.smK=Math.min(1,(g.smK||1)+dt*3);sm.cd-=dt;if(sm.cd<=0&&!smShow(g,sm))sm.cd=1.5;return}
 const d=Math.hypot(sm.x-g.x,sm.z-g.z);let gz=false;
 if(sm.st==='on'){
  sm.a=Math.min(1,sm.a+dt/SM.FADE_IN);sm.life-=dt;
  gz=sm.a>.6&&smGaze(g,sm);
  if(gz){
   if(!sm.seen){sm.seen=true;sm.stare=0;sm.stareT=Math.random()<SM.P_INSTANT?.06:rv(SM.STARE);smScare(g)}   // primeiro olhar: sorteia se some na hora ou encara um pouco
   sm.stare+=dt;if(sm.stare>=sm.stareT){smVanish(sm,sm.stareT<.1);smSay(g,'gone')}
  }else if(sm.seen){sm.seen=false;sm.stare=0}   // o jogador desviou o olhar: ele volta a ficar parado
  if(d<SM.MIN_D)smVanish(sm,true);else if(sm.life<=0){smVanish(sm,false);smSay(g,'gone')}
 }else{
  sm.a=Math.max(0,sm.a-dt/sm.fo);
  if(sm.a<=0){sm.st='idle';sm.cd=SM_DEV?rr(3,5):rv(SM.CD)*Math.max(.5,1-g.t/360);sm.g.visible=false;sm.halo.visible=false;return}
 }
 const want=gz?Math.atan2(g.x-sm.x,g.z-sm.z):sm.idleYaw;let da=want-sm.yaw;da=Math.atan2(Math.sin(da),Math.cos(da));
 sm.yaw+=da*Math.min(1,dt*(gz?9:2.5));sm.g.rotation.y=sm.yaw;   // só vira para o jogador enquanto é olhado
 const vis=sm.a>=1?1:(Math.random()<.3?0:sm.a);   // pisca ao aparecer/sumir
 sm.mat.opacity=vis;
 const T=performance.now(),gs=Math.max(.45,Math.min(1,d*.03)),blink=(T%4300)<140?0:1,pl=(.9+.1*Math.sin(T*.007))*blink;   // olhos crescem com a distância e piscam de vez em quando
 for(const e of sm.glows){e.material.opacity=vis*pl;e.scale.set(gs,gs,1)}
 /* halo atrás dele (do ponto de vista do jogador) */
 const ux=(sm.x-g.x)/Math.max(d,.01),uz=(sm.z-g.z)/Math.max(d,.01);sm.halo.visible=true;sm.halo.position.set(sm.x+ux*.9,sm.g.position.y+1.15,sm.z+uz*.9);sm.halo.material.opacity=vis*(.16+.05*Math.sin(T*.004));
 /* tensão: sobe quando ele está por perto/à vista (distorce a imagem e acelera o batimento); a lanterna falha quando ele está perto */
 const tk=sm.st==='on'?(gz?1:(d<14?.6:.35)):0;g.smT=(g.smT||0)+(tk-(g.smT||0))*Math.min(1,dt*(tk>(g.smT||0)?4:1.2));
 g.smK=(sm.st==='on'&&d<16)?(Math.random()<.06?.15+.4*Math.random():Math.min(1,(g.smK||1)+dt*6)):Math.min(1,(g.smK||1)+dt*3);
}

/* ---------- Evento: "Fugir não vai te livrar de tudo." ----------
   1) 'talk'  — ele diz a frase; o jogador fica paralisado e a câmera trava nele até a fala terminar.
   2) 'warn'  — SÓ DEPOIS da fala: contagem de SM.CH_WIN (3) s. Um marcador verde aponta o arbusto mais próximo e ele CORRE até o jogador (chega junto com o fim do tempo).
   3) 'hide'  — se o jogador ENTRAR no arbusto (encostar nele) antes do tempo acabar, começa a cutscene sozinha: a câmera trava no Shadow Man,
                que passa por perto, para, olha para o arbusto e vai embora. O jogador volta para onde estava.
   4) 'catch' — se o tempo acabar sem ele estar escondido, o Shadow Man MATA o jogador (susto) e a partida termina: "O Shadow Man te matou". Os tokens já coletados continuam. */
function smBushNear(g,x,z){let best=null,bd=1e9;for(const b of g.bushes||[]){const d=Math.hypot(b[0]-x,b[1]-z)-b[2];if(d<bd){bd=d;best=b}}return best?{b:best,d:bd}:null}
function smChaseOK(g,sm){
 if(g.ev||g.q||g.glT>=0||g.state!=='play'||!g.bushes||!g.bushes.length)return false;
 if(!SM_CH&&(g.t<SM.CH_MIN_T||(g.evC||0)>0))return false;
 const d=Math.hypot(sm.x-g.x,sm.z-g.z);if(d>14||d<4)return false;
 return true;   // sem checar se há arbusto por perto: o evento pode rolar em qualquer lugar
}
function smChase(g,sm){
 const txt='Fugir não vai te livrar de tudo.',sp=32;
 g.ev={st:'talk',t:0,T0:txt.length/sp+SM.CH_TALK,sx:sm.x,sz:sm.z,ox:g.x,oz:g.z};sm.st='ev';sm.seen=false;smPoseSet(sm,smMakePose(SMP.espreita,1,3));
 g.lock=true;g.shMsg={txt,t:0,shown:'',sp};g.shC=99;smSfx('near');   // paralisa o jogador enquanto ele fala; a contagem ainda NÃO começou
}
function smWarnStart(g,sm){   // a fala terminou: começa a contagem de 3 s
 const ev=g.ev;
 ev.st='warn';ev.t=0;ev.sx=sm.x;ev.sz=sm.z;g.lock=false;smPoseSet(sm,smMakePose(SMX.corrida,1,3));
 smSfx('chase');   // sem marcador e sem contagem na tela: o jogador tem que achar o arbusto sozinho
}
function smLookAt(g,sm,dt,k0){   // a câmera foca nele
 const tx=sm.x-g.x,tz=sm.z-g.z,dd=Math.hypot(tx,tz);let dy=Math.atan2(-tx,-tz)-g.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));const kk=Math.min(1,dt*k0);
 g.yaw+=dy*kk;g.pitch+=(Math.atan2(sm.g.position.y+(sm.hh||1.5)-g.y,Math.max(dd,.5))-g.pitch)*kk;return dd;
}
function smHideTry(g,b){
 const ev=g.ev,sm=g.sm,dx=b[0]-ev.sx,dz=b[1]-ev.sz,L=Math.hypot(dx,dz)||1,ux=dx/L,uz=dz/L,side=Math.random()<.5?-1:1,px=-uz*side,pz=ux*side;
 const w1=[b[0]+px*4.2-ux*1.5,b[1]+pz*4.2-uz*1.5],w2=[b[0]+px*4.2+ux*15,b[1]+pz*4.2+uz*15];
 g.ev={st:'hide',t:0,b,ox:g.x,oz:g.z,yaw0:g.yaw,ph:0,pt:0,w:[[sm.x,sm.z],w1,w2],T1:Math.max(1.6,Math.min(4,Math.hypot(sm.x-w1[0],sm.z-w1[1])/3.2))};
 g.lock=true;g.hid=true;g.x=b[0];g.z=b[1];sm.a=1;smPoseSet(sm,smMakePose(SMP.espreita,1,3));sm.ring.visible=false;g.shMsg=null;hSh.classList.remove('on');hMsg.classList.remove('on');g.msgT=0;
 smSfx('hide');say('Você se escondeu…',2.4);
}
function smCatch(g){
 const sm=g.sm;smPoseSet(sm,smMakePose(SMX.garra,1,3));let dx=sm.x-g.x,dz=sm.z-g.z,d=Math.hypot(dx,dz);if(d<.05){dx=-Math.sin(g.yaw);dz=-Math.cos(g.yaw);d=1}
 sm.x=g.x+dx/d*1.05;sm.z=g.z+dz/d*1.05;sm.yaw=Math.atan2(g.x-sm.x,g.z-sm.z);sm.a=1;sm.ring.visible=false;
 g.ev={st:'catch',t:0};g.lock=true;g.hid=false;g.shMsg=null;hSh.classList.remove('on');hMsg.classList.remove('on');
 g.glT=1.1;g.flash=.7;hFlash.style.background='radial-gradient(circle,#ffffffaa,#ffffff00 70%)';smSfx('catch');
}
function caught(){
 G.state='done';G.ev=null;G.lock=false;G.hid=false;smHide(G.sm);hSh.classList.remove('on');G.shMsg=null;try{document.exitPointerLock&&document.exitPointerLock()}catch(e){}
 ovBox.textContent='';ov.classList.add('on');
 E('h2','','O Shadow Man te matou.',ovBox);E('p','','Fugir não livrou você de tudo.',ovBox);
 E('p','','Os tokens que você já pegou continuam com você ('+tokens.get()+').',ovBox);
 B('Tentar de novo',()=>startFind(),ovBox);B('Voltar ao menu',()=>stopFind(),ovBox);
}
function smEvEnd(g){
 const ev=g.ev,sm=g.sm;g.x=ev.ox;g.z=ev.oz;g.yaw=ev.yaw0;g.pitch=0;g.hid=false;g.lock=false;g.ev=null;g.evC=SM.CH_CD;g.shC=SAY.CD;
 smHide(sm);sm.cd=rv(SM.CD)+8;g.smK=1;g.flash=.3;hFlash.style.background='radial-gradient(circle,#ffffff44,#ffffff00 70%)';say('Ele se foi… por enquanto.',2.4);
}
function smDraw(g,sm,d){   // opacidade, olhos e halo (igual ao final do smTick)
 const vis=sm.a>=1?1:(Math.random()<.3?0:sm.a);sm.mat.opacity=vis;
 const T=performance.now(),gs=Math.max(.45,Math.min(1,d*.03)),pl=(.9+.1*Math.sin(T*.007))*((T%4300)<140?0:1);
 for(const e of sm.glows){e.material.opacity=vis*pl;e.scale.set(gs,gs,1)}
 const ux=(sm.x-g.x)/Math.max(d,.01),uz=(sm.z-g.z)/Math.max(d,.01);sm.halo.visible=true;sm.halo.position.set(sm.x+ux*.9,sm.g.position.y+1.15,sm.z+uz*.9);sm.halo.material.opacity=vis*(.16+.05*Math.sin(T*.004));
}
function smEv(g,dt){
 const ev=g.ev,sm=g.sm;ev.t+=dt;g.smT=1;
 if(ev.st==='talk'){   // ele parado, de frente, falando; câmera presa nele
  sm.a=Math.min(1,sm.a+dt/.15);sm.yaw=Math.atan2(g.x-sm.x,g.z-sm.z);sm.g.position.set(sm.x,g.H(sm.x,sm.z),sm.z);sm.g.rotation.y=sm.yaw;
  const d=smLookAt(g,sm,dt,ev.t<.5?10:4);g.smK=Math.random()<.15?.2:1;smDraw(g,sm,d);
  if(ev.t>=ev.T0)smWarnStart(g,sm);
 }else if(ev.st==='warn'){
  const left=Math.max(.05,SM.CH_WIN-ev.t),k=Math.min(1,dt/left);
  for(const k2 of g.bushes){if(Math.hypot(k2[0]-g.x,k2[1]-g.z)<k2[2]+SM.BUSH_IN){smHideTry(g,k2);return}}   // entrou no arbusto: começa a cutscene

  sm.x+=(g.x-sm.x)*k;sm.z+=(g.z-sm.z)*k;sm.a=Math.min(1,sm.a+dt/.15);sm.yaw=Math.atan2(g.x-sm.x,g.z-sm.z);   // corre: chega junto com o fim do tempo
  sm.g.position.set(sm.x,g.H(sm.x,sm.z)+Math.abs(Math.sin(ev.t*12))*.06,sm.z);sm.g.rotation.y=sm.yaw;
  g.smK=Math.random()<.15?.2:1;const pu=.45+.4*Math.sin(performance.now()*.012);sm.ringMat.opacity=pu;sm.beamMat.opacity=pu*.3;
  const d=Math.hypot(sm.x-g.x,sm.z-g.z);smDraw(g,sm,d);
  if(ev.t>=SM.CH_WIN)smCatch(g);   // só pega quando o tempo acaba (ele chega junto): o jogador sempre tem os 3 s inteiros
 }else if(ev.st==='hide'){
  const w=ev.w;let walk=true;ev.pt+=dt;
  if(ev.ph===0){const k=Math.min(1,ev.pt/ev.T1);sm.x=w[0][0]+(w[1][0]-w[0][0])*k;sm.z=w[0][1]+(w[1][1]-w[0][1])*k;sm.yaw=Math.atan2(w[1][0]-w[0][0],w[1][1]-w[0][1]);if(k>=1){ev.ph=1;ev.pt=0;smPoseSet(sm,smMakePose(SMP.cabecatorta,1.1,3))}}   // chega ao ponto mais próximo do arbusto
  else if(ev.ph===1){sm.x=w[1][0];sm.z=w[1][1];walk=false;if(ev.pt>.6){let da=Math.atan2(g.x-sm.x,g.z-sm.z)-sm.yaw;da=Math.atan2(Math.sin(da),Math.cos(da));sm.yaw+=da*Math.min(1,dt*5)}if(ev.pt>=2){ev.ph=2;ev.pt=0;smPoseSet(sm,smMakePose(SMP.espreita,1,3))}}   // para e olha para o arbusto
  else{const k=Math.min(1,ev.pt/3.6);sm.x=w[1][0]+(w[2][0]-w[1][0])*k;sm.z=w[1][1]+(w[2][1]-w[1][1])*k;
   let da=Math.atan2(w[2][0]-w[1][0],w[2][1]-w[1][1])-sm.yaw;da=Math.atan2(Math.sin(da),Math.cos(da));sm.yaw+=da*Math.min(1,dt*4);
   sm.a=k>.65?Math.max(0,1-(k-.65)/.35):1;if(k>=1){smEvEnd(g);return}}   // vai embora e some
  sm.g.position.set(sm.x,g.H(sm.x,sm.z)+(walk?Math.abs(Math.sin(ev.t*5))*.05:0),sm.z);sm.g.rotation.y=sm.yaw;
  const tx=sm.x-g.x,tz=sm.z-g.z,dd=Math.hypot(tx,tz);let dy=Math.atan2(-tx,-tz)-g.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));const kk=Math.min(1,dt*(ev.t<.5?10:3.5));
  g.yaw+=dy*kk;g.pitch+=(Math.atan2(sm.g.position.y+(sm.hh||1.5)-g.y,Math.max(dd,.5))-g.pitch)*kk;   // a câmera foca nele
  g.smK=.3;smDraw(g,sm,dd);
 }else{   // catch
  const dx=sm.x-g.x,dz=sm.z-g.z;let dy=Math.atan2(-dx,-dz)-g.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));const k=Math.min(1,dt*14);g.yaw+=dy*k;g.pitch+=(.1-g.pitch)*k;
  sm.g.position.set(sm.x+(Math.random()-.5)*.04,g.H(sm.x,sm.z)+(Math.random()-.5)*.03,sm.z);sm.g.rotation.y=sm.yaw;sm.a=1;g.smK=Math.random()<.3?.1:1;smDraw(g,sm,1.05);
  if(ev.t>=1.7)caught();
 }
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
  ax+=mx;az+=mz;if(g.q||g.lock){ax=az=0}   // encaixando a roda: o jogador fica parado
  const l=Math.hypot(ax,az);if(l>1){ax/=l;az/=l}
  const sp=(keys.ShiftLeft||keys.ShiftRight?7:4.4)*(touch?Math.min(1,l):1),c=Math.cos(g.yaw),s=Math.sin(g.yaw);
  let vx=(c*ax+s*az)*sp,vz=(-s*ax+c*az)*sp,nx=g.x+vx*dt,nz=g.z+vz*dt;
  const d=Math.hypot(nx,nz);if(d>g.R&&!g.hid){nx*=g.R/d;nz*=g.R/d}
  if(!g.hid)for(const o of g.obst){const dx=nx-o[0],dz=nz-o[1],dd=Math.hypot(dx,dz),m=o[2]+.35;if(dd<m&&dd>1e-4){nx=o[0]+dx/dd*m;nz=o[1]+dz/dd*m}}
  const moved=Math.hypot(nx-g.x,nz-g.z);g.x=nx;g.z=nz;g.bob+=moved*2.1;
  const gy=g.H(g.x,g.z)+(g.hid?1:1.65)+Math.sin(g.bob)*.035*Math.min(1,moved/dt/4);g.y+=(gy-g.y)*Math.min(1,dt*14);
  /* moedas */
  let near=1e9;
  for(const k of g.coins){if(k.got||k.fx>=0)continue;const dd=Math.hypot(k.x-g.x,k.z-g.z);near=Math.min(near,dd);
   if(dd<1.6&&Math.abs(k.y-g.y)<2.4){if(!k.safe&&Math.random()<.5){curse(g,k);continue}   // 50%: token falso (o que reaparece depois é sempre de verdade)
    hFlash.style.background='';k.got=true;k.g.visible=false;g.found++;tokens.add(1);g.flash=.5;say(g.found<2?'Token encontrado! Falta 1.':(g.wcount<g.wneed?'Tokens completos! Faltam '+(g.wneed-g.wcount)+' rodas para encaixar.':'Último token!'),2.6);
    beep(880,.14,.12,'triangle');setTimeout(()=>beep(1320,.22,.1,'triangle'),110);updHud();chk(g)}}
  /* ping de proximidade */
  let nearW=1e9;
  for(const w of g.wheels){if(w.got)continue;const dd=Math.hypot(w.x-g.x,w.z-g.z);nearW=Math.min(nearW,dd);if(dd<1.7&&Math.abs(w.y-g.y)<2.6)takeWheel(g,w)}
  const nd=Math.min(near,nearW),wh=nearW<near;   // o ping/tensão seguem o item mais próximo; roda = tom mais grave (triângulo)
  g.tkT=nd<42?Math.pow(1-nd/42,1.5):0;g.pingT-=dt;if(nd<42&&g.pingT<=0){const q=Math.max(0,Math.min(1,nd/42));if(wh)beep(210+(1-q)*380,.1,.06+.05*(1-q),'triangle');else beep(380+(1-q)*620,.09,.045+.05*(1-q));g.pingT=.25+q*1.9}
  if(Math.floor(g.t*4)!==Math.floor((g.t-dt)*4))updHud();
 }
if(g.q&&g.state==='play'){const sg=g.staged[g.q.i],ty=Math.atan2(-(sg.x-g.x),-(sg.z-g.z));let dy=ty-g.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));const k=Math.min(1,dt*5);g.yaw+=dy*k;g.pitch+=(-.45-g.pitch)*k}   // câmera se vira para a roda
 qUpdate(g,dt);
 hPr.classList.toggle('on',g.state==='play'&&!g.q&&!g.ev&&!!nearStaged(g));
 g.tension+=((g.state==='play'?Math.max(g.tkT,g.smT||0):0)-g.tension)*Math.min(1,dt*2);musicTick(g,dt);
 /* câmera, lanterna e animações (continuam em pausa/fim para a cena não congelar feia) */
 let gx=0;if(g.glT>=0){g.glT+=dt;if(g.glT>=2)g.glT=-1;else gx=Math.min(1,g.glT/.05)*Math.min(1,(2-g.glT)/.3)}   // glitch de 2 s: sobe rápido, segura, some no final
 if(gx>0){const jn=Math.floor(performance.now()/45);if(jn!==g.jn){g.jn=jn;g.jx=Math.random()-.5;g.jy=Math.random()-.5;g.jz=Math.random()-.5}}
 g.cam.position.set(g.x,g.y,g.z);g.cam.rotation.set(g.pitch+(gx>0?g.jx*.09*gx:0),g.yaw+(gx>0?g.jy*.12*gx:0),gx>0?g.jz*.2*gx:0,'YXZ');
 g.fz=(g.fz||72)+((g.ev&&g.ev.st==='hide'?50:72)-(g.fz||72))*Math.min(1,dt*5);const fv=g.fz+(gx>0?g.jx*18*gx:0);if(fv!==g.cam.fov){g.cam.fov=fv;g.cam.updateProjectionMatrix()}
 if(g.sm&&g.state==='play')smTick(g,dt);   // Shadow Man (só enquanto a partida está rolando)
 const fl=1+Math.sin(performance.now()*.017)*.03+Math.sin(performance.now()*.041)*.02;
 g.lamp.position.set(g.x,g.y-.15,g.z);g.lamp.intensity=1.5*fl*(g.smK||1);
 const T=performance.now()*.001;
 for(const k of g.coins){if(k.got)continue;if(k.fx>=0){coinFx(g,k,dt);continue}if(k.pop>0){k.pop-=dt;k.g.scale.setScalar(k.pop>0?Math.max(.01,1-k.pop/.45):1)}k.g.rotation.y+=dt*2.2;k.g.position.y=k.y+Math.sin(T*2+k.ph)*.12;k.gl.material.opacity=.34+.12*Math.sin(T*3+k.ph);k.pl.intensity=.7+.25*Math.sin(T*3+k.ph)}
 for(const w of g.wheels){if(w.got)continue;w.g.rotation.y+=dt*1.6;w.g.position.y=w.y+Math.sin(T*2+w.ph)*.12;w.gl.material.opacity=.34+.12*Math.sin(T*3+w.ph);w.pl.intensity=.7+.25*Math.sin(T*3+w.ph)}
 for(const s of g.staged){if(s.st!==1)continue;if(s.pop>0){s.pop-=dt;s.g.scale.setScalar(s.pop>0?Math.max(.01,1-s.pop/.45):1)}s.gl.material.opacity=.4+.2*Math.sin(T*3+s.ph);s.gl.scale.setScalar(1.4+.2*Math.sin(T*3+s.ph))}
 if(g.q)qDraw(g.q);
 if(g.car){const c=g.car;c.k+=((1-g.wcount/g.wneed)-c.k)*Math.min(1,dt*3);c.g.position.y=c.base-c.sink*c.k;   // carro sobe a cada roda
  for(const o of c.mounted){if(!o.on)continue;if(o.t<1)o.t=Math.min(1,o.t+dt/.45);const u=o.t-1;o.m.scale.setScalar(Math.max(.001,1+2.7*u*u*u+1.7*u*u))}}   // pop com leve overshoot
 const fp=g.ff.geometry.attributes.position;for(let i=0;i<g.fl.length;i++){const f=g.fl[i];fp.setY(i,g.H(f[0],f[1])+1.4+Math.sin(T*.8+f[2])*.6);fp.setX(i,f[0]+Math.sin(T*.5+f[2])*.8)}fp.needsUpdate=true;
 if(g.msgT>0){g.msgT-=dt;if(g.msgT<=0)hMsg.classList.remove('on')}
 if(g.flash>0){g.flash-=dt;hFlash.style.opacity=Math.max(0,g.flash*1.2)}else hFlash.style.opacity=0;
 g.vhs.uniforms.t.value=T%1000;g.vhs.uniforms.k.value=g.tension;g.vhs.uniforms.gx.value=gx;
 g.renderer.setRenderTarget(g.rt);g.renderer.render(g.scene,g.cam);g.renderer.setRenderTarget(null);g.renderer.render(g.ps,g.pc);
 const nowMs=performance.now();if(nowMs-g.tcT>250){g.tcT=nowMs;const s=Math.floor(g.t);hVt.textContent='00:'+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0');hRec.style.opacity=Math.floor(nowMs/700)%2?'.15':'1'}
}

/* ---------- entrada ---------- */
addEventListener('keydown',e=>{if(!G)return;keys[e.code]=true;if(G.state==='play'&&!e.repeat){if(G.q){if(e.code==='Space'||e.code==='KeyE'||e.code==='Enter')qHit();else if(e.code==='KeyQ'||e.code==='KeyX')qCancel()}else if((e.code==='KeyE'||e.code==='KeyF')&&!G.ev)interact()}
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault()});
addEventListener('keyup',e=>{keys[e.code]=false});
addEventListener('keydown',e=>{if(SM_DEV&&e.code==='KeyV'&&G&&G.sm&&G.state==='play'&&G.sm.st==='idle')G.sm.cd=0});   // modo teste (?shadow=1)
addEventListener('blur',()=>{keys={}});
document.addEventListener('mousedown',e=>{if(G&&G.q&&e.button===0&&document.pointerLockElement===cv){e.preventDefault();qHit()}});
document.addEventListener('mousemove',e=>{if(!G||G.state!=='play'||G.q||G.lock||document.pointerLockElement!==cv)return;const k=.0022*((OWM.S&&OWM.S.sens)||100)/100;G.yaw-=e.movementX*k;G.pitch=Math.max(-1.45,Math.min(1.45,G.pitch-e.movementY*k))});
document.addEventListener('pointerlockchange',()=>{if(G&&G.state==='play'&&document.pointerLockElement!==cv&&!touch)pause(true)});
cv.addEventListener('click',()=>{if(G&&G.state==='play'&&!touch&&document.pointerLockElement!==cv){try{cv.requestPointerLock()}catch(e){}}});
/* toque: metade esquerda = andar (joystick flutuante), direita = olhar */
function tpos(t){return[t.clientX,t.clientY]}
cv.addEventListener('touchstart',e=>{if(!G||G.state!=='play')return;e.preventDefault();if(G.q){qHit();return}for(const t of e.changedTouches){const[x,y]=tpos(t);G.touches.set(t.identifier,{x,y,sx:x,sy:y,left:x<innerWidth/2})}},{passive:false});
cv.addEventListener('touchmove',e=>{if(!G||G.state!=='play')return;e.preventDefault();for(const t of e.changedTouches){const o=G.touches.get(t.identifier);if(!o)continue;const[x,y]=tpos(t);
 if(o.left){mx=Math.max(-1,Math.min(1,(x-o.sx)/55));mz=Math.max(-1,Math.min(1,(y-o.sy)/55))}
 else if(!G.q&&!G.lock){const k=.005*((OWM.S&&OWM.S.sens)||100)/100;G.yaw-=(x-o.x)*k;G.pitch=Math.max(-1.45,Math.min(1.45,G.pitch-(y-o.y)*k));o.x=x;o.y=y}}},{passive:false});
const tend=e=>{if(!G)return;for(const t of e.changedTouches){const o=G.touches.get(t.identifier);if(o&&o.left){mx=mz=0}G.touches.delete(t.identifier)}};
cv.addEventListener('touchend',tend);cv.addEventListener('touchcancel',tend);

OWM.mini={tick,start:startFind,stop:stopFind,tokens};
})();
