import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyPenalty,
  autoFlag,
  clearBan,
  escalatePenalty,
  governanceMetrics,
  isBanned,
  resolveReport,
  submitReport,
  SUSPEND_MS,
  type BanRecord,
  type Report,
} from "./moderation.ts";

const base: Report = {
  id: "r1",
  targetId: "w1",
  targetType: "wave",
  reporterId: "u-1",
  reason: "spam",
  detail: "广告",
  at: 100,
  status: "open",
};

test("autoFlag hits the sensitive-word library", () => {
  assert.equal(autoFlag("先私下转账给你，绕开平台"), "诱导站外交易");
  assert.equal(autoFlag("提供上门服务 200"), "涉黄服务");
  assert.equal(autoFlag("未成年学生妹"), "未成年人");
  assert.equal(autoFlag("家宴做菜上门"), null, "正常内容不误伤");
  assert.equal(autoFlag(""), null);
});

test("submitReport is idempotent per open (reporter, target)", () => {
  const { report } = submitReport([], {
    targetId: "w1",
    targetType: "wave",
    reporterId: "u-1",
    reason: "spam",
    detail: "x",
  });
  assert.equal(report?.status, "open");
  const again = submitReport([report!], {
    targetId: "w1",
    targetType: "wave",
    reporterId: "u-1",
    reason: "spam",
    detail: "y",
  });
  assert.equal(again.error, "report.duplicate");
  // different reporter → allowed
  const other = submitReport([report!], {
    targetId: "w1",
    targetType: "wave",
    reporterId: "u-2",
    reason: "fraud",
    detail: "z",
  });
  assert.ok(other.report);
  // after resolution → allowed again
  const resolved = resolveReport(report!, "dismiss", "不成立", "admin-1");
  const retry = submitReport([resolved], {
    targetId: "w1",
    targetType: "wave",
    reporterId: "u-1",
    reason: "harassment",
    detail: "w",
  });
  assert.ok(retry.report, "已决举报可再次提交");
});

test("resolveReport is audited and one-shot", () => {
  const out = resolveReport(base, "remove", " 涉黄信息 ", "admin-1", 999);
  assert.equal(out.status, "resolved");
  assert.equal(out.action, "remove");
  assert.equal(out.verdictNote, "涉黄信息");
  assert.equal(out.resolvedBy, "admin-1");
  assert.equal(out.resolvedAt, 999);
  assert.throws(() => resolveReport(out, "ban", "", "admin-1"), /already-resolved/);
});

test("isBanned: ban permanent, suspend expires after 24h", () => {
  let bans: Record<string, BanRecord> = {};
  bans = applyPenalty(bans, "u-9", "ban", "多次诈骗", 1000);
  assert.equal(isBanned(bans, "u-9", 1e15), true, "永久封禁");
  bans = clearBan(bans, "u-9");
  bans = applyPenalty(bans, "u-8", "suspend", "警告后复发", 1000);
  assert.equal(isBanned(bans, "u-8", 1000 + SUSPEND_MS - 1), true, "限流期内");
  assert.equal(isBanned(bans, "u-8", 1000 + SUSPEND_MS + 1), false, "限流到期解除");
  assert.equal(isBanned({}, "ghost"), false);
});

test("governanceMetrics rolls up the dashboard numbers", () => {
  const waves = [{ status: "claimed" }, { status: "claimed" }, { status: "open" }];
  const claims = [
    { status: "accepted", fulfilledAt: 1 },
    { status: "accepted", fulfilledAt: 1 },
    { status: "breached" },
  ];
  const reports = [base, { ...base, id: "r2", auto: true }];
  const m = governanceMetrics(waves as never, claims as never, reports);
  assert.equal(m.totalWaves, 3);
  assert.equal(m.claimed, 2);
  assert.equal(m.fulfilled, 2);
  assert.equal(m.breached, 1);
  assert.equal(m.openReports, 2);
  assert.equal(m.autoReports, 1);
  assert.equal(m.dealRate, Math.round((2 / 3) * 100));
});

test("escalatePenalty: ≥2 effective verdicts → suspend, ≥3 → ban, never downgrades", () => {
  const rep = (action: string): Report => ({
    ...base,
    id: `r-${Math.random()}`,
    status: "resolved",
    action: action as Report["action"],
    targetId: "u-bad",
  });
  // 1 effective → nothing
  assert.equal(escalatePenalty([rep("warn")], "u-bad", {}), null);
  // 2 effective → suspend
  assert.equal(
    escalatePenalty([rep("warn"), rep("remove")], "u-bad", {}),
    "suspend"
  );
  // 3 effective → ban
  assert.equal(
    escalatePenalty([rep("warn"), rep("remove"), rep("suspend")], "u-bad", {}),
    "ban"
  );
  // dismisses don't count
  assert.equal(
    escalatePenalty([rep("warn"), rep("dismiss"), rep("dismiss")], "u-bad", {}),
    null
  );
  // already banned → stays banned (no-op)
  const banned: Record<string, BanRecord> = {
    "u-bad": { action: "ban", since: 1, note: "" },
  };
  assert.equal(escalatePenalty([rep("warn"), rep("remove")], "u-bad", banned), null);
  // existing suspend with <3 effective → no duplicate reset
  const suspended: Record<string, BanRecord> = {
    "u-bad": { action: "suspend", since: 1, until: 2, note: "" },
  };
  assert.equal(
    escalatePenalty([rep("warn"), rep("remove")], "u-bad", suspended),
    null
  );
});