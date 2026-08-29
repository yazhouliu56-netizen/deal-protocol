"use client";
import { ShoppingBag } from "lucide-react";
import type { Wave } from "@/base/order/wave";
import type { AtomicFiveState } from "@/types/ammo-schema";
import { toast } from "@/base/platform/toast";
import { useWaveStore } from "@/store/useWaveStore";
import StatusCapsule from "@/components/oto-ui/StatusCapsule";
import IdentityAvatar from "@/components/oto-ui/IdentityAvatar";
import NotificationCenter from "@/components/waves/NotificationCenter";

export type HomeMode = "buyer" | "seller";

interface HomeTopBarProps {
  /** 当前用户进行中活动 Wave（HomePage 同源投影，null = 无进行中单不渲染胶囊）。 */
  activeWave: Wave | null;
  /** activeWave 经 toAtomicFiveState 的五态投影。 */
  activeFiveState: AtomicFiveState | null;
  cartCount: number;
  onOpenCart: () => void;
  /** 三段式双角色本地视口（buyer=找帮手 / seller=去接单），HomePage 本地state，0 Store扩充。 */
  mode?: HomeMode;
  onModeChange?: (mode: HomeMode) => void;
}

/** 首页头部状态区：顶栏五态灵动胶囊 + 问候行（头像/通知/心愿单入口）。 */
export default function HomeTopBar({
  activeWave,
  activeFiveState,
  cartCount,
  onOpenCart,
  mode = "buyer",
  onModeChange,
}: HomeTopBarProps) {
  return (
    <>
      {/* W2 总装：顶栏五态灵动胶囊（当前进行中订单实时投影：🟡广播 ➔ 🔵就位 ➔ 🟣履约 ➔ 🟠待验收 ➔ 🟢已结算） */}
      {activeWave && activeFiveState && (
        <div className="flex justify-center mb-2" data-testid="top-status-capsule">
          <StatusCapsule
            status={activeFiveState}
            options={{
              isOffline: typeof navigator !== "undefined" ? !navigator.onLine : false,
              // P0 接电：SOS 一键报警 → 危机应急预案（级别 3 极端紧急，EPA 三通道通知）
              onSosClick: () => {
                useWaveStore
                  .getState()
                  .raiseCrisis({
                    level: 3,
                    note: "首页顶栏 SOS 一键报警（紧急求助）",
                    waveId: activeWave.id,
                    contacts: [],
                  });
                toast("🚨 SOS 已上报 · 已通知紧急联系人/平台值班/警方通道", "success");
              },
            }}
          />
        </div>
      )}
      {/* 问候语 + 标题 */}
      <div className="flex items-center gap-2.5 mb-1">
        <IdentityAvatar />
        <p className="text-[13px] text-[#4b4b4b] font-bold flex-1">
          Hello, Alex! 👋
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <NotificationCenter />
          <button
            onClick={onOpenCart}
            aria-label={`心愿单，共 ${cartCount} 项`}
            className="relative w-11 h-11 rounded-full bg-white border-2 border-[#e5e5e5] border-b-4 shadow-sm flex items-center justify-center shrink-0 hover:border-[#58cc02]/30 active:translate-y-1 active:border-b-2 transition-[transform,border] "
          >
            <ShoppingBag size={15} className="text-[#4b4b4b]" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#ff4b4b] border-2 border-white text-xs font-bold text-white flex items-center justify-center shadow-sm">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
      {/* 区块A：双角色分段选择器（本地mode视口隔离，真实联动Seller工单流，0 Store扩充） */}
      <div
        className="mt-2 flex items-center p-1 rounded-full bg-[#f7f7f7] border-2 border-[#e5e5e5] w-fit"
        role="tablist"
        aria-label="角色视口切换"
        data-testid="home-mode-segment"
      >
        <button
          role="tab"
          aria-selected={mode === "buyer"}
          data-testid="home-mode-buyer"
          data-active={mode === "buyer" ? "true" : "false"}
          onClick={() => onModeChange?.("buyer")}
          className={`px-4 py-2 rounded-full text-xs font-extrabold transition-all min-h-10 ${
            mode === "buyer"
              ? "bg-white border-2 border-[#e5e5e5] border-b-4 shadow-sm text-[#4b4b4b]"
              : "text-[#afafaf] hover:text-[#4b4b4b]"
          }`}
        >
          🔍 找帮手 / 约局
        </button>
        <button
          role="tab"
          aria-selected={mode === "seller"}
          data-testid="home-mode-seller"
          data-active={mode === "seller" ? "true" : "false"}
          onClick={() => onModeChange?.("seller")}
          className={`px-4 py-2 rounded-full text-xs font-extrabold transition-all min-h-10 ${
            mode === "seller"
              ? "bg-[#58cc02] border-2 border-[#46a302] border-b-4 shadow-sm text-white"
              : "text-[#afafaf] hover:text-[#4b4b4b]"
          }`}
        >
          ⚡ 去接单赚钱
        </button>
      </div>
      {/* 安全背书单行（收敛分散横幅） */}
      <p className="mt-2 text-xs font-bold text-[#777777] flex items-center gap-1">
        🛡️ 平台官方全额资金托管与财产险担保中
      </p>
    </>
  );
}
