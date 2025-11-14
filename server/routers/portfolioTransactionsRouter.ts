import { router, protectedProcedure } from "../_core/trpc";

export const portfolioTransactionsRouter = router({
  create: protectedProcedure
    .input((val: unknown) => {
      if (typeof val === "object" && val !== null && "portfolioId" in val && "transactionType" in val) {
        return val as {
          portfolioId: number;
          transactionType: "buy" | "sell" | "dividend" | "deposit" | "withdrawal";
          ticker: string | null;
          shares: string | null;
          pricePerShare: string | null;
          totalAmount: string;
          fees: string;
          notes: string | null;
          transactionDate: string | Date;
        };
      }
      throw new Error("Invalid transaction data");
    })
    .mutation(async ({ input, ctx }) => {
      console.log("[Transaction] Creating transaction:", JSON.stringify(input, null, 2));
      const { createPortfolioTransaction } = await import("../db");
      
      // Normalize transactionDate to Date object
      const transactionDate = typeof input.transactionDate === 'string' 
        ? new Date(input.transactionDate) 
        : input.transactionDate;
      
      const result = await createPortfolioTransaction({
        ...input,
        transactionDate,
        portfolioId: input.portfolioId,
      });
      console.log("[Transaction] Result:", result);
      return result;
    }),

  list: protectedProcedure
    .input((val: unknown) => {
      if (typeof val === "object" && val !== null && "portfolioId" in val && typeof val.portfolioId === "number") {
        return { portfolioId: val.portfolioId };
      }
      throw new Error("Invalid portfolio ID");
    })
    .query(async ({ input }) => {
      const { getPortfolioTransactions } = await import("../db");
      return await getPortfolioTransactions(input.portfolioId);
    }),

  deleteInitialTransactions: protectedProcedure
    .input((val: unknown) => {
      if (typeof val === "object" && val !== null && "portfolioId" in val && typeof val.portfolioId === "number") {
        return { portfolioId: val.portfolioId };
      }
      throw new Error("Invalid portfolio ID");
    })
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("../db");
      const { portfolioTransactions, realizedGains } = await import("../../drizzle/schema");
      const { eq, and, like } = await import("drizzle-orm");
      
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      
      // Find all initial transactions for this portfolio
      const initialTransactions = await db
        .select()
        .from(portfolioTransactions)
        .where(
          and(
            eq(portfolioTransactions.portfolioId, input.portfolioId),
            like(portfolioTransactions.notes, "%Initial position%")
          )
        );
      
      console.log(`[Bulk Delete] Found ${initialTransactions.length} initial transactions to delete`);
      
      // Delete associated realized gains first
      for (const tx of initialTransactions) {
        await db.delete(realizedGains).where(eq(realizedGains.transactionId, tx.id));
      }
      
      // Delete all initial transactions
      const result = await db
        .delete(portfolioTransactions)
        .where(
          and(
            eq(portfolioTransactions.portfolioId, input.portfolioId),
            like(portfolioTransactions.notes, "%Initial position%")
          )
        );
      
      console.log(`[Bulk Delete] Deleted ${initialTransactions.length} initial transactions`);
      
      return { success: true, deletedCount: initialTransactions.length };
    }),

  delete: protectedProcedure
    .input((val: unknown) => {
      if (typeof val === "object" && val !== null && "transactionId" in val && typeof val.transactionId === "number") {
        return { transactionId: val.transactionId };
      }
      throw new Error("Invalid transaction ID");
    })
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("../db");
      const { portfolioTransactions, realizedGains } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      
      // Delete associated realized gains first (if any)
      await db.delete(realizedGains).where(eq(realizedGains.transactionId, input.transactionId));
      
      // Delete the transaction
      await db.delete(portfolioTransactions).where(eq(portfolioTransactions.id, input.transactionId));
      
      return { success: true };
    }),

  update: protectedProcedure
    .input((val: unknown) => {
      if (typeof val === "object" && val !== null && "transactionId" in val) {
        return val as {
          transactionId: number;
          transactionDate?: string;
          shares?: string;
          pricePerShare?: string;
          totalAmount?: string;
          currency?: string;
          fees?: string;
          notes?: string;
        };
      }
      throw new Error("Invalid update data");
    })
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("../db");
      const { portfolioTransactions } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const { getFxRate } = await import("../fxHelper");
      
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      
      // Get current transaction first to check if it's a buy and get ticker
      const [currentTx] = await db.select().from(portfolioTransactions).where(eq(portfolioTransactions.id, input.transactionId)).limit(1);
      if (!currentTx) {
        throw new Error("Transaction not found");
      }
      
      // Build update object
      const updates: any = {};
      
      // If date changed for a buy transaction, fetch historical price
      let shouldUpdatePrice = false;
      if (input.transactionDate && currentTx.transactionType === 'buy') {
        const newDate = new Date(input.transactionDate);
        const oldDate = new Date(currentTx.transactionDate);
        
        // Check if date actually changed
        if (newDate.toISOString().split('T')[0] !== oldDate.toISOString().split('T')[0]) {
          updates.transactionDate = newDate;
          shouldUpdatePrice = true;
          
          // Fetch historical price for the new date
          const { historicalPrices } = await import("../../drizzle/schema");
          const dateStr = newDate.toISOString().split('T')[0];
          
          const [historicalPrice] = await db
            .select()
            .from(historicalPrices)
            .where(
              and(
                eq(historicalPrices.ticker, currentTx.ticker),
                eq(historicalPrices.date, dateStr)
              )
            )
            .limit(1);
          
          if (historicalPrice && historicalPrice.close) {
            // Update price to historical price
            updates.pricePerShare = historicalPrice.close;
            console.log(`[Transaction Update] Updated ${currentTx.ticker} price to historical: ${historicalPrice.close} for date ${dateStr}`);
          } else {
            console.warn(`[Transaction Update] No historical price found for ${currentTx.ticker} on ${dateStr}`);
          }
        }
      } else if (input.transactionDate) {
        updates.transactionDate = new Date(input.transactionDate);
      }
      
      if (input.shares) {
        updates.shares = input.shares;
      }
      
      if (input.pricePerShare) {
        updates.pricePerShare = input.pricePerShare;
      }
      
      if (input.currency) {
        updates.currency = input.currency;
      }
      
      if (input.fees !== undefined) {
        updates.fees = input.fees;
      }
      
      if (input.notes !== undefined) {
        updates.notes = input.notes;
      }
      
      // Handle totalAmount for deposit/withdrawal/dividend
      if (input.totalAmount !== undefined) {
        updates.totalAmount = input.totalAmount;
        
        // Get current transaction for currency and date if not provided
        const [currentTx] = await db.select().from(portfolioTransactions).where(eq(portfolioTransactions.id, input.transactionId)).limit(1);
        const currency = input.currency || currentTx.currency || 'CHF';
        const date = input.transactionDate ? new Date(input.transactionDate) : currentTx.transactionDate;
        
        // Calculate CHF amount with FX rate
        if (currency !== 'CHF') {
          const fxRate = await getFxRate(date, `${currency}CHF`);
          updates.fxRate = fxRate.toFixed(4);
          updates.totalAmountCHF = (parseFloat(input.totalAmount) * fxRate).toFixed(2);
        } else {
          updates.fxRate = '1.0000';
          updates.totalAmountCHF = input.totalAmount;
        }
      }
      // Recalculate totalAmount and FX rate if shares or price changed (buy/sell)
      else if (input.shares || input.pricePerShare || shouldUpdatePrice) {
        
        const shares = parseFloat(input.shares || currentTx.shares || '0');
        const price = parseFloat(input.pricePerShare || updates.pricePerShare || currentTx.pricePerShare || '0');
        const currency = input.currency || currentTx.currency || 'CHF';
        const date = input.transactionDate ? new Date(input.transactionDate) : currentTx.transactionDate;
        
        updates.totalAmount = (shares * price).toFixed(2);
        
        // Get FX rate for the transaction date
        if (currency !== 'CHF') {
          const fxRate = await getFxRate(date, `${currency}CHF`);
          updates.fxRate = fxRate.toFixed(4);
          updates.totalAmountCHF = (shares * price * fxRate).toFixed(2);
        } else {
          updates.fxRate = '1.0000';
          updates.totalAmountCHF = updates.totalAmount;
        }
      }
      
      // Update the transaction
      await db.update(portfolioTransactions)
        .set(updates)
        .where(eq(portfolioTransactions.id, input.transactionId));
      
      return { success: true };
    }),
});
