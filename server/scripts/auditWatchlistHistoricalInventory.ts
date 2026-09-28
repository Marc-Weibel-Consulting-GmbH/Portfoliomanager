import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import {
  exchangeRates,
  historicalPrices,
  nativeHistoricalPrices,
  splitAdjustedHistoricalPrices,
  stocks,
  totalReturnHistoricalPrices,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { getHistoricalPriceCurrency, isHistoricalPriceSeriesCompatible, toEodhdSymbol } from "../lib/eodhdSymbol";
import { resolveVerifiedNativeRiskSource } from "../lib/nativeRiskHistory";

/**
 * Read-only inventory for the curated Watchlist / Empfehlungen universe.
 *
 * It records each series separately instead of treating any provider, listing,
 * quote currency or adjusted series as interchangeable.  The manifest is the
 * input contract for exhaustive source comparison and later remediation; it
 * does not update stocks, prices, scores, portfolios, cash or ledgers.
 */
const AS_OF_DATE = process.env.AUDIT_AS_OF_DATE ?? "2026-09-27";
const OUT_DIR = process.env.AUDIT_OUT_DIR
  ?? "audit_runs/watchlist_historical_2026-09-27";

type GroupRow = {
  ticker: string;
  rows: number;
  firstDate: string | null;
  lastDate: string | null;
  sourceCount?: number;
};

function numberOf(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function main(): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const universe = await db.select({
    id: stocks.id,
    ticker: stocks.ticker,
    companyName: stocks.companyName,
    currency: stocks.currency,
    isin: stocks.isin,
    eodhdTicker: stocks.eodhdTicker,
    primaryTicker: stocks.primaryTicker,
    currentPrice: stocks.currentPrice,
    peRatio: stocks.peRatio,
    pegRatio: stocks.pegRatio,
    dividendYield: stocks.dividendYield,
    dividendYieldBasis: stocks.dividendYieldBasis,
    dividendAnnualAmount: stocks.dividendAnnualAmount,
    dividendCurrency: stocks.dividendCurrency,
    dividendEventCount: stocks.dividendEventCount,
    dividendAsOfDate: stocks.dividendAsOfDate,
    dataQualityStatus: stocks.dataQualityStatus,
    dataQualityNotes: stocks.dataQualityNotes,
    dataQualityUpdatedAt: stocks.dataQualityUpdatedAt,
    lastMetricsUpdate: stocks.lastMetricsUpdate,
    listType: stocks.listType,
    source: stocks.source,
  }).from(stocks).where(isNotNull(stocks.listType)).orderBy(stocks.ticker);

  const tickers = universe.map((row) => row.ticker);
  const history = tickers.length === 0 ? [] : await db
    .select({
      ticker: historicalPrices.ticker,
      rows: sql<number>`COUNT(*)`,
      firstDate: sql<string | null>`MIN(${historicalPrices.date})`,
      lastDate: sql<string | null>`MAX(${historicalPrices.date})`,
      adjustedRows: sql<number>`SUM(CASE WHEN ${historicalPrices.adjustedClose} IS NOT NULL AND ${historicalPrices.adjustedClose} > 0 THEN 1 ELSE 0 END)`,
      distinctSources: sql<number>`COUNT(DISTINCT ${historicalPrices.source})`,
    })
    .from(historicalPrices)
    .where(inArray(historicalPrices.ticker, tickers))
    .groupBy(historicalPrices.ticker);

  const splitSeries = tickers.length === 0 ? [] : await db
    .select({
      ticker: splitAdjustedHistoricalPrices.ticker,
      rows: sql<number>`COUNT(*)`,
      firstDate: sql<string | null>`MIN(${splitAdjustedHistoricalPrices.date})`,
      lastDate: sql<string | null>`MAX(${splitAdjustedHistoricalPrices.date})`,
      sourceCount: sql<number>`COUNT(DISTINCT ${splitAdjustedHistoricalPrices.source})`,
      sourceSymbol: sql<string | null>`MIN(${splitAdjustedHistoricalPrices.sourceSymbol})`,
      currency: sql<string | null>`MIN(${splitAdjustedHistoricalPrices.currency})`,
    })
    .from(splitAdjustedHistoricalPrices)
    .where(inArray(splitAdjustedHistoricalPrices.ticker, tickers))
    .groupBy(splitAdjustedHistoricalPrices.ticker);

  const totalReturnSeries = tickers.length === 0 ? [] : await db
    .select({
      ticker: totalReturnHistoricalPrices.ticker,
      rows: sql<number>`COUNT(*)`,
      firstDate: sql<string | null>`MIN(${totalReturnHistoricalPrices.date})`,
      lastDate: sql<string | null>`MAX(${totalReturnHistoricalPrices.date})`,
      sourceCount: sql<number>`COUNT(DISTINCT ${totalReturnHistoricalPrices.source})`,
      sourceSymbol: sql<string | null>`MIN(${totalReturnHistoricalPrices.sourceSymbol})`,
      currency: sql<string | null>`MIN(${totalReturnHistoricalPrices.currency})`,
    })
    .from(totalReturnHistoricalPrices)
    .where(inArray(totalReturnHistoricalPrices.ticker, tickers))
    .groupBy(totalReturnHistoricalPrices.ticker);

  const nativeSeries = tickers.length === 0 ? [] : await db
    .select({
      ticker: nativeHistoricalPrices.ticker,
      rows: sql<number>`COUNT(*)`,
      firstDate: sql<string | null>`MIN(${nativeHistoricalPrices.date})`,
      lastDate: sql<string | null>`MAX(${nativeHistoricalPrices.date})`,
      sourceCount: sql<number>`COUNT(DISTINCT ${nativeHistoricalPrices.source})`,
      sourceSymbol: sql<string | null>`MIN(${nativeHistoricalPrices.sourceSymbol})`,
      currency: sql<string | null>`MIN(${nativeHistoricalPrices.currency})`,
    })
    .from(nativeHistoricalPrices)
    .where(inArray(nativeHistoricalPrices.ticker, tickers))
    .groupBy(nativeHistoricalPrices.ticker);

  const scoreResult: any = await db.execute(sql`
    SELECT ticker, qualitaet, bewertung, timing, timingAbdeckung, signalScore, signalLabel, berechnetAm
    FROM stock_scores
    WHERE ticker IN (${sql.join(tickers.map((ticker) => sql`${ticker}`), sql`, `)})
  `);
  const scoreRows: any[] = Array.isArray(scoreResult)
    ? (scoreResult[0] ?? scoreResult)
    : (scoreResult?.rows ?? []);

  const currencies = Array.from(new Set(universe.map((row) => getHistoricalPriceCurrency(row.ticker, row.currency ?? "CHF"))));
  // GBp is an LSE quote unit, not an independently stored FX currency.  The
  // valuation helper correctly derives GBpCHF from GBPCHF / 100, so the audit
  // must query the same underlying FX series rather than flagging every LSE
  // title as an artificial missing-FX case.
  const fxCurrencyForQuote = (currency: string) => currency === "GBp" ? "GBP" : currency;
  const fxPairs = Array.from(new Set(currencies
    .filter((currency) => currency !== "CHF")
    .map((currency) => `${fxCurrencyForQuote(currency)}CHF`)));
  const fxCoverage = fxPairs.length === 0 ? [] : await db
    .select({
      currencyPair: exchangeRates.currencyPair,
      rows: sql<number>`COUNT(*)`,
      firstDate: sql<string | null>`MIN(${exchangeRates.date})`,
      lastDate: sql<string | null>`MAX(${exchangeRates.date})`,
    })
    .from(exchangeRates)
    .where(inArray(exchangeRates.currencyPair, fxPairs))
    .groupBy(exchangeRates.currencyPair);

  const toMap = <T extends { ticker: string }>(rows: T[]) => new Map(rows.map((row) => [row.ticker, row]));
  const historyByTicker = toMap(history);
  const splitByTicker = toMap(splitSeries);
  const totalByTicker = toMap(totalReturnSeries);
  const nativeByTicker = toMap(nativeSeries);
  const scoreByTicker = toMap(scoreRows as Array<{ ticker: string }>);

  const assets = universe.map((stock) => {
    const quoteCurrency = getHistoricalPriceCurrency(stock.ticker, stock.currency ?? "CHF");
    const nativeSource = resolveVerifiedNativeRiskSource({
      ticker: stock.ticker,
      nativeCurrency: stock.currency ?? "CHF",
      isin: stock.isin,
    });
    const raw = historyByTicker.get(stock.ticker);
    const split = splitByTicker.get(stock.ticker);
    const total = totalByTicker.get(stock.ticker);
    const native = nativeByTicker.get(stock.ticker);
    const score = scoreByTicker.get(stock.ticker) as Record<string, unknown> | undefined;

    const expectedEodhdSymbol = stock.eodhdTicker || toEodhdSymbol(stock.ticker);
    const issues: string[] = [];
    if (!raw || numberOf(raw.rows) === 0) issues.push("keine rohe EODHD/DB-Kursreihe");
    if (raw && raw.firstDate && raw.firstDate > "2021-09-27") issues.push(`Rohhistorie beginnt erst ${raw.firstDate}`);
    if (!isHistoricalPriceSeriesCompatible(stock.ticker, stock.currency ?? "CHF") && !nativeSource) {
      issues.push("keine verifizierte native Preisreihe für abweichende Handelslinie");
    }
    if (!split || numberOf(split.rows) === 0) issues.push("keine getrennte splitbereinigte Preisreihe");
    if (!total || numberOf(total.rows) === 0) issues.push("keine getrennte Brutto-Gesamtrenditereihe");
    if (score?.timing == null) issues.push("kein Timing-Score gespeichert");
    if (score?.qualitaet == null || score?.bewertung == null) issues.push("unvollständiger Qualitäts-/Bewertungsscore");
    const fxPair = `${fxCurrencyForQuote(quoteCurrency)}CHF`;
    if ((stock.currency ?? "CHF") !== "CHF" && !fxCoverage.some((fx) => fx.currencyPair === fxPair)) {
      issues.push(`keine FX-Reihe ${fxPair}`);
    }

    return {
      ticker: stock.ticker,
      companyName: stock.companyName,
      isin: stock.isin,
      listType: stock.listType,
      source: stock.source,
      nativeCurrency: stock.currency,
      quoteCurrency,
      expectedEodhdSymbol,
      primaryTicker: stock.primaryTicker,
      nativeRiskFallback: nativeSource,
      master: {
        currentPrice: stock.currentPrice,
        peRatio: stock.peRatio,
        pegRatio: stock.pegRatio,
        dividendYield: stock.dividendYield,
        dividendYieldBasis: stock.dividendYieldBasis,
        dividendAnnualAmount: stock.dividendAnnualAmount,
        dividendCurrency: stock.dividendCurrency,
        dividendEventCount: stock.dividendEventCount,
        dividendAsOfDate: stock.dividendAsOfDate,
        lastMetricsUpdate: stock.lastMetricsUpdate,
        dataQualityStatus: stock.dataQualityStatus,
        dataQualityNotes: stock.dataQualityNotes,
        dataQualityUpdatedAt: stock.dataQualityUpdatedAt,
      },
      rawPriceSeries: raw ? {
        rows: numberOf(raw.rows), firstDate: raw.firstDate, lastDate: raw.lastDate,
        adjustedRows: numberOf(raw.adjustedRows), distinctSources: numberOf(raw.distinctSources),
      } : null,
      splitAdjustedSeries: split ? {
        rows: numberOf(split.rows), firstDate: split.firstDate, lastDate: split.lastDate,
        sourceCount: numberOf(split.sourceCount), sourceSymbol: split.sourceSymbol, currency: split.currency,
      } : null,
      totalReturnSeries: total ? {
        rows: numberOf(total.rows), firstDate: total.firstDate, lastDate: total.lastDate,
        sourceCount: numberOf(total.sourceCount), sourceSymbol: total.sourceSymbol, currency: total.currency,
      } : null,
      nativeSeries: native ? {
        rows: numberOf(native.rows), firstDate: native.firstDate, lastDate: native.lastDate,
        sourceCount: numberOf(native.sourceCount), sourceSymbol: native.sourceSymbol, currency: native.currency,
      } : null,
      score: score ?? null,
      auditIssues: issues,
    };
  });

  const summary = {
    asOfDate: AS_OF_DATE,
    universeSize: assets.length,
    rawRows: assets.reduce((total, asset) => total + (asset.rawPriceSeries?.rows ?? 0), 0),
    splitAdjustedRows: assets.reduce((total, asset) => total + (asset.splitAdjustedSeries?.rows ?? 0), 0),
    totalReturnRows: assets.reduce((total, asset) => total + (asset.totalReturnSeries?.rows ?? 0), 0),
    assetsWithIssues: assets.filter((asset) => asset.auditIssues.length > 0).length,
    issueCounts: assets.flatMap((asset) => asset.auditIssues)
      .reduce<Record<string, number>>((acc, issue) => ({ ...acc, [issue]: (acc[issue] ?? 0) + 1 }), {}),
    fxCoverage: fxCoverage.map((row) => ({
      currencyPair: row.currencyPair,
      rows: numberOf(row.rows),
      firstDate: row.firstDate,
      lastDate: row.lastDate,
    })),
  };

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, `watchlist_historical_inventory_${AS_OF_DATE}.json`);
  await writeFile(outPath, JSON.stringify({ summary, assets }, null, 2));
  console.log(JSON.stringify({ outPath, summary }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
