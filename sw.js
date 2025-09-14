const CACHE_NAME = 'orfeus-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/imgs/orfeus_logo.png',
  '/imgs/logo_img.png',
  '/imgs/accessibility-icon.png',
  '/imgs/disc_img.png',
  '/imgs/tonearm_img.png',
  '/imgs/mic_off_icon.png',
  '/imgs/mic_on_icon.png',
  '/imgs/close_icon.png',
  '/imgs/seta_icon.png',
  '/imgs/course_icon.png',
  '/imgs/instru_icon.png',
  '/imgs/rank_icon.png',
  '/imgs/afina_icon.png',
  '/imgs/agudo_grave.jpg',
  '/imgs/armadura_img.jpg',
  '/imgs/clave_img.jpg',
  '/imgs/compasso_img.jpg',
  '/imgs/figs.jpg',
  '/imgs/helipa_img.jpg',
  '/imgs/partitura.jpg',
  '/imgs/gmail.png',
  '/imgs/afina_album.png',
  '/imgs/cursos_album.png',
  '/imgs/instru_album.png',
  '/imgs/rank_album.png',
  '/fonts/ITC_Franklin.otf',
  '/fonts/ITC_FranklinBOLD.otf'
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
