"use client";
import { useState } from "react";
import { Clapperboard, ShieldAlert, RotateCcw, Sparkles } from "lucide-react";
import { useIdentityStore } from "@/store/useIdentityStore";
import { useRoamStore } from "@/store/useRoamStore";

/** 演示允许的全部品类集合（与塔台作出新身份一致的默认集合）。 */
const ALL_CATEGORIES = [
  "厨师 · 上门做饭",
  "羽毛球约局",
  "摄影师约拍",
  "家政保洁",
  "陪诊陪护",
  "拼桌桌游",
];

/**
 * 演示座舱：一键切换「需求方 / 服务者 / 多开风控」剧本，让三视角演示
 * 无需重开身份即见不同结果（雷达 feed 过滤是 identity 驱动，切换即可感）。
 * 全程使用 store 既有 API，不叠加演示数据。
 */
export default function CockpitDemoCard() {
  const identity = useIdentityStore((s) => s.identity);
  const setCapability = useIdentityStore((s) => s.setCapability);
  const setStatus = useIdentityStore((s) => s.setStatus);
  const setOnline = useIdentityStore((s) => s.setOnline);
  const roamReset = useRoamStore((s) => s.resetDemo);
  const roamMulti = useRoamStore((s) => s.simulateMultiOpen);
  const [note, setNote] = useState("默认身份即「需求方 + 响应者」双面角色");

  const resetAll = () => {
    setCapability({
      categories: ALL_CATEGORIES,
      tags: [],
      distanceKm: 2,
      verified: false,
    });
    setStatus("online");
    setOnline(true);
    roamReset(identity.id);
    setNote("已复位为默认双面角色");
  };

  const becomeDemander = () => {
    setCapability({ categories: [], tags: [], distanceKm: 8, verified: true });
    setStatus("online");
    setNote("已切为纯「需求方」：雷达 feed 将只给你推送你能接的局之前置要求（全品类能力空）");
  };

  const becomeResponder = () => {
    setCapability({
      categories: ALL_CATEGORIES,
      tags: ["服务中", "全品类"],
      distanceKm: 10,
      verified: true,
    });
    setStatus("online");
    setOnline(true);
    roamReset(identity.id);
    setNote("已切到「服务者 / 全品类响应」：雷达会自动匹配更多局给你接单");
  };

  const runRiskPlay = () => {
    roamMulti(identity.id);
    setNote("已触发「同设备多开」风控演示 → 看安全中心的风险状态");
  };

  const actions = [
    { icon: Clapperboard, label: "我是需求方", do: becomeDemander, tone: "" },
    { icon: Sparkles, label: "我是服务者", do: becomeResponder, tone: "" },
    { icon: ShieldAlert, label: "多开风控", do: runRiskPlay, tone: "tone-red" },
  ];

  return (
    <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-3.5">
      <div className="flex items-center gap-2">
        <Clapperboard size={13} className="text-brandPurple" />
        <span className="text-[12px] font-extrabold text-white/85">演示座舱</span>
      </div>
      <p className="text-xs text-white/45 mt-1 truncate">{note}</p>

      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.do}
            className={`py-2.5 rounded-xl bg-white/5 border text-xs font-bold flex flex-col items-center gap-1 transition-colors active:scale-[0.98] ${
              a.tone === "tone-red"
                ? "border-red-400/30 text-red-300 hover:bg-red-400/10"
                : "border-white/15 text-white/70 hover:bg-white/10"
            }`}
          >
            <a.icon size={13} />
            {a.label}
          </button>
        ))}
      </div>
      <button
        onClick={resetAll}
        aria-label="复位演示座舱"
        className="mt-2 w-full py-1.5 rounded-lg bg-white/[0.03] border border-dashed border-white/15 text-xs font-bold text-white/40 hover:text-white/70 hover:border-white/25 transition-colors"
      >
        <span className="inline-flex items-center gap-1 justify-center">
          <RotateCcw size={10} /> 复位演示座舱
        </span>
      </button>
    </div>
  );
}