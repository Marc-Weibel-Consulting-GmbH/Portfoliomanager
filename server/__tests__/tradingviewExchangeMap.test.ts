/**
 * Boersenzuordnung der Yahoo-Suffixe (tradingview.inferExchangeInfo).
 *
 * Hintergrund: Der Screener «europe» stand hier fuer vier Suffixe, existiert bei
 * TradingView aber nicht (scanner.tradingview.com/europe/scan -> 404), und Xetra
 * war als «XETRA» hinterlegt statt als «XETR» — eine Abfrage darauf liefert null
 * Treffer. Beides blieb unbemerkt, weil der MCP-Server unbekannte Boersen still
 * durch die Krypto-Voreinstellung ersetzte: Aus einer Anfrage fuer NESN.SW wurde
 * «No data found for NESN on KUCOIN».
 *
 * Die hier geprueften Slugs sind gegen scanner.tradingview.com verifiziert.
 */
import { describe, it, expect } from "vitest";
import { inferExchangeInfo } from "../routers/tradingview";

/** Von TradingView unterstuetzte Laender-Screener — es gibt kein «europe». */
const GUELTIGE_SCREENER = new Set([
  "america", "switzerland", "germany", "france", "uk",
  "japan", "hongkong", "turkey", "egypt", "malaysia",
  "australia", "china", "taiwan", "ksa",
]);

describe("inferExchangeInfo", () => {
  it("ordnet Schweizer Titel der SIX zu, nicht einer Krypto-Boerse", () => {
    expect(inferExchangeInfo("NESN.SW")).toEqual({
      exchange: "SIX",
      screener: "switzerland",
      tvSymbol: "NESN",
    });
  });

  it("nutzt fuer Xetra den Praefix XETR", () => {
    // «XETRA» liefert im germany-Screener null Treffer, «XETR» ist der echte Name.
    expect(inferExchangeInfo("SAP.DE").exchange).toBe("XETR");
  });

  it.each([
    ["NESN.SW", "SIX", "switzerland"],
    ["SAP.DE", "XETR", "germany"],
    ["MC.PA", "EURONEXT", "france"],
    ["BATS.L", "LSE", "uk"],
    ["7203.T", "TSE", "japan"],
    ["0700.HK", "HKEX", "hongkong"],
  ])("%s -> %s / %s", (symbol, exchange, screener) => {
    const info = inferExchangeInfo(symbol);
    expect(info.exchange).toBe(exchange);
    expect(info.screener).toBe(screener);
  });

  it("faellt fuer Titel ohne Suffix auf den US-Markt zurueck", () => {
    expect(inferExchangeInfo("NVDA")).toEqual({
      exchange: "NASDAQ",
      screener: "america",
      tvSymbol: "NVDA",
    });
  });

  it("schneidet das Suffix ab — TradingView kennt nur das nackte Kuerzel", () => {
    expect(inferExchangeInfo("NESN.SW").tvSymbol).toBe("NESN");
    expect(inferExchangeInfo("nesn.sw").tvSymbol).toBe("NESN");
  });

  it("verwendet ausschliesslich existierende Screener-Slugs", () => {
    for (const symbol of ["NESN.SW", "SAP.DE", "MC.PA", "BATS.L", "7203.T", "0700.HK", "NVDA"]) {
      expect(GUELTIGE_SCREENER).toContain(inferExchangeInfo(symbol).screener);
    }
  });
});
