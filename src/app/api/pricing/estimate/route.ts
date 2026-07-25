import { NextRequest, NextResponse } from 'next/server'
import {
  estimateDynamicPricingAndMatchRate,
  type MultiModalPricingInput,
} from '@/modules/m03-category-config/pricing-engine'

export async function POST(req: NextRequest) {
  try {
    const body: MultiModalPricingInput = await req.json()

    if (!body.categorySlug) {
      return NextResponse.json(
        { success: false, error: 'categorySlug is required' },
        { status: 400 },
      )
    }

    const result = await estimateDynamicPricingAndMatchRate(body)

    return NextResponse.json({ success: true, result }, { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
