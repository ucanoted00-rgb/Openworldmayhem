/* Open World Mayhem — medidor de desempenho (abra o jogo com ?bench=1).
   F8 inicia/para uma gravação; ao parar mostra p50/p95/p99 do tempo de quadro, hitches >33 ms, renderer.info, heap e baixa um JSON.
   Rótulo do cenário: window.__benchLabel='floresta' (ou o que quiser) antes de apertar F8.
   NÃO é determinístico (não fixa seed, hora do dia nem câmera): anda você mesmo, sempre pelo mesmo trajeto, e compare antes/depois no MESMO aparelho. */
(()=>{
const R=OWM.R,box=document.createElement('pre');
box.style.cssText='position:fixed;left:6px;top:6px;z-index:99999;margin:0;padding:6px 8px;background:#000a;color:#9f9;font:11px monospace;pointer-events:none;max-width:60vw;white-space:pre-wrap';
document.body.appendChild(box);
const t0=performance.now();let rec=null,last=0;
const pct=(a,p)=>a.length?a[Math.min(a.length-1,Math.floor(a.length*p))]:0;
function stats(){
 const a=rec.d.slice().sort((x,y)=>x-y),i=R.info;
 return{cenario:window.__benchLabel||'sem rótulo',quadros:a.length,p50:+pct(a,.5).toFixed(2),p95:+pct(a,.95).toFixed(2),p99:+pct(a,.99).toFixed(2),
  hitches33:a.filter(v=>v>33).length,fpsMedio:+(1000*a.length/a.reduce((s,v)=>s+v,0)).toFixed(1),
  drawCalls:i.render.calls,triangulos:i.render.triangles,geometrias:i.memory.geometries,texturas:i.memory.textures,programas:i.programs?i.programs.length:0,
  heapMB:performance.memory?+(performance.memory.usedJSHeapSize/1048576).toFixed(1):null,
  altura:OWM.post.info(),alvoFps:OWM.post.targetFps(),aa:OWM.S.aa,hz:OWM.S.hz,
  cargaScriptsMs:Math.round(t0),ua:navigator.userAgent,gpu:OWM.device.gpu};
}
function loop(now){
 requestAnimationFrame(loop);
 if(last&&rec)rec.d.push(now-last);last=now;
 box.textContent=(rec?'● GRAVANDO '+rec.d.length+' quadros\n':'F8: iniciar/parar gravação\n')+'draw calls '+R.info.render.calls+' · tris '+R.info.render.triangles+'\n'+OWM.post.info()+' · alvo '+OWM.post.targetFps()+' fps';
}
requestAnimationFrame(loop);
addEventListener('keydown',e=>{
 if(e.code!=='F8')return;e.preventDefault();
 if(!rec){rec={d:[]};return}
 const r=stats();rec=null;(window.__bench=window.__bench||[]).push(r);console.table([r]);
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(window.__bench,null,1)],{type:'application/json'}));a.download='owm-bench.json';a.click();
});
})();
