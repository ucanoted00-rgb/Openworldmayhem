/* Open World Mayhem — folhas e pétalas que caem quando a árvore é atingida / tomba.
   Um único THREE.Points com shader próprio (1 draw call, sem objeto por partícula):
   - cada partícula tem forma desenhada no fragment shader (folha, pétala de cerejeira ou agulha de pinheiro), gira no plano e "vira" a face
     (largura ~ |cos(flip)|), o que dá o balanço de folha de verdade;
   - física simples no CPU: arrasto até a velocidade terminal + vai-e-vem lateral (planeia e despenca), brisa leve e pouso no chão (some em ~1 s);
   - paleta por árvore: carvalho verde (ou amarelo/laranja se for a variação de outono), pinheiro verde (ou amarelado), morta = seca,
     cerejeira = pétalas rosa. Anel de MAX partículas: passou do limite, a mais antiga é reaproveitada (sem alocação, sem GC). */
(()=>{
const {scene,R,cam,post,touch}=OWM;
const MAX=touch?240:480;
const pos=new Float32Array(MAX*3),col=new Float32Array(MAX*3),dat=new Float32Array(MAX*4),typ=new Float32Array(MAX);
const vel=new Float32Array(MAX*3),ph=new Float32Array(MAX),rs=new Float32Array(MAX),fs=new Float32Array(MAX),life=new Float32Array(MAX),lmax=new Float32Array(MAX),
  gyc=new Float32Array(MAX),amp=new Float32Array(MAX),fall=new Float32Array(MAX),dly=new Float32Array(MAX),landed=new Uint8Array(MAX);
let head=0,frame=0,wt=0,gH=null,pts=null,mat=null,dirty=false;
const _v2=new THREE.Vector2();

const VERT=`
attribute vec3 aCol;attribute vec4 aD;attribute float aT;
uniform float uScale;
varying vec3 vCol;varying vec4 vD;varying float vT;
void main(){
 vec4 mv=modelViewMatrix*vec4(position,1.);
 gl_Position=projectionMatrix*mv;
 float z=-mv.z;
 if(aD.w<.001||z<.2){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;vCol=vec3(0.);vD=vec4(0.);vT=0.;return;}
 gl_PointSize=clamp(aD.x*uScale/z,2.,46.);
 vCol=aCol;vD=aD;vT=aT;
}`;
const FRAG=`
uniform float uLight;
varying vec3 vCol;varying vec4 vD;varying float vT;
void main(){
 vec2 p=gl_PointCoord*2.-1.;p.y=-p.y;
 float cr=cos(vD.y),sr=sin(vD.y);
 p=vec2(cr*p.x+sr*p.y,-sr*p.x+cr*p.y);
 float f=cos(vD.z);                      // a folha vira: face de frente ↔ de lado
 p.x/=max(abs(f),.16);
 float a=0.,shade=1.;
 vec3 base=pow(vCol,vec3(2.2));
 if(vT<.5){                              // folha (ponta fina, nervura central)
  float hw=.5*pow(max(1.-p.y*p.y,0.),.75)*(1.-.28*p.y);
  a=(1.-smoothstep(hw-.05,hw+.02,abs(p.x)))*step(abs(p.y),.98);
  shade-=(1.-smoothstep(0.,.07,abs(p.x)))*smoothstep(-.95,-.4,p.y)*.30;
 }else if(vT<1.5){                       // pétala de cerejeira (gota arredondada com entalhe)
  vec2 q=vec2(p.x*1.05,p.y*.92-.04);
  a=1.-smoothstep(.70,.86,length(q));
  a*=1.-.9*(1.-smoothstep(0.,.17,abs(p.x)))*smoothstep(.45,.8,p.y);
  base=mix(base*vec3(1.,.80,.88),base,smoothstep(-.8,.7,p.y));
 }else{                                  // agulha/folha estreita (pinheiro)
  float hw=.2*pow(max(1.-p.y*p.y,0.),.6);
  a=(1.-smoothstep(hw-.04,hw+.02,abs(p.x)))*step(abs(p.y),.98);
 }
 shade*=f>0.?1.:.78;                     // verso um pouco mais escuro
 a*=vD.w;
 if(a<.03)discard;
 vec3 c=base*shade*uLight*1.18+base*.10;
 gl_FragColor=linearToOutputTexel(vec4(c,a));
}`;

function build(){
 const g=new THREE.BufferGeometry();
 const at=(n,arr,sz)=>{const b=new THREE.BufferAttribute(arr,sz);b.setUsage(THREE.DynamicDrawUsage);g.setAttribute(n,b)};
 at('position',pos,3);at('aCol',col,3);at('aD',dat,4);at('aT',typ,1);
 mat=new THREE.ShaderMaterial({uniforms:{uScale:{value:500},uLight:{value:1}},vertexShader:VERT,fragmentShader:FRAG,transparent:true,depthWrite:false,depthTest:true});
 pts=new THREE.Points(g,mat);pts.frustumCulled=false;pts.renderOrder=3;scene.add(pts);
}

/* ---------- Paletas (sRGB 0..1) ---------- */
const PAL={
 cherry:[[1,.83,.89],[.97,.67,.79],[1,.91,.94],[.94,.57,.73]],
 oak:[[.44,.70,.21],[.36,.61,.16],[.54,.77,.27],[.29,.53,.14]],
 oakDark:[[.26,.46,.17],[.21,.39,.14],[.31,.51,.18]],
 autumn:[[.94,.73,.16],[.88,.56,.10],[.97,.83,.33],[.79,.43,.08]],
 spruce:[[.21,.46,.25],[.17,.39,.21],[.29,.53,.28],[.39,.56,.21]],
 spruceY:[[.83,.77,.21],[.71,.71,.17],[.91,.85,.37],[.56,.67,.17]],
 dead:[[.78,.64,.28],[.62,.50,.20],[.85,.72,.40],[.50,.40,.18]]
};
const tintPal=(pal,t)=>pal.map(c=>[Math.min(1,c[0]*Math.pow(t[0],.6)),Math.min(1,c[1]*Math.pow(t[1],.6)),Math.min(1,c[2]*Math.pow(t[2],.6))]);
/* tipo: 0 folha, 1 pétala, 2 agulha. n = fator de quantidade, s = faixa de tamanho em metros */
function palette(k,tint){
 const t=tint||[1,1,1];
 if(k==='cherry')return{pal:PAL.cherry,type:1,n:1.1,s:[.12,.21],fall:[.55,.95]};
 if(k==='oak'){
  if(t[0]>1.5)return{pal:PAL.autumn,type:0,n:1.1,s:[.14,.25],fall:[.85,1.4]};
  if(t[0]<.85)return{pal:PAL.oakDark,type:0,n:1,s:[.14,.25],fall:[.9,1.45]};
  return{pal:tintPal(PAL.oak,t),type:0,n:1,s:[.14,.25],fall:[.9,1.45]};
 }
 if(k==='spruce'){
  if(t[2]<.7&&t[0]>1.2)return{pal:PAL.spruceY,type:2,n:1,s:[.13,.22],fall:[.9,1.5]};
  return{pal:tintPal(PAL.spruce,t),type:2,n:1,s:[.13,.22],fall:[.9,1.5]};
 }
 return{pal:PAL.dead,type:0,n:.3,s:[.12,.21],fall:[.8,1.3]};   // árvores mortas: poucas folhas secas
}
/* Volume da copa a partir do colisor da árvore (c.x, c.z, c.y0, c.hy, c.hx, c.hz, c.k) */
function canopy(c){   // c.hx/c.hz = só o tronco (0,4 m): a copa vem da altura (medida nas malhas: carvalho r≈.30·h, pinheiro r≈.24·h, cerejeira r≈.46·h)
 const hy=c.hy,sx=Math.max(.6,Math.min(1.5,(c.hx||.4)/.4));
 if(c.k==='spruce'||c.k==='deadspruce')return{x:c.x,y:c.y0+hy*.65,z:c.z,rx:hy*.24*sx,ry:hy*.28,cone:true};
 if(c.k==='cherry')return{x:c.x,y:c.y0+hy*.64,z:c.z,rx:hy*.46,ry:hy*.24,cone:false};
 return{x:c.x,y:c.y0+hy*.68,z:c.z,rx:hy*.30*sx,ry:hy*.26,cone:false};
}

function spawn(x,y,z,vx,vy,vz,P,spread){
 const i=head;head=(head+1)%MAX;const o=i*3,r=Math.random;
 pos[o]=x;pos[o+1]=y;pos[o+2]=z;vel[o]=vx;vel[o+1]=vy;vel[o+2]=vz;
 const c=P.pal[(r()*P.pal.length)|0],b=.82+r()*.36;
 col[o]=Math.min(1,c[0]*b);col[o+1]=Math.min(1,c[1]*b);col[o+2]=Math.min(1,c[2]*b);
 const d=i*4;dat[d]=P.s[0]+r()*(P.s[1]-P.s[0]);dat[d+1]=r()*6.283;dat[d+2]=r()*6.283;dat[d+3]=.001;
 typ[i]=P.type;ph[i]=r()*6.283;amp[i]=.5+r()*.9;fall[i]=P.fall[0]+r()*(P.fall[1]-P.fall[0]);
 rs[i]=(r()-.5)*2.8;fs[i]=1.6+r()*2.8;landed[i]=0;dly[i]=r()*spread;
 gyc[i]=gH?gH(x,z):y-8;
 const h=Math.max(0,y-gyc[i]);
 lmax[i]=life[i]=Math.min(14,h/(.7*fall[i])+1.4);   // o atraso (dly) não gasta vida: o fade-in começa quando a folha aparece
 dirty=true;
}
/* Rajada de folhas dentro do volume da copa. o: {x,y,z,rx,ry,cone}, P: paleta, n: quantidade */
function burst(o,P,n,opt){
 if(!pts)build();opt=opt||{};
 const out=opt.out||1,up=opt.up||0,spread=opt.spread==null?.35:opt.spread,r=Math.random;
 for(let k=0;k<n;k++){
  let ox,oy,oz;
  if(o.cone){const t=.15+.8*r(),rr=o.rx*(1.05-t)*Math.sqrt(r()),a=r()*6.283;ox=Math.cos(a)*rr;oz=Math.sin(a)*rr;oy=(t-.5)*2*o.ry}
  else{const a=r()*6.283,u=r()*2-1,q=Math.cbrt(r()),s=Math.sqrt(1-u*u);ox=s*Math.cos(a)*q*o.rx;oz=s*Math.sin(a)*q*o.rx;oy=u*q*o.ry}
  const hl=Math.hypot(ox,oz)||1,sp=(.3+r()*1.4)*out;
  spawn(o.x+ox,o.y+oy,o.z+oz,ox/hl*sp+(r()-.5)*.8,(r()-.25)*1.5+up,oz/hl*sp+(r()-.5)*.8,P,spread);
 }
}
/* Soco na árvore: chuva de folhas da copa */
function hit(c,P,mult){const n=Math.round((touch?15:26)*P.n*(mult||1));burst(canopy(c),P,n,{out:1,spread:.4})}
/* Árvore tombando: a copa vai soltando folhas pelo caminho (rate em folhas/s) */
const _q=new THREE.Vector3();
function fallEmit(f,dt){
 if(!f.pal)return;
 f.lacc=(f.lacc||0)+dt*(touch?38:62)*f.pal.n;
 const n=Math.floor(f.lacc);if(n<=0)return;f.lacc-=n;
 const c=f.c,cn=canopy(c),h=cn.y-c.y0;
 _q.set(0,h,0).applyQuaternion(f.g.quaternion).add(f.g.position);
 burst({x:_q.x,y:_q.y,z:_q.z,rx:cn.rx*.8,ry:Math.max(.6,cn.ry*.7),cone:cn.cone},f.pal,n,{out:.7,spread:.05});
}
/* Tronco bateu no chão: a copa se desmancha */
function landBurst(f){
 if(!f.pal)return;const c=f.c,cn=canopy(c);
 for(const d of[.55,.82]){
  const x=c.x+f.dx*c.hy*d,z=c.z+f.dz*c.hy*d;
  burst({x,y:c.y0+.8,z,rx:cn.rx*.85,ry:.9,cone:false},f.pal,Math.round((touch?22:38)*f.pal.n),{out:1.6,up:1.2,spread:.25});
 }
}

function update(dt){
 if(!pts)return;
 frame++;wt+=dt;
 let any=false;
 const bx=Math.sin(wt*.21)*.3+.45,bz=Math.cos(wt*.17)*.22+.15;   // brisa suave
 for(let i=0;i<MAX;i++){
  if(life[i]<=0)continue;
  any=true;const o=i*3,d=i*4;
  if(dly[i]>0){dly[i]-=dt;dat[d+3]=0;continue}
  const l=life[i]-dt;life[i]=l;
  if(l<=0){dat[d+3]=0;dirty=true;continue}
  if(!landed[i]){
   ph[i]+=dt*(2.3+amp[i]);
   const tvx=bx+Math.sin(ph[i])*amp[i]*.95,tvz=bz+Math.cos(ph[i]*.83)*amp[i]*.8,
         tvy=-fall[i]*(.8+.35*Math.sin(ph[i]*2.1+1.3));               // planeia e despenca em ondas
   const k=1-Math.exp(-dt*1.9);
   vel[o]+=(tvx-vel[o])*k;vel[o+1]+=(tvy-vel[o+1])*k;vel[o+2]+=(tvz-vel[o+2])*k;
   pos[o]+=vel[o]*dt;pos[o+1]+=vel[o+1]*dt;pos[o+2]+=vel[o+2]*dt;
   dat[d+1]+=rs[i]*dt;dat[d+2]+=fs[i]*dt*(.6+.4*Math.abs(Math.sin(ph[i])));
   if(gH&&((frame+i)&3)===0)gyc[i]=gH(pos[o],pos[o+2]);
   if(pos[o+1]<=gyc[i]+.04){pos[o+1]=gyc[i]+.04;landed[i]=1;dat[d+2]=0;life[i]=Math.min(life[i],.7+Math.random()*.9)}
  }
  const age=lmax[i]-l;
  dat[d+3]=Math.min(1,age/.18)*Math.min(1,life[i]/.7);
  dirty=true;
 }
 if(dirty||any){
  const g=pts.geometry.attributes;g.position.needsUpdate=g.aD.needsUpdate=g.aCol.needsUpdate=g.aT.needsUpdate=true;dirty=false;
 }
 R.getDrawingBufferSize(_v2);
 mat.uniforms.uScale.value=_v2.y/(2*Math.tan(cam.fov*Math.PI/360));
 mat.uniforms.uLight.value=Math.max(.14,Math.min(1.05,.16+(post.hemi?post.hemi.intensity:.8)*.85));
}
function reset(){life.fill(0);dat.fill(0);dirty=true;if(pts)update(0)}

OWM.leaves={setGround:f=>{gH=f},palette,canopy,burst,hit,fallEmit,landBurst,update,reset};
})();
