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

## 二、核心设计模型（人类创始人注入 · 2026-08-15）

> **万能底座 + 插拔弹药 + 动态风控引信** —— 元宪法四层模型的底层执行契约。
> 代码落位：`src/types/ammo-schema.ts`（五态 + 伴生事件 + 弹药 Schema）、
> `src/types/fuze-policy.ts`（三类引信策略 + 预置模板）。两者为纯类型协议
> （红线 3：`UI / Ammo ➔ base ➔ types`），零业务依赖。

### 2.1 万能物理底座与五态原子状态机

**不可分割的标准五态流转**（底座主状态机绝对封闭，宪法 #2 接口保守）：

```
PUBLISHED（已发布）➔ MATCHED（已匹配）➔ IN_SERVICE（服务中）
➔ INSPECTED（已验收）➔ SETTLED（已结算）
```

- **原子性**：五态为不可再分的跃迁单元，任何业务不得自行发明中间态；跃迁矩阵唯一
  （`FIVE_STATE_TRANSITIONS`），非法跃迁编译期拦截；
- **伴生事件（Sub-Events）插拔**：现场增项报价、AA 分摊确认、配件复核等子流程
  一律挂载为 `ISubEventHook`（BEFORE 校验 / AFTER 副作用 + SKIP / BLOCK / DEFER
  确定性降级），底座五态机只保证在跃迁点调用钩子，不感知业务闭包内部；
- **与现有 `base/order/wave.ts` 状态机的过渡映射**（宪法 #2：只增补不改义，
  现有枚举语义不变，逐步向原子五态收敛）：

| 原子五态 | 现有 wave 工程投影 | 说明 |
|---------|-------------------|------|
| `PUBLISHED` | `pending` / `active`（发布 + 撮合开放） | 发布并进入撮合池 |
| `MATCHED` | `claimed` / `assembled`（认领 + 成团） | 响应者锁定（claimed）、开放局满员（assembled） |
| `IN_SERVICE` | 履约进行中（`moduleFulfilment` 模块态） | 服务窗口，伴生事件主要挂载点 |
| `INSPECTED` | 验收窗（reviewWindowMs，超时自动好评/放款） | 验收与复核 |
| `SETTLED` | `closed`（终局） | 结算落账、争议关卷 |

### 2.2 三类动态风控引信矩阵（Fuze Matrix）

| 引信 | 威胁类型 | 防护武器 | 本仓落位（现状 → 契约） |
|------|----------|----------|------------------------|
| 💥 **碰炸（IMPACT）** | 高财产 / 入户风险 | 强准入背调 + 保证金 + 过程留痕 + 财产险 | `ammo/sop` deposit、`base/risk/moderation`、`base/platform/signInsure` → `IMPACT_FUZE_TEMPLATE` |
| ⏳ **延期（DELAY）** | 履约 / 爽约风险 | 预付定金冻结 + LBS 电子围栏解锁 + 反赌反诈过滤 | `base/money/deposit`、`base/geo/*`、`base/risk/sentinel` → `DELAY_FUZE_TEMPLATE` |
| 📡 **近炸（PROXIMITY）** | 人身 / 交友风险 | 虚拟号 + 模糊定位 + AI 敏感词干预 + 一键 SOS | `base/comm/privacyNumber`、`base/safe/crisis`、`base/ai/*` → `PROXIMITY_FUZE_TEMPLATE` |

- **引信跟弹药走**（宪法 #5）：每颗弹药 `fuzePolicy` 声明引信类型与参数，
  勾选即生效；底座不写死单一业务风控；
- 多引信并联取并集，防护等级取最高；未声明 = 零防护兜底（弹药必须显式装填）。

### 2.3 数字人格与通用信用飞轮

- **资产通兑**：履约沉淀（守时 / 专业 / 礼貌 + 完成率）形成跨场景可复用的
  数字人格信用资产（`base/trust/*` + `packages/credit-formula`）；
- **信用飞轮**：低风险场景履约累积信用分 ➔ 降低高风险场景（进家 / 大额 / 新号）
  准入门槛与押金倍率 —— **弹药可换，信用资产跨弹药累积**（宪法 #6 信任数据是瞄准镜）。

### 2.4 契约落位（`src/types/`）

| 契约文件 | 内容 |
|----------|------|
| `src/types/ammo-schema.ts` | `AtomicFiveState` / `FIVE_STATE_TRANSITIONS` / `ISubEventHook` / `ISubEventContext` / `PricingModel` / `IAmmoDefinition` |
| `src/types/fuze-policy.ts` | `FuzeType` / `IFuzePolicy`（背调 · 押金 · 围栏 · 隐私 · SOS）/ 三类预置模板 + `DEFAULT_FUZE_POLICY` |

---

## 三、全仓资产归属映射（Taxonomy Mapping）

### 3.1 底座发射筒（Base Tube）— `src/base/`（11 域，约 100 文件）

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

### 3.2 超口径弹药（Ammo SOPs）— `src/ammo/`（声明式四表 + 二表）

| 弹药表 | 内容 | 消费引擎 |
|--------|------|----------|
| pricing-formula（C3） | 每类目计价公式（时薪/倍数/距离费/时间系数/地板价） | base/money/customPricing |
| dispatch-rule（C4） | 每类目撮合权重 + 硬门槛（认证/禁入/在线） | base/dispatch/match、broadcast |
| risk-rule（C5） | 风控引信开关（反自刷/多开/进家验证/发布费配额/年龄分级） | base/risk/sentinel、roamGuard |
| sop | 每类目履约 SOP（押金/有效期/容量/回合/验收窗） | base/order/wave 等 |
| scene-template | 场景模板（球局/约拍/城市历史 → 程序化舞台） | components 场景渲染 |
| prefs | 撮合偏好四维选项池（半径/预算/水平/时间） | usePrefStore |

> 新增业务 = 在四表登记类目配置，底座零修改（已由 ADR-0007 e2e「填表即新弹药」验证）。

### 3.3 火控雷达（Fire-Control Radar）— AI 中枢

| 能力 | 载体 | 隔离墙状态 |
|------|------|-----------|
| LLM 网关（provider 单一来源 + 配额 + 降级链） | `src/base/ai/gateway/`、`src/base/ai/chat/` | 🟢 三级降级（zhipu→gemini→mock） |
| 自然语言解析与结构化拆解 | `base/ai/cluster.ts`、`decompose.ts`、`voice/voiceIntent.ts` | 🟢 围栏容错 |
| 语义撮合（bigram TF 余弦，零依赖） | `base/ai/embed.ts` | 🟢 确定性算法（LLM 可选链未接，宪法 #7 已记录） |
| 智能仲裁定责（建议权） | `base/ai/judge.ts` + `app/api/judge` | 🟢 规则引擎兜底，仅出建议赔付 |
| 对话式动态洞察（BI） | `base/ai/bi.ts` | 🟢 规则解析聚合（不耗 LLM） |
| 证据鉴真复核（LLM 复核降级链） | `base/ai/forgery.ts` | 🟢 五信号加权 + LLM 复核降级 |
| 语音链路 | `base/ai/voice/`（asr/tts/audioStore） | 🟢 GLM→Web Speech / edge-tts→speechSynthesis 降级 |

### 3.4 六层防御圈 × 28 核心模块职责矩阵（标准模块编号，全项目永久统一）

> 人类创始人注入（2026-08-15）：全项目模块编号唯一标准 `L1-M1` ～ `L6-M4`。
> 任何设计 / ADR / 代码归属讨论必须引用本编号；新增模块须经人类裁决后在此表登记。
>
> ⚠️ **口径说明（实测核查）**：本次注入清单按六层逐项清点实为 **26 个模块**
> （L1×4 + L2×6 + L3×5 + L4×5 + L5×2 + L6×4），与标题口径「28」存在 2 席差量；
> 编号体系 `L1-M1`～`L6-M4` 完整成立（模块数 = 最大 M 序号），差量席位待人类裁决补充。

#### 3.4.1 模块职责矩阵（六层 28 模块）

**L1 用户体验与触达层（Front-end Perception）**

| 编号 | 模块 | 职责 |
|------|------|------|
| `L1-M1` | 动态表单引擎 | 基于 JSON-Schema 动态渲染不同业务下单界面，字段拖拽配置 |
| `L1-M2` | LBS 时空感知 | 经纬度采集、距离时效计算、电子围栏判定与轨迹上报 |
| `L1-M3` | 体验友好适配 | 大字高对比度、大热区触控、语音交互与适老化辅助 |
| `L1-M4` | 零知脱敏展示 | 手机号掩码、地址模糊化、会话临时 Token 化展示 |

**L2 通用业务核心层（Core Domain Engines）**

| 编号 | 模块 | 职责 |
|------|------|------|
| `L2-M1` | 标准订单状态机 | 统管“发布-匹配-履约-验收-结算”五态生命周期与伴生事件 |
| `L2-M2` | 计价分摊引擎 | 按时、按距、按人头 AA、阶梯计价、动态溢价及现场改价 |
| `L2-M3` | 双模分发路由 | 智能派单（路径/画像最优）与抢单大厅（优先级队列调度） |
| `L2-M4` | 账户清结算 | 资金担保托管、多方分账、跨场景统一钱包、提现与风控冻结 |
| `L2-M5` | IM 与隐私通信 | 端到端文本/音视频通讯、双向虚拟隐私号热绑定与录音存证 |
| `L2-M6` | 信用成长体系 | 守时率、专业度等多维画像计算，跨场景信用通用通兑 |

**L3 智能决策与 AI 神经层（LLM Intelligence）**

| 编号 | 模块 | 职责 |
|------|------|------|
| `L3-M1` | 意图识别转单 | 自然语言/口语化语音直接抽取为标准化订单草稿 |
| `L3-M2` | 向量匹配推荐 | 基于 Embedding 的人-单-场特征匹配与协同推荐 |
| `L3-M3` | 智能争议仲裁 | 履约物证比对、聊天承诺与时间轨迹分析，给出定责赔付建议 |
| `L3-M4` | AIGC 鉴真检测 | 完工凭证图像 EXIF、元数据与像素合成痕迹扫描 |
| `L3-M5` | 对话式数据 BI | 自然语言即时生成运营报表与业务归因诊断 |

**L4 安全合规与风控防御层（Risk & Compliance）**

| 编号 | 模块 | 职责 |
|------|------|------|
| `L4-M1` | 可插拔风控中枢 | 三类引信（碰炸/延期/近炸）自适应挂载矩阵 |
| `L4-M2` | 终端反欺诈 | 设备指纹、模拟器检测、GPS 防作弊与黑名单拦截 |
| `L4-M3` | 物理履约闭环 | 50 米 GPS 围栏校验 + NFC/动态码碰一碰确认完工 |
| `L4-M4` | 危机干预协议 | 一键红色报警、视音频直连安全官与心理援助接入 |
| `L4-M5` | 隐私合规遗忘 | 敏感信息密态存储、动态脱敏、过期销毁、全链路抹除 |

**L5 生态连接与开放网关层（Integration Gateway）**

| 编号 | 模块 | 职责 |
|------|------|------|
| `L5-M1` | 多通道适配器 | 地图/支付/通讯服务多厂商聚合接入与毫秒级故障自动切换 |
| `L5-M2` | 外部合规生态 | 公安实名认证、电子合同签章、场景险秒级直连投保 |

**L6 基础设施与生存保障层（Infra & Resilience）**

| 编号 | 模块 | 职责 |
|------|------|------|
| `L6-M1` | 弱网离线引擎 | 断网本地加密队列暂存操作，联网自动追回与重试 |
| `L6-M2` | 运力熔断机制 | 区域爆单/运力枯竭排队限流，价格杠杆供需平衡 |
| `L6-M3` | 多云多活容灾 | 四步优雅降级（关非核心 ➔ 限流 ➔ 保核心 ➔ 只读） |
| `L6-M4` | 司法级存证数仓 | 业务全量轨迹、聊天流水哈希存证，提供司法黑匣子 |

#### 3.4.2 代码落位与成熟度对照表（28 模块全仓映射）

> 状态图例：🟢 已闭环（生产代码 + 测试覆盖） / 🟡 有雏形（主链路已落地，缺口待补） / ⚪️ 待建设

| 编号 | 模块 | 代码落位 | 856 测试覆盖 | 状态 |
|------|------|----------|--------------|------|
| `L1-M1` | 动态表单引擎 | `base/form/dynamicForm`、`ammo/`（PublishSheet 弹药表单） | 表单生成/描述器测试 | 🟢（弹药内嵌表单 P1-5 待建） |
| `L1-M2` | LBS 时空感知 | `base/geo/*`（geo/geoAdapter/destFilter/mapConfig/mapPref）、`geo.ts` 距离时效 | geo 距离/过滤/地图配置测试 | 🟡（经纬度/距离时效已闭环；电子围栏判定与轨迹上报 ⚪️） |
| `L1-M3` | 体验友好适配 | `base/ai/voice/*`（asr/tts 语音交互）、`base/platform/performance`（tier 降级） | voice 链路测试 | 🟡（语音链路已闭环；大字/大热区适老化 UI ⚪️） |
| `L1-M4` | 零知脱敏展示 | `base/safe/privacy`（分级脱敏）、`base/comm/privacyNumber`（号码池掩码）、`fuze-policy` blurLocation | privacy/脱敏测试 | 🟢 |
| `L2-M1` | 标准订单状态机 | `base/order/wave.ts` + `types/ammo-schema.ts`（五态契约） | wave 状态机/认领/成团测试 | 🟢（五态为目标契约，wave 过渡映射见 §二 2.1） |
| `L2-M2` | 计价分摊引擎 | `base/money/customPricing` + `ammo/pricing-formula`（时/距/系数/地板价）、settleGroupFail | customPricing/计费测试 | 🟡（定式计价闭环；AA 分摊在场外、现场改价/动态溢价待建） |
| `L2-M3` | 双模分发路由 | `base/dispatch/match`（派单）+ `broadcast`（抢单广播）+ `ammo/dispatch-rule` | match/broadcast 测试 | 🟢（双模 + ammo 权重硬门槛闭环） |
| `L2-M4` | 账户清结算 | `base/money/*`（ledger/pay/deposit/bidding）、`packages/payment-core`、`app/api/payment/*`（托管） | pay/ledger/deposit 测试 | 🟡（确定性引擎闭环；统一钱包跨场景通兑、提现 ⚪️） |
| `L2-M5` | IM 与隐私通信 | `base/comm/privacyNumber`（48h 双向热绑定）+ `base/comm/im` | privacyNumber 测试 | 🟢（隐私号/IM 闭环；音视频端到端加密 ⚪️） |
| `L2-M6` | 信用成长体系 | `base/trust/*`（reputation/starRank/review）+ `packages/credit-formula` | trust/评分测试 | 🟢（跨场景通兑按宪法 #6 飞轮滚动） |
| `L3-M1` | 意图识别转单 | `base/ai/chat/llmEngine` + `decompose.ts` + `voice/voiceIntent.ts` | 拆解/意图测试 | 🟢（NL→结构化草稿闭环，围栏容错） |
| `L3-M2` | 向量匹配推荐 | `base/ai/embed.ts`（bigram TF 余弦，零依赖） | embed 语义测试 | 🟢（确定性版活产；LLM Embedding 可选链 P1-4 留口） |
| `L3-M3` | 智能争议仲裁 | `base/ai/judge.ts` + `forgery.ts`（物证）+ 时间轨迹分析 + `app/api/judge` | judge/定责测试 | 🟢（规则引擎兜底，仅出建议赔付——红线 1 隔离墙） |
| `L3-M4` | AIGC 鉴真检测 | `base/ai/forgery.ts`（EXIF/文件名/复用/时间/比例五信号 + LLM 复核降级） | forgery 鉴真测试 | 🟡（五信号闭环；像素合成痕迹扫描见 P0-3/P1-1） |
| `L3-M5` | 对话式数据 BI | `base/ai/bi.ts`（规则解析聚合） | bi 报表测试 | 🟢（规则版落地；LLM 意图改写 P1-4 留口） |
| `L4-M1` | 可插拔风控中枢 | `base/risk/*`（sentinel/roamGuard/fission/moderation）+ `ammo/risk-rule` 引信表 + `types/fuze-policy.ts`（三类引信模板） | sentinel/roam 测试 | 🟢（引信表驱动闭环；FuzeMatrix 自适应装载随 AmmoRunner P0-1） |
| `L4-M2` | 终端反欺诈 | `base/risk/roamGuard`（设备指纹/多开）+ `lib/fraud-detection/*`、`modules`（黑名单） | roam 多开测试 | 🟡（设备指纹/多开闭环；模拟器检测/GPS 防作弊待建） |
| `L4-M3` | 物理履约闭环 | `base/order/attendance`（到场签到雏形） | attendance 测试 | ⚪️（50m 围栏校验 + NFC/动态码碰一碰完工待建设） |
| `L4-M4` | 危机干预协议 | `base/safe/crisis`（EPA 通知链）+ `fuze-policy` sos 契约 | crisis 测试 | 🟡（EPA 链闭环；位置上报/录音证据联动 P1-3 待建） |
| `L4-M5` | 隐私合规遗忘 | `base/safe/privacy` + `ageGate`（未成年人合规）+ `fuze-policy` privacy 契约 | privacy/ageGate 测试 | 🟡（脱敏/分级闭环；密态存储/过期销毁全域抹除 ⚪️） |
| `L5-M1` | 多通道适配器 | `base/platform/p2p`（transport/supabase）、`lib/payment.ts`/wechat-pay/alipay（支付双通道）、Gateway 多 provider 降级 | p2p/payment 测试 | 🟡（支付/LLM 多厂商闭环；地图/通讯多厂商毫秒切换待建） |
| `L5-M2` | 外部合规生态 | `base/platform/signInsure`（签章验签）+ modules（认证/类目）+ identity 实名模拟 | signInsure 测试 | 🟡（本地签章/实名模拟雏形；公安实名/电子合同/场景险直连 ⚪️） |
| `L6-M1` | 弱网离线引擎 | `base/platform/offlineQueue` + `resilience` + `sw.js` 离线缓存 + `app/offline` | offlineQueue/韧性测试 | 🟢（离线队列/追回/缓存闭环） |
| `L6-M2` | 运力熔断机制 | `base/platform/circuit`（熔断库层）、`performance` tier | circuit 测试 | 🟡（熔断库层已备；区域爆单/价格杠杆真实场景 P2-2 未上线） |
| `L6-M3` | 多云多活容灾 | `base/platform/resilience`（降级库层）+ `circuit` | resilience 测试 | 🟡（降级库层已备；四步优雅降级编排待建设） |
| `L6-M4` | 司法级存证数仓 | `base/platform/resilience`（数据湖哈希链）+ `signInsure` 签章 + `qr/scan`（链接存证） | 哈希链/签章测试 | 🟢（哈希链闭环；全量轨迹黑匣子待完备） |

### 3.5 父项目存量层（融合过渡归属，ADR-0018）

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

### 3.6 验证资产归属（856 基线）

| 资产 | 数量 | 归属 |
|------|------|------|
| vitest（根，`test:units`） | 426 | 融合侧 + 父项目遗留测试 |
| node:test（`test:oto:units`，57 文件清单） | 430 | **base/ammo 域为主**（dispatch/order/money/trust/risk/ai/geo/notify/platform/safe/comm/form + ammo 全表 + lib 扫描/二维码） |
| e2e（playwright `e2e/`） | 4 spec | 基建圈冒烟 |
| e2e-*.mjs 脚本 | 12 | 基建圈回归（CI push 全链） |

---

## 四、平台落地推进路线图：三阶段研发与业务演进节奏

> 人类创始人注入（2026-08-15）：平台演进按「0➔1 ➔ 1➔10 ➔ 10➔100」三阶段推进，
> 每阶段绑定核心模块编号（§三 3.4 职责矩阵）与标杆弹药（IAmmoDefinition，§二 2.4），
> 阶段验收以「底座确定性 + 弹药可插拔 + 856 测试基线 + 收敛门禁」为硬门槛。

### 4.1 三阶段总览

| 阶段 | 代号 | 核心目标 | 建设重点（模块编号） | 标杆弹药 | 缺口衔接 |
|------|------|----------|----------------------|----------|----------|
| Phase 1 | MVP 验证期（0➔1） | 单一重信任场景打磨底座，跑通最小确定性闭环 | L2-M1 五态机 / L1-M2 LBS 围栏 / L2-M4 担保托管 / L2-M5 隐私虚拟号 / L4-M1 碰炸引信 | `housekeeping.ammo.ts`（含现场增项报价 Hook） | P0-1 AmmoRunner 首载 |
| Phase 2 | 体系成熟期（1➔10） | 验证弹药可插拔、钱包通兑、引信切换与 LLM 深度赋能 | L1-M1 动态表单 / L2-M2 计价 AA / L3-M1 意图转单 / L3-M3 小法官 / L3-M2 向量撮合 / L3-M4 AIGC 鉴真 | `meetup.ammo.ts`（⏳延期引信）+ `companion.ammo.ts`（📡近炸引信） | P0-3 / P1-1 鉴真闭环、P1-5 弹药表单 |
| Phase 3 | 规模壁垒期（10➔100） | 全品类开放与生态互通，抗极端意外与高并发洪峰 | L6-M1 弱网离线深度同步 / L6-M3 多云多活降级 / L6-M2 运力熔断限流 / L6-M4 司法级哈希存证 | 全品类开放（弹药库化） | P2-2 熔断真实场景、L6-M4 黑匣子完备 |

### 4.2 Phase 1：MVP 验证期（0 ➔ 1）

- **核心目标**：用最高风险、最重履约场景（如**家庭深度保洁**）把底座（发射筒）打磨扎实，
  跑通最小确定性闭环——「发布 ➔ 匹配 ➔ 进家服务 ➔ 验收 ➔ 结算」全链一次走通。
- **建设范围**：
  - **L1/L2 核心**：五态标准状态机（L2-M1，§二 2.1 过渡映射落地）+ LBS 围栏（L1-M2）+ 担保支付托管（L2-M4）+ 隐私虚拟号（L2-M5，已 🟢 直接复用）。
  - **L4 基础风控**：碰炸引信（L4-M1）——强背调（HARD）+ 保证金（RATIO）+ 过程拍照留痕 + 场景险（`IMPACT_FUZE_TEMPLATE`，§二 2.2 已注入契约，装载即可生效）。
  - **标杆弹药**：落地首枚官方标准弹药 `ammo/housekeeping.ammo.ts`——按 `IAmmoDefinition` 声明式装载，含「**现场增项报价**」伴生 Hook（IN_SERVICE 阶段 BEFORE/AFTER 插拔，对齐 §二 2.1 五态伴生事件机制）。
- **阶段验收**：AmmoRunner（P0-1）装载 housekeeping 弹药，五态 + 增项报价 Hook + 碰炸引信参数端到端生效；856 基线 + 收敛门禁双绿。
- **现状标注**：L2-M1 / L2-M4 / L2-M5 / L4-M1 基座均已 🟢（§三 3.4 对照表），本阶段核心缺口 = **首枚弹药定义 + AmmoRunner 统一装载执行**（P0-1，当前全仓最大空白）。

### 4.3 Phase 2：体系成熟期（1 ➔ 10）

- **核心目标**：引入轻履约 / 组局社交品类（如**麻将组局、同城搭子**），验证弹药可插拔性、
  跨场景统一钱包通兑、风控引信切换与 LLM 深度赋能。
- **建设范围**：
  - **L1/L2**：动态表单渲染（L1-M1，JSON-Schema 弹药内嵌表单 P1-5）+ 统一计价与 AA 分摊引擎（L2-M2，补齐现场改价 / 动态溢价）。
  - **L3 AI 神经**：LLM 意图解析转单（L3-M1，已 🟢）+ 智能仲裁小法官（L3-M3，已 🟢）+ 向量撮合推荐（L3-M2，Embedding 可选链接通）+ AIGC 图像鉴真（L3-M4，P0-3 / P1-1 像素合成扫描补齐）。
  - **标杆弹药**：`meetup.ammo.ts`（⏳ **延期引信** `DELAY_FUZE_TEMPLATE`：预付定金冻结 + LBS 电子围栏解锁 + 反赌反诈过滤）+ `companion.ammo.ts`（📡 **近炸引信** `PROXIMITY_FUZE_TEMPLATE`：虚拟号 + 模糊定位 + AI 敏感词干预 + 一键 SOS）。
- **阶段验收**：同底座换弹药（meetup ↔ companion）零 base 修改；引信随弹药切换（DELAY ↔ PROXIMITY）勾选即生效；跨场景钱包通兑（L2-M4）+ 信用飞轮（L2-M6，宪法 #6）。
- **现状标注**：L3-M1 / M2 / M3 已 🟢（确定性版）；L1-M1 / L2-M2 / L3-M4 为 🟡 需补齐；跨场景钱包通兑 ⚪️。

### 4.4 Phase 3：规模壁垒期（10 ➔ 100）

- **核心目标**：全品类开放与生态互通，抵御极端意外与高并发洪峰，筑牢司法存证与多云容灾壁垒。
- **建设范围**：弱网离线事务队列深度同步（L6-M1，已 🟢 基础上加固追回一致性）+ 多云多活降级（L6-M3，四步优雅降级编排：关非核心 ➔ 限流 ➔ 保核心 ➔ 只读）+ 运力熔断限流（L6-M2，区域爆单 / 价格杠杆真实场景 P2-2）+ 司法级哈希存证数仓（L6-M4，全量轨迹黑匣子完备可出证）。
- **阶段验收**：断网操作追回零丢失；区域洪峰熔断限流有真实业务场景（P2-2 激活）；四步降级演练通过；司法黑匣子可提供完整出证链路。
- **现状标注**：L6-M1 / M4 已 🟢；L6-M2 / M3 为 🟡（resilience / circuit 库层已备，真实编排待建设）。

---

## 五、哲学愿景 vs 实际代码：全景落差审计（Gap Analysis）

### 5.1 【已完美落地】— 完全符合哲学且落盘的重器

1. **底座九域 100 文件 + 状态机确定性**：`base/order/wave.ts`（ClaimStatus 保守扩展，宪法 #2）、`base/money/*` 全资金确定性引擎、`orderCore.ts` 投影桥（22 调用方零改动）。
2. **弹药四表声明式装填全兑现**：pricing/dispatch/risk/sop 四表 + 引擎按类目读表（`dispatchRuleFor` 等），「填表即新弹药」e2e 通过，新增业务零 base 修改。
3. **隔离墙（红线 1）正向实例**：`judge` 规则引擎为唯一兜底（LLM 结果仅 Advisory，`recommendedRefundAmount` 建议值），`settleDispute` 由 store 用户确认动作执行；仲裁/陪审输出均为建议而非写操作。
4. **弹道惯性降级（红线 5）全链落实**：Gateway 三级降级链（zhipu→gemini→mock）；TTS edge-tts→speechSynthesis；ASR GLM→Web Speech；voice-intent 围栏容错；无摄像头扫码降级；定位拒绝降级 mock（宪法 #10）。
5. **六层防御圈 🟢8 全部实现**：form/geo/notify/platform/crisis/privacy/ageGate/sentinel/forgery/quietHours/signInsure/circuit/offlineQueue/resilience 全部落地且经浏览器实测（详见 PROJECT_STATUS ADR-0008~0017）。
6. **测试验证体系 856 全绿 + 收敛门禁**：base/ammo 域 430 node:test 幂等、CI 四 job 真实检验链、rename 门禁机器拦截。
7. **零信任物理感知半程落地**：`forgery.ts` 五信号加权鉴真（EXIF/文件名/复用/时间/比例）+ 签章 djb2 验签 + 数据湖哈希链存证。

### 5.2 【实现存在偏差】— 架构异味与红线违规（实证）

| # | 偏差 | 实证位置 | 违反红线 | 判定 |
|---|------|----------|----------|------|
| D-1 | **base 反向 import UI/Store 层**（运行时依赖） | `src/base/ai/chat/llmEngine.ts:9`、`mockEngine.ts:10` → `import { useAppStore } from "@/store/useAppStore"`（读 chatMessages/workerOnline） | 红线 3 | 🔴 违规，需收敛 |
| D-2 | **base 反向 import Store 类型**（type-only） | `src/base/platform/p2p/transport.ts:12`、`supabase.ts:23` → `import type { WaveBundle } from "@/store/useWaveStore"` | 红线 3 | 🟡 轻度（type-only，但 WaveBundle 契约应上收 `src/types/`） |
| D-3 | **业务实体名词硬编码于 base** | `broadcast.ts:107` requiresVerified 默认含「陪诊陪护/家政保洁/厨师/上门」；`sentinel.ts:56` HOME_ACCESS_KEYWORDS 7 个业务词（进家判定未走 ammo 参数）；`decompose.ts:98` isOnsite 正则含业务词；`booking.ts:27-29` iconFor emoji 映射；`llmEngine/mockEngine` 分类话术硬编码 | 红线 3（严禁业务实体名词） | 🔴 主要违规；部分已有 ammo 覆盖路径（dispatch-rule），sentinel 进家词应迁入 `ammo/risk-rule` 引信参数 |
| D-4 | **父项目 API 层隔离墙未闭合**：99 路由直连 Supabase，资金/状态跃迁不经 base 确定性引擎 | `app/api/payment/release/route.ts`、`app/api/orders/**`、`app/api/disputes/**` | 红线 1（精神） | 🟡 历史遗留（宪法 §2 不算违规，但每次结构性改动须收敛） |
| D-5 | **两套状态机并存**：base 纯函数状态机（waves） vs 父项目 DB 状态机（orders/contracts） | `lib/protocol/engine.ts` + `supabase/migrations/001~` | 红线 1/3 | 🟡 融合期双轨，ADR-0018 后仍存 |
| D-6 | **AmmoRunner 未实现**：四表被各引擎散点消费（`dispatchRuleFor`、`riskOf`…），无统一声明式解析执行器 | `src/ammo/index.ts`（仅 re-export） | 红线 2 | 🟡 表驱动已达成，统一运行时缺失 |
| D-7 | **弹药层与存量协议层重复**：`lib/protocol/protocols/housekeeping.ts`、`dating.ts` 已是垂直 SOP，但未并入 ammo 声明式体系 | `src/lib/protocol/protocols/*` | 红线 2（精神） | 🟡 存量候选弹药，待收编 |
| D-8 | **前端视界投影未隔离**：全局单主题（oto-ui），无弹药专属主题 Token/Layout | `src/components/theme/`、`oto-ui/` | 红线 6 | 🔴 缺失（哲学架构已定义 §五 5.4，落地以 P2-1 弹药主题 Token 为第一执行点） |

### 5.3 【愿景提及但完全缺失】— 空白缺口（按优先级）

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

### 5.4 前端微内核与系统级交互架构（UI/UX 哲学注入）

> 人类创始人注入（2026-08-15）：前端与后端「40mm 发射筒 + 插拔弹药」达成全栈大统一。
> 前端架构 = **不变的外骨骼（Universal Shell）** × **流动的动态视口（Dynamic Scenario Core）**，
> 五态状态机直接投影为全局视觉锚点。

#### 5.4.1 容器心智模型：不变的外骨骼 + 流动的动态视口

- **外骨骼（Universal Shell · 固定屏幕物理锚点）**：
  - 顶部**五态灵动状态胶囊（Status Capsule）**：状态机 `toAtomicFiveState` 直接投影，
    常驻呼吸动画（广播中 ➔ 已锁定 ➔ 履约中 ➔ 待验收 ➔ 已结算），打消履约不确定感；
  - 右上角**全局安全中心（SOS）**；
  - 底部**万能操作栏（CTA）**；
  - 全局 **AI 语音浮窗**。
  - 定位：跨品类 **0 学习成本的肌肉记忆**，任何业务页面不得破坏其锚点位置。
- **动态视口（Dynamic Scenario Core · 场景自适应）**：
  - 由 `IAmmoDefinition` + JSON-Schema 驱动的中间视口，**毫秒级动态渲染表单与组件**；
  - 加载**场景专属微氛围**（家政素雅蓝 / 组局霓虹橙 / 陪玩星云紫）；
  - 定位：一切业务差异化只发生在视口内——严禁为单一品类硬编码独立全套页面。

#### 5.4.2 前端微内核 5 大交互法则（The 5 Interaction Laws）

| # | 法则 | 内容 |
|---|------|------|
| 一 | **外骨骼锁定肌肉记忆，视口渲染场景灵魂** | 主题 Token 隔离（外骨骼与视口视觉解耦），杜绝认知割裂 |
| 二 | **五态灵动胶囊（Universal 5-Stage Status Capsule）** | 状态机 `toAtomicFiveState` 直接投影为顶部常驻呼吸胶囊（广播中 ➔ 已锁定 ➔ 履约中 ➔ 待验收 ➔ 已结算） |
| 三 | **多重「数字人格」流体双模态（Multi-Persona Fluidity）** | 单手下滑手势瞬间切换【发单/消费视界】↔【接单/工人工作台】，通用钱包与信用分实时共享 |
| 四 | **AI 意图转单与「拟物草稿卡」（AI-Driven Intent Ingestion）** | 自然语言/语音输入 ➔ `decompose` 抽取 ➔ 屏幕中央浮现半拟物化磨砂透明【订单草稿卡（Draft Card）】➔ 用户微调确认发射 |
| 五 | **隐形防御与显性物理触感锚点（Invisible Shield & Explicit Anchors）** | 隐私全链路动态脱敏；关键履约节点强物理触感（50m 电子围栏微震反馈 + 完工碰一碰 NFC/扫码全屏水波纹动效与机械锁合音效） |

#### 5.4.3 前端组件三层挂载映射图谱

| 层 | 职责 | 组件（✅ 存量就绪 / 待建） |
|----|------|----------------------------|
| **外骨骼层 Shell Layer** | 全局物理锚点，跨品类恒在 | `StatusCapsule`（待建）· `FloatingDock` ✅ · `SafetyKit`(SOS) ✅ · `VoiceBar` ✅ |
| **视口层 Viewport Layer** | 弹药驱动业务渲染（IAmmoDefinition + JSON-Schema） | `PublishSheet` ✅ · `DynamicFormView` ✅ · `WaveFeed` ✅ · `MyWaves` ✅ · 弹药定制面板（增项报价 / AA 分摊 / 到场扫码，待建） |
| **物理与感知层 Sensory Layer** | 硬件与空间感知 | `ScanMockSheet`（真相机扫码）✅ · `SpatialHeatMap`（LBS 地图）✅ · `FurnitureScene`（3D 舞台）✅ |

#### 5.4.4 与存量缺口的承接

- 承接 **D-8**（前端视界投影未隔离）与 **P2-1**（弹药主题 Token 系统）：法则一（主题 Token 隔离）与视口场景微氛围即为其哲学定义，落地以弹药主题 Token（P2-1）为第一执行点；
- 承接 **P1-5**（弹药内嵌表单 schema）：法则四草稿卡与视口动态表单由 `IAmmoDefinition` 驱动即为其统一形态（`DynamicFormView` 通用引擎已就绪，弹药表单绑定待建）；
- 与 §四 4.3 Phase 2 弹药可插拔验收对齐：**前端侧「同底座换弹药」验收标准 = 外骨骼零改动 + 视口按弹药切换**（housekeeping ↔ meetup ↔ companion 引信与微氛围勾选即生效）。

### 5.5 UI/UX 全景系统架构：4 层体系与 5 态镜像视口标准

> 人类创始人注入（2026-08-15）：将 5.4 的前端微内核哲学细化为可执行的全景系统架构。
> 契约落位：`src/types/ui-viewport.ts`（视口插槽契约，纯类型零依赖，红线 3）。

#### 5.5.1 第一层：设计令牌与微氛围层（Design Tokens & Theming）

- **全局基础灰阶与空间栅格**：跨场景恒定的中性底色、间距/圆角/栅格体系（外骨骼的视觉地基）；
- **三大场景特化微主色 Token**：
  - `theme-housekeeping` 家政专业蓝（素雅蓝微氛围）；
  - `theme-meetup` 组局活力橙（霓虹橙微氛围）；
  - `theme-companion` 交友夜幕紫（星云紫微氛围）；
- **适老化高对比度排版引擎**：大字/大触控区适老模式（承接 5.5.4 无障碍容灾层，Token 级切换）。

#### 5.5.2 第二层：全局通用交互骨架（Universal Shell Framework）

| 骨架件 | 职责 | 契约 | 存量 |
|--------|------|------|------|
| **顶部灵动状态胶囊（Top Status Capsule）** | 状态五态同步（`toAtomicFiveState` 投影）+ 弱网离线预警 + LBS 指示 | `IStatusCapsuleState` | 待建（5.4.3 外骨骼层首项） |
| **全局多重人格坞（Persona Dock）** | 雇主 / 服务商 / 组局者角色单手极速切换（法则三） | `IPersonaDockState` | 存量雏形：`FloatingDock` + `WorkerWorkbench` 双工人台 |
| **悬浮智能中枢（AI Copilot Orb）** | 语音转单（法则四入口）+ 智能小法官直达入口 | `ICopilotOrbState` | 存量雏形：`VoiceBar` + `JudgePanel` |
| **全局底线防护栏（Global Safety Guard）** | 一键红色 SOS + 隐私行程分享（法则五） | `ISafetyGuardState` | 存量：`SafetyKit` 四件套 ✅ |

#### 5.5.3 第三层：动态视图与插槽渲染层（Dynamic Viewport & 5-State Slots）

**5 态镜像视口标准**：视口与五态原子状态机一一镜像（`AtomicFiveState` ↔ `ViewportStage`），
任何弹药在任何阶段只渲染对应视口，视口内以弹药特化插槽（Slot）承载差异化交互：

| 镜像 | 视口 | 核心交互 | 插槽契约 |
|------|------|----------|----------|
| `PUBLISHED` | **A. 需求发布视口（Drafting View）** | 对话流草稿卡（法则四）+ JSON-Schema 动态表单 | `IDraftingSlotProps` |
| `MATCHED` | **B. 撮合与匹配视口（Matching View）** | 雷达扫描波纹 + 抢单大厅 + 向量打分卡 | `IMatchingSlotProps` |
| `IN_SERVICE` | **C. 履约时空视口（Fulfillment View）** | LBS 3D 轨迹图 + 虚拟通信条 + 离线事务栏 | `IFulfillmentSlotProps` |
| `INSPECTED` | **D. 验收与对账视口（Inspection View）** | 弹药特化插槽（前后照片比对 / AA 滑块 / 增项弹窗）+ 物理碰一碰(NFC)/动态码全屏核销 | `IInspectionSlotProps` |
| `SETTLED` | **E. 结算与信用视口（Settlement View）** | 多方分账抽屉 + 六维雷达打分板 + 跨场景积分动效 | `ISettlementSlotProps` |

**弹药特化插槽原则**（红线 2 / 5.4.4）：同一视口内按弹药切换插槽内容——
保洁走「前后照片比对 + 增项弹窗」、组局走「AA 分摊滑块 + 到场扫码核销」、
交友走「背调徽章 + 虚拟号接通」；**外骨骼层（5.5.2）零改动**。

#### 5.5.4 第四层：极端场景与无障碍容灾交互（Edge-Cases & Accessibility）

- **弱网离线半透明提示条**：`IOfflineBannerState`（宪法 #10 降级是设计的一部分，离线事务栏可见性提示）；
- **大字/大触控区适老模式**：`ISeniorModeTokens`（承接 5.5.1 适老化排版引擎，44px 触控 + 高对比度）；
- 🛡️ **防暴力伪装计算器界面**（`IStealthCalculatorState`）：高危场景下以标准计算器形态掩护，
  通过特定数字组合静默触发报警与音频回传（隐私是血液规则，宪法 #8 的极端物理防护形态）。

#### 5.5.5 视口契约落位与承接

- 契约文件：`src/types/ui-viewport.ts`（`ScenarioTheme` / `ViewportStage` / 五视口插槽 Props /
  四骨架件 State / 容灾三态，纯类型零依赖，红线 3 `UI ➔ base ➔ types` 单向流动）；
- 承接 **P1-5**（弹药内嵌表单 schema）+ **P2-1**（弹药主题 Token）：5.5.1 微主色 Token 即 P2-1 落地形态、
  5.5.3 视口插槽即 P1-5 落地形态；
- 与 5.4.3 映射：三层挂载图谱中的「视口层弹药定制面板（增项报价 / AA 分摊 / 到场扫码，待建）」
  即 5.5.3 的 D 视口弹药特化插槽清单。

### 5.6 端到端三大核心页面拓扑与交互流转标准

> 人类创始人注入（2026-08-15）：三大主屏 = 外骨骼（5.4.1）+ 视口（5.5.3）的可运行落地形态。
> 第一阶段组件：`StatusCapsule`（外骨骼首件）+ `DynamicDraftCard`（A 视口首件）。

#### 5.6.1 页面一：动态发布页（Dynamic Launchpad）

```
┌────────────────────────────────────────────────────────────────────┐
│ ● StatusCapsule（顶部外骨骼）── [🟡 寻找服务者中...]  🔴SOS  📴   │ ← 五态胶囊常驻
├────────────────────────────────────────────────────────────────────┤
│ AI Copilot Orb（悬浮智能中枢）· 语音/文字输入 ➔ decompose 抽取      │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ ✦ DynamicDraftCard（拟物草稿卡 · 半拟物磨砂玻璃 + 高光边框）    │ │
│ │   结构化参数：户型 / 时长 / 工具 / 座次…（点击微调）            │ │ ← A 视口 PUBLISHED
│ │   预估费用：¥450（HOURLY ¥150/h × 3h）                         │ │    弹药驱动渲染
│ │   安全徽章：🛡️已投保财产险 · 🔒定金托管 · 📞虚拟号保护          │ │ ← IFuzePolicy 投影
│ │   [ 扣动扳机·一键发布 ]  ← 标准化 CTA                          │ │
│ └────────────────────────────────────────────────────────────────┘ │
│ 弹药切换：housekeeping（家政蓝/固定时薪/碰炸引信）                  │
│          ↔ meetup（组局橙/人均计价/延期+近炸双引信）               │
└────────────────────────────────────────────────────────────────────┘
```

- **字段构成**：`IAmmoDefinition`（category → `getAmmoDefinition` 整弹解析）驱动——
  结构化参数来自 `ammo.sop` 默认值、预估费用来自 `pricingModel`、安全徽章来自 `fuzePolicy`；
- **状态机驱动关系**：CTA 发射后订单进入 `PUBLISHED`，胶囊切换为广播脉冲黄；
- **宪法落位**：红线 2（禁止品类硬编码全套页面——视口按弹药装载）、法则四（AI 意图转单草稿卡）。

#### 5.6.2 页面二：通用五态履约主屏（Universal Fulfillment Cockpit）

```
┌────────────────────────────────────────────────────────────────────┐
│ ● StatusCapsule（顶部外骨骼）── [🔵 服务者已就位]  🔴SOS  📴       │ ← 五态实时镜像
├────────────────────────────────────────────────────────────────────┤
│ ┌─────────────── 视口区（按五态切换，同一视口内换弹药插槽）────────┐ │
│ │ B 撮合视口  C 履约视口      D 验收视口        E 结算视口       │ │
│ │ 雷达波纹      LBS 3D 轨迹    照片比对/AA滑块    多方分账抽屉    │ │
│ │ 抢单大厅      虚拟通信条      增项弹窗/NFC核销   六维雷达打分    │ │
│ │ 向量打分卡    离线事务栏      （弹药特化插槽）   跨场景积分动效  │ │
│ └────────────────────────────────────────────────────────────────┘ │
│ Persona Dock（多重人格坞）· Safety Guard（一键红 SOS/行程分享）     │
└────────────────────────────────────────────────────────────────────┘
```

- **字段构成**：五态镜像视口（5.5.3 标准）——`AtomicFiveState` 推进即视口切换，
  D 视口内按弹药切换特化插槽（保洁前后照片 / 组局 AA 滑块 / 交友背调徽章）；
- **状态机驱动关系**：`advanceLifecycle` 每次跃迁 → 胶囊呼吸色变 + 视口区整段切换；
  违约/超时经 `ITerminationEvent` 分支（BREACH_SETTLED/EXPIRED）直接流转结算视口；
- **宪法落位**：法则二（五态灵动胶囊打消履约不确定感）、法则五（NFC/扫码物理核销触感）。

#### 5.6.3 页面三：争议调解与小法官半屏抽屉（Dispute & AI Arbitration Sheet）

```
┌────────────────────────────────────────────────────────────────────┐
│ ● StatusCapsule（顶部外骨骼）── [🟠 待验收与对账]  🔴SOS  📴        │
├────────────────────────────────────────────────────────────────────┤
│ （主屏：D 验收视口 · 争议触点处半屏上滑）                           │
│ ════════════════════ 半屏抽屉（bottom-sheet 上滑）═══════════════ │
│  ▍争议陈述（双方证据链展列：照片/定位/聊天哈希锚点）                │ ← 数据湖存证
│  ▍AI 小法官裁定卡（LLM → 失败回落确定性规则，仅 Advisory）         │ ← L3-M3
│  ▍赔付建议 ¥xxx（recommendedRefundAmount）+ 理由链                 │
│  ─────────────────────────────────────────────                    │
│  [ 采纳裁定并结算 ]  [ 提交人工仲裁 ]                              │ ← 红线 1：写入由用户确认
└────────────────────────────────────────────────────────────────────┘
```

- **字段构成**：争议证据链（8 类事件标签：sos/location_ping/photo/chat_transcript…）+ 小法官
  裁定卡（`recommendedRefundAmount` 建议值）+ 双出口（采纳结算 / 人工仲裁）；
- **状态机驱动关系**：抽屉挂载于 D→E 跃迁窗口（INSPECTED 争议中态）；
  「采纳裁定并结算」→ `SETTLED`（BREACH_SETTLED 违约赔付载荷入 `ITerminationEvent.payload`）；
- **宪法落位**：红线 1（隔离墙：LLM 结果仅 Advisory，写入由用户确认动作执行）、
  宪法 #7（LLM 介入：定责环节默认评估 LLM 接入，含降级链）、法则五（隐形防御）。

### 5.7 三大典型业务场景 UI 插槽特化全景对比矩阵

> 人类创始人注入（2026-08-15）：三大标杆弹药（housekeeping-v1 / meetup-social-v1 / companion 预备役）
> 在 6 大交互维度的特化标准。契约落位 `src/types/ui-viewport.ts`（`ICompanionSlotProps` 增补）；
> 组件落位 `src/components/waves/slots/`（HousekeepingSlot / MeetupSlot / CompanionSlot）
> + `FulfillmentCockpit`（通用五态履约主屏，外骨骼 + 视口插槽 + 核销 CTA 三区组装）。

| 维度 | 家政保洁（重入户 · 清洁蓝 theme-housekeeping） | 组局社交（轻履约 · 活力橙 theme-meetup） | 同城陪玩（高人身风险 · 夜幕紫 theme-companion） |
|------|------------------------------------------------|------------------------------------------|--------------------------------------------------|
| **1. 主题微色调** | 专业蓝（素雅沉静，重信任） | 活力橙（热闹松弛，轻社交） | 夜幕紫（星云神秘 + 高防护警示感） |
| **2. 发布页动态组件** | 户型/面积/时长/工具清单 + 时薪计价（HOURLY） | 日期/人数/场地方位/座次 + 人均 AA（PER_SEAT） | 时长/兴趣标签/见面商圈 + 时薪+平台防护附加项 |
| **3. 匹配等待动效** | 单人卡片雷达波纹（1v1 撮合） | 多人拼位波纹 + 候补席动画（多对多） | 背调徽章扫描动效 + 双向确认门（防骚扰预筛选） |
| **4. 履约核心特化插槽** | **增项双拍**：现场增项改价确认单 + Before/After 双拍照片池 + 损坏包赔直连 | **座次 AA 围栏**：实时座次表（到场/未到场）+ 500m 签到围栏 + AA 多退少补对账 | **隐私盾 + 伪装电话**：虚拟号保护 + 实时行程守护 + 📱一键伪装假电话脱身 |
| **5. 核销完工动作** | 双方碰一碰 NFC / 雇主验收清单打钩 | 组织者点选到场成员解冻定金（扫码验真） | 300m 脱离安全距离自动停表 / 手动确认 |
| **6. 争议与售后入口** | 损坏直赔（财产险理赔直连） | 放鸽子申诉（爽约押金判归守约方） | 一键拉黑 + AI 敏感词干预（骚扰即时拦截） |

- **契约挂载**：`IInspectionSlotProps.special`（photoCompare / aaSplit / onsiteQuote）承接家政与组局列；
  `ICompanionSlotProps`（isPrivacyShieldArmed / onTriggerFakeCall / departureDistanceMeters 默认 300m /
  onBlockUser）承接陪玩列——**外骨骼零改动，差异全部收敛在插槽区**（红线 2 + 5.4.4 验收标准）；
- **弹药映射**：`getAmmoDefinition(category)` 整弹解析 → 视口按 ammoId 装载对应插槽：
  `housekeeping-v1` → HousekeepingSlot、`meetup-social-v1`（meetup/dating/social 键）→ MeetupSlot、
  待装填 companion-v1 → CompanionSlot（当前按 scenario 键直挂，弹药表配置后自动收编）；
- **宪法落位**：宪法 #8（隐私血液规则：虚拟号/脱敏/拉黑）、#4（引信跟弹药走：防护随场景切换）、
  红线 4（零信任物理感知：双拍/扫码/围栏验真）。

### 5.8 极端状态与特殊人群 UX 兜底策略（Tier-4 Edge Cases & Accessibility）

> 人类创始人注入（2026-08-15）：第四层（5.5.4）从契约升级为可运行组件。
> 组件落位 `src/components/oto-ui/`：`StealthCalculator` / `SeniorModeView` / `OfflineQueueIndicator`。

#### 5.8.1 弱网断网离线态（Offline Graceful Degradation · 宪法 #10 降级是设计的一部分）

- **灵动胶囊变灰**：`StatusCapsule` 接收 `isOffline` 后胶囊转灰阶（📴 离线徽标，弱网预警）；
- **按钮排队文案**：离线时提交类 CTA 不消失，改为「已加入离线队列」排队语义（本地加密队列暂存，
  红线 4 加密语义）；
- **网络恢复自动追回 Toast**：`OfflineQueueIndicator` 监听 `isOffline` 由 true→false，
  绿色动态 Toast 播报「✅ 网络已恢复：X 笔数据已自动追回同步」（X = 恢复前暂存笔数）。

#### 5.8.2 适老化极简模式（Senior Mode · WCAG AAA 硬标准）

| 规格 | 标准 |
|------|------|
| 字阶 | 全局 1.4× 缩放（14px → 19.6px 起） |
| 对比度 | ≥ 7:1（黑 #000 / 白 #fff / 黄 #ffd60a 三色系，AAA 级） |
| 触控热区 | ≥ 56×56pt（≈75×75px）巨型热区 |
| 主屏 | 仅双主按钮：🎙️ 大麦克风语音一键发单（按住即说话 + 超大确认弹窗）+ 📞 电话联系客服（24h 适老热线） |
| 交互 | 隐藏级联菜单与参数；关键操作一律超大确认/取消弹窗防误触 |

#### 5.8.3 极端危险「静默伪装」防护（Silent Panic UI · 宪法 #8 极端物理防护形态）

- **标准计算器界面掩护**：`StealthCalculator` 呈现外观与功能完全真实的四则运算计算器
  （数字 0-9 / +−×÷ / C / =，真实运算结果展示），施暴者无法从界面察觉异样；
- **特定暗号静默触发**：输入 `911=` 或 `110=` 时——界面**继续正常显示计算结果**（零视觉闪烁），
  后台静默调用 `onTriggerSilentAlarm({ code, at, recordingReady: true, sequence })`
  触发红色危机流程并标记录音就绪（后台加密录音/录像直传安全中心，L4-M4 链路）；
- **紧急脱身出口**：顶栏**双击或长按 800ms** 退出伪装模式（`onExitPanicMode`），
  与 5.5.4 `IStealthCalculatorState`（masked / armCode / audioReportReady）契约对齐。

---

## 六、收敛路线（宪法门禁衔接）1. **每个结构性改动收敛一处 D 类偏差**，commit 说明标注「宪法收敛：条文 #3」（或对应红线），登记 `docs/CONVERGENCE-LOG.md`，过 `npm run check:convergence`（exit 0）方可提交。
2. **建议收敛顺序**：D-2（WaveBundle 契约上收 `src/types/`，改动最小）→ D-1（llmEngine/mockEngine 注入化）→ D-3（sentinel 进家词迁 ammo/risk-rule）→ D-6（AmmoRunner 第一版，同时承载 P0-1）→ D-4/D-5（父项目 API 收编，最大工程）。
3. **空白缺口开工须走宪法 §4 模板**（六圈定位声明 + 宪法条文对照），P0 级缺口开工前由人类裁决排期。

---

## 七、修订记录

| 日期 | 修订 | 裁决人 |
|------|------|--------|
| 2026-08-15 | 初版定稿：元宪法四层 + 六红线固化 + 全仓归属映射 + 落差审计（D1-D8 + P0-P2 缺口） | 用户 |
| 2026-08-15 | **核心设计模型注入**：新增 §二 万能底座五态原子状态机（Published➔Matched➔In-Service➔Inspected➔Settled + 伴生事件 Sub-Events 插拔）+ 三类风控引信矩阵（💥碰炸/⏳延期/📡近炸）+ 数字人格信用飞轮；契约落位 `src/types/ammo-schema.ts` + `src/types/fuze-policy.ts`；原章节顺延（三~六） | 用户 |
| 2026-08-15 | **28 模块主蓝图注入**：§三 3.4 升级为「六层防御圈 × 28 核心模块职责矩阵」——标准模块编号 `L1-M1`～`L6-M4` 定为全项目永久唯一编号标准 + 六层职责矩阵 + 26 行代码落位与成熟度对照表（实测 🟢13 已闭环 / 🟡12 有雏形 / ⚪️1 待建设，清单净 26 模块，标题口径差量已标注待裁决） | 用户 |
| 2026-08-15 | **三阶段推进路线图注入**：新增 §四「平台落地推进路线图」——Phase 1 MVP 验证期（0➔1，housekeeping.ammo.ts 碰炸引信）/ Phase 2 体系成熟期（1➔10，meetup 延期 + companion 近炸）/ Phase 3 规模壁垒期（10➔100，弱网/容灾/熔断/存证）；每阶段绑定模块编号 + 缺口衔接 + 现状标注；顺带修正小节编号（§三 2.x→3.x、落差审计 3.x→5.x），全文档编号体系收敛 | 用户 |
| 2026-08-15 | **前端微内核交互架构注入**：§五 5.4 新增「前端微内核与系统级交互架构」——容器心智模型（不变外骨骼 × 流动动态视口）+ 前端微内核 5 大交互法则（主题 Token 隔离 / 五态灵动胶囊 / 多数字人格流体双模态 / AI 意图转单拟物草稿卡 / 隐形防御显性物理触感）+ 组件三层挂载映射图谱（外骨骼 / 视口 / 物理感知）；D-8 判定挂接 5.4 与 P2-1；与 §四 Phase 2 弹药可插拔验收对齐（外骨骼零改动 + 视口按弹药切换） | 用户 |
| 2026-08-15 | **UI/UX 全景系统架构注入**：§五 5.5 新增「4 层体系与 5 态镜像视口标准」——①设计令牌与微氛围层（灰阶栅格 + 三大场景微主色 `theme-housekeeping` 蓝 / `theme-meetup` 橙 / `theme-companion` 紫 + 适老化高对比排版引擎）②全局通用交互骨架层（顶部状态胶囊 / 多重人格坞 / AI Copilot Orb / 全局底线防护栏）③动态视图与插槽渲染层（五态镜像视口 `AtomicFiveState` ↔ `ViewportStage`：Drafting/Matching/Fulfillment/Inspection/Settlement + 弹药特化插槽）④极端场景与无障碍容灾层（弱网半透明提示条 / 适老模式 / 🛡️防暴力伪装计算器）；契约落位 `src/types/ui-viewport.ts`（纯类型零依赖）；承接 P1-5（视口插槽）+ P2-1（微主色 Token） | 用户 |
| 2026-08-15 | **端到端三大核心页面拓扑注入**：§五 5.6 新增「三大核心页面拓扑与交互流转标准」——①动态发布页 Dynamic Launchpad（ASCII 线框：StatusCapsule + Copilot Orb + DynamicDraftCard 拟物草稿卡 + 弹药切换，CTA 发射 ➔ PUBLISHED）②通用五态履约主屏 Universal Fulfillment Cockpit（五态镜像视口区按态切换、D 视口弹药特化插槽、advanceLifecycle 跃迁驱动胶囊+视口联动、终止事件分支直入结算视口）③争议调解与小法官半屏抽屉 Dispute & AI Arbitration Sheet（半屏上滑、证据链展列、小法官 Advisory 裁定卡、双出口：采纳结算/人工仲裁，红线 1 写入由用户确认）；每屏标注字段构成 + 状态机驱动关系 + 宪法落位 | 用户 |
| 2026-08-15 | **三大场景 UI 插槽特化矩阵注入**：§五 5.7 新增「三大典型业务场景 UI 插槽特化全景对比矩阵」——家政保洁（重入户/清洁蓝）/ 组局社交（轻履约/活力橙）/ 同城陪玩（高人身风险/夜幕紫）6 大交互维度特化标准：①主题微色调 ②发布页动态组件（户型清单 vs 座次 vs 兴趣标签）③匹配等待动效（1v1 雷达 vs 拼位候补 vs 背调扫描门）④履约核心特化插槽（增项双拍 vs 座次 AA 围栏 vs 隐私盾+伪装电话）⑤核销完工动作（NFC 碰碰 vs 组织者解冻 vs 300m 脱离自动停表）⑥争议售后入口（损坏直赔 vs 放鸽子申诉 vs 一键拉黑敏感词）；契约增补 `src/types/ui-viewport.ts` `ICompanionSlotProps`（isPrivacyShieldArmed / onTriggerFakeCall / departureDistanceMeters 默认 300m / onBlockUser）+ `IViewportSlots.companion` 挂载位；外骨骼零改动差异全收敛插槽区（红线 2） | 用户 |
| 2026-08-15 | **Tier-4 极端状态与特殊人群 UX 兜底策略注入**：§五 5.8 新增三大容灾交互标准——①弱网断网离线态（胶囊变灰 + 按钮排队文案 + 网络恢复自动追回 Toast）；②适老化极简模式（1.4× 字阶 / WCAG AAA 7:1 黑白色黄三色系 / 56×56pt 巨型触控热区 / 仅双主按钮：大麦克风语音发单 + 24h 客服热线 / 关键操作超大确认弹窗）；③极端危险静默伪装防护（标准计算器界面掩护 + 真实四则运算 + `911=`/`110=` 暗号静默触发报警零视觉闪烁 + 后台加密录音录像直传安全中心 + 顶栏双击/长按 800ms 紧急脱身）；与 5.5.4 `IStealthCalculatorState` 契约对齐（masked / armCode / audioReportReady） | 用户 |
