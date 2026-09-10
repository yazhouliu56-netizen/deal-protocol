import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AI_GUESS_BELOW,
  aiLevelOf,
  assertPriceComplete,
  canTransition,
  defaultIntentCard,
  isStale,
  mergeIntentLines,
} from "./intent-card.ts";
import type { PriceAnchor } from "../../types/intent-card.ts";

const goodPrice: PriceAnchor = {
  totalYuan: 80,
  basis: "quote",
  changeRule: "加项需确认",
  refundRule: "未上门全退",
};

test("考卷1: 价格三要素＋不可逆点缺一即抛", () => {
  assertPriceComplete(goodPrice, ["接单后取消扣款"]);
  assert.throws(() => assertPriceComplete({ ...goodPrice, totalYuan: 0 }, ["x"]), /totalYuan/);
  assert.throws(() => assertPriceComplete({ ...goodPrice, changeRule: "  " }, ["x"]), /差价/);
  assert.throws(() => assertPriceComplete({ ...goodPrice, refundRule: "" }, ["x"]), /退款/);
  assert.throws(() => assertPriceComplete(goodPrice, []), /不可逆/);
  assert.throws(() => assertPriceComplete(goodPrice, ["  "]), /不可逆/);
});

test("考卷2: 用户值压 AI 值；AI·猜阈值", () => {
  const lines = mergeIntentLines(
    [{ key: "time", label: "时间", value: "明天", source: "ai", editable: true }],
    [{ key: "time", label: "时间", value: "今晚", source: "user", editable: true }],
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0].value, "今晚");
  assert.equal(aiLevelOf(0.9), "high");
  assert.equal(aiLevelOf(0.7), "mid");
  assert.equal(aiLevelOf(AI_GUESS_BELOW - 0.01), "guess");
});

test("考卷3: stale 不可达 locked；locked 终态", () => {
  assert.equal(canTransition("stale", "locked"), false);
  assert.equal(canTransition("ready", "locked"), true);
  assert.equal(canTransition("locked", "ready"), false);
  assert.equal(canTransition("stale", "assembling"), true);
  const card = defaultIntentCard({ id: "t", title: "t", floorYuan: 50, now: 1000 });
  assert.equal(isStale(card, 1000 + 15 * 60_000 + 1), true);
  assert.equal(isStale({ ...card, state: "locked" }, 99999999), false);
});

test("考卷4: LLM 空回默认卡仍含完整价格锚", () => {
  const card = defaultIntentCard({ id: "t", title: "通用需求", floorYuan: 0 });
  assert.doesNotThrow(() => assertPriceComplete(card.price, card.irreversible));
  assert.equal(card.price.basis, "ammo-floor");
  assert.equal(card.state, "assembling");
});
