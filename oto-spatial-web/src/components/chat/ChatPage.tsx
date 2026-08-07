"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Check, Send, Sparkles, Star } from "lucide-react";
import { useAppStore, type Booking } from "@/store/useAppStore";
import { MockEngine } from "@/lib/chat/mockEngine";
import { LlmEngine } from "@/lib/chat/llmEngine";
import type { ChatMessage, ChatEvent, GenCard, ProviderItem } from "@/lib/chat/types";
import { ChevronDown } from "lucide-react";
import type { ScoreBreakdown } from "@/lib/match";

const SUGGESTIONS = [
  "周日下午想找人打羽毛球",
  "想约摄影师拍一组日系写真",
  "周末找个保洁上门",
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

/**
 * AI 对话助手屏：多轮追问（M1） + 生成式卡片交互（M2）。
 * 卡片流：时间槽卡 → 服务者卡 → 确认单卡 → 预订（本地闭环）。
 */
export default function ChatPage() {
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
    return useLlm ? new LlmEngine() : new MockEngine();
  }, [session, useLlm]);
  const [input, setInput] = useState("");
  const composingRef = useRef(false);
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

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
  }

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    // While streaming, keep the typed text in the box instead of silently
    // discarding it — user presses Enter again once the reply lands.
    if (streaming) return;
    setInput("");
    addChatMessage({ id: crypto.randomUUID(), role: "user", content: trimmed });
    const assistantId = crypto.randomUUID();
    addChatMessage({ id: assistantId, role: "assistant", content: "" });
    setStreaming(true);
    try {
      await runStream(engine.send(trimmed), assistantId);
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
        ...lines.filter((l) => l.k !== "服务"),
        { k: "订单号", v: booking.id.slice(0, 8).toUpperCase() },
      ],
      price,
    };
    updateChatCards(msgId, [...(message?.cards ?? []), successCard]);
  }

  return (
    <div className="pointer-events-auto flex flex-col h-full min-h-0">
      {/* 头部 */}
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
          onClick={() => {
            useAppStore.getState().clearChat();
            setSession((s) => s + 1);
          }}
          className="text-[10px] text-white/40 hover:text-white/80 px-2 py-1 rounded-full glass-panel transition-colors"
        >
          新对话
        </button>
      </div>

      {/* 消息流 */}
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
          />
        ))}
        {thinking && <ThinkingDot />}
      </div>

      {/* 快捷建议 */}
      {chatMessages.length <= 2 && !streaming && (
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

      {/* 输入框 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          // 中文输入法选字回车（IME composing）不触发发送
          if (composingRef.current) return;
          handleSend(input);
        }}
        className="mt-3 flex items-center gap-2"
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
      </form>
    </div>
  );
}

function ChatBubble({
  message,
  isLatest = false,
  onCardSelect,
  onBook,
}: {
  message: ChatMessage;
  isLatest?: boolean;
  onCardSelect: (cardId: string) => void;
  onBook: (msgId: string, lines: { k: string; v: string }[], price: string) => void;
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
      {message.cards?.map((card) => (
        <GenCardView
          key={card.id}
          card={card}
          msgId={message.id}
          onCardSelect={onCardSelect}
          onBook={onBook}
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
}: {
  card: NonNullable<ChatMessage["cards"]>[number];
  msgId: string;
  onCardSelect: (cardId: string) => void;
  onBook: (msgId: string, lines: { k: string; v: string }[], price: string) => void;
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
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 px-3 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/30">
              <Check size={12} /> 已预订
            </span>
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