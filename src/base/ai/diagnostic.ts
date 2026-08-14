/**
 * S2 AI 主动诊断 (diagnostic) — why a signal wave is getting no takers.
 *
 * Trigger: an active wave with ZERO claims, published ≥ 2 minutes ago.
 * The demander sees actionable advice instead of silence. The server
 * (/api/diagnose) may replace this with an LLM pass; this module stays the
 * deterministic mock fallback + the shared advice model.
 *
 * Pure + unit-testable; no runtime imports.
 */

export type DiagnosisKind =
  /** Price is below the suggested ladder → raise the budget. */
  | "price"
  /** No customs / generic category → add custom conditions to stand out. */
  | "customs"
  /** Coverage radius is tight → widen the search radius. */
  | "radius";

export interface DiagnosisAdvice {
  id: string;
  kind: DiagnosisKind;
  title: string;
  body: string;
  /** Suggested concrete value so the advice is actionable, not a slogan. */
  value?: string;
}

export interface DiagnoseWave {
  id: string;
  budget: number;
  basics: { category: string; radiusKm: number };
  customs?: Array<{ text: string }>;
  negotiable?: boolean;
  capacity?: number;
  createdAt: number;
}

/** Age (ms) after publish before a zero-response wave becomes "diagnosable". */
export const DIAGNOSE_AFTER_MS = 2 * 60 * 1000;

/** How far (km) the demander is already covering — advice widens beyond it. */
const COMFORT_RADIUS_KM = 5;
/** Customs under this count → the wave reads as "too vague" to responders. */
const VAGUE_CUSTOMS = 0;

/**
 * Deterministic diagnosis (mock path; server LLM may refine the wording).
 * Empty when the wave is too fresh or already has takers — the caller gates.
 */
export function mockDiagnose(
  wave: DiagnoseWave,
  now = Date.now()
): DiagnosisAdvice[] {
  if (wave.createdAt > now - DIAGNOSE_AFTER_MS) return [];
  const advice: DiagnosisAdvice[] = [];

  const customs = (wave.customs ?? []).filter((c) => c.text.trim());
  if (customs.length === VAGUE_CUSTOMS) {
    advice.push({
      id: `${wave.id}-customs`,
      kind: "customs",
      title: "需求太模糊，响应者不敢接",
      body: "补充 1-2 条定制条件（对象/场景/验收细节），命中率通常翻倍。",
      value: "补充定制条件",
    });
  }

  if (wave.basics.radiusKm < COMFORT_RADIUS_KM) {
    advice.push({
      id: `${wave.id}-radius`,
      kind: "radius",
      title: "搜寻半径偏小",
      body: `当前 ${wave.basics.radiusKm}km，多数响应者活跃在 ${COMFORT_RADIUS_KM}km 圈内。以你的品类，扩到 ${COMFORT_RADIUS_KM}km 成本最低。`,
      value: `扩到 ${COMFORT_RADIUS_KM}km`,
    });
  }

  // Price as the last resort — only when the demander is already doing
  // everything else right, so "加价" never crowds out concrete fixes.
  if (advice.length === 0) {
    advice.push({
      id: `${wave.id}-price`,
      kind: "price",
      title: "预算可上探一档",
      body: "同品类未被响应时，加价 20% 通常能跨过响应者的心理门槛。",
      value: "预算 +20%",
    });
  }

  return advice.slice(0, 3);
}