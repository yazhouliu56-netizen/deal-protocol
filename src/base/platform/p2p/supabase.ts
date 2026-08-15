/**
 * Supabase Realtime transport — cross-device shared broadcast space.
 *
 * Storage model: single row in `p2p_broadcast` (id=oto, state jsonb).
 *   CREATE TABLE public.p2p_broadcast (
 *     id text primary key,
 *     state jsonb not null,
 *     updated_at timestamptz default now()
 *   );
 *   alter table public.p2p_broadcast enable row level security;
 *   create policy "anon read" on public.p2p_broadcast for select using (true);
 *   create policy "anon write" on public.p2p_broadcast for insert with check (true);
 *   create policy "anon update" on public.p2p_broadcast for update using (true);
 *   -- Realtime must be enabled on the table in the dashboard (Realtime > tables).
 *
 * Reads are cached in memory (sync `read()` for zustand persist); the cache is
 * primed by an initial fetch and kept fresh by postgres_changes. Writes upsert
 * asynchronously; self-echoes are dropped via signature comparison.
 */

import { createClient } from "@supabase/supabase-js";
import type { P2pTransport } from "./transport";
import type { WaveBundle } from "@/types/wave-bundle";

const TABLE = "p2p_broadcast";
const ROW_ID = "oto";

export function createSupabaseTransport(
  url: string,
  key: string
): P2pTransport {
  const client = createClient(url, key);
  let cache: WaveBundle | null = null;
  let sig = "";
  const listeners = new Set<() => void>();

  function notify(): void {
    listeners.forEach((cb) => cb());
  }

  async function pull(): Promise<void> {
    try {
      const { data, error } = await client
        .from(TABLE)
        .select("state")
        .eq("id", ROW_ID)
        .maybeSingle();
      if (error) return;
      if (!data) return;
      const s = JSON.stringify(data.state as WaveBundle);
      if (s === sig) return;
      sig = s;
      cache = data.state as WaveBundle;
      notify();
    } catch {
      // network offline — keep the cache
    }
  }

  // prime the cache (cross-device pull on boot)
  void pull();

  client
    .channel("p2p-broadcast")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: TABLE,
        filter: `id=eq.${ROW_ID}`,
      },
      () => void pull()
    )
    .subscribe();

  return {
    kind: "supabase",
    read: () => cache,
    write: (state) => {
      const s = JSON.stringify(state);
      if (s === sig) {
        cache = state;
        return;
      }
      sig = s;
      cache = state;
      notify();
      void client
        .from(TABLE)
        .upsert({ id: ROW_ID, state, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) {
            console.error("[p2p] supabase upsert failed:", error.message);
          }
        });
    },
    subscribe: (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}
