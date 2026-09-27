"use client";

/**
 * 强制守护 Watchdog 客户端钩子（ADR-0022）：
 * 60s 节拍上传位置面包屑（watchPosition 优先，拒授权/无 GPS 退手动模式），
 * 电池上下文只做缺口解释，不断案；失败静默（宪法 #10），UI 保最后已知态。
 * 浏览器永不上报 gpsEnabled:false（权限拒绝 ≠ 关 GPS，不造 TAMPER 误报）。
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface GuardSideState {
  state: "LIVE" | "DEGRADED" | "LOST" | "TAMPER";
  reasons: string[];
  at: number;
  lastSeenMs: number;
  batteryLow: boolean;
  checkin: boolean;
  lat: number | null;
  lng: number | null;
}

export interface GuardWatch {
  self: GuardSideState | null;
  peer: GuardSideState | null;
  serverNow: number | null;
  loading: boolean;
  /** 无定位能力（拒授权/无 GPS）→ 仅手动报平安。 */
  manualMode: boolean;
  batteryLow: boolean;
  batteryLevel: number | null;
  checkingIn: boolean;
  checkin: () => Promise<void>;
}

const POLL_MS = 60_000;
const UPLOAD_GAP_MS = 55_000;

type BatteryLike = { level: number; charging: boolean };

async function readBattery(): Promise<{ low: boolean; level: number | null }> {
  try {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<BatteryLike>;
    };
    if (typeof nav.getBattery !== "function") return { low: false, level: null };
    const b = await nav.getBattery();
    const level = typeof b.level === "number" ? b.level : null;
    const low = level != null && level < 0.2 && b.charging !== true;
    return { low, level };
  } catch {
    return { low: false, level: null };
  }
}

export function useGuardWatch(demandId: string | null): GuardWatch {
  const [self, setSelf] = useState<GuardSideState | null>(null);
  const [peer, setPeer] = useState<GuardSideState | null>(null);
  const [serverNow, setServerNow] = useState<number | null>(null);
  // 门禁同式（react-hooks/set-state-in-effect）：以下三态全部惰性初始化，
  // effect 内只做订阅与异步回调，不做同步 setState。
  const [loading, setLoading] = useState<boolean>(() => demandId != null);
  const [manualMode, setManualMode] = useState<boolean>(
    () => typeof navigator === "undefined" || !navigator.geolocation,
  );
  const [batteryLow, setBatteryLow] = useState<boolean>(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [checkingIn, setCheckingIn] = useState<boolean>(false);
  const lastUploadRef = useRef<number>(0);
  const batteryRef = useRef<{ low: boolean }>({ low: false });
  const demandRef = useRef<string | null>(demandId);

  const refresh = useCallback(async () => {
    const id = demandRef.current;
    if (!id) return;
    try {
      const res = await fetch(`/api/guard/state?demandId=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const json = (await res.json()) as {
        self?: GuardSideState | null;
        peer?: GuardSideState | null;
        serverNow?: number;
      };
      if (json.self !== undefined) setSelf(json.self);
      if (json.peer !== undefined) setPeer(json.peer);
      if (typeof json.serverNow === "number") setServerNow(json.serverNow);
    } catch {
      /* 静默：保最后已知态 */
    }
  }, []);

  const upload = useCallback(
    async (p: { lat?: number; lng?: number; accuracyM?: number; checkin?: boolean }) => {
      const id = demandRef.current;
      if (!id) return;
      try {
        const res = await fetch("/api/guard/breadcrumb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            demandId: id,
            ...p,
            batteryLow: batteryRef.current.low,
            gpsEnabled: null,
          }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          self?: GuardSideState | null;
          peer?: GuardSideState | null;
          serverNow?: number;
        };
        if (json.self !== undefined) setSelf(json.self);
        if (json.peer !== undefined) setPeer(json.peer);
        if (typeof json.serverNow === "number") setServerNow(json.serverNow);
      } catch {
        /* 静默：60s 后重试 */
      }
    },
    [],
  );

  const checkin = useCallback(async () => {
    if (!demandRef.current || checkingIn) return;
    setCheckingIn(true);
    try {
      await upload({ checkin: true });
    } finally {
      setCheckingIn(false);
    }
  }, [checkingIn, upload]);

  useEffect(() => {
    demandRef.current = demandId;
    if (!demandId) {
      return;
    }
    let alive = true;
    let watchId: number | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    void readBattery().then((b) => {
      if (!alive) return;
      batteryRef.current = { low: b.low };
      setBatteryLow(b.low);
      setBatteryLevel(b.level);
    });

    void refresh().finally(() => {
      if (alive) setLoading(false);
    });
    timer = setInterval(() => {
      void refresh();
    }, POLL_MS);

    const geo = navigator.geolocation;
    // 无 GPS（manualMode 惰性初值已为 true）此处不再同步 setState；仅有 GPS 才订阅。
    if (geo) {
      try {
        watchId = geo.watchPosition(
          (pos) => {
            const now = Date.now();
            if (now - lastUploadRef.current < UPLOAD_GAP_MS) return;
            lastUploadRef.current = now;
            void upload({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracyM: pos.coords.accuracy,
            });
          },
          () => {
            if (alive) setManualMode(true);
          },
          { enableHighAccuracy: true, timeout: 15_000, maximumAge: 55_000 },
        );
      } catch {
        // watchPosition 同步抛（极罕见）：递延至异步回调，避开
        // react-hooks/set-state-in-effect 门禁（语义不变）。
        setTimeout(() => {
          if (alive) setManualMode(true);
        }, 0);
      }
    }

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      if (watchId != null) {
        try {
          geo?.clearWatch(watchId);
        } catch {
          /* ignore */
        }
      }
    };
  }, [demandId, refresh, upload]);

  return { self, peer, serverNow, loading, manualMode, batteryLow, batteryLevel, checkingIn, checkin };
}
