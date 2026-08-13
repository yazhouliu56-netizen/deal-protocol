# ADR-0011: 语义推荐 + 自然语言 BI（N3 + N6）

日期：2026-08-13
状态：Accepted（缺口 N3 + N6 落地；功能层迭代第三批）

## 六圈定位声明
- 所属圈：第三圈 · AI 神经层
- 所属模块：语义向量匹配推荐（N3）、自然语言 BI（N6）
- 复用底座：`base/dispatch/match`（既有结构化撮合）、`base/notify`（BI 报表通知可选）
- 弹药表：无新增弹药字段

## 宪法条文对照
- 命中条文：**#10 降级是设计的一部分**（N3 用轻量字 bigram 余弦，零依赖零成本，不上 embedding API——数据规模下可解释性优于模型；N6 用规则解析，不依赖 LLM——查询理解失败返回可读的解析结果而非报错）、**#6 信任数据是瞄准镜**（语义推荐为撮合排序供数据，BI 让用户看得到自己的信任与经营数据）
- 偏离条文：无

## Context

- N3：撮合已有结构化打分（match.ts 六维权重），但「需求文本」本身没有语义信号——「想约羽毛球双打」无法匹配到「羽毛球约局」类需求。缺语义层。
- N6：经营数据（需求/成交/违约/收益）都在 store 里，但用户没有自然语言问数能力。缺 BI 查询。

## Decision

### 一、语义向量匹配（`src/base/ai/embed.ts` 纯函数）
- `tokenize`：中文按字 bigram + 英文单词，去停用词（零依赖）；
- `vecOf` TF 向量 + `cosine` 余弦相似度（空向量 → 0）；
- `recommend(query, candidates, topK)`：排序推荐，带分。

### 二、自然语言 BI（`src/base/ai/bi.ts` 纯函数）
- `parseBiQuery`：中文指标词（需求/成交/违约/收益/评价/裂变/争议）+ 类目 + 时间范围 + TopN 解析；
- `runBi(rows)`：聚合执行（行数据注入，纯函数可测）。

## Consequences
- 新增 `base/ai/embed.ts`、`base/ai/bi.ts`、`embed-bi.test.ts`（+6 单测）；
- 缺口 N3/N6 关闭；单测 344 全绿。
- 后续（单独 ADR）：embed 换真实 embedding API、BI 接 LLM 意图改写、报表 UI 页。