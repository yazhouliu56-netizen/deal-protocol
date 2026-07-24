import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { generateAIArbitrationReport } from "@/lib/ai-arbitrator";

export const GET = withAuth(async (request: Request, user: any) => {
  try {
    const url = new URL(request.url);
    const segments = url.pathname.split("/");
    const idIdx = segments.indexOf("disputes") + 1;
    const disputeId = segments[idIdx];

    if (!disputeId) {
      return NextResponse.json({ error: "缺少维权记录 ID" }, { status: 400 });
    }

    const report = await generateAIArbitrationReport(disputeId);
    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "AI 仲裁裁决失败" }, { status: 500 });
  }
});

export const POST = GET;
