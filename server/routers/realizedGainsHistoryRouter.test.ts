/**
 * Unit-Tests für allocateBuyFees (R-19: Buy-Fees anteilig statt in voller
 * Höhe von JEDEM Verkauf abgezogen). Reine Funktion, keine DB.
 */

import { describe, it, expect } from "vitest";
import { allocateBuyFees } from "./realizedGainsHistoryRouter";

describe("allocateBuyFees (R-19)", () => {
  it("verteilt Buy-Fees anteilig nach verkauften Shares (nur Käufe bis zum Verkaufsdatum)", () => {
    const buys = [
      { transactionDate: "2025-03-03", fees: 10, shares: 100 },
      { transactionDate: "2025-03-05", fees: 20, shares: 100 },
      // Kauf NACH dem Verkauf — darf nicht einfliessen:
      { transactionDate: "2025-03-09", fees: 40, shares: 100 },
    ];

    // Verkauf von 50 der bis dahin 200 gekauften Shares → 25% von 30 = 7.50
    expect(allocateBuyFees(buys, { transactionDate: "2025-03-07", shares: 50 })).toBeCloseTo(7.5, 10);

    // Zwei Teilverkäufe à 100 Shares zusammen = volle Fees (30), nicht 2×30
    const s1 = allocateBuyFees(buys, { transactionDate: "2025-03-07", shares: 100 });
    const s2 = allocateBuyFees(buys, { transactionDate: "2025-03-08", shares: 100 });
    expect(s1 + s2).toBeCloseTo(30, 10);
  });

  it("Randfälle: keine Käufe → 0; Oversell wird bei 100% gekappt", () => {
    expect(allocateBuyFees([], { transactionDate: "2025-03-07", shares: 50 })).toBe(0);
    // Oversell (150 verkauft bei 100 gekauft) → maximal die vollen Fees (R-20 bleibt offen)
    const buys = [{ transactionDate: "2025-03-03", fees: 10, shares: 100 }];
    expect(allocateBuyFees(buys, { transactionDate: "2025-03-07", shares: 150 })).toBe(10);
  });
});
