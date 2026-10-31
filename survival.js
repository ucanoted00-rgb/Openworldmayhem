/* Lógica pura de fome/sede. Mantida separada para permitir testes determinísticos em Node.js. */
(function(root){
 'use strict';
 const MAX=300;
 const HUNGER_SECONDS=220/.93; // base de 3 min 40 s com a perda de fome 7% mais lenta (≈ 3 min 56,6 s do cheio ao zero)
 const THIRST_MIN_SECONDS=180; // 3 min
 const THIRST_MAX_SECONDS=300; // 5 min
 const SWIM_RECOVERY_PER_SECOND=8;
 const DAMAGE_INTERVAL_SECONDS=30;
 const HUNGER_DAMAGE_CHANCE=.10;
 const DAMAGE_AMOUNT=5;
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(v)?v:min));
 const api=Object.freeze({
  MAX,HUNGER_SECONDS,THIRST_MIN_SECONDS,THIRST_MAX_SECONDS,SWIM_RECOVERY_PER_SECOND,DAMAGE_INTERVAL_SECONDS,HUNGER_DAMAGE_CHANCE,DAMAGE_AMOUNT,
  drain(value,dt,emptySeconds){const t=Math.max(.001,Number(emptySeconds)||HUNGER_SECONDS),next=clamp(value,0,MAX)-MAX/t*Math.max(0,dt);return clamp(next,0,MAX)},
  recover(value,dt,perSecond){return clamp(clamp(value,0,MAX)+Math.max(0,dt)*Math.max(0,perSecond),0,MAX)},
  eat(value,amount=5){return clamp(value,0,MAX)+Math.min(Math.max(0,MAX-clamp(value,0,MAX)),Math.max(0,amount))},
  canSprint(hunger){return Number.isFinite(hunger)&&hunger>0},
  thirstSecondsFromRoll(roll){return THIRST_MIN_SECONDS+clamp(roll,0,1)*(THIRST_MAX_SECONDS-THIRST_MIN_SECONDS)},
  periodicTicks(timer,dt,interval){const every=Math.max(.001,Number(interval)||DAMAGE_INTERVAL_SECONDS),total=Math.max(0,Number(timer)||0)+Math.max(0,Number(dt)||0),count=Math.floor(total/every);return{count,remainder:total-count*every}},
  hungerDamageRoll(roll){return Number.isFinite(roll)&&roll>=0&&roll<HUNGER_DAMAGE_CHANCE}
 });
 root.OWMSurvival=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
