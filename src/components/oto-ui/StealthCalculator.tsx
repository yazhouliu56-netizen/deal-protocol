"use client";

import { useState } from "react";

/**
 * 防暴力静默伪装计算器（Silent Panic UI · 白皮书 §五 5.8.3）。
 *
 * 宪法 #8（隐私是血液规则）极端物理防护形态：
 * - 外观与功能完全真实的四则运算计算器（数字 0-9 / +−×÷ / C / =，真实运算结果）；
 * - 输入暗号组合 `911=` 或 `110=` 时：界面继续正常显示计算结果（零视觉闪烁），
 *   后台静默调用 onTriggerSilentAlarm（红色危机流程 + 录音就绪标记）；
 * - 顶栏双击或长按 800ms 退出伪装模式（onExitPanicMode）。
 * 契约对齐：IStealthCalculatorState（masked / armCode / audioReportReady）。
 */

export interface SilentAlarmPayload {
  /** 触发暗号（"911" / "110"）。 */
  code: string;
  /** 触发时刻（epoch ms）。 */
  at: number;
  /** 后台加密录音/录像链路是否就绪（直传安全中心 L4-M4）。 */
  recordingReady: boolean;
  /** 触发时的完整按键流（存证）。 */
  sequence: string;
}

export interface StealthCalculatorProps {
  /** 静默报警回调（暗号命中时调用，界面无任何视觉变化）。 */
  onTriggerSilentAlarm?: (payload: SilentAlarmPayload) => void;
  /** 紧急脱身出口（顶栏双击 / 长按 800ms）。 */
  onExitPanicMode?: () => void;
}

/** 触发暗号集合。 */
export const PANIC_CODES = ["911", "110"] as const;

/** 真实四则运算（除零返回 null → 显示 Error）。 */
export function computeResult(
  a: number,
  op: string,
  b: number,
): number | null {
  switch (op) {
    case "+":
      return a + b;
    case "−":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b === 0 ? null : a / b;
    default:
      return null;
  }
}

/** 按键流暗号检测（911= / 110=，任意位置可触发）。 */
export function detectPanicCode(sequence: string): string | null {
  for (const code of PANIC_CODES) {
    if (sequence.endsWith(`${code}=`)) return code;
  }
  return null;
}

const CALC_CSS = `
.sc-calc{width:260px;border-radius:18px;padding:10px;user-select:none;
  background:#0b0e1a;border:1px solid rgba(255,255,255,.14);color:#e2e8f0;font-size:14px}
.sc-title{display:flex;justify-content:space-between;align-items:center;padding:4px 6px 8px;
  font-size:12px;color:#64748b;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:8px}
.sc-display{height:56px;display:flex;align-items:center;justify-content:flex-end;padding:0 12px;
  font-size:26px;font-weight:600;background:rgba(255,255,255,.06);border-radius:12px;
  margin-bottom:8px;overflow:hidden;white-space:nowrap}
.sc-keys{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.sc-key{padding:13px 0;border-radius:10px;border:none;font-size:16px;font-weight:600;cursor:pointer;
  background:rgba(255,255,255,.09);color:#e2e8f0;transition:filter .1s}
.sc-key:hover{filter:brightness(1.2)}
.sc-key:active{filter:brightness(.85)}
.sc-key-op{background:rgba(123,97,255,.35);color:#fff}
.sc-key-eq{background:linear-gradient(135deg,#00f0ff,#7b61ff);color:#05060f}
.sc-key-c{background:rgba(239,68,68,.3);color:#fecaca}
`;

/** 静默伪装计算器：真实运算 + 暗号静默报警 + 双击/长按脱身。 */
export default function StealthCalculator({
  onTriggerSilentAlarm,
  onExitPanicMode,
}: StealthCalculatorProps) {
  const [display, setDisplay] = useState("0");
  const [current, setCurrent] = useState("");
  const [previous, setPrevious] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [sequence, setSequence] = useState("");
  const [justEvaluated, setJustEvaluated] = useState(false);

  /** 长按顶栏 800ms 退出伪装模式。 */
  const [holdTimer, setHoldTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const exitPanic = () => {
    if (holdTimer) clearTimeout(holdTimer);
    onExitPanicMode?.();
  };

  const pressKey = (key: string) => {
    if (/^[0-9]$/.test(key)) {
      const next =
        justEvaluated || current === "0" ? key : `${current}${key}`;
      setCurrent(next);
      setDisplay(next === "" ? "0" : next);
      setJustEvaluated(false);
      setSequence((s) => `${s}${key}`);
      return;
    }
    if (key === "C") {
      setDisplay("0");
      setCurrent("");
      setPrevious(null);
      setOperator(null);
      setSequence("");
      setJustEvaluated(false);
      return;
    }
    if (key === "=") {
      const right = parseFloat(current || "0");
      let nextDisplay = current || "0";
      if (previous !== null && operator) {
        const result = computeResult(previous, operator, right);
        nextDisplay = result === null ? "Error" : String(result);
        setDisplay(nextDisplay);
        setPrevious(result);
      } else {
        setDisplay(nextDisplay);
        setPrevious(right);
      }
      // 暗号检测：静默触发，界面照常显示结果（零视觉闪烁）
      const finalSeq = `${sequence}=`;
      const code = detectPanicCode(finalSeq);
      if (code && onTriggerSilentAlarm) {
        onTriggerSilentAlarm({
          code,
          at: Date.now(),
          recordingReady: true,
          sequence: finalSeq,
        });
      }
      setSequence("");
      setCurrent("");
      setOperator(null);
      setJustEvaluated(true);
      return;
    }
    // 运算符 + − × ÷
    if (current !== "" && previous === null) {
      setPrevious(parseFloat(current));
    } else if (previous !== null && operator && current !== "") {
      const result = computeResult(previous, operator, parseFloat(current));
      setPrevious(result);
      setDisplay(result === null ? "Error" : String(result));
    }
    setOperator(key);
    setCurrent("");
    setJustEvaluated(false);
    setSequence((s) => `${s}${key}`);
  };

  const keys = [
    "C", "÷", "×", "−",
    "7", "8", "9", "+",
    "4", "5", "6", "=",
    "1", "2", "3", "0",
  ];
  const isOp = (k: string) => ["+", "−", "×", "÷"].includes(k);

  return (
    <div className="sc-calc" data-testid="stealth-calculator">
      <style>{CALC_CSS}</style>
      <div
        className="sc-title"
        data-testid="sc-title"
        title="计算器"
        onDoubleClick={exitPanic}
        onPointerDown={() => {
          const timer = setTimeout(exitPanic, 800);
          setHoldTimer(timer);
        }}
        onPointerUp={() => {
          if (holdTimer) clearTimeout(holdTimer);
        }}
        onPointerLeave={() => {
          if (holdTimer) clearTimeout(holdTimer);
        }}
      >
        <span>计算器</span>
        <span aria-hidden="true">—</span>
      </div>
      <div className="sc-display" data-testid="sc-display" role="status">
        {display}
      </div>
      <div className="sc-keys">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            className={`sc-key${isOp(key) ? " sc-key-op" : ""}${key === "=" ? " sc-key-eq" : ""}${key === "C" ? " sc-key-c" : ""}`}
            data-key={key}
            onClick={() => pressKey(key)}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}
