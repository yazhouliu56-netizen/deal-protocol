# ADR-0007: 万能底座融合映射表（web ↔ base ↔ 弹药）
日期：2026-08-13
状态：Accepted（作为 ADR-0006 融合期第一阶段执行地图；代码归位单独排期）

> **宪法声明**：本 ADR 派生自 `docs/DESIGN_CONSTITUTION.md`（条文 #3 先配表后写码、
> #4 弹药可插拔、#5 引信跟弹药走）——本文的 base/ammo 切割即宪法这三条的落地执行图。

## Context

ADR-0006 定稿六层防御圈蓝图，融合顺序为「先定接口再搬代码」。
本 ADR 落地第一阶段产出：**全量文件归属映射表 + 第一批接口契约定义**，
作为 `base/`（发射管）与「弹药属性表」（业务配置）的切割依据。

## Decision

### 一、目标目录形态

```
src/base/             ← 发射管（共享层，web/mobile 两端复用，禁止业务字段）
  order/              ← 状态机（发布→匹配→履约→验收→结算）
  money/              ← 统一清结算（账本/支付/保证金/竞价/计价公式）
  dispatch/           ← 双模分发（派单/抢单打分）
  trust/              ← 双向信用（评级/信任/星级/评价/违规/关系）
  ai/                 ← LLM 神经（gateway 多 Provider + 语义/拆解/诊断/语音）
  risk/               ← 可插拔风控（防自刷/多开/治理，规则表驱动）
  geo/                ← LBS 时空（geo/map/热度）
  notify/             ← IM 与通知中枢
  platform/           ← 生存基建（SSR 安全/降级/快照/p2p transport）
src/ammo/             ← 弹药属性表（每类目一行配置，前端按配置渲染）
  scene-template.ts   ← 类目 → AR/表单场景模板
  pricing-formula.ts  ← 类目 → 计价公式与费率
  dispatch-rule.ts    ← 类目 → 分发权重
  risk-rule.ts        ← 类目 → 风控勾选（引信表）
  sop.ts              ← 类目 → SOP 参数（鸽子险/有效期/容量默认值）
```

### 二、web 侧 `src/lib/` 83 个文件归属

| 文件 | 归属 | 依据 |
|------|------|------|
| `wave.ts` | → base/order（接口需泛化） | Wave 接口含需求局业务字段（capacity/buffSeats/fission*），抽 `OrderCore` 泛化骨架 |
| `booking.ts` | → base/order | 预约状态机，业务无关 |
| `fulfilment.ts` | → base/order | 履约确认状态机 |
| `moduleFulfilment.ts` | → base/order | 复杂任务模块履约 |
| `dispute.ts` | → base/order | 争议状态机/证据链 |
| `ledger.ts` | → base/money（✅ 已通用，原样搬） | applyLedger/makeLedgerEntry 无业务字段 |
| `pay.ts` | → base/money | 支付网关壳 |
| `deposit.ts` | → base/money | 鸽子险保证金 |
| `bidding.ts` | → base/money（佣金率参数化） | COMMISSION_RATE/MIN_FEE_YUAN 常量 → 弹药配置 |
| `customPricing.ts` | → base/money（公式 schema 化） | 计价公式 → 可配公式引擎输入 |
| `organizerSubscription.ts` | → base/money | 订阅状态机 |
| `match.ts` | → base/dispatch | 派单打分 |
| `broadcast.ts` | → base/dispatch（权重弹药化） | DISTANCE/CREDIT/CUSTOM_WEIGHT 常量 → 分发规则表 |
| `reputation.ts` | → base/trust | 五维评级 |
| `trust.ts` | → base/trust | 信任闭环（成团退款/取消分级/no-show） |
| `starRank.ts` | → base/trust | 星级/完成率 |
| `review.ts` | → base/trust | 评价（3 维 + 72h 窗 + 默认好评） |
| `violation.ts` | → base/trust | 违规扣分 |
| `friends.ts` | → base/trust | 关系沉淀状态机 |
| `cluster.ts` | → base/ai | LLM 聚类（已薄层化） |
| `decompose.ts` | → base/ai | 任务拆解（已薄层化） |
| `diagnostic.ts` | → base/ai | AI 主动诊断 |
| `gateway/` | → base/ai | 多 Provider 网关（ADR-0005） |
| `voice/` | → base/ai | 语音意图/ASR/TTS/取证 |
| `fission.ts` | → base/risk | 防自刷计数 |
| `roamGuard.ts` | → base/risk | 多开风控矩阵 |
| `moderation.ts` | → base/risk | 内容治理/下架 |
| `geo.ts` | → base/geo | Haversine/排序/兜底坐标 |
| `mapConfig.ts` | → base/geo | 地图 tier/点数据 |
| `mapPref.ts` | → base/geo | 地图偏好持久化 |
| `destFilter.ts` | → base/geo | 目的地筛选 |
| `systemNotify.ts` | → base/notify | 五类事件 diff |
| `notify.ts` | → base/notify | 通知聚合中心 |
| `chat/` | → base/notify | 即时通讯 |
| `clientFlags.ts` | → base/platform | useSyncExternalStore SSR 安全 |
| `readKeys.ts` | → base/platform | 已读集合外部 store |
| `performance.ts` | → base/platform | 低配降级 |
| `snapshot.ts` | → base/platform | 数据导出/导入 |
| `p2p/` | → base/platform | 跨 tab transport |
| `avatar.ts` | → base/platform | 头像压缩 |
| `toast.ts` | → base/platform | 全局 toast |
| `sceneTemplate.ts` | → ammo/scene-template（样板） | 类目→模板映射，正是弹药属性表形态 |
| `prefs.ts` | → ammo（撮合偏好四维池属业务配置） | 半径/预算/水平/时间 |
| `mockData.ts` | 保留业务侧（演示数据） | 需求局专属 |
| `mockResponders.ts` | 保留业务侧（演示数据） | 需求局专属 |
| `dial.ts` | 保留（拨号壳，待虚拟号设计） | 圈② 隐私号未做 |
| `qr.test.ts`/`scan.ts` | 保留业务侧 | 扫码为需求局裂变入口 |
| 其余 `*.test.ts` | 跟随源码迁移 | — |

### 三、mobile 侧归属

| 文件 | 归属 | 依据 |
|------|------|------|
| `src/services/api.ts` | 弹药实例（家政） | 纯 mock，待接 base 后端/共享契约 |
| `src/utils/location.ts` | → base/geo（RN 适配候选） | 位置工具 |
| `src/types/index.ts` | 弹药类型（家政订单） | OrderItem 家政字段 |
| `src/components/DynamicForm.tsx` | 弹药 UI（圈① 动态表单雏形参考） | 家政表单，web 可反哺通用化 |
| 其余 screens/components | 弹药 UI | 家政专属 |

### 四、第一批接口契约定义（先定接口再搬代码）

**C1 通用订单状态机（base/order）** — 从 Wave 抽象：
```ts
type OrderStatus =
  | "pending"    // 待接（已发布）
  | "matched"    // 已匹配（单对单 claimed / 组局 partial）
  | "locked"     // 锁定（磋商关闭，不可再抢）
  | "assembled"  // 成局（容量满，仅组局）
  | "fulfilling" // 履约中
  | "reviewing"  // 验收/评价窗
  | "settled"    // 结算完成
  | "cancelled" | "expired";
type OrderCore = {
  id: string; ownerId: string;
  status: OrderStatus;
  amountYuan: number;
  capacity: number;              // 1 = 单对单
  slotIds?: string[];            // 组局占位
  startsAt?: number; expiresAt: number;
  createdAt: number; lockedAt?: number;
  settledAt?: number;
};
// 业务扩展 = 弹药：ammo 字段通过 sealed `ext` 挂载，底座不感知
```

**C2 统一账本分录（base/money）** — 现状已通用，直接沉淀：
```ts
type LedgerKind =
  | "penalty" | "payout" | "deposit"
  | "commission" | "subscription" | "income";   // 新增业务分录 → 扩展枚举（向后兼容）
// applyLedger / makeLedgerEntry 原样进 base
```

**C3 计价公式 schema（base/money）** — customPricing 参数化：
```ts
type PricingFormula = {
  baseRateYuan?: number;          // 起步价
  hourlyRates?: Record<number, number>;   // 城市档 → 时薪
  multipliers?: Record<string, number>;   // 复杂度因子
  distanceFeePerKm?: number;      // 距离费
  timeFactors?: Record<"normal"|"peak"|"urgent", number>;
  minPriceYuan?: number;          // 地板价
};
// 弹药表每类目一行：pricingFormula + warrantyText
```

**C4 分发权重表（base/dispatch）** — broadcast/match 常量弹药化：
```ts
type DispatchRule = {
  weights: { distance: number; credit: number; custom: number; verifiedBonus: number };
  hardGates: { requiresVerified?: string[]; banned?: boolean; online?: boolean };
  starBonus?: { starMin: number; completionMin: number; bonus: number };
};
```

**C5 风控引信表（base/risk）** — 勾选即生效：
```ts
type RiskRule = {
  rule: "anti-self-boost" | "roam-guard" | "home-access-verification" | string;
  enabled: boolean;
  params?: Record<string, number | string | boolean>;   // e.g. roam threshold=3
};
```

### 五、迁移顺序（每步可验证）

1. 建 `src/base/` 空目录 + 目录级 `index.ts` 空壳（tsc 绿）
2. **base/money**（ledger/pay/deposit/bidding/customPricing 原样搬 + 改 import）→ 单测绿
3. **base/trust**（reputation/trust/starRank/review/violation/friends）→ 单测绿
4. **base/order**（wave 泛化抽 `OrderCore`，业务字段留弹药层）→ 单测绿
5. **base/dispatch + base/risk + base/geo + base/notify + base/platform + base/ai** 分批归位
6. `ammo/` 弹药属性表首例（scene-template + pricing-formula + dispatch-rule + risk-rule）→ 端到端验证「填配置即出新类目」

## Consequences

- 融合期进度按「目录落位 + 单测绿」双指标记入 `docs/PROJECT_STATUS.md`。
- 搬代码阶段禁止顺手重构逻辑：先原样搬 + 改 import，接口泛化单独排期（避免一次动刀两个变量）。
- 🔴 未实现模块（虚拟号/鉴真/小法官 LLM/BI/签章/危机协议/运力熔断/数据湖）不进本轮，立项单列。
