/**
 * 准据法条静态库（秒仲裁 · 用户裁决：LLM 可依民法典断案，但只能引用本库条文）。
 *
 * 反幻觉铁律：prompt 要求模型引用法条时必须逐字匹配本库条文号＋要旨，
 * 无对应条文写"无直接对应条文，依公平原则"；严禁编造条文号。
 * 条文号与主题均取《民法典》现行有效条文（要旨为归纳非原文，引用时以号为准）；
 * 网上实时案例不采（不可复现/不可审计，违红线 1）——案例只吃库内 precedents 表。
 * Pure + unit-testable（零依赖）。
 */

export interface CivilCodeArticle {
  /** 条文号（唯一引用键，如 "577"）。 */
  code: string;
  /** 中文标题（如"第五百七十七条"）。 */
  title: string;
  /** 要旨归纳（非原文；LLM 引用时必须同时给出 code）。 */
  gist: string;
  /** 适用标签（供调用方按案由过滤展示，非强制）。 */
  applies: string[];
}

export const CIVIL_CODE_ARTICLES: readonly CivilCodeArticle[] = [
  { code: "509", title: "第五百零九条", gist: "全面履行：按约定全面履行（质量/数量/期限/地点方式）。", applies: ["履行", "质量"] },
  { code: "563", title: "第五百六十三条", gist: "解除：根本违约/迟延经催告不履行等可解除。", applies: ["解除", "根本违约"] },
  { code: "566", title: "第五百六十六条", gist: "解除后果：恢复原状/折价补偿/赔偿损失，已履行部分可结算。", applies: ["解除", "退款"] },
  { code: "577", title: "第五百七十七条", gist: "违约责任：不履行或不符合约定→继续履行/补救/赔偿。", applies: ["违约"] },
  { code: "578", title: "第五百七十八条", gist: "预期违约：明确表示不履行，对方可解除＋索赔。", applies: ["违约", "爽约"] },
  { code: "580", title: "第五百八十条", gist: "继续履行例外：事实上不能/标的不适/费用过高/期限未主张则免。", applies: ["履行", "退款"] },
  { code: "582", title: "第五百八十二条", gist: "瑕疵履行：可要求修理/重作/退货/减少价款。", applies: ["质量", "瑕疵"] },
  { code: "584", title: "第五百八十四条", gist: "损失赔偿范围：违约所致损失，含可预见利益，上限可预见。", applies: ["赔偿", "违约"] },
  { code: "585", title: "第五百八十五条", gist: "违约金：可约定；过分高于损失可请求调减。", applies: ["违约金", "赔偿"] },
  { code: "590", title: "第五百九十条", gist: "不可抗力：部分或全部免责，及时通知＋证明。", applies: ["不可抗力"] },
  { code: "591", title: "第五百九十一条", gist: "减损义务：须防损失扩大，否则扩大部分不赔。", applies: ["赔偿", "减损"] },
  { code: "592", title: "第五百九十二条", gist: "双方违约：各自承担相应责任。", applies: ["双方过错", "违约"] },
];

/** 条文号集合（prompt 校验与考卷锁定用）。 */
export const CIVIL_CODE_NUMBERS: readonly string[] = CIVIL_CODE_ARTICLES.map((a) => a.code);

/**
 *  prompt 准据法条块：LLM 只能引用下列条文号，否则写无对应。
 * 纯字符串装配（调用方直接拼进 system prompt）。
 */
export function civilCodePromptBlock(): string {
  const lines = CIVIL_CODE_ARTICLES.map((a) => `- 第${a.title}（${a.code}）：${a.gist}`);
  return [
    "准据法条（《民法典》，仅可引用下列条文号；无对应条文时写“无直接对应条文，依公平原则”，严禁编造条文号）：",
    ...lines,
  ].join("\n");
}

/** 库内先例引用（precedents 表行投影；空表即空引用，不伪造案例）。 */
export interface CitedPrecedent {
  summary: string;
  rulingPrinciple: string;
  binding: boolean;
}

/**
 * 按事由关键词与先例摘要取交集排序（确定性词袋交集，无向量依赖；
 * 无匹配/空库返回 []，prompt 段省略）。
 */
export function rankPrecedents(
  rows: Array<{ summary?: string; ruling_principle?: string; rulingPrinciple?: string; binding?: boolean }>,
  reason: string,
  limit = 3,
): CitedPrecedent[] {
  const tokens = new Set((reason.match(/[\u4e00-\u9fa5]{2,}/g) ?? []).flatMap((w) => {
    const out: string[] = [];
    for (let i = 0; i + 1 < w.length; i++) out.push(w.slice(i, i + 2));
    return out;
  }));
  if (tokens.size === 0) return [];
  const scored = rows.map((r) => {
    const text = `${r.summary ?? ""} ${r.ruling_principle ?? r.rulingPrinciple ?? ""}`;
    let score = 0;
    for (const t of tokens) if (text.includes(t)) score += 1;
    return { r, score };
  }).filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score || Number(b.r.binding ?? false) - Number(a.r.binding ?? false));
  return scored.slice(0, Math.max(0, limit)).map((s) => ({
    summary: String(s.r.summary ?? ""),
    rulingPrinciple: String(s.r.ruling_principle ?? s.r.rulingPrinciple ?? ""),
    binding: s.r.binding ?? false,
  }));
}

/** 先例 prompt 段（空即空串，调用方直接拼接）。 */
export function precedentsPromptBlock(cited: CitedPrecedent[]): string {
  if (cited.length === 0) return "";
  const lines = cited.map(
    (c, i) => `${i + 1}. ${c.summary} —— 裁决原则：${c.rulingPrinciple}${c.binding ? "（有约束力）" : ""}`,
  );
  return ["库内相关先例（仅供参照，效力低于准据法条）：", ...lines].join("\n");
}
