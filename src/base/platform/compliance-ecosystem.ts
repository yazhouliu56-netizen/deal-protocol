/**
 * L5-M2 外部合规生态引擎（P2 战役第二波攻坚，2026-08-17）。
 * 两大生成器（《电子签名法》+《电子商务法》合规底座）：
 *  ① generateEContractSeal：标准化电子合同 SHA-256 存证签章——规范化序列化 →
 *     不可变 contractDigest（64 位 hex）→ IEContractSeal（sealId/摘要/签约主体/
 *     金额/条款版本/时间戳/法定声明），verifyContractSeal 篡改 1 字节即验签失败；
 *  ② issueMicroInsurancePolicy：场景微保险秒级保单存根——保费严格取自
 *     ammo.holographic.splitRules.insuranceRatio（缺省固定费率 0.05），分（Cents）
 *     最小单位精确取整，保额上限按类目映射（家政 50,000 元 / 组局 20,000 元 /
 *     兜底 20,000 元），保单号 POL-YYYYMMDD-orderNoHash，绑定理赔报案通道 claimGateway。
 * 红线 1：纯确定性纯函数（SHA-256 复用 base/ai/forgery 官方向量实测）；红线 2：
 * 保费与保额一律分单位、与清结算保险计提口径一致；红线 3：base/platform 纯函数引擎，
 * 零 React / UI Store 反向依赖。
 */

import { sha256Hex } from "../ai/forgery.ts";

/* ═══════════════ ① 电子合同防伪签章（电子签名法 §14 存证） ═══════════════ */

export interface EContractSealInput {
  orderNo: string;
  demanderId: string;
  providerId: string;
  serviceCategory: string;
  /** 合同金额（分）。 */
  basePriceCents: number;
  /** 条款版本（如 "v3.0"）。 */
  termsVersion: string;
  /** 签约时间戳（ms）。 */
  timestamp: number;
}

export interface IEContractSeal {
  sealId: string;
  /** SHA-256 不可变摘要（64 位小写 hex）。 */
  contractDigest: string;
  orderNo: string;
  demanderId: string;
  providerId: string;
  serviceCategory: string;
  basePriceCents: number;
  termsVersion: string;
  signedAt: number;
  /** 法定声明（电子签名法/电子商务法存证备案条款，固定文案）。 */
  legalDisclaimer: string;
}

/** 法定存证声明：《电子签名法》§14 与《电子商务法》§52 合规锚点（固定不可变）。 */
export const E_CONTRACT_LEGAL_DISCLAIMER =
  "依据《中华人民共和国电子签名法》第十四条（可靠的电子签名与手写签名或盖章具有同等法律效力）" +
  "与《中华人民共和国电子商务法》第五十二条（电子合同订立与履行的法律效力），" +
  "本合同经 SHA-256 存证签章固化，任何篡改将导致验签失败并承担相应法律责任。";

/** 规范化序列化：固定字段序 + 定长金额，保证同输入同摘要（顺序变更即摘要变更）。 */
export function canonicalizeEContract(input: EContractSealInput): string {
  return JSON.stringify({
    orderNo: input.orderNo,
    demanderId: input.demanderId,
    providerId: input.providerId,
    serviceCategory: input.serviceCategory,
    basePriceCents: Math.round(input.basePriceCents),
    termsVersion: input.termsVersion,
    timestamp: input.timestamp,
  });
}

/**
 * 电子合同 SHA-256 存证签章生成器：规范化序列化 → contractDigest →
 * 导出 IEContractSeal（sealId 由摘要前 12 位确定性派生）。
 */
export function generateEContractSeal(input: EContractSealInput): IEContractSeal {
  const contractDigest = sha256Hex(canonicalizeEContract(input));
  return {
    sealId: `ECONTRACT-${contractDigest.slice(0, 12)}`,
    contractDigest,
    orderNo: input.orderNo,
    demanderId: input.demanderId,
    providerId: input.providerId,
    serviceCategory: input.serviceCategory,
    basePriceCents: Math.round(input.basePriceCents),
    termsVersion: input.termsVersion,
    signedAt: input.timestamp,
    legalDisclaimer: E_CONTRACT_LEGAL_DISCLAIMER,
  };
}

/**
 * 验签纯函数：以原始输入重算摘要并与存证签章比对。
 * 任何字段（含金额 1 分/订单号 1 字符）被篡改 → 摘要不匹配 → 验签失败。
 */
export function verifyContractSeal(
  seal: IEContractSeal,
  input: EContractSealInput
): { ok: boolean; note: string } {
  const recomputed = sha256Hex(canonicalizeEContract(input));
  if (recomputed !== seal.contractDigest) {
    return { ok: false, note: "合同摘要与存证签章不匹配（内容已被篡改）" };
  }
  if (
    seal.basePriceCents !== Math.round(input.basePriceCents) ||
    seal.orderNo !== input.orderNo ||
    seal.termsVersion !== input.termsVersion
  ) {
    return { ok: false, note: "签章镜像字段与输入不一致（存证被篡改）" };
  }
  return {
    ok: true,
    note: `电子合同存证有效（SHA-256: ${seal.contractDigest.slice(0, 16)}…，${seal.orderNo}，条款 ${seal.termsVersion}）`,
  };
}

/* ═══════════════ ② 场景微保险秒级保单（电子商务法 §52 履约保障） ═══════════════ */

/** 微保险弹药输入（只读消费 ammo.holographic.splitRules.insuranceRatio，宪法红线 6 视界投影）。 */
export interface MicroInsuranceAmmoRef {
  ammoId?: string;
  category: string;
  splitRulesInsuranceRatio?: number;
}

export interface MicroInsuranceInput {
  orderNo: string;
  holderId: string;
  /** 订单托管总额（分），保费计提基数。 */
  orderAmountCents: number;
  /** 弹药定义（提供 splitRulesInsuranceRatio 与类目）；缺省走固定费率 0.05。 */
  ammo?: MicroInsuranceAmmoRef;
  /** 投保时间戳（ms）。 */
  issuedAt: number;
}

export interface IInsurancePolicyCertificate {
  /** 保单号：POL-YYYYMMDD-orderNoHash（8 位 hex 指纹）。 */
  policyNo: string;
  orderNo: string;
  holderId: string;
  /** 保费（分）＝ 订单总额 × insuranceRatio，精确取整，与清结算保险计提一致。 */
  premiumCents: number;
  /** 赔付上限（保额，分）。 */
  coverageLimitCents: number;
  /** 生效费率（取自弹药 splitRules.insuranceRatio，缺省 0.05）。 */
  insuranceRatio: number;
  coverageStartAt: number;
  coverageEndAt: number;
  /** 理赔报案通道（秒级保单直达）。 */
  claimGateway: string;
  ammoId?: string;
  category: string;
}

/** 缺省固定费率（弹药未声明 splitRules 时的兜底计提，红线 2 固定费率口径）。 */
export const DEFAULT_INSURANCE_RATIO = 0.05;
/** 保单有效期（30 天，覆盖履约窗口）。 */
export const POLICY_VALIDITY_MS = 30 * 86_400_000;
/** 理赔报案通道常量。 */
export const CLAIM_GATEWAY = "platform://channel/insurance-claim";

/** 类目保额上限映射（分）：家政 50,000 元 / 组局 20,000 元 / 兜底 20,000 元。 */
export const COVERAGE_LIMIT_CENTS_BY_CATEGORY: Record<string, number> = {
  housekeeping: 50_000_00,
  home: 50_000_00,
  meetup: 20_000_00,
  companion: 20_000_00,
};

export function coverageLimitCentsFor(category: string): number {
  const key = category.toLowerCase();
  if (key.includes("housekeeping") || key.includes("家政") || key.includes("保洁")) {
    return COVERAGE_LIMIT_CENTS_BY_CATEGORY.housekeeping;
  }
  if (key.includes("meetup") || key.includes("组局")) {
    return COVERAGE_LIMIT_CENTS_BY_CATEGORY.meetup;
  }
  return COVERAGE_LIMIT_CENTS_BY_CATEGORY.companion;
}

/** 保单号：POL-YYYYMMDD-orderNoHash（日期取 UTC，确定性）。 */
export function buildPolicyNo(orderNo: string, issuedAt: number): string {
  const datePart = new Date(issuedAt).toISOString().slice(0, 10).replace(/-/g, "");
  const hashPart = sha256Hex(orderNo).slice(0, 8);
  return `POL-${datePart}-${hashPart}`;
}

/**
 * 场景微保险秒级保单存根生成器：
 *  - 费率 = ammo.splitRules.insuranceRatio（仅取 D7 分账保险专户计提值）或固定 0.05；
 *  - 保费（分）＝ orderAmountCents × 费率，Math.round 精确取整（资金守恒对齐）；
 *  - 保额上限按类目映射（家政 50,000 元 / 组局 20,000 元 / 兜底 20,000 元）；
 *  - 有效期 30 天，绑定理赔报案通道，返回 IInsurancePolicyCertificate。
 * 纯确定性：同输入必然产出同保单号/同保费/同保额。
 */
export function issueMicroInsurancePolicy(input: MicroInsuranceInput): IInsurancePolicyCertificate {
  const ratio =
    input.ammo?.splitRulesInsuranceRatio === undefined
      ? DEFAULT_INSURANCE_RATIO
      : input.ammo.splitRulesInsuranceRatio;
  const premiumCents = Math.round(Math.abs(input.orderAmountCents) * ratio);
  const category = input.ammo?.category ?? "default";
  const coverageLimitCents = coverageLimitCentsFor(category);

  return {
    policyNo: buildPolicyNo(input.orderNo, input.issuedAt),
    orderNo: input.orderNo,
    holderId: input.holderId,
    premiumCents,
    coverageLimitCents,
    insuranceRatio: ratio,
    coverageStartAt: input.issuedAt,
    coverageEndAt: input.issuedAt + POLICY_VALIDITY_MS,
    claimGateway: CLAIM_GATEWAY,
    ...(input.ammo?.ammoId ? { ammoId: input.ammo.ammoId } : {}),
    category,
  };
}