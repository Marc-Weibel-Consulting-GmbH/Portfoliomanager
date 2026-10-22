import { mkdir, writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { stocks } from "../../drizzle/schema";
import { fetchEODHDFundamentals } from "../_core/eodhdApi";
import { resolveDividendYieldEnrichment } from "../_core/dividendYieldEnrichment";
import { toVerifiedDividendYieldUpdate } from "../lib/dividendYieldPersistence";

const AS_OF_DATE = process.env.AUDIT_AS_OF_DATE ?? new Date().toISOString().slice(0, 10);
const OUTPUT = `docs/audit/workings/VERIFIED_DIVIDEND_METRIC_REFRESH_${AS_OF_DATE}.json`;
const CONCURRENCY = 4;
const REQUESTED_TICKERS = new Set(
  String(process.env.TICKERS ?? "")
    .split(",")
    .map((ticker) => ticker.trim().toUpperCase())
    .filter(Boolean),
);

type StockRow = typeof stocks.$inferSelect;

type Change = {
  ticker: string;
  previous: Record<string, string | number | null>;
  next: Record<string, string | number | null>;
};

function valuesDiffer(left: unknown, right: unknown): boolean {
  return String(left ?? "") !== String(right ?? "");
}

async function mapLimit<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  }));
}

async function main(): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Scope is deliberately all active instruments — curated watchlist and
  // portfolio-only master records — but excludes inactive historical rows.
  const activeUniverse = await db.select().from(stocks).where(eq(stocks.isActive, 1));
  const universe = REQUESTED_TICKERS.size > 0
    ? activeUniverse.filter((stock) => REQUESTED_TICKERS.has(stock.ticker.toUpperCase()))
    : activeUniverse;
  const changes: Change[] = [];
  const unavailable: Array<{ ticker: string; reason: string }> = [];
  let unchanged = 0;
  let processed = 0;

  await mapLimit(universe, async (stock) => {
    try {
      const currentPrice = Number(stock.currentPrice);
      if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
        unavailable.push({ ticker: stock.ticker, reason: "current_price_missing" });
        return;
      }

      const fundamentals = await fetchEODHDFundamentals(stock.ticker);
      const dividend = await resolveDividendYieldEnrichment({
        ticker: stock.ticker,
        currentPrice,
        currency: fundamentals.currency ?? stock.currency,
        fundamentals,
        asOfDate: AS_OF_DATE,
      });
      const update = toVerifiedDividendYieldUpdate(dividend);
      processed += 1;

      if (Object.keys(update).length === 0) {
        unavailable.push({ ticker: stock.ticker, reason: "no_verified_dividend_basis" });
        return;
      }

      const fields = Object.keys(update) as Array<keyof typeof update>;
      const differs = fields.some((field) => valuesDiffer(stock[field as keyof StockRow], update[field]));
      if (!differs) {
        unchanged += 1;
        return;
      }

      const previous: Change["previous"] = {};
      const next: Change["next"] = {};
      for (const field of fields) {
        previous[field] = (stock[field as keyof StockRow] ?? null) as string | number | null;
        next[field] = (update[field] ?? null) as string | number | null;
      }

      await db.update(stocks).set(update).where(eq(stocks.ticker, stock.ticker));
      changes.push({ ticker: stock.ticker, previous, next });
    } catch (error) {
      unavailable.push({
        ticker: stock.ticker,
        reason: error instanceof Error ? error.message.slice(0, 240) : "unknown_error",
      });
    }
  });

  const report = {
    asOfDate: AS_OF_DATE,
    method: "EODHD dated /api/div TTM gross (special dividends excluded) → EODHD forward indicated → EODHD provider highlights; generic multi-provider yields are never persisted.",
    scope: {
      activeInstrumentCount: universe.length,
      requestedTickerCount: REQUESTED_TICKERS.size || null,
      processed,
      concurrency: CONCURRENCY,
    },
    result: {
      changed: changes.length,
      unchanged,
      unavailable: unavailable.length,
    },
    changes: changes.sort((left, right) => left.ticker.localeCompare(right.ticker)),
    unavailable: unavailable.sort((left, right) => left.ticker.localeCompare(right.ticker)),
  };

  await mkdir("docs/audit/workings", { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output: OUTPUT, ...report.scope, ...report.result }, null, 2));
}

void main().catch((error) => {
  console.error("[verified-dividend-refresh] failed", error);
  process.exit(1);
});
