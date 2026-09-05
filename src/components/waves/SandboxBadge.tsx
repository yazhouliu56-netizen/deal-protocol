/**
 * 本地仿真沙盒徽章（Phase 2.1 双轨收敛）。
 * 挂载方均为 Zustand 内存链组件：不连通真实支付/结算/账本，
 * 刷新即丢。显式挂标，杜绝与真实服务者账本混淆。
 */
export function SandboxBadge({ label = "本地仿真沙盒" }: { label?: string }) {
  return (
    <span
      data-testid="sandbox-badge"
      title="本地内存仿真，不产生真实资金与订单"
      className="inline-flex items-center rounded-full border border-dashed border-amber-500/60 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400"
    >
      · 沙盒{label === "本地仿真沙盒" ? "" : ` · ${label}`}
    </span>
  );
}
