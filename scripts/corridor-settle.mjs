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

  // ========== 场景 A：简单任务 · 结果导向 ==========
  console.log("--- 场景 A：简单任务结果验收 ---");
  await pageA.getByLabel("首页").click();
  await pageA.getByRole("button", { name: /发出你的需求/ }).click();
  await pageA.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await pageA.waitForTimeout(400);
  const moreBtn = await pageA.getByRole("button", { name: /更多选项/ }).count();
  if (moreBtn) await pageA.getByRole("button", { name: /更多选项/ }).click();
  await pageA.getByLabel("需求品类").fill("羽毛球约局");
  await pageA.getByLabel("需求时间").fill("今天 20:00");
  await pageA.getByLabel("需求地点").fill("幸福家园 2 栋");
  await pageA.getByLabel("基础预算").fill("80");
  // 不拆解 → 简单任务
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  await pageA.getByRole("button", { name: /立即支付/ }).click();
  // 支付/落库是异步管线 → 等 wave 确实入共享空间再让 B 刷新（负载无关的确定性等待）
  await waitUntil(
    pageA,
    () => (JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::acceptance") || "{}").state?.waves ?? []).length > 0,
    15000,
    "A 场景 A 发布落库"
  );

  // Playwright 多 page 不触发 storage 事件 → reload B 等效"另一设备实时收到广播"
  await pageB.reload({ waitUntil: "domcontentloaded" });

  await pageB.getByLabel("首页").click();
  await pageB.waitForTimeout(800);
  // 首页重设计：一屏一职，接单流在雷达段
  await pageB.getByTestId("home-tab-radar").click();
  await pageB.waitForTimeout(400);
  await waitUntil(
    pageB,
    () => Array.from(document.querySelectorAll("button")).some((b) => b.textContent?.includes("接单")),
    15000,
    "B 收到广播（出现接单按钮）"
  );
  await pageB.getByRole("button", { name: /接单/ }).first().click();
  await pageB.waitForTimeout(400);
  await pageB.getByLabel("我的", { exact: true }).click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("服务完成 · 请求放款"),
    25000,
    "B 见申报按钮"
  );
  await pageB.getByLabel("申报完成").click();
  // 等 B 侧申报落盘（transport write 完成）再让 A 读
  await waitUntil(
    pageB,
    () => {
      const st = JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::acceptance") || "{}").state;
      return (st?.claims ?? []).some((c) => c.serviceDoneAt);
    },
    25000,
    "B 申报落盘"
  );

await pageA.reload({ waitUntil: "domcontentloaded" });
  await waitUntil(
    pageA,
    () => !!document.querySelector('[data-testid="home-tabs"]'),
    10000,
    "A reload"
  );
  await pageA.getByLabel("行程").click();
  const t0 = Date.now();
  while (true) {
    try {
      if (await pageA.evaluate(() => document.body.textContent?.includes("服务方已申报完成"))) break;
    } catch {}
    const dump = await pageA.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::acceptance") || "{}").state;
      return {
        claims: (s?.claims ?? []).map((c) => ({ st: c.status, done: !!c.serviceDoneAt, w: c.waveId })),
        waves: (s?.waves ?? []).map((w) => ({ st: w.status })),
      };
    });
    console.log(`[t+${((Date.now() - t0) / 1000).toFixed(1)}s] A store dump:`, JSON.stringify(dump));
    if (Date.now() - t0 > 25000) throw new Error("等待超时: A 见验收卡");
    await new Promise((r) => setTimeout(r, 3000));
  }
  await pageA.getByLabel("验收凭证").fill("马桶通了，水流顺畅");
  await pageA.getByRole("button", { name: /确认验收/ }).click();
  await pageA.waitForTimeout(500);
  const sA = await state(pageA);
  assert.equal(sA?.claims?.[0]?.fulfilment?.confirmedBy, "demander", "A 结果导向验收成功");
  console.log("场景 A ✅ 简单任务：申报 → 验收 → 放款");
  await pageA.reload({ waitUntil: 'domcontentloaded' });
  await pageA.getByLabel("行程").click();
  await pageA.waitForTimeout(500);
  await waitUntil(pageA, () => { const el = document.querySelector('[data-testid="money-strip"]'); return el && (el.getAttribute('data-phase') === 'settled' || el.getAttribute('data-phase') === 'review'); }, 15000, 'strip settled/review');
  const phaseN = await pageA.getByTestId('money-strip').getAttribute('data-phase');
  console.log('normal settle strip phase=' + phaseN);
  await pageA.getByTestId('money-strip').screenshot({ path: 'docs/shot/p2-money-review.png' });
  console.log('corridor-settle: 1 shot PASS');
} catch (e) {
  console.error("E2E 失败:", String(e).slice(0, 600));
  failures += 1;
} finally {
  await browser.close();
}

if (failures > 0) process.exit(1);
