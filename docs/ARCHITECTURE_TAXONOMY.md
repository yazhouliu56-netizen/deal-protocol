# 系统架构分类学白皮书（ARCHITECTURE TAXONOMY）

> **元宪法状态**：本文依据人类创始人的【最高哲学架构与系统工程元宪法（RPG 火箭筒微内核模型）】
> 勘测全仓后固化。本文 = 全项目架构归属的唯一事实来源（Single Source of Truth），
> 与 `DESIGN_CONSTITUTION.md`（最高指导思想条文）配套使用：
> 宪法管「为什么设计」的裁定规则，本文管「每个文件属于哪一层、防线在哪圈」的分类学。

**勘测日期**：2026-08-15（全仓只读扫描 + 红线实证核对）
**勘测范围**：`src/base`、`src/ammo`、`src/store`、`src/app`（44 页面 + 99 API 路由）、`src/lib`、`src/modules`、`src/components`（117 文件）、`src/hooks`、`src/types`、`supabase/migrations`（40 迁移）、`scripts`、`mobile`、`packages`、`tests`、`e2e`
**验证基线**：单测 856 全绿（vitest 426 + node:test 430）· Lint exit 0 · tsc 0 错 · 收敛门禁 exit 0

---

## 一、元宪法四层模型（RPG 火箭筒）

| 层 | 名称 | 定位 | 职责铁律 |
|----|------|------|----------|
| ① | **40mm 通用发射筒（底座层 / Base Tube）** | 通用 O2O 信任、计价、撮合、支付托管与状态机基建 | 标准接口、功能下放、向下兼容、极简可靠、Microkernel；不为单一业务写死代码，仅提供通用原子契约与确定性状态机 |
| ② | **超口径多元弹药（弹药层 / Super-Caliber Ammo）** | 差异化垂直场景履约 SOP（家政、组局、交友、线下空间交易等） | 即插即用、可配置、声明式装填；业务逻辑作为外挂弹药插件，不污染发射筒内部 |
| ③ | **火控雷达（AI 中枢层 / Fire-Control Radar）** | LLM 深度寄生核心流程，非外挂客服 Bot | 自然语言需求解析与结构化拆解、多维特征向量撮合、智能仲裁定责、对话式动态洞察 |
| ④ | **实战生存力与六层防御圈（Six Defense Circles）** | 感知圈 - 业务圈 - AI 圈 - 风控圈 - 网关圈 - 基础设施圈 | 预先防御线下高频暴雷（地下室弱网断连、坐地起价、放鸽子、AIGC 物证伪造欺诈、人身危机干预、容灾降级） |

### 六大工程防腐红线（不可逾越）

1. **【隔离墙原则（The Air-Gap Principle）】**：火控雷达（LLM）仅拥有 `Advisory / Proposing`（建议与提案）权限；严禁直接修改订单状态、扣款或放行资金。一切资金与核心状态跃迁必须由确定性代码状态机（Base Tube）二次强类型校验后生效。
2. **【声明式弹药规范（Declarative Ammo DSL）】**：严禁 LLM 为每个新业务从头编写粘稠 CRUD；弹药层必须声明式 Schema / DSL（定价曲线、里程碑检查点、SLA 超时规则、所需传感器），由底座通用 `AmmoRunner` 解析执行。
3. **【单向依赖流动铁律（Unidirectional Flow）】**：依赖方向严格限定 `UI / Ammo (弹药)` ➔ `src/base/`（发射筒）➔ `src/types/`（底层协议）；`src/base/` 绝对禁止反向 import 业务层或 UI 状态，底层代码严禁出现具体业务实体名词。
4. **【零信任物理感知（Zero-Trust Sensorium）】**：所有物理世界证据（照片、视频、打卡）必须经过原生相机流防刷、EXIF 时空锚定与轻量视觉防伪快筛，方可送入仲裁链。
5. **【弹道惯性降级（Ballistic Resilience）】**：任何 LLM 依赖必须具备纯确定性算法的兜底链（网关全挂时自动降级为规则正则提取、纯距离硬匹配、SLA 超时自动锁定）。
6. **【前端视界投影隔离（Persona & Horizon Isolation）】**：底座提供通用状态交互组件，弹药层通过主题 Token 与专属 Layout 自主投影前端视界，杜绝认知与样式割裂。

---

## 二、全仓资产归属映射（Taxonomy Mapping）

### 2.1 底座发射筒（Base Tube）— `src/base/`（11 域，约 100 文件）

| 域 | 模块（文件） | 状态 |
|----|-------------|------|
| money | ledger / pay / deposit / bidding / customPricing / organizerSubscription | 🟢 核心资金确定性引擎 |
| order | wave（状态机+waitlist+审批）/ booking / fulfilment / moduleFulfilment / dispute / orderCore（投影桥）/ attendance / guest | 🟢 订单状态机（宪法 #2 保守增补） |
| trust | reputation / trust / starRank / review / violation / friends | 🟢 信用资产 |
| dispatch | match / broadcast | 🟢 撮合引擎（ammo 表驱动权重/硬门槛） |
| risk | sentinel / roamGuard / fission / moderation | 🟢 风控探针（ammo 引信开关） |
| geo | geo / geoAdapter（GeoSrc 注入）/ destFilter / mapConfig / mapPref | 🟢 位置引擎 |
| notify | notify / systemNotify | 🟢 通知聚合 |
| comm | privacyNumber（48h 号码池）/ im | 🟢 通讯（隐私号+IM） |
| safe | crisis / privacy / ageGate | 🟢 危机+脱敏+分级 |
| form | dynamicForm（Schema 描述器） | 🟢 动态表单 |
| platform | circuit / offlineQueue / resilience / snapshot / signInsure / quietHours / avatar / toast / clientFlags / readKeys / performance / p2p（transport/supabase） | 🟢 韧性六件套 + 平台件 |

### 2.2 超口径弹药（Ammo SOPs）— `src/ammo/`（声明式四表 + 二表）

| 弹药表 | 内容 | 消费引擎 |
|--------|------|----------|
| pricing-formula（C3） | 每类目计价公式（时薪/倍数/距离费/时间系数/地板价） | base/money/customPricing |
| dispatch-rule（C4） | 每类目撮合权重 + 硬门槛（认证/禁入/在线） | base/dispatch/match、broadcast |
| risk-rule（C5） | 风控引信开关（反自刷/多开/进家验证/发布费配额/年龄分级） | base/risk/sentinel、roamGuard |
| sop | 每类目履约 SOP（押金/有效期/容量/回合/验收窗） | base/order/wave 等 |
| scene-template | 场景模板（球局/约拍/城市历史 → 程序化舞台） | components 场景渲染 |
| prefs | 撮合偏好四维选项池（半径/预算/水平/时间） | usePrefStore |

> 新增业务 = 在四表登记类目配置，底座零修改（已由 ADR-0007 e2e「填表即新弹药」验证）。

### 2.3 火控雷达（Fire-Control Radar）— AI 中枢

| 能力 | 载体 | 隔离墙状态 |
|------|------|-----------|
| LLM 网关（provider 单一来源 + 配额 + 降级链） | `src/base/ai/gateway/`、`src/base/ai/chat/` | 🟢 三级降级（zhipu→gemini→mock） |
| 自然语言解析与结构化拆解 | `base/ai/cluster.ts`、`decompose.ts`、`voice/voiceIntent.ts` | 🟢 围栏容错 |
| 语义撮合（bigram TF 余弦，零依赖） | `base/ai/embed.ts` | 🟢 确定性算法（LLM 可选链未接，宪法 #7 已记录） |
| 智能仲裁定责（建议权） | `base/ai/judge.ts` + `app/api/judge` | 🟢 规则引擎兜底，仅出建议赔付 |
| 对话式动态洞察（BI） | `base/ai/bi.ts` | 🟢 规则解析聚合（不耗 LLM） |
| 证据鉴真复核（LLM 复核降级链） | `base/ai/forgery.ts` | 🟢 五信号加权 + LLM 复核降级 |
| 语音链路 | `base/ai/voice/`（asr/tts/audioStore） | 🟢 GLM→Web Speech / edge-tts→speechSynthesis 降级 |

### 2.4 六层防御圈归属（全仓投影）

| 圈 | 定义 | 本仓落位（核心资产） |
|----|------|---------------------|
| ① 感知圈（触达） | 用户触达与需求录入 | `base/form/dynamicForm`、`base/geo/*`、`ammo/scene-template`、`components/oto-ui/*`、`src/app/` 前端 44 页面、`mobile/` |
| ② 业务圈（业务核心） | 订单/履约/资金闭环 | `base/order/*`、`base/money/*`、`base/dispatch/*`、`store/useWaveStore.ts` |
| ③ AI 圈（AI 神经） | LLM 寄生核心流程 | `base/ai/*`、`app/api/ai/*`、`app/api/gateway/judge/chat/cluster/decompose/diagnose/voice-intent/asr/tts` |
| ④ 网关圈（生态网关） | 外部系统与通道 | `app/api/payment/*`、`webhooks/*`、`app/api/push/*`、`base/platform/p2p/*`、`supabase/migrations/*`、`lib/payment.ts`、`lib/wechat-pay-service.ts`、`lib/alipay-service.ts` |
| ⑤ 风控圈（安全风控） | 反欺诈/危机/合规 | `base/risk/*`、`base/safe/*`、`base/trust/*`、`lib/fraud-detection/*`、`packages/credit-formula` |
| ⑥ 基建圈（生存基建） | 容灾降级与运维 | `base/platform/circuit/offlineQueue/resilience/snapshot/signInsure`、`app/offline`、`sw.ts`、`scripts/restart-prod.mjs`、`scripts/dev-all.mjs`、`scripts/e2e-*.mjs`、`scripts/convergence-check.mjs` |

### 2.5 父项目存量层（融合过渡归属，ADR-0018）

| 资产 | 现状 | 归属裁定 |
|------|------|----------|
| `src/lib/`（~90 文件） | 父项目业务库：协议引擎（protocol/）、matching、arbitration、contract、dispute、llm、fraud-detection 等 | ⚠️ **存量弹药候选**：`lib/protocol/protocols/housekeeping.ts`、`dating.ts` 等已是「垂直场景 SOP 协议」，本质即弹药层，待迁移至 `ammo/` 声明式结构 |
| `src/modules/`（m02-m14，13 模块） | 父项目模块层（认证/类目/协议生成/信用/支付/SOS/证据链…） | ⚠️ 存量业务引擎，未挂入 base（`modules → lib` 依赖，不触 base） |
| `src/app/api/`（99 路由） | 父项目业务 API 直连 Supabase（payment/release、orders、disputes…） | ⚠️ **隔离墙未闭合侧**：资金/状态跃迁未统一经 base 确定性引擎（历史遗留，需按宪法 §2 渐进收敛） |
| `supabase/migrations/`（40 个） | 数据层 + RLS + RPC | 🟡 网关圈/基建圈数据底座 |
| `src/store/`（7 文件） | UI 状态层 | 🟡 业务圈前端接线（useWaveStore 为最大消费方） |
| `mobile/`（RN 子项目） | 移动端 10 屏 | 🟡 已登记归属（location→base/geo RN 候选、DynamicForm→弹药表单 N2），未融合 |
| `packages/`（credit-formula / payment-core） | 信用公式与支付内核 | 🟡 底座候选（核心契约应上收 base 或经 base 引用） |
| `tests/`、`e2e/`、`scripts/` | 验证体系 | 🟢 基建圈 |

### 2.6 验证资产归属（856 基线）

| 资产 | 数量 | 归属 |
|------|------|------|
| vitest（根，`test:units`） | 426 | 融合侧 + 父项目遗留测试 |
| node:test（`test:oto:units`，57 文件清单） | 430 | **base/ammo 域为主**（dispatch/order/money/trust/risk/ai/geo/notify/platform/safe/comm/form + ammo 全表 + lib 扫描/二维码） |
| e2e（playwright `e2e/`） | 4 spec | 基建圈冒烟 |
| e2e-*.mjs 脚本 | 12 | 基建圈回归（CI push 全链） |

---

## 三、哲学愿景 vs 实际代码：全景落差审计（Gap Analysis）

### 3.1 【已完美落地】— 完全符合哲学且落盘的重器

1. **底座九域 100 文件 + 状态机确定性**：`base/order/wave.ts`（ClaimStatus 保守扩展，宪法 #2）、`base/money/*` 全资金确定性引擎、`orderCore.ts` 投影桥（22 调用方零改动）。
2. **弹药四表声明式装填全兑现**：pricing/dispatch/risk/sop 四表 + 引擎按类目读表（`dispatchRuleFor` 等），「填表即新弹药」e2e 通过，新增业务零 base 修改。
3. **隔离墙（红线 1）正向实例**：`judge` 规则引擎为唯一兜底（LLM 结果仅 Advisory，`recommendedRefundAmount` 建议值），`settleDispute` 由 store 用户确认动作执行；仲裁/陪审输出均为建议而非写操作。
4. **弹道惯性降级（红线 5）全链落实**：Gateway 三级降级链（zhipu→gemini→mock）；TTS edge-tts→speechSynthesis；ASR GLM→Web Speech；voice-intent 围栏容错；无摄像头扫码降级；定位拒绝降级 mock（宪法 #10）。
5. **六层防御圈 🟢8 全部实现**：form/geo/notify/platform/crisis/privacy/ageGate/sentinel/forgery/quietHours/signInsure/circuit/offlineQueue/resilience 全部落地且经浏览器实测（详见 PROJECT_STATUS ADR-0008~0017）。
6. **测试验证体系 856 全绿 + 收敛门禁**：base/ammo 域 430 node:test 幂等、CI 四 job 真实检验链、rename 门禁机器拦截。
7. **零信任物理感知半程落地**：`forgery.ts` 五信号加权鉴真（EXIF/文件名/复用/时间/比例）+ 签章 djb2 验签 + 数据湖哈希链存证。

### 3.2 【实现存在偏差】— 架构异味与红线违规（实证）

| # | 偏差 | 实证位置 | 违反红线 | 判定 |
|---|------|----------|----------|------|
| D-1 | **base 反向 import UI/Store 层**（运行时依赖） | `src/base/ai/chat/llmEngine.ts:9`、`mockEngine.ts:10` → `import { useAppStore } from "@/store/useAppStore"`（读 chatMessages/workerOnline） | 红线 3 | 🔴 违规，需收敛 |
| D-2 | **base 反向 import Store 类型**（type-only） | `src/base/platform/p2p/transport.ts:12`、`supabase.ts:23` → `import type { WaveBundle } from "@/store/useWaveStore"` | 红线 3 | 🟡 轻度（type-only，但 WaveBundle 契约应上收 `src/types/`） |
| D-3 | **业务实体名词硬编码于 base** | `broadcast.ts:107` requiresVerified 默认含「陪诊陪护/家政保洁/厨师/上门」；`sentinel.ts:56` HOME_ACCESS_KEYWORDS 7 个业务词（进家判定未走 ammo 参数）；`decompose.ts:98` isOnsite 正则含业务词；`booking.ts:27-29` iconFor emoji 映射；`llmEngine/mockEngine` 分类话术硬编码 | 红线 3（严禁业务实体名词） | 🔴 主要违规；部分已有 ammo 覆盖路径（dispatch-rule），sentinel 进家词应迁入 `ammo/risk-rule` 引信参数 |
| D-4 | **父项目 API 层隔离墙未闭合**：99 路由直连 Supabase，资金/状态跃迁不经 base 确定性引擎 | `app/api/payment/release/route.ts`、`app/api/orders/**`、`app/api/disputes/**` | 红线 1（精神） | 🟡 历史遗留（宪法 §2 不算违规，但每次结构性改动须收敛） |
| D-5 | **两套状态机并存**：base 纯函数状态机（waves） vs 父项目 DB 状态机（orders/contracts） | `lib/protocol/engine.ts` + `supabase/migrations/001~` | 红线 1/3 | 🟡 融合期双轨，ADR-0018 后仍存 |
| D-6 | **AmmoRunner 未实现**：四表被各引擎散点消费（`dispatchRuleFor`、`riskOf`…），无统一声明式解析执行器 | `src/ammo/index.ts`（仅 re-export） | 红线 2 | 🟡 表驱动已达成，统一运行时缺失 |
| D-7 | **弹药层与存量协议层重复**：`lib/protocol/protocols/housekeeping.ts`、`dating.ts` 已是垂直 SOP，但未并入 ammo 声明式体系 | `src/lib/protocol/protocols/*` | 红线 2（精神） | 🟡 存量候选弹药，待收编 |
| D-8 | **前端视界投影未隔离**：全局单主题（oto-ui），无弹药专属主题 Token/Layout | `src/components/theme/`、`oto-ui/` | 红线 6 | 🔴 缺失 |

### 3.3 【愿景提及但完全缺失】— 空白缺口（按优先级）

| 优先级 | 缺口 | 哲学定位 | 六圈落位 | 现状 |
|--------|------|----------|----------|------|
| P0-1 | **AmmoRunner 统一声明式执行器**（DSL 解析 → 引擎装载 → 验舱单） | 红线 2 | ②业务圈 | 无（四表散点消费） |
| P0-2 | **父项目 API 资金/状态跃迁收编 base 引擎**（隔离墙闭合） | 红线 1 | ②+⑤圈 | 99 路由未过 base |
| P0-3 | **原生相机流防刷 + EXIF 时空锚定全链**（红线 4 完整闭环） | 红线 4 | ⑤风控圈 | 仅文本鉴真 + 部分 EXIF 信号 |
| P1-1 | **轻量视觉防伪快筛**（图片指纹/复制检测） | 红线 4 | ⑤风控圈 | 无 |
| P1-2 | **弹药动态加载**（运行时按类目发现/装载，非编译期静态表） | ②弹药即插即用 | ②业务圈 | 无 |
| P1-3 | **一键 SOS 联动链增强**（位置上报 + 录音证据自动封装入链） | 六圈暴雷防御 | ⑤风控圈 | crisis.ts 已有 EPA 通知链，缺位置/证据联动 |
| P1-4 | **对话式 BI LLM 意图改写可选链**（宪法 #7 已记录不接入理由，留口） | ③火控雷达 | ③AI 圈 | bi.ts 规则版已落地 |
| P1-5 | **弹药内嵌表单 schema**（DynamicForm 进一步表驱动：弹药携带所需传感器/表单） | 红线 2 | ①感知圈 | dynamicForm 通用引擎已有，弹药表单绑定无 |
| P2-1 | **弹药主题 Token 系统**（红线 6 视界投影） | 红线 6 | ①感知圈 | 单主题 |
| P2-2 | **AB 分流/degrades 真实场景**（resilience 库层已备） | ⑥基建圈 | ⑥圈 | 无真实分流场景，不硬造 |
| P2-3 | **移动端融合**（RN 注册 base/geo、弹药表单） | 底座统一 | ①感知圈 | 已登记未融合 |

---

## 四、收敛路线（宪法门禁衔接）

1. **每个结构性改动收敛一处 D 类偏差**，commit 说明标注「宪法收敛：条文 #3」（或对应红线），登记 `docs/CONVERGENCE-LOG.md`，过 `npm run check:convergence`（exit 0）方可提交。
2. **建议收敛顺序**：D-2（WaveBundle 契约上收 `src/types/`，改动最小）→ D-1（llmEngine/mockEngine 注入化）→ D-3（sentinel 进家词迁 ammo/risk-rule）→ D-6（AmmoRunner 第一版，同时承载 P0-1）→ D-4/D-5（父项目 API 收编，最大工程）。
3. **空白缺口开工须走宪法 §4 模板**（六圈定位声明 + 宪法条文对照），P0 级缺口开工前由人类裁决排期。

---

## 五、修订记录

| 日期 | 修订 | 裁决人 |
|------|------|--------|
| 2026-08-15 | 初版定稿：元宪法四层 + 六红线固化 + 全仓归属映射 + 落差审计（D1-D8 + P0-P2 缺口） | 用户 |
