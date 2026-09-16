/**
 * 主观三勾真相源考卷（P0 治本收敛 · 用户裁决 2026-09-16）。
 * 锁：默认全勾 / Tag恒不强制 / 复原举证门 / 信用信号口径。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SUBJECTIVE_RUBRICS,
  SUBJECTIVE_SUGGESTED_TAGS,
  defaultSubjectiveChecks,
  effectiveSubjectivePass,
  subjectiveCreditSignal,
  subjectivePassRate,
  subjectivePassedCount,
  tagRequired,
} from "./subjective-check.ts";

test("默认全勾：好人 1 秒点完", () => {
  assert.deepEqual(defaultSubjectiveChecks(), {
    attitude: true,
    appearance: true,
    restoration: true,
  });
  assert.equal(subjectivePassedCount(defaultSubjectiveChecks()), 3);
  assert.equal(subjectivePassRate(defaultSubjectiveChecks()), 1);
});

test("Tag/原因恒不强制（用户裁决锁死）", () => {
  assert.equal(tagRequired(), false);
  for (const tags of Object.values(SUBJECTIVE_SUGGESTED_TAGS)) {
    assert.ok(tags.length >= 3);
  }
});

test("复原举证门：有 after 图保留用户选择，无图恒不通过", () => {
  const checked = {
    checks: { attitude: true, appearance: true, restoration: true },
    hasAfterPhoto: false,
  };
  assert.deepEqual(effectiveSubjectivePass(checked), {
    attitude: true,
    appearance: true,
    restoration: false,
  });
  const withPhoto = { ...checked, hasAfterPhoto: true };
  assert.deepEqual(effectiveSubjectivePass(withPhoto), {
    attitude: true,
    appearance: true,
    restoration: true,
  });
  // 本来就没勾的，有图也不翻转
  const unchecked = {
    checks: { attitude: false, appearance: true, restoration: false },
    hasAfterPhoto: true,
  };
  assert.deepEqual(effectiveSubjectivePass(unchecked), unchecked.checks);
});

test("信用信号口径：通过率＋落勾项", () => {
  const s = subjectiveCreditSignal({ attitude: false, appearance: true, restoration: true });
  assert.equal(s.passRate, 2 / 3);
  assert.deepEqual(s.failedItems, ["attitude"]);
  assert.equal(Object.keys(SUBJECTIVE_RUBRICS).length, 3);
});
