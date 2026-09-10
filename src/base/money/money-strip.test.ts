import { test } from "node:test";
import assert from "node:assert/strict";
import { describeMoneyState } from "./money-strip.ts";

const base = {
  budgetYuan: 150,
  fiveState: "MATCHED" as const,
  fulfilled: false,
  settled: false,
  openDispute: false,
  removed: false,
};

test("缺数标同步中，不编造", () => {
  const s = describeMoneyState({ ...base, budgetYuan: NaN });
  assert.equal(s.synced, false);
  assert.match(s.label, /同步中/);
});

test("五态＋争议＋下架全覆盖", () => {
  assert.equal(describeMoneyState({ ...base, fiveState: "PUBLISHED" }).phase, "await");
  assert.equal(describeMoneyState(base).phase, "held");
  assert.equal(describeMoneyState({ ...base, fiveState: "IN_SERVICE" }).phase, "service");
  assert.equal(describeMoneyState({ ...base, fiveState: "INSPECTED" }).phase, "review");
  assert.equal(describeMoneyState({ ...base, settled: true }).phase, "settled");
  assert.equal(describeMoneyState({ ...base, openDispute: true }).phase, "disputed");
  assert.equal(describeMoneyState({ ...base, removed: true }).phase, "refunded");
});

test("成交价优先于预算", () => {
  const s = describeMoneyState({ ...base, claimPriceYuan: 120 });
  assert.equal(s.displayYuan, 120);
});
