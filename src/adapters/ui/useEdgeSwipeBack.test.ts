import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EDGE_SWIPE_EDGE_ZONE_PX,
  EDGE_SWIPE_THRESHOLD_PX,
  EDGE_SWIPE_VERTICAL_RATIO,
  evaluateEdgeSwipe,
} from "./useEdgeSwipeBack.ts";

test("左边缘判定带：0 ≤ startX ≤ 24px 内成立", () => {
  for (const x of [0, 8, EDGE_SWIPE_EDGE_ZONE_PX]) {
    assert.equal(
      evaluateEdgeSwipe({ start: { x, y: 300 }, end: { x: x + 100, y: 310 } }),
      true,
      `startX=${x} 应成立`,
    );
  }
});

test("左边缘外（startX > 24px）不触发", () => {
  assert.equal(
    evaluateEdgeSwipe({ start: { x: EDGE_SWIPE_EDGE_ZONE_PX + 1, y: 300 }, end: { x: 200, y: 310 } }),
    false,
  );
  assert.equal(
    evaluateEdgeSwipe({ start: { x: 500, y: 300 }, end: { x: 600, y: 310 } }),
    false,
  );
});

test("负数起始 X 防御：不触发", () => {
  assert.equal(
    evaluateEdgeSwipe({ start: { x: -1, y: 300 }, end: { x: 200, y: 310 } }),
    false,
  );
});

test("水平滑动阈值：deltaX 必须严格大于 60px（=60 不触发，>60 触发）", () => {
  assert.equal(
    evaluateEdgeSwipe({ start: { x: 0, y: 300 }, end: { x: EDGE_SWIPE_THRESHOLD_PX, y: 300 } }),
    false,
  );
  assert.equal(
    evaluateEdgeSwipe({ start: { x: 0, y: 300 }, end: { x: EDGE_SWIPE_THRESHOLD_PX + 1, y: 300 } }),
    true,
  );
});

test("水平主导判定：|dx| > |dy| * 1.5 才触发，垂直滑动忽略", () => {
  const ratio = EDGE_SWIPE_VERTICAL_RATIO;
  const dx = 100;
  const okDy = Math.floor(100 / ratio) - 1;
  const badDy = Math.ceil(100 / ratio) + 1;
  assert.equal(
    evaluateEdgeSwipe({ start: { x: 0, y: 300 }, end: { x: dx, y: 300 + okDy } }),
    true,
  );
  assert.equal(
    evaluateEdgeSwipe({ start: { x: 0, y: 300 }, end: { x: dx, y: 300 + badDy } }),
    false,
    "垂直主导手势应被忽略",
  );
  assert.equal(
    evaluateEdgeSwipe({ start: { x: 0, y: 300 }, end: { x: dx, y: 300 - badDy } }),
    false,
  );
});

test("纯垂直下拉（dy 大、dx 0）：即使起点在边缘也不触发", () => {
  assert.equal(
    evaluateEdgeSwipe({ start: { x: 0, y: 100 }, end: { x: 0, y: 500 } }),
    false,
  );
});

test("向左滑（负 deltaX）：不触发返回", () => {
  assert.equal(
    evaluateEdgeSwipe({ start: { x: 24, y: 300 }, end: { x: 0, y: 300 } }),
    false,
  );
});

test("自定义参数：threshold / edgeZone / verticalRatio 全部生效", () => {
  const evalFn = (e: Parameters<typeof evaluateEdgeSwipe>[0]) =>
    evaluateEdgeSwipe({
      threshold: 30,
      edgeZone: 40,
      verticalRatio: 2,
      ...e,
    });
  assert.equal(evalFn({ start: { x: 40, y: 300 }, end: { x: 80, y: 305 } }), true);
  assert.equal(evalFn({ start: { x: 41, y: 300 }, end: { x: 80, y: 305 } }), false);
  assert.equal(evalFn({ start: { x: 40, y: 300 }, end: { x: 69, y: 305 } }), false);
  assert.equal(evalFn({ start: { x: 40, y: 300 }, end: { x: 80, y: 320 } }), false);
});

test("无位移 / 单点：不触发", () => {
  assert.equal(
    evaluateEdgeSwipe({ start: { x: 0, y: 300 }, end: { x: 0, y: 300 } }),
    false,
  );
});
