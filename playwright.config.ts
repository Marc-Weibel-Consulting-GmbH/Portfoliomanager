import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E-Setup.
 *
 * Die App braucht zum Booten eine Datenbank (DATABASE_URL) und weitere Secrets,
 * deshalb startet diese Config bewusst KEINEN eigenen Webserver. Zwei Betriebsarten:
 *
 *   1. Lokal:     App via `pnpm dev` starten, dann `pnpm test:e2e`
 *   2. Preview:   E2E_BASE_URL=https://<preview-url> pnpm test:e2e
 *
 * In CI laeuft die Suite nur, wenn das Secret/Env E2E_BASE_URL gesetzt ist
 * (siehe .github/workflows/ci.yml — bewusst nicht Teil der Pflicht-Jobs).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
