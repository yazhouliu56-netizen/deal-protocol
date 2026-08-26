/**
 * LLM 完成度端口（Microkernel 2.0 战役 2 · 六边形架构）：
 * 纯核（bi/forgery）经本端口消费 LLM 能力；实现方为
 * src/adapters/ai/gateway/engine 的 completeText，由各 AI 路由在模块装配期
 * 注入（adapters→base 单向，红线 3 守恒）。未注入时显式抛错，拒绝静默降级。
 */

/** 结构化最小契约（与 engine.TextCompletionOptions 结构兼容，双向可赋值）。 */
export interface CompleteTextArgs {
  task: string;
  messages: unknown[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export type CompleteTextFn = (args: CompleteTextArgs) => Promise<unknown>;

let impl: CompleteTextFn | null = null;

export function configureLlmCompleteText(fn: (args: never) => Promise<unknown>): void {
  impl = fn as CompleteTextFn;
}

export function getLlmCompleteText(): CompleteTextFn {
  if (!impl) {
    throw new Error(
      "LLM transport not wired: route must call configureLlmCompleteText(completeText) before LLM-backed analysis",
    );
  }
  return impl;
}
