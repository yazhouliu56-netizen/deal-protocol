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
    <div className="bg-[#ddf4ff] rounded-3xl border-2 border-[#1cb0f6] border-b-[6px] shadow-sm p-3.5">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "总订单", value: bookingsCount },
          { label: "待出行", value: upcoming },
          { label: "已评价", value: reviewed },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl bg-white border-2 border-[#e5e5e5] py-2.5 flex flex-col items-center gap-0.5 shadow-sm"
          >
            <span className="text-lg font-extrabold text-[#1cb0f6]">
              {s.value}
            </span>
            <span className="text-xs text-[#4b4b4b] font-bold">{s.label}</span>
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
