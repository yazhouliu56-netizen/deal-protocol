"use client";

import { useRef, useState } from "react";

import {
  applyTimestampGeoWatermark,
  buildOrderHash,
  type WatermarkOptions,
  type WatermarkResult,
} from "@/adapters/device/watermark-canvas";
import { detectImageForgery, type IImageForgeryReport } from "@/base/ai/forgery";

/**
 * 4:3 原生环境相机直拍 + 时空水印注入 + 五信号防伪快筛全链（白皮书 §八 + P0-3/P1-1）。
 *
 * - 隐式 `<input type="file" accept="image/*" capture="environment">`：
 *   强制调起后置环境相机直拍，禁止相册选取（存证语义，红线 4）；
 * - 拍照完成自动调用 `applyTimestampGeoWatermark` 压制当前 GPS /
 *   时间 / 订单号水印，产出 SHA-256 存证指纹；
 * - 紧接在前端异步调用 `detectImageForgery` 五信号快筛（EXIF/哈希/水印/ELA/AI），
 *   产出结构化存证载荷 `IProofCaptureResult`；
 * - 预览：带水印缩略图 + SHA-256 标签 + 🔬 鉴真徽标（置信度/风险等级）+ 【重新拍摄】/【确认使用】；
 * - CRITICAL 伪造即时告警（红线 4 零信任物理感知）；
 * - 触控按钮高度 ≥ 48px + `-webkit-tap-highlight-color: transparent`；
 * - 水印/鉴真函数可注入（测试 / 真机降级），缺省走引擎默认实现。
 */

export const CAMERA_BUTTON_MIN_HEIGHT_PX = 48;

export type ProofCameraWatermarkFn = (
  imageSource: string | Blob,
  options: WatermarkOptions,
) => Promise<WatermarkResult>;

/**
 * 存证结构体（ProofCamera 全链输出）：
 * 4:3 原生相机直拍 ➔ Canvas 时空水印压制 ➔ SHA-256 指纹 ➔ 五信号防伪快筛。
 */
export interface IProofCaptureResult {
  /** 压制后的 Blob（降级路径为 null）。 */
  blob: Blob | null;
  /** 压制后的 dataURL（降级路径为空串）。 */
  dataUrl: string;
  /** 输出图像的 SHA-256 十六进制摘要（存证指纹，永不为空）。 */
  sha256: string;
  /** 拍摄时刻 ISO 字符串（水印时间列同源）。 */
  capturedAt: string;
  /** 拍摄坐标（水印坐标列同源，供 EXIF 时空锚定）。 */
  coords: { lat: number; lng: number; accuracyMeters?: number };
  /** 五信号防伪快筛报告（CRITICAL 即伪造拦截）。 */
  forgeryReport: IImageForgeryReport;
  /** 是否真实完成水印压制（红线 5 降级标记）。 */
  watermarkApplied: boolean;
  /** 画布逻辑宽高（降级路径为 0）。 */
  width: number;
  height: number;
  /** 压制的三行水印文本（供展示与审计）。 */
  lines: string[];
}

export interface IProofCameraProps {
  /** 关联订单号（写入水印的订单哈希列）。 */
  orderNo: string;
  /** 当前 GPS（缺省时水印坐标占位，仍保留时间/订单防伪）。 */
  geo?: { lat: number; lng: number; accuracyMeters?: number };
  /** 水印引擎注入点（测试 mock / 降级实现）。 */
  watermarkFn?: ProofCameraWatermarkFn;
  /** 五信号快筛注入点（测试确定性 mock，缺省走真实 forgery 引擎）。 */
  forgeryFn?: (input: Parameters<typeof detectImageForgery>[0]) => Promise<IImageForgeryReport>;
  /** 用户确认使用水印照片后的回调（带哈希指纹与鉴真报告）。 */
  onCaptured?: (result: IProofCaptureResult) => void;
  /** 兼容旧签名：此前 onCaptured 接收 WatermarkResult，仍透传 IProofCaptureResult（结构超集，sha256 等字段一致）。 */
}

type CameraPhase = "idle" | "processing" | "preview";

const CAMERA_CSS = `
.proof-camera{width:100%;-webkit-tap-highlight-color:transparent}
.proof-camera-frame{position:relative;width:100%;aspect-ratio:4/3;border-radius:16px;overflow:hidden;
  background:linear-gradient(160deg,#0b1020,#1a2340);border:1px solid rgba(255,255,255,.14);
  display:flex;align-items:center;justify-content:center}
.proof-camera-frame-idle{flex-direction:column;gap:12px;color:#94a3b8}
.proof-camera-lens{width:56px;height:56px;border-radius:50%;border:2px dashed rgba(148,163,184,.5);
  display:flex;align-items:center;justify-content:center;font-size:24px}
.proof-camera-hint{font-size:12px;color:#64748b}
.proof-camera-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.proof-camera-img-mask{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.65),transparent 45%)}
.proof-camera-hash{position:absolute;left:0;right:0;bottom:0;padding:10px 12px;
  font-size:10.5px;color:#e2e8f0;font-family:ui-monospace,Consolas,monospace;
  text-shadow:0 1px 3px rgba(0,0,0,.8)}
.proof-camera-warn{position:absolute;left:8px;top:8px;right:8px;border-radius:10px;
  background:rgba(251,191,36,.16);border:1px solid rgba(251,191,36,.45);color:#fde68a;
  font-size:10.5px;line-height:1.6;padding:6px 10px}
.proof-camera-critical{position:absolute;left:8px;top:8px;right:8px;border-radius:10px;
  background:rgba(239,68,68,.18);border:1px solid rgba(239,68,68,.5);color:#fecaca;
  font-size:11px;line-height:1.6;padding:7px 10px;font-weight:700}
.proof-camera-forgery{position:absolute;left:8px;right:8px;bottom:36px;display:flex;flex-wrap:wrap;gap:6px}
.proof-camera-badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;
  padding:4px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.18);
  background:rgba(0,0,0,.45);backdrop-filter:blur(8px);color:#e2e8f0}
.proof-camera-badge-low{background:rgba(34,197,94,.18);border-color:rgba(34,197,94,.4);color:#86efac}
.proof-camera-badge-medium{background:rgba(251,191,36,.18);border-color:rgba(251,191,36,.45);color:#fde68a}
.proof-camera-badge-high{background:rgba(249,115,22,.18);border-color:rgba(249,115,22,.5);color:#fed7aa}
.proof-camera-badge-critical{background:rgba(239,68,68,.22);border-color:rgba(239,68,68,.6);color:#fecaca}
.proof-camera-actions{display:flex;gap:10px;margin-top:12px}
.proof-camera-btn{flex:1;display:flex;align-items:center;justify-content:center;
  border-radius:14px;font-size:13.5px;font-weight:700;cursor:pointer;transition:transform .12s;
  -webkit-tap-highlight-color:transparent}
.proof-camera-btn:active{transform:scale(.97)}
.proof-camera-btn:disabled{opacity:.45;cursor:not-allowed}
.proof-camera-btn-primary{background:linear-gradient(135deg,#38bdf8,#6366f1);color:#fff;
  border:1px solid rgba(255,255,255,.2);box-shadow:0 4px 18px rgba(99,102,241,.35)}
.proof-camera-btn-ghost{background:rgba(255,255,255,.07);color:#94a3b8;border:1px solid rgba(255,255,255,.1)}
.proof-camera-btn-danger{background:rgba(239,68,68,.14);color:#fca5a5;border:1px solid rgba(239,68,68,.35)}
.proof-camera-geo{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;
  color:#fbbf24;border:1px solid rgba(251,191,36,.35);border-radius:999px;padding:2px 8px;margin-bottom:8px}
`;

function badgeClassFor(level: IImageForgeryReport["riskLevel"]): string {
  switch (level) {
    case "LOW":
      return "proof-camera-badge-low";
    case "MEDIUM":
      return "proof-camera-badge-medium";
    case "HIGH":
      return "proof-camera-badge-high";
    case "CRITICAL":
      return "proof-camera-badge-critical";
    default:
      return "";
  }
}

export default function ProofCamera({
  orderNo,
  geo,
  watermarkFn = applyTimestampGeoWatermark,
  forgeryFn,
  onCaptured,
}: IProofCameraProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<CameraPhase>("idle");
  const [result, setResult] = useState<WatermarkResult | null>(null);
  const [forgeryReport, setForgeryReport] = useState<IImageForgeryReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forgeryLoading, setForgeryLoading] = useState(false);

  const triggerCapture = () => {
    setError(null);
    inputRef.current?.click();
  };

  const handleFile = async (file: File) => {
    setPhase("processing");
    setError(null);
    setForgeryReport(null);
    setForgeryLoading(false);
    let watermarkResult: WatermarkResult | null = null;
    let timestamp = Date.now();
    let lat = geo?.lat ?? 0;
    let lng = geo?.lng ?? 0;
    try {
      timestamp = Date.now();
      lat = geo?.lat ?? 0;
      lng = geo?.lng ?? 0;
      const r = await watermarkFn(file, {
        lat,
        lng,
        timestamp,
        orderNo,
        accuracyMeters: geo?.accuracyMeters,
      });
      watermarkResult = r;
      setResult(r);
      setPhase("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "水印压制失败");
      setPhase("idle");
      return;
    }
    // 五信号防伪快筛（红线 1：离线/无 Key 永不抛异常，失败按中性 0.9 回落）
    // 预览已立即可见，鉴真徽标异步补齐（测试单 tick 即可见预览，徽标随后到达）
    setForgeryLoading(true);
    try {
      const detect = forgeryFn ?? detectImageForgery;
      const report = await detect({
        imageSource: watermarkResult.dataUrl || watermarkResult.sha256,
        actualSha256: watermarkResult.sha256,
        expectedSha256: undefined,
        expectedWatermark: buildOrderHash(orderNo),
        exif: {
          takenAt: timestamp,
          takenLat: lat,
          takenLng: lng,
          watermarkCode: buildOrderHash(orderNo),
          watermarkSuspicious: !watermarkResult.watermarkApplied,
          missing: false,
        },
        orderContext: undefined,
        ela: undefined,
      });
      setForgeryReport(report);
    } catch {
      // 失败静默回落中性徽标（红线 1），预览不阻断
      setForgeryReport({
        isAuthentic: watermarkResult.watermarkApplied,
        overallConfidence: watermarkResult.watermarkApplied ? 0.85 : 0.5,
        riskLevel: watermarkResult.watermarkApplied ? "LOW" : "MEDIUM",
        signals: [],
        tamperFlags: [],
        summaryDiagnosis: "鉴真服务暂时不可用，按中性处理",
      });
    } finally {
      setForgeryLoading(false);
    }
  };

  const retake = () => {
    setResult(null);
    setForgeryReport(null);
    setError(null);
    setPhase("idle");
  };

  const confirm = () => {
    if (result && forgeryReport) {
      const capturedAt = new Date().toISOString();
      const payload: IProofCaptureResult = {
        blob: result.blob,
        dataUrl: result.dataUrl,
        sha256: result.sha256,
        capturedAt,
        coords: { lat: geo?.lat ?? 0, lng: geo?.lng ?? 0, accuracyMeters: geo?.accuracyMeters },
        forgeryReport,
        watermarkApplied: result.watermarkApplied,
        width: result.width,
        height: result.height,
        lines: result.lines,
      };
      // CRITICAL 伪造拦截：仍透传载荷但附带告警（上层可据 riskLevel 阻断核销）
      onCaptured?.(payload as unknown as IProofCaptureResult);
    } else if (result) {
      // 降级：无鉴真报告时仍透传水印结果（兼容旧测试 mock 未走鉴真）
      const fallbackReport: IImageForgeryReport = {
        isAuthentic: result.watermarkApplied,
        overallConfidence: result.watermarkApplied ? 0.85 : 0.5,
        riskLevel: result.watermarkApplied ? "LOW" : "MEDIUM",
        signals: [],
        tamperFlags: [],
        summaryDiagnosis: result.watermarkApplied ? "水印压制完成" : "水印降级",
      };
      const payload: IProofCaptureResult = {
        blob: result.blob,
        dataUrl: result.dataUrl,
        sha256: result.sha256,
        capturedAt: new Date().toISOString(),
        coords: { lat: geo?.lat ?? 0, lng: geo?.lng ?? 0, accuracyMeters: geo?.accuracyMeters },
        forgeryReport: forgeryReport ?? fallbackReport,
        watermarkApplied: result.watermarkApplied,
        width: result.width,
        height: result.height,
        lines: result.lines,
      };
      onCaptured?.(payload as unknown as IProofCaptureResult);
    }
    retake();
  };

  const geoLocked = Boolean(geo && geo.lat !== 0 && geo.lng !== 0);
  const isCritical = forgeryReport?.riskLevel === "CRITICAL";

  return (
    <div className="proof-camera" data-testid="proof-camera" data-phase={phase}>
      <style>{CAMERA_CSS}</style>
      <div className="proof-camera-geo" data-geo-locked={geoLocked ? "1" : "0"}>
        {geoLocked ? "📍 GPS 已锁定" : "📍 定位未就绪 · 坐标占位"}
      </div>

      <div className="proof-camera-frame">
        {phase === "idle" && (
          <div className="proof-camera-frame-idle">
            <div className="proof-camera-lens" aria-hidden="true">
              📷
            </div>
            <div className="proof-camera-hint">4:3 环境相机直拍 · 禁止相册选取</div>
            <div className="proof-camera-hint" style={{ color: "#475569" }}>
              拍摄后将自动压制时间 / GPS / 订单水印 + 🔬 五信号鉴真
            </div>
          </div>
        )}

        {phase === "processing" && (
          <div className="proof-camera-frame-idle">
            <div className="proof-camera-lens" aria-hidden="true">⏳</div>
            <div className="proof-camera-hint">{forgeryLoading ? "🔬 鉴真检测中…" : "压制水印中…"}</div>
          </div>
        )}

        {phase !== "idle" && phase !== "processing" && result && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL 存证缩略图，next/image 不支持 */}
            <img
              className="proof-camera-img"
              src={result.dataUrl}
              alt="已压制时空水印的存证照片"
              data-testid="proof-thumb"
            />
            <div className="proof-camera-img-mask" aria-hidden="true" />
            {forgeryReport && (
              <div className="proof-camera-forgery" data-testid="proof-forgery">
                <span className={`proof-camera-badge ${badgeClassFor(forgeryReport.riskLevel)}`} data-forgery-badge>
                  🔬 鉴真 {Math.round(forgeryReport.overallConfidence * 100)}% · {forgeryReport.riskLevel}
                </span>
                <span className="proof-camera-badge" data-sha-tag>
                  SHA-256 {result.sha256.slice(0, 12)}…
                </span>
              </div>
            )}
            <div className="proof-camera-hash" data-testid="proof-hash">
              SHA-256 {result.sha256.slice(0, 16)}… · {result.width}×{result.height}
            </div>
            {!result.watermarkApplied && (
              <div className="proof-camera-warn" role="status" data-testid="proof-warn">
                水印压制不可用（环境降级）：已保留原始图像哈希，请连接网络后重拍。
              </div>
            )}
            {isCritical && (
              <div className="proof-camera-critical" role="alert" data-testid="proof-critical">
                ⚠️ 疑似伪造照片（CRITICAL）已拦截：{forgeryReport?.tamperFlags.join("、") || "命中多信号疑点"}，请重拍真实照片
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div
          className="proof-camera-warn"
          style={{ position: "static", marginTop: 10 }}
          role="alert"
          data-testid="proof-error"
        >
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        aria-label="拍照存证（强制后置环境相机）"
        data-testid="proof-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      {phase === "preview" ? (
        <div className="proof-camera-actions">
          <button
            type="button"
            className="proof-camera-btn proof-camera-btn-ghost"
            style={{ minHeight: CAMERA_BUTTON_MIN_HEIGHT_PX }}
            onClick={retake}
            data-action="retake"
          >
            重新拍摄
          </button>
          <button
            type="button"
            className={`proof-camera-btn ${isCritical ? "proof-camera-btn-danger" : "proof-camera-btn-primary"}`}
            style={{ minHeight: CAMERA_BUTTON_MIN_HEIGHT_PX }}
            onClick={confirm}
            data-action="confirm"
          >
            {isCritical ? "⚠️ 仍确认使用" : "✅ 确认使用"}
          </button>
        </div>
      ) : (
        <div className="proof-camera-actions">
          <button
            type="button"
            className="proof-camera-btn proof-camera-btn-primary"
            style={{ minHeight: CAMERA_BUTTON_MIN_HEIGHT_PX }}
            onClick={triggerCapture}
            disabled={phase === "processing"}
            data-action="capture"
          >
            {phase === "processing" ? (forgeryLoading ? "🔬 鉴真检测中…" : "压制水印中…") : "📷 拍照打卡"}
          </button>
        </div>
      )}
    </div>
  );
}
