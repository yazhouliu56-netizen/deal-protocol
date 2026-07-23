import { Serwist, CacheFirst } from "serwist";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  disableDevLogs: true,
  runtimeCaching: [
    { matcher: /^https?:\/\/.*\.(woff2?|ttf|otf|eot)\?.*$/, handler: new CacheFirst(), method: "GET" },
    { matcher: /^https?:\/\/.*\.(png|jpg|jpeg|gif|svg|webp|ico)\?.*$/, handler: new CacheFirst(), method: "GET" },
    { matcher: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*$/, handler: new CacheFirst(), method: "GET" },
  ],
});

self.addEventListener("install", () => {
  caches.open("offline-fallback").then((cache) => { cache.add("/offline"); });
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      try {
        const preloadResp = await event.preloadResponse;
        if (preloadResp) return preloadResp;
        return await fetch(event.request);
      } catch {
        const cache = await caches.open("offline-fallback");
        const cached = await cache.match("/offline");
        return cached ?? new Response("Offline", { status: 503 });
      }
    })(),
  );
});

serwist.addEventListeners();
