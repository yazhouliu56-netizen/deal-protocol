import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getServiceClient } from "@/lib/supabase-client"

export const POST = withAuth(async (req, user) => {
  const supabase = getServiceClient()
  const { orderId, revieweeId, rating, comment } = await req.json()

  if (
    !orderId || !revieweeId || !rating ||
    typeof rating !== "number" || rating < 1 || rating > 5 ||
    !comment
  ) {
    return NextResponse.json({ error: "Parameters validation failed." }, { status: 400 })
  }

  if (user.id === revieweeId) {
    return NextResponse.json({ error: "Self-reviewing is strictly prohibited." }, { status: 400 })
  }

  const { data: order, error: orderErr } = await supabase
    .from("demands")
    .select("id, status, user_id, provider_id")
    .eq("id", orderId)
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: "Target order context not found." }, { status: 404 })
  }

  if (user.id !== order.user_id && user.id !== order.provider_id) {
    return NextResponse.json({ error: "Access denied: Not a contract partner." }, { status: 403 })
  }

  const { data: review, error: reviewErr } = await supabase
    .from("order_reviews")
    .insert({
      order_id: orderId,
      reviewer_id: user.id,
      reviewee_id: revieweeId,
      rating: rating,
      comment: comment.trim(),
    })
    .select()
    .single()

  if (reviewErr) {
    if (reviewErr.code === "23505") {
      return NextResponse.json(
        { error: "Duplicate submission detected for this order context." },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: reviewErr.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, review })
})
