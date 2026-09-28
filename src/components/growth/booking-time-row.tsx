"use client";

/**
 * 预约时间行（R-0928-12 Batch5 · 增长三页共享）：
 * [现在就要 | 选时间] → 日期＋开始时刻＋时长 → ISO 时段回调用方，
 * 后者直透 POST /api/demands（timeslotStart/End，未来即 BOOKED）。
 * 爽约规则行读 CANCELLATION_BOOKED_NOSHOW_STANDARD（表驱动，下单即告知）。
 */
import { useState } from "react";
import { CANCELLATION_BOOKED_NOSHOW_STANDARD } from "@/ammo/baseline";

export interface BookingSlot {
  startISO: string;
  endISO: string;
}

const DURATIONS = [
  { label: "1 小时", hours: 1 },
  { label: "2 小时", hours: 2 },
  { label: "半天·4 小时", hours: 4 },
];

const START_TIMES = ["09:00", "14:00", "19:00"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 本地墙钟展示（24h 制＋区间）："09-29 14:00–16:00（2 小时）"。ISO 切片是 UTC，会错 8 小时。 */
export function formatSlotRange(startISO: string, endISO: string): string {
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) return "";
  const hours = Math.round((e.getTime() - s.getTime()) / 3_600_000);
  return `${pad(s.getMonth() + 1)}-${pad(s.getDate())} ${pad(s.getHours())}:${pad(s.getMinutes())}–${pad(e.getHours())}:${pad(e.getMinutes())}（${hours} 小时）`;
}

export function bookingRuleLine(): string {
  const provider = CANCELLATION_BOOKED_NOSHOW_STANDARD.find(
    (t) => t.stage === "BOOKED_NOSHOW_PROVIDER",
  );
  const demander = CANCELLATION_BOOKED_NOSHOW_STANDARD.find(
    (t) => t.stage === "BOOKED_NOSHOW_DEMANDER",
  );
  const comp = demander?.providerCompensationYuan ?? 30;
  const fullRefund = provider?.demanderRefundRatio === 1;
  return `爽约规则：你爽约赔车马费¥${comp} · 师傅爽约${fullRefund ? "全额退＋扣保证金" : "按规则赔付"}`;
}

export default function BookingTimeRow({
  value,
  onChange,
}: {
  value: BookingSlot | null;
  onChange: (slot: BookingSlot | null) => void;
}) {
  const today = toLocalDate(new Date());
  const [date, setDate] = useState(today);
  const [start, setStart] = useState(START_TIMES[0]);
  const [hours, setHours] = useState(2);
  const booked = value != null;

  const pick = (d: string, s: string, h: number) => {
    setDate(d);
    setStart(s);
    setHours(h);
    const startMs = Date.parse(`${d}T${s}:00`);
    if (!Number.isFinite(startMs)) return;
    onChange({ startISO: new Date(startMs).toISOString(), endISO: new Date(startMs + h * 3_600_000).toISOString() });
  };

  return (
    <div data-testid="booking-time-row">
      <div className="flex gap-1.5">
        <button
          type="button"
          data-testid="booking-now"
          aria-pressed={!booked}
          onClick={() => onChange(null)}
          className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all border-2 ${
            !booked
              ? "bg-indigo-600 border-indigo-700 text-white"
              : "bg-white border-slate-200 text-slate-500"
          }`}
        >
          现在就要
        </button>
        <button
          type="button"
          data-testid="booking-pick"
          aria-pressed={booked}
          onClick={() => pick(date, start, hours)}
          className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all border-2 ${
            booked
              ? "bg-indigo-600 border-indigo-700 text-white"
              : "bg-white border-slate-200 text-slate-500"
          }`}
        >
          📅 预约时间
        </button>
      </div>
      {booked && (
        <div className="mt-2 rounded-xl bg-indigo-50 p-3 text-xs text-indigo-900" data-testid="booking-detail">
          <div className="flex flex-wrap gap-1.5">
            <input
              type="date"
              aria-label="预约日期"
              min={today}
              value={date}
              onChange={(e) => pick(e.target.value || today, start, hours)}
              className="rounded-lg border border-indigo-200 bg-white px-2 py-1.5"
            />
            <div className="flex gap-1">
              {START_TIMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-label={`开始 ${t}`}
                  onClick={() => pick(date, t, hours)}
                  className={`rounded-lg px-2 py-1.5 font-bold border ${
                    start === t ? "bg-indigo-600 text-white border-indigo-700" : "bg-white border-indigo-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {DURATIONS.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  aria-label={`时长${d.label}`}
                  onClick={() => pick(date, start, d.hours)}
                  className={`rounded-lg px-2 py-1.5 font-bold border ${
                    hours === d.hours ? "bg-indigo-600 text-white border-indigo-700" : "bg-white border-indigo-200"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 font-semibold">
            已约 {formatSlotRange(value.startISO, value.endISO)}
          </p>
          <p className="mt-1 opacity-80">{bookingRuleLine()}</p>
        </div>
      )}
    </div>
  );
}
