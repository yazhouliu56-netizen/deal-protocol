/**
 * E2E: 信任安全加固（真实浏览器，需生产服务）。用法：npm run test:e2e:trust
 *
 * 场景（双 tab）：
 *   1. 进家品类 verified 硬筛（对标 Care.com）：B 未实名 → 家政保洁单不出现在 feed；
 *      实名认证后 → 出现并可接单
 *   2. 举报结果同步（对标 Airtasker 差评修复）：A 举报 B → 管理员裁定"警告" →
 *      A 行程页显示"平台已处理：警告"回执
 *   3. 自动升级（对标 Care 持续监督）：第 2 名受害者对 B 有效举报 → 再次裁定 →
 *      累计 2 次有效 → 自动限流 suspend → B 发布被拒
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

  // --- 0. 清空共享空间 ---
  await pageA.goto(BASE, { waitUntil: "domcontentloaded" });
  await pageA.evaluate(() => {
    try {
      localStorage.removeItem("oto-broadcast-v1");
    } catch {}
  });
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageB.goto(BASE, { waitUntil: "domcontentloaded" });
  await pageB.reload({ waitUntil: "domcontentloaded" });

  // --- 1. A 发布进家需求（家政保洁） ---
  await pageA.getByLabel("首页").click();
  await pageA.getByRole("button", { name: /发出你的需求/ }).click();
  await pageA.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await pageA.waitForTimeout(400);
  const moreBtn = await pageA.getByRole("button", { name: /更多选项/ }).count();
  if (moreBtn) await pageA.getByRole("button", { name: /更多选项/ }).click();
  await pageA.getByLabel("需求品类").fill("家政保洁");
  await pageA.getByLabel("需求时间").fill("明天 10:30");
  await pageA.getByLabel("需求地点").fill("兰山街道 1 公里");
  await pageA.getByLabel("基础预算").fill("80");
  await pageA.getByLabel("定制条件").fill("需要擦窗");
  await pageA.getByRole("button", { name: "＋" }).click();
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  await pageA.getByRole("button", { name: /立即支付/ }).click();
  await waitUntil(
    pageA,
    () => (JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}").state?.waves ?? []).length > 0,
    15000,
    "A 进家门单落库"
  );
  await pageA.waitForTimeout(400);

  // B 未实名 → 进家单不可见（feed 用定制条件指纹判定）
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("首页").click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("需要擦窗") === false,
    8000,
    "未认证 feed 干净"
  );
  const feedPre = await pageB.evaluate(() => document.body.innerText);
  assert.ok(!feedPre.includes("需要擦窗"), "未认证看不到进家门单");

  // B 实名认证 → 单出现且可接
  await pageB.getByLabel("我的", { exact: true }).click();
  await pageB.getByTestId("drawer-entry-system").click(); // P2 抽屉化 IA：能力声明已收纳于「系统设置」抽屉
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("能力声明"),
    20000,
    "能力面板"
  );
  await pageB.getByLabel("能力声明").click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("实名认证模拟"),
    20000,
    "认证开关"
  );
  await pageB.getByLabel("实名认证模拟").click();
  await pageB.waitForTimeout(400);
  // 认证落盘后 reload，让 B 重新读取 A 已发布的 wave（同上下文多 page 不触发 storage 事件）
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("首页").click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("需要擦窗"),
    20000,
    "认证后进家单可见"
  );
  await pageB.getByRole("button", { name: /接单/ }).first().click();
  await pageB.waitForTimeout(400);
  const claimed = await pageB.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}");
    return s?.state?.claims?.[0]?.status
  });
  assert.equal(claimed, "accepted", "认证响应者接单成功");

  // --- 2. 举报结果同步：A 举报 B → 管理员警告 → A 收到回执 ---
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("行程").click();
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("有人接单了"),
    20000,
    "A 见接单"
  );
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("举报对方"),
    20000,
    "A 见举报按钮"
  );
  await pageA.getByRole("button", { name: /举报对方/ }).click();
  await pageA.waitForTimeout(400);

  // 管理员（B 自己开后台）：裁定警告
  const bId = await pageB.evaluate(() => {
    const key = `oto-identity-${window.name || "ssr"}`;
    return JSON.parse(localStorage.getItem(key) || "{}").state?.identity?.id;
  });
  assert.ok(bId, "B 身份 id 存在");
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("我的", { exact: true }).click();
  await pageB.getByTestId("drawer-entry-safety").click(); // 外层安全抽屉
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("安全中心"),
    20000,
    "入口"
  );
  const skBtn1 = pageB.getByRole("button", { name: "安全中心", exact: true });
  await skBtn1.scrollIntoViewIfNeeded();
  await skBtn1.click();
  await pageB.getByRole("button", { name: /平台治理后台/ }).click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("举报队列"),
    20000,
    "队列"
  );
  await pageB.getByRole("button", { name: "警告", exact: true }).first().click();
  await pageB.getByRole("button", { name: /执行裁定/ }).first().click();
  await pageB.waitForTimeout(400);
  const warnState = await pageB.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}");
    return {
      claims: (s?.state?.claims ?? []).length,
      reports: (s?.state?.reports ?? []).length,
    };
  });
  assert.equal(warnState.claims, 1);
  assert.equal(warnState.reports, 1);

  // A 视角：收到"平台已处理：警告"回执
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("行程").click();
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("平台已处理"),
    20000,
    "A 收到处理回执"
  );
  const receipt = await pageA.evaluate(() => document.body.innerText);
  assert.ok(receipt.includes("警告"), "回执含裁定结果");

  // --- 3. 自动升级：第 2 名受害者对 B 举报 → 裁定警告 → 自动限流 ---
  await pageB.evaluate(
    (target) => {
      const s = JSON.parse(
        localStorage.getItem("oto-broadcast-v1") || "{}"
      );
      const victimReport = {
        id: `rep-victim2-${target}-v2`,
        targetId: target,
        targetType: "responder",
        reporterId: "victim-2",
        reason: "harassment",
        detail: "第二名受害者举报",
        at: Date.now(),
        status: "open",
      };
      s.state.reports.push(victimReport);
      localStorage.setItem("oto-broadcast-v1", JSON.stringify(s));
    },
    bId
  );
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("我的", { exact: true }).click();
  await pageB.getByTestId("drawer-entry-safety").click(); // 外层安全抽屉
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("安全中心"),
    20000,
    "入口"
  );
  const skBtn2 = pageB.getByRole("button", { name: "安全中心", exact: true });
  await skBtn2.scrollIntoViewIfNeeded();
  await skBtn2.click();
  await pageB.getByRole("button", { name: /平台治理后台/ }).click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("举报队列"),
    20000,
    "队列"
  );
  // 犯罪受害者举报（最新）→ 警告 → 触发自动限流
  await pageB.getByRole("button", { name: "警告", exact: true }).first().click();
  await pageB.getByRole("button", { name: /执行裁定/ }).first().click();
  await pageB.waitForTimeout(500);
  const auto = await pageB.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}");
    const ban = s?.state?.bans;
    return Object.values(ban ?? {}).slice(0, 1)[0] ?? null;
  });
  assert.ok(auto, "自动处罚落库");
  assert.equal(auto.action, "suspend", "累计 2 次有效举报 → 自动限流 24h");

  // B 再发布 → 被拒（suspend 生效）
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("首页").click();
  await pageB.getByRole("button", { name: /发出你的需求/ }).click();
  await pageB.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await pageB.waitForTimeout(400);
  await pageB.getByLabel("需求品类").fill("拼桌桌游");
  await pageB.getByLabel("需求时间").fill("明天 21:30");
  await pageB.getByLabel("需求地点").fill("万达广场 1 公里");
  await pageB.getByLabel("基础预算").fill("30");
  await pageB.getByRole("button", { name: /广播出去/ }).click();
  await pageB.waitForTimeout(400);
  assert.ok(
    await pageB.evaluate(() =>
      document.body.innerText.includes("发布被拒")
    ),
    "限流中发布被拒"
  );

  console.log("信任加固 E2E：进家硬筛 + 举报回执 + 自动升级 全部通过");
} catch (e) {
  console.error("E2E 失败:", String(e).slice(0, 400));
  failures += 1;
} finally {
  await browser.close();
}

if (failures > 0) process.exit(1);
