/**
 * 任务分解（decompose）— turn a one-sentence demand into independent,
 * individually-acceptable task modules for complex services.
 *
 *   LLM step (server /api/decompose): split the demander's fuzzy request into
 *   2-N independent modules, each with a name, acceptance criteria and a
 *   suggested price weight (weights sum to 100%). The demander confirms /
 *   edits the module list; modules are locked once a responder claims the wave.
 *   Without a live LLM a deterministic mock splitter below is used.
 *
 * Pure + unit-testable; no runtime imports.
 */

export interface TaskModule {
  /** Human name, e.g. "粉刷墙壁". */
  name: string;
  /** Acceptance criteria text the demander confirms. */
  acceptance: string;
  /** Suggested price weight in % (0-100). Sum of all modules = 100. */
  weight: number;
}

export interface DecomposeResult {
  modules: TaskModule[];
  /** True when the split came from a live LLM, false on mock fallback. */
  source: "llm" | "mock";
}

/** Minimum modules for a "complex" (modularised) task. */
export const MIN_MODULES = 2;

/** Validate confirmed modules: 2+, unique names, weights sum to 100. */
export function normalizeModules(
  modules: TaskModule[]
): { ok: true; modules: TaskModule[] } | { ok: false; error: string } {
  if (!Array.isArray(modules) || modules.length < MIN_MODULES) {
    return { ok: false, error: `模块数至少 ${MIN_MODULES} 个` };
  }
  const names = new Set<string>();
  for (const m of modules) {
    if (!m.name || !m.name.trim()) return { ok: false, error: "模块名不能为空" };
    if (!m.acceptance || !m.acceptance.trim()) {
      return { ok: false, error: `模块「${m.name}」缺少验收标准` };
    }
    if (names.has(m.name.trim())) return { ok: false, error: `模块名重复：${m.name}` };
    names.add(m.name.trim());
    if (!Number.isFinite(m.weight) || m.weight < 0 || m.weight > 100) {
      return { ok: false, error: `模块「${m.name}」权重要在 0-100` };
    }
  }
  const total = Math.round(modules.reduce((s, m) => s + m.weight, 0));
  if (total !== 100) {
    return { ok: false, error: `模块权重之和必须为 100%（当前 ${total}%）` };
  }
  return { ok: true, modules: modules.map((m) => ({ ...m, weight: Math.round(m.weight) })) };
}

/** Equal-weight fallback when a mistake in the mock/LLM weights. */
export function equalWeights(count: number): TaskModule[] {
  const weight = Math.round(100 / count);
  const rest = 100 - weight * count;
  return Array.from({ length: count }, (_, i) => ({
    name: `模块 ${i + 1}`,
    acceptance: "待补充验收标准",
    weight: weight + (i < rest ? 1 : 0),
  }));
}

/** Money split per module from weights (fractions of `budget`). */
export function moduleAmounts(
  modules: TaskModule[],
  budget: number
): Array<{ name: string; amount: number }> {
  const weights = modules.map((m) => m.weight);
  let allocated = 0;
  const out = modules.map((m, i) => {
    const amount =
      i === modules.length - 1
        ? Math.max(0, budget - allocated)
        : Math.round((budget * m.weight) / 100);
    allocated += amount;
    return { name: m.name, amount };
  });
  return out;
}