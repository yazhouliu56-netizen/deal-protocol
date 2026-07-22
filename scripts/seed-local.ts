/**
 * 本地开发假数据 Seed 脚本
 * 用法: npx tsx scripts/seed-local.ts
 * 前提: .env.local 中配置了真实 Supabase URL + service_role key
 */
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || supabaseUrl.includes("placeholder")) {
  console.error("❌ 请先在 .env.local 中配置真实的 Supabase URL 和 Service Role Key")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

async function seed() {
  // ── 1. 用户 ──
  const { data: provider } = await supabase
    .from("users")
    .upsert({
      phone: "13800000001",
      nickname: "张师傅·金牌维修",
      role: "provider",
      identity_verified: true,
    })
    .select("id")
    .single()
  if (!provider) throw new Error("Failed to create provider")

  const { data: customer } = await supabase
    .from("users")
    .upsert({ phone: "13800000002", nickname: "李女士", role: "demander" })
    .select("id")
    .single()
  if (!customer) throw new Error("Failed to create customer")

  const { data: admin } = await supabase
    .from("users")
    .upsert({ phone: "13800000000", nickname: "系统管理员", role: "demander" })
    .select("id")
    .single()
  if (!admin) throw new Error("Failed to create admin")

  console.log("✅ 用户创建完成")

  // ── 2. 品类配置 ──
  const { error: cfgErr } = await supabase.from("category_configs").upsert(
    [
      {
        category: "维修",
        risk_tier: "low",
        schema_json: {
          core_fields: { location: { type: "geo", required: true }, time_window: { type: "string", required: true } },
          category_fields: { fault_type: { type: "string", required: true } },
        },
        response_mode: "grab_first",
        enabled: true,
      },
      {
        category: "保洁",
        risk_tier: "low",
        schema_json: {
          core_fields: { location: { type: "geo", required: true }, time_window: { type: "string", required: true } },
          category_fields: { area_sqm: { type: "number", required: true } },
        },
        response_mode: "grab_first",
        enabled: true,
      },
      {
        category: "社交",
        risk_tier: "high",
        schema_json: {
          core_fields: { location: { type: "geo", required: true }, time_window: { type: "string", required: true } },
          category_fields: { service_type: { type: "string", required: true } },
        },
        response_mode: "interest_list",
        enabled: true,
      },
    ],
    { onConflict: "category" },
  )
  if (cfgErr) throw cfgErr
  console.log("✅ 品类配置创建完成")

  // ── 3. 信用记录 ──
  await supabase.from("credit_records").upsert(
    {
      user_id: provider.id,
      base_score: 780,
      base_verified_status: "verified",
      base_fulfillment_rate: 98.5,
      base_violation_count: 0,
      base_total_deals: 42,
      category: "维修",
      category_score: 820,
      category_order_count: 38,
      category_repurchase_rate: 72,
    },
    { onConflict: "user_id" },
  )
  console.log("✅ 信用记录创建完成")

  // ── 4. 需求卡片（3 种紧急度） ──
  const demands = [
    {
      customer_id: customer.id,
      title: "空调不制冷了，需要加氟",
      description: "卧室空调不制冷，已购买3年，需要上门加氟检修。在朝阳区建国路88号。",
      category: "维修",
      budget_min: 150,
      budget_max: 300,
      urgency: "high",
      address: "朝阳区建国路88号",
      status: "OPEN",
      risk_tier: "low",
    },
    {
      customer_id: customer.id,
      title: "厨房深度保洁",
      description: "厨房需要深度清洁，包括油烟机清洗、墙面去油污、地面清洁。约12平米。",
      category: "保洁",
      budget_min: 200,
      budget_max: 400,
      urgency: "medium",
      address: "海淀区中关村大街1号",
      status: "OPEN",
      risk_tier: "low",
    },
    {
      customer_id: customer.id,
      title: "下水道堵塞紧急疏通",
      description: "厨房下水道完全堵塞，污水反冒，需要立即上门处理！",
      category: "维修",
      budget_min: 100,
      budget_max: 200,
      urgency: "high",
      address: "西城区金融街15号",
      status: "OPEN",
      risk_tier: "low",
    },
  ]

  const demandIds: string[] = []
  for (const d of demands) {
    const { data, error } = await supabase.from("demands").insert(d).select("id").single()
    if (error) throw error
    demandIds.push(data.id)
  }
  console.log("✅ 需求卡片创建完成")

  // ── 5. 协议 + 订单（资金已托管） ──
  const { data: protocol } = await supabase
    .from("protocols")
    .upsert(
      {
        demander_id: customer.id,
        provider_id: provider.id,
        category: "维修",
        core_fields: { location: { lat: 39.91, lng: 116.46 }, time_window: "2026-07-11 14:00-16:00" },
        category_fields: { fault_type: "refrigerant_leak" },
        response_mode: "grab_first",
        risk_tier: "low",
        status: "pending_held",
        final_price: 280,
      },
      { onConflict: "id" },
    )
    .select("id")
    .single()

  if (!protocol) throw new Error("Failed to create protocol")

  const { error: orderErr } = await supabase.from("orders").upsert(
    {
      protocol_id: protocol.id,
      demander_id: customer.id,
      provider_id: provider.id,
      amount: 280,
      fund_status: "held",
      status: "active",
    },
    { onConflict: "id" },
  )
  if (orderErr) throw orderErr
  console.log("✅ 协议 + 资金已托管订单创建完成")

  console.log("\n🎉 种子数据播种完毕！")
  console.log("   👤 师傅: 13800000001（张师傅·金牌维修 | 信用分 780）")
  console.log("   👤 客户: 13800000002（李女士）")
  console.log("   📋 需求: 3 条（空调不制冷 / 厨房保洁 / 下水道堵塞）")
  console.log("   💠 订单: 1 笔（资金已托管）")
}

seed().catch((err) => {
  console.error("❌ Seed 失败:", err.message)
  process.exit(1)
})
