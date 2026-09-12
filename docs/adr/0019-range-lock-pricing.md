# ADR-0019: 非标定价「区间锁价 + 检测费预冻结」

日期：2026-09-12
状态：Proposed

> **宪法声明（强制字段，见 docs/DESIGN_CONSTITUTION.md §3/§4）**
> 本 ADR 派生自宪法 #2（接口保守）#3（先配表后写码）#10（降级）及 §6.3 #7 替代（成本与延迟护栏）。

## 六圈定位声明
- 所属圈：第 ② 圈（业务核心）＋ 第 ③ 圈（AI 神经，区间预估旁路）
- 所属模块：L2 订单状态机 / L2 托管分账（milestone-escrow）
- 复用底座：`base/order`（intent-card 四态：assembling/ready/locked/stale）、`base/money`（milestone-escrow 预冻结/多退少补/退款）、`base/ai/chat`（publish/interpret 多模态意图：文本走 gateway、照片走 vision）
- 弹药表：`ammo/<品类>.ammo.ts` 新增 `pricing` 配置（基础费/人工分级/配件库版本）＋ `quote_bands` 区间规则；无该品类 pricing 配置时定损单拒绝创建

## 宪法条文对照
- 命中条文：#2（只增补 DIAGNOSED/QUOTE_CONFIRMED 节点与区间字段，不改既有状态机语义）、#3（先配表后写码）、#4（价格单位/人工分级/配件价全表驱动，禁写死）、#10（LLM 预估超时失败回落师傅上门定损；配件库缺项转人工核价）、§6.3 #7 替代（计价主链路确定性纯代码毫秒级；LLM 仅旁路建议，阻塞链 1.5s 内降级）
- 偏离条文：无
- 宪法收敛：无（纯加法）

## Context

上门维修类"一单一议"天然非标：用户说不清故障（"油烟机轰轰响"），师傅上门自由裁量，315 曝光的啄木鸟乱象（小病大修、中途加价、不提前报价）即源于**定价权在师傅手里**。行业已跑通的解法是三层：AI 问价（下单前区间预估）→ 先报价后维修（强制确认卡点）→ 系统定价（配件库锁死加价空间），并有 `T/ACCEM 666-2025` 团体标准背书。

本地现状：IntentCard 已有 `locked/ready/stale` 四态与发射冻结；`generateProtocolSchema` 已预留 `budget_range: [min, max]`；milestone-escrow 支持多退少补；publish/interpret 照片 vision 链路已通。缺的是：① 单值价格 → 区间 + 分支的确诊闭环；② 检测费"不修也扣"的预冻结与明示；③ LLM 预估与结算字段的硬隔离。

## Decision

### 一、价格形态：单值 → 区间 + 确诊分支
- `IntentCard.price` 扩展为 `{ floor, ceiling, branches[] }`，UI 四态机不动（locked 态展示"已锁 ¥x（A 方案）"）。
- LLM（文本/照片/短视频）输出只写 `quote_advice`（建议层字段），**永远不得写入结算字段**；结算字段只接受定损单确认值。
- 概率（如 80% 电容 / 20% 电机）只进派单策略（备件、派什么级别师傅），不进价格承诺。

### 二、上门确诊：定损单 + 用户二次确认（FSM 强约束）
- 状态机增补：`ARRIVED → DIAGNOSED（定损报价，强制 ≥2 张现场照片，人工/材料费分项隔离）→ 用户 CONFIRM_QUOTE → WORKING`；用户拒价进取消退款流。
- 增项无用户端二次电子签名，服务端拒绝写入结算账单（网关 409 拦截未授权状态突变）。
- 材料费异常（超阈值或材料/人工比失衡）自动转人工核验。

### 三、检测费预冻结
- 下单时检测费作为 milestone-0 进入 escrow 预冻结；确诊后分支差额多退少补（复用 `refundRemainingMilestones`）。
- IntentCard 知晓勾选文案必须明示"上门检测费 ¥x，不修不退"（315 投诉第一大类即未提前告知费用）。

### 四、配件库版本化
- 配件价来自弹药表版本化配件库；LLM 禁止现编配件价；未知配件 → 转人工核价（考卷钉死）。

## Alternatives Rejected

- **LLM 直接输出 JSON 结算价注入**：把资损口径交给概率模型，一次幻觉即资金事故；且违反 §6.3 #7（主链路确定性）。LLM 只许提议。
- **师傅现场口头报价**：即 315 曝光模式的复刻，否决。
- **一口价统一定价**：尺寸/环境/辅材不确定使一口价无法落地（腾讯新闻实测：平台价表被师傅以"实际情况"架空），区间 + 确诊是唯一可行形态。

## Consequences

- 新增/修改：`src/types/intent-card.ts`（区间类型）、`src/base/order/intent-card.ts`（区间组装纯函数＋单测）、定损单 API 与 FSM 节点、`ammo/<品类>` pricing 配置（首批：appliance_repair）。
- 门禁：T2（UI＋资金链路）——`npm run check` 全绿 ＋ build ＋ 定价考卷（区间单调性/分支封顶/预冻结对账）全绿方可合入。
- 后续依赖：ADR-0021（确诊纠纷进仲裁建议书）；配件库与供应链对接另起 ADR。
