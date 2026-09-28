import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import GuardStrip, { describeGuard } from "./GuardStrip";
import type { GuardSideState } from "@/hooks/useGuardWatch";

const NOW = 1_800_000_000_000;

function side(state: GuardSideState["state"], minAgo: number, extra: Partial<GuardSideState> = {}): GuardSideState {
  return {
    state,
    reasons: [],
    at: NOW,
    lastSeenMs: NOW - minAgo * 60_000,
    batteryLow: false,
    checkin: false,
    lat: 30.1,
    lng: 120.1,
    ...extra,
  };
}

describe("describeGuard 文案矩阵（ADR-0022）", () => {
  it("双 null → standby 待启动；手动模式露报平安", () => {
    const d = describeGuard(null, null, NOW, false, false, null);
    expect(d.tone).toBe("standby");
    expect(d.showCheckin).toBe(false);
    const m = describeGuard(null, null, NOW, true, false, null);
    expect(m.showCheckin).toBe(true);
    expect(m.selfLine).toContain("报平安");
  });

  it("self LIVE + peer 无 → live，不露按钮", () => {
    const d = describeGuard(side("LIVE", 1), null, NOW, false, false, null);
    expect(d.tone).toBe("live");
    expect(d.showCheckin).toBe(false);
    expect(d.peerLine).toBe(null);
  });

  it("self DEGRADED → warn + 分钟数 + 报平安", () => {
    const d = describeGuard(side("DEGRADED", 12), null, NOW, false, false, null);
    expect(d.tone).toBe("warn");
    expect(d.selfLine).toContain("12 分钟");
    expect(d.showCheckin).toBe(true);
  });

  it("self LOST → lost + 升级文案", () => {
    const d = describeGuard(side("LOST", 20), null, NOW, false, false, null);
    expect(d.tone).toBe("lost");
    expect(d.selfLine).toContain("已升级");
    expect(d.showCheckin).toBe(true);
  });

  it("peer DEGRADED → 对方行分钟数；peer 低电量叠加不断案注释", () => {
    const d = describeGuard(
      side("LIVE", 1),
      side("DEGRADED", 12, { batteryLow: true }),
      NOW,
      false,
      false,
      null,
    );
    expect(d.peerLine).toContain("12 分钟");
    expect(d.peerLine).toContain("没电");
  });

  it("peer TAMPER → 标记文案；peer LIVE 低电量不叠加注释", () => {
    const t = describeGuard(side("LIVE", 1), side("TAMPER", 1), NOW, false, false, null);
    expect(t.peerLine).toContain("关闭了定位");
    const l = describeGuard(
      side("LIVE", 1),
      side("LIVE", 1, { batteryLow: true }),
      NOW,
      false,
      false,
      null,
    );
    expect(l.peerLine).not.toContain("没电");
  });

  it("self 低电量 → 充电提醒带百分比", () => {
    const d = describeGuard(side("LIVE", 1), null, NOW, false, true, 0.15);
    expect(d.batteryLine).toContain("15%");
    expect(d.batteryLine).toContain("充电");
  });

  it("非法输入（serverNow 缺席）→ 分钟数回 0，不抛", () => {
    const d = describeGuard(side("DEGRADED", 12), null, null, false, false, null);
    expect(d.selfLine).toContain("0 分钟");
  });
});

describe("GuardStrip 静态渲染", () => {
  it("无 demandId → null（零渲染）", () => {
    expect(renderToStaticMarkup(<GuardStrip demandId={null} />)).toBe("");
  });

  it("有 demandId → 首帧 standby 加载态（effect 未跑，不断言网络）", () => {
    const html = renderToStaticMarkup(<GuardStrip demandId="d-1" />);
    expect(html).toContain('data-testid="guard-strip"');
    expect(html).toContain("守护加载中");
  });

  it("加载态不含操作按钮（首帧无 checkin/录音，避免误点）", () => {
    const html = renderToStaticMarkup(<GuardStrip demandId="d-1" />);
    expect(html).not.toContain('data-testid="guard-checkin"');
    expect(html).not.toContain('data-testid="guard-record"');
  });
});
