# 项目状态档案 — deal-protocol（单一真相源 · 快照卡）

> 管辖范围：`deal-protocol/` 单体仓库。技术债唯一事实源 → [`docs/DEBT_CLEANUP_REGISTER.md`](DEBT_CLEANUP_REGISTER.md)。
> 本文件仅保留当前快照（<8KB）。历史流水已归档 → [`docs/archive/PROJECT_STATUS_2026_ARCHIVE.md`](archive/PROJECT_STATUS_2026_ARCHIVE.md)。
> 纪律：日常 commit 零触碰本文件；`LAST_SYNC` 仅发版 / Tag / 阶段收官时刷新（AGENTS.md project-status-sync）。

## Current Phase

Microkernel 3.1 增长特区量产闭环收官（2026-09-05：P0 真题库 → P1 编译器纯核 → P2 旁路量产链+/lab → P3 双盘单页）。
下一步：真机通过率实测（REAL_LLM=1 ≥14/20）+ m20/f20 投流转化 + P8 商业化线上化。

## Test Baseline

**1938/1938 全绿 · 0 skipped**（`npm test` = vitest 724 + node:test 1214；2026-09-05 实证）。
Lint 0/0 · tsc 0 · verify-prod 13/13 · four-ammos 6/6 · roam 5/5 · first-principle ALL PASS。

## Architecture Baseline

单体微内核：`src/base/` 纯核（ESLint 八项物理门禁） + `src/ammo/` 8D 弹药表 + `src/adapters/` 六边形外联。
Next.js 16.2.12 App Router · React 19 · TS strict · build 101 路由。

## LAST_SYNC

> **纪律（Step1 ③a）**：日常 commit 零触碰本文件；`LAST_SYNC` 仅发版 / Tag / 阶段收官时刷新。独立 `docs: sync` 提交已被 `scripts/hooks/commit-msg` 门禁拦截。

> 日期：2026-09-05 ｜ HEAD：P4 收官提交（docs: finalize Microkernel 3.1）｜ 摘要：增长特区 P0~P3 全链贯通（真题库/编译器/量产链+lab/双盘单页）；基线 **1938/1938**（724+1214）｜ 门禁 tsc 0 + lint 0/0 + first-principle ALL PASS + build 101 + verify-prod 13/13 + four-ammos 6/6 + roam 5/5 + convergence 0 + Base0（R=0 零rename，条文 #1 #3 #9 #10）

<!-- Historical logs moved to docs/archive/PROJECT_STATUS_2026_ARCHIVE.md -->
