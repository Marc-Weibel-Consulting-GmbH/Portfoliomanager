import { describe, it, expect } from "vitest";
import { toEodhdSymbol } from "./eodhdSymbol";

describe("toEodhdSymbol", () => {
  it("übersetzt die DB-Suffixe .DE und .L generisch in EODHD-Exchange-Codes", () => {
    // Screener-Befund Lauf #150001: SAP.DE/AZN.L waren bei EODHD 404 —
    // sämtliche XETRA- und LSE-Titel liefen ohne Fundamentaldaten.
    expect(toEodhdSymbol("SAP.DE")).toBe("SAP.XETRA");
    expect(toEodhdSymbol("AZN.L")).toBe("AZN.LSE");
  });

  it("lässt explizite Mappings vorgehen", () => {
    expect(toEodhdSymbol("ROG.SW")).toBe("RO.SW"); // Sonderfall Roche
    expect(toEodhdSymbol("MONC.MI")).toBe("MONRY"); // US-ADR-Umleitung
  });

  it("löst bestätigte internationale Backfill-Symbole auf", () => {
    expect(toEodhdSymbol("8015.T")).toBe("9TO.F");
    expect(toEodhdSymbol("BHP.AX")).toBe("BHP.AU");
    expect(toEodhdSymbol("ENEL.MI")).toBe("ENL.XETRA");
    expect(toEodhdSymbol("SE0007491303.SG")).toBe("BRAV.ST");
    expect(toEodhdSymbol("SNT.WA")).toBe("SNT.WAR");
    expect(toEodhdSymbol("XTB.WA")).toBe("XTB.WAR");
  });

  it("lässt bereits korrekte oder unbekannte Formen unangetastet", () => {
    expect(toEodhdSymbol("AAPL")).toBe("AAPL");
    expect(toEodhdSymbol("AI.PA")).toBe("AI.PA");
    expect(toEodhdSymbol("HEIA.AS")).toBe("HEIA.AS");
    expect(toEodhdSymbol("NESN.SW")).toBe("NESN.SW");
    expect(toEodhdSymbol("")).toBe("");
  });
});
