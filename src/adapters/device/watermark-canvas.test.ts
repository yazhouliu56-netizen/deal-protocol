import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import {
  applyTimestampGeoWatermark,
  buildOrderHash,
  buildWatermarkLines,
  decodeDataUrlToBytes,
  fit43SourceRect,
  formatCoordinates,
  formatTimestamp,
  sha256Hex,
} from "./watermark-canvas.ts";

/** 独立于被测函数的 SHA-256（node:crypto），避免自证。 */
function sha256ViaNodeCrypto(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

test("formatTimestamp: 输出 YYYY-MM-DD HH:mm:ss 本地时区格式", () => {
  const ts = new Date(2026, 7, 16, 9, 8, 7).getTime();
  assert.equal(formatTimestamp(ts), "2026-08-16 09:08:07");
});

test("formatTimestamp: 月/日/时/分/秒补零", () => {
  const ts = new Date(2026, 0, 2, 3, 4, 5).getTime();
  assert.equal(formatTimestamp(ts), "2026-01-02 03:04:05");
});

test("formatCoordinates: 北纬东经 + 精度 ±N m", () => {
  assert.equal(formatCoordinates(31.2304, 121.4737, 25), "31.23040°N 121.47370°E ±25m");
});

test("formatCoordinates: 南纬西经（负值）+ 无精度时不带 ±", () => {
  assert.equal(formatCoordinates(-33.8688, -151.2093), "33.86880°S 151.20930°W");
});

test("formatCoordinates: 精度为 0 视为未提供", () => {
  assert.equal(formatCoordinates(10.5, 20.25, 0), "10.50000°N 20.25000°E");
});

test("buildOrderHash: 确定性 + wm- 前缀 + 固定 12 位十六进制", () => {
  const h = buildOrderHash("order-20260816-001");
  assert.equal(h, buildOrderHash("order-20260816-001"));
  assert.ok(h.startsWith("wm-"));
  assert.equal(h.length, 3 + 12);
  assert.match(h.slice(3), /^[0-9a-f]{12}$/);
});

test("buildOrderHash: 不同订单号产出不同哈希", () => {
  assert.notEqual(buildOrderHash("order-001"), buildOrderHash("order-002"));
  assert.notEqual(buildOrderHash(""), buildOrderHash("order-001"));
});

test("buildWatermarkLines: 三行水印（时间/坐标/订单哈希）", () => {
  const lines = buildWatermarkLines({
    lat: 31.2304,
    lng: 121.4737,
    timestamp: new Date(2026, 7, 16, 9, 8, 7).getTime(),
    orderNo: "order-001",
    accuracyMeters: 25,
  });
  assert.equal(lines.length, 3);
  assert.equal(lines[0], "[时间] 2026-08-16 09:08:07");
  assert.equal(lines[1], "[坐标] 31.23040°N 121.47370°E ±25m");
  assert.ok(lines[2]!.startsWith("[订单] wm-"));
});

test("sha256Hex: 已知向量 abc → ba7816bf…", async () => {
  assert.equal(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.equal(
    await sha256Hex(new TextEncoder().encode("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("decodeDataUrlToBytes: base64 dataURL 解码还原字节 / 非法输入返回 null", () => {
  const bytes = new TextEncoder().encode("oto-evidence");
  const b64 = Buffer.from(bytes).toString("base64");
  const decoded = decodeDataUrlToBytes(`data:image/png;base64,${b64}`);
  assert.ok(decoded);
  assert.deepEqual(decoded, bytes);
  assert.equal(decodeDataUrlToBytes("not-a-data-url"), null);
  assert.equal(decodeDataUrlToBytes("data:image/png;base64,!!!invalid!!!"), null);
});

test("fit43SourceRect: 宽图横向中心裁剪到 4:3", () => {
  const r = fit43SourceRect(6000, 3000);
  assert.equal(r.sw, 4000);
  assert.equal(r.sh, 3000);
  assert.equal(r.sx, 1000);
  assert.equal(r.sy, 0);
});

test("fit43SourceRect: 高图纵向中心裁剪到 4:3", () => {
  const r = fit43SourceRect(300, 600);
  assert.equal(r.sw, 300);
  assert.equal(r.sh, 225);
  assert.equal(r.sx, 0);
  assert.equal(r.sy, 187.5);
});

test("fit43SourceRect: 已是 4:3 原样输出", () => {
  const r = fit43SourceRect(400, 300);
  assert.deepEqual(r, { sx: 0, sy: 0, sw: 400, sh: 300 });
});

test("fit43SourceRect: 非法尺寸防御（不抛异常）", () => {
  assert.deepEqual(fit43SourceRect(0, 0), { sx: 0, sy: 0, sw: 0, sh: 0 });
  assert.deepEqual(fit43SourceRect(-5, 10), { sx: 0, sy: 0, sw: 0, sh: 0 });
});

test("无 DOM 环境：dataURL 源确定性降级（红线 5，不抛异常）", async () => {
  const bytes = new TextEncoder().encode("oto-evidence-bytes");
  const b64 = Buffer.from(bytes).toString("base64");
  const dataUrl = `data:image/jpeg;base64,${b64}`;
  const result = await applyTimestampGeoWatermark(dataUrl, {
    lat: 31.2304,
    lng: 121.4737,
    timestamp: new Date(2026, 7, 16, 9, 8, 7).getTime(),
    orderNo: "order-001",
    accuracyMeters: 25,
  });
  assert.equal(result.watermarkApplied, false);
  assert.equal(result.reason, "no-canvas-environment");
  assert.equal(result.blob, null);
  assert.equal(result.dataUrl, "");
  assert.equal(result.width, 0);
  assert.equal(result.height, 0);
  assert.equal(result.sha256, sha256ViaNodeCrypto(bytes));
  assert.equal(result.lines.length, 3);
});

test("无 DOM 环境：Blob 源降级哈希 = Blob 字节哈希", async () => {
  const bytes = new Uint8Array([9, 8, 7, 6, 5, 4]);
  const blob = new Blob([bytes], { type: "image/jpeg" });
  const result = await applyTimestampGeoWatermark(blob, {
    lat: 1,
    lng: 2,
    timestamp: 0,
    orderNo: "o1",
  });
  assert.equal(result.watermarkApplied, false);
  assert.equal(result.sha256, sha256ViaNodeCrypto(bytes));
});

test("canvasFactory 返回 null：走 no-canvas-environment 降级", async () => {
  const result = await applyTimestampGeoWatermark("data:image/png;base64,AA==", {
    lat: 1,
    lng: 2,
    timestamp: 0,
    orderNo: "o1",
    canvasFactory: () => null,
  });
  assert.equal(result.watermarkApplied, false);
  assert.equal(result.reason, "no-canvas-environment");
});

/** 伪造 canvas + 2D ctx（记录绘制调用序列），在 Node 环境驱动真实绘制路径。 */
function makeFakeCanvas2d(fakeDataUrl: string, fakeBlobBytes: Uint8Array) {
  const styleCalls: string[] = [];
  const drawCalls: string[] = [];
  let toDataUrlCalls = 0;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: () => {
        drawCalls.push("drawImage");
      },
      fillRect: () => {
        drawCalls.push("fillRect");
      },
      fillText: () => {
        drawCalls.push("fillText");
      },
      save: () => {
        drawCalls.push("save");
      },
      restore: () => {
        drawCalls.push("restore");
      },
      set fillStyle(v: string) {
        styleCalls.push(`fillStyle=${v}`);
      },
      set font(v: string) {
        styleCalls.push(`font=${v}`);
      },
      textBaseline: "middle",
      textAlign: "left",
    }),
    toDataURL: () => {
      toDataUrlCalls++;
      return fakeDataUrl;
    },
    toBlob: (cb: (b: Blob | null) => void) => {
      cb(new Blob([fakeBlobBytes as BlobPart], { type: "image/jpeg" }));
    },
  };
  return { canvas, styleCalls, drawCalls, dataUrlCalls: () => toDataUrlCalls };
}

/** 伪造 Image（src 赋值后异步 onload），模拟 4000×3000 原图。 */
class FakeImage {
  naturalWidth = 4000;
  naturalHeight = 3000;
  decoding = "async";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = "";
  set src(v: string) {
    this._src = v;
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
  get src() {
    return this._src;
  }
}

test("浏览器路径：fake canvas 完整绘制 4:3 + 水印 + 输出 Blob/dataUrl/哈希", async () => {
  const fakeBytes = new Uint8Array([1, 2, 3, 4, 5]);
  const fakeDataUrl = `data:image/jpeg;base64,${Buffer.from(fakeBytes).toString("base64")}`;
  const { canvas, styleCalls, drawCalls, dataUrlCalls } = makeFakeCanvas2d(fakeDataUrl, fakeBytes);
  const prevImage = (globalThis as { Image?: unknown }).Image;
  (globalThis as { Image: unknown }).Image = FakeImage;

  try {
    const result = await applyTimestampGeoWatermark(fakeDataUrl, {
      lat: 31.2304,
      lng: 121.4737,
      timestamp: new Date(2026, 7, 16, 9, 8, 7).getTime(),
      orderNo: "order-001",
      accuracyMeters: 25,
      canvasFactory: () => canvas as unknown as HTMLCanvasElement,
    });

    assert.equal(result.watermarkApplied, true);
    assert.equal(result.width, 4000);
    assert.equal(result.height, 3000);
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.dataUrl, fakeDataUrl);
    assert.equal(result.sha256, sha256ViaNodeCrypto(fakeBytes));
    assert.equal(result.lines[0], "[时间] 2026-08-16 09:08:07");
    assert.deepEqual(drawCalls, ["drawImage", "save", "fillRect", "fillText", "fillText", "fillText", "restore"]);
    assert.ok(styleCalls.some((s) => s === "fillStyle=rgba(0,0,0,0.55)"));
    assert.ok(styleCalls.some((s) => s.startsWith("fillStyle=rgba(255,255,255,")));
    assert.ok(styleCalls.some((s) => s.startsWith("font=")));
    assert.equal(dataUrlCalls(), 1);
  } finally {
    if (prevImage === undefined) {
      delete (globalThis as { Image?: unknown }).Image;
    } else {
      (globalThis as { Image: unknown }).Image = prevImage;
    }
  }
});

test("paintWatermark 独立可用：右下方遮罩 + 每行文本填充（纯函数级）", async () => {
  const fakeBytes = new Uint8Array([5, 4, 3]);
  const fakeDataUrl = `data:image/jpeg;base64,${Buffer.from(fakeBytes).toString("base64")}`;
  const { canvas, drawCalls, styleCalls } = makeFakeCanvas2d(fakeDataUrl, fakeBytes);
  const lines = ["[时间] 2026-08-16 09:08:07", "[坐标] 31.23040°N 121.47370°E ±25m", "[订单] wm-a1b2c3d4e5f6"];
  const prevImage = (globalThis as { Image?: unknown }).Image;
  (globalThis as { Image: unknown }).Image = FakeImage;
  try {
    const result = await applyTimestampGeoWatermark(fakeDataUrl, {
      lat: 31.2304,
      lng: 121.4737,
      timestamp: new Date(2026, 7, 16, 9, 8, 7).getTime(),
      orderNo: "order-001",
      accuracyMeters: 25,
      canvasFactory: () => canvas as unknown as HTMLCanvasElement,
    });
    assert.equal(result.watermarkApplied, true);
    assert.ok(drawCalls.includes("fillRect"));
    const textCalls = drawCalls.filter((c) => c === "fillText").length;
    assert.equal(textCalls, lines.length);
    assert.ok(styleCalls.includes("fillStyle=rgba(0,0,0,0.55)"));
  } finally {
    if (prevImage === undefined) {
      delete (globalThis as { Image?: unknown }).Image;
    } else {
      (globalThis as { Image: unknown }).Image = prevImage;
    }
  }
});
