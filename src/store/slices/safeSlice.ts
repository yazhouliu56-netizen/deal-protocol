/**
 * SafeSlice（Step 3 切片拆域）：SOS 危机干预、隐私号会话、
 * 遗忘权申请、风控甄检审计流。
 */
"use client";

import type { StateCreator } from "zustand";
import { useIdentityStore } from "@/store/useIdentityStore";
import {
  allocatePair,
  revokeSession,
  DEMO_POOL,
} from "@/base/comm/privacyNumber";
import {
  notifyFor as notifyForLogic,
  raiseCrisis as raiseCrisisLogic,
  resolveCrisis as resolveCrisisLogic,
  type CrisisLevel,
  type CrisisRecord,
} from "@/base/safe/crisis";
import {
  packageSosForensicSnapshot,
} from "@/base/safe/crisis-tracker";
import {
  requestForget as requestForgetLogic,
  type ForgetKind,
  type ForgetRequest,
} from "@/base/safe/privacy";
import {
  snapshotGeoTrail,
} from "@/adapters/device/geo-tracker";
import { drainAudioVault as drainRecorderChunks } from "@/adapters/device/audio-recorder";
import {
  enqueue as enqueueOp,
} from "@/base/platform/offlineQueue";
import type { WaveStore } from "../useWaveStore";

export interface SafeSlice {
  /** ADR-0010：隐私号会话分配（订单锁定后，48h 双向）。 */
  allocatePrivacy: (waveId: string, aId: string, bId: string) => void;
  /** ADR-0010：订单终局 → 销毁隐私会话。 */
  revokePrivacy: (waveId: string) => void;
  /** ADR-0013：SOS 危机干预 —— 登记 + EPA 通知 + 处置闭环（幂等）。 */
  raiseCrisis: (p: {
    level: CrisisLevel;
    note: string;
    waveId?: string;
    /** 紧急联系人名单（通知对象展示用）。 */
    contacts: string[];
  }) => { record?: CrisisRecord; targets: string[] };
  resolveCrisis: (id: string) => void;
  /** ADR-0013：遗忘权申请（幂等合并 pending）。 */
  requestForget: (kind: ForgetKind) => { req?: ForgetRequest; fresh: boolean };
}

export const createSafeSlice: StateCreator<WaveStore, [], [], SafeSlice> = (
  set,
  get
) => ({
  allocatePrivacy: (waveId, aId, bId) =>
    set((s) => {
      const r = allocatePair(s.privacySessions, DEMO_POOL, waveId, aId, bId, Date.now());
      return { privacySessions: r.sessions };
    }),

  revokePrivacy: (waveId) =>
    set((s) => ({ privacySessions: revokeSession(s.privacySessions, waveId, Date.now()) })),

  raiseCrisis: ({ level, note, waveId, contacts }) => {
    const s = get();
    const { record } = raiseCrisisLogic(
      s.crisisRecords,
      useIdentityStore.getState().identity.id,
      level,
      note,
      Date.now(),
      waveId
    );
    // P1-3 一键 SOS 联动：自动封装司法证据快照（轨迹面包屑 + 录音切片指纹；
    // 无 GPS / 无麦克风 / Headless 环境 100% 静默降级为 NO_GPS_DATA 空包，红线 5）。
    const snapshot = packageSosForensicSnapshot({
      level,
      breadcrumbs: snapshotGeoTrail(),
      audioChunks: drainRecorderChunks(),
      crisisId: record!.id,
      userId: record!.userId,
      orderNo: waveId,
      now: Date.now(),
    });
    const withSnapshot: CrisisRecord = { ...record!, forensicSnapshot: snapshot };
    const { record: notified, targets } = notifyForLogic(withSnapshot, contacts);
    set((st) => ({
      crisisRecords: [
        ...st.crisisRecords.map((r) => (r.id === notified!.id ? notified! : r)),
        notified!,
      ],
    }));
    // 异步上报 /api/sos/trigger（服务端权威哈希重算固化）；离线/失败自动入 offlineQueue 补报。
    const body = {
      userId: notified!.userId,
      crisisId: notified!.id,
      level: notified!.level,
      note: notified!.note,
      waveId: waveId ?? null,
      snapshot,
    };
    const enqueueReport = () =>
      set((st) => {
        const out = enqueueOp(
          st.offlineQueue,
          {
            kind: "sos-report",
            payload: JSON.stringify({
              path: "/api/sos/trigger",
              idempotencyKey: snapshot.snapshotId,
              body,
            }),
          },
          Date.now()
        );
        return { offlineQueue: out.q };
      });
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      enqueueReport();
    } else {
      void fetch("/api/sos/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((res) => {
          if (!res.ok) enqueueReport();
        })
        .catch(enqueueReport);
    }
    return { record: notified!, targets };
  },

  resolveCrisis: (id) =>
    set((s) => ({ crisisRecords: resolveCrisisLogic(s.crisisRecords, id, Date.now()) })),

  requestForget: (kind) => {
    const s = get();
    const out = requestForgetLogic(
      s.forgetRequests,
      useIdentityStore.getState().identity.id,
      kind,
      Date.now()
    );
    if (out.fresh) set({ forgetRequests: out.requests });
    return { req: out.req, fresh: out.fresh };
  },
});
