"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  renewSubscription,
  type OrganizerSubscription,
} from "@/lib/organizerSubscription";

type OrganizerSubState = {
  sub: OrganizerSubscription;
  /** 模拟收银台支付成功的回调 —— 启动或续费订阅。 */
  activate: () => void;
};

export const useOrganizerSubStore = create<OrganizerSubState>()(
  persist(
    (set) => ({
      sub: { status: "none" },
      activate: () =>
        set((s) => ({ sub: renewSubscription(s.sub, new Date()) })),
    }),
    { name: "oto-organizer-sub" }
  )
);