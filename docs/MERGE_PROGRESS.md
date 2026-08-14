# 融合工程进度中枢 — deal-protocol 单仓融合

> 本文件是 deal-protocol（根项目）与 oto-spatial-web（子项目）深度单仓融合工程的
> **唯一进度线索**：勘测结论、冲突裁决、阶段清单、执行记录全部在此登记。
> 前身为各方分散的 adr/、PROJECT_STATUS.md 勘测输入；本文件管「融合工程本身」。
> 状态：**勘测完成 · 人类裁决已全量签发（D-01~D-14 批准）· ADR-0018 落档 · 阶段三 Phase 1 执行完毕（D-01/D-02/D-04/D-06 落地）· 待 Phase 2（base/ammo 提升）**

---

## 0. 勘测范围与口径（2026-08-14）

- **纯只读勘测**：未修改/移动/删除任何现有代码、配置、迁移文件。
- 勘测输入：根项目 78 项条目 + 子项目全套 + ADR-0006（六层防御圈蓝图）+ ADR-0007（底座嫁接映射）+ DESIGN_CONSTITUTION 10 条文。
- **重要事实修正**：任务描述称「deal-protocol 现有 11 个 API」——实测根项目含 **95 个 API 路由**（`src/app/api/**/route.ts` glob 实测），子项目恰好 11 个。这一口径差异已作为 D-13 提交人类裁决（可能原指「核心业务 API」或「部署网关」等另一口径）。
- 子项目 5 屏单页（仅 1 个 page.tsx）、根项目 47 个页面；ADO 即 ADR §4 模板。

## 1. 融合总体架构设计草案

### 1.1 核心决策前提（引用既有契约，不重新发明）

1. **ADR-0006 Accepted**：融合顺序 = 先定稿蓝图 → 再融合 web/mobile 按圈切分底座 → 再功能层迭代；`src/base/` = 共享层（发射管），`src/ammo/` = 弹药属性表。
2. **ADR-0007 v2 执行手册**：C1-C5 契约已落地（orderCore 投影桥 + ammo 四表 + e2e 弹药验证 + mobile 归属登记）；本融合工程是 ADR-0007 的「总项目层面」继续。
3. **宪法收敛门禁**：任何 rename/抽层/契约修订 commit 必须写「宪法收敛：条文 #n」+ 登记 CONVERGENCE-LOG + `check:convergence` exit 0。
4. **20260814 push_subscriptions 迁移已在根项目**：说明根项目侧已为子项目 PWA 真推预留了 DB 通道（LAUNCH-GAP E 组）——可见融合是既定方向。

### 1.2 融合后目标目录树（草案 v1，待裁决）

```
deal-protocol/
├── package.json                  # 融合单一锁文件（or pnpm workspace，见 D-01）
├── tsconfig.json                 # 融合单一 tsconfig（@/ → src/，见 D-06）
├── next.config.ts                # 融合单一配置（Turbopack + serwist/sw 归一，见 D-03/D-07）
├── vitest.config.ts              # 融合单一测试配置（node:test 体系并入，见 D-05）
├── .env.example                  # 融合单一环境范本（合并键表，见 D-02）
├── docs/
│   ├── PROJECT_STATUS.md         # 保持单一真相源（子项目指针已指向 ../docs/）
│   ├── DESIGN_CONSTITUTION.md    # 不变
│   ├── MERGE_PROGRESS.md         # ← 本文件（融合工程中枢）
│   ├── adr/                      # ADR 编号续接 0018+
│   └── CONVERGENCE-LOG.md        # 登记融合期所有 rename
├── src/                          # ⚠ 融合主战场（根 + 子合并，见 D-08/D-09）
│   ├── app/                      # 页面路由（根 47 页 + 子 5 屏/1 入口，见 D-09）
│   │   ├── page.tsx              # 根入口（子入口如何共存 → D-09）
│   │   ├── layout.tsx            # 根布局（子布局元素并入 → D-10）
│   │   ├── (oto)/                # 【候选】子项目 5 屏路由组
│   │   │   ├── home/ ai/ ar/ trip/ profile/
│   │   │   └── layout.tsx        # 子布局（ToastHost/PwaServiceWorker/Geist）
│   │   └── api/                  # 融合 API（95 + 11 − 冲突 3，见 D-08）
│   │       ├── chat/             # ⚠ 同名冲突（根协议对话 vs 子 waves 对话）
│   │       ├── asr/tts/          # ⚠ 根 ai/asr 与子 asr 归一 → 单一语音链
│   │       └── gateway/          # LLM Gateway（子 ADR-0005，根 llm-* 收敛）
│   ├── base/                     # 九域共享层（从 oto-spatial-web/src/base 提升，ADR-0007 已定）
│   ├── ammo/                     # 弹药属性表（从子项目提升）
│   ├── lib/                      # 业务逻辑（根 68 文件 + 子 lib 9 文件，按圈归位）
│   ├── store/                    # zustand 状态机（子 7 store，根无 → 根按需迁入）
│   ├── components/               # UI（根 38 组件 + 子 8 目录；Badge 同名 → D-11）
│   ├── types/                    # database.types.ts（根已有一份，合并后 regenerate）
│   └── modules/                  # 根 26 模块（m02-m14 + mM*）与 base/ 的关系 → D-12
├── supabase/
│   └── migrations/               # ⚠ 序号体系归一（见 D-04）
│       ├── 001_schema.sql ... 018_enable_realtime.sql   # 根旧序号
│       ├── 20260718_*.sql ... 20260814_*.sql            # 根新序号
│       └── 2026xxxx_p2p_broadcast.sql                   # 子表迁入（新序号）
├── packages/
│   ├── credit-formula/           # 根既有本地包
│   └── payment-core/             # 根既有本地包
├── mobile/                       # RN 子应用（本次融合不并入，D-14 裁定）
├── e2e/                          # Playwright（根）— 子 12 个 mjs 脚本并入 → D-05
└── tests/                        # 根 vitest 体系 — 子 57 个 node:test 并入 → D-05
```

> 本草案为**第三稿演进目标**（渐进式融合），不是一步到位的终态。§3 分阶段清单按「先底座 → 再 API/布局 → 再页面/组件 → 再测试/环境」推进，每阶段可独立交付与复盘。

## 2. 【需人类决策的冲突清单】Conflict & Decision Matrix

### 2.1 D 类：决定性冲突（默认需要人类裁决）

| # | 冲突点 | 根项目现状（deal-protocol） | 子项目现状（oto-spatial-web） | 架构师专业建议 | 【人类裁决】 |
|---|--------|------------------------------|----------------------------------|----------------|--------------|
| D-01 | 包管理/锁文件 | 单一 `package.json` + `package-lock.json`（npm），no workspaces | 独立 `package.json` + 独立 `react=19.2.4/next=16.2.12` 固定版本 | **转 npm workspaces**（根 + oto-spatial-web + mobile + packages 四工作区），根 lock 归并。理由：ADR-0007 已确认 base/ 需被两端复用，workspaces 成本最低、零新工具链；pnpm 可后议 | ✅ **批准：npm workspaces 架构，根 package.json 统管工作区，统一锁文件** |
| D-02 | 环境变量键表 | 106 行 .env.example，键覆盖 Supabase/Deepseek/Gemini/阿里云/Stripe/Alipay/Wechat/Redis/SMS/Push/实名/PII/Cron/遥测 | 63 行 .env.example，键覆盖 Gateway 五 provider（GEMINI/ZHIPU/DASHSCOPE/GROQ/OPENROUTER）+ 语音 + VAPID + Supabase | ① 合并为单一 .env.example，根文件为唯一范本 ② `GEMINI_API_KEY` 两边键同名但**语义不同**（根走 @ai-sdk/google 官方 SDK gemini-1.5-flash；子走 OpenAI 兼容端点 gemini-2.5-flash）→ 预填一条注释解释两用 ③ 根 `AI_PROVIDER=deepseek` 体系与子 Gateway 五 provider 体系**是两套 LLM 路由**，不合并键、各用各的（见 D-03） | ✅ **批准：合并为单一根 .env.example；GEMINI_API_KEY 补双用注释；根 AI 变量与 Gateway 5 provider 变量分类并存** |
| D-03 | LLM 调用体系 | `src/lib/ai-provider.ts` + `src/lib/llm*.ts`：单链 AI_PROVIDER → deepseek → gemini → mock，@ai-sdk 官方 SDK | `src/base/ai/gateway/`：provider 表五行为例 + 任务路由 + 配额 + 429 冷却 + 降级链（ADR-0005 定稿） | **以子项目 Gateway 为准**收敛根侧 llm-*（宪法 #1 底座优先、ADR-0005 Accepted）——根侧 12 个 AI API 边界后移到 gateway，`AI_PROVIDER/DEEPSEEK_*` 保留为 gateway 可配置 provider 行之一 | ✅ **批准：以子项目 5-provider Gateway 为统一底座，根侧 AI 调度逐步收敛至 Gateway** |
| D-04 | DB 迁移序号体系 | 39 个迁移：**两套序号混用**（001-018 数字 + 20260718/24/25/30/0801/0814 日期戳）+ seed_categories.sql | 1 个迁移 `0001_p2p_broadcast.sql`（单表） | ① 合并后统一**日期戳序号** ② p2p_broadcast 以新日期戳文件名迁入（如 `20260814_p2p_broadcast.sql`），表级无冲突已核实（根 30 表 × 子 1 表零同名）③ **现有 001-018 不动**（已 apply 历史，改名会破坏 migration history） | ✅ **批准：统一日期戳规范；子 0001_p2p_broadcast.sql → 日期戳命名（20260814_01_p2p_broadcast.sql）迁入根 supabase/migrations/；根历史 001~018 保持不动** |
| D-05 | 测试体系 | vitest 3.1（globals:true, env:node, exclude 已排除 oto-spatial-web/**）+ tests/ 43 文件 + Playwright e2e 4 spec + `test:e2e` 脚本 | **node --experimental-strip-types --test**（57 文件，`test:units` 长清单）+ scripts/ 12 个 e2e-mjs（playwright-core 驱动）+ scripts/verify-prod.mjs | ① 单测：**渐进迁入 vitest**（vitest 兼容 node:test API，`--experimental-strip-types` 由 vitest 原生 TS 支持替代）；每期迁 X 个文件，`test:units` 同步扩为 vitest 命令 ② E2E：子 12 mjs 脚本保留原入口（不动 CI），最终归一到 Playwright config | ✅ **批准：单测渐进并入根 vitest；子 12 个 E2E 脚本完整保留，入口暂维持原样** |
| D-06 | tsconfig | target ES2022 / paths {`@/*`→`./src/*`} / exclude 已排除 oto-spatial-web + mobile + tests + scripts | target ES2017 / paths {`@/*`→`./src/*`} / exclude 仅 node_modules | 单一 tsconfig 以根为基线（ES2022），子代码兼容性风险低（ES2017 → ES2022 升版无破坏；`allowImportingTsExtensions` 子有而根无 → 需并标）；`otospatial` 前缀别名可选 | ✅ **批准：以根 ES2022 为基准，并入 allowImportingTsExtensions 及 @/base/* 路径映射** |
| D-07 | PWA / SW 双体系 | `@serwist/next` + `src/app/sw.ts` 生成 `public/sw.js`（服务端预渲染工作流）+ manifest.webmanifest | 手写 `public/sw.js` + `manifest.json`（本地 shell 5 屏兜底 + Notification API）+ PwaServiceWorker.tsx | **serwist 为准**（根是构建期 SW，跨构建自动护理、范围可配置），子手写 sw.js 逻辑迁移进 sw.ts；manifest 二选一（或 route group 独立 manifest）。⚠ 冲突实据：两边 public 下都有 sw.js，合并后文件同名覆盖 | ✅ **批准：以 @serwist/next（src/app/sw.ts）为准，子手写 sw.js 的通知/离线逻辑合入 sw.ts，彻底避免 public/sw.js 同名覆盖** |
| D-08 | API 路由冲突 | **95 个** route.ts（含 chat、ai/asr、ai/push-recommendations、sse、health、llm-*、cron/*、webhooks/* 等） | **11 个** route.ts（chat、cluster、decompose、diagnose、gateway、judge、asr、tts、voice-intent、push×2） | 直接同名冲突仅 1 个：**`/api/chat`**（根=协议对话调试，子=waves 撮合对话，语义完全不同）。语音链：根 `ai/asr` 与子 `asr` 归一到单一 `asr`。push：根 `ai/push-recommendations`（内容推荐）与子 `push/subscribe+send`（真推）**互补不冲突**。裁决后统一收敛命名 | ✅ **批准：① 子 waves 对话路由改名 /api/waves/chat（避免与根协议对话冲突） ② 语音链收敛为统一 /api/asr、/api/tts、/api/voice-intent ③ push 路由保持互补并存** |
| D-09 | 页面入口/路由合并 | 根 47 个页面（landing/dashboard/demands/orders/provider/console/admin*/finance/team/disputes/reviews…） | 子单 `page.tsx` = 5 屏 SPA（home/ai/ar/trip/profile 客户端路由，Zustand 驱动） | 三个候选：A) 子 5 屏并入根 route group `(oto)/`，入口从根 nav 跳转（推荐，最贴合单仓）B) 保留 `/oto` 前缀独立 zone C) 仍双应用部署。**建议 A**，`src/app` 内以 route group 分区，两套 layout 并存（根 layout 包 (oto) layout 亦可，见 D-10） | ✅ **批准候选 A：子 5 屏以 Next.js Route Group 归入 src/app/(oto)/，根 Layout 在 Header 中增加 (oto) 导航入口** |
| D-10 | layout/globals 冲突 | root layout：SessionProvider/Header/UXProvider/ThemeProvider + globals.css（shadcn 主题变量） | sub layout：PwaServiceWorker/ToastHost/Geist 字体 + globals.css（玻璃拟态视觉变量） | route group 嵌套 layout：根 layout 保留全局 Provider，`(oto)/layout.tsx` 放 ToastHost+PWA+字体变量；globals.css 用 **CSS 变量命名空间前缀**隔离（`--oto-*` vs 根变量）或 tailwind @layer 分区 | ✅ **批准：根 Layout 作为外层全局 Provider；(oto)/layout.tsx 独立承载 ToastHost/PWA 容器；子 CSS 变量 --oto-* 前缀或 Tailwind 隔离，严禁污染根全局主题** |
| D-11 | UI 组件库 | `components/ui/` 15 个 shadcn 风（badge/button/card/dialog/input/sheet/table…，components.json base-nova）+ lib/utils.ts | `components/ui/` 13 个玻璃风（GlassCard/GlassIconButton/FloatingDock/Badge/ToastHost/VoiceBar…） | 同目录同名 `badge.tsx`(根) vs `Badge.tsx`(子)——Windows 不区分大小写 → **直接覆盖冲突**。建议：子组件**不搬入**根 ui 目录，保留在各自组件域（根 emits 到 shared 只留 base/ 纯函数库），badge 二选一或改名 `OtoBadge` | ✅ **批准：子 Badge.tsx 改名 OtoBadge.tsx，其他子组件完整迁入 src/components/waves/ 及独立域，不直接平铺进根 components/ui/** |
| D-12 | 状态管理范式 | 根无 zustand（实测 grep `from 'zustand'` 0 命中）——用 event-bus + hooks + supabase realtime + ClientConsole 自管 | 子 7 个 zustand store，useWaveStore 36KB 核心状态机（waves/撮合/履约/钱包/争议单一大 store，persist/transport union 合并） | 不强行统一范式（宪法 #2 接口保守）：子 store 以 `@/store/` 原样迁入根 src（workspaces 内跨包 import），根业务不动；跨体系桥接按需用 adapter，禁止把根逻辑塞进 useWaveStore | ✅ **批准：子 7 个 Zustand Store 原样迁入 src/store/，不强行改造根项目逻辑** |
| D-13 | API 数量口径 | 95 个 route.ts（实测 glob） | 11 个（与 PROJECT_STATUS 一致） | 以 95 为准修任务书口径；如需「11 vs 11」对齐，可能指核心业务 API，需人类确认真实对比目标 | ✅ **批准：确认根项目实测 95 个 API 路由为事实基准** |
| D-14 | mobile 子应用与 packages | mobile/（Expo RN）+ packages/（credit-formula、payment-core） | — | ADR-0007 已做 mobile 归属登记（location→base/geo RN 候选 等）——本次深度融合**仅限 web 侧**，mobile 与 packages 保持独立位置不动（它俩已是共享底座消费者而非融合对象） | ✅ **批准：融合仅限 Web 侧，mobile/ 与 packages/ 保持独立不动** |

### 2.2 无需裁决（可直接执行）确认项

| # | 项 | 结论 |
|---|----|------|
| OK-1 | 表级迁移零冲突 | 根 30 表 × 子 1 表（p2p_broadcast）无同名，实时策略表结构不重叠 |
| OK-2 | Tailwind 版本一致 | 两边均为 v4 `@tailwindcss/postcss` CSS-first，无 config 文件冲突 |
| OK-3 | ESLint 配置同源 | 两边均为 eslint-config-next 16.2 core-web-vitals + typescript 平铺（仅 ignore 列表差 .opencode） |
| OK-4 | Supabase client 键名一致 | `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY` 两边同名同义 |
| OK-5 | 共享层已就位 | `src/base/` + `src/ammo/` 在子项目已按 ADR-0007 落位，根侧无同名目录，提升无冲突 |
| OK-6 | zustand 版本兼容 | 根 ^5.0.0 / 子 ^5.0.14，同 major 直接合并 |
| OK-7 | 根已预留融合通道 | `20260814_push_subscriptions.sql` 注释明确「LAUNCH-GAP E 组 PWA 真推」供子项目消费——DB 层融合通道已存在 |

## 3. 分阶段执行清单（Checklist）

> 阶段边界 = 每个阶段产出一个可运行、可验证的增量（宪法收敛门禁 + 单测全绿 + tsc/lint 0 错）。
> 每个 rename/抽层 commit 必须：commit message 标注「宪法收敛：条文 #n」→ CONVERGENCE-LOG 登记 → `npm run check:convergence` exit 0。

### Phase 0 — 裁决与冻结（✅ DONE 2026-08-14）
- [x] 人类对 D-01~D-14 全部裁决（全量批准，见 §2.1 矩阵【人类裁决】列）
- [x] 裁决落档：**ADR-0018**（`docs/adr/0018-monorepo-merge.md`，含六圈定位声明 + 宪法条文对照 + 14 项裁决全文）
- [x] 冻结基线：**HEAD `8a6b716`**（2026-08-14 勘测基线），单测 425 / lint / tsc / build 状态待阶段执行时复验

### Phase 1 — 包管理与环境归并（前置检查 ✅ DONE；执行项 ✅ DONE 2026-08-14 阶段三开工）
- [x] 前置检查：D-01/D-02/D-05/D-06 配置类裁决已签发并入 ADR-0018，执行前提全部就绪
- [x] npm workspaces 化（根 + oto-spatial-web + mobile + packages）：根 `package.json` 添加 `workspaces: ["oto-spatial-web", "mobile", "packages/*"]`；子项目核心运行时依赖（@react-three/*、@splinetool/*、three、maplibre-gl、canvas-confetti、jsqr、qrcode、pngjs、msedge-tts、web-push）并入根 dependencies；@types 族（three/canvas-confetti/qrcode/pngjs/web-push）、tailwindcss、eslint-config-next、playwright-core 并入根 devDependencies；serwist/tailwindcss/eslint-config-next 幽灵依赖补声明（sw.ts/globals.css/eslint.config 实际使用）；新增 `scripts/dev-all.mjs`（根 3000 + 子 3001 并行，子 e2e-mjs 硬编码 3000 不受影响）；npm install 刷新锁文件（added 857 / removed 1115 / audited 1308）
- [x] 单一 .env.example（按 D-02 合并键表）：38 根键全保留 + 子 20 键（5-provider Gateway + 语音 + VAPID）全并入；GEMINI_API_KEY 双用注释（@ai-sdk/google 官方 SDK vs OpenAI 兼容端点）；六分组结构（Core&Supabase / Gateway5 / 语音 / 支付通知 / PWA / 遥测调试）
- [x] 版本统一：@supabase/supabase-js ^2.49.0 → ^2.112.0（根）；@types/node 子 ^20 → ^22（根已 ^22）；next/react/framer-motion/lucide-react/zustand 以子高版本统一
- [x] scripts 归一命名：根 lint `next lint`→`eslint`（Next 16 已移除 next lint，实测报错）；新增 dev:all / dev:oto / build:oto / start:oto / test:units（vitest run 别名）；子项目 test:units（node --test 长清单）与 12 个 e2e-mjs 入口保留不动（D-05）
- [x] 验证：`npm install` 干净（workspaces 链接生效）+ 根/子双 `tsc --noEmit` 全绿 + 子项目代表性单测 8/8 pass（workspaces 化未破坏）
- ⚠ 存量问题登记（非本次引入，已实证）：根 vitest 11 failed（HEAD 基线 worktree 同依赖复测 11/11 一致；根因 = 测试与实现错位：global-mechanisms 测试 mock 设 `getSupabase` 而 sla-enforcer 调 `getServiceClient`；ai-negotiator 测试传 `userBudget/providerExpectedPrice` 而接口为 `currentBudget/proposedPrice` 致 NaN）→ 排期 Phase 5 修复；根 eslint 暴露 233 errors（180×no-explicit-any，原 `next lint` 失效从未真实跑过）→ 排期 Phase 5

### Phase 2 — base/ammo 提升（纯移动，无逻辑改动）（✅ DONE 2026-08-14）
- [x] `oto-spatial-web/src/base/` → 根 `src/base/`（git mv 保历史，136 rename 全覆盖：125 base + 11 ammo；宪法收敛条文 #1/#2）
- [x] `oto-spatial-web/src/ammo/` → 根 `src/ammo/`（同步）
- [x] 子项目内部 import 路径更新：子 tsconfig paths 加 `@/base/* → ../src/base/*`、`@/ammo/* → ../src/ammo/*`（须在 `@/*` 前）；根 tsconfig paths 加 `@/base/* → ./src/base/*`、`@/ammo/* → ./src/ammo/*`、`@/store/* → ./oto-spatial-web/src/store/*`（base 内 4 处 `@/store/` 跨包引用）；base 内 9 处 `@/` 自引用均为 type-only（node:test strip-types 剥离，运行时零解析）实测无害；destFilter.ts/.test.ts 越层引用 `../../lib/mockData` 单点断链 → 改 `../../../oto-spatial-web/src/lib/mockData`（子业务数据，零 import 纯数据文件）；子 `test:units` 清单 51 base + 4 ammo 路径前缀改 `../src/`；根 tsc exclude src/base+src/ammo（base 类型检查由子 tsc 经 paths 承担，规避 store→`@/lib` 双 src/lib 冲突链）；根 vitest config exclude src/base+src/ammo（防误收 node:test 风格文件）；根 eslint ignore 同源
- [x] mobile 归属登记复查:mobile 无 base/ammo 引用（独立态符合 ADR-0007 §4 与 D-14）
- [x] 验证：子项目全量单测 **425/425 全绿**（原命令跨目录调用）+ 根/子双 `tsc --noEmit` 0 错 + 收敛门禁 exit 0（登记后）

### Phase 3 — API 与 DB 归一
- [x] 迁移：`0001_p2p_broadcast.sql` → 日期戳新名迁入根 migrations（内容零改动）（✅ 已随阶段三提前执行：`20260814_01_p2p_broadcast.sql`，SHA256 98D798...74C6 与源一致）
- [ ] `/api/chat` 冲突收敛（按 D-08 裁决：改名或分 catch-all task 参数）
- [ ] 语音链归一（ai/asr + asr → 单 asr；tts/voice-intent 保留子入口）
- [ ] push 通道接线（根 ai/push-recommendations + 子 push/subscribe、send + push_subscriptions 表）
- [ ] 验证：全部 API route 按新名 GET/POST 实测 200（含 gateway 降级链）

### Phase 4 — 布局与页面融合
- [ ] route group `(oto)/` 落地（按 D-09 候选 A）
- [ ] 根 layout + (oto)/layout 嵌套关系与 Provider 归位（D-10）
- [ ] globals.css 变量命名空间隔离（-oto- 前缀）或 @layer 分区
- [ ] PWA 归一（sw.ts 吸收手写 sw.js 逻辑，manifest 单一，D-07）
- [ ] 根导航（Header/Dock）增加 5 屏入口
- [ ] 验证：5 屏 + 根 47 页全路由可访问 + 离线 5 屏兜底回归

### Phase 5 — 测试体系与存量收口
- [ ] vitest 迁移子 57 测试（分批，每批全绿）
- [ ] `test:units` 换为 vitest 清单；12 个 e2e mjs 入口保留直至 Playwright 归一
- [ ] LLM 双体系收敛验证（ai-provider → gateway，D-03）
- [ ] 清理声明的孤儿依赖（qrcode/jsqr/pngjs/@types 解析到单一版本）
- [ ] CI 更新：单测双栈 → vitest 单栈 + e2e 全链
- [ ] 最终验收：单测（原 425 + 子 57）+ tsc/lint 0 错 + build + 生产冒烟 + e2e 12 条全过

### Phase 6 — 宪法收敛与档案
- [ ] ADR 复盘全部融合 rename 登记 CONVERGENCE-LOG
- [ ] PROJECT_STATUS.md LAST_SYNC 更新（日期 + HEAD + 摘要）
- [ ] MERGE_PROGRESS.md 归档为融合终局记录

## 4. 勘测证据附录（2026-08-14 实测）

- 根依赖：next ^16.0.0 / react ^19.0.0 / lucide 1.23 / framer 12.42 / supabase-js ^2.49 / verdana… （全文见根 package.json）
- 子依赖：next 16.2.12 固定 / react 19.2.4 / lucide 1.28 / framer 12.43 / supabase-js ^2.112 / three 0.185 / maplibre 6.2 / web-push 3.6
- 根 API：95 route.ts（webhooks 3、auth 4、demands 10、orders 4、payment 5、admin 12、provider 6、finance 3、disputes 5、reviews 2、team 3、llm 3、cron 3、ai 4、其它 28）
- 子 API：11 route.ts（chat/cluster/decompose/diagnose/gateway/judge/asr/tts/voice-intent/push×2）
- 根页面：47 page.tsx；子页面：1 page.tsx（5 屏客户端路由）
- 根迁移：39 文件（001-018 + 日期戳 20260718~20260814 + seed_categories）；子迁移：1 文件（0001_p2p_broadcast）
- 根 lib：68 项（src/lib/）；子 base：12 域 100+ 文件；子 ammo：6 表 + 测试
- 根 store：无 zustand（0 命中）；子 store：7 个 zustand
- 测试：根 vitest + Playwright(4 spec) + tests/43；子 node:test(57) + e2e mjs×12 + scripts/17

## LAST_SYNC

| 日期 | HEAD | 摘要 |
|------|------|------|
| 2026-08-14 | `8a6b716`（勘测基线） | 创建本文件：5 维勘测完成（依赖/路由/基础设施/迁移/测试）· 冲突矩阵 D-01~D-14 + OK-1~OK-7 · 六阶段执行清单 · 等待人类裁决 |
| 2026-08-14 | `8a6b716` | **人类架构师全量裁决签发（14/14 批准）**：裁决回填 MERGE_PROGRESS.md §2.1 矩阵【人类裁决】列；ADR-0018（docs/adr/0018-monorepo-merge.md）落档（六圈定位声明 + 宪法条文对照 + 14 项裁决全文）；Phase 0 全部 DONE（裁决/ADR-0018/基线冻结），Phase 1 前置检查 DONE；准备进入阶段三（底座与配置融合） |
| 2026-08-14 | `8a6b716`（工作区） | **阶段三·Phase 1 执行全部 DONE**：① npm workspaces 四工作区（oto-spatial-web/mobile/packages/*）+ 子核心依赖并入根 + 幽灵依赖补声明（serwist/tailwindcss/eslint-config-next）+ `scripts/dev-all.mjs`（3000/3001 并行）+ npm install 刷新锁文件 ② 单一 `.env.example` 六分组（38 根键 + 20 子键全并入，GEMINI 双用注释）③ `0001_p2p_broadcast.sql` → `20260814_01_p2p_broadcast.sql` 迁入根（SHA256 与源一致）④ tsconfig 并入 `allowImportingTsExtensions` + `@oto/*` 别名 + 根 lint 修正为 eslint（Next 16 移除 next lint）；验证：root/sub tsc 0 错、sub 单测 8/8、convergence exit 0；⚠ 存量登记：根 vitest 11 failed + eslint 233 errors（均已实证为存量错配，排期 Phase 5） |
| 2026-08-14 | `6ede2fb` | **阶段三·Phase 2 base/ammo 提升 DONE**：① `git mv` 全量提升（136 rename = 125 base + 11 ammo，0 新增文件，纯移动）；② 路径重映射：子 tsconfig `@/base/*`/`@/ammo/*` → `../src/*`（在 `@/*` 前），根 tsconfig 同键 + `@/store/*` 跨包桥接；destFilter 单点断链（`../../lib/mockData` → 子项目业务数据）改跨包相对路径；子 `test:units` 51+4 路径前缀改 `../src/`；③ 防护性收敛：根 tsc exclude src/base+ammo（类型检查由子 tsc 经 paths 承担）、根 vitest exclude 防误收 node:test 文件、根 eslint ignore 同源；④ mobile 复查无引用（D-14 独立）；⑤ 验证：子全量单测 **425/425 全绿**、根/子双 tsc 0 错；收敛门禁 exit 0（CONVERGENCE-LOG 登记 6ede2fb 后复核通过） | |