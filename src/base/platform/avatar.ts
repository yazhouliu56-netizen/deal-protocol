"use client";

/** 头像文件 → 压缩后 dataURL（96×96 JPEG）。超出限制或非图片返回 null。 */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_SIZE = 96;

export async function fileToAvatarDataUrl(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  if (file.size > AVATAR_MAX_BYTES) return null;
  const raw = await new Promise<string | null>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });
  if (!raw) return null;
  return compressImage(raw);
}

/** canvas 压缩到正方形 JPEG（MIME 兼容性最高，base64 体积可控）。 */
export function compressImage(dataUrl: string, size = AVATAR_SIZE): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("no-canvas-2d"));
        return;
      }
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(new Error("image-load-failed"));
    img.src = dataUrl;
  });
}