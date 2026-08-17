/**
 * L3-M4 深度 AIGC 图像伪造检测测试矩阵（node:test）：
 * 真实合规照片五信号全通 / 时空篡改 EXIF_MISMATCH / AIGC 像素异常与无水印
 * ELA 告警 / SHA-256 篡改 / 离线无 Key 纯规则兜底 / 风险分级边界 / 引擎永不抛异常。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AIGC_PHOTO_FORGERY_DETECTED,
  FORGERY_FLAGS,
  checkForgery,
  checkTextEvidence,
  detectImageForgery,
  evaluateElaSignal,
  evaluateExifSignal,
  evaluateSha256Signal,
  evaluateWatermarkSignal,
  sha256Hex,
  withLlmReview,
  type IImageForgeryReport,
  type ImageForgeryInput,
} from "./forgery.ts";

/** 基准：服务窗口 14:00-16:00，围栏 50m 半径。 */
const ORDER_CTX = {
  serviceStartAt: Date.parse("2026-08-15T14:00:00+08:00"),
  serviceEndAt: Date.parse("2026-08-15T16:00:00+08:00"),
  serviceLat: 30.572, // 成都
  serviceLng: 104.066,
  fenceRadiusMeters: 50,
};

/** 真实合规照片（全部信号通过）。 */
function authenticInput(over: Partial<ImageForgeryInput> = {}): ImageForgeryInput {
  const takenAt = Date.parse("2026-08-15T15:00:00+08:00");
  return {
    imageSource: "authentic-1.jpg",
    expectedSha256: "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
    actualSha256: "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
    expectedWatermark: "WM-20260815-7001",
    exif: {
      takenAt,
      takenLat: 30.572,
      takenLng: 104.0662,
      watermarkCode: "WM-20260815-7001",
    },
    orderContext: ORDER_CTX,
    ela: { smoothness: 0.2, spliceEdgeNoise: 0.1 },
    skipAi: true,
    ...over,
  };
}

test("真实合规照片：五信号全通，riskLevel === LOW，置信度 ≥ 0.9", async () => {
  const r: IImageForgeryReport = await detectImageForgery(authenticInput());
  assert.equal(r.isAuthentic, true);
  assert.equal(r.riskLevel, "LOW");
  assert.ok(r.overallConfidence >= 0.9, `got ${r.overallConfidence}`);
  assert.equal(r.tamperFlags.length, 0);
  assert.equal(r.signals.length, 5);
  assert.ok(r.signals.every((s) => s.passed));
  assert.match(r.summaryDiagnosis, /判定为真实相机照片/);
});

test("时空篡改照片（GPS 严重偏差）：触发 EXIF_GPS_MISMATCH 标签且置信显著下降", async () => {
  const r = await detectImageForgery(
    authenticInput({
      exif: {
        takenAt: Date.parse("2026-08-15T15:00:00+08:00"),
        takenLat: 31.2, // 成都外 ~70km
        takenLng: 104.1,
        watermarkCode: "WM-20260815-7001",
      },
    }),
  );
  assert.ok(r.tamperFlags.includes(FORGERY_FLAGS.EXIF_GPS_MISMATCH));
  assert.ok(r.overallConfidence < 0.95, `got ${r.overallConfidence}`);
});

test("时空篡改照片（拍摄时间错乱）：触发 EXIF_TIME_MISMATCH 标签", async () => {
  const r = await detectImageForgery(
    authenticInput({
      exif: {
        takenAt: Date.parse("2026-08-01T03:00:00+08:00"), // 两周前的凌晨
        takenLat: 30.572,
        takenLng: 104.066,
        watermarkCode: "WM-20260815-7001",
      },
    }),
  );
  assert.ok(r.tamperFlags.includes(FORGERY_FLAGS.EXIF_TIME_MISMATCH));
});

test("EXIF 全缺失（AI 生成图典型）：EXIF_MISSING + 置信重挫", async () => {
  const r = await detectImageForgery(
    authenticInput({
      exif: { missing: true },
    }),
  );
  assert.ok(r.tamperFlags.includes(FORGERY_FLAGS.EXIF_MISSING));
  assert.ok(r.overallConfidence < 0.85, `got ${r.overallConfidence}`);
});

test("SHA-256 篡改：指纹不符 → HASH_TAMPERED（最高权重重挫）", async () => {
  const r = await detectImageForgery(
    authenticInput({
      actualSha256: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    }),
  );
  assert.ok(r.tamperFlags.includes(FORGERY_FLAGS.HASH_TAMPERED));
  assert.equal(r.isAuthentic, false);
});

test("无水印照片：WATERMARK_MISSING 告警", async () => {
  const r = await detectImageForgery(
    authenticInput({
      exif: {
        takenAt: Date.parse("2026-08-15T15:00:00+08:00"),
        takenLat: 30.572,
        takenLng: 104.066,
        watermarkCode: undefined,
      },
      expectedWatermark: "WM-20260815-7001",
    }),
  );
  assert.ok(r.tamperFlags.includes(FORGERY_FLAGS.WATERMARK_MISSING));
});

test("水印编码不符：WATERMARK_CODE_MISMATCH", async () => {
  const r = await detectImageForgery(
    authenticInput({
      exif: {
        takenAt: Date.parse("2026-08-15T15:00:00+08:00"),
        takenLat: 30.572,
        takenLng: 104.066,
        watermarkCode: "WM-FORGED-9999",
      },
      expectedWatermark: "WM-20260815-7001",
    }),
  );
  assert.ok(r.tamperFlags.includes(FORGERY_FLAGS.WATERMARK_CODE_MISMATCH));
});

test("AIGC 像素异常（过度平滑）：ELA_OVER_SMOOTH 告警", async () => {
  const r = await detectImageForgery(
    authenticInput({
      ela: { smoothness: 0.9, spliceEdgeNoise: 0.1 },
    }),
  );
  assert.ok(r.tamperFlags.includes(FORGERY_FLAGS.ELA_OVER_SMOOTH));
});

test("拼接边缘高频噪点：ELA_SPLICE_NOISE 告警", async () => {
  const r = await detectImageForgery(
    authenticInput({
      ela: { smoothness: 0.2, spliceEdgeNoise: 0.85 },
    }),
  );
  assert.ok(r.tamperFlags.includes(FORGERY_FLAGS.ELA_SPLICE_NOISE));
});

test("离线无 Key 降级：规则引擎 100% 兜底且无异常抛出", async () => {
  // skipAi=true 且故意让所有外部链路缺失 —— 引擎必须正常返回报告
  const r = await detectImageForgery({
    imageSource: "offline-1.jpg",
    skipAi: true,
    orderContext: ORDER_CTX,
  });
  assert.ok(r.overallConfidence >= 0);
  assert.ok(r.overallConfidence <= 1);
  assert.equal(r.signals.length, 5);
  // 无任何基准信息 → 保守不判真实（置信 < 0.9，绝不误报 HIGH 以下）
  assert.equal(typeof r.summaryDiagnosis, "string");
});

test("风险分级边界：多重疑点 → MEDIUM；严重多命 → HIGH/CRITICAL", async () => {
  // EXIF 缺失 + 无存证指纹基准 + 水印缺失（三处破坏）→ 置信 < 0.6 → MEDIUM 及以上
  const medium = await detectImageForgery(
    authenticInput({
      expectedSha256: undefined,
      actualSha256: undefined,
      exif: { missing: true },
    }),
  );
  assert.equal(medium.isAuthentic, false);
  assert.ok(["MEDIUM", "HIGH", "CRITICAL"].includes(medium.riskLevel), `got ${medium.riskLevel}`);

  // 全部信号崩坏 → 置信 < 0.35 → CRITICAL
  const critical = await detectImageForgery({
    imageSource: "forged-1.jpg",
    expectedSha256: "abc",
    actualSha256: "def",
    expectedWatermark: "WM-X",
    exif: {
      missing: true,
      watermarkSuspicious: true,
    },
    orderContext: ORDER_CTX,
    ela: { smoothness: 0.95, spliceEdgeNoise: 0.9 },
    skipAi: true,
  });
  assert.equal(critical.riskLevel, "CRITICAL");
  assert.equal(critical.isAuthentic, false);
  assert.ok(critical.overallConfidence < 0.35, `got ${critical.overallConfidence}`);
  // CRITICAL 阻断常量（业务接线契约）
  assert.equal(AIGC_PHOTO_FORGERY_DETECTED, "AIGC_PHOTO_FORGERY_DETECTED");
});

test("空白/非法输入：引擎永不抛异常（红线 1）", async () => {
  const inputs: ImageForgeryInput[] = [
    { imageSource: "" },
    { imageSource: "x", exif: { takenLat: NaN, takenLng: NaN } },
    { imageSource: "x", orderContext: { serviceStartAt: NaN } },
    { imageSource: "x", ela: { smoothness: NaN, spliceEdgeNoise: NaN } },
  ];
  for (const input of inputs) {
    const r = await detectImageForgery(input);
    assert.ok(typeof r.overallConfidence === "number" && Number.isFinite(r.overallConfidence));
    assert.ok(typeof r.summaryDiagnosis === "string" && r.summaryDiagnosis.length > 0);
  }
});

test("信号级单测：EXIF 精确判定（时间/空间/缺失）", () => {
  // 时空一致
  const ok = evaluateExifSignal(
    authenticInput({
      exif: {
        takenAt: Date.parse("2026-08-15T15:00:00+08:00"),
        takenLat: 30.572,
        takenLng: 104.0662,
      },
    }),
  );
  assert.equal(ok.passed, true);
  // 时间越界
  const timeBad = evaluateExifSignal(
    authenticInput({
      exif: {
        takenAt: Date.parse("2026-08-15T20:00:00+08:00"),
        takenLat: 30.572,
        takenLng: 104.066,
      },
    }),
  );
  assert.equal(timeBad.passed, false);
  // 缺失
  const missing = evaluateExifSignal({ imageSource: "x", exif: { missing: true }, orderContext: ORDER_CTX });
  assert.equal(missing.passed, false);
});

test("信号级单测：SHA-256 指纹（一致/不一致/无基准）", () => {
  const same = evaluateSha256Signal({
    imageSource: "x",
    expectedSha256: "AAAA",
    actualSha256: "aaaa",
  });
  assert.equal(same.passed, true);
  assert.equal(same.score, 1.0);
  const diff = evaluateSha256Signal({
    imageSource: "x",
    expectedSha256: "AAAA",
    actualSha256: "BBBB",
  });
  assert.equal(diff.passed, false);
  const noRef = evaluateSha256Signal({ imageSource: "x" });
  assert.equal(noRef.passed, false);
  assert.equal(noRef.score, 0.5);
});

test("信号级单测：水印（完整/缺失/编码不符/伪铸）", () => {
  const ok = evaluateWatermarkSignal({
    imageSource: "x",
    expectedWatermark: "WM-1",
    exif: { watermarkCode: "WM-1" },
  });
  assert.equal(ok.passed, true);
  assert.equal(ok.score, 1.0);
  assert.equal(evaluateWatermarkSignal({ imageSource: "x" }).passed, false);
  assert.equal(
    evaluateWatermarkSignal({
      imageSource: "x",
      expectedWatermark: "WM-1",
      exif: { watermarkCode: "WM-2" },
    }).passed,
    false,
  );
  assert.equal(
    evaluateWatermarkSignal({ imageSource: "x", exif: { watermarkSuspicious: true } }).passed,
    false,
  );
});

test("信号级单测：ELA 平滑度/拼接边缘阈值判定", () => {
  assert.equal(evaluateElaSignal({ imageSource: "x" }).passed, true);
  assert.equal(evaluateElaSignal({ imageSource: "x", ela: { smoothness: 0.8, spliceEdgeNoise: 0.1 } }).passed, false);
  assert.equal(evaluateElaSignal({ imageSource: "x", ela: { smoothness: 0.2, spliceEdgeNoise: 0.7 } }).passed, false);
  assert.equal(evaluateElaSignal({ imageSource: "x", ela: { smoothness: 0.3, spliceEdgeNoise: 0.2 } }).passed, true);
});

test("sha256Hex 确定性：同输入同输出且为 64 位十六进制", () => {
  const h1 = sha256Hex("deal-protocol-forensic-evidence-001");
  const h2 = sha256Hex("deal-protocol-forensic-evidence-001");
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/);
  assert.notEqual(sha256Hex("a"), sha256Hex("b"));
});

test("存量兼容：checkForgery/checkTextEvidence/withLlmReview 导出不破坏", () => {
  assert.equal(checkForgery({ noExif: false, oddName: false, reused: false, timeMismatch: false, oddRatio: false }).score, 0);
  assert.equal(checkTextEvidence(["a", "a"]).hits[0], "reused");
  const rule = checkForgery({ noExif: true, oddName: false, reused: false, timeMismatch: false, oddRatio: false });
  assert.equal(withLlmReview(rule, null).score, rule.score);
});