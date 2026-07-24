import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";

// P0-01: 统一代码路径 — 主力写入 protocols 表
export const POST = withAuth(async (request: Request, user: any) => {
  try {
    const supabase = getServiceClient();
    const { title, description, budget } = await request.json();

    if (!title || !description || !budget || typeof budget !== "number" || budget <= 0) {
      return NextResponse.json({ error: "Invalid parameters signature." }, { status: 400 });
    }

    const { data: protocol, error } = await supabase
      .from("protocols")
      .insert({
        demander_id: user.id,
        category: "家政",
        core_fields: { title, description },
        category_fields: { budget_min: budget, budget_max: budget },
        status: "pending_confirm",
        risk_tier: "low",
        response_mode: "grab_first",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, demand: protocol });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
});
