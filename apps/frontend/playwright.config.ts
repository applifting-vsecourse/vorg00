import { createRequire } from "node:module"
import { defineConfig, devices } from "@playwright/test"

const require = createRequire(import.meta.url)
const { testDatabaseUrl } = require("../backend/scripts/test-database.cjs")

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3051",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "pnpm backend test:db && pnpm backend exec ts-node -r tsconfig-paths/register src/main.ts",
      cwd: "../..",
      url: "http://localhost:4051/api",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: "test",
        DATABASE_URL: testDatabaseUrl(),
        BETTER_AUTH_SECRET: "e2e-test-secret-at-least-32-characters-long",
        BACKEND_URL: "http://localhost:4051",
        FRONTEND_URL: "http://localhost:3051",
        PORT: "4051",
        RESEND_API_KEY: "",
        SMTP_HOST: "",
        SMTP_USERNAME: "",
        SMTP_PASSWORD: "",
      },
    },
    {
      command: "pnpm dev --port 3051",
      url: "http://localhost:3051",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_API_URL: "http://localhost:4051/api",
        VITE_BETTER_AUTH_URL: "http://localhost:4051",
      },
    },
  ],
})
