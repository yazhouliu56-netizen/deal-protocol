import type { MetadataRoute } from "next"

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://deal-protocol-phi.vercel.app"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Step 1-D 出清批次：旧宇宙页面壳（demands/orders/disputes/finance）已物理删除，
  // sitemap 仅枚举存活路由；demands 动态段随宿主消亡一并移除。
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE_URL}/landing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/rights`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/offline`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
  ]

  return staticRoutes
}
