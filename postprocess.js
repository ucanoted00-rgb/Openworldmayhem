/* Open World Mayhem — céu, sol e lua com bloom real, tone mapping e correção sRGB no passe final.

   Por que o bloom antigo não funcionava: nas builds "examples/js" do three r128 as classes ficam em
   THREE.EffectComposer / THREE.UnrealBloomPass etc., não em variáveis globais — então a checagem
   typeof EffectComposer sempre dava "undefined" e o bloom nunca era criado. */
(()=>{
const {$,S,R,scene,cam}=OWM;

R.shadowMap.enabled=true;R.shadowMap.type=OWM.touch?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;   // celular: PCF (mais barato)
R.shadowMap.autoUpdate=false;   // o mapa de sombra é regerado só em updateShadowFrame (~30 Hz), via R.shadowMap.needsUpdate
const TONES=[THREE.NoToneMapping,THREE.LinearToneMapping,THREE.ReinhardToneMapping,THREE.CineonToneMapping,THREE.ACESFilmicToneMapping];

const DAY_DURATION=840;           // ciclo completo de 14 min → 7 min até anoitecer e 7 min até amanhecer
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
uniform sampler2D tDepth;uniform sampler2D tShadow;uniform vec2 lowSize;uniform vec2 fullSize;
uniform mat4 projInv;uniform mat4 camWorld;uniform mat4 shadowMat;
uniform vec3 camPos;uniform vec3 fogCol;uniform vec3 sunDir;uniform vec3 sunCol;
uniform float time;uniform float dens;uniform float hFall;uniform float baseY;uniform float maxDist;uniform float useShadow;
uniform int steps;uniform int octaves;uniform float sand;uniform vec2 sandDir;
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
 float base=0.;
 if(dens*layer*1.7*dt>=1e-5){                                        // abaixo do corte: pula o ruído 3D (resultado idêntico)
  vec3 q=p*0.085+vec3(time*0.035,0.,time*0.02);                      // vento
  float n=vnoise(q);if(octaves>1)n=n*0.65+vnoise(q*2.3+vec3(7.1,3.7,1.3))*0.35;
  base=dens*layer*(0.3+1.4*n);
 }
 if(sand>0.001){                                                     // tempestade de areia: massas de poeira carregadas pelo vento
  vec3 qs=p*vec3(.06,.1,.06)-vec3(sandDir.x,0.,sandDir.y)*time*.9;
  float ns=vnoise(qs);if(octaves>1)ns=ns*.7+vnoise(qs*2.9+vec3(3.1,8.2,5.4))*.3;
  base+=sand*(.05+.20*ns)*(.55+.45*exp(-h*.03));                     // bolsões mais claros, rajadas mais densas; sobe alto, mas é mais densa perto do chão
 }
 return base;
}
float shadowAt(vec3 p){
 if(useShadow<0.5)return 1.;
 vec4 s=shadowMat*vec4(p,1.);s.xyz/=s.w;
 if(s.x<0.||s.x>1.||s.y<0.||s.y>1.||s.z>1.)return 1.;
 return step(s.z-0.0008,unpackDepth(texture2D(tShadow,s.xy)));
}
float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}
void main(){
 vec2 ij=floor(vUv*lowSize);
 float d=texture2D(tDepth,(ij*2.+.5)/fullSize).x;                      // profundidade do 1º texel do bloco 2x2 (o composite lê o mesmo)
 vec4 vf=projInv*vec4(vUv*2.-1.,1.,1.);vf/=vf.w;
 vec3 dv=normalize(vf.xyz);
 vec3 dir=normalize((camWorld*vec4(dv,0.)).xyz);
 float L=maxDist;
 if(d<0.99999){vec4 zv=projInv*vec4(0.,0.,d*2.-1.,1.);L=min((-zv.z/zv.w)/max(-dv.z,1e-4),maxDist);}
 if(!(L>0.)||L>1e5){gl_FragColor=vec4(0.,0.,0.,1.);return;}
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
 if(!(acc.r<1e5&&acc.g<1e5&&acc.b<1e5&&acc.r>=0.&&acc.g>=0.&&acc.b>=0.&&T>=0.&&T<=1.0001)){acc=vec3(0.);T=1.;}   // NaN/Inf nunca chegam no bloom
 gl_FragColor=vec4(acc,T);
}`;
const FOG_COMP=`
uniform sampler2D tDiffuse;uniform sampler2D tFog;uniform sampler2D tDepth;uniform mat4 projInv;uniform vec2 lowSize;uniform vec2 fullSize;
varying vec2 vUv;
float linZ(float d){if(d>=0.99999)return 60000.;vec4 v=projInv*vec4(0.,0.,d*2.-1.,1.);return -v.z/v.w;}
void main(){
 vec3 col=texture2D(tDiffuse,vUv).rgb;
 float dF=linZ(texture2D(tDepth,vUv).x);
 vec2 q=vUv*fullSize*.5-.5;vec2 i0=floor(q);vec2 f=q-i0;
 vec4 acc=vec4(0.);float ws=0.;
 for(int j=0;j<2;j++)for(int k=0;k<2;k++){
  vec2 ij=clamp(i0+vec2(float(k),float(j)),vec2(0.),lowSize-1.);
  float dL=linZ(texture2D(tDepth,(ij*2.+.5)/fullSize).x);
  vec4 fg=texture2D(tFog,(ij+.5)/lowSize);
  float wb=(k==0?1.-f.x:f.x)*(j==0?1.-f.y:f.y);
  float w=wb/(0.002+abs(dF-dL)/max(dF,1.));                       // amostras de outra superfície (árvore x fundo) quase não contam
  acc+=fg*w;ws+=w;
 }
 vec4 fg=acc/max(ws,1e-6);
 gl_FragColor=vec4(col*fg.a+fg.rgb,1.);
}`;
const FOG_VERT=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const FOG={dens:.0085,hFall:.11,maxDist:110};
let fogPass=null,fogBroken=false,fogChecks=0,fogTime=0,groundY=14,baseYs=14,fogAmt=1;
const _cp=new THREE.Vector3(),_sd=new THREE.Vector3(),_sc=new THREE.Color();

/* ---------- BLOOM (cena HDR em half-float → bloom → tone/sRGB) ---------- */
let composer=null,bloomPass=null,finPass=null,heatV=0,heatT=0,bloomWant=true;

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
    uniforms:{lowSize:{value:new T.Vector2(2,2)},fullSize:{value:new T.Vector2(2,2)},tDepth:{value:null},tShadow:{value:null},projInv:{value:new T.Matrix4()},camWorld:{value:new T.Matrix4()},shadowMat:{value:new T.Matrix4()},
     camPos:{value:new T.Vector3()},fogCol:{value:new T.Color()},sunDir:{value:new T.Vector3(0,1,0)},sunCol:{value:new T.Color()},
     time:{value:0},dens:{value:FOG.dens},hFall:{value:FOG.hFall},baseY:{value:14},maxDist:{value:FOG.maxDist},useShadow:{value:0},steps:{value:16},octaves:{value:1},sand:{value:0},sandDir:{value:new T.Vector2(1,0)}},
    vertexShader:FOG_VERT,fragmentShader:FOG_FRAG});
   /* Névoa em MEIA resolução: o raymarch (fogPass) escreve num alvo de metade do tamanho (rgb = luz espalhada, a = transmitância) e o
      composite (fogComp) faz o upsample bilinear com peso por profundidade, pra névoa não vazar sobre árvores/silhuetas. */
   const rd=fogPass.render.bind(fogPass);
   const fogComp=new T.ShaderPass({uniforms:{tDiffuse:{value:null},tFog:{value:null},tDepth:{value:null},projInv:{value:new T.Matrix4()},lowSize:{value:new T.Vector2(2,2)},fullSize:{value:new T.Vector2(2,2)}},vertexShader:FOG_VERT,fragmentShader:FOG_COMP});
   let fogRT=null;
   fogPass.render=function(r,wb,rb,dt,m){
    const fw=rb.width,fh=rb.height,lw=Math.max(1,Math.ceil(fw/2)),lh=Math.max(1,Math.ceil(fh/2));
    if(!fogRT)fogRT=new T.WebGLRenderTarget(lw,lh,{type:T.HalfFloatType,format:T.RGBAFormat,minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:false,stencilBuffer:false});
    else if(fogRT.width!==lw||fogRT.height!==lh)fogRT.setSize(lw,lh);
    const u=this.uniforms,c=fogComp.uniforms;
    u.tDepth.value=rb.depthTexture;u.lowSize.value.set(lw,lh);u.fullSize.value.set(fw,fh);
    rd(r,fogRT,rb,dt,m);
    c.tFog.value=fogRT.texture;c.tDepth.value=rb.depthTexture;c.projInv.value.copy(u.projInv.value);c.lowSize.value.set(lw,lh);c.fullSize.value.set(fw,fh);
    fogComp.render(r,wb,rb,dt,m);
   };
   composer.addPass(fogPass);
  }else console.warn('[OWM] Névoa volumétrica indisponível — GPU sem textura de profundidade.');

  bloomPass=new T.UnrealBloomPass(new T.Vector2(w,h),BLOOM.strength,BLOOM.radius,BLOOM.threshold);
  /* alvos do blur também em half-float: mantém a cor quente do sol (8 bits cortaria tudo em branco) */
  const hf=t=>{t.texture.type=T.HalfFloatType};
  hf(bloomPass.renderTargetBright);bloomPass.renderTargetsHorizontal.forEach(hf);bloomPass.renderTargetsVertical.forEach(hf);
  composer.addPass(bloomPass);

  /* passe final: "ombro" suave para valores > 0.8 + conversão linear → sRGB (o render target é linear) */
  const fin=new T.ShaderPass({
   uniforms:{tDiffuse:{value:null},uHeat:{value:0},uTime:{value:0},uSand:{value:0},uFlow:{value:new T.Vector2(1,-.12)},uRes:{value:new T.Vector2(1,1)},uSCol:{value:new T.Color(.5,.25,.09)}},
   vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
   fragmentShader:`
    uniform sampler2D tDiffuse;uniform float uHeat;uniform float uTime;varying vec2 vUv;
    uniform float uSand;uniform vec2 uFlow;uniform vec2 uRes;uniform vec3 uSCol;
    float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
    float vn2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x),mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x),f.y);}
    float streak(vec2 q,float len,float dens,float seed){   // um rastro de areia por célula (células longas ao longo do vento)
     vec2 cl=floor(q),f=fract(q);
     if(h21(cl+seed)>dens)return 0.0;
     float y=0.2+0.6*h21(cl+seed+17.3);
     float ln=len*(0.45+0.55*h21(cl+seed+3.1));
     float x=(f.x-h21(cl+seed+9.7)*(1.0-ln))/ln;
     float dy=(f.y-y)/0.11;
     return smoothstep(0.0,0.2,x)*(1.0-smoothstep(0.55,1.0,x))*exp(-dy*dy);
    }
    vec3 shoulder(vec3 c){vec3 o=max(c-0.8,vec3(0.0));return min(c,vec3(0.8))+0.2*(vec3(1.0)-exp(-o/0.2));}
    vec3 toSRGB(vec3 c){return mix(pow(c,vec3(0.41666))*1.055-vec3(0.055),c*12.92,vec3(lessThanEqual(c,vec3(0.0031308))));}
    void main(){
     vec2 uv=vUv;
     float gs=0.7+0.3*sin(uTime*0.8)*sin(uTime*0.31+1.0);   // rajada (0.4..1)
     if(uSand>0.001){   // rajada balança a imagem
      float sw=(vn2(vec2(vUv.y*6.0-uTime*1.3,uTime*0.5))-0.5)*0.010+(vn2(vec2(vUv.y*28.0+uTime*2.1,3.0))-0.5)*0.004;
      uv.x+=sw*uSand*gs;uv.y+=(vn2(vec2(vUv.x*5.0+uTime*0.9,7.0))-0.5)*0.004*uSand*gs;
     }
     if(uHeat>0.001){   // miragem: ondulação horizontal mais forte perto do horizonte
      float hz=smoothstep(0.0,0.55,vUv.y)*(1.0-smoothstep(0.55,1.0,vUv.y))*0.6+0.4;float a=uHeat*0.0032*hz;
      uv.x+=sin(vUv.y*55.0+uTime*3.1)*a+sin(vUv.y*21.0-uTime*1.7)*a*0.7;uv.y+=sin(vUv.x*37.0+uTime*2.3)*a*0.45;
     }
     vec3 c=max(texture2D(tDiffuse,uv).rgb,vec3(0.0));
     if(uHeat>0.001){c*=mix(vec3(1.0),vec3(1.10,1.0,0.80),uHeat*0.7);c+=vec3(0.035,0.02,0.0)*uHeat;}   // brilho/tom quente
     if(uSand>0.001){   // tempestade de areia: tom ocre dessaturado, véus de poeira, rastros em 3 camadas e vinheta
      float lum=dot(c,vec3(0.299,0.587,0.114));
      c=mix(c,vec3(lum)*vec3(1.0,0.74,0.46)*1.1,0.42*uSand);
      c*=1.0-0.12*uSand;
      vec2 p=(vUv-0.5)*vec2(uRes.x/uRes.y,1.0);
      vec2 d=normalize(uFlow);vec2 nn=vec2(-d.y,d.x);
      vec2 q=vec2(dot(p,d),dot(p,nn));
      float spd=0.6+0.5*gs;
      float v=vn2(vec2(q.x*1.4-uTime*0.45*spd,q.y*4.5))*0.6+vn2(vec2(q.x*3.1-uTime*0.8*spd+7.0,q.y*10.0+3.0))*0.4;
      c=mix(c,uSCol*1.25,smoothstep(0.38,0.92,v)*(0.55+0.45*gs)*0.30*uSand);
      float st=streak(vec2(q.x*5.0-uTime*0.9*spd,q.y*70.0),0.9,0.32,1.0)*0.28
              +streak(vec2(q.x*3.0-uTime*1.5*spd,q.y*44.0),0.9,0.24,5.0)*0.42
              +streak(vec2(q.x*1.8-uTime*2.4*spd,q.y*24.0),0.9,0.14,9.0)*0.62;
      c+=(uSCol*1.7+vec3(0.04))*st*uSand*(0.6+0.4*gs);
      float vg=smoothstep(0.30,0.95,length((vUv-0.5)*vec2(1.15,1.0)*1.25));
      c=mix(c,c*vec3(0.62,0.44,0.28)+uSCol*0.15,vg*0.55*uSand);
     }
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

/* ---------- Resolução (fixa, automática pelo aparelho e dinâmica) ----------
   Altura-alvo = lado MENOR da tela, em pixels (nunca passa da resolução nativa).
   · Fixa (Baixa…Alta): RES_H[S.rq]; com "dinâmica" ligada ela pode cair em degraus (100% · 88% · 77% · 67%).
   · Automática (rq=5): parte do nível do aparelho (OWM.tier, core.js) e sobe/desce por uma escada de alturas conforme o FPS real.
   Trocar a resolução realoca todos os buffers (canvas, composer, névoa, bloom) e isso custa um soluço; por isso: poucos degraus, janelas de medição
   longas, pausa depois de cada troca, subida só após estabilidade (e cada subida que falha dobra a espera) e, se baixar não ganhou FPS (gargalo de CPU,
   tela limitada a 30 Hz…), volta atrás e para de tentar por um tempo. */
const RES_H=[480,550,640,740,1080],LADDER=[360,420,480,550,640,740,900,1080],AUTO_START=[2,4,5,6],AUTO_MAX=[4,5,6,7],FIX_SC=[1,.88,.77,.67];
const TIER=Math.max(0,Math.min(3,OWM.tier==null?1:OWM.tier));
let aIdx=AUTO_START[TIER],fIdx=0,curH=0;
const isAuto=()=>S.rq===5;
const natH=()=>Math.min(innerWidth,innerHeight)*(devicePixelRatio||1);
/* qualidade q: automática = índice da escada (maior = melhor); fixa = -fIdx (0 = melhor) */
const hOf=q=>Math.min(natH(),isAuto()?LADDER[q]:(RES_H[S.rq]||740)*FIX_SC[-q]);
const qNow=()=>isAuto()?aIdx:-fIdx;
const qLo=()=>isAuto()?0:-(FIX_SC.length-1),qHi=()=>isAuto()?AUTO_MAX[TIER]:0;
function setQ(q){if(isAuto())aIdx=q;else fIdx=-q;resize()}
function stepQ(dir){   // próximo q (dir=+1 sobe, -1 desce) que de fato muda a altura; null se não houver
 const q0=qNow(),h0=hOf(q0);
 for(let q=q0+dir;q>=qLo()&&q<=qHi();q+=dir)if(Math.abs(hOf(q)-h0)>2)return q;
 return null;
}
function resize(){
 const h=isAuto()?hOf(aIdx):hOf(-fIdx);curH=h;
 R.setPixelRatio(Math.max(.3,Math.min(devicePixelRatio||1,h/Math.min(innerWidth,innerHeight))));
 R.setSize(innerWidth,innerHeight,false);
 cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();
 if(composer){
  const pr=R.getPixelRatio();
  if(composer.setPixelRatio){composer.setPixelRatio(pr);composer.setSize(innerWidth,innerHeight)}
  else composer.setSize(innerWidth*pr,innerHeight*pr);
  for(const t of [composer.renderTarget1,composer.renderTarget2])if(t.depthTexture){t.depthTexture.image.width=t.width;t.depthTexture.image.height=t.height}
 }
}

/* controlador: chamado 1x por quadro de jogo (game.js) com o tempo real do quadro em ms */
const DY={n:0,sum:0,win:40,cool:0,dn:0,up:0,upNeed:10,lock:0,lockMs:60000,chk:null,t0:0,lastUp:-1e9,calib:true,ceil:99,ceilUntil:0,ceilMs:150000};
function dynReset(){DY.n=0;DY.sum=0;DY.cool=2;DY.dn=0;DY.up=0;DY.chk=null;DY.t0=0;DY.calib=true}
function sample(ms){
 if(!(ms>0)||ms>250){DY.n=0;DY.sum=0;return}   // aba em segundo plano / pausa longa: não conta
 if(!S.dyn){   // dinâmica desligada: volta pro degrau-base
  if((isAuto()?aIdx!==AUTO_START[TIER]:fIdx!==0)){aIdx=AUTO_START[TIER];fIdx=0;resize()}
  return;
 }
 const now=performance.now();if(!DY.t0)DY.t0=now;
 DY.n++;DY.sum+=ms;
 const calib=DY.calib&&now-DY.t0<12000;if(!calib)DY.calib=false;   // nos primeiros 12 s mede mais rápido e baixa de vez se estiver muito mal
 if(DY.n<(calib?20:DY.win))return;
 const fps=1000*DY.n/DY.sum;DY.n=0;DY.sum=0;
 if(DY.cool>0){DY.cool--;return}
 const T=60,q=qNow();
 if(DY.chk){   // conferência do último passo pra baixo
  const c=DY.chk;DY.chk=null;
  if(fps<c.fps*1.06&&fps<T*.9){setQ(c.q);DY.lock=now+DY.lockMs;DY.lockMs=Math.min(DY.lockMs*2,600000);DY.dn=0;DY.up=0;DY.cool=3;return}
  DY.lockMs=60000;
 }
 if(fps<T*.88){
  DY.up=0;DY.dn++;
  const severe=fps<T*.6;
  if((DY.dn>=(severe||calib?1:2))&&now>=DY.lock){
   let nq=stepQ(-1);
   if(nq!=null&&severe){const n2=nq-(isAuto()?1:1);if(n2>=qLo()){const t=hOf(n2);if(Math.abs(t-hOf(nq))>2)nq=n2}}
   if(nq!=null){
    if(now-DY.lastUp<20000){DY.upNeed=Math.min(DY.upNeed*2,90);DY.ceil=q;DY.ceilUntil=now+DY.ceilMs;DY.ceilMs=Math.min(DY.ceilMs*2,900000)}   // subiu há pouco e já não aguentou: esse degrau fica vetado por um tempo (cada falha dobra)
    DY.chk={q,fps};DY.dn=0;DY.cool=3;setQ(nq);
   }
  }
 }else if(fps>=T*.96){
  DY.dn=0;DY.up++;
  if(now-DY.lastUp>120000&&DY.upNeed>10){DY.upNeed=10;DY.ceilMs=150000}
  if(DY.up>=DY.upNeed){const nq=stepQ(1);DY.up=0;if(nq!=null&&!(now<DY.ceilUntil&&nq>=DY.ceil)){DY.lastUp=now;DY.cool=3;setQ(nq)}}
 }else{DY.dn=0;DY.up=0}
}
const info=()=>Math.round(R.getPixelRatio()*Math.min(innerWidth,innerHeight))+'p'+(S.rq===5?' auto':'');

function apply(far){
 scene.fog=new THREE.Fog(0xb8dbfa,far*.55,far*.97);FOGN0=far*.55;FOGF0=far*.97;sandFogD=false;
 cam.far=far+80;
 const k=.55+S.bright/100*.9;
 hemi.intensity=.9*k;
 sunLight.intensity=1.2*k;

 if(lt!==S.tone){lt=S.tone;R.toneMapping=TONES[S.tone]!==undefined?TONES[S.tone]:THREE.ReinhardToneMapping;refreshMaterials();}
 if(ls!==S.shadow){ls=S.shadow;shForce=true;const sz=ls===2?2048:1024;
  if(sunLight.shadow.mapSize.x!==sz){sunLight.shadow.mapSize.set(sz,sz);if(sunLight.shadow.map){sunLight.shadow.map.dispose();sunLight.shadow.map=null}}
  sunLight.castShadow=ls>0;
 }
 if(lf!==S.rq){lf=S.rq;DY.chk=null;DY.cool=2;resize();}
 vig.style.opacity=S.vig?1:0;
 bloomWant=!!S.bloom;if(bloomPass)bloomPass.enabled=bloomWant;
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

/* Sombra do sol: a câmera da luz é "grudada" na grade de texels do mapa (sem tremor quando o jogador anda) e o mapa só é regerado ~30x/s
   (R.shadowMap.autoUpdate=false). Posição/alvo da luz só mudam nesses quadros, então a matriz da sombra e o mapa ficam sempre consistentes.
   Entre uma regeração e outra a luz continua com a mesma direção (sunOff), só a posição fica meio quadro atrás. */
const SH_STEP=1/30-.003;let shAcc=1,shForce=true;
const sunOff=new THREE.Vector3(0,1,0),_zz=new THREE.Vector3(),_xx=new THREE.Vector3(),_yy=new THREE.Vector3(),_tt=new THREE.Vector3();
function updateShadowFrame(dt){
 shAcc+=dt;if(!shForce&&shAcc<SH_STEP)return;
 shAcc=0;shForce=false;
 const c=cam.position,xl=Math.hypot(sunOff.x,sunOff.z)/sunOff.length();
 _zz.copy(sunOff).normalize();
 if(xl>1e-4){   // mesma base que o lookAt do three usa na câmera da sombra (up = +Y)
  const ts=(sc.right-sc.left)/sunLight.shadow.mapSize.x;
  _xx.set(_zz.z,0,-_zz.x).normalize();_yy.crossVectors(_zz,_xx);
  _tt.set(0,0,0).addScaledVector(_xx,Math.round(c.dot(_xx)/ts)*ts).addScaledVector(_yy,Math.round(c.dot(_yy)/ts)*ts).addScaledVector(_zz,c.dot(_zz));
 }else _tt.copy(c);
 sunLight.target.position.copy(_tt);sunLight.position.copy(_tt).add(sunOff);
 sunLight.target.updateMatrixWorld();
 R.shadowMap.needsUpdate=true;
}
function updateCelestial(dt){
 dayTime=(dayTime+dt/DAY_DURATION)%1;
 const angle=dayTime*Math.PI*2;

 const sunX=Math.cos(angle)*SUN_DIST;
 const sunY=Math.sin(angle)*SUN_DIST;
 sunMesh.position.set(cam.position.x+sunX, cam.position.y+sunY, cam.position.z);
 moonMesh.position.set(cam.position.x-sunX, cam.position.y-sunY, cam.position.z);

 const sunHeight=Math.sin(angle);
 const dayFactor=Math.max(0,Math.min(1,(sunHeight+0.15)/0.5));

 sunOff.set(sunX,sunY,0);updateShadowFrame(dt);
 sunLight.intensity=(0.08+dayFactor*1.15)*(0.55+S.bright/100*0.9)*(1-.55*SAND.k);
 _sunColor.setHex(0xfff2dc).lerp(_dusk,Math.max(0,Math.min(1,1-sunHeight*2.2)));
 sunLight.color.copy(_sunColor);
 hemi.intensity=(0.12+dayFactor*0.85)*(0.55+S.bright/100*0.9)*(1-.15*SAND.k);

 let top,bot;
 if(sunHeight>0.25){const t=Math.max(0,1-(sunHeight-0.25)/0.35);top=_top.copy(dayTop).lerp(duskTop,t);bot=_bot.copy(dayBot).lerp(duskBot,t);}
 else if(sunHeight>-0.15){const t=(sunHeight+0.15)/0.4;top=_top.copy(duskTop).lerp(nightTop,1-t);bot=_bot.copy(duskBot).lerp(nightBot,1-t);}
 else{top=nightTop;bot=nightBot;}
 if(biomeT>.001&&dayFactor>0){const k=biomeT*.24*dayFactor;top.lerp(_pkTop,k);bot.lerp(_pkBot,k*1.25)}   // top/bot aqui são cópias (_top/_bot) quando dayFactor>0
 if(SAND.k>.001&&dayFactor>0){const k=SAND.k,b=.35+.65*dayFactor;top.lerp(_sdT.copy(_sdTop).multiplyScalar(b),k*.92);bot.lerp(_sdB.copy(_sdBot).multiplyScalar(b),k*.95)}   // céu e horizonte da cor da poeira (sem borda de névoa)
 skyMat.uniforms.topColor.value.copy(top);
 skyMat.uniforms.bottomColor.value.copy(bot);
 /* O céu escreve a cor "crua" (já em sRGB). Com o composer o passe final converte linear→sRGB,
    então o céu entra convertido para linear e sai igualzinho ao modo sem bloom. */
 if(useComposer()){skyMat.uniforms.topColor.value.convertSRGBToLinear();skyMat.uniforms.bottomColor.value.convertSRGBToLinear()}
 /* nuvens: brancas de dia, alaranjadas no pôr do sol, azul-escuro à noite; deslizam devagar */
 cloudT+=dt;
 _cl.setHex(0x1b2438).lerp(_clDay,dayFactor);
 _cl.lerp(_clDusk,Math.max(0,Math.min(1,1-sunHeight*2.2))*Math.min(1,dayFactor*2.2)*.7);
 if(SAND.k>.001)_cl.lerp(_sdCl,SAND.k*.7);
 _cs.copy(_cl).multiplyScalar(.72);
 skyMat.uniforms.cloudColor.value.copy(_cl);
 skyMat.uniforms.cloudShade.value.copy(_cs);
 skyMat.uniforms.cloudAmt.value=(.3+.7*dayFactor)*(1-.6*SAND.k);
 skyMat.uniforms.cloudTime.value=cloudT;
 if(useComposer()){skyMat.uniforms.cloudColor.value.convertSRGBToLinear();skyMat.uniforms.cloudShade.value.convertSRGBToLinear()}
 skyDome.position.copy(cam.position);

 /* sol mais forte e maior perto do horizonte */
 const hb=1+(1-Math.abs(sunHeight))*0.8;
 sunMat.color.setRGB(5*hb,4.5*hb*0.9,3*hb*0.6);if(SAND.k>.001)sunMat.color.multiplyScalar(1-.9*SAND.k);
 sunGlow.scale.set(sunGlow.userData.size*hb*(1-.65*SAND.k),sunGlow.userData.size*hb*(1-.65*SAND.k),1);
 moonMat.color.setRGB(2.5,2.7,3.2);

 starMat.opacity=Math.max(0,Math.min(1,(-sunHeight+0.2)/0.4))*(1-SAND.k);
 stars.position.copy(cam.position);
if(scene.fog){
  scene.fog.color.copy(bot);
  if(CHERRY_FOG.k>.001){
  const day=CHERRY_FOG.biome==='forest'?_forestFogSrgbDay:_chFogSrgbDay;
  const night=CHERRY_FOG.biome==='forest'?_forestFogSrgbNight:_chFogSrgbNight;
  _chFogSrgbMix.copy(day).lerp(night,CHERRY_FOG.night);scene.fog.color.lerp(_chFogSrgbMix,CHERRY_FOG.k*.78)
 }
 }
 if(scene.fog&&!(fogPass&&fogPass.enabled)){   // fallback linear de névoa quando o pós-processamento volumétrico está desligado
  const sandNear=FOGN0+(4-FOGN0)*SAND.k,sandFar=FOGF0+(46-FOGF0)*SAND.k;
  if(SAND.k>.001||CHERRY_FOG.k>.001){scene.fog.near=Math.min(sandNear,FOGN0*(1-.72*CHERRY_FOG.k));scene.fog.far=Math.min(sandFar,FOGF0*(1-.55*CHERRY_FOG.k));sandFogD=true}
  else if(sandFogD){scene.fog.near=FOGN0;scene.fog.far=FOGF0;sandFogD=false}
 }

 sunMesh.visible=sunHeight>-0.35;
 moonMesh.visible=sunHeight<0.35;
}

/* ---------- Tempestade de areia (estado vindo de sandstorm.js) ---------- */
const SAND={k:0,wx:1,wz:0};
const CHERRY_FOG={k:0,night:0,biome:'cherry'};
const _chFogDay=new THREE.Color(0xe9c8d7).convertSRGBToLinear(),_chFogNight=new THREE.Color(0x8790a7).convertSRGBToLinear(),_chFogMix=new THREE.Color(),_chFogSrgbDay=new THREE.Color(0xe9c8d7),_chFogSrgbNight=new THREE.Color(0x8790a7),_forestFogDay=new THREE.Color(0xe5e7e9).convertSRGBToLinear(),_forestFogNight=new THREE.Color(0x858d9b).convertSRGBToLinear(),_forestFogSrgbDay=new THREE.Color(0xe5e7e9),_forestFogSrgbNight=new THREE.Color(0x858d9b),_chFogSrgbMix=new THREE.Color();
const overlay=new THREE.Scene();   // desenhado DEPOIS da névoa/pós (grãos de areia): a névoa apagaria o que estivesse na cena principal
let FOGN0=60,FOGF0=100,sandFogD=false;
const _sandA=new THREE.Color(0xcf9a5e).convertSRGBToLinear(),_sa=new THREE.Color(),_sdTop=new THREE.Color(0xa87a48),_sdBot=new THREE.Color(0xcfa268),_sdCl=new THREE.Color(0xc8a070),_sdT=new THREE.Color(),_sdB=new THREE.Color(),_rs=new THREE.Vector2();
function setSand(k,wx,wz){SAND.k=k;SAND.wx=wx;SAND.wz=wz}
function setCherryFog(k,night=0,biome='cherry'){CHERRY_FOG.k=Math.max(0,Math.min(1,k||0));CHERRY_FOG.night=Math.max(0,Math.min(1,night||0));CHERRY_FOG.biome=biome==='forest'?'forest':'cherry'}
function sandAmb(){const sh=Math.sin(dayTime*Math.PI*2),df=Math.max(0,Math.min(1,(sh+.15)/.5));_sa.copy(_sandA).multiplyScalar(.1+.9*df)}   // cor da poeira (linear), escura à noite
function drawOverlay(){
 const ch=overlay.children;let on=false;for(let i=0;i<ch.length;i++)if(ch[i].visible){on=true;break}
 if(!on)return;
 const ac=R.autoClear;R.autoClear=false;R.render(overlay,cam);R.autoClear=ac;
}
function updateFog(dt){
 if(!fogPass||!fogPass.enabled)return;
 const u=fogPass.uniforms,sh=sunLight.shadow;
 fogTime+=dt;baseYs+=(groundY-baseYs)*(1-Math.exp(-dt*1.5));
 const sunH=Math.sin(dayTime*Math.PI*2),dayF=Math.max(0,Math.min(1,(sunH+.15)/.5));
 const golden=Math.max(0,Math.min(1,1-Math.abs(sunH)*3));          // amanhecer/entardecer: névoa mais densa
 u.time.value=fogTime;u.baseY.value=baseYs-1.5;
 u.dens.value=FOG.dens*(1+1.3*golden)*(S.vfog>1?1:.85)*(1+2.4*CHERRY_FOG.k);
 /* luz ambiente = cor do horizonte (já linear quando o composer está ativo); sol = cor da luz × dia */
 u.fogCol.value.copy(skyMat.uniforms.bottomColor.value).multiplyScalar(.55+.45*dayF);
 if(CHERRY_FOG.k>.001){
  const day=CHERRY_FOG.biome==='forest'?_forestFogDay:_chFogDay;
  const night=CHERRY_FOG.biome==='forest'?_forestFogNight:_chFogNight;
  _chFogMix.copy(day).lerp(night,CHERRY_FOG.night);u.fogCol.value.lerp(_chFogMix,CHERRY_FOG.k*.86)
 }
 _sc.copy(sunLight.color);if(!useComposer())_sc.convertSRGBToLinear();
 u.sunCol.value.copy(_sc).multiplyScalar(dayF*1.7);
 if(SAND.k>.001){u.fogCol.value.lerp(_sa,SAND.k*.88);u.sunCol.value.multiplyScalar(1-.5*SAND.k)}   // poeira ocre, sol quase apagado
 u.sand.value=SAND.k;u.sandDir.value.set(SAND.wx,SAND.wz);u.maxDist.value=FOG.maxDist*(1-.42*SAND.k)*(1-.58*CHERRY_FOG.k);   // névoa do cerejeiral corta o alcance distante, preservando a leitura de perto
 _sd.copy(sunLight.position).sub(sunLight.target.position).normalize();u.sunDir.value.copy(_sd);
 const useSh=S.vfog>1&&S.shadow>0&&sunLight.castShadow&&sh.map;
 u.useShadow.value=useSh?1:0;
 if(useSh){u.tShadow.value=sh.map.texture;u.shadowMat.value.copy(sh.matrix)}
}
function update(dt){dt=dt||0.016;if(SAND.k>.001)sandAmb();updateCelestial(dt);updateFog(dt);heatT+=dt;if(finPass){const fu=finPass.uniforms;fu.uTime.value=heatT;fu.uHeat.value=heatV;fu.uSand.value=SAND.k;if(SAND.k>.001)fu.uSCol.value.copy(_sa)}}
function setHeat(v){heatV=v}
let biomeT=0;function setBiome(v){biomeT=v}   // 0..1: peso do cerejeiral -> céu/névoa levemente rosados de dia
const _pkTop=new THREE.Color(0xe39ec2),_pkBot=new THREE.Color(0xffd6e4);
function setGround(y){groundY=y}
const _bv=new THREE.Vector3(),_bi=new THREE.Matrix4();
/* Só o sol (~5) e a lua (~2,7) passam do threshold do bloom; se nenhum está perto do quadro, o passe inteiro é pulado (margem 2x o quadro, a cauda do blur chega longe). */
function bodyNearScreen(m){
 if(!m.visible)return false;
 _bv.copy(m.position).applyMatrix4(_bi);if(_bv.z>=0)return false;
 const k=-_bv.z*Math.tan(cam.fov*Math.PI/360)*2;
 return Math.abs(_bv.y)<k&&Math.abs(_bv.x)<k*cam.aspect;
}
function render(){
 if(bloomPass){if(bloomWant){cam.updateMatrixWorld();_bi.copy(cam.matrixWorld).invert();bloomPass.enabled=bodyNearScreen(sunMesh)||bodyNearScreen(moonMesh)}else bloomPass.enabled=false}
 if(fogPass&&fogPass.enabled&&useComposer()){
  cam.updateMatrixWorld();const u=fogPass.uniforms;
  u.projInv.value.copy(cam.projectionMatrixInverse);u.camWorld.value.copy(cam.matrixWorld);u.camPos.value.setFromMatrixPosition(cam.matrixWorld);
 }
 if(finPass&&SAND.k>.001){   // direção do vento projetada na tela (eixo "direita" da câmera) + resolução, pros rastros
  cam.updateMatrixWorld();const e=cam.matrixWorld.elements;
  let fx=SAND.wx*e[0]+SAND.wz*e[2];if(Math.abs(fx)<.45)fx=fx<0?-.45:.45;
  finPass.uniforms.uFlow.value.set(fx,-.12);R.getDrawingBufferSize(_rs);finPass.uniforms.uRes.value.copy(_rs);
 }
 if(useComposer()){
  const chk=fogPass&&fogPass.enabled&&fogChecks<6,gl=chk?R.getContext():null;
  if(chk)gl.getError();                                   // limpa erros antigos
  composer.render();
  if(chk){fogChecks++;const e=gl.getError();
   if(e!==gl.NO_ERROR){fogBroken=true;fogPass.enabled=false;console.warn('[OWM] Névoa volumétrica desativada: erro de GL 0x'+e.toString(16)+' ao renderizar o passe.')}}
 }else R.render(scene,cam);
 drawOverlay();
}

addEventListener('resize',resize);resize();
OWM.post={sunOff,setBiome,setHeat,setSand,setCherryFog,overlay,apply,update,resize,render,setGround,sample,info,dynReset,skyDome,hemi,sunLight,sunMesh,moonMesh,bloomActive:useComposer,getNightFactor:()=>{const h=Math.sin(dayTime*Math.PI*2);return 1-Math.max(0,Math.min(1,(h+.15)/.5))}};
})();
