/**
 * 意图卡契约（P1-T1）。母本：意图卡开工规格 v1.0 §1。
 * 后端组装、LLM 只填参不定形；PriceAnchor 三字段缺一不可发射。
 */

export type IntentLineSource = "user" | "ai" | "default";

export interface IntentLine {
  key: string;
  label: string;
  value: string;
  source: IntentLineSource;
  /** AI 行置信度 0-1；<0.6 为"AI·猜"，不许进价格计算。 */
  confidence?: number;
  editable: true;
}

export type PriceBasis = "ammo-floor" | "quote" | "ladder" | "range-quote" | "diagnosed";

/**
 * 确诊分支（ADR-0019）：上门确诊前由 LLM/定损建议、用户勾选其一。
 * totalYuan 为该分支封顶价（超支部分平台/师傅承担，不向用户加价）。
 */
export interface PriceBranch {
  id: string;
  label: string;
  totalYuan: number;
  /** 材料费区间（元），来自弹药配件库版本化价格，非 LLM 现编。 */
  materialRangeYuan?: [number, number];
  /** 人工难度分级（如 Level_1_Simple）。 */
  laborLevel?: string;
  /** 概率备注（如"高概率"）——仅派单参考，不进价格承诺。 */
  probabilityNote?: string;
}

/**
 * LLM 报价建议层（ADR-0019 规则①）：永远不得写入结算字段。
 * 结算只认 totalYuan（＋branches 非空时必须 selectedBranchId 命中）。
 */
export interface QuoteAdvice {
  summary: string;
  branches: PriceBranch[];
  at: number;
}

export interface PriceAnchor {
  /** 锁价（发射后不变）。区间卡 = 上限封顶价；分支确诊后 = 该分支价。 */
  totalYuan: number;
  basis: PriceBasis;
  /** 高于同类均值 20% 时强制显示，如"同类均值¥75，你的¥80"。 */
  compareText?: string;
  /** 差价规则，一句话。 */
  changeRule: string;
  /** 退款条件，一句话。 */
  refundRule: string;
  // ---- ADR-0019 区间锁价（全可选加法；缺省 = 历史单值行为，零回归） ----
  /** 区间下限（元）；与 ceilingYuan 成对出现。 */
  floorYuan?: number;
  /** 区间上限（元）= totalYuan（封顶承诺）。 */
  ceilingYuan?: number;
  /** 确诊分支清单（上门确诊前展示，确诊时用户勾选其一）。 */
  branches?: PriceBranch[];
  /** 已确诊分支 id（结算前必须命中 branches其一）。 */
  selectedBranchId?: string;
  /** LLM 建议层（展示用，结算永不读取）。 */
  advice?: QuoteAdvice;
}

export interface AssuranceBadge {
  key: string;
  label: string;
}

/** 服务者预览行（P2-T7）：撮合投影只读，非承诺；最多 3 条由调用方约束。 */
export interface ProviderPreview {
  name: string;
  trust: string;
  note?: string;
}

export type AiLevel = "high" | "mid" | "guess";

export interface AiMark {
  lineKey: string;
  level: AiLevel;
  reason: string;
}

export type IntentCardState = "assembling" | "ready" | "locked" | "stale";

export interface IntentCard {
  id: string;
  /** 弹药 ammoId＋快照版本号（防组装发射两张皮）。 */
  scene: { ammoId: string; version: number };
  title: string;
  lines: IntentLine[];
  price: PriceAnchor;
  assurance: AssuranceBadge[];
  /** 服务者预览（可选；渲染为非承诺预览行）。 */
  providerPreview?: ProviderPreview[];
  /** 不可逆点清单；为空卡不可发射。 */
  irreversible: string[];
  aiMarks: AiMark[];
  state: IntentCardState;
  /** ready 态 TTL（默认 15min），超时转 stale。 */
  expiresAt: number;
  traceId: string;
}
