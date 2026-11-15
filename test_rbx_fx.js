/* Teste de fumaça das partículas estilo Roblox (game.js): extrai o bloco RBX e roda com THREE/scene simulados. node test_rbx_fx.js */
'use strict';
const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(__dirname+'/game.js','utf8');
const a=src.indexOf('/* ---------- Partículas de impacto estilo Roblox'),b=src.indexOf('function comboHit(');
assert(a>0&&b>a,'bloco não encontrado');
assert(!/BoxGeometry/.test(src.slice(a,b)),'ainda há cubos no bloco de impacto');
const blk=src.slice(a,b);
const scene={kids:new Set(),add(o){this.kids.add(o)},remove(o){this.kids.delete(o)}};
class V{set(x,y,z){this.x=x;this.y=y;this.z=z}}
const THREE={AdditiveBlending:2,NormalBlending:1,CanvasTexture:class{constructor(c){this.c=c}},
 SpriteMaterial:class{constructor(o){Object.assign(this,o);this.color={setHex:h=>{this.hex=h}};this.opacity=1;this.rotation=0}},
 Sprite:class{constructor(m){this.material=m;this.position=Object.assign(new V(),{x:0,y:0,z:0});this.scale=new V();this.visible=true}}};
const document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:(t,k)=>k==='createRadialGradient'?()=>({addColorStop(){}}):()=>{},set:()=>true})})};
const P={yaw:.7,p:{x:0,y:0,z:0}},eye={x:0,y:1.7,z:0},anim={strikeInfo:()=>null},comboArmed=()=>true;
const fn=new Function('THREE','scene','document','P','eye','anim','comboArmed',blk+';return {RBX,rbxUpdate,spawnComboFx,spawnImpactFx,spawnLmbFx,lmbHitFx,spawnMobHitFx}');
const F=fn(THREE,scene,document,P,eye,anim,comboArmed);
let n=0;const ok=(c,m)=>{n++;if(!c)throw new Error('FALHOU: '+m)};
const o={x:1,y:1,z:1};
for(const [k,idx,fin,landed] of [[1,0,false,true],[1,1,false,false],[2,2,false,true],[2,4,true,true],[2,3,true,false]])F.spawnComboFx(k===0?null:o,k,idx,fin,landed);
F.spawnImpactFx(o,1,false);F.spawnImpactFx(o,2,true);F.spawnLmbFx(o,true);F.spawnLmbFx(o,false);F.lmbHitFx(o);
F.spawnMobHitFx({x:3,y:0,z:0,tg:null});F.spawnMobHitFx({x:3,y:0,z:0,tg:{x:1,y:0,z:1}});
ok(F.RBX.live.length>40&&F.RBX.live.length<=F.RBX.MAX,'quantidade de sprites razoável: '+F.RBX.live.length);
ok(F.RBX.live.every(p=>p.sp.material.map&&p.size>0&&p.l0>0),'sprites com textura/tamanho/vida');
const peak=F.RBX.live.length;
for(let t=0;t<90;t++){F.rbxUpdate(1/60);for(const p of F.RBX.live){const s=p.sp.scale,m=p.sp.material;ok(Number.isFinite(s.x)&&Number.isFinite(p.sp.position.y)&&m.opacity>=0&&m.opacity<=1.0001,'valores finitos/opacidade 0..1')}}
ok(F.RBX.live.length===0&&scene.kids.size===0,'tudo some em ≤1,5 s e sai da cena');
ok(F.RBX.pool.length===peak,'pool reaproveita os sprites ('+F.RBX.pool.length+')');
for(let i=0;i<40;i++)F.spawnImpactFx(o,2,true);ok(F.RBX.live.length<=F.RBX.MAX,'teto de sprites respeitado');
anim.strikeInfo=()=>({kind:1});const before=F.RBX.live.length;F.lmbHitFx(o);ok(F.RBX.live.length===before,'LMB não duplica o efeito quando há combo no mesmo golpe');
console.log(n+' verificações OK (pico '+peak+' sprites por rodada de testes; teto '+F.RBX.MAX+')');
