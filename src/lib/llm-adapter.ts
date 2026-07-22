// LLM 适配器 — Gemini 3.5 Flash
// 使用原生 fetch 调用 Google Gemini API。
// 有 tools 时不强制 responseMimeType，否则强制 JSON 输出。

export interface LLMConfig {
  provider: 'gemini'
  model: string
  apiKey?: string
}

export interface FunctionCallTool {
  name: string
  description?: string
  parameters: Record<string, unknown>
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const defaultConfig: LLMConfig = {
  provider: 'gemini',
  model: 'gemini-3.5-flash',
  apiKey: process.env.GEMINI_API_KEY,
}

function buildGeminiContents(messages: LLMMessage[]) {
  let systemInstruction: string | undefined
  const contents: { role: string; parts: { text: string }[] }[] = []

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = (systemInstruction ?? '') + msg.content + '\n'
    } else {
      const role = msg.role === 'assistant' ? 'model' : 'user'
      contents.push({ role, parts: [{ text: msg.content }] })
    }
  }

  return { contents, systemInstruction }
}

function buildGeminiTools(tools: FunctionCallTool[]) {
  return tools.map((t) => ({
    functionDeclarations: [
      {
        name: t.name,
        description: t.description ?? '',
        parameters: t.parameters,
      },
    ],
  }))
}

export async function callLLM(
  messages: LLMMessage[],
  tools?: FunctionCallTool[],
  config: LLMConfig = defaultConfig,
): Promise<string> {
  if (!config.apiKey) {
    throw new Error('GEMINI_API_KEY 未配置，无法调用 Gemini 3.5 Flash')
  }

  const { contents, systemInstruction } = buildGeminiContents(messages)

  const generationConfig: Record<string, unknown> = {
    temperature: 0.3,
    maxOutputTokens: 8192,
  }

  if (!tools || tools.length === 0) {
    generationConfig.responseMimeType = 'application/json'
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig,
  }

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] }
  }

  if (tools && tools.length > 0) {
    body.tools = buildGeminiTools(tools)
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini API error (${response.status}): ${errText}`)
  }

  const json = await response.json()
  const candidate = json.candidates?.[0]

  if (!candidate) {
    throw new Error('Gemini returned no candidates')
  }

  const parts = candidate.content?.parts ?? []

  const textParts = parts
    .filter((p: { text?: string }) => typeof p.text === 'string')
    .map((p: { text: string }) => p.text)

  const functionCallParts = parts.filter((p: { functionCall?: unknown }) => p.functionCall)

  if (functionCallParts.length > 0) {
    return JSON.stringify(functionCallParts[0].functionCall)
  }

  return textParts.join('')
}

export function buildFunctionTool(
  name: string,
  schema: Record<string, unknown>,
): FunctionCallTool {
  return {
    name,
    description: `Extract structured data for ${name}`,
    parameters: {
      type: 'object',
      properties: schema,
      required: [],
    },
  }
}
