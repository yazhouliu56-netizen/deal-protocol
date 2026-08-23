"use client";
import { create } from "zustand";
import { persist, type StorageValue } from "zustand/middleware";
import type { WaveBundle } from "@/types/wave-bundle";
import { getP2pTransport } from "@/base/platform/p2p/transport";
import { MOCK_RESPONDERS } from "@/lib/mockResponders";
import type { Claim, Wave } from "@/base/order/wave";
import { createOrderSlice, type OrderSlice } from "./slices/orderSlice";
import { createPaySlice, type PaySlice } from "./slices/paySlice";
import { createTrustSlice, type TrustSlice } from "./slices/trustSlice";
import { createSafeSlice, type SafeSlice } from "./slices/safeSlice";
import {
  createPlatformSlice,
  type PlatformSlice,
} from "./slices/platformSlice";

/**
 * The shared broadcast space — one zustand store persisted under a single
 * localStorage key. Cross-tab updates broadcast themselves for free via the
 * browser `storage` event (zustand persist rehydrates automatically), so a
 * second tab = a second P2P identity watching the same signal flow.
 *
 * Private identity / balance lives in `useIdentityStore` (per-tab
 * sessionStorage). This store only keeps shared, non-secret state.
 *
 * Step 3 切片拆域：本文件只做「类型合成 + persist 包装 + transport 桥」，
 * 领域实现见 ./slices/*（order/pay/trust/safe/platform 五域）。
 * 神圣约束：单一持久化键 oto-broadcast-v1、partialize 白名单与 transport
 * read-merge-write 协议 100% 保持现状；对外 State/Action 签名零破坏。
 */

export type WaveStore = WaveBundle &
  OrderSlice &
  PaySlice &
  TrustSlice &
  SafeSlice &
  PlatformSlice;

export const useWaveStore = create<WaveStore>()(
  persist(
    (...a) => ({
      // WaveBundle 权威初始值（Step 3 拆域后统一回归合成入口，slice 只补各自新增态）
      waves: [],
      claims: [],
      payOrders: [],
      responders: MOCK_RESPONDERS,
      reviews: [],
      pushes: [],
      reports: [],
      bans: {},
      favorites: [],
      initiatorBuffs: {},
      disputes: [],
      sentinelEvents: [],
      privacySessions: [],
      imThreads: [],
      imMessages: [],
      friendRequests: [],
      friendships: [],
      friendRequestRemovals: [],
      crisisRecords: [],
      forgetRequests: [],
      circuitBreaker: { state: "closed", failures: 0, probes: 0, openedAt: 0 },
      offlineQueue: [],
      lake: [],
      signedDocs: [],
      policies: [],
      bundleVer: 0,
      ...createOrderSlice(...(a as Parameters<typeof createOrderSlice>)),
      ...createPaySlice(...(a as Parameters<typeof createPaySlice>)),
      ...createTrustSlice(...(a as Parameters<typeof createTrustSlice>)),
      ...createSafeSlice(...(a as Parameters<typeof createSafeSlice>)),
      ...createPlatformSlice(...(a as Parameters<typeof createPlatformSlice>)),
    }),
    {
      name: "oto-broadcast-v1",
      // Transport-backed storage: localStorage (same device) or Supabase
      // Realtime (cross-device). zustand v5 hands us StorageValue objects.
      storage: {
        getItem: (name) => {
          if (name !== "oto-broadcast-v1") return null;
          const state = getP2pTransport().read();
          return state
            ? ({ state: state as unknown as WaveStore, version: 1 })
            : null;
        },
        setItem: (_name, value) => {
          try {
            const sv = value as StorageValue<WaveStore>;
            // 跨 tab 写回统一走 transport —— transport 内部自带
            // read-merge-write 原子防护，防止早态快照覆盖新数据。
            getP2pTransport().write(sv.state as unknown as WaveBundle);
          } catch {
            // unparsable write → drop
          }
        },
        removeItem: () =>
          getP2pTransport().write({
            waves: [],
            claims: [],
            payOrders: [],
            responders: [],
            reviews: [],
            pushes: [],
          reports: [],
          bans: {},
          favorites: [],
      initiatorBuffs: {},
      sentinelEvents: [],
      privacySessions: [],
      imThreads: [],
      imMessages: [],
          disputes: [],
          friendRequests: [],
          friendships: [],
          friendRequestRemovals: [],
          crisisRecords: [],
          forgetRequests: [],
          circuitBreaker: { state: "closed", failures: 0, probes: 0, openedAt: 0 },
          offlineQueue: [],
          lake: [],
          signedDocs: [],
          policies: [],
          bundleVer: 0,
        } satisfies WaveBundle),
      },
      version: 1,
      partialize: (s) =>
        ({
          waves: s.waves,
          claims: s.claims,
          payOrders: s.payOrders,
          responders: s.responders,
          reviews: s.reviews,
          pushes: s.pushes,
          reports: s.reports,
          bans: s.bans,
          favorites: s.favorites,
          initiatorBuffs: s.initiatorBuffs,
          disputes: s.disputes,
          // P2 缺陷 3 修复：履约回写位持久化（W5 五态流转终局落库），
          // 刷新后 SETTLED 终局不倒退回 MATCHED。
          fulfilment: s.fulfilment,
          friendRequests: s.friendRequests,
          friendships: s.friendships,
          friendRequestRemovals: s.friendRequestRemovals,
          privacySessions: s.privacySessions,
          imThreads: s.imThreads,
          imMessages: s.imMessages,
          crisisRecords: s.crisisRecords,
          forgetRequests: s.forgetRequests,
          circuitBreaker: s.circuitBreaker,
          offlineQueue: s.offlineQueue,
          lake: s.lake,
          signedDocs: s.signedDocs,
          policies: s.policies,
          bundleVer: s.bundleVer,
        }) as WaveStore,
      // Transport updates handled by module-level subscribe below.
      onRehydrateStorage: () => () => {},
    }
  )
);

// 跨 tab 广播监听：模块级注册，页面一加载即生效——
// 若挂在 onRehydrateStorage 里，listener 注册依赖 rehydrate 完成，
// 竞态下会错过另一 tab 在注册前写入的数据（E2E 间歇失败根因）。
if (typeof window !== "undefined") {
  getP2pTransport().subscribe(() => {
    useWaveStore.persist.rehydrate();
  });
}

/** In-memory virtual interest calibration (hotness padding) for the feed. */
export function displayInterest(
  realClaims: Claim[],
  wave: Wave,
  cap = 3
): number {
  const base = realClaims.length;
  const virtual = Math.min(cap, Math.max(0, wave.hotness ?? 0));
  return base + virtual;
}
