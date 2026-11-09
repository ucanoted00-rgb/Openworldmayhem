/* Open World Mayhem — lógica pura de contas P2P. Sem DOM, PeerJS ou servidor. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.OWMAccountCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 1;
  const USER_RE = /^[A-Za-z0-9_]{3,16}$/;
  const FRIEND_CODE_RE = /^[A-Z0-9][A-Z0-9_]{2,16}-[A-Z0-9]{4}$/i;
  const SECRET_RE = /^[a-f0-9]{64}$/i;
  const MAX_FRIENDS = 100;
  const MAX_PENDING = 50;
  const MAX_QUEUE = MAX_FRIENDS * 2 + MAX_PENDING * 2;
  const MAX_PACKET_BYTES = 8192;
  const UNSIGNED_TYPES = new Set(['friend-request', 'friend-accept', 'friend-decline', 'friend-cancel', 'request-ack']);
  const SIGNED_TYPES = new Set(['friend-confirm', 'ping', 'pong', 'friend-remove', 'remove-ack']);
  const ALL_TYPES = new Set([...UNSIGNED_TYPES, ...SIGNED_TYPES]);

  const clone = value => JSON.parse(JSON.stringify(value));
  function normalizeActivity(value) {
    if (!safeObject(value)) return { status: 'online', worldName: '' };
    if (value.status === 'playing' && typeof value.worldName === 'string') {
      const worldName = value.worldName.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 32);
      if (worldName) return { status: 'playing', worldName };
    }
    return { status: 'online', worldName: '' };
  }
  function validActivity(value) {
    if (!safeObject(value)) return false;
    const keys = Object.keys(value);
    if (value.status === 'online') return keys.length === 1 && keys[0] === 'status';
    return value.status === 'playing' && keys.length === 2 && keys.includes('status') && keys.includes('worldName') &&
      typeof value.worldName === 'string' && value.worldName.length >= 1 && value.worldName.length <= 32 &&
      value.worldName.trim() === value.worldName && !/[\u0000-\u001f\u007f]/.test(value.worldName);
  }
  const validUsername = value => typeof value === 'string' && USER_RE.test(value);
  const normalizeCode = value => typeof value === 'string' ? value.trim().toUpperCase() : '';
  const validFriendCode = value => FRIEND_CODE_RE.test(normalizeCode(value));
  const validPeerId = value => validFriendCode(value);
  const validSecret = value => typeof value === 'string' && SECRET_RE.test(value);
  const usernamePrefix = username => (username[0] === '_' ? 'U' + username : username).toUpperCase();
  const usernameMatchesPeerId = (username, peerId) => validUsername(username) && validPeerId(peerId) && normalizeCode(peerId).split('-')[0] === usernamePrefix(username);
  const safeObject = value => value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) !== null;

  function bytesToHex(bytes) {
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
  function hexToBytes(hex) {
    if (!validSecret(hex)) throw new Error('Segredo inválido');
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  function randomBytes(length, cryptoRef) {
    const c = cryptoRef || (typeof globalThis !== 'undefined' ? globalThis.crypto : null);
    if (!c || typeof c.getRandomValues !== 'function') throw new Error('Gerador seguro indisponível');
    return c.getRandomValues(new Uint8Array(length));
  }
  function makePeerId(username, cryptoRef) {
    if (!validUsername(username)) throw new Error('Nome inválido');
    const prefix = username[0] === '_' ? 'U' + username : username;
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(4, cryptoRef);
    let suffix = '';
    for (let i = 0; i < 4; i++) suffix += alphabet[bytes[i] % alphabet.length];
    return (prefix + '-' + suffix).toUpperCase();
  }
  function makeSecret(cryptoRef) { return bytesToHex(randomBytes(32, cryptoRef)); }
  function makeNonce(cryptoRef) { return bytesToHex(randomBytes(12, cryptoRef)); }

  function emptyState(identity) {
    return {
      version: VERSION,
      identity: identity ? { username: identity.username, peerId: identity.peerId } : null,
      friends: [], incoming: [], outgoing: [], queue: [], tombstones: []
    };
  }

  function cleanPending(list, ownPeerId) {
    if (!Array.isArray(list)) return [];
    const result = [], seen = new Set();
    for (const item of list) {
      if (result.length >= MAX_PENDING || !safeObject(item)) break;
      const peerId = normalizeCode(item.peerId);
      const username = String(item.username || '');
      if (!usernameMatchesPeerId(username, peerId) || peerId === ownPeerId || seen.has(peerId)) continue;
      seen.add(peerId);
      result.push({ username, peerId, createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now() });
    }
    return result;
  }

  function normalizeState(input) {
    if (!safeObject(input) || input.version !== VERSION || !safeObject(input.identity)) return null;
    const username = String(input.identity.username || '');
    const peerId = normalizeCode(input.identity.peerId);
    if (!usernameMatchesPeerId(username, peerId)) return null;
    const state = emptyState({ username, peerId });
    const ids = new Set();
    if (Array.isArray(input.friends)) for (const item of input.friends) {
      if (state.friends.length >= MAX_FRIENDS || !safeObject(item)) break;
      const id = normalizeCode(item.peerId), name = String(item.username || '');
      if (!usernameMatchesPeerId(name, id) || id === peerId || !validSecret(item.secret) || ids.has(id)) continue;
      ids.add(id);
      state.friends.push({ username: name, peerId: id, secret: item.secret.toLowerCase(), online: false, lastSeen: Number.isFinite(item.lastSeen) ? item.lastSeen : 0, activity: normalizeActivity(item.activity), confirmed: item.confirmed !== false });
    }
    state.incoming = cleanPending(input.incoming, peerId).filter(x => !ids.has(x.peerId));
    state.outgoing = cleanPending(input.outgoing, peerId).filter(x => !ids.has(x.peerId));
    if (Array.isArray(input.queue)) for (const item of input.queue) {
      if (state.queue.length >= MAX_QUEUE || !safeObject(item)) break;
      const id = normalizeCode(item.peerId);
      if (!validPeerId(id) || id === peerId) continue;
      if (item.type === 'friend-request' && state.outgoing.some(x => x.peerId === id)) {
        if (!state.queue.some(x => x.type === item.type && x.peerId === id)) state.queue.push({ type: item.type, peerId: id, createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(), lastSent: 0 });
      } else if ((item.type === 'friend-cancel' || item.type === 'friend-decline') && !item.secret) {
        if (!state.queue.some(x => x.type === item.type && x.peerId === id)) state.queue.push({ type: item.type, peerId: id, createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(), lastSent: 0 });
      } else if (item.type === 'friend-remove' && validSecret(item.secret)) {
        if (!state.queue.some(x => x.type === item.type && x.peerId === id)) state.queue.push({ type: item.type, peerId: id, secret: item.secret.toLowerCase(), username: validUsername(item.username) ? item.username : id.split('-')[0], createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(), lastSent: 0 });
      } else if (item.type === 'friend-accept' && validSecret(item.secret)) {
        const friend = state.friends.find(x => x.peerId === id);
        if (!friend || friend.secret !== item.secret.toLowerCase() || friend.confirmed) continue;
        if (!state.queue.some(x => x.type === item.type && x.peerId === id)) state.queue.push({ type: item.type, peerId: id, secret: item.secret.toLowerCase(), username: validUsername(item.username) ? item.username : friend.username, createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(), lastSent: 0 });
      }
    }
    if (Array.isArray(input.tombstones)) for (const item of input.tombstones) {
      if (state.tombstones.length >= MAX_FRIENDS || !safeObject(item)) break;
      const id = normalizeCode(item.peerId);
      if (validPeerId(id) && validSecret(item.secret) && !state.tombstones.some(x => x.peerId === id)) state.tombstones.push({ peerId: id, secret: item.secret.toLowerCase(), until: Number.isFinite(item.until) ? item.until : Date.now() + 7 * 86400000 });
    }
    return state;
  }

  function canonicalPacket(packet) {
    return JSON.stringify({
      v: packet.v, type: packet.type, fromPeerId: packet.fromPeerId, toPeerId: packet.toPeerId,
      fromUsername: packet.fromUsername, ts: packet.ts, nonce: packet.nonce, data: packet.data
    });
  }
  async function hmacSign(packet, secret, cryptoRef) {
    const c = cryptoRef || globalThis.crypto;
    if (!c || !c.subtle || typeof TextEncoder === 'undefined') throw new Error('HMAC indisponível');
    const key = await c.subtle.importKey('raw', hexToBytes(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await c.subtle.sign('HMAC', key, new TextEncoder().encode(canonicalPacket(packet)));
    return bytesToHex(new Uint8Array(signature));
  }
  async function hmacVerify(packet, secret, cryptoRef) {
    if (!safeObject(packet) || !validSecret(packet.mac)) return false;
    const c = cryptoRef || globalThis.crypto;
    if (!c || !c.subtle || typeof TextEncoder === 'undefined') return false;
    try {
      const key = await c.subtle.importKey('raw', hexToBytes(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
      const signature = new Uint8Array(packet.mac.match(/.{2}/g).map(x => parseInt(x, 16)));
      return await c.subtle.verify('HMAC', key, signature, new TextEncoder().encode(canonicalPacket(packet)));
    } catch (_) { return false; }
  }

  function packetShape(packet, remotePeerId, ownPeerId, now) {
    if (!safeObject(packet)) return false;
    try {
      const serialized = JSON.stringify(packet);
      if (typeof TextEncoder === 'undefined' || new TextEncoder().encode(serialized).byteLength > MAX_PACKET_BYTES) return false;
    } catch (_) { return false; }
    if (packet.v !== VERSION || !ALL_TYPES.has(packet.type)) return false;
    if (normalizeCode(packet.fromPeerId) !== remotePeerId || normalizeCode(packet.toPeerId) !== ownPeerId) return false;
    if (!usernameMatchesPeerId(packet.fromUsername, remotePeerId) || !Number.isFinite(packet.ts) || Math.abs(now - packet.ts) > 120000) return false;
    if (typeof packet.nonce !== 'string' || !/^[a-f0-9]{24}$/i.test(packet.nonce)) return false;
    if (!safeObject(packet.data)) return false;
    if (UNSIGNED_TYPES.has(packet.type) && packet.mac !== undefined) return false;
    if (SIGNED_TYPES.has(packet.type) && !validSecret(packet.mac)) return false;
    if (packet.type === 'friend-accept') return Object.keys(packet.data).length === 1 && validSecret(packet.data.secret);
    if (packet.type === 'request-ack') {
      const keys = Object.keys(packet.data);
      return keys.every(key => key === 'action' || key === 'username') &&
        (packet.data.action === undefined || ['friend-cancel', 'friend-decline'].includes(packet.data.action)) &&
        (packet.data.username === undefined || usernameMatchesPeerId(packet.data.username, remotePeerId));
    }
    if (packet.type === 'ping' || packet.type === 'pong') return validActivity(packet.data);
    return Object.keys(packet.data).length === 0;
  }

  class AccountEngine {
    constructor(state, options) {
      const opts = options || {};
      const normalized = normalizeState(state);
      if (!normalized) throw new Error('Estado de conta inválido');
      this.state = normalized;
      this.transport = typeof opts.transport === 'function' ? opts.transport : async () => { throw new Error('Sem transporte'); };
      this.crypto = opts.crypto || globalThis.crypto;
      this.now = typeof opts.now === 'function' ? opts.now : () => Date.now();
      this.onChange = typeof opts.onChange === 'function' ? opts.onChange : () => {};
      this.onPresence = typeof opts.onPresence === 'function' ? opts.onPresence : () => {};
      this.getPresence = typeof opts.getPresence === 'function' ? opts.getPresence : () => ({ status: 'online' });
      this.seen = new Map();
      this.rate = new Map();
      this._emit();
    }
    _emit() { try { this.onChange(this.state); } catch (_) {} }
    _newPacket(type, peerId, data) {
      return { v: VERSION, type, fromPeerId: this.state.identity.peerId, toPeerId: peerId, fromUsername: this.state.identity.username, ts: this.now(), nonce: makeNonce(this.crypto), data: data || {} };
    }
    async _sendRaw(peerId, packet) {
      try { await this.transport(peerId, packet); return true; } catch (_) { return false; }
    }
    async _sendUnsigned(type, peerId, data) { return this._sendRaw(peerId, this._newPacket(type, peerId, data)); }
    async _sendSigned(type, peerId, data, secret) {
      const packet = this._newPacket(type, peerId, data);
      packet.mac = await hmacSign(packet, secret, this.crypto);
      return this._sendRaw(peerId, packet);
    }
    _find(list, peerId) { return list.findIndex(x => x.peerId === peerId); }
    _removePending(peerId) {
      this.state.incoming = this.state.incoming.filter(x => x.peerId !== peerId);
      this.state.outgoing = this.state.outgoing.filter(x => x.peerId !== peerId);
      this.state.queue = this.state.queue.filter(x => !(x.type === 'friend-request' && x.peerId === peerId));
    }
    _setFriend(username, peerId, secret, confirmed) {
      let friend = this.state.friends.find(x => x.peerId === peerId);
      if (!friend && this.state.friends.length >= MAX_FRIENDS) return null;
      if (friend && friend.secret !== secret) return null;
      if (!friend) {
        friend = { username, peerId, secret, online: true, lastSeen: this.now(), activity: { status: 'online', worldName: '' }, confirmed: !!confirmed };
        this.state.friends.push(friend);
      } else {
        friend.username = username;
        friend.online = true;
        friend.lastSeen = this.now();
        if (confirmed) friend.confirmed = true;
      }
      this._removePending(peerId);
      return friend;
    }
    async request(code) {
      const peerId = normalizeCode(code);
      if (!validPeerId(peerId)) return { ok: false, error: 'Código inválido. Confira o código completo.' };
      if (peerId === this.state.identity.peerId) return { ok: false, error: 'Esse é o seu próprio código.' };
      if (this.state.friends.some(x => x.peerId === peerId)) return { ok: false, error: 'Vocês já são amigos.' };
      if (this._find(this.state.outgoing, peerId) >= 0) return { ok: false, error: 'Esse pedido já foi enviado.' };
      if (this.state.outgoing.length >= MAX_PENDING) return { ok: false, error: 'Limite de 50 pedidos pendentes atingido.' };
      const hasQueuedRequest = this.state.queue.some(x => x.type === 'friend-request' && x.peerId === peerId);
      if (!hasQueuedRequest && this.state.queue.length >= MAX_QUEUE) return { ok: false, error: 'Fila de sincronização cheia. Conecte-se e tente novamente.' };
      const incoming = this._find(this.state.incoming, peerId);
      if (incoming >= 0) this.state.incoming.splice(incoming, 1);
      this.state.outgoing.push({ username: peerId.split('-')[0], peerId, createdAt: this.now() });
      if (!hasQueuedRequest) this.state.queue.push({ type: 'friend-request', peerId, createdAt: this.now(), lastSent: 0 });
      this._emit(); // Persiste a fila antes de tentar abrir uma conexão que pode expirar.
      await this._sendUnsigned('friend-request', peerId, {});
      const crossedWillAutoAccept = this.state.identity.peerId > peerId;
      this._emit();
      return { ok: true, crossedWillAutoAccept, peerId };
    }
    async accept(peerId) {
      peerId = normalizeCode(peerId);
      const index = this._find(this.state.incoming, peerId);
      if (index < 0) return { ok: false, error: 'Esse pedido não está mais disponível.' };
      if (this.state.friends.length >= MAX_FRIENDS) return { ok: false, error: 'Limite de 100 amigos atingido.' };
      const incoming = this.state.incoming[index];
      const hasQueuedAccept = this.state.queue.some(x => x.type === 'friend-accept' && x.peerId === peerId);
      if (!hasQueuedAccept && this.state.queue.length >= MAX_QUEUE) return { ok: false, error: 'Fila de sincronização cheia. Conecte-se e tente novamente.' };
      const secret = makeSecret(this.crypto);
      const friend = this._setFriend(incoming.username, peerId, secret, false);
      if (!friend) return { ok: false, error: 'Não foi possível aceitar esse pedido.' };
      if (!hasQueuedAccept) this.state.queue.push({ type: 'friend-accept', peerId, username: incoming.username, secret, createdAt: this.now(), lastSent: 0 });
      this._emit();
      await this._sendUnsigned('friend-accept', peerId, { secret });
      this._emit();
      return { ok: true };
    }
    async decline(peerId) {
      peerId = normalizeCode(peerId);
      const index = this._find(this.state.incoming, peerId);
      if (index < 0) return { ok: false, error: 'Pedido não encontrado.' };
      if (!this.state.queue.some(x => x.type === 'friend-decline' && x.peerId === peerId) && this.state.queue.length >= MAX_QUEUE) return { ok: false, error: 'Fila de sincronização cheia. Conecte-se e tente novamente.' };
      this.state.incoming.splice(index, 1);
      if (!this.state.queue.some(x => x.type === 'friend-decline' && x.peerId === peerId)) this.state.queue.push({ type: 'friend-decline', peerId, createdAt: this.now(), lastSent: 0 });
      this._emit();
      await this._sendUnsigned('friend-decline', peerId, {});
      this._emit();
      return { ok: true };
    }
    async cancel(peerId) {
      peerId = normalizeCode(peerId);
      const index = this._find(this.state.outgoing, peerId);
      if (index < 0) return { ok: false, error: 'Pedido enviado não encontrado.' };
      const hasQueuedRequest = this.state.queue.some(x => x.type === 'friend-request' && x.peerId === peerId);
      if (!hasQueuedRequest && !this.state.queue.some(x => x.type === 'friend-cancel' && x.peerId === peerId) && this.state.queue.length >= MAX_QUEUE) return { ok: false, error: 'Fila de sincronização cheia. Conecte-se e tente novamente.' };
      this._removePending(peerId);
      if (!this.state.queue.some(x => x.type === 'friend-cancel' && x.peerId === peerId)) this.state.queue.push({ type: 'friend-cancel', peerId, createdAt: this.now(), lastSent: 0 });
      this._emit();
      await this._sendUnsigned('friend-cancel', peerId, {});
      this._emit();
      return { ok: true };
    }
    async remove(peerId) {
      peerId = normalizeCode(peerId);
      const index = this._find(this.state.friends, peerId);
      if (index < 0) return { ok: false, error: 'Amizade não encontrada.' };
      const friend = this.state.friends[index];
      const remainingQueue = this.state.queue.filter(x => !(x.type === 'friend-remove' && x.peerId === peerId));
      if (remainingQueue.length >= MAX_QUEUE) return { ok: false, error: 'Fila de sincronização cheia. Conecte-se e tente novamente.' };
      this.state.queue = remainingQueue;
      this.state.friends.splice(index, 1);
      this.state.queue.push({ type: 'friend-remove', peerId, username: friend.username, secret: friend.secret, createdAt: this.now(), lastSent: 0 });
      this._emit();
      await this._sendSigned('friend-remove', peerId, {}, friend.secret);
      this._emit();
      return { ok: true };
    }
    async retryQueued(force) {
      const time = this.now();
      const jobs = [];
      for (const item of [...this.state.queue]) {
        if (!force && time - (item.lastSent || 0) < 14000) continue;
        item.lastSent = time;
        if (item.type === 'friend-request') jobs.push(this._sendUnsigned('friend-request', item.peerId, {}));
        else if (item.type === 'friend-accept') jobs.push(this._sendUnsigned('friend-accept', item.peerId, { secret: item.secret }));
        else if (item.type === 'friend-cancel' || item.type === 'friend-decline') jobs.push(this._sendUnsigned(item.type, item.peerId, {}));
        else if (item.type === 'friend-remove') jobs.push(this._sendSigned('friend-remove', item.peerId, {}, item.secret));
      }
      await Promise.all(jobs);
      this._emit();
    }
    _localActivity() {
      try {
        const value = this.getPresence();
        const normalized = normalizeActivity(value);
        return validActivity(normalized) ? normalized : { status: 'online' };
      } catch (_) { return { status: 'online' }; }
    }
    async ping(peerId) {
      const friend = this.state.friends.find(x => x.peerId === normalizeCode(peerId));
      if (!friend) return false;
      return this._sendSigned('ping', friend.peerId, this._localActivity(), friend.secret);
    }
    setPresence(peerId, online, activity) {
      const friend = this.state.friends.find(x => x.peerId === normalizeCode(peerId));
      if (!friend) return;
      friend.online = !!online;
      if (online) friend.lastSeen = this.now();
      if (activity && validActivity(activity)) friend.activity = normalizeActivity(activity);
      else if (online) friend.activity = { status: 'online', worldName: '' };
      this._emit();
      try { this.onPresence(peerId, friend.online, friend.activity); } catch (_) {}
    }
    _replayAllowed(packet) {
      const now = this.now(), id = packet.fromPeerId;
      let seen = this.seen.get(id);
      if (!seen) {
        if (this.seen.size >= 256) this.seen.delete(this.seen.keys().next().value);
        seen = new Map(); this.seen.set(id, seen);
      }
      for (const [nonce, ts] of seen) if (now - ts > 120000) seen.delete(nonce);
      if (seen.has(packet.nonce)) return false;
      if (seen.size >= 128) seen.delete(seen.keys().next().value);
      seen.set(packet.nonce, now);
      if (this.rate.size >= 256 && !this.rate.has(id)) {
        for (const [peerId, item] of this.rate) if (now - item.start > 60000) this.rate.delete(peerId);
        if (this.rate.size >= 256) this.rate.delete(this.rate.keys().next().value);
      }
      const rate = this.rate.get(id) || { start: now, count: 0 };
      if (now - rate.start > 10000) { rate.start = now; rate.count = 0; }
      rate.count++;
      this.rate.set(id, rate);
      return rate.count <= 35;
    }
    async receive(packet, remotePeerId) {
      const remote = normalizeCode(remotePeerId);
      if (!validPeerId(remote) || !packetShape(packet, remote, this.state.identity.peerId, this.now())) return false;
      if (!this._replayAllowed(packet)) return false;
      let friend = this.state.friends.find(x => x.peerId === remote);

      // Quem já está na lista de amigos só pode falar com HMAC válido.
      if (friend) {
        if (UNSIGNED_TYPES.has(packet.type)) {
          // Durante o handshake pendente, repetir o pedido/aceitação permite recuperar pacotes perdidos.
          if (packet.type === 'friend-request' && !friend.confirmed) {
            await this._sendUnsigned('friend-accept', remote, { secret: friend.secret });
            this._emit();
            return true;
          }
          if (packet.type === 'friend-accept' && packet.data.secret === friend.secret) {
            await this._sendSigned('friend-confirm', remote, {}, friend.secret);
            friend.confirmed = true; friend.online = true; friend.lastSeen = this.now();
            this.state.queue = this.state.queue.filter(x => !(x.type === 'friend-accept' && x.peerId === remote));
            this._emit();
            return true;
          }
          return false;
        }
        if (!SIGNED_TYPES.has(packet.type) || !(await hmacVerify(packet, friend.secret, this.crypto))) return false;
        friend.online = true; friend.lastSeen = this.now();
        if (packet.type === 'ping' || packet.type === 'pong') friend.activity = normalizeActivity(packet.data);
        switch (packet.type) {
          case 'ping': await this._sendSigned('pong', remote, this._localActivity(), friend.secret); break;
          case 'pong': this.onPresence(remote, true, friend.activity); break;
          case 'friend-confirm':
            friend.confirmed = true;
            this.state.queue = this.state.queue.filter(x => !(x.type === 'friend-accept' && x.peerId === remote));
            break;
          case 'friend-remove':
            this.state.friends = this.state.friends.filter(x => x.peerId !== remote);
            this.state.tombstones = this.state.tombstones.filter(x => x.peerId !== remote);
            this.state.tombstones.push({ peerId: remote, secret: friend.secret, until: this.now() + 7 * 86400000 });
            if (this.state.tombstones.length > MAX_FRIENDS) this.state.tombstones.shift();
            this._emit();
            await this._sendSigned('remove-ack', remote, {}, friend.secret);
            break;
          case 'remove-ack':
            this.state.queue = this.state.queue.filter(x => !(x.type === 'friend-remove' && x.peerId === remote));
            break;
        }
        this._emit();
        return true;
      }

      // Um pedido de remoção repetido pode ser confirmado por um tombstone local.
      if (packet.type === 'remove-ack') {
        const pendingRemoval = this.state.queue.find(x => x.type === 'friend-remove' && x.peerId === remote);
        if (!pendingRemoval || !(await hmacVerify(packet, pendingRemoval.secret, this.crypto))) return false;
        this.state.queue = this.state.queue.filter(x => !(x.type === 'friend-remove' && x.peerId === remote));
        this._emit();
        return true;
      }
      if (packet.type === 'friend-remove') {
        const tomb = this.state.tombstones.find(x => x.peerId === remote && x.until > this.now());
        if (tomb && await hmacVerify(packet, tomb.secret, this.crypto)) {
          await this._sendSigned('remove-ack', remote, {}, tomb.secret);
          return true;
        }
        return false;
      }
      if (SIGNED_TYPES.has(packet.type)) return false;

      switch (packet.type) {
        case 'friend-request': {
          if (this.state.friends.some(x => x.peerId === remote)) return false;
          const outgoingIndex = this._find(this.state.outgoing, remote);
          if (outgoingIndex >= 0) {
            // No pedido cruzado, somente o ID lexicograficamente maior gera a chave.
            if (this.state.identity.peerId > remote) {
              if (this.state.friends.length >= MAX_FRIENDS) return false;
              const secret = makeSecret(this.crypto);
              this._setFriend(packet.fromUsername, remote, secret, false);
              if (this.state.queue.length < MAX_QUEUE) this.state.queue.push({ type: 'friend-accept', peerId: remote, username: packet.fromUsername, secret, createdAt: this.now(), lastSent: 0 });
              this._emit();
              await this._sendUnsigned('friend-accept', remote, { secret });
            } else {
              this.state.incoming = this.state.incoming.filter(x => x.peerId !== remote);
              await this._sendUnsigned('request-ack', remote, { username: this.state.identity.username });
            }
          } else {
            let incoming = this.state.incoming.find(x => x.peerId === remote);
            if (!incoming) {
              if (this.state.incoming.length >= MAX_PENDING) return false;
              incoming = { username: packet.fromUsername, peerId: remote, createdAt: this.now() };
              this.state.incoming.push(incoming);
            } else incoming.username = packet.fromUsername;
            await this._sendUnsigned('request-ack', remote, { username: this.state.identity.username });
          }
          this._emit();
          return true;
        }
        case 'friend-accept': {
          const outgoing = this.state.outgoing.find(x => x.peerId === remote);
          if (!outgoing || this.state.friends.length >= MAX_FRIENDS) return false;
          const secret = packet.data.secret.toLowerCase();
          const accepted = this._setFriend(packet.fromUsername, remote, secret, false);
          if (!accepted) return false;
          this._emit();
          await this._sendSigned('friend-confirm', remote, {}, secret);
          accepted.confirmed = true;
          this._emit();
          return true;
        }
        case 'friend-decline':
          this._removePending(remote);
          this._emit();
          await this._sendUnsigned('request-ack', remote, { action: 'friend-decline', username: this.state.identity.username });
          this._emit(); return true;
        case 'friend-cancel':
          this.state.incoming = this.state.incoming.filter(x => x.peerId !== remote);
          this._emit();
          await this._sendUnsigned('request-ack', remote, { action: 'friend-cancel', username: this.state.identity.username });
          this._emit(); return true;
        case 'request-ack':
          if (packet.data.action === 'friend-cancel' || packet.data.action === 'friend-decline') {
            this.state.queue = this.state.queue.filter(x => !(x.type === packet.data.action && x.peerId === remote));
          } else {
            const outgoing = this.state.outgoing.find(x => x.peerId === remote);
            if (outgoing && packet.data.username) outgoing.username = packet.data.username;
            this.state.queue = this.state.queue.filter(x => !(x.type === 'friend-request' && x.peerId === remote));
          }
          this._emit(); return true;
      }
      return false;
    }
    exportState() { return clone(this.state); }
  }

  return {
    VERSION, USER_RE, MAX_FRIENDS, MAX_PENDING, MAX_QUEUE, MAX_PACKET_BYTES,
    validUsername, validFriendCode, validPeerId, validSecret, usernameMatchesPeerId, normalizeCode,
    bytesToHex, hexToBytes, makePeerId, makeSecret, emptyState, normalizeState,
    canonicalPacket, hmacSign, hmacVerify, packetShape, normalizeActivity, validActivity, AccountEngine
  };
});
