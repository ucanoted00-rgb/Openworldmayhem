/* Gera os clipes idle / run / attack do escorpião (rig do kenchoo, CC-BY-4.0) e os grava em scorpion.js.
   Uso:  node gen_scorpion_anim.js            -> reescreve scorpion.js
         node gen_scorpion_anim.js preview    -> também escreve /tmp/scp_sheet.ppm (folha de poses, rasterizador por software)
   Método: cada osso recebe rotações incrementais em eixos do MUNDO (x = lateral, y = cima, z = frente/cabeça) por cima da pose do pai,
   o que torna a coreografia independente dos eixos locais esquisitos do rig. Depois é convertido para quaternions locais e quantizado. */
const fs=require('fs');
const FILE=__dirname+'/scorpion.js';
const src=fs.readFileSync(FILE,'utf8');
const iP=src.indexOf('OWM.scorpionPack='),iF=src.indexOf('OWM.Scorpion=');
global.OWM={};eval(src.slice(iP,iF));
const PK=OWM.scorpionPack,SK=PK.skel,par=SK.par,N=par.length,RB=PK.root;
const u8=(s,T)=>{const b=Buffer.from(s,'base64');return new T(b.buffer.slice(b.byteOffset,b.byteOffset+b.length))};
const T0=u8(SK.t,Float32Array),Q0=u8(SK.q,Float32Array),S0=u8(SK.s,Float32Array),IBM=u8(SK.ibm,Float32Array);

/* ---------- quaternions [x,y,z,w] ---------- */
const qm=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const qc=a=>[-a[0],-a[1],-a[2],a[3]];
const qn=a=>{const l=Math.hypot(a[0],a[1],a[2],a[3])||1;return[a[0]/l,a[1]/l,a[2]/l,a[3]/l]};
const X=[1,0,0],Y=[0,1,0],Z=[0,0,1];
const aa=(ax,a)=>{const s=Math.sin(a/2);return[ax[0]*s,ax[1]*s,ax[2]*s,Math.cos(a/2)]};
const restQ=[];for(let k=0;k<N;k++)restQ.push([Q0[k*4],Q0[k*4+1],Q0[k*4+2],Q0[k*4+3]]);

/* ---------- ossos (índices do rig) ---------- */
const LEGS=[];   // side +1 = direita (+x), -1 = esquerda; idx 0 = frente … 3 = trás
[[3,15,27,39],[9,21,33,45]].forEach((row,r)=>row.forEach((c,i)=>LEGS.push({side:r?-1:1,idx:i,ch:[c,c+1,c+2,c+3]})));
const TAIL=[52,53,54,55,56,57,58,59,60,61];                 // 56 é só ligação (não animado antes, entra agora por completude)
const ARM={1:{base:63,chain:[64,65,66],fo:67,fi:69},'-1':{base:71,chain:[72,73,74],fo:75,fi:77}};
const ANIM=[...new Set([...PK.bones,51,63,71,56])].sort((a,b)=>a-b);   // ossos que os clipes guardam
const NB=ANIM.length;

/* ---------- utilidades de curva ---------- */
const TAU=Math.PI*2,sin=Math.sin,cos=Math.cos;
const sm=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
function kf(keys,u){   // keyframes [u,v] com suavização entre eles
 if(u<=keys[0][0])return keys[0][1];
 for(let i=1;i<keys.length;i++)if(u<=keys[i][0]){const a=keys[i-1],b=keys[i];return a[1]+(b[1]-a[1])*sm((u-a[0])/(b[0]-a[0]))}
 return keys[keys.length-1][1];
}
const bump=(u,c,w)=>{let d=Math.abs(u-c);d=Math.min(d,1-d);return Math.exp(-(d/w)*(d/w))};   // gaussiana periódica
const add=(inc,k,ax,a)=>{if(!a)return;(inc[k]=inc[k]||[]).push([ax,a])};

/* pé: s = avanço (-1..1), l = elevação (0..1) */
function leg(inc,L,s,l,A){
 const[c,f,t]=L.ch,sd=L.side;
 add(inc,c,Y,-sd*s*A.sw);add(inc,c,Z,sd*l*A.l0);
 add(inc,f,Z,sd*l*A.l1);add(inc,t,Z,-sd*l*A.l2);
}
function tail(inc,fnY,fnX){   // fnY(i,n) / fnX(i,n): incremento por segmento (rad)
 TAIL.forEach((k,i)=>{add(inc,k,Y,fnY?fnY(i,TAIL.length):0);add(inc,k,X,fnX?fnX(i,TAIL.length):0)});
}
function arm(inc,sd,yaw,lift,fo,fi){   // yaw>0 abre pra fora; lift>0 sobe; fo/fi = abertura dos dedos
 const a=ARM[sd];
 add(inc,a.chain[0],Y,sd*yaw);add(inc,a.chain[0],X,-lift);add(inc,a.chain[1],X,-lift*.4);
 add(inc,a.fo,Y,sd*fo);add(inc,a.fi,Y,-sd*fi);
}

/* ---------- clipes: cada um devolve {inc, root:[dx,dy,dz]} para u em [0,1) ---------- */
function idle(u){
 const inc={},w=TAU*u;
 const root=[0,.006*sin(w),.004*sin(w+1.2)];
 add(inc,RB,X,.03*sin(w+.6));add(inc,RB,Z,.03*sin(w));add(inc,RB,Y,.06*sin(w+2.1));
 tail(inc,(i,n)=>(.62/n)*sin(w-i*.33),(i,n)=>(.1/n)*sin(2*w+i*.28)+(i>=n-4?.2*bump(u,.72,.035)-.1*bump(u,.2,.05):0));
 for(const sd of[1,-1])arm(inc,sd,.13*sin(w+sd*.9),.06+.05*sin(w*2+sd),.25*(.5+.5*sin(w+sd*1.1)),.14*(.5+.5*sin(w+sd*1.1+.5)));
 for(const L of LEGS){const ph=L.idx*1.3+(L.side>0?0:.7);
  leg(inc,L,.22*sin(w+ph),0,{sw:.5,l0:0,l1:0,l2:0});
  const tap=(L.side<0&&L.idx===1?bump(u,.3,.045):0)+(L.side>0&&L.idx===2?bump(u,.8,.045):0)+(L.side>0&&L.idx===0?bump(u,.55,.03)*.7:0);
  if(tap)leg(inc,L,0,tap,{sw:0,l0:.5,l1:.42,l2:.34})}
 return{inc,root};
}
function run(u){
 const inc={},w=TAU*u,root=[0,.007*cos(2*w)+.001,0];
 add(inc,RB,X,.05+.05*sin(2*w+.4));add(inc,RB,Z,.09*sin(w));add(inc,RB,Y,.13*sin(w+1.6));
 for(const L of LEGS){
  const A=(L.idx%2===0)===(L.side>0)?0:.5,v=((u+A)%1+1)%1,D=.58;
  let s,l;if(v<D){s=1-2*(v/D);l=0}else{const q=(v-D)/(1-D);s=-1+2*sm(q);l=sin(Math.PI*q)}
  leg(inc,L,s,l,{sw:.78,l0:.62,l1:.5,l2:.38});
 }
 tail(inc,(i,n)=>(.5/n)*sin(w-i*.35),(i,n)=>(.16/n)*sin(2*w-i*.3)-.012);
 for(const sd of[1,-1]){const ph=sd>0?0:Math.PI;
  arm(inc,sd,.2*sin(w+ph),.12+.07*sin(2*w+ph),.28*(.5+.5*sin(2*w+ph)),.18*(.5+.5*sin(2*w+ph+.6)))}
 return{inc,root};
}
function attack(u){
 const inc={};
 const P=kf([[0,0],[.26,-.62],[.38,1.18],[.46,1.0],[.62,.45],[.82,.1],[1,0]],u),          // curva da cauda
  lean=kf([[0,0],[.26,-.2],[.38,.12],[.5,.08],[.75,.02],[1,0]],u),
  rz=kf([[0,0],[.26,-.016],[.38,.048],[.5,.038],[.75,.012],[1,0]],u),
  ry=kf([[0,0],[.26,.008],[.38,-.004],[.6,0],[1,0]],u),
  ayaw=kf([[0,0],[.26,.45],[.38,-.18],[.5,-.06],[1,0]],u),
  alift=kf([[0,0],[.26,.34],[.38,.02],[.5,0],[1,0]],u),
  fg=kf([[0,0],[.26,.5],[.35,.58],[.42,-.28],[.55,.12],[1,0]],u),
  fl=kf([[0,0],[.26,.55],[.4,0],[1,0]],u),            // pernas da frente levantam no recuo
  fs=kf([[0,0],[.26,-.25],[.4,.4],[.62,.12],[1,0]],u),   // …e avançam no bote
  bs=kf([[0,0],[.26,.12],[.4,-.35],[.62,-.1],[1,0]],u),   // pernas de trás empurram
  twist=kf([[0,0],[.26,-.1],[.38,.08],[.6,.02],[1,0]],u);
 const root=[0,ry,rz];
 add(inc,RB,X,lean);add(inc,RB,Y,twist);
 const wts=[.03,.05,.06,.08,.1,.11,.13,.15,.17,.2];   // quanto cada segmento curva (cauda fecha sobre as costas)
 tail(inc,null,(i,n)=>P*wts[i]*(P<0?.8:1));
 for(const sd of[1,-1])arm(inc,sd,ayaw,alift,fg,fg*.6);
 for(const L of LEGS){
  const front=L.idx===0,mid=L.idx===1,back=L.idx>=2;
  if(front)leg(inc,L,fs,fl,{sw:.5,l0:.4,l1:.35,l2:.25});
  else if(mid)leg(inc,L,fs*.3,fl*.25,{sw:.5,l0:.4,l1:.35,l2:.25});
  else leg(inc,L,bs,0,{sw:.4,l0:0,l1:0,l2:0});
 }
 return{inc,root};
}

/* ---------- pose -> quaternions locais ---------- */
function pose(f,u){
 const{inc,root}=f(u),W=new Array(N),loc=new Array(N),I=[0,0,0,1];
 for(let k=0;k<N;k++){
  const pw=par[k]>=0?W[par[k]]:I;
  let R=I;if(inc[k])for(const[ax,a]of inc[k])R=qm(R,aa(ax,a));
  const nw=qn(qm(R,qm(pw,restQ[k])));
  let l=qn(qm(qc(pw),nw));
  if(l[0]*restQ[k][0]+l[1]*restQ[k][1]+l[2]*restQ[k][2]+l[3]*restQ[k][3]<0)l=l.map(v=>-v);
  W[k]=nw;loc[k]=l;
 }
 return{loc,root};
}
function bake(name,f,n,fps,loop,hit){
 const q=new Int16Array(n*NB*4),t=new Int16Array(n*3);
 for(let i=0;i<n;i++){
  const{loc,root}=pose(f,i/n);
  ANIM.forEach((k,b)=>{for(let j=0;j<4;j++)q[(i*NB+b)*4+j]=Math.round(Math.max(-1,Math.min(1,loc[k][j]))*32767)});
  for(let j=0;j<3;j++)t[i*3+j]=Math.round((T0[RB*3+j]+root[j])*10000);
 }
 const c={n,fps,loop:loop?1:0,q:Buffer.from(q.buffer).toString('base64'),t:Buffer.from(t.buffer).toString('base64')};
 if(hit!=null)c.hit=hit;return c;
}

const clips={idle:bake('idle',idle,72,24,1),run:bake('run',run,16,54,1),attack:bake('attack',attack,24,34,0,.4)};
PK.bones=ANIM;PK.clips=clips;
const head=src.slice(0,iP).replace(/clipes "run" e "attack" feitos à mão[\s\S]*?\n/,m=>m);
fs.writeFileSync(FILE,head+'OWM.scorpionPack='+JSON.stringify(PK)+';\n\n'+src.slice(iF));
console.log('scorpion.js reescrito:',Object.entries(clips).map(([k,c])=>k+' '+c.n+'f@'+c.fps).join(', '),'| ossos animados:',NB);

/* ---------- prévia por software ---------- */
if(process.argv[2]==='preview'){
 const M=PK.mesh,pos=u8(M.pos,Int16Array),jn=u8(M.jnt,Uint8Array),wg=u8(M.wgt,Uint8Array),idx=u8(M.idx,Uint16Array),nv=pos.length/3;
 const mul=(a,b)=>{const o=new Float64Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s}return o};
 const comp=(t,q,s)=>{const[x,y,z,w]=q,x2=x+x,y2=y+y,z2=z+z,xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;
  return Float64Array.from([(1-(yy+zz))*s[0],(xy+wz)*s[0],(xz-wy)*s[0],0,(xy-wz)*s[1],(1-(xx+zz))*s[1],(yz+wx)*s[1],0,(xz+wy)*s[2],(yz-wx)*s[2],(1-(xx+yy))*s[2],0,t[0],t[1],t[2],1])};
 function skin(clip,fr){   // lê do clipe assado (o mesmo caminho do jogo)
  const c=clips[clip],q=u8(c.q,Int16Array),t=u8(c.t,Int16Array),loc=[];
  for(let k=0;k<N;k++)loc.push({t:[T0[k*3],T0[k*3+1],T0[k*3+2]],q:restQ[k].slice(),s:[S0[k*3],S0[k*3+1],S0[k*3+2]]});
  ANIM.forEach((k,b)=>{loc[k].q=qn([0,1,2,3].map(j=>q[(fr*NB+b)*4+j]/32767))});
  loc[RB].t=[0,1,2].map(j=>t[fr*3+j]/10000);
  const W=[];for(let k=0;k<N;k++){const L=comp(loc[k].t,loc[k].q,loc[k].s);W[k]=par[k]>=0?mul(W[par[k]],L):L}
  const B=W.map((w,k)=>mul(w,Float64Array.from(IBM.slice(k*16,k*16+16)))),out=new Float32Array(nv*3);
  for(let i=0;i<nv;i++){const p=[pos[i*3]/M.sc,pos[i*3+1]/M.sc,pos[i*3+2]/M.sc];let o=[0,0,0];
   for(let k=0;k<4;k++){const w=wg[i*4+k]/255;if(!w)continue;const m=B[jn[i*4+k]];for(let a=0;a<3;a++)o[a]+=w*(m[a]*p[0]+m[4+a]*p[1]+m[8+a]*p[2]+m[12+a])}
   out[i*3]=o[0];out[i*3+1]=o[1];out[i*3+2]=o[2]}
  return out;
 }
 const TW=300,TH=240,cols=6,jobs=[];
 const pick=[['idle',0],['idle',18],['idle',50],['run',0],['run',4],['run',8],['run',12],['attack',0],['attack',6],['attack',9],['attack',11],['attack',16]];
 const sheet=new Uint8Array(cols*TW*Math.ceil(pick.length/cols)*TH*3).fill(70);const SW=cols*TW;
 pick.forEach(([cn,fr],ti)=>{
  const P=skin(cn,fr),ox=(ti%cols)*TW,oy=Math.floor(ti/cols)*TH,zb=new Float32Array(TW*TH).fill(1e9);
  const yaw=-0.75,pit=.5,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pit),sp=Math.sin(pit),sc=560;
  const pr=i=>{let x=P[i*3],y=P[i*3+1]-.1,z=P[i*3+2]+.02;const x1=x*cy+z*sy,z1=-x*sy+z*cy;const y2=y*cp-z1*sp,z2=y*sp+z1*cp;return[TW/2+x1*sc,TH*.62-y2*sc,z2]};
  const L=[.4,.8,.5],ll=Math.hypot(...L);
  for(let f=0;f<idx.length;f+=3){const a=idx[f],b=idx[f+1],c=idx[f+2],A=pr(a),Bq=pr(b),C=pr(c);
   const e1=[P[b*3]-P[a*3],P[b*3+1]-P[a*3+1],P[b*3+2]-P[a*3+2]],e2=[P[c*3]-P[a*3],P[c*3+1]-P[a*3+1],P[c*3+2]-P[a*3+2]];
   let nx=e1[1]*e2[2]-e1[2]*e2[1],ny=e1[2]*e2[0]-e1[0]*e2[2],nz=e1[0]*e2[1]-e1[1]*e2[0];const nl=Math.hypot(nx,ny,nz)||1;nx/=nl;ny/=nl;nz/=nl;
   const lam=Math.abs(nx*L[0]+ny*L[1]+nz*L[2])/ll,sh=.3+.7*lam;
   const minx=Math.max(0,Math.floor(Math.min(A[0],Bq[0],C[0]))),maxx=Math.min(TW-1,Math.ceil(Math.max(A[0],Bq[0],C[0]))),miny=Math.max(0,Math.floor(Math.min(A[1],Bq[1],C[1]))),maxy=Math.min(TH-1,Math.ceil(Math.max(A[1],Bq[1],C[1])));
   const d=(Bq[1]-C[1])*(A[0]-C[0])+(C[0]-Bq[0])*(A[1]-C[1]);if(Math.abs(d)<1e-9)continue;
   for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++){const px=x+.5,py=y+.5,l1=((Bq[1]-C[1])*(px-C[0])+(C[0]-Bq[0])*(py-C[1]))/d,l2=((C[1]-A[1])*(px-C[0])+(A[0]-C[0])*(py-C[1]))/d,l3=1-l1-l2;
    if(l1<-.001||l2<-.001||l3<-.001)continue;const z=l1*A[2]+l2*Bq[2]+l3*C[2];if(z>=zb[y*TW+x])continue;zb[y*TW+x]=z;
    const o=((oy+y)*SW+ox+x)*3;sheet[o]=Math.min(255,120*sh+20);sheet[o+1]=Math.min(255,170*sh+25);sheet[o+2]=Math.min(255,235*sh+30)}}
  // linha do chão (y=0) para ver pés flutuando/afundando
  for(let x=0;x<TW;x++){const o=((oy+Math.round(TH*.62+.1*sc*cp-0.0*sc))*SW+ox+x)*3;if(sheet[o]===70){sheet[o]=200;sheet[o+1]=200;sheet[o+2]=60}}
 });
 const hdr=Buffer.from('P6\n'+SW+' '+(Math.ceil(pick.length/cols)*TH)+'\n255\n');
 fs.writeFileSync('/tmp/scp_sheet.ppm',Buffer.concat([hdr,Buffer.from(sheet)]));console.log('prévia em /tmp/scp_sheet.ppm');
}
