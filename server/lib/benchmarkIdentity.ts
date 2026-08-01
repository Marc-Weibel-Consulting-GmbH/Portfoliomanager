/**
 * Identität und Rechenbasis der Vergleichsindizes.
 *
 * Anlass: Zwei unabhängige Etikettenfehler, die sich gegenseitig verdeckten.
 *
 *  1. Der Datenbankschlüssel `SMI` wird aus `CHSPI.SW` gefüllt — dem iShares
 *     Core SPI ETF. Gemessen wurde also nie gegen den SMI, sondern gegen den
 *     SPI. Jede Kennzahl namens «Alpha gegen SMI» trug den falschen Namen.
 *  2. Umgekehrt lief `SSMI.INDX` — der echte SMI — auf der Markt-Seite unter
 *     der Beschriftung «SPI».
 *
 * Schwerer als die Namen wiegt die RECHENBASIS. Der Benchmark wurde mit
 * `adjusted_close` gespeichert, also mit eingerechneten Ausschüttungen
 * (Gesamtrendite). Die Titelseite rechnet dagegen mit reinen Kursen:
 * `stocks.currentPrice` gegen den Snapshot-Kurs, und `historical_prices.close`
 * ist ausdrücklich unbereinigt. Alpha war damit durchgehend
 *
 *      Kursrendite des Titels  −  Gesamtrendite des Marktes
 *
 * also um die Dividendenrendite des Marktes zu tief — bei jedem Titel, jedem
 * Vorschlag, immer in dieselbe Richtung. Für den Schweizer Markt sind das grob
 * 0.25 Prozentpunkte je 30-Tage-Fenster. Ein Fehler, der nie auffällt, weil er
 * nie schwankt.
 *
 * Beide Seiten stehen jetzt auf KURSRENDITE. Das ist der gleichnamige
 * Vergleich: Der Titel bringt seine Dividende nicht in die Messung ein, der
 * Markt seine also auch nicht. Wer später auf Gesamtrendite umstellen will,
 * braucht Ausschüttungsdaten je Titel im Messfenster — dann bitte auf BEIDEN
 * Seiten gleichzeitig.
 */

/** Rechenbasis einer Kursreihe. */
export type Rechenbasis = "kurs" | "gesamtrendite";

export interface BenchmarkIdentitaet {
  /** Schlüssel in `benchmarkData.benchmark` (historisch gewachsen). */
  schluessel: "SMI" | "SP500" | "MSCI_WORLD";
  /** EODHD-Symbol, aus dem die Reihe tatsächlich stammt. */
  ticker: string;
  /** Was der Ticker WIRKLICH abbildet — nicht, wie der Schlüssel heisst. */
  index: string;
  /** Anzeigename. Weicht bewusst vom Schlüssel ab, wo dieser falsch ist. */
  label: string;
  basis: Rechenbasis;
  /** Warum Schlüssel und Index auseinandergehen (leer, wenn sie übereinstimmen). */
  hinweis?: string;
}

export const BENCHMARKS: Record<string, BenchmarkIdentitaet> = {
  SMI: {
    schluessel: "SMI",
    ticker: "CHSPI.SW",
    index: "SPI",
    label: "SPI (Swiss Performance Index)",
    basis: "kurs",
    hinweis:
      "Der Schlüssel heisst historisch «SMI», die Reihe stammt aber aus dem SPI-ETF CHSPI.SW. " +
      "Der Schlüssel bleibt, weil er ein Datenbank-Enum ist; der Anzeigename nennt den echten Index.",
  },
  SP500: {
    schluessel: "SP500",
    ticker: "SPY.US",
    index: "S&P 500",
    label: "S&P 500",
    basis: "kurs",
  },
  MSCI_WORLD: {
    schluessel: "MSCI_WORLD",
    ticker: "ACWI.US",
    index: "MSCI ACWI",
    label: "MSCI ACWI (All Country World)",
    basis: "kurs",
    hinweis:
      "ACWI enthält Schwellenländer, der Name «MSCI World» nicht. Der Anzeigename nennt den echten Index.",
  },
};

/** Anzeigename eines Benchmarks — nie der rohe Schlüssel. */
export function benchmarkLabel(schluessel: string): string {
  return BENCHMARKS[schluessel]?.label ?? schluessel;
}

/** EODHD-Ticker, aus dem die Reihe stammt. */
export function benchmarkTicker(schluessel: string): string | null {
  return BENCHMARKS[schluessel]?.ticker ?? null;
}

/**
 * Welches Preisfeld einer EODHD-Zeile die konfigurierte Basis liefert.
 *
 * `close` ist der unbereinigte Schlusskurs, `adjusted_close` rechnet
 * Ausschüttungen ein. Die Wahl steht hier zentral, damit sie nicht in einem
 * Cron-Skript versteckt getroffen wird.
 */
export function preisFeldFuerBasis(
  zeile: { close: number; adjusted_close?: number },
  basis: Rechenbasis,
): number {
  return basis === "gesamtrendite" ? (zeile.adjusted_close ?? zeile.close) : zeile.close;
}

/**
 * Ab wann die Benchmark-Reihen auf Kursbasis stehen.
 *
 * Ältere Zeilen wurden mit `adjusted_close` geschrieben. Damit nicht zwei Basen
 * in einer Reihe stehen und ein Fenster über die Grenze einen Scheinsprung
 * zeigt, wird die Reihe ab diesem Datum vollständig neu geschrieben (siehe
 * BENCHMARK_LOOKBACK_TAGE in historicalPricesCron).
 */
export const BENCHMARK_LOOKBACK_TAGE = 1100; // gut drei Jahre — deckt jedes Messfenster ab
