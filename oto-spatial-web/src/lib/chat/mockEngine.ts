import {
  delay,
  type ChatEngine,
  type ChatEvent,
  type GenCard,
  type ProviderItem,
  type TimeslotSlot,
} from "./types";
import { matchProviders, type MatchedProvider } from "@/base/dispatch/match";
import { useAppStore } from "@/store/useAppStore";
import { decorateWeekendLabels } from "./slots";

export type DemandCategory = "badminton" | "photography" | "housekeeping" | null;

interface DemandSlot {
  category: DemandCategory;
  time: string | null;
  level: string | null;
  partySize: number | null;
  area: string | null;
  budget: string | null;
  style: string | null;
  frequency: string | null;
}

type SlotKey = Exclude<keyof DemandSlot, "category">;

type Stage = "collect" | "awaitTimeslot" | "awaitProvider";

interface SchemaField {
  key: SlotKey;
  question: string;
  parse: (input: string) => string | number | null;
}

const CATEGORY_PARSE: Array<{
  match: RegExp;
  category: Exclude<DemandCategory, null>;
  label: string;
}> = [
  { match: /羽毛球|打球|球局|羽球|羽坛/, category: "badminton", label: "羽毛球约局" },
  { match: /约拍|拍照|摄影|写真|跟拍/, category: "photography", label: "摄影师约拍" },
  { match: /保洁|家政|打扫|整理|收纳/, category: "housekeeping", label: "家政保洁" },
];

const FIELD_SCHEMAS: Record<Exclude<DemandCategory, null>, SchemaField[]> = {
  badminton: [
    { key: "time", question: "想约在什么时间？比如：周六下午 / 下周三晚上", parse: parseTime },
    {
      key: "level",
      question: "你的水平大概在哪个段位？新手 / 业余 / 进阶？",
      parse: (s) =>
        /新手|小白|初学/.test(s)
          ? "新手"
          : /进阶|高手|老手|熟练/.test(s)
            ? "进阶"
            : /业余|一般|还行|中等/.test(s)
              ? "业余"
              : null,
    },
    {
      key: "partySize",
      question: "几个人一起打？2 人单打还是 4 人双打？",
      parse: (s) => {
        const m = s.match(/(\d)\s*[人位]/);
        if (m) return parseInt(m[1], 10);
        if (/单打/.test(s)) return 2;
        if (/双打/.test(s)) return 4;
        return null;
      },
    },
    {
      key: "area",
      question: "活动范围有要求吗？比如：附近 5 公里 / 指定区域",
      parse: (s) =>
        /附近|周边|就近/.test(s) ? "附近 5 公里" : /([\u4e00-\u9fa5]{2,6}(?:区|园|路|街道|商圈))/.exec(s)?.[1] ?? null,
    },
    {
      key: "budget",
      question: "预算大概多少？比如：单次 50 元以内",
      parse: (s) => {
        const m = s.match(/(\d{1,5})\s*元|(\d{1,5})\s*块/);
        if (m) return `单次 ${m[1] ?? m[2]} 元以内`;
        return null;
      },
    },
  ],
  photography: [
    { key: "time", question: "想约在什么时间？比如：周末下午 / 工作日晚上", parse: parseTime },
    {
      key: "style",
      question: "喜欢什么风格？日系 / 复古胶片 / 街头 / 旅拍",
      parse: (s) =>
        /日系|小清新/.test(s) ? "日系" : /复古|胶片/.test(s) ? "复古胶片" : /街头|纪实/.test(s) ? "街头" : /旅拍|旅行/.test(s) ? "旅拍" : null,
    },
    {
      key: "area",
      question: "拍摄地点有偏好吗？比如：市区 / 某公园 / 海边",
      parse: (s) =>
        /附近|周边/.test(s)
          ? "就近"
          : /([\u4e00-\u9fa5]{2,6}(?:公园|海边|江边|区|街|广场))/.exec(s)?.[1] ?? null,
    },
    {
      key: "budget",
      question: "拍摄预算大概多少？比如：500 元以内",
      parse: (s) => {
        const m = s.match(/(\d{1,5})\s*元|(\d{1,5})\s*块/);
        if (m) return `${m[1] ?? m[2]} 元以内`;
        return null;
      },
    },
  ],
  housekeeping: [
    { key: "time", question: "希望什么时间上门？比如：明天上午 / 周末下午", parse: parseTime },
    {
      key: "frequency",
      question: "需要单次保洁，还是每周固定？",
      parse: (s) => (/每周|定期|长期/.test(s) ? "每周固定" : /单次|一次|临时/.test(s) ? "单次" : null),
    },
    {
      key: "area",
      question: "服务地址大概在哪个区域？比如：XX 区 / 附近",
      parse: (s) =>
        /附近|周边/.test(s) ? "附近" : /([\u4e00-\u9fa5]{2,6}(?:区|园|路|街道|商圈))/.exec(s)?.[1] ?? null,
    },
    {
      key: "budget",
      question: "预算大概多少？比如：单次 200 元以内",
      parse: (s) => {
        const m = s.match(/(\d{1,5})\s*元|(\d{1,5})\s*块/);
        if (m) return `${m[1] ?? m[2]} 元以内`;
        return null;
      },
    },
  ],
};

export const CATEGORY_LABEL: Record<Exclude<DemandCategory, null>, string> = {
  badminton: "羽毛球约局",
  photography: "摄影师约拍",
  housekeeping: "家政保洁",
};

export const MOCK_SLOTS: Record<Exclude<DemandCategory, null>, TimeslotSlot[]> = {  badminton: [
    { id: "t1", label: "周六 14:00", sub: "2 小时 · 余位 3", density: 45 },
    { id: "t2", label: "周六 19:00", sub: "2 小时 · 余位 1", density: 85 },
    { id: "t3", label: "周日 10:00", sub: "2 小时 · 余位 4", density: 25 },
    { id: "t4", label: "周日 16:00", sub: "2 小时 · 余位 2", density: 70 },
  ],
  photography: [
    { id: "t1", label: "周六 09:30", sub: "约 2h · 晨光", density: 60 },
    { id: "t2", label: "周六 16:30", sub: "约 2h · 日落侧光", density: 90 },
    { id: "t3", label: "周日 10:00", sub: "约 2h · 柔光", density: 40 },
    { id: "t4", label: "周日 17:00", sub: "约 2h · 日落侧光", density: 75 },
  ],
  housekeeping: [
    { id: "t1", label: "周六 09:00", sub: "3 小时 · 深度保洁", density: 80 },
    { id: "t2", label: "周六 14:00", sub: "3 小时 · 深度保洁", density: 50 },
    { id: "t3", label: "周日 09:00", sub: "3 小时 · 深度保洁", density: 30 },
    { id: "t4", label: "周日 14:00", sub: "3 小时 · 深度保洁", density: 65 },
  ],
};

export const MOCK_PROVIDERS: Record<Exclude<DemandCategory, null>, ProviderItem[]> = {
  badminton: [
    {
      id: "p1",
      name: "星羽羽毛球馆",
      emoji: "🏸",
      meta: "2 片场地 · 空调 · 近地铁",
      rating: 4.8,
      price: "场地 ¥80/小时",
      basePrice: 80,
      kind: "venue",
      distanceKm: 1.2,
      tag: "推荐",
    },
    {
      id: "p2",
      name: "阿凯",
      emoji: "😎",
      meta: "业余进阶 · 每周 3 打",
      rating: 4.9,
      price: "¥25/局",
      basePrice: 25,
      level: "advanced",
      distanceKm: 2.4,
      freeSlots: ["t2", "t4"],
      tag: "球友",
    },
    {
      id: "p3",
      name: "小鹿",
      emoji: "🦌",
      meta: "业余 · 主打混双",
      rating: 4.6,
      price: "¥20/局",
      basePrice: 20,
      level: "amateur",
      distanceKm: 3.1,
      freeSlots: ["t1", "t3", "t4"],
      tag: "球友",
    },
    {
      id: "p4",
      name: "大熊",
      emoji: "🐻",
      meta: "新手友好 · 有耐心",
      rating: 4.7,
      price: "¥15/局",
      basePrice: 15,
      level: "newbie",
      distanceKm: 4.0,
      freeSlots: ["t3"],
      tag: "球友",
    },
  ],
  photography: [
    {
      id: "p1",
      name: "阿茶",
      emoji: "📷",
      meta: "日系风 · 5 年 · 客片 600+",
      rating: 4.9,
      price: "¥499/套",
      basePrice: 499,
      styleTag: "日系",
      distanceKm: 2.6,
      tag: "日系",
    },
    {
      id: "p2",
      name: "老周",
      emoji: "🎞️",
      meta: "复古胶片 · 胶卷机 · 城市漫游",
      rating: 4.8,
      price: "¥599/套",
      basePrice: 599,
      styleTag: "复古胶片",
      distanceKm: 5.2,
      freeSlots: ["t1", "t3"],
      tag: "复古",
    },
    {
      id: "p3",
      name: "Momo",
      emoji: "✨",
      meta: "街头纪实 · 快速出片 · 当天返图",
      rating: 4.7,
      price: "¥399/套",
      basePrice: 399,
      styleTag: "街头",
      distanceKm: 1.8,
      freeSlots: ["t2", "t4"],
      tag: "街头",
    },
  ],
  housekeeping: [
    {
      id: "p1",
      name: "王姐",
      emoji: "🧹",
      meta: "10 年经验 · 深度清洁 · 自备工具",
      rating: 5.0,
      price: "¥180/次",
      basePrice: 180,
      distanceKm: 3.4,
      tag: "好评王",
    },
    {
      id: "p2",
      name: "陈阿姨",
      emoji: "💧",
      meta: "家电清洗 · 收纳整理",
      rating: 4.8,
      price: "¥150/次",
      basePrice: 150,
      distanceKm: 5.6,
      freeSlots: ["t1", "t4"],
    },
    {
      id: "p3",
      name: "小张",
      emoji: "🪣",
      meta: "精致保洁 · 猫狗家庭友好",
      rating: 4.6,
      price: "¥120/次",
      basePrice: 120,
      distanceKm: 2.2,
      freeSlots: ["t2", "t3"],
    },
  ],
};

function parseTime(s: string): string | null {
  const day = /今天/.test(s) ? "今天" : /明天|明晚/.test(s) ? "明天" : /周六|礼拜六/.test(s) ? "周六" : /周日|礼拜天/.test(s) ? "周日" : /周末|双休/.test(s) ? "周末" : /周[一二三四五]/.exec(s)?.[0] ?? null;
  const part = /上午/.test(s) ? "上午" : /下午/.test(s) ? "下午" : /晚上|晚间/.test(s) ? "晚上" : /中午/.test(s) ? "中午" : null;
  if (!day && !part) return null;
  return [day, part].filter(Boolean).join("");
}

/**
 * Local rule engine — M2 adds a stage state machine and generated cards:
 * collect (追问链) → awaitTimeslot (时间槽卡) → awaitProvider (服务者卡)
 * The confirm/success cards are rendered client-side on booking.
 */
export class MockEngine implements ChatEngine {
  private slot: DemandSlot = {
    category: null,
    time: null,
    level: null,
    partySize: null,
    area: null,
    budget: null,
    style: null,
    frequency: null,
  };

  private stage: Stage = "collect";
  private slotOptions: TimeslotSlot[] = [];
  private providerOptions: MatchedProvider[] = [];
  private chosenSlot: TimeslotSlot | null = null;

  async *send(userMessage: string): AsyncIterable<ChatEvent> {
    yield { type: "typing" };
    await delay(350 + Math.random() * 250);
    const input = userMessage.trim();

    const categoryHit = CATEGORY_PARSE.find((c) => c.match.test(input));
    if (categoryHit) {
      const newCategory = categoryHit.category;
      if (this.slot.category && this.slot.category !== newCategory) {
        this.slot = {
          category: newCategory,
          time: parseTime(input),
          level: null,
          partySize: null,
          area: null,
          budget: null,
          style: null,
          frequency: null,
        };
        this.stage = "collect";
        this.slotOptions = [];
        this.providerOptions = [];
        this.chosenSlot = null;
      } else {
        this.slot.category = newCategory;
        this.collect(input);
      }
    } else if (this.slot.category) {
      this.collect(input);
    } else {
      yield* this.streamText("我是你的 AI 撮合助手，本地线下面基服务都能帮你安排 🎯\n试着这样说：\n「周日下午想找人打羽毛球」\n「想约摄影师拍一组日系写真」\n「周末找个保洁上门」");
      yield { type: "done" };
      return;
    }

    const category = this.slot.category as Exclude<DemandCategory, null>;
    const missing = FIELD_SCHEMAS[category].find((f) => this.slot[f.key] === null);
    if (missing) {
      yield* this.streamText(missing.question);
      yield { type: "done" };
      return;
    }

    this.stage = "awaitTimeslot";
    this.slotOptions = decorateWeekendLabels(MOCK_SLOTS[category]);
    this.chosenSlot = null;
    yield* this.streamText(
      `收到！已为你整理好需求：${this.summary(category)}。\n我找到了这几个合适的时段，点一个你方便的～`
    );
    yield { type: "card", card: this.timeslotCard() };
    yield { type: "done" };
  }

  async *select(cardId: string): AsyncIterable<ChatEvent> {
    const category = this.slot.category as Exclude<DemandCategory, null>;
    yield { type: "typing" };
    await delay(300 + Math.random() * 250);

    if (
      this.stage === "awaitTimeslot" ||
      this.stage === "awaitProvider" ||
      this.stage === "collect"
    ) {
      const slot = this.slotOptions.find((s) => s.id === cardId);
      if (slot) {
        this.chosenSlot = slot;
        this.providerOptions = matchProviders(MOCK_PROVIDERS[category], this.need(slot.id));
        this.stage = "awaitProvider";
        yield* this.streamText(
          `锁定 ${slot.label}（${slot.sub?.split(" · ")[0] ?? ""}）~ 已按你的水平与预算为你排序，马上组局`
        );
        yield { type: "card", card: this.providerCard(category) };
        yield { type: "done" };
        return;
      }
    }

    if (this.stage === "awaitProvider" || this.stage === "awaitTimeslot") {
      const provider = this.providerOptions.find((p) => p.id === cardId);
      if (provider) {
        this.stage = "collect";
        yield* this.streamText(`${provider.name} 很般配！帮你把方案整理好了，确认即可预约 👌`);
        yield { type: "card", card: this.confirmCard(category, provider) };
        yield { type: "done" };
        return;
      }
    }

    yield* this.streamText("没看懂这个选择，重来一次？直接再说一遍需求就行～");
    yield { type: "done" };
  }

  private timeslotCard(): GenCard {
    return { type: "timeslot", id: "timeslot", title: "可选时段", slots: this.slotOptions };
  }

  private providerCard(category: Exclude<DemandCategory, null>): GenCard {
    const note =
      category === "badminton"
        ? this.slot.partySize && this.slot.partySize > 2
          ? `已按水平+预算匹配 · 4 人双打再拉 1 位就满员 👥`
          : "已按水平+预算匹配同水平球友 + 场馆"
        : category === "photography"
          ? "摄影师按风格 + 预算匹配排序"
          : "保洁按预算 + 好评匹配排序";
    return {
      type: "provider",
      id: "provider",
      title: "为你匹配",
      providers: this.providerOptions,
      note,
    };
  }

  /** Extract matchmaking need from the collected demand slot. */
  private need(slotId?: string) {
    return {
      level: this.slot.level,
      budget: this.slot.budget,
      style: this.slot.style,
      area: this.slot.area,
      slotId: slotId ?? null,
      online: useAppStore.getState().workerOnline,
      partySize: this.slot.partySize,
    };
  }

  private confirmCard(
    category: Exclude<DemandCategory, null>,
    provider: ProviderItem
  ): GenCard {
    const lines: { k: string; v: string }[] = [
      { k: "服务", v: CATEGORY_LABEL[category] },
      { k: "对象", v: provider.emoji + " " + provider.name },
    ];
    if (this.chosenSlot) lines.push({ k: "时段", v: this.chosenSlot.label });
    if (this.slot.partySize && category === "badminton")
      lines.push({ k: "组局", v: `${this.slot.partySize} 人 · ${costPerPerson()}` });
    if (this.slot.area) lines.push({ k: "地点", v: this.slot.area });
    return { type: "confirm", id: "confirm", title: "确认订单", lines, price: provider.price };

    function costPerPerson() {
      return `场地 ¥80 + 局费 AA`;
    }
  }

  private collect(input: string) {
    const category = this.slot.category as Exclude<DemandCategory, null>;
    for (const field of FIELD_SCHEMAS[category]) {
      // Overwrite whenever the input resolves the field (even if already
      // filled) so users can revise a dimension mid-conversation.
      const value = field.parse(input);
      if (value !== null) {
        (this.slot as Record<SlotKey, string | number | null>)[field.key] = value;
      }
    }
  }

  private summary(category: Exclude<DemandCategory, null>): string {
    const parts: string[] = [];
    if (this.slot.time) parts.push(`${this.slot.time}`);
    if (this.slot.partySize) parts.push(`${this.slot.partySize} 人`);
    if (this.slot.level) parts.push(`${this.slot.level}水平`);
    if (this.slot.style) parts.push(`${this.slot.style}风格`);
    if (this.slot.frequency) parts.push(`${this.slot.frequency}`);
    if (this.slot.area) parts.push(`${this.slot.area}`);
    if (this.slot.budget) parts.push(`预算${this.slot.budget}`);
    return `${CATEGORY_LABEL[category]} · ${parts.join(" · ")}`;
  }

  private async *streamText(text: string): AsyncIterable<ChatEvent> {
    for (const ch of text) {
      yield { type: "text", delta: ch };
      await delay(ch === "\n" ? 60 : 14 + Math.random() * 22);
    }
  }
}