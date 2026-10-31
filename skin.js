/* Open World Mayhem — skin do player (modelo low poly).
   Guarda a cor de cada parte (pele, cabelo, camisa, calça, sapatos), desenha o ícone do inventário,
   fornece material/geometria do braço em 1ª pessoa. A tela de edição fica em creator.js. */
(()=>{
const {ld,st}=OWM;

const PARTS=[['skin','Pele'],['hair','Cabelo'],['shirt','Roupa'],['pants','Calça'],['sash','Faixa'],['shoes','Sapatos']];
const mk=(skin,hair,shirt,pants,shoes,hairStyle,sash)=>({skin,hair,shirt,pants,shoes,sash:sash||shoes,hairStyle:hairStyle||'classic'});   // sash = faixa, pulseiras e gola (parte azul do Goku)
const PRESETS=[
 ['Goku',mk('#fefcac','#0c0c10','#ffa138','#ffa138','#0a005a','classic','#0a005a')],
 ['Goku azul',mk('#fefcac','#0c0c10','#2f7fe6','#2f7fe6','#d9261c','classic','#d9261c')],
 ['Casual',mk('#e8b98a','#3b2a1a','#2f6fb5','#2b2f3a','#f2f2f2','short','#f2f2f2')],
 ['Verde',mk('#c68a5a','#111111','#287f47','#4b3a2a','#1b1b1b','buzz','#1b1b1b')],
 ['Sombra',mk('#9aa0b4','#0d0d12','#23252f','#16171d','#0a0a0d','spiky','#0d0d12')],
 ['Rosa',mk('#f6d8c4','#8e3b6d','#e8579a','#6d3b8e','#ffffff','pigtails','#ffffff')],
 ['Dourado',mk('#f0c89a','#e5b23a','#e29b28','#6e4a1e','#3a2a14','long','#3a2a14')],
 ['Punk',mk('#f0c89a','#e8301f','#15151b','#3a3f55','#c8c8d0','mohawk','#e8301f')],
 ['Executivo',mk('#8a5030','#1a1109','#e9e9ef','#23252f','#0d0d12','quiff','#23252f')],
 ['Surfista',mk('#dc9659','#e8cc7a','#1fa8c9','#f2e8c9','#e8579a','bob','#e8579a')],
 ['Zen',mk('#c68a5a','#0d0d12','#8e5bd6','#2b2f3a','#f2f2f2','bun','#f2f2f2')],
];

const colors={...PRESETS[0][1],...ld('bc.skin3',{})};   // bc.skin3: personagem Goku (a chave antiga bc.skin2 era do modelo anterior)
delete colors.bodyStyle; // remove a seleção antiga de corpos importados dos saves existentes
if(!(OWM.hair&&OWM.hair.styles.some(x=>x.id===colors.hairStyle)))colors.hairStyle='classic';
const SK_COLORS=colors;
const lin=hex=>new THREE.Color(hex).convertSRGBToLinear();   // cor escolhida (sRGB) → linear, igual ao que aparece na tela

/* Material do braço em 1ª pessoa (o game.js clona este material) — usa a cor da pele */
const mat=new THREE.MeshLambertMaterial({color:lin(colors.skin)});

/* Caixa em "pixels" (1 bloco = 16). Centro na origem. */
const geo=(w,h,d)=>new THREE.BoxGeometry(w/16,h/16,d/16);

const subs=[];
const listen=fn=>{subs.push(fn);fn(colors)};
function apply(){
 mat.color.copy(lin(colors.skin));
 subs.forEach(f=>f(colors));
}

/* Ícone frontal do personagem (usado no inventário e na tela de skin). Figura de 5 x 9.8 unidades. */
function drawFront(ctx,w,h,col){
 const colors=col||SK_COLORS;
 const cv=ctx.canvas;w=w||cv.width;h=h||cv.height;
 ctx.clearRect(0,0,w,h);
 const u=Math.max(1,Math.floor(Math.min(w/5,h/9.8)));
 const ox=Math.round((w-5*u)/2),oy=Math.round((h-9.8*u)/2);
 const R=(c,x,y,ww,hh)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(ox+x*u),Math.round(oy+y*u),Math.max(1,Math.round(ww*u)),Math.max(1,Math.round(hh*u)))};
 /* braços (pele) saem de baixo das mangas, com a pose em A */
 R(colors.skin,.45,3.5,.6,2.3);R(colors.skin,3.95,3.5,.6,2.3);
 /* pernas + sapatos */
 R(colors.pants,1.35,5.0,1.1,3.9);R(colors.pants,2.55,5.0,1.1,3.9);
 R(colors.shoes,1.25,8.5,1.3,1.3);R(colors.shoes,2.45,8.5,1.3,1.3);
 /* camisa, mangas e gola/faixa (cor 'sash'), pulseiras */
 R(colors.shirt,1.3,2.2,2.4,2.9);R(colors.sash,.7,2.2,.65,1.35);R(colors.sash,3.65,2.2,.65,1.35);R(colors.sash,2.0,2.2,1.0,.7);R(colors.sash,1.3,4.55,2.4,.5);R(colors.sash,.45,5.3,.6,.55);R(colors.sash,3.95,5.3,.6,.55);
 /* pescoço, cabeça e cabelo */
 R(colors.skin,2.2,1.85,.6,.5);
 R(colors.skin,1.8,.5,1.4,1.45);
 if(colors.hairStyle!=='bald'){R(colors.hair,1.7,0,1.6,.8);R(colors.hair,1.7,.7,.2,.6);R(colors.hair,3.1,.7,.2,.6)}
 /* rosto */
 const e=Math.max(1,Math.round(u*.15))/u;
 R('#111',2.1,1.05,e,e*1.4);R('#111',2.7,1.05,e,e*1.4);
 R('#111',2.3,1.5,.4,e);
}

const save=()=>{st('bc.skin3',colors);apply()};

OWM.skin={mat,geo,drawFront,colors,listen,apply,save,PARTS,PRESETS};
apply();
})();
