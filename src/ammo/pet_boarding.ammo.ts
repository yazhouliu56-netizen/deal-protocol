/**
 * 第五枚官方标准弹药：pet-boarding-v1（宠物家庭寄养 · C2 入户高信任 + 24h 质保）。
 *
 * 第五枚标杆弹药，首枚宠物寄养类目：宠物寄养家庭式照护（犬猫寄养、上门喂养日托）——
 * 入户/寄养高信任场景，供给侧以健康证 + 宠物护理资质 + 公安核验背书，
 * 接受碰炸引信强合规（与家政同级财产/隐私暴露面）。
 *
 * 8D 全息化（方向 B · 第 5 弹量产实战 2026-08-27 · Zero Base）：
 *   - D1 供给准入：C2_IN_HOME 入户运力池；实名 REAL_NAME + 安全分 ≥70 +
 *     公安核验 + 健康证/宠物护理双证（HEALTH_CERT + PET_CARE_CERT）。
 *   - D2 计价与护栏：FIXED 定额 80 元/天基准；地板 30 元 / 天花板 2000 元
 *     （3000/200000 分）；增项加价熔断 ≤50%（引擎防坐地起价）。
 *   - D3 风控引信：💥 IMPACT_INHOME_FUZE_TEMPLATE（碰炸·入户武装版：双拍存证 + 强实名 + SOS 四开关全开）。
 *   - D4 传感降级：WATERMARK_CAMERA + GPS_GEOFENCE；失效逐级回退至原生摄像头/基站粗定位/人工审核。
 *   - D5 正向钩子：ArrivalCheckHook（到场交接体检）+ CleaningCheckHook（完工/离场双拍验收）——
 *     到场交接 → 寄养中喂食打卡 → 离场双拍验收 三段式。
 *   - D6 逆向违约阶梯：匹配前 100% 退 → 途中 80%+20 元车马费/扣 20% 定金 →
 *     已到现场 50% 退 → 服务中 0% 退（扣全额定金）。
 *   - D7 清算与仲裁：24h 超时自动代验收；分账三比 0.85/0.10/0.05（资金守恒硬校验）。
 *   - D8 视界与表单：default 主题 + HousekeepingSlot 复用；宠物种类/年龄体重/特殊喂养备注声明式表单；
 *     6 连别名直拨宠物寄养全场景。
 *   - D9 履约行动：交接体检双拍 + 喂食打卡存证 · dyn 通用视口（deriveActionSchema 自动推导 PROOF_PHOTO）。
 */

import type {
  IAmmoDefinition,
  IHolographicAmmoConfig,
} from "../types/ammo-schema.ts";
import { IMPACT_INHOME_FUZE_TEMPLATE } from "../types/fuze-policy.ts";
import { assembleAmmo, deepFreeze } from "./factory.ts";

/* =====================================================================
 * 8 维全息配置（AmmoFactory 装配原料 · 静态审查出厂）
 * ===================================================================== */

/**
 * 宠物家庭寄养 · 8 维全息声明（D1~D9，资金守恒/双证准入/加价熔断出厂硬检）。
 *
 * 出厂审查要点（validateAmmoConfig 全项）：
 *  - 分账守恒：0.85 + 0.10 + 0.05 = 1.0（±1e-9 容差）；
 *  - 加价熔断：maxSurchargeRatio = 0.5 ≤ 0.5 上限；
 *  - 计价护栏：minFloorPrice 3000 ≤ maxCeilingPrice 200000（分）；
 *  - C2 入户安全一票否决：isPoliceVerified=true 通过；
 *  - D5 钩子白名单：ArrivalCheckHook / CleaningCheckHook 命中 HOOK_OPERATOR_REGISTRY；
 *  - D6 违约阶梯合法性：各 tier 退款/扣金比例 ∈[0,1]、车马费 ≥0。
 */
export const PET_BOARDING_HOLOGRAPHIC_CONFIG: IHolographicAmmoConfig = {
  ammoId: "pet-boarding-v1",
  category: "PET_BOARDING",
  version: "1.0.0",

  /* D1 供给准入（C2_IN_HOME 入户运力池 · 双证 + 公安核验 + 安全分 70） */
  supplyCluster: "C2_IN_HOME",
  workerRequirement: {
    requiredIdentityLevel: "REAL_NAME",
    minSafetyScore: 70,
    isPoliceVerified: true,
    requiredCertificates: ["HEALTH_CERT", "PET_CARE_CERT"],
  },

  /* D2 计价与护栏（80 元/天定额 · 30~2000 护栏 · 增项 50% 熔断） */
  pricingModel: {
    kind: "FIXED",
    amountYuan: 80,
  },
  pricingParams: { baseRate: 80 },
  minFloorPrice: 3000,
  maxCeilingPrice: 200000,
  maxSurchargeRatio: 0.5,
  creditWaiverRule: {
    allowedCreditDimension: "SAFETY_BACKGROUND",
    maxWaiverPercentage: 0.5,
  },

  /* D3 风控引信（💥 碰炸·入户武装版） */
  fuzePolicy: IMPACT_INHOME_FUZE_TEMPLATE,

  /* D4 传感降级（零信任物理感知 · 宪法 #10） */
  requiredSensors: ["GPS_GEOFENCE", "WATERMARK_CAMERA"],
  sensorFallbackLadder: {
    GPS_GEOFENCE: ["CELL_TOWER_COARSE_GEO", "MANUAL_BASE_PHOTO_AUDIT"],
    WATERMARK_CAMERA: ["HTML5_NATIVE_FALLBACK"],
  },

  /* D5 正向钩子（HOOK_OPERATOR_REGISTRY 静态白名单解析） */
  forwardHooks: ["ArrivalCheckHook", "CleaningCheckHook"],

  /* D6 逆向违约阶梯（匹配前全退 → 途中 80%+20 → 现场 50% → 服务中 0%） */
  cancellationTiers: [
    { stage: "BEFORE_MATCH", demanderRefundRatio: 1, providerCompensationYuan: 0, deductDepositRatio: 0 },
    { stage: "AFTER_MATCH_EN_ROUTE", demanderRefundRatio: 0.8, providerCompensationYuan: 20, deductDepositRatio: 0.2 },
    { stage: "ON_SITE", demanderRefundRatio: 0.5, providerCompensationYuan: 0, deductDepositRatio: 0.5 },
    { stage: "IN_SERVICE", demanderRefundRatio: 0, providerCompensationYuan: 0, deductDepositRatio: 1 },
  ],

  /* D6.5 SLA 阶段时间纪律（30min 接单 / 60min 出发） */
  slaPhases: {
    ACCEPTED: 1800,
    DEPARTED: 3600,
  },
  fundingMode: "full_prepay",
  /* D7 清算与仲裁（24h 超时代验收 + 分账资金守恒 0.85+0.10+0.05=1.0） */
  autoAcceptanceTimeoutHours: 24,
  splitRules: { providerRatio: 0.85, platformRatio: 0.1, insuranceRatio: 0.05 },

  /* D8 视界与表单（default 主题 + HousekeepingSlot 复用 + 宠物表单） */
  theme: "default",
  /* D9 履约行动契约：交接体检双拍 · dyn 通用视口（derive 自动推导 PROOF_PHOTO） */
  actionSchema: {
    variant: "dyn",
    modules: [{ module: "PROOF_PHOTO" }, { module: "GEOFENCE_ARRIVAL" }],
  },
  cockpitSlot: "HousekeepingSlot",
  formSchema: {
    petType: {
      type: "select",
      options: ["dog", "cat"],
      required: true,
    },
    petAgeWeight: { type: "string", required: false },
    specialNotes: { type: "string", required: false },
  },

  /* 发布端中文类目检索别名（D8 声明式元数据） */
  aliases: [
    "宠物寄养",
    "寄养",
    "猫咪寄养",
    "狗狗寄养",
    "家庭寄养",
    "宠物托养",
  ],
};

/* =====================================================================
 * 弹药定义（AmmoFactory 流水线出厂 · 全图冻结不可变发布）
 * ===================================================================== */

/**
 * 宠物家庭寄养 · 官方标准弹药（方向 B 第 5 弹 · 8D 全息装配出厂）。
 *
 * 出厂门禁（模块加载期强制）：资金守恒、三比 1.0、加价熔断、计价护栏、
 * C2 入户安全、违约阶梯、钩子白名单——任一不通过即抛错拒绝出厂。
 *
 * 投影字段 + 存量派单/SOP 显式写入后整体 deepFreeze 冻结发布。
 */
const _petBoardingAssembled = assembleAmmo(PET_BOARDING_HOLOGRAPHIC_CONFIG);
if (!_petBoardingAssembled.ok) {
  throw new Error(
    `[AmmoFactory] pet-boarding-v1 出厂被拒: ${_petBoardingAssembled.errors.join("; ")}`
  );
}

export const petBoardingAmmo: Readonly<IAmmoDefinition> = deepFreeze({
  ..._petBoardingAssembled.ammo,
  dispatchRule: {
    weights: { distance: 40, credit: 25, custom: 20, verifiedBonus: 5 },
    hardGates: {
      requiresVerified: ["宠物寄养", "上门"],
      banned: true,
      online: true,
    },
  },
  sop: {
    depositDefault: true,
    expiresInMs: 2 * 3600_000,
    capacityDefault: 1,
    maxRounds: 3,
    reviewWindowMs: 48 * 3600_000,
    depositRate: 0.2,
  },
});
