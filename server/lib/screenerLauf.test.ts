import { describe, it, expect } from "vitest";
import { vergleichsTicker, istVerzichtbareZweitkotierung } from "./screenerLauf";

describe("vergleichsTicker", () => {
  it("behandelt US-Ticker ohne Suffix wie .US", () => {
    expect(vergleichsTicker("NVDA")).toBe("NVDA.US");
    expect(vergleichsTicker("NVDA.US")).toBe("NVDA.US");
  });

  it("gleicht Suffix-Aliasse an (XETRA≙DE, LSE≙L, SWX≙SW)", () => {
    expect(vergleichsTicker("SAP.XETRA")).toBe("SAP.DE");
    expect(vergleichsTicker("SHEL.LSE")).toBe("SHEL.L");
    expect(vergleichsTicker("NESN.SWX")).toBe("NESN.SW");
  });
});

describe("istVerzichtbareZweitkotierung", () => {
  it("sortiert eine Zweitkotierung aus, deren Hauptbörse im Universum liegt", () => {
    // NVIDIA an der SIX — das Original (NVDA, US) gehört ins Universum.
    expect(istVerzichtbareZweitkotierung("NVDA.SW", "NVDA.US"))
      .toEqual({ ja: true, hauptboerse: "NVDA.US" });
  });

  it("behält den Titel, wenn er selbst die Hauptkotierung ist", () => {
    expect(istVerzichtbareZweitkotierung("NESN.SW", "NESN.SW")).toEqual({ ja: false });
    // US-Format ohne Suffix gegen EODHD-Form mit .US
    expect(istVerzichtbareZweitkotierung("AAPL", "AAPL.US")).toEqual({ ja: false });
  });

  it("behält ADRs, deren Hauptbörse AUSSERHALB des Universums liegt", () => {
    // Sony-ADR: Hauptkotierung Tokio — ohne das ADR wäre die Firma gar nicht abbildbar.
    expect(istVerzichtbareZweitkotierung("SONY", "6758.T")).toEqual({ ja: false });
  });

  it("behält den Titel bei unbekannter Hauptkotierung", () => {
    expect(istVerzichtbareZweitkotierung("NESN.SW", null)).toEqual({ ja: false });
  });
});
