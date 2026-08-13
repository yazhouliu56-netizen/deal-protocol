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
| LLM Gateway | ✅ ADR-0005：provider 表单一来源（gemini/zhipu/qwen/groq/openrouter 五行，补 key 即扩容）+ per-provider 配额（独立串行/间隔/429 冷却/健康分沉底）+ 按任务路由（chat→Gemini 首选；voice-intent/cluster/decompose/diagnose→智谱 JSON 稳定首选）+ /api/gateway 统一入口 + 五路由全部薄层化（含 cluster/decompose/diagnose 手写链收敛） |
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
| 设计宪法定稿 | ✅ `docs/DESIGN_CONSTITUTION.md`（10 条文 + §3 冲突上报用户拍板 + §4 ADR 模板两栏）+ 根/子 AGENTS.md 挂指针 + `docs/adr/TEMPLATE.md` + ADR-0006/0007 标注派生 | 2026-08-13 |
| ADR-0007 v2 契约全兑现 | ✅ C1 OrderCore（`base/order/orderCore.ts` 投影桥，22 调用方零改动）+ ammo 补 sop.ts + C4 hardGates 对齐 + e2e「填表即新弹药」（遛狗遛弯四表读全/引擎消费/零 base 修改）+ mobile 归属登记 → 单测 314 全绿、tsc/lint 0 错、build/冒烟通过 | 2026-08-13 |
| ADR-0008 智能争议小法官 | ✅ 第三圈①判决能：`base/ai/judge.ts` 规则引擎（硬伤升档/反驳降档/承诺落空升档 + 全责 100%/demander 0% 钳制）+9 单测 → `/api/judge` LLM 语义比对（judge task 入 Gateway 三级降级，毒丸围栏回落规则）+ 挂载 AcceptancePanel 争议视图 JudgePanel（反驳输入 → 建议赔付+话术 → 一键采纳）→ 单测 323 全绿、tsc/lint 0 错、build 通过、API 双场景实测 200（全责¥200/反驳降至36%） | 2026-08-13 |
| ADR-0009 多因子反欺诈探针 | ✅ 第五圈风控：`base/risk/sentinel.ts` 四路信号聚合（设备/信用/行为/图）+ 高危单因子不被稀释（宪法 #9 兜底）+ 缺数据剔除重归一（宪法 #10）+ 进家类目加权 +9 单测 → 发布闸门接入（high → `blocked:"sentinel"` 冷拒 / watch → 放行+事件流）→ PublishSheet 拒检提示 + AdminPanel SentinelDashboard 分数环/因子条/事件流 → 单测 332 全绿、tsc/lint 0 错、build 通过、浏览器实测（多开高危→发布被拒+仪表盘设备/图谱双因子触发） | 2026-08-13 |
| ADR-0010 隐私号+IM 归位 | ✅ 第二圈通讯：`base/comm/privacyNumber.ts`（48h 双向虚拟号池、掩码、拨入方向、终局回收 + 幂等分配）+ `base/comm/im.ts`（私信线程/未读/已读，pair 幂等）+ `lib/chat/*` git mv → `base/ai/chat/*`（8 import 全改，保历史）+ store 接线（acceptClaim 自动分配隐私会话 + sendIm/markImRead）+ transport union 合并 + ContactCard（掩码号+模拟拨号+私信气泡/未读红点）→ 单测 338 全绿 | 2026-08-13 |
| ADR-0011 语义推荐+BI | ✅ 第三圈：`base/ai/embed.ts`（中文字 bigram TF 余弦，零依赖）+ `base/ai/bi.ts`（中文指标/类目/时间/TopN 解析 → 聚合，不依赖 LLM）+6 单测（embed 语义排序 / BI 类目收益聚合）+ **宪法 #7 合规**（LLM 介入点评估已记录：延迟/可解释性/规模/断供四点理由，真实 embedding API 与 LLM 意图改写留后续 ADR） | 2026-08-13 |
| ADR-0012 鉴真+签章/保险 | ✅ 第三/四圈：`base/ai/forgery.ts`（五信号加权鉴真：EXIF/文件名/复用/时间/比例 + 文本重复 + LLM 复核降级链）+ `base/platform/signInsure.ts`（djb2 签章验签防篡改 + 履约险投保/理赔幂等壳）+9 单测 | 2026-08-13 |
| ADR-0013 危机+脱敏/遗忘 | ✅ 第五圈：`base/safe/crisis.ts`（级别 0-3 + EPA 通知递增：联系人→平台值班→警方通道 + 去重/处置闭环/SMS 模板）+ `base/safe/privacy.ts`（五类掩码 + 遗忘权请求幂等 + 按域匿名化）+5 单测 | 2026-08-13 |
| ADR-0014 韧性四件套 | ✅ 第六圈：`base/platform/offlineQueue.ts`（幂等入队/重放/指数退避）+ `circuit.ts`（熔断 3 次→open→冷却→half-open 探测 + 供需杠杆信号）+ `resilience.ts`（degrades 降级链 + 数据湖哈希链存证/全链校验 + AB 分流/胜负判定）+7 单测 | 2026-08-13 |
| ADR-0015 表单+geo 适配 | ✅ 第一圈：`base/form/dynamicForm.ts`（六类型字段/校验/渲染描述器/submittable，弹药填表即出表单）+ `base/geo/geoAdapter.ts`（GeoSrc 接口 + Mock 演示 + 注入点，mobile location.ts 消费方声明）+3 单测 | 2026-08-13 |
| ADR-0016 未成年人分级+免打扰 | ✅ 第五/六圈（对标 deep-research 吸收）：`base/safe/ageGate.ts`（分级 adult/teen/child：14 岁下监护人同意、18 岁下资金闸全拦且不因 guardMode=false 解除——法规对齐《未保条例》§31/§43 +《未保法》§72/§76，非法禁）+ `base/platform/quietHours.ts`（用户自主静音窗口、urgent 危机永推、合并/拆分窗口，不绑付费）+ `ammo/risk-rule` 新增 age-required 引信（全局默认开 + 夜骑/夜爬类目成人专属）+16 单测 | 2026-08-13 |
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
| UI/UX 打磨九件套 | ✅ `docs/UI-UX-BACKLOG.md` 全清零：① 发布 CTA 主视觉（渐变+光晕+入场动画）② 竞价卡虚线玻璃+演示沙盒标识降权 ③ 空态三步引导（localStorage 记忆）④ AI 屏语音入口气泡 ⑤ 行程屏真实 bookings 优先入时间线 ⑥ 头部层级+状态圆点 ⑦ Dock layoutId 光晕滑块 ⑧ 竞价按钮触控尺寸 ⑨ 全局 Toast（lib/toast + ToastHost + 发布/拼位接入，MutationObserver 实测弹出）| |

## 四、验证基线

| 项 | 当前值 |
|----|--------|
| 单测 | **287/287 全绿**（36 套，`npm run test:units`；UI/UX 第二批无纯函数新增，保持绿） |
| Lint | ESLint exit 0（0 errors；存量 warning 在 scripts/ 非组件） |
| TypeScript | tsc 全绿（根 + 子项目） |
| E2E 脚本 | 13 个就绪；**CI 挂 11 条**（match/app/wave/review/push/fulfil/governance/trust/openmatch/trustopen/acceptance） |
| 运行时错误 | 0（仅 THREE.Clock deprecation 噪音） |
| 语音链路实测 | ⚠️ 部分：voice-intent 真 LLM 识别 / IDB 留存 / 无麦克风降级 ✅；**录音→ASR 真链留待真机验证**（本机无麦克风）；**TTS 已真实出声链路 ✅ 2026-08-11：GLM 429（余额不足）→ edge-tts 兜底实测合成 mp3 17.4KB（audio/mpeg），双链全灭才落 speechSynthesis** |
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
- [x] **P8 商业化本地闭环** ✅（本批完成：多开风控阻断发布 + 裂变回报入通知中心 + 竞价佣金结算写回真实局）
- [x] **P8 钱包账本闭环** ✅（本批完成：竞价服务费/订阅扣费/服务收益统一入 identity.ledger + WalletView 正负分色）
- [ ] P8 商业化线上化：漫游入设备表 / PWA 真推（VAPID）/ 竞价接入真实支付（LAUNCH-GAP E 组）
- [ ] 更远：灵感漩涡（概念模糊未定 · 当前理解=发现功能：刷灵感 → 一段话生成新需求局，类「AI 帮你变出局」） / 短信兜底 / 组局者订阅线上支付
- [ ] **Meetup 吸收项（5，2026-08-13 用户裁决入 backlog）**：①组织者把关层 Request-to-spot（开放局发起人审批开关，复用 judge/fulfilment）★优先 ②waitlist 候补转正（满员进候补、退出按序/信用分补位，配合 release）③review 低分强制解释（≤3 星必填理由）④organizer 出勤档案视图（复用 no-show/violation 数据）⑤guest +1 携伴（携伴者实名登记对齐 ageGate/privacyNumber）
- [ ] **Meetup 裁决记录（2026-08-13）**：Meetup+ 付费解锁通讯/成员名单 = ⏸️ 现阶段不上 · 记录为潜在赢利点（若启用走宪法 §3 冲突上报拍板）；群 dues（组织者向成员收会费）= 🚫 C 端不抄，归 B 端/场地商家销售场景；静态兴趣搜索 = 🚫 落后不抄（类微信群，与 match.ts 即时撮合冲突）
- [x] **ADR-0006 O2O 万能底座蓝图定稿** ✅（本批完成文档层：RPG 设计哲学 → 六层防御圈 22 模块 + 本地现状映射（🟢8 / 🟡11 / 🔴7）+ 融合顺序定策 = 先蓝图定稿 → 再融合 web/mobile 按圈切分底座 → 再功能层迭代；后续融合期任务按圈/模块粒度排布）
- [x] **ADR-0007 底座融合执行（第一批）** ✅（本批完成：嫁接映射表定稿（web 83 lib 文件切割归属 + C1-C5 接口契约）→ **`src/base/` 共享层落地**：money 11（ledger/pay/deposit/bidding/customPricing/organizerSubscription）× trust 12（reputation/trust/starRank/review/violation/friends）× order 10（wave/booking/fulfilment/moduleFulfilment/dispute）× dispatch 4 × risk 6 × geo 8 × notify 4 × platform 22（含 p2p）× ai 23（含 gateway/voice 目录）→ 全量 git mv 保历史 + 调用方 import 全改；**`src/ammo/` 弹药属性表落地**（scene-template/prefs 迁入 + pricing-formula/dispatch-rule/risk-rule 新建，C3/C4/C5 契约兑现，新增类目只填表）→ 单测 303 全绿（+5 ammo）、tsc/lint 0 错、build 通过（8 API 路由正常）

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
| 2026-08-11 | `21c4e0e` | LLM Gateway（ADR-0005）全部落地：provider 表单一来源 + llmGuard per-provider 配额 + /api/gateway 聚合入口 + **五路由全薄层化（cluster/decompose/diagnose 手写链收敛，completeText 非流式统一链/超时/降级）** + 修复存量孤儿依赖（qrcode/jsqr/pngjs 补声明+@types）+ TTS edge-tts 兜底 → 单测 287 全绿，tsc/lint 0 错，六端点实测全 200（cluster/decompose/diagnose source=zhipu 真 LLM） |
| 2026-08-11 | `d356f02` | 语音闭环三件套（L1 输入/输出 + L2 意图 + 留证）：① `lib/voice/` 纯函数层（audioStore IndexedDB 留存 + queryClips/summarizeEvidence 取证；voiceIntent 结构化意图校验/关键词 mock 降级/播报文案；asrClient GLM-ASR→Web Speech 降级；ttsClient GLM-TTS→speechSynthesis 降级 + 文本哈希 IndexedDB 缓存）② `/api/asr`+`/api/tts`（智谱音频代理，无 key 503，不留服务端缓存）+ `/api/voice-intent`（zhipu→gemini 结构化 JSON，围栏容错）③ VoiceBar（按住说话→MediaRecorder→ASR→语音留证）、ChatPage 语音入口（L2 意图→发布局走既有确认卡支付闭环/查局势/对话 + 回复自动播报 TTS 开关 + 气泡重播）→ 单测 275 全绿（+18），tsc/lint 0 错（src），build 通过；浏览器实测：voice-intent 真 LLM 识别 publish-wave 字段全对齐、IDB 留存冒烟、无麦克风降级 Web Speech 错误提示不崩溃；本机无麦克风+智谱 TTS 无余额（429）故录音真链/播报出声留待真机验证 |
| 2026-08-12 | `8b8cfc4` | UI/UX 打磨九件套（`docs/UI-UX-BACKLOG.md` 建档全清零）：P1 ①发布 CTA 主视觉（渐变+光晕+入场）②竞价卡虚线玻璃+「演示沙盒·无真实资金」降权 ③空态三步引导（localStorage 记忆）；P2 ④AI 屏语音入口气泡（首次+持久）⑤行程屏真实 bookings 优先入时间线+副标题动态 ⑥头部昵称层级+状态圆点；P3 ⑦Dock layoutId 光晕滑块 ⑧竞价按钮 min-h-10 触控 ⑨全局 Toast（lib/toast zustand + ToastHost layout 挂载 + 发布/拼位接入）→ tsc/lint 0 错、单测 287 保持绿；浏览器实测：CTA 渐变/引导条/竞价卡降权/语音气泡/localStorage 持久/Dock 光晕/发布成功 toast（MutationObserver 捕获「需求已上线·正在雷达广播」）| |
| 2026-08-12 | `34d55b6` | UI/UX 第二批 8 项（`docs/UI-UX-BACKLOG.md` 重写为第二批清单 + React #418 根因落档）：P1 ①触控尺寸全面达标 ②hydration 修复（根因：useState 直读 localStorage 水合不一致 → `lib/clientFlags.ts` useSyncExternalStore 同构 server 快照恒 false + subscribe warm；顺带修 readKeys.ts getServerSnapshot 未缓存 warning→常量 EMPTY）③在线切换 toast + 文案去重；P2 ④行程屏英文残留中文化（otoActivities.location Maldives→马尔代夫/Bali→巴厘岛 4 处）⑤AR 取景框角标 AR VIEWFINDER→「AR 取景框」⑥发布弹层分组（核心表单常显 +「更多选项」折叠：定制/磋商留言/AI 拆解/开放局/鸽子险/有效期/开始时间/配额）；P3 ⑦行程屏导航按钮 ⑧发布品类 chips min-h-8 → tsc/lint 0 错、单测 287 绿、浏览器实测：行程屏/AR 指南全中文、发布弹层折叠展开完整、0 console error、无触控不达标按钮 | |
| 2026-08-12 | `b08afc5` | **P8 商业化本地全流程闭环（1/2）：多开风控阻断业务 + 裂变回报入通知 + 竞价结算写回真实局**——① `createPendingWave` 高危闸门（同设备 ≥3 身份 `blocked:"roam"`）+ PublishSheet 拒检提示；`simulateMultiOpen` 递增序号身份（连点 2 次即 high）+ RoamGuardPanel 高危生效提示 ② `fissionStamp`（真实增量才刷时间戳）+ Wave.fissionUpdatedAt + useWaveStore 三处换用 + systemNotify diff「邀请裂变 +1」+ notify/NotificationCenter 🪃 条目 ③ Wave.biddingSettled + settleBidding + BiddingSandboxCard 开标真写回 + MyWaves 结算徽章 → 单测 292 全绿（+5）、tsc/lint 0 错；浏览器实测：多开高危→发布被拒、真实局开标→「微笑保洁中标 ¥100 · 佣金 ¥8 · 净得 ¥92」、另一身份拼位→发起人通知中心「🪃 邀请裂变 +1」 | |
| 2026-08-12 | `824e00e` | **P8 商业化本地闭环（2/2）：钱包账本统一 + 漫游落盘 + 治理可见 + 响应方收益**——① `lib/ledger.ts`（applyLedger 出账不下穿 0 / makeLedgerEntry 防撞 id，+6 单测）+ useIdentityStore.book 通用入账（kind 扩 commission/subscription/income）② BiddingSandboxCard 开标按成交价 8% 记「竞价服务费」（幂等 note 含局 id）③ OrganizerBoostCard 开通/续费扣 ¥9.9 「组局加速订阅」④ WorkerWorkbench 完成订单按 service 金额入账「服务收益」（响应方商业化）⑤ 漫游过滤掉 persist 补 events（刷新不丢）+ AdminPanel 新增「漫游安全监控」区块（风险等级 + ⚠ 事件流）⑥ WalletView 流水改正负分色（入绿 +¥ / 出红 −¥，修旧统一 −¥ 缺陷）→ 单测 298 全绿（+6）、tsc/lint 0 错；浏览器实测：开标→账面 −¥8（余额 92）→开通订阅 −¥9.9（82.1）→工作台完成 2 单 +¥499/+¥80（661.1）、流水正负分色、漫游事件 3 条刷新生效 + 治理后台高危监控展示、复位后方复安全；生产 build + restart-prod（PID 22156）实测订阅入账通过 | |
| 2026-08-13 | 未推 | **ADR-0006 定稿（文档层）**：O2O 万能底座六层防御圈蓝图（RPG 设计哲学 → 22 模块分层：①触达 ②业务核心 ③AI 神经 ④生态网关 ⑤安全风控 ⑥生存基建）+ 本地现状映射（🟢8 已实现可复用 / 🟡11 需抽象 / 🔴7 未实现）+ 融合顺序定策（蓝图定稿 → 融合 web/mobile 按圈切分底座 → 功能层迭代）+ 阶段建议（MVP 融二圈/A 轮砸三圈五圈/B 轮补六圈）→ 详见 `docs/adr/0006-universal-base.md` | |
| 2026-08-13 | 未推 | **ADR-0007 底座融合执行（第一批落地）**：嫁接映射表 + C1-C5 接口契约定稿 → `src/base/` 共享层全量落地（money/trust/order/dispatch/risk/geo/notify/platform/ai 九域 100 文件 git mv 保历史 + 调用方 import 全改 + 测试路径同步）→ `src/ammo/` 弹药属性表（scene-template/prefs 迁入 + pricing-formula/dispatch-rule/risk-rule 新建 + ammo.test +5）→ 单测 303 全绿、tsc/lint 0 错、build 通过；lib/ 仅剩业务保留（mockData/mockResponders/chat/dial/scan/qr）→ 详见 `docs/adr/0007-base-merge-map.md` | |
| 2026-08-13 | 未推 | **设计宪法定稿（最高指导思想固化）**：`docs/DESIGN_CONSTITUTION.md` 落档（哲学出处 + 10 条文可裁定判据 + §2 效力分层 + §3 冲突上报用户拍板禁静默 + §4 ADR 模板两栏 + 修订记录）；根 `AGENTS.md` 与 `oto-spatial-web/AGENTS.md` 各挂 `<BEGIN:design-constitution>` 指针节（改前备份 .bak-20260813）；新增 `docs/adr/TEMPLATE.md`（六圈定位声明 + 宪法条文对照强制字段）；ADR-0006/0007 标注「派生自宪法 #n」→ 后续新设计/新 ADR 必须先读宪法、冲突必上报由用户裁决 | |
| 2026-08-13 | 未推 | **ADR-0007 v2 契约全兑现（执行手册收口）**：v2 重写为执行手册（§0 范围防发散 + §1 现状盘点 diff G1-G5 + §2 C1-C5 契约 + §3 Phase 0-5 + §5 缺口清单 N1-N16）；Phase 1 C1 OrderCore（`base/order/orderCore.ts` 投影桥 OrderStatus↔WaveStatus，Wave 语义零改动、22 调用方零回归，+5 单测）→ Phase 2 ammo/sop.ts 补建 + dispatch-rule hardGates 结构化对齐（+1 单测）→ Phase 3 e2e「填表即新弹药」：遛狗遛弯四表登记（pricing/dispatch/risk/sop）全读 + base 引擎消费 + 零 base 修改（+5 单测）→ Phase 4 mobile 归属登记（location→base/geo RN 候选/api→家政弹药/types→弹药类型/DynamicForm→N2；mobile tsc 存量 slider 依赖错单独排期）→ Phase 5 总验收：单测 **314 全绿**（303+11）、tsc/lint 0 错、build 通过、生产模式浏览器冒烟 0 console error；C1-C5 全部有落地 anchor 文件 | |
| 2026-08-13 | 未推 | **ADR-0008 智能争议小法官落地（缺口 N5 关闭）**：纯函数层 `src/base/ai/judge.ts`（证据硬伤→责任升档 / 反驳补救→降档 / 承诺落空→升档；全责 100%、demander 0%、partial/shared 钳制到原因上限；+9 单测）；`src/app/api/judge/route.ts`（judge task 注册进 Gateway 增补 providers 链 gemini/zhipu/groq/openrouter，prompt 内嵌原因赔付上限防 LLM 拍脑袋，解析失败/毒丸/超时回落到规则引擎 source=mock）；`components/waves/JudgePanel.tsx` 挂载争议视图（工作人员反驳输入→小法官判定→建议赔付 ¥+话术+置信度→一键采纳走 settleDispute 协商结算闭环）；API 双场景实测：全责无反驳 ¥200→¥200 100%、反驳补救→partial 36% ¥36；单测 314→**323 全绿**、tsc/lint 0 错、build 通过、prod 冒烟 0 console error | |
| 2026-08-13 | 未推 | **ADR-0009 多因子反欺诈探针落地（缺口 N9 关闭）**：`src/base/risk/sentinel.ts` 纯函数聚合探针——四路信号（设备多开 roamGuard / 信用·新号大额 / 行为·高频低完成 / 图·多身份裂变）+ 加权归一 × 引信（进家类目 ×1.2）+ 宪法 #9 高危单因子不被稀释兜底（max(加权, 最高因子分)，实测中发现 80 分被 40 分拉低到 64→放行的稀释 bug 并修复）+ 宪法 #10 缺数据剔除重归一，+9 单测；`useWaveStore.createPendingWave` 发布闸门接入（替代原 roam 单点拦截）：high → `blocked:"sentinel"` 冷拒 + sentinelEvents 事件流（跨 tab transport union 合并），watch → 放行留痕；PublishSheet 拒检提示；AdminPanel 新增 SentinelDashboard（分数环 + 四因子触发条 + 事件流时间线）；浏览器实测：正常发布放行→安全中心模拟多开至 3 身份→再发布被「反欺诈探针甄检到高危信号」拒绝、治理后台仪表盘「拒绝发布：设备多开、关联图谱」双因子触发；单测 323→**332 全绿**、tsc/lint 0 错、build 通过、prod 冒烟 0 console error | |
| 2026-08-13 | 未推 | **§5 缺口 N1-N16 全部关闭（功能层收口）**：八张 ADR（0010-0015 + 0008/0009）逐项落地——②圈 N1 隐私号中枢（48h 双向号码池/掩码/回收）+ N15 IM 私信归位（chat/→base/ai/chat 保历史、base/comm/im 私信线程/未读，ContactCard 挂成交卡片）；③圈 N3 语义推荐（字 bigram 余弦）+ N6 自然语言 BI（规则解析聚合）；③④圈 N4 AIGC 鉴真（五信号加权+LLM 复核降级）+ N7 签章/履约险壳（djb2 验签 + 幂等投保理赔）；⑤圈 N8 危机干预（EPA 级别递增：联系人→值班→警方）+ N10 脱敏/遗忘权（五类掩码 + 按域匿名化）；⑥圈 N11 离线队列（指数退避）+ N12 熔断/供需杠杆 + N13 降级四部曲 + N14 数据湖哈希链存证/AB；①圈 N2 动态表单引擎（Schema→渲染描述器）+ N16 geo RN 适配接口（GeoSrc 注入）；transport union 合并新状态、package.json 测试清单扩列；单测 332→**365 全绿**、tsc/lint 0 错、build 通过 | |
| 2026-08-13 | 已推（4da1c5e 起多笔） | **ADR-0011 宪法 #7 合规补记**：语义推荐（N3）与 BI（N6）评估过 LLM 接入并记录不接入理由（延迟敏感需即时反馈 / 可解释可审计优于向量黑箱 / 封闭域规则可穷尽 / 零外部依赖免断供），真实 embedding API 与 LLM 意图改写留后续 ADR；ADR-0011 命中条文补 #7 + 单独「LLM 介入点评估」小节，符合宪法 §4 两栏强制 | |
| 2026-08-13 | 已推（a6edc57） | **宪法出处文档外链修复**：RPG 哲学原文从桌面断链 → `docs/RPG设计哲学与生命力.md` 入仓 git 跟踪（700 行），宪法 §5 引用路径同步修正 | |
| 2026-08-13 | 已推（08d6305） | **宪法收敛门禁落地**：`docs/CONVERGENCE-LOG.md` 登记表（追认 6 笔历史 rename）+ `scripts/convergence-check.mjs` 机器拦截（未提交 rename 即时拦截、已提交未登记 rename 报错、登记 commit 存在性校验，实测抓出 4da1c5e/7754884 两笔）+ root package.json `check:convergence` + 根/sub AGENTS.md 强制规则（修复 Windows 下 cmd 管道吞 `|` 误报通过的隐患） | |
| 2026-08-13 | 待提交 | **ADR-0016 对标 deep-research 吸收（未成年人分级 + 推送免打扰）**：年龄策略由「一刀切禁」修正为「分级模式」（ageGate：<14 须监护人同意、<18 资金闸全拦且不因 guardMode=false 解除——法规对齐《未成年人网络保护条例》§31/§43 +《未保法》§72/§76）；每日上限定位为防骚扰而非付费玩法；废弃 C 端置顶（伪需求）仅留 B 端推广；免打扰 quietHours 用户自主静音窗口不绑付费、urgent 危机永推；`ammo/risk-rule` 新增 age-required 引信（全局默认开 + 夜骑/夜爬类目成人专属）；单测 365→**381 全绿**、tsc 0 错 | |
| 2026-08-13 | 待提交 | **ADR-0016 接线收口**：`useIdentityStore` 补 birthYear/guardianConsent + setAge；ProfilePage 新增「未成年人分级」（出生年输入 + <14 监护人同意勾选 + 模式展示）与「推送免打扰」（开关 + 二段默认静音窗口）设置区块；PublishSheet 发布路径接入 ageGate 分派（青少年免费局可发、鸽子险拦、超发付费拦）；`useQuietPrefStore` 持久化免打扰偏好；NotificationCenter 系统通知按 urgent（报价/接单/好友/裂变永推）vs normal（静音窗口内跳过）分流；381 全绿复验、tsc/lint/build 通过 | |
| 2026-08-13 | 待提交 | **对齐审计补记：CONVERGENCE-LOG 追溯登记 3 笔历史 SW rename**（`382663d` sw.ts→sw.js / `0a64fbd` sw.js→root / `7f868c3` sw.js→sw.ts，07-23 PWA 构建修复，宪法定稿前 §2 历史遗留）——深扫门禁 `--since` 全历史验证：登记前 exit=1 精确抓出 3 笔、登记后 exit=0 放行；登记册「唯一事实来源」闭环 | |
| 2026-08-13 | 待提交 | **Meetup 实地调研对标**：基于 Meetup 官方 Help Center + Blog 一手资料，将 `docs/oto-competitor-matrix.md` 深化为 §五 Meetup 专项对标（12 维度现状对照 + 结论）——确认我方 5 项更强（签到 signInsure/fulfilment、缺席治理、反欺诈 Sentinel、匹配即时性 match.ts、合规 ageGate/quietHours/privacyNumber）；梳理 5 项吸收进 backlog（组织者审批 Request to spot、waitlist 候补转正、低分强制解释、organizer 出勤档案、guest +1 携伴）；3 项不抄（Meetup+ 付费解锁通讯/群 dues/静态兴趣搜索，均与宪法 #10 冲突） | |
| 2026-08-13 | 待提交 | **Meetup 对标用户裁决落地**：5 项吸收项正式登记 PROJECT_STATUS backlog（组织者审批★优先 + 候补转正 + 低分强制解释 + 出勤档案 + guest+1）；3 项裁决定调写入矩阵 §5.2 记录在案——Meetup+ 付费解锁 = ⏸️ 现阶段不上·潜在赢利点（若启用走宪法 §3 冲突上报）；群 dues = 🚫 C 端不抄·归 B 端/场地商家销售场景；静态兴趣搜索 = 🚫 落后不抄（类微信群） | |
