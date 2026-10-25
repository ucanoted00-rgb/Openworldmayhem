/* Open World Mayhem — céu, sol e lua com bloom real, tone mapping e correção sRGB no passe final.

   Por que o bloom antigo não funcionava: nas builds "examples/js" do three r128 as classes ficam em
   THREE.EffectComposer / THREE.UnrealBloomPass etc., não em variáveis globais — então a checagem
   typeof EffectComposer sempre dava "undefined" e o bloom nunca era criado. */
(()=>{
const {$,S,R,scene,cam}=OWM;

R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;
const TONES=[THREE.NoToneMapping,THREE.LinearToneMapping,THREE.ReinhardToneMapping,THREE.CineonToneMapping,THREE.ACESFilmicToneMapping];

const DAY_DURATION=1000;          // 1000s de ciclo completo → ~500s até anoitecer
let dayTime=0.15;                 // começa de manhã
const SUN_DIST=75;

/* Bloom: só o que passa de "threshold" brilha. Materiais normais (com tone mapping) ficam abaixo de 1;
   sol (~5) e lua (~2.7) são HDR e passam. */
const BLOOM={strength:.9,radius:.6,threshold:1.9};

/* ---------- Céu ---------- */
const skyMat=new THREE.ShaderMaterial({
 side:THREE.BackSide,depthWrite:false,fog:false,
 uniforms:{topColor:{value:new THREE.Color(0x3a8dde)},bottomColor:{value:new THREE.Color(0xb8dbfa)},
  cloudColor:{value:new THREE.Color(0xffffff)},cloudShade:{value:new THREE.Color(0xb4c3d8)},cloudAmt:{value:1},cloudTime:{value:0}},
 vertexShader:`varying vec3 vW;varying vec3 vL;void main(){vec4 wp=modelMatrix*vec4(position,1.0);vW=wp.xyz;vL=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
 fragmentShader:`uniform vec3 topColor;uniform vec3 bottomColor;uniform vec3 cloudColor;uniform vec3 cloudShade;uniform float cloudAmt;uniform float cloudTime;varying vec3 vW;varying vec3 vL;
 float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
 float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
 float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec2(17.1,9.3);a*=.5;}return s;}
 void main(){
  float h=normalize(vW).y;float f=pow(max(0.,h),0.6);
  vec3 col=mix(bottomColor,topColor,f);
  float hc=normalize(vL).y;
  if(hc>0.){
   vec2 uv=normalize(vL).xz/(hc+.14)*1.35+vec2(cloudTime*.018,cloudTime*.007);
   float n=fbm(uv);
   float dens=smoothstep(.47,.80,n);
   float under=smoothstep(.55,.95,fbm(uv+vec2(.07,.05)*2.));
   vec3 cc=mix(cloudColor,cloudShade,under*.75);
   float fade=smoothstep(.03,.28,hc);
   col=mix(col,cc,dens*fade*cloudAmt);
  }
  gl_FragColor=vec4(col,1.0);}`
});
const skyDome=new THREE.Mesh(new THREE.SphereGeometry(95,32,16),skyMat);
skyDome.frustumCulled=false;skyDome.renderOrder=-10;scene.add(skyDome);

/* ---------- Glow suave (sprite aditivo) — sempre ligado; é o brilho do sol/lua quando não há bloom ---------- */
const glowTex=(()=>{
 const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
 const gr=g.createRadialGradient(64,64,0,64,64,64);
 gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.12,'rgba(255,255,255,.55)');
 gr.addColorStop(.35,'rgba(255,255,255,.16)');gr.addColorStop(.65,'rgba(255,255,255,.04)');gr.addColorStop(1,'rgba(255,255,255,0)');
 g.fillStyle=gr;g.fillRect(0,0,128,128);
 return new THREE.CanvasTexture(c);
})();
function mkGlow(r,g,b,size,opacity){
 const m=new THREE.SpriteMaterial({map:glowTex,color:new THREE.Color(r,g,b),transparent:true,opacity,
  blending:THREE.AdditiveBlending,depthWrite:false,fog:false,toneMapped:false});
 const s=new THREE.Sprite(m);s.scale.set(size,size,1);s.renderOrder=6;s.frustumCulled=false;s.userData.size=size;
 return s;
}

/* ---------- SOL (HDR) ---------- */
const sunMat=new THREE.MeshBasicMaterial({color:0xffffff,fog:false,toneMapped:false});
sunMat.color.setRGB(5,4.5,3);
const sunMesh=new THREE.Mesh(new THREE.SphereGeometry(6,32,32),sunMat);
sunMesh.renderOrder=5;sunMesh.frustumCulled=false;scene.add(sunMesh);
const sunGlow=mkGlow(1,.78,.42,46,.9);sunMesh.add(sunGlow);

/* ---------- LUA (HDR) ---------- */
const moonMat=new THREE.MeshBasicMaterial({color:0xffffff,fog:false,toneMapped:false});
moonMat.color.setRGB(2.5,2.7,3.2);
const moonMesh=new THREE.Mesh(new THREE.SphereGeometry(4.5,24,24),moonMat);
moonMesh.renderOrder=5;moonMesh.frustumCulled=false;scene.add(moonMesh);
const moonGlow=mkGlow(.55,.68,1,30,.7);moonMesh.add(moonGlow);

/* ---------- Estrelas ---------- */
const starVerts=[];
for(let i=0;i<800;i++){
 const r=85+Math.random()*10,th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1);
 starVerts.push(r*Math.sin(ph)*Math.cos(th),r*Math.cos(ph),r*Math.sin(ph)*Math.sin(th));
}
const starGeo=new THREE.BufferGeometry();
starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starVerts,3));
const starMat=new THREE.PointsMaterial({color:0xffffff,size:0.3,sizeAttenuation:false,transparent:true,opacity:0,fog:false,toneMapped:false});
const stars=new THREE.Points(starGeo,starMat);
stars.frustumCulled=false;stars.renderOrder=4;scene.add(stars);

/* ---------- Luzes ---------- */
const hemi=new THREE.HemisphereLight(0xd8e8ff,0x8a8070,0.9);scene.add(hemi);
const sunLight=new THREE.DirectionalLight(0xfff2dc,1.2);
sunLight.castShadow=true;sunLight.shadow.mapSize.set(2048,2048);
const sc=sunLight.shadow.camera;
sc.left=sc.bottom=-35;sc.right=sc.top=35;sc.near=1;sc.far=200;
sc.updateProjectionMatrix();
sunLight.shadow.bias=-0.0004;sunLight.shadow.normalBias=0.03;
scene.add(sunLight);scene.add(sunLight.target);

/* ---------- NÉVOA VOLUMÉTRICA ----------
   Passe de raymarching em tela cheia, antes do bloom (tudo em linear/HDR). Reconstrói a posição de mundo pela textura de
   profundidade e marcha do olho até a superfície acumulando: densidade (camada rente ao chão + ruído 3D com vento) ×
   luz (ambiente = cor do horizonte; sol com fase Henyey-Greenstein → raios de luz; no nível "Alta" o shadow map do sol
   recorta os raios entre as árvores). Níveis: S.vfog 0=desligada, 1=normal (menos passos, sem sombras), 2=alta. */
const FOG_FRAG=`
uniform sampler2D tDiffuse;uniform sampler2D tDepth;uniform sampler2D tShadow;
uniform mat4 projInv;uniform mat4 camWorld;uniform mat4 shadowMat;
uniform vec3 camPos;uniform vec3 fogCol;uniform vec3 sunDir;uniform vec3 sunCol;
uniform float time;uniform float dens;uniform float hFall;uniform float baseY;uniform float maxDist;uniform float useShadow;
uniform int steps;uniform int octaves;
varying vec2 vUv;
const float UnpackDownscale=255./256.;
const vec3 PackFactors=vec3(256.*256.*256.,256.*256.,256.);
const vec4 UnpackFactors=vec4(UnpackDownscale/PackFactors.x,UnpackDownscale/PackFactors.y,UnpackDownscale/PackFactors.z,UnpackDownscale);
float unpackDepth(vec4 v){return dot(v,UnpackFactors);}
float hash3(vec3 p){p=fract(p*0.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vnoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash3(i),hash3(i+vec3(1.,0.,0.)),f.x),mix(hash3(i+vec3(0.,1.,0.)),hash3(i+vec3(1.,1.,0.)),f.x),f.y),
            mix(mix(hash3(i+vec3(0.,0.,1.)),hash3(i+vec3(1.,0.,1.)),f.x),mix(hash3(i+vec3(0.,1.,1.)),hash3(i+vec3(1.,1.,1.)),f.x),f.y),f.z);}
float density(vec3 p,float dt){
 float h=max(p.y-baseY,0.);
 float layer=exp(-h*hFall)+0.05*exp(-h*0.025);                      // camada de névoa rente ao chão + neblina fina no ar
 if(dens*layer*1.7*dt<1e-5)return 0.;                                  // já abaixo do corte: pula o ruído 3D (resultado idêntico)
 vec3 q=p*0.085+vec3(time*0.035,0.,time*0.02);                        // vento
 float n=vnoise(q);if(octaves>1)n=n*0.65+vnoise(q*2.3+vec3(7.1,3.7,1.3))*0.35;
 return dens*layer*(0.3+1.4*n);
}
float shadowAt(vec3 p){
 if(useShadow<0.5)return 1.;
 vec4 s=shadowMat*vec4(p,1.);s.xyz/=s.w;
 if(s.x<0.||s.x>1.||s.y<0.||s.y>1.||s.z>1.)return 1.;
 return step(s.z-0.0008,unpackDepth(texture2D(tShadow,s.xy)));
}
float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}
void main(){
 vec3 col=texture2D(tDiffuse,vUv).rgb;
 float d=texture2D(tDepth,vUv).x;
 vec4 vp=projInv*vec4(vUv*2.-1.,d*2.-1.,1.);vp/=vp.w;
 vec3 wp=(camWorld*vec4(vp.xyz,1.)).xyz;
 vec3 ray=wp-camPos;float L=length(ray);vec3 dir=ray/max(L,1e-4);
 if(d>=0.99999)L=maxDist;
 L=min(L,maxDist);
 if(!(L>0.)||L>1e5){gl_FragColor=vec4(col,1.);return;}
 float sl=maxDist/float(steps);int ns=int(clamp(ceil(L/sl),6.,float(steps)));   // mesmo passo de antes, mas raios curtos usam menos amostras
 float dt=L/float(ns),j=ign(gl_FragCoord.xy);
 float cs=dot(dir,sunDir),g=0.55;
 float ph=(1.-g*g)/(4.*3.14159265*pow(max(1.+g*g-2.*g*cs,1e-3),1.5));   // Henyey-Greenstein
 float T=1.;vec3 acc=vec3(0.);
 for(int i=0;i<48;i++){
  if(i>=ns||T<0.02)break;
  vec3 p=camPos+dir*((float(i)+j)*dt);
  float dn=density(p,dt)*dt;if(dn<1e-5)continue;
  vec3 lit=fogCol+sunCol*(0.05+1.0*ph)*shadowAt(p);
  float e=exp(-dn);acc+=T*(1.-e)*lit;T*=e;
 }
 vec3 o=col*T+acc;
 if(!(o.r<1e5&&o.g<1e5&&o.b<1e5&&o.r>=0.&&o.g>=0.&&o.b>=0.))o=col;          // NaN/Inf nunca chegam no bloom
 gl_FragColor=vec4(o,1.);
}`;
const FOG_VERT=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const FOG={dens:.0085,hFall:.11,maxDist:110};
let fogPass=null,fogBroken=false,fogChecks=0,fogTime=0,groundY=14,baseYs=14,fogAmt=1;
const _cp=new THREE.Vector3(),_sd=new THREE.Vector3(),_sc=new THREE.Color();

/* ---------- BLOOM (cena HDR em half-float → bloom → tone/sRGB) ---------- */
let composer=null,bloomPass=null,finPass=null,heatV=0,heatT=0;

/* confirma que a GPU consegue renderizar em half-float (senão a tela ficaria preta) */
function hdrTargetOk(){
 try{
  ['EXT_color_buffer_float','EXT_color_buffer_half_float'].forEach(n=>{if(R.extensions.has(n))R.extensions.get(n)});
  const t=new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
  R.setRenderTarget(t);
  const gl=R.getContext(),ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
  R.setRenderTarget(null);t.dispose();
  return ok;
 }catch(e){try{R.setRenderTarget(null)}catch(_){}return false}
}

function initBloom(){
 const T=THREE;
 if(!(T.EffectComposer&&T.RenderPass&&T.ShaderPass&&T.UnrealBloomPass&&T.CopyShader&&T.LuminosityHighPassShader)){
  console.warn('[OWM] Bloom indisponível — scripts de pós-processamento do three não carregaram. Usando glow simples.');return;
 }
 if(!hdrTargetOk()){console.warn('[OWM] Bloom indisponível — GPU sem render target HDR. Usando glow simples.');return}
 try{
  const pr=R.getPixelRatio(),w=Math.max(2,Math.floor(innerWidth*pr)),h=Math.max(2,Math.floor(innerHeight*pr));
  const rt=new T.WebGLRenderTarget(w,h,{type:T.HalfFloatType,format:T.RGBAFormat,minFilter:T.LinearFilter,magFilter:T.LinearFilter});
  /* profundidade legível pelo shader da névoa. ATENÇÃO: no r128 rt.clone() REAPROVEITA a mesma depthTexture; se os dois buffers
     do composer dividirem a profundidade, o passe lê a textura que está anexada ao framebuffer de destino (feedback loop) e a tela fica preta.
     Por isso cada buffer recebe a sua. */
  const depthOk=(R.capabilities.isWebGL2||R.extensions.has('WEBGL_depth_texture'))&&!!T.DepthTexture;
  if(depthOk)rt.depthTexture=new T.DepthTexture(w,h,T.UnsignedIntType);
  composer=new T.EffectComposer(R,rt);
  if(depthOk)composer.renderTarget2.depthTexture=new T.DepthTexture(w,h,T.UnsignedIntType);
  composer.addPass(new T.RenderPass(scene,cam));
  if(depthOk&&composer.renderTarget1.depthTexture!==composer.renderTarget2.depthTexture){
   fogPass=new T.ShaderPass({
    uniforms:{tDiffuse:{value:null},tDepth:{value:null},tShadow:{value:null},projInv:{value:new T.Matrix4()},camWorld:{value:new T.Matrix4()},shadowMat:{value:new T.Matrix4()},
     camPos:{value:new T.Vector3()},fogCol:{value:new T.Color()},sunDir:{value:new T.Vector3(0,1,0)},sunCol:{value:new T.Color()},
     time:{value:0},dens:{value:FOG.dens},hFall:{value:FOG.hFall},baseY:{value:14},maxDist:{value:FOG.maxDist},useShadow:{value:0},steps:{value:16},octaves:{value:1}},
    vertexShader:FOG_VERT,fragmentShader:FOG_FRAG});
   const rd=fogPass.render.bind(fogPass);
   fogPass.render=function(r,wb,rb,dt,m){this.uniforms.tDepth.value=rb.depthTexture;rd(r,wb,rb,dt,m)};
   composer.addPass(fogPass);
  }else console.warn('[OWM] Névoa volumétrica indisponível — GPU sem textura de profundidade.');

  bloomPass=new T.UnrealBloomPass(new T.Vector2(w,h),BLOOM.strength,BLOOM.radius,BLOOM.threshold);
  /* alvos do blur também em half-float: mantém a cor quente do sol (8 bits cortaria tudo em branco) */
  const hf=t=>{t.texture.type=T.HalfFloatType};
  hf(bloomPass.renderTargetBright);bloomPass.renderTargetsHorizontal.forEach(hf);bloomPass.renderTargetsVertical.forEach(hf);
  composer.addPass(bloomPass);

  /* passe final: "ombro" suave para valores > 0.8 + conversão linear → sRGB (o render target é linear) */
  const fin=new T.ShaderPass({
   uniforms:{tDiffuse:{value:null},uHeat:{value:0},uTime:{value:0}},
   vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
   fragmentShader:`
    uniform sampler2D tDiffuse;uniform float uHeat;uniform float uTime;varying vec2 vUv;
    vec3 shoulder(vec3 c){vec3 o=max(c-0.8,vec3(0.0));return min(c,vec3(0.8))+0.2*(vec3(1.0)-exp(-o/0.2));}
    vec3 toSRGB(vec3 c){return mix(pow(c,vec3(0.41666))*1.055-vec3(0.055),c*12.92,vec3(lessThanEqual(c,vec3(0.0031308))));}
    void main(){
     vec2 uv=vUv;
     if(uHeat>0.001){   // miragem: ondulação horizontal mais forte perto do horizonte
      float hz=smoothstep(0.0,0.55,vUv.y)*(1.0-smoothstep(0.55,1.0,vUv.y))*0.6+0.4;float a=uHeat*0.0032*hz;
      uv.x+=sin(vUv.y*55.0+uTime*3.1)*a+sin(vUv.y*21.0-uTime*1.7)*a*0.7;uv.y+=sin(vUv.x*37.0+uTime*2.3)*a*0.45;
     }
     vec3 c=max(texture2D(tDiffuse,uv).rgb,vec3(0.0));
     if(uHeat>0.001){c*=mix(vec3(1.0),vec3(1.10,1.0,0.80),uHeat*0.7);c+=vec3(0.035,0.02,0.0)*uHeat;}   // brilho/tom quente
     gl_FragColor=vec4(toSRGB(clamp(shoulder(c),0.0,1.0)),1.0);}`
  });
  fin.renderToScreen=true;finPass=fin;
  composer.addPass(fin);
 }catch(e){
  console.warn('[OWM] Falha ao montar o bloom — usando glow simples.',e);
  composer=null;bloomPass=null;
 }
}
initBloom();
const useComposer=()=>!!(composer&&(S.bloom||(fogPass&&fogPass.enabled)));

/* ---------- Configurações ---------- */
let lt=-1,ls=-1,lf=-1;
const vig=$('#vig');

function refreshMaterials(){
 const up=m=>{if(m)m.needsUpdate=true};
 scene.traverse(o=>{if(o.material)[].concat(o.material).forEach(up)});
 OWM.extraMats.forEach(f=>f().forEach(up));
}

let dynScale=1,dSlow=0,dFast=0,dCool=0;
function resize(){
 const RES_H=[480,740,1080][S.res]||740;   // altura-alvo (lado menor da tela); nunca passa da resolução nativa
 R.setPixelRatio(Math.min(devicePixelRatio,RES_H/Math.min(innerWidth,innerHeight))*dynScale);
 R.setSize(innerWidth,innerHeight,false);
 cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();
 if(composer){
  const pr=R.getPixelRatio();
  if(composer.setPixelRatio){composer.setPixelRatio(pr);composer.setSize(innerWidth,innerHeight)}
  else composer.setSize(innerWidth*pr,innerHeight*pr);
  for(const t of [composer.renderTarget1,composer.renderTarget2])if(t.depthTexture){t.depthTexture.image.width=t.width;t.depthTexture.image.height=t.height}
 }
}

function apply(far){
 scene.fog=new THREE.Fog(0xb8dbfa,far*.55,far*.97);
 cam.far=far+80;
 const k=.55+S.bright/100*.9;
 hemi.intensity=.9*k;
 sunLight.intensity=1.2*k;

 if(lt!==S.tone){lt=S.tone;R.toneMapping=TONES[S.tone]!==undefined?TONES[S.tone]:THREE.ReinhardToneMapping;refreshMaterials();}
 if(ls!==S.shadow){ls=S.shadow;const sz=ls===2?2048:1024;
  if(sunLight.shadow.mapSize.x!==sz){sunLight.shadow.mapSize.set(sz,sz);if(sunLight.shadow.map){sunLight.shadow.map.dispose();sunLight.shadow.map=null}}
  sunLight.castShadow=ls>0;
 }
 if(lf!==S.res){lf=S.res;resize();}
 vig.style.opacity=S.vig?1:0;
 if(bloomPass)bloomPass.enabled=!!S.bloom;
 if(fogPass){fogPass.enabled=S.vfog>0&&!fogBroken;const u=fogPass.uniforms;u.steps.value=S.vfog>1?32:16;u.octaves.value=S.vfog>1?2:1}
 cam.updateProjectionMatrix();
 return Math.min(1.6,k*1.35);
}

/* ---------- Atualização celeste ---------- */
const dayTop=new THREE.Color(0x3a8dde),dayBot=new THREE.Color(0xb8dbfa);
const duskTop=new THREE.Color(0x2a1a4a),duskBot=new THREE.Color(0xff6a3a);
const nightTop=new THREE.Color(0x050a18),nightBot=new THREE.Color(0x0a1028);
const _sunColor=new THREE.Color(),_dusk=new THREE.Color(0xff7a3a);
const _top=new THREE.Color(),_bot=new THREE.Color();let cloudT=0;const _cl=new THREE.Color(),_cs=new THREE.Color(),_clDay=new THREE.Color(0xffffff),_clDusk=new THREE.Color(0xffa070);

function updateCelestial(dt){
 dayTime=(dayTime+dt/DAY_DURATION)%1;
 const angle=dayTime*Math.PI*2;

 const sunX=Math.cos(angle)*SUN_DIST;
 const sunY=Math.sin(angle)*SUN_DIST;
 sunMesh.position.set(cam.position.x+sunX, cam.position.y+sunY, cam.position.z);
 moonMesh.position.set(cam.position.x-sunX, cam.position.y-sunY, cam.position.z);

 const sunHeight=Math.sin(angle);
 const dayFactor=Math.max(0,Math.min(1,(sunHeight+0.15)/0.5));

 sunLight.position.copy(sunMesh.position);
 sunLight.target.position.copy(cam.position);
 sunLight.target.updateMatrixWorld();
 sunLight.intensity=(0.08+dayFactor*1.15)*(0.55+S.bright/100*0.9);
 _sunColor.setHex(0xfff2dc).lerp(_dusk,Math.max(0,Math.min(1,1-sunHeight*2.2)));
 sunLight.color.copy(_sunColor);
 hemi.intensity=(0.12+dayFactor*0.85)*(0.55+S.bright/100*0.9);

 let top,bot;
 if(sunHeight>0.25){const t=Math.max(0,1-(sunHeight-0.25)/0.35);top=_top.copy(dayTop).lerp(duskTop,t);bot=_bot.copy(dayBot).lerp(duskBot,t);}
 else if(sunHeight>-0.15){const t=(sunHeight+0.15)/0.4;top=_top.copy(duskTop).lerp(nightTop,1-t);bot=_bot.copy(duskBot).lerp(nightBot,1-t);}
 else{top=nightTop;bot=nightBot;}
 if(biomeT>.001&&dayFactor>0){const k=biomeT*.24*dayFactor;top.lerp(_pkTop,k);bot.lerp(_pkBot,k*1.25)}   // top/bot aqui são cópias (_top/_bot) quando dayFactor>0
 skyMat.uniforms.topColor.value.copy(top);
 skyMat.uniforms.bottomColor.value.copy(bot);
 /* O céu escreve a cor "crua" (já em sRGB). Com o composer o passe final converte linear→sRGB,
    então o céu entra convertido para linear e sai igualzinho ao modo sem bloom. */
 if(useComposer()){skyMat.uniforms.topColor.value.convertSRGBToLinear();skyMat.uniforms.bottomColor.value.convertSRGBToLinear()}
 /* nuvens: brancas de dia, alaranjadas no pôr do sol, azul-escuro à noite; deslizam devagar */
 cloudT+=dt;
 _cl.setHex(0x1b2438).lerp(_clDay,dayFactor);
 _cl.lerp(_clDusk,Math.max(0,Math.min(1,1-sunHeight*2.2))*Math.min(1,dayFactor*2.2)*.7);
 _cs.copy(_cl).multiplyScalar(.72);
 skyMat.uniforms.cloudColor.value.copy(_cl);
 skyMat.uniforms.cloudShade.value.copy(_cs);
 skyMat.uniforms.cloudAmt.value=.3+.7*dayFactor;
 skyMat.uniforms.cloudTime.value=cloudT;
 if(useComposer()){skyMat.uniforms.cloudColor.value.convertSRGBToLinear();skyMat.uniforms.cloudShade.value.convertSRGBToLinear()}
 skyDome.position.copy(cam.position);

 /* sol mais forte e maior perto do horizonte */
 const hb=1+(1-Math.abs(sunHeight))*0.8;
 sunMat.color.setRGB(5*hb,4.5*hb*0.9,3*hb*0.6);
 sunGlow.scale.set(sunGlow.userData.size*hb,sunGlow.userData.size*hb,1);
 moonMat.color.setRGB(2.5,2.7,3.2);

 starMat.opacity=Math.max(0,Math.min(1,(-sunHeight+0.2)/0.4));
 stars.position.copy(cam.position);
 if(scene.fog)scene.fog.color.copy(bot);

 sunMesh.visible=sunHeight>-0.35;
 moonMesh.visible=sunHeight<0.35;
}

function updateFog(dt){
 if(!fogPass||!fogPass.enabled)return;
 const u=fogPass.uniforms,sh=sunLight.shadow;
 fogTime+=dt;baseYs+=(groundY-baseYs)*(1-Math.exp(-dt*1.5));
 const sunH=Math.sin(dayTime*Math.PI*2),dayF=Math.max(0,Math.min(1,(sunH+.15)/.5));
 const golden=Math.max(0,Math.min(1,1-Math.abs(sunH)*3));          // amanhecer/entardecer: névoa mais densa
 u.time.value=fogTime;u.baseY.value=baseYs-1.5;
 u.dens.value=FOG.dens*(1+1.3*golden)*(S.vfog>1?1:.85);
 /* luz ambiente = cor do horizonte (já linear quando o composer está ativo); sol = cor da luz × dia */
 u.fogCol.value.copy(skyMat.uniforms.bottomColor.value).multiplyScalar(.55+.45*dayF);
 _sc.copy(sunLight.color);if(!useComposer())_sc.convertSRGBToLinear();
 u.sunCol.value.copy(_sc).multiplyScalar(dayF*1.7);
 _sd.copy(sunLight.position).sub(sunLight.target.position).normalize();u.sunDir.value.copy(_sd);
 const useSh=S.vfog>1&&S.shadow>0&&sunLight.castShadow&&sh.map;
 u.useShadow.value=useSh?1:0;
 if(useSh){u.tShadow.value=sh.map.texture;u.shadowMat.value.copy(sh.matrix)}
}
function update(dt){dt=dt||0.016;updateCelestial(dt);updateFog(dt);heatT+=dt;if(finPass){finPass.uniforms.uTime.value=heatT;finPass.uniforms.uHeat.value=heatV}}
function setHeat(v){heatV=v}
let biomeT=0;function setBiome(v){biomeT=v}   // 0..1: peso do cerejeiral -> céu/névoa levemente rosados de dia
const _pkTop=new THREE.Color(0xe39ec2),_pkBot=new THREE.Color(0xffd6e4);
function setGround(y){groundY=y}
/* Resolução dinâmica: se o FPS cair, reduz a escala de render aos poucos (mín. 75%); quando sobra folga, volta a 100%. */
function adapt(fps){
 if(!S.dyn){if(dynScale!==1){dynScale=1;resize()}return}
 if(dCool>0){dCool--;return}
 if(fps<40){dFast=0;if(++dSlow>=2&&dynScale>.75){dynScale=Math.max(.75,Math.round((dynScale-.1)*100)/100);dSlow=0;dCool=3;resize()}}
 else if(fps>=57){dSlow=0;if(++dFast>=8&&dynScale<1){dynScale=Math.min(1,Math.round((dynScale+.05)*100)/100);dFast=0;dCool=3;resize()}}
 else{dSlow=0;dFast=0}
}
function render(){
 if(fogPass&&fogPass.enabled&&useComposer()){
  cam.updateMatrixWorld();const u=fogPass.uniforms;
  u.projInv.value.copy(cam.projectionMatrixInverse);u.camWorld.value.copy(cam.matrixWorld);u.camPos.value.setFromMatrixPosition(cam.matrixWorld);
 }
 if(useComposer()){
  const chk=fogPass&&fogPass.enabled&&fogChecks<6,gl=chk?R.getContext():null;
  if(chk)gl.getError();                                   // limpa erros antigos
  composer.render();
  if(chk){fogChecks++;const e=gl.getError();
   if(e!==gl.NO_ERROR){fogBroken=true;fogPass.enabled=false;console.warn('[OWM] Névoa volumétrica desativada: erro de GL 0x'+e.toString(16)+' ao renderizar o passe.')}}
 }else R.render(scene,cam);
}

addEventListener('resize',resize);resize();
OWM.post={setBiome,setHeat,apply,update,resize,render,setGround,adapt,skyDome,hemi,sunLight,sunMesh,moonMesh,bloomActive:useComposer};
})();
