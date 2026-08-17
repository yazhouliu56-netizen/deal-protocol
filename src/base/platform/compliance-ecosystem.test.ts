import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPolicyNo,
  canonicalizeEContract,
  CLAIM_GATEWAY,
  coverageLimitCentsFor,
  DEFAULT_INSURANCE_RATIO,
  generateEContractSeal,
  issueMicroInsurancePolicy,
  POLICY_VALIDITY_MS,
  verifyContractSeal,
  type EContractSealInput,
} from "./compliance-ecosystem.ts";
import { sha256Hex } from "../ai/forgery.ts";

const contractInput = (over: Partial<EContractSealInput> = {}): EContractSealInput => ({
  orderNo: "ORD-2026-0888",
  demanderId: "dem-001",
  providerId: "pro-002",
  serviceCategory: "家政保洁",
  basePriceCents: 98_800,
  termsVersion: "v3.0",
  timestamp: 1_700_000_000_000,
  ...over,
});

test("电子合同：签章 SHA-256 生成确定性（64 位 hex + 规范化序列化等价）", () => {
  const a = generateEContractSeal(contractInput());
  const b = generateEContractSeal(contractInput());
  assert.equal(a.contractDigest, b.contractDigest);
  assert.equal(a.sealId, b.sealId);
  assert.match(a.contractDigest, /^[0-9a-f]{64}$/);
  assert.ok(a.sealId.startsWith("ECONTRACT-"));
  // 摘要确为规范化序列化的 SHA-256
  assert.equal(a.contractDigest, sha256Hex(canonicalizeEContract(contractInput())));
  assert.ok(a.legalDisclaimer.includes("电子签名法"));
  assert.ok(a.legalDisclaimer.includes("电子商务法"));
  assert.equal(a.signedAt, contractInput().timestamp);
  assert.equal(a.basePriceCents, 98_800);
});

test("电子合同：篡改 1 分金额即验签失败（1 字节篡改防护）", () => {
  const seal = generateEContractSeal(contractInput());
  const tampered = contractInput({ basePriceCents: 98_801 });
  const r = verifyContractSeal(seal, tampered);
  assert.equal(r.ok, false);
  assert.ok(r.note.includes("篡改"));
});

test("电子合同：篡改订单号/条款版本 → 验签失败；原样输入 → 有效", () => {
  const seal = generateEContractSeal(contractInput());
  assert.equal(verifyContractSeal(seal, contractInput()).ok, true);
  assert.equal(verifyContractSeal(seal, contractInput({ orderNo: "ORD-2026-0889" })).ok, false);
  assert.equal(verifyContractSeal(seal, contractInput({ termsVersion: "v2.9" })).ok, false);
  assert.equal(verifyContractSeal(seal, contractInput({ serviceCategory: "家政清洗" })).ok, false);
  // 时间戳篡改同样拦截
  assert.equal(verifyContractSeal(seal, contractInput({ timestamp: 1_700_000_000_001 })).ok, false);
});

test("电子合同：签章镜像字段被手工篡改 → 验签失败（存证防伪）", () => {
  const seal = generateEContractSeal(contractInput());
  const forged: typeof seal = { ...seal, basePriceCents: 1 };
  assert.equal(verifyContractSeal(forged, contractInput()).ok, false);
});

test("保单：家政弹药费率 0.05 → 保费/保额精确计算（分单位守恒）", () => {
  const p = issueMicroInsurancePolicy({
    orderNo: "ORD-2026-0888",
    holderId: "dem-001",
    orderAmountCents: 100_000, // ¥1,000
    ammo: { ammoId: "housekeeping-v1", category: "housekeeping", splitRulesInsuranceRatio: 0.05 },
    issuedAt: 1_700_000_000_000,
  });
  assert.equal(p.premiumCents, 5_000); // ¥50
  assert.equal(p.coverageLimitCents, 5_000_000); // 家政保额 ¥50,000
  assert.equal(p.insuranceRatio, 0.05);
  assert.equal(p.ammoId, "housekeeping-v1");
});

test("保单：组局弹药费率 0.02 → 保费/保额精确计算（保额 ¥20,000）", () => {
  const p = issueMicroInsurancePolicy({
    orderNo: "ORD-2026-0777",
    holderId: "org-009",
    orderAmountCents: 60_000,
    ammo: { ammoId: "meetup-social-v1", category: "meetup", splitRulesInsuranceRatio: 0.02 },
    issuedAt: 1_700_000_000_000,
  });
  assert.equal(p.premiumCents, 1_200); // ¥12 = 60000 × 0.02
  assert.equal(p.coverageLimitCents, 2_000_000); // 组局保额 ¥20,000
});

test("保单：弹药未声明费率 → 固定费率 0.05 兜底（红线 2 口径）", () => {
  const p = issueMicroInsurancePolicy({
    orderNo: "ORD-X1",
    holderId: "u1",
    orderAmountCents: 50_000,
    issuedAt: 1_700_000_000_000,
  });
  assert.equal(p.insuranceRatio, DEFAULT_INSURANCE_RATIO);
  assert.equal(p.premiumCents, 2_500);
});

test("保单：保单号 POL-YYYYMMDD-orderNoHash 唯一且确定性", () => {
  const t = 1_700_000_000_000;
  const p1 = buildPolicyNo("ORD-A", t);
  const p2 = buildPolicyNo("ORD-A", t);
  const p3 = buildPolicyNo("ORD-B", t);
  assert.equal(p1, p2);
  assert.match(p1, /^POL-\d{8}-[0-9a-f]{8}$/);
  assert.notEqual(p1, p3);
  // 日期部分 = UTC 日期
  assert.equal(p1.slice(4, 12), new Date(t).toISOString().slice(0, 10).replace(/-/g, ""));
});

test("保单：有效期 30 天精确 + 理赔报案通道绑定", () => {
  const p = issueMicroInsurancePolicy({
    orderNo: "ORD-C",
    holderId: "u2",
    orderAmountCents: 10_000,
    issuedAt: 1_700_000_000_000,
  });
  assert.equal(p.coverageEndAt - p.coverageStartAt, POLICY_VALIDITY_MS);
  assert.equal(p.claimGateway, CLAIM_GATEWAY);
  assert.match(p.claimGateway, /^platform:\/\/channel\/insurance-claim$/);
});

test("保单：保额上限类目映射（英文/中文类目归一）", () => {
  assert.equal(coverageLimitCentsFor("housekeeping"), 5_000_000);
  assert.equal(coverageLimitCentsFor("家政保洁"), 5_000_000);
  assert.equal(coverageLimitCentsFor("lap-家政"), 5_000_000);
  assert.equal(coverageLimitCentsFor("meetup"), 2_000_000);
  assert.equal(coverageLimitCentsFor("组局活动"), 2_000_000);
  assert.equal(coverageLimitCentsFor("companion"), 2_000_000);
  assert.equal(coverageLimitCentsFor("未知类目"), 2_000_000);
});