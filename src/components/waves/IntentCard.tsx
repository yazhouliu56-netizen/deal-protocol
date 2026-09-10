"use client";

import { useEffect, useRef, useState } from "react";
import DuoButton from "@/components/ui/DuoButton";
import { trackMetric } from "@/lib/track-metric";
import { aiLevelOf } from "@/base/order/intent-card";
import type { IntentCard as IntentCardData, ProviderPreview } from "@/types/intent-card";
import type { ResponderCapability } from "@/base/dispatch/broadcast";

/**
 * P2-T7：撮合投影只读映射（按 rating 取前 3，不改排序源）。
 * 纯函数，可单测。
 */
export function pickProviderPreview(responders: ResponderCapability[]): ProviderPreview[] {
  return [...responders]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 3)
    .map((r) => ({
      name: r.nickname || `服务者·${r.id.slice(-4)}`,
      trust: typeof r.rating === "number" ? `信用${Math.round(r.rating * 20)}分` : "新服务者",
    }));
}

/**
 * 意图卡（P1-T3）。母本：意图卡开工规格 v1.0 §2-§5。
 * 三态＋stale；组装 stagger 点亮＋8s 兜底；价格唯一暖色；AI 标三级；
 * 发射需勾选知晓；价格重算 1s 内发射禁用；长辈态（mode=elder）。
 */

const REVEAL_MS = 300;
const ASSEMBLE_CAP_MS = 8000;
const PRICE_FREEZE_MS = 1000;

export default function IntentCard({
  card,
  mode = "std",
  flashText = null,
  priceTick = 0,
  onEditLine,
  onRelaunch,
  onLaunch,
}: {
  card: IntentCardData;
  mode?: "std" | "elder";
  /** 价格差值闪现文案（"＋¥10，因加洗油烟机"），由父级在重算时传入。 */
  flashText?: string | null;
  /** 价格变化计数（父级每次重算＋1），用于发射冻结窗。 */
  priceTick?: number;
  onEditLine: (key: string, value: string) => void;
  onRelaunch: () => void;
  onLaunch: () => void;
}) {
  const totalRows = card.lines.length + 2; // 事实行＋价格行＋保障行
  const [revealed, setRevealed] = useState(card.state === "assembling" ? 0 : totalRows);
  const [ack, setAck] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [openMark, setOpenMark] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const staleRef = useRef(false);

  // P1-T7：stale 渲染即上报（单卡一次）
  useEffect(() => {
    if (card.state === "stale" && !staleRef.current) {
      staleRef.current = true;
      try {
        trackMetric("intent.stale", 1, {});
      } catch {}
    }
  }, [card.state]);

  // stagger 点亮＋8s 兜底全显（render 期同步重置，替代 setState-in-effect， house 体例见 PublishSheet）
  const revealKey = `${card.id}:${card.state}`;
  const [lastRevealKey, setLastRevealKey] = useState(revealKey);
  if (revealKey !== lastRevealKey) {
    setLastRevealKey(revealKey);
    setRevealed(card.state === "assembling" ? 0 : totalRows);
  }
  useEffect(() => {
    if (card.state !== "assembling") return;
    const step = window.setInterval(() => {
      setRevealed((r) => (r >= totalRows ? r : r + 1));
    }, REVEAL_MS);
    const cap = window.setTimeout(() => setRevealed(totalRows), ASSEMBLE_CAP_MS);
    return () => {
      window.clearInterval(step);
      window.clearTimeout(cap);
    };
  }, [card.state, card.id, totalRows]);

  // 价格重算 1s 内发射冻结（冻结置位 render 期同步，解冻走定时器）
  const [lastTick, setLastTick] = useState(0);
  if (priceTick !== lastTick) {
    setLastTick(priceTick);
    if (priceTick !== 0) setFrozen(true);
  }
  useEffect(() => {
    if (priceTick === 0) return;
    const t = window.setTimeout(() => setFrozen(false), PRICE_FREEZE_MS);
    return () => window.clearTimeout(t);
  }, [priceTick]);

  if (card.state === "locked") {
    return (
      <div data-testid="intent-locked" className="rounded-3xl border-2 border-[var(--color-duo-green)] bg-white p-3">
        <p className="text-[13px] font-extrabold text-[var(--color-duo-eel)]">{card.title}</p>
        <p className="mt-1 inline-block rounded-full bg-orange-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
          已锁 ¥{card.price.totalYuan}
        </p>
      </div>
    );
  }

  if (card.state === "stale") {
    return (
      <div data-testid="intent-stale" className="rounded-3xl border-2 border-[var(--color-duo-swan)] bg-[var(--color-duo-polar)] p-3 opacity-70">
        <p className="text-[13px] font-bold text-[var(--color-duo-hare)]">{card.title}（价格可能变动）</p>
        <DuoButton variant="outline" size="sm" className="mt-2" onClick={onRelaunch}>
          重新组装
        </DuoButton>
      </div>
    );
  }

  if (mode === "elder") {
    return (
      <div data-testid="intent-elder" className="rounded-3xl border-2 border-[var(--color-duo-swan)] bg-white p-4">
        <p className="text-lg font-extrabold text-[var(--color-duo-eel)]">{card.title}</p>
        <p className="mt-1 text-2xl font-extrabold text-orange-600">¥{card.price.totalYuan}</p>
        <p className="mt-1 text-sm text-[var(--color-duo-hare)]">{card.price.refundRule}</p>
        <DuoButton variant="primary" size="md" sound="correct" fullWidth className="mt-3" onClick={onLaunch}>
          发射🚀
        </DuoButton>
      </div>
    );
  }

  const showRows = card.state === "ready" ? totalRows : revealed;
  return (
    <div data-testid="intent-card" className="rounded-3xl border-2 border-[var(--color-duo-swan)] bg-white p-3">
      <p className="text-[13px] font-extrabold text-[var(--color-duo-eel)]">{card.title}</p>

      {/* 事实行 */}
      <div className="mt-2 space-y-1">
        {card.lines.slice(0, Math.max(0, showRows)).map((l) => {
          const mark = card.aiMarks.find((m) => m.lineKey === l.key);
          const level = l.source === "ai" ? aiLevelOf(l.confidence ?? 0.8) : null;
          return (
            <div key={l.key} className="flex items-center gap-1.5 text-xs">
              <span className="shrink-0 font-bold text-[var(--color-duo-hare)]">{l.label}：</span>
              {editing === l.key ? (
                <input
                  autoFocus
                  defaultValue={l.value}
                  aria-label={`编辑${l.label}`}
                  onBlur={(e) => {
                    setEditing(null);
                    if (e.target.value.trim() && e.target.value.trim() !== l.value) {
                      onEditLine(l.key, e.target.value.trim());
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  className="min-w-0 flex-1 rounded-xl border border-[var(--color-duo-blue)] px-2 py-1 text-xs text-[var(--color-duo-eel)] outline-none"
                />
              ) : (
                <button onClick={() => setEditing(l.key)} className="min-w-0 flex-1 truncate text-left text-[var(--color-duo-eel)]">
                  {l.value || "（待确认默认值）"}
                </button>
              )}
              {mark && level && (
                <button
                  onClick={() => setOpenMark(openMark === l.key ? null : l.key)}
                  aria-label={`AI依据:${l.label}`}
                  className={`shrink-0 rounded-full border px-1.5 py-px text-[10px] font-bold ${
                    level === "high"
                      ? "border-purple-600 bg-purple-600 text-white"
                      : level === "mid"
                        ? "border-purple-300 text-purple-700"
                        : "border-dashed border-purple-300 text-purple-400"
                  }`}
                >
                  {level === "guess" ? "AI·猜" : "AI"}
                </button>
              )}
              {openMark === l.key && mark && (
                <span className="block w-full rounded-xl bg-[var(--color-duo-polar)] p-2 text-[11px] text-[var(--color-duo-wolf)]">
                  依据：{mark.reason}｜置信{level === "high" ? "高" : level === "mid" ? "中" : "低"}
                </span>
              )}
            </div>
          );
        })}
        {card.state === "assembling" &&
          Array.from({ length: Math.max(0, totalRows - showRows) }).map((_, i) => (
            <div key={`sk-${i}`} data-testid="intent-skeleton" className="h-4 animate-pulse rounded-lg bg-[var(--color-duo-polar)]" />
          ))}
      </div>

      {/* P2-T7 服务者预览（只读，非承诺） */}
      {card.state === "ready" && card.providerPreview && card.providerPreview.length > 0 && (
        <div data-testid="intent-provider-preview" className="mt-2 rounded-2xl bg-[var(--color-duo-polar)] px-2.5 py-1.5">
          <p className="text-[11px] font-bold text-[var(--color-duo-hare)]">👤 附近服务者预览（非承诺）</p>
          {card.providerPreview.slice(0, 3).map((p) => (
            <p key={p.name} className="text-xs text-[var(--color-duo-wolf)]">
              {p.name} · {p.trust}{p.note ? ` · ${p.note}` : ""}
            </p>
          ))}
        </div>
      )}

      {/* 价格行：全卡唯一暖色 */}
      {showRows > card.lines.length && (
        <div className="mt-2 rounded-2xl bg-orange-50 px-2.5 py-1.5">
          <p className="text-lg font-extrabold text-orange-600">
            ¥{card.price.totalYuan}
            {flashText && (
              <span data-testid="intent-price-flash" className="ml-2 text-xs font-bold text-orange-500">
                {flashText}
              </span>
            )}
          </p>
          {card.price.compareText && <p className="text-[11px] text-[var(--color-duo-wolf)]">{card.price.compareText}</p>}
          <p className="text-[11px] text-[var(--color-duo-hare)]">{card.price.changeRule}｜{card.price.refundRule}</p>
        </div>
      )}

      {card.state === "ready" && (
        <div className="mt-2">
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-duo-wolf)]">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} aria-label="已知晓价格与退款规则" />
            我已知晓价格与退款规则
          </label>
          <div className="mt-1.5 flex gap-2">
            <DuoButton variant="outline" size="sm" className="flex-1" onClick={() => setEditing(card.lines[0]?.key ?? "")}>
              改一改
            </DuoButton>
            <DuoButton
              variant="primary"
              size="sm"
              sound="correct"
              className="flex-1"
              disabled={!ack || frozen}
              onClick={onLaunch}
            >
              {frozen ? "算价中…" : "发射🚀"}
            </DuoButton>
          </div>
        </div>
      )}
    </div>
  );
}
