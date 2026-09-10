import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DemanderInterveneBar from "./DemanderInterveneBar";

const base = {
  waveId: "w1",
  createdAt: Date.now(),
  currentTime: "明晚 7 点",
  existingCustoms: [] as string[],
};

describe("DemanderInterveneBar static", () => {
  it("未开工：改期＋加项＋窗内无责撤回全在", () => {
    const html = renderToStaticMarkup(<DemanderInterveneBar {...base} fiveState="MATCHED" />);
    expect(html).toContain("intervene-bar");
    expect(html).toContain("改期");
    expect(html).toContain("加项");
    expect(html).toContain("无责撤回");
  });

  it("开工后：干预区整体消失（无假按钮）", () => {
    const html = renderToStaticMarkup(
      <DemanderInterveneBar {...base} fiveState="IN_SERVICE" createdAt={Date.now() - 10 * 60_000} />,
    );
    expect(html).toBe("");
  });

  it("窗外：无责撤回消失，改期加项仍在", () => {
    const html = renderToStaticMarkup(
      <DemanderInterveneBar {...base} fiveState="PUBLISHED" createdAt={Date.now() - 10 * 60_000} />,
    );
    expect(html).toContain("改期");
    expect(html).not.toContain("无责撤回");
  });
});
