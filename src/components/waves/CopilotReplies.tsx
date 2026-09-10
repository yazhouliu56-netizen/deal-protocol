"use client";

import { trackMetric } from "@/lib/track-metric";
import { toast } from "@/base/platform/toast";

/**
 * 副驾 MVP 切片（P3-T3）：一键标准回复（复制版）。
 * 无消息送达通道——点即复制文本（A5 分享键同 pattern），用户自行粘贴发送，
 * 零假按钮。完整副驾（顺路参谋/政策问答）等数据源，手册已注记延期。
 */
export const QUICK_REPLIES = [
  "师傅，我到楼下了，到了叫我一声",
  "时间有点变动，稍后跟你确认新的时间",
  "收到，辛苦了，谢谢师傅",
] as const;

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export default function CopilotReplies() {
  return (
    <div data-testid="copilot-replies" className="mb-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-bold text-[var(--color-duo-hare)]">快捷回复</span>
      {QUICK_REPLIES.map((q) => (
        <button
          key={q}
          onClick={() => {
            void (async () => {
              const ok = await copyText(q);
              try {
                trackMetric("copilot.used", 1, { kind: "quick-reply" });
              } catch {}
              toast(ok ? "已复制，去聊天里粘贴发送" : "复制失败，长按手动复制", ok ? "success" : "error");
            })();
          }}
          aria-label={`复制快捷回复：${q.slice(0, 8)}`}
          className="px-2.5 min-h-8 rounded-full text-xs font-bold bg-white border-2 border-[var(--color-duo-swan)] text-[var(--color-duo-blue-ink)]"
        >
          {q.length > 10 ? `${q.slice(0, 10)}…` : q}
        </button>
      ))}
    </div>
  );
}
