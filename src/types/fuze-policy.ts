/**
 * 三类动态风控引信策略契约（Fuze Policy Contracts）。
 *
 * 人类创始人注入（2026-08-15）：风控随弹药走——每颗弹药声明其引信类型与
 * 参数，底座按表实施「碰炸 / 延期 / 近炸」三类防护。本文件为底层协议
 * （红线 3：`UI / Ammo ➔ base ➔ types`），不依赖任何业务模块。
 */

/** 引信类型：💥碰炸 / ⏳延期 / 📡近炸（可多引信并联，见 IFuzePolicy.fuzeType 数组）。 */
export type FuzeType = "IMPACT" | "DELAY" | "PROXIMITY";

/** 背调级别（准入强校验，碰炸引信主武器）。 */
export type BackgroundCheckLevel = "NONE" | "BASIC" | "STANDARD" | "HARD";

/** 押金策略：免押 / 固定金额 / 按单比例 / 全额冻结。 */
export type DepositStrategy = "NONE" | "FIXED" | "RATIO" | "FREEZE";

/** LBS 电子围栏：服务者进入半径圈才解锁履约（延期引信）。 */
export interface IGeoFencePolicy {
  enabled: boolean;
  /** 围栏半径（米），0 = 按类目默认。 */
  radiusM?: number;
  /** 到点自动解锁（true）或需双方确认（false）。 */
  unlockOnArrival: boolean;
  /** 围栏外进入「待命」态（不触发违约）。 */
  gracePeriodMs?: number;
}

/** 隐私策略（近炸引信）：虚拟号 + 模糊定位。 */
export interface IPrivacyPolicy {
  /** 号码池虚拟中转（base/comm/privacyNumber 48h 会话）。 */
  virtualNumber: boolean;
  /** 位置模糊化（只给 500m 网格 / 小区级）。 */
  blurLocation: boolean;
  /** 对话敏感词 AI 干预（base/ai 鉴言，含降级链）。 */
  sensitiveWordIntervention: boolean;
}

/** 一键 SOS 联动规则（近炸引信）：危机 → 上报位置 + 录音证据入链。 */
export interface ISosPolicy {
  enabled: boolean;
  /** 自动上报当前模糊定位（base/safe/crisis 链路）。 */
  autoLocationReport: boolean;
  /** 自动封装录音/现场证据入数据湖哈希链（base/platform/resilience lake）。 */
  autoEvidenceAppend: boolean;
  /** SOS 触发后的紧急联系人通知链（EPA 派发）。 */
  notifyEmergencyContacts: boolean;
}

/**
 * 引信策略（每颗弹药声明一组；多引信取并集，防护等级取最高）。
 */
export interface IFuzePolicy {
  /** 策略唯一标识（弹药表内引用）。 */
  fuzeId: string;
  /** 引信类型（可并联多类）。 */
  fuzeTypes: FuzeType[];
  /* ===== 💥 碰炸引信（IMPACT）：高财产 / 入户风险 ===== */
  /** 背调级别。 */
  backgroundCheck: BackgroundCheckLevel;
  /** 押金策略。 */
  deposit: {
    strategy: DepositStrategy;
    /** FIXED 时使用（¥）。 */
    amountYuan?: number;
    /** RATIO / FREEZE 时使用（0-1，按单金额）。 */
    ratio?: number;
  };
  /** 过程留痕：照片证据 + 存证链。 */
  trace: {
    photoProof: boolean;
    evidenceChain: boolean;
  };
  /** 财产险（平台兜底赔付开关）。 */
  propertyInsurance: boolean;
  /* ===== ⏳ 延期引信（DELAY）：履约 / 爽约风险 ===== */
  /** 预付定金冻结（发单即冻结，服务完成前不可动用）。 */
  advanceFreeze: {
    enabled: boolean;
    /** 冻结比例（0-1）。 */
    ratio?: number;
  };
  /** LBS 电子围栏（到点解锁 / 违约判定锚点）。 */
  geoFence: IGeoFencePolicy;
  /** 反赌反诈过滤（违禁资金场景拦截）。 */
  antiFraudFilter: boolean;
  /* ===== 📡 近炸引信（PROXIMITY）：人身 / 交友风险 ===== */
  /** 隐私级别：虚拟号 + 模糊定位 + 敏感词干预。 */
  privacy: IPrivacyPolicy;
  /** 一键 SOS 联动。 */
  sos: ISosPolicy;
}

/** 缺省引信：全类目最低配置（未声明引信 = 零防护兜底，弹药必须显式装填）。 */
export const DEFAULT_FUZE_POLICY: IFuzePolicy = {
  fuzeId: "fuze-default",
  fuzeTypes: [],
  backgroundCheck: "NONE",
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
};

/** 预置模板：💥 碰炸引信（进家 / 高财产类目模板）。 */
export const IMPACT_FUZE_TEMPLATE: IFuzePolicy = {
  ...DEFAULT_FUZE_POLICY,
  fuzeId: "fuze-impact",
  fuzeTypes: ["IMPACT"],
  backgroundCheck: "HARD",
  deposit: { strategy: "RATIO", ratio: 0.2 },
  trace: { photoProof: true, evidenceChain: true },
  propertyInsurance: true,
};

/** 预置模板：⏳ 延期引信（履约 / 爽约敏感类目模板）。 */
export const DELAY_FUZE_TEMPLATE: IFuzePolicy = {
  ...DEFAULT_FUZE_POLICY,
  fuzeId: "fuze-delay",
  fuzeTypes: ["DELAY"],
  backgroundCheck: "BASIC",
  advanceFreeze: { enabled: true, ratio: 0.3 },
  geoFence: { enabled: true, radiusM: 500, unlockOnArrival: true, gracePeriodMs: 15 * 60_000 },
  antiFraudFilter: true,
};

/** 预置模板：📡 近炸引信（人身 / 交友类目模板）。 */
export const PROXIMITY_FUZE_TEMPLATE: IFuzePolicy = {
  ...DEFAULT_FUZE_POLICY,
  fuzeId: "fuze-proximity",
  fuzeTypes: ["PROXIMITY"],
  backgroundCheck: "STANDARD",
  privacy: {
    virtualNumber: true,
    blurLocation: true,
    sensitiveWordIntervention: true,
  },
  sos: {
    enabled: true,
    autoLocationReport: true,
    autoEvidenceAppend: true,
    notifyEmergencyContacts: true,
  },
};

/**
 * 预置模板：💥碰炸·入户武装版（入户重背调类目专用，宪法 #2 只增补派生）。
 * IMPACT 全量身份不变（背调 HARD + 押金 20% + 双拍存证 + 财产险），
 * 增配一键 SOS 四开关全开——进家入户品类默认武装轨迹上报与录音存证
 * （宪法 #5 引信跟弹药走；2026-08-25 指挥官裁决正式启用）。
 */
export const IMPACT_INHOME_FUZE_TEMPLATE: IFuzePolicy = Object.freeze({
  ...IMPACT_FUZE_TEMPLATE,
  fuzeId: "fuze-impact-inhome",
  sos: {
    enabled: true,
    autoLocationReport: true,
    autoEvidenceAppend: true,
    notifyEmergencyContacts: true,
  },
});
