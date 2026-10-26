/* Open World Mayhem — trilha por tela, com fade entre faixas.
   title/worlds/new → "The Show Must Go On" (Toilet Takeover OST) · pause → "Rush Hour" (ST: Blockade OST)
   settings → "Chill Synthwave - Digital Sunset" (Karl Casey @ White Bat Audio).
   jogo (tela '') dentro do deserto → "Desolate Desert" (Super Mombo Quest OST); fora do deserto e demais telas: sem música. */
(()=>{
const {S,toast}=OWM;
const TRACKS={
 title:'the-show-must-go-on.mp3',
 pause:'rush-hour.mp3',
 settings:'digital-sunset.mp3',
 desert:'desolate-desert.mp3'   // só toca no jogo (tela ''), quando OWM.musicBiome('desert')
};
const SCREEN={title:'title',worlds:'title',new:'title',pause:'pause',settings:'settings'};
const au={};let want='',timer=0,cur='',warned=false,biome='';
const pick=()=>SCREEN[cur]||(cur===''&&biome==='desert'?'desert':'');
const level=()=>Math.pow(Math.max(0,Math.min(100,S.mvol))/100,2);
function ensure(t){
 if(au[t])return au[t];
 const a=new Audio();a.loop=true;a.preload='auto';a.volume=0;
 a.addEventListener('error',()=>{if(!warned){warned=true;console.warn('[OWM] Música não encontrada: '+TRACKS[t]);toast('Música não encontrada: '+TRACKS[t])}});
 a.src=TRACKS[t];return au[t]=a;
}
function run(){
 if(timer)return;
 timer=setInterval(()=>{
  let busy=false;
  for(const t in au){
   const a=au[t],g=(t===want&&!document.hidden)?level():0,d=g-a.volume;
   if(Math.abs(d)<=.03){a.volume=Math.max(0,Math.min(1,g));if(g===0&&!a.paused)a.pause()}
   else{a.volume=Math.max(0,Math.min(1,a.volume+Math.sign(d)*.03));busy=true}
  }
  if(!busy){clearInterval(timer);timer=0}
 },40);
}
function sync(){
 if(want&&!document.hidden){
  const a=ensure(want);
  if(a.paused){const p=a.play();if(p&&p.catch)p.catch(()=>{})}   // autoplay bloqueado: tenta de novo no primeiro toque/tecla
 }
 run();
}
OWM.onScreen=id=>{if(id==='creator')return;cur=id;want=pick();sync()};
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){for(const t in au){au[t].pause();au[t].volume=0}}
 else{want=pick();sync()}
});
for(const ev of ['pointerdown','keydown','touchstart'])addEventListener(ev,()=>{if(want&&au[want]&&au[want].paused)sync()},{passive:true});
/* Bioma atual do jogador (o game.js chama quando entra/sai do deserto); só vale na tela de jogo. */
OWM.musicBiome=b=>{if(b===biome)return;biome=b;if(cur===''){want=pick();sync()}};
OWM.music={vol(){run()}};
})();
