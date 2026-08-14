# ADR-0018: deal-protocol 单仓融合工程总况（14 项裁决依从契约）
日期：2026-08-14
状态：Accepted（人类架构师全量裁决，融合执行期间本 ADR 为最高依从依据）

> **宪法声明（强制字段）**：本 ADR 派生自 `docs/DESIGN_CONSTITUTION.md`（条文 #1 底座优先、
> #2 接口保守、#3 先配表后写码），并承接 ADR-0006（六层防御圈蓝图）、ADR-0007（底座嫁接
> 映射 C1-C5）——本文即融合工程的「执行宪法」。

## 六圈定位声明
- 所属圈：**跨全部六圈（工程层）**——融合工程不是单一模块，而是把各圈共享底座
  （`src/base/` 九域 + `src/ammo/` 弹药表）从子项目提升为根级唯一共享层的载体工程。
- 所属模块：工程治理模块（ADR-0006 §一 六大防御圈的全部 22 模块的承载底座）。
- 复用底座：`base/` 全部域（ai/comm/dispatch/form/geo/money/notify/order/platform/risk/safe/trust）
  + `ammo/` 弹药表——融合后全部提升至根 `src/`，表现为单一供应链。
- 弹药表：融合期间**零弹药表改动**（ammo 表内容与 schema 本次不动，仅物理提升目录）。

## 宪法条文对照
- 命中条文：
  - #1 底座优先：本次融合把子项目 base/ 提升为根级共享层 = 底座唯一化，一锤定音；
  - #2 接口保守：API 路由收敛（chat 改名 waves/chat 等）保留向后兼容语义，
    /api/chat 根协议对话无改动；
  - #3 先配表后写码：ammo 表零 schema 变更，业务规则仍走弹药表。
- 偏离条文：无（14 项裁决全部符合宪法条文，无冲突上报）。
- 宪法收敛：本变更顺带收敛的遗留点——① 根/子两套 .env.example 合并为单一范本
  （消除 GEMINI_API_KEY 同名双义配置）；② 根/子两套测试体系（vitest vs node:test）
  统一归口方案落定；③ 根/子双 public/sw.js 同名冲突预防（D-07）。

## Context

deal-protocol 根项目（95 API / 47 页 / 39 迁移 / vitest / npm 单包）与子项目
oto-spatial-web（11 API / 5 屏 SPA / 1 迁移 / node:test / 独立包）长期以「子目录 + 独立
package.json」共居一仓。ADR-0006/0007 已定稿底座蓝图与嫁接映射，但未定义：包管理拓扑、
API 路由冲突、布局体系、测试体系、迁移序号等总项目层面契约。2026-08-14 完成五维只读勘测，
产出 `docs/MERGE_PROGRESS.md` 冲突矩阵（D-01~D-14 + OK-1~OK-7）。人类架构师 2026-08-14
就 14 项冲突签发全量裁决（见 Decision），本项目据此固化执行契约。

## Decision

人类架构师 14 项裁决（全文依从，回填至 `docs/MERGE_PROGRESS.md` §2.1）：

| # | 裁决 |
|---|------|
| D-01 | **npm workspaces 架构**，根 package.json 统管工作区，统一锁文件 |
| D-02 | 合并为单一根 .env.example；GEMINI_API_KEY 补双用注释；根 AI 变量与 Gateway 5 provider 变量分类并存 |
| D-03 | 以子项目 5-provider **Gateway 为统一 LLM 底座**，根侧 AI 调度逐步收敛至 Gateway |
| D-04 | 迁移统一日期戳规范；`0001_p2p_broadcast.sql` → 日期戳命名（`20260814_01_p2p_broadcast.sql`）迁入根 migrations；根 001~018 历史不动 |
| D-05 | 单测渐进并入根 **vitest**；子 12 个 E2E 脚本完整保留、入口暂维持原样 |
| D-06 | tsconfig 以根 ES2022 为基准，并入 `allowImportingTsExtensions` 及 `@/base/*` 路径映射 |
| D-07 | 以 **@serwist/next（src/app/sw.ts）为准**；子手写 sw.js 通知/离线逻辑合入 sw.ts，杜绝 public/sw.js 同名覆盖 |
| D-08 | 子 waves 对话路由改名 **/api/waves/chat**（避根协议对话冲突）；语音链统一 /api/asr、/api/tts、/api/voice-intent；push 路由互补并存 |
| D-09 | 候选 A：子 5 屏以 **Route Group `src/app/(oto)/`** 归入；根 Layout Header 增加 (oto) 导航入口 |
| D-10 | 根 Layout 为外层全局 Provider；`(oto)/layout.tsx` 独立承载 ToastHost/PWA 容器；子 CSS 变量 **--oto-* 前缀隔离**，禁污染根全局主题 |
| D-11 | 子 `Badge.tsx` **改名 OtoBadge.tsx**；其余子组件完整迁入 `src/components/waves/` 及独立域，不平铺进根 components/ui/ |
| D-12 | 子 7 个 Zustand Store 原样迁入 `src/store/`，不改造根逻辑 |
| D-13 | 确认根项目**实测 95 个 API 路由**为事实基准 |
| D-14 | 融合仅限 Web 侧；`mobile/` 与 `packages/` 保持独立不动 |

## Alternatives Rejected

- **pnpm workspace**（D-01 备选）：npm workspaces 已满足四工作区需求，零新工具链；pnpm
  可后议，不在本次融合引入新包管理器。
- **双应用独立部署保留**（D-09 候选 B/C）：与「单仓单源」目标冲突，且子项目本就是在
  根 repo 内初始化（PROJECT_STATUS 原文），候选 A 与历史事实最吻合。
- **保留双测试体系长期并存**（D-05 反向）：node:test strip-types 是子项目临时方案，
  长期双体系增加 CI 与维护成本；渐进并入 vitest 可无损迁移（vitest 兼容 node:test API）。
- **子 UI 组件平铺进根 components/ui/**（D-11 反向）：Windows 文件系统大小写不敏感，
  `badge.tsx` vs `Badge.tsx` 直接覆盖冲突；且两套视觉体系（shadcn vs 玻璃风）应物理隔离。

## Consequences

- `docs/MERGE_PROGRESS.md` §2.1 矩阵【人类裁决】列回填本 14 项（2026-08-14 完成）。
- 融合执行分六个阶段（Phase 0-6，见 MERGE_PROGRESS.md §3），每阶段门禁：
  单测全绿 + tsc/lint 0 错 + `npm run check:convergence` exit 0 + 宪法收敛标注。
- 阶段三（底座与配置融合）起执行 Phase 1（workspaces/环境归并）→ Phase 2（base/ammo 提升），
  全部 rename 须登记 CONVERGENCE-LOG。
- 子项目 11 API 中 chat 改名 waves/chat 后，PROJECT_STATUS 的「11 API」口径随迁移更新。
- `mobile/`、`packages/` 本次保持独立；其与 base 的既有消费关系（ADR-0007 §4 归属登记）不变。