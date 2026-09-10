import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assembleInterpret,
  buildUserText,
  interpretSystemPrompt,
  parseInterpretJson,
} from "./publish-interpret.ts";
import { emptyDraft } from "../order/publish-draft.ts";

test("parseInterpretJson: 合法JSON→草稿，毒丸→null", () => {
  const d = parseInterpretJson('{"category":"保洁","budgetYuan":150}');
  assert.equal(d?.category, "保洁");
  assert.equal(d?.budgetYuan, 150);
  assert.equal(parseInterpretJson("not json"), null);
  assert.equal(parseInterpretJson('{"a":1}'), null);
  assert.equal(parseInterpretJson('{"note":"x".repeat}'), null);
});

test("buildUserText: 历史拼接截断", () => {
  assert.equal(buildUserText(["a"], "b"), "a\nb");
  assert.ok(buildUserText([], "x".repeat(2000)).length <= 800);
});

test("assembleInterpret: 合并+追问+来源标记", () => {
  const r = assembleInterpret(emptyDraft(), { category: "维修", time: "", area: "", budgetYuan: 0, note: "" }, ["挂机空调"]);
  assert.equal(r.source, "llm");
  assert.deepEqual(r.missing, ["time", "area", "budget"]);
  assert.ok(r.question && r.question.includes("什么时候"));
  assert.ok(r.draft.note.includes("挂机空调"));
  const r2 = assembleInterpret(emptyDraft(), null, []);
  assert.equal(r2.source, "rules");
  assert.ok(r2.question && r2.question.includes("哪类服务"));
  assert.ok(interpretSystemPrompt().includes("budgetYuan"));
});
