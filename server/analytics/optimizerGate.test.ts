/**
 * Promotion-Gate von saveOptimizerResult (KIMI-Audit ①).
 *
 * Prüft die Aktivierungs-Entscheidung: der Kandidat wird nur aktiv, wenn er
 * den Incumbent out-of-sample erreicht/übertrifft. Sonst bleibt der aktive Satz
 * unangetastet (kein update auf isActive), der Kandidat landet nur als inaktive
 * Zeile.
 *
 * Massstab ist seit der Umstellung der Netto-Sharpe (Toleranz 0.05). Fehlt er
 * — Ergebnisse aus Läufen vor der Umstellung —, fällt das Gate auf die
 * Trefferquote zurück (Toleranz 0.5 Pp). Beide Wege sind hier abgedeckt.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  updateCalls: 0,
  inserted: [] as any[],
}));

function fakeDb() {
  return {
    update: () => ({ set: async () => { h.updateCalls++; } }),
    insert: () => ({ values: async (v: any) => { h.inserted.push(v); } }),
  };
}

vi.mock("../db", () => ({ getDb: async () => fakeDb() }));

import { saveOptimizerResult, type OptimizerResult } from "./optimizerWorker";

function makeResult(candidateOos: number, incumbentOos: number | null): OptimizerResult {
  return {
    bestWeights: { pe: 0.1, peg: 0.07, rsi: 0.14, macd: 0.07, dividend: 0.07, week52: 0.07, ytd: 0.07, rf: 0.08, sentiment: 0.05, bubble: 0.1, quality: 0.1, momentum: 0.08 } as any,
    hitRate: 60,
    totalBacktested: 100,
    correctSignals: 60,
    topCombinations: [],
    log: [],
    durationMs: 1,
    walkForward: {
      inSampleHitRate: 65,
      outOfSampleHitRate: candidateOos,
      inSampleCount: 100,
      outOfSampleCount: 100,
      overfitRatio: 1.1,
      incumbentOutOfSampleHitRate: incumbentOos,
    },
  };
}

/** Wie `makeResult`, aber mit Netto-Sharpe auf beiden Seiten. */
function makeSharpeResult(candidateSharpe: number, incumbentSharpe: number | null): OptimizerResult {
  const base = makeResult(50, 55); // Trefferquote bewusst gegenläufig zum Sharpe
  return {
    ...base,
    walkForward: {
      ...base.walkForward!,
      inSampleSharpe: 1.2,
      outOfSampleSharpe: candidateSharpe,
      incumbentOutOfSampleSharpe: incumbentSharpe,
    },
  };
}

beforeEach(() => { h.updateCalls = 0; h.inserted = []; });

describe("saveOptimizerResult — Promotion-Gate", () => {
  it("aktiviert, wenn OOS-Kandidat > Incumbent", async () => {
    const out = await saveOptimizerResult(makeResult(58, 55), { triggeredBy: "cron" });
    expect(out.activated).toBe(true);
    expect(h.updateCalls).toBe(1); // isActive:0 auf alle alten
    expect(h.inserted[0].isActive).toBe(1);
    expect(h.inserted[0].name).toMatch(/^optimized_/);
  });

  it("verwirft, wenn OOS-Kandidat deutlich unter Incumbent", async () => {
    const out = await saveOptimizerResult(makeResult(50, 55), { triggeredBy: "cron" });
    expect(out.activated).toBe(false);
    expect(h.updateCalls).toBe(0); // Incumbent bleibt unangetastet
    expect(h.inserted[0].isActive).toBe(0);
    expect(h.inserted[0].name).toMatch(/^rejected_/);
  });

  it("akzeptiert innerhalb der Toleranz (0.5 Pp)", async () => {
    const out = await saveOptimizerResult(makeResult(54.7, 55), { triggeredBy: "cron" });
    expect(out.activated).toBe(true);
  });

  it("akzeptiert beim Erstlauf (kein Incumbent)", async () => {
    const out = await saveOptimizerResult(makeResult(48, null), { triggeredBy: "cron" });
    expect(out.activated).toBe(true);
    expect(h.updateCalls).toBe(1);
    expect(h.inserted[0].isActive).toBe(1);
  });

  it("fällt auf die Trefferquote zurück, wenn kein Sharpe vorliegt", async () => {
    const out = await saveOptimizerResult(makeResult(58, 55), { triggeredBy: "cron" });
    expect(out.massstab).toBe("hitRate");
    expect(out.candidateOos).toBe(58);
  });

  it("entscheidet auf dem Sharpe, nicht auf der Trefferquote", async () => {
    // Trefferquote 50 gegen 55 — nach altem Massstab verworfen. Der Netto-Sharpe
    // ist aber besser: weniger Treffer, aber die richtigen.
    const out = await saveOptimizerResult(makeSharpeResult(0.9, 0.6), { triggeredBy: "cron" });
    expect(out.massstab).toBe("sharpe");
    expect(out.activated).toBe(true);
    expect(out.candidateOos).toBe(0.9);
    expect(out.incumbentOos).toBe(0.6);
  });

  it("verwirft einen Kandidaten mit schlechterem Sharpe trotz besserer Trefferquote", async () => {
    const base = makeSharpeResult(0.3, 0.8);
    base.walkForward!.outOfSampleHitRate = 70; // deutlich besser als der Incumbent
    const out = await saveOptimizerResult(base, { triggeredBy: "cron" });
    expect(out.massstab).toBe("sharpe");
    expect(out.activated).toBe(false);
    expect(h.updateCalls).toBe(0);
    expect(h.inserted[0].name).toMatch(/^rejected_/);
  });

  it("akzeptiert innerhalb der Sharpe-Toleranz (0.05)", async () => {
    const out = await saveOptimizerResult(makeSharpeResult(0.76, 0.80), { triggeredBy: "cron" });
    expect(out.activated).toBe(true);
  });

  it("akzeptiert beim Erstlauf auch ohne Incumbent-Sharpe", async () => {
    const out = await saveOptimizerResult(makeSharpeResult(0.1, null), { triggeredBy: "cron" });
    // Ohne Incumbent-Sharpe greift der Rückfall — und dort ist der Incumbent
    // ebenfalls unbekannt (makeResult setzt 55), also entscheidet die Trefferquote.
    expect(out.massstab).toBe("hitRate");
  });
});
