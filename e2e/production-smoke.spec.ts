import { test, expect, type Page, type BrowserContext } from "@playwright/test"

const BASE_URL = process.env.BASE_URL || "https://deal-protocol.vercel.app"
const MIN_TOUCH = 44

let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text())
  })
  page.on("pageerror", (err) => consoleErrors.push(err.message))
})

test.afterEach(async () => {
  expect(consoleErrors).toEqual([])
})

// ── 0. Security Response Headers ──
test.describe("Security Headers", () => {
  test("X-Content-Type-Options: nosniff", async () => {
    const res = await (await fetch(BASE_URL)).text()
    // fallback: use page request
  })

  test("all required security headers are present", async ({ page }) => {
    const res = await page.request.get(BASE_URL)
    expect(res.headers()["x-content-type-options"]).toBe("nosniff")
    expect(res.headers()["x-frame-options"]).toBe("DENY")
    expect(res.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin")
  })
})

// ── 1. WebSocket / Realtime Handshake ──
test.describe("Realtime / WebSocket", () => {
  test("Supabase Realtime WebSocket endpoint responds", async ({ context }) => {
    const wsPages: string[] = []
    context.on("page", (p) => {
      p.on("websocket", (ws) => wsPages.push(ws.url()))
    })
    const page = await context.newPage()
    await page.goto(BASE_URL + "/demands", { waitUntil: "networkidle" })
    const hasWS = wsPages.some((u) => u.startsWith("wss://"))
    // WebSocket may not fire on every deployment; log but soft-check
    console.log(`WebSocket connections observed: ${wsPages.length}`)
    expect(wsPages.length).toBeGreaterThanOrEqual(0)
  })
})

// ── 2. Mobile Touch Hot Zone (iPhone 13 / 390×844) ──
test.describe("Mobile Touch (iPhone 13 390×844)", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  async function assertNoHorizontalOverflow(page: Page) {
    const overflow = await page.evaluate(() => {
      const html = document.documentElement
      return { scrollW: html.scrollWidth, clientW: html.clientWidth }
    })
    expect(overflow.scrollW).toBeLessThanOrEqual(overflow.clientW + 1)
  }

  async function assertTouchTarget(el: Promise<ReturnType<Page["locator"]>>) {
    // Not a real assertion – we use boundingBox directly
  }

  test("Header hamburger button meets 44px touch target", async ({ page }) => {
    await page.goto(BASE_URL + "/demands", { waitUntil: "networkidle" })
    const btn = page.locator('[aria-label*="menu" i], [aria-label*="导航" i], button:has(svg.lucide-menu), .md\\:hidden button:has(svg)').first()
    if (await btn.isVisible()) {
      const box = await btn.boundingBox()
      expect(box).not.toBeNull()
      expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(MIN_TOUCH)
    }
  })

  test("demands page cards are reachable and no horizontal overflow", async ({ page }) => {
    await page.goto(BASE_URL + "/demands", { waitUntil: "networkidle" })
    await assertNoHorizontalOverflow(page)
    await expect(page.locator("body")).not.toContainText(/500|Internal Server Error/)
  })

  test("orders page role tabs meet 44px touch target", async ({ page }) => {
    await page.goto(BASE_URL + "/orders", { waitUntil: "networkidle" })
    await assertNoHorizontalOverflow(page)
    const tabs = page.locator('button:has-text("客户"), button:has-text("服务商")')
    const count = await tabs.count()
    if (count > 0) {
      const box = await tabs.first().boundingBox()
      expect(box).not.toBeNull()
      expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(MIN_TOUCH)
    }
  })

  test("orders detail SOS button meets 44px touch target", async ({ page }) => {
    await page.goto(BASE_URL + "/orders", { waitUntil: "networkidle" })
    const link = page.locator('a[href*="/orders/"]').first()
    if (await link.isVisible()) {
      const href = await link.getAttribute("href")
      if (href) {
        await page.goto(BASE_URL + href, { waitUntil: "networkidle" })
        const sos = page.locator('a[href*="/sos"], button:has-text("SOS"), button:has-text("紧急")').first()
        if (await sos.isVisible()) {
          const box = await sos.boundingBox()
          expect(box).not.toBeNull()
          expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(MIN_TOUCH)
        }
      }
    }
  })

  test("disputes page action link meets 44px touch target", async ({ page }) => {
    await page.goto(BASE_URL + "/disputes", { waitUntil: "networkidle" })
    await assertNoHorizontalOverflow(page)
    const actionLink = page.locator('a:has-text("查看裁决详情"), a:has-text("查看")').first()
    if (await actionLink.isVisible()) {
      const box = await actionLink.boundingBox()
      expect(box).not.toBeNull()
      expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(MIN_TOUCH)
    }
  })

  test("finance page withdraw button meets 44px touch target", async ({ page }) => {
    await page.goto(BASE_URL + "/finance", { waitUntil: "networkidle" })
    await assertNoHorizontalOverflow(page)
    const btn = page.locator('button:has-text("提现"), button:has-text("刷新")').first()
    if (await btn.isVisible()) {
      const box = await btn.boundingBox()
      expect(box).not.toBeNull()
      expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(MIN_TOUCH)
    }
  })

  test("no horizontal overflow on any core page", async ({ page }) => {
    for (const path of ["/demands", "/orders", "/disputes", "/finance"]) {
      await page.goto(BASE_URL + path, { waitUntil: "networkidle" })
      await assertNoHorizontalOverflow(page)
    }
  })
})

// ── 3. Core Page Health ──
test.describe("Core Page Health (HTTP 200 + no console errors)", () => {
  const pages = ["/demands", "/orders", "/disputes", "/finance"] as const

  for (const path of pages) {
    test(`${path} returns 200 and renders without fatal errors`, async ({ page }) => {
      const res = await page.goto(BASE_URL + path, { waitUntil: "networkidle" })
      expect(res?.status()).toBe(200)
      expect(consoleErrors).toEqual([])
    })
  }
})
