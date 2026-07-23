import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-client";
import { DEMAND_STATUSES } from "@/lib/demand/state";

export async function GET(request: Request) {
  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || DEMAND_STATUSES.PENDING;
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const { data: demands, error } = await supabase
      .from("demands")
      .select("id, user_id, title, description, budget, status, created_at")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(demands || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}
