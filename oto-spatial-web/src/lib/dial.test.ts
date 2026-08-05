import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIAL_TTL_MS,
  dialExpiresAt,
  fnv1a,
  isDialLive,
  makeDialCode,
} from "./dial.ts";

test("makeDialCode is deterministic and shared between both sides", () => {
  const seed = "wave-1:r-1:d-9";
  const a = makeDialCode(seed);
  const b = makeDialCode(seed);
  assert.equal(a, b);
  assert.match(a, /^0571-\d{4}-\d{4}$/);
  const other = makeDialCode("wave-2:r-1:d-9");
  assert.notEqual(a, other);
});

test("fnv1a differs across seeds and is stable", () => {
  assert.equal(fnv1a("abc"), fnv1a("abc"));
  assert.notEqual(fnv1a("abc"), fnv1a("abd"));
});

test("dial line expires DIAL_TTL_MS after lock", () => {
  const lockedAt = 1_000_000;
  assert.equal(isDialLive(lockedAt, lockedAt), true);
  assert.equal(isDialLive(lockedAt, lockedAt + DIAL_TTL_MS - 1), true);
  assert.equal(isDialLive(lockedAt, lockedAt + DIAL_TTL_MS), false);
  assert.equal(dialExpiresAt(lockedAt) - lockedAt, DIAL_TTL_MS);
});