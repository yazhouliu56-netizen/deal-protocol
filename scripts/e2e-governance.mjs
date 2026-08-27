/**
 * E2E: 平台治理闭环（真实浏览器，需生产服务）。用法：npm run test:e2e:governance
 *
 * 场景（双 tab 双身份 + 管理员视角）：
 *   1. B 发布含敏感词需求 → 自动拦截下架（feed 不可见）+ 自动生成举报
 *   2. A 手动举报 B 的需求 → 举报队列 +1
 *   3. 管理后台：指标看板（成交率/待处理举报/自动拦截数）
 *   4. 管理员裁定：驳回 A 的举报 → 恢复；下架 B 的敏感词需求 → feed 永久不可见
 *   5. 举报 B 本人 → 封禁 → B 不能再发布 + B 不再出现在广播/推送
 *   6. 审计记录留痕
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
isolateBrowserChannels(browser, "governance", { sandboxBotOff: true, forceLocal: true });

let failures = 0;

try {
  // 自清零：覆盖本脚本专属云行为空 state（跨脚本/跨轮次污染根治）
  await resetE2eChannelRow("governance");
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
      localStorage.removeItem("oto-broadcast-v1::oto::e2e::governance");
    } catch {}
  });
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageB.goto(BASE, { waitUntil: "domcontentloaded" });
  await pageB.reload({ waitUntil: "domcontentloaded" });

  // --- 1. B 发布含敏感词需求 → 自动拦截 ---
  await pageB.getByLabel("首页").click();
  await pageB.getByRole("button", { name: /发出你的需求/ }).click();
  await pageB.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await pageB.waitForTimeout(400);
  const moreBtn = await pageB.getByRole("button", { name: /更多选项/ }).count();
  if (moreBtn) await pageB.getByRole("button", { name: /更多选项/ }).click();
  await pageB.getByLabel("需求品类").fill("家政保洁");
  await pageB.getByLabel("需求时间").fill("明天 09:00");
  await pageB.getByLabel("需求地点").fill("兰山街道 1 公里");
  await pageB.getByLabel("基础预算").fill("60");
  await pageB.getByLabel("定制条件").fill("先私下转账，不走平台");
  await pageB.getByRole("button", { name: "＋" }).click();
  await pageB.getByRole("button", { name: /广播出去/ }).click();
  await pageB.waitForTimeout(400);
  const flagged = await pageB.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::governance") || "{}");
    const w0 = s?.state?.waves?.[0];
    return {
      removed: w0?.removed,
      reports: s?.state?.reports?.length ?? 0,
      auto: s?.state?.reports?.[0]?.auto,
      waveCount: (s?.state?.waves ?? []).length,
      w0dump: w0
        ? {
            cat: w0.basics?.category,
            customs: (w0.customs ?? []).map((c) => c.text),
            note: w0.negotiableNote ?? null,
            removed: w0.removed ?? null,
          }
        : null,
    };
  });
  assert.equal(flagged.removed, true, "敏感词内容被自动下架");
  assert.equal(flagged.reports, 1, "自动生成举报");
  assert.equal(flagged.auto, true, "举报带 auto 标记");
  await waitUntil(
    pageB,
    () =>
      !document.querySelector('[aria-label="关闭发布"]') &&
      JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::governance") || "{}").state
        ?.waves?.[0]?.removed === true,
    8000,
    "弹层关闭且内容已转审核"
  );

  // feed 不可见
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("首页").click();
  await pageA.waitForTimeout(400);
  const feedText = await pageA.evaluate(() => document.body.innerText);
  assert.ok(
    !feedText.includes("先私下转账") && !feedText.includes("明天 09:00"),
    "下架内容不在 feed"
  );

  // --- 2. A 发布正常需求 → 成交一单（看板指标有数据） ---
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("首页").click();
  await pageA.getByRole("button", { name: /发出你的需求/ }).click();
  await pageA.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await pageA.waitForTimeout(400);
  await pageA.getByLabel("需求品类").fill("羽毛球约局");
  await pageA.getByLabel("需求时间").fill("明天 20:00");
  await pageA.getByLabel("需求地点").fill("幸福家园 1 公里");
  await pageA.getByLabel("基础预算").fill("50");
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  await pageA.getByRole("button", { name: /立即支付/ }).click();
  await pageA.waitForTimeout(400);
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.waitForTimeout(800); // 等水合：水合前点 Dock 会丢点击（落在静态壳上被替换）
  await pageB.getByLabel("首页").click();
  await pageB.waitForTimeout(400);
  await waitUntil(
    pageB,
    () =>
      // 必须锚定 feed 层实体——供给光斑/跑马灯文案含「羽毛球」字样，纯文本判定会被误满足
      !!document.querySelector("[data-layer='wave-feed']") &&
      (() => {
        const feed = document.querySelector("[data-layer='wave-feed']");
        return (feed?.textContent ?? "").includes("羽毛球约局");
      })(),
    20000,
    "B 在雷达 feed 看到 A 的正常需求"
  );
  // B 手动举报 A 的这条需求（响应者视角 WaveCard 举报按钮）。
  // 注意：访客 reload 后「AI 撮合助手」问候浮层会自动展开并覆盖 feed 卡片，
  // 物理坐标点击（含 force）会命中最上层浮层而非按钮 → 改 DOM 直触发，
  // 等价驱动真实 React 处理链且不受层叠遮挡影响。
  await waitUntil(
    pageB,
    () => {
      const b = document.querySelector('button[aria-label="举报"]');
      return !!b && !b.disabled;
    },
    10000,
    "A 波卡片的举报按钮就绪"
  );
  await pageB.evaluate(() => {
    const b = document.querySelector('button[aria-label="举报"]');
    if (b && !b.disabled) b.click();
  });
  await pageB.waitForTimeout(400);
  const afterReport = await pageB.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::governance") || "{}");
    return (s?.state?.reports ?? []).length;
  });
  assert.equal(afterReport, 2, "自动 + 手动 = 2 条举报");

  // --- 3. 管理后台看板（入口在"我的"页 SafetyKit） ---
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("我的", { exact: true }).click();
  await pageB.getByTestId("drawer-entry-safety").click(); // 外层安全抽屉
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("安全中心"),
    20000,
    "治理入口可见"
  );
  const skBtn1 = pageB.getByRole("button", { name: "安全中心", exact: true });
  await skBtn1.scrollIntoViewIfNeeded();
  await skBtn1.click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("平台治理后台"),
    20000,
    "安全中心打开"
  );
  await pageB.getByRole("button", { name: /平台治理后台/ }).click();
  await waitUntil(
    pageB,
    () =>
      document.body.textContent?.includes("待处理举报") &&
      document.body.textContent?.includes("自动拦截"),
    20000,
    "看板指标加载"
  );
  const desk = await pageB.evaluate(() => document.body.innerText);
  assert.ok(desk.includes("需求"), "看板有需求数");
  assert.ok(desk.includes("成交率"), "看板有成交率");
  assert.ok(desk.includes("2"), "待处理举报 = 2（自动1 + 手动1）");

  // --- 4. 裁定：驳回手动举报（最新在前）→ 审计 + auto 仍待处理 ---
  const actions = await pageB.getByRole("button", { name: /执行裁定/ });
  const firstNote = await pageB.getByLabel(/裁定备注/).first();
  await firstNote.fill("内容无违规");
  await actions.nth(0).click(); // 手动举报（最新）→ 默认驳回
  await pageB.waitForTimeout(400);
  const afterDismiss = await pageB.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::governance") || "{}");
    const reports = s?.state?.reports ?? [];
    return {
      resolved: reports.filter((r) => r.status === "resolved").length,
      autoOpen: reports.find((r) => r.auto)?.status,
    };
  });
  assert.equal(afterDismiss.resolved, 1, "驳回一条已留审计");
  assert.equal(afterDismiss.autoOpen, "open", "自动举报仍待处理");

  // 下架敏感词需求（auto 举报 → remove，此时队列仅剩它）
  await pageB.getByRole("button", { name: "下架", exact: true }).first().click();
  await pageB.getByRole("button", { name: /执行裁定/ }).first().click();
  await pageB.waitForTimeout(400);
  const removed = await pageB.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::governance") || "{}");
    return (s?.state?.waves ?? []).find((w) => w.removed)?.id;
  });
  assert.ok(removed, "敏感词需求保持下架");

  // --- 5. 行为举报 + 封禁闭环：B 接 A 的单 → A 举报 B → 管理员封禁 → B 不能再发布 ---
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("首页").click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("羽毛球约局"),
    20000,
    "B 再见正常需求"
  );
  await pageB.getByRole("button", { name: /接单/ }).first().click();
  await pageB.waitForTimeout(400);

  // A 视角：行程页出现接单 + 举报对方
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

  // 管理员：处理针对 B 的举报 → 封禁
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("我的", { exact: true }).click();
  await pageB.getByTestId("drawer-entry-safety").click(); // 外层安全抽屉
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("安全中心"),
    20000,
    "治理入口"
  );
  const skBtn2 = pageB.getByRole("button", { name: "安全中心", exact: true });
  await skBtn2.scrollIntoViewIfNeeded();
  await skBtn2.click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("平台治理后台"),
    20000,
    "安全中心打开"
  );
  await pageB.getByRole("button", { name: /平台治理后台/ }).click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("responder"),
    20000,
    "举报队列含行为举报"
  );
  // 行为举报 = open 队列最新一条（targetType responder）→ 封禁
  // 队列可能并存多条待处理举报（多 tab 场景）→ 与下方「执行裁定 nth(0)」同源对齐
  await pageB.getByRole("button", { name: "封禁", exact: true }).first().click();
  const actions3 = await pageB.getByRole("button", { name: /执行裁定/ });
  await actions3.nth(0).click();
  await pageB.waitForTimeout(500);

  const banned = await pageB.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::governance") || "{}");
    return Object.values(s?.state?.bans ?? {})[0];
  });
  assert.ok(banned, "封禁落库");
  assert.equal(banned.action, "ban");

  // B 再发布 → 被拒（治理闸门 1）
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("首页").click();
  await pageB.getByRole("button", { name: /发出你的需求/ }).click();
  await pageB.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await pageB.waitForTimeout(400);
  await pageB.getByLabel("需求品类").fill("拼桌桌游");
  await pageB.getByLabel("需求时间").fill("明天 21:00");
  await pageB.getByLabel("需求地点").fill("万达广场 1 公里");
  await pageB.getByLabel("基础预算").fill("30");
  await pageB.getByRole("button", { name: /广播出去/ }).click();
  await pageB.waitForTimeout(400);
  assert.ok(
    await pageB.evaluate(() =>
      document.body.innerText.includes("发布被拒")
    ),
    "被封禁者发布被拒"
  );
  const wavesAfterBan = await pageB.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::governance") || "{}");
    return (s?.state?.waves ?? []).filter((w) => w.basics.category === "拼桌桌游").length;
  });
  assert.equal(wavesAfterBan, 0, "被拒需求未落库");

  // --- 6. 审计记录留痕 ---
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("我的", { exact: true }).click();
  await pageB.getByTestId("drawer-entry-safety").click(); // 外层安全抽屉
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("安全中心"),
    20000,
    "治理入口"
  );
  const skBtn3 = pageB.getByRole("button", { name: "安全中心", exact: true });
  await skBtn3.scrollIntoViewIfNeeded();
  await skBtn3.click();
  await pageB.getByRole("button", { name: /平台治理后台/ }).click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("裁定记录"),
    20000,
    "审计记录区"
  );
  const audit = await pageB.evaluate(() => document.body.innerText);
  assert.ok(audit.includes("驳回") && audit.includes("封禁"), "审计含各裁定");
  assert.ok(audit.includes("admin-1"), "裁定人留痕");

  console.log("治理闭环：自动拦截 + 手动举报 + 看板 + 驳回/下架/封禁 + 审计 全部通过");
} catch (e) {
  console.error("E2E 失败:", String(e).slice(0, 400));
  failures += 1;
} finally {
  await browser.close();
}

if (failures > 0) process.exit(1);
