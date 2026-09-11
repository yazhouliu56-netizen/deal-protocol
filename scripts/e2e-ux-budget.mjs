/** Batch③-5 UX 预算门禁：首屏按钮上限 + 折叠完整性 + 空卡合一 + AR 降级 + SOS 条件。
 * 访客态（无在途单）普查；任一超标即 FAIL，防止入口只加不减复发。 */
import assert from "node:assert";
import { chromium } from "playwright";
import { getE2eBaseUrl, getDefaultLaunchOptions, isolateBrowserChannels } from "./lib/e2e-channel.mjs";

// 访客态普查，无需云端行。
const browser = await chromium.launch(getDefaultLaunchOptions());
isolateBrowserChannels(browser, "ux-budget", { sandboxBotOff: true });
const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
await page.goto(getE2eBaseUrl(), { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForFunction(() => document.querySelectorAll("button").length > 3, null, { timeout: 30_000 });
await page.waitForTimeout(800);

const visBtns = () => page.evaluate(() => [...document.querySelectorAll("button")].filter((b) => b.offsetParent !== null).length);

// 1. 首页发单段：可见 button ≤ 18（Batch③-1 实测 18，锁死棘轮只减不增）
const n0 = await visBtns();
assert.ok(n0 <= 18, `首页可见按钮 ${n0} 超预算 18`);
// 2. 折叠完整性：更多发单方式存在；说句话/AI 撮合默认不可见
assert.ok(await page.getByTestId("more-publish-toggle").isVisible(), "more-publish-toggle 缺失");
assert.ok(!(await page.getByTestId("talk-publish-entry").isVisible()), "说句话发单应默认折叠");
assert.ok(!(await page.getByTestId("ai-chat-toggle").isVisible()), "AI 撮合应对默认折叠");
await page.getByTestId("more-publish-toggle").click();
await page.waitForTimeout(400);
// 入场动画期偶发点空：循环至展开（断言终态，与 e2e-match 同口径）
for (let i = 0; i < 4; i++) {
  const open = await page.evaluate(() => !!document.querySelector('[data-testid="ai-chat-toggle"]'));
  if (open) break;
  await page.getByTestId("more-publish-toggle").click({ timeout: 3000, force: true }).catch(() => {});
  await page.waitForTimeout(400);
}
assert.ok(await page.getByTestId("talk-publish-entry").isVisible(), "展开后说句话发单应可见");
assert.ok(await page.getByTestId("ai-chat-toggle").isVisible(), "展开后 AI 撮合应可见");
// 3. AR 降级：悬浮 pill 消失，雷达段内联入口在位
assert.equal(await page.evaluate(() => document.querySelectorAll(".oto-ar-safe").length), 0, "悬浮 AR pill 应撤除");
await page.getByTestId("home-tab-radar").click();
await page.waitForTimeout(500);
assert.ok(await page.getByTestId("radar-ar-entry").isVisible(), "radar-ar-entry 缺失");
// 4. 行程全空：统一卡在位，三旧卡与无单存证消失
await page.getByTestId("dock-tab-trip").click();
await page.waitForTimeout(900);
assert.ok(await page.getByTestId("trip-empty-unified").isVisible(), "trip-empty-unified 缺失");
for (const t of ["trip-empty-state", "mywaves-empty-state", "booking-empty-state"]) {
  assert.equal(await page.evaluate((id) => !!document.querySelector(`[data-testid="${id}"]`), t), false, `${t} 应出清`);
}
assert.equal(await page.evaluate(() => !!document.querySelector('button[aria-label="拍照存证"]')), false, "全空态存证按钮应隐藏");
// 5. SOS 兜底不断：访客态悬浮 SOS 在位（§3 裁决 C：无单保留）
await page.getByTestId("dock-tab-home").click();
await page.waitForTimeout(800);
assert.ok(await page.getByTestId("floating-sos").isVisible(), "访客态 floating-sos 缺失（兜底断裂）");

console.log(`E2E UX 预算 PASS ✓（首页 ${n0}/18 · 折叠/AR/空卡/存证/SOS 全锁死）`);
await browser.close();
