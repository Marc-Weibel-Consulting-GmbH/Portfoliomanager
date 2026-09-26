import { describe, expect, it } from "vitest";
import { berechneTimingAusPreisreihe } from "./scoreRefreshFromHistory";

function businessDays(count: number) {
  const start = new Date("2025-01-02T00:00:00Z");
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), close: 100 + index * 0.12 };
  });
}

describe("berechneTimingAusPreisreihe", () => {
  it("liefert direkt nach einer ausreichend langen Preisbasis Timing, Regime und Faktoren", () => {
    const result = berechneTimingAusPreisreihe(businessDays(300), 136);

    expect(result.ready).toBe(true);
    expect(result.timing.score).not.toBeNull();
    expect(result.timing.abdeckung).toBeGreaterThanOrEqual(0.6);
    expect(result.timing.faktoren.length).toBeGreaterThan(0);
    expect(result.regime).not.toBe("default");
  });

  it("weist bei zu kurzer Reihe eine Datenlücke aus statt einen Signalwert zu erfinden", () => {
    const result = berechneTimingAusPreisreihe(businessDays(30), 103);

    expect(result.ready).toBe(false);
    expect(result.timing.score).toBeNull();
    expect(result.hinweis).toContain("mindestens 60");
  });
});
