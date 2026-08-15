// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  CATEGORY_TO_OFFICIAL,
  getAmmoDefinition,
  resolveAmmoIdForPublish,
} from "@/ammo/registry";
import { createWave, type CreateWaveInput, type Wave } from "@/base/order/wave";

/** 构造一条最小合法 Wave 输入。 */
function makeWaveInput(
  overrides: Partial<CreateWaveInput> = {},
): CreateWaveInput {
  return {
    id: "w-test-ammo",
    authorId: "u-1",
    basics: { category: "家政保洁", time: "明天 11:00", area: "幸福家园小区" },
    budget: 100,
    expiresAt: Date.now() + 3_600_000,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("W1 接线：发布链路弹药标识解析（resolveAmmoIdForPublish）", () => {
  it("「家政保洁」→ housekeeping-v1（官方弹药直挂落库）", () => {
    expect(resolveAmmoIdForPublish("家政保洁")).toBe("housekeeping-v1");
    expect(CATEGORY_TO_OFFICIAL["家政保洁"]).toBe("housekeeping");
  });

  it("「羽毛球约局」/「组局」→ meetup-social-v1", () => {
    expect(resolveAmmoIdForPublish("羽毛球约局")).toBe("meetup-social-v1");
    expect(resolveAmmoIdForPublish("组局")).toBe("meetup-social-v1");
    expect(resolveAmmoIdForPublish("dating")).toBe("meetup-social-v1");
  });

  it("未归一化类目 → 聚合弹药 ammoId（保留类目名，非官方）", () => {
    expect(CATEGORY_TO_OFFICIAL["摄影师约拍"]).toBeUndefined();
    expect(resolveAmmoIdForPublish("摄影师约拍")).toBe("摄影师约拍");
    expect(resolveAmmoIdForPublish("不存在类目")).toBe("default-ammo");
  });

  it("getAmmoDefinition 存量聚合语义零破坏（「羽毛球」不走官方弹药）", () => {
    const ammo = getAmmoDefinition("羽毛球");
    expect(ammo.ammoId).toBe("羽毛球");
    expect(ammo.pricingModel).toEqual({ kind: "HOURLY", rateYuan: 80, minHours: 1 });
  });

  it("createWave 透传 ammoId 落库（PublishSheet → createPendingWave → Wave）", () => {
    const wave: Wave = createWave(
      makeWaveInput({ ammoId: resolveAmmoIdForPublish("家政保洁") }),
    );
    expect(wave.ammoId).toBe("housekeeping-v1");
    expect(wave.basics.category).toBe("家政保洁");
  });

  it("不带 ammoId 的存量 Wave 保持 undefined（可选字段零破坏）", () => {
    const wave: Wave = createWave(makeWaveInput());
    expect(wave.ammoId).toBeUndefined();
  });
});
