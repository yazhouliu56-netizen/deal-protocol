"use client";

import { useRef, useState } from "react";

import {
  applyTimestampGeoWatermark,
  type WatermarkOptions,
  type WatermarkResult,
} from "@/base/platform/watermark-canvas";

/**
 * 4:3 原生环境相机直拍 + 时空水印注入控件（ProofCamera · 白皮书 §八）。
 *
 * - 隐式 `<input type="file" accept="image/*" capture="environment">`：
 *   强制调起后置环境相机直拍，禁止相册选取（存证语义）；
 * - 拍照完成自动调用 `applyTimestampGeoWatermark` 压制当前 GPS /
 *   时间 / 订单号水印，产出 SHA-256 存证指纹；
 * - 预览：带水印缩略图 + 哈希标签 + 【重新拍摄】/【确认使用】；
 * - 触控按钮高度 ≥ 48px + `-webkit-tap-highlight-color: transparent`；
 * - 水印函数可注入（测试 / 真机降级），缺省走引擎默认实现。
 */

export const CAMERA_BUTTON_MIN_HEIGHT_PX = 48;

export type ProofCameraWatermarkFn = (
  imageSource: string | Blob,
  options: WatermarkOptions,
) => Promise<WatermarkResult>;

export interface IProofCameraProps {
  /** 关联订单号（写入水印的订单哈希列）。 */
  orderNo: string;
  /** 当前 GPS（缺省时水印坐标占位，仍保留时间/订单防伪）。 */
  geo?: { lat: number; lng: number; accuracyMeters?: number };
  /** 水印引擎注入点（测试 mock / 降级实现）。 */
  watermarkFn?: ProofCameraWatermarkFn;
  /** 用户确认使用水印照片后的回调（带哈希指纹）。 */
  onCaptured?: (result: WatermarkResult) => void;
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
.proof-camera-img-mask{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.55),transparent 45%)}
.proof-camera-hash{position:absolute;left:0;right:0;bottom:0;padding:10px 12px;
  font-size:10.5px;color:#e2e8f0;font-family:ui-monospace,Consolas,monospace;
  text-shadow:0 1px 3px rgba(0,0,0,.8)}
.proof-camera-warn{position:absolute;left:8px;top:8px;right:8px;border-radius:10px;
  background:rgba(251,191,36,.16);border:1px solid rgba(251,191,36,.45);color:#fde68a;
  font-size:10.5px;line-height:1.6;padding:6px 10px}
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

export default function ProofCamera({
  orderNo,
  geo,
  watermarkFn = applyTimestampGeoWatermark,
  onCaptured,
}: IProofCameraProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<CameraPhase>("idle");
  const [result, setResult] = useState<WatermarkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const triggerCapture = () => {
    setError(null);
    inputRef.current?.click();
  };

  const handleFile = async (file: File) => {
    setPhase("processing");
    try {
      const r = await watermarkFn(file, {
        lat: geo?.lat ?? 0,
        lng: geo?.lng ?? 0,
        timestamp: Date.now(),
        orderNo,
        accuracyMeters: geo?.accuracyMeters,
      });
      setResult(r);
      setPhase("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "水印压制失败");
      setPhase("idle");
    }
  };

  const retake = () => {
    setResult(null);
    setError(null);
    setPhase("idle");
  };

  const confirm = () => {
    if (result) onCaptured?.(result);
    retake();
  };

  const geoLocked = Boolean(geo && geo.lat !== 0 && geo.lng !== 0);

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
              拍摄后将自动压制时间 / GPS / 订单水印
            </div>
          </div>
        )}

        {phase !== "idle" && result && (
          <>
            <img
              className="proof-camera-img"
              src={result.dataUrl}
              alt="已压制时空水印的存证照片"
              data-testid="proof-thumb"
            />
            <div className="proof-camera-img-mask" aria-hidden="true" />
            <div className="proof-camera-hash" data-testid="proof-hash">
              SHA-256 {result.sha256.slice(0, 16)}… · {result.width}×{result.height}
            </div>
            {!result.watermarkApplied && (
              <div className="proof-camera-warn" role="status" data-testid="proof-warn">
                水印压制不可用（环境降级）：已保留原始图像哈希，请连接网络后重拍。
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
            className="proof-camera-btn proof-camera-btn-primary"
            style={{ minHeight: CAMERA_BUTTON_MIN_HEIGHT_PX }}
            onClick={confirm}
            data-action="confirm"
          >
            ✅ 确认使用
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
            {phase === "processing" ? "压制水印中…" : "📷 拍照打卡"}
          </button>
        </div>
      )}
    </div>
  );
}
