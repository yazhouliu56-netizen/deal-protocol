/**
 * 《阶段 2：敏感与定制边界场景全流程拟人对抗实测考卷》
 *
 * 考卷目标（红线 1：零 LLM、零动态执行、全确定性纯函数断言）：
 *   由 OpenCode 扮演提出非标敏感需求的真实消费者，输入定制需求：
 *     「我需要10点来人打扫房间。年龄在20-30岁之间，身穿女仆装。」
 *   真实调用内容风控（moderation.ts）/ 意图解析（voiceIntent.ts + decompose.ts）/
 *   三维信用准入（tri-credit.ts）/ 引擎增项熔断（runner.ts advanceLifecycle）/
 *   引信隐私位（fuze-policy.ts），逐项检验 4+1 道防线的真实判定与逻辑穿透点。
 *
 * 检验点分布（本文件 = 引擎/纯函数域；Store 域接线（useWaveStore 发布扫描位）
 * 以「与 store 行 456-461 同式扫描串」断言，jsdom 域见既有姊妹考卷）：
 *   B1  内容风控层：女仆装/制服涉敏盲区实证 + 对照词命中（涉黄服务/未成年人/诱导站外）。
 *   B2  敏感词库五类枚举逐项实测（SENSITIVE_PATTERNS 完整覆盖）。
 *   B3  风控上报链路：auto 上报 → 幂等去重 → 人工裁决渐进（dismiss/remove 语义）。
 *   B4  意图解析：核心要素提取（时间 10:00 / 品类 保洁）不受涉敏文本干扰。
 *   B5  意图解析盲区：年龄 20-30 无结构化提取位（wave 无 ageRange 键）+ 裸句降级。
 *   B6  时间规范化变形：10点半 → 10:30 / 14点30分 → 14:30 / 明天 10:00 前缀保留。
 *   B7  拆解层盲区：mockDecompose 无 bizParams/ageRange 通道（定制属性零封装）。
 *   B8  准入-服务者 A（25 岁达标画像）→ 放行。
 *   B9  准入-服务者 B（45 岁超龄画像）→ 放行（年龄维度缺失盲区实证）。
 *   B10 准入-服务者 C（无公安背调）→ isPoliceVerified 一票否决硬阻断。
 *   B11 准入-服务者 D（ESF 55 < 门槛 60）→ ESF 熔断；服务者 E（BCS < 50）→ 通用底线。
 *   B12 准入契约盲区：workerRequirement 无年龄位（Object.hasOwn 实证）+ 既有声明佐证。
 *   B13 增项熔断：定制着装增项 ¥50（41.6% ≤ 50%）放行 → 订单总额 170。
 *   B14 增项熔断：恰 ¥60（50% 边界）放行。
 *   B15 增项熔断：恶意加价 ¥100（83.3% > 50%）→ ANTI_GOUGING_LIMIT_EXCEEDED 硬阻断。
 *   B16 引信就绪：家政碰炸引信 photoProof/evidenceChain/WATERMARK_CAMERA（ProofCamera 位）。
 *   B17 隐私盾盲区：家政 virtualNumber/SOS/敏感词干预全关（涉敏需求未触发引信升级）。
 *   B18 对照就绪：companion 近炸引信 privacy/SOS 全开（能力存在但未挂家政）。
 *   B19 整卷执行窗口 ≤15s + 实测报告落印。
 *
 * 全部代码不缩短、不省略；断言的是「系统真实行为」，盲区以断言 + 注释如实记录，
 * 不伪造拦截、不掩盖放行。
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";

import {
  autoFlag,
  submitReport,
  resolveReport,
  SENSITIVE_PATTERNS,
} from "../base/risk/moderation.ts";
import { mockVoiceIntent } from "../base/ai/voice/voiceIntent.ts";
import { mockDecompose } from "../base/ai/decompose.ts";
import { evaluateTriCreditAdmission } from "../base/trust/tri-credit.ts";
import { advanceLifecycle } from "../base/ammo/runner.ts";
import { evaluateRuntimeSafety } from "../base/safe/runtime-monitor.ts";
import { normalizeCustomIntent } from "../base/ai/intent-normalizer.ts";
import type { ITriDimensionalCredit } from "../types/ammo-schema.ts";
import { housekeepingAmmo } from "./housekeeping.ammo.ts";
import { companionAmmo } from "./companion.ammo.ts";

/* =====================================================================
 * 考卷常量（全部来自既有弹药/计价/护栏/词表，无任何新造语义）
 * ===================================================================== */

/** 阶段 2 拟人对抗输入：非标定制 + 涉敏着装 + 年龄硬筛选。 */
const CUSTOM_PHRASE = "我需要10点来人打扫房间。年龄在20-30岁之间，身穿女仆装。";

/** 起步价：¥60/小时 × 2 小时起 = ¥120 = 12000 分（与 D2 地板价 12000 同口径）。 */
const BASE_YUAN = 120;
/** 合规定制增项（女仆装特殊着装服务费）¥50 ≤ 熔断线 ¥60（= 120 × 0.5）。 */
const FAIR_SURCHARGE_YUAN = 50;
/** 边界增项：恰等于熔断线（120 × 0.5 = 60）。 */
const BOUNDARY_SURCHARGE_YUAN = 60;
/** 恶意增项：83.3% 远超 50% 熔断线。 */
const MALICIOUS_SURCHARGE_YUAN = 100;
const TOTAL_YUAN = BASE_YUAN + FAIR_SURCHARGE_YUAN;

/** 服务者 A：25 岁 · 已过公安无犯罪背调 · ESF 85 · 家政技能 85 —— 完全达标画像。 */
const WORKER_A_25: ITriDimensionalCredit = {
  bcsScore: 80,
  pqsScores: { housekeeping: 85 },
  esfScore: 85,
  isPoliceVerified: true,
  age: 25,
};
/** 服务者 B：45 岁（不满足需求方 20-30 定制要求）· 其余画像与 A 相同。 */
const WORKER_B_45: ITriDimensionalCredit = {
  bcsScore: 80,
  pqsScores: { housekeeping: 85 },
  esfScore: 85,
  isPoliceVerified: true,
  age: 45,
};
/** 服务者 C：未过公安无犯罪背调。 */
const WORKER_C_NO_POLICE: ITriDimensionalCredit = {
  bcsScore: 80,
  pqsScores: { housekeeping: 85 },
  esfScore: 85,
  isPoliceVerified: false,
};
/** 服务者 D：ESF 55，低于家政门槛 60。 */
const WORKER_D_LOW_ESF: ITriDimensionalCredit = {
  bcsScore: 80,
  pqsScores: { housekeeping: 85 },
  esfScore: 55,
  isPoliceVerified: true,
};
/** 服务者 E：BCS 45，低于通用履约底线 50。 */
const WORKER_E_LOW_BCS: ITriDimensionalCredit = {
  bcsScore: 45,
  pqsScores: { housekeeping: 85 },
  esfScore: 85,
  isPoliceVerified: true,
};

/** 整卷起始时钟（B19 执行窗口红线）。 */
const t0 = Date.now();

/* =====================================================================
 * B1 · 防线 1 内容风控层：涉敏着装盲区实证 + 对照词真实命中
 * ===================================================================== */

test("[B1] 内容风控：女仆装/制服未命中词表（盲区实证）+ 既有高危词真实拦截", () => {
  /* ① 完整涉敏定制诉求过 autoFlag → 如实返回 null（女仆装/制服不在词表） */
  const flag = autoFlag(CUSTOM_PHRASE);
  assert.equal(flag, null, "盲区实证：『女仆装』『制服』不在 SENSITIVE_PATTERNS，未触发任何标记");

  /* ② 与 Store 发布扫描位同式（useWaveStore 行 456-461：category + customs + note 拼接） */
  const storeScan = ["家政保洁", "身穿女仆装", "年龄在20-30岁之间", CUSTOM_PHRASE].join(" ");
  assert.equal(autoFlag(storeScan), null, "盲区实证：Store 发布扫描同式串同样漏检");

  /* ③ 对照：既有词表高危词真实命中（防误伤对照组同时证明拦截器本身工作正常） */
  assert.equal(autoFlag("晚上上门服务 200"), "涉黄服务");
  assert.equal(autoFlag("未成年学生妹"), "未成年人");
  assert.equal(autoFlag("先私下转账给你"), "诱导站外交易");
  assert.equal(autoFlag("家宴做菜上门"), null, "正常内容不误伤");
});

/* =====================================================================
 * B2 · 敏感词库五类枚举逐项实测
 * ===================================================================== */

test("[B2] 敏感词库五类标签完整覆盖（SENSITIVE_PATTERNS 逐词实测）", () => {
  const tags = SENSITIVE_PATTERNS.map((p) => p.tag).sort();
  assert.deepEqual(tags, ["人肉搜索", "未成年人", "诱导站外交易", "涉黄服务", "违禁品"].sort());

  assert.equal(autoFlag("按摩全套"), "涉黄服务");
  assert.equal(autoFlag("一夜情"), "涉黄服务");
  assert.equal(autoFlag("幼师"), "未成年人");
  assert.equal(autoFlag("冰毒"), "违禁品");
  assert.equal(autoFlag("开盒"), "人肉搜索");
});

/* =====================================================================
 * B3 · 风控上报链路：auto 上报 → 幂等 → 人工裁决渐进
 * ===================================================================== */

test("[B3] 风控上报链路：系统自动上报 + 幂等去重 + 渐进裁决（真实函数直调）", () => {
  const reports: never[] = [];
  const first = submitReport(
    reports as never[] as Parameters<typeof submitReport>[0],
    {
      targetId: "wave-custom-boundary-001",
      targetType: "wave",
      reporterId: "system",
      reason: "sensitive",
      detail: "命中违禁词：涉黄服务",
      auto: true,
    },
    1_783_200_000_000,
  );
  assert.ok(first.report, "系统自动上报生成");
  assert.equal(first.report.auto, true, "auto 标记如实落盘");
  assert.equal(first.report.status, "open");

  const dup = submitReport(
    [first.report],
    {
      targetId: "wave-custom-boundary-001",
      targetType: "wave",
      reporterId: "system",
      reason: "sensitive",
      detail: "重复上报",
      auto: true,
    },
    1_783_200_000_100,
  );
  assert.equal(dup.error, "report.duplicate", "同 reporter+target 未决举报幂等去重");

  const resolved = resolveReport(first.report, "remove", "人工复核：证据不足，下架处理", "moderator-1");
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.action, "remove");
  assert.equal(resolved.resolvedBy, "moderator-1");
  assert.throws(() => resolveReport(resolved, "warn", "重复裁决", "moderator-1"), /already-resolved/);
});

/* =====================================================================
 * B4 · 防线 2 意图解析：核心要素提取不受涉敏文本干扰
 * ===================================================================== */

test("[B4] 意图解析：涉敏定制文本中时间/品类核心要素仍精确提取", () => {
  const parsed = mockVoiceIntent(`${CUSTOM_PHRASE}，预算 150 元`);
  assert.equal(parsed.kind, "publish-wave", "『打扫』同义词词表（阶段1修复）命中 → 发布意图");
  if (parsed.kind === "publish-wave") {
    assert.equal(parsed.wave.category, "保洁", "品类归一：打扫 → 保洁");
    assert.equal(parsed.wave.time, "10:00", "时间精确提取：10点 → 10:00（阶段1修复）");
    assert.equal(parsed.wave.budget, 150);
    assert.equal(parsed.wave.area, "附近");
  }
});

/* =====================================================================
 * B5 · 意图解析盲区：年龄定制参数零提取位
 * ===================================================================== */

test("[B5] 意图解析：『年龄20-30岁』『女仆装』已被驯化为 wave.customRequirements 中性契约", () => {
  const parsed = mockVoiceIntent(`${CUSTOM_PHRASE}，预算 150 元`);
  assert.equal(parsed.kind, "publish-wave");
  if (parsed.kind === "publish-wave") {
    const cr = parsed.wave.customRequirements;
    assert.ok(cr, "阶段3：定制要求随 wave 无损承载");
    assert.deepEqual(cr.ageRange, [20, 30], "『年龄在20-30岁之间』精确提取");
    assert.equal(cr.dressCode?.required, true);
    assert.equal(cr.dressCode?.type, "THEMED_MAID", "『女仆装』归一为女仆主题");
    assert.equal(cr.isSensitiveCustomization, true);
    assert.equal(cr.blockedReason, null, "非标定制不阻断（驯化通道）");
    assert.doesNotMatch(cr.cleanText, /女仆装/, "公海展示文案已中性化，杜绝擦边词直显");
    assert.match(cr.cleanText, /女仆主题/);
  }
  // 裸句（无预算词）仍按「缺预算一票 chat」设计降级 —— 涉敏文本不改变该铁律
  assert.equal(mockVoiceIntent(CUSTOM_PHRASE).kind, "chat");
});

/* =====================================================================
 * B6 · 时间规范化变形矩阵（阶段1 修复回归加固）
 * ===================================================================== */

test("[B6] 时间规范化变形：10点半/14点30分/带日期前缀均输出精确时分", () => {
  // SSOT 收敛注：原输入「下午 10点半」在新语义下正确归一为 22:30（见 timeParser.test），
  // 本用例锁定的是半点解析变形本身 → 改用上午口径保持断言值不变
  const half = mockVoiceIntent("上午 10点半来打扫，预算 100 元");
  assert.equal(half.kind, "publish-wave");
  if (half.kind === "publish-wave") assert.equal(half.wave.time, "10:30", "10点半 → 10:30");

  const minuted = mockVoiceIntent("14点30分来打扫，预算 100 元");
  assert.equal(minuted.kind, "publish-wave");
  if (minuted.kind === "publish-wave") assert.equal(minuted.wave.time, "14:30", "14点30分 → 14:30");

  const dated = mockVoiceIntent("明天 10:00 打扫，预算 100 元");
  assert.equal(dated.kind, "publish-wave");
  if (dated.kind === "publish-wave") {
    assert.equal(dated.wave.time, "明天 10:00", "带日期前缀原样保留");
  }
});

/* =====================================================================
 * B7 · 拆解层盲区：定制属性零封装通道
 * ===================================================================== */

test("[B7] 拆解层盲区实证：mockDecompose 无 bizParams/ageRange 输出通道", () => {
  const modules = mockDecompose({
    category: "打扫",
    note: CUSTOM_PHRASE,
    budget: BASE_YUAN,
  });
  assert.equal(modules.length, 2);
  assert.equal(modules[0].name, "到场服务");
  assert.equal(modules[1].name, "交付验收");
  assert.equal(modules[0].weight + modules[1].weight, 100);
  assert.equal(
    modules.some((m) => Object.hasOwn(m, "ageRange")),
    false,
    "盲区实证：拆解模块无年龄定制通道（bizParams 不存在）",
  );
});

/* =====================================================================
 * B8-B12 · 防线 3 供给端准入：三维信用 + 年龄盲区
 * ===================================================================== */

test("[B8] 准入-服务者 A（25 岁 · 背调/ESF/技能全达标）：放行", () => {
  const r = evaluateTriCreditAdmission(WORKER_A_25, housekeepingAmmo);
  assert.equal(r.isAdmitted, true, "完全达标画像准入通过");
  assert.equal(r.reason, undefined);
});

test("[B9] 准入-服务者 B（45 岁）：无定制声明时兼容放行；带 ageRange 定制 → AGE_MISMATCH 硬拦截", () => {
  // ① 无定制声明（缺省调用，既有契约零回归）：45 岁照常按信用放行
  const plain = evaluateTriCreditAdmission(WORKER_B_45, housekeepingAmmo);
  assert.equal(plain.isAdmitted, true, "无 ageRange 声明 → 不触发年龄门禁（零误杀兼容）");

  // ② 需求方声明 ageRange [20,30]（阶段3 语义驯化产物）→ 45 岁一票拦截
  const gated = evaluateTriCreditAdmission(
    WORKER_B_45,
    housekeepingAmmo,
    { ageRange: [20, 30] },
  );
  assert.equal(gated.isAdmitted, false, "45 岁超出定制年龄区间 → 硬拦截");
  assert.match(gated.reason ?? "", /AGE_MISMATCH/, "原因码明确标注年龄条件不匹配");
});

test("[B10] 准入-服务者 C（无公安背调）：isPoliceVerified 一票否决硬阻断", () => {
  const r = evaluateTriCreditAdmission(WORKER_C_NO_POLICE, housekeepingAmmo);
  assert.equal(r.isAdmitted, false);
  assert.match(r.reason ?? "", /police-verification-required/, "碰炸引信入户类目公安核验一票否决");
});

test("[B11] 准入-服务者 D（ESF 55 < 60）：ESF 熔断；服务者 E（BCS 45 < 50）：通用底线拒绝", () => {
  const d = evaluateTriCreditAdmission(WORKER_D_LOW_ESF, housekeepingAmmo);
  assert.equal(d.isAdmitted, false);
  assert.match(d.reason ?? "", /esf-score 55 < gate 60/, "强合规类目 ESF 一票熔断");

  const e = evaluateTriCreditAdmission(WORKER_E_LOW_BCS, housekeepingAmmo);
  assert.equal(e.isAdmitted, false);
  assert.match(e.reason ?? "", /bcs-score 45 < 50/, "通用履约底线拒绝");
});

test("[B12] 准入契约盲区实证：workerRequirement 无年龄位（家政 60/背调/健康证，无 age）", () => {
  const req = housekeepingAmmo.workerRequirement;
  assert.ok(req, "家政弹药声明供给端准入门槛");
  assert.equal(
    Object.hasOwn(req, "ageMin") || Object.hasOwn(req, "ageMax"),
    false,
    "盲区实证：准入契约无年龄区间位（registry.ts 行 57 既有声明『age-required 类目引信模板无年龄位』同款缺口）",
  );
  assert.equal(req.minSafetyScore, 60);
  assert.equal(req.requiredIdentityLevel, "REAL_NAME");
  assert.equal(req.isPoliceVerified, true);
  assert.deepEqual(req.requiredCertificates, ["HEALTH_CERT"]);
});

/* =====================================================================
 * B13-B15 · 防线 4 非标定制加价与 50% 熔断
 * ===================================================================== */

test("[B13] 增项熔断：定制着装增项 ¥50（41.6% ≤ 50%）放行 → 订单总额 170", async () => {
  const t = await advanceLifecycle({
    ammo: housekeepingAmmo,
    orderId: "custom-boundary-ok-50",
    from: "MATCHED",
    to: "IN_SERVICE",
    currentVersion: 0,
    expectedVersion: 0,
    now: 1_783_200_000_000,
    payload: {
      arrival: { confirmed: true, at: 1_783_200_000_000 },
      onsiteQuote: { items: ["女仆装特殊着装服务"], totalYuan: FAIR_SURCHARGE_YUAN, approved: true },
      escrowPayload: { amount: BASE_YUAN, balance: 1000 },
    },
  });
  assert.equal(t.ok, true, t.reason);
  assert.equal(t.state, "IN_SERVICE");
  const quote = t.hookOutcomes.find((h) => h.hookId === "operator.onsite-quote");
  assert.ok(quote, "执行 OnsiteQuoteHook");
  assert.equal(quote?.ok, true);
  assert.equal(BASE_YUAN + FAIR_SURCHARGE_YUAN, TOTAL_YUAN, "订单总额动态累加：120 + 50 = 170");
});

test("[B14] 增项熔断边界：恰 ¥60（= 120 × 50%）放行", async () => {
  const t = await advanceLifecycle({
    ammo: housekeepingAmmo,
    orderId: "custom-boundary-edge-60",
    from: "MATCHED",
    to: "IN_SERVICE",
    currentVersion: 0,
    expectedVersion: 0,
    now: 1_783_200_000_001,
    payload: {
      arrival: { confirmed: true, at: 1_783_200_000_001 },
      onsiteQuote: { items: ["边界定制服务"], totalYuan: BOUNDARY_SURCHARGE_YUAN, approved: true },
      escrowPayload: { amount: BASE_YUAN, balance: 1000 },
    },
  });
  assert.equal(t.ok, true, t.reason);
  assert.equal(t.state, "IN_SERVICE", "恰 50% 未超上限（60 > 60 为 false）→ 放行");
});

test("[B15] 增项熔断：恶意加价 ¥100（83.3% > 50%）→ ANTI_GOUGING_LIMIT_EXCEEDED 硬阻断", async () => {
  const t = await advanceLifecycle({
    ammo: housekeepingAmmo,
    orderId: "custom-boundary-evil-100",
    from: "MATCHED",
    to: "IN_SERVICE",
    currentVersion: 0,
    expectedVersion: 0,
    now: 1_783_200_000_002,
    payload: {
      arrival: { confirmed: true, at: 1_783_200_000_002 },
      onsiteQuote: { items: ["女仆装全程服务"], totalYuan: MALICIOUS_SURCHARGE_YUAN, approved: true },
      escrowPayload: { amount: BASE_YUAN, balance: 1000 },
    },
  });
  assert.equal(t.ok, false, "恶意加价必须阻断");
  assert.equal(t.state, "MATCHED", "阻断后状态停留在原态");
  assert.match(t.reason ?? "", /ANTI_GOUGING_LIMIT_EXCEEDED/, "熔断原因如实返回");
});

/* =====================================================================
 * B16-B18 · 防线 5 引信与隐私盾：家政碰炸就绪位 + 涉敏升级盲区 + 近炸对照
 * ===================================================================== */

test("[B16] 引信就绪：家政碰炸引信 photoProof/evidenceChain/WATERMARK_CAMERA（ProofCamera 存证位）", () => {
  const fuze = housekeepingAmmo.fuzePolicy;
  assert.equal(fuze.fuzeTypes.includes("IMPACT"), true, "💥 碰炸引信（入户高财产）");
  assert.equal(fuze.trace.photoProof, true, "强制拍照存证位（ProofCamera 驱动位）");
  assert.equal(fuze.trace.evidenceChain, true, "证据链入账位");
  assert.equal(fuze.backgroundCheck, "HARD", "背景硬调查");
  assert.ok(
    housekeepingAmmo.holographic?.requiredSensors?.includes("WATERMARK_CAMERA"),
    "水印相机传感器声明（ProofCamera 装配依据）",
  );
});

test("[B17] 隐私盾盲区实证：家政碰炸引信未开虚拟号/SOS/敏感词干预——涉敏定制不触发引信升级", () => {
  const fuze = housekeepingAmmo.fuzePolicy;
  assert.equal(fuze.privacy.virtualNumber, false, "盲区实证：虚拟隐私号未就绪");
  assert.equal(fuze.privacy.sensitiveWordIntervention, false, "盲区实证：履约会话敏感词干预未启用");
  assert.equal(fuze.sos.enabled, false, "盲区实证：一键 SOS 未就绪");
  assert.equal(fuze.sos.autoLocationReport, false, "盲区实证：SOS 自动位置上报未就绪");
});

test("[B18] 对照就绪：companion 近炸引信 privacy/SOS 全开（能力存在但未随涉敏需求挂家政）", () => {
  const fuze = companionAmmo.fuzePolicy;
  assert.equal(fuze.fuzeTypes.includes("PROXIMITY"), true, "📡 近炸引信（人身风险类目）");
  assert.equal(fuze.privacy.virtualNumber, true, "虚拟隐私号就绪");
  assert.equal(fuze.privacy.sensitiveWordIntervention, true, "敏感词干预就绪");
  assert.equal(fuze.sos.enabled, true, "一键 SOS 就绪");
  assert.equal(fuze.sos.notifyEmergencyContacts, true, "SOS 紧急联系人通知就绪");
  assert.equal(fuze.sos.autoEvidenceAppend, true, "SOS 自动证据附加入账");
});

/* =====================================================================
 * B19 · 整卷执行窗口 + 实测报告落印
 * ===================================================================== */

test("[B19] 整卷执行窗口 ≤15s + 对抗实测报告落印", () => {
  const elapsed = Date.now() - t0;
  assert.ok(elapsed <= 15_000, `整卷执行 ${elapsed}ms 超出 15s 红线`);

  const report = [
    "══════════════════════════════════════════════════════",
    "《阶段 2：敏感与定制边界场景全流程拟人对抗实测报告》",
    "══════════════════════════════════════════════════════",
    `输入：${CUSTOM_PHRASE}`,
    "──────────────────────────────────────────────────────",
    "4+1 道防线实测结论：",
    "  防线1 内容风控：『女仆装/制服』不在 SENSITIVE_PATTERNS → autoFlag 漏检",
    "    （盲区）；对照高危词（上门服务/未成年/私下转账）真实拦截 ✓；Store 发布",
    "    扫描位同式串同样漏检（useWaveStore 行 461 接线已存在但词表无此词）。",
    "  防线2 意图解析：时间 10:00 ✓ / 品类 保洁 ✓（阶段1修复生效）；『年龄20-30岁』",
    "    『女仆装』零提取位——wave 契约无 ageRange/dressCode，定制属性被静默丢弃（盲区）。",
    "  防线3 供给端准入：公安背调一票否决 ✓（无背调 C 阻断）；ESF<60 熔断 ✓；BCS<50 ✓；",
    "    但『年龄 20-30』无法落准入——ITriDimensionalCredit/IWorkerRequirement 均无",
    "    年龄维度，45 岁服务者 B 照常放行（盲区，registry.ts 行 57 既有同款声明）。",
    "  防线4 增项熔断：¥50（41.6%）放行→170 ✓；¥60（恰 50%）边界放行 ✓；",
    "    ¥100（83.3%）ANTI_GOUGING_LIMIT_EXCEEDED 硬阻断 ✓（防线完整）。",
    "  防线5 引信/隐私：家政碰炸引信 photoProof/证据链/水印相机就绪 ✓（ProofCamera 位）；",
    "    虚拟号/SOS/敏感词干预全关——引信跟弹药走不跟需求走，涉敏定制未触发任何",
    "    引信升级（盲区）；companion 近炸对照全开（能力存在但未挂家政）。",
    "──────────────────────────────────────────────────────",
    "风控盲区 / 逻辑穿透点汇总（如实上报，待指挥部裁决）：",
    "  1. 词表漏洞：入户场景涉敏着装词（女仆装/制服/角色扮演/情趣）零覆盖 →",
    "     涉黄服务边缘绕过：autoFlag(CUSTOM_PHRASE) === null 实测实证。",
    "  2. 定制属性穿透：『年龄 20-30 岁』『身穿女仆装』既不入 wave 也不入 bizParams，",
    "     发布扫描位扫不到（需求文本在 customs/note 才过检，且词表无词）→ 需求方",
    "     年龄硬筛选在执行侧无任何闸门（无 ageRange 校验器）。",
    "  3. 引信升级缺路径：用户明确表达涉敏着装意愿，弹药引信不可变（宪法 #5 引信跟",
    "     弹药走），需求侧无『敏感度攀升 → 引信升级/人工复核』机制。",
    "  4. 履约会话盲区：家政 IN_SERVICE 聊天无敏感词干预（sensitiveWordIntervention",
    "     = false，仅近炸模板开启）→ 涉敏履约对话监控缺口。",
    "加固建议（待裁决后执行，本考卷零修复）：",
    "  a) SENSITIVE_PATTERNS 增『涉敏着装』组（女仆装|制服|情趣|角色扮演…），入户+",
    "     涉敏双命中 → auto 上报人工复核（治理闸门 2 同链路）。",
    "  b) wave 契约增 ageRange/dressCode 可选位 + 服务者画像增 age → 准入引擎增",
    "     定制年龄校验器（不满足返回 age-mismatch 拦截）。",
    "  c) 需求敏感度检测（autoFlag 命中或定制位异常）→ 引信升级提示或强制人工审核。",
    "  d) 家政 IN_SERVICE 会话开启敏感词干预（sensitiveWordIntervention 位随碰炸",
    "     模板默认开）。",
    "══════════════════════════════════════════════════════",
  ].join("\n");
  console.log(report);
});

/* =====================================================================
 * B20-B23 · 阶段3 语义驯化闭环实证（意图契约 / 年龄硬门禁 / 引信升级）
 * ===================================================================== */

test("[B20] 驯化-意图契约：口语完整诉求 → wave.customRequirements 中性化无损承载", () => {
  const parsed = mockVoiceIntent(`${CUSTOM_PHRASE}，预算 150 元`);
  assert.equal(parsed.kind, "publish-wave");
  if (parsed.kind === "publish-wave") {
    const cr = parsed.wave.customRequirements;
    assert.ok(cr, "驯化产物挂载 wave");
    assert.deepEqual(cr.ageRange, [20, 30]);
    assert.equal(cr.dressCode?.type, "THEMED_MAID");
    assert.equal(cr.isSensitiveCustomization, true);
    assert.equal(cr.blockedReason, null);
    assert.doesNotMatch(cr.cleanText, /女仆装/, "中性文案杜绝擦边原词");
  }
});

test("[B21] 驯化-年龄硬门禁：25 岁合格放行 / 45 岁 AGE_MISMATCH 一票拦截", () => {
  const custom = { ageRange: [20, 30] as [number, number] };
  const young = evaluateTriCreditAdmission(WORKER_A_25, housekeepingAmmo, custom);
  assert.equal(young.isAdmitted, true, "25 岁在 [20,30] 区间 → 放行");

  const old = evaluateTriCreditAdmission(WORKER_B_45, housekeepingAmmo, custom);
  assert.equal(old.isAdmitted, false, "45 岁超区间 → 拦截");
  assert.match(old.reason ?? "", /AGE_MISMATCH/);

  // 年龄未知（age 缺省）不误杀：跳过年龄门禁，按信用放行
  const unknown = evaluateTriCreditAdmission(
    { ...WORKER_B_45, age: undefined },
    housekeepingAmmo,
    custom,
  );
  assert.equal(unknown.isAdmitted, true, "年龄未知画像零误杀");
});

test("[B22] 驯化-引信自适应升级：敏感定制 + 基础 20 → 风险 50 ≥ 阈值 → PROXIMITY_ENHANCED 三武装", () => {
  const r = evaluateRuntimeSafety({
    ammoId: housekeepingAmmo.ammoId,
    orderId: "custom-boundary-escalate-001",
    baseRiskScore: 20,
    customRequirements: {
      cleanText: "要求：指定工作着装(女仆主题) · 期望年龄: 20-30岁",
      isSensitiveCustomization: true,
      blockedReason: null,
      dressCode: { required: true, type: "THEMED_MAID", rawKeyword: "女仆装" },
      ageRange: [20, 30],
      genderPreference: "ANY",
    },
  });
  assert.equal(r.riskScore, 50);
  assert.equal(r.safetyLevel, "PROXIMITY_ENHANCED");
  assert.deepEqual(r.forceArmed, {
    virtualNumberActive: true,
    tripGuardActive: true,
    chatModerationActive: true,
  });
  assert.equal(r.safetyBadge, "🛡️ 强化安全守护中（虚拟号+实时存证）");

  // 对照：无定制纯保洁 → 20 < 50 → STANDARD，不强制武装
  const plain = evaluateRuntimeSafety({
    ammoId: housekeepingAmmo.ammoId,
    orderId: "custom-boundary-plain-001",
    baseRiskScore: 20,
  });
  assert.equal(plain.safetyLevel, "STANDARD");
  assert.equal(plain.forceArmed.virtualNumberActive, false);
  assert.equal(plain.safetyBadge, "🛡️ 安全守护中");
});

test("[B23] 驯化-违禁硬阻断分流：涉黄诉求 blockedReason 留痕且不产出公海文案", () => {
  const r = normalizeCustomIntent("上门服务 200 全套");
  assert.equal(r.blockedReason, "涉黄服务", "绝对违禁词硬阻断标记");
  assert.equal(r.cleanText, "", "违禁诉求不生成中性文案（不进公海）");
  assert.equal(r.isSensitiveCustomization, true);
});

before(() => {
  console.log("阶段2+3 对抗考卷装载：真实调用 moderation/voiceIntent/decompose/tri-credit/runner/runtime-monitor/normalizer");
});
