import { test } from "node:test";
import assert from "node:assert/strict";
import type { Claim } from "./wave.ts";
import {
  addGuest,
  removeGuest,
  visibleGuests,
  maskPhone,
  MAX_GUESTS_PER_SEAT,
} from "./guest.ts";

function claim(p: Partial<Claim> & { id: string }): Claim {
  return {
    waveId: "w1",
    responderId: "u1",
    status: "accepted",
    rounds: 0,
    createdAt: 1000,
    ...p,
  } as Claim;
}

test("addGuest registers one guest on a locked seat", () => {
  const r = addGuest(claim({ id: "c1" }), { name: "小美" }, 5000);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.claim.guests?.length, 1);
  assert.equal(r.claim.guests?.[0].name, "小美");
  assert.equal(r.claim.guests?.[0].at, 5000);
});

test("addGuest enforces the one-guest-per-seat limit", () => {
  const c = claim({ id: "c1", guests: [{ name: "甲", at: 1 }] });
  const r = addGuest(c, { name: "乙" }, 2);
  assert.deepEqual(r, { ok: false, error: "guest.limit-reached" });
  assert.equal(MAX_GUESTS_PER_SEAT, 1);
});

test("addGuest requires a name", () => {
  const r = addGuest(claim({ id: "c1" }), { name: "   " }, 1);
  assert.deepEqual(r, { ok: false, error: "guest.name-required" });
});

test("addGuest only on locked seats (accepted/joined)", () => {
  const r = addGuest(claim({ id: "c1", status: "withdrawn" }), { name: "甲" }, 1);
  assert.deepEqual(r, { ok: false, error: "claim.not-locked" });
});

test("addGuest keeps full registration fields (birthYear/guardianConsent/phone)", () => {
  const r = addGuest(
    claim({ id: "c1" }),
    { name: "小小", birthYear: 2019, guardianConsent: true, phone: "13800000000" },
    1
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.claim.guests?.[0].birthYear, 2019);
  assert.equal(r.claim.guests?.[0].guardianConsent, true);
  assert.equal(r.claim.guests?.[0].phone, "13800000000");
});

test("removeGuest is idempotent and removes by index", () => {
  const c = claim({
    id: "c1",
    guests: [
      { name: "甲", at: 1 },
      { name: "乙", at: 2 },
    ],
  });
  const after = removeGuest(c, 0);
  assert.equal(after.guests?.length, 1);
  assert.equal(after.guests?.[0].name, "乙");
  assert.equal(removeGuest(c, 99), c);
  assert.equal(removeGuest(c, -1), c);
});

test("visibleGuests masks phone and passes through name", () => {
  const c = claim({
    id: "c1",
    guests: [{ name: "甲", phone: "13800000001", at: 1 }],
  });
  const v = visibleGuests(c);
  assert.equal(v.length, 1);
  assert.equal(v[0].phoneMask, "138****0001");
  assert.equal(v[0].name, "甲");
  assert.equal(visibleGuests(claim({ id: "c2" })).length, 0);
});

test("maskPhone handles short/missing numbers", () => {
  assert.equal(maskPhone("13800000001"), "138****0001");
  assert.equal(maskPhone("12345"), "12345");
  assert.equal(maskPhone(undefined), "");
});