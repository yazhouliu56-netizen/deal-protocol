import { NextResponse } from "next/server";
import { expressTeamInterest } from "@/modules/m14-team-formation/team-formation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { requestId, providerId } = body;

    if (!requestId || !providerId) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    const result = await expressTeamInterest(requestId, providerId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("team interest error:", err);
    return NextResponse.json({ error: "加入团队失败" }, { status: 500 });
  }
}
