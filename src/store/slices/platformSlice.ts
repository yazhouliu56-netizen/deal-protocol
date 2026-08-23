/**
 * PlatformSlice（Step 3 切片拆域）：IM 通信、离线事务队列、
 * 权威库 write-behind 同步、自然语言 BI。
 */
"use client";

import type { StateCreator } from "zustand";
import { markRead, sendMsg } from "@/base/comm/im";
import {
  due as queueDue,
  enqueue as enqueueOp,
  markPlayed as markQueuePlayed,
  type QueueOp,
} from "@/base/platform/offlineQueue";
import { parseBiQuery, runBi, type BiResult, type BiRow } from "@/base/ai/bi";
import type { WaveStore } from "../useWaveStore";

/**
 * Step 2 接电：权威库冲刷器（fire-and-forget 单条）。
 * 409 视为幂等语义内的成功（并发已提交 / 版本已被他人推进）。
 */
async function flushOrderOp(item: QueueOp): Promise<boolean> {
  try {
    const { path, body, idempotencyKey } = JSON.parse(item.payload) as {
      path: string;
      body: unknown;
      idempotencyKey?: string;
    };
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    });
    return res.ok || res.status === 409;
  } catch {
    return false;
  }
}

export interface PlatformSlice {
  /** ADR-0010：IM 私信发送（自动建线程 + 未读）。 */
  sendIm: (fromId: string, toId: string, text: string, waveId?: string) => void;
  /** ADR-0010：IM 标记已读。 */
  markImRead: (threadId: string, whoId: string) => void;
  /** ADR-0011：自然语言 BI —— 本地解析中文统计查询（聊天页接线）。 */
  askBi: (text: string) => BiResult | null;
  /** ADR-0014：重放离线队列（在线恢复/手动触发）。 */
  replayQueue: () => Promise<void>;
  /**
   * Step 2 接电：权威库 write-behind 同步器 —— 本地乐观先行，异步落权威库；
   * 失败/离线自动入 offlineQueue（幂等键防服务端重复），replayQueue 追平。
   */
  syncOrderOp: (op: QueueOp) => void;
}

export const createPlatformSlice: StateCreator<
  WaveStore,
  [],
  [],
  PlatformSlice
> = (set, get) => ({
  sendIm: (fromId, toId, text, waveId) => {
    // 弱网离线队列（ADR-0014 N11 接线）：离线时消息入队缓冲，恢复后重放。
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      set((s) => {
        const payload = JSON.stringify({ fromId, toId, text, waveId: waveId ?? null });
        const out = enqueueOp(s.offlineQueue, { kind: "sendIm", payload }, Date.now());
        return { offlineQueue: out.q };
      });
      return;
    }
    set((s) => {
      const r = sendMsg(s.imThreads, s.imMessages, fromId, toId, text, Date.now(), waveId);
      return { imThreads: r.threads, imMessages: r.messages };
    });
  },

  syncOrderOp: (op) => {
    // 先入队（幂等去重：同 kind+payload 未完成不重复）再立即冲刷
    const { q, item } = enqueueOp(get().offlineQueue, op, Date.now());
    set({ offlineQueue: q });
    void flushOrderOp(op).then((ok) => {
      set({ offlineQueue: markQueuePlayed(get().offlineQueue, item.id, ok, Date.now()) });
    });
  },

  replayQueue: async () => {
    const s = get();
    const items = queueDue(s.offlineQueue, Date.now());
    if (items.length === 0) return;
    let queue = s.offlineQueue;
    const stillOffline =
      typeof navigator !== "undefined" && navigator.onLine === false;
    for (const item of items) {
      let ok = !stillOffline;
      if (ok) {
        if (
          item.op.kind === "order-publish" ||
          item.op.kind === "order-transition"
        ) {
          // Step 2 接电：权威库同步 op 走真实网络冲刷（幂等键防服务端重复）
          ok = await flushOrderOp(item.op);
        } else {
          const payload = JSON.parse(item.op.payload) as {
            fromId: string;
            toId: string;
            text: string;
            waveId: string | null;
          };
          get().sendIm(payload.fromId, payload.toId, payload.text, payload.waveId ?? undefined);
        }
      }
      queue = markQueuePlayed(queue, item.id, ok, Date.now());
    }
    set({ offlineQueue: queue });
  },

  markImRead: (threadId, whoId) =>
    set((s) => ({ imThreads: markRead(s.imThreads, threadId, whoId) })),

  askBi: (text) => {
    const s = get();
    if (!/违约|收益|收入|流水|评价|评分|裂变|争议|成交|统计|汇总|数据情况|多少单|几个需求|几个局/.test(text)) {
      return null;
    }
    const rows: BiRow[] = [];
    for (const w of s.waves) {
      rows.push({
        authorId: w.authorId,
        category: w.basics.category,
        createdAt: w.createdAt,
        fissionCount: w.fissionCount,
      });
    }
    for (const c of s.claims) {
      const w = s.waves.find((x) => x.id === c.waveId);
      rows.push({
        authorId: c.responderId,
        category: w?.basics.category ?? "其他",
        createdAt: c.createdAt,
        amount: c.fulfilledAt ? (c.price ?? 0) : undefined,
        violation: c.status === "breached",
      });
    }
    for (const r of s.reviews) {
      rows.push({
        authorId: r.fromId,
        category: "评价",
        createdAt: r.at,
        reviewStar: r.score,
      });
    }
    for (const d of s.disputes) {
      const w = s.waves.find((x) => x.id === d.claimId || s.claims.some((c) => c.id === d.claimId && c.waveId === x.id));
      rows.push({
        authorId: w?.authorId ?? "争议",
        category: "争议",
        createdAt: d.createdAt,
      });
    }
    return runBi(parseBiQuery(text), rows, Date.now());
  },
});
