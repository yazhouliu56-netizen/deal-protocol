"use client"

import DuoButton from "@/components/ui/DuoButton";

/** 管理后台错误边界（Batch②-2 admin 轨 Duo 化 · Next 16.2 契约：unstable_retry）。 */
export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center px-4 py-16 text-center"
      data-testid="admin-error"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-3xl border-2 border-[var(--color-duo-swan)] border-b-[6px] bg-white p-6">
        <span className="text-4xl" aria-hidden="true">🛠️</span>
        <h2 className="text-lg font-extrabold text-[var(--color-duo-eel)]">管理后台加载异常</h2>
        <p className="text-xs text-[var(--color-duo-wolf)]">
          {error.message || "管理后台数据加载失败，请稍后重试"}
        </p>
        <DuoButton variant="primary" size="md" sound="click" onClick={() => unstable_retry()}>
          重新加载
        </DuoButton>
      </div>
    </div>
  );
}
