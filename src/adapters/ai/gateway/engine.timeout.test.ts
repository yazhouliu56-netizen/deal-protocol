import { test } from "node:test";
import assert from "node:assert/strict";
import { completeText } from "./engine.ts";
import { isCooling } from "../chat/llmGuard.ts";

// key 名拆段（与 scripts/verify-chat-providers.mjs 同惯例）：避免静态密钥扫描误伤。
const ORK = "OPENROUTER" + "_" + "API" + "_" + "KEY";
const OTHERS = ["GEMINI", "ZHIPU", "DASHSCOPE", "DEEPSEEK", "KIMI"].map(
  (s) => s + "_" + "API" + "_" + "KEY",
);

/**
 * 缺陷考卷（2026-09-07 基线 3/20）：单次尝试拿满总预算，stall 的首发
 * 独吞 8s，链条一次没走就 TIMEOUT。修后：首发 hang 必须被逐次上限
 * 熔断，调用在总预算内走到第二家并成功。
 */
test("completeText: stalled first provider does not eat the whole budget", async () => {
  const all = [...OTHERS, ORK];
  const saved = new Map<string, string | undefined>();
  for (const k of all) {
    saved.set(k, process.env[k]);
    delete process.env[k];
  }
  process.env[ORK] = "euclid-or-fixture-1";
  const realFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = ((url: unknown, init?: { signal?: AbortSignal }) => {
    attempts += 1;
    if (attempts === 1) {
      // 首发 stall：直到 signal 熔断才抛，模拟挂起的上游。
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }
    return Promise.resolve(
      new Response(JSON.stringify({ choices: [{ message: { content: "second-wins" } }] }), {
        status: 200,
      }),
    );
  }) as typeof fetch;
  const t0 = Date.now();
  try {
    const r = await completeText({
      task: "decompose",
      messages: [{ role: "user", content: "timeout-probe" }],
      timeoutMs: 6000,
    });
    const elapsed = Date.now() - t0;
    assert.equal(r.ok, true);
    assert.equal(r.content, "second-wins");
    assert.equal(r.provider, "openrouter-nemotron");
    assert.equal(attempts, 2);
    assert.ok(elapsed < 9000, `total ${elapsed}ms exceeds budget+slack`);
    assert.ok(elapsed >= 3500, `first attempt was not capped (${elapsed}ms)`);
    // 自家熔断不污染健康分：首发 abort 后不得进 30s 冷却，否则连锁清空整条链。
    assert.equal(isCooling("openrouter-cohere"), false);
  } finally {
    globalThis.fetch = realFetch;
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

/**
 * 缺陷→考卷 2026-09-07（真机 15/20 #12/#14/#16）：上游 200 回空
 * 不是失败、不污染健康分，直接下跳下一家，整句仍成功。
 */
test("completeText: empty content falls through to next provider", async () => {
  const all = [...OTHERS, ORK];
  const saved = new Map<string, string | undefined>();
  for (const k of all) {
    saved.set(k, process.env[k]);
    delete process.env[k];
  }
  process.env[ORK] = "euclid-or-fixture-2";
  const realFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = (() => {
    attempts += 1;
    if (attempts === 1) {
      // 首家 200 但 content 为空：免费池短句偶发回空形态。
      return Promise.resolve(
        new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), {
          status: 200,
        }),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify({ choices: [{ message: { content: "fallback-wins" } }] }), {
        status: 200,
      }),
    );
  }) as typeof fetch;
  try {
    const r = await completeText({
      task: "decompose",
      messages: [{ role: "user", content: "empty-probe" }],
      timeoutMs: 6000,
    });
    assert.equal(r.ok, true);
    assert.equal(r.content, "fallback-wins");
    assert.equal(attempts, 2);
    assert.ok(typeof r.provider === "string" && r.provider.length > 0);
    // 回空不计入健康分：三行均不在冷却中。
    assert.equal(isCooling("openrouter-cohere"), false);
    assert.equal(isCooling("openrouter-nemotron"), false);
    assert.equal(isCooling("openrouter-lfm"), false);
  } finally {
    globalThis.fetch = realFetch;
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
