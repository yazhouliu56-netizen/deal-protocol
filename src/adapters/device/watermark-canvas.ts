/**
 * Canvas 本地时空防伪水印压制引擎（PWA Native-Like UI/UX，白皮书 §八）。
 *
 * 纯函数核心（红线 3：零 React / 零 UI Store 反向依赖）：
 * - 时空水印行拼接（时间 / 经纬度 / 订单哈希）与坐标格式化；
 * - 确定性订单哈希（djb2 族，与 `signInsure.hashDoc` 同源）；
 * - SHA-256 摘要（WebCrypto `globalThis.crypto.subtle`，浏览器 / Node ≥20 通用）；
 * - 无 DOM 环境（Node 单测 / SSR 首帧）确定性降级：不压制图像、
 *   仅产出原图哈希与 `watermarkApplied: false`（红线 5：严禁抛未捕获异常）。
 *
 * DOM 桥（浏览器端）：
 * - 将任意图像源绘制为标准 4:3 画布（中心裁剪），右下角压制半透明
 *   遮罩 + 三行文本水印，导出 Blob 与 dataUrl，并返回压制后图像的
 *   SHA-256 哈希作为存证指纹。
 */

export const WATERMARK_RATIO = 4 / 3;
/** 触发滑动返回的视觉阈值常量（px），与 useEdgeSwipeBack 无耦合，独立定义。 */
export const WATERMARK_ORDER_HASH_PREFIX = "wm-";
/** 订单哈希截取长度（十六进制字符数）。 */
export const WATERMARK_ORDER_HASH_LEN = 12;
/** 遮罩最大宽度占比（相对画布宽）。 */
export const WATERMARK_OVERLAY_RATIO = 0.94;

export interface WatermarkOptions {
  /** 纬度（WGS-84，十进制度）。 */
  lat: number;
  /** 经度（WGS-84，十进制度）。 */
  lng: number;
  /** 拍摄时刻（epoch 毫秒）。 */
  timestamp: number;
  /** 订单号（水印「订单哈希」列，脱敏不落明文）。 */
  orderNo: string;
  /** GPS 精度（米，可选；格式化时展示 ±N m）。 */
  accuracyMeters?: number;
  /** 画布工厂注入点（红线 5：非浏览器环境可注入 fake 以验证降级路径）。 */
  canvasFactory?: () => HTMLCanvasElement | null;
}

export interface WatermarkResult {
  /** 压制后的 Blob（降级路径为 null）。 */
  blob: Blob | null;
  /** 压制后的 dataURL（降级路径为空串）。 */
  dataUrl: string;
  /** 输出图像的 SHA-256 十六进制摘要（降级路径 = 原始图像源摘要）。 */
  sha256: string;
  /** 是否真实完成水印压制。 */
  watermarkApplied: boolean;
  /** 画布逻辑宽高（降级路径为 0）。 */
  width: number;
  height: number;
  /** 压制的三行水印文本（供展示与审计）。 */
  lines: string[];
  /** 降级原因（watermarkApplied=false 时非空）。 */
  reason?: string;
}

/** 时间戳 → 本地时区 `YYYY-MM-DD HH:mm:ss`。 */
export function formatTimestamp(timestamp: number): string {
  const d = new Date(timestamp);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 坐标 → `31.23040°N 121.47370°E`（含可选精度 ±N m）。 */
export function formatCoordinates(
  lat: number,
  lng: number,
  accuracyMeters?: number,
): string {
  const fixed = (v: number) => Math.abs(v).toFixed(5);
  const latPart = `${fixed(lat)}°${lat >= 0 ? "N" : "S"}`;
  const lngPart = `${fixed(lng)}°${lng >= 0 ? "E" : "W"}`;
  if (typeof accuracyMeters === "number" && accuracyMeters > 0) {
    return `${latPart} ${lngPart} ±${Math.round(accuracyMeters)}m`;
  }
  return `${latPart} ${lngPart}`;
}

/** 订单号 → 确定性哈希（djb2 族，与 signInsure 同源），截取前 12 位。 */
export function buildOrderHash(orderNo: string): string {
  let h = 5381;
  for (let i = 0; i < orderNo.length; i++) {
    h = ((h << 5) + h + orderNo.charCodeAt(i)) >>> 0;
  }
  const hex = h.toString(16).padStart(8, "0");
  return `${WATERMARK_ORDER_HASH_PREFIX}${(hex + hex).slice(0, WATERMARK_ORDER_HASH_LEN)}`;
}

/** 三行水印文本（时间 / 坐标 / 订单哈希）。 */
export function buildWatermarkLines(
  o: Pick<WatermarkOptions, "lat" | "lng" | "timestamp" | "orderNo" | "accuracyMeters">,
): string[] {
  return [
    `[时间] ${formatTimestamp(o.timestamp)}`,
    `[坐标] ${formatCoordinates(o.lat, o.lng, o.accuracyMeters)}`,
    `[订单] ${buildOrderHash(o.orderNo)}`,
  ];
}

/**
 * SHA-256 十六进制摘要（WebCrypto，浏览器 / Node ≥20 通用）。
 * 输入可为字符串（UTF-8）、Uint8Array 或 ArrayBuffer。
 */
export async function sha256Hex(
  input: string | ArrayBuffer | Uint8Array,
): Promise<string> {
  const data =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** dataURL（`data:<mime>;base64,<payload>`）→ 原始字节；非法输入返回 null。 */
export function decodeDataUrlToBytes(dataUrl: string): Uint8Array | null {
  const m = /^data:[^;,]+;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!m) return null;
  try {
    const raw = atob(m[1]!);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** 由图像源取原始字节（供无 DOM 降级路径计算原图哈希）。 */
async function sourceBytes(
  imageSource: string | Blob,
): Promise<Uint8Array | null> {
  if (typeof imageSource === "string") {
    return decodeDataUrlToBytes(imageSource);
  }
  try {
    return new Uint8Array(await imageSource.arrayBuffer());
  } catch {
    return null;
  }
}

/** 4:3 中心裁剪源矩形（纯函数：宽高 → 源裁剪框）。 */
export function fit43SourceRect(
  width: number,
  height: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (width <= 0 || height <= 0) {
    return { sx: 0, sy: 0, sw: 0, sh: 0 };
  }
  if (width / height > WATERMARK_RATIO) {
    const sw = height * WATERMARK_RATIO;
    return { sx: (width - sw) / 2, sy: 0, sw, sh: height };
  }
  const sh = width / WATERMARK_RATIO;
  return { sx: 0, sy: (height - sh) / 2, sw: width, sh };
}

interface CanvasLike {
  width: number;
  height: number;
  getContext(contextId: "2d"): CanvasRenderingContext2D | null;
  toDataURL(type?: string, quality?: number): string;
  toBlob(callback: (blob: Blob | null) => void, type?: string, quality?: number): void;
}

interface ImageLike {
  naturalWidth: number;
  naturalHeight: number;
}

/** 确定性降级路径：无 DOM / 无 2D / 图像加载失败 → 仅计算源哈希，不压制（红线 5）。 */
async function degrade(
  imageSource: string | Blob,
  lines: string[],
  reason: string,
): Promise<WatermarkResult> {
  const bytes = await sourceBytes(imageSource);
  let sha256 = "";
  try {
    sha256 = bytes
      ? await sha256Hex(bytes)
      : await sha256Hex(`oto-watermark:${lines.join("|")}`);
  } catch {
    sha256 = "";
  }
  return {
    blob: null,
    dataUrl: "",
    sha256,
    watermarkApplied: false,
    width: 0,
    height: 0,
    lines,
    reason,
  };
}

/**
 * 主入口：Canvas 本地时空防伪水印压制。
 *
 * - 浏览器：绘制 4:3 + 右下角遮罩水印 → Blob / dataURL / SHA-256；
 * - 无 DOM（Node 单测 / SSR 首帧）：确定性降级，返回源哈希与
 *   `watermarkApplied:false`，绝不抛出未捕获异常（红线 5）。
 */
export async function applyTimestampGeoWatermark(
  imageSource: string | Blob,
  options: WatermarkOptions,
): Promise<WatermarkResult> {
  const lines = buildWatermarkLines(options);
  try {
    const canvas = options.canvasFactory
      ? options.canvasFactory()
      : typeof document !== "undefined"
        ? (document.createElement("canvas") as HTMLCanvasElement)
        : null;
    if (!canvas) return degrade(imageSource, lines, "no-canvas-environment");

    const ctx = canvas.getContext("2d");
    if (!ctx) return degrade(imageSource, lines, "canvas-2d-unavailable");

    const img = await loadImage(imageSource);
    if (!img) return degrade(imageSource, lines, "image-load-failed");

    const { sx, sy, sw, sh } = fit43SourceRect(img.naturalWidth, img.naturalHeight);
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    ctx.drawImage(img as HTMLImageElement, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    paintWatermark(ctx, canvas.width, canvas.height, lines);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const blob = await canvasToBlob(canvas);
    const outBytes = decodeDataUrlToBytes(dataUrl);
    const sha256 = outBytes ? await sha256Hex(outBytes) : await sha256Hex(dataUrl);

    return {
      blob,
      dataUrl,
      sha256,
      watermarkApplied: true,
      width: canvas.width,
      height: canvas.height,
      lines,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return degrade(imageSource, lines, `unexpected:${detail}`);
  }
}

/** 右下角半透明遮罩 + 三行文本水印（视觉样式常量集中于此处）。 */
export function paintWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lines: string[],
): void {
  const margin = 12;
  const lineHeight = 18;
  const fontSize = 13;
  const overlayW = Math.min(width * WATERMARK_OVERLAY_RATIO, width - margin * 2);
  const overlayH = lines.length * lineHeight + 14;
  const x = width - margin - overlayW;
  const y = height - margin - overlayH;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x, y, overlayW, overlayH);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = `${fontSize}px "SF Mono", "Consolas", monospace`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  lines.forEach((line, i) => {
    ctx.fillText(line, x + 8, y + 7 + fontSize / 2 + i * lineHeight);
  });
  ctx.restore();
}

async function loadImage(
  imageSource: string | Blob,
): Promise<ImageLike | null> {
  try {
    const img = new Image();
    img.decoding = "async";
    const src =
      typeof imageSource === "string"
        ? imageSource
        : URL.createObjectURL(imageSource);
    const ok = await new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
    if (src.startsWith("blob:") && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(src);
    }
    return ok ? img : null;
  } catch {
    return null;
  }
}

function canvasToBlob(canvas: CanvasLike): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
    } catch {
      resolve(null);
    }
  });
}
