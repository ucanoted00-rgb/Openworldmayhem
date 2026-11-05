/* Open World Mayhem — estilos de cabelo do personagem.
   Só restam o cabelo do Goku (goku.js), o "Spiky Hair" e o "SSJ5 Hair" (hair-data.js, gerado por convert_hair.py) e "Careca" (sem cabelo).
   Cada estilo devolve uma malha no formato de LP.parts (pos/nrm/uv/idx/si/sw), toda presa ao osso da cabeça (índice 2 = "hm").
   O balanço (física) é feito na GPU por playeranim.js: aqui só se calcula a "liberdade" de cada vértice (hairW: 0 = raiz presa ao crânio,
   1 = ponta solta) e os parâmetros de mola de cada estilo (phys). Usado por playeranim.js (OWM.anim.setHair) e pelo criador de personagem. */
(()=>{
const OWM=window.OWM||(window.OWM={});
const HC=[0,1.635,.04];                    // centro do crânio do Goku (mesmo de LP.headFit)
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const d64=(s,T)=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return T===Uint8Array?u:new T(u.buffer)};

/* phys: amp = intensidade geral; kA/kB = rigidez das duas molas de translação (rad/s)²; zeta = amortecimento; kR = rigidez da mola de rotação;
   grav = quanto a ponta cai para o lado da gravidade quando a cabeça inclina; max = deslocamento máximo (m) */
const STYLES=[
 {id:'classic',name:(OWM.lp&&OWM.lp.hairName)||'Goku',orig:true,phys:{amp:.55,kA:620,kB:340,zeta:.34,kR:260,grav:.05,max:.045}},
 {id:'bald',name:'Careca',none:true},
 {id:'spiky',name:'Spiky',data:'spiky',native:true,phys:{amp:.8,kA:520,kB:260,zeta:.3,kR:210,grav:.07,max:.06}},
 {id:'ssj5',name:'SSJ5',data:'ssj5',phys:{amp:1.15,kA:360,kB:170,zeta:.24,kR:150,grav:.11,max:.09}},
];

/* "liberdade" por vértice: distância ao centro da cabeça normalizada entre a raiz (casca do crânio) e a ponta mais distante */
function freedom(pos,gamma){
 const n=pos.length/3,d=new Float32Array(n),srt=[];
 for(let i=0;i<n;i++){d[i]=Math.hypot(pos[i*3]-HC[0],pos[i*3+1]-HC[1],pos[i*3+2]-HC[2]);srt.push(d[i])}
 srt.sort((a,b)=>a-b);
 const r0=srt[Math.floor(n*.12)]*1.05,r1=srt[n-1],w=new Float32Array(n);   // 12% mais próximos = raiz
 for(let i=0;i<n;i++){const t=cl((d[i]-r0)/Math.max(1e-4,r1-r0),0,1);w[i]=Math.pow(t*t*(3-2*t),gamma||1.15)}
 return w;
}
const cache={};
function fromData(S){
 const D=OWM.hairData&&OWM.hairData[S.data];if(!D)return null;
 const q=d64(D.pos,Int16Array),n=q.length/3,pos=new Float32Array(n*3);
 for(let i=0;i<n;i++)for(let a=0;a<3;a++)pos[i*3+a]=q[i*3+a]/32767*D.ph[a]+D.pc[a];
 const nrm=d64(D.nrm,Int8Array),u16=d64(D.uv,Uint16Array),uv=new Float32Array(n*2);
 for(let i=0;i<n;i++){uv[i*2]=u16[i*2]/65535;uv[i*2+1]=1-u16[i*2+1]/65535}   // UV do glTF → flipY padrão do three
 const si=new Uint16Array(n*4),sw=new Float32Array(n*4);
 for(let i=0;i<n;i++){si[i*4]=2;sw[i*4]=1}      // 2 = osso "hm" (cabeça)
 return{pos,nrm,uv,idx:Uint16Array.from(d64(D.idx,Uint16Array)),si,sw,noSub:true,gen:true,native:!!S.native,hairW:freedom(pos),texUri:D.tex};
}
/* devolve {pos,nrm,uv,idx,si,sw,hairW} no formato de LP.parts (ou null = sem cabelo) */
function part(id){
 const S=STYLES.find(s=>s.id===id);
 if(!S||S.none)return null;
 if(S.orig){
  const P=OWM.lp&&OWM.lp.parts?OWM.lp.parts.hair:null;
  if(P&&!P.hairW)P.hairW=freedom(P.pos,1.0);
  return P;
 }
 return cache[id]||(cache[id]=fromData(S));
}
const texCache={};
/* textura própria dos estilos novos (o Goku usa LP.getTexture('hair')) */
function texture(id){
 const S=STYLES.find(s=>s.id===id),P=part(id);
 if(!S||!P||!P.texUri||typeof THREE==='undefined')return null;
 if(texCache[id])return texCache[id];
 const img=new Image(),t=new THREE.Texture(img);
 t.encoding=THREE.sRGBEncoding;t.anisotropy=4;img.onload=()=>{t.needsUpdate=true};img.src=P.texUri;
 return texCache[id]=t;
}
const physOf=id=>{const S=STYLES.find(s=>s.id===id);return S&&S.phys||null};
OWM.hair={styles:STYLES.map(s=>({id:s.id,name:s.name,native:!!s.native})),part,texture,phys:physOf,HC};
if(typeof module!=='undefined')module.exports={STYLES,part,freedom};
})();
