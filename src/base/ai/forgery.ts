/**
 * AIGC 伪造鉴真（ADR-0012，缺口 N4）。
 * 检测伪造证据（假截图/假评价/假身份材料）：纯规则引擎 + 可接 LLM 复核。
 * 规则（轻量，本地可跑）：EXIF 缺失、文件名异常、内容指纹重复、
 * 时间戳矛盾、比例异常。LLM 复核为可选增强（gateway judge 类似降级链）。
 */

export type ForgeryCheck = {
  /** 0-100 疑点分。 */
  score: number;
  level: "clean" | "suspicious" | "highly-suspicious";
  hits: string[];
};

export interface EvidenceSample {
  /** 是否缺失 EXIF（AI 生成图常无 EXIF）。 */
  noExif: boolean;
  /** 文件名是否异常（如纯数字/无扩展名/ai 前缀）。 */
  oddName: boolean;
  /** 与既有证据的指纹重复（复用截图）。 */
  reused: boolean;
  /** 上传时间与声称时间矛盾。 */
  timeMismatch: boolean;
  /** 尺寸/比例异常（如 1024x1024 方图 AI 常见）。 */
  oddRatio: boolean;
}

const WEIGHTS: Record<keyof EvidenceSample, number> = {
  noExif: 25,
  oddName: 10,
  reused: 35,
  timeMismatch: 30,
  oddRatio: 10,
};

export function checkForgery(s: EvidenceSample): ForgeryCheck {
  const hits: string[] = [];
  let score = 0;
  const entries = Object.entries(s) as [keyof EvidenceSample, boolean][];
  for (const [k, v] of entries) {
    if (!v) continue;
    score += WEIGHTS[k];
    hits.push(k);
  }
  const level: ForgeryCheck["level"] = score >= 50 ? "highly-suspicious" : score >= 25 ? "suspicious" : "clean";
  return { score, level, hits };
}

/** 文本证据（评价/聊天）伪造成本低——仅做重复与异常信号。 */
export function checkTextEvidence(texts: string[]): ForgeryCheck {
  const uniq = new Set(texts);
  const reused = texts.length > 1 && uniq.size < texts.length;
  return checkForgery({ noExif: false, oddName: false, reused, timeMismatch: false, oddRatio: false });
}

/**
 * LLM 复核降级链（宪法 #10）：提供外部复核函数（或 null），
 * 超时/失败/无外部时回落到规则分；外部复核返回 -1..1 置信，加权进分。
 */
export function withLlmReview(
  rule: ForgeryCheck,
  llmScore: number | null
): ForgeryCheck {
  if (llmScore === null) return rule;
  const final = Math.max(0, Math.min(100, Math.round(rule.score * 0.6 + (1 - llmScore) * 40)));
  const level: ForgeryCheck["level"] = final >= 50 ? "highly-suspicious" : final >= 25 ? "suspicious" : "clean";
  return { ...rule, score: final, level };
}