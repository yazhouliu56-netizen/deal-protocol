import type { TimeslotSlot } from "./types";

/** Next Saturday (strictly after today), and the Sunday after it. */
export function thisWeekend(): { sat: Date; sun: Date } {
  const now = new Date();
  let diff = (6 - now.getDay() + 7) % 7; // 0 = today is Saturday
  if (diff === 0) diff = 7; // never book "today" — jump to next week
  const sat = new Date(now);
  sat.setDate(now.getDate() + diff);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  return { sat, sun };
}

const fmt = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;

/** Prepend real weekend dates ("8月9日 周六 14:00") to static slot labels. */
export function decorateWeekendLabels(slots: TimeslotSlot[]): TimeslotSlot[] {
  const { sat, sun } = thisWeekend();
  return slots.map((s) => {
    if (s.label.startsWith("周六")) return { ...s, label: `${fmt(sat)} ${s.label}` };
    if (s.label.startsWith("周日")) return { ...s, label: `${fmt(sun)} ${s.label}` };
    return s;
  });
}
