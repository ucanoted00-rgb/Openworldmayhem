/* Open World Mayhem — armas.
   OWM.weapons  = atributos das armas equipáveis (dano, intervalo entre golpes, descrição curta).
   OWM.weapon   = {id} arma que o jogador está segurando agora (null = punhos). Quem muda é o game.js (inventário); quem lê é o playeranim.js.
   OWM.makeKnife() = Group THREE com a malha da faca (knife.js); geometrias e materiais são compartilhados entre todas as cópias
                     (mão do personagem, 1ª pessoa, ícone do inventário, visualizador de arma).
   Eixos da malha: origem no centro do cabo, lâmina pra +Y, gume pra +X, faces planas em ±Z; comprimento total 0,32 m. */
(()=>{
const KP=OWM.knifePack;
OWM.weapons={
 knife:{id:'knife',n:'Faca de combate',dmg:22,cd:.44,hit:.4,
  d:'Faca de lâmina serrilhada e cabo emborrachado. Corta bem mais forte que os punhos e golpeia rápido.'}
};
OWM.weapon={id:null};

const b64=(s,T)=>{const bin=atob(s),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new T(u.buffer)};
let GEO=null,MAT=null;
function build(){
 if(GEO||!KP)return;
 GEO=[];MAT=[];
 for(const p of KP.parts){
  const q=b64(p.pos,Int16Array),n8=b64(p.nor,Int8Array),idx=b64(p.idx,Uint16Array),pos=new Float32Array(q.length),nor=new Float32Array(n8.length);
  for(let i=0;i<q.length;i++){pos[i]=q[i]/1e4;nor[i]=n8[i]/127}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));g.setIndex(new THREE.BufferAttribute(idx,1));
  g.computeBoundingSphere();GEO.push(g);
  MAT.push(new THREE.MeshPhongMaterial({color:new THREE.Color(p.col).convertSRGBToLinear(),specular:new THREE.Color(p.spec,p.spec,p.spec),shininess:p.shin,side:THREE.DoubleSide}));
 }
}
OWM.makeKnife=function(){
 build();
 const g=new THREE.Group();g.name='knife';
 if(!GEO)return g;
 GEO.forEach((geo,i)=>{const m=new THREE.Mesh(geo,MAT[i]);m.frustumCulled=false;g.add(m)});
 return g;
};
})();
