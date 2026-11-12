const CACHE = 'dnd-tracker-v542';

// IMPORTANTE: app.html e index.html NO se cachean aquí intencionalmente.
// Si se cachean, el SW viejo puede servir el HTML viejo y el nuevo SW nunca
// llega a detectarse. El HTML siempre va a red → el SW nuevo se instala → reload.
self.addEventListener('install', e => {
  e.waitUntil(
    // Solo archivos livianos y garantizados: si UNO falta, addAll falla
    // entero y el SW nunca se instala (sin offline ni actualizaciones).
    // La plantilla PDF oficial (14 MB) se descarga al exportar, no aquí.
    caches.open(CACHE).then(cache => cache.addAll([
      './manifest.json',
      './css/style.css',
      './js/app.js',
      './js/hojas.js',
      './js/bastion.js',
      './js/tema.js',
      './css/tema.css',
      './css/pergamino.css',
      './js/iconos.js',
      './js/mesa.js',
      './css/mesa.css',
      './css/onix.css',
      './assets/onix/escudo.svg',
      './assets/onix/esquina-bl.svg',
      './assets/onix/esquina-br.svg',
      './assets/onix/esquina-tl.svg',
      './assets/onix/esquina-tr.svg',
      './assets/onix/filigrana.svg',
      './assets/onix/linea.svg',
      './assets/onix/marco-activo.svg',
      './assets/onix/marco.svg',
      './assets/onix/retrato.svg',
      './assets/iconos/ataques.svg',
      './assets/iconos/bastion.svg',
      './assets/iconos/biblioteca.svg',
      './assets/iconos/car.svg',
      './assets/iconos/clase-barbaro.svg',
      './assets/iconos/clase-bardo.svg',
      './assets/iconos/clase-brujo.svg',
      './assets/iconos/clase-clerigo.svg',
      './assets/iconos/clase-druida.svg',
      './assets/iconos/clase-explorador.svg',
      './assets/iconos/clase-guerrero.svg',
      './assets/iconos/clase-hechicero.svg',
      './assets/iconos/clase-mago.svg',
      './assets/iconos/clase-monje.svg',
      './assets/iconos/clase-paladin.svg',
      './assets/iconos/clase-picaro.svg',
      './assets/iconos/combate.svg',
      './assets/iconos/companero.svg',
      './assets/iconos/cuaderno.svg',
      './assets/iconos/nota.svg',
      './assets/iconos/bestia-cielo.svg',
      './assets/iconos/bestia-mar.svg',
      './assets/iconos/con.svg',
      './assets/iconos/cond-agarrado.svg',
      './assets/iconos/cond-agotamiento.svg',
      './assets/iconos/cond-apresado.svg',
      './assets/iconos/cond-asustado.svg',
      './assets/iconos/cond-aturdido.svg',
      './assets/iconos/cond-cegado.svg',
      './assets/iconos/cond-derribado.svg',
      './assets/iconos/cond-ensordecido.svg',
      './assets/iconos/cond-envenenado.svg',
      './assets/iconos/cond-hechizado.svg',
      './assets/iconos/cond-incapacitado.svg',
      './assets/iconos/cond-inconsciente.svg',
      './assets/iconos/cond-invisible.svg',
      './assets/iconos/cond-paralizado.svg',
      './assets/iconos/cond-petrificado.svg',
      './assets/iconos/condiciones.svg',
      './assets/iconos/conjuros.svg',
      './assets/iconos/d10.svg',
      './assets/iconos/d12.svg',
      './assets/iconos/d20.svg',
      './assets/iconos/d4.svg',
      './assets/iconos/d6.svg',
      './assets/iconos/d8.svg',
      './assets/iconos/des.svg',
      './assets/iconos/eco.svg',
      './assets/iconos/estadisticas.svg',
      './assets/iconos/fue.svg',
      './assets/iconos/habilidades.svg',
      './assets/iconos/int.svg',
      './assets/iconos/items.svg',
      './assets/iconos/recursos.svg',
      './assets/iconos/sab.svg',
      './assets/iconos/salvaciones.svg',
      './assets/iconos/skills.svg',
      './assets/iconos/vacio-diario.svg',
      './assets/iconos/vacio-mapa.svg',
      './assets/pergamino/arma-arco.svg',
      './assets/pergamino/arma-daga.svg',
      './assets/pergamino/arma-espada.svg',
      './assets/pergamino/arma-generica.svg',
      './assets/pergamino/arma-hacha.svg',
      './assets/pergamino/arma-lanza.svg',
      './assets/pergamino/arma-maza.svg',
      './assets/pergamino/estandarte.svg',
      './assets/pergamino/huella.svg',
      './assets/pergamino/medallon-cielo.svg',
      './assets/pergamino/medallon-generico.svg',
      './assets/pergamino/medallon-mar.svg',
      './assets/pergamino/medallon-tierra.svg',
      './assets/pergamino/montanas.svg',
      './assets/pergamino/papel.svg',
      './assets/pergamino/remache-bl.svg',
      './assets/pergamino/remache-br.svg',
      './assets/pergamino/remache-tr.svg',
      './assets/pergamino/remache.svg',
      './js/vendor/tiptap.min.js',
      './js/characters.js',
      './js/storage.js',
      './js/cloud.js',
      './js/biblioteca.js',
      './js/maps.js',
      './js/roll20_es.js',
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
          clients.forEach(c => c.postMessage({ type: 'SW_ACTIVATED', version: 542 }));
        });
      })
  );
});

// Permite activación inmediata desde el cliente
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  // Cliente pregunta la versión del SW activo
  if (e.data && e.data.type === 'GET_VERSION') {
    e.source.postMessage({ type: 'SW_VERSION', version: 542 });
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
      url.pathname.endsWith('/ficha.html') ||
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
