import { test } from "node:test";
import assert from "node:assert/strict";
import { compact, due, enqueue, markPlayed, type QueuedOp } from "./offlineQueue.ts";
import { allow, lever, trip, type Breaker } from "./circuit.ts";
import { abWinner, degrades, lakeAppend, lakeVerify, pickVariant } from "./resilience.ts";

test("离线队列：幂等入队 + 重放 + 指数退避", () => {
  let q: QueuedOp[] = [];
  const r1 = enqueue(q, { kind: "publish", payload: "羽毛球 100 元" }, 1000);
  q = r1.q;
  const r2 = enqueue(q, { kind: "publish", payload: "羽毛球 100 元" }, 2000);
  assert.equal(r2.fresh, false);
  assert.equal(due(q, 999).length, 0);
  assert.equal(due(q, 1000).length, 1);

  const item = due(q, 1000)[0];
  q = markPlayed(q, item.id, false, 1000); // 失败 → 退避 1000×2^1 = 2s → tryAt 3000
  assert.equal(q[0].attempts, 1);
  assert.equal(due(q, 2999).length, 0);
  assert.equal(due(q, 3000).length, 1);
  q = markPlayed(q, item.id, true, 3000);
  assert.equal(q[0].done, true);
  q = compact(q);
  assert.equal(q.length, 0);
});

test("熔断：3 次失败 → open；冷却后 half-open 探测成功 → closed", () => {
  let b: Breaker = { state: "closed", failures: 0, probes: 0, openedAt: 0 };
  b = trip(b, false, 1000);
  b = trip(b, false, 1100);
  b = trip(b, false, 1200);
  assert.equal(b.state, "open"); // openedAt = 1200
  assert.equal(allow(b, 1300).ok, false); // 冷却中拒绝
  const probe = allow(b, 1200 + BREAKER_COOLDOWN + 1);
  assert.equal(probe.ok, true);
  b = trip(probe.breaker, true, 1200 + BREAKER_COOLDOWN + 2);
  assert.equal(b.state, "closed");
});

const BREAKER_COOLDOWN = 30_000;

test("供需杠杆：供不应求 / 过剩 / 平衡", () => {
  assert.equal(lever({ demandCount: 10, supplyCount: 3 }).signal, "thin-supply");
  assert.equal(lever({ demandCount: 3, supplyCount: 10 }).signal, "glut");
  assert.equal(lever({ demandCount: 5, supplyCount: 5 }).signal, "balanced");
});

test("降级四部曲：逐级降级直到成功", () => {
  const { value, log } = degrades([
    { name: "llm", run: () => null },
    { name: "规则", run: () => "fallback" },
  ]);
  assert.equal(value, "fallback");
  assert.equal(log[0], "✗ llm（无结果）");
  assert.equal(log[1], "✓ 规则");
});

test("哈希存证：append 链 + 校验 + 中间篡改检出", () => {
  let lake = lakeAppend([], "wave", { id: 1 }, 1000);
  lake = lakeAppend(lake, "claim", { id: 2 }, 2000);
  lake = lakeAppend(lake, "pay", { id: 3 }, 3000);
  assert.equal(lakeVerify(lake).ok, true);
  const tampered = lake.map((r, i) => (i === 1 ? { ...r, payload: { id: 99 } } : r));
  const v = lakeVerify(tampered);
  assert.equal(v.ok, false);
  assert.equal(v.brokenAt, 1);
});

test("AB：按用户哈希均匀分流 + 获胜判定", () => {
  const variants = [{ id: "A", label: "变体A" }, { id: "B", label: "变体B" }];
  const pick = pickVariant("user-42", variants);
  assert.ok(["A", "B"].includes(pick.id));
  const w = abWinner(
    [{ variantId: "A", metric: 80 }],
    [{ variantId: "B", metric: 50 }],
    10
  );
  assert.equal(w.winner, "A");
  const tie = abWinner([{ variantId: "A", metric: 55 }], [{ variantId: "B", metric: 50 }], 10);
  assert.equal(tie.winner, "tie");
});