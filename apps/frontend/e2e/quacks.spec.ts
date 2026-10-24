import { expect, test } from "@playwright/test"

import { API, signIn } from "./signIn"

test("signed-out visitors cannot reach the feed or delete posts", async ({ page }) => {
  await page.goto("/quacks")
  await expect(page).toHaveURL(/\/login/)
  expect((await page.request.delete(`${API}/quacks/unknown`)).status()).toBe(401)
})

test("author posts, filters Mine, cancels and confirms deletion", async ({ page }) => {
  await signIn(page, "caffeinatedduck@example.com", "password1")
  const text = `E2E author ${Date.now()}`
  await page.getByLabel("New quack", { exact: true }).fill(text)
  await page.getByRole("button", { name: "Quack", exact: true }).click()
  const post = page.getByRole("article").filter({ hasText: text })
  await expect(post).toBeVisible()
  await page.getByRole("tab", { name: "Mine", exact: true }).click()
  await expect(post).toBeVisible()
  const session = await (await page.request.get(`${API}/auth/get-session`)).json()
  const mine = await (await page.request.get(`${API}/quacks?scope=mine`)).json()
  expect(mine.length).toBeGreaterThan(0)
  expect(mine.every((quack: { userId: string }) => quack.userId === session.user.id)).toBe(true)
  await post.getByRole("button", { name: "Delete quack", exact: true }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(post).toBeVisible()
  await post.getByRole("button", { name: "Delete quack", exact: true }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click()
  await expect(post).toHaveCount(0)
  await page.reload()
  await expect(post).toHaveCount(0)
})

test("a regular user cannot delete another author's quack, including through the API", async ({
  browser,
}) => {
  const author = await browser.newPage()
  const other = await browser.newPage()
  let id: string | undefined
  try {
    await signIn(author, "caffeinatedduck@example.com", "password1")
    const text = `E2E ownership ${Date.now()}`
    const created = await author.request.post(`${API}/quacks`, { data: { text } })
    expect(created.status()).toBe(201)
    id = (await created.json()).id
    await signIn(other, "deepduckthoughts@example.com", "password2")
    const post = other.getByRole("article").filter({ hasText: text })
    await expect(post).toBeVisible()
    await expect(post.getByRole("button", { name: "Delete quack", exact: true })).toHaveCount(0)
    expect((await other.request.delete(`${API}/quacks/${id}`)).status()).toBe(403)
    await author.reload()
    await expect(author.getByRole("article").filter({ hasText: text })).toBeVisible()
  } finally {
    if (id) await author.request.delete(`${API}/quacks/${id}`)
    await author.close()
    await other.close()
  }
})
