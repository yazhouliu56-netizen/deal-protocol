"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { applyBooking, applyCancel } from "@/lib/booking";
import type { DockPage } from "@/components/ui/FloatingDock";
import type { ChatMessage, GenCard } from "@/lib/chat/types";
import { otoExperiences, type OTOCategory, type OTOExperience } from "@/lib/mockData";

export const DEFAULT_SWATCH = "#7B61FF";

export interface Booking {
  id: string;
  category: string;
  title: string;
  time: string;
  providerName: string;
  price: string;
  status: "upcoming" | "completed" | "cancelled";
  createdAt: number;
}

export interface Review {
  bookingId: string;
  rating: number;
  comment: string;
  createdAt: number;
}

export type WorkerOrderStatus = "pending" | "active" | "completed";

export interface WorkerOrder {
  id: string;
  service: string;
  icon: string;
  client: string;
  time: string;
  price: string;
  status: WorkerOrderStatus;
  createdAt: number;
  /** Which bench identity this order belongs to ("kail" = 阿凯, "wang" = 王姐). */
  providerId?: string;
}

/** Worker bench identities (multi-provider demo). */
export const WORKER_PROFILES = [
  {
    id: "kail",
    name: "阿凯 · 球局组局师",
    emoji: "😎",
    desc: "羽毛球约局 · 已接单 34 场",
    rating: "4.9",
  },
  {
    id: "wang",
    name: "王姐 · 金牌保洁师",
    emoji: "🧹",
    desc: "家政保洁 · 已服务 210 户",
    rating: "4.8",
  },
] as const;

/** Seed orders the worker bench starts with (local demo). */
export const WORKER_SEED_ORDERS: WorkerOrder[] = [
  {
    id: "wo1",
    service: "羽毛球 4 人双打",
    icon: "🏸",
    client: "莉莉",
    time: "周六 19:00",
    price: "¥80",
    status: "pending",
    createdAt: Date.now() - 36e5,
    providerId: "kail",
  },
  {
    id: "wo2",
    service: "日系写真 · 滨江",
    icon: "📷",
    client: "小北",
    time: "周日 15:30",
    price: "¥499",
    status: "pending",
    createdAt: Date.now() - 2 * 36e5,
    providerId: "kail",
  },
  {
    id: "wo3",
    service: "深度保洁 · 180㎡",
    icon: "🧹",
    client: "王阿姨",
    time: "明天 09:00",
    price: "¥180",
    status: "active",
    createdAt: Date.now() - 26 * 36e5,
    providerId: "wang",
  },
];

interface AppState {
  // 3D screen routing
  screen: DockPage;
  // Home page state
  activeCategory: OTOCategory | null;
  // AR page state
  activeSwatch: string;
  selectedExperience: OTOExperience;
  showInfo: boolean;
  /** Incremented by the AR "360" reset button; FurnitureScene resets rotation on change. */
  viewResetSignal: number;
  // Cart / wishlist (future backend sync)
  cart: string[];
  // AI assistant conversation (survives screen switches)
  chatMessages: ChatMessage[];
  // Local booking closure (persisted to localStorage)
  bookings: Booking[];
  reviews: Review[];
  selectedBookingId: string | null;
  /** Prefilled draft that auto-sends when the AI screen opens (Home hot cards). */
  aiDraft: string | null;
  // Provider (worker) bench state
  workerOrders: WorkerOrder[];
  workerOnline: boolean;

  setScreen: (screen: DockPage) => void;
  openExperience: (experience: OTOExperience) => void;
  setActiveCategory: (category: OTOCategory | null) => void;
  setActiveSwatch: (color: string) => void;
  toggleShowInfo: () => void;
  resetView: () => void;
  toggleCart: (id: string) => void;
  clearCart: () => void;
  addChatMessage: (message: ChatMessage) => void;
  updateChatMessage: (id: string, content: string) => void;
  updateChatCards: (id: string, cards: GenCard[]) => void;
  clearChat: () => void;
  addBooking: (booking: Booking) => void;
  addReview: (review: Review) => void;
  updateBookingStatus: (id: string, status: Booking["status"]) => void;
  cancelBooking: (id: string) => void;
  setSelectedBooking: (id: string | null) => void;
  setAiDraft: (draft: string | null) => void;
  setWorkerOnline: (online: boolean) => void;
  acceptWorkerOrder: (id: string) => void;
  completeWorkerOrder: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      screen: "home",
      activeCategory: null,
      activeSwatch: DEFAULT_SWATCH,
      selectedExperience: otoExperiences[0],
      showInfo: false,
      viewResetSignal: 0,
      cart: [],
      chatMessages: [
        {
          id: "greeting",
          role: "assistant",
          content:
            "你好呀，我是 AI 撮合助手 ✨ 本地线下面基服务都能帮你安排——羽毛球约局、约拍、保洁……想做什么，直接说～",
        },
      ],
      bookings: [],
      reviews: [],
      selectedBookingId: null,
      aiDraft: null,
      workerOrders: WORKER_SEED_ORDERS,
      workerOnline: true,

      setScreen: (screen) => set({ screen }),
      openExperience: (experience) =>
        set({ selectedExperience: experience, screen: "ar" }),
      setActiveCategory: (activeCategory) => set({ activeCategory }),
      setActiveSwatch: (activeSwatch) => set({ activeSwatch }),
      toggleShowInfo: () => set((s) => ({ showInfo: !s.showInfo })),
      resetView: () => set((s) => ({ viewResetSignal: s.viewResetSignal + 1 })),
      toggleCart: (id) =>
        set((s) => ({
          cart: s.cart.includes(id)
            ? s.cart.filter((x) => x !== id)
            : [...s.cart, id],
        })),
      clearCart: () => set({ cart: [] }),
      addChatMessage: (message) =>
        set((s) => ({ chatMessages: [...s.chatMessages, message] })),
      updateChatMessage: (id, content) =>
        set((s) => ({
          chatMessages: s.chatMessages.map((m) =>
            m.id === id ? { ...m, content } : m
          ),
        })),
      updateChatCards: (id, cards) =>
        set((s) => ({
          chatMessages: s.chatMessages.map((m) =>
            m.id === id ? { ...m, cards } : m
          ),
        })),
clearChat: () =>
        set({
          chatMessages: [
            {
              id: "greeting",
              role: "assistant",
              content:
                "你好呀，我是 AI 撮合助手 ✨ 本地线下面基服务都能帮你安排——羽毛球约局、约拍、保洁……想做什么，直接说～",
            },
          ],
        }),
      addBooking: (booking) =>
        set((s) =>
          applyBooking(
            { bookings: s.bookings, workerOrders: s.workerOrders },
            booking
          )
        ),
      addReview: (review) =>
        set((s) => ({ reviews: [...s.reviews, review] })),
      updateBookingStatus: (id, status) =>
        set((s) => ({
          bookings: s.bookings.map((b) => (b.id === id ? { ...b, status } : b)),
        })),
      cancelBooking: (id) =>
        set((s) =>
          applyCancel(
            { bookings: s.bookings, workerOrders: s.workerOrders },
            id
          )
        ),
      setSelectedBooking: (selectedBookingId) => set({ selectedBookingId }),
      setAiDraft: (aiDraft) => set({ aiDraft }),
      setWorkerOnline: (workerOnline) => set({ workerOnline }),
      acceptWorkerOrder: (id) =>
        set((s) => ({
          workerOrders: s.workerOrders.map((o) =>
            o.id === id ? { ...o, status: "active" } : o
          ),
        })),
      completeWorkerOrder: (id) =>
        set((s) => ({
          workerOrders: s.workerOrders.map((o) =>
            o.id === id ? { ...o, status: "completed" } : o
          ),
        })),
    }),
    {
      name: "ai-spatial-storage",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (persisted, version) => {
        const base = (persisted ?? {}) as Partial<AppState>;
        if (version < 1) {
          // v0→v1：M5 引入服务者工作台，旧状态无 workerOrders/workerOnline
          base.workerOrders = WORKER_SEED_ORDERS;
          base.workerOnline = true;
        }
        return {
          bookings: base.bookings ?? [],
          reviews: base.reviews ?? [],
          workerOrders: base.workerOrders ?? WORKER_SEED_ORDERS,
          workerOnline: base.workerOnline ?? true,
          cart: base.cart ?? [],
        } as AppState;
      },
      partialize: (s) => ({
        bookings: s.bookings,
        reviews: s.reviews,
        workerOrders: s.workerOrders,
        workerOnline: s.workerOnline,
        cart: s.cart,
      }),
    }
  )
);
