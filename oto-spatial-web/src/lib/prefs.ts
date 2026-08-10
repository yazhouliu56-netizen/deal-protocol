/**
 * 撮合偏好（需求方个性化）：四维选项池 + 默认值 + 纯函数操作。
 * 展示文案即选项本身（如「活动范围 5 公里内」），点击标签循环切换。
 */
export const PREF_KEYS = ["radius", "budget", "level", "when"] as const;
export type PrefKey = (typeof PREF_KEYS)[number];

export type Prefs = Record<PrefKey, string>;

export const PREF_OPTIONS: Record<PrefKey, readonly string[]> = {
  radius: ["活动范围 5 公里内", "活动范围 10 公里内", "活动范围 20 公里内", "距离不限"],
  budget: ["预算 ¥50/局", "预算 ¥100/局", "预算 ¥200/局", "预算 ¥500/局"],
  level: ["新手入门", "业余水平", "进阶玩家", "专业竞技"],
  when: ["周末出行", "工作日晚上", "节假日", "随时可约"],
};

export const DEFAULT_PREFS: Prefs = {
  radius: "活动范围 5 公里内",
  budget: "预算 ¥50/局",
  level: "业余水平",
  when: "周末出行",
};

/** 点击标签 → 循环切到下一个选项（不可变）。 */
export function cyclePref(prefs: Prefs, key: PrefKey): Prefs {
  const opts = PREF_OPTIONS[key];
  const next =
    opts[(opts.indexOf(prefs[key]) + 1 + opts.length) % opts.length] ?? opts[0];
  return { ...prefs, [key]: next };
}

/** 直接指定某维度取值；非法值忽略（返回原对象）。 */
export function setPref(prefs: Prefs, key: PrefKey, value: string): Prefs {
  if (!PREF_OPTIONS[key].includes(value)) return prefs;
  return { ...prefs, [key]: value };
}