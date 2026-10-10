import { describe, expect, it } from "vitest";
import { utcDateKey, utcMonthKey } from "./corporateActionAudit";

describe("corporate-action audit calendar keys", () => {
  it("uses UTC month and date keys, independent of local timezone", () => {
    const date = new Date("2026-11-01T00:05:00.000Z");
    expect(utcMonthKey(date)).toBe("2026-11");
    expect(utcDateKey(date)).toBe("2026-11-01");
  });
});
