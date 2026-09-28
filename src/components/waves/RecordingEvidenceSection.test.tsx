import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RecordingEvidenceSection, { formatRecordingLine } from "./RecordingEvidenceSection";

describe("formatRecordingLine（R-0928-09）", () => {
  it("档位＋时间＋大小＋未知回退", () => {
    expect(
      formatRecordingLine({
        createdAt: "2026-09-28T10:00:00.000Z",
        tier: "A",
        bytes: 2048,
        mime: "audio/webm",
        hash: "abc",
        ref: "r1",
      }),
    ).toContain("A 档");
    expect(
      formatRecordingLine({ createdAt: "", tier: "Z", bytes: null, mime: null, hash: "", ref: "" }),
    ).toContain("守护录音");
  });
});

describe("RecordingEvidenceSection 静态渲染", () => {
  it("首帧（effect 未跑）零渲染，不断言网络", () => {
    expect(renderToStaticMarkup(<RecordingEvidenceSection disputeId="dp-1" />)).toBe("");
  });
});
