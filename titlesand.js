/* Open World Mayhem — fundo "Tempestade de areia" da tela inicial (alternativa ao panorama, escolhida em Configurações → "Fundo da tela inicial").
   Canvas 2D leve atrás da interface: céu ocre, véus de poeira correndo com o vento, rajadas e grãos esticados em 3 camadas de profundidade.
   OWM.titleSand.tick(dt,on) é chamado todo quadro pelo loop do menu; com on=false o canvas fica escondido e não gasta nada. */
(()=>{
const OWM=window.OWM||(window.OWM={});
const cv=document.createElement('canvas');cv.id='tsand';cv.style.cssText='position:fixed;inset:0;width:100%;height:100%;display:none;z-index:1;pointer-events:none';
document.body.insertBefore(cv,document.getElementById('ui')||null);
const g=cv.getContext('2d');let W=0,H=0,T=0,vis=false;
const GR=[],VEIL=[];
const rnd=Math.random;
function size(){const d=Math.min(devicePixelRatio||1,1.5);W=cv.width=Math.ceil(innerWidth*d*.5);H=cv.height=Math.ceil(innerHeight*d*.5)}  // metade da resolução: fundo borrado, barato
for(let i=0;i<260;i++)GR.push({x:rnd(),y:rnd(),z:rnd(),s:.6+rnd()*.8});
for(let i=0;i<9;i++)VEIL.push({x:rnd(),y:rnd(),r:.25+rnd()*.35,s:.4+rnd()*.7,a:.08+rnd()*.12});
addEventListener('resize',size);size();
function tick(dt,on){
 if(on!==vis){vis=on;cv.style.display=on?'block':'none';if(on)size()}
 if(!on)return;
 dt=Math.min(dt,.05);T+=dt;
 const gust=.75+.25*Math.sin(T*.35)+.18*Math.sin(T*1.3+1),wind=gust*(W*.55);   // px/s
 const sky=g.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#8a5a30');sky.addColorStop(.55,'#c48a4a');sky.addColorStop(1,'#a06a36');
 g.globalCompositeOperation='source-over';g.fillStyle=sky;g.fillRect(0,0,W,H);
 /* sol apagado atrás da poeira */
 const sx=W*.72,sy=H*.28,sr=g.createRadialGradient(sx,sy,0,sx,sy,H*.5);sr.addColorStop(0,'rgba(255,226,160,.55)');sr.addColorStop(1,'rgba(255,226,160,0)');g.fillStyle=sr;g.fillRect(0,0,W,H);
 /* véus de poeira */
 for(const v of VEIL){v.x+=dt*v.s*.09*gust;if(v.x>1.5)v.x=-.5;const x=v.x*W,y=(v.y+Math.sin(T*.3*v.s+v.r*9)*.04)*H,r=v.r*Math.max(W,H),k=g.createRadialGradient(x,y,0,x,y,r);
  k.addColorStop(0,'rgba(236,190,120,'+v.a*1.6+')');k.addColorStop(1,'rgba(236,190,120,0)');g.fillStyle=k;g.fillRect(x-r,y-r,r*2,r*2)}
 /* grãos: rastros esticados na direção do vento (mais perto = maior, mais rápido, mais claro) */
 g.lineCap='round';
 for(const p of GR){const sp=wind*(.35+p.z*1.25)*p.s;p.x+=sp*dt/W;p.y+=Math.sin(T*2+p.s*20)*dt*.02+dt*.012*p.z;if(p.x>1.1){p.x-=1.2;p.y=rnd()}if(p.y>1)p.y-=1;
  const x=p.x*W,y=p.y*H,L=(6+p.z*38)*gust*p.s;g.strokeStyle='rgba(255,222,170,'+(.12+p.z*.4)+')';g.lineWidth=.6+p.z*1.6;g.beginPath();g.moveTo(x,y);g.lineTo(x-L,y-L*.12);g.stroke()}
 /* rajada: véu claro que passa rápido */
 const gx=((T*.18)%1.6-.3)*W,gk=g.createLinearGradient(gx-W*.3,0,gx+W*.3,0);gk.addColorStop(0,'rgba(240,200,140,0)');gk.addColorStop(.5,'rgba(240,200,140,'+(.1+.1*Math.max(0,Math.sin(T*.9)))+')');gk.addColorStop(1,'rgba(240,200,140,0)');g.fillStyle=gk;g.fillRect(0,0,W,H);
 /* vinheta */
 const vg=g.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,Math.max(W,H)*.75);vg.addColorStop(0,'rgba(60,30,10,0)');vg.addColorStop(1,'rgba(60,30,10,.55)');g.fillStyle=vg;g.fillRect(0,0,W,H);
}
OWM.titleSand={tick};
})();
