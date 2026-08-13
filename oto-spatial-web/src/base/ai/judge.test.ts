import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeLlmSuggestion, ruleJudge, type JudgeInput } from "./judge.ts";

const base: JudgeInput = {
  reason: "deliverable-missing",
  evidence: "地毯没洗，客厅还有灰尘",
  amountYuan: 200,
};

test("规则裁判：硬伤证据 → 升级全责，100% 赔付", () => {
  const v = ruleJudge({ ...base, reason: "deliverable-missing" });
  assert.equal(v.stance, "responder-full");
  assert.equal(v.refundPct, 100);
  assert.equal(v.amountYuan, 200);
  assert.equal(v.source, "rules");
});

test("规则裁判：理由 no-show 直接全退", () => {
  const v = ruleJudge({ ...base, reason: "no-show" });
  assert.equal(v.stance, "responder-full");
  assert.equal(v.refundPct, 100);
});

test("规则裁判：响应者反驳 → 降档到 part/reason 限额", () => {
  const v = ruleJudge({
    reason: "result-mismatch",
    evidence: "保洁结果和约定不符",
    responderText: "已经免费返工，客户不认可",
    amountYuan: 100,
  });
  assert.equal(v.stance, "responder-partial");
  assert.ok(v.refundPct <= 60, "late/result-mismatch 上限 60");
  assert.ok(v.amountYuan <= 60);
});

test("规则裁判：demander-change → 需求方责任，0 赔付", () => {
  const v = ruleJudge({ reason: "demander-change", evidence: "我临时改主意了", amountYuan: 300 });
  assert.equal(v.stance, "demander");
  assert.equal(v.refundPct, 0);
  assert.equal(v.amountYuan, 0);
});

test("承诺被否定 → 升档（言而无信加重）", () => {
  const v = ruleJudge({
    reason: "result-mismatch",
    evidence: "说好全屋 2 小时，结果 40 分钟就走了",
    promiseHints: ["全屋", "2 小时"],
    amountYuan: 200,
  });
  assert.equal(v.stance, "responder-full");
});

test("LLM 归一化：非法 stance 毒丸 → null 回落", () => {
  const out = normalizeLlmSuggestion(
    JSON.stringify({ stance: "everyone-wins", refundPct: 50 }),
    base
  );
  assert.equal(out, null);
});

test("LLM 归一化：超上限退款被钳制到原因档位", () => {
  const out = normalizeLlmSuggestion(
    JSON.stringify({ stance: "responder-partial", refundPct: 99, rationale: "r", replyScript: "s" }),
    { ...base, reason: "late", amountYuan: 200 }
  );
  assert.ok(out);
  assert.equal(out.refundPct, 60, "late 上限 60");
  assert.equal(out.amountYuan, 120);
  assert.equal(out.source, "llm");
  assert.equal(out.stance, "responder-partial");
});

test("LLM 归一化：demander 责任强制 0 赔付", () => {
  const out = normalizeLlmSuggestion(
    JSON.stringify({ stance: "demander", refundPct: 30 }),
    base
  );
  assert.ok(out);
  assert.equal(out.refundPct, 0);
  assert.equal(out.amountYuan, 0);
});

test("话术包含安抚 + 结论 + 后续步骤", () => {
  const v = ruleJudge({ ...base, reason: "result-mismatch", responderText: "已补救" });
  assert.ok(v.replyScript.includes("赔付") || v.replyScript.includes("无需赔付"));
  assert.ok(v.rationale.length > 10);
});