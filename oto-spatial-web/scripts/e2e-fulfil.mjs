/**
 * E2E: 履约验收闭环 + 服务商星级成长（真实浏览器，需生产服务）。用法：npm run test:e2e:fulfil
 *
 * 场景（双 tab 双身份）：
 *   A 发布含险需求 → B 接单（押金 held）→ B 申报完成（请求放款）
 *   → A 验收（凭证）→ 押金解冻 confirmed + 72h 评价窗口开启
 *   → A 评 B 五星 → B 星级/完成率上升 → 能力面板显示 ★与服务商星级
 *   → 反推：改造"验收凭证"为必填，空凭证按钮禁用
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

  // --- 1. 清空共享空间（独立起点） ---
  await pageA.goto(BASE, { waitUntil: "domcontentloaded" });
  await pageA.evaluate(() => {
    try {
      localStorage.removeItem("oto-broadcast-v1");
    } catch {}
  });
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageB.goto(BASE, { waitUntil: "domcontentloaded" });
  await pageB.reload({ waitUntil: "domcontentloaded" });

  // --- 2. A 发布含险需求（押金 5） ---
  await pageA.getByLabel("首页").click();
  await pageA.getByRole("button", { name: /发出你的需求/ }).click();
  await pageA.waitForTimeout(400);
  await pageA.getByLabel("需求品类").fill("厨师 · 上门做饭");
  await pageA.getByLabel("需求时间").fill("明天 18:00");
  await pageA.getByLabel("需求地点").fill("幸福家园 1 公里");
  await pageA.getByLabel("基础预算").fill("100");
  await pageA.getByLabel("定制条件").fill("家宴");
  await pageA.getByRole("button", { name: "＋" }).click();
  await pageA.getByLabel("开启鸽子险").click(); // 含险
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  await pageA.getByRole("button", { name: /立即支付/ }).click();

  // --- 3. B 接单（进家品类 → 先实名认证）→ 押金冻结 ---
  await pageB.getByLabel("我的").click();
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
  await pageB.waitForTimeout(800);
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("谁正在附近发需求"),
    10000,
    "B 首页挂载"
  );
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("厨师 · 上门做饭"),
    10000,
    "B 收到广播"
  );
  await pageB.getByRole("button", { name: /接单/ }).first().click();
  await pageB.waitForTimeout(500);
  const locked = await pageB.evaluate(() =>
    JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}")
  );
  assert.equal(locked?.state?.claims?.[0]?.depositPhase, "held");

  // B 进"我的"触发押金冻结账务（幂等）
  const idKeyB = await pageB.evaluate(
    () => `oto-identity-${window.name || "ssr"}`
  );
  await pageB.getByLabel("我的").click();
  await waitUntil(
    pageB,
    () =>
      (JSON.parse(
        localStorage.getItem(`oto-identity-${window.name || "ssr"}`) || "{}"
      )?.state?.deposits ?? []).some((d) => d.phase === "held"),
    10000,
    "B 押金冻结"
  );
  const heldB = await pageB.evaluate(
    (k) => JSON.parse(localStorage.getItem(k) || "{}").state?.account?.balance,
    idKeyB
  );
  assert.equal(heldB, 95, "B 押金冻结 100 → 95");

  // --- 4. A：未申报前不能验收（Airtasker 放款闸门） ---
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("在线 · 正在接收信号"),
    10000,
    "A reload 挂载"
  );
  await waitUntil(
    pageA,
    () => Array.from(document.querySelectorAll("button")).some(b => b.textContent?.includes("行程")),
    5000,
    "A 行程按钮就绪"
  );
  await pageA.getByLabel("行程").click();
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("我的 OTO 之旅"),
    10000,
    "A 行程页挂载"
  );
  await waitUntil(
    pageA,
    () =>
      document.body.textContent?.includes("有人接单了") &&
      document.body.textContent?.includes("等待服务方申报完成"),
    10000,
    "A 等申报"
  );
  assert.equal(
    await pageA.getByRole("button", { name: /确认验收/ }).count(),
    0,
    "未申报前无验收放款按钮"
  );

  // --- 5. B 申报完成（请求放款）→ A 验收（凭证必填） ---
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("我的").click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("服务完成 · 请求放款"),
    10000,
    "B 见申报按钮"
  );
  await pageB.getByLabel("申报完成").click();
  await pageB.waitForTimeout(400);

  await pageA.reload({ waitUntil: "domcontentloaded" });
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("在线 · 正在接收信号"),
    10000,
    "A reload 挂载 2"
  );
  await waitUntil(
    pageA,
    () => Array.from(document.querySelectorAll("button")).some(b => b.textContent?.includes("行程")),
    5000,
    "A 行程按钮就绪 2"
  );
  await pageA.getByLabel("行程").click();
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("我的 OTO 之旅"),
    10000,
    "A 行程页挂载 2"
  );
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("服务方已申报完成"),
    10000,
    "A 见验收卡"
  );
  // 空凭证 → 按钮不生效
  await pageA.getByRole("button", { name: /确认验收/ }).click();
  await pageA.waitForTimeout(300);
  const stillHeld = await pageA.evaluate(() =>
    JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}")
  );
  assert.equal(
    stillHeld?.state?.claims?.[0]?.depositPhase,
    "held",
    "空凭证不触发验收"
  );
  // 填写凭证 → 确认验收
  await pageA.getByLabel("验收凭证").fill("家宴做完，碗筷收拾干净");
  await pageA.getByRole("button", { name: /确认验收/ }).click();
  await pageA.waitForTimeout(500);
  const fulfilled = await pageA.evaluate(() =>
    JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}")
  );
  assert.equal(fulfilled?.state?.claims?.[0]?.depositPhase, "confirmed");
  assert.ok(fulfilled?.state?.claims?.[0]?.fulfilledAt > 0, "评价窗口开启");
  assert.ok(
    fulfilled?.state?.claims?.[0]?.fulfilment?.confirmedBy === "demander"
  );
  assert.ok(
    (fulfilled?.state?.claims?.[0]?.fulfilment?.note ?? "").includes("家宴"),
    "验收凭证落库"
  );

  // --- 6. B 押金解冻退回（95 → 99.5，平台费 0.5） ---
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("我的").click();
  await waitUntil(
    pageB,
    () => {
      const k = `oto-identity-${window.name || "ssr"}`;
      return (
        (JSON.parse(localStorage.getItem(k) || "{}").state?.account
          ?.balance ?? 0) >= 99.5
      );
    },
    10000,
    "B 押金解冻"
  );
  const afterB = await pageB.evaluate(
    (k) => JSON.parse(localStorage.getItem(k) || "{}").state?.account?.balance,
    idKeyB
  );
  assert.equal(afterB, 99.5, "95 + 4.5（解冻）→ 99.5");

  // --- 7. A 评 B 五星 → B 星级上升（能力面板展示） ---
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("行程").click();
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("评价对方"),
    10000,
    "A 见评价入口"
  );
  await pageA.getByRole("button", { name: /评价对方/ }).first().click();
  await pageA.waitForTimeout(400);
  // 三维全 5 + 提交
  await pageA.getByRole("button", { name: /准时5分/ }).click();
  await pageA.getByRole("button", { name: /态度5分/ }).click();
  await pageA.getByRole("button", { name: /专业度5分/ }).click();
  await pageA.getByRole("button", { name: /提交评价/ }).click();
  await pageA.waitForTimeout(500);

  // B 侧：能力面板出现 ★ 星级
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("我的").click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("完成率 100%"),
    10000,
    "B 见星级标签"
  );
  const starText = await pageB.evaluate(() => {
    const el = document.querySelector('[aria-label="服务商星级"]');
    return el?.textContent ?? "";
  });
  assert.ok(starText.includes("★★★★★"), `五星展示，实际: ${starText}`);
  assert.ok(starText.includes("完成率 100%"), `完成率展示，实际: ${starText}`);

  console.log("履约验收闭环 + 星级成长 E2E：全部通过");
} catch (e) {
  console.error("E2E 失败:", String(e).slice(0, 400));
  failures += 1;
} finally {
  await browser.close();
}

if (failures > 0) process.exit(1);