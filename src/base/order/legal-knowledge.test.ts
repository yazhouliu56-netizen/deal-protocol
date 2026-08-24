/**
 * 批次 3b · 法律知识库考卷（纯数据资产完整性）：
 * 《民法典》条文键位与编号格式 / 判例结构（案号年份格式 + 法院归属）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CIVIL_CODE_ARTICLES, COURT_PRECEDENTS } from "./legal-knowledge.ts";

test("条文键位齐全：服务/承揽合同域 7 条关键法条全部在册", () => {
  assert.deepEqual(
    Object.keys(CIVIL_CODE_ARTICLES).sort(),
    ["BREACH_LIABILITY", "CONTRACTOR_OBLIGATION", "INFERIOR_PERFORMANCE", "QUALITY_STANDARD", "RESCISSION_RIGHT", "SERVICE_OBLIGATION", "TIMELY_DELIVERY"].sort(),
  );
});

test("条文编号格式：articleNo 均为「第N条」形态且 title/content 非空", () => {
  for (const article of Object.values(CIVIL_CODE_ARTICLES)) {
    assert.match(article.articleNo, /^第\d+条$/);
    assert.ok(article.title.length > 0);
    assert.ok(article.content.length > 0);
  }
  assert.equal(CIVIL_CODE_ARTICLES.INFERIOR_PERFORMANCE.articleNo, "第582条");
  assert.equal(CIVIL_CODE_ARTICLES.QUALITY_STANDARD.articleNo, "第781条");
});

test("判例库：≥3 例且 caseNo 符合（年份）+法院代字格式、court 字段非空", () => {
  assert.ok(COURT_PRECEDENTS.length >= 3);
  for (const p of COURT_PRECEDENTS) {
    assert.match(p.caseNo, /^\(\d{4}\)/);
    assert.ok(p.court.length > 0);
    assert.ok(p.summary.includes("托管") || p.summary.includes("承揽") || p.summary.includes("技术服务"));
  }
});
