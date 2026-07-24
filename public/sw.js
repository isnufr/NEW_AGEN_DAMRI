const CACHE_NAME = 'agen-damri-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/app.js',
  '/logo.png',
  '/logobiru.webp'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // Hanya intercept GET request (jangan cache API atau POST)
  if (event.request.method !== 'GET' || event.request.url.includes('/api')) {
      return;
  }
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
