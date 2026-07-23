# Deal Protocol — 项目架构与开发日志

> 最后更新: 2026-07-23  
> 定位: Next.js 16 (App Router) + Supabase + Stripe 托管的去中心化服务交易平台

---

## 1. 项目架构概述

### 定位

去中心化服务交易平台（Deal Protocol），核心功能包括需求发布、AI 智能匹配、资金托管、信用评估、纠纷仲裁和支付结算。

### 技术栈

| 层 | 技术选型 |
|---|---|
| 框架 | Next.js 16 (App Router), TypeScript |
| 数据库 | Supabase PostgreSQL (Service Role + RLS) |
| 认证 | Supabase Auth (ssr), JWT |
| 支付 | Stripe Payment Intents + Webhooks |
| AI | Gemini API (@ai-sdk/google), GitHub Models (@ai-sdk/openai-compatible) |
| PWA | @serwist/next (Service Worker) |
| OG 卡片 | @vercel/og (Edge Runtime) |
| UI | @base-ui/react, Tailwind CSS, framer-motion, react-hot-toast, Leaflet |
| 状态 | zustand |
| 测试 | vitest, @playwright/test |

---

## 2. 数据库 Schema 与 RLS 行级安全策略

### 核心数据表 (20+ 张)

| 表名 | RLS 覆盖 | 备注 |
|---|---|---|
| `users` | ✅ | 001_schema, `role CHECK ('demander','provider','both','admin')` |
| `profiles` | ✅ | 无 CREATE TABLE 语句，通过 Supabase 模板 + migration 011/016 扩展字段 |
| `demands` | ✅ | CREATE TABLE 语句缺失（需排期补充），migration 017 追加 embedding 向量索引 |
| `contracts` | ❌ | CREATE TABLE + RLS 均缺失，仅二次引用（注意：`evidence_chain` 引用不存在于 migrations 中的表） |
| `protocols` | ✅ | |
| `orders` | ✅ | |
| `credit_records` | ✅ | |
| `evidence_log` | ✅ | |
| `category_configs` | ❌ | |
| `provider_qualifications` | ❌ | |
| `provider_categories` | ✅ | |
| `credit_events` | ❌ | |
| `guarantee_links` | ❌ | |
| `precedents` | ❌ | |
| `bandit_stats` | ❌ | |
| `team_requests` | ✅ | |
| `pricing_configs` | ✅ | |
| `provider_wallets` | ✅ | |
| `wallet_logs` | ✅ | |
| `order_disputes` | ✅ | |
| `withdrawal_requests` | ✅ | |
| `notifications` | ✅ | |
| `order_reviews` | ✅ | |
| `developer_profiles` | ✅ | |
| `evidence_chain` | ✅ | 非 migration 管理，独立脚本 |
| `satisfaction_batches` | ✅ | 同上 |
| `satisfaction_contracts` | ✅ | 同上 |

### 关键安全修复日志

#### 修复 1: 撤销 anon 角色表级全局读写提权

**风险:** `GRANT ALL ON provider_wallets, wallet_logs, order_disputes, withdrawal_requests, notifications, order_reviews, developer_profiles TO service_role, anon, authenticated` — 未认证的 `anon` 用户可获得全部 7 张表的读写权限。

**修复:** 从 `20260718_grant_service_role_access.sql` 完整移除 `anon` 角色。

---

#### 修复 2: demands 表 `Provider view assigned demands` 策略条件

**风险:** 策略使用 `auth.jwt() ->> 'email'` 替代 `auth.uid()` 匹配 provider_id。

**修复:** 将条件改为 `auth.uid() = provider_id`。

---

#### 修复 3: 管理员 RLS 从邮箱匹配重构为 RBAC

**风险:** `auth.jwt() ->> 'email' LIKE '%@admin.com'` — 任何注册 `*@admin.com` 邮箱的用户自动获得管理员权限。

**修复:** 全量 5 条策略重构为 `EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')`。

**涉及迁移 & 策略:**

| 迁移文件 | 策略名 | 操作表 |
|---|---|---|
| `012_payment_and_wallets.sql` | `Admin full access wallets` | `provider_wallets` |
| `012_payment_and_wallets.sql` | `Admin full access wallet logs` | `wallet_logs` |
| `20260718_init_rls_policies.sql` | `Admin full access demands` | `demands` |
| `20260718_init_rls_policies.sql` | `Admin full access profiles` | `profiles` |
| `20260718_init_rls_policies.sql` | `Admin full access notifications` | `notifications` |

**修复迁移:** `20260723_fix_admin_rls_rbac.sql`

---

#### 修复 4: users.role / profiles.role CHECK 约束补全 admin 角色

**风险:** `users` 表原始 CHECK 为 `role IN ('demander','provider','both')`，不含 `'admin'`，导致 `001_schema.sql:253` 和 `009_pricing_configs.sql:23,27` 中 `WHERE role = 'admin'` 的查询永远无法匹配。

**修复:** 扩展约束为 `role IN ('demander','provider','both','admin')`，同步修复 `profiles` 表。

---

#### ⚠️ 遗留风险

| 风险项 | 级别 | 说明 |
|---|---|---|
| `demands` 表无 CREATE TABLE 迁移语句 | HIGH | 大量引用但无 DDL，假设已存在 |
| `contracts` 表无 CREATE TABLE + RLS | HIGH | 被 `evidence_chain`, `satisfaction_*` 引用外键 |
| 6 张表 (`category_configs`, `provider_qualifications`, `credit_events`, `guarantee_links`, `precedents`, `bandit_stats`) 未启用 RLS | MEDIUM | 无行级安全 |
| `admins` 表不存在，管理员通过 `profiles.role = 'admin'` 标识 | INFO | 无专用管理员表 |

---

## 3. 资金托管与 Stripe Webhook 防御机制

### 路由: `/api/webhooks/stripe` (`POST`)

#### 签名校验

```typescript
const stripe = getStripe()
const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
```

- 缺失 `STRIPE_WEBHOOK_SECRET` 会在路由入口立即拒绝（返回 500）
- 签名不匹配返回 400，不泄露 Stripe 原始错误消息

#### 幂等性防重结算

```typescript
const { data: existingPayment } = await svc
  .from("payments")
  .select("id, status")
  .eq("provider_payment_id", intent.id)
  .maybeSingle()
if (existingPayment) return  // 二次回调直接跳过
```

- 基于 `provider_payment_id` 唯一性检查
- 覆盖 `handlePaymentSuccess` 和 `handlePaymentFailed` 两条路径
- Stripe 双事件去重：仅处理 `payment_intent.succeeded`，忽略 `checkout.session.completed`（后者与前者重叠）

#### 事件处理流程

```
POST /api/webhooks/stripe
  ├─ 检查 STRIPE_WEBHOOK_SECRET ⇢ 无则 500
  ├─ constructEvent 校验签名 ⇢ 失败则 400
  ├─ payment_intent.succeeded
  │   ├─ 幂等性检查 ⇢ 已存在则 return
  │   ├─ 查询 contract 的 fund_status
  │   ├─ 非 HELD → 更新为 HELD
  │   ├─ 写入 payments 表 (SUCCEEDED)
  │   ├─ 写入 notifications (客户 + 服务商)
  │   ├─ 写入 contract_events (状态机日志)
  │   └─ 发出 event-bus 事件
  ├─ payment_intent.payment_failed
  │   └─ 幂等性检查 → 写入 payments (FAILED) → 通知
  └─ 默认 → 200 { received: true }
```

---

## 4. PWA、UX 与 SEO 动态卡片

### Service Worker & 离线降级

- **实现:** `@serwist/next` + 自定义 `public/sw.js`（~65KB）
- **策略:**
  - 静态资源：Cache First (stale-while-revalidate 后备)
  - 页面：Network First，离线时 fallback `/offline`
- **离线页:** `/offline` 路由，纯静态降级体验
- **注册:** `src/app/layout.tsx` 中动态加载

### 移动端 UX

| 指标 | 实现 |
|---|---|
| 触摸热区 | 全量可交互元素 ≥ 44px |
| 骨架屏 | 列表页、详情页、支付页 |
| Toast 反馈 | `react-hot-toast`，成功/错误/加载三态 |
| 响应式 | Tailwind CSS breakpoints |

### SEO 与社交分享

| 功能 | 路径 | 说明 |
|---|---|---|
| 动态 Sitemap | `/sitemap.xml` | `src/app/sitemap.ts` — 静态路由 + 活跃 Demands 查询，Supabase 不可用时降级 |
| Robots | `/robots.txt` | `src/app/robots.ts` — 屏蔽 `/api/*`, `/admin/*`, `/_next/*`；禁止 GPTBot |
| OG 动态卡片 | `/demands/[id]/opengraph-image.tsx` | Edge Runtime `@vercel/og` 渲染，`getSupabase` 导入已修复 |
| PWA Manifest | `public/manifest.webmanifest` | 含 192/512 应用图标，`display: standalone` |

---

## 5. OpenCode 核心 Prompt 秘籍集

本节记录了本项目上线前 3 组关键 AI 优化提示词，可直接复用。

### 5.1 RLS/RBAC 鉴权重构

> 场景：管理员 RLS 策略使用 `%@admin.com` 邮箱后缀匹配，存在越权漏洞。

**Prompt 模板:**

```
请全权修复巡检中暴露的「高风险管理员 RLS 越权漏洞」，
将所有基于 @admin.com 邮箱后缀匹配管理员身份的 RLS 策略，
全量重构为基于 profiles.role = 'admin' 的标准 RBAC 权限判断。

修复步骤:
1. 检索 supabase/migrations/ 下所有包含 %@admin.com 的迁移文件
2. 创建增量迁移文件，DROP 旧策略 + CREATE 新策略
3. 同步修复 users/profiles 表的 CHECK 约束以原生支持 'admin' 角色
4. 运行 tsc + vitest 验证
```

### 5.2 Stripe Webhook 防重/幂等性

> 场景：Webhook 路由无幂等性检查，Stripe 重试会导致重复结算。

**Prompt 模板:**

```
检查 /api/webhooks/stripe 路由的幂等性安全性：
- handlerPaymentSuccess / handlePaymentFailed 是否存在重复插入 payments 的风险？
- checkout.session.completed 与 payment_intent.succeeded 是否双事件处理？
- STRIPE_WEBHOOK_SECRET 是否有存在性检查？
- 错误消息是否泄露内部信息？

对每个风险点执行修复：
- 幂等性: 在插入前查询 provider_payment_id 唯一性
- 双事件: 移除 checkout.session.completed 分支
- 密钥检查: 替换非空断言 (!) 为防卫式条件判断
- 错误消息: 返回通用消息，不包含 Stripe 原始错误
```

### 5.3 SEO/OG 卡片生成

> 场景：为需求详情页生成动态 OG 社交卡片。

**Prompt 模板:**

```
请在 /demands/[id]/opengraph-image.tsx 实现 Edge Runtime 动态 OG 卡片：
- 使用 @vercel/og 的 ImageResponse
- 读取 demands 表获取标题/金额/状态
- 设计醒目社交分享卡片（标题、预算、区域、状态徽章）
- 使用 Tailwind 样式
- 确保 import 路径正确（检查 getSupabase 来源）
```

---

## 6. 生产上线 Pre-flight 检查清单

### Vercel 环境变量（必须配置）

| 变量 | 说明 | 来源 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | 同上 |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role 密钥（服务端私密） | 同上 |
| `NEXT_PUBLIC_SITE_URL` | 站点 URL | `https://deal-protocol-phi.vercel.app` |
| `STRIPE_SECRET_KEY` | Stripe 密钥（`sk_live_*` 生产） | Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | Webhook 签名密钥 | Stripe Dashboard → Webhooks |
| `GEMINI_API_KEY` | Gemini AI | Google AI Studio |
| `CRON_SECRET` | Cron Job 鉴权头 | 自行生成 32 位随机串 |
| `PII_ENCRYPTION_KEY` | 个人敏感信息加密密钥 | 自行生成 128 位 hex |
| `PAYMENT_SANDBOX` | `false`（生产） | | 

### Supabase 部署步骤

1. 在 Supabase SQL Editor 中按顺序执行迁移：
   - 执行 `supabase/migrations/20260718_grant_service_role_access.sql`（服务角色授权）
   - 执行 `supabase/migrations/20260718_init_rls_policies.sql`（RLS 初始化，含 demands/profiles/notifications）
   - 执行 `supabase/migrations/20260723_fix_admin_rls_rbac.sql`（RBAC 修复 + CHECK 约束补全）
2. 检查 `demands` 和 `contracts` 表的物理存在性（缺失 CREATE TABLE 语句）
3. 确认 Realtime 发布包含 `demands` 和 `notifications` 表

### 验证命令

```bash
npx tsc --noEmit          # 类型检查：期望 0 error
npm test                   # vitest：期望 112/113 (1 预存 E2E mock 失败)
npm run build              # Vercel 构建：期望 0 warning
```

---

## 附录: 迁移文件索引

| 文件 | 内容摘要 |
|---|---|
| `001_schema.sql` | 核心 DDL (users, protocols, orders, credit_records 等 12 表) + 初始 RLS |
| `002_create_user_fn.sql` | 注册函数 `create_user_direct` (SECURITY DEFINER, bypass rate-limit) + profiles INSERT |
| `003_credit_dimensions.sql` | 信用维度细化 |
| `004_team_formation.sql` | team_requests 表 + RLS |
| `005_match_providers_nearby.sql` | 地理邻近匹配函数 |
| `006_add_rejected_status.sql` | 增加拒绝状态 |
| `007_rls_team_visibility.sql` | 团队可见性 RLS 修复 |
| `008_protocol_meta.sql` | 协议元数据扩展 |
| `009_pricing_configs.sql` | 定价配置表 + RLS |
| `010_grab_demand_rpc.sql` | 抢单 RPC 函数 |
| `011_verification_fields.sql` | profiles 扩展（实名认证字段） |
| `012_payment_and_wallets.sql` | 钱包 + 流水表 + RLS (!!! 含旧邮箱策略) |
| `013_order_disputes.sql` | 纠纷表 + 正确 RBAC 策略 |
| `014_provider_withdrawals.sql` | 提现表 + 正确 RBAC 策略 |
| `015_notifications_system.sql` | 通知表 + 正确 RBAC 策略 (!!! 但角色值为大写 `'ADMIN'`) |
| `016_reputation_system.sql` | 声誉评分 + order_reviews |
| `017_ai_matching_system.sql` | 向量匹配 + developer_profiles |
| `018_enable_realtime.sql` | Realtime 发布逐表激活 |
| `20260718_grant_service_role_access.sql` | 服务角色授权（已移除 anon） |
| `20260718_init_rls_policies.sql` | 新增 demands/profiles/notifications RLS + Realtime |
| `20260723_fix_admin_rls_rbac.sql` | 🔧 RBAC 重构 + CHECK 约束修复 |
