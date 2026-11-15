
OWM.Zombie=(function(THREE){
 const PK=OWM.zombiePack,M=PK.mesh,SK=PK.skel,NB=SK.par.length,TJ=PK.tj,NT=TJ.length,FPS=PK.fps,PL=NB*4+NT*3;
 const u8=(s,T)=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return new T(u.buffer)};
 const f32=s=>u8(s,Float32Array);
 /* geometria compartilhada entre todos os zumbis */
 const geo=(()=>{const g=new THREE.BufferGeometry(),p=u8(M.pos,Int16Array),n=u8(M.nor,Int8Array),uv=u8(M.uv,Uint16Array),j=u8(M.jnt,Uint8Array),w=u8(M.wgt,Uint8Array),
   P=new Float32Array(p.length),Nn=new Float32Array(n.length),UV=new Float32Array(uv.length),J=new Uint16Array(j.length),W=new Float32Array(w.length);
  for(let i=0;i<p.length;i++){P[i]=p[i]/M.sc;Nn[i]=n[i]/127}for(let i=0;i<uv.length;i++)UV[i]=uv[i]/65535;for(let i=0;i<j.length;i++){J[i]=j[i];W[i]=w[i]/255}
  g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(Nn,3));g.setAttribute('uv',new THREE.BufferAttribute(UV,2));
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(J,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(W,4));
  g.setIndex(new THREE.BufferAttribute(u8(M.idx,Uint16Array),1));g.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,12,3),60);return g})();
 const T=f32(SK.t),Q=f32(SK.q),S=f32(SK.s),IBM=f32(SK.ibm),inv=[];
 for(let k=0;k<NB;k++)inv.push(new THREE.Matrix4().fromArray(IBM,k*16));
 /* clipes: q int16/32767 [n][NB][4], t int16/1000 [n][NT][3]. Idle/Walk em loop; Attack/Death tocam uma vez (Death fica no último quadro). "run" = Walk. */
 const CL={};
 for(const n in PK.clips){const c=PK.clips[n],a=u8(c.q,Int16Array),q=new Float32Array(a.length),b=u8(c.t,Int16Array),t=new Float32Array(b.length);
  for(let i=0;i<a.length;i++)q[i]=a[i]/32767;for(let i=0;i<b.length;i++)t[i]=b[i]/1000;
  const loop=!!c.loop;CL[n]={n:c.n,loop,q,t,len:loop?c.n/FPS:(c.n-1)/FPS,hit:n==='attack'?PK.hit:null};CL[n].dur=CL[n].len}
 CL.run=CL.walk;
 const tex=new THREE.TextureLoader().load(PK.tex);tex.flipY=false;tex.encoding=THREE.sRGBEncoding;
 try{tex.anisotropy=Math.min(4,OWM.R.capabilities.getMaxAnisotropy())}catch(e){}
 const mat=new THREE.MeshStandardMaterial({map:tex,roughness:.88,metalness:0,side:THREE.DoubleSide,skinning:true});
 const qa=new THREE.Quaternion(),qb=new THREE.Quaternion();
 function sample(c,ts,out){   // pose do clipe no instante ts (s)
  let f=ts*FPS,i0=Math.floor(f),a=f-i0,i1=i0+1;
  if(c.loop){i0=((i0%c.n)+c.n)%c.n;i1=(i0+1)%c.n}else if(i0>=c.n-1){i0=i1=c.n-1;a=0}else if(i0<0){i0=i1=0;a=0}
  const cq=c.q,ct=c.t;
  for(let b=0;b<NB;b++){const o0=(i0*NB+b)*4,o1=(i1*NB+b)*4;let x=cq[o0],y=cq[o0+1],z=cq[o0+2],w=cq[o0+3],X=cq[o1],Y=cq[o1+1],Z=cq[o1+2],W=cq[o1+3];
   if(x*X+y*Y+z*Z+w*W<0){X=-X;Y=-Y;Z=-Z;W=-W}
   x+=(X-x)*a;y+=(Y-y)*a;z+=(Z-z)*a;w+=(W-w)*a;const l=1/Math.hypot(x,y,z,w);out[b*4]=x*l;out[b*4+1]=y*l;out[b*4+2]=z*l;out[b*4+3]=w*l}
  for(let k=0;k<NT*3;k++){const o0=i0*NT*3+k,o1=i1*NT*3+k;out[NB*4+k]=ct[o0]+(ct[o1]-ct[o0])*a}
 }
 function create(){
  const bones=[];for(let k=0;k<NB;k++){const b=new THREE.Bone();b.position.fromArray(T,k*3);b.quaternion.fromArray(Q,k*4);b.scale.fromArray(S,k*3);bones.push(b)}
  let rootBone=null;for(let k=0;k<NB;k++){if(SK.par[k]>=0)bones[SK.par[k]].add(bones[k]);else rootBone=bones[k]}
  const m=mat.clone(),mesh=new THREE.SkinnedMesh(geo,m);mesh.add(rootBone);mesh.bind(new THREE.Skeleton(bones,inv),new THREE.Matrix4());mesh.frustumCulled=false;
  const group=new THREE.Group();group.add(mesh);
  const snap=new Float32Array(PL),pose=new Float32Array(PL);let cur=null,t=0,fade=0,fadeT=0,hitDone=false;
  function apply(p){for(let b=0;b<NB;b++)bones[b].quaternion.set(p[b*4],p[b*4+1],p[b*4+2],p[b*4+3]);for(let k=0;k<NT;k++)bones[TJ[k]].position.set(p[NB*4+k*3],p[NB*4+k*3+1],p[NB*4+k*3+2])}
  const inst={group,mesh,mat:m,get clip(){return cur&&cur.name},
   play(name,fadeTime,restart){const c=CL[name];if(!c)return;if(cur&&cur.name===name&&!restart)return;if(cur){snap.set(pose);fade=fadeTime==null?.15:fadeTime;fadeT=0}
    cur={name,c};hitDone=false;t=c.loop?Math.random()*c.len:0},   // loops começam em fases diferentes (zumbis não andam em sincronia)
   /* avança o clipe; devolve true no quadro do golpe (máxima extensão do braço) */
   update(dt,speed){if(!cur)return false;const c=cur.c;let ev=false;t+=dt*(speed||1);
    if(c.loop)t%=c.len;else{if(t>c.len)t=c.len;if(c.hit!=null&&!hitDone&&t/c.len>=c.hit){hitDone=true;ev=true}}
    sample(c,t,pose);
    if(fade>0){fadeT+=dt;const k=Math.min(1,fadeT/fade);if(k>=1)fade=0;else{
     for(let b=0;b<NB;b++){qa.fromArray(snap,b*4);qb.fromArray(pose,b*4);qa.slerp(qb,k);pose[b*4]=qa.x;pose[b*4+1]=qa.y;pose[b*4+2]=qa.z;pose[b*4+3]=qa.w}
     for(let k2=NB*4;k2<PL;k2++)pose[k2]=snap[k2]+(pose[k2]-snap[k2])*k}}
    apply(pose);return ev},
   set coil(v){},get coil(){return 0},   // sem enrolar (API comum das espécies)
   get done(){return !!cur&&!cur.c.loop&&t>=cur.c.len},get time(){return t},dur(n){return CL[n].len},
   dispose(){m.dispose()}};
  return inst;
 }
 return{create,clips:CL,SCALE:PK.sc,bbox:PK.bbox,walkV0:PK.walkV0};
});
