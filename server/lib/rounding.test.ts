/**
 * Unit-Tests für lib/rounding (R-22 — Schweizer Rappenrundung).
 */
import { describe, it, expect } from "vitest";
import { roundRappen, roundCHF } from "./rounding";

describe("roundRappen (0.05 CHF)", () => {
  it("rundet kaufmännisch auf 5 Rappen", () => {
    expect(roundRappen(10.02)).toBe(10.0);
    expect(roundRappen(10.024)).toBe(10.0);
    expect(roundRappen(10.025)).toBe(10.05);
    expect(roundRappen(10.07)).toBe(10.05);
    expect(roundRappen(10.08)).toBe(10.1);
    expect(roundRappen(10.125)).toBe(10.15);
  });

  it("lässt bereits gerundete Beträge unverändert", () => {
    expect(roundRappen(0)).toBe(0);
    expect(roundRappen(100)).toBe(100);
    expect(roundRappen(99.95)).toBe(99.95);
    expect(roundRappen(0.05)).toBe(0.05);
  });

  it("negative Beträge (z. B. negativ gespeicherte Entnahmen)", () => {
    expect(roundRappen(-10.02)).toBe(-10.0);
    expect(roundRappen(-10.08)).toBe(-10.1);
  });
});

describe("roundCHF", () => {
  it("Default: 2 Nachkommastellen", () => {
    expect(roundCHF(10.024)).toBe(10.02);
    expect(roundCHF(10.025)).toBe(10.03);
    expect(roundCHF(-10.004)).toBe(-10.0);
  });

  it("konfigurierbare Stellen", () => {
    expect(roundCHF(1.23456, 4)).toBe(1.2346);
    expect(roundCHF(1.23456, 0)).toBe(1);
  });
});
