"use client";
import { useCallback, useEffect, useState } from "react";

type PushState =
  | "unsupported"
  | "idle"
  | "denied"
  | "asking"
  | "subscribed"
  | "error";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * PWA 真推（LAUNCH-GAP E 组）：浏览器通知授权 + pushManager 订阅 +
 * /api/push/subscribe 后端登记（幂等 upsert by endpoint）。被动消息
 * OTO_PUSH_RESUBSCRIBE（sw pushsubscriptionchange 广播）→ 自动重订阅。
 */
export default function PushEnableBar() {
  const capable =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;
  const [state, setState] = useState<PushState>(capable ? "idle" : "unsupported");
  const [msg, setMsg] = useState("");

  const syncSubscription = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setState("idle");
        return;
      }
      const keys = sub.toJSON() as { p256dh?: string; auth?: string };
      if (!keys.p256dh || !keys.auth) {
        setState("idle");
        return;
      }
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!j.ok && j.error === "push-table-not-configured") {
        setState("error");
        setMsg("云端订阅表未配置——管理员在 Supabase SQL Editor 执行迁移后可用");
        return;
      }
      setState(j.ok ? "subscribed" : "error");
    } catch {
      setState("unsupported");
    }
  }, []);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "OTO_PUSH_RESUBSCRIBE") void syncSubscription();
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    const t = setTimeout(() => void syncSubscription(), 0);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMsg);
      clearTimeout(t);
    };
  }, [syncSubscription]);

  const enable = async () => {
    setMsg("");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setState("denied");
      setMsg("通知权限被拒绝——可在浏览器站点设置中重新允许");
      return;
    }
    setState("asking");
    const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!pubKey) {
      setState("error");
      setMsg("VAPID 公钥未配置（服务端缺失 NEXT_PUBLIC_VAPID_PUBLIC_KEY）");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(pubKey) as BufferSource,
        }));
      const keys = sub.toJSON() as { p256dh?: string; auth?: string };
      if (!keys.p256dh || !keys.auth) {
        setState("error");
        setMsg("订阅对象缺少加密密钥（浏览器版本过旧）");
        return;
      }
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!j.ok && j.error === "push-table-not-configured") {
        setState("error");
        setMsg("云端订阅表未配置——管理员在 Supabase SQL Editor 执行迁移后可用");
        return;
      }
      setState(j.ok ? "subscribed" : "error");
    } catch {
      setState("error");
      setMsg("订阅失败：浏览器阻止或服务端无响应");
    }
  };

  const sendTest = async () => {
    setMsg("");
    const res = await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "OTO 空间协议",
        body: "这就是 PWA 真推（VAPID）——浏览器关闭也能收到",
        tag: "oto-demo",
        url: "/",
      }),
    });
    const j = (await res.json()) as { ok: boolean; error?: string; sent?: number };
    setMsg(
      j.ok ? `已推送 ${j.sent ?? 0} 台设备` : `推送失败：${j.error ?? "未知"}`
    );
  };

  if (state === "unsupported") {
    return null;
  }

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold text-white/85">
            📡 PWA 真推
            <span
              className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[8.5px] font-extrabold ${
                state === "subscribed"
                  ? "bg-emerald-400/15 text-emerald-300"
                  : "bg-white/[0.05] text-white/40"
              }`}
            >
              {state === "subscribed"
                ? "推送已订阅"
                : state === "denied"
                  ? "权限被拒"
                  : state === "asking"
                    ? "订阅中…"
                    : state === "error"
                      ? "异常"
                      : "未开启"}
            </span>
          </p>
          <p className="text-[9px] text-white/40 mt-0.5">
            浏览器通知：关闭页面也能收到局信号 · 订阅记录当前端（endpoint）
          </p>
        </div>
        {state === "subscribed" ? (
          <button
            onClick={sendTest}
            className="shrink-0 px-3 py-2 rounded-xl bg-brandCyan/15 border border-brandCyan/40 text-[10px] font-bold text-brandCyan"
          >
            发送测试
          </button>
        ) : (
          <button
            onClick={enable}
            disabled={state === "asking"}
            className="shrink-0 px-3 py-2 rounded-xl bg-brandPurple/20 border border-brandPurple/50 text-[10px] font-bold text-brandPurple disabled:opacity-40"
          >
            {state === "denied" ? "重试" : "开启"}
          </button>
        )}
      </div>
      {msg && <p className="text-[9px] text-white/45 mt-1.5">{msg}</p>}
    </div>
  );
}