/* Teste do servidor:  node test.js   (usa um arquivo de dados temporário e uma porta livre) */
'use strict';
const os = require('os'), path = require('path'), fs = require('fs'), assert = require('assert');
const tmp = path.join(os.tmpdir(), 'owm-test-' + process.pid + '.json');
process.env.OWM_DATA = tmp;
const server = require('./server.js');

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = async (p, { method = 'GET', body, token, headers = {} } = {}) => {
    const h = { ...headers };
    if (body) h['Content-Type'] = 'application/json';
    if (token) h.Authorization = 'Bearer ' + token;
    const r = await fetch(base + p, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
    return { s: r.status, j, t, r };
  };
  let n = 0; const ok = (name, f) => f().then(() => console.log('  ✓', name), e => { console.error('  ✗', name, '\n   ', e.message); process.exitCode = 1; }).then(() => n++);

  let A, B, C;
  await ok('registra contas', async () => {
    let r = await call('/api/register', { method: 'POST', body: { username: 'Enzo', password: 'senha-forte-1' } }); assert.equal(r.s, 200); A = r.j.token; assert.equal(r.j.user.username, 'Enzo');
    r = await call('/api/register', { method: 'POST', body: { username: 'Maria_7', password: 'outra-senha-2' } }); assert.equal(r.s, 200); B = r.j.token;
    r = await call('/api/register', { method: 'POST', body: { username: 'Joao', password: 'mais-uma-senha' } }); assert.equal(r.s, 200); C = r.j.token;
  });
  await ok('rejeita nome repetido (sem diferenciar maiúsculas), nome inválido e senha curta', async () => {
    assert.equal((await call('/api/register', { method: 'POST', body: { username: 'enzo', password: 'senha-forte-1' } })).s, 409);
    assert.equal((await call('/api/register', { method: 'POST', body: { username: 'a b', password: 'senha-forte-1' } })).s, 400);
    assert.equal((await call('/api/register', { method: 'POST', body: { username: 'Novo', password: '123' } })).s, 400);
  });
  await ok('login certo e errado; senha não fica em texto puro no arquivo', async () => {
    assert.equal((await call('/api/login', { method: 'POST', body: { username: 'ENZO', password: 'senha-forte-1' } })).s, 200);
    assert.equal((await call('/api/login', { method: 'POST', body: { username: 'Enzo', password: 'errada-errada' } })).s, 401);
    assert.equal((await call('/api/login', { method: 'POST', body: { username: 'ninguem', password: 'errada-errada' } })).s, 401);
    await new Promise(r => setTimeout(r, 300));
    const raw = fs.readFileSync(tmp, 'utf8'); assert(!raw.includes('senha-forte-1'));
  });
  await ok('rotas protegidas exigem token', async () => {
    assert.equal((await call('/api/friends')).s, 401);
    assert.equal((await call('/api/friends', { token: 'a'.repeat(64) })).s, 401);
    assert.equal((await call('/api/me', { token: A })).j.user.username, 'Enzo');
  });
  await ok('pedido → aceitar → os dois aparecem como amigos', async () => {
    let r = await call('/api/friends/request', { method: 'POST', token: A, body: { username: 'maria_7' } });
    assert.equal(r.s, 200); assert.equal(r.j.outgoing[0].username, 'Maria_7');
    assert.equal((await call('/api/friends/request', { method: 'POST', token: A, body: { username: 'Maria_7' } })).s, 409);
    r = await call('/api/friends', { token: B }); assert.equal(r.j.incoming[0].username, 'Enzo');
    r = await call('/api/friends/accept', { method: 'POST', token: B, body: { username: 'Enzo' } });
    assert.equal(r.j.friends[0].username, 'Enzo'); assert.equal(r.j.friends[0].online, true); assert.equal(r.j.incoming.length, 0);
    r = await call('/api/friends', { token: A }); assert.equal(r.j.friends[0].username, 'Maria_7'); assert.equal(r.j.outgoing.length, 0);
  });
  await ok('pedido cruzado vira amizade; recusar e cancelar limpam as listas', async () => {
    await call('/api/friends/request', { method: 'POST', token: A, body: { username: 'Joao' } });
    let r = await call('/api/friends/request', { method: 'POST', token: C, body: { username: 'Enzo' } });
    assert.equal(r.j.friends.length, 1); assert.equal(r.j.incoming.length, 0);
    await call('/api/friends/remove', { method: 'POST', token: A, body: { username: 'Joao' } });
    await call('/api/friends/request', { method: 'POST', token: C, body: { username: 'Enzo' } });
    r = await call('/api/friends/decline', { method: 'POST', token: A, body: { username: 'Joao' } });
    assert.equal(r.j.incoming.length, 0); assert.equal((await call('/api/friends', { token: C })).j.outgoing.length, 0);
    await call('/api/friends/request', { method: 'POST', token: C, body: { username: 'Enzo' } });
    r = await call('/api/friends/cancel', { method: 'POST', token: C, body: { username: 'Enzo' } });
    assert.equal(r.j.outgoing.length, 0); assert.equal((await call('/api/friends', { token: A })).j.incoming.length, 0);
  });
  await ok('validações: a si mesmo, inexistente, aceitar sem pedido', async () => {
    assert.equal((await call('/api/friends/request', { method: 'POST', token: A, body: { username: 'Enzo' } })).s, 400);
    assert.equal((await call('/api/friends/request', { method: 'POST', token: A, body: { username: 'fantasma' } })).s, 404);
    assert.equal((await call('/api/friends/accept', { method: 'POST', token: A, body: { username: 'Joao' } })).s, 404);
  });
  await ok('remover amizade vale para os dois lados', async () => {
    await call('/api/friends/remove', { method: 'POST', token: B, body: { username: 'Enzo' } });
    assert.equal((await call('/api/friends', { token: A })).j.friends.length, 0);
    assert.equal((await call('/api/friends', { token: B })).j.friends.length, 0);
  });
  await ok('logout invalida o token', async () => {
    assert.equal((await call('/api/logout', { method: 'POST', token: C })).s, 200);
    assert.equal((await call('/api/me', { token: C })).s, 401);
  });
  await ok('CORS (preflight) responde 204', async () => {
    const r = await call('/api/login', { method: 'OPTIONS' }); assert.equal(r.s, 204); assert.equal(r.r.headers.get('access-control-allow-origin'), '*');
  });
  await ok('estáticos: serve o jogo, bloqueia server.js, data.json, dotfiles e ../', async () => {
    assert.equal((await call('/')).s, 200);
    assert.equal((await call('/data.json')).s, 404);
    assert.equal((await call('/server.js')).s, 404);
    assert.equal((await call('/test.js')).s, 404);
    assert.equal((await call('/README-servidor.md')).s, 404);
    assert.equal((await call('/%2e%2e/%2e%2e/etc/passwd')).s, 404);
    assert.equal((await call('/..%2f..%2fetc/passwd')).s, 404);
  });
  await ok('estáticos: Range (necessário para áudio no Safari)', async () => {
    const f = fs.readdirSync(__dirname).find(x => x.endsWith('.mp3'));
    if (!f) return;
    const r = await call('/' + f, { headers: { Range: 'bytes=0-99' } }); assert.equal(r.s, 206); assert.equal(r.r.headers.get('content-length'), '100');
  });

  console.log(n + ' grupos de teste executados' + (process.exitCode ? ' — COM FALHAS' : ' — tudo certo'));
  server.close(); try { fs.unlinkSync(tmp); } catch (e) {}
  setTimeout(() => process.exit(process.exitCode || 0), 100);
})();
