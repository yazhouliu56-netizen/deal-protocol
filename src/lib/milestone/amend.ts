import { getServiceClient } from "@/lib/supabase-client";
import { stageAmounts, validateStagePlan, type StagePlanItem } from "@/base/stages/plan";
import { MilestoneRowError } from "./rows";

/**
 * 分期改期（C 全功能 M6 · 用户裁决 2026-09-23）。
 *
 * 不变量：
 * - 只重切未放款行（PENDING/HELD）；在途验收（SUBMITTED）须先结算；
 *   已放款/已退款行锁定不动。
 * - 重切基数＝未放款余量（已放款不重复计入，守恒：已放款＋新行 ≡ 原总额）；
 *   总额本身不改（增项另走 OnsiteQuote）。
 * - 对方确认：提议人不得自批（decide 要求非提议当事方）。
 * - 接受即删未放款行＋按余量重切建行；提案 stages JSON 即审计＋灾备源
 *   （建行失败可照提案重放，残余窗口已注记）。
 * - 版本 per-contract 递增＋唯一约束（并发同版 409 重试）。
 */

export interface AmendStageInput {
  title: string;
  weightPct: number;
  acceptance: string;
}

type Svc = ReturnType<typeof getServiceClient>;

interface AmendContract {
  customer_id: string;
  provider_id: string;
  amount: number;
}

async function loadAmendContract(svc: Svc, contractId: string): Promise<AmendContract> {
  const { data } = await svc
    .from("contracts")
    .select("customer_id, provider_id, amount")
    .eq("id", contractId)
    .single();
  const c = data as AmendContract | null;
  if (!c?.customer_id || !c?.provider_id) {
    throw new MilestoneRowError("CONTRACT_NOT_FOUND", 404, "关联合同不存在");
  }
  return c;
}

function assertParty(contract: AmendContract, callerId: string): void {
  if (callerId !== contract.customer_id && callerId !== contract.provider_id) {
    throw new MilestoneRowError("FORBIDDEN", 403, "仅合同当事方可改期");
  }
}

async function assertNoSubmitted(svc: Svc, contractId: string): Promise<void> {
  const { data } = await svc
    .from("milestone_schedules")
    .select("id")
    .eq("contract_id", contractId)
    .eq("status", "SUBMITTED")
    .limit(1);
  if (data && (data as unknown[]).length > 0) {
    throw new MilestoneRowError("IN_FLIGHT", 409, "有在途验收，先结算再改期");
  }
}

/** 未放款余量（PENDING/HELD 行金额和 · 元；0＝无可改行）。 */
async function amendableTotalYuan(svc: Svc, contractId: string): Promise<number> {
  const { data } = await svc
    .from("milestone_schedules")
    .select("amount")
    .eq("contract_id", contractId)
    .in("status", ["PENDING", "HELD"]);
  const rows = ((data ?? []) as { amount?: number }[]);
  return rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

/** 提议改期：校验计划＋无在途验收＋写入 PROPOSED 提案（版本号递增）。 */
export async function proposeStageAmendment(
  svc: Svc,
  contractId: string,
  callerId: string,
  stages: AmendStageInput[],
): Promise<{ proposalId: string; version: number }> {
  const contract = await loadAmendContract(svc, contractId);
  assertParty(contract, callerId);
  const problems = validateStagePlan(stages as StagePlanItem[]);
  if (problems.length > 0) {
    throw new MilestoneRowError("INVALID_PLAN", 400, `阶段计划非法：${problems.join("；")}`);
  }
  await assertNoSubmitted(svc, contractId);
  if ((await amendableTotalYuan(svc, contractId)) <= 0) {
    throw new MilestoneRowError("NO_AMENDABLE", 409, "无可改期行（均已放款/退款或在途）");
  }
  const { data: latest } = await svc
    .from("milestone_amendments")
    .select("version")
    .eq("contract_id", contractId)
    .order("version", { ascending: false })
    .limit(1);
  const version = (((latest ?? []) as { version?: number }[])[0]?.version ?? 0) + 1;
  const { data: inserted, error } = await svc
    .from("milestone_amendments")
    .insert({
      contract_id: contractId,
      version,
      stages: stages as never,
      proposed_by: callerId,
      status: "PROPOSED",
    })
    .select("id");
  if (error || !inserted || (inserted as unknown[]).length === 0) {
    throw new MilestoneRowError("CONFLICT", 409, "提案版本冲突，请刷新重试");
  }
  return { proposalId: (inserted as { id: string }[])[0].id, version };
}

export interface AmendProposal {
  id: string;
  version: number;
  stages: AmendStageInput[];
  proposed_by: string;
  status: string;
  canDecide: boolean;
}

/** 提案列表（调用方视角 canDecide：当事方＋非提议人＋PROPOSED）。 */
export async function listStageAmendments(
  svc: Svc,
  contractId: string,
  callerId: string,
): Promise<AmendProposal[]> {
  const contract = await loadAmendContract(svc, contractId);
  assertParty(contract, callerId);
  const { data, error } = await svc
    .from("milestone_amendments")
    .select("id, version, stages, proposed_by, status")
    .eq("contract_id", contractId)
    .order("version", { ascending: false })
    .limit(20);
  if (error) throw new MilestoneRowError("QUERY_FAILED", 500, error.message);
  return ((data ?? []) as {
    id: string;
    version: number;
    stages: AmendStageInput[];
    proposed_by: string;
    status: string;
  }[]).map((p) => ({
    ...p,
    canDecide: p.status === "PROPOSED" && callerId !== p.proposed_by,
  }));
}

/**
 * 裁决提案：拒绝 → REJECTED；接受 → 复核无在途验收 → 删未放款行 →
 * 按合同额重切建行 → ACCEPTED（顺序执行，建行失败抛 500，提案即重放源）。
 */
export async function decideStageAmendment(
  svc: Svc,
  proposalId: string,
  callerId: string,
  accept: boolean,
): Promise<{ accepted: boolean; version: number }> {
  const { data: proposal } = await svc
    .from("milestone_amendments")
    .select("id, contract_id, version, stages, proposed_by, status")
    .eq("id", proposalId)
    .single();
  const p = proposal as {
    id?: string;
    contract_id?: string;
    version?: number;
    stages?: AmendStageInput[];
    proposed_by?: string;
    status?: string;
  } | null;
  if (!p?.id || !p.contract_id) {
    throw new MilestoneRowError("PROPOSAL_NOT_FOUND", 404, "改期提案不存在");
  }
  if (p.status !== "PROPOSED") {
    throw new MilestoneRowError("INVALID_STATE", 409, `提案已裁决（${p.status}）`);
  }
  const contract = await loadAmendContract(svc, p.contract_id);
  assertParty(contract, callerId);
  if (callerId === p.proposed_by) {
    throw new MilestoneRowError("FORBIDDEN", 403, "提议人不得自批，须对方确认");
  }
  const nowIso = new Date().toISOString();
  if (!accept) {
    await svc
      .from("milestone_amendments")
      .update({ status: "REJECTED", decided_by: callerId, decided_at: nowIso })
      .eq("id", proposalId)
      .eq("status", "PROPOSED");
    return { accepted: false, version: p.version ?? 0 };
  }
  // 接受：复核无在途验收 → 按未放款余量重切（已放款不重复计入）→
  // 删未放款行 → 建行 → ACCEPTED（顺序执行，建行失败抛 500，提案即重放源）。
  await assertNoSubmitted(svc, p.contract_id);
  const remainderYuan = await amendableTotalYuan(svc, p.contract_id);
  if (!(remainderYuan > 0)) {
    throw new MilestoneRowError("NO_AMENDABLE", 409, "无可改期行（均已放款/退款或在途）");
  }
  const problems = validateStagePlan((p.stages ?? []) as StagePlanItem[]);
  if (problems.length > 0) {
    throw new MilestoneRowError("INVALID_PLAN", 400, `提案计划非法：${problems.join("；")}`);
  }
  const amounts = stageAmounts(remainderYuan, (p.stages ?? []) as StagePlanItem[]);
  const { error: delError } = await svc
    .from("milestone_schedules")
    .delete()
    .eq("contract_id", p.contract_id)
    .in("status", ["PENDING", "HELD"]);
  if (delError) throw new MilestoneRowError("APPLY_FAILED", 500, delError.message);
  const { error: insError } = await svc.from("milestone_schedules").insert(
    (p.stages ?? []).map((s, i) => ({
      contract_id: p.contract_id as string,
      title: s.title,
      amount: amounts[i],
      step_number: i + 1,
      status: "PENDING",
    })),
  );
  if (insError) throw new MilestoneRowError("APPLY_FAILED", 500, insError.message);
  await svc
    .from("milestone_amendments")
    .update({ status: "ACCEPTED", decided_by: callerId, decided_at: nowIso })
    .eq("id", proposalId)
    .eq("status", "PROPOSED");
  return { accepted: true, version: p.version ?? 0 };
}
