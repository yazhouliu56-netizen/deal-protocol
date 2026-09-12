/**
 * 哨所值班队列（B2 · 预警分级 P0/P1/P2）。
 *
 * P0 自动熔断（不等人，事后审计）；P1 推人（L1 值班 10 秒判，5min SLA，
 * 过期/超阈/举手自动升级 L3）；P2 日报最小版（周报＋例会沉淀规则）。
 * Pure + unit-testable; no runtime imports. 队列由调用方持有（数组进出），
 * 控制台负责持久化。
 */

/** P0 熔断信号（SOS 链路本身在 m10-sos/crisis，此处只做熔断决策）。 */
export type P0Signal = "SOS_TRIGGERED" | "FUNDS_BREACH" | "SAFETY_GATE_TRIP";

export interface FuseAction {
  fused: true;
  freezeOrders: boolean;
  notify: string[];
  audit: string;
}

/** P0：见信号即熔断（冻结订单＋双路通知），执行层在 m10-sos，此处只定夺。 */
export function autoFuse(signal: P0Signal, refId: string): FuseAction {
  return {
    fused: true,
    freezeOrders: true,
    notify: ["平台值班", "紧急联系人"],
    audit: `P0_AUTO_FUSE: ${signal} ref=${refId}`,
  };
}

/** P1 响应 SLA（5min：响应不是解决，是有人看）。 */
export const P1_SLA_MS = 5 * 60 * 1000;
/** 升级金额阈值（单笔熔断超 2000 自动升级 L3）。 */
export const UPGRADE_AMOUNT_YUAN = 2000;

/**
 * 升级通讯录（2026-09-12 定稿）：
 * L1＝L（值班运营）；L2＝创始人。
 * 空级跳过规则（PagerDuty 同款）：L1 无人认领→自动到 L2。
 */
export const ESCALATION_L1 = "L（值班运营）";
export const ESCALATION_L2 = "创始人";

export type P1Kind =
  | "R1_CRITICAL_FIRST"
  | "FUSE_CASE"
  | "APPEAL"
  | "L1_MANUAL";

export type P1Status = "open" | "claimed" | "resolved" | "escalated";

export interface P1Item {
  id: string;
  kind: P1Kind;
  summary: string;
  amountYuan?: number;
  createdAt: number;
  slaDueAt: number;
  status: P1Status;
  claimedBy?: string;
  escalateTo?: "L3";
  resolution?: string;
  /** 本单沉淀的新规则数（指挥官 KPI：沉淀规则，不是点通过）。 */
  rulesMinted?: number;
}

export function pushP1(
  queue: P1Item[],
  input: { id: string; kind: P1Kind; summary: string; amountYuan?: number },
  now = Date.now(),
): P1Item[] {
  if (queue.some((i) => i.id === input.id)) return queue;
  return [
    ...queue,
    {
      ...input,
      createdAt: now,
      slaDueAt: now + P1_SLA_MS,
      status: "open" as const,
    },
  ];
}

export function claimP1(queue: P1Item[], id: string, who: string): P1Item[] {
  return queue.map((i) => (i.id === id && i.status === "open" ? { ...i, status: "claimed" as const, claimedBy: who } : i));
}

export function resolveP1(
  queue: P1Item[],
  id: string,
  resolution: string,
  rulesMinted = 0,
): P1Item[] {
  return queue.map((i) =>
    i.id === id && (i.status === "open" || i.status === "claimed" || i.status === "escalated")
      ? { ...i, status: "resolved" as const, resolution, rulesMinted }
      : i,
  );
}

/** 升级判定：R1＋CRITICAL 首现／超阈／L1 举手（kind=L1_MANUAL 即举手）。 */
export function needsUpgrade(item: Pick<P1Item, "kind" | "amountYuan">): boolean {
  if (item.kind === "R1_CRITICAL_FIRST") return true;
  if (item.kind === "L1_MANUAL") return true;
  return (item.amountYuan ?? 0) > UPGRADE_AMOUNT_YUAN;
}

/** 扫队列：过期未决 → escalated（L3）；已升级的不重复推。 */
export function sweepP1(queue: P1Item[], now = Date.now()): P1Item[] {
  return queue.map((i) => {
    if ((i.status === "open" || i.status === "claimed") && now > i.slaDueAt) {
      return { ...i, status: "escalated" as const, escalateTo: "L3" as const };
    }
    return i;
  });
}

/** P2 日报最小版：已决单聚合（resolved 数／沉淀规则数／kind 分布）。 */
export function buildP2Digest(resolved: P1Item[]): {
  resolved: number;
  rulesMinted: number;
  byKind: Partial<Record<P1Kind, number>>;
} {
  const byKind: Partial<Record<P1Kind, number>> = {};
  let rulesMinted = 0;
  for (const i of resolved) {
    if (i.status !== "resolved") continue;
    byKind[i.kind] = (byKind[i.kind] ?? 0) + 1;
    rulesMinted += i.rulesMinted ?? 0;
  }
  return {
    resolved: Object.values(byKind).reduce((a, b) => a + (b ?? 0), 0),
    rulesMinted,
    byKind,
  };
}
