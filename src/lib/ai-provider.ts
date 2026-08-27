import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { google } from "@ai-sdk/google"
import { allProviders, activeProviders, isValidKey } from "@/adapters/ai/gateway/providers"

const MOCK = "mock-"

function toBaseURL(endpoint: string): string {
  return endpoint.replace(/\/chat\/completions\/?$/, "")
}

function modelFromEntry(entry: { name: string; endpoint: string; apiKey: string; model: string }) {
  const baseURL = toBaseURL(entry.endpoint)
  const provider = createOpenAICompatible({
    name: entry.name,
    baseURL,
    apiKey: entry.apiKey,
  })
  return provider(entry.model)
}

/**
 * 主对话模型选择器 — 已收敛至 Gateway 单一来源（ADR-0005 / D-03）。
 * - 优先尊重 NEXT_PUBLIC_LLM_PROVIDER / AI_PROVIDER 显式指定（动态，不走硬编码白名单）；
 * - 其次按 Gateway `activeProviders("chat")` 优先级链自动选择首个可用 Provider；
 * - 最后降级为 legacy deepseek/gemini/mock，保障离线/无 key 时不抛异常。
 * - 任务隔离：本函数仅服务 chat 主对话；small-model tasks（voice-intent 等）由 Gateway per-task 路由隔离，不受此影响。
 */
export function getAIModel() {
  const rawProvider = (
    process.env.NEXT_PUBLIC_LLM_PROVIDER ||
    process.env.AI_PROVIDER ||
    ""
  )
    .trim()
    .toLowerCase()

  // 1) 显式指定且非 mock：尝试在 Gateway 表中精确命中（补 key 即生效）
  if (rawProvider && rawProvider !== "mock" && rawProvider !== "") {
    const all = allProviders()
    const hit = all.find(
      (p) => p.name.toLowerCase() === rawProvider && isValidKey(p.apiKey),
    )
    if (hit) {
      // deepseek/gemini 等统一走 OpenAI 兼容端点（Gateway 表已声明 endpoint/model）
      // 保留 gemini 经 @ai-sdk/google 的旧分支作兼容：若 hit.name === "gemini" 且调用方期望 google SDK，可仍走 OpenAI 兼容（行为一致，key 复用）
      return modelFromEntry(hit)
    }
    // 显式指定但 Gateway 无对应有效 key 时，继续走链式降级而非直接 mock，避免“配置了却走 mock”的困惑
  }

  // 2) 无显式命中：走 Gateway chat 优先级链首个可用（已按 ordering 排序，isValidKey 已过滤）
  const chain = activeProviders("chat")
  if (chain.length > 0) {
    return modelFromEntry(chain[0])
  }

  // 3) Legacy 兜底（兼容历史单测与离线占位）：deepseek → gemini → mock
  const dsKey = process.env["DEEPSEEK_API_KEY"]
  const providerEnv = process.env.AI_PROVIDER || "deepseek"
  if (providerEnv === "deepseek" || isValidKey(dsKey)) {
    const baseURL = process.env["DEEPSEEK_BASE_URL"] || "https://api.deepseek.com/v1"
    const apiKey = isValidKey(dsKey) ? dsKey! : MOCK + "key"
    const deepseek = createOpenAICompatible({
      name: "deepseek",
      baseURL,
      apiKey,
    })
    return deepseek(process.env.DEEPSEEK_MODEL ?? "deepseek-chat")
  }

  if (isValidKey(process.env["GEMINI_API_KEY"])) {
    return google("gemini-1.5-flash")
  }

  const fallbackProvider = createOpenAICompatible({
    name: `${MOCK}ai`,
    baseURL: "https://api.deepseek.com/v1",
    apiKey: MOCK + "key",
  })
  return fallbackProvider("deepseek-chat")
}
