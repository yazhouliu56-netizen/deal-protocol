/**
 * E2E: 多人拼单局信任闭环三缺口（真实浏览器，需生产服务）。用法：npm run test:e2e:trustopen
 *
 * 三个场景（三 tab）：
 *  ① 成团失败退款：A 发 3 人局 → B 拼位 → 手动把该局 expiresAt 改到过去
 *     → 挂载行程/我的页触发 settleExpiredOpen → wave=expired，已付订单全部 refunded
 *  ② 24h 分级取消：A 发 3 人局（开始时间=2 小时后，startsAt<24h）→ A 取消发布
 *     → 已付订单按 partial(80%) 退款
 *  ③ no-show 欠款锁定：成局后 A 标 C 未到场 → C breached 未结 → C 再拼位被拒
 *     → A 结清违约 → C 恢复可拼位
 *
 * 用法：npm run test:e2e:trustopen（需先 `npm run start`）
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
      JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}")
    );
  // 注入过期时间并确保落盘成功。异步写回（clusterPushes 后台 fetch）在发布后
  // 短暂存在，可能用内存旧 expiresAt 覆盖注入值 → 用「注入 + 重读校验」重试兜底。
  async function forceExpired(page, waveId, epochPast) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      await page
        .evaluate(
          ({ waveId, epochPast }) => {
            const s = JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}");
            const waves = (s?.state?.waves ?? []).map((w) =>
              w.id === waveId ? { ...w, expiresAt: epochPast } : w
            );
            s.state = { ...s.state, waves };
            localStorage.setItem("oto-broadcast-v1", JSON.stringify(s));
          },
          { waveId, epochPast }
        )
        .catch(() => {});
      await sleep(400);
      const ok = await page.evaluate(({ waveId }) => {
        const s = JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}");
        const w = (s?.state?.waves ?? []).find((x) => x.id === waveId);
        return !w || w.expiresAt < Date.now() - 5000;
      }, { waveId });
      if (ok) return true;
    }
    throw new Error(`注入过期时间失败（连续被页面写回覆盖）: ${waveId}`);
  }

  async function publishOpen(page, cat, time, area, budget) {
    await page.getByLabel("首页").click();
    await page.getByRole("button", { name: /发出你的需求/ }).click();    await page.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
    await page.waitForTimeout(400);
  const moreBtn = await page.getByRole("button", { name: /更多选项/ }).count();
  if (moreBtn) await page.getByRole("button", { name: /更多选项/ }).click();
    await page.getByLabel("需求品类").fill(cat);
    await page.getByLabel("需求时间").fill(time);
    await page.getByLabel("需求地点").fill(area);
    await page.getByLabel("基础预算").fill(String(budget));
    await page.getByLabel("增加人数").click();
    await page.getByLabel("增加人数").click();
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
  await pageC.goto(BASE, { waitUntil: "domcontentloaded" });

  /* ================= ① 成团失败退款 ================= */
  await publishOpen(pageA, "羽毛球约局", "周日 08:00", "滨江球场", 150);
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  await pageA.getByRole("button", { name: /立即支付/ }).click();
  await pageA.waitForTimeout(400);

  // Playwright 多 page 不触发 storage 事件 → reload B 等效"另一设备实时收到广播"
  await pageB.reload({ waitUntil: "domcontentloaded" });

  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("滨江球场"),
    10000,
    "B 收到局 1 广播"
  );
  await pageB.getByRole("button", { name: /拼位加入/ }).click();
  await pageB.getByRole("button", { name: /立即支付/ }).click();
  await pageB.waitForTimeout(500);

  let shared = await readShared(pageB);
  const w1 = shared?.state?.waves?.find((w) => w.basics.area === "滨江球场");
  assert.ok(w1 && w1.status === "active", "局 1 未满员保持 active");
  assert.ok(
    (shared?.state?.payOrders ?? []).some(
      (o) => o.waveId === w1.id && o.status === "paid"
    ),
    "局 1 已有已付订单（发起人 + 拼位）"
  );

  // 把 expiresAt 改成过去 → A 去「行程」（挂载 MyWaves → settleExpiredOpen）
  // 三步防写回竞态：
  //   1) 先 reload A —— 清掉 A 页面发布后残留的 clusterPushes 异步写
  //      再看：现在注入一定在 A 之后，A 不再有覆盖来源
  //   2) forceExpired 注入（B 页写盘 + 重读校验）
  //   3) 再 reload A 以过期值 hydrate → 行程页触发 settleExpiredOpen
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await forceExpired(pageB, w1.id, Date.now() - 10_000);
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("行程").click();

  // 轮询过期态落盘（行程页挂载 settleExpiredOpen 的时序抖动防御：
  // 固定 sleep 在新 build/冷 JS 下偶发不足，改为条件轮询 6s 兜底）
  const expiredDeadline = Date.now() + 6000;
  let w1After;
  while (Date.now() < expiredDeadline) {
    const s = await readShared(pageA);
    w1After = s?.state?.waves?.find((x) => x.id === w1.id);
    if (w1After?.status === "expired") break;
    await sleep(300);
  }
  assert.equal(w1After?.status, "expired", "① 过期未成局 → wave expired");
  shared = await readShared(pageA);
  const w1Orders = (shared?.state?.payOrders ?? []).filter(
    (o) => o.waveId === w1.id
  );
  assert.ok(
    w1Orders.length >= 2 && w1Orders.every((o) => o.status === "refunded"),
    "① 成团失败：局 1 所有已付订单 refunded"
  );
  assert.ok(
    w1Orders.every((o) => o.note?.includes("成团失败")),
    "① 退款 note 标注成团失败"
  );

  /* ================= ② 24h 分级取消（partial <24h） ================= */
  await publishOpen(pageA, "拼桌桌游", "今晚 20:00", "桌游咖啡厅", 90);
  await pageA.getByLabel("开始时间 2 小时后").click();
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  await pageA.getByRole("button", { name: /立即支付/ }).click();
  await pageA.waitForTimeout(400);

  shared = await readShared(pageA);
  const w2 = shared?.state?.waves?.find((w) => w.basics.area === "桌游咖啡厅");
  assert.ok(w2?.startsAt, "② 局 2 应有 startsAt");
  assert.ok(w2.startsAt - Date.now() < 24 * 3600_000, "② startsAt < 24h（partial 档）");

  // A 取消发布 → 分级退款
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("行程").click();
  await pageA.waitForTimeout(400);
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("取消发布"),
    10000,
    "A 见取消发布按钮"
  );
  await pageA.getByRole("button", { name: /取消发布/ }).first().click();
  await pageA.waitForTimeout(500);

  shared = await readShared(pageA);
  const w2After = shared?.state?.waves?.find((w) => w.id === w2.id);
  assert.equal(w2After?.status, "closed", "② 取消 → wave closed");
  const w2Orders = (shared?.state?.payOrders ?? []).filter(
    (o) => o.waveId === w2.id
  );
  assert.ok(
    w2Orders.every((o) => o.status === "refunded"),
    "② 局 2 订单 refunded"
  );
  assert.ok(
    w2Orders.every((o) => o.note?.includes("发起人取消")),
    "② 退款 note 含取消档位"
  );

  /* ================= ③ no-show 欠款锁定 ================= */
  // 局 3：A 发 + B、C 拼 → 成局
  await publishOpen(pageA, "羽毛球约局", "周一 10:00", "高校体育馆", 150);
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  await pageA.getByRole("button", { name: /立即支付/ }).click();
  await pageA.waitForTimeout(400);

  for (const p of [pageB, pageC]) {
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForTimeout(400);
    await waitUntil(
      p,
      () => document.body.textContent?.includes("高校体育馆"),
      10000,
      "拼位者看到局 3"
    );
    await p.getByRole("button", { name: /拼位加入/ }).click();
    await p.getByRole("button", { name: /立即支付/ }).click();
    await p.waitForTimeout(500);
  }

  {
    const t0 = Date.now();
    let ok = false;
    while (Date.now() - t0 < 12000 && !ok) {
      const sh = await readShared(pageA);
      ok = sh?.state?.waves?.find((w) => w.basics.area === "高校体育馆")?.status === "assembled";
      if (!ok) await sleep(300);
    }
    if (!ok) throw new Error("等待超时: 局3 满员成局（异步落盘）");
  }
  shared = await readShared(pageA);
  const w3 = shared?.state?.waves?.find((w) => w.basics.area === "高校体育馆");
  assert.equal(w3?.status, "assembled", "③ 局 3 满员成局");
  const cId = await pageC.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem(`oto-identity-${window.name || "ssr"}`) || "{}"
      ).state?.identity?.id
  );
  assert.ok(cId, "C 身份存在");

  // A 把 C 标未到场 → C breached 未结清（座位按加入顺序 B 在前、C 在后）
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("行程").click();
  // 座位操作按钮（aria-label=标记未到场）在「出勤档案」折叠区内（MATCHED 态默认折叠）
  // → 先展开再轮询（若已展开则「展开」字样不存在，自动跳过）
  const expandSeat = pageA.getByRole("button", { name: /展开/ });
  if (await expandSeat.count()) {
    await expandSeat.first().click();
  }
  await waitUntil(
    pageA,
    () =>
      Array.from(document.querySelectorAll("button")).filter((b) =>
        (b.getAttribute("aria-label") ?? "").includes("标记未到场")
      ).length >= 2,
    20000,
    "行程页两个座位按钮就绪"
  );
  await pageA.getByRole("button", { name: /标记未到场/ }).nth(1).click();
  await pageA.waitForTimeout(500);

  shared = await readShared(pageA);
  const breached = (shared?.state?.claims ?? []).find(
    (c) => c.responderId === cId && c.status === "breached"
  );
  assert.ok(breached, "③ no-show 座位 breached");
  assert.equal(breached.settled, undefined, "③ 违约未结清");

  // C 尝试拼 A 的局 4 → 被拒（debt-unsettled）
  await publishOpen(pageA, "拼桌桌游", "周二 15:00", "城市书房", 60);
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  await pageA.getByRole("button", { name: /立即支付/ }).click();
  await waitUntil(
    pageA,
    () => (JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}").state?.waves ?? []).length > 0,
    15000,
    "局 4 发布落库"
  );
  const w4 = (await readShared(pageA))?.state?.waves?.find(
    (w) => w.basics.area === "城市书房"
  );
  // 发布费：A 已发布 ① 局 ② 局 ③ 局 = 用完每日免费 3 次，
  // 局 4 是第 4 次 → 需付发布费（独立 publish-fee 订单，一经支付不退）
  const w4Orders = (await readShared(pageA))?.state?.payOrders?.filter(
    (o) => o.waveId === w4.id
  );
  assert.ok(
    w4Orders.some((o) => o.kind === "publish-fee" && o.amount === 1),
    "第 4 次发布超出免费配额 → 产生发布费订单（¥1，kind=publish-fee）"
  );

  await pageC.reload({ waitUntil: "domcontentloaded" });
  await pageC.waitForTimeout(400);
  await waitUntil(
    pageC,
    () => document.body.textContent?.includes("城市书房"),
    10000,
    "C 收到局 4"
  );
  await pageC.getByRole("button", { name: /拼位加入/ }).click();
  await pageC.getByRole("button", { name: /立即支付/ }).click();
  await pageC.waitForTimeout(600);
  const cJoinTry = await pageC.evaluate(() => document.body.innerText);
  assert.ok(
    cJoinTry.includes("no-show 违约") || cJoinTry.includes("未结"),
    "③ C 违约未结 → 拼位被拒（debt-unsettled）"
  );

  // A 结清违约 → C 解锁 → C 再拼局 4 成功
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("行程").click();
  await pageA.waitForTimeout(400);
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("结清违约"),
    10000,
    "A 见结清入口"
  );
  await pageA.getByRole("button", { name: /结清违约/ }).first().click();
  await pageA.waitForTimeout(500);

  shared = await readShared(pageA);
  const settledClaim = (shared?.state?.claims ?? []).find(
    (c) => c.id === breached.id
  );
  assert.equal(settledClaim?.settled, true, "③ 违约已结清");

  await pageC.reload({ waitUntil: "domcontentloaded" });
  await pageC.waitForTimeout(400);
  await pageC.getByLabel("首页").click();
  await waitUntil(
    pageC,
    () => document.body.textContent?.includes("城市书房"),
    10000,
    "结清后 C 可见局 4"
  );
  await pageC.getByRole("button", { name: /拼位加入/ }).click();
  await pageC.getByRole("button", { name: /立即支付/ }).click();
  await pageC.waitForTimeout(500);
  shared = await readShared(pageC);
  const c4Claims = (shared?.state?.claims ?? []).filter(
    (c) => c.waveId === w4.id
  );
  const c4Claim = c4Claims.find((c) => c.responderId === cId);
  console.log("C4 claims:", JSON.stringify(c4Claims.map((c) => ({ id: c.id, responderId: c.responderId, status: c.status })), null, 2));
  console.log("C identity:", cId);
  assert.ok(
    c4Claim && (c4Claim.status === "joined" || c4Claim.status === "accepted"),
    "③ 结清后 C 拼位成功"
  );

  console.log("多人拼单局信任闭环三缺口 E2E：全部通过");
} catch (e) {
  console.error("E2E 失败:", String(e).slice(0, 500));
  failures += 1;
} finally {
  await browser.close();
}

process.exit(failures === 0 ? 0 : 1);
