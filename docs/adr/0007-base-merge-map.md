# ADR-0007: 万能底座融合执行手册 v2（web ↔ base ↔ ammo ↔ mobile）

日期：2026-08-13（v2 重写；v1 = 映射表 + 粗步骤，已执行完毕）
状态：Accepted（作为融合期唯一执行手册；执行与验收严格按 §3 Phase 0-5 推进）

> **宪法声明**：本 ADR 派生自 `docs/DESIGN_CONSTITUTION.md`（条文 #1 底座优先、#2 接口保守、
> #3 先配表后写码、#4 弹药可插拔、#5 引信跟弹药走）。
> 本手册每一阶段的验收标准都附带「宪法对照」，执行即验收、验收即收敛。

---

## §0 范围与边界（先划死，防发散）

**本手册只管一件事**：把本地两项目（web `oto-spatial-web` + RN `mobile`）的现状
收敛为「base/ 发射管 + ammo/ 弹药表」形态，并兑现 C1-C5 接口契约，端到端验收全绿。

**不在本手册范围（只记录、不做，见 §5 缺口清单）**：

| 缺口 | 说明 |
|------|------|
| 🔴 虚拟号/隐私号中枢 | 圈② IM 模块（mobile 也未做） |
| 🔴 AIGC 伪造鉴真 | 圈③ |
| 🔴 智能争议小法官（LLM 定责） | 圈③（现有 dispute 仅状态机） |
| 🔴 自然语言 BI | 圈③ |
| 🔴 电子签章 / 保险对接 | 圈④ 生态网关 |
| 🔴 极端危机干预协议 | 圈⑤（SOS 屏仅在 mobile 是壳） |
| 🔴 智能运力熔断 / 供需杠杆 | 圈⑥ |
| 🔴 多云多活 / 数据湖 / 哈希存证 | 圈⑥ |

这些已立项单列，不在 Phase 0-5 内执行；执行途中新发现的缺口 → 追加进 §5，不发散。

---

## §1 现状基线（盘点 diff，2026-08-13 实测钉死）

### 1.1 已完成（v1 执行结果，验收过）

- `src/base/` 九域 100 文件已 git mv 归位（money 11 / trust 12 / order 10 / dispatch 4 /
  risk 6 / geo 8 / notify 4 / platform 22 / ai 23），调用方 import 全改，测试路径同步。
- `src/ammo/` 已建：scene-template / pricing-formula / dispatch-rule / risk-rule / prefs + index。
- 单测 303 全绿 · tsc/lint 0 错 · build 通过 · 浏览器冒烟无错。

### 1.2 契约兑现 diff（v1 与 C1-C5 的差距 —— 本手册要消灭的清单）

| # | 契约要求 | 现状实测 | 处置 |
|---|----------|----------|------|
| G1 | C1：wave 泛化抽 `OrderCore`，业务字段（capacity/buffSeats/fission*）走弹药 ext | `base/order/wave.ts` 仍是需求局业务接口（capacity/buffSeats/fission* 直挂） | **Phase 1** |
| G2 | §一 目标形态：`ammo/sop.ts`（鸽子险/有效期/容量默认值） | 不存在（只有 4 表 + prefs） | **Phase 2** |
| G3 | C4：`hardGates: { requiresVerified?, banned?, online? }` 结构化 | `dispatch-rule.ts` 用顶层 `requiresVerified` 直写，无 banned/online | **Phase 2** |
| G4 | §二 映射：`chat/` → base/notify | `lib/chat/` 9 文件仍在原地 | **已裁决为映射修正**（见 §1.3） |
| G5 | §三：mobile 侧归属（api.ts→弹药、location.ts→base/geo、types→弹药类型、DynamicForm→动态表单雏形） | mobile/src 全原地未动 | **Phase 4** |

### 1.3 映射修正（v1 执行中的一次有意偏离，现正式裁决）

- **chat/ 映射修正**：原映射「chat/ → base/notify」改为「保留业务侧 `lib/chat/`」。
  理由：chat engine 引用 `useAppStore`（业务 store），搬入 base 会引入 base → store 反向
  依赖，污染共享层；IM 真正归位应等「隐私号 + IM 中枢」独立立项（§0 🔴）时一并设计
  （宪法 #2 接口保守：IM 协议语义一旦定义不可改，值得单独立项设计而不是力学搬迁）。
  此修正不纠结于力学搬迁，符合宪法意图。已讨论、用户认可。

### 1.4 mobile 侧现状登记（Phase 4 落地，只登记不迁码）

mobile（RN Expo，`mobile/`）当前为独立家政演示壳，尚未接 base。按 v1 §三映射登记：

| mobile 文件 | 契约归属登记 | 状态 |
|-------------|--------------|------|
| `src/utils/location.ts` | → base/geo 的 **RN 适配层候选**（expo-location 封装，职责=地理能力，抽契约后与 web geo.ts 共用接口） | 登记为缺口 N16，代码融合单独排期 |
| `src/services/api.ts` | **弹药实例（家政）**——纯 mock，待接 base 后端/共享契约；服务端就绪后按「弹药属性表」接入 | 登记，代码不动 |
| `src/types/index.ts`（OrderItem/User 等） | **弹药类型（家政订单）**——钉在实际订单字段，底座通用骨架走 C1 OrderCore | 登记，代码不动 |
| `src/components/DynamicForm.tsx` | 圈① 动态表单**雏形反哺源**（web 通用化时参考心智模型） | 登记为缺口 N2 |
| 其余 screens/components | 弹药 UI（家政专属） | 登记，代码不动 |

mobile tsc 存在存量依赖错误（`@react-native-community/slider` 缺声明）—— 与本手册无关，
属 mobile 工程自身问题，单独排期，不挡融合主线。

---

## §2 接口契约（v1 定稿保留，G3 对齐后为终版）

### C1 通用订单状态机（base/order）— Phase 1 兑现
```ts
type OrderStatus =
  | "pending" | "matched" | "locked" | "assembled"
  | "fulfilling" | "reviewing" | "settled" | "cancelled" | "expired";
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
// 业务扩展 = 弹药：业务字段走 sealed `ext` 蒙层，底座不感知
```

### C2 统一账本分录（base/money）— 已兑现
```ts
type LedgerKind = "penalty" | "payout" | "deposit" | "commission" | "subscription" | "income";
// 新增业务分录 → 扩展枚举（向后兼容）
```

### C3 计价公式 schema（base/money / ammo 表）— 已兑现
```ts
type PricingFormula = {
  baseRateYuan?: number; hourRates?: Record<number, number>;
  multipliers?: Record<string, number>; distanceFeePerKm?: number;
  timeFactors?: Record<"normal"|"peak"|"urgent", number>;
  minPriceYuan?: number;
};
```

### C4 分发权重表（ammo/dispatch-rule）— Phase 2 对齐终版
```ts
type DispatchRule = {
  weights: { distance: number; credit: number; custom: number; verifiedBonus: number };
  hardGates: { requiresVerified?: string[]; banned?: boolean; online?: boolean };
  starBonus?: { starMin: number; completionMin: number; bonus: number };
};
```

### C5 风控引信表（ammo/risk-rule）— 已兑现
```ts
type RiskRule = { rule: string; enabled: boolean; params?: Record<string, number|string|boolean> };
```

---

## §3 执行阶段（唯一入口，每阶段验收全绿才进入下一阶段）

| Phase | 目标 | 动作 | 验收 | 宪法对照 |
|-------|------|------|------|----------|
| **0** | 冻结基线 | 跑全量 tsc / 单测 303 / lint 快照 | tsc 0 错 · 单测 303 绿 · lint 0 error | （基线，无条文） |
| **1** | C1 兑现 | `wave.ts` 抽 `OrderCore`（见 §2 C1）；业务字段（capacity/buffSeats/fission*）经 `ext` 蒙层保留于 Wave；既有 22 调用方/测试全部改型 | tsc 0 错 · 新增 OrderCore 单测 · 既有 wave 单测全绿 | #2 接口保守（只加抽象不改语义）、#1 底座优先 |
| **2** | ammo 补表 | 新建 `ammo/sop.ts`（类目 → 鸽子险/有效期/容量默认值）；`dispatch-rule.ts` 对齐 C4 `hardGates` 结构；ammo.test 扩展 | tsc 0 错 · ammo.test 全绿 · 单测 303+ 绿 | #3 先配表后写码、#5 引信跟弹药走 |
| **3** | 弹药端到端 | 用 ammo 表驱动一次性输出「新类目」验证：pricing/dispatch/risk/sop 四表填家政新类目 → 从 ammo/test 断言新类目配置可被 base 引擎消费 | 新类目四表读全 · base 引擎消费测试绿 · 无任何 base 代码修改 | #4 弹药可插拔（填表即新业务）、#3 |
| **4** | mobile 归属 | 按 §三 v1 映射执行：`mobile/src/utils/location.ts` → 抽 base/geo 契约（RN 适配候选，不物理搬代码，只登记适配接口）；`services/api.ts` 登记为「弹药实例（家政）」；`types/index.ts` 登记为弹药类型；DynamicForm 反哺动态表单需求进 §5 缺口清单 | 映射表登记完成 · mobile 编译不受影响（Expo tsc 快照） | #1 底座优先（mobile 侧先归位登记，代码融合单独排期） |
| **5** | 总验收 | §4 总验收清单全跑；更新 `docs/PROJECT_STATUS.md` LAST_SYNC | 单测/tsc/lint/build/浏览器冒烟全绿 | 全条文收口 |

**铁律**（沿用 v1 Consequences）：搬代码阶段禁止顺手重构逻辑；每个结构性改动收敛一处历史遗留并标注「宪法收敛：条文 #n」；执行中发现的缺口只进 §5，不中途展开。

---

## §4 总验收清单（Phase 5 运行完毕）

> 验收日期：2026-08-13（ADR-0007 v2 发布执行；Phase 0-5 全部通过）

- [x] `npx tsc --noEmit` → 0 错
- [x] `npm run test:units` → **314 全绿**（基线 303 + orderCore 5 + e2e-ammo 5 + sop 1）
- [x] `npx eslint` → 0 error（8 warnings 存量）
- [x] `npm run build` → 成功，API 路由齐全（含 /api/gateway /api/tts /api/voice-intent）
- [x] 浏览器冒烟：首页渲染 + 雷达/发布/竞价主链路正常，0 console error
- [x] C1-C5 契约全部有落地文件：C1 `base/order/orderCore.ts`（新增）、C2 `base/money/ledger.ts`、
      C3 `ammo/pricing-formula.ts`、C4 `ammo/dispatch-rule.ts`（hardGates 已对齐）、C5 `ammo/risk-rule.ts`
- [x] `ammo/sop.ts` 补建完成（§五 G2 关闭）
- [x] §5 缺口清单为最终盘点（新增 N2/N15/N16 已入列）
- [x] `docs/PROJECT_STATUS.md` LAST_SYNC 行 + 达成表更新（见下文）

---

## §5 缺口清单（本轮不执行，后续立项）

> 新增发现一律追加此表；项目按宪法 §1「先定位六圈再立项」逐项排期（A 轮前优先
> 第三圈 + 第五圈：AIGC 鉴真 / 智能小法官 / 反欺诈探针）。

| # | 缺口 | 所属圈 | 来源 |
|---|------|--------|------|
| N1 | 虚拟号/隐私号中枢（双向） | ② | 0006 映射 |
| N2 | 动态表单渲染引擎通用化（web 侧反哺自 mobile DynamicForm） | ① | 0006 + **Phase 4 新增** |
| N3 | 语义向量匹配推荐 | ③ | 0006 映射 |
| N4 | AIGC 伪造鉴真 | ③ | 0006 映射 |
| N5 | ~~智能争议小法官（LLM 定责）~~ | ③ | ~~0006 映射~~ ✅ **已关闭（2026-08-13，ADR-0008）** |
| N6 | 自然语言 BI | ③ | 0006 映射 |
| N7 | 电子签章 / 保险对接 | ④ | 0006 映射 |
| N8 | 极端危机干预协议（web 侧；SOS 壳在 mobile） | ⑤ | 0006 映射 |
| N9 | ~~多因子反欺诈探针（设备指纹/GPS 欺骗）~~ | ⑤ | ~~0006 映射~~ ✅ **已关闭（2026-08-13，ADR-0009）** |
| N10 | 数据全生命周期脱敏 / 遗忘权统一 | ⑤ | 0006 映射 |
| N11 | 弱网离线队列 | ⑥ | 0006 映射 |
| N12 | 智能运力熔断 / 供需杠杆 | ⑥ | 0006 映射 |
| N13 | 多云多活 / 优雅降级四部曲 | ⑥ | 0006 映射 |
| N14 | 数据湖 / AB 平台 / 哈希存证 | ⑥ | 0006 映射 |
| N15 | IM 中枢独立立项（chat/ 归位设计，含隐私号联动） | ② | **§1.3 映射修正** |
| N16 | base/geo 的 RN 适配层（mobile location.ts 接入） | ① | **Phase 4** |

---

## Consequences

- **执行状态：v2 已执行完毕（2026-08-13），C1-C5 契约全部兑现**，
  结果记录见 §4 总验收清单；融合主线以此收口。
- 本手册是融合期唯一执行入口：任何人（含 agent）推进融合只认 Phase 0-5 与两条铁律。
- 每 Phase 完成即更新 `docs/PROJECT_STATUS.md`（目录落位 + 单测计数双指标）。
- C1-C5 契约存在即争议裁决依据：改契约 = 走宪法 §3 冲突上报，由用户拍板。
- v1 已执行的映射与搬迁不返工；v2 从 G1-G5 的差距处继续（已全部兑现）。