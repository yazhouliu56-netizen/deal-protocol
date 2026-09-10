import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyDraft,
  MAX_PHOTO_FACTS,
  mergeDraft,
  missingOf,
  nextQuestion,
  normalizeDraft,
} from "./publish-draft.ts";

test("normalizeDraft: 非法形状回空草稿", () => {
  assert.deepEqual(normalizeDraft(null), emptyDraft());
  assert.deepEqual(normalizeDraft("xxx"), emptyDraft());
  assert.deepEqual(normalizeDraft({}), emptyDraft());
});

test("normalizeDraft: 毒丸围栏（超长截断/预算取严）", () => {
  const d = normalizeDraft({ category: "  上门做饭  ", budgetYuan: -50, note: "x".repeat(500) });
  assert.equal(d.category, "上门做饭");
  assert.equal(d.budgetYuan, 0);
  assert.ok(d.note.length <= 120);
  assert.equal(normalizeDraft({ budget: "abc" }).budgetYuan, 0);
  assert.equal(normalizeDraft({ budget: "200" }).budgetYuan, 200);
});

test("mergeDraft: 非空覆盖 + 照片事实并入note", () => {
  const prev = { ...emptyDraft(), category: "保洁", note: "带工具" };
  const m = mergeDraft(prev, normalizeDraft({ time: "明天", budgetYuan: 100 }), ["双开门冰箱", "", "  "]);
  assert.equal(m.category, "保洁");
  assert.equal(m.time, "明天");
  assert.equal(m.budgetYuan, 100);
  assert.ok(m.note.includes("双开门冰箱"));
  assert.equal(MAX_PHOTO_FACTS, 3);
});

test("missingOf/nextQuestion: 缺项追问优先级", () => {
  assert.deepEqual(missingOf(emptyDraft()), ["category", "time", "area", "budget"]);
  assert.equal(nextQuestion([]), null);
  const q = nextQuestion(["time", "budget"]);
  assert.ok(q && q.includes("什么时候"));
});
