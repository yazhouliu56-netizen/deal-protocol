// scripts/vendor-fonts.mjs — 字体自托管 vendoring（CI 构建无 Google Fonts 出站时 next/font/google 直接崩）。
// 用法：node scripts/vendor-fonts.mjs（需出站访问 fonts.googleapis.com / fonts.gstatic.com）。
// 拉取 latin 子集 variable woff2（Nunito 200-1000 / Geist Mono 100-900），落盘 public/fonts/，
// 由 src/app/(oto)/layout.tsx 经 next/font/local 消费（构建期零网络，离线可复现）。
// 版本 pin：URL 内嵌 v32/v6，升级须重跑本脚本并 review 渲染 diff。
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "fonts");
mkdirSync(outDir, { recursive: true });

const FONTS = [
  {
    file: "nunito-latin-var.woff2",
    // Nunito latin variable（700/800/900 同文件；声明 200-1000 全覆盖）。
    url: "https://fonts.gstatic.com/s/nunito/v32/XRXV3I6Li01BKofINeaB.woff2",
  },
  {
    file: "geist-mono-latin-var.woff2",
    // Geist Mono latin variable（400/500/700 同文件；声明 100-900 全覆盖）。
    url: "https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrcdmg.woff2",
  },
];

for (const f of FONTS) {
  const res = await fetch(f.url);
  if (!res.ok) throw new Error(`下载失败 ${f.url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 5000 || buf.subarray(0, 4).toString() !== "wOF2") {
    throw new Error(`非 woff2 内容 ${f.url}（${buf.length} 字节）`);
  }
  writeFileSync(join(outDir, f.file), buf);
  console.log(`✓ ${f.file}（${buf.length} 字节）`);
}
