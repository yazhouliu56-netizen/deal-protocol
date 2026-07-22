import { NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

const categories = ["维修", "按摩", "保洁"];

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "缺少输入" }, { status: 400 });
    }

    const prompt = `将用户的服务需求分类到以下三类之一：维修（家电/水电/家具维修）、按摩（上门推拿/理疗/放松）、保洁（日常/深度/开荒保洁）。
规则：
- 只返回一个分类名称：维修、按摩、或保洁
- 如果模糊不清，选择最可能的分类
- 不要任何解释或额外文字`;

    const result = await callLLM(prompt, text, { temperature: 0.1 });
    const category = result.trim();
    const valid = categories.includes(category) ? category : categories[0];

    return NextResponse.json({ category: valid });
  } catch (err) {
    console.error('LLM classify failed:', err);
    return NextResponse.json(
      { error: 'AI 分类服务暂时不可用' },
      { status: 503 }
    );
  }
}
