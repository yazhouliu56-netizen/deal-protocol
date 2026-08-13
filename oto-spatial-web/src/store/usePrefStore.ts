"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { cyclePref, DEFAULT_PREFS, type PrefKey, type Prefs } from "@/ammo/prefs";

type PrefState = {
  prefs: Prefs;
  /** 点击偏好标签 → 循环切到下一档。 */
  cycle: (key: PrefKey) => void;
  /** 还原默认偏好。 */
  resetPrefs: () => void;
};

export const usePrefStore = create<PrefState>()(
  persist(
    (set, get) => ({
      prefs: DEFAULT_PREFS,
      cycle: (key) => set({ prefs: cyclePref(get().prefs, key) }),
      resetPrefs: () => set({ prefs: DEFAULT_PREFS }),
    }),
    { name: "oto-prefs-v1" }
  )
);