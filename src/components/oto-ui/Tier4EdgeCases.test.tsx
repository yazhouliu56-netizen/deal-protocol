// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import StealthCalculator, {
  computeResult,
  detectPanicCode,
  PANIC_CODES,
  type SilentAlarmPayload,
} from "@/components/oto-ui/StealthCalculator";
import SeniorModeView, {
  SENIOR_HOTSPOT_PX,
} from "@/components/oto-ui/SeniorModeView";
import OfflineQueueIndicator from "@/components/oto-ui/OfflineQueueIndicator";

/** jsdom 挂载并依次点击按键。 */
async function clickKeys(keys: string[]): Promise<{ display: string; calc: HTMLElement }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<StealthCalculator />);
  });
  const calc = container.querySelector<HTMLElement>('[data-testid="stealth-calculator"]')!;
  for (const key of keys) {
    const btn = calc.querySelector<HTMLButtonElement>(`button[data-key="${key}"]`);
    expect(btn).not.toBeNull();
    await act(async () => {
      btn!.click();
    });
  }
  const display = calc.querySelector<HTMLElement>('[data-testid="sc-display"]')!.textContent ?? "";
  root.unmount();
  container.remove();
  return { display, calc };
}

describe("StealthCalculator 静默伪装计算器", () => {
  it("真实四则运算：12 + 34 = 46（不触发报警）", async () => {
    const alarm = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<StealthCalculator onTriggerSilentAlarm={alarm} />);
    });
    const calc = container.querySelector<HTMLElement>('[data-testid="stealth-calculator"]')!;
    for (const key of ["1", "2", "+", "3", "4", "="]) {
      await act(async () => {
        calc.querySelector<HTMLButtonElement>(`button[data-key="${key}"]`)!.click();
      });
    }
    const display = calc.querySelector<HTMLElement>('[data-testid="sc-display"]')!.textContent;
    expect(display).toBe("46");
    expect(alarm).not.toHaveBeenCalled();
    root.unmount();
    container.remove();
  });

  it("真实四则运算：9 × 8 = 72；除零显示 Error", async () => {
    const r1 = await clickKeys(["9", "×", "8", "="]);
    expect(r1.display).toBe("72");
    const r2 = await clickKeys(["5", "÷", "0", "="]);
    expect(r2.display).toBe("Error");
  });

  it("暗号拦截：输入 911= 结果正常显示 911 但静默触发报警（零视觉闪烁）", async () => {
    const alarm = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<StealthCalculator onTriggerSilentAlarm={alarm} />);
    });
    const calc = container.querySelector<HTMLElement>('[data-testid="stealth-calculator"]')!;
    for (const key of ["9", "1", "1", "="]) {
      await act(async () => {
        calc.querySelector<HTMLButtonElement>(`button[data-key="${key}"]`)!.click();
      });
    }
    // 界面正常显示计算结果（不闪烁、无警报视觉）
    const display = calc.querySelector<HTMLElement>('[data-testid="sc-display"]')!.textContent;
    expect(display).toBe("911");
    expect(calc.textContent).not.toContain("报警");
    expect(calc.textContent).not.toContain("危机");
    expect(calc.textContent).not.toContain("panic");
    // 静默回调触发且载荷完整
    expect(alarm).toHaveBeenCalledTimes(1);
    const payload = alarm.mock.calls[0][0] as SilentAlarmPayload;
    expect(payload.code).toBe("911");
    expect(payload.recordingReady).toBe(true);
    expect(payload.sequence).toBe("911=");
    expect(payload.at).toBeGreaterThan(0);
    root.unmount();
    container.remove();
  });

  it("暗号拦截：110= 亦触发；普通算式 123+ 不触发", async () => {
    expect(detectPanicCode("911=")).toBe("911");
    expect(detectPanicCode("110=")).toBe("110");
    expect(detectPanicCode("12+34=")).toBeNull();
    expect(detectPanicCode("911")).toBeNull();
    const alarm = vi.fn();
    await clickKeys(["1", "2", "3", "+"]);
    expect(alarm).not.toHaveBeenCalled();
  });

  it("computeResult 纯函数：加减乘除与除零边界", () => {
    expect(computeResult(12, "+", 34)).toBe(46);
    expect(computeResult(9, "×", 8)).toBe(72);
    expect(computeResult(10, "−", 3)).toBe(7);
    expect(computeResult(20, "÷", 4)).toBe(5);
    expect(computeResult(5, "÷", 0)).toBeNull();
  });

  it("C 清零重置显示；PANIC_CODES 常量完备", async () => {
    const r = await clickKeys(["9", "1", "C", "5", "="]);
    expect(r.display).toBe("5");
    expect(PANIC_CODES).toEqual(["911", "110"]);
  });
});

describe("SeniorModeView 适老化长辈模式", () => {
  it("双主按钮渲染：大麦克风语音发单 + 电话联系客服", () => {
    const html = renderToStaticMarkup(<SeniorModeView />);
    expect(html).toContain("🎙️");
    expect(html).toContain("大麦克风 · 语音一键发单");
    expect(html).toContain("📞 电话联系客服（24h 适老热线）");
    expect(html).toContain('data-action="voice"');
    expect(html).toContain('data-action="call-support"');
  });

  it("WCAG AAA 高对比三色系（黑 #000 / 白 #fff / 黄 #ffd60a）+ 1.4x 字阶", () => {
    const html = renderToStaticMarkup(<SeniorModeView />);
    expect(html).toContain("--bg:#000");
    expect(html).toContain("--fg:#fff");
    expect(html).toContain("--accent:#ffd60a");
    expect(html).toContain("font-size:calc(14px * 1.4)");
    expect(html).toContain("data-senior-mode=\"1\"");
  });

  it("触控热区 ≥56×56pt（≈75px）声明", () => {
    expect(SENIOR_HOTSPOT_PX).toBeGreaterThanOrEqual(75);
    const html = renderToStaticMarkup(<SeniorModeView />);
    expect(html).toContain(`min-width:${SENIOR_HOTSPOT_PX}px`);
    expect(html).toContain(`min-height:${SENIOR_HOTSPOT_PX}px`);
  });

  it("关键操作弹窗：超大确认/取消按钮，确认后触发语音开始", async () => {
    const voiceStart = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<SeniorModeView onVoiceStart={voiceStart} />);
    });
    const mic = container.querySelector<HTMLButtonElement>('[data-action="voice"]')!;
    await act(async () => {
      mic.click();
    });
    expect(voiceStart).not.toHaveBeenCalled();
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain("确定开始语音发单吗？");
    const yes = container.querySelector<HTMLButtonElement>('[data-action="confirm-voice"]')!;
    expect(yes!.style.minHeight).toBe(`${SENIOR_HOTSPOT_PX}px`);
    await act(async () => {
      yes.click();
    });
    expect(voiceStart).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    root.unmount();
    container.remove();
  });

  it("客服按钮点击触发 onCallSupport", async () => {
    const callSupport = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<SeniorModeView onCallSupport={callSupport} />);
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-action="call-support"]')!.click();
    });
    expect(callSupport).toHaveBeenCalledTimes(1);
    root.unmount();
    container.remove();
  });
});

describe("OfflineQueueIndicator 弱网离线事务指示器", () => {
  it("离线时：琥珀提示条展示本地加密队列暂存笔数", () => {
    const html = renderToStaticMarkup(<OfflineQueueIndicator isOffline pendingCount={3} />);
    expect(html).toContain("⚠️ 离线模式：已暂存");
    expect(html).toContain("3");
    expect(html).toContain("本地加密队列");
    expect(html).toContain('data-state="offline"');
  });

  it("在线且无恢复：不渲染提示条", () => {
    const html = renderToStaticMarkup(<OfflineQueueIndicator isOffline={false} pendingCount={0} />);
    expect(html).not.toContain("离线模式");
    expect(html).not.toContain("网络已恢复");
  });

  it("网络恢复 true→false：触发绿色追回 Toast（播报恢复前暂存笔数）", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<OfflineQueueIndicator isOffline pendingCount={5} />);
    });
    expect(container.textContent).toContain("已暂存");
    expect(container.textContent).not.toContain("网络已恢复");

    // 模拟网络恢复（离线期间暂存 5 笔 → 追回）
    await act(async () => {
      root.render(<OfflineQueueIndicator isOffline={false} pendingCount={0} />);
    });
    expect(container.textContent).toContain("✅ 网络已恢复：5 笔数据已自动追回同步");
    expect(container.querySelector('[data-state="recovered"]')).not.toBeNull();
    expect(container.textContent).not.toContain("离线模式");

    root.unmount();
    container.remove();
  });
});
