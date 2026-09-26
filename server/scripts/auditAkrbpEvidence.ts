import { writeFile } from "node:fs/promises";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { stocks } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const now = new Date().toISOString();
  const apiKey = ENV.eodhdApiKey;
  if (!apiKey) throw new Error("EODHD key unavailable");
  const fundamentalsUrl = `https://eodhd.com/api/fundamentals/AKRBP.OL?api_token=${apiKey}&fmt=json`;
  const dividendsUrl = `https://eodhd.com/api/div/AKRBP.OL?from=2025-09-20&to=2026-09-26&api_token=${apiKey}&fmt=json`;
  const [fundamentalsResponse, dividendsResponse, db] = await Promise.all([
    fetch(fundamentalsUrl),
    fetch(dividendsUrl),
    getDb(),
  ]);
  const fundamentals = await fundamentalsResponse.json();
  const dividends = await dividendsResponse.json();
  const stockRows = db ? await db.select().from(stocks).where(eq(stocks.ticker, "AKRBP.OL")).limit(5) : [];
  const selectedFundamentals = {
    General: {
      Code: fundamentals?.General?.Code ?? null,
      Type: fundamentals?.General?.Type ?? null,
      Name: fundamentals?.General?.Name ?? null,
      Exchange: fundamentals?.General?.Exchange ?? null,
      CurrencyCode: fundamentals?.General?.CurrencyCode ?? null,
      ISIN: fundamentals?.General?.ISIN ?? null,
    },
    Highlights: {
      DividendYield: fundamentals?.Highlights?.DividendYield ?? null,
      DividendShare: fundamentals?.Highlights?.DividendShare ?? null,
      DividendPerShare: fundamentals?.Highlights?.DividendPerShare ?? null,
      MarketCapitalization: fundamentals?.Highlights?.MarketCapitalization ?? null,
    },
    SplitsDividends: fundamentals?.SplitsDividends ?? null,
  };
  const selectedStockRows = stockRows.map((row: any) => ({
    id: row.id,
    ticker: row.ticker,
    companyName: row.companyName,
    currentPrice: row.currentPrice,
    currency: row.currency,
    dividendYield: row.dividendYield,
    eodhdTicker: row.eodhdTicker ?? null,
    dataQualityNotes: row.dataQualityNotes ?? null,
    lastMetricsUpdate: row.lastMetricsUpdate ?? null,
    updatedAt: row.updatedAt ?? null,
  }));
  const payload = {
    retrievedAt: now,
    eodhd: {
      fundamentalsHttpStatus: fundamentalsResponse.status,
      dividendsHttpStatus: dividendsResponse.status,
      fundamentals: selectedFundamentals,
      dividends,
    },
    localStocks: selectedStockRows,
  };
  const output = "docs/audit/workings/AKRBP_OL_RAW_EVIDENCE_2026-09-26.json";
  await writeFile(output, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ output, retrievedAt: now, fundamentalsHttpStatus: fundamentalsResponse.status, dividendsHttpStatus: dividendsResponse.status, selectedFundamentals, dividends, selectedStockRows }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
