import type {
  ChatEngine,
  ChatEngineContext,
  ChatEvent,
  ChatMessage,
  GenCard,
  ProviderItem,
  TimeslotSlot,
} from "@/base/ai/chat/types";
import { matchProviders, type MatchedProvider } from "@/base/dispatch/match";
import { decorateWeekendLabels } from "@/base/ai/chat/slots";
import { NEED_KEYS, parseDirective, type LlmDirective } from "@/base/ai/chat/llmDirective";

type DemandCategory = string | null;
const CATEGORY_LABEL: Record<string, string> = {
  badminton: "羽毛球约局",
  photography: "摄影师约拍",
  housekeeping: "家政保洁",
};
const MOCK_SLOTS: Record<string, import("@/base/ai/chat/types").TimeslotSlot[]> = {
  badminton: [
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
const MOCK_PROVIDERS: Record<string, import("@/base/ai/chat/types").ProviderItem[]> = {
  badminton: [
    { id: "p1", name: "星羽羽毛球馆", emoji: "🏸", meta: "2 片场地 · 空调 · 近地铁", rating: 4.8, price: "场地 ¥80/小时", basePrice: 80, kind: "venue", distanceKm: 1.2, tag: "推荐" },
    { id: "p2", name: "阿凯", emoji: "😎", meta: "业余进阶 · 每周 3 打", rating: 4.9, price: "¥25/局", basePrice: 25, level: "advanced", distanceKm: 2.4, freeSlots: ["t2", "t4"], tag: "球友" },
    { id: "p3", name: "小鹿", emoji: "🦌", meta: "业余 · 主打混双", rating: 4.6, price: "¥20/局", basePrice: 20, level: "amateur", distanceKm: 3.1, freeSlots: ["t1", "t3", "t4"], tag: "球友" },
    { id: "p4", name: "大熊", emoji: "🐻", meta: "新手友好 · 有耐心", rating: 4.7, price: "¥15/局", basePrice: 15, level: "newbie", distanceKm: 4.0, freeSlots: ["t3"], tag: "球友" },
  ],
  photography: [
    { id: "p1", name: "阿茶", emoji: "📷", meta: "日系风 · 5 年 · 客片 600+", rating: 4.9, price: "¥499/套", basePrice: 499, styleTag: "日系", distanceKm: 2.6, tag: "日系" },
    { id: "p2", name: "老周", emoji: "🎞️", meta: "复古胶片 · 胶卷机 · 城市漫游", rating: 4.8, price: "¥599/套", basePrice: 599, styleTag: "复古胶片", distanceKm: 5.2, freeSlots: ["t1", "t3"], tag: "复古" },
    { id: "p3", name: "Momo", emoji: "✨", meta: "街头纪实 · 快速出片 · 当天返图", rating: 4.7, price: "¥399/套", basePrice: 399, styleTag: "街头", distanceKm: 1.8, freeSlots: ["t2", "t4"], tag: "街头" },
  ],
  housekeeping: [
    { id: "p1", name: "王姐", emoji: "🧹", meta: "10 年经验 · 深度清洁 · 自备工具", rating: 5.0, price: "¥180/次", basePrice: 180, distanceKm: 3.4, tag: "好评王" },
    { id: "p2", name: "陈阿姨", emoji: "💧", meta: "家电清洗 · 收纳整理", rating: 4.8, price: "¥150/次", basePrice: 150, distanceKm: 5.6, freeSlots: ["t1", "t4"] },
    { id: "p3", name: "小张", emoji: "🪣", meta: "精致保洁 · 猫狗家庭友好", rating: 4.6, price: "¥120/次", basePrice: 120, distanceKm: 2.2, freeSlots: ["t2", "t3"] },
  ],
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Build recent user/assistant turns from the caller-provided history so the
 * model can follow-up on earlier questions. Greetings + generated cards are
 * dropped, and the in-flight current user message (already appended by
 * ChatPage) is set aside to avoid repeating it.
 */
function buildHistory(
  currentUser: string,
  msgs: ChatMessage[]
): Array<{ role: "user" | "assistant"; content: string }> {
  const turns: Array<{ role: "user" | "assistant"; content: string }> = [];
  let droppedCurrent = false;
  for (const m of msgs) {
    if (m.id === "greeting") continue;
    if (!m.content || m.content.length === 0) continue;
    if (!droppedCurrent && m.role === "user" && m.content === currentUser) {
      droppedCurrent = true;
      continue;
    }
    turns.push({ role: m.role, content: m.content });
  }
  return turns.slice(-8);
}

export const SYSTEM_PROMPT = `你是 OTO（本地线下面基服务）撮合助手，负责理解用户需求并推进撮合流程。
可提供服务分类（category）：
- badminton 羽毛球约局
- photography 摄影师约拍
- housekeeping 家政保洁

你必须只输出一个 JSON 对象（不要 markdown 代码围栏，不要多余文字），格式：
{"text":"对用户说的话","action":"ask|slots|done","category":"badminton|photography|housekeeping|null","need":{"level":"新手|业余|进阶","partySize":2,"area":"附近","budget":"单次 30 元以内","style":"日系|复古胶片|街头"}}

字段抽取规则（need 只放本消息能确认的）：
- level：水平段位，只用 新手/业余/进阶（如"小白/初学"→新手，"老手/高手"→进阶）
- partySize：人数，整数
- area：区域/距离，原样短语（如"附近"、"滨江 5 公里"）
- budget：预算，格式"单次 N 元以内"
- style：摄影风格，只用 日系/复古胶片/街头
- 无法确认的字段不要出现在 need 里

动作规则：
- 用户没说清要什么服务 → action="ask"，问一句想要什么服务（可提示三种分类）
- 分类确认但必要字段缺失 → action="ask"，只追问缺的字段（一次一个问题）
- 分类确认且字段足够 → action="slots"，text 写"已为你整理好需求：{摘要}，选个时段～"
- 用户闲聊/感谢/无关内容 → action="done"，text 简短回应并引导回撮合
- 分类变化时（换了服务）→ 按新分类重新开始收集

槽位回显与追问纪律：
- 用户消息已明确给出时间/品类/预算等要素时，text 的开头必须先回显已确认项，格式如 "[✓ 服务: 家政保洁] [✓ 时间: 今天 10:00]"
- 严禁重复询问用户已提供的信息；每次只针对一个缺失项追问（如 地址、面积、人数）
- 时间规范化口径："10点"→"今天 10:00"、"下午2点半"→"14:30"，回显与 need 抽取都用该形态

对话历史会以"已收集需求：..."形式提供，你合并更新即可。`;

interface NeedState {
  level: string | null;
  partySize: number | null;
  area: string | null;
  budget: string | null;
  style: string | null;
}

/**
 * LLM 驱动引擎：send() 把用户消息交给 Gemini（服务端代理 /api/chat），
 * 解析出指令后本地渲染卡片；select() 完全本地确定性（槽位→撮合→确认单）。
 * 任何 LLM 故障直接 throw —— ChatPage 的 catch 会恢复输入框并提示重试。
 */
export class LlmEngine implements ChatEngine {
  constructor(private readonly ctx: ChatEngineContext) {}

  private category: DemandCategory = null;
  private need: NeedState = {
    level: null,
    partySize: null,
    area: null,
    budget: null,
    style: null,
  };
  private slotOptions: TimeslotSlot[] = [];
  private providerOptions: MatchedProvider[] = [];
  private chosenSlot: TimeslotSlot | null = null;

  async *send(userMessage: string): AsyncIterable<ChatEvent> {
    yield { type: "typing" };
    const directive = await this.askLlm(userMessage);

    if (directive.category !== this.category) {
      // 换服务或首次识别：重置已收集字段
      this.need = { level: null, partySize: null, area: null, budget: null, style: null };
      this.slotOptions = [];
      this.providerOptions = [];
      this.chosenSlot = null;
      this.category = directive.category;
    }
    if (directive.need) {
      for (const key of NEED_KEYS) {
        const value = directive.need[key];
        if (value !== undefined && value !== null) {
          (this.need as unknown as Record<string, string | number | null>)[key] = value;
        }
      }
    }

    if (directive.action === "slots" && this.category) {
      this.slotOptions = decorateWeekendLabels(MOCK_SLOTS[this.category] ?? []);
      this.chosenSlot = null;
      yield* this.streamText(directive.text);
      yield { type: "card", card: this.timeslotCard() };
    } else {
      yield* this.streamText(directive.text);
    }
    yield { type: "done" };
  }

  async *select(cardId: string): AsyncIterable<ChatEvent> {
    const category = this.category;
    if (!category) {
      yield* this.streamText("还没开始收集需求，直接告诉我你想做什么就行～");
      yield { type: "done" };
      return;
    }
    yield { type: "typing" };
    await delay(250 + Math.random() * 200);

    // 时段卡：选槽 → 本地撮合出服务者卡
    const slot = this.slotOptions.find((s) => s.id === cardId);
    if (slot) {
      this.chosenSlot = slot;
      this.providerOptions = matchProviders(
        MOCK_PROVIDERS[category] ?? [],
        this.needFor(slot.id)
      );
      yield* this.streamText(
        `锁定 ${slot.label}（${slot.sub?.split(" · ")[0] ?? ""}）~ 已按你的需求排序，马上组局`
      );
      yield { type: "card", card: this.providerCard(category) };
      yield { type: "done" };
      return;
    }

    // 服务者卡：选人 → 本地确认单
    const provider = this.providerOptions.find((p) => p.id === cardId);
    if (provider) {
      yield* this.streamText(`${provider.name} 很般配！帮你把方案整理好了，确认即可预约 👌`);
      yield { type: "card", card: this.confirmCard(category, provider) };
      yield { type: "done" };
      return;
    }

    yield* this.streamText("没看懂这个选择，重来一次？直接再说一遍需求就行～");
    yield { type: "done" };
  }

  private needFor(slotId: string) {
    return {
      level: this.need.level,
      budget: this.need.budget,
      style: this.need.style,
      area: this.need.area,
      slotId,
      online: this.ctx.isWorkerOnline(),
      partySize: this.need.partySize,
    };
  }

  private timeslotCard(): GenCard {
    return { type: "timeslot", id: "timeslot", title: "可选时段", slots: this.slotOptions };
  }

  private providerCard(category: string): GenCard {
    const note =
      category === "badminton"
        ? this.need.partySize && this.need.partySize > 2
          ? `已按水平+预算匹配 · ${this.need.partySize} 人双打再拉 1 位就满员 👥`
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

  private confirmCard(category: string, provider: ProviderItem): GenCard {
    const lines: { k: string; v: string }[] = [
      { k: "服务", v: CATEGORY_LABEL[category] ?? category },
      { k: "对象", v: provider.emoji + " " + provider.name },
    ];
    if (this.chosenSlot) lines.push({ k: "时段", v: this.chosenSlot.label });
    if (this.need.partySize && category === "badminton")
      lines.push({ k: "组局", v: `${this.need.partySize} 人 · 场地 ¥80 + 局费 AA` });
    if (this.need.area) lines.push({ k: "地点", v: this.need.area });
    return { type: "confirm", id: "confirm", title: "确认订单", lines, price: provider.price };
  }

  /** Call Gemini via the server proxy; parse the strict JSON directive. */
  private async askLlm(userMessage: string): Promise<LlmDirective> {
    const summary = this.summary();
    const history = buildHistory(userMessage, this.ctx.getChatMessages());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch("/api/waves/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...history,
            {
              role: "user",
              content: summary
                ? `[已收集需求] ${summary}\n[用户新消息] ${userMessage}`
                : userMessage,
            },
          ],
        }),
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          detail = j?.error ?? detail;
        } catch {
          /* ignore */
        }
        throw new Error(`LLM upstream failed: ${detail}`);
      }
      if (!res.body) throw new Error("LLM stream empty");

      let full = "";
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const line = evt.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const delta: string | undefined = json?.choices?.[0]?.delta?.content;
            if (delta) full += delta;
          } catch {
            /* skip malformed SSE frame */
          }
        }
      }

      const directive = parseDirective(full);
      if (!directive) throw new Error("LLM directive parse failed");
      return directive;
    } finally {
      clearTimeout(timer);
    }
  }

  private summary(): string {
    const parts: string[] = [];
    if (this.need.partySize) parts.push(`${this.need.partySize} 人`);
    if (this.need.level) parts.push(`${this.need.level}水平`);
    if (this.need.style) parts.push(`${this.need.style}风格`);
    if (this.need.area) parts.push(`${this.need.area}`);
    if (this.need.budget) parts.push(`预算${this.need.budget}`);
    if (parts.length === 0 || !this.category) return "";
    return `${CATEGORY_LABEL[this.category] ?? this.category} · ${parts.join(" · ")}`;
  }

  private async *streamText(text: string): AsyncIterable<ChatEvent> {
    for (const ch of text) {
      yield { type: "text", delta: ch };
      await delay(ch === "\n" ? 30 : 8 + Math.random() * 10);
    }
  }
}
