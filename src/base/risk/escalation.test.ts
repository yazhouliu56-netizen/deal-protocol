/**
 * 哨所值班队列考卷（B2 · node:test）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  autoFuse,
  buildP2Digest,
  claimP1,
  ESCALATION_L1,
  ESCALATION_L2,
  needsUpgrade,
  pushP1,
  resolveP1,
  sweepP1,
  UPGRADE_AMOUNT_YUAN,
  type P1Item,
} from "./escalation.ts";

test("P0：见信号即熔断（冻结＋双路通知＋审计），不等人", () => {
  const a = autoFuse("SOS_TRIGGERED", "order-1");
  assert.equal(a.fused, true);
  assert.equal(a.freezeOrders, true);
  assert.deepEqual(a.notify, ["平台值班", "紧急联系人"]);
  assert.match(a.audit, /SOS_TRIGGERED/);
});

test("P1：入队去重＋认领＋解决（沉淀规则计数）", () => {
  let q: P1Item[] = [];
  q = pushP1(q, { id: "p1", kind: "FUSE_CASE", summary: "熔断个案" }, 1000);
  q = pushP1(q, { id: "p1", kind: "FUSE_CASE", summary: "重复" }, 1000);
  assert.equal(q.length, 1);
  assert.equal(q[0].slaDueAt, 1000 + 5 * 60 * 1000);
  q = claimP1(q, "p1", "ops-轮值");
  assert.equal(q[0].status, "claimed");
  q = resolveP1(q, "p1", "确认熔断", 2);
  assert.equal(q[0].status, "resolved");
  assert.equal(q[0].rulesMinted, 2);
});

test("升级三条线：R1首现／超阈／L1举手（阈值 2000）", () => {
  assert.equal(UPGRADE_AMOUNT_YUAN, 2000);
  assert.equal(needsUpgrade({ kind: "R1_CRITICAL_FIRST" }), true);
  assert.equal(needsUpgrade({ kind: "L1_MANUAL" }), true);
  assert.equal(needsUpgrade({ kind: "FUSE_CASE", amountYuan: 2001 }), true);
  assert.equal(needsUpgrade({ kind: "FUSE_CASE", amountYuan: 2000 }), false);
  assert.equal(needsUpgrade({ kind: "APPEAL" }), false);
});

test("过期未决自动升级 L3（毫秒边界）", () => {
  let q: P1Item[] = [];
  q = pushP1(q, { id: "p1", kind: "APPEAL", summary: "申诉" }, 1000);
  const due = q[0].slaDueAt;
  q = sweepP1(q, due);
  assert.equal(q[0].status, "open");
  q = sweepP1(q, due + 1);
  assert.equal(q[0].status, "escalated");
  assert.equal(q[0].escalateTo, "L3");
});

test("P2 日报：已决聚合＋规则沉淀数", () => {
  let q: P1Item[] = [];
  q = pushP1(q, { id: "a", kind: "FUSE_CASE", summary: "x" }, 1);
  q = pushP1(q, { id: "b", kind: "APPEAL", summary: "y" }, 1);
  q = resolveP1(q, "a", "ok", 2);
  q = resolveP1(q, "b", "ok", 1);
  const d = buildP2Digest(q);
  assert.equal(d.resolved, 2);
  assert.equal(d.rulesMinted, 3);
  assert.deepEqual(d.byKind, { FUSE_CASE: 1, APPEAL: 1 });
});

test("升级通讯录定稿：L1 值班运营 L，L2 创始人", () => {
  assert.match(ESCALATION_L1, /值班运营/);
  assert.equal(ESCALATION_L2, "创始人");
});
