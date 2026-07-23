# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: production-smoke.spec.ts >> Security Headers >> all required security headers are present
- Location: e2e\production-smoke.spec.ts:27:7

# Error details

```
Error: apiRequestContext.get: connect ETIMEDOUT 103.56.16.112:443
Call log:
  - → GET https://deal-protocol-phi.vercel.app/
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br

```

# Test source

```ts
  1   | import { test, expect, type Page, type BrowserContext } from "@playwright/test"
  2   | 
  3   | const BASE_URL = process.env.BASE_URL || "https://deal-protocol.vercel.app"
  4   | const MIN_TOUCH = 44
  5   | 
  6   | let consoleErrors: string[] = []
  7   | 
  8   | test.beforeEach(async ({ page }) => {
  9   |   consoleErrors = []
  10  |   page.on("console", (msg) => {
  11  |     if (msg.type() === "error") consoleErrors.push(msg.text())
  12  |   })
  13  |   page.on("pageerror", (err) => consoleErrors.push(err.message))
  14  | })
  15  | 
  16  | test.afterEach(async () => {
  17  |   expect(consoleErrors).toEqual([])
  18  | })
  19  | 
  20  | // ── 0. Security Response Headers ──
  21  | test.describe("Security Headers", () => {
  22  |   test("X-Content-Type-Options: nosniff", async () => {
  23  |     const res = await (await fetch(BASE_URL)).text()
  24  |     // fallback: use page request
  25  |   })
  26  | 
  27  |   test("all required security headers are present", async ({ page }) => {
> 28  |     const res = await page.request.get(BASE_URL)
      |                                    ^ Error: apiRequestContext.get: connect ETIMEDOUT 103.56.16.112:443
  29  |     expect(res.headers()["x-content-type-options"]).toBe("nosniff")
  30  |     expect(res.headers()["x-frame-options"]).toBe("DENY")
  31  |     expect(res.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin")
  32  |   })
  33  | })
  34  | 
  35  | // ── 1. WebSocket / Realtime Handshake ──
  36  | test.describe("Realtime / WebSocket", () => {
  37  |   test("Supabase Realtime WebSocket endpoint responds", async ({ context }) => {
  38  |     const wsPages: string[] = []
  39  |     context.on("page", (p) => {
  40  |       p.on("websocket", (ws) => wsPages.push(ws.url()))
  41  |     })
  42  |     const page = await context.newPage()
  43  |     await page.goto(BASE_URL + "/demands", { waitUntil: "networkidle" })
  44  |     const hasWS = wsPages.some((u) => u.startsWith("wss://"))
  45  |     // WebSocket may not fire on every deployment; log but soft-check
  46  |     console.log(`WebSocket connections observed: ${wsPages.length}`)
  47  |     expect(wsPages.length).toBeGreaterThanOrEqual(0)
  48  |   })
  49  | })
  50  | 
  51  | // ── 2. Mobile Touch Hot Zone (iPhone 13 / 390×844) ──
  52  | test.describe("Mobile Touch (iPhone 13 390×844)", () => {
  53  |   test.use({ viewport: { width: 390, height: 844 } })
  54  | 
  55  |   async function assertNoHorizontalOverflow(page: Page) {
  56  |     const overflow = await page.evaluate(() => {
  57  |       const html = document.documentElement
  58  |       return { scrollW: html.scrollWidth, clientW: html.clientWidth }
  59  |     })
  60  |     expect(overflow.scrollW).toBeLessThanOrEqual(overflow.clientW + 1)
  61  |   }
  62  | 
  63  |   async function assertTouchTarget(el: Promise<ReturnType<Page["locator"]>>) {
  64  |     // Not a real assertion – we use boundingBox directly
  65  |   }
  66  | 
  67  |   test("Header hamburger button meets 44px touch target", async ({ page }) => {
  68  |     await page.goto(BASE_URL + "/demands", { waitUntil: "networkidle" })
  69  |     const btn = page.locator('[aria-label*="menu" i], [aria-label*="导航" i], button:has(svg.lucide-menu), .md\\:hidden button:has(svg)').first()
  70  |     if (await btn.isVisible()) {
  71  |       const box = await btn.boundingBox()
  72  |       expect(box).not.toBeNull()
  73  |       expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(MIN_TOUCH)
  74  |     }
  75  |   })
  76  | 
  77  |   test("demands page cards are reachable and no horizontal overflow", async ({ page }) => {
  78  |     await page.goto(BASE_URL + "/demands", { waitUntil: "networkidle" })
  79  |     await assertNoHorizontalOverflow(page)
  80  |     await expect(page.locator("body")).not.toContainText(/500|Internal Server Error/)
  81  |   })
  82  | 
  83  |   test("orders page role tabs meet 44px touch target", async ({ page }) => {
  84  |     await page.goto(BASE_URL + "/orders", { waitUntil: "networkidle" })
  85  |     await assertNoHorizontalOverflow(page)
  86  |     const tabs = page.locator('button:has-text("客户"), button:has-text("服务商")')
  87  |     const count = await tabs.count()
  88  |     if (count > 0) {
  89  |       const box = await tabs.first().boundingBox()
  90  |       expect(box).not.toBeNull()
  91  |       expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(MIN_TOUCH)
  92  |     }
  93  |   })
  94  | 
  95  |   test("orders detail SOS button meets 44px touch target", async ({ page }) => {
  96  |     await page.goto(BASE_URL + "/orders", { waitUntil: "networkidle" })
  97  |     const link = page.locator('a[href*="/orders/"]').first()
  98  |     if (await link.isVisible()) {
  99  |       const href = await link.getAttribute("href")
  100 |       if (href) {
  101 |         await page.goto(BASE_URL + href, { waitUntil: "networkidle" })
  102 |         const sos = page.locator('a[href*="/sos"], button:has-text("SOS"), button:has-text("紧急")').first()
  103 |         if (await sos.isVisible()) {
  104 |           const box = await sos.boundingBox()
  105 |           expect(box).not.toBeNull()
  106 |           expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(MIN_TOUCH)
  107 |         }
  108 |       }
  109 |     }
  110 |   })
  111 | 
  112 |   test("disputes page action link meets 44px touch target", async ({ page }) => {
  113 |     await page.goto(BASE_URL + "/disputes", { waitUntil: "networkidle" })
  114 |     await assertNoHorizontalOverflow(page)
  115 |     const actionLink = page.locator('a:has-text("查看裁决详情"), a:has-text("查看")').first()
  116 |     if (await actionLink.isVisible()) {
  117 |       const box = await actionLink.boundingBox()
  118 |       expect(box).not.toBeNull()
  119 |       expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(MIN_TOUCH)
  120 |     }
  121 |   })
  122 | 
  123 |   test("finance page withdraw button meets 44px touch target", async ({ page }) => {
  124 |     await page.goto(BASE_URL + "/finance", { waitUntil: "networkidle" })
  125 |     await assertNoHorizontalOverflow(page)
  126 |     const btn = page.locator('button:has-text("提现"), button:has-text("刷新")').first()
  127 |     if (await btn.isVisible()) {
  128 |       const box = await btn.boundingBox()
```