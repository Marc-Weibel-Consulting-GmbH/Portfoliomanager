import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";

export const priceAlertsRouter = router({
  // List all alerts for the current user
  list: protectedProcedure.query(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const { priceAlerts } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    const alerts = await db
      .select()
      .from(priceAlerts)
      .where(eq(priceAlerts.userId, ctx.user.id));

    return alerts;
  }),

  // Create a new price alert
  create: protectedProcedure
    .input((val: unknown) => {
      if (
        typeof val === "object" &&
        val !== null &&
        "ticker" in val &&
        "alertType" in val
      ) {
        return val as {
          ticker: string;
          alertType: "above_price" | "below_price" | "percent_change";
          targetPrice?: string;
          percentChange?: string;
        };
      }
      throw new Error("Invalid alert data");
    })
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("../db");
      const { priceAlerts } = await import("../../drizzle/schema");

      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Validate input based on alert type
      if (
        (input.alertType === "above_price" || input.alertType === "below_price") &&
        !input.targetPrice
      ) {
        throw new Error("Target price is required for price alerts");
      }

      if (input.alertType === "percent_change" && !input.percentChange) {
        throw new Error("Percent change is required for percent change alerts");
      }

      await db.insert(priceAlerts).values({
        userId: ctx.user.id,
        ticker: input.ticker.toUpperCase(),
        alertType: input.alertType,
        targetPrice: input.targetPrice || null,
        percentChange: input.percentChange || null,
        isActive: 1,
      });

      return { success: true };
    }),

  // Update alert (toggle active status or change values)
  update: protectedProcedure
    .input((val: unknown) => {
      if (typeof val === "object" && val !== null && "id" in val) {
        return val as {
          id: number;
          isActive?: number;
          targetPrice?: string;
          percentChange?: string;
        };
      }
      throw new Error("Invalid update data");
    })
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("../db");
      const { priceAlerts } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const updates: any = {};
      if (input.isActive !== undefined) {
        updates.isActive = input.isActive;
      }
      if (input.targetPrice !== undefined) {
        updates.targetPrice = input.targetPrice;
      }
      if (input.percentChange !== undefined) {
        updates.percentChange = input.percentChange;
      }

      await db
        .update(priceAlerts)
        .set(updates)
        .where(
          and(eq(priceAlerts.id, input.id), eq(priceAlerts.userId, ctx.user.id))
        );

      return { success: true };
    }),

  // Delete an alert
  delete: protectedProcedure
    .input((val: unknown) => {
      if (typeof val === "object" && val !== null && "id" in val && typeof val.id === "number") {
        return { id: val.id };
      }
      throw new Error("Invalid alert ID");
    })
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("../db");
      const { priceAlerts } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      await db
        .delete(priceAlerts)
        .where(
          and(eq(priceAlerts.id, input.id), eq(priceAlerts.userId, ctx.user.id))
        );

      return { success: true };
    }),

  // Check alerts (called by cron job)
  checkAlerts: protectedProcedure.mutation(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const { priceAlerts, stocks: stocksTable } = await import("../../drizzle/schema");
    const { eq, and, inArray } = await import("drizzle-orm");
    const { notifyOwner } = await import("../_core/notification");

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Get all active alerts
    const alerts = await db
      .select()
      .from(priceAlerts)
      .where(and(eq(priceAlerts.isActive, 1)));

    if (alerts.length === 0) {
      return { triggered: 0 };
    }

    // Get current prices for all tickers
    const tickers = Array.from(new Set(alerts.map((a) => a.ticker)));
    const stocks = await db
      .select()
      .from(stocksTable)
      .where(inArray(stocksTable.ticker, tickers));

    const stockPriceMap = new Map(
      stocks.map((s) => [s.ticker, parseFloat(s.currentPrice || "0")])
    );

    let triggeredCount = 0;

    // Check each alert
    for (const alert of alerts) {
      const currentPrice = stockPriceMap.get(alert.ticker);
      if (!currentPrice) continue;

      let shouldTrigger = false;
      let message = "";

      if (alert.alertType === "above_price" && alert.targetPrice) {
        const targetPrice = parseFloat(alert.targetPrice);
        if (currentPrice >= targetPrice) {
          shouldTrigger = true;
          message = `${alert.ticker} ist über ${targetPrice} gestiegen (aktuell: ${currentPrice.toFixed(2)})`;
        }
      } else if (alert.alertType === "below_price" && alert.targetPrice) {
        const targetPrice = parseFloat(alert.targetPrice);
        if (currentPrice <= targetPrice) {
          shouldTrigger = true;
          message = `${alert.ticker} ist unter ${targetPrice} gefallen (aktuell: ${currentPrice.toFixed(2)})`;
        }
      } else if (alert.alertType === "percent_change" && alert.percentChange) {
        // For percent change, we need historical data
        // Simplified: check if price changed more than X% since last trigger or creation
        const percentThreshold = parseFloat(alert.percentChange);
        const lastTriggerDate = alert.lastTriggered || alert.createdAt;
        
        // Get historical price from last trigger date
        const { historicalPrices } = await import("../../drizzle/schema");
        const dateStr = new Date(lastTriggerDate).toISOString().split("T")[0];
        
        const [historicalPrice] = await db
          .select()
          .from(historicalPrices)
          .where(
            and(
              eq(historicalPrices.ticker, alert.ticker),
              eq(historicalPrices.date, dateStr)
            )
          )
          .limit(1);

        if (historicalPrice && historicalPrice.close) {
          const oldPrice = parseFloat(historicalPrice.close);
          const percentChange = ((currentPrice - oldPrice) / oldPrice) * 100;
          
          if (Math.abs(percentChange) >= percentThreshold) {
            shouldTrigger = true;
            message = `${alert.ticker} hat sich um ${percentChange.toFixed(2)}% verändert (von ${oldPrice.toFixed(2)} auf ${currentPrice.toFixed(2)})`;
          }
        }
      }

      if (shouldTrigger) {
        // Send notification
        await notifyOwner({
          title: "Preis-Alert ausgelöst",
          content: message,
        });

        // Update lastTriggered timestamp
        await db
          .update(priceAlerts)
          .set({ lastTriggered: new Date() })
          .where(eq(priceAlerts.id, alert.id));

        triggeredCount++;
      }
    }

    return { triggered: triggeredCount };
  }),
});
