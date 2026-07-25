const CACHE_NAME = 'agen-damri-cache-v7';
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
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request).then(networkResponse => {
          // Jangan cache response yang tidak valid
          if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors' && networkResponse.type !== 'opaque')) {
            return networkResponse;
          }
          
          let responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
            
          return networkResponse;
        }).catch(() => {
          // Jika gagal fetch (misal offline), kita bisa mengembalikan fallback
          // karena ini asset/cdn, biarkan saja
        });
      })
  );
});
