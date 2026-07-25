/**
 * Promotion-Gate von saveOptimizerResult (KIMI-Audit ①).
 *
 * Prüft die Aktivierungs-Entscheidung: der Kandidat wird nur aktiv, wenn er
 * den Incumbent out-of-sample erreicht/übertrifft (Toleranz 0.5 Pp). Sonst
 * bleibt der aktive Satz unangetastet (kein update auf isActive), der Kandidat
 * landet nur als inaktive Zeile.
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
});
