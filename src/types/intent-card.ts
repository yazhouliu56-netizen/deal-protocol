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

export type PriceBasis = "ammo-floor" | "quote" | "ladder";

export interface PriceAnchor {
  /** 锁价（发射后不变）。 */
  totalYuan: number;
  basis: PriceBasis;
  /** 高于同类均值 20% 时强制显示，如"同类均值¥75，你的¥80"。 */
  compareText?: string;
  /** 差价规则，一句话。 */
  changeRule: string;
  /** 退款条件，一句话。 */
  refundRule: string;
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
