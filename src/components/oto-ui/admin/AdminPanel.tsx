"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Gavel, ShieldCheck, X, Flag, TrendingUp, Database } from "lucide-react";
import { useWaveStore } from "@/store/useWaveStore";
import { useRoamStore, roamParams } from "@/store/useRoamStore";
import { riskOf } from "@/base/risk/roamGuard";
import { ACTION_LABEL, governanceMetrics, type ModerationAction } from "@/base/risk/moderation";
import { lakeVerify } from "@/base/platform/resilience";
import SentinelDashboard from "./SentinelDashboard";

/**
 * 平台治理后台 — moderation desk (trust & safety dashboard).
 * Automation handles volume (sensitive-word auto-flag), humans judge:
 * progressive penalties warn → remove → suspend → ban, all audited.
 */
export default function AdminPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const waves = useWaveStore((s) => s.waves);
  const claims = useWaveStore((s) => s.claims);
  const reports = useWaveStore((s) => s.reports);
  const resolveReport = useWaveStore((s) => s.resolveReport);
  const lake = useWaveStore((s) => s.lake);
  const deviceId = useRoamStore((s) => s.deviceId);
  const bindings = useRoamStore((s) => s.bindings);
  const roamEvents = useRoamStore((s) => s.events);
  const [pending, setPending] = useState<Record<string, ModerationAction>>({});
  const [pendingNote, setPendingNote] = useState<Record<string, string>>({});
  /** 数据湖存证链校验（ADR-0014 N14 接线展示）。 */
  const lakeCheck = useMemo(() => lakeVerify(lake), [lake]);

  if (!open) return null;

  const m = governanceMetrics(waves, claims, reports);
  const openQueue = reports
    .filter((r) => r.status === "open")
    .sort((a, b) => b.at - a.at);
  const resolvedList = reports
    .filter((r) => r.status === "resolved")
    .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0))
    .slice(0, 10);

  const act = (reportId: string) => {
    const action = pending[reportId] ?? "dismiss";
    const note = pendingNote[reportId] ?? "";
    resolveReport(reportId, action, note, "admin-1");
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed z-50 inset-4 top-[8%] rounded-3xl bg-white border border-[#e5e5e5] shadow-sm overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e5e5]">
          <span className="flex items-center gap-2 text-[13px] font-extrabold text-[#4b4b4b]">
            <Gavel size={15} className="text-[#58cc02]" /> 平台治理后台
          </span>
          <button
            onClick={onClose}
            aria-label="关闭治理后台"
            className="p-1.5 rounded-lg text-[#afafaf] hover:text-[#4b4b4b]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 平台健康指标 */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { k: "需求", v: m.totalWaves },
              { k: "成交", v: m.fulfilled },
              { k: "成交率", v: `${m.dealRate}%` },
              { k: "违约", v: m.breached },
              { k: "待处理举报", v: m.openReports },
              { k: "自动拦截", v: m.autoReports },
            ].map((it) => (
              <div
                key={it.k}
                className="rounded-2xl bg-[#f7f7f7] border border-[#e5e5e5] p-2.5"
              >
                <p className="text-xs text-[#afafaf]">{it.k}</p>
                <p className="text-[15px] font-extrabold text-[#4b4b4b] mt-0.5 flex items-center gap-1">
                  {it.k.includes("举报") || it.k.includes("拦截") ? (
                    <Flag size={11} className="text-[#e5b400]" />
                  ) : (
                    <TrendingUp size={11} className="text-[#58cc02]" />
                  )}
                  {it.v}
                </p>
              </div>
            ))}
          </div>

          {/* 举报队列 */}
          <div>
            <h3 className="text-xs font-extrabold text-[#4b4b4b] mb-2 flex items-center gap-1.5">
              <Flag size={11} className="text-[#e5b400]" /> 举报队列（
              {openQueue.length}）
            </h3>
            {openQueue.length === 0 && (
              <p className="text-xs text-[#afafaf] px-2 py-4 text-center">
                无待处理举报
              </p>
            )}
            <div className="space-y-2">
              {openQueue.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl bg-[#f7f7f7] border border-[#e5e5e5] p-2.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#4b4b4b] flex items-center gap-1.5">
                      {r.targetType} #{r.targetId.slice(-6)}
                      {r.auto && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#ff4b4b]/10 border-2 border-[#ff4b4b]/40 text-[#ea2b2b]">
                          ⚡ 敏感词自动
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-[#afafaf]">
                      {new Date(r.at).toLocaleTimeString("zh-CN")}
                    </span>
                  </div>
                  <p className="text-xs text-[#777777] line-clamp-2">
                    [{r.reason}] {r.detail}
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {(Object.keys(ACTION_LABEL) as ModerationAction[]).map(
                      (a) => (
                        <button
                          key={a}
                          onClick={() =>
                            setPending((p) => ({ ...p, [r.id]: a }))
                          }
                          className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                            (pending[r.id] ?? "dismiss") === a
                              ? "bg-[#58cc02]/15 border-[#58cc02]/50 text-[#58a700]"
                              : "bg-[#f7f7f7] border-[#e5e5e5] text-[#777777]"
                          }`}
                        >
                          {ACTION_LABEL[a]}
                        </button>
                      )
                    )}
                    <input
                      value={pendingNote[r.id] ?? ""}
                      onChange={(e) =>
                        setPendingNote((n) => ({
                          ...n,
                          [r.id]: e.target.value,
                        }))
                      }
                      placeholder="裁定备注（可选）"
                      aria-label={`裁定备注 ${r.id}`}
                      className="min-w-[90px] flex-1 rounded-lg bg-white border-2 border-[#e5e5e5] px-2 py-1 text-xs outline-none focus:border-[#58cc02]"
                    />
                    <button
                      onClick={() => act(r.id)}
                      aria-label={`执行裁定 ${r.id}`}
                      className="px-3 py-1 rounded-lg bg-[#58cc02]/15 border border-[#58cc02]/50 text-xs font-bold text-[#58a700]"
                    >
                      执行裁定
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 漫游风控监控（P8） */}
          <div>
            <h3 className="text-xs font-extrabold text-[#4b4b4b] mb-2 flex items-center gap-1.5">
              <ShieldCheck size={11} className="text-[#1cb0f6]" /> 漫游安全监控
            </h3>
            {(() => { const r = riskOf(bindings, deviceId, roamParams()); const cls = r.risk === "high" ? "text-[#ff4b4b]" : r.risk === "watch" ? "text-[#ff9600]" : "text-[#58a700]"; return (
            <p className={`text-xs font-bold mb-2 ${cls}`}>
              本设备 {deviceId ?? "…"} · 同设备 {r.count} 个身份 · {r.reason}
            </p>
            ); })()}
            {roamEvents.length === 0 ? (
              <p className="text-xs text-[#afafaf] px-2 py-4 text-center">
                暂无漫游事件
              </p>
            ) : (
              <div className="space-y-1">
                {roamEvents.slice(0, 8).map((e, i) => (
                  <div
                    key={`${e.at}-${i}`}
                    className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-lg bg-[#f7f7f7] border border-[#e5e5e5]"
                  >
                    <span className="text-[#777777] truncate">
                      {e.kind === "alert" ? "⚠ " : ""}
                      {e.note}
                    </span>
                    <span className="text-[#afafaf] shrink-0">
                      {new Date(e.at).toLocaleTimeString("zh-CN")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 反欺诈探针仪表盘（ADR-0009） */}
          <SentinelDashboard />

          {/* 数据湖存证（ADR-0014 N14 接线）：哈希链校验 + 最近事件 */}
          <div>
            <h3 className="text-xs font-extrabold text-[#4b4b4b] mb-2 flex items-center gap-1.5">
              <Database size={11} className="text-[#1cb0f6]" /> 数据湖存证（
              {lake.length} 条 ·{" "}
              <span
                className={
                  lakeCheck.ok
                    ? "text-[#58cc02]"
                    : lake.length > 0
                      ? "text-[#ea2b2b]"
                      : "text-[#afafaf]"
                }
              >
                {lake.length === 0
                  ? "空链"
                  : lakeCheck.ok
                    ? "链校验通过 ✓"
                    : `链断裂 @${lakeCheck.brokenAt} ✗`}
              </span>
              ）
            </h3>
            {lake.length === 0 && (
              <p className="text-xs text-[#afafaf] px-2 py-4 text-center">
                尚无存证事件（验收/争议终局会写入哈希链）
              </p>
            )}
            <div className="space-y-1">
              {lake.slice(-6).reverse().map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 rounded-xl bg-[#f7f7f7] border border-[#e5e5e5] px-2.5 py-1.5 text-xs"
                >
                  <span className="font-bold text-[#0a6ea8] shrink-0">
                    {r.kind}
                  </span>
                  <span className="text-[#afafaf] font-mono truncate">{r.hash}</span>
                  <span className="ml-auto text-[#afafaf] shrink-0">
                    {new Date(r.at).toLocaleTimeString("zh-CN")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 审计记录 */}
          <div>
            <h3 className="text-xs font-extrabold text-[#4b4b4b] mb-2 flex items-center gap-1.5">
              <ShieldCheck size={11} className="text-[#58cc02]" /> 裁定记录（审计）
            </h3>
            {resolvedList.length === 0 && (
              <p className="text-xs text-[#afafaf] px-2 py-4 text-center">
                暂无裁定记录
              </p>
            )}
            <div className="space-y-1">
              {resolvedList.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-lg bg-[#f7f7f7] border border-[#e5e5e5]"
                >
                  <span className="text-[#777777]">
                    #{r.targetId.slice(-6)} · {ACTION_LABEL[r.action ?? "dismiss"]}
                    {r.verdictNote ? ` · ${r.verdictNote}` : ""}
                  </span>
                  <span className="text-[#afafaf] shrink-0">
                    {r.resolvedBy} {new Date(r.resolvedAt ?? 0).toLocaleTimeString("zh-CN")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
