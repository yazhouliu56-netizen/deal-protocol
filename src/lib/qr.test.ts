import { test } from "node:test";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import QRCode from "qrcode";
import jsQR from "jsqr";

/**
 * 真码↔真扫闭环验证（本地零浏览器依赖）：
 * qrcode 生成 PNG → pngjs 解码出像素 → jsQR 解码回字符串。
 * 证明 ShareKit 生成的真二维码能被 ScanMockSheet 的 jsQR 通道识别。
 */
async function qrRoundTrip(text: string): Promise<string | null> {
  const dataUrl = await QRCode.toDataURL(text, { width: 224, margin: 1 });
  const base64 = dataUrl.slice("data:image/png;base64,".length);
  const png = PNG.sync.read(Buffer.from(base64, "base64"));
  const code = jsQR(
    new Uint8ClampedArray(png.data),
    png.width,
    png.height,
    { inversionAttempts: "dontInvert" }
  );
  return code?.data ?? null;
}

test("qrRoundTrip: ShareKit 分享 URL 可被 jsQR 解码还原", async () => {
  const url = "http://localhost:3000/?wave=wave-1-abc&via=me-1";
  assert.equal(await qrRoundTrip(url), url);
});

test("qrRoundTrip: 真实线上域名的分享链接", async () => {
  const url = "https://oto.example.com/?wave=wave-9-xyz%20id&via=u-42";
  assert.equal(await qrRoundTrip(url), url);
});

test("qrRoundTrip: 不同 wave id 产生不同图案（内容随链接变化）", async () => {
  const a = await qrRoundTrip("http://x/?wave=wA&via=v");
  const b = await qrRoundTrip("http://x/?wave=wB&via=v");
  assert.equal(a, "http://x/?wave=wA&via=v");
  assert.equal(b, "http://x/?wave=wB&via=v");
  assert.notEqual(a, b);
});

test("qrRoundTrip: 中文文案链接（邀请话术兼容）", async () => {
  const url = "http://localhost:3000/?wave=羽毛球局&via=me";
  assert.equal(await qrRoundTrip(url), url);
});