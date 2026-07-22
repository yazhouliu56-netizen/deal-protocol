"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button";

export interface OperationContract {
  id: string;
  fund_status?: string;
  fundStatus?: string;
  service_stage?: number;
  serviceStage?: number;
  customer: { id: string };
  provider: { id: string };
  payments: { status: string }[];
  reviews: { id: string }[];
  protocolInfo?: {
    serviceStages: string[];
    fundingMode: string;
  } | null;
  availableActions?: Array<{ action: string; toFundStatus?: string; toStage?: number }>;
}

interface OperationDef {
  action: string;
  label: string;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link";
  requiresConfirm?: boolean;
  confirmMessage?: string;
  requiresReason?: boolean;
  requiresEvidence?: boolean;
}

const operationLabels: Record<string, OperationDef> = {
  pay: { action: "pay", label: "立即支付", variant: "default" },
  customer_pay: { action: "customer_pay", label: "支付押金", variant: "default" },
  provider_pay: { action: "provider_pay", label: "支付押金", variant: "default" },
  cancel_before_pay: { action: "cancel_before_pay", label: "取消订单", variant: "outline", requiresConfirm: true, confirmMessage: "确定要取消该订单吗？" },
  cancel_during_service: { action: "cancel_during_service", label: "取消服务", variant: "destructive", requiresConfirm: true, confirmMessage: "取消服务将按阶段比例退款，确定取消？" },
  mutual_cancel: { action: "mutual_cancel", label: "取消预约", variant: "outline", requiresConfirm: true, confirmMessage: "确定取消？" },
  provider_accept: { action: "provider_accept", label: "接单", variant: "default" },
  provider_depart: { action: "provider_depart", label: "出发", variant: "secondary" },
  provider_arrive: { action: "provider_arrive", label: "到达", variant: "secondary" },
  start_service: { action: "start_service", label: "开始服务", variant: "default" },
  request_complete: { action: "request_complete", label: "请求完成", variant: "default" },
  confirm_complete: { action: "confirm_complete", label: "确认完成", variant: "default" },
  confirm_arrival: { action: "confirm_arrival", label: "确认到场", variant: "secondary" },
  open_dispute: { action: "open_dispute", label: "发起争议", variant: "destructive", requiresReason: true, requiresEvidence: true },
  report_no_show: { action: "report_no_show", label: "举报未到", variant: "destructive", requiresReason: true },
}

interface OrderOperationsProps {
  contract: OperationContract;
  orderId: string;
  userRole: string;
  onActionSuccess: () => void;
}

export default function OrderOperations({
  contract,
  orderId,
  userRole,
  onActionSuccess,
}: OrderOperationsProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (action: string, extra?: Record<string, string | undefined>) => {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, role: userRole, ...extra }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "操作失败");
        return;
      }

      toast.success("操作成功！");
      onActionSuccess();
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setActionLoading(null);
    }
  };

  const handleOperation = (op: OperationDef) => {
    if (op.requiresConfirm) {
      const confirmed = window.confirm(op.confirmMessage || "确定执行此操作？");
      if (!confirmed) return;
    }

    let reason: string | undefined;
    let evidence: string | undefined;

    if (op.requiresReason) {
      const input = window.prompt("请输入原因：");
      if (!input || input.trim() === "") {
        toast.error("请填写原因");
        return;
      }
      reason = input;
    }

    if (op.requiresEvidence) {
      const input = window.prompt("请输入证据描述（可选）：");
      if (input) evidence = input;
    }

    handleAction(op.action, { reason, evidence });
  };

  const fundStatus = contract.fund_status || contract.fundStatus || '';
  const serviceStage = contract.service_stage ?? contract.serviceStage ?? 0;

  const visibleActions = (contract.availableActions ?? [])
    .map((a) => operationLabels[a.action])
    .filter(Boolean) as OperationDef[];

  const showReview =
    userRole === "CUSTOMER" &&
    (fundStatus === "COMPLETED" || fundStatus === "SATISFACTION_HELD") &&
    contract.reviews.length === 0;

  if (visibleActions.length === 0 && !showReview) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {visibleActions.map((op) => (
        <Button
          key={op.action}
          variant={op.variant || "default"}
          size="lg"
          onClick={() => handleOperation(op)}
          disabled={actionLoading === op.action}
          className="touch-target touch-feedback"
        >
          {actionLoading === op.action ? "处理中..." : op.label}
        </Button>
      ))}

      {showReview && (
        <Link href={`/orders/${orderId}/review`}>
          <Button variant="outline" size="lg" className="touch-target touch-feedback">
            评价服务
          </Button>
        </Link>
      )}
    </div>
  );
}
