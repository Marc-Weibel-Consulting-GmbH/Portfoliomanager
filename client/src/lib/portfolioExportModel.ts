export type ExportDataStatus = "OK" | "Kursdaten fehlen" | "Wechselkursdaten fehlen" | "Kurs- und Wechselkursdaten fehlen";

export type PortfolioExportPosition = {
  ticker: string;
  companyName: string;
  isin: string | null;
  sector: string;
  currency: string;
  shares: number | null;
  currentPriceLocal: number | null;
  marketValueCHF: number | null;
  portfolioWeightPct: number | null;
  ytdReturnPct: number | null;
  totalReturnPct: number | null;
  dataStatus: ExportDataStatus;
  returnDataStatus: "OK" | "Einstandsdaten fehlen";
};

export type PortfolioExportKpi = {
  key: string;
  label: string;
  value: number | null;
  unit: "CHF" | "percent" | "ratio";
  definition: string;
};

export type PortfolioExportModel = {
  title: string;
  portfolioId: number;
  asOf: Date;
  asOfLabel: string;
  periodLabel: string;
  referenceCurrency: string;
  isLive: boolean;
  summary: {
    currentValueCHF: number;
    totalInvestedCHF: number | null;
    absoluteGainCHF: number | null;
    cashBalanceCHF: number;
    cashWeightPct: number | null;
    avgDividendYieldPct: number | null;
  };
  kpis: PortfolioExportKpi[];
  positions: PortfolioExportPosition[];
  sectorAllocation: Array<{ name: string; weightPct: number }>;
  depotValueSeries: Array<{ date: string; marketValueCHF: number }>;
  indexedReturnSeries: Array<{ date: string; cumulativeReturnPct: number }>;
  depotValueSeriesKind: "actual" | "indexed" | "unavailable";
  dataQualityNotes: string[];
};

type UnknownRecord = Record<string, unknown>;

export type BuildPortfolioExportModelInput = {
  portfolio: UnknownRecord;
  holdings: UnknownRecord[];
  performance?: UnknownRecord | null;
  risk?: UnknownRecord | null;
  fallbackIndexedSeries?: UnknownRecord[];
  referenceCurrency?: string;
  asOf?: Date;
  periodLabel?: string;
};

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const number = asNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function asText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getDataStatus(holding: UnknownRecord): ExportDataStatus {
  const priceMissing = holding.priceMissing === true;
  const fxMissing = holding.fxMissing === true;
  if (priceMissing && fxMissing) return "Kurs- und Wechselkursdaten fehlen";
  if (priceMissing) return "Kursdaten fehlen";
  if (fxMissing) return "Wechselkursdaten fehlen";
  return "OK";
}

function formatAsOf(date: Date): string {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function buildKpis(
  summary: PortfolioExportModel["summary"],
  performance: UnknownRecord,
  risk: UnknownRecord | null | undefined,
): PortfolioExportKpi[] {
  // Der Portfolio-Risikocontract liefert bei verwertbaren Reihen Kennzahlen,
  // aber nicht in jedem Pfad zusätzlich ein `dataAvailable`-Flag. Ein explizites
  // false bleibt ein Ausschluss; fehlendes Metadatum darf belegte Werte nicht
  // aus dem Export entfernen.
  const riskAvailable = risk !== undefined && risk !== null && risk.dataAvailable !== false;
  return [
    { key: "current_value", label: "Depotwert", value: summary.currentValueCHF, unit: "CHF", definition: "Aktueller Gesamtwert inklusive vorhandener Liquidität." },
    { key: "invested_capital", label: "Investiertes Kapital", value: summary.totalInvestedCHF, unit: "CHF", definition: "Externe Einzahlungen abzüglich Abflüsse gemäss Performance-Ledger." },
    { key: "absolute_gain", label: "Gewinn / Verlust", value: summary.absoluteGainCHF, unit: "CHF", definition: "Depotwert plus Auszahlungen minus investiertes Kapital." },
    { key: "cash", label: "Liquidität", value: summary.cashBalanceCHF, unit: "CHF", definition: "Im Depot geführte Liquiditätsreserve; bereits im Depotwert enthalten." },
    { key: "cash_weight", label: "Liquiditätsanteil", value: summary.cashWeightPct, unit: "percent", definition: "Liquidität geteilt durch aktuellen Gesamtwert." },
    { key: "ttwror", label: "TTWROR", value: firstNumber(performance.ttwror), unit: "percent", definition: "Zeitgewichtete Rendite im ausgewählten Zeitraum; externe Zahlungsströme werden periodisch neutralisiert." },
    { key: "annualized_ttwror", label: "TTWROR p.a.", value: firstNumber(performance.annualizedTtwror), unit: "percent", definition: "Auf Jahresbasis umgerechnete zeitgewichtete Rendite im ausgewählten Zeitraum." },
    { key: "irr", label: "IRR p.a.", value: firstNumber(performance.irr), unit: "percent", definition: "Geldgewichtete Jahresrendite inklusive Zeitpunkten externer Zahlungsströme." },
    { key: "sharpe", label: "Sharpe Ratio", value: riskAvailable ? firstNumber(risk?.sharpeRatio) : null, unit: "ratio", definition: "Risikoadjustierte Rendite auf Basis der verfügbaren Risikoreihe." },
    { key: "volatility", label: "Volatilität p.a.", value: riskAvailable ? firstNumber(risk?.volatility) : null, unit: "percent", definition: "Annualisierte Volatilität der verfügbaren täglichen Portfolioentwicklung." },
    { key: "max_drawdown", label: "Max. Drawdown", value: riskAvailable ? firstNumber(risk?.maxDrawdown) : null, unit: "percent", definition: "Grösster beobachteter prozentualer Rückgang vom vorherigen Höchststand." },
    { key: "dividend_yield", label: "Ø Dividendenrendite", value: summary.avgDividendYieldPct, unit: "percent", definition: "Gewichtete, aktuell gespeicherte Dividendenrendite der Positionen; kein garantierter Ertrag." },
  ];
}

export function buildPortfolioExportModel(input: BuildPortfolioExportModelInput): PortfolioExportModel {
  const asOf = input.asOf ?? new Date();
  const portfolio = input.portfolio;
  const performance = input.performance ?? {};
  const currentValueCHF = firstNumber(portfolio.totalValueCHF, performance.currentValueCHF) ?? 0;
  const cashBalanceCHF = firstNumber(portfolio.cashBalance) ?? 0;
  const totalInvestedCHF = firstNumber(performance.totalInvestedCHF, portfolio.investmentAmount);
  const absoluteGainCHF = firstNumber(performance.absoluteGainCHF) ?? (
    totalInvestedCHF !== null ? currentValueCHF - totalInvestedCHF : null
  );
  const summary = {
    currentValueCHF,
    totalInvestedCHF,
    absoluteGainCHF,
    cashBalanceCHF,
    cashWeightPct: currentValueCHF > 0 ? (cashBalanceCHF / currentValueCHF) * 100 : null,
    avgDividendYieldPct: firstNumber(portfolio.avgDividendYield),
  };

  const positions = input.holdings
    .map((holding): PortfolioExportPosition => {
      const dataStatus = getDataStatus(holding);
      const returnDataStatus = holding.hasBuyPrice === false ? "Einstandsdaten fehlen" : "OK";
      return {
        ticker: asText(holding.ticker, "—"),
        companyName: asText(holding.companyName, asText(holding.name, "Unbekannter Titel")),
        isin: typeof holding.isin === "string" && holding.isin.trim() ? holding.isin.trim() : null,
        sector: asText(holding.sector, "Nicht zugeordnet"),
        currency: asText(holding.currency, input.referenceCurrency ?? "CHF"),
        shares: firstNumber(holding.shares),
        currentPriceLocal: firstNumber(holding.currentPriceLocal, holding.currentPrice),
        marketValueCHF: dataStatus === "OK" ? firstNumber(holding.valueCHF) : null,
        portfolioWeightPct: firstNumber(holding.weight),
        ytdReturnPct: firstNumber(holding.ytdPerformance),
        totalReturnPct: returnDataStatus === "OK" ? firstNumber(holding.totalReturn) : null,
        dataStatus,
        returnDataStatus,
      };
    })
    .sort((a, b) => (b.marketValueCHF ?? -1) - (a.marketValueCHF ?? -1));

  const sectorWeights = new Map<string, number>();
  for (const position of positions) {
    if (position.portfolioWeightPct !== null) {
      sectorWeights.set(position.sector, (sectorWeights.get(position.sector) ?? 0) + position.portfolioWeightPct);
    }
  }
  const sectorAllocation = Array.from(sectorWeights, ([name, weightPct]) => ({ name, weightPct }))
    .sort((a, b) => b.weightPct - a.weightPct);
  if (summary.cashWeightPct && summary.cashWeightPct > 0.01) {
    sectorAllocation.push({ name: "Liquidität", weightPct: summary.cashWeightPct });
  }

  const rawValuations = Array.isArray(performance.dailyValuations) ? performance.dailyValuations as UnknownRecord[] : [];
  const depotValueSeries = rawValuations
    .map((row) => ({ date: asText(row.date, ""), marketValueCHF: firstNumber(row.marketValue) }))
    .filter((row): row is { date: string; marketValueCHF: number } => Boolean(row.date) && row.marketValueCHF !== null);

  const rawDailySeries = Array.isArray(performance.dailySeries) && performance.dailySeries.length > 0
    ? performance.dailySeries as UnknownRecord[]
    : (input.fallbackIndexedSeries ?? []).map((point) => ({
      date: point.date,
      // Der sichtbare historische Chart liefert Prozentpunkte (z.B. 24.7),
      // während das Performance-Ledger Dezimalrenditen führt (z.B. 0.247).
      cumulativeReturn: (firstNumber(point.portfolioInclCash, point.portfolio) ?? 0) / 100,
    }));
  const indexedReturnSeries = rawDailySeries
    .map((row) => ({ date: asText(row.date, ""), cumulativeReturnPct: firstNumber(row.cumulativeReturn) }))
    .filter((row): row is { date: string; cumulativeReturnPct: number } => Boolean(row.date) && row.cumulativeReturnPct !== null)
    .map((row) => ({ ...row, cumulativeReturnPct: row.cumulativeReturnPct * 100 }));

  const dataQualityNotes: string[] = [];
  for (const position of positions) {
    if (position.dataStatus !== "OK") dataQualityNotes.push(`${position.ticker}: ${position.dataStatus}.`);
    if (position.returnDataStatus !== "OK") dataQualityNotes.push(`${position.ticker}: Einstandsdaten fehlen; «seit Kauf» wird nicht ausgewiesen.`);
  }
  const unpricedTickers = Array.isArray(performance.unpricedTickers) ? performance.unpricedTickers.filter((ticker): ticker is string => typeof ticker === "string") : [];
  if (unpricedTickers.length > 0) dataQualityNotes.push(`Keine historische Kursreihe im ausgewählten Zeitraum: ${unpricedTickers.join(", ")}.`);
  const warningCount = Array.isArray(performance.dataQualityWarnings) ? performance.dataQualityWarnings.length : 0;
  if (warningCount > 0) dataQualityNotes.push(`${warningCount} auffällige Tagesrendite(n) sind im Performance-Ledger markiert.`);
  if (depotValueSeries.length < 2 && indexedReturnSeries.length >= 2) {
    dataQualityNotes.push("Die grafische Depotentwicklung ist als indexierter, gewichteter Renditeverlauf ausgewiesen, weil keine vollständige historische CHF-Wertreihe vorliegt; sie ist keine rückwirkend ausgeführte Transaktionshistorie.");
  }

  return {
    title: asText(portfolio.name, "Portfolio"),
    portfolioId: firstNumber(portfolio.id) ?? 0,
    asOf,
    asOfLabel: formatAsOf(asOf),
    periodLabel: input.periodLabel ?? "YTD",
    referenceCurrency: input.referenceCurrency ?? "CHF",
    isLive: portfolio.isLive === 1 || portfolio.isLive === true,
    summary,
    kpis: buildKpis(summary, performance, input.risk),
    positions,
    sectorAllocation,
    depotValueSeries,
    indexedReturnSeries,
    depotValueSeriesKind: depotValueSeries.length >= 2 ? "actual" : indexedReturnSeries.length >= 2 ? "indexed" : "unavailable",
    dataQualityNotes,
  };
}

export function portfolioExportFilenameStem(model: PortfolioExportModel): string {
  const safeName = model.title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "portfolio";
  const date = model.asOf.toISOString().slice(0, 10);
  return `${safeName}-${date}`;
}
