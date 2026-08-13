# ADR-0009: 多因子反欺诈探针（Sentinel 聚合）

日期：2026-08-13
状态：Accepted（作为缺口 N9 落地；功能层迭代第二批）

## 六圈定位声明
- 所属圈：第五圈 · 安全与信任防护层
- 所属模块：20. 多因子反欺诈探针（Sentinel 聚合）
- 复用底座：`base/risk/roamGuard.ts`（设备×身份多开因子）、`base/risk/fission.ts`（防自刷裂变因子）、`base/risk/moderation.ts`（内容下架因子）、`ammo/risk-rule.ts`（C5 引信表）、`base/notify`（告警通知）
- 弹药表：`ammo/risk-rule.ts` 引信表复用——探针聚合结果受引信约束（高危类目探针加权），不新增弹药字段（宪法 #3 弹药优先）

## 宪法条文对照
- 命中条文：**#9 多防线一体**（单因子防线 → 多因子聚合：设备/信用/行为/图 四路信号 → 统一风险分 + 事件流，防单点被绕）、**#10 降级是设计的一部分**（探针任何因子不可用 → 忽略该因子加权归一，永不因数据缺失而直接放行高危）、**#6 信任数据是瞄准镜**（探针命中写回信用分/冻结标记，闭环）
- 偏离条文：无

## Context

现状是**三根孤立柱子**：roamGuard 只管设备多开、fission 只管裂变自刷、moderation 只管内容。它们各自判断、各自处罚，没有一个统一的「这一单整体有多可疑」的聚合视图；发布闸门只查了 roam 一个因子（useWaveStore:300 只有 `riskOf(...).risk === "high"` 才挡）。

攻击者绕单点：多开因子被绕（换设备）→ 信用因子（新号低信用+大额）→ 行为因子（频发发布无完成）。单因子防线是筛子。

用户痛点：本地演示沙盒的「多开风控」是孤证——连点两次就 high，但换设备刷单、新号冲大额都拦不住。需要一个把多因子织在一起的哨兵。

## Decision

### 一、Sentinel 探针聚合（`src/base/risk/sentinel.ts`，纯函数）

四路信号 → 统一风险分 0-100 + 等级 + 事件流：

| 因子 | 来源 | 信号 | 权重 |
|------|------|------|------|
| 设备因子 | roamGuard.riskOf | 同设备身份数 → high(80)/watch(50)/safe(0) | 30 |
| 信用因子 | 注入 creditScore + amountYuan | 新号(<600) + 大额(≥500) → 60；新号小额 → 30；正常 → 0 | 25 |
| 行为因子 | 注入近期发布次数 + 完成率 | 高频发布(≥5) 且 完成率<30% → 70；仅高频 → 40；正常 → 0 | 25 |
| 图因子 | 注入同设备关联身份数 + fission 异常 | 同设备 ≥3 身份 且有裂变 → 75；仅其一 → 40；正常 → 0 | 20 |

- `score = Σ(因子分 × 权重) / Σ权重`（缺数据因子自动剔除后重新归一——宪法 #10）
- 等级：`safe < 40` · `watch 40-69` · `high ≥ 70`
- 引信联动：`ammo/risk-rule.ts` 的 `riskRulesFor(category)` 命中 `home-access-verification` 类目 → 探针权重整体 ×1.2（进家类目更严）——只读引信表，不加弹药字段
- 输出：`score/level/factors[]（每因子贡献明细）/triggeredBy（top 因子）`
- 事件流：每次甄检 push `SentinelEvent { at, identityId, score, level, note }`

### 二、发布闸门接线（useWaveStore）

- `createPendingWave` 发布前跑 `sentinelCheck`：
  - `high` → 拒绝发布，返回 `blocked: "sentinel"`（与现有 `blocked: "roam" | "debt"` 并列）
  - `watch` → 放行但打标记 `watchlisted: true`（订单可见性降权：不上热门、不参与竞价高光）——本轮先记录字段 + UI 展示，实际降权规则留给运营配置（ammo 未来可加）
- 复用现有 roam 检查，但改为「roam 因子并入探针，不再单点拦截」——单点防线升级为聚合防线

### 三、安全中心仪表盘（UI）

- `SentinelDashboard.tsx`：实时风险分数环 + 四因子贡献条 + 最近探针事件流（时间线）
- 挂在现有 AdminPanel 的「漫游安全监控」区块旁边（演示入口）
- 违规可演示：连点多开 → 设备因子飙红；新号大额 → 信用因子飙红

## Alternatives Rejected

- **机器学习模型**：本地沙盒无训练数据，规则可解释性反而更好（宪法 #6 信任数据透明可审计）。
- **只加因子不改闸门**：聚合无拦截 = 只报警不灭火，宪法 #9 要求防线一体生效。
- **探针新开弹药表字段**：引信表已能表达类目差异，不重复造轮子（宪法 #3）。

## Consequences

- 新增：`src/base/risk/sentinel.ts`（纯函数 + 单测）、`src/components/admin/SentinelDashboard.tsx`；
- 修改：`src/store/useWaveStore.ts`（发布闸门接入探针 + `blocked: "sentinel"` 类型扩展）、`src/components/...`（发布提示 + 仪表盘入口）；
- 单测基数 323 → 330+（sentinel ≥7）；
- 缺口清单 N9 标注已关闭；`docs/PROJECT_STATUS.md` LAST_SYNC 更新；
- 不动的部分：roamGuard/fission/moderation 三个底座模块语义零改动（只读复用）；
- 后续（单独 ADR）：watch 降权规则弹药化、设备指纹采集增强（主动指纹 vs 被动注入）、探针结论自动执行信用分写回。