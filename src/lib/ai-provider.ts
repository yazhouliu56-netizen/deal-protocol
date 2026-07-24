import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { google } from "@ai-sdk/google"
const MOCK = "mock-"

export function getAIModel() {
  const provider = process.env.AI_PROVIDER || "deepseek"
  const dsKey = process.env["DEEPSEEK_API_KEY"]

  if (provider === "deepseek" || (dsKey && !dsKey.includes("placeholder"))) {
    const baseURL = process.env["DEEPSEEK_BASE_URL"] || "https://api.deepseek.com/v1"
    const apiKey = dsKey || MOCK + "key"

    const deepseek = createOpenAICompatible({
      name: "deepseek",
      baseURL,
      apiKey,
    })

    return deepseek("deepseek-chat")
  }

  if (process.env["GEMINI_API_KEY"] && !process.env["GEMINI_API_KEY"].includes("placeholder")) {
    return google("gemini-1.5-flash")
  }

  const fallbackProvider = createOpenAICompatible({
    name: `${MOCK}ai`,
    baseURL: "https://api.deepseek.com/v1",
    apiKey: MOCK + "key",
  })
  return fallbackProvider("deepseek-chat")
}
