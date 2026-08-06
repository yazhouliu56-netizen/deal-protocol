# ADR-0002: 验收/扣费模块（M3）— 模块化验收 + 争议按原因结算

日期：2026-08-06
状态：Accepted

## Context

简单任务验收（申报→验收→放款）已落地，但复杂任务「一句话说不清」——
验收笼统、争议无标准。设计稿要求：发起人把复杂任务交给 LLM 拆成可单独
验收的模块，逐模块放款；争议按「原因」拆分（不按金额），自动判责后
协商或终局。决策点在资金与责任的绑定规则。

## Decision

- **AI 拆解（发布时）**：`/api/decompose` 把复杂需求拆成 2-N 个独立模块
  （名称 + 验收标准 + 建议价权重，权重和=100）。链路 Zhipu → Gemini →
  mock 兜底（无 key 或超时 8s 时用确定性 mock），mock 权重等分。
  发起人发布前可增删改；**接单（含协商开始）后锁死**，不可再改。
- **M3 逐模块验收**：`claim.modules[]`（TaskModuleState）与 fulfillment 完全
  独立、互不污染。每个模块 pending → 响应者申报 done → 需求方确认 confirmed。
  **全部模块确认才放全款**（未确认模块冻结，无 partial release）。
  简单任务（无 modules）走原 fulfillment 流程不变。
- **争议按原因拆分**：6 类官方原因（迟到/早退、未达标准、沟通失联、
  爽约/放鸽子、额外收费、其他）。自动判责档位：
  响应者全责原因 → 自动退款 100% 不可协商；部分责任 → **协商档位上限
  60%**（Fiverr Resolution Center 对标）；需求方原因 → 0。
  48h 申诉窗，过期未申诉按档位自动终局（`autoResolveDisputes`）。
- **协商语义**：响应者提出「退 X% 结案」（X ≤ 档位上界），需求方接受即
  结算（响应者先接受 = 按档位上界直接结案）。协商变更只走
  `disputes[].outcome`（kind: negotiated/auto），原路退款。
- **信用联动**：响应者全责 −2、部分 −round(责任/20)、需求方 0 分；
  结算时随 dispute outcome 落库。
- **不做**：群局模块化验收、人工仲裁介入、图片凭证上传（E2E 用文本凭证）。

## Alternatives Rejected

- 争议按金额拆分（需求方随意填退款额）：无标准、易滥用，改为固定原因档位。
- 协商上限 30%：对响应者过狠（部分责任范围太窄），对标 Fiverr 取 60%。
- 全责也允许协商：破坏「爽约=全退」威慑，被拒。
- 模块验收复用 fulfilment 状态机：验收语义不同（独立放款），会污染放款原子性。

## Consequences

- `wave.modules[]`（定义）+ `claim.modules[]`（状态）双份数据，接单时从
  wave 复制 init 状态，跨 tab 经 transport id 级合并。
- transport `mergeByIdLevel` 的 byId 对 undefined 字段崩溃曾静默吞掉写入
  （claims 不落盘）——已全部 `?? []` 防御，E2E 验证跨 tab 同步正常。
- 新 E2E `scripts/e2e-acceptance.mjs` 三链路（简单验收 / 模块化逐模块放款 /
  争议原因拆分+协商 60%）进 CI，品类用非进家「羽毛球约局」规避认证 flaky。
- 单测新增 decompose / moduleFulfilment / dispute 三套，全量 134 通过。
