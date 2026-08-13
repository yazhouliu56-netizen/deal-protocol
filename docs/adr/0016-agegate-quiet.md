# ADR-0016: 未成年人分级模式 + 推送免打扰（对标 deep-research 报告吸收）

日期：2026-08-13
状态：Accepted（对标 deep-research-report 吸收；功能层迭代第七批）

## 六圈定位声明
- 所属圈：第五圈 · 安全风控（未成年人分级）+ 第六圈 · 生存基建（推送免打扰）
- 所属模块：未成年人分级模式（age gate）、推送免打扰（quiet hours）
- 复用底座：`base/safe/privacy`（脱敏域）、`base/notify`（通知域）、`ammo/risk-rule`（风控引信）
- 弹药表：`ammo/risk-rule.ts` 新增 `age-required` 引信（全局默认开；类目级可加：夜骑巡航/夜爬登山标记成人专属）

## 宪法条文对照
- 命中条文：**#8 隐私是血液规则**（未成年人分级默认开启、资金闸不因用户偏好解除——保护不是可选模块而是默认约束，对齐《未成年人网络保护条例》§31/§43 与《未保法》§72/§76）、**#4 弹药可插拔**（`age-required` 走引信表，类目加一行即生效，底座不写死年龄门槛）、**#10 降级是设计的一部分**（免打扰是用户可显式降级的「打扰过载」开关；urgent 危机通知不受静音影响）、**#9 先旅程后界面**（免打扰由用户自主掌控复访钩子，不绑付费——每日上限是防骚扰手段而非变现手段）
- 偏离条文：无（已核实：法律禁止的是「不实名提供服务」与「无监护人同意处理 14 岁以下个人信息」，而非一刀切禁止未成年人使用；本 ADR 采用分级而非禁用的合规解读）

## Context

对标 `deep-research-report (2).md`（桌面）的三点吸收，经用户逐条讨论后修正：

1. **未成年人不是禁**——打球/自习/组局是正当需求，微信也是分级（青少年模式+监护人同意）。正确合规姿势是《未成年人网络保护条例》§31（提供信息发布/IM 须实名）、§43（未成年人模式分级时段/时长/功能）、《未保法》§72（14 岁以下须监护人同意）——**分级而非一刀切禁用**。
2. **每日上限是防骚扰不是付费玩法**——免打扰是基础权利，不绑会员。
3. **置顶是信息流平台的伪需求**——我们平台是智能匹配（match.ts 六维打分），无列表可置顶；付费推广属 B 端商家业务（P8 范畴），不在本批。

## Decision

### 一、未成年人分级模式（`src/base/safe/ageGate.ts` 纯函数）
- `modeOfAge`/`ageFromBirthYear`：年龄 → adult/teen/child 三档（14/18 分界）。
- `ageGate(input)`：**分级判定**——
  - adult 全放行；
  - child（<14）无监护人同意全拦（含浏览）；有同意 → 免费动作放行、资金仍拦；
  - teen（14-17）免费动作放行、**资金动作全拦**（publish-fee/deposit/bidding/insurance/escrow-settle）；
  - **资金闸不因 guardMode=false 解除**（法规约束优先于用户偏好）。
- `isPaidPublish`：免费发布次数内是免费动作，用尽转资金动作——发布路径按年龄分派。
- `categoryRequiresAdult`：类目成人专属判定（弹药驱动）。

### 二、推送免打扰（`src/base/platform/quietHours.ts` 纯函数）
- `QuietPref`（enabled + 多静音窗口）、`minuteOfWeek`（周内分钟归一）、`shouldNotify`（normal 窗口内静音、**urgent 永远推送**——危机/资金到账不被静音）。
- `addWindow`（合并相邻/重叠、全周覆盖退化为 disabled）、`removeWindow`（拆分 gap）。
- **不绑付费**：免打扰是用户自主设置，无会员门槛。

### 三、弹药化（`ammo/risk-rule.ts`）
- 新增 `RiskRuleName = "age-required"`，全局 `enabled: true`（默认保护）。
- `CATEGORY_RISK` 登记成人专属类目：夜骑巡航 / 夜爬登山（只加弹药行，不改底座）。

## Consequences
- 新增 `base/safe/ageGate.ts`、`base/platform/quietHours.ts`、`ageGate.test.ts`（+16 单测）；
- 单测 365 → **381 全绿**、tsc 0 错；
- 后续（单独 ADR）：identity 补 birthYear 字段 + ProfilePage 出生年输入 + PublishSheet 发布路径接入 ageGate 分派 + 免打扰 UI 设置页 + NotificationCenter 接入 shouldNotify。