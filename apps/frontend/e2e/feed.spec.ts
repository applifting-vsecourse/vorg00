import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"

test("a signed-in user opens the feed and sees a persisted quack", async ({ page }) => {
  const id = randomUUID()
  const signup = await page.request.post("http://localhost:4051/api/auth/sign-up/email", {
    data: {
      name: "Feed Tester",
      username: `feed${id.replaceAll("-", "").slice(0, 20)}`,
      email: `feed-${id}@example.com`,
      password: "feed-test-password",
    },
  })
  expect(signup.ok(), await signup.text()).toBeTruthy()
  const text = `Playwright feed ${id}`
  const created = await page.request.post("http://localhost:4051/api/quacks", { data: { text } })
  expect(created.status()).toBe(201)
  const feed = page.waitForResponse(
    (response) =>
      response.url() === "http://localhost:4051/api/quacks" &&
      response.request().method() === "GET",
  )
  await page.goto("/quacks")
  expect((await feed).status()).toBe(200)
  await expect(page.getByRole("heading", { name: "Quacks", exact: true })).toBeVisible()
  await expect(page.getByText(text, { exact: true })).toBeVisible()
})
