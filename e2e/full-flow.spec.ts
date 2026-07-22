import { test, expect } from "@playwright/test"

const USER_EMAIL = "zhao@finalgo.test"
const USER_PASS = "test123456"
const USER_ID = "97a6b155-017a-4776-8342-c1676ce01fd3"

test.describe("Full E2E Flow", () => {
  test("login -> create demand -> assign -> pay -> complete -> review", async ({ page }) => {
    await page.goto("/login")
    await page.waitForSelector('button[type="submit"]')
    await page.getByPlaceholder("请输入邮箱地址").fill(USER_EMAIL)
    await page.getByPlaceholder("请输入密码").fill(USER_PASS)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL("**/dashboard", { timeout: 10000 })
    await expect(page.locator("body")).toContainText(/首页|发布需求|我的订单/)

    const demandId = await page.evaluate(async () => {
      const r = await fetch("/api/demands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "空调不制冷了需要加氟，在三里屯，预算300元" }),
      })
      const body = await r.json()
      if (r.status !== 201) throw new Error("Demand failed: " + JSON.stringify(body))
      return body.demand.id
    })
    expect(demandId).toBeTruthy()

    const contractId = await page.evaluate(async ({ did, uid }) => {
      const r = await fetch(`/api/demands/${did}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: uid }),
      })
      const body = await r.json()
      if (r.status !== 201) throw new Error("Assign failed: " + JSON.stringify(body))
      return body.contract.id
    }, { did: demandId, uid: USER_ID })
    expect(contractId).toBeTruthy()

    const pay = await page.evaluate(async (cid) => {
      const r = await fetch(`/api/orders/${cid}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay" }),
      })
      const b = await r.json()
      return { status: r.status, fund: b.contract?.fund_status }
    }, contractId)
    expect(pay.status).toBe(200)
    expect(pay.fund).toBe("HELD")

    const complete = await page.evaluate(async (cid) => {
      const r = await fetch(`/api/orders/${cid}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm_complete" }),
      })
      const b = await r.json()
      return { status: r.status, fund: b.contract?.fund_status }
    }, contractId)
    expect(complete.status).toBe(200)
    expect(complete.fund).toBe("COMPLETED")

    const review = await page.evaluate(async (cid) => {
      const r = await fetch("/api/reviews", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: cid, rating: 5, comment: "非常好" }),
      })
      const b = await r.text()
      return { status: r.status, body: JSON.parse(b) }
    }, contractId)
    expect(review.status).toBe(201)
    expect(review.body.review.rating).toBe(5)
  })
})
