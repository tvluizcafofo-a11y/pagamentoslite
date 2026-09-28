/* Service Worker — Sistema de Pagamentos (Lite / 100% local) */
const VERSAO = 'v1.0.0';
const CACHE  = 'sistema-pagamentos-' + VERSAO;

/* Recursos do "app shell" — se algum não existir, é ignorado (allSettled). */
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './offline.html',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

/* Instala: pré-cacheia o app shell */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.allSettled(APP_SHELL.map(u => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

/* Ativa: limpa caches antigos */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(chaves =>
      Promise.all(
        chaves.filter(k => k.startsWith('sistema-pagamentos-') && k !== CACHE)
              .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* Estratégias de fetch */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // não intercepta terceiros

  // Navegação (HTML) → network-first, cai para cache, depois offline.html
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then(resp => {
          const copia = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
          return resp;
        })
        .catch(() =>
          caches.match(req).then(hit => hit || caches.match('./offline.html'))
        )
    );
    return;
  }

  // Demais assets → cache-first (rápido e offline)
  event.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copia = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
        }
        return resp;
      }).catch(() => caches.match('./offline.html'));
    })
  );
});

/* Permite "pular espera" quando o app pedir (opcional) */
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});