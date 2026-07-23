import { ImageResponse } from "next/og"
import { getSupabase } from "@/lib/supabase-client"

export const runtime = "edge"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;600;700&display=swap",
      { headers: { "User-Agent": "Mozilla/5.0" } },
    ).then((r) => r.text())
    const url = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1]
    if (!url) return null
    return fetch(url).then((r) => r.arrayBuffer())
  } catch {
    return null
  }
}

type Props = {
  params: Promise<{ id: string }>
}

export default async function GET({ params }: Props) {
  const { id } = await params
  const fontData = await loadFont()

  let title = ""
  let budget = ""
  let category = ""
  let status = ""

  try {
    const supabase = getSupabase()
    const { data } = await supabase
      .from("demands")
      .select("title, budget, category, status")
      .eq("id", id)
      .single()

    if (data) {
      title = data.title || ""
      budget = data.budget != null ? `¥${Number(data.budget).toLocaleString()}` : ""
      category = data.category || ""
      status = data.status || ""
    }
  } catch {
    // graceful fallback for build-time rendering
  }

  const isActive = ["PENDING", "MATCHING", "IN_PROGRESS"].includes(status)

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          position: "relative",
          overflow: "hidden",
          padding: 64,
        }}
      >
        {/* decorative blobs */}
        <div
          style={{
            position: "absolute",
            top: -100,
            right: -100,
            width: 350,
            height: 350,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(34,211,238,0.10) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -80,
            left: -80,
            width: 250,
            height: 250,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)",
          }}
        />

        {/* top bar: brand + identifier */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 48,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="#38bdf8" />
              <path d="M14 24L22 32L34 18" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc", letterSpacing: "-0.02em" }}>
              Deal Protocol
            </span>
          </div>
          {isActive && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 16px",
                borderRadius: 999,
                background: "rgba(34,211,238,0.15)",
                border: "1px solid rgba(34,211,238,0.3)",
                fontSize: 15,
                fontWeight: 600,
                color: "#67e8f9",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" fill="#22d3ee" />
              </svg>
              担保托管交易中
            </div>
          )}
        </div>

        {/* demand title */}
        <div
          style={{
            fontSize: 40,
            fontWeight: 700,
            color: "#f1f5f9",
            lineHeight: 1.3,
            maxWidth: 900,
            marginBottom: 32,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {title || "服务需求"}
        </div>

        {/* bottom row: budget + category */}
        {budget || category ? (
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: "auto" }}>
            {budget && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  borderRadius: 12,
                  background: "rgba(251,191,36,0.12)",
                  border: "1px solid rgba(251,191,36,0.2)",
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#fbbf24",
                }}
              >
                {budget}
              </div>
            )}
            {category && (
              <div
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  fontSize: 18,
                  fontWeight: 500,
                  color: "#94a3b8",
                }}
              >
                {category}
              </div>
            )}
          </div>
        ) : null}
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [{ name: "NotoSansSC", data: fontData, style: "normal" as const }]
        : undefined,
    },
  )
}
