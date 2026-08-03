/**
 * Zwei Kennzahlen, die in der Anzeige auffällig geworden sind:
 *
 *  1. EPS-Stabilität stand bei praktisch jedem Titel auf 0. Ursache war der
 *     Variationskoeffizient im Nenner — nicht die Datenlage.
 *  2. Forward PEG von 47.6 bei einem Titel mit fast keinem Wachstum. Rechnerisch
 *     richtig, inhaltlich wertlos.
 *
 * Die Tests halten beides fest.
 */

import { describe, it, expect } from "vitest";
import { extractMetrics } from "./qualityMetricsService";

/** EODHD-Antwort mit einer EPS-Jahresreihe; alles andere bleibt leer. */
function payload(epsJahre: number[], extra: Record<string, unknown> = {}) {
  const Annual: Record<string, { epsActual: number }> = {};
  epsJahre.forEach((eps, i) => {
    Annual[`${2015 + i}-12-31`] = { epsActual: eps };
  });
  return {
    Highlights: {},
    Valuation: {},
    Financials: {},
    Earnings: { Annual, History: {} },
    ...extra,
  };
}

// Die drei Reihen, an denen sich die alte und die neue Formel unterscheiden.
// Werte der alten Formel (100 − CV/1.5 × 100) in Klammern, nachgerechnet:
const GLATT = [3.00, 3.18, 3.35, 3.58, 3.77, 4.02, 4.25, 4.51, 4.79, 5.06, 5.38];       // alt 94
const EIN_EINBRUCH = [3.00, 3.45, 2.24, 3.14, 3.39, 3.80, 3.61, 4.51, 4.96, 5.85, 6.20]; // alt 0
const SPRUNGHAFT = [3.00, 4.80, 1.90, 5.40, 2.10, 6.00, 1.50, 5.80, 2.40, 6.30, 1.80];   // alt 0

describe("EPS-Stabilität", () => {
  it("gibt einem soliden Titel mit einem Einbruchsjahr keine 0 mehr", () => {
    // Das ist der Fall, an dem die alte Formel scheiterte: ein Unternehmen mit
    // steigenden Gewinnen und einem schwachen Jahr (Krise, Restrukturierung).
    // Der Variationskoeffizient sprang auf 2.1 — über der Grenze von 1.5 —,
    // also fiel der Score auf exakt 0. Bei zehn Jahren Historie hat fast jedes
    // reale Unternehmen so ein Jahr.
    const m = extractMetrics(payload(EIN_EINBRUCH), "SOLIDE.SW");
    expect(m.epsStabilityScore).not.toBeNull();
    expect(m.epsStabilityScore!).toBeGreaterThan(50);
  });

  it("unterscheidet ein Einbruchsjahr von durchgehend sprunghaften Gewinnen", () => {
    // Der eigentliche Schaden der alten Formel: Beide Reihen bekamen 0. Ein
    // Faktor, der zwei so verschiedene Titel gleich bewertet, trägt nichts
    // bei — zieht aber in `berechneQualitaet` mit 15 % Gewicht.
    const solide = extractMetrics(payload(EIN_EINBRUCH), "SOLIDE.SW").epsStabilityScore!;
    const wild = extractMetrics(payload(SPRUNGHAFT), "WILD.SW").epsStabilityScore!;
    expect(wild).toBeLessThan(solide);
    expect(wild).toBeLessThan(20);
  });

  it("gibt der gleichmässigsten Reihe die Bestnote", () => {
    const glatt = extractMetrics(payload(GLATT), "GLATT.SW").epsStabilityScore!;
    const solide = extractMetrics(payload(EIN_EINBRUCH), "SOLIDE.SW").epsStabilityScore!;
    expect(glatt).toBeGreaterThan(solide);
    expect(glatt).toBeGreaterThan(90);
  });

  it("gibt null statt einer erfundenen Mitte, wenn die Historie zu kurz ist", () => {
    const m = extractMetrics(payload([3.0, 3.2, 3.4]), "KURZ.SW");
    expect(m.epsStabilityScore).toBeNull();
  });

  it("bleibt innerhalb von 0 bis 100", () => {
    const extrem = [1.0, 90.0, 0.5, 120.0, 0.3, 150.0, 0.2, 200.0, 0.1, 250.0, 0.05];
    const m = extractMetrics(payload(extrem), "EXTREM.SW");
    expect(m.epsStabilityScore!).toBeGreaterThanOrEqual(0);
    expect(m.epsStabilityScore!).toBeLessThanOrEqual(100);
  });
});

describe("Forward PEG", () => {
  const sechsJahre = (letzte: number) => [4.50, 4.70, 4.90, 5.00, 5.00, 5.00, letzte];

  it("unterdrückt das PEG, wenn das Wachstum unter 2 % p.a. liegt", () => {
    // 5.00 → 5.10 über fünf Jahre = 0.4 % p.a. Frueher ergab das ein PEG von
    // rund 80 und wurde als Zahl angezeigt.
    const m = extractMetrics(
      payload(sechsJahre(5.10), { Valuation: { ForwardPE: 32 } }),
      "FLACH.SW",
    );
    expect(m.epsGrowth5y).not.toBeNull();
    expect(m.epsGrowth5y!).toBeLessThan(2);
    expect(m.forwardPeg).toBeNull();
  });

  it("rechnet das PEG bei tragfähigem Wachstum weiterhin", () => {
    // 5.00 → 6.50 über fünf Jahre = 5.4 % p.a.
    const m = extractMetrics(
      payload(sechsJahre(6.50), { Valuation: { ForwardPE: 32 } }),
      "WAECHST.SW",
    );
    expect(m.epsGrowth5y!).toBeGreaterThan(2);
    expect(m.forwardPeg).not.toBeNull();
    expect(m.forwardPeg!).toBeCloseTo(32 / m.epsGrowth5y!, 6);
  });
});
