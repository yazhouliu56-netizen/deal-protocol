import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import FloatingRecordButton from "./FloatingRecordButton";

describe("FloatingRecordButton 静态渲染（R-0928-10 左下对称）", () => {
  it("hidden → 零渲染（与 SOS 同规则）", () => {
    expect(renderToStaticMarkup(<FloatingRecordButton hidden />)).toBe("");
  });

  it("首帧 idle：左下定位＋录音入口在位", () => {
    const html = renderToStaticMarkup(<FloatingRecordButton />);
    expect(html).toContain('data-testid="floating-record"');
    expect(html).toContain("left-4");
    expect(html).toContain("录音");
  });
});
