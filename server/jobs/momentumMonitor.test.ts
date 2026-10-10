import { describe, expect, it } from "vitest";
import { hasBlockingDataQualityStatus, isEquityEligible, regionBucket, utcDateKey } from "./momentumMonitor";

describe("Momentum-Monitorjob", () => {
  it("grenzt den ersten Rangvergleich auf Aktien ab und führt ETFs transparent ausgeschlossen", () => {
    expect(isEquityEligible("Wachstumsaktien")).toBe(true);
    expect(isEquityEligible("Dividendenaktien")).toBe(true);
    expect(isEquityEligible("ETF")).toBe(false);
  });

  it("ordnet lokale Referenzen konservativ nur der Schweiz und den USA zu", () => {
    expect(regionBucket("Switzerland")).toBe("Schweiz");
    expect(regionBucket("United States")).toBe("USA");
    expect(regionBucket("Germany")).toBe("Global");
    expect(regionBucket(null)).toBe("Global");
  });

  it("übernimmt bestehende ungeklärte Preisreihen als Datenlücke statt sie neu zu ranken", () => {
    expect(hasBlockingDataQualityStatus("pruefen")).toBe(true);
    expect(hasBlockingDataQualityStatus("datenluecke")).toBe(true);
    expect(hasBlockingDataQualityStatus("geprueft")).toBe(false);
    expect(hasBlockingDataQualityStatus(null)).toBe(false);
  });

  it("bildet den Snapshotstichtag in UTC", () => {
    expect(utcDateKey(new Date("2026-10-10T23:59:59.999Z"))).toBe("2026-10-10");
  });
});
