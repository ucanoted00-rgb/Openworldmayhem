/* Open World Mayhem — evento climático de névoa para a floresta normal e o cerejeiral.
   Probabilidade acumulada de 40% a cada 220 s (3:40) de tempo elegível; a taxa aumenta à noite.
   A névoa piora a visibilidade distante, mas preserva boa leitura de perto. */
(()=>{
const {toast,post}=OWM;
const CFG={WINDOW:220,BASE_P:0.40,NIGHT_BONUS:0.8,DUR_MIN:55,DUR_MAX:90,IN:8,OUT:12};
const RATE=-Math.log(1-CFG.BASE_P)/CFG.WINDOW;
const F={on:false,t:0,dur:0,env:0,k:0,night:0,biome:'cherry'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{v=clamp((v-a)/(b-a),0,1);return v*v*(3-2*v)};
function start(night,biome){
 F.on=true;F.t=0;F.dur=CFG.DUR_MIN+Math.random()*(CFG.DUR_MAX-CFG.DUR_MIN);F.night=night;F.biome=biome;
 const nome=biome==='cherry'?'cerejeiral':'floresta';
 toast(night>.55?'A névoa noturna está chegando à '+nome+'!':'Uma névoa está chegando à '+nome+'!');
}
function update(dt,cherryZone,forestZone){
 dt=Math.max(0,Math.min(.1,dt||0));
 cherryZone=clamp(cherryZone||0,0,1);forestZone=clamp(forestZone||0,0,1);
 const zone=Math.max(cherryZone,forestZone);
 const biome=cherryZone>=forestZone?'cherry':'forest';
 const eligible=zone>.45;
 const night=post&&post.getNightFactor?post.getNightFactor():0;
 if(eligible&&!F.on){
  // A chance é acumulada ao longo do tempo, não sorteada toda vez que entra no bioma.
  // Em 220 s a probabilidade é 40% durante o dia e ~60% no pico da noite.
  const hazard=RATE*(1+CFG.NIGHT_BONUS*night);
  if(Math.random()<1-Math.exp(-hazard*dt))start(night,biome);
 }
 if(F.on){
  F.t+=dt;
  if(F.t>=F.dur){F.on=false;F.t=F.dur;toast(F.biome==='cherry'?'A névoa do cerejeiral se dissipou.':'A névoa da floresta se dissipou.');}
 }
 const target=F.on?Math.min(1,F.t/CFG.IN,(F.dur-F.t)/CFG.OUT):0;
 F.env+=(target-F.env)*(1-Math.exp(-dt*1.7));
 const zoneGate=smooth(.05,.55,zone);
 F.k=clamp(F.env*zoneGate,0,1);
 F.night=night;
 if(post&&post.setCherryFog)post.setCherryFog(F.k,night,biome);
}
function reset(){F.on=false;F.t=0;F.dur=0;F.env=0;F.k=0;F.night=0;F.biome='cherry';if(post&&post.setCherryFog)post.setCherryFog(0,0,'cherry')}
OWM.cherryFog={update,reset,state:F};
})();
