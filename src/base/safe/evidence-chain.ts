/**
 * 证据链权威 SSOT（批次 3b · 条文 #3 单一真理源）：
 * - computeEvidenceHash：与 m11 历史公式字节级兼容的规范化哈希
 *   （固定构造序 { orderId, eventType, payload, prevHash, timestamp } → sha256Hex）。
 *   字节兼容是司法存证第一铁律：存量已落盘链条在新校验器下 100% 可验，零迁移。
 * - verifyEvidenceChain：哈希重算连续性 + prev_hash 链接 + 时间戳非严格单调递增校验。
 * - buildJudicialPackage：司法举证包纯装配器（集成 phone/idNumber 脱敏掩码）。
 *
 * 红线 1：纯函数、零 DB/UI 依赖；compiledAt 等时钟一律入参注入。
 * 职责切分（裁决固化）：本模块只承载算法与装配核；数据库 I/O 由
 * modules/m11-evidence-log/evidence-chain.ts 承担并委托本模块计算哈希 —— A 写 B 验。
 */

import { createHash } from "crypto";

/** 与历史写入端字节兼容的证据行形状（DB snake_case 直读）。 */
export interface IEvidenceRow {
  id?: string;
  event_type: string;
  payload: unknown;
  hash: string;
  prev_hash: string | null;
  created_at: string;
}

export type ChainBreakReason =
  | "HASH_MISMATCH"
  | "PREV_LINK_BREAK"
  | "TIMESTAMP_REGRESSION";

export interface IChainVerificationResult {
  valid: boolean;
  /** 首个断点下标（0 起）；valid 时为 -1 */
  brokenAtIndex: number;
  reason?: ChainBreakReason;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * 权威哈希：内部严格按固定构造序执行 JSON.stringify（裁决方案 A · 字节级历史兼容）。
 * 字节语义注意：orderId 为 undefined 时 JSON.stringify 会整体省略该键——这正是
 * 历史写入端（protocol_id-only 证据）的实际字节形态，故参数透传不做强转。
 * payload 以调用方给定对象的原有键序参与序列化——写入端与校验端必须
 * 经由同一构造路径（A 写 B 验），不得在读写之间改写键序。
 */
export function computeEvidenceHash(
  orderId: string | undefined,
  eventType: string,
  payload: unknown,
  prevHash: string,
  timestamp: string,
): string {
  const content = JSON.stringify({ orderId, eventType, payload, prevHash, timestamp });
  return sha256Hex(content);
}

/**
 * 链完整性校验：
 * - 每环重算哈希须与落盘 hash 一致；
 * - 每环 prev_hash 须等于前环 hash（首环为 GENESIS）；
 * - created_at 非严格单调递增（t[i+1] >= t[i]，容忍毫秒级并发同刻写入）。
 */
export function verifyEvidenceChain(
  orderId: string | undefined,
  logs: readonly IEvidenceRow[],
): IChainVerificationResult {
  let prevHash = "GENESIS";
  let prevTsMs = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < logs.length; i++) {
    const row = logs[i];
    const recomputed = computeEvidenceHash(
      orderId,
      row.event_type,
      row.payload,
      prevHash,
      row.created_at,
    );
    if (row.hash !== recomputed) {
      return { valid: false, brokenAtIndex: i, reason: "HASH_MISMATCH" };
    }
    if ((row.prev_hash ?? null) !== prevHash) {
      return { valid: false, brokenAtIndex: i, reason: "PREV_LINK_BREAK" };
    }
    const tsMs = Date.parse(row.created_at);
    if (Number.isNaN(tsMs) || tsMs < prevTsMs) {
      return { valid: false, brokenAtIndex: i, reason: "TIMESTAMP_REGRESSION" };
    }
    prevTsMs = tsMs;
    prevHash = row.hash;
  }
  return { valid: true, brokenAtIndex: -1 };
}

/* =====================================================================
 * 司法举证包纯装配器
 * ===================================================================== */

export interface IJudicialParty {
  userId: string;
  phone: string | null;
  realName: string | null;
  idNumber: string | null;
}

export interface IJudicialPackageInput {
  disputeId: string;
  orderId: string;
  status: string | null;
  createdAt: string | null;
  protocol: {
    id: string;
    category: string;
    coreFields: unknown;
    status: string;
    finalPrice: number;
    createdAt: string;
  } | null;
  parties: readonly IJudicialParty[];
  evidenceLogs: readonly IEvidenceRow[];
  /** 时钟注入位（红线 1） */
  compiledAt: string;
}

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  return `${String(phone).slice(0, 3)}****${String(phone).slice(-4)}`;
}

function maskIdNumber(idNumber: string | null): string | null {
  if (!idNumber) return null;
  return `****${String(idNumber).slice(-4)}`;
}

const TRAIL_EVENT_TYPES = ["checkin", "photo", "complete"] as const;

export function buildJudicialPackage(input: IJudicialPackageInput): Record<string, unknown> {
  const verification = verifyEvidenceChain(input.orderId, input.evidenceLogs);
  return {
    caseInfo: {
      disputeId: input.disputeId,
      orderId: input.orderId,
      status: input.status,
      createdAt: input.createdAt,
    },
    litigationSubjects: input.parties.map((p) => ({
      userId: p.userId,
      realName: p.realName || null,
      idNumber: maskIdNumber(p.idNumber),
      phone: maskPhone(p.phone),
    })),
    originalAgreement: input.protocol
      ? {
          protocolId: input.protocol.id,
          category: input.protocol.category,
          coreFields: input.protocol.coreFields,
          status: input.protocol.status,
          finalPrice: input.protocol.finalPrice,
          createdAt: input.protocol.createdAt,
        }
      : null,
    hashChain: {
      chainValid: verification.valid,
      entries: input.evidenceLogs.map((ev) => ({
        id: ev.id,
        eventType: ev.event_type,
        hash: ev.hash,
        prevHash: ev.prev_hash,
        createdAt: ev.created_at,
      })),
    },
    performanceTrail: input.evidenceLogs
      .filter((ev) => (TRAIL_EVENT_TYPES as readonly string[]).includes(String(ev.event_type)))
      .map((ev) => {
        const payload = (ev.payload ?? {}) as Record<string, unknown>;
        return {
          eventType: ev.event_type,
          location: payload.location ?? null,
          photoHash: payload.photo_hash ?? null,
          timestamp: ev.created_at,
        };
      }),
    compiledAt: input.compiledAt,
    compiler: "Deal Protocol AI Arbitration System",
  };
}
