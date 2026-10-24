import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    channel: "chrome",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    launchOptions: process.env.E2E_CHROME_PATH
      ? { executablePath: process.env.E2E_CHROME_PATH }
      : undefined,
    viewport: { width: 1440, height: 1000 },
    // Auth uses a real token. Never capture request traces or storage state.
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
