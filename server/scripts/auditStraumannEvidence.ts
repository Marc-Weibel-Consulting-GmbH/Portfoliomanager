import { writeFile } from "node:fs/promises";
import { getEodhdApiKey } from "../_core/env";

async function main() {
  const ticker = "STMN.SW";
  const apiKey = await getEodhdApiKey();
  if (!apiKey) throw new Error("EODHD-Schlüssel nicht verfügbar");

  const response = await fetch(
    `https://eodhd.com/api/fundamentals/${ticker}?api_token=${apiKey}&fmt=json`,
    { signal: AbortSignal.timeout(15_000) },
  );
  if (!response.ok) throw new Error(`EODHD HTTP ${response.status}`);
  const data: any = await response.json();

  const output = {
    retrievedAt: new Date().toISOString(),
    request: { endpoint: "fundamentals", ticker, format: "json" },
    General: {
      Code: data.General?.Code ?? null,
      Name: data.General?.Name ?? null,
      Exchange: data.General?.Exchange ?? null,
      CurrencyCode: data.General?.CurrencyCode ?? null,
      ISIN: data.General?.ISIN ?? null,
      Type: data.General?.Type ?? null,
    },
    Highlights: {
      MarketCapitalization: data.Highlights?.MarketCapitalization ?? null,
      PERatio: data.Highlights?.PERatio ?? null,
      PEGRatio: data.Highlights?.PEGRatio ?? null,
      EarningsShare: data.Highlights?.EarningsShare ?? null,
      EPSEstimateCurrentYear: data.Highlights?.EPSEstimateCurrentYear ?? null,
      EPSEstimateNextYear: data.Highlights?.EPSEstimateNextYear ?? null,
      DividendYield: data.Highlights?.DividendYield ?? null,
      ForwardAnnualDividendYield: data.Highlights?.ForwardAnnualDividendYield ?? null,
      ForwardAnnualDividendRate: data.Highlights?.ForwardAnnualDividendRate ?? null,
      QuarterlyEarningsGrowthYOY: data.Highlights?.QuarterlyEarningsGrowthYOY ?? null,
      MostRecentQuarter: data.Highlights?.MostRecentQuarter ?? null,
    },
    Valuation: {
      ForwardPE: data.Valuation?.ForwardPE ?? null,
      PriceBookMRQ: data.Valuation?.PriceBookMRQ ?? null,
      EnterpriseValue: data.Valuation?.EnterpriseValue ?? null,
    },
    latestAnnualIncome: Object.entries(data.Financials?.Income_Statement?.yearly ?? {})
      .sort(([left], [right]) => left.localeCompare(right)).slice(-2),
    latestQuarterlyIncome: Object.entries(data.Financials?.Income_Statement?.quarterly ?? {})
      .sort(([left], [right]) => left.localeCompare(right)).slice(-8),
    annualEps: Object.entries(data.Earnings?.Annual ?? {})
      .sort(([left], [right]) => left.localeCompare(right)).slice(-7),
    quarterlyEps: Object.entries(data.Earnings?.History ?? {})
      .sort(([left], [right]) => left.localeCompare(right)).slice(-10),
  };

  const destination = "/home/ubuntu/portfolio_analysis_website/docs/audit/workings/STMN_SW_RAW_EVIDENCE_2026-10-06.json";
  await writeFile(destination, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({
    retrievedAt: output.retrievedAt,
    General: output.General,
    Highlights: output.Highlights,
    Valuation: output.Valuation,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
