import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyBiIntent,
  extractBiTimeRange,
  parseConversationalBiQuery,
  parseConversationalBiQuerySync,
  type BiContractRow,
} from "./bi.ts";

const DAY = 24 * 3600_000;
const NOW = 1_760_000_000_000;
const seedRows: BiContractRow[] = [
  // 家政：31 天前（30 天窗外）+ 5 天前 + 2 天前
  { category: "家政", amount: 20000, createdAt: NOW - 31 * DAY, fundStatus: "HELD" },
  { category: "家政", amount: 30000, createdAt: NOW - 5 * DAY, fundStatus: "COMPLETED", violation: true },
  { category: "家政", amount: 10000, createdAt: NOW - 2 * DAY, fundStatus: "COMPLETED" },
  // 陪玩：5 天前 + 1 天前
  { category: "陪玩", amount: 5000, createdAt: NOW - 5 * DAY, fundStatus: "COMPLETED" },
  { category: "陪玩", amount: 8000, createdAt: NOW - 1 * DAY, fundStatus: "COMPLETED", violation: true },
  // 组局：3 天前
  { category: "组局", amount: 12000, createdAt: NOW - 3 * DAY, fundStatus: "COMPLETED" },
];

test("classifyBiIntent：三类意图 + 兜底分流", () => {
  assert.equal(classifyBiIntent("统计各品类违约率与退款分布"), "category-violation");
  assert.equal(classifyBiIntent("分析近30天平台佣金与保险计提走势"), "funding-trend");
  assert.equal(classifyBiIntent("服务者履约与信用评分分析"), "provider-credit");
  assert.equal(classifyBiIntent("今天天气怎么样"), "overview");
});

test("extractBiTimeRange：近 N 天 vs 全量", () => {
  const ctx = { contracts: seedRows, now: NOW };
  const r30 = extractBiTimeRange("分析近30天平台佣金与保险计提走势", ctx);
  assert.equal(r30.start, NOW - 30 * DAY);
  assert.equal(r30.end, NOW);
  const all = extractBiTimeRange("各品类违约率对比", ctx);
  assert.equal(all.start, NOW - 31 * DAY);
});

test("品类违约查询：chartData 数学真实 + 指标卡齐全", () => {
  const report = parseConversationalBiQuerySync("统计各品类违约率与退款分布", { contracts: seedRows, now: NOW });
  assert.equal(report.chartType, "BAR");
  assert.equal(report.metrics.length, 4);
  // 违约总数守恒：seedRows 违约 2 单
  const totalViolations = report.chartData.reduce((s, d) => s + d.value, 0);
  assert.equal(totalViolations, 2);
  const totalOrders = report.chartData.reduce((s, d) => s + (d.secondaryValue ?? 0), 0);
  assert.equal(totalOrders, 6);
  assert.ok(report.summary.includes("归因"));
  assert.equal(report.suggestedFollowUps.length, 3);
});

test("资金分账走势：近 30 天过滤 + LINE + 佣金/保险口径可复现", () => {
  const report = parseConversationalBiQuerySync("分析近30天平台佣金与保险计提走势", { contracts: seedRows, now: NOW });
  assert.equal(report.chartType, "LINE");
  assert.ok(report.chartData.length >= 2);
  const gmvSum = report.chartData.reduce((s, d) => s + d.value, 0);
  const feeSum = report.chartData.reduce((s, d) => s + (d.secondaryValue ?? 0), 0);
  // 30 天内行数：5d/2d/3d/1d 家政 2 单 + 陪玩 2 单 + 组局 1 单 = 5 单
  const expectedGmv = 30000 + 10000 + 12000 + 8000 + 5000;
  assert.equal(gmvSum, expectedGmv);
  // 佣金口径 15%：期望 = Σ amount × 0.15（round 2）
  assert.equal(feeSum, Math.round(expectedGmv * 0.15 * 100) / 100);
  assert.ok(report.summary.includes("佣金"));
});

test("服务者履约查询：TABLE + 完成/违约列", () => {
  const report = parseConversationalBiQuerySync("服务者履约与信用评分分析", { contracts: seedRows, now: NOW });
  assert.equal(report.chartType, "TABLE");
  const completedSum = report.chartData.reduce((s, d) => s + d.value, 0);
  assert.equal(completedSum, 5); // COMPLETED 5 单
  const violationSum = report.chartData.reduce((s, d) => s + (d.secondaryValue ?? 0), 0);
  assert.equal(violationSum, 2);
});

test("无法识别意图：全局运营概览兜底，不抛异常", () => {
  const report = parseConversationalBiQuerySync("今天天气怎么样", { contracts: seedRows, now: NOW });
  assert.equal(report.title, "全局运营概览");
  assert.equal(report.chartType, "TABLE");
  assert.equal(report.chartData.length, 3);
  assert.equal(report.chartData.reduce((s, d) => s + d.value, 0), 6);
  assert.equal(report.metrics.length, 4);
});

test("空数据上下文：兜底报表零崩溃", () => {
  const report = parseConversationalBiQuerySync("统计各品类违约率", { contracts: [], now: NOW });
  assert.equal(report.chartData.length, 0);
  assert.ok(report.summary.length > 0);
});

test("async 主入口：无 LLM key 离线环境 100% 规则兜底（红线 1）", async () => {
  const report = await parseConversationalBiQuery("统计各品类违约率与退款分布", {
    contracts: seedRows,
    now: NOW,
  });
  // LLM 仅增强 summary 文案；结构（metrics/chartData）永远由确定性核心链产出
  assert.ok(report.summary.length > 0);
  assert.deepEqual(
    report.metrics.map((m) => m.key),
    ["violation_rate", "violations", "total", "amount"]
  );
  assert.equal(
    report.chartData.reduce((s, d) => s + d.value, 0),
    2
  );
});