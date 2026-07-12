/**
 * PDF Import Router
 * Handles Swissquote PDF parsing and transaction import
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { parseSwissquotePDF, toPortfolioTransaction, parseSwissquoteDepotauszug } from "../lib/swissquoteParser";

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
        const result = await parseSwissquoteDepotauszug(pdfBuffer);
        return {
          positions: result.positions,
          parseErrors: result.parseErrors,
          pageCount: result.pageCount,
          positionCount: result.positions.length,
          reportDate: result.reportDate,
          accountHolder: result.accountHolder,
          totalValueCHF: result.totalValueCHF,
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

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Verify portfolio belongs to user
      const portfolio = await db.select().from(savedPortfolios).where(eq(savedPortfolios.id, input.portfolioId)).limit(1);
      if (!portfolio.length) throw new TRPCError({ code: "NOT_FOUND", message: "Portfolio not found" });
      if (portfolio[0].userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });

      const txDate = input.reportDate || new Date().toISOString().slice(0, 10);
      const imported: number[] = [];
      const errors: string[] = [];

      for (const pos of input.positions) {
        try {
          // Skip zero-quantity positions
          if (pos.quantity <= 0) continue;

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
            ticker: pos.isin || pos.name.split(" ")[0].toUpperCase(),
            shares: pos.quantity.toString(),
            pricePerShare: pricePerShare > 0 ? pricePerShare.toString() : null,
            currency: pos.assetType === "crypto" ? "CHF" : pos.currency,
            totalAmount: totalAmount.toString(),
            fxRate: fxRate ? fxRate.toString() : null,
            totalAmountCHF: totalAmountCHF.toString(),
            fees: "0",
            transactionDate: new Date(txDate),
            notes: `Swissquote Depotauszug Import - ${pos.name}${pos.isin ? ` (${pos.isin})` : ""}`,
          });
          imported.push(1);
        } catch (err: any) {
          errors.push(`Failed to import ${pos.name}: ${err.message}`);
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
