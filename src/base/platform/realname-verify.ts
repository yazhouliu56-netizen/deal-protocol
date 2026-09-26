/**
 * 实名核验厂商适配层（P2-b 只做实名 · 用户裁决 2026-09-26：全自动，零人工审核）。
 *
 * 双通道：
 * - vendor：真厂商（阿里云/腾讯云实名＋人脸核身，商务定 juniors；需 REALNAME_* key，
 *   缺席自动回落 Mock 并留痕，永不抛错）。
 * - mock：确定性本地判定（红线 1：同输入同输出；红线 5：无 key/断网可测）——
 *   三要素走 15/18 位格式＋非空；人脸走非空照片引用。Mock 只验格式不验真，
 *   开发/单测通道；生产必须配 vendor key（缺 key 即降级，门禁侧 fail-closed）。
 *
 * Pure + unit-testable（传输注入式，缺省 Mock；零 Supabase/UI 依赖）。
 */

export interface RealnameCheckInput {
  realName: string;
  idNumber: string;
  phone: string;
}

export interface FaceCheckInput {
  /** 人脸采集照引用（URL 或存储 key，非空即进入判定）。 */
  imageRef: string;
}

export interface RealnameVerdict {
  ok: boolean;
  /** mock | vendor:vendor 名（mock 命中即开发通道，调用方按需留痕）。 */
  provider: string;
  reason?: string;
}

export type ThreeElementsFn = (input: RealnameCheckInput) => Promise<RealnameVerdict>;
export type FaceLivenessFn = (input: FaceCheckInput) => Promise<RealnameVerdict>;

const ID_PATTERN = /(^\d{15}$)|(^\d{17}[\dXx]$)/;
const PHONE_PATTERN = /^1[3-9]\d{9}$/;

/** Mock 三要素：格式全对即过（不验真；验真走 vendor）。 */
export async function mockThreeElements(input: RealnameCheckInput): Promise<RealnameVerdict> {
  if (!input.realName || input.realName.trim().length < 2) {
    return { ok: false, provider: "mock", reason: "姓名非法" };
  }
  if (!ID_PATTERN.test(input.idNumber.trim())) {
    return { ok: false, provider: "mock", reason: "身份证号格式非法" };
  }
  if (!PHONE_PATTERN.test(input.phone.trim())) {
    return { ok: false, provider: "mock", reason: "手机号格式非法" };
  }
  return { ok: true, provider: "mock" };
}

/** Mock 活体：非空照片引用即过（不辨真伪；真活体走 vendor）。 */
export async function mockFaceLiveness(input: FaceCheckInput): Promise<RealnameVerdict> {
  if (!input.imageRef || !input.imageRef.trim()) {
    return { ok: false, provider: "mock", reason: "人脸照片缺失" };
  }
  return { ok: true, provider: "mock" };
}

/**
 * 真厂商通道（E 组占位）：有 REALNAME_API_KEY 才调，未接通一律回落 Mock
 * （调用方以 provider 区分留痕；缺 key 生产降级由门禁 fail-closed 承接）。
 */
async function vendorThreeElements(input: RealnameCheckInput): Promise<RealnameVerdict | null> {
  if (!process.env.REALNAME_API_KEY) return null;
  // TODO(vendor): 接入阿里云/腾讯云三要素 API（商务＋合规定 juniors 后落地）。
  void input;
  return null;
}

async function vendorFaceLiveness(input: FaceCheckInput): Promise<RealnameVerdict | null> {
  if (!process.env.REALNAME_API_KEY) return null;
  // TODO(vendor): 接入人脸核身（活体＋1:1 比对）API。
  void input;
  return null;
}

/** 三要素统一入口：vendor 优先，缺席回落 Mock（永不抛错）。 */
export async function verifyThreeElements(
  input: RealnameCheckInput,
  fns: { vendor?: ThreeElementsFn; mock?: ThreeElementsFn } = {},
): Promise<RealnameVerdict> {
  try {
    const hit = await (fns.vendor ?? vendorThreeElements)(input);
    if (hit) return hit;
  } catch {
    /* vendor 异常回落 Mock（留痕由调用方按 provider 判定） */
  }
  try {
    return await (fns.mock ?? mockThreeElements)(input);
  } catch {
    return { ok: false, provider: "mock", reason: "核验异常" };
  }
}

/** 活体统一入口：语义同三要素（vendor→Mock 永不抛）。 */
export async function verifyFaceLiveness(
  input: FaceCheckInput,
  fns: { vendor?: FaceLivenessFn; mock?: FaceLivenessFn } = {},
): Promise<RealnameVerdict> {
  try {
    const hit = await (fns.vendor ?? vendorFaceLiveness)(input);
    if (hit) return hit;
  } catch {
    /* 回落 Mock */
  }
  try {
    return await (fns.mock ?? mockFaceLiveness)(input);
  } catch {
    return { ok: false, provider: "mock", reason: "核验异常" };
  }
}
