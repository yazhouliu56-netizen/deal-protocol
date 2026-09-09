"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Smartphone, Shuffle } from "lucide-react";
import DuoButton from "@/components/ui/DuoButton";
import { useRoamStore, roamParams } from "@/store/useRoamStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { riskOf, type RiskLevel } from "@/base/risk/roamGuard";

const BADGE: Record<RiskLevel, { label: string; cls: string }> = {
  safe: { label: "安全", cls: "bg-[var(--color-duo-green)]/10 text-[#357a00] border-[var(--color-duo-green)]/40" },
  watch: { label: "关注", cls: "bg-[var(--color-duo-yellow)]/10 text-[#8a6d00] border-[var(--color-duo-yellow-dark)]/50" },
  high: { label: "风险", cls: "bg-[var(--color-duo-red)]/10 text-[var(--color-duo-red-dark)] border-[var(--color-duo-red)]/40" },
};

/**
 * 漫游 · 多开风控（P8 商业化前哨，纯本地演示）：
 * 设备指纹绑定矩阵 → 同设备身份数分级（1 安全 / 2 家庭共机关注 / ≥3 冻结建议）。
 * 演示按钮：模拟新设备漫游（合法换机）/ 模拟同设备多开（触发风控升级）。
 */
export default function RoamGuardPanel() {
  const identityId = useIdentityStore((s) => s.identity.id);
  const deviceId = useRoamStore((s) => s.deviceId);
  const bindings = useRoamStore((s) => s.bindings);
  const events = useRoamStore((s) => s.events);
  const ensureBinding = useRoamStore((s) => s.ensureBinding);
  const roamDemo = useRoamStore((s) => s.roamDemo);
  const simulateMultiOpen = useRoamStore((s) => s.simulateMultiOpen);
  const resetDemo = useRoamStore((s) => s.resetDemo);

  // SSR/首帧同构：挂载后才按真实设备登记（避免 hydr空 label 变化）。
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  useEffect(() => {
    if (mounted) ensureBinding(identityId);
  }, [mounted, identityId, ensureBinding]);

  const risk = useMemo(() => riskOf(bindings, deviceId, roamParams()), [bindings, deviceId]);
  const badge = BADGE[risk.risk];

  return (
    <div className="mt-3 rounded-2xl border-2 border-[var(--color-duo-swan)] bg-[var(--color-duo-polar)] p-3">
      <div className="flex items-center gap-2 mb-2">
        <Smartphone size={12} className="text-[var(--color-duo-blue)]" />
        <span className="text-xs font-semibold text-[var(--color-duo-wolf)]">
          漫游 · 多开风控
        </span>
        <span
          className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full border-2 ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>

      <p className="text-xs text-[var(--color-duo-wolf)] break-all mb-2">
        本设备 {mounted ? deviceId : "…"} · 同设备 {risk.count} 个身份 · {risk.reason}
        {risk.risk === "high" && (
          <span className="block mt-0.5 text-[var(--color-duo-red-dark)] font-bold">
            高危已生效：发布需求将被拦截（到 PublishSheet 验证）
          </span>
        )}
      </p>

      <div className="flex gap-1.5">
        <DuoButton variant="secondary" size="sm" sound="click" onClick={() => roamDemo(identityId)} className="flex-1">
          模拟新设备漫游
        </DuoButton>
        <DuoButton variant="warning" size="sm" sound="click" onClick={() => simulateMultiOpen(identityId)} className="flex-1">
          模拟同设备多开 +1
        </DuoButton>
        <DuoButton variant="outline" size="sm" sound="click" onClick={() => resetDemo(identityId)} aria-label="重置多开风控演示" className="shrink-0">
          <Shuffle size={13} />
        </DuoButton>
      </div>

      {events.length > 0 && (
        <div className="mt-2 space-y-1">
          {events.slice(0, 3).map((e, i) => (
            <p
              key={`${e.at}-${i}`}
              className="text-xs text-[var(--color-duo-hare)] truncate"
            >
              {e.kind === "alert" ? "⚠ " : "· "}
              {e.note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}