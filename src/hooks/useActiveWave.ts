"use client";
import { useMemo } from "react";
import type { Wave, WaveStatus } from "@/base/order/wave";
import { useIdentityStore } from "@/store/useIdentityStore";
import { useWaveStore } from "@/store/useWaveStore";

/**
 * 在途谓词收拢（内功单：同一“活着”定义曾散在 HomePage/Dock/AmmoPillBar 四处，
 * 改定义只改这里）。
 * 活着 = 非 closed 且非 expired。
 */
export function isLiveWaveStatus(status: WaveStatus): boolean {
  return status !== "closed" && status !== "expired";
}

/** 我作为需求方最新的一条在途 Wave（无则 null；HomePage 五态胶囊/水豚睁眼同源）。 */
export function useMyActiveWave(): Wave | null {
  const waves = useWaveStore((s) => s.waves);
  const myId = useIdentityStore((s) => s.identity.id);
  return useMemo(() => {
    const mine = waves
      .filter((w) => w.authorId === myId && isLiveWaveStatus(w.status))
      .sort((a, b) => b.createdAt - a.createdAt);
    return mine[0] ?? null;
  }, [waves, myId]);
}

/** 我是否有在途单（布尔 selector：Dock 防抖专用，waves 高频写入不重渲染）。 */
export function useHasMyActiveWave(): boolean {
  const myId = useIdentityStore((s) => s.identity.id);
  return useWaveStore((s) =>
    s.waves.some((w) => w.authorId === myId && isLiveWaveStatus(w.status)),
  );
}

/** 附近是否有活水（布尔 selector：平头哥醒睡专用）。 */
export function useHasLiveWaves(): boolean {
  return useWaveStore((s) => s.waves.some((w) => isLiveWaveStatus(w.status)));
}
