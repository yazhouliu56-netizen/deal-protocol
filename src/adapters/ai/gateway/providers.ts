/**
 * Gateway provider 表——单一来源（ADR-0005）。
 *
 * - 每行声明：OpenAI 兼容 chat completions endpoint / key / model / 支持任务 /
 *   每任务排序号 / 最小间隔 / 429 冷却 / 任务专属参数。
 * - 无 key 的行自动跳过（.env 补 key 即扩容，零代码改动）。
 * - 排序号：小 = 该任务首选；顺序降级（2xx 赢，429/5xx 换下一家）。
 */

export type GatewayTask =
  | "chat"
  | "voice-intent"
  | "cluster"
  | "decompose"
  | "diagnose"
  | "judge";

export interface ProviderEntry {
  name: string;
  endpoint: string;
  apiKey: string;
  model: string;
  /** 该 provider 支持的任务（不声明即不参与路由）。 */
  tasks: GatewayTask[];
  /** 每任务优先级序号（小 = 优先）。 */
  ordering: Partial<Record<GatewayTask, number>>;
  /** per-provider 最小请求间隔（串行化后仍守此间隔）。 */
  minGapMs: number;
  /** 429 连续失败后的冷却期；冷却中跳过本轮。 */
  cooldownMs: number;
  /** 任务专属 body 参数（如智谱 hybrid-thinking 禁用）。 */
  extraBody?: Record<string, unknown>;
}

/**
 * 表内容惰性求值（每次调用读真实 env）：避免模块顶层快照固化 key，
 * 保证测试可注入 env 与开发热重载生效。
 */
export function allProviders(): ProviderEntry[] {
  const env = process.env;
  return [
    {
      name: "gemini",
      endpoint:
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      apiKey: env.GEMINI_API_KEY ?? "",
      model: env.GEMINI_MODEL ?? "gemini-2.5-flash",
      tasks: ["chat", "voice-intent", "cluster", "decompose", "diagnose", "judge"],
      ordering: {
        chat: 0,
        "voice-intent": 1,
        cluster: 1,
        decompose: 1,
        diagnose: 1,
        judge: 0,
      },
      minGapMs: 900,
      cooldownMs: 30_000,
    },
    {
      name: "zhipu",
      endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      apiKey: env.ZHIPU_API_KEY ?? "",
      model: env.ZHIPU_MODEL ?? "glm-4.7-flash",
      tasks: ["chat", "voice-intent", "cluster", "decompose", "diagnose", "judge"],
      ordering: {
        chat: 1,
        "voice-intent": 0,
        cluster: 0,
        decompose: 0,
        diagnose: 0,
        judge: 1,
      },
      minGapMs: 900,
      cooldownMs: 15_000,
      // GLM-4.7-Flash hybrid thinking：禁用后最终答案直接落 content，
      // 非流式回复不回空 content（结构化提取 JSON 稳定关键）。
      extraBody: { thinking: { type: "disabled" } },
    },
    {
      name: "qwen",
      endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      apiKey: env.DASHSCOPE_API_KEY ?? "",
      model: env.QWEN_MODEL ?? "qwen-plus",
      tasks: ["chat"],
      ordering: { chat: 2 },
      minGapMs: 900,
      cooldownMs: 15_000,
    },
    {
      name: "groq",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: env.GROQ_API_KEY ?? "",
      model: env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      tasks: ["chat", "voice-intent", "cluster", "decompose", "diagnose", "judge"],
      ordering: {
        chat: 3,
        "voice-intent": 2,
        cluster: 2,
        decompose: 2,
        diagnose: 2,
        judge: 2,
      },
      minGapMs: 450,
      cooldownMs: 15_000,
    },
    // ── 主模型扩展（任务隔离：仅 chat，避免污染 voice-intent 等小模型链路） ──
    {
      name: "deepseek",
      endpoint: `${(env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1").replace(/\/+$/, "")}/chat/completions`,
      apiKey: env.DEEPSEEK_API_KEY ?? "",
      model: env.DEEPSEEK_MODEL ?? env.DEEPSEEK_CHAT_MODEL ?? "deepseek-chat",
      tasks: ["chat"],
      ordering: { chat: 4 },
      minGapMs: 900,
      cooldownMs: 15_000,
    },
    {
      name: "kimi",
      endpoint: `${(env.KIMI_BASE_URL ?? env.MOONSHOT_BASE_URL ?? "https://api.moonshot.cn/v1").replace(/\/+$/, "")}/chat/completions`,
      apiKey: env.KIMI_API_KEY ?? env.MOONSHOT_API_KEY ?? "",
      model: env.KIMI_MODEL ?? env.MOONSHOT_MODEL ?? "moonshot-v1-32k",
      tasks: ["chat"],
      ordering: { chat: 5 },
      minGapMs: 900,
      cooldownMs: 15_000,
    },
    {
      name: "openrouter",
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: env.OPENROUTER_API_KEY ?? "",
      model: env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free",
      tasks: ["chat", "voice-intent", "cluster", "decompose", "diagnose", "judge"],
      ordering: {
        chat: 99,
        "voice-intent": 99,
        cluster: 99,
        decompose: 99,
        diagnose: 99,
        judge: 99,
      },
      minGapMs: 900,
      cooldownMs: 30_000,
    },
  ];
}

/** 判定 key 为有效（非空、非 placeholder/示例占位、非纯空白）。 */
export function isValidKey(v?: string): boolean {
  return !!v && !v.includes("placeholder") && !v.includes("your_") && v.trim() !== ""
}

/** 某任务激活的 provider 链（有有效 key + 支持该任务，按排序号升序）。 */
export function activeProviders(task: GatewayTask): ProviderEntry[] {
  return allProviders()
    .filter(
      (p) => isValidKey(p.apiKey) && p.tasks.includes(task) && p.ordering[task] !== undefined
    )
    .sort((a, b) => (a.ordering[task] ?? 99) - (b.ordering[task] ?? 99));
}

/** provider 是否带任务专属参数（构建请求 body 用）。 */
export function extraBodyFor(name: string): Record<string, unknown> {
  return allProviders().find((p) => p.name === name)?.extraBody ?? {};
}

export const CHAT_TEMPERATURE = 0.4;
export const JSON_TEMPERATURE = 0.1;
