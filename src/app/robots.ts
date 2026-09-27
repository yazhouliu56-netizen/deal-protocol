import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/site-url"

const BASE_URL = getSiteUrl()

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Step 1-D 出清批次：allow/disallow 中已删除的旧宇宙页面路径同步移除
        allow: [
          "/",
          "/landing",
          "/rights",
        ],
        disallow: [
          "/api/",
          "/admin/",
          "/register",
          "/login",
          "/profile",
          "/verification",
          "/_next/",
          "/offline",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
