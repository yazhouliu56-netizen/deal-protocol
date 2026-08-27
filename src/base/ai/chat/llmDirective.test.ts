import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDirective } from "./llmDirective.ts";
import fs from "node:fs";

test("llmDirective: 动态品类 pet-boarding-v1 通过注入白名单", () => {
  const raw = JSON.stringify({ text: "好的", action: "ask", category: "pet-boarding-v1", need: {} });
  const d = parseDirective(raw, { availableCategories: ["pet-boarding-v1", "appliance-repair-v1"] });
  assert.equal(d?.category, "pet-boarding-v1");
});

test("llmDirective: 动态品类 appliance-repair-v1 通过注入", () => {
  const raw = JSON.stringify({ text: "好的", action: "slots", category: "appliance-repair-v1", need: {} });
  const d = parseDirective(raw, { availableCategories: ["pet-boarding-v1", "appliance-repair-v1"] });
  assert.equal(d?.category, "appliance-repair-v1");
});

test("llmDirective: 未在白名单则回落 null（防幻觉）", () => {
  const raw = JSON.stringify({ text: "hi", action: "ask", category: "drone-crop-spray-v1", need: {} });
  const d = parseDirective(raw, { availableCategories: ["pet-boarding-v1"] });
  assert.equal(d?.category, null);
});

test("llmDirective: 无白名单时任意 string 透传（兼容）", () => {
  const raw = JSON.stringify({ text: "hi", action: "ask", category: "housekeeping", need: {} });
  const d = parseDirective(raw);
  assert.equal(d?.category, "housekeeping");
});

test("llmDirective: 旧三硬编码不再作为字面量存在（源码层面）", () => {
  const txt = fs.readFileSync("src/base/ai/chat/llmDirective.ts", "utf8");
  assert.equal(txt.includes("badminton"), false);
  assert.equal(txt.includes("photography"), false);
  assert.equal(txt.includes("housekeeping"), false);
  assert.equal(txt.includes("availableCategories"), true);
});
