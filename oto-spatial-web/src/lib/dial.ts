/**
 * 拨号·虚拟号码 (simulated) — a deterministic one-time line derived from
 * the wave id, so BOTH sides of a deal see the SAME number without storing
 * it. Number lives only for DIAL_TTL_MS after the claim locks; after that
 * the line "expires" (P5 swaps in real virtual numbers server-side).
 *
 * Pure + unit-testable; no runtime imports.
 */

export const DIAL_TTL_MS = 30 * 60_000;

/** FNV-1a hash of a string → uint32 (deterministic across tabs/relaunches). */
export function fnv1a(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * One-time virtual landline for a deal, e.g. "0571-2483-7912".
 * Same seed (waveId + responderId + demanderId) → same number for both.
 */
export function makeDialCode(seed: string): string {
  const h = fnv1a(seed);
  const mid = ((h >>> 8) % 1000).toString().padStart(3, "0");
  const tail = ((h >>> 16) % 10000).toString().padStart(4, "0");
  return `0571-2${mid}-${tail}`;
}

/** The line expires DIAL_TTL_MS after the claim was locked. */
export function dialExpiresAt(lockedAt: number): number {
  return lockedAt + DIAL_TTL_MS;
}

export function isDialLive(lockedAt: number, now: number): boolean {
  return now < dialExpiresAt(lockedAt);
}
