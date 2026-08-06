# ADR-0001: 开放局信任闭环三缺口（退款/取消/锁定）

日期：2026-08-06
状态：Accepted

## Context

开放局/拼位 X 射线（随单支付）上线后暴露三资金缺口：
① 局到期未满员 → 拼位者与发起人已支付款永不退回；
② 发起人取消发布只置 closed，已收款项零退款；
③ no-show 违约后违约者可继续拼位/发波，无任何因果后果。
三缺口均为「钱已到位但动作无归形绑定」的具体表现。

## Decision

- **① 成团失败自动退款**：`settleExpiredOpen` (store) 幂等扫描 active 的开放局，
  到期（`expiresAt` 过去）且未满员 → 该局全部已付 PayOrder 原路全额退回（ratio 1），
  wave → `expired`。拼位立即序：`joinSeat` 成功即创建已捕获 PayOrder（占位=付自己一份）。
- **② 24h 分级取消**：发布时必录 `startsAt`，发起人「取消发布」按 lead time 退：
  ≥24h 全退 / [0,24h) 退 80%（20% 鸽子险+场地保证金）/ 已开始或缺失 startsAt 退 0。
  退款走原路退回，wave → `closed`。老数据（无 startsAt）退化「取消不退」。
- **③ no-show 欠款锁定**：`claim.settled` 标记结清。存在 `breached` 且 `!settled`
  的座位 → 该用户不可 `joinSeat` / `createPendingWave` / `publishWave`。
  结算方=需求方（成局页）确认收款后 `settleBreach(claimId)` 解锁。

## Alternatives Rejected

- 拼位人数退款走钱包（不进原路）：违「钱包=留存工具，默认原路」原则，被拒。
- 24h 内退钱包可对冲跨 tab 写回竞态——实际用「注入+重读校验」治本，不再妥协。
- no-show 一次性「播除」＝永久封禁：过于激进且无因果通报，改为可控结清开关。

## Consequences

- `joinSeat` 不再只建 claim，同步生成已捕获 PayOrder（老 E2E 语义无回归，金额断言不变）。
- 无 startsAt 老局取消=不上退回 → 需新发布局才能体验 24h 档位（数据可迁移）。
- E2E `scripts/e2e-trust-open.mjs` 覆盖三链路，含 expired 注入+重读校验兜底写回竞态。
- 信任闭环成为「随单支付」总纲的第 4 条：动作不兑现 → 钱自动退（团败）/按规则可退（取消 / 不可再动作（no-show 未结清）。