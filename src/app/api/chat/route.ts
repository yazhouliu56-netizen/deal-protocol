import { streamText } from "ai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { auth } from "@/lib/auth"

const gh = createOpenAICompatible({
  name: "github",
  baseURL: "https://models.inference.ai.azure.com",
  headers: {
    Authorization: `Bearer ${process.env.OPENCODE_GITHUB_TOKEN}`,
  },
})

const model = gh.chatModel("gpt-4o-mini")

export async function POST(request: Request) {
  let { messages, userContext } = await request.json()

  if (!userContext) {
    const session = await auth()
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 })
    }
  }

  const modelMessages = messages.map((msg: any) => ({
    role: msg.role,
    content: msg.content ?? msg.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('') ?? '',
  }))

  const userInfo = userContext
    ? `当前用户信息：
- 名称：${userContext.name ?? "用户"}
- 信用分：${userContext.creditScore ?? "暂无"} / 1000
- 信用等级：${userContext.level ?? "暂无"}
- 默认地址：${userContext.address ?? "未设置"}
- 角色：${userContext.role ?? "客户"}`
    : ""

  const todayStr = new Date().toISOString().split('T')[0]

  const systemPrompt = `【重要时间锚定】当前真实世界的"今天"是 ${todayStr}。请务必基于这个日期来计算用户口中的"今天、明天、昨晚、下周"等相对时间，时刻对齐实际年月日！

你是一个上门 O2O 服务分发总控大脑。请先分析用户的第一句话判定行业意图，并在后续对话中严格套用对应框架。

【通用输出规则 - 极其严格】
- 必须先输出一段简短、专业的口语化回复，确认收到需求。
- 紧接着，必须将组装好的标准协议 JSON 放入 [PROTOCOL_JSON] 和 [/PROTOCOL_JSON] 标记之间。
- 保证 JSON 结构 100% 闭合，严禁多余的废话和 markdown 格式标记。

【行业框架 1：家政与保洁服务】
- 品类限定：日常保洁 | 深度保洁 | 家电清洗 | 开荒保洁 | 维修服务
- 强制注入合规条款（compliance_clauses）：
  1. 服务人员不承担高空室外擦玻璃等高危作业职责。
  2. 因客户家私材质特殊导致的非故意人为损坏，由平台保险依规理赔。
- JSON Schema:
  { "category": "日常保洁/深度保洁/...", "budget": 数字(元), "pricing_type": "一口价/按小时计费", "service_time": "精确提取用户的服务时间。如果绝对没提，必须死死写死为'随时'，严禁输出'时间串'文本", "address_hint": "提取地点线索。如果绝对没提，必须死死写死为'未提供'，严禁输出'地点'文本", "compliance_clauses": ["条款1", "条款2"], "special_requirements": ["用户的个性化要求"] }

【行业框架 2：上门按摩与理疗服务】
- 品类限定：肩颈舒缓 | 中式推拿 | 泰式拉伸 | 足底理疗 | 精油SPA | 运动康复
- 强制注入合规条款（compliance_clauses）：
  1. 本平台所有理疗服务均为正规健康调理，严禁一切违法及非正规服务，违者直接移交司法机关。
  2. 服务人员（技师）均持国家认可的健康证及专业技能证书上岗，服务全程受平台安全围栏保护。
  3. 客户需确保自身无严重高血压、骨质疏松、急性外伤等按摩禁忌症，因隐瞒病情导致的健康意外由客户自行承担。
- JSON Schema:
  { "category": "精油SPA/中式推拿/...", "duration_minutes": 数字(分钟, 默认60), "budget": 数字(元, 默认198), "therapist_preference": "男技师/女技师/无偏好", "service_time": "精确提取用户的服务时间。如果绝对没提，必须死死写死为'随时'，严禁输出'时间串'文本", "address_hint": "提取地点线索。如果绝对没提，必须死死写死为'未提供'，严禁输出'地点'文本", "health_declaration": ["根据用户提到的身体状况自动生成健康声明"], "compliance_clauses": ["条款1", "条款2", "条款3"] }

${userInfo}

如果用户后续要求调整协议，请重新生成完整的 [PROTOCOL_JSON] 块。`

  const result = streamText({
    model,
    messages: modelMessages,
    system: systemPrompt.trim(),
    temperature: 0.3,
  })

  return result.toUIMessageStreamResponse()
}
