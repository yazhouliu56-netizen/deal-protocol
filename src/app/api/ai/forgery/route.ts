import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import {
  detectImageForgery,
  type ImageForgeryInput,
  type OrderGeoTimeContext,
} from "@/base/ai/forgery"

export const runtime = "nodejs"

export interface ForgeryApiRequest {
  /** 履约照片（URL / 存证键）。 */
  imageSource: string
  /** 打卡固化的存证指纹。 */
  expectedSha256?: string
  /** 当前照片 SHA-256（服务端计算或客户端上报）。 */
  actualSha256?: string
  /** 期望水印编码（打卡登记）。 */
  expectedWatermark?: string
  /** EXIF 元数据（上层解码）。 */
  exif?: {
    takenAt?: number | string
    takenLat?: number
    takenLng?: number
    missing?: boolean
    watermarkCode?: string
    watermarkSuspicious?: boolean
  }
  /** 订单时空上下文。 */
  orderContext?: OrderGeoTimeContext
  /** ELA 像素特征。 */
  ela?: { smoothness: number; spliceEdgeNoise: number }
}

export const POST = withAuth(async (req) => {
  try {
    const body = (await req.json()) as ForgeryApiRequest

    if (!body || typeof body.imageSource !== "string" || body.imageSource.trim().length === 0) {
      return NextResponse.json({ error: "imageSource is required" }, { status: 400 })
    }

    const report = await detectImageForgery(body as ImageForgeryInput)
    return NextResponse.json(report)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[Forgery] Unhandled:", message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})