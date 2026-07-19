import { router, protectedProcedure } from "../_core/trpc";
import { convertToCHF } from "../fxHelper";
import { z } from "zod";

/**
 * Stückzahlen pro Ticker aus Transaktionen aggregieren: `buy` und `entry`
 * addieren, `sell` subtrahiert — konsistent mit performanceEngine
 * buildHoldingsTimeline (R-31: `entry` wurde bisher ignoriert, wodurch via
 * toggleLive aktivierte Portfolios einen leeren Kalender hatten).
 */
export function aggregateHoldingsFromTransactions(
  transactions: Array<{ ticker: string; transactionType: string; shares?: string | null }>,
  holdings: Record<string, number> = {}
): Record<string, number> {
  for (const tx of transactions) {
    if (!tx.ticker) continue;
    const shares = parseFloat(tx.shares || "0");
    if (!Number.isFinite(shares) || shares === 0) continue;
    if (tx.transactionType === "buy" || tx.transactionType === "entry") {
      holdings[tx.ticker] = (holdings[tx.ticker] || 0) + shares;
    } else if (tx.transactionType === "sell") {
      holdings[tx.ticker] = (holdings[tx.ticker] || 0) - shares;
    }
  }
  return holdings;
}

/**
 * Fallback ohne Transaktionen: Stückzahlen aus den portfolioData-Stocks.
 * Wenn shares=0 aber weight>0 und currentPrice>0 (KI-Portfolio), werden
 * Stückzahlen aus investmentAmount × weight / currentPrice geschätzt.
 * investmentAmount-Parameter: Gesamtinvestition in CHF (default 100'000).
 */
export function aggregateHoldingsFromPortfolioData(
  stocks: any[],
  holdings: Record<string, number> = {},
  investmentAmount: number = 100000
): Record<string, number> {
  for (const stock of stocks) {
    if (!stock?.ticker || stock.ticker === "CASH") continue;
    const shares = parseFloat(stock.shares || stock.quantity || "0") || 0;
    if (shares > 0) {
      holdings[stock.ticker] = (holdings[stock.ticker] || 0) + shares;
    } else {
      // KI-Portfolio: shares=0, schätze aus weight + currentPrice
      const weight = parseFloat(stock.weight || "0") / 100;
      const price = parseFloat(stock.currentPrice || stock.priceCHF || "0");
      if (weight > 0 && price > 0) {
        const estimatedShares = (investmentAmount * weight) / price;
        if (estimatedShares > 0) {
          holdings[stock.ticker] = (holdings[stock.ticker] || 0) + estimatedShares;
        }
      }
    }
  }
  return holdings;
}

/** Dividendenbetrag in CHF via echte FX-Kurse statt hartkodierter 0.88/0.95 (R-31). */
async function dividendAmountCHF(amount: number, currency: string | undefined): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  return convertToCHF(amount, currency || "CHF", today);
}

export const dividendCalendarRouter = router({
  /**
   * Get dividend calendar for a portfolio (upcoming + estimated)
   */
  calendar: protectedProcedure
    .input(z.object({ portfolioId: z.number() }))
    .query(async ({ input, ctx }) => {
      const { getSavedPortfolioById, getPortfolioTransactions } = await import("../db");
      const { getPortfolioDividends } = await import("../dividendCalendar");

      // Get portfolio
      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) {
        throw new Error("Portfolio not found");
      }

      // Parse portfolio data to handle both array and {stocks:[]} format
      const rawData = JSON.parse(portfolio.portfolioData);
      const portfolioData: any[] = Array.isArray(rawData) ? rawData : (rawData.stocks || []);
      const tickers = portfolioData.map((stock: any) => stock.ticker);

      // Get actual holdings from transactions
      const transactions = await getPortfolioTransactions(input.portfolioId);
      const holdings: Record<string, number> = {};

      if (transactions.length > 0) {
        // Use transaction-based holdings (buy/entry +, sell −; R-31)
        aggregateHoldingsFromTransactions(transactions, holdings);
      } else {
        // Fallback: use portfolio data shares (for builder portfolios without transactions)
        const investmentAmt = parseFloat((portfolio as any).investmentAmount || '100000') || 100000;
        aggregateHoldingsFromPortfolioData(portfolioData, holdings, investmentAmt);
      }

      // Fetch upcoming dividends (365 days ahead)
      const dividends = await getPortfolioDividends(tickers, 365);

      // Enrich dividend data with company names and expected income
      const enrichedDividends = (await Promise.all(dividends.map(async div => {
        const stock = portfolioData.find((s: any) =>
          s.ticker.toUpperCase() === div.ticker.toUpperCase()
        );
        const shares = holdings[div.ticker] || holdings[div.ticker.toUpperCase()] || 0;

        // Convert to CHF via echte FX-Kurse (R-31)
        const amountInCHF = await dividendAmountCHF(div.amount, div.currency);
        // FIN-5: fehlender FX-Kurs darf nicht als «CHF 0» erscheinen — flaggen.
        const fxMissing = div.amount > 0 && !(amountInCHF > 0);

        return {
          ticker: div.ticker,
          companyName: stock?.name || stock?.companyName || div.ticker,
          exDate: div.exDividendDate,
          paymentDate: div.paymentDate,
          declarationDate: div.declarationDate,
          dividendPerShare: div.amount,
          currency: div.currency,
          period: div.period,
          type: div.type,
          shares,
          // FIN-5: BRUTTO (vor Verrechnungs-/Quellensteuer) — Kennzeichnung im Client.
          expectedAmount: fxMissing ? null : shares * amountInCHF,
          fxMissing,
        };
      }))).filter(div => div.shares > 0); // Only show dividends for stocks we actually hold

      return enrichedDividends;
    }),

  /**
   * Get all dividends (past + upcoming) for full calendar view
   */
  allDividends: protectedProcedure
    .input(z.object({ portfolioId: z.number() }))
    .query(async ({ input, ctx }) => {
      const { getSavedPortfolioById, getPortfolioTransactions } = await import("../db");
      const { getAllPortfolioDividends } = await import("../dividendCalendar");

      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) {
        throw new Error("Portfolio not found");
      }

      const rawData2 = JSON.parse(portfolio.portfolioData);
      const portfolioData2: any[] = Array.isArray(rawData2) ? rawData2 : (rawData2.stocks || []);
      const tickers = portfolioData2.map((stock: any) => stock.ticker);

      const transactions = await getPortfolioTransactions(input.portfolioId);
      const holdings: Record<string, number> = {};

      if (transactions.length > 0) {
        aggregateHoldingsFromTransactions(transactions, holdings);
      } else {
        // Fallback: use portfolio data shares (for builder portfolios without transactions)
        const investmentAmt2 = parseFloat((portfolio as any).investmentAmount || '100000') || 100000;
        aggregateHoldingsFromPortfolioData(portfolioData2, holdings, investmentAmt2);
      }

      const dividends = await getAllPortfolioDividends(tickers);

      const enrichedDividends = (await Promise.all(dividends.map(async div => {
        const stock = portfolioData2.find((s: any) =>
          s.ticker.toUpperCase() === div.ticker.toUpperCase()
        );
        const shares = holdings[div.ticker] || holdings[div.ticker.toUpperCase()] || 0;

        const amountInCHF = await dividendAmountCHF(div.amount, div.currency);
        const expectedIncome = shares * amountInCHF;

        return {
          ticker: div.ticker,
          companyName: stock?.name || stock?.companyName || div.ticker,
          exDate: div.exDividendDate,
          paymentDate: div.paymentDate,
          declarationDate: div.declarationDate,
          dividendPerShare: div.amount,
          currency: div.currency,
          period: div.period,
          type: div.type,
          shares,
          expectedAmount: expectedIncome,
        };
      }))).filter(div => div.shares > 0);

      return enrichedDividends;
    }),

  /**
   * Get upcoming dividends (backward compatibility)
   */
  getUpcoming: protectedProcedure
    .input(z.object({
      portfolioId: z.number(),
      daysAhead: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { getSavedPortfolioById, getPortfolioTransactions } = await import("../db");
      const { getNextDividendPerTicker } = await import("../dividendCalendar");

      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) {
        throw new Error("Portfolio not found");
      }

      const rawData3 = JSON.parse(portfolio.portfolioData);
      const portfolioData3: any[] = Array.isArray(rawData3) ? rawData3 : (rawData3.stocks || []);

      const transactions = await getPortfolioTransactions(input.portfolioId);
      const holdings: Record<string, number> = {};

      if (transactions.length > 0) {
        aggregateHoldingsFromTransactions(transactions, holdings);
      } else {
        // Fallback: use portfolio data shares (for builder portfolios without transactions)
        const investmentAmt3 = parseFloat((portfolio as any).investmentAmount || '100000') || 100000;
        aggregateHoldingsFromPortfolioData(portfolioData3, holdings, investmentAmt3);
      }

      // Nur Titel abfragen, die wir tatsächlich halten (Stückzahl > 0). So wird die
      // Projektion nicht durch verkaufte/leere Positionen verwässert.
      const tickers = Object.keys(holdings).filter((t) => holdings[t] > 0);

      // Nächste erwartete Dividende JE TITEL (angekündigt bevorzugt, sonst aus Historie
      // projiziert — auch bis 2027). daysAhead wird bewusst ignoriert: die Projektion je
      // Titel darf über 12 Monate hinausgehen, damit jährlich zahlende CH-Titel erscheinen.
      const dividends = await getNextDividendPerTicker(tickers);

      // Fallback: Für Titel ohne EODHD-Daten, dividendYield aus stocks-Tabelle verwenden
      const tickersWithDividend = new Set(dividends.map(d => d.ticker.toUpperCase()));
      const tickersWithoutDividend = tickers.filter(t => !tickersWithDividend.has(t.toUpperCase()));

      if (tickersWithoutDividend.length > 0) {
        const { getDb } = await import("../db");
        const { stocks: stocksTable } = await import("../../drizzle/schema");
        const { inArray } = await import("drizzle-orm");
        const db = await getDb();
        if (db) {
          const stockRows = await db.select({
            ticker: stocksTable.ticker,
            companyName: stocksTable.companyName,
            dividendYield: stocksTable.dividendYield,
            currentPrice: stocksTable.currentPrice,
            currency: stocksTable.currency,
          }).from(stocksTable).where(inArray(stocksTable.ticker, tickersWithoutDividend));

          // Nächster Frühlings-Ex-Termin schätzen (typisch für CH/EU Jahrestitel: März–Mai)
          const today = new Date();
          for (const row of stockRows) {
            const yieldPct = parseFloat(row.dividendYield ?? '0');
            const price = parseFloat(row.currentPrice ?? '0');
            if (yieldPct <= 0 || price <= 0) continue; // Kein Dividendentitel

            const divPerShare = (yieldPct / 100) * price;

            // Nächsten April schätzen (typisch für CH/EU jährliche Zahler)
            let nextApril = new Date(today.getFullYear(), 3, 15); // 15. April
            if (nextApril <= today) nextApril = new Date(today.getFullYear() + 1, 3, 15);
            const nextPayment = new Date(nextApril.getTime() + 14 * 86400000);

            dividends.push({
              ticker: row.ticker,
              exDividendDate: nextApril.toISOString().split('T')[0],
              paymentDate: nextPayment.toISOString().split('T')[0],
              declarationDate: null,
              amount: parseFloat(divPerShare.toFixed(4)),
              currency: row.currency || 'CHF',
              period: 'Annual',
              type: 'estimated',
            });
          }
        }
      }

      // Sortieren nach Ex-Datum
      dividends.sort((a, b) => new Date(a.exDividendDate).getTime() - new Date(b.exDividendDate).getTime());

      const enrichedDividends = (await Promise.all(dividends.map(async div => {
        const stock = portfolioData3.find((s: any) =>
          s.ticker.toUpperCase() === div.ticker.toUpperCase()
        );
        const shares = holdings[div.ticker] || holdings[div.ticker.toUpperCase()] || 0;

        const amountInCHF = await dividendAmountCHF(div.amount, div.currency);
        // FIN-5: fehlender FX-Kurs darf nicht als «CHF 0» erscheinen — flaggen.
        const fxMissing = div.amount > 0 && !(amountInCHF > 0);

        return {
          ticker: div.ticker,
          companyName: stock?.name || stock?.companyName || div.ticker,
          exDividendDate: div.exDividendDate,
          paymentDate: div.paymentDate,
          amount: div.amount,
          currency: div.currency,
          period: div.period,
          type: div.type,
          shares,
          // FIN-5: BRUTTO (vor Verrechnungs-/Quellensteuer) — Kennzeichnung im Client.
          expectedIncome: fxMissing ? null : shares * amountInCHF,
          fxMissing,
        };
      }))).filter(div => div.shares > 0);

      return enrichedDividends;
    }),

  /**
   * Aggregierter Dividenden-Kalender über ALLE Portfolios des Users (Markt-Hub S.17).
   * Liefert die anstehenden Ex-Dividenden der nächsten `daysAhead` Tage (default 30),
   * gemerged über alle eigenen Positionen, sortiert nach Ex-Datum.
   */
  upcomingAll: protectedProcedure
    .input(z.object({ daysAhead: z.number().default(365) }).default({ daysAhead: 365 }))
    .query(async ({ input, ctx }) => {
      const { getSavedPortfolios, getPortfolioTransactions } = await import("../db");
      const { getPortfolioDividends } = await import("../dividendCalendar");

      const portfolios = await getSavedPortfolios(ctx.user.id);
      const holdings: Record<string, number> = {};
      const nameByTicker: Record<string, string> = {};

      for (const p of portfolios) {
        let raw: any;
        try { raw = JSON.parse(p.portfolioData); } catch { continue; }
        const stocks: any[] = Array.isArray(raw) ? raw : (raw.stocks || []);
        stocks.forEach((s: any) => {
          if (s.ticker && s.ticker !== "CASH") nameByTicker[s.ticker] = s.name || s.companyName || s.ticker;
        });
        const txs = await getPortfolioTransactions(p.id);
        if (txs.length > 0) {
          aggregateHoldingsFromTransactions(txs, holdings);
        } else {
          aggregateHoldingsFromPortfolioData(stocks, holdings);
        }
      }

      const tickers = Object.keys(holdings).filter((t) => holdings[t] > 0);
      if (tickers.length === 0) return [];

      const dividends = await getPortfolioDividends(tickers, input.daysAhead);
      const startOfToday = new Date(new Date().toDateString());
      const horizon = new Date(startOfToday.getTime() + input.daysAhead * 86400000);

      return (await Promise.all(dividends
        .map(async (div) => {
          const shares = holdings[div.ticker] || holdings[div.ticker.toUpperCase()] || 0;
          const amountCHF = await dividendAmountCHF(div.amount, div.currency);
          // FIN-5: fehlender FX-Kurs darf nicht als «CHF 0» erscheinen — flaggen.
          const fxMissing = div.amount > 0 && !(amountCHF > 0);
          return {
            ticker: div.ticker,
            companyName: nameByTicker[div.ticker] || nameByTicker[div.ticker.toUpperCase()] || div.ticker,
            exDividendDate: div.exDividendDate,
            paymentDate: div.paymentDate,
            amount: div.amount,
            currency: div.currency,
            period: div.period,
            type: div.type,
            shares,
            // FIN-5: BRUTTO (vor Verrechnungs-/Quellensteuer) — Kennzeichnung im Client.
            expectedIncome: fxMissing ? null : shares * amountCHF,
            fxMissing,
          };
        })))
        .filter((d) => d.shares > 0 && d.exDividendDate && new Date(d.exDividendDate) >= startOfToday && new Date(d.exDividendDate) <= horizon)
        .sort((a, b) => new Date(a.exDividendDate).getTime() - new Date(b.exDividendDate).getTime());
    }),
});
