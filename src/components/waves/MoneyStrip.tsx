"use client";

import { useEffect, useRef, useState } from "react";
import { describeMoneyState, type MoneyPhase } from "@/base/money/money-strip";
import type { AtomicFiveState } from "@/types/ammo-schema";

/**
 * 资金五态条（P2-T2）：待接单→托管中→服务中→待结算→已结算。
 * 金额数字滚动（600ms count-up，让钱被看见）；争议/退款覆盖态。
 * 金额全部来自 describeMoneyState 纯投影，组件零计算。
 */

const STEPS: { key: string; label: string }[] = [
  { key: "await", label: "待接单" },
  { key: "held", label: "托管中" },
  { key: "service", label: "服务中" },
  { key: "review", label: "待结算" },
  { key: "settled", label: "已结算" },
];

const PHASE_ORDER: Record<MoneyPhase, number> = {
  await: 0,
  held: 1,
  service: 2,
  review: 3,
  settled: 4,
  disputed: 2,
  refunded: 4,
};

/** 数字滚动（rAF 600ms；SSR 首帧即目标值）。 */
function useCountUp(target: number): number {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 600);
      setVal(Math.round(from + (target - from) * k));
      if (k < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return val;
}

export default function MoneyStrip({
  budgetYuan,
  fiveState,
  claimPriceYuan,
  fulfilled,
  settled,
  openDispute,
  removed,
  negotiatedAmountYuan,
  depositYuan,
}: {
  budgetYuan: number;
  fiveState: AtomicFiveState;
  claimPriceYuan?: number;
  fulfilled: boolean;
  settled: boolean;
  openDispute: boolean;
  removed: boolean;
  negotiatedAmountYuan?: number;
  depositYuan?: number;
}) {
  const st = describeMoneyState({
    budgetYuan,
    fiveState,
    claimPriceYuan,
    fulfilled,
    settled,
    openDispute,
    removed,
    negotiatedAmountYuan,
    depositYuan,
  });
  const shown = useCountUp(st.displayYuan);
  const active = PHASE_ORDER[st.phase];
  const alert = st.phase === "disputed" || st.phase === "refunded";

  return (
    <div
      data-testid="money-strip"
      data-phase={st.phase}
      className={`mb-2 rounded-3xl border-2 p-3 ${
        alert
          ? "border-red-200 bg-red-50"
          : "border-[var(--color-duo-swan)] bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className={`text-lg font-extrabold ${alert ? "text-red-500" : "text-orange-600"}`}>
          ¥{shown}
        </p>
        <p className="text-xs font-bold text-[var(--color-duo-hare)]">{st.label}</p>
      </div>
      <div className="mt-1.5 flex items-center gap-1" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span key={s.key} className="flex flex-1 items-center gap-1 last:flex-none">
            <span
              className={`h-1.5 flex-1 rounded-full ${i <= active ? "bg-[var(--color-duo-green)]" : "bg-[var(--color-duo-polar)]"}`}
            />
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-bold text-[var(--color-duo-hare)]">
        {STEPS.map((s) => (
          <span key={s.key}>{s.label}</span>
        ))}
      </div>
      {st.breakdown && (
        <p data-testid="money-breakdown" className="mt-1 text-[10px] text-[var(--color-duo-hare)]">
          {st.breakdown}
        </p>
      )}
    </div>
  );
}
