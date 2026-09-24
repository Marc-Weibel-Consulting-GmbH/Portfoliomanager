import { eq, sql } from "drizzle-orm";
import { portfolioTransactions } from "../../drizzle/schema";
import { perfCache } from "../_core/perfCache";
import { getAllStocks, getDb, getSavedPortfolioById, getStockByTicker, insertStock, updateSavedPortfolio } from "../db";
import { tryConvertToCHF } from "../fxHelper";
import { fetchEODHDFundamentals } from "../_core/eodhdApi";
import { resolveManualDemoHoldingShares } from "./manualDemoHoldingShares";
import { invalidatePortfolioMutationCaches } from "./portfolioMutationCache";
import { refreshPortfolioMutationMarketData } from "./portfolioMutationMarketRefresh";
import { rebalanceManualDemoPortfolio, type ManualDemoHolding } from "./manualDemoPortfolioRebalance";
import {
  calculateEquivalentValueSwap,
  selectComparableAlternatives,
  type AlternativeStock,
  type RankedAlternative,
} from "./portfolioAlternatives";
import { findGlobalExactIndustryPeers } from "./globalIndustryPeerSearch";
import { getGlobalPeerDisplayMetrics } from "./globalPeerMetrics";

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const numberOrNull = (value: unknown): number | null => {
  const number = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(number) ? number : null;
};

export type DemoPositionSwapAlternative = RankedAlternative & {
  currentPriceChf: number;
  targetShares: number;
  targetValueChf: number;
  cashResidualChf: number;
};

export type DemoPositionSwapPreview = {
  portfolioId: number;
  source: {
    ticker: string;
    companyName: string;
    currency: string;
    shares: number;
    currentPriceLocal: number;
    currentPriceChf: number;
    valueChf: number;
  };
  alternatives: DemoPositionSwapAlternative[];
  generatedAt: string;
  guardrails: {
    portfolioType: "demo";
    liveTracking: false;
    ledgerEntries: 0;
    exactIndustryOnly: true;
    foreignCurrencyWithFxOnly: true;
    maxAlternatives: 5;
  };
};

type SwapContext = {
  portfolio: Awaited<ReturnType<typeof getSavedPortfolioById>> & {};
  parsed: { stocks?: any[]; cashPercentage?: string | number | null; [key: string]: unknown };
  rawHoldings: any[];
  source: DemoPositionSwapPreview["source"];
  sourceHolding: any;
  sourceCanonical: ManualDemoHolding;
  before: ManualDemoHolding[];
  alternatives: DemoPositionSwapAlternative[];
  alternativeStockByTicker: Map<string, any>;
};

type ReadOnlyScore = {
  quality: number | null;
  valuation: number | null;
  timing: number | null;
  signalScore: number | null;
  signalLabel: string | null;
};

function normalizedTicker(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

async function ensureEligibleDemoPortfolio(portfolioId: number, userId: number) {
  const portfolio = await getSavedPortfolioById(portfolioId, userId);
  if (!portfolio) throw new Error("Portfolio nicht gefunden.");
  if (portfolio.portfolioType !== "demo" || portfolio.isLive) {
    throw new Error("Ein 1:1-Tausch ist nur in einem nicht aktivierten Demoportfolio verfügbar.");
  }
  const db = await getDb();
  if (!db) throw new Error("Datenbank nicht verfügbar.");
  const ledger = await db
    .select({ id: portfolioTransactions.id })
    .from(portfolioTransactions)
    .where(eq(portfolioTransactions.portfolioId, portfolioId))
    .limit(1);
  if (ledger.length > 0) {
    throw new Error("Ein Portfolio mit Ledgerbuchungen muss über den Transaktionen-Tab bearbeitet werden.");
  }
  return portfolio;
}

function parsePortfolioHoldings(portfolioData: string | null): { parsed: SwapContext["parsed"]; holdings: any[] } {
  let parsed: SwapContext["parsed"];
  try {
    parsed = JSON.parse(portfolioData || "{}");
  } catch {
    throw new Error("Portfoliodaten sind ungültig.");
  }
  const holdings = Array.isArray(parsed) ? parsed : parsed.stocks ?? [];
  if (!Array.isArray(holdings) || holdings.length === 0) throw new Error("Das Portfolio enthält keine Positionen.");
  return { parsed, holdings };
}

async function loadScoresReadOnly(tickers: string[]): Promise<Map<string, ReadOnlyScore>> {
  const result = new Map<string, ReadOnlyScore>();
  if (!tickers.length) return result;
  const db = await getDb();
  if (!db) return result;
  try {
    const rowsResult: any = await db.execute(sql`
      SELECT ticker, qualitaet, bewertung, timing, signalScore, signalLabel
      FROM stock_scores
      WHERE ticker IN (${sql.join(tickers.map((ticker) => sql`${ticker}`), sql`, `)})
    `);
    const rows: any[] = Array.isArray(rowsResult) ? (rowsResult[0] ?? rowsResult) : (rowsResult?.rows ?? []);
    for (const row of rows) {
      result.set(String(row.ticker), {
        quality: numberOrNull(row.qualitaet),
        valuation: numberOrNull(row.bewertung),
        timing: numberOrNull(row.timing),
        signalScore: numberOrNull(row.signalScore),
        signalLabel: row.signalLabel ?? null,
      });
    }
  } catch {
    // A missing/temporarily unavailable score table must degrade to an honest
    // data gap; previewing alternatives never creates or migrates tables.
  }
  return result;
}

function toAlternativeStock(
  stock: any,
  scores: Map<string, ReadOnlyScore>,
  overrides: Partial<AlternativeStock> = {},
): AlternativeStock {
  const score = scores.get(stock.ticker);
  return {
    ticker: stock.ticker,
    companyName: stock.companyName,
    sector: stock.sector ?? null,
    industry: stock.industry ?? null,
    category: stock.category ?? null,
    currency: stock.currency ?? null,
    currentPrice: numberOrNull(stock.currentPrice),
    dividendYield: numberOrNull(stock.dividendYield),
    sharpeRatio: numberOrNull(stock.sharpeRatio),
    beta: numberOrNull(stock.beta),
    quality: score?.quality ?? null,
    valuation: score?.valuation ?? null,
    timing: score?.timing ?? null,
    signalScore: score?.signalScore ?? numberOrNull(stock.signalScore),
    signalLabel: score?.signalLabel ?? stock.signalType ?? null,
    dataQualityStatus: stock.dataQualityStatus ?? null,
    isActive: Number(stock.isActive ?? 0) === 1,
    isCantonalBank: /kantonalbank|banque\s+cantonale/i.test(String(stock.companyName ?? "")),
    origin: "local",
    ...overrides,
  };
}

async function persistConfirmedGlobalPeer(input: {
  alternative: AlternativeStock;
  exchangeRateToChf: number;
}): Promise<void> {
  if (input.alternative.origin !== "global") return;
  const existing = await getStockByTicker(input.alternative.ticker);
  if (existing) return;
  await insertStock({
    ticker: input.alternative.ticker,
    companyName: input.alternative.companyName,
    currentPrice: String(input.alternative.currentPrice),
    currency: input.alternative.currency,
    dividendYield: input.alternative.dividendYield == null ? null : String(input.alternative.dividendYield),
    category: "Globaler Branchenpeer",
    sector: input.alternative.sector,
    industry: input.alternative.industry,
    portfolioWeight: "0",
    exchangeRateToChf: String(input.exchangeRateToChf),
    isActive: 1,
    dataQualityStatus: "global_exact_industry",
    dataQualityNotes: "EODHD-Screener: exakte Branche; beim bestätigten Demo-Tausch angelegt.",
    dataQualityUpdatedAt: new Date(),
    lastDataRefresh: new Date(),
  });
}

async function toCanonicalHolding(input: {
  raw: any;
  stock: any;
  investmentAmountChf: number;
  today: string;
}): Promise<ManualDemoHolding> {
  const ticker = normalizedTicker(input.raw.ticker);
  const priceLocal = numberOrNull(input.stock?.currentPrice ?? input.raw.currentPrice);
  const currency = String(input.stock?.currency ?? input.raw.currency ?? "CHF").toUpperCase();
  if (!ticker || !priceLocal || priceLocal <= 0) throw new Error(`Position ${ticker || "?"} hat keinen gültigen Marktpreis.`);
  const priceChf = currency === "CHF" ? priceLocal : await tryConvertToCHF(priceLocal, currency, input.today);
  if (!priceChf || priceChf <= 0) throw new Error(`Position ${ticker} hat keinen gültigen CHF-Wechselkurs.`);
  return {
    ticker,
    shares: resolveManualDemoHoldingShares({
      shares: input.raw.shares,
      weightPct: input.raw.weight,
      capitalBaseChf: input.investmentAmountChf,
      priceLocal,
      exchangeRateToChf: priceChf / priceLocal,
    }),
    priceLocal,
    currency,
    exchangeRateToChf: priceChf / priceLocal,
  };
}

async function loadSwapContext(portfolioId: number, userId: number, sourceTickerInput: string): Promise<SwapContext> {
  const portfolio = await ensureEligibleDemoPortfolio(portfolioId, userId);
  const { parsed, holdings: rawHoldings } = parsePortfolioHoldings(portfolio.portfolioData);
  const sourceTicker = normalizedTicker(sourceTickerInput);
  const sourceHolding = rawHoldings.find((holding) => normalizedTicker(holding.ticker) === sourceTicker);
  if (!sourceHolding) throw new Error("Ausgangsposition nicht im Portfolio gefunden.");

  const allStocks = await getAllStocks();
  const stockByTicker = new Map(allStocks.map((stock) => [normalizedTicker(stock.ticker), stock]));
  const sourceStock = stockByTicker.get(sourceTicker);
  if (!sourceStock) throw new Error(`Für ${sourceTicker} ist keine aktuelle Stammdatenbasis verfügbar.`);

  const today = new Date().toISOString().slice(0, 10);
  const before = await Promise.all(rawHoldings.map(async (raw) => {
    const stock = stockByTicker.get(normalizedTicker(raw.ticker));
    if (!stock) throw new Error(`Für ${normalizedTicker(raw.ticker)} ist keine aktuelle Stammdatenbasis verfügbar.`);
    return toCanonicalHolding({ raw, stock, investmentAmountChf: Number(portfolio.investmentAmount), today });
  }));
  const sourceCanonical = before.find((holding) => holding.ticker === sourceTicker);
  if (!sourceCanonical) throw new Error("Ausgangsposition konnte nicht bewertet werden.");

  const scoreMap = await loadScoresReadOnly(allStocks.map((stock) => stock.ticker));
  // The local universe was historically curated by sector only. Resolve the
  // source's actual EODHD industry for every preview so a missing/stale local
  // `industry` never degrades a logistics company to generic Industrials.
  const sourceFundamentals = await fetchEODHDFundamentals(sourceTicker);
  const sourceAlternative = toAlternativeStock(sourceStock, scoreMap, {
    companyName: sourceStock.companyName,
    sector: sourceFundamentals.sector ?? sourceStock.sector ?? null,
    industry: sourceFundamentals.industry ?? null,
    dividendYield: sourceFundamentals.dividendYield ?? numberOrNull(sourceStock.dividendYield),
  });
  const heldTickers = rawHoldings.map((holding) => normalizedTicker(holding.ticker));
  const knownCompanyNames = [
    ...rawHoldings.map((holding) => String(
      holding.companyName ?? stockByTicker.get(normalizedTicker(holding.ticker))?.companyName ?? "",
    )),
  ];
  const localCandidates = allStocks.map((stock) => toAlternativeStock(stock, scoreMap));
  const globalCandidates = sourceAlternative.industry
    ? await findGlobalExactIndustryPeers({
      industry: sourceAlternative.industry,
      // Existing universe entries are comparison candidates, not exclusions.
      // Only actual portfolio holdings must never be proposed again.
      excludedTickers: heldTickers,
      knownCompanyNames,
      sourceDividendYieldPct: sourceAlternative.dividendYield,
    })
    : [];
  for (const peer of globalCandidates) {
    stockByTicker.set(normalizedTicker(peer.ticker), peer as any);
  }
  const rankedAlternatives = selectComparableAlternatives({
    source: sourceAlternative,
    candidates: [...localCandidates, ...globalCandidates],
    heldTickers,
    heldCompanyNames: knownCompanyNames,
    limit: 5,
  });
  // Global screener candidates have no hourly stock_scores record yet. Enrich
  // only the final shortlist (never the whole remote universe) using their
  // EODHD fundamentals and adjusted-price history. The operation is read-only.
  const globalMetrics = new Map<string, Awaited<ReturnType<typeof getGlobalPeerDisplayMetrics>>>();
  await Promise.all(rankedAlternatives
    .filter((alternative) => alternative.origin === "global")
    .map(async (alternative) => {
      const metrics = await getGlobalPeerDisplayMetrics({
        ticker: alternative.ticker,
        sector: alternative.sector,
        dividendYield: alternative.dividendYield,
      });
      globalMetrics.set(normalizedTicker(alternative.ticker), metrics);
    }));
  const alternatives = rankedAlternatives.map((alternative) => ({
    ...alternative,
    ...(globalMetrics.get(normalizedTicker(alternative.ticker)) ?? {}),
  }));
  for (const alternative of alternatives) {
    if (alternative.origin === "global") {
      stockByTicker.set(normalizedTicker(alternative.ticker), alternative as any);
    }
  }
  const sourceValueChf = sourceCanonical.shares * sourceCanonical.priceLocal * sourceCanonical.exchangeRateToChf;
  const enrichedAlternatives: DemoPositionSwapAlternative[] = [];
  for (const alternative of alternatives) {
    const targetStock = stockByTicker.get(normalizedTicker(alternative.ticker));
    const targetPriceLocal = numberOrNull(targetStock?.currentPrice);
    const targetCurrency = String(targetStock?.currency ?? "").toUpperCase();
    if (!targetStock || !targetPriceLocal || targetPriceLocal <= 0 || !targetCurrency) continue;
    const verifiedPeerFx = numberOrNull((targetStock as unknown as { exchangeRateToChf?: unknown }).exchangeRateToChf);
    const targetPriceChf = verifiedPeerFx && verifiedPeerFx > 0
      ? targetPriceLocal * verifiedPeerFx
      : targetCurrency === "CHF"
        ? targetPriceLocal
        : await tryConvertToCHF(targetPriceLocal, targetCurrency, today);
    if (!targetPriceChf || targetPriceChf <= 0) continue;
    const swap = calculateEquivalentValueSwap({
      sourceShares: sourceCanonical.shares,
      sourcePriceLocal: sourceCanonical.priceLocal,
      sourceExchangeRateToChf: sourceCanonical.exchangeRateToChf,
      targetPriceLocal,
      targetExchangeRateToChf: targetPriceChf / targetPriceLocal,
    });
    enrichedAlternatives.push({
      ...alternative,
      currentPriceChf: targetPriceChf,
      targetShares: swap.targetShares,
      targetValueChf: swap.targetValueChf,
      cashResidualChf: swap.cashResidualChf,
    });
  }

  return {
    portfolio,
    parsed,
    rawHoldings,
    sourceHolding,
    sourceCanonical,
    before,
    source: {
      ticker: sourceCanonical.ticker,
      companyName: sourceStock.companyName,
      currency: sourceCanonical.currency,
      shares: sourceCanonical.shares,
      currentPriceLocal: sourceCanonical.priceLocal,
      currentPriceChf: sourceCanonical.priceLocal * sourceCanonical.exchangeRateToChf,
      valueChf: sourceValueChf,
    },
    alternatives: enrichedAlternatives,
    alternativeStockByTicker: stockByTicker,
  };
}

export async function getDemoPositionSwapPreview(input: {
  portfolioId: number;
  userId: number;
  sourceTicker: string;
}): Promise<DemoPositionSwapPreview> {
  const context = await loadSwapContext(input.portfolioId, input.userId, input.sourceTicker);
  return {
    portfolioId: input.portfolioId,
    source: context.source,
    alternatives: context.alternatives,
    generatedAt: new Date().toISOString(),
    guardrails: {
      portfolioType: "demo",
      liveTracking: false,
      ledgerEntries: 0,
      exactIndustryOnly: true,
      foreignCurrencyWithFxOnly: true,
      maxAlternatives: 5,
    },
  };
}

export async function executeConfirmedDemoPositionSwap(input: {
  portfolioId: number;
  userId: number;
  sourceTicker: string;
  targetTicker: string;
  expectedSourceValueChf: number;
  expectedTargetValueChf: number;
}): Promise<{
  success: true;
  sourceTicker: string;
  targetTicker: string;
  sourceValueChf: number;
  targetValueChf: number;
  targetShares: number;
  cashBalanceChf: number;
  cashResidualChf: number;
  marketDataRefresh: unknown;
  ledgerEntriesCreated: 0;
  liveTrackingChanged: false;
}> {
  const context = await loadSwapContext(input.portfolioId, input.userId, input.sourceTicker);
  const targetTicker = normalizedTicker(input.targetTicker);
  const selected = context.alternatives.find((alternative) => normalizedTicker(alternative.ticker) === targetTicker);
  const targetStock = context.alternativeStockByTicker.get(targetTicker);
  if (!selected || !targetStock) throw new Error("Die gewählte Alternative ist nicht mehr in der aktuellen Vergleichsliste.");
  if (Math.abs(selected.targetValueChf - input.expectedTargetValueChf) > 0.02
    || Math.abs(context.source.valueChf - input.expectedSourceValueChf) > 0.02) {
    throw new Error("Kurs- oder CHF-Wert hat sich geändert. Bitte prüfen Sie die Tauschvorschau erneut.");
  }

  const targetExchangeRateToChf = selected.currentPriceChf / (selected.currentPrice ?? 0);
  if (!(targetExchangeRateToChf > 0)) throw new Error("Für die Alternative fehlt ein gültiger CHF-Wechselkurs.");
  const after: ManualDemoHolding[] = [
    ...context.before.filter((holding) => holding.ticker !== context.source.ticker),
    {
      ticker: targetTicker,
      shares: selected.targetShares,
      priceLocal: selected.currentPrice!,
      currency: String(selected.currency).toUpperCase(),
      exchangeRateToChf: targetExchangeRateToChf,
    },
  ];
  const rebalanced = rebalanceManualDemoPortfolio({
    cashBalanceChf: Number(context.portfolio!.cashBalance ?? 0),
    before: context.before,
    after,
  });
  const afterByTicker = new Map(after.map((holding) => [holding.ticker, holding]));
  const rawByTicker = new Map(context.rawHoldings.map((holding) => [normalizedTicker(holding.ticker), holding]));
  const totalCapital = rebalanced.totalValueAfterChf;
  const nextHoldings = after.map((holding) => {
    const raw = rawByTicker.get(holding.ticker);
    const stock = context.alternativeStockByTicker.get(holding.ticker);
    const currentValueChf = holding.shares * holding.priceLocal * holding.exchangeRateToChf;
    return {
      ...(raw ?? {}),
      ticker: holding.ticker,
      companyName: raw?.companyName ?? stock?.companyName ?? holding.ticker,
      isin: raw?.isin ?? stock?.isin ?? undefined,
      shares: holding.shares.toFixed(6),
      weight: ((currentValueChf / totalCapital) * 100).toFixed(6),
      currentPrice: holding.priceLocal.toString(),
      currency: holding.currency,
      exchangeRateToChf: holding.exchangeRateToChf.toString(),
      totalValue: currentValueChf.toFixed(2),
      // A confirmed demo exchange has no historical trade lot. Do not invent a
      // purchase basis; the UI deliberately shows the basis as unavailable.
      ...(raw ? {} : { avgBuyPrice: undefined, avgBuyPriceCHF: undefined }),
    };
  });
  const nextData = Array.isArray(context.parsed)
    ? nextHoldings
    : {
      ...context.parsed,
      stocks: nextHoldings,
      cashPercentage: ((rebalanced.cashBalanceChf / totalCapital) * 100).toFixed(6),
    };
  const result = await updateSavedPortfolio(input.portfolioId, input.userId, {
    portfolioData: JSON.stringify(nextData),
    cashBalance: rebalanced.cashBalanceChf.toFixed(2),
  });
  if (!result) throw new Error("Portfolio konnte nicht aktualisiert werden.");

  // A global peer is deliberately absent from local watchlist/universe data
  // during preview. It becomes a persisted instrument only after this explicit
  // owner-confirmed demo exchange has successfully updated the portfolio.
  await persistConfirmedGlobalPeer({
    alternative: selected,
    exchangeRateToChf: targetExchangeRateToChf,
  });

  const marketDataRefresh = await refreshPortfolioMutationMarketData([
    { ticker: context.source.ticker, currency: context.source.currency },
    { ticker: targetTicker, currency: String(selected.currency).toUpperCase() },
  ]);
  const { cacheDel } = await import("../redisClient");
  await invalidatePortfolioMutationCaches({
    cacheDel,
    invalidatePerformance: (key) => perfCache.invalidate(key),
    portfolioId: input.portfolioId,
    userId: input.userId,
  });

  return {
    success: true,
    sourceTicker: context.source.ticker,
    targetTicker,
    sourceValueChf: roundMoney(context.source.valueChf),
    targetValueChf: roundMoney(selected.targetValueChf),
    targetShares: selected.targetShares,
    cashBalanceChf: rebalanced.cashBalanceChf,
    cashResidualChf: roundMoney(rebalanced.cashBalanceChf - Number(context.portfolio!.cashBalance ?? 0)),
    marketDataRefresh,
    ledgerEntriesCreated: 0,
    liveTrackingChanged: false,
  };
}
