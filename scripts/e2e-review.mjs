/**
 * E2E: 爽约保障险履约 + 互评闭环双 tab 测试（真实浏览器，需要生产服务在 localhost:3000）。
 * 用法：npm run test:e2e:review （需先 `npm run start`）
 *
 * 场景：双 tab 双身份 ——
 *   Tab A 发布"宠物代遛 + 爽约保障险"信号波（无磋商）
 *   Tab B 直接接单 → 押金冻结（100 → 95）
 *   Tab A 确认履约 → 押金解冻退回（B 95 → 99.5，含平台服务费 0.5）
 *   A 评价 B（三维全 5）→ B 信用 Lv 3 → 5
 *   B 评价 A（三维全 4）→ A 信用 Lv 3 → 4（额度扩容提示）
 *   双方脱敏展示（时间衰减标签）
 */
import { chromium } from "playwright-core";
import { isolateBrowserChannels, resetE2eChannelRow } from "./lib/e2e-channel.mjs";
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

// 广播命名空间隔离：该浏览器所有 context/page 物理锁定本脚本专属通道
isolateBrowserChannels(browser, "review", { forceLocal: true });

let failures = 0;

try {
  // 自清零：覆盖本脚本专属云行为空 state（跨脚本/跨轮次污染根治）
  await resetE2eChannelRow("review");
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
      localStorage.removeItem("oto-broadcast-v1::oto::e2e::review");
    } catch {}
  });
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageB.goto(BASE, { waitUntil: "domcontentloaded" });

  // --- 2. Tab A 发布（含爽约保障险，无磋商 → 直接接单） ---
  await pageA.getByRole("button", { name: /发出你的需求/ }).click();
  await pageA.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await pageA.waitForTimeout(400);
  const moreBtn = await pageA.getByRole("button", { name: /更多选项/ }).count();
  if (moreBtn) await pageA.getByRole("button", { name: /更多选项/ }).click();
  await pageA.getByLabel("需求品类").fill("宠物代遛");
  await pageA.getByLabel("需求时间").fill("明天 19:00");
  await pageA.getByLabel("需求地点").fill("幸福家园小区");
  await pageA.getByLabel("基础预算").fill("60");
  await pageA.getByLabel("开启爽约保障险").click();
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  await pageA.getByRole("button", { name: /立即支付/ }).click();
  await pageA.waitForTimeout(500);

  // --- 3. Tab B 直接接单（默认推荐价，留空 = 直接接单） ---
  await pageB.reload({ waitUntil: "domcontentloaded" });
  // 品类硬筛：B 默认品类不含"宠物代遛" → 先加自定义品类
  await pageB.getByLabel("我的", { exact: true }).click();
  await pageB.getByTestId("drawer-entry-system").click(); // P2 抽屉化 IA：能力声明已收纳于「系统设置」抽屉
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("能力声明"),
    10000,
    "B 能力面板"
  );
  await pageB.getByLabel("能力声明").click();
  await pageB.getByLabel("自定义品类").fill("宠物代遛");
  await pageB.getByLabel("添加品类").click();
  await pageB.getByLabel("首页").click();
  await pageB.waitForTimeout(400);
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("宠物代遛"),
    10000,
    "Tab B 收到广播"
  );
  await pageB.getByRole("button", { name: /接单/ }).first().click();
  await pageB.waitForTimeout(500);

  const sharedLock = await pageB.evaluate(() =>
    JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::review") || "{}")
  );
  assert.equal(sharedLock?.state?.claims?.[0]?.status, "accepted");
  assert.equal(sharedLock?.state?.claims?.[0]?.depositPhase, "held");
  assert.equal(sharedLock?.state?.waves?.[0]?.status, "claimed");

  // --- 4. B 押金冻结（本地账户 100 → 95） ---
  const idKeyB = await pageB.evaluate(
    () => `oto-identity-${window.name || "ssr"}`
  );
  await pageB.getByLabel("我的", { exact: true }).click();
  await waitUntil(
    pageB,
    () => {
      const s = JSON.parse(
        localStorage.getItem(`oto-identity-${window.name || "ssr"}`) || "{}"
      );
      return (s?.state?.deposits ?? []).some((d) => d.phase === "held");
    },
    10000,
    "B 押金冻结"
  );
  const heldB = await pageB.evaluate((k) =>
    JSON.parse(localStorage.getItem(k) || "{}"), idKeyB
  );
  assert.equal(heldB?.state?.account?.balance, 95);

  // --- 5. 双端验收：B 申报完成 → A 验收（凭证）→ 押金解冻退回（95 → 99.5） ---
  // Airtasker 规则：A 的放款闸门由 B 的"请求放款"打开
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("行程").click();
  await waitUntil(
    pageA,
    () =>
      document.body.textContent?.includes("有人接单了") &&
      document.body.textContent?.includes("等待服务方申报完成"),
    10000,
    "A 看到接单（等待申报，无验收按钮）"
  );
  assert.equal(
    await pageA.getByRole("button", { name: /确认验收/ }).count(),
    0,
    "未申报前 A 无法验收放款（Airtasker 闸门）"
  );

  // B 侧：申报完成 · 请求放款
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("我的", { exact: true }).click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("服务完成 · 请求放款"),
    10000,
    "B 看到申报按钮"
  );
  await pageB.getByLabel("申报完成").click();
  await pageB.waitForTimeout(400);

  // A 侧：验收卡出现（凭证必填 + 72h 自动放款提示）
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("行程").click();
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("服务方已申报完成"),
    10000,
    "A 看到验收卡"
  );
  await pageA.getByLabel("验收凭证").fill("上门做完，餐桌布置完毕");
  await pageA.getByRole("button", { name: /确认验收/ }).click();
  await pageA.waitForTimeout(500);
  const sharedFulfilled = await pageA.evaluate(() =>
    JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::review") || "{}")
  );
  assert.equal(
    sharedFulfilled?.state?.claims?.[0]?.depositPhase,
    "confirmed",
    "履约后押金 phase → confirmed"
  );
  assert.ok(
    sharedFulfilled?.state?.claims?.[0]?.fulfilledAt > 0,
    "履约时间戳已记录（72h 评价窗口起点）"
  );

  // B 侧解冻：reload 后进"我的"触发幂等账务
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("我的", { exact: true }).click();
  await pageB.waitForTimeout(600);
  const releasedB = await pageB.evaluate((k) =>
    JSON.parse(localStorage.getItem(k) || "{}"), idKeyB
  );
  assert.equal(
    releasedB?.state?.account?.balance,
    99.5,
    "押金解冻退回（含平台服务费 0.5）"
  );
  assert.ok(
    (releasedB?.state?.deposits ?? []).some((d) => d.phase === "confirmed"),
    "B 押金记录终态 confirmed"
  );

  // --- 6. A 评价 B（三维全 5 → score 5.0） ---
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("评价对方"),
    10000,
    "A 看到互评入口"
  );
  await pageA.getByRole("button", { name: /评价对方/ }).click();
  await pageA.getByLabel("评价留言").fill("很准时，态度很好，专业");
  await pageA.getByRole("button", { name: /提交评价/ }).click();
  await pageA.waitForTimeout(500);

  // --- 7. B 评价 A（三维全 4 → score 4.0） ---
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("我的", { exact: true }).click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("评价对方"),
    10000,
    "B 看到互评入口"
  );
  await pageB.getByRole("button", { name: /评价对方/ }).first().click();
  await pageB.getByRole("button", { name: /准时4分/ }).click();
  await pageB.getByRole("button", { name: /态度4分/ }).click();
  await pageB.getByRole("button", { name: /专业度4分/ }).click();
  await pageB.getByRole("button", { name: /提交评价/ }).click();
  await pageB.waitForTimeout(500);

  const sharedReviews = await pageB.evaluate(() =>
    JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::review") || "{}")
  );
  assert.equal(
    (sharedReviews?.state?.reviews ?? []).length,
    2,
    "双方互评落库"
  );
  assert.equal(
    (sharedReviews?.state?.claims?.[0]?.reviewedBy ?? []).length,
    2,
    "claim 双方均已评价（幂等）"
  );

  // --- 8. 信用由评价驱动：B Lv5 / A Lv4 + 脱敏展示 ---
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("我的", { exact: true }).click();
  await pageB.waitForTimeout(600);
  const creditB = await pageB.evaluate((k) =>
    JSON.parse(localStorage.getItem(k) || "{}"), idKeyB
  );
  assert.equal(creditB?.state?.creditTier, 5, "A 的 5.0 好评 → B 信用 Lv5");
  assert.ok(
    await pageB.evaluate(() =>
      document.body.innerText.includes("收到的评价（脱敏）")
    ),
    "B 看到脱敏评价列表"
  );

  const idKeyA = await pageA.evaluate(
    () => `oto-identity-${window.name || "ssr"}`
  );
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("我的", { exact: true }).click();
  await pageA.waitForTimeout(600);
  const creditA = await pageA.evaluate((k) =>
    JSON.parse(localStorage.getItem(k) || "{}"), idKeyA
  );
  assert.equal(creditA?.state?.creditTier, 4, "B 的 4.0 评价 → A 信用 Lv4");
  assert.ok(
    await pageA.evaluate(() =>
      document.body.innerText.includes("解锁响应额度扩容")
    ),
    "Lv4 解锁额度扩容提示"
  );
  assert.ok(
    await pageA.evaluate(() =>
      document.body.innerText.includes("1 周前")
    ),
    "评价带时间衰减标签（脱敏）"
  );

  console.log("爽约保障险履约 + 互评闭环 E2E：全部通过");
} catch (e) {
  console.error("E2E 失败:", String(e).slice(0, 500));
  failures += 1;
} finally {
  await browser.close();
}

if (failures > 0) process.exit(1);
