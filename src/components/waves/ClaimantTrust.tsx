"use client";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export interface ClaimantTrustProfile {
  credit_score?: number | null;
  dispute_losses?: number | null;
  is_online?: boolean | null;
}

/**
 * 接单人信任三事实（P16-① · 只读展示，不建表不碰匹配逻辑）：
 * 信用分（沿 profile 页 X/300 口径）+ 历史纠纷 + 在线态。
 * 数据缺席/失败一律静默不渲染（条文 #10），绝不编造。
 */
export function describeTrust(p: ClaimantTrustProfile | null): string[] | null {
  if (!p) return null;
  const lines: string[] = [];
  if (typeof p.credit_score === "number" && Number.isFinite(p.credit_score)) {
    lines.push(`信用 ${Math.max(0, Math.floor(p.credit_score))} / 300`);
  }
  if (typeof p.dispute_losses === "number" && Number.isFinite(p.dispute_losses)) {
    lines.push(p.dispute_losses <= 0 ? "历史零纠纷" : `历史纠纷 ${Math.floor(p.dispute_losses)} 次`);
  }
  if (typeof p.is_online === "boolean") {
    lines.push(p.is_online ? "🟢 在线可接" : "⚪ 当前离线");
  }
  return lines.length > 0 ? lines : null;
}

export default function ClaimantTrust({ responderId }: { responderId: string }) {
  const [lines, setLines] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = getBrowserSupabase();
        const { data, error } = await supabase
          .from("profiles")
          .select("credit_score, dispute_losses, is_online")
          .eq("id", responderId)
          .single();
        if (!cancelled && !error && data) {
          setLines(describeTrust(data as ClaimantTrustProfile));
        }
      } catch {
        /* 静默：无信任 Trace 不阻断谈成主流程 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [responderId]);

  if (!lines) return null;
  return (
    <div data-testid="claimant-trust" className="rounded-xl bg-white border border-[var(--color-duo-swan)] px-2.5 py-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-xs font-bold text-[var(--color-duo-blue-ink)] flex items-center gap-1"
      >
        {open ? "▾" : "▸"} 为什么信他
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5">
          {lines.map((l) => (
            <li key={l} className="text-xs text-[var(--color-duo-wolf)]">
              · {l}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
