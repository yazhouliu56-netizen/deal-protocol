import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canTrialOrder, nextTrialCount, TRIAL_DAILY_CAP } from "./trial-cap.ts";

describe("trial-cap", () => {
  it("官方弹药（无计数器）不限", () => {
    assert.equal(canTrialOrder(undefined, "2026-09-10"), true);
  });

  it("10 单封顶", () => {
    assert.equal(TRIAL_DAILY_CAP, 10);
    assert.equal(canTrialOrder({ day: "2026-09-10", count: 9 }, "2026-09-10"), true);
    assert.equal(canTrialOrder({ day: "2026-09-10", count: 10 }, "2026-09-10"), false);
  });

  it("跨天归零", () => {
    assert.equal(canTrialOrder({ day: "2026-09-09", count: 10 }, "2026-09-10"), true);
    assert.deepEqual(nextTrialCount({ day: "2026-09-09", count: 10 }, "2026-09-10"), {
      day: "2026-09-10",
      count: 1,
    });
  });

  it("同天累加", () => {
    assert.deepEqual(nextTrialCount({ day: "2026-09-10", count: 3 }, "2026-09-10"), {
      day: "2026-09-10",
      count: 4,
    });
  });
});
