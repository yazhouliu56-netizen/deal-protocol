import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";
import { DEMAND_STATUSES } from "@/lib/demand/state";

export const POST = withAuth(async (request: Request, user: any) => {
  try {
    const supabase = getServiceClient();
    const { title, description, budget } = await request.json();

    if (!title || !description || !budget || typeof budget !== "number" || budget <= 0) {
      return NextResponse.json({ error: "Invalid parameters signature." }, { status: 400 });
    }

    const mockEmbedding = Array(1536).fill(0).map((_, i) => Math.cos(i * 0.03) / 10);

    const { data: demand, error } = await supabase
      .from("demands")
      .insert({
        user_id: user.id,
        title,
        description,
        budget,
        status: DEMAND_STATUSES.PENDING,
        embedding: mockEmbedding
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, demand });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
});
