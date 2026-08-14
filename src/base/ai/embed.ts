/**
 * 语义向量匹配（ADR-0011，缺口 N3）。
 * 轻量中文向量：字粒度 bigram + 词频加权的 TF 向量 + 余弦相似度。
 * 零外部依赖（无 embedding API/数据库），纯函数可测，SSR 安全。
 * 用途：需求文本与候选项（需求/服务者/热门模板）的语义相关排序。
 */

/** 中文 + 英文小写分词器：去停用词，产出字 bigram（中文）令牌。 */
const STOP = new Set(["的", "了", "和", "与", "在", "是", "我", "你", "他", "她", "它", "们", "就", "都", "也", "很", "有", "要", "想", "让", "帮", "请", "吧", "吗", "呢"]);

export function tokenize(text: string): string[] {
  const norm = text.toLowerCase().trim();
  if (!norm) return [];
  const tokens: string[] = [];
  // 英文单词直接入
  for (const m of norm.matchAll(/[a-z][a-z0-9]*/g)) tokens.push(m[0]);
  // 中文字符序列切出 bigram（字粒度临近关系，比 uni-gram 更有语义分辨力）
  const cjk = norm.replace(/[^\u4e00-\u9fff]/g, "");
  for (let i = 0; i < cjk.length - 1; i++) {
    const bg = cjk.slice(i, i + 2);
    if (!STOP.has(bg)) tokens.push(bg);
  }
  // 长词保持单字兜底（bigram 边缘单字）
  return tokens;
}

export type Vec = Map<string, number>;

/** TF 向量：令牌 → 出现次数（含归一长度）。 */
export function vecOf(text: string): Vec {
  const m = new Map<string, number>();
  for (const t of tokenize(text)) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/** 余弦相似度 [0,1]。任一为空 → 0。 */
export function cosine(a: Vec, b: Vec): number {
  if (a.size === 0 || b.size === 0) return 0;
  let dot = 0;
  let a2 = 0;
  let b2 = 0;
  for (const [k, v] of a) {
    a2 += v * v;
    const bv = b.get(k);
    if (bv) dot += v * bv;
  }
  for (const v of b.values()) b2 += v * v;
  if (a2 === 0 || b2 === 0) return 0;
  return dot / (Math.sqrt(a2) * Math.sqrt(b2));
}

export interface SemCandidate {
  id: string;
  text: string;
  /** 预览用途（模板名/服务者标签等）。 */
  label?: string;
}

export interface SemMatch {
  candidate: SemCandidate;
  score: number;
}

/** 语义推荐：对候选列表按与 query 的余弦相似度降序，返回带分的排序结果。 */
export function recommend(query: string, candidates: SemCandidate[], topK = 3): SemMatch[] {
  const qv = vecOf(query);
  if (qv.size === 0) return [];
  return candidates
    .map((c) => ({ candidate: c, score: cosine(qv, vecOf(c.text)) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}