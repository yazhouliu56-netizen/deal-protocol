import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ORGANIZER_PLAN,
  renewSubscription,
  subDaysLeft,
  subStatus,
  type OrganizerSubscription,
} from "./organizerSubscription.ts";

const T0 = new Date("2026-08-09T00:00:00Z");
const PLUS_29D = new Date("2026-09-07T00:00:00Z");
const PLUS_31D = new Date("2026-09-09T12:00:00Z");

test("subStatus: no period → none", () => {
  assert.equal(subStatus({ status: "none" }, T0), "none");
});

test("renewSubscription: fresh start is active for the plan duration", () => {
  const sub = renewSubscription({ status: "none" }, T0);
  assert.equal(sub.status, "active");
  assert.ok(sub.expiresAt);
  assert.ok(subStatus(sub, PLUS_29D) === "active");
  assert.ok(subStatus(sub, PLUS_31D) === "expired");
});

test("renewSubscription: renewing extends from expiry, not from now (no lost days)", () => {
  const first = renewSubscription({ status: "none" }, T0);
  const renewed = renewSubscription(first, PLUS_29D);
  // anchor = expiry (T0+30d) → new expiry = T0+60d
  const exp = new Date(renewed.expiresAt!).getTime();
  const expNow = T0.getTime() + 2 * ORGANIZER_PLAN.durationDays * 86400000;
  assert.equal(exp, expNow);
});

test("renewSubscription: renewed while still active extends from expiry", () => {
  const first = renewSubscription({ status: "none" }, T0);
  const mid = new Date("2026-08-20T00:00:00Z");
  const renewed = renewSubscription(first, mid);
  const exp = new Date(renewed.expiresAt!).getTime();
  assert.equal(exp, T0.getTime() + 2 * ORGANIZER_PLAN.durationDays * 86400000);
});

test("subDaysLeft: counts down, floors at 0", () => {
  const sub: OrganizerSubscription = {
    status: "active",
    expiresAt: "2026-09-08T00:00:00Z",
  };
  assert.equal(subDaysLeft(sub, T0), 30);
  assert.equal(subDaysLeft(sub, PLUS_31D), 0);
});
