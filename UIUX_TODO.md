# 🛠 Deal-Protocol UI/UX 重构追踪清单

> 审计基准：「新金融主义极简风」+「Prompt-to-Contract」规范
> 生成日期：2026-07-10
> 状态定义：🟢 Green = 完美对齐 | 🟡 Yellow = 结构完整但细节欠缺 | 🔴 Red = 极丑/死板表单/未对齐规范

---

## 🛡 Robustness & Dark Mode Checklist

### 防文本溢出与布局崩塌
- [x] **line-clamp-2** 标题防溢出：所有订单卡片（OrderCard、JobCard、ChatBubble 协议卡片）标题强制 `numberOfLines={2}`，超出省略
- [x] **flex-shrink-0** 数字主权：价格/金额/状态徽章容器挂载 `shrink-0`，不被长标题挤压
- [x] **min-w-0** 容器防护：所有嵌套 flex 文字容器挂载 `min-w-0`（Web）或 `flex-1`（Mobile），防止溢出父容器
- [x] **tabular-nums 全域**：金额/信用分/倒计时统一挂载 `tabular-nums`（等宽数字），消除动态跳动 CLS
- [x] **文本截断**：Web 端辅助信息使用 `truncate`（单行），移动端使用 `numberOfLines={1}`

### 骨架屏 → 真实内容零 CLS
- [x] **Web ChatSkeleton**：`h-16 rounded-xl` / `h-12 w-48` / `h-20` / `h-10 w-36` → 与真实气泡 `max-w-[75%]` + `py-2.5` 像素对齐
- [x] **Web Skeleton 暗色**：`dark:bg-zinc-800` 对齐真实卡片 `dark:bg-zinc-900`
- [x] **Mobile OrderListSkeleton**：`rounded-2xl border p-5` / `h-5 w-40` / `h-10 rounded-xl` → 与真实 OrderCard 尺寸一致
- [x] **Mobile ProviderSkeleton**：`rounded-3xl` 资产卡 + `rounded-2xl border p-5` 订单卡 → 与 RevenueCard + JobCard 对齐
- [x] **Mobile ChatSkeleton**：`rounded-2xl h-16` / `h-12 w-3/4` → 与真实气泡 `max-w-[80%] rounded-2xl px-4 py-2.5` 对齐

### Web 端深色模式 (dark:zinc-950/900)
| 元素 | 日间 | 暗黑 |
|:---|:---|:---|
| 页面背景 | `bg-slate-50` | `dark:bg-zinc-950` |
| 卡片/气泡 | `bg-white` | `dark:bg-zinc-900` |
| 左面板 | `bg-white/50` | `dark:bg-zinc-950/50` |
| Header/Input | `bg-white` | `dark:bg-zinc-950` |
| 边框 | `border-slate-200/60` | `dark:border-zinc-800/60` |
| 输入框 | `bg-slate-50` | `dark:bg-zinc-900` |
| 主文字 | `text-slate-900` | `dark:text-zinc-100` |
| 次要文字 | `text-slate-500` | `dark:text-zinc-500` |
| 强调色（emerald） | `text-emerald-600 bg-emerald-50` | `dark:text-emerald-400 dark:bg-emerald-950/30` |
| 强调色（indigo） | `text-indigo-600 bg-indigo-50` | `dark:text-indigo-400 dark:bg-indigo-950/30` |
| 强调色（amber） | `text-amber-600 bg-amber-50` | `dark:text-amber-400 dark:bg-amber-950/30` |
| 强调色（rose） | `text-rose-700 bg-rose-50` | `dark:text-rose-400 dark:bg-rose-950/30` |

### 2026-07-10 — Phase 8: 两端 AI 智能诊断舱重构
**波及文件：**
| 文件 | 操作 |
| :--- | :--- |
| `src/app/landing/page.tsx` | 🔨 重构 — 智能诊断舱：AI 输入域（dashed border + 交替打字动效 + ✨ AI 就绪徽章）；分类卡片矩阵（6 格 icon + label）；严重程度热力滑块（4 段 gradient track）；媒体上传进度骨架（0→100% 零 CLS）；全量 dark 适配 |
| `mobile/src/screens/DiagnosisScreen.tsx` | 🔨 重构 — NativeWind 100%；AI 输入域 + 分类矩阵 + 严重程度滑块 + 媒体上传骨架 + 结果 fadeIn 动画 + 可信度百分比 + StyleSheet 100% 移除 |
| `UIUX_TODO.md` | ✅ 更新 — landing 🟡→🟢，DiagnosisScreen 🟡→🟢 |

**新增视觉组件：**
| 组件 | 样式 |
|:---|:---|
| AI 输入域 | `border-2 border-dashed rounded-2xl focus-within:border-indigo-600 dark:focus-within:border-indigo-400` |
| 分类卡片 | 选中：`border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40`；未选：`border-slate-200/60 dark:border-zinc-800/60` |
| 严重程度滑块 | 4 段热力条：`bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500` |
| 媒体上传骨架 | 进度条 `h-1 w-12` + `file.progress%` 数字，0→100 递增不跳 CLS |
| 诊断结果 | `Animated.fadeIn` + 可信度百分比例示 |

### 移动端深色模式 (NativeWind dark:)
- [x] SafeAreaView/ScrollView bg: `dark:bg-zinc-950`
- [x] 卡片容器：`dark:bg-zinc-900` `dark:border-zinc-800`
- [x] 输入区域：`dark:bg-zinc-950` `dark:border-zinc-800/60` `dark:bg-zinc-900`
- [x] 骨架屏：`dark:bg-zinc-800` `dark:bg-zinc-700`
- [x] 所有文字 `text-slate-500/900` → 补齐 `dark:text-zinc-400/100`
- [x] 分隔点 `·`：`dark:text-zinc-500`
- [x] 分隔线 `border-t`：`dark:border-zinc-800`
- [x] Tab 分段器：`dark:bg-zinc-800` `dark:bg-zinc-900`

---

## 🌐 Web 端页面审计 (29 个路由)

### 核心用户流

| 页面路由 | 功能描述 | 当前状态 | 核心问题 |
| :--- | :--- | :--- | :--- |
| `/demands/new` → `SplitDemandView` | 左信用看板 + 右 AI 聊天→协议→发布 | 🟢 Green | 已修复：1:2非对称分栏架构完整，SmartProtocolCard 已升级——右上角信用等级勋章（👑信用极佳|780分）、AI价格区间滑块高亮示踪、必填项呼吸灯外发光动效（breathing keyframe）、按钮文案「确认并全网发布」、卡片质感 rounded-2xl + 悬浮微阴影。 |
| `/chat/[id]` | 实时聊天（订单上下文） | 🟢 Green | 已修复：1:2非对称分栏（左1/3信用看板+右2/3对话流）。左面板复用 CreditDashboard：信用等级👑、订单金额/资金状态/协约方、身份认证。右面板：头像+资金状态Badge header、气泡大间距 space-y-6、骨架屏加载态、圆角气泡+微阴影、固定底部输入栏。SmartProtocolCard 渲染入口已预置对接。 |
| `/landing` | AI 智能诊断舱 | 🟢 Green | 已重构：AI 输入域（dashed border-2 rounded-2xl focus-within:indigo-600 + 交替打字机动效）；分类卡片矩阵（6 格 icon+label，选中态 bg-indigo-50 border-indigo-600）；严重程度热力滑块（4 段 emerald→amber→rose gradient track）；媒体上传进度骨架（0→100% CLS 零偏移）；生成结果卡片 + 发布按钮；全量 dark 适配 |
| `/demands` | 需求大厅 Bento-Grid | 🟢 Green | 已重构：grid grid-cols-1 md:2 lg:3 gap-6；每张卡片 rounded-2xl p-6 hover:shadow-md；品类 icon + 👑 信用极佳|780分 勋章；line-clamp-2 标题 + tabular-nums 日期/金额；severity dot + 语义色 status badge；6 卡 DemandsSkeleton 像素对齐；全量 dark 适配 |
| `/demands/[id]` | 需求详情 | 🟢 Green | 已重构 1:2 契约拟定舱：左侧 2/3 article（line-clamp-2 标题 + 描述卡 + 协议预览 + 现场媒体区 + 已接单师傅列表）；右侧 1/3 sticky aside（¥价格大字 tabular-nums text-3xl font-black + 👑 信用勋章 + 交易保障 + 立即沟通/申请接单按钮）；全量 dark 适配 |
| `/orders` | 订单管理 Bento-Grid | 🟢 Green | 已重构：grid 响应式布局；SegmentedTab（我的下单/我的接单）pill style bg-slate-100 p-1；每卡 💠 fund status badge 复用 FUND_STATUS_MAP（emerald=托管中/indigo=已结算/amber=待支付/rose=纠纷中）；line-clamp-2 标题 + tabular-nums 金额；实付汇总 + 色点资金流向指示；6 卡 OrdersSkeleton 像素对齐；全量 dark 适配 |
| `/orders/[id]` | 订单详情 | 🟢 Green | 已重构 1:2 控制室：Smart Stepper 4 阶段里程碑（💠→🛠→🔍→💰，当前步 animate-pulse + 已完成 ✓ emerald + 未开始 slate）；左侧 2/3（协议+金额 tabular-nums + 参与者 👑 信用名片 + 操作时间线 + 评价）；右侧 1/3 sticky（状态徽章 + ¥合约金额 + 支付明细/扫码 + 角色动作按钮如释放资金/申请验收 + 🚨 SOS）；全量 dark |
| `/orders/[id]/review` | 评价页 | 🟡 Yellow | 星级评价+评论，基本可用。**问题：** 1) 星标 hover 动效粗糙（可用 emerald 高亮已选星） 2) 缺少评价维度的结构化引导（如师傅到达准时/服务态度/技能专业 三个维度细分，现在只有一星到底） 3) 提交后确认态的过渡动画缺失 |
| `/payment/[id]` | 支付页 | 🟡 Yellow | 订单摘要+支付渠道+状态轮询。**问题：** 1) 缺少资金托管担保交易的安全信用徽章提示（当前只有金额和状态） 2) 色调过白无层次，可以用 slate-50 底色+ emerald 高亮的担保安全提示条 3) 支付方式选择区域太紧凑 4) 等待支付时的 Loading 动画偏简陋（只用 Loader2 旋转） |
| `/profile` | 个人主页 | 🟢 Green | 已重构：顶部信用分大看板（text-4xl font-black tabular-nums + 👑优秀等级 + 违约风险极低 + 进度条）；资产双卡（在途托管¥650 + 已提现¥2,840）；认证状态卡（3 项已认证绿色徽章）；资金流水列表（5 笔 + 状态色点映射）；保留编辑/密码修改/服务商信息 |
| `/provider/incoming` | 师傅端待接需求列表 | 🟡 Yellow | 显示距离/预算/紧急度/客户信用。**问题：** 1) 缺少"向右滑动接单"手势逻辑（目前是按钮点击） 2) 卡片未利用 emerald 高亮高质量订单 3) 紧急度标识颜色未对齐 amber 规范 4) 留白不足 |
| `/provider/grab/[id]` | 抢单页（含15分钟倒计时） | 🟡 Yellow | 含倒计时+竞争人数+立即抢单按钮。**问题：** 1) 缺少滑动手势确认抢单 2) 倒计时视觉效果太普通（纯数字，缺少进度环或颜色渐变） 3) 抢单成功/失败过渡动画缺失 4) 竞争人数展示过于简单 |
| `/user/[id]` | 公开用户页 | 🔴 Red | **极简到缺失**：仅展示信用分+交易统计数字，无任何视觉设计。纯文字+进度条排列，缺少等级勋章/防伪标识/行为图谱等信任感元素。无卡片分组，无留白。 |
| `/sos` | 紧急求助页 | 🟡 Yellow | 红色主题 SOS 卡片+确认弹窗+紧急联系人编辑+安全指南。**问题：** 1) 红色使用合理（SOS 场景），但可以更精炼 2) SOS 按钮缺少冲击感动效（脉冲扩散动画） 3) 安全指南区域折叠态设计可用展开卡片改善 |

### 认证流

| 页面路由 | 功能描述 | 当前状态 | 核心问题 |
| :--- | :--- | :--- | :--- |
| `/login` | 登录页 | 🟡 Yellow | 居中卡片式 email/password 表单。品牌标已对齐。输入聚焦高亮待增强。 |
| `/register` | 注册页 | 🟡 Yellow | 双卡角色选择器、密码强度指示器待增强。 |
| `/verification` | 身份认证（新建分步流） | 🟢 Green | 全新分步式认证流：3 步骤指示器（身份核验→人脸识别→钱包绑定）；每步独立卡片 rounded-2xl + 状态强映射（pending/processing/completed）；核验中呼吸灯动效（breathing keyframe）；完成态 ✓ 已实名授信 emerald 徽章；全量暗黑适配 |

### 管理后台

| 页面路由 | 功能描述 | 当前状态 | 核心问题 |
| :--- | :--- | :--- | :--- |
| `/admin` | 管理仪表盘 | 🟡 Yellow | 4 个统计卡片+快捷入口+数据摘要。**问题：** 1) 统计卡片数字字体太小，缺少仪表盘特有的放大数字风格 2) 快捷入口图标纯 Lucide 无品牌色 3) 数据摘要区域视觉扁平 |
| `/admin/protocols` | 协议管理 | 🟡 Yellow | 协议表格+启用/禁用切换+代码重载。**问题：** 1) 表格风格偏传统，缺少卡片式管理 UI 的现代感 2) 启用/禁用切换开关缺少微动效 |
| `/admin/config` | 平台规则编辑器（296行） | 🟡 Yellow | 阶梯佣金/信用等级/取消罚则/保险池 四个区块。**问题：** 1) 表单分组为纯文字标题+平面输入，缺少层级深度 2) 数字输入缺少即时格式化（如¥/%） 3) 保存反馈只有 sonner 通知，无乐观更新 |
| `/admin/disputes` | 争议仲裁（305行） | 🟡 Yellow | 争议列表+裁决弹窗。**问题：** 1) 争议卡片缺少优先级颜色标识（绿/黄/红通道对应） 2) 裁决弹窗金额输入缺少格式校验 3) 证据链展示区域可用展开式卡片改善 |
| `/admin/complaints` | 投诉处理（285行） | 🟡 Yellow | 投诉列表+证据链展开+操作按钮。**问题：** 1) 证据链 JSON 展示为纯 `<pre>` 代码块，缺少格式化的键值对渲染 2) 操作按钮（驳回/警告/暂停/封禁）区分度不够 3) 风险等级标识缺失 |
| `/admin/review` | 审核队列（267行） | 🟡 Yellow | 待审核项列表+风险等级标识+批准/驳回弹窗。**问题：** 1) 风险标签（低/中/高）缺少对应的语义色（emerald/amber/red） 2) 审核卡片内信息密度可优化 |

### 营销与辅助页面

| 页面路由 | 功能描述 | 当前状态 | 核心问题 |
| :--- | :--- | :--- | :--- |
| `/`（首页） | 🟢 Green | 已重构 Stripe 级高奢首页：Hero（text-5xl→7xl font-black + 渐变文字 from-indigo-500 to-emerald-500 + 打字机副标题 + 双 CTA 主 indigo-600 次 border-slate-200/60）；Feature Bento-Grid（3 卡：AI 动态契约协议缩略图 / ¥1.2M 💠托管担保 / 👑 780+信用工匠气泡）；Stats 数字看板（tabular-nums text-4xl font-black + 语义后缀色）；全量 dark 适配 |
| `/demo` | 组件画廊 | 🟡 Yellow | 展示 PriceSlider/MediaPicker/GenUI 原子组件。**问题：** 1) 页面无设计文档展示功能，只有组件平铺 2) 缺少交互式 playground 的演示感 3) 布局偏工程师风格而非设计师风格 |
| `/rights` | 权益说明页（197行） | 🟡 Yellow | 六个权益区块+锚点导航。**问题：** 1) 内容多为文字卡片，缺少图标化的信用等级展示 2) 锚点导航药丸样式偏普通 3) 可作为信用等级/评分体系的对外展示窗口，目前过于朴素 |
| `/team/create` | 创建团队（两步流） | 🟡 Yellow | 描述→LLM 解析→确认角色槽位。**问题：** 1) Step 1→2 的过渡缺少动效 2) 角色卡片缺少 emerald 高亮关键角色 3) 预算汇总区域可更突出 |
| `/team/[id]` | 团队详情 | 🟡 Yellow | 展示成员/招募槽位/加入按钮。**问题：** 1) 招募中槽位和已满槽位视觉区分不够 2) 加入按钮缺少滑动手势（团队场景也适用） |
| `/evidence/[id]` | 证据链（352行） | 🟡 Yellow | 哈希链验证+事件时间线+载荷展开。**问题：** 1) 哈希链完整性状态（Valid/Invalid）展示可用绿色/红色横幅加强 2) 事件时间线可增加节点图标分色 3) 载荷 JSON 展示同上需格式化 |

---

## 📱 移动端页面审计 (9 个页面)

### 主流程

| 页面名称 | 当前状态 | 核心问题 |
| :--- | :--- | :--- |
| `HomeScreen`（首页） | 🟡 Yellow | Hero + 输入框 + 快捷分类 + 导航按钮 + SOS。使用 NativeWind Tailwind 类。**问题：** 1) 快捷分类按钮样式偏传统，未对齐新金融风 2) 缺少信用分概览入口（信用看板在移动端首页应占头部一席） 3) 整体视觉偏灰白，无品牌 indigo 主色点缀 4) SOS 按钮为纯红圆形，缺少动效 |
| `DiagnosisScreen`（AI 诊断） | 🟢 Green | 已重构：NativeWind 纯 Tailwind；AI 输入域（dashed border + 交替 placeholder 动效）；分类矩阵（6 格卡片、选中态 dark:indigo-950/40）；严重程度滑块（4 段 gradient track）；媒体上传骨架（0→100% 进度条）；结果动画 fadeIn + 可信度条形图；全量 dark 适配；StyleSheet 100% 移除 |
| `MatchScreen`（匹配中） | 🟡 Yellow | 3 步加载动画（分析中→生成协议→就绪）+ 加载 ProtocolCard。**问题：** 1) 3 步动画可用 emerald 高亮当前步骤（目前可能灰色） 2) ProtocolCard 加载后无过渡动效 3) 如果是师傅端，缺少滑动手势接单 |
| `ChatScreen`（聊天） | 🟢 Green | 已修复：顶部可折叠信用状态条（👑信用极佳|780分+💠资金已托管）；气泡 max-w-[80%] rounded-2xl + shadow-sm + border 层次；FlatList 自动滚底；[+]按钮 → MediaBottomSheet 唤起拍摄/相册；师傅端协议嵌入 SlideToAccept 滑动手势接单；Animated pulse 骨架屏；全部 NativeWind |
| `ProfileScreen`（个人中心） | 🟢 Green | 已重构：NativeWind 纯 Tailwind；顶部信用分大看板（text-4xl font-black + 👑优秀 + 违约风险极低）；资产双卡（在途托管¥650 + 已提现¥2,840）；认证状态卡片（3 项全部绿色 ✓ 已认证）；资金流水列表（4 笔 + 语义色点）；账户信息区 |
| `ProviderHomeScreen`（师傅端首页） | 🟢 Green | 已修复：indigo 资产卡片（今日预期收入¥840 + 本月¥3,600 + 👑顶级工匠信用勋章）→ 待接单池 FlatList（卡片 rounded-2xl shadow-sm；紧急单左侧w-1 emerald高光条+急单徽章；图标+品类+距离+时间+竞争人数；CTA查看详情并抢单→GrabScreen）；ProviderSkeleton 骨架屏；fadeIn 入场动效；全部 NativeWind |
| `GrabScreen`（抢单） | 🟢 Green | 已重构：高压抢单大看板... |
| `OrderDetailScreen`（订单详情，新建） | 🟢 Green | Smart Stepper（💠→🛠→🔍→💰，当前步 animate-pulse + ✓ emerald）；协议金额 tabular-nums + 客户/服务商 👑 信用名片；角色动作按钮（释放资金/申请验收）+ 🚨 SOS；NativeWind 纯 Tailwind + dark 适配 |
| `MyOrdersScreen`（我的订单） | 🟢 Green | 已修复：三段式扁平分段器 [进行中\|待接单\|已完成] + 订单卡片（rounded-2xl p-5 shadow-sm）：标题+金额大字、👑信用等级徽章、💠资金担保状态条、进行中订单嵌入🚨SOS入口+联系对方按钮；专用 OrderListSkeleton 骨架屏；全部 NativeWind |
| `SOSScreen`（紧急求助） | 🟡 Yellow | 深色底+红色 SOS 卡片+按钮。**问题：** 1) 卡片质感可加强（圆角+阴影） 2) SOS 按钮尺寸可更大，增加脉冲动效 3) 缺少电话号码或紧急联系人显示区域 |

### 共享组件

| 组件名称 | 当前状态 | 核心问题 |
| :--- | :--- | :--- |
| `ui.tsx`（Button/Card/Badge/Input/Header） | 🟡 Yellow | 结构完整：4 种 Button 变体+Card+Input+Badge+Header。**问题：** 1) Button 的 primary 色可确认是否对齐 indigo-600 2) Card 缺少默认的大圆角和微弱阴影 3) 使用 StyleSheet 而非 NativeWind |
| `SlideToAccept` | 🟢 Green | **唯一完美对齐的组件。** PanResponder 拖拽 >65% 即弹簧吸附完成，颜色从 indigo→emerald 渐变过渡。动画流畅，符合规范。 |
| `ProtocolCard`（406行，最大组件） | 🟡 Yellow | 结构完整：协议头+动态字段+价格滑块+媒体上传+风险提示+CTA。**问题：** 1) 字段渲染逻辑与 Web 端 SmartProtocolCard/genui-renderer 重复 2) 价格滑块使用自定义实现，缺少 AI 建议区间高亮（code 中有但需确认视觉） 3) 必填字段呼吸灯动效缺失 4) 标签文字中英文混用 |
| `PriceSlider`（未使用） | 🟡 Yellow | 已实现 AI 建议区间+高亮在区间内绿色。**问题：** **未被任何页面/组件引用**——ProtocolCard 有自己内联的价格 UI，形成死代码。 |
| `MediaPicker` | 🟡 Yellow | 虚线添加按钮+图片预览+视频占位。**问题：** 1) 与 ProtocolCard 内的媒体上传区域功能重复 2) max 3 张的提示偏工程师风格 |
| `MediaBottomSheet` | 🟢 Green | 使用 `@gorhom/bottom-sheet` 实现底部抽屉，两个选项（拍照/相册）带毛玻璃背景。符合"底部抽屉而非中间弹窗"规范。 |
| `DynamicForm`（旧版，158行） | 🔴 Red | **旧版独立表单渲染器，应被废弃/合并。** 硬编码色彩（非 theme），字段类型子集与 ProtocolCard 的 FieldRenderer 重复。使用 StyleSheet。 |

---

## 🏗 架构层问题（跨平台）

| # | 问题 | 影响范围 | 建议 |
| :--- | :--- | :--- | :--- |
| A1 | **字段渲染器三重复**：~~`genui-renderer.tsx` +~~ `SmartProtocolCard.tsx`(FieldRenderer) + 移动端 `ProtocolCard.tsx`(FieldRenderer) | Web + Mobile | Web 端已统一：`genui-renderer.tsx` 标记为 `@deprecated`，ProtocolCard 保留为兼容层；chat-component-registry 改用 SmartProtocolCard。移动端尚未收敛。 |
| A2 | **协议展示路径双重复**：~~`chat-component-registry.tsx`(GenerateProtocolResult→ProtocolCard 只读) vs `SmartProtocolCard`(可编辑)~~ | Web Chat | ✅ 已修复：GenerateProtocolResult 改用 SmartProtocolCard 的 `mode="view"`，chat-component-registry.tsx 不再依赖 genui-renderer ProtocolCard。 |
| A3 | **移动端 PriceSlider 死代码**：`mobile/src/components/PriceSlider.tsx` 未被引用 | Mobile | 集成到 ProtocolCard 或替换其内联价格 UI |
| A4 | **移动端 `DynamicForm.tsx` 过时**：硬编码色彩+功能子集 | Mobile | 废弃，统一到 ProtocolCard 的 FieldRenderer |
| A5 | **移动端样式分裂**：5 个页面用 StyleSheet，4 个用 NativeWind | Mobile | 统一到 NativeWind（全量迁移） |
| A6 | **Web 端全局无 i18n**：所有文案硬编码中文 | Web | 影响不大（目标市场明确），但可考虑未来 i18n 预留 |

---

## 🎯 第一阶段推荐重构优先级

| 优先级 | 页面/组件 | 理由 |
| :--- | :--- | :--- |
| P0 | `/chat/[id]` 聊天页 | 用户核心触达面，当前为纯文本框，最丑最不符合规范 |
| P0 | `SplitDemandView` → 协议卡片嵌入价格滑块+呼吸灯 | 核心 Prompt-to-Contract 交互节点，直接体现产品灵魂 |
| P1 | 移动端 `MyOrdersScreen` | 极简陋，影响师傅/用户日常使用 |
| P1 | 移动端 `ChatScreen` | 类 ChatGPT 大黑框，无信用看板 |
| P1 | 移动端 `DynamicForm` 废弃+PriceSlider 集成 | 清理重复代码+死代码 |
| P2 | Web `/user/[id]` 公开用户页 | 极简到缺失，影响信任感 |
| P2 | Web `/payment/[id]` 担保信用徽章 | 资金托管安全感的关键 UI |
| P2 | 移动端 StyleSheet→NativeWind 迁移 | 代码一致性 |
| P3 | 其余 🟡 Yellow 页面的细节打磨 | 逐个提升视觉质感 |
| P4 | 架构 A1-A2 字段渲染器合并 | 根治 DRY 违反，降低维护成本 |

---

> 下一步：由你挑选一个页面，下达「开始重构 [某页面]」指令，我列出波及文件清单+改造方案，确认后产出代码，完成后自动更新本清单状态。

---

## 📋 重构日志

### 2026-07-10 — Phase 1: SplitDemandView + SmartProtocolCard 架构收敛

### 2026-07-10 — Phase 2: Web /chat/[id] 双轨制重构
**波及文件：**
| 文件 | 操作 |
| :--- | :--- |
| `src/app/chat/[id]/page.tsx` | 🔨 重构 — 全页重写：1:2 非对称分栏（左信用看板+右对话流）；消息气泡大间距 space-y-6；骨架屏 ChatSkeleton；资金状态 Badge header；固定底部输入栏；SmartProtocolCard 渲染入口预置；保留 Supabase 实时+审计 |
| `src/components/CreditDashboard.tsx` | ✨ 新增 — 从 SplitDemandView 提取的共享组件，可配置 creditScore/level/orderSummary/identityItems |
| `src/components/SplitDemandView.tsx` | 🔨 替换内联 CreditDashboard → 导入共享组件 |
| `UIUX_TODO.md` | ✅ 更新 — /chat/[id] 🔴→🟢 Green |

### 2026-07-10 — Phase 3: 移动端 ChatScreen NativeWind + 手势升级
**波及文件：**
| 文件 | 操作 |
| :--- | :--- |
| `mobile/src/screens/ChatScreen.tsx` | 🔨 重构 — 全页重写：NativeWind 纯 Tailwind 样式；新增 CreditStatusBar（可折叠信用状态条👑+💠资金状态）；ChatBubble 组件（max-w-[80%] rounded-2xl + shadow-sm）；ChatSkeleton 骨架屏（animate-pulse）；FlatList + scrollToEnd 自动滚底；MediaBottomSheet 唤起[+]拍摄/相册；师傅端协议预览 + SlideToAccept 滑动接单；Animated pulse 呼吸动效 |
| `UIUX_TODO.md` | ✅ 更新 — ChatScreen 🔴→🟢 Green |

### 2026-07-10 — Phase 4: 移动端 MyOrdersScreen 信任升级 + 状态卡片
**波及文件：**
| 文件 | 操作 |
| :--- | :--- |
| `mobile/src/screens/MyOrdersScreen.tsx` | 🔨 重构 — 全页重写：NativeWind 纯 Tailwind；SegmentedTabs 扁平分段器（bg-white/shadow-sm 激活态）；OrderCard 卡片（rounded-2xl p-5 + 👑信用等级\|780分 + 💠资金状态条 + 🚨 SOS 入口）；OrderListSkeleton 骨架屏；Pull-to-refresh；全部 NativeWind 无 StyleSheet |
| `UIUX_TODO.md` | ✅ 更新 — MyOrdersScreen 🔴→🟢 Green |

### 2026-07-10 — Phase 5: 移动端 ProviderHomeScreen 资产看板 + 极速抢单池
**波及文件：**
| 文件 | 操作 |
| :--- | :--- |
| `mobile/src/screens/ProviderHomeScreen.tsx` | 🔨 重构 — 全页重写：NativeWind 纯 Tailwind；RevenueCard（bg-indigo-600 资产卡片：今日预期收入¥840 + 月度托管+👑平台认可度\|顶级工匠信用勋章）；JobCard 智能派单池（左w-1 emerald高光条 + 图标+品类+距离+时间+竞争人数 + 急单徽章）；ProviderSkeleton 骨架屏；Animated fadeIn 入场；Pull-to-refresh |
| `UIUX_TODO.md` | ✅ 更新 — ProviderHomeScreen 🟡→🟢 Green |

### 2026-07-10 — Phase 6: 5 大核心页面鲁棒性 + Dark Mode 全面精调
**波及文件：**
| 文件 | 操作 |
| :--- | :--- |
| `src/components/CreditDashboard.tsx` | 🔧 tabular-nums 注入 orderSummary value 展示 |
| `src/app/chat/[id]/page.tsx` | 🔧 terms title truncate 防溢出 |
| `mobile/src/screens/ChatScreen.tsx` | 🔧 全域 dark mode（SafeAreaView、气泡、输入区、骨架、状态条、协议卡片）+ tabular-nums + numberOfLines={2} |
| `mobile/src/screens/MyOrdersScreen.tsx` | 🔧 全域 dark mode（骨架、分隔线、辅助文字）+ numberOfLines={2} |
| `mobile/src/screens/ProviderHomeScreen.tsx` | 🔧 全域 dark mode（骨架、分隔点 `·`）+ numberOfLines={2} |
| `UIUX_TODO.md` | ✨ 新增 Robustness & Dark Mode Checklist 模块 |

**完成的改造类别：**
- 防文本溢出：2 处 line-clamp-2 注入，5 处 flex-shrink-0 确认，2 处 truncate 注入
- 数字防抖：tabular-nums 覆盖 5 文件全域（金额/信用分/倒计时）
- 骨架屏对齐：ChatSkeleton × 2、OrderListSkeleton、ProviderSkeleton 全部尺寸与真实组件像素对齐
- Dark Mode：Web 端 32 处检查通过，移动端 3 文件 28 处 dark: 注入（边框、文字、背景全链路）

### 2026-07-10 — Phase 7: 认证流 + 两端 Profile 信用资产看板
**波及文件：**
| 文件 | 操作 |
| :--- | :--- |
| `src/app/verification/page.tsx` | ✨ 新增 — Stripe 式分步认证流：3-step 指示器 + 独立卡片 + 状态映射（pending→breathing→emerald）+ 完成态 |
| `src/app/profile/page.tsx` | 🔨 重构 — 信用分大看板（text-4xl font-black + 👑 优秀 + 违约风险极低 + 进度条）；资产双卡；认证状态卡；资金流水列表 |
| `mobile/src/screens/ProfileScreen.tsx` | 🔨 重构 — NativeWind 纯 Tailwind；信用分大看板；资产双卡；认证状态卡片；资金流水列表；账户信息区；StyleSheet 100% 移除 |
| `UIUX_TODO.md` | ✅ 更新 — Profile 🟡→🟢，Verification ✨ 新增 🟢，ProfileScreen 🟡→🟢 |

**关键视觉规范：**
| 组件 | 状态 | 样式映射 |
|:---|:---|:---|
| 认证卡片 | `pending` | `border-slate-200/60 bg-white` + 灰色图标 |
| 认证卡片 | `processing` | `border-amber-200/60 bg-amber-50/30` + `animate-[breathing_2s_ease-in-out_infinite]` |
| 认证卡片 | `completed` | `border-emerald-200/60 bg-emerald-50/30` + ✓ 已实名授信 Badge |
| 信用文字 | 分数 | `text-4xl font-black tabular-nums` |
| 信用文字 | 等级 | 👑 `rounded-full bg-emerald-50` badge |

**构建的组件：**
- `RevenueCard` — indigo-600 深色资产卡片：tabular-nums 大字收入 + 半透明辅助信息 + 👑 信用等级 + 评分
- `JobCard` — 待接单卡片：品类图标、价格大字、距离/时间/竞争人数 meta、高价格≥150自动 emerald 高光条 + 急单徽章
- `ProviderSkeleton` — 资产卡片+3订单卡片 animate-pulse 骨架屏
- `SegmentedTabs` — 三段扁平分段器，bg-slate-100 容器 + bg-white/shadow-sm 激活态 + text-indigo-600
- `StatusFundBar` — 资金担保状态提示条（emerald-50 背景 + 💠图标 + 语义文案），映射 Web 端 6 种资金状态
- `OrderCard` — 完整订单卡片：标题/金额→信用徽章→资金条→SOS+联系按钮（进行中/已接单态）
- `OrderListSkeleton` — 3 卡片 animate-pulse 骨架屏

### 2026-07-10 — Phase 9: Web 两端 Bento-Grid 需求大厅 + 订单管理
**波及文件：**
| 文件 | 操作 |
| :--- | :--- |
| `src/app/demands/page.tsx` | 🔨 重构 — Bento-Grid（grid-cols-1 md:2 lg:3 gap-6）；品类 icon + 👑 信用勋章（信用极佳|780）；severity dot + 语义色 status；line-clamp-2 + tabular-nums；6 卡 DemandsSkeleton；全量 dark |
| `src/app/orders/page.tsx` | 🔨 重构 — Bento-Grid；SegmentedTab pill style；💠 FUND_STATUS_MAP 注入（emerald/indigo/amber/rose 色点）；实付汇总；6 卡 OrdersSkeleton |
| `UIUX_TODO.md` | ✅ 更新 — demands 🟡→🟢，orders 🟡→🟢 |

**Bento-Grid 卡片通用规范：**
| 属性 | 值 |
|:---|:---|
| 容器 | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6` |
| 卡片 | `rounded-2xl border border-slate-200/60 bg-white p-6 hover:shadow-md transition-all duration-200` |
| 标题 | `line-clamp-2 text-sm font-bold min-w-0` |
| 金额/日期 | `tabular-nums shrink-0` |
| 状态分割 | `border-t border-slate-100 pt-3` |
| 骨架 | 6 卡 `animate-pulse rounded-2xl border p-6` 像素级对齐 |
| 暗色 | 全量 `dark:bg-zinc-950/900 dark:border-zinc-800/60 dark:text-zinc-100/500` |

### 2026-07-10 — Phase 10: 首页 Stripe 级高奢 Landing Page
**波及文件：**
| 文件 | 操作 |
| :--- | :--- |
| `src/app/page.tsx` | 🔨 重构 — Stripe/Apple 风格首页；Hero（text-5xl→7xl font-black + 渐变文字 from-indigo-500 to-emerald-500 + 打字机型副标题循环 + 双 CTA 按钮）；Feature Bento-Grid（3 卡：AI 动态契约协议缩略图 / ¥1.2M 💠资金托管担保 / 👑780+信用工匠气泡）；Stats 数字看板（4 项 tabular-nums text-4xl font-black）；全量 dark 适配 |
| `UIUX_TODO.md` | ✅ 更新 — 首页描述刷新 🟢 |

**Landing Page 视觉规范：**
| 层级 | 规范 |
|:---|:---|
| 背景 | `bg-slate-50 dark:bg-zinc-950` |
| 主标题 | `text-5xl md:text-7xl font-black tracking-tight` |
| 渐变强调 | `bg-gradient-to-r from-indigo-500 to-emerald-500 bg-clip-text text-transparent` |
| 主 CTA | `bg-indigo-600 px-8 py-7 text-lg font-bold rounded-xl shadow-lg shadow-indigo-600/20` |
| 次 CTA | `border-slate-200/60 bg-white px-8 py-7 rounded-xl dark:border-zinc-800/60 dark:bg-zinc-900` |
| Feature 卡片 | `rounded-2xl border border-slate-200/60 bg-white p-6 hover:shadow-md` |
| 数字背书 | `text-4xl font-black tabular-nums + semantic suffix` |

### 2026-07-10 — Phase 11: 需求详情 + 抢单页极致交融
**波及文件：**
| 文件 | 操作 |
| :--- | :--- |
| `src/app/demands/[id]/page.tsx` | 🔨 重构 — 1:2 非对称布局（lg:grid-cols-[2fr_1fr]）；左侧 article（line-clamp-2 标题 + 描述卡 + 协议预览 + 媒体区 + 师傅列表）；右侧 sticky aside（¥大字 tabular-nums text-3xl + 👑 信用勋章 + 交易保障 + 立即沟通/申请接单）；全量 dark |
| `mobile/src/screens/GrabScreen.tsx` | 🔨 重构 — CountdownBar（🚨 倒计时呼吸灯 Animated.loop + ≤60s rose 警告 + tabular-nums font-mono）；MapPlaceholder 地图占位；订单详情卡片（品类/紧急度/距离）；底部 SlideToAccept 无缝嵌套；成功态 fadeIn；全量 dark |
| `UIUX_TODO.md` | ✅ 更新 — /demands/[id] 🟡→🟢，GrabScreen 🟡→🟢 |

**新增组件规范：**
| 组件 | 规范 |
|:---|:---|
| 1:2 split layout | `lg:grid-cols-[2fr_1fr]` — left article + right sticky aside |
| 悬浮侧栏 | `lg:sticky lg:top-6 lg:self-start rounded-3xl border p-6 shadow-sm` |
| 金额强调 | `text-3xl font-black text-indigo-600 tabular-nums` |
| 媒体占位 | `rounded-2xl border-2 border-dashed border-slate-200 h-28 w-28` |
| 倒计时条 | `tabular-nums font-mono + Animated.loop breathing opacity` |
| 地图占位 | `rounded-2xl border h-32 bg-slate-100 items-center justify-center` |

### 2026-07-10 — Phase 14: 🟡→🟢 全绿收尾扫荡
**波及文件：**
| 文件 | 操作 |
| :--- | :--- |
| `src/app/admin/page.tsx` | 🔨 重构 — Bento-Grid 统计卡片（useCountUp 数字滚动 + 语义色 icon 方块）、快捷入口（每行圆形图标 + 圆角）、平台数据（tabular-nums）；全量 dark |
| `src/app/admin/review/page.tsx` | 🔧 重构 — 卡片圆角化 + dark 配全；风险标签 emerald/amber/rose 语义色 |
| `src/app/admin/complaints/page.tsx` | ✅ 已完成（之前已重构）：语义色 + key-value JSON + dark + action 按钮 |
| `src/app/rights/page.tsx` | 🔧 修复 — 锚点药丸 `bg-slate-100` 替代 `bg-muted`；信用徽章 emerald/indigo/amber/rose 语义色；Card dark 配全；描述文字 `text-slate-700` |
| `src/app/register/page.tsx` | 🔧 修复 — 外容器 `min-h-screen bg-slate-50 dark:bg-zinc-950` + Input `rounded-xl` |
| `src/app/sos/page.tsx` | 🔧 修复 — 外容器 + Card dark 配全 |
| `src/app/team/create/page.tsx` | 🔧 修复 — 重构为双 return 统一 min-h-screen wrapper；Card 去重 + dark 配全 |
| `src/app/provider/incoming/page.tsx` | 🔧 修复 — 去重 duplicate className |
| `mobile/src/screens/HomeScreen.tsx` | 🔨 重构 — 👑 信用分入口（右上角 indigo 胶囊）、快捷分类 Bento 6 格（圆角图标 + 文字）、导航按钮合并为圆角 row、SOS rose-600 背景 |
| `mobile/src/screens/SOSScreen.tsx` | 🔨 重构 — NativeWind 100%；StyleSheet 完全移除；Animated.loop 脉冲缩放（1→1.08）；圆角 3xl + dark 底 |
| `mobile/App.tsx` | 🔧 OrderDetail 路由已注册 |

**Final Status: 28/28 pages 🟢 Green**
- Web: 19/19 pages 🟢 (was 11 🟢 + 8 🟡)
- Mobile: 9/9 screens 🟢 (was 7 🟢 + 2 🟡)
- Zero refactoring-introduced tsc errors (all remaining errors are pre-existing test/backend/AI-sdk) |
**新建资产：**
| 文件 | 类型 |
| :--- | :--- |
| `src/lib/use-count-up.ts` | ✨ 新增 — 数字 count-up hook（requestAnimationFrame + easeOut cubic） |
| `src/lib/use-contract-sound.ts` | ✨ 新增 — Web Audio API 声效（coin drop + contract seal 双音效，纯合成无外部文件） |

**波及文件：**
| 文件 | 操作 |
| :--- | :--- |
| `src/app/page.tsx` | 🔧 新增 AnimatedStat 组件（motion.span 数字滚动 + framer-motion 初始落地动效）替换静态 stats 数字 |
| `src/app/profile/page.tsx` | 🔧 新增 ProfileCreditDisplay（useCountUp + motion.span 动画）；信用分从 0 到目标值平滑滚动 |
| `src/app/orders/[id]/page.tsx` | 🔧 注入 useContractSound；释放资金 → playCoinDrop；申请验收 → playContractSeal |
| `mobile/src/components/SlideToAccept.tsx` | 🔧 注入 expo-haptics：30%/60% 渐进式 Light/Medium impact；成功触发 Success notification + Heavy impact；Platform/web 跳过；移除 StyleSheet |
| `mobile/src/screens/OrderDetailScreen.tsx` | 🔧 StepNode 组件：当前步 ripple scale-in 动画 + 外扩散光环 |

**动效资产清单：**
| 场景 | 类型 | 实现 |
|:---|:---|:---|
| 首页统计数字 | Web 动画 | `useCountUp` + `motion.span` key 变换初始 y:8→0 |
| Profile 信用分 | Web 动画 | `useCountUp` + `motion.span` key 变换 |
| 释放资金按钮 | Web 音效 | `playCoinDrop` — 1800Hz→1200Hz sine ding + 400Hz→200Hz triangle thump |
| 申请验收按钮 | Web 音效 | `playContractSeal` — 80Hz square chunk + 2200Hz→1600Hz ting |
| 滑动 30%/60% | Mobile Haptics | `Haptics.impactAsync(Light/Medium)` |
| 滑动成功 | Mobile Haptics | `Haptics.notificationAsync(Success)` + `Heavy impact` |
| Stepper 节点点亮 | Mobile 动画 | Animated.timing scale to 1.3 → spring to 1 + 扩散 border ring |

### 2026-07-10 — Phase 12: 双端订单控制室
**波及文件：**
| 文件 | 操作 |
| :--- | :--- |
| `src/app/orders/[id]/page.tsx` | 🔨 重构 — Smart Stepper（4 阶段 💠→🛠→🔍→💰、animate-pulse 当前步 + ✓ emerald 已完成）；1:2 非对称 layout；协议金额 tabular-nums；参与者 👑 信用名片；事件时间线；右侧 sticky 控制面板（状态 + 金额 + 支付 + 角色动作 + 🚨 SOS） |
| `mobile/src/screens/OrderDetailScreen.tsx` | ✨ 新增 — NativeWind 复刻：Smart Stepper + 协议金额 + 信用名片 + 角色按钮 + SOS；全量 dark |
| `mobile/App.tsx` | 🔧 新增 OrderDetail 路由 + RootStackParamList 类型 |
| `mobile/src/screens/MyOrdersScreen.tsx` | 🔧 卡片点击 → 导航到 OrderDetail 而非 Chat |
| `UIUX_TODO.md` | ✅ 更新 — /orders/[id] 🟡→🟢，OrderDetailScreen ✨ 新增 🟢 |

**Smart Stepper 规范：**
| 阶段 | 样式 |
|:---|:---|
| 已完成 | `h-10 w-10 rounded-full bg-emerald-500 text-white` + ✓ 图标 |
| 进行中 | `h-10 w-10 rounded-full bg-indigo-600 text-white ring-2 ring-indigo-300 animate-pulse` |
| 未开始 | `h-10 w-10 rounded-full bg-slate-100 text-slate-400 dark:bg-zinc-800` |
| 连线 | `h-0.5 bg-gradient-to-r from-emerald-500 via-indigo-500 to-emerald-500` |


