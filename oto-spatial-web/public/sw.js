/* Spatial OTO Platform - Service Worker v4
 * Strategy:
 *  - Navigation: network-first, offline fallback to newest runtime shell
 *    (kept in sync: runtime shell + its chunks are precached via PRECACHE msg).
 *  - App shell (manifest/icons/glb): cache-first.
 *  - _next/static + other same-origin: stale-while-revalidate.
 *  - Activate keeps the PREVIOUS generation alive (avoids killing chunks
 *    still referenced by an already-open tab), only older ones are purged.
 *  - Page sends { type: "PRECACHE", urls } after first load so the full
 *    JS/CSS bundle is available offline even on a cold start.
 */
const CACHE_VERSION = "spatial-oto-v4";
const APP_SHELL_CACHE = `${CACHE_VERSION}-app-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL_URLS = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/file.svg",
  "/globe.svg",
  "/window.svg",
  "/models/lounge.glb",
];

const VERSION_RE = /^spatial-oto-v(\d+)/;

function generationOf(cacheName) {
  const m = VERSION_RE.exec(cacheName);
  return m ? parseInt(m[1], 10) : 0;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const current = generationOf(CACHE_VERSION);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => {
              const gen = generationOf(key);
              // Drop caches older than the previous generation; keep the
              // previous one so already-open tabs can still fetch their chunks.
              return gen > 0 && gen < current - 1;
            })
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Page-side warm-up: cache every same-origin asset it actually used, so a
// later offline cold start (fresh HTML -> its chunks) works.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "PRECACHE" && Array.isArray(data.urls)) {
    const urls = data.urls.filter(
      (u) => new URL(u, self.location.origin).origin === self.location.origin
    );
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then((cache) =>
        cache.addAll(urls).catch(() => {
          /* individual failures are fine — SWR re-fetches later */
        })
      )
    );
  }
  if (data && data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // SPA navigation: network-first, fall back to cached shell offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            event.waitUntil(
              caches.open(RUNTIME_CACHE).then((cache) => cache.put("/", clone))
            );
          }
          return response;
        })
        .catch(() =>
          caches
            .open(RUNTIME_CACHE)
            .then((cache) => cache.match("/"))
            .then((hit) => hit || caches.match("/"))
        )
    );
    return;
  }

  // App shell assets: cache-first
  if (APP_SHELL_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Other same-origin assets (_next static, images): stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
