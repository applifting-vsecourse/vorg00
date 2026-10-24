import { expect, type Page } from "@playwright/test"

export const API = "http://localhost:4050/api"

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByRole("button", { name: "User menu", exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/quacks$/)
}
