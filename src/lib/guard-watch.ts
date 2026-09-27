/**
 * 强制守护 Watchdog 服务端装配（ADR-0022）：成员校验 + 坐标截断 + 双边最新评估。
 * 纯评估走 base/safe/signal-watchdog；本文件只做 IO 形状转换（svc client 由调用方注入，
 * 与 gang-rules 同惯例，便于考卷注入 mock）。
 */
import {
  evaluateGuardSignal,
  type GuardSignalState,
} from "@/base/safe/signal-watchdog";

export interface GuardBreadcrumbRow {
  reporter_id: string;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  battery_low: boolean;
  gps_enabled: boolean | null;
  checkin: boolean;
  created_at: string;
}

export interface GuardSideView {
  state: GuardSignalState;
  reasons: string[];
  /** 服务端裁决时刻（ms）。 */
  at: number;
  /** 对方/自己末次上报时刻（ms）。 */
  lastSeenMs: number;
  batteryLow: boolean;
  checkin: boolean;
  lat: number | null;
  lng: number | null;
}

interface DemandPartyRow {
  demander_id?: string | null;
  matched_provider_id?: string | null;
}

/** 服务端权威截断至 4 位小数（~11m，ADR-0022 #8）；非法返回 null。 */
export function truncateCoord(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.round(v * 10_000) / 10_000;
}

export function isValidCoord(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

type SupabaseLike = {
  from: (table: string) => unknown;
};

/** 履约双方成员校验（需求方或已匹配服务者），返回 demand 行或 null。 */
export async function checkGuardMembership(
  db: SupabaseLike,
  demandId: string,
  userId: string,
): Promise<{ ok: boolean; demand: DemandPartyRow | null }> {
  try {
    const chain = db.from("demands") as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          single: () => Promise<{ data: DemandPartyRow | null; error: unknown }>;
        };
      };
    };
    const { data, error } = await chain
      .select("id, demander_id, matched_provider_id")
      .eq("id", demandId)
      .single();
    if (error || !data) return { ok: false, demand: null };
    const ok = data.demander_id === userId || data.matched_provider_id === userId;
    return { ok, demand: ok ? data : null };
  } catch {
    return { ok: false, demand: null };
  }
}

/** 取该 demand 最近面包屑（按 reporter 去重，时间倒序，最多 3 行）。 */
export async function latestRows(
  svc: SupabaseLike,
  demandId: string,
): Promise<GuardBreadcrumbRow[]> {
  try {
    const chain = svc.from("guard_breadcrumbs") as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          order: (col: string, opts: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: GuardBreadcrumbRow[] | null; error: unknown }>;
          };
        };
      };
    };
    const { data, error } = await chain
      .select("reporter_id, lat, lng, accuracy_m, battery_low, gps_enabled, checkin, created_at")
      .eq("demand_id", demandId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !data) return [];
    const seen = new Set<string>();
    const rows: GuardBreadcrumbRow[] = [];
    for (const r of data) {
      if (!r || seen.has(r.reporter_id)) continue;
      seen.add(r.reporter_id);
      rows.push(r);
      if (rows.length >= 3) break;
    }
    return rows;
  } catch {
    return [];
  }
}

/** 单边评估：无行返回 null（UI 待启动态，不报 DEGRADED 惊扰）。 */
export function evaluateSide(
  row: GuardBreadcrumbRow | null,
  nowMs: number,
): GuardSideView | null {
  if (!row) return null;
  const lastSeenMs = Date.parse(row.created_at);
  if (!Number.isFinite(lastSeenMs)) return null;
  const report = evaluateGuardSignal({
    lastSeenMs,
    nowMs,
    gpsEnabled: row.gps_enabled,
    batteryLow: row.battery_low,
  });
  return {
    state: report.state,
    reasons: report.reasons,
    at: nowMs,
    lastSeenMs,
    batteryLow: row.battery_low,
    checkin: row.checkin,
    lat: row.lat,
    lng: row.lng,
  };
}
