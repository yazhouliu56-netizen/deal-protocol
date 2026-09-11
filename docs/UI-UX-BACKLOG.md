# UI/UX 改进清单（UI-UX BACKLOG）— 2026-08-12 第二批

> 定位：UI/UX 打磨专项第二批（第一批九件套已全清零，见 PROJECT_STATUS `8b8cfc4`）。
> 排序即执行顺序（P1 → P3），每项完成：`test:units` 绿 + 浏览器实测一句证据 → 记入 PROJECT_STATUS。

## P1 高价值（正确性 + 核心漏斗）

| # | 项 | 说明 | 状态 |
|---|----|------|------|
| 1 | 触控尺寸全面达标 | 实测发现多处小按钮 <40px：心愿单 w-9→w-11、查看全部/在线状态/关注按钮 min-h-10、引导条/气泡「知道了」min-h-8（WaveFeed.tsx / ChatPage.tsx / page.tsx） | ✅ 0 个触控不达标（430×932 实测） |
| 2 | hydration 修复（React #418 根因） | **根因确认**：`useState(() => localStorage.getItem(...) !== null)` 客户端首渲直读 localStorage，与服务端快照（null）不一致 → React #418 hydration 错误（「知道了」引导条 / 语音气泡两处）。**修复模式**：新增 `lib/clientFlags.ts`（useSyncExternalStore 同构：server 快照恒 false，subscribe 时从存储 warm，首个客户端快照即翻转，无水合不一致，同 readKeys/mapPref 既有范式），两处改用 `useFlag/markSeen`。**顺带修复**：`readKeys.ts` getServerSnapshot 每次 `new Set()` 导致 React「结果应被缓存」overlay warning → 改模块级常量 `EMPTY` 固定引用 | ✅ 浏览器实测 0 hydration 错误 / 0 console error（仅存量 THREE.Clock deprecation 噪音） |
| 3 | 在线状态反馈 | 切在线/隐身无任何反馈；文案「在线 · 正在接收信号」重复语义 | ✅ 切换即 toast（「已切换为在线/隐身」）+ 文案去重（「正在接收信号/暂停接收信号」）（WaveFeed.tsx） |

## P2 中价值（体验一致性）

| # | 项 | 说明 | 状态 |
|---|----|------|------|
| 4 | 行程屏英文残留 | `otoActivities` 的 location 当初为英文目的地（已整体中文化），渲染进 AR 指南（`{act.location}`）与地图视图 tab | ✅ location 中文化（mockData.ts 4 处）；后续行程屏已整体转型履约座舱，该数据源随之移除 |
| 5 | AR 屏英文角标 | 取景框角标 `AR VIEWFINDER`（8px 英文 tech 装饰） | ✅ →「AR 取景框」（page.tsx:578） |
| 6 | 发布弹层分组 | PublishSheet 为长单列（品类→广播，9+ 区块全摊开），核心要素被可选配置稀释 | ✅ 核心表单（品类/时间/地点/预算）+「更多选项」折叠开关（定制条件/磋商留言/AI 拆解/开放局/鸽子险/有效期/开始时间/配额 收起），实测折叠/展开完整（PublishSheet.tsx） |

## P3 低价值（打磨，浏览器实测后定）

| # | 项 | 说明 | 状态 |
|---|----|------|------|
| 7 | 行程屏「导航」按钮触控 | `py-1` 实高约 22px，触控不达标 | ✅ → `min-h-8`（32px，实测 4 个导航按钮全部达标，page.tsx ActivityRow） |
| 8 | 发布弹层品类快捷 chips | `py-1` 高频点击项偏小 | ✅ → `min-h-8`（32px，PublishSheet.tsx） |

---

## 附：React #418 根因结论（P1 #2 落档）

- **现象**：hydration warning `#418`（引导条「知道了」、AI 屏语音气泡首次进入闪现）。
- **根因**：这两处用 `useState(() => typeof window !== "undefined" && !localStorage.getItem(key))` —— 服务端渲染首快照与客户端水合首快照不一致（localStorage 仅客户端可见）。
- **模式**：`lib/clientFlags.ts` 封装 `makeFlagHook(key)` → `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`：server 快照恒 `false`；`subscribe`（客户端水合时执行）从 localStorage warm 并通知翻转。**结论：该模式与 08-10 已修 NotificationCenter readKeys、08-09 mapPref 同构，已在全库统一（3 处），后续所有「一次性记忆」标志一律走 clientFlags，禁止再直接 useState 读 localStorage。**
## 图片提示（2026-09-10 dual-role e2e 发现，2026-09-11 已修 + 降噪回退）

- sleepy-beast.png 按真实 180×132 等比（props 180×132 + `h-auto w-[72px]`，CSS 与宽高比一致，aspect 警告消除）；capybara.png 首屏 hero 加 `priority`（`eager` 透传，仅 hero，列表/空态不抢 LCP）。e2e-dual-role-human mascots 降噪过滤已删除，零告警实证通过。

## P2  parked（2026-09-11 三路审计结论：不动的需设计裁决/基线重拍，不顺手改）

- **8 自造体系迁移**（draft/cockpit/fc/hk/mt/cp/dyn/ms 嵌入式 CSS）：e2e 选择器依赖 `.draft-card` 等类名 + docs/shot 截图基线，整迁需设计裁决 + 基线重拍，另起批次。
- **暗岛 hex**（仲裁/座舱 inline + 渐变 + AmmoPillBar/Tier 动态 map）：值为动态 theme 查找，无法静态 class 化；且本仓未 emit TW color vars，`var(--color-red-300)` 式映射会静默断色。冻结。
- **阴影 25 行**：P13 冻结范围（卡片/按钮）之外，无功能影响。冻结。
- **loading/not-found/error 矩阵**（32 页仅 5 loading、无根 not-found/error）：加法安全但改动面广，另起批次。
- **杂项**：favicon.ico 缺失（404 噪音）、sitemap 仅收 3 页、fire-and-forget 定时器 5 处、`useIdentityStore` 顶层 localStorage（有守卫，低风险）。

## 对比度裁决落地（2026-09-11 用户拍板：亮底按钮改深色字）

- 实测：白字在绿/蓝/橙/红上仅 2.1~3.3（AA 要 4.5）；eel（#4b4b4b）也不够（2.6~4.2）。
- 落地：DuoButton 主/次/险 + DuoPill solid + DuoPathNode + 主轨 15+ 文案按钮一律 `text-neutral-900`（各底 ≥4.9，脚本实测）；wolf `#777777`→`#767676`（4.48→4.54，同像素级）。
- 豁免：图标/emoji 徽章（非文本不适用）、深底白字（zinc/slate 底本就达标）、admin 渐变按钮（随 Batch① 全面Duo化到 admin 轨时一并处理）；hare #afafaf 纯装饰位保留。
