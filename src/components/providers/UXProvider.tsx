"use client"

import { ErrorBoundary } from "react-error-boundary"
import { MotionConfig } from "framer-motion"
import { AlertTriangle, RefreshCw } from "lucide-react"

function FallbackComponent({ resetErrorBoundary }: { resetErrorBoundary?: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8" role="alert">
      <div className="mx-auto max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100">
          <AlertTriangle className="size-7 text-rose-600" />
        </div>
        <h2 className="text-lg font-bold text-zinc-900">页面出现异常</h2>
        <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
          抱歉，当前页面遇到了意外错误。请尝试刷新页面，或联系客服获取帮助。
        </p>
        <button
          onClick={resetErrorBoundary}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--color-duo-blue)] border-b-4 border-[var(--color-duo-blue-dark)] px-5 py-2.5 min-h-12 text-sm font-bold text-neutral-900 transition-[transform,filter] hover:brightness-[1.03] active:translate-y-1 active:border-b-0"
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
      {/* 系统“减少动态”偏好全局直通：全仓 framer 动效自动落终态（与 CSS reduced-motion 块同构） */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ErrorBoundary>
  )
}
