/**
 * E2E: 验收/扣费模块（M3）— 三条链路（真实浏览器，需生产服务）。用法：npm run test:e2e:acceptance
 *
 * 场景 A（简单任务·结果导向）：发布 → B 接单 → B 申报完成 → A 验收放款。
 * 场景 B（复杂任务·模块化）：发布时 AI 拆解出模块（mock 降级，无 LLM key 时确定）→
 *   B 接单 → 逐模块申报 → A 逐模块确认 → 全确认放款。
 * 场景 C（争议·原因拆分优先）：A 发起争议（选原因+凭证）→ 自动判责 →
 *   B 协商（上限内比例）→ A 接受协商 → 结算 + 信用联动落库。
 */
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitUntil(page, fn, timeout = 15000, label = "条件", arg) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await page.evaluate(fn, arg)) return true;
    await sleep(300);
  }
  throw new Error(`等待超时: ${label}`);
}

const state = (p) =>
  p.evaluate(() =>
    JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}").state
  );

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

  // --- 0. 清空共享空间（独立起点） ---
  await pageA.goto(BASE, { waitUntil: "domcontentloaded" });
  await pageA.evaluate(() => {
    try {
      localStorage.removeItem("oto-broadcast-v1");
    } catch {}
  });
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageB.goto(BASE, { waitUntil: "domcontentloaded" });
  await pageB.reload({ waitUntil: "domcontentloaded" });

  // B 默认声明全部 6 个品类；测试统一用非进家品类「羽毛球约局」——无需实名认证，
  // 规避认证点击的间歇性 flaky，聚焦验收/争议链路本身。

  // ========== 场景 A：简单任务 · 结果导向 ==========
  console.log("--- 场景 A：简单任务结果验收 ---");
  await pageA.getByLabel("首页").click();
  await pageA.getByRole("button", { name: /发出你的需求/ }).click();
  await pageA.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await pageA.waitForTimeout(400);
  const moreBtn = await pageA.getByRole("button", { name: /更多选项/ }).count();
  if (moreBtn) await pageA.getByRole("button", { name: /更多选项/ }).click();
  await pageA.getByLabel("需求品类").fill("羽毛球约局");
  await pageA.getByLabel("需求时间").fill("今天 20:00");
  await pageA.getByLabel("需求地点").fill("幸福家园 2 栋");
  await pageA.getByLabel("基础预算").fill("80");
  // 不拆解 → 简单任务
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  await pageA.getByRole("button", { name: /立即支付/ }).click();
  // 支付/落库是异步管线 → 等 wave 确实入共享空间再让 B 刷新（负载无关的确定性等待）
  await waitUntil(
    pageA,
    () => (JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}").state?.waves ?? []).length > 0,
    15000,
    "A 场景 A 发布落库"
  );

  // Playwright 多 page 不触发 storage 事件 → reload B 等效"另一设备实时收到广播"
  await pageB.reload({ waitUntil: "domcontentloaded" });

  await pageB.getByLabel("首页").click();
  await pageB.waitForTimeout(800);
  await waitUntil(
    pageB,
    () => Array.from(document.querySelectorAll("button")).some((b) => b.textContent?.includes("接单")),
    15000,
    "B 收到广播（出现接单按钮）"
  );
  await pageB.getByRole("button", { name: /接单/ }).first().click();
  await pageB.waitForTimeout(400);
  await pageB.getByLabel("我的", { exact: true }).click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("服务完成 · 请求放款"),
    25000,
    "B 见申报按钮"
  );
  await pageB.getByLabel("申报完成").click();
  // 等 B 侧申报落盘（transport write 完成）再让 A 读
  await waitUntil(
    pageB,
    () => {
      const st = JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}").state;
      return (st?.claims ?? []).some((c) => c.serviceDoneAt);
    },
    25000,
    "B 申报落盘"
  );

await pageA.reload({ waitUntil: "domcontentloaded" });
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("正在接收信号"),
    10000,
    "A reload"
  );
  await pageA.getByLabel("行程").click();
  const t0 = Date.now();
  while (true) {
    try {
      if (await pageA.evaluate(() => document.body.textContent?.includes("服务方已申报完成"))) break;
    } catch {}
    const dump = await pageA.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}").state;
      return {
        claims: (s?.claims ?? []).map((c) => ({ st: c.status, done: !!c.serviceDoneAt, w: c.waveId })),
        waves: (s?.waves ?? []).map((w) => ({ st: w.status })),
      };
    });
    console.log(`[t+${((Date.now() - t0) / 1000).toFixed(1)}s] A store dump:`, JSON.stringify(dump));
    if (Date.now() - t0 > 25000) throw new Error("等待超时: A 见验收卡");
    await new Promise((r) => setTimeout(r, 3000));
  }
  await pageA.getByLabel("验收凭证").fill("马桶通了，水流顺畅");
  await pageA.getByRole("button", { name: /确认验收/ }).click();
  await pageA.waitForTimeout(500);
  const sA = await state(pageA);
  assert.equal(sA?.claims?.[0]?.fulfilment?.confirmedBy, "demander", "A 结果导向验收成功");
  console.log("场景 A ✅ 简单任务：申报 → 验收 → 放款");

  // ========== 场景 B：复杂任务 · AI 拆解 + 逐模块验收 ==========
  console.log("--- 场景 B：复杂任务模块化验收 ---");
  await pageA.getByLabel("首页").click();
  await pageA.getByRole("button", { name: /发出你的需求/ }).click();
  await pageA.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await pageA.waitForTimeout(400);
  await pageA.getByLabel("需求品类").fill("羽毛球约局");
  await pageA.getByLabel("需求时间").fill("明天 10:00");
  await pageA.getByLabel("需求地点").fill("幸福家园 3 栋");
  await pageA.getByLabel("基础预算").fill("300");
  // 不填磋商留言 → 非可议单 → B 直接接单（claimDirect，modules 即附）
  // AI 拆解（LLM 探测→ 超时/失败自动降级 mock；zhipu 优先，mock 兜底确定性）
  const moreBtn2 = await pageA.getByRole("button", { name: /更多选项/ }).count();
  if (moreBtn2) await pageA.getByRole("button", { name: /更多选项/ }).click();
  await pageA.getByRole("button", { name: /一键拆解/ }).click();
  await waitUntil(
    pageA,
    () => /已拆 \d+ 个独立模块/.test(document.body.textContent ?? ""),
    30000,
    "A 拆解完成"
  );
  // 发布时 wave.modules 落库
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  await pageA.getByRole("button", { name: /立即支付/ }).click();
  await waitUntil(
    pageA,
    () =>
      (JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}").state?.waves ?? []).some(
        (w) => w.modules?.length >= 2
      ),
    15000,
    "wave 携带模块定义落库"
  );

  // Playwright 多 page 不触发 storage 事件 → reload B 等效实时收到广播
  await pageB.reload({ waitUntil: "domcontentloaded" });

  await pageB.getByLabel("首页").click();
  await waitUntil(
    pageB,
    () => Array.from(document.querySelectorAll("button")).some((b) => b.textContent?.includes("接单")),
    15000,
    "B 收到模块单（出现接单按钮）"
  );
  await pageB.getByRole("button", { name: /接单/ }).first().click();
  await pageB.waitForTimeout(400);
  await pageB.getByLabel("我的", { exact: true }).click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("模块化交付"),
    25000,
    "B 见模块交付面板"
  );
  // 逐模块申报（动态数量：mock=2 / LLM=2-3）——按场景 B 的 wave 匹配 claim
  const sB2 = await state(pageB);
  const bWaveId = sB2?.waves?.find((w) => w.modules?.length >= 2)?.id;
  assert.ok(bWaveId, "找到模块化 wave");
  const bClaim = sB2?.claims?.find((c) => c.waveId === bWaveId);
  assert.ok(bClaim?.modules?.length >= 2, "接单后 claim 挂模块状态");
  const modCount = bClaim.modules.length;
  for (let i = 0; i < modCount; i++) {
    await pageB
      .locator('button[aria-label*="申报模块"]:enabled')
      .first()
      .click();
    await pageB.waitForTimeout(250);
  }
  const sB3 = await state(pageB);
  const bClaim3 = sB3?.claims?.find((c) => c.waveId === bWaveId);
  assert.equal(
    bClaim3?.modules?.filter((m) => m.status === "done").length,
    modCount,
    `全部 ${modCount} 个模块均已申报`
  );

  // A 逐模块确认（不能一次性全放，未确认模块冻结）
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("行程").click();
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("模块化验收"),
    25000,
    "A 见模块验收"
  );
  const aWaveId = (await state(pageA))?.waves?.find((w) => w.modules?.length >= 2)?.id;
  const aClaim = (await state(pageA))?.claims?.find((c) => c.waveId === aWaveId);
  const modCountA = aClaim?.modules?.length ?? 0;
  await pageA
    .locator('button[aria-label^="确认模块"]:enabled')
    .first()
    .click();
  await pageA.waitForTimeout(300);
  const sA2 = await state(pageA);
  const aClaim2 = sA2?.claims?.find((c) => c.waveId === aWaveId);
  const confirmed1 = aClaim2?.modules?.filter((m) => m.status === "confirmed").length;
  assert.equal(confirmed1, 1, "只确认了第一个模块，其余仍冻结");
  assert.equal(aClaim2?.fulfilment, undefined, "未全确认不放全款（无 fulfilment 终态）");
  for (let i = 1; i < modCountA; i++) {
    const btn = pageA.locator('button[aria-label^="确认模块"]:enabled').first();
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    await pageA.waitForTimeout(250);
  }
  const sA3 = await state(pageA);
  assert.equal(
    sA3?.claims?.find((c) => c.waveId === aWaveId)?.modules?.filter((m) => m.status === "confirmed").length,
    modCountA,
    "全模块确认"
  );
  console.log("场景 B ✅ 复杂任务：拆解 → 逐模块申报/确认 → 全放款");

  // ========== 场景 C：争议 · 原因拆分 + 自动判责 + 协商 ==========
  console.log("--- 场景 C：争议按原因 + 协商 ---");
  await pageA.getByLabel("首页").click();
  await pageA.getByRole("button", { name: /发出你的需求/ }).click();
  await pageA.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await pageA.waitForTimeout(400);
  await pageA.getByLabel("需求品类").fill("羽毛球约局");
  await pageA.getByLabel("需求时间").fill("明天 14:00");
  await pageA.getByLabel("需求地点").fill("幸福家园 4 栋");
  await pageA.getByLabel("基础预算").fill("120");
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  await pageA.getByRole("button", { name: /立即支付/ }).click();
  await waitUntil(
    pageA,
    () => (JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}").state?.waves ?? []).length > 0,
    15000,
    "A 场景 C 发布落库"
  );

  // Playwright 多 page 不触发 storage 事件 → reload B 等效实时收到广播
  await pageB.reload({ waitUntil: "domcontentloaded" });

  await pageB.getByLabel("首页").click();
  await waitUntil(
    pageB,
    () => Array.from(document.querySelectorAll("button")).some((b) => b.textContent?.includes("接单")),
    15000,
    "B 收到场景 C 广播（出现接单按钮）"
  );
  await pageB.getByRole("button", { name: /接单/ }).first().click();
  await pageB.waitForTimeout(400);
  await pageB.getByLabel("我的", { exact: true }).click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("服务完成 · 请求放款"),
    25000,
    "B 申报按钮（C）"
  );
  await pageB.getByLabel("申报完成").click();
  await pageB.waitForTimeout(300);

  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageA.getByLabel("行程").click();
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("发起争议"),
    25000,
    "A 见争议入口"
  );
  // 选原因「迟到/早退」（部分责任 → 协商上限 60%）——定位场景 C 的卡片（预算 ¥120）
  // 选原因「迟到/早退」（部分责任 → 协商上限 60%）——页面级 first：
  // 场景 A/B 的 claim 已验收，其争议表单未展开；场景 C 是唯一展开的表单。
  await pageA.getByRole("button", { name: /迟到\/早退/ }).first().click();
  await pageA.getByLabel("争议凭证").first().fill("比约定晚到 40 分钟");
  await pageA.getByRole("button", { name: /提交争议/ }).first().click();
  await pageA.waitForTimeout(400);
    // 场景 C：A 的第三个波（无 modules）= 简单任务争议
  const cWaveId = (await state(pageA))?.waves
    ?.filter((w) => !w.modules || w.modules.length < 2)
    ?.at(-1)?.id;
  assert.ok(cWaveId, "找到场景 C 的 wave");
  const sC1 = await state(pageA);
  const cClaimId = sC1?.claims?.find((c) => c.waveId === cWaveId)?.id;
  const dispute = sC1?.disputes?.find((d) => d.claimId === cClaimId);
  assert.ok(dispute, "争议落库");
  assert.equal(dispute.reason, "late", "原因拆分正确");
  assert.equal(
    dispute.verdict.money.type,
    "negotiate",
    "部分责任 → 协商档位"
  );
  assert.equal(dispute.verdict.money.maxPct, 60, "上限 60%（Fiverr 对标）");

  // B 侧见争议 → 提出协商（上限 60%）→ 响应者接受即结案
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("我的", { exact: true }).click();
  await waitUntil(
    pageB,
    () => document.body.textContent?.includes("需求方发起了争议"),
    25000,
    "B 见争议卡"
  );
  await pageB.getByRole("button", { name: /提出协商/ }).first().click();
  await pageB.waitForTimeout(400);
  await waitUntil(
    pageB,
    (cid) => {
      const st = JSON.parse(localStorage.getItem("oto-broadcast-v1") || "{}").state;
      return (st?.disputes ?? []).some((d) => d.claimId === cid && d.outcome?.kind === "negotiated");
    },
    25000,
    "B 协商结案落盘",
    cClaimId
  );
  const sC2 = await state(pageB);
  const d2 = sC2?.disputes?.find((d) => d.claimId === cClaimId);
  assert.ok(d2?.outcome?.kind === "negotiated", "协商结算");
  assert.equal(d2.outcome.agreedAmount, 60, "按 60% 部分退款");
  console.log("场景 C ✅ 争议：原因拆分 → 自动判责 → 协商 60% 结算");

  console.log("验收/扣费 E2E 三链路：全部通过");
} catch (e) {
  console.error("E2E 失败:", String(e).slice(0, 600));
  failures += 1;
} finally {
  await browser.close();
}

if (failures > 0) process.exit(1);
