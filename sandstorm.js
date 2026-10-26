/* Open World Mayhem — tempestade de areia do deserto.
   Receita (várias camadas baratas em vez de partículas grandes, que matam a taxa de preenchimento principalmente no celular):
   1) NÉVOA: o raymarch volumétrico (postprocess.js) ganha densidade extra com massas de poeira carregadas pelo vento → visibilidade cai pra ~15–25 m,
      com bolsões mais claros e rajadas mais densas; cor ocre, sol quase apagado, céu e horizonte da mesma cor (sem "borda" da névoa).
   2) TELA: passe final com tom ocre dessaturado, véus de poeira correndo na direção do vento, rastros (3 camadas em paralaxe), distorção leve e vinheta.
   3) GRÃOS: 1 THREE.Points com milhares de grãos animados 100% na GPU (zero trabalho de CPU por quadro): a posição vem do tempo + semente por vértice,
      a caixa em volta da câmera "dá a volta" (mod), e cada grão vira um rastro esticado na direção do vento na tela (efeito de motion blur).
      Desenhado DEPOIS da névoa (post.overlay), senão a própria névoa apagaria os grãos.
   4) SOM: vento filtrado (WebAudio), acompanha a intensidade e as rajadas; volume = volume da música.
   Agenda: dentro do deserto, depois de uma calmaria sorteada (CFG.CALM = o cooldown), vem a tempestade (rampa de entrada → pico → rampa de saída). Só existe no deserto. */
(()=>{
const {S,toast,scene,cam,R,post,touch}=OWM;
const rnd=(a,b)=>a+Math.random()*(b-a);
const CFG={FIRST:[30,55],CALM:[40,84],DUR:[60,105],RIN:11,ROUT:14,SPEED:16};   // CALM = cooldown entre tempestades: era [100,210] s, agora −60% (×0,4)
const SD={on:false,t:0,dur:0,wait:null,env:0,k:0,wx:1,wz:0,ph:0,gust:.7,time:0};

/* ---------- Grãos (GPU) ---------- */
const VERT=`
attribute vec4 aS;attribute float aT;
uniform vec3 uCam;uniform vec3 uWind;uniform float uPh;uniform float uK;uniform vec2 uRes;uniform float uScale;
varying float vA;varying float vR;varying vec2 vDir;varying float vTh;
const vec3 BOX=vec3(34.,11.,34.);
void main(){
 float sp=.65+.7*aT;
 vec3 p0=vec3(aS.x*BOX.x,pow(aS.y,1.5)*BOX.y,aS.z*BOX.z)+uWind*uPh*sp;
 p0.y+=sin(uPh*1.7+aS.x*50.)*.5;p0.x+=sin(uPh*1.1+aS.z*40.)*.4;
 vec3 rel;
 rel.x=mod(p0.x-uCam.x+BOX.x*.5,BOX.x)-BOX.x*.5;
 rel.z=mod(p0.z-uCam.z+BOX.z*.5,BOX.z)-BOX.z*.5;
 rel.y=mod(p0.y-uCam.y+1.6,BOX.y)-1.6;
 vec3 wp=uCam+rel;
 float dist=length(rel);
 vec4 c0=projectionMatrix*(viewMatrix*vec4(wp,1.));
 vec4 c1=projectionMatrix*(viewMatrix*vec4(wp+uWind*.05,1.));
 float show=step(aS.w,uK);
 if(show<.5||c0.w<.5||c1.w<.5){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;vA=0.;vR=0.;vDir=vec2(1.,0.);vTh=1.;return;}
 gl_Position=c0;
 vec2 dpx=(c1.xy/c1.w-c0.xy/c0.w)*uRes*.5;            // deslocamento em pixels em 0.05 s
 float len=length(dpx);
 vDir=len>1e-3?dpx/len:vec2(1.,0.);
 float lenPx=clamp(len*1.7+2.,3.,40.);                 // comprimento do rastro
 gl_PointSize=lenPx;
 vTh=clamp(.017*uScale/c0.w,.9,2.6)/lenPx;             // meia espessura (unidades do ponto)
 vR=fract(aT*13.7);
 vA=(1.-smoothstep(13.,17.,dist))*smoothstep(.5,2.4,c0.w)*(.35+.65*vR);
}`;
const FRAG=`
uniform vec3 uCol;uniform float uLight;
varying float vA;varying float vR;varying vec2 vDir;varying float vTh;
void main(){
 vec2 q=gl_PointCoord*2.-1.;q.y=-q.y;
 vec2 d=normalize(vDir);
 float u=dot(q,d),w=dot(q,vec2(-d.y,d.x));
 float a=(1.-smoothstep(.35,1.,abs(u)))*mix(.45,1.,smoothstep(-1.,.8,u))*exp(-w*w/(vTh*vTh))*vA*.62;
 if(a<.02)discard;
 vec3 c=mix(uCol*.65,uCol*1.6+vec3(.03),vR)*uLight;
 gl_FragColor=linearToOutputTexel(vec4(c,a));
}`;
let grains=null,gmat=null;
const _v2=new THREE.Vector2();
function buildGrains(){
 const tier=Math.max(0,Math.min(3,OWM.tier==null?1:OWM.tier));
 const N=(touch?[600,900,1300,1300]:[1200,2000,3000,4200])[tier];
 const s=new Float32Array(N*4),t=new Float32Array(N);
 for(let i=0;i<N;i++){s[i*4]=Math.random();s[i*4+1]=Math.random();s[i*4+2]=Math.random();s[i*4+3]=(i+.5)/N;t[i]=Math.random()}   // aS.w = limiar de visibilidade (cresce com a intensidade)
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(N*3),3));
 g.setAttribute('aS',new THREE.BufferAttribute(s,4));g.setAttribute('aT',new THREE.BufferAttribute(t,1));
 gmat=new THREE.ShaderMaterial({uniforms:{uCam:{value:new THREE.Vector3()},uWind:{value:new THREE.Vector3(1,0,0)},uPh:{value:0},uK:{value:0},uRes:{value:new THREE.Vector2(800,450)},
  uScale:{value:500},uCol:{value:new THREE.Color(.5,.25,.09)},uLight:{value:1}},vertexShader:VERT,fragmentShader:FRAG,transparent:true,depthWrite:false,depthTest:false});
 grains=new THREE.Points(g,gmat);grains.frustumCulled=false;grains.visible=false;
 if(post.overlay)post.overlay.add(grains);
}

/* ---------- Som do vento (WebAudio, sem arquivos) ---------- */
let ac=null,ag=null,abp=null,silentT=0;
function audioInit(){
 const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
 ac=new AC();
 const n=ac.sampleRate*2,buf=ac.createBuffer(1,n,ac.sampleRate),d=buf.getChannelData(0);
 let b0=0,b1=0,b2=0;                                    // ruído "rosa" barato
 for(let i=0;i<n;i++){const w=Math.random()*2-1;b0=.99765*b0+w*.099;b1=.963*b1+w*.2965;b2=.57*b2+w*1.05;d[i]=(b0+b1+b2+w*.18)*.22}
 const src=ac.createBufferSource();src.buffer=buf;src.loop=true;
 abp=ac.createBiquadFilter();abp.type='bandpass';abp.Q.value=.6;abp.frequency.value=500;
 const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2200;
 ag=ac.createGain();ag.gain.value=0;
 src.connect(abp);abp.connect(lp);lp.connect(ag);ag.connect(ac.destination);src.start();
 return true;
}
function audio(k,gust){
 try{
  if(!ac){if(k<.01||!audioInit())return}
  if(k<.004){if((silentT+=.016)>6&&ac.state==='running')ac.suspend().catch(()=>{})}
  else{silentT=0;if(ac.state==='suspended'&&!document.hidden)ac.resume().catch(()=>{})}
  const vol=Math.pow(Math.max(0,Math.min(100,S.mvol))/100,2)*.9,t=ac.currentTime;
  ag.gain.setTargetAtTime(k*vol*(.7+.3*gust),t,.25);
  abp.frequency.setTargetAtTime(330+520*gust+160*k,t,.3);
 }catch(e){}
}
document.addEventListener('visibilitychange',()=>{try{if(ac&&document.hidden)ac.suspend().catch(()=>{})}catch(e){}});

/* ---------- Agenda e atualização ---------- */
function start(){
 SD.on=true;SD.t=0;SD.dur=rnd(CFG.DUR[0],CFG.DUR[1]);
 const a=rnd(0,6.2832);SD.wx=Math.cos(a);SD.wz=Math.sin(a);
 toast('Tempestade de areia se aproximando!');
}
const sst=(a,b,v)=>{v=Math.max(0,Math.min(1,(v-a)/(b-a)));return v*v*(3-2*v)};
/* zone: 0..1 = quanto o jogador está dentro do deserto (suave nas bordas) */
function update(dt,zone){
 if(SD.wait===null)SD.wait=rnd(CFG.FIRST[0],CFG.FIRST[1]);
 if(!S.sand){if(SD.on){SD.on=false;SD.wait=rnd(CFG.CALM[0],CFG.CALM[1])}}
 else if(!SD.on){if(zone>.6){SD.wait-=dt;if(SD.wait<=0)start()}}
 else{
  SD.t+=dt*(zone<.25?3:1);                              // saiu do deserto: a tempestade encerra mais rápido
  if(SD.t>=SD.dur){SD.on=false;SD.wait=rnd(CFG.CALM[0],CFG.CALM[1]);toast('A tempestade de areia passou')}
 }
 const tgt=SD.on?Math.min(1,SD.t/CFG.RIN,(SD.dur-SD.t)/CFG.ROUT):0;
 SD.env+=(tgt-SD.env)*(1-Math.exp(-dt*2.2));
 SD.k=sst(0,1,SD.env)*zone;
 SD.time+=dt;
 SD.gust=.7+.3*Math.sin(SD.time*.8)*Math.sin(SD.time*.31+1);
 post.setSand(SD.k,SD.wx,SD.wz);
 OWM.sand.k=SD.k;
 if(SD.k>.004){
  if(!grains)buildGrains();
  if(grains){
   const u=gmat.uniforms,sp=CFG.SPEED+6*SD.gust*SD.k;
   SD.ph+=dt*sp/CFG.SPEED;                              // fase só avança durante a tempestade (evita números grandes)
   u.uCam.value.copy(cam.position);u.uWind.value.set(SD.wx*CFG.SPEED,.05*CFG.SPEED,SD.wz*CFG.SPEED);
   u.uPh.value=SD.ph;u.uK.value=Math.min(1,SD.k*1.05);
   R.getDrawingBufferSize(_v2);u.uRes.value.copy(_v2);u.uScale.value=_v2.y/(2*Math.tan(cam.fov*Math.PI/360));
   const L=post.hemi?post.hemi.intensity:.8;u.uLight.value=Math.max(.12,Math.min(1.1,.14+L*.9));
   grains.visible=true;
  }
 }else if(grains&&grains.visible)grains.visible=false;
 audio(SD.k,SD.gust);
}
function reset(){SD.on=false;SD.t=0;SD.env=0;SD.k=0;SD.wait=null;post.setSand(0,1,0);OWM.sand.k=0;if(grains)grains.visible=false;audio(0,0)}

OWM.sand={k:0,update,reset,start:()=>{SD.wait=0;if(!SD.on)start()},state:SD};
})();
