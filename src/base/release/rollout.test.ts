/**
 * 灰度发布考卷（B3 · node:test）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ROLLOUT,
  shouldServe,
  stageFor,
  tripKill,
} from "./rollout.ts";

const T0 = 1_000_000;

test("阶段推进：1%→10%→50%→100%（浸泡边界）", () => {
  assert.equal(stageFor(DEFAULT_ROLLOUT, T0, T0), 0);
  assert.equal(stageFor(DEFAULT_ROLLOUT, T0, T0 + 30 * 60000 - 1), 0);
  assert.equal(stageFor(DEFAULT_ROLLOUT, T0, T0 + 30 * 60000), 1);
  assert.equal(stageFor(DEFAULT_ROLLOUT, T0, T0 + 150 * 60000), 2);
  assert.equal(stageFor(DEFAULT_ROLLOUT, T0, T0 + 510 * 60000), 3);
  assert.equal(stageFor(DEFAULT_ROLLOUT, T0, T0 + 99999 * 60000), 3);
});

test("放行：分桶边界（1% 阶段 bucket 0.009 放、0.01 拦）", () => {
  assert.equal(shouldServe(DEFAULT_ROLLOUT, T0, T0, 0.009), true);
  assert.equal(shouldServe(DEFAULT_ROLLOUT, T0, T0, 0.01), false);
  assert.equal(shouldServe(DEFAULT_ROLLOUT, T0, T0 + 99999 * 60000, 0.999), true);
});

test("kill switch：一票否决一切放行（阶段/分桶全停）", () => {
  const killed = tripKill(DEFAULT_ROLLOUT);
  assert.equal(DEFAULT_ROLLOUT.kill, false);
  assert.equal(stageFor(killed, T0, T0), -1);
  assert.equal(shouldServe(killed, T0, T0 + 99999 * 60000, 0.0), false);
});
