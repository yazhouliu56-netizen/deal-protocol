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
| P3 真实地图 | ⏳ 待办（先数据化 lat/lng → Leaflet+OSM 免费接入，见「六」） | |
| P4 Supabase 化 | ⚠️ 仅 `p2p_broadcast` 单表实时广播 | |
| P5 PWA 深化 | ✅ 已实测验证：`deviceMemory=2` 降级生效（DPR 锁 1/粒子减半）+ 离线全流程 5 屏可浏览 + lounge.glb 预缓存命中 |
| P1-P7 waves 撮合闭环 | ✅ `11f703e`（P2P 广播/磋商/鸽子险/评价/治理/信任，6 E2E 进 CI） | |
| 开放局/拼位 Open Match | ✅ `44aabe2`（拼位/满员成局/人均价，3 tab E2E） | |
| 跨 tab 广播竞态修复 | ✅ `51b2580`（union 写合并 + seed + portal） | |
| 信任闭环三缺口 | ✅（成团失败退款 / 24h 分级取消 / no-show 锁定） | ADR-0001 |
| 主 LLM 切 Zhipu | ✅ `7d73ef2` | |
| 发布费 + 每日免费配额 | ✅ `c5475c5` | |
| M3 验收/争议模块 | ✅ Slices 1-7 全落地，E2E 绿 | ADR-0002 / acceptance-module-tasks.md |
| Dev 进程守护 / 生产重启脚本 | ✅ `6de131a` / `af375da` | |
| 4 UI 死按钮接真实行为 | ✅ `ee4ea35` | |
| P3 数据化前置（lat/lng 建模） | ✅ `src/lib/geo.ts`（Haversine/附近排序/确定性兜底坐标）+ Wave 接口 `geo` 字段 + 5 单测 | |
| S1 匿名光点热力图 | ✅ `SpatialHeatMap.tsx`（活跃 waves 投影 CSS 网格地图，热度光点匿名聚合，浏览器实测 3 信号波渲染）+ 挂载 radar feed | |
| 场景模板 ×4 | ✅ `sceneTemplate.ts` 映射 + `SceneTemplate.tsx` 程序化舞台（球局→半场网格/约拍→取景光场/城市历史→室内起居，lounge.glb 保留）+ 浏览器实测 | |
| S2 AI 主动诊断 | ✅ 发布后无人响应 ≥2min 诊断卡（`diagnostic.ts` 纯函数 + `/api/diagnose` 复用 cluster 三级降级，Zhipu 实测生效）+ `DiagnosisCard.tsx` 挂载 MyWaves，浏览器实测 | |
| S3 关系沉淀（转友） | ✅ 72h 自动撤回转友状态机（`friends.ts` 纯函数）+ `FriendKit`/`FriendList` 挂载 ProfilePage/MyWaves/履约区，双 tab 实测：发布→接单→履约→72h 评价窗→转友→接受 | |
| 拼位裂变 ShareKit | ✅ 分享文案复制 + 伪二维码 + `fissionIncrement` 防自刷计数（回应/成交才 +1，按人去重）+ 分享链接 `?wave=` 直达置顶 | |

## 四、验证基线

| 项 | 当前值 |
|----|--------|
| 单测 | **175/175 全绿**（27 套，`npm run test:units`，含 geo/sceneTemplate/fission/diagnostic/friends/p2p-transport） |
| Lint | ESLint exit 0 |
| TypeScript | tsc 全绿（根 + 子项目） |
| E2E 脚本 | 13 个就绪；**CI 挂 11 条**（match/app/wave/review/push/fulfil/governance/trust/openmatch/trustopen/acceptance） |
| 运行时错误 | 0（仅 THREE.Clock deprecation 噪音） |
| 生产服务器 | ✅ 运行中（pid 8084，端口 3000，HTTP 200，`restart-prod.mjs`） |

## 五、遗留缺口

1. ~~CI 少挂 2 条 E2E~~ ✅ 已修复：`e2e-trustopen`、`e2e-acceptance` 已挂入 CI（11 条）
2. ~~生产服务器未运行~~ ✅ 已启动：pid 8084，HTTP 200，重启脚本验证通过
3. 本地未推 commit（本次 4 项功能惯改，待 push）
4. P3 地图 仍在设计稿（数据化前置已落地 ✅，接 Leaflet+OSM 是关键下步；Supabase 全量数据化仍设计稿）

## 六、下一步（待办）

- [ ] **P3 真实地图**（**Leaflet + OSM 免费方案**，数据化前置已完成：lat/lng 建模 + 附近排序就绪，可绘真数据）
- [x] S1 匿名光点热力图 ✅（本批完成）
- [x] **S2 AI 主动诊断** · **S3 关系沉淀** ✅（本批完成，社交层闭环）
- [x] 场景模板 ×4 ✅（本批完成）
- [ ] **Supabase 全量数据化**（在线真实数据 + 离线 mock 兜底，接口形态不变）
- [x] 拼位裂变 ✅（本批完成：分享 + 防自刷计数 + 二维码）
- [ ] **P8 商业化**：账号漫游（防多开风控）+ PWA 真通知（转介绍杠杆）+ 公开竞价（佣金）
- [ ] 更远：灵感漩涡 / 响应方商业化 / 短信兜底 / 组局者订阅

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
| 2026-08-07 | `1f118be` | CI 补挂 trustopen/acceptance（11 条 E2E）+ 生产服务器启动验证（pid 15900，HTTP 200） |
| 2026-08-07 | `bdfda92` | 调整 P3 路线：数据化先行（lat/lng + 真实成交）→ Leaflet+OSM 免费接图，保留 CSS 降级 |
| 2026-08-07 | `ae10c5d` | P5 实测验证通过：deviceMemory 沉浸降级 + 离线全流程 5 屏 + lounge.glb 预缓存命中 → P5 标 ✅ |
| 2026-08-07 | `356d794` | 本地批次四件套：P3 数据化前置(geo.ts) + S1 匿名热力图 + 场景模板 ×4 + 拼位裂变 ShareKit（防自刷计数）→ 单测 153 绿，浏览器实测通过 |
| 2026-08-08 | （本批未推送） | S2 AI 主动诊断（无人响应 ≥2min 实时建议，Zhipu 真降级实测）+ S3 关系沉淀（72h 自动撤回转友状态机，双 tab 全链路实测）+ 修复两缺陷：DiagnosisCard 建议列表 key 兜底、friendRequests union 合并墓碑化（删除跨 tab 落盘）→ 单测 175 绿 |