import { test } from "node:test";
import assert from "node:assert/strict";
import {
  executeCryptoShredding,
  evaluateMediaRetention,
  MEDIA_RETENTION_DEFAULT,
  type CompletionMedia,
  type FinancialLedgerRow,
  type PiiProfile,
  type ShreddingContext,
} from "./privacy-erasure.ts";
import { sha256Hex } from "../ai/forgery.ts";

const DAY = 86_400_000;

function ctx(profile: PiiProfile, ledger: FinancialLedgerRow[] = [], userId = "u-abc-123"): ShreddingContext {
  return {
    userId,
    profile,
    ledger,
    requestedAt: 1_700_000_000_000,
    executor: "user:self-delete",
  };
}

const ledgerRow = (over: Partial<FinancialLedgerRow> = {}): FinancialLedgerRow => ({
  order_no: "ORD-2026-0001",
  amount_cents: 12_345,
  split_plan_json: '{"platform_fee":1852,"provider_income":10493}',
  paid_at: 1_690_000_000_000,
  settlement_status: "SETTLED",
  ...over,
});

test("密态销毁：PII 五类字段 100% 不可逆覆写", () => {
  const { profile } = executeCryptoShredding(
    ctx({
      id: "u-abc-123",
      name: "张三丰",
      phone: "13812345678",
      idNumber: "110101199003074512",
      address: "浙江省杭州市西湖区文三路 100 号",
      email: "zhangsan@example.com",
      lat: 30.2741,
      lng: 120.1551,
    })
  );
  assert.ok(profile.name?.startsWith("ANON_USER_"));
  assert.equal(profile.phone, "138****5678");
  assert.equal(profile.idNumber, "***");
  assert.equal(profile.address, "***");
  assert.equal(profile.email, "z***@example.com");
  assert.equal(profile.lat, null);
  assert.equal(profile.lng, null);
  // 原值不可还原
  const serialized = JSON.stringify(profile);
  assert.ok(!serialized.includes("张三丰"));
  assert.ok(!serialized.includes("110101"));
  assert.ok(!serialized.includes("文三路"));
});

test("密态销毁：财务分账流水依法保留不丢失（条数与金额守恒）", () => {
  const ledger = [
    ledgerRow({ order_no: "ORD-001", amount_cents: 10_000 }),
    ledgerRow({ order_no: "ORD-002", amount_cents: 23_456, settlement_status: "DISPUTED" }),
  ];
  const { certificate, ledger: retained } = executeCryptoShredding(
    ctx({ id: "u-abc-123", name: "王五", phone: "13900001111" }, ledger)
  );
  assert.deepEqual(retained, ledger);
  assert.equal(certificate.retainedLedgerCount, 2);
  assert.equal(certificate.retainedLedgerAmountCents, 33_456);
  // 不可变快照字段原样保留
  const first = retained[0];
  assert.equal(first.order_no, "ORD-001");
  assert.equal(first.amount_cents, 10_000);
  assert.ok(first.split_plan_json.includes("platform_fee"));
  assert.ok(typeof first.paid_at === "number");
});

test("密态销毁：未提供的 PII 字段不产生覆写记录（空入参安全）", () => {
  const { certificate, profile } = executeCryptoShredding(
    ctx({ id: "u-abc-123", bio: "我很安全" }, [ledgerRow()])
  );
  assert.deepEqual(certificate.piiFieldsShredded, []);
  // 非 PII 字段原样保留
  assert.equal(profile.bio, "我很安全");
  assert.equal(certificate.retainedLedgerCount, 1);
});

test("密态销毁：证书 SHA-256 摘要确定性（同输入同摘要 + 64 位 hex）", () => {
  const input = ctx(
    { id: "u-abc-123", name: "李四", phone: "13712345678" },
    [ledgerRow()]
  );
  const a = executeCryptoShredding(input);
  const b = executeCryptoShredding(input);
  assert.equal(a.certificate.digestSha256, b.certificate.digestSha256);
  assert.match(a.certificate.digestSha256, /^[0-9a-f]{64}$/);
  // 摘要确实覆盖保留流水（篡改流水 → 摘要必变）
  const tampered = executeCryptoShredding(
    ctx({ id: "u-abc-123", name: "李四", phone: "13712345678" }, [ledgerRow({ amount_cents: 1 })])
  );
  assert.notEqual(tampered.certificate.digestSha256, a.certificate.digestSha256);
});

test("密态销毁：执行人签名指纹 + 证书号确定性/幂等", () => {
  const input = ctx({ id: "u-abc-123", name: "赵六", phone: "13612345678" }, [ledgerRow()]);
  const a = executeCryptoShredding(input);
  const b = executeCryptoShredding(input);
  assert.equal(a.certificate.certificateId, b.certificate.certificateId);
  assert.equal(a.certificate.signature, b.certificate.signature);
  assert.ok(a.certificate.signature.startsWith("user:self-delete:"));
  assert.match(a.certificate.signature, /^user:self-delete:[0-9a-f]{8}$/);
  assert.equal(a.certificate.shreddedAt, input.requestedAt);
  assert.equal(a.certificate.executor, "user:self-delete");
  // 不同用户 → 不同签名/证书号
  const other = executeCryptoShredding(
    ctx({ id: "u-other-999", name: "赵六", phone: "13612345678" }, [ledgerRow()], "u-other-999")
  );
  assert.notEqual(a.certificate.certificateId, other.certificate.certificateId);
  assert.notEqual(a.certificate.signature, other.certificate.signature);
  // 匿名名派生自 user hash：同用户同产出
  assert.equal(a.profile.name, `ANON_USER_${sha256Hex("u-abc-123").slice(0, 12)}`);
});

test("媒体清理：90 天/180 天策略分流（边界精确）", () => {
  const now = 1_700_000_000_000;
  const media: CompletionMedia[] = [
    { mediaKey: "oss/normal-old", orderNo: "ORD-001", completedAt: now - 91 * DAY, disputed: false, sizeBytes: 1024 },
    { mediaKey: "oss/normal-edge", orderNo: "ORD-002", completedAt: now - 90 * DAY, disputed: false, sizeBytes: 2048 },
    { mediaKey: "oss/normal-new", orderNo: "ORD-003", completedAt: now - 89 * DAY, disputed: false, sizeBytes: 4096 },
    { mediaKey: "oss/dispute-181d", orderNo: "ORD-004", completedAt: now - 181 * DAY, disputed: true, sizeBytes: 512 },
    { mediaKey: "oss/dispute-180d", orderNo: "ORD-005", completedAt: now - 180 * DAY, disputed: true, sizeBytes: 64 },
    { mediaKey: "oss/dispute-90d", orderNo: "ORD-006", completedAt: now - 90 * DAY, disputed: true, sizeBytes: 128 },
  ];
  const r = evaluateMediaRetention(media, now, MEDIA_RETENTION_DEFAULT);
  // 按完工时间排序后逐出：181d/180d 争议已到期、91d/90d 正常已到期（90d 边界恰达即删）
  assert.deepEqual(r.toPurge, ["oss/dispute-181d", "oss/dispute-180d", "oss/normal-old", "oss/normal-edge"]);
  assert.equal(r.purgedCount, 4);
  assert.equal(r.purgedBytes, 1024 + 2048 + 512 + 64);
  const keys = r.toRetain.map((e) => e.mediaKey);
  assert.ok(keys.includes("oss/normal-new"));
  assert.ok(keys.includes("oss/dispute-90d"));
  const disputeEntry = r.toRetain.find((e) => e.mediaKey === "oss/dispute-90d");
  assert.equal(disputeEntry?.reason, "DISPUTE_RETENTION");
  assert.equal(disputeEntry?.expiresAt, now + 90 * DAY);
  assert.equal(r.retainedCount, 2);
});

test("媒体清理：完工时间在未来 → 必然保留（确定性）", () => {
  const now = 1_700_000_000_000;
  const media: CompletionMedia[] = [
    { mediaKey: "oss/future", orderNo: "ORD-1", completedAt: now + DAY, disputed: false, sizeBytes: 10 },
    { mediaKey: "oss/empty-ok", orderNo: "ORD-2", completedAt: now - 999 * DAY, disputed: false, sizeBytes: 20 },
  ];
  const r = evaluateMediaRetention(media, now, MEDIA_RETENTION_DEFAULT);
  assert.deepEqual(r.toPurge, ["oss/empty-ok"]);
  assert.equal(r.toRetain[0].mediaKey, "oss/future");
});

test("媒体清理：空清单 → 全空输出（边界安全）", () => {
  const r = evaluateMediaRetention([], 1_700_000_000_000, MEDIA_RETENTION_DEFAULT);
  assert.deepEqual(r.toPurge, []);
  assert.deepEqual(r.toRetain, []);
  assert.equal(r.purgedBytes, 0);
});