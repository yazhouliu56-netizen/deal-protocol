/**
 * 账号漫游风控（P8 商业化前哨，纯本地 demo）。
 * 漫游 = 同一身份在不同设备间合法迁移；多开风控 = 同一设备绑定多个身份
 * （单人多号刷羊毛/刷信誉）—— 用设备×身份绑定矩阵评估风险。
 * 纯函数：无 IO、无随机，时间与指纹全部注入，SSR/测试安全。
 */

/** 家庭共机容错：同设备 ≤2 个身份视为可接受（watch 提示不处罚）。 */
export const ROAM_RULES = { maxPerDeviceForFamily: 2, freezeAt: 3 } as const;

/** 引信参数（与 ammo/risk-rule 的 roam-guard params 结构兼容，缺省 = 现状）。 */
export interface RoamRuleParams {
  /** 同设备身份数 ≤ 此值 → watch（家庭共机容忍线）。 */
  warnThreshold: number;
  /** 同设备身份数 > 此值 → high（多开刷号冻结线）。 */
  freezeThreshold: number;
}

export const DEFAULT_ROAM_PARAMS: RoamRuleParams = {
  warnThreshold: ROAM_RULES.maxPerDeviceForFamily,
  freezeThreshold: ROAM_RULES.freezeAt,
};

export type RiskLevel = "safe" | "watch" | "high";

export type DeviceBinding = {
  deviceId: string;
  identityId: string;
  firstSeen: number;
  lastSeen: number;
};

export type RoamEventKind = "roam" | "login" | "alert" | "reset";

export type RoamEvent = {
  at: number;
  kind: RoamEventKind;
  note: string;
};

/** djb2 字符串哈希 → 短 hex 指纹（确定性：同 ua+seed 同 id）。 */
export function makeDeviceId(ua: string, seed: string): string {
  let h = 5381;
  const s = `${ua}|${seed}`;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return `dev-${h.toString(16).slice(0, 8)}`;
}

/** 同设备身份数 → 风险分级（count=0 视为未登记，safe）。
 * params 缺省 = 现状阈值；由 ammo/risk-rule 的 roam-guard 引信参数驱动（宪法 #5）。 */
export function riskOf(
  bindings: DeviceBinding[],
  deviceId: string,
  params: RoamRuleParams = DEFAULT_ROAM_PARAMS
): { risk: RiskLevel; count: number; reason: string } {
  const count = bindings.filter((b) => b.deviceId === deviceId).length;
  if (count === 0 || count === 1) {
    return { risk: "safe", count, reason: count === 0 ? "未在设备登记" : "单身份使用" };
  }
  if (count <= params.warnThreshold) {
    return {
      risk: "watch",
      count,
      reason: `${count} 个身份共用设备（家庭共机可接受，注意行为一致性）`,
    };
  }
  return {
    risk: "high",
    count,
    reason: `${count} 个身份共用一台设备，疑似多开刷号 — 建议冻结验证`,
  };
}

/** 登记一个身份到设备（幂等：已绑定 → 只刷新 lastSeen）。 */
export function bind(
  bindings: DeviceBinding[],
  deviceId: string,
  identityId: string,
  now: number
): { bindings: DeviceBinding[]; fresh: boolean } {
  const exists = bindings.find(
    (b) => b.deviceId === deviceId && b.identityId === identityId
  );
  if (exists) {
    return {
      bindings: bindings.map((b) =>
        b === exists ? { ...b, lastSeen: now } : b
      ),
      fresh: false,
    };
  }
  return {
    bindings: [...bindings, { deviceId, identityId, firstSeen: now, lastSeen: now }],
    fresh: true,
  };
}

/** 漫游：身份离开旧设备、登录新设备（旧绑定移除 → 同设备身份数下降）。 */
export function roam(
  bindings: DeviceBinding[],
  fromDeviceId: string,
  toDeviceId: string,
  identityId: string,
  now: number
): { bindings: DeviceBinding[]; event: RoamEvent } {
  const rest = bindings.filter(
    (b) => !(b.deviceId === fromDeviceId && b.identityId === identityId)
  );
  const next = bind(rest, toDeviceId, identityId, now).bindings;
  return {
    bindings: next,
    event: {
      at: now,
      kind: "roam",
      note: `${identityId} 漫游 ${fromDeviceId} → ${toDeviceId}`,
    },
  };
}

/** 多开模拟：同设备追加一个身份 → 触发风控升级。 */
export function extraLogin(
  bindings: DeviceBinding[],
  deviceId: string,
  identityId: string,
  now: number,
  params: RoamRuleParams = DEFAULT_ROAM_PARAMS
): { bindings: DeviceBinding[]; event: RoamEvent; risk: RiskLevel } {
  const { bindings: next, fresh } = bind(bindings, deviceId, identityId, now);
  const { risk } = riskOf(next, deviceId, params);
  return {
    bindings: next,
    risk,
    event: fresh
      ? {
          at: now,
          kind: risk === "safe" ? "login" : "alert",
          note: `身份 ${identityId} 登录设备 ${deviceId}（同设备身份数核查 → ${risk}）`,
        }
      : {
          at: now,
          kind: "login",
          note: `身份 ${identityId} 刷新活动（设备 ${deviceId}）`,
        },
  };
}