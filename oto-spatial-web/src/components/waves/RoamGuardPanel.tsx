"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Smartphone, Shuffle } from "lucide-react";
import { useRoamStore } from "@/store/useRoamStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { riskOf, type RiskLevel } from "@/lib/roamGuard";

const BADGE: Record<RiskLevel, { label: string; cls: string }> = {
  safe: { label: "安全", cls: "bg-emerald-400/15 text-emerald-300 border-emerald-400/40" },
  watch: { label: "关注", cls: "bg-amber-400/15 text-amber-300 border-amber-400/40" },
  high: { label: "风险", cls: "bg-red-400/15 text-red-300 border-red-400/40" },
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

  const risk = useMemo(() => riskOf(bindings, deviceId), [bindings, deviceId]);
  const badge = BADGE[risk.risk];

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center gap-2 mb-2">
        <Smartphone size={12} className="text-brandCyan" />
        <span className="text-[10px] font-semibold text-white/50">
          漫游 · 多开风控
        </span>
        <span
          className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>

      <p className="text-[9.5px] text-white/40 break-all mb-2">
        本设备 {mounted ? deviceId : "…"} · 同设备 {risk.count} 个身份 · {risk.reason}
        {risk.risk === "high" && (
          <span className="block mt-0.5 text-red-300/90 font-bold">
            高危已生效：发布需求将被拦截（到 PublishSheet 验证）
          </span>
        )}
      </p>

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => roamDemo(identityId)}
          className="flex-1 py-2 rounded-xl bg-brandCyan/15 border border-brandCyan/40 text-brandCyan text-[10px] font-bold hover:bg-brandCyan/25 transition-colors"
        >
          模拟新设备漫游
        </button>
        <button
          type="button"
          onClick={() => simulateMultiOpen(identityId)}
          className="flex-1 py-2 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[10px] font-bold hover:bg-amber-400/25 transition-colors"
        >
          模拟同设备多开 +1
        </button>
        <button
          type="button"
          onClick={() => resetDemo(identityId)}
aria-label="重置多开风控演示"
          className="px-2.5 py-2 rounded-xl bg-white/5 border border-white/15 text-white/50 hover:bg-white/10 transition-colors"
        >
          <Shuffle size={13} />
        </button>
      </div>

      {events.length > 0 && (
        <div className="mt-2 space-y-1">
          {events.slice(0, 3).map((e, i) => (
            <p
              key={`${e.at}-${i}`}
              className="text-[8.5px] text-white/35 truncate"
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