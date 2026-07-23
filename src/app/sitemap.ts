import type { MetadataRoute } from "next"
import { getSupabase } from "@/lib/supabase-client"

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://deal-protocol-phi.vercel.app"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE_URL}/demands`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/landing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/orders`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE_URL}/disputes`, lastModified: new Date(), changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE_URL}/finance`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE_URL}/rights`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/offline`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
  ]

  try {
    const supabase = getSupabase()
    const { data: demands, error } = await supabase
      .from("demands")
      .select("id, created_at")
      .in("status", ["PENDING", "MATCHING", "IN_PROGRESS"])

    if (error) return staticRoutes
    if (!demands || demands.length === 0) return staticRoutes

    const demandRoutes: MetadataRoute.Sitemap = demands.map((d) => ({
      url: `${BASE_URL}/demands/${d.id}`,
      lastModified: new Date(d.created_at),
      changeFrequency: "daily" as const,
      priority: 0.64,
    }))

    return [...staticRoutes, ...demandRoutes]
  } catch {
    return staticRoutes
  }
}
