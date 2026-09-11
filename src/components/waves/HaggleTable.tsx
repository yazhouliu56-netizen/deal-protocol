"use client";

import { trackMetric } from "@/lib/track-metric";
import IntentCard from "./IntentCard";
import type { IntentCard as IntentCardData } from "@/types/intent-card";
import {
  buildHaggleOptions,
  canHaggle,
  describeFairness,
  meanOfQuotes,
} from "@/base/order/haggle";

/**
 * 磋商桌（P3-T1）：三档话术卡＋价格合理性条。
 * AI 只建议不代按——发送必须人点每档按钮（真 counterOffer 由调用方传入）。
 * 均值口径＝同单各报价均值；无报价警示条静默（不编造）。
 */
export default function HaggleTable({
  quoteYuan,
  quotesYuan,
  budgetYuan,
  rounds,
  onSend,
}: {
  quoteYuan: number;
  quotesYuan: (number | undefined)[];
  budgetYuan: number;
  rounds: number;
  onSend: (p: { price: number; message: string }) => void;
}) {
  const mean = meanOfQuotes(quotesYuan);
  const fair = describeFairness(quoteYuan, mean);
  const options = buildHaggleOptions(quoteYuan, mean, budgetYuan);
  const open = canHaggle(rounds);

  return (
    <div data-testid="haggle-table" className="mt-2 rounded-2xl bg-white border-2 border-[var(--color-duo-swan)] p-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-[var(--color-duo-blue-ink)]">💬 磋商桌</span>
        <span className="font-bold text-[var(--color-duo-hare)]">
          {mean !== null ? `同单均价 ¥${mean}` : "暂无比价"}
        </span>
      </div>
      {fair.warn && fair.ratio !== null && (
        <p data-testid="haggle-fair-warn" className="mt-1 text-xs font-bold text-orange-600">
          ⚠️ 高出均价 {Math.round((fair.ratio - 1) * 100)}%，建议小让或守底
        </p>
      )}
      {open ? (
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {options.map((o) => (
            <button
              key={o.tier}
              onClick={() => {
                try {
                  trackMetric("haggle.sent", 1, { tier: o.tier });
                } catch {}
                onSend({ price: o.priceYuan, message: o.message });
              }}
              aria-label={`还价${o.label}¥${o.priceYuan}`}
              className="rounded-xl border-2 border-[var(--color-duo-blue)] bg-[var(--color-duo-blue-mist)] px-1 py-1.5 text-center"
            >
              <span className="block text-xs font-extrabold text-[var(--color-duo-blue-ink)]">{o.label}</span>
              <span className="block text-xs font-extrabold text-orange-600">¥{o.priceYuan}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-1.5 text-xs font-bold text-[var(--color-duo-hare)]">3 轮已满 · 请直接谈成或婉拒</p>
      )}
    </div>
  );
}

/**
 * T2 磋商确认卡（与 L1 同构件）：改价经卡确认才生效。
 * 发射＝既有谈成链（调用方传入）；改/重组＝回三档桌（onBack，无死路）。
 */
export function HaggleConfirmCard({
  card,
  onConfirm,
  onBack,
}: {
  card: IntentCardData;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div data-testid="haggle-confirm" className="mt-2">
      <IntentCard
        card={card}
        onEditLine={() => onBack()}
        onRelaunch={() => onBack()}
        onLaunch={() => {
          try {
            trackMetric("haggle.conceded", 1, {});
          } catch {}
          onConfirm();
        }}
      />
    </div>
  );
}
