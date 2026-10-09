import { mkdir, writeFile } from "node:fs/promises";
import YahooFinanceClass from "yahoo-finance2";
import { getEodhdApiKey } from "../_core/env";

const OUT = "docs/audit/workings/WILC_PRICE_RAW_EVIDENCE_2026-10-09.json";

async function main() {
  const token = await getEodhdApiKey();
  if (!token) throw new Error("EODHD-Schlüssel nicht verfügbar");
  const base = "https://eodhd.com/api";
  const [fundamentals, quote, eod, splits] = await Promise.all([
    fetch(`${base}/fundamentals/WILC.US?api_token=${token}&fmt=json`).then(async (r) => ({ status: r.status, body: await r.json() })),
    fetch(`${base}/real-time/WILC.US?api_token=${token}&fmt=json`).then(async (r) => ({ status: r.status, body: await r.json() })),
    fetch(`${base}/eod/WILC.US?api_token=${token}&fmt=json&from=2025-09-20&to=2026-10-09`).then(async (r) => ({ status: r.status, body: await r.json() })),
    fetch(`${base}/splits/WILC.US?api_token=${token}&fmt=json&from=2025-09-20&to=2026-10-09`).then(async (r) => ({ status: r.status, body: await r.json() })),
  ]);
  const yahoo = new (YahooFinanceClass as any)();
  let yahooSummary: unknown = null;
  try {
    const result = await yahoo.quoteSummary("WILC", { modules: ["price"] }, { validateResult: false });
    yahooSummary = result?.price ?? null;
  } catch (error) {
    yahooSummary = { error: error instanceof Error ? error.message : String(error) };
  }
  const f = fundamentals.body as any;
  const q = quote.body as any;
  const rows = Array.isArray(eod.body) ? eod.body : [];
  const relevantRows = rows.filter((row: any) => {
    const date = String(row?.date ?? "");
    return date <= "2025-10-10" || date >= "2026-07-01" || date.startsWith("2026-01");
  });
  const report = {
    fetchedAt: new Date().toISOString(),
    ticker: "WILC",
    eodhd: {
      fundamentals: { status: fundamentals.status, general: f?.General ? { Code: f.General.Code, ISIN: f.General.ISIN, CurrencyCode: f.General.CurrencyCode, Name: f.General.Name } : null, lastSplit: f?.SplitsDividends ? { LastSplitFactor: f.SplitsDividends.LastSplitFactor, LastSplitDate: f.SplitsDividends.LastSplitDate } : null },
      realtime: { status: quote.status, code: q?.code, close: q?.close, previousClose: q?.previousClose, timestamp: q?.timestamp },
      splits: { status: splits.status, body: splits.body },
      eodImportantDates: { status: eod.status, rows: relevantRows },
    },
    yahooPrice: yahooSummary,
  };
  await mkdir("docs/audit/workings", { recursive: true });
  await writeFile(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ outPath: OUT, eodStatus: eod.status, splitStatus: splits.status, quoteStatus: quote.status }));
}
main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exit(1); });
