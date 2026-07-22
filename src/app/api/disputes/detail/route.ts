import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";

export const GET = withAuth(async (request: Request, user: any) => {
  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "缺少维权记录 ID" }, { status: 400 });
    }

    const { data: dispute, error } = await supabase
      .from("order_disputes")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !dispute) {
      return NextResponse.json({ error: "未找到维权记录" }, { status: 404 });
    }

    if (dispute.initiator_id !== user.id) {
      return NextResponse.json({ error: "无权查看非本人相关的维权记录" }, { status: 403 });
    }

    return NextResponse.json(dispute);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "查询维权详情失败" }, { status: 500 });
  }
});
