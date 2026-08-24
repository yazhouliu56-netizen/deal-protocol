"use client";

import { useMemo, useState } from "react";
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
 */

const STATUS_META: Record<MilestoneStatus, { label: string; color: string }> = {
  PENDING: { label: "待生效", color: "#94a3b8" },
  HELD: { label: "托管中", color: "#fbbf24" },
  SUBMITTED: { label: "待验收", color: "#60a5fa" },
  RELEASED: { label: "已放款", color: "#4ade80" },
  REFUNDED: { label: "已退款", color: "#f87171" },
};

const LADDER_CSS = `
.ms-ladder{margin-top:12px;padding:12px;border-radius:16px;background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.1);font-size:12px;color:#e2e8f0}
.ms-ladder h4{margin:0 0 8px;font-size:12px;color:#94a3b8;display:flex;align-items:center;gap:6px}
.ms-row{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:11px;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);margin-bottom:6px}
.ms-step{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:10px;font-weight:800;background:rgba(123,97,255,.2);color:#c4b5fd;flex-shrink:0}
.ms-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ms-amount{font-weight:700;color:#cbd5e1;flex-shrink:0}
.ms-chip{font-size:10px;font-weight:800;padding:2px 7px;border-radius:999px;flex-shrink:0;
  border:1px solid currentColor}
.ms-btn{border:none;border-radius:9px;padding:5px 10px;font-size:10.5px;font-weight:800;cursor:pointer;
  flex-shrink:0;transition:filter .15s}
.ms-btn:active{transform:scale(.97)}
.ms-btn-submit{background:rgba(96,165,250,.18);border:1px solid rgba(96,165,250,.45);color:#93c5fd}
.ms-btn-release{background:linear-gradient(135deg,#4ade80,#16a34a);color:#04120a}
.ms-foot{display:flex;justify-content:space-between;margin-top:4px;color:#94a3b8;font-size:11px}
`;

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

  const apply = (next: IMilestoneEscrowPlan) => {
    setPlan(next);
    onPlanChange?.(next);
  };

  const firstHeldIndex = plan.milestones.findIndex((m) => m.status === "HELD");

  return (
    <div className="ms-ladder" data-testid="milestone-ladder">
      <style>{LADDER_CSS}</style>
      <h4>
        🪜 里程碑分期托管 ·{" "}
        {milestones.length} 期 · 总额 {fmtYuan(plan.totalAmountCents)}
      </h4>
      {plan.milestones.map((m, i) => {
        const meta = STATUS_META[m.status];
        return (
          <div key={m.id} className="ms-row" data-testid={`milestone-row-${i}`} data-status={m.status}>
            <span className="ms-step">{i + 1}</span>
            <span className="ms-title">
              {m.title}
              {m.status === "SUBMITTED" && m.submittedAt ? (
                <span style={{ color: "#94a3b8", fontSize: 10 }}> · 已交验</span>
              ) : null}
            </span>
            <span className="ms-amount">{fmtYuan(m.amountCents)}</span>
            <span className="ms-chip" style={{ color: meta.color }}>
              {meta.label}
            </span>
            {m.status === "HELD" && i === firstHeldIndex && (
              <button
                type="button"
                className="ms-btn ms-btn-submit"
                data-testid={`milestone-submit-${i}`}
                onClick={() =>
                  apply(
                    submitMilestoneCheckpoint(plan, m.id, {
                      submittedAt: new Date().toISOString(),
                    }).plan,
                  )
                }
              >
                提交验收
              </button>
            )}
            {m.status === "SUBMITTED" && (
              <button
                type="button"
                className="ms-btn ms-btn-release"
                data-testid={`milestone-release-${i}`}
                onClick={() => apply(releaseMilestone(plan, m.id).plan)}
              >
                验收放款
              </button>
            )}
          </div>
        );
      })}
      <div className="ms-foot">
        <span data-testid="milestone-released-total">
          已放款 {fmtYuan(releasedTotalCents(plan))}
        </span>
        <span data-testid="milestone-frozen">剩余冻结 {fmtYuan(frozenRemainingCents(plan))}</span>
      </div>
    </div>
  );
}
