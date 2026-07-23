import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80dvh] px-6 text-center">
      <div className="text-7xl mb-6 text-slate-400 dark:text-zinc-500">📡</div>
      <h1 className="text-2xl font-bold mb-3 text-slate-800 dark:text-zinc-100">
        网络已断开
      </h1>
      <p className="text-slate-500 dark:text-zinc-400 max-w-md mb-8 leading-relaxed">
        当前处于离线状态，部分功能暂不可用。
        请检查网络连接后重试。
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-zinc-700 dark:hover:bg-zinc-600"
      >
        重试连接
      </Link>
    </div>
  );
}
