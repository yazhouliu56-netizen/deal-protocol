// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import SafetyCenterCard from "./SafetyCenterCard";
import type { CrisisRecord } from "@/base/safe/crisis";

const baseProps = {
  crisisLevel: 3 as const,
  crisisNote: "",
  myCrisis: [] as CrisisRecord[],
  crisisTargets: [] as string[],
  crisisSmsText: "",
  onSelectLevel: vi.fn(),
  onNoteChange: vi.fn(),
  onRaise: vi.fn(),
  onResolve: vi.fn(),
};

const SNAPSHOT_RECORD = {
  id: "crisis-e2e-1",
  userId: "u-e2e",
  waveId: "w-companion",
  level: 3 as const,
  note: "行程异常求助",
  at: Date.parse("2026-08-25T10:00:00Z"),
  notified: ["紧急联系人"],
  resolved: false,
  forensicSnapshot: {
    snapshotId: "sos-3-test-snapid01",
    userId: "u-e2e",
    orderNo: "w-companion",
    level: 3 as const,
    timestamp: Date.parse("2026-08-25T10:00:00Z"),
    trajectoryPayload: {
      generatedAt: Date.parse("2026-08-25T10:00:00Z"),
      pointCount: 7,
      lastPoint: { lat: 30.001, lng: 120.001, at: 0 },
      speedKmh: null,
      anomalyFlags: [],
      trail: "30.000000,120.000000",
    },
    audioEvidenceSummary: {
      chunkCount: 4,
      totalBytes: 2048,
      fingerprints: ["a1", "b2", "c3", "d4"],
      integrityOk: true,
      failedChunkIds: [],
    },
  },
} as unknown as CrisisRecord;

async function renderLive(props: Parameters<typeof SafetyCenterCard>[0]) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<SafetyCenterCard {...props} />);
  });
  return { container, unmount: () => { root.unmount(); container.remove(); } };
}

describe("SafetyCenterCard · P1-3 SOS 存证徽标", () => {
  it("无危机记录：徽标不渲染（零漂移基线）", () => {
    const html = renderToStaticMarkup(<SafetyCenterCard {...baseProps} />);
    expect(html).not.toContain('data-testid="sos-forensic-badge"');
    expect(html).toContain("发起求助");
  });

  it("有快照记录：徽标渲染并展示轨迹点数与录音切片数元数据", () => {
    const html = renderToStaticMarkup(
      <SafetyCenterCard {...baseProps} myCrisis={[SNAPSHOT_RECORD]} />
    );
    expect(html).toContain('data-testid="sos-forensic-badge"');
    expect(html).toContain("危机存证已封包");
    expect(html).toContain("轨迹 7 点");
    expect(html).toContain("录音 4 块");
    expect(html).toContain("存证哈希已固化");
  });

  it("处置中记录但无快照（历史兼容）：不渲染徽标、仍显示处置提示与结束按钮", () => {
    const legacy = { ...SNAPSHOT_RECORD } as Record<string, unknown>;
    delete legacy.forensicSnapshot;
    const html = renderToStaticMarkup(
      <SafetyCenterCard
        {...baseProps}
        myCrisis={[legacy as unknown as CrisisRecord]}
      />
    );
    expect(html).not.toContain('data-testid="sos-forensic-badge"');
    expect(html).toContain("处置中：行程异常求助");
    expect(html).toContain("已平安，结束");
  });

  it("交互回归：级别选择 / 发起求助 / 结束回调原样触发（DOM 零漂移）", async () => {
    const onRaise = vi.fn();
    const onResolve = vi.fn();
    const onSelectLevel = vi.fn();
    const { container, unmount } = await renderLive({
      ...baseProps,
      myCrisis: [SNAPSHOT_RECORD],
      onRaise,
      onResolve,
      onSelectLevel,
    });

    const buttons = [...container.querySelectorAll("button")];
    const byText = (t: string) => {
      const b = buttons.find((x) => x.textContent?.includes(t));
      expect(b).toBeTruthy();
      return b!;
    };
    await act(async () => {
      byText("极端紧急").click();
      byText("发起求助").click();
      byText("已平安，结束").click();
    });
    expect(onSelectLevel).toHaveBeenCalledWith(3);
    expect(onRaise).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledTimes(1);
    unmount();
  });
});
