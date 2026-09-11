"use client";

import SheetShell, { SheetClose } from "./SheetShell";
import DuoButton from "./DuoButton";

interface ConfirmSheetProps {
  /** 标题（如“确认放款？”） */
  title: string;
  /** 说明文案：讲清后果与可逆性（如“放款后不可撤销”） */
  body: string;
  /** 确认键文案，默认“确认” */
  confirmLabel?: string;
  /** 取消键文案，默认“再想想” */
  cancelLabel?: string;
  /** 危险确认（放款/删除类）：确认键走 danger 变体 */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  panelTestId?: string;
}

/**
 * 高危操作统一二次确认（资金放款/评价提交/举报提交）。
 * SheetShell 壳：遮罩点按 + Esc 均为取消语义；确认必须显式按键（防误触，无自动倒计时确认）。
 */
export default function ConfirmSheet({
  title,
  body,
  confirmLabel = "确认",
  cancelLabel = "再想想",
  danger = false,
  onConfirm,
  onCancel,
  panelTestId = "confirm-sheet",
}: ConfirmSheetProps) {
  return (
    <SheetShell onClose={onCancel} panelTestId={panelTestId}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-black text-[var(--color-duo-eel)]">{title}</h2>
        <SheetClose onClose={onCancel} label="取消确认" />
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-duo-wolf)]">{body}</p>
      <div className="mt-4 flex gap-2">
        <DuoButton
          variant="secondary"
          sound="click"
          onClick={onCancel}
          data-testid="confirm-cancel"
          className="flex-1"
        >
          {cancelLabel}
        </DuoButton>
        <DuoButton
          variant={danger ? "danger" : "primary"}
          sound={danger ? "error" : "correct"}
          onClick={onConfirm}
          data-testid="confirm-ok"
          className="flex-1"
        >
          {confirmLabel}
        </DuoButton>
      </div>
    </SheetShell>
  );
}
