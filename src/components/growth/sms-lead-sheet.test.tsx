import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildDraftKey,
  isValidGrowthPhone,
  LEAD_SMS_CODE_LENGTH,
  LEAD_SMS_COUNTDOWN_SECONDS,
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

describe("SmsLeadSheet 留资弹窗", () => {
  it("关闭态零渲染（不污染单页静态快照）", () => {
    const html = renderToStaticMarkup(
      <SmsLeadSheet open={false} onOpenChange={() => {}} onVerified={async () => {}} />,
    );
    expect(html).toBe("");
  });
});
