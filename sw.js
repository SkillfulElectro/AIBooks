const CACHE_NAME = 'books-by-ai-cache-v1';
const urlsToCache = [
  '/',
  'index.html',
  'script.js',
  'style.css',
  'manifest.json',
  'books.json',
  'Logos/AIBooks_logo.png',
  'Logos/android-chrome-192x192.png',
  'Logos/android-chrome-512x512.png',
  'Logos/apple-touch-icon.png',
  'Logos/favicon-16x16.png',
  'Logos/favicon-32x32.png',
  'Logos/favicon.ico'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          response => {
            if(!response || response.status !== 200 || response.type !== 'basic') {
              if (!response.url.includes('books/')) { // Don't cache book data if it fails
                return response;
              }
            }

            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
