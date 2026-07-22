# UI/UX 健康度审计报告

> 生成日期: 2026-07-19 · 审计范围: `src/app/` (pages), `src/components/`, `src/lib/`, `src/hooks/`

---

## 1. 技术栈现状

| 维度 | 确认 |
|------|------|
| **前端框架** | Next.js 16 (`next@^16.0.0`) + React 19 (`react@^19.0.0`) |
| **渲染策略** | App Router (SRC 目录结构 `src/app/`)，混合 SSR + `"use client"` 客户端组件 |
| **样式方案** | Tailwind CSS v4 (`@tailwindcss/postcss@^4.3.2` + `tailwindcss` 4.x 内联 `@import "tailwindcss"`) + `tw-animate-css`。无 `.scss`/`.css` 模块文件。 |
| **组件库** | **无第三方 UI 组件库**。自建 `src/components/ui/` 基座（button, card, dialog, input, select, badge, table, textarea, sheet, popover, dropdown-menu, Skeleton, sonner）基于 `class-variance-authority` + `tailwind-merge` + `clsx`。 |
| **动画** | `framer-motion@^12.42.2` + `tw-animate-css` |
| **图标** | `lucide-react@^1.23.0` |
| **Toast** | 双重: `react-hot-toast` (主) + `sonner` (备, 仅 `UXProvider` 未启用) |
| **状态管理** | `zustand@^5.0.0` (已安装) + `@ai-sdk/react` (AI hooks) + `nanoid` (id 生成) |
| **地图** | `leaflet@^1.9.4` + `react-leaflet@^5.0.0` + `@types/leaflet` |
| **服务端验证** | `zod@^3.24.0` |
| **包管理器** | npm (lockfile v3) |
| **类型检查** | TypeScript 5.8, `next.config.ts` 中已强制 `ignoreBuildErrors: true` |
| **Lint** | ESLint 9 (`next lint` 命令当前因 cwd 路径问题无法运行) |
| **PWA/离线** | `@serwist/next` (已配置但 `disable: true`) + 自定义 `sw.js` |
| **Obfuscation** | `webpack-obfuscator` 仅在 production 下生效 |

---

## 2. 受影响/已被修改的 UI 文件列表

### 2.1 Git 已修改（Modified）

| 文件 | 变更概要 |
|------|----------|
| `src/app/layout.tsx` | 将 `sonner::Toaster` 抽出为 `UXProvider`（含 `react-hot-toast::Toaster` + `ErrorBoundary`） |
| `src/app/provider/grab/[id]/page.tsx` | 重写，将内联抢单 UI 抽出至独立 `GrabConsole` 组件 |
| `src/app/provider/incoming/page.tsx` | 重写为 SSR + 客户端 `IncomingListClient` 双层架构 |

### 2.2 新增的 UI 文件（Untracked — 新功能开发）

| 文件 | 功能 |
|------|------|
| `src/app/provider/grab/[id]/GrabConsoleClientWrapper.tsx` | 抢单控制台的服务端包装层 |
| `src/app/provider/grab/[id]/loading.tsx` | 抢单页 loading 骨架 |
| `src/app/provider/incoming/IncomingListClient.tsx` | 实时接单列表客户端（含 Supabase realtime + 地理定位） |
| `src/app/provider/incoming/loading.tsx` | 接单池 loading 骨架 |
| `src/app/provider/orders/[id]/OrderFulfillmentClient.tsx` | **核心履约工作台**（含长按流程、证书上传、地图） |
| `src/app/provider/orders/[id]/loading.tsx` | 履约工作台 loading 骨架 |
| `src/app/client/orders/[id]/ClientTrackingClient.tsx` | 客户端跟踪页（含 Supabase realtime 状态推送） |
| `src/app/client/orders/[id]/loading.tsx` | 客户端跟踪页 loading 骨架 |
| `src/app/admin/dashboard/DashboardClient.tsx` | 管理后台仪表盘 |
| `src/components/GrabConsole.tsx` | 紧急抢单控制台组件（framer-motion 动画） |
| `src/components/MapComponent.tsx` | Leaflet 地图组件 |
| `src/components/SwipeableCard.tsx` | 可滑动需求卡片 |
| `src/components/providers/UXProvider.tsx` | global UI Provider（ErrorBoundary + Toast） |
| `src/components/ui/Skeleton.tsx` | 骨架屏 UI 组件 |
| `src/hooks/useFulfillmentMutation.ts` | 离线履约缓存 hook |
| `src/lib/upload.ts` | 图片上传指数退避重试 |

---

## 3. 代码层面的潜在问题

### 3.1 TypeScript 编译错误（用户源文件，不含 tests/mobile）

| 文件 | 行 | 问题 |
|------|----|------|
| `src/app/manifest.ts` | 16,22 | `"any maskable"` 值错误，PWA manifest 期望 `"maskable"` |
| `src/app/sw.ts` | 3 | `ServiceWorkerGlobalScope` 在 `@serwist/next` 下未导出 |
| `src/lib/payment.ts` | 182,191,194,199,212,215 | 类型定义脱节：`contractId` 不在 `CreatePaymentParams` 中；`providerPaymentId`/`redirectUrl` 不在 `CreatePaymentResult` 中；`refund` 不在 `PaymentManager` 上；`NotifyResult` 缺少 `error`/`providerPaymentId` |

> **注意**: `next.config.ts` 中设置了 `ignoreBuildErrors: true`，这些错误在打包时被静默忽略。

### 3.2 Broken Imports

无失效导入。以下关键导入全部可用:

| 导入方 | 目标 | 状态 |
|--------|------|------|
| `IncomingListClient.tsx` | `@/components/SwipeableCard` | ✅ |
| `provider/incoming/page.tsx` | `@/components/SwipeableCard` (`IncomingDemand` type) | ✅ |
| `layout.tsx` | `@/components/providers/UXProvider` | ✅ |
| `GrabConsoleClientWrapper.tsx` | `@/components/GrabConsole` | ✅ |
| `provider/orders/[id]/page.tsx` | `./OrderFulfillmentClient` | ✅ |
| `client/orders/[id]/page.tsx` | `./ClientTrackingClient` | ✅ |
| `OrderFulfillmentClient.tsx` | `@/hooks/useFulfillmentMutation`, `@/lib/upload` | ✅ |

### 3.3 CSS / 样式冲突

| 问题 | 说明 |
|------|------|
| `globals.css` 中 `@theme inline { ... }` 块声明了大量 CSS 变量引用（`sidebar-*`, `chart-*`, `card-*` 等）但**没有在 CSS 文件中定义这些变量的具体值**。它们由 Tailwind v4 或 shadcn/ui 风格的主题变量定义，但当前未设置缺省值，导致某些环境下变量解析为 `initial`。 |
| 同时存在 `@import "tailwindcss"` 和 `@import "tw-animate-css"`，两套动画方案共存（`tw-animate-css` vs `framer-motion`）。 |
| Tailwind v4 已弃用 `@tailwind base/components/utilities` 语法，项目使用了新的 `@import "tailwindcss"` 方式，配置是正确的。 |

### 3.4 未闭合标签

通过扫描检查，未发现未闭合 JSX 标签。全部组件的标签结构正确。

### 3.5 重复/冲突样式

**两个 Toast 库共存**: `react-hot-toast` 安装在 `UXProvider` 中（实际渲染），而 `sonner` 仍保留在 `dependencies` 中且被弃用。部分组件（`ProviderConsole.tsx`）仍从 `sonner` 导入 `toast`:

- `ProviderConsole.tsx:8` — `import { toast } from "sonner"` ✅（sonner 包存在，可以工作但风格不一致）
- `ClientTrackingClient.tsx:5` — `import toast from "react-hot-toast"` ✅（统一到 hot-toast）
- `OrderFulfillmentClient.tsx:5` — `import toast from "react-hot-toast"` ✅

建议统一到 `react-hot-toast` 并将 `sonner` 从依赖中移除。

### 3.6 主题变量缺失

`globals.css` 的 `@theme inline` 中引用了 30+ 个 CSS 变量，但实际的变量值未在 CSS 中定义。这意味着:
- 暗黑模式下部分 Token 可能解析为无效值（例如 `sidebar-ring`、`chart-1`）
- 所有 shadcn 风格的变量引用目前无兜底值

---

## 4. UI 组件现状梳理

### 4.1 结构相对完整的组件

| 组件 | 行数 | 备注 |
|------|------|------|
| `OrderFulfillmentClient.tsx` | ~280 | 全部履约流程（长按流转、证书上传、地图、进度条），已集成离线 cache + 上传重试 |
| `ClientTrackingClient.tsx` | ~102 | Realtime 状态推送、完工凭证展示，流量完成 |
| `ProviderConsole.tsx` | ~442 | 完整的接单 + 合同管理 + 结算流程 |
| `ClientConsole.tsx` | — | 客户端需求创建/管理控制台 |
| `GrabConsole.tsx` | ~146 | 紧急抢单 UI + framer-motion 动画 + 音效，流量完成 |
| `IncomingListClient.tsx` | ~108 | 实时接单池 + 地理定位排序 + Supabase realtime |
| `SwipeableCard.tsx` | — | 可滑动操作组件 |
| `MapComponent.tsx` | — | Leaflet 地图组件，SSR 安全的 dynamic import |
| `Home` (page.tsx) | ~255 | 完整的营销首页（Hero + Bento Grid + 数据面板 + CTA） |
| `UXProvider.tsx` | ~21 | ErrorBoundary + Toast 全局封装 |
| `ui/Skeleton.tsx` | — | 骨架屏组件 |

### 4.2 结构基本完整但缺少 "打磨" 的页面

| 页面/组件 | 问题 |
|-----------|------|
| `admin/dashboard/DashboardClient.tsx` | 只展示了基础 stats + 异常列表。页面无详细路由导航（侧边栏缺失） |
| `admin/complaints/page.tsx` | 存在但未确认是否和 Dashboard 打通导航 |
| `admin/disputes/page.tsx` | 同上 |
| `admin/protocols/page.tsx` | 同上 |
| `admin/config/page.tsx` | 同上 |
| `chat/[id]/page.tsx` | 聊天页面存在，但缺少从履约/接单页面的跳转入口 |
| `verification/page.tsx` | 身份验证页面存在，无集成入口 |
| `team/create/page.tsx` | 组队功能存在，未确定 UI 流程完整性 |
| `rights/page.tsx` | 权益页面存在，内容未知 |

### 4.3 前端页面路由覆盖面

```
主页 /
├── /landing
├── /demands (需求列表)
│   ├── /demands/new (创建需求)
│   └── /demands/[id] (需求详情)
├── /provider (服务商控制台)
│   ├── /provider/grab/[id] (紧急抢单)
│   ├── /provider/incoming (接单池)
│   └── /provider/orders/[id] (履约工作台) ✅ 完整
├── /client/orders/[id] (客户端跟踪) ✅ 完整
├── /orders (订单列表)
│   ├── /orders/[id] (订单详情)
│   └── /orders/[id]/review (评价)
├── /chat/[id] (对话)
├── /console (控制台入口)
├── /dashboard
├── /login / /register (认证)
├── /profile (个人资料)
├── /payment/[id] (支付)
├── /team
│   ├── /team/create
│   └── /team/[id]
├── /evidence/[id] (存证)
├── /sos (紧急求助)
├── /rights (权益)
├── /verification (身份验证)
├── /demo (演示)
├── /admin
│   ├── /admin/dashboard
│   ├── /admin/complaints
│   ├── /admin/disputes
│   ├── /admin/protocols
│   ├── /admin/config
│   └── /admin/review
└── /user/[id]
```

---

## 5. 下一步修复的优先顺序建议

### P0 — 立即修复（阻断性）

| # | 任务 | 文件 | 原因 |
|---|------|------|------|
| 1 | 修复 `manifest.ts` 错误 | `src/app/manifest.ts:16,22` | PWA manifest 加载失败导致控制台报错 |
| 2 | 修复 `payment.ts` 类型断链 | `src/lib/payment.ts` | 6 个 TS 错误，支付逻辑无法通过类型检查，运行时可能 crash |
| 3 | 统一 Toast 方案 | `globals.css` / `UXProvider.tsx` / `ProviderConsole.tsx:8` | 两个 toast 库共存，`sonner` 和 `react-hot-toast` API 不一致 |

### P1 — 建议修复（影响体验）

| # | 任务 | 文件 | 原因 |
|---|------|------|------|
| 4 | `globals.css` 添加 CSS 变量缺省值 | `src/app/globals.css` | `@theme inline` 引用了变量但未赋值，暗黑模式主题 Token 可能无效 |
| 5 | 移除 `sonner` 依赖 | `package.json` | 已不再使用，仅 `ProviderConsole` 仍引用，应迁移到 `react-hot-toast` |
| 6 | Admin 侧边栏导航 | `src/app/admin/*` | 所有 admin 页面缺少统一的 sidebar 导航，无法切换页面 |
| 7 | `sw.ts` 的类型修复 | `src/app/sw.ts` | Service Worker 全局作用域类型丢失 |

### P2 — 迭代优化

| # | 任务 | 原因 |
|---|------|------|
| 8 | `react-leaflet` 类型检查 | 当前地图通过 `dynamic(() => import(...))` 加载，需确保 SSR 兼容 |
| 9 | 履约工作台与 ProviderConsole 的功能重叠 | 两个页面都实现了接单/履约逻辑，需统一入口 |
| 10 | 添加 E2E 测试覆盖履约流程 | `tests/` 下有大量集成测试但缺少 E2E 浏览器测试 |
| 11 | 页面级 loading 骨架屏覆盖率 | 只有 provider/orders、provider/grab、provider/incoming、client/orders 有 loading.tsx |
| 12 | 基于 `STATUS_MAP` 的前端状态常量复用 | `status-map.ts` 已创建但前端组件仍各自定义本地 `STATUS_MAP` |
| 13 | 审计 `react-hot-toast` 的 toast 调用中是否有机内双模式混用 | 部分组件 `toast.error()` vs `toast()` 混用 |
| 14 | PWA 开关启用 | `@serwist/next` 已配置 `disable: true`，建议在平台稳定后开启 |
