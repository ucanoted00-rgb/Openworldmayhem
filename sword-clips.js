/* OWM — Sword GLB clips retargeted offline to the 11-bone avatar rig.
   Regenerate: python3 convert_sword.py . sword-clips.js
   Requires the 3 source GLBs beside the script and the unchanged convert_punches.py retarget implementation.
   Frame: pelvis translation (3), 11 absolute bind-space local quaternions (44), FP hand pose (6).
*/
(()=>{
'use strict';
const OWM=window.OWM||(window.OWM={}),STRIDE=53;
function decode(b64){const s=atob(b64),bytes=new Uint8Array(s.length);for(let i=0;i<s.length;i++)bytes[i]=s.charCodeAt(i);const src=new Int16Array(bytes.buffer),out=new Float32Array(src.length);for(let i=0;i<src.length;i++){const k=i%STRIDE;out[i]=src[i]/(k<3?10000:k<47?32767:8000)}return out}
const clips={
lmb:{"dur":0.73333333,"frames":23,"hit":0.36666667,"speed":1.5,"travel":0.95397,"source":"Sword_-_slash.glb","fallbackFrames":[0,1,2,3,4,5,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22],data:decode(
"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" +
"wPkAAAAAAAA="
)},
m1:{"dur":0.53333333,"frames":17,"hit":0.23333333,"speed":1.25,"travel":0.02626,"source":"Sword_-_slash_B.glb","fallbackFrames":[0,1,2,3,4,5,6,8,9,10,11,12,13,14,15,16],data:decode(
"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" +
"AAA="
)},
m2:{"dur":0.66666667,"frames":21,"hit":0.3,"speed":1.2,"travel":3.78331,"source":"Sword_-_dash_slash.glb","fallbackFrames":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],data:decode(
"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"
)}
};
const qa=new THREE.Quaternion(),qb=new THREE.Quaternion();
const order=['hip','upper','hm','LA','LE','RA','RE','LL','LK','RL','RK'];
function sample(id,t,outQ,outPos,outFP){
 const c=clips[id];if(!c)return false;
 const f=Math.max(0,Math.min(c.frames-1,(+t||0)*30)),i=Math.floor(f),j=Math.min(c.frames-1,i+1),u=f-i,a=i*STRIDE,b=j*STRIDE,d=c.data;
 if(outPos)outPos.set(d[a]+(d[b]-d[a])*u,d[a+1]+(d[b+1]-d[a+1])*u,d[a+2]+(d[b+2]-d[a+2])*u);
 if(outQ){
  const targetOrder=OWM.ual&&OWM.ual.ORDER;
  for(let k=0;k<outQ.length;k++){
   const sourceBone=targetOrder?order.indexOf(targetOrder[k]):k;if(sourceBone<0)continue;
   const x=a+3+sourceBone*4,y=b+3+sourceBone*4;
   qa.set(d[x],d[x+1],d[x+2],d[x+3]).normalize();
   qb.set(d[y],d[y+1],d[y+2],d[y+3]).normalize();
   outQ[k].copy(qa).slerp(qb,u).normalize();
  }
 }
 if(outFP){const x=a+47,y=b+47;for(let k=0;k<6;k++)outFP[k]=d[x+k]+(d[y+k]-d[x+k])*u}
 return true;
}
OWM.swordClips={order,clips,sample};
})();
