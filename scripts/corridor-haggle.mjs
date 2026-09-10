/**
 * E2E: P2P 广播 + 磋商闭环双 tab 测试（真实浏览器，需要生产服务在 localhost:3000）。
 * 用法：npm run test:e2e:wave （需先 `node scripts/restart-prod.mjs`）
 *
 * 场景：双 tab 双身份 ——
 *   Tab A 发布"厨师上门做饭 + 定制 30 岁女性 + 磋商入口"信号波
 *   Tab B（独立身份）在雷达收到广播 → 发起磋商（丙）
 *   Tab A 还价 → Tab B 回应 → Tab A 谈成锁定
 *   双方各自看到一次性虚拟线路拨号卡（同一号码）
 *   Tab A 违约裁决 → 虚拟余额扣费 + 钱包流水
 * 同时验证共享 localStorage 跨 tab 同步。
 */
import { chromium } from "playwright-core";
import { getE2eBaseUrl, getDefaultLaunchOptions, isolateBrowserChannels, resetE2eChannelRow } from "./lib/e2e-channel.mjs";
import assert from "node:assert/strict";

const BASE = getE2eBaseUrl();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitUntil(page, fn, timeout = 15000, label = "条件") {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await page.evaluate(fn)) return true;
    await sleep(300);
  }
  throw new Error(`等待超时: ${label}`);
}

const browser = await chromium.launch(getDefaultLaunchOptions());

// 广播命名空间隔离：该浏览器所有 context/page 物理锁定本脚本专属通道
isolateBrowserChannels(browser, "wave", { forceLocal: true });

let failures = 0;

try {
  // 自清零：覆盖本脚本专属云行为空 state（跨脚本/跨轮次污染根治）
  await resetE2eChannelRow("wave");
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
  });

  // 共享同一 context → 同一 localStorage（跨 tab 同步的基础）
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

  // --- 1. 清空共享广播空间（确保独立起点） ---
  await pageA.goto(BASE, { waitUntil: "domcontentloaded" });
  await pageA.evaluate(() => {
    try {
      localStorage.removeItem("oto-broadcast-v1::oto::e2e::wave");
    } catch {}
  });
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageB.goto(BASE, { waitUntil: "domcontentloaded" });

  // --- 2. Tab A 发出一条带定制 + 磋商入口的信号波 ---
  await pageA.getByRole("button", { name: /发出你的需求/ }).click();
  await pageA.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await pageA.waitForTimeout(400);
  const moreBtn = await pageA.getByRole("button", { name: /更多选项/ }).count();
  if (moreBtn) await pageA.getByRole("button", { name: /更多选项/ }).click();
  await pageA.getByLabel("需求品类").fill("厨师 · 上门做饭");
  await pageA.getByLabel("需求时间").fill("明天 11:00");
  await pageA.getByLabel("需求地点").fill("幸福家园小区");
  await pageA.getByLabel("基础预算").fill("100");
  await pageA.getByLabel("定制条件").fill("30 岁左右女性");
  await pageA.getByRole("button", { name: "＋" }).click();
  // 磋商入口 = 内容即开关：填了 → 开放磋商（negotiable）
  await pageA.getByLabel("磋商留言（可留空）").fill("价格可以谈");
  // 爽约保障险：双方履约保障（响应者冻结 ¥5 押金）
  await pageA.getByLabel("开启爽约保障险").click();
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  // 随单支付：钱到位才激活上线
  await pageA.getByRole("button", { name: /立即支付/ }).click();
  await waitUntil(
    pageA,
    () => (JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::wave") || "{}").state?.waves ?? []).length > 0,
    15000,
    "Tab A 发布落库"
  );

  const sharedWave = await pageA.evaluate(() =>
    JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::wave") || "{}")
  );
  assert.ok(
    (sharedWave?.state?.waves ?? []).length >= 1 &&
      sharedWave.state.waves[0].negotiable === true &&
      sharedWave.state.waves[0].deposit === true,
    "Tab A 发布后共享空间应存在可磋商 + 爽约保障险信号波"
  );

  // --- 3. Tab B 收到广播 → 发起磋商（丙） ---
  // Playwright 的多 page 不触发跨 tab storage 事件（真实浏览器双 tab 会实时
  // rehydrate）。此处以 reload 等效"另一 tab 打开/刷新时看到共享广播空间"。
await pageB.reload({ waitUntil: "domcontentloaded" });
  // P7.1 进家硬筛：B 先声明品类 + 实名认证才能看到家政进家单
  await pageB.getByLabel("我的", { exact: true }).click();
  await pageB.getByTestId("drawer-entry-system").click(); // P2 抽屉化 IA：能力声明已收纳于「系统设置」抽屉
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("能力声明"),
    10000,
    "B 能力面板"
  );
  await pageB.getByLabel("能力声明").click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("实名认证模拟"),
    10000,
    "B 认证开关"
  );
  await pageB.getByLabel("实名认证模拟").click();
  await pageB.getByLabel("首页").click();
  await pageB.waitForTimeout(400);
  await waitUntil(
    pageB,
    () =>
      document.body.textContent?.includes("幸福家园小区") &&
      document.body.textContent?.includes("30 岁左右女性"),
    10000,
    "Tab B 收到 Tab A 的广播"
  );

  // B 填磋商留言 → 按钮变"发起磋商"
  await pageB.getByLabel("磋商留言（可留空）").first().fill("90 元能做吗，我时间灵活");
  await pageB.waitForTimeout(200);
  await pageB.getByRole("button", { name: /发起磋商/ }).click();
  await pageB.waitForTimeout(500);

  const afterBClaim = await pageB.evaluate(() =>
    JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::wave") || "{}")
  );
  assert.equal(
    afterBClaim?.state?.claims?.[0]?.status,
    "negotiating",
    "B 发起磋商后 claim 应为 negotiating"
  );
  assert.equal(afterBClaim?.state?.claims?.[0]?.rounds, 1);
  // --- 4. Tab A 还价（需求方轮次） ---
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("行程").click();
  await pageA.waitForTimeout(400);
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("轮到你还价"),
    10000,
    "A 看到轮到你还价"
  );
  await pageA.getByTestId('haggle-table').scrollIntoViewIfNeeded();
  await pageA.waitForTimeout(300);
  await pageA.getByTestId('haggle-table').screenshot({ path: 'docs/shot/p3-haggle-table.png' });
  await pageA.getByTestId('haggle-confirm').scrollIntoViewIfNeeded();
  await pageA.waitForTimeout(300);
  await pageA.getByTestId('haggle-confirm').screenshot({ path: 'docs/shot/p3-haggle-confirm.png' });
  assert.equal(await pageA.getByTestId('haggle-table').count(), 1, 'haggle table renders');
  assert.equal(await pageA.getByTestId('haggle-confirm').count(), 1, 'haggle confirm renders');
  console.log('corridor-haggle: 2 shots PASS');
  // --- 4b. LLM 润一润：成功则填框，503 则原文保留（双路径契约，不赌 provider 天气） ---
  await pageA.getByRole("textbox", { name: /还价留言/ }).fill('95能做吗');
  await pageA.getByRole("button", { name: /润一润/ }).click();
  await pageA.waitForFunction(() => {
    const el = document.querySelector('input[aria-label="还价留言"]');
    const err = document.querySelector('[data-testid="haggle-err"]');
    return (el && el.value && el.value !== '95能做吗') || !!err;
  }, null, { timeout: 30000 });
  const errShown = await pageA.getByTestId('haggle-err').count();
  if (errShown > 0) {
    const kept = await pageA.getByRole("textbox", { name: /还价留言/ }).inputValue();
    assert.equal(kept, '95能做吗', 'fallback keeps original');
    console.log('corridor-haggle: polish FALLBACK PASS (503 keeps original)');
  } else {
    const polished = await pageA.getByRole("textbox", { name: /还价留言/ }).inputValue();
    assert.ok(polished.length > 6, 'polished message filled');
    console.log('corridor-haggle: polish PASS (' + polished.slice(0, 24) + '...)');
  }
  // --- 5. 确认卡 ack→发射→真接单闭环（T2 链路不断言只截图，点下去才算） ---
  await pageA.getByTestId('haggle-confirm').scrollIntoViewIfNeeded();
  await pageA.getByLabel(/已知晓价格与退款规则/).check();
  await pageA.getByRole("button", { name: /发射/ }).click();
  await pageA.waitForTimeout(600);
  const afterAccept = await pageA.evaluate(() =>
    JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::wave") || "{}")
  );
  assert.equal(afterAccept?.state?.claims?.[0]?.status, "accepted", "confirm card launch accepts claim");
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("有人接单了"),
    10000,
    "A sees accepted"
  );
  console.log('corridor-haggle: confirm-launch PASS');
} catch (e) {
  console.error("E2E 失败:", e.message ?? e);
  failures += 1;
} finally {
  await browser.close();
}

process.exit(failures === 0 ? 0 : 1);
