/**
 * SIG-4 (Audit 2026-07): Das Basis-Signal muss die optimierten Gewichte
 * tatsächlich anwenden (vorher lud der signalCacheCron die Gewichte, rechnete
 * aber eine ungewichtete Kopie).
 */
import { describe, it, expect } from "vitest";
import { generateSignal } from "./baseSignal";
import { DEFAULT_WEIGHTS } from "../analytics/optimizerWorker";

const rsiOnlyStock = {
  ticker: "TEST",
  companyName: "Test AG",
  peRatio: null,
  pegRatio: null,
  dividendYield: 0,
  currentPrice: 100,
  fiftyTwoWeekHigh: null,
  fiftyTwoWeekLow: null,
  ytdPerformance: 0,
  rsi14: 25, // überverkauft → +2 (ungewichtet) bzw. +2 · rsi-Gewicht · 12
};

describe("generateSignal — gewichtetes Basis-Signal (SIG-4)", () => {
  it("ohne Gewichte: RSI überverkauft ergibt schwaches Kaufsignal (Score 2)", () => {
    const sig = generateSignal(rsiOnlyStock);
    expect(sig.type).toBe("buy");
    expect(sig.strength).toBe("weak");
  });

  it("mit hohem RSI-Gewicht wird dasselbe Signal stärker — Gewichte wirken", () => {
    // rsi 0.20 · Skala 12 = 2.4 → Score 4.8 → moderate (statt weak).
    const sig = generateSignal(rsiOnlyStock, { ...DEFAULT_WEIGHTS, rsi: 0.20 });
    expect(sig.type).toBe("buy");
    expect(sig.strength).toBe("moderate");
  });

  it("mit minimalem RSI-Gewicht bleibt das Signal neutral — Gewichte wirken auch dämpfend", () => {
    // rsi 0.04 · 12 = 0.48 → Score 0.96 < 1 → hold.
    const sig = generateSignal(rsiOnlyStock, { ...DEFAULT_WEIGHTS, rsi: 0.04 });
    expect(sig.type).toBe("hold");
  });
});
