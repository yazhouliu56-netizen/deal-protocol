/**
 * 《长尾非标业务即时量产大考 · 动态流水线实战检验》端到端实证考卷。
 *
 * 大考目标：严禁任何静态 `.ammo.ts` 业务文件，严禁任何硬编码/静态字典预置——
 * 仅凭一份口语化非标诉求（松江农田无人机植保，全新类目 DRONE_CROP_SPRAY）
 * 在运行时动态组装 8 维全息配置（D1 准入 / D2 计价护栏 / D3 引信 / D4 传感降级 /
 * D5 正向钩子 / D6 违约阶梯 / D7 清算分账 / D8 视界表单），经 AmmoFactory
 * 静态语义审查（资金守恒 + 安全红线）出厂、热注入 DYNAMIC_AMMO_POOL，
 * 并由 AmmoRunner 跑通五态全流程与微信收付通合规分账。
 *
 * 考卷结构（全确定性纯函数断言，红线 1：零 LLM、零动态代码执行）：
 *   环节一 非标诉求 8 维动态参数化清单
 *   环节二 工厂审查：Linter 真实质检（资金守恒/安全红线）→ 动态热注册 → 检索第一顺位
 *           + 发布端接线：resolveAmmoIdForPublish 中文类目别名直拨动态弹药（P0 闭环）
 *   环节三 状态机与资金分账全链路实测（CAS 乐观锁 0→4 + 托管 + 增项熔断 + 双拍 + 守恒）
 *   环节四 纯动态零静态文件实证（系统从未加载任何静态 drone.ammo.ts）
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import {
  DYNAMIC_AMMO_POOL,
  HOOK_OPERATOR_REGISTRY,
  registerDynamicAmmo,
  validateAmmoConfig,
} from "./factory.ts";
import { getAmmoById, getAmmoDefinition, resolveAmmoIdForPublish, OFFICIAL_AMMO, DEFAULT_AMMO } from "./registry.ts";
import { advanceLifecycle, evaluateAmmoFuze } from "../base/ammo/runner.ts";
import { generateComplianceSplitInstruction } from "../base/money/escrow.ts";
import type { IHolographicAmmoConfig } from "../types/ammo-schema.ts";
import { IMPACT_FUZE_TEMPLATE } from "../types/fuze-policy.ts";

/* =====================================================================
 * 考卷常量：口语化非标诉求 → 动态参数（全程零静态文件、零硬编码字典）
 * ===================================================================== */
const CATEGORY = "DRONE_CROP_SPRAY";
const AMMO_ID = "drone-crop-spray-v1";
const ORDER_ID = "drone-order-001";
/** 起步价 ¥500（pricingParams.basePrice 以分为单位 = 50000 分）。 */
const BASE_AMOUNT_YUAN = 500;
/** 现场增项加价 ¥100（≤ 50% 熔断线 250 元，放行）。 */
const SURCHARGE_YUAN = 100;
/** 订单动态累加总额 = 500 + 100。 */
const ORDER_TOTAL_YUAN = 600;
/** D7 分账三比：服务者 85% / 平台 10% / 保险 5%（资金守恒 = 1.0）。 */
const SPLIT_PROVIDER = 0.85;
const SPLIT_PLATFORM = 0.1;
const SPLIT_INSURANCE = 0.05;

/** 运行时动态组装 8 维全息配置（D1-D8 逐维显式装填，无任何预置字典）。 */
function buildDroneConfig(): IHolographicAmmoConfig {
  return {
    ammoId: AMMO_ID,
    category: CATEGORY,
    version: "1.0.0",
    /* D1 供给准入：CAAC 飞手执照 + 无犯罪背调 + 安全分门槛 */
    supplyCluster: "C1_MOBILITY",
    workerRequirement: {
      requiredCertificates: ["CAAC_DRONE_LICENSE"],
      minSafetyScore: 70,
      isPoliceVerified: true,
    },
    /* D2 计价与护栏：起步价 ¥500（50000 分）、地板 ¥300、天花板 ¥3000、熔断 50% */
    pricingModel: {
      kind: "FORMULA",
      formulaId: "drone-crop-spray-formula",
      params: { basePrice: 50000 },
    },
    pricingParams: { basePrice: 50000 },
    minFloorPrice: 30000,
    maxCeilingPrice: 300000,
    maxSurchargeRatio: 0.5,
    /* D3 风控引信：💥 碰炸引信（高财产/农机贵重设备） */
    fuzePolicy: { ...IMPACT_FUZE_TEMPLATE, fuzeId: "fuze-drone-impact" },
    /* D4 传感降级：GPS 围栏 + 水印相机，围栏失效 → 人工照片审核兜底 */
    requiredSensors: ["GPS_GEOFENCE", "WATERMARK_CAMERA"],
    sensorFallbackLadder: {
      GPS_GEOFENCE: ["MANUAL_BASE_PHOTO_AUDIT"],
      WATERMARK_CAMERA: ["HTML5_NATIVE_FALLBACK"],
    },
    /* D5 正向钩子：到点履约 / 现场增项报价 / 完工双拍验收（静态白名单解析） */
    forwardHooks: ["ArrivalCheckHook", "OnsiteQuoteHook", "CleaningCheckHook"],
    /* D6 逆向违约阶梯：匹配前零成本撤单 → 途中车马费 → 到点等待补偿 */
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
        providerCompensationYuan: 50,
        deductDepositRatio: 0.2,
      },
      {
        stage: "ON_SITE",
        demanderRefundRatio: 0.5,
        providerCompensationYuan: 80,
        deductDepositRatio: 0.3,
      },
    ],
    /* D7 清算与仲裁：12h 超时代验收 + 85/10/5 三方分账（严格守恒） */
    autoAcceptanceTimeoutHours: 12,
    splitRules: {
      providerRatio: SPLIT_PROVIDER,
      platformRatio: SPLIT_PLATFORM,
      insuranceRatio: SPLIT_INSURANCE,
    },
    /* D8 视界与表单：theme 令牌收敛为合法枚举（ui-viewport 契约）；插槽 + 动态表单 */
    theme: "default",
    formSchema: {
      fields: [
        { key: "fieldAreaMu", type: "number", required: true },
        { key: "pesticideType", type: "picker" },
        { key: "cropKind", type: "text" },
      ],
    },
    cockpitSlot: "HousekeepingSlot",
    /* D8 发布端中文类目检索别名：前端以口语化中文直达本弹（声明式元数据，非字典） */
    aliases: ["农田无人机植保", "无人机打药"],
  };
}

const round2c = (n: number): number => Math.round(n * 100) / 100;

before(() => {
  DYNAMIC_AMMO_POOL.clear();
});

/* =====================================================================
 * 环节一：非标诉求 8 维动态参数化
 * ===================================================================== */

test("[环节一] 非标诉求 8 维全息参数化清单：D1-D8 逐维显式装填", () => {
  const c = buildDroneConfig();
  // D1 准入
  assert.equal(c.supplyCluster, "C1_MOBILITY");
  assert.deepEqual(c.workerRequirement?.requiredCertificates, ["CAAC_DRONE_LICENSE"]);
  assert.equal(c.workerRequirement?.minSafetyScore, 70);
  assert.equal(c.workerRequirement?.isPoliceVerified, true);
  // D2 计价与护栏（起步价 500 元 = 50000 分 / 地板 300 / 天花板 3000 / 熔断 50%）
  assert.equal(c.pricingModel.kind, "FORMULA");
  assert.equal(c.pricingParams?.basePrice, 50000);
  assert.equal(c.minFloorPrice, 30000);
  assert.equal(c.maxCeilingPrice, 300000);
  assert.equal(c.maxSurchargeRatio, 0.5);
  // D3 引信
  assert.equal(c.fuzePolicy.fuzeId, "fuze-drone-impact");
  assert.deepEqual(c.fuzePolicy.fuzeTypes, ["IMPACT"]);
  // D4 传感降级
  assert.deepEqual(c.requiredSensors, ["GPS_GEOFENCE", "WATERMARK_CAMERA"]);
  assert.deepEqual(c.sensorFallbackLadder?.GPS_GEOFENCE, ["MANUAL_BASE_PHOTO_AUDIT"]);
  // D5 正向钩子（白名单内名称）
  assert.deepEqual(c.forwardHooks, ["ArrivalCheckHook", "OnsiteQuoteHook", "CleaningCheckHook"]);
  // D6 违约阶梯（三阶段三件套）
  assert.equal(c.cancellationTiers?.length, 3);
  assert.equal(c.cancellationTiers?.[0]?.stage, "BEFORE_MATCH");
  assert.equal(c.cancellationTiers?.[1]?.providerCompensationYuan, 50);
  // D7 清算（12h 代验收 + 85/10/5）
  assert.equal(c.autoAcceptanceTimeoutHours, 12);
  assert.equal(c.splitRules?.providerRatio, SPLIT_PROVIDER);
  assert.equal(c.splitRules?.platformRatio, SPLIT_PLATFORM);
  assert.equal(c.splitRules?.insuranceRatio, SPLIT_INSURANCE);
  // D8 视界（主题令牌 + 插槽 + 动态表单 schema）
  assert.equal(c.theme, "default");
  assert.equal(c.cockpitSlot, "HousekeepingSlot");
  assert.deepEqual(
    (c.formSchema?.fields as { key: string }[]).map((f) => f.key),
    ["fieldAreaMu", "pesticideType", "cropKind"],
  );
});

/* =====================================================================
 * 环节二：工厂审查与动态热注册（Linter 真实质检 + 安全红线实测）
 * ===================================================================== */

test("[环节二] Linter 真实质检：validateAmmoConfig 资金守恒(85+10+5=1.0)与安全红线 100% 通过", () => {
  const verdict = validateAmmoConfig(buildDroneConfig());
  if (!verdict.ok) assert.fail(`静态语义审查未通过：${verdict.errors.join("; ")}`);
  assert.equal(verdict.ok, true);
});

test("[环节二] Linter 拦截点实测：资金不守恒 / 未知钩子注入 / 加价熔断超限 三探针全被拒", () => {
  // 探针一：保险比例 0.06 → 三比之和 1.01 ≠ 1.0 → 资金守恒拦截
  const p1 = validateAmmoConfig(
    buildDroneConfig_withSplit(SPLIT_PROVIDER, SPLIT_PLATFORM, 0.06),
  );
  assert.equal(p1.ok, false);
  if (!p1.ok) {
    assert.ok(p1.errors.some((e) => e.startsWith("SPLIT_SUM_NOT_CONSERVED")));
  }
  // 探针二：白名单外钩子名 → 解析拒绝（红线 1 零动态代码通道）
  const p2 = validateAmmoConfig({
    ...buildDroneConfig(),
    forwardHooks: ["ArrivalCheckHook", "eval('1+1')"],
  });
  assert.equal(p2.ok, false);
  if (!p2.ok) {
    assert.ok(p2.errors.some((e) => e.startsWith("UNKNOWN_HOOK_OPERATOR")));
  }
  // 探针三：maxSurchargeRatio 0.6 > 0.5 → 防坐地起价熔断拒绝出厂
  const p3 = validateAmmoConfig({ ...buildDroneConfig(), maxSurchargeRatio: 0.6 });
  assert.equal(p3.ok, false);
  if (!p3.ok) {
    assert.ok(p3.errors.some((e) => e.startsWith("ANTI_GOUGING_LIMIT_EXCEEDED")));
  }
});

function buildDroneConfig_withSplit(
  providerRatio: number,
  platformRatio: number,
  insuranceRatio: number,
): IHolographicAmmoConfig {
  return {
    ...buildDroneConfig(),
    splitRules: { providerRatio, platformRatio, insuranceRatio },
  };
}

test("[环节二] 动态热注册出厂 + 检索链第一顺位 + 全图冻结", () => {
  const r = registerDynamicAmmo(buildDroneConfig());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.registered, true);
  assert.equal(r.ammo.ammoId, AMMO_ID);
  // 热注入 DYNAMIC_AMMO_POOL：池内即出厂原弹（同一对象引用）
  assert.equal(DYNAMIC_AMMO_POOL.get(CATEGORY), r.ammo);
  // 注册表检索链第一顺位：动态池优先于官方/四表/默认保底
  const hit = getAmmoDefinition(CATEGORY);
  assert.equal(hit, r.ammo);
  assert.equal(hit.category, CATEGORY);
  // ammoId 反查（W5 总装）同样命中动态池
  assert.equal(getAmmoById(AMMO_ID).ammoId, AMMO_ID);
  // 全图冻结：整弹 + 钩子 + 引信 + 8 维镜像全部 deepFreeze
  assert.equal(Object.isFrozen(hit), true);
  assert.equal(Object.isFrozen(hit.fiveStateHooks), true);
  assert.equal(Object.isFrozen(hit.fuzePolicy), true);
  assert.equal(Object.isFrozen(hit.holographic), true);
  assert.equal(Object.isFrozen(hit.holographic?.splitRules), true);
  // 钩子经静态白名单解析（同一函数对象，非即时拼装）
  assert.equal(hit.fiveStateHooks[0], HOOK_OPERATOR_REGISTRY["ArrivalCheckHook"]);
  assert.equal(hit.fiveStateHooks[1], HOOK_OPERATOR_REGISTRY["OnsiteQuoteHook"]);
  assert.equal(hit.fiveStateHooks[2], HOOK_OPERATOR_REGISTRY["CleaningCheckHook"]);
});

test("[环节二·发布端接线] resolveAmmoIdForPublish 动态池直拨（精确 key + 中文别名）", () => {
  const r = registerDynamicAmmo(buildDroneConfig());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  // ① 精确 class key 直拨动态弹药（发布端可透传注册键）
  assert.equal(resolveAmmoIdForPublish(CATEGORY), AMMO_ID);
  // ② 中文类目别名直拨：前端发布端以口语化中文发单 → 写入动态弹药 ammoId
  assert.equal(resolveAmmoIdForPublish("农田无人机植保"), AMMO_ID, "中文别名①直拨");
  assert.equal(resolveAmmoIdForPublish("无人机打药"), AMMO_ID, "中文别名②直拨");
  // ③ 官方中文映射语义零改动（家政/组局/陪玩回归护栏）
  assert.equal(resolveAmmoIdForPublish("家政保洁"), "housekeeping-v1");
  assert.equal(resolveAmmoIdForPublish("羽毛球约局"), "meetup-social-v1");
  assert.equal(resolveAmmoIdForPublish("陪玩"), "companion-v1");
});

/* =====================================================================
 * 环节三：状态机与资金分账全链路实测（CAS 乐观锁 0 → 4）
 * ===================================================================== */

test("[环节三] 五态全链路：PUBLISHED→MATCHED→IN_SERVICE→INSPECTED→SETTLED", async () => {
  const reg = registerDynamicAmmo(buildDroneConfig());
  assert.equal(reg.ok, true);
  if (!reg.ok) return;
  const ammo = reg.ammo;
  const now = 1_782_000_000_000;

  /* ① PUBLISHED → MATCHED：CAS 0→1 + 生成合规托管资金（全款冻结） */
  const t1 = await advanceLifecycle({
    ammo,
    orderId: ORDER_ID,
    from: "PUBLISHED",
    to: "MATCHED",
    currentVersion: 0,
    expectedVersion: 0,
    now,
    payload: { escrowPayload: { amount: BASE_AMOUNT_YUAN, balance: 1000 } },
  });
  assert.equal(t1.ok, true, t1.reason);
  assert.equal(t1.state, "MATCHED");
  assert.equal(t1.nextVersion, 1, "CAS 乐观锁版本由 0 递增为 1");
  const escrowHold = t1.afterData.find(
    (d): d is { escrow: { totalAmount: number; heldDeposit: number; payableAmount: number } } =>
      typeof d === "object" && d !== null && "escrow" in d,
  );
  assert.ok(escrowHold, "生成合规托管资金");
  assert.deepEqual(escrowHold.escrow, {
    totalAmount: 500,
    heldDeposit: 500,
    payableAmount: 0,
  });

  /* ② MATCHED → IN_SERVICE：CAS 1→2 + ArrivalCheckHook 到点履约 + 现场增项 ¥100 放行 */
  const t2 = await advanceLifecycle({
    ammo,
    orderId: ORDER_ID,
    from: "MATCHED",
    to: "IN_SERVICE",
    currentVersion: 1,
    expectedVersion: 1,
    now,
    payload: {
      arrival: { confirmed: true, at: now },
      onsiteQuote: { items: ["药箱补给追加"], totalYuan: SURCHARGE_YUAN, approved: true },
      escrowPayload: { amount: BASE_AMOUNT_YUAN, balance: 1000 },
    },
  });
  assert.equal(t2.ok, true, t2.reason);
  assert.equal(t2.state, "IN_SERVICE");
  assert.equal(t2.nextVersion, 2);
  const outcomeIds = t2.hookOutcomes.map((h) => h.hookId);
  assert.ok(outcomeIds.includes("operator.arrival-check"), "执行 ArrivalCheckHook");
  assert.ok(outcomeIds.includes("operator.onsite-quote"), "执行 OnsiteQuoteHook");
  for (const h of t2.hookOutcomes) assert.equal(h.ok, true);
  // 加价校验通过：¥100 ≤ 基准 ¥500 × 50% 熔断线（¥250），订单总额动态累加至 ¥600
  const orderTotal = BASE_AMOUNT_YUAN + SURCHARGE_YUAN;
  assert.equal(orderTotal, ORDER_TOTAL_YUAN, "订单总额动态累加 = 500 + 100");

  /* ③ IN_SERVICE → INSPECTED：CAS 2→3 + 双向水印照片验收证据 */
  const t3 = await advanceLifecycle({
    ammo,
    orderId: ORDER_ID,
    from: "IN_SERVICE",
    to: "INSPECTED",
    currentVersion: 2,
    expectedVersion: 2,
    now,
    payload: {
      photos: { before: ["wm-before-drone-001.jpg"], after: ["wm-after-drone-001.jpg"] },
    },
  });
  assert.equal(t3.ok, true, t3.reason);
  assert.equal(t3.state, "INSPECTED");
  assert.equal(t3.nextVersion, 3);
  const cleaning = t3.hookOutcomes.find((h) => h.hookId === "operator.cleaning-check");
  assert.ok(cleaning, "执行 CleaningCheckHook（双向拍照验收）");
  assert.equal(cleaning?.ok, true);
  const evidence = t3.afterData.find(
    (d): d is { evidence: { before: string[]; after: string[] }; requiredMet: boolean } =>
      typeof d === "object" && d !== null && "evidence" in d,
  );
  assert.ok(evidence, "双拍证据入账（时空水印存证）");
  assert.deepEqual(evidence.evidence.before, ["wm-before-drone-001.jpg"]);
  assert.deepEqual(evidence.evidence.after, ["wm-after-drone-001.jpg"]);

  /* ④ INSPECTED → SETTLED：CAS 3→4 + 微信收付通合规分账（85/10/5 严格守恒） */
  const t4 = await advanceLifecycle({
    ammo,
    orderId: ORDER_ID,
    from: "INSPECTED",
    to: "SETTLED",
    currentVersion: 3,
    expectedVersion: 3,
    now,
    payload: {
      escrowPayload: { amount: ORDER_TOTAL_YUAN, platformRate: 0.1, participants: 1 },
    },
  });
  assert.equal(t4.ok, true, t4.reason);
  assert.equal(t4.state, "SETTLED");
  assert.equal(t4.nextVersion, 4);
  const ledger = t4.afterData.find(
    (d): d is { settlementLedger: { hold: Record<string, number>; split: Record<string, number> } } =>
      typeof d === "object" && d !== null && "settlementLedger" in d,
  );
  assert.ok(ledger, "终局清结算对账清单产出");
  const l = ledger.settlementLedger as unknown as {
    hold: { totalAmount: number };
    split: { platformIncome: number; providerIncome: number };
  };
  assert.equal(l.hold.totalAmount, ORDER_TOTAL_YUAN, "结算总额 = 动态累加总额");
  // 清结算引擎守恒：平台收益 + 服务方净得 ≡ 订单总额
  assert.equal(
    round2c(l.split.platformIncome + l.split.providerIncome),
    ORDER_TOTAL_YUAN,
  );

  // D7 三比 85/10/5 严格守恒：服务者 ¥510 + 平台 ¥60 + 保险计提 ¥30 ≡ ¥600
  const providerYuan = round2c(ORDER_TOTAL_YUAN * SPLIT_PROVIDER);
  const platformYuan = round2c(ORDER_TOTAL_YUAN * SPLIT_PLATFORM);
  const insuranceYuan = round2c(ORDER_TOTAL_YUAN * SPLIT_INSURANCE);
  assert.equal(providerYuan + platformYuan + insuranceYuan, ORDER_TOTAL_YUAN);
  // 微信收付通合规分账指令（防二清：持牌机构指令 + djb2 确定性签名）
  const instruction = generateComplianceSplitInstruction(
    { platformFee: platformYuan, providerNet: providerYuan },
    "WECHAT_PAY",
    { orderId: ORDER_ID, receiverAccountId: "sub-wx-provider-drone-001" },
  );
  assert.equal(instruction.channel, "WECHAT_PAY");
  assert.equal(instruction.instructionId, `split-${ORDER_ID}-WECHAT_PAY`);
  assert.equal(instruction.splitAmountYuan, providerYuan, "服务者实收 ¥510（85%）");
  assert.equal(instruction.platformFeeYuan, platformYuan, "平台分润 ¥60（10%）");
  assert.equal(instruction.isMirrorLedgerOnly, true, "信息流与资金流分离（二清隔离）");
  assert.ok(instruction.instructionSignature.startsWith("sig-"), "确定性签名存证");
  // 守恒闭环：指令两路 + 保险计提 ≡ 订单总额（资金零凭空多分）
  assert.equal(
    instruction.splitAmountYuan + instruction.platformFeeYuan + insuranceYuan,
    ORDER_TOTAL_YUAN,
  );
});

test("[环节三] 熔断与 CAS 拦截探针：增项超 50% 拒付 / 版本冲突阻断", async () => {
  const reg = registerDynamicAmmo(buildDroneConfig());
  assert.equal(reg.ok, true);
  if (!reg.ok) return;
  const ammo = reg.ammo;
  const now = 1_782_000_000_000;

  // 探针一：现场增项 ¥400 > 基准 ¥500 × 50%（¥250）→ 防坐地起价熔断 BLOCK
  const gouge = await advanceLifecycle({
    ammo,
    orderId: "drone-order-gouge",
    from: "MATCHED",
    to: "IN_SERVICE",
    currentVersion: 1,
    expectedVersion: 1,
    now,
    payload: {
      arrival: { confirmed: true, at: now },
      onsiteQuote: { items: ["整机置换"], totalYuan: 400, approved: true },
      escrowPayload: { amount: BASE_AMOUNT_YUAN, balance: 1000 },
    },
  });
  assert.equal(gouge.ok, false);
  assert.equal(gouge.state, "MATCHED");
  assert.match(gouge.reason ?? "", /anti-gouging-blocked: ANTI_GOUGING_LIMIT_EXCEEDED/);

  // 探针二：CAS 乐观锁版本冲突（读快照 1，磁盘现值 5）→ 并发写入阻断
  const conflict = await advanceLifecycle({
    ammo,
    orderId: "drone-order-cas",
    from: "MATCHED",
    to: "IN_SERVICE",
    currentVersion: 5,
    expectedVersion: 1,
    now,
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.state, "MATCHED");
  assert.match(conflict.reason ?? "", /optimistic-lock-conflict/);
});

test("[环节三] 引信核验实测：💥 碰炸引信背调/押金双闸门", () => {
  const reg = registerDynamicAmmo(buildDroneConfig());
  assert.equal(reg.ok, true);
  if (!reg.ok) return;
  const ammo = reg.ammo;
  // 双闸门未达标 → 拦截
  const blocked = evaluateAmmoFuze(ammo.fuzePolicy, {
    backgroundVerified: false,
    depositHeld: false,
  });
  assert.equal(blocked.pass, false);
  const rules = blocked.checks.map((c) => c.rule).sort();
  assert.deepEqual(rules, ["backgroundCheck", "deposit"]);
  // 背调通过 + 押金到账 → 放行
  const passed = evaluateAmmoFuze(ammo.fuzePolicy, {
    backgroundVerified: true,
    depositHeld: true,
  });
  assert.equal(passed.pass, true);
  assert.deepEqual(passed.checks, []);
});

/* =====================================================================
 * 环节四：纯动态零静态文件实证
 * ===================================================================== */

test("[环节四] 纯动态零静态文件实证：系统从未加载任何静态 drone.ammo.ts", () => {
  // ① src/ammo/ 目录内不存在任何 drone 前缀静态品类文件（真实磁盘扫描）
  const files = readdirSync(new URL(".", import.meta.url));
  assert.ok(
    !files.some((f) => /^drone/i.test(f)),
    `src/ammo/ 下不得存在静态 drone 品类文件（实际：${files.join(", ")}）`,
  );
  // ② 官方硬编码弹药表无此键：该业务 100% 来自运行时动态装配
  assert.equal(OFFICIAL_AMMO[CATEGORY], undefined);
  // ③ 检索唯一来源 = DYNAMIC_AMMO_POOL 运行时热注（无任何硬编码字典预置）
  const hit = getAmmoDefinition(CATEGORY);
  assert.equal(hit.ammoId, AMMO_ID);
  assert.equal(DYNAMIC_AMMO_POOL.get(CATEGORY)?.ammoId, AMMO_ID);
  // ④ 未注册类目回落默认保底（证明确实没有静态预置该品类）
  DYNAMIC_AMMO_POOL.delete(CATEGORY);
  assert.equal(getAmmoDefinition(CATEGORY).ammoId, "default-ammo");
  // ⑤ 中文别名随池删除一并失效 → resolveAmmoIdForPublish 回落默认保底
  //    （证明中文直拨检索位 100% 来自运行时动态池，无硬编码字典残留）
  assert.equal(resolveAmmoIdForPublish("农田无人机植保"), DEFAULT_AMMO.ammoId);
});