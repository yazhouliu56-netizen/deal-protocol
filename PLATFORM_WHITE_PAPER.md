# Deal Protocol 全栈交付白皮书与运营手册

**版本**: v1.0 | **最后更新**: 2026-07-24

---

## 目录

1. [平台定位与核心本质](#1-平台定位与核心本质)
2. [五层架构与 15 个标准化模块地图](#2-五层架构与-15-个标准化模块地图)
3. [商业模式与阶梯分佣算法](#3-商业模式与阶梯分佣算法)
4. [国内落地平替路线图](#4-国内落地平替路线图)
5. [生产环境部署 Runbook](#5-生产环境部署-runbook)
6. [自动化测试与工程指标](#6-自动化测试与工程指标)

---

## 1. 平台定位与核心本质

### 1.1 平台定位

**AI Native 驱动的通用服务需求协议化、资金中心化托管与官方担保撮合基础设施。**

Deal Protocol 不是一个 SaaS 应用，而是一个**协议层基础设施**——它将双边服务交易抽象为「协议（Protocol）」这一核心数据模型，围绕协议的生命周期提供完整的 AI 生成、匹配路由、资金托管、信用评分与争议仲裁能力。

### 1.2 三句话原则

| 阶段 | 原则 | 实现方式 |
| :--- | :--- | :--- |
| **前期 — 说清楚** | 协议透明 | DeepSeek AI 从自然语言对话中提取结构化协议（品类、金额、时间、地点、规格），以机器可读的 `ProtocolJSON` 数据结构固化双方约定 |
| **中期 — 透明执行** | 资金托管 + 进度可见 | 买家付款锁定在平台官方托管户，服务商完成服务后按满意度分批释放；配合 M11 SHA-256 证据链与 6 态服务阶段机记录实时进度 |
| **后期 — 清算明白** | 阶梯分佣 + 信用追踪 | 按交易金额四档阶梯自动计算平台佣金（15%/12%/10%/8%），每笔 1% 计提保险池；六维信用评分 + 5 级权益矩阵驱动长期激励与约束 |

### 1.3 中心化担保优势

| 能力 | 说明 |
| :--- | :--- |
| **资金托管** | 买家付款锁在平台官方托管户，非服务完成不释放，杜绝跑路风险 |
| **AI 协议化** | 官方 DeepSeek 引擎从聊天记录中提取结构化协议，消除信息不对称 |
| **算法派单** | StaticRanker 与 BanditRanker 联合排序，确保最优服务商优先触达 |
| **证据链仲裁** | 每条操作写入 `evidence_log`，SHA-256 哈希链防篡改，`/verify_chain` 端点可公开验证 |
| **担保网络** | `guarantee_links` 建立担保人连带责任链，违约时自动追索 |
| **反欺诈图谱** | PostgreSQL 递归 `detect_circular_transactions` 查询，拦截资金闭环空转 |
| **保险池赔付** | 每笔交易 1% 计提 `insurance_pool`，为 SOS 应急和争议赔付提供垫付资金 |

---

## 2. 五层架构与 15 个标准化模块地图

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: UI/UX Layer ── Next.js 16 App Router + PWA       │
│  M09 (Flydan)  M14 (Team/GenUI)  M15 (Feature Flags)       │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: LLM Protocol Layer ── DeepSeek-V3/R1             │
│  M01 (Voice)  M04 (Protocol Gen)  M10 (SOS)  M11 (Evidence)│
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Matching & Routing Layer                         │
│  M03 (Category Config)  M05 (Geo Index)  M06 (Matcher)     │
│  M08 (Bandit Ranker)                                       │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Credit & Risk Layer                              │
│  M07 (Credit Engine)  P1 Tiers + Guarantee + Fraud         │
├─────────────────────────────────────────────────────────────┤
│  Layer 5: Escrow & Settlement Layer                        │
│  M02 (Auth/SMS)  M12 (Push)  M13 (Payment)                │
│  M11 (Evidence Chain)                                      │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 第一层：表现与客户端层 (UI/UX Layer)

| 模块 | 目录 | 职责 |
| :--- | :--- | :--- |
| **M09 — Flydan** | `src/modules/m09-flydan/` | 服务需求浏览与发布界面，「Flydan 鲜」多品类列表/详情 |
| **M14 — Team Formation & GenUI** | `src/modules/m14-team-formation/` | 组队协作（团长+成员）+ GenUI 动态渲染器根据 API 返回的 JSX Schema 渲染表单 |
| **M15 — Feature Flags** | `src/modules/m15-feature-flags/` | 特性开关系统，灰度发布控制 |
| **App Router** | `src/app/` | Next.js 16 App Router，97 个页面/路由，含 PWA Service Worker、Offline 页面、manifest.webmanifest |
| **Admin 管理后台** | `src/app/console/` | 管理员控制台，人工指派任务列表、系统配置面板 |

**关键页面清单（97 页编译通过）：**
- `/demands/create` — 需求发布（双栏 AI 协议画布 `SplitDemandView`）
- `/orders/[id]` — 订单详情、服务阶段跟踪
- `/payment/[id]` — 资金托管支付
- `/developer/radar` — Bandit 调度雷达可视化
- `/disputes/[id]` — 争议仲裁详情
- `/evidence/[id]` — 证据链验证
- `/sos` — SOS 应急求助
- `/profile` — 服务商/消费者个人主页（含信用等级、权益展示）
- `/provider/grab/[id]` — 服务商抢单
- 完整清单见 Next.js Build Output（40+ 页面 + 50+ API Route）

### 2.2 第二层：LLM 协议生成层 (Protocol Layer)

| 模块 | 目录 | 职责 |
| :--- | :--- | :--- |
| **M01 — Voice/Text Input** | `src/modules/m01-voice-input/` | 语音 & 文本输入转文字入口 |
| **M04 — Protocol Generator** | `src/modules/m04-protocol-generation/` | 四步 AI 协议生成流水线 |

**四步生成流水线：**

```
① 意图识别
   classifyCategory(rawText) → 品类标签
   返回: '家政' | '交友' | '按摩' | '医疗陪护'

② 结构化字段抽取
   callLLM + function calling → core_fields + category_fields
   剔除 schema 外字段（防 LLM 幻觉）

③ 校验与分级确认
   缺失必填字段 → 返回 missingFields 引导补充
   high risk 品类 / 置信度 < 0.7 → 强制确认

④ 广播
   写入 protocols 表 → 触发 matchNearby() 匹配 → 推送到候选池
```

**AI 引擎适配** (`src/lib/ai-provider.ts`):
- 默认优先 DeepSeek（国内直连，免 GFW），`DEEPSEEK_API_KEY` + `DEEPSEEK_BASE_URL` 可配置
- 备选 Gemini 1.5 Flash（`GEMINI_API_KEY`）
- 自动 fallback：无有效 Key 时使用 `mock-` 前缀 mock 适配器

**LLM 日志脱敏审计** (`src/lib/llm-adapter.ts`):
- `sanitizeForLog()` 自动脱敏：邮箱 → `[EMAIL_REDACTED]`，手机 → `[PHONE_REDACTED]`，身份证 → `[ID_REDACTED]`
- 内容截断至 4000 字符
- 1:10 采样写入 `llm_logs` 表（前 10 条全量，后续每 10 条记 1 条）

### 2.3 第三层：匹配与路由层 (Matching & Routing Layer)

| 模块 | 目录 | 职责 |
| :--- | :--- | :--- |
| **M03 — Category Config** | `src/modules/m03-category-config/` | 品类配置加载器（schema、入门要求、响应模式、风控等级） |
| **M05 — Geo Index** | `src/modules/m05-geo-index/` | PostGIS `ST_DWithin` 地理空间索引，万级 P95 < 50ms |
| **M06 — Matcher** | `src/modules/m06-matching-routing/` | 匹配路由核心，半径递进 + 信用筛选 + 排序 |
| **M08 — Bandit Ranker** | `src/modules/m08-bandit/` | 汤普森采样 Bandit 算法，30 单后自动激活 |

**匹配流程：**

```
routeProtocol(input)
  │
  ├── 5km 半径 matchNearby()
  ├── 空 → 10km 半径 → 空 → 20km 半径
  ├── 仍为空 → logEmptyPool() → 写入 admin_tasks (manual_assignment)
  │
  └── 有候选 → processCandidates()
        ├── 信用过滤 (≥50 基础分，cold start 折半)
        ├── 资质校验 (entry_requirements.qualification)
        ├── 新人保护系数 (1.3 − 0.03n, n<10)
        ├── 周末 1.5x 信用乘数
        ├── 信用 Tier 权重 (1.5/1.2/1.0/0.8/0.5)
        └── StaticRanker/BanditRanker 排序输出 top 10
```

**数据库级物理隔离：**
- `bandit_reader` 角色仅授权读取 `orders` 和 `protocols` 表
- 对 `credit_records` 与 `credit_events` 执行 `REVOKE ALL`，杜绝 Bandit 算法通过数据库侧信道推断信用分数

**空池降级机制 (§4.3)：**
- `admin_tasks` 表记录 `type='manual_assignment'` 任务
- 管理员控制台轮询该表，人工指派服务商
- 完整替代方案：自动降级到 `agency_dispatch` 模式

### 2.4 第四层：信用与风控层 (Credit & Risk Layer)

| 模块 | 目录 | 职责 |
| :--- | :--- | :--- |
| **M07 — Credit Engine** | `src/modules/m07-credit/` | 六维信用评分计算、更新、衰减、冷启动检测 |

#### 六维信用评分引擎 (§5.4)

| 维度 | 权重 | 说明 |
| :--- | :--- | :--- |
| Integrity（合规） | 25% | 交易诚信记录，违约/违规扣分 |
| Capability（能力） | 20% | 服务完成质量与技能匹配度 |
| Reliability（履约） | 20% | 准时完成率、取消率 |
| Communication（沟通） | 15% | 响应速度、评价反馈 |
| Safety（安全） | 15% | SOS 记录、安全违规 |
| Contribution（贡献） | 5% | 平台活跃度、贡献奖励 |

**评分算法** (`credit-engine.ts`):
- 基础分 = 加权求和（维度分 × 权重）
- 新注册用户默认各维度 60 分
- 每单 completion → 各维度 +1/+0.5（正向激励）
- violation → Integrity -10, Reliability -5, Safety -5
- 90 天不活跃 → 每月 2% 衰减，下限 40 分

#### 5 级信用权益矩阵 (§5.4)

| 等级 | 名称 | 分数区间 | 派单权重 | 每日抢单上限 | 极速提现 | 人工审核 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 5 | 王者/VIP | 900–1000 | **1.5x** | 无限制 | ✓ | ✗ |
| 4 | 钻石 | 750–899 | **1.2x** | 50 单 | ✓ | ✗ |
| 3 | 黄金 | 600–749 | **1.0x** | 20 单 | ✗ | ✗ |
| 2 | 青铜 | 500–599 | **0.8x** | 5 单 | ✗ | ✗ |
| 1 | 受限 | 0–499 | **0.5x** | 1 单 | ✗ | ✓ |

- 权益由 `src/lib/credit-privileges.ts` 的 `getCreditTierPrivileges(score)` 统一提供
- `matchingWeight` 在 StaticRanker/BanditRanker 评分公式中作为乘数生效
- `dailyGrabLimit` 由抢单前置守卫校验

#### 新人保护与周末加成 (§5.5)

**新人保护系数**（`getNewbornProtectionFactor`）:
```
completedCount < 10: factor = 1.3 − (completedCount × 0.03)
completedCount ≥ 10: factor = 1.0
```
示例：第 0 单 → 1.3x，第 5 单 → 1.15x，第 9 单 → 1.03x

**周末 1.5 倍加成**（`getWeekendMultiplier`）:
- 周六 (day=6) 或周日 (day=0) → 返回 `1.5`
- 工作日 → 返回 `1.0`
- 在 `processCandidates` 中统一应用于 `credit_score`

**信用衰减 (§5.6)**:
| 不活跃天数 | 行为 |
| :--- | :--- |
| < 30 天 | 不衰减 |
| 30–90 天 | 冻结（不增不减） |
| ≥ 90 天 | 每月衰减 2%，最低 40 分 |

#### 连带担保网络 (§5.10)

- `guarantee_links` 表记录担保关系（担保人 → 被担保人）
- 担保类型：`identity`（身份认证）、`skill`（技能）、`financial`（资金质押）
- 当服务商违约退款且自身余额不足时，`applyJointGuarantee()` 自动：
  1. 查询 `guarantee_links` 中 `status='active'` 的担保人
  2. 按 `stake_amount` / `max_liability` 抵扣
  3. 写入 `GUARANTEE_DEDUCTION` 交易记录
  4. 记录担保人信用扣分（Integrity -2）
- 若担保人无法覆盖全部缺口，交易失败返回具体差额

#### 反欺诈图谱 (§5.11)

- `detect_circular_transactions` — PostgreSQL 递归 CTE 查询
- 从目标用户出发，沿 `contracts (customer_id → provider_id)` 追踪最多 5 层
- 如果发现 `partner_id` 回到自身（形成闭环），即标记为自刷或空转嫌疑
- `checkFraudRisk(userId)` 封装为工具函数，输出：
  - `circularPartners[]` — 闭环合作伙伴及深度
  - `riskLevel: 'none' | 'low' | 'medium' | 'high'` — 根据最大闭环深度判定
  - `flagged: boolean` — 是否触发风控标记

### 2.5 第五层：资金托管与结算层 (Escrow & Settlement Layer)

| 模块 | 目录 | 职责 |
| :--- | :--- | :--- |
| **M02 — Auth & SMS** | `src/app/api/auth/` | 手机号验证码鉴权（阿里云 SMS），自动注册 profile |
| **M12 — Push** | `src/modules/m12-push/` | Web Push + FCM + Redis 触达服务商抢单通知 |
| **M13 — Payment** | `src/modules/m13-payment/` | 资金托管核心：7 态资金状态机 + 6 态服务状态机 |
| **M11 — Evidence Chain** | `src/modules/m11-evidence-log/` | SHA-256 哈希链证据追踪，防篡改回放 |

#### 7 态资金状态机

```
pending ──→ held ──→ released ──→ settled
              │          │
              └──→ disputed
                 └──→ refunded
```

#### 6 态服务阶段机

```
NOT_ACCEPTED → ACCEPTED → DEPARTED → ARRIVED → IN_PROGRESS → DONE
```

#### 满意度 10% 批次释放机制

- 首次释放 90%：服务商标记完成时
- 尾款 10%：客户确认满意后释放
- 争议时 `satisfaction_held` 冻结尾款，仲裁后分配

#### 支付宝沙盒国内托管通道

- 支持支付宝沙盒 (`openapi-sandbox.dl.alipaydev.com`) 与生产环境
- RSA2 异步验签 + `provider_payment_id` 幂等防重
- 按 `PAYMENT_CHANNEL=alipay` 自动切换通道

#### SHA-256 证据链

每条 `evidence_log` 记录包含：
- `prev_hash` — 前一记录的 SHA-256 哈希
- `payload` — 事件数据
- `hash` — `SHA256(prev_hash + JSON(payload))`

`/verify_chain` 端点可读取全链哈希并逐条验证完整性。

---

## 3. 商业模式与阶梯分佣算法

### 3.1 阶梯分佣公式 (§14.2)

由 `src/lib/contract/commission.ts` 的 `calculateTieredCommission(amount)` 实现。

| 订单金额范围 | 平台佣金比例 | 公式 | 例：¥1,000 |
| :--- | :--- | :--- | :--- |
| ≤ ¥500 | **15%** | `amount × 0.15` | 佣金: ¥75, 服务商: ¥425 |
| ¥500 – ¥5,000 | **12%** | `amount × 0.12` | 佣金: ¥120, 服务商: ¥880 |
| ¥5,000 – ¥50,000 | **10%** | `amount × 0.10` | 佣金: ¥1,000, 服务商: ¥9,000 |
| > ¥50,000 | **8%** | `amount × 0.08` | 佣金: ¥8,000, 服务商: ¥92,000 |

**资金流向：**
```
买家付款 → holdPayment()
  ├── 平台佣金 (commissionFee) → transactions(type='COMMISSION')
  ├── 保险池 1% (holdAmount × 0.01) → insurance_pool
  └── 服务商应得 (providerPayout) → 托管等待释放
```

### 3.2 保险池机制 (§12.9)

- **计提比例**：每笔订单金额的 1%
- **存储表**：`insurance_pool`（`protocol_id`, `contract_id`, `amount`, `type='provision'`, `sub_type='warranty'`）
- **用途**：
  - SOS 应急垫付赔付
  - 服务商违约时客户赔偿
  - 争议仲裁中的人工介入成本
- **释放**：仅限管理员或系统仲裁触发消费

### 3.3 收益模型总览

| 角色 | 收入/支出 |
| :--- | :--- |
| **平台** | 佣金收入 (8–15%) + 保险池沉淀资金管理收益 |
| **服务商** | 商品/服务费用扣除佣金 + 质保金后的净额 |
| **消费者** | 按约定支付全额费用，争议时获得保险池保障 |
| **担保人** | 担保被担保人履约，获得信用加分与潜在佣金分成 |

---

## 4. 国内落地平替路线图

### 4.1 AI 引擎 — DeepSeek 国内直连

| 能力 | 海外方案 | 国内平替 | 状态 |
| :--- | :--- | :--- | :--- |
| 协议生成 LLM | Gemini 3.5 Flash / GPT-4o | **DeepSeek-V3 / DeepSeek-R1** | ✅ 已适配 |
| 语义嵌入 | OpenAI Embeddings | **DeepSeek API 二次调用生成 1024 维向量** | ✅ 已适配 |
| Function Calling | OpenAI Tool Use | DeepSeek 原生兼容 OpenAI API 格式 | ✅ 已验证 |

**关键配置：**
```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
# 备选: https://api.siliconflow.cn/v1（硅基流动，免备案免费节点）
```

### 4.2 支付通道 — 支付宝沙盒

| 能力 | 海外方案 | 国内平替 | 状态 |
| :--- | :--- | :--- | :--- |
| 资金托管 | Stripe Connect | **支付宝担保交易** | ✅ 已适配 |
| 沙箱测试 | Stripe Test Mode | **支付宝沙盒** (`openapi-sandbox.dl.alipaydev.com`) | ✅ 已适配 |
| 异步通知 | Stripe Webhook | **支付宝异步通知 RSA2 验签** | ✅ 已实现 |
| 幂等防重 | Idempotency-Key | **`provider_payment_id` 唯一索引** | ✅ 已实现 |

```env
PAYMENT_CHANNEL=alipay
ALIPAY_APP_ID=2021000000000000
ALIPAY_PRIVATE_KEY=...（应用私钥 PEM）
ALIPAY_PUBLIC_KEY=...（支付宝公钥 PEM）
ALIPAY_GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do
```

### 4.3 用户鉴权 — 手机号 SMS

| 能力 | 实现 | 状态 |
| :--- | :--- | :--- |
| 国内 11 位手机号验证 | `/api/auth/sms/send`（发送）+ `/api/auth/sms/verify`（验证） | ✅ 已实现 |
| 自动注册 | 验证通过后自动创建 `profiles` 记录 | ✅ 已实现 |
| 短信通道 | 阿里云 SMS（`ALIYUN_SMS_*` 环境变量） | ✅ 已配置 |
| Mock 模式 | 开发环境统一验证码 `888888` | ✅ 已实现 |

### 4.4 容器化部署

```yaml
# docker-compose.yml — 77.47 MB 精简镜像
services:
  web:
    build: .
    ports: ["3000:3000"]
    environment:
      - PAYMENT_CHANNEL=alipay
      - AI_PROVIDER=deepseek
  db:
    image: postgres:15-alpine
    volumes: [postgres_data:/var/lib/postgresql/data]
```

**Dockerfile 三层构建缓存优化：**
1. `deps` — `npm ci` 依赖层
2. `builder` — `next build` 编译层
3. `runner` — 77.47 MB 最小运行镜像（仅含 `.next/standalone` + `public/`）

### 4.5 国内平替总结

| 模块 | 海外方案 | 国内方案 | 迁移复杂度 |
| :--- | :--- | :--- | :--- |
| LLM | Gemini / OpenAI | DeepSeek-V3/R1 | 低（API 兼容） |
| 支付 | Stripe | 支付宝 | 中（协议差异） |
| 鉴权 | OAuth / Magic Link | SMS 验证码 | 低 |
| 地图 | Google Maps | PostGIS 自建 | 低 |
| 推送 | FCM | Web Push + 自建 | 低 |
| 容器 | Docker | Docker | 无差异 |

---

## 5. 生产环境部署 Runbook

### 5.1 最小化启动命令

```bash
# 1. 克隆项目
git clone <repo-url> deal-protocol
cd deal-protocol

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，至少填写:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY

# 3. 启动（Web + PostgreSQL）
docker compose up -d

# 4. 查看日志
docker compose logs -f web

# 5. 运行数据库迁移（如果使用外部 Supabase）
npx supabase migration up
```

### 5.2 关键环境变量速查表

| 变量 | 必填 | 说明 | 国内推荐值 |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | Supabase 项目 URL | 国内自建 Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | Supabase 匿名 Key | — |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | 服务端角色 Key | — |
| `NEXT_PUBLIC_SITE_URL` | ✓ | 站点 URL（支付回调用） | `https://your-domain.com` |
| `AI_PROVIDER` | | AI 引擎选择 | `deepseek` |
| `DEEPSEEK_API_KEY` | | DeepSeek API Key | 必填（国内主力） |
| `DEEPSEEK_BASE_URL` | | DeepSeek API 端点 | `https://api.deepseek.com/v1` |
| `PAYMENT_CHANNEL` | | 支付通道 | `alipay` |
| `ALIPAY_APP_ID` | | 支付宝应用 ID | 支付宝开放平台申请 |
| `ALIPAY_PRIVATE_KEY` | | 应用私钥 PEM | — |
| `ALIPAY_PUBLIC_KEY` | | 支付宝公钥 PEM | — |
| `ALIPAY_GATEWAY` | | 支付宝网关 | `https://openapi-sandbox.dl.alipaydev.com/gateway.do`（沙箱） |
| `ALIYUN_SMS_ACCESS_KEY` | | 阿里云 SMS AccessKey | 如使用手机号登录 |
| `ALIYUN_SMS_SECRET` | | 阿里云 SMS Secret | — |
| `CRON_SECRET` | | Cron 鉴权密钥 | 定时任务接口守卫 |
| `PII_ENCRYPTION_KEY` | | PII 加密密钥（32 字符 hex） | 用户隐私数据加密 |

### 5.3 健康检查端点

| 端点 | 用途 |
| :--- | :--- |
| `GET /api/health` | 存活检查 |
| `GET /api/verify/chain` | 证据链全量验真 |
| `GET /` → 200 | 页面可达性 |

### 5.4 运维命令参考

```bash
# 查看服务状态
docker compose ps

# 滚动重启 Web
docker compose restart web

# 查看实时日志
docker compose logs -f --tail 100

# 数据库备份
docker compose exec db pg_dump -U postgres deal_protocol > backup.sql

# 数据库恢复
docker compose exec -T db psql -U postgres deal_protocol < backup.sql

# 全量测试
npx vitest run

# 生产构建验证
npm run build

# 类型检查
npx tsc --noEmit
```

---

## 6. 自动化测试与工程指标

### 6.1 测试套件概况

| 指标 | 数值 |
| :--- | :--- |
| **测试总数** | **1,643 项通过**（1 项预存 e2e 集成失败） |
| **测试文件** | 170 个通过（4 个预存失败：3 Zod + 1 e2e） |
| **测试框架** | Vitest |
| **运行耗时** | ~26 秒（含 transform + collect） |

### 6.2 测试覆盖矩阵

| 测试文件 | 覆盖模块 | 项数 |
| :--- | :--- | :--- |
| `tests/p0-deviations.test.ts` | P0 5 项偏差回归（佣金/保险/隔离/日志/路由） | 21 |
| `tests/p1-gaps.test.ts` | P1 5 项缺口（信用等级/新人保护/人工指派/担保/反欺诈） | 19 |
| `tests/m02-auth.test.ts` | 鉴权流程 | — |
| `tests/m04-protocol-gen.test.ts` | 协议生成流水线 | — |
| `tests/m05-geo.test.ts` | 地理索引 | — |
| `tests/m06-matching.test.ts` | 匹配路由 | — |
| `tests/m07-credit.test.ts` | 信用引擎 | — |
| `tests/m08-bandit.test.ts` | Bandit 调度 | — |
| `tests/m09-flydan.test.ts` | Flydan 需求列表 | — |
| `tests/m10-sos.test.ts` | SOS 应急 | — |
| `tests/m11-evidence-chain.test.ts` | 证据链 | — |
| `tests/m12-push.test.ts` | 推送 | — |
| `tests/m13-payment.test.ts` | 资金托管 | — |
| `tests/m14-team-formation.test.ts` | 组队 | — |
| `tests/e2e-integration.test.ts` | 端到端烟雾测试 | — |

### 6.3 类型安全与构建

| 指标 | 数值 |
| :--- | :--- |
| **TypeScript 报错** | **0** |
| **页面/路由编译** | **97 全部通过** |
| **Docker 镜像大小** | 77.47 MB |
| **构建耗时** | ~40 秒（CI 环境） |

### 6.4 CI 质量门

```yaml
# 每次提交自动执行：
1. npx vitest run          # 单元/集成测试
2. npx tsc --noEmit        # 类型检查
3. npm run lint             # 代码风格
4. npm run build            # 构建验证
```

---

*本文档为 Deal Protocol v1.0 全栈交付白皮书。所有实现以源代码为最终依据，设计与架构决策见 `AGENTS.md` 及各模块 `SKILL.md`。*
