# OTO Spatial Web

空间化本地线下面基服务 PWA：AI 撮合对话 + 六维评分 + 双视角闭环 + AR 场景 + 全息玻璃 UI。

架构事实基线：`docs/PROJECT_STATUS.md`（仓库根 docs/，单一真相源）。设计原则见 `docs/DESIGN_CONSTITUTION.md`。

## 快速开始

```bash
npm install
npm run dev          # 开发（http://localhost:3000，run-dev.mjs 带进程守护）
npm run build        # 生产构建（Turbopack）
npm run start        # 生产运行
npm run restart:prod # 一键重启生产（taskkill /T 杀进程树 + 就绪轮询）
npm run verify-prod  # 上线演练（build → 生产 start → 全量 12 条 E2E）
```

## 架构总览

- **底座共享层** `src/base/`：九域（money/trust/order/dispatch/risk/geo/notify/platform/ai）纯函数引擎，业务无关、可 `node --experimental-strip-types` 直跑（ADR-0006/0007 落地物）。
- **弹药属性表** `src/ammo/`：pricing-formula / dispatch-rule / risk-rule / sop / scene-template / prefs 四表 + 扩展——新业务先配表，禁写死业务字段进 base（宪法 #3/#4）。
- **5 屏**：home / ai / ar / trip / profile（单页 + tabs 实现）。
- **11 个 API 路由**：`chat` / `cluster` / `decompose` / `diagnose` / `gateway` / `judge` / `asr` / `tts` / `voice-intent` / `push/subscribe` / `push/send`。

## 对话引擎与 LLM Gateway（ADR-0005）

- **五 provider 表单一来源**：`src/base/ai/gateway/providers.ts`——gemini / zhipu / qwen / groq / openrouter 五行，补 key 即扩容：
  - `chat` 路由首选 **gemini**；`voice-intent` / `cluster` / `decompose` / `diagnose` 首选 **zhipu**（JSON 结构化稳定，hybrid thinking 禁用）；`judge` 首选 gemini。
  - 每 provider 独立配额（最小间隔串行 / 429 冷却 / 健康分）。
- **三级降级链**：provider 间按任务排序降级（429 / 5xx 换下一家）→ 全链无 key 或全失败 → **MockEngine 本地确定性引擎**（`src/base/ai/chat/mockEngine.ts`），零外部依赖兜底。
- 架构：LLM 只负责意图抽取 / 追问 / 文案 / 结构化 JSON（严格指令协议见 `src/base/ai/chat/llmDirective.ts`）；时段卡、六维撮合评分、确认单全部走本地确定性代码（`src/base/dispatch/match.ts`）。key 只在服务端 API 代理中使用，客户端零泄漏。
- 语音链路：`/api/asr`（GLM-ASR → Web Speech 降级）、`/api/tts`（GLM-TTS → edge-tts → speechSynthesis 三级），无 `ZHIPU_API_KEY` 时返回 503 由前端降级。

## 环境变量

完整清单与分组见 `.env.example`（本项目不提交 `.env.local`，按需从 `.env.example` 复制）。要点：

| 分组 | 变量 | 必填 | 缺失后果 |
|---|---|---|---|
| LLM | `GEMINI_API_KEY` / `ZHIPU_API_KEY` / `DASHSCOPE_API_KEY` / `GROQ_API_KEY` / `OPENROUTER_API_KEY` | 否 | 对应 provider 跳过；全缺 → 所有 LLM 任务落 MockEngine 降级 |
| 语音 | `ZHIPU_API_KEY` + `ZHIPU_ASR_MODEL` | 否 | `/api/asr`、`/api/tts` 返回 503，前端降级 |
| 引擎选择 | `NEXT_PUBLIC_LLM_PROVIDER`（`gemini` / `zhipu`） | 否 | ChatPage 默认 MockEngine |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 否 | p2p 跨设备广播自动降级为 local（同设备多 tab 仍可用） |
| PWA 推送 | `SUPABASE_SERVICE_ROLE_KEY` + `VAPID_*` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 否 | 推送订阅/发送 API 不可用（表未建时 501 降级） |
| 脚本 | `DEV_GUARD_TIMEOUT_MS`、`PLAYWRIGHT_CHANNEL` | 否 | 使用默认值 |

> 注意：Next.js 不读取仓库根 `deal-protocol/.env.local`——**服务端密钥必须放在本目录 `oto-spatial-web/.env.local`**（`.gitignore` 保护）。

## PWA 真推送配置指南（web-push，LAUNCH-GAP E 组 2/3）

1. **生成 VAPID 密钥对**（幂等，已存在则跳过）：

   ```bash
   npm run dev   # 首次启动自动执行 scripts/generate-vapid.mjs
   node scripts/generate-vapid.mjs   # 或手动：写入 .env.local 的 VAPID_* 四键
   ```

2. **建表**：在 Supabase SQL Editor 执行 `../supabase/migrations/20260814_push_subscriptions.sql`
   （`push_subscriptions` 表：endpoint UNIQUE + RLS + service_role 授权 + delete RPC）。
   **表未建时订阅 API 返回 `501 push-table-not-configured`，前端 PushEnableBar 有分态提示，属预期降级。**

3. **配置 env**（`oto-spatial-web/.env.local`）：

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
   VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   VAPID_SUBJECT=mailto:admin@oto.app
   ```

4. **生效路径**：ProfilePage「通知推送」→ PushEnableBar 授权 → `pushManager.subscribe` → `/api/push/subscribe` 幂等 upsert → 「发送测试」走 `/api/push/send`（web-push 签名，410/404 自动清理失效订阅）。sw.js 已注入 push 渲染 / notificationclick 聚焦 / pushsubscriptionchange 重订阅三事件。

## 测试

```bash
npm run test:units   # 纯函数单测（425 条：撮合/订单/信任/风控/弹药/网关…，60+ 文件清单见 package.json）
npm run test:e2e     # E2E 套件入口（共 12 条独立脚本 scripts/e2e-*.mjs）
```

- 12 条 E2E：`app` `match` `wave` `openmatch` `review` `push` `fulfil` `governance` `trust` `trust-open` `acceptance`（11 条挂 CI）+ `offline`（生产 SW 离线兜底，本地跑）。
- `test:e2e*` 需先 `npm run start`（或 `npm run verify-prod` 一键编排）。
- 配置了 LLM key 时 E2E 走真 LLM（追问语料放宽）；CI 无 key 自动走 Mock（确定性）。
- 验收口径：单测全绿 + 浏览器实测一句证据 → 记入 `docs/PROJECT_STATUS.md` LAST_SYNC。

### CI

`.github/workflows/ci.yml`：Node 24 —— job1：lint + test:units + build；job2：build + 生产 start + 11 条 E2E（`PLAYWRIGHT_CHANNEL=chromium`，无 key 走 Mock）。

## 撮合算法（六维 100 分制）

`src/base/dispatch/match.ts`：budget 25 / level 20 / style 20 / rating 15 / distance 10 / availability 10；同分按 rating→distance 决胜；4 人以上组局场地获 groupBonus。权重与硬门槛可由 `src/ammo/dispatch-rule.ts` 按品类覆盖（表驱动，宪法 #3/#4）。`src/base/ai/chat/slots.ts` 动态生成本周六/日时段。