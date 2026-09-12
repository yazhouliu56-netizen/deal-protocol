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

test("非法输入：垃圾文本 → PARSE（默认重试 2 次）；空串 → PARSE 且不调传输", async () => {
  let calls = 0;
  const fn = (async () => {
    calls += 1;
    return "这不是 JSON";
  }) as unknown as CompleteTextFn;
  const r1 = await generateAmmoFromSentence("嗯嗯哈哈", { completeFn: fn });
  assert.equal(r1.ok, false);
  assert.equal(r1.failureDimension, "PARSE");
  assert.equal(r1.attempts, 2);
  assert.equal(r1.schemaVersion, "ammo-llm/1");
  const r2 = await generateAmmoFromSentence("   ", { completeFn: fn });
  assert.equal(r2.ok, false);
  assert.equal(r2.failureDimension, "PARSE");
  assert.equal(r2.attempts, 0);
  assert.equal(calls, 2);
});

test("A3 重试：首次拒收、二次带错重出即过；maxAttempts=1 保持旧行为", async () => {
  const category = track("test-retry-ok");
  const bad = "```json\n{\"ammoId\": \"x\"}\n```";
  let calls = 0;
  const fn = (async () => {
    calls += 1;
    return calls === 1 ? bad : JSON.stringify(validConfig(category));
  }) as unknown as CompleteTextFn;
  const r = await generateAmmoFromSentence("电脑点不亮了，来个人看看", { completeFn: fn });
  assert.equal(r.ok, true);
  assert.equal(r.attempts, 2);
  assert.equal(calls, 2);

  let calls1 = 0;
  const fn1 = (async () => {
    calls1 += 1;
    return bad;
  }) as unknown as CompleteTextFn;
  const r1 = await generateAmmoFromSentence("嗯嗯哈哈", { completeFn: fn1, maxAttempts: 1 });
  assert.equal(r1.ok, false);
  assert.equal(r1.attempts, 1);
  assert.equal(calls1, 1);
});

test("extractAmmoJson：围栏剥离与花括号截取", () => {
  const fenced = '```json\n{"a": 1}\n```';
  assert.deepEqual(extractAmmoJson(fenced).value, { a: 1 });
  assert.deepEqual(extractAmmoJson('前缀 {"a": 1} 后缀').value, { a: 1 });
  assert.equal(extractAmmoJson("no braces here").ok, false);
  assert.equal(extractAmmoJson('["not", "object"]').ok, false);
});

test("extractAmmoJson 容错：控制字符与尾逗号", () => {
  assert.deepEqual(extractAmmoJson('{"a": 1,\u0000" b": 2,\n}').value, { a: 1, " b": 2 });
  assert.deepEqual(extractAmmoJson('{"a": [1, 2,],}').value, { a: [1, 2] });
});

test("provider 透出：网关形态回包带 provider，纯字符串回包无 provider", async () => {
  const category = track("test-prov-chain");
  const cfg = validConfig(category);
  const withProv = (async () => ({
    content: JSON.stringify(cfg),
    provider: "zhipu",
  })) as unknown as CompleteTextFn;
  const r1 = await generateAmmoFromSentence("自带水冷求装机", { completeFn: withProv });
  assert.equal(r1.ok, true);
  assert.equal(r1.provider, "zhipu");
  const category2 = track("test-prov-str");
  const cfg2 = validConfig(category2);
  const strOnly = (async () => JSON.stringify(cfg2)) as unknown as CompleteTextFn;
  const r2 = await generateAmmoFromSentence("自带水冷求装机", { completeFn: strOnly });
  assert.equal(r2.ok, true);
  assert.equal(r2.provider, undefined);
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

test("EMPTY_COMPLETION (upstream empty) is THROTTLED, never PARSE", async () => {
  // 2026-09-07 real-device 15/20: #12/#14/#16 short-sentence EMPTY_COMPLETION
  // from the free pool was misjudged as parse error. Lock: empty transport
  // (both string and {content} shapes) marks THROTTLED.
  const emptyStr = (async () => "") as unknown as CompleteTextFn;
  const r1 = await generateAmmoFromSentence("test-empty-str", {
    completeFn: emptyStr,
  });
  assert.equal(r1.ok, false);
  assert.deepEqual(r1.errors, ["EMPTY_COMPLETION"]);
  assert.equal(r1.failureDimension, "THROTTLED");

  const emptyObj = (async () => ({ content: "" })) as unknown as CompleteTextFn;
  const r2 = await generateAmmoFromSentence("test-empty-obj", {
    completeFn: emptyObj,
  });
  assert.equal(r2.ok, false);
  assert.deepEqual(r2.errors, ["EMPTY_COMPLETION"]);
  assert.equal(r2.failureDimension, "THROTTLED");
});
