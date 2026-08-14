/**
 * 未成年人分级模式（age gate）— 纯函数层。
 *
 * 依据《未成年人网络保护条例》(2024-01-01) §31/§43 与《未成年人保护法》§72/§76：
 *   法律不禁止未成年人使用信息发布/即时通讯类服务，但要求：
 *     - 提供信息发布/IM 服务 → 须取得真实身份信息（§31，否则不得提供服务）；
 *     - 针对不同年龄阶段设置未成年人模式，在使用时段/时长/功能上分级（§43）；
 *     - 不满 14 周岁个人信息处理需监护人同意（未保法 §72）。
 * 因此本实现采用「分级」而非「一刀切禁用」：
 *   - 0-13 岁（儿童）：监护人同意 + 仅浏览/围观，不可发布、不可参与任何资金动作；
 *   - 14-17 岁（青少年）：实名 + 未成年人模式，可参与免费组局与信息发布，
 *     但**不可触碰涉及资金托管的动作**（发布费/押金/竞拍/保险/托管结算）；
 *   - 18 岁+（成年）：完整功能。
 * 资金闸（资金动作 vs 免费动作）由 isMoneyAction 语义 + 弹药引信 age-required 共同驱动。
 *
 * Pure + 无 IO/随机，时间注入，SSR/测试安全。
 */

/** 资金动作语义：需要资金托管的撮合动作（发布费/押金/竞拍/保险/托管结算）。 */
export type MoneyAction =
  | "publish-fee" // 发布费（免费次数用尽后）
  | "deposit" // 押金 / 鸽子险
  | "bidding" // 竞价出价
  | "insurance" // 履约保险投保
  | "escrow-settle"; // 托管结算（资金进账/出账）

/** 非资金动作：信息发布 / 浏览 / 免费组局响应。 */
export type FreeAction = "publish" | "respond" | "browse";

export type Action = MoneyAction | FreeAction;

export type GuardMode = "adult" | "teen" | "child";

export const AGE = {
  childMax: 13, // <14 为儿童（未保法 §72 不满 14 周岁）
  teenMax: 17, // 14-17 为青少年
} as const;

export interface AgeGateResult {
  mode: GuardMode;
  /** 该动作是否被拦截。 */
  blocked: boolean;
  /** 拦截/降级理由（面向 UI）。 */
  reason: string;
}

const MONEY_REASONS: Record<MoneyAction, string> = {
  "publish-fee": "未成年人模式：涉及发布费的资金动作不可用（14-17 岁可用每日免费次数发布，超出部分由监护人处理）",
  deposit: "未成年人模式：押金/鸽子险涉及资金托管，不可用",
  bidding: "未成年人模式：竞价出价涉及资金，不可用",
  insurance: "未成年人模式：履约保险投保涉及资金，不可用",
  "escrow-settle": "未成年人模式：托管结算涉及资金往来，不可用",
};

/** 年龄 → 分级模式（birthYear 注入，避免依赖当前时间推导不纯）。 */
export function modeOfAge(age: number): GuardMode {
  if (age >= 18) return "adult";
  if (age >= 14) return "teen";
  return "child";
}

/** 由出生年份与当前年份推年龄（纯函数，two years 由调用方注入）。 */
export function ageFromBirthYear(birthYear: number, currentYear: number): number {
  return Math.max(0, currentYear - birthYear);
}

export interface AgeGateInput {
  age: number;
  action: Action;
  /** 14 岁以下儿童须监护人同意才能使用浏览（未保法 §72）。 */
  guardianConsent?: boolean;
  /** 未成年人模式开关（默认开启 —— 青少年未关闭前即生效，宪法 #8 血液规则默认保护）。 */
  guardMode?: boolean;
}

/**
 * 分级判定：
 *  - adult：全放行；
 *  - teen（14-17）：资金动作全拦，免费动作放行（guardMode 关闭视为放弃保护 → 仍拦资金，仅放行免费）；
 *  - child（0-13）：无监护人同意 → 全拦（含浏览）；有同意 → 免费动作放行、资金动作仍拦。
 *  注：guardMode=false（家长关闭保护）也**无法解除资金闸** —— 资金约束来自法规，不来自用户偏好。
 */
export function ageGate(input: AgeGateInput): AgeGateResult {
  const mode = modeOfAge(input.age);
  if (mode === "adult") {
    return { mode, blocked: false, reason: "成年用户，完整功能" };
  }
  const isMoney = (a: Action): a is MoneyAction =>
    ["publish-fee", "deposit", "bidding", "insurance", "escrow-settle"].includes(a);

  // 儿童：监护人同意是使用前提（含浏览）。
  if (mode === "child" && !input.guardianConsent) {
    return {
      mode,
      blocked: true,
      reason: "儿童账号需监护人同意后才能使用本平台（《未成年人保护法》§72）",
    };
  }
  // 资金闸：不因 guardMode=false 解除。
  if (isMoney(input.action)) {
    return { mode, blocked: true, reason: MONEY_REASONS[input.action] };
  }
  // 免费动作：儿童（有同意）仅可浏览围观，不可发布/响应（分级 §43）；
  // 青少年免费动作（发布/响应/浏览）放行。
  if (mode === "child") {
    if (input.action !== "browse") {
      return {
        mode,
        blocked: true,
        reason: "儿童账号仅可浏览围观，不可发布或响应（分级模式 §43）",
      };
    }
    return { mode, blocked: false, reason: "浏览已放行（儿童账号，监护人同意在册）" };
  }
  return { mode, blocked: false, reason: "免费动作已放行（未成年人模式：资金功能受限）" };
}

/**
 * 发布资金判定：免费发布次数内是免费动作；超出需付发布费 → 资金动作。
 * 用于 PublishSheet 在「扣免费次数」还是「付发布费」之间按年龄分派。
 */
export function isPaidPublish(freeQuotaLeft: number): boolean {
  return freeQuotaLeft <= 0;
}

/** 未成年人是否可参与某类目（弹药引信 age-required 驱动；默认 false 表示不限制）。 */
export function categoryRequiresAdult(category: string, ageRequiredCategories: string[]): boolean {
  return ageRequiredCategories.includes(category);
}
