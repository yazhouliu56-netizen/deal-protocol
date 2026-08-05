import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptFulfilment,
  autoFulfilmentRemaining,
  FULFILMENT_WINDOW_MS,
  requestPayment,
  resolveAutoFulfilment,
} from "./fulfilment.ts";
import type { Claim } from "./wave.ts";

const claim = (over: Partial<Claim> = {}): Claim =>
  ({
    id: "c1",
    waveId: "w1",
    responderId: "r-1",
    status: "accepted",
    rounds: 0,
    depositPhase: "held",
    createdAt: 1_000,
    ...over,
  }) as Claim;

test("requestPayment opens the demander's release gate", () => {
  const out = requestPayment(claim(), 5_000);
  assert.equal(out.serviceDoneAt, 5_000);
  // idempotent guard
  assert.throws(() => requestPayment(out), /already-reported/);
  assert.throws(() => requestPayment(claim({ status: "negotiating" })), /not-accepted/);
});

test("acceptFulfilment requires a report + a non-empty evidence note", () => {
  const reported = claim({ serviceDoneAt: 5_000 });
  const out = acceptFulfilment(reported, " 上门做完，桌摆好了 ", 9_000);
  assert.equal(out.fulfilment?.confirmedBy, "demander");
  assert.equal(out.fulfilment?.confirmedAt, 9_000);
  assert.equal(out.fulfilment?.note, "上门做完，桌摆好了");
  assert.equal(out.fulfilledAt, 9_000);
  assert.equal(out.depositPhase, "confirmed", "押金解冻");

  assert.throws(() => acceptFulfilment(claim(), "note"), /not-reported/);
  assert.throws(() => acceptFulfilment(reported, "   "), /note.required/);
  assert.throws(() => acceptFulfilment(out, "again"), /already-confirmed/);
});

test("acceptFulfilment keeps no-deposit waves flowing", () => {
  const reported = claim({ depositPhase: undefined, serviceDoneAt: 5_000 });
  const out = acceptFulfilment(reported, "已当面交付");
  assert.equal(out.depositPhase, undefined);
  assert.ok(out.fulfilledAt);
});

test("resolveAutoFulfilment auto-releases after the 72h window", () => {
  const reported = claim({ serviceDoneAt: 5_000 });
  // before the window → no-op
  assert.equal(resolveAutoFulfilment(reported, 5_000 + FULFILMENT_WINDOW_MS - 1), null);
  // at the window → auto release
  const out = resolveAutoFulfilment(reported, 5_000 + FULFILMENT_WINDOW_MS);
  assert.equal(out?.fulfilment?.confirmedBy, "auto");
  assert.equal(out?.depositPhase, "confirmed");
  // idempotent
  assert.equal(resolveAutoFulfilment(out!, 5_000 + FULFILMENT_WINDOW_MS + 1), null);
  // not reported → never auto
  assert.equal(resolveAutoFulfilment(claim(), 1e15), null);
});

test("autoFulfilmentRemaining counts down to release", () => {
  const reported = claim({ serviceDoneAt: 5_000 });
  assert.equal(autoFulfilmentRemaining(reported, 5_000), FULFILMENT_WINDOW_MS);
  assert.equal(autoFulfilmentRemaining(reported, 5_000 + FULFILMENT_WINDOW_MS / 2), FULFILMENT_WINDOW_MS / 2);
  assert.equal(autoFulfilmentRemaining(reported, 5_000 + FULFILMENT_WINDOW_MS + 1), 0);
  assert.equal(autoFulfilmentRemaining(claim(), 1e15), 0);
});