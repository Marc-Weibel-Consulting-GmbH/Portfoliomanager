/**
 * CT-15 — Charakterisierungstests für calcDCF (server/analytics/engine.ts)
 *
 * Pinnt das Verhalten NACH dem R-32-Fix (währungsspezifischer risikofreier
 * Zins CHF 1 %/EUR 2.5 %/USD 4 %, Beta·5.5 % ERP, WACC-Floor 5.5 %, Horizont
 * 10 Jahre, WACC−g-Mindestspread 2 %) und NACH der manus-Umstellung 69c91f7:
 * der frühere Yahoo-Fallback liest jetzt die stocks-Tabelle und SCHÄTZT
 * FCF (fix 5 % der MarketCap) und Wachstum (fix 5 %) — Quelle wird ehrlich
 * als «Stammdaten (Schätzung)» ausgewiesen.
 *
 * Hinweis: Der FCF-Cap-Ast (Yield > 8 % → Kappung auf 5 % MarketCap + notes)
 * ist über den DB-Fallback prinzipiell unerreichbar (Yield ist dort per
 * Konstruktion exakt 5 %) und nur noch über den EODHD-Pfad erreichbar —
 * er ist hier deshalb nicht mehr abgedeckt.
 *
 * Daten-Mocking: EODHD ist über EODHD_API_KEY='' deaktiviert; die
 * stocks-Tabelle liefert das Fixture über einen getDb-Fake.
 * Erwartungswerte wurden durch AUSFÜHREN des aktuellen Codes ermittelt.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const h = vi.hoisted(() => ({
  stockRow: null as any,
}));

vi.mock("../db", () => ({
  getDb: async () => {
    const q: any = {
      from: () => q,
      where: () => q,
      orderBy: () => q,
      limit: () => q,
      then: (resolve: any, reject: any) =>
        Promise.resolve(h.stockRow ? [h.stockRow] : []).then(resolve, reject),
    };
    return { select: () => q };
  },
}));

import { calcDCF } from "../analytics/engine";

beforeAll(() => {
  vi.stubEnv("EODHD_API_KEY", ""); // EODHD-Pfad aus → DB-Fallback mit Fixture
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("CT-15 calcDCF (DB-Fallback, Szenario 19)", () => {
  it("stabiler CHF-Titel (MarketCap 100 Mio., Beta 0.8) → Schätz-FCF 5 %, CHF-Zins-Pfad", async () => {
    h.stockRow = {
      ticker: "STAB.SW",
      companyName: "Stabil AG",
      currency: "CHF",
      currentPrice: "100",
      marketCap: "100000000",
      beta: "0.8",
    };
    const res = await calcDCF({ ticker: "STAB.SW" });

    expect(res.dataSource).toBe("Stammdaten (Schätzung)");
    expect(res.companyName).toBe("Stabil AG");
    expect(res.currency).toBe("CHF");
    expect(res.currentPrice).toBe(100);
    expect(res.beta).toBe(0.8);
    // DB-Fallback: Wachstum fix 5 %, FCF fix 5 % der MarketCap.
    expect(res.revenueGrowthEstimate).toBe(5);
    expect(res.freeCashFlow).toBe(5000000);
    expect(res.notes).toEqual([]); // Yield exakt 5 % → kein FCF-Cap aktiv

    // CAPM-WACC mit CHF-risikofreiem Zins 1 %: 0.7·(1 % + 0.8·5.5 %) +
    // 0.3·4 %·0.79 = 4.73 % → Floor hebt auf 5.5 % (ein ERP) an.
    expect(res.wacc).toBe(5.5);
    // Wachstums-Decay 5 % → 2.5 % über 10 Jahre (DB-Fallback-Wachstum).
    expect(res.projectedFCF).toEqual([
      5237500, 5473188, 5705798, 5934030, 6156556,
      6372035, 6579127, 6776500, 6962854, 7136926,
    ]);
    expect(res.pvFCF).toBe(46279853);
    expect(res.pvTerminalValue).toBe(142754294);
    expect(res.intrinsicValue).toBe(189.03);
    expect(res.upsideDownside).toBe(89);
    expect(res.intrinsicValue).toBeGreaterThan(res.currentPrice);
  });

  it("USD-Titel ohne Beta → Default-Beta 1.0 und USD-Zins-Pfad (rf 4 %)", async () => {
    h.stockRow = {
      ticker: "USDC",
      companyName: "US Growth Corp",
      currency: "USD",
      currentPrice: "50",
      marketCap: "200000000",
      beta: null,
    };
    const res = await calcDCF({ ticker: "USDC" });

    expect(res.dataSource).toBe("Stammdaten (Schätzung)");
    expect(res.currency).toBe("USD");
    expect(res.beta).toBe(1);
    expect(res.freeCashFlow).toBe(10000000); // 5 % von 200 Mio.
    // CAPM mit USD-rf 4 %: 0.7·(4 % + 1·5.5 %) + 0.3·4 %·0.79 = 7.6 % > Floor 5.5 %.
    expect(res.wacc).toBe(7.6);
    expect(res.intrinsicValue).toBe(55.36);
    expect(res.upsideDownside).toBe(10.7);
  });
});
