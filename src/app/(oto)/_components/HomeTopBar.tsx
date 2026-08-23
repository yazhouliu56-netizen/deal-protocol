"use client";
import { ShoppingBag } from "lucide-react";
import type { Wave } from "@/base/order/wave";
import type { AtomicFiveState } from "@/types/ammo-schema";
import { toast } from "@/base/platform/toast";
import { useWaveStore } from "@/store/useWaveStore";
import StatusCapsule from "@/components/oto-ui/StatusCapsule";
import IdentityAvatar from "@/components/oto-ui/IdentityAvatar";
import NotificationCenter from "@/components/waves/NotificationCenter";

interface HomeTopBarProps {
  /** 当前用户进行中活动 Wave（HomePage 同源投影，null = 无进行中单不渲染胶囊）。 */
  activeWave: Wave | null;
  /** activeWave 经 toAtomicFiveState 的五态投影。 */
  activeFiveState: AtomicFiveState | null;
  cartCount: number;
  onOpenCart: () => void;
}

/** 首页头部状态区：顶栏五态灵动胶囊 + 问候行（头像/通知/心愿单入口）。 */
export default function HomeTopBar({
  activeWave,
  activeFiveState,
  cartCount,
  onOpenCart,
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
        <p className="text-[13px] text-white/75 font-medium flex-1">
          Hello, Alex! 👋
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <NotificationCenter />
          <button
            onClick={onOpenCart}
            aria-label={`心愿单，共 ${cartCount} 项`}
            className="relative w-11 h-11 rounded-full glass-panel-interactive flex items-center justify-center shrink-0 hover:border-brandPurple/50 active:scale-95 transition-[border,transform]"
          >
            <ShoppingBag size={15} className="text-white/80" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-brandPurple border border-white/30 text-xs font-bold text-white flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
