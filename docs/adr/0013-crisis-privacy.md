# ADR-0013: 极端危机干预协议 + 数据脱敏/遗忘权（N8 + N10）

日期：2026-08-13
状态：Accepted（缺口 N8 + N10 落地；功能层迭代第四批）

## 六圈定位声明
- 所属圈：第五圈 · 平台治理与安全
- 所属模块：极端危机干预协议、数据全生命周期脱敏/遗忘权
- 复用底座：`base/notify`（危机通知）、`base/comm`（隐私号在脱敏域协作）
- 弹药表：无新增弹药字段

## 宪法条文对照
- 命中条文：**#7 平台三方视角**（危机协议由平台值班介入，属平台治理职责）、**#8 数据归属**（遗忘权 = 数据归属用户的落地：profile/wallet/waves/claims/reviews 全生命周期可匿名化）
- 偏离条文：无

## Context

- N8：web 侧缺少「一键 SOS」协议链路；mobile 有 SOS 壳，web 无对应流程。
- N10：隐私数据（手机号/姓名/地址/邮箱/身份证）展示未脱敏；无用户注销/遗忘权机制。

## Decision

### 一、极端危机干预协议（`src/base/safe/crisis.ts` 纯函数）
- `CrisisLevel`（0 无 / 1 轻微 / 2 明显危险 / 3 极端紧急）+ `raiseCrisis`（状态机登记）。
- EPA 通知递增表：level 1 → 紧急联系人；level 2 → +平台值班；level 3 → +警方通道（`notifyFor` 去重幂等）。
- `resolveCrisis`（处置闭环）+ `crisisSms`（短信模板）。

### 二、数据脱敏 / 遗忘权（`src/base/safe/privacy.ts` 纯函数）
- `mask`：phone/name/address/email/id 五类掩码。
- `requestForget`：遗忘权请求（幂等，pending→anonymized 状态机）。
- `anonymize`：按遗忘域（profile/wallet/waves/claims/reviews/all）删字段。

## Consequences
- 新增 `base/safe/crisis.ts`、`base/safe/privacy.ts`、`safe.test.ts`（+5 单测）；
- 缺口 N8/N10 关闭；单测 365 全绿。
- 后续（单独 ADR）：SOS 真推送（Web Push/短信网关）、位置实时爬坡上报、脱敏策略按角色分级。