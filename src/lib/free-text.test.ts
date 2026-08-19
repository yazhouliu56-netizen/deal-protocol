import { describe, expect, it } from "vitest";
import { resolveAmmoByFreeText } from "@/ammo/registry.ts";

describe("W1 自由文本 → 弹药检测（首页 AI 拟物草稿卡原地展开检索链）", () => {
  it("官方弹药：中文词表键子串命中 → 弹药 key + ammoId + 中文类目", () => {
    expect(resolveAmmoByFreeText("周末找个保洁上门打扫")).toMatchObject({
      key: "housekeeping",
      ammoId: "housekeeping-v1",
      label: "保洁",
    });
  });

  it("口语同义词表（擦玻璃/做卫生/扫地）→ 保洁弹药直拨", () => {
    expect(resolveAmmoByFreeText("明天下午找人擦玻璃")).toMatchObject({
      key: "housekeeping",
      ammoId: "housekeeping-v1",
      label: "擦玻璃",
    });
    expect(resolveAmmoByFreeText("周末做卫生 150 元")).toMatchObject({
      ammoId: "housekeeping-v1",
    });
    expect(resolveAmmoByFreeText("找人扫地")).toMatchObject({
      ammoId: "housekeeping-v1",
    });
  });

  it("羽毛球 / 约拍 / 家电维修：四大意图快捷气泡同源词表", () => {
    expect(resolveAmmoByFreeText("周日找人打羽毛球，双打")).toMatchObject({
      key: "meetup",
      ammoId: "meetup-social-v1",
      label: "羽毛球",
    });
    expect(resolveAmmoByFreeText("想找人摄影师约拍，拍一组日系写真")).toMatchObject({
      key: "companion",
      ammoId: "companion-v1",
      label: "摄影师约拍",
    });
    expect(resolveAmmoByFreeText("家里空调坏了，想找师傅上门维修")).toMatchObject({
      key: "appliance_repair",
      ammoId: "appliance-repair-v1",
      label: "维修",
    });
  });

  it("未命中任何词表键 → null（调用方回落全类目 default 弹药草稿）", () => {
    expect(resolveAmmoByFreeText("今天天气怎么样")).toBeNull();
    expect(resolveAmmoByFreeText("你好")).toBeNull();
    expect(resolveAmmoByFreeText("")).toBeNull();
  });
});
