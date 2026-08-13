# ADR-0012: AIGC 伪造鉴真 + 电子签章/保险壳（N4 + N7）

日期：2026-08-13
状态：Accepted（缺口 N4 + N7 落地；功能层迭代第三批）

## 六圈定位声明
- 所属圈：第三圈 · AI 神经层（N4 鉴真）+ 第四圈 · 撮合网关（N7 签章/保险）
- 所属模块：AIGC 伪造鉴真、电子签章、履约保险
- 复用底座：`base/ai/gateway`（鉴真 LLM 复核可选复用）、`lib/dial`（无可复用，独立为 `base/platform`）
- 弹药表：无新增弹药字段

## 宪法条文对照
- 命中条文：**#10 降级是设计的一部分**（鉴真默认纯规则，LLM 复核为可选增强且超时/失败回落到规则——`withLlmReview(rule, null)` 即规则分；签章/保险为本地壳，真实机构接入为外部替换点，永不裸奔）
- 偏离条文：无

## Context

- N4：证据（评价/聊天/截图）伪造风险；A 轮评委点名的优先风控。
- N7：成交信任需要「协议防篡改」与「履约有事可赔」；外部签章平台/保险机构未接入。

## Decision

### 一、AIGC 伪造鉴真（`src/base/ai/forgery.ts` 纯函数）
- `checkForgery`：五信号（EXIF 缺失 25 / 文件名异常 10 / 截图复用 35 / 时间矛盾 30 / 比例异常 10）加权 → 0-100 分 + `clean/suspicious/highly-suspicious`。
- `checkTextEvidence`：文本重复 → reused（3 条相同 = 35 分可疑）。
- `withLlmReview`：外部复核（-1..1 置信）可选加权，`null` 即回落规则分（宪法 #10）。

### 二、电子签章（`src/base/platform/signInsure.ts`）
- `hashDoc`（djb2）→ `signDoc`（内容+章+签名者+时间）→ `verifyDoc`（篡改检出）。

### 三、履约保险壳（同文件）
- `insure`（幂等投保，押 premium 获 amount 保障）→ `claim`（违约理赔，一次性幂等）。
- 外部保险机构为独立替换点（宪法 #10 壳即降级）。

## Consequences
- 新增 `base/ai/forgery.ts`、`base/platform/signInsure.ts`、`forgery-bi.test.ts`（+9 单测）；
- 缺口 N4/N7 关闭；单测 365 全绿。
- 后续（单独 ADR）：真实图像 EXIF 读取、AIGC 水印/C2PA 校验、保险机构 API。