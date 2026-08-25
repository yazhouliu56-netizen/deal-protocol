/**
 * E2E: P1-3 一键 SOS 联动链 · CDP 硬件流成功态真机考卷。
 * 用法：npm run restart:prod && node scripts/e2e-sos-hardware.mjs
 *
 * 物理凭据目标（严禁空断言/对 NO_GPS_DATA 妥协）：
 *   Chromium --use-fake-device-for-media-stream 提供真实 MediaRecorder 可录制的模拟麦克风流；
 *   CDP Emulation.setGeolocationOverride 注入真实经纬度；
 *   双 tab 驱动 companion-v1（PROXIMITY 引信 sos 四开关全开）：B 接单 → A 作者侧履约座舱挂载
 *   → FulfillmentCenter 按 fuzePolicy.sos 武装轨迹/录音采集（条文 #5）→ 等待首个 5s 录音切片落池
 *   → 点击外骨骼 SOS 锚点 → 断言上报快照含注入坐标轨迹 + ≥1 块音频切片指纹
 *   → 断言 /api/sos/trigger 响应携带服务端权威存证哈希（64-hex）。
 */
import { chromium } from "playwright-core";
import { isolateBrowserChannels, resetE2eChannelRow } from "./lib/e2e-channel.mjs";
import assert from "node:assert/strict";

const BASE = "http://localhost:3000";
const GEO = { latitude: 30.6581, longitude: 104.0654, accuracy: 12 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitUntil(page, fn, timeout = 20000, label = "等待", arg) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await page.evaluate(fn, arg)) return true;
    await sleep(300);
  }
  throw new Error(`等待超时: ${label}`);
}

// 硬件流考卷：与 four-ammos 同款内核选择（系统 chrome 优先，chromium 内置可切换）
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHANNEL === "chromium"
    ? {
        headless: true,
        args: [
          "--use-fake-device-for-media-stream",
          "--use-fake-ui-for-media-stream",
          "--autoplay-policy=no-user-gesture-required",
        ],
      }
    : {
        channel: "chrome",
        headless: true,
        args: [
          "--use-fake-device-for-media-stream",
          "--use-fake-ui-for-media-stream",
          "--autoplay-policy=no-user-gesture-required",
        ],
      }
);

isolateBrowserChannels(browser, "sos-hardware");
let failures = 0;
const verdictLog = [];
const step = (ok, label, detail = "") => {
  if (!ok) failures += 1;
  verdictLog.push({ ok, label });
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};

try {
  await resetE2eChannelRow("sos-hardware");
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });
  const pageA = await ctx.newPage(); // A = 发布者（作者侧座舱武装 + SOS 触发）
  const pageB = await ctx.newPage(); // B = 服务者（接单推进五态）

  const errors = [];
  // 沙盒噪音白名单（console/pageerror 同口径）。零豁免原则：不保留任何
  // Hydration/#418 容忍项——水合缺陷已治愈，此处出现即真实回归。
  // THREE.* 两类为第三方边界（登记于 PROJECT_STATUS）：
  //   - THREE.Clock 弃用告警来自 three.js 库内部 rAF（仓内零处直接调用）；
  //   - WebGLProgram X4122 为 Windows D3D/ANGLE 着色器编译日志（驱动层）。
  //   根治需升级 three 大版本/切换渲染后端，属范围外结构性改动待裁定。
  const isNoise = (t) =>
    /429|Failed to load resource|LLM upstream failed|openfreemap/i.test(t) ||
    /^THREE\.(Clock|WebGLProgram)/.test(t);
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

  // --- 0. 清场进入 ---
  await pageA.goto(BASE, { waitUntil: "domcontentloaded" });
  await pageA.evaluate(() => localStorage.clear());
  await pageB.goto(BASE, { waitUntil: "domcontentloaded" });
  await pageB.evaluate(() => localStorage.clear());
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await pageB.reload({ waitUntil: "domcontentloaded" });

  // --- 1. CDP 注入真实定位（A 页：武装采集 + SOS 快照的坐标源） ---
  await ctx.grantPermissions(["geolocation"], { origin: BASE });
  const cdp = await ctx.newCDPSession(pageA);
  await cdp.send("Emulation.setGeolocationOverride", GEO);
  step(true, "CDP 定位注入", `${GEO.latitude},${GEO.longitude} ±${GEO.accuracy}m`);

  // --- 2. A 发布 companion-v1（陪玩交友，sos 引信全开弹药） ---
  const waitDock = (page, label) =>
    waitUntil(
      page,
      (lbl) =>
        Array.from(document.querySelectorAll("button")).some(
          (b) => b.getAttribute("aria-label") === lbl
        ),
      25000,
      `${label} dock`,
      label
    );
  await waitDock(pageA, "首页");
  await pageA.getByLabel("首页").click();
  await pageA.getByRole("button", { name: /陪伴交友/ }).click();
  await pageA.waitForTimeout(600);
  await pageA.getByRole("button", { name: /扣动扳机·一键发布/ }).click();
  await pageA.waitForTimeout(500);
  await pageA.getByPlaceholder(/时间/).fill("今晚 21:00");
  await pageA.getByPlaceholder(/地点/).fill("天府大剧院西厅");
  await pageA.getByPlaceholder(/基础预算/).fill("100");
  await pageA.getByRole("button", { name: /广播出去/ }).click();
  await pageA.getByRole("button", { name: /立即支付/ }).click();
  await pageA.waitForTimeout(1200);
  // 发布完成弹层若在则关闭（「关闭发布」）
  const closeBtn = await pageA.getByLabel("关闭发布").count();
  if (closeBtn > 0) {
    await pageA.getByLabel("关闭发布").click({ force: true });
    await pageA.waitForTimeout(400);
  }
  await waitUntil(
    pageA,
    () => {
      const s = JSON.parse(localStorage.getItem("oto-broadcast-v1::oto::e2e::sos-hardware") || "{}");
      return (s.state?.waves ?? []).some((w) => w.ammoId === "companion-v1");
    },
    15000,
    "companion 波落库"
  );
  step(true, "companion-v1 波发布", "ammoId 已随广播固化");

  // --- 3. B 上线触发广播式自动应征（sandbox-bot：reload 即 claim accepted） ---
  await waitDock(pageB, "我的");
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.getByLabel("首页").click();
  await waitUntil(
    pageA,
    () => {
      const s = JSON.parse(
        localStorage.getItem("oto-broadcast-v1::oto::e2e::sos-hardware") || "{}"
      );
      return (s.state?.claims ?? []).some(
        (c) => c.status === "accepted" || c.status === "joined"
      );
    },
    25000,
    "claim accepted（A 侧投影 MATCHED）"
  );
  step(true, "B 应征达成", "claim accepted → A 侧五态 MATCHED");

  // --- 4. A 进履约座舱（fuzePolicy.sos 武装：geo-tracker + audio-recorder 启动） ---
  await waitDock(pageA, "行程");
  await pageA.getByLabel("行程").click();
  await waitUntil(
    pageA,
    () => !!document.querySelector('[data-testid="fulfillment-center"]'),
    20000,
    "A 履约座舱挂载"
  );
  await waitUntil(
    pageA,
    () => !!document.querySelector('button[aria-label="SOS 紧急求助"]'),
    15000,
    "外骨骼 SOS 锚点"
  );

  // --- 5. 等待硬件流积累：≥1 个 5s 录音切片落池 + GPS 面包屑多点 ---
  console.log("   ⏳ 采集窗口 7s（MediaRecorder timeslice=5s 首片落池 + watchPosition 多点累积）…");
  await sleep(7000);

  // --- 6. 捕获上报请求/响应 + 触发 SOS ---
  const reqPromise = pageA.waitForRequest(
    (r) => r.url().includes("/api/sos/trigger") && r.method() === "POST",
    { timeout: 30000 }
  );
  const resPromise = pageA.waitForResponse(
    (r) => r.url().includes("/api/sos/trigger") && r.request().method() === "POST",
    { timeout: 30000 }
  );
  await pageA.getByLabel("SOS 紧急求助").click();

  const req = await reqPromise;
  const res = await resPromise;
  const body = await res.json();

  // --- 7. 物理断言：快照成功态（严禁 NO_GPS_DATA 妥协） ---
  const payload = req.postDataJSON();
  const snap = payload.snapshot;
  assert.ok(snap, "上报载荷必须携带司法证据快照");

  const trailHasGeo =
    snap.trajectoryPayload.trail.includes(GEO.latitude.toFixed(6)) &&
    snap.trajectoryPayload.trail.includes(GEO.longitude.toFixed(6));
  step(trailHasGeo, "轨迹面包屑含 CDP 注入坐标", `trail="${snap.trajectoryPayload.trail}"`);
  step(
    !snap.trajectoryPayload.anomalyFlags.includes("NO_GPS_DATA"),
    "无 NO_GPS_DATA 缺省占位",
    `anomalyFlags=${JSON.stringify(snap.trajectoryPayload.anomalyFlags)}`
  );
  step(snap.trajectoryPayload.pointCount >= 1, "GPS 面包屑点数 ≥ 1", `pointCount=${snap.trajectoryPayload.pointCount}`);
  step(
    snap.audioEvidenceSummary.chunkCount >= 1,
    "模拟麦克风切片 ≥ 1 块",
    `chunkCount=${snap.audioEvidenceSummary.chunkCount}`
  );
  const fpOk =
    snap.audioEvidenceSummary.fingerprints.length >= 1 &&
    snap.audioEvidenceSummary.fingerprints.every((f) => /^[0-9a-f]{64}$/.test(f));
  step(fpOk, "切片指纹全部为 SHA-256 64-hex", `fingerprints=${snap.audioEvidenceSummary.fingerprints.length} 枚`);
  step(
    snap.audioEvidenceSummary.integrityOk === true,
    "切片完整性复核通过"
  );
  step(/^sos-\d+-[0-9a-z]+-[0-9a-f]{8}$/.test(snap.snapshotId), "确定性 snapshotId 在案", snap.snapshotId);

  // --- 8. 服务端权威哈希响应断言（64-hex + 升级链初始化） ---
  assert.equal(body.success, true, "服务端受理成功");
  assert.match(body.forensic.authoritativeHash, /^[0-9a-f]{64}$/, "权威存证哈希 64-hex");
  assert.equal(body.crisis.escalationPhase, "TRIGGERED", "升级链 TRIGGERED 初始化");
  step(true, "服务端权威哈希固化", `authoritativeHash=${body.forensic.authoritativeHash.slice(0, 16)}… persisted=${body.forensic.persisted}`);

  // --- 9. UI 旁证：SOS toast + 徽标数据回流 ---
  await waitUntil(
    pageA,
    () => document.body.textContent?.includes("SOS 已上报"),
    10000,
    "SOS toast"
  );
  step(true, "UI 层 SOS 上报旁证", "toast「🚨 SOS 已上报」可见");

  // --- 10. 汇总 ---
  assert.equal(errors.length, 0, `零 console error，实际: ${errors.join(" | ")}`);
  step(errors.length === 0, "零 console error");

  await pageA.screenshot({ path: "e2e-sos-hardware-final.png", fullPage: false });
  if (failures > 0) {
    console.error("失败断言明细:", JSON.stringify(verdictLog.filter((v) => !v.ok)));
    throw new Error(`${failures} 项断言未通过`);
  }
  console.log("\n🎯 e2e-sos-hardware PASS ✓（CDP 硬件流成功态全链路物理凭据齐备）");
} catch (err) {
  console.error("\n💥 e2e-sos-hardware FAIL:", String(err).slice(0, 800));
  process.exitCode = 1;
} finally {
  await browser.close();
}
