/**
 * 自然语言 BI（ADR-0011，缺口 N6）。
 * 本地规则解析中文统计查询 → 返回指标结果。零依赖纯函数，SSR 安全。
 * 模式：指标 + 范围的组合 → 结构化查询 → 聚合。
 * 指标：需求/成交/违约/收益/评价/裂变；范围：全部/本设备/我的/类目。
 */

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
    case "violations": value = `${n} 次`; break;
    case "disputes": value = `${n} 件`; break;
    case "revenue": value = `¥${filtered.reduce((s, r) => s + (r.amount ?? 0), 0)}`; break;
    case "reviews": value = n ? `${(filtered.reduce((s, r) => s + (r.reviewStar ?? 0), 0) / n).toFixed(1)} ★` : "—"; break;
    case "fission": value = `${filtered.reduce((s, r) => s + (r.fissionCount ?? 0), 0)} 次`; break;
  }
  return { metric: query.metric, label: METRIC_LABEL[query.metric], value, rows: n, since: sinceLabel };
}