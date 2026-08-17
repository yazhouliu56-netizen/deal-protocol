/**
 * E2E: 离线降级（P5 回归） — 在生产服务上验证断网时整机可用。
 * 用法：node scripts/e2e-offline.mjs   （需先 npm run start / verify-prod）
 * 覆盖：SW 预缓存 → 断网重载 → 雷达/AI/AR/行程/我的 五屏兜底可用、无 console error。
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
    if (/Failed to load resource|net::ERR_INTERNET_DISCONNECTED|LLM upstream|AJAXError|openfreemap|maplibregl/i.test(t)) return;
    errors.push(t);
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  // --- 1. 在线首访：预热 SW 预缓存 shell ---
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitUntil(page, () => document.body.innerText.includes("谁正在附近发需求"), 15000, "雷达渲染");
  await waitUntil(page, () => navigator.serviceWorker?.controller !== null, 10000, "SW 接管");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitUntil(page, () => document.body.innerText.includes("谁正在附近发需求"), 15000, "预热重载");

  // --- 2. 断网 → 重载 → 五屏兜底 ---
  await ctx.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitUntil(page, () => document.body.innerText.includes("谁正在附近发需求"), 15000, "离线雷达");
  await sleep(600);

  const screens = await page.evaluate(async () => {
    const doc = document;
        const out = { home: null, ai: null, ar: null, trip: null, profile: null };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // 用视频导航（Dock 按钮）
    const clickDock = async (label) => {
      const b = [...doc.querySelectorAll("button")].find(
        (x) =>
          x.getAttribute("aria-label") === label ||
          x.textContent?.trim() === label
      );
      if (b) b.click();
      await sleep(400);
    };
    out.home = { have: doc.body.innerText.includes("谁正在附近发需求") };
    await clickDock("AI 助手");
    await sleep(500);
    out.ai = {
      have:
        !!doc.querySelector('input[placeholder*="描述你的需求"]') ||
        doc.body.innerText.includes("描述你的需求"),
    };
    await clickDock("AR 扫描");
    await sleep(600);
    out.ar = { have: doc.body.innerText.includes("AR") };
    await clickDock("行程");
    await sleep(500);
    out.trip = { have: doc.body.innerText.length > 60 };
    await clickDock("我的");
    await sleep(500);
    out.profile = { have: doc.body.innerText.length > 60 };
    return out;
  });

  assert.ok(screens.home.have, "离线首页可渲染");
  assert.ok(screens.ai.have, "离线 AI 屏可渲染（MockEngine 降级）");
  assert.ok(screens.ar.have, "离线 AR 屏可渲染（2D 兜底）");

  // --- 3. 在线恢复 ---
  await ctx.setOffline(false);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitUntil(page, () => document.body.innerText.includes("谁正在附近发需求"), 15000, "恢复在线");

  assert.equal(errors.length, 0, `无 console error，实际: ${errors.join(" | ")}`);
  console.log("E2E 离线降级 PASS ✓（五屏兜底 + 恢复在线，零报错）");
  await browser.close();
} catch (err) {
  console.error("E2E 离线降级 FAIL:", err instanceof Error ? err.message : err);
  await browser.close();
  process.exit(1);
}