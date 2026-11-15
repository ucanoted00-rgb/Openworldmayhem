/* OWM — animações reais dos três GLBs fornecidos pelo usuário, retargetadas ao rig de 11 ossos.
   Frame: root translation (3), 11 local quaternions (44), mão de primeira pessoa (6).
*/
(()=>{
'use strict';
const OWM=window.OWM||(window.OWM={}),STRIDE=53;
function decode(b64){const s=atob(b64),bytes=new Uint8Array(s.length);for(let i=0;i<s.length;i++)bytes[i]=s.charCodeAt(i);const src=new Int16Array(bytes.buffer),out=new Float32Array(src.length);for(let i=0;i<src.length;i++){const k=i%STRIDE;out[i]=src[i]/(k<3?10000:k<47?32767:8000)}return out}
const clips={
m1:{dur:0.86666667,frames:27,hit:0.2333333,source:"Punch_-_jab_left_2.glb",data:decode(
"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"
)},
m2:{dur:0.46666667,frames:15,hit:0.2666667,source:"Punch_-_hook_right_2.glb",data:decode(
"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"
)},
lmb:{dur:0.93333334,frames:29,hit:0.2333333,source:"Punch_-_cross_right_2.glb",data:decode(
"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" +
"7nqOBhv5LvK4/wAALQA="
)},
};
const qa=new THREE.Quaternion(),qb=new THREE.Quaternion();
function sample(id,t,outQ,outPos,outFP){const c=clips[id];if(!c)return false;const f=Math.max(0,Math.min(c.frames-1,(+t||0)/c.dur*(c.frames-1))),i=Math.floor(f),j=Math.min(c.frames-1,i+1),u=f-i,a=i*STRIDE,b=j*STRIDE,d=c.data;if(outPos)outPos.set(d[a]+(d[b]-d[a])*u,d[a+1]+(d[b+1]-d[a+1])*u,d[a+2]+(d[b+2]-d[a+2])*u);if(outQ){
 const targetOrder=OWM.ual&&OWM.ual.ORDER;
 for(let k=0;k<outQ.length;k++){
  const sourceBone=targetOrder?order.indexOf(targetOrder[k]):k;
  if(sourceBone<0)continue;
  const x=a+3+sourceBone*4,y=b+3+sourceBone*4;
  qa.set(d[x],d[x+1],d[x+2],d[x+3]);
  qb.set(d[y],d[y+1],d[y+2],d[y+3]);
  outQ[k].copy(qa).slerp(qb,u);
 }
}if(outFP){const x=a+47,y=b+47;for(let k=0;k<6;k++)outFP[k]=d[x+k]+(d[y+k]-d[x+k])*u}return true}
const order=['hip','upper','hm','LA','LE','RA','RE','LL','LK','RL','RK'];
OWM.punchClips={order,clips,sample};
})();