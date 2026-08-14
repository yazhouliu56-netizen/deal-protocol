"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { SlidersHorizontal, X, Check, Navigation, ScanSearch } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { otoExperiences } from "@/lib/mockData";
import {
  PRICE_BANDS,
  filterDestinations,
} from "@/base/geo/destFilter";
import DestinationCard from "./DestinationCard";

/**
 * 目的地中心（G-1/G-2）：筛选抽屉 + 全部列表。
 * 过滤：预算档 / 仅 AR / 排序（推荐、评分、价格↑↓、离我最近）。
 * 复用详情打开（openExperience），卡片与首页同源。
 */
export default function DestinationHub({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const openExperience = useAppStore((s) => s.openExperience);
  const [band, setBand] = useState<(typeof PRICE_BANDS)[number]["id"]>("any");
  const [arOnly, setArOnly] = useState(false);
  const [sort, setSort] = useState<
    "recommend" | "rating" | "price-asc" | "price-desc" | "near"
  >("recommend");

  const list = useMemo(
    () =>
      filterDestinations(otoExperiences, {
        band,
        arOnly,
        sort,
      }),
    [band, arOnly, sort]
  );

  if (!open) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.section
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed inset-x-2 top-16 bottom-16 z-50 glass-panel !bg-[#0b0e22]/95 rounded-3xl flex flex-col overflow-hidden"
      >
        {/* 头部 */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <span className="text-[14px] font-extrabold flex items-center gap-1.5">
            <ScanSearch size={15} className="text-brandCyan" />
            目的地中心
          </span>
          <span className="text-[10px] text-white/40 font-normal">
            {otoExperiences.length} 个体验 · 筛选后 {list.length}
          </span>
          <div className="flex-1" />
          <button
            onClick={onClose}
            aria-label="关闭目的地中心"
            className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white"
          >
            <X size={13} />
          </button>
        </div>

        {/* 筛选区 */}
        <div className="px-4 pb-3 flex flex-col gap-2.5 border-b border-white/8">
          <div className="flex items-center gap-1.5 text-[10px] text-white/45">
            <SlidersHorizontal size={10} className="text-brandPurple" />
            价位档
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRICE_BANDS.map((b) => (
              <button
                key={b.id}
                onClick={() => setBand(b.id)}
                className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold transition-colors ${
                  band === b.id
                    ? "btn-primary glow-purple-strong"
                    : "bg-white/5 border border-white/10 text-white/60 hover:text-white"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={() => setArOnly(!arOnly)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold transition-colors ${
                arOnly
                  ? "bg-brandCyan/20 border border-brandCyan/50 text-brandCyan"
                  : "bg-white/5 border border-white/10 text-white/45 hover:text-white"
              }`}
            >
              {arOnly ? <Check size={10} /> : null}
              仅 AR 预览
            </button>

            <div className="flex items-center gap-1 flex-wrap">
              {(
                [
                  { id: "recommend", label: "推荐" },
                  { id: "rating", label: "评分" },
                  { id: "price-asc", label: "价格 ↑" },
                  { id: "price-desc", label: "价格 ↓" },
                  { id: "near", label: "离我最近" },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSort(s.id)}
                  className={`group flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                    sort === s.id
                      ? "bg-brandPurple/25 border border-brandPurple/50 text-brandPurple-foreground"
                      : "bg-white/5 border border-white/10 text-white/40 hover:text-white"
                  }`}
                >
                  {sort === s.id && <Check size={9} className="text-brandCyan" />}
                  <span className="flex items-center gap-1">
                    {s.id === "near" ? <Navigation size={9} /> : null}
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 结果网格 */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-3 pb-6">
          {list.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-3xl">🌊</p>
              <p className="text-[12px] font-bold text-white/80 mt-3">
                没有符合筛选的目的地
              </p>
              <p className="text-[10px] text-white/45 mt-1">
                换个价位档，或关闭「仅 AR 预览」再试试
              </p>
            </div>
          ) : (
            <>
              <p className="text-[10px] text-white/35 mb-2">
                {list.length} 个目的地 · 排序与筛选即时生效
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {list.map((item) => (
                  <DestinationCard
                    key={item.id}
                    item={item}
                    onOpen={() => {
                      onClose();
                      openExperience(item);
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </motion.section>
    </>
  );
}