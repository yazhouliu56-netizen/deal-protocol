/**
 * Scene-template mapping (pure, unit-testable).
 * AR "预览" shows one procedural 3D stage per space intent without shipping
 * extra GLB files — only the home furniture model exists (lounge.glb).
 */
export type SceneTemplate =
  | "lounge" // 家居/水疗：现有 lounge.glb（FurnitureScene）
  | "court" // 球局/竞技/探险：半场网格
  | "view" // 约拍/沙滩/山野：取景光场
  | "interior"; // 城市/历史：室内起居

const TEMPLATE_BY_CATEGORY: Record<string, SceneTemplate> = {
  Beach: "view",
  Mountains: "view",
  Adventure: "court",
  City: "interior",
  Historical: "interior",
};

export function templateForCategory(category: string): SceneTemplate {
  return TEMPLATE_BY_CATEGORY[category] ?? "lounge";
}

/**
 * 类目展示图标词表（弹药装填）— 业务词→emoji 由弹药层声明，
 * 底座 booking.iconFor 只做通用匹配（宪法 #4：不写死业务字段）。
 */
import type { IconRule } from "@/base/order/booking";

export const CATEGORY_ICON_RULES: IconRule[] = [
  [/羽毛球/, "🏸"],
  [/摄影|约拍|写真/, "📷"],
  [/保洁/, "🧹"],
];