import { writeFile } from "node:fs/promises";
import { getEodhdApiKey } from "../_core/env";
import { getDb } from "../db";
import { stocks, historicalPrices, splitAdjustedHistoricalPrices, totalReturnHistoricalPrices } from "../../drizzle/schema";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";

const ticker = "SQN.SW";
const baseUrl = "https://eodhd.com/api";

function clean(value: unknown): unknown {
  if (typeof value === "string" && /api[_-]?token|bearer|key/i.test(value)) return "[redacted]";
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, clean(nested)]));
  return value;
}

function sampleImportantDates(rows: unknown[]): unknown[] {
  return rows.filter((row: any) => {
    const date = String(row?.date ?? "");
    return date.startsWith("2025-12-") || (date >= "2026-05-26" && date <= "2026-05-29") || date >= "2026-10-01";
  });
}

async function fetchJson(path: string, token: string) {
  const response = await fetch(`${baseUrl}${path}${path.includes("?") ? "&" : "?"}api_token=${token}&fmt=json`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const token = await getEodhdApiKey();
  if (!token) throw new Error("EODHD-Schlüssel nicht verfügbar");
  const db = await getDb();
  if (!db) throw new Error("Datenbank nicht verfügbar");

  const [fundamentals, realtime, splits, dividends, eod, master, rawRows, splitRows, totalRows] = await Promise.all([
    fetchJson(`/fundamentals/${ticker}`, token),
    fetchJson(`/real-time/${ticker}`, token),
    fetchJson(`/splits/${ticker}?from=2025-01-01&to=2026-10-09`, token),
    fetchJson(`/div/${ticker}?from=2025-01-01&to=2026-10-09`, token),
    fetchJson(`/eod/${ticker}?from=2025-12-20&to=2026-10-09`, token),
    db.select().from(stocks).where(eq(stocks.ticker, ticker)).limit(1),
    db.select().from(historicalPrices).where(and(eq(historicalPrices.ticker, ticker), gte(historicalPrices.date, "2025-12-20"), lte(historicalPrices.date, "2026-10-09"))).orderBy(asc(historicalPrices.date)),
    db.select().from(splitAdjustedHistoricalPrices).where(and(eq(splitAdjustedHistoricalPrices.ticker, ticker), gte(splitAdjustedHistoricalPrices.date, "2025-12-20"), lte(splitAdjustedHistoricalPrices.date, "2026-10-09"))).orderBy(asc(splitAdjustedHistoricalPrices.date)),
    db.select().from(totalReturnHistoricalPrices).where(and(eq(totalReturnHistoricalPrices.ticker, ticker), gte(totalReturnHistoricalPrices.date, "2025-12-20"), lte(totalReturnHistoricalPrices.date, "2026-10-09"))).orderBy(desc(totalReturnHistoricalPrices.date)),
  ]);

  const evidence = {
    fetchedAt: new Date().toISOString(),
    ticker,
    eodhd: {
      fundamentals: {
        General: (fundamentals as any)?.General ? {
          Code: (fundamentals as any).General.Code,
          ISIN: (fundamentals as any).General.ISIN,
          CurrencyCode: (fundamentals as any).General.CurrencyCode,
          FiscalYearEnd: (fundamentals as any).General.FiscalYearEnd,
        } : null,
        Highlights: (fundamentals as any)?.Highlights ? {
          PERatio: (fundamentals as any).Highlights.PERatio,
          PEGRatio: (fundamentals as any).Highlights.PEGRatio,
          DividendYield: (fundamentals as any).Highlights.DividendYield,
          EarningsShare: (fundamentals as any).Highlights.EarningsShare,
          MarketCapitalization: (fundamentals as any).Highlights.MarketCapitalization,
        } : null,
        SplitsDividends: (fundamentals as any)?.SplitsDividends ?? null,
      },
      realtime: realtime,
      splits,
      dividends,
      eodImportantDates: sampleImportantDates(Array.isArray(eod) ? eod : []),
    },
    database: {
      master: master[0] ?? null,
      rawRowsImportantDates: sampleImportantDates(rawRows),
      splitAdjustedRowsImportantDates: sampleImportantDates(splitRows),
      totalReturnRowsImportantDates: sampleImportantDates(totalRows),
    },
  };
  const outputPath = "docs/audit/workings/SQN_SW_SPLIT_RAW_EVIDENCE_2026-10-09.json";
  await writeFile(outputPath, JSON.stringify(clean(evidence), null, 2));
  console.log(JSON.stringify({ ticker, outputPath, rawRows: rawRows.length, splitRows: splitRows.length, totalRows: totalRows.length, splitCount: Array.isArray(splits) ? splits.length : null, dividendCount: Array.isArray(dividends) ? dividends.length : null }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
