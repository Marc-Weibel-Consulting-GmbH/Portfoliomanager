import { describe, it, expect } from "vitest";
import { selectDueConfigs } from "./scheduledRecommendations";
import { cadenceDays } from "./recommendationCadence";

const DAY = 86_400_000;
const NOW = 1_700_000_000_000; // fester Referenzzeitpunkt (kein Date.now)

describe("selectDueConfigs", () => {
  it("überspringt Kadenz 'off' immer", () => {
    const due = selectDueConfigs([{ cadence: "off", lastGeneratedAt: null }], NOW);
    expect(due).toHaveLength(0);
  });

  it("nie generiert (lastGeneratedAt null) → sofort fällig", () => {
    const due = selectDueConfigs(
      [
        { cadence: "weekly", lastGeneratedAt: null },
        { cadence: "monthly", lastGeneratedAt: null },
        { cadence: "quarterly", lastGeneratedAt: null },
      ],
      NOW
    );
    expect(due).toHaveLength(3);
  });

  it("wöchentlich: gestern generiert → noch nicht fällig; vor 8 Tagen → fällig", () => {
    const configs = [
      { id: "fresh", cadence: "weekly" as const, lastGeneratedAt: new Date(NOW - 1 * DAY) },
      { id: "stale", cadence: "weekly" as const, lastGeneratedAt: new Date(NOW - 8 * DAY) },
    ];
    const due = selectDueConfigs(configs, NOW);
    expect(due.map((c) => c.id)).toEqual(["stale"]);
  });

  it("respektiert das jeweilige Kadenz-Intervall (monatlich vs. quartalsweise)", () => {
    const at = (days: number) => new Date(NOW - days * DAY);
    // 40 Tage her: monatlich (30) fällig, quartalsweise (91) nicht.
    const due = selectDueConfigs(
      [
        { id: "m", cadence: "monthly" as const, lastGeneratedAt: at(40) },
        { id: "q", cadence: "quarterly" as const, lastGeneratedAt: at(40) },
      ],
      NOW
    );
    expect(due.map((c) => c.id)).toEqual(["m"]);
    // Grenzwert exakt am Intervall ist fällig (>=).
    const exact = selectDueConfigs(
      [{ id: "q", cadence: "quarterly" as const, lastGeneratedAt: at(cadenceDays("quarterly")) }],
      NOW
    );
    expect(exact).toHaveLength(1);
  });

  it("akzeptiert ISO-String-Zeitstempel (DB-Serialisierung)", () => {
    const due = selectDueConfigs(
      [{ cadence: "weekly", lastGeneratedAt: new Date(NOW - 10 * DAY).toISOString() }],
      NOW
    );
    expect(due).toHaveLength(1);
  });
});
