import { getServiceClient } from "@/lib/supabase-client";
import { getConfig } from "@/lib/platform/config";
import { receiveChannelFee } from "@/lib/channel-fee";
import {
  settleType1,
  type Type1SubjectivePass,
} from "@/base/money/type1-settlement";

/**
 * 里程碑行级流转（C 全功能 M1 · 用户裁决 2026-09-23）。
 *
 * P7 只物化 PENDING 行；本模块给出行的后半生：
 * submitStageRow（服务方交验：PENDING/HELD → SUBMITTED）与
 * releaseStageRow（需求方放款：SUBMITTED/HELD → RELEASED ＋ 钱包记账）。
 * 状态口径 = 纯核 milestone-escrow 五态（行级不另起语义，只做持久化投影）。
 *
 * 钱单位：milestone_schedules.amount 为元（P7 stageAmounts 元口径）；
 * 本模块内一律 Math.round(元×100) 转分、钱包余额保留 2 位小数
 * （与 satisfaction.ts 同口径）。
 *
 * 崩溃一致性（对齐 R11 wallet_logs 对账幂等）：放款前先查账——
 * 已有本行 MILESTONE_PAYOUT 日志即只补翻行状态、不二次入账。
 * 残余窗口：双击并发同毫秒（先查后写），与既有 satisfaction 同姿态，
 * 行级 CAS 保证状态不漂、金额以日志为准可对账。
 */

export class MilestoneRowError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number, message?: string) {
    super(message ? `[${code}] ${message}` : `[${code}]`);
    this.name = "MilestoneRowError";
    this.code = code;
    this.status = status;
  }
}

type Svc = ReturnType<typeof getServiceClient>;

interface StageRow {
  id: string;
  contract_id: string;
  title: string;
  amount: number;
  step_number: number;
  status: string;
  sla_hours?: number | null;
}

interface StageContract {
  customer_id: string;
  provider_id: string;
  dispute_status?: string | null;
}

/** 争议冻结态：OPEN / PENDING_REVIEW 期间阶段钱一律不动（M4）。 */
const DISPUTE_FROZEN = new Set(["OPEN", "PENDING_REVIEW"]);

function assertNoOpenDispute(contract: StageContract): void {
  if (contract.dispute_status != null && DISPUTE_FROZEN.has(contract.dispute_status)) {
    throw new MilestoneRowError(
      "DISPUTE_OPEN",
      409,
      `争议处理中（${contract.dispute_status}），阶段流转冻结`,
    );
  }
}

async function loadRowAndContract(
  svc: Svc,
  rowId: string,
): Promise<{ row: StageRow; contract: StageContract }> {
  const { data: row } = await svc
    .from("milestone_schedules")
    .select("id, contract_id, title, amount, step_number, status, sla_hours")
    .eq("id", rowId)
    .single();
  const r = row as StageRow | null;
  if (!r?.id) {
    throw new MilestoneRowError("ROW_NOT_FOUND", 404, "阶段行不存在");
  }
  const { data: contract } = await svc
    .from("contracts")
    .select("customer_id, provider_id, dispute_status")
    .eq("id", r.contract_id)
    .single();
  const c = contract as StageContract | null;
  if (!c?.customer_id || !c?.provider_id) {
    throw new MilestoneRowError("CONTRACT_NOT_FOUND", 404, "关联合同不存在");
  }
  return { row: r, contract: c };
}

function toCents(yuan: number, label: string): number {
  if (!Number.isFinite(yuan) || yuan <= 0) {
    throw new MilestoneRowError("INVALID_AMOUNT", 500, `${label} 非法：${yuan}`);
  }
  return Math.round(yuan * 100);
}

async function ensureWallet(svc: Svc, providerId: string): Promise<void> {
  const { data } = await svc
    .from("provider_wallets")
    .select("provider_id")
    .eq("provider_id", providerId)
    .single();
  if (!data) {
    const { error } = await svc
      .from("provider_wallets")
      .insert({ provider_id: providerId, balance: 0 });
    if (error) throw new MilestoneRowError("WALLET_ENSURE_FAILED", 500, error.message);
  }
}

/**
 * 服务方交验：PENDING/HELD → SUBMITTED（submitted_at 落钟；sla_hours 在
 * 则立 auto_confirm_at 死线供 M4 cron）。SUBMITTED 重交验幂等直返。
 */
export async function submitStageRow(
  svc: Svc,
  rowId: string,
  callerId: string,
  nowIso: string = new Date().toISOString(),
): Promise<{ submitted: boolean; alreadySubmitted?: boolean; stepNumber: number; autoConfirmAt: string | null }> {
  if (Number.isNaN(Date.parse(nowIso))) {
    throw new MilestoneRowError("INVALID_TIMESTAMP", 400, "nowIso 非法");
  }
  const { row, contract } = await loadRowAndContract(svc, rowId);
  assertNoOpenDispute(contract);
  if (callerId !== contract.provider_id) {
    throw new MilestoneRowError("FORBIDDEN", 403, "仅服务方可提交阶段验收");
  }
  if (row.status === "SUBMITTED") {
    return { submitted: false, alreadySubmitted: true, stepNumber: row.step_number, autoConfirmAt: null };
  }
  if (row.status !== "PENDING" && row.status !== "HELD") {
    throw new MilestoneRowError("INVALID_STATE", 409, `行状态 ${row.status} 不可交验`);
  }
  const autoConfirmAt =
    row.sla_hours != null && Number.isFinite(row.sla_hours)
      ? new Date(Date.parse(nowIso) + Number(row.sla_hours) * 3600_000).toISOString()
      : null;
  const { data: flipped, error } = await svc
    .from("milestone_schedules")
    .update({ status: "SUBMITTED", submitted_at: nowIso, auto_confirm_at: autoConfirmAt })
    .eq("id", rowId)
    .eq("status", row.status)
    .select("id");
  if (error || !flipped || (flipped as unknown[]).length === 0) {
    throw new MilestoneRowError("CONFLICT", 409, "阶段行已被并发变更，请刷新重试");
  }
  return { submitted: true, stepNumber: row.step_number, autoConfirmAt };
}

/**
 * 需求方放款：SUBMITTED → RELEASED（正常验收流）/ HELD → RELEASED
 * （免验收刻意直放，skippedAcceptance 标记）。RELEASED 重放幂等直返。
 * 记账（M3 费用分摊，与 Type1/P8 同口径）：师傅实得＝本期－佣金－通道费；
 * 佣金（总额百分比逐期计提，sunset 翻转即生效）记 COMMISSION 行，
 * 通道费（本期实收通道费率）直接抵扣（Type1 同姿态，无独立行）；
 * wallet_logs MILESTONE_PAYOUT 记实得。逐期 rounding dust ≤ 期数/2 分。
 * M5 主观三勾：opts.pass 逐期套 Type1 五项方程——全勾/无评价（null）全返；
 * 未释勾进平台质管费（transactions QUALITY_FORFEIT，整单勾池罚没同口径；
 * 注意：不是退客户，退客户只走取消/争议路）。pass 非法 → INVALID_PASS。
 * 崩溃重放不双付（先查账）；残余双击窗口见文件头。
 */
export async function releaseStageRow(
  svc: Svc,
  rowId: string,
  callerId: string,
  nowIso: string = new Date().toISOString(),
  opts: { system?: boolean; pass?: Type1SubjectivePass | null } = {},
): Promise<{ released: boolean; alreadyReleased?: boolean; recovered?: boolean; amountYuan: number; providerNetYuan?: number; commissionYuan?: number; channelFeeYuan?: number; qualityFeeYuan?: number; skippedAcceptance: boolean }> {
  if (Number.isNaN(Date.parse(nowIso))) {
    throw new MilestoneRowError("INVALID_TIMESTAMP", 400, "nowIso 非法");
  }
  const { row, contract } = await loadRowAndContract(svc, rowId);
  assertNoOpenDispute(contract);
  if (!opts.system && callerId !== contract.customer_id) {
    throw new MilestoneRowError("FORBIDDEN", 403, "仅需求方可验收放款");
  }
  if (row.status === "RELEASED") {
    return { released: false, alreadyReleased: true, amountYuan: 0, skippedAcceptance: false };
  }
  if (row.status !== "SUBMITTED" && row.status !== "HELD") {
    throw new MilestoneRowError("INVALID_STATE", 409, `行状态 ${row.status} 不可放款`);
  }
  const skippedAcceptance = row.status === "HELD";
  const amountCents = toCents(Number(row.amount), `阶段行 ${rowId} 金额`);
  const amountYuan = amountCents / 100;

  // 崩溃重放：已有本行放款日志 → 只补翻状态，不二次入账。
  const { data: paid } = await svc
    .from("wallet_logs")
    .select("id")
    .eq("order_id", row.contract_id)
    .eq("type", "milestone_payout")
    .like("description", `%${rowId}%`)
    .limit(1);
  if (paid && (paid as unknown[]).length > 0) {
    await svc
      .from("milestone_schedules")
      .update({ status: "RELEASED", confirmed_at: nowIso })
      .eq("id", rowId);
    return { released: false, alreadyReleased: true, recovered: true, amountYuan, skippedAcceptance };
  }

  // M3 费用分摊（P8 同口径；配置缺席 fail-safe 0）。
  let commissionRate = 0;
  let channelRates = { wechat: 0, alipay: 0, stripe: 0 };
  try {
    const cfg = await getConfig();
    const r = cfg.fees.commissionRate ?? 0;
    commissionRate = Number.isFinite(r) && r >= 0 && r <= 1 ? r : 0;
    channelRates = cfg.fees.channelRates ?? channelRates;
  } catch {
    /* 免费政策方向 fail-safe */
  }
  const commissionCents = Math.round(amountCents * commissionRate);
  let channelFeeCents = 0;
  try {
    const { data: payRows } = await svc
      .from("payments")
      .select("provider, amount")
      .eq("contract_id", row.contract_id)
      .eq("status", "SUCCEEDED")
      .order("created_at", { ascending: false })
      .limit(1);
    const payRow = ((payRows ?? []) as { provider?: string; amount?: number }[])[0];
    if (payRow?.provider) {
      channelFeeCents = Math.round(
        receiveChannelFee(payRow.provider, amountYuan, channelRates).fee * 100,
      );
    }
  } catch {
    /* 通道缺席回落 0 */
  }
  if (channelFeeCents > amountCents - commissionCents) {
    throw new MilestoneRowError(
      "INVALID_FEE",
      500,
      `费用超本期：通道 ${channelFeeCents} 分＋佣金 ${commissionCents} 分 > 本期 ${amountCents} 分`,
    );
  }
  // M5 主观三勾：逐期套 Type1 五项方程（pass null＝全勾全返，既有语义零漂移）。
  const pass = opts.pass ?? null;
  if (
    pass !== null &&
    (typeof pass !== "object" ||
      typeof pass.attitude !== "boolean" ||
      typeof pass.appearance !== "boolean" ||
      typeof pass.restoration !== "boolean")
  ) {
    throw new MilestoneRowError("INVALID_PASS", 400, "pass 须为 null 或三勾布尔对象");
  }
  // P3 守恒硬锁（逐期）：实得＋质管费＋佣金＋通道费 ≡ 本期（方程内断言）。
  const settled = settleType1(amountCents, pass, channelFeeCents, { commissionRate });
  const providerNetCents = settled.providerNetCents;
  const qualityFeeCents = settled.qualityFeeCents;
  const providerNetYuan = providerNetCents / 100;
  const commissionYuan = commissionCents / 100;
  const channelFeeYuan = channelFeeCents / 100;
  const qualityFeeYuan = qualityFeeCents / 100;

  await ensureWallet(svc, contract.provider_id);
  const { data: w } = await svc
    .from("provider_wallets")
    .select("balance")
    .eq("provider_id", contract.provider_id)
    .single();
  const before = Number((w as { balance?: number } | null)?.balance ?? 0);
  const after = Math.round((before + providerNetYuan) * 100) / 100;
  const { error: creditError } = await svc
    .from("provider_wallets")
    .update({ balance: after, updated_at: nowIso })
    .eq("provider_id", contract.provider_id);
  if (creditError) throw new MilestoneRowError("CREDIT_FAILED", 500, creditError.message);
  const { error: logError } = await svc.from("wallet_logs").insert({
    provider_id: contract.provider_id,
    amount: providerNetYuan,
    type: "milestone_payout",
    order_id: row.contract_id,
    description: `分期放款: 合同 ${row.contract_id} 第${row.step_number}期「${row.title}」(row ${rowId})实得¥${providerNetYuan}（佣金¥${commissionYuan}/通道¥${channelFeeYuan}/质管¥${qualityFeeYuan}）`,
  });
  if (logError) throw new MilestoneRowError("LEDGER_FAILED", 500, logError.message);
  if (qualityFeeYuan > 0) {
    const { error: forfeitError } = await svc.from("transactions").insert({
      user_id: contract.provider_id,
      type: "QUALITY_FORFEIT",
      amount: -qualityFeeYuan,
      balance_before: 0,
      balance_after: 0,
      description: `分期罚没: 合同 ${row.contract_id} 第${row.step_number}期质管费¥${qualityFeeYuan}（未释勾）`,
    });
    if (forfeitError) throw new MilestoneRowError("LEDGER_FAILED", 500, forfeitError.message);
  }
  if (commissionYuan > 0) {
    const { error: commissionError } = await svc.from("transactions").insert({
      user_id: contract.provider_id,
      type: "COMMISSION",
      amount: -commissionYuan,
      balance_before: before,
      balance_after: after,
      description: `分期放款: 合同 ${row.contract_id} 第${row.step_number}期平台佣金¥${commissionYuan}`,
    });
    if (commissionError) throw new MilestoneRowError("LEDGER_FAILED", 500, commissionError.message);
  }

  const { data: flipped, error } = await svc
    .from("milestone_schedules")
    .update({ status: "RELEASED", confirmed_at: nowIso })
    .eq("id", rowId)
    .eq("status", row.status)
    .select("id");
  if (error || !flipped || (flipped as unknown[]).length === 0) {
    throw new MilestoneRowError("CONFLICT", 409, "阶段行已被并发变更，账已记请核对后重试");
  }
  return { released: true, amountYuan, providerNetYuan, commissionYuan, channelFeeYuan, qualityFeeYuan, skippedAcceptance };
}

export interface MilestoneSweepResult {
  autoReleased: string[];
  autoFailed: string[];
  closedTerminal: string[];
}

/**
 * 里程碑兜底扫描（M4 · cron 权威节拍调用）：
 * (i) SUBMITTED 且 auto_confirm_at 已过 → 系统自动放款（免验收语义，
 * 争议冻结行自动跳过记 hold）；(ii) 终局合同（SETTLED/CANCELLED）下
 * 未终态行（PENDING/HELD/SUBMITTED）→ REFUNDED 收敛（钱归合同级结算，
 * 此处只关状态，不断言金额）。
 */
export async function sweepMilestoneTimeouts(
  svc: Svc,
  nowIso: string = new Date().toISOString(),
): Promise<MilestoneSweepResult> {
  if (Number.isNaN(Date.parse(nowIso))) {
    throw new MilestoneRowError("INVALID_TIMESTAMP", 400, "nowIso 非法");
  }
  const out: MilestoneSweepResult = { autoReleased: [], autoFailed: [], closedTerminal: [] };

  const { data: due } = await svc
    .from("milestone_schedules")
    .select("id, contract_id")
    .eq("status", "SUBMITTED")
    .lte("auto_confirm_at", nowIso)
    .limit(200);
  for (const d of ((due ?? []) as { id: string; contract_id: string }[])) {
    try {
      const { data: c } = await svc
        .from("contracts")
        .select("customer_id")
        .eq("id", d.contract_id)
        .single();
      const customerId = (c as { customer_id?: string } | null)?.customer_id ?? "";
      const r = await releaseStageRow(svc, d.id, customerId, nowIso, { system: true });
      if (r.released) out.autoReleased.push(d.id);
    } catch (e) {
      out.autoFailed.push(`${d.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const { data: open } = await svc
    .from("milestone_schedules")
    .select("id, contract_id")
    .in("status", ["PENDING", "HELD", "SUBMITTED"])
    .limit(500);
  const openRows = ((open ?? []) as { id: string; contract_id: string }[]);
  const cids = [...new Set(openRows.map((r) => r.contract_id))];
  if (cids.length > 0) {
    const { data: cs } = await svc
      .from("contracts")
      .select("id, fund_status")
      .in("id", cids);
    const terminal = new Set(
      ((cs ?? []) as { id: string; fund_status?: string }[])
        .filter((c) => c.fund_status === "SETTLED" || c.fund_status === "CANCELLED")
        .map((c) => c.id),
    );
    const closeIds = openRows.filter((r) => terminal.has(r.contract_id)).map((r) => r.id);
    if (closeIds.length > 0) {
      await svc
        .from("milestone_schedules")
        .update({ status: "REFUNDED" })
        .in("id", closeIds)
        .in("status", ["PENDING", "HELD", "SUBMITTED"]);
      out.closedTerminal = closeIds;
    }
  }
  return out;
}
