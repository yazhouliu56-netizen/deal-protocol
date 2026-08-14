import { test } from "node:test";
import assert from "node:assert/strict";
import { cacheKey, guardedFetch, llmCache, serialized } from "./llmGuard.ts";

test("cacheKey takes the last user message content", () => {
  const messages = [
    { role: "system", content: "sys" },
    { role: "user", content: "周末找人打羽毛球" },
  ];
  assert.equal(cacheKey(messages), "周末找人打羽毛球");
});

test("cacheKey returns empty string for non-string/invalid tails", () => {
  assert.equal(cacheKey([{ role: "user" }]), "");
  assert.equal(cacheKey([]), "");
  assert.equal(cacheKey([{ role: "user", content: 42 }]), "");
});

test("llmCache round-trips and refuses empty keys", () => {
  assert.equal(llmCache.get("k1"), null);
  llmCache.set("k1", "data: hello");
  assert.equal(llmCache.get("k1"), "data: hello");
  llmCache.set("", "should not store");
  assert.equal(llmCache.get(""), null);
  llmCache.set("", "x");
  assert.equal(llmCache.get("x"), null);
});

test("serialized never overlaps concurrent tasks", async () => {
  const timestamps: number[] = [];
  const overlap: Array<[Date, Date]> = [];

  const track = (label: string) => async () => {
    const start = new Date();
    for (const pair of overlap) {
      assert.ok(start >= pair[1], `${label} started while another task ran`);
    }
    await new Promise((r) => setTimeout(r, 60));
    const end = new Date();
    overlap.push([start, end]);
    timestamps.push(start.getTime());
    return label;
  };

  const results = await Promise.all([serialized(track("a")), serialized(track("b")), serialized(track("c"))]);
  assert.deepEqual(results, ["a", "b", "c"]);
  assert.equal(new Set(timestamps).size, 3, "tasks must start at distinct times");
});

test("guardedFetch retries a 429 once, honoring retry-after, then succeeds", async () => {
  const calls: number[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push((init as { method?: string })?.method === "POST" ? 1 : 0);
    if (calls.length === 1) {
      return new Response("quota", { status: 429, headers: { "retry-after": "1" } });
    }
    return new Response("ok", { status: 200 });
  };

  try {
    const res = await guardedFetch("https://example.test", { method: "POST" });
    assert.equal(res.status, 200);
    assert.equal(calls.length, 2, "expected one retry after the 429");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("guardedFetch passes a non-retryable error straight through", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("bad request", { status: 400 });
  try {
    const res = await guardedFetch("https://example.test", { method: "POST" });
    assert.equal(res.status, 400);
  } finally {
    globalThis.fetch = realFetch;
  }
});