import { describe, it, expect } from "vitest";
import { extractEarningsInsights } from "./eodhdEarnings";

// Realistischer Ausschnitt der EODHD-/api/fundamentals-Antwort (GOOGL.US-Stil).
// Belegt den Datencheck: Surprise-Historie, nächster Konsens und
// Analysten-Kursziel stecken alle in derselben Antwort, die wir schon abrufen.
const RAW = {
  Highlights: { EPSEstimateNextQuarter: 2.87, EPSEstimateCurrentYear: 11.4 },
  Earnings: {
    History: {
      "2026-03-31": { reportDate: "2026-04-28", date: "2026-03-31", epsActual: 5.11, epsEstimate: 2.66, surprisePercent: 92.1 },
      "2025-12-31": { reportDate: "2026-02-03", date: "2025-12-31", epsActual: 2.15, epsEstimate: 2.01, surprisePercent: 6.9 },
      "2025-09-30": { reportDate: "2025-10-28", date: "2025-09-30", epsActual: 2.12, epsEstimate: 1.68, surprisePercent: 26.2 },
      "2025-06-30": { reportDate: "2025-07-23", date: "2025-06-30", epsActual: 1.89, epsEstimate: 1.84, surprisePercent: 2.7 },
      "2025-03-31": { reportDate: "2025-04-24", date: "2025-03-31", epsActual: 1.75, epsEstimate: 1.79, surprisePercent: -2.2 },
      // noch nicht berichtet — muss ignoriert werden:
      "2026-06-30": { reportDate: "2026-07-22", date: "2026-06-30", epsActual: null, epsEstimate: 2.87 },
    },
    Trend: {
      "2026-06-30": { date: "2026-06-30", period: "0q", earningsEstimateAvg: 2.87, revenueEstimateAvg: 113600000000 },
      "2026-09-30": { date: "2026-09-30", period: "+1q", earningsEstimateAvg: 3.05, revenueEstimateAvg: 119000000000 },
    },
  },
  AnalystRatings: { Rating: 1.7, TargetPrice: 428.5, StrongBuy: 22, Buy: 15, Hold: 8, Sell: 1, StrongSell: 0 },
};

describe("extractEarningsInsights", () => {
  const r = extractEarningsInsights(RAW);

  it("liefert die letzten 4 berichteten Quartale, neueste zuerst", () => {
    expect(r.surprises).toHaveLength(4);
    expect(r.surprises[0].date).toBe("2026-04-28"); // reportDate bevorzugt
    expect(r.surprises[0].epsActual).toBe(5.11);
    expect(r.surprises[0].epsEstimate).toBe(2.66);
    expect(r.surprises[0].beat).toBe(true);
  });

  it("ignoriert noch nicht berichtete Quartale (epsActual null)", () => {
    expect(r.surprises.some((s) => s.epsActual === null)).toBe(false);
  });

  it("zählt die Beats korrekt", () => {
    // 5.11, 2.15, 2.12, 1.89 — alle über Estimate ⇒ 4 Beats
    expect(r.beatCount).toBe(4);
  });

  it("berechnet fehlenden surprisePercent selbst", () => {
    const rr = extractEarningsInsights({ Earnings: { History: { "2025-01-01": { date: "2025-01-01", epsActual: 2.2, epsEstimate: 2.0 } } } });
    expect(rr.surprises[0].surprisePercent).toBeCloseTo(10, 5);
  });

  it("liest den nächsten Quartals-Konsens (0q) aus Earnings.Trend", () => {
    expect(r.nextEarningsDate).toBe("2026-06-30");
    expect(r.nextEpsEstimate).toBe(2.87);
    expect(r.nextRevenueEstimate).toBe(113600000000);
  });

  it("liest Analysten-Kursziel und Rating-Verteilung", () => {
    expect(r.analyst?.targetPrice).toBe(428.5);
    expect(r.analyst?.rating).toBe(1.7);
    expect(r.analyst?.strongBuy).toBe(22);
    expect(r.analyst?.hold).toBe(8);
  });

  it("leere/fehlende Antwort ⇒ leeres Insights-Objekt", () => {
    const empty = extractEarningsInsights({});
    expect(empty.surprises).toHaveLength(0);
    expect(empty.beatCount).toBe(0);
    expect(empty.nextEarningsDate).toBeNull();
    expect(empty.analyst).toBeNull();
  });
});
