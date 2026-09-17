import { NextResponse, after } from "next/server"
import { revalidatePath } from "next/cache"
import { withAuth } from "@/lib/api-auth"
import { getRouteClient } from "@/lib/supabase-route-client"
import { getServiceClient } from "@/lib/supabase-client"
import { checkRateLimit, rateLimitResponse, RULE_DEFAULT } from "@/lib/rate-limit"
import type { SupabaseClient } from "@supabase/supabase-js"

// P0-01: 统一代码路径 — demands 路由转写至 protocols/contracts 核心数据源
// 保持旧 API 接口不变，但主力读写走 protocols 表

function toProtocolCoreFields(body: Record<string, unknown>, info?: Record<string, unknown>): Record<string, unknown> {
  const title = info?.title ?? body.title
  const desc = info?.description ?? body.description
  const address = info?.address ?? body.address
  return {
    title: title ?? '',
    description: [desc, address && `📍 ${address}`].filter(Boolean).join('\n'),
  }
}

function toProtocolCategoryFields(body: Record<string, unknown>, info?: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  if (info?.budgetMin != null) fields.budget_min = info.budgetMin
  if (info?.budgetMax != null) fields.budget_max = info.budgetMax
  if (body.budgetMin != null) fields.budget_min = body.budgetMin
  if (body.budgetMax != null) fields.budget_max = body.budgetMax
  if (body.budget != null) fields.budget = body.budget
  if (info?.urgency) fields.urgency = info.urgency
  if (body.urgency) fields.urgency = body.urgency
  // P7 阶段计划（用户确认版，建单前已校验；存档供合同里程碑物化＋观察期审计）。
  if (body.stages != null) fields.stages = body.stages
  if (info && (info as Record<string, unknown>).stages != null) {
    fields.stages = (info as Record<string, unknown>).stages
  }
  // 增长归因透传（m20/f20 投流：零 DDL，category_fields 扩展位直存，ROI 口径）。
  if (body.attribution != null && typeof body.attribution === "object") fields.attribution = body.attribution
  if (info?.attribution != null && typeof info.attribution === "object") fields.attribution = info.attribution
  return fields
}

function makeProtocolPayload(userId: string, body: Record<string, unknown>, info?: Record<string, unknown>) {
  const category = (info?.category ?? body.category) as string
  const riskTier = 'low'
  const responseMode = 'grab_first'

  const payload: Record<string, unknown> = {
    demander_id: userId,
    category,
    core_fields: toProtocolCoreFields(body, info),
    category_fields: toProtocolCategoryFields(body, info),
    status: 'pending_confirm',
    risk_tier: riskTier,
    response_mode: responseMode,
  }
  if (body.longitude != null && body.latitude != null) {
    payload.location = `POINT(${body.longitude} ${body.latitude})`
  }
  return payload
}

function resolveDemandPrice(
  body: Record<string, unknown>,
  info?: Record<string, unknown>,
): number | null {
  const cands = [body.budget, info?.budget, body.budgetMin, info?.budgetMin]
  for (const c of cands) {
    const n = Number(c)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

// Step3b 方案A：发单同路由原子双写 protocols + demands（protocol_id 硬桥接）。
// demands 写失败 → 物理删除刚建 protocol 补偿，绝对零孤儿协议。
async function createProtocolWithDemand(
  svc: SupabaseClient,
  userId: string,
  payload: Record<string, unknown>,
  body: Record<string, unknown>,
  info?: Record<string, unknown>,
  dues?: { publishFeeDue: number; customPlatformDue: number },
) {
  const { data: protocol, error } = await svc.from('protocols').insert(payload).select().single()
  if (error || !protocol) throw error ?? new Error("Protocol insert failed")

  const demandRow = {
    protocol_id: protocol.id,
    demander_id: userId,
    client_id: userId,
    customer_id: userId,
    title: (info?.title ?? body.title ?? '未命名需求') as string,
    price: resolveDemandPrice(body, info),
    status: 'OPEN',
    // P5b：应收落行（实收在 escrow 支付时并入；列缺席的老库由迁移补）。
    publish_fee_due: dues?.publishFeeDue ?? 0,
    custom_platform_due: dues?.customPlatformDue ?? 0,
  }
  const { error: demandError, data: demandInserted } = await svc.from('demands').insert(demandRow).select('id').single()
  if (demandError) {
    // 列缺席兼容：老库无迁移时退化为无应收建单（费收在 P8 通道落地后统一对账）。
    const missingColumn = /publish_fee_due|custom_platform_due|fee_status/.test(demandError.message)
    if (missingColumn) {
      const retry = await svc.from('demands').insert({
        protocol_id: protocol.id,
        demander_id: userId,
        client_id: userId,
        customer_id: userId,
        title: demandRow.title,
        price: demandRow.price,
        status: 'OPEN',
      }).select('id').single()
      if (retry.error) {
        await svc.from('protocols').delete().eq('id', protocol.id)
        throw new Error(`Demand bridge insert failed, protocol compensated: ${retry.error.message}`)
      }
      return { protocol, demandId: (retry.data as { id: string } | null)?.id ?? null }
    }
    await svc.from('protocols').delete().eq('id', protocol.id)
    throw new Error(`Demand bridge insert failed, protocol compensated: ${demandError.message}`)
  }
  return { protocol, demandId: (demandInserted as { id: string } | null)?.id ?? null }
}

async function autoMatchProtocol(supabase: SupabaseClient, protocolId: string, category: string): Promise<void> {
  try {
    const { routeProtocol } = await import("@/modules/m06-matching-routing/matcher")
    const { data: protocol } = await supabase
      .from('protocols')
      .select('category_fields, location')
      .eq('id', protocolId)
      .single()
    if (!protocol) return
    const catFields = protocol.category_fields as Record<string, unknown> ?? {}
    const loc = protocol.location as { x?: number; y?: number; coordinates?: number[] } | null
    const lat = catFields.latitude as number ?? loc?.coordinates?.[1] ?? 0
    const lng = catFields.longitude as number ?? loc?.coordinates?.[0] ?? 0
    await routeProtocol({ protocolId, latitude: lat, longitude: lng, category })
  } catch (err) {
    console.warn("Auto-match (unified) skipped:", err)
  }
}

/**
 * P7 阶段计划校验（建单前）：用户确认版 plan 存档（source 标记供观察期审计）。
 * 缺席 → 单阶段默认（不阻断）；非法 → 400。
 */
async function validateStages(body: Record<string, unknown>): Promise<string | null> {
  const stages = body.stages as { title: string; weightPct: number; acceptance: string }[] | undefined;
  if (stages == null) {
    body.stages = [{ title: "整单一次交付", weightPct: 100, acceptance: "按订单要求整体验收", source: "default" }];
    return null;
  }
  const { validateStagePlan } = await import("@/base/stages/plan");
  const errors = validateStagePlan(stages);
  if (errors.length > 0) return `阶段计划非法: ${errors.join("；")}`;
  body.stages = (stages as Record<string, unknown>[]).map((s) => ({ ...s, source: body.stageSource ?? "user" }));
  return null;
}

/**
 * P5a 定制行项＋发布费应收（用户裁决 2026-09-18）。
 * customItems: [{ dim_key, amount }]（amount ≥ 底价，否则 400）。
 * 发布费：3 单/天/人免费，超出 1 元/单——此处只计应收（custom.publishFeeDue），
 * 实收在 P5b 支付时并入；定制平台费 1 元/项同样计应收待 P5b。
 * 两段式：validateCustom（建单前，防孤儿单）→ insertCustomRows（建单后）。
 */
interface ValidatedCustom {
  rows: { demand_id?: string; dim_key: string; amount: number; floor: number; status: string }[]
  customTotal: number
  publishFeeDue: number
  customPlatformDue: number
  validationError?: string
}

async function validateCustom(
  svc: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
  baseAmount: number,
): Promise<ValidatedCustom> {
  const items = (body.customItems ?? []) as { dim_key: string; amount: number }[]

  // 发布费计数（自然天，demands.created_at；本单尚未落库，计数天然是"之前"）。
  let publishFeeDue = 0
  try {
    const { getConfig } = await import("@/lib/platform/config")
    const cfg = await getConfig()
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const { count } = await svc
      .from("demands")
      .select("id", { count: "exact", head: true })
      .eq("demander_id", userId)
      .gte("created_at", dayStart.toISOString())
    if ((count ?? 0) + 1 > (cfg.fees.publishFee?.freePerDay ?? 3)) {
      publishFeeDue = cfg.fees.publishFee?.unitPrice ?? 1
    }
  } catch {
    /* 计数失败不阻断发单（应收记 0，fail-open） */
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { rows: [], customTotal: 0, publishFeeDue, customPlatformDue: 0 }
  }
  const { data: floors } = await svc.from("custom_dim_floors").select("*").eq("active", true)
  const { validateCustomItems, floorForDim } = await import("@/base/custom/pricing")
  const dimMap = new Map(
    ((floors ?? []) as { dim_key: string; mode: "fixed" | "percent"; fixed_amount: number; percent_rate: number }[])
      .map((d) => [d.dim_key, { dim_key: d.dim_key, mode: d.mode, fixed_amount: Number(d.fixed_amount), percent_rate: Number(d.percent_rate) }]),
  )
  const normalized = items.map((it) => ({ dim_key: String(it.dim_key), amount: Number(it.amount) }))
  const errors = validateCustomItems(normalized, dimMap, baseAmount)
  if (errors.length > 0) {
    return { rows: [], customTotal: 0, publishFeeDue, customPlatformDue: 0, validationError: errors.join("；") }
  }
  const rows = normalized.map((it) => ({
    dim_key: it.dim_key,
    amount: it.amount,
    floor: floorForDim(dimMap.get(it.dim_key)!, baseAmount),
    status: "active",
  }))
  const customTotal = rows.reduce((s, r) => s + r.amount, 0)
  return { rows, customTotal, publishFeeDue, customPlatformDue: rows.length * 1 }
}

async function insertCustomRows(
  svc: SupabaseClient,
  demandId: string,
  rows: { dim_key: string; amount: number; floor: number; status: string }[],
): Promise<void> {
  if (rows.length === 0) return
  const { error } = await svc
    .from("demand_customizations")
    .insert(rows.map((r) => ({ ...r, demand_id: demandId })))
  if (error) throw new Error(`定制行项落库失败: ${error.message}`)
}

export const POST = withAuth(async (req, user) => {  const userResult = checkRateLimit(`demands:create:user:${user.id}`, RULE_DEFAULT)
  if (!userResult.allowed) return rateLimitResponse(userResult.resetAt)

  const supabase = await getRouteClient()
  // 写操作走 service_role：protocols 表 RLS 暂无 INSERT 策略（见
  // supabase/migrations/20260905_protocols_insert_policy.sql），用户 token
  // 直插必 42501。withAuth 已验明正身，demander_id 强制取 user.id，防越权。
  const svc = getServiceClient()

  try {
    const body = await req.json()

    if (body.text && !body.title) {
      const { classifyDemand } = await import("@/lib/demand/classifier")
      const info = await classifyDemand(body.text)

      const payload = makeProtocolPayload(user.id, body, info as unknown as Record<string, unknown>)
      // P5a＋P7：先验（建单前，400 拦截，零孤儿单）。
      const pre = await validateCustom(svc, user.id, body, resolveDemandPrice(body, info as unknown as Record<string, unknown>) ?? 0)
      if (pre.validationError) {
        return NextResponse.json({ error: `定制项不满足最低价: ${pre.validationError}` }, { status: 400 })
      }
      const stageError = await validateStages(body)
      if (stageError) {
        return NextResponse.json({ error: stageError }, { status: 400 })
      }
      const created = await createProtocolWithDemand(
        svc, user.id, payload, body, info as unknown as Record<string, unknown>,
        { publishFeeDue: pre.publishFeeDue, customPlatformDue: pre.customPlatformDue },
      )
      const protocol = created.protocol
      if (created.demandId) await insertCustomRows(svc, created.demandId, pre.rows)

      // P5a 定制行项：校验底价→落行项→计发布费应收（实收 P5b 在支付时并入）。
      const custom = { customTotal: pre.customTotal, publishFeeDue: pre.publishFeeDue, customPlatformDue: pre.customPlatformDue }

      revalidatePath('/demands')
      after(async () => {
        const category = info.category as string
        if (category) await autoMatchProtocol(supabase, protocol!.id, category)
      })

      return NextResponse.json({ demand: { id: protocol.id, ...payload }, classified: info, custom }, { status: 201 })
    }

    const payload = makeProtocolPayload(user.id, body)
    const pre = await validateCustom(svc, user.id, body, resolveDemandPrice(body) ?? 0)
    if (pre.validationError) {
      return NextResponse.json({ error: `定制项不满足最低价: ${pre.validationError}` }, { status: 400 })
    }
    const stageError = await validateStages(body)
    if (stageError) {
      return NextResponse.json({ error: stageError }, { status: 400 })
    }
    const created = await createProtocolWithDemand(
      svc, user.id, payload, body, undefined,
      { publishFeeDue: pre.publishFeeDue, customPlatformDue: pre.customPlatformDue },
    )
    const protocol = created.protocol
    if (created.demandId) await insertCustomRows(svc, created.demandId, pre.rows)
    const custom = { customTotal: pre.customTotal, publishFeeDue: pre.publishFeeDue, customPlatformDue: pre.customPlatformDue }

    revalidatePath('/demands')
    after(async () => {
      const category = body.category as string
      if (category) await autoMatchProtocol(supabase, protocol!.id, category)
    })

    return NextResponse.json({ id: protocol.id, custom }, { status: 201 })
  } catch (err) {
    console.error("Create demand error:", err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
})

export const GET = withAuth(async (req, user) => {
  const supabase = await getRouteClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  let query = supabase.from('protocols').select('*').eq('demander_id', user.id)
  if (status) query = query.eq('status', status)
  query = query.order('created_at', { ascending: false }).limit(20)

  const { data: protocols, error } = await query
  if (error) throw error

  return NextResponse.json({ demands: protocols })
})
