const GEMINI_MODEL = "gemini-3.5-flash"

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number }
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY env var")
  }

  const body = {
    contents: [
      { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
    ],
    generationConfig: {
      temperature: options?.temperature ?? 0.3,
      maxOutputTokens: 8192,
    },
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => "")
    throw new Error(`Gemini API error ${res.status}: ${errBody.slice(0, 200)}`)
  }

  const json = await res.json()
  const parts = json.candidates?.[0]?.content?.parts ?? []
  return parts.map((p: { text?: string }) => p.text ?? "").join("")
}

export async function callLLMJson<T>(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number }
): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY env var")
  }

  const body = {
    contents: [
      { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: options?.temperature ?? 0.3,
      maxOutputTokens: 8192,
    },
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => "")
    throw new Error(`Gemini API error ${res.status}: ${errBody.slice(0, 200)}`)
  }

  const json = await res.json()
  const parts = json.candidates?.[0]?.content?.parts ?? []
  const raw = parts.map((p: { text?: string }) => p.text ?? "").join("")
  return JSON.parse(raw) as T
}
