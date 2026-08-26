import { test } from "node:test";
import assert from "node:assert/strict";
import { activeProviders, allProviders, extraBodyFor } from "./providers.ts";

const ALL: Array<[string, string | undefined]> = [
  ["GEMINI_API_KEY", undefined],
  ["ZHIPU_API_KEY", undefined],
  ["DASHSCOPE_API_KEY", undefined],
  ["GROQ_API_KEY", undefined],
  ["OPENROUTER_API_KEY", undefined],
];

/** 全量声明 5 个 env 变量，隔离真实进程环境。 */
function withEnv(env: Array<[string, string | undefined]>, fn: () => void) {
  const wanted = new Map(env);
  const saved = new Map<string, string | undefined>();
  for (const [k, v] of ALL) {
    const target = wanted.has(k) ? wanted.get(k) : v;
    saved.set(k, process.env[k]);
    if (target === undefined) delete process.env[k];
    else process.env[k] = target;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("allProviders declares the five ADR-0005 candidates", () => {
  assert.deepEqual(
    allProviders().map((p) => p.name).sort(),
    ["gemini", "groq", "openrouter", "qwen", "zhipu"]
  );
});

test("chat ordering: gemini 0 < zhipu 1 < qwen 2 < groq 3 < openrouter 99", () => {
  const names = allProviders()
    .filter((p) => p.tasks.includes("chat"))
    .sort((a, b) => (a.ordering.chat ?? 99) - (b.ordering.chat ?? 99))
    .map((p) => p.name);
  assert.deepEqual(names, ["gemini", "zhipu", "qwen", "groq", "openrouter"]);
});

test("voice-intent ordering: zhipu first, openrouter last", () => {
  const names = allProviders()
    .filter((p) => p.tasks.includes("voice-intent"))
    .sort((a, b) => (a.ordering["voice-intent"] ?? 99) - (b.ordering["voice-intent"] ?? 99))
    .map((p) => p.name);
  assert.equal(names[0], "zhipu");
  assert.equal(names[names.length - 1], "openrouter");
});

test("activeProviders skips providers without a key", () => {
  withEnv(
    [
      ["ZHIPU_API_KEY", "demo-key-zhipu"],
      ["OPENROUTER_API_KEY", "demo-key-or"],
    ],
    () => {
      const chain = activeProviders("chat").map((p) => p.name);
      assert.deepEqual(chain, ["zhipu", "openrouter"]);
    }
  );
});

test("activeProviders order follows per-task ordering", () => {
  withEnv(
    [
      ["GEMINI_API_KEY", "demo-key-gemini"],
      ["ZHIPU_API_KEY", "demo-key-zhipu"],
      ["DASHSCOPE_API_KEY", "demo-key-qwen"],
      ["GROQ_API_KEY", "demo-key-groq"],
      ["OPENROUTER_API_KEY", "demo-key-or"],
    ],
    () => {
      assert.deepEqual(activeProviders("chat").map((p) => p.name), [
        "gemini",
        "zhipu",
        "qwen",
        "groq",
        "openrouter",
      ]);
      assert.deepEqual(activeProviders("voice-intent").map((p) => p.name), [
        "zhipu",
        "gemini",
        "groq",
        "openrouter",
      ]);
    }
  );
});

test("qwen does not join voice-intent", () => {
  withEnv(
    [
      ["GEMINI_API_KEY", "demo-key-gemini"],
      ["ZHIPU_API_KEY", "demo-key-zhipu"],
      ["DASHSCOPE_API_KEY", "demo-key-qwen"],
    ],
    () => {
      const names = activeProviders("voice-intent").map((p) => p.name);
      assert.ok(!names.includes("qwen"));
    }
  );
});

test("structured tasks (cluster/decompose/diagnose) lead with zhipu, then gemini", () => {
  withEnv(
    [
      ["GEMINI_API_KEY", "demo-key-gemini"],
      ["ZHIPU_API_KEY", "demo-key-zhipu"],
      ["DASHSCOPE_API_KEY", "demo-key-qwen"],
      ["GROQ_API_KEY", "demo-key-groq"],
      ["OPENROUTER_API_KEY", "demo-key-or"],
    ],
    () => {
      for (const task of ["cluster", "decompose", "diagnose"] as const) {
        const names = activeProviders(task).map((p) => p.name);
        assert.equal(names[0], "zhipu", `${task} leads with zhipu`);
        assert.equal(names[1], "gemini", `${task} second is gemini`);
        assert.ok(!names.includes("qwen"), `${task} excludes qwen`);
      }
    }
  );
});

test("extraBodyFor returns zhipu thinking-disable, nothing for others", () => {
  assert.deepEqual(extraBodyFor("zhipu"), { thinking: { type: "disabled" } });
  assert.deepEqual(extraBodyFor("gemini"), {});
  assert.deepEqual(extraBodyFor("nope"), {});
});

