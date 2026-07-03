import { describe, expect, it } from "vitest";
import { computeAlpha, computeWindowReturn, type DailyClose } from "./benchmarkAlpha";

// Fixture: tägliche SMI-artige Schlusskurse (Werktage, Lücke am Wochenende)
const FIXTURE: DailyClose[] = [
  { date: "2026-06-01", close: "12000" },
  { date: "2026-06-02", close: "12060" },
  { date: "2026-06-03", close: "12120" },
  { date: "2026-06-04", close: "12000" },
  { date: "2026-06-05", close: "12240" }, // Freitag
  { date: "2026-06-08", close: "12300" }, // Montag
  { date: "2026-06-09", close: "12360" },
  { date: "2026-06-15", close: "12600" },
];

describe("computeWindowReturn", () => {
  it("berechnet den Return über ein exaktes Fenster", () => {
    // 12000 → 12600 = +5%
    const r = computeWindowReturn(FIXTURE, "2026-06-01", "2026-06-15");
    expect(r).toBeCloseTo(0.05, 6);
  });

  it("nutzt den letzten Kurs vor dem Startdatum (Wochenende)", () => {
    // Start Samstag 06.06. → Startkurs = Freitag 05.06. (12240); Ende 15.06. (12600)
    const r = computeWindowReturn(FIXTURE, "2026-06-06", "2026-06-15");
    expect(r).toBeCloseTo((12600 - 12240) / 12240, 6);
  });

  it("nutzt den letzten Kurs vor dem Enddatum", () => {
    // Ende Donnerstag 11.06. → Endkurs = 09.06. (12360)
    const r = computeWindowReturn(FIXTURE, "2026-06-01", "2026-06-11");
    expect(r).toBeCloseTo((12360 - 12000) / 12000, 6);
  });

  it("fällt auf den ersten Kurs nach dem Startdatum zurück, wenn davor nichts existiert", () => {
    // Start vor Datenbeginn, aber innerhalb der Toleranz → Startkurs = 01.06.
    const r = computeWindowReturn(FIXTURE, "2026-05-29", "2026-06-15");
    expect(r).toBeCloseTo(0.05, 6);
  });

  it("gibt null zurück, wenn der Startkurs zu weit entfernt ist", () => {
    expect(computeWindowReturn(FIXTURE, "2026-05-01", "2026-06-15")).toBeNull();
  });

  it("gibt null zurück, wenn die Benchmark-Daten stale sind (Endkurs zu alt)", () => {
    // Letzter Kurs 15.06., Ende 30.06. → Lücke > 7 Tage
    expect(computeWindowReturn(FIXTURE, "2026-06-01", "2026-06-30")).toBeNull();
  });

  it("gibt null zurück bei leeren Daten oder invertiertem Fenster", () => {
    expect(computeWindowReturn([], "2026-06-01", "2026-06-15")).toBeNull();
    expect(computeWindowReturn(FIXTURE, "2026-06-15", "2026-06-01")).toBeNull();
  });

  it("ignoriert ungültige Kurse (0, NaN, leere Strings)", () => {
    const rows: DailyClose[] = [
      { date: "2026-06-01", close: "0" },
      { date: "2026-06-02", close: "abc" },
      { date: "2026-06-03", close: "100" },
      { date: "2026-06-10", close: "110" },
    ];
    const r = computeWindowReturn(rows, "2026-06-01", "2026-06-10");
    expect(r).toBeCloseTo(0.1, 6);
  });

  it("verarbeitet numerische close-Werte (historical_prices decimal)", () => {
    const rows: DailyClose[] = [
      { date: "2026-06-01", close: 200 },
      { date: "2026-06-10", close: 190 },
    ];
    const r = computeWindowReturn(rows, "2026-06-01", "2026-06-10");
    expect(r).toBeCloseTo(-0.05, 6);
  });
});

describe("computeAlpha", () => {
  it("berechnet Alpha als Differenz", () => {
    expect(computeAlpha(0.08, 0.05)).toBeCloseTo(0.03, 10);
    expect(computeAlpha(-0.02, 0.01)).toBeCloseTo(-0.03, 10);
  });

  it("gibt null zurück, wenn ein Input fehlt", () => {
    expect(computeAlpha(null, 0.05)).toBeNull();
    expect(computeAlpha(0.05, null)).toBeNull();
    expect(computeAlpha(NaN, 0.05)).toBeNull();
  });
});
