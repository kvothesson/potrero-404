// Potrero 404 instalado como app: con internet siempre se trae la versión nueva del sitio
// (así se actualiza sola) y se guarda una copia; sin internet se usa la copia, para la práctica.
// No se tocan las salas online, el ranking ni los scripts de Google y Cloudflare.
const CACHE = 'potrero404-v1';
const BASE = new URL('./', self.location).pathname;
const PRIMERO = ['', 'index.html', 'manifest.webmanifest', 'iconos/icono-192.png', 'src/main.js'].map((p) => BASE + p);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRIMERO)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (url.pathname.startsWith(BASE + 'metricas')) return;
  e.respondWith((async () => {
    try {
      const r = await fetch(e.request, { cache: 'no-cache' });
      if (r.ok) { const c = await caches.open(CACHE); c.put(e.request, r.clone()); }
      return r;
    } catch {
      const guardada = await caches.match(e.request, { ignoreSearch: true });
      return guardada || caches.match(BASE + 'index.html');
    }
  })());
});
