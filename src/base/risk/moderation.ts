/**
 * 平台治理 — moderation & trust & safety for the platform.
 *
 * Industry patterns (Airbnb / CometChat / Softbiz):
 *   - Automation handles volume, humans make judgment: sensitive keywords
 *     auto-flag content before it reaches the feed (auto-report), moderators
 *     decide on the queue.
 *   - Progressive penalties, friction before punishment: warn → suspend →
 *     ban, instead of instant bans. Every decision is an audited record.
 *   - Reports are idempotent per (reporter, target) while still open.
 *
 * Pure + unit-testable; no runtime imports.
 */

export type ReportTargetType = "wave" | "review" | "responder";

export type ReportReason = "spam" | "harassment" | "fraud" | "sensitive" | "other";

export type ModerationAction = "dismiss" | "warn" | "remove" | "suspend" | "ban";

export interface Report {
  id: string;
  targetId: string;
  targetType: ReportTargetType;
  reporterId: string;
  reason: ReportReason;
  detail: string;
  at: number;
  /** Set when the sensitive-word filter generated this report. */
  auto?: boolean;
  status: "open" | "resolved";
  action?: ModerationAction;
  verdictNote?: string;
  resolvedBy?: string;
  resolvedAt?: number;
}

export interface BanRecord {
  /** "suspend" expires; "ban" is permanent. */
  action: "suspend" | "ban";
  since: number;
  until?: number;
  note: string;
}

export const SUSPEND_MS = 24 * 60 * 60 * 1000;

/** 渐进式处罚文案（展示用，勿改业务规则）。 */
export const ACTION_LABEL: Record<ModerationAction, string> = {
  dismiss: "驳回",
  warn: "警告",
  remove: "下架",
  suspend: "限流 24h",
  ban: "封禁",
};

// --- 重复举报自动升级（对标 Care 持续监督 / Thumbtack dispute） ---

/** Effective (non-dismissed) outcomes count toward escalation. */
const EFFECTIVE_ACTIONS: ModerationAction[] = [
  "warn",
  "remove",
  "suspend",
  "ban",
];

/**
 * Progressive auto-escalation: count effective verdicts on this target →
 * ≥2 = suspend 24h, ≥3 = permanent ban (skipped when a stronger penalty is
 * already in force). Returns the penalty to apply, or null.
 */
export function escalatePenalty(
  reports: Report[],
  targetId: string,
  bans: Record<string, BanRecord>
): "suspend" | "ban" | null {
  const effective = reports.filter(
    (r) =>
      r.targetId === targetId &&
      r.status === "resolved" &&
      r.action &&
      EFFECTIVE_ACTIONS.includes(r.action)
  ).length;
  if (effective < 2) return null;
  const existing = bans[targetId];
  if (existing?.action === "ban") return null;
  // 已有 suspend（且未过期）则不重复叠加 —— 只升不降
  if (existing?.action === "suspend" && effective < 3) return null;
  return effective >= 3 ? "ban" : "suspend";
}

/**
 * 敏感词库 — face-to-face service platform high-risk vocabulary:
 * escort/sexual services, minors, weapons/drugs, off-platform payment scams.
 * Each entry is a regex; matched text is returned as the flag reason.
 */
export const SENSITIVE_PATTERNS: Array<{ re: RegExp; tag: string }> = [
  { re: /上门服务|特殊服务|按摩全套|一夜情|约炮|包养/i, tag: "涉黄服务" },
  { re: /未成年|学生妹|幼师|高中妹/i, tag: "未成年人" },
  { re: /枪支|弹药|毒品|冰毒|气枪/i, tag: "违禁品" },
  { re: /私下转账|先转[钱款]|红包先|绕开平台|不走平台/i, tag: "诱导站外交易" },
  { re: /人肉|开盒|曝光隐私/i, tag: "人肉搜索" },
];

/** Keyword filter: returns the first matched tag, or null when clean. */
export function autoFlag(text: string): string | null {
  for (const p of SENSITIVE_PATTERNS) {
    if (p.re.test(text)) return p.tag;
  }
  return null;
}

/** Create a report; rejects duplicates (same reporter+target, still open). */
export function submitReport(
  reports: Report[],
  input: Omit<Report, "id" | "at" | "status" | "auto"> & { auto?: boolean },
  now = Date.now()
): { report?: Report; error?: string } {
  const dup = reports.some(
    (r) =>
      r.status === "open" &&
      r.reporterId === input.reporterId &&
      r.targetId === input.targetId &&
      r.targetType === input.targetType
  );
  if (dup) return { error: "report.duplicate" };
  return {
    report: {
      ...input,
      id: `rep-${input.targetType}-${input.targetId}-${input.reporterId}`,
      at: now,
      status: "open",
    },
  };
}

/**
 * Moderator verdict — audited, progressive. `remove` unlists a wave/review,
 * `suspend`/`ban` block the account (see isBanned). Dismissing an auto-flagged
 * report restores the removed target via the returned action.
 */
export function resolveReport(
  report: Report,
  action: ModerationAction,
  note: string,
  moderatorId: string,
  now = Date.now()
): Report {
  if (report.status === "resolved") {
    throw new Error("report.already-resolved");
  }
  return {
    ...report,
    status: "resolved",
    action,
    verdictNote: note.trim().slice(0, 120) || undefined,
    resolvedBy: moderatorId,
    resolvedAt: now,
  };
}

/** Banned while a ban is permanent or a suspend hasn't expired. */
export function isBanned(
  bans: Record<string, BanRecord>,
  id: string,
  now = Date.now()
): boolean {
  const b = bans[id];
  if (!b) return false;
  if (b.action === "ban") return true;
  return !b.until || b.until > now;
}

/** Apply a penalty to the ban table (warn/remove don't ban). */
export function applyPenalty(
  bans: Record<string, BanRecord>,
  id: string,
  action: Exclude<ModerationAction, "dismiss" | "warn" | "remove">,
  note: string,
  now = Date.now()
): Record<string, BanRecord> {
  if (action === "suspend") {
    return {
      ...bans,
      [id]: { action, since: now, until: now + SUSPEND_MS, note },
    };
  }
  return { ...bans, [id]: { action: "ban", since: now, note } };
}

/** Remove a ban (after a dismissed appeal). */
export function clearBan(
  bans: Record<string, BanRecord>,
  id: string
): Record<string, BanRecord> {
  const next = { ...bans };
  delete next[id];
  return next;
}

export interface GovernanceMetrics {
  totalWaves: number;
  claimed: number;
  fulfilled: number;
  breached: number;
  openReports: number;
  autoReports: number;
  dealRate: number;
}

/** Platform health dashboard numbers (pure, testable). */
export function governanceMetrics(
  waves: Array<{ status: string }>,
  claims: Array<{ status: string; fulfilledAt?: number }>,
  reports: Report[]
): GovernanceMetrics {
  const totalWaves = waves.length;
  const claimed = waves.filter((w) => w.status === "claimed").length;
  const fulfilled = claims.filter((c) => c.fulfilledAt).length;
  const breached = claims.filter((c) => c.status === "breached").length;
  const openReports = reports.filter((r) => r.status === "open").length;
  const autoReports = reports.filter((r) => r.auto).length;
  return {
    totalWaves,
    claimed,
    fulfilled,
    breached,
    openReports,
    autoReports,
    dealRate: totalWaves === 0 ? 0 : Math.round((fulfilled / totalWaves) * 100),
  };
}
