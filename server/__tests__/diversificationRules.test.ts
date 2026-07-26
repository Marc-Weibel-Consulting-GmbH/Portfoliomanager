import { describe, it, expect } from "vitest";
import { DEFAULT_DIVERSIFICATION_RULES, isSleeveTicker } from "../../shared/diversificationRules";
import { SLEEVE_TICKER_LABEL } from "../../shared/const";

describe("isSleeveTicker", () => {
  it("erkennt die Multi-Asset-Bausteine aus dem Live-Portfolio", () => {
    // Genau die Titel, die als «Klumpenrisiko» bzw. «Kleinstposition» gerügt
    // wurden, obwohl ihr Gewicht aus dem Anlegerprofil stammt.
    expect(isSleeveTicker("ZGLD.SW", SLEEVE_TICKER_LABEL)).toBe(true);   // Gold 8.3 %
    expect(isSleeveTicker("REET", SLEEVE_TICKER_LABEL)).toBe(true);      // Immobilien 5.8 %
    expect(isSleeveTicker("CSBGC0.SW", SLEEVE_TICKER_LABEL)).toBe(true); // Obligationen 0.3 %
    expect(isSleeveTicker("ASOL.SW", SLEEVE_TICKER_LABEL)).toBe(true);   // Krypto
  });

  it("lässt Aktien unangetastet", () => {
    for (const t of ["LOGN.SW", "BTI", "HOLN.SW", "GIVN.SW", "NOVN.SW", "BATS.L"]) {
      expect(isSleeveTicker(t, SLEEVE_TICKER_LABEL)).toBe(false);
    }
  });

  it("ist unabhängig von der Schreibweise", () => {
    expect(isSleeveTicker("zgld.sw", SLEEVE_TICKER_LABEL)).toBe(true);
  });

  it("ist robust gegen leere Werte", () => {
    expect(isSleeveTicker(null, SLEEVE_TICKER_LABEL)).toBe(false);
    expect(isSleeveTicker(undefined, SLEEVE_TICKER_LABEL)).toBe(false);
    expect(isSleeveTicker("", SLEEVE_TICKER_LABEL)).toBe(false);
  });
});

describe("Bandbreite aus Soll-Quote und Toleranz", () => {
  // Spiegelt die Rechnung in checkDiversificationRules: [soll − tol, soll + tol],
  // nach unten bei 0 gekappt.
  const band = (soll: number, tol: number) => ({
    min: Math.max(0, soll - tol),
    max: soll + tol,
  });

  it("ergibt die erwarteten Bänder für «ausgewogen» bei ±3", () => {
    const tol = DEFAULT_DIVERSIFICATION_RULES.assetClassTolerancePct;
    expect(tol).toBe(3);
    expect(band(7, tol)).toEqual({ min: 4, max: 10 });    // Gold
    expect(band(3, tol)).toEqual({ min: 0, max: 6 });     // Krypto
    expect(band(25, tol)).toEqual({ min: 22, max: 28 });  // Obligationen
    expect(band(4, tol)).toEqual({ min: 1, max: 7 });     // Rohstoffe
  });

  it("kappt die Untergrenze bei 0 statt negativ zu werden", () => {
    // Krypto ist im konservativen Profil mit 0 % vorgesehen.
    expect(band(0, 3)).toEqual({ min: 0, max: 3 });
  });

  it("beurteilt die Ist-Quoten aus dem Live-Portfolio korrekt", () => {
    const gold = band(7, 3);
    expect(8.3 >= gold.min && 8.3 <= gold.max).toBe(true);   // vorher als Klumpenrisiko gerügt
    const obli = band(25, 3);
    expect(0.3 >= obli.min && 0.3 <= obli.max).toBe(false);  // echte Unterdeckung
  });
});
