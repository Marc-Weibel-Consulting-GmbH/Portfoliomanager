import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getCurrentFxRate } from "../fxHelper";

/**
 * FX rates via the canonical fxHelper (DB-backed exchangeRates table, D-02).
 * Only CHF crosses are stored (USDCHF, EURCHF, GBPCHF); arbitrary pairs are
 * derived via CHF. Missing rates yield 0 (R-10 convention) — no hardcoded
 * fallback rates.
 */
async function getRateViaChf(from: string, to: string): Promise<number> {
  if (from === to) return 1.0;
  const fromChf = from === "CHF" ? 1.0 : await getCurrentFxRate(`${from}CHF`);
  const toChf = to === "CHF" ? 1.0 : await getCurrentFxRate(`${to}CHF`);
  if (fromChf === 0 || toChf === 0) return 0;
  return fromChf / toChf;
}

export const fxRatesRouter = router({
  /**
   * Get single FX rate
   */
  getRate: publicProcedure
    .input(
      z.object({
        from: z.string(),
        to: z.string(),
      })
    )
    .query(async ({ input }) => {
      const rate = await getRateViaChf(input.from, input.to);
      return {
        from: input.from,
        to: input.to,
        rate,
      };
    }),

  /**
   * Convert amount from one currency to another
   */
  convert: publicProcedure
    .input(
      z.object({
        amount: z.number(),
        from: z.string(),
        to: z.string(),
      })
    )
    .query(async ({ input }) => {
      const rate = await getRateViaChf(input.from, input.to);
      return {
        amount: input.amount,
        from: input.from,
        to: input.to,
        convertedAmount: input.amount * rate,
      };
    }),

  /**
   * Get multiple FX rates at once
   */
  getMultiple: publicProcedure
    .input(
      z.object({
        pairs: z.array(
          z.object({
            from: z.string(),
            to: z.string(),
          })
        ),
      })
    )
    .query(async ({ input }) => {
      return Promise.all(
        input.pairs.map(async (p) => ({
          from: p.from,
          to: p.to,
          rate: await getRateViaChf(p.from, p.to),
        }))
      );
    }),
});
