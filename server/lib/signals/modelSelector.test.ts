/**
 * SIG-7 (Audit 2026-07): Gelernte Engine-Priors schliessen die Gedächtnis-
 * Schleife — selectBestModel muss sie den hartkodierten Regime-Priors
 * vorziehen. Getestet mit zwei IDENTISCH neutralen Signalen: die Evaluation
 * beider Engines ist dann gleich, die Auswahl hängt allein am Prior.
 */
import { describe, it, expect } from "vitest";
import { selectBestModel } from "./modelSelector";
import type { SignalEngineType, SignalOutput } from "./types";

function neutralSignal(engine: SignalEngineType): SignalOutput {
  return {
    engine,
    direction: 0,
    rawScore: 0,
    confidence: 0.5,
    entry: false,
    exit: false,
    stopLossPct: null,
    takeProfitPct: null,
    trailingStopPct: null,
    holdingPeriodHint: null,
    rationale: [],
  };
}

// Flache Preisreihe (>= 210 Punkte, damit Walk-Forward aktiv ist) — bei
// direction 0 sind alle Strategie-Renditen 0, die Evaluation ist deterministisch.
const prices = Array.from({ length: 260 }, () => 100);

const signals = new Map<SignalEngineType, SignalOutput>([
  ["trend", neutralSignal("trend")],
  ["mean_reversion", neutralSignal("mean_reversion")],
]);

describe("selectBestModel — gelernte Priors (SIG-7)", () => {
  it("ohne gelernte Priors gewinnt der Default-Prior (bull_trend → trend 0.50)", () => {
    const result = selectBestModel(prices, "bull_trend", signals);
    expect(result.selectedEngine).toBe("trend");
  });

  it("gelernte Priors überstimmen die Defaults (mean_reversion hochgewichtet)", () => {
    const learned = { mean_reversion: 0.7, trend: 0.1 };
    const result = selectBestModel(prices, "bull_trend", signals, learned);
    expect(result.selectedEngine).toBe("mean_reversion");
    expect(result.rationale.join("\n")).toContain("GELERNT");
  });

  it("Engines ohne gelernten Eintrag fallen auf den Default-Prior zurück", () => {
    // Nur mean_reversion gelernt (schwach) — trend behält Default 0.50 und gewinnt.
    const learned = { mean_reversion: 0.05 };
    const result = selectBestModel(prices, "bull_trend", signals, learned);
    expect(result.selectedEngine).toBe("trend");
  });
});
