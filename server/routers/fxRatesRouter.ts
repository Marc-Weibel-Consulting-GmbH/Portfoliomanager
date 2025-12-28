import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { convertCurrency, getFXRate, getMultipleFXRates } from "../fxRates";

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
      const rate = await getFXRate(input.from, input.to);
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
      const convertedAmount = await convertCurrency(
        input.amount,
        input.from,
        input.to
      );
      return {
        amount: input.amount,
        from: input.from,
        to: input.to,
        convertedAmount,
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
      const pairs: [string, string][] = input.pairs.map((p) => [p.from, p.to]);
      const rates = await getMultipleFXRates(pairs);
      
      return input.pairs.map((p) => ({
        from: p.from,
        to: p.to,
        rate: rates.get(`${p.from}/${p.to}`) || 1.0,
      }));
    }),
});
