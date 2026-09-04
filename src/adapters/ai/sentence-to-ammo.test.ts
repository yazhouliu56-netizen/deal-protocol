/**
 * P2 量产链考卷（node:test · 100% Mock 网关，零计费）。
 * 覆盖：成功入池 / 超时捕获 / 单次修复 / 非法拦截 / 隔离清理。
 */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  autoRepairAmmoConfig,
  extractAmmoJson,
  generateAmmoFromSentence,
  toFailureDimension,
} from "./sentence-to-ammo.ts";
import { DYNAMIC_AMMO_POOL } from "../../ammo/factory.ts";
import type { CompleteTextFn } from "../../base/ai/llm-port.ts";

const USED_CATEGORIES = new Set<string>();

afterEach(() => {
  for (const c of USED_CATEGORIES) DYNAMIC_AMMO_POOL.delete(c);
  USED_CATEGORIES.clear();
});

const track = (category: string): string => {
  USED_CATEGORIES.add(category);
  return category;
};

const validConfig = (category: string): Record<string, unknown> => ({
  ammoId: `${category}-v1`,
  category,
  version: "1.0.0",
  supplyCluster: "C3_TECH_B2B",
  pricingModel: { kind: "FIXED", amountYuan: 80 },
  minFloorPrice: 3000,
  maxCeilingPrice: 200000,
  maxSurchargeRatio: 0.5,
  fuzePolicy: {
    fuzeId: "fuze-test",
    fuzeTypes: ["IMPACT"],
    backgroundCheck: "BASIC",
    deposit: { strategy: "NONE" },
    trace: { photoProof: false, evidenceChain: false },
    propertyInsurance: false,
    advanceFreeze: { enabled: false },
    geoFence: { enabled: false, unlockOnArrival: false },
    antiFraudFilter: false,
    privacy: {
      virtualNumber: false,
      blurLocation: false,
      sensitiveWordIntervention: false,
    },
    sos: {
      enabled: false,
      autoLocationReport: false,
      autoEvidenceAppend: false,
      notifyEmergencyContacts: false,
    },
  },
  forwardHooks: ["ArrivalCheckHook"],
  aliases: ["测试装机"],
});

const mockOk = (config: Record<string, unknown>): CompleteTextFn =>
  (async () => JSON.stringify(config)) as CompleteTextFn;

test("成功链路：生成→过闸→入池（test- 隔离类目）", async () => {
  const category = track("test-pc-mock-ok");
  const r = await generateAmmoFromSentence("电脑点不亮了，来个人看看", {
    completeFn: mockOk(validConfig(category)),
  });
  assert.equal(r.ok, true);
  assert.equal(r.ammoId, `${category}-v1`);
  assert.equal(r.autoRepaired, false);
  assert.ok(r.latencyMs >= 0);
  assert.ok(DYNAMIC_AMMO_POOL.has(category));
});

test("tokens 透传（mock usage）", async () => {
  const category = track("test-pc-tokens");
  const fn = (async () => ({
    content: JSON.stringify(validConfig(category)),
    usage: { prompt: 100, completion: 50 },
  })) as unknown as CompleteTextFn;
  const r = await generateAmmoFromSentence("新买的散件到了求装机", {
    completeFn: fn,
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.tokens, { prompt: 100, completion: 50 });
});

test("超时捕获：永不 resolve 的传输在 timeoutMs 内返回 TIMEOUT", async () => {
  const fn = (() => new Promise(() => {})) as unknown as CompleteTextFn;
  const r = await generateAmmoFromSentence("风扇声音巨响求清灰", {
    completeFn: fn,
    timeoutMs: 50,
  });
  assert.equal(r.ok, false);
  assert.equal(r.failureDimension, "TIMEOUT");
  assert.deepEqual(r.errors, ["AMMO_COMPLETE_TIMEOUT"]);
});

test("单次修复：越界数值钳制 + 缺失别名回补后过闸", async () => {
  const category = track("test-pc-repair");
  const cfg = validConfig(category);
  cfg.minFloorPrice = 1;
  cfg.maxSurchargeRatio = 0.9;
  delete cfg.aliases;
  const r = await generateAmmoFromSentence("自带水冷求装机", {
    completeFn: mockOk(cfg),
  });
  assert.equal(r.ok, true);
  assert.equal(r.autoRepaired, true);
  assert.equal(r.ammo?.holographic?.minFloorPrice, 3000);
  assert.equal(r.ammo?.holographic?.maxSurchargeRatio, 0.5);
});

test("非法钩子不修复：UNKNOWN_HOOK_OPERATOR → HOOK 维度上报", async () => {
  const category = track("test-pc-badhook");
  const cfg = validConfig(category);
  cfg.forwardHooks = ["NonExistentHook"];
  const r = await generateAmmoFromSentence("电脑维修", { completeFn: mockOk(cfg) });
  assert.equal(r.ok, false);
  assert.equal(r.failureDimension, "HOOK");
  assert.ok(!DYNAMIC_AMMO_POOL.has(category));
});

test("C2 无背调一票否决 → CLUSTER 维度上报", async () => {
  const category = track("test-ho-cluster");
  const cfg = validConfig(category);
  cfg.supplyCluster = "C2_IN_HOME";
  const r = await generateAmmoFromSentence("衣柜乱成狗了求拯救", {
    completeFn: mockOk(cfg),
  });
  assert.equal(r.ok, false);
  assert.equal(r.failureDimension, "CLUSTER");
});

test("非法输入：垃圾文本 → PARSE；空串 → PARSE 且不调传输", async () => {
  let calls = 0;
  const fn = (async () => {
    calls += 1;
    return "这不是 JSON";
  }) as unknown as CompleteTextFn;
  const r1 = await generateAmmoFromSentence("嗯嗯哈哈", { completeFn: fn });
  assert.equal(r1.ok, false);
  assert.equal(r1.failureDimension, "PARSE");
  const r2 = await generateAmmoFromSentence("   ", { completeFn: fn });
  assert.equal(r2.ok, false);
  assert.equal(r2.failureDimension, "PARSE");
  assert.equal(calls, 1);
});

test("extractAmmoJson：围栏剥离与花括号截取", () => {
  const fenced = '```json\n{"a": 1}\n```';
  assert.deepEqual(extractAmmoJson(fenced).value, { a: 1 });
  assert.deepEqual(extractAmmoJson('前缀 {"a": 1} 后缀').value, { a: 1 });
  assert.equal(extractAmmoJson("no braces here").ok, false);
  assert.equal(extractAmmoJson('["not", "object"]').ok, false);
});

test("autoRepairAmmoConfig：白名单外字段零触碰", () => {
  const v: Record<string, unknown> = {
    pricingModel: { kind: "FIXED", amountYuan: 80 },
    forwardHooks: ["ArrivalCheckHook"],
    aliases: ["x"],
  };
  assert.equal(autoRepairAmmoConfig(v, "test-cat"), false);
  assert.deepEqual(v.pricingModel, { kind: "FIXED", amountYuan: 80 });
  assert.deepEqual(v.forwardHooks, ["ArrivalCheckHook"]);
});

test("toFailureDimension：错误码确定性映射", () => {
  assert.equal(toFailureDimension(["UNKNOWN_HOOK_OPERATOR: x"]), "HOOK");
  assert.equal(toFailureDimension(["SPLIT_SUM_NOT_CONSERVED: y"]), "PRICE");
  assert.equal(toFailureDimension(["MISSING_FUZE_POLICY: z"]), "FUZE");
  assert.equal(toFailureDimension(["IN_HOME_SAFETY_GATE_REJECTED: w"]), "CLUSTER");
  assert.equal(toFailureDimension(["INVALID_VERSION: v"]), "PARSE");
  assert.equal(toFailureDimension(["SOMETHING_ELSE"]), "UNKNOWN");
});
