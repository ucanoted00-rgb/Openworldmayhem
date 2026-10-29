/* Open World Mayhem — brisa do deserto (vento constante com poeira sutil).
   É o "dia a dia" do deserto: sempre que o jogador está no bioma existe um vento fraco, de direção que muda devagar e com rajadas suaves
   que fazem a poeira aparecer e sumir. Quando a tempestade de areia (sandstorm.js) entra, a brisa some aos poucos para ela assumir.
   Receita (tudo na GPU, zero trabalho de CPU por partícula, e bem mais leve que a tempestade):
   1) FIOS DE POEIRA: THREE.Points com algumas centenas de grãos finos e translúcidos; cada grão vira um rastrinho esticado na direção do vento
      (mesma técnica da tempestade). A posição = semente + deslocamento acumulado do vento (uDisp), então quando o vento muda de direção
      os grãos só mudam de rumo, sem "pulos".
   2) NUVENS DE POEIRA: poucas manchas grandes e macias (bem transparentes) que derivam rente ao chão, dando sensação de ar quente soprando.
   Desenhado em post.overlay (depois da névoa). Respeita a opção "Tempestade de areia" (Desligada = sem brisa também) e some debaixo d'água. */
(()=>{
const {S,cam,R,post,touch}=OWM;
const CFG={SPEED_MIN:2.2,SPEED_MAX:5.4,FADE:1.6};
const W={k:0,time:0,gust:.6,wx:1,wz:0,speed:3,disp:null,ready:false};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let grains=null,gmat=null,puffs=null,pmat=null;
const _v2=new THREE.Vector2();

/* ---------- Fios de poeira (rastros finos) ---------- */
const GVERT=`
attribute vec4 aS;attribute float aT;
uniform vec3 uCam;uniform vec3 uWind;uniform vec3 uDisp;uniform float uPh;uniform float uK;uniform vec2 uRes;uniform float uScale;
varying float vA;varying float vR;varying vec2 vDir;varying float vTh;
const vec3 BOX=vec3(30.,8.,30.);
void main(){
 float sp=.65+.7*aT;
 vec3 p0=vec3(aS.x*BOX.x,pow(aS.y,1.6)*BOX.y,aS.z*BOX.z)+uDisp*sp;
 p0.y+=sin(uPh*1.3+aS.x*50.)*.35;p0.x+=sin(uPh*.9+aS.z*40.)*.3;
 vec3 rel;
 rel.x=mod(p0.x-uCam.x+BOX.x*.5,BOX.x)-BOX.x*.5;
 rel.z=mod(p0.z-uCam.z+BOX.z*.5,BOX.z)-BOX.z*.5;
 rel.y=mod(p0.y-uCam.y+1.7,BOX.y)-1.7;
 vec3 wp=uCam+rel;
 float dist=length(rel);
 vec4 c0=projectionMatrix*(viewMatrix*vec4(wp,1.));
 vec4 c1=projectionMatrix*(viewMatrix*vec4(wp+uWind*.05,1.));
 float show=smoothstep(aS.w,aS.w+.1,uK);
 if(show<.01||c0.w<.5||c1.w<.5){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;vA=0.;vR=0.;vDir=vec2(1.,0.);vTh=1.;return;}
 gl_Position=c0;
 vec2 dpx=(c1.xy/c1.w-c0.xy/c0.w)*uRes*.5;
 float len=length(dpx);
 vDir=len>1e-3?dpx/len:vec2(1.,0.);
 float lenPx=clamp(len*.9+2.5,2.5,22.);
 gl_PointSize=lenPx;
 vTh=clamp(.010*uScale/c0.w,.8,1.6)/lenPx;
 vR=fract(aT*13.7);
 vA=(1.-smoothstep(11.,15.,dist))*smoothstep(.5,2.4,c0.w)*(.35+.65*vR)*show;
}`;
const GFRAG=`
uniform vec3 uCol;uniform float uLight;uniform float uAlpha;
varying float vA;varying float vR;varying vec2 vDir;varying float vTh;
void main(){
 vec2 q=gl_PointCoord*2.-1.;q.y=-q.y;
 vec2 d=normalize(vDir);
 float u=dot(q,d),w=dot(q,vec2(-d.y,d.x));
 float a=(1.-smoothstep(.35,1.,abs(u)))*mix(.45,1.,smoothstep(-1.,.8,u))*exp(-w*w/(vTh*vTh))*vA*uAlpha;
 if(a<.01)discard;
 vec3 c=mix(uCol*.7,uCol*1.25,vR)*uLight;
 gl_FragColor=linearToOutputTexel(vec4(c,a));
}`;

/* ---------- Nuvens de poeira (manchas macias) ---------- */
const PVERT=`
attribute vec4 aS;attribute float aT;
uniform vec3 uCam;uniform vec3 uDisp;uniform float uPh;uniform float uK;uniform float uScale;
varying float vA;
const vec3 BOX=vec3(44.,5.,44.);
void main(){
 float sp=.5+.5*aT;
 vec3 p0=vec3(aS.x*BOX.x,aS.y*BOX.y,aS.z*BOX.z)+uDisp*sp*.8;
 p0.y+=sin(uPh*.5+aS.x*30.)*.4;
 vec3 rel;
 rel.x=mod(p0.x-uCam.x+BOX.x*.5,BOX.x)-BOX.x*.5;
 rel.z=mod(p0.z-uCam.z+BOX.z*.5,BOX.z)-BOX.z*.5;
 rel.y=mod(p0.y-uCam.y+1.8,BOX.y)-1.8;
 vec3 wp=uCam+rel;
 float dist=length(rel);
 vec4 c0=projectionMatrix*(viewMatrix*vec4(wp,1.));
 float show=smoothstep(aS.w,aS.w+.15,uK);
 if(show<.01||c0.w<1.){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;vA=0.;return;}
 gl_Position=c0;
 gl_PointSize=clamp((.9+1.1*aT)*uScale/c0.w,6.,150.);
 vA=(1.-smoothstep(16.,24.,dist))*smoothstep(1.5,6.,c0.w)*show*(.6+.4*fract(aT*7.3));
}`;
const PFRAG=`
uniform vec3 uCol;uniform float uLight;uniform float uAlpha;
varying float vA;
void main(){
 float r=length(gl_PointCoord*2.-1.);
 float a=1.-smoothstep(0.,1.,r);a*=a;
 a*=vA*uAlpha;
 if(a<.004)discard;
 gl_FragColor=linearToOutputTexel(vec4(uCol*uLight,a));
}`;

function build(){
 if(grains||!post.overlay)return;
 const tier=clamp(OWM.tier==null?1:OWM.tier,0,3);
 const NG=(touch?[140,220,300,300]:[260,420,620,820])[tier];
 const NP=(touch?[10,14,18,18]:[18,26,34,44])[tier];
 const mk=(N)=>{
  const s=new Float32Array(N*4),t=new Float32Array(N);
  for(let i=0;i<N;i++){s[i*4]=Math.random();s[i*4+1]=Math.random();s[i*4+2]=Math.random();s[i*4+3]=(i+.5)/N*.9;t[i]=Math.random()}   // aS.w = limiar de visibilidade (cresce com a intensidade)
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(N*3),3));
  g.setAttribute('aS',new THREE.BufferAttribute(s,4));g.setAttribute('aT',new THREE.BufferAttribute(t,1));
  return g;
 };
 W.disp=new THREE.Vector3();
 pmat=new THREE.ShaderMaterial({uniforms:{uCam:{value:new THREE.Vector3()},uDisp:{value:new THREE.Vector3()},uPh:{value:0},uK:{value:0},uScale:{value:500},
  uCol:{value:new THREE.Color(.80,.64,.42)},uLight:{value:1},uAlpha:{value:.075}},vertexShader:PVERT,fragmentShader:PFRAG,transparent:true,depthWrite:false,depthTest:false});
 puffs=new THREE.Points(mk(NP),pmat);puffs.frustumCulled=false;puffs.visible=false;post.overlay.add(puffs);
 gmat=new THREE.ShaderMaterial({uniforms:{uCam:{value:new THREE.Vector3()},uWind:{value:new THREE.Vector3(1,0,0)},uDisp:{value:new THREE.Vector3()},uPh:{value:0},uK:{value:0},
  uRes:{value:new THREE.Vector2(800,450)},uScale:{value:500},uCol:{value:new THREE.Color(.80,.64,.42)},uLight:{value:1},uAlpha:{value:.34}},
  vertexShader:GVERT,fragmentShader:GFRAG,transparent:true,depthWrite:false,depthTest:false});
 grains=new THREE.Points(mk(NG),gmat);grains.frustumCulled=false;grains.visible=false;post.overlay.add(grains);
 W.ready=true;
}

/* zone: 0..1 = quanto o jogador está dentro do deserto; under: true se a câmera está debaixo d'água */
function update(dt,zone,under){
 dt=clamp(dt||0,0,.1);
 W.time+=dt;
 const t=W.time;
 /* rajada suave (0..1) e direção que gira bem devagar */
 W.gust=clamp(.55+.45*(.5*Math.sin(t*.37)+.3*Math.sin(t*.91+1.3)+.2*Math.sin(t*.173+.4)),0,1);
 const a=.9+.55*Math.sin(t*.043)+.3*Math.sin(t*.117+1.7);
 W.wx=Math.cos(a);W.wz=Math.sin(a);
 W.speed=CFG.SPEED_MIN+(CFG.SPEED_MAX-CFG.SPEED_MIN)*W.gust;
 /* intensidade: dentro do deserto, com opção ligada, fora d'água e sem tempestade em andamento */
 const sandK=OWM.sand?OWM.sand.k:0;
 const tgt=(S.sand&&!under)?clamp(zone,0,1)*(1-clamp(sandK*1.6,0,1)):0;
 W.k+=(tgt-W.k)*(1-Math.exp(-dt*CFG.FADE));
 if(W.k<.004){if(grains){grains.visible=false;puffs.visible=false}return}
 if(!W.ready){build();if(!W.ready)return}
 W.disp.x+=W.wx*W.speed*dt;W.disp.z+=W.wz*W.speed*dt;W.disp.y+=.03*W.speed*dt;
 const gu=gmat.uniforms,pu=pmat.uniforms;
 R.getDrawingBufferSize(_v2);
 const scale=_v2.y/(2*Math.tan(cam.fov*Math.PI/360));
 const L=post.hemi?post.hemi.intensity:.8;
 const light=clamp(.14+L*.9,.12,1.1);
 gu.uCam.value.copy(cam.position);pu.uCam.value.copy(cam.position);
 gu.uWind.value.set(W.wx*W.speed,.03*W.speed,W.wz*W.speed);
 gu.uDisp.value.copy(W.disp);pu.uDisp.value.copy(W.disp);
 gu.uPh.value=pu.uPh.value=t;
 gu.uK.value=Math.min(1,W.k*(.45+.55*W.gust));
 pu.uK.value=Math.min(1,W.k*(.35+.65*W.gust));
 gu.uRes.value.copy(_v2);gu.uScale.value=pu.uScale.value=scale;
 gu.uLight.value=pu.uLight.value=light;
 grains.visible=true;puffs.visible=true;
}
function reset(){
 W.k=0;W.time=0;
 if(W.disp)W.disp.set(0,0,0);
 if(grains){grains.visible=false;puffs.visible=false}
}

OWM.wind={update,reset,state:W};
})();
