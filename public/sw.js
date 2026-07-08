// Service Worker for Dance Manager PWA Installability
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let the browser fetch directly from the network.
  // This satisfies the PWA installability criteria without cache-desync risks.
  event.respondWith(fetch(event.request));
});
