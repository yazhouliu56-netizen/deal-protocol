import { describe, expect, it } from "vitest";

import {
  approveRelease,
  draftRelease,
  graduateShelfEntry,
  isReleased,
  saveToShelf,
  loadShelf,
  isTrialCategory,
} from "./factory-shelf";
import { housekeepingAmmo } from "@/ammo/housekeeping.ammo";
import { meetupAmmo } from "@/ammo/meetup.ammo";

describe("Loop B 双签（A5）", () => {
  it("R1 需双人签发，其余单人", () => {
    expect(draftRelease(housekeepingAmmo, "ops").requiredSigners).toBe(2);
    expect(draftRelease(meetupAmmo, "ops").requiredSigners).toBe(1);
  });

  it("起草人自签拒绝（起草签发分离）", () => {
    const t = draftRelease(meetupAmmo, "ops");
    const r = approveRelease(t, "ops");
    expect(r.released).toBe(false);
    expect(r.error).toMatch(/SELF_APPROVAL/);
  });

  it("R1 集齐两独立签发即 released；重复签幂等", () => {
    const t = draftRelease(housekeepingAmmo, "drafter");
    let r = approveRelease(t, "boss");
    expect(r.released).toBe(false);
    r = approveRelease(r.ticket, "boss");
    expect(r.ticket.approvals).toHaveLength(1);
    r = approveRelease(r.ticket, "auditor");
    expect(r.released).toBe(true);
    expect(isReleased(r.ticket)).toBe(true);
  });

  it("票据未集齐转正拒绝；集齐后摘 trial 标＋写审计", () => {
    const category = "test-dual-sign-cat";
    saveToShelf({
      ammoId: "test-dual-sign-v1",
      category,
      version: "1.0.0",
      supplyCluster: "C1_MOBILITY",
      pricingModel: { kind: "FIXED", amountYuan: 50 },
      fuzePolicy: housekeepingAmmo.fuzePolicy,
      forwardHooks: [],
    });
    expect(isTrialCategory(category)).toBe(true);

    const draft = draftRelease(
      { ammoId: "test-dual-sign-v1", category, supplyCluster: "C1_MOBILITY" },
      "drafter",
    );
    expect(graduateShelfEntry(category, draft).ok).toBe(false);
    const done = approveRelease(draft, "boss");
    expect(done.released).toBe(true);
    expect(graduateShelfEntry(category, done.ticket).ok).toBe(true);

    const entry = loadShelf().find((e) => e.config.category === category);
    expect(entry?.trial).toBe(false);
    expect(entry?.release?.approvedBy).toEqual(["boss"]);
  });
});
