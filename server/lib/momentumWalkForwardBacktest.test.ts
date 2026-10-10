import { describe, expect, it } from "vitest";
import {
  buildCensoredMomentumObservations,
  evaluateMomentumWalkForward,
  MIN_DECISION_DATES,
  type HistoricalMomentumRow,
} from "./momentumWalkForwardBacktest";

function row(overrides: Partial<HistoricalMomentumRow> = {}): HistoricalMomentumRow {
  return {
    ticker: "AAA",
    signalDate: "2024-01-31",
    executionDate: "2024-02-01",
    exitDate: "2024-03-01",
    entryPrice: 100,
    exitPrice: 110,
    universePercentile: 90,
    trendState: "intakt",
    crashRiskActive: false,
    dataQuality: "qualified",
    ...overrides,
  };
}

describe("buildCensoredMomentumObservations", () => {
  it("verwirft denselben Preiszeitpunkt als Look-ahead statt ihn zu schätzen", () => {
    const result = buildCensoredMomentumObservations([row({ executionDate: "2024-01-31" })]);
    expect(result.rows).toEqual([]);
    expect(result.excludedRows).toBe(1);
  });

  it("zieht Rundlaufkosten auch von einem klaren Gewinner ab", () => {
    const result = buildCensoredMomentumObservations([row()]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].grossReturnPct).toBeCloseTo(10, 8);
    expect(result.rows[0].netReturnPct).toBeLessThan(10);
  });

  it("lässt Corporate-Action- und Datenqualitätslücken vollständig aus", () => {
    const result = buildCensoredMomentumObservations([
      row({ dataQuality: "data_gap" }),
      row({ ticker: "BBB", dataQuality: "excluded" }),
    ]);
    expect(result.rows).toEqual([]);
    expect(result.excludedRows).toBe(2);
  });

  it("schließt Überhitzung und Crash-Gate aus der fixen Auswahl aus", () => {
    const result = buildCensoredMomentumObservations([
      row({ trendState: "ueberhitzt" }),
      row({ ticker: "BBB", crashRiskActive: true }),
      row({ ticker: "CCC", universePercentile: 74 }),
    ]);
    expect(result.rows.every((candidate) => !candidate.selected)).toBe(true);
  });
});

describe("evaluateMomentumWalkForward", () => {
  it("trennt ausschließlich nach Zeit und nie denselben Stichtag auf beide Seiten", () => {
    const rows: HistoricalMomentumRow[] = Array.from({ length: 30 }, (_, index) => {
      const month = String((index % 12) + 1).padStart(2, "0");
      const year = 2021 + Math.floor(index / 12);
      const signalDate = `${year}-${month}-20`;
      const executionDate = `${year}-${month}-21`;
      return row({ ticker: `T${index}`, signalDate, executionDate, exitDate: `${year}-${month}-28` });
    });
    const result = evaluateMomentumWalkForward(rows);
    expect(result.splitDate).not.toBeNull();
    expect(result.training.dates + result.outOfSample.dates).toBe(30);
    expect(result.eligibleForSignalWeight).toBe(false);
  });

  it("verweigert bei zu wenig Historie ausdrücklich jede Übernahme", () => {
    const result = evaluateMomentumWalkForward([row(), row({ ticker: "BBB", signalDate: "2024-02-29", executionDate: "2024-03-01", exitDate: "2024-03-29" })]);
    expect(result.verdict).toContain(`/${MIN_DECISION_DATES}`);
    expect(result.eligibleForSignalWeight).toBe(false);
  });
});
