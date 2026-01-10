import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

export const portfolioTransactionsRouter = router({
  create: protectedProcedure
    .input((val: unknown) => {
      if (typeof val === "object" && val !== null && "portfolioId" in val && "transactionType" in val) {
        return val as {
          portfolioId: number;
          transactionType: "buy" | "sell" | "dividend" | "deposit" | "withdrawal" | "entry";
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
      console.log('[portfolioTransactions.create] ctx.user:', ctx.user);
      
      // HARD AUTH GUARD: No fallback, fail-fast on missing user
      if (!ctx.user || !ctx.user.id || ctx.user.id === 1) {
        console.error('[portfolioTransactions.create] AUTH GUARD FAILED:', {
          hasUser: !!ctx.user,
          userId: ctx.user?.id,
          userIdType: typeof ctx.user?.id,
        });
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required: ctx.user.id is missing or invalid",
        });
      }
      
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

  listFiltered: protectedProcedure
    .input((val: unknown) => {
      if (typeof val === "object" && val !== null && "portfolioId" in val) {
        return val as {
          portfolioId: number;
          transactionType?: "buy" | "sell" | "dividend" | "deposit" | "withdrawal" | null;
          ticker?: string | null;
          startDate?: string | null;
          endDate?: string | null;
        };
      }
      throw new Error("Invalid filter parameters");
    })
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const { portfolioTransactions } = await import("../../drizzle/schema");
      const { eq, and, gte, lte, desc } = await import("drizzle-orm");
      
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      
      // Build where conditions
      const conditions = [eq(portfolioTransactions.portfolioId, input.portfolioId)];
      
      if (input.transactionType) {
        conditions.push(eq(portfolioTransactions.transactionType, input.transactionType));
      }
      
      if (input.ticker) {
        conditions.push(eq(portfolioTransactions.ticker, input.ticker));
      }
      
      if (input.startDate) {
        conditions.push(gte(portfolioTransactions.transactionDate, new Date(input.startDate)));
      }
      
      if (input.endDate) {
        conditions.push(lte(portfolioTransactions.transactionDate, new Date(input.endDate)));
      }
      
      const transactions = await db
        .select()
        .from(portfolioTransactions)
        .where(and(...conditions))
        .orderBy(desc(portfolioTransactions.transactionDate));
      
      return transactions;
    }),

  exportToCsv: protectedProcedure
    .input((val: unknown) => {
      if (typeof val === "object" && val !== null && "portfolioId" in val && typeof val.portfolioId === "number") {
        return { portfolioId: val.portfolioId };
      }
      throw new Error("Invalid portfolio ID");
    })
    .query(async ({ input, ctx }) => {
      const { getPortfolioTransactions } = await import("../db");
      const transactions = await getPortfolioTransactions(input.portfolioId);
      
      // Build CSV header
      const header = "Datum,Typ,Ticker,Anzahl,Preis/Aktie,Währung,Gesamt (CHF),Gebühren,Notizen";
      
      // Build CSV rows
      const rows = transactions.map(tx => {
        const date = new Date(tx.transactionDate).toISOString().split('T')[0];
        const type = tx.transactionType === 'buy' ? 'Kauf' : 
                     tx.transactionType === 'sell' ? 'Verkauf' : 
                     tx.transactionType === 'dividend' ? 'Dividende' :
                     tx.transactionType === 'deposit' ? 'Einzahlung' : 'Auszahlung';
        const ticker = tx.ticker || '-';
        const shares = tx.shares || '-';
        const pricePerShare = tx.pricePerShare || '-';
        const currency = tx.currency || 'CHF';
        const totalAmountCHF = tx.totalAmountCHF || tx.totalAmount || '0';
        const fees = tx.fees || '0';
        const notes = (tx.notes || '').replace(/,/g, ';').replace(/\n/g, ' ');
        
        return `${date},${type},${ticker},${shares},${pricePerShare},${currency},${totalAmountCHF},${fees},"${notes}"`;
      });
      
      const csv = [header, ...rows].join('\n');
      
      return { csv, filename: `transactions_portfolio_${input.portfolioId}_${new Date().toISOString().split('T')[0]}.csv` };
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
      console.log('[portfolioTransactions.delete] ctx.user:', ctx.user);
      
      // HARD AUTH GUARD: No fallback, fail-fast on missing user
      if (!ctx.user || !ctx.user.id || ctx.user.id === 1) {
        console.error('[portfolioTransactions.delete] AUTH GUARD FAILED:', {
          hasUser: !!ctx.user,
          userId: ctx.user?.id,
          userIdType: typeof ctx.user?.id,
        });
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required: ctx.user.id is missing or invalid",
        });
      }
      
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
      console.log('[portfolioTransactions.update] ctx.user:', ctx.user);
      
      // HARD AUTH GUARD: No fallback, fail-fast on missing user
      if (!ctx.user || !ctx.user.id || ctx.user.id === 1) {
        console.error('[portfolioTransactions.update] AUTH GUARD FAILED:', {
          hasUser: !!ctx.user,
          userId: ctx.user?.id,
          userIdType: typeof ctx.user?.id,
        });
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required: ctx.user.id is missing or invalid",
        });
      }
      
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
        const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
        
        // Calculate CHF amount with FX rate
        if (currency !== 'CHF') {
          const fxRate = await getFxRate(dateStr, `${currency}CHF`);
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
        const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
        
        updates.totalAmount = (shares * price).toFixed(2);
        
        // Get FX rate for the transaction date
        if (currency !== 'CHF') {
          const fxRate = await getFxRate(dateStr, `${currency}CHF`);
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

  importFromCsv: protectedProcedure
    .input((val: unknown) => {
      if (typeof val === "object" && val !== null && "portfolioId" in val && "csvData" in val) {
        return val as {
          portfolioId: number;
          csvData: string;
        };
      }
      throw new Error("Invalid CSV import data");
    })
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("../db");
      const { portfolioTransactions, historicalPrices } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const { getFxRate } = await import("../fxHelper");
      const { getSavedPortfolioById } = await import("../db");
      
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      
      // Verify portfolio exists and belongs to user
      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) {
        throw new Error("Portfolio not found or access denied");
      }
      
      // Parse CSV data
      const lines = input.csvData.trim().split('\n');
      if (lines.length < 2) {
        throw new Error("CSV must contain header and at least one data row");
      }
      
      const header = lines[0].toLowerCase().split(',').map(h => h.trim());
      const requiredFields = ['datum', 'ticker', 'typ', 'anzahl', 'preis'];
      const missingFields = requiredFields.filter(f => !header.includes(f));
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required CSV columns: ${missingFields.join(', ')}. Expected: Datum, Ticker, Typ, Anzahl, Preis, Gebühren (optional)`);
      }
      
      const dateIdx = header.indexOf('datum');
      const tickerIdx = header.indexOf('ticker');
      const typeIdx = header.indexOf('typ');
      const sharesIdx = header.indexOf('anzahl');
      const priceIdx = header.indexOf('preis');
      const feesIdx = header.indexOf('gebühren');
      
      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
      };
      
      // Process each row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        try {
          const cols = line.split(',').map(c => c.trim());
          
          // Parse and validate data
          const dateStr = cols[dateIdx];
          const ticker = cols[tickerIdx]?.toUpperCase();
          const type = cols[typeIdx]?.toLowerCase();
          const shares = parseFloat(cols[sharesIdx]);
          const price = parseFloat(cols[priceIdx]);
          const fees = feesIdx >= 0 && cols[feesIdx] ? parseFloat(cols[feesIdx]) : 0;
          
          // Validate transaction type
          if (!['kauf', 'verkauf', 'buy', 'sell'].includes(type)) {
            throw new Error(`Invalid type '${type}'. Must be 'Kauf', 'Verkauf', 'Buy', or 'Sell'`);
          }
          
          const transactionType = (type === 'kauf' || type === 'buy') ? 'buy' : 'sell';
          
          // Validate numbers
          if (isNaN(shares) || shares <= 0) {
            throw new Error(`Invalid shares: ${cols[sharesIdx]}`);
          }
          if (isNaN(price) || price <= 0) {
            throw new Error(`Invalid price: ${cols[priceIdx]}`);
          }
          
          // Parse date (support multiple formats)
          let transactionDate: Date;
          if (dateStr.includes('.')) {
            // DD.MM.YYYY format
            const [day, month, year] = dateStr.split('.');
            transactionDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
          } else if (dateStr.includes('/')) {
            // MM/DD/YYYY or DD/MM/YYYY
            transactionDate = new Date(dateStr);
          } else {
            // ISO format YYYY-MM-DD
            transactionDate = new Date(dateStr);
          }
          
          if (isNaN(transactionDate.getTime())) {
            throw new Error(`Invalid date: ${dateStr}`);
          }
          
          // Detect currency from ticker
          let currency = 'CHF';
          if (ticker.endsWith('.SW')) {
            currency = 'CHF';
          } else if (!ticker.includes('.')) {
            currency = 'USD';
          }
          
          // Get FX rate for the transaction date
          const dateStrFormatted = transactionDate.toISOString().split('T')[0];
          let fxRate = 1.0;
          if (currency !== 'CHF') {
            fxRate = await getFxRate(dateStrFormatted, `${currency}CHF`);
          }
          
          const totalAmount = shares * price;
          const totalAmountCHF = totalAmount * fxRate;
          
          // Insert transaction
          await db.insert(portfolioTransactions).values({
            portfolioId: input.portfolioId,
            transactionType,
            ticker,
            shares: shares.toString(),
            pricePerShare: price.toString(),
            totalAmount: totalAmount.toFixed(2),
            totalAmountCHF: totalAmountCHF.toFixed(2),
            currency,
            fxRate: fxRate.toFixed(4),
            fees: fees.toFixed(2),
            notes: 'Imported from CSV',
            transactionDate,
          });
          
          results.success++;
          console.log(`[CSV Import] Row ${i}: ${transactionType} ${shares} ${ticker} @ ${price} ${currency} on ${dateStrFormatted}`);
          
        } catch (error) {
          results.failed++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          results.errors.push(`Row ${i}: ${errorMsg}`);
          console.error(`[CSV Import] Error on row ${i}:`, errorMsg);
        }
      }
      
      return results;
    }),
});
