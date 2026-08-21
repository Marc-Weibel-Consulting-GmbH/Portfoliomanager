import { describe, expect, it } from "vitest";
import { isinDuplikate } from "./emittentenDedup";

describe("ISIN-basierte Emittentenidentität", () => {
  it("markiert eine Kreuznotierung nur bei eindeutigem Primärticker als Zweitnotiz", () => {
    const result = isinDuplikate([
      { ticker: "ALC.SW", isin: "CH0432492467", primaerTicker: "ALC.SW", boerse: "SW" },
      { ticker: "2U3.DE", isin: "CH0432492467", primaerTicker: null, boerse: "XETRA" },
    ]);

    expect(result).toEqual([
      expect.objectContaining({
        ticker: "2U3.DE",
        grund: expect.stringContaining("CH0432492467"),
      }),
    ]);
  });

  it("behält zwei widersprüchlich als primär gemeldete Notierungen zur manuellen Prüfung", () => {
    const result = isinDuplikate([
      { ticker: "AZN", isin: "GB0009895292", primaerTicker: "AZN.US", boerse: "US" },
      { ticker: "AZN.L", isin: "GB0009895292", primaerTicker: "AZN.LSE", boerse: "LSE" },
    ]);

    expect(result).toEqual([]);
  });

  it("führt Einträge ohne ISIN niemals über Namen oder Ticker zusammen", () => {
    const result = isinDuplikate([
      { ticker: "A", isin: null, primaerTicker: "A.US", boerse: "US" },
      { ticker: "A.DE", isin: null, primaerTicker: null, boerse: "XETRA" },
    ]);

    expect(result).toEqual([]);
  });
});
