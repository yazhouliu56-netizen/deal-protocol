import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { withAuth } from "@/lib/api-auth"
import { getServiceClient } from "@/lib/supabase-client"
import {
  calculateProviderSettlement,
  DEFAULT_PLATFORM_RATE,
  generateComplianceSplitInstruction,
} from "@/base/money/escrow"
import { getCommissionRate, getConfig, type PlatformConfig } from "@/lib/platform/config"

export const POST = withAuth(async (req, user) => {
  const { orderId } = await req.json()

  if (!orderId) {
    return NextResponse.json({ error: "缺少订单 ID" }, { status: 400 })
  }

  // Step3b：钱包记账走 service（demander 直写 provider_wallets/wallet_logs
  // 必被 RLS 拦截 500）；属主校验保留代码层三别名 OR（defense in depth）。
  const svc = getServiceClient()

  const { data: demand, error: demandError } = await svc
    .from("demands")
    .select("id, title, price, status, demander_id, client_id, customer_id, matched_provider_id, released_at")
    .eq("id", orderId)
    .single()

  if (demandError || !demand) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 })
  }

  const isOwner =
    demand.demander_id === user.id ||
    demand.client_id === user.id ||
    (demand.customer_id != null && demand.customer_id === user.id)
  if (!isOwner) {
    return NextResponse.json({ error: "仅下单客户可执行放款操作" }, { status: 403 })
  }

  // 已结算复点 → 409（幂等语义）；真正未完工 → 400；并发竞态由原子更新兜底同样 409。
  if (demand.released_at != null || demand.status === "settled") {
    return NextResponse.json(
      { error: "ORDER_ALREADY_SETTLED_OR_NOT_COMPLETED", message: "订单已结算或未处于待验收状态" },
      { status: 409 },
    )
  }

  if (demand.status !== "COMPLETED") {
    return NextResponse.json({ error: "当前订单状态不可放款，请等待师傅完成服务" }, { status: 400 })
  }

  // 零金额守卫：price 缺失/非正 → 400，杜绝历史脏单静默零结算。
  const amount = Number(demand.price)
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "ORDER_AMOUNT_INVALID", message: "订单金额缺失或非法，无法放款" }, { status: 400 })
  }

  if (!demand.matched_provider_id) {
    return NextResponse.json({ error: "未找到服务商信息，放款中断" }, { status: 500 })
  }

  // I/O 在外：阶梯费率走 PlatformConfig（失败回退默认）；
  // 纯核 calculateProviderSettlement 签名与零 I/O 语义保持不变。
  let rate = DEFAULT_PLATFORM_RATE
  try {
    const config: PlatformConfig = await getConfig()
    rate = getCommissionRate(amount, config)
  } catch (err) {
    console.warn("[payment/release] commission config fallback to default:", err instanceof Error ? err.message : err)
  }
  const { platformFee, providerNet } = calculateProviderSettlement(amount, rate)

  const { data: wallet, error: walletError } = await svc
    .from("provider_wallets")
    .select("balance")
    .eq("provider_id", demand.matched_provider_id)
    .single()

  if (walletError || !wallet) {
    return NextResponse.json({ error: "服务商钱包尚未初始化" }, { status: 500 })
  }

  const newBalance = Math.round((wallet.balance + providerNet) * 100) / 100
  const releasedAt = new Date().toISOString()

  // 原子幂等锁：COMPLETED + released_at IS NULL 两行条件同时命中才结算；
  // 0 行生效（并发复点/已结算）→ 409，钱包绝不重复累加。
  // 状态拼写钉死小写 'settled'（STATUS_MAP/历史数据兼容，见 OrderFulfillmentClient）。
  const { data: updatedDemand, error: updateDemandError } = await svc
    .from("demands")
    .update({ status: "settled", released_at: releasedAt, platform_fee: platformFee, provider_net: providerNet })
    .eq("id", orderId)
    .eq("status", "COMPLETED")
    .is("released_at", null)
    .select("id")
    .single()

  if (updateDemandError || !updatedDemand) {
    return NextResponse.json(
      { error: "ORDER_ALREADY_SETTLED_OR_NOT_COMPLETED", message: "订单已结算或未处于待验收状态" },
      { status: 409 },
    )
  }

  const { error: walletUpdateError } = await svc
    .from("provider_wallets")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("provider_id", demand.matched_provider_id)

  if (walletUpdateError) {
    await svc
      .from("demands")
      .update({ status: "COMPLETED", released_at: null, platform_fee: null, provider_net: null })
      .eq("id", orderId)

    return NextResponse.json({ error: "钱包写入失败，已回滚" }, { status: 500 })
  }

  const logEntries = [
    {
      provider_id: demand.matched_provider_id,
      amount: providerNet,
      type: "payout",
      order_id: orderId,
      description: `订单「${demand.title || orderId.slice(0, 8)}」服务收入分成 ${providerNet} 元`,
    },
    {
      provider_id: demand.matched_provider_id,
      amount: -platformFee,
      type: "platform_fee",
      order_id: orderId,
      description: `订单「${demand.title || orderId.slice(0, 8)}」平台服务费 ${platformFee} 元`,
    },
  ]

  const { error: logError } = await svc
    .from("wallet_logs")
    .insert(logEntries)

  if (logError) {
    console.warn("wallet_logs 写入失败，但资金已发放:", logError)
  }

  // P0-2 收编：生成合规分账指令（信息流与资金流分离标准载荷，防二清），
  // 落审计留痕 + 随响应返回；前端忽略多余字段零破坏。
  const instruction = generateComplianceSplitInstruction(
    { platformFee, providerNet },
    "BANK_ESCROW",
    { orderId, receiverAccountId: demand.matched_provider_id },
  )

  const { error: instructionLogError } = await svc
    .from("wallet_logs")
    .insert({
      provider_id: demand.matched_provider_id,
      amount: 0,
      type: "split_instruction",
      order_id: orderId,
      description: `合规分账指令 ${instruction.instructionId} 已生成（签名 ${instruction.instructionSignature.slice(0, 8)}…）`,
    })

  if (instructionLogError) {
    console.warn("split_instruction 留痕失败（不影响资金发放）:", instructionLogError)
  }

  revalidatePath(`/demands/${orderId}`)
  revalidatePath('/profile')

  return NextResponse.json({
    success: true,
    payout: providerNet,
    fee: platformFee,
    newBalance,
    releasedAt,
    instruction,
  })
})
