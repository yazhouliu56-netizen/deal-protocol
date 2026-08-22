"use client";
import { useMemo, useState } from "react";
import { ClipboardList, Users } from "lucide-react";
import type { Wave } from "@/base/order/wave";
import { attendanceLedger } from "@/base/order/attendance";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";

/**
 * 组织者出勤档案（Meetup 吸收项 ④）：
 * 多人拼单局已成局后，发起人查看该局每位成员的跨局出勤历史
 * （到场履约 / no-show / 中途退出 / 候补）——宪法 #6 信任数据沉淀。
 */
export default function AttendancePanel({ wave }: { wave: Wave }) {
  const [open, setOpen] = useState(false);
  const claims = useWaveStore((s) => s.claims);
  const waves = useWaveStore((s) => s.waves);
  const responders = useWaveStore((s) => s.responders);
  const identity = useIdentityStore((s) => s.identity);

  const roster = useMemo(() => {
    // 本局参与过的人：已成局座位（accepted/breached）+ 让位退出者（withdrawn，
    // 出勤档案覆盖"曾在本局"的成员，让位记录同样可见）+ 候补中。
    const inWave = claims.filter(
      (c) =>
        c.waveId === wave.id &&
        (c.status === "accepted" ||
          c.status === "breached" ||
          c.status === "withdrawn")
    );
    const waitlistedIds = (wave.waitlist ?? []).map((r) => r.responderId);
    const ids = Array.from(
      new Set([
        ...inWave.map((c) => c.responderId),
        ...waitlistedIds,
      ])
    );
    return ids
      .map((rid) => {
        const entry = attendanceLedger(claims, waves, [rid])[rid];
        if (!entry) return null;
        const cap = responders.find((r) => r.id === rid);
        // 携伴登记（Meetup 吸收项 ⑤）：本局该座位的携伴数
        const guestCount = claims
          .filter((c) => c.waveId === wave.id && c.responderId === rid)
          .reduce((n, c) => n + (c.guests?.length ?? 0), 0);
        return {
          ...entry,
          guestCount,
          nickname:
            rid === identity.id
              ? identity.nickname
              : cap?.nickname ?? rid.slice(0, 6),
        };
      })
      .filter(Boolean) as Array<{ nickname: string; joinedWaves: number; shown: number; noShows: number; withdrawn: number; waitlisted: number; showRate: number; guestCount: number }>;
  }, [wave, claims, waves, responders, identity]);

  if (roster.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.04] transition-colors"
        aria-expanded={open}
        aria-label="出勤档案"
      >
        <span className="text-xs font-bold text-white/70 flex items-center gap-1.5">
          <ClipboardList size={11} className="text-brandPurple" />
          出勤档案（Meetup 组织者视图）
        </span>
        <span className="text-xs font-bold text-brandPurple">
          {roster.length} 人 {open ? "收起 ▴" : "展开 ▾"}
        </span>
      </button>
      {open && (
        <div className="border-t border-white/10 divide-y divide-white/[0.06]">
          {roster.map((r) => (
            <div key={r.nickname + r.joinedWaves} className="px-3 py-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brandPurple/20 border border-brandPurple/40 flex items-center justify-center text-xs shrink-0">
                <Users size={10} className="text-brandPurple" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white/85 truncate">
                  {r.nickname}
                </p>
                <p className="text-xs text-white/45">
                  参与 {r.joinedWaves} 局 · 出勤率{" "}
                  <span className={r.showRate >= 0.8 ? "text-emerald-300" : r.showRate >= 0.5 ? "text-amber-300" : "text-red-300"}>
                    {Math.round(r.showRate * 100)}%
                  </span>
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {r.noShows > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-400/15 border border-red-400/40 text-xs font-bold text-red-300">
                    鸽 {r.noShows}
                  </span>
                )}
                {r.withdrawn > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-xs font-bold text-white/60">
                    退 {r.withdrawn}
                  </span>
                )}
                {r.waitlisted > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-xs font-bold text-amber-300">
                    候补 {r.waitlisted}
                  </span>
                )}
                {r.guestCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-brandPurple/15 border border-brandPurple/40 text-xs font-bold text-brandPurple">
                    +1 ×{r.guestCount}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
