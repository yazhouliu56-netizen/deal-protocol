# ADR-0005: LLM Gateway（多 Provider 统一入口与按任务路由）
日期：2026-08-11
状态：Accepted

## Context

项目 LLM 调用现状：`/api/chat` 与 `/api/voice-intent` 各内嵌一份 PROVIDERS 常量
数组（zhipu→gemini 顺序降级，数据已重复），`/api/cluster` `/api/decompose`
`/api/diagnose` 为手写 if/else 调用链，`/api/tts` 仅连智谱 GLM-TTS（429 直接
503，客户端降级 speechSynthesis）。`llmGuard` 提供全局串行化 + 900ms 最小间隔
+ 有界重试 + 意图级缓存（15min TTL），但**全局单链**——一个 provider 的
Retry-After 会拖累整条链。生产为单进程 `next start`（globalThis 状态跨请求
共享，无需 Redis）。

昨日（08-11）讨论定案供应商矩阵：Gemini（免费额度长期、OpenAI 兼容）>
Groq（免费层、低延迟）> OpenRouter Free（一个 key 多模型、兜底）> 智谱 GLM
（国内稳定、JSON 稳定）> Qwen（中文）。TTS 缺口：GLM-TTS 余额不足（429 已
验证），edge-tts（msedge-tts@2.0.7，zh-CN-XiaoxiaoNeural，免费无 key，
smart-voice-notify 已在用）值得纳入降级链。

## Decision

- **形态：Next.js `/api/gateway` route**，不建独立 Node 服务。理由：单进程下
  globalThis 状态（缓存/配额）天然共享；零新增部署单元/守护脚本/端口；
  组件是请求-响应式对话，无「脱离 Next 生命周期跑后台任务」的硬需求。
- **Provider 表单一来源**：`src/lib/gateway/providers.ts` 定义全部候选
  provider（gemini / zhipu / groq / qwen / openrouter），每项声明
  支持的**任务集**与**每任务排序号**、最小间隔、429 冷却期、任务专属参数
  （如 zhipu thinking 禁用）。无 key 的行自动跳过——表常驻五行，激活行数
  随 `.env` 增补（GROQ_API_KEY 等）只增不减，零代码改动扩容。
- **按任务路由（顺序降级不变，数据驱动）**：
  - `chat`（流式对话）：Gemini(0) → 智谱(1) → Qwen(2) → Groq(3) → OpenRouter(99)
  - `voice-intent`（结构化 JSON）：智谱(0) → Gemini(1) → Groq(2) → OpenRouter(99)
  - 规则：首选 2xx 赢；429/5xx 换下一家；全灭 → 503 交客户端 mock 降级
    （行为与现状完全一致，仅换数据源）。
- **per-provider 独立配额**（llmGuard 升级，旧 API 全兼容）：每个 provider
  独立串行链 + 独立最小间隔 + 429 冷却期（冷却中跳过本轮）+ 连续失败健康
  计数（≥2 次进入冷却）。全局意图缓存保留（跨任务共享，chat/voice-intent
  同文本命中）。
- **TTS 降级链补全**：`/api/tts` GLM-TTS → **edge-tts**（msedge-tts，
  zh-CN-XiaoxiaoNeural，mp3）→ 503 → 客户端 speechSynthesis。GLM 429/5xx
  不再直接 503，先落 edge-tts。
- **收敛范围（已全部完成）**：`/api/chat`、`/api/voice-intent`、`/api/cluster`、
  `/api/decompose`、`/api/diagnose` 五路由全部薄层化——provider 链/配额/超时
  统一走 Gateway，各路由仅保留业务层（prompt、结果解析、权重归一、mock
  兜底与 source 语义）。`GatewayTask` 扩为 chat/voice-intent/cluster/
  decompose/diagnose 五类，结构化类共享 zhipu 优先排序；`completeText()`
  为非流式任务提供 per-task 链 + 超时（10-15s）+ 网络异常降级，不做缓存
  （fire-and-forget 重复率低，避免 source 语义歧义）。

## Alternatives Rejected

- **独立 Node 服务**：换来部署单元/守护/端口/进程通信 4 个新问题；仅当有
  「不受 Next 生命周期约束的后台批量任务」时才值得（现无）。
- **保持全局单链加 provider**：实现最简单，但 provider 间互相拖累
  （zhipu 429 冷却期阻塞 gemini），与「多免费层并发备用」目标冲突。
- **客户端直连多 provider**：key 泄入客户端 bundle，否决。
- **/api/gateway 替换现有路由路径**：客户端 ChatPage/voiceClient 已有
  降级耦合（503→mock），保留既有路径做薄层转发，不动客户端。

## Consequences

- `.env` 新增可选 key：GROQ_API_KEY / GROQ_MODEL、DASHSCOPE_API_KEY /
  QWEN_MODEL、OPENROUTER_API_KEY / OPENROUTER_MODEL；补 key 即扩容。
- chat 首选由智谱变为 **Gemini**（昨日定策「中文对话→Gemini→智谱→Qwen」），
  voice-intent 仍智谱优先（JSON 稳定）。
- 表、引擎、路由三层分离：换 provider / 换排序只改表；配额策略只改
  llmGuard；流式/JSON/文本语义只改 engine。五路由统一走 Gateway——
  补一个 key 全部路由同时扩容。
- 意图缓存 TTL/间隔/冷却参数集中可调；per-provider 配额为单进程内存态，
  与现状同限（多实例需 Redis，已文档化，暂不需要）。
- cluster/decompose/diagnose 保留 mock 兜底（非 503），source 字段语义
  不变：真 provider 名 / "mock"。上游网络异常也计健康分（连续 2 次进冷却，
  成功后复活），墙外 provider 超时不会阻塞国内主链。
- edge-tts 为白嫖微软 Read-Aloud 接口（无 SLA、随时可能收紧——有 GLM 主链
  与 speechSynthesis 双兜底，最坏退回到现状）。