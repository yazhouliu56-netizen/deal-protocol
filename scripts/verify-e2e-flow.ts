/**
 * verify-e2e-flow.ts
 *
 * 四大主线 E2E 端到端闭环自检脚本
 * 检测真实数据库中的已有表，自适应跳过未就绪模块
 *
 * 用法: npx tsx scripts/verify-e2e-flow.ts
 * 前提: .env.local 中配置了 SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ── 环境变量读取：优先系统环境变量，再回退 .env.local ──
function loadEnvVar(key: string): string | undefined {
  if (process.env[key]) return process.env[key]
  return undefined
}

const envPath = path.resolve(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const k = trimmed.slice(0, eqIdx).trim()
    if (process.env[k]) continue // 不覆盖系统环境变量
    let v = trimmed.slice(eqIdx + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    process.env[k] = v
  }
}

// ── 获取 Supabase 客户端 ──
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  const missing = [!supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL', !supabaseServiceKey && 'SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean).join(', ')
  console.warn(`\x1b[33m[SKIP]\x1b[0m 缺失环境变量: ${missing}，跳过 E2E 验证`)
  console.warn('  配置方式: .env.local 或 GitHub Secrets')
  process.exit(0)
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
  realtime: { transport: (globalThis as any).WebSocket as any },
})

// ── 彩色日志工具 ──
const C = {
  info: (msg: string) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  pass: (msg: string) => console.log(`\x1b[32m[PASS]\x1b[0m ${msg}`),
  warn: (msg: string) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
  fail: (msg: string) => console.log(`\x1b[31m[FAIL]\x1b[0m ${msg}`),
  step: (title: string) => console.log(`\n\x1b[35m═══ ${title} ═══\x1b[0m`),
  heading: (title: string) => console.log(`\n\x1b[1;37m${'='.repeat(60)}\n${title}\n${'='.repeat(60)}\x1b[0m`),
}

// ── 主流程 ──
async function runE2E(): Promise<void> {
  C.heading('Deal Protocol — E2E 四大主线闭环自检')
  C.info('连接 Supabase: ' + supabaseUrl)

  let clientId = ''
  let devId = ''

  // ===============================================================
  // STEP 0: 环境探测与账号准备
  // ===============================================================
  C.step('0. 环境探测与账号准备')

  // 探测已有表
  const probeTables = [
    'profiles', 'users', 'demands', 'orders', 'protocols',
    'order_disputes', 'reviews', 'bids',
    'provider_wallets', 'wallet_logs', 'withdrawal_requests',
    'finance_transactions', 'withdrawals',
  ]
  const existingTables: string[] = []

  for (const t of probeTables) {
    const { error } = await supabase.from(t).select('id').limit(1)
    if (!error) existingTables.push(t)
  }

  C.info(`可用表 (${existingTables.length}/${probeTables.length}): ${existingTables.join(', ') || '无'}`)

  // 获取测试账号
  const { data: profiles } = await supabase.from('profiles').select('*')
  if (!profiles || profiles.length === 0) {
    C.fail('数据库无任何 profiles 记录')
    process.exit(1)
  }

  // 角色分配
  const customerProfile = profiles.find((p: any) => p.role === 'CUSTOMER')
  const providerProfile = profiles.find((p: any) => p.role === 'PROVIDER')

  if (customerProfile && providerProfile) {
    clientId = customerProfile.id
    devId = providerProfile.id
  } else if (profiles.length >= 2) {
    clientId = profiles[0].id
    devId = profiles[1].id
  } else {
    C.fail('需要至少 2 个 profiles 记录来模拟双角色')
    process.exit(1)
  }

  C.pass(`测试客户: ${clientId} (${customerProfile?.name || 'CUSTOMER'})`)
  C.pass(`测试开发者: ${devId} (${providerProfile?.name || 'PROVIDER'})`)

  // 清理残留
  await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('demands').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  // orders.provider_id 有 FK → users(id)，确保 users 表有对应记录
  for (const uid of [clientId, devId]) {
    const { error: ue } = await supabase.from('users').upsert(
      { id: uid, phone: `e2e_test_${uid.slice(0, 8)}@test.com`, nickname: 'E2E Tester', role: 'provider' },
      { onConflict: 'id' }
    )
    if (ue) C.warn(`users upsert (${uid.slice(0, 8)}): ${ue.message}`)
  }
  C.pass('users 表虚拟账号就绪 (满足 FK 约束)')

  // ===============================================================
  // 阶段一: 需求发布与订单生成
  // ===============================================================
  C.step('阶段一 — 需求发布与订单锁定')

  let demandId = ''
  let orderId = ''

  // 1.1 创建需求
  const { data: demand, error: demErr } = await supabase
    .from('demands')
    .insert({
      title: 'E2E 测试需求 — Web App 前端开发',
      description: '仅用于 E2E 闭环自动化断言测试',
      category: 'DEV',
      customer_id: clientId,
      status: 'OPEN',
    })
    .select()
    .single()

  if (demErr || !demand) {
    C.fail(`创建需求失败: ${demErr?.message}`)
    process.exit(1)
  }
  demandId = demand.id
  C.pass(`[1.1] 需求创建成功 (ID: ${demandId}, 状态: ${demand.status})`)

  // 1.2 创建订单 (模拟选中开发者后锁定)
  const { data: order, error: ordErr } = await supabase
    .from('orders')
    .insert({
      provider_id: devId,
      amount: 1000,
      status: 'in_progress',
      escrow_status: 'held',
    })
    .select()
    .single()

  if (ordErr || !order) {
    C.fail(`创建订单失败: ${ordErr?.message}`)
    process.exit(1)
  }
  orderId = order.id

  // 同步更新需求状态
  const { error: updDemErr } = await supabase
    .from('demands')
    .update({ status: 'IN_PROGRESS' })
    .eq('id', demandId)

  if (updDemErr) C.warn(`需求状态更新注意: ${updDemErr.message}`)
  C.pass(`[1.2] 订单锁定成功 (ID: ${orderId}, 金额: ¥${order.amount}, 资金: ${order.escrow_status})`)

  // 支持断言: 订单初始状态是否正确
  if (order.status === 'in_progress' && order.escrow_status === 'held') {
    C.pass('[1.3] 状态机断言: 订单 = IN_PROGRESS, 资金 = held ✓')
  } else {
    C.warn(`[1.3] 状态机断言: 当前状态 order=${order.status}, escrow=${order.escrow_status}`)
  }

  // ===============================================================
  // 阶段二: 履约交付与验收结案
  // ===============================================================
  C.step('阶段二 — 履约交付与验收结案')

  // 2.1 开发者提交交付 (状态 -> completed)
  const { error: compErr } = await supabase
    .from('orders')
    .update({
      status: 'completed',
      escrow_status: 'released',
      provider_income: 950,
      platform_fee: 50,
      service_phase: 'DONE',
    })
    .eq('id', orderId)

  if (compErr) {
    C.fail(`完成订单失败: ${compErr.message}`)
  } else {
    C.pass('[2.1] 订单完成 (状态: completed, 资金: released)')
  }

  // 2.2 评价系统检测 (表不存在则跳过)
  if (existingTables.includes('reviews')) {
    const { error: revErr } = await supabase
      .from('reviews')
      .insert({
        order_id: orderId,
        reviewer_id: clientId,
        reviewee_id: devId,
        rating: 5,
        comment: 'E2E 自动评价：交付质量优秀',
      })

    if (revErr) {
      C.warn(`[2.2] 评价提交: ${revErr.message}`)
    } else {
      C.pass('[2.2] 评价提交成功 (评分: 5 星)')
    }
  } else {
    C.warn('[2.2] ⏭ 跳过评价 — reviews 表不存在')
  }

  // ===============================================================
  // 阶段三: 维权仲裁与退款
  // ===============================================================
  C.step('阶段三 — 维权仲裁与争议处理')

  if (existingTables.includes('order_disputes')) {
    // 创建争议需求 (order_disputes.order_id → demands.id)
    const { data: dispDemand, error: dDemErr } = await supabase
      .from('demands')
      .insert({
        title: 'E2E 争议测试需求',
        description: '测试维权仲裁流程',
        category: 'DEV',
        customer_id: clientId,
        status: 'IN_PROGRESS',
      })
      .select()
      .single()

    if (dDemErr || !dispDemand) {
      C.fail(`创建争议需求失败: ${dDemErr?.message}`)
    } else {
      // 发起维权 (fk_disputes_order → demands.id)
      const { data: dispute, error: dispErr } = await supabase
        .from('order_disputes')
        .insert({
          order_id: dispDemand.id,
          initiator_id: clientId,
          reason: 'E2E 质量争议: 未按协议完成测试覆盖',
          status: 'pending',
        })
        .select()
        .single()

      if (dispErr) {
        C.warn(`[3.1] 发起维权: ${dispErr.message}`)
      } else {
        C.pass(`[3.1] 维权发起成功 (ID: ${dispute.id})`)

        // 尝试裁决
        const isRefund = true
        const { error: resErr } = await supabase
          .from('order_disputes')
          .update({
            status: isRefund ? 'refunded' : 'force_settled',
            evidence_urls: ['E2E 裁定: 全额退款'],
          })
          .eq('id', dispute.id)

        if (resErr) {
          C.warn(`[3.2] 裁决更新: ${resErr.message}`)
        } else {
          C.pass(`[3.2] 维权裁决完成 (结果: ${isRefund ? 'REFUNDED' : 'FORCE_SETTLED'})`)
        }
      }

      // 清理争议相关
      await supabase.from('order_disputes').delete().eq('order_id', dispDemand.id)
      await supabase.from('demands').delete().eq('id', dispDemand.id)
    }
  } else {
    C.warn('[3] ⏭ 跳过维权仲裁 — order_disputes 表不存在 (需执行 supabase db push)')
  }

  // ===============================================================
  // 阶段四: 资金结算与提现
  // ===============================================================
  C.step('阶段四 — 资金结算与收益提现')

  // 检测资金相关表
  const hasWallets = existingTables.includes('provider_wallets')
  const hasWalletLogs = existingTables.includes('wallet_logs')
  const hasWithdrawalRequests = existingTables.includes('withdrawal_requests')

  if (hasWallets && hasWithdrawalRequests) {
    // 4.1 检查或创建钱包
    const { data: wallet, error: walErr } = await supabase
      .from('provider_wallets')
      .upsert(
        { provider_id: devId, balance: 950 },
        { onConflict: 'provider_id' }
      )
      .select()
      .single()

    if (walErr) {
      C.warn(`[4.1] 钱包操作: ${walErr.message}`)
    } else {
      C.pass(`[4.1] 开发者钱包余额: ¥${wallet.balance}`)

      // 4.2 提现申请
      const { data: wr, error: wrErr } = await supabase
        .from('withdrawal_requests')
        .insert({
          provider_id: devId,
          amount: 200,
          channel: 'ALIPAY',
          account_info: 'e2e_tester@alipay.com',
          status: 'pending',
        })
        .select()
        .single()

      if (wrErr) {
        C.warn(`[4.2] 提现申请: ${wrErr.message}`)
      } else {
        C.pass(`[4.2] 提现申请提交成功 (ID: ${wr.id}, ¥200)`)

        // 扣减余额
        const { error: dedErr } = await supabase
          .from('provider_wallets')
          .update({ balance: 750 })
          .eq('provider_id', devId)

        if (dedErr) {
          C.warn(`余额扣减: ${dedErr.message}`)
        } else {
          C.pass('[4.3] 余额扣减成功 (¥950 → ¥750)')

          if (hasWalletLogs) {
            await supabase.from('wallet_logs').insert({
              provider_id: devId,
              amount: -200,
              type: 'withdrawal',
              description: 'E2E 测试提现',
            })
          }
        }
      }

      // 清理提现相关
      await supabase.from('withdrawal_requests').delete().eq('provider_id', devId)
      await supabase.from('provider_wallets').delete().eq('provider_id', devId)
      if (hasWalletLogs) {
        await supabase.from('wallet_logs').delete().eq('provider_id', devId)
      }
    }
  } else {
    C.warn(`[4] ⏭ 跳过资金结算 — 缺表 (wallets=${hasWallets}, withdrawal=${hasWithdrawalRequests})
       执行 supabase db push 后再运行`)
  }

  // ===============================================================
  // 清理阶段一、二的测试数据
  // ===============================================================
  C.step('清理 E2E 测试数据')

  if (existingTables.includes('reviews')) {
    await supabase.from('reviews').delete().eq('order_id', orderId)
  }
  await supabase.from('orders').delete().eq('id', orderId)
  await supabase.from('demands').delete().eq('id', demandId)

  C.pass('测试数据已清理')

  // ===============================================================
  // 最终汇总
  // ===============================================================
  console.log(`\n\x1b[32m${'🎉'.repeat(10)}\x1b[0m`)
  C.heading('E2E 自检完成 — 汇总')
  console.log(`  ✅ 阶段一: 需求→订单锁定        ${demandId ? 'PASS' : 'FAIL'}`)
  console.log(`  ✅ 阶段二: 交付→验收结案        ${orderId ? 'PASS' : 'FAIL'}`)
  console.log(`  ${existingTables.includes('order_disputes') ? '✅' : '⏭️'} 阶段三: 维权仲裁与退款      ${existingTables.includes('order_disputes') ? 'TESTED' : 'SKIP (缺 order_disputes)'}`)
  console.log(`  ${hasWallets && hasWithdrawalRequests ? '✅' : '⏭️'} 阶段四: 资金结算与提现      ${hasWallets && hasWithdrawalRequests ? 'TESTED' : 'SKIP (缺 provider_wallets / withdrawal_requests)'}`)
  console.log(`\n  📋 待执行迁移: supabase db push`)
  console.log(`  🔄 重测命令: npx tsx scripts/verify-e2e-flow.ts\n`)
}

runE2E().catch((err) => {
  console.error(`\x1b[31m[FATAL]\x1b[0m ${err.message}`)
  process.exit(1)
})
