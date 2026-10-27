/* Open World Mayhem — player low poly (SkinnedMesh).
   Esqueleto: hip > upper > (hm, LA>LE, RA>RE) e hip > (LL>LK, RL>RK). Rotação (0,0,0) = pose de repouso (modelo em pose A).
   O animeditor edita LA/RA/LL/RL/hm; cotovelos (LE/RE) e joelhos (LK/RK) são automáticos (dobram conforme o balanço do membro).
   Animação procedural dinâmica (andar/correr, strafe, inclinação, torção do tronco, pulo, pouso com mola,
   respiração, golpe ao minerar, tranco ao tomar dano) + animações do editor (localStorage 'bc.anims').
   Frente do modelo = +Z. Rot X negativa = membro vai pra frente.
   Convenções (espaço local do modelo): +X em volta do eixo X = inclina pra frente; +Z em volta de Z = inclina pra direita do jogador. */
(()=>{
const {scene,cam,ld}=OWM;
const LP=OWM.lp,SK=OWM.skin;
if(!LP)console.error('[OWM] lowpoly.js não carregado — o personagem não vai aparecer.');
const HIP=LP?LP.hipY:.845;                  // altura do quadril = comprimento da perna
const STRIDE=.705/HIP;                      // pernas mais longas → passada com fase mais lenta (evita o pé "patinar")

/* ---------- Materiais (cores vêm do skin.js) ---------- */
const SLOTS=['skin','hair','shirt','pants','shoes'];
const mats={};
SLOTS.forEach(n=>{mats[n]=new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide,skinning:true})});   // r128 exige skinning:true (inclusive pra sombra)
if(SK&&SK.listen)SK.listen(c=>SLOTS.forEach(n=>{if(c[n])mats[n].color.set(c[n]).convertSRGBToLinear()}));

/* ---------- Rig ---------- */
const av=new THREE.Group();av.name='LowPolyAvatar';av.visible=false;scene.add(av);
const B={},list=[];
if(LP)LP.order.forEach(n=>{
 const [par,p]=LP.bones[n],b=new THREE.Bone();b.name=n;b.position.set(p[0],p[1],p[2]);
 (par?B[par]:av).add(b);B[n]=b;list.push(b);
});
const hip=B.hip||new THREE.Group(),upper=B.upper||new THREE.Group();
av.updateMatrixWorld(true);
/* ---------- Malha (subdividida) + física de roupa ----------
   Qualidade do modelo: 0 = original, 1 = subdivisão 4x, 2 = subdivisão 16x. As subdivisões preservam os pesos de skin.
   Roupa (camisa e calça): simulação em espaço de mundo (Verlet). Cada vértice tem uma "liberdade" (0 = preso ao corpo, 1 = solto, ex.: barra da
   camisa). A posição pele-esqueleto (âncora) é calculada na CPU; o vértice segue a âncora por uma mola, balança com a inércia do movimento,
   é suavizado com os vizinhos, limitado a um raio máximo e impedido de entrar no corpo. O deslocamento vai pra GPU num atributo
   (clothOff) somado depois do skinning. Em 1ª pessoa o corpo está escondido, então a simulação pausa. */
let sk=null,meshes=[],cloths=[];
const CLOTH={shirt:{maxR:.035,kMin:190,kMax:310,dr:.42,smooth:.48,grav:.025},pants:{maxR:.014,kMin:230,kMax:340,dr:.45,smooth:.52,grav:.012}};
const bindPos={};   // posição de cada osso na pose de repouso (espaço do modelo)
list.forEach(b=>{const w=new THREE.Vector3();b.getWorldPosition(w);bindPos[b.name]=w});
const SEG={hip:'hm',upper:'hm',hm:null,LA:'LE',RA:'RE',LE:null,RE:null,LL:'LK',RL:'RK',LK:null,RK:null};   // eixo (osso → próximo osso) usado como "núcleo" do corpo; sem próximo osso, continua a direção do osso pai
const BIDX=LP?LP.order:[];
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};

function clothFreedom(name,bn,x,y,z,domBone){
 if(name==='shirt'){
  let f=sstep(1.3,.99,y);                                   // barra solta, peito preso
  if(domBone==='LA'||domBone==='RA'||domBone==='LE'||domBone==='RE'){const sh=bindPos[domBone[0]+'A'];f=Math.max(f*.6,sstep(.05,.2,Math.hypot(x-sh.x,y-sh.y,z-sh.z))*.55)}   // fim das mangas
  return f;
 }
 return sstep(.62,.12,y)*.55;                                // calça: só a barra de baixo balança um pouco
}

function buildCloth(name,mesh,M){
 const cfg=CLOTH[name],n=M.pos.length/3,fr=new Float32Array(n),dom=new Uint8Array(n),core=new Float32Array(n*3);
 let cnt=0;
 for(let i=0;i<n;i++){
  let bi=0,bw=-1;for(let q=0;q<4;q++)if(M.sw[i*4+q]>bw){bw=M.sw[i*4+q];bi=M.si[i*4+q]}
  const bn=BIDX[bi],x=M.pos[i*3],y=M.pos[i*3+1],z=M.pos[i*3+2];
  dom[i]=bi;fr[i]=clothFreedom(name,bn,x,y,z,bn);if(fr[i]>.01)cnt++;
  /* núcleo: ponto mais próximo do eixo do osso dominante (pose de repouso) */
  const p0=bindPos[bn],nx=SEG[bn],par=LP.bones[bn][0],p1=nx?bindPos[nx]:(par?p0.clone().multiplyScalar(2).sub(bindPos[par]):p0.clone().add(new THREE.Vector3(0,.15,0)));
  const ax=p1.x-p0.x,ay=p1.y-p0.y,az=p1.z-p0.z,al=ax*ax+ay*ay+az*az||1,t=clamp(((x-p0.x)*ax+(y-p0.y)*ay+(z-p0.z)*az)/al,0,1);
  core[i*3]=p0.x+ax*t;core[i*3+1]=p0.y+ay*t;core[i*3+2]=p0.z+az*t;
 }
 if(!cnt)return null;
 /* vizinhos (CSR) */
 const nb=Array.from({length:n},()=>new Set()),F=M.idx;
 for(let f=0;f<F.length;f+=3){const a=F[f],b=F[f+1],c=F[f+2];nb[a].add(b);nb[a].add(c);nb[b].add(a);nb[b].add(c);nb[c].add(a);nb[c].add(b)}
 const nOff=new Uint32Array(n+1);for(let i=0;i<n;i++)nOff[i+1]=nOff[i]+nb[i].size;
 const nIdx=new Uint32Array(nOff[n]);for(let i=0;i<n;i++){let o=nOff[i];for(const j of nb[i])nIdx[o++]=j}
 /* lista de vértices dinâmicos */
 const act=[];for(let i=0;i<n;i++)if(fr[i]>.01)act.push(i);
 const A=Int32Array.from(act);
 const attr=new THREE.BufferAttribute(new Float32Array(n*3),3);attr.setUsage(THREE.DynamicDrawUsage);
 mesh.geometry.setAttribute('clothOff',attr);
 const radial=new Float32Array(n);   // distância âncora–núcleo (raio do corpo naquele ponto)
 return{name,mesh,M,n,cfg,fr,dom,core,nOff,nIdx,A,attr,
  P:new Float32Array(n*3),Pp:new Float32Array(n*3),An:new Float32Array(n*3),Anp:new Float32Array(n*3),Co:new Float32Array(n*3),Of:new Float32Array(n*3),Of2:new Float32Array(n*3),radial,init:false};
}

/*
 * Skinning que preserva volume. O skinning linear clássico mistura matrizes de rotação:
 * quando braço/perna gira, a região entre os ossos pode afinar (efeito "candy wrapper").
 * Dual-quaternion skinning mistura rotação + translação como um único movimento rígido.
 * Isso não altera a malha base nem as animações; reduz o efeito de borracha nas articulações.
 */
const DQ_HELPERS = `
vec4 owmDQMul(vec4 a, vec4 b) {
 return vec4(a.w*b.xyz + b.w*a.xyz + cross(a.xyz,b.xyz), a.w*b.w - dot(a.xyz,b.xyz));
}
vec4 owmDQConj(vec4 q) { return vec4(-q.xyz, q.w); }
vec4 owmDQFromMat3(mat3 m) {
 float m00=m[0][0], m01=m[1][0], m02=m[2][0];
 float m10=m[0][1], m11=m[1][1], m12=m[2][1];
 float m20=m[0][2], m21=m[1][2], m22=m[2][2];
 float tr=m00+m11+m22;
 vec4 q;
 if(tr>0.0){
  float s=sqrt(max(tr+1.0,0.000001))*2.0;
  q=vec4((m21-m12)/s,(m02-m20)/s,(m10-m01)/s,0.25*s);
 }else if(m00>m11 && m00>m22){
  float s=sqrt(max(1.0+m00-m11-m22,0.000001))*2.0;
  q=vec4(0.25*s,(m01+m10)/s,(m02+m20)/s,(m21-m12)/s);
 }else if(m11>m22){
  float s=sqrt(max(1.0+m11-m00-m22,0.000001))*2.0;
  q=vec4((m01+m10)/s,0.25*s,(m12+m21)/s,(m02-m20)/s);
 }else{
  float s=sqrt(max(1.0+m22-m00-m11,0.000001))*2.0;
  q=vec4((m02+m20)/s,(m12+m21)/s,0.25*s,(m10-m01)/s);
 }
 return normalize(q);
}
vec3 owmDQRotate(vec4 q, vec3 v) { return v + 2.0*cross(q.xyz, cross(q.xyz,v)+q.w*v); }
vec3 owmDQTransform(vec4 realQ, vec4 dualQ, vec3 p) {
 vec3 tr=2.0*owmDQMul(dualQ,owmDQConj(realQ)).xyz;
 return owmDQRotate(realQ,p)+tr;
}
`;
function patchSkinningMat(m,withCloth){
 m.onBeforeCompile=sh=>{
  sh.vertexShader=sh.vertexShader.replace('#include <common>', '#include <common>\n'+(withCloth?'attribute vec3 clothOff;\n':'')+DQ_HELPERS);
  sh.vertexShader=sh.vertexShader.replace('#include <skinnormal_vertex>', `
#ifdef USE_SKINNING
 vec4 owmNormalReal = vec4(0.0), owmNormalRef = vec4(0.0,0.0,0.0,1.0);
 float owmNormalHasRef = 0.0;
 for (int owmNI=0; owmNI<4; owmNI++) {
  float owmNW = skinWeight[owmNI];
  if (owmNW > 0.00001) {
   vec4 owmNQ = owmDQFromMat3(mat3(getBoneMatrix(skinIndex[owmNI])));
   if (owmNormalHasRef < 0.5) { owmNormalRef = owmNQ; owmNormalHasRef = 1.0; }
   if (dot(owmNQ, owmNormalRef) < 0.0) owmNQ = -owmNQ;
   owmNormalReal += owmNQ * owmNW;
  }
 }
 float owmNormalLen = length(owmNormalReal);
 if (owmNormalLen > 0.00001) {
  owmNormalReal /= owmNormalLen;
  /* bindMatrix is identity on this rig; cancel the avatar's world rotation just as
     the standard skinnormal_vertex chunk does before modelView transforms the normal. */
  vec4 owmBindInvQ = owmDQFromMat3(mat3(bindMatrixInverse));
  objectNormal = normalize(owmDQRotate(owmDQMul(owmBindInvQ, owmNormalReal), objectNormal));
 }
#endif
`);
  sh.vertexShader=sh.vertexShader.replace('#include <skinning_vertex>', `
#ifdef USE_SKINNING
 vec4 owmSkinVertex = bindMatrix * vec4(transformed, 1.0);
 vec4 owmRealSum = vec4(0.0), owmDualSum = vec4(0.0), owmRef = vec4(0.0,0.0,0.0,1.0);
 float owmHasRef = 0.0;
 for (int owmI=0; owmI<4; owmI++) {
  float owmW = skinWeight[owmI];
  if (owmW > 0.00001) {
   mat4 owmBone = getBoneMatrix(skinIndex[owmI]);
   vec4 owmR = owmDQFromMat3(mat3(owmBone));
   vec4 owmD = 0.5 * owmDQMul(vec4(owmBone[3].xyz, 0.0), owmR);
   if (owmHasRef < 0.5) { owmRef = owmR; owmHasRef = 1.0; }
   if (dot(owmR, owmRef) < 0.0) { owmR = -owmR; owmD = -owmD; }
   owmRealSum += owmR * owmW;
   owmDualSum += owmD * owmW;
  }
 }
 float owmLen = length(owmRealSum);
 if (owmLen > 0.00001) {
  owmRealSum /= owmLen;
  owmDualSum /= owmLen;
  owmDualSum -= owmRealSum * dot(owmRealSum, owmDualSum);
  transformed = (bindMatrixInverse * vec4(owmDQTransform(owmRealSum, owmDualSum, owmSkinVertex.xyz), 1.0)).xyz;
 }
#endif
${withCloth?'transformed += clothOff;':''}
`);
 };
 m.customProgramCacheKey=()=>'owm-dq-skin-v1'+(withCloth?'-cloth':'-solid');
}
SLOTS.forEach(n=>patchSkinningMat(mats[n],!!CLOTH[n]));

const _m4=new THREE.Matrix4(),_v=new THREE.Vector3(),_iq=new THREE.Quaternion();
const BM=UABM();function UABM(){return LP?LP.order.map(()=>new THREE.Matrix4()):[]}
const DQBone=LP?LP.order.map(()=>({q:new THREE.Quaternion(),pos:new THREE.Vector3(),scale:new THREE.Vector3(),d:[0,0,0,0]})):[];
const _dqBP=new THREE.Vector3();
function updateDQBone(i){
 const D=DQBone[i],bn=BIDX[i],bp=bindPos[bn];BM[i].decompose(D.pos,D.q,D.scale);
 /* O dual quaternion representa R*(p-bindPos)+pos, que é a transformação de skin deste rig. */
 _dqBP.copy(bp).applyQuaternion(D.q);
 const tx=D.pos.x-_dqBP.x,ty=D.pos.y-_dqBP.y,tz=D.pos.z-_dqBP.z,qx=D.q.x,qy=D.q.y,qz=D.q.z,qw=D.q.w;
 D.d[0]=.5*(tx*qw+ty*qz-tz*qy);
 D.d[1]=.5*(ty*qw+tz*qx-tx*qz);
 D.d[2]=.5*(tz*qw+tx*qy-ty*qx);
 D.d[3]=-.5*(tx*qx+ty*qy+tz*qz);
}
function skinPoint(M,i,src,out,o,bm){
 /* Mesmo dual-quaternion skinning do shader; mantém roupa alinhada à malha do corpo. */
 const x=src[o],y=src[o+1],z=src[o+2];let rx=0,ry=0,rz=0,rw=0,dx=0,dy=0,dz=0,dw=0,rrx=0,rry=0,rrz=0,rrw=1,hasRef=false;
 for(let q=0;q<4;q++){
  const w=M.sw[i*4+q];if(w<=0)continue;
  const D=DQBone[M.si[i*4+q]],bq=D.q,bd=D.d;let qx=bq.x,qy=bq.y,qz=bq.z,qw=bq.w,vx=bd[0],vy=bd[1],vz=bd[2],vw=bd[3];
  if(!hasRef){rrx=qx;rry=qy;rrz=qz;rrw=qw;hasRef=true}
  if(qx*rrx+qy*rry+qz*rrz+qw*rrw<0){qx=-qx;qy=-qy;qz=-qz;qw=-qw;vx=-vx;vy=-vy;vz=-vz;vw=-vw}
  rx+=qx*w;ry+=qy*w;rz+=qz*w;rw+=qw*w;dx+=vx*w;dy+=vy*w;dz+=vz*w;dw+=vw*w;
 }
 const len=Math.hypot(rx,ry,rz,rw)||1;rx/=len;ry/=len;rz/=len;rw/=len;dx/=len;dy/=len;dz/=len;dw/=len;
 const proj=rx*dx+ry*dy+rz*dz+rw*dw;dx-=rx*proj;dy-=ry*proj;dz-=rz*proj;dw-=rw*proj;
 const tx=2*(rw*dx-dw*rx-dy*rz+dz*ry),ty=2*(rw*dy-dw*ry-dz*rx+dx*rz),tz=2*(rw*dz-dw*rz-dx*ry+dy*rx);
 _v.set(x,y,z).applyQuaternion(_iq.set(rx,ry,rz,rw));
 out[o]=_v.x+tx;out[o+1]=_v.y+ty;out[o+2]=_v.z+tz;
}

function clothStep(C,dt,reset){
 const {M,cfg,fr,A,P,Pp,An,Anp,Co,Of,Of2,radial,nOff,nIdx,core}=C,pos=M.pos;
 const bm=BM;
 /* âncoras (pele no esqueleto) e núcleos, em mundo — só dos vértices dinâmicos */
 for(let k=0;k<A.length;k++){
  const i=A[k],o=i*3;
  skinPoint(M,i,pos,An,o,bm);
  /* núcleo segue SÓ o osso dominante */
  const bi=C.dom[i],e=bm[bi].elements,bp=bindPos[BIDX[bi]],dx=core[o]-bp.x,dy=core[o+1]-bp.y,dz=core[o+2]-bp.z;
  Co[o]=e[0]*dx+e[4]*dy+e[8]*dz+e[12];Co[o+1]=e[1]*dx+e[5]*dy+e[9]*dz+e[13];Co[o+2]=e[2]*dx+e[6]*dy+e[10]*dz+e[14];
  if(reset||!C.init){P[o]=Pp[o]=Anp[o]=An[o];P[o+1]=Pp[o+1]=Anp[o+1]=An[o+1];P[o+2]=Pp[o+2]=Anp[o+2]=An[o+2]}
  radial[i]=Math.hypot(An[o]-Co[o],An[o+1]-Co[o+1],An[o+2]-Co[o+2]);
 }
 C.init=true;
 /* passo variável: subpassos de no máx. 1/60 s; a âncora é interpolada entre o quadro anterior e o atual (funciona igual em 30/60/144 Hz) */
 const gain=.3+.7*sstep(3.2,6.5,CL.sp||0);   // andando o pano quase não balança; só ganha amplitude ao correr
 dt=Math.min(dt,.05);const ns=Math.max(1,Math.ceil(dt/(1/60))),h=dt/ns,h2=h*h,dk=Math.pow(1-cfg.dr,h*60);   // dk = fração da velocidade relativa que sobra por subpasso
 for(let s=0;s<ns;s++){
  const u0=s/ns,u1=(s+1)/ns;
  for(let k=0;k<A.length;k++){
   const i=A[k],o=i*3,f=fr[i],kk=cfg.kMax+(cfg.kMin-cfg.kMax)*f;
   for(let c=0;c<3;c++){
    const a0=Anp[o+c]+(An[o+c]-Anp[o+c])*u0,a1=Anp[o+c]+(An[o+c]-Anp[o+c])*u1;   // âncora no início/fim do subpasso
    let v=P[o+c]-Pp[o+c];const va=a1-a0;
    v=va+(v-va)*dk;                         // amortecimento relativo à âncora: movimento uniforme não arrasta o pano
    Pp[o+c]=P[o+c];
    let a=(a1-P[o+c])*kk;if(c===1)a-=9.8*cfg.grav*f;
    P[o+c]+=v+a*h2;
   }
  }
  /* deslocamentos atuais (em relação à âncora do fim do subpasso) */
  for(let k=0;k<A.length;k++){const o=A[k]*3;for(let c=0;c<3;c++)Of[o+c]=P[o+c]-(Anp[o+c]+(An[o+c]-Anp[o+c])*u1)}
  for(let it=0;it<2;it++){
   for(let k=0;k<A.length;k++){
    const i=A[k],o=i*3,s0=nOff[i],e=nOff[i+1],cnt=e-s0;let sx=0,sy=0,sz=0;
    for(let q=s0;q<e;q++){const j=nIdx[q]*3;sx+=Of[j];sy+=Of[j+1];sz+=Of[j+2]}
    const m=cfg.smooth;
    Of2[o]=Of[o]+(sx/cnt-Of[o])*m;Of2[o+1]=Of[o+1]+(sy/cnt-Of[o+1])*m;Of2[o+2]=Of[o+2]+(sz/cnt-Of[o+2])*m;
   }
   for(let k=0;k<A.length;k++){const o=A[k]*3;Of[o]=Of2[o];Of[o+1]=Of2[o+1];Of[o+2]=Of2[o+2]}
  }
  for(let k=0;k<A.length;k++){
   const i=A[k],o=i*3;
   let ox=Of[o],oy=Of[o+1],oz=Of[o+2];
   oy*=.55;   // balanço vertical (do quique do quadril) pela metade
   const R=cfg.maxR*gain*Math.min(1,fr[i]*1.15),l=Math.hypot(ox,oy,oz);if(l>R){const s=R/l;ox*=s;oy*=s;oz*=s}
   const rx=An[o]-Co[o],ry=An[o+1]-Co[o+1],rz=An[o+2]-Co[o+2],rl=radial[i];
   if(rl>1e-4){
    const ux=rx/rl,uy=ry/rl,uz=rz/rl,pr=(An[o]+ox-Co[o])*ux+(An[o+1]+oy-Co[o+1])*uy+(An[o+2]+oz-Co[o+2])*uz;
    if(pr<rl){const d=rl-pr;ox+=ux*d;oy+=uy*d;oz+=uz*d}
   }
   const a1x=Anp[o]+(An[o]-Anp[o])*u1,a1y=Anp[o+1]+(An[o+1]-Anp[o+1])*u1,a1z=Anp[o+2]+(An[o+2]-Anp[o+2])*u1;
   P[o]=a1x+ox;P[o+1]=a1y+oy;P[o+2]=a1z+oz;
  }
 }
 for(let k=0;k<A.length;k++){const o=A[k]*3;Anp[o]=An[o];Anp[o+1]=An[o+1];Anp[o+2]=An[o+2]}
 /* mundo → espaço local do avatar, grava no atributo */
 _iq.copy(av.quaternion).invert();
 const out=C.attr.array;
 for(let k=0;k<A.length;k++){
  const i=A[k],o=i*3;_v.set(P[o]-An[o],P[o+1]-An[o+1],P[o+2]-An[o+2]).applyQuaternion(_iq);
  out[o]=_v.x;out[o+1]=_v.y;out[o+2]=_v.z;
 }
 C.attr.needsUpdate=true;
}

function clearCloth(){for(const C of cloths){if(C.mesh.geometry.attributes.clothOff){C.mesh.geometry.deleteAttribute('clothOff')}}cloths=[]}

/* (re)cria as malhas do personagem; level = 0..2; cloth = física da roupa ligada */
let curLevel=-1,clothOn=true;
let hairId='classic';
const slotPart=n=>n==='hair'&&OWM.hair?OWM.hair.part(hairId):LP.parts[n];
function addSlot(n,level){
  const P=slotPart(n);if(!P)return;
  const lv=P.gen?Math.min(level,1):level;   // cabelos procedurais já são suaves: no máx. 1 nível de subdivisão
  const M=OWM.subdiv?OWM.subdiv(P,lv,.7):{pos:P.pos,nrm:P.nrm,idx:P.idx,si:P.si,sw:P.sw};
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(M.pos,3));
  g.setAttribute('normal',new THREE.BufferAttribute(M.nrm,3,M.nrm instanceof Int8Array));
  g.setAttribute('skinIndex',new THREE.BufferAttribute(M.si,4));
  g.setAttribute('skinWeight',new THREE.BufferAttribute(M.sw,4));
  g.setIndex(new THREE.BufferAttribute(M.idx,1));
  const m=new THREE.SkinnedMesh(g,mats[n]);m.name='lp_'+n;
  m.castShadow=true;m.frustumCulled=false;
  av.add(m);m.bind(sk,new THREE.Matrix4());meshes.push(m);   // bind com identidade = mesma pose de repouso em que o esqueleto foi criado (vale também ao reconstruir no meio do jogo)
  if(CLOTH[n]&&OWM.subdiv){const C=buildCloth(n,m,M);if(C)cloths.push(C)}
}
/* troca só a malha do cabelo (estilo = id de OWM.hair.styles) */
function setHair(id){
 if(!LP||!sk||id===hairId)return;
 hairId=id||'classic';
 const i=meshes.findIndex(m=>m.name==='lp_hair');
 if(i>=0){const m=meshes[i];av.remove(m);m.geometry.dispose();meshes.splice(i,1)}
 addSlot('hair',curLevel);
}
function buildMeshes(level){
 if(!LP)return;
 for(const m of meshes){av.remove(m);m.geometry.dispose()}
 meshes=[];cloths=[];
 av.updateMatrixWorld(true);
 if(!sk)sk=new THREE.Skeleton(list);   // dois renderers (jogo + preview do editor) usam o mesmo esqueleto: força atualizar sempre
 if(!sk._owmFrame){Object.defineProperty(sk,'frame',{get:()=>-1,set:()=>{}});sk._owmFrame=1}
 for(const n of SLOTS)addSlot(n,level);
 curLevel=level;
}
function setQuality(level,cloth){
 level=clamp(level|0,0,2);clothOn=cloth!==false;
 if(level!==curLevel)buildMeshes(level);
 if(!clothOn)for(const C of cloths){C.attr.array.fill(0);C.attr.needsUpdate=true;C.init=false}
}
/* nomes que o animeditor usa: LA/RA = braço esq./dir., LL/RL = perna esq./dir., hm = cabeça */
const bones={LA:B.LA,RA:B.RA,LL:B.LL,RL:B.RL,hm:B.hm,hip,upper};
const AUX=['LE','RE','LK','RK'];
const MAP={armL:'LA',armR:'RA',legL:'LL',legR:'RL',head:'hm'};

/* ---------- Keyframes (formato do editor: {t,x,y,z}) ---------- */
/* Interpolação suave (Catmull-Rom/Hermite). Com 2 keyframes vira linear. Segura o 1º/último valor nas pontas. */
function sampleTrack(tr,t){
 const n=tr.length;
 if(!n)return{x:0,y:0,z:0};
 if(n===1||t<=tr[0].t)return{x:tr[0].x,y:tr[0].y,z:tr[0].z};
 if(t>=tr[n-1].t){const l=tr[n-1];return{x:l.x,y:l.y,z:l.z}}
 let i=0;while(i<n-2&&t>tr[i+1].t)i++;
 const a=tr[i],b=tr[i+1],p=tr[i-1],q=tr[i+2],h=b.t-a.t,u=(t-a.t)/h,u2=u*u,u3=u2*u;
 const h00=2*u3-3*u2+1,h10=u3-2*u2+u,h01=-2*u3+3*u2,h11=u3-u2,o={};
 for(const k of['x','y','z']){
  const m0=p?(b[k]-p[k])/(b.t-p.t):(b[k]-a[k])/h;
  const m1=q?(q[k]-a[k])/(q.t-a.t):(b[k]-a[k])/h;
  o[k]=h00*a[k]+h10*h*m0+h01*b[k]+h11*h*m1;
 }
 return o;
}

/* Animação da categoria "Idle" salva no editor passa a ser o "parado" do personagem */
let idle=null;
function reloadIdle(){const a=ld('bc.anims',[]);idle=a.find(x=>x&&x.category==='Idle')||null;ST.idleT=0}

/* ---------- Helpers ---------- */
const wrap=a=>{a=(a+Math.PI)%(Math.PI*2);if(a<0)a+=Math.PI*2;return a-Math.PI};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,k)=>a+(b-a)*k;
const sm=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
/* mola amortecida (integração em subpassos): dá o "peso" e o overshoot dos movimentos */
const mkS=()=>({x:0,v:0});
function spring(s,target,k,c,dt){const n=Math.max(1,Math.ceil(dt/.012)),h=dt/n;for(let i=0;i<n;i++){s.v+=((target-s.x)*k-s.v*c)*h;s.x+=s.v*h}return s.x}

/* ---------- Estado ---------- */
const ST={yaw:0,ph:0,amp:0,air:0,idleT:0,init:false,pog:true,pcy:0,yr:0,pfv:0,af:0,rn:0,dyn:1,coil:0,coilT:0,
 lean:mkS(),roll:mkS(),sq:mkS(),fl:mkS(),head:mkS()};
const FX={roll:0,dip:0};
const CL={lx:0,ly:0,lz:0,vis:false};   // estado da física da roupa entre quadros   // lido pelo game.js: inclinação e "afundar" da câmera em 1ª pessoa

/* Chamado pelo editor ao abrir: tira qualquer deslocamento do jogo para o gizmo ficar alinhado */
function resetPose(){
 hip.position.set(0,HIP,0);hip.rotation.set(0,0,0);upper.rotation.set(0,0,0);
 ['LA','RA','LL','RL','hm'].forEach(k=>bones[k].rotation.set(0,0,0));
 AUX.forEach(k=>{if(B[k])B[k].rotation.set(0,0,0)});
 av.position.set(0,0,0);av.rotation.set(0,0,0);
 ['lean','roll','sq','fl','head'].forEach(k=>{ST[k].x=0;ST[k].v=0});ST.coil=0;ST.coilT=0;
 FX.roll=FX.dip=0;
}

/* Tranco ao tomar dano: o tronco vai pra trás e os braços abrem */
function hit(str){ST.fl.v+=6*(str||.5)}


/* ---------- Camada de animação UAL (Quaternius, CC0) ----------
   Clipes retargetados em ualanim.js. Mistura (blend) entre idle/caminhada/corrida/sprint pela velocidade,
   passo sincronizado com a velocidade real (sem "patinar"), pulo (decolagem + no ar) e pouso por cima.
   Minerar, tranco de dano e o editor de animações continuam funcionando por cima. */
const UA=OWM.ual;
const WALK_STRIDE=2.1;   // a caminhada anda a 4,3 m/s no jogo; ciclo "esticado" pra não ficar frenético
const UKEYS=['idle','walk','jog','sprint','jstart','jloop'];
const UI=UA?UA.ORDER.map(n=>B[n]):null;
const U={pu:-1,pk:1,wp:0,ph:0,airT:0,airN:false,landT:9,landL:0,mn:0,init:false,t:{idle:0,jloop:0},w:{idle:1,walk:0,jog:0,sprint:0,jstart:0,jloop:0}};
const mkQ=()=>UA?UA.ORDER.map(()=>new THREE.Quaternion()):[];
const aQ=mkQ(),tQ=mkQ(),lQ=mkQ(),pQ=mkQ(),_q1=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_qa=new THREE.Quaternion(),_ea=new THREE.Euler();
const aP=new THREE.Vector3(),tP=new THREE.Vector3(),lP=new THREE.Vector3(),pP=new THREE.Vector3();
/* Os clipes vêm de outro rig. O frame inicial de Idle é usado como pose de referência para
   retirar o desvio de bind-pose antes de aplicar as rotações ao nosso esqueleto em A-pose.
   Também limitamos torções laterais dos cotovelos/joelhos: essas articulações flexionam sobretudo em X. */
const UAREF=UA?UA.ORDER.map((_,i)=>{
 const F=UA.clips.idle.f,o=3+i*4;
 return new THREE.Quaternion(F[o],F[o+1],F[o+2],F[o+3]).invert();
}):[];
const UAROOT=UA?Array.from(UA.clips.idle.f.slice(0,3)):[0,HIP,0];
const LIM={
 hip:[[-.62,.62],[-.42,.42],[-.42,.42]], upper:[[-.58,.58],[-.42,.42],[-.38,.38]],
 LA:[[-1.45,1.45],[-.49,.49],[-.96,.96]], RA:[[-1.45,1.45],[-.49,.49],[-.96,.96]],
 LE:[[-2.18,.35],[-.21,.21],[-.21,.21]], RE:[[-2.18,.35],[-.21,.21],[-.21,.21]],
 LL:[[-2.00,1.60],[-.42,.42],[-.58,.58]], RL:[[-2.00,1.60],[-.42,.42],[-.58,.58]],
 LK:[[-.26,2.12],[-.21,.21],[-.21,.21]], RK:[[-.26,2.12],[-.21,.21],[-.21,.21]]
};
function cleanClipPose(qs){
 for(let i=0;i<qs.length;i++){
  const n=UA.ORDER[i],b=LIM[n];
  qs[i].premultiply(UAREF[i]).normalize();
  if(!b)continue;
  _ea.setFromQuaternion(qs[i],'XYZ');
  _ea.x=clamp(_ea.x,b[0][0],b[0][1]);
  _ea.y=clamp(_ea.y,b[1][0],b[1][1]);
  _ea.z=clamp(_ea.z,b[2][0],b[2][1]);
  qs[i].setFromEuler(_ea).normalize();
 }
}
/* LMB: alterna jab (punch1) e cruzado (punch2); só tronco e braços, as pernas seguem a locomoção */
const PSPD=1.2,PUN=['punch1','punch2'];
function punch(){if(OWM.weapon.id==='knife'){K.pend=true;return true}if(!UA||!UA.clips.punch1)return false;if(U.pu>=0&&U.pu<UA.clips[PUN[U.pk]].dur*.5)return false;U.pk^=1;U.pu=0;return true}
function ualSamp(c,t,oQ,oP){
 const n=c.n;let f;
 if(c.loop){t=((t%c.dur)+c.dur)%c.dur;f=t/c.dur*n}else{t=clamp(t,0,c.dur);f=t/c.dur*(n-1)}
 let i=Math.floor(f);const u=f-i;let j=i+1;
 if(c.loop){i%=n;j%=n}else if(i>=n-1){i=j=n-1}else j=Math.min(j,n-1);
 const S=UA.STRIDE,a=i*S,b=j*S,F=c.f;
 /* posição relativa à referência, reancorada no quadril real do nosso modelo */
 oP.set(lerp(F[a],F[b],u)-UAROOT[0],HIP+lerp(F[a+1],F[b+1],u)-UAROOT[1],lerp(F[a+2],F[b+2],u)-UAROOT[2]);
 for(let k=0;k<oQ.length;k++){const o=3+k*4;_q1.set(F[a+o],F[a+o+1],F[a+o+2],F[a+o+3]);_q2.set(F[b+o],F[b+o+1],F[b+o+2],F[b+o+3]);oQ[k].copy(_q1).slerp(_q2,u)}
 cleanClipPose(oQ);
}
/* x = estado do jogo neste frame */
function ualLayer(dt,x){
 const C=UA.clips,{og,sp,vy,mining,mineA,show,landV,cp,camYaw}=x;
 /* no ar só depois de 0,1 s sem chão (degraus pequenos não ativam o pulo), ou se estiver subindo */
 U.airT=og?0:U.airT+dt;
 const airN=!og&&(U.airT>.1||vy>1);
 if(U.airN&&!airN&&og){U.landT=0;U.landL=clamp((landV||0)/16,.25,1)}   // pouso
 U.airN=airN;U.landT=airN?9:U.landT+dt;
 U.mn+=((mining?1:0)-U.mn)*(1-Math.exp(-dt*12));
 let wp=0;const pc=C[PUN[U.pk]];
 if(U.pu>=0){U.pu+=dt*PSPD;const pd=pc.dur;if(U.pu>=pd)U.pu=-1;else wp=sm(U.pu/.07)*(1-sm((U.pu-(pd-.2))/.2))}
 U.wp=wp;

 /* pesos-alvo pela velocidade */
 const g=airN?0:1,wk=clamp((sp-.25)/.7,0,1),jg=x.sprint?1:0,spr=sm((sp-4.9)/1.3);   // corrida (jog/sprint) só com o sprint ligado; senão, caminhada
 const rise=airN&&vy>0&&U.airT<.45?1:0;
 const tg={idle:(1-wk)*g,walk:wk*(1-jg)*g,jog:wk*jg*(1-spr)*g,sprint:wk*jg*spr*g,jstart:(airN?1:0)*rise,jloop:(airN?1:0)*(1-rise)};
 const kw=1-Math.exp(-dt*(airN||U.w.jstart>.05||U.w.jloop>.05?16:11));
 for(const k of UKEYS){U.w[k]=U.init?U.w[k]+(tg[k]-U.w[k])*kw:tg[k]}
 U.init=true;

 /* fase do passo: avança conforme a velocidade real / distância do ciclo (mistura ponderada dos ciclos ativos) */
 if(!airN&&sp>.2){
  const ww=U.w.walk,wj=U.w.jog,ws=U.w.sprint,sw_=ww+wj+ws;
  const D=sw_>.01?(ww*C.walk.dist*WALK_STRIDE+wj*C.jog.dist+ws*C.sprint.dist)/sw_:C.walk.dist*WALK_STRIDE;
  U.ph=(U.ph+dt*sp/D)%1;
 }
 U.t.idle+=dt;U.t.jloop+=dt;
 if(!show)return;                                    // em 1ª pessoa o corpo não aparece: só mantém o estado

 /* mistura dos clipes ativos */
 let sum=0;
 for(const k of UKEYS){
  const w=U.w[k];if(w<.003)continue;
  const c=C[k],t=(k==='walk'||k==='jog'||k==='sprint')?U.ph*c.dur:k==='jstart'?.34+U.airT:U.t[k];
  ualSamp(c,t,tQ,tP);
  if(sum===0){for(let i=0;i<aQ.length;i++)aQ[i].copy(tQ[i]);aP.copy(tP);sum=w}
  else{const a=w/(sum+w);for(let i=0;i<aQ.length;i++)aQ[i].slerp(tQ[i],a);aP.lerp(tP,a);sum+=w}
 }
 if(sum===0){ualSamp(C.idle,U.t.idle,aQ,aP)}

 if(wp>.003){
  ualSamp(pc,U.pu,pQ,pP);
  for(let i=0;i<aQ.length;i++){const n=UA.ORDER[i];if(n==='upper'||n==='LA'||n==='LE'||n==='RA'||n==='RE')aQ[i].slerp(pQ[i],wp)}
 }

 /* pouso por cima: agacha e a mola devolve; correndo, afeta só o quadril/tronco */
 const wl=U.landT<2?U.landL*(1-sm((U.landT-.12)/.5)):0;
 if(wl>.01){
  ualSamp(C.jland,U.landT*1.7,lQ,lP);
  const mv=clamp(sp/3,0,1);
  for(let i=0;i<aQ.length;i++){
   const n=UA.ORDER[i],leg=n==='LL'||n==='LK'||n==='RL'||n==='RK',arm=n==='LA'||n==='LE'||n==='RA'||n==='RE';
   aQ[i].slerp(lQ[i],wl*(leg?1-mv*.85:arm?1-mv*.5:1));
  }
  aP.lerp(lP,wl*(1-mv*.8));
 }

 /* aplica nos ossos (braço direito/cotovelo seguem a animação de minerar quando minerando) */
 for(let i=0;i<UI.length;i++){
  const n=UA.ORDER[i],b=UI[i];if(!b)continue;
  if(U.mn*(1-wp)>.01&&(n==='RA'||n==='RE'))b.quaternion.copy(aQ[i]).slerp(_qa.copy(b.quaternion),U.mn*(1-wp));
  else b.quaternion.copy(aQ[i]);
 }
 hip.position.set(aP.x,aP.y,aP.z);

 /* extras por cima do clipe: golpe ao minerar e tranco de dano */
 const mnE=U.mn*(1-wp),fl=ST.fl.x,ax=.12*mineA*mnE-fl*.55,ay=.28*mineA*mnE;
 if(Math.abs(ax)>1e-4||Math.abs(ay)>1e-4)upper.quaternion.multiply(_qa.setFromEuler(_ea.set(ax,ay,0)));

 /* cabeça olha pra onde a câmera olha, compensando a inclinação/torção do corpo */
 const hr=hip.rotation,ur=upper.rotation,h=bones.hm,hk=1-Math.exp(-dt*14);
 const tx=clamp(-cp,-.9,.9)*.9-(hr.x+ur.x)*.6,ty=clamp(wrap(camYaw-ST.yaw),-1.2,1.2)-(hr.y+ur.y)*.85,tz=-(hr.z+ur.z)*.5;
 h.rotation.set(h.rotation.x+(tx-h.rotation.x)*hk,h.rotation.y+(ty-h.rotation.y)*hk,h.rotation.z+(tz-h.rotation.z)*hk);
}

/* ---------- Animação por frame ---------- */
function update(dt,s){
 if(!s||!s.inGame){av.visible=false;VM.g.visible=false;K.strike=false;return}
 const{p,vel,og,mining,swT,cp,custom,tp3,coil}=s;
 dt=clamp(dt,1e-4,.05);
 av.visible=!!tp3;                                  // em 1ª pessoa só aparece o braço/item
 av.position.set(p.x,p.y,p.z);

 const sp=Math.hypot(vel.x,vel.z),moving=sp>.5,camYaw=cam.rotation.y;
 if(!ST.init){ST.yaw=camYaw;ST.pcy=camYaw;ST.init=true}
 ST.yr+=(clamp(wrap(camYaw-ST.pcy)/dt,-9,9)-ST.yr)*(1-Math.exp(-dt*10));ST.pcy=camYaw;   // velocidade de giro da câmera (suavizada)
 /* o corpo NÃO gira com a câmera: só vira quando o personagem anda, olhando pra onde ele vai; parado, fica como está (a cabeça acompanha a câmera) */
 /* Soco sem arma: o game.js manda attack=true (botão esquerdo / "Socar", segurando repete). Antes ninguém chamava punch(), então só a faca animava. */
 if(s.attack&&!coil&&!custom&&!OWM.weapon.id)punch();
 const clipOn=!!UA&&!custom&&!(idle&&og&&!moving&&!mining&&U.pu<0);   // soco em andamento: os clipes entram mesmo parado com o "Idle" salvo
 if(moving)ST.yaw+=wrap(Math.atan2(-vel.x,-vel.z)-ST.yaw)*(1-Math.exp(-dt*14));
 av.rotation.y=ST.yaw+Math.PI;                       // modelo olha pra +Z; jogo olha pra -Z em yaw 0

 /* velocidade relativa ao corpo: fv = pra frente, sv = pra direita */
 const cs=Math.cos(ST.yaw),sn=Math.sin(ST.yaw);
 const fv=vel.x*-sn+vel.z*-cs,sv=vel.x*cs+vel.z*-sn;
 const ff=moving?fv/sp:0,sf=moving?sv/sp:0;
 const aF=(fv-ST.pfv)/dt;ST.pfv=fv;ST.af+=(clamp(aF,-16,16)-ST.af)*(1-Math.exp(-dt*12));   // aceleração pra frente

 const rnT=sm((sp-4.6)/1.8);ST.rn+=(rnT-ST.rn)*(1-Math.exp(-dt*6));const rn=ST.rn;   // 0 = andando, 1 = correndo
 ST.ph+=dt*sp*(4.2+.7*rn)*STRIDE*(fv<-.2?-1:1);
 ST.amp+=((og&&moving?Math.min(1,sp/3.2):0)-ST.amp)*(1-Math.exp(-dt*12));
 ST.air+=((og?0:1)-ST.air)*(1-Math.exp(-dt*10));
 ST.idleT+=dt;
 ST.coil+=((coil?1:0)-ST.coil)*(1-Math.exp(-dt*(coil?9:6)));ST.coilT+=dt;
 ST.dyn+=((custom?0:1)-ST.dyn)*(1-Math.exp(-dt*10));  // animação do editor desliga a dinâmica do corpo

 /* eventos: decolagem e pouso */
 if(ST.pog&&!og&&vel.y>1)ST.sq.v+=2.4;                                   // esticada ao pular
 if(!ST.pog&&og){const L=clamp((s.landV||0)/16,.12,1);ST.sq.v-=L*5.5;ST.lean.v+=L*2}   // pouso: afunda e a mola devolve
 ST.pog=og;

 const A=ST.amp,air=ST.air,dyn=ST.dyn,br=Math.sin(ST.idleT*1.9),sw=Math.sin(ST.ph);
 const fk=.35+.65*Math.abs(ff);                       // andando de lado, a perna balança menos pra frente
 const lF=(.62+.2*rn)*A*fk,lB=(.62+.5*rn)*A*fk,aA=(.7+.45*rn)*A*fk;   // correndo, a perna de trás chuta mais
 const leg=v=>v>0?v*lB:v*lF;

 /* alvos procedurais [x,y,z] */
 const T={
  LA:[-sw*aA-.28*rn*A,0,.05+.02*br*(1-A)],
  RA:[sw*aA-.28*rn*A,0,-(.05+.02*br*(1-A))],
  LL:[leg(sw),0,.02-sf*(.22+.18*sw)*A],
  RL:[leg(-sw),0,-.02-sf*(.22-.18*sw)*A],
  hm:[0,0,0]
 };
 let twist=-sw*(.18+.14*rn)*A*fk;                     // tronco gira contra o quadril
 let leanX=.09*clamp(fv/4.3,-.6,1.3)+.2*rn*Math.max(0,ff)+.01*ST.af;
 let rollZ=clamp(sv/4.3,-1.2,1.2)*.12-.035*ST.yr*(.4+rn)*clamp(sp/4.3,0,1.2);

 /* no ar: subindo = braços pra cima e passada aberta; caindo = braços abertos pra equilibrar */
 if(air>.01){
  const rise=clamp(vel.y/8,0,1),fall=clamp(-vel.y/12,0,1);
  const ax=lerp(-.7,-1.85,rise)+fall*.4,az=.20+.32*fall+.12*rise;
  T.LA=[lerp(T.LA[0],ax,air),0,lerp(T.LA[2],az,air)];
  T.RA=[lerp(T.RA[0],ax,air),0,lerp(T.RA[2],-az,air)];
  T.LL=[lerp(T.LL[0],lerp(-.25,-.55,rise),air),0,lerp(T.LL[2],.04+.12*fall,air)];
  T.RL=[lerp(T.RL[0],lerp(.25,.45,rise),air),0,lerp(T.RL[2],-.04-.12*fall,air)];
  leanX=lerp(leanX,-.08*rise+.12*fall,air);
  twist*=1-air;rollZ*=1-.5*air;
 }

 /* pouso: pernas abrem em "afundo" e os braços balançam pra frente */
 const cr=Math.max(0,-ST.sq.x),ca=Math.acos(clamp(1-cr/HIP,.4,1))*(1-air);
 if(ca>.001){
  T.LL[0]-=ca*.8;T.RL[0]+=ca*.8;T.LL[2]+=ca*.35;T.RL[2]-=ca*.35;
  T.LA[0]-=ca*.9;T.RA[0]-=ca*.9;T.LA[2]+=ca*.5;T.RA[2]-=ca*.5;
  leanX+=ca*.5;
 }

 /* golpe ao minerar: o corpo acompanha o braço (preparação + pancada) */
 let mineA=0;
 if(mining){
  mineA=Math.abs(Math.sin(swT));
  T.RA=[-(.5+1.5*mineA),0,-.1];T.LA[0]+=.5*mineA;
  twist+=.28*mineA;leanX+=.12*mineA;
  T.LL[2]+=.06;T.RL[2]-=.06;
 }

 /* respiração e olhar em volta (só parado, sem animação do editor) */
 const calm=(1-A)*(1-air)*(mining?0:1);
 const idleHead=Math.sin(ST.idleT*.43)*.12*calm;
 const breath=br*.012*calm;

 /* animação do editor (tocando) tem prioridade; senão "Idle" salva; ossos sem track seguem o procedural */
 let tracks=null,tt=0;
 if(custom&&custom.anim){tracks=custom.anim.tracks;tt=custom.time}
 else if(idle&&og&&!moving&&!mining){tracks=idle.tracks;tt=ST.idleT%Math.max(.1,idle.duration)}

 /* molas: inclinação pra frente/lado e tranco de dano */
 spring(ST.lean,leanX*dyn*(1-.4*air),70,11,dt);
 spring(ST.roll,rollZ*dyn,70,11,dt);
 spring(ST.sq,0,150,11,dt);ST.sq.x=clamp(ST.sq.x,-.4,.15);
 spring(ST.fl,0,80,7,dt);ST.fl.x=clamp(ST.fl.x,-.2,.9);
 const fl=ST.fl.x;
 T.LA[2]+=fl*1.1;T.RA[2]-=fl*1.1;T.LA[0]+=fl*.5;T.RA[0]+=fl*.5;

 /* cabeça: olha pra onde a câmera olha e compensa a inclinação/torção do corpo */
 const tw=twist*dyn;
 T.hm=[clamp(-cp,-.9,.9)-ST.lean.x*.7,clamp(wrap(camYaw-ST.yaw),-1.2,1.2)-tw*.6+idleHead,-ST.roll.x*.5];

 const k=1-Math.exp(-dt*(16+24*A));                   // passada rápida precisa de resposta rápida (senão a perna "some" correndo)
 for(const nm in MAP){
  const b=bones[MAP[nm]],tr=tracks&&tracks[nm];
  if(tr&&tr.length){const v=sampleTrack(tr,tt);b.rotation.set(v.x,v.y,v.z)}
  else{const t=T[MAP[nm]];b.rotation.x+=(t[0]-b.rotation.x)*k;b.rotation.y+=(t[1]-b.rotation.y)*k;b.rotation.z+=(t[2]-b.rotation.z)*k}
 }

 /* cotovelos e joelhos: dobram conforme o balanço (braço pra frente → antebraço sobe; perna pra trás → canela dobra) */
 if(B.LE){
  const ek=1-Math.exp(-dt*22),run=rn*A,mn=mining?.9*mineA:0;
  const el=(b,a,mine)=>{const t=-clamp(.12+.55*Math.max(0,-a.rotation.x)+.8*run+(mine||0),0,2.3);b.rotation.x+=(t-b.rotation.x)*ek};
  const kn=(b,l)=>{const t=clamp(.06+1.05*Math.max(0,l.rotation.x)+.45*run+.35*Math.max(0,-l.rotation.x)*run,0,2.2);b.rotation.x+=(t-b.rotation.x)*ek};
  el(B.LE,B.LA,0);el(B.RE,B.RA,mn);kn(B.LK,B.LL);kn(B.RK,B.RL);
 }

 /* tronco (inclinação, torção, rolagem, respiração, tranco) e quadril (contra-giro) */
 const kk=1-Math.exp(-dt*20);
 const ux=ST.lean.x-fl*.55+breath,uy=tw,uz=ST.roll.x;
 upper.rotation.x+=(ux-upper.rotation.x)*kk;upper.rotation.y+=(uy-upper.rotation.y)*kk;upper.rotation.z+=(uz-upper.rotation.z)*kk;
 const hy=-tw*.4*(1-air),hz=ST.roll.x*.3+Math.sin(ST.idleT*.7)*.015*calm;
 hip.rotation.y+=(hy-hip.rotation.y)*kk;hip.rotation.z+=(hz-hip.rotation.z)*kk;hip.rotation.x+=(0-hip.rotation.x)*kk;

 /* altura do quadril: a perna mais "esticada" apoia no chão; correndo tem fase de voo; pouso abaixa mais */
 let y=HIP;
 if(!tracks){
  const reach=Math.max(Math.cos(bones.LL.rotation.x)*Math.cos(bones.LL.rotation.z),Math.cos(bones.RL.rotation.x)*Math.cos(bones.RL.rotation.z));
  const f=.5+.5*clamp(cr/.2,0,1);
  y=HIP-HIP*(1-reach)*f+br*.004*calm;
  y+=.06*rn*A*Math.pow(1-Math.abs(sw),2)*(1-air);
  y+=Math.max(0,ST.sq.x)*.25;                        // esticada ao decolar
 }
 hip.position.y=y;

 if(clipOn)ualLayer(dt,{og,sp,vy:vel.y,mining:mining&&OWM.weapon.id!=='knife',mineA,show:!!tp3,landV:s.landV,cp,camYaw,sprint:!!s.sprint});

 knifeUpdate(dt,s,sp,A,rn,clipOn,custom);

 /* Enrolado: braços se fecham protegendo o tórax, com tremor pequeno e suave. A transição usa ST.coil para não dar snap. */
 if(ST.coil>.001){
  const w=ST.coil,shake=Math.sin(ST.coilT*17.5)*.105*w,clampW=Math.min(.92,w);
  const brace=(b,x,y,z)=>{if(!b)return;_Q1.copy(b.quaternion);_Q2.setFromEuler(_eu.set(x,y,z));b.quaternion.copy(_Q1).slerp(_Q2,clampW)};
  brace(B.LA,-.92+shake,0,.52+.06*Math.sin(ST.coilT*11)*w);
  brace(B.RA,-1.02-shake,0,-.48-.05*Math.sin(ST.coilT*13)*w);
  brace(B.LE,-1.05-.08*Math.sin(ST.coilT*17)*w,0,0);
  brace(B.RE,-1.10+.08*Math.sin(ST.coilT*16)*w,0,0);
  _Q2.setFromEuler(_eu.set(-.10*w+.025*Math.sin(ST.coilT*15)*w,0,.025*Math.sin(ST.coilT*17)*w));upper.quaternion.slerp(_Q2,w*.58);
  /* Em 1ª pessoa só o braço direito é renderizado; aproxima-o do peito enquanto a câmera treme. */
  if(!tp3&&VM.ok&&VM.g.visible){
   const k=Math.min(1,w*1.15);VM.fa.position.x+=(-.035)*k;VM.fa.position.y+=.035*k;
   VM.fa.quaternion.slerp(_Q2.setFromEuler(_eu.set(-.22-.04*Math.sin(ST.coilT*17)*w,0,.16)),k*.55);
  }
 }

 /* física da roupa (só com o corpo visível) */
 if(cloths.length&&clothOn&&av.visible){
  const dx=av.position.x-CL.lx,dy=av.position.y-CL.ly,dz=av.position.z-CL.lz;
  const jump=dx*dx+dy*dy+dz*dz>9||!CL.vis;       // teleporte ou voltou da 1ª pessoa: não deixa o pano "voar" até a nova posição
  CL.sp=sp;CL.lx=av.position.x;CL.ly=av.position.y;CL.lz=av.position.z;CL.vis=true;
  av.updateMatrixWorld(true);
  for(let i=0;i<list.length;i++){BM[i]=list[i].matrixWorld;updateDQBone(i)}
  for(const C of cloths)clothStep(C,dt,jump);
 }else CL.vis=false;

 /* dados pra câmera em 1ª pessoa */
 FX.roll=clamp(-ST.roll.x*.25,-.05,.05);
 FX.dip=clamp(ST.sq.x*.35,-.14,.05);
}

/* ---------- Arma na mão: faca (3ª pessoa: malha no antebraço + pose; 1ª pessoa: modelo de visão preso à câmera) ----------
   Poses = vetores [RAx,RAy,RAz, REx, torsoX,torsoY, LAx,LAz, LEx] (Euler, rotação X negativa = pra frente). Golpes: 0 = corte diagonal, 1 = corte de costas, 2 = estocada.
   Em 1ª pessoa cada golpe é uma trilha [u, x,y,z, rx,ry,rz] da posição/rotação da mão em espaço da câmera. Interpolação Catmull-Rom (crN). */
function crN(R,u){
 const n=R.length,m=R[0].length;if(u<=R[0][0])return R[0].slice(1);if(u>=R[n-1][0])return R[n-1].slice(1);
 let i=0;while(i<n-2&&u>R[i+1][0])i++;
 const a=R[i],b=R[i+1],p=R[i-1],q=R[i+2],h=b[0]-a[0],t=(u-a[0])/h,t2=t*t,t3=t2*t,h00=2*t3-3*t2+1,h10=t3-2*t2+t,h01=-2*t3+3*t2,h11=t3-t2,o=[];
 for(let k=1;k<m;k++){const m0=p?(b[k]-p[k])/(b[0]-p[0]):(b[k]-a[k])/h,m1=q?(q[k]-a[k])/(q[0]-a[0]):(b[k]-a[k])/h;o.push(h00*a[k]+h10*h*m0+h01*b[k]+h11*h*m1)}
 return o;
}
const KG=[-.95,.25,-.12,-1.3,.03,.15,-.35,.15,-.9],KL=[-.5,.3,-1.1];
const kr=(u,a,b,c,d,e,f)=>[u,a,b,c,d,e,f,...KL];
const KSW=[
 {dur:.44,hit:.4,r:[[0,...KG],kr(.2,-2.35,-.5,-.45,-1,-.08,-.45),kr(.42,-1.05,.95,.15,-.45,.22,.6),kr(.6,-.55,1.1,.35,-.5,.2,.7),[1,...KG]],
  v:[[0,.21,-.22,-.44,0,0,0],[.2,.3,0,-.38,.15,0,-.55],[.42,.02,-.2,-.46,-.55,0,.5],[.6,-.12,-.28,-.42,-.8,0,1],[1,.21,-.22,-.44,0,0,0]]},
 {dur:.44,hit:.4,r:[[0,...KG],kr(.2,-1.25,1,.1,-1.5,0,.65),kr(.42,-1.2,-.7,-.3,-.45,.15,-.5),kr(.6,-1,-.95,-.35,-.55,.12,-.6),[1,...KG]],
  v:[[0,.21,-.22,-.44,0,0,0],[.2,-.05,-.12,-.4,0,0,.9],[.42,.28,-.18,-.45,-.3,0,-1.1],[.6,.32,-.22,-.42,-.45,0,-1.4],[1,.21,-.22,-.44,0,0,0]]},
 {dur:.38,hit:.42,r:[[0,...KG],kr(.22,-.55,.3,-.1,-2.1,-.05,-.25),kr(.42,-1.5,.2,-.05,-.15,.22,.2),kr(.6,-1.4,.2,-.05,-.3,.2,.15),[1,...KG]],
  v:[[0,.21,-.22,-.44,0,0,0],[.22,.2,-.18,-.28,.35,0,0],[.42,.12,-.1,-.62,-.35,0,.05],[.6,.14,-.14,-.56,-.3,0,.05],[1,.21,-.22,-.44,0,0,0]]}
];
const K={w:0,t:-1,n:2,hit:false,strike:false,pend:false,dr:9,was:false,sp:0};
/* Soco sem arma em 1ª pessoa: o mesmo braço da faca (sem a faca), que entra durante o soco e sai logo depois. Trilhas [u, x,y,z, rx,ry,rz] no espaço da câmera,
   mesmo formato das da faca (v de KSW). 0 = jab (reto), 1 = cruzado (vem de fora pro centro). Ritmo = o do clipe punch1/punch2 (U.pu). */
const F1={w:0,hold:0},GUARD=[.21,-.22,-.44,0,0,0];
const FSW=[
 [[0,.21,-.22,-.44,0,0,0],[.25,.19,-.19,-.3,.3,0,0],[.45,.1,-.08,-.66,-.4,.05,.05],[.62,.12,-.1,-.62,-.35,.05,.05],[1,.21,-.22,-.44,0,0,0]],
 [[0,.21,-.22,-.44,0,0,0],[.25,.3,-.2,-.36,.2,0,-.6],[.45,0,-.12,-.64,-.5,0,.5],[.62,-.04,-.14,-.6,-.45,0,.55],[1,.21,-.22,-.44,0,0,0]]
];
const kBasis=(o,ex,ey,ez)=>o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...ex),new THREE.Vector3(...ey),new THREE.Vector3(...ez)));
/* 3ª pessoa: faca presa ao antebraço direito (RE), cabo na palma, lâmina na direção do antebraço, levemente pra cima */
const k3=(OWM.makeKnife&&B.RE)?OWM.makeKnife():null;
if(k3){kBasis(k3,[0,-.435,-.9004],[.2474,-.8725,.4214],[-.9689,-.2228,.1076]);k3.position.set(-.085,-.27,0);k3.traverse(m=>{m.castShadow=true});k3.visible=false;B.RE.add(k3)}
/* 1ª pessoa: braço DIREITO REAL do personagem (triângulos de pele + manga ligados aos ossos RA/RE do modelo), com 2 ossos próprios.
   A mão segue a trilha do golpe (posição + orientação da faca); o cotovelo é achado pela posição da mão, e o ombro aponta pra um ponto fixo fora da tela. */
const VM={g:new THREE.Group(),ok:false,fa:null,fe:null};
const QREL=new THREE.Quaternion(),QKB=new THREE.Quaternion(),QREL_I=new THREE.Quaternion();
{const o=new THREE.Object3D();kBasis(o,[0,-.435,-.9004],[.2474,-.8725,.4214],[-.9689,-.2228,.1076]);QREL.copy(o.quaternion);QREL_I.copy(QREL).invert();
 kBasis(o,[-.9669,-.2156,.1363],[-.2506,.9023,-.3509],[-.0473,-.3734,-.9265]);QKB.copy(o.quaternion)}
if(OWM.makeKnife&&LP&&LP.parts&&LP.parts.skin){
 const iRA=BIDX.indexOf('RA'),iRE=BIDX.indexOf('RE'),fa=new THREE.Bone(),fe=new THREE.Bone();
 fe.position.set(LP.bones.RE[1][0],LP.bones.RE[1][1],LP.bones.RE[1][2]);fa.add(fe);VM.g.add(fa);VM.g.updateMatrixWorld(true);
 const sk1=new THREE.Skeleton([fa,fe]),base=bindPos.RA;
 const armMesh=(P,mat)=>{
  const n=P.pos.length/3,dom=new Int8Array(n),map=new Int32Array(n).fill(-1);
  for(let i=0;i<n;i++){let bi=0,bw=-1;for(let q=0;q<4;q++)if(P.sw[i*4+q]>bw){bw=P.sw[i*4+q];bi=P.si[i*4+q]}dom[i]=bi===iRE?1:bi===iRA?0:-1}
  const tri=[];let cnt=0;
  for(let f=0;f<P.idx.length;f+=3){const a=P.idx[f],b=P.idx[f+1],c=P.idx[f+2];if(dom[a]<0||dom[b]<0||dom[c]<0)continue;for(const v of[a,b,c])if(map[v]<0)map[v]=cnt++;tri.push(map[a],map[b],map[c])}
  if(!cnt)return null;
  const pos=new Float32Array(cnt*3),nrm=new P.nrm.constructor(cnt*3),si=new Float32Array(cnt*4),sw=new Float32Array(cnt*4);
  for(let i=0;i<n;i++){const j=map[i];if(j<0)continue;
   pos[j*3]=P.pos[i*3]-base.x;pos[j*3+1]=P.pos[i*3+1]-base.y;pos[j*3+2]=P.pos[i*3+2]-base.z;nrm[j*3]=P.nrm[i*3];nrm[j*3+1]=P.nrm[i*3+1];nrm[j*3+2]=P.nrm[i*3+2];
   let s=0;for(let q=0;q<4;q++){si[j*4+q]=P.si[i*4+q]===iRE?1:0;sw[j*4+q]=P.sw[i*4+q];s+=sw[j*4+q]}if(s>0)for(let q=0;q<4;q++)sw[j*4+q]/=s;else sw[j*4]=1}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nrm,3,nrm instanceof Int8Array));
  g.setAttribute('skinIndex',new THREE.BufferAttribute(si,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(sw,4));g.setIndex(new THREE.BufferAttribute(new Uint32Array(tri),1));
  const m=new THREE.SkinnedMesh(g,mat);m.frustumCulled=false;VM.g.add(m);m.bind(sk1,new THREE.Matrix4());return m};
 const mS=new THREE.MeshLambertMaterial({color:0xdc9659,side:THREE.DoubleSide,skinning:true}),mH=new THREE.MeshLambertMaterial({color:0xc8281a,side:THREE.DoubleSide,skinning:true});
 if(SK&&SK.listen)SK.listen(c=>{mS.color.set(c.skin).convertSRGBToLinear();mH.color.set(c.shirt).convertSRGBToLinear()});
 armMesh(LP.parts.skin,mS);armMesh(LP.parts.shirt,mH);
 const kn=OWM.makeKnife();kn.quaternion.copy(QREL);kn.position.set(-.085,-.27,0);fe.add(kn);
 VM.kn=kn;VM.fa=fa;VM.fe=fe;VM.g.visible=false;cam.add(VM.g);VM.ok=true;
}
const _Q1=new THREE.Quaternion(),_Q2=new THREE.Quaternion(),_Q3=new THREE.Quaternion(),_Q4=new THREE.Quaternion(),_Q5=new THREE.Quaternion(),_V1=new THREE.Vector3(),_V2=new THREE.Vector3(),_V3=new THREE.Vector3(),_eu=new THREE.Euler(),_S=new THREE.Vector3(.25,-.34,.22),_U0=new THREE.Vector3(-.147,-.358,0),_U0n=_U0.clone().normalize(),_G=new THREE.Vector3(-.085,-.27,0);
function knifeUpdate(dt,s,sp,A,rn,clipOn,custom){
 const on=OWM.weapon.id==='knife'&&!custom;
 K.w+=((on?1:0)-K.w)*(1-Math.exp(-dt*(on?12:10)));
 if(on&&!K.was)K.dr=0;K.was=on;K.dr+=dt;K.strike=false;
 if(!on){K.t=-1;K.pend=false}
 else{
  if(K.t<0&&(s.attack||K.pend)){K.t=0;K.n=(K.n+1)%3;K.pend=false;K.hit=false}
  if(K.t>=0){const SW=KSW[K.n];K.t+=dt;if(!K.hit&&K.t>=SW.dur*SW.hit){K.hit=true;K.strike=true}if(K.t>=SW.dur)K.t=-1}
 }
 const tp=!!s.tp3,fp=!tp&&s.inGame;
 if(k3)k3.visible=tp&&K.w>.02;
 /* braço de soco (sem arma): aparece enquanto o clipe LMB roda e some ~.35 s depois */
 const pa=!OWM.weapon.id&&!custom&&U.pu>=0;F1.hold=pa?.35:Math.max(0,F1.hold-dt);
 F1.w+=(((pa||F1.hold>0)&&!on?1:0)-F1.w)*(1-Math.exp(-dt*(pa?18:9)));
 VM.g.visible=VM.ok&&fp&&(K.w>.02||F1.w>.02||!!coil);
 if(VM.kn)VM.kn.visible=K.w>.02;
 const SW=KSW[K.n],u=K.t>=0?K.t/SW.dur:0;
 if(tp&&K.w>.01){
  let v;
  if(K.t>=0)v=crN(SW.r,u);
  else{const sw=Math.sin(ST.idleT*1.9)*.02;v=KG.slice();v[0]+=sw+Math.sin(ST.ph)*.05*A;v[3]+=sw*1.2;v[1]+=Math.cos(ST.ph*.5)*.02*A}
  const lw=K.w*.85*(1-.7*A),sl=(b,x,y,z,w)=>b.quaternion.slerp(_qa.setFromEuler(_ea.set(x,y,z)),w);
  sl(B.RA,v[0],v[1],v[2],K.w);sl(B.RE,v[3],0,0,K.w);sl(B.LA,v[6],0,v[7],lw);sl(B.LE,v[8],0,0,lw);
  if(clipOn)upper.quaternion.multiply(_qa.setFromEuler(_ea.set(v[4]*K.w,v[5]*K.w,0)));
 }
 if(VM.g.visible){
  const ks=Math.min(1,s.sprint&&sp>4?1:0);K.sp+=(ks-K.sp)*(1-Math.exp(-dt*8));
  let v,dr;
  if(K.w>.02){v=K.t>=0?crN(SW.v,u):GUARD;dr=1-sm(K.dr/.4)}
  else{const pd=UA&&UA.clips[PUN[U.pk]]?UA.clips[PUN[U.pk]].dur:.5;v=U.pu>=0?crN(FSW[U.pk],clamp(U.pu/pd,0,1)):GUARD;dr=1-sm(F1.w)}
  const hw=Math.tan(cam.fov*Math.PI/360)*cam.aspect*.44*.62,xs=Math.min(1,hw/.21),d=dr,br=Math.sin(ST.idleT*1.8);
  let x=v[0]*xs,y=v[1]+br*.004+Math.abs(Math.sin(ST.ph))*.012*A-K.sp*.05+ST.sq.x*.25-d*.35,z=v[2]-K.sp*.02;
  x+=Math.cos(ST.ph)*.01*A;
  /* orientação da faca (espaço da câmera) -> osso do antebraço; posição da mão -> cotovelo/ombro */
  _Q1.setFromEuler(_eu.set(v[3]+d*.9+K.sp*.25,v[4]+clamp(ST.yr*.012,-.08,.08),v[5]-K.sp*.15)).multiply(QKB).multiply(QREL_I);   // Qfe (mundo)
  _V1.set(x,y,z).sub(_V2.copy(_G).applyQuaternion(_Q1));                          // cotovelo E = mão - Qfe*grip
  _V3.copy(_S).sub(_V1).normalize().negate();                                      // direção ombro->cotovelo
  _Q2.setFromUnitVectors(_U0n,_V3);                                                // Qfa
  _Q3.copy(_Q2).invert().multiply(_Q1);                                           // rotação relativa antebraço (inclui giro em torno do braço)
  {const pr=_Q3.x*_U0n.x+_Q3.y*_U0n.y+_Q3.z*_U0n.z;_Q4.set(_U0n.x*pr,_U0n.y*pr,_U0n.z*pr,_Q3.w);const l=_Q4.length();
   if(l>1e-6){_Q4.set(_Q4.x/l,_Q4.y/l,_Q4.z/l,_Q4.w/l);_Q5.identity().slerp(_Q4,.5);_Q2.multiply(_Q5)}}   // metade do giro vai pro braço (evita torcer a manga)
  VM.fa.quaternion.copy(_Q2);VM.fa.position.copy(_V1).sub(_V2.copy(_U0).applyQuaternion(_Q2));
  VM.fe.quaternion.copy(_Q2).invert().multiply(_Q1);
 }
}

OWM.anim={setHair,strike:()=>K.strike,av,update,bones,sampleTrack,reloadIdle,resetPose,hit,punch,fx:FX,setQuality};
reloadIdle();
if(SK&&SK.colors&&SK.colors.hairStyle)hairId=SK.colors.hairStyle;
{const S0=OWM.S||{};buildMeshes(S0.charQ==null?(OWM.touch?1:2):S0.charQ);clothOn=S0.cloth!==0}
})();
