"use client";

import { useMemo, useState } from "react";
import ConfirmSheet from "@/components/ui/ConfirmSheet";
import DuoButton from "@/components/ui/DuoButton";
import DuoCardShell from "@/components/ui/DuoCardShell";
import DuoPill, { type DuoPillTone } from "@/components/ui/DuoPill";
import {
  createMilestonePlan,
  releaseMilestone,
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
 * 持久化说明：当前批次无 milestone_schedules 写入 API，计划状态为组件内
 * 确定性重放（同输入必同状态）；onPlanChange 钩子预留给后续持久化接线。
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

export default function MilestoneLadder({
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
  // 分期放款二次确认：待确认的里程碑 id（null = 未弹层）
  const [confirmReleaseId, setConfirmReleaseId] = useState<string | null>(null);

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
                onClick={() => setConfirmReleaseId(m.id)}
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
      {/* 分期放款二次确认（Batch②：直调改显式确认，放款不可逆） */}
      {confirmReleaseId != null && (
        <ConfirmSheet
          title="确认本期放款？"
          body="放款后不可撤销，对方将收到本期款项。"
          danger
          confirmLabel="确认放款"
          onConfirm={() => {
            apply(releaseMilestone(plan, confirmReleaseId).plan);
            setConfirmReleaseId(null);
          }}
          onCancel={() => setConfirmReleaseId(null)}
        />
      )}
    </DuoCardShell>
  );
}
