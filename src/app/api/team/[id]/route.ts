import { NextResponse } from "next/server";
import { getTeamInfo } from "@/modules/m14-team-formation/team-formation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const info = await getTeamInfo(id);

    if (!info.leader.id) {
      return NextResponse.json({ error: "团队不存在" }, { status: 404 });
    }

    return NextResponse.json(info);
  } catch (err) {
    console.error("team info error:", err);
    return NextResponse.json({ error: "获取团队信息失败" }, { status: 500 });
  }
}
