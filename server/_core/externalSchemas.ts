/**
 * Zod schemas for external API responses (A-05).
 *
 * External providers (EODHD, Fiscal.ai) occasionally answer with HTML error
 * pages, rate-limit JSON or partial payloads. Before this module, those
 * responses were blindly cast and ended up as "undefined"/NaN in varchar
 * price columns. Each consumer validates with `.safeParse` at the API-client
 * boundary; on failure it logs a warning (ticker + truncated payload sample)
 * and returns its existing null/empty fallback.
 *
 * Only the fields the code actually reads are validated — extra keys are
 * stripped/ignored, so provider-side additions never break us.
 */
import { z } from "zod";

/** Number that may arrive as a string (EODHD mixes both, incl. "NA"). */
export const numberLike = z.union([z.number(), z.string()]);

/** EODHD /api/eod/{ticker} row (importHistoricalPrices.ts). */
export const eodhdEodRowSchema = z.object({
  date: z.string(),
  open: numberLike.nullish(),
  high: numberLike.nullish(),
  low: numberLike.nullish(),
  close: z.number(),
  adjusted_close: z.number().nullish(),
  volume: numberLike.nullish(),
});
export const eodhdEodResponseSchema = z.array(eodhdEodRowSchema);
export type EodhdEodRow = z.infer<typeof eodhdEodRowSchema>;

/** EODHD /api/real-time/{ticker} — only the fields fetchEODHDRealTime reads. */
export const eodhdRealTimeSchema = z.object({
  close: numberLike.nullish(),
  previousClose: numberLike.nullish(),
  change_p: numberLike.nullish(),
});

/** EODHD /api/fundamentals/{ticker} — only the subset fetchEODHDFundamentals reads. */
export const eodhdFundamentalsSchema = z.object({
  General: z
    .object({
      Name: z.string().nullish(),
      Sector: z.string().nullish(),
      Industry: z.string().nullish(),
    })
    .nullish(),
  Highlights: z
    .object({
      PEGRatio: numberLike.nullish(),
      PERatio: numberLike.nullish(),
      DividendYield: numberLike.nullish(),
      MarketCapitalization: numberLike.nullish(),
      Beta: numberLike.nullish(),
      EarningsShare: numberLike.nullish(),
      BookValue: numberLike.nullish(),
    })
    .nullish(),
  Valuation: z.object({ TrailingPE: numberLike.nullish() }).nullish(),
  Technicals: z.object({ Beta: numberLike.nullish() }).nullish(),
  Earnings: z
    .object({ History: z.record(z.string(), z.unknown()).nullish() })
    .nullish(),
});

/** Fiscal.ai daily P/E ratio response (fiscalApi.ts). */
export const fiscalPEHistorySchema = z.array(
  z.object({
    date: z.string(),
    ratio: z.number(),
  })
);

/** Short payload sample for warnings — avoids dumping whole responses into logs. */
export function payloadSample(data: unknown, maxLength = 300): string {
  try {
    const s = typeof data === "string" ? data : JSON.stringify(data);
    return s.length > maxLength ? `${s.slice(0, maxLength)}…` : s;
  } catch {
    return String(data).slice(0, maxLength);
  }
}
