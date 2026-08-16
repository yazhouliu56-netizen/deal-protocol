/**
 * AmmoFactory 工业级弹药装配流水线测试矩阵：
 *   合法 8 维弹药秒级出厂 / 资金不守恒拦截 / 入户安全一票否决 /
 *   加价上限熔断 / 计价边界护栏 / 未知钩子拒绝 / 违约阶梯越界 /
 *   版本语义守卫 / 浮点容差放行 / 动态热注册即时生效 / 快照冻结免疫热更新 /
 *   快照透传钩子上下文。
 * 全部为确定性纯函数断言（红线 1：零 LLM、零动态代码执行）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HOOK_OPERATOR_REGISTRY,
  assembleAmmo,
  registerDynamicAmmo,
  type AssembledAmmoResult,
} from "./factory.ts";
import {
  DYNAMIC_AMMO_POOL,
  getAmmoById,
  getAmmoDefinition,
} from "./registry.ts";
import type {
  IAmmoDefinition,
  IHolographicAmmoConfig,
  ISubEventHook,
} from "../types/ammo-schema.ts";
import { DEFAULT_FUZE_POLICY, DELAY_FUZE_TEMPLATE } from "../types/fuze-policy.ts";
import { advanceLifecycle } from "../base/ammo/runner.ts";

/** 合法 8 维全息配置（上门汽车洗美 v1：C1 移动轻履约 · 延期引信 · 三钩子）。 */
function validConfig(
  overrides?: Partial<IHolographicAmmoConfig>
): IHolographicAmmoConfig {
  return {
    ammoId: "car-wash-v1",
    category: "上门汽车洗美",
    version: "1.0.0",
    supplyCluster: "C1_MOBILITY",
    workerRequirement: { requiredIdentityLevel: "REAL_NAME", minSafetyScore: 60 },
    pricingModel: { kind: "FIXED", amountYuan: 88 },
    pricingParams: { travelFeeYuan: 10 },
    minFloorPrice: 3000,
    maxCeilingPrice: 12000,
    maxSurchargeRatio: 0.3,
    creditWaiverRule: {
      allowedCreditDimension: "PUNCTUALITY",
      maxWaiverPercentage: 0.3,
    },
    fuzePolicy: { ...DELAY_FUZE_TEMPLATE, fuzeId: "fuze-car-wash" },
    requiredSensors: ["GPS_GEOFENCE", "WATERMARK_CAMERA"],
    sensorFallbackLadder: {
      GPS_GEOFENCE: ["NFC_BUMP"],
      WATERMARK_CAMERA: ["REAL_TIME_AUDIO"],
    },
    forwardHooks: ["ArrivalCheckHook", "OnsiteQuoteHook", "CleaningCheckHook"],
    cancellationTiers: [
      {
        stage: "BEFORE_MATCH",
        demanderRefundRatio: 1,
        providerCompensationYuan: 0,
        deductDepositRatio: 0,
      },
      {
        stage: "AFTER_MATCH_EN_ROUTE",
        demanderRefundRatio: 0.8,
        providerCompensationYuan: 20,
        deductDepositRatio: 0.2,
      },
    ],
    autoAcceptanceTimeoutHours: 12,
    splitRules: { providerRatio: 0.9, platformRatio: 0.05, insuranceRatio: 0.05 },
    theme: "default",
    formSchema: { fields: [{ key: "carModel", type: "text" }] },
    cockpitSlot: "car-wash-cockpit",
    ...overrides,
  };
}

function expectAssembled(r: AssembledAmmoResult): Readonly<IAmmoDefinition> {
  if (!r.ok) assert.fail(`expected ok, got: ${r.errors.join("; ")}`);
  return r.ammo;
}

function expectRejected(
  r: AssembledAmmoResult,
  code: string
): void {
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.ok(
    r.errors.some((e) => e.startsWith(code)),
    `expected error starting with ${code}, got: ${r.errors.join("; ")}`
  );
}

/* ============ 1. 合法弹药秒级出厂 ============ */

test("合法 8 维弹药秒级出厂：标准 IAmmoDefinition + 8 维镜像 + 全图冻结", () => {
  const ammo = expectAssembled(assembleAmmo(validConfig()));
  assert.equal(ammo.ammoId, "car-wash-v1");
  assert.equal(ammo.category, "上门汽车洗美");
  assert.equal(ammo.version, "1.0.0");
  assert.deepEqual(
    ammo.fiveStateHooks.map((h) => h.hookId),
    ["operator.arrival-check", "operator.onsite-quote", "operator.cleaning-check"]
  );
  // 钩子经静态白名单解析（同一对象、非即时拼装）
  assert.equal(ammo.fiveStateHooks[0], HOOK_OPERATOR_REGISTRY["ArrivalCheckHook"]);
  assert.equal(ammo.fiveStateHooks[1], HOOK_OPERATOR_REGISTRY["OnsiteQuoteHook"]);
  assert.equal(ammo.fiveStateHooks[2], HOOK_OPERATOR_REGISTRY["CleaningCheckHook"]);
  // 不可变发布：整弹 + 钩子 + 引信 + 镜像全图冻结
  assert.equal(Object.isFrozen(ammo), true);
  assert.equal(Object.isFrozen(ammo.fiveStateHooks), true);
  assert.equal(Object.isFrozen(ammo.fiveStateHooks[0]), true);
  assert.equal(Object.isFrozen(ammo.fuzePolicy), true);
  assert.equal(Object.isFrozen(ammo.holographic), true);
  // 8 维全息镜像完整回收（D2/D4/D6/D7/D8 视界层只读消费）
  assert.equal(ammo.holographic?.splitRules?.providerRatio, 0.9);
  assert.deepEqual(ammo.holographic?.requiredSensors, ["GPS_GEOFENCE", "WATERMARK_CAMERA"]);
  assert.equal(ammo.holographic?.cancellationTiers?.[1]?.stage, "AFTER_MATCH_EN_ROUTE");
  assert.equal(ammo.holographic?.cockpitSlot, "car-wash-cockpit");
  assert.equal(ammo.holographic?.theme, "default");
});

/* ============ 2. 资金守恒硬性审查 ============ */

test("资金不守恒拦截：splitRules 三比之和非 1.0 拒绝出厂", () => {
  expectRejected(
    assembleAmmo(
      validConfig({ splitRules: { providerRatio: 0.9, platformRatio: 0.05, insuranceRatio: 0.03 } })
    ),
    "SPLIT_SUM_NOT_CONSERVED"
  );
  expectRejected(
    assembleAmmo(
      validConfig({ splitRules: { providerRatio: 0.5, platformRatio: 0.3, insuranceRatio: 0.1 } })
    ),
    "SPLIT_SUM_NOT_CONSERVED"
  );
  // 比例出界（1.2 / -0.2）同样拒绝（比例合法区间 [0,1] 独立于求和守恒）
  expectRejected(
    assembleAmmo(
      validConfig({ splitRules: { providerRatio: 1.2, platformRatio: 0, insuranceRatio: -0.2 } })
    ),
    "SPLIT_RATIO_OUT_OF_RANGE"
  );
});

test("资金守恒浮点容差：0.1+0.2+0.7 = 1.0000000000000002 放行出厂", () => {
  // 二进制浮点下 0.1+0.2+0.7 并非精确 1.0，1e-9 容差内视为守恒
  const ammo = expectAssembled(
    assembleAmmo(
      validConfig({ splitRules: { providerRatio: 0.1, platformRatio: 0.2, insuranceRatio: 0.7 } })
    )
  );
  assert.equal(ammo.holographic?.splitRules?.insuranceRatio, 0.7);
});

/* ============ 3. 入户安全一票否决 ============ */

test("入户无背调一票否决：C2_IN_HOME 必须公安背调或安全分 ≥ 700", () => {
  expectRejected(
    assembleAmmo(
      validConfig({
        supplyCluster: "C2_IN_HOME",
        workerRequirement: { minSafetyScore: 60 },
      })
    ),
    "IN_HOME_SAFETY_GATE_REJECTED"
  );
  expectRejected(
    assembleAmmo(validConfig({ supplyCluster: "C2_IN_HOME", workerRequirement: {} })),
    "IN_HOME_SAFETY_GATE_REJECTED"
  );
  expectRejected(
    assembleAmmo(
      validConfig({
        supplyCluster: "C2_IN_HOME",
        workerRequirement: { minSafetyScore: 699 },
      })
    ),
    "IN_HOME_SAFETY_GATE_REJECTED"
  );
  // 逃生通道一：公安背调通过
  expectAssembled(
    assembleAmmo(
      validConfig({
        supplyCluster: "C2_IN_HOME",
        workerRequirement: { isPoliceVerified: true },
      })
    )
  );
  // 逃生通道二：安全分恰好 700
  expectAssembled(
    assembleAmmo(
      validConfig({
        supplyCluster: "C2_IN_HOME",
        workerRequirement: { minSafetyScore: 700, isPoliceVerified: false },
      })
    )
  );
  // 非入户类目不触发红线
  expectAssembled(
    assembleAmmo(
      validConfig({
        supplyCluster: "C1_MOBILITY",
        workerRequirement: { minSafetyScore: 60 },
      })
    )
  );
});

/* ============ 4. 防坐地起价熔断 ============ */

test("加价上限超标拦截：maxSurchargeRatio > 0.5 拒绝出厂", () => {
  expectRejected(
    assembleAmmo(validConfig({ maxSurchargeRatio: 0.6 })),
    "ANTI_GOUGING_LIMIT_EXCEEDED"
  );
  expectRejected(
    assembleAmmo(validConfig({ maxSurchargeRatio: 0.99 })),
    "ANTI_GOUGING_LIMIT_EXCEEDED"
  );
  // 边界值 0.5 放行
  expectAssembled(assembleAmmo(validConfig({ maxSurchargeRatio: 0.5 })));
});

/* ============ 5. 计价边界护栏 ============ */

test("计价边界护栏：minFloorPrice > maxCeilingPrice 拒绝出厂", () => {
  expectRejected(
    assembleAmmo(validConfig({ minFloorPrice: 12000, maxCeilingPrice: 3000 })),
    "PRICE_FLOOR_ABOVE_CEILING"
  );
  // 地板价 == 天花板价（单点定价）放行
  expectAssembled(
    assembleAmmo(validConfig({ minFloorPrice: 3000, maxCeilingPrice: 3000 }))
  );
});

/* ============ 6. 静态白名单（红线 1 无动态代码通道） ============ */

test("未知钩子名拒绝出厂：仅静态白名单可解析，无 eval 通道", () => {
  expectRejected(
    assembleAmmo(validConfig({ forwardHooks: ["eval('1+1')"] })),
    "UNKNOWN_HOOK_OPERATOR"
  );
  expectRejected(
    assembleAmmo(validConfig({ forwardHooks: ["OnsiteQuoteHook", "GhostHook"] })),
    "UNKNOWN_HOOK_OPERATOR"
  );
  assert.deepEqual(Object.keys(HOOK_OPERATOR_REGISTRY).sort(), [
    "AASplitSettleHook",
    "ArrivalCheckHook",
    "CleaningCheckHook",
    "DepartureFinishHook",
    "OnsiteQuoteHook",
    "PrivacyShieldHook",
  ]);
});

/* ============ 7. 逆向违约阶梯合法性 ============ */

test("逆向违约阶梯越界拦截：退款/扣金比例 ∈ [0,1]、车马费 ≥ 0", () => {
  expectRejected(
    assembleAmmo(
      validConfig({
        cancellationTiers: [
          {
            stage: "ON_SITE",
            demanderRefundRatio: 1.5,
            providerCompensationYuan: 10,
            deductDepositRatio: 0.2,
          },
        ],
      })
    ),
    "CANCELLATION_TIER_INVALID"
  );
  expectRejected(
    assembleAmmo(
      validConfig({
        cancellationTiers: [
          {
            stage: "IN_SERVICE",
            demanderRefundRatio: 0.5,
            providerCompensationYuan: -1,
            deductDepositRatio: 0.2,
          },
        ],
      })
    ),
    "CANCELLATION_TIER_INVALID"
  );
  expectRejected(
    assembleAmmo(
      validConfig({
        cancellationTiers: [
          {
            stage: "AFTER_MATCH_EN_ROUTE",
            demanderRefundRatio: 0.8,
            providerCompensationYuan: 20,
            deductDepositRatio: 1.1,
          },
        ],
      })
    ),
    "CANCELLATION_TIER_INVALID"
  );
});

/* ============ 8. 版本语义与显式装填守卫 ============ */

test("版本语义守卫：version 非 x.y.z 拒绝出厂", () => {
  expectRejected(assembleAmmo(validConfig({ version: "1.0" })), "INVALID_VERSION");
  expectRejected(assembleAmmo(validConfig({ version: "v1.0.0" })), "INVALID_VERSION");
});

test("显式装填守卫：D3 fuzePolicy 缺失拒绝出厂（零防护不允许出厂）", () => {
  const cfg = validConfig();
  delete (cfg as { fuzePolicy?: unknown }).fuzePolicy;
  expectRejected(assembleAmmo(cfg), "MISSING_FUZE_POLICY");
});

/* ============ 9. 动态热注册 ============ */

test("动态热注册：registerDynamicAmmo 后 getAmmoDefinition 即时返回新弹药", () => {
  DYNAMIC_AMMO_POOL.clear();
  const r = registerDynamicAmmo(validConfig());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.registered, true);
  // 池内即出厂原弹（同一对象引用）
  const hit = getAmmoDefinition("上门汽车洗美");
  assert.equal(hit, r.ammo);
  assert.equal(hit.ammoId, "car-wash-v1");
  // ammoId 反查同样命中动态池
  assert.equal(getAmmoById("car-wash-v1").ammoId, "car-wash-v1");
  // 未热注册类目回落官方硬编码弹药（零回归）
  assert.equal(getAmmoDefinition("housekeeping").ammoId, "housekeeping-v1");
  // 审查不过拒绝入池：检索链路回到默认保底
  const bad = registerDynamicAmmo(
    validConfig({
      category: "旁门左道",
      splitRules: { providerRatio: 1, platformRatio: 1, insuranceRatio: 0 },
    })
  );
  assert.equal(bad.ok, false);
  assert.equal(getAmmoDefinition("旁门左道").ammoId, "default-ammo");
});

/* ============ 10. 快照冻结（在途订单热更新免疫） ============ */

test("快照冻结：在途订单基于 ammoSnapshot 调度，免疫线上弹药热更新", async () => {
  DYNAMIC_AMMO_POOL.clear();
  const CATEGORY = "上门汽车洗美";
  // 线上登记 v1（含 OnsiteQuoteHook：未确认增项 BLOCK）
  const v1 = registerDynamicAmmo(validConfig());
  assert.equal(v1.ok, true);
  // 在途订单在 v1 时点冻结整弹快照
  const snapshot = getAmmoDefinition(CATEGORY);

  // 线上热更新 v2（清空正向钩子）——注册表已是新弹药
  const v2 = registerDynamicAmmo(
    validConfig({ ammoId: "car-wash-v2", forwardHooks: [] })
  );
  assert.equal(v2.ok, true);
  assert.equal(getAmmoDefinition(CATEGORY).ammoId, "car-wash-v2");

  // 在途订单 1：携带 v1 快照推进（线上已热更到 v2）→ 仍按 v1 钩子 BLOCK
  // （arrival 已确认 → 放行 ArrivalCheckHook，未确认增项 → OnsiteQuoteHook 拦截）
  const frozenRun = await advanceLifecycle({
    ammo: getAmmoDefinition(CATEGORY),
    ammoSnapshot: snapshot,
    orderId: "snapshot-1",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: {
      arrival: { confirmed: true, at: 1_700_000_000_000 },
      onsiteQuote: { items: ["打蜡"], totalYuan: 300, approved: false },
    },
  });
  assert.equal(frozenRun.ok, false);
  assert.equal(frozenRun.state, "MATCHED");
  assert.match(frozenRun.reason ?? "", /hook-blocked: operator\.onsite-quote/);

  // 在途订单 2：无快照（新订单按线上新弹药语义）→ v2 无钩子放行
  const liveRun = await advanceLifecycle({
    ammo: getAmmoDefinition(CATEGORY),
    orderId: "snapshot-2",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: { onsiteQuote: { items: ["打蜡"], totalYuan: 300, approved: false } },
  });
  assert.equal(liveRun.ok, true);
  assert.equal(liveRun.state, "IN_SERVICE");
});

test("快照透传：钩子上下文可读 ammoSnapshot，执行严格基于快照", async () => {
  const seen: { ammoId?: string; to?: string } = {};
  const spyHook: ISubEventHook = {
    hookId: "snapshot-spy",
    on: { to: "IN_SERVICE" },
    phase: "BEFORE",
    fallback: "SKIP",
    run: (ctx) => {
      seen.ammoId = ctx.ammoSnapshot?.ammoId;
      seen.to = ctx.to;
      return { ok: true };
    },
  };
  const snapshotAmmo: IAmmoDefinition = {
    ammoId: "snap-v9",
    category: "spy",
    version: "9.0.0",
    fiveStateHooks: [spyHook],
    pricingModel: { kind: "FIXED", amountYuan: 1 },
    fuzePolicy: DEFAULT_FUZE_POLICY,
  };
  // ammo 参数故意给无钩子的替身：快照存在时必须执行快照自己的钩子
  const r = await advanceLifecycle({
    ammo: { ...snapshotAmmo, ammoId: "live-stub", fiveStateHooks: [] },
    ammoSnapshot: snapshotAmmo,
    orderId: "spy-1",
    from: "MATCHED",
    to: "IN_SERVICE",
  });
  assert.equal(r.ok, true);
  assert.deepEqual(seen, { ammoId: "snap-v9", to: "IN_SERVICE" });
});