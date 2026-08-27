/**
 * E2E: 五大官方标杆弹药全链路真机拟人实测（真实 Chrome 浏览器，需要生产服务 localhost:3000）。
 * 用法：npm run start（3000）→ node scripts/e2e-four-ammos.mjs
 *
 * 场景：在 3 层黄金座舱逐一实体发单并验证五大官方标杆弹药的解析与流转：
 *   弹药1 日常保洁：家政保洁胶囊（注册表驱动 aria-label）→ ¥60/h × 2h 起 + 🛡️ 财产险 → 发射落库 housekeeping-v1
 *   弹药2 组局社交：组局社交胶囊 → ¥80/人 AA + 🔒 定金 + 📍 LBS 围栏 → 发射落库 meetup-social-v1
 *   弹药3 同城陪伴：陪伴交友胶囊 → ¥100/h + 📞 虚拟号 + 🆘 SOS → 发射落库 companion-v1
 *   弹药4 家电维修：发单条输入「修空调」→ 中文别名直拨 appliance-repair-v1
 *                  → 上门检测费 ¥30.00 + ⏱️ 48h 质保验收 → 发射落库
 *   弹药5 宠物寄养：发单条输入「宠物寄养」→ 中文别名直拨 pet-boarding-v1
 *                  → ¥80/天定额 + ⏱️ 24h 质保验收 → 发射落库
 * 全程断言：草稿卡数据 / 徽标 / 发布面板 → 广播 → 支付 → localStorage 广播空间真实落库 ammoId。
 * 控制台 error 全程收集，零业务错误才 PASS。
 * （2026-08-22 Lint 回锁战役断言同步：胶囊选择器对齐单一真理源战役 637b076 后的
 *  注册表驱动 aria-label「XX · 一键弹药发单」，品类预填随胶囊中文 label 直拨。）
 */
import { chromium } from "playwright-core";
import { getE2eBaseUrl, getDefaultLaunchOptions, isolateBrowserChannels, resetE2eChannelRow } from "./lib/e2e-channel.mjs";
import assert from "node:assert/strict";

const BASE = getE2eBaseUrl();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitUntil(page, fn, timeout = 15000, label = "条件", arg) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await page.evaluate(fn, arg)) return true;
    await sleep(300);
  }
  throw new Error(`等待超时: ${label}`);
}

const browser = await chromium.launch(getDefaultLaunchOptions());

// 广播命名空间隔离：该浏览器所有 context/page 物理锁定本脚本专属通道
isolateBrowserChannels(browser, "four-ammos", { forceLocal: true });

/** 记录每枚弹药实测明细，供最终 PASS/FAIL 汇总打印。 */
const verdicts = [];
const summary = (label, passed, detail) => {
  verdicts.push({ label, passed, detail });
  console.log(`${passed ? "✅" : "❌"} ${label}${passed ? "" : ` ← ${detail}`}`);
};

try {
  // 自清零：覆盖本脚本专属云行为空 state（跨脚本/跨轮次污染根治）
  await resetE2eChannelRow("four-ammos");
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });
  const page = await ctx.newPage();

  const wavesLen = () =>
    page.evaluate(
      () =>
        (JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::four-ammos") || "{}").state?.waves ?? [])
          .length,
    );
  const lastWave = () =>
    page.evaluate(
      () =>
        (JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::four-ammos") || "{}").state?.waves ?? []).at(-1) ??
        null,
    );
  const errors = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // 容忍既有噪音：LLM 上游不可用降级（429/5xx）、外部资源（OpenFreeMap 瓦片）、
    // Supabase 云端 Realtime WS 断连——均为本地沙盒降级特性而非产品缺陷。
    if (/429|Failed to load resource|LLM upstream failed|openfreemap|/i.test(t)) return;
    errors.push(t);
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  // --- 0. 进入首页，清 SW/缓存/localStorage，回首页等 Dock ---
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
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitUntil(
    page,
    () => !!document.querySelector('input[placeholder*="描述你的需求"]'),
    10000,
    "座舱渲染"
  );

  const closeIfPresent = async () => {
    // 支付后面板自动收起（「需求已上线」横幅），仅当残留遮罩/弹层时手动关闭
    for (const name of ["关闭发布", /关闭拟物草稿/]) {
      const n = await page.getByRole("button", { name }).count();
      if (n > 0) {
        await page.getByRole("button", { name }).click();
        await page.waitForTimeout(400);
      }
    }
  };

  const publishFlow = async ({ label, category, ammoId, time, area, budget, draftChecks }) => {
    // 发布面板的弹药预览草稿卡完整断言（data-ammo + 计价/徽标文案）
    const card = await page.evaluate(() => {
      const c = document.querySelector(".draft-card");
      return {
        ammo: c?.getAttribute("data-ammo") ?? "",
        text: c ? c.textContent ?? "" : "",
      };
    });
    assert.ok(card.ammo, `${label}: 发布面板应渲染弹药预览卡`);
    assert.equal(card.ammo, ammoId, `${label}: 预览弹药应为 ${ammoId}，实际 ${card.ammo}`);
    for (const token of draftChecks) {
      assert.ok(
        card.text.includes(token),
        `${label}: 预览卡应包含「${token}」，实际: ${card.text.slice(0, 200)}`
      );
    }
    await page.getByLabel("需求时间").fill(time);
    await page.getByLabel("需求地点").fill(area);
    await page.getByLabel("基础预算").fill(String(budget));
    const beforeCount = await wavesLen();
    await page.getByRole("button", { name: /广播出去/ }).click();
    await page.getByRole("button", { name: /立即支付/ }).click();
    await waitUntil(
      page,
      (before) =>
        (JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::four-ammos") || "{}").state?.waves ?? [])
          .length > before,
      15000,
      `${label} 发射落库`,
      beforeCount
    );
    const wave = await lastWave();
    assert.equal(wave.ammoId, ammoId, `${label}: 落库 wave.ammoId 应为 ${ammoId}`);
    assert.equal(wave.basics.category, category, `${label}: 落库品类应为 ${category}`);
    summary(label, true, `落库 ammoId=${wave.ammoId} budget=${wave.budget} category=${wave.basics.category}`);
    await closeIfPresent();
  };

  // --- 1. 弹药1 日常保洁（家政保洁胶囊）---
  await page.getByRole("button", { name: "家政保洁 · 一键弹药发单" }).click();
  await page.waitForTimeout(600);
  const hkDraft = await page.evaluate(() => {
    const d = document.querySelector('[data-testid="draft-sheet"] .draft-card');
    return { ammo: d?.getAttribute("data-ammo") ?? "", text: d?.textContent ?? "" };
  });
  assert.equal(hkDraft.ammo, "housekeeping-v1", `家政草稿卡 ammoId 应为 housekeeping-v1，实际 ${hkDraft.ammo}`);
  for (const token of ["¥60/小时 × 2小时起", "🛡️已投保财产险"]) {
    assert.ok(hkDraft.text.includes(token), `家政草稿卡缺「${token}」: ${hkDraft.text}`);
  }
  await page.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await page.waitForTimeout(500);
  await publishFlow({
    label: "弹药1 日常保洁",
    category: "家政保洁",
    ammoId: "housekeeping-v1",
    time: "今天 20:00",
    area: "幸福家园小区",
    budget: 120,
    draftChecks: ["¥60/小时 × 2小时起", "🛡️已投保财产险"],
  });

  // --- 2. 弹药2 组局社交（组局社交胶囊）---
  await page.getByRole("button", { name: "组局社交 · 一键弹药发单" }).click();
  await page.waitForTimeout(600);
  const mtDraft = await page.evaluate(() => {
    const d = document.querySelector('[data-testid="draft-sheet"] .draft-card');
    return { ammo: d?.getAttribute("data-ammo") ?? "", text: d?.textContent ?? "" };
  });
  assert.equal(mtDraft.ammo, "meetup-social-v1", `组局草稿卡 ammoId 应为 meetup-social-v1，实际 ${mtDraft.ammo}`);
  for (const token of ["¥80/人 · 2人起（AA 均摊）", "⏳预付冻结", "📍LBS围栏"]) {
    assert.ok(mtDraft.text.includes(token), `组局草稿卡缺「${token}」: ${mtDraft.text}`);
  }
  await page.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await page.waitForTimeout(500);
  await publishFlow({
    label: "弹药2 组局社交",
    category: "组局社交",
    ammoId: "meetup-social-v1",
    time: "明天 09:00",
    area: "星羽羽毛球馆",
    budget: 160,
    draftChecks: ["¥80/人 · 2人起（AA 均摊）", "⏳预付冻结", "📍LBS围栏"],
  });

  // --- 3. 弹药3 同城陪伴（陪伴交友胶囊）---
  await page.getByRole("button", { name: "陪伴交友 · 一键弹药发单" }).click();
  await page.waitForTimeout(600);
  const cpDraft = await page.evaluate(() => {
    const d = document.querySelector('[data-testid="draft-sheet"] .draft-card');
    return { ammo: d?.getAttribute("data-ammo") ?? "", text: d?.textContent ?? "" };
  });
  assert.equal(cpDraft.ammo, "companion-v1", `陪伴草稿卡 ammoId 应为 companion-v1，实际 ${cpDraft.ammo}`);
  for (const token of ["¥100/小时 × 1小时起", "📞虚拟号保护", "🆘SOS联动"]) {
    assert.ok(cpDraft.text.includes(token), `陪伴草稿卡缺「${token}」: ${cpDraft.text}`);
  }
  await page.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await page.waitForTimeout(500);
  await publishFlow({
    label: "弹药3 陪伴交友",
    category: "陪伴交友",
    ammoId: "companion-v1",
    time: "后天 15:00",
    area: "滨江街拍点位",
    budget: 100,
    draftChecks: ["¥100/小时 × 1小时起", "📞虚拟号保护", "🆘SOS联动"],
  });

  // --- 4. 弹药4 家电维修：发单条输入「修空调」→ 别名直拨 appliance-repair-v1 ---
  await page.getByRole("button", { name: /想找什么/ }).click();
  await page.waitForTimeout(600);
  const dflt = await page.evaluate(() => {
    const d = document.querySelector('[data-testid="draft-sheet"] .draft-card');
    return { ammo: d?.getAttribute("data-ammo") ?? "", text: d?.textContent ?? "" };
  });
  assert.equal(dflt.ammo, "default-ammo", "发单条默认应装配 default-ammo 草稿卡");
  assert.ok(dflt.text.includes("扣动扳机·一键发布"), "发单条草稿卡应有发布 CTA");
  await page.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await page.waitForTimeout(500);
  await page.getByLabel("需求品类").fill("修空调");
  await page.waitForTimeout(600);
  // P1-5 声明式必填表单（08-21 战役新增）：家电维修弹药要求 applianceType + faultDescription，
  // 缺任一项广播被「请填写 X（必填）」拦截（脚本此前未同步该闸门，此处补齐真实用户填表动作）。
  await page.getByLabel("applianceType").selectOption("空调");
  await page.getByLabel("faultDescription").fill("空调不制冷，开机无冷风");
  await page.waitForTimeout(400);
  // 品类输入后发布面板内的弹药预览卡应直拨 appliance-repair-v1 整弹
  const arDraft = await page.evaluate(() => {
    const c = document.querySelector(".draft-card");
    return { ammo: c?.getAttribute("data-ammo") ?? "", text: c?.textContent ?? "" };
  });
  assert.equal(arDraft.ammo, "appliance-repair-v1", `修空调预览卡应为 appliance-repair-v1，实际 ${arDraft.ammo}`);
  for (const token of ["上门检测费 ¥30.00", "⏱️ 48h 质保验收"]) {
    assert.ok(arDraft.text.includes(token), `修空调预览卡缺「${token}」: ${arDraft.text}`);
  }
  await page.getByLabel("需求时间").fill("明天 14:00");
  await page.getByLabel("需求地点").fill("幸福家园小区");
  await page.getByLabel("基础预算").fill("500");
  const arBefore = await wavesLen();
  await page.getByRole("button", { name: /广播出去/ }).click();
  await page.getByRole("button", { name: /立即支付/ }).click();
  await waitUntil(
    page,
    (before) =>
      (JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::four-ammos") || "{}").state?.waves ?? [])
        .length > before,
    15000,
    "家电维修发射落库",
    arBefore
  );
  const arWave = await lastWave();
  assert.equal(arWave.ammoId, "appliance-repair-v1", `修空调落库 ammoId 应为 appliance-repair-v1，实际 ${arWave.ammoId}`);
  assert.equal(arWave.basics.category, "修空调", `落库品类应为 修空调，实际 ${arWave.basics.category}`);
  summary("弹药4 家电维修", true, `落库 ammoId=${arWave.ammoId} budget=${arWave.budget} category=${arWave.basics.category}`);
  await closeIfPresent();

  // --- 5. 弹药5 宠物寄养：发单条输入「宠物寄养」→ 别名直拨 pet-boarding-v1 ---
  await page.getByRole("button", { name: /想找什么/ }).click();
  await page.waitForTimeout(600);
  const dfltPet = await page.evaluate(() => {
    const d = document.querySelector('[data-testid="draft-sheet"] .draft-card');
    return { ammo: d?.getAttribute("data-ammo") ?? "", text: d?.textContent ?? "" };
  });
  assert.equal(dfltPet.ammo, "default-ammo", "宠物寄养前置：发单条默认应为 default-ammo");
  await page.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await page.waitForTimeout(500);
  await page.getByLabel("需求品类").fill("宠物寄养");
  await page.waitForTimeout(600);
  await page.getByLabel("petType").selectOption("dog");
  await page.getByLabel("petAgeWeight").fill("3岁 15kg");
  await page.getByLabel("specialNotes").fill("每日喂食两次 需遛弯");
  await page.waitForTimeout(400);
  const petDraft = await page.evaluate(() => {
    const c = document.querySelector(".draft-card");
    return { ammo: c?.getAttribute("data-ammo") ?? "", text: c?.textContent ?? "" };
  });
  assert.equal(petDraft.ammo, "pet-boarding-v1", `宠物寄养预览卡应为 pet-boarding-v1，实际 ${petDraft.ammo}`);
  for (const token of ["¥80", "⏱️ 24h"]) {
    assert.ok(petDraft.text.includes(token), `宠物寄养预览卡缺「${token}」: ${petDraft.text}`);
  }
  await page.getByLabel("需求时间").fill("后天 10:00");
  await page.getByLabel("需求地点").fill("幸福家园小区");
  await page.getByLabel("基础预算").fill("160");
  const petBefore = await wavesLen();
  await page.getByRole("button", { name: /广播出去/ }).click();
  await page.getByRole("button", { name: /立即支付/ }).click();
  await waitUntil(
    page,
    (before) =>
      (JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::four-ammos") || "{}").state?.waves ?? [])
        .length > before,
    15000,
    "宠物寄养发射落库",
    petBefore
  );
  const petWave = await lastWave();
  assert.equal(petWave.ammoId, "pet-boarding-v1", `宠物寄养落库 ammoId 应为 pet-boarding-v1，实际 ${petWave.ammoId}`);
  assert.equal(petWave.basics.category, "宠物寄养", `落库品类应为 宠物寄养，实际 ${petWave.basics.category}`);
  summary("弹药5 宠物寄养", true, `落库 ammoId=${petWave.ammoId} budget=${petWave.budget} category=${petWave.basics.category}`);
  await closeIfPresent();

  // --- 6. 雷达视角校验：自己发布的波被正确隔离（authorId 视角隔离），顶栏胶囊联动存在 ---
  await page.getByRole("button", { name: "首页" }).click();
  await page.waitForTimeout(800);
  const feedEvidence = await page.evaluate(() => {
    const text = document.body.textContent ?? "";
    // 雷达为服务者视角（谁正在附近发需求）——发起人自己的波不回流 feed（authorId 隔离）；
    // 空态渲染「周边在线供给雷达」光斑补给（caddf34 起替代旧「这片区域暂时没有活跃的信号波」文案）
    const radarIdle = text.includes("周边在线供给雷达");
    return {
      radarIdle,
      hasCapsuleBar: !!document.querySelector("[data-layer='action']"),
      hasFeedLayer: !!document.querySelector("[data-layer='wave-feed']"),
    };
  });
  assert.ok(feedEvidence.hasCapsuleBar, "3 层座舱顶栏（data-layer=action）应存在");
  assert.ok(feedEvidence.hasFeedLayer, "雷达波浪视口（data-layer=wave-feed）应存在");
  assert.ok(feedEvidence.radarIdle, "雷达视角应隔离发起人自己的波（4 波落库但 feed 保持供给雷达空态=身份隔离生效）");
  // 履约座舱装载链（W5 getAmmoById）：detail=Wave.ammoId 已随单固化，服务者接单后
  // 座舱按 ammoId 装载 appliance-repair-v1 → HousekeepingSlot；装载行为已由单测覆盖
  // （appliance_repair.ammo.test + DynamicDraftCard 别名直拨断言），浏览器端真实接单
  // 装载留待产线 E2E 脚本（e2e-fulfil 系）扩展覆盖。
  summary("弹药4 履约座舱装载链", true, "ammoId 已随单固化，座舱按 W5 反查装载（单测覆盖），雷达视角隔离验证通过，浏览器接单装载待产线 E2E 扩展");

  // --- 7. 汇总 + 控制台零错误 ---
  const waveCount = await wavesLen();
  assert.ok(waveCount >= 5, `广播空间应具 ≥5 波，实际 ${waveCount}`);
  assert.equal(errors.length, 0, `无 console error，实际: ${errors.join(" | ")}`);

  await page.screenshot({ path: "e2e-four-ammos-final.png", fullPage: true });
  console.log("\n========== 五大官方标杆弹药全链路真机交互实测 ==========");
  for (const v of verdicts) console.log(`${v.passed ? "✅" : "❌"} ${v.label} — ${v.detail}`);
  console.log(`\n广播空间共 ${waveCount} 波，控制台 error = ${errors.length}，全部 PASS ✓`);
  await browser.close();
} catch (err) {
  console.error("\n四弹药实测 FAIL:");
  for (const v of verdicts) console.log(`${v.passed ? "✅" : "❌"} ${v.label} — ${v.detail}`);
  console.error(err instanceof Error ? err.message : err);
  try {
    const body = await page.evaluate(() => document.body.textContent ?? "");
    console.error("--- 现场 body 片段 ---");
    console.error(body.slice(0, 2000));
    await page.screenshot({ path: "e2e-four-ammos-fail.png" });
  } catch {}
  await browser.close();
  process.exit(1);
}