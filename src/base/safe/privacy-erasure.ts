/**
 * L4-M5 隐私全生命周期遗忘与密态销毁引擎（P2 战役第一波攻坚，2026-08-17）。
 * 严格对齐《个人信息保护法》第四十七条（注销账户 → 删除/匿名化个人信息的行使规则）：
 *  ① executeCryptoShredding：Crypto-Shredding 管道——对 PII（姓名/手机号/身份证/精确地址/
 *     邮箱/精确坐标）做不可逆覆写（密态销毁），财务与分账不可变快照（order_no/amount_cents/
 *     split_plan_json/paid_at）依法保留不碰，输出 IShreddingCertificate 存证证书
 *     （销毁时间戳 + 执行人签名 + 数据摘要 SHA-256）；
 *  ② evaluateMediaRetention：过期完工媒体自动清理调度器——按保存策略
 *     （正常完工 90 天 / 有争议案件 180 天）精准输出 toPurge（物理删除 OSS Key）与 toRetain。
 * 红线 1：纯确定性纯函数，零概率分支，时间戳全部入参；红线 3：base/safe 纯函数引擎，
 * 零 React / UI Store 反向依赖（SHA-256 复用 base/ai/forgery 已实测官方向量）。
 */

import { sha256Hex } from "../ai/forgery.ts";

/* ═══════════════ ①《个保法》§47 账户密态销毁管道 ═══════════════ */

export interface PiiProfile {
  id?: string;
  /** 真实姓名（verification_real_name）。 */
  name?: string;
  /** 手机号。 */
  phone?: string;
  /** 身份证号。 */
  idNumber?: string;
  /** 精确地址。 */
  address?: string;
  /** 邮箱。 */
  email?: string;
  /** 精确坐标纬度（有即擦除）。 */
  lat?: number | null;
  /** 精确坐标经度（有即擦除）。 */
  lng?: number | null;
  [key: string]: unknown;
}

/** 财务与分账不可变对账流水（依法保留字段，全程只读不擦除）。 */
export interface FinancialLedgerRow {
  /** 历史订单号（不可删除）。 */
  order_no: string;
  /** 分账金额（分，不可删除）。 */
  amount_cents: number;
  /** 分账方案快照（JSON 串，不可删除）。 */
  split_plan_json: string;
  /** 支付时间戳（ms，不可删除）。 */
  paid_at: number;
  /** 结算状态（不可删除）。 */
  settlement_status: string;
  [key: string]: unknown;
}

export interface ShreddingContext {
  userId: string;
  /** 原始个人 Profile（含 PII 字段）。 */
  profile: PiiProfile;
  /** 历史订单财务摘要（密态销毁不得触碰）。 */
  ledger: FinancialLedgerRow[];
  /** 销毁请求时间戳（ms）。 */
  requestedAt: number;
  /** 执行人签名（如 "user:self-delete" / "platform-admin:<id>"）。 */
  executor: string;
}

export interface IShreddingCertificate {
  /** 存证证书号。 */
  certificateId: string;
  userId: string;
  /** 销毁时间戳（ms）。 */
  shreddedAt: number;
  /** 执行人签名。 */
  executor: string;
  /** 执行人签名指纹（executor + 用户派生，确定性 8 位 hex）。 */
  signature: string;
  /** 本次实际擦除的 PII 字段清单。 */
  piiFieldsShredded: string[];
  /** 依法保留的财务流水条数。 */
  retainedLedgerCount: number;
  /** 依法保留的财务流水总额（分）。 */
  retainedLedgerAmountCents: number;
  /** 数据摘要 SHA-256（销毁时间 + 用户 + 保留流水指纹）。 */
  digestSha256: string;
  /** 密态覆写后的匿名 Profile（证书留档可复核）。 */
  anonymizedProfile: PiiProfile;
}

export interface ShreddingResult {
  certificate: IShreddingCertificate;
  /** 密态覆写后的匿名 Profile。 */
  profile: PiiProfile;
  /** 财务不可变快照（原样返回，一条不少）。 */
  ledger: FinancialLedgerRow[];
}

/** 手机号密态覆写：取前 3 位 + **** + 后 4 位（位数不足用确定性兜底 138/0000）。 */
function shredPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const head = digits.length >= 3 ? digits.slice(0, 3) : "138";
  const tail = digits.length >= 4 ? digits.slice(-4) : "0000";
  return `${head}****${tail}`;
}

/** 邮箱密态覆写：首字符 + *** + @域（无域直接 ***）。 */
function shredEmail(email: string): string {
  const [user, dom] = email.split("@");
  if (!dom) return "***";
  const head = user.length > 0 ? user.slice(0, 1) : "x";
  return `${head}***@${dom}`;
}

/**
 * 账户注销密态销毁（Crypto-Shredding）管道：
 *  ① PII 不可逆覆写——姓名 → ANON_USER_<hash>、手机号 → 138****xxxx、身份证 → ***、
 *     精确地址 → ***、邮箱 → 掩码、精确坐标 → null（覆写后原值不可还原，密态销毁本质）；
 *  ② 财务对账流水（order_no/amount_cents/split_plan_json/paid_at/settlement_status）
 *     原样保留——税务/财务法律合规，严禁删除；
 *  ③ 输出 IShreddingCertificate（证书号 / 销毁时间戳 / 执行人签名 + 指纹 / PII 字段清单 /
 *     保留流水计数与总额 / 数据摘要 SHA-256）。
 * 纯确定性：同样的输入必然产出同样的证书与摘要。
 */
export function executeCryptoShredding(ctx: ShreddingContext): ShreddingResult {
  const userIdHash = sha256Hex(ctx.userId);
  const anonName = `ANON_USER_${userIdHash.slice(0, 12)}`;
  const anon: PiiProfile = { ...ctx.profile };
  const shredded: string[] = [];

  if (typeof anon.name === "string" && anon.name.trim() !== "") {
    anon.name = anonName;
    shredded.push("name");
  }
  if (typeof anon.phone === "string" && anon.phone.trim() !== "") {
    anon.phone = shredPhone(anon.phone);
    shredded.push("phone");
  }
  if (typeof anon.idNumber === "string" && anon.idNumber.trim() !== "") {
    anon.idNumber = "***";
    shredded.push("idNumber");
  }
  if (typeof anon.address === "string" && anon.address.trim() !== "") {
    anon.address = "***";
    shredded.push("address");
  }
  if (typeof anon.email === "string" && anon.email.trim() !== "") {
    anon.email = shredEmail(anon.email);
    shredded.push("email");
  }
  if (typeof anon.lat === "number" && Number.isFinite(anon.lat)) {
    anon.lat = null;
    shredded.push("lat");
  }
  if (typeof anon.lng === "number" && Number.isFinite(anon.lng)) {
    anon.lng = null;
    shredded.push("lng");
  }
  if (shredded.length > 0 && typeof anon.id === "string" && anon.id !== "") {
    anon.id = anonName;
    shredded.push("id");
  }

  const ledgerFingerprint = ctx.ledger.map((r) => [
    r.order_no,
    r.amount_cents,
    r.settlement_status,
  ]);
  const digestSha256 = sha256Hex(
    JSON.stringify({
      userId: ctx.userId,
      shreddedAt: ctx.requestedAt,
      retainedLedger: ledgerFingerprint,
    })
  );
  const certificateId = `shred-${userIdHash.slice(0, 8)}-${ctx.requestedAt.toString(36)}`;
  const signature = `${ctx.executor}:${sha256Hex(`${ctx.userId}::${ctx.executor}`).slice(0, 8)}`;
  const retainedLedgerAmountCents = ctx.ledger.reduce((sum, r) => sum + r.amount_cents, 0);

  const certificate: IShreddingCertificate = {
    certificateId,
    userId: ctx.userId,
    shreddedAt: ctx.requestedAt,
    executor: ctx.executor,
    signature,
    piiFieldsShredded: shredded.sort(),
    retainedLedgerCount: ctx.ledger.length,
    retainedLedgerAmountCents,
    digestSha256,
    anonymizedProfile: anon,
  };

  return { certificate, profile: anon, ledger: ctx.ledger };
}

/* ═══════════════ ② 过期完工媒体自动清理调度器 ═══════════════ */

export interface CompletionMedia {
  /** OSS Key（物理删除候选）。 */
  mediaKey: string;
  /** 所属订单号。 */
  orderNo: string;
  /** 完工时间戳（ms），保留期起点。 */
  completedAt: number;
  /** 是否争议案件（争议案件保留期更长）。 */
  disputed: boolean;
  /** 文件字节数（清点释放量用）。 */
  sizeBytes: number;
}

/** 默认保存策略：正常完工照片 90 天 / 有争议案件照片 180 天。 */
export const MEDIA_RETENTION_DEFAULT = { normalDays: 90, disputeDays: 180 } as const;

const DAY_MS = 86_400_000;

export interface MediaRetainEntry {
  mediaKey: string;
  /** 保留理由（保存策略标签）。 */
  reason: string;
  /** 到期时间戳（ms）。 */
  expiresAt: number;
}

export interface MediaRetentionResult {
  /** 应物理删除的 OSS Key 清单。 */
  toPurge: string[];
  /** 继续留存的清单（含到期时间与策略标签）。 */
  toRetain: MediaRetainEntry[];
  purgedCount: number;
  retainedCount: number;
  /** 释放字节总量。 */
  purgedBytes: number;
}

/**
 * 过期完工媒体自动清理调度器：按保存策略（正常 90 天 / 争议 180 天）计算每件媒体的
 * 到期时间戳，now ≥ 到期 → 进 toPurge（物理删除 OSS Key），否则进 toRetain。
 * 严格确定性：同日到期（expiresAt === now）即判过期可删除；完工时间在未来时必然保留。
 */
export function evaluateMediaRetention(
  media: CompletionMedia[],
  now: number,
  policy: { normalDays: number; disputeDays: number } = MEDIA_RETENTION_DEFAULT
): MediaRetentionResult {
  const toPurge: string[] = [];
  const toRetain: MediaRetainEntry[] = [];
  let purgedBytes = 0;

  const sorted = [...media].sort((a, b) => a.completedAt - b.completedAt);
  for (const m of sorted) {
    const days = m.disputed ? policy.disputeDays : policy.normalDays;
    const expiresAt = m.completedAt + days * DAY_MS;
    if (expiresAt <= now) {
      toPurge.push(m.mediaKey);
      purgedBytes += m.sizeBytes;
    } else {
      toRetain.push({
        mediaKey: m.mediaKey,
        reason: m.disputed ? "DISPUTE_RETENTION" : "NORMAL_RETENTION",
        expiresAt,
      });
    }
  }

  return {
    toPurge,
    toRetain,
    purgedCount: toPurge.length,
    retainedCount: toRetain.length,
    purgedBytes,
  };
}