/**
 * CT-15 — Charakterisierungstests für calcDCF (server/analytics/engine.ts)
 *
 * Pinnt das Verhalten NACH dem R-32-Fix: währungsspezifischer risikofreier
 * Zins (CHF 1 %/EUR 2.5 %/USD 4 %) + Beta·5.5 % ERP, WACC-Floor 5.5 % statt
 * flat 8 %, Horizont 10 statt 5 Jahre, WACC−g-Mindestspread 2 % statt 3.5 %,
 * kein asymmetrischer Anzeige-Cap mehr; der FCF-Cap (5 % MarketCap ab Yield
 * > 8 %) bleibt, wird aber in `notes` ausgewiesen statt still angewendet.
 * Szenario 19: stabiler CHF-Titel (FCF-Yield 5 %, Wachstum 4 %, Beta 0.8) →
 * Fair Value liegt nun ÜBER dem Kurs (der alte 8-%-Floor drückte ihn darunter).
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
  it("stabiler CHF-Titel (FCF-Yield 5 %, Wachstum 4 %, Beta 0.8) → Fair Value über Kurs (R-32 gefixt)", async () => {
    h.quoteSummary = S19.quoteSummary;
    const res = await calcDCF({ ticker: "STAB.SW" });

    expect(res.dataSource).toBe("Yahoo Finance");
    expect(res.companyName).toBe("Stabil AG");
    expect(res.currency).toBe("CHF");
    expect(res.currentPrice).toBe(100);
    expect(res.beta).toBe(0.8);
    expect(res.revenueGrowthEstimate).toBe(4);
    expect(res.freeCashFlow).toBe(5000000); // Yield exakt 5 % → kein FCF-Cap
    expect(res.notes).toEqual([]); // kein Cap aktiv → keine Hinweise

    // CAPM-WACC mit CHF-risikofreiem Zins 1 %: 0.7·(1 % + 0.8·5.5 %) +
    // 0.3·4 %·0.79 = 4.73 % → Floor hebt auf 5.5 % (ein ERP) an.
    // vorher (R-32): flat 8-%-Floor → wacc = 8.
    expect(res.wacc).toBe(5.5);

    // Wachstums-Decay 4 % → 2.5 % über 10 Jahre.
    // vorher (R-32, 5 Jahre): [5185000, 5361290, 5527490, 5682260, 5824316]
    expect(res.projectedFCF).toEqual([
      5192500, 5384622, 5575777, 5765353, 5952727,
      6137262, 6318311, 6495223, 6667347, 6834031,
    ]);
    // vorher (R-32): pvFCF 21925830, pvTerminalValue 73873273
    expect(res.pvFCF).toBe(44862103);
    expect(res.pvTerminalValue).toBe(136695724);

    // vorher (R-32): intrinsicValue 95.8, upsideDownside -4.2 — der 8-%-Floor
    // drückte den fair bis günstig bewerteten Qualitätstitel unter den Kurs.
    expect(res.intrinsicValue).toBe(181.56);
    expect(res.upsideDownside).toBe(81.6);
    expect(res.intrinsicValue).toBeGreaterThan(res.currentPrice);
  });

  it("FCF-Yield 10 % wird auf 5 % der MarketCap gekappt — mit Ausweis in notes (R-32e)", async () => {
    h.quoteSummary = {
      ...S19.quoteSummary,
      financialData: { ...S19.quoteSummary.financialData, freeCashflow: 10_000_000 },
    };
    const res = await calcDCF({ ticker: "STAB.SW" });

    // Der Cap bleibt (FCF-Yield 10 % > 8 % → FCF auf 5 Mio gekappt, Ergebnis
    // identisch mit Szenario 19), wird aber nicht mehr STILL angewendet:
    // `notes` weist die Kappung aus. vorher (R-32): notes existierte nicht.
    expect(res.freeCashFlow).toBe(5000000);
    expect(res.notes).toHaveLength(1);
    expect(res.notes[0]).toContain("FCF-Yield 10.0 % > 8 %");
    // vorher (R-32): intrinsicValue 95.8, upsideDownside -4.2
    expect(res.intrinsicValue).toBe(181.56);
    expect(res.upsideDownside).toBe(81.6);
  });
});
