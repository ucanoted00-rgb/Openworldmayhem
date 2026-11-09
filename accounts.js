/* Open World Mayhem — contas e amigos (cliente).
   Carregar DEPOIS de game.js. Fala com server.js (mesmo endereço do jogo, ou o endereço digitado em "Servidor").
   Adiciona ao menu inicial o botão "Conta" (deslogado) / "Amigos" (logado) e expõe OWM.account para o resto do jogo. */
(()=>{
const {E,B,fld,go,toast,mkScreen,screens,ld,st}=OWM;
const KEY='owm.auth',KAPI='owm.api',USER_RE=/^[A-Za-z0-9_]{3,16}$/;
let auth=ld(KEY,null);                       // {token, username}
let social={friends:[],incoming:[],outgoing:[]};
let busy=false,seenIncoming=null;
const listeners=[];

/* ---------- rede ---------- */
const web=/^https?:$/.test(location.protocol);
const base=()=>String(ld(KAPI,'')||(web?location.origin:'http://localhost:3000')).trim().replace(/\/+$/,'');
async function api(path,{method='GET',body,authed=true}={}){
 const h={};if(body)h['Content-Type']='application/json';if(authed&&auth)h.Authorization='Bearer '+auth.token;
 const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),8000);let r;
 try{r=await fetch(base()+path,{method,headers:h,body:body?JSON.stringify(body):undefined,signal:ctl.signal})}
 catch(e){throw{code:0,msg:'Sem conexão com o servidor ('+base()+').'}}
 finally{clearTimeout(tm)}
 let j={};try{j=await r.json()}catch(e){}
 if(!r.ok){if(r.status===401&&authed&&auth){drop();toast('Sessão expirada. Entre de novo.')}throw{code:r.status,msg:j.error||'Erro '+r.status}}
 return j;
}
const emit=()=>{refreshTitleBtn();listeners.forEach(f=>{try{f(OWM.account)}catch(e){}})};
function drop(){auth=null;social={friends:[],incoming:[],outgoing:[]};seenIncoming=null;st(KEY,null);try{localStorage.removeItem(KEY)}catch(e){}emit();if(!FS.classList.contains('hidden'))go('title')}

/* ---------- botão no menu inicial ---------- */
const TS=screens.title;
const refBtn=[...TS.children].find(b=>b.tagName==='BUTTON'&&b.textContent==='Configurações');
const titleBtn=B('Conta',()=>auth?openFriends():openAccount(),TS);
if(refBtn)TS.insertBefore(titleBtn,refBtn);
function refreshTitleBtn(){titleBtn.textContent=auth?'Amigos'+(social.incoming.length?' ('+social.incoming.length+')':''):'Conta'}

/* ---------- tela: entrar / criar conta ---------- */
const AS=mkScreen('acct','Conta','solid');
let mode='login';
const tabs=E('div','row',null,AS);
const tLogin=B('Entrar',()=>setMode('login'),tabs,'tab'),tReg=B('Criar conta',()=>setMode('register'),tabs,'tab');
const fUser=fld('Nome de usuário',AS),fPass=fld('Senha',AS),fPass2=fld('Repetir senha',AS),fSrv=fld('Servidor',AS);
const msg=E('div','dsc acc-msg','',AS);
const bGo=B('Entrar',submit,AS);
const aRow=E('div','row',null,AS);
const bSrv=B('Servidor',()=>{fSrv.parentNode.classList.toggle('hidden')},aRow),bBack=B('Voltar',()=>go('title'),aRow);
fUser.maxLength=16;fUser.autocomplete='username';fUser.autocapitalize='none';fUser.spellcheck=false;
fPass.type=fPass2.type='password';fPass.maxLength=fPass2.maxLength=72;
fSrv.autocapitalize='none';fSrv.spellcheck=false;fSrv.inputMode='url';
[fUser,fPass,fPass2].forEach(i=>i.addEventListener('keydown',e=>{if(e.key==='Enter')submit()}));
function setMsg(t,bad){msg.textContent=t||'';msg.classList.toggle('bad',!!bad)}
function setMode(m){
 mode=m;const reg=m==='register';
 tLogin.classList.toggle('on',!reg);tReg.classList.toggle('on',reg);
 fPass2.parentNode.classList.toggle('hidden',!reg);bGo.textContent=reg?'Criar conta':'Entrar';
 fPass.autocomplete=reg?'new-password':'current-password';
 setMsg(reg?'Nome: 3 a 16 caracteres (letras, números e _). Senha: mínimo 8.':'');
}
async function submit(){
 if(busy)return;
 const username=fUser.value.trim(),password=fPass.value;
 if(!USER_RE.test(username))return setMsg('Nome de usuário: 3 a 16 caracteres (letras, números e _).',1);
 if(password.length<8)return setMsg('A senha precisa ter pelo menos 8 caracteres.',1);
 if(mode==='register'&&password!==fPass2.value)return setMsg('As senhas não são iguais.',1);
 if(!fSrv.parentNode.classList.contains('hidden')){
  let srv=fSrv.value.trim().replace(/\/+$/,'');if(srv&&!/^https?:\/\//i.test(srv))srv='http://'+srv;
  st(KAPI,srv&&srv!==(web?location.origin:'')?srv:'');
 }
 busy=true;bGo.disabled=true;setMsg('Conectando…');
 try{
  const r=await api(mode==='register'?'/api/register':'/api/login',{method:'POST',body:{username,password},authed:false});
  auth={token:r.token,username:r.user.username};st(KEY,auth);
  fPass.value=fPass2.value='';setMsg('');toast((mode==='register'?'Conta criada! Bem-vindo, ':'Bem-vindo de volta, ')+auth.username+'!');
  emit();openFriends();
 }catch(e){setMsg(e.msg||'Algo deu errado.',1);if(e.code===0)fSrv.parentNode.classList.remove('hidden')}
 finally{busy=false;bGo.disabled=false}
}
function openAccount(){
 fSrv.value=base();fSrv.parentNode.classList.toggle('hidden',web);   // aberto por file:// precisa informar o servidor
 fPass.value=fPass2.value='';setMode('login');go('acct');
}

/* ---------- tela: amigos ---------- */
const FS=mkScreen('friends','Amigos','solid');
const who=E('div','dsc acc-who','',FS);
const fAdd=fld('Adicionar amigo (nome de usuário)',FS);
fAdd.maxLength=16;fAdd.autocapitalize='none';fAdd.spellcheck=false;
const bAdd=B('Enviar pedido',()=>act('request',fAdd.value.trim(),()=>{fAdd.value='';}),FS);
fAdd.addEventListener('keydown',e=>{if(e.key==='Enter')bAdd.click()});
const flist=E('div','list acc-list',null,FS);
const fmsg=E('div','dsc acc-msg','',FS);
const fRow=E('div','row',null,FS);
B('Atualizar',()=>refresh(true),fRow);B('Sair da conta',logout,fRow);
B('Voltar',()=>go('title'),FS);

function ago(t){
 const s=Math.max(0,(Date.now()-t)/1e3|0);if(!t)return 'offline';
 if(s<90)return 'visto agora há pouco';if(s<3600)return 'visto há '+(s/60|0)+' min';
 if(s<86400)return 'visto há '+(s/3600|0)+' h';return 'visto há '+(s/86400|0)+' d';
}
function addRow(p,{name,sub,dot,acts}){
 const d=E('div','acc-row',null,p);
 if(dot!=null)E('span','acc-dot'+(dot?' on':''),null,d);
 const t=E('div','acc-t',null,d);E('p','',name,t);if(sub)E('p','',sub,t);
 const a=E('div','acc-a',null,d);
 (acts||[]).forEach(x=>B(x.t,x.f,a,'mini'+(x.cls?' '+x.cls:'')));
}
function head(t){E('div','acc-h',t,flist)}
function renderFriends(){
 who.textContent=auth?'Conectado como '+auth.username:'';
 flist.textContent='';
 const {friends:F,incoming:I,outgoing:O}=social;
 if(I.length){head('Pedidos recebidos ('+I.length+')');I.forEach(x=>addRow(flist,{name:x.username,sub:'quer ser seu amigo',acts:[
  {t:'Aceitar',cls:'ok',f:()=>act('accept',x.username)},{t:'Recusar',f:()=>act('decline',x.username)}]}))}
 head('Amigos ('+F.length+')');
 if(!F.length)E('div','acc-empty','Nenhum amigo ainda. Envie um pedido pelo nome de usuário.',flist);
 F.forEach(x=>addRow(flist,{name:x.username,dot:x.online,sub:x.online?'online':ago(x.lastSeen),acts:[confirmBtn(x.username)]}));
 if(O.length){head('Pedidos enviados ('+O.length+')');O.forEach(x=>addRow(flist,{name:x.username,sub:'aguardando resposta',acts:[{t:'Cancelar',f:()=>act('cancel',x.username)}]}))}
}
function confirmBtn(name){   // "Remover" exige um segundo toque para não apagar amizade sem querer
 let armed=false,tm=0;
 return{t:'Remover',cls:'warn',f:function(){
  const b=this;
  if(!armed){armed=true;b.textContent='Confirmar?';clearTimeout(tm);tm=setTimeout(()=>{armed=false;b.textContent='Remover'},3000);return}
  clearTimeout(tm);act('remove',name);
 }};
}
const setF=(t,bad)=>{fmsg.textContent=t||'';fmsg.classList.toggle('bad',!!bad)};
async function act(action,username,done){
 if(busy||!auth)return;
 if(!username)return setF('Digite o nome de usuário.',1);
 busy=true;setF('');
 try{
  const r=await api('/api/friends/'+action,{method:'POST',body:{username}});
  apply(r);if(done)done();
  if(action==='request'){const f=social.friends.some(x=>x.username.toLowerCase()===username.toLowerCase());setF(f?'Vocês agora são amigos!':'Pedido enviado para '+username+'.')}
 }catch(e){setF(e.msg||'Algo deu errado.',1)}
 finally{busy=false}
}
function apply(r){
 const prev=seenIncoming;
 social={friends:r.friends,incoming:r.incoming,outgoing:r.outgoing};
 const names=new Set(r.incoming.map(x=>x.username));
 if(prev){const nw=[...names].filter(n=>!prev.has(n));if(nw.length)toast(nw.length===1?nw[0]+' quer ser seu amigo!':nw.length+' novos pedidos de amizade!')}
 seenIncoming=names;
 emit();if(!FS.classList.contains('hidden'))renderFriends();
}
async function refresh(manual){
 if(!auth)return;
 try{apply(await api('/api/friends'));if(manual)setF('')}
 catch(e){if(manual||!FS.classList.contains('hidden'))setF(e.msg,1)}
}
function openFriends(){setF('');renderFriends();go('friends');refresh()}
async function logout(){
 try{await api('/api/logout',{method:'POST'})}catch(e){}
 drop();toast('Você saiu da conta.');
}

/* ---------- ciclo de vida ---------- */
const prevOnScreen=OWM.onScreen;   // music.js já usa este gancho
OWM.onScreen=id=>{if(prevOnScreen)prevOnScreen(id);if(id==='friends')refresh()};
setInterval(()=>{if(auth&&!document.hidden)refresh()},15000);   // também serve de "estou online" para os amigos
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
if(auth)api('/api/me').then(()=>refresh()).catch(()=>{});     // valida a sessão guardada; sem internet, continua "logado"
refreshTitleBtn();

OWM.account={
 get loggedIn(){return !!auth},get username(){return auth?auth.username:null},
 get friends(){return social.friends},get incoming(){return social.incoming},get outgoing(){return social.outgoing},
 api,refresh,logout,open:()=>auth?openFriends():openAccount(),onChange:f=>listeners.push(f)
};
})();
