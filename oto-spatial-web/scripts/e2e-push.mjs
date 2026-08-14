/**
 * E2E: LLM 聚类推送 + 一键接单（真实浏览器，需要生产服务在 localhost:3000）。
 * 用法：npm run test:e2e:push （需先 `npm run start`）
 *
 * 场景：双 tab 双身份 ——
 *   Tab A 发布"厨师上门做饭 + 定制 30 岁女性 + 磋商留言"
 *   Tab B（声明了厨师能力 + 在线）→ 雷达收件箱收到聚类推送（适配理由）
 *   B 一键接单 → wave claimed、B 余额押金冻结、推送已读
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

let failures = 0;

try {
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

  // --- 1. 清空共享广播空间（独立起点） ---
  await pageA.goto(BASE, { waitUntil: "domcontentloaded" });
  await pageA.evaluate(() => {
    try {
      localStorage.removeItem("oto-broadcast-v1");
    } catch {}
  });
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageB.goto(BASE, { waitUntil: "domcontentloaded" });

  // --- 2. Tab B 已默认声明全品类能力（含厨师）；补充兴趣标签（聚类基础） ---
  await pageB.getByLabel("我的", { exact: true }).click();
  await pageB.getByLabel("能力声明").click();
  await pageB.waitForTimeout(300);
  await pageB.getByLabel("实名认证模拟").click(); // 进家品类硬门槛
  await pageB.getByRole("textbox", { name: "添加标签" }).fill("生日");
  await pageB.getByRole("button", { name: "添加标签" }).click();
  await pageB.waitForTimeout(400);

  const responders = await pageB.evaluate(() =>
    JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}")
  );
  assert.ok(
    (responders?.state?.responders ?? []).some(
      (r) => r.categories?.includes("厨师 · 上门做饭")
    ),
    "B 的能力声明已入共享空间"
  );

  // --- 3. Tab A 发布需求（触发 LLM 聚类推送） ---
  await pageA.getByLabel("首页").click();
  await pageA.getByRole("button", { name: /发出你的需求/ }).click();
  await pageA.waitForTimeout(400);
  const moreBtn = await pageA.getByRole("button", { name: /更多选项/ }).count();
  if (moreBtn) await pageA.getByRole("button", { name: /更多选项/ }).click();
  await pageA.getByLabel("需求品类").fill("厨师 · 上门做饭");
  await pageA.getByLabel("需求时间").fill("明天 18:00");
  await pageA.getByLabel("需求地点").fill("附近 2 公里");
  await pageA.getByLabel("基础预算").fill("100");
  await pageA.getByLabel("定制条件").fill("30 岁左右女性");
  await pageA.getByRole("button", { name: "＋" }).click();
  await pageA.getByLabel("磋商留言（可留空）").fill("生日宴，上门做饭");
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  await pageA.getByRole("button", { name: /立即支付/ }).click();
  await pageA.waitForTimeout(800);

  // --- 4. Tab B 雷达收到聚类推送（展开 → 适配理由 + 标签） ---
  // Playwright 多 page 不触发 storage 事件 → reload 等效"另一设备收到广播"
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("首页").click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("雷达") && document.body.textContent?.includes("适配推送"),
    10000,
    "B 看到雷达推送入口"
  );
  await pageB.getByLabel("雷达推送").click();
  await pageB.waitForTimeout(400);
  // 推送卡片渲染（适配理由恒存在；真实 LLM 下标签内容允许变化）
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("适配"),
    10000,
    "推送卡片含适配理由"
  );
  const pushState = await pageB.evaluate(() =>
    JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}")
  );
  const myPushes = (pushState?.state?.pushes ?? []).filter(
    (p) => p.toId !== undefined && !p.read
  );
  assert.ok(myPushes.length >= 1, "共享空间应有未读推送");
  assert.ok(myPushes[0].reason.includes("命中标签"), "推送带适配理由");
  if (myPushes[0].reason.includes("命中标签")) {
    assert.ok(myPushes[0].reason.includes("距离"), "适配理由含距离");
  }

  // --- 5. B 一键接单 → wave claimed + 推送已读 ---
  // 展开动画可能让按钮视觉隐藏 → 原生 click（验证链路而非动画）
  await pageB.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      x.textContent?.includes("一键接单")
    );
    if (b) b.click();
    return !!b;
  });
  await pageB.waitForTimeout(800);

  const after = await pageB.evaluate(() =>
    JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}")
  );
  assert.ok(
    (after?.state?.claims ?? []).some(
      (c) => c.waveId === after?.state?.waves?.[0]?.id && c.status === "negotiating"
    ),
    "一键接单生成进行中的磋商 claim（P2 交替制）"
  );
  assert.ok(
    (after?.state?.pushes ?? []).every((p) => p.read === true),
    "接单后推送全部已读"
  );

  console.log("LLM 聚类推送 + 一键接单 E2E：全部通过");
} catch (e) {
  console.error("E2E 失败:", String(e).slice(0, 500));
  failures += 1;
} finally {
  await browser.close();
}

if (failures > 0) process.exit(1);
