"use client"

import { Toaster } from "react-hot-toast"
import { ErrorBoundary } from "react-error-boundary"
import { AlertTriangle, RefreshCw } from "lucide-react"

function FallbackComponent({ resetErrorBoundary }: { resetErrorBoundary?: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8" role="alert">
      <div className="mx-auto max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-950/30">
          <AlertTriangle className="size-7 text-rose-600 dark:text-rose-400" />
        </div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">页面出现异常</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
          抱歉，当前页面遇到了意外错误。请尝试刷新页面，或联系客服获取帮助。
        </p>
        <button
          onClick={resetErrorBoundary}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.97]"
        >
          <RefreshCw className="size-4" />
          刷新重试
        </button>
      </div>
    </div>
  )
}

export function UXProvider({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary FallbackComponent={FallbackComponent} onReset={() => typeof window !== "undefined" && window.location.reload()}>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      {children}
    </ErrorBoundary>
  )
}
