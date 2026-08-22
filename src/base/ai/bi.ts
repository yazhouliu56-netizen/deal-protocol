/**
 * 自然语言 BI（ADR-0011，缺口 N6；P2 战役升级：L3-M5 对话式数据 BI 闭环）。
 *
 * 双链架构（红线 1 隔离墙与确定性降级）：
 *   ① 确定性核心链 —— 意图分类（正则封闭域）/ 时间范围提取 / 聚合计算 /
 *      图表载荷装配全部为纯函数，零外部依赖、SSR 安全、结果可复现；
 *   ② LLM 增强链 —— 5-provider Gateway（task: diagnose 顺序降级）仅用于
 *      summary 归因诊断的文案增强；任何网络异常 / 无 key / 非 JSON 回复
 *      一律静默降级为规则生成摘要（100% 兜底，绝不抛未捕获异常）。
 *
*  数据结构守恒：chartData 数值全部来自输入行聚合（金额以「分」为单位的
 * 原始数值直接聚合，费率估算是显式口径并在 summary 注明），类型安全。
 */

/* ═══════════════ 既有契约（保持兼容，勿删勿改） ═══════════════ */

export type BiMetric = "waves" | "claims" | "violations" | "revenue" | "reviews" | "fission" | "disputes";

export interface BiRow {
  authorId: string;
  category: string;
  createdAt: number;
  /** 成交额（用于收益聚合）。 */
  amount?: number;
  violation?: boolean;
  reviewStar?: number;
  fissionCount?: number;
}

export interface BiQuery {
  metric: BiMetric;
  category?: string;
  since?: number;
  top?: number;
  raw: string;
}

export function parseBiQuery(text: string): BiQuery {
  const t = text.toLowerCase();
  const metric: BiMetric = t.includes("违约") ? "violations"
    : t.includes("收益") || t.includes("收入") || t.includes("流水") ? "revenue"
    : t.includes("评价") || t.includes("评分") ? "reviews"
    : t.includes("裂变") ? "fission"
    : t.includes("争议") ? "disputes"
    : t.includes("成交") || t.includes("订单") ? "claims"
    : "waves";
  const catMatch = t.match(/类目[（(]?([\u4e00-\u9fff]+?)[）)的]/);
  const topMatch = t.match(/top\s*(\d+)/) ?? t.match(/前(\d+)/);
  return {
    metric,
    category: catMatch?.[1],
    top: topMatch ? Number(topMatch[1]) : undefined,
    raw: text,
  };
}

export interface BiResult {
  metric: BiMetric;
  label: string;
  value: string;
  rows: number;
  since: string;
}

const METRIC_LABEL: Record<BiMetric, string> = {
  waves: "需求数",
  claims: "成交数",
  violations: "违约数",
  revenue: "成交额",
  reviews: "平均评分",
  fission: "裂变数",
  disputes: "争议数",
};

/** 按查询执行聚合（简化：输入行已是本设备的语义范围）。 */
export function runBi(query: BiQuery, rows: BiRow[], now: number): BiResult {
  const since = query.since ?? rows.reduce((min, r) => Math.min(min, r.createdAt), now);
  const filtered = rows.filter(
    (r) => r.createdAt >= since && (!query.category || r.category === query.category)
  );
  const n = filtered.length;
  const sinceLabel = query.since
    ? `近 ${Math.max(1, Math.round((now - query.since) / (24 * 3600_000)))} 天`
    : "全部时间";

  let value = "";
  switch (query.metric) {
    case "waves": value = `${n} 条`; break;
    case "claims": value = `${n} 单`; break;
    case "violations": {
      const violations = filtered.filter((r) => r.violation).length;
      value = `${violations} 次`;
      return { metric: query.metric, label: METRIC_LABEL[query.metric], value, rows: violations, since: sinceLabel };
    }
    case "disputes": value = `${n} 件`; break;
    case "revenue": value = `¥${filtered.reduce((s, r) => s + (r.amount ?? 0), 0)}`; break;
    case "reviews": value = n ? `${(filtered.reduce((s, r) => s + (r.reviewStar ?? 0), 0) / n).toFixed(1)} ★` : "—"; break;
    case "fission": value = `${filtered.reduce((s, r) => s + (r.fissionCount ?? 0), 0)} 次`; break;
  }
  return { metric: query.metric, label: METRIC_LABEL[query.metric], value, rows: n, since: sinceLabel };
}

/* ═══════════════ P2 对话式 BI 报表契约（L3-M5） ═══════════════ */

/** 报表指标卡。trend: 与区间前半段相比的走向；changePercent: 环比百分差。 */
export interface IBiMetric {
  key: string;
  label: string;
  value: string | number;
  trend?: "UP" | "DOWN" | "FLAT";
  changePercent?: number;
}

/** 标准报表载荷：AI 归因诊断 + KPI 指标卡 + 图表渲染数据 + 追问引导。 */
export interface IBiReportPayload {
  query: string;
  title: string;
  /** AI 归因诊断结论（规则确定性生成；LLM 增强成功时替换为增强版）。 */
  summary: string;
  timeRange: { start: string; end: string };
  metrics: IBiMetric[];
  chartType: "BAR" | "LINE" | "PIE" | "TABLE";
  chartData: Array<{ label: string; value: number; secondaryValue?: number; extra?: string }>;
  suggestedFollowUps: string[];
}

/** 对话式 BI 数据上下文（服务端组装传入；行级真实字段）。 */
export interface BiContractRow {
  category: string;
  /** 成交金额（元）。 */
  amount: number;
  /** 创建时间戳（ms）。 */
  createdAt: number;
  fundStatus?: string;
  violation?: boolean;
  /** 平台佣金（元）；缺省按 amount × 0.15 估算（口径在 summary 注明）。 */
  platformFeeYuan?: number;
  /** 保险计提（元）；缺省按 amount × 0.05 估算（口径在 summary 注明）。 */
  insuranceYuan?: number;
}

export interface BiRawDataContext {
  contracts: BiContractRow[];
  now?: number;
}

/** 默认分账口径（估算标注用；与实际分账表独立）。 */
export const DEFAULT_PLATFORM_FEE_RATIO = 0.15;
export const DEFAULT_INSURANCE_RATIO = 0.05;

type BiIntent = "category-violation" | "funding-trend" | "provider-credit" | "overview";

const FOLLOWUPS: Record<BiIntent, string[]> = {
  "category-violation": [
    "各品类违约率与退款分布",
    "分析近30天平台佣金与保险计提走势",
    "服务者履约与信用评分分析",
  ],
  "funding-trend": [
    "分析近30天平台佣金与保险计提走势",
    "各品类违约率与退款分布",
    "高频客诉归因诊断",
  ],
  "provider-credit": [
    "服务者履约与信用评分分析",
    "各品类违约率与退款分布",
    "分析近30天平台佣金与保险计提走势",
  ],
  overview: [
    "各品类违约率与退款分布",
    "分析近30天平台佣金与保险计提走势",
    "服务者履约与信用评分分析",
  ],
};

/** 意图分类（确定性封闭域正则）。 */
export function classifyBiIntent(query: string): BiIntent {
  const t = query.toLowerCase();
  if (/(违约|客诉|退款|投诉|品类|分布)/.test(t)) return "category-violation";
  if (/(佣金|保险|计提|分账|gmv|流水|收入|资金|走势|金额)/.test(t)) return "funding-trend";
  if (/(服务者|阿姨|师傅|信用|评分|履约|评分分析)/.test(t)) return "provider-credit";
  return "overview";
}

/** 时间范围提取：近 N 天 / 无 → 全量（min createdAt..now）。 */
export function extractBiTimeRange(query: string, ctx: BiRawDataContext): { start: number; end: number } {
  const now = ctx.now ?? Date.now();
  const daysMatch = query.match(/近\s*(\d+)\s*天/);
  if (daysMatch) {
    const days = Number(daysMatch[1]);
    return { start: now - days * 24 * 3600_000, end: now };
  }
  const min = ctx.contracts.reduce((m, r) => Math.min(m, r.createdAt), now);
  return { start: min, end: now };
}

/** 按天分桶（key: yyyy-mm-dd）。 */
function bucketByDay(rows: BiContractRow[]): Map<string, BiContractRow[]> {
  const map = new Map<string, BiContractRow[]>();
  for (const r of rows) {
    const d = new Date(r.createdAt).toISOString().slice(0, 10);
    const list = map.get(d) ?? [];
    list.push(r);
    map.set(d, list);
  }
  return map;
}

function fmtYuan(v: number): string {
  return `¥${v.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function pct(numer: number, denom: number): number {
  return denom <= 0 ? 0 : Math.round((numer / denom) * 10000) / 100;
}

/** 区间前后半段环比（后半 - 前半，%）；数据不足 2 桶时返回 undefined。 */
function trendBetween(first: number[], second: number[]): { trend: "UP" | "DOWN" | "FLAT"; changePercent: number } | undefined {
  const a = first.reduce((s, x) => s + x, 0);
  const b = second.reduce((s, x) => s + x, 0);
  if (first.length === 0 || second.length === 0) return undefined;
  if (a <= 0 && b <= 0) return { trend: "FLAT", changePercent: 0 };
  const change = a <= 0 ? 100 : Math.round(((b - a) / a) * 10000) / 100;
  const trend = change > 1 ? "UP" : change < -1 ? "DOWN" : "FLAT";
  return { trend, changePercent: change };
}

/* ═══════════════ 意图聚合（确定性核心链） ═══════════════ */

interface AggregateResult {
  metrics: IBiMetric[];
  chartType: IBiReportPayload["chartType"];
  chartData: IBiReportPayload["chartData"];
  title: string;
  summary: string;
}

/** 品类违约 / 退款分布。 */
function aggregateCategoryViolation(rows: BiContractRow[]): AggregateResult {
  const byCat = new Map<string, { total: number; violations: number; amount: number }>();
  for (const r of rows) {
    const g = byCat.get(r.category) ?? { total: 0, violations: 0, amount: 0 };
    g.total += 1;
    g.amount += r.amount;
    if (r.violation) g.violations += 1;
    byCat.set(r.category, g);
  }
  const cats = [...byCat.keys()].sort();
  const total = rows.length;
  const totalViolations = rows.filter((r) => r.violation).length;
  const overallRate = pct(totalViolations, total);

  const chartData = cats.map((c) => {
    const g = byCat.get(c)!;
    return {
      label: c,
      value: g.violations,
      secondaryValue: g.total,
      extra: `${pct(g.violations, g.total)}%`,
    };
  });

  const top = chartData.slice().sort((a, b) => (b.secondaryValue ?? 0) - (a.secondaryValue ?? 0))[0];
  let summary = `全部 ${total} 单中违约 ${totalViolations} 单，整体违约率 ${overallRate}%。`;
  if (top && (top.secondaryValue ?? 0) > 0) {
    const topRate = pct(top.value, top.secondaryValue ?? 0);
    summary += `归因：${top.label} 类单量最大（${top.secondaryValue} 单，违约率 ${topRate}%${topRate > overallRate ? "，高于整体，建议优先排查该类目履约流程与验收标准" : "，低于整体，履约质量稳定"}）。`;
  }

  return {
    title: "各品类违约率与退款分布",
    metrics: [
      { key: "violation_rate", label: "整体违约率", value: `${overallRate}%`, trend: overallRate > 5 ? "UP" : "FLAT" },
      { key: "violations", label: "违约单数", value: totalViolations },
      { key: "total", label: "订单总数", value: total },
      { key: "amount", label: "涉及金额", value: fmtYuan(rows.filter((r) => r.violation).reduce((s, r) => s + r.amount, 0)) },
    ],
    chartType: "BAR",
    chartData,
    summary,
  };
}

/** 资金 / 分账走势（GMV / 平台佣金 / 保险计提）。 */
function aggregateFundingTrend(rows: BiContractRow[], dayBuckets: Map<string, BiContractRow[]>): AggregateResult {
  const days = [...dayBuckets.keys()].sort();
  const gmvByDay: number[] = [];
  const feeByDay: number[] = [];
  const insByDay: number[] = [];
  const chartData: IBiReportPayload["chartData"] = [];
  for (const d of days) {
    const list = dayBuckets.get(d)!;
    const gmv = list.reduce((s, r) => s + r.amount, 0);
    const fee = list.reduce((s, r) => s + (r.platformFeeYuan ?? Math.round(r.amount * DEFAULT_PLATFORM_FEE_RATIO * 100) / 100), 0);
    const ins = list.reduce((s, r) => s + (r.insuranceYuan ?? Math.round(r.amount * DEFAULT_INSURANCE_RATIO * 100) / 100), 0);
    gmvByDay.push(gmv);
    feeByDay.push(fee);
    insByDay.push(ins);
    chartData.push({ label: d.slice(5), value: Math.round(gmv * 100) / 100, secondaryValue: Math.round(fee * 100) / 100, extra: `${Math.round(ins * 100) / 100} 元` });
  }
  const totalGmv = gmvByDay.reduce((s, x) => s + x, 0);
  const totalFee = feeByDay.reduce((s, x) => s + x, 0);
  const totalIns = insByDay.reduce((s, x) => s + x, 0);
  const half = Math.floor(gmvByDay.length / 2);
  const trend = trendBetween(gmvByDay.slice(0, half), gmvByDay.slice(half));

  let summary = `区间内 GMV 合计 ${fmtYuan(totalGmv)}，平台佣金估算 ${fmtYuan(totalFee)}（按 ${DEFAULT_PLATFORM_FEE_RATIO * 100}% 口径），保险计提估算 ${fmtYuan(totalIns)}（按 ${DEFAULT_INSURANCE_RATIO * 100}% 口径）。`;
  if (days.length > 0) {
    const peak = chartData.reduce((a, b) => (b.value > a.value ? b : a), chartData[0]);
    const avg = Math.round((totalGmv / days.length) * 100) / 100;
    summary += `归因：${peak.label} 为 GMV 峰值日（${fmtYuan(peak.value)}），日均 ${fmtYuan(avg)}；${trend ? `后段较前段 ${trend.trend === "UP" ? "上升" : trend.trend === "DOWN" ? "回落" : "持平"} ${Math.abs(trend.changePercent)}%。` : ""}`;
  }

  return {
    title: "近30天平台佣金与保险计提走势",
    metrics: [
      { key: "gmv", label: "总 GMV", value: fmtYuan(totalGmv), trend: trend?.trend, changePercent: trend?.changePercent },
      { key: "platform_fee", label: "平台佣金（估算）", value: fmtYuan(totalFee) },
      { key: "insurance", label: "保险计提（估算）", value: fmtYuan(totalIns) },
      { key: "orders", label: "订单数", value: rows.length },
    ],
    chartType: "LINE",
    chartData,
    summary,
  };
}

/** 服务者履约 / 信用分析（近似：按品类聚合履约指标）。 */
function aggregateProviderCredit(rows: BiContractRow[]): AggregateResult {
  const byCat = new Map<string, { completed: number; violations: number; amount: number }>();
  for (const r of rows) {
    const g = byCat.get(r.category) ?? { completed: 0, violations: 0, amount: 0 };
    if (r.fundStatus === "COMPLETED") g.completed += 1;
    if (r.violation) g.violations += 1;
    g.amount += r.amount;
    byCat.set(r.category, g);
  }
  const cats = [...byCat.keys()].sort();
  const total = rows.length;
  const completed = rows.filter((r) => r.fundStatus === "COMPLETED").length;
  const violations = rows.filter((r) => r.violation).length;
  const chartData = cats.map((c) => {
    const g = byCat.get(c)!;
    return { label: c, value: g.completed, secondaryValue: g.violations, extra: `${pct(g.violations, rows.filter((r) => r.category === c).length)}%` };
  });

  const worst = chartData.slice().sort((a, b) => (b.secondaryValue ?? 0) - (a.secondaryValue ?? 0))[0];
  let summary = `服务者履约透视：完成 ${completed} 单 / ${total} 单（完成率 ${pct(completed, total)}%），违约 ${violations} 单。`;
  if (worst && (worst.secondaryValue ?? 0) > 0) {
    summary += `归因：${worst.label} 类服务者违约 ${worst.secondaryValue} 单最高，建议对该品类服务者做履约健康度复核与信用分重评。`;
  } else {
    summary += "归因：各品类违约均为 0，服务者信用画像整体健康。";
  }

  return {
    title: "服务者履约与信用评分分析",
    metrics: [
      { key: "completed", label: "完成单数", value: completed },
      { key: "completion_rate", label: "完成率", value: `${pct(completed, total)}%` },
      { key: "violations", label: "违约单数", value: violations },
      { key: "avg_amount", label: "平均单额", value: total ? fmtYuan(Math.round((rows.reduce((s, r) => s + r.amount, 0) / total) * 100) / 100) : "—" },
    ],
    chartType: "TABLE",
    chartData,
    summary,
  };
}

/** 兜底：全局运营概览。 */
function aggregateOverview(rows: BiContractRow[]): AggregateResult {
  const total = rows.length;
  const gmv = rows.reduce((s, r) => s + r.amount, 0);
  const violations = rows.filter((r) => r.violation).length;
  const completed = rows.filter((r) => r.fundStatus === "COMPLETED").length;
  const byCat = new Map<string, number>();
  for (const r of rows) byCat.set(r.category, (byCat.get(r.category) ?? 0) + 1);
  const chartData = [...byCat.keys()].sort().map((c) => ({
    label: c,
    value: byCat.get(c)!,
    secondaryValue: undefined as number | undefined,
    extra: `${pct(byCat.get(c)!, total)}%`,
  }));

  return {
    title: "全局运营概览",
    metrics: [
      { key: "total", label: "订单总数", value: total },
      { key: "gmv", label: "总 GMV", value: fmtYuan(gmv) },
      { key: "violation_rate", label: "违约率", value: `${pct(violations, total)}%` },
      { key: "completion_rate", label: "完成率", value: `${pct(completed, total)}%` },
    ],
    chartType: "TABLE",
    chartData,
    summary: `全局概览：共 ${total} 单、GMV ${fmtYuan(gmv)}、违约率 ${pct(violations, total)}%、完成率 ${pct(completed, total)}%。归因：按品类单量排序 ${chartData.map((c) => `${c.label} ${c.value} 单`).join("、") || "暂无数据"}。`,
  };
}

/* ═══════════════ LLM 增强链（5-provider Gateway，静默降级） ═══════════════ */

/** 归因诊断 LLM 增强：成功返回诊断文本；任何失败返回 null（走规则摘要）。
 *  动态 import Gateway（node:test 离线环境无 @/ 别名解析 → 抛错被吞 → 规则兜底；
 *  生产环境正常加载 5-provider 链）。 */
async function tryLlmDiagnosis(
  query: string,
  payload: IBiReportPayload
): Promise<string | null> {
  try {
    const { completeText } = await import("./gateway/engine.ts");
    const outcome = await completeText({
      task: "diagnose",
      timeoutMs: 6000,
      messages: [
        {
          role: "system",
          content:
            "你是运营数据 BI 归因分析师。根据给定的指标与图表数据，用一句话（≤120 字）输出运营归因诊断结论，只输出 JSON：{\"summary\":\"诊断结论\"}",
        },
        {
          role: "user",
          content: JSON.stringify({
            query,
            title: payload.title,
            metrics: payload.metrics,
            chartData: payload.chartData.slice(0, 30),
            timeRange: payload.timeRange,
          }),
        },
      ],
    });
    if (!outcome.ok || !outcome.content) return null;
    const cleaned = outcome.content.replace(/```(?:json)?/g, "").trim();
    const parsed = JSON.parse(cleaned) as { summary?: unknown };
    if (typeof parsed?.summary !== "string" || parsed.summary.length === 0) return null;
    return parsed.summary.slice(0, 200);
  } catch {
    return null;
  }
}

/* ═══════════════ 主入口 ═══════════════ */

/**
 * 对话式 BI 查询主入口（P2 · L3-M5）：
 * 确定性核心链 100% 产出结构化报表，LLM 归因诊断作为可选增强（失败静默降级）。
 * 任何输入都不会抛异常——无法识别意图时输出全局运营概览兜底报表。
 */
export async function parseConversationalBiQuery(
  query: string,
  rawData?: BiRawDataContext
): Promise<IBiReportPayload> {
  const ctx: BiRawDataContext = rawData ?? { contracts: [] };
  const intent = classifyBiIntent(query);
  const range = extractBiTimeRange(query, ctx);
  const inRange = ctx.contracts.filter((r) => r.createdAt >= range.start && r.createdAt <= range.end);

  let agg: AggregateResult;
  if (intent === "category-violation") agg = aggregateCategoryViolation(inRange);
  else if (intent === "funding-trend") agg = aggregateFundingTrend(inRange, bucketByDay(inRange));
  else if (intent === "provider-credit") agg = aggregateProviderCredit(inRange);
  else agg = aggregateOverview(inRange);

  const payload: IBiReportPayload = {
    query,
    title: agg.title,
    summary: agg.summary,
    timeRange: { start: new Date(range.start).toISOString(), end: new Date(range.end).toISOString() },
    metrics: agg.metrics,
    chartType: agg.chartType,
    chartData: agg.chartData,
    suggestedFollowUps: FOLLOWUPS[intent],
  };

  const llmSummary = await tryLlmDiagnosis(query, payload);
  if (llmSummary) payload.summary = llmSummary;
  return payload;
}

/** 同步确定性入口（无 LLM 依赖，测试与离线环境使用）。 */
export function parseConversationalBiQuerySync(
  query: string,
  rawData?: BiRawDataContext
): IBiReportPayload {
  const ctx: BiRawDataContext = rawData ?? { contracts: [] };
  const intent = classifyBiIntent(query);
  const range = extractBiTimeRange(query, ctx);
  const inRange = ctx.contracts.filter((r) => r.createdAt >= range.start && r.createdAt <= range.end);
  if (intent === "category-violation") return { query, ...aggregateCategoryViolation(inRange), timeRange: { start: new Date(range.start).toISOString(), end: new Date(range.end).toISOString() }, suggestedFollowUps: FOLLOWUPS[intent] };
  if (intent === "funding-trend") return { query, ...aggregateFundingTrend(inRange, bucketByDay(inRange)), timeRange: { start: new Date(range.start).toISOString(), end: new Date(range.end).toISOString() }, suggestedFollowUps: FOLLOWUPS[intent] };
  if (intent === "provider-credit") return { query, ...aggregateProviderCredit(inRange), timeRange: { start: new Date(range.start).toISOString(), end: new Date(range.end).toISOString() }, suggestedFollowUps: FOLLOWUPS[intent] };
  return { query, ...aggregateOverview(inRange), timeRange: { start: new Date(range.start).toISOString(), end: new Date(range.end).toISOString() }, suggestedFollowUps: FOLLOWUPS[intent] };
}
