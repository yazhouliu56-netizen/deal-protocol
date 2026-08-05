import { test } from "node:test";
import assert from "node:assert/strict";
import {
  breachClaim,
  claimDirect,
  closeWave,
  counterOffer,
  createWave,
  isWaveExpired,
  lockNegotiation,
  nextSpeaker,
  openNegotiation,
  withdrawClaim,
  MAX_ROUNDS,
  type Wave,
} from "./wave.ts";

const now = 1_700_000_000_000;

function baseWave(overrides?: Partial<Parameters<typeof createWave>[0]>): Wave {
  return createWave({
    id: "w1",
    authorId: "me",
    basics: {
      category: "厨师 · 上门做饭",
      time: "明天 11:00",
      area: "幸福家园小区",
      radiusKm: 5,
    },
    budget: 100,
    customs: [{ text: "30 岁左右女性", tags: ["女性"] }],
    expiresAt: now + 3600_000,
    createdAt: now,
    ...overrides,
  });
}

test("createWave validates basic essentials and budget", () => {
  assert.throws(() =>
    createWave({
      id: "x",
      authorId: "me",
      basics: { category: "  ", time: "11:00", area: "幸福家园", radiusKm: 3 },
      budget: 100,
      expiresAt: now + 1000,
      createdAt: now,
    })
  );
  assert.throws(() => baseWave({ budget: 0 }));
});

test("claimDirect locks the wave to the first responder (甲)", () => {
  const wave = baseWave();
  const { wave: locked, claim } = claimDirect(wave, "r1", "c1", 120, now);
  assert.equal(locked.status, "claimed");
  assert.equal(locked.claimedById, "r1");
  assert.equal(claim.status, "accepted");
  assert.equal(claim.rounds, 0);
});

test("claimDirect refuses when wave is not active", () => {
  const wave = closeWave(baseWave());
  assert.throws(() => claimDirect(wave, "r1", "c1", 120, now));
});

test("openNegotiation requires a negotiable wave", () => {
  assert.throws(() => openNegotiation(baseWave(), "r1", "c1", 120, now));
  const wave = baseWave({ negotiable: true });
  const claim = openNegotiation(wave, "r1", "c1", 120, now);
  assert.equal(claim.status, "negotiating");
  assert.equal(claim.rounds, 1);
});

test("counterOffer allows exactly MAX_ROUNDS rounds per pair (丙)", () => {
  let claim = openNegotiation(baseWave({ negotiable: true }), "r1", "c1", 100, now);
  // rounds 1 already used by the open; push to the limit
  for (let i = 2; i <= MAX_ROUNDS; i++) {
    claim = counterOffer(claim, 100 + i * 10, `round ${i}`);
  }
  assert.equal(claim.rounds, MAX_ROUNDS);
  assert.throws(() => counterOffer(claim, 999, "too far"), /rounds-exhausted/);
});

test("lockNegotiation: demander acceptance claims the wave", () => {
  const wave = baseWave({ negotiable: true });
  const claim = openNegotiation(wave, "r1", "c1", 100, now);
  const out = lockNegotiation(wave, claim, true);
  assert.equal(out.wave?.status, "claimed");
  assert.equal(out.wave?.claimedById, "r1");
  const declined = lockNegotiation(wave, claim, false);
  assert.equal(declined.error, "demander-declined");
});

test("withdraw / breach move the claim out of the funnel", () => {
  const wave = baseWave({ negotiable: true });
  let claim = openNegotiation(wave, "r1", "c1", 100, now);
  claim = withdrawClaim(claim);
  assert.equal(claim.status, "withdrawn");
  claim = breachClaim(claim);
  assert.equal(claim.status, "breached");
});

test("isWaveExpired compares against expiresAt", () => {
  const wave = baseWave({ expiresAt: now + 1000 });
  assert.equal(isWaveExpired(wave, now + 2000), true);
  assert.equal(isWaveExpired(wave, now), false);
});

test("counterOffer enforces alternation (lastBy / same-side throws)", () => {
  const wave = baseWave({ negotiable: true });
  let claim = openNegotiation(wave, "r1", "c1", 100, now);
  assert.equal(claim.lastBy, "responder");
  assert.equal(nextSpeaker(claim), "demander");

  // demander counters → lastBy flips to demander
  claim = counterOffer(claim, 90, "太贵了", "demander");
  assert.equal(claim.lastBy, "demander");
  assert.equal(nextSpeaker(claim), "responder");

  // default actor = the other side → alternation holds automatically
  claim = counterOffer(claim, 95, "最低 95");
  assert.equal(claim.lastBy, "responder");

  // responder double-move → same-side rejected (checked before budget)
  assert.throws(
    () => counterOffer(claim, 88, "再少点", "responder"),
    /claim\.same-side/
  );
  // legal side but budget exhausted (3 rounds used) → locked
  assert.throws(
    () => counterOffer(claim, 85, "还不行吗", "demander"),
    /claim\.rounds-exhausted/
  );
});