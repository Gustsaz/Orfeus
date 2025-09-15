const CACHE_NAME = 'orfeus-v1';
const urlsToCache = [
  '/Orfeus-main/',
  '/Orfeus-main/index.html',
  '/Orfeus-main/style.css',
  '/Orfeus-main/script.js',
  '/Orfeus-main/manifest.json',
  '/Orfeus-main/imgs/orfeus_logo.png',
  '/Orfeus-main/imgs/logo_img.png',
  '/Orfeus-main/imgs/accessibility-icon.png',
  '/Orfeus-main/imgs/disc_img.png',
  '/Orfeus-main/imgs/tonearm_img.png',
  '/Orfeus-main/imgs/mic_off_icon.png',
  '/Orfeus-main/imgs/mic_on_icon.png',
  '/Orfeus-main/imgs/close_icon.png',
  '/Orfeus-main/imgs/seta_icon.png',
  '/Orfeus-main/imgs/course_icon.png',
  '/Orfeus-main/imgs/instru_icon.png',
  '/Orfeus-main/imgs/rank_icon.png',
  '/Orfeus-main/imgs/afina_icon.png',
  '/Orfeus-main/imgs/agudo_grave.jpg',
  '/Orfeus-main/imgs/armadura_img.jpg',
  '/Orfeus-main/imgs/clave_img.jpg',
  '/Orfeus-main/imgs/compasso_img.jpg',
  '/Orfeus-main/imgs/figs.jpg',
  '/Orfeus-main/imgs/helipa_img.jpg',
  '/Orfeus-main/imgs/partitura.jpg',
  '/Orfeus-main/imgs/gmail.png',
  '/Orfeus-main/imgs/afina_album.png',
  '/Orfeus-main/imgs/cursos_album.png',
  '/Orfeus-main/imgs/instru_album.png',
  '/Orfeus-main/imgs/rank_album.png',
  '/Orfeus-main/fonts/ITC_Franklin.otf',
  '/Orfeus-main/fonts/ITC_FranklinBOLD.otf'
];

// Instalar o service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Ativar o service worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Interceptar requisições
self.addEventListener('fetch', event => {
  // Não interceptar requisições de API externas (Firebase, etc.)
  if (event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('firebase') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('youtube.com') ||
      event.request.url.includes('tonejs.github.io') ||
      event.request.url.includes('unpkg.com') ||
      event.request.url.includes('gstatic.com')) {
    return; // Deixa passar sem cache
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna do cache se disponível, senão busca na rede
        return response || fetch(event.request);
      })
  );
});
