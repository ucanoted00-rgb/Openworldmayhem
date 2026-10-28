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
  d:'Faca de combate com lâmina metálica e cabo próprio. Golpeia rápido.'},
 knife_intermediate:{id:'knife_intermediate',n:'Faca de pedra intermediária',dmg:17,cd:.52,hit:.4,
  d:'Lâmina de pedra presa à haste por cinco folhas trançadas. Causa 17 de dano.'},
 stone_knife:{id:'stone_knife',n:'Faca de pedra',dmg:20,cd:.48,hit:.4,
  d:'Faca de pedra montada com uma haste de madeira e uma lâmina de pedra.'}
};
OWM.weapon={id:null};

const b64=(s,T)=>{const bin=atob(s),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new T(u.buffer)};
let GEO=null,MAT=null,STONE_KNIFE_TEMPLATE=null;
OWM.stoneKnifeModelReady=false;OWM.stoneKnifeModelVersion=0;
/* Faca de pedra normal: modelo Low Poly Knife (GGklin), carregado do pack enviado.
   A orientação do eixo principal põe a ponta para +Y; escala final de 32 cm, como as outras armas. */
function prepareStoneKnifeModel(source){
 const holder=new THREE.Group();holder.name='stone_knife_uploaded_model';holder.add(source);
 const tipAxis=new THREE.Vector3(-.28,-.86,.42).normalize();
 holder.quaternion.setFromUnitVectors(tipAxis,new THREE.Vector3(0,1,0));holder.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(holder),size=box.getSize(new THREE.Vector3());
 const scale=.32/Math.max(size.y,.001);holder.scale.setScalar(scale);
 holder.position.set(-(box.min.x+box.max.x)*.5*scale,-box.min.y*scale-.09,-(box.min.z+box.max.z)*.5*scale);
 holder.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}});
 holder.updateMatrixWorld(true);return holder;
}
if(THREE.GLTFLoader){
 new THREE.GLTFLoader().load('stone-knife.gltf',g=>{
  STONE_KNIFE_TEMPLATE=prepareStoneKnifeModel(g.scene);OWM.stoneKnifeModelReady=true;OWM.stoneKnifeModelVersion++;
  console.info('[OWM] Modelo Low Poly Knife carregado para a faca de pedra normal.');
  if(typeof OWM.onStoneKnifeModelReady==='function')OWM.onStoneKnifeModelReady();
 },undefined,e=>console.error('[OWM] Falha ao carregar stone-knife.gltf; usando modelo de reserva.',e));
}
/* Textura procedural por vértice (pra lembrar o crafting): lâmina = pedra cinza com manchas e pontinhos; cabo = madeira com veios ao longo do cabo. */
const fr=x=>x-Math.floor(x),hs=(x,y,z)=>fr(Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453);
function vn(x,y,z){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),fx=x-ix,fy=y-iy,fz=z-iz,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),w=fz*fz*(3-2*fz),L=(a,b,t)=>a+(b-a)*t;
 return L(L(L(hs(ix,iy,iz),hs(ix+1,iy,iz),u),L(hs(ix,iy+1,iz),hs(ix+1,iy+1,iz),u),v),L(L(hs(ix,iy,iz+1),hs(ix+1,iy,iz+1),u),L(hs(ix,iy+1,iz+1),hs(ix+1,iy+1,iz+1),u),v),w)}
const fbm=(x,y,z)=>vn(x,y,z)*.55+vn(x*2.1,y*2.1,z*2.1)*.3+vn(x*4.3,y*4.3,z*4.3)*.15;
const lin=c=>c.map(v=>Math.pow(v/255,2.2));
const STONE=[[70,72,80],[135,137,145]],STONE2=[[112,114,122],[168,170,177]],WOOD=[[63,49,35],[151,107,74]],WOOD2=[[44,34,24],[104,74,50]],PIM=[[120,122,130],[170,172,178]];
function colorFor(id,x,y,z){
 let t,A,B,c;
 if(id==='cabo'||id==='empunhadura'){   // madeira: veios compridos no eixo do cabo (Y) + anéis suaves
  const g=fbm(x*260,y*16,z*260),ring=.5+.5*Math.sin(Math.hypot(x,z)*520+g*5);t=Math.min(1,Math.max(0,g*.65+ring*.35));[A,B]=id==='cabo'?WOOD:WOOD2;
 }else{   // pedra: manchas grandes + granulação + alguns pontinhos escuros
  const m=fbm(x*45,y*45,z*45),gr=vn(x*700,y*700,z*700);t=m*.7+gr*.5-.1-(hs(Math.floor(x*900),Math.floor(y*900),Math.floor(z*900))>.9?.35:0);t=Math.min(1,Math.max(0,(t-.45)*2.2+.5));[A,B]=id==='gume'?STONE2:id==='pomo'?PIM:STONE;
 }
 return lin([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t]);
}
function build(){
 if(GEO||!KP)return;
 GEO=[];MAT=[];
 for(const p of KP.parts){
  const q=b64(p.pos,Int16Array),n8=b64(p.nor,Int8Array),idx=b64(p.idx,Uint16Array),pos=new Float32Array(q.length),nor=new Float32Array(n8.length),col=new Float32Array(q.length);
  for(let i=0;i<q.length;i++){pos[i]=q[i]/1e4;nor[i]=n8[i]/127}
  for(let i=0;i<q.length;i+=3){const c=colorFor(p.id,pos[i],pos[i+1],pos[i+2]);col[i]=c[0];col[i+1]=c[1];col[i+2]=c[2]}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setIndex(new THREE.BufferAttribute(idx,1));
  g.computeBoundingSphere();GEO.push(g);
  const wood=p.id==='cabo'||p.id==='empunhadura';
  MAT.push(new THREE.MeshPhongMaterial({vertexColors:true,specular:new THREE.Color(wood?.04:.1,wood?.04:.1,wood?.04:.1),shininess:wood?8:14,side:THREE.DoubleSide}));
 }
}
OWM.makeKnife=function(){
 build();
 const g=new THREE.Group();g.name='knife';
 if(!GEO)return g;
 GEO.forEach((geo,i)=>{const m=new THREE.Mesh(geo,MAT[i]);m.frustumCulled=false;g.add(m)});
 return g;
};
/* Ferramentas da progressão de pedra, criadas em malha low-poly para não depender de textura externa. */
OWM.makeWeapon=function(id){
 if(!id)return null;
 if(id==='stone_knife'&&STONE_KNIFE_TEMPLATE)return STONE_KNIFE_TEMPLATE.clone(true);
 if(id==='knife'||!['knife_intermediate','stone_knife'].includes(id))return OWM.makeKnife();
 const g=new THREE.Group();g.name=id;
 const wood=new THREE.MeshStandardMaterial({color:0x76502e,roughness:.92,flatShading:true});
 const woodDark=new THREE.MeshStandardMaterial({color:0x4b321f,roughness:1,flatShading:true});
 const stone=new THREE.MeshStandardMaterial({color:0x858992,roughness:1,flatShading:true,side:THREE.DoubleSide});
 const stoneEdge=new THREE.MeshStandardMaterial({color:0xb0b3ba,roughness:1,flatShading:true,side:THREE.DoubleSide});
 const leaf=new THREE.MeshStandardMaterial({color:0x4f8b2d,roughness:1,flatShading:true,side:THREE.DoubleSide});
 const leafLight=new THREE.MeshStandardMaterial({color:0x79aa37,roughness:1,flatShading:true,side:THREE.DoubleSide});
 const handle=new THREE.Mesh(new THREE.CylinderGeometry(.012,.016,.135,6,1),wood);handle.position.y=-.025;handle.rotation.z=-.025;handle.castShadow=true;g.add(handle);
 const pommel=new THREE.Mesh(new THREE.CylinderGeometry(.017,.017,.012,6),woodDark);pommel.position.y=-.095;g.add(pommel);
 const shape=new THREE.Shape();shape.moveTo(-.012,.045);shape.lineTo(-.024,.105);shape.lineTo(-.016,.174);shape.lineTo(0,.252);shape.lineTo(.018,.188);shape.lineTo(.023,.12);shape.lineTo(.012,.045);shape.closePath();
 const geo=new THREE.ExtrudeGeometry(shape,{depth:.012,bevelEnabled:false,steps:1});geo.translate(0,0,-.006);geo.computeVertexNormals();
 const blade=new THREE.Mesh(geo,stone);blade.castShadow=true;blade.receiveShadow=true;g.add(blade);
 const edgeShape=new THREE.Shape();edgeShape.moveTo(-.012,.05);edgeShape.lineTo(-.024,.105);edgeShape.lineTo(-.016,.174);edgeShape.lineTo(0,.252);edgeShape.lineTo(-.002,.17);edgeShape.lineTo(-.006,.105);edgeShape.closePath();
 const eg=new THREE.ShapeGeometry(edgeShape);eg.translate(0,0,.0065);const edge=new THREE.Mesh(eg,stoneEdge);g.add(edge);
 const bandMat=id==='knife_intermediate'?leaf:woodDark;
 for(let i=0;i<(id==='knife_intermediate'?4:2);i++){
  const band=new THREE.Mesh(new THREE.TorusGeometry(.017,.0028,4,8),bandMat);band.rotation.x=Math.PI/2;band.position.y=.036+i*.009;g.add(band);
 }
 if(id==='knife_intermediate'){
  // Tiras de folha visíveis cruzando a junção: deixam claro que lâmina e haste estão amarradas.
  for(let i=0;i<3;i++){
   const strip=new THREE.Mesh(new THREE.BoxGeometry(.032,.006,.004),i===1?leafLight:leaf);
   strip.position.set(0,.032+i*.009,.009);strip.rotation.z=(i-1)*.28;g.add(strip);
  }
  const knot=new THREE.Mesh(new THREE.OctahedronGeometry(.008,0),leafLight);knot.position.set(.012,.049,.012);g.add(knot);
 }
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
 return g;
};
})();
