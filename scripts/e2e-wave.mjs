/**
 * E2E: P2P 广播 + 磋商闭环双 tab 测试（真实浏览器，需要生产服务在 localhost:3000）。
 * 用法：npm run test:e2e:wave （需先 `npm run start`）
 *
 * 场景：双 tab 双身份 ——
 *   Tab A 发布"厨师上门做饭 + 定制 30 岁女性 + 磋商入口"信号波
 *   Tab B（独立身份）在雷达收到广播 → 发起磋商（丙）
 *   Tab A 还价 → Tab B 回应 → Tab A 谈成锁定
 *   双方各自看到一次性虚拟线路拨号卡（同一号码）
 *   Tab A 违约裁决 → 虚拟余额扣费 + 钱包流水
 * 同时验证共享 localStorage 跨 tab 同步。
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

  // 共享同一 context → 同一 localStorage（跨 tab 同步的基础）
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

  // --- 1. 清空共享广播空间（确保独立起点） ---
  await pageA.goto(BASE, { waitUntil: "domcontentloaded" });
  await pageA.evaluate(() => {
    try {
      localStorage.removeItem("oto-broadcast-v1");
    } catch {}
  });
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageB.goto(BASE, { waitUntil: "domcontentloaded" });

  // --- 2. Tab A 发出一条带定制 + 磋商入口的信号波 ---
  await pageA.getByRole("button", { name: /发出你的需求/ }).click();
  await pageA.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await pageA.waitForTimeout(400);
  const moreBtn = await pageA.getByRole("button", { name: /更多选项/ }).count();
  if (moreBtn) await pageA.getByRole("button", { name: /更多选项/ }).click();
  await pageA.getByLabel("需求品类").fill("厨师 · 上门做饭");
  await pageA.getByLabel("需求时间").fill("明天 11:00");
  await pageA.getByLabel("需求地点").fill("幸福家园小区");
  await pageA.getByLabel("基础预算").fill("100");
  await pageA.getByLabel("定制条件").fill("30 岁左右女性");
  await pageA.getByRole("button", { name: "＋" }).click();
  // 磋商入口 = 内容即开关：填了 → 开放磋商（negotiable）
  await pageA.getByLabel("磋商留言（可留空）").fill("价格可以谈");
  // 爽约保障险：双方履约保障（响应者冻结 ¥5 押金）
  await pageA.getByLabel("开启爽约保障险").click();
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  // 随单支付：钱到位才激活上线
  await pageA.getByRole("button", { name: /立即支付/ }).click();
  await waitUntil(
    pageA,
    () => (JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}").state?.waves ?? []).length > 0,
    15000,
    "Tab A 发布落库"
  );

  const sharedWave = await pageA.evaluate(() =>
    JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}")
  );
  assert.ok(
    (sharedWave?.state?.waves ?? []).length >= 1 &&
      sharedWave.state.waves[0].negotiable === true &&
      sharedWave.state.waves[0].deposit === true,
    "Tab A 发布后共享空间应存在可磋商 + 爽约保障险信号波"
  );

  // --- 3. Tab B 收到广播 → 发起磋商（丙） ---
  // Playwright 的多 page 不触发跨 tab storage 事件（真实浏览器双 tab 会实时
  // rehydrate）。此处以 reload 等效"另一 tab 打开/刷新时看到共享广播空间"。
await pageB.reload({ waitUntil: "domcontentloaded" });
  // P7.1 进家硬筛：B 先声明品类 + 实名认证才能看到家政进家单
  await pageB.getByLabel("我的", { exact: true }).click();
  await pageB.getByTestId("drawer-entry-system").click(); // P2 抽屉化 IA：能力声明已收纳于「系统设置」抽屉
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
  await pageB.waitForTimeout(400);
  await waitUntil(
    pageB,
    () =>
      document.body.textContent?.includes("幸福家园小区") &&
      document.body.textContent?.includes("30 岁左右女性"),
    10000,
    "Tab B 收到 Tab A 的广播"
  );

  // B 填磋商留言 → 按钮变"发起磋商"
  await pageB.getByLabel("磋商留言（可留空）").first().fill("90 元能做吗，我时间灵活");
  await pageB.waitForTimeout(200);
  await pageB.getByRole("button", { name: /发起磋商/ }).click();
  await pageB.waitForTimeout(500);

  const afterBClaim = await pageB.evaluate(() =>
    JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}")
  );
  assert.equal(
    afterBClaim?.state?.claims?.[0]?.status,
    "negotiating",
    "B 发起磋商后 claim 应为 negotiating"
  );
  assert.equal(afterBClaim?.state?.claims?.[0]?.rounds, 1);

  // --- 4. Tab A 还价（需求方轮次） ---
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("行程").click();
  await pageA.waitForTimeout(400);
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("轮到你还价"),
    10000,
    "A 看到轮到你还价"
  );
  await pageA.getByLabel("还价金额").fill("95");
  await pageA.getByLabel("还价留言").fill("95 可以，别再少了");
  await pageA.getByLabel("发出还价").click();
  await pageA.waitForTimeout(400);

  // --- 5. Tab B 回应（响应者轮次） ---
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("我的", { exact: true }).click();
  await pageB.waitForTimeout(400);
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("轮到你回应"),
    10000,
    "B 看到轮到你回应"
  );
  await pageB.getByLabel("回应金额").fill("96");
  await pageB.getByLabel("回应留言").fill("成交，96 到点上门");
  await pageB.getByLabel("发出回应").click();
  await pageB.waitForTimeout(400);

  const afterCounter = await pageB.evaluate(() =>
    JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}")
  );
  assert.equal(afterCounter?.state?.claims?.[0]?.rounds, 3);
  assert.equal(afterCounter?.state?.claims?.[0]?.lastBy, "responder");

  // --- 6. Tab A 谈成锁定 → 拨号卡（一次性虚拟线路） ---
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("行程").click();
  await pageA.waitForTimeout(400);
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("谈成 · 锁定"),
    10000,
    "A 磋商线可锁定"
  );
  await pageA.getByRole("button", { name: /谈成 · 锁定/ }).first().click();
  await pageA.waitForTimeout(400);

  // A 视角：盲盒揭晓 + 拨号卡 + 同一号码
  await waitUntil(
    pageA,
    () =>
      document.body.textContent?.includes("有人接单了") &&
      document.body.textContent?.includes("一次性虚拟线路"),
    10000,
    "A 看到揭晓与拨号卡"
  );
  const dialA = await pageA.evaluate(() => {
    const m = document.body.innerText.match(/0571-\d{4}-\d{4}/);
    return m ? m[0] : null;
  });
  assert.ok(dialA, "A 应看到虚拟号码");

  // B 视角：我的接单里同样拨号卡、同一号码
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("我的", { exact: true }).click();
  await pageB.waitForTimeout(400);
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("一次性虚拟线路"),
    10000,
    "B 看到拨号卡"
  );
  const dialB = await pageB.evaluate(() => {
    const m = document.body.innerText.match(/0571-\d{4}-\d{4}/);
    return m ? m[0] : null;
  });
  assert.equal(dialA, dialB, "双方应看到同一个虚拟号码");

  // --- 6.5 B 锁定后：爽约保障险押金冻结（B 本地账户 100 → 95） ---
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
  assert.equal(afterHoldB?.state?.account?.balance, 95);
  assert.equal(
    (afterHoldB?.state?.deposits ?? []).filter((d) => d.phase === "held").length,
    1
  );

  // --- 7. 违约裁决：赔付 + 扣款 + 押金没收 + 流水 ---
  const idKey = await pageA.evaluate(
    () => `oto-identity-${window.name || "ssr"}`
  );
  const before = await pageA.evaluate((k) =>
    JSON.parse(localStorage.getItem(k) || "{}"), idKey
  );
  await pageA.getByRole("button", { name: /对方违约/ }).first().click();
  await pageA.waitForTimeout(300);
  await pageA.getByRole("button", { name: /不谅解/ }).click();
  await pageA.waitForTimeout(400);
  const after = await pageA.evaluate((k) =>
    JSON.parse(localStorage.getItem(k) || "{}"), idKey
  );
  // 爽约保障险赔付 +5 入账，违约裁决 -30 → 净 -25
  assert.equal(
    (before?.state?.account?.balance ?? 100) -
      (after?.state?.account?.balance ?? 0),
    25,
    "违约不谅解：赔付 +5 / 裁决 -30，净扣 25"
  );
  assert.ok(
    (after?.state?.ledger ?? []).some((e) => e.kind === "payout"),
    "钱包应有爽约保障险赔付入账记录"
  );

  // B 侧：押金没收（balance 保持 95，deposits 终态 forfeited）
  // reload 后先进"我的"页触发 MyClaims 的幂等账务 effect
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("我的", { exact: true }).click();
  await pageB.waitForTimeout(600);
  const afterB = await pageB.evaluate((k) =>
    JSON.parse(localStorage.getItem(k) || "{}"), idKeyB
  );
  const sharedAfter = await pageB.evaluate(() =>
    JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}")
  );
  assert.equal(sharedAfter?.state?.claims?.[0]?.depositPhase, "forfeited");
  assert.equal(afterB?.state?.account?.balance, 95, "押金没收不退回");
  assert.equal(
    (afterB?.state?.deposits ?? []).find((d) => d.phase === "held")?.phase,
    undefined,
    "押金不再 held"
  );
  assert.ok(
    (afterB?.state?.deposits ?? []).some((d) => d.phase === "forfeited"),
    "押金终态为 forfeited"
  );
  // 钱包前台可见流水（我的页）
  await pageA.getByLabel("我的", { exact: true }).click();
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("最近流水"),
    8000,
    "钱包前台展示流水"
  );
  assert.ok(
    await pageA.evaluate(() =>
      document.body.innerText.includes("爽约保障险赔付到账")
    ),
    "钱包流水应含爽约保障险赔付"
  );

  console.log("P2P 广播 + 磋商闭环 E2E：全部通过");
} catch (e) {
  console.error("E2E 失败:", e.message ?? e);
  failures += 1;
} finally {
  await browser.close();
}

process.exit(failures === 0 ? 0 : 1);
