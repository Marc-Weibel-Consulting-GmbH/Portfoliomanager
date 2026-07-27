import { describe, it, expect } from "vitest";

/**
 * Titel-Austausch durch den Synthesizer: der Umrechnungskurs muss mit.
 *
 * Der Live-Fall: Roche (RO.SW, CHF 360) ersetzte eine norwegische Position.
 * Ticker, Name, Sektor, Währung und Kurs wurden übernommen — `exchangeRateToChf`
 * nicht. Roche behielt damit den NOK-Satz von ~0.084 und wurde zu CHF 30.25
 * statt 360 eingebucht. Aus 74 Stück wurden 876, aus 5.3 % Zielgewicht 38 %.
 */

type Position = {
  ticker: string;
  currency: string;
  currentPrice: number;
  exchangeRateToChf: number;
  weightPct: number;
};

type Ersatztitel = {
  ticker: string;
  currency: string;
  currentPrice: number;
  exchangeRateToChf: number;
};

/** Austausch wie in autoPortfolioJobs — Kurs UND Umrechnungskurs folgen dem Titel. */
function tausche(alt: Position, neu: Ersatztitel): Position {
  return {
    ...alt,
    ticker: neu.ticker,
    currency: neu.currency,
    currentPrice: neu.currentPrice,
    exchangeRateToChf: neu.exchangeRateToChf,
  };
}

/** Stückzahl wie im Übernahme-Schritt des Wizards. */
function stueckzahl(p: Position, kapital: number): number {
  const wert = (p.weightPct / 100) * kapital;
  const kursCHF = p.currentPrice * p.exchangeRateToChf;
  return kursCHF > 0 ? Math.round(wert / kursCHF) : 0;
}

const NORWEGER: Position = {
  ticker: "AKRBP.OL", currency: "NOK", currentPrice: 250, exchangeRateToChf: 0.084, weightPct: 5.3,
};
const ROCHE: Ersatztitel = {
  ticker: "RO.SW", currency: "CHF", currentPrice: 360, exchangeRateToChf: 1,
};

describe("Titel-Austausch", () => {
  it("übernimmt den Umrechnungskurs des neuen Titels", () => {
    expect(tausche(NORWEGER, ROCHE).exchangeRateToChf).toBe(1);
  });

  it("ergibt die korrekte Stückzahl statt der zwölffachen", () => {
    const getauscht = tausche(NORWEGER, ROCHE);
    // 5.3 % von 500'000 = 26'500 CHF, zu je 360 CHF → 74 Stück.
    expect(stueckzahl(getauscht, 500_000)).toBe(74);
  });

  it("reproduziert den Fehler, wenn der alte Satz haengen bleibt", () => {
    const fehlerhaft: Position = { ...NORWEGER, ticker: "RO.SW", currency: "CHF", currentPrice: 360 };
    expect(fehlerhaft.exchangeRateToChf).toBe(0.084);
    expect(stueckzahl(fehlerhaft, 500_000)).toBe(876); // der Live-Wert
  });

  it("laesst den Fall gleicher Waehrung unveraendert", () => {
    const chfPos: Position = { ...NORWEGER, ticker: "NESN.SW", currency: "CHF", currentPrice: 100, exchangeRateToChf: 1 };
    expect(stueckzahl(tausche(chfPos, ROCHE), 500_000)).toBe(74);
  });

  it("rechnet auch in die andere Richtung korrekt", () => {
    // CHF-Titel wird durch einen USD-Titel ersetzt.
    const usd: Ersatztitel = { ticker: "MO", currency: "USD", currentPrice: 72.99, exchangeRateToChf: 0.8177 };
    const chfPos: Position = { ...NORWEGER, ticker: "NESN.SW", currency: "CHF", currentPrice: 100, exchangeRateToChf: 1, weightPct: 5.4 };
    // 5.4 % von 500'000 = 27'000 CHF, zu je 59.68 CHF → 452 Stück.
    expect(stueckzahl(tausche(chfPos, usd), 500_000)).toBe(452);
  });
});
