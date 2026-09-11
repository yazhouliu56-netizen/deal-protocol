"use client";

import { useEffect, type ReactNode, type Ref } from "react";

/** 暗色弹层三处壳正典（P9-3 收敛值；z 由调用方按原层级透传，行为零漂移） */
export const DARK_SHEET_CSS = `
.dsheet-mask{position:fixed;inset:0;background:rgba(5,6,15,.62);
  backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);
  -webkit-tap-highlight-color:transparent}
.dsheet-panel{position:fixed;inset-inline:0;bottom:0;max-width:520px;margin:0 auto;
  transition:transform .2s cubic-bezier(.16,1,.3,1),opacity .2s cubic-bezier(.16,1,.3,1)}
.dsheet-dismissing{transform:translateY(105%);opacity:0}
.dsheet-grip{width:44px;height:4px;border-radius:999px;background:rgba(255,255,255,.28);
  margin:4px auto 10px;cursor:grab;touch-action:none}
`;

interface DarkSheetShellProps {
  onClose: () => void;
  children: ReactNode;
  /** 遮罩 z（原值透传：arb 80 / auth 90 / prep 90，层叠行为守恒） */
  maskZ: number;
  /** 面板 z（原值透传：arb 81 / auth 91 / prep 91） */
  panelZ: number;
  /** 面板视觉类（各弹层自有暗色 CSS 保留：arb-sheet/auth-sheet/prep-sheet-card） */
  panelClass: string;
  dismissing?: boolean;
  /** 拖拽把手 ref（arb/auth 接 useDragToDismiss；prep 不传即静态把手） */
  gripRef?: Ref<HTMLDivElement>;
  /** PrePermission 权限门强制二选一：遮罩不可点 */
  maskClosable?: boolean;
  maskTestId?: string;
  panelTestId?: string;
  ariaLabel?: string;
}

/**
 * 暗色底弹层结构壳（P9-3）：收敛 arb/auth/prep 三处遮罩/面板/grip/dismiss 接线。
 * 面板视觉（渐变/圆角/辉光）各弹层保留，壳只给结构定位 + 正典遮罩/grip/dismiss；
 * data-action="mask/drag-grip" 常驻（FulfillmentE2EIntegration 点击契约）。
 */
export default function DarkSheetShell({
  onClose,
  children,
  maskZ,
  panelZ,
  panelClass,
  dismissing = false,
  gripRef,
  maskClosable = true,
  maskTestId,
  panelTestId,
  ariaLabel,
}: DarkSheetShellProps) {
  // Esc 关闭（与 SheetShell 同权；maskClosable=false 的强制二选一门不放行 Esc，不断产品语义）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && maskClosable !== false) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, maskClosable]);
  return (
    <>
      <style>{DARK_SHEET_CSS}</style>
      <div
        className="dsheet-mask"
        style={{ zIndex: maskZ }}
        onClick={maskClosable ? onClose : undefined}
        data-action="mask"
        data-testid={maskTestId}
      />
      <div
        className={`dsheet-panel ${panelClass}${dismissing ? " dsheet-dismissing" : ""}`}
        style={{ zIndex: panelZ }}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        data-testid={panelTestId}
      >
        <div
          className="dsheet-grip"
          ref={gripRef}
          data-action="drag-grip"
          aria-hidden="true"
        />
        {children}
      </div>
    </>
  );
}
