/**
 * Server-side guard for the Gemini-backed /api/chat proxy. Three layers:
 *  1. intent-level result cache — a cache key is the last user message, which
 *     already embeds the collected-demand summary + history. Re-asking the same
 *     thing replays the stored SSE verbatim with zero upstream calls (the
 *     direct counter to free-tier 429s).
 *  2. serialize upstream calls — free tier is ~10-15 RPM, so bursts are
 *     collapsed into a single in-flight request + a minimum inter-call gap.
 *  3. one bounded retry on 429/5xx with jitter, honoring Retry-After when the
 *     provider sends one (never a tight retry loop).
 *
 * State is process-local (globalThis), which is exactly right for `next start`
 * single-process prod. Shared cache/queue across instances would require a
 * store like Redis — documented limitation for serverless deployments.
 */

const TTL_MS = 15 * 60 * 1000;
const MIN_GAP_MS = 900;

interface CacheEntry {
  sse: string;
  at: number;
}

const g = globalThis as unknown as {
  __llmCache?: Map<string, CacheEntry>;
  __llmChain?: Promise<void>;
  __llmLastAt?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function cache(): Map<string, CacheEntry> {
  if (!g.__llmCache) g.__llmCache = new Map();
  return g.__llmCache;
}

/**
 * Derive the cache key from the request body. The client always sends the
 * current user message as the last entry and folds the collected summary +
 * dialog history into it, so the last user content uniquely identifies the
 * whole conversation snapshot.
 */
export function cacheKey(
  messages: Array<{ role?: string; content?: unknown }>
): string {
  const last = messages[messages.length - 1];
  return typeof last?.content === "string" ? last.content : "";
}

function cacheGet(key: string): string | null {
  if (!key) return null;
  const entry = cache().get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > TTL_MS) {
    cache().delete(key);
    return null;
  }
  return entry.sse;
}

function cacheSet(key: string, sse: string): void {
  if (!key || !sse) return;
  cache().set(key, { sse, at: Date.now() });
}

/**
 * Serialize upstream invocation across this process: at most one call runs at a
 * time and each waits at least MIN_GAP_MS after the previous one started.
 */
export async function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const previous = g.__llmChain ?? Promise.resolve();
  let release!: () => void;
  g.__llmChain = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  const elapsed = Date.now() - (g.__llmLastAt ?? 0);
  const wait = Math.max(0, MIN_GAP_MS - elapsed);
  if (wait > 0) await sleep(wait);
  try {
    return await fn();
  } finally {
    g.__llmLastAt = Date.now();
    release();
  }
}

/**
 * Bounded retry for transient upstream failure (429 quota / 5xx capacity).
 * Honors Retry-After (capped) and jitters otherwise; never floods the API.
 */
async function fetchUpstream(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.ok || (res.status !== 429 && res.status < 500)) return res;
  const retryAfter = Number(res.headers.get("retry-after"));
  const backoff = retryAfter > 0 ? Math.min(retryAfter, 3000) : 700 + Math.random() * 500;
  await sleep(backoff);
  return fetch(url, init);
}

/** Serialized upstream call with one bounded retry. */
export function guardedFetch(url: string, init: RequestInit): Promise<Response> {
  return serialized(() => fetchUpstream(url, init));
}

/** Cache lookup/insert helpers used by the route handler. */
export const llmCache = { get: cacheGet, set: cacheSet };

// ---------------------------------------------------------------------------
// Per-provider quota layer (ADR-0005): each provider gets its own serialized
// chain, min-gap, 429 cooldown and health streak, so one provider's
// Retry-After / outage never starves the others.
// ---------------------------------------------------------------------------

interface ProviderQuota {
  chain: Promise<void>;
  lastAt: number;
  cooldownUntil: number;
  failStreak: number;
}

const QUOTA_KEY = "__llmQuota";

function quotaMap(): Map<string, ProviderQuota> {
  const g = globalThis as unknown as Record<string, Map<string, ProviderQuota> | undefined>;
  if (!g[QUOTA_KEY]) g[QUOTA_KEY] = new Map();
  return g[QUOTA_KEY]!;
}

function quota(name: string): ProviderQuota {
  const map = quotaMap();
  let q = map.get(name);
  if (!q) {
    q = { chain: Promise.resolve(), lastAt: 0, cooldownUntil: 0, failStreak: 0 };
    map.set(name, q);
  }
  return q;
}

/** Per-provider serialized invocation with its own min-gap. */
export function serializedFor<T>(
  name: string,
  minGapMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const q = quota(name);
  const previous = q.chain;
  let release!: () => void;
  q.chain = new Promise<void>((resolve) => {
    release = resolve;
  });
  return (async () => {
    await previous;
    const elapsed = Date.now() - q.lastAt;
    const wait = Math.max(0, minGapMs - elapsed);
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      q.lastAt = Date.now();
      release();
    }
  })();
}

/** Cooling while true — route skips this provider this round. */
export function isCooling(name: string): boolean {
  return Date.now() < quota(name).cooldownUntil;
}

/** Report an ok upstream response: resets the health streak and lifts cooldown. */
export function markOk(name: string): void {
  const q = quota(name);
  q.failStreak = 0;
  q.cooldownUntil = 0;
}

/**
 * Report a failure: a second consecutive failure arms the cooldown window
 * (429 quota exhausted / persistent 5xx). cooldownMs comes from the table.
 */
export function markFail(name: string, cooldownMs: number): void {
  const q = quota(name);
  q.failStreak += 1;
  if (q.failStreak >= 2) {
    q.cooldownUntil = Date.now() + cooldownMs;
    q.failStreak = 0;
  }
}

/** Per-provider guarded fetch: own queue + gap + bounded retry + health. */
export function guardedFetchFor(
  name: string,
  minGapMs: number,
  cooldownMs: number,
  url: string,
  init: RequestInit
): Promise<Response> {
  return serializedFor(name, minGapMs, () =>
    fetchUpstreamFor(name, url, init, cooldownMs)
  );
}

async function fetchUpstreamFor(
  name: string,
  url: string,
  init: RequestInit,
  cooldownMs: number
): Promise<Response> {
  const res = await fetch(url, init);
  if (res.ok) {
    markOk(name);
    return res;
  }
  const retryable = res.status === 429 || (res.status >= 500 && res.status < 600);
  if (!retryable) {
    markFail(name, cooldownMs);
    return res;
  }
  const retryAfter = Number(res.headers.get("retry-after"));
  const backoff = retryAfter > 0 ? Math.min(retryAfter, 3000) : 700 + Math.random() * 500;
  await sleep(backoff);
  // 429 coil: skip the retry entirely (quota is gone); 5xx gets one retry.
  if (res.status === 429) {
    markFail(name, cooldownMs);
    return res;
  }
  const retry = await fetch(url, init);
  if (!retry.ok) markFail(name, cooldownMs);
  else markOk(name);
  return retry;
}