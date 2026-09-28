import { describe, it, expect } from "vitest";
import { BOOKED_ACTIVE_STATUSES, effectiveDemandStatus, hasSlotConflict, parseBookingFields, slotsOverlap } from "./booking";
import { DEMAND_STATUSES } from "./state";

const NOW = 1_800_000_000_000;
const iso = (ms: number) => new Date(ms).toISOString();
const H = 3_600_000;

describe("parseBookingFields（R-0928-12）", () => {
  it("双缺席 → OPEN 既有行为", () => {
    expect(parseBookingFields({}, NOW)).toEqual({
      ok: true, status: DEMAND_STATUSES.OPEN, timeslotStart: null, timeslotEnd: null,
    });
  });

  it("未来时段 → BOOKED（ISO 归一化）", () => {
    const r = parseBookingFields(
      { timeslotStart: iso(NOW + H), timeslotEnd: iso(NOW + 2 * H) },
      NOW,
    );
    expect(r).toEqual({
      ok: true,
      status: DEMAND_STATUSES.BOOKED,
      timeslotStart: iso(NOW + H),
      timeslotEnd: iso(NOW + 2 * H),
    });
  });

  it("已开始未结束 → OPEN（按即时单走）", () => {
    const r = parseBookingFields(
      { timeslotStart: iso(NOW - H), timeslotEnd: iso(NOW + H) },
      NOW,
    );
    expect(r.ok && r.status).toBe(DEMAND_STATUSES.OPEN);
  });

  it("单边缺席/非法/倒挂/过去 → 400 级错误", () => {
    expect(parseBookingFields({ timeslotStart: iso(NOW + H) }, NOW).ok).toBe(false);
    expect(parseBookingFields({ timeslotStart: "not-a-time", timeslotEnd: iso(NOW + H) }, NOW).ok).toBe(false);
    expect(
      parseBookingFields({ timeslotStart: iso(NOW + 2 * H), timeslotEnd: iso(NOW + H) }, NOW).ok,
    ).toBe(false);
    expect(
      parseBookingFields({ timeslotStart: iso(NOW - 2 * H), timeslotEnd: iso(NOW - H) }, NOW).ok,
    ).toBe(false);
  });
});

describe("slotsOverlap / hasSlotConflict（撞单保护）", () => {
  it("重叠/包含/端点相接", () => {
    expect(slotsOverlap(0, 10, 5, 15)).toBe(true);
    expect(slotsOverlap(0, 20, 5, 15)).toBe(true);
    expect(slotsOverlap(0, 10, 10, 20)).toBe(false);
    expect(slotsOverlap(5, 5, 0, 10)).toBe(false);
    expect(slotsOverlap(NaN, 10, 0, 10)).toBe(false);
  });

  it("撞上任一已有即 true；缺失端 fail-open false", () => {
    const existing = [
      { timeslot_start: iso(NOW + H), timeslot_end: iso(NOW + 2 * H) },
      { timeslot_start: null, timeslot_end: null },
    ];
    expect(
      hasSlotConflict(existing, { timeslot_start: iso(NOW + 1.5 * H), timeslot_end: iso(NOW + 3 * H) }),
    ).toBe(true);
    expect(
      hasSlotConflict(existing, { timeslot_start: iso(NOW + 3 * H), timeslot_end: iso(NOW + 4 * H) }),
    ).toBe(false);
    expect(hasSlotConflict(existing, { timeslot_start: null, timeslot_end: null })).toBe(false);
  });

  it("在途集合含 BOOKED 四态", () => {
    expect([...BOOKED_ACTIVE_STATUSES]).toContain(DEMAND_STATUSES.BOOKED);
    expect([...BOOKED_ACTIVE_STATUSES]).toContain(DEMAND_STATUSES.STARTED);
  });
});

describe("effectiveDemandStatus（BOOKED 到期惰性转）", () => {
  it("未到期 BOOKED 保持；到期即 OPEN；非 BOOKED 原样", () => {
    expect(effectiveDemandStatus("BOOKED", iso(NOW + H), NOW)).toBe("BOOKED");
    expect(effectiveDemandStatus("BOOKED", iso(NOW - H), NOW)).toBe("OPEN");
    expect(effectiveDemandStatus("ASSIGNED", iso(NOW - H), NOW)).toBe("ASSIGNED");
    expect(effectiveDemandStatus("BOOKED", null, NOW)).toBe("BOOKED");
    expect(effectiveDemandStatus("BOOKED", "not-a-time", NOW)).toBe("BOOKED");
  });
});
