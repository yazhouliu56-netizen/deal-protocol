# 项目状态档案 — oto-spatial-web（单一真相源）

> 管辖范围：`oto-spatial-web/`（deal-protocol 仓库子目录）。父项目 v3.0.0-PROD 基线见 `PROJECT_STATE.md`。
> **维护规则**（见 AGENTS.md）：凡代码改动影响功能/验证基线/阶段 → 同步更新本文件对应表格，并刷新底部 `LAST_SYNC`。
> **前身**：`NEXT_STEPS.md` 于 2026-08-07 并入本文件后废弃。

---

## 一、基线 / 技术栈

| 项 | 值 |
|---|---|
| 定位 | 空间化本地线下面基服务 PWA（AI 撮合对话 + 六维评分 + 双视角闭环 + AR + 全息玻璃 UI） |
| 栈 | Next.js 16.2.12 (App Router) · React 19.2.4 · TS strict · Tailwind v4 · Three 0.185 · R3F/drei · Zustand 5 · Framer Motion · Supabase |
| 活跃周期 | 2026-08-03 初始化（独立于父项目历史） |
| 主 LLM | Zhipu GLM-4.7-Flash（zhipu→gemini→mock 三层降级链） |
| 架构 | 5 屏(home/ai/ar/trip/profile) · 3 API(chat/cluster/decompose) · 核心状态机 `useWaveStore.ts`(36KB) · waves 组件 15 个 |

## 二、阶段定义

- **M1-M4**（oto-ai-platform-design）：需求→撮合→订单→AR 架构设计
- **P0-P5**（pwa-grand-refactor）：工程化/3D 栈/设计系统/地图/Supabase/PWA 深化
- **P1-P7**：waves 撮合经济闭环（广播/磋商/鸽子险/评价/治理/信任）
- **P8**：商业化（账号漫游 + PWA 真通知 + 公开竞价学 Airtasker 佣金）

## 三、达成状态

| 期 | 状态 | 附证 |
|----|------|------|
| M1-M4 架构 | ✅ 超额完成（已演进为 waves 经济） | oto-ai-platform-design.md |
| P0 工程化（Zustand/Framer） | ✅ | 08-03 |
| P1 3D 栈（R3F 组件化） | ✅ | |
| P2 UI 设计系统 | ✅ | |
| P3 真实地图（Mapbox） | ⏳ 设计稿（可选，缺 token） | |
| P4 Supabase 化 | ⚠️ 仅 `p2p_broadcast` 单表实时广播 | |
| P5 PWA 深化 | ⚠️ 部分 | |
| P1-P7 waves 撮合闭环 | ✅ `11f703e`（P2P 广播/磋商/鸽子险/评价/治理/信任，6 E2E 进 CI） | |
| 开放局/拼位 Open Match | ✅ `44aabe2`（拼位/满员成局/人均价，3 tab E2E） | |
| 跨 tab 广播竞态修复 | ✅ `51b2580`（union 写合并 + seed + portal） | |
| 信任闭环三缺口 | ✅（成团失败退款 / 24h 分级取消 / no-show 锁定） | ADR-0001 |
| 主 LLM 切 Zhipu | ✅ `7d73ef2` | |
| 发布费 + 每日免费配额 | ✅ `c5475c5` | |
| M3 验收/争议模块 | ✅ Slices 1-7 全落地，E2E 绿 | ADR-0002 / acceptance-module-tasks.md |
| Dev 进程守护 / 生产重启脚本 | ✅ `6de131a` / `af375da` | |
| 4 UI 死按钮接真实行为 | ✅ `ee4ea35` | |

## 四、验证基线

| 项 | 当前值 |
|----|--------|
| 单测 | **142/142 全绿**（21 套，`npm run test:units`） |
| Lint | ESLint exit 0 |
| TypeScript | tsc 全绿（根 + 子项目） |
| E2E 脚本 | 13 个就绪；**CI 挂 11 条**（match/app/wave/review/push/fulfil/governance/trust/openmatch/trustopen/acceptance） |
| 运行时错误 | 0（仅 THREE.Clock deprecation 噪音） |
| 生产服务器 | ✅ 运行中（pid 15900，端口 3000，HTTP 200，`restart-prod.mjs`） |

## 五、遗留缺口

1. ~~CI 少挂 2 条 E2E~~ ✅ 已修复：`e2e-trustopen`、`e2e-acceptance` 已挂入 CI（11 条）
2. ~~生产服务器未运行~~ ✅ 已启动：pid 15900，HTTP 200，重启脚本验证通过
3. 1 个本地未推 commit（AGENTS.md 精简）
4. P3 地图 / P5 PWA 深化 / Supabase 全量数据化 仍在设计稿

## 六、下一步（待办）

- [ ] P3 真实地图（Mapbox，可选）→ P5 PWA 深化 → Supabase 全量数据化
- [ ] **P8 商业化**：账号漫游（防多开风控）+ PWA 真通知（转介绍杠杆）+ 公开竞价（佣金）
- [ ] 社交层三件套：S1 匿名光点热力图 · S2 AI 主动诊断 · S3 关系沉淀（24h 归档/双向转好友/72h 静默撤回）
- [ ] 动态锚点 + 场景模板（家居→lounge.glb / 球局→半场网格 / 摄影→取景光场，MVP 5 个）
- [ ] 更远：灵感漩涡 / 响应方商业化 / 短信兜底 / 组局者订阅 / 拼位裂变

## 七、支付模型定稿（2026-08-05，已落地，历史参考）

- 三总纲：不设余额门槛，但**必须付单上金额才能上线**；钱包=留存工具（退款/补偿原路或入钱包）；**钱不到位动作不生效**（拼位即付才算占位）
- 场景服务型（1:1）：PaySheet 付全款→ 响应者锁单（暂不收质保金，见验收模块）→ 达标放款
- 场景组局型（开放局）：发起人付自己份 → 拼位者付自己份即可占位；MVP 只做 A（即时全款），B（定金+限时补）预建模不开放 UI
- 信任规则：发布费独立不清退（×3 免费）；退款车道=opt-in PayOrder

---

## LAST_SYNC

| 日期 | HEAD | 摘要 |
|------|------|------|
| 2026-08-07 | `2748a36` | 建立状态档案体系（PROJECT_STATUS.md 替代 NEXT_STEPS，AGENTS.md 挂 sync 规则），已推送 origin |
| 2026-08-07 | `6262c42` | CI 补挂 trustopen/acceptance（11 条 E2E）+ 生产服务器启动验证（pid 15900，HTTP 200） |