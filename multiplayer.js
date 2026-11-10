/* Open World Mayhem — mundos multiplayer P2P (host jogador + WebRTC/PeerJS). */
(() => {
  'use strict';
  const OWM = window.OWM;
  if (!OWM || !OWM.account || !OWM.gameBridge) { console.error('[OWM] Multiplayer: dependências ausentes.'); return; }
  const MAX_PLAYERS = 8, SNAPSHOT_MAX = 4 * 1024 * 1024, CHUNK = 6000, TICK_RATE = .10;
  let mode = 'idle', hostPeerId = '', roomId = '', statusText = 'Sessão não iniciada.', lastTick = 0, sendBusy = false;
  const peers = new Map(), states = new Map(), remotes = new Map(), listeners = new Set();
  let snapshotIn = null, playerSendBusy = false;
  const account = OWM.account, bridge = OWM.gameBridge;
  const cleanText = value => String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 24);
  const now = () => Date.now();
  const ownId = () => account.peerId;
  const setStatus = value => { if (statusText === value) return; statusText = value; listeners.forEach(fn => { try { fn(value); } catch (_) {} }); };
  const emit = () => listeners.forEach(fn => { try { fn(statusText); } catch (_) {} });
  const friendOk = id => !!(account.isFriend && account.isFriend(id));
  const send = (id, payload) => account.sendGameData(id, Object.assign({ roomId, version: 1 }, payload));
  function disposeAvatar(node) {
    OWM.scene.remove(node.group);
    node.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
  }
  function roomReset() {
    mode = 'idle'; hostPeerId = ''; roomId = ''; snapshotIn = null; states.clear(); peers.clear();
    for (const node of remotes.values()) disposeAvatar(node);
    remotes.clear(); setStatus('Sessão não iniciada.');
  }
  function createAvatar(id, name) {
    const THREE = window.THREE, group = new THREE.Group();
    const hash = Array.from(String(id)).reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,2166136261);
    const hue = (hash % 360) / 360, color = new THREE.Color().setHSL(hue,.62,.52);
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: .78 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x24242a, roughness: .9 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.3,.34,1.05,8), bodyMat);
    body.position.y = 1.05; body.castShadow = true; group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.25,8,6), bodyMat); head.position.y = 1.78; head.castShadow = true; group.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(.46,.52,.24), darkMat); legs.position.y=.33; group.add(legs);
    let label = null;
    try {
      const canvas = document.createElement('canvas'); canvas.width=256; canvas.height=64;
      const ctx=canvas.getContext('2d'); ctx.fillStyle='rgba(8,10,14,.78)'; ctx.fillRect(4,4,248,56);
      ctx.font='bold 26px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#fff'; ctx.fillText(cleanText(name)||'Jogador',128,32,232);
      const tex = new THREE.CanvasTexture(canvas); const mat = new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}); label = new THREE.Sprite(mat); label.position.y=2.25; label.scale.set(2.3,.58,1); group.add(label);
    } catch (_) {}
    group.traverse(o => { o.frustumCulled=false; }); OWM.scene.add(group);
    return { group, target: new THREE.Vector3(), yaw: 0, seen: now(), name };
  }
  function updateRemoteList(list) {
    if (!Array.isArray(list)) return;
    const alive = new Set();
    for (const item of list) {
      if (!item || typeof item.peerId !== 'string' || item.peerId === ownId()) continue;
      if (![item.x,item.y,item.z,item.yaw].every(Number.isFinite)) continue;
      if (Math.abs(item.x)>100000 || Math.abs(item.y)>10000 || Math.abs(item.z)>100000) continue;
      const id=item.peerId; alive.add(id);
      let node=remotes.get(id); if (!node) { node=createAvatar(id,cleanText(item.name)); remotes.set(id,node); }
      node.target.set(item.x,item.y,item.z); node.yaw=item.yaw; node.seen=now();
    }
    for (const [id,node] of remotes) if (!alive.has(id) && now()-node.seen>4500) { disposeAvatar(node); remotes.delete(id); }
  }
  function localState() { const p=bridge.getPlayerState(); return { peerId: ownId(), name: cleanText(p.name), x:p.x,y:p.y,z:p.z,yaw:p.yaw }; }
  async function sendSnapshot(peerId) {
    const snap=bridge.getWorldSnapshot(); if(!snap) throw new Error('O anfitrião não está em um mundo.');
    const raw=JSON.stringify(snap); if(raw.length>SNAPSHOT_MAX) throw new Error('O mundo tem alterações demais para transferir em uma única entrada.');
    const parts=[]; for(let i=0;i<raw.length;i+=CHUNK) parts.push(raw.slice(i,i+CHUNK));
    await send(peerId,{type:'welcome-start',roomId,parts:parts.length,hostName:cleanText(account.username),worldName:cleanText(snap.name)});
    for(let i=0;i<parts.length;i++) await send(peerId,{type:'welcome-part',roomId,index:i,data:parts[i]});
    await send(peerId,{type:'welcome-end',roomId});
  }
  async function handle(peerId, data) {
    if (!data || typeof data!=='object' || data.version!==1 || typeof data.type!=='string') return;
    if (data.type==='join-request') {
      if (mode!=='host' || !friendOk(peerId)) return;
      if (peers.size>=MAX_PLAYERS-1 && !peers.has(peerId)) { await send(peerId,{type:'room-full',roomId}); return; }
      peers.set(peerId,{name:cleanText(data.username)||'Jogador',lastSeen:now()});
      try { await sendSnapshot(peerId); setStatus('Hospedando · '+(peers.size+1)+'/'+MAX_PLAYERS+' jogadores'); }
      catch(error) { peers.delete(peerId); setStatus('Falha ao enviar mundo: '+error.message); }
      return;
    }
    if (mode==='host') {
      const member=peers.get(peerId); if (!member || data.roomId!==roomId) return;
      member.lastSeen=now();
      if (data.type==='player' && data.player && [data.player.x,data.player.y,data.player.z,data.player.yaw].every(Number.isFinite) && Math.abs(data.player.x)<100000 && Math.abs(data.player.y)<10000 && Math.abs(data.player.z)<100000) {
        states.set(peerId,{peerId,name:member.name,x:data.player.x,y:data.player.y,z:data.player.z,yaw:data.player.yaw});
      } else if (data.type==='edit') {
        if (bridge.applyEdit(data.edit)) for(const id of peers.keys()) if(id!==peerId) send(id,{type:'edit',edit:data.edit}).catch(()=>{});
      } else if (data.type==='leave') {
        peers.delete(peerId); states.delete(peerId); setStatus('Hospedando · '+(peers.size+1)+'/'+MAX_PLAYERS+' jogadores');
      }
      return;
    }
    if (mode!=='client' && mode!=='joining') return;
    if (peerId!==hostPeerId) return;
    if (data.type==='room-full') { roomReset(); setStatus('A sala do anfitrião está cheia.'); return; }
    if (data.type==='welcome-start') {
      if (!Number.isInteger(data.parts)||data.parts<1||data.parts>800||data.roomId==null) return;
      roomId=String(data.roomId); snapshotIn={parts:data.parts,chunks:new Array(data.parts),received:0,hostName:cleanText(data.hostName)}; return;
    }
    if (data.roomId!==roomId) return;
    if (data.type==='welcome-part' && snapshotIn && Number.isInteger(data.index) && data.index>=0 && data.index<snapshotIn.parts && typeof data.data==='string' && data.data.length<=CHUNK) {
      if(snapshotIn.chunks[data.index]===undefined){snapshotIn.chunks[data.index]=data.data;snapshotIn.received++;} return;
    }
    if (data.type==='welcome-end' && snapshotIn) {
      if(snapshotIn.received!==snapshotIn.parts){roomReset();setStatus('Transferência do mundo incompleta. Tente novamente.');return;}
      let world; try { world=JSON.parse(snapshotIn.chunks.join('')); } catch (_) { roomReset();setStatus('Não foi possível ler os dados do mundo.');return; }
      const hostName=snapshotIn.hostName||'anfitrião';snapshotIn=null; mode='client';
      try { bridge.startMultiplayerWorld(world); await send(hostPeerId,{type:'joined',username:account.username}); setStatus('Conectado ao mundo de '+hostName+'.'); }
      catch(error) { roomReset();setStatus('Falha ao abrir o mundo: '+error.message); }
      return;
    }
    if (data.type==='players') updateRemoteList(data.players);
    else if (data.type==='edit' && bridge.applyEdit(data.edit)) { /* edição autorizada pelo anfitrião */ }
    else if (data.type==='room-closed') { roomReset();setStatus('O anfitrião encerrou o mundo.'); }
  }
  async function hostWorld(world) {
    if (!account.loggedIn) throw new Error('Entre ou crie uma conta antes de hospedar.');
    if (!world || !world.id) throw new Error('Selecione um mundo salvo primeiro.');
    if (!bridge || !world.edits) throw new Error('O mundo selecionado está inválido.');
    setStatus('Conectando à rede P2P…');
    if (account.waitForNetwork) await account.waitForNetwork();
    if (mode!=='idle') leave();
    roomId=now().toString(36)+'-'+Math.random().toString(36).slice(2,8); hostPeerId=ownId(); mode='host';
    try { bridgeStartHost(world); } catch (error) { roomReset(); throw error; }
    states.clear(); setStatus('Hospedando · aguardando amigos · código '+hostPeerId);
    return true;
  }
  function bridgeStartHost(world) { if (!bridge.startHostWorld) throw new Error('O jogo não disponibilizou a abertura de mundo.'); bridge.startHostWorld(world); }
  async function join(code) {
    const id=String(code||'').trim().toUpperCase();
    if (!account.loggedIn) throw new Error('Entre ou crie uma conta antes de entrar.');
    if (!/^[A-Z0-9][A-Z0-9_]{2,16}-[A-Z0-9]{4}$/.test(id)) throw new Error('Código de anfitrião inválido.');
    if (id===ownId()) throw new Error('Esse é o seu próprio código.');
    if (!friendOk(id)) throw new Error('Adicione e aceite o anfitrião como amigo antes de entrar.');
    if (mode!=='idle') leave();
    mode='joining';hostPeerId=id;roomId='';setStatus('Conectando ao anfitrião…');
    try { await account.connectPeer(id); await account.sendGameData(id,{version:1,type:'join-request',username:cleanText(account.username)}); }
    catch(error) { roomReset(); throw error; }
    return new Promise((resolve,reject)=>{
      const started=now();const poll=()=>{if(mode==='client'){resolve(true);return}if(mode==='idle'){reject(new Error(statusText));return}if(now()-started>30000){roomReset();reject(new Error('O anfitrião não respondeu. Confira se ele está no mundo e tente de novo.'));return}setTimeout(poll,250)};poll();
    });
  }
  function localEdit(edit) {
    if (mode==='host') { for (const id of peers.keys()) send(id,{type:'edit',edit}).catch(()=>{}); }
    else if (mode==='client' && hostPeerId) send(hostPeerId,{type:'edit',edit}).catch(()=>{});
  }
  function leave() {
    const wasMode=mode;
    if (wasMode==='host') for(const id of peers.keys()) send(id,{type:'room-closed'}).catch(()=>{});
    else if ((wasMode==='client'||wasMode==='joining')&&hostPeerId) send(hostPeerId,{type:'leave'}).catch(()=>{});
    roomReset();
  }
  function tick(dt) {
    const t=now();
    if (mode==='client' && t-lastTick>=TICK_RATE*1000 && !playerSendBusy && hostPeerId && roomId) {
      lastTick=t;playerSendBusy=true;send(hostPeerId,{type:'player',player:localState()}).catch(()=>{}).finally(()=>{playerSendBusy=false});
    }
    if (mode==='host' && t-lastTick>=TICK_RATE*1000 && !sendBusy) {
      lastTick=t;
      for(const [id,p] of peers) if(t-p.lastSeen>12000){peers.delete(id);states.delete(id);}
      const list=[localState(),...Array.from(states.values())];
      updateRemoteList(list); sendBusy=true;
      Promise.all([...peers.keys()].map(id=>send(id,{type:'players',players:list}).catch(()=>{}))).finally(()=>{sendBusy=false});
      setStatus('Hospedando · '+(peers.size+1)+'/'+MAX_PLAYERS+' jogadores · código '+hostPeerId);
    }
    for(const [id,node] of remotes){node.group.position.lerp(node.target,1-Math.exp(-dt*10));node.group.rotation.y += (node.yaw-node.group.rotation.y)*Math.min(1,dt*10);if(t-node.seen>6000)node.group.visible=false;else node.group.visible=true;}
  }
  account.onGameData((peerId,data)=>{handle(peerId,data).catch(error=>console.error('[OWM] Multiplayer:',error));});
  OWM.multiplayer={
    get mode(){return mode;}, get statusText(){return statusText;}, get hostCode(){return hostPeerId;},
    onChange(fn){if(typeof fn==='function'){listeners.add(fn);return()=>listeners.delete(fn)}return()=>{}},
    hostWorld,join,leave,localEdit,tick
  };
})();
