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
    <div className="rounded-2xl bg-white border-2 border-[#e5e5e5] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#f7f7f7] transition-colors"
        aria-expanded={open}
        aria-label="出勤档案"
      >
        <span className="text-xs font-bold text-[#777777] flex items-center gap-1.5">
          <ClipboardList size={11} className="text-[#0a6ea8]" />
          出勤档案（Meetup 组织者视图）
        </span>
        <span className="text-xs font-bold text-[#0a6ea8]">
          {roster.length} 人 {open ? "收起 ▴" : "展开 ▾"}
        </span>
      </button>
      {open && (
        <div className="border-t-2 border-[#e5e5e5] divide-y divide-[#f7f7f7]">
          {roster.map((r) => (
            <div key={r.nickname + r.joinedWaves} className="px-3 py-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#f7f7f7] border-2 border-[#e5e5e5] flex items-center justify-center text-xs shrink-0">
                <Users size={10} className="text-[#0a6ea8]" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#4b4b4b] truncate">
                  {r.nickname}
                </p>
                <p className="text-xs text-[#777777]">
                  参与 {r.joinedWaves} 局 · 出勤率{" "}
                  <span className={r.showRate >= 0.8 ? "text-[#357a00]" : r.showRate >= 0.5 ? "text-[#8a6d00]" : "text-[#ea2b2b]"}>
                    {Math.round(r.showRate * 100)}%
                  </span>
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {r.noShows > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#ff4b4b]/10 border-2 border-[#ff4b4b]/40 text-xs font-bold text-[#ea2b2b]">
                    鸽 {r.noShows}
                  </span>
                )}
                {r.withdrawn > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#f7f7f7] border-2 border-[#e5e5e5] text-xs font-bold text-[#777777]">
                    退 {r.withdrawn}
                  </span>
                )}
                {r.waitlisted > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#ffc800]/10 border-2 border-[#e5b400]/50 text-xs font-bold text-[#8a6d00]">
                    候补 {r.waitlisted}
                  </span>
                )}
                {r.guestCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#1cb0f6]/10 border-2 border-[#1cb0f6]/40 text-xs font-bold text-[#0a6ea8]">
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
