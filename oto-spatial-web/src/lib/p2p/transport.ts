/**
 * P2P transport gate — where the shared broadcast space lives.
 *
 *   local    → browser localStorage + `storage` event (same device, tabs)
 *   supabase → single-row JSONB table + Realtime postgres_changes (cross-device)
 *
 * The store talks to `P2pTransport` only; production picks the transport at
 * boot from NEXT_PUBLIC_SUPABASE_URL/ANON_KEY (falls back to local when
 * missing, keeping all E2E suites green without credentials).
 */

import type { WaveBundle } from "@/store/useWaveStore";

export interface P2pTransport {
  kind: "local" | "supabase";
  /** Read the whole shared space (null = empty). */
  read(): WaveBundle | null;
  /** Persist a new version of the shared space. */
  write(state: WaveBundle): void;
  /** External updates (other tab / other device). Returns unsubscriber. */
  subscribe(cb: () => void): () => void;
}

export const BROADCAST_KEY = "oto-broadcast-v1";

/** Current transport — lazy singleton so tests can reset it. */
let active: P2pTransport | null = null;

export function setP2pTransport(t: P2pTransport | null): void {
  active = t;
}

export function getP2pTransport(): P2pTransport {
  if (!active) active = createTransport();
  return active;
}

function createTransport(): P2pTransport {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    // dynamic require keeps the bundle free of supabase on the local path
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("@/lib/p2p/supabase");
      return mod.createSupabaseTransport(url, key);
    } catch {
      // supabase dependency not installed → local fallback
    }
  }
  return createLocalTransport();
}

/** Same-browser transport: localStorage + storage event (current behavior). */
export function createLocalTransport(): P2pTransport {
  const read = (): WaveBundle | null => {
    try {
      const raw = localStorage.getItem(BROADCAST_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const state = parsed?.state ?? parsed;
      if (!state || typeof state !== "object") return null;
      return state as WaveBundle;
    } catch {
      return null;
    }
  };
  return {
    kind: "local",
    read,
    write: (state) => {
      try {
        localStorage.setItem(
          BROADCAST_KEY,
          JSON.stringify({ state, version: 0 })
        );
      } catch {
        // storage full / private mode — broadcast degrades gracefully
      }
    },
    subscribe: (cb) => {
      const handler = (e: StorageEvent) => {
        if (e.key === BROADCAST_KEY) cb();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
  };
}
