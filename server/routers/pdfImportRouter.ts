/**
 * PDF Import Router
 * Handles Swissquote PDF parsing and transaction import
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { parseSwissquotePDF, toPortfolioTransaction } from "../lib/swissquoteParser";
import { parseDepotauszugAuto } from "../lib/bankParsers";

export const pdfImportRouter = router({
  /**
   * Parse a Swissquote PDF (provided as base64) and return extracted transactions
   * for user review before importing.
   */
  parseSwissquote: protectedProcedure
    .input(
      z.object({
        pdfBase64: z.string().min(1, "PDF data is required"),
        fileName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Decode base64 to buffer
        const pdfBuffer = Buffer.from(input.pdfBase64, "base64");

        if (pdfBuffer.length > 20 * 1024 * 1024) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "PDF file is too large (max 20MB)",
          });
        }

        const result = await parseSwissquotePDF(pdfBuffer);

        return {
          transactions: result.transactions,
          parseErrors: result.parseErrors,
          pageCount: result.pageCount,
          transactionCount: result.transactions.length,
          fileName: input.fileName || "unknown.pdf",
        };
      } catch (err: any) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to parse PDF: ${err.message}`,
        });
      }
    }),

  /**
   * Parse a Swissquote Depotauszug (portfolio snapshot) PDF and return extracted positions.
   * Detects automatically if the PDF is a Depotauszug (has "Portfolio-Performance") vs. transaction history.
   */
  parseDepotauszug: protectedProcedure
    .input(
      z.object({
        pdfBase64: z.string().min(1, "PDF data is required"),
        fileName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const pdfBuffer = Buffer.from(input.pdfBase64, "base64");
        if (pdfBuffer.length > 20 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "PDF file is too large (max 20MB)" });
        }
        // Multi-bank: detect bank, use deterministic Swissquote parser or
        // generic LLM extraction for all other banks.
        const result = await parseDepotauszugAuto(pdfBuffer);
        return {
          positions: result.positions,
          parseErrors: result.parseErrors,
          pageCount: result.pageCount,
          positionCount: result.positions.length,
          reportDate: result.reportDate,
          accountHolder: result.accountHolder,
          totalValueCHF: result.totalValueCHF,
          bankId: result.bankId,
          bankName: result.bankName,
          parserUsed: result.parserUsed,
          fileName: input.fileName || "unknown.pdf",
        };
      } catch (err: any) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to parse Depotauszug: ${err.message}`,
        });
      }
    }),

  /**
   * Import positions from a Swissquote Depotauszug as "buy" transactions
   * dated at the report date (or today if unknown).
   */
  importPositions: protectedProcedure
    .input(
      z.object({
        portfolioId: z.number().int().positive(),
        reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
        bankName: z.string().optional(),
        positions: z.array(
          z.object({
            name: z.string(),
            isin: z.string().nullable(),
            currency: z.string(),
            quantity: z.number(),
            avgPurchasePrice: z.number().nullable(),
            marketPrice: z.number().nullable(),
            marketValueCHF: z.number().nullable(),
            assetType: z.enum(["stock", "crypto", "cash"]),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("../db");
      const { portfolioTransactions, savedPortfolios } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { tryGetFxRate } = await import("../fxHelper");
      const { resolveIsinToTicker } = await import("../lib/isinResolver");
      const YahooFinanceClass = (await import("yahoo-finance2")).default;
      const yahooFinance: any = new (YahooFinanceClass as any)();
      const yahooSearch = (q: string) => yahooFinance.search(q, { quotesCount: 5, newsCount: 0 }, { validateResult: false });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Verify portfolio belongs to user
      const portfolio = await db.select().from(savedPortfolios).where(eq(savedPortfolios.id, input.portfolioId)).limit(1);
      if (!portfolio.length) throw new TRPCError({ code: "NOT_FOUND", message: "Portfolio not found" });
      if (portfolio[0].userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });

      const txDate = input.reportDate || new Date().toISOString().slice(0, 10);
      const imported: number[] = [];
      const errors: string[] = [];
      const importedStocks: Array<{
        ticker: string;
        name: string;
        currency: string;
        quantity: number;
        avgPurchasePrice: number;
        marketPrice: number | null;
        totalAmountCHF: number;
      }> = [];

      for (const pos of input.positions) {
        try {
          // Skip zero-quantity positions
          if (pos.quantity <= 0) continue;

          // Resolve ISIN to Yahoo ticker for proper portfolio tracking
          let resolvedTicker: string = pos.isin || pos.name.split(" ")[0].toUpperCase();
          if (pos.isin) {
            try {
              const yahooTicker = await resolveIsinToTicker(yahooSearch, pos.isin);
              if (yahooTicker) {
                resolvedTicker = yahooTicker;
                console.log(`[pdfImport] Resolved ISIN ${pos.isin} → ${yahooTicker}`);
              } else {
                console.warn(`[pdfImport] Could not resolve ISIN ${pos.isin}, using ISIN as ticker`);
              }
            } catch (resolveErr) {
              console.warn(`[pdfImport] ISIN resolution failed for ${pos.isin}:`, resolveErr);
            }
          }

          // Use avgPurchasePrice as pricePerShare; fall back to marketPrice
          const pricePerShare = pos.avgPurchasePrice ?? pos.marketPrice ?? 0;
          const totalAmount = pricePerShare * pos.quantity;

          // Convert to CHF
          let totalAmountCHF = totalAmount;
          let fxRate: number | null = null;

          if (pos.currency !== "CHF" && pos.assetType !== "crypto") {
            fxRate = await tryGetFxRate(txDate, `${pos.currency}CHF`);
            if (fxRate) {
              totalAmountCHF = totalAmount * fxRate;
            } else if (pos.marketValueCHF) {
              // Fallback: use market value CHF from the PDF
              totalAmountCHF = pos.marketValueCHF;
            }
          } else if (pos.assetType === "crypto" && pos.marketValueCHF) {
            totalAmountCHF = pos.marketValueCHF;
          }

          await db.insert(portfolioTransactions).values({
            portfolioId: input.portfolioId,
            transactionType: "buy",
            ticker: resolvedTicker,
            shares: pos.quantity.toString(),
            pricePerShare: pricePerShare > 0 ? pricePerShare.toString() : null,
            currency: pos.assetType === "crypto" ? "CHF" : pos.currency,
            totalAmount: totalAmount.toString(),
            fxRate: fxRate ? fxRate.toString() : null,
            totalAmountCHF: totalAmountCHF.toString(),
            fees: "0",
            transactionDate: new Date(txDate),
            notes: `${input.bankName || "PDF"} Depotauszug Import - ${pos.name}${pos.isin ? ` (${pos.isin})` : ""}`,
          });

          // Track resolved ticker for portfolioData update
          imported.push(1);
          importedStocks.push({
            ticker: resolvedTicker,
            name: pos.name,
            currency: pos.assetType === "crypto" ? "CHF" : pos.currency,
            quantity: pos.quantity,
            avgPurchasePrice: pricePerShare,
            marketPrice: pos.marketPrice,
            totalAmountCHF,
          });
        } catch (err: any) {
          errors.push(`Failed to import ${pos.name}: ${err.message}`);
        }
      }

      // Update portfolioData.stocks so positions are visible in the portfolio view
      if (importedStocks.length > 0) {
        try {
          const { fetchCompleteStockData } = await import("../_core/multiApiDataMerger");
          const { insertStock, getStockByTicker } = await import("../db");

          // Calculate total CHF value for weight computation
          const totalCHF = importedStocks.reduce((sum, s) => sum + s.totalAmountCHF, 0);

          // Get existing portfolioData
          const existingData = JSON.parse(portfolio[0].portfolioData || '{"stocks":[]}');
          const existingStocks: any[] = existingData.stocks || [];

          for (const s of importedStocks) {
            // Ensure stock exists in stocks table (for price lookups)
            let stockInDb = await getStockByTicker(s.ticker);
            if (!stockInDb) {
              try {
                const completeData = await fetchCompleteStockData(s.ticker);
                await insertStock({
                  ticker: s.ticker,
                  companyName: completeData.companyName || s.name,
                  currentPrice: completeData.currentPrice?.toString() || s.marketPrice?.toString() || "0",
                  currency: s.currency,
                  dividendYield: completeData.dividendYield?.toString() || "0",
                  peRatio: completeData.pe?.toString() || "0",
                  pegRatio: completeData.peg?.toString() || "0",
                  portfolioWeight: "0",
                  logoUrl: completeData.logoUrl || null,
                  moat1: `Imported from ${input.bankName || "PDF"}`,
                  moat2: "",
                  moat3: "",
                });
                stockInDb = await getStockByTicker(s.ticker);
                console.log(`[pdfImport] Added ${s.ticker} to stocks table`);
              } catch (stockErr) {
                console.warn(`[pdfImport] Could not add ${s.ticker} to stocks table:`, stockErr);
              }
            }

            // Compute avgBuyPrice in CHF for portfolioData
            // avgBuyPrice is stored as CHF per share in portfolioData
            let avgBuyPriceCHF = s.avgPurchasePrice;
            if (s.currency !== "CHF" && s.currency !== "CHF") {
              const fxForAvg = await tryGetFxRate(txDate, `${s.currency}CHF`);
              if (fxForAvg) avgBuyPriceCHF = s.avgPurchasePrice * fxForAvg;
            }

            const weight = totalCHF > 0 ? ((s.totalAmountCHF / totalCHF) * 100).toFixed(2) : "0";

            // Add or update in existingStocks
            const existingIdx = existingStocks.findIndex((e: any) => e.ticker === s.ticker);
            const stockEntry = {
              ticker: s.ticker,
              companyName: stockInDb?.companyName || s.name,
              weight,
              currentPrice: s.marketPrice?.toString() || stockInDb?.currentPrice || "0",
              currency: s.currency,
              avgBuyPrice: avgBuyPriceCHF.toFixed(4),
              shares: s.quantity.toString(),
            };
            if (existingIdx >= 0) {
              existingStocks[existingIdx] = stockEntry;
            } else {
              existingStocks.push(stockEntry);
            }
          }

          // Recalculate weights based on all stocks
          const totalValue = existingStocks.reduce((sum: number, s: any) => {
            const val = parseFloat(s.avgBuyPrice || "0") * parseFloat(s.shares || "0");
            return sum + val;
          }, 0);
          if (totalValue > 0) {
            for (const s of existingStocks) {
              const val = parseFloat(s.avgBuyPrice || "0") * parseFloat(s.shares || "0");
              s.weight = ((val / totalValue) * 100).toFixed(2);
            }
          }

          await db.update(savedPortfolios)
            .set({ portfolioData: JSON.stringify({ ...existingData, stocks: existingStocks }) })
            .where(eq(savedPortfolios.id, input.portfolioId));
          console.log(`[pdfImport] Updated portfolioData.stocks for portfolio ${input.portfolioId}`);
          // Invalidate the Redis cache for this portfolio so the UI sees the updated positions immediately
          try {
            const { cacheDel } = await import('../redisClient');
            await cacheDel(`portfolio:detail:${input.portfolioId}:${ctx.user.id}`);
            console.log(`[pdfImport] Invalidated cache for portfolio ${input.portfolioId}`);
          } catch (cacheErr) {
            // Non-critical
          }
        } catch (pdErr) {
          console.error(`[pdfImport] Failed to update portfolioData:`, pdErr);
          // Non-fatal: transactions were already imported
        }
      }

      return { importedCount: imported.length, errorCount: errors.length, errors, portfolioId: input.portfolioId };
    }),

  /**
   * Import selected parsed transactions into a portfolio.
   * User selects which transactions to import after reviewing the parse result.
   */
  importTransactions: protectedProcedure
    .input(
      z.object({
        portfolioId: z.number().int().positive(),
        transactions: z.array(
          z.object({
            type: z.enum(["buy", "sell", "dividend", "deposit", "withdrawal", "fee", "interest"]),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
            ticker: z.string().nullable(),
            isin: z.string().nullable(),
            securityName: z.string().nullable(),
            shares: z.number().nullable(),
            pricePerShare: z.number().nullable(),
            priceCurrency: z.string().nullable(),
            totalAmount: z.number(),
            totalCurrency: z.string(),
            fxRate: z.number().nullable(),
            fees: z.number(),
            taxes: z.number(),
            notes: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("../db");
      const { portfolioTransactions, savedPortfolios } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Verify portfolio belongs to user
      const portfolio = await db
        .select()
        .from(savedPortfolios)
        .where(eq(savedPortfolios.id, input.portfolioId))
        .limit(1);

      if (!portfolio.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Portfolio not found" });
      }

      if (portfolio[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Import each transaction
      const imported: number[] = [];
      const errors: string[] = [];

      const { tryGetFxRate } = await import("../fxHelper");

      for (const tx of input.transactions) {
        try {
          // Convert total to CHF if needed (R-13: nie unkonvertierte Beträge
          // als CHF persistieren — fehlt der Kurs im PDF, wird er zum
          // Transaktionsdatum nachgeschlagen; gibt es auch dort keinen,
          // wird die Zeile mit Fehler abgelehnt).
          let totalAmountCHF = tx.totalAmount;
          let fxRate = tx.fxRate;
          if (tx.totalCurrency !== "CHF") {
            if (!fxRate) {
              // fxRate is e.g. 0.8912 for USD/CHF
              fxRate = await tryGetFxRate(tx.date, `${tx.totalCurrency}CHF`);
            }
            if (!fxRate) {
              errors.push(
                `${tx.type} vom ${tx.date}${tx.ticker ? ` (${tx.ticker})` : ""}: ` +
                `kein ${tx.totalCurrency}/CHF-Wechselkurs für dieses Datum verfügbar — Zeile nicht importiert`
              );
              continue;
            }
            totalAmountCHF = tx.totalAmount * fxRate;
          }

          // Map import type to schema enum (fee/interest -> entry as fallback)
          const schemaType = (['buy', 'sell', 'dividend', 'deposit', 'withdrawal'] as const).includes(tx.type as any)
            ? tx.type as 'buy' | 'sell' | 'dividend' | 'deposit' | 'withdrawal'
            : 'entry';

          await db.insert(portfolioTransactions).values({
            portfolioId: input.portfolioId,
            transactionType: schemaType,
            ticker: tx.ticker || null,
            shares: tx.shares ? tx.shares.toString() : null,
            pricePerShare: tx.pricePerShare ? tx.pricePerShare.toString() : null,
            currency: tx.priceCurrency || tx.totalCurrency,
            totalAmount: tx.totalAmount.toString(),
            fxRate: fxRate ? fxRate.toString() : null,
            totalAmountCHF: totalAmountCHF.toString(),
            fees: tx.fees.toString(),
            transactionDate: new Date(tx.date),
            notes: tx.notes || `Swissquote Import${tx.securityName ? ` - ${tx.securityName}` : ""}`,
          });

          imported.push(1);
        } catch (err: any) {
          errors.push(`Failed to import ${tx.type} on ${tx.date}: ${err.message}`);
        }
      }

      return {
        importedCount: imported.length,
        errorCount: errors.length,
        errors,
        portfolioId: input.portfolioId,
      };
    }),
});
