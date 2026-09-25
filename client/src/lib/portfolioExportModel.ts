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
  entryDate: string | null;
  entryBasisLabel: string | null;
  dividendYieldPct: number | null;
  peRatio: number | null;
  volatility5yPct: number | null;
  volatility5yDataQuality: string | null;
  volatility5yBasis: string | null;
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

export type PortfolioDrawdownExportPoint = {
  date: string;
  portfolioValueCHF: number;
  runningPeakCHF: number;
  drawdownPct: number;
};

export type PortfolioRiskCoverageExport = {
  qualifiedObservationCount: number | null;
  requiredObservationCount: number | null;
  complete: boolean | null;
  benchmarkOutlierCount: number | null;
  issues: Array<{ key: string; kind: "price" | "fx" }>;
};

export type PortfolioStressEvidenceExport = {
  qualified: boolean | null;
  benchmark: string | null;
  requiredDrawdownPct: number | null;
  observedDrawdownPct: number | null;
  peakDate: string | null;
  troughDate: string | null;
};

export type PortfolioDrawdownExport = {
  method: string | null;
  status: string | null;
  target: string | null;
  historyYears: number | null;
  proxyType: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  peakDate: string | null;
  troughDate: string | null;
  coverage: PortfolioRiskCoverageExport;
  stressEvidence: PortfolioStressEvidenceExport;
  points: PortfolioDrawdownExportPoint[];
};

export type PortfolioBenchmarkComparisonPoint = {
  date: string;
  portfolioReturnPct: number | null;
  spiReturnPct: number | null;
  sp500ReturnPct: number | null;
};

export type PortfolioBenchmarkComparison = {
  key: "portfolio_start" | "ytd" | "five_year";
  label: string;
  method: string;
  points: PortfolioBenchmarkComparisonPoint[];
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
  drawdown: PortfolioDrawdownExport;
  benchmarkComparisons: PortfolioBenchmarkComparison[];
  dataQualityNotes: string[];
};

type UnknownRecord = Record<string, unknown>;

export type BuildPortfolioExportModelInput = {
  portfolio: UnknownRecord;
  holdings: UnknownRecord[];
  performance?: UnknownRecord | null;
  risk?: UnknownRecord | null;
  fallbackIndexedSeries?: UnknownRecord[];
  benchmarkComparisonInputs?: Array<{
    key: "portfolio_start" | "ytd" | "five_year";
    label: string;
    chartData: UnknownRecord[];
    sp500ChartData?: UnknownRecord[];
    method: string;
    /** Beschränkt die Vergleichsreihe und setzt sie zum Startdatum auf 0 % zurück. */
    startDate?: string | Date | null;
  }>;
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

function asDateText(value: unknown, fallback = ""): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = asText(value, fallback);
  return text ? text.slice(0, 10) : fallback;
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
    {
      key: "max_drawdown",
      label: risk?.riskWindowTarget === "5Y" ? "Max. Drawdown (5J)" : "Max. Drawdown",
      value: riskAvailable ? firstNumber(risk?.maxDrawdown) : null,
      unit: "percent",
      definition: risk?.riskWindowTarget === "5Y"
        ? "Grösster beobachteter Rückgang vom vorherigen Höchststand im qualifizierten Fünfjahresfenster mit objektivem Benchmark-Stressnachweis."
        : "Grösster beobachteter prozentualer Rückgang vom vorherigen Höchststand.",
    },
    { key: "dividend_yield", label: "Ø Dividendenrendite", value: summary.avgDividendYieldPct, unit: "percent", definition: "Gewichtete, aktuell gespeicherte Dividendenrendite der Positionen; kein garantierter Ertrag." },
  ];
}

function buildBenchmarkComparison(input: NonNullable<BuildPortfolioExportModelInput["benchmarkComparisonInputs"]>[number]): PortfolioBenchmarkComparison {
  const sp500ByDate = new Map(
    (input.sp500ChartData ?? [])
      .map((row) => [asText(row.date, ""), firstNumber(row.benchmark)] as const)
      .filter(([date, value]) => Boolean(date) && value !== null) as Array<[string, number]>,
  );
  const startDate = asDateText(input.startDate);
  const rawPoints = input.chartData
    .map((row): PortfolioBenchmarkComparisonPoint | null => {
      const date = asText(row.date, "");
      const portfolioReturnPct = firstNumber(row.portfolio);
      if (!date || portfolioReturnPct === null) return null;
      return {
        date,
        portfolioReturnPct,
        spiReturnPct: firstNumber(row.benchmark),
        sp500ReturnPct: sp500ByDate.get(date) ?? null,
      };
    })
    .filter((point): point is PortfolioBenchmarkComparisonPoint => point !== null)
    .filter((point) => !startDate || point.date >= startDate);
  const basePortfolio = startDate ? rawPoints.find((point) => point.portfolioReturnPct !== null)?.portfolioReturnPct ?? null : null;
  const baseSpi = startDate ? rawPoints.find((point) => point.spiReturnPct !== null)?.spiReturnPct ?? null : null;
  const baseSp500 = startDate ? rawPoints.find((point) => point.sp500ReturnPct !== null)?.sp500ReturnPct ?? null : null;
  const points = rawPoints.map((point) => ({
    ...point,
    portfolioReturnPct: basePortfolio === null || point.portfolioReturnPct === null ? point.portfolioReturnPct : point.portfolioReturnPct - basePortfolio,
    spiReturnPct: baseSpi === null || point.spiReturnPct === null ? point.spiReturnPct : point.spiReturnPct - baseSpi,
    sp500ReturnPct: baseSp500 === null || point.sp500ReturnPct === null ? point.sp500ReturnPct : point.sp500ReturnPct - baseSp500,
  }));
  return { key: input.key, label: input.label, method: input.method, points };
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
        entryDate: typeof holding.entryDate === "string" && holding.entryDate.trim() ? holding.entryDate.trim().slice(0, 10) : null,
        entryBasisLabel: typeof holding.entryBasisLabel === "string" && holding.entryBasisLabel.trim() ? holding.entryBasisLabel.trim() : null,
        dividendYieldPct: firstNumber(holding.dividendYield),
        peRatio: firstNumber(holding.peRatio),
        volatility5yPct: firstNumber(holding.volatility5y),
        volatility5yDataQuality: typeof holding.volatility5yDataQuality === "string" ? holding.volatility5yDataQuality : null,
        volatility5yBasis: typeof holding.volatility5yBasis === "string" ? holding.volatility5yBasis : null,
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

  const rawDrawdownPoints = Array.isArray(input.risk?.drawdownSeries)
    ? input.risk.drawdownSeries as UnknownRecord[]
    : [];
  const drawdownPoints = rawDrawdownPoints
    .map((point): PortfolioDrawdownExportPoint | null => {
      const date = asText(point.date, "");
      const portfolioValueCHF = firstNumber(point.portfolioValueCHF);
      const runningPeakCHF = firstNumber(point.runningPeakCHF);
      const drawdownPct = firstNumber(point.drawdownPct);
      if (!date || portfolioValueCHF === null || runningPeakCHF === null || drawdownPct === null) return null;
      return { date, portfolioValueCHF, runningPeakCHF, drawdownPct };
    })
    .filter((point): point is PortfolioDrawdownExportPoint => point !== null);
  const drawdown: PortfolioDrawdownExport = {
    method: typeof input.risk?.riskSeriesMethod === "string" ? input.risk.riskSeriesMethod : null,
    status: typeof input.risk?.riskWindowStatus === "string" ? input.risk.riskWindowStatus : null,
    target: typeof input.risk?.riskWindowTarget === "string" ? input.risk.riskWindowTarget : null,
    historyYears: firstNumber(input.risk?.riskHistoryYears),
    proxyType: typeof input.risk?.riskProxyType === "string" ? input.risk.riskProxyType : null,
    windowStart: typeof input.risk?.riskWindowStart === "string" ? input.risk.riskWindowStart : null,
    windowEnd: typeof input.risk?.riskWindowEnd === "string" ? input.risk.riskWindowEnd : null,
    peakDate: typeof input.risk?.drawdownPeakDate === "string" ? input.risk.drawdownPeakDate : null,
    troughDate: typeof input.risk?.drawdownTroughDate === "string" ? input.risk.drawdownTroughDate : null,
    coverage: {
      qualifiedObservationCount: firstNumber((input.risk?.coverage as UnknownRecord | undefined)?.qualifiedObservationCount),
      requiredObservationCount: firstNumber((input.risk?.coverage as UnknownRecord | undefined)?.requiredObservationCount),
      complete: typeof (input.risk?.coverage as UnknownRecord | undefined)?.complete === "boolean"
        ? (input.risk?.coverage as UnknownRecord).complete as boolean
        : null,
      benchmarkOutlierCount: firstNumber((input.risk?.coverage as UnknownRecord | undefined)?.benchmarkOutlierCount),
      issues: Array.isArray((input.risk?.coverage as UnknownRecord | undefined)?.issues)
        ? ((input.risk?.coverage as UnknownRecord).issues as UnknownRecord[])
          .map((issue) => ({
            key: typeof issue.key === "string" ? issue.key : "",
            kind: issue.kind === "fx" ? "fx" as const : "price" as const,
          }))
          .filter((issue) => Boolean(issue.key))
        : [],
    },
    stressEvidence: {
      qualified: typeof (input.risk?.stressEvidence as UnknownRecord | undefined)?.qualified === "boolean"
        ? (input.risk?.stressEvidence as UnknownRecord).qualified as boolean
        : null,
      benchmark: typeof (input.risk?.stressEvidence as UnknownRecord | undefined)?.benchmark === "string"
        ? (input.risk?.stressEvidence as UnknownRecord).benchmark as string
        : null,
      requiredDrawdownPct: firstNumber((input.risk?.stressEvidence as UnknownRecord | undefined)?.requiredDrawdownPct),
      observedDrawdownPct: firstNumber((input.risk?.stressEvidence as UnknownRecord | undefined)?.observedDrawdownPct),
      peakDate: typeof (input.risk?.stressEvidence as UnknownRecord | undefined)?.peakDate === "string"
        ? (input.risk?.stressEvidence as UnknownRecord).peakDate as string
        : null,
      troughDate: typeof (input.risk?.stressEvidence as UnknownRecord | undefined)?.troughDate === "string"
        ? (input.risk?.stressEvidence as UnknownRecord).troughDate as string
        : null,
    },
    points: drawdownPoints,
  };

  const portfolioStartDate = asDateText(portfolio.liveStartDate, asDateText(portfolio.createdAt));
  const portfolioStartReturnPct = summary.totalInvestedCHF && summary.totalInvestedCHF > 0
    ? ((summary.currentValueCHF - summary.totalInvestedCHF) / summary.totalInvestedCHF) * 100
    : null;
  const benchmarkComparisons: PortfolioBenchmarkComparison[] = [];
  const hasPortfolioStartSeries = (input.benchmarkComparisonInputs ?? []).some((comparison) => comparison.key === "portfolio_start");
  if (portfolioStartDate && portfolioStartReturnPct !== null && !hasPortfolioStartSeries) {
    benchmarkComparisons.push({
      key: "portfolio_start",
      label: "Seit Portfolio-Start",
      method: "Start-/Endwert: Gesamtdepot inkl. Liquidität gegen die dokumentierte Kapitalbasis; keine behauptete Einzelpositions-Transaktionsreihe.",
      points: [
        { date: portfolioStartDate.slice(0, 10), portfolioReturnPct: 0, spiReturnPct: null, sp500ReturnPct: null },
        { date: asOf.toISOString().slice(0, 10), portfolioReturnPct: portfolioStartReturnPct, spiReturnPct: null, sp500ReturnPct: null },
      ],
    });
  }
  for (const comparisonInput of input.benchmarkComparisonInputs ?? []) {
    const comparison = buildBenchmarkComparison(comparisonInput);
    if (comparison.points.length >= 2) benchmarkComparisons.push(comparison);
  }

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
  if (drawdown.points.length < 2) {
    dataQualityNotes.push("Für die Max.-Drawdown-Herleitung liegt keine ausreichende tägliche Risikoreihe vor.");
  }
  if (drawdown.status && drawdown.status !== "five_year_with_stress") {
    dataQualityNotes.push("Der Max.-Drawdown wird nicht ausgewiesen: kein verkürzter Ersatzwert bei nicht erfülltem Fünfjahres-/Stress-Gate.");
  }
  if (drawdown.proxyType === "historical_allocation_proxy_not_actual_depot_history") {
    dataQualityNotes.push("Die Risikoreihe ist ein historischer Allokationsproxy mit heutigen festen Stückzahlen und konstanter Cash-Reserve; sie ist keine tatsächliche Depot- oder Transaktionshistorie vor Portfolio-Start.");
  }
  if (drawdown.coverage.issues.length > 0) {
    dataQualityNotes.push(`Fehlende Fünfjahresabdeckung: ${drawdown.coverage.issues.map((issue) => `${issue.key}${issue.kind === "fx" ? " (FX)" : ""}`).join(", ")}.`);
  }
  if ((drawdown.coverage.benchmarkOutlierCount ?? 0) > 0) {
    dataQualityNotes.push(`${drawdown.coverage.benchmarkOutlierCount} isolierte Benchmark-Massstabsbrüche wurden als Datenlücke ausgeschlossen; keine Quellzeile wurde verändert.`);
  }
  if (benchmarkComparisons.some((comparison) => comparison.key === "portfolio_start")) {
    dataQualityNotes.push("«Seit Portfolio-Start» zeigt Start- und aktuellen Gesamtwert inkl. Liquidität. Einzelpositionsrenditen bleiben ohne bestätigten Einstand separat als Datenlücke ausgewiesen.");
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
    drawdown,
    benchmarkComparisons,
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
