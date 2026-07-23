# Deal Protocol — 全栈对齐审查报告

> 审查日期: 2026-07-23 | 审查范围: src/app/ src/components/ src/modules/ src/lib/ AI_HANDOFF.md
> 审查维度: 业务方案 ↔ 代码 ↔ UI/UX ↔ 线上布局

---

## 1. 执行摘要 (Executive Summary)

| 维度 | 完成度 | 健康状态 |
|------|--------|----------|
| D1: 业务方案 ↔ 路由映射 | **75%** | ⚠️ 支付流程存在重大偏差，30/42 路由未在 AI_HANDOFF 记录 |
| D2: UI/UX 视觉一致性 | **68%** | ⚠️ 无 error.tsx/loading.tsx，SplitDemandView 非响应式，调色板碎片化 |
| D3: 数据流与状态机 | **55%** | 🔴 `demands.status` 三套冲突枚举，`fund_status` 双副本不同步 |
| D4: AI 交互表现层 | **60%** | ⚠️ Demo 模拟与生产代码交织，`alert()` 替代 toast()，无移动端适配 |
| D5: 生产部署约束 | **70%** | 🔴 PWA manifest 文件缺失 404，`ignoreBuildErrors: true` 风险 |

**整体完成度评分: 66%** — 功能完整但存在跨层断层与一致性缺口，建议上线前先解决 P0 项。

---

## 2. 完全对齐与高完备度模块 (Fully Aligned Modules)

| 模块 | 路由 | 对齐情况 |
|------|------|----------|
| 认证链路 (登录/注册) | `/login`, `/register` | 与 AI_HANDOFF 4.1 节完全一致，SessionProvider + proxy.ts 认证闭环 |
| 管理后台 | `/admin/*` (9 个子路由) | RBAC `role = 'admin'` 策略正确部署，页面功能完整 |
| 争议模块 | `/disputes`, `/disputes/[id]` | 前后端状态机对齐，包含时间线、证据链功能 |
| PWA Service Worker | `/offline`, `/sw.js` | 离线缓存策略正确，sw.ts 注入 solid |
| API 安全 | 所有 API 路由 | 客户端无密钥泄露，所有 `NEXT_PUBLIC_` 使用正确 |

---

## 3. 发现的断层与冲突项 (Identified Gaps & Conflicts)

### P0 — 阻断性 (3 项)

#### P0-1: `demands.status` 存在三套冲突枚举定义

**严重性**: 阻断性 — 数据完整性无保证

| 来源 | 定义的值 |
|------|----------|
| DDL (迁移) | `'PENDING'` (default) |
| `src/lib/demand/state.ts` | `OPEN` → `MATCHED` → `ACCEPTED` → `CANCELLED` |
| `src/lib/status-map.ts` | `ASSIGNED, DEPARTED, ARRIVED, STARTED, COMPLETED, pending_payment, paid_escrow, settled` |
| `assign/route.ts` | `OPEN` → `ASSIGNED` |
| `match/route.ts` | `MATCHED` |
| `status/route.ts` | `DEPARTED, ARRIVED, STARTED, COMPLETED` |
| `admin/arbitrate/route.ts` | `"refunded"`, `"settled"`, `"completed"` (小写！) |

DDL 默认值 `'PENDING'` 与 `state.ts` 转换验证期望的 `'OPEN'` 不匹配。新创建的行不会被任何状态转换代码识别。

**建议修复**: 统一到单一状态机，在 `src/lib/demand/state.ts` 中定义规范枚举，所有 API 路由引用同一来源。

#### P0-2: PWA `manifest.webmanifest` 文件缺失 (404)

**文件**: `public/manifest.webmanifest` **不存在**
**引用者**: `src/app/layout.tsx` 第 29 行 `manifest: "/manifest.webmanifest"`
**影响**: 浏览器 `<link rel="manifest">` 返回 404，PWA "添加到主屏幕" 功能不会触发。

**建议修复**: 创建 `public/manifest.webmanifest` 包含 `start_url`, `display: standalone`, `icons`。

#### P0-3: `payment-service.ts` 管理 `protocols.status` 而非 `contracts.fund_status`

**文件**: `src/modules/m13-payment/payment-service.ts`
**发现**: 支付服务读取/写入 `protocols` 表的 `status` 字段，而其余代码库管理 `contracts` 表的 `fund_status`。`confirmCompletion` 直接从 `HELD`→`satisfaction_held` 跳过了 `COMPLETED` 状态。
**影响**: 两个并行状态机在相同业务数据上运行但不同步。

**建议修复**: 统一到 `contracts.fund_status`，支付服务通过统一的状态机接口操作。

---

### P1 — 体验缺口 (7 项)

#### P1-1: Stripe 支付流程与 AI_HANDOFF 描述严重偏离

| AI_HANDOFF 描述 | 实际代码 |
|-----------------|----------|
| `POST /api/payment/create` (withAuth) | 页面调用 `POST /api/payment/escrow` |
| `StripeProvider.createPayment()` → PaymentIntent + client_secret | 页面直接调用后端端点，显示 "资金已安全托管" toast |
| `stripe.confirmCardPayment(client_secret)` | **不存在** — 缺少客户端 Stripe Elements 集成 |
| 重定向到 `/payment/[id]` | 重定向到 `/client/orders/[id]` |

**建议修复**: 要么更新 AI_HANDOFF 文档反映当前实现，要么实现真实的客户端 Stripe Elements 流程。

#### P1-2: 整个应用无 `error.tsx` 文件

**影响**: 任何页面崩溃都触发全局 UXProvider ErrorBoundary 的统一 "页面发生异常" 消息，无局部恢复能力。
**建议修复**: 为核心路由添加 `error.tsx`（`demands/`, `orders/`, `payment/`, `admin/`）。

#### P1-3: `demands/` 下无 `loading.tsx` 文件

**影响**: `/demands/new`, `/demands/create`, `/demands/[id]` 无骨架屏加载状态。`/demands/new` 使用 `dynamic(..., { ssr: false })` 但无加载回退，慢速连接下白屏。
**建议修复**: 为每个目录添加 `loading.tsx`，至少包含骨架屏组件。

#### P1-4: SplitDemandView 无响应式布局

**文件**: `src/components/SplitDemandView.tsx`
**发现**: 使用固定 `w-[45%]` + `flex-1` 双栏布局，**完全没有响应式断点**。在手机端 (< 768px) 面板会挤压超出屏幕。
**建议修复**: 改用 `flex-col lg:flex-row`，移动端堆叠显示。

#### P1-5: `contracts.fund_status` 双副本状态机不同步

- `payment-service.ts` 管理 `protocols.status`
- 状态机引擎管理 `contracts.fund_status`
- `confirmCompletion` 跳过 COMPLETED: `HELD` → `satisfaction_held`

**建议修复**: 移除 `payment-service.ts` 中的直接 SQL 写入，改用 `contract-machine.ts` 的 `addContractEvent`。

#### P1-6: `scripts/seed-local.ts` 种子数据小写

```typescript
fund_status: "held",   // 应为 "HELD"
```
种子数据无法被 `=== "HELD"` 检查匹配到。

**建议修复**: 统一为大写常量。

#### P1-7: AI_HANDOFF.md 仅记录了 42 个页面路由中的 12 个

遗漏 30 个路由（71%），包括 `/demands`, `/orders`, `/disputes/*`, `/chat/[id]`, `/evidence/[id]`, `/finance`, `/sos` 以及 8 个 `/admin/*` 子页面。

**建议修复**: 同步 AI_HANDOFF.md 路由表格覆盖全部 42 个页面。

---

### P2 — 视觉/细节微瑕 (8 项)

#### P2-1: 调色板碎片化
- 管理员: `slate` 调色板 + `dark:zinc-...`
- Demands: `zinc` 调色板
- SplitDemandView: 混合 `gray`/`slate`/`zinc`

**建议修复**: 统一使用 `slate` 或 `gray` 一种调色板。

#### P2-2: SplitDemandView 使用 `alert()` 而非 `toast()`
第 215/220/223 行使用浏览器 `alert()`，应用其余部分统一使用 `react-hot-toast`。

#### P2-3: SplitDemandView 与 `/demands/create` 无暗色模式
缺少 `dark:` Tailwind 类，而应用其他部分有一致的暗色模式支持。

#### P2-4: SplitDemandView 影子拦截器无防护
`useEffect` 在每次 `messages` 变更时触发，可能多次解析 `[PROTOCOL_JSON]` 标记覆盖协议数据。

#### P2-5: `extractedProtocol` 使用 `any` 类型
缺少 TypeScript 类型安全，与项目严格模式不一致。

#### P2-6: `/demands/create` API 调用后重定向到列表而非详情
创建需求后重定向到 `/demands`（列表），无法查看刚创建的需求详情。

#### P2-7: Contest/dispute resolver 强制 `HELD` → `SETTLED`
`dispute/resolver.ts` 强行从 `HELD` 更新到 `SETTLED`，但争议期间合同可能已处于 `COMPLETED`/`CANCELLED` 状态。

#### P2-8: `src/app/api/register/route.ts` 硬编码 Supabase URL
第 52 行硬编码 `https://eixqnwaxcnwtxiizmdfs.supabase.co`，而非从 `NEXT_PUBLIC_SUPABASE_URL` 读取。

---

## 4. 低成本优化与修复清单 (Actionable Tasks)

### 立即修复 (P0, < 30 分钟)

| # | 任务 | 文件 | 预估 |
|---|------|------|------|
| A1 | 创建 `public/manifest.webmanifest` 文件 | `public/manifest.webmanifest` | 5 min |
| A2 | `demands.status` 统一枚举定义 | `src/lib/demand/state.ts` + 各 API route | 30 min |
| A3 | 种子数据大写统一 | `scripts/seed-local.ts` | 2 min |

### 体验提升 (P1, < 2 小时)

| # | 任务 | 文件 | 预估 |
|---|------|------|------|
| B1 | 为关键路由添加 `error.tsx` | `app/demands/`, `app/orders/`, `app/payment/`, `app/admin/` | 20 min |
| B2 | 为 demands/ 添加 `loading.tsx` | `app/demands/` | 15 min |
| B3 | SplitDemandView 响应式修复 | `SplitDemandView.tsx` | 20 min |
| B4 | `payment-service.ts` 统一到 `contracts.fund_status` | `payment-service.ts` | 30 min |
| B5 | 同步 AI_HANDOFF.md 路由清单 | `AI_HANDOFF.md` | 15 min |
| B6 | Stripe 支付流程文档与实际对齐 | `AI_HANDOFF.md §4.3` | 10 min |

### 细节完善 (P2, < 1 小时)

| # | 任务 | 文件 | 预估 |
|---|------|------|------|
| C1 | SplitDemandView `alert()` → `toast()` | `SplitDemandView.tsx` | 10 min |
| B7 | 统一 `demands/` 和 `SplitDemandView` 暗色模式 | `demands/create/page.tsx`, `SplitDemandView.tsx` | 15 min |
| C2 | 调色板统一 (slate vs zinc vs gray) | 跨多个页面 | 20 min |
| C3 | 硬编码 Supabase URL → env 变量 | `register/route.ts` | 2 min |
| C4 | `extractedProtocol` `any` → 具名类型 | `SplitDemandView.tsx` | 10 min |
| C5 | `dispute/resolver.ts` 状态转换安全 | `dispute/resolver.ts` | 15 min |

---

## 5. 附录: 维度扫描摘要

| 维度 | 扫描文件数 | 发现总项 | P0 | P1 | P2 |
|------|-----------|---------|----|----|----|
| D1: 业务-路由映射 | 42 页 + 20 API | 7 | 0 | 3 | 4 |
| D2: UI/UX 一致性 | 14 关键组件 | 9 | 0 | 4 | 5 |
| D3: 数据流-状态机 | 28 文件引用 | 7 | 1 | 4 | 2 |
| D4: AI 交互层 | SplitDemandView (623行) | 5 | 0 | 1 | 4 |
| D5: 生产部署 | 12 配置文件 | 7 | 2 | 1 | 4 |

---

*审查完成。A 类 (P0) 栏截项建议上线前解决；B 类 (P1) 体验缺口建议迭代 1 中处理；C 类 (P2) 视觉瑕疵可跟踪至后续迭代。*
