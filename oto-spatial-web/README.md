# OTO Spatial Web

空间化本地线下面基服务 PWA：AI 撮合对话 + 六维评分 + 双视角闭环 + AR 场景 + 全息玻璃 UI。

## 快速开始

```bash
npm install
npm run dev          # 开发（http://localhost:3000）
npm run build        # 生产构建（Turbopack）
npm run start        # 生产运行
npm run restart:prod # 一键重启生产（taskkill /T 杀进程树 + 就绪轮询）
```

## 对话引擎（可插拔双引擎）

- **MockEngine**：本地确定性规则引擎（离线 / 无 key 兜底），默认
- **LlmEngine**：Gemini 驱动（`gemini-2.5-flash`），需 `.env.local`：

```bash
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash
NEXT_PUBLIC_LLM_PROVIDER=gemini
```

架构：LLM 只负责意图抽取 / 追问 / 文案（严格 JSON 指令协议，见 `src/lib/chat/llmDirective.ts`）；时段卡、六维撮合评分、确认单全部走本地确定性代码（`lib/match.ts`）。key 只在服务端 `/api/chat` 代理中使用，客户端零泄漏。LLM 连续失败 2 次自动降级回 MockEngine。不配 key 则整个引擎回退 Mock。

## 测试

```bash
npm run test:units       # 纯函数单测（撮合/时段/LLM 指令解析）
npm run test:e2e         # 撮合全链路（排序/徽章/评分/预订/双视角/取消）
npm run test:e2e:app     # 分支 E2E（热卡/搜索/心愿单/工作台/AR 锚点）
```

> `test:e2e*` 需先 `npm run start`。配置了 Gemini key 时 E2E 走真 LLM（追问语料放宽）；CI 无 key 自动走 Mock（确定性）。

## 测试自动化

`.github/workflows/ci.yml`：lint + test:units + build（Node 24）。

## 撮合算法（六维 100 分制，src/lib/match.ts）

budget 25 / level 20 / style 20 / rating 15 / distance 10 / availability 10；同分按 rating→distance 决胜；4 人以上组局场地获 groupBonus；`slots.ts` 动态生成本周六/日时段。