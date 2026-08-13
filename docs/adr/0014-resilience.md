# ADR-0014: 弱网离线队列 + 运力熔断 + 优雅降级 + 数据湖/AB/哈希存证（N11-N14）

日期：2026-08-13
状态：Accepted（缺口 N11 + N12 + N13 + N14 落地；功能层迭代第五批）

## 六圈定位声明
- 所属圈：第六圈 · 基础设施
- 所属模块：弱网离线队列、智能运力熔断/供需杠杆、多云多活优雅降级四部曲、数据湖/AB/哈希存证
- 复用底座：`base/platform/p2p`（离线重放对接 transport）、`base/money`（熔断对结算保护）
- 弹药表：无新增弹药字段

## 宪法条文对照
- 命中条文：**#9 多防线一体**（N11 重放幂等 + N12 熔断 + N13 降级链 = 三层故障防线）、**#10 降级是设计的一部分**（`degrades()` 是降级链的通用载体，AB 兜底胜负判定有阈值不武断拍板）
- 偏离条文：无

## Context

四个基础缺口的本地工程实现：离线写入缓冲、故障熔断、长链路优雅降级、可信事件存证 + 实验平台最小集。

## Decision

### 一、弱网离线队列（`src/base/platform/offlineQueue.ts` 纯函数）
- `enqueue`（幂等去重）+ `due`（到点可取）+ `markPlayed`（成功 done / 失败指数退避 1s×2^n 上限 10min）+ `compact`（压缩）。

### 二、运力熔断 + 供需杠杆（`src/base/platform/circuit.ts` 纯函数）
- `trip`（3 次失败 → open）+ `allow`（冷却 30s + half-open 单次探测 → 恢复/再熔）。
- `lever`（供需比 <0.6 供不应求 / >1.6 过剩 / 平衡，给建议文案）。

### 三、优雅降级四部曲（`src/base/platform/resilience.ts`）
- `degrades(steps, log)`：依次尝试，第一个非 null 命中，全失败记录错误；附带降级日志供审计。

### 四、数据湖 + 哈希存证 + AB（同文件）
- `lakeAppend`（append-only 日志行 + 内容哈希 + prev 哈希链）+ `lakeVerify`（全链校验，中间篡改定位）。
- `pickVariant`（用户哈希均匀分流）+ `abWinner`（δ 阈值判定，不武断）。

## Consequences
- 新增 `base/platform/offlineQueue.ts`、`circuit.ts`、`resilience.ts`、`resilience.test.ts`（+7 单测）；
- 缺口 N11/N12/N13/N14 关闭；单测 365 全绿。
- 后续（单独 ADR）：离线重放接入 transport 定时调度、熔断退避参数弹药化、数据湖接入 Supabase 审计表。