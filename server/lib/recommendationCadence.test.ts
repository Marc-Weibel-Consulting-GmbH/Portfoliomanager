import { describe, it, expect } from "vitest";
import { isDue, nextDueMs, cadenceDays } from "./recommendationCadence";

const DAY = 86_400_000;
const NOW = new Date("2026-07-07T00:00:00Z").getTime();

describe("recommendationCadence", () => {
  it("liefert sinnvolle Intervalle", () => {
    expect(cadenceDays("weekly")).toBe(7);
    expect(cadenceDays("monthly")).toBe(30);
    expect(cadenceDays("quarterly")).toBe(91);
    expect(cadenceDays("off")).toBe(Infinity);
  });

  it("ist bei 'off' nie fällig und hat kein Fälligkeitsdatum", () => {
    expect(isDue("off", null, NOW)).toBe(false);
    expect(isDue("off", NOW - 999 * DAY, NOW)).toBe(false);
    expect(nextDueMs("off", NOW)).toBeNull();
  });

  it("ist fällig, wenn noch nie generiert", () => {
    expect(isDue("monthly", null, NOW)).toBe(true);
  });

  it("ist innerhalb des Intervalls nicht fällig, danach schon", () => {
    expect(isDue("weekly", NOW - 3 * DAY, NOW)).toBe(false);
    expect(isDue("weekly", NOW - 8 * DAY, NOW)).toBe(true);
    expect(isDue("quarterly", NOW - 90 * DAY, NOW)).toBe(false);
    expect(isDue("quarterly", NOW - 92 * DAY, NOW)).toBe(true);
  });

  it("nextDueMs = letzter Lauf + Intervall", () => {
    expect(nextDueMs("monthly", NOW)).toBe(NOW + 30 * DAY);
  });
});
