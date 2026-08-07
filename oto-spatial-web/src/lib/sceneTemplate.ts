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