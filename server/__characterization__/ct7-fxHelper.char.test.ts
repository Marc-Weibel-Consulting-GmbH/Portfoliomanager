/**
 * CT-7 — Charakterisierungstests für getFxRate / getFxRateSync / convertToCHF(Sync)
 * (server/fxHelper.ts)
 *
 * Pinnt FX-Lookup inkl. Rückwärtssuche und den stillen 1.0-Fallback (R-10).
 *
 * Der In-Memory-Cache wird über den Prewarm-Pfad (ensureFxRatesPrewarmed) mit
 * den Fixture-Raten gefüllt: getDb ist gemockt und liefert die FX_RATES-Zeilen
 * für `db.select().from(exchangeRates)`. Die direkten Einzelabfragen (exaktes
 * Datum / nearest ≤ Datum) liefern im Mock leere Resultate — das entspricht
 * dem Zustand «Rate fehlt auch in der DB» und pinnt so den 1.0-Fallback.
 * Der DB-seitige Nearest-Date-Pfad (getFxRate:88–106) ist damit bewusst NICHT
 * charakterisiert (bräuchte Drizzle-Query-Interpretation im Mock).
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import { FX_RATES, D } from "./fixtures";

const h = vi.hoisted(() => ({
  fxRows: [] as Array<{ date: string; currencyPair: string; rate: string }>,
}));

vi.mock("../db", () => {
  // Kette für die Einzelabfragen: .where(...).limit(1) und
  // .where(...).orderBy(...).limit(1) → immer leer (Rate fehlt in der DB).
  function emptyQuery(): any {
    const p: any = Promise.resolve([]);
    p.where = () => emptyQuery();
    p.orderBy = () => emptyQuery();
    p.limit = () => Promise.resolve([]);
    return p;
  }
  const db = {
    select: () => ({
      from: () => {
        // Prewarm: `await db.select().from(exchangeRates)` → alle Fixture-Raten.
        const p: any = Promise.resolve(h.fxRows);
        p.where = () => emptyQuery();
        return p;
      },
    }),
  };
  return { getDb: async () => db };
});

import { getFxRate, getFxRateSync, convertToCHF, convertToCHFSync } from "../fxHelper";

beforeAll(async () => {
  h.fxRows = FX_RATES;
  // Erster Aufruf triggert den Prewarm (füllt den Cache mit den Fixture-Raten).
  await getFxRate(D.mar03, "USDCHF");
});

describe("CT-7 getFxRate (async)", () => {
  it("liefert die exakte Rate aus dem Cache (Szenario 7)", async () => {
    expect(await getFxRate(D.mar03, "USDCHF")).toBeCloseTo(0.88, 10);
    expect(await getFxRate(D.mar05, "USDCHF")).toBeCloseTo(0.9, 10);
    expect(await getFxRate(D.mar07, "USDCHF")).toBeCloseTo(0.92, 10);
    expect(await getFxRate(D.mar03, "EURCHF")).toBeCloseTo(0.95, 10);
  });

  it("CHFCHF ist immer 1.0", async () => {
    expect(await getFxRate(D.mar03, "CHFCHF")).toBe(1.0);
  });

  it("fehlendes Paar → stiller 1.0-Fallback (R-10, Szenario 6)", async () => {
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-10:
    // GBPCHF existiert weder im Cache noch in der (Mock-)DB — statt null/Fehler
    // wird stillschweigend 1.0 geliefert (GBP-Beträge würden 1:1 als CHF gelten).
    expect(await getFxRate(D.mar03, "GBPCHF")).toBe(1.0);
  });
});

describe("CT-7 getFxRateSync", () => {
  it("liefert exakte Raten aus dem geprewarmten Cache", () => {
    expect(getFxRateSync(D.mar03, "USDCHF")).toBeCloseTo(0.88, 10);
    expect(getFxRateSync(D.mar05, "USDCHF")).toBeCloseTo(0.9, 10);
    expect(getFxRateSync(D.mar03, "EURCHF")).toBeCloseTo(0.95, 10);
    expect(getFxRateSync(D.mar03, "CHFCHF")).toBe(1.0);
  });

  it("Lückentag: Rückwärtssuche bis 5 Tage findet die letzte Rate", () => {
    // 04.03. fehlt → 03.03. (0.88); 10.03. fehlt → 3 Tage zurück bis 07.03. (0.92).
    expect(getFxRateSync(D.mar04, "USDCHF")).toBeCloseTo(0.88, 10);
    expect(getFxRateSync("2025-03-10", "USDCHF")).toBeCloseTo(0.92, 10);
  });

  it("Lücke > 5 Tage → stiller 1.0-Fallback (R-10)", () => {
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-10:
    // Am 01.06. liegt die letzte Rate (07.03.) ausserhalb des 5-Tage-Fensters —
    // statt null/Fehler wird 1.0 geliefert (USD-Bewertung 1:1 als CHF).
    expect(getFxRateSync("2025-06-01", "USDCHF")).toBe(1.0);
  });

  it("unbekanntes Paar → stiller 1.0-Fallback (R-10)", () => {
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-10:
    expect(getFxRateSync(D.mar03, "GBPCHF")).toBe(1.0);
  });
});

describe("CT-7 convertToCHF / convertToCHFSync", () => {
  it("CHF-Beträge werden unverändert durchgereicht", async () => {
    expect(convertToCHFSync(2000, "CHF", D.mar03)).toBe(2000);
    expect(await convertToCHF(2000, "CHF", D.mar03)).toBe(2000);
  });

  it("Szenario 7: USD-Kauf 2'000 mit Rate 0.88 → CHF 1'760", async () => {
    expect(convertToCHFSync(2000, "USD", D.mar03)).toBeCloseTo(1760, 10);
    expect(await convertToCHF(2000, "USD", D.mar03)).toBeCloseTo(1760, 10);
    // Bewertungsdatum ≠ Transaktionsdatum: 05.03. mit 0.90 → 1'800 (R-12/R-15-Kontext):
    expect(convertToCHFSync(2000, "USD", D.mar05)).toBeCloseTo(1800, 10);
  });

  it("Szenario 6: USD ohne erreichbare Rate → Betrag 1:1 als CHF (R-10)", () => {
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-10:
    // Keine USDCHF-Rate in Reichweite (01.06.) → 2'000 USD werden als
    // CHF 2'000 «konvertiert» (~12 % Bewertungsfehler), ohne Warnung.
    expect(convertToCHFSync(2000, "USD", "2025-06-01")).toBe(2000);
  });
});
