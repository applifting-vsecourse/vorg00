import { randomUUID } from "node:crypto"
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test"

const api = "http://localhost:4051/api"
const password = "likes-browser-password"

async function signup(request: APIRequestContext) {
  const suffix = randomUUID().replaceAll("-", "")
  const email = `likes-${suffix}@example.com`
  const response = await request.post(`${api}/auth/sign-up/email`, {
    data: { name: "Like Tester", username: `like${suffix.slice(0, 20)}`, email, password },
  })
  expect(response.status(), await response.text()).toBe(200)
  return { email }
}

async function createQuack(request: APIRequestContext) {
  const text = `Likes acceptance ${randomUUID()}`
  const response = await request.post(`${api}/quacks`, { data: { text } })
  expect(response.status(), await response.text()).toBe(201)
  const quack = (await response.json()) as { id: string }
  return { id: quack.id, text }
}

function article(page: Page, text: string) {
  return page.getByRole("article").filter({ hasText: text })
}

async function expectState(card: Locator, count: number, liked: boolean) {
  await expect(card).toBeVisible()
  const button = card.getByRole("button", {
    name: liked ? "Unlike quack" : "Like quack",
    exact: true,
  })
  await expect(button).toBeVisible()
  await expect(button).toHaveAttribute("aria-pressed", String(liked))
  await expect(card.getByLabel("Like count", { exact: true })).toHaveText(String(count))
  return button
}

test("E1: like, refresh, sign back in, unlike, and refresh against the real API", async ({
  page,
}) => {
  const user = await signup(page.request)
  const quack = await createQuack(page.request)
  await page.goto("/quacks")
  const card = article(page, quack.text)
  await (await expectState(card, 0, false)).click()
  await expectState(card, 1, true)
  await page.reload()
  await expectState(card, 1, true)
  const signout = await page.request.post(`${api}/auth/sign-out`, { data: {} })
  expect(signout.status()).toBe(200)
  await page.goto("/quacks")
  await expect(page).toHaveURL(/\/login/)
  const signin = await page.request.post(`${api}/auth/sign-in/email`, {
    data: { email: user.email, password },
  })
  expect(signin.status()).toBe(200)
  await page.goto("/quacks")
  await (await expectState(card, 1, true)).click()
  await expectState(card, 0, false)
  await page.reload()
  await expectState(card, 0, false)
})

test("E2: every quack shows its count and the current user’s state, including own quacks", async ({
  page,
  playwright,
}) => {
  await signup(page.request)
  const own = await createQuack(page.request)
  const otherSession = await playwright.request.newContext()
  try {
    await signup(otherSession)
    const other = await createQuack(otherSession)
    const liked = await page.request.put(`${api}/quacks/${other.id}/like`)
    expect(liked.status()).toBe(200)
    await page.goto("/quacks")
    await expectState(article(page, own.text), 0, false)
    await expectState(article(page, other.text), 1, true)
    const feed = await page.request.get(`${api}/quacks`)
    expect(feed.status()).toBe(200)
    const items = (await feed.json()) as { text: string; likeCount: number; likedByMe: boolean }[]
    for (const item of items)
      await expectState(article(page, item.text), item.likeCount, item.likedByMe)
    await (await expectState(article(page, own.text), 0, false)).click()
    await expectState(article(page, own.text), 1, true)
  } finally {
    await otherSession.dispose()
  }
})

// Browser-only failure/pending scenarios use real login and quacks but controlled
// like responses. E1 and E2 above exercise the actual server without interception.
async function controlledFeed(page: Page, initiallyLiked: boolean) {
  await signup(page.request)
  const quack = await createQuack(page.request)
  const state = { likeCount: initiallyLiked ? 1 : 0, likedByMe: initiallyLiked }
  await page.route(`${api}/quacks`, async (route) => {
    if (route.request().method() !== "GET") return route.continue()
    const response = await route.fetch()
    const items = (await response.json()) as { id: string }[]
    await route.fulfill({
      response,
      json: items.map((item) => ({
        ...item,
        ...(item.id === quack.id ? state : { likeCount: 0, likedByMe: false }),
      })),
    })
  })
  await page.goto("/quacks")
  return { quack, state, card: article(page, quack.text) }
}

for (const initiallyLiked of [false, true]) {
  const action = initiallyLiked ? "unlike" : "like"
  test(`E3: pending ${action} disables the button and prevents additional requests`, async ({
    page,
  }) => {
    const { quack, state, card } = await controlledFeed(page, initiallyLiked)
    const button = await expectState(card, state.likeCount, state.likedByMe)
    let requests = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(`${api}/quacks/${quack.id}/like`, async (route) => {
      expect(route.request().method()).toBe(initiallyLiked ? "DELETE" : "PUT")
      requests++
      await gate
      state.likedByMe = !initiallyLiked
      state.likeCount = initiallyLiked ? 0 : 1
      await route.fulfill({ status: 200, json: state })
    })
    try {
      await button.click()
      await expect.poll(() => requests).toBe(1)
      // The accessible name may change optimistically, so locate by button role here.
      const pending = card.getByRole("button", { name: /^(Like|Unlike) quack$/ })
      await expect(pending).toBeDisabled()
      await pending.click({ force: true })
      expect(requests).toBe(1)
    } finally {
      release()
    }
    const confirmed = await expectState(card, initiallyLiked ? 0 : 1, !initiallyLiked)
    await expect(confirmed).toBeEnabled()
    expect(requests).toBe(1)
  })

  test(`E4: failed ${action} restores the previous state and permits a successful retry`, async ({
    page,
  }) => {
    const { quack, state, card } = await controlledFeed(page, initiallyLiked)
    const button = await expectState(card, state.likeCount, state.likedByMe)
    let requests = 0
    let allowSuccess = false
    await page.route(`${api}/quacks/${quack.id}/like`, async (route) => {
      expect(route.request().method()).toBe(initiallyLiked ? "DELETE" : "PUT")
      requests++
      if (!allowSuccess) {
        await route.fulfill({
          status: 503,
          json: { message: "Unable to update like. Please try again." },
        })
        return
      }
      state.likedByMe = !initiallyLiked
      state.likeCount = initiallyLiked ? 0 : 1
      await route.fulfill({ status: 200, json: state })
    })
    await button.click()
    await expect(page.getByRole("alert")).toContainText(/like|try again|retry/i)
    const retry = await expectState(card, initiallyLiked ? 1 : 0, initiallyLiked)
    await expect(retry).toBeEnabled()
    expect(requests).toBeGreaterThanOrEqual(1)
    const failedRequests = requests
    allowSuccess = true
    await retry.click()
    await expectState(card, initiallyLiked ? 0 : 1, !initiallyLiked)
    expect(requests).toBeGreaterThan(failedRequests)
  })
}

test("E5: a 404 explains that the quack is no longer available without showing a like", async ({
  page,
}) => {
  const { quack, card } = await controlledFeed(page, false)
  const button = await expectState(card, 0, false)
  await page.route(`${api}/quacks/${quack.id}/like`, async (route) => {
    await route.fulfill({ status: 404, json: { message: "Quack is no longer available" } })
  })
  await button.click()
  await expect(page.getByRole("alert")).toContainText(/no longer available|deleted|not found/i)
  // Removing the stale card or retaining it without a successful like are both valid.
  await expect(card.getByRole("button", { name: "Unlike quack", exact: true })).toHaveCount(0)
  const remainingCount = card.getByLabel("Like count", { exact: true })
  if (await remainingCount.count()) await expect(remainingCount).toHaveText("0")
})

test("E6: signed-out visitors cannot see quacks, counts, or like controls", async ({ page }) => {
  await page.goto("/quacks")
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole("article")).toHaveCount(0)
  await expect(page.getByLabel("Like count")).toHaveCount(0)
  await expect(page.getByRole("button", { name: /^(Like|Unlike) quack$/ })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible()
})
