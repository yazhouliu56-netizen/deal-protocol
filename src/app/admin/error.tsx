"use client"

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-950/30 mb-4">
        <svg className="size-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-zinc-100 mb-2">管理后台加载异常</h2>
      <p className="text-sm text-zinc-400 mb-6 max-w-md">{error.message || "管理后台数据加载失败，请稍后重试"}</p>
      <button
        onClick={reset}
        className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition"
      >
        重新加载
      </button>
    </div>
  )
}
