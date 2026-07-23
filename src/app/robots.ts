import type { MetadataRoute } from "next"

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://deal-protocol-phi.vercel.app"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/demands",
          "/demands/*",
          "/landing",
          "/rights",
          "/orders",
          "/disputes",
          "/finance",
        ],
        disallow: [
          "/api/",
          "/dashboard/",
          "/admin/",
          "/chat/",
          "/register",
          "/login",
          "/profile",
          "/verification",
          "/payment/",
          "/console",
          "/sos",
          "/developer/",
          "/evidence/",
          "/_next/",
          "/offline",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
