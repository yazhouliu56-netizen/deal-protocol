import { NextResponse } from "next/server";
import { callLLMJson } from "@/lib/llm";

export async function POST(request: Request) {
  try {
    const { description } = await request.json();

    if (!description || typeof description !== "string") {
      return NextResponse.json({ error: "缺少项目描述" }, { status: 400 });
    }

    const result = await callLLMJson<{
      category: string;
      totalBudget: number;
      roles: { roleDesc: string; requiredSkills: string[]; reward: number }[];
    }>(
      `你是一个项目组队助手。根据用户的项目描述，提取以下结构化信息：
- category: 项目品类（如软件开发、装修、搬家）
- totalBudget: 总预算（数字，单位元）
- roles: 所需角色列表
  - roleDesc: 角色描述
  - requiredSkills: 所需技能列表
  - reward: 每人报酬（数字，单位元）

只返回 JSON 对象，不要其他文字。`,
      description,
    );

    return NextResponse.json({
      category: result.category ?? "",
      totalBudget: result.totalBudget ?? 0,
      roles: result.roles ?? [],
    });
  } catch (err) {
    console.error("structure-team error:", err);
    return NextResponse.json({ error: "智能解析失败" }, { status: 500 });
  }
}
