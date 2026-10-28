/* Decisão pura e determinística para rios por região; usada no jogo e nos testes. */
(function(root){
 'use strict';
 const PRESENCE_CHANCE=.78;
 const TWO_RIVER_CHANCE=.50;
 const OFFSETS_TWO=Object.freeze([-58,58]);
 const OFFSETS_THREE=Object.freeze([-80,0,80]);
 function roll(v){return Number.isFinite(v)?Math.max(0,Math.min(.999999999999,v)):1;}
 function decide(presenceRoll,countRoll){
  const active=roll(presenceRoll)<PRESENCE_CHANCE;
  const count=roll(countRoll)<TWO_RIVER_CHANCE?2:3;
  return Object.freeze({active,count,offsets:count===2?OFFSETS_TWO:OFFSETS_THREE});
 }
 const api=Object.freeze({PRESENCE_CHANCE,TWO_RIVER_CHANCE,OFFSETS_TWO,OFFSETS_THREE,decide});
 root.OWMRiverLogic=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
