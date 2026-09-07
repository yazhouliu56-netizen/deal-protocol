"use client";
// 注：展示组件已并入弹药库（精简案），本文件仅保留时段灵感数据与纯函数
// （inspirationSetFor，测试可注入 hour），供 AmmoPillBar 副标题时段 caption 复用。

/** 时段化灵感场景集（战场3：冷启动商业活化 · 输入框下方按当前时间自动切换）。 */
export interface InspirationChip {
  label: string;
  ammo: string;
}
export interface InspirationSet {
  range: [number, number];
  period: string;
  emoji: string;
  caption: string;
  chips: InspirationChip[];
}

const INSPIRATION_SETS: InspirationSet[] = [
  {
    range: [5, 11],
    period: "清晨",
    emoji: "☀️",
    caption: "零押金启动 · 满意后分账",
    chips: [
      { label: "🧘 晨间拉伸陪练", ammo: "陪伴交友" },
      { label: "☕ 咖啡馆拼桌学习", ammo: "组局社交" },
      { label: "🧹 上午深度保洁", ammo: "家政保洁" },
    ],
  },
  {
    range: [11, 14],
    period: "午间",
    emoji: "🍱",
    caption: "急速撮合 · 30 分钟送达",
    chips: [
      { label: "🍱 午餐饭搭子", ammo: "组局社交" },
      { label: "🧹 午间保洁上门", ammo: "家政保洁" },
      { label: "📷 光影人像外拍", ammo: "摄影师约拍" },
    ],
  },
  {
    range: [14, 18],
    period: "午后",
    emoji: "🏸",
    caption: "周边服务者在线待命",
    chips: [
      { label: "🏸 午后羽毛球局", ammo: "组局社交" },
      { label: "👥 电影搭子", ammo: "陪伴交友" },
      { label: "🧽 下午家庭保洁", ammo: "家政保洁" },
    ],
  },
  {
    range: [18, 23],
    period: "晚间",
    emoji: "🌆",
    caption: "夜间服务 · 平台意外险全包",
    chips: [
      { label: "🍲 晚餐搭子", ammo: "组局社交" },
      { label: "📷 夜景街拍点位", ammo: "摄影师约拍" },
      { label: "🧘 夜间拉伸放松", ammo: "陪伴交友" },
    ],
  },
  {
    range: [23, 5],
    period: "深夜",
    emoji: "🌙",
    caption: "深夜不打烊 · 全时在线",
    chips: [
      { label: "🛏 深夜倾诉陪聊", ammo: "陪伴交友" },
      { label: "🧹 明早保洁预约", ammo: "家政保洁" },
      { label: "🏸 夜场羽毛球局", ammo: "组局社交" },
    ],
  },
];

/** 纯函数：当前小时 → 对应时段灵感组（支持跨零点区间，测试可注入 hour）。 */
export function inspirationSetFor(hour: number): InspirationSet {
  const hit = INSPIRATION_SETS.find((s) => {
    const [a, b] = s.range;
    return a <= b ? hour >= a && hour < b : hour >= a || hour < b;
  });
  return hit ?? INSPIRATION_SETS[0];
}
