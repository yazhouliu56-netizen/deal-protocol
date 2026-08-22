/**
 * 隐私号中枢（ADR-0010，缺口 N1）。
 * 撮合双方不暴露真实号码：订单锁定后从号码池分配「双向虚拟号对」，
 * 48h 会话有效，订单完成/取消即销毁。同一 pair 幂等复用同一对号码。
 * 纯函数：时间与号码池全部注入，SSR/测试安全。
 */

export type PrivacySession = {
  waveId: string;
  aId: string;
  bId: string;
  aNumber: string;
  bNumber: string;
  allocatedAt: number;
  /** 会话过期（分配 + 48h）。 */
  expiresAt: number;
  /** 订单终局（完成/取消/争议结算）后销毁标记。 */
  revokedAt?: number;
};

/** 会话时长：48h（P5 文档约定；当前 DialCard 的 30min 为一次性线路，保留不动）。 */
export const PRIVACY_SESSION_MS = 48 * 3600_000;

export type NumberPool = string[];

export const DEMO_POOL: NumberPool = [
  "138-0000-0001",
  "138-0000-0002",
  "138-0000-0003",
  "138-0000-0004",
  "138-0000-0005",
  "138-0000-0006",
  "138-0000-0007",
  "138-0000-0008",
  "138-0000-0009",
  "138-0000-0010",
];

/** 掩码：138****0001（隐私号对外展示，隐藏中间四位）。 */
export function maskNumber(n: string): string {
  const digits = n.replace(/\D/g, "");
  if (digits.length <= 6) return n;
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

/** 幂等分配：同一 wave+pair 复用已存在会话；否则从池中取两个号。 */
export function allocatePair(
  sessions: PrivacySession[],
  pool: NumberPool,
  waveId: string,
  aId: string,
  bId: string,
  now: number
): { sessions: PrivacySession[]; session: PrivacySession; fresh: boolean } {
  const existing = sessions.find(
    (s) => s.waveId === waveId && !s.revokedAt && s.expiresAt > now
  );
  if (existing) return { sessions, session: existing, fresh: false };

  const used = new Set(sessions.filter((s) => !s.revokedAt).flatMap((s) => [s.aNumber, s.bNumber]));
  const avail = pool.filter((n) => !used.has(n));
  // 池耗尽兜底：续 11 位占位号（格式与池一致，掩码契约仍成立）
  const fallback = (n: number) => `138-9000-${String(n).padStart(4, "0")}`;
  const aNumber = avail[0] ?? fallback(9000 + sessions.length);
  const bNumber = avail[1] ?? fallback(9000 + sessions.length + 1);
  const session: PrivacySession = {
    waveId,
    aId,
    bId,
    aNumber,
    bNumber,
    allocatedAt: now,
    expiresAt: now + PRIVACY_SESSION_MS,
  };
  return { sessions: [...sessions, session], session, fresh: true };
}

/** 查询某会话（waveId + 参与方之一）。 */
export function findSession(
  sessions: PrivacySession[],
  waveId: string,
  whoId: string,
  now: number
): { session: PrivacySession; live: boolean } | null {
  const s = sessions.find(
    (x) => x.waveId === waveId && (x.aId === whoId || x.bId === whoId) && !x.revokedAt
  );
  if (!s) return null;
  return { session: s, live: s.expiresAt > now };
}

/** 对方视角的拨入号码（a 打给 b 用 bNumber；b 打给 a 用 aNumber）。 */
export function dialInNumber(session: PrivacySession, whoId: string): string {
  return session.aId === whoId ? session.bNumber : session.aNumber;
}

/** 销毁：订单终局（完成/取消/争议结算）后回收会话。 */
export function revokeSession(
  sessions: PrivacySession[],
  waveId: string,
  now: number
): PrivacySession[] {
  return sessions.map((s) => (s.waveId === waveId && !s.revokedAt ? { ...s, revokedAt: now } : s));
}

/** 会话剩余分钟（过期 → 0）。 */
export function minutesLeft(session: PrivacySession, now: number): number {
  return Math.max(0, Math.ceil((session.expiresAt - now) / 60_000));
}