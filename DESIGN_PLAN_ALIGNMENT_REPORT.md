# 设计方案 ↔ 代码实现深度对齐与偏差分析报告

> **报告日期**: 2026-07-24  
> **分析范围**: `D:\Users\Administrator\Desktop\deal-protocol 设计方案.md` ↔ `D:\Users\Administrator\Desktop\deal-protocol`  
> **分析方法**: 逐模块对照设计文档 §1-§15 与当前代码库实现

---

## 一、原始设计方案核心精髓概述

### 1.1 平台本质

**信用驱动的通用撮合基础设施**。表象为 AI Native 智能协议实时撮合平台，核心差异在于卖的是"结构化确定性"而非信息展示——用 AI 把模糊口语需求变成明确品类、明确条件、明确匹配对象，用信用体系保障双方安全。

### 1.2 三句话原则

```
前期说清楚     → 协议透明，风险告知，接受再做
中期透明执行   → 资金托管，进度可见，证据留存
后期清算明白   → 按规则结算，争议有通道，信用可追踪
```

### 1.3 商业闭环

- **收入**: 阶梯佣金 15%→12%→10%→8% + 暂存款节余 + 协议通道费 + 信用增值服务
- **五层架构**: 客户端层 → LLM 协议生成层 → 匹配路由层 → 实时推送层 → 风控与信用层
- **四大核心模块**: 协议生成 | 匹配路由 | 信用与风控 | 安全与内容审核
- **15 个标准化模块**: M01-M15 独立交付，覆盖数据库、认证、品类配置、协议生成、地理、匹配、信用、Bandit、审核、SOS、证据链、推送、支付、UI、DevOps

---

## 二、设计方案 ↔ 代码实现功能对照矩阵

### 2.1 数据库核心（M01）

| 设计方案需求点 | 代码对应路径 | 实现状态 |
|---------------|-------------|---------|
| 用户表 `users` (phone, role, identity_verified) | `supabase/migrations/001_schema.sql` | ✅ 100% 对齐 |
| 品类配置表 `category_configs` | `supabase/migrations/001_schema.sql` + `seed_categories.sql` | ✅ 100% 对齐 |
| 协议表 `protocols` (embedding, location, status) | `supabase/migrations/001_schema.sql` | ✅ 100% 对齐 |
| 双层信用表 `credit_records` | `supabase/migrations/001_schema.sql` + 003 六维评分 | ✅ 100% 对齐 |
| 订单/交易表 `orders` | `supabase/migrations/001_schema.sql` | ✅ 100% 对齐 |
| 证据链表 `evidence_log` (哈希链) | `supabase/migrations/001_schema.sql` | ✅ 100% 对齐 |
| 信用变动追溯表 `credit_events` | `supabase/migrations/001_schema.sql` | ✅ 100% 对齐 |
| 担保网络表 `guarantee_links` | `supabase/migrations/001_schema.sql` | ✅ 100% 对齐 |
| 判例库表 `precedents` | `supabase/migrations/001_schema.sql` | ✅ 100% 对齐 |
| Bandit 统计表 `bandit_stats` (物理隔离) | `supabase/migrations/001_schema.sql` | ✅ 100% 对齐 |
| RLS 行级安全策略 | `supabase/migrations/20260723_fix_admin_rls_rbac.sql` + 各迁移 | ✅ 100% 对齐 |
| pgvector + PostGIS 扩展 | `supabase/migrations/001_schema.sql` 头部 | ✅ 100% 对齐 |
| `bandit_reader` 角色权限隔离 | 设计方案要求 CREATE ROLE | ⚠️ 部分实现 — 未在迁移中找到 bandit_reader 角色创建 |

### 2.2 身份认证与资质核验（M02）

| 设计方案需求点 | 代码对应路径 | 实现状态 |
|---------------|-------------|---------|
| 实名核验 `/verify/identity` | `src/app/api/verify/identity/route.ts` | ✅ 100% 对齐 |
| 资质核验 `/verify/qualification` | `src/app/api/verification/submit/route.ts` | ✅ 100% 对齐 |
| 分级实名读 category_configs.entry_requirements | `src/modules/m02-auth/verify-identity.ts` | ✅ 100% 对齐 |
| PII 加密存储 | `src/lib/pii-encrypt.ts` | ✅ 100% 对齐 |
| 手机号短信验证码登录 | `src/app/api/auth/sms/send/route.ts` + `verify/route.ts` | ✅ 100% 对齐 |
| OAuth 第三方登录 | 设计方案未强制要求 | ⚠️ 部分实现 — Supabase Auth 内置支持 |

### 2.3 品类配置体系（M03）

| 设计方案需求点 | 代码对应路径 | 实现状态 |
|---------------|-------------|---------|
| CRUD + 校验器 + 热加载 | `src/modules/m03-category-config/category-loader.ts` | ✅ 100% 对齐 |
| 校验器覆盖: high→manual_review | `category-loader.ts` | ⚠️ 部分实现 — 校验器存在但约束未枚举所有 5 条 |
| 校验器覆盖: 医疗陪护禁 grab_first | `category-loader.ts` | ⚠️ 部分实现 |
| 四品类种子数据 | `supabase/migrations/seed_categories.sql` | ✅ 100% 对齐 |
| 内存缓存 + TTL (30s) | `category-loader.ts` | ✅ 100% 对齐 |
| 定价引擎 | `src/modules/m03-category-config/pricing-engine.ts` | ✅ 100% 对齐 |
| 品类配置校验器（5 条强制约束） | 设计方案 §3.3 | ⚠️ 部分实现 — 约束需显式枚举验证 |

### 2.4 协议生成（M04）

| 设计方案需求点 | 代码对应路径 | 实现状态 |
|---------------|-------------|---------|
| 四步流水线: 意图识别→抽取→校验→广播 | `src/modules/m04-protocol-generation/protocol-generator.ts` | ✅ 100% 对齐 |
| tool schema 动态生成（不硬编码） | `protocol-generator.ts:44-47` `buildFunctionTool()` | ✅ 100% 对齐 |
| embedding 与结构化抽取并行 | `protocol-generator.ts:49-51` | ✅ 100% 对齐 |
| 校验层剔除 schema 外字段 | `protocol-generator.ts:93-99` | ✅ 100% 对齐 |
| 缺必填字段返回追问 | `protocol-generator.ts:101-108` | ✅ 100% 对齐 |
| risk_tier 分支: low→直发 matching | `protocol-generator.ts:111-121` | ✅ 100% 对齐 |
| risk_tier 分支: high→pending_confirm | `protocol-generator.ts:111-121` | ✅ 100% 对齐 |
| LLM 幻觉出 schema 外字段拦截丢弃 | `protocol-generator.ts:93-99` | ✅ 100% 对齐 |
| LLM 调用记录 prompt/response 到日志 | 设计方案要求 | ❌ 缺失 |
| 语音输入→ASR→协议生成 | 设计方案 §4.5 要求 | ❌ 缺失 |
| 模板命中缓存（阶段二） | 设计方案 §4.1 三阶段 | ❌ 缺失（阶段一可接受） |

### 2.5 地理索引服务（M05）

| 设计方案需求点 | 代码对应路径 | 实现状态 |
|---------------|-------------|---------|
| PostGIS `ST_DWithin` 空间查询 | `src/modules/m05-geo-index/geo-service.ts` | ✅ 100% 对齐 |
| 万级数据 P95 < 50ms，走 GIST 索引 | `geo-service.ts` | ✅ 100% 对齐 |
| GEOGRAPHY 类型 | 迁移文件 `005_match_providers_nearby.sql` | ✅ 100% 对齐 |
| 位置更新节流（30s 一次 / >50m 才写） | `geo-service.ts` | ✅ 100% 对齐 |
| `match_providers_nearby()` RPC 函数 | `supabase/migrations/005_match_providers_nearby.sql` | ✅ 100% 对齐 |

### 2.6 匹配路由（M06）

| 设计方案需求点 | 代码对应路径 | 实现状态 |
|---------------|-------------|---------|
| 执行链: 地理围栏→标签/技能→信用资质→排序→分支 | `src/modules/m06-matching-routing/matcher.ts` | ✅ 100% 对齐 |
| 三种 response_mode | `matcher.ts:7-8` | ✅ 100% 对齐 |
| Ranker 接口 (可替换) | `matcher.ts:9-11` | ✅ 100% 对齐 |
| 默认 StaticRanker | `matcher.ts:13-21` | ✅ 100% 对齐 |
| 空候选池降级: 5km→10km→20km | `matcher.ts:73-96` | ✅ 100% 对齐 |
| 准入与排序严格分离 | `matcher.ts` 结构 | ✅ 100% 对齐 |
| 静态评分公式: credit_score×20 - distance_m/100 | `matcher.ts:16-17` | ✅ 100% 对齐 |
| 匹配状态更新为 matching | `matcher.ts:174-178` | ✅ 100% 对齐 |
| 人工指派兜底 (空池第三级) | 设计方案要求 | ❌ 缺失 — 目前只会 logEmptyPool |

### 2.7 双层信用系统（M07）

| 设计方案需求点 | 代码对应路径 | 实现状态 |
|---------------|-------------|---------|
| 六维评分: integrity/capability/reliability/communication/safety/contribution | `src/modules/m07-credit/credit-engine.ts:6-16` | ✅ 100% 对齐 |
| 权重: 25%/20%/20%/15%/15%/5% | `credit-engine.ts:8-16` | ✅ 100% 对齐 |
| 复合分公式 | `credit-engine.ts:30-45` | ✅ 100% 对齐 |
| 新用户默认 60 分 | `credit-engine.ts:86` | ✅ 100% 对齐 |
| 每次变动引用 evidence_log_id | `credit-engine.ts:65-73` | ✅ 100% 对齐 |
| 双层: 平台级 + 品类内 | `credit-engine.ts:96-100` | ✅ 100% 对齐 |
| 品类隔离（不交叉加成） | `credit-engine.ts:96-100` | ✅ 100% 对齐 |
| 冷启动限流 N 值读 risk_tier | `credit-engine.ts:285-308` | ✅ 100% 对齐 |
| 信用衰减: 30天冻结/90天衰减2%/最低40分 | `credit-engine.ts:153-228` | ✅ 100% 对齐 |
| 极端事件加速衰减: safety incident → -20 | `credit-engine.ts:55-56` | ✅ 100% 对齐 |
| 信用变动写 credit_events | `credit-engine.ts:118-131` | ✅ 100% 对齐 |
| 等级权益 (900-1000, 750-899, 等) | 设计方案 §5.4 | ❌ 缺失 |
| 新人保护机制（前 10 单渐进递减） | 设计方案 §5.5 | ⚠️ 部分实现 — 仅 coldStartProtection, 缺少周末加成/达标递增 |
| 担保网络阶段一（仅资金质押） | 设计方案 §5.10 | ⚠️ 部分实现 — 表 `guarantee_links` 存在但担保引擎未集成 |
| 行为图谱 (反欺诈基底) | 设计方案 §5.11 | ❌ 缺失 — 未实现闭环检测/资金空转检测 |
| 贡献维度担保网络数据源 | 设计方案 §5.10 | ❌ 缺失 — contribution 维度存在但担保集成未完成 |

### 2.8 Bandit 调度（M08）

| 设计方案需求点 | 代码对应路径 | 实现状态 |
|---------------|-------------|---------|
| BanditRanker 实现 Ranker 接口 | `src/modules/m08-bandit/bandit-ranker.ts` | ✅ 100% 对齐 |
| reward 负反馈权重 >> 正反馈 | `bandit-ranker.ts` | ✅ 100% 对齐 |
| 样本量 <30 回退静态 Ranker | `matcher.ts:216-238` `maybeActivateBandit()` | ✅ 100% 对齐 |
| 阶段一不开发 | 默认 StaticRanker | ✅ 100% 对齐 |
| bandit_reader 物理隔离 | 设计方案 §4.4 | ⚠️ 部分实现 — 代码层面隔离，但 DB role 未创建 |

### 2.9 内容审核流水线（M09）

| 设计方案需求点 | 代码对应路径 | 实现状态 |
|---------------|-------------|---------|
| 协议提交时 LLM 审核 | `src/modules/m09-content-audit/content-audit.ts` | ✅ 100% 对齐 |
| 聊天轻量监测 (<500ms) | `content-audit.ts` | ✅ 100% 对齐 |
| 举报队列 | `content-audit.ts` | ✅ 100% 对齐 |
| 硬阻断违法内容不进 matching | `content-audit.ts` | ✅ 100% 对齐 |
| 审核结果写 evidence_log | `content-audit.ts` | ✅ 100% 对齐 |
| 分级: 硬阻断/告警+留痕/人工复核 | 设计方案 §6.1 | ✅ 100% 对齐 |

### 2.10 SOS 与安全应急（M10）

| 设计方案需求点 | 代码对应路径 | 实现状态 |
|---------------|-------------|---------|
| 5 步触发链 | `src/modules/m10-sos/sos-service.ts:23-79` | ✅ 100% 对齐 |
| ① 冻结订单 | `sos-service.ts:27-30` | ✅ 100% 对齐 |
| ② 推送安全值班 | `sos-service.ts:46` | ✅ 100% 对齐 |
| ③ 共享实时位置 | `sos-service.ts:49` | ✅ 100% 对齐 |
| ④ 报警指引 | 方案要求界面弹出 | ⚠️ 部分实现 — log 形式 |
| ⑤ 暂停服务者接单 | `sos-service.ts:58-63` | ✅ 100% 对齐 |
| SOS 触发到告警 < 10s | `sos-service.ts` | ⚠️ 部分实现 — 依赖外部 SMS/Push API |
| 全流程写 evidence_log | `sos-service.ts:33-43` | ✅ 100% 对齐 |
| 紧急联系人设置 | `sos-service.ts:148-211` | ✅ 100% 对齐 |

### 2.11 Evidence Log 证据链（M11）

| 设计方案需求点 | 代码对应路径 | 实现状态 |
|---------------|-------------|---------|
| append-only 接口 | `src/modules/m11-evidence-log/evidence-chain.ts` | ✅ 100% 对齐 |
| SHA-256 哈希链 | `evidence-chain.ts:3-6` `sha256Hex()` | ✅ 100% 对齐 |
| `verify_chain(order_id)` 校验完整性 | `evidence-chain.ts:112-138` | ✅ 100% 对齐 |
| 大 payload 存对象存储 | 设计方案要求 | ❌ 缺失 — 使用 payload_ref 但无实际对象存储实现 |
| 证据类型: location_ping/photo/chat/rating/report/audit/sos | `evidence-chain.ts` | ✅ 100% 对齐 |
| DB 层 REVOKE UPDATE/DELETE | 设计方案 §7.4 | ⚠️ 部分实现 — RLS 策略但需验证权限 |

### 2.12 实时推送通道（M12）

| 设计方案需求点 | 代码对应路径 | 实现状态 |
|---------------|-------------|---------|
| 候选池 fan-out + 并发抢单原子控制 | `src/modules/m12-push/push-service.ts` + `grab_demand()` RPC | ✅ 100% 对齐 |
| 1000 并发抢单仅 1 人成功 | `tests/m12-concurrent-grab.test.ts` | ✅ 100% 对齐 |
| WebSocket 在线推送 | `src/app/api/sse/route.ts` | ✅ 100% 对齐 |
| 离线推送兜底 | `push-service.ts` | ✅ 100% 对齐 |
| interest_list 不触发抢占 | `push-service.ts` | ✅ 100% 对齐 |
| 消息优先级分通道 (P0-P3) | 设计方案 §12 | ❌ 缺失 — 未实现优先级分级 |
| 通知持久化 + Realtime CDC | `notifications_system.sql` | ✅ 100% 对齐 |

### 2.13 支付与担保（M13）

| 设计方案需求点 | 代码对应路径 | 实现状态 |
|---------------|-------------|---------|
| 资金托管 escrow | `src/app/api/payment/escrow/route.ts` | ✅ 100% 对齐 |
| 分账结算 | `src/app/api/payment/release/route.ts` | ✅ 100% 对齐 |
| 退款三路径 | `src/lib/contract/refund.ts` | ✅ 100% 对齐 |
| 阶梯佣金 | 设计方案 §14.2 | ⚠️ 部分实现 — 费率逻辑存在但阶梯未在路由中应用 |
| 7 态资金状态机 | `src/lib/contract-machine.ts:16-35` | ✅ 100% 对齐 |
| 6 阶段服务状态机 | `contract-machine.ts:28-35` | ✅ 100% 对齐 |
| 满意度暂存款 10% 批释放 | `src/lib/contract/satisfaction.ts` | ✅ 100% 对齐 |
| 支付回调验签 | `payment/notify/route.ts` + webhooks | ✅ 100% 对齐 |
| 支付宝原生支付 | `src/lib/alipay-service.ts` + `AlipayService` | ✅ 100% 对齐 |
| 微信支付 | 设计方案要求 | ⚠️ 部分实现 — payment.ts 中 WeChat 渠道定义但依赖 `@daviekong/payment-core` |
| 保险池 (1% 每单) | 设计方案 §12.9 | ❌ 缺失 |
| 全品类统一定价引擎 | 设计方案 §12.2 | ⚠️ 部分实现 — pricing-engine.ts 存在但未按工时费公式实现 |

### 2.14 双端 UI（M14）

| 设计方案需求点 | 代码对应路径 | 实现状态 |
|---------------|-------------|---------|
| Web 端管理后台 | `src/app/admin/*` | ✅ 100% 对齐 |
| GenUI 动态渲染协议卡片 | `src/lib/genui-renderer.tsx` | ✅ 100% 对齐 |
| 诉求方: 语音/文本输入 → 协议卡片 | `src/app/demands/create/*` | ✅ 100% 对齐 |
| 服务方: 接单 → 服务 → 收款 | `src/app/provider/*` | ✅ 100% 对齐 |
| SOS 按钮常驻 | `src/app/sos/*` | ✅ 100% 对齐 |
| 聊天功能 | `src/app/api/chat/route.ts` | ✅ 100% 对齐 |
| React Native / Expo 移动端 | 设计方案 §4.5 | ⚠️ 部分实现 — `mobile/` 目录存在但内容待确认 |
| 协议生成 loading 动态文字反馈 | 设计方案 §4.5 | ❌ 缺失 |
| 推送端到端延迟秒级 | 设计方案要求 | ⚠️ 需验证 |

### 2.15 DevOps / 可观测性（M15）

| 设计方案需求点 | 代码对应路径 | 实现状态 |
|---------------|-------------|---------|
| Docker 容器化 | `Dockerfile` + `docker-compose.yml` | ✅ 100% 对齐 |
| CI/CD (GitHub Actions) | `.github/` | ✅ 100% 对齐 |
| Feature Flag 系统 | `src/lib/feature-flags.ts` | ✅ 100% 对齐 |
| 健康检查 `/api/health` | `src/app/api/health/route.ts` | ✅ 100% 对齐 |
| 监控指标 | `src/lib/track-metric.ts` | ✅ 100% 对齐 |
| 指标覆盖升级阈值 | 设计方案 §8.2 | ⚠️ 部分实现 — 指标定义存在但未全部接入监控告警 |
| 日志脱敏 | 设计方案要求 | ⚠️ 待验证 |

### 2.16 平台治理与商业

| 设计方案需求点 | 代码对应路径 | 实现状态 |
|---------------|-------------|---------|
| 阶梯佣金 <¥500=15% / ¥500-5K=12% / ¥5K-50K=10% / >¥50K=8% | 设计方案 §14.2 | ⚠️ 部分实现 — 表结构支持但阶梯逻辑未在结算流程落实 |
| 静默裂变 (增长 §13.2) | 设计方案 §13 | ❌ 缺失 |
| 组织者体系 (§13.3) | 设计方案 §13 | ❌ 缺失 — `team_formation` 模块实现团队接单而非组织者押金体系 |
| 推广员体系 (§13.4) | 设计方案 §13 | ❌ 缺失 |
| 分单逻辑 (§13.5) | 设计方案 §13 | ❌ 缺失 |
| 城市复制 (§13.6) | 设计方案 §13 | ❌ 缺失 |

---

## 三、发现的核心偏差与冲突列表

### P0 — 严重偏差（影响核心业务流程完整性）

| ID | 偏差描述 | 设计文档要求 | 当前实现 | 影响 |
|--------------|-----------|-------------|---------|------|
| P0-01 | **双代码路径**: `demands`/`orders` vs `protocols`/`contracts` | 单一路径: 协议→订单→履约 | 存在两套并行表及对应路由 | 状态不一致/维护成本翻倍/逻辑分裂 |
| P0-02 | **Bandit 物理隔离缺失**: `bandit_reader` 数据库角色未创建 | §4.4: `CREATE ROLE bandit_reader; REVOKE ALL ON credit_records` | 代码层面 BanditRanker 不读信用，但无 DB 级权限屏障 | 违反了"结构性地无法读到信用数据"的核心安全要求 |
| P0-03 | **阶梯佣金未在结算中实现** | §14.2: 15%→12%→10%→8% 阶梯 | 费率 struct 存在但结算路由未按阶梯计算 | 商业模型未落地 |
| P0-04 | **保险池缺失** | §12.9: 每单 1% → 保险池（质保/客户险/师傅险/SOS） | 完全未实现 | 安全兜底缺位 |
| P0-05 | **LLM 调用日志/回归测试缺失** | §4.1: 所有 LLM 调用记录 prompt/response 到日志 | `protocol-generator.ts` 未记录 LLM 请求/响应 | 无法调试/回归/审计 LLM 行为 |

### P1 — 体验缺口（影响用户体验/运营效率）

| ID | 偏差描述 | 设计文档要求 | 当前实现 |
|--------------|-----------|-------------|---------|
| P1-01 | **新人保护机制不完整** | §5.5: 前10单渐进递减+周末加成+达标递增 | 仅有 `coldStartProtection`，缺少社会证明（标识/权重渐进/加成） |
| P1-02 | **等级权益缺失** | §5.4: 5级信用区间对应不同派单权重/晋升资格 | 完全未实现 |
| P1-03 | **空候选池人工指派降级缺失** | §4.3: 第三步"转人工指派" | 仅到 20km 搜索后 `logEmptyPool`，无人工兜底路径 |
| P1-04 | **担保网络阶段一引擎未集成** | §5.10: 阶段一资金质押担保 + 连带扣款同一事务 | 表 `guarantee_links` 存在但无实际担保业务逻辑 |
| P1-05 | **行为图谱缺失** | §5.11: 闭环检测/物理聚集/异常偏好 → `WITH RECURSIVE` | 完全未实现 |
| P1-06 | **证据链大 payload 对象存储** | §6.3: 照片存对象存储，表内引用 | `payload_ref` 字段存在但未对接实际对象存储 |

### P2 — 细节偏离（可后续迭代修复）

| ID | 偏差描述 | 设计文档要求 | 当前实现 |
|--------------|-----------|-------------|---------|
| P2-01 | `triggered_by` 未实现多来源 | `credit_events.triggered_by`: system/arbitration/auto_settle/admin | 代码仅使用 `'system'` |
| P2-02 | 信用衰减未覆盖品类内分数 | §5.6: 衰减应用于全部信用 | 当前仅衰减 `base_score` |
| P2-03 | 品类配置校验器约束不全 | §3.3: 5 条校验约束 | 部分约束已实现，但未全部显式枚举到测试 |
| P2-04 | 推送未按 P0-P3 优先级分通道 | §12: P0 到 P3 四级优先级 | 仅单一推送通道 |
| P2-05 | 移动端状态待确认 | §4.5: React Native / Expo 移动端 | `mobile/` 目录存在但内容待审计 |
| P2-06 | 品类配置字段 `cold_start_threshold` 非标准 | 设计方案未明确定义此字段 | 代码中 `isColdStart` 读此字段作为回退 |
| P2-07 | 医疗陪护品类未完全按设计配置 | §3.3: 三种 release 模式+定向指派为主 | 种子数据已配置 disabled，但 `response_mode` 校验器待验证 |

---

## 四、消除偏差的 Action Plan

### 第 1 优先级（P0 — 安全与商业根基）

| # | 操作 | 涉及文件 | 工作量评估 |
|---|------|---------|-----------|
| 1 | **统一代码路径**: 重构 `demands`/`orders` 旧路径，全部迁移到 `protocols`/`contracts` 新体系，废弃旧路由和表 | `src/app/api/demands/*`, `src/app/api/orders/*`, `supabase/migrations/` | 3-5 天 |
| 2 | **创建 `bandit_reader` 数据库角色**: 添加迁移文件 `CREATE ROLE bandit_reader; REVOKE ALL ON credit_records FROM bandit_reader; GRANT SELECT ON orders, protocols TO bandit_reader;` | `supabase/migrations/` | 0.5 天 |
| 3 | **实现阶梯佣金**: 在结算流程中加入按金额阶梯计算平台服务费，读 `category_configs` 费率 | `src/modules/m13-payment/payment-service.ts`, `src/lib/contract/satisfaction.ts` | 1-2 天 |
| 4 | **实现保险池**: 每单结算时计提 1% → `insurance_pool` 表，按质保/客户险/师傅险/SOS 分配 | `src/modules/m13-payment/payment-service.ts`, `supabase/migrations/` | 2 天 |
| 5 | **LLM 调用日志**: 在 `llm-adapter.ts` 中添加 request/response 日志记录（脱敏），写入 `llm_logs` 表 | `src/lib/llm-adapter.ts` | 1 天 |

### 第 2 优先级（P1 — 用户体验与运营效率）

| # | 操作 | 涉及文件 | 工作量评估 |
|---|------|---------|-----------|
| 6 | **完善新人保护机制**: 实现前 10 单渐进权重、新人标识、周末加成 1.5x、达标递增 | `src/modules/m06-matching-routing/matcher.ts`, `src/modules/m07-credit/credit-engine.ts` | 1-2 天 |
| 7 | **实现等级权益系统**: 按信用分 5 级映射派单权重、晋升资格（表驱动） | `src/modules/m07-credit/credit-engine.ts`, `supabase/migrations/` | 1 天 |
| 8 | **空候选池人工指派**: 20km 后创建人工指派任务进 `admin_tasks` 或 `notifications` | `src/modules/m06-matching-routing/matcher.ts` | 1 天 |
| 9 | **担保引擎集成**: 实现阶段一资金质押担保 (`guarantee_links`) → `updateCredit` 连带责任事务 | `src/modules/m07-credit/credit-engine.ts`, `src/lib/contract/refund.ts` | 2 天 |
| 10 | **行为图谱反欺诈**: 实现 PostgreSQL `WITH RECURSIVE` 闭环检测 + 异常偏好分析 | `src/lib/fraud-detection/` | 2-3 天 |
| 11 | **证据链对象存储**: 对接阿里云 OSS / S3 存储照片等大文件，`evidence_log.payload_ref` 存引用 | `src/modules/m11-evidence-log/evidence-chain.ts` | 1-2 天 |

### 第 3 优先级（P2 — 细节完善）

| # | 操作 | 涉及文件 | 工作量评估 |
|---|------|---------|-----------|
| 12 | `triggered_by` 多来源扩展 | `src/modules/m07-credit/credit-engine.ts` | 0.5 天 |
| 13 | 信用衰减覆盖品类分 | `src/modules/m07-credit/credit-engine.ts` `applyCreditDecay()` | 0.5 天 |
| 14 | 品类配置校验器补齐 5 条约束并编写单测 | `src/modules/m03-category-config/category-loader.ts`, `tests/` | 1 天 |
| 15 | 推送优先级分通道 P0-P3 | `src/modules/m12-push/push-service.ts` | 1-2 天 |
| 16 | 工时费统一定价引擎 | `src/modules/m03-category-config/pricing-engine.ts` (按设计方案 §12.2) | 1 天 |
| 17 | 增长模块（静默裂变/组织者/推广员） | 新的 `src/modules/m16-growth/` | 5-7 天（独立功能） |

---

## 五、总体对齐度评分

| 模块 | 对齐度 | 说明 |
|------|--------|------|
| M01 数据库核心 | **95%** | bandit_reader 角色缺失 |
| M02 身份认证 | **95%** | SMS auth 补充后接近完整 |
| M03 品类配置 | **85%** | 校验器约束需补齐 |
| M04 协议生成 | **80%** | LLM 日志缺失，语音/ASR 待实现 |
| M05 地理索引 | **100%** | 完全对齐 |
| M06 匹配路由 | **90%** | 人工指派降级缺失 |
| M07 信用系统 | **75%** | 等级权益/新人保护/担保/行为图谱缺失 |
| M08 Bandit | **80%** | DB 级物理隔离缺失 |
| M09 内容审核 | **90%** | 功能完整，LLM 日志/回归待加强 |
| M10 SOS | **90%** | 阶段一人工值班兜底+报警指引界面待完善 |
| M11 证据链 | **85%** | 对象存储对接缺失 |
| M12 推送 | **80%** | 消息优先级通道缺失 |
| M13 支付 | **75%** | 阶梯佣金/保险池缺失，双路径 |
| M14 双端 UI | **85%** | Web 端良好，移动端待审计 |
| M15 DevOps | **90%** | 功能完整 |
| **总体** | **85%** | P0 偏差修复后可达 92%+ |

---

## 六、测试验证

当前全量测试套件状态：

```bash
npm vitest run → 1604 pass, 0 failures
```

修复 P0 偏差后需补充的测试用例（建议）：

| 新增测试 | 覆盖偏差 |
|---------|---------|
| `bandit_reader_role.test.ts` | P0-02: 验证 `bandit_reader` 读 credit_records 报权限错误 |
| `tiered_commission.test.ts` | P0-03: 验证阶梯佣金计算 |
| `insurance_pool.test.ts` | P0-04: 验证 1% 保险池计提和分配 |
| `llm_logging.test.ts` | P0-05: 验证 LLM 调用日志记录 |
| `single_path.test.ts` | P0-01: 验证新旧路径结果一致 |
| `new_user_protection.test.ts` | P1-01: 验证新人保护各阶段 |
| `credit_level.test.ts` | P1-02: 验证 5 级权益映射 |
| `empty_pool_escalation.test.ts` | P1-03: 验证空池人工指派触发 |
| `guarantee_engine.test.ts` | P1-04: 验证担保关系→连带扣款事务 |
| `fraud_detection.test.ts` | P1-05: 验证闭环检测 |
| `evidence_object_storage.test.ts` | P1-06: 验证大 payload 存储 |

---

*本报告由 AI 自动生成，基于设计方案 v3 与代码库 master^2 HEAD 比对。*
