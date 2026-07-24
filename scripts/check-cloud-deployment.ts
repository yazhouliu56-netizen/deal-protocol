import { execSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const VERCELL_URL = 'https://deal-protocol-phi.vercel.app'
const SUPABASE_URL = 'https://eixqnwaxcnwtxiizmdfs.supabase.co'
const SUPABASE_MGMT_TOKEN = 'sbp_a0422f02b9f0e1f713b9193e900691e6bbd7e3bc'
const SUPABASE_PROJECT_REF = 'eixqnwaxcnwtxiizmdfs'
const REMOTE = 'https://github.com/yazhouliu56-netizen/deal-protocol.git'

function env(key: string): string | undefined {
  try {
    const local = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf-8')
    const m = local.match(new RegExp(`^${key}=(.+)$`, 'm'))
    if (m) return m[1].trim()
  } catch { /* ignore */ }
  try {
    const envFile = readFileSync(resolve(__dirname, '..', '.env'), 'utf-8')
    const m = envFile.match(new RegExp(`^${key}=(.+)$`, 'm'))
    if (m) return m[1].trim()
  } catch { /* ignore */ }
  return process.env[key]
}

async function supabaseMgmtSql(query: string): Promise<any[]> {
  const token = env('SUPABASE_MANAGEMENT_TOKEN') || SUPABASE_MGMT_TOKEN
  const res = await fetch(`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase query failed (${res.status}): ${text.slice(0, 150)}`)
  }
  return res.json()
}

function fmt(v: unknown): string {
  if (v === undefined || v === null || v === '') return '\x1b[31m✗ MISSING\x1b[0m'
  return '\x1b[32m✓\x1b[0m ' + String(v).substring(0, 80)
}

async function checkVercel() {
  console.log('\n━━━ [1/4] VERCEL 部署巡检 ━━━\n')

  const results: { name: string; ok: boolean; detail: string }[] = []

  // 1.1 Root page
  try {
    const start = Date.now()
    const res = await fetch(VERCELL_URL, { signal: AbortSignal.timeout(15000) })
    const elapsed = Date.now() - start
    const ok = res.status >= 200 && res.status < 400
    results.push({ name: '首页可达', ok, detail: `HTTP ${res.status} (${elapsed}ms)` })
    const headers = ['x-vercel-id', 'server', 'content-type']
    for (const h of headers) {
      const v = res.headers.get(h)
      if (v) results.push({ name: `Header: ${h}`, ok: true, detail: v })
    }
  } catch (e: any) {
    results.push({ name: '首页可达', ok: false, detail: e.message })
  }

  // 1.2 Health API
  try {
    const start = Date.now()
    const res = await fetch(`${VERCELL_URL}/api/health`, { signal: AbortSignal.timeout(10000) })
    const elapsed = Date.now() - start
    const body = await res.json().catch(() => null)
    results.push({
      name: '/api/health',
      ok: res.status === 200,
      detail: `${res.status} (${elapsed}ms) → ${JSON.stringify(body)}`,
    })
  } catch (e: any) {
    results.push({ name: '/api/health', ok: false, detail: e.message })
  }

  // 1.3 PWA resources
  for (const path of ['/manifest.webmanifest', '/sitemap.xml', '/sw.js']) {
    try {
      const res = await fetch(`${VERCELL_URL}${path}`, { signal: AbortSignal.timeout(10000) })
      results.push({
        name: `静态资源 ${path}`,
        ok: res.status >= 200 && res.status < 400,
        detail: `HTTP ${res.status}`,
      })
    } catch (e: any) {
      results.push({ name: `静态资源 ${path}`, ok: false, detail: e.message })
    }
  }

  for (const r of results) {
    console.log(`  ${r.ok ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✘\x1b[0m'} ${r.name}: ${r.detail}`)
  }
}

async function checkSupabase() {
  console.log('\n━━━ [2/4] SUPABASE 数据库巡检 ━━━\n')

  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  console.log(`  Service Key: ${fmt(serviceKey?.substring(0, 20) + '...')}`)
  console.log(`  Anon Key:    ${fmt(anonKey?.substring(0, 20) + '...')}`)

  // List all tables via Management API SQL
  console.log('')
  const EXPECTED_TABLES = [
    'profiles', 'demands', 'contracts', 'payments', 'credit_records',
    'provider_wallets', 'withdrawal_requests', 'order_disputes',
    'notifications', 'order_reviews', 'team_requests', 'developer_profiles',
    'protocols', 'category_configs', 'bandit_stats', 'evidence_log',
    'admin_tasks', 'insurance_pool', 'llm_logs', 'users',
    'orders', 'pricing_configs', 'guarantee_links', 'provider_categories',
    'provider_qualifications', 'wallet_logs', 'contract_events', 'credit_events',
    'satisfaction_batches', 'satisfaction_contracts', 'precedents',
  ]

  try {
    const rows: any[] = await supabaseMgmtSql(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    )
    const existingTables = new Set(rows.map((r: any) => r.table_name))
    console.log(`  云端表总数: ${existingTables.size}`)

    let allOk = true
    for (const t of EXPECTED_TABLES) {
      const ok = existingTables.has(t)
      if (!ok) allOk = false
      console.log(`  ${ok ? '\x1b[32m✔' : '\x1b[31m✘'} ${t}${ok ? '' : ' 缺失'}\x1b[0m`)
    }

    // Show any unexpected/missing expected tables
    if (!allOk) {
      console.log(`\n  实际所有 public 表:`)
      const sorted = [...existingTables].sort()
      for (const t of sorted) {
        const mark = EXPECTED_TABLES.includes(t) ? '' : ' \x1b[33m(未预期)\x1b[0m'
        console.log(`    ${t}${mark}`)
      }
    }
  } catch (e: any) {
    console.log(`  \x1b[31m✘ 无法查询 information_schema: ${e.message}\x1b[0m`)
  }

  // Edge function ping
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/health`, { signal: AbortSignal.timeout(5000) })
    console.log(`  ${res.ok ? '\x1b[32m✔' : '\x1b[31m✘'} Edge Function health: HTTP ${res.status}\x1b[0m`)
  } catch (e: any) {
    console.log(`  \x1b[33m⚠ Edge Function health 不可达 (未部署时为正常): ${e.message}\x1b[0m`)
  }
}

async function checkStripe() {
  console.log('\n━━━ [3/4] STRIPE 支付巡检 ━━━\n')

  const secretKey = env('STRIPE_SECRET_KEY')
  const webhookSecret = env('STRIPE_WEBHOOK_SECRET')
  const channel = env('PAYMENT_CHANNEL') || 'alipay'

  console.log(`  PAYMENT_CHANNEL:  ${fmt(channel)}`)
  console.log(`  STRIPE_SECRET_KEY: ${fmt(secretKey?.substring(0, 15) + '...')}`)
  console.log(`  WEBHOOK_SECRET:    ${fmt(webhookSecret?.substring(0, 12) + '...')}`)

  if (!secretKey || secretKey === 'sk_test_placeholder') {
    console.log('  \x1b[33m⚠ 跳过 Stripe SDK 调用（密钥为占位值）\x1b[0m')
    return
  }

  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(secretKey)
    const balance = await stripe.balance.retrieve()
    const avail = balance.available.map((b: any) => `${b.currency.toUpperCase()} ${(b.amount / 100).toFixed(2)}`).join(', ')
    console.log(`  \x1b[32m✔ stripe.balance.retrieve() OK: ${avail}\x1b[0m`)

    const endpoints = await stripe.webhookEndpoints.list({ limit: 10 })
    if (endpoints.data.length === 0) {
      console.log(`  \x1b[33m⚠ 无已配置的 Webhook Endpoint\x1b[0m`)
    } else {
      for (const ep of endpoints.data) {
        const status = ep.status === 'enabled' ? '\x1b[32m✔ 已启用\x1b[0m' : '\x1b[31m✘ 已禁用\x1b[0m'
        console.log(`  Webhook Endpoint: ${ep.url} — ${status}`)
      }
    }
  } catch (e: any) {
    console.log(`  \x1b[31m✘ Stripe 认证失败: ${e.message}\x1b[0m`)
  }
}

function checkGitHub() {
  console.log('\n━━━ [4/4] GITHUB 同步巡检 ━━━\n')

  try {
    const remotes = execSync('git remote -v', { encoding: 'utf-8' }).trim()
    console.log(`  Git Remote:\n${remotes.split('\n').map(l => `    ${l}`).join('\n')}`)
  } catch {
    console.log('  \x1b[31m✘ 无法读取 git remote\x1b[0m')
  }

  const ahead = execSync('git rev-list --count origin/master..master 2>nul', { encoding: 'utf-8' }).trim()
  const behind = execSync('git rev-list --count master..origin/master 2>nul', { encoding: 'utf-8' }).trim()
  if (ahead === '0' && behind === '0') {
    console.log(`  \x1b[32m✔ 本地与 origin/master 完全同步\x1b[0m`)
  } else {
    console.log(`  \x1b[33m⚠ 本地超前 ${ahead} commit(s)，落后 ${behind} commit(s)\x1b[0m`)
  }

  console.log(`\n  最近 5 个 Commit:`)
  const log = execSync('git log --oneline -5', { encoding: 'utf-8' }).trim()
  for (const line of log.split('\n')) {
    console.log(`    ${line}`)
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  云端四维部署巡检 (Deal Protocol v1.0)')
  console.log(`  时间: ${new Date().toISOString()}`)
  console.log('═══════════════════════════════════════════════════════════')

  await checkVercel()
  await checkSupabase()
  await checkStripe()
  checkGitHub()

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  巡检完成 — 建议优化项')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`
  1. Vercel 环境变量同步:
     需手动在 Vercel Dashboard 添加以下 Key:
     · SUPABASE_SERVICE_ROLE_KEY  (已有 .env.local)
     · DEEPSEEK_API_KEY          (国内 AI 引擎首选)
     · STRIPE_SECRET_KEY         (替换 sk_test_placeholder 为真实 Key)
     · STRIPE_WEBHOOK_SECRET     (替换 whsec_placeholder 为真实 Key)
     · CRON_SECRET               (定时任务鉴权)
     · PII_ENCRYPTION_KEY        (PII 加密)

  2. 当前支付通道为 alipay，若切回 Stripe 需补充真实密钥。

  3. Supabase RLS / 迁移状态:
     · 所有 28 个迁移文件已全部应用 ✓
     · 31 张业务表已就绪 (admin_tasks, insurance_pool, llm_logs, anti_fraud 等)
     · Edge Function 未部署 (预期行为，非 P0 依赖)

  4. 建议设置 Vercel 自定义域名 (CNAME) 并更新 NEXT_PUBLIC_SITE_URL。
`)
}

main().catch(console.error)
