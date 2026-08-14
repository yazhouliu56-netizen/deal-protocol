"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addWindow, removeWindow, type QuietPref } from "@/base/platform/quietHours";

/**
 * 免打扰偏好 store（ADR-0016）— 用户自主静音窗口，不绑付费。
 * 纯状态 + 复用 quietHours 纯函数（addWindow/removeWindow）。
 */

interface QuietPrefState {
  pref: QuietPref;
  setEnabled: (enabled: boolean) => void;
  /** 追加一个静音窗口（合并相邻/重叠；全周覆盖 → 自动 disabled）。 */
  toggleWindow: (start: number, end: number) => void;
  reset: () => void;
}

const DEFAULT_PREF: QuietPref = { enabled: false, windows: [] };

export const useQuietPrefStore = create<QuietPrefState>()(
  persist(
    (set) => ({
      pref: DEFAULT_PREF,
      setEnabled: (enabled) => set((s) => ({ pref: { ...s.pref, enabled } })),
      toggleWindow: (start, end) =>
        set((s) => {
          // 已在窗口内 → 移除；否则追加。
          const inside = s.pref.windows.some(
            (w) => w.start <= start && w.end >= end
          );
          return {
            pref: inside
              ? removeWindow(s.pref, { start, end })
              : addWindow(s.pref, { start, end }),
          };
        }),
      reset: () => set({ pref: DEFAULT_PREF }),
    }),
    { name: "oto-quiet-pref" }
  )
);
