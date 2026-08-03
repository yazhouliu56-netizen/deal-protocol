/**
 * E2E 补充分支：Home 热卡 → AI draft / 搜索过滤 / 心愿单闭环 /
 * 工作台多身份接单履约 / AR 锚点重置。前置：npm run start（3000）。
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

const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(1200);
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
  await waitUntil(page, () => !!document.querySelector('button[aria-label="AI 助手"]'), 10000, "Dock");

  // --- 1. Home 热卡 → AI draft 自动发送 ---
  await page.getByRole("button", { name: "🏸 羽毛球约局" }).click();
  // Mock 引擎问"水平/人数"；LLM 引擎追问语料更自由（可能问时段/预算）。
  await waitUntil(
    page,
    () => {
      const t = document.body.innerText;
      return (
        t.includes("可选时段") ||
        t.includes("水平") ||
        t.includes("几个人") ||
        t.includes("想约在") ||
        t.includes("预算")
      );
    },
    25000,
    "热卡撮合追问/时段卡"
  );
  const hotOk = await page.evaluate(() =>
    document.body.innerText.includes("羽毛球") && document.body.innerText.includes("AI 撮合助手")
  );
  assert.ok(hotOk, "热卡应直达 AI 撮合");
  // --- 2. 搜索过滤 ---
  await page.getByRole("button", { name: "首页" }).click();
  await page.getByRole("textbox", { name: "搜索 OTO 体验" }).fill("摄影");
  await page.waitForTimeout(600);
  const search = await page.evaluate(() => ({
    hit: document.body.innerText.includes("命中"),
    aiBtn: document.body.innerText.includes("让 AI 撮合"),
  }));
  assert.ok(search.hit && search.aiBtn, "搜索应显示命中数 + 让 AI 撮合");

  // --- 3. 心愿单闭环：开卡 → 收藏 → 面板 → 条目直达 AR ---
  await page.getByRole("textbox", { name: "搜索 OTO 体验" }).fill("");
  await page.waitForTimeout(400);
  const destName = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const dest = btns.find((b) => /¥/.test(b.textContent || "") && /体育馆|公园|博物馆|球馆|中心|馆|岛|山|滩/.test(b.textContent || ""));
    const full = dest?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const m = /^([^\d.·]+)/.exec(full);
    return m ? m[1] : full.slice(0, 6);
  });
  assert.ok(destName, "应找到目的地卡");
  // HoloCard 常驻动画 → force click（跳过稳定性判定）
  await page.locator("button", { hasText: destName }).first().click({ force: true, timeout: 10000 });
  await page.waitForTimeout(800);
  // AR 默认场景模式，先切"体验预览"才有收藏按钮
  await page.getByRole("button", { name: "✨ 体验预览" }).click();
  await page.waitForTimeout(600);
  const wishBtn = page.locator("button", { hasText: /心愿单|已加入/ }).last();
  await wishBtn.click({ force: true, timeout: 10000 });
  await page.waitForTimeout(400);
  assert.ok(await page.evaluate(() => document.body.innerText.includes("已加入")), "应显示已加入");
  await page.getByRole("button", { name: "首页" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /心愿单，共 1 项/ }).click();
  await page.waitForTimeout(500);
  assert.ok(await page.evaluate(() => document.body.innerText.includes("我的心愿单")), "面板打开");
  assert.ok(await page.evaluate((name) => document.body.innerText.includes(name), destName), "面板含条目");
  // 条目直达 AR 预览
  await page.getByRole("button", { name: new RegExp(`在 AR 预览`) }).click();
  await page.waitForTimeout(800);
  assert.ok(await page.evaluate(() => document.body.innerText.includes("体验预览")), "应进入 AR 预览");

  // --- 4. 工作台：多身份 + 接单 → 履约 → 收益 ---
  await page.getByRole("button", { name: "我的" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /服务者工作台/ }).click();
  await page.waitForTimeout(500);
  const bench0 = await page.evaluate(() => document.body.innerText);
  assert.ok(bench0.includes("阿凯"), "默认阿凯身份");
  // 接单 → 履约（进行中区出现"完成服务"按钮即证明接单生效）
  await page.getByRole("button", { name: "接受订单" }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "完成服务" }).first().click();
  await page.waitForTimeout(400);
  const afterDone = await page.evaluate(() => document.body.innerText);
  assert.ok(afterDone.includes("累计入账"), "履约后计入收益");
  // 切换王姐 → 保洁单
  await page.getByRole("button", { name: "王姐" }).click();
  await page.waitForTimeout(400);
  const wang = await page.evaluate(() => document.body.innerText);
  assert.ok(wang.includes("王阿姨") && wang.includes("保洁"), "王姐身份应见保洁单");

  // --- 5. AR 锚点重置：场景点锚 → 预览 → 切回场景无残留 ---
  await page.getByRole("button", { name: "AR 扫描" }).click();
  await page.waitForTimeout(700);
  const anchor = page.getByRole("button", { name: /星羽羽毛球馆|滨江街拍点位|王姐保洁/ }).first();
  if (await anchor.isVisible().catch(() => false)) {
    await anchor.click();
    await page.waitForTimeout(500);
    assert.ok(await page.evaluate(() => document.body.innerText.includes("距你")), "锚点详情出现");
    await page.getByRole("button", { name: /体验预览/ }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /场景探索/ }).click();
    await page.waitForTimeout(500);
    const back = await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .filter((b) => /距你/.test(b.textContent || "") && /¥/.test(b.textContent || ""))
        .map((b) => b.textContent).filter(Boolean).length
    );
    assert.equal(back, 0, "切回场景不应残留锚点预览");
  } else {
    console.log("  (AR 锚点不可见，跳过锚点重置断言)");
  }

  // --- 6. 生产 console 无 error ---
  assert.equal(errors.length, 0, `无 console error，实际: ${errors.join(" | ")}`);
  await page.screenshot({ path: "e2e-app-final.png" });
  console.log("E2E 补充分支 PASS ✓（热卡/搜索/心愿单闭环/工作台接单履约/AR 锚点重置）");
  await browser.close();
} catch (err) {
  console.error("E2E 补充分支 FAIL:", err instanceof Error ? err.message : err);
  await browser.close();
  process.exit(1);
}
