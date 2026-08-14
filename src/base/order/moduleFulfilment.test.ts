import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allModulesConfirmed,
  confirmModule,
  confirmedCount,
  initModuleStates,
  reportModule,
} from "./moduleFulfilment.ts";
import type { TaskModuleState } from "./moduleFulfilment.ts";
import type { Claim } from "./wave.ts";

const baseClaim = (modules?: TaskModuleState[]) => ({
  id: "c1",
  waveId: "w1",
  responderId: "r1",
  status: "accepted" as const,
  rounds: 0,
  createdAt: 0,
  modules: modules ?? initModuleStates(3),
});

test("initModuleStates: 为每模块建 pending", () => {
  const s = initModuleStates(3);
  assert.equal(s.length, 3);
  assert.ok(s.every((m) => m.status === "pending"));
});

test("reportModule: 申报单模块完成 → done", () => {
  const out = reportModule(baseClaim(), 1, 9_000);
  assert.equal(out.modules![1].status, "done");
  assert.equal(out.modules![1].doneAt, 9_000);
  assert.equal(out.modules![0].status, "pending");
});

test("reportModule: 重复申报 → 拒绝", () => {
  const c = baseClaim();
  const reported = reportModule(c, 0, 1);
  assert.throws(() => reportModule(reported, 0, 2), /already-reported/);
});

test("reportModule: 只认已挂模块的 claim", () => {
  const c = baseClaim(undefined);
  assert.throws(() => reportModule({ ...c, modules: undefined }, 0), /not-modular/);
});

test("confirmModule: 未申报的模块不可确认", () => {
  assert.throws(() => confirmModule(baseClaim(), 0, 5), /not-done/);
});

test("confirmModule: 已 done 的模块可单独确认", () => {
  const done = reportModule(baseClaim(), 2, 100);
  const out = confirmModule(done, 2, 200);
  assert.equal(out.modules![2].status, "confirmed");
  assert.equal(out.modules![2].confirmedAt, 200);
});

test("allModulesConfirmed / confirmedCount", () => {
  let c: Claim = baseClaim();
  c = reportModule(c, 0, 1);
  c = reportModule(c, 1, 2);
  c = reportModule(c, 2, 3);
  c = confirmModule(c, 0, 10);
  assert.equal(confirmedCount(c), 1);
  assert.equal(allModulesConfirmed(c), false);
  c = confirmModule(c, 1, 11);
  c = confirmModule(c, 2, 12);
  assert.equal(allModulesConfirmed(c), true);
});