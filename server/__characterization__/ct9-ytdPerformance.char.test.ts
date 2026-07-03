/**
 * CT-9 — Charakterisierungstests für calculateYTDPerformance
 * (+ generateFallbackPerformance, nur via Fallback-Pfad erreichbar)
 * (server/ytd-performance.ts)
 *
 * Pinnt das hartkodierte YTD-Startdatum '2025-01-01' (R-09), die Kombination
 * mit statischen aktuellen Gewichten inkl. Renormalisierung bei totalWeight <
 * 100 (R-18) und die hartkodierte, erfundene +13.32-%-Fallback-Rampe (R-08).
 * Erwartungswerte wurden durch AUSFÜHREN des aktuellen Codes ermittelt.
 *
 * Daten-Mocking: das Modul baut seine DB-Verbindung lokal via
 * drizzle(process.env.DATABASE_URL) — der mysql2-Treiber ist durch ein Double
 * ersetzt, das die Cache-Abfragen (eine pro Stock, in Array-Reihenfolge) aus
 * einer Queue bedient. Der EODHD-API-Pfad ist über getEodhdApiKey → ''
 * deaktiviert (liefert []). Systemzeit fixiert via vi.setSystemTime, da
 * «today» und die Fallback-Rampe an new Date() hängen.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  /** Preiszeilen-Queue: ein Eintrag pro fetchCachedPrices-Aufruf (= pro Stock). */
  queue: [] as Array<Array<{ ticker: string; date: string; close: string }>>,
}));

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve(h.queue.shift() ?? []),
        }),
      }),
    }),
  }),
}));

vi.mock("../_core/env", () => ({
  ENV: {},
  // Kein API-Key → fetchDailyPricesFromAPI liefert [] (kein Netzwerkzugriff).
  getEodhdApiKey: async () => "",
}));

import { calculateYTDPerformance } from "../ytd-performance";

const AAA_ROWS = [
  { ticker: "AAA", date: "2025-01-02", close: "102" }, // +2 %
  { ticker: "AAA", date: "2025-01-03", close: "104" }, // +4 %
  { ticker: "AAA", date: "2025-01-06", close: "106" }, // +6 %
  { ticker: "AAA", date: "2025-01-07", close: "108" }, // +8 %
  { ticker: "AAA", date: "2025-01-08", close: "110" }, // +10 %
];
const BBB_ROWS = [
  { ticker: "BBB", date: "2025-01-02", close: "55" }, // +10 %
  { ticker: "BBB", date: "2025-01-03", close: "56" }, // +12 %
  { ticker: "BBB", date: "2025-01-06", close: "57" }, // +14 %
  { ticker: "BBB", date: "2025-01-07", close: "58" }, // +16 %
  { ticker: "BBB", date: "2025-01-08", close: "60" }, // +20 %
];

beforeAll(() => {
  vi.stubEnv("DATABASE_URL", "mysql://characterization-test");
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

beforeEach(() => {
  h.queue = [];
});

describe("CT-9 calculateYTDPerformance — statische Gewichte (R-18)", () => {
  it("kombiniert Tagesrenditen mit statischen AKTUELLEN Gewichten (60/40)", async () => {
    vi.setSystemTime(new Date("2025-01-08T12:00:00Z"));
    h.queue = [AAA_ROWS, BBB_ROWS];

    const series = await calculateYTDPerformance([
      { ticker: "AAA", portfolioWeight: "60", ytdStartPrice: "100" },
      { ticker: "BBB", portfolioWeight: "40", ytdStartPrice: "50" },
    ]);

    expect(series.map((p) => p.date)).toEqual([
      "2025-01-02", "2025-01-03", "2025-01-06", "2025-01-07", "2025-01-08",
    ]);
    // ISTZUSTAND — Methodik R-18: Rendite je Titel gegen ytdStartPrice, dann
    // Gewichtung mit den HEUTIGEN Portfolio-Gewichten für JEDEN Tag der Serie
    // (implizite tägliche Rebalancierung, keine FX-Umrechnung):
    // z. B. 08.01.: 0.6 · 10 % + 0.4 · 20 % = 14 %.
    const perf = series.map((p) => p.performance);
    expect(perf[0]).toBeCloseTo(5.2, 10); // 0.6·2 + 0.4·10
    expect(perf[1]).toBeCloseTo(7.2, 10); // 0.6·4 + 0.4·12
    expect(perf[2]).toBeCloseTo(9.2, 10); // 0.6·6 + 0.4·14
    expect(perf[3]).toBeCloseTo(11.2, 10); // 0.6·8 + 0.4·16
    expect(perf[4]).toBeCloseTo(14, 10); // 0.6·10 + 0.4·20
  });

  it("Titel ohne Baseline verschwindet still; Rest wird auf 100 % hochskaliert (R-18)", async () => {
    vi.setSystemTime(new Date("2025-01-08T12:00:00Z"));
    h.queue = [AAA_ROWS, BBB_ROWS];

    const series = await calculateYTDPerformance([
      { ticker: "AAA", portfolioWeight: "60", ytdStartPrice: "100" },
      { ticker: "BBB", portfolioWeight: "40", ytdStartPrice: "0" }, // Baseline fehlt
    ]);

    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-18:
    // BBB (40 % Gewicht) hat keine ytdStartPrice-Baseline → trägt nichts bei;
    // totalWeight = 60 < 100 → Normalisierung skaliert AAAs Beitrag auf 100 %.
    // Das Portfolio wird ohne Hinweis so ausgewiesen, als bestünde es zu 100 %
    // aus AAA (08.01.: 10 % statt anteilig 6 %).
    const perf = series.map((p) => p.performance);
    expect(perf[0]).toBeCloseTo(2, 10);
    expect(perf[4]).toBeCloseTo(10, 10);
  });
});

describe("CT-9 Fallback-Pfad — generateFallbackPerformance (R-08, R-09)", () => {
  it("ohne Kursdaten: erfundene lineare +13.32-%-Rampe ab hartkodiertem 2025-01-01", async () => {
    // Systemzeit 03.07.2026 — «YTD» müsste am 01.01.2026 beginnen.
    vi.setSystemTime(new Date("2026-07-03T12:00:00Z"));
    h.queue = [[]]; // Cache leer; API-Pfad liefert [] (kein Key) → Fallback

    const series = await calculateYTDPerformance([
      { ticker: "NODATA", portfolioWeight: "100", ytdStartPrice: "100" },
    ]);

    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-09:
    // Start hartkodiert '2025-01-01' — die «YTD»-Serie umfasst am 03.07.2026
    // volle 18 Monate (549 Tagespunkte).
    expect(series[0]).toEqual({ date: "2025-01-01", performance: 0 });
    expect(series).toHaveLength(549);
    expect(series[series.length - 1].date).toBe("2026-07-03");

    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-08:
    // generateFallbackPerformance ERFINDET eine linear interpolierte Rendite
    // mit hartkodiertem Endwert +13.32 % («From database calculation») —
    // unabhängig von Portfolio, Titeln und Zeitraum.
    expect(series[series.length - 1].performance).toBeCloseTo(13.32, 10);
    expect(series[274].performance).toBeCloseTo(13.32 * 274 / 548, 10); // exakt linear
    expect(series[137].performance).toBeCloseTo(13.32 * 137 / 548, 10);
  });
});
