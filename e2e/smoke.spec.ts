import { test, expect } from "@playwright/test";

/**
 * Smoke-Tests: pruefen nur, dass die App-Shell laedt.
 * Erweiterbar um kritische Flows (Login, Portfolio-Import, Report-Export).
 */
test.describe("Smoke", () => {
  test("Startseite laedt und rendert die App-Shell", async ({ page }) => {
    const response = await page.goto("/");
    expect(response, "Keine HTTP-Antwort erhalten").not.toBeNull();
    expect(response!.status()).toBeLessThan(400);

    const root = page.locator("#root");
    await expect(root).toBeAttached();
    // Die App rendert clientseitig — warten, bis Inhalt im Root landet.
    await expect(root).not.toBeEmpty({ timeout: 15_000 });
  });

  test("Keine kritischen Konsolenfehler beim Laden", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(errors, `Pageerrors: ${errors.join(" | ")}`).toEqual([]);
  });
});
