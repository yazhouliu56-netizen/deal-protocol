import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildDraftKey,
  collectGrowthAttribution,
  isValidGrowthPhone,
  LEAD_SMS_CODE_LENGTH,
  LEAD_SMS_COUNTDOWN_SECONDS,
  parseGrowthAttribution,
  parseLeadDraft,
  serializeLeadDraft,
  SmsLeadSheet,
} from "@/components/growth/sms-lead-sheet";

describe("投流留资纯函数", () => {
  it("手机号校验与服务端同源：11 位 1[3-9] 开头", () => {
    expect(isValidGrowthPhone("13800001111")).toBe(true);
    expect(isValidGrowthPhone("19912345678")).toBe(true);
    expect(isValidGrowthPhone("12800001111")).toBe(false);
    expect(isValidGrowthPhone("1380000111")).toBe(false);
    expect(isValidGrowthPhone("138000011111")).toBe(false);
    expect(isValidGrowthPhone("")).toBe(false);
    expect(isValidGrowthPhone("shouna999")).toBe(false);
  });

  it("倒计时 60s 与验证码 6 位常量锁死", () => {
    expect(LEAD_SMS_COUNTDOWN_SECONDS).toBe(60);
    expect(LEAD_SMS_CODE_LENGTH).toBe(6);
  });

  it("草稿 key 按页面隔离", () => {
    expect(buildDraftKey("m20")).toBe("growth:lead-draft:m20");
    expect(buildDraftKey("f20")).toBe("growth:lead-draft:f20");
    expect(buildDraftKey("m20")).not.toBe(buildDraftKey("f20"));
  });

  it("草稿序列化往返一致", () => {
    const draft = { presetId: "m20-clean", tuning: "周六下午" };
    expect(parseLeadDraft(serializeLeadDraft(draft))).toEqual(draft);
  });

  it("畸形草稿降级为 null（不抛异常）", () => {
    expect(parseLeadDraft(null)).toBeNull();
    expect(parseLeadDraft("")).toBeNull();
    expect(parseLeadDraft("{bad json")).toBeNull();
    expect(parseLeadDraft(JSON.stringify({ presetId: 1 }))).toBeNull();
    expect(parseLeadDraft(JSON.stringify({ tuning: "x" }))).toBeNull();
  });
});

describe("投流归因纯函数", () => {
  it("utm 三件套解析 + 页面隔离", () => {
    expect(parseGrowthAttribution("?utm_source=douyin&utm_medium=cpc&utm_campaign=818", "m20")).toEqual({
      page: "m20",
      source: "douyin",
      medium: "cpc",
      campaign: "818",
    });
  });

  it("无参回落 direct（自然量口径）", () => {
    expect(parseGrowthAttribution("", "f20")).toEqual({
      page: "f20",
      source: "direct",
      medium: "",
      campaign: "",
    });
  });

  it("超长值截断 128（防垃圾撑爆 category_fields）", () => {
    const long = `?utm_source=${"x".repeat(300)}`;
    const a = parseGrowthAttribution(long, "m20");
    expect(a.source.length).toBe(128);
  });

  it("无 window 回 direct（SSR 安全不抛异常）", () => {
    expect(collectGrowthAttribution("m20").source).toBe("direct");
  });
});

describe("SmsLeadSheet 留资弹窗", () => {
  it("关闭态零渲染（不污染单页静态快照）", () => {
    const html = renderToStaticMarkup(
      <SmsLeadSheet open={false} onOpenChange={() => {}} onVerified={async () => {}} />,
    );
    expect(html).toBe("");
  });
});
