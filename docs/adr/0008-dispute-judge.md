# ADR-0008: 智能争议小法官（LLM 自动定责 + 赔付建议）

日期：2026-08-13
状态：Accepted（作为缺口 N5 落地；功能层迭代第一批）

## 六圈定位声明
- 所属圈：第三圈 · 智能决策与 AI 神经层
- 所属模块：14. 智能争议解决小法官（自动比对证据链 → 赔付建议 + 话术）
- 复用底座：`base/order/dispute.ts`（争议状态机/证据链/责任判定）、`base/ai/gateway/engine.ts`（LLM 多 Provider 三级降级）、`base/notify`（结果通知）、`base/platform/toast`（交互反馈）
- 弹药表：无新增配置（小法官是纯底座能力，非弹药）；若后续需要「按类目调整赔付上限（如进家类目从 60% 提高到 80%）」，进 `ammo/risk-rule.ts` 引信表——本轮不做

## 宪法条文对照
- 命中条文：**#7 LLM 能介入就介入**（争议定责是最典型的小法官落点，需求方举证 → LLM 比对「聊天承诺 vs 现场证据」给赔付建议）、**#10 降级是设计的一部分**（LLM 失败 → 回落到 dispute.ts 确定性原因档位，永不裸奔）、**#6 信任数据是瞄准镜**（小法官结论必须写回信用分，体现裁决闭环）
- 偏离条文：无

## Context

缺口 N5（0007 §5）：现有 `base/order/dispute.ts` 只有**原因→钱**的确定性档位（no-show 全退 / 迟到协商 60% 上限），没有证据比对，也没有 LLM 自动定责。

用户痛点：客服是团队规模瓶颈。需求方投诉「保洁没擦干净」时，客服要人工翻阅前后照片 + 聊天记录 + 判断赔付，成本高且口径不一。

本 ADR 落地：小法官 = **证据链比对 → 定责偏移 → 赔付建议 + 话术**，客服只需点确认；LLM 不可用时回落到现有确定性规则（宪法 #10）。

## Decision

### 一、小法官纯函数层（`src/base/ai/judge.ts`，确定性兜底 + 共享模型）

输入（证据链）：
- `reason`（六类官方原因之一，来自 dispute.ts）
- `evidenceText`（需求方举证，如「门口地毯没洗，客厅还有灰尘」）
- `responderText`（响应者反驳，如「地毯是湿洗的，甲方没等晾干」）
- `amountYuan`（争议金额）
- `promiseHints`（聊天记录中可量化的承诺，如「含地毯」「全屋 2 小时」）

输出 `VerdictSuggestion`：
- `stance`: "responder-full" | "responder-partial" | "demander" | "shared"（穿透 dispute.ts Responsibility）
- `refundPct`: 0-100（≤ 各原因档位上限，如 late 上限 60）
- `amountYuan`
- `rationale`: 一句话正反方摘要
- `replyScript`: 给客服/自动的话术（含安抚 + 结论 + 下一步）
- `confidence`: 0-1

确定性规则（mock/兜底路径）：
1. 原因档位先行（复用 `autoVerdict` 上限）；
2. 证据正反命中偏移：responderText 有「反驳关键词」（晾干/二次/约定/提前告知…）→ 责任降档（partial→shared，上限减半）；evidenceText 有「硬伤关键词」（没来/坏了/丢了/少了/没做）→ 责任升档；
3. 兜底：无 LLM → 返回规则结论 + `source: "rules"`。

### 二、LLM 深度介入（`src/app/api/judge/route.ts`，复用 gateway 三级降级）

- 路由：`POST /api/judge`，payload = 证据链；
- prompt：让 LLM 扮演中立小法官，输出 JSON（stance/refundPct/rationale/replyScript/confidence），**约束 refundPct ≤ 原因档位上限**（prompt 里给上限，防 LLM 拍脑袋 100%）；
- 解析失败/超时/provider 全挂 → 回落纯函数规则（`source: "mock"`），与 diagnose 同构（宪法 #10 已验证模式）；
- 毒丸围栏：返回的 stance 不在枚举 → 丢弃该字段回落规则档位。

### 三、写回闭环（宪法 #6）

- 小法官结论挂到 `DisputeRecord` 旁的新接口 `JudgeVerdict`（store 层持久化，本地沙盒）；
- 客服确认（或自动执行 auto 路径）后：按 `creditDeltaFor` 现有逻辑写信用分（复用，不加新逻辑）；
- 结果经 `base/notify` diff 通知双方。

### 四、UI（客服确认闭环）

- `JudgePanel.tsx`：争议详情内嵌「AI 小法官」卡——证据摘要 + 建议赔付 ¥xx（原因档位上限内）+ 话术预览 + 【采纳 / 驳回重审】；采纳即写回结算 + 信用分 + 通知；
- 入口：现有 dispute 展示区（MyWaves / 履约区），本轮先挂演示入口（争议沙盒卡）。

## Alternatives Rejected

- **纯规则引擎不接 LLM**：省事但与宪法 #7 相悖，且「证据比对」本质是语义任务，规则只能碰关键词、碰不动语义矛盾（「湿洗没晾干」vs「没洗」）。
- **LLM 直接动钱（自动赔付）**：宪法 #2 接口保守 + 资金安全红线，本轮只出建议、人工确认；自动执行留给信用分沉淀足够后单独 ADR。
- **微调专属模型**：数据量不足，gateway 现成 prompt 足够，跳过。

## Consequences

- 新增：`src/base/ai/judge.ts`（纯函数 + 单测）、`src/app/api/judge/route.ts`、`src/components/dispute/JudgePanel.tsx`（演示入口）；
- 单测基数 314 → 320+（judge 规则 ≥6）；
- `docs/PROJECT_STATUS.md` LAST_SYNC 更新；缺口清单 N5 标注已关闭；
- 不动的部分：dispute.ts 状态机语义零改动（只读复用）、ammo 表零新增（宪法 #3/#4 未被牵引）;
- 后续（单独 ADR）：按类目配置赔付上限（ammo/risk-rule 引信）、小法官结论自动执行、AIGC 鉴真（N4）与证据链联动。