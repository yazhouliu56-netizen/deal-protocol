import { describe, it } from "node:test";
import assert from "node:assert/strict";

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
    basics: { category: "家政保洁", time: "明天 11:00", area: "幸福家园小区", radiusKm: 5 },
    budget: 100,
    expiresAt: Date.now() + 3_600_000,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("W1 接线：发布链路弹药标识解析（resolveAmmoIdForPublish）", () => {
  it("「家政保洁」→ housekeeping-v1（官方弹药直挂落库）", () => {
    assert.equal(resolveAmmoIdForPublish("家政保洁"), "housekeeping-v1");
    assert.equal(CATEGORY_TO_OFFICIAL["家政保洁"], "housekeeping");
  });

  it("「羽毛球约局」/「组局」→ meetup-social-v1；dating 同人风险类目 → companion-v1", () => {
    assert.equal(resolveAmmoIdForPublish("羽毛球约局"), "meetup-social-v1");
    assert.equal(resolveAmmoIdForPublish("组局"), "meetup-social-v1");
    // 权威映射修正：registry L99/L108 裁定 dating/escort 归 companion（同人
    // 风险聚类）。本卷原为 vitest 域 exclude 误伤的双轨死区孤儿、从未被执行，
    // 期望值系出生时笔误；Glob 自动发现复活后按权威实现修正锁相。
    assert.equal(resolveAmmoIdForPublish("dating"), "companion-v1");
  });

  it("摄影/约拍类目 → companion-v1（P0 约拍映射补齐，防错装组局插槽）", () => {
    assert.equal(CATEGORY_TO_OFFICIAL["摄影师约拍"], "companion");
    assert.equal(CATEGORY_TO_OFFICIAL["约拍"], "companion");
    assert.equal(resolveAmmoIdForPublish("摄影师约拍"), "companion-v1");
    assert.equal(resolveAmmoIdForPublish("约拍"), "companion-v1");
  });

  it("未归一化类目 → 聚合弹药 ammoId（保留类目名，非官方）", () => {
    assert.equal(resolveAmmoIdForPublish("不存在类目"), "default-ammo");
  });

  it("getAmmoDefinition 存量聚合语义零破坏（「羽毛球」不走官方弹药）", () => {
    const ammo = getAmmoDefinition("羽毛球");
    assert.equal(ammo.ammoId, "羽毛球");
    assert.deepEqual(ammo.pricingModel, { kind: "HOURLY", rateYuan: 80, minHours: 1 });
  });

  it("createWave 透传 ammoId 落库（PublishSheet → createPendingWave → Wave）", () => {
    const wave: Wave = createWave(
      makeWaveInput({ ammoId: resolveAmmoIdForPublish("家政保洁") }),
    );
    assert.equal(wave.ammoId, "housekeeping-v1");
    assert.equal(wave.basics.category, "家政保洁");
  });

  it("不带 ammoId 的存量 Wave 保持 undefined（可选字段零破坏）", () => {
    const wave: Wave = createWave(makeWaveInput());
    assert.equal(wave.ammoId, undefined);
  });
});
