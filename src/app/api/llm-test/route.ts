// Debug endpoint — can be removed in production
import { NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: "缺少输入" }, { status: 400 });
    }

    const result = await callLLM(
      "你是一个服务分类专家。将用户输入分类为：维修、按摩、或保洁。只返回分类名称，不要其他内容。",
      text
    );

    return NextResponse.json({ category: result.trim() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "未知错误" },
      { status: 500 }
    );
  }
}
