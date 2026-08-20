"use client";
import { useEffect, useState } from "react";

export default function PwaServiceWorker() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    const precacheUsed = async () => {
      // Warm the runtime cache with the assets this very page used, so a
      // later offline cold start has its chunk bundle available.
      const urls = performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .filter(
          (u) =>
            u.startsWith(window.location.origin + "/_next/static") ||
            u.startsWith(window.location.origin + "/models/")
        );
      if (urls.length > 0 && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "PRECACHE",
          urls: [...new Set(urls)],
        });
      }
    };

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        // New build deployed → new SW takes over → surface a refresh prompt.
        let reloading = false;
        navigator.serviceWorker?.addEventListener("controllerchange", () => {
          if (reloading) return;
          reloading = true;
          setUpdateReady(true);
        });
        if (reg.waiting) {
          // A newer SW is already waiting (built during this session).
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
          setUpdateReady(true);
        }
      } catch (error) {
        console.error("[PWA] Service worker registration failed:", error);
      }
    };
    register();
    // After stable: cache the chunks this build used.
    window.addEventListener("load", () => setTimeout(precacheUsed, 4000));
  }, []);

  if (!updateReady) return null;
  return (
    <button
      onClick={() => window.location.reload()}
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[70] glass-panel rounded-full px-4 py-2 text-xs font-bold text-brandCyan shadow-2xl glow-purple animate-pulse"
      aria-label="刷新以使用新版本"
    >
      ✨ 已更新，点击刷新使用新版本
    </button>
  );
}