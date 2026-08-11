import { describe, it, expect } from "vitest";
import { tickerAusScreenerCode } from "./universeExpansion";

/**
 * Die Zuordnung EODHD-Code → stocks-Ticker wird jetzt auch vom
 * Watchlist-Screener genutzt. Läuft sie auseinander, landen Kandidaten
 * unter einem Ticker, den weder Kurs-Import noch Signal-Cron kennen.
 */
describe("tickerAusScreenerCode", () => {
  it("hängt das Börsen-Suffix an", () => {
    expect(tickerAusScreenerCode("NESN", "SW")).toBe("NESN.SW");
    expect(tickerAusScreenerCode("SAP", "XETRA")).toBe("SAP.DE");
    expect(tickerAusScreenerCode("MC", "PA")).toBe("MC.PA");
    expect(tickerAusScreenerCode("SHEL", "LSE")).toBe("SHEL.L");
    expect(tickerAusScreenerCode("ASML", "AS")).toBe("ASML.AS");
    expect(tickerAusScreenerCode("ENI", "MI")).toBe("ENI.MI");
  });

  it("lässt US-Ticker ohne Suffix", () => {
    expect(tickerAusScreenerCode("AAPL", "US")).toBe("AAPL");
    expect(tickerAusScreenerCode("nvda", "NASDAQ")).toBe("NVDA");
  });

  it("hängt kein zweites Suffix an, wenn der Code schon eines trägt", () => {
    expect(tickerAusScreenerCode("NESN.SW", "SW")).toBe("NESN.SW");
  });

  it("normalisiert Gross-/Kleinschreibung und Leerraum", () => {
    expect(tickerAusScreenerCode(" nesn ", "sw")).toBe("NESN.SW");
  });
});
