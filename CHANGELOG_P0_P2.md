# 📖 OpenCode CLI 任务指令标准规范与工作流手册 (Workflow Playbook)

> **适用场景**: 顶层 AI 架构师 (LLM Architect) 向 本地终端执行工具 (OpenCode CLI) 派发代码修改、重构与新功能 Task 时使用。  
> **核心原则**: 增量演进 · 零破坏性 · 类型先行 · 自动化闭环

---

## 1. 💡 双 AI 协同成功经验总结 (Key Principles)

1. **架构防御优先 (Architecture-First Defense)**：任何新方案接入前，先进行"冲突与风险审查"，严禁直接覆盖数据库 Schema、支付 Webhook 或鉴权核心。
2. **离散原子任务 (Discrete Atomic Tasks)**：大需求必须拆解为独立的 Task 1, Task 2...，保证单个 Task 变更可控、单次测试可验证、单次提交可回滚。
3. **强类型与防御网关 (Type Safety & Defensive Gateways)**：先写 DB/API 类型定义与 Zod 校验，再写业务逻辑，从源头阻断非法参数注入。
4. **终端自动化闭环 (Command-Driven Verification)**：每一个 Task 必须指定具体的终端验证命令（`tsc --noEmit` + `pnpm test`），由 OpenCode 自动执行并以测试结果判定 Task 是否完成。

---

## 2. 📋 OpenCode CLI 标准任务派发模板 (Task Template)

在向 OpenCode CLI 发送任务时，必须严格遵守以下格式：

```markdown
### 📌 阶段目标：[简要描述当前阶段的核心目标，例如：建立统一 API 输入校验网关]

#### 📝 Task [编号]: [任务简述，例如：规范 api-schemas.ts 中的 Zod 校验与类型推导]
- **目标文件/路径**：`[相对路径，例如：src/lib/validations/api-schemas.ts]`
- **变更类型**：`[新建 / 修改 / 重构 / 删除]`
- **核心逻辑指导**：
  1. [具体的逻辑变更点 1]
  2. [具体的逻辑变更点 2]
  3. [防御性限制/边界处理说明]
- **代码/配置参考**：
  ```[language]
  // 提供完整、可直接落盘或高度精确的核心代码块、接口定义与导出声明
```
- **验证标准 (Verification)**：
  - **终端命令**：`[例如：npx tsc --noEmit && pnpm test tests/my-test.test.ts]`
  - **预期结果**：`[例如：TypeScript 编译零报错，相关测试用例 100% 通过]`
```

---

## 3. 🎯 模板各要素编写规范

### 3.1 任务目标与文件路径声明规范
- **文件路径**：必须明确给出项目根目录下的**相对路径**（例如 `src/lib/ai-arbitrator.ts`），禁止使用模糊文件名。
- **变更类型**：明确标注 `新建` / `修改` / `重构` / `删除`，方便 CLI 确认操作动词（`create` / `edit` / `delete`）。

### 3.2 类型与防御性校验约束
- **TypeScript**：新增/修改代码时，必须优先引用 `src/types/database.types.ts` 或定义显式 Interface，**严禁引入 `any` 类型**。
- **Zod 防御网关**：涉及 API 路由或外部参数输入时，必须使用 Zod Schema 进行 `.strip()`（默认剥离未声明字段）与范围校验（如 `min/max/uuid/positive`）。
- **容错降级**：所有依赖外部服务（LLM/支付/第三方 API）的代码，必须包含 `try-catch` 兜底与默认降级数据输出，禁止未捕获的异常导致 API 挂起。

### 3.3 必须执行的终端验证命令结构
每个任务结尾必须提供由 OpenCode 执行的终端验证指令组合：

```bash
# 标准校验组合拳：静态类型检查 + 指定单元/集成测试
npx tsc --noEmit && pnpm test [相关测试文件路径]
```

> **通过标准**：`Process exited with code 0`，且测试用例通过率 100%。

---

## 4. 🚨 报错反哺与修复任务格式 (Error Feedback Template)

当 OpenCode 执行终端命令产生报错或测试失败时，无需扩大修改范围，应使用以下反哺格式将错误反馈给架构师 AI，请求针对性修复 Task：

```markdown
### ⚠️ OpenCode 终端执行报错反哺

- **执行 Task**：[Task 编号与名称]
- **报错指令**：`[例如：npx tsc --noEmit]`
- **终端报错信息 (Error Output)**：
  ```text
  [粘贴终端输出的具体错误栈、TypeScript 报错码 TS2322 或 Vitest Fail 信息]
  ```
- **受影响代码上下文**：[受影响的文件及行号]
- **👉 请架构师仅针对上述报错根源，生成针对性的【Task X.1 专项修复指令】。**
```

---

*本规范由 deal-protocol 首席架构师制定，用于保障项目全局演进的严谨性与自动化效率。*
