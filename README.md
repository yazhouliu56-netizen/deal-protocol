# 🤝 Deal Protocol (去中心化需求撮合与订单履约协议平台)

[![CI - TypeCheck & E2E Verification](https://github.com/yazhouliu56-netizen/deal-protocol/actions/workflows/ci.yml/badge.svg)](https://github.com/yazhouliu56-netizen/deal-protocol/actions/workflows/ci.yml)
![Node Version](https://img.shields.io/badge/Node.js-22%2B-brightgreen)
![Next.js](https://img.shields.io/badge/Next.js-14%2F15-black)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-green)
![License](https://img.shields.io/badge/License-MIT-blue)

**Deal Protocol** 是一个基于 **Next.js (App Router)** + **Supabase Realtime** + **React Native (Expo)** 构建的高可靠去中心化需求撮合、资金托管与订单履约协议平台。项目集成了全双工实时状态同步、严谨的状态机控制、仲裁举证链以及自动化 CI/CD 端到端（E2E）回归测试门禁。

---

## 📖 目录 (Table of Contents)

- [🚀 核心四大业务主线](#-核心四大业务主线)
- [⚡ Supabase Realtime 实时架构](#-supabase-realtime-实时架构)
- [📁 项目目录结构](#-项目目录结构)
- [🛠️ 本地开发环境配置](#️-本地开发环境配置)
- [🧪 自动化测试与 CI/CD 门禁](#-自动化测试与-cicd-门禁)
- [📄 开源许可证](#-开源许可证)

---

## 🚀 核心四大业务主线

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

## ⚡ Supabase Realtime 实时架构

为了在 Web 端与 Mobile 端实现毫秒级的状态无感更新，平台在 Supabase 数据库层为 **6 大核心表** 启用了 CDC (Change Data Capture) 实时发布：

| 核心表名 (Table) | 监听事件 (Events) | 业务应用场景 |
| :--- | :--- | :--- |
| `demands` | `INSERT`, `UPDATE` | 需求广场大盘新需求实时推送到看板、抢单/接单状态变更 |
| `orders` | `UPDATE` | 订单履约状态（如推进至 `submitted` / `completed`）全端同步 |
| `order_timeline_events` | `INSERT` | 履约时间轴节点新增、交付物提交实时提醒 |
| `dispute_cases` | `INSERT`, `UPDATE` | 维权案件创建、状态更新与裁决结果即时通知 |
| `financial_records` | `INSERT` | 资金托管锁定、退款、结算流水入账与余额实时刷新 |
| `messages` / `media` | `INSERT` | 履约过程即时沟通与仲裁举证对话框长连接消息 |

### 原生 WebSocket 支持 (Node.js 22+)
针对 Node.js 环境（如 CI 和后台 E2E 校验脚本），客户端进行了 WebSocket 传导优化：
* 指定 `realtime: { transport: globalThis.WebSocket }`，全面兼容 **Node 22** 原生 `WebSocket` 引擎，保障 CI 云端脚本无感知稳定连通。

---

## 📁 项目目录结构

```
deal-protocol/
├── src/                      # Web 端应用主目录 (Next.js App Router)
│   ├── app/                  # 业务路由 (需求广场、履约页、仲裁页、财务仪表盘)
│   ├── components/           # UI 视图组件与响应式布局
│   ├── hooks/                # Supabase Realtime 订阅自定义 Hooks
│   └── lib/                  # Supabase Client 初始化与状态机工具库
├── mobile/                   # 移动端子工程 (React Native / Expo) - TypeScript 隔离
├── scripts/                  # 自动化脚本目录
│   └── verify-e2e-flow.ts    # 四大主线全量 E2E 数据库实测回归脚本
├── tests/                    # 测试用例与集成测试文件
├── .github/workflows/        # GitHub Actions CI/CD 流水线配置
│   └── ci.yml                # 类型检查与 E2E 自动化回归流程
├── tsconfig.json             # 根 TypeScript 配置 (已排除 mobile/tests/scripts)
└── package.json              # 项目依赖与运行脚本
```

---

## 🛠️ 本地开发环境配置

### 1. 前置要求
* **Node.js**: `>= 22.0.0`（强烈建议，支持原生 WebSocket）
* **npm**: `>= 10.0.0`

### 2. 环境变量配置
在项目根目录下创建 `.env.local` 文件：

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-supabase-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### 3. 安装依赖与启动服务

```bash
# 1. 安装项目依赖
npm ci

# 2. 启动本地开发服务器
npm run dev
```

打开浏览器访问 http://localhost:3000 即可开始开发。

---

## 🧪 自动化测试与 CI/CD 门禁

项目建立了健全的本地与云端自动化质量校验体系。

### 本地测试命令

```bash
# 1. 执行全量 TypeScript 类型检查 (不含 mobile / scripts 子目录干扰)
npx tsc --noEmit

# 2. 执行四大主线 E2E 端到端真实数据库回归测试
npm run test:verify
```

### GitHub Actions CI/CD 流水线 (ci.yml)

每次向 `master` 分支推送代码或提交 PR 时，GitHub Actions 会自动触发以下校验流程：

1. **Node.js 22 环境构建**：启用原生 WebSocket 引擎。
2. **TypeScript 静态检查** (`npx tsc --noEmit`)：由于根目录 `tsconfig.json` 已排除 `mobile/`、`tests/` 与 `scripts/`，能够干净无误地进行 Web 源码类型校验。
3. **E2E 流程自动化回归**：根据环境变量门禁 (`if: env.SUPABASE_SERVICE_ROLE_KEY != ''`) 灵活判断，在配置了 GitHub Secrets 的情况下执行四大主线全量数据库测试，未配置时自动跳过（软告警），保障构建不被误打断。

---

## 📄 开源许可证

本项目采用 MIT License 开源许可。
