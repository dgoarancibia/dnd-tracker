const CACHE = 'dnd-tracker-v318';

// IMPORTANTE: app.html e index.html NO se cachean aquí intencionalmente.
// Si se cachean, el SW viejo puede servir el HTML viejo y el nuevo SW nunca
// llega a detectarse. El HTML siempre va a red → el SW nuevo se instala → reload.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll([
      './manifest.json',
      './css/style.css',
      './js/app.js',
      './js/characters.js',
      './js/storage.js',
      './js/cloud.js',
      './js/biblioteca.js',
      './js/maps.js',
      './js/export_pdf.js',
      './CharacterSheet_template.pdf',
      './icons/favicon.png',
    ])).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => {
        // Notificar a todos los clientes que el SW nuevo está activo
        self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
          clients.forEach(c => c.postMessage({ type: 'SW_ACTIVATED', version: 318 }));
        });
      })
  );
});

// Permite activación inmediata desde el cliente
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  // Cliente pregunta la versión del SW activo
  if (e.data && e.data.type === 'GET_VERSION') {
    e.source.postMessage({ type: 'SW_VERSION', version: 318 });
  }
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Nunca interceptar Firebase, Firestore ni Auth — son dinámicos y causan errores de caché
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    (url.hostname.includes('gstatic.com') && url.pathname.includes('firebasejs'))
  ) return;

  // NUNCA cachear los HTML principales — siempre van a red para detectar SW nuevo
  if (url.pathname.endsWith('/') ||
      url.pathname.endsWith('/app.html') ||
      url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // pdf.js CDN — cache-first (necesario para Biblioteca offline)
  if (url.hostname.includes('cdnjs.cloudflare.com') && url.pathname.includes('pdf')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res.ok) {
          const toCache = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, toCache));
        }
        return res;
      }).catch(() => caches.match(e.request)))
    );
    return;
  }

  // Google Fonts — cache-first (solo si respuesta ok)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res.ok && res.status < 400) {
          const toCache = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, toCache));
        }
        return res;
      }).catch(() => new Response('', { status: 503 })))
    );
    return;
  }

  // Solo cachear GETs con protocolo http/https
  if (e.request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // Archivos JS/CSS con ?v= — network-first SIEMPRE
  if (url.search && url.search.startsWith('?v=')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok && res.status < 400) {
          const toCache = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, toCache));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Todos los demás — network-first, cae a caché si offline
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && res.status < 400) {
        const toCache = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, toCache));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
