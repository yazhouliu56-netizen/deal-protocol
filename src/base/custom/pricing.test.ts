/**
 * 定制行项定价考卷（P5a · 用户裁决 2026-09-18）。
 * 锁：事实型固定价 / 情绪型按基础价百分比 / 低于底价拒绝 / 总额=基础+Σ溢价。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  floorForDim,
  validateCustomItems,
  totalWithCustom,
  type CustomDimFloor,
} from "./pricing.ts";

const FIXED: CustomDimFloor = { dim_key: "imported_paint", mode: "fixed", fixed_amount: 50, percent_rate: 0 };
const PCT: CustomDimFloor = { dim_key: "dress_code", mode: "percent", fixed_amount: 0, percent_rate: 0.03 };
const DIMS = new Map([["imported_paint", FIXED], ["dress_code", PCT]]);

test("事实型：固定价与基础价无关", () => {
  assert.equal(floorForDim(FIXED, 300), 50);
  assert.equal(floorForDim(FIXED, 3000), 50);
  assert.equal(floorForDim(FIXED, 0), 50);
});

test("情绪型：按基础价百分比（300 元单着装 3% = 9）", () => {
  assert.equal(floorForDim(PCT, 300), 9);
  assert.equal(floorForDim(PCT, 3000), 90);
  assert.equal(floorForDim(PCT, 0), 0);
});

test("低于底价/未知维度拒绝", () => {
  assert.deepEqual(validateCustomItems([{ dim_key: "dress_code", amount: 5 }], DIMS, 300), [
    "定制项 dress_code 金额¥5低于最低价¥9",
  ]);
  assert.deepEqual(validateCustomItems([{ dim_key: "nope", amount: 99 }], DIMS, 300), [
    "未知定制维度: nope",
  ]);
  assert.deepEqual(
    validateCustomItems(
      [{ dim_key: "imported_paint", amount: 50 }, { dim_key: "dress_code", amount: 9 }],
      DIMS, 300,
    ),
    [],
  );
});

test("订单总额 = 基础 + Σ溢价", () => {
  assert.equal(
    totalWithCustom(300, [{ dim_key: "imported_paint", amount: 50 }, { dim_key: "dress_code", amount: 9 }]),
    359,
  );
  assert.equal(totalWithCustom(300, []), 300);
});
