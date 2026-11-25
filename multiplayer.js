/* Open World Mayhem — multiplayer P2P SEM CONTA (WebRTC via PeerJS).
   - Quem hospeda recebe um código de 6 caracteres e um link de convite (…#owm=CODIGO). Quem abre o link entra direto, como visitante.
   - Não há servidor de jogo: cada celular manda seus dados (posição, pose do esqueleto, perfil do personagem, edições de blocos) e o outro renderiza.
     O único servidor é o de sinalização do PeerJS (só apresenta um celular ao outro; depois os dados vão direto, de aparelho pra aparelho).
   - Funciona no mundo principal e no Baseplate (testplate).
   - Cada jogador vê o personagem que o outro criou (OWM.skin.colors) animado com a pose real do esqueleto (OWM.anim.getPose / makeRemote). */
(() => {
  'use strict';
  const OWM = window.OWM;
  if (!OWM || !OWM.gameBridge) { console.error('[OWM] Multiplayer: dependências ausentes.'); return; }
  const bridge = OWM.gameBridge;
  const MAX_PLAYERS = 8, SNAPSHOT_MAX = 4 * 1024 * 1024, CHUNK = 12000, TICK_MS = 100, VERSION = 2;
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', PREFIX = 'owm-', POSE_LEN = 33;
  const PEER_SRC = ['https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js', 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'];

  let mode = 'idle';            // idle | host | joining | client
  let peer = null, hostConn = null, hostPeerId = '', hostCode = '', roomId = '';
  let statusText = 'Sessão não iniciada.', lastTick = 0, lastProfileCheck = 0, lastProfileKey = '', lastHostMsg = 0, buddyEnabled = false;
  let snapshotIn = null, customName = '', generatedName = '';
  const conns = new Map(), peers = new Map(), states = new Map(), remotes = new Map(), profiles = new Map(), listeners = new Set();

  const now = () => Date.now();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const cleanText = v => String(v || '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 24);
  const toast = m => { try { if (OWM.toast) OWM.toast(m); } catch (_) {} };
  const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
  const wrapAngle = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
  const okPos = (x, y, z) => [x, y, z].every(Number.isFinite) && Math.abs(x) < 100000 && Math.abs(y) < 10000 && Math.abs(z) < 100000;
  const ownId = () => (peer && peer.id) || '';
  const setStatus = v => { if (statusText === v) return; statusText = v; emit(); };
  const emit = () => listeners.forEach(fn => { try { fn(statusText); } catch (_) {} });

  /* ---------- Nome (visitante, sem conta) ---------- */
  customName = cleanText(lsGet('owm.guestName')).trim();
  function displayName() {
    if (customName) return customName;
    const a = OWM.account;
    if (a && a.loggedIn && a.username) return cleanText(a.username);
    if (!generatedName) { generatedName = 'Visitante' + (1000 + Math.floor(Math.random() * 9000)); }
    return generatedName;
  }
  function setName(v) { customName = cleanText(v).trim(); lsSet('owm.guestName', customName); }

  /* ---------- Perfil do personagem (só dados do criador, validados) ---------- */
  const HEX = /^#[0-9a-fA-F]{6}$/, IDRE = /^[\w-]{0,24}$/;
  const P_COLORS = ['skin', 'hair', 'shirt', 'pants', 'shoes', 'sash', 'hatColor'];
  const P_IDS = ['hairStyle', 'bodyId', 'headId', 'hatId'];
  const P_NUMS = ['hx', 'hy', 'hz', 'hsx', 'hsy', 'hsz', 'ax', 'ay', 'az', 'asx', 'asy', 'asz', 'hairScale', 'hairX', 'hairY', 'hairZ', 'hairLift'];
  function cleanProfile(p) {
    const o = {};
    if (!p || typeof p !== 'object') return o;
    for (const k of P_COLORS) if (typeof p[k] === 'string' && HEX.test(p[k])) o[k] = p[k];
    for (const k of P_IDS) if (typeof p[k] === 'string' && IDRE.test(p[k])) o[k] = p[k];
    for (const k of P_NUMS) { const n = +p[k]; if (p[k] !== '' && p[k] != null && Number.isFinite(n) && Math.abs(n) <= 10) o[k] = n; }
    return o;
  }
  const localProfile = () => cleanProfile(OWM.skin && OWM.skin.colors);
  function cleanPose(p) {
    if (!p || !Array.isArray(p.q) || p.q.length !== POSE_LEN) return null;
    for (const v of p.q) if (!Number.isFinite(v) || Math.abs(v) > 1100) return null;
    const h = Array.isArray(p.h) && p.h.length === 3 && p.h.every(v => Number.isFinite(v) && Math.abs(v) < 4000) ? p.h : null;
    return { q: p.q.slice(0, POSE_LEN), h, ay: Number.isFinite(p.ay) ? p.ay : null };
  }

  /* ---------- Rede (PeerJS) ---------- */
  let peerLoad = null;
  function loadPeer() {
    if (window.Peer) return Promise.resolve(window.Peer);
    if (peerLoad) return peerLoad;
    peerLoad = new Promise((resolve, reject) => {
      let i = 0;
      const next = () => {
        if (window.Peer) { resolve(window.Peer); return; }
        if (i >= PEER_SRC.length) { peerLoad = null; reject(new Error('Não foi possível carregar a rede P2P (PeerJS). Verifique a internet.')); return; }
        const sc = document.createElement('script'); sc.src = PEER_SRC[i++]; sc.async = true;
        sc.onload = () => { if (window.Peer) resolve(window.Peer); else next(); };
        sc.onerror = next; document.head.appendChild(sc);
      };
      next();
    });
    return peerLoad;
  }
  async function newPeer(id) {
    const Peer = await loadPeer();
    return new Promise((resolve, reject) => {
      const opts = Object.assign({ debug: 0 }, OWM.mpPeerOptions || {});   // OWM.mpPeerOptions: servidor de sinalização/TURN próprio, se quiser
      const p = id ? new Peer(id, opts) : new Peer(opts);
      let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; try { p.destroy(); } catch (_) {} reject(new Error('Não foi possível conectar à rede P2P. Verifique a internet.')); } }, 15000);
      p.on('open', () => { if (done) return; done = true; clearTimeout(timer); resolve(p); });
      p.on('error', e => {
        if (!done) { done = true; clearTimeout(timer); try { p.destroy(); } catch (_) {} const err = new Error('Erro de rede P2P: ' + ((e && e.type) || e)); err.type = e && e.type; reject(err); }
        else onPeerError(e);
      });
    });
  }
  function onPeerError(e) {
    const t = e && e.type;
    if (mode === 'joining' && t === 'peer-unavailable') return;   // tratado no join()
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return;   // sinalização caiu: conexões existentes continuam
    console.warn('[OWM] PeerJS:', e);
  }
  const genCode = () => { let s = ''; const a = new Uint32Array(6); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = Math.random() * 4294967296); for (let i = 0; i < 6; i++) s += ALPHA[a[i] % ALPHA.length]; return s; };
  function parseCode(input) {
    const raw = String(input || '').trim();
    let m = raw.match(/(?:owm|join)=([A-Za-z0-9]{6})(?![A-Za-z0-9])/);
    const code = (m ? m[1] : raw.replace(/[^A-Za-z0-9]/g, '')).toUpperCase();
    return code.length === 6 && [...code].every(ch => ALPHA.includes(ch)) ? code : '';
  }
  const inviteLink = () => hostCode ? location.href.split('#')[0] + '#owm=' + hostCode : '';
  async function copyText(text) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; } } catch (_) {}
    try { const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return !!ok; } catch (_) { return false; }
  }
  async function copyInvite() { if (!hostCode) throw new Error('Nenhuma sessão ativa para convidar.'); const link = inviteLink(); return { code: hostCode, link, copied: await copyText(link) }; }

  async function send(id, payload) {
    const c = conns.get(id);
    if (!c || !c.open) throw new Error('sem conexão');
    while (c.dataChannel && c.dataChannel.bufferedAmount > 768 * 1024) { await sleep(25); if (!c.open) throw new Error('sem conexão'); }
    c.send(Object.assign({ roomId, version: VERSION }, payload));
  }
  const sendAll = (payload, except) => Promise.all([...peers.keys()].filter(id => id !== except).map(id => send(id, payload).catch(() => {})));

  /* ---------- Avatares remotos ---------- */
  function makeLabel(name) {
    const THREE = window.THREE;
    try {
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = 'rgba(8,10,14,.78)'; ctx.fillRect(4, 4, 248, 56);
      ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(cleanText(name) || 'Jogador', 128, 32, 232);
      const tex = new THREE.CanvasTexture(canvas), mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
      const label = new THREE.Sprite(mat); label.position.y = 2.25; label.scale.set(2.3, .58, 1); label.name = 'mp_label'; return label;
    } catch (_) { return null; }
  }
  function fallbackBody(id) {   // boneco genérico (se o perfil não chegar ou o criador não estiver disponível)
    const THREE = window.THREE, group = new THREE.Group();
    const hash = Array.from(String(id)).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 2166136261);
    const color = new THREE.Color().setHSL((hash % 360) / 360, .62, .52);
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: .78 }), darkMat = new THREE.MeshStandardMaterial({ color: 0x24242a, roughness: .9 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.3, .34, 1.05, 8), bodyMat); body.position.y = 1.05; body.castShadow = true; group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.25, 8, 6), bodyMat); head.position.y = 1.78; head.castShadow = true; group.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(.46, .52, .24), darkMat); legs.position.y = .33; group.add(legs);
    return group;
  }
  function createNode(id, name, profile) {
    const THREE = window.THREE; let group = null, av = null;
    if (profile && OWM.anim && OWM.anim.makeRemote) { try { av = OWM.anim.makeRemote(profile); group = av.group; } catch (e) { console.warn('[OWM] avatar remoto:', e); av = null; } }
    if (!av) group = fallbackBody(id);
    const label = makeLabel(name); if (label) group.add(label);
    group.traverse(o => { o.frustumCulled = false; }); OWM.scene.add(group);
    return { group, av, label, target: new THREE.Vector3(), yaw: 0, ay: 0, seen: now(), name, pkey: profile ? JSON.stringify(profile) : '', fresh: true };
  }
  function disposeNode(node) {
    OWM.scene.remove(node.group);
    if (node.label) { node.group.remove(node.label); const lm = node.label.material; if (lm) { if (lm.map) lm.map.dispose(); lm.dispose(); } }
    if (node.av) { node.av.dispose(); return; }
    node.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
  }
  function updateRemoteList(list) {
    if (!Array.isArray(list)) return;
    const alive = new Set();
    for (const item of list) {
      if (!item || typeof item.peerId !== 'string' || item.peerId === ownId()) continue;
      if (!okPos(item.x, item.y, item.z) || !Number.isFinite(item.yaw)) continue;
      const id = item.peerId, name = cleanText(item.name), prof = profiles.get(id); alive.add(id);
      let node = remotes.get(id);
      if (!node) { node = createNode(id, name, prof && prof.profile); remotes.set(id, node); }
      else if (prof && prof.key !== node.pkey) {   // perfil mudou (ou chegou depois): reconstrói o avatar mantendo a posição
        const nn = createNode(id, name, prof.profile); nn.group.position.copy(node.group.position); nn.group.rotation.y = node.group.rotation.y; nn.fresh = false;
        disposeNode(node); remotes.set(id, nn); node = nn;
      }
      node.target.set(item.x, item.y, item.z); node.yaw = item.yaw; node.seen = now();
      if (node.fresh) { node.group.position.copy(node.target); node.group.rotation.y = node.av && Number.isFinite(item.ay) ? item.ay : item.yaw; node.fresh = false; }
      const pose = cleanPose(item);
      if (pose) { if (pose.ay != null) node.ay = pose.ay; if (node.av) node.av.setPose(pose); }
    }
    for (const [id, node] of remotes) if (!alive.has(id) && (id === 'OWM-CHATGPT-BOT' || now() - node.seen > 4500)) { disposeNode(node); remotes.delete(id); }
  }

  /* ---------- Estado local ---------- */
  function localState() {
    const p = bridge.getPlayerState(), o = { peerId: ownId(), name: cleanText(p.name) || displayName(), x: p.x, y: p.y, z: p.z, yaw: p.yaw };
    try { const po = OWM.anim && OWM.anim.getPose && OWM.anim.getPose(); if (po) { o.q = po.q; o.h = po.h; o.ay = po.ay; } } catch (_) {}
    return o;
  }
  const profilesPayload = () => {
    const list = [{ peerId: ownId(), name: displayName(), profile: localProfile() }];
    for (const [id, p] of peers) list.push({ peerId: id, name: p.name, profile: p.profile || {} });
    return list;
  };
  function storeProfile(id, name, profile) { const pr = cleanProfile(profile); profiles.set(id, { name: cleanText(name), profile: pr, key: JSON.stringify(pr) }); }

  /* ---------- Mundo (snapshot) ---------- */
  async function sendSnapshot(peerId) {
    const snap = bridge.getWorldSnapshot(); if (!snap) throw new Error('O anfitrião não está em um mundo.');
    const raw = JSON.stringify(snap); if (raw.length > SNAPSHOT_MAX) throw new Error('O mundo tem alterações demais para transferir em uma única entrada.');
    const parts = []; for (let i = 0; i < raw.length; i += CHUNK) parts.push(raw.slice(i, i + CHUNK));
    await send(peerId, { type: 'welcome-start', parts: parts.length, hostName: displayName(), worldName: cleanText(snap.name) });
    for (let i = 0; i < parts.length; i++) await send(peerId, { type: 'welcome-part', index: i, data: parts[i] });
    await send(peerId, { type: 'welcome-end' });
  }
  const hostStatus = () => 'Hospedando · ' + (peers.size + 1) + '/' + MAX_PLAYERS + ' jogadores' + (buddyEnabled ? ' · ChatGPT ativo' : '') + ' · código ' + hostCode;

  async function handle(peerId, data) {
    if (!data || typeof data !== 'object' || data.version !== VERSION || typeof data.type !== 'string') return;
    if (data.type === 'join-request') {
      if (mode !== 'host') return;
      if (peers.size >= MAX_PLAYERS - 1 && !peers.has(peerId)) { await send(peerId, { type: 'room-full' }).catch(() => {}); return; }
      peers.set(peerId, { name: cleanText(data.username) || 'Visitante', lastSeen: now(), profile: cleanProfile(data.profile), tokens: 60, tt: now() });
      storeProfile(peerId, peers.get(peerId).name, data.profile);
      try { await sendSnapshot(peerId); setStatus(hostStatus()); }
      catch (error) { peers.delete(peerId); profiles.delete(peerId); setStatus('Falha ao enviar mundo: ' + error.message); }
      return;
    }
    if (mode === 'host') {
      const member = peers.get(peerId); if (!member || data.roomId !== roomId) return;
      member.lastSeen = now();
      if (data.type === 'player' && data.player && okPos(data.player.x, data.player.y, data.player.z) && Number.isFinite(data.player.yaw)) {
        const pose = cleanPose(data.player);
        states.set(peerId, { peerId, name: member.name, x: data.player.x, y: data.player.y, z: data.player.z, yaw: data.player.yaw, q: pose && pose.q, h: pose && pose.h, ay: pose && pose.ay });
      } else if (data.type === 'joined') {
        sendAll({ type: 'profiles', list: profilesPayload() });
      } else if (data.type === 'profile') {
        member.profile = cleanProfile(data.profile); storeProfile(peerId, member.name, data.profile);
        sendAll({ type: 'profiles', list: profilesPayload() });
      } else if (data.type === 'edit') {
        const t = now(); member.tokens = Math.min(60, member.tokens + (t - member.tt) * .03); member.tt = t;   // ~30 edições/s, rajada 60
        if (member.tokens < 1) return; member.tokens--;
        if (bridge.applyEdit(data.edit)) sendAll({ type: 'edit', edit: data.edit }, peerId);
      } else if (data.type === 'leave') { dropPeer(peerId); }
      return;
    }
    if (mode !== 'client' && mode !== 'joining') return;
    if (peerId !== hostPeerId) return;
    lastHostMsg = now();
    if (data.type === 'room-full') { roomReset(); setStatus('A sala do anfitrião está cheia.'); return; }
    if (data.type === 'welcome-start') {
      if (!Number.isInteger(data.parts) || data.parts < 1 || data.parts > 1000 || data.roomId == null) return;
      roomId = String(data.roomId); snapshotIn = { parts: data.parts, chunks: new Array(data.parts), received: 0, hostName: cleanText(data.hostName) }; return;
    }
    if (data.roomId !== roomId) return;
    if (data.type === 'welcome-part' && snapshotIn && Number.isInteger(data.index) && data.index >= 0 && data.index < snapshotIn.parts && typeof data.data === 'string' && data.data.length <= CHUNK) {
      if (snapshotIn.chunks[data.index] === undefined) { snapshotIn.chunks[data.index] = data.data; snapshotIn.received++; } return;
    }
    if (data.type === 'welcome-end' && snapshotIn) {
      if (snapshotIn.received !== snapshotIn.parts) { roomReset(); setStatus('Transferência do mundo incompleta. Tente novamente.'); return; }
      let world; try { world = JSON.parse(snapshotIn.chunks.join('')); } catch (_) { roomReset(); setStatus('Não foi possível ler os dados do mundo.'); return; }
      const hostName = snapshotIn.hostName || 'anfitrião'; snapshotIn = null;
      try {
        mode = 'client'; lastProfileKey = JSON.stringify(localProfile()); bridge.startMultiplayerWorld(world);
        await send(hostPeerId, { type: 'joined', username: displayName() });
        setStatus('Conectado ao mundo de ' + hostName + ' · código ' + hostCode);
      } catch (error) { roomReset(); setStatus('Falha ao abrir o mundo: ' + error.message); }
      return;
    }
    if (data.type === 'players') updateRemoteList(data.players);
    else if (data.type === 'profiles' && Array.isArray(data.list)) {
      for (const e of data.list) if (e && typeof e.peerId === 'string' && e.peerId !== ownId()) storeProfile(e.peerId, e.name, e.profile);
    }
    else if (data.type === 'edit' && bridge.applyEdit(data.edit)) { /* edição autorizada pelo anfitrião */ }
    else if (data.type === 'room-closed') { roomReset(); setStatus('O anfitrião encerrou o mundo.'); toast('O anfitrião encerrou o mundo.'); }
  }

  function dropPeer(id) {
    const c = conns.get(id); conns.delete(id); try { c && c.close(); } catch (_) {}
    peers.delete(id); states.delete(id); profiles.delete(id);
    const n = remotes.get(id); if (n) { disposeNode(n); remotes.delete(id); }
    if (mode === 'host') { setStatus(hostStatus()); sendAll({ type: 'profiles', list: profilesPayload() }); }
  }
  function wireConn(conn) {
    conn.on('data', d => { handle(conn.peer, d).catch(e => console.error('[OWM] Multiplayer:', e)); });
    conn.on('close', () => { if (conns.get(conn.peer) !== conn) return; if (mode === 'host') dropPeer(conn.peer); else if (conn.peer === hostPeerId && (mode === 'client' || mode === 'joining')) onHostLost(); });
    conn.on('error', () => {});
  }
  function onHostLost() { const was = mode; roomReset(); setStatus('Conexão com o anfitrião perdida.'); if (was === 'client') toast('Conexão com o anfitrião perdida.'); }

  function roomReset(delayDestroyMs) {
    if (buddyEnabled && bridge.stopBuddy) { try { bridge.stopBuddy(); } catch (_) {} }
    buddyEnabled = false; mode = 'idle'; hostPeerId = ''; hostCode = ''; roomId = ''; snapshotIn = null; hostConn = null;
    states.clear(); peers.clear(); profiles.clear();
    for (const node of remotes.values()) disposeNode(node);
    remotes.clear();
    const p = peer; peer = null; conns.clear();
    if (p) { if (delayDestroyMs) setTimeout(() => { try { p.destroy(); } catch (_) {} }, delayDestroyMs); else { try { p.destroy(); } catch (_) {} } }
    setStatus('Sessão não iniciada.');
  }

  /* ---------- Hospedar / compartilhar ---------- */
  async function beginHosting(startFn) {
    if (mode !== 'idle') leave();
    setStatus('Conectando à rede P2P…');
    let p = null, code = '';
    for (let i = 0; i < 5 && !p; i++) {
      code = genCode();
      try { p = await newPeer(PREFIX + code.toLowerCase()); } catch (e) { if (e.type !== 'unavailable-id') { setStatus('Sessão não iniciada.'); throw e; } }
    }
    if (!p) { setStatus('Sessão não iniciada.'); throw new Error('Não foi possível reservar um código. Tente de novo.'); }
    peer = p; hostCode = code; hostPeerId = p.id; roomId = now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); mode = 'host';
    p.on('connection', conn => { conn.on('open', () => { conns.set(conn.peer, conn); }); wireConn(conn); });
    p.on('disconnected', () => { try { p.reconnect(); } catch (_) {} });
    try { startFn(); if (bridge.startBuddy) { bridge.startBuddy(); buddyEnabled = true; } }
    catch (error) { roomReset(); throw error; }
    states.clear(); lastProfileKey = JSON.stringify(localProfile()); setStatus(hostStatus());
    return true;
  }
  async function hostWorld(world) {
    if (!world || !world.id) throw new Error('Selecione um mundo salvo primeiro.');
    if (!bridge.startHostWorld || !world.edits) throw new Error('O mundo selecionado está inválido.');
    return beginHosting(() => bridge.startHostWorld(world));
  }
  /* compartilha o mundo EM QUE VOCÊ JÁ ESTÁ (principal ou Baseplate) sem reiniciá-lo; devolve o link copiado */
  async function share() {
    if (mode === 'idle') {
      if (!bridge.getWorldSnapshot || !bridge.getWorldSnapshot()) throw new Error('Entre em um mundo para compartilhar.');
      await beginHosting(() => {});
    }
    if (!hostCode) throw new Error('Sessão ainda conectando. Tente de novo.');
    return copyInvite();
  }

  /* ---------- Entrar ---------- */
  async function join(input) {
    const code = parseCode(input);
    if (!code) throw new Error('Código inválido. Use o código de 6 caracteres ou o link de convite.');
    if (mode === 'host' && code === hostCode) throw new Error('Esse é o seu próprio código.');
    if (mode !== 'idle') leave();
    mode = 'joining'; hostCode = code; hostPeerId = PREFIX + code.toLowerCase(); roomId = ''; lastHostMsg = now(); setStatus('Conectando ao anfitrião…');
    try {
      const p = await newPeer(); peer = p;
      p.on('disconnected', () => { try { p.reconnect(); } catch (_) {} });
      const conn = await new Promise((resolve, reject) => {
        const c = p.connect(hostPeerId, { reliable: true, serialization: 'json' });
        const timer = setTimeout(() => reject(new Error('O anfitrião não respondeu. Confira o código e se ele está no mundo.')), 15000);
        const fail = m => { clearTimeout(timer); reject(new Error(m)); };
        p.on('error', e => { if (e && e.type === 'peer-unavailable') fail('Código não encontrado. O anfitrião precisa estar com o mundo aberto.'); });
        c.on('open', () => { clearTimeout(timer); resolve(c); });
        c.on('error', e => fail('Falha ao conectar: ' + ((e && e.type) || e)));
      });
      hostConn = conn; conns.set(conn.peer, conn); wireConn(conn);
      await send(hostPeerId, { type: 'join-request', username: displayName(), profile: localProfile() });
    } catch (error) { roomReset(); throw error; }
    return new Promise((resolve, reject) => {
      const started = now();
      const poll = () => {
        if (mode === 'client') { resolve(true); return; }
        if (mode === 'idle') { reject(new Error(statusText)); return; }
        if (now() - started > 40000) { roomReset(); reject(new Error('O anfitrião não respondeu. Confira se ele está no mundo e tente de novo.')); return; }
        setTimeout(poll, 250);
      };
      poll();
    });
  }

  function toggleBuddy() {
    if (mode !== 'host') throw new Error('Só o anfitrião pode adicionar ou remover o ChatGPT.');
    if (buddyEnabled) { if (bridge.stopBuddy) bridge.stopBuddy(); buddyEnabled = false; }
    else { if (!bridge.startBuddy) throw new Error('Esta versão do jogo não oferece suporte ao companheiro.'); bridge.startBuddy(); buddyEnabled = true; }
    setStatus(hostStatus()); return buddyEnabled;
  }
  function localEdit(edit) {
    if (mode === 'host') sendAll({ type: 'edit', edit });
    else if (mode === 'client' && hostPeerId) send(hostPeerId, { type: 'edit', edit }).catch(() => {});
  }
  function leave() {
    const wasMode = mode;
    if (wasMode === 'host') sendAll({ type: 'room-closed' });
    else if ((wasMode === 'client' || wasMode === 'joining') && hostPeerId) send(hostPeerId, { type: 'leave' }).catch(() => {});
    roomReset(wasMode === 'idle' ? 0 : 400);   // dá tempo das últimas mensagens saírem antes de fechar
  }

  /* ---------- Loop (chamado todo frame pelo jogo) ---------- */
  function tick(dt) {
    const t = now();
    if (mode === 'client' || mode === 'host') {
      if (t - lastProfileCheck > 1500) {   // criador de personagem foi usado no meio da partida? reenvia o perfil
        lastProfileCheck = t; const key = JSON.stringify(localProfile());
        if (key !== lastProfileKey) {
          lastProfileKey = key;
          if (mode === 'client' && hostPeerId) send(hostPeerId, { type: 'profile', profile: localProfile() }).catch(() => {});
          else if (mode === 'host') sendAll({ type: 'profiles', list: profilesPayload() });
        }
      }
    }
    if (mode === 'client') {
      if (t - lastHostMsg > 15000) { onHostLost(); return; }
      if (t - lastTick >= TICK_MS && hostPeerId && roomId) { lastTick = t; send(hostPeerId, { type: 'player', player: localState() }).catch(() => {}); }
    }
    if (mode === 'host' && buddyEnabled && bridge.updateBuddy) bridge.updateBuddy(dt);
    if (mode === 'host' && t - lastTick >= TICK_MS) {
      lastTick = t;
      for (const [id, p] of peers) if (t - p.lastSeen > 12000) dropPeer(id);
      const list = [localState(), ...Array.from(states.values())];
      if (buddyEnabled && bridge.getBuddyState) { const bot = bridge.getBuddyState(); if (bot) list.push(bot); }
      updateRemoteList(list);
      for (const id of peers.keys()) send(id, { type: 'players', players: list.filter(x => x.peerId !== id) }).catch(() => {});
      setStatus(hostStatus());
    }
    for (const [, node] of remotes) {
      const k = 1 - Math.exp(-dt * 12);
      node.group.position.lerp(node.target, k);
      const ty = node.av && Number.isFinite(node.ay) ? node.ay : node.yaw;
      node.group.rotation.y += wrapAngle(ty - node.group.rotation.y) * Math.min(1, dt * 12);
      if (node.av) node.av.update(dt);
      node.group.visible = t - node.seen <= 6000;
    }
  }

  /* ---------- Entrada automática pelo link (#owm=CODIGO) ---------- */
  const pending = parseCode(location.hash || '') || parseCode((location.search || '').replace(/^\?/, '').split('&').filter(s => /^(owm|join)=/.test(s)).join('&'));
  if (pending) {
    const run = () => {
      try { history.replaceState(null, '', location.pathname + location.search.replace(/[?&](owm|join)=[^&]*/g, '').replace(/^&/, '?')); } catch (_) {}
      toast('Entrando no mundo compartilhado…');
      join(pending).then(() => toast('Conectado! Bom jogo.')).catch(e => toast(e.message || 'Não foi possível entrar.'));
    };
    if (document.readyState === 'complete') setTimeout(run, 1200); else window.addEventListener('load', () => setTimeout(run, 1200), { once: true });
  }

  OWM.multiplayer = {
    get mode() { return mode; }, get statusText() { return statusText; }, get hostCode() { return hostCode; }, get buddyEnabled() { return buddyEnabled; },
    get inviteLink() { return inviteLink(); },
    onChange(fn) { if (typeof fn === 'function') { listeners.add(fn); return () => listeners.delete(fn); } return () => {}; },
    displayName, setName, hostWorld, share, copyInvite, join, leave, localEdit, toggleBuddy, tick
  };
})();
