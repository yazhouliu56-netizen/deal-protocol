import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TalkPublishSheet, { formatDraftLines, mapPublishRejection } from "./TalkPublishSheet";
import { emptyDraft } from "@/base/order/publish-draft";

describe("formatDraftLines", () => {
  it("缺项标待补充，预算¥格式化", () => {
    const lines = formatDraftLines({ ...emptyDraft(), category: "保洁", budgetYuan: 150 });
    expect(lines[0]).toBe("品类：保洁");
    expect(lines[1]).toContain("待补充");
    expect(lines[3]).toBe("预算：¥150");
    expect(lines).toHaveLength(4);
  });

  it("备注仅有值才出现", () => {
    expect(formatDraftLines({ ...emptyDraft(), note: "带工具" })).toHaveLength(5);
  });
});

describe("mapPublishRejection", () => {
  it("四路拒绝映射 + 通过回 null", () => {
    expect(mapPublishRejection({ minorBlocked: true })).toContain("监护人");
    expect(mapPublishRejection({ blocked: "debt" })).toContain("no-show");
    expect(mapPublishRejection({ blocked: "roam" })).toContain("多开");
    expect(mapPublishRejection({ blocked: "sentinel" })).toContain("反欺诈");
    expect(mapPublishRejection({ removed: true })).toContain("违禁词");
    expect(mapPublishRejection({})).toBeNull();
  });
});

describe("TalkPublishSheet static", () => {
  it("关闭态渲染空，开启态有问候 + 三模态入口", () => {
    expect(renderToStaticMarkup(<TalkPublishSheet open={false} onClose={() => {}} onFallback={() => {}} />)).toBe("");
    const html = renderToStaticMarkup(<TalkPublishSheet open onClose={() => {}} onFallback={() => {}} />);
    expect(html).toContain("说句话发单");
    expect(html).toContain("会话发单输入");
    expect(html).toContain("语音输入");
    expect(html).toContain("拍照/选照片");
    expect(html).toContain("或跳去表单发单");
  });
});
