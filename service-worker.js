const CACHE_NAME = 'medsolution-pwa-v15';
const APP_SHELL = [
  '/',
  '/index.html',
  '/assets/css/styles.css',
  '/assets/css/components.css',
  '/assets/css/dashboard.css',
  '/assets/images/medsolution-logo.png',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png',
  '/assets/icons/icon-192x192-maskable.png',
  '/assets/icons/icon-512x512-maskable.png',
  '/assets/icons/icon-180x180.png',
  '/assets/icons/icon-144x144.png',
  '/assets/icons/icon-96x96.png',
  '/assets/icons/icon-72x72.png',
  '/assets/icons/icon-48x48.png',
  '/assets/icons/icon-32x32.png',
  '/assets/icons/icon-16x16.png',
  '/assets/icons/favicon.ico',
  '/assets/js/main.js',
  '/assets/js/auth.js',
  '/assets/js/login-startup.js',
  '/assets/js/pwa.js',
  '/pages/dashboard.html',
  '/pages/reports.html',
  '/assets/js/patient-movements.js',
  '/assets/js/reports.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Always fetch the install manifest fresh so a stale worker cache cannot
  // influence orientation or other metadata during a later installation.
  if (url.pathname === '/manifest.json') {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      });
      return cached || network;
    })
  );
});
