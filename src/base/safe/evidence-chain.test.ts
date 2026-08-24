/**
 * 批次 3b · 证据链权威 SSOT 考卷：
 * 字节级历史兼容哈希（m11 公式逐位对照 / undefined 键省略语义）→ 链校验三断因
 * （HASH_MISMATCH / PREV_LINK_BREAK / TIMESTAMP_REGRESSION，等时戳容忍）→
 * A 写 B 验交叉自洽 → 司法举证包装配器（脱敏掩码 / 轨迹过滤 / 断链检出）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "crypto";
import {
  buildJudicialPackage,
  computeEvidenceHash,
  sha256Hex,
  verifyEvidenceChain,
  type IEvidenceRow,
} from "./evidence-chain.ts";

const ORDER = "order-001";

/** 手工基准实现：与 m11 历史公式逐字节一致的独立参照（考卷自带第二把尺）。 */
function legacyHash(orderId: string | undefined, eventType: string, payload: unknown, prevHash: string, timestamp: string): string {
  return createHash("sha256")
    .update(JSON.stringify({ orderId, eventType, payload, prevHash, timestamp }))
    .digest("hex");
}

function buildChain(rows: Array<{ event_type: string; payload: unknown; created_at: string }>, orderId: string): IEvidenceRow[] {
  let prev = "GENESIS";
  return rows.map((r) => {
    const hash = computeEvidenceHash(orderId, r.event_type, r.payload, prev, r.created_at);
    const row: IEvidenceRow = { event_type: r.event_type, payload: r.payload, created_at: r.created_at, hash, prev_hash: prev };
    prev = hash;
    return row;
  });
}

/* =====================================================================
 * 1. computeEvidenceHash：字节级历史兼容
 * ===================================================================== */

test("字节兼容对照向量：与 m11 历史公式 JSON.stringify 固定构造序逐位一致", () => {
  const h = computeEvidenceHash(ORDER, "checkin", { lat: 31.23, photo_hash: "abc" }, "GENESIS", "2026-08-24T00:00:00.000Z");
  assert.equal(h, legacyHash(ORDER, "checkin", { lat: 31.23, photo_hash: "abc" }, "GENESIS", "2026-08-24T00:00:00.000Z"));
  assert.match(h, /^[a-f0-9]{64}$/);
});

test("确定性：同输入必同输出；sha256Hex 与 Node crypto 直算一致", () => {
  const a = computeEvidenceHash(ORDER, "e1", {}, "GENESIS", "T0");
  const b = computeEvidenceHash(ORDER, "e1", {}, "GENESIS", "T0");
  assert.equal(a, b);
  assert.equal(sha256Hex("probe"), createHash("sha256").update("probe").digest("hex"));
});

test("篡改敏感：payload 或 prevHash 任一变化即哈希变化", () => {
  const base = computeEvidenceHash(ORDER, "e1", { x: 1 }, "GENESIS", "T0");
  assert.notEqual(base, computeEvidenceHash(ORDER, "e1", { x: 2 }, "GENESIS", "T0"));
  assert.notEqual(base, computeEvidenceHash(ORDER, "e1", { x: 1 }, "tampered-prev", "T0"));
});

test("undefined orderId 键省略字节语义：与历史 protocol_id-only 写入形态逐位兼容", () => {
  const viaUndefined = computeEvidenceHash(undefined, "created", { a: 1 }, "GENESIS", "T0");
  // JSON.stringify 省略 undefined 键 → 与四键对象同字节
  const fourKeys = createHash("sha256").update(JSON.stringify({ eventType: "created", payload: { a: 1 }, prevHash: "GENESIS", timestamp: "T0" })).digest("hex");
  assert.equal(viaUndefined, fourKeys);
  assert.notEqual(viaUndefined, legacyHash("", "created", { a: 1 }, "GENESIS", "T0")); // 空串会保留键，字节不同
});

test("键序纪律锁定：同键异序的 payload 产生不同哈希——A 写 B 验必须共用同一构造路径", () => {
  const a = computeEvidenceHash(ORDER, "e1", { alpha: 1, beta: 2 }, "GENESIS", "T0");
  const b = computeEvidenceHash(ORDER, "e1", { beta: 2, alpha: 1 }, "GENESIS", "T0");
  assert.notEqual(a, b);
});

/* =====================================================================
 * 2. verifyEvidenceChain：三断因 + 等时戳容忍
 * ===================================================================== */

test("空链与单行 GENESIS 链均 valid", () => {
  assert.deepEqual(verifyEvidenceChain(ORDER, []), { valid: true, brokenAtIndex: -1 });
  const single = buildChain([{ event_type: "created", payload: {}, created_at: "2026-08-24T10:00:00.000Z" }], ORDER);
  assert.equal(verifyEvidenceChain(ORDER, single).valid, true);
});

test("多行顺序链 valid：时间戳相等（毫秒级并发）被非严格单调容忍", () => {
  const chain = buildChain(
    [
      { event_type: "STAGE_ACCEPTED", payload: { s: 1 }, created_at: "2026-08-24T10:00:00.000Z" },
      { event_type: "STAGE_ARRIVED", payload: { s: 2 }, created_at: "2026-08-24T10:00:00.000Z" },
      { event_type: "STAGE_DONE", payload: { s: 3 }, created_at: "2026-08-24T10:00:00.001Z" },
    ],
    ORDER,
  );
  assert.equal(verifyEvidenceChain(ORDER, chain).valid, true);
});

test("中间环 payload 被篡改 → HASH_MISMATCH 且 brokenAtIndex 指向该环", () => {
  const chain = buildChain(
    [
      { event_type: "a", payload: { n: 1 }, created_at: "2026-08-24T10:00:00.000Z" },
      { event_type: "b", payload: { n: 2 }, created_at: "2026-08-24T10:01:00.000Z" },
      { event_type: "c", payload: { n: 3 }, created_at: "2026-08-24T10:02:00.000Z" },
    ],
    ORDER,
  );
  (chain[1].payload as { n: number }).n = 999;
  const result = verifyEvidenceChain(ORDER, chain);
  assert.deepEqual(result, { valid: false, brokenAtIndex: 1, reason: "HASH_MISMATCH" });
});

test("prev_hash 断链 → PREV_LINK_BREAK（哈希对期望前驱自洽、仅链接字段被换）", () => {
  const ts = "2026-08-24T10:01:00.000Z";
  const spliced: IEvidenceRow[] = [
    {
      event_type: "b",
      payload: {},
      created_at: ts,
      // 哈希按校验器期望前驱 GENESIS 计算 → 重算必然一致
      hash: computeEvidenceHash(ORDER, "b", {}, "GENESIS", ts),
      prev_hash: "not-genesis",
    },
  ];
  assert.deepEqual(verifyEvidenceChain(ORDER, spliced), { valid: false, brokenAtIndex: 0, reason: "PREV_LINK_BREAK" });
});

test("多行链中间环断裂定位：brokenAtIndex 指向中间环而非首尾", () => {
  const chain = buildChain(
    [
      { event_type: "a", payload: {}, created_at: "2026-08-24T10:00:00.000Z" },
      { event_type: "b", payload: {}, created_at: "2026-08-24T10:01:00.000Z" },
      { event_type: "c", payload: {}, created_at: "2026-08-24T10:02:00.000Z" },
    ],
    ORDER,
  );
  // 仅替换中环链接字段（原哈希本对期望前驱 chain[0].hash 自洽），断点必须精确落在下标 1
  const tampered: IEvidenceRow[] = [
    chain[0],
    { ...chain[1], prev_hash: "wrong-link" },
    chain[2],
  ];
  const result = verifyEvidenceChain(ORDER, tampered);
  assert.equal(result.reason, "PREV_LINK_BREAK");
  assert.equal(result.brokenAtIndex, 1);
});

test("时间戳回退 → TIMESTAMP_REGRESSION（即使哈希与链接本身自洽）", () => {
  const first = buildChain([{ event_type: "a", payload: {}, created_at: "2026-08-24T11:00:00.000Z" }], ORDER);
  // 第二环哈希/链接完全自洽（用真实 prev=first[0].hash 计算），仅时间戳回退
  const regressedRow: IEvidenceRow = {
    event_type: "b",
    payload: {},
    created_at: "2026-08-24T10:00:00.000Z",
    hash: computeEvidenceHash(ORDER, "b", {}, first[0].hash, "2026-08-24T10:00:00.000Z"),
    prev_hash: first[0].hash,
  };
  const result = verifyEvidenceChain(ORDER, [...first, regressedRow]);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TIMESTAMP_REGRESSION");
  assert.equal(result.brokenAtIndex, 1);
});

/* =====================================================================
 * 3. buildJudicialPackage：司法装配器
 * ===================================================================== */

const PARTIES = [
  { userId: "cu1", phone: "13800138000", realName: "张三", idNumber: "110101199001011234" },
  { userId: "pv1", phone: "13900139000", realName: "李四", idNumber: null },
];

test("司法包脱敏掩码：phone 前3后4、idNumber 仅尾4；realName 缺省置 null", () => {
  const pkg = buildJudicialPackage({
    disputeId: "d1",
    orderId: ORDER,
    status: "OPEN",
    createdAt: "2026-08-01T00:00:00.000Z",
    protocol: null,
    parties: PARTIES,
    evidenceLogs: [],
    compiledAt: "2026-08-24T12:00:00.000Z",
  });
  const subjects = pkg.litigationSubjects as Array<Record<string, unknown>>;
  assert.equal(subjects[0].phone, "138****8000");
  assert.equal(subjects[0].idNumber, "****1234");
  assert.equal(subjects[1].phone, "139****9000");
  assert.equal(subjects[1].idNumber, null);
  assert.equal(subjects[1].realName, "李四");
});

test("司法包结构完整性：compiledAt 时钟注入、compiler 常量、无协议时 originalAgreement=null", () => {
  const pkg = buildJudicialPackage({
    disputeId: "d1",
    orderId: ORDER,
    status: "RESOLVED",
    createdAt: "2026-08-01T00:00:00.000Z",
    protocol: null,
    parties: [],
    evidenceLogs: [],
    compiledAt: "2026-08-24T12:00:00.000Z",
  });
  assert.deepEqual(pkg.caseInfo, { disputeId: "d1", orderId: ORDER, status: "RESOLVED", createdAt: "2026-08-01T00:00:00.000Z" });
  assert.equal(pkg.compiledAt, "2026-08-24T12:00:00.000Z");
  assert.equal(pkg.compiler, "Deal Protocol AI Arbitration System");
  assert.equal(pkg.originalAgreement, null);
  assert.deepEqual((pkg.hashChain as Record<string, unknown>).chainValid, true);
});

test("performanceTrail 仅保留 checkin/photo/complete 三类事件并透传位置与照片哈希", () => {
  const chain = buildChain(
    [
      { event_type: "created", payload: {}, created_at: "2026-08-24T10:00:00.000Z" },
      { event_type: "checkin", payload: { location: { lat: 31.2 } }, created_at: "2026-08-24T10:05:00.000Z" },
      { event_type: "photo", payload: { photo_hash: "p1" }, created_at: "2026-08-24T10:06:00.000Z" },
      { event_type: "jury_vote_cast", payload: {}, created_at: "2026-08-24T10:07:00.000Z" },
      { event_type: "complete", payload: {}, created_at: "2026-08-24T10:08:00.000Z" },
    ],
    ORDER,
  );
  const pkg = buildJudicialPackage({
    disputeId: "d1",
    orderId: ORDER,
    status: "DONE",
    createdAt: null,
    protocol: { id: "p1", category: "保洁", coreFields: { hours: 3 }, status: "signed", finalPrice: 200, createdAt: "2026-08-01T00:00:00.000Z" },
    parties: [],
    evidenceLogs: chain,
    compiledAt: "2026-08-24T12:00:00.000Z",
  });
  const trail = pkg.performanceTrail as Array<Record<string, unknown>>;
  assert.deepEqual(trail.map((t) => t.eventType), ["checkin", "photo", "complete"]);
  assert.deepEqual(trail[0].location, { lat: 31.2 });
  assert.equal(trail[1].photoHash, "p1");
  assert.equal((pkg.originalAgreement as Record<string, unknown>).category, "保洁");
});

test("司法包当事人次序保持（需求方在前）且装配不引入未命中身份", () => {
  const pkg = buildJudicialPackage({
    disputeId: "d1",
    orderId: ORDER,
    status: "OPEN",
    createdAt: null,
    protocol: null,
    parties: [
      { userId: "cu1", phone: null, realName: null, idNumber: null },
      { userId: "pv1", phone: "13900139000", realName: "李四", idNumber: "110101198505052345" },
    ],
    evidenceLogs: [],
    compiledAt: "2026-08-24T12:00:00.000Z",
  });
  const subjects = pkg.litigationSubjects as Array<Record<string, unknown>>;
  assert.deepEqual(subjects.map((s) => s.userId), ["cu1", "pv1"]);
  assert.equal(subjects[0].phone, null);
});

test("A 写 B 验闭环：装配器内嵌校验对被篡改链如实报 chainValid=false", () => {
  const chain = buildChain(
    [
      { event_type: "checkin", payload: { photo_hash: "ok" }, created_at: "2026-08-24T10:00:00.000Z" },
      { event_type: "complete", payload: {}, created_at: "2026-08-24T10:30:00.000Z" },
    ],
    ORDER,
  );
  (chain[0].payload as { photo_hash: string }).photo_hash = "forged";
  const pkg = buildJudicialPackage({
    disputeId: "d1",
    orderId: ORDER,
    status: "DONE",
    createdAt: null,
    protocol: null,
    parties: [],
    evidenceLogs: chain,
    compiledAt: "2026-08-24T12:00:00.000Z",
  });
  assert.equal((pkg.hashChain as Record<string, unknown>).chainValid, false);
});
