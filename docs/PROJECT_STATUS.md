# 项目状态档案 — deal-protocol（单一真相源 · 快照卡）

> 管辖范围：`deal-protocol/` 单体仓库。技术债唯一事实源 → [`docs/DEBT_CLEANUP_REGISTER.md`](DEBT_CLEANUP_REGISTER.md)。
> 本文件仅保留当前快照（<8KB）。历史流水已归档 → [`docs/archive/PROJECT_STATUS_2026_ARCHIVE.md`](archive/PROJECT_STATUS_2026_ARCHIVE.md)。
> 纪律：日常 commit 零触碰本文件；`LAST_SYNC` 仅发版 / Tag / 阶段收官时刷新（AGENTS.md project-status-sync）。

## Current Phase

Microkernel 4.4 + 首页极简重塑收官（2026-09-03 f7ee573：需求舱/空态/折叠Chat + E2E双同步）。
下一步：P8 商业化线上化（漫游设备表 / PWA 真推 / 真实支付，LAUNCH-GAP E 组）+ Meetup 裁决记录（付费通讯 ⏸️ / 群 dues 🚫 / 静态搜索 🚫）。

## Test Baseline

**1907/1907 全绿 · 0 skipped**（`npm test` = vitest 718 + node:test 1189；2026-09-03 实证守恒）。
Lint 0/0 · tsc 0 · verify-prod 13/13 · four-ammos PASS · roam 5/5 · first-principle ALL PASS。

## Architecture Baseline

单体微内核：`src/base/` 纯核（ESLint 八项物理门禁） + `src/ammo/` 8D 弹药表 + `src/adapters/` 六边形外联。
Next.js 16.2.12 App Router · React 19 · TS strict · build 97 页。

## LAST_SYNC

> **纪律（Step1 ③a）**：日常 commit 零触碰本文件；`LAST_SYNC` 仅发版 / Tag / 阶段收官时刷新。独立 `docs: sync` 提交已被 `scripts/hooks/commit-msg` 门禁拦截。

> 日期：2026-09-03 ｜ HEAD：工作区未提交（设计图极简两步完工）｜ 摘要：需求舱重塑+轻标签+空态三行+Chat折叠+E2E双同步；基线 **1907/1907守恒**（718+1189）｜ 门禁 tsc 0 + lint 0/0 + first-principle ALL PASS + build 97 + verify-prod 13/13 + four-ammos PASS + roam 5/5 + convergence 0 + Base0（4源码+2脚本+1文档，条文 #1 #4 #10）

<!-- Historical logs moved to docs/archive/PROJECT_STATUS_2026_ARCHIVE.md -->
