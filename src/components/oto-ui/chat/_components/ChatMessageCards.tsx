"use client";
import { useState } from "react";
import DuoPill from "@/components/ui/DuoPill";
import { motion } from "framer-motion";
import { RISE_8 } from "@/components/ui/motion";
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
              className="shrink-0 flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-2xl bg-white min-w-[92px] border-2 border-[var(--color-duo-swan)] hover:border-[var(--color-duo-green)]/50 hover:bg-[var(--color-duo-green)]/[.06] active:translate-y-px active:brightness-[0.97] transition-[border,background,transform,filter]"
            >
              <span className="text-[12px] font-bold text-[var(--color-duo-eel)]">
                {slot.label}
              </span>
              {slot.density != null && (
                <span
                  className={`text-xs font-bold ${
                    slot.density >= 75
                      ? "text-[var(--color-duo-orange-dark)]"
                      : slot.density <= 30
                        ? "text-[var(--color-duo-green-ink)]"
                        : "text-[var(--color-duo-wolf)]"
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
                <span className="text-xs text-[var(--color-duo-hare)]">{slot.sub}</span>
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
              <span className="text-[var(--color-duo-hare)] shrink-0 w-12">{line.k}</span>
              <span className="text-[var(--color-duo-eel)]">{line.v}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-extrabold text-[var(--color-duo-green-ink)] font-tabular">
            {card.price}
          </span>
          {booked ? (
            <div className="flex items-center gap-2">
              <DuoPill tone="green" className="px-3 py-1.5">
                <Check size={12} /> 已预订
              </DuoPill>
              {/* P1：AI 意向 → 真实弹药发单（human-in-the-loop，人类点击才落库广播） */}
              {card.lines.some((l) => l.k === "方案单号") ? (
                <DuoPill tone="blue" className="px-3 py-1.5">
                  已转正式订单 ✅
                </DuoPill>
              ) : (
                <DuoPill
                  tone="green"
                  variant="solid"
                  as="button"
                  ariaLabel="转为正式订单"
                  onClick={() => onConvertToWave(msgId, card.lines, card.price)}
                  className="px-3.5 py-1.5 border-0 border-b-2 active:scale-95"
                >
                  📡 转为正式订单
                </DuoPill>
              )}
            </div>
          ) : (
            <DuoPill
              tone="green"
              variant="solid"
              as="button"
              onClick={() => onBook(msgId, card.lines, card.price)}
              className="px-3.5 py-1.5 border-0 border-b-2 active:scale-95"
            >
              确认预订
            </DuoPill>
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
    <div className="rounded-xl border border-[var(--color-duo-swan)] bg-[var(--color-duo-polar)] overflow-hidden">
      <button
        onClick={onSelect}
        className="w-full flex items-center gap-2.5 p-2 hover:border-[var(--color-duo-green)]/50 hover:bg-[var(--color-duo-green)]/[.06] transition-colors text-left active:scale-[0.98]"
      >
        <div className="w-9 h-9 rounded-xl bg-white border border-[var(--color-duo-swan)] flex items-center justify-center text-base shrink-0">
          {provider.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-[var(--color-duo-eel)] truncate">
              {provider.name}
            </span>
            {provider.tag && (
              <DuoPill tone="blue" className="shrink-0">
                {provider.tag}
              </DuoPill>
            )}
            {match && (
              <span
                className={`text-xs px-1.5 py-px rounded-full font-bold shrink-0 border-2 ${
                  match.badge === "极高匹配"
                    ? "bg-[var(--color-duo-green)]/10 border-[var(--color-duo-green)]/40 text-[var(--color-duo-green-ink)]"
                    : match.badge === "高匹配"
                      ? "bg-[var(--color-duo-blue)]/10 border-[var(--color-duo-blue)]/40 text-[var(--color-duo-blue-ink)]"
                      : match.badge === "中等"
                        ? "bg-[var(--color-duo-yellow)]/10 border-[var(--color-duo-yellow-dark)]/50 text-[var(--color-duo-yellow-ink)]"
                        : "bg-[var(--color-duo-polar)] border-[var(--color-duo-swan)] text-[var(--color-duo-hare)]"
                }`}
              >
                {match.badge} {match.score}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-[var(--color-duo-hare)]">
            <span className="flex items-center gap-0.5 text-[var(--color-duo-yellow-dark)]">
              <Star size={9} className="fill-[var(--color-duo-yellow)]" />
              {provider.rating}
            </span>
            <span>·</span>
            <span className="shrink-0">
              {provider.distanceKm != null ? `距你 ${provider.distanceKm}km` : "距你较远"}
            </span>
            <span className="truncate">· {provider.meta}</span>
          </div>
          {provider.availability === "本时段不可约" && (
            <p className="text-xs text-[var(--color-duo-orange-dark)] mt-0.5">
              该时段已约满，建议改选空闲时段 ⏳
            </p>
          )}
          {provider.availability === "已下线" && (
            <p className="text-xs text-[var(--color-duo-hare)] mt-0.5">
              暂时未接单，换一个在线服务者更稳
            </p>
          )}
        </div>
        <span className="text-xs font-bold text-[var(--color-duo-blue-ink)] shrink-0">
          {provider.price}
        </span>
      </button>
      {provider.breakdown && (
        <button
          onClick={() => setShowDetail((v) => !v)}
          className="w-full flex items-center justify-center gap-1 py-1 text-xs text-[var(--color-duo-hare)] hover:text-[var(--color-duo-wolf)] transition-colors"
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
                <span className="text-xs text-[var(--color-duo-hare)] w-7 shrink-0">
                  {row.label}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--color-duo-polar)] overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-[var(--color-duo-green)] ${
                      pct === 0 ? "w-0" : ""
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-[var(--color-duo-wolf)] w-9 text-right shrink-0">
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
      initial={RISE_8.initial}
      animate={RISE_8.animate}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`ml-9 mt-1 max-w-[88%] px-3.5 py-3 rounded-2xl border-2 ${
        accent
          ? "bg-[var(--color-duo-green-light)] border-[var(--color-duo-green)]/40"
          : "bg-white border-[var(--color-duo-swan)]"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-extrabold text-[var(--color-duo-eel)]">
          {title}
        </span>
        {subtitle && !accent && (
          <span className="text-xs text-[var(--color-duo-hare)] truncate">{subtitle}</span>
        )}
      </div>
      {children}
    </motion.div>
  );
}
