/**
 * E2E: 长尾动态弹药座舱考卷（DynamicAmmoSlot Duo 化视觉专线）。
 * 用法：node scripts/restart-prod.mjs（3100）→ BASE_URL=http://127.0.0.1:3100 node scripts/e2e-dyn-slot.mjs
 *
 * 独立成卷的原因：dual-role-human 主链路的 Before/After 实拍 dataURL 会把
 * p2p_broadcast 行撑大，后续同行内的第二次发单撞 supabase statement timeout
 *（57014）；本卷独占 `oto::e2e::dyn-slot` 行，无实拍载荷，行内仅一单。
 *
 * 全链路（pet-boarding-v1 · actionSchema.variant=dyn → 真 · DynamicAmmoSlot 本体）：
 *   A 发单(wave active) → B WaveFeed「接单」(openClaim→claim)
 *   → A「谈成 · 锁定」(若弹药可磋商；直达 accepted 则跳过)
 *   → A 行程座舱 [data-slot="dynamic-ammo"] 挂载 → 白底卡落图。
 */
import { chromium } from "playwright-core";
import { getE2eBaseUrl, getDefaultLaunchOptions, isolateBrowserChannels, resetE2eChannelRow } from "./lib/e2e-channel.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const BASE = getE2eBaseUrl();
const NS = "oto::e2e::dyn-slot";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadEnv(p) {
  if (!existsSync(p)) return {};
  const m = {};
  for (const l of readFileSync(p, "utf8").split("\n")) {
    const x = l.match(/^([A-Z_]+)=(.*)$/);
    if (x) m[x[1]] = x[2].trim();
  }
  return m;
}
const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
async function cloudBundle() {
  const { data } = await sb.from("p2p_broadcast").select("state").eq("id", NS).maybeSingle();
  return data?.state ?? {};
}
async function waitCloud(fn, label, timeout = 20000) {
  const start = Date.now();
  for (;;) {
    const b = await cloudBundle();
    const hit = fn(b);
    if (hit) return hit;
    if (Date.now() - start > timeout) throw new Error(`云端行等待超时: ${label}`);
    await sleep(400);
  }
}

async function waitUntil(page, fn, label, arg, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await page.evaluate(fn, arg)) return true;
    } catch {
      /* 页面跳转中忽略 */
    }
    await sleep(300);
  }
  throw new Error(`等待超时: ${label}`);
}

const browser = await chromium.launch(getDefaultLaunchOptions());

isolateBrowserChannels(browser, "dyn-slot", { sandboxBotOff: true });
const cloudOk = await resetE2eChannelRow("dyn-slot");
if (!cloudOk) {
  console.error("💥 云端 p2p_broadcast 通道不可用。请配置 NEXT_PUBLIC_SUPABASE_* 后重跑。");
  process.exit(1);
}

mkdirSync("test-results", { recursive: true });
const step = (who, msg) => console.log(`[${new Date().toISOString().slice(11, 23)}] [${who}] ${msg}`);

const errors = [];
const isNoise = (t) =>
  /429|Failed to load resource|LLM upstream failed|openfreemap/i.test(t) ||
  /^THREE\.(Clock|WebGLProgram)/.test(t) ||
  /Multiple GoTrueClient instances/.test(t);

const ctxA = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });
const pageA = await ctxA.newPage();
const ctxB = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });
const pageB = await ctxB.newPage();

for (const [tag, page] of [["A", pageA], ["B", pageB]]) {
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    const t = m.text();
    if (isNoise(t)) return;
    errors.push(`[${tag}] ${m.type()}: ${t}`);
  });
  page.on("pageerror", (e) => {
    if (isNoise(String(e))) return;
    errors.push(`[${tag}] pageerror: ${String(e).slice(0, 300)}`);
  });
}

try {
  // ═══ 阶段 1：A 发单（宠物寄养 → pet-boarding-v1，真 dyn 插槽）═══
  await pageA.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitUntil(pageA, () => document.querySelectorAll("button").length > 3, "A 首页就绪");
  await pageA.getByRole("button", { name: /想找什么/ }).click();
  await pageA.waitForTimeout(600);
  await pageA.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await pageA.waitForTimeout(500);
  await pageA.getByLabel("需求品类").fill("宠物寄养");
  await pageA.waitForTimeout(600);
  await pageA.getByLabel("petType").selectOption("dog");
  await pageA.getByLabel("petAgeWeight").fill("3岁 15kg");
  await pageA.getByLabel("specialNotes").fill("每日喂食两次 需遛弯");
  await pageA.waitForTimeout(400);
  await pageA.getByLabel("需求时间").fill("后天 10:00");
  await pageA.getByLabel("需求地点").fill("清凉公寓 3 栋");
  await pageA.getByLabel("基础预算").fill("160");
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  await pageA.getByRole("button", { name: /立即支付/ }).click();

  const wave = await waitCloud(
    (b) => (b.waves ?? []).find((w) => w.ammoId === "pet-boarding-v1" && w.status === "active") ?? null,
    "宠物寄养发射落库（云端行）"
  );
  assert.equal(wave.basics.category, "宠物寄养", "落库品类应为 宠物寄养");
  step("A", `发射落库 waveId=${wave.id.slice(0, 12)}… ammoId=${wave.ammoId}`);

  // ═══ 阶段 2：B 真人抢单 ═══
  await pageB.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitUntil(pageB, () => document.querySelectorAll("button").length > 3, "B 首页就绪");
  const preset = await pageB.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("oto-identity-"));
    if (!key) return false;
    const raw = JSON.parse(localStorage.getItem(key) || "{}");
    if (!raw?.state?.identity?.id) return false;
    raw.state.identity.verified = true;
    raw.state.identity.nickname = "王姐";
    raw.state.identity.emoji = "🧹";
    // feed 硬筛按 identity.categories 做品类匹配（category-miss 即不可见）——
    // 默认身份无「宠物寄养」，不断言家政类目时必须显式扩充，否则波卡永不出现。
    if (!((raw.state.identity.categories ?? []).some((c) => String(c).includes("宠物寄养")))) {
      raw.state.identity.categories = [...(raw.state.identity.categories ?? []), "宠物寄养"];
    }
    localStorage.setItem(key, JSON.stringify(raw));
    return true;
  });
  assert.ok(preset, "B 身份预置失败");
  await pageB.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitUntil(pageB, () => document.querySelectorAll("button").length > 3, "B reload 就绪");
  await pageB.getByTestId("home-tab-radar").click();
  await waitUntil(pageB, () => document.body.textContent?.includes("谁正在附近发需求"), 20000, "B 雷达 feed 挂载");

  const card = pageB.locator('[data-layer="wave-feed"]').filter({ hasText: "清凉公寓 3 栋" }).first();
  await card.waitFor({ state: "visible", timeout: 30_000 });
  await card.getByRole("button", { name: /^接单$/ }).click();
  const claim = await waitCloud((b) => (b.claims ?? []).find((c) => c.waveId === wave.id) ?? null, "B claim 落库");
  assert.notEqual(claim.responderId, wave.authorId, "防自发自接");
  step("B", `claim 落库 status=${claim.status}`);

  // ═══ 阶段 3：确认（可磋商分支；直达 accepted 则跳过）═══
  if (claim.status !== "accepted") {
    const navMine = pageA.getByRole("button", { name: /我的波|磋商|需求/ }).first();
    if (await navMine.isVisible().catch(() => false)) await navMine.click();
    await pageA.waitForTimeout(600);
    const acceptBtn = pageA.getByRole("button", { name: /谈成 · 锁定/ }).first();
    await acceptBtn.waitFor({ state: "visible", timeout: 15_000 });
    await acceptBtn.click();
    step("A", "点击「谈成 · 锁定」");
  } else {
    step("A", "非磋商弹药：B 接单即 accepted");
  }
  await waitCloud(
    (b) => (b.claims ?? []).some((c) => c.waveId === wave.id && c.status === "accepted"),
    "claim accepted"
  );

  // ═══ 阶段 4：行程座舱 → DynamicAmmoSlot 白底卡落图 ═══
  await pageA.getByRole("button", { name: "行程", exact: true }).click();
  await pageA.waitForTimeout(900);
  await waitUntil(
    pageA,
    () => !!document.querySelector('[data-slot="dynamic-ammo"]'),
    15000,
    "DynamicAmmoSlot 挂载"
  );
  const slotMeta = await pageA.evaluate(() => {
    const el = document.querySelector('[data-slot="dynamic-ammo"]');
    return { theme: el?.getAttribute("data-theme") ?? "" };
  });
  assert.equal(slotMeta.theme, "default", "pet-boarding 插槽 theme 应为 default（variant dyn）");
  await pageA.locator('[data-slot="dynamic-ammo"]').screenshot({ path: "docs/shot/dyn-slot-duo.png" });
  step("A", "DynamicAmmoSlot Duo 化白底卡落图 docs/shot/dyn-slot-duo.png");
  await pageA.screenshot({ path: "docs/shot/cockpit-duo.png" });
  step("A", "FulfillmentCockpit Duo 化整屏落图 docs/shot/cockpit-duo.png");

  assert.equal(errors.length, 0, `控制台应零业务告警，实际:\n${errors.join("\n")}`);
  console.log("\n🎯 e2e-dyn-slot PASS ✓（长尾弹药座舱 dynamic-ammo 挂载 + Duo 白底实证）");
  process.exit(0);
} catch (err) {
  console.error("\n💥 e2e-dyn-slot FAIL:", err.message);
  try {
    await pageA.screenshot({ path: "test-results/dyn-slot-A.png", fullPage: true });
    await pageB.screenshot({ path: "test-results/dyn-slot-B.png", fullPage: true });
    console.error("双端现场截图已存 test-results/dyn-slot-{A,B}.png");
  } catch {}
  if (errors.length) console.error("控制台告警:\n" + errors.join("\n"));
  process.exit(1);
}
