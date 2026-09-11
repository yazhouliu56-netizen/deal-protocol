"use client";

import { useEffect } from "react";

/**
 * 根 layout 本体异常兜底（Batch② loading/error 矩阵 · Next 16.2 契约）。
 * 自带 document（global styles 不可用 → 全内联样式，Duo 色值硬编码）。
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f7f7",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
        data-testid="global-error"
      >
        <div
          style={{
            background: "#fff",
            border: "2px solid #e5e5e5",
            borderBottomWidth: 6,
            borderRadius: 24,
            padding: 24,
            maxWidth: 320,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 36 }}>🛠️</div>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#4b4b4b", margin: "8px 0" }}>
            页面开小差了
          </p>
          <p style={{ fontSize: 12, color: "#767676", margin: "0 0 12px" }}>
            加载遇到意外问题，重试即可恢复
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            data-testid="global-error-retry"
            style={{
              background: "#58cc02",
              border: "none",
              borderBottom: "4px solid #58a700",
              borderRadius: 999,
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 800,
              color: "#1a1a1a",
              cursor: "pointer",
            }}
          >
            重新加载
          </button>
        </div>
      </body>
    </html>
  );
}
