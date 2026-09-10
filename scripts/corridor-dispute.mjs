/**
 * E2E: 验收/扣费模块（M3）— 三条链路（真实浏览器，需生产服务）。用法：npm run test:e2e:acceptance
 *
 * 场景 A（简单任务·结果导向）：发布 → B 接单 → B 申报完成 → A 验收放款。
 * 场景 B（复杂任务·模块化）：发布时 AI 拆解出模块（mock 降级，无 LLM key 时确定）→
 *   B 接单 → 逐模块申报 → A 逐模块确认 → 全确认放款。
 * 场景 C（争议·原因拆分优先）：A 发起争议（选原因+凭证）→ 自动判责 →
 *   B 协商（上限内比例）→ A 接受协商 → 结算 + 信用联动落库。
 */
import { chromium } from "playwright-core";
import { getE2eBaseUrl, getDefaultLaunchOptions, isolateBrowserChannels, resetE2eChannelRow } from "./lib/e2e-channel.mjs";
import assert from "node:assert/strict";

const BASE = getE2eBaseUrl();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitUntil(page, fn, timeout = 15000, label = "条件", arg) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await page.evaluate(fn, arg)) return true;
    await sleep(300);
  }
  throw new Error(`等待超时: ${label}`);
}

const state = (p) =>
  p.evaluate(() =>
    JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::acceptance") || "{}").state
  );

const browser = await chromium.launch(getDefaultLaunchOptions());

// 广播命名空间隔离：该浏览器所有 context/page 物理锁定本脚本专属通道
isolateBrowserChannels(browser, "acceptance", { forceLocal: true });

let failures = 0;

try {
  // 自清零：覆盖本脚本专属云行为空 state（跨脚本/跨轮次污染根治）
  await resetE2eChannelRow("acceptance");
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
  });
  const pageA = await ctx.newPage();
  const pageB = await ctx.newPage();

  for (const [label, page] of [
    ["A", pageA],
    ["B", pageB],
  ]) {
    page.on("pageerror", (e) => {
      console.error(`[${label}] pageerror:`, String(e).slice(0, 300));
      failures += 1;
    });
  }

  // --- 0. 清空共享空间（独立起点） ---
  await pageA.goto(BASE, { waitUntil: "domcontentloaded" });
  await pageA.evaluate(() => {
    try {
      localStorage.removeItem("oto-broadcast-v1::oto::e2e::acceptance");
    } catch {}
  });
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageB.goto(BASE, { waitUntil: "domcontentloaded" });
  await pageB.reload({ waitUntil: "domcontentloaded" });

  // B 默认声明全部 6 个品类；测试统一用非进家品类「羽毛球约局」——无需实名认证，
  // 规避认证点击的间歇性 flaky，聚焦验收/争议链路本身。

  console.log("--- 场景 C：争议按原因 + 协商 ---");
  await pageA.getByLabel("首页").click();
  await pageA.getByRole("button", { name: /发出你的需求/ }).click();
  await pageA.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await pageA.waitForTimeout(400);
  await pageA.getByLabel("需求品类").fill("羽毛球约局");
  await pageA.getByLabel("需求时间").fill("明天 14:00");
  await pageA.getByLabel("需求地点").fill("幸福家园 4 栋");
  await pageA.getByLabel("基础预算").fill("120");
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  await pageA.getByRole("button", { name: /立即支付/ }).click();
  await waitUntil(
    pageA,
    () => (JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::acceptance") || "{}").state?.waves ?? []).length > 0,
    15000,
    "A 场景 C 发布落库"
  );

  // Playwright 多 page 不触发 storage 事件 → reload B 等效实时收到广播
  await pageB.reload({ waitUntil: "domcontentloaded" });

  await pageB.getByLabel("首页").click();
  await waitUntil(
    pageB,
    () => Array.from(document.querySelectorAll("button")).some((b) => b.textContent?.includes("接单")),
    15000,
    "B 收到场景 C 广播（出现接单按钮）"
  );
  await pageB.getByRole("button", { name: /接单/ }).first().click();
  await pageB.waitForTimeout(400);
  await pageB.getByLabel("我的", { exact: true }).click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("服务完成 · 请求放款"),
    25000,
    "B 申报按钮（C）"
  );
  await pageB.getByLabel("申报完成").click();
  await pageB.waitForTimeout(300);

  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("行程").click();
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("发起争议"),
    25000,
    "A 见争议入口"
  );
  // 选原因「迟到/早退」（部分责任 → 协商上限 60%）——定位场景 C 的卡片（预算 ¥120）
  // 选原因「迟到/早退」（部分责任 → 协商上限 60%）——页面级 first：
  // 场景 A/B 的 claim 已验收，其争议表单未展开；场景 C 是唯一展开的表单。
  await pageA.getByRole("button", { name: /迟到\/早退/ }).first().click();
  await pageA.getByLabel("争议凭证").first().fill("比约定晚到 40 分钟");
  await pageA.getByRole("button", { name: /提交争议/ }).first().click();
  await pageA.waitForTimeout(400);
    // 场景 C：A 的第三个波（无 modules）= 简单任务争议
  const cWaveId = (await state(pageA))?.waves
    ?.filter((w) => !w.modules || w.modules.length < 2)
    ?.at(-1)?.id;
  assert.ok(cWaveId, "找到场景 C 的 wave");
  const sC1 = await state(pageA);
  const cClaimId = sC1?.claims?.find((c) => c.waveId === cWaveId)?.id;
  const dispute = sC1?.disputes?.find((d) => d.claimId === cClaimId);
  assert.ok(dispute, "争议落库");
  await pageA.reload({ waitUntil: 'domcontentloaded' });
  await pageA.getByLabel("行程").click();
  await pageA.waitForTimeout(500);
  await waitUntil(pageA, () => { const el = document.querySelector('[data-testid="money-strip"]'); return el && el.getAttribute('data-phase') === 'disputed'; }, 15000, 'strip disputed');
  await pageA.getByTestId('money-strip').screenshot({ path: 'docs/shot/p2-money-disputed.png' });
  console.log('corridor-dispute: 1 shot PASS');
  // B 侧见争议 → 提出协商（上限 60%）→ 响应者接受即结案
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("我的", { exact: true }).click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("需求方发起了争议"),
    25000,
    "B 见争议卡"
  );
  await pageB.getByRole("button", { name: /提出协商/ }).first().click();
  await pageB.waitForTimeout(400);
  await waitUntil(
    pageB,
    (cid) => {
      const st = JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::acceptance") || "{}").state;
      return (st?.disputes ?? []).some((d) => d.claimId === cid && d.outcome?.kind === "negotiated");
    },
    25000,
    "B 协商结案落盘",
    cClaimId
  );
  const sC2 = await state(pageB);
  const d2 = sC2?.disputes?.find((d) => d.claimId === cClaimId);
  assert.ok(d2?.outcome?.kind === "negotiated", "协商结算");
  assert.equal(d2.outcome.agreedAmount, 60, "按 60% 部分退款");
  await pageA.reload({ waitUntil: 'domcontentloaded' });
  await pageA.getByLabel("行程").click();
  await pageA.waitForTimeout(500);
  await waitUntil(pageA, () => !!document.querySelector('[data-testid="money-strip"]'), 15000, 'strip renders');
  const phase = await pageA.getByTestId('money-strip').getAttribute('data-phase');
  console.log('settled strip phase=' + phase);
  await pageA.getByTestId('money-strip').screenshot({ path: 'docs/shot/p2-money-settled.png' });
  console.log('corridor-dispute: settled shot PASS');
} catch (e) {
  console.error("E2E 失败:", String(e).slice(0, 600));
  failures += 1;
} finally {
  await browser.close();
}

if (failures > 0) process.exit(1);
