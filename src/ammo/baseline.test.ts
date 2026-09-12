/**
 * L1 通用基线考卷（B1 · node:test）。
 * 基线冻结不可变；三弹药展开后数值与基线一致（运行时独立副本）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CANCELLATION_4STAGE_STANDARD,
  R1_TRANSFER_POLICY,
  STANDARD_SPLIT_85_10_5,
} from "./baseline.ts";
import { housekeepingAmmo } from "./housekeeping.ammo.ts";
import { applianceRepairAmmo } from "./appliance_repair.ammo.ts";
import { petBoardingAmmo } from "./pet_boarding.ammo.ts";

test("基线冻结：三基线全图不可变", () => {
  assert.equal(Object.isFrozen(R1_TRANSFER_POLICY), true);
  assert.equal(Object.isFrozen(STANDARD_SPLIT_85_10_5), true);
  assert.equal(Object.isFrozen(CANCELLATION_4STAGE_STANDARD), true);
  assert.equal(Object.isFrozen(CANCELLATION_4STAGE_STANDARD[0]), true);
});

test("R1 基线：三弹药展开值一致（副本独立，改一家不影响别家）", () => {
  for (const ammo of [housekeepingAmmo, applianceRepairAmmo, petBoardingAmmo]) {
    assert.deepEqual({ ...ammo.transferPolicy }, { ...R1_TRANSFER_POLICY });
  }
  assert.notEqual(housekeepingAmmo.transferPolicy, petBoardingAmmo.transferPolicy);
});

test("分账/违约梯基线：家政与寄养展开值一致", () => {
  for (const ammo of [housekeepingAmmo, petBoardingAmmo]) {
    assert.deepEqual(
      { ...ammo.holographic?.splitRules },
      { ...STANDARD_SPLIT_85_10_5 },
    );
    assert.deepEqual(
      [...(ammo.holographic?.cancellationTiers ?? [])],
      [...CANCELLATION_4STAGE_STANDARD],
    );
  }
});
