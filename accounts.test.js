'use strict';
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const Core = require('./accounts-core.js');

const cryptoRef = webcrypto;
const id = (name, suffix) => `${name}-${suffix}`;
function state(name, peerId) { return Core.emptyState({ username: name, peerId }); }

async function fixture() {
  const engines = new Map();
  const transports = new Map();
  const offline = new Set();
  function transportFor(localPeerId) {
    return async (remotePeerId, packet) => {
      const destination = engines.get(remotePeerId);
      if (!destination || offline.has(localPeerId) || offline.has(remotePeerId)) throw new Error('peer offline');
      // Entrega assíncrona para simular o canal de dados WebRTC.
      await Promise.resolve();
      await destination.receive(structuredClone(packet), localPeerId);
    };
  }
  function add(name, peerId) {
    const engine = new Core.AccountEngine(state(name, peerId), {
      crypto: cryptoRef,
      transport: transportFor(peerId),
      now: () => Date.now()
    });
    engines.set(peerId, engine);
    transports.set(peerId, engine);
    return engine;
  }
  return { add, engines, transports, setOffline(peerId, value) { if (value) offline.add(peerId); else offline.delete(peerId); } };
}

async function makeFriends(a, b) {
  const result = await a.request(b.state.identity.peerId);
  assert.equal(result.ok, true);
  assert.equal(b.state.incoming.length, 1);
  const accepted = await b.accept(a.state.identity.peerId);
  assert.equal(accepted.ok, true);
  assert.equal(a.state.friends.length, 1);
  assert.equal(b.state.friends.length, 1);
  assert.equal(a.state.friends[0].secret, b.state.friends[0].secret);
  assert.equal(a.state.friends[0].confirmed, true);
  assert.equal(b.state.friends[0].confirmed, true);
}

async function run() {
  // Geração e validação de código/nome.
  assert.equal(Core.validUsername('Enzo_01'), true);
  assert.equal(Core.validUsername('ab'), false);
  assert.equal(Core.validUsername('nome com espaço'), false);
  const generated = Core.makePeerId('_abc', cryptoRef);
  assert.match(generated, /^U_ABC-[A-Z0-9]{4}$/);
  assert.equal(Core.validFriendCode(generated), true);
  assert.equal(Core.validFriendCode('abc-123'), false);

  // Pedido -> aceitar -> amizade e troca real de segredo HMAC.
  {
    const f = await fixture();
    const a = f.add('Alice', id('ALICE', 'A1B2'));
    const b = f.add('Beto', id('BETO', 'C3D4'));
    await makeFriends(a, b);
    const signed = { v: 1, type: 'ping', fromPeerId: b.state.identity.peerId, toPeerId: a.state.identity.peerId, fromUsername: 'Beto', ts: Date.now(), nonce: 'a1'.repeat(12), data: {} };
    signed.mac = await Core.hmacSign(signed, a.state.friends[0].secret, cryptoRef);
    assert.equal(await a.receive(signed, b.state.identity.peerId), true, 'ping com HMAC válido aceito');
    assert.equal(b.state.friends[0].online, true);
  }

  // Pedido cruzado: dois pedidos simultâneos viram amizade sem ação manual.
  {
    const f = await fixture();
    const a = f.add('Alice', id('ALICE', 'A1B2'));
    const b = f.add('Beto', id('BETO', 'C3D4'));
    const results = await Promise.all([
      a.request(b.state.identity.peerId),
      b.request(a.state.identity.peerId)
    ]);
    assert.ok(results.every(x => x.ok));
    assert.equal(a.state.friends.length, 1);
    assert.equal(b.state.friends.length, 1);
    assert.equal(a.state.friends[0].secret, b.state.friends[0].secret);
    assert.equal(a.state.outgoing.length, 0);
    assert.equal(b.state.outgoing.length, 0);
  }

  // Recusar pedido remove o envio no solicitante.
  {
    const f = await fixture();
    const a = f.add('Alice', id('ALICE', 'A1B2'));
    const b = f.add('Beto', id('BETO', 'C3D4'));
    await a.request(b.state.identity.peerId);
    assert.equal(b.state.incoming.length, 1);
    await b.decline(a.state.identity.peerId);
    assert.equal(b.state.incoming.length, 0);
    assert.equal(a.state.outgoing.length, 0);
  }

  // Cancelar pedido remove a entrada que já chegou ao destinatário.
  {
    const f = await fixture();
    const a = f.add('Alice', id('ALICE', 'A1B2'));
    const b = f.add('Beto', id('BETO', 'C3D4'));
    await a.request(b.state.identity.peerId);
    await a.cancel(b.state.identity.peerId);
    assert.equal(a.state.outgoing.length, 0);
    assert.equal(b.state.incoming.length, 0);
  }

  // Aceitação que falha na rede fica em fila e termina no próximo retry.
  {
    const f = await fixture();
    const a = f.add('Alice', id('ALICE', 'A1B2'));
    const b = f.add('Beto', id('BETO', 'C3D4'));
    await a.request(b.state.identity.peerId);
    f.setOffline(b.state.identity.peerId, true);
    await b.accept(a.state.identity.peerId);
    assert.equal(b.state.queue.some(x => x.type === 'friend-accept'), true);
    f.setOffline(b.state.identity.peerId, false);
    await b.retryQueued(true);
    assert.equal(a.state.friends.length, 1);
    assert.equal(b.state.queue.some(x => x.type === 'friend-accept'), false);
    assert.equal(b.state.friends[0].confirmed, true);
  }

  // Recusa enviada com o solicitante offline também permanece na fila.
  {
    const f = await fixture();
    const a = f.add('Alice', id('ALICE', 'A1B2'));
    const b = f.add('Beto', id('BETO', 'C3D4'));
    await a.request(b.state.identity.peerId);
    f.setOffline(a.state.identity.peerId, true);
    await b.decline(a.state.identity.peerId);
    assert.equal(b.state.queue.some(x => x.type === 'friend-decline'), true);
    f.setOffline(a.state.identity.peerId, false);
    await b.retryQueued(true);
    assert.equal(a.state.outgoing.length, 0);
    assert.equal(b.state.queue.some(x => x.type === 'friend-decline'), false);
  }

  // Cancelamento enviado com o destinatário offline é entregue depois.
  {
    const f = await fixture();
    const a = f.add('Alice', id('ALICE', 'A1B2'));
    const b = f.add('Beto', id('BETO', 'C3D4'));
    await a.request(b.state.identity.peerId);
    f.setOffline(b.state.identity.peerId, true);
    await a.cancel(b.state.identity.peerId);
    assert.equal(a.state.queue.some(x => x.type === 'friend-cancel'), true);
    f.setOffline(b.state.identity.peerId, false);
    await a.retryQueued(true);
    assert.equal(b.state.incoming.length, 0);
    assert.equal(a.state.queue.some(x => x.type === 'friend-cancel'), false);
  }

  // Remover amizade propaga evento assinado e recebe confirmação assinada.
  {
    const f = await fixture();
    const a = f.add('Alice', id('ALICE', 'A1B2'));
    const b = f.add('Beto', id('BETO', 'C3D4'));
    await makeFriends(a, b);
    await a.remove(b.state.identity.peerId);
    assert.equal(a.state.friends.length, 0);
    assert.equal(b.state.friends.length, 0);
    assert.equal(a.state.queue.filter(x => x.type === 'friend-remove').length, 0);
    assert.equal(b.state.tombstones.length, 1);
  }

  // Remoção para amigo offline fica no backup e é entregue depois.
  {
    const f = await fixture();
    const a = f.add('Alice', id('ALICE', 'A1B2'));
    const b = f.add('Beto', id('BETO', 'C3D4'));
    await makeFriends(a, b);
    f.setOffline(b.state.identity.peerId, true);
    await a.remove(b.state.identity.peerId);
    assert.equal(a.state.queue.some(x => x.type === 'friend-remove'), true);
    const restored = Core.normalizeState(a.exportState());
    assert.equal(restored.queue.some(x => x.type === 'friend-remove'), true, 'fila de remoção deve sobreviver ao backup');
    f.setOffline(b.state.identity.peerId, false);
    await a.retryQueued(true);
    assert.equal(b.state.friends.length, 0);
    assert.equal(a.state.queue.some(x => x.type === 'friend-remove'), false);
  }

  // Mensagem com assinatura inválida é ignorada sem alterar a amizade.
  {
    const f = await fixture();
    const a = f.add('Alice', id('ALICE', 'A1B2'));
    const b = f.add('Beto', id('BETO', 'C3D4'));
    await makeFriends(a, b);
    const forged = { v: 1, type: 'friend-remove', fromPeerId: b.state.identity.peerId, toPeerId: a.state.identity.peerId, fromUsername: 'Beto', ts: Date.now(), nonce: 'b2'.repeat(12), data: {}, mac: '0'.repeat(64) };
    assert.equal(await a.receive(forged, b.state.identity.peerId), false);
    assert.equal(a.state.friends.length, 1);
  }

  // Limites e sanitização durante importação.
  {
    const base = state('Alice', id('ALICE', 'A1B2'));
    base.outgoing = Array.from({ length: 60 }, (_, i) => ({ username: 'User' + String(i).padStart(2, '0'), peerId: id('USER' + String(i).padStart(2, '0'), String(i).padStart(4, '0')) }));
    base.incoming = Array.from({ length: 55 }, (_, i) => ({ username: 'In' + String(i).padStart(2, '0'), peerId: id('IN' + String(i).padStart(2, '0'), String(i).padStart(4, '0')) }));
    const normalized = Core.normalizeState(base);
    assert.equal(normalized.outgoing.length, Core.MAX_PENDING);
    assert.equal(normalized.incoming.length, Core.MAX_PENDING);
    const overFriends = state('Alice', id('ALICE', 'A1B2'));
    overFriends.friends = Array.from({ length: 105 }, (_, i) => ({ username: 'Friend' + String(i).padStart(2, '0'), peerId: id('FRIEND' + String(i).padStart(2, '0'), String(i).padStart(4, '0')), secret: 'a'.repeat(64) }));
    assert.equal(Core.normalizeState(overFriends).friends.length, Core.MAX_FRIENDS);
  }

  // Fila offline: pedido fica salvo; quando o destinatário aparece, o retry conclui o pedido.
  {
    const f = await fixture();
    const a = f.add('Alice', id('ALICE', 'A1B2'));
    const bId = id('BETO', 'C3D4');
    await a.request(bId);
    assert.equal(a.state.queue.length, 1);
    const b = f.add('Beto', bId);
    await a.retryQueued(true);
    assert.equal(b.state.incoming.length, 1);
    assert.equal(a.state.queue.length, 0);
  }

  // Exportar/importar conserva identidade, amigos, segredos e fila.
  {
    const f = await fixture();
    const a = f.add('Alice', id('ALICE', 'A1B2'));
    const b = f.add('Beto', id('BETO', 'C3D4'));
    await makeFriends(a, b);
    const exported = a.exportState();
    const imported = Core.normalizeState(JSON.parse(JSON.stringify(exported)));
    assert.equal(imported.identity.peerId, exported.identity.peerId);
    assert.equal(imported.friends[0].username, exported.friends[0].username);
    assert.equal(imported.friends[0].online, false, 'presença deve ser revalidada após importar');
    assert.equal(imported.queue.length, exported.queue.length);
    assert.equal(imported.friends[0].secret, b.state.friends[0].secret);
    assert.equal(imported.identity.peerId, a.state.identity.peerId);
  }

  // Fila de sincronização cheia: nenhuma ação é concluída sem espaço para notificá-la.
  {
    const full = state('Alice', id('ALICE', 'A1B2'));
    full.incoming = [{ username: 'Beto', peerId: id('BETO', 'C3D4'), createdAt: Date.now() }];
    full.outgoing = [{ username: 'Caio', peerId: id('CAIO', 'E5F6'), createdAt: Date.now() }];
    full.friends = [{ username: 'Duda', peerId: id('DUDA', 'G7H8'), secret: 'a'.repeat(64), confirmed: true }];
    full.queue = Array.from({ length: Core.MAX_QUEUE }, (_, i) => ({
      type: 'friend-cancel', peerId: `P${i.toString(36).toUpperCase().padStart(3, '0')}-AB12`, createdAt: Date.now()
    }));
    const engine = new Core.AccountEngine(full, { crypto: cryptoRef });
    const beforeFriends = engine.state.friends.length;
    assert.equal((await engine.request(id('ENZO', 'J9K0'))).ok, false);
    assert.equal((await engine.accept(id('BETO', 'C3D4'))).ok, false);
    assert.equal((await engine.decline(id('BETO', 'C3D4'))).ok, false);
    assert.equal((await engine.cancel(id('CAIO', 'E5F6'))).ok, false);
    assert.equal((await engine.remove(id('DUDA', 'G7H8'))).ok, false);
    assert.equal(engine.state.queue.length, Core.MAX_QUEUE);
    assert.equal(engine.state.friends.length, beforeFriends);
    assert.equal(engine.state.incoming.length, 1);
    assert.equal(engine.state.outgoing.length, 1);
  }

  // Duplicatas e mensagens acima do limite são descartadas.
  {
    const f = await fixture();
    const a = f.add('Alice', id('ALICE', 'A1B2'));
    const b = f.add('Beto', id('BETO', 'C3D4'));
    const request = { v: 1, type: 'friend-request', fromPeerId: b.state.identity.peerId, toPeerId: a.state.identity.peerId, fromUsername: 'Beto', ts: Date.now(), nonce: 'c3'.repeat(12), data: {} };
    assert.equal(await a.receive(request, b.state.identity.peerId), true);
    assert.equal(await a.receive(request, b.state.identity.peerId), false);
    const huge = { ...request, nonce: 'd4'.repeat(12), data: { text: 'x'.repeat(Core.MAX_PACKET_BYTES + 1) } };
    assert.equal(await a.receive(huge, b.state.identity.peerId), false);
  }

  console.log('OK — todos os testes de contas P2P passaram.');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
