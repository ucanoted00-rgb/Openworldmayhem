/* Open World Mayhem — conta local + amigos P2P via PeerJS. Carregar após game.js. */
(() => {
  'use strict';
  const OWM = window.OWM, Core = window.OWMAccountCore;
  if (!OWM || !Core) { console.error('OWM: núcleo de contas indisponível.'); return; }
  const { E, B, fld, go, toast, mkScreen, screens } = OWM;
  const STORAGE_KEY = 'owm.p2p.account.v1';
  const listeners = [];
  let engine = null, peer = null, storageOK = true, peerReady = false;
  let peerStatus = 'Sem conexão', peerRetryTimer = 0;
  const connections = new Map(), opening = new Map(), bound = new WeakSet(), connectionDirection = new WeakMap(), gameDataListeners = new Set();
  const now = () => Date.now();

  function readSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const state = Core.normalizeState(parsed);
      return state;
    } catch (_) { storageOK = false; return null; }
  }
  function stateNow() { return engine ? engine.state : null; }
  function save() {
    const state = stateNow();
    if (!state) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); storageOK = true; }
    catch (_) { storageOK = false; }
  }
  function emit() {
    refreshTitleButton();
    if (engine) save();
    listeners.forEach(fn => { try { fn(OWM.account); } catch (_) {} });
    if (!FS.classList.contains('hidden')) renderFriends();
  }
  function setPeerStatus(text, bad) {
    peerStatus = text;
    statusLine.textContent = text;
    statusLine.classList.toggle('bad', !!bad);
    statusLine.classList.toggle('good', !bad && text !== 'Sem conexão');
  }
  function setAccountMessage(text, bad) {
    accountMessage.textContent = text || '';
    accountMessage.classList.toggle('bad', !!bad);
  }
  function setFriendsMessage(text, bad) {
    friendsMessage.textContent = text || '';
    friendsMessage.classList.toggle('bad', !!bad);
  }
  function refreshTitleButton() {
    if (!titleButton) return;
    const state = stateNow();
    titleButton.textContent = state ? 'Amigos' + (state.incoming.length ? ' (' + state.incoming.length + ')' : '') : 'Conta';
  }

  /* ---------- Tela inicial: criar identidade ---------- */
  const TS = screens.title;
  const configButton = [...TS.children].find(el => el.tagName === 'BUTTON' && el.textContent === 'Configurações');
  const titleButton = B('Conta', () => stateNow() ? openFriends() : openAccount(), TS);
  if (configButton) TS.insertBefore(titleButton, configButton);
  const AS = mkScreen('acct', 'Conta', 'solid');
  E('div', 'dsc acc-intro', 'Crie uma identidade local para jogar com amigos. Não existe senha nem cadastro em servidor.', AS);
  const nameField = fld('Nome de jogador', AS);
  nameField.maxLength = 16;
  nameField.autocomplete = 'nickname';
  nameField.autocapitalize = 'none';
  nameField.spellcheck = false;
  nameField.placeholder = 'Ex.: ENZO_01';
  const accountMessage = E('div', 'dsc acc-msg', '', AS);
  const createButton = B('Criar identidade', createIdentity, AS);
  const accountBackRow = E('div', 'row', null, AS);
  B('Voltar', () => go('title'), accountBackRow);
  nameField.addEventListener('keydown', event => { if (event.key === 'Enter') createIdentity(); });

  /* ---------- Tela de conta e amigos ---------- */
  const FS = mkScreen('friends', 'Conta e amigos', 'solid');
  const who = E('div', 'dsc acc-who', '', FS);
  const codeRow = E('div', 'acc-code-row', null, FS);
  const codeBox = E('div', 'acc-code', '', codeRow);
  const copyCodeButton = B('Copiar código', copyFriendCode, codeRow, 'mini');
  const statusLine = E('div', 'dsc acc-status', 'Sem conexão', FS);
  const fAdd = fld('Código de amigo', FS);
  fAdd.parentElement.classList.add('acc-add-field');
  fAdd.maxLength = 24;
  fAdd.autocapitalize = 'characters';
  fAdd.spellcheck = false;
  fAdd.placeholder = 'EXEMPLO-4F7K';
  const addButton = B('Enviar pedido', sendRequest, FS);
  addButton.classList.add('acc-send');
  fAdd.addEventListener('keydown', event => { if (event.key === 'Enter') sendRequest(); });
  const friendsList = E('div', 'list acc-list', null, FS);
  const friendsMessage = E('div', 'dsc acc-msg', '', FS);
  const backupWarning = E('div', 'dsc acc-warning', 'Atenção: o backup contém os segredos das suas amizades. Não compartilhe esse arquivo.', FS);
  const backupRow = E('div', 'row acc-backup-row', null, FS);
  B('Exportar', exportBackup, backupRow);
  B('Copiar backup', copyBackup, backupRow);
  B('Importar', () => importInput.click(), backupRow);
  const importInput = E('input', 'acc-file', null, FS);
  importInput.type = 'file';
  importInput.accept = 'application/json,.json';
  importInput.addEventListener('change', importBackupFile);
  const actionRow = E('div', 'row acc-action-row', null, FS);
  B('Atualizar', () => refresh(true), actionRow);
  B('Apagar identidade', logout, actionRow, 'warn');
  const friendsBackButton = B('Voltar', () => go('title'), FS);
  friendsBackButton.classList.add('acc-back-button');

  function createIdentity() {
    if (engine) return;
    const username = nameField.value.trim();
    if (!Core.validUsername(username)) {
      setAccountMessage('Use de 3 a 16 caracteres: letras, números e _.', true);
      return;
    }
    let peerId;
    try { peerId = Core.makePeerId(username); }
    catch (_) { setAccountMessage('Este navegador não oferece geração aleatória segura. Não foi possível criar a identidade.', true); return; }
    const initial = Core.emptyState({ username, peerId });
    startEngine(initial);
    save();
    setAccountMessage('Identidade criada! Compartilhe seu código de amigo.', false);
    toast('Bem-vindo, ' + username + '!');
    openFriends();
    if (!storageOK) setFriendsMessage('Aviso: o armazenamento local está bloqueado. Exporte o backup antes de fechar o jogo.', true);
    bootPeer();
  }

  function startEngine(initialState) {
    engine = new Core.AccountEngine(initialState, {
      crypto: window.crypto,
      transport: sendPacket,
      onChange: () => emit(),
      getPresence: () => OWM.getAccountPresence ? OWM.getAccountPresence() : { status: 'online' },
      onPresence: (peerId, online, activity) => {
        const friend = stateNow()?.friends.find(item => item.peerId === peerId);
        if (friend) { friend.online = !!online; if (online) friend.lastSeen = now(); if (activity) friend.activity = Core.normalizeActivity(activity); }
        save();
        if (!FS.classList.contains('hidden')) renderFriends();
      }
    });
    emit();
  }

  function openAccount() {
    setAccountMessage(storageOK ? '' : 'Armazenamento local bloqueado: a identidade não será mantida ao fechar o jogo.');
    nameField.value = '';
    go('acct');
    nameField.focus();
  }
  function openFriends() {
    if (!engine) return openAccount();
    setFriendsMessage('');
    renderFriends();
    go('friends');
    refresh(true);
  }

  /* ---------- Identidade e apresentação ---------- */
  function ago(timestamp) {
    if (!timestamp) return 'offline';
    const seconds = Math.max(0, (now() - timestamp) / 1000 | 0);
    if (seconds < 90) return 'visto agora há pouco';
    if (seconds < 3600) return 'visto há ' + (seconds / 60 | 0) + ' min';
    if (seconds < 86400) return 'visto há ' + (seconds / 3600 | 0) + ' h';
    return 'visto há ' + (seconds / 86400 | 0) + ' d';
  }
  function addRow(parent, options) {
    const row = E('div', 'acc-row', null, parent);
    if (options.dot !== undefined) E('span', 'acc-dot' + (options.dot ? ' on' : ''), null, row);
    const text = E('div', 'acc-t', null, row);
    E('p', '', options.name, text);
    if (options.sub) E('p', options.subClass ? 'acc-sub ' + options.subClass : 'acc-sub', options.sub, text);
    const actions = E('div', 'acc-a', null, row);
    (options.actions || []).forEach(action => B(action.text, action.click, actions, 'mini' + (action.className ? ' ' + action.className : '')));
  }
  function sectionHeading(text) { E('div', 'acc-h', text, friendsList); }
  function confirmedRemoveButton(friend) {
    let armed = false, timer = 0;
    return {
      text: 'Remover', className: 'warn', click: function () {
        if (!armed) {
          armed = true; this.textContent = 'Confirmar?';
          clearTimeout(timer);
          timer = setTimeout(() => { armed = false; this.textContent = 'Remover'; }, 3000);
          return;
        }
        clearTimeout(timer);
        removeFriend(friend.peerId);
      }
    };
  }
  function renderFriends() {
    const state = stateNow();
    if (!state) return;
    who.textContent = 'Conectado como ' + state.identity.username;
    codeBox.textContent = 'Seu código: ' + state.identity.peerId;
    statusLine.textContent = peerStatus;
    statusLine.classList.toggle('bad', peerStatus.toLowerCase().includes('sem conexão'));
    friendsList.textContent = '';
    const { friends, incoming, outgoing } = state;
    if (incoming.length) {
      sectionHeading('Pedidos recebidos (' + incoming.length + ')');
      incoming.forEach(item => addRow(friendsList, { name: item.username, sub: 'quer ser seu amigo', actions: [
        { text: 'Aceitar', className: 'ok', click: () => runAction(() => engine.accept(item.peerId), 'Amizade aceita!') },
        { text: 'Recusar', click: () => runAction(() => engine.decline(item.peerId), 'Pedido recusado.') }
      ] }));
    }
    sectionHeading('Amigos (' + friends.length + ')');
    if (!friends.length) E('div', 'acc-empty', 'Nenhum amigo ainda. Peça o código de alguém para começar.', friendsList);
    friends.forEach(friend => {
      const activity = friend.activity || { status: 'online', worldName: '' };
      const presenceText = !friend.online ? ago(friend.lastSeen) :
        (activity.status === 'playing' && activity.worldName ? 'Jogando: ' + activity.worldName : 'online');
      addRow(friendsList, {
      name: friend.username,
      dot: !!friend.online,
      sub: presenceText,
      subClass: friend.online && activity.status === 'playing' ? 'playing' : (friend.online ? 'online' : 'offline'),
      actions: [confirmedRemoveButton(friend)]
    });
    });
    if (outgoing.length) {
      sectionHeading('Pedidos enviados (' + outgoing.length + ')');
      outgoing.forEach(item => addRow(friendsList, { name: item.username, sub: 'aguardando resposta', actions: [
        { text: 'Cancelar', click: () => runAction(() => engine.cancel(item.peerId), 'Pedido cancelado.') }
      ] }));
    }
  }
  async function runAction(action, successText) {
    if (!engine) return;
    const result = await action();
    if (!result || !result.ok) setFriendsMessage(result?.error || 'Não foi possível concluir a ação.', true);
    else setFriendsMessage(successText || 'Concluído.');
    renderFriends();
  }
  async function sendRequest() {
    if (!engine) return;
    const code = Core.normalizeCode(fAdd.value);
    const result = await engine.request(code);
    if (!result.ok) { setFriendsMessage(result.error, true); return; }
    fAdd.value = '';
    setFriendsMessage('Pedido enviado ou colocado na fila. Ele será reenviado quando houver conexão.');
    renderFriends();
    refresh(true);
  }
  async function removeFriend(peerId) {
    const result = await engine.remove(peerId);
    if (!result.ok) setFriendsMessage(result.error, true);
    else setFriendsMessage('Amizade removida. A notificação será reenviada quando houver conexão.');
    renderFriends();
  }

  /* ---------- Backup local ---------- */
  function backupText() {
    if (!engine) throw new Error('Nenhuma identidade para exportar.');
    return JSON.stringify({ app: 'OpenWorldMayhem-P2P', version: Core.VERSION, exportedAt: new Date().toISOString(), state: engine.exportState() }, null, 2);
  }
  function exportBackup() {
    try {
      const blob = new Blob([backupText()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'open-world-mayhem-backup.json';
      a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFriendsMessage('Backup exportado. Guarde-o em local seguro.');
    } catch (error) { setFriendsMessage(error.message || 'Falha ao exportar backup.', true); }
  }
  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    const field = E('textarea', 'acc-copy-fallback', null, document.body);
    field.value = text; field.setAttribute('readonly', ''); field.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) {}
    field.remove();
    return ok;
  }
  async function copyBackup() {
    try {
      const ok = await copyText(backupText());
      setFriendsMessage(ok ? 'Backup copiado para a área de transferência.' : 'Não foi possível copiar. Use Exportar para baixar o arquivo.', !ok);
    } catch (error) { setFriendsMessage(error.message || 'Falha ao copiar backup.', true); }
  }
  async function copyFriendCode() {
    const code = stateNow()?.identity.peerId;
    if (!code) return;
    const ok = await copyText(code);
    setFriendsMessage(ok ? 'Código de amigo copiado: ' + code : 'Não foi possível copiar o código.', !ok);
  }
  function importBackupFile(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 1024 * 1024) { setFriendsMessage('O arquivo é maior que 1 MB.', true); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = JSON.parse(String(reader.result || ''));
        if (!backup || backup.app !== 'OpenWorldMayhem-P2P' || backup.version !== Core.VERSION) throw new Error('Formato de backup não reconhecido.');
        const imported = Core.normalizeState(backup.state);
        if (!imported) throw new Error('Os dados do backup são inválidos.');
        if (!confirm('Importar este backup vai substituir a identidade e os dados atuais deste aparelho. Continuar?')) return;
        applyImportedState(imported);
      } catch (error) { setFriendsMessage(error.message || 'Não foi possível importar o backup.', true); }
    };
    reader.onerror = () => setFriendsMessage('Não foi possível ler o arquivo.', true);
    reader.readAsText(file);
  }
  function applyImportedState(imported) {
    stopPeer();
    engine = null;
    startEngine(imported);
    save();
    bootPeer();
    renderFriends();
    setFriendsMessage('Backup importado. Reconectando à rede P2P.');
  }

  /* ---------- Transporte PeerJS: nenhum servidor de jogo ---------- */
  function wireConnection(conn, inbound) {
    if (!conn || bound.has(conn)) return;
    if (!Core.validPeerId(conn.peer)) { try { conn.close(); } catch (_) {} return; }
    bound.add(conn);
    connectionDirection.set(conn, !!inbound);
    const remote = Core.normalizeCode(conn.peer);
    let openedHandled = false;
    const handleOpen = () => {
      if (openedHandled) return;
      openedHandled = true;
      const knownPeer = stateNow().friends.some(x => x.peerId === remote) || stateNow().incoming.some(x => x.peerId === remote) || stateNow().outgoing.some(x => x.peerId === remote) || stateNow().queue.some(x => x.peerId === remote);
      if (inbound && !knownPeer && !connections.has(remote) && connections.size >= 150) { try { conn.close(); } catch (_) {} return; }
      const current = connections.get(remote);
      if (current && current !== conn && current.open) {
        // Os dois lados escolhem deterministicamente o canal iniciado pelo Peer ID menor.
        const preferInbound = stateNow().identity.peerId > remote;
        const newPreferred = !!inbound === preferInbound;
        const oldPreferred = connectionDirection.get(current) === preferInbound;
        if (!newPreferred || oldPreferred) {
          try { conn.close(); } catch (_) {}
          const waiter = opening.get(remote);
          if (waiter) waiter.resolve(current);
          return;
        }
      }
      // Troca a referência antes de fechar o canal antigo para não rejeitar o waiter novo.
      connections.set(remote, conn);
      if (current && current !== conn) { try { current.close(); } catch (_) {} }
      const friend = stateNow()?.friends.find(item => item.peerId === remote);
      if (friend) engine.setPresence(remote, true);
      if (engine) {
        engine.retryQueued(true);
        if (friend) engine.ping(remote);
      }
      const waiter = opening.get(remote);
      if (waiter) waiter.resolve(conn);
    };
    conn.on('open', handleOpen);
    conn.on('data', data => {
      if (!engine) return;
      // Canal separado do protocolo de contas. Só amigos aceitos podem enviar estado de jogo.
      if (data && data.__owmGame === 1 && data.payload && typeof data.payload === 'object' && !Array.isArray(data.payload)) {
        const friend = stateNow().friends.find(item => item.peerId === remote && item.confirmed);
        if (!friend) return;
        let bytes = 0;
        try { bytes = JSON.stringify(data.payload).length; } catch (_) { return; }
        if (bytes > 12000) return;
        gameDataListeners.forEach(fn => { try { fn(remote, data.payload); } catch (error) { console.error('[OWM] Erro ao receber pacote multiplayer:', error); } });
        return;
      }
      engine.receive(data, remote).then(accepted => {
        if (accepted && !FS.classList.contains('hidden')) renderFriends();
      }).catch(() => {});
    });
    conn.on('close', () => {
      if (connections.get(remote) === conn) {
        connections.delete(remote);
        if (engine) engine.setPresence(remote, false);
      }
      const waiter = opening.get(remote);
      if (waiter && !(connections.get(remote) && connections.get(remote).open)) waiter.reject(new Error('Conexão encerrada.'));
    });
    conn.on('error', () => {
      if (connections.get(remote) === conn) connections.delete(remote);
      if (engine) engine.setPresence(remote, false);
      const waiter = opening.get(remote);
      if (waiter && !(connections.get(remote) && connections.get(remote).open)) waiter.reject(new Error('Falha na conexão P2P.'));
    });
    if (conn.open) setTimeout(handleOpen, 0);
  }

  function waitForPeerReady(timeout = 30000) {
    if (peer && peer.open && !peer.destroyed && !peer.disconnected) return Promise.resolve(true);
    return new Promise((resolve, reject) => {
      const started = now();
      const check = () => {
        if (!engine) { reject(new Error('Entre em uma conta antes de usar o multiplayer.')); return; }
        if (peer && peer.open && !peer.destroyed && !peer.disconnected) { resolve(true); return; }
        if (now() - started >= timeout) { reject(new Error('A conexão P2P ainda não ficou pronta. Confira o status da sua conta e tente novamente.')); return; }
        setTimeout(check, 150);
      };
      check();
    });
  }

  function ensureConnection(peerId) {
    peerId = Core.normalizeCode(peerId);
    const existing = connections.get(peerId);
    if (existing && existing.open) return Promise.resolve(existing);
    const pending = opening.get(peerId);
    if (pending) return pending.promise;
    if (!peer || peer.destroyed || peer.disconnected || !peer.open) return Promise.reject(new Error('Sem conexão com a rede P2P.'));
    let conn;
    try { conn = peer.connect(peerId, { reliable: true, serialization: 'json' }); }
    catch (error) { return Promise.reject(error); }
    let timer;
    let resolveWait, rejectWait;
    const promise = new Promise((resolve, reject) => { resolveWait = resolve; rejectWait = reject; });
    const waiter = {
      promise,
      resolve: value => { clearTimeout(timer); resolveWait(value); },
      reject: error => { clearTimeout(timer); rejectWait(error); }
    };
    opening.set(peerId, waiter);
    timer = setTimeout(() => waiter.reject(new Error('Tempo esgotado ao conectar.')), 9000);
    promise.finally(() => { if (opening.get(peerId) === waiter) opening.delete(peerId); }).catch(() => {});
    wireConnection(conn, false);
    return promise;
  }
  async function sendPacket(peerId, packet) {
    const conn = await ensureConnection(peerId);
    if (!conn || !conn.open) throw new Error('Conexão P2P indisponível.');
    conn.send(packet);
    return true;
  }
  function stopPeer() {
    if (peerRetryTimer) { clearTimeout(peerRetryTimer); peerRetryTimer = 0; }
    peerReady = false;
    for (const conn of connections.values()) { try { conn.close(); } catch (_) {} }
    connections.clear();
    for (const waiter of opening.values()) waiter.reject(new Error('Conexão encerrada.'));
    opening.clear();
    if (peer) { try { peer.destroy(); } catch (_) {} }
    peer = null;
    setPeerStatus('Sem conexão', true);
  }
  let collisionAttempts = 0;
  function rotatePeerId() {
    if (!engine || collisionAttempts++ > 8) { setPeerStatus('Sem conexão: código em uso.', true); return; }
    stopPeer();
    try {
      const nextId = Core.makePeerId(engine.state.identity.username);
      engine.state.identity.peerId = nextId;
      save();
      renderFriends();
      toast('Código atualizado porque o anterior já estava em uso.');
      setTimeout(bootPeer, 250);
    } catch (_) { setPeerStatus('Sem conexão: não foi possível gerar outro código.', true); }
  }
  function schedulePeerRetry() {
    if (peerRetryTimer || !engine) return;
    peerRetryTimer = setTimeout(() => {
      peerRetryTimer = 0;
      if (engine && !peerReady) bootPeer();
    }, 15000);
  }
  function bootPeer() {
    if (!engine) return;
    if (typeof window.Peer !== 'function') {
      setPeerStatus('Sem conexão: biblioteca PeerJS indisponível.', true);
      schedulePeerRetry();
      return;
    }
    if (!window.crypto || !window.crypto.subtle || !window.crypto.getRandomValues) {
      setPeerStatus('Sem conexão: Web Crypto indisponível neste navegador.', true);
      return;
    }
    stopPeer();
    setPeerStatus('Conectando à rede P2P…', false);
    try {
      peer = new window.Peer(engine.state.identity.peerId); // PeerJS Cloud padrão; sem host/key próprios.
      peer.on('open', () => {
        peerReady = true; collisionAttempts = 0;
        if (peerRetryTimer) { clearTimeout(peerRetryTimer); peerRetryTimer = 0; }
        setPeerStatus('Conectado ao broker P2P');
        engine.retryQueued(true);
        refresh(true);
      });
      peer.on('connection', conn => wireConnection(conn, true));
      peer.on('disconnected', () => {
        peerReady = false; setPeerStatus('Sem conexão com o broker P2P.', true);
        try { if (peer && !peer.destroyed) peer.reconnect(); } catch (_) {}
        schedulePeerRetry();
      });
      peer.on('close', () => {
        peerReady = false; setPeerStatus('Sem conexão', true);
      });
      peer.on('error', error => {
        const type = error && error.type;
        if (type === 'unavailable-id' || type === 'invalid-id') { rotatePeerId(); return; }
        if (type === 'peer-unavailable') return;
        setPeerStatus('Sem conexão com o broker P2P.', true);
        schedulePeerRetry();
      });
    } catch (_) { setPeerStatus('Sem conexão com o broker P2P.', true); schedulePeerRetry(); }
  }

  // O carregamento do CDN é assíncrono: a falha da biblioteca nunca bloqueia o jogo.
  window.OWMAccountsPeerReady = () => { if (engine && !peerReady) bootPeer(); };
  window.OWMAccountsPeerFailed = () => {
    if (engine) setPeerStatus('Sem conexão: biblioteca PeerJS indisponível.', true);
  };

  async function refresh(manual) {
    if (!engine) return;
    if (!peerReady || !peer || peer.destroyed) {
      if (manual && peerStatus === 'Sem conexão') setFriendsMessage('Sem conexão. Sua identidade continua salva neste aparelho.');
      return;
    }
    await engine.retryQueued(false);
    const friends = [...engine.state.friends];
    await Promise.all(friends.map(async friend => {
      try {
        const conn = await ensureConnection(friend.peerId);
        if (conn && conn.open) {
          engine.setPresence(friend.peerId, true);
          await engine.ping(friend.peerId);
        } else engine.setPresence(friend.peerId, false);
      } catch (_) { engine.setPresence(friend.peerId, false); }
    }));
    if (manual) setFriendsMessage('Lista atualizada.');
  }

  async function logout() {
    if (!confirm('Apagar a identidade e todos os amigos deste aparelho? Isso não apaga os dados dos outros jogadores. Exporte um backup antes, se precisar.')) return;
    stopPeer();
    engine = null;
    try { localStorage.removeItem(STORAGE_KEY); storageOK = true; } catch (_) { storageOK = false; }
    emit();
    go('title');
    toast('Identidade apagada deste aparelho.');
  }

  /* ---------- Compatibilidade com o restante do jogo ---------- */
  OWM.account = {
    get loggedIn() { return !!engine; },
    get username() { return engine ? engine.state.identity.username : null; },
    get peerId() { return engine ? engine.state.identity.peerId : null; },
    get friends() { return engine ? engine.state.friends.map(friend => ({ username: friend.username, peerId: friend.peerId, online: !!friend.online, confirmed: !!friend.confirmed })) : []; },
    isFriend: peerId => !!(engine && engine.state.friends.some(friend => friend.peerId === Core.normalizeCode(peerId) && friend.confirmed)),
    waitForNetwork: () => waitForPeerReady(30000),
    connectPeer: async peerId => {
      const id = Core.normalizeCode(peerId);
      if (!engine || !engine.state.friends.some(friend => friend.peerId === id && friend.confirmed)) throw new Error('Só é possível entrar em mundos de amigos aceitos.');
      await waitForPeerReady(30000);
      return ensureConnection(id);
    },
    sendGameData: async (peerId, payload) => {
      const id = Core.normalizeCode(peerId);
      if (!engine || !engine.state.friends.some(friend => friend.peerId === id && friend.confirmed)) throw new Error('Esse jogador não está na sua lista de amigos aceitos.');
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Pacote multiplayer inválido.');
      let bytes; try { bytes = JSON.stringify(payload).length; } catch (_) { throw new Error('Pacote multiplayer inválido.'); }
      if (bytes > 12000) throw new Error('Pacote de rede grande demais.');
      const existing = connections.get(id);
      if (!existing || !existing.open) await waitForPeerReady(30000);
      const conn = await ensureConnection(id);
      if (!conn || !conn.open) throw new Error('Conexão P2P indisponível.');
      conn.send({ __owmGame: 1, payload });
      return true;
    },
    onGameData: fn => { if (typeof fn !== 'function') return () => {}; gameDataListeners.add(fn); return () => gameDataListeners.delete(fn); },
    get incoming() { return engine ? engine.state.incoming.map(item => ({ username: item.username, peerId: item.peerId })) : []; },
    get outgoing() { return engine ? engine.state.outgoing.map(item => ({ username: item.username, peerId: item.peerId })) : []; },
    refresh: () => refresh(true),
    logout,
    open: () => engine ? openFriends() : openAccount(),
    onChange: fn => { if (typeof fn === 'function') listeners.push(fn); }
  };

  /* ---------- Inicialização tolerante a falhas ---------- */
  const previousOnScreen = OWM.onScreen;
  OWM.onScreen = id => {
    if (previousOnScreen) previousOnScreen(id);
    if (id === 'friends') refresh(true);
  };
  setInterval(() => { if (engine && !document.hidden) refresh(false); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(true); });

  const saved = readSaved();
  if (saved) {
    startEngine(saved);
    bootPeer();
  } else if (storageOK) {
    setPeerStatus('Sem conexão');
  }
  refreshTitleButton();
  if (!storageOK) setAccountMessage('O armazenamento local está bloqueado. Sem ele, a identidade não será mantida ao fechar o jogo.');
})();
