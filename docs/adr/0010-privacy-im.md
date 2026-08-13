# ADR-0010: 隐私号中枢 + IM 私信归位（N1 + N15）

日期：2026-08-13
状态：Accepted（缺口 N1 + N15 落地；功能层迭代第三批）

## 六圈定位声明
- 所属圈：第二圈 · 业务核心层
- 所属模块：隐私号中枢（隐私通话）、IM 私信中枢（chat/ 归位）
- 复用底座：`base/platform`（跨 tab 共享 transport）、`base/notify`（通知）、`lib/dial`（既有一次性线路，保留不动）
- 弹药表：无新增弹药字段——隐私会话时长 48h 为既有 P5 文档常量，不以弹药表配置（宪法 #3 弹药优先但仍避免过度抽象）

## 宪法条文对照
- 命中条文：**#7 平台三方视角**（隐私号双向隔离：双方只见虚拟号、不见真实号，平台可见全量会话）、**#9 多防线一体**（隐私通话 48h 会话 + IM 已读徽章 + 订单终局自动回收 = 组合防线，缺一不可）、**#10 降级是设计的一部分**（号码池耗尽时兜底生成 101-9xxx 号，永不拒绝服务；IM 无后端，纯本地线程）
- 偏离条文：无

## Context

两个孤点促成本 ADR：

1. **N1（虚拟号/隐私号中枢）缺失**：现有 DialCard 是「确定性一次性虚拟线路」（30min 过期），注释里明确写「P5 swaps in real virtual numbers」——本地演示演示不了真实虚拟号该有的样子：双向号码、掩码展示、48h 会话、号码池分配、订单终局回收。缺口 N1 就是把这个升级成中枢。
2. **N15（IM 中枢独立立项）未做**：`lib/chat/` 是 AI 助手对话引擎（LLM），属于 AI 圈，却躺在 lib/ 业务目录；且**用户之间没有私信通道**——撮合成交后双方只能靠 DialCard 拨号，没有文字沟通。N15 的「chat/ 归位设计」= 引擎归位到 base/ai/chat + 新增用户间 IM 县域（base/comm）。

## Decision

### 一、chat/ 归位（N15 的引擎部分）
- `src/lib/chat/*`（llmEngine/llmGuard/mockEngine/slots/llmDirective/types + 3 个测试）→ **git mv 到 `src/base/ai/chat/`**（保 git 历史）。
- 8 处 import 更新：useAppStore、ChatPage、base/ai/gateway/engine（llmGuard）、gateway/quota.test、dispatch/match.ts、match.test.ts。
- 归位表更新：lib/ 仅剩 mockData/mockResponders/dial/scan/qr（业务保留清单收窄）。

### 二、隐私号中枢（N1，`src/base/comm/privacyNumber.ts` 纯函数）
- `DEMO_POOL`（10 个演示号 101-0001…）+ `allocatePair`（幂等：同 wave 复用同一会话，号码池去重用）+ 48h 会话 + `maskNumber`（掩码）+ `dialInNumber`（双向拨入方向）+ `revokeSession`（终局回收）+ `minutesLeft`。
- 接线：`acceptClaim`（成交锁定点）自动分配隐私会话；`revokePrivacy` 供订单终局（完成/取消/争议结算）调用。
- UI：`ContactCard.tsx` 挂在成交卡片（MyClaims）DialCard 之后：掩码号 + 拨号（模拟）+ 私信入口。

### 三、IM 私信中枢（N15 的 IM 部分，`src/base/comm/im.ts` 纯函数）
- `ensureThread`（pair 归一 key 幂等建线程）+ `sendMsg`（写线程 + 收件方未读 +1）+ `markRead`（清未读）+ `threadMessages` + `unreadTotal`（tab 徽章）。
- 接线：useWaveStore 状态 `imThreads/imMessages` + actions `sendIm/markImRead`；transport union 合并（跨 tab 共享）。
- UI：ContactCard 内嵌私信对话（气泡 + 未读红点 + Enter 发送）。

### 四、transport 合并
- `privacySessions`（waveId 级去重 union）、`imThreads`（byId）、`imMessages`（byId）加入 mergeByIdLevel——跨 tab 双端可见。

## Alternatives Rejected
- **调真实虚拟号服务（阿里隐私号/Twilio 等）**：外部依赖 + 键成本，本地演示无意义；中枢留好接口，P5 换真实供应商时只动 malloc 层（宪法 #10 降级设计）。
- **IM 挂在 AI 对话引擎上**：两个域（AI 对话 vs 用户私信）混在一起违反宪法 #7 三方视角与「单职责」；独立 base/comm 域。
- **隐私号不加回收**：号码池会被占满 → 新订单无号可用（宪法 #10：永不拒绝服务）。

## Consequences
- 新增：`src/base/comm/privacyNumber.ts`、`src/base/comm/im.ts`、`comm.test.ts`（+6 单测）、`components/waves/ContactCard.tsx`；
- 迁移：`src/lib/chat/*` → `src/base/ai/chat/*`（保历史，import 全改）；
- 修改：useWaveStore（3 状态 + 4 actions + acceptClaim 挂分配）、transport merge、transport.test fixture、MyClaims、package.json 测试清单；
- 单测 332 → **338 全绿**；
- 缺口清单 N1/N15 标注已关闭；PROJECT_STATUS LAST_SYNC 同步；
- 后续（单独 ADR）：隐私号真实供应商接入层、IM 已读回执跨设备、多媒体消息。