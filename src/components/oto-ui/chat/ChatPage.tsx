"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useAppStore, type Booking } from "@/store/useAppStore";
import { MockEngine } from "@/base/ai/chat/mockEngine";
import { LlmEngine } from "@/adapters/ai/chat/llmEngine";
import type { ChatMessage, ChatEvent, GenCard, ChatEngineContext } from "@/base/ai/chat/types";
import { speak } from "@/adapters/ai/voice/ttsClient";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { resolveAmmoIdForPublish, resolveAmmoByFreeText } from "@/ammo/registry";
import { toast } from "@/base/platform/toast";
import { recommend, type SemMatch } from "@/base/ai/embed";
import {
  parseVoiceIntent,
  mockVoiceIntent,
  describeIntent,
} from "@/base/ai/voice/voiceIntent";
import type { VoiceIntent } from "@/base/ai/voice/types";
import type { INormalizedCustomIntent } from "@/types/ammo-schema";
import { voiceHint } from "@/adapters/ui/clientFlags";
import { ChatBubble, ThinkingDot } from "./_components/ChatBubble";
import ChatInputBar from "./_components/ChatInputBar";

const SUGGESTIONS = [
  "周日下午想找人打羽毛球",
  "想约摄影师拍一组日系写真",
  "周末找个保洁上门",
];

/** 首页融合：4 大意图快捷气泡（弹药表驱动 → 草稿卡 key + 中文类目 → 预设口语话术）。 */
export interface IntentBubble {
  ammoKey: string;
  emoji: string;
  label: string;
  /** PublishSheet 中文类目（与 CATEGORY_TO_OFFICIAL 词表同键）。 */
  category: string;
  /** 点击气泡送入 AI 对话引擎的口语话术（多轮澄清链路照常）。 */
  text: string;
}

export const INTENT_BUBBLES: IntentBubble[] = [
  {
    ammoKey: "housekeeping",
    emoji: "🧽",
    label: "周末日常保洁",
    category: "家政保洁",
    text: "周末找个保洁上门打扫，预算 150 元",
  },
  {
    ammoKey: "meetup",
    emoji: "🏸",
    label: "周日羽毛球约局",
    category: "羽毛球约局",
    text: "周日找人打羽毛球，双打，预算 60 元",
  },
  {
    ammoKey: "companion",
    emoji: "📷",
    label: "约拍日系写真",
    category: "摄影师约拍",
    text: "想约摄影师拍一组日系写真，预算 499 元",
  },
  {
    ammoKey: "appliance_repair",
    emoji: "🔧",
    label: "家电上门维修",
    category: "家电维修",
    text: "家里空调坏了，想找师傅上门维修，预算 300 元",
  },
];

/** Auto-send a Home hot-service draft once when the AI screen opens. */
function useAiDraft(onSend: (text: string) => void, streaming: boolean) {
  const aiDraft = useAppStore((s) => s.aiDraft);
  const setAiDraft = useAppStore((s) => s.setAiDraft);
  useEffect(() => {
    if (aiDraft && !streaming) {
      const draft = aiDraft;
      setAiDraft(null);
      onSend(draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiDraft, streaming]);
}

export interface ChatPageProps {
  /** 首页融合座舱模式：问候 + 意图气泡 + 输入框置顶，消息流限高居中，无独立屏头。 */
  compact?: boolean;
  /** 首页瘦身模式（在 compact 之上再收敛【信息架构重组·灭双头怪】）：
   *  隐藏与首页问候条重复的「AI 撮合助手」标题头、与四大弹药胶囊重复的意图气泡、
   *  以及初始 greeting 重播卡；保留常驻发单对话框（输入框 + VoiceBar + 发射）、
   *  新对话/语音控制与限高消息流（多轮澄清 / 订单卡转化能力零丢弃）。 */
  slim?: boolean;
  /** 文本/语音意图命中弹药时回调（首页据此原地展开拟物草稿卡：弹药 key + 中文类目）。 */
  onAmmoDraft?: (ammoKey: string, category: string) => void;
}

/**
 * AI 对话助手屏（融合前独立屏）：多轮追问（M1） + 生成式卡片交互（M2）。
 * 卡片流：时间槽卡 → 服务者卡 → 确认单卡 → 预订（本地闭环）。
 * compact 模式：首页「AI 对话发单区 + 拟物卡流动态区」一体化嵌入。
 */
export default function ChatPage({ compact = false, slim = false, onAmmoDraft }: ChatPageProps) {
  const chatMessages = useAppStore((s) => s.chatMessages);
  const addChatMessage = useAppStore((s) => s.addChatMessage);
  const updateChatMessage = useAppStore((s) => s.updateChatMessage);
  const updateChatCards = useAppStore((s) => s.updateChatCards);
  const addBooking = useAppStore((s) => s.addBooking);

  // Pluggable engine (M1/M7): Gemini-backed LLMEngine when configured,
  // MockEngine (local rules) otherwise. Card flows stay deterministic.
  // session increments on "新对话" to fully reset engine state;
  // llmFallback switches to MockEngine permanently after repeated LLM failures.
  const [session, setSession] = useState(0);
  const [llmFallback, setLlmFallback] = useState(false);
  const [llmFailures, setLlmFailures] = useState(0);
  const [pendingRetry, setPendingRetry] = useState<string | null>(null);
  const useLlm =
    (process.env.NEXT_PUBLIC_LLM_PROVIDER === "gemini" ||
      process.env.NEXT_PUBLIC_LLM_PROVIDER === "zhipu") &&
    !llmFallback;
  const engine = useMemo(() => {
    void session; // 重建触发器：新对话/降级时强制新建引擎实例
    // 宪法收敛：条文 #3 —— 底座引擎零 Store 依赖，状态由 UI 层显式注入
    const ctx: ChatEngineContext = {
      getChatMessages: () => useAppStore.getState().chatMessages,
      isWorkerOnline: () => useAppStore.getState().workerOnline,
    };
    return useLlm ? new LlmEngine(ctx) : new MockEngine(ctx);
  }, [session, useLlm]);
  const [input, setInput] = useState("");
  const composingRef = useRef(false);
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const ttsOnRef = useRef(true);
  useEffect(() => {
    ttsOnRef.current = ttsEnabled;
  }, [ttsEnabled]);
  const listRef = useRef<HTMLDivElement>(null);
  /** 阶段4：最近一次语音意图的定制契约缓存（publish-wave 时写入，转正式订单时注入 Wave）。 */
  const lastCustomRequirementsRef = useRef<INormalizedCustomIntent | undefined>(undefined);
  const waves = useWaveStore((s) => s.waves);
  const askBi = useWaveStore((s) => s.askBi);
  const createPendingWave = useWaveStore((s) => s.createPendingWave);
  const payWave = useWaveStore((s) => s.payWave);
  const setScreen = useAppStore((s) => s.setScreen);
  // 语义推荐（ADR-0011，N3 接线）：输入时对活跃局做余弦相似推荐
  const [semHits, setSemHits] = useState<SemMatch[]>([]);
  useEffect(() => {
    const q = input.trim();
    const timer = window.setTimeout(() => {
      if (q.length < 2 || streaming) {
        setSemHits([]);
        return;
      }
      const candidates = waves
        .filter((w) => w.status === "active" && !w.removed)
        .map((w) => ({
          id: w.id,
          text: `${w.basics.category} ${w.basics.time} ${w.basics.area}`,
          label: w.basics.category,
        }));
      setSemHits(recommend(q, candidates, 3));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [input, streaming, waves]);
  // P2-4 语音入口提示：首次进入显示「按住说话」气泡，点过一次后不再出现
  const { useFlag: useVoiceHintSeen, markSeen: markVoiceSeen } = voiceHint;
  const showVoiceHint = !useVoiceHintSeen();

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chatMessages, thinking]);

  useAiDraft(handleSend, streaming);

  async function runStream(
    iterable: AsyncIterable<ChatEvent>,
    assistantId: string
  ) {
    let acc = "";
    let cards: ChatMessage["cards"] = [];
    setThinking(true);
    for await (const event of iterable) {
      if (event.type === "typing") {
        setThinking(true);
      } else if (event.type === "text") {
        setThinking(false);
        acc += event.delta;
        updateChatMessage(assistantId, acc);
      } else if (event.type === "card") {
        setThinking(false);
        cards = [...(cards ?? []), event.card];
        updateChatCards(assistantId, cards);
      } else if (event.type === "done") {
        setThinking(false);
      }
    }
    // L1 播报：流式完成后自动朗读完整回复（TTS 开关控制）。
    if (acc.trim() && ttsOnRef.current) {
      void speak(acc);
    }
  }

  /**
   * L2 意图层：语音文本 → /api/voice-intent（LLM 结构化）→ 本地校验。
   * - publish-wave：合成自然语言需求走现有撮合链路（确认卡 → 支付闭环），并播报确认文案。
   * - query-waves：直接读 store 播报局势。
   * - chat：直通现有对话。
   * 无 LLM（503）→ mockVoiceIntent 本地关键词降级。
   */
  async function handleVoiceText(text: string) {
    let intent: VoiceIntent = { kind: "chat" };
    try {
      const res = await fetch("/api/voice-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 400) }),
      });
      if (res.ok) {
        const data = (await res.json()) as { intent?: unknown };
        intent = parseVoiceIntent(data.intent);
      } else {
        intent = mockVoiceIntent(text);
      }
    } catch {
      intent = mockVoiceIntent(text);
    }

    if (intent.kind === "publish-wave") {
      const w = intent.wave;
      // 阶段4：语音定制契约随意图缓存，转正式订单时注入 Wave 实体（无损透传）
      lastCustomRequirementsRef.current = w.customRequirements;
      const demand = `帮我发布：${w.category}，${w.time}，${w.area}，预算 ${w.budget} 元${
        w.capacity >= 2 ? `，${w.capacity} 人拼位` : ""
      }`;
      await handleSend(demand);
      const ack = describeIntent(intent);
      if (ttsOnRef.current) void speak(ack);
    } else if (intent.kind === "query-waves") {
      const active = waves.filter((w) => w.status === "active" && !w.removed).length;
      const reply =
        active > 0
          ? `雷达上有 ${active} 个活跃局，去「雷达」看看有没有合适的。`
          : "当前没有活跃的局，可以说句话我帮你发布一个。";
      addChatMessage({ id: crypto.randomUUID(), role: "assistant", content: reply });
      if (ttsOnRef.current) void speak(reply);
    } else {
      await handleSend(text);
    }
  }

  function handleVoiceEvent(e: { type: "text" | "tts" | "error"; text?: string }) {
    if (e.type === "text" && e.text) {
      void handleVoiceText(e.text);
    } else if (e.type === "error" && e.text) {
      addChatMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: `🎙 ${e.text}`,
      });
    }
  }

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    // While streaming, keep the typed text in the box instead of silently
    // discarding it — user presses Enter again once the reply lands.
    if (streaming) return;
    // 本地自然语言 BI（ADR-0011，N6 接线）：统计类问题本地引擎直答，不耗 LLM
    const bi = askBi(trimmed);
    if (bi) {
      setInput("");
      addChatMessage({ id: crypto.randomUUID(), role: "user", content: trimmed });
      addChatMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: `📊 ${bi.label}（${bi.since}）：${bi.value}（${bi.rows} 条样本）`,
      });
      return;
    }
    setInput("");
    addChatMessage({ id: crypto.randomUUID(), role: "user", content: trimmed });
    const assistantId = crypto.randomUUID();
    addChatMessage({ id: assistantId, role: "assistant", content: "" });
    setStreaming(true);
    let sentOk = false;
    try {
      await runStream(engine.send(trimmed), assistantId);
      sentOk = true;
    } catch (err) {
      console.error("[chat] send failed", err);
      setInput(trimmed);
      if (useLlm) {
        // 上游 429/5xx = 服务不可用 → 直接降级本地引擎（不等 2 次），
        // 保持撮合可用性；仅非上游故障（解析/本地错误）才提示重试。
        const upstreamDown =
          err instanceof Error &&
          /upstream (429|5\d\d)|fetch failed|Failed to fetch/i.test(err.message);
        const next = llmFailures + 1;
        setLlmFailures(next);
        if (upstreamDown || next >= 2) {
          setLlmFallback(true);
          setPendingRetry(trimmed);
          updateChatMessage(
            assistantId,
            "AI 服务暂时不可用，已自动切换到本地撮合引擎，功能不受影响～"
          );
        } else {
          updateChatMessage(
            assistantId,
            "刚刚处理开小差了，输入框已恢复原文，直接点发送重试～"
          );
        }
      } else {
        updateChatMessage(
          assistantId,
          "刚刚处理开小差了，输入框已恢复原文，直接点发送重试～"
        );
      }
    } finally {
      setStreaming(false);
    }
    // 首页融合：对话流成功后，弹药表驱动检测输入 → 原地展开拟物草稿卡（命中整弹
    // 即展示匹配弹药/计价/引信徽标；未命中回落全类目 default 弹药，扣动扳机可发单）。
    if (sentOk) {
      const hit = resolveAmmoByFreeText(trimmed);
      onAmmoDraft?.(hit?.key ?? "default-ammo", hit?.label ?? "全类目需求");
    }
  }

  // 降级后用户无需重发：上次输入直接交给本地引擎重跑一遍（无感续答）。
  useEffect(() => {
    if (!llmFallback || !pendingRetry) return;
    const text = pendingRetry;
    if (!streaming) {
      void handleSend(text);
    }
    // Defer the reset out of the synchronous effect body (avoids cascading renders).
    const raf = requestAnimationFrame(() => setPendingRetry(null));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llmFallback]);

  async function handleCardSelect(cardId: string) {
    if (streaming) return;
    const assistantId = crypto.randomUUID();
    addChatMessage({ id: assistantId, role: "assistant", content: "" });
    setStreaming(true);
    try {
      await runStream(engine.select(cardId), assistantId);
    } catch (err) {
      console.error("[chat] card select failed", err);
      updateChatMessage(
        assistantId,
        "这一步没处理成功，换个选择试试？"
      );
    } finally {
      setStreaming(false);
    }
  }

  function handleBook(msgId: string, lines: { k: string; v: string }[], price: string) {
    const lineMap = Object.fromEntries(lines.map((l) => [l.k, l.v]));
    const booking: Booking = {
      id: crypto.randomUUID(),
      category: lineMap["服务"] ?? "本地服务",
      title: lineMap["对象"] ?? "服务",
      time: lineMap["时段"] ?? "",
      providerName: lineMap["对象"] ?? "",
      price,
      status: "upcoming",
      createdAt: Date.now(),
    };
    addBooking(booking);
    const message = chatMessages.find((m) => m.id === msgId);
    const successCard: GenCard = {
      type: "success",
      id: "success-" + booking.id,
      title: "预订成功",
      lines: [
        ...lines,
        { k: "订单号", v: booking.id.slice(0, 8).toUpperCase() },
      ],
      price,
    };
    updateChatCards(msgId, [...(message?.cards ?? []), successCard]);
  }

  /**
   * P1：AI 意图生成卡 → 真实弹药发单闭环。
   * 复用 PublishSheet 同款 createPendingWave 校验链（风控/违禁/限流闸门），
   * 人类点击【转为正式订单】即确认 → 随单资金托管（payWave capture）→ Wave 进入
   * ACTIVE 广播，Home 顶栏 StatusCapsule 随之流转（human-in-the-loop，红线 1）。
   */
  function handleConvertToWave(
    msgId: string,
    lines: { k: string; v: string }[],
    price: string,
  ) {
    const lineMap = Object.fromEntries(lines.map((l) => [l.k, l.v]));
    const category = (lineMap["服务"] ?? "本地服务").trim();
    const time = (lineMap["时段"] ?? "尽快").trim();
    const area = (lineMap["地点"] ?? "AI 撮合确认").trim();
    const budgetNum = parseInt(price.replace(/[^\d]/g, ""), 10);
    const budget = Number.isFinite(budgetNum) && budgetNum > 0 ? budgetNum : 100;
    const pending = createPendingWave({
      authorId: useIdentityStore.getState().identity.id,
      basics: { category, time, area, radiusKm: 5 },
      budget,
      customs: [],
      negotiable: false,
      capacity: 1,
      payAmount: budget,
      publishFee: 0,
      expiresAt: Date.now() + 7_200_000,
      hotness: 2,
      ammoId: resolveAmmoIdForPublish(category),
      // 阶段4：语义驯化定制契约随单固化（语音发单链路无损透传）
      customRequirements: lastCustomRequirementsRef.current,
    });
    if (!pending) {
      toast("发布被拒：账号受限或内容命中风控，请到「安全中心」查看", "error");
      return;
    }
    if (pending.minorBlocked) {
      toast(
        "发布被拒：未成年人账号需监护人同意后才能发布（未成年人保护法 §43/§72）",
        "error"
      );
      return;
    }
    if (pending.blocked) {
      const reason =
        pending.blocked === "debt"
          ? "你有未结清的 no-show 违约"
          : pending.blocked === "roam"
            ? "本设备命中高危多开风控"
            : "反欺诈探针甄检到高危信号";
      toast(`发布被拒：${reason}，请到「安全中心」处理`, "error");
      return;
    }
    if (pending.removed) {
      toast("内容命中违禁词，已转入平台审核", "error");
      return;
    }
    const paid = payWave(pending.id);
    if (!paid.ok) {
      toast("资金托管失败，请稍后重试", "error");
      return;
    }
    const message = chatMessages.find((m) => m.id === msgId);
    const waveNo = pending.id.slice(0, 8).toUpperCase();
    const converted = (message?.cards ?? []).map((c) =>
      c.type === "success" && !c.lines.some((l) => l.k === "方案单号")
        ? { ...c, lines: [...c.lines, { k: "方案单号", v: waveNo }] }
        : c,
    );
    updateChatCards(msgId, converted);
    toast(`📡 已转为正式方案订单 · ${category} · ¥${budget}`, "success");
    setScreen("home");
  }

  return (
    <div className={`pointer-events-auto flex flex-col ${compact ? "min-h-0" : "h-full min-h-0"}`}>
{/* 头部：compact = 首页融合座舱的紧凑控制行（无独立屏头）；
           slim = 再隐藏与首页问候条重复的标题，仅保留语音/新对话控制行（右对齐） */}
      {compact ? (
        <div className={`flex items-center mb-2 ${slim ? "justify-end gap-1.5" : "justify-between"}`}>
          {!slim && (
            <h2 className="text-[13px] font-extrabold tracking-tight flex items-center gap-1.5">
              <span className="w-7 h-7 rounded-xl glass-panel flex items-center justify-center glow-purple">
                <Bot size={13} className="text-brandPurple" />
              </span>
              AI 撮合助手
            </h2>
          )}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTtsEnabled((v) => !v)}
              aria-label={ttsEnabled ? "关闭语音播报" : "开启语音播报"}
              className={`text-xs px-2 py-1 rounded-full glass-panel transition-colors flex items-center gap-1 ${
                ttsEnabled ? "text-brandCyan" : "text-white/40"
              }`}
            >
              {ttsEnabled ? <Volume2 size={11} /> : <VolumeX size={11} />}
              语音
            </button>
            <button
              onClick={() => {
                useAppStore.getState().clearChat();
                setSession((s) => s + 1);
              }}
              className="text-xs text-white/40 hover:text-white/80 px-2 py-1 rounded-full glass-panel transition-colors"
            >
              新对话
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-2xl glass-panel flex items-center justify-center glow-purple">
            <Bot size={17} className="text-brandPurple" />
          </div>
          <div className="flex-1">
            <h2 className="text-[15px] font-extrabold tracking-tight">
              AI 撮合助手
            </h2>
            <p className="text-xs text-white/50">
              自然语言描述需求 · 自动撮合线下服务
            </p>
          </div>
          <button
            onClick={() => setTtsEnabled((v) => !v)}
            aria-label={ttsEnabled ? "关闭语音播报" : "开启语音播报"}
            className={`text-xs px-2 py-1 rounded-full glass-panel transition-colors flex items-center gap-1 ${
              ttsEnabled ? "text-brandCyan" : "text-white/40"
            }`}
          >
            {ttsEnabled ? <Volume2 size={11} /> : <VolumeX size={11} />}
            语音
          </button>
          <button
            onClick={() => {
              useAppStore.getState().clearChat();
              setSession((s) => s + 1);
            }}
            className="text-xs text-white/40 hover:text-white/80 px-2 py-1 rounded-full glass-panel transition-colors"
          >
            新对话
          </button>
        </div>
      )}

{/* 首页融合：4 大意图快捷气泡（点击 = 送话术 + 原地展开匹配弹药草稿卡；
          「想找什么？一句话告诉我」智能问候发单条由首页挂载，入口零丢失）
          信息架构重组：四大意念气泡与首页四大词典弹药胶囊重复 → slim 模式隐藏 */}
      {compact && !slim && (
        <div className="grid grid-cols-2 gap-2" data-testid="intent-bubbles">
          {INTENT_BUBBLES.map((b) => (
            <button
              key={b.ammoKey}
              onClick={() => {
                onAmmoDraft?.(b.ammoKey, b.category);
                void handleSend(b.text);
              }}
              aria-label={`${b.emoji} ${b.label} 拟物发单`}
              data-ammo={b.ammoKey}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2.5 min-h-11 rounded-xl glass-panel-interactive hover:border-brandPurple/50 active:scale-95 transition-[border,transform]"
            >
              <span className="text-[15px]">{b.emoji}</span>
              <span className="text-xs font-bold text-white/85 truncate">
                {b.label}
              </span>
            </button>
          ))}
        </div>
      )}
      {!compact && (
        <div
          ref={listRef}
          className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-3 pr-0.5 h-[calc(100dvh-19rem)] lg:h-[calc(100vh-15rem)]"
        >
          {chatMessages.map((msg, i) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              isLatest={streaming && i === chatMessages.length - 1}
              onCardSelect={handleCardSelect}
              onBook={handleBook}
              onConvertToWave={handleConvertToWave}
            />
          ))}
          {thinking && <ThinkingDot />}
        </div>
      )}

      {/* 快捷建议（融合模式由 4 大意图气泡取代） */}
      {!compact && chatMessages.length <= 2 && !streaming && (
        <div className="flex flex-wrap gap-2 mt-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full glass-panel text-xs text-white/70 hover:text-white hover:border-brandPurple/50 transition-colors"
            >
              <Sparkles size={11} className="text-brandPurple" />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* 语义推荐（ADR-0011）：输入过程中实时推荐雷达上语义最相关的局 */}
      {semHits.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {semHits.map((h) => (
            <button
              key={h.candidate.id}
              onClick={() => setScreen("home")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-brandCyan/10 border border-brandCyan/30 text-xs text-brandCyan hover:bg-brandCyan/20 transition-colors"
            >
              <Sparkles size={9} />
              {h.candidate.label} · {h.candidate.text.split(" ")[1]}
              <span className="text-xs text-white/40">
                {Math.round(h.score * 100)}%
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 底部语音输入条（子组件化搬移，selector/DOM 零漂移） */}
      <ChatInputBar
        compact={compact}
        input={input}
        onInputChange={setInput}
        composingRef={composingRef}
        streaming={streaming}
        onSubmitText={handleSend}
        onVoiceEvent={handleVoiceEvent}
        showVoiceHint={showVoiceHint}
        onVoiceHintSeen={markVoiceSeen}
      />

{/* compact：拟物卡流动态区（消息流在输入框之下限高滚动，生成卡原地展开）
          信息架构重组：slim 过滤与首页问候条重复的初始 greeting 重播卡 */}
      {compact && (
        <div
          ref={listRef}
          className="mt-3 min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-3 pr-0.5 max-h-[12rem] lg:max-h-[16rem]"
          data-testid="compact-chat-flow"
        >
          {chatMessages
            .filter((m) => !(slim && m.id === "greeting" && m.role === "assistant"))
            .map((msg, i) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                isLatest={streaming && i === chatMessages.length - 1}
                onCardSelect={handleCardSelect}
                onBook={handleBook}
                onConvertToWave={handleConvertToWave}
              />
            ))}
          {thinking && <ThinkingDot />}
        </div>
      )}
    </div>
  );
}
