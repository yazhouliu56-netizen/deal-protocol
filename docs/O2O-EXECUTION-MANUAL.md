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

- [ ] T1 Panel 布局：左时间线（派单→上门→开工→验收→结算，复用五态 toAtomicFiveState）＋右干预区（改期/加项/催单/SOS），对话线程与 Panel 分栏（Zylos 结论：活动与对话分离）
- [ ] T2 资金五态条：托管中→分期释放→赔付→结算，每笔动账一行人话（读 escrow/milestone 纯函数，不写新逻辑）
- [ ] T3 AI 预警两件套：异常预警（偏离路线/超时）＋到点行动（VLM 验收分＋[确认验收]＋人工复核入口）；误报率埋点
- [ ] T4 意图卡 locked 态收拢为 Panel 头（P1 复用点）
- [ ] T5 考卷：五态投影全组合快照、缺数标"同步中"、预警误报走廊
- [ ] T6 走廊：进行中/异常/结算三截图

### 2.2 门禁与验收

- T2 全绿＋考卷过＋走廊 3 图。北极星：首响时长↓、准时率↑；护栏：AI 预警误报<15%，超了关预警只留到点行动。

---

## §3 P3 磋商桌＋服务者副驾 MVP

**六圈定位声明**：增长圈（成单率）× 供给圈（师傅留存）；AI 只建议不代按（钱规则）。
**宪法条文对照**：#10（建议接口挂→静态三档话术兜底，磋商不中断）。

### 3.1 任务清单

- [ ] T1 磋商桌：三档话术卡（爽快/小让/守底）＋价格合理性条（高于均值 20% 警示）；发送必须人点（红线：AI 不自动发价）
- [ ] T2 意图卡变体：磋商确认卡（改价双方点确认才生效，与 L1 同构件）
- [ ] T3 副驾 MVP：今日顺路参谋、一键标准回复、政策语音问答；差评预警只提示不扣分
- [ ] T4 考卷：三档发送链、超均值警示触发、副驾话术一键发出
- [ ] T5 走廊：磋商桌/副驾首页两截图

### 3.2 门禁与验收

- T2 全绿。北极星：成单率↑、师傅周留存↑；护栏：让价幅度分布（防 AI 教贱卖——中位数让价>15% 则调话术）。

---

## §4 P4 工厂控制台＋试单沙盒

**六圈定位声明**：供给圈（品类量产）× 增长圈（招商）；平台核武器，演示属性拉满。
**宪法条文对照**：#3 先配表后写码（品类 schema/定价/风控点先生，UI 后生）；#6（开品类链路零品类硬编码分支）。

### 4.1 任务清单

- [ ] T1 开品类流：一句话→生成品类卡/定价/话术/风控点/验收标准（复用 sentence-to-ammo＋意图卡确认变体）
- [ ] T2 试单沙盒：沙盒跑全流程（发单→派单→验收→结算全 mock），绿了才许上架
- [ ] T3 上架：秒级全城可发＋品类进弹药注册表（registry 写入走现有工厂函数）
- [ ] T4 考卷：生成→试单→上架全链（mock clock）、风控点缺失拦上架
- [ ] T5 走廊：控制台/试单报告两截图；第一次"秒级量产"演示就用它录屏

### 4.2 门禁与验收

- T2 全绿＋`check:convergence`（registry 契约修订走 T3）。北极星：开品类→首单<24h；护栏：试单通过率（<60% 说明生成质量差，回炉 prompt）。

---

## §5 落点文件总表（新增/复用/退役）

| Phase | 新增 | 复用（只读/调用，不改语义） | 退役 |
|---|---|---|---|
| P1 | types/intent-card.ts、base/order/intent-card.ts(+test)、components/waves/IntentCard.tsx | TalkPublishSheet（载体）、ammo D2 底价、evidence_log、P15 metrics、Sheet 动线 | DynamicDraftCard（#6 登记） |
| P2 | FulfillmentPanel 相关 | toAtomicFiveState、escrow/milestone 纯函数、IntentCard locked 态 | 无 |
| P3 | 磋商桌/副驾组件 | IntentCard 变体、价格均值口径 | 无（旧磋商留言保留） |
| P4 | 工厂控制台/沙盒 | sentence-to-ammo、ammo registry、IntentCard 确认变体 | 无 |

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

- P1：TalkPublish 原确认区保留分支 3 天，一键回切。
- P2：Panel 首屏保留旧订单详情入口 1 周。
- P3：话术接口挂→静态三档（已写死在 T1 验收里）。
- P4：上架加"试运行"标签，新品类首周限流 10 单/天。
- 全局：任一 phase 上线 3 天北极星反向→回滚该 phase，写复盘进本手册 §8（缺陷→考卷复利）。

## §8 复盘区（按 phase 追加）

- （空。第一个复盘：P1 上线 3 天后写。）
