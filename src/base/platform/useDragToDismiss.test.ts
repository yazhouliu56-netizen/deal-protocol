import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DRAG_DISMISS_DEFAULT_THRESHOLD,
  shouldDismissSheet,
} from "./useDragToDismiss.ts";

const H = 500;

test("下拉位移 36%：触发 dismiss（36% > 35%）", () => {
  assert.equal(shouldDismissSheet(H * 0.36, H), true);
  assert.equal(shouldDismissSheet(H * 0.36, H, DRAG_DISMISS_DEFAULT_THRESHOLD), true);
});

test("下拉位移 30%：忽略 dismiss（未达 35%）", () => {
  assert.equal(shouldDismissSheet(H * 0.3, H), false);
  assert.equal(shouldDismissSheet(H * 0.34, H), false);
});

test("边界：恰好 35% 不触发（严格大于）", () => {
  assert.equal(shouldDismissSheet(H * 0.35, H), false);
  assert.equal(shouldDismissSheet(H * 0.350001, H), true);
});

test("反向向上滑动（deltaY < 0）：永不触发", () => {
  assert.equal(shouldDismissSheet(-H * 0.5, H), false);
  assert.equal(shouldDismissSheet(-1, H), false);
});

test("零位移（deltaY === 0）：不触发", () => {
  assert.equal(shouldDismissSheet(0, H), false);
});

test("容器高度非法（0 / 负值）：防御性拒绝，无除零异常", () => {
  assert.equal(shouldDismissSheet(180, 0), false);
  assert.equal(shouldDismissSheet(180, -500), false);
});

test("自定义阈值生效（如 50%）", () => {
  assert.equal(shouldDismissSheet(H * 0.49, H, 0.5), false);
  assert.equal(shouldDismissSheet(H * 0.51, H, 0.5), true);
});

test("thresholdRatio 非法（≤0）：防御性拒绝", () => {
  assert.equal(shouldDismissSheet(180, H, 0), false);
  assert.equal(shouldDismissSheet(180, H, -0.1), false);
});

test("极小容器 + 小位移：按比例正确判定（浮点精度）", () => {
  assert.equal(shouldDismissSheet(36, 100), true);
  assert.equal(shouldDismissSheet(35, 100), false);
  assert.equal(shouldDismissSheet(350, 1000), false);
  assert.equal(shouldDismissSheet(351, 1000), true);
});
