import { NextResponse } from "next/server"
import { getAIModel } from "@/lib/ai-provider"
import { generateText } from "ai"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audio = formData.get("audio") as Blob | null
    const rawText = formData.get("rawText") as string | null

    let inputText = rawText

    if (audio) {
      const arrayBuffer = await audio.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString("base64")
      const model = getAIModel()
      const { text: transcription } = await generateText({
        model,
        messages: [
          {
            role: "system",
            content: "You are a Mandarin Chinese speech-to-text transcriber. Transcribe the audio exactly as spoken. Output ONLY the transcribed text, nothing else.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe this audio recording:" },
              { type: "data", data: base64, mimeType: audio.type || "audio/webm" },
            ],
          },
        ],
      })
      inputText = transcription
    }

    if (!inputText || !inputText.trim()) {
      return NextResponse.json({ success: false, error: "No input text or audio provided" }, { status: 400 })
    }

    const model = getAIModel()
    const { text: extraction } = await generateText({
      model,
      messages: [
        {
          role: "system",
          content: `You are a protocol extraction assistant. Extract a structured service protocol from the user's request.

Respond with a JSON object (ONLY valid JSON, no markdown) in this exact format:
{
  "category": "家政 | 交友 | 按摩 | 医疗陪护 | 其他",
  "title": "简短标题",
  "budget": 数字(元),
  "pricing_type": "一口价 | 按小时计费",
  "service_time": "服务时间描述",
  "address_hint": "地点线索",
  "special_requirements": ["要求1", "要求2"]
}`,
        },
        { role: "user", content: inputText },
      ],
      temperature: 0.2,
    })

    let protocol: Record<string, unknown>
    try {
      protocol = JSON.parse(extraction)
    } catch {
      return NextResponse.json({ success: false, error: "Failed to parse protocol extraction from AI" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      text: inputText,
      protocol,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
