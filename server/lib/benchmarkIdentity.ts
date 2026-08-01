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
 * Die Lösung ist NICHT, den Benchmark auf Kursrendite zu stellen. Denn die
 * Titelseite kann das gar nicht durchhalten: `historical_prices.close` ist
 * unbereinigt und würde bei einem Aktiensplit im Messfenster einen Sturz von
 * 50 % ausweisen, den es nie gab. Genau deshalb liest die Vorschlags-Messung
 * `COALESCE(adjustedClose, close)` — und `adjustedClose` stammt aus EODHDs
 * `adjusted_close`, das Splits UND Ausschüttungen einrechnet (der Kommentar an
 * der Befüllstelle nennt nur die Splits, das ist ungenau).
 *
 * Richtig ist daher der umgekehrte Weg: BEIDE Seiten auf Gesamtrendite. Der
 * Benchmark bleibt, wo er war; korrigiert gehört die Signal-Messung, die ihre
 * Renditen aus rohen Tageskursen (`stocks.currentPrice` gegen den Snapshot-
 * Kurs) bildet und damit sowohl die Dividenden als auch die Splits verfehlt.
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
    basis: "gesamtrendite",
    hinweis:
      "Der Schlüssel heisst historisch «SMI», die Reihe stammt aber aus dem SPI-ETF CHSPI.SW. " +
      "Der Schlüssel bleibt, weil er ein Datenbank-Enum ist; der Anzeigename nennt den echten Index.",
  },
  SP500: {
    schluessel: "SP500",
    ticker: "SPY.US",
    index: "S&P 500",
    label: "S&P 500",
    basis: "gesamtrendite",
  },
  MSCI_WORLD: {
    schluessel: "MSCI_WORLD",
    ticker: "ACWI.US",
    index: "MSCI ACWI",
    label: "MSCI ACWI (All Country World)",
    basis: "gesamtrendite",
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
 * Rückschreibfenster der Benchmark-Reihen.
 *
 * Bisher wurden nur sieben Tage aufgefrischt. Fällt eine EODHD-Nachbereinigung
 * (Split, Ausschüttung) auf ältere Tage, blieb die Reihe dauerhaft auf dem
 * alten Stand — mit einem Knick genau dort. Es sind drei Reihen; sie über gut
 * drei Jahre neu zu schreiben kostet nichts und hält die Basis über das ganze
 * Fenster einheitlich.
 */
export const BENCHMARK_LOOKBACK_TAGE = 1100; // gut drei Jahre — deckt jedes Messfenster ab
