/* OWM — mantém o botão criado pelo sistema do jetpack no slot declarado em index.html.
   O game.js prepara os eventos de dois toques e substitui este placeholder pelo botão funcional. */
(()=>{
 'use strict';
 const body=document.body;
 if(!body||body.__owmFlySlotHook)return;
 body.__owmFlySlotHook=true;
 const append=body.appendChild.bind(body);
 body.appendChild=function(node){
  if(node&&node.nodeType===1&&node.id==='bFly'){
   const placeholder=document.getElementById('bFly');
   if(placeholder&&placeholder!==node){
    placeholder.replaceWith(node);
    return node;
   }
  }
  return append(node);
 };
})();
