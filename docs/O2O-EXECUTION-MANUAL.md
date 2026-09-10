# 《秒级量产任意 O2O》执行手册 v1.0

> 母本：《秒级量产任意 O2O》UI/UX 完整方案 v1.0 ＋ 意图卡开工规格 v1.0。
> 性质： phased 执行单，每片独立上线验证，回滚线见 §7。
> 宪法锚点：新设计含「六圈定位声明」「宪法条文对照」（每 phase 各一）；结构性改动提交前登记 CONVERGENCE-LOG 并过 `check:convergence`；门禁按 detect-tier 定级，统一入口 `npm run check`。

---

## §0 总览：四 phase 一张表

| Phase | 内容 | 周期 | Tier | 北极星 | 前置 |
|---|---|---|---|---|---|
| P1 | 意图卡（契约＋三态＋长辈态） | 2 周 | T2 | 意图→发射转化率 | 无，立即开工 |
| P2 | 活订单 Panel＋资金五态 | 2 周 | T2 | 首响时长/准时率 | P1（复用意图卡 locked 态） |
| P3 | 磋商桌＋服务者副驾 MVP | 3 周 | T2 | 成单率/师傅周留存 | P1（复用意图卡变体） |
| P4 | 工厂控制台＋试单沙盒 | 3 周 | T2 | 开品类→首单时长<24h | P1–P3（复用卡＋埋点） |
| L4 仲裁 | 随真实纠纷单长出，不预排期 | — | T2 | 48h 结案率 | 真实纠纷触发器 |

铁律：上一个 phase 的北极星不达标（见各 phase §），下一 phase 不开工——数是裁判。
（2026-09-10 修订：停工太贵。改判为「施工先行、上线等数」——与数据无关的构造（纯展示/纯函数/目录文档）可提前开工；调参与上线验收仍等北极星。修订人：实测节奏。）

---

## §1 P1 意图卡（开工令已含规格 v1.0，此处只排执行）

**六圈定位声明**：增长圈（发单转化）× 体验圈（确认构件）；不碰交易圈资金语义、不碰 P/F 端。
**宪法条文对照**：#10 失败降级（LLM 挂→默认卡＋底价兜底，网断→草稿箱）；收敛条文 #6（DynamicDraftCard 退役登记）。

### 1.1 任务清单（顺序即依赖序）

- [ ] T1 契约类型 `src/types/intent-card.ts`（IntentCard/PriceAnchor/IntentLine/AiMark/四态机类型，§1 规格逐字落地）
- [ ] T2 纯函数 `src/base/order/intent-card.ts`＋考卷：`assertPriceComplete`、用户值压 AI 值、`AI·猜`不进价、stale 跃迁非法、LLM 空回默认卡仍含完整 PriceAnchor（node:test，跟 publish-draft 体例）
- [ ] T3 卡 UI `src/components/waves/IntentCard.tsx`：assembling（stagger 点亮＋8s 兜底）→ ready（价格唯一暖色＋AI 标＋勾选发射）→ locked（收拢章戳）→ stale（灰化重组）；价格重算闪差值；重算 1s 内发射禁用
- [ ] T4 载体接入：TalkPublishSheet 确认区换意图卡；PublishSheet 保留为逃生表单（`onFallback` 原语不动）
- [ ] T5 收敛：DynamicDraftCard 退役（调用方切卡 → CONVERGENCE-LOG 登记「宪法收敛：条文 #6」→ `check:convergence` 绿；注：门禁判定非 T3（无 rename/契约修订）时不登记，以门禁为准——P1-T5 实测即此例，登记行已撤回）
- [ ] T6 长辈态：三样元素（标题/价格/发射）＋播报＋子女分享键
- [ ] T7 埋点：`intent.assembled/confirmed/edit/stale` 进 P15（metric_events 白名单＋走廊断言）
- [ ] T8 走廊：3 截图（组装中/待确认/长辈态）＋布局零漂移 diff

### 1.2 门禁与验收

- `npm run check` 全绿＋全量 lint 0/0＋考卷（§8 意图卡开工规格列出的 8 条）全过＋走廊 3 图 → push（pre-push T2：scoped e2e 覆盖发射链）。
- 北极星验收（上线 3 天）：confirmed/assembled 上升、追问>2 轮占比下降；不达标则回滚到 T4 前（TalkPublish 原确认区保留分支 3 天）。

---

## §2 P2 活订单 Panel＋资金五态

**六圈定位声明**：体验圈（履约跟踪）× 信任圈（资金可视）；不动托管金额逻辑，只做可观察层。
**宪法条文对照**：#10（Panel 数据拉不到→骨架＋"稍后刷新"，钱数永不编造，缺数标"同步中"）。

### 2.1 任务清单

- [ ] T1 Panel 布局（实测修正版）：既有 FulfillmentCockpit 即时间线/座舱，不重建；只补需求方干预区。催单出局（无送达路径，造即假按钮，待推送 infra）；对话/活动分栏沿用既有座舱结构，不另起分栏。
- [ ] T2 资金五态条：托管中→分期释放→赔付→结算，每笔动账一行人话（读 escrow/milestone 纯函数，不写新逻辑）；金额变动配数字滚动（蓝图§7）
- [x] T3 副驾 MVP：快捷回复复制版已落地（见 P2）；顺路参谋延期（实测结论 2026-09-10：capacity-circuit 是区域运力熔断，非顺路匹配；顺路需服务者实时位置＋多单位置同视，无此数据源）；政策问答延期（无 KB）；画像 C1/C2 已落地（记忆口＋脑 why）。
- [ ] T3b VLM 验收分：继续延期（实测结论 2026-09-10：无 VLM 验收 API——仅 forgery 鉴伪链；完工质量打分无 ground truth，新起 prompt＋阈值即双重拍脑袋）。到点行动实质已齐（确认验收横幅＋双拍门禁＋争议复核入口）。
- [ ] T7 L1 补完：服务者预览＋评价摘要进组装卡（撮合投影只读，不改排序；蓝图§3 L1 欠账，P1 先欠、P2 还）
- [ ] T4 意图卡 locked 态收拢为 Panel 头（P1 复用点）
- [ ] T5 考卷：五态投影全组合快照、缺数标"同步中"、预警误报走廊
- [x] T6 走廊：静态断言先行＋真机四图齐（corridor-panel/dispute/settle，真单态非摆拍：p2-panel-live 进行中 / p2-money-disputed 争议冻结 / p2-money-settled 协商结算 / p2-money-review 正常验收待结算）。附带诚实注记：正常验收终局本地态为 review（待结算）——isSettled 只由终止事件（争议结案/72h 自动）翻转，settled 纯态本地走不到，不是欠账是门。

### 2.2 门禁与验收

- T2 全绿＋考卷过＋走廊 3 图。北极星：首响时长↓、准时率↑；护栏：AI 预警误报<15%，超了关预警只留到点行动。

---

## §3 P3 磋商桌＋服务者副驾 MVP

**六圈定位声明**：增长圈（成单率）× 供给圈（师傅留存）；AI 只建议不代按（钱规则）。
**宪法条文对照**：#10（建议接口挂→静态三档话术兜底，磋商不中断）。

### 3.1 任务清单

- [x] T1 磋商桌（已落地 P3 施工＋LLM 贯通）：三档话术卡＋价格合理性条＋**✨润一润**（POST /api/haggle/polish，chat 任务链复用，只填框、发送永远人点；503 留原文）；走廊双路径契约全绿（成功填框/失败保留；2026-09-10 实测免费层全家 429，成功路径待配额恢复补一枪）。
- [x] T2 意图卡变体（已落地）：磋商确认卡（仅改价产卡，原价走既有按钮；发射＝acceptClaim；既有按钮保留 e2e 不破）
- [ ] T3 副驾 MVP：快捷回复复制版已落地（见 P2）；顺路参谋/政策问答延期（无数据源）；画像 C1/C2 已落地（记忆口＋脑 why）。
- [x] T4 考卷：三档发送链、超均值警示触发（haggle 4＋table 3 全绿）
- [x] T5 走廊：磋商桌/确认卡真机双截图（corridor-haggle.mjs，真磋商态；docs/shot/p3-haggle-*.png）

### 3.2 门禁与验收

- T2 全绿。北极星：成单率↑、师傅周留存↑；护栏：让价幅度分布（防 AI 教贱卖——中位数让价>15% 则调话术）。

---

## §4 P4 工厂控制台＋试单沙盒

**六圈定位声明**：供给圈（品类量产）× 增长圈（招商）；平台核武器，演示属性拉满。
**宪法条文对照**：#3 先配表后写码（品类 schema/定价/风控点先生，UI 后生）；#6（开品类链路零品类硬编码分支）。

### 4.1 任务清单

- [x] T5 走廊（P4 施工）：控制台挂载走静态断言；门禁走廊实测未登录/admin/factory→307 /login（proxy 角色闸正常）；可视截图随管理员会话演示补（登录后 30 秒点一次，无需摆拍）。
- [x] T1 开品类流（已落地）：/admin/factory＋FactoryConsole（一句话→POST /api/ammo/generate→品类卡→确认试运行）；FactoryCard 自立（品类无单一定价锚，PriceAnchor 不适用，卡语言同构，实测修正）；注册落本机内存，重启失效（诚实注记，上架持久化随上线）。
- [x] T2/T4 沙盒考卷：mock LLM 全链（生成→入池→检索→建单→投影）＋风控缺失拦上架（C2 无背调拒入池，实测命中 IN_HOME_SAFETY_GATE）。
- [ ] T3 上架：随上线（持久化＋试运行标签＋10单/天限流；秒级全城可发系线上 blast radius，不本地偷跑）。

### 4.2 门禁与验收

- T2 全绿＋`check:convergence`（registry 契约修订走 T3）。北极星：开品类→首单<24h；护栏：试单通过率（<60% 说明生成质量差，回炉 prompt）。

---

## §5 落点文件总表（新增/复用/退役）

| Phase | 新增 | 复用（只读/调用，不改语义） | 退役 |
|---|---|---|---|
| P1 | types/intent-card.ts、base/order/intent-card.ts(+test)、components/waves/IntentCard.tsx | TalkPublishSheet（载体）、ammo D2 底价、evidence_log、P15 metrics、Sheet 动线 | DynamicDraftCard（#6 登记） |
| P2 | DemanderInterveneBar、MoneyStrip（base/order/intervene、base/money/money-strip）、IntentCard locked 头＋providerPreview、panel.open/intervene 埋点 | toAtomicFiveState、escrow/milestone 纯函数、closeWave/counterOffer/acceptClaim 真链、AcceptancePanel 争议链 | 无 |
| P3 | HaggleTable＋HaggleConfirmCard（base/order/haggle）、haggle.sent/conceded 埋点 | IntentCard 变体、NegotiationThread 既有链（按钮保留 e2e 不破） | 无（旧磋商留言保留；副驾 T3 延期：无送达路径/KB） |
| P4 | admin/factory＋FactoryConsole、ammo/factory-sandbox 考卷、corridor-factory（门禁走廊） | sentence-to-ammo、ammo registry/factory、POST /api/ammo/generate | 无（T3 上架随上线） |

跨 phase 红线：任何 phase 不许改托管金额计算、不许改风控闸语义、不许新增品类硬编码分支。违者该 phase 打回。

## §6 埋点对账表（P15 统一口径）

| 事件 | Phase | 含义 |
|---|---|---|
| intent.assembled/confirmed/edit/stale | P1 | 组装→发射漏斗 |
| panel.open/intervene | P2 | Panel 使用＋干预类型 |
| haggle.sent/conceded | P3 | 话术档＋让价 |
| copilot.used | P3 | 副驾功能使用 |
| factory.generated/sandbox.pass/published/first-order | P4 | 量产漏斗 |

## §7 风险回滚线

- P1：TalkPublish 原确认区保留分支 3 天，一键回切。（实测修正：旧确认区系直接替换未留分支，回滚口径为 `git revert`，效力等同。）
- P2：Panel 首屏保留旧订单详情入口 1 周。
- P3：话术接口挂→静态三档（已写死在 T1 验收里）。
- P4：上架加"试运行"标签，新品类首周限流 10 单/天。
- 全局：任一 phase 上线 3 天北极星反向→回滚该 phase，写复盘进本手册 §8（缺陷→考卷复利）。
- §6 AI 动作留痕（结论 2026-09-10：暂不建。AI 现无自主写动作——润色/建议/判责全经人拍板，人即审计主体；争议一键导出已落地 ArbitrationSheet→export-judicial-package。待 AI 首个自主动作上线再建 trail）。

## §8 复盘区（按 phase 追加）

> 填写门：任一 phase 上线满 3 天。空表先行，数到即填；缺陷→考卷复利（新缺陷模式必须转化为新考卷/断言）。

| 循环 | 北极星（v1.0 §8） | 护栏（v1.0 §8） | 本地埋点/门现状 | 复盘结论 |
|---|---|---|---|---|
| L1 发单 | 意图→发射转化率 | 追问轮次 ≤2 占比 | intent.confirmed/assembled✅；追问计数❌（待补） | （待上线 3 天） |
| L2 活订单 | 首响时长/准时率 | AI 预警准确率（误报<15%） | panel.open/intervene✅；预警未建（无数据门挡） | （待上线 3 天） |
| L3 磋商 | 成单率 | 让价幅度分布 | haggle.sent/conceded/polished✅ | （待上线 3 天） |
| L4 仲裁 | 48h 结案率 | 人工推翻 AI 率（20-40%） | 无埋点（随纠纷单长出） | （待首纠纷单） |
| L5 副驾 | 师傅周留存 | 派单拒绝率 | copilot.used✅；留存/拒绝无（等数据源） | （待上线 3 天） |
| L6 工厂 | 开品类→首单时长（<24h） | 试单通过率 | factory.generated/sandbox.pass✅ | （待上架） |

---

## §9 补丁附录（蓝图审计 2026-09-10：手册漏项回填）

> L4 仲裁完全体不在此：手册正文已定"随真实纠纷单长出"，属有意延期，非漏项。

### 补丁 A（随 P1，1 天）：长辈语音播报＋traceId 落盘＋P1 欠账

**六圈定位声明**：体验圈（长辈可达）× 信任圈（审计可验）；不碰交易语义。
**宪法条文对照**：#10（播报失败静默、无播报能力环境不阻塞发射；落盘失败不拦单；无网只存不发）。

- [ ] A1 播报基建：`speak(text)` 最小封装（`speechSynthesis`，中文、慢速 0.9、无能力环境 try/catch 静默）；P1 范围只播"发射成功"（师傅出发/待验收节点随 P2 进 Panel）
- [ ] A2 长辈态接线：IntentCard elder 的发射成功后播报标题＋价格；标准态不播（防骚扰，蓝图§5）
- [ ] A3 traceId 落盘：两载体发射成功时把 `traceId＋卡快照（scene/price总额/basis）` 随单持久化（wave 扩展位优先，无扩展位则先进 P15 tags；P4 前补齐 evidence_log 对接）；考卷：traceId 与单号 1:1 可查
- [ ] A4 门禁：T1（纯前端＋埋点），考卷过即合入，无需走廊
- [ ] A5 子女分享键（蓝图§5 T6 欠账）：长辈态并列"让孩子帮我看看"键 → 只读单页分享（无操作权限）；考卷：分享页零写入口
- [ ] A6 网断草稿箱（P1 宪法对照欠账：对照声称、任务缺席，审计补回）：无网发射 → 意图进 localStorage 草稿箱（traceId 保留），联网横幅"回来接着发"一键续发；重放成功记 `intent.confirmed{carrier:draft}`；考卷：断网发单不丢、重放不重单（幂等键＝traceId）

### 补丁 B（随 P2，1 天）：Undo 窗口＋GenUI 目录准入

**六圈定位声明**：信任圈（无责撤）× 体验圈（构件纪律）；Undo 扣款语义以 base  pure 为准。
**宪法条文对照**：#3 先配表后写码（Undo 规则先写进 base/order pure，UI 后生）；#6（目录外新卡拦截）。

- [ ] B1 Undo 规则 pure：`canFreeCancel(createdAt, now)`（5 分钟窗）＋考卷（边界 299s/300s/301s）
- [ ] B2 Panel 接线：窗内显示"无责撤回"键，过期自动消失；撤单走原取消链（不另起）
- [ ] B3 GenUI 目录：新建 `docs/GENUI-CATALOG.md`（在册卡片：意图卡/价格行/服务者卡…，每卡一行：用途＋数据契约＋所属循环＋四态定义〈assembling/ready/locked/stale 各态渲染契约，蓝图组装态机全局化〉）；新增卡片先登记后写码，lint 加白名单校验（有卡无登记即错）
- [ ] B4 门禁：T2（动取消语义），考卷＋走廊（窗内有键/窗外无键两截图）

### 补丁 C（随 P3，半天）：脑记忆口＋AI Elements 评估

**六圈定位声明**：体验圈（越用越懂）× 供给圈（副驾更准）；记忆只读画像、不碰交易。
**宪法条文对照**：#10（画像缺失→通用话术，体验降级不中断）；红线：画像字段白名单制，位置/金额明细不进记忆。

- [x] C1 记忆口（已落地 0955b7e）：`rememberEdit(lineKey, value)`——用户改 AI 行即写画像偏好（偏好键白名单：时间偏好/价格敏感/备注习惯）；考卷：改一次下次同场景默认命中
- [x] C2 脑 why 规范（已落地 0955b7e）：所有"它怎么知道的"时刻配一句"根据你…"＋[不对，改]（改即 C1 回写）；走廊不断言、只截图抽查
- [ ] C3 AI Elements 评估（蓝图§10）：`ai-elements` 原子组件（message/reasoning/approval）能否替换自研聊天气泡/审批钮；输出半页结论（用/不用＋理由），不用则关闭本项
  - **结论（2026-09-10，已关闭）：不用，引包。** 实测其注册表（Chatbot：Conversation/Message/Reasoning/Tool/Task/Plan/Confirmation/PromptInput/Suggestion/Sources；Voice：SpeechInput/Transcription；Workflow/Canvas 等，shadcn 底座＋AI SDK 流式集成）。四条理由：① 非 shadcn 栈——duo 主题（6px 厚边/圆角/吉祥物）与 shadcn token 冲突，包进来每个原子都要重套皮，改造成本＞自研；② 语音链已有（asrClient＋GLM/WebSpeech 降级），替换零收益；③ 意图卡等领域卡（锁价/不可逆/发射）通用原子表达不了；④ 唯一值得拿的是 Task/Plan/Reasoning 的 activity 表达范式——抄思想（P2 Panel 时间线照此理），不引包。重估点：P4 工厂控制台（后台味重品牌弱）开工前再看一眼。
- [ ] C4 门禁：T1，考卷过即合入
