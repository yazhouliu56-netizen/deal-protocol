"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Plus, Timer, Wifi, WifiOff } from "lucide-react";
import { useIdentityStore } from "@/store/useIdentityStore";
import { useWaveStore } from "@/store/useWaveStore";
import { completionRate, rankLabel, reviewStats } from "@/base/trust/starRank";
import { requiresVerification } from "@/base/dispatch/broadcast";
import { dispatchRuleFor } from "@/ammo/dispatch-rule";

/**
 * 能力声明 — the responder's capability statement (the core match input).
 * Edits flow into BOTH the private identity and the shared responder pool,
 * so the radar sorting reacts immediately.
 */
const ALL_CATEGORIES = [
  "厨师 · 上门做饭",
  "羽毛球约局",
  "摄影师约拍",
  "家政保洁",
  "陪诊陪护",
  "拼桌桌游",
];

export default function CapabilityPanel() {
  const identity = useIdentityStore((s) => s.identity);
  const status = useIdentityStore((s) => s.status);
  const setCapability = useIdentityStore((s) => s.setCapability);
  const setStatus = useIdentityStore((s) => s.setStatus);
  const registerResponder = useWaveStore((s) => s.registerResponder);
  const reviews = useWaveStore((s) => s.reviews);
  const claims = useWaveStore((s) => s.claims);

  // 星级成长（Airtasker 双指标：均分 ★ + 完成率）
  const myStats = reviewStats(reviews, identity.id);
  const myCompletion = completionRate(claims, identity.id);

  const [open, setOpen] = useState(false);
  const [customCat, setCustomCat] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tagFull, setTagFull] = useState(false);

  function toggleCategory(cat: string) {
    const next = identity.categories.includes(cat)
      ? identity.categories.filter((c) => c !== cat)
      : [...identity.categories, cat];
    commit({ categories: next });
  }

  function commit(patch: Parameters<typeof setCapability>[0]) {
    setCapability(patch);
    const merged = { ...identity, ...patch };
    registerResponder({
      id: identity.id,
      nickname: identity.nickname,
      categories: merged.categories,
      tags: merged.tags,
      distanceKm: merged.distanceKm,
      verified: merged.verified,
      online: merged.online,
    });
  }

  function addTag() {
    if (identity.tags.length >= 3) {
      setTagFull(true);
      return;
    }
    const t = tagInput.trim();
    if (t && !identity.tags.includes(t)) {
      commit({ tags: [...identity.tags, t] });
    }
    setTagInput("");
  }

  return (
    <div className="bg-white border-2 border-[#e5e5e5] border-b-4 rounded-2xl">
      {/* 头部 */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-3.5 flex items-center gap-3 text-left"
        aria-label="能力声明"
      >
        <div className="w-10 h-10 rounded-xl bg-[#58cc02] border-b-2 border-[#58a700] text-white flex items-center justify-center shrink-0">
          🎯
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[12.5px] font-bold block">能力声明</span>
          <span className="text-xs text-[#afafaf] block mt-0.5 truncate">
            {identity.categories.length} 个品类 · {identity.tags.length} 个标签 ·{" "}
            {identity.distanceKm} km · {identity.online ? "在线" : "隐身"}
          </span>
          <span
            className="text-xs font-bold text-[#8a6d00] block mt-0.5 truncate"
            aria-label="服务商星级"
          >
            {rankLabel({ ...myStats, completion: myCompletion })}
          </span>
        </div>
        <span className="text-[#afafaf] text-lg shrink-0">›</span>
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="overflow-hidden px-3.5 pb-3.5"
        >
          {/* 状态总闸：在线 / 忙碌 / 隐身 */}
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[#f7f7f7] border-2 border-[#e5e5e5] mb-3">
            <span className="flex items-center gap-2 text-xs text-[#4b4b4b]">
              {status === "online" ? (
                <Wifi size={12} className="text-[#58cc02]" />
              ) : status === "busy" ? (
                <Timer size={12} className="text-[#e5b400]" />
              ) : (
                <WifiOff size={12} className="text-[#afafaf]" />
              )}
              状态总闸（隐身/忙碌不接收新广播）
            </span>
            <div className="flex gap-1 shrink-0">
              {(
                [
                  ["online", "在线"],
                  ["busy", "忙碌"],
                  ["offline", "隐身"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setStatus(key)}
                  aria-label={`状态${label}`}
                  className={`px-2 py-1 rounded-full text-xs font-bold transition-colors border-2 ${
                    status === key
                      ? key === "online"
                        ? "bg-[#58cc02]/15 text-[#357a00] border-[#58cc02]/50"
                        : key === "busy"
                          ? "bg-[#ffc800]/15 text-[#8a6d00] border-[#e5b400]/60"
                          : "bg-white text-[#777777] border-[#e5e5e5]"
                      : "bg-[#f7f7f7] text-[#afafaf] border-[#e5e5e5]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 品类 */}
          <span className="text-xs font-semibold text-[#afafaf] block mb-1.5">
            服务品类（硬过滤：不声明的品类收不到广播）
          </span>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {ALL_CATEGORIES.map((c) => {
              const on = identity.categories.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleCategory(c)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors border-2 ${
                    on
                      ? "bg-[#58cc02] border-[#58a700] text-white"
                      : "bg-white border-[#e5e5e5] text-[#afafaf]"
                  }`}
                >
                  {on && <Check size={10} className="inline mr-0.5" />}
                  {c}
                </button>
              );
            })}
            <div className="flex gap-1">
              <input
                value={customCat}
                onChange={(e) => setCustomCat(e.target.value)}
                placeholder="自定义品类"
                aria-label="自定义品类"
                className="w-24 rounded-full bg-white border-2 border-[#e5e5e5] px-2.5 py-1 text-xs outline-none focus:border-[#58cc02]"
              />
              <button
                onClick={() => {
                  const c = customCat.trim();
                  if (c) {
                    commit({ categories: [...identity.categories, c] });
                    setCustomCat("");
                  }
                }}
                className="w-7 h-7 rounded-full bg-white border-2 border-[#e5e5e5] flex items-center justify-center text-[#777777]"
                aria-label="添加品类"
              >
                <Plus size={11} />
              </button>
            </div>
          </div>

          {/* 标签 */}
          <span className="text-xs font-semibold text-[#afafaf] block mb-1.5">
            能力标签（匹配定制条件 · 如：女性 / 熟手 / 日系）
          </span>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {identity.tags.map((t) => (
              <button
                key={t}
                onClick={() =>
                  commit({ tags: identity.tags.filter((x) => x !== t) })
                }
                className="px-2 py-0.5 rounded-full bg-[#1cb0f6]/10 border-2 border-[#1cb0f6]/40 text-xs font-bold text-[#0a6ea8]"
              >
                {t} ✕
              </button>
            ))}
            <div className="flex gap-1">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="加标签"
                aria-label="添加标签"
                className="w-24 rounded-full bg-white border-2 border-[#e5e5e5] px-2.5 py-1 text-xs outline-none focus:border-[#1cb0f6]"
              />
              <button
                onClick={addTag}
                className="w-7 h-7 rounded-full bg-white border-2 border-[#e5e5e5] flex items-center justify-center text-[#777777]"
                aria-label="添加标签"
              >
                <Plus size={11} />
              </button>
            </div>
          </div>
          <p className="text-xs text-[#afafaf] -mt-1 mb-2">
            兴趣标签最多 3 个 · 随时可换（{3 - identity.tags.length} 空位）
            {tagFull && <span className="text-[#8a6d00]"> 已满，先删再改</span>}
          </p>

          {/* 距离 */}
          <div className="mb-3">
            <span className="text-xs font-semibold text-[#afafaf] block mb-1">
              服务半径 · {identity.distanceKm} km
            </span>
            <input
              type="range"
              min={0.5}
              max={15}
              step={0.5}
              value={identity.distanceKm}
              onChange={(e) =>
                commit({ distanceKm: parseFloat(e.target.value) })
              }
              className="w-full accent-[#58cc02]"
              aria-label="服务半径"
            />
          </div>

          {/* 认证模拟（进家品类硬门槛） */}
          <button
            onClick={() => commit({ verified: !identity.verified })}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[#f7f7f7] border border-[#e5e5e5]"
            aria-label="实名认证模拟"
          >
            <span className="text-xs text-[#4b4b4b]">
              ✅ 实名认证模拟（信用加权 +5）
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full border-2 ${
                identity.verified
                  ? "bg-[#58cc02]/10 border-[#58cc02]/40 text-[#357a00]"
                  : "bg-[#f7f7f7] border-[#e5e5e5] text-[#afafaf]"
              }`}
            >
              {identity.verified ? "已认证" : "未认证"}
            </span>
          </button>
          {!identity.verified &&
            identity.categories.some((c) =>
              requiresVerification(c, dispatchRuleFor(c))
            ) && (
              <p className="text-xs text-[#8a6d00] mt-1.5">
                ⚠️ 陪诊/家政/上门做饭等进家品类需先实名认证（对标 Care.com 接单门槛）
              </p>
            )}
        </motion.div>
      )}
    </div>
  );
}