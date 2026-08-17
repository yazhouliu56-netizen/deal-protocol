import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getServiceClient } from "@/lib/supabase-client"
import { parseConversationalBiQuery, type BiContractRow } from "@/base/ai/bi"

/**
 * 对话式 BI（P2 · L3-M5）：接收运营自然语言查询，返回标准 IBiReportPayload 报表。
 * 数据源：contracts（订单/资金） + disputes（违约判定），组装行级上下文交给
 * bi 引擎（确定性聚合 + LLM 归因增强，无网络时 100% 规则兜底）。
 */
export const POST = withAuth(async (req, user) => {
  const svc = getServiceClient()
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "ADMIN") {
    return NextResponse.json({ error: "仅管理员可访问" }, { status: 403 })
  }

  let body: { query?: string; timeRange?: string } = {}
  try {
    body = (await req.json()) as { query?: string; timeRange?: string }
  } catch {
    return NextResponse.json({ error: "请求体必须为 JSON" }, { status: 400 })
  }
  const query = (body.query ?? "").trim()
  if (!query) {
    return NextResponse.json({ error: "query 不能为空" }, { status: 400 })
  }
  if (query.length > 500) {
    return NextResponse.json({ error: "query 过长（≤500 字符）" }, { status: 400 })
  }

  const [contractsRes, disputesRes] = await Promise.all([
    svc.from("contracts").select("*"),
    svc.from("disputes").select("contract_id, dispute_status"),
  ])

  const contractIds = new Set((disputesRes.data ?? [])
    .filter((d) => d.dispute_status === "OPEN" || d.dispute_status === "RESOLVED")
    .map((d) => d.contract_id as string))

  const contracts: BiContractRow[] = (contractsRes.data ?? []).map((c) => ({
    category: (c.category as string | undefined) ?? (c.protocol_id as string | undefined) ?? "未知",
    amount: Number(c.amount ?? 0),
    createdAt: Date.parse(c.created_at as string) || Date.now(),
    fundStatus: c.fund_status as string | undefined,
    violation: contractIds.has(c.id as string),
    platformFeeYuan: c.platform_fee_yuan !== undefined && c.platform_fee_yuan !== null
      ? Number(c.platform_fee_yuan)
      : undefined,
    insuranceYuan: c.insurance_yuan !== undefined && c.insurance_yuan !== null
      ? Number(c.insurance_yuan)
      : undefined,
  }))

  const report = await parseConversationalBiQuery(query, { contracts })
  return NextResponse.json(report)
})
