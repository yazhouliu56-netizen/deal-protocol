"use client";
import DuoButton from "@/components/ui/DuoButton";

export type BlockedReason = "sentinel" | "contact-leak" | "minor" | "debt" | "roam" | "generic";

const COPY: Record<BlockedReason, { title: string; desc: string }> = {
  "contact-leak": {
    title: "💡 温馨提示：检测到可能包含私密联系方式",
    desc: "已自动帮您脱敏保护隐私，可直接继续发单，平台全程守护交易安全。",
  },
  sentinel: {
    title: "💡 温馨提示：账号安全守护中",
    desc: "检测到高危信号，已为您开启保护，可前往安全中心查看详情后继续发单。",
  },
  minor: {
    title: "💡 温馨提示：未成年人发布需监护人同意",
    desc: "已为您保留草稿，监护人同意后即可正常发单，平台陪伴安全成长。",
  },
  debt: {
    title: "💡 温馨提示：有未结清履约单",
    desc: "先结清上一单即可继续发单，平台帮您记录每一份信用。",
  },
  roam: {
    title: "💡 温馨提示：检测到多设备登录",
    desc: "已为您开启安全校验，核对设备后即可继续发单。",
  },
  generic: {
    title: "💡 温馨提示：信息需稍作调整",
    desc: "已为您标注需调整项，修改后即可继续发单。",
  },
};

interface PublishErrorRecoveryCardProps {
  reason: BlockedReason;
  onAction?: () => void;
}

export default function PublishErrorRecoveryCard({ reason, onAction }: PublishErrorRecoveryCardProps) {
  const c = COPY[reason] ?? COPY.generic;
  return (
    <div
      data-testid="error-recovery-card"
      className="rounded-2xl bg-[#fff7ed] border-2 border-[#ffedd5] border-b-4 p-4 flex flex-col gap-2 shadow-sm"
    >
      <p className="text-xs font-extrabold text-[#9a3412]">{c.title}</p>
      <p className="text-xs text-[#c2410c] leading-relaxed">{c.desc}</p>
      <DuoButton variant="outline" size="sm" onClick={onAction} data-testid="error-recovery-action">
        一键了解 / 安全指引
      </DuoButton>
    </div>
  );
}

export function mapBlockedToReason(error: string): BlockedReason {
  if (!error) return "generic";
  if (error.includes("联系方式") || error.includes("私密")) return "contact-leak";
  if (error.includes("多开") || error.includes("高危信号") || error.includes("探针")) return "sentinel";
  if (error.includes("未成年人")) return "minor";
  if (error.includes("no-show") || error.includes("未结清")) return "debt";
  if (error.includes("多设备") || error.includes("漫游")) return "roam";
  return "generic";
}
