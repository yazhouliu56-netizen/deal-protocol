import { test } from "node:test";
import assert from "node:assert/strict";
import { fissionIncrement, fissionStamp } from "./fission.ts";

type WaveLite = { fissionCount?: number; fissionBy?: string[]; fissionUpdatedAt?: number };

test("brand-new joiner counts +1", () => {
  const out = fissionIncrement({} as WaveLite, "r2");
  assert.equal(out.fissionCount, 1);
  assert.deepEqual(out.fissionBy, ["r2"]);
});

test("same joiner never counts twice (self-boost guard)", () => {
  const base = { fissionCount: 1, fissionBy: ["r2"] };
  const again = fissionIncrement(base, "r2");
  assert.equal(again.fissionCount, 1);
  assert.deepEqual(again.fissionBy, ["r2"]);
});

test("sequential distinct joiners accumulate", () => {
  let w: WaveLite = {};
  for (const id of ["a", "b", "c", "a"]) {
    w = fissionIncrement(w, id);
  }
  assert.equal(w.fissionCount, 3);
  assert.deepEqual(w.fissionBy, ["a", "b", "c"]);
});

test("empty newcomer is no-op", () => {
  const out = fissionIncrement({ fissionCount: 2, fissionBy: ["x"] } as WaveLite, "");
  assert.equal(out.fissionCount, 2);
  assert.deepEqual(out.fissionBy, ["x"]);
});

test("fissionStamp: 真实增量才刷新时间戳", () => {
  const out = fissionStamp({} as WaveLite, "r2", 1700000000000);
  assert.equal(out.fissionCount, 1);
  assert.equal(out.fissionUpdatedAt, 1700000000000);
});

test("fissionStamp: 重复人不刷新时间戳（保留旧值）", () => {
  const base: WaveLite = { fissionCount: 1, fissionBy: ["r2"], fissionUpdatedAt: 1000 };
  const again = fissionStamp(base, "r2", 2000);
  assert.equal(again.fissionCount, 1);
  assert.equal(again.fissionUpdatedAt, 1000);
});

test("fissionStamp: 新加入者增量 → 旧时间戳被新时间戳覆盖", () => {
  const base: WaveLite = { fissionCount: 1, fissionBy: ["r2"], fissionUpdatedAt: 1000 };
  const out = fissionStamp(base, "r3", 3000);
  assert.equal(out.fissionCount, 2);
  assert.equal(out.fissionUpdatedAt, 3000);
});