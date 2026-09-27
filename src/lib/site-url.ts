/**
 * 站点 origin 单一来源（2026-09-27 Vercel env 收敛）：
 * - Production：读 NEXT_PUBLIC_SITE_URL（Vercel Production env，构建期烘焙）；
 * - Preview：不建固定条，读 Vercel 系统变量 VERCEL_URL（每次部署自动注入，
 *   构建期与运行期均可用，需补 https:// 协议头）；
 * - 本地：http://localhost:3000；生产无显式值兜底 phi 域名（理论不可达）。
 *
 * 注意：VERCEL_URL 仅服务端可用（无 NEXT_PUBLIC_ 前缀）。调用方中
 * layout/sitemap/robots/API 路由均为服务端，preview 回退有效；
 * 浏览器侧调用（如 track-metric）走相对路径，不依赖本函数返回值。
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  if (process.env.NODE_ENV === "production") return "https://deal-protocol-phi.vercel.app";
  return "http://localhost:3000";
}
