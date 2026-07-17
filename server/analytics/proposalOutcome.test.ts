import { describe, it, expect } from "vitest";
import { aggregateProposalReturn } from "./proposalOutcome";

describe("aggregateProposalReturn — Vorschlags-Erfolgsmessung (K9)", () => {
  it("gewichteter Return bei voller Abdeckung", () => {
    const res = aggregateProposalReturn([
      { weightPct: 60, chfReturn: 0.10 },
      { weightPct: 40, chfReturn: -0.05 },
    ]);
    expect(res).not.toBeNull();
    expect(res!.portfolioReturn).toBeCloseTo(0.6 * 0.1 + 0.4 * -0.05, 10);
    expect(res!.coveragePct).toBe(100);
  });

  it("renormalisiert auf das abgedeckte Gewicht (Abdeckung ≥ 70 %)", () => {
    const res = aggregateProposalReturn([
      { weightPct: 50, chfReturn: 0.08 },
      { weightPct: 30, chfReturn: 0.02 },
      { weightPct: 20, chfReturn: null }, // keine Kursdaten
    ]);
    expect(res).not.toBeNull();
    // Abdeckung 80 %, Return über die abgedeckten 80 Punkte renormalisiert
    expect(res!.coveragePct).toBeCloseTo(80, 5);
    expect(res!.portfolioReturn).toBeCloseTo((50 * 0.08 + 30 * 0.02) / 80, 10);
  });

  it("unter 70 % Abdeckung: ehrlich null statt Hochrechnung", () => {
    const res = aggregateProposalReturn([
      { weightPct: 60, chfReturn: null },
      { weightPct: 40, chfReturn: 0.10 },
    ]);
    expect(res).toBeNull();
  });

  it("leere/gewichtslose Eingaben → null", () => {
    expect(aggregateProposalReturn([])).toBeNull();
    expect(aggregateProposalReturn([{ weightPct: 0, chfReturn: 0.1 }])).toBeNull();
  });

  it("nicht-finite Returns zählen als fehlende Daten", () => {
    const res = aggregateProposalReturn([
      { weightPct: 80, chfReturn: 0.05 },
      { weightPct: 20, chfReturn: NaN },
    ]);
    expect(res).not.toBeNull();
    expect(res!.coveragePct).toBeCloseTo(80, 5);
    expect(res!.portfolioReturn).toBeCloseTo(0.05, 10);
  });
});
