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

## 色盲走查结论（2026-09-11，Chrome 稳定版 CDP 三态截图实证）

- 首页三态（正常/deuteranopia/protanopia）：绿 CTA 在红绿色盲下偏橄榄黄，但今日本批深色字保证可读；发单/雷达双段（橙标 vs 蓝标 + 文字）、五态胶囊（emoji+文字）、SOS（文字键）、安全/真伪徽章（颜色+文字）均无纯颜色信号。
- 结论：主轨无色盲阻断；今日深色字裁决附带增益了色盲可读。暂不加 tritanopia（占 CVD <1%）。

## 撤销窗落档（2026-09-12，Batch② 下半）
- 语义：评价提交后 72h 内本人改 1 次（低分解释门同样适用，改后重算分并记 editedAt/editCount）；举报 open+本人+非auto 可撤 → withdrawn（退出待处理队列、可重报；resolved 不可撤）。
- 落点：base editReview/withdrawReport + 单测；trustSlice editReview/withdrawReport（重报复活旧件保 id 唯一，留 withdrawnAt 痕）+ useAppStore editReview；UI：ReviewSection/ReviewFormModal 修改入口（走 ConfirmSheet），WaveCard/MyWaves/MyClaims 撤回入口（可逆直执，不走确认）。
- 考卷：e2e-review 加 A 改一次（5.0→4.7，B 仍 Lv5，二次入口消失）；e2e-governance 加撤回+重报（下游裁定不变）；ReviewFormModal.test.tsx 订单轨。
- 注记：服务端 POST /api/reviews 零 UI 调用，本次不动（改它需 Supabase evidence_chain 加列，另案）；resolved 后再举报的同 id 并存为既有语义，本次未动。

## Duo 化 Batch①-1：CompanionSlot 首发（2026-09-12）
- 改写：夜幕紫暗岛 <style>（.cp- 全套渐变/玻璃）删除 → DuoCardShell 白底 + DuoPill（武装绿/未武装黄 solid）+ 伪装假电话 Duo primary + 距离虚线 polar 行 + 拉黑 Duo danger；text-slate-300 收敛 wolf。
- 决策：夜幕紫身份由父级 data-theme=companion 承载，卡片纯 Duo（未引入紫 token）；拉黑用 danger（破坏性动作诚实映射）。
- 契约零动：data-slot/data-action/props/文案全保留；cockpit-battle4/FulfillmentCockpit/E2EIntegration 71 例绿。
- 考卷：e2e-sos-hardware 加 4b（座舱挂载 + 落图 docs/shot/companion-slot-duo.png，Pill 换行修一次）；附带修该脚本预存 flake：接单 toast 文案含“行程”子串撞 getByLabel → exact:true。
- 剩余 8 岛：ArbitrationSheet / DynamicDraftCard / FulfillmentCenter / FulfillmentCockpit / MilestoneLadder / MeetupSlot / HousekeepingSlot / DynamicAmmoSlot（中心与座舱体量大，另起 commit）。

## Duo 化 Batch①-2：家政 + 组局双插槽（2026-09-12，Companion 先例复用）
- HousekeepingSlot：删 hk- 暗岛 <style> 全套 → DuoCardShell + 定制标签 DuoPill neutral/soft + 加价上限三色 polar 横幅（超限红/正常绿/默认灰）+ 确认增项 primary / 拒绝 outline + 双拍格（secondary 拍照打卡，鉴真徽标 DuoPill dark  overlay 专用）+ 损坏包赔 danger + 拍照 modal  mask 留黑、sheet 转白；逻辑/state/ProofCamera/data-* 全保留。
- MeetupSlot：删 mt- 暗岛 → 座次格（到场绿框绿字/未到场 polar）+ 围栏行 + 扫码到场 warning + AA 对账（补缴绿/退还黄）+ 确认分摊 primary + 放鸽子申诉 outline。
- 附带： HousekeepingSlot openCapture Date.now 被 react-hooks/purity 新规拦截 → eslint-disable-next-line + 理由（事件回调生成单号，render 纯；仓内既有此惯例）。
- 考卷：battle4/Cockpit/E2EIntegration/real-user-sim 76 例绿（含确认增项/确认分摊点击语义）；dual-role-human 加 hk 落图、openmatch 加 mt 落图；vitest 843 + oto 1269 + build 过。
- 剩余 6 岛：ArbitrationSheet / DynamicDraftCard / FulfillmentCenter / FulfillmentCockpit / MilestoneLadder / DynamicAmmoSlot。

## Duo 化 Batch①-3：MilestoneLadder（2026-09-12）
- 改写：删 ms- 暗岛 <style> → DuoCardShell（mt-3 保留原外边距）+ 状态 DuoPill soft（待生效 neutral/托管中 yellow/待验收 blue/已放款 green/已退款 red）+ 提交验收 secondary sm / 验收放款 primary sm；序号徽标收敛 swan 底 eel 字；放款 ConfirmSheet 保持。
- 契约零动：data-testid/data-status/文案/金额格式全保留；自有单测全状态跃迁 + ConfirmSheet 放款链绿，FulfillmentCockpit 宿主侧绿。
- 诚实注记：无浏览器落图——尚无 e2e 构造 funding.milestones 挂载 ladder（grep 确认零覆盖）；所用 Duo 原语均已在他岛落图实证，回归由 openmatch（座舱挂载链路）PASS 覆盖。
- 剩余 5 岛：ArbitrationSheet / DynamicDraftCard / FulfillmentCenter / FulfillmentCockpit / DynamicAmmoSlot。

## Duo 化 Batch①-4：DynamicDraftCard（2026-09-12）
- 本单特殊：外层已是 Duo 白底（Feather 3D 卡 + DuoButton CTA），残留暗岛 = DRAFT_CSS 玻璃拟物 <style> + 内层深色字。删整块 CSS（含已死亡的 .draft-card-cta ripple——CTA 早换 DuoButton），内层收敛：参数胶囊 PARAM_PILL（eel 字）/ 调节器抽屉 ADJ_*（polar 底白按钮）/ 价格 polar 行 / 指南 polar 虚线 / 保障 Duo 绿 / 安全徽章 DuoPill neutral。
- 硬锚点全保：外层首类名 draft-card + draft-* 主题类 + motion(stiffness400/damping30/willChange) + draft-card-required 精确类名（style 补 red-dark 字色）+ data-*/文案；自有 25 例 + ThemeIsolation 绿。
- 考卷：e2e-app 加草稿卡落图 docs/shot/draft-card-duo.png，一次过；vitest 843 + oto 1269 + build 过。
- 剩余 4 岛：ArbitrationSheet / FulfillmentCenter / FulfillmentCockpit / DynamicAmmoSlot（座舱三巨物 + 仲裁）。

## Duo 化 Batch①-5：ArbitrationSheet（2026-09-12）
- 改写：删 SHEET_CSS 暗岛 → DarkSheetShell 保留（深色遮罩/z80-81/拖拽离场/Esc/data-action 契约是行为资产，只换面板视觉），面板 Duo 白底（把手经 [&_.dsheet-grip] 浅色化）+ 标题 DuoPill（L1 绿/L2 黄/L3 红 solid，中性窗口/弹药 soft）+ 关闭 ghost + 证据区 polar + 鉴真徽标 DuoPill soft（色→tone 映射）+ AI 卡白底 + L1 绿 tint/L3 红 mist + 法务红点改 motion-safe:animate-ping（减弱动效偏好生效）+ 出口：接受 primary/人工 outline/秒赔 primary/法务 danger。
- 契约零动：data-testid/data-action/data-level/data-order/文案全保留；三级分流单测 + chain-anchor 单测 + E2EIntegration 52 例绿。
- 考卷：openmatch 加抽屉落图 docs/shot/arbitration-sheet-duo.png。探针修两次：① 零尺寸 wrapper 不可截图 → 补 panelTestId=arbitration-panel（组件侧）；② 抽屉遮罩挡住后续步骤 → 落图后点关闭再走。落图恰好命中司法导出 401 错误态，Duo 错误路径一并实证（后端鉴权 env 问题，非本单范围）。
- 剩余 3 岛（座舱三巨物）：FulfillmentCenter / FulfillmentCockpit / DynamicAmmoSlot。

## Duo 化 Batch①-6：DynamicAmmoSlot（2026-09-12）
- 改写：删 SLOT_CSS 暗岛 → Duo 白底卡（dyn-slot 首类名保留作身份钩）+ polar 参数行（dyn-param/dyn-param-icon 首类名前缀保留，单测 class="dyn-param 前缀锚点绿）+ 定制标签/引信徽标/SHA 链全换 DuoPill（鉴真 forgeryClass() 色映射→forgeryTone() tone 映射，solid 变体浮于照片）+ 双拍状态文案 Duo 语义色 + 拍照弹窗白底 Duo 卡（原深蓝渐变 sheet）。
- 争议入口 DuoButton（outline/⚖️ 申请调解/申诉）本单未动——已是 Duo。
- 考卷新建 e2e-dyn-slot.mjs（SUITE_ORDER + MANUAL_ONLY…不，是 SUITE_ORDER 正式位 + RULES 映射 DynamicAmmoSlot/CockpitAmmoSlot/dyn-slot），宠物寄养全链路发单→接单（直达 accepted）→行程座舱落图 docs/shot/dyn-slot-duo.png。
- 探针三连修（均记档）：① dual-role 行撑爆撞 57014 → 新卷独占 oto::e2e::dyn-slot 行；② B 波卡永不出现 → feed 硬筛 identity.categories 品类匹配，预置须扩「宠物寄养」；③ 修空调 variant=hk（复用家政模板）根本不挂 dynamic-ammo → 改考 pet-boarding-v1（-actionSchema.variant=dyn 唯一真身，registry 全表实测）。
- 剩余 2 岛（座舱双巨物）：FulfillmentCockpit / FulfillmentCenter。

## Duo 化 Batch①-7：FulfillmentCockpit（2026-09-12）
- 改写：删 COCKPIT_CSS 暗岛（仅留 max-width 结构钩）→ Duo 白底 3D 大卡（cockpit 首类名保留）+ 服务者卡 polar 白底（实名徽标换 DuoPill green，六维信用分保留）+ 通话/聊天换 DuoButton secondary sm（data-action/aria 原样透传）+ 安全徽标 SAFETY_PILL_META className→tone（GUARDED/ATTENTION/THREAT=green/yellow/red，describeSafetyPill 同步）+ 强化守护条 Duo 绿底 + 定制标签 DuoPill neutral。CTA/资金盾/通关地图/里程碑本就 Duo，未动；StatusCapsule 外骨骼锚点不动（前端红线①）。
- 单测 27/27 零改过（data-scenario/data-theme/data-action/data-testid/文案锚点全保留，无用例断言 cockpit-* 类名）；e2e-dyn-slot 重跑 PASS + 整屏落图 docs/shot/cockpit-duo.png。
- 六圈定位：L1 触达（履约座舱主屏）+ L2 业务核心（五态履约）；复用 base/safe runtime-monitor（徽标语义）+ milestone-escrow（阶梯已 Duo）；弹药表零新增。命中 #1/#4 + 外骨骼红线①，偏离无。
- 剩余最后 1 岛：FulfillmentCenter。

## Duo 化 Batch①-8：FulfillmentCenter（2026-09-12，8 岛收官）
- 改写（仅 Center 自有层；IntentCard/MoneyStrip/Cockpit/抽屉/DialCard 本就 Duo，未动）：删 fc-dispute/fc-total/fc-frozen/fc-note 暗岛 → 争议入口 DuoButton outline sm（data-action=open-dispute 原样，e2e-openmatch 回归 PASS）+ 增项改价 DuoButton outline fullWidth + 订单总额 polar 白底卡（金额 Duo green-dark）+ 定金解冻/仲裁横幅 DuoPill green/yellow 居中 + cta-hint/summary/transit-error Duo 语义色。W4 伪装来电遮罩保留深色（功能性通话屏，ArbitrationSheet DarkSheetShell 同例）。
- 单测 49/49（E2EIntegration/cockpit-battle4/real-user-sim 零改过）+ vitest 843 + oto 1269；e2e-dyn-slot 重跑 PASS（像素级实证：provider/path 行底 #F7F7F7 polar，插槽 #FFFFFF）。
- 六圈定位：L1 触达（Trip 屏总装）+ L2 业务核心（advanceLifecycle 核销接线不动）；弹药表零新增。命中 #1/#4 + 外骨骼红线①，偏离无。Batch① 8 岛清零。

## Batch②-1：loading/error 矩阵（2026-09-12）
- 范围诚实化：32 页中仅 demands/[id] 是异步服务端页（配 loading 骨架）；其余同步/客户端页加 loading 属死文件，不加。根级补齐 not-found（非法 URL + demands 三分支 notFound 全进 Duo 404）+ error（unstable_retry，16.2 新契约，读 dist/docs 核验）+ global-error（自带 document，全内联样式，零 Token 引用有单测锁死）。
- 实证：browser 真 404（/m20/不存在…，status 404，白底卡 rgb(255,255,255)，落图 root-not-found-duo.png）；npm run build 101 路由（/_not-found 注册）；root-states.test.tsx 5 例。
- 附带：proxy.ts 摸清——未知路径先撞 auth 网关（未登录→/login 302），真 404 只发生在放行前缀下；这也是 demands 未登录走 notFound（→登录后才见 404）的语义来源。
- admin/error.tsx 深底未动——留待 Batch②-2 admin 轨 Duo 化一并处理。

## Batch②-2：admin 轨 Duo 化（2026-09-12）
- 现状：layout 本就浅（zinc-50+白侧边栏），7 个业务页在里面套 min-h-screen zinc-950 深黑壳（视觉打架）；admin 首页/review/config/protocols 早就是浅 shadcn 系，未动。
- 改写（机械映射，零逻辑，diff 抽查 disputes 确认纯 class）：深黑壳→去壳（layout 已供底+padding）/白卡，zinc-800/900 边框→swan，zinc 灰字→eel/wolf/hare，emerald-400/rose-300→700 系（亮底可读），rose 错误块→rose-50/200，amber 图标→600；语义红/绿实心判定按钮保留（内控台豁免延续）；layout indigo→duo-blue（含首页 5 处）。
- error.tsx 重写 Duo 白卡（unstable_retry）；modal 黑遮罩/来电式暗层保留（功能性）。
- 门禁：tsc 0 + lint 0 + vitest 848 + oto 1269 + build exit 0 + corridor-factory  scoped PASS。EPERM 插曲：standalone server 占锁导致 build 失败，走 kill→build→restart-prod 3100 标准流恢复。

## Batch②-3：杂项核销（2026-09-12，零代码，全实证）
- favicon 404：已 stale——src/app/favicon.ico 存在，真机 curl /favicon.ico = 200。不动。
- sitemap 3 页：实为 4 条（/、/landing、/rights、/offline），/sitemap.xml = 200；login/register 系有意不收（禁爬.auth 壳），demands 动态段随宿主消亡已移除（注释留痕）。不收不动。
- 5 处 fire-and-forget 定时器：逐一审计——use-mounted-now（clearTimeout+clearInterval 双清）/ use-sse（fallback+es 双关）/ track-metric（flushTimer 单例守卫+60s 批刷，设计如此）/ duo-audio-confetti（毫秒级自清）/ sla-enforcer（服务端有意轮询壳）。零泄漏，不动。
- identity 顶层 localStorage：typeof window + try/catch 双守卫 + skipHydration（D-20260825-01），值回灌走 IdentityRehydrator effect。低风险成立，不动。
- 结论：Batch② 全清（矩阵+admin+杂项），UI/UX BACKLOG 无 open 项；冻结项（暗岛 hex/阴影/来电暗层/tritanopia）维持原裁决。

## Batch③-0：立规矩（2026-09-12，用户三拍板：SOS降级认/ticker砍/主循环认）
- 主循环一句话：说句话→有人接→履约到底。配角（AR/SOS/ticker/吉祥物）视觉权重不得与主循环平权。
- Motion token：src/lib/duo-motion.ts（press 180ms / settle 320ms / back-out[0.34,1.56,0.64,1]，theater 900ms 须单处注释理由）。新动效一律吃 token，手写 duration 即债。
- 屏幕预算：单视口主行动组 ≤5（组内副按钮必须同 job，如 hero 输入/麦/出发=同一复合 CTA）；超限必须滚屏或折叠，禁止硬塞（home/trip/profile 三屏 932 零滚动即本案）。hero 麦保留：复合主行动内件，Duo 同款 pattern，砍它为凑数而非治本。
- Mutation 范式：用户高频写操作（发布/接单/评价/仲裁确认）一律 useOptimistic + 失败 rollback + toast；spinner 只允许阻塞式系统等待（登录/支付），业务等待一律骨架（须与内容 1:1 映射）。
- 入口 in/out 对：新增入口必须在 BACKLOG 指名替换掉的旧入口；空态统一走 DuoEmpty（零引用即债，行程三卡是本案）。
- e2e 门禁（③-5 落）：首屏 button 普查上限 + 单主行动断言 + DuoEmpty 覆盖率。

## Batch③-1：首页减法（2026-09-12）
- ticker 砍：AmmoPillBar 两处时段 caption 删除 + 死文件出清（HomeTickerMarquee 空壳/InspirationChips 数据孤岛，零引用实证）。
- 4 门→1+折叠：hero 输入+出发为主门；说句话发单/AI 撮合收拢至 more-publish-toggle（内部门 testid/aria 原样，零漂移）。
- AR 降级：悬浮 pill 撤除 → 雷达段内联 radar-ar-entry（aria-label=AR 扫描保留）；e2e-app 2 处 + e2e-offline 1 处各增一切段动作。
- ⚠️ §3 裁决 C（用户 2026-09-12）：悬浮 SOS 有在途单隐藏（胶囊 SOS 在位）、无单保留。铃铛行/胶囊/座舱 SOS 不动；sos-hardware 考卷在行程屏（座舱 SOS）不受影响。

## Batch③-4：丝滑（2026-09-12）
- 抢单乐观化：useClaimDemand 加 onOptimistic/onRollback（不传=原阻塞语义零漂移；GrabConsole/ProviderConsole 未接保持原样）；IncomingListClient 暂存+先行移除+失败回滚（realtime 通道去重）；SwipeableCard 透传。时序考卷 useClaimDemand.optimistic.test.tsx（成功/被抢/断网三序全断言）。
- Motion 首用：TripPage 存证钮 + FloatingSosButton 入场切 DUO_SETTLE token。
- 未动：landing 诊断 spinner（LLM 旁路 8s SLA 真等待，骨架步骤化另案）、verification 短信（阻塞式系统等待，按范式保留）、发布流（本地同步已是乐观语义）。

## Batch③-5：门禁锁死（2026-09-12）
- e2e-ux-budget.mjs 新套件（SUITE_ORDER 第 15 席，verify-prod 单一源自动拾取）：首页 ≤18 按钮棘轮 + 折叠完整性 + AR 悬浮出清 + 行程统一卡 + 全空存证隐藏 + 访客 SOS 在位。
- match 考卷同步：新对话改 chat-new 硬锚（role 文本口径在折叠 remount 后偶发失明）+ 三态回落循环（已展开/仅外层开/全关）；教训：synthetic dispatch 打到 detached 节点变空操作，一律真实点击 + 终态断言。
- 全量：verify-prod 15/15（trust 首轮偶发超时、单跑绿、重跑整轮绿，时序 flake 非回归）+ vitest 851 + oto 1269 + lint 0 + tsc 0 + build 101。
- Batch③ 收官：UI/UX 冗余与混乱根因（入口无生命周期/系统建而不用/无感知范式/导航缺失）全部落地为规则 + 代码 + 门禁。

## 截图元数据幽灵变更（2026-09-12 记档，非阻塞）
- 现象：verify-prod 重拍后 docs/shot/*.png 反复出现 M（cockpit/dyn-slot 等），commit+push 后仍复现，无 headless/playwright 残留进程，45s 稳定性测试无写入者。
- 实证：像素级比对 worktree vs HEAD（7 点采样×2 图）0 差异、同尺寸——纯 PNG 元数据块 churn，视觉基线无损，以 checkout 恢复为准。
- 处置：不追 commit，保持 checkout-clean；若未来复现且伴随像素差异，转缺陷单深挖（候选：截图流 flush 与 git add 竞态）。

## Batch④-1：landing 漏斗可见性（2026-09-12）
- 补 3 埋点：growth.page_view{page:landing}（进页分母，f20/m20 同口径）＋diagnose_click＋diagnose_result{outcome,elapsed_ms}；METRIC_NAMES 注册（/api/metrics allow 名单自动生效）。
- 切阀门：.env.local METRICS_BACKEND=console→api；POST 实测 {stored:3} 进库（metric_events 表＋service client 全通）。
- 门禁：tsc 0＋lint 0＋vitest 853（109 文件，含 landing.test.tsx 新 2 例）＋build exit 0。
- 未动：呈现层（首屏 CTA/标题/Duo 化/sticky 条）等漏斗数据出来再议；SmsLeadSheet friction 不动；线上 Vercel 需同步设 NEXT_PUBLIC_METRICS_BACKEND=api（本地 .env.local 不进线上）。

## Batch④-2：AR 去伪装更名“附近服务”（2026-09-12，用户裁决）
- 用户可见 AR 字样 5 处出清：雷达入口“AR 场景探索/对准真实场景找服务”→“附近服务/看看附近可撮合的服务”（aria-label 同步）；ARPage 模式“场景探索”→“附近探索”、“全息 3D 体验”→“3D 模型预览”、“AR 取景框”→“服务探索区”、空态去“对准真实场景”。
- 不动：screen id=ar、testid radar-ar-entry、DockPage 联合类型（契约零漂移）；内部注释/类型 AR 字样保留（非用户可见）。
- 考卷同步：e2e-app 3 处＋e2e-offline 断言跟随更名；教训：offline 按字面 “AR” 断言屏存在，文案一改即挂——断言应锚新文案。
- 门禁：tsc 0＋lint 0＋vitest 853＋oto 1269＋build exit 0＋e2e-app/offline/ux-budget 全绿。

## Batch④-3：消息信任信号（2026-09-12）
- 做：已读回执（peerReadState 纯派生：对方侧未读清零⇒我最后一条已读，仅断言最后一条，不伪造逐条）＋响应时间（avgResponseMs 纯函数＋“对方通常约X分钟回复” badge，无样本不展示）。
- 不做：发送状态（审计证实已闭环：在线本地同步必达＋离线队列横幅＋手动重发）；正在输入（单机架构无对端实时通道，做 mock 属造假，诚实性否决）。
- 零契约变更：ImMsg/ImThread 字段不动；comm.test.ts＋2 用例（9/9 绿）。
- 门禁：tsc 0＋lint 0（含 base 八项物理门禁）＋vitest 853＋build exit 0。

## Batch④-4：暗岛 hex 出清（2026-09-12，用户要求即刻清，冻结令解除）
- 手法（forgeryTone/SAFETY_PILL_META 同例）：THEME_TONE 唯一映射（家政蓝/组局黄/陪伴蓝/维修橙/默认绿）＋TONE_TEXT/TONE_WASH/TONE_VAR 三表；theme 仍唯一 key（宪法 #4 不破）。
- 新 token 仅 1 个：--color-duo-orange-ink 取既有 tech 正文值 #9a4d00（零视觉差收编）；陪伴紫按 Batch①-1 不引入紫裁决收敛蓝（中括号本就蓝底）。
- 像素变化（如实申报 3 处）：featured 家政黄底→蓝 wash（原与磁贴蓝自相矛盾，治本）；featured 组局玫红→黄 wash；磁贴陪伴紫装饰/价→蓝系。
- 对比度脚本实证：ink/wash 最低 4.70（黄）、ink/白底最低 4.92，全员 ≥4.5。
- 考卷：AmmoPillBar.test.tsx 5 例（三变体零 hex 断言＋锚点＋pillTagFor 口径）；e2e-ux-budget PASS（按钮普查 18/18 未动）；首页胶囊落图实证。
- 遗留另案：ui-viewport 注释 tech=工业绿 vs 图纸/实现 tech=橙，不动像素，只记档。
- 门禁：tsc 0＋lint 0＋vitest 858（110 文件）＋build exit 0。

## Batch⑤：legacy web 轨 Duo 化（2026-09-12，用户开工＋拆桥令）
- ⑤-1 拆桥：删 /dp/console＋/provider＋/console 3 redirect 垫片；入链改道直达 /dp/provider/incoming（dp/login×3、dp 页、verification×2）；Header 路由守卫＋robots＋dp/layout 注记同步；考卷零引用；构建路由物理消失实证。
- ⑤-2 Header：深黑壳→白底（蓝 soft active＋黄 admin＋绿注册主按钮＋red-600 退出，09-11 裁决口径）；NotificationBell 系 shadcn 中性 token 自适应未动。
- ⑤-3 /profile 整页：19 处深黑→Duo（白卡＋绿认证＋黄信用条）；诚实化出清 mock：写死账单 BILLING_HISTORY→DuoEmpty、Lv.42/EXP4200→删、权益 DEFAULT_INVENTORY→空态（组件逻辑保留可逆）、EscrowStats 2 张 mock 卡（结案率/胜诉率）＋字面 Tier4→删（只留托管余额＋信誉积分真数）；英文 Guild Adventurer Board→删、ADVENTURER→普通用户。
- ⑤-4 grab/dp-login/dp 营销页：grab 两深黑壳→polar 底白卡（GrabConsole 本体白卡不动）；login indigo→Duo 蓝；dp 营销 pastel（cyan/purple/amber）→蓝/绿/黄 soft，hero 渐变字→eel 实色。
- ⑤-5 incoming/demands/orders 顶栏：zinc-900→白底 Duo（抢单乐观化/验收/履约语义零动；blue-600 徽标→蓝 soft＋深色字，emerald 金额/进度→Duo 绿系）。
- 实证：tsc 0＋lint 0＋vitest 858＋build exit 0；/dp/login SSR 零暗类＋真机落图（白 Header＋绿注册）；垫片路由构建产物物理消失。
- 遗留另案：OrderFulfillmentClient 联系人 fallback（张先生/13800000000/中关村）系演示占位，诚实性待查未动；orders/demands 页身 zinc 浅中性保留（可读，整页收敛另案）。

## Batch⑤-6：首页灰幕根因（2026-09-12，用户报“点胶囊全屏发灰”）
- 定案：与胶囊无关。像素级实证：tap 前后 DOM 零遮罩（fixed 扫描空）/body filter 无 /opacity 1；桌面与移动仿真渲染逐像素一致（整页均值同为 210,210,207），tap 不改变任何像素。
- 根因：Stage 的 ContactShadows（scale 8 全屏阴影面，opacity .5）本是给 AR 沙发垫的，却挂载在全屏；首页无遮挡物时，阴影面在手机真机 GPU（渲染管线/驱动差异，桌面 SwiftShader 恰好正确合成故本地不可见）下糊成全屏灰 veil。Dock/SOS 是 DOM 浮层故保持鲜艳——与用户截图完全吻合。
- 治本：ContactShadows＋Environment 只在 screen=ar 挂载（影子只属于沙发；Environment 只服务沙发反射，首页还省电）。AR 屏视觉由 e2e-app AR 锚链路回归覆盖。
- 教训：真机 GPU  artifact 本地 SwiftShader 不可复现——此类“某设备才有”问题优先怀疑全屏 3D 面（shadow/env/post），不从 DOM 入手。
- 门禁：tsc 0＋lint 0＋build exit 0＋e2e-app/ux-budget 全绿。
