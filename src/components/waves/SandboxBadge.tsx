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
      className="inline-flex items-center rounded-full border-2 border-dashed border-[var(--color-duo-yellow-dark)]/60 bg-[var(--color-duo-yellow)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--color-duo-yellow-ink)]"
    >
      · 沙盒{label === "本地仿真沙盒" ? "" : ` · ${label}`}
    </span>
  );
}
