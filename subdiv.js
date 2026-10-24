/* Open World Mayhem — subdivisão de malha (Loop) para o personagem.
   Solda os vértices duplicados do modelo original, subdivide N vezes (cada nível = 4x triângulos), interpola os pesos de skin
   e recalcula normais suaves. "tension" (0..1) mistura a posição suavizada com a linear, pra o modelo não encolher/arredondar demais. */
(()=>{
const EK=(a,b)=>a<b?a*4194304+b:b*4194304+a;   // chave de aresta (cabe em 2^53 enquanto houver < 4M vértices)

function weld(P){
 const m=new Map(),pos=[],si=[],sw=[],rem=new Uint32Array(P.pos.length/3);
 for(let i=0;i<rem.length;i++){
  const x=P.pos[i*3],y=P.pos[i*3+1],z=P.pos[i*3+2],k=Math.round(x*2e4)+','+Math.round(y*2e4)+','+Math.round(z*2e4);
  let j=m.get(k);
  if(j===undefined){j=pos.length/3;m.set(k,j);pos.push(x,y,z);for(let q=0;q<4;q++){si.push(P.si[i*4+q]);sw.push(P.sw[i*4+q])}}
  rem[i]=j;
 }
 const idx=[],seen=new Set();
 for(let t=0;t<P.idx.length;t+=3){
  const a=rem[P.idx[t]],b=rem[P.idx[t+1]],c=rem[P.idx[t+2]];
  if(a===b||b===c||a===c)continue;
  const fk=[a,b,c].sort((u,v)=>u-v).join(',');if(seen.has(fk))continue;seen.add(fk);   // descarta faces repetidas
  idx.push(a,b,c);
 }
 return{pos:Float32Array.from(pos),si:Uint16Array.from(si),sw:Float32Array.from(sw),idx:Uint32Array.from(idx)};
}

/* mistura os pesos de skin de dois vértices (média), mantém os 4 maiores e normaliza */
function mixSkin(si,sw,a,b,oS,oW,o){
 const acc=new Map();
 for(let q=0;q<4;q++){
  const wa=sw[a*4+q]*.5,wb=sw[b*4+q]*.5;
  if(wa>0)acc.set(si[a*4+q],(acc.get(si[a*4+q])||0)+wa);
  if(wb>0)acc.set(si[b*4+q],(acc.get(si[b*4+q])||0)+wb);
 }
 const arr=[...acc].sort((u,v)=>v[1]-u[1]).slice(0,4);let s=0;for(const e of arr)s+=e[1];
 for(let q=0;q<4;q++){const e=arr[q];oS[o*4+q]=e?e[0]:0;oW[o*4+q]=e&&s>0?e[1]/s:0}
}

function loop(M,tension){
 const n=M.pos.length/3,F=M.idx,nf=F.length/3,pos=M.pos;
 const edges=new Map();   // chave → {a,b,opp:[...],mid}
 for(let f=0;f<nf;f++){
  const v=[F[f*3],F[f*3+1],F[f*3+2]];
  for(let e=0;e<3;e++){
   const a=v[e],b=v[(e+1)%3],c=v[(e+2)%3],k=EK(a,b);let E=edges.get(k);
   if(!E){E={a:Math.min(a,b),b:Math.max(a,b),opp:[],mid:-1};edges.set(k,E)}
   E.opp.push(c);
  }
 }
 const nb=Array.from({length:n},()=>new Set()),crease=new Uint8Array(n),bn=Array.from({length:n},()=>[]);
 for(const E of edges.values()){
  nb[E.a].add(E.b);nb[E.b].add(E.a);
  if(E.opp.length!==2){crease[E.a]=crease[E.b]=1;bn[E.a].push(E.b);bn[E.b].push(E.a)}   // borda ou aresta não-manifold
 }
 const nn=n+edges.size,np=new Float32Array(nn*3),nsi=new Uint16Array(nn*4),nsw=new Float32Array(nn*4);
 nsi.set(M.si);nsw.set(M.sw);
 const t=tension;
 /* vértices antigos */
 for(let i=0;i<n;i++){
  const x=pos[i*3],y=pos[i*3+1],z=pos[i*3+2];let px=x,py=y,pz=z;
  if(crease[i]){
   if(bn[i].length===2){
    const a=bn[i][0],b=bn[i][1];
    px=.75*x+.125*(pos[a*3]+pos[b*3]);py=.75*y+.125*(pos[a*3+1]+pos[b*3+1]);pz=.75*z+.125*(pos[a*3+2]+pos[b*3+2]);
   }
  }else{
   const k=nb[i].size,beta=k===3?3/16:3/(8*k);let sx=0,sy=0,sz=0;
   for(const j of nb[i]){sx+=pos[j*3];sy+=pos[j*3+1];sz+=pos[j*3+2]}
   px=(1-k*beta)*x+beta*sx;py=(1-k*beta)*y+beta*sy;pz=(1-k*beta)*z+beta*sz;
  }
  np[i*3]=x+(px-x)*t;np[i*3+1]=y+(py-y)*t;np[i*3+2]=z+(pz-z)*t;
 }
 /* vértices de aresta */
 let c=n;
 for(const E of edges.values()){
  const a=E.a,b=E.b;E.mid=c;
  let lx=(pos[a*3]+pos[b*3])/2,ly=(pos[a*3+1]+pos[b*3+1])/2,lz=(pos[a*3+2]+pos[b*3+2])/2,x=lx,y=ly,z=lz;
  if(E.opp.length===2){
   const p=E.opp[0],q=E.opp[1];
   x=.375*(pos[a*3]+pos[b*3])+.125*(pos[p*3]+pos[q*3]);y=.375*(pos[a*3+1]+pos[b*3+1])+.125*(pos[p*3+1]+pos[q*3+1]);z=.375*(pos[a*3+2]+pos[b*3+2])+.125*(pos[p*3+2]+pos[q*3+2]);
  }
  np[c*3]=lx+(x-lx)*t;np[c*3+1]=ly+(y-ly)*t;np[c*3+2]=lz+(z-lz)*t;
  mixSkin(M.si,M.sw,a,b,nsi,nsw,c);
  c++;
 }
 /* faces: 1 → 4 */
 const ni=new Uint32Array(nf*12);let o=0;
 for(let f=0;f<nf;f++){
  const a=F[f*3],b=F[f*3+1],d=F[f*3+2],ab=edges.get(EK(a,b)).mid,bc=edges.get(EK(b,d)).mid,ca=edges.get(EK(d,a)).mid;
  ni[o++]=a;ni[o++]=ab;ni[o++]=ca;ni[o++]=b;ni[o++]=bc;ni[o++]=ab;ni[o++]=d;ni[o++]=ca;ni[o++]=bc;ni[o++]=ab;ni[o++]=bc;ni[o++]=ca;
 }
 return{pos:np,si:nsi,sw:nsw,idx:ni};
}

/* normais suaves ponderadas pelo ângulo */
function normals(M){
 const n=M.pos.length/3,p=M.pos,F=M.idx,N=new Float32Array(n*3);
 for(let f=0;f<F.length;f+=3){
  const t=[F[f],F[f+1],F[f+2]];
  for(let e=0;e<3;e++){
   const a=t[e],b=t[(e+1)%3],c=t[(e+2)%3];
   const ux=p[b*3]-p[a*3],uy=p[b*3+1]-p[a*3+1],uz=p[b*3+2]-p[a*3+2],vx=p[c*3]-p[a*3],vy=p[c*3+1]-p[a*3+1],vz=p[c*3+2]-p[a*3+2];
   const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,nl=Math.hypot(nx,ny,nz);if(nl<1e-12)continue;
   const lu=Math.hypot(ux,uy,uz),lv=Math.hypot(vx,vy,vz);if(lu<1e-9||lv<1e-9)continue;
   const ang=Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy+uz*vz)/(lu*lv))));
   N[a*3]+=nx/nl*ang;N[a*3+1]+=ny/nl*ang;N[a*3+2]+=nz/nl*ang;
  }
 }
 for(let i=0;i<n;i++){const l=Math.hypot(N[i*3],N[i*3+1],N[i*3+2])||1;N[i*3]/=l;N[i*3+1]/=l;N[i*3+2]/=l}
 return N;
}

/* P: {pos,idx,si,sw} do modelo original. levels: 0 = só solda e suaviza normais; 1 = 4x; 2 = 16x. */
function subdivide(P,levels,tension){
 let M=weld(P);
 for(let i=0;i<levels;i++)M=loop(M,tension==null?.7:tension);
 M.nrm=normals(M);
 return M;
}
(window.OWM||(window.OWM={})).subdiv=subdivide;
})();
