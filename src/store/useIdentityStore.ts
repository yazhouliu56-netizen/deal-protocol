"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { VirtualAccount } from "@/base/trust/violation";
import { INITIAL_BALANCE, settleBreach } from "@/base/trust/violation";
import { applyLedger, makeLedgerEntry, type LedgerEntry } from "@/base/money/ledger";
import type { CreditTier } from "@/base/trust/reputation";
import { applyCreditDelta } from "@/base/trust/reputation";
import type { DepositPhase } from "@/base/money/deposit";
import {
  DEPOSIT_AMOUNT,
  PLATFORM_FEE,
  holdDeposit,
  payDepositPayout,
  refundDeposit,
  releaseDeposit,
} from "@/base/money/deposit";
import type { Review } from "@/base/trust/review";
import { creditFromReviews, dailyQuotaForTier } from "@/base/trust/review";
import { FREE_PUBLISH_PER_DAY } from "@/base/money/pay";

/**
 * Private identity — one per browser tab (sessionStorage so a second tab
 * opens as a *second* P2P identity in the same broadcast space).
 * Holds account (virtual ¥), credit tier, online switch and the capability
 * statement that gates broadcast reception.
 */

export interface Identity {
  id: string;
  nickname: string;
  emoji: string;
  /** 本地上传头像（dataURL）。nil → 用 emoji 兜底。 */
  avatar?: string;
  categories: string[];
  tags: string[];
  distanceKm: number;
  verified: boolean;
  online: boolean;
  /** 出生年份（未成年人分级依据）。nil → 视为未设置（ADR-0016）。 */
  birthYear?: number;
  /** 14 岁以下监护人同意（《未保法》§72）。nil → false。 */
  guardianConsent?: boolean;
}

export type { LedgerEntry } from "@/base/money/ledger";

export interface DepositRecord {
  claimId: string;
  phase: DepositPhase;
  amount: number;
  at: number;
}

interface IdentityState {
  identity: Identity;
  account: VirtualAccount;
  creditTier: CreditTier;
  /** Daily free response credits left (5 claims / day; 8 when Lv ≥ 4). */
  claimQuota: number;
  /** Epoch of the last quota reset. */
  lastQuotaAt: number;
  /** 每日免费发布次数剩余（免费 3 次/天，超出每次收 PUBLISH_FEE）。 */
  publishQuota: number;
  /** Epoch of the last publish-quota reset. */
  lastPublishQuotaAt: number;
  /** 在线状态总闸: online / busy (hold claims, stop new broadcasts) / offline. */
  status: "online" | "busy" | "offline";
  /** Virtual balance ledger — every deduction is visible in the wallet. */
  ledger: LedgerEntry[];
  /** My 鸽子险 deposits (responder side) — idempotent accounting. */
  deposits: DepositRecord[];

  setCapability: (patch: Partial<Pick<Identity, "categories" | "tags" | "distanceKm" | "verified">>) => void;
  setAvatar: (dataUrl: string) => void;
  setOnline: (online: boolean) => void;
  /** 设置出生年份（+14 岁以下监护人同意），驱动 ADR-0016 未成年人分级。 */
  setAge: (birthYear?: number, guardianConsent?: boolean) => void;
  setStatus: (status: "online" | "busy" | "offline") => void;
  useQuota: (n?: number) => boolean;
  resetQuotaIfDue: (now?: number) => void;
  /** 消耗一次免费发布次数：用完返回 false（超出则需付发布费）。 */
  consumePublishQuota: () => boolean;
  resetPublishQuotaIfDue: (now?: number) => void;
  settle: (claimId: string, verdict: "forgive" | "unforgiven", now?: number) => void;
  /** Credit tier re-derived from received reviews (评价驱动分层). */
  recalcCredit: (reviews: Review[]) => void;
  /** Idempotent 鸽子险 accounting driven by the shared claim phase. */
  syncDeposit: (claimId: string, phase: DepositPhase, amount?: number) => void;
  /** Idempotent payout received (demander side, breach unforgiven / 履约险理赔). */
  receivePayout: (claimId: string, amount?: number, kind?: "deposit" | "insurance") => void;
  /** 通用入账：竞价佣金/订阅扣款/服务收益走同一账本（负数出、正数进）。 */
  book: (kind: LedgerEntry["kind"], amount: number, note: string) => void;
}

function makeIdentity(): Identity {
  const n = Math.floor(Math.random() * 100_000);
  return {
    id: `me-${n.toString(36)}`,
    nickname: "光点",
    emoji: "✨",
    // Newcomers are both sides by default — "人人既需求方又响应方".
    categories: ["厨师 · 上门做饭", "羽毛球约局", "摄影师约拍", "家政保洁", "陪诊陪护", "拼桌桌游"],
    tags: [],
    distanceKm: 2,
    verified: false,
    online: true,
  };
}

const midnight = () => {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
};

/**
 * Per-tab identity key — `window.name` survives reloads, is private to the
 * tab (unlike sessionStorage in some contexts), so a second tab opens as a
 * *second* P2P identity sharing the same broadcast space.
 */
function tabKey(): string {
  if (typeof window === "undefined") return "ssr";
  if (!window.name) {
    window.name = `t-${Math.random().toString(36).slice(2, 10)}`;
  }
  return window.name;
}

export const useIdentityStore = create<IdentityState>()(
  persist(
    (set, get) => ({
      identity: makeIdentity(),
      account: { balance: INITIAL_BALANCE },
      creditTier: 3,
      claimQuota: dailyQuotaForTier(3),
      lastQuotaAt: 0,
      publishQuota: FREE_PUBLISH_PER_DAY,
      lastPublishQuotaAt: 0,
      status: "online",
      ledger: [],
      deposits: [],

      setCapability: (patch) =>
        set((s) => ({ identity: { ...s.identity, ...patch } })),

      setAvatar: (dataUrl) =>
        set((s) => ({ identity: { ...s.identity, avatar: dataUrl } })),

      setAge: (birthYear, guardianConsent) =>
        set((s) => ({
          identity: {
            ...s.identity,
            birthYear: birthYear ?? undefined,
            guardianConsent:
              typeof guardianConsent === "boolean"
                ? guardianConsent
                : s.identity.guardianConsent,
          },
        })),

      setOnline: (online) =>
        set((s) => ({
          identity: { ...s.identity, online },
          status: online ? "online" : "offline",
        })),

      setStatus: (status) =>
        set((s) => ({
          status,
          identity: { ...s.identity, online: status === "online" },
        })),

      resetQuotaIfDue: (now = Date.now()) =>
        set((s) => {
          if (s.lastQuotaAt > now) return {} as Partial<IdentityState>;
          const tierCap = dailyQuotaForTier(s.creditTier);
          return { claimQuota: tierCap, lastQuotaAt: midnight() };
        }),

      recalcCredit: (reviews) =>
        set((s) => ({
          creditTier: creditFromReviews(
            reviews,
            s.creditTier
          ) as CreditTier,
        })),

      useQuota: (n = 1) => {
        const s = get();
        if (s.claimQuota < n) return false;
        set({ claimQuota: s.claimQuota - n });
        return true;
      },

      resetPublishQuotaIfDue: (now = Date.now()) =>
        set((s) => {
          if (s.lastPublishQuotaAt > now) return {} as Partial<IdentityState>;
          return { publishQuota: FREE_PUBLISH_PER_DAY, lastPublishQuotaAt: midnight() };
        }),

      consumePublishQuota: () => {
        const s = get();
        if (s.publishQuota <= 0) return false;
        set({ publishQuota: s.publishQuota - 1 });
        return true;
      },

      settle: (claimId, verdict, now = Date.now()) =>
        set((s) => {
          const out = settleBreach(s.account, verdict, now);
          const entry: LedgerEntry = {
            id: `ledger-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            kind: "penalty",
            amount: -out.penalty,
            note: `${out.message} · 订单 ${claimId}`,
            at: now,
          };
          return {
            account: out.account,
            creditTier: applyCreditDelta(s.creditTier, out.creditDelta),
            ledger: [entry, ...s.ledger].slice(0, 50),
          };
        }),

      syncDeposit: (claimId, phase, amount = DEPOSIT_AMOUNT) =>
        set((s) => {
          const rec = s.deposits.find((d) => d.claimId === claimId);
          const now = Date.now();
          const entry = (kind: LedgerEntry["kind"], amt: number, note: string): LedgerEntry => ({
            id: `ledger-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            kind,
            amount: amt,
            note,
            at: now,
          });

          if (!rec) {
            if (phase !== "held") return {};
            return {
              account: holdDeposit(s.account, amount),
              ledger: [entry("deposit", -amount, `鸽子险押金冻结 · 订单 ${claimId}`), ...s.ledger].slice(0, 50),
              deposits: [...s.deposits, { claimId, phase, amount, at: now }],
            };
          }
          if (rec.phase !== "held") return {};

          // held → released / forfeited / refunded
          let account = s.account;
          let ledger = s.ledger;
          if (phase === "confirmed") {
            account = releaseDeposit(account, amount);
            ledger = [entry("deposit", +((amount - PLATFORM_FEE).toFixed(1)), `鸽子险解冻退回（含平台服务费）· 订单 ${claimId}`), ...ledger].slice(0, 50);
          } else if (phase === "refunded") {
            account = refundDeposit(account, amount);
            ledger = [entry("deposit", amount, `鸽子险全额退回（获得谅解）· 订单 ${claimId}`), ...ledger].slice(0, 50);
          } else if (phase === "forfeited") {
            ledger = [entry("deposit", 0, `鸽子险没收（爽约赔付需求方）· 订单 ${claimId}`), ...ledger].slice(0, 50);
          }
          return {
            account,
            ledger,
            deposits: s.deposits.map((d) => (d.claimId === claimId ? { ...d, phase: rec.phase === phase ? d.phase : phase, at: now } : d)),
          };
        }),

      receivePayout: (claimId, amount = 5, kind = "deposit") =>
        set((s) => {
          // 幂等键 = kind + claimId：鸽子险赔付与履约险理赔互不覆盖
          const noteKey =
            kind === "insurance" ? "履约保险理赔到账" : "鸽子险赔付到账";
          if (
            s.ledger.some(
              (e) =>
                e.kind === "payout" &&
                e.note.includes(noteKey) &&
                e.note.includes(claimId)
            )
          ) {
            return {} as Partial<IdentityState>;
          }
          const now = Date.now();
          const payoutEntry: LedgerEntry = {
            id: `ledger-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            kind: "payout",
            amount,
            note: `${noteKey} · 订单 ${claimId}`,
            at: now,
          };
          return {
            account: payDepositPayout(s.account, amount),
            ledger: [payoutEntry, ...s.ledger].slice(0, 50),
          };
        }),

      book: (kind, amount, note) =>
        set((s) => {
          const now = Date.now();
          // 负数出账不下穿 0；正数入账即时可用
          const account = applyLedger(s.account, amount);
          const entry = makeLedgerEntry(kind, amount, note, now);
          return { account, ledger: [entry, ...s.ledger].slice(0, 50) };
        }),
    }),
    {
      name: `oto-identity-${tabKey()}`,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        identity: s.identity,
        account: s.account,
        creditTier: s.creditTier,
        claimQuota: s.claimQuota,
        lastQuotaAt: s.lastQuotaAt,
        publishQuota: s.publishQuota,
        lastPublishQuotaAt: s.lastPublishQuotaAt,
        status: s.status,
        ledger: s.ledger,
        deposits: s.deposits,
      }),
    }
  )
);

// 把首次生成的身份落盘：hydrate 完成后空 set 一次触发 persist 写入，
// 保证刷新后仍是同一个 P2P 身份（wave 的 author 过滤才不会误伤）。
// 注意不能在 onRehydrateStorage 里引用本模块（create 前 TDZ）。
if (typeof window !== "undefined") {
  const pending = useIdentityStore.persist.rehydrate();
  const done = pending && typeof pending.then === "function" ? pending : null;
  const commit = () =>
    useIdentityStore.setState((s) => ({ claimQuota: s.claimQuota }));
  if (done) done.then(commit);
  else commit();
}