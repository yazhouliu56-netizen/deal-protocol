/**
 * 预约单纯核（R-0928-12 · B 预约三增量之一定态与撞单判定）。
 * Pure + unit-testable（nowMs 入参，零 DB/UI/时间源依赖）。
 *
 * - 建单带未来时段 → BOOKED，否则 OPEN（既有行为零变化）；
 * - 撞单 = 同一服务者已有有效单时段重叠（供给方重复占时段，判供给方担责；
 *   防 ＞ 断：第二个单接不进来）。
 */
import { DEMAND_STATUSES } from "./state";

export interface ParsedBooking {
  status: typeof DEMAND_STATUSES.OPEN | typeof DEMAND_STATUSES.BOOKED;
  timeslotStart: string | null;
  timeslotEnd: string | null;
}

export interface BookingParseFailure {
  ok: false;
  error: string;
}

export type BookingParseResult = ({ ok: true } & ParsedBooking) | BookingParseFailure;

/** 接单撞单保护覆盖的在途四态＋预约态（终局/取消不占时段）。 */
export const BOOKED_ACTIVE_STATUSES = [
  DEMAND_STATUSES.BOOKED,
  DEMAND_STATUSES.ASSIGNED,
  DEMAND_STATUSES.DEPARTED,
  DEMAND_STATUSES.ARRIVED,
  DEMAND_STATUSES.STARTED,
] as const;

function toMs(v: unknown): number | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * 建单时段解析：双缺席 → OPEN（既有）；单边缺席/非法/倒挂/已过去 → 400 级错误；
 * 开始在未来 → BOOKED，否则 OPEN（已开始的时段按即时单走）。
 */
export function parseBookingFields(
  body: Record<string, unknown>,
  nowMs: number,
): BookingParseResult {
  const rawStart = body.timeslotStart;
  const rawEnd = body.timeslotEnd;
  const absentStart = rawStart == null || (typeof rawStart === "string" && rawStart.trim() === "");
  const absentEnd = rawEnd == null || (typeof rawEnd === "string" && rawEnd.trim() === "");
  if (absentStart && absentEnd) {
    return { ok: true, status: DEMAND_STATUSES.OPEN, timeslotStart: null, timeslotEnd: null };
  }
  if (absentStart || absentEnd) {
    return { ok: false, error: "预约时段需同时给出开始与结束" };
  }
  const startMs = toMs(rawStart);
  const endMs = toMs(rawEnd);
  if (startMs == null || endMs == null) {
    return { ok: false, error: "预约时段格式非法（需 ISO 时间）" };
  }
  if (startMs >= endMs) {
    return { ok: false, error: "预约开始须早于结束" };
  }
  if (endMs <= nowMs) {
    return { ok: false, error: "预约时段已过去" };
  }
  const startISO = new Date(startMs).toISOString();
  const endISO = new Date(endMs).toISOString();
  if (startMs > nowMs) {
    return { ok: true, status: DEMAND_STATUSES.BOOKED, timeslotStart: startISO, timeslotEnd: endISO };
  }
  return { ok: true, status: DEMAND_STATUSES.OPEN, timeslotStart: startISO, timeslotEnd: endISO };
}

/** 半开区间重叠：a.start < b.end && b.start < a.end（端点相接不算撞）。 */
export function slotsOverlap(aStartMs: number, aEndMs: number, bStartMs: number, bEndMs: number): boolean {
  if (![aStartMs, aEndMs, bStartMs, bEndMs].every(Number.isFinite)) return false;
  if (aStartMs >= aEndMs || bStartMs >= bEndMs) return false;
  return aStartMs < bEndMs && bStartMs < aEndMs;
}

/**
 * BOOKED 到期有效态（R-0928-12 惰性转语义）：预约开始时间已到即视为 OPEN。
 * 写回由 cron 兜底（guard-booking 每日扫）；热路径读此函数，不等 cron。
 */
export function effectiveDemandStatus(
  status: string,
  timeslotStart: string | null,
  nowMs: number,
): string {
  if (status !== DEMAND_STATUSES.BOOKED) return status;
  const startMs = timeslotStart ? Date.parse(timeslotStart) : NaN;
  if (!Number.isFinite(startMs)) return status;
  return startMs <= nowMs ? DEMAND_STATUSES.OPEN : status;
}

/** 新时段是否撞上已有任一时段（任一端缺失即不判，fail-open 由调用方 409 门执行）。 */
export function hasSlotConflict(
  existing: { timeslot_start: string | null; timeslot_end: string | null }[],
  slot: { timeslot_start: string | null; timeslot_end: string | null },
): boolean {
  const s = slot.timeslot_start ? Date.parse(slot.timeslot_start) : NaN;
  const e = slot.timeslot_end ? Date.parse(slot.timeslot_end) : NaN;
  if (!Number.isFinite(s) || !Number.isFinite(e)) return false;
  return existing.some((r) => {
    const rs = r.timeslot_start ? Date.parse(r.timeslot_start) : NaN;
    const re = r.timeslot_end ? Date.parse(r.timeslot_end) : NaN;
    return slotsOverlap(s, e, rs, re);
  });
}
