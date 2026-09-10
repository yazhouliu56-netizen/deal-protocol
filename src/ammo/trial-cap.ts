/**
 * 试运行品类限流（P4-T3 上架）：新品类首周 10 单/天。
 * 纯函数（可单测）：计数器 {day, count}，跨天归零；undefined 计数器视为官方弹药（不限）。
 */
export const TRIAL_DAILY_CAP = 10;

export interface TrialCounter {
  day: string;
  count: number;
}

/** YYYY-MM-DD（本地时区即可，日切口径前后一致）。 */
export function todayStamp(now = Date.now()): string {
  const d = new Date(now);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function canTrialOrder(counter: TrialCounter | undefined, today = todayStamp()): boolean {
  if (!counter) return true;
  if (counter.day !== today) return true;
  return counter.count < TRIAL_DAILY_CAP;
}

export function nextTrialCount(
  counter: TrialCounter | undefined,
  today = todayStamp(),
): TrialCounter {
  if (!counter || counter.day !== today) return { day: today, count: 1 };
  return { day: today, count: counter.count + 1 };
}
