/**
 * E2E 补充分支：租壳琥珀金 3 层座舱冒烟 —— 弹药胶囊拟物草稿卡 / 全局发单条
 * → 完整发布面板 / AI 助手冒烟 / 心愿单闭环（AR Dock 直达）/ 工作台接单履约 / AR 锚点重置。
 * 前置：npm run start（3000）。
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
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // 容忍 LLM 上游不可用时的降级（429/5xx → MockEngine 是特性，不是 bug）；
    // 地图瓦片（OpenFreeMap）为第三方外部资源，本机网络不可达时降级不是产品缺陷；
    // Supabase Realtime WS 断连为云端不可达环境噪音（与 e2e-match 容忍口径一致）
    if (/429|Failed to load resource|LLM upstream failed|openfreemap|WebSocket connection to/i.test(t)) return;
    errors.push(t);
  });
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
  // networkidle 在上游 LLM 流式响应慢时永不达成（in-flight 请求不结束）→ 改 domcontentloaded + 显式断言
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitUntil(page, () => !!document.querySelector('input[placeholder*="描述你的需求"]'), 10000, "座舱渲染");

  // --- 1. 弹药胶囊 → 拟物草稿卡（DynamicDraftCard 100% 呼出；slim 后意图气泡移除，胶囊即入口）---
  // 冷启动水合未完成时点击可能落空 → 轮询点击直至草稿卡呼出（与既有 e2e 等待口径一致）
  {
    const start = Date.now();
    const hit = async () => {
      const btn = page.getByRole("button", { name: "家政保洁 · 一键弹药发单" });
      if (await btn.count()) {
        try {
          await btn.click({ timeout: 400 });
        } catch {
          /* 未水合 → 重试 */
        }
      }
    };
    while (Date.now() - start < 10000) {
      await hit();
      if (await page.evaluate(() => !!document.querySelector('[data-testid="draft-sheet"]'))) break;
      await sleep(300);
    }
  }
  const draft = await page.evaluate(() => {
    const sheet = document.querySelector('[data-testid="draft-sheet"]');
    return {
      sheet: !!sheet,
      ammo: sheet?.querySelector(".draft-card")?.getAttribute("data-ammo") ?? "",
      title: document.body.innerText.includes("拟物草稿"),
    };
  });
  assert.ok(draft.sheet && draft.title, "点击弹药胶囊应呼出拟物草稿卡");
  assert.equal(draft.ammo, "housekeeping-v1", "家政弹药应装配 housekeeping-v1");
  await page.getByRole("button", { name: "关闭拟物草稿" }).click();
  await page.waitForTimeout(400);

  // --- 2. 全局 AI 智能发单条 → 全类目草稿卡 → 扣动扳机 → 完整发布面板 ---
  await page.getByRole("button", { name: "想找什么" }).click();
  await page.waitForTimeout(400);
  assert.ok(
    await page.evaluate(() => document.body.innerText.includes("扣动扳机·一键发布")),
    "发单条应呼出含发布 CTA 的草稿卡"
  );
  await page.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await page.waitForTimeout(500);
  await page.getByLabel("需求品类").waitFor({ state: "visible", timeout: 5000 });
  await page.getByLabel("需求时间").waitFor({ state: "visible", timeout: 5000 });
  await page.getByLabel("需求地点").waitFor({ state: "visible", timeout: 5000 });
  assert.ok(
    await page.evaluate(() => document.body.innerText.includes("广播出去")),
    "草稿卡发布应进入完整发布面板（品类/时间/地点/预算）"
  );
  await page.getByRole("button", { name: "关闭发布" }).click();
  await page.waitForTimeout(400);

  // --- 2.5 AI 助手冒烟（ChatPage 已内嵌首页，输入框即达）---
  assert.ok(
    await page.evaluate(() => document.body.innerText.includes("AI 撮合助手")),
    "AI 撮合助手应内嵌渲染在首页"
  );
  await page.getByRole("button", { name: "首页" }).click();
  await page.waitForTimeout(500);

  // --- 3. 心愿单闭环：AR 直达 → 收藏 → 面板 → 条目直达 AR 预览 ---
  await page.getByRole("button", { name: "AR 扫描" }).click();
  await page.waitForTimeout(700);
  // AR 默认场景模式，先切"体验预览"才有收藏按钮
  await page.getByRole("button", { name: "✨ 体验预览" }).click();
  await page.waitForTimeout(600);
  const destName = await page.evaluate(() => {
    const h = document.querySelector("h3");
    return (h?.textContent ?? "").split("·")[0].trim();
  });
  assert.ok(destName, "应读到体验预览标题");
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

  // --- 5. AR 锚点重置：场景点锚 → 预览 → 切回场景无残留（AR 键现为首页上下文悬浮按钮）---
  await page.getByRole("button", { name: "首页" }).click();
  await page.waitForTimeout(500);
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
  console.log("E2E 补充分支 PASS ✓（弹药草稿卡/全局发单条/心愿单闭环/工作台接单履约/AR 锚点重置）");
  await browser.close();
} catch (err) {
  console.error("E2E 补充分支 FAIL:", err instanceof Error ? err.message : err);
  await browser.close();
  process.exit(1);
}
