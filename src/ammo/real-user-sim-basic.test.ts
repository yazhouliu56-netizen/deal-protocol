/**
 * 《阶段 1 拟人全链路大考 · 基础防线实测考卷（引擎域）》
 *
 * 考卷目标（红线 1：零 LLM、零动态代码执行、全确定性纯函数断言）：
 *   以一句口语化拟人诉求「我需要10点来人打扫房间」为输入，真实调用项目
 *   既有引擎链路完成 8 大环节实测，寻找潜在死胡同与断线点。
 *
 * 环节分布（本文件 = 引擎/纯函数域；Store 域因 useWaveStore 走 @/ 别名 +
 * jsdom，按 vitest.config exclude（src/base、src/ammo）分域执行，见
 * `src/components/waves/real-user-sim-store.test.tsx` 姊妹考卷）：
 *   A. 意图解析与弹药匹配：mockDecompose / mockVoiceIntent / MockEngine
 *      三重真实解析 + 中文口语 → 官方标杆弹药 housekeeping-v1 直拨。
 *   B. 草稿卡感知数据源：HOURLY 60 × 2h 起步价 ¥120.00（12000 分）+ 💥 碰炸
 *      引信徽标（🛡️已投保财产险 / 🔒定金托管 20%）。
 *   C. 拍照验收与现场增项：SHA-256 存证哈希（forgery.sha256Hex 真实调用）+
 *      引擎算子 CleaningCheckHook/OnsiteQuoteHook + 领域富钩子直测
 *      （AIGC 伪图 CRITICAL 阻断 = AIGC_PHOTO_FORGERY_DETECTED）。
 *   D. 结算分账：SETTLED 引擎对账清单守恒 + D7 三比 85/10/5
 *      （¥144.50 / ¥17.00 / ¥8.50 ≡ ¥170）+ 微信收付通合规分账指令
 *      （generateComplianceSplitInstruction，防二清镜像）。
 *   E. 守护扫描：库内不得存在模块级可变资金/弹药声明（let 红线）。
 *   F. 时长执行窗口与拟人实测报告（≤15s）。
 *
 * 严守资金守恒：所有分账断言 round2c（分/元双单位），三路合计 ≡ 订单总额。
 * 全部代码不缩短、不省略，供指挥部逐行把脉。
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  getAmmoById,
  getAmmoDefinition,
  resolveAmmoIdForPublish,
  OFFICIAL_AMMO,
  CATEGORY_TO_OFFICIAL,
} from "./registry.ts";
import {
  housekeepingAmmo,
  onsiteQuoteHook,
  cleaningCheckHook,
  HOUSEKEEPING_EVIDENCE,
} from "./housekeeping.ammo.ts";
import {
  advanceLifecycle,
  toAtomicFiveState,
  buildSettlementLedger,
  evaluateAmmoFuze,
} from "../base/ammo/runner.ts";
import {
  calculateEscrowHold,
  generateComplianceSplitInstruction,
} from "../base/money/escrow.ts";
import { mockDecompose, normalizeModules } from "../base/ai/decompose.ts";
import { mockVoiceIntent, describeIntent } from "../base/ai/voice/voiceIntent.ts";
import { MockEngine } from "../base/ai/chat/mockEngine.ts";
import { sha256Hex } from "../base/ai/forgery.ts";

/* =====================================================================
 * 考卷常量（全部来自既有弹药/计价/护栏表，无任何新造语义）
 * ===================================================================== */

/** 拟人诉求（Phase 1 标准输入）。 */
const CONSUMER_PHRASE = "我需要10点来人打扫房间";
/** 口语「打扫」→ 官方弹药 housekeeping-v1 的中文类目换算键。 */
const DIALECT_KEY = "打扫";
/** 成功卡「服务」字段落库的中文类目（MockEngine label 语义）。 */
const WAVE_CATEGORY = "家政保洁";
/** MockEngine 时间槽卡选中值（既有槽卡 label「周日 10:00」）。 */
const WAVE_TIME = "周日 10:00";

/** 起步价：¥60/小时 × 2 小时起 = ¥120 = 12000 分（与 D2 地板价 12000 同口径）。 */
const BASE_YUAN = 120;
const BASE_FEN = BASE_YUAN * 100;
/** 现场增项（客厅重污深度清洁）¥50 ≤ 熔断线 ¥60（= 120 × 0.5）。 */
const SURCHARGE_YUAN = 50;
const TOTAL_YUAN = BASE_YUAN + SURCHARGE_YUAN;
/** D7 分账三比：服务者 85% / 平台 10% / 保险 5%（严格守恒 = 1.0）。 */
const SPLIT_PROVIDER = 0.85;
const SPLIT_PLATFORM = 0.1;
const SPLIT_INSURANCE = 0.05;

const ORDER_ID = "hk-sim-basic-001";
/** 供给端真实种子响应者（mockResponders.ts）——任务书预写的「陈阿姨」经
 *  真库校验实为「王姐」（id=mock-clean-wang，家政保洁，信用 5 星级）。 */
const PROVIDER_ID = "mock-clean-wang";

const round2c = (n: number): number => Math.round(n * 100) / 100;

/* =====================================================================
 * 环节 F 计时窗口（整卷执行时长红线）与守护句柄
 * ===================================================================== */
let t0 = 0;

before(() => {
  t0 = Date.now();
});

after(() => {
  // 守护句柄：模拟器/考卷进程退出位（与真实运行器同款生命周期钩子）。
  process.removeListener("SIGINT", () => {});
});

/* =====================================================================
 * 环节 A：意图解析与弹药匹配（三重真实解析器 + 弹药直拨）
 * ===================================================================== */

test("[环节A1] 注册表加载护栏：housekeeping-v1 官方弹药出厂完整性", () => {
  assert.equal(OFFICIAL_AMMO["housekeeping"], housekeepingAmmo, "官方表直挂出厂弹药");
  assert.equal(housekeepingAmmo.ammoId, "housekeeping-v1");
  assert.equal(housekeepingAmmo.category, "housekeeping");
  // 中文口语换算键直达官方弹药（W1 总装：发布弹层中文发单）
  assert.equal(CATEGORY_TO_OFFICIAL[DIALECT_KEY], "housekeeping");
  assert.equal(CATEGORY_TO_OFFICIAL[WAVE_CATEGORY], "housekeeping");
  assert.equal(resolveAmmoIdForPublish(DIALECT_KEY), "housekeeping-v1");
  assert.equal(resolveAmmoIdForPublish(WAVE_CATEGORY), "housekeeping-v1");
  // 反查检索链（W5 总装）：ammoId → 整弹（履约座舱装载钩子）
  assert.equal(getAmmoById("housekeeping-v1"), housekeepingAmmo);
  assert.equal(getAmmoDefinition("housekeeping"), housekeepingAmmo);
});

test("[环节A2] mockDecompose 真实调用：口语诉求拆解为独立交付模块", () => {
  // 上门服务语义命中（on-site 拆法：到场服务 + 交付验收，权重 60/40）
  const modules = mockDecompose({
    category: "打扫",
    note: CONSUMER_PHRASE,
    budget: BASE_YUAN,
  });
  assert.equal(modules.length, 2);
  assert.equal(modules[0].name, "到场服务");
  assert.equal(modules[1].name, "交付验收");
  assert.equal(modules[0].weight + modules[1].weight, 100);
  const validated = normalizeModules(modules);
  assert.equal(validated.ok, true);
  if (validated.ok) {
    assert.equal(validated.modules.length, 2);
  }
});

test("[环节A3] mockVoiceIntent 真实调用：品类识别 + 标准格式时间可提取；口语「10点/打扫」断线点实证", () => {
  // ① 口语诉求（无预算词）→ 如实降级 chat（真实行为，非修复对象）
  const degraded = mockVoiceIntent(CONSUMER_PHRASE);
  assert.equal(degraded.kind, "chat", "缺预算词 → 意图层降级 chat（真实断线点日志）");
  // ② 断线点实证：publishHit 发布关键词表仅含「保洁」不含「打扫」——
  // 即便补足预算词，「明天 10:00 找人打扫房间」仍降级 chat（口径不一致）；
  // mockEngine 品类词表（/保洁|家政|打扫|整理|收纳/）则含「打扫」。
  assert.equal(
    mockVoiceIntent("明天 10:00 找人打扫房间，预算 150 元").kind,
    "chat",
    "打扫不在意图层发布关键词表 → 真实断线点（与引擎词表口径差异）",
  );
  // ③ 标准格式（冒号数字时间 + 预算词 + 表内关键词「保洁」）→ 完整识别
  const parsed = mockVoiceIntent("明天 10:00 找人做保洁，预算 150 元");
  assert.equal(parsed.kind, "publish-wave");
  if (parsed.kind === "publish-wave") {
    assert.equal(parsed.wave.category, "保洁", "品类识别：保洁 → 保洁");
    assert.match(parsed.wave.time, /10:00/, "标准格式时间提取成功（明天 10:00）");
    assert.equal(parsed.wave.budget, 150);
    assert.equal(parsed.wave.capacity, 1);
    // 播报文案走既有 L2 描述器（ChatPage handleVoiceText 同款）
    assert.match(describeIntent(parsed), /保洁/);
    assert.match(describeIntent(parsed), /10:00/);
  }
});

test("[环节A4] MockEngine 真实调用：口语诉求首轮识别家政品类并追问时间（「10点」未入词表）", async () => {
  const engine = new MockEngine({
    getChatMessages: () => [],
    isWorkerOnline: () => true,
  });
  const texts: string[] = [];
  for await (const ev of engine.send(CONSUMER_PHRASE)) {
    if (ev.type === "text") texts.push(ev.delta);
    if (ev.type === "card") texts.push("[card]");
  }
  const first = texts.join("");
  // 家政品类唯一专属追问：「希望什么时间上门」→ 品类已命中 housekeeping
  assert.match(first, /希望什么时间上门/);
  // 断线点实证：「10点来人」不在时间词表（今天/明天/周X/上午/下午/晚）→ 未抽取
  assert.doesNotMatch(first, /10:00/);

  // ② 按词表口径补采「明天上午」→ 时间槽识别成功 → 追问频率
  const second: string[] = [];
  for await (const ev of engine.send("明天上午")) {
    if (ev.type === "text") second.push(ev.delta);
  }
  assert.match(second.join(""), /需要单次保洁/);
});

test("[环节A5] 弹药定价与默认时长：HOURLY 60×2h → 起步价 ¥120.00 = 12000 分", () => {
  const ammo = getAmmoDefinition("housekeeping");
  assert.deepEqual(ammo.pricingModel, { kind: "HOURLY", rateYuan: 60, minHours: 2 });
  const startYuan = round2c(
    ammo.pricingModel.kind === "HOURLY"
      ? ammo.pricingModel.rateYuan * ammo.pricingModel.minHours
      : 0,
  );
  assert.equal(startYuan, BASE_YUAN);
  assert.equal(startYuan.toFixed(2), "120.00");
  assert.equal(startYuan * 100, BASE_FEN);
  // D2 护栏同口径：地板价 12000 分（全息镜像断言）
  assert.equal(ammo.holographic?.minFloorPrice, BASE_FEN);
  assert.equal(ammo.holographic?.maxSurchargeRatio, 0.5);
});

/* =====================================================================
 * 环节 B：草稿卡感知数据源（定价卡面 + 安全徽标投影字段）
 * ===================================================================== */

test("[环节B1] 草稿卡卡面价格与徽标数据源：💥 碰炸引信投影", () => {
  const ammo = getAmmoDefinition("housekeeping");
  assert.deepEqual(ammo.fuzePolicy.fuzeTypes, ["IMPACT"], "💥 碰炸引信");
  // 🛡️ 已投保财产险（草稿卡徽标「🛡️已投保财产险」渲染条件）
  assert.equal(ammo.fuzePolicy.propertyInsurance, true);
  // 🔒 定金托管 20%（草稿卡徽标「🔒定金托管 20%」渲染条件）
  assert.deepEqual(ammo.fuzePolicy.deposit, { strategy: "RATIO", ratio: 0.2 });
  // 实测差异如实记录：IMPACT 模板未开预付冻结/LBS 围栏 → 家政草稿卡实测
  // 徽标为 🛡️+🔒 两枚（任务书预想含 📍 围栏徽标；📍/⏳ 属 DELAY 引信模板，
  // 见 meetup-social-v1 —— 由弹药既有元数据决定，不属本考卷修复范围）。
  assert.equal(ammo.fuzePolicy.advanceFreeze.enabled, false);
  assert.equal(ammo.fuzePolicy.geoFence.enabled, false);
  // 卡面定金字段：SOP 定金率与引信 RATIO 一致（草稿卡「定金 20%」同口径）
  assert.equal(ammo.sop?.depositRate, 0.2);
  // D8 座舱插槽声明（Store 域考卷据此断言 HousekeepingSlot 装载）
  assert.equal(ammo.holographic?.cockpitSlot, "HousekeepingSlot");
});

test("[环节B2] 引信核验闸门：背调/押金双闸（IMPACT 主武器）", () => {
  const ammo = getAmmoDefinition("housekeeping");
  const blocked = evaluateAmmoFuze(ammo.fuzePolicy, { backgroundVerified: false });
  assert.equal(blocked.pass, false);
  assert.deepEqual(
    blocked.checks.map((c) => c.rule).sort(),
    ["backgroundCheck", "deposit"],
  );
  const passed = evaluateAmmoFuze(ammo.fuzePolicy, {
    backgroundVerified: true,
    depositHeld: true,
  });
  assert.equal(passed.pass, true);
  assert.deepEqual(passed.checks, []);
});

/* =====================================================================
 * 环节 C：拍照验收（SHA-256 存证）+ 现场增项（先干后说价拦截）
 * ===================================================================== */

test("[环节C1] SHA-256 存证哈希：forgery.sha256Hex 真实调用（确定性 64 位 hex）", () => {
  const PHOTO_BEFORE = "wm-before-hk-001";
  const PHOTO_AFTER = "wm-after-hk-001";
  const h1 = sha256Hex(PHOTO_BEFORE);
  const h2 = sha256Hex(PHOTO_AFTER);
  assert.match(h1, /^[0-9a-f]{64}$/, "SHA-256 输出 64 位十六进制");
  assert.match(h2, /^[0-9a-f]{64}$/);
  assert.notEqual(h1, h2, "不同照片哈希互异");
  assert.equal(sha256Hex(PHOTO_BEFORE), h1, "确定性：同输入同输出");
});

test("[环节C2] 引擎双拍验收：CleaningCheckHook 算子放行 + 证据入账（含哈希存证）", async () => {
  const ammo = getAmmoById("housekeeping-v1");
  const now = 1_783_100_000_000;
  const beforeHash = sha256Hex("wm-before-hk-001");
  const afterHash = sha256Hex("wm-after-hk-001");

  /* ① MATCHED → IN_SERVICE：到点履约 + 现场增项 ¥50（≤ 熔断线 ¥60）放行 */
  const t1 = await advanceLifecycle({
    ammo,
    orderId: ORDER_ID,
    from: "MATCHED",
    to: "IN_SERVICE",
    currentVersion: 0,
    expectedVersion: 0,
    now,
    payload: {
      arrival: { confirmed: true, at: now },
      onsiteQuote: { items: ["客厅重污深度清洁"], totalYuan: SURCHARGE_YUAN, approved: true },
      escrowPayload: { amount: BASE_YUAN, balance: 1000 },
    },
  });
  assert.equal(t1.ok, true, t1.reason);
  assert.equal(t1.state, "IN_SERVICE");
  assert.equal(t1.nextVersion, 1);
  const quoteOutcome = t1.hookOutcomes.find((h) => h.hookId === "operator.onsite-quote");
  assert.ok(quoteOutcome, "执行 OnsiteQuoteHook");
  assert.equal(quoteOutcome?.ok, true);
  // 订单总额动态累加：120 + 50 = 170（与 FulfillmentCenter orderTotal 同式）
  assert.equal(BASE_YUAN + SURCHARGE_YUAN, TOTAL_YUAN);

  /* ② IN_SERVICE → INSPECTED：双拍照片 + SHA-256 哈希存证 → 放行 */
  const t2 = await advanceLifecycle({
    ammo,
    orderId: ORDER_ID,
    from: "IN_SERVICE",
    to: "INSPECTED",
    currentVersion: 1,
    expectedVersion: 1,
    now,
    payload: {
      photos: {
        before: [`wm-before-hk-001|${beforeHash}`],
        after: [`wm-after-hk-001|${afterHash}`],
      },
    },
  });
  assert.equal(t2.ok, true, t2.reason);
  assert.equal(t2.state, "INSPECTED");
  const cleaning = t2.hookOutcomes.find((h) => h.hookId === "operator.cleaning-check");
  assert.ok(cleaning, "执行 CleaningCheckHook（双拍验收）");
  assert.equal(cleaning?.ok, true);
  const evidence = t2.afterData.find(
    (d): d is { evidence: { before: string[]; after: string[] } } =>
      typeof d === "object" && d !== null && "evidence" in d,
  );
  assert.ok(evidence, "双拍证据入账（afterData.evidence）");
  assert.deepEqual(evidence.evidence.before, [`wm-before-hk-001|${beforeHash}`]);
  assert.deepEqual(evidence.evidence.after, [`wm-after-hk-001|${afterHash}`]);

  /* ③ 引擎语义如实记录：算子 AFTER+SKIP —— 无照片不阻断跃迁（断线点日志） */
  const t3 = await advanceLifecycle({
    ammo,
    orderId: ORDER_ID,
    from: "MATCHED",
    to: "IN_SERVICE",
    currentVersion: 0,
    expectedVersion: 0,
    now,
    payload: { arrival: { confirmed: true, at: now } },
  });
  assert.equal(
    t3.ok,
    true,
    "无照片场景引擎仍放行（SKIP 降级语义；任务书预期为必填——如实记录差距）",
  );
});

test("[环节C3] 领域富钩子直测：AIGC 伪图 CRITICAL 阻断（AIGC_PHOTO_FORGERY_DETECTED）", () => {
  const base = {
    ammoId: "housekeeping-v1",
    orderId: ORDER_ID,
    from: "IN_SERVICE" as const,
    to: "INSPECTED" as const,
  };
  // ① 照片齐全 + 无鉴真载荷 → 放行（证据契约透传）
  const ok = cleaningCheckHook.run({
    ...base,
    payload: { photos: { before: ["wm-before-hk-001"], after: ["wm-after-hk-001"] } },
  });
  assert.equal(ok.ok, true);
  const data = ok.data as {
    evidence: { before: string[]; after: string[] };
    requiredMet: boolean;
    contract: typeof HOUSEKEEPING_EVIDENCE;
  };
  assert.equal(data.requiredMet, true);
  assert.deepEqual(data.evidence.before, ["wm-before-hk-001"]);
  assert.equal(data.contract.beforePhoto.required, true, "前后照片必填契约");
  assert.equal(data.contract.beforePhoto.maxCount, 5);
  // ② photoVerify CRITICAL → 阻断验收（鉴真红线，L3-M4 深度鉴真接入）
  const forged = cleaningCheckHook.run({
    ...base,
    payload: {
      photos: { before: ["wm-before-hk-001"], after: ["wm-after-hk-001"] },
      photoVerify: { riskLevel: "CRITICAL", overallConfidence: 0.99, summaryDiagnosis: "AI生成图" },
    },
  });
  assert.equal(forged.ok, false);
  assert.match(forged.reason ?? "", /AIGC_PHOTO_FORGERY_DETECTED/);
  // ③ 低危鉴真载荷 → 放行 + forgery 附档留痕
  const soft = cleaningCheckHook.run({
    ...base,
    payload: {
      photos: { before: ["wm-before-hk-001"], after: ["wm-after-hk-001"] },
      photoVerify: { riskLevel: "LOW", overallConfidence: 0.4 },
    },
  });
  assert.equal(soft.ok, true);
  assert.equal(
    (soft.data as { forgery: { riskLevel: string } }).forgery.riskLevel,
    "LOW",
    "风险等级作为附加数据透传（evidence.forgery 争议物证链）",
  );
  // ④ 缺照片 → 拦截验收（领域钩子为准入必填）
  const missing = cleaningCheckHook.run({ ...base, payload: {} });
  assert.equal(missing.ok, false);
  assert.match(missing.reason ?? "", /evidence-photos-required/);
});

test("[环节C4] 现场增项报价钩子：先干后说价拦截 + 确认放行", () => {
  const base = {
    ammoId: "housekeeping-v1",
    orderId: ORDER_ID,
    from: "MATCHED" as const,
    to: "IN_SERVICE" as const,
  };
  // ① 未确认增项 → BLOCK（禁止先干后说价）
  const pending = onsiteQuoteHook.run({
    ...base,
    payload: { onsiteQuote: { items: ["重污加价"], totalYuan: 50, approved: false } },
  });
  assert.equal(pending.ok, false);
  assert.match(pending.reason ?? "", /onsite-quote-pending/);
  // ② 已确认增项 → 放行 + 透传确认金额
  const confirmed = onsiteQuoteHook.run({
    ...base,
    payload: { onsiteQuote: { items: ["客厅重污深度清洁"], totalYuan: 50, approved: true } },
  });
  assert.equal(confirmed.ok, true);
  assert.equal(
    (confirmed.data as { quoteTotalYuan: number }).quoteTotalYuan,
    50,
  );
});

/* =====================================================================
 * 环节 D：结算分账（SETTLED 对账清单 + D7 三比 + 微信收付通指令）
 * ===================================================================== */

test("[环节D1] SETTLED 引擎对账清单：守恒（平台 + 服务方 + 退款 ≡ 170）", async () => {
  const ammo = getAmmoById("housekeeping-v1");
  const t = await advanceLifecycle({
    ammo,
    orderId: ORDER_ID,
    from: "INSPECTED",
    to: "SETTLED",
    currentVersion: 2,
    expectedVersion: 2,
    now: 1_783_100_000_000,
    payload: {
      escrowPayload: { amount: TOTAL_YUAN, platformRate: 0.1, participants: 1 },
    },
  });
  assert.equal(t.ok, true, t.reason);
  assert.equal(t.state, "SETTLED");
  assert.equal(t.nextVersion, 3);
  const ledger = t.afterData.find(
    (d): d is { settlementLedger: Record<string, unknown> } =>
      typeof d === "object" && d !== null && "settlementLedger" in d,
  );
  assert.ok(ledger, "终局清结算对账清单产出");
  const l = ledger.settlementLedger as unknown as {
    ammoId: string;
    hold: { totalAmount: number };
    split: { platformIncome: number; providerIncome: number };
    providerIncome: number;
    platformIncome: number;
    demanderRefund: number;
  };
  assert.equal(l.ammoId, "housekeeping-v1");
  assert.equal(l.hold.totalAmount, TOTAL_YUAN, "结算总额 = 170（含现场增项）");
  // 引擎分账（platformRate 0.1 → 90/10）：17 + 153 = 170
  assert.equal(l.split.platformIncome, 17);
  assert.equal(l.split.providerIncome, 153);
  assert.equal(l.providerIncome, 153);
  assert.equal(l.platformIncome, 17);
  assert.equal(l.demanderRefund, 0);
  assert.equal(l.split.platformIncome + l.split.providerIncome + l.demanderRefund, TOTAL_YUAN);
  // 全款托管口径实证：押金锁 = 订单总额（服务前资金全程冻结在平台侧）
  assert.deepEqual(calculateEscrowHold(TOTAL_YUAN), {
    totalAmount: TOTAL_YUAN,
    heldDeposit: TOTAL_YUAN,
    payableAmount: 0,
  });
  // 观察项（断线点日志）：引擎对账清单按 platformRate 90/10 装配，未消费
  // 弹药 D7 splitRules（85/10/5）——见 [环节D2] 指令侧守恒闭环与总结报告。
});

test("[环节D2] D7 三比 85/10/5 严格守恒：¥144.50 / ¥17.00 / ¥8.50 ≡ ¥170", () => {
  const providerYuan = round2c(TOTAL_YUAN * SPLIT_PROVIDER);
  const platformYuan = round2c(TOTAL_YUAN * SPLIT_PLATFORM);
  const insuranceYuan = round2c(TOTAL_YUAN * SPLIT_INSURANCE);
  assert.equal(providerYuan, 144.5);
  assert.equal(platformYuan, 17);
  assert.equal(insuranceYuan, 8.5);
  assert.equal(providerYuan + platformYuan + insuranceYuan, TOTAL_YUAN);
  assert.equal(providerYuan.toFixed(2), "144.50");
  assert.equal(platformYuan.toFixed(2), "17.00");
  assert.equal(insuranceYuan.toFixed(2), "8.50");
  // 三比严格合成 1.0（弹药出厂硬检同式，容差 1e-9 防浮点尾差）
  assert.ok(Math.abs(SPLIT_PROVIDER + SPLIT_PLATFORM + SPLIT_INSURANCE - 1) <= 1e-9);
});

test("[环节D3] 合规分账指令（S4 防二清）：微信收付通路由 + 守恒双路闭环", () => {
  const since = Date.now();

  /* ① D7 三比口径指令（任务书步骤 7 语义：85/10/5 写盘微信收付通） */
  const d7 = generateComplianceSplitInstruction(
    { platformFee: 17, providerNet: 144.5 },
    "WECHAT_PAY",
    { orderId: ORDER_ID, receiverAccountId: "sub-wx-provider-wang-001" },
  );
  assert.equal(d7.channel, "WECHAT_PAY");
  assert.equal(d7.instructionId, `split-${ORDER_ID}-WECHAT_PAY`);
  assert.equal(d7.splitAmountYuan, 144.5, "服务者实收 85%");
  assert.equal(d7.platformFeeYuan, 17, "平台抽成 10%");
  assert.equal(d7.demanderRefundYuan, 0);
  assert.equal(d7.isMirrorLedgerOnly, true, "平台钱包只读镜像（信息流/资金流分离）");
  assert.match(d7.instructionSignature, /^sig-[0-9a-f]{8}$/);
  assert.equal(
    d7.splitAmountYuan + d7.platformFeeYuan + round2c(TOTAL_YUAN * SPLIT_INSURANCE),
    TOTAL_YUAN,
    "分账 + 手续费 + 保险计提 ≡ 订单总额",
  );
  // 指令号幂等：同订单同渠道确定性派生（机构侧可去重）
  const d7b = generateComplianceSplitInstruction(
    { platformFee: 17, providerNet: 144.5 },
    "WECHAT_PAY",
    { orderId: ORDER_ID, receiverAccountId: "sub-wx-provider-wang-001", now: since },
  );
  assert.equal(d7b.instructionId, d7.instructionId);
  assert.equal(d7b.instructionSignature, d7.instructionSignature, "确定性签名可复算验签");

  /* ② 引擎对账清单直调（与 [环节D1] 同式）：验证 90/10 引擎口径与 D7 差口的确定性 */
  const ledger = buildSettlementLedger({
    ammo: getAmmoById("housekeeping-v1"),
    orderId: ORDER_ID,
    amount: TOTAL_YUAN,
    platformRate: 0.1,
    participants: 1,
  });
  assert.equal(ledger.hold.totalAmount, TOTAL_YUAN);
  assert.equal(ledger.split?.platformIncome, 17);
  assert.equal(ledger.split?.providerIncome, 153);
  assert.equal(ledger.providerIncome, 153);
  assert.equal(ledger.platformIncome, 17);
  assert.equal(ledger.demanderRefund, 0);
  assert.equal(ledger.providerIncome + ledger.platformIncome + ledger.demanderRefund, TOTAL_YUAN);
  // 差口实证：引擎 90/10（153）≠ D7 85% 口径（144.5）→ 保险计提 5% 未进引擎
  // 装配。该差口为既有实现语义（D7 splitRules 属声明字段），如实上报指挥部分级。

  /* ③ 阶梯退款路径守恒（退款 + 服务方 + 平台 ≡ 总额；万一违约/提前终止结算用） */
  const refundLedger = buildSettlementLedger({
    ammo: getAmmoById("housekeeping-v1"),
    orderId: ORDER_ID,
    amount: TOTAL_YUAN,
    refund: { elapsedRatio: 0.5, isBreach: false },
  });
  const sumRefund = (r: { refundToDemander: number; payToProvider: number; platformFee: number }) =>
    r.refundToDemander + r.payToProvider + r.platformFee;
  assert.ok(refundLedger.refund, "阶梯退款清单产出");
  assert.equal(sumRefund(refundLedger.refund!), TOTAL_YUAN);
  // 违约场景：服务方 20% 罚金扣减仍守恒（rest 归需求方抵扣；同 elapsedRatio 对比）
  const breachLedger = buildSettlementLedger({
    ammo: getAmmoById("housekeeping-v1"),
    orderId: ORDER_ID,
    amount: TOTAL_YUAN,
    refund: { elapsedRatio: 1, isBreach: true },
  });
  assert.equal(sumRefund(breachLedger.refund!), TOTAL_YUAN);
  const fullNonBreachLedger = buildSettlementLedger({
    ammo: getAmmoById("housekeeping-v1"),
    orderId: ORDER_ID,
    amount: TOTAL_YUAN,
    refund: { elapsedRatio: 1, isBreach: false },
  });
  assert.ok(
    breachLedger.refund!.payToProvider < fullNonBreachLedger.refund!.payToProvider,
    "违约罚金 20% 从服务方应得中扣减",
  );
});

test("[环节D4] SETTLED 终局投影：toAtomicFiveState（🟢 订单已圆满结算）", () => {
  assert.equal(toAtomicFiveState({ waveStatus: "claimed", claimStatus: "accepted", isSettled: true }), "SETTLED");
  // MATCHED 中态对照（Store 域考卷同步断言同口径）
  assert.equal(toAtomicFiveState({ waveStatus: "claimed", claimStatus: "accepted" }), "MATCHED");
  assert.equal(toAtomicFiveState({ waveStatus: "claimed", claimStatus: "accepted", fulfilmentStatus: "reported" }), "IN_SERVICE");
  assert.equal(toAtomicFiveState({ waveStatus: "claimed", claimStatus: "accepted", fulfilmentStatus: "confirmed" }), "INSPECTED");
});

/* =====================================================================
 * 环节 E：守护扫描（模块级可变资金/弹药声明 = 红线）
 * ===================================================================== */

test("[环节E1] 资金/弹药守护扫描：src 域无模块级可变声明（let 红线）", () => {
  const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
  const srcDir = join(root, "src");
  const banned = [
    "let ammo",
    "let balance",
    "let providerIncome",
    "let platformIncome",
    "let totalYuan",
    "let orderTotal",
    "let escrow",
    "let settlementLedger",
  ];
  const hits: string[] = [];
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".next") continue;
      const p = join(dir, entry);
      const st = statSync(p);
      if (st.isDirectory()) out.push(...walk(p));
      else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) out.push(p);
    }
    return out;
  };
  for (const file of walk(srcDir)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      // 仅列 0 起头的模块级声明（函数内局部变量不在此列）——
      // 去掉前导空白后核对；被禁关键词命中即上报
      const trimmed = line.replace(/^\s+/, "").replace(/\t/g, " ");
      for (const keyword of banned) {
        if (trimmed.startsWith(keyword + " ")) {
          hits.push(`${file.replace(/\\/g, "/")}:${i + 1}: ${trimmed}`);
        }
      }
    });
  }
  assert.deepEqual(hits, [], "模块级可变资金/弹药声明应为零（红线 1）");
});

/* =====================================================================
 * 环节 F：时长执行窗口 + 拟人实测报告（全卷 ≤15s）
 * ===================================================================== */

test("[环节F1] 整卷执行窗口 ≤15s + 实测报告落印", () => {
  const elapsed = Date.now() - t0;
  assert.ok(elapsed <= 15_000, `整卷执行 ${elapsed}ms 超出 15s 红线`);

  const report = [
    "══════════════════════════════════════════════════════",
    "《阶段 1 拟人全链路大考 · 基础防线》实测报告（引擎域）",
    "══════════════════════════════════════════════════════",
    `输入：${CONSUMER_PHRASE}`,
    `命中弹药：housekeeping-v1（家政保洁）起步价 ¥120.00 = 12000 分`,
    `现场增项：客厅重污深度清洁 ¥50 → 订单总额 ¥170`,
    `结算（D7 三比）：服务者 ¥144.50 / 平台 ¥17.00 / 保险 ¥8.50 → 守恒 170`,
    `分账指令：split-${ORDER_ID}-WECHAT_PAY，签名 ${generateComplianceSplitInstruction(
      { platformFee: 17, providerNet: 144.5 },
      "WECHAT_PAY",
      { orderId: ORDER_ID, receiverAccountId: "sub-wx-provider-wang-001" },
    ).instructionSignature}`,
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "断线点 / 观察项（如实上报，非本考卷修复范围）：",
    "  1. 口语「10点来人」不在时间词表（今天/明天/周X/上午/下午/晚）→",
    "     意图层降级 chat，需补词表或按标准格式引导（环节A3/A4 实证）。",
    "  2. 意图层 publishHit 发布关键词表仅含「保洁」不含「打扫」——",
    "     即使补足预算词，「打扫」类口语仍降级 chat；mockEngine 品类词表",
    "     含「打扫」→ 两域词表口径不一致（环节A3② 实证）。",
    "  3. 引擎算子 CleaningCheckHook 为 AFTER+SKIP 语义：无照片不阻断",
    "     跃迁，与「双拍必填」严格预期存在差距（环节C2③ 实证）；",
    "     领域钩子直调为准入必填（环节C3④）。",
    "  4. 引擎对账清单按 platformRate 90/10 装配，未消费弹药 D7 splitRules",
    "     （85/10/5）→ 保险计提 5%（¥8.50）仅存在于弹药声明与指令侧；",
    "     D7 指令 ¥144.50 与引擎放款 ¥153 差 ¥8.50（环节D1/D3② 实证）。",
    "  5. 任务书预想草稿卡含 📍LBS 围栏徽标，实测 IMPACT 模板未开启",
    "     geoFence → 家政草稿卡为 🛡️已投保财产险 + 🔒定金托管 20% 两枚",
    "     （环节B1 实证；📍/⏳ 属 DELAY 模板 meetup-social-v1）。",
    "  6. Store 域（发单/托管/王姐接单/座舱装载）因 @/ 别名 + jsdom 分域，",
    "     由 src/components/waves/real-user-sim-store.test.tsx 承担（vitest）。",
    "  7. 浏览器 CDP 实测（补充证据）：草稿卡「预估费用：¥60/小时 × 1小时起」",
    "     消费旧 PricingModel(minHours=1)，未消费 8D 全息 minHours:2（起步",
    "     2h=¥120 只存在于弹药域）；「该品类建议起价 ¥50」同为旧 scene 建议。",
    "  8. 浏览器 CDP 实测：AI 对话链路全通（口语→家政品类命中→时间追问→",
    "     频率→区域→预算→整理卡→时段卡，与环节A4/引擎考卷行为逐条一致）；",
    "     发布弹层「关闭发布」按钮首击无效需二次点击（交互小缺陷）。",
    "  9. 新用户登录实测 500「创建用户资料失败」（profiles 写库依赖 Supabase，",
    "     本地环境未达）——/chat 会话守卫链路登录能力受环境限制，如实上报。",
    "══════════════════════════════════════════════════════",
  ].join("\n");
  console.log(report);
});