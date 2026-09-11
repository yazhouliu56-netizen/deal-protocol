import Link from "next/link";

/**
 * 根级 404（Batch② loading/error 矩阵）。
 * 覆盖：非法 URL + 段内 notFound()（如 demands/[id] 三分支）。
 * 纯服务端渲染、零 JS 依赖：断网/JS 失败时仍可回首页。
 */
export default function RootNotFound() {
  return (
    <div
      className="flex min-h-[70vh] items-center justify-center bg-[var(--color-duo-polar)] px-4 py-10"
      data-testid="root-not-found"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-3xl border-2 border-[var(--color-duo-swan)] border-b-[6px] bg-white p-6 text-center">
        <span className="text-4xl" aria-hidden="true">🧭</span>
        <p className="text-lg font-extrabold text-[var(--color-duo-eel)]">页面走丢了</p>
        <p className="text-xs text-[var(--color-duo-wolf)]">
          链接可能已失效，或该需求你无权查看
        </p>
        <Link
          href="/"
          data-testid="root-not-found-home"
          className="mt-2 inline-flex min-h-10 items-center rounded-full border-b-4 border-[var(--color-duo-green-dark)] bg-[var(--color-duo-green)] px-6 text-sm font-extrabold text-neutral-900 active:translate-y-0.5 active:border-b-2"
        >
          回首页
        </Link>
      </div>
    </div>
  );
}
