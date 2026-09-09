import { test } from "node:test";
import assert from "node:assert/strict";
import { TOUCH_TARGET } from "./touch-targets.ts";

test("三轨档位值：compact 40 / standard 44 / primary 48", () => {
  assert.equal(TOUCH_TARGET.compact, 40);
  assert.equal(TOUCH_TARGET.standard, 44);
  assert.equal(TOUCH_TARGET.primary, 48);
});

test("档位单调递增：compact < standard < primary", () => {
  assert.ok(TOUCH_TARGET.compact < TOUCH_TARGET.standard);
  assert.ok(TOUCH_TARGET.standard < TOUCH_TARGET.primary);
});

test("WCAG 基线：standard 即 44，primary 不低于 48", () => {
  assert.ok(TOUCH_TARGET.standard >= 44);
  assert.ok(TOUCH_TARGET.primary >= 48);
});
