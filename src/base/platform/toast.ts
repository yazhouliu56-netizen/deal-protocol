"use client";
import { create } from "zustand";

export type ToastTone = "info" | "success" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: number;
  text: string;
  tone: ToastTone;
  action?: ToastAction;
}

interface ToastState {
  items: ToastItem[];
  push: (text: string, tone?: ToastTone, action?: ToastAction) => number;
  update: (id: number | undefined, text: string, tone?: ToastTone) => number;
  dismiss: (id: number) => void;
  dismissAll: () => void;
}

let seq = 0;
const TOAST_TTL_MS = 2600;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function arm(id: number, remove: () => void) {
  const prev = timers.get(id);
  if (prev) clearTimeout(prev);
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      remove();
    }, TOAST_TTL_MS),
  );
}

function disarm(id: number) {
  const prev = timers.get(id);
  if (prev) {
    clearTimeout(prev);
    timers.delete(id);
  }
}

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: (text, tone = "info", action) => {
    const id = ++seq;
    set((s) => ({ items: [...s.items.slice(-2), { id, text, tone, action }] }));
    arm(id, () => get().dismiss(id));
    return id;
  },
  update: (id, text, tone = "info") => {
    if (id === undefined || !get().items.some((t) => t.id === id)) {
      return get().push(text, tone);
    }
    set((s) => ({
      items: s.items.map((t) => (t.id === id ? { ...t, text, tone, action: undefined } : t)),
    }));
    arm(id, () => get().dismiss(id));
    return id;
  },
  dismiss: (id) => {
    disarm(id);
    set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
  },
  dismissAll: () => {
    for (const id of timers.keys()) disarm(id);
    set({ items: [] });
  },
}));

export function toast(text: string, tone: ToastTone = "info", action?: ToastAction): number {
  return useToastStore.getState().push(text, tone, action);
}

/** loading→终态专用：id 缺失/过期即新建，保证终态必达。 */
export function updateToast(id: number | undefined, text: string, tone: ToastTone = "info"): number {
  return useToastStore.getState().update(id, text, tone);
}
