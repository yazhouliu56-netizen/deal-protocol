# ADR-0022: 强制守护 Watchdog 接线（signal-watchdog 纯核 → 上传/双可见/电池/报平安）
日期：2026-09-27
状态：Accepted（用户拍板：强制守护无便捷开关；技术性中断才有定义响应）

> **宪法声明（强制字段，见 docs/DESIGN_CONSTITUTION.md §3/§4）**

## 六圈定位声明
- 所属圈：第⑤圈（安全风控）
- 所属模块：safe（见面守护；与 crisis-tracker/SOS 同圈，不碰资金链）
- 复用底座：base/safe 的 `signal-watchdog.evaluateGuardSignal`（LIVE/DEGRADED/LOST/TAMPER）+ `meetup-guard.evaluateMeetupArming`（武装等级既有装配，见 assign 路由）；持久化走既有 `getServiceClient` 服务端权威写
- 弹药表：无新增/修改（无业务字段写死；武装等级由弹药 supplyCluster 驱动，既有链路不变）

## 宪法条文对照
- 命中条文：#1（纯核已在底座，本次只做接线，不新造引擎）；#5（武装等级跟弹药走，watchdog 不写死业务阈值——10min/15min 为技术复连窗非常业务字段）；#10（GPS 缺席/拒授权/断网全有降级：手动报平安 + 静默失败不挡主流程）；#9（玩家旅程：履约中双方 → 实时守护可见 → 报平安成长闭环 → 复访信任）
- #7 LLM 介入点评估：**不接入**。安全与资金决策落在确定性纯函数（与仲裁 EASY/议会链同原则），LLM 只做辅助建议，watchdog 链路无 LLM 调用点
- #8 隐私：breadcrumb 仅履约双方经 API 可见（service-only 表，RLS 零 policy，与 disputes 同制）；坐标服务端截断至 4 位小数（~11m）；对方可见截断坐标 + 状态 + 失联时长，不暴露原始精度；保留期随订单终局清理（follow-up，不在本批）
- 偏离条文：无（§3 上报：无）
- 宪法收敛：本变更为新接线，无顺带重构（rename 零触碰）

## Context

`signal-watchdog` 纯核（10min 复连窗/15min 丢失线/TAMPER 即时标记）与 `meetup-guard` 武装判定（首单/夜单/入户三选一 ENHANCED）均已存在且有考卷，但零接线：无上传、无双端可见、无电池上下文、无报平安。`assign` 路由仅在接单瞬间计算武装并发安全包通知，履约过程信号黑箱。

## Decision

1. **上传**：`POST /api/guard/breadcrumb`（withAuth + 双方成员校验 + 服务端坐标截断 + service client 落 `guard_breadcrumbs` append-only 表）；客户端 `useGuardWatch` 以 60s 节拍上传（watchPosition 优先，拒授权/无 GPS 退手动模式）
2. **双可见**：`GET /api/guard/state?demandId=` 返回双方最新信号经纯核评估（self + peer）；`GuardStrip` 同时挂载服务者履约视图（OrderFulfillmentClient）与需求方座舱（FulfillmentCockpit）
3. **电池**：`navigator.getBattery` 上下文随包上报（低电量只做缺口解释，不降级不判案）；低电量时横幅充电提醒
4. **报平安（check-in enforcement）**：DEGRADED 或手动模式下强制露出「报平安」按钮，同接口 `{checkin:true}` 无坐标重置 lastSeen；无便捷开关（用户裁决）
5. **失败语义**：上传/拉取失败静默（#10），UI 保最后已知状态；TAMPER 即时标记 + 通知对方（复用既有 notifications safety 通道最佳努力）

## Alternatives Rejected

- 复用 `evidence_log` 存面包屑：否决。evidence_log 以 orders/protocol 为键且 SELECT 全开，不满足双方-only 可见与 demands 键；新表 RLS 零 policy 更干净
- 客户端直写 Supabase：否决。坐标截断与成员校验必须服务端权威（SOS/assign 同制，service client）
- WebSocket 实时推送：否决。60s 轮询满足 10min 窗口语义，零新基建（#10 单点依赖）

## Consequences

- 新增：`supabase/migrations/20260927_guard_breadcrumbs.sql`（云 DDL 需 SQL Editor 手工执行，CI 不跑 DDL）、`src/app/api/guard/breadcrumb/route.ts` + `route.test.ts`、`src/app/api/guard/state/route.ts` + `route.test.ts`、`src/hooks/useGuardWatch.ts`、`src/components/guard/GuardStrip.tsx` + `GuardStrip.test.tsx`、2 处挂载
- follow-up：订单终局后面包屑清理任务；TAMPER/LOST 进 crisis 升级链（当前仅通知）
- 门禁：T2（`npm run check` 全绿 + `build` + `verify-scoped e2e-fulfil` 无回归）
