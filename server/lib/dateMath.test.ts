/**
 * Unit-Tests für lib/dateMath (R-16/R-17 — Day-Count, Annualisierung, UTC-Stichtage).
 */
import { describe, it, expect } from "vitest";
import {
  daysBetweenUTC,
  yearsBetween,
  annualizeReturn,
  toUTCDateString,
  DAYS_PER_YEAR,
} from "./dateMath";

describe("daysBetweenUTC", () => {
  it("ganze Kalendertage zwischen Datumsstrings", () => {
    expect(daysBetweenUTC("2025-01-01", "2025-01-02")).toBe(1);
    expect(daysBetweenUTC("2025-03-03", "2025-03-07")).toBe(4);
    expect(daysBetweenUTC("2025-01-01", "2026-01-01")).toBe(365);
    expect(daysBetweenUTC("2024-01-01", "2025-01-01")).toBe(366); // Schaltjahr
  });

  it("identische Daten → 0", () => {
    expect(daysBetweenUTC("2025-03-03", "2025-03-03")).toBe(0);
  });

  it("kein Math.abs: umgekehrte Reihenfolge liefert negative Differenz", () => {
    expect(daysBetweenUTC("2025-01-02", "2025-01-01")).toBe(-1);
  });

  it("kein Math.ceil-Off-by-one: Teil-Tage werden abgerundet", () => {
    // 1.5 Tage → 1 (vorher hätte Math.ceil 2 geliefert)
    expect(daysBetweenUTC("2025-01-01T00:00:00Z", "2025-01-02T12:00:00Z")).toBe(1);
    // 2 Stunden über Tagesgrenze → 0 ganze Tage
    expect(daysBetweenUTC("2025-01-01T23:00:00Z", "2025-01-02T01:00:00Z")).toBe(0);
  });

  it("akzeptiert Date-Objekte und Timestamps", () => {
    expect(daysBetweenUTC(new Date("2025-01-01T00:00:00Z"), new Date("2025-01-03T00:00:00Z"))).toBe(2);
    expect(daysBetweenUTC(Date.UTC(2025, 0, 1), Date.UTC(2025, 0, 4))).toBe(3);
  });

  it("wirft bei unparsebarem Datum", () => {
    expect(() => daysBetweenUTC("kein-datum", "2025-01-01")).toThrow(/ungültiges Datum/);
  });
});

describe("yearsBetween", () => {
  it("365.25-Basis", () => {
    expect(DAYS_PER_YEAR).toBe(365.25);
    expect(yearsBetween("2025-01-01", "2026-01-01")).toBeCloseTo(365 / 365.25, 12);
    expect(yearsBetween("2024-01-01", "2028-01-01")).toBeCloseTo(1461 / 365.25, 12); // = 4.0
    expect(yearsBetween("2024-01-01", "2028-01-01")).toBeCloseTo(4, 12);
  });
});

describe("annualizeReturn", () => {
  it("unterjährig: Periodenrendite unverändert (keine Hochrechnung)", () => {
    // Die +2-%-Woche bleibt +2 % — wird NICHT zu +104 % p.a. hochgerechnet.
    expect(annualizeReturn(0.02, 7 / 365.25)).toBe(0.02);
    expect(annualizeReturn(0.1, 364 / 365.25)).toBe(0.1);
    expect(annualizeReturn(0.1, 1)).toBe(0.1); // exakt 1 Jahr: keine Transformation
  });

  it("> 1 Jahr: geometrisch (1+r)^(1/Jahre) − 1", () => {
    expect(annualizeReturn(0.21, 2)).toBeCloseTo(0.1, 12);
    expect(annualizeReturn(0.331, 3)).toBeCloseTo(0.1, 12);
    expect(annualizeReturn(-0.19, 2)).toBeCloseTo(Math.sqrt(0.81) - 1, 12);
  });

  it("Totalverlust wird nicht transformiert (kein NaN)", () => {
    expect(annualizeReturn(-1, 2)).toBe(-1);
    expect(annualizeReturn(-1.5, 2)).toBe(-1.5);
  });

  it("degenerierte Jahre (0/NaN) → Periodenrendite", () => {
    expect(annualizeReturn(0.05, 0)).toBe(0.05);
    expect(annualizeReturn(0.05, NaN)).toBe(0.05);
  });
});

describe("toUTCDateString", () => {
  it("bucketet Timestamps auf den UTC-Kalendertag", () => {
    expect(toUTCDateString("2025-03-03")).toBe("2025-03-03");
    expect(toUTCDateString(new Date("2025-03-03T10:00:00Z"))).toBe("2025-03-03");
    // R-17-Konvention: 00:30 CET (= 23:30Z Vortag) gehört zum UTC-VORTAG.
    expect(toUTCDateString(new Date("2025-03-02T23:30:00Z"))).toBe("2025-03-02");
  });
});
