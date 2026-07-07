import { describe, it, expect } from "vitest";
import { blendSignal, resolveWeights, DEFAULT_REGIME_BLEND } from "./signalBlend";
import { learnRegimeWeights, type EvaluatedSignalRow } from "./signalMemory";

describe("blendSignal", () => {
  it("gewichtet im Bullenmarkt das Trading-Signal stärker als in der Krise", () => {
    const input = { qualityScore: 90, tradingScore: -60, regime: "bull" as const };
    const bull = blendSignal(input, DEFAULT_REGIME_BLEND);
    const crisis = blendSignal({ ...input, regime: "crisis" }, DEFAULT_REGIME_BLEND);
    // Bei negativem Timing zieht mehr Trading-Gewicht (bull) den Score tiefer als in der Krise.
    expect(bull.score).toBeLessThan(crisis.score);
  });

  it("normalisiert Gewichte immer auf Summe 1, auch bei krummen Admin-Eingaben", () => {
    const cfg = { default: { quality: 3, trading: 1 } };
    const r = blendSignal({ qualityScore: 100, tradingScore: 0, regime: "x" }, cfg);
    expect(r.weights.quality + r.weights.trading).toBeCloseTo(1, 6);
    expect(r.weights.quality).toBeCloseTo(0.75, 6);
  });

  it("hohe Qualität + starkes Kauf-Timing → strong_buy", () => {
    const r = blendSignal({ qualityScore: 95, tradingScore: 80, regime: "bull" }, DEFAULT_REGIME_BLEND);
    expect(r.recommendation).toBe("strong_buy");
    expect(r.score).toBeGreaterThan(50);
  });

  it("neutrale Qualität + neutrales Timing → hold", () => {
    const r = blendSignal({ qualityScore: 50, tradingScore: 0, regime: "sideways_low_vol" }, DEFAULT_REGIME_BLEND);
    expect(r.recommendation).toBe("hold");
    expect(r.score).toBe(0);
  });

  it("unbekanntes Regime fällt auf default zurück", () => {
    const w = resolveWeights("voll-unbekannt", DEFAULT_REGIME_BLEND);
    expect(w).toEqual(DEFAULT_REGIME_BLEND.default);
  });

  it("Regime-Auflösung ist tolerant gegenüber Schreibweise (Bindestrich/Groß)", () => {
    expect(resolveWeights("Sideways-High-Vol", DEFAULT_REGIME_BLEND)).toEqual(
      DEFAULT_REGIME_BLEND.sideways_high_vol
    );
  });
});

describe("learnRegimeWeights (Gedächtnis)", () => {
  const many = (engine: string, regime: string, alpha: number, n: number): EvaluatedSignalRow[] =>
    Array.from({ length: n }, () => ({ engine, regime, alphaPct: alpha }));

  it("gibt der Engine mit höherem Alpha im Regime mehr Gewicht", () => {
    const rows = [
      ...many("momentum", "bull", 4, 30),
      ...many("meanrev", "bull", -1, 30),
    ];
    const w = learnRegimeWeights(rows);
    expect(w.bull.momentum).toBeGreaterThan(w.bull.meanrev);
    expect(w.bull.momentum + w.bull.meanrev).toBeCloseTo(1, 6);
  });

  it("zieht Engines mit zu wenig Beobachtungen auf neutral (Regime-Mittel)", () => {
    const rows = [
      ...many("momentum", "bear", 5, 30),
      ...many("newbie", "bear", 20, 2), // hohes Alpha, aber nur 2 Beobachtungen
    ];
    const w = learnRegimeWeights(rows, { minSamples: 5 });
    // Trotz höherem Roh-Alpha darf 'newbie' wegen dünner Evidenz momentum nicht überflügeln.
    expect(w.bear.newbie).toBeLessThanOrEqual(w.bear.momentum);
  });

  it("respektiert die maximale Gewichtsschranke (keine Monokultur)", () => {
    const rows = [
      ...many("star", "crisis", 10, 50),
      ...many("a", "crisis", 0, 50),
      ...many("b", "crisis", 0, 50),
    ];
    const w = learnRegimeWeights(rows, { maxWeight: 0.6 });
    expect(w.crisis.star).toBeLessThanOrEqual(0.6 + 1e-9);
    const sum = Object.values(w.crisis).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("ignoriert nicht-endliche Alpha-Werte", () => {
    const rows: EvaluatedSignalRow[] = [
      { engine: "e1", regime: "bull", alphaPct: NaN },
      ...many("e1", "bull", 2, 10),
      ...many("e2", "bull", 1, 10),
    ];
    const w = learnRegimeWeights(rows);
    expect(Number.isFinite(w.bull.e1)).toBe(true);
    expect(Number.isFinite(w.bull.e2)).toBe(true);
  });
});
