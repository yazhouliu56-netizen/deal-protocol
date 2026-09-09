"use client";
import WalletView from "@/components/waves/WalletView";

interface WalletStatsCardProps {
  bookingsCount: number;
  upcoming: number;
  reviewed: number;
}

/** 资产钱包卡：总订单 / 待出行 / 已评价 统计 + 点账钱包（子组件化搬移，DOM 零漂移）。 */
export default function WalletStatsCard({
  bookingsCount,
  upcoming,
  reviewed,
}: WalletStatsCardProps) {
  return (
    <div className="bg-[var(--color-duo-blue-mist)] rounded-3xl border-2 border-[var(--color-duo-blue)] border-b-[6px] p-3.5">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "总订单", value: bookingsCount },
          { label: "待出行", value: upcoming },
          { label: "已评价", value: reviewed },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl bg-white border-2 border-[var(--color-duo-swan)] py-2.5 flex flex-col items-center gap-0.5"
          >
            <span className="text-lg font-extrabold text-[var(--color-duo-blue)]">
              {s.value}
            </span>
            <span className="text-xs text-[var(--color-duo-eel)] font-bold">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3">
        {/* P1 沙盒显式化：钱包恒为本地仿真，徽章由 WalletView 统一挂载。 */}
        <WalletView />
      </div>
    </div>
  );
}
