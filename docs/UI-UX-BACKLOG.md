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
| 4 | 行程屏英文残留 | `otoActivities` 的 location 为英文（Maldives/Bali），渲染进 AR 指南（`{act.location}`）与地图视图 tab | ✅ location 中文化（mockData.ts 4 处：马尔代夫/巴厘岛） |
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