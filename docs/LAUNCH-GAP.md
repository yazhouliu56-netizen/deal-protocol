# 上线前缺口清单（LAUNCH GAP）— 2026-08-09

> 定位：纯本地 demo 已「完整可演示」（207 单测 + 12 条 E2E 覆盖），
> 本文列与真实线上状态的差距，按依赖分组。G = 不依赖数据化即可做，
> D = 依赖 Supabase 数据化才成立，E = 外部依赖不可控。

## 已闭环（本轮，无需再动）

| 项 | 状态 |
|---|---|
| 雷达局收藏（心形 + 关注局面板 BMP） | commit dc22594 |
| 扫码识别（模拟相机 → 扫分享 → 直达拼位局） | commit 05ec324 |
| 离线降级 E2E（生产构建 + SW shell 五屏兜底） | commit d1ce09b |
| verify-prod 编排（build→生产 start→全 E2E） | commit d1ce09b |
| 心愿单收藏入口（AR 详情卡 toggleCart 已带） | 已存在 |
| 目的地中心（筛选抽屉 + 全部列表） | commit cbfdd36（G-1/G-2） |
| 通知中心（铃铛 + 角标 + 已读持久） | commit 254a9fd（G-3） |
| PWA 安装引导 + 数据源徽章 | commit b08f406（G-4） |
| 未登录 Profile guest 引导 | commit f3c1dc5（G-5） |

## G 组：纯本地占位（已全部清零）

| 缺口 | 说明 | 估算 |
|---|---|---|
| 「筛选体验」按钮无行为 | SearchBar 的 SlidersHorizontal 占位 | 0.5d：做放映抽屉（预算/时长/就近）驱动目的地卡过滤 |
| 「查看全部」无聚合页 | 首页热门目的地只有 scroll-to | 0.5d：全目的地列表页 |
| 无通知中心 | 推送收在雷达收件箱，无系统级通知/角标 | 1d：通知托盘 + badge |
| PWA 安装引导 + 数据源指示 | 无 install prompt；无「本地数据/在线同步」环境徽章 | 1d |
| 未登录 Profile 的 guest 引导 | Supabase 门内直连，未登录视觉断点 | 0.5d |

## D 组：依赖全量数据化（见 PROJECT_STATUS 数据化蓝图）

| 缺口 | 说明 |
|---|---|
| 多设备实时一致性 | localStorage/persist → Postgres + Realtime（bundleVer 守卫已有注释） |
| 多租户隔离 | 每用户私有（claims/钱包/收藏/订阅/竞价）→ RLS 策略 |
| 真机扫码 | getUserMedia + 二维码解码替换 ScanMock |
| 存量迁移引导 | localStorage 首登 → 云端 merge（一性提升档） |
| 漫游风控真实化 | 指纹绑定 → 设备表 + 登录事件（roamGuard 已是纯函数，直接迁移） |

## E 组：外部依赖（上线时才呼吸，本地无法完全等效）

| 项 | 现状 |
|---|---|
| LLM 聚类推送 | 本地 MockEngine 降级；真线上用 LLM key + 失败降级 |
| 地图瓦片 | OpenFreeMap 需在线（离线报 AJAXError，已从 E2E 过滤） |
| 支付 | 本地模拟收银台；线上接三方 |
| 短信/推送渠道 | 无；线上接 SMS/推送服务 |

## 验收口径

- `npm run verify-prod`（build → 生产服务器 → 12 条 E2E）替代人工上线演练。
- 每项 G 组完成即：`test:units` 绿 + 浏览器实测一句证据 → 记入 PROJECT_STATUS。