import { expect, test } from "@playwright/test"

import { API, signIn } from "./signIn"

test("admin sees Delete everywhere and can delete another author's poll", async ({ browser }) => {
  const author = await browser.newPage()
  const admin = await browser.newPage()
  let id: string | undefined
  try {
    await signIn(author, "caffeinatedduck@example.com", "password1")
    const text = `E2E moderation ${Date.now()}`
    const created = await author.request.post(`${API}/quacks`, {
      data: { text, pollOptions: ["Keep", "Remove"] },
    })
    expect(created.status()).toBe(201)
    const quack = await created.json()
    id = quack.id
    const optionId = quack.poll.options[0].id
    expect(
      (await author.request.put(`${API}/quacks/${id}/vote`, { data: { optionId } })).status(),
    ).toBe(200)
    await signIn(admin, "admin@example.com", "adminpassword")
    const post = admin.getByRole("article").filter({ hasText: text })
    await expect(post).toBeVisible()
    const articles = admin.getByRole("article")
    await expect(admin.getByRole("button", { name: "Delete quack", exact: true })).toHaveCount(
      await articles.count(),
    )
    await admin.getByRole("tab", { name: "Mine", exact: true }).click()
    await expect(post).toHaveCount(0)
    const session = await (await admin.request.get(`${API}/auth/get-session`)).json()
    const mine = await (await admin.request.get(`${API}/quacks?scope=mine`)).json()
    expect(mine.every((item: { userId: string }) => item.userId === session.user.id)).toBe(true)
    await admin.getByRole("tab", { name: "All", exact: true }).click()
    await post.getByRole("button", { name: "Delete quack", exact: true }).click()
    await admin.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(post).toBeVisible()
    await post.getByRole("button", { name: "Delete quack", exact: true }).click()
    await admin.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click()
    await expect(post).toHaveCount(0)
    await author.reload()
    await expect(author.getByRole("article").filter({ hasText: text })).toHaveCount(0)
    expect(
      (await author.request.put(`${API}/quacks/${id}/vote`, { data: { optionId } })).status(),
    ).toBe(404)
  } finally {
    if (id) await author.request.delete(`${API}/quacks/${id}`)
    await author.close()
    await admin.close()
  }
})
