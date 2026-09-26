/**
 * 实名门禁纯核（P2-b 只做实名）：FULL＝手机戳＋三要素件＋人脸件＋系统 approved，
 * 四者缺一不可。存量宽限：GRACE_END 之前注册的老号放行（引导横幅另行），
 * 之后一律全门禁。Pure + unit-testable（nowMs 入参，零 DB/UI 依赖）。
 */

export interface VerificationProfile {
  verification_status?: string | null;
  phone_verified_at?: string | null;
  verification_id_number?: string | null;
  face_verified_at?: string | null;
  face_image_url?: string | null;
  created_at?: string | null;
}

/** 存量宽限截止（上线 2026-09-26＋30 天；过期全量全门禁）。 */
export const VERIFICATION_GRACE_START_MS = Date.parse("2026-09-26T00:00:00+08:00");
export const VERIFICATION_GRACE_END_MS = Date.parse("2026-10-26T00:00:00+08:00");

export interface VerificationStage {
  /** 手机已验证（SMS 打戳）。 */
  phone: boolean;
  /** 身份证已提交（三要素件在库）。 */
  id: boolean;
  /** 人脸已通过（vendor/系统直写）。 */
  face: boolean;
  /** 系统终态 approved。 */
  approved: boolean;
}

/** 四件分项（缺哪补哪，wizard 进度条数据源）。 */
export function verificationStageOf(p: VerificationProfile): VerificationStage {
  return {
    phone: p.phone_verified_at != null,
    id: p.verification_id_number != null,
    face: p.face_verified_at != null,
    approved: p.verification_status === "approved",
  };
}

/** FULL（发单/接单同一口径）：四件齐。 */
export function isVerificationFull(p: VerificationProfile): boolean {
  const s = verificationStageOf(p);
  return s.phone && s.id && s.face && s.approved;
}

/**
 * 门禁判定（含存量宽限）：宽限内老号 → { allowed: true, graced: true }（调用方挂引导）；
 * 其余 → FULL 才放行。accountCreatedAt 缺席按新号处理（fail-closed）。
 */
export function checkVerificationGate(
  p: VerificationProfile,
  nowMs: number = Date.now(),
): { allowed: boolean; graced: boolean; missing: string[] } {
  const s = verificationStageOf(p);
  const missing: string[] = [];
  if (!s.phone) missing.push("phone");
  if (!s.id) missing.push("id");
  if (!s.face) missing.push("face");
  if (!s.approved) missing.push("approved");
  if (missing.length === 0) return { allowed: true, graced: false, missing };
  const createdMs = p.created_at ? Date.parse(p.created_at) : NaN;
  if (
    Number.isFinite(createdMs) &&
    (createdMs as number) < VERIFICATION_GRACE_START_MS &&
    nowMs < VERIFICATION_GRACE_END_MS
  ) {
    return { allowed: true, graced: true, missing };
  }
  return { allowed: false, graced: false, missing };
}
