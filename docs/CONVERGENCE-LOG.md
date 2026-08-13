# 宪法收敛登记表（CONVERGENCE LOG）

> 依据：`docs/DESIGN_CONSTITUTION.md` §2 ——「已有代码与本文不符的（历史遗留）不算违规，
> 但每个结构性改动（重构/抽层）必须顺带收敛一处，并在改动中标注『宪法收敛：条文 #n』。」
>
> **本表是唯一事实来源**：一切结构性改动（文件 rename / 抽层 / 契约修订）合入前，
> 必须在此追加一行；`npm run check:convergence` 门禁会自动核对 git rename 记录是否
> 与本表对应，缺行即报错，禁止合入。
>
> 登记人：opencode agent（受 AGENTS.md 约束）。

| 日期 | Commit | 结构性改动 | 收敛的条文 | 收敛说明 |
|------|--------|-----------|-----------|----------|
| 2026-07-23 | `382663d` | SW 源码移动：`src/app/sw.ts` → `src/app/sw.js`（修复 Vercel 构建，serwist manifest 注入冲突） | §2 历史遗留（宪法定稿 08-13 前） | 追认登记：PWA 构建文件位置调整，非九域结构化重构；补记确保登记册完整 |
| 2026-07-23 | `0a64fbd` | SW 源码移动：`src/app/sw.js` → `sw.js`（移出 App Router 编译路径） | §2 历史遗留（宪法定稿 08-13 前） | 追认登记：sw.js 挪到项目根，next.config swSrc 同步；补记保持登记册唯一事实来源完整 |
| 2026-07-23 | `7f868c3` | SW 源码回移：`sw.js` → `src/app/sw.ts`（移除 webpack-obfuscator 冲突后恢复 sw.ts） | §2 历史遗留（宪法定稿 08-13 前） | 追认登记：最终形态恢复为 src/app/sw.ts；三次移动（ts→js→root→ts）终态收敛，补记闭环 |
| 2026-08-13 | `7754884` | base 九域 git mv 100 文件 + ammo 四表建立 | #1 底座优先 / #3 先配表后写码 | 从 lib/ + src/ 平铺收敛为「base/ 发射管 + ammo/ 弹药表」形态（ADR-0006/0007 落地） |
| 2026-08-13 | `c74b20f` | ADR-0007 v2：C1 OrderCore 抽象 + ammo/sop.ts 补建 + C4 hardGates 对齐 | #1 / #2 接口保守 / #3 | 状态机语义收敛进 OrderCore 契约锚点；SOP 弹药表不写死进 base 组件 |
| 2026-08-13 | `5cb0d44` | ADR-0008 争议小法官：judge 规则 + Gateway 接线 + 挂载 | #7 LLM 可介入就介入 | 争议定责从纯状态机收敛到规则引擎 + LLM 复核定责链 |
| 2026-08-13 | `004bb23` | ADR-0009 Sentinel：发布闸门 + 事件流接入 store | #9 多防线一体 / #10 降级设计 | 反欺诈从 roam 单点拦截收敛为多因子聚合 + 缺因子降级 |
| 2026-08-13 | `4da1c5e` | 0010-0015 批次：`lib/chat/` → `base/ai/chat/` rename；transport union 新字段；useWaveStore 多域状态扩充 | #1 / #2 / #4 弹药可插拔 | chat 引擎从业务目录 lib/ 收敛归位 base/ai；IM/隐私号/表单/geo 适配全部底座化 |
| 2026-08-13 | `a6edc57` | RPG 哲学原文从桌面断链 → docs/ 入仓 | §5 出处闭合 | 宪法出处文档从「仓库外引用」收敛为「仓库内 git 跟踪」 |
| 2026-08-13 | 待提交 | ADR-0016：`base/safe/ageGate.ts` + `base/platform/quietHours.ts` + `ammo/risk-rule` age-required 引信 + 全量接线（identity birthYear/guardianConsent、PublishSheet 发布分派、ProfilePage 设置 UI、NotificationCenter shouldNotify 分流） | #8 隐私血液 / #4 弹药可插拔 / #10 降级 | 未成年人合规从「未定义」收敛为分级模式（法规对齐）；推送从「无免打扰」收敛为用户自主静音（不绑付费） |