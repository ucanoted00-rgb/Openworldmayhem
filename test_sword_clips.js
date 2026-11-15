'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
class Quaternion{
 constructor(x=0,y=0,z=0,w=1){this.set(x,y,z,w)}
 set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this}
 copy(q){return this.set(q.x,q.y,q.z,q.w)}
 normalize(){const n=Math.hypot(this.x,this.y,this.z,this.w)||1;this.x/=n;this.y/=n;this.z/=n;this.w/=n;return this}
 slerp(q,t){
  let cos=this.x*q.x+this.y*q.y+this.z*q.z+this.w*q.w;
  let x=q.x,y=q.y,z=q.z,w=q.w;
  if(cos<0){cos=-cos;x=-x;y=-y;z=-z;w=-w}
  if(cos>.9995){this.x+=(x-this.x)*t;this.y+=(y-this.y)*t;this.z+=(z-this.z)*t;this.w+=(w-this.w)*t;return this.normalize()}
  const theta=Math.acos(Math.max(-1,Math.min(1,cos))),sin=Math.sin(theta);
  const a=Math.sin((1-t)*theta)/sin,b=Math.sin(t*theta)/sin;
  this.x=this.x*a+x*b;this.y=this.y*a+y*b;this.z=this.z*a+z*b;this.w=this.w*a+w*b;return this.normalize();
 }
}
global.window=global;
global.OWM={ual:{ORDER:['hip','upper','hm','LA','LE','RA','RE','LL','LK','RL','RK']}};
global.THREE={Quaternion};
global.atob=global.atob||((s)=>Buffer.from(s,'base64').toString('binary'));
require(path.resolve(process.argv[2]||'sword-clips.js'));
const api=global.OWM.swordClips;
assert(api&&api.clips&&typeof api.sample==='function','OWM.swordClips não foi registrado');
assert.deepEqual(api.order,['hip','upper','hm','LA','LE','RA','RE','LL','LK','RL','RK']);
const bounds=[[-.12001,.34001],[-.34001,.00001],[-.72001,-.19999]];
function smooth(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)}
function clipWeight(c,t){return smooth(t/.09)*(1-smooth((t-(c.dur-.20))/.20))}
function quatEulerXYZ(x,y,z){const c1=Math.cos(x/2),c2=Math.cos(y/2),c3=Math.cos(z/2),s1=Math.sin(x/2),s2=Math.sin(y/2),s3=Math.sin(z/2);return new Quaternion(s1*c2*c3+c1*s2*s3,c1*s2*c3-s1*c2*s3,c1*c2*s3+s1*s2*c3,c1*c2*c3-s1*s2*s3).normalize()}
const guard={RA:quatEulerXYZ(-.95,.25,-.12),RE:quatEulerXYZ(-1.3,0,0),LA:quatEulerXYZ(-.35,0,.15),LE:quatEulerXYZ(-.9,0,0)};
const boneIndex={LA:3,LE:4,RA:5,RE:6};
let totalFrames=0;
for(const id of ['lmb','m1','m2']){
 const c=api.clips[id];assert(c,'clip ausente: '+id);
 assert.equal(c.data.length,c.frames*53,id+': stride/contagem incorreta');
 assert(Math.abs(c.dur-(c.frames-1)/30)<1e-7,id+': duração incorreta');
 assert(c.hit>=0&&c.hit<=c.dur,id+': hit fora da duração');
 assert(Number.isFinite(c.travel)&&c.travel>=0,id+': travel inválido');
 assert(c.speed>0,id+': velocidade inválida');
 const impactTime=c.hit/c.speed;assert(impactTime>=.18&&impactTime<=.26,id+': acerto fora de 0,18–0,26s ('+impactTime.toFixed(3)+'s)');
 let maxAngle=0,maxGuardAngle=0;
 for(let f=0;f<c.frames;f++){
  const o=f*53,d=c.data;
  for(let k=0;k<53;k++)assert(Number.isFinite(d[o+k]),id+': NaN/Inf frame '+f+' valor '+k);
  assert.equal(d[o],0,id+': X do quadril não é zero no frame '+f);
  assert.equal(d[o+2],0,id+': Z do quadril não é zero no frame '+f);
  assert(Math.abs(d[o+1])<=.5+1e-4,id+': Y do quadril fora de ±0,5 m no frame '+f);
  for(let b=0;b<11;b++){
   const p=o+3+b*4,qx=d[p],qy=d[p+1],qz=d[p+2],qw=d[p+3];
   const n=Math.hypot(qx,qy,qz,qw);
   assert(Math.abs(n-1)<=.001,id+': quaternion '+b+' não unitário frame '+f);
   assert(qw>=-1e-5,id+': quaternion '+b+' com w negativo frame '+f);
   if(f){
    const po=o-53+3+b*4,dot=Math.abs(d[po]*qx+d[po+1]*qy+d[po+2]*qz+d[po+3]*qw);
    maxAngle=Math.max(maxAngle,2*Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI);
   }
  }
  if(f===c.frames-1){for(const name of Object.keys(guard)){const p=o+3+boneIndex[name]*4,g=guard[name],dot=Math.abs(d[p]*g.x+d[p+1]*g.y+d[p+2]*g.z+d[p+3]*g.w);maxGuardAngle=Math.max(maxGuardAngle,2*Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI)}}
  for(let k=0;k<3;k++)assert(d[o+47+k]>=bounds[k][0]&&d[o+47+k]<=bounds[k][1],id+': FP fora do envelope frame '+f);
 }
 assert(maxAngle<90,id+': salto angular '+maxAngle.toFixed(2)+'°');
 assert(maxGuardAngle<90,id+': último frame distante da guarda ('+maxGuardAngle.toFixed(2)+'°)');
 const qs=Array.from({length:11},()=>new Quaternion()),pos={set(x,y,z){this.x=x;this.y=y;this.z=z;return this}},fp=new Float32Array(6);
 for(let f=0;f<c.frames;f++){
  assert(api.sample(id,f/30,qs,pos,fp),id+': sample falhou frame '+f);
  for(let b=0;b<11;b++)assert(Math.abs(Math.hypot(qs[b].x,qs[b].y,qs[b].z,qs[b].w)-1)<.001,id+': sample gerou quaternion inválido');
  for(const v of [...fp,pos.x,pos.y,pos.z])assert(Number.isFinite(v),id+': sample gerou valor não finito');
 }
 assert.equal(clipWeight(c,c.dur),0,id+': blend não termina na guarda');
 assert(Math.abs(clipWeight(c,c.dur-.20)-1)<1e-6,id+': blend não cobre os últimos 0,20s');
 totalFrames+=c.frames;
 console.log(id+': OK · '+c.frames+' frames · dur '+c.dur.toFixed(3)+'s · hit '+c.hit.toFixed(3)+'s · travel '+c.travel.toFixed(3)+'m · salto máx '+maxAngle.toFixed(2)+'° · guarda final '+maxGuardAngle.toFixed(1)+'°');
}
assert.equal(totalFrames,61);
console.log('TESTE OK: '+totalFrames+' frames, 53 valores/frame, sem NaN, root XZ=0 e quaternions unitários.');
