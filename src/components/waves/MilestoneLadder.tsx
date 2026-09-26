"use client";

import { useEffect, useMemo, useState } from "react";
import ConfirmSheet from "@/components/ui/ConfirmSheet";
import DuoButton from "@/components/ui/DuoButton";
import DuoCardShell from "@/components/ui/DuoCardShell";
import DuoPill, { type DuoPillTone } from "@/components/ui/DuoPill";
import { toast } from "@/base/platform/toast";
import {
  createMilestonePlan,
  releasedTotalCents,
  frozenRemainingCents,
  submitMilestoneCheckpoint,
  type IMilestoneEscrowPlan,
  type MilestoneStatus,
} from "@/base/money/milestone-escrow";

/**
 * 分期托管里程碑阶梯（方向 1 接线 C · 白皮书 milestone_staged 履约视口）。
 *
 * 状态与金额全部由 src/base/money/milestone-escrow.ts 确定性纯函数驱动
 * （红线 1：组件只做投影与事件转发，零资金计算逻辑）：
 * - createMilestonePlan：按比例最大余数法切分总额（分币守恒）；
 * - submitMilestoneCheckpoint：服务者提交阶段验收（HELD ➔ SUBMITTED，时钟注入）；
 * - releaseMilestone：需求方放款（SUBMITTED ➔ RELEASED / HELD 免验收直放）；
 * - releasedTotalCents / frozenRemainingCents：守恒账目展示。
 *
 * 上线前诚实态（用户裁决 2026-09-23）：真钱路当前只走 Type1 整单，
 * 分期放款钱侧未立项——梯子仅做计划展示＋交验进度，验收放款按钮只
 * toast 告知“即将上线、按整单结算”，不做本地 RELEASED 翻转（此前
 * 本地翻转＋“对方将收到本期款项”文案构成虚假承诺，已下线）。
 * 立项接线点：onPlanChange 持久化 ＋ 行级 release API ＋ 本按钮改调 API。
 *
 * Duo 化（Batch① 2026-09，插槽三件套先例）：暗岛 `<style>`（.ms-）去除，
 * 白底 DuoCardShell + 状态 DuoPill（soft）+ 提交验收 secondary / 验收放款 primary；
 * 放款 ConfirmSheet 二次确认保持（Batch②）。
 * 契约与埋点不变：data-testid / data-status / 文案全保留。
 */

const STATUS_TONE: Record<MilestoneStatus, { label: string; tone: DuoPillTone }> = {
  PENDING: { label: "待生效", tone: "neutral" },
  HELD: { label: "托管中", tone: "yellow" },
  SUBMITTED: { label: "待验收", tone: "blue" },
  RELEASED: { label: "已放款", tone: "green" },
  REFUNDED: { label: "已退款", tone: "red" },
};

function fmtYuan(cents: number): string {
  return `¥${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
}

export interface MilestoneLadderInput {
  title: string;
  /** 占总额比例 0-1 */
  ratio: number;
}

function LegacyMilestoneLadder({
  totalAmountYuan,
  milestones,
  defaultTimeoutHours,
  onPlanChange,
}: {
  /** 订单总额（¥）。 */
  totalAmountYuan: number;
  /** 里程碑定义（来自协议 funding.milestones 声明）。 */
  milestones: MilestoneLadderInput[];
  /** Plan 级验收超时缺省（小时，透传 base 引擎）。 */
  defaultTimeoutHours?: number;
  /** 计划变更回调（后续持久化接线位）。 */
  onPlanChange?: (plan: IMilestoneEscrowPlan) => void;
}) {
  const initial = useMemo(
    () =>
      createMilestonePlan(
        Math.round(totalAmountYuan * 100),
        milestones.map((m) => m.ratio),
        milestones.map((m) => ({ title: m.title })),
        defaultTimeoutHours ? { defaultTimeoutHours } : undefined,
      ),
    // 定义与金额在订单生命周期内不变 —— 仅随挂载派生一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [plan, setPlan] = useState(initial);
  // 上线前诚实态：放款走整单路，此处不做本地 RELEASED 翻转（见文件头注释）。

  const apply = (next: IMilestoneEscrowPlan) => {
    setPlan(next);
    onPlanChange?.(next);
  };

  const firstHeldIndex = plan.milestones.findIndex((m) => m.status === "HELD");

  return (
    <DuoCardShell className="mt-3 p-3.5 space-y-2" dataAttrs={{ "data-testid": "milestone-ladder" }}>
      <h4 className="flex items-center gap-1.5 text-xs font-extrabold text-[var(--color-duo-eel)]">
        🪜 里程碑分期托管 ·{" "}
        {milestones.length} 期 · 总额 {fmtYuan(plan.totalAmountCents)}
      </h4>
      <p data-testid="milestone-honesty-note" className="text-[11px] text-[var(--color-duo-wolf)]">
        分阶段放款即将上线，当前订单按整单结算
      </p>
      {plan.milestones.map((m, i) => {
        const meta = STATUS_TONE[m.status];
        return (
          <div
            key={m.id}
            data-testid={`milestone-row-${i}`}
            data-status={m.status}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] px-2.5 py-2"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-duo-swan)] text-[10px] font-extrabold text-[var(--color-duo-eel)]">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-bold text-[var(--color-duo-eel)]">
              {m.title}
              {m.status === "SUBMITTED" && m.submittedAt ? (
                <span className="text-[10px] font-bold text-[var(--color-duo-hare)]"> · 已交验</span>
              ) : null}
            </span>
            <span className="shrink-0 text-xs font-extrabold text-[var(--color-duo-eel)]">
              {fmtYuan(m.amountCents)}
            </span>
            <DuoPill tone={meta.tone} variant="soft" className="shrink-0 whitespace-nowrap text-xs">
              {meta.label}
            </DuoPill>
            {m.status === "HELD" && i === firstHeldIndex && (
              <DuoButton
                size="sm"
                variant="secondary"
                data-testid={`milestone-submit-${i}`}
                onClick={() =>
                  apply(
                    submitMilestoneCheckpoint(plan, m.id, {
                      submittedAt: new Date().toISOString(),
                    }).plan,
                  )
                }
                className="shrink-0"
              >
                提交验收
              </DuoButton>
            )}
            {m.status === "SUBMITTED" && (
              <DuoButton
                size="sm"
                variant="primary"
                data-testid={`milestone-release-${i}`}
                onClick={() =>
                  toast("分阶段放款即将上线，当前订单按整单结算", "info")
                }
                className="shrink-0"
              >
                验收放款
              </DuoButton>
            )}
          </div>
        );
      })}
      <div className="flex justify-between text-xs text-[var(--color-duo-wolf)]">
        <span data-testid="milestone-released-total">
          已放款 {fmtYuan(releasedTotalCents(plan))}
        </span>
        <span data-testid="milestone-frozen">剩余冻结 {fmtYuan(frozenRemainingCents(plan))}</span>
      </div>
    </DuoCardShell>
  );
}

/** 行视图（服务端行投影；金额统一转分参与守恒口径）。 */
interface MilestoneRowVM {
  id: string;
  title: string;
  amountYuan: number;
  stepNumber: number;
  status: MilestoneStatus;
  /** 实放金额（M5 部分放款；缺省回落全额）。 */
  releasedYuan?: number;
}

/** 改期提案视图（M6 · 列表读口投影）。 */
interface AmendProposalVM {
  id: string;
  version: number;
  stages: Array<{ title: string; weightPct: number; acceptance: string }>;
  status: string;
  canDecide: boolean;
  mine?: boolean;
}

/** 改期草稿行（权重文本态，提交时转数，服务端硬校验）。 */
interface AmendDraft {
  title: string;
  weightPct: string;
  acceptance: string;
}
const SUBJECTIVE_ITEMS = [
  { key: "attitude", label: "态度" },
  { key: "appearance", label: "仪容" },
  { key: "restoration", label: "复原" },
] as const;

/**
 * Server 模式梯子（M2 · 行合同 id 驱动）：读 `/api/milestones` 行、
 * 交验/放款调 M1 API。Batch③-0 mutation 范式：先行乐观翻转，
 * 失败回滚＋toast；放款保留二次确认（此时文案为真：对方真收款项）。
 * 无行渲染空（座舱不挂梯子）。
 */
function ServerMilestoneLadder({ contractId }: { contractId: string }) {
  const [rows, setRows] = useState<MilestoneRowVM[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // M5 主观三勾（缺省全勾＝全返；取消勾选按项扣质管费）。
  const [checks, setChecks] = useState({ attitude: true, appearance: true, restoration: true });
  // M6 改期：提案列表＋编辑器开关＋草稿＋重载节拍。
  const [proposals, setProposals] = useState<AmendProposalVM[]>([]);
  const [amendOpen, setAmendOpen] = useState(false);
  const [draft, setDraft] = useState<AmendDraft[]>([]);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(`/api/milestones?contractId=${encodeURIComponent(contractId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const body = (await r.json()) as {
          rows?: Array<{
            id: string;
            title: string;
            amount: number;
            step_number: number;
            status: MilestoneStatus;
          }>;
        };
        if (!alive) return;
        setRows(
          (body.rows ?? [])
            .map((w) => ({
              id: w.id,
              title: w.title,
              amountYuan: Number(w.amount),
              stepNumber: w.step_number,
              status: w.status,
            }))
            .sort((a, b) => a.stepNumber - b.stepNumber),
        );
      })
      .catch(() => {
        if (!alive) return;
        setLoadError(true);
        toast("里程碑计划加载失败，请稍后重试", "error");
      });
    return () => {
      alive = false;
    };
  }, [contractId, reloadTick]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/milestones/amend?contractId=${encodeURIComponent(contractId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const body = (await r.json()) as { proposals?: AmendProposalVM[] };
        if (alive) setProposals(body.proposals ?? []);
      })
      .catch(() => {
        /* 提案读失败静默（行是主体，不阻断梯子） */
      });
    return () => {
      alive = false;
    };
  }, [contractId, reloadTick]);

  if (rows === null) {
    return (
      <DuoCardShell className="mt-3 p-3.5" dataAttrs={{ "data-testid": "milestone-ladder" }}>
        {loadError ? (
          <p data-testid="milestone-error" className="text-xs font-bold text-[var(--color-duo-wolf)]">
            里程碑计划加载失败，请稍后重试
          </p>
        ) : (
          <p data-testid="milestone-loading" className="text-xs text-[var(--color-duo-wolf)]">
            里程碑计划加载中…
          </p>
        )}
      </DuoCardShell>
    );
  }
  if (rows.length === 0) return null;

  // M6 改期：草稿以可改行（PENDING/HELD）预填权重（就近取整，和由服务端硬校验）。
  const openAmend = () => {
    const amendable = (rows ?? []).filter((r) => r.status === "PENDING" || r.status === "HELD");
    const total = amendable.reduce((s, r) => s + r.amountYuan, 0);
    setDraft(
      amendable.map((r) => ({
        title: r.title,
        weightPct: total > 0 ? String(Math.round((r.amountYuan / total) * 100)) : "",
        acceptance: "",
      })),
    );
    setAmendOpen(true);
  };

  const propose = async () => {
    const stages = draft.map((d) => ({
      title: d.title.trim(),
      weightPct: Number(d.weightPct),
      acceptance: d.acceptance.trim(),
    }));
    try {
      const res = await fetch("/api/milestones/amend/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, stages }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      const body = (await res.json()) as { proposalId: string; version: number };
      setProposals((prev) => [
        {
          id: body.proposalId,
          version: body.version,
          stages: stages.map((s) => ({ ...s })),
          status: "PROPOSED",
          canDecide: false,
          mine: true,
        },
        ...prev,
      ]);
      setAmendOpen(false);
      toast("改期已提议，待对方确认", "success");
    } catch {
      toast("改期提议失败（权重和须≡100/需先结算在途验收）", "error");
    }
  };

  const decide = async (id: string, accept: boolean) => {
    try {
      const res = await fetch(`/api/milestones/amend/${encodeURIComponent(id)}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      setProposals((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: accept ? "ACCEPTED" : "REJECTED", canDecide: false } : p,
        ),
      );
      if (accept) setReloadTick((t) => t + 1);
      toast(accept ? "改期已生效" : "已拒绝改期", "success");
    } catch {
      toast("改期裁决失败", "error");
    }
  };

  const totalCents = rows.reduce((s, r) => s + Math.round(r.amountYuan * 100), 0);
  // M5 部分放款：已放款口径取实放（releasedYuan），缺省回落全额。
  const releasedCents = rows
    .filter((r) => r.status === "RELEASED")
    .reduce((s, r) => s + Math.round((r.releasedYuan ?? r.amountYuan) * 100), 0);
  const firstActionIndex = rows.findIndex(
    (r) => r.status === "PENDING" || r.status === "HELD" || r.status === "SUBMITTED",
  );
  const confirmRow = confirmId != null ? (rows.find((r) => r.id === confirmId) ?? null) : null;

  const mutate = async (
    row: MilestoneRowVM,
    action: "submit" | "release",
    next: MilestoneStatus,
    pass?: { attitude: boolean; appearance: boolean; restoration: boolean },
  ) => {
    const prev = rows;
    setRows(prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
    try {
      const res = await fetch(`/api/milestones/${encodeURIComponent(row.id)}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "release" ? JSON.stringify({ pass: pass ?? null }) : undefined,
      });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      if (action === "release") {
        const body = (await res.json().catch(() => null)) as { providerNetYuan?: number } | null;
        if (typeof body?.providerNetYuan === "number") {
          setRows((cur) =>
            (cur ?? []).map((r) => (r.id === row.id ? { ...r, releasedYuan: body.providerNetYuan } : r)),
          );
        }
      }
    } catch {
      setRows(prev);
      toast(action === "submit" ? "提交验收失败，已回滚" : "放款失败，已回滚", "error");
    }
  };

  return (
    <DuoCardShell className="mt-3 p-3.5 space-y-2" dataAttrs={{ "data-testid": "milestone-ladder" }}>
      <h4 className="flex items-center gap-1.5 text-xs font-extrabold text-[var(--color-duo-eel)]">
        🪜 里程碑分期托管 · {rows.length} 期 · 总额 {fmtYuan(totalCents)}
      </h4>
      {rows.map((m, i) => {
        const meta = STATUS_TONE[m.status];
        return (
          <div
            key={m.id}
            data-testid={`milestone-row-${i}`}
            data-status={m.status}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] px-2.5 py-2"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-duo-swan)] text-[10px] font-extrabold text-[var(--color-duo-eel)]">
              {m.stepNumber}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-bold text-[var(--color-duo-eel)]">
              {m.title}
            </span>
            <span className="shrink-0 text-xs font-extrabold text-[var(--color-duo-eel)]">
              {fmtYuan(Math.round(m.amountYuan * 100))}
            </span>
            <DuoPill tone={meta.tone} variant="soft" className="shrink-0 whitespace-nowrap text-xs">
              {meta.label}
            </DuoPill>
            {(m.status === "PENDING" || m.status === "HELD") && i === firstActionIndex && (
              <DuoButton
                size="sm"
                variant="secondary"
                data-testid={`milestone-submit-${i}`}
                onClick={() => void mutate(m, "submit", "SUBMITTED")}
                className="shrink-0"
              >
                提交验收
              </DuoButton>
            )}
            {m.status === "SUBMITTED" && (
              <DuoButton
                size="sm"
                variant="primary"
                data-testid={`milestone-release-${i}`}
                onClick={() => setConfirmId(m.id)}
                className="shrink-0"
              >
                验收放款
              </DuoButton>
            )}
          </div>
        );
      })}
      <div className="flex justify-between text-xs text-[var(--color-duo-wolf)]">
        <span data-testid="milestone-released-total">已放款 {fmtYuan(releasedCents)}</span>
        <span data-testid="milestone-frozen">剩余冻结 {fmtYuan(totalCents - releasedCents)}</span>
      </div>
      <div className="flex justify-end">
        <DuoButton
          size="sm"
          variant="outline"
          data-testid="milestone-amend-open"
          onClick={() => (amendOpen ? setAmendOpen(false) : openAmend())}
          className="shrink-0"
        >
          改期
        </DuoButton>
      </div>
      {amendOpen && (
        <div data-testid="milestone-amend-panel" className="space-y-1.5 rounded-xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] p-2.5">
          {draft.length === 0 ? (
            <p className="text-[11px] text-[var(--color-duo-wolf)]">无可改期阶段（均已放款或在途验收）</p>
          ) : (
            <>
              {draft.map((d, i) => (
                <div key={i} className="flex gap-1.5">
                  <input
                    data-testid={`milestone-amend-title-${i}`}
                    value={d.title}
                    onChange={(e) => setDraft((prev) => prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    placeholder="阶段标题"
                    className="min-w-0 flex-1 rounded-lg border-2 border-[var(--color-duo-swan)] bg-white px-2 py-1.5 text-xs"
                  />
                  <input
                    data-testid={`milestone-amend-weight-${i}`}
                    value={d.weightPct}
                    onChange={(e) => setDraft((prev) => prev.map((x, j) => (j === i ? { ...x, weightPct: e.target.value } : x)))}
                    placeholder="权重%"
                    inputMode="numeric"
                    className="w-16 shrink-0 rounded-lg border-2 border-[var(--color-duo-swan)] bg-white px-2 py-1.5 text-xs"
                  />
                  <input
                    data-testid={`milestone-amend-accept-${i}`}
                    value={d.acceptance}
                    onChange={(e) => setDraft((prev) => prev.map((x, j) => (j === i ? { ...x, acceptance: e.target.value } : x)))}
                    placeholder="验收标准"
                    className="min-w-0 flex-1 rounded-lg border-2 border-[var(--color-duo-swan)] bg-white px-2 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    data-testid={`milestone-amend-remove-${i}`}
                    onClick={() => setDraft((prev) => prev.filter((_, j) => j !== i))}
                    className="shrink-0 rounded-lg px-2 text-xs font-bold text-[var(--color-duo-wolf)]"
                    aria-label={`删除第${i + 1}期`}
                  >
                    删
                  </button>
                </div>
              ))}
              <div className="flex gap-1.5">
                {draft.length < 5 && (
                  <DuoButton
                    size="sm"
                    variant="secondary"
                    data-testid="milestone-amend-add"
                    onClick={() => setDraft((prev) => [...prev, { title: "", weightPct: "", acceptance: "" }])}
                  >
                    ＋加一期
                  </DuoButton>
                )}
                <DuoButton size="sm" variant="primary" data-testid="milestone-amend-propose" onClick={() => void propose()}>
                  提交改期（待对方确认）
                </DuoButton>
              </div>
            </>
          )}
        </div>
      )}
      {proposals
        .filter((p) => p.status === "PROPOSED")
        .map((p) => (
          <div
            key={p.id}
            data-testid={`milestone-amend-proposal-${p.version}`}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] px-2.5 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-xs font-bold text-[var(--color-duo-eel)]">
              改期 v{p.version} · {p.stages.map((s) => `${s.title}${s.weightPct}%`).join("＋")}
            </span>
            <span className="shrink-0 text-[11px] text-[var(--color-duo-wolf)]">
              {p.mine ? "我发起的 · 待对方确认" : p.canDecide ? "对方提案 · 待你确认" : "待确认"}
            </span>
            {p.canDecide && (
              <>
                <DuoButton
                  size="sm"
                  variant="primary"
                  data-testid={`milestone-amend-accept-${p.version}`}
                  onClick={() => void decide(p.id, true)}
                  className="shrink-0"
                >
                  接受
                </DuoButton>
                <DuoButton
                  size="sm"
                  variant="secondary"
                  data-testid={`milestone-amend-reject-${p.version}`}
                  onClick={() => void decide(p.id, false)}
                  className="shrink-0"
                >
                  拒绝
                </DuoButton>
              </>
            )}
          </div>
        ))}
      {confirmRow && (
        <>
          <div data-testid="milestone-checks" className="flex gap-1.5">
            {SUBJECTIVE_ITEMS.map((item) => {
              const on = checks[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  data-testid={`milestone-check-${item.key}`}
                  aria-pressed={on}
                  onClick={() => setChecks((c) => ({ ...c, [item.key]: !c[item.key] }))}
                  className={`touch-target rounded-full border-2 px-2.5 py-1 text-[11px] font-extrabold transition-transform active:scale-95 ${
                    on
                      ? "border-[var(--color-duo-green-dark)] bg-[var(--color-duo-green)] text-neutral-900"
                      : "border-[var(--color-duo-swan)] bg-white text-[var(--color-duo-wolf)]"
                  }`}
                >
                  {on ? "✓" : "✗"} {item.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--color-duo-wolf)]">未勾选按项扣质管费（不退款给客户，退只走取消/争议）</p>
          <ConfirmSheet
            title="确认本期放款？"
            body={`放款后不可撤销，对方将收到本期 ${fmtYuan(Math.round(confirmRow.amountYuan * 100))}。`}
            danger
            confirmLabel="确认放款"
            onConfirm={() => {
              setConfirmId(null);
              void mutate(confirmRow, "release", "RELEASED", { ...checks });
            }}
            onCancel={() => setConfirmId(null)}
          />
        </>
      )}
    </DuoCardShell>
  );
}

export default function MilestoneLadder(props: {
  totalAmountYuan?: number;
  milestones?: MilestoneLadderInput[];
  defaultTimeoutHours?: number;
  onPlanChange?: (plan: IMilestoneEscrowPlan) => void;
  /** M2：行合同 id（server 模式：读行＋调 M1 API，诚实横幅下线）。 */
  contractId?: string;
}) {
  if (props.contractId) return <ServerMilestoneLadder contractId={props.contractId} />;
  return (
    <LegacyMilestoneLadder
      totalAmountYuan={props.totalAmountYuan ?? 0}
      milestones={props.milestones ?? []}
      defaultTimeoutHours={props.defaultTimeoutHours}
      onPlanChange={props.onPlanChange}
    />
  );
}
