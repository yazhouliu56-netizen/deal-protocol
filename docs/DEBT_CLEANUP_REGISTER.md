# 全仓资产与技术债全景总台账（DEBT CLEANUP REGISTER）

> **性质**：全仓资产与技术债单一事实源台账（Dry-Run 阶段产物，承接 2026-08-15 全仓死代码审计报告）。
> **审计方法**：`Select-String` + `[regex]::Matches` 全仓逐文件检索（`src/` 全部 `.ts/.tsx`，排除 `src/app/api/` 自身、`*.test.*`/`*.spec.*`），短名路由做 `/api/` 前缀精确复核，动态拼接路由以正则通配段（`[^/"' ]+`）消除 `${id}` 变量名差异误报，跨行模板字符串以全文 `-Raw` 检索补齐。
> **本阶段红线**：纯文档建档。**严禁删除/移动/修改任何源码、测试、配置**；物理出清须等创始人裁决后按 Batch 路线图（板块五）另发独立指令执行。
> **建档日期**：2026-08-15

## 统计口径声明（与指令预期数的差异说明）

- 指令预期 107 个 API 路由（78 活跃 + 24 孤儿 + 5 基础设施）；**实际文件系统盘点为 99 个 `route.ts`**（另含 1 个 `route.test.ts`：`webhooks/stripe/route.test.ts`）。
- 差异成因：`cron/*`（3）、`webhooks/*`（3）、`gateway`、`health`、`auth/wechat/callback` 共 9 项为**外部/运维触发**（前端 0 调用属正常），指令口径未单列；孤儿实际为 26 项（含 `admin/disputes` 无 `/list` 版、`protocols` 根、`protocols/[id]`、`disputes/[id]` 主路由等指令清单未覆盖项）。
- 本台账按**真实盘点**逐行全量建档：**65 活跃 + 26 孤儿 + 9 基础设施 = 100 条路由记录（99 route.ts + 1 条合并展开）**。编号按 A/B/C 前缀分组，全部逐行，无概括缩写。

---

# 板块一：API 路由全景状态台账（99 条逐行明细）

## 1.1 生产活跃在用路由（65 条，`[🟢]`）

| # | 路由路径 | 状态 | 调用方证据（页面/组件/SDK/服务） |
|---|---------|------|-------------------------------|
| 1 | `/api/chat` | [🟢 生产活跃在用] | `base/ai/chat/llmEngine.ts`、`llmGuard.ts`、`base/ai/voice/voiceIntent.ts`、`components/SplitDemandView.tsx` |
| 2 | `/api/waves/chat` | [🟢 生产活跃在用] | `base/ai/chat/llmEngine.ts`（waves 场景链） |
| 3 | `/api/voice-intent` | [🟢 生产活跃在用] | `base/ai/voice/voiceIntent.ts`、`oto-ui/chat/ChatPage.tsx` |
| 4 | `/api/cluster` | [🟢 生产活跃在用] | `base/ai/cluster.ts`、`store/useWaveStore.ts` |
| 5 | `/api/decompose` | [🟢 生产活跃在用] | `base/ai/decompose.ts`、`waves/PublishSheet.tsx` |
| 6 | `/api/diagnose` | [🟢 生产活跃在用] | `base/ai/diagnostic.ts`、`waves/DiagnosisCard.tsx` |
| 7 | `/api/judge` | [🟢 生产活跃在用] | `waves/JudgePanel.tsx`（ADR-0008 智能小法官） |
| 8 | `/api/asr` | [🟢 生产活跃在用] | `base/ai/voice/asrClient.ts`、`components/VoiceInput.tsx` |
| 9 | `/api/tts` | [🟢 生产活跃在用] | `base/ai/voice/ttsClient.ts` |
| 10 | `/api/ai/match` | [🟢 生产活跃在用] | `app/developer/radar/page.tsx` |
| 11 | `/api/sse` | [🟢 生产活跃在用] | `lib/use-sse.ts` |
| 12 | `/api/demands` | [🟢 生产活跃在用] | `demands/page.tsx`、`demands/create/page.tsx`、`landing/page.tsx`、`SplitDemandView.tsx`、`demands/[id]/page.tsx` |
| 13 | `/api/demands/[id]` | [🟢 生产活跃在用] | `demands/[id]/page.tsx` |
| 14 | `/api/demands/[id]/assign` | [🟢 生产活跃在用] | `GrabConsole.tsx`、`ProviderConsole.tsx`、`SwipeableCard.tsx` |
| 15 | `/api/demands/[id]/status` | [🟢 生产活跃在用] | `provider/orders/[id]/OrderFulfillmentClient.tsx` |
| 16 | `/api/orders` | [🟢 生产活跃在用] | `orders/page.tsx`、`orders/[id]/page.tsx`、`orders/[id]/order-operations.tsx`、`chat/[id]/page.tsx`、`payment/[id]/page.tsx`、`ProviderConsole.tsx`、`ProviderCheckinModal.tsx` |
| 17 | `/api/orders/[id]` | [🟢 生产活跃在用] | `orders/[id]/page.tsx`、`orders/[id]/order-operations.tsx`、`orders/[id]/review/page.tsx`、`chat/[id]/page.tsx`、`payment/[id]/page.tsx`、`ProviderCheckinModal.tsx` |
| 18 | `/api/payment/create` | [🟢 生产活跃在用] | `orders/[id]/page.tsx`（发起支付） |
| 19 | `/api/payment/escrow` | [🟢 生产活跃在用] | `payment/[id]/page.tsx`（资金托管） |
| 20 | `/api/payment/release` | [🟢 生产活跃在用] | `client/orders/[id]/ClientTrackingClient.tsx`（放款） |
| 21 | `/api/payment/status/[id]` | [🟢 生产活跃在用] | `orders/[id]/page.tsx` |
| 22 | `/api/payment/notify` | [🟢 生产活跃在用] | `lib/payment.ts`（支付回调服务端） |
| 23 | `/api/profile` | [🟢 生产活跃在用] | `profile/page.tsx`、`dashboard/page.tsx`、`sos/page.tsx`、`verification/page.tsx`、`provider/grab/[id]/GrabConsoleClientWrapper.tsx`、`provider/incoming/IncomingListClient.tsx`、`ProviderConsole.tsx`、`SessionProvider.tsx` |
| 24 | `/api/register` | [🟢 生产活跃在用] | `register/page.tsx` |
| 25 | `/api/auth/sms/send` | [🟢 生产活跃在用] | `login/page.tsx` |
| 26 | `/api/auth/sms/verify` | [🟢 生产活跃在用] | `login/page.tsx` |
| 27 | `/api/auth/wechat` | [🟢 生产活跃在用] | `login/page.tsx` |
| 28 | `/api/verification/submit` | [🟢 生产活跃在用] | `verification/page.tsx` |
| 29 | `/api/notifications` | [🟢 生产活跃在用] | `NotificationBell.tsx`、`providers/NotificationProvider.tsx` |
| 30 | `/api/notifications/list` | [🟢 生产活跃在用] | `providers/NotificationProvider.tsx` |
| 31 | `/api/notifications/mark-read` | [🟢 生产活跃在用] | `providers/NotificationProvider.tsx` |
| 32 | `/api/push/subscribe` | [🟢 生产活跃在用] | `oto-ui/PushEnableBar.tsx` |
| 33 | `/api/push/send` | [🟢 生产活跃在用] | `app/sw.ts`（Service Worker）、`oto-ui/PushEnableBar.tsx` |
| 34 | `/api/sos/trigger` | [🟢 生产活跃在用] | `sos/page.tsx`（SOS 四联动） |
| 35 | `/api/finance/overview` | [🟢 生产活跃在用] | `finance/page.tsx` |
| 36 | `/api/finance/transactions` | [🟢 生产活跃在用] | `finance/page.tsx` |
| 37 | `/api/finance/withdraw` | [🟢 生产活跃在用] | `WithdrawModal.tsx` |
| 38 | `/api/disputes/create` | [🟢 生产活跃在用] | `components/DisputeModal.tsx`（⚠️ 组件自身为待审死代码 C4，路由级联孤儿风险，见板块三） |
| 39 | `/api/disputes/list` | [🟢 生产活跃在用] | `disputes/page.tsx` |
| 40 | `/api/disputes/detail` | [🟢 生产活跃在用] | `disputes/[id]/page.tsx` |
| 41 | `/api/evidence/export-judicial-package` | [🟢 生产活跃在用] | `waves/ArbitrationSheet.tsx`（司法取证包导出） |
| 42 | `/api/reviews` | [🟢 生产活跃在用] | `orders/[id]/review/page.tsx` |
| 43 | `/api/reviews/submit` | [🟢 生产活跃在用] | `components/ReviewModal.tsx`（⚠️ 组件为待审死代码 C5，级联孤儿风险，见板块三） |
| 44 | `/api/llm-classify` | [🟢 生产活跃在用] | `components/SmartRequest.tsx`（⚠️ 组件为待审死代码 C6，级联孤儿风险，见板块三） |
| 45 | `/api/llm/structure-team` | [🟢 生产活跃在用] | `team/create/page.tsx` |
| 46 | `/api/protocols/generate` | [🟢 生产活跃在用] | `landing/page.tsx`（AI 协议生成） |
| 47 | `/api/team/create` | [🟢 生产活跃在用] | `team/create/page.tsx` |
| 48 | `/api/team/[id]` | [🟢 生产活跃在用] | `team/[id]/page.tsx`、`team/create/page.tsx` |
| 49 | `/api/team/interest` | [🟢 生产活跃在用] | `team/[id]/page.tsx` |
| 50 | `/api/user/[id]` | [🟢 生产活跃在用] | `user/[id]/page.tsx` |
| 51 | `/api/provider/demands` | [🟢 生产活跃在用] | `ProviderConsole.tsx` |
| 52 | `/api/provider/settle` | [🟢 生产活跃在用] | `ProviderConsole.tsx` |
| 53 | `/api/provider/upload-proof` | [🟢 生产活跃在用] | `ProviderConsole.tsx` |
| 54 | `/api/admin/arbitrate` | [🟢 生产活跃在用] | `admin/disputes/page.tsx` |
| 55 | `/api/admin/complaints` | [🟢 生产活跃在用] | `admin/complaints/page.tsx`、`admin/page.tsx` |
| 56 | `/api/admin/config` | [🟢 生产活跃在用] | `admin/config/page.tsx` |
| 57 | `/api/admin/disputes/list` | [🟢 生产活跃在用] | `admin/disputes/page.tsx` |
| 58 | `/api/admin/protocols` | [🟢 生产活跃在用] | `admin/protocols/page.tsx` |
| 59 | `/api/admin/protocols/[id]` | [🟢 生产活跃在用] | `admin/protocols/page.tsx`（编辑协议） |
| 60 | `/api/admin/reputation/list` | [🟢 生产活跃在用] | `admin/reputation/page.tsx` |
| 61 | `/api/admin/reputation/amnesty` | [🟢 生产活跃在用] | `admin/reputation/page.tsx` |
| 62 | `/api/admin/review` | [🟢 生产活跃在用] | `admin/review/page.tsx`、`admin/page.tsx` |
| 63 | `/api/admin/stats` | [🟢 生产活跃在用] | `admin/page.tsx` |
| 64 | `/api/admin/withdraw/list` | [🟢 生产活跃在用] | `admin/withdrawals/page.tsx` |
| 65 | `/api/admin/withdraw/review` | [🟢 生产活跃在用] | `admin/withdrawals/page.tsx` |

## 1.2 孤儿路由（26 条，`[🟡 待出清/待裁决]`）——Grep 0 生产引用

| # | 路由路径 | 状态 | 调用方证据（Grep 0 命中） | 性质判定 |
|---|---------|------|--------------------------|---------|
| A1 | `/api/llm-test` | [🟡 待出清/待裁决] | `llm-test` 全仓 0 命中；文件头注释自述 "Debug endpoint — can be removed in production" | 历史调试垃圾（可删） |
| A2 | `/api/ai/inspect-quality` | [🟡 待出清/待裁决] | 0 命中；依赖 `lib/vision-inspector`（唯一 route 消费方，级联） | 历史调试垃圾（可删） |
| A3 | `/api/ai/negotiate` | [🟡 待出清/待裁决] | `/api/ai/negotiate` 0 命中；仅 `base/order/dispute.ts` 命中 `"negotiate"` 为纠纷类型字符串（非 API 调用）；依赖 `lib/ai-negotiator`（级联） | 历史调试垃圾（可删） |
| A4 | `/api/ai/push-recommendations` | [🟡 待出清/待裁决] | 0 命中 | 历史调试垃圾（可删） |
| A5 | `/api/category-configs` | [🟡 待出清/待裁决] | 0 命中；功能被 `modules/m03-category-config` 取代 | 历史重复（可删） |
| A6 | `/api/demands/create` | [🟡 待出清/待裁决] | 0 命中；前端全部走 `/api/demands` 根路由（`demands/create/page.tsx`） | 历史重复路由（可删） |
| A7 | `/api/demands/list` | [🟡 待出清/待裁决] | `/api/demands/list` 0 命中；根路由已覆盖列表功能 | 历史重复路由（可删） |
| A8 | `/api/demands/nearby` | [🟡 待出清/待裁决] | 0 命中；`modules/m05-geo-index` 已提供 geo-service | 功能已被模块取代（可删） |
| A9 | `/api/demands/predict-intent` | [🟡 待出清/待裁决] | 0 命中；依赖 `lib/intent-radar`（唯一调用方，级联） | 历史调试垃圾（可删） |
| A10 | `/api/demands/[id]/match` | [🟡 待出清/待裁决] | 正则通配段 `/api/demands/{段}/match` 0 命中；前端撮合走 `/api/ai/match` | 功能重复（可删） |
| A11 | `/api/demands/[id]/tip` | [🟡 待出清/待裁决] | 0 命中 | 未接线功能（可删） |
| A12 | `/api/developer/preference` | [🟡 待出清/待裁决] | 0 命中（1536 维向量偏好，无消费方） | 未接线功能（可删） |
| A13 | `/api/disputes/[id]/arbitrate-ai` | [✅ 已核销·批次 3b] | `arbitrate-ai` 0 命中；`lib/ai-arbitrator` 已于批次 3b 物理出清（`6b71efc`，审计证实 ai-arbitration-card.tsx 零 import 该 lib，登记册原记载过时） | 历史调试垃圾（可删） |
| A14 | `/api/disputes/[id]`（主路由） | [🟡 待出清/待裁决] | 页面走 `/api/disputes/detail?id=`；`[id]` 主路由 0 命中 | 功能重复（可删） |
| A15 | `/api/disputes/resolve` | [🟡 待出清/待裁决] | 0 命中；裁决能力由 `lib/arbitration` + `admin/arbitrate` 承担 | 功能重复（可删/可并入 admin/arbitrate） |
| A16 | `/api/orders/accept-delivery` | [🟡 待出清/待裁决] | 0 命中；验收走 `orders/[id]` 链 | 历史重复（可删） |
| A17 | `/api/orders/submit-delivery` | [🟡 待出清/待裁决] | 0 命中；交付走 `orders/[id]` 链 | 历史重复（可删） |
| A18 | `/api/pricing/estimate` | [🟡 待出清/待裁决] | 0 命中；`m03-category-config/pricing-engine` 已内联 | 功能被模块取代（可删） |
| A19 | `/api/profile/delete` | [🟡 待出清/待裁决] | `/api/profile` 11 处引用均为根路由，`/delete` 0 命中 | 未接线功能（可删） |
| A20 | `/api/provider/withdraw` | [🟡 待出清/待裁决] | 0 命中；提现走 `/api/finance/withdraw`（WithdrawModal） | 功能重复（可删） |
| A21 | `/api/telecom/privacy-number` | [🟡 待出清/待裁决] | 0 命中；`lib/privacy-guard` 仍被 4 处活跃 route 消费（admin/review、orders/[id]、profile），lib 保留 | 未接线功能（可删） |
| A22 | `/api/v1/agent/protocols/bid` | [🟡 待出清/待裁决] | 0 命中；依赖 `lib/agent-gateway`（唯一调用方，级联） | 对外契约候选（建议保留待裁决） |
| A23 | `/api/verify/identity` | [🟡 待出清/待裁决] | 0 命中；实名核验已由 `modules/m02-auth` 承担 | 功能重复（可删） |
| A24 | `/api/protocols`（根） | [🟡 待出清/待裁决] | 精确串 `/api/protocols` 0 命中（页面走 `admin/protocols`） | 历史重复（可删） |
| A25 | `/api/protocols/[id]` | [🟡 待出清/待裁决] | 0 命中（`landing` 仅调 `generate`）；管理走 `admin/protocols/[id]` | 历史重复（可删） |
| A26 | `/api/admin/disputes`（无 `/list` 版） | [🟡 待出清/待裁决] | 精确串 `/api/admin/disputes` 0 命中（页面用 `/list`）；正则有引用系 `/list` 前缀吸收，人工复核确认 0 | 历史重复（可删） |

## 1.3 外部/云端基础设施路由（9 条，`[🔴 严禁删除]`）

| # | 路由路径 | 状态 | 调度/触发方式 |
|---|---------|------|--------------|
| B1 | `/api/cron/check-timeouts` | [🔴 外部/云端基础设施 · 严禁删除] | `vercel.json` crons：`0 0 * * *`，服务端密钥 Bearer 鉴权；超时自动完结 |
| B2 | `/api/cron/resolve-disputes` | [🔴 外部/云端基础设施 · 严禁删除] | `vercel.json` crons：`0 6 * * *`；争议自动裁决 |
| B3 | `/api/cron/credit-decay` | [🔴 外部/云端基础设施 · 严禁删除] | `vercel.json` crons：`0 2 * * *`；信用衰减（§5.6 30/90 天） |
| B4 | `/api/webhooks/stripe` | [🔴 外部/云端基础设施 · 严禁删除] | Stripe 支付回调（含 `route.test.ts` 测试）；服务端密钥验签 |
| B5 | `/api/webhooks/wechat` | [🔴 外部/云端基础设施 · 严禁删除] | 微信支付 XML 回调；`lib/wechat-pay-service` 活跃（5 处引用） |
| B6 | `/api/webhooks/alipay` | [🔴 外部/云端基础设施 · 严禁删除] | 支付宝回调；`lib/alipay-service.ts` 引用 |
| B7 | `/api/gateway` | [🔴 外部/云端基础设施 · 严禁删除] | ADR-0005 LLM Gateway 统一入口（SSE 分派 chat/voice-intent）；渐进迁移桥头堡，`base/ai/gateway/*` 引擎活跃 |
| B8 | `/api/health` | [🔴 外部/云端基础设施 · 严禁删除] | 运维探活端点（`restart-prod.mjs` / verify-prod 使用） |
| B9 | `/api/auth/wechat/callback` | [🔴 外部/云端基础设施 · 严禁删除] | 微信 OAuth 外部重定向回调（前端 0 调用属正常） |

---

# 板块二：UI 组件全景状态台账（126 个生产组件 + 6 个测试文件 = 132 个 `.tsx`）

> 计数口径：`src/components/` 共 132 个 `.tsx`（含 6 个 `*.test.tsx`），生产组件 126 个。指令预期 115 项（99 现代 + 16 待审），本台账按真实 126 项逐行全量建档（其中 16 项待审见 2.2）。

## 2.1 现代组件与原子组件（`[🟢 正常在用]`，共 110 项）

### waves/（33 项，waves 撮合经济闭环 UI 层，全量在册）

| 组件 | 状态 | 备注 |
|------|------|------|
| `waves/AcceptancePanel.tsx` | [🟢 正常在用] | 验收面板（签章/鉴真/低分拦截） |
| `waves/ArbitrationSheet.tsx` | [🟢 正常在用] | 争议调解抽屉（消费 `evidence/export-judicial-package`） |
| `waves/AttendancePanel.tsx` | [🟢 正常在用] | 出勤档案 |
| `waves/BiddingSandboxCard.tsx` | [🟢 正常在用] | 公开竞价沙盒（8% 佣金结算） |
| `waves/BlindReveal.tsx` | [🟢 正常在用] | 盲盒揭晓 |
| `waves/CapabilityPanel.tsx` | [🟢 正常在用] | 能力面板（消费 `ammo/dispatch-rule`） |
| `waves/ContactCard.tsx` | [🟢 正常在用] | 隐私号+私信卡片 |
| `waves/DiagnosisCard.tsx` | [🟢 正常在用] | S2 AI 主动诊断卡（消费 `/api/diagnose`） |
| `waves/DialCard.tsx` | [🟢 正常在用] | 拨号卡片 |
| `waves/DynamicDraftCard.tsx` | [🟢 正常在用] | 动态草稿卡（引信投影） |
| `waves/FavoritesSheet.tsx` | [🟢 正常在用] | 关注收藏面板 |
| `waves/FriendKit.tsx` | [🟢 正常在用] | 转友工具组 |
| `waves/FriendList.tsx` | [🟢 正常在用] | 好友列表 |
| `waves/FulfillmentCenter.tsx` | [🟢 正常在用] | 履约中心（仲裁/验收聚合） |
| `waves/FulfillmentCockpit.tsx` | [🟢 正常在用] | 履约驾驶舱（外骨骼顶栏） |
| `waves/JudgePanel.tsx` | [🟢 正常在用] | ADR-0008 智能小法官面板（消费 `/api/judge`） |
| `waves/MapView.tsx` | [🟢 正常在用] | MapLibre 3D 地图（ADR-0004） |
| `waves/MyClaims.tsx` | [🟢 正常在用] | 我的承接 |
| `waves/MyWaves.tsx` | [🟢 正常在用] | 我的发布 |
| `waves/NegotiationBox.tsx` | [🟢 正常在用] | 磋商箱 |
| `waves/NotificationCenter.tsx` | [🟢 正常在用] | 通知中心（`oto/page.tsx` 消费；根目录同名旧版 C2 为待审） |
| `waves/OrganizerBoostCard.tsx` | [🟢 正常在用] | 组局加速订阅 |
| `waves/PaySheet.tsx` | [🟢 正常在用] | 支付面板 |
| `waves/PublishSheet.tsx` | [🟢 正常在用] | 发布面板（消费 `/api/decompose`、`ammo`） |
| `waves/RadarInbox.tsx` | [🟢 正常在用] | 雷达收件箱 |
| `waves/ReviewSection.tsx` | [🟢 正常在用] | 评价区（低分强制解释） |
| `waves/RoamGuardPanel.tsx` | [🟢 正常在用] | 多开风控面板 |
| `waves/SafetyKit.tsx` | [🟢 正常在用] | 安全工具箱 |
| `waves/ShareKit.tsx` | [🟢 正常在用] | 拼位裂变分享（真二维码） |
| `waves/SpatialHeatMap.tsx` | [🟢 正常在用] | S1 匿名光点热力图（消费 MapView） |
| `waves/WalletView.tsx` | [🟢 正常在用] | 钱包账本视图 |
| `waves/WaveCard.tsx` | [🟢 正常在用] | 局卡片（审批态/被拒态） |
| `waves/WaveFeed.tsx` | [🟢 正常在用] | 雷达 feed（`oto/page.tsx` 消费） |
| `waves/slots/CompanionSlot.tsx` | [🟢 正常在用] | 陪伴弹药槽 |
| `waves/slots/HousekeepingSlot.tsx` | [🟢 正常在用] | 家政弹药槽 |
| `waves/slots/MeetupSlot.tsx` | [🟢 正常在用] | 组局弹药槽 |

### oto-ui/ 全系（34 项，含 3d/profile/destinations/admin/chat 子目录）

| 组件 | 状态 | 备注 |
|------|------|------|
| `oto-ui/CategoryPill.tsx` | [🟢 正常在用] | 品类胶囊 |
| `oto-ui/DynamicFormView.tsx` | [🟢 正常在用] | 动态表单渲染端（ADR-0015） |
| `oto-ui/EnvBadge.tsx` | [🟢 正常在用] | 环境徽章 |
| `oto-ui/FloatingDock.tsx` | [🟢 正常在用] | 悬浮 Dock |
| `oto-ui/GlassCard.tsx` | [🟢 正常在用] | 玻璃卡片 |
| `oto-ui/GlassIconButton.tsx` | [🟢 正常在用] | 玻璃图标按钮 |
| `oto-ui/IdentityAvatar.tsx` | [🟢 正常在用] | 本地头像（96×96 JPEG） |
| `oto-ui/OfflineQueueIndicator.tsx` | [🟢 正常在用] | 离线队列指示（ADR-0014） |
| `oto-ui/OnlineStatusBridge.tsx` | [🟢 正常在用] | 在线状态桥 |
| `oto-ui/OtoBadge.tsx` | [🟢 正常在用] | O2O 徽章 |
| `oto-ui/PushEnableBar.tsx` | [🟢 正常在用] | 推送授权条（消费 `/api/push/*`） |
| `oto-ui/PwaServiceWorker.tsx` | [🟢 正常在用] | PWA SW 注册 |
| `oto-ui/ScanMockSheet.tsx` | [🟢 正常在用] | 真机扫码（getUserMedia+jsQR） |
| `oto-ui/SearchBar.tsx` | [🟢 正常在用] | 搜索栏 |
| `oto-ui/SeniorModeView.tsx` | [🟢 正常在用] | 长辈模式 |
| `oto-ui/StatusCapsule.tsx` | [🟢 正常在用] | 五态进度胶囊（SOS 按钮） |
| `oto-ui/StealthCalculator.tsx` | [🟢 正常在用] | 隐形防御计算器 |
| `oto-ui/ToastHost.tsx` | [🟢 正常在用] | 全局 Toast |
| `oto-ui/VoiceBar.tsx` | [🟢 正常在用] | 按住说话语音条 |
| `oto-ui/3d/FurnitureScene.tsx` | [🟢 正常在用] | 家具场景 |
| `oto-ui/3d/HoloCard.tsx` | [🟢 正常在用] | 全息卡片 |
| `oto-ui/3d/ProceduralSpatialCanvas.tsx` | [🟢 正常在用] | 程序化空间画布 |
| `oto-ui/3d/SceneTemplate.tsx` | [🟢 正常在用] | 场景模板×4（消费 `ammo/scene-template`） |
| `oto-ui/3d/Stage.tsx` | [🟢 正常在用] | 3D 舞台 |
| `oto-ui/3d/StarDust.tsx` | [🟢 正常在用] | 星尘粒子 |
| `oto-ui/profile/CockpitDemoCard.tsx` | [🟢 正常在用] | 演示座舱卡 |
| `oto-ui/profile/DataPortCard.tsx` | [🟢 正常在用] | 数据快照导出/导入 |
| `oto-ui/profile/ProfilePage.tsx` | [🟢 正常在用] | 个人中心（安全中心/紧急联系人/分级） |
| `oto-ui/profile/WorkerWorkbench.tsx` | [🟢 正常在用] | 响应方工作台 |
| `oto-ui/destinations/DestinationCard.tsx` | [🟢 正常在用] | 目的地卡 |
| `oto-ui/destinations/DestinationHub.tsx` | [🟢 正常在用] | 目的地中心 |
| `oto-ui/admin/AdminPanel.tsx` | [🟢 正常在用] | 治理后台（数据湖存证） |
| `oto-ui/admin/SentinelDashboard.tsx` | [🟢 正常在用] | ADR-0009 反欺诈仪表盘 |
| `oto-ui/chat/ChatPage.tsx` | [🟢 正常在用] | AI 对话页（消费 `/api/voice-intent`；取代根目录 RealtimeChat C1） |

### ui/ 原子组件（15 项）

| 组件 | 状态 |
|------|------|
| `ui/badge.tsx` | [🟢 正常在用] |
| `ui/button.tsx` | [🟢 正常在用] |
| `ui/card.tsx` | [🟢 正常在用] |
| `ui/cyber-empty-state.tsx` | [🟢 正常在用] |
| `ui/cyber-oracle-dialog.tsx` | [🟢 正常在用] |
| `ui/cyber-skeleton.tsx` | [🟢 正常在用] |
| `ui/dialog.tsx` | [🟢 正常在用] |
| `ui/dropdown-menu.tsx` | [🟢 正常在用] |
| `ui/input.tsx` | [🟢 正常在用] |
| `ui/popover.tsx` | [🟢 正常在用] |
| `ui/select.tsx` | [🟢 正常在用] |
| `ui/sheet.tsx` | [🟢 正常在用] |
| `ui/Skeleton.tsx` | [🟢 正常在用] |
| `ui/table.tsx` | [🟢 正常在用] |
| `ui/textarea.tsx` | [🟢 正常在用] |

### 根目录与其余目录活跃组件（23 项）

| 组件 | 状态 | 调用方证据 |
|------|------|-----------|
| `Header.tsx` | [🟢 正常在用] | `app/layout.tsx`（含 NotificationBell） |
| `SessionProvider.tsx` | [🟢 正常在用] | 19 处引用（layout + 16 页面 + NotificationProvider + Header） |
| `NotificationBell.tsx` | [🟢 正常在用] | `Header.tsx`（消费 `/api/notifications`） |
| `ClientConsole.tsx` | [🟢 正常在用] | `console/page.tsx` |
| `ProviderConsole.tsx` | [🟢 正常在用] | `provider/page.tsx`（消费 `/api/provider/*`、`/api/demands/[id]/assign` 等 7 个 API） |
| `GrabConsole.tsx` | [🟢 正常在用] | `provider/grab/[id]/GrabConsoleClientWrapper.tsx` |
| `SwipeableCard.tsx` | [🟢 正常在用] | `provider/incoming/IncomingListClient.tsx` |
| `SplitDemandView.tsx` | [🟢 正常在用] | `demands/new/page.tsx`（动态 import；消费 `/api/demands`、`/api/chat`、VoiceMicButton） |
| `SmartProtocolCard.tsx` | [🟢 正常在用] | `chat/[id]/page.tsx`、`lib/chat-component-registry.tsx`、`lib/genui-renderer.tsx` |
| `CreditDashboard.tsx` | [🟢 正常在用] | `chat/[id]/page.tsx` |
| `MediaPicker.tsx` | [🟢 正常在用] | `demo/page.tsx`、`SmartProtocolCard.tsx` |
| `PriceSlider.tsx` | [🟢 正常在用] | `demo/page.tsx`、`SmartProtocolCard.tsx` |
| `WithdrawModal.tsx` | [🟢 正常在用] | `finance/page.tsx`（消费 `/api/finance/withdraw`） |
| `VoiceMicButton.tsx` | [🟢 正常在用] | `SplitDemandView.tsx` |
| `MapComponent.tsx` | [🗑 已出清] | ~~Leaflet 双轨~~ → 履约页已迁移 MapLibre `MapView`（Batch 4 C15 收敛，`git rm` 删除 + leaflet 依赖出清） |
| `providers/UXProvider.tsx` | [🟢 正常在用] | `app/layout.tsx` |
| `providers/NotificationProvider.tsx` | [🟢 正常在用] | `components/NotificationCenter.tsx`（旧版 C2）+ 跨帧通知 |
| `theme/theme-provider.tsx` + `theme-switcher.tsx` | [🟢 正常在用] | layout / 主题切换 |
| `profile/escrow-stats.tsx` + `inventory-grid.tsx` | [🟢 正常在用] | profile 页面 |
| `escrow/checkpoint-timer.tsx` | [🟢 正常在用] | `demands/[id]/page.tsx`（里程碑倒计时） |
| `onboarding/guild-registration-modal.tsx` | [🟢 正常在用] | `demands/page.tsx` |
| `encounter/queue-adventure-modal.tsx` | [🟢 正常在用] | `demands/page.tsx` |
| `demands/demand-card.tsx`、`ai/ai-arbitration-card.tsx`、`gacha/gacha-modal.tsx` | [🟢 正常在用] | demands 列表 / `demands/[id]/page.tsx` / 抽卡弹窗 |

> 注：`waves/*` 3 个测试文件（`DynamicDraftCard.test.tsx`、`FulfillmentCockpit.test.tsx`、`FulfillmentE2EIntegration.test.tsx`）与 `oto-ui/*` 3 个测试文件（`StatusCapsule.test.tsx`、`Tier4EdgeCases.test.tsx`、`OnlineStatusBridge.test.tsx`）为验证资产，**保留**。

## 2.2 老旧/待审组件（16 项，`[🟡 待出清/待裁决]`）

| # | 组件路径 | 现有功能 | 调用方证据（Grep） | 爆炸半径与风险 | 推荐处置 |
|---|---------|---------|-------------------|----------------|---------|
| C1 | `components/RealtimeChat.tsx` | 旧实时聊天 | `RealtimeChat` 0 引用（被 `oto-ui/chat/ChatPage` 取代） | 零 | 彻底删除 |
| C2 | `components/NotificationCenter.tsx`（根目录） | 旧通知中心 | 0 引用（`waves/NotificationCenter` 被 `oto/page.tsx` 引用）；⚠️ 内部 import `providers/NotificationProvider`（活跃，勿连带删） | 零 | 彻底删除 |
| C3 | `components/AIArbitrationCard.tsx`（根目录） | 旧仲裁卡片 | 0 引用（`ai/ai-arbitration-card` 为活跃替代） | 零 | 彻底删除 |
| C4 | `components/DisputeModal.tsx` | 争议弹窗 | 0 引用；**唯一依赖 `/api/disputes/create`（级联孤儿，见板块三）** | 零（API 同步处置） | 彻底删除（成对） |
| C5 | `components/ReviewModal.tsx` | 评价弹窗 | 0 引用；**唯一依赖 `/api/reviews/submit`（级联孤儿）** | 零（API 同步处置） | 彻底删除（成对） |
| C6 | `components/SmartRequest.tsx` | 智能请求 | 0 引用；**唯一依赖 `/api/llm-classify`（级联孤儿）** | 零（API 同步处置） | 彻底删除（成对） |
| C7 | `components/OnboardingWizard.tsx` | 引导向导 | 0 引用 | 零 | 彻底删除 |
| C8 | `components/VoiceInput.tsx` | 语音输入 | 0 引用（`VoiceMicButton` 为活跃替代） | 零 | 彻底删除 |
| C9 | `components/DynamicPricingCard.tsx` | 动态定价卡 | 0 引用 | 零 | 彻底删除 |
| C10 | `components/PeerJuryPanel.tsx` | 陪审团面板 | 0 引用（`lib/peer-jury.ts` 仍被 m11 链消费，不受影响） | 零 | 彻底删除 |
| C11 | `components/WebRTCCallRoom.tsx` | 通话房间 | 0 引用（`lib/webrtc-call.ts` 证据链活跃，UI 未接线） | 零 | 彻底删除 |
| C12 | `components/ConfirmDialog.tsx` | 确认弹窗 | 0 引用（`ui/dialog` 已覆盖） | 零 | 彻底删除 |
| C13 | `components/escrow/encounter-contract-modal.tsx` | 会面合同弹窗 | 0 引用 | 零 | 彻底删除 |
| C14 | `components/ProviderCheckinModal.tsx` | 服务者签到弹窗 | 0 引用 | 零 | 彻底删除 |
| ~~C15~~ | ~~`components/MapComponent.tsx`（Leaflet）~~ | ~~履约地图~~ | ✅ **已收敛归一（2026-08-17）**：履约页迁移 MapLibre `MapView`（focus 锚定 + 单点光晕），`git rm` 物理删除，leaflet/react-leaflet/@types/leaflet 依赖出清 | 无 | 已删除 |
| ~~C16~~ | ~~老控制台 4 件套（`ClientConsole`/`ProviderConsole`/`SwipeableCard`/`GrabConsole`）~~ | ✅ **已收敛归一（2026-08-21）**：4 组件保留于 `src/components/`（`ClientConsole.tsx:1` 调试资金托管/`ProviderConsole.tsx:1` 雷达+接单/`SwipeableCard.tsx:1` 滑动接单/`GrabConsole.tsx:1` 竞抢动效，红线 3 单向依赖）+ 4 路由平移至 `/dp` 协议专区（`src/app/dp/console/page.tsx:1`、`src/app/dp/provider/page.tsx:1`、`src/app/dp/provider/incoming/page.tsx:1`、`src/app/dp/provider/grab/[id]/page.tsx:1` 复用原组件，管理台资产 100% 保留）+ 根路由 `src/app/console/page.tsx:1` 与 `src/app/provider/*:1` 四文件重定向至 `/dp`（307 优雅过渡，命名空间清理）+ `src/components/Header.tsx:26,96` 导航更新至 `/dp/provider/incoming` | 0 | 已收编（`oto` 5 屏 `WorkerWorkbench`/`FulfillmentCockpit` 已接管前台，协议后台归位 `/dp`） |

### 2.3 Step 1-D 批次 1b 页面壳物理出清记录（2026-08-23，commit `d9e64f0`）

> 前置反向引用全量扫描（P0-2 硬闸：sitemap/robots/middleware/next.config/tests/scripts/e2e/全 src 命中面）裁决后执行，**API 血液零触碰**。

| 处置 | 对象 | 说明 |
|------|------|------|
| ✅ 物理删除 | `src/app/{demands,orders,chat,dashboard,finance,evidence,payment,sos,team,user,demo,developer,client,disputes}` 共 **29 文件 / -5404 行** | 整组 Route Segment 出清（page+error+loading+opengraph+私有组件），已被 OTO 五屏取代 |
| ⛔ 白名单豁免 | `modules/m03-category-config`、`m05-geo-index`、`m08-bandit`、`lib/semantic-matcher.ts` | 非死代码：`api/demands/route.ts`(保留血液)→`m06/matcher`→四项传递依赖 + tests 8 文件锁定；留待批次 2 随 demands 弹药化改道一并消化 |
| ⛔ 扫描命中改判保留 | `app/console/`（C16 归编 redirect 垫片）、`app/verification/`（GrabConsole/ProviderConsole 工作流链接） | 不删 |
| 🔧 同批改道 ×7 | `sitemap.ts`（死链×4+demands 动态块）、`robots.ts`（11 行陈旧路径）、`dp/page.tsx`（nav+CTA 5 链→`/dp/console`）、`components/Header.tsx`（桌面/移动 nav+dropdown 死项移除，发布悬赏→`/`）、`app/rights/page.tsx`（dashboard 链→`/`）、`api/auth/wechat/callback`（redirect→`/?auth=open`）、`e2e/production-smoke.spec.ts`（CI 门禁改指存活路由） | 消除指向已删页面的死链与断言 |
| 🆕 新登记孤儿 | `components/SplitDemandView.tsx` | 宿主页面已删 → 0 消费者确认孤儿，内含死链 push("/orders")/push("/dashboard")；推荐彻底删除（随 C 组下一轮出清） |

---

# 板块三：级联工具库与级联路由关联台账（7 项）

> 成对处置铁律：**孤儿路由与其唯一依赖 lib 必须同批处理，拆开处理会导致另一半遗留为二级死代码**。

| # | 级联项 | 类型 | 双向依赖事实（Grep 证据） | 处置要求 |
|---|--------|------|--------------------------|---------|
| L1 | `lib/vision-inspector.ts` | 被孤儿 API 引用的 lib | 全仓唯一 import：`api/ai/inspect-quality/route.ts`（A2）；其自身消费 `m11-evidence-log/evidence-chain`（活跃，保留） | 与 A2 同批删除；删除后 `vision-inspector.ts` 0 引用，一并清 |
| L2 | `lib/ai-negotiator.ts` | 被孤儿 API 引用的 lib | 全仓唯一 import：`api/ai/negotiate/route.ts`（A3） | 与 A3 同批删除 |
| L3 | `lib/intent-radar.ts` | 被孤儿 API 引用的 lib | 全仓唯一 import：`api/demands/predict-intent/route.ts`（A9） | 与 A9 同批删除 |
| L4 | `lib/agent-gateway.ts` | 被孤儿 API 引用的 lib | 全仓唯一 import：`api/v1/agent/protocols/bid/route.ts`（A22） | A22 建议保留（对外契约候选）→ lib 随之保留；若裁决删除则成对删 |
| L5 | `api/disputes/create` | 被死弹窗引用的孤儿 API | 唯一调用方：`components/DisputeModal.tsx`（C4，0 引用组件） | 与 C4 同批删除 |
| L6 | `api/reviews/submit` | 被死弹窗引用的孤儿 API | 唯一调用方：`components/ReviewModal.tsx`（C5，0 引用组件） | 与 C5 同批删除 |
| L7 | `api/llm-classify` | 被死弹窗引用的孤儿 API | 唯一调用方：`components/SmartRequest.tsx`（C6，0 引用组件） | 与 C6 同批删除 |

> 补充保留件（不列入删除批次）：`lib/privacy-guard.ts`（A21 依赖但另有 3 处活跃 route 消费）、`lib/wechat-pay-service.ts`（活跃 5 处）、`lib/webrtc-call.ts`、`lib/alipay-service.ts` —— 均不可随孤儿路由误删。
>
> **批次 3b 出清核销（2026-08-24，commit `6b71efc`）**：原列于本行的 `lib/ai-arbitrator.ts` 与 `lib/peer-jury.ts` 经全仓引用审计后物理出清——前者唯一生产消费方仅剩 export-judicial-package 路由（已改道 Base 司法包装配器），后者为运行时孤儿；「ai-arbitration-card.tsx 活跃消费」记载经实读证伪。

---

# 板块四：协议、模块与页面全景台账

## 4.1 模块全景（`src/modules/`，14 个目录）

| # | 模块目录 | 状态 | 引用凭据 |
|---|---------|------|---------|
| M1 | `modules/m02-auth` | [🟢 在用] | 身份核验（`verify-identity`）；实名链活跃 |
| M2 | `modules/m03-category-config` | [🟢 在用] | 品类配置（`pricing-engine` 被 `api/pricing/estimate` 引用——该路由为孤儿 A18，模块本体保留） |
| M3 | `modules/m04-protocol-generation` | [🟢 在用] | 协议生成引擎 |
| M4 | `modules/m05-geo-index` | [🟢 在用] | geo-service（取代 `api/demands/nearby` A8） |
| M5 | `modules/m06-matching-routing` | [🟢 在用] | matcher（`src/modules/m06-matching-routing/matcher.ts`） |
| M6 | `modules/m07-credit` | [🟢 在用] | credit-engine（被 `api/cron/credit-decay` B3 与 m10-sos 引用） |
| M7 | `modules/m08-bandit` | [🟢 在用] | 多臂老虎机策略 |
| M8 | `modules/m09-content-audit` | [🟡 冗余/0 引用] | `content-audit.ts` 全仓 0 生产引用（仅 `mM02-mM13/index.ts` 镜像登记）；m10-sos 不引用它（m10 仅 import m07/m11）→ 建议删除 |
| M9 | `modules/m10-sos` | [🟢 在用] | `sos-service.ts` 被 `api/sos/trigger`（活跃）引用 → 保留 |
| M10 | `modules/m11-evidence-log` | [🟢 在用] | `evidence-chain` 17 处引用（活跃证据链） |
| M11 | `modules/m12-push` | [🟢 在用] | 推送 |
| M12 | `modules/m13-payment` | [🟡 冗余/0 引用] | `payment-service.ts` 0 生产引用（唯一命中为 `base/money/escrow.ts` 的注释 + 镜像登记）；功能已由 `base/money/escrow.ts` 内联取代 → 建议删除 |
| M13 | `modules/m14-team-formation` | [🟢 在用] | 组队 |
| M14 | `modules/mM02-mM13` | [🟢 保留] | 镜像注册表（纯元数据，微前端拆分占位，0 外部引用但为架构契约资产） |

## 4.2 垂直协议双轨台账（`src/lib/protocol/protocols/` 3 文件 + `src/ammo/` 新轨）

| # | 协议文件 | 状态 | 调用方证据 | 双轨关系 |
|---|---------|------|-----------|---------|
| P1 | `lib/protocol/protocols/base.ts` | [🗑 已出清（2026-08-17）] | ~~唯一 import：`lib/protocol/registry.ts`~~ → registry 内联 `BASE_PROTOCOL_DEF` 作为 ammo 投影继承父级 | 单轨：ammo 唯一事实源，registry 投影视图 |
| P2 | `lib/protocol/protocols/housekeeping.ts`（250 行） | [🗑 已出清（2026-08-17）] | ~~`registry.ts` import~~ → `git rm` 物理删除；registry 从 `OFFICIAL_AMMO.housekeeping` 投影为 `protocol_housekeeping`（旧 id 语义等价） | 单轨：ammo 唯一事实源 |
| P3 | `lib/protocol/protocols/dating.ts`（202 行） | [🗑 已出清（2026-08-17）] | ~~`registry.ts` import~~ → `git rm` 物理删除；registry 从 `OFFICIAL_AMMO.dating`（companion-v1）投影为 `protocol_dating`（旧 id 语义等价，工厂测试锁定 dating→companion-v1） | 单轨：ammo 唯一事实源 |

**关联业务方（registry/engine 链路，收敛重定向的爆炸半径）**：
`api/admin/protocols`（管理）、`api/admin/protocols/[id]`、`api/cron/check-timeouts`、`api/orders/[id]`、`api/reviews`、`lib/contract/satisfaction.ts`、`lib/dispute/resolver.ts`（engine 消费方，7 处）。

**结论**：✅ **已收敛出清（2026-08-17）**——3 个旧协议文件物理删除（合计 535 行），`registry.ts` 重构为 ammo 投影适配器（动态数值全取 ammo 八维配置：D7 分账→佣金、D6 违约阶梯→refundRules、超时代验收→autoTimeoutSeconds、D4 传感→evidence、派单硬门槛→classificationKeywords；静态行业语义合表：角色/资金状态机/评价/争议通道），`protocolRegistry`/`PROTOCOLS`/`getProtocol` 接口签名零变化，7 个业务方 + engine + admin API 零改动；新增 `protocol_meetup`（对齐 meetup-social-v1）。门禁：tsc 0 错 + 1251/1251 全绿（含新增 registry.test.ts 4 例）+ build exit 0 + 收敛门禁 exit 0。

## 4.3 `.gitkeep` 占位文件（3 项）与边缘页面（2 项）

| # | 路径 | 现状 | 处置 |
|---|------|------|------|
| G1 | `src/components/encounter/.gitkeep` | 目录有活跃文件（`queue-adventure-modal.tsx`），占位文件多余 | 清理 `.gitkeep` 文件本身（目录保留） |
| G2 | `src/components/escrow/.gitkeep` | 目录有 2 文件（`checkpoint-timer` 活跃 / `encounter-contract-modal` C13 待删） | 清理 `.gitkeep`（C13 删除后目录仍保留活跃文件） |
| G3 | `src/components/onboarding/.gitkeep` | 目录有活跃文件（`guild-registration-modal.tsx`） | 清理 `.gitkeep` |
| ~~E1~~ | ~~`src/app/rights/page.tsx`~~ | ~~权利公示页（内容完整，非白板）；`href="/rights"` 0 导航入口~~ | ✅ **已收敛闭环（2026-08-21）**：`ProfilePage.tsx:443` 隐私抽屉新增 `⚖️ 消费者权益与平台保障公示` 入口（`Link href="/rights" data-testid="rights-entry" min-h-12` 48px 触控 + 法条文案）+ `rights/page.tsx:112` 顶部 `[‹ 返回主页]` 按钮（`router.push("/") data-testid="rights-back" min-h-12` 高对比度，深浅自适应） |
| ~~E2~~ | ~~`src/app/demo/page.tsx`（165 行）~~ | ~~组件演示页；引用的 MediaPicker/PriceSlider 同时被 SmartProtocolCard（活跃）消费；`href="/demo"` 0 导航入口~~ | ✅ **已收敛闭环（2026-08-21）**：`demo/page.tsx:1` 增加生产环境守卫 `if (process.env.NODE_ENV === "production") notFound()`（`next/navigation` 404 阻断，开发/测试环境保持可用），防止内部调试页泄漏生产 |

---

# 板块五：分批出清路线图与销项清单

> 执行原则：每批独立指令触发；批次内先跑门禁（`tsc --noEmit` + `npm test` + `npm run check:convergence`）再提交；涉及 rename/抽层的批次须按宪法收敛门禁登记 `docs/CONVERGENCE-LOG.md`。**每项出清后在此销项打勾。**

## Batch 0：台账建档（本批，已完成 ✅）
- [x] `docs/DEBT_CLEANUP_REGISTER.md` 全量建档（99 路由 / 126 组件 / 14 模块 / 3 协议 / 级联 7 项）
- [x] `docs/PROJECT_STATUS.md` 同步 LAST_SYNC 与文档索引
- [x] 门禁核验：tsc 0 报错 / 单测全绿 / convergence exit 0 / 0 业务文件改动

## Batch 1：零风险纯垃圾出清（触发：创始人裁决后单发指令）
- [x] A1 `api/llm-test`（自带 "Debug endpoint" 注释，优先级最高）
- [x] A4 `api/ai/push-recommendations`
- [x] A5 `api/category-configs`
- [x] A6 `api/demands/create`
- [x] A7 `api/demands/list`
- [x] A8 `api/demands/nearby`
- [x] A10 `api/demands/[id]/match`
- [x] A11 `api/demands/[id]/tip`
- [x] A12 `api/developer/preference`
- [x] A13 `api/disputes/[id]/arbitrate-ai`
- [x] A14 `api/disputes/[id]`
- [x] A16 `api/orders/accept-delivery`
- [x] A17 `api/orders/submit-delivery`
- [x] A18 `api/pricing/estimate`
- [x] A19 `api/profile/delete`
- [x] A20 `api/provider/withdraw`
- [x] A21 `api/telecom/privacy-number`（保留：创始人裁决清单未列入，lib 活跃，销项为「保留观察」）
- [x] A23 `api/verify/identity`
- [x] A24 `api/protocols`（根）
- [x] A25 `api/protocols/[id]`
- [x] A26 `api/admin/disputes`（无 `/list` 版）

## Batch 2：级联成对出清（触发：Batch 1 后）
- [x] L1 成对：A2 `api/ai/inspect-quality` + `lib/vision-inspector.ts`
- [x] L2 成对：A3 `api/ai/negotiate` + `lib/ai-negotiator.ts`
- [x] L3 成对：A9 `api/demands/predict-intent` + `lib/intent-radar.ts`
- [x] L5 成对：C4 `DisputeModal.tsx` + `api/disputes/create`
- [x] L6 成对：C5 `ReviewModal.tsx` + `api/reviews/submit`
- [x] L7 成对：C6 `SmartRequest.tsx` + `api/llm-classify`
- [x] C1 `RealtimeChat.tsx`
- [x] C2 `NotificationCenter.tsx`（根目录，注意保留 `providers/NotificationProvider`）
- [x] C3 `AIArbitrationCard.tsx`（根目录）
- [x] C7 `OnboardingWizard.tsx`
- [x] C8 `VoiceInput.tsx`
- [x] C9 `DynamicPricingCard.tsx`
- [x] C10 `PeerJuryPanel.tsx`
- [x] C11 `WebRTCCallRoom.tsx`
- [x] C12 `ConfirmDialog.tsx`
- [x] C13 `escrow/encounter-contract-modal.tsx`
- [x] C14 `ProviderCheckinModal.tsx`
- [x] G1-G3 三个 `.gitkeep` 文件清理

## Batch 3：冗余模块出清（触发：Batch 1-2 全部销项后）
- [x] M8 `modules/m09-content-audit/content-audit.ts`（全仓 0 引用确认后删）
- [x] M12 `modules/m13-payment/payment-service.ts`（确认 `base/money/escrow.ts` 无真实 import 后删）
- [x] A15 `api/disputes/resolve`（保留：裁决清单未列入，功能并入 `admin/arbitrate` 评审待续）

> **Batch 1-3 物理出清执行记录（Commit: 本次提交 `40b253e..`）**：创始人裁决后执行，git rm 删除 47 个文件（Batch 1: 20 项 / Batch 2: 21 项 / Batch 3: 2 项 + 4 项测试同步）。`A14 disputes/[id]` 经核实从未存在于文件系统（审计正则误记，无文件可删，销项状态：无需操作）；`A21 telecom/privacy-number` 与 `L4 agent-gateway` 按免死金牌保留。**测试同步清理（17 项断言/文件）**：`tests/m09-audit.test.ts`、`tests/m09-flydan.test.ts` 整文件删除（m09 已删）；`frontier-2026.test.ts` 删 AINegotiator 块（ai-negotiator 已删）；`global-mechanisms.test.ts` 删 tryFastWithdrawal 2 用例（m13 已删）；`p0-deviations.test.ts` 删 demands/create 断言（保留 demands/route 断言）；`world-class-fusion.test.ts` 删 tip/profile-delete 路由断言（保留纯逻辑断言）；`e2e-integration.test.ts` 移除 m13 资金段（hold/complete/settle→credit 链收敛至 escrow 引擎，标题同步更新）。全量门禁：`tsc 0 错` / `vitest 469 + node:test 573 = 1042/1042 全绿`（1061 - 19 失效测试） / `check:convergence exit 0` / 工作区无未追踪垃圾。

## Batch 4：结构级收敛（触发：单独立项，非垃圾清运）
- [x] P1-P3 垂直协议 `lib/protocol/protocols/*` 收敛重定向至 `src/ammo/`（爆炸半径：registry + engine + 7 个业务方；须走宪法收敛门禁）✅ **2026-08-17（P1 攻坚战役步骤二）**：registry.ts 重构为 ammo 投影适配器（三枚官方弹药 → protocol_housekeeping / protocol_meetup / protocol_dating，旧 id 语义等价），3 个旧协议文件 `git rm` 物理删除（535 行出清）+ 空目录清理，PROTOCOLS/getProtocol 契约增补导出，7 业务方零改动
- [x] C15 履约页地图从 Leaflet `MapComponent` 迁移至 MapLibre `MapView` 后废弃 Leaflet 轨（✅ 2026-08-17：迁移 + `git rm` + 三依赖出清，P1 攻坚战役步骤一）
- [x] C16 老控制台 4 件套：`/oto` 5 屏完全接管 `console/provider/incoming/grab` 页面后评估废弃 ✅ **2026-08-21（C16 收编战役）**：4 组件保留于 `src/components/` + 4 路由平移至 `src/app/dp/` 协议专区（`dp/console`/`dp/provider`/`dp/provider/incoming`/`dp/provider/grab/[id]`）+ 根路由四文件 307 重定向至 `/dp`（命名空间清理）+ `Header.tsx` 导航更新至 `/dp/provider/incoming`，管理台资产 100% 保留，红线 3 单向依赖
- [x] E1/E2 补 `/rights`、`/demo` 导航入口或转 dev-only 路由 ✅ **2026-08-21（边缘收口战役）**：E1 `/rights` 隐私抽屉挂载入口 + 返回导航补齐（合规公示 6 项完整）+ E2 `/demo` 生产守卫 `notFound()` 404 隔离，2 项 100% 闭环，门禁 1567/1567 全绿、tsc 0、build exit 0

## 保留观察区（不进任何批次）
- B1-B9 全部基础设施路由（cron ×3 / webhook ×3 / gateway / health / wechat-callback）
- A22 `api/v1/agent/protocols/bid` + L4 `lib/agent-gateway.ts`（对外 Agent 契约候选，等创始人专项裁决）
- M14 `modules/mM02-mM13`（微前端拆分镜像注册）
- M9 `modules/m10-sos`、M10 `modules/m11-evidence-log`、M6 `modules/m07-credit`（活跃资金/证据链）

---

## 附录：本轮审计方法记录（可复现）

1. **路由盘点**：`Get-ChildItem src/app/api -Recurse -Filter route.ts` → 99 条。
2. **引用检索**：全仓 `src/**/*.ts/.tsx`（排除 `app/api` 自身与测试）逐文件 `-Raw` 全文匹配：
   - 静态路由：`[regex]::Escape("/api/<path>")` 精确串；
   - 动态路由：`[id]` 段替换为 `[^/"' ]+` 正则通配（消除 `${id}`/`${demandId}`/`${order.id}` 变量名差异）；
   - 跨行模板字符串：全文 `-Raw` 检索（`fetch(` 换行 + 模板串形态）。
3. **误报剔除**：短名路由（`sse`/`health`/`decompose`/`judge` 等）命中变量名/注释/类型字符串时人工复核（如 `gateway` 仅命中 `base/ai/gateway/*` 引擎文件、`negotiate` 仅命中 `dispute.ts` 纠纷类型）。
4. **基础设施判定**：`vercel.json` crons 配置、支付服务 lib 引用、OAuth 回调语义、运维探活脚本（`restart-prod.mjs`/`verify-prod.mjs`）。

| 2026-08-23 | Step0 | ��������� | $(repo)/src/components/oto-ui/destinations/DestinationHub.tsx + DestinationCard.tsx | [x] ������ɾ��������Ⱦ���+���ⲿ����+�����ײ���ʵ֤�� |
| 2026-08-23 | Step0 | �������ݳ��� | src/types/ammo-schema.ts.bak-* �� 3 ������ .bak | [x] ��������git δ���٣������������� |
| 2026-08-23 | Step1 | ��·�ɳ��� | api/telecom/privacy-number(A21) + api/disputes/resolve(A15) + api/v1/agent/protocols/bid(A22) | [x] ������ɾ���������������ߣ�A19 �Ѹ����޳���A1-A17/A20/A23 ��ʷս�����壩 |
| 2026-08-23 | Step1 | �¶�ģ����� | modules/mM02-mM13 + m02-auth + m04-protocol-generation + m12-push | [x] ����������ɾ����m03/m05/m08 Ϊ m06/m07 ѪҺ������ |
| 2026-08-23 | Step1 | �����¶� lib | lib/agent-gateway.ts + lib/mockData.ts | [x] ��ɾ����destFilter ˫�ļ��ȸĵ� types/ammo�� |
| 2026-08-23 | Step1 | �������������� | tests/{m02-auth,m04-protocol-gen,m12-concurrent-grab,m12-push,p2-integration,e2e-integration}.test.ts + p0 MemoryLockProvider �� | [x] ������������ 1623��1589 ��Ԥ������ |