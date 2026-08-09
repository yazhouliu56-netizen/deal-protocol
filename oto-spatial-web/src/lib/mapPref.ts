"use client";
import { useSyncExternalStore } from "react";
import type { MapOverride } from "@/lib/mapConfig";

/**
 * Client-persisted map-tier preference ("auto" | "css" | "3d").
 * SSR-safe: initial snapshot is always "auto" (matches the server), and the
 * stored value is warmed in subscribe() — which React invokes on the client
 * after hydration — so the first post-hydration snapshot flips to storage
 * without a hydration mismatch. Storage errors (private mode) → "auto".
 */

export const MAP_PREF_KEY = "oto-map-pref";

const OVERRIDES: MapOverride[] = ["auto", "3d", "css"];

let cached: MapOverride = "auto";
const listeners = new Set<() => void>();

function readPref(): MapOverride {
  try {
    if (typeof window === "undefined") return "auto";
    const v = window.localStorage.getItem(MAP_PREF_KEY);
    return v === "css" || v === "3d" || v === "auto" ? v : "auto";
  } catch {
    return "auto";
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const stored = readPref();
  if (stored !== cached) {
    cached = stored;
    queueMicrotask(() => listeners.forEach((l) => l()));
  }
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): MapOverride {
  return cached;
}

function getServerSnapshot(): MapOverride {
  return "auto";
}

export function useMapPref(): MapOverride {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Cycle auto → 3d → css → auto (persist for next session). */
export function cycleMapPref(): MapOverride {
  cached = OVERRIDES[(OVERRIDES.indexOf(cached) + 1) % OVERRIDES.length];
  try {
    window.localStorage.setItem(MAP_PREF_KEY, cached);
  } catch {
    // storage unavailable — memory-only cycle still applies
  }
  listeners.forEach((l) => l());
  return cached;
}