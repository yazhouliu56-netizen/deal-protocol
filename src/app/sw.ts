/// <reference lib="webworker" />

import { Serwist, CacheFirst } from "serwist";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  disableDevLogs: true,
  runtimeCaching: [
    {
      matcher: /^https?:\/\/.*\.(woff2?|ttf|otf|eot)\?.*$/,
      handler: new CacheFirst(),
      method: "GET",
    },
    {
      matcher: /^https?:\/\/.*\.(png|jpg|jpeg|gif|svg|webp|ico)\?.*$/,
      handler: new CacheFirst(),
      method: "GET",
    },
    {
      matcher: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*$/,
      handler: new CacheFirst(),
      method: "GET",
    },
  ],
});

self.addEventListener("install", () => {
  void caches.open("offline-fallback").then((cache) => {
    void cache.add("/offline");
  });
});

// ─── 子项目 oto-spatial-web 手写 public/sw.js 合入（D-07 裁决）───
// oto 客户端（PwaServiceWorker.tsx）在首屏后上报实际用过的资源，预缓存到
// runtime 缓存，保证离线冷启动（新 HTML → 其 chunk）可用。缓存名带
// spatial-oto- 前缀与 serwist 托管缓存隔离，世代清理仅在 activate 时
// 保留上一代（已开标签页仍引用旧 chunk）。
const OTO_RUNTIME_CACHE = "spatial-oto-runtime";
const OTO_VERSION_RE = /^spatial-oto-v(\d+)/;
const otoGeneration = 1;

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => OTO_VERSION_RE.test(key) && !key.includes(`v${otoGeneration}-`))
            .map((key) => caches.delete(key))
        )
      )
  );
});

self.addEventListener("message", (event) => {
  const data = event.data as { type?: string; urls?: string[] } | null;
  if (!data) return;
  if (data.type === "PRECACHE" && Array.isArray(data.urls)) {
    const urls = data.urls.filter(
      (u) => new URL(u, self.location.origin).origin === self.location.origin
    );
    event.waitUntil(
      caches.open(OTO_RUNTIME_CACHE).then((cache) =>
        cache.addAll(urls).catch(() => {
          /* 个别失败可接受（后续 SWR 会再取） */
        })
      )
    );
  }
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// PWA 真推（PushEnableBar → /api/push/send → web-push）：展示通知 + 点击聚焦。
self.addEventListener("push", (event) => {
  const payload = event.data?.json?.() as
    | { title?: string; body?: string; tag?: string; icon?: string; url?: string }
    | undefined;
  const title = payload?.title ?? "Spatial OTO";
  const options: NotificationOptions = {
    body: payload?.body ?? "",
    tag: payload?.tag,
    icon: payload?.icon ?? "/icon-512.png",
    data: { url: payload?.url ?? "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
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
