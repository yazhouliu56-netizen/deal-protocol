import { test } from "node:test";
import assert from "node:assert/strict";
import { applyLedger, makeLedgerEntry } from "./ledger.ts";

test("applyLedger: 入账即时可用（余额增加）", () => {
  const out = applyLedger({ balance: 100 }, 80);
  assert.equal(out.balance, 180);
});

test("applyLedger: 出账从余额扣除", () => {
  const out = applyLedger({ balance: 100 }, -9.9);
  assert.ok(Math.abs(out.balance - 90.1) < 1e-9);
});

test("applyLedger: 出账不下穿 0（余额不足扣至 0）", () => {
  const out = applyLedger({ balance: 5 }, -8);
  assert.equal(out.balance, 0);
});

test("applyLedger: 纯函数，不修改入参对象", () => {
  const before = { balance: 100 };
  applyLedger(before, -30);
  assert.equal(before.balance, 100);
});

test("makeLedgerEntry: 生成带时间戳 id 与字段的条目", () => {
  const e = makeLedgerEntry(
    "commission",
    -8,
    "竞价服务费 · 羽毛球约局",
    1700000000000
  );
  assert.equal(e.kind, "commission");
  assert.equal(e.amount, -8);
  assert.ok(e.note.includes("羽毛球约局"));
  assert.equal(e.at, 1700000000000);
  assert.ok(e.id.startsWith("ledger-"));
});

test("makeLedgerEntry: 同时间戳不同调用生成不同 id", () => {
  const a = makeLedgerEntry("income", 80, "x", 1700000000000);
  const b = makeLedgerEntry("income", 80, "y", 1700000000000);
  assert.notEqual(a.id, b.id);
});