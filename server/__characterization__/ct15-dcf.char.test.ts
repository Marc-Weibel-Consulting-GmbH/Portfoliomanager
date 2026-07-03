/**
 * CT-15 — Charakterisierungstests für calcDCF (server/analytics/engine.ts:883–997)
 *
 * Pinnt den systematischen Überbewertungs-Bias der DCF-Analyse (R-32):
 * WACC-Floor 8 %, Wachstums-Decay auf 2.5 %, FCF-Cap bei 5 % der MarketCap.
 * Szenario 19: stabiler CHF-Titel (FCF-Yield 5 %, Wachstum 4 %, Beta 0.8) →
 * Fair Value liegt trotz konservativer Inputs UNTER dem Kurs.
 * Erwartungswerte wurden durch AUSFÜHREN des aktuellen Codes ermittelt.
 *
 * Daten-Mocking: calcDCF holt Fundamentaldaten selbst — der EODHD-Pfad ist
 * über EODHD_API_KEY='' deaktiviert, der Yahoo-Fallback (quoteSummary) liefert
 * das S19-Fixture. Es werden nur Zahlen gerechnet, kein Netzwerkzugriff.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { S19 } from "./fixtures";

const h = vi.hoisted(() => ({
  quoteSummary: null as any,
}));

vi.mock("yahoo-finance2", () => ({
  default: class {
    quoteSummary = async () => h.quoteSummary;
    chart = async () => ({ quotes: [] });
  },
}));

import { calcDCF } from "../analytics/engine";

beforeAll(() => {
  vi.stubEnv("EODHD_API_KEY", ""); // EODHD-Pfad aus → Yahoo-Fallback mit Fixture
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("CT-15 calcDCF (Szenario 19)", () => {
  it("stabiler CHF-Titel (FCF-Yield 5 %, Wachstum 4 %, Beta 0.8) → Fair Value unter Kurs (R-32)", async () => {
    h.quoteSummary = S19.quoteSummary;
    const res = await calcDCF({ ticker: "STAB.SW" });

    expect(res.dataSource).toBe("Yahoo Finance");
    expect(res.companyName).toBe("Stabil AG");
    expect(res.currency).toBe("CHF");
    expect(res.currentPrice).toBe(100);
    expect(res.beta).toBe(0.8);
    expect(res.revenueGrowthEstimate).toBe(4);
    expect(res.freeCashFlow).toBe(5000000); // Yield exakt 5 % → kein FCF-Cap

    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-32:
    // CAPM-WACC wäre 0.7·(2 % + 0.8·5.5 %) + 0.3·4 %·0.79 = 5.43 % — der
    // hartkodierte Floor hebt den Diskontsatz auf 8 % an.
    expect(res.wacc).toBe(8);

    // Wachstums-Decay 4 % → 2.5 % über 5 Jahre (R-32-Baustein):
    expect(res.projectedFCF).toEqual([5185000, 5361290, 5527490, 5682260, 5824316]);
    expect(res.pvFCF).toBe(21925830);
    expect(res.pvTerminalValue).toBe(73873273);

    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-32:
    // Konservativer Zähler + 8-%-Floor im Nenner ⇒ Fair Value 95.80 < Kurs 100
    // («überbewertet»), obwohl die Inputs einen fair bis günstig bewerteten
    // Qualitätstitel beschreiben.
    expect(res.intrinsicValue).toBe(95.8);
    expect(res.upsideDownside).toBe(-4.2);
    expect(res.intrinsicValue).toBeLessThan(res.currentPrice);
  });

  it("FCF-Yield 10 % wird still auf 5 % der MarketCap gekappt (R-32)", async () => {
    h.quoteSummary = {
      ...S19.quoteSummary,
      financialData: { ...S19.quoteSummary.financialData, freeCashflow: 10_000_000 },
    };
    const res = await calcDCF({ ticker: "STAB.SW" });

    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-32:
    // FCF-Yield 10 % > 8 % → der REALE FCF (10 Mio) wird ohne Ausweis auf
    // 5 % der MarketCap (5 Mio) halbiert; das Ergebnis ist identisch mit
    // Szenario 19 — der doppelt so hohe Cashflow ändert die Bewertung nicht.
    expect(res.freeCashFlow).toBe(5000000);
    expect(res.intrinsicValue).toBe(95.8);
    expect(res.upsideDownside).toBe(-4.2);
  });
});
