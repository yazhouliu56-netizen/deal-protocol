/// <reference lib="webworker" />

import { Serwist, CacheFirst } from "serwist";

// @serwist/next 构建时校验：swSrc 必须引用 self.__SW_MANIFEST（否则构建失败）。
// 但 serwist 自己的 install 用 addAll 预缓存 manifest **任意一项失败/挂起就整体
// 卡死**（本地实测 install 永不 activate → 离线全挂）。因此只把 manifest 当作
// 数据源，预缓存由本文件自管（逐项 try/catch 容错），serwist 仅保留
// runtimeCaching（外域字体/图片）。
const MANIFEST: { url: string; revision?: string }[] = self.__SW_MANIFEST ?? [];

// 预缓存名与 serwist 托管缓存隔离（offline-precache 自管，世代清理在 activate）
const PRECACHE = "offline-precache";
const OTO_RUNTIME_CACHE = "spatial-oto-runtime";
const OTO_VERSION_RE = /^spatial-oto-v(\d+)/;
const otoGeneration = 1;

const serwist = new Serwist({
  precacheEntries: [],
  skipWaiting: true,
  clientsClaim: true,
  // navigationPreload 关闭：离线时 preload 请求行为不可靠（可能挂起不
  // settle），会让导航兜底永远等不到 result。
  navigationPreload: false,
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

// install：逐项预缓存（单项失败容忍）——addAll 任一失败/挂起会令 install
// 永不完成，SW 永不激活（离线兜底不可用）。
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      for (const { url } of MANIFEST) {
        if (!url) continue;
        try {
          await cache.add(url);
        } catch {
          /* 单项失败可接受（后续在线访问会回填） */
        }
      }
      try {
        await cache.add("/offline");
      } catch {
        /* 同上 */
      }
    })(),
  );
});

// activate：清理旧世代（自管预缓存 install 新建、activate 保留；仅清
// spatial-oto-v* 运行时缓存旧世代）
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                OTO_VERSION_RE.test(key) && !key.includes(`v${otoGeneration}-`)
            )
            .map((key) => caches.delete(key))
        )
      )
  );
});

// PRECACHE 消息（PwaServiceWorker.tsx 首屏后上报实际用到的资源 → runtime 缓存）
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

// 网络状态（事件驱动）：线上/离线事件保证离线时导航**不触碰 fetch**
// ——实测离线时 SW 导航响应上下文里的 fetch 会挂死（不 reject、超时亦难
// 中止），导航永久无响应 → net::ERR_FAILED。在线时才走网络。
// fetch：
//  - 导航：isOnline → 网络优先（fetch 失败落兜底）；离线 → 直接读
//    /offline 兜底页（绝不在离线时发起 fetch）。
//  - 同源 GET 静态资源（chunk/css/js）：缓存优先（离线可用，在线回填）。
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        // 离线（navigator.onLine === false）→ 绝不发起 fetch：实测离线时
        // 导航响应链中的 fetch 挂死不 reject（AbortSignal 亦无法中止），
        // 导航永久无响应 → net::ERR_FAILED。离线直接读缓存。
        if (self.navigator.onLine === false) {
          const cache = await caches.open(PRECACHE);
          const hit = (await cache.match(event.request.url)) ?? (await cache.match("/offline"));
          return hit ?? new Response("Offline", { status: 503 });
        }
        // 在线：网络优先；请求失败（5xx/网关）落缓存兜底
        try {
          const resp = await fetch(event.request);
          if (resp.ok) {
            const cache = await caches.open(PRECACHE);
            cache.put(event.request, resp.clone()).catch(() => {});
          }
          return resp;
        } catch {
          const cache = await caches.open(PRECACHE);
          const hit = (await cache.match(event.request.url)) ?? (await cache.match("/offline"));
          return hit ?? new Response("Offline", { status: 503 });
        }
      })(),
    );
    return;
  }
  if (event.request.method !== "GET") return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(PRECACHE);
      const hit = await cache.match(event.request);
      if (hit) return hit;
      try {
        const resp = await fetch(event.request);
        if (resp.ok) {
          cache.put(event.request, resp.clone()).catch(() => {});
        }
        return resp;
      } catch {
        return new Response("", { status: 503 });
      }
    })(),
  );
});

serwist.addEventListeners();