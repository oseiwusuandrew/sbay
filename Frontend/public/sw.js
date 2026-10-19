/**
 * sBay Service Worker — Network-first with offline fallback.
 *
 * Strategy:
 * - Navigation & app assets: network-first (always fetch fresh, cache as backup).
 * - API calls: network-only (never cached).
 * - Images/fonts: stale-while-revalidate (serve cached, update in background).
 * - Offline: serve cached index.html for navigation requests.
 *
 * To force an update: change SW_VERSION below. The new SW will install,
 * purge old caches, and take over immediately.
 */
const SW_VERSION = 'v-1792450191743';
const CACHE_NAME = `sbay-${SW_VERSION}`;
const OFFLINE_URLS = ['/', '/index.html', '/favicon.svg', '/logo.png'];

// Install — pre-cache critical shell, activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate — purge all old caches, claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
  // Notify all clients that a new version is active
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }));
  });
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip cross-origin requests entirely (API calls, CDN, etc.)
  // Letting the browser handle them avoids CORS / preflight issues.
  if (url.origin !== self.location.origin) return;

  // API calls — always network, never cache
  if (url.pathname.startsWith('/api/')) {
    return event.respondWith(fetch(request));
  }

  // Navigation requests (HTML pages) — network-first
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // JS/CSS assets (hashed filenames) — cache-first (immutable, instant on repeat visits)
  if (request.destination === 'script' || request.destination === 'style' ||
      url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Images/fonts — stale-while-revalidate
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Everything else — network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Listen for skip-waiting message from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
