import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";

export const GET = withAuth(async (_request: Request, user: any) => {
  try {
    const supabase = getServiceClient();

    const { data: disputes, error } = await supabase
      .from("order_disputes")
      .select("*")
      .or(`initiator_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(disputes ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "查询维权列表失败" }, { status: 500 });
  }
});
