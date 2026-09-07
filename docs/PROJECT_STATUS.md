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

> 日期：2026-09-07 ｜ HEAD：dcbf64e（真机 15/20 收官 + THROTTLED 考卷）｜ 摘要：五池回血复跑 15/20 达标（#02 预期拦截/#03 8s 熔断/回空转 THROTTLED 双锁）；基线 **1984/1984**（763+1221）｜ 门禁 tsc 0 + lint 0 + npm test 全绿 + convergence 0
>
> 日期：2026-09-06 ｜ HEAD：da81d78（UI 视觉单轨制与 Feather 体系收官）｜ 摘要：Batch 1~3 + glow 死定义补刀全链贯通（glass/btn-primary/4 预设/主题切换全出清）；基线 **1974/1974**（759+1215）｜ 门禁 tsc 0 + lint 0/0 + build 101 + verify-scoped 6/6 + convergence 0
>
> 日期：2026-09-05 ｜ HEAD：P4 收官提交（docs: finalize Microkernel 3.1）｜ 摘要：增长特区 P0~P3 全链贯通（真题库/编译器/量产链+lab/双盘单页）；基线 **1938/1938**（724+1214）｜ 门禁 tsc 0 + lint 0/0 + first-principle ALL PASS + build 101 + verify-prod 13/13 + four-ammos 6/6 + roam 5/5 + convergence 0 + Base0（R=0 零rename，条文 #1 #3 #9 #10）

<!-- Historical logs moved to docs/archive/PROJECT_STATUS_2026_ARCHIVE.md -->
