"use client";

import { useEffect } from "react";
import DuoButton from "@/components/ui/DuoButton";

/**
 * 根级错误边界（Batch② loading/error 矩阵 · Next 16.2 契约：unstable_retry）。
 * 包住 loading / not-found / page 与嵌套 layout；根 layout 本体异常走 global-error。
 */
export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[root-error]", error);
  }, [error]);

  return (
    <div
      className="flex min-h-[70vh] items-center justify-center bg-[var(--color-duo-polar)] px-4 py-10"
      data-testid="root-error"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-3xl border-2 border-[var(--color-duo-swan)] border-b-[6px] bg-white p-6 text-center">
        <span className="text-4xl" aria-hidden="true">🛠️</span>
        <p className="text-lg font-extrabold text-[var(--color-duo-eel)]">页面开小差了</p>
        <p className="text-xs text-[var(--color-duo-wolf)]">
          {error.message || "加载遇到意外问题，重试即可恢复"}
        </p>
        {error.digest && (
          <p className="text-[10px] text-[var(--color-duo-hare)]">digest: {error.digest}</p>
        )}
        <DuoButton
          variant="primary"
          size="md"
          sound="click"
          onClick={() => unstable_retry()}
          data-testid="root-error-retry"
        >
          重新加载
        </DuoButton>
      </div>
    </div>
  );
}
