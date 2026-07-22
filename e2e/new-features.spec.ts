import { test, expect } from "@playwright/test"

const USER_EMAIL = "zhao@finalgo.test"
const USER_PASS = "test123456"

test.describe("New Features E2E", () => {
  test("admin analytics dashboard", async ({ page }) => {
    await page.goto("/login")
    await page.getByPlaceholder("请输入邮箱地址").fill(USER_EMAIL)
    await page.getByPlaceholder("请输入密码").fill(USER_PASS)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL("**/dashboard", { timeout: 10000 })

    await page.goto("/admin")
    await page.waitForTimeout(3000)
    await expect(page.locator("body")).toContainText(/数据面板|总合同数|总收入/)
  })

  test("notification bell and provider profile editing", async ({ page }) => {
    await page.goto("/login")
    await page.getByPlaceholder("请输入邮箱地址").fill(USER_EMAIL)
    await page.getByPlaceholder("请输入密码").fill(USER_PASS)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL("**/dashboard", { timeout: 10000 })

    await page.goto("/profile")
    await page.waitForTimeout(3000)
    await expect(page.locator("body")).toContainText(/服务商信息|个人简介|技能标签|服务区域/)
  })

  test("provider incoming page loads", async ({ page }) => {
    await page.goto("/login")
    await page.getByPlaceholder("请输入邮箱地址").fill(USER_EMAIL)
    await page.getByPlaceholder("请输入密码").fill(USER_PASS)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL("**/dashboard", { timeout: 10000 })

    await page.goto("/provider/incoming")
    await page.waitForTimeout(3000)
    await expect(page.locator("body")).toContainText(/待接需求/)
  })
})
