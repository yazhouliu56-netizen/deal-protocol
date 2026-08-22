/**
 * 沙盒 Bot 服务者自动响应调度器（P0 双边市场空转治理 · 2026-08-22）
 *
 * 职责：本地沙盒/演示模式下，用户发布的 active Wave 在 5 秒后由演示人设
 * 经「真实 Store 状态机链路」接单 —— 1v1 走 openClaim → acceptClaim
 * （底层跃迁 locked + 隐私号自动分配），拼位组局走 joinSeat（占 1 席，
 * 内部自动 capture 占座款，呈现真实 1/N 拼单进度）。
 *
 * 红线合规：
 * - 红线 1：delayMs 全入参化（测试传 0），调度判定零概率全确定；
 * - 红线 3：本文件为 base 层纯函数调度器，严禁 import React / Toast，
 *   UI 反馈经 IBotDispatchResult 由页面层承接；
 * - 宪法 #2：只消费既有 store action 真实签名，不新增状态机分支。
 */
import type { Claim, Wave } from "../order/wave.ts";
import type { ResponderCapability } from "../dispatch/broadcast.ts";

/** Bot 响应默认延时（毫秒）。 */
export const BOT_RESPONSE_DELAY_MS = 5000;

/** 演示人设（avatar 仅作展示层装饰，不进入 ResponderCapability）。 */
export interface IBotPersona {
  id: string;
  name: string;
  avatar: string;
  /** 广播撮合类目（ResponderCapability.categories 同源口径）。 */
  categories: string[];
  tags: string[];
  /** 信用档位 1-5（与 ResponderCapability.creditLevel 对齐，非百分制）。 */
  creditLevel: number;
  rating: number;
}

/** 四大官方标杆弹药对应人设 + 兜底人设。 */
export const DEMO_BOT_PERSONAS: Record<string, IBotPersona> = {
  "housekeeping-v1": {
    id: "bot-wang",
    name: "王姐",
    avatar: "👩‍🌾",
    categories: ["家政保洁", "厨师 · 上门做饭"],
    tags: ["实名认证", "健康证", "5年保洁"],
    creditLevel: 5,
    rating: 4.9,
  },
  "meetup-social-v1": {
    id: "bot-akai",
    name: "阿凯",
    avatar: "🏸",
    categories: ["羽毛球约局"],
    tags: ["羽协认证", "中级球友", "准时达人"],
    creditLevel: 4,
    rating: 4.8,
  },
  "companion-v1": {
    id: "bot-xiaobei",
    name: "小北",
    avatar: "📷",
    categories: ["摄影师约拍", "陪伴交友"],
    tags: ["摄影协会", "日系写真", "实名认证"],
    creditLevel: 5,
    rating: 4.9,
  },
  "appliance-repair-v1": {
    id: "bot-zhang",
    name: "张师傅",
    avatar: "🔧",
    categories: ["家电维修", "水电维修"],
    tags: ["高级电工证", "持证上岗"],
    creditLevel: 4,
    rating: 4.8,
  },
  default: {
    id: "bot-generic",
    name: "同城服务者",
    avatar: "🧑‍🔧",
    categories: [],
    tags: ["实名认证"],
    creditLevel: 4,
    rating: 4.7,
  },
};

/** 中文品类关键词 → 弹药键（ammoId 缺失时的回落匹配口径）。 */
const CATEGORY_KEYWORD_MAP: Array<[RegExp, string]> = [
  [/家政|保洁|打扫|做饭/, "housekeeping-v1"],
  [/羽毛球|组局|桌游|约局/, "meetup-social-v1"],
  [/摄影|约拍|写真|陪伴|陪聊|搭子/, "companion-v1"],
  [/家电|维修|空调|水电/, "appliance-repair-v1"],
];

/**
 * 人设选择：ammoId 精确命中优先 → 中文品类关键词回落 → default 兜底。
 * 纯函数、零副作用，确定性可测。
 */
export function personaForWave(ammoId?: string, category?: string): IBotPersona {
  if (ammoId) {
    const hit = DEMO_BOT_PERSONAS[ammoId];
    if (hit) return hit;
  }
  if (category) {
    for (const [re, key] of CATEGORY_KEYWORD_MAP) {
      if (re.test(category)) return DEMO_BOT_PERSONAS[key];
    }
  }
  return DEMO_BOT_PERSONAS.default;
}

/**
 * 人设 → ResponderCapability 标准结构映射（真实类型对齐：
 * nickname/categories/tags/creditLevel(1-5)/rating/verified/online）。
 * avatar 不入 capability（响应者头像由展示层 IdentityAvatar emoji 兜底）。
 */
export function personaToCapability(p: IBotPersona): ResponderCapability {
  return {
    id: p.id,
    nickname: p.name,
    categories: p.categories,
    tags: p.tags,
    creditLevel: p.creditLevel,
    rating: p.rating,
    verified: true,
    online: true,
  };
}

/** 调度器注入的最小 Store action 面（与 useWaveStore 真实签名严格一致）。 */
export interface IBotStoreActions {
  /** 执行时刻重读最新 Wave（防过期快照：5s 窗口内取消发布/关闭安全中止）。 */
  getLatestWave: (waveId: string) => Wave | undefined;
  /** 查顶层持久化 claims 集合（防刷新重复派单 + 真实用户抢先时退让）。 */
  hasClaimForWave: (waveId: string) => boolean;
  registerResponder: (responder: ResponderCapability) => void;
  openClaim: (p: {
    waveId: string;
    responderId: string;
    price: number;
  }) => { claim?: Claim; error?: string };
  acceptClaim: (claimId: string) => void;
  joinSeat: (p: {
    waveId: string;
    responderId: string;
  }) => { claim?: Claim; assembled?: boolean; error?: string };
}

/** 调度结果描述符（UI 反馈的唯一数据源，base 层不碰 Toast）。 */
export interface IBotDispatchResult {
  success: boolean;
  waveId: string;
  personaName?: string;
  mode?: "locked" | "joined";
  /** 组局补席后是否满员成局（joinSeat.assembled 直传）。 */
  assembled?: boolean;
  reason?: string;
}

/** 会话内防抖集合：同一 Wave 本会话只允许排程一次（跨 effect 重跑幂等）。 */
const scheduledWaveIds = new Set<string>();

/** 执行时刻的真实派单（scheduleBotResponse 定时器到期后调用）。 */
export function dispatchBotResponse(
  waveId: string,
  actions: IBotStoreActions
): IBotDispatchResult {
  // 防过期快照：以执行时刻的最新状态为准，不信闭包旧对象
  const wave = actions.getLatestWave(waveId);
  if (!wave || wave.status !== "active" || wave.removed) {
    return { success: false, waveId, reason: "wave-not-active" };
  }
  if (actions.hasClaimForWave(waveId)) {
    return { success: false, waveId, reason: "already-claimed" };
  }
  const persona = personaForWave(wave.ammoId, wave.basics?.category);
  actions.registerResponder(personaToCapability(persona));
  const isGroupMatch = (wave.capacity ?? 1) >= 2;
  if (isGroupMatch) {
    const out = actions.joinSeat({ waveId, responderId: persona.id });
    if (!out.claim) {
      return {
        success: false,
        waveId,
        personaName: persona.name,
        mode: "joined",
        reason: out.error ?? "join-failed",
      };
    }
    return {
      success: true,
      waveId,
      personaName: persona.name,
      mode: "joined",
      assembled: out.assembled ?? false,
    };
  }
  const claimed = actions.openClaim({
    waveId,
    responderId: persona.id,
    price: typeof wave.budget === "number" ? wave.budget : 0,
  });
  if (!claimed.claim) {
    return {
      success: false,
      waveId,
      personaName: persona.name,
      mode: "locked",
      reason: claimed.error ?? "claim-failed",
    };
  }
  actions.acceptClaim(claimed.claim.id);
  return { success: true, waveId, personaName: persona.name, mode: "locked" };
}

/**
 * 排程一次沙盒 Bot 接单。
 * - 同一 waveId 会话内幂等（已排程返回 null，杜绝 effect 重跑/多 Tab 双触发）；
 * - 排程前预检最新状态与既有 claim（刷新场景由持久化 claims 判定拦截）；
 * - 返回清理句柄（cancel = clearTimeout + 释放会话占位，允许重新排程）；
 * - delayMs 注入式（红线 1），测试传 0 极速验证。
 */
export function scheduleBotResponse(
  waveId: string,
  actions: IBotStoreActions,
  delayMs: number = BOT_RESPONSE_DELAY_MS,
  onComplete?: (res: IBotDispatchResult) => void
): (() => void) | null {
  if (scheduledWaveIds.has(waveId)) return null;
  const latest = actions.getLatestWave(waveId);
  if (!latest || latest.status !== "active" || latest.removed) return null;
  if (actions.hasClaimForWave(waveId)) return null;
  scheduledWaveIds.add(waveId);
  const timer = setTimeout(() => {
    onComplete?.(dispatchBotResponse(waveId, actions));
  }, delayMs);
  return () => {
    clearTimeout(timer);
    scheduledWaveIds.delete(waveId);
  };
}

/** 测试隔离口：清空会话防抖集合（仅测试使用）。 */
export function resetSandboxBotForTest(): void {
  scheduledWaveIds.clear();
}

/** Bot id → 头像 emoji（展示层名片消费；非 Bot id 返回 undefined 走既有兜底）。 */
const BOT_AVATARS_BY_ID = new Map(
  Object.values(DEMO_BOT_PERSONAS).map((p) => [p.id, p.avatar] as const)
);
export function personaAvatarForBot(botId: string): string | undefined {
  return BOT_AVATARS_BY_ID.get(botId);
}
