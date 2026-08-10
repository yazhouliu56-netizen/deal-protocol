/**
 * 扫码解析：分享链接（ShareKit 生成 /?wave=xxx&via=yyy）→ wave id。
 * 支持完整 URL 与裸路径两种形态；无效输入返回 null。
 */
export function parseWaveUrl(text: string): string | null {
  if (!text) return null;
  let raw: string | null = null;
  try {
    raw = new URL(text).searchParams.get("wave");
  } catch {
    raw = /[?&]wave=([^&#\s]+)/.exec(text)?.[1] ?? null;
  }
  if (!raw) return null;
  let id: string;
  try {
    id = decodeURIComponent(raw).trim();
  } catch {
    return null;
  }
  return id || null;
}