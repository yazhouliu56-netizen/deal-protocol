import { chromium } from "playwright-core";
import { getE2eBaseUrl, getDefaultLaunchOptions, isolateBrowserChannels } from "./lib/e2e-channel.mjs";

const BASE = getE2eBaseUrl();
const browser = await chromium.launch(getDefaultLaunchOptions());
isolateBrowserChannels(browser, "wave", { forceLocal: true });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("[pageerror]", String(e).slice(0, 200)));
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
// seed one wave directly into the e2e channel
await page.evaluate(() => {
  const k = "oto-broadcast-v1::oto::e2e::wave";
  const wave = {
    id: "w-probe-1",
    authorId: "a1",
    basics: { category: "厨师 · 上门做饭", time: "明天 11:00", area: "幸福家园小区", radiusKm: 5 },
    budget: 100,
    customs: [{ text: "30 岁左右女性", tags: [] }],
    negotiable: true,
    negotiableNote: "价格可以谈",
    deposit: true,
    status: "open",
    createdAt: Date.now(),
    payAmount: 100,
  };
  localStorage.setItem(k, JSON.stringify({ state: { waves: [wave], claims: [] } }));
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
await page.getByTestId("home-tab-radar").click();
await page.waitForTimeout(1000);
const txt = await page.evaluate(() => document.body.textContent ?? "");
console.log("HAS-AREA:", txt.includes("幸福家园小区"));
console.log("HAS-FEED:", txt.includes("附近的需求") || txt.includes("雷达"));
await page.screenshot({ path: "docs/shot/debug-radar2.png", fullPage: false });
await browser.close();
console.log("done");
