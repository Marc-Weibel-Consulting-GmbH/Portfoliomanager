import { describe, it, expect } from "vitest";
import { vergleichsTicker, istVerzichtbareZweitkotierung, ADR_NAMENSMUSTER } from "./screenerLauf";

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

  it("sortiert auch ADRs aus, deren Hauptbörse ausserhalb des Universums liegt", () => {
    // Sony-ADR: Hauptkotierung Tokio. Pro Firma zählt nur der Hauptbörsenplatz —
    // liegt der ausserhalb der sieben Börsen, gehört die Firma nicht ins Universum.
    expect(istVerzichtbareZweitkotierung("SONY", "6758.T"))
      .toEqual({ ja: true, hauptboerse: "6758.T" });
  });

  it("behält den Titel bei unbekannter Hauptkotierung", () => {
    expect(istVerzichtbareZweitkotierung("NESN.SW", null)).toEqual({ ja: false });
  });
});

describe("ADR_NAMENSMUSTER", () => {
  it("erkennt ADR-/Zertifikats-Namen", () => {
    expect(ADR_NAMENSMUSTER.test("SK Hynix Inc. American Depositary Shares")).toBe(true);
    expect(ADR_NAMENSMUSTER.test("Kioxia Holdings Corporation ADR")).toBe(true);
    expect(ADR_NAMENSMUSTER.test("Constellation Software Inc. ADR")).toBe(true);
    expect(ADR_NAMENSMUSTER.test("American Express Co DRC")).toBe(true);
    expect(ADR_NAMENSMUSTER.test("Chevron Corp. CEDEAR")).toBe(true);
  });

  it("lässt gewöhnliche Firmennamen durch", () => {
    expect(ADR_NAMENSMUSTER.test("Nestlé SA")).toBe(false);
    expect(ADR_NAMENSMUSTER.test("American Express Company")).toBe(false);
    expect(ADR_NAMENSMUSTER.test("Adecco Group AG")).toBe(false);
    expect(ADR_NAMENSMUSTER.test("Roadside Holdings")).toBe(false);
  });
});
