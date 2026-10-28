/* Open World Mayhem — estilos de cabelo procedurais para o personagem low poly.
   Cada estilo gera uma malha (pos/idx/si/sw) em coordenadas do modelo, toda presa ao osso da cabeça (hm).
   A tabela HEAD_R guarda o raio da cabeça (medido por raycast no modelo) por azimute × elevação, então os cabelos
   "abraçam" o crânio de verdade. Usado por playeranim.js (OWM.anim.setHair) e pelo criador de personagem. */
(()=>{
const OWM=window.OWM||(window.OWM={});
const PI=Math.PI,TAU=PI*2,D=PI/180;
const HC=[0,1.70,0],TH=24,PH=[-15,0,15,30,45,60,75,90];
const HEAD_R=[[0.1159,0.0905,0.087,0.0757,0.0672,0.0642,0.0664,0.0669,0.069,0.0768,0.0891,0.0886,0.0901,0.0886,0.0891,0.0768,0.069,0.0669,0.0664,0.0642,0.0672,0.0757,0.087,0.0905],[0.0953,0.085,0.0843,0.0754,0.068,0.0654,0.068,0.0681,0.0701,0.0778,0.0915,0.0938,0.0961,0.0938,0.0915,0.0778,0.0701,0.0681,0.068,0.0654,0.068,0.0754,0.0843,0.085],[0.0977,0.0929,0.0903,0.0812,0.0713,0.0697,0.0723,0.0745,0.0769,0.0857,0.0967,0.1,0.1046,0.1,0.0967,0.0857,0.0769,0.0745,0.0723,0.0697,0.0713,0.0812,0.0903,0.0929],[0.1023,0.0958,0.0929,0.0899,0.081,0.0781,0.0797,0.0821,0.0858,0.0964,0.1061,0.1092,0.1127,0.1092,0.1061,0.0964,0.0858,0.0821,0.0797,0.0781,0.081,0.0899,0.0929,0.0958],[0.1155,0.1091,0.1019,0.0977,0.0927,0.0895,0.0922,0.0947,0.098,0.1078,0.1159,0.1198,0.1219,0.1198,0.1159,0.1078,0.098,0.0947,0.0922,0.0895,0.0927,0.0977,0.1019,0.1091],[0.1173,0.1137,0.1117,0.111,0.1124,0.1141,0.1163,0.1193,0.1211,0.1211,0.1235,0.1272,0,0.1272,0.1235,0.1211,0.1211,0.1193,0.1163,0.1141,0.1124,0.111,0.1117,0.1137],[0.1208,0.1187,0.1178,0.1172,0.1171,0.1177,0.1188,0.1195,0.1193,0.1195,0.1203,0.1223,0.1246,0.1223,0.1203,0.1195,0.1193,0.1195,0.1188,0.1177,0.1171,0.1172,0.1178,0.1187],[0.1207,0.1207,0.1207,0.1207,0.1207,0.1207,0.1207,0.1207,0.1207,0.1207,0.1207,0.1207,0.1207,0.1207,0.1207,0.1207,0.1207,0.1207,0.1207,0.1207,0.1207,0.1207,0.1207,0.1207]];
/* conserta buracos (0) da medição com a média dos vizinhos */
for(const row of HEAD_R)for(let k=0;k<TH;k++)if(!row[k]){let a=row[(k+TH-1)%TH],b=row[(k+1)%TH];if(!a)a=b;if(!b)b=a;row[k]=(a+b)/2||.1}

const lerp=(a,b,t)=>a+(b-a)*t,cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const ss=t=>{t=cl(t,0,1);return t*t*(3-2*t)};
const tri=x=>Math.abs(((x%1)+1)%1*2-1)*2-1;     // onda triangular -1..1
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l]};

/* raio da cabeça na direção (th rad, ph graus) */
function headR(th,ph){
 th=((th%TAU)+TAU)%TAU;const u=th/TAU*TH,i0=Math.floor(u)%TH,i1=(i0+1)%TH,fu=u-Math.floor(u);
 ph=cl(ph,PH[0],90);let j=0;while(j<PH.length-2&&ph>PH[j+1])j++;
 const fv=(ph-PH[j])/(PH[j+1]-PH[j]),A=HEAD_R[j],B=HEAD_R[j+1];
 return lerp(lerp(A[i0],A[i1],fu),lerp(B[i0],B[i1],fu),fv);
}
/* ponto na superfície da cabeça (+off para fora) */
function P(th,ph,off=0){
 const r=headR(th,ph)+off,p=ph*D,c=Math.cos(p);
 return[HC[0]+Math.sin(th)*c*r,HC[1]+Math.sin(p)*r,HC[2]+Math.cos(th)*c*r];
}
const dirOf=(th,ph)=>{const p=ph*D,c=Math.cos(p);return[Math.sin(th)*c,Math.sin(p),Math.cos(th)*c]};

/* ---------- construtor de malha ---------- */
function Mb(){return{pos:[],idx:[]}}
const vtx=(m,p)=>{m.pos.push(p[0],p[1],p[2]);return m.pos.length/3-1};
function grid(m,nu,nv,closeU,fn){
 const sw=closeU?nu:nu+1,base=m.pos.length/3;
 for(let j=0;j<=nv;j++)for(let i=0;i<sw;i++)vtx(m,fn(i,j));
 const id=(i,j)=>base+(closeU?i%nu:i)+j*sw;
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
  const a=id(i,j),b=id(i+1,j),c=id(i+1,j+1),d=id(i,j+1);
  m.idx.push(a,b,c,a,c,d);
 }
}
/* junta "piece" em "into", orientando as faces para fora do ponto de referência */
function merge(into,piece,ref){
 const n=piece.pos.length/3;if(!n)return;
 if(!ref){ref=[0,0,0];for(let i=0;i<n;i++){ref[0]+=piece.pos[i*3]/n;ref[1]+=piece.pos[i*3+1]/n;ref[2]+=piece.pos[i*3+2]/n}}
 let s=0;const ix=piece.idx,p=piece.pos;
 for(let t=0;t<ix.length;t+=3){
  const a=ix[t]*3,b=ix[t+1]*3,c=ix[t+2]*3;
  const A=[p[a],p[a+1],p[a+2]],B=[p[b],p[b+1],p[b+2]],C=[p[c],p[c+1],p[c+2]];
  const nn=cross(sub(B,A),sub(C,A)),cen=[(A[0]+B[0]+C[0])/3-ref[0],(A[1]+B[1]+C[1])/3-ref[1],(A[2]+B[2]+C[2])/3-ref[2]];
  s+=nn[0]*cen[0]+nn[1]*cen[1]+nn[2]*cen[2];
 }
 const off=into.pos.length/3;
 for(let i=0;i<p.length;i++)into.pos.push(p[i]);
 for(let t=0;t<ix.length;t+=3){
  if(s>=0)into.idx.push(ix[t]+off,ix[t+1]+off,ix[t+2]+off);else into.idx.push(ix[t]+off,ix[t+2]+off,ix[t+1]+off);
 }
}

/* ---------- peças ---------- */
const rimF=(f,s,b,jag=0,k=0)=>th=>{const c=Math.cos(th);let r=c>=0?s+(f-s)*c:s+(b-s)*(-c);if(jag)r+=jag*tri(th/TAU*k);return r};
/* calota que cobre o topo da cabeça */
function cap(into,o){
 const nu=o.nu||28,nv=o.nv||6,m=Mb();
 grid(m,nu,nv,true,(i,j)=>{
  const th=i/nu*TAU,rim=o.rim(th),ph=90-(90-rim)*(j/nv),k=Math.sin(ph*D);
  const grooves=(o.groove||0)*Math.sin(th*(o.grooveCount||8)+ph*.075+Math.sin(th*2)*.22)*ss((ph-rim+5)/18);
  return P(th,ph,(o.th0==null?.011:o.th0)+(o.vol||0)*k*k+(o.bump?o.bump(th,ph):0)+grooves);
 });
 merge(into,m,HC);
}
/* cortina de cabelo com espessura real e bordas fechadas (chanel / longo).
   Antes era só uma folha de triângulos: vista de certos ângulos, a ponta parecia furada.
   Agora há pele exterior + interior e paredes ligando todas as bordas. */
function curtain(into,o){
 const nu=o.nu||22,nv=o.nv||5,thick=o.thickness||.008,m=Mb();
 const cols=nu+1,rows=nv+1,layer=cols*rows,base=0;
 const point=(i,j,side)=>{
  const u=i/nu,th=lerp(o.t0,o.t1,u),f=j/nv;
  const s=P(th,o.rim(th),o.th0==null?.011:o.th0),r0=Math.hypot(s[0],s[2]);
  // Pequenas mechas esculpidas ao longo do cabelo, sem criar pontas abertas.
  const locks=(o.locks===false?0:(o.lockAmp==null?.0015:o.lockAmp))*Math.sin(u*TAU*(o.lockCount||5)+.35)*Math.pow(Math.sin(Math.PI*f),.7);
  const r=lerp(r0,o.rEnd(th),Math.pow(f,.75))+locks+side*thick*.5;
  const y=lerp(s[1],o.yEnd(th)+(o.jag?o.jag*tri(th/TAU*o.jagK):0),f);
  return[Math.sin(th)*r,y,Math.cos(th)*r];
 };
 for(let side of [1,-1])for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)vtx(m,point(i,j,side));
 const id=(side,i,j)=>base+(side===1?0:layer)+j*cols+i;
 const quad=(a,b,c,d)=>m.idx.push(a,b,c,a,c,d);
 // Face exterior e face interior com winding oposto.
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
  const a=id(1,i,j),b=id(1,i+1,j),c=id(1,i+1,j+1),d=id(1,i,j+1);
  quad(a,b,c,d);
  const ia=id(-1,i,j),ib=id(-1,i+1,j),ic=id(-1,i+1,j+1),idd=id(-1,i,j+1);
  m.idx.push(ia,ic,ib,ia,idd,ic);
 }
 // Paredes laterais e bordas superior/inferior: malha fechada, sem abertura nas pontas.
 for(let j=0;j<nv;j++){
  quad(id(1,0,j),id(1,0,j+1),id(-1,0,j+1),id(-1,0,j));
  quad(id(1,nu,j),id(-1,nu,j),id(-1,nu,j+1),id(1,nu,j+1));
 }
 for(let i=0;i<nu;i++){
  quad(id(1,i,0),id(1,i+1,0),id(-1,i+1,0),id(-1,i,0));
  quad(id(1,i,nv),id(-1,i,nv),id(-1,i+1,nv),id(1,i+1,nv));
 }
 merge(into,m,[0,1.55,0]);
}
/* tubo ao longo de um caminho (rabo de cavalo, maria-chiquinha, topete) */
function tube(into,path,rad,sides=7){
 const m=Mb(),n=path.length;
 let prevX=null;
 for(let k=0;k<n;k++){
  const t=nrm(sub(path[Math.min(n-1,k+1)],path[Math.max(0,k-1)]));
  let ex=cross(t,Math.abs(t[1])>.95?[1,0,0]:[0,1,0]);ex=nrm(ex);
  const ey=nrm(cross(ex,t)),r=rad(k/(n-1));
  for(let q=0;q<sides;q++){const a=q/sides*TAU;vtx(m,add(path[k],add(mul(ex,Math.cos(a)*r),mul(ey,Math.sin(a)*r))))}
 }
 for(let k=0;k<n-1;k++)for(let q=0;q<sides;q++){
  const a=k*sides+q,b=k*sides+(q+1)%sides,c=(k+1)*sides+(q+1)%sides,d=(k+1)*sides+q;
  m.idx.push(a,b,c,a,c,d);
 }
 // tampas
 const c0=vtx(m,path[0]),c1=vtx(m,path[n-1]);
 for(let q=0;q<sides;q++){m.idx.push(c0,(q+1)%sides,q);m.idx.push(c1,(n-1)*sides+q,(n-1)*sides+(q+1)%sides)}
 merge(into,m,null);
}
/* esfera/bolha (coque, afro) */
function blob(into,c,rx,ry,rz,nu=12,nv=7,noise=0,seed=1){
 const m=Mb();
 grid(m,nu,nv,true,(i,j)=>{
  const a=i/nu*TAU,b=PI*j/nv-PI/2,cb=Math.cos(b);
  const nz=noise?1+noise*Math.sin(a*3+b*5+seed)*Math.cos(b*4-a*2+seed*2):1;
  return[c[0]+Math.sin(a)*cb*rx*nz,c[1]+Math.sin(b)*ry*nz,c[2]+Math.cos(a)*cb*rz*nz];
 });
 merge(into,m,c);
}
/* espeto (cone) sobre a cabeça */
function spike(into,th,ph,rad,len,lean=0,sides=6){
 const p=P(th,ph,-.004),n=dirOf(th,ph);
 const ex=nrm(cross(n,Math.abs(n[1])>.95?[1,0,0]:[0,1,0])),ey=nrm(cross(ex,n));
 const m=Mb(),ap=add(add(p,mul(n,len)),mul(ex,lean));
 for(let q=0;q<sides;q++){const a=q/sides*TAU;vtx(m,add(p,add(mul(ex,Math.cos(a)*rad),mul(ey,Math.sin(a)*rad))))}
 const t=vtx(m,ap),b=vtx(m,p);
 for(let q=0;q<sides;q++){const q2=(q+1)%sides;m.idx.push(q,q2,t);m.idx.push(b,q2,q)}
 merge(into,m,p);
}
/* barbatana (moicano) ao longo do plano central */
function fin(into,psi0,psi1,hFn,wFn,n=18){
 const m=Mb(),sides=6;
 for(let k=0;k<n;k++){
  const t=k/(n-1),psi=lerp(psi0,psi1,t);let th=0,ph=psi;if(psi>90){th=PI;ph=180-psi}
  const c=P(th,ph,-.006),up=dirOf(th,ph),h=hFn(t),w=wFn(t);
  for(let q=0;q<sides;q++){const a=q/sides*TAU;vtx(m,add(c,add(mul([1,0,0],Math.cos(a)*w),mul(up,(Math.sin(a)*.5+.5)*h))))}
 }
 for(let k=0;k<n-1;k++)for(let q=0;q<sides;q++){
  const a=k*sides+q,b=k*sides+(q+1)%sides,c=(k+1)*sides+(q+1)%sides,d=(k+1)*sides+q;
  m.idx.push(a,b,c,a,c,d);
 }
 // Fecha as duas extremidades do moicano; antes eram anéis sem tampa.
 const center=(ring)=>{
  const c=[0,0,0];for(let q=0;q<sides;q++){const z=m.pos[(ring*sides+q)*3];c[0]+=z/sides;c[1]+=m.pos[(ring*sides+q)*3+1]/sides;c[2]+=m.pos[(ring*sides+q)*3+2]/sides}return vtx(m,c);
 };
 const c0=center(0),c1=center(n-1);
 for(let q=0;q<sides;q++){
  const q2=(q+1)%sides;
  m.idx.push(c0,q2,q);
  const a=(n-1)*sides+q,b=(n-1)*sides+q2;
  m.idx.push(c1,a,b);
 }
 merge(into,m,HC);
}

/* ---------- estilos ---------- */
const topSpikes=(m)=>{
 spike(m,0,90,.026,.075,0);
 for(let k=0;k<6;k++)spike(m,k/6*TAU+.2,72,.024,.062,0);
 for(let k=0;k<8;k++)spike(m,k/8*TAU,50,.022,.045,0);
};
const backCurtain=(m,t0,t1,rim,yBack,yEnd,rEnd,jag=0)=>curtain(m,{t0,t1,rim,yEnd,rEnd,jag,jagK:14});
const STYLES=[
 {id:'classic',name:'Clássico',orig:true},
 {id:'bald',name:'Careca',none:true},
 {id:'buzz',name:'Raspado',build(m){cap(m,{rim:rimF(46,16,6),th0:.005})}},
 {id:'short',name:'Curto',build(m){cap(m,{rim:rimF(44,6,-8,3,14),th0:.010,vol:.010,groove:.0024})}},
 {id:'quiff',name:'Topete',build(m){cap(m,{rim:rimF(56,6,-8),th0:.010,vol:.006,groove:.0018,bump:(th,ph)=>.058*Math.pow(Math.max(0,Math.cos(th)),2)*ss((ph-34)/30)*(1-ss((ph-80)/12))})}},
 {id:'spiky',name:'Espetado',build(m){cap(m,{rim:rimF(48,8,-4,3,10),th0:.008,vol:.004,groove:.002});topSpikes(m)}},
 {id:'mohawk',name:'Moicano',build(m){fin(m,46,198,t=>.016+.06*Math.pow(Math.sin(PI*Math.pow(t,.85)),.7),t=>.006+.012*Math.sin(PI*t),22)}},
 {id:'bob',name:'Chanel',build(m){
   cap(m,{rim:rimF(36,-2,-14,2,16),th0:.012,vol:.008,groove:.0022});
   curtain(m,{t0:50*D,t1:310*D,rim:rimF(36,-2,-14,2,16),yEnd:()=>1.605,rEnd:th=>.128+.01*Math.max(0,-Math.cos(th)),jag:.004,jagK:18,nu:26});
 }},
 {id:'long',name:'Longo',build(m){
   cap(m,{rim:rimF(40,0,-12,2,16),th0:.012,vol:.008,groove:.0022});
   curtain(m,{t0:55*D,t1:305*D,rim:rimF(40,0,-12,2,16),nu:28,nv:7,
     yEnd:th=>1.40+.19*Math.pow(1-Math.max(0,-Math.cos(th)),1.5),
     rEnd:th=>.118+.098*Math.pow(Math.max(0,-Math.cos(th)),1.2),jag:.008,jagK:12});
 }},
 {id:'ponytail',name:'Rabo de cavalo',build(m){
   cap(m,{rim:rimF(44,4,-8,2,14),th0:.011,vol:.008,groove:.0018});
   const p0=P(PI,38,-.01);
   const path=[p0,add(p0,[0,.01,-.035]),add(p0,[0,-.01,-.07]),add(p0,[0,-.05,-.095]),add(p0,[0,-.10,-.105]),add(p0,[0,-.16,-.100]),add(p0,[0,-.22,-.085])];
   tube(m,path,t=>.038*(1-.45*t)*(t>.82?1-(t-.82)/.18*.85:1)+.002);
 }},
 {id:'pigtails',name:'Maria-chiquinha',build(m){
   cap(m,{rim:rimF(42,4,-4,2,12),th0:.011,vol:.008,groove:.0018});
   for(const sd of[-1,1]){
    const p0=P(sd*104*D,26,-.01);
    const path=[p0,add(p0,[sd*.03,.01,-.005]),add(p0,[sd*.058,-.01,-.012]),add(p0,[sd*.074,-.055,-.016]),add(p0,[sd*.078,-.105,-.012]),add(p0,[sd*.074,-.155,-.006]),add(p0,[sd*.07,-.19,0])];
    tube(m,path,t=>.030*(1-.5*t)*(t>.82?1-(t-.82)/.18*.85:1)+.002);
   }
 }},
 {id:'bun',name:'Coque',build(m){
   cap(m,{rim:rimF(44,4,-8,2,14),th0:.011,vol:.008,groove:.0018});
   blob(m,[0,1.865,-.032],.050,.044,.050,12,7,.05,2);
 }},
 {id:'afro',name:'Afro',build(m){
   cap(m,{nu:30,nv:8,rim:rimF(44,2,-6),th0:.040,vol:.040,bump:(th,ph)=>.008*Math.sin(th*5+ph*.2)*Math.cos(ph*.12)});
 }},
];
STYLES.forEach(s=>{s.id=s.id});

/* devolve {pos,nrm?,idx,si,sw} no formato de LP.parts (ou null = sem cabelo) */
const cache={};
function part(id){
 const S=STYLES.find(s=>s.id===id);
 if(!S||S.none)return null;
 if(S.orig)return OWM.lp&&OWM.lp.parts?OWM.lp.parts.hair:null;
 if(cache[id])return cache[id];
 const m=Mb();S.build(m);
 const n=m.pos.length/3,si=new Uint16Array(n*4),sw=new Float32Array(n*4);
 for(let i=0;i<n;i++){si[i*4]=2;sw[i*4]=1}      // 2 = osso "hm" (cabeça)
 return cache[id]={pos:Float32Array.from(m.pos),idx:Uint32Array.from(m.idx),si,sw,gen:true};
}
OWM.hair={styles:STYLES.map(s=>({id:s.id,name:s.name})),part};
if(typeof module!=='undefined')module.exports={STYLES,part,headR,P};
})();
