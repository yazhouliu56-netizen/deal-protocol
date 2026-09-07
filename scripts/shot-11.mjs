import { chromium } from "playwright-core";
import { getE2eBaseUrl, getDefaultLaunchOptions } from "./lib/e2e-channel.mjs";

const BASE = getE2eBaseUrl();
const browser = await chromium.launch(getDefaultLaunchOptions());
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.screenshot({ path: process.env.SHOT_TOP || "shot-11-top.png" });
// scroll feed into view
await page.evaluate(() => window.scrollTo(0, 900));
await page.waitForTimeout(800);
await page.screenshot({ path: process.env.SHOT_MID || "shot-11-mid.png" });
// open bell drawer
await page.getByRole("button", { name: /通知中心/ }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: process.env.SHOT_DRAWER || "shot-11-drawer.png" });
await browser.close();
console.log("shots done");
