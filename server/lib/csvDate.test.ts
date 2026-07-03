/**
 * Unit-Tests für lib/csvDate (R-21 — expliziter CSV-Datumsparser).
 */
import { describe, it, expect } from "vitest";
import { parseCsvDate } from "./csvDate";

describe("parseCsvDate — akzeptierte Formate", () => {
  it("ISO YYYY-MM-DD → UTC-Mitternacht", () => {
    expect(parseCsvDate("2026-04-03").toISOString()).toBe("2026-04-03T00:00:00.000Z");
    expect(parseCsvDate("2026-4-3").toISOString()).toBe("2026-04-03T00:00:00.000Z");
  });

  it("Schweizer Format DD.MM.YYYY", () => {
    expect(parseCsvDate("03.04.2026").toISOString()).toBe("2026-04-03T00:00:00.000Z");
    expect(parseCsvDate("3.4.2026").toISOString()).toBe("2026-04-03T00:00:00.000Z");
    expect(parseCsvDate("31.12.2025").toISOString()).toBe("2025-12-31T00:00:00.000Z");
  });

  it("Slash-Format wird IMMER als DD/MM/YYYY gelesen (R-21)", () => {
    // vorher: new Date("03/04/2026") → US-Deutung 4. März; jetzt 3. April.
    expect(parseCsvDate("03/04/2026").toISOString()).toBe("2026-04-03T00:00:00.000Z");
    expect(parseCsvDate("1/2/2025").toISOString()).toBe("2025-02-01T00:00:00.000Z");
  });

  it("trimmt Whitespace", () => {
    expect(parseCsvDate("  2025-03-03 ").toISOString()).toBe("2025-03-03T00:00:00.000Z");
  });
});

describe("parseCsvDate — Ablehnung ungültiger Angaben (deutscher Fehler)", () => {
  it("US-gedeutete Slash-Daten mit «Monat» > 12", () => {
    // 04/25/2026 wäre US-Format (25. April) — als DD/MM ist Monat 25 ungültig.
    expect(() => parseCsvDate("04/25/2026")).toThrow(/Ungültiges Datum "04\/25\/2026"/);
  });

  it("kalendarisch unmögliche Daten", () => {
    expect(() => parseCsvDate("31.02.2025")).toThrow(/Ungültiges Datum/);
    expect(() => parseCsvDate("2025-13-01")).toThrow(/Ungültiges Datum/);
    expect(() => parseCsvDate("0.01.2025")).toThrow(/Ungültiges Datum/);
    expect(() => parseCsvDate("29.02.2025")).toThrow(/Ungültiges Datum/); // kein Schaltjahr
  });

  it("Schaltjahr-Gegenprobe: 29.02.2024 ist gültig", () => {
    expect(parseCsvDate("29.02.2024").toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it("nicht unterstützte Formate", () => {
    expect(() => parseCsvDate("2025/03/03")).toThrow(/unterstützte Formate/);
    expect(() => parseCsvDate("03-04-2026")).toThrow(/unterstützte Formate/);
    expect(() => parseCsvDate("March 3, 2025")).toThrow(/unterstützte Formate/);
    expect(() => parseCsvDate("")).toThrow(/unterstützte Formate/);
  });
});
