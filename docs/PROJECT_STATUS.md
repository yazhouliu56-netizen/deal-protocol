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
| 真机扫码（本地闭环） | ✅ `ScanMockSheet` 接 getUserMedia 环境后置摄像头 + jsQR 逐帧解码 ShareKit 链接 → 局详情 + 加入拼位直达；无摄像头/无权限自动降级回模拟扫码（演示可用）；`scan.ts` parseWaveUrl 纯函数 +7 单测 | |
| 撮合偏好可编辑 | ✅ `prefs.ts` 四维选项池（半径/预算/水平/时间）纯函数 +7 单测 + usePrefStore persist，ProfilePage 标签点击循环切换 + 重置 | |
| 分享真二维码 | ✅ ShareKit 伪码 → `qrcode` canvas 生成真二维码（离线本地画，无网络请求）；`qr.test.ts` 闭环单测 qrcode→pngjs→jsQR 还原分享链接（+4 单测，含中文/转义域名） | |
| 本地系统通知 | ✅ `systemNotify.ts` 纯 diff（成局/新报价/拼位占座/正式接单/好友申请 五类事件，+8 单测）+ 浏览器 Notification API 窗口安全封装；NotificationCenter 跨帧 diff → 弹系统通知 + 面板授权按钮 | |
| 本地上传头像 | ✅ `IdentityAvatar`（有头像显示图片 / 无则 emoji 兜底）+ `lib/avatar.ts` FileReader→canvas 居中裁切压缩 96×96 JPEG，Identity.avatar persist，三处展示（首页/雷达头/个人中心）同步 | |

## 四、验证基线

| 项 | 当前值 |
|----|--------|
| 单测 | **257/257 全绿**（32 套，`npm run test:units`，含 geo/sceneTemplate/fission/diagnostic/friends/p2p-transport/scan/prefs/qr/systemNotify） |
| Lint | ESLint exit 0（0 errors；存量 warning 在 scripts/ 非组件） |
| TypeScript | tsc 全绿（根 + 子项目） |
| E2E 脚本 | 13 个就绪；**CI 挂 11 条**（match/app/wave/review/push/fulfil/governance/trust/openmatch/trustopen/acceptance） |
| 运行时错误 | 0（仅 THREE.Clock deprecation 噪音） |
| 生产服务器 | ✅ 运行中（pid 8084，端口 3000，HTTP 200，`restart-prod.mjs`） |

## 五、遗留缺口

1. ~~CI 少挂 2 条 E2E~~ ✅ 已修复：`e2e-trustopen`、`e2e-acceptance` 已挂入 CI（11 条）
2. ~~生产服务器未运行~~ ✅ 已启动：pid 8084，HTTP 200，重启脚本验证通过
3. ~~本地未推 commit~~（本次批次已推 `f11e8cb` 起多笔，见 LAST_SYNC）
4. ~~P3 地图仍在设计稿~~ ✅ 已落地（MapLibre + OpenFreeMap，`f11e8cb` 起）

## 六、下一步（待办）

- [x] **P3 真实地图** ✅（本批完成 ADR-0004：**MapLibre GL JS + OpenFreeMap** 免费矢量瓦片（liberty 含 3D 建筑）+ 3D 透视（pitch 25°）+ 活动 wave 光点 + 点击 FlyTo；游戏化层后置留口；低配/无 WebGL 自动降级回 CSS 网格；瓦片源单点可切）
- [x] S1 匿名光点热力图 ✅（本批完成）
- [x] **S2 AI 主动诊断** · **S3 关系沉淀** ✅（本批完成，社交层闭环）
- [x] 场景模板 ×4 ✅（本批完成）
- [x] **Supabase 全量数据化**（在线真实数据 + 离线 mock 兜底，接口形态不变）→ 前置项「真机扫码」已提前本地闭环（见三），余项仍待数据化
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
| 2026-08-08 | `1cb0408` | S2 AI 主动诊断（无人响应 ≥2min 实时建议，Zhipu 真降级实测）+ S3 关系沉淀（72h 自动撤回转友状态机，双 tab 全链路实测）+ 修复两缺陷：DiagnosisCard 建议列表 key 兜底、friendRequests union 合并墓碑化（删除跨 tab 落盘）→ 单测 175 绿 |
| 2026-08-09 | `11d141d` | ADR-0004 落档：P3 地图选型定为 MapLibre GL JS + OpenFreeMap（免费无 Key，初期 3D 透视层次 + 点渲染，游戏化后置留口，瓦片源可切换） |
| 2026-08-09 | `f11e8cb` | P3 地图首批落地：MapView（MapLibre+OpenFreeMap 动态引入、pitch 25°、建筑立体、wave 光点、点击 FlyTo）+ mapConfig 纯函数层（tier/点数据）+ 低配降级 → 单测 181 绿（+6），tsc/lint 全绿，浏览器实测瓦片加载、3D 面板渲染 |
| 2026-08-09 | `9b993cb` | fix: tier 探针改用 useSyncExternalStore（server 快照=false）消除 SSR/客户端不一致 hydration 错误；mapConfig.test 纳入 test:units → 单测 181 绿，浏览器 CSS 降级 + 3D 双分支实测无报错 |
| 2026-08-09 | `068a4cb` | 纯本地批次①（地图观感）：地图 3D/CSS 手动切换（mapPref localStorage 持久，SSR 安全 useSyncExternalStore）+ 冷启动氛围 POI 密度层（3D 灰点 source + CSS 18 点）→ 单测 184 绿，浏览器实测循环切换/持久/无错 |
| 2026-08-09 | `8d9a401` | 纯本地批次②（商业化前哨）：组局者订阅状态机（organizerSubscription 纯函数 + zustand persist + 两段式模拟收银台 OrganizerBoostCard）→ 单测 189 绿（+5），浏览器实测开通→生效→刷新持久、无 hydration 报错 |
| 2026-08-09 | `e3400df` | 纯本地批次③（商业化前哨）：公开竞价沙盒（bidding 纯函数状态机：保留价/覆盖出价/低价排序/8% 佣金结算包 + BiddingSandboxCard 演示完整闭环）→ 单测 199 绿（+10），浏览器实测出价¥61→中标→佣金¥4.88→净得¥56.12 |
| 2026-08-09 | `6871005` | 纯本地批次④（商业化前哨）：账号漫游 + 多开风控（roamGuard 设备指纹矩阵纯函数：1 安全 / 2 家庭共机关注 / ≥3 冻结建议 + useRoamStore persist + SafetyKit 内 RoamGuardPanel 演示）→ 单测 207 绿（+8），浏览器实测多开升级/漫游回落/刷新持久、无报错 |
| 2026-08-09 | `dc22594` | 收尾①雷达局收藏：favorites 心形 + FavoritesSheet「我关注的局」面板（store persist + p2p transport 对齐）→ 单测 207 保持绿，浏览器实测收藏/计数/面板/移除 |
| 2026-08-09 | `05ec324` | 收尾②扫码识别：ScanMockSheet（模拟相机横线扫描 → 识别分享的开放局 → 加入拼位直达 /?wave&via=scan）挂接 SearchBar onScan → tsc/lint 绿，浏览器实测扫→识别→加入拼位 |
| 2026-08-09 | `d1ce09b` + 本档 | 收尾③模拟上线：e2e-offline（生产 SW shell 五屏兜底 + 恢复在线）实测 PASS；verify-prod 编排（build → 生产 start → 12 条 E2E，一键演练）；上线前缺口清单落档 `docs/LAUNCH-GAP.md`（G 本地可做 4 / D 依赖数据化 5 / E 外部 4）⇒ 本地侧已全部闭环 |
| 2026-08-09 | `cbfdd36` | G-1/G-2 目的地中心：筛选抽屉（价位档 / 仅 AR / 评分 / 价格↑↓ / 离我最近）+ 全部列表；HoloCard 卡片抽为共享组件；destFilter 纯函数层 → 单测 217 绿（+10），浏览器实测档位过滤与升降序 |
| 2026-08-09 | `254a9fd` | G-3 通知中心：铃铛 + 未读角标 + 聚合动态（报价/正式接单/雷达推送/好友/举报回执），已读本地持久化（notify 纯函数 8 单测）→ 单测 225 全绿，浏览器实测开合/空态 |
| 2026-08-09 | `b08f406` + 本档 | G-4 数据源徽章 + PWA 安装引导（本地沙盒/离线双态 + beforeinstallprompt 一键安装实测可用）→ LAUNCH-GAP G 组 4 项全部清零；本地无占位缺口，D 组（数据化）待命 |
| 2026-08-09 | `f3c1dc5` + 本档 | G-5 × 商业化真实化：竞价卡接入「我发出的真实开放局」（保留价=局预算、种子报价跟随、真实需求局徽章）；组局加速订阅 → 雷达优先曝光实时横幅；我的屏访客引导（本地模式说明 + 数据模式弹层 + 回雷达）→ 浏览器实测保留价¥100 报价 100/108/115；单测 225 全绿 |
| 2026-08-09 | `77d2a35` + 本档 | 本地数据自主权三件套：① 快照导出/导入（lib/snapshot 纯函数 +6 单测 + DataPortCard 个人中心，实测 8 键往返 reload 恢复）；② 地图光点详情（CSS/3D 双端点击信号点 → 局详情卡：时间/地点/¥/名额/关注/复制分享直达；MapView 增 onDotClick）；③ 演示座舱（需求方/服务者/多开风控三剧本 + 复位，store 既有 API 零数据爆炸）→ 单测 231 全绿；纯本地可做项至此全部清零，主线仅剩 D 组数据化 |
| 2026-08-10 | `c4899f3`+ 未推 | 本地收尾双件：① 真机扫码（ScanMockSheet 接 getUserMedia + jsQR 逐帧解码，无摄像头自动降级模拟，jsqr@1.4 依赖；scan.ts parseWaveUrl +7 单测，浏览器实测发布→扫（降级）→识别局→/?wave&via=scan 跳转）；② 撮合偏好编辑（prefs.ts 四维池纯函数 +7 单测 + usePrefStore persist + ProfilePage 点击循环/重置，实测切换/重载持久/重置闭环）→ 单测 245 全绿；LAUNCH-GAP D 组「真机扫码」移入已闭环（本地零服务端依赖），D 组余 4 项待数据化 |
| 2026-08-10 | 未推 | 存量 lint error 修复：NotificationCenter.tsx setState-in-effect（`react-hooks/set-state-in-effect`）→ 已读集合改为 readKeys.ts 外部 store（useSyncExternalStore，同 mapPref 同构模式：server 快照空集、subscribe 时 warm 存储值，无水合不一致）+ markAllRead → lint 0 errors、tsc/245 单测绿、浏览器面板开合/空态无报错 |
| 2026-08-10 | 未推 | 本地化新三件：① 分享真二维码（ShareKit 伪码→qrcode canvas 真码；qr.test 闭环 qrcode→pngjs→jsQR 还原链接 +4）② 本地系统通知（systemNotify 五类事件 diff +8、NotificationCenter 挂载授权按钮与跨帧 diff→notify）③ 本地上传头像（IdentityAvatar 图片/emoji 兜底 + avatar.ts 96×96 压缩 + 三处展示 + persist）。附：FloatingDock `bottom-[calc(env(...))]` 触发 tailwind v4 arbitrary 解析 bug（仅全新编译暴露，旧缓存掩盖）→ 改为自定义 CSS 类 `o-safe-bottom/o-safe-pb`（globals.css 手写 safe-area 工具，与既有 .pb-safe 同范式）→ build 成功、prod 模式实测正常。单测 257 全绿（+12），tsc/lint（src）0 错；浏览器实测（prod 模式）：真码 canvas 224px/PNG 5.2KB/黑占比 45.7%、系统通知按钮存在、头像上传→JPEG 压缩→reload 持久→首页+雷达头+个人中心三处同步 |