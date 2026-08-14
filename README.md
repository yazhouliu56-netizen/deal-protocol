# 🤝 Deal Protocol (去中心化需求撮合与订单履约协议平台)

[![CI - TypeCheck & Smoke Test](https://github.com/yazhouliu56-netizen/deal-protocol/actions/workflows/ci.yml/badge.svg)](https://github.com/yazhouliu56-netizen/deal-protocol/actions/workflows/ci.yml)
![Node Version](https://img.shields.io/badge/Node.js-22%2B-brightgreen)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-black)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-green)
![License](https://img.shields.io/badge/License-MIT-blue)

**Deal Protocol** 是一个基于 **Next.js (App Router)** + **Supabase Realtime** + **React Native (Expo)** 构建的高可靠去中心化需求撮合、资金托管与订单履约协议平台。项目集成了全双工实时状态同步、严谨的状态机控制、仲裁举证链以及自动化 CI/CD 端到端（E2E）回归测试门禁。

> **单体架构（ADR-0018 单仓深度融合竣工）**：原 `oto-spatial-web/` 子项目已完全并入本仓库（base/ammo 共享底座、5-provider AI Gateway、`/oto` 5 屏空间应用、PWA 真推），仓库为单一 npm workspace 应用。

---

## 📖 目录 (Table of Contents)

- [🚀 核心业务主线](#-核心业务主线)
- [🧭 访问入口（协议前端 / OTO 空间应用）](#-访问入口协议前端--oto-空间应用)
- [⚡ Supabase Realtime 实时架构](#-supabase-realtime-实时架构)
- [🤖 5-Provider AI Gateway](#-5-provider-ai-gateway)
- [📁 项目目录结构](#-项目目录结构)
- [🛠️ 本地开发环境配置](#️-本地开发环境配置)
- [🧪 自动化测试与 CI/CD 门禁](#-自动化测试与-cicd-门禁)
- [📄 开源许可证](#-开源许可证)

---

## 🚀 核心业务主线

本平台采用严谨有限状态机 (FSM) 驱动，涵盖需求生命周期的四大核心业务环节：

```
+-------------------+      (竞标 / 选定)      +-------------------+
|  1. 需求广场与撮合 | ---------------------> |  2. 订单全流程履约 |
+-------------------+                        +-------------------+
       |                                             |
       (资金托管锁定)                                 (争议 / 纠纷)
       v                                             v
+-------------------+      (提现 / 结算)      +-------------------+
|  4. 财务与提现仪表 | <--------------------- |  3. 维权仲裁中心   |
+-------------------+                        +-------------------+
```

### 1. 需求广场与动态竞标 (Demand & Bidding)
* **需求发布与资金托管**：需求方设定需求指标、预算与交付期限，发布时自动将资金托管至平台合约/专用资金池。
* **服务商竞标**：服务商提交方案与报价，需求方选择合适的服务商后，锁定保证金并正式生成履约订单。

### 2. 订单全生命周期履约 (Order Fulfillment Lifecycle)
* **状态机流转**：严格遵循 pending_payment -> in_progress -> submitted -> completed 校验状态。
* **阶段交付与验收**：服务商按节点上传交付物（代码仓库、图纸、媒体资源等），需求方可在线审查并进行一键验收结算。

### 3. 维权与仲裁中心 (Dispute Arbitration System)
* **争议发起与冻结**：履约过程中若发生质量或时效争议，任一方均可发起维权，订单状态即刻冻结并进入仲裁审核。
* **举证链与比例裁决**：双方提交证据与聊天存证，仲裁节点/DAO 根据事实依据进行百分比划转裁决（如按比例退还/划拨余额）。

### 4. 财务仪表盘与提现结算 (Financial & Withdrawal)
* **实时资金视图**：实时计算并展示可用余额、托管冻结资金、维权冻结资金及历史累计收益。
* **流水核销与提现**：支持提现申请提交、银行/链上流水匹配与账单自动对账导出。

---

## 🧭 访问入口（协议前端 / OTO 空间应用）

| 入口 | 路由 | 说明 |
| :--- | :--- | :--- |
| 协议前端（主应用） | `/` 及 `/demands` `/orders` `/disputes` `/finance` 等 | 需求广场、撮合、履约、仲裁、财务全链路（43 页面 + 根入口） |
| **OTO 空间应用** | `/oto` | 5 屏沉浸式空间交互 SPA（home / AI 对话 / AR 预览 / 行程 / 个人中心），Zustand 驱动 + PWA 离线兜底 |

---

## ⚡ Supabase Realtime 实时架构

为了在 Web 端与 Mobile 端实现毫秒级的状态无感更新，平台在 Supabase 数据库层为 **6 大核心表** 启用了 CDC (Change Data Capture) 实时发布（`supabase/migrations/018_enable_realtime.sql` + `015_notifications_system.sql`）：

| 核心表名 (Table) | 监听事件 (Events) | 业务应用场景 |
| :--- | :--- | :--- |
| `orders` | `UPDATE` | 订单履约状态（如推进至 `submitted` / `completed`）全端同步 |
| `profiles` | `UPDATE` | 用户资料与余额展示实时刷新 |
| `provider_wallets` | `UPDATE` | 服务商钱包余额与托管冻结资金实时联动 |
| `demands` | `INSERT`, `UPDATE` | 需求广场大盘新需求实时推送到看板、抢单/接单状态变更 |
| `withdrawal_requests` | `INSERT`, `UPDATE` | 提现申请创建与审核结果即时通知 |
| `notifications` | `INSERT` | 通知中心入站提醒实时送达 |

前端对应订阅封装见 `src/hooks/use-order-realtime.ts`、`use-finance-realtime.ts`、`useSupabaseRealtime.ts`。

### 原生 WebSocket 支持 (Node.js 22+)
针对 Node.js 环境（如 CI 和后台 E2E 校验脚本），客户端进行了 WebSocket 传导优化：
* 指定 `realtime: { transport: globalThis.WebSocket }`，全面兼容 **Node 22** 原生 `WebSocket` 引擎，保障 CI 云端脚本无感知稳定连通。

---

## 🤖 5-Provider AI Gateway

LLM 调度统一收敛至 `src/base/ai/gateway/`（ADR-0005）：provider 表驱动（GEMINI / ZHIPU / DASHSCOPE / GROQ / OPENROUTER）+ 任务路由 + 配额 + 429 冷却 + 降级链。语音链（`/api/asr`、`/api/tts`、`/api/voice-intent`）与 waves 对话（`/api/waves/chat`）均由 Gateway 承载。

---

## 📁 项目目录结构

```
deal-protocol/
├── src/                      # 单体应用主目录 (Next.js App Router)
│   ├── app/                  # 业务路由 (需求广场/履约/仲裁/财务 + oto/)
│   │   ├── oto/              # OTO 5 屏空间应用 (SPA + 独立 layout/PWA)
│   │   └── api/              # 99 API 路由 (含 /api/gateway /api/asr /api/push/*)
│   ├── base/                 # 共享底座九域 (ai/comm/dispatch/form/geo/money/notify/order/platform/risk/safe/trust)
│   ├── ammo/                 # 弹药属性表 (dispatch-rule/risk-rule/pricing-formula/sop/scene-template...)
│   ├── store/                # Zustand 状态机 (useWaveStore 等 7 store)
│   ├── components/           # UI 组件 (waves/ 协议域 + oto-ui/ 空间域 + ui/ shadcn)
│   ├── hooks/                # Supabase Realtime 订阅自定义 Hooks
│   ├── lib/                  # Supabase Client 初始化与状态机工具库
│   ├── modules/              # 领域模块 (Modular Monolith: m02-m14)
│   └── types/                # database.types.ts 数据库强类型契约
├── mobile/                   # 移动端子工程 (React Native / Expo) - TypeScript 隔离
├── supabase/migrations/      # 数据库迁移脚本 (001-018 + 日期化补丁 + p2p_broadcast)
├── packages/                 # 内部共享包 (payment-core / credit-formula)
├── scripts/                  # 自动化脚本 (e2e-*.mjs ×12 / verify-prod / dev-all / generate-vapid ...)
├── tests/                    # Vitest 单元/集成测试 (426 tests)
├── e2e/                      # Playwright E2E 测试 (full-flow / dispute-flow / new-features / production-smoke)
├── docs/                     # 架构/方案/ADR/宪法/收敛登记文档
├── .github/workflows/        # GitHub Actions CI/CD 流水线配置
│   ├── ci.yml                # 类型检查 + 全量测试 + 生产冒烟
│   └── db-migration.yml      # 数据库迁移自动推送
├── tsconfig.json             # 根 TypeScript 配置 (已排除 mobile/tests/scripts)
└── package.json              # 项目依赖与运行脚本 (npm workspaces: mobile + packages/*)
```

---

## 🛠️ 本地开发环境配置

### 1. 前置要求
* **Node.js**: `>= 22.0.0`（强烈建议，支持原生 WebSocket）
* **npm**: `>= 10.0.0`

### 2. 环境变量配置
复制项目根目录下的 `.env.example` 为 `.env.local` 并填写实际值：

```bash
cp .env.example .env.local
```

`.env.example` 中已按业务分组（Supabase / LLM / Gateway 5-provider / SMS / 支付渠道 / 推送 VAPID / SOS / 实名 / Cron / PII 加密）列出全部键位及说明；`.env.local` 不会提交到版本库。

### 3. 安装依赖与启动服务

```bash
# 1. 安装项目依赖
npm ci

# 2. 启动本地开发服务器
npm run dev
```

打开浏览器访问 http://localhost:3000 即可开始开发；**OTO 空间应用**访问 http://localhost:3000/oto 。

---

## 🧪 自动化测试与 CI/CD 门禁

项目建立了健全的本地与云端自动化质量校验体系。

### 测试基线（单仓融合终态）

| 指标 | 数量 |
| :--- | :--- |
| 单元测试（vitest 根 426 + node:test 430，58 个 node:test 文件） | **856** |
| E2E 脚本（`scripts/e2e-*.mjs`，playwright-core 驱动） | **12** |
| API 路由（`src/app/api/**/route.ts` 实测） | **99** |
| 页面（协议前端 43 + 根入口 + OTO 5 屏） | **44 page.tsx** |
| 组件（waves + oto-ui + ui） | **100+** |

### 本地测试命令

```bash
# 1. 执行全量 TypeScript 类型检查 (不含 mobile / tests / scripts 子目录干扰)
npx tsc --noEmit

# 2. 执行全量单元测试 (vitest 426 + node:test 430，一键 856 全绿)
npm test

# 3. 执行全量生产回归 (build → start :3000 → 12 条 E2E)
npm run test:verify

# 4. 收敛门禁 (结构改动 rename 登记核查)
npm run check:convergence
```

### GitHub Actions CI/CD 流水线 (ci.yml)

每次向 `master` 分支推送代码或提交 PR 时，GitHub Actions 会自动触发以下校验流程：

1. **TypeCheck & Build**（PR + push）：`npx tsc --noEmit` 类型检查 → `npm run build` 生产构建冒烟（排除 `mobile/`、`tests/`、`scripts/` 后干净校验）。
2. **Unit Tests & Lint**（PR + push）：`npm test` 全量单测（856 项）+ `npm run lint` ESLint。
3. **E2E Regression**（仅 push 至 master）：安装 Playwright Chromium → `npm run test:verify` 全链演练（build → `next start :3000` → 12 条 `e2e-*.mjs` 全量回归）。
4. **Vercel Smoke**（部署成功后）：对线上 URL 执行 `test:smoke` 冒烟测试。

另有 `db-migration.yml`：当 `supabase/migrations/` 有变更推送至 `master` 分支时，自动执行 `supabase db push` 同步云端数据库。

---

## 📄 开源许可证

本项目采用 MIT License 开源许可。
