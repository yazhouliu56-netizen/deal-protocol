/**
 * E2E: 多人拼单局 · 拼位闭环（真实浏览器，需要生产服务在 localhost:3000）。
 * 用法：npm run test:e2e:openmatch （需先 `npm run start`）
 *
 * 场景：三 tab 三身份 ——
 *   Tab A 发布"羽毛球约局" 3 人多人拼单局（含自己 = 需 2 位拼位者）+ 爽约保障险
 *   Tab B 拼位加入 → claim status joined（等待满员，wave 不锁）
 *   Tab C 拼位加入 → 满员自动成局：wave assembled、两人 accepted、押金冻结
 *   A（需求方）看到已成局 + 拼位队列；B/C（拼位者）看到拨号卡 + 押金流水
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
isolateBrowserChannels(browser, "openmatch", { forceLocal: true });

let failures = 0;

try {
  // 自清零：覆盖本脚本专属云行为空 state（跨脚本/跨轮次污染根治）
  await resetE2eChannelRow("openmatch");
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
  });
  // P0 Bot 确定性开关：本脚本精确断言席位/成局时序，关闭沙盒自动接单
  await ctx.addInitScript(() => localStorage.setItem("oto-sandbox-bot", "off"));

  const pageA = await ctx.newPage();
  const pageB = await ctx.newPage();
  const pageC = await ctx.newPage();

  for (const [label, page] of [
    ["A", pageA],
    ["B", pageB],
    ["C", pageC],
  ]) {
    page.on("pageerror", (e) => {
      console.error(`[${label}] pageerror:`, String(e).slice(0, 300));
      failures += 1;
    });
  }

  const readShared = (page) =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::openmatch") || "{}")
    );

  // --- 1. 清空共享广播空间 ---
  await pageA.goto(BASE, { waitUntil: "domcontentloaded" });
  await pageA.evaluate(() => {
    try {
      localStorage.removeItem("oto-broadcast-v1::oto::e2e::openmatch");
    } catch {}
  });
  await pageA.reload({ waitUntil: "domcontentloaded" });

  // --- 2. Tab A 发布 3 人多人拼单局（含自己 = 需 2 位拼位者） + 爽约保障险 ---
  await pageA.getByRole("button", { name: /发出你的需求/ }).click();
  await pageA.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await pageA.waitForTimeout(400);
  const moreBtn = await pageA.getByRole("button", { name: /更多选项/ }).count();
  if (moreBtn) await pageA.getByRole("button", { name: /更多选项/ }).click();
  await pageA.getByLabel("需求品类").fill("羽毛球约局");
  await pageA.getByLabel("需求时间").fill("周六 14:00");
  await pageA.getByLabel("需求地点").fill("体育中心");
  await pageA.getByLabel("基础预算").fill("150");
  // 多人拼单局人数：1 → 3（点两次 ＋）
  await pageA.getByLabel("增加人数").click();
  await pageA.getByLabel("增加人数").click();
  await pageA.getByLabel("开启爽约保障险").click();
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  // 随单支付：发起人付自己那份(人均 50) → 激活上线
  await pageA.getByRole("button", { name: /立即支付/ }).click();
  await waitUntil(
    pageA,
    () => (JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::openmatch") || "{}").state?.waves ?? []).length > 0,
    15000,
    "Tab A 发布落库"
  );

  const published = await readShared(pageA);
  const wave = published?.state?.waves?.[0];
  assert.ok(wave, "Tab A 发布后共享空间应存在信号波");
  assert.equal(wave.capacity, 3, "多人拼单局容量应为 3");
  assert.equal(wave.status, "active", "未拼位前保持 active");
  assert.equal(wave.deposit, true, "爽约保障险应开启");

  // --- 3. Tab B 拼位加入 → joined（wave 仍 active） ---
  await pageB.goto(BASE, { waitUntil: "domcontentloaded" });
  await pageB.getByLabel("首页").click();
  await pageB.waitForTimeout(400);
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("体育中心"),
    10000,
    "Tab B 收到多人拼单局广播"
  );
  await pageB.getByRole("button", { name: /拼位加入/ }).click();
  // 拼位即付：支付成功才占位
  await pageB.getByRole("button", { name: /立即支付/ }).click();
  await pageB.waitForTimeout(500);

  let shared = await readShared(pageB);
  assert.equal(shared?.state?.waves?.[0]?.status, "active", "拼 1 位不锁局");
  assert.equal(
    shared?.state?.claims?.filter((c) => c.status === "joined").length,
    1,
    "B 的 claim 应为 joined"
  );

  // --- 4. Tab C 拼位加入 → 满员自动成局 ---
  await pageC.goto(BASE, { waitUntil: "domcontentloaded" });
  await pageC.getByLabel("首页").click();
  await pageC.waitForTimeout(400);
  await waitUntil(
    pageC,
    () => document.body.textContent?.includes("体育中心"),
    10000,
    "Tab C 收到多人拼单局广播"
  );
  await pageC.getByRole("button", { name: /拼位加入/ }).click();
  await pageC.getByRole("button", { name: /立即支付/ }).click();
  await pageC.waitForTimeout(500);

  shared = await readShared(pageC);
  const waveFinal = shared?.state?.waves?.[0];
  assert.equal(waveFinal.status, "assembled", "满员自动成局");
  const seatClaims = shared?.state?.claims?.filter(
    (c) => c.waveId === waveFinal.id
  );
  assert.equal(seatClaims.length, 2, "应有 2 个拼位 claim");
  assert.ok(
    seatClaims.every((c) => c.status === "accepted"),
    "成局后 joined → accepted"
  );
  assert.ok(
    seatClaims.every((c) => c.depositPhase === "held"),
    "爽约保障险按位冻结"
  );

  // --- 5. B 视角：已拼位 → 成局后拨号卡 + 押金冻结（100 → 95） ---
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("我的", { exact: true }).click();
  await pageB.waitForTimeout(500);
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("一次性虚拟线路"),
    10000,
    "B 看到拨号卡（成局锁定）"
  );
  const idKeyB = await pageB.evaluate(
    () => `oto-identity-${window.name || "ssr"}`
  );
  await waitUntil(
    pageB,
    () => {
      const s = JSON.parse(
        localStorage.getItem(`oto-identity-${window.name || "ssr"}`) || "{}"
      );
      return (s?.state?.deposits ?? []).some(
        (d) => d.phase === "held" && d.amount === 5
      );
    },
    10000,
    "B 押金冻结"
  );
  const afterHoldB = await pageB.evaluate((k) =>
    JSON.parse(localStorage.getItem(k) || "{}"), idKeyB
  );
  assert.equal(afterHoldB?.state?.account?.balance, 95, "B 押金冻结扣 5 元");

  // --- 6. C 视角：同样成局锁定 + 押金冻结 ---
  const idKeyC = await pageC.evaluate(
    () => `oto-identity-${window.name || "ssr"}`
  );
  await pageC.reload({ waitUntil: "domcontentloaded" });
  await pageC.getByLabel("我的", { exact: true }).click();
  await pageC.waitForTimeout(500);
  await waitUntil(
    pageC,
    () => document.body.textContent?.includes("一次性虚拟线路"),
    10000,
    "C 看到拨号卡"
  );
  const afterHoldC = await pageC.evaluate((k) =>
    JSON.parse(localStorage.getItem(k) || "{}"), idKeyC
  );
  assert.equal(afterHoldC?.state?.account?.balance, 95, "C 押金冻结扣 5 元");

  // --- 7. A 视角（需求方）：已成局 + 拼位队列 + 每人独立流程 ---
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("行程").click();
  await pageA.waitForTimeout(500);
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("已成局"),
    20000,
    "A 看到已成局"
  );
  assert.ok(
    await pageA.evaluate(() =>
      document.body.innerText.includes("2 位拼位者")
    ),
    "A 应看到 2 位拼位者"
  );
  const dialA = await pageA.evaluate(() => {
    const m = document.body.innerText.match(/0571-\d{4}-\d{4}/);
    return m ? m[0] : null;
  });
  assert.ok(dialA, "A 应看到虚拟号码");
  const dialB = await pageB.evaluate(() => {
    const m = document.body.innerText.match(/0571-\d{4}-\d{4}/);
    return m ? m[0] : null;
  });
  assert.ok(dialB, "B 应看到虚拟号码");
  assert.equal(dialA, dialB, "同一局内号码一致");

  // --- 8. no-show 处理（A 标记 C 未到场）→ 款不退 + 补偿 B + A 获 buff ---
  await pageA.getByRole("button", { name: /未到场/ }).first().click();
  await pageA.waitForTimeout(600);
  const idKeyA = await pageA.evaluate(
    () => `oto-identity-${window.name || "ssr"}`
  );
  const authA = await pageA.evaluate((k) =>
    JSON.parse(localStorage.getItem(k) || "{}"), idKeyA
  );
  const aId = authA?.state?.identity?.id ?? "me";
  shared = await readShared(pageA);
  const breachedSeats = shared?.state?.claims?.filter(
    (c) => c.status === "breached"
  );
  assert.equal(breachedSeats.length, 1, "no-show 座位标记 breached");
  assert.ok(
    shared?.state?.payOrders?.some((o) => o.status === "paid" && o.amount === 50),
    "no-show 款不退：补偿流水入账(人均 50 分摊)"
  );
  // P2 稳健化：buff 入账为异步落盘 → Node 侧轮询共享空间（readShared 为 Node 助手，
  // 严禁作为 page.evaluate 闭包传入——Playwright 只序列化函数源码，闭包不随行）
  {
    const t0 = Date.now();
    let ok = false;
    while (Date.now() - t0 < 25000 && !ok) {
      const sh = await readShared(pageA);
      ok = (sh?.state?.initiatorBuffs?.[aId] ?? 0) >= 1;
      if (!ok) await sleep(300);
    }
    if (!ok) {
      const sh2 = await readShared(pageA);
      throw new Error(
        `等待超时: 成局 buff 入账 | aId=${aId} | 本键buffs=${JSON.stringify(sh2?.state?.initiatorBuffs)} | waves=${JSON.stringify((sh2?.state?.waves ?? []).map((w) => ({ id: w.id?.slice(-6), st: w.status, auth: String(w.authorId ?? "").slice(-8) })))} | claims=${JSON.stringify((sh2?.state?.claims ?? []).map((c) => ({ st: c.status, rid: String(c.responderId ?? "").slice(-8) })))}`
      );
    }
  }
  const buff = shared?.state?.initiatorBuffs?.[aId] ?? 0;
  assert.equal(buff, 1, "发起人 A 获得成局面降标准 buff +1");
// A 的多人拼单局展示「已降标准 −1」
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("行程").click();
  await pageA.waitForTimeout(500);
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("已成局"),
    10000,
    "A reload 后仍看到已成局（rehydrate 完成）"
  );
  const aText = await pageA.evaluate(() => document.body.innerText);
  assert.ok(
    aText.includes("持有 1 次"),
    "A 应看到 no-show buff 提示（下次发局自动降标准）"
  );

  console.log("多人拼单局拼位闭环 E2E：全部通过");
} catch (e) {
  console.error("E2E 失败:", e.message ?? e);
  failures += 1;
} finally {
  await browser.close();
}

process.exit(failures === 0 ? 0 : 1);
