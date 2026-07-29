# 🚀 Deal Protocol — Release Notes (P0–P2 Evolution)

> **版本标识**: v1.2.0-p2.release  
> **发布日期**: 2026-07-29  
> **演进策略**: 零破坏性增量演进 (Non-Breaking Incremental Evolution)  
> **测试基线**: 100% Pass (16/16 Integration Tests Passed, 0 TypeScript Errors)

---

## 1. 📢 版本摘要 (Version Summary)

本次 P0–P2 迭代完成了底层架构地基重构与核心业务逻辑升维，在**绝不改动现有线上 28+ 数据库表结构、支付 Webhook 回调及 Auth 鉴权流程**的前提下，达成了以下核心成果：

1. **P0 基础地基 (Type Safety & Guardrails)**
   - 补全全量 29 张 Supabase 数据库表的强类型定义 (`database.types.ts`)。
   - 建立了统一 API 输入校验网关与参数剥离（strip）防注入机制 (`api-schemas.ts`)。
   - 规范了镜像模块目录 (`mM02-mM13`) 的映射注册关系，消除了架构悬空隐患。

2. **P1 智能仲裁增强 (Intelligent Arbitration Engine)**
   - 实现了基于 `precedents` 判例库的 Top 3 语义向量 RAG 检索。
   - 融合**硬核契约派**、**行业常理派**与**权益保护派**进行三视角联合裁决。
   - 建立了低置信度（Confidence < 0.85）及解析失败时自动标记 `requires_human_review: true` 的生产级降级保护。

3. **P2 履约资金与 Checkpoint 结算 (Checkpoint Escrow)**
   - 拓展了 `milestone_schedules` 支持 Checkpoint 阶段性节点提交与客户 24 小时超时倒计时。
   - 实现了供 Cron Job 调用的 `processExpiredCheckpoints` 批量解冻函数，实现客户无响应时的平滑资金释放，且与 `contract-machine.ts` 7 态资金状态机完全兼容。

---

## 2. 📂 受影响新增/修改文件清单 (Affected Files Inventory)

| 文件路径 | 变更类型 | 核心职责与变更说明 |
| :--- | :--- | :--- |
| `supabase/migrations/20260730_add_checkpoint_fields.sql` | **新建** | 拓展 `milestone_schedules` 表 `auto_confirm_at` 字段及状态约束 |
| `src/types/database.types.ts` | **新建** | 29 张 Supabase 数据库表的 TypeScript 强类型定义 |
| `src/lib/validations/api-schemas.ts` | **新建** | 核心 API 路由 Zod 校验 Schema 与统一 `validateApiInput` 防御网关 |
| `src/modules/mM02-mM13/index.ts` | **新建** | 架构镜像模块注册表 `MIRROR_MODULES_REGISTRY` 与活跃模块映射 |
| `src/lib/ai-arbitrator.ts` | **修改** | 集成判例 RAG、三视角 Prompting 与强类型 JSON 降级输出 |
| `src/lib/milestone-escrow.ts` | **修改** | 实现 `submitMilestoneCheckpoint`, `confirmMilestoneCheckpoint` 与超时解冻 |
| `tests/p2-integration.test.ts` | **新建** | 全量功能与边界降级回归测试套件 |

---

## 3. 🛠️ 生产环境部署注意事项 (Deployment Guide)

为了确保线上平滑发布，请按顺序执行以下部署步骤：

### 3.1 数据库迁移 (Database Migration)
线上数据库需应用最新的增量 SQL 脚本以支持 Checkpoint 24h 倒计时：
```bash
# 使用 Supabase CLI 应用增量 SQL 迁移
npx supabase db push

# 或在 Supabase Dashboard -> SQL Editor 中手动执行以下文件内容：
# supabase/migrations/20260730_add_checkpoint_fields.sql
```
注：该迁移为纯增量操作（新增可空字段 `auto_confirm_at` 及扩展枚举状态），对现有线上数据无破坏性影响。

### 3.2 定时任务 Cron Job 配置
确保 `vercel.json` 或定时任务触发器配置了针对 `/api/cron/check-timeouts` 的定期调用：
```json
{
  "crons": [
    {
      "path": "/api/cron/check-timeouts",
      "schedule": "0 * * * *"
    }
  ]
}
```
注：`check-timeouts` 接口内部已集成 `processExpiredCheckpoints()` 批处理逻辑，建议每小时或每天定时触发。

### 3.3 环境变量校验 (Environment Variables)
上线前请确保生产环境已正确配置以下关键环境变量：
- `SUPABASE_SERVICE_ROLE_KEY`: 用于 Cron Job 绕过 RLS 执行批量资金状态更新。
- `CRON_SECRET`: 用于保护 Cron API 路由防止外部伪造触发。
- `DEEPSEEK_API_KEY`: 用于 AI 仲裁 RAG 模型的文本生成。

---

## 4. 🛡️ 回滚预案与降级方案 (Rollback Strategy)

若线上部署后出现不可预期的异常，请遵循非破坏性降级原则：

### 4.1 代码层快速回滚 (Application Layer Rollback)
因本次所有修改均未破坏既有 API 接口签名与数据库旧有字段，若代码层出现非预期错误，可直接通过 Vercel 控制台一键回滚（Promote Previous Deployment）至发布前构建版本。

### 4.2 业务逻辑功能级软降级 (Feature Level Fallback)
- **AI 仲裁降级**：若 LLM API 出现宕机或延迟，`arbitrateDispute` 内部已实现 try-catch 兜底，会自动输出 `confidence: 0.5` 并标记 `requires_human_review: true`，争议将安全转交人工客服后台处理，不会造成交易卡死。
- **Checkpoint 超时批处理降级**：若暂停 Cron Job 触发，仅影响"24 小时无响应自动完成"功能，客户仍可通过主动点击"确认完成"正常解冻资金，主交易流程不受影响。
- **数据库兼容性保障**：`20260730_add_checkpoint_fields.sql` 允许 `auto_confirm_at` 为 NULL，即便回滚代码，新增的数据库字段不会对旧版 SQL 查询产生任何破坏。
