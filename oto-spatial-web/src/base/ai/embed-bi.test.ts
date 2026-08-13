import { test } from "node:test";
import assert from "node:assert/strict";
import { cosine, recommend, tokenize, vecOf, type SemCandidate } from "./embed.ts";
import { parseBiQuery, runBi, type BiRow } from "./bi.ts";

test("tokenize：中文 bigram + 英文单词", () => {
  const t = tokenize("明天 20 点 羽毛球");
  assert.ok(t.includes("羽毛"));
  assert.ok(t.includes("毛球"));
});

test("余弦：完全相同文本 → 1；不相关 → 0", () => {
  const a = vecOf("家政保洁 全屋 两小时");
  const b = vecOf("家政保洁 全屋 两小时");
  const c = vecOf("羽毛球 约局 双打");
  assert.ok(Math.abs(cosine(a, b) - 1) < 1e-9);
  assert.equal(cosine(a, c), 0);
});

test("推荐：候选按语义相关排序", () => {
  const cands: SemCandidate[] = [
    { id: "b", text: "羽毛球约局 双打 新手", label: "羽毛球" },
    { id: "a", text: "家政保洁 全屋清洁", label: "保洁" },
    { id: "c", text: "陪诊陪护 医院", label: "陪诊" },
  ];
  const r = recommend("想约羽毛球打双打", cands, 3);
  assert.equal(r[0].candidate.id, "b");
  assert.ok(r[0].score > 0.2);
});

test("推荐：无交集 → 空", () => {
  const r = recommend("碎", [{ id: "x", text: "完全不同语义的文本内容" }], 1);
  assert.equal(r.length, 0);
});

test("BI：中文查询解析指标", () => {
  assert.equal(parseBiQuery("看下成交情况").metric, "claims");
  assert.equal(parseBiQuery("最近违约几次").metric, "violations");
  const q = parseBiQuery("类目家政的收益是多少");
  assert.equal(q.metric, "revenue");
  assert.equal(q.category, "家政");
});

test("BI：聚合统计", () => {
  const now = Date.now();
  const rows: BiRow[] = [
    { authorId: "a", category: "家政", createdAt: now - 86400_000 * 2, amount: 100 },
    { authorId: "a", category: "家政", createdAt: now - 86400_000, amount: 50 },
    { authorId: "a", category: "羽毛球", createdAt: now - 86400_000 * 10, amount: 200 },
  ];
  const q = parseBiQuery("近 7 天类目家政的收益");
  const r = runBi({ ...q, since: now - 86400_000 * 7 }, rows, now);
  assert.equal(r.value, "¥150");
  assert.equal(r.rows, 2);
  assert.equal(r.since, "近 7 天");
});