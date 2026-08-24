/**
 * L2-M4 里程碑分期托管纯函数引擎（批次 3a 自 src/lib/milestone-escrow.ts 语义吸收）：
 * 最大余数法整数分无损分配 → 单一全大写五态状态机（PENDING/HELD/SUBMITTED/RELEASED/REFUNDED）→
 * 决策/执行分离的超时判定 → milestoneId 粒度幂等放款与终止退款清算。
 *
 * 红线 1：100% 确定性——金额一律整数分（cents INT），时钟一律入参注入（submittedAt / now），零概率零内部取时。
 * 红线 3：底座纯净——零 Supabase / UI / Store 依赖，可 node:test 直跑。
 * 宪法收敛：条文 #1（底座优先）/ #3（单向依赖）。
 */

export type MilestoneStatus =
  | "PENDING"
  | "HELD"
  | "SUBMITTED"
  | "RELEASED"
  | "REFUNDED";

export interface IMilestoneCriterion {
  title: string;
  /** 单里程碑验收超时小时数；缺省回落 plan 级 defaultTimeoutHours，两级皆缺省则永不超时 */
  timeoutHours?: number;
}

export interface IMilestonePlanOptions {
  /** Plan 级超时缺省（小时）；单里程碑 timeoutHours 优先 */
  defaultTimeoutHours?: number;
}

export interface IMilestone {
  readonly id: string;
  readonly title: string;
  readonly stepNumber: number;
  readonly amountCents: number;
  /** 已解析生效的超时小时数（里程碑级 ?? plan 级；undefined = 永不超时） */
  readonly timeoutHours?: number;
  readonly status: MilestoneStatus;
  /** 提交验收时刻（ISO 注入，submit 时写入） */
  readonly submittedAt?: string;
}

export interface IMilestoneEscrowPlan {
  readonly totalAmountCents: number;
  readonly milestones: readonly IMilestone[];
}

export interface IMilestoneEvidence {
  /** 提交时刻（ISO 字符串，红线 1 时钟注入位） */
  submittedAt: string;
  proofUri?: string;
  note?: string;
}

export interface IMilestoneReleaseLedgerEntry {
  kind: "MILESTONE_RELEASE";
  milestoneId: string;
  stepNumber: number;
  title: string;
  amountCents: number;
  /** true = 需求方免验收直接刻意放款（HELD 直跳） */
  skippedAcceptance: boolean;
}

export interface IReleaseMilestoneResult {
  plan: IMilestoneEscrowPlan;
  ledgerEntry: IMilestoneReleaseLedgerEntry | null;
  releasedCents: number;
  alreadyReleased: boolean;
}

export interface IEvaluateTimeoutResult {
  timedOutMilestoneIds: string[];
}

export interface IRefundRemainingResult {
  plan: IMilestoneEscrowPlan;
  refundedCents: number;
  penaltyCents: number;
  clearedMilestoneIds: string[];
}

export type MilestoneEscrowErrorCode =
  | "INVALID_TOTAL_AMOUNT"
  | "INVALID_RATIOS"
  | "INVALID_CRITERIA"
  | "INVALID_PENALTY"
  | "INVALID_TIMESTAMP"
  | "MILESTONE_NOT_FOUND"
  | "INVALID_MILESTONE_STATE"
  | "CONSERVATION_VIOLATION"
  | "INSUFFICIENT_FUNDS_FOR_PENALTY";

export class MilestoneEscrowError extends Error {
  readonly code: MilestoneEscrowErrorCode;
  constructor(code: MilestoneEscrowErrorCode, message?: string) {
    super(message ? `[${code}] ${message}` : `[${code}]`);
    this.name = "MilestoneEscrowError";
    this.code = code;
  }
}

const EPSILON = 1e-9;

function assertIntegerCents(value: number, code: MilestoneEscrowErrorCode, label: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new MilestoneEscrowError(code, `${label} 必须为整数分（cents INT），收到 ${value}`);
  }
}

/** 最大余数法：按权重比例将 totalAmountCents 无损分配为整数分向量（固定索引序打破平局）。 */
export function allocateByLargestRemainder(
  totalAmountCents: number,
  ratios: number[],
): number[] {
  assertIntegerCents(totalAmountCents, "INVALID_TOTAL_AMOUNT", "totalAmountCents");
  if (totalAmountCents <= 0) {
    throw new MilestoneEscrowError("INVALID_TOTAL_AMOUNT", `总额必须为正，收到 ${totalAmountCents}`);
  }
  if (!Array.isArray(ratios) || ratios.length === 0) {
    throw new MilestoneEscrowError("INVALID_RATIOS", "ratios 不得为空");
  }
  for (const r of ratios) {
    if (!Number.isFinite(r) || r < 0) {
      throw new MilestoneEscrowError("INVALID_RATIOS", `比例必须为非负有限数，收到 ${r}`);
    }
  }
  const sumRatio = ratios.reduce((s, r) => s + r, 0);
  if (!(sumRatio > 0)) {
    throw new MilestoneEscrowError("INVALID_RATIOS", "比例之和必须大于 0");
  }

  // 下取整份额（加 epsilon 抵消浮点表示误差，如 0.3 * 30000 = 9000.000000000002）
  const floors = ratios.map((r) => Math.floor((totalAmountCents * r) / sumRatio + EPSILON));
  const remainder = totalAmountCents - floors.reduce((s, f) => s + f, 0);
  if (remainder < 0 || remainder > ratios.length) {
    throw new MilestoneEscrowError("CONSERVATION_VIOLATION", `最大余数法余量异常：${remainder}`);
  }

  // 余数分按小数部分降序、索引升序（固定遍历序）逐个 +1
  const fractional = ratios.map((r, i) => ({
    index: i,
    frac: ((totalAmountCents * r) / sumRatio) % 1,
  }));
  fractional.sort((a, b) => (b.frac - a.frac !== 0 ? b.frac - a.frac : a.index - b.index));
  for (let k = 0; k < remainder; k++) {
    floors[fractional[k % fractional.length].index] += 1;
  }

  const allocated = floors.reduce((s, f) => s + f, 0);
  if (allocated !== totalAmountCents) {
    throw new MilestoneEscrowError(
      "CONSERVATION_VIOLATION",
      `资金守恒破坏：sum(${allocated}) !== total(${totalAmountCents})`,
    );
  }
  return floors;
}

/**
 * 生成分期托管计划：创建即冻结（全部里程碑直入 HELD，宪法裁决边界 1；
 * PENDING 仅为未来先签后付模式预留的枚举成员，本引擎不产出）。
 */
export function createMilestonePlan(
  totalAmountCents: number,
  ratios: number[],
  criteria: IMilestoneCriterion[],
  options?: IMilestonePlanOptions,
): IMilestoneEscrowPlan {
  if (!Array.isArray(criteria) || criteria.length !== ratios.length) {
    throw new MilestoneEscrowError(
      "INVALID_CRITERIA",
      `criteria 数量必须与 ratios 一致：${criteria?.length} vs ${ratios?.length}`,
    );
  }
  const amounts = allocateByLargestRemainder(totalAmountCents, ratios);
  const milestones: IMilestone[] = amounts.map((amountCents, i) => ({
    id: `milestone-${i + 1}`,
    title: criteria[i].title,
    stepNumber: i + 1,
    amountCents,
    timeoutHours: criteria[i].timeoutHours ?? options?.defaultTimeoutHours,
    status: "HELD",
  }));
  return { totalAmountCents, milestones };
}

function findMilestone(plan: IMilestoneEscrowPlan, milestoneId: string): { milestone: IMilestone; index: number } {
  const index = plan.milestones.findIndex((m) => m.id === milestoneId);
  if (index === -1) {
    throw new MilestoneEscrowError("MILESTONE_NOT_FOUND", `里程碑 ${milestoneId} 不存在`);
  }
  return { milestone: plan.milestones[index], index };
}

function withMilestone(plan: IMilestoneEscrowPlan, index: number, patch: Partial<IMilestone>): IMilestoneEscrowPlan {
  const milestones = plan.milestones.map((m, i) => (i === index ? { ...m, ...patch } : m));
  return { ...plan, milestones };
}

/** 服务者提交阶段验收凭证：HELD ➔ SUBMITTED（红线 1：提交时刻经 evidence.submittedAt 注入）。 */
export function submitMilestoneCheckpoint(
  plan: IMilestoneEscrowPlan,
  milestoneId: string,
  evidence: IMilestoneEvidence,
): { plan: IMilestoneEscrowPlan; milestone: IMilestone } {
  if (!evidence || typeof evidence.submittedAt !== "string" || Number.isNaN(Date.parse(evidence.submittedAt))) {
    throw new MilestoneEscrowError("INVALID_TIMESTAMP", "evidence.submittedAt 必须为合法 ISO 时间字符串");
  }
  const { milestone, index } = findMilestone(plan, milestoneId);
  if (milestone.status !== "HELD") {
    throw new MilestoneEscrowError(
      "INVALID_MILESTONE_STATE",
      `里程碑 ${milestoneId} 状态为 ${milestone.status}，仅 HELD 可提交验收`,
    );
  }
  const next = withMilestone(plan, index, { status: "SUBMITTED", submittedAt: evidence.submittedAt });
  return { plan: next, milestone: next.milestones[index] };
}

/**
 * 结算放款：SUBMITTED ➔ RELEASED（正常验收流）/ HELD ➔ RELEASED（需求方免验收即时刻意放款）。
 * 幂等（裁决）：对已 RELEASED 里程碑重复调用为无副作用的 no-op（alreadyReleased 标记，零二次入账）。
 */
export function releaseMilestone(
  plan: IMilestoneEscrowPlan,
  milestoneId: string,
): IReleaseMilestoneResult {
  const { milestone, index } = findMilestone(plan, milestoneId);
  if (milestone.status === "RELEASED") {
    return { plan, ledgerEntry: null, releasedCents: 0, alreadyReleased: true };
  }
  if (milestone.status !== "SUBMITTED" && milestone.status !== "HELD") {
    throw new MilestoneEscrowError(
      "INVALID_MILESTONE_STATE",
      `里程碑 ${milestoneId} 状态为 ${milestone.status}，仅 SUBMITTED/HELD 可放款`,
    );
  }
  const skippedAcceptance = milestone.status === "HELD";
  const next = withMilestone(plan, index, { status: "RELEASED" });
  const ledgerEntry: IMilestoneReleaseLedgerEntry = {
    kind: "MILESTONE_RELEASE",
    milestoneId,
    stepNumber: milestone.stepNumber,
    title: milestone.title,
    amountCents: milestone.amountCents,
    skippedAcceptance,
  };
  return { plan: next, ledgerEntry, releasedCents: milestone.amountCents, alreadyReleased: false };
}

/**
 * 超时自动放款判定（决策/执行分离，裁决边界 4）：仅扫描 status === 'SUBMITTED'
 * 且 submittedAt + timeoutHours <= now 的里程碑，输出决策清单；放款由调用方组合 releaseMilestone 执行。
 * 红线 1：now 为入参注入，函数内部零取时。
 */
export function evaluateMilestoneTimeout(
  plan: IMilestoneEscrowPlan,
  now: string,
): IEvaluateTimeoutResult {
  const nowMs = Date.parse(now);
  if (Number.isNaN(nowMs)) {
    throw new MilestoneEscrowError("INVALID_TIMESTAMP", `now 必须为合法 ISO 时间字符串，收到 ${now}`);
  }
  const timedOutMilestoneIds: string[] = [];
  for (const m of plan.milestones) {
    if (m.status !== "SUBMITTED" || !m.submittedAt) continue;
    const hours = m.timeoutHours;
    if (hours === undefined) continue;
    const deadlineMs = Date.parse(m.submittedAt) + hours * 3600_000;
    if (nowMs >= deadlineMs) {
      timedOutMilestoneIds.push(m.id);
    }
  }
  return { timedOutMilestoneIds };
}

/** 终止退款清算：仅清算 HELD 与 SUBMITTED 阶段资金（裁决边界 2）；违约金超冻结总额强拒绝（边界 3）。 */
export function refundRemainingMilestones(
  plan: IMilestoneEscrowPlan,
  breachPenaltyCents: number,
): IRefundRemainingResult {
  assertIntegerCents(breachPenaltyCents, "INVALID_PENALTY", "breachPenaltyCents");
  if (breachPenaltyCents < 0) {
    throw new MilestoneEscrowError("INVALID_PENALTY", `违约金不得为负，收到 ${breachPenaltyCents}`);
  }
  const clearable = plan.milestones.filter((m) => m.status === "HELD" || m.status === "SUBMITTED");
  const remainingCents = clearable.reduce((s, m) => s + m.amountCents, 0);
  if (breachPenaltyCents > remainingCents) {
    throw new MilestoneEscrowError(
      "INSUFFICIENT_FUNDS_FOR_PENALTY",
      `违约金 ${breachPenaltyCents} 分超过剩余未释放冻结总额 ${remainingCents} 分，拒绝执行`,
    );
  }
  const clearedIds = clearable.map((m) => m.id);
  const clearedSet = new Set(clearedIds);
  const milestones = plan.milestones.map((m) =>
    clearedSet.has(m.id) ? { ...m, status: "REFUNDED" as const } : m,
  );
  return {
    plan: { ...plan, milestones },
    refundedCents: remainingCents - breachPenaltyCents,
    penaltyCents: breachPenaltyCents,
    clearedMilestoneIds: clearedIds,
  };
}

/* =====================================================================
 * 只读投影（供调用方与考卷复用的守恒对账位）
 * ===================================================================== */

export function releasedTotalCents(plan: IMilestoneEscrowPlan): number {
  return plan.milestones.filter((m) => m.status === "RELEASED").reduce((s, m) => s + m.amountCents, 0);
}

export function frozenRemainingCents(plan: IMilestoneEscrowPlan): number {
  return plan.milestones
    .filter((m) => m.status === "HELD" || m.status === "SUBMITTED")
    .reduce((s, m) => s + m.amountCents, 0);
}
