"use client"

import { Toaster } from "react-hot-toast"
import { ErrorBoundary } from "react-error-boundary"

function FallbackComponent() {
  return (
    <div className="p-8 text-center text-red-500">
      页面发生异常，请刷新重试
    </div>
  )
}

export function UXProvider({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary FallbackComponent={FallbackComponent}>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      {children}
    </ErrorBoundary>
  )
}
