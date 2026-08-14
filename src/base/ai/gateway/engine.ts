/**
 * Gateway 引擎（ADR-0005）：流式对话与非流式 JSON 两条执行链。
 *
 * - 路由：activeProviders(task) 顺序降级（2xx 赢；429/5xx 换下一家）。
 * - 配额：guardedFetchFor per-provider 串行 + 间隔 + 429 冷却（冷却中跳过）。
 * - 缓存：chat 流式 SSE / voice-intent JSON 均按最后一条 user 消息缓存，
 *   同文本零上游开销。
 */

import { cacheKey, guardedFetchFor, isCooling, llmCache, markFail } from "@/base/ai/chat/llmGuard";
import {
  activeProviders,
  CHAT_TEMPERATURE,
  extraBodyFor,
  JSON_TEMPERATURE,
  type GatewayTask,
  type ProviderEntry,
} from "./providers";

export interface ChatOutcome {
  status: number;
  /** 缓存命中时直接回放整段 SSE；否则为 undefined（走 stream）。 */
  sse?: string;
  stream?: ReadableStream;
  provider?: string;
  error?: string;
}

interface UpstreamOverrides {
  temperature?: number;
  maxTokens?: number;
}

function jsonBody(
  p: ProviderEntry,
  task: GatewayTask,
  messages: unknown[],
  overrides?: UpstreamOverrides
) {
  return JSON.stringify({
    model: p.model,
    messages,
    temperature:
      overrides?.temperature ?? (task === "chat" ? CHAT_TEMPERATURE : JSON_TEMPERATURE),
    ...(overrides?.maxTokens ? { max_tokens: overrides.maxTokens } : {}),
    stream: task === "chat",
    ...extraBodyFor(p.name),
  });
}

async function upstream(
  p: ProviderEntry,
  task: GatewayTask,
  messages: unknown[],
  timeoutMs?: number,
  overrides?: UpstreamOverrides
): Promise<Response | null> {
  try {
    return await guardedFetchFor(
      p.name,
      p.minGapMs,
      p.cooldownMs,
      p.endpoint,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${p.apiKey}`,
          "Content-Type": "application/json",
        },
        body: jsonBody(p, task, messages, overrides),
        ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
      }
    );
  } catch {
    // 网络层异常（DNS / 连接超时 / TLS）：计入健康分并降级，不 500。
    markFail(p.name, p.cooldownMs);
    return null;
  }
}

/** 流式对话：缓存命中回放 SSE；否则管道上游流并侧录缓存。 */
export async function streamChat(messages: unknown[]): Promise<ChatOutcome> {
  const key = taskKey("chat", messages);
  const cached = key ? llmCache.get(key) : null;
  if (cached) {
    return { status: 200, sse: cached, provider: "cache" };
  }

  const chain = activeProviders("chat").filter((p) => !isCooling(p.name));
  let lastDetail = "no providers";
  for (const provider of chain) {
    const upstreamRes = await upstream(provider, "chat", messages);
    if (!upstreamRes) {
      lastDetail = `${provider.name}: network error`;
      continue;
    }
    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => "");
      lastDetail = `${provider.name} ${upstreamRes.status}: ${text.slice(0, 300)}`;
      continue;
    }
    if (!upstreamRes.body) {
      lastDetail = `${provider.name}: no stream body`;
      continue;
    }
    const [passthrough, collector] = upstreamRes.body.tee();
    if (key) {
      void (async () => {
        const reader = collector.getReader();
        const decoder = new TextDecoder();
        let sse = "";
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            sse += decoder.decode(value, { stream: true });
          }
          sse += decoder.decode();
          llmCache.set(key, sse);
        } catch {
          /* partial/cancelled stream: skip caching, passthrough already served */
        }
      })();
    }
    return { status: 200, stream: passthrough, provider: provider.name };
  }
  return { status: 503, error: lastDetail, provider: undefined };
}

export interface JsonOutcome {
  status: number;
  json: unknown | null;
  provider?: string;
  error?: string;
}

/** 非流式结构化 JSON：顺序降级 + 缓存命中直返。 */
export async function jsonChat(messages: unknown[]): Promise<JsonOutcome> {
  const key = taskKey("voice-intent", messages);
  const cached = key ? llmCache.get(key) : null;
  if (cached) {
    try {
      return { status: 200, json: JSON.parse(cached), provider: "cache" };
    } catch {
      /* stale non-JSON cache entry: fall through to upstream */
    }
  }

  const chain = activeProviders("voice-intent").filter((p) => !isCooling(p.name));
  let lastDetail = "no providers";
  for (const provider of chain) {
    const upstreamRes = await upstream(provider, "voice-intent", messages);
    if (!upstreamRes) {
      lastDetail = `${provider.name}: network error`;
      continue;
    }
    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => "");
      lastDetail = `${provider.name} ${upstreamRes.status}: ${text.slice(0, 200)}`;
      continue;
    }
    let content = "";
    try {
      const data = (await upstreamRes.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      content = data.choices?.[0]?.message?.content ?? "";
    } catch (err) {
      lastDetail = `${provider.name}: bad body ${err instanceof Error ? err.message : err}`;
      continue;
    }
    const parsed = parseJsonLoose(content);
    if (parsed === null) {
      lastDetail = `${provider.name}: non-JSON reply`;
      continue;
    }
    if (key) llmCache.set(key, content);
    return { status: 200, json: parsed, provider: provider.name };
  }
  return { status: 503, json: null, error: lastDetail };
}

/** LLM 偶发 ```json ``` 围栏剥离后重试解析。 */
function parseJsonLoose(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) {
      try {
        return JSON.parse(fence[1]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** 任务前缀隔离缓存 key：chat 存 SSE、voice-intent 存 JSON，互不串味。 */
function taskKey(task: GatewayTask, messages: unknown[]): string {
  const raw = cacheKey(messages as Array<{ role?: string; content?: unknown }>);
  return raw ? `${task}:${raw}` : "";
}

export interface TextCompletionOptions {
  task: GatewayTask;
  messages: unknown[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface TextOutcome {
  ok: boolean;
  content: string;
  /** 命中 provider 名；全灭（含缓存外的 mock 兜底决策点）为 undefined。 */
  provider?: string;
  detail?: string;
}

/**
 * 非流式文本补全（cluster/decompose/diagnose 共用，ADR-0005）：走
 * per-task provider 链 + per-provider 配额 + 超时，返回 content 原文，
 * 解析/兜底由调用方业务层决定。不做缓存——fire-and-forget 重复率低，
 * 避免缓存命中的 source 语义歧义。
 */
export async function completeText(
  opts: TextCompletionOptions
): Promise<TextOutcome> {
  const chain = activeProviders(opts.task).filter((p) => !isCooling(p.name));
  let lastDetail = "no providers";
  for (const provider of chain) {
    const res = await upstream(
      provider,
      opts.task,
      opts.messages,
      opts.timeoutMs,
      { temperature: opts.temperature, maxTokens: opts.maxTokens }
    );
    if (!res) {
      lastDetail = `${provider.name}: network error`;
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      lastDetail = `${provider.name} ${res.status}: ${text.slice(0, 200)}`;
      continue;
    }
    let content = "";
    try {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      content = data.choices?.[0]?.message?.content ?? "";
    } catch (err) {
      lastDetail = `${provider.name}: bad body ${err instanceof Error ? err.message : err}`;
      continue;
    }
    if (!content) {
      lastDetail = `${provider.name}: empty content`;
      continue;
    }
    return { ok: true, content, provider: provider.name };
  }
  return { ok: false, content: "", detail: lastDetail };
}