import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEPOSIT_AMOUNT,
  PLATFORM_FEE,
  forfeitDeposit,
  holdDeposit,
  payDepositPayout,
  refundDeposit,
  releaseDeposit,
} from "./deposit.ts";
import type { VirtualAccount } from "./violation.ts";

const acct = (balance: number): VirtualAccount => ({ balance });

test("holdDeposit deducts from spendable balance", () => {
  assert.equal(holdDeposit(acct(100)).balance, 100 - DEPOSIT_AMOUNT);
  assert.equal(holdDeposit(acct(3)).balance, 0); // floor at 0
});

test("releaseDeposit returns amount minus platform fee", () => {
  const out = releaseDeposit(acct(95));
  assert.equal(out.balance, 95 + (DEPOSIT_AMOUNT - PLATFORM_FEE));
});

test("forfeitDeposit keeps the money (goes to platform)", () => {
  assert.equal(forfeitDeposit(acct(95)).balance, 95);
});

test("payDepositPayout credits the demander", () => {
  assert.equal(payDepositPayout(acct(100)).balance, 100 + DEPOSIT_AMOUNT);
});

test("refundDeposit returns the full deposit", () => {
  assert.equal(refundDeposit(acct(95)).balance, 95 + DEPOSIT_AMOUNT);
});