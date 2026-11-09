#!/usr/bin/env node
/* Open World Mayhem — servidor de contas e amigos.
   Sem dependências (só Node 18+). Fica na RAIZ do projeto (junto do index.html):   node server.js
   Ele também serve o jogo em http://localhost:3000, então não precisa configurar CORS nem endereço da API.
   Variáveis: PORT (3000) · HOST (0.0.0.0) · OWM_DATA (data.json) · OWM_CORS (origem permitida; padrão "*") */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');

const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = process.env.OWM_DATA || path.join(__dirname, 'data.json');
const ROOT = __dirname;
/* arquivos do servidor que ficam na raiz e NUNCA podem ser servidos pelo navegador */
const PRIVATE = new Set(['server.js', 'test.js', 'data.json', 'data.json.tmp', 'README-servidor.md', 'package.json', 'package-lock.json'].map(x => path.resolve(ROOT, x)));
PRIVATE.add(path.resolve(DATA_FILE)); PRIVATE.add(path.resolve(DATA_FILE + '.tmp'));
const CORS = process.env.OWM_CORS || '*';
const TOKEN_TTL = 30 * 864e5;      // sessão dura 30 dias
const ONLINE_MS = 60e3;            // "online" = fez qualquer requisição autenticada no último minuto
const MAX_FRIENDS = 100, MAX_PENDING = 50, MAX_SESSIONS = 8;

/* ---------- banco (arquivo JSON, gravação atômica) ---------- */
let db = { users: {}, sessions: {} };
try { db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') console.error('Falha ao ler', DATA_FILE, e.message); }
db.users = db.users || {}; db.sessions = db.sessions || {};
let dirty = false, saving = false;
function save() { dirty = true; if (!saving) flush(); }
function flush() {
  if (!dirty) return;
  dirty = false; saving = true;
  const tmp = DATA_FILE + '.tmp';
  fs.writeFile(tmp, JSON.stringify(db), err => {
    if (err) { saving = false; dirty = true; console.error('Falha ao salvar:', err.message); return; }
    fs.rename(tmp, DATA_FILE, e2 => { saving = false; if (e2) console.error('Falha ao salvar:', e2.message); if (dirty) flush(); });
  });
}
function purgeSessions() { const n = Date.now(); for (const k in db.sessions) if (db.sessions[k].exp < n) delete db.sessions[k]; }
purgeSessions();

/* ---------- util ---------- */
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => e ? rej(e) : res(k)));
const USER_RE = /^[A-Za-z0-9_]{3,16}$/;
class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }

const hits = new Map();   // limite de tentativas por IP (login/registro): 12 a cada 5 min
function limited(ip) {
  const n = Date.now(); let h = hits.get(ip);
  if (!h || h.reset < n) h = { n: 0, reset: n + 300e3 };
  h.n++; hits.set(ip, h);
  return h.n > 12;
}
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (v.reset < n) hits.delete(k); purgeSessions(); }, 600e3).unref();

function readBody(req) {
  return new Promise((res, rej) => {
    let b = '', len = 0;
    req.on('data', c => { len += c.length; if (len > 4096) { rej(new HttpError(413, 'Requisição grande demais.')); req.destroy(); } else b += c; });
    req.on('end', () => { if (!b) return res({}); try { const j = JSON.parse(b); res(j && typeof j === 'object' ? j : {}); } catch (e) { rej(new HttpError(400, 'JSON inválido.')); } });
    req.on('error', () => rej(new HttpError(400, 'Requisição inválida.')));
  });
}
function send(res, code, obj) {
  const b = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(b), 'Cache-Control': 'no-store' });
  res.end(b);
}

/* ---------- contas ---------- */
const key = n => String(n || '').trim().toLowerCase();
function newSession(uKey) {
  const own = Object.entries(db.sessions).filter(([, s]) => s.u === uKey).sort((a, b) => a[1].exp - b[1].exp);
  while (own.length >= MAX_SESSIONS) delete db.sessions[own.shift()[0]];
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions[sha(token)] = { u: uKey, exp: Date.now() + TOKEN_TTL };
  return token;
}
function authUser(req) {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '');
  if (!m) throw new HttpError(401, 'Faça login para continuar.');
  const s = db.sessions[sha(m[1])];
  if (!s || s.exp < Date.now()) throw new HttpError(401, 'Sessão expirada. Entre de novo.');
  const u = db.users[s.u];
  if (!u) throw new HttpError(401, 'Conta não encontrada.');
  const n = Date.now();
  if (n - (u.lastSeen || 0) > 10e3) { u.lastSeen = n; save(); }
  return { u, k: s.u, tokenHash: sha(m[1]) };
}
const pub = u => ({ username: u.name });

async function register(body, ip) {
  if (limited(ip)) throw new HttpError(429, 'Muitas tentativas. Espere alguns minutos.');
  const name = String(body.username || '').trim(), pw = String(body.password || '');
  if (!USER_RE.test(name)) throw new HttpError(400, 'Nome de usuário: 3 a 16 caracteres (letras, números e _).');
  if (pw.length < 8 || pw.length > 72) throw new HttpError(400, 'A senha precisa ter de 8 a 72 caracteres.');
  const k = key(name);
  if (db.users[k]) throw new HttpError(409, 'Esse nome de usuário já está em uso.');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(pw, salt)).toString('hex');
  if (db.users[k]) throw new HttpError(409, 'Esse nome de usuário já está em uso.');   // outra requisição pode ter criado durante o scrypt
  db.users[k] = { name, salt, hash, created: Date.now(), lastSeen: Date.now(), friends: [], incoming: [], outgoing: [] };
  const token = newSession(k); save();
  return { token, user: pub(db.users[k]) };
}
async function login(body, ip) {
  if (limited(ip)) throw new HttpError(429, 'Muitas tentativas. Espere alguns minutos.');
  const k = key(body.username), pw = String(body.password || '').slice(0, 200), u = db.users[k];
  const salt = u ? u.salt : '0'.repeat(32);            // mesmo custo com usuário inexistente (não revela quem tem conta)
  const hash = await scrypt(pw, salt);
  if (!u || !crypto.timingSafeEqual(hash, Buffer.from(u.hash, 'hex'))) throw new HttpError(401, 'Usuário ou senha incorretos.');
  u.lastSeen = Date.now();
  const token = newSession(k); save();
  return { token, user: pub(u) };
}

/* ---------- amizades ---------- */
const pull = (arr, v) => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); };
function view(u) {
  const n = Date.now();
  const f = u.friends.map(k => db.users[k]).filter(Boolean)
    .map(x => ({ username: x.name, online: n - (x.lastSeen || 0) < ONLINE_MS, lastSeen: x.lastSeen || 0 }))
    .sort((a, b) => (b.online - a.online) || a.username.localeCompare(b.username));
  const names = arr => arr.map(k => db.users[k]).filter(Boolean).map(x => ({ username: x.name }));
  return { me: u.name, friends: f, incoming: names(u.incoming), outgoing: names(u.outgoing), now: n };
}
function target(body, meKey) {
  const k = key(body.username), t = db.users[k];
  if (!t) throw new HttpError(404, 'Jogador não encontrado.');
  if (k === meKey) throw new HttpError(400, 'Você não pode adicionar a si mesmo.');
  return { t, k };
}
function makeFriends(a, ak, b, bk) {
  pull(a.incoming, bk); pull(a.outgoing, bk); pull(b.incoming, ak); pull(b.outgoing, ak);
  if (!a.friends.includes(bk)) a.friends.push(bk);
  if (!b.friends.includes(ak)) b.friends.push(ak);
}
function friendAction(action, a, body) {
  const { u, k } = a, { t, k: tk } = target(body, k);
  if (action === 'request') {
    if (u.friends.includes(tk)) throw new HttpError(409, 'Vocês já são amigos.');
    if (u.outgoing.includes(tk)) throw new HttpError(409, 'Você já enviou um pedido para ' + t.name + '.');
    if (u.incoming.includes(tk)) makeFriends(u, k, t, tk);                       // ele já tinha pedido: vira amizade na hora
    else {
      if (u.friends.length >= MAX_FRIENDS) throw new HttpError(400, 'Limite de amigos atingido.');
      if (u.outgoing.length >= MAX_PENDING || t.incoming.length >= MAX_PENDING) throw new HttpError(400, 'Muitos pedidos pendentes.');
      u.outgoing.push(tk); t.incoming.push(k);
    }
  } else if (action === 'accept') {
    if (!u.incoming.includes(tk)) throw new HttpError(404, 'Esse pedido não existe mais.');
    if (u.friends.length >= MAX_FRIENDS) throw new HttpError(400, 'Limite de amigos atingido.');
    makeFriends(u, k, t, tk);
  } else if (action === 'decline') { pull(u.incoming, tk); pull(t.outgoing, k); }
  else if (action === 'cancel') { pull(u.outgoing, tk); pull(t.incoming, k); }
  else if (action === 'remove') { pull(u.friends, tk); pull(t.friends, k); }
  save();
  return view(u);
}

/* ---------- API ---------- */
async function handleApi(req, res, url) {
  const ip = req.socket.remoteAddress || '?', r = url.pathname, m = req.method;
  if (m === 'POST' && r === '/api/register') return send(res, 200, await register(await readBody(req), ip));
  if (m === 'POST' && r === '/api/login') return send(res, 200, await login(await readBody(req), ip));
  const a = authUser(req);
  if (m === 'GET' && r === '/api/me') return send(res, 200, { user: pub(a.u) });
  if (m === 'POST' && r === '/api/ping') return send(res, 200, { ok: true });
  if (m === 'POST' && r === '/api/logout') { delete db.sessions[a.tokenHash]; save(); return send(res, 200, { ok: true }); }
  if (m === 'GET' && r === '/api/friends') return send(res, 200, view(a.u));
  const f = /^\/api\/friends\/(request|accept|decline|cancel|remove)$/.exec(r);
  if (m === 'POST' && f) return send(res, 200, friendAction(f[1], a, await readBody(req)));
  throw new HttpError(404, 'Rota não encontrada.');
}

/* ---------- arquivos estáticos (o jogo) ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
function serveStatic(req, res, url) {
  let p;
  try { p = decodeURIComponent(url.pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (p.includes('\0')) { res.writeHead(400); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.resolve(ROOT, '.' + p), rel = path.relative(ROOT, file);
  const hidden = rel.startsWith('..') || path.isAbsolute(rel) || PRIVATE.has(file) || rel.split(path.sep).some(s => s.startsWith('.') || s === 'node_modules');
  if (hidden) { res.writeHead(404); return res.end('Não encontrado'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Não encontrado'); }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const h = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' };
    const rg = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');   // Safari exige Range para tocar .mp3
    if (rg && (rg[1] || rg[2])) {
      let s = rg[1] ? +rg[1] : Math.max(0, st.size - +rg[2]), e = rg[1] && rg[2] ? Math.min(+rg[2], st.size - 1) : st.size - 1;
      if (s > e || s >= st.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
      res.writeHead(206, { ...h, 'Content-Range': `bytes ${s}-${e}/${st.size}`, 'Content-Length': e - s + 1 });
      return req.method === 'HEAD' ? res.end() : fs.createReadStream(file, { start: s, end: e }).pipe(res);
    }
    res.writeHead(200, { ...h, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', CORS);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    try { await handleApi(req, res, url); }
    catch (e) {
      if (e instanceof HttpError) return send(res, e.code, { error: e.message });
      console.error(e); send(res, 500, { error: 'Erro interno do servidor.' });
    }
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res, url);
});

if (require.main === module) {
  server.listen(PORT, HOST, () => console.log(`Open World Mayhem → http://localhost:${PORT}  (dados: ${DATA_FILE})`));
  const bye = () => { dirty = true; try { fs.writeFileSync(DATA_FILE, JSON.stringify(db)); } catch (e) {} process.exit(0); };
  process.on('SIGINT', bye); process.on('SIGTERM', bye);
}
module.exports = server;
