import { mkdir, writeFile } from "node:fs/promises";
import { getEodhdApiKey } from "../_core/env";
import { toEodhdSymbol } from "../lib/eodhdSymbol";

const AS_OF_DATE = process.env.AUDIT_AS_OF_DATE ?? new Date().toISOString().slice(0, 10);
const TICKERS = ["MNG.L", "VWRL.L", "DGE.L", "AZN.L"];

async function main() {
  const key = await getEodhdApiKey();
  if (!key) throw new Error("EODHD key unavailable");
  const output: Record<string, unknown> = {};
  const start = new Date(`${AS_OF_DATE}T12:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - 365);

  for (const ticker of TICKERS) {
    const symbol = toEodhdSymbol(ticker);
    const [fundamentals, realTime, dividends] = await Promise.all([
      fetch(`https://eodhd.com/api/fundamentals/${symbol}?api_token=${key}&fmt=json`).then((r) => r.json()),
      fetch(`https://eodhd.com/api/real-time/${symbol}?api_token=${key}&fmt=json`).then((r) => r.json()),
      fetch(`https://eodhd.com/api/div/${symbol}?api_token=${key}&fmt=json&from=${start.toISOString().slice(0, 10)}&to=${AS_OF_DATE}`).then((r) => r.json()),
    ]);
    output[ticker] = {
      symbol,
      fundamentals: {
        currency: fundamentals?.General?.CurrencyCode ?? null,
        highlightsDividendYield: fundamentals?.Highlights?.DividendYield ?? null,
        forwardAnnualDividendRate: fundamentals?.SplitsDividends?.ForwardAnnualDividendRate ?? null,
        forwardAnnualDividendYield: fundamentals?.SplitsDividends?.ForwardAnnualDividendYield ?? null,
      },
      realTime: { close: realTime?.close ?? null, currency: realTime?.currency ?? null },
      dividends: Array.isArray(dividends) ? dividends.map((event: any) => ({
        date: event?.date ?? null,
        value: event?.value ?? null,
        unadjustedValue: event?.unadjustedValue ?? null,
        currency: event?.currency ?? null,
        period: event?.period ?? null,
      })) : dividends,
    };
  }

  await mkdir("docs/audit/workings", { recursive: true });
  const path = `docs/audit/workings/LSE_DIVIDEND_QUOTE_UNIT_EVIDENCE_${AS_OF_DATE}.json`;
  await writeFile(path, `${JSON.stringify({ asOfDate: AS_OF_DATE, tickers: output }, null, 2)}\n`);
  console.log(path);
}
void main().catch((error) => { console.error(error); process.exit(1); });
