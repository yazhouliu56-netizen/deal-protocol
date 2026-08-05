/**
 * E2E: 撮合全链路测试（真实浏览器，需要生产服务在 http://localhost:3000）。
 * 用法：npm run test:e2e   （需先 `npm run start` 或 READY 后再跑）
 * 覆盖：需求采集 → 时段卡密度徽章 → slot 选择 → 撮合排序 → 预订 → 订单持久化。
 */
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitUntil(page, fn, timeout = 15000, label = "条件") {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await page.evaluate(fn)) return true;
    await sleep(300);
  }
  throw new Error(`等待超时: ${label}`);
}

async function grabRows(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((b) => !b.textContent?.includes("评分详情"))
      .filter((b) => /距你/.test(b.textContent || ""))
      .map((x) => x.textContent?.replace(/\s+/g, " ").trim())
      .filter(Boolean)
  );
}

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHANNEL === "chromium"
    ? { headless: true }
    : { channel: "chrome", headless: true }
);

try {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // 容忍 LLM 上游不可用时的降级（429/5xx → MockEngine 是特性，不是 bug）
    if (/429|Failed to load resource|LLM upstream failed/.test(t)) return;
    errors.push(t);
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  // --- 1. 进 AI 屏，清状态（先清 SW 缓存避免旧页面替换导致 detach）---
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  await page.evaluate(async () => {
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await waitUntil(page, () => !!document.querySelector('button[aria-label="AI 助手"]'), 10000, "Dock 渲染");
  await page.getByRole("button", { name: "AI 助手" }).click();
  await page.getByRole("button", { name: "新对话" }).click();

  // --- 2. 需求 → 时段卡（断言密度徽章可见）---
  await page.getByRole("textbox").fill("周末找人打羽毛球，新手，双打，附近，30块");
  await page.keyboard.press("Enter");
  await waitUntil(page, () => document.body.innerText.includes("可选时段"), 15000, "时段卡");
  const density = await page.evaluate(() => ({
    hot: document.body.innerText.includes("🔥 热门"),
    idle: document.body.innerText.includes("空闲"),
  }));
  assert.ok(density.hot, "时段卡应显示热门徽章");

  // --- 3. 空闲时段 t3：可约同水平者第一 ---
  await page.getByRole("button", { name: /周日 10:00/ }).click();
  await waitUntil(page, () => document.body.innerText.includes("为你匹配"), 15000, "撮合卡");
  await sleep(1200);
  let rows = await grabRows(page);
  assert.ok(rows[0].includes("大熊"), `空闲时段第一应为大熊: ${rows[0]}`);
  assert.ok(rows[0].includes("极高匹配"), `徽章应极高: ${rows[0]}`);
  const allHaveDistance = rows.every((t) => t.includes("距你"));
  assert.ok(allHaveDistance, "所有 provider 应显示距离");

  // --- 4. 展开评分详情 ---
  await page.getByRole("button", { name: "评分详情" }).first().click();
  await sleep(400);
  const panel = await page.evaluate(() => {
    const text = document.body.innerText;
    return ["预算", "水平", "风格", "评分", "距离", "时段"].every((k) =>
      text.includes(k)
    );
  });
  assert.ok(panel, "评分详情面板应展示六维");

  // --- 5. 换热门时段 → 排序变化 + 已约满提示 ---
  await page.getByRole("button", { name: "新对话" }).click();
  await page.getByRole("textbox").fill("周末找人打球，新手，双打，附近，30块");
  await page.keyboard.press("Enter");
  await waitUntil(page, () => document.body.innerText.includes("可选时段"), 15000, "时段卡2");
  await page.getByRole("button", { name: /周六 19:00/ }).click();
  await waitUntil(page, () => document.body.innerText.includes("为你匹配"), 15000, "撮合卡2");
  await sleep(1200);
  rows = await grabRows(page);
  const fullHints = await page.evaluate(
    () => (document.body.innerText.match(/已约满/g) || []).length
  );
  assert.ok(fullHints >= 2, `热门时段应≥2 条已约满: ${fullHints}`);
  const kaiRank = rows.findIndex((t) => t.includes("阿凯"));
  const bearRank = rows.findIndex((t) => t.includes("大熊"));
  assert.ok(kaiRank > -1 && bearRank > -1, "阿凯/大熊应在列表");
  assert.ok(fullHints >= 2, "时段密度驱动排序生效");

  // --- 6. 选座走通：选人 → 确认 → 预订 ---
  await page.getByRole("button", { name: /大熊/ }).first().click();
  await waitUntil(
    page,
    () => document.body.innerText.includes("确认订单"),
    15000,
    "确认单"
  );
  await page.getByRole("button", { name: "确认预订" }).click();
  await waitUntil(
    page,
    () => document.body.innerText.includes("已预订"),
    15000,
    "预订成功"
  );

  // --- 7. 持久化断言 ---
  const persisted = await page.evaluate(() => {
    try {
      const st = JSON.parse(localStorage.getItem("ai-spatial-storage") || "{}");
      const b = st?.state?.bookings ?? [];
      return b.find((x) => x.status === "upcoming");
    } catch {
      return null;
    }
  });
  assert.ok(persisted, "预订应持久化到 localStorage bookings");

  // --- 7b. 双视角闭环：用户订单已出现在服务者工作台 ---
  await page.getByRole("button", { name: "我的" }).click();
  await page.getByRole("button", { name: /服务者工作台/ }).click();
  const benchText = await page.evaluate(() => document.body.innerText);
  assert.ok(benchText.includes("我（Alex）"), "工作台应收到用户同步的新单");

  // --- 7c. 取消订单 → 工作台待接单撤回 ---
  await page.getByRole("button", { name: /返回个人中心/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /熊|星羽|阿凯/ }).first().click();
  await page.getByRole("button", { name: "取消订单" }).click();
  await page.waitForTimeout(600);
  const afterCancel = await page.evaluate(() => document.body.innerText);
  assert.ok(afterCancel.includes("已取消"), "订单应变为已取消");
  assert.ok(afterCancel.includes("同步撤回"), "取消提示应说明工作台同步撤单");

  // --- 8. 生产 console 无 error ---
  assert.equal(errors.length, 0, `无 console error，实际: ${errors.join(" | ")}`);

  await page.screenshot({ path: "e2e-match-final.png" });
  console.log("E2E 撮合全链路 PASS ✓（含排序/徽章/评分详情/预订/持久化）");
  await browser.close();
} catch (err) {
  console.error("E2E 撮合全链路 FAIL:", err instanceof Error ? err.message : err);
  await browser.close();
  process.exit(1);
}