"use client";
import type { Wave } from "@/base/order/wave";
import type { AtomicFiveState } from "@/types/ammo-schema";
import { toast } from "@/base/platform/toast";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
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

/** OTO 萌趣双笑脸胶囊 Logo（inline SVG，aria-hidden，零外部切图）。 */
function OtoLogoCapsule() {
  return (
    <span
      aria-hidden="true"
      className="flex h-11 items-center gap-1 rounded-full bg-white border-2 border-[#e5e5e5] border-b-4 shadow-sm px-2.5 shrink-0 select-none"
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <circle cx="7" cy="11" r="6" fill="#58cc02" />
        <circle cx="15" cy="11" r="6" fill="#1cb0f6" />
        <circle cx="5.2" cy="9.5" r="1" fill="#fff" />
        <circle cx="8.8" cy="9.5" r="1" fill="#fff" />
        <path d="M4.8 12.5q2.2 2 4.4 0" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="13.2" cy="9.5" r="1" fill="#fff" />
        <circle cx="16.8" cy="9.5" r="1" fill="#fff" />
        <path d="M12.8 12.5q2.2 2 4.4 0" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span className="text-xs font-black tracking-wide text-[#4b4b4b]">OTO</span>
    </span>
  );
}

/**
 * 首页顶栏（1:1 图纸形态）：紫徽章头像 + Hello 问候 + 铃铛 + OTO 胶囊。
 * 外骨骼保底：五态灵动胶囊（有进行中单时）/ SOS（铃铛抽屉行 + 首页悬浮触点）
 * 逻辑 100% 保留；卖家双胶囊按裁决撤出首页（我的 → 服务者工作台）。
 * E2E：data-testid="top-status-capsule" 原位保留。
 */
export default function HomeTopBar({
  activeWave,
  activeFiveState,
  cartCount,
  onOpenCart,
}: HomeTopBarProps) {
  const nickname = useIdentityStore((s) => s.identity.nickname) || "Alex";
  const handleSos = () => {
    useWaveStore
      .getState()
      .raiseCrisis({
        level: 3,
        note: "首页顶栏 SOS 一键报警（紧急求助）",
        waveId: activeWave?.id,
        contacts: [],
      });
    toast("🚨 SOS 已上报 · 已通知紧急联系人/平台值班/警方通道", "success");
  };
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
              onSosClick: handleSos,
            }}
          />
        </div>
      )}
      {/* 问候行：紫徽章头像 + Hello + 铃铛 + OTO 胶囊 */}
      <div className="flex items-center gap-2.5 mb-1">
        <span className="rounded-full bg-[#8b5cf6] border-b-2 border-[#7c3aed] p-0.5 shrink-0 shadow-sm">
          <IdentityAvatar />
        </span>
        <p className="text-[15px] text-[#2d3748] font-black flex-1 truncate flex items-center gap-1.5">
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#58cc02] opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#58cc02]" />
          </span>
          <span className="truncate">Hello, {nickname}! 👋</span>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <NotificationCenter
            cartCount={cartCount}
            onOpenCart={onOpenCart}
            onSos={handleSos}
          />
          <OtoLogoCapsule />
        </div>
      </div>
    </>
  );
}
