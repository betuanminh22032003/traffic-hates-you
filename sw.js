// Offline support. The build id in CACHE is filled in by vite.config.js, so every release gets a fresh cache.
const CACHE = 'thy-mv0egmqs';
self.addEventListener('install', (e) => {
  // the build fills in the list of every file the game needs, so it works offline right after the first visit
  const files = ["./","./manifest.webmanifest","./icons/icon-192.png","./assets/apple-touch-icon-KLJQvTsg.png","./assets/baloo-2-latin-600-normal-tIfxVoAe.woff2","./assets/baloo-2-latin-800-normal-BbF3Etk1.woff2","./assets/baloo-2-latin-ext-800-normal-C_Iwmf1s.woff2","./assets/baloo-2-vietnamese-600-normal-C5EqHgu0.woff2","./assets/baloo-2-vietnamese-800-normal-ConLnEgt.woff2","./assets/game-BV_uQ55E.js","./assets/game-COYdVd_P.css","./assets/icon-192-D82viFzQ.png","./assets/manifest-A16bP3iT.webmanifest"];
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(Array.isArray(files) ? files : ['./'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// The page sends the URLs it loaded before this worker took control.
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'precache') return;
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(e.data.urls.map((u) => c.match(u, { ignoreVary: true }).then((hit) => hit || fetch(u).then((r) => r.ok && c.put(u, r)).catch(() => {}))))));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('./', copy)); } return r; }).catch(() => caches.match('./', { ignoreVary: true, ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return r;
  })));
});
