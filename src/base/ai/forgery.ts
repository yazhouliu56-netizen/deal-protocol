/**
 * L3-M4 深度 AIGC 图像伪造检测闭环（ADR-0012 · N4 放大）。
 * 五信号融合鉴真引擎：
 *  ① EXIF 时空一致性（拍照时间 vs 订单服务窗口、GPS vs 围栏偏差）
 *  ② SHA-256 存证指纹防篡改（核验打卡时固化的指纹）
 *  ③ 时空水印完整性（右下角水印元数据 + 防伪编码）
 *  ④ ELA 像素级压缩/平滑分析（检测 AIGC 扩散模型过度平滑与拼接边缘伪影）
 *  ⑤ 5-provider Gateway 视觉深度鉴真（task: diagnose，失败静默回退纯规则）
 * 红线 1：离线/无 Key/网络异常时 100% 基于前四信号确定性判定，严禁外部
 * AI 波动抛未捕获异常；红线 3：本文件为纯函数引擎，零 React/UI Store 反向依赖。
 */

export type ForgeryRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ForgerySignalName =
  | "EXIF_METADATA"
  | "SHA256_FINGERPRINT"
  | "WATERMARK_INTEGRITY"
  | "ELA_PIXEL_NOISE"
  | "AI_VISUAL_ARTIFACTS";

export interface IImageForgerySignal {
  signal: ForgerySignalName;
  /** 该信号判定是否通过（false = 命中疑点）。 */
  passed: boolean;
  /** 0.0 ~ 1.0（1.0 = 完全可信）。 */
  score: number;
  detail: string;
}

export interface IImageForgeryReport {
  /** 综合判定（置信度 ≥ 0.6 视为可信）。 */
  isAuthentic: boolean;
  /** 0.0 ~ 1.0 总置信度。 */
  overallConfidence: number;
  riskLevel: ForgeryRiskLevel;
  signals: IImageForgerySignal[];
  /** 命中疑点标签（如 EXIF_TIME_MISMATCH / EXIF_GPS_MISMATCH / HASH_TAMPERED / WATERMARK_MISSING / ELA_PIXEL_NOISE / AI_ARTIFACT_SUSPICION）。 */
  tamperFlags: string[];
  summaryDiagnosis: string;
}

/** 订单时空上下文（信号 1 比对基准）。 */
export interface OrderGeoTimeContext {
  /** 服务开始时间（ms）。 */
  serviceStartAt?: number;
  /** 服务结束时间（ms）。 */
  serviceEndAt?: number;
  /** 目标服务地坐标（围栏）。 */
  serviceLat?: number;
  serviceLng?: number;
  /** 围栏半径（米）。 */
  fenceRadiusMeters?: number;
}

/** 照片自身元数据（EXIF 解析结果，由上层采集传入）。 */
export interface ImageExifMeta {
  /** 拍摄时间（ISO 或 ms）。 */
  takenAt?: number | string;
  takenLat?: number;
  takenLng?: number;
  /** EXIF 是否完全缺失（AI 生成图常见）。 */
  missing?: boolean;
  /** 水印防伪编码（右下角水印相机写入）。 */
  watermarkCode?: string;
  /** 伪造/伪造嫌疑水印。 */
  watermarkSuspicious?: boolean;
}

/** 引擎输入。 */
export interface ImageForgeryInput {
  /** 照片标识（URL / dataURI / 存证键）。 */
  imageSource: string;
  /** 打卡时固化的 SHA-256 存证指纹（信号 2 基准）。 */
  expectedSha256?: string;
  /** 当前照片 SHA-256（信号 2 实测）。 */
  actualSha256?: string;
  /** 期望水印编码（打卡时登记）。 */
  expectedWatermark?: string;
  /** EXIF 元数据。 */
  exif?: ImageExifMeta;
  /** 订单时空上下文。 */
  orderContext?: OrderGeoTimeContext;
  /** ELA 像素特征（由纯数学分析器产出；缺省走确定性估算）。 */
  ela?: {
    /** 0.0~1.0 平滑度（1.0 = 过度平滑，扩散模型典型）。 */
    smoothness: number;
    /** 0.0~1.0 拼接边缘高频伪影密度。 */
    spliceEdgeNoise: number;
  };
  /** 是否强制跳过 Gateway（测试/离线）。 */
  skipAi?: boolean;
}

/** 五信号权重（和为 1.0）。 */
const SIGNAL_WEIGHTS: Record<ForgerySignalName, number> = {
  EXIF_METADATA: 0.25,
  SHA256_FINGERPRINT: 0.3,
  WATERMARK_INTEGRITY: 0.15,
  ELA_PIXEL_NOISE: 0.2,
  AI_VISUAL_ARTIFACTS: 0.1,
};

export const FORGERY_RISK_THRESHOLDS = {
  authentic: 0.6,
  critical: 0.35,
  high: 0.5,
} as const;

/** 信号疑点标签常量（业务方 / 争议链引用）。 */
export const FORGERY_FLAGS = {
  EXIF_TIME_MISMATCH: "EXIF_TIME_MISMATCH",
  EXIF_GPS_MISMATCH: "EXIF_GPS_MISMATCH",
  EXIF_MISSING: "EXIF_MISSING",
  HASH_TAMPERED: "HASH_TAMPERED",
  HASH_MISSING_REFERENCE: "HASH_MISSING_REFERENCE",
  WATERMARK_MISSING: "WATERMARK_MISSING",
  WATERMARK_CODE_MISMATCH: "WATERMARK_CODE_MISMATCH",
  WATERMARK_SUSPICIOUS: "WATERMARK_SUSPICIOUS",
  ELA_OVER_SMOOTH: "ELA_OVER_SMOOTH",
  ELA_SPLICE_NOISE: "ELA_SPLICE_NOISE",
  AI_ARTIFACT_SUSPICION: "AI_ARTIFACT_SUSPICION",
} as const;

/** 阻断常量（业务接线用）。 */
export const AIGC_PHOTO_FORGERY_DETECTED = "AIGC_PHOTO_FORGERY_DETECTED";

/* ═══════════════ 信号 1：EXIF 时空一致性 ═══════════════ */

function parseTakenAt(raw: number | string | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  const ms = typeof raw === "number" ? raw : Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

/** EXIF 时空一致性（确定性纯函数）：时间越界 / GPS 越界 / EXIF 缺失。 */
export function evaluateExifSignal(input: ImageForgeryInput): IImageForgerySignal {
  const ctx = input.orderContext;
  const exif = input.exif;
  const flags: string[] = [];

  if (exif?.missing) {
    flags.push(FORGERY_FLAGS.EXIF_MISSING);
    return {
      signal: "EXIF_METADATA",
      passed: false,
      score: 0.15,
      detail: `EXIF 完全缺失（${FORGERY_FLAGS.EXIF_MISSING}）——AI 生成图典型特征，时间/空间无法自证`,
    };
  }

  let score = 1.0;
  const takenAt = parseTakenAt(exif?.takenAt);
  if (takenAt !== null && ctx?.serviceStartAt && ctx?.serviceEndAt) {
    const pad = 60 * 60_000; // 允许 ±1h 时钟偏差
    if (takenAt < ctx.serviceStartAt - pad || takenAt > ctx.serviceEndAt + pad) {
      flags.push(FORGERY_FLAGS.EXIF_TIME_MISMATCH);
      score -= 0.45;
    }
  } else if (takenAt === null && ctx?.serviceStartAt) {
    // 有服务窗口但照片无时间戳 → 无法自证
    score -= 0.1;
    flags.push("EXIF_TIME_MISSING");
  }

  if (
    Number.isFinite(exif?.takenLat) &&
    Number.isFinite(exif?.takenLng) &&
    Number.isFinite(ctx?.serviceLat) &&
    Number.isFinite(ctx?.serviceLng)
  ) {
    const d = haversineMeters(
      { lat: exif!.takenLat as number, lng: exif!.takenLng as number },
      { lat: ctx!.serviceLat as number, lng: ctx!.serviceLng as number },
    );
    const fence = ctx?.fenceRadiusMeters ?? 2000;
    if (d > fence) {
      flags.push(FORGERY_FLAGS.EXIF_GPS_MISMATCH);
      score -= 0.4;
    } else if (d > fence * 0.6) {
      score -= 0.1;
    }
  } else if (
    Number.isFinite(ctx?.serviceLat) &&
    !Number.isFinite(exif?.takenLat) &&
    !exif?.missing
  ) {
    score -= 0.05;
  }

  const finalScore = Math.max(0, Math.min(1, score));
  return {
    signal: "EXIF_METADATA",
    passed: flags.length === 0,
    score: finalScore,
    detail:
      flags.length === 0
        ? "EXIF 时空与订单窗口一致"
        : `EXIF 疑点: ${flags.join("、")}`,
  };
}

/* ═══════════════ 信号 2：SHA-256 存证指纹 ═══════════════ */

/** 简单 SHA-256（纯 TS，离线可用；FIPS 安全散列，确定性）。 */
export function sha256Hex(input: string): string {
  const data = new TextEncoder().encode(input);
  const paddedLen = 64 * Math.ceil((data.length + 1 + 8) / 64);
  const padded = new Uint8Array(paddedLen);
  padded.set(data);
  padded[data.length] = 0x80;
  const bitLen = data.length * 8;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 2 ** 32));
  dv.setUint32(padded.length - 4, bitLen >>> 0);
  let h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Uint32Array(64);
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 64; t++) {
      w[t] = t < 16
        ? dv.getUint32(i + t * 4)
        : (rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3)) +
          (rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10)) +
          w[t - 16] + w[t - 7] | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + K[t] + w[t]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    h = [a, b, c, d, e, f, g, hh].map((v, idx) => (h[idx] + v) | 0) as typeof h;
  }
  return h.map((v) => (v >>> 0).toString(16).padStart(8, "0")).join("");
}

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** SHA-256 指纹一致性（确定性纯函数）。 */
export function evaluateSha256Signal(input: ImageForgeryInput): IImageForgerySignal {
  const expected = input.expectedSha256;
  const actual = input.actualSha256;
  const flags: string[] = [];

  if (!expected) {
    flags.push(FORGERY_FLAGS.HASH_MISSING_REFERENCE);
    return {
      signal: "SHA256_FINGERPRINT",
      passed: false,
      score: 0.5,
      detail: `无打卡存证指纹基准，无法核验防篡改（${FORGERY_FLAGS.HASH_MISSING_REFERENCE}，按缺省 0.5 处理）`,
    };
  }
  if (!actual) {
    flags.push(FORGERY_FLAGS.HASH_MISSING_REFERENCE);
    return {
      signal: "SHA256_FINGERPRINT",
      passed: false,
      score: 0.45,
      detail: `当前照片指纹缺失（${FORGERY_FLAGS.HASH_MISSING_REFERENCE}），无法比对`,
    };
  }
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    flags.push(FORGERY_FLAGS.HASH_TAMPERED);
    return {
      signal: "SHA256_FINGERPRINT",
      passed: false,
      score: 0.1,
      detail: `SHA-256 指纹与打卡存证不符（${FORGERY_FLAGS.HASH_TAMPERED}）—— 照片被篡改或替换`,
    };
  }
  return {
    signal: "SHA256_FINGERPRINT",
    passed: true,
    score: 1.0,
    detail: "SHA-256 指纹与打卡存证完全一致",
  };
}

/* ═══════════════ 信号 3：时空水印完整性 ═══════════════ */

export function evaluateWatermarkSignal(input: ImageForgeryInput): IImageForgerySignal {
  const exif = input.exif;
  const flags: string[] = [];
  let score = 1.0;

  if (exif?.watermarkSuspicious) {
    flags.push(FORGERY_FLAGS.WATERMARK_SUSPICIOUS);
    score -= 0.5;
  }
  if (!exif?.watermarkCode) {
    flags.push(FORGERY_FLAGS.WATERMARK_MISSING);
    score -= 0.4;
  } else if (input.expectedWatermark && exif.watermarkCode !== input.expectedWatermark) {
    flags.push(FORGERY_FLAGS.WATERMARK_CODE_MISMATCH);
    score -= 0.35;
  }

  const finalScore = Math.max(0, Math.min(1, score));
  return {
    signal: "WATERMARK_INTEGRITY",
    passed: flags.length === 0,
    score: finalScore,
    detail:
      flags.length === 0
        ? "右下角水印元数据与防伪编码完整"
        : `水印疑点: ${flags.join("、")}`,
  };
}

/* ═══════════════ 信号 4：ELA 像素级压缩/平滑分析 ═══════════════ */

/**
 * ELA 像素特征分析（纯数学确定性）：
 * - 无 ela 输入时按「未提供 ELA 实采」中性处理（0.85，不误伤）；
 * - smoothness > 0.75 → 扩散模型过度平滑疑点；
 * - spliceEdgeNoise > 0.6 → 拼接边缘高频伪影疑点。
 * 红线 1：ELA 为纯数学特征，外部图片解码失败不参与（由上层选择是否提供）。
 */
export function evaluateElaSignal(input: ImageForgeryInput): IImageForgerySignal {
  const ela = input.ela;
  const flags: string[] = [];
  if (!ela) {
    return {
      signal: "ELA_PIXEL_NOISE",
      passed: true,
      score: 0.85,
      detail: "ELA 像素特征未实采（中性处理）",
    };
  }
  let score = 1.0;
  if (ela.smoothness > 0.75) {
    flags.push(FORGERY_FLAGS.ELA_OVER_SMOOTH);
    score -= 0.4;
  } else if (ela.smoothness > 0.6) {
    score -= 0.15;
  }
  if (ela.spliceEdgeNoise > 0.6) {
    flags.push(FORGERY_FLAGS.ELA_SPLICE_NOISE);
    score -= 0.35;
  } else if (ela.spliceEdgeNoise > 0.45) {
    score -= 0.1;
  }
  const finalScore = Math.max(0, Math.min(1, score));
  return {
    signal: "ELA_PIXEL_NOISE",
    passed: flags.length === 0,
    score: finalScore,
    detail:
      flags.length === 0
        ? "ELA 压缩特征无过度平滑/拼接伪影"
        : `ELA 疑点: ${flags.join("、")}`,
  };
}

/* ═══════════════ 信号 5：AI Gateway 视觉深度鉴真 ═══════════════ */

/**
 * 5-provider Gateway 视觉判定（动态 import，失败静默回退规则摘要）。
 * 返回 0..1 置信（1 = 真实相机照片）或 null（无增强可用）。
 */
import { getLlmCompleteText } from "./llm-port.ts";

async function tryAiVisualAssessment(input: ImageForgeryInput): Promise<number | null> {
  if (input.skipAi) return null;
  try {
    const completeText = getLlmCompleteText();
    const outcome = await completeText({
      task: "diagnose",
      timeoutMs: 5000,
      messages: [
        {
          role: "system",
          content:
            "你是图像鉴真专家。根据照片的非像素元数据与鉴真信号，评估该照片由真实相机拍摄的可信度。只输出 JSON：{\"confidence\": 0.0-1.0}",
        },
        {
          role: "user",
          content: JSON.stringify({
            source: input.imageSource,
            exifMissing: input.exif?.missing ?? false,
            watermarkCode: input.exif?.watermarkCode,
            ela: input.ela,
            hashMatched: input.actualSha256
              ? input.actualSha256.toLowerCase() === (input.expectedSha256 ?? "").toLowerCase()
              : null,
          }),
        },
      ],
    }) as { ok: boolean; content?: string };
    if (!outcome.ok || !outcome.content) return null;
    const cleaned = outcome.content.replace(/```(?:json)?/g, "").trim();
    const parsed = JSON.parse(cleaned) as { confidence?: unknown };
    const conf = Number(parsed?.confidence);
    if (!Number.isFinite(conf)) return null;
    return Math.max(0, Math.min(1, conf));
  } catch {
    return null;
  }
}

/** AI 视觉信号（辅助增强；失败 → 中性 0.9 不干扰确定性判定）。 */
export async function evaluateAiVisualSignal(input: ImageForgeryInput): Promise<IImageForgerySignal> {
  const conf = await tryAiVisualAssessment(input);
  if (conf === null) {
    return {
      signal: "AI_VISUAL_ARTIFACTS",
      passed: true,
      score: 0.9,
      detail: "视觉大模型不可用（离线/无 Key）——按中性增强处理，不参与降级",
    };
  }
  const flags = conf < 0.35 ? [FORGERY_FLAGS.AI_ARTIFACT_SUSPICION] : [];
  return {
    signal: "AI_VISUAL_ARTIFACTS",
    passed: flags.length === 0,
    score: Math.max(0, Math.min(1, conf)),
    detail:
      flags.length === 0
        ? `视觉大模型置信 ${conf.toFixed(2)}（真实拍摄倾向）`
        : `视觉大模型置信 ${conf.toFixed(2)} —— 疑似 AIGC 伪影`,
  };
}

/* ═══════════════ 综合判定 ═══════════════ */

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const EARTH_KM = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h)) * 1000;
}

function riskFromConfidence(conf: number): ForgeryRiskLevel {
  if (conf >= FORGERY_RISK_THRESHOLDS.authentic) return "LOW";
  if (conf >= FORGERY_RISK_THRESHOLDS.high) return "MEDIUM";
  if (conf >= FORGERY_RISK_THRESHOLDS.critical) return "HIGH";
  return "CRITICAL";
}

/**
 * 五信号融合鉴真主入口：
 * - 前四信号纯确定性；AI 视觉仅辅助（失败中性 0.9）；
 * - 综合置信度 = Σ(信号分 × 权重)；< 0.35 → CRITICAL；< 0.5 → HIGH；< 0.6 → MEDIUM。
 * - 任何输入不抛异常（红线 1）。
 */
export async function detectImageForgery(input: ImageForgeryInput): Promise<IImageForgeryReport> {
  const s1 = evaluateExifSignal(input);
  const s2 = evaluateSha256Signal(input);
  const s3 = evaluateWatermarkSignal(input);
  const s4 = evaluateElaSignal(input);
  const s5 = await evaluateAiVisualSignal(input);
  const signals: IImageForgerySignal[] = [s1, s2, s3, s4, s5];

  let overall = 0;
  for (const s of signals) {
    overall += s.score * SIGNAL_WEIGHTS[s.signal];
  }
  // SHA-256 存证指纹是最硬证据：命中 HASH_TAMPERED → 整体置信乘法衰减 ×0.5
  // （确定性规则，线性加权对单信号硬证据过钝，乘积衰减防漏判）
  const shaSignal = signals.find((s) => s.signal === "SHA256_FINGERPRINT");
  if (shaSignal && !shaSignal.passed && shaSignal.detail.includes(FORGERY_FLAGS.HASH_TAMPERED)) {
    overall *= 0.5;
  }
  overall = Math.max(0, Math.min(1, Math.round(overall * 1000) / 1000));

  const tamperFlags: string[] = [];
  for (const s of signals) {
    if (!s.passed) {
      for (const flag of Object.values(FORGERY_FLAGS)) {
        if (s.detail.includes(flag)) tamperFlags.push(flag);
      }
    }
  }
  const uniqueFlags = [...new Set(tamperFlags)];
  const riskLevel = riskFromConfidence(overall);
  const isAuthentic = overall >= FORGERY_RISK_THRESHOLDS.authentic;

  const summaryDiagnosis =
    uniqueFlags.length === 0
      ? `五信号全部通过，综合置信 ${Math.round(overall * 100)}% —— 判定为真实相机照片`
      : `命中 ${uniqueFlags.length} 项疑点（${uniqueFlags.join("、")}），综合置信 ${Math.round(overall * 100)}% —— 风险等级 ${riskLevel}`;

  return {
    isAuthentic,
    overallConfidence: overall,
    riskLevel,
    signals,
    tamperFlags: uniqueFlags,
    summaryDiagnosis,
  };
}

/* ═══════════════ 存量兼容层（ADR-0012 原规则引擎，导出不破坏） ═══════════════ */

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

const LEGACY_WEIGHTS: Record<keyof EvidenceSample, number> = {
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
    score += LEGACY_WEIGHTS[k];
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