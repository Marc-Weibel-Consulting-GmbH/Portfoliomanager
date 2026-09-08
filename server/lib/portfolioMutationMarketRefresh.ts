import { fetchEODHDRealTime } from "../_core/eodhdApi";
import { updateStock } from "../db";
import { importHistoricalPricesForTicker } from "../jobs/importHistoricalPrices";
import { getHistoricalPriceCurrency, isHistoricalPriceSeriesCompatible } from "./eodhdSymbol";

export type PortfolioMutationMarketRefreshAssessment =
  | { ticker: string; status: "eligible" }
  | { ticker: string; status: "data_gap"; reason: string };

export type PortfolioMutationMarketRefreshOutcome =
  | { ticker: string; status: "refreshed" }
  | { ticker: string; status: "data_gap"; reason: string }
  | { ticker: string; status: "unavailable"; reason: string };

export interface PortfolioMutationMarketRefreshTarget {
  ticker: string;
  currency: string;
}

/**
 * Entscheidet ohne Netzwerk- oder Datenbankzugriff, ob ein EODHD-Quote für
 * eine Positionsmutation sicher verwendet werden darf. Bei einem Währungs-
 * wechsel durch eine ADR-/Proxyreihe fehlt ohne dokumentierte Ratio auch die
 * Instrumentbasis. Sie wird niemals per FX-Umrechnung fingiert.
 */
export function assessPortfolioMutationMarketRefresh(
  ticker: string,
  nativeCurrency: string,
): PortfolioMutationMarketRefreshAssessment {
  const normalizedTicker = ticker.trim().toUpperCase();
  const normalizedCurrency = nativeCurrency.trim().toUpperCase() || "CHF";
  const historicalPriceCurrency = getHistoricalPriceCurrency(normalizedTicker, normalizedCurrency);
  if (!isHistoricalPriceSeriesCompatible(normalizedTicker, normalizedCurrency)) {
    return {
      ticker: normalizedTicker,
      status: "data_gap",
      reason: `Historische ${historicalPriceCurrency}-Proxyreihe ist ohne dokumentierte Ratio nicht mit dem nativen ${normalizedCurrency}-Instrument vergleichbar.`,
    };
  }
  return { ticker: normalizedTicker, status: "eligible" };
}

/**
 * Nach einer erfolgreichen manuellen Demo-Mutation werden nur die betroffenen
 * Titel best-effort aktualisiert. Der Aufruf erzeugt weder Buchungen noch
 * Portfolioänderungen. Fehlende Daten überschreiben keine bestehenden Kurse.
 */
export async function refreshPortfolioMutationMarketData(
  targets: PortfolioMutationMarketRefreshTarget[],
): Promise<PortfolioMutationMarketRefreshOutcome[]> {
  const uniqueTargets = new Map<string, string>();
  for (const target of targets) {
    const ticker = String(target.ticker ?? "").trim().toUpperCase();
    if (ticker) uniqueTargets.set(ticker, String(target.currency ?? "CHF"));
  }

  const outcomes: PortfolioMutationMarketRefreshOutcome[] = [];
  for (const [ticker, currency] of uniqueTargets) {
    const assessment = assessPortfolioMutationMarketRefresh(ticker, currency);
    if (assessment.status === "data_gap") {
      await updateStock(ticker, {
        dataQualityStatus: "data_gap",
        dataQualityNotes: assessment.reason,
        dataQualityUpdatedAt: new Date(),
      });
      outcomes.push(assessment);
      continue;
    }

    try {
      const quote = await fetchEODHDRealTime(ticker);
      if (!(quote.close && quote.close > 0)) {
        outcomes.push({ ticker, status: "unavailable", reason: "EODHD lieferte keinen gültigen aktuellen Kurs." });
        continue;
      }
      await updateStock(ticker, {
        currentPrice: quote.close.toString(),
        lastDataRefresh: new Date(),
      });
      // Additiver, nur diesen Titel betreffender Nachlauf. Ein Fehlschlag
      // ersetzt weder den gültigen Realtime-Kurs noch vorhandene Historie.
      await importHistoricalPricesForTicker(ticker);
      outcomes.push({ ticker, status: "refreshed" });
    } catch (error) {
      outcomes.push({
        ticker,
        status: "unavailable",
        reason: error instanceof Error ? error.message : "EODHD-Aktualisierung fehlgeschlagen.",
      });
    }
  }
  return outcomes;
}
