import { describe, it, expect } from "vitest";
import { vergleichsTicker, istVerzichtbareZweitkotierung, ADR_NAMENSMUSTER, istLseDollarNotiz, titelFehlerBehandlung } from "./screenerLauf";

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

  it("erkennt auch GDR-Namen (Hinterlegungsscheine ausserhalb der USA)", () => {
    expect(ADR_NAMENSMUSTER.test("Samsung Electronics Co Ltd GDR")).toBe(true);
    expect(ADR_NAMENSMUSTER.test("Gazprom PJSC Global Depositary Receipt")).toBe(true);
    expect(ADR_NAMENSMUSTER.test("TCS Group Holding GDS")).toBe(true);
  });

  it("lässt gewöhnliche Firmennamen durch", () => {
    expect(ADR_NAMENSMUSTER.test("Nestlé SA")).toBe(false);
    expect(ADR_NAMENSMUSTER.test("American Express Company")).toBe(false);
    expect(ADR_NAMENSMUSTER.test("Adecco Group AG")).toBe(false);
    expect(ADR_NAMENSMUSTER.test("Roadside Holdings")).toBe(false);
  });
});

describe("istLseDollarNotiz", () => {
  it("erkennt Dollarlinien an der LSE als IOB-GDR (Live-Fund Samsung BC94.L)", () => {
    // Samsung-GDR: Won-Cashflows über Dollar-Marktkapitalisierung ergaben
    // «FCF-Rendite 2605 %», Dividende 19.7 % und ein STRONG BUY.
    expect(istLseDollarNotiz("LSE", "USD")).toBe(true);
    expect(istLseDollarNotiz("L", "usd")).toBe(true);
  });

  it("lässt reguläre Londoner Stammaktien durch (Pence/Pfund, auch USD-Berichtswährung)", () => {
    // Shell & Co. BERICHTEN in Dollar, HANDELN aber in Pence — nur die
    // Handelswährung zählt, sonst flögen echte Hauptkotierungen raus.
    expect(istLseDollarNotiz("LSE", "GBX")).toBe(false);
    expect(istLseDollarNotiz("LSE", "GBP")).toBe(false);
    expect(istLseDollarNotiz("LSE", null)).toBe(false);
    expect(istLseDollarNotiz("US", "USD")).toBe(false);
  });
});

describe("titelFehlerBehandlung", () => {
  it("plant maximal zwei Wiederanläufe für ein Titel-Level-Timeout", () => {
    expect(titelFehlerBehandlung("Zeitüberschreitung (COST, 25s)", 0))
      .toEqual({ status: "wartend", retryCount: 1, fehler: "Wiederanlauf 1/2: Zeitüberschreitung (COST, 25s)" });
    expect(titelFehlerBehandlung("Zeitüberschreitung (COST, 25s)", 1))
      .toEqual({ status: "wartend", retryCount: 2, fehler: "Wiederanlauf 2/2: Zeitüberschreitung (COST, 25s)" });
    expect(titelFehlerBehandlung("Zeitüberschreitung (COST, 25s)", 2))
      .toEqual({ status: "fehler", retryCount: 2, fehler: "Zeitüberschreitung (COST, 25s)" });
  });

  it("markiert nicht-transiente Fehler sofort als endgültigen Fehler", () => {
    expect(titelFehlerBehandlung("keine Fundamentaldaten — keine Säule berechenbar", 0))
      .toEqual({ status: "fehler", retryCount: 0, fehler: "keine Fundamentaldaten — keine Säule berechenbar" });
  });
});
