/**
 * 座舱场景解析元数据（Microkernel 2.0 战役 4 · 词表集中地）。
 *
 * FulfillmentCockpit / FulfillmentCenter 的品类硬编码清零收容所：
 * 场景键派生（theme 白名单 + 中文类目正则兜底）与特化插槽键映射全部
 * 收敛本模块，座舱组件仅消费派生结果，零品类词出现。
 */

import type { IAmmoDefinition } from "@/types/ammo-schema";
import { getAmmoById } from "@/ammo/registry";

/** 座舱场景键（由弹药 theme/actionSchema 派生；非入参硬编码枚举）。 */
export type CockpitScenario = "housekeeping" | "meetup" | "companion" | "dynamic";

/** 特化插槽键 → 制式场景映射（D8 弹药 cockpitSlot 声明的历史兼容位）。 */
export const COCKPIT_SLOT_SCENARIO: Record<string, CockpitScenario> = {
  HousekeepingSlot: "housekeeping",
  MeetupSlot: "meetup",
  CompanionSlot: "companion",
};

/** 官方标杆弹 ammoId → 制式场景直映。 */
const OFFICIAL_AMMO_SCENARIO: Record<string, CockpitScenario> = {
  "housekeeping-v1": "housekeeping",
  "meetup-social-v1": "meetup",
  "companion-v1": "companion",
};

/** 中文类目 → 制式场景正则兜底（历史行为守恒；词表唯一收容点）。 */
const CATEGORY_SCENARIO_RULES: Array<[RegExp, CockpitScenario]> = [
  [/家政|保洁|打扫|水电|维修|搬家/, "housekeeping"],
  [/陪玩|交友|dating|social/, "companion"],
  [/羽毛球|约局|组局|桌游|拼桌/, "meetup"],
];

/**
 * 纯函数：wave → 场景插槽键。
 * 检索链：D8 cockpitSlot 声明优先 → 官方 ammoId 直映 → 中文类目正则
 * 兜底 → dynamic 通用插槽（零白屏）。
 */
export function resolveCockpitScenario(wave: {
  ammoId?: string;
  basics: { category: string };
}): CockpitScenario {
  const ammoId = wave.ammoId ?? "";
  if (ammoId) {
    const slot = getAmmoById(ammoId).holographic?.cockpitSlot;
    if (slot && COCKPIT_SLOT_SCENARIO[slot]) return COCKPIT_SLOT_SCENARIO[slot];
    const official = OFFICIAL_AMMO_SCENARIO[ammoId];
    if (official) return official;
  }
  const cat = wave.basics.category;
  for (const [rule, scenario] of CATEGORY_SCENARIO_RULES) {
    if (rule.test(cat)) return scenario;
  }
  return "dynamic";
}

/**
 * 纯函数：整弹 → 场景键（座舱新主通道）：theme 白名单直映，
 * default/tech/未知 → dynamic（与 normalizeAmmoTheme 同族语义）。
 */
export function scenarioFromAmmo(ammo: IAmmoDefinition): CockpitScenario {
  const theme = ammo.holographic?.theme;
  if (theme === "housekeeping" || theme === "meetup" || theme === "companion") {
    return theme;
  }
  return "dynamic";
}

/* ═══════════════════════════════════════════════════════════════════
 * 场景主题元数据 / 核销 CTA / 主题作用域解析（自 FulfillmentCockpit
 * 收容迁移 · 战役 4 词表清零）：组件经 re-export 保持导入面兼容。
 * ═══════════════════════════════════════════════════════════════════ */

import type { ScenarioTheme } from "@/types/ui-viewport";
import { normalizeAmmoTheme } from "./DynamicAmmoSlot";

/** 场景 → 主题微色元数据（白皮书 5.7 维度 1 的 Token 投影）。 */
export const SCENARIO_THEME_META: Record<
  CockpitScenario,
  { themeClass: string; accent: string; label: string }
> = {
  housekeeping: { themeClass: "theme-housekeeping", accent: "#3884ff", label: "清洁蓝 · 重入户" },
  meetup: { themeClass: "theme-meetup", accent: "#f97316", label: "活力橙 · 轻履约" },
  companion: { themeClass: "theme-companion", accent: "#a78bfa", label: "夜幕紫 · 高人身风险" },
  dynamic: { themeClass: "theme-dynamic", accent: "#00f0ff", label: "自适应 · 长尾动态弹药" },
};

/** 底部核销 CTA 文案（白皮书 5.7 维度 5：场景特化完工动作）。 */
export function describeCompletionCta(scenario: CockpitScenario): string {
  switch (scenario) {
    case "housekeeping":
      return "🤝 双方碰一碰 NFC · 验收清单打钩";
    case "meetup":
      return "🛡️ 组织者点选到场成员 · 解冻定金";
    case "companion":
      return "📡 300m 脱离自动完成 · 或手动确认";
    case "dynamic":
      return "✳️ 按弹药契约核销 · 或手动确认";
  }
}

/**
 * D-8 视口主题作用域键解析：制式场景直映主题键；dynamic 场景按弹药
 * holographic.theme 归一挂载；未传/未知安全回落 default（红线 6）。
 */
export function resolveCockpitTheme(
  scenario: CockpitScenario,
  ammo?: IAmmoDefinition,
): ScenarioTheme {
  switch (scenario) {
    case "housekeeping":
      return "housekeeping";
    case "meetup":
      return "meetup";
    case "companion":
      return "companion";
    case "dynamic":
      return normalizeAmmoTheme(ammo?.holographic?.theme);
  }
}

/**
 * D9 模块声明判定：弹药行动 Schema 是否装配指定原子模块
 * （显式 actionSchema 优先，缺省按传感/钩子/计价推导同宿主规则）。
 * 座舱场景特化 UI 的显隐以此驱动，替代品类字符串比较。
 */
export function hasCockpitModule(
  ammo: IAmmoDefinition | null | undefined,
  module: import("@/types/ammo-schema").CockpitActionModule,
): boolean {
  if (!ammo) return false;
  const schema = ammo.holographic?.actionSchema;
  if (schema) return schema.modules.some((m) => m.module === module);
  const holo = ammo.holographic;
  const sensors = holo?.requiredSensors ?? [];
  const hooks = holo?.forwardHooks ?? [];
  switch (module) {
    case "ONSITE_QUOTE":
      return hooks.includes("OnsiteQuoteHook");
    case "PROOF_PHOTO":
      return sensors.includes("WATERMARK_CAMERA") || hooks.includes("CleaningCheckHook");
    case "GEOFENCE_ARRIVAL":
      return sensors.includes("GPS_GEOFENCE") && hooks.includes("ArrivalCheckHook");
    case "AA_SPLIT":
      return hooks.includes("AASplitSettleHook") || ammo.pricingModel.kind === "PER_SEAT";
    case "PRIVACY_SHIELD":
    case "DEPARTURE_STOP":
      return hooks.includes("PrivacyShieldHook");
  }
}
