import { NextResponse } from "next/server";
import { generateAmmoFromSentence } from "@/adapters/ai/sentence-to-ammo";
import { compileAmmoPrompt } from "@/base/ai/prompt-compiler";

/**
 * 增长实验 · 一句话量产（/lab 看板后端）。
 * 薄层：编译预览 + 适配器直调（缺省 gateway decompose 任务）。
 * Key 留服务端，浏览器只收 JSON（函数字段会被 JSON 自然省略）。
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    sentence?: unknown;
    categoryHint?: unknown;
  };
  if (typeof body.sentence !== "string" || body.sentence.trim() === "") {
    return NextResponse.json({ error: "Missing sentence" }, { status: 400 });
  }
  const categoryHint =
    typeof body.categoryHint === "string" ? body.categoryHint : undefined;
  const compiled = compileAmmoPrompt(body.sentence, { categoryHint });
  const result = await generateAmmoFromSentence(body.sentence, { categoryHint });
  return NextResponse.json({
    ...result,
    compiled: {
      targetCategory: compiled.targetCategory,
      sanitizedInput: compiled.sanitizedInput,
      detectedLeak: compiled.detectedLeak,
      systemPrompt: compiled.systemPrompt,
      userPrompt: compiled.userPrompt,
    },
  });
}
