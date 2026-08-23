"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, Star } from "lucide-react";
import type { ChatMessage, ProviderItem } from "@/base/ai/chat/types";
import type { ScoreBreakdown } from "@/base/dispatch/match";

/**
 * 意图草稿转化卡：AI 生成卡渲染桥（timeslot 时段卡 / provider 服务者卡 /
 * confirm·success 确认单与预订成功卡 —— 「📡 转为正式订单」真实弹药发单入口）。
 * （ChatPage 内嵌渲染段子组件化搬移，selector/DOM 零漂移。）
 */
export function GenCardView({
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
                  className={`text-xs font-bold ${
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
                <span className="text-xs text-white/45">{slot.sub}</span>
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
            <div key={line.k} className="flex items-start gap-2 text-xs">
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
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 px-3 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/30">
                <Check size={12} /> 已预订
              </span>
              {/* P1：AI 意向 → 真实弹药发单（human-in-the-loop，人类点击才落库广播） */}
              {card.lines.some((l) => l.k === "方案单号") ? (
                <span className="text-xs font-bold text-brandCyan px-3 py-1.5 rounded-full bg-brandCyan/10 border border-brandCyan/40">
                  已转正式订单 ✅
                </span>
              ) : (
                <button
                  onClick={() => onConvertToWave(msgId, card.lines, card.price)}
                  aria-label="转为正式订单"
                  className="px-3.5 py-1.5 rounded-full btn-primary text-xs font-bold glow-purple-strong active:scale-95"
                >
                  📡 转为正式订单
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => onBook(msgId, card.lines, card.price)}
              className="px-3.5 py-1.5 rounded-full btn-primary text-xs font-bold glow-purple-strong active:scale-95"
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
              <span className="text-xs px-1.5 py-px rounded-full bg-brandPurple/20 border border-brandPurple/40 text-brandPurple font-semibold shrink-0">
                {provider.tag}
              </span>
            )}
            {match && (
              <span
                className={`text-xs px-1.5 py-px rounded-full font-bold shrink-0 ${
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
          <div className="flex items-center gap-1 text-xs text-white/50">
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
            <p className="text-xs text-orange-400/90 mt-0.5">
              该时段已约满，建议改选空闲时段 ⏳
            </p>
          )}
          {provider.availability === "已下线" && (
            <p className="text-xs text-white/40 mt-0.5">
              暂时未接单，换一个在线服务者更稳
            </p>
          )}
        </div>
        <span className="text-xs font-bold text-brandCyan shrink-0">
          {provider.price}
        </span>
      </button>
      {provider.breakdown && (
        <button
          onClick={() => setShowDetail((v) => !v)}
          className="w-full flex items-center justify-center gap-1 py-1 text-xs text-white/40 hover:text-white/70 transition-colors"
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
                <span className="text-xs text-white/45 w-7 shrink-0">
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
                <span className="text-xs text-white/60 w-9 text-right shrink-0">
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
        <span className="text-xs font-extrabold text-white/90">
          {title}
        </span>
        {subtitle && !accent && (
          <span className="text-xs text-white/40 truncate">{subtitle}</span>
        )}
      </div>
      {children}
    </motion.div>
  );
}
