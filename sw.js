// Cache-first para assets locales, network-first para HTML
const CACHE = 'dnd-tracker-v5';
const STATIC = [
  '/dnd-tracker/',
  '/dnd-tracker/app.html',
  '/dnd-tracker/index.html',
  '/dnd-tracker/manifest.json',
  '/dnd-tracker/css/style.css',
  '/dnd-tracker/js/app.js',
  '/dnd-tracker/js/characters.js',
  '/dnd-tracker/js/storage.js',
  '/dnd-tracker/icons/icon-192.png',
  '/dnd-tracker/icons/icon-512.png',
  '/dnd-tracker/icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Google Fonts — cache-first
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // HTML — network-first para recibir actualizaciones
  if (e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // JS/CSS/imágenes — cache-first, actualiza en background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return res;
      });
      return cached || fetchPromise;
    })
  );
});
