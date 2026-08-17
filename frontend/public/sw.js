// Simple Service Worker for caching proxied images and uploads
const CACHE_NAME = 'ffdb-runtime-images-v1';
const IMAGE_URL_PATTERNS = ['/api/image-proxy', '/uploads/'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function shouldHandleRequest(url) {
  try {
    const u = new URL(url);
    return IMAGE_URL_PATTERNS.some((p) => u.pathname.startsWith(p));
  } catch (e) {
    return false;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!shouldHandleRequest(request.url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    // No cached copy: fetch from network, cache and return
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        // Only cache image-like responses
        const contentType = response.headers.get('content-type') || '';
        if (contentType.startsWith('image/')) {
          await cache.put(request, response.clone());
        }
      }
      return response;
    } catch (err) {
      // Network failed and no cache: respond with 503
      return new Response('Network error', { status: 503, statusText: 'Network error' });
    }
  })());
});
