import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { createTeamProtocol } from "@/modules/m14-team-formation/team-formation";

export const POST = withAuth(async (req, user) => {
  try {
    const body = await req.json();
    const { category, description, totalBudget, teamRequests } = body;

    if (!category || !teamRequests || !Array.isArray(teamRequests) || teamRequests.length === 0) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    const result = await createTeamProtocol({
      leaderId: user.id,
      category,
      coreFields: { description: description ?? "" },
      categoryFields: {},
      totalBudget: Number(totalBudget) ?? 0,
      teamRequests: teamRequests.map((r: { roleDesc: string; requiredSkills: string[]; reward: number }) => ({
        roleDesc: r.roleDesc,
        requiredSkills: r.requiredSkills ?? [],
        reward: Number(r.reward) ?? 0,
      })),
    });

    if (!result.success) {
      return NextResponse.json({ error: "创建团队失败" }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("team create error:", err);
    return NextResponse.json({ error: "创建团队失败" }, { status: 500 });
  }
});
