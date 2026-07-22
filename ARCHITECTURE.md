# 🛡️ 独立开发者交易平台核心防御性与智能化架构白皮书

本文件记录了本平台核心资产中关于准入、钱流、清算、声誉熔断以及 AI 智能匹配的底层硬核架构设计，用于后续维护、迁移及高吞吐生产环境的快速对齐。

---

## 1. 高精度分账与行锁防双花财务清算架构 (Phase 2 & Phase 4)
- **底层安全策略**：使用 PostgreSQL 显式悲观行锁 (`SELECT ... FOR UPDATE`)。
- **业务场景隔离**：在高并发提现/分账请求切入时，强行让关联的 `wallets` 账户记录在数据库事务内核层面物理串行化，从源头绝杀脏读、超卖及并发"双花"漏洞。
- **精算保障**：全量金额字段采用 `NUMERIC(12, 2)`，避开 JavaScript 浮点数计算的精度丢失。

## 2. 跨模块通知总线与实时生态闭环 (Phase 5)
- **总线机制**：基于 Supabase Realtime CDC (Change Data Capture) 实时数据管道。
- **生态联动**：当底层风控、声誉画像或交易状态变更时，事务自动向 `notifications` 表进行原子写，瞬间激活边缘事件广播，前端 Webhook 与实时微件音画同步响应。

## 3. 声誉状态机熔断与分级风控防线 (Phase 6)
- **状态机状态转换公式**：
  - `reputation_score < 3.5 OR low_review_count >= 3` ──> **SUSPENDED** (直接封禁)
  - `reputation_score < 4.2 OR low_review_count >= 1` ──> **WARNED** (触发黄牌)
  - `Otherwise` ──> **NORMAL** (正常状态)
- **计算下沉设计**：将滚动均分重算与熔断逻辑绑定在 `AFTER INSERT ON order_reviews` 触发器中，实现单次事务内 100% 的原子响应，严防应用层逻辑绕过。

## 4. AI 混合加权撮合推荐引擎 (Phase 8)
- **向量空间**：基于 `pgvector` 插件提供 1536 维向量余弦相似度检索，并采用 `ivfflat` 索引进行高吞吐优化。
- **混合评分引擎公式**：
  $$composite\_score = (similarity \times 0.6) + \left(\frac{reputation\_score}{5.0} \times 0.3\right) + \left(\frac{\min(budget, 50000)}{50000} \times 0.1\right)$$
- **风控硬联动**：
  - `SUSPENDED` 主体在 `match_demands_hybrid` 存储过程头部直接阻断，引擎强制返回空集，剥夺商机撮合权。
  - `WARNED` 主体的语义相似度准入阈值动态上调 `0.1` (等同于施加 20% 的惩罚门槛)。

## 5. 多阶段构建与 Alpine 隔离网格 (Phase 7)
- **多阶段裁剪**：采用 `base ──> builder ──> runner` 的三阶段物理剥离，排除开发期全量依赖，利用 Next.js `standalone` 模式构建极致容器。
- **只读挂载与最小特权**：运行期强制切换至非根用户 `nextjs`，Nginx 配置与证书通过 `:ro` 强加只读锁。
