/**
 * P4-T2/T4 试单沙盒（node:test · 100% Mock LLM，零计费，mock clock）。
 * 生成→过闸→入池→检索→建单投影全链；风控缺失拦上架。
 */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { generateAmmoFromSentence } from "../adapters/ai/sentence-to-ammo.ts";
import { DYNAMIC_AMMO_POOL } from "./factory.ts";
import { getAmmoDefinition } from "./registry.ts";
import { createWave } from "../base/order/wave.ts";
import { toOrderCore } from "../base/order/orderCore.ts";
import { toAtomicFiveState } from "../base/ammo/runner.ts";
import type { CompleteTextFn } from "../base/ai/llm-port.ts";

const NOW = 1750000000000;
const CATEGORY = "test-sandbox-catwash";

afterEach(() => {
  DYNAMIC_AMMO_POOL.delete(CATEGORY);
});

const mockOk = (config: Record<string, unknown>): CompleteTextFn =>
  (async () => JSON.stringify(config)) as CompleteTextFn;

const validConfig = (): Record<string, unknown> => ({
  ammoId: "test-sandbox-catwash-v1",
  category: CATEGORY,
  version: "1.0.0",
  supplyCluster: "C2_IN_HOME",
  workerRequirement: { isPoliceVerified: true },
  pricingModel: { kind: "FIXED", amountYuan: 60 },
  minFloorPrice: 3000,
  maxCeilingPrice: 200000,
  maxSurchargeRatio: 0.5,
  fuzePolicy: {
    fuzeId: "fuze-test-sandbox",
    fuzeTypes: ["IMPACT"],
    backgroundCheck: "BASIC",
    deposit: { strategy: "NONE" },
    trace: { photoProof: false, evidenceChain: false },
    propertyInsurance: false,
    advanceFreeze: { enabled: false },
    geoFence: { enabled: false, unlockOnArrival: false },
    antiFraudFilter: false,
    privacy: { virtualNumber: false, blurLocation: false, sensitiveWordIntervention: false },
    sos: { enabled: false, autoLocationReport: false, autoEvidenceAppend: false, notifyEmergencyContacts: false },
  },
  forwardHooks: ["ArrivalCheckHook"],
  aliases: ["测试洗猫"],
});

test("沙盒全链：生成→入池→检索→建单→投影（mock clock）", async () => {
  const r = await generateAmmoFromSentence("上门给猫洗澡", { completeFn: mockOk(validConfig()) });
  assert.equal(r.ok, true);
  const got = getAmmoDefinition(CATEGORY);
  assert.equal(got.ammoId, "test-sandbox-catwash-v1");
  const wave = createWave({
    id: "sandbox-1",
    authorId: "u1",
    basics: { category: CATEGORY, time: "今晚 19:00", area: "家楼下", radiusKm: 2 },
    budget: 60,
    capacity: 1,
    expiresAt: NOW + 3600_000,
    createdAt: NOW,
  });
  const core = toOrderCore(wave);
  assert.equal(core.amountYuan, 60);
  assert.equal(toAtomicFiveState({ waveStatus: wave.status }), "PUBLISHED");
});

test("风控缺失拦上架：无 fuzePolicy 拒绝入池", async () => {
  const bad = validConfig();
  delete bad.fuzePolicy;
  const r = await generateAmmoFromSentence("上门给猫洗澡", { completeFn: mockOk(bad) });
  assert.equal(r.ok, false);
  assert.equal(DYNAMIC_AMMO_POOL.has(CATEGORY), false);
});
