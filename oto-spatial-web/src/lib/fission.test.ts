import { test } from "node:test";
import assert from "node:assert/strict";
import { fissionIncrement } from "./fission.ts";

type WaveLite = { fissionCount?: number; fissionBy?: string[] };

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