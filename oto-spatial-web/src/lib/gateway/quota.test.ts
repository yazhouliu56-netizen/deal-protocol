import { test } from "node:test";
import assert from "node:assert/strict";
import {
  guardedFetchFor,
  isCooling,
  markFail,
  markOk,
  serializedFor,
} from "../chat/llmGuard.ts";

test("serializedFor keeps per-provider queues independent", async () => {
  const overlap: Array<[number, number]> = [];
  const run = (name: string) => async () => {
    const start = Date.now();
    for (const [s, e] of overlap) {
      assert.ok(!(start >= s && start < e), `${name} overlapped`);
    }
    await new Promise((r) => setTimeout(r, 40));
    overlap.push([start, Date.now()]);
    return name;
  };
  // Two different providers run truly in parallel (no cross-queue waiting).
  const results = await Promise.all([
    serializedFor("gemini", 10, run("a")),
    serializedFor("zhipu", 10, run("b")),
    serializedFor("gemini", 10, run("c")),
  ]);
  assert.deepEqual(results, ["a", "b", "c"]);
});

test("guardedFetchFor skips retry on 429 and arms cooldown after two", async () => {
  const calls: number[] = [];
  const realFetch = globalThis.fetch;
  const name = "gemini-429-" + Date.now();
  globalThis.fetch = async () => {
    calls.push(1);
    return new Response("quota", { status: 429 });
  };
  try {
    const res = await guardedFetchFor(name, 0, 200, "https://x.test", {});
    assert.equal(res.status, 429);
    assert.equal(calls.length, 1, "429 must not retry (quota exhausted)");
    assert.equal(isCooling(name), false, "single 429 does not cool yet");
    await guardedFetchFor(name, 0, 200, "https://x.test", {});
    assert.equal(isCooling(name), true, "second consecutive 429 arms cooldown");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("markOk resets the fail streak and clears cooldown state", () => {
  const name = "gemini-ok-" + Date.now();
  markFail(name, 60_000);
  markFail(name, 60_000);
  assert.equal(isCooling(name), true);
  markOk(name);
  assert.equal(isCooling(name), false);
  markFail(name, 60_000);
  assert.equal(isCooling(name), false, "single failure after ok does not cool");
});

test("guardedFetchFor passes non-retryable error straight through", async () => {
  const name = "gemini-400-" + Date.now();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("bad", { status: 400 });
  try {
    const res = await guardedFetchFor(name, 0, 200, "https://x.test", {});
    assert.equal(res.status, 400);
  } finally {
    globalThis.fetch = realFetch;
  }
});
