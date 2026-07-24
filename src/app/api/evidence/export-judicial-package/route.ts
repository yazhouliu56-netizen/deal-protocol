import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { exportJudicialPackage } from "@/lib/ai-arbitrator";

export const GET = withAuth(async (request: Request, user: any) => {
  try {
    const { searchParams } = new URL(request.url);
    const disputeId = searchParams.get("disputeId");

    if (!disputeId) {
      return NextResponse.json({ error: "缺少 disputeId 参数" }, { status: 400 });
    }

    const judicialPackage = await exportJudicialPackage(disputeId);
    return NextResponse.json({ success: true, judicialPackage });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "导出司法举证包失败" }, { status: 500 });
  }
});
