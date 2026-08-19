"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Check, Mic, Send, Sparkles, Star, Volume2, VolumeX } from "lucide-react";
import { useAppStore, type Booking } from "@/store/useAppStore";
import { MockEngine } from "@/base/ai/chat/mockEngine";
import { LlmEngine } from "@/base/ai/chat/llmEngine";
import type { ChatMessage, ChatEvent, GenCard, ProviderItem, ChatEngineContext } from "@/base/ai/chat/types";
import { ChevronDown } from "lucide-react";
import type { ScoreBreakdown } from "@/base/dispatch/match";
import VoiceBar from "@/components/oto-ui/VoiceBar";
import { speak } from "@/base/ai/voice/ttsClient";
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
import { voiceHint } from "@/base/platform/clientFlags";

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
  /** 文本/语音意图命中弹药时回调（首页据此原地展开拟物草稿卡：弹药 key + 中文类目）。 */
  onAmmoDraft?: (ammoKey: string, category: string) => void;
}

/**
 * AI 对话助手屏（融合前独立屏）：多轮追问（M1） + 生成式卡片交互（M2）。
 * 卡片流：时间槽卡 → 服务者卡 → 确认单卡 → 预订（本地闭环）。
 * compact 模式：首页「AI 对话发单区 + 拟物卡流动态区」一体化嵌入。
 */
export default function ChatPage({ compact = false, onAmmoDraft }: ChatPageProps) {
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
      c.type === "success" && !c.lines.some((l) => l.k === "弹药单号")
        ? { ...c, lines: [...c.lines, { k: "弹药单号", v: waveNo }] }
        : c,
    );
    updateChatCards(msgId, converted);
    toast(`📡 已转为正式弹药订单 · ${category} · ¥${budget}`, "success");
    setScreen("home");
  }

  return (
    <div className={`pointer-events-auto flex flex-col ${compact ? "min-h-0" : "h-full min-h-0"}`}>
      {/* 头部：compact = 首页融合座舱的紧凑控制行（无独立屏头） */}
      {compact ? (
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[13px] font-extrabold tracking-tight flex items-center gap-1.5">
            <span className="w-7 h-7 rounded-xl glass-panel flex items-center justify-center glow-purple">
              <Bot size={13} className="text-brandPurple" />
            </span>
            AI 撮合助手
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTtsEnabled((v) => !v)}
              aria-label={ttsEnabled ? "关闭语音播报" : "开启语音播报"}
              className={`text-[10px] px-2 py-1 rounded-full glass-panel transition-colors flex items-center gap-1 ${
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
              className="text-[10px] text-white/40 hover:text-white/80 px-2 py-1 rounded-full glass-panel transition-colors"
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
            <p className="text-[10px] text-white/50">
              自然语言描述需求 · 自动撮合线下服务
            </p>
          </div>
          <button
            onClick={() => setTtsEnabled((v) => !v)}
            aria-label={ttsEnabled ? "关闭语音播报" : "开启语音播报"}
            className={`text-[10px] px-2 py-1 rounded-full glass-panel transition-colors flex items-center gap-1 ${
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
            className="text-[10px] text-white/40 hover:text-white/80 px-2 py-1 rounded-full glass-panel transition-colors"
          >
            新对话
          </button>
        </div>
      )}

      {/* 首页融合：4 大意图快捷气泡（点击 = 送话术 + 原地展开匹配弹药草稿卡；
          「想找什么？一句话告诉我」智能问候发单条由首页挂载，入口零丢失） */}
      {compact && (
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
              <span className="text-[11px] font-bold text-white/85 truncate">
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
              className="flex items-center gap-1 px-3 py-1.5 rounded-full glass-panel text-[11px] text-white/70 hover:text-white hover:border-brandPurple/50 transition-colors"
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
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-brandCyan/10 border border-brandCyan/30 text-[10px] text-brandCyan hover:bg-brandCyan/20 transition-colors"
            >
              <Sparkles size={9} />
              {h.candidate.label} · {h.candidate.text.split(" ")[1]}
              <span className="text-[8.5px] text-white/40">
                {Math.round(h.score * 100)}%
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 输入框（文本 + 按住说话 VoiceBar + 发送） */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          // 中文输入法选字回车（IME composing）不触发发送
          if (composingRef.current) return;
          handleSend(input);
        }}
        className={`flex items-center gap-2 relative ${compact ? "mt-2.5" : "mt-3"}`}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onCompositionStart={() => (composingRef.current = true)}
          onCompositionEnd={() => (composingRef.current = false)}
          placeholder="描述你的需求，比如：周六下午 2 人羽毛球"
          className="flex-1 min-w-0 px-4 py-3 rounded-2xl glass-panel outline-none text-xs placeholder:text-white/35"
          enterKeyHint="send"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          aria-label="发送"
          className="w-11 h-11 shrink-0 rounded-2xl btn-primary glow-purple-strong flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-[filter,transform]"
        >
          <Send size={16} />
        </button>
        <VoiceBar onEvent={handleVoiceEvent} disabled={streaming} />
        {/* P2-4 首次语音提示气泡 */}
        {showVoiceHint && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute right-0 -top-10 z-10 px-2.5 py-1.5 rounded-xl bg-brandPurple/30 border border-brandPurple/50 text-[9.5px] font-bold text-white/90 flex items-center gap-1.5 whitespace-nowrap pointer-events-none"
          >
            <Mic size={10} className="text-brandCyan" />
            按住说话 · 自动发布/查局
            <button
              onClick={markVoiceSeen}
              className="ml-1 px-2 py-1 min-h-8 pointer-events-auto text-white/50 hover:text-white underline underline-offset-2"
            >
              知道了
            </button>
          </motion.div>
        )}
      </form>

      {/* compact：拟物卡流动态区（消息流在输入框之下限高滚动，生成卡原地展开） */}
      {compact && (
        <div
          ref={listRef}
          className="mt-3 min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-3 pr-0.5 max-h-[12rem] lg:max-h-[16rem]"
          data-testid="compact-chat-flow"
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
    </div>
  );
}

function ChatBubble({
  message,
  isLatest = false,
  onCardSelect,
  onBook,
  onConvertToWave,
}: {
  message: ChatMessage;
  isLatest?: boolean;
  onCardSelect: (cardId: string) => void;
  onBook: (msgId: string, lines: { k: string; v: string }[], price: string) => void;
  onConvertToWave: (msgId: string, lines: { k: string; v: string }[], price: string) => void;
}) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
    >
      <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        {!isUser && (
          <div className="w-7 h-7 mr-2 mt-0.5 rounded-xl glass-panel flex items-center justify-center shrink-0">
            <Bot size={13} className="text-brandPurple" />
          </div>
        )}
        {message.content && (
          <div
            className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-[12.5px] leading-relaxed whitespace-pre-wrap break-words ${
              isUser
                ? "btn-primary text-white shadow-lg"
                : "glass-panel text-white/90"
            }`}
          >
            {message.content}
            {!isUser && isLatest && <span className="typing-caret" />}
          </div>
        )}
      </div>
      {!isUser && message.content && !isLatest && (
        <button
          onClick={() => void speak(message.content ?? "")}
          aria-label="重播语音"
          className="ml-9 mt-1 rounded-full px-2 py-0.5 glass-panel text-[9px] text-brandCyan hover:text-white flex items-center gap-1 transition-colors"
        >
          <Volume2 size={9} /> 重播
        </button>
      )}
      {message.cards?.map((card) => (
        <GenCardView
          key={card.id}
          card={card}
          msgId={message.id}
          onCardSelect={onCardSelect}
          onBook={onBook}
          onConvertToWave={onConvertToWave}
        />
      ))}
    </motion.div>
  );
}

function GenCardView({
  card,
  msgId,
  onCardSelect,
  onBook,
  onConvertToWave,
}: {
  card: NonNullable<ChatMessage["cards"]>[number];
  msgId: string;
  onCardSelect: (cardId: string) => void;
  onBook: (msgId: string, lines: { k: string; v: string }[], price: string) => void;
  onConvertToWave: (msgId: string, lines: { k: string; v: string }[], price: string) => void;
}) {
  if (card.type === "timeslot") {
    return (
      <CardShell title={card.title}>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5">
          {card.slots.map((slot) => (
            <button
              key={slot.id}
              onClick={() => onCardSelect(slot.id)}
              className="shrink-0 flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-2xl overline-glass-panel min-w-[92px] border border-white/15 hover:border-brandPurple/60 hover:bg-brandPurple/15 active:scale-95 transition-[border,background,transform]"
            >
              <span className="text-[12px] font-bold text-white/95">
                {slot.label}
              </span>
              {slot.density != null && (
                <span
                  className={`text-[9px] font-bold ${
                    slot.density >= 75
                      ? "text-orange-400"
                      : slot.density <= 30
                        ? "text-emerald-400"
                        : "text-white/55"
                  }`}
                >
                  {slot.density >= 75
                    ? "🔥 热门"
                    : slot.density <= 30
                      ? "空闲"
                      : "适中"}
                </span>
              )}
              {slot.sub && (
                <span className="text-[9px] text-white/45">{slot.sub}</span>
              )}
            </button>
          ))}
        </div>
      </CardShell>
    );
  }
  if (card.type === "provider") {
    return (
      <CardShell title={card.title} subtitle={card.note}>
        <div className="flex flex-col gap-1.5">
          {card.providers.map((p) => (
            <ProviderRow key={p.id} provider={p} onSelect={() => onCardSelect(p.id)} />
          ))}
        </div>
      </CardShell>
    );
  }
  if (card.type === "confirm" || card.type === "success") {
    const booked = card.type === "success";
    return (
      <CardShell
        title={card.title}
        subtitle={booked ? undefined : "核对无误即可确认"}
        accent={booked}
      >
        <div className="flex flex-col gap-1 mb-2.5">
          {card.lines.map((line) => (
            <div key={line.k} className="flex items-start gap-2 text-[11px]">
              <span className="text-white/45 shrink-0 w-12">{line.k}</span>
              <span className="text-white/85">{line.v}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-extrabold bg-clip-text text-transparent bg-linear-to-r from-brandCyan to-brandPurple">
            {card.price}
          </span>
          {booked ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 px-3 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/30">
                <Check size={12} /> 已预订
              </span>
              {/* P1：AI 意向 → 真实弹药发单（human-in-the-loop，人类点击才落库广播） */}
              {card.lines.some((l) => l.k === "弹药单号") ? (
                <span className="text-[11px] font-bold text-brandCyan px-3 py-1.5 rounded-full bg-brandCyan/10 border border-brandCyan/40">
                  已转正式订单 ✅
                </span>
              ) : (
                <button
                  onClick={() => onConvertToWave(msgId, card.lines, card.price)}
                  aria-label="转为正式订单"
                  className="px-3.5 py-1.5 rounded-full btn-primary text-[11px] font-bold glow-purple-strong active:scale-95"
                >
                  📡 转为正式订单
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => onBook(msgId, card.lines, card.price)}
              className="px-3.5 py-1.5 rounded-full btn-primary text-[11px] font-bold glow-purple-strong active:scale-95"
            >
              确认预订
            </button>
          )}
        </div>
      </CardShell>
    );
  }
  return null;
}

function ProviderRow({
  provider,
  onSelect,
}: {
  provider: ProviderItem & {
    match?: { score: number; badge: string };
    breakdown?: ScoreBreakdown;
    availability?: "可约" | "本时段不可约" | "全时段可约" | "已下线";
  };
  onSelect: () => void;
}) {
  const match = provider.match;
  const [showDetail, setShowDetail] = useState(false);
  const detailRows: { key: keyof ScoreBreakdown; label: string; max: number }[] = [
    { key: "budget", label: "预算", max: 25 },
    { key: "level", label: "水平", max: 20 },
    { key: "style", label: "风格", max: 20 },
    { key: "rating", label: "评分", max: 15 },
    { key: "distance", label: "距离", max: 10 },
    { key: "availability", label: "时段", max: 10 },
  ];
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        onClick={onSelect}
        className="w-full flex items-center gap-2.5 p-2 hover:border-brandPurple/50 hover:bg-brandPurple/10 transition-colors text-left active:scale-[0.98]"
      >
        <div className="w-9 h-9 rounded-xl glass-panel flex items-center justify-center text-base shrink-0">
          {provider.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-white/90 truncate">
              {provider.name}
            </span>
            {provider.tag && (
              <span className="text-[9px] px-1.5 py-px rounded-full bg-brandPurple/20 border border-brandPurple/40 text-brandPurple font-semibold shrink-0">
                {provider.tag}
              </span>
            )}
            {match && (
              <span
                className={`text-[9px] px-1.5 py-px rounded-full font-bold shrink-0 ${
                  match.badge === "极高匹配"
                    ? "bg-emerald-400/10 border border-emerald-400/40 text-emerald-400"
                    : match.badge === "高匹配"
                      ? "bg-brandCyan/10 border border-brandCyan/40 text-brandCyan"
                      : match.badge === "中等"
                        ? "bg-yellow-400/10 border border-yellow-400/40 text-yellow-400"
                        : "bg-white/10 border border-white/20 text-white/50"
                }`}
              >
                {match.badge} {match.score}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-white/50">
            <span className="flex items-center gap-0.5 text-yellow-400">
              <Star size={9} className="fill-yellow-400" />
              {provider.rating}
            </span>
            <span>·</span>
            <span className="shrink-0">
              {provider.distanceKm != null ? `距你 ${provider.distanceKm}km` : "距你较远"}
            </span>
            <span className="truncate">· {provider.meta}</span>
          </div>
          {provider.availability === "本时段不可约" && (
            <p className="text-[9px] text-orange-400/90 mt-0.5">
              该时段已约满，建议改选空闲时段 ⏳
            </p>
          )}
          {provider.availability === "已下线" && (
            <p className="text-[9px] text-white/40 mt-0.5">
              暂时未接单，换一个在线服务者更稳
            </p>
          )}
        </div>
        <span className="text-[11px] font-bold text-brandCyan shrink-0">
          {provider.price}
        </span>
      </button>
      {provider.breakdown && (
        <button
          onClick={() => setShowDetail((v) => !v)}
          className="w-full flex items-center justify-center gap-1 py-1 text-[9px] text-white/40 hover:text-white/70 transition-colors"
        >
          <ChevronDown
            size={10}
            className={`transition-transform ${showDetail ? "rotate-180" : ""}`}
          />
          {showDetail ? "收起评分详情" : "评分详情"}
        </button>
      )}
      {showDetail && provider.breakdown && (
        <div className="px-3 pb-2.5 flex flex-col gap-1.5">
          {detailRows.map((row) => {
            const value = provider.breakdown?.[row.key] ?? 0;
            const pct = Math.min(100, (value / row.max) * 100);
            return (
              <div key={row.key} className="flex items-center gap-2">
                <span className="text-[9px] text-white/45 w-7 shrink-0">
                  {row.label}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-linear-to-r from-brandCyan to-brandPurple ${
                      pct === 0 ? "w-0" : ""
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[9px] text-white/60 w-9 text-right shrink-0">
                  {value}/{row.max}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CardShell({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`ml-9 mt-1 max-w-[88%] px-3.5 py-3 rounded-2xl border backdrop-blur-xl ${
        accent
          ? "bg-[rgba(16,220,140,0.08)] border-emerald-400/30 shadow-[0_0_24px_-8px_rgba(16,220,140,0.4)]"
          : "glass-panel"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-extrabold text-white/90">
          {title}
        </span>
        {subtitle && !accent && (
          <span className="text-[9px] text-white/40 truncate">{subtitle}</span>
        )}
      </div>
      {children}
    </motion.div>
  );
}

function ThinkingDot() {
  return (
    <div className="flex justify-start">
      <div className="w-7 h-7 mr-2 mt-0.5 rounded-xl glass-panel flex items-center justify-center shrink-0">
        <Bot size={13} className="text-brandPurple" />
      </div>
      <div className="px-4 py-3 rounded-2xl glass-panel flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-brandPurple animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

