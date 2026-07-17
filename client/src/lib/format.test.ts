import { describe, expect, it } from "vitest";
import {
  formatCHF,
  formatCurrency,
  formatDate,
  formatMarketCap,
  formatNumber,
  formatPercent,
} from "./format";

// Intl (de-CH) trennt Währung und Betrag mit einem geschützten Leerzeichen (U+00A0).
const NBSP = "\u00A0";

describe("formatCHF", () => {
  it("formatiert mit CHF-Präfix, Apostroph-Tausendertrennzeichen und 2 Dezimalstellen (Default)", () => {
    expect(formatCHF(1234567.891)).toBe(`CHF${NBSP}1'234'567.89`);
  });

  it("respektiert decimals", () => {
    expect(formatCHF(1234.56, { decimals: 0 })).toBe(`CHF${NBSP}1'235`);
  });

  it("G-01: negative Beträge tragen ein echtes Minuszeichen", () => {
    expect(formatCHF(-5000)).toBe("CHF-5'000.00");
    expect(formatCHF(-5000, { decimals: 0 })).toBe("CHF-5'000");
  });

  it("signDisplay 'always' zeigt Plus bei Gewinnen und Minus bei Verlusten", () => {
    expect(formatCHF(5000, { decimals: 0, signDisplay: "always" })).toBe("CHF+5'000");
    expect(formatCHF(-5000, { decimals: 0, signDisplay: "always" })).toBe("CHF-5'000");
  });

  it("fällt bei null/undefined/NaN auf 0 zurück", () => {
    expect(formatCHF(null)).toBe(`CHF${NBSP}0.00`);
    expect(formatCHF(undefined)).toBe(`CHF${NBSP}0.00`);
    expect(formatCHF(NaN)).toBe(`CHF${NBSP}0.00`);
  });
});

describe("formatCurrency", () => {
  it("unterstützt andere Währungen", () => {
    expect(formatCurrency(1234.5, "USD")).toBe(`$${NBSP}1'234.50`);
  });

  it("behält das Minuszeichen auch bei Fremdwährungen", () => {
    expect(formatCurrency(-1234.5, "EUR")).toContain("-1'234.50");
  });
});

describe("formatPercent", () => {
  it("signiert positiv per Default", () => {
    expect(formatPercent(3.456)).toBe("+3.46%");
  });

  it("G-01: negative Werte behalten das Minuszeichen", () => {
    expect(formatPercent(-3.456)).toBe("-3.46%");
    expect(formatPercent(-3.456, { decimals: 1 })).toBe("-3.5%");
  });

  it("signed: false unterdrückt nur das Plus, nie das Minus", () => {
    expect(formatPercent(3.456, { signed: false })).toBe("3.46%");
    expect(formatPercent(-3.456, { signed: false })).toBe("-3.46%");
  });
});

describe("formatNumber", () => {
  it("formatiert de-CH mit Apostroph-Tausendertrennzeichen", () => {
    expect(formatNumber(1234567)).toBe("1'234'567");
    expect(formatNumber(1234.567, { decimals: 2 })).toBe("1'234.57");
  });
});

describe("formatDate", () => {
  it("formatiert dd.mm.yyyy (de-CH)", () => {
    expect(formatDate(new Date(2026, 6, 3))).toBe("03.07.2026");
    expect(formatDate("2026-01-15")).toBe("15.01.2026");
  });
});

describe("formatMarketCap", () => {
  it("skaliert Mrd./Mio./Bio. korrekt (kein rohes «B»-Suffix)", () => {
    expect(formatMarketCap(213905817600, "CHF")).toBe("CHF 213.9 Mrd.");
    expect(formatMarketCap(4_200_000_000_000, "CHF")).toBe("CHF 4.2 Bio.");
    expect(formatMarketCap(750_000_000, "CHF")).toBe("CHF 750.0 Mio.");
    expect(formatMarketCap("213905817600", "USD")).toBe("USD 213.9 Mrd.");
  });
  it("ungültige/leere Werte → «–»", () => {
    expect(formatMarketCap(null)).toBe("–");
    expect(formatMarketCap(0)).toBe("–");
    expect(formatMarketCap("keine zahl")).toBe("–");
  });
});
