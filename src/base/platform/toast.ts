"use client";
import { create } from "zustand";

export type ToastTone = "info" | "success" | "error";

export interface ToastItem {
  id: number;
  text: string;
  tone: ToastTone;
}

interface ToastState {
  items: ToastItem[];
  push: (text: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (text, tone = "info") => {
    const id = ++seq;
    set((s) => ({ items: [...s.items.slice(-2), { id, text, tone }] }));
    setTimeout(() => {
      set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
    }, 2600);
  },
  dismiss: (id) =>
    set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export function toast(text: string, tone: ToastTone = "info") {
  useToastStore.getState().push(text, tone);
}