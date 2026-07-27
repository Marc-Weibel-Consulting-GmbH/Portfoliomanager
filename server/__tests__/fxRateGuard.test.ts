import { describe, it, expect } from "vitest";
import { fxRateForStock } from "../lib/fxRateGuard";

describe("fxRateForStock", () => {
  it("erzwingt 1 fuer Titel in der Referenzwaehrung", () => {
    // Der Live-Fall: die stocks-Tabelle fuehrte fuer CHF-Titel fremde Saetze.
    expect(fxRateForStock("CHF", "0.084")).toBe(1);   // Roche
    expect(fxRateForStock("CHF", "0.065")).toBe(1);   // Julius Baer
    expect(fxRateForStock("chf", 0.0056)).toBe(1);
  });

  it("verhindert die Fehlbewertung, die daraus entstand", () => {
    const kurs = 360;
    expect(kurs * fxRateForStock("CHF", "0.084")).toBe(360);   // vorher 30.24
  });

  it("laesst echte Fremdwaehrungen unveraendert", () => {
    expect(fxRateForStock("USD", "0.8177")).toBeCloseTo(0.8177, 6);
    expect(fxRateForStock("NOK", 0.084)).toBeCloseTo(0.084, 6);
  });

  it("behandelt GBp als eigene Waehrung, nicht als Referenz", () => {
    // Pence sind eine Untereinheit und brauchen sehr wohl eine Umrechnung.
    expect(fxRateForStock("GBp", "0.0106")).toBeCloseTo(0.0106, 6);
  });

  it("faellt auf 1 zurueck, wenn kein brauchbarer Satz vorliegt", () => {
    expect(fxRateForStock("USD", null)).toBe(1);
    expect(fxRateForStock("USD", "0")).toBe(1);
    expect(fxRateForStock("USD", "keine Zahl")).toBe(1);
  });

  it("nimmt die Referenzwaehrung ohne Angabe an", () => {
    expect(fxRateForStock(null, "0.5")).toBe(1);
  });

  it("beachtet eine abweichende Referenzwaehrung", () => {
    expect(fxRateForStock("EUR", "1.05", "EUR")).toBe(1);
    expect(fxRateForStock("CHF", "0.95", "EUR")).toBeCloseTo(0.95, 6);
  });
});
