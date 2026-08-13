# ADR-0017: 组织者把关层（Request to spot）— Meetup 吸收项 ①

日期：2026-08-13
状态：Accepted（对标 oto-competitor-matrix §五 吸收项 ①落地）

## 六圈定位声明
- 所属圈：第二圈 · 业务核心（组局拼位）
- 所属模块：开放局拼位（`base/order/wave`）
- 复用底座：`base/order/wave.ts`（joinSeat/neededJoiners/perSeatPrice 状态机）、`base/trust` 治理（审批后走既有拼位 → 押金 → fulfilment 链路）、`base/platform/toast`
- 弹药表：无需新增（`needApproval` 是开放局通用开关，非类目专属；弹药化已在 risk-rule 层面覆盖高危类目）

## 宪法条文对照
- 命中条文：**#2 接口保守、火力激进**（不扩 ClaimStatus 状态机枚举，用 Wave 级 `joinRequests` 字段承载申请态，状态机只增补不改义）、**#6 信任数据是瞄准镜**（审批可参考申请者信用，复用既有信用评分；占座后仍走鸽子险/验收全链路）、**#1 底座优先**（拼位核心逻辑进 base/order/wave 纯函数，store/UI 薄接线）
- 偏离条文：无

## Context

对标 Meetup 成员审批（Request to join / organizer 逐批）+ Playtomic Request a spot（等级不符先申请等全员批准），用户 2026-08-13 拍板吸收进 backlog（★优先）。目标：开放局发起人可开「审批制」，响应者先申请、发起人批准才占座付费，解决「自动加入导致陌生人直接进局」的信任缺口。

## Decision

### Wave 层（`base/order/wave.ts` 纯函数）
- `Wave.needApproval?: boolean`：true = 审批制开放局。
- `Wave.joinRequests?: Array<{ responderId; at }>`：待审批申请列表（幂等，不占座、不付钱）。
- `requestSeat(wave, responderId)`：提交申请（未开启审批抛错；重复申请幂等返回）。
- `approveRequest(wave, responderId, claimId, joinedCount)`：批准 → 复用 `joinSeat` 占座（满员即成局），并清除该申请；满员/非 active 返回 `wave.full` 并清申请。
- `rejectRequest(wave, responderId)`：拒绝 → 仅移除申请。

### Store 层（`useWaveStore.ts`）
- `joinSeat`：`needApproval` 局直接拼位返回 `approval-required`（必须走申请）。
- `requestSeat`：入 `joinRequests`（幂等）。
- `decideRequest({waveId, responderId, approve})`：approve → 走 `approveRequestLogic` 占座 + 支付落流水 + 满员锁 claims + 裂变；reject → 仅清申请。

### UI 层
- `WaveCard`：审批局显示「申请加入」（未申请）/「待发起人审批」（已申请，disabled）；进度条显示「待审批 N」。
- `WaveFeed`：申请按钮 → `requestSeat` + toast；审批局不再弹 PaySheet（未批准不占座）。
- `MyWaves`：发起人审批面板（待审批列表 + 批准/拒绝按钮）。
- `PublishSheet`：开放局（≥2 人）可勾选「需我审批加入」。

## Consequences
- 单测 +5（wave.test.ts：requestSeat 幂等/未开启拒绝、approveRequest 占座成局/未申请拒绝/满员清申请、rejectRequest 无副作用）→ 381 → **387 全绿**；tsc/lint/build 0 错。
- 信任链路不变：审批通过后占座即付、满员成局、鸽子险/验收/互评全复用。
- 后续：审批时展示申请者信用/出勤（复用 violation 数据，与吸收项 ④ organer 出勤档案联动）、waitlist 候补（吸收项 ②）。
