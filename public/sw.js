const CACHE_NAME = 'damri-cache-v31';
const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/app.js',
  '/logo.png',
  '/logobiru.webp',
  'https://cdn.tailwindcss.com?v=2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js?v=2'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Hanya intercept GET request (jangan cache API atau POST)
  if (event.request.method !== 'GET' || event.request.url.includes('/api')) {
      return;
  }
  
  // Gunakan strategi "Network First, fallback to Cache" agar selalu mendapat update terbaru
  event.respondWith(
    fetch(event.request).then(networkResponse => {
      // Simpan ke cache jika response valid
      if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors' || networkResponse.type === 'opaque')) {
        let responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
      }
      return networkResponse;
    }).catch(() => {
      // Jika offline atau gagal fetch, ambil dari cache
      return caches.match(event.request);
    })
  );
});
