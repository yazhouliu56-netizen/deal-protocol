import { test } from "node:test";
import assert from "node:assert/strict";
import type { Claim, Wave } from "./wave.ts";
import { attendanceLedger, attendanceFor } from "./attendance.ts";

function claim(p: Partial<Claim> & { id: string; responderId: string }): Claim {
  return {
    waveId: "w1",
    status: "accepted",
    rounds: 0,
    createdAt: 1000,
    ...p,
  } as Claim;
}

function wave(p: Partial<Wave> & { id: string }): Wave {
  return { status: "active", createdAt: 0, authorId: "me", ...p } as Wave;
}

test("aggregates joined/shown/noShow/withdrawn across waves", () => {
  const claims: Claim[] = [
    claim({ id: "c1", responderId: "u1", status: "accepted", serviceDoneAt: 2000 }),
    claim({ id: "c2", responderId: "u1", status: "breached" }),
    claim({ id: "c3", responderId: "u1", status: "withdrawn" }),
    claim({ id: "c4", responderId: "u2", status: "accepted", serviceDoneAt: 3000 }),
  ];
  const led = attendanceLedger(claims, [], ["u1", "u2"]);
  assert.deepEqual(
    {
      joinedWaves: led.u1!.joinedWaves,
      shown: led.u1!.shown,
      noShows: led.u1!.noShows,
      withdrawn: led.u1!.withdrawn,
      waitlisted: led.u1!.waitlisted,
    },
    { joinedWaves: 3, shown: 1, noShows: 1, withdrawn: 1, waitlisted: 0 }
  );
  assert.ok(Math.abs(led.u1!.showRate - 1 / 3) < 1e-9);
  assert.equal(led.u2!.showRate, 1);
});

test("counts active waitlist seats as waitlisted", () => {
  const w = wave({
    id: "w9",
    status: "assembled",
    waitlist: [
      { responderId: "u9", at: 100 },
      { responderId: "u8", at: 200 },
    ],
  });
  const led = attendanceLedger([], [w], ["u9", "u8", "u7"]);
  assert.equal(led.u9!.waitlisted, 1);
  assert.equal(led.u8!.waitlisted, 1);
  assert.equal(led.u7, undefined);
});

test("no participation record → filtered out of the ledger", () => {
  const led = attendanceLedger([], [], ["ghost"]);
  assert.equal(led.ghost, undefined);
});

test("attendanceFor returns single responder entry", () => {
  const claims = [claim({ id: "c1", responderId: "u1", status: "accepted", serviceDoneAt: 1 })];
  assert.equal(attendanceFor(claims, [], "u1")?.shown, 1);
  assert.equal(attendanceFor(claims, [], "nobody"), undefined);
});

test("lastAt = most recent claim creation time", () => {
  const claims = [
    claim({ id: "c1", responderId: "u1", createdAt: 500 }),
    claim({ id: "c2", responderId: "u1", createdAt: 9000 }),
  ];
  assert.equal(attendanceFor(claims, [], "u1")?.lastAt, 9000);
});
