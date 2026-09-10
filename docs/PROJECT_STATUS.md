# 项目状态档案 — deal-protocol（单一真相源 · 快照卡）

> 管辖范围：`deal-protocol/` 单体仓库。技术债唯一事实源 → [`docs/DEBT_CLEANUP_REGISTER.md`](DEBT_CLEANUP_REGISTER.md)。
> 本文件仅保留当前快照（<8KB）。历史流水已归档 → [`docs/archive/PROJECT_STATUS_2026_ARCHIVE.md`](archive/PROJECT_STATUS_2026_ARCHIVE.md)。
> 纪律：日常 commit 零触碰本文件；`LAST_SYNC` 仅发版 / Tag / 阶段收官时刷新（AGENTS.md project-status-sync）。

## Current Phase

Microkernel 3.1 增长特区量产闭环收官（2026-09-05：P0 真题库 → P1 编译器纯核 → P2 旁路量产链+/lab → P3 双盘单页）。
UI 视觉单轨制收官（2026-09-06：Batch 1~3 + glow 死定义补刀，全仓 Feather/Duo 3D 单一设计系统，glass/btn-primary/4 预设/主题切换全出清）。
下一步：真机 15/20 法定达标（2026-09-07 五池回血复跑：gemini-lite 主力 19/20 均经 JSON 硬化修复；#02 CLUSTER 系预期安全拦截、#03 命中 8s 动态熔断、#12/#14/#16 回空已转 THROTTLED 维度 + 双考卷锁死 dcbf64e；首页买家单轨 Phase1 落盘 d7f5a8d 已推远端）→ m20/f20 投流转化 + P8 商业化线上化。

## Test Baseline

**1984/1984 全绿 · 0 skipped**（`npm test` = vitest 763 + node:test 1221；2026-09-07 实证，含 THROTTLED 双考卷）。
Lint 0/0 · tsc 0 · build 101 路由 · verify-scoped 6/6 · first-principle ALL PASS（verify-prod/four-ammos/roam 沿用 09-05 基线，本轮未重跑）。

## Architecture Baseline

单体微内核：`src/base/` 纯核（ESLint 八项物理门禁） + `src/ammo/` 8D 弹药表 + `src/adapters/` 六边形外联。
Next.js 16.2.12 App Router · React 19 · TS strict · build 101 路由。

## LAST_SYNC

> **纪律（Step1 ③a）**：日常 commit 零触碰本文件；`LAST_SYNC` 仅发版 / Tag / 阶段收官时刷新。独立 `docs: sync` 提交已被 `scripts/hooks/commit-msg` 门禁拦截。

> 日期：2026-09-10 ｜ HEAD：0a4d410（P15 漏斗遥测 + P16-①信任三事实收官）｜ 摘要：POST /api/metrics（metric_events 迁移，恒200）+ GET /api/admin/growth/roi（ADMIN，source×campaign 聚合）+ 接单人信任三事实可展开（信用/纠纷/在线+派单范围行）；基线 **2036/2036**（806+1230，0 fail）｜ 门禁 tsc 0 + pre-push T2 全绿 + convergence 0（verify-prod 沿用 v4.6.0 基线 13/13，P15/① 纯加法未动既有链路）
>
> 日期：2026-09-10 ｜ HEAD：e17bb3f（P14 首单：manifest 单源归一 + landing 开闸）｜ 摘要：删 manifest.json 双胞胎（双 layout 同指 webmanifest，浅色主题 polar/green）+ proxy 放行 /landing（robots 早放行，截图实证诊断舱渲染）；基线 **2016/2016**（沿用，无新增用例）｜ 门禁 tsc 0 + convergence 0 + pre-push T2（npm test + build + scoped 2 e2e PASS）
>
> 日期：2026-09-10 ｜ HEAD：5b07b86（P13 视觉冻结线收官）｜ 摘要：D2 量表立宪（字8档/圆角正典/19色归表+契约入 globals）/D1 纯浅 381 死 dark/D4 敏感用户空白 CSS 兜底/D3 单轨确认零删（dp 现役）+mobile 44 删（PWA 单轨）/D5 走廊 hare 禁入/D6 转场 0.3 单档；基线 **2016/2016**（786+1230，P13 无新增用例）｜ 门禁 tsc 0 + lint 0 errors（全量沿用 P12，P13 changed 全绿）+ build 101 + verify-prod 13/13 + first-principle 沿用 P12（base 未动）+ convergence 0
>
> 日期：2026-09-10 ｜ HEAD：927a59f（P12 发版审计收官）｜ 摘要：P11 暗底收敛封账（P11-1 三白卡入壳/P11-2 DuoPill 多态/P11-3 暗hex转palette/P11-4 暗style转palette+2层叠漂移回滚）+ 发版门禁 lint 2 errors 出清；基线 **2016/2016**（786+1230）｜ 门禁 tsc 0 + 全量lint 0 errors（4 warnings 沿用）+ build 101 + verify-prod 13/13 + first-principle ALL PASS + convergence 0（four-ammos/roam 沿用 09-05 基线，本轮未重跑）
>
> 日期：2026-09-07 ｜ HEAD：dcbf64e（真机 15/20 收官 + THROTTLED 考卷）｜ 摘要：五池回血复跑 15/20 达标（#02 预期拦截/#03 8s 熔断/回空转 THROTTLED 双锁）；基线 **1984/1984**（763+1221）｜ 门禁 tsc 0 + lint 0 + npm test 全绿 + convergence 0
>
> 日期：2026-09-06 ｜ HEAD：da81d78（UI 视觉单轨制与 Feather 体系收官）｜ 摘要：Batch 1~3 + glow 死定义补刀全链贯通（glass/btn-primary/4 预设/主题切换全出清）；基线 **1974/1974**（759+1215）｜ 门禁 tsc 0 + lint 0/0 + build 101 + verify-scoped 6/6 + convergence 0
>
> 日期：2026-09-05 ｜ HEAD：P4 收官提交（docs: finalize Microkernel 3.1）｜ 摘要：增长特区 P0~P3 全链贯通（真题库/编译器/量产链+lab/双盘单页）；基线 **1938/1938**（724+1214）｜ 门禁 tsc 0 + lint 0/0 + first-principle ALL PASS + build 101 + verify-prod 13/13 + four-ammos 6/6 + roam 5/5 + convergence 0 + Base0（R=0 零rename，条文 #1 #3 #9 #10）

<!-- Historical logs moved to docs/archive/PROJECT_STATUS_2026_ARCHIVE.md -->
