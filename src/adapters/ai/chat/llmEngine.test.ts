import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDirective } from "@/base/ai/chat/llmDirective.ts";
import { SYSTEM_PROMPT } from "./llmEngine.ts";

test("parseDirective: clean json", () => {
  const d = parseDirective(
    '{"text":"你好","action":"ask","category":"badminton","need":{"level":"新手"}}'
  );
  assert.ok(d);
  assert.equal(d!.action, "ask");
  assert.equal(d!.category, "badminton");
  assert.equal(d!.need!.level, "新手");
});

test("parseDirective: strips markdown fences and preamble", () => {
  const d = parseDirective(
    '好的，我看看。\n```json\n{"text":"已整理好","action":"slots","category":"housekeeping"}\n```'
  );
  assert.ok(d);
  assert.equal(d!.action, "slots");
  assert.equal(d!.category, "housekeeping");
});

test("parseDirective: ignores unknown category and invalid action", () => {
  const bad = parseDirective(
    '{"text":"x","action":"bogus","category":"dance","need":{}}'
  );
  assert.equal(bad, null);
  const ok = parseDirective('{"text":"x","action":"done","category":null,"need":{}}');
  assert.ok(ok);
  assert.equal(ok!.category, null);
  assert.equal(ok!.action, "done");
});

test("parseDirective: unknown need keys dropped, known kept", () => {
  const d = parseDirective(
    '{"text":"x","action":"slots","category":"photography","need":{"style":"日系","bogus":1,"partySize":4}}'
  );
  assert.ok(d);
  assert.deepEqual(Object.keys(d!.need!).sort(), ["partySize", "style"]);
});

test("parseDirective: garbled output -> null", () => {
  assert.equal(parseDirective("抱歉我没看懂"), null);
  assert.equal(parseDirective('{"text":'), null);
  assert.equal(parseDirective(""), null);
});

test("SYSTEM_PROMPT 契约：含槽位回显与追问纪律指引（P2 遗留销项）", () => {
  assert.ok(SYSTEM_PROMPT.includes("槽位回显与追问纪律"));
  assert.ok(SYSTEM_PROMPT.includes('[✓ 服务:'));
  assert.ok(SYSTEM_PROMPT.includes("严禁重复询问用户已提供的信息"));
  assert.ok(SYSTEM_PROMPT.includes('"10点"→"今天 10:00"'), "timeParser 规范化口径对齐");
});

test("SYSTEM_PROMPT 契约：无旧黑话残留，JSON 结构守恒", () => {
  for (const jargon of ["鸽子险", "开放局", "弹药", "扣动扳机"]) {
    assert.equal(SYSTEM_PROMPT.includes(jargon), false, "不应出现黑话: " + jargon);
  }
  // 结构守恒：JSON 输出规范与三动作枚举未被措辞调整破坏
  assert.ok(SYSTEM_PROMPT.includes('"action":"ask|slots|done"'));
  assert.ok(SYSTEM_PROMPT.includes('{"text":'));
});
