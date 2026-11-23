/* Service Worker — Open World Mayhem
   Guarda tudo no aparelho: scripts, texturas, sons, modelos, fontes e bibliotecas do CDN. */

// Troque este número quando substituir uma textura/som/modelo mantendo o MESMO nome de arquivo.
const ASSET_VERSION = 'v6';
const ASSET_CACHE = 'owm-assets-' + ASSET_VERSION; // imagens, sons, modelos, CDN (cache primeiro)
const CODE_CACHE  = 'owm-code-stbb-ui-v11';                    // html/js/css do jogo (atualiza sozinho)

const PRECACHE = [
  './', 'index.html', 'style.css?v=9', 'accounts.css', 'stbb-ui.css?v=9', 'dash-icon.png',
  'core.js?v=panorama2', 'shaders.js', 'survival.js', 'river-logic.js', 'music.js', 'knife.js',
  'stoneknife.js', 'weapon.js', 'postprocess.js', 'bioflorest.js', 'biodesert.js',
  'zombie.js', 'punch-clips.js', 'sword-clips.js', 'joseph.js', 'avatar.js?v=bones17-idle2',
  'animeditor.js', 'animstudio.js', 'fish.js', 'car.js', 'shadowman.js', 'minigames.js',
  'lobby-data.js', 'game.js', 'flight-ui.js', 'accounts-core.js', 'accounts.js', 'multiplayer.js',
  'hud-customizer.js'
];

const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/EffectComposer.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/RenderPass.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/ShaderPass.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/CopyShader.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/LuminosityHighPassShader.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/UnrealBloomPass.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/TransformControls.js',
  'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js',
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap'
];

const CODE_EXT = /\.(?:html|js|css|json|webmanifest)$/i;
const pendingFull = new Set();

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const code = await caches.open(CODE_CACHE);
    const assets = await caches.open(ASSET_CACHE);
    // um arquivo que falhe não derruba a instalação
    await Promise.all([
      ...PRECACHE.map((u) => code.add(u).catch(() => {})),
      ...CDN.map((u) => assets.add(new Request(u, { mode: 'no-cors' })).catch(() => {}))
    ]);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = [ASSET_CACHE, CODE_CACHE];
    for (const k of await caches.keys()) {
      if (k.startsWith('owm-') && !keep.includes(k)) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
  return res;
}

// Mostra o que está salvo na hora e atualiza em segundo plano (vale na próxima abertura)
async function staleWhileRevalidate(req, cacheName, event) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const update = fetch(req).then((res) => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  if (hit) { event.waitUntil(update); return hit; }
  return (await update) || Response.error();
}

// Áudio pede pedaços (Range); a Cache API não guarda 206, então baixamos o arquivo inteiro uma vez
async function rangeFromCache(req, event) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(req.url);
  if (!hit) {
    if (!pendingFull.has(req.url)) {
      pendingFull.add(req.url);
      event.waitUntil(cache.add(req.url).catch(() => {}).then(() => pendingFull.delete(req.url)));
    }
    return fetch(req);
  }
  const buf = await hit.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  let start = m && m[1] ? +m[1] : 0;
  let end = m && m[2] ? +m[2] : buf.byteLength - 1;
  end = Math.min(end, buf.byteLength - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': hit.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + buf.byteLength,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes'
    }
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!/^https?:$/.test(url.protocol)) return;

  // Multiplayer/PeerJS (servidor de sinalização) nunca passa pelo cache
  if (/peerjs\.com$/.test(url.hostname)) return;

  if (url.origin !== location.origin) {
    // CDN e fontes: versões fixas, então cache primeiro
    if (/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname)) {
      e.respondWith(cacheFirst(req, ASSET_CACHE));
    }
    return;
  }

  if (req.headers.has('range')) { e.respondWith(rangeFromCache(req, e)); return; }

  if (req.mode === 'navigate' || CODE_EXT.test(url.pathname)) {
    e.respondWith(staleWhileRevalidate(req, CODE_CACHE, e));
  } else {
    e.respondWith(cacheFirst(req, ASSET_CACHE)); // png, jpg, webp, mp3, glb, ...
  }
});
