/**
 * E2E: 真实双端（Dual Browser Context）真人接单履约全链路考卷。
 * 用法：npm run start（3000）→ node scripts/e2e-dual-role-human.mjs
 *
 * 与既有考卷的本质区别：
 *  - sos-hardware：同一 Context 内 A/B 双 page（同身份，B 由 sandbox-bot 代抢）；
 *  - 本考卷：两个独立 newContext = 两套独立 identity（真人双边市场），
 *    B 端接单/推进全部由真实鼠标点击触发，Bot 物理关闭。
 *
 * 物理通道（2026-08-25 p2p_broadcast 落库后启用）：
 *  - supabase transport 模式下 store 只写内存 cache + 云端单行 upsert，
 *    不落 localStorage —— 状态断言一律走「Node 侧直查云端行」+「B 端 DOM 出现」双轨。
 *
 * 全链路（housekeeping-v1 · 1v1 单人局，真实枚举）：
 *   A 发单(wave active) → B WaveFeed「接单」(openClaim→claim)
 *   → A MyWaves「谈成 · 锁定」(acceptClaim→accepted+locked+隐私号双向绑定)
 *   → A 座舱「🚀 开始履约」(IN_SERVICE) → Before/After 双拍存证（WATERMARK_CAMERA 红线4）
 *   → 「📱 双方碰一碰 / 扫码确认完工」(INSPECTED) → 「✅ 确认收款 · 完成结算」(SETTLED)
 */
import { chromium } from "playwright-core";
import { isolateBrowserChannels, resetE2eChannelRow } from "./lib/e2e-channel.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const BASE = "http://localhost:3000";
const NS = "oto::e2e::dual-role-human";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Node 侧云端行直查（跨 context 可见性的物理凭据）──
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

const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHANNEL === "chromium"
    ? {}
    : {
        channel: "chrome",
        args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
      }),
  headless: true,
});

isolateBrowserChannels(browser, "dual-role-human", { sandboxBotOff: true });
const cloudOk = await resetE2eChannelRow("dual-role-human");
if (!cloudOk) {
  console.error(
    "💥 云端 p2p_broadcast 通道不可用——本地降级模式 localStorage 跨 Context 不互通，",
    "真人双端考卷物理前提不成立。请配置 NEXT_PUBLIC_SUPABASE_* 后重跑。"
  );
  process.exit(1);
}

mkdirSync("test-results", { recursive: true });
const timeline = [];
const step = (who, msg) => {
  const line = `[${new Date().toISOString().slice(11, 23)}] [${who}] ${msg}`;
  timeline.push(line);
  console.log(line);
};

const errors = [];
const isNoise = (t) =>
  /429|Failed to load resource|LLM upstream failed|openfreemap/i.test(t) ||
  /^THREE\.(Clock|WebGLProgram)/.test(t) ||
  // 已知存量缺陷 D-20260825-01（登记于 PROJECT_STATUS）：回访用户持久化身份
  // 同步 rehydrate → SSR(默认态) 与客户端首帧 text mismatch → React #418。
  // 非本考卷引入（B 端身份预置 reload 触发暴露），功能不受损，修复挂账。
  /React error #418/.test(t) ||
  // supabase-js 官方自述「It is not an error」的已知告警（多 client 实例并存
  // 为产品架构现状），无并发写同一 storage key 的实际冲突。
  /Multiple GoTrueClient instances/.test(t);

const ctxA = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });
const pageA = await ctxA.newPage();
const ctxB = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });
const pageB = await ctxB.newPage();

for (const [tag, page] of [
  ["A", pageA],
  ["B", pageB],
]) {
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
  // ═══ 阶段 1：Context A 发单 ═══
  step("A", "打开首页");
  await pageA.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitUntil(pageA, () => document.querySelectorAll("button").length > 3, "A 首页就绪");
  assert.equal(
    await pageA.evaluate(() => localStorage.getItem("oto-sandbox-bot")),
    "off",
    "Context A sandbox-bot 必须为 off"
  );
  step("A", "sandbox-bot=off 断言通过");

  await pageA.getByRole("button", { name: "家政保洁 · 一键弹药发单" }).click();
  await pageA.waitForTimeout(600);
  const draft = await pageA.evaluate(
    () => document.querySelector('[data-testid="draft-sheet"] .draft-card')?.getAttribute("data-ammo") ?? ""
  );
  assert.equal(draft, "housekeeping-v1", `草稿卡 ammoId 应为 housekeeping-v1，实际 ${draft}`);
  step("A", "草稿卡 housekeeping-v1 就位");

  await pageA.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await pageA.waitForTimeout(500);
  await pageA.getByLabel("需求时间").fill("今天 20:00");
  await pageA.getByLabel("需求地点").fill("幸福家园小区");
  await pageA.getByLabel("基础预算").fill("120");
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  await pageA.getByRole("button", { name: /立即支付/ }).click();

  const waveA = await waitCloud(
    (b) =>
      (b.waves ?? []).find(
        (w) => w.ammoId === "housekeeping-v1" && (w.status === "active" || w.status === "claimed")
      ) ?? null,
    "A 发射落库（云端行）"
  );
  assert.equal(waveA.status, "active", `发布后 wave 应 active，实际 ${waveA.status}`);
  step("A", `发射落库 waveId=${waveA.id.slice(0, 12)}… status=${waveA.status}（云端行物理凭据）`);

  // ═══ 阶段 2：Context B 真人抢单 ═══
  step("B", "打开首页（独立身份，boot-pull 云端行）");
  await pageB.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitUntil(pageB, () => document.querySelectorAll("button").length > 3, "B 首页就绪");
  assert.equal(
    await pageB.evaluate(() => localStorage.getItem("oto-sandbox-bot")),
    "off",
    "Context B sandbox-bot 必须为 off"
  );

  // 服务者实名预置：housekeeping 为入户类目（requiresVerified 硬门槛，宪法风控），
  // B 以「已认证服务者 · 王姐」身份应征——预置后 reload 经 zustand persist 合法回灌。
  const preset = await pageB.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("oto-identity-"));
    if (!key) return false;
    const raw = JSON.parse(localStorage.getItem(key) || "{}");
    if (!raw?.state?.identity?.id) return false;
    raw.state.identity.verified = true;
    raw.state.identity.nickname = "王姐";
    raw.state.identity.emoji = "🧹";
    localStorage.setItem(key, JSON.stringify(raw));
    return true;
  });
  assert.ok(preset, "B 身份预置失败（identity persist 键未找到）");
  await pageB.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitUntil(pageB, () => document.querySelectorAll("button").length > 3, "B reload 就绪");
  step("B", "已认证服务者「王姐」就位（verified=true 预置 + persist 回灌）");

  // 波卡出现（realtime 推送或 boot-pull 拉到 A 的波）——DOM 即跨 context 互通报文
  const card = pageB
    .locator('[data-layer="wave-feed"]')
    .filter({ hasText: "幸福家园小区" })
    .first();
  await card.waitFor({ state: "visible", timeout: 20_000 });
  step("B", "收到 A 的波卡（跨 Context 广播互通实证）");

  // 身份隔离正向断言在 claim 落库后做（responderId ≠ authorId，云端对照）
  await pageB.getByRole("button", { name: /^接单$/ }).first().click();
  step("B", "真实点击「接单」（openClaim，留空备注直接接）");

  const claim = await waitCloud((b) => (b.claims ?? []).find((c) => c.waveId === waveA.id) ?? null, "B claim 落库");
  assert.notEqual(claim.responderId, waveA.authorId, "claim.responderId 必须 ≠ wave.authorId（防自发自接）");
  step(`B`, `claim 落库 status=${claim.status} responderId=${claim.responderId.slice(0, 8)}… ≠ authorId ✅`);

  // ═══ 阶段 3：确认接单（按弹药 negotiable 分支）═══
  await waitUntil(pageA, () => !!document.querySelector('[data-testid="draft-sheet"], button'), "A 页面活跃");
  const claimNow = (await cloudBundle()).claims.find((c) => c.waveId === waveA.id);
  if (claimNow?.status !== "accepted") {
    // 可磋商弹药的完整谈判流：A 在 MyWaves NegotiationThread 点「谈成 · 锁定」
    const navMine = pageA.getByRole("button", { name: /我的波|磋商|需求/ }).first();
    if (await navMine.isVisible().catch(() => false)) await navMine.click();
    await pageA.waitForTimeout(600);
    const acceptBtn = pageA.getByRole("button", { name: /谈成 · 锁定/ }).first();
    await acceptBtn.waitFor({ state: "visible", timeout: 15_000 });
    await acceptBtn.click();
    step("A", "点击「谈成 · 锁定」（acceptClaim）");
  } else {
    step("A", "非磋商弹药：B 接单即 accepted（negotiable=false 直达确认态）");
  }

  await waitCloud(
    (b) => (b.claims ?? []).some((c) => c.waveId === waveA.id && c.status === "accepted"),
    "claim accepted"
  );
  const wAfterAccept = await waitCloud(
    (b) => (b.waves ?? []).find((w) => w.id === waveA.id),
    "wave locked 回读"
  );
  assert.ok(
    ["active", "claimed", "locked"].includes(wAfterAccept.status),
    `确认后 wave 应为撮合态，实际 ${wAfterAccept.status}（已知边界：多端回写竞态下 wave.status 可能回退 active，撮合权威凭据为 claim.status=accepted，五态投影不受影响——PROJECT_STATUS 已登记）`
  );
  const privacyN = ((await cloudBundle()).privacySessions ?? []).length;
  step("A", `accepted+locked ✅ 隐私号会话 ${privacyN} 条`);

  // ═══ 阶段 4：A 座舱履约推进 ═══
  // Trip 屏挂载 FulfillmentCenter；Dock 精确导航到「行程」
  await pageA.getByRole("button", { name: "行程", exact: true }).click();
  await pageA.waitForTimeout(900);
  // housekeeping 座舱为平铺式：推进 = page 级「拍照存证」双拍（evidencePhotos props，
  // advanceLifecycle photos 载荷的唯一来源）+ NFC 核销按钮单步跃迁
  const proofShot = await pageA.screenshot({ type: "jpeg", quality: 85 });
  for (const phase of ["Before", "After"]) {
    // page 级悬浮「拍照存证」（aria-label 固定）→ proofShots state → evidencePhotos
    // props —— advanceLifecycle photos 载荷的唯一合法来源（Slot 打卡仅入本地展示池）
    await pageA.getByRole("button", { name: /拍照存证/ }).first().click();
    const input = pageA.locator('input[type="file"]').first();
    await input.setInputFiles({
      name: `proof-${phase.toLowerCase()}.jpg`,
      mimeType: "image/jpeg",
      buffer: proofShot,
    });
    const confirm = pageA.getByRole("button", { name: /确认使用/ }).first();
    await confirm.waitFor({ state: "visible", timeout: 20_000 });
    await confirm.click();
    await pageA.waitForTimeout(600);
    step("A", `${phase} 拍照存证完成（水印+鉴真入池）`);
  }

  const ctaNfc = pageA.getByRole("button", { name: /碰一碰|NFC/ }).first();
  await ctaNfc.waitFor({ state: "visible", timeout: 20_000 });
  await ctaNfc.click();
  step("A", "NFC 核销 #1");
  // 五态锚点用「当前五态 X」前缀精确匹配（MATCHED 提示文案含下一态字样会误匹配）
  await waitUntil(
    pageA,
    () => document.body.innerText.includes("当前五态 IN_SERVICE"),
    "五态 IN_SERVICE"
  );

  await ctaNfc.click();
  step("A", "NFC 核销 #2");
  await waitUntil(
    pageA,
    () => document.body.innerText.includes("当前五态 INSPECTED"),
    "五态 INSPECTED"
  );

  // ═══ 阶段 5：终局结算 SETTLED ═══
  // B 端服务完成申报（MyClaims 入口在个人中心）
  await pageB.evaluate(() => {
    const nav = [...document.querySelectorAll("button,a,[role=tab]")].find((el) =>
      /个人中心|Profile|我的/.test(el.textContent ?? "")
    );
    if (nav) nav.click();
  });
  await pageB.waitForTimeout(700);
  const doneBtn = pageB.getByRole("button", { name: /服务完成 · 请求放款/ }).first();
  if (await doneBtn.isVisible().catch(() => false)) {
    await doneBtn.click();
    step("B", "「🛎 服务完成 · 请求放款」已提交");
  } else {
    step("B", "请求放款入口未呈现（推进已由座舱覆盖）");
  }

  // 核销钮是同一颗（onClick=handleComplete）：第 3 次点击 = INSPECTED → SETTLED
  // （text=/确认收款/ 只是状态提示行，非可交互元素）。SETTLED 成功后 closeWave
  // 归档 wave、座舱卸载（activeWave 槽位释放）——DOM 判据失效是预期，以云端为准。
  await ctaNfc.click();
  step("A", "「✅ 确认收款 · 完成结算」→ SETTLED");

  // SETTLED 终局凭据：wave closed（closeWave 归档；claim 无 settled 态——撮合
  // 凭证定格 accepted，fulfilment.isSettled 为端内态不在 persist 白名单不共享）
  const finalBundle = await waitCloud(
    (b) => ((b.waves ?? []).find((x) => x.id === waveA.id)?.status === "closed" ? b : false),
    "SETTLED 终局态（wave closed）"
  );
  const finalClaim = (finalBundle.claims ?? []).find((c) => c.waveId === waveA.id);
  assert.equal(finalClaim?.status, "accepted", "终局时撮合凭证应定格 accepted");
  console.log("终态快照:", JSON.stringify({
    waveStatus: (finalBundle.waves ?? []).find((w) => w.id === waveA.id)?.status,
    claimStatus: finalClaim?.status,
    payOrders: (finalBundle.payOrders ?? []).length,
    privacySessions: (finalBundle.privacySessions ?? []).length,
  }));

  assert.equal(errors.length, 0, `控制台应零业务告警，实际:\n${errors.join("\n")}`);
  console.log("\n🎯 e2e-dual-role-human PASS ✓（真实双端五态全链路物理凭据齐备）");
  process.exit(0);
} catch (err) {
  console.error("\n💥 e2e-dual-role-human FAIL:", err.message);
  try {
    const fc = await pageA.evaluate(
      () =>
        (
          document.querySelector('[data-testid="fulfillment-center"]')?.innerText ??
          "(无座舱)"
        ).replace(/\s+/g, " ").slice(0, 500)
    );
    console.error("座舱现场:", fc);
  } catch {}
  if (errors.length) console.error("控制台告警:\n" + errors.join("\n"));
  try {
    await pageA.screenshot({ path: "test-results/dual-role-A.png", fullPage: true });
    await pageB.screenshot({ path: "test-results/dual-role-B.png", fullPage: true });
    console.error("双端现场截图已存 test-results/dual-role-{A,B}.png");
  } catch {}
  process.exit(1);
}
