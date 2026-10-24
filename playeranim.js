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
if(LP){
 const sk=new THREE.Skeleton(list);
 /* dois renderers (jogo + preview do editor) usam o mesmo esqueleto: força atualizar sempre */
 Object.defineProperty(sk,'frame',{get:()=>-1,set:()=>{}});
 for(const n of SLOTS){
  const P=LP.parts[n];if(!P)continue;
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(P.pos,3));
  g.setAttribute('normal',new THREE.BufferAttribute(P.nrm,3,true));
  g.setAttribute('skinIndex',new THREE.BufferAttribute(P.si,4));
  g.setAttribute('skinWeight',new THREE.BufferAttribute(P.sw,4));
  g.setIndex(new THREE.BufferAttribute(P.idx,1));
  const m=new THREE.SkinnedMesh(g,mats[n]);m.name='lp_'+n;
  m.castShadow=true;m.frustumCulled=false;
  av.add(m);m.updateMatrixWorld(true);m.bind(sk,m.matrixWorld);
 }
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
const ST={yaw:0,ph:0,amp:0,air:0,idleT:0,init:false,pog:true,pcy:0,yr:0,pfv:0,af:0,rn:0,dyn:1,
 lean:mkS(),roll:mkS(),sq:mkS(),fl:mkS(),head:mkS()};
const FX={roll:0,dip:0};   // lido pelo game.js: inclinação e "afundar" da câmera em 1ª pessoa

/* Chamado pelo editor ao abrir: tira qualquer deslocamento do jogo para o gizmo ficar alinhado */
function resetPose(){
 hip.position.set(0,HIP,0);hip.rotation.set(0,0,0);upper.rotation.set(0,0,0);
 ['LA','RA','LL','RL','hm'].forEach(k=>bones[k].rotation.set(0,0,0));
 AUX.forEach(k=>{if(B[k])B[k].rotation.set(0,0,0)});
 av.position.set(0,0,0);av.rotation.set(0,0,0);
 ['lean','roll','sq','fl','head'].forEach(k=>{ST[k].x=0;ST[k].v=0});
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
const U={ph:0,airT:0,airN:false,landT:9,landL:0,mn:0,init:false,t:{idle:0,jloop:0},w:{idle:1,walk:0,jog:0,sprint:0,jstart:0,jloop:0}};
const mkQ=()=>UA?UA.ORDER.map(()=>new THREE.Quaternion()):[];
const aQ=mkQ(),tQ=mkQ(),lQ=mkQ(),_q1=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_qa=new THREE.Quaternion(),_ea=new THREE.Euler();
const aP=new THREE.Vector3(),tP=new THREE.Vector3(),lP=new THREE.Vector3();
function ualSamp(c,t,oQ,oP){
 const n=c.n;let f;
 if(c.loop){t=((t%c.dur)+c.dur)%c.dur;f=t/c.dur*n}else{t=clamp(t,0,c.dur);f=t/c.dur*(n-1)}
 let i=Math.floor(f);const u=f-i;let j=i+1;
 if(c.loop){i%=n;j%=n}else if(i>=n-1){i=j=n-1}else j=Math.min(j,n-1);
 const S=UA.STRIDE,a=i*S,b=j*S,F=c.f;
 oP.set(lerp(F[a],F[b],u),lerp(F[a+1],F[b+1],u),lerp(F[a+2],F[b+2],u));
 for(let k=0;k<oQ.length;k++){const o=3+k*4;_q1.set(F[a+o],F[a+o+1],F[a+o+2],F[a+o+3]);_q2.set(F[b+o],F[b+o+1],F[b+o+2],F[b+o+3]);oQ[k].copy(_q1).slerp(_q2,u)}
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
  const c=C[k],t=(k==='walk'||k==='jog'||k==='sprint')?U.ph*c.dur:k==='jstart'?.1+U.airT:U.t[k];
  ualSamp(c,t,tQ,tP);
  if(sum===0){for(let i=0;i<aQ.length;i++)aQ[i].copy(tQ[i]);aP.copy(tP);sum=w}
  else{const a=w/(sum+w);for(let i=0;i<aQ.length;i++)aQ[i].slerp(tQ[i],a);aP.lerp(tP,a);sum+=w}
 }
 if(sum===0){ualSamp(C.idle,U.t.idle,aQ,aP)}

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
  if(U.mn>.01&&(n==='RA'||n==='RE'))b.quaternion.copy(aQ[i]).slerp(_qa.copy(b.quaternion),U.mn);
  else b.quaternion.copy(aQ[i]);
 }
 hip.position.set(aP.x,aP.y,aP.z);

 /* extras por cima do clipe: golpe ao minerar e tranco de dano */
 const fl=ST.fl.x,ax=.12*mineA*U.mn-fl*.55,ay=.28*mineA*U.mn;
 if(Math.abs(ax)>1e-4||Math.abs(ay)>1e-4)upper.quaternion.multiply(_qa.setFromEuler(_ea.set(ax,ay,0)));

 /* cabeça olha pra onde a câmera olha, compensando a inclinação/torção do corpo */
 const hr=hip.rotation,ur=upper.rotation,h=bones.hm,hk=1-Math.exp(-dt*14);
 const tx=clamp(-cp,-.9,.9)*.9-(hr.x+ur.x)*.6,ty=clamp(wrap(camYaw-ST.yaw),-1.2,1.2)-(hr.y+ur.y)*.85,tz=-(hr.z+ur.z)*.5;
 h.rotation.set(h.rotation.x+(tx-h.rotation.x)*hk,h.rotation.y+(ty-h.rotation.y)*hk,h.rotation.z+(tz-h.rotation.z)*hk);
}

/* ---------- Animação por frame ---------- */
function update(dt,s){
 if(!s||!s.inGame){av.visible=false;return}
 const{p,vel,og,mining,swT,cp,custom,tp3}=s;
 dt=clamp(dt,1e-4,.05);
 av.visible=!!tp3;                                  // em 1ª pessoa só aparece o braço/item
 av.position.set(p.x,p.y,p.z);

 const sp=Math.hypot(vel.x,vel.z),moving=sp>.5,camYaw=cam.rotation.y;
 if(!ST.init){ST.yaw=camYaw;ST.pcy=camYaw;ST.init=true}
 ST.yr+=(clamp(wrap(camYaw-ST.pcy)/dt,-9,9)-ST.yr)*(1-Math.exp(-dt*10));ST.pcy=camYaw;   // velocidade de giro da câmera (suavizada)
 /* corpo sempre acompanha a direção da câmera (girar a câmera pro lado gira o personagem) */
 const clipOn=!!UA&&!custom&&!(idle&&og&&!moving&&!mining);
 ST.yaw+=wrap(camYaw-ST.yaw)*(1-Math.exp(-dt*14));
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
  const ax=lerp(-.7,-2.3,rise)+fall*.5,az=.25+.55*fall+.2*rise;
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

 if(clipOn)ualLayer(dt,{og,sp,vy:vel.y,mining,mineA,show:!!tp3,landV:s.landV,cp,camYaw,sprint:!!s.sprint});

 /* dados pra câmera em 1ª pessoa */
 FX.roll=clamp(-ST.roll.x*.25,-.05,.05);
 FX.dip=clamp(ST.sq.x*.35,-.14,.05);
}

OWM.anim={av,update,bones,sampleTrack,reloadIdle,resetPose,hit,fx:FX};
reloadIdle();
})();
