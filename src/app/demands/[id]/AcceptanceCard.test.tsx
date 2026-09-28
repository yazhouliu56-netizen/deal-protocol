import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AcceptanceCard, { describeDemandStatus } from "./AcceptanceCard";

describe("describeDemandStatus（R-0928-12）", () => {
  it("BOOKED 说人话；未知态回落原文不断裂", () => {
    expect(describeDemandStatus("BOOKED")).toBe("已预约 · 到时开工");
    expect(describeDemandStatus("ASSIGNED")).toBe("ASSIGNED");
  });
});

describe("AcceptanceCard 静态渲染", () => {
  it("BOOKED 渲染人话状态", () => {
    const html = renderToStaticMarkup(
      <AcceptanceCard title="保洁" price={200} status="BOOKED" releasedAt={null} />,
    );
    expect(html).toContain("已预约");
  });
});
