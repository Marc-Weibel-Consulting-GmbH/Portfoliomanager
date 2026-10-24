import { mkdir, writeFile } from "node:fs/promises";
import { ENV } from "../_core/env";
import { buildSplitAdjustedPriceRows, type RawCloseRow, type StockSplitEvent } from "../lib/totalReturnFromEvents";

const AS_OF_DATE = "2026-10-22";
const FROM_DATE = "2025-10-22";
const OUTPUT = "docs/audit/workings/WEIBEL_YVONNE_12M_LOCAL_PRICE_INDEX_2026-10-22.json";

type Instrument = { name: string; excelSymbol: string; eodhdSymbol: string; assetClass: "Aktie" | "Fonds/ETF" | "Strukturiert"; seriesBasis: "direct" | "same_isin_proxy" };

const INSTRUMENTS: Instrument[] = [
  { name: "ABB", excelSymbol: "ABBN", eodhdSymbol: "ABBN.SW", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "Aker BP", excelSymbol: "AKRBP", eodhdSymbol: "AKRBP.OL", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "Alphabet A", excelSymbol: "GOOGL", eodhdSymbol: "GOOGL.US", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "Amazon", excelSymbol: "AMZN", eodhdSymbol: "AMZN.US", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "BB Biotech", excelSymbol: "BION", eodhdSymbol: "BION.SW", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "BKW", excelSymbol: "BKW", eodhdSymbol: "BKW.SW", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "Cembra Money Bank", excelSymbol: "CMBN", eodhdSymbol: "CMBN.SW", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "Chevron", excelSymbol: "CVX", eodhdSymbol: "CVX.US", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "Johnson & Johnson", excelSymbol: "JNJ", eodhdSymbol: "JNJ.US", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "Nestlé", excelSymbol: "NESN", eodhdSymbol: "NESN.SW", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "Novartis", excelSymbol: "NOVN", eodhdSymbol: "NOVN.SW", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "NVIDIA", excelSymbol: "NVDA", eodhdSymbol: "NVDA.US", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "Palantir", excelSymbol: "PLTR", eodhdSymbol: "PLTR.US", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "Poste Italiane", excelSymbol: "PST", eodhdSymbol: "7PI.F", assetClass: "Aktie", seriesBasis: "same_isin_proxy" },
  { name: "PSP Swiss Property", excelSymbol: "PSPN", eodhdSymbol: "PSPN.SW", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "Rio Tinto", excelSymbol: "RIO", eodhdSymbol: "RIO.LSE", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "Roche", excelSymbol: "RO", eodhdSymbol: "RO.SW", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "SGS", excelSymbol: "SGSN", eodhdSymbol: "SGSN.SW", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "St. Galler Kantonalbank", excelSymbol: "SGKN", eodhdSymbol: "SGKN.SW", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "Swiss Re", excelSymbol: "SREN", eodhdSymbol: "SREN.SW", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "Swisscom", excelSymbol: "SCMN", eodhdSymbol: "SCMN.SW", assetClass: "Aktie", seriesBasis: "direct" },
  { name: "Zurich Insurance", excelSymbol: "ZURN", eodhdSymbol: "ZURN.SW", assetClass: "Aktie", seriesBasis: "direct" },
  // The workbook provides only the Morningstar fund identifier F00000OJCK.
  // EODHD has no verified exchange trading line for it, so this attempt is
  // deliberately retained as a disclosed gap rather than proxied or filled.
  { name: "Carmignac Investissement A CHF Acc Hdg", excelSymbol: "F00000OJCK", eodhdSymbol: "F00000OJCK.MSFD", assetClass: "Fonds/ETF", seriesBasis: "direct" },
  { name: "iShares Swiss Dividend ETF", excelSymbol: "CHDVD", eodhdSymbol: "CHDVD.SW", assetClass: "Fonds/ETF", seriesBasis: "direct" },
  { name: "Swisscanto Gold ETF", excelSymbol: "ZGLD", eodhdSymbol: "ZGLD.SW", assetClass: "Fonds/ETF", seriesBasis: "direct" },
  { name: "21Shares Bitcoin ETP", excelSymbol: "ABTC", eodhdSymbol: "ABTC.SW", assetClass: "Strukturiert", seriesBasis: "direct" },
];

type EodRow = { date?: unknown; close?: unknown };
type EodSplit = { date?: unknown; split?: unknown };

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function validRawRows(payload: unknown): RawCloseRow[] {
  return Array.isArray(payload) ? payload
    .map((row: EodRow) => ({ date: String(row?.date ?? ""), close: Number(row?.close) }))
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.close) && row.close > 0)
    : [];
}

function validSplits(payload: unknown): StockSplitEvent[] {
  return Array.isArray(payload) ? payload
    .map((row: EodSplit) => ({ date: String(row?.date ?? ""), split: String(row?.split ?? "") }))
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && /^\d+(\.\d+)?\/\d+(\.\d+)?$/.test(row.split))
    : [];
}

function monthKey(date: string): string { return date.slice(0, 7); }

async function resolveInstrument(instrument: Instrument, apiKey: string) {
  const base = `https://eodhd.com/api`;
  const encodedSymbol = encodeURIComponent(instrument.eodhdSymbol);
  try {
    const [eodPayload, splitPayload] = await Promise.all([
      fetchJson(`${base}/eod/${encodedSymbol}?api_token=${encodeURIComponent(apiKey)}&fmt=json&from=${FROM_DATE}&to=${AS_OF_DATE}`),
      fetchJson(`${base}/splits/${encodedSymbol}?api_token=${encodeURIComponent(apiKey)}&fmt=json&from=${FROM_DATE}&to=${AS_OF_DATE}`),
    ]);
    const rawRows = validRawRows(eodPayload);
    const splits = validSplits(splitPayload);
    const rows = buildSplitAdjustedPriceRows({ rawRows, splits });
    if (rows.length < 150) throw new Error(`insufficient coverage (${rows.length} rows)`);
    const baseValue = rows[0].adjustedClose;
    const monthEnds = new Map<string, { date: string; index: number }>();
    for (const row of rows) monthEnds.set(monthKey(row.date), { date: row.date, index: (row.adjustedClose / baseValue) * 100 });
    return {
      status: "included" as const,
      instrument,
      startDate: rows[0].date,
      endDate: rows.at(-1)!.date,
      observations: rows.length,
      splitEvents: splits,
      returnPct: (rows.at(-1)!.adjustedClose / baseValue - 1) * 100,
      monthEnds: Array.from(monthEnds.entries()).map(([month, value]) => ({ month, ...value })),
    };
  } catch (error) {
    return { status: "excluded" as const, instrument, reason: error instanceof Error ? error.message : String(error) };
  }
}

async function main(): Promise<void> {
  const apiKey = ENV.eodhdApiKey;
  if (!apiKey) throw new Error("EODHD key unavailable");
  const results = [] as Awaited<ReturnType<typeof resolveInstrument>>[];
  const concurrency = 5;
  for (let index = 0; index < INSTRUMENTS.length; index += concurrency) {
    results.push(...await Promise.all(INSTRUMENTS.slice(index, index + concurrency).map((instrument) => resolveInstrument(instrument, apiKey))));
  }
  const included = results.filter((result): result is Extract<typeof result, { status: "included" }> => result.status === "included");
  const allMonths = Array.from(new Set(included.flatMap((series) => series.monthEnds.map((row) => row.month)))).sort();
  const monthlyIndex = allMonths.map((month) => {
    const available = included.map((series) => series.monthEnds.find((row) => row.month === month)).filter(Boolean) as Array<{ date: string; index: number }>;
    return {
      month,
      observationDateRange: `${available.map((row) => row.date).sort()[0]}–${available.map((row) => row.date).sort().at(-1)}`,
      index: available.reduce((sum, row) => sum + row.index, 0) / available.length,
      contributingInstruments: available.length,
    };
  });
  const first = monthlyIndex[0]?.index;
  const last = monthlyIndex.at(-1)?.index;
  const output = {
    asOfDate: AS_OF_DATE,
    fromDate: FROM_DATE,
    source: "EODHD /api/eod and /api/splits, retrieved 2026-10-22",
    method: "Equal-weighted local-currency, split-adjusted price index. Each included direct or explicitly marked same-ISIN proxy series is rebased to 100 at its first available observation. Monthly values use the last available local trading close in each month. Cash dividends and FX changes are excluded. This is a title-sample price index, not the account's realised or CHF-weighted portfolio performance.",
    requestedInstrumentCount: INSTRUMENTS.length,
    includedInstrumentCount: included.length,
    excludedInstrumentCount: results.length - included.length,
    indexStart: first,
    indexEnd: last,
    twelveMonthPriceReturnPct: first && last ? (last / first - 1) * 100 : null,
    monthlyIndex,
    included: included.map(({ monthEnds, ...series }) => series),
    excluded: results.filter((result) => result.status === "excluded"),
  };
  await mkdir("docs/audit/workings", { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ output: OUTPUT, included: output.includedInstrumentCount, excluded: output.excludedInstrumentCount, twelveMonthPriceReturnPct: output.twelveMonthPriceReturnPct, monthlyIndex: output.monthlyIndex }, null, 2));
}

void main().catch((error) => { console.error("[weibel-yvonne-12m-price-index] failed", error); process.exit(1); });
