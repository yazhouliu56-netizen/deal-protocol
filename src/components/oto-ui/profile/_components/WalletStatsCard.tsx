"use client";
import WalletView from "@/components/waves/WalletView";

interface WalletStatsCardProps {
  bookingsCount: number;
  upcoming: number;
  reviewed: number;
  /** 访客态钱包显式标注沙盒模拟余额（P1 第 3 步）。 */
  sandbox: boolean;
}

/** 资产钱包卡：总订单 / 待出行 / 已评价 统计 + 点账钱包（子组件化搬移，DOM 零漂移）。 */
export default function WalletStatsCard({
  bookingsCount,
  upcoming,
  reviewed,
  sandbox,
}: WalletStatsCardProps) {
  return (
    <div className="glass-panel rounded-3xl p-3.5">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "总订单", value: bookingsCount },
          { label: "待出行", value: upcoming },
          { label: "已评价", value: reviewed },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl bg-white/[0.04] border border-white/10 py-2.5 flex flex-col items-center gap-0.5"
          >
            <span className="text-lg font-extrabold bg-clip-text text-transparent bg-linear-to-r from-brandCyan to-brandPurple">
              {s.value}
            </span>
            <span className="text-xs text-white/68">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3">
        {/* P1 第 3 步：访客态钱包显式标注沙盒模拟余额 */}
        <WalletView sandbox={sandbox} />
      </div>
    </div>
  );
}
