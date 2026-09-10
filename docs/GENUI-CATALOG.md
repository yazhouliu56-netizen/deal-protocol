# GenUI 组件目录（补丁 B3）

> 母本：蓝图 v1.0 §4。规矩：LLM 只选卡填参、不现写 UI；新卡先登记后写码；
> 每卡必须定义四态（assembling / ready / locked / stale）渲染契约；目录外新卡 lint 拦截。
> 状态：P2 先行版（P1 意图卡已在册，其余边打边登记）。

| 卡片 | 用途 | 数据契约 | 所属循环 | 四态 |
|---|---|---|---|---|
| IntentCard 意图卡 | 计划→确认→发射统一构件 | `src/types/intent-card.ts` | L1/L3/L4/L6 | ✅ assembling stagger＋8s兜底 / ready 勾选发射 / locked 章戳 / stale 灰化重组 |
| PriceRow 价格行 | 锁价＋差价＋退款三要素行 | PriceAnchor（intent-card.ts） | L1/L3 | ➖ 不独立抽卡，随 IntentCard |
| ProviderCard 服务者卡 | 服务者预览＋评价摘要 | ProviderPreview（intent-card.ts，pickProviderPreview 只读映射） | L1/L2 | ✅ ready 态预览区（非承诺，最多3） |
| LiveOrderPanel 活订单 | 履约时间线＋干预区 | 拆分为 DemanderInterveneBar（干预真 mutation）＋MoneyStrip（资金纯投影）＋FulfillmentCockpit（既有时间线/座舱） | L2 | ➖ 不单独立卡，三件套组合即 Panel |
| HaggleCard 磋商卡 | 三档话术＋改价双方确认 | HaggleOption/claimToHaggleCard（base/order/haggle.ts） | L3 | ✅ 三档一键＋超均值警示＋确认卡（仅改价）；发送人点真链 |
| VerdictCard 仲裁摘要 | stance/rationale/confidence＋拍板 | 待定（L4 触发时定义） | L4 | ⏳ L4 登记 |
| FactoryCard 开品类确认 | 生成品类确认＋试单报告 | 待定（P4 定义） | L6 | ⏳ P4 登记 |

## 准入三问（新卡登记时回答）

1. LLM 能否只填参（不能→拆卡，不许开放生成）？
2. 涉款吗（涉款→PriceAnchor 三要素＋人工拍板强制）？
3. 四态各是什么样（一句话一行）？
