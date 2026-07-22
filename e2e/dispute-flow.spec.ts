import { test, expect } from "@playwright/test"

const USER_EMAIL = "zhao@finalgo.test"
const USER_PASS = "test123456"
const USER_ID = "97a6b155-017a-4776-8342-c1676ce01fd3"

test.describe("Dispute Flow E2E", () => {
  test("create demand -> assign -> pay -> open dispute -> admin page shows it", async ({ page }) => {
    await page.goto("/login")
    await page.waitForSelector('button[type="submit"]')
    await page.getByPlaceholder("请输入邮箱地址").fill(USER_EMAIL)
    await page.getByPlaceholder("请输入密码").fill(USER_PASS)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL("**/dashboard", { timeout: 10000 })

    const demandId = await page.evaluate(async () => {
      const r = await fetch("/api/demands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "热水器打不着火需要维修，在望京，预算200元" }),
      })
      const body = await r.json()
      if (r.status !== 201) throw new Error("Demand failed")
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
      if (r.status !== 201) throw new Error("Assign failed")
      return body.contract.id
    }, { did: demandId, uid: USER_ID })
    expect(contractId).toBeTruthy()

    const pay = await page.evaluate(async (cid) => {
      const r = await fetch(`/api/orders/${cid}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay" }),
      })
      return r.status
    }, contractId)
    expect(pay).toBe(200)

    const dispute = await page.evaluate(async (cid) => {
      const r = await fetch(`/api/orders/${cid}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_dispute", reason: "服务不满意" }),
      })
      const body = await r.json()
      return { status: r.status, disputeStatus: body.contract?.dispute_status, fundStatus: body.contract?.fund_status }
    }, contractId)
    expect(dispute.status).toBe(200)
    expect(dispute.disputeStatus).toBe("OPEN")
    expect(dispute.fundStatus).toBe("HELD")

    await page.goto("/admin/disputes")
    await page.waitForTimeout(3000)
    await expect(page.locator("body")).toContainText(/纠纷仲裁管理|待仲裁/)
  })
})
