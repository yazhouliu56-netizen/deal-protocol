/**
 * 第四枚官方标准弹药：appliance-repair-v1（家电上门维修 · C3 技术资产与 B 端影子供给）。
 *
 * 首枚 C3_TECH_B2B 品类弹药（技术资产运力池）：全仓此前三枚标杆弹药分别覆盖
 * C2_IN_HOME（家庭深度保洁 housekeeping-v1）/ C1_MOBILITY（组局 meetup-social-v1 /
 * 陪玩 companion-v1），本弹首次装填「技术资产与 B 端影子供给」聚类——维修技师
 * 以实技证书 + 公安无犯罪核验背书入户，接受碰炸引信强合规（与进家类同级的
 * 财产/隐私暴露面，但供给侧靠专业技能分认证而非家政健康证）。
 *
 * 8D 全息化（人类创始人注入 2026-08-19 · 扩品实战第 4 枚）：
 *   - D1 供给准入：C3_TECH_B2B 技术运力池；实名 ≥ REAL_NAME + 安全分 ≥ 70 +
 *     公安无犯罪核验 + 电工/家电维修双证书（ELECTRICIAN_CERT +
 *     APPLIANCE_MAINTENANCE_CERT）。
 *   - D2 计价与护栏：FORMULA 公式计价（baseRate ¥30 上门检测费 / baseDurationMin
 *     60 分钟基准）；地板 30 元 / 天花板 3000 元（3000/300000 分）；增项加价
 *     熔断 ≤50%；技能分（SKILL_LEVEL）定向折抵 ≤30%（引擎保守位：评估器
 *     evaluateDepositWaiver 对 SKILL_LEVEL 维度零折抵，声明保留语义）。
 *   - D3 风控引信：💥 IMPACT_INHOME_FUZE_TEMPLATE（碰炸·入户武装版：高财产双拍存证 + SOS 四开关全开）。
 *   - D4 传感降级：GPS 围栏 + 水印相机；失效逐级回退基站粗定位/人工照片
 *     审核/原生摄像头。
 *   - D5 正向钩子：ArrivalCheckHook（到点履约）+ OnsiteQuoteHook（现场增项
 *     报价确认，禁先干后说价）+ CleaningCheckHook（完工双拍验收）——
 *     「增项确认 → 双拍验收」两段式现场微流程与家政同构。
 *   - D6 逆向违约阶梯：匹配前 100% 退 → 途退 80%+20 元车马费 →
 *     已到现场扣 30 元上门检测费/退剩余（0.7 比例 + ¥30 补偿, 守恒 100）→
 *     服务中 0% 退扣全额。
 *   - D7 清算与仲裁：48h 超时代验收（质保观察期）；分账三比 0.82/0.13/0.05
 *     （技术类目服务者高分成，资金守恒硬校验）。
 *   - D8 视界与表单：default 主题 + HousekeepingSlot 履约座舱插槽（复用家政
 *     现场增项/双拍验收视口）+ 家电类型下拉 + 故障描述文本表单。
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
 * 家电上门维修 · 8 维全息声明（D1~D8，资金守恒/双证书准入/加价熔断出厂硬检）。
 *
 * 出厂审查要点（validateAmmoConfig 全项）：
 *  - 分账守恒：0.82 + 0.13 + 0.05 = 1.0（±1e-9 容差）；
 *  - 加价熔断：maxSurchargeRatio = 0.5 ≤ 0.5 上限；
 *  - 计价护栏：minFloorPrice 3000 ≤ maxCeilingPrice 300000（分）；
 *  - D5 钩子白名单：ArrivalCheckHook / OnsiteQuoteHook / CleaningCheckHook
 *    全部命中 HOOK_OPERATOR_REGISTRY 静态算子表；
 *  - D6 违约阶梯合法性：各 tier 退款/扣金比例 ∈ [0,1]、车马费 ≥ 0。
 */
export const APPLIANCE_REPAIR_HOLOGRAPHIC_CONFIG: IHolographicAmmoConfig = {
  ammoId: "appliance-repair-v1",
  category: "APPLIANCE_REPAIR",
  version: "1.0.0",

  /* D1 供给准入（C3_TECH_B2B 技术资产运力池 · 双证书 + 公安核验） */
  supplyCluster: "C3_TECH_B2B",
  workerRequirement: {
    requiredIdentityLevel: "REAL_NAME",
    minSafetyScore: 70,
    isPoliceVerified: true,
    requiredCertificates: ["ELECTRICIAN_CERT", "APPLIANCE_MAINTENANCE_CERT"],
  },

  /* D2 计价与护栏（¥30 上门检测费起步 / ¥30~¥3000 护栏 / 增项 50% 熔断） */
  pricingModel: {
    kind: "FORMULA",
    formulaId: "appliance-repair-formula",
    params: { baseRate: 30, baseDurationMin: 60 },
  },
  pricingParams: { baseRate: 30, baseDurationMin: 60 },
  minFloorPrice: 3000,
  maxCeilingPrice: 300000,
  maxSurchargeRatio: 0.5,
  creditWaiverRule: {
    allowedCreditDimension: "SKILL_LEVEL",
    maxWaiverPercentage: 0.3,
  },

  /* D3 风控引信（💥 碰炸·入户武装版：高财产双拍存证 + 强实名 + SOS 四开关全开） */
  fuzePolicy: IMPACT_INHOME_FUZE_TEMPLATE,

  /* D4 传感降级（零信任物理感知 · 宪法 #10） */
  requiredSensors: ["GPS_GEOFENCE", "WATERMARK_CAMERA"],
  sensorFallbackLadder: {
    GPS_GEOFENCE: ["CELL_TOWER_COARSE_GEO", "MANUAL_BASE_PHOTO_AUDIT"],
    WATERMARK_CAMERA: ["HTML5_NATIVE_FALLBACK"],
  },

  /* D5 正向钩子（HOOK_OPERATOR_REGISTRY 静态白名单解析） */
  forwardHooks: ["ArrivalCheckHook", "OnsiteQuoteHook", "CleaningCheckHook"],

  /* D6 逆向违约阶梯（分阶段退款/车马费/保证金扣划） */
  cancellationTiers: [
    { stage: "BEFORE_MATCH", demanderRefundRatio: 1, providerCompensationYuan: 0, deductDepositRatio: 0 },
    { stage: "AFTER_MATCH_EN_ROUTE", demanderRefundRatio: 0.8, providerCompensationYuan: 20, deductDepositRatio: 0.2 },
    { stage: "ON_SITE", demanderRefundRatio: 0.7, providerCompensationYuan: 30, deductDepositRatio: 0 },
    { stage: "IN_SERVICE", demanderRefundRatio: 0, providerCompensationYuan: 0, deductDepositRatio: 1 },
  ],

  /* D6.5 SLA 阶段时间纪律（Microkernel 2.0 战役 1 · 维修备件场景：接单60min/出发120min） */
  slaPhases: {
    ACCEPTED: 3600,
    DEPARTED: 7200,
  },
  fundingMode: "full_prepay",
  /* D7 清算与仲裁（48h 质保验收期 + 分账资金守恒 0.82+0.13+0.05=1.0） */
  autoAcceptanceTimeoutHours: 48,
  splitRules: { providerRatio: 0.82, platformRatio: 0.13, insuranceRatio: 0.05 },

  /* D8 视界与表单（default 主题 + HousekeepingSlot 座舱插槽 + 家电表单） */
  theme: "default",
  cockpitSlot: "HousekeepingSlot",
  formSchema: {
    applianceType: {
      type: "select",
      options: ["空调", "洗衣机", "冰箱", "油烟机", "燃气灶"],
      required: true,
    },
    faultDescription: { type: "string", required: true },
  },

  /* 发布端中文类目检索别名（D8 声明式元数据，非检索硬编码字典） */
  aliases: [
    "家电维修",
    "维修",
    "修空调",
    "修洗衣机",
    "修冰箱",
    "修油烟机",
    "水电维修",
  ],
};

/* =====================================================================
 * 弹药定义（AmmoFactory 流水线出厂 · 全图冻结不可变发布）
 * ===================================================================== */

/**
 * 家电上门维修 · 官方标准弹药（扩品实战第 4 枚 · 8D 全息装配出厂）。
 *
 * 出厂门禁（模块加载期强制）：资金守恒（split 三比合成 1.0 ±1e-9）、
 * 加价熔断 ≤0.5、计价护栏 / 违约阶梯 / 钩子白名单——任一不通过即抛错拒绝出厂。
 *
 * 注：AmmoFactory 投影字段（身份/定价/引信/准入/折抵/全息镜像）；派单规则
 * （dispatchRule）与 SOP 覆盖（sop）为工厂投影之外的存量字段，此处显式写入
 * 完整保留（家电维修/上门中文硬门槛与托管 SOP 语义不因全息化丢失），
 * 再整体 deepFreeze 冻结发布。技术类目 minSafetyScore 70 对齐 tri-credit
 * DEFAULT_ESF_GATE（入户/密闭空间安全分一票否决缺省线）。
 */
const _applianceRepairAssembled = assembleAmmo(APPLIANCE_REPAIR_HOLOGRAPHIC_CONFIG);
if (!_applianceRepairAssembled.ok) {
  throw new Error(
    `[AmmoFactory] appliance-repair-v1 出厂被拒: ${_applianceRepairAssembled.errors.join("; ")}`
  );
}

export const applianceRepairAmmo: Readonly<IAmmoDefinition> = deepFreeze({
  ..._applianceRepairAssembled.ammo,
  dispatchRule: {
    weights: { distance: 40, credit: 25, custom: 20, verifiedBonus: 5 },
    hardGates: {
      requiresVerified: ["家电维修", "上门"],
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