import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FORGIVE_PENALTY,
  INITIAL_BALANCE,
  UNFORGIVEN_PENALTY,
  quotaHalved,
  settleBreach,
  type VirtualAccount,
} from "./violation.ts";

const now = 1_700_000_000_000;
const acct: VirtualAccount = { balance: INITIAL_BALANCE };

test("forgive: light ¥5 penalty, no credit impact", () => {
  const out = settleBreach(acct, "forgive", now);
  assert.equal(out.account.balance, INITIAL_BALANCE - FORGIVE_PENALTY);
  assert.equal(out.creditDelta, 0);
  assert.equal(out.penalty, FORGIVE_PENALTY);
  assert.equal(quotaHalved(out.account, now + 1000), false);
});

test("unforgiven: ¥30 + credit −1 + 3-day quota half", () => {
  const out = settleBreach(acct, "unforgiven", now);
  assert.equal(out.account.balance, INITIAL_BALANCE - UNFORGIVEN_PENALTY);
  assert.equal(out.creditDelta, -1);
  assert.ok(quotaHalved(out.account, now + 60_000));
  assert.equal(quotaHalved(out.account, now + 3 * 24 * 3600_000 + 1), false);
});

test("balance never goes negative", () => {
  const broke: VirtualAccount = { balance: 10 };
  const out = settleBreach(broke, "unforgiven", now);
  assert.equal(out.account.balance, 0);
});