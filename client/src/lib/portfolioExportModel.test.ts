import { describe, expect, it } from "vitest";
import { buildPortfolioExportModel } from "./portfolioExportModel";

describe("buildPortfolioExportModel", () => {
  const base = {
    portfolio: {
      id: 7,
      name: "Beispiel Depot",
      totalValueCHF: 250_000,
      cashBalance: 25_000,
      investmentAmount: 240_000,
      avgDividendYield: 2.8,
      isLive: 1,
    },
    holdings: [
      {
        ticker: "NOVN.SW",
        companyName: "Novartis AG",
        isin: "CH0012032048",
        sector: "Healthcare",
        currency: "CHF",
        shares: 100,
        currentPriceLocal: 102,
        valueCHF: 10_200,
        weight: 4.08,
        ytdPerformance: 8.4,
        totalReturn: 12.1,
      },
    ],
    performance: {
      ttwror: 0.052,
      annualizedTtwror: 0.052,
      irr: 0.049,
      absoluteGainCHF: 10_000,
      currentValueCHF: 250_000,
      totalInvestedCHF: 240_000,
      periodDays: 250,
      dailySeries: [
        { date: "2026-01-02", cumulativeReturn: 0 },
        { date: "2026-01-05", cumulativeReturn: 0.012 },
      ],
      dailyValuations: [
        { date: "2026-01-02", marketValue: 240_000 },
        { date: "2026-01-05", marketValue: 242_880 },
      ],
      unpricedTickers: [],
      dataQualityWarnings: [],
    },
    risk: {
      dataAvailable: true,
      sharpeRatio: 1.24,
      volatility: 12.5,
      maxDrawdown: -8.3,
      var95: -1.8,
      concentrationTop3: 38,
      riskSeriesMethod: "demo_fixed_shares_including_cash",
      riskWindowStart: "2026-01-02",
      riskWindowEnd: "2026-01-05",
      drawdownPeakDate: "2026-01-03",
      drawdownTroughDate: "2026-01-04",
      drawdownSeries: [
        { date: "2026-01-02", portfolioValueCHF: 100_000, runningPeakCHF: 100_000, drawdownPct: 0 },
        { date: "2026-01-03", portfolioValueCHF: 110_000, runningPeakCHF: 110_000, drawdownPct: 0 },
        { date: "2026-01-04", portfolioValueCHF: 102_740, runningPeakCHF: 110_000, drawdownPct: -6.6 },
        { date: "2026-01-05", portfolioValueCHF: 114_000, runningPeakCHF: 114_000, drawdownPct: 0 },
      ],
    },
    referenceCurrency: "CHF",
    asOf: new Date("2026-09-07T10:30:00.000Z"),
    periodLabel: "YTD",
  };

  it("übernimmt den Gesamtwert unverändert und zählt die bereits enthaltene Liquidität nicht doppelt", () => {
    const model = buildPortfolioExportModel(base);

    expect(model.summary.currentValueCHF).toBe(250_000);
    expect(model.summary.cashBalanceCHF).toBe(25_000);
    expect(model.summary.cashWeightPct).toBeCloseTo(10, 8);
    expect(model.kpis.find((kpi) => kpi.key === "current_value")?.value).toBe(250_000);
    expect(model.kpis.find((kpi) => kpi.key === "cash")?.definition).toContain("bereits im Depotwert enthalten");
  });

  it("liefert eine vollständige Titelliste samt Kennzahlen und eine echte CHF-Wertreihe für den Bericht", () => {
    const model = buildPortfolioExportModel(base);

    expect(model.positions).toEqual([
      expect.objectContaining({
        ticker: "NOVN.SW",
        companyName: "Novartis AG",
        isin: "CH0012032048",
        marketValueCHF: 10_200,
        portfolioWeightPct: 4.08,
      }),
    ]);
    expect(model.depotValueSeries).toEqual([
      { date: "2026-01-02", marketValueCHF: 240_000 },
      { date: "2026-01-05", marketValueCHF: 242_880 },
    ]);
    expect(model.depotValueSeriesKind).toBe("actual");
    expect(model.kpis).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "ttwror", value: 0.052 }),
      expect.objectContaining({ key: "sharpe", value: 1.24 }),
    ]));
  });

  it("übernimmt vorhandene Risikokennzahlen auch dann, wenn der Dashboardvertrag kein dataAvailable-Flag liefert", () => {
    const model = buildPortfolioExportModel({
      ...base,
      risk: {
        sharpeRatio: -0.09,
        volatility: 13,
        maxDrawdown: -11.2,
      },
    });

    expect(model.kpis).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "sharpe", value: -0.09 }),
      expect.objectContaining({ key: "max_drawdown", value: -11.2 }),
    ]));
  });

  it("übernimmt die tägliche Drawdown-Reihe als prüfbaren Excel-Nachweis", () => {
    const model = buildPortfolioExportModel(base);

    expect(model.drawdown).toMatchObject({
      method: "demo_fixed_shares_including_cash",
      windowStart: "2026-01-02",
      windowEnd: "2026-01-05",
      peakDate: "2026-01-03",
      troughDate: "2026-01-04",
      points: expect.arrayContaining([
        expect.objectContaining({ date: "2026-01-04", runningPeakCHF: 110_000, drawdownPct: -6.6 }),
      ]),
    });
  });

  it("weist fehlende Kurs- oder Wechselkurswerte als Datenlücke aus statt sie als Wert null zu behaupten", () => {
    const model = buildPortfolioExportModel({
      ...base,
      holdings: [{
        ticker: "MISSING.US",
        companyName: "Unvollständiger Titel",
        currency: "USD",
        shares: 10,
        valueCHF: 0,
        weight: 0,
        priceMissing: true,
        fxMissing: true,
      }],
      performance: {
        ...base.performance,
        dailyValuations: [],
        unpricedTickers: ["MISSING.US"],
      },
    });

    expect(model.positions[0]).toMatchObject({
      ticker: "MISSING.US",
      marketValueCHF: null,
      dataStatus: "Kurs- und Wechselkursdaten fehlen",
    });
    expect(model.dataQualityNotes).toEqual(expect.arrayContaining([
      expect.stringContaining("MISSING.US"),
    ]));
  });

  it("weist fehlende echte Einstandsdaten statt einer künstlichen 0%-Rendite aus", () => {
    const model = buildPortfolioExportModel({
      ...base,
      holdings: [{
        ticker: "PLAN.SW",
        companyName: "Planungsposition",
        currency: "CHF",
        shares: 100,
        currentPriceLocal: 100,
        valueCHF: 10_000,
        weight: 4,
        ytdPerformance: 8.4,
        totalReturn: 0,
        hasBuyPrice: false,
      }],
    });

    expect(model.positions[0]).toMatchObject({
      ticker: "PLAN.SW",
      marketValueCHF: 10_000,
      totalReturnPct: null,
      returnDataStatus: "Einstandsdaten fehlen",
    });
    expect(model.dataQualityNotes).toEqual(expect.arrayContaining([
      "PLAN.SW: Einstandsdaten fehlen; «seit Kauf» wird nicht ausgewiesen.",
    ]));
  });

  it("kennzeichnet den gewichteten Demo-Chart transparent als indexierten statt als historischen CHF-Depotwert", () => {
    const model = buildPortfolioExportModel({
      ...base,
      performance: { ...base.performance, dailySeries: [], dailyValuations: [] },
      fallbackIndexedSeries: [
        { date: "2026-01-02", portfolio: 0 },
        { date: "2026-01-05", portfolio: 1.2 },
      ],
    });

    expect(model.depotValueSeriesKind).toBe("indexed");
    expect(model.indexedReturnSeries).toEqual([
      { date: "2026-01-02", cumulativeReturnPct: 0 },
      { date: "2026-01-05", cumulativeReturnPct: 1.2 },
    ]);
    expect(model.dataQualityNotes).toEqual(expect.arrayContaining([
      expect.stringContaining("keine rückwirkend ausgeführte Transaktionshistorie"),
    ]));
  });

  it("gibt bestätigte Einstandsangaben und zusätzliche Positionskennzahlen an die Exporte weiter", () => {
    const model = buildPortfolioExportModel({
      ...base,
      holdings: [{
        ...base.holdings[0],
        entryDate: "2026-01-02",
        entryBasisLabel: "Einstand bestätigt",
        dividendYield: 3.2,
        peRatio: 18.4,
        volatility5y: 21.5,
      }],
    });

    expect(model.positions[0]).toMatchObject({
      entryDate: "2026-01-02",
      entryBasisLabel: "Einstand bestätigt",
      dividendYieldPct: 3.2,
      peRatio: 18.4,
      volatility5yPct: 21.5,
    });
  });

  it("bildet YTD- und Fünfjahresvergleiche mit SPI und S&P 500 ab", () => {
    const model = buildPortfolioExportModel({
      ...base,
      portfolio: { ...base.portfolio, createdAt: "2026-01-02" },
      benchmarkComparisonInputs: [{
        key: "ytd",
        label: "YTD",
        method: "Vergleichsmethode",
        chartData: [
          { date: "2026-01-02", portfolio: 0, benchmark: 0 },
          { date: "2026-01-05", portfolio: 1.2, benchmark: 0.8 },
        ],
        sp500ChartData: [
          { date: "2026-01-02", benchmark: 0 },
          { date: "2026-01-05", benchmark: 1.1 },
        ],
      }],
    });

    expect(model.benchmarkComparisons).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "portfolio_start", points: expect.any(Array) }),
      expect.objectContaining({
        key: "ytd",
        points: expect.arrayContaining([
          expect.objectContaining({ date: "2026-01-05", portfolioReturnPct: 1.2, spiReturnPct: 0.8, sp500ReturnPct: 1.1 }),
        ]),
      }),
    ]));
  });

  it("rebasiert den Vergleich seit Portfolio-Start auf den ersten gemeinsamen Handelstag", () => {
    const model = buildPortfolioExportModel({
      ...base,
      benchmarkComparisonInputs: [{
        key: "portfolio_start",
        label: "Seit Portfolio-Start",
        startDate: "2026-01-03",
        method: "Startvergleich",
        chartData: [
          { date: "2026-01-02", portfolio: -2, benchmark: 3 },
          { date: "2026-01-03", portfolio: 4, benchmark: 5 },
          { date: "2026-01-04", portfolio: 6.5, benchmark: 6 },
        ],
        sp500ChartData: [
          { date: "2026-01-03", benchmark: 7 },
          { date: "2026-01-04", benchmark: 8.5 },
        ],
      }],
    });

    expect(model.benchmarkComparisons).toContainEqual(expect.objectContaining({
      key: "portfolio_start",
      points: [
        { date: "2026-01-03", portfolioReturnPct: 0, spiReturnPct: 0, sp500ReturnPct: 0 },
        { date: "2026-01-04", portfolioReturnPct: 2.5, spiReturnPct: 1, sp500ReturnPct: 1.5 },
      ],
    }));
  });

  it("gibt Fünfjahres-Gate, Proxy-Status und Krisennachweis an den Export weiter", () => {
    const model = buildPortfolioExportModel({
      ...base,
      risk: {
        ...base.risk,
        maxDrawdown: null,
        riskWindowStatus: "insufficient_history",
        riskWindowTarget: "5Y",
        riskHistoryYears: 3.41,
        riskProxyType: "historical_allocation_proxy_not_actual_depot_history",
        coverage: {
          qualifiedObservationCount: 552,
          requiredObservationCount: 1000,
          complete: false,
          benchmarkOutlierCount: 1,
          issues: [{ key: "ISRG", kind: "price" }],
        },
        stressEvidence: {
          qualified: false,
          benchmark: "SPI (Swiss Performance Index)",
          requiredDrawdownPct: -15,
          observedDrawdownPct: -18.2,
          peakDate: "2022-01-04",
          troughDate: "2022-10-03",
        },
        drawdownSeries: [],
      },
    });

    expect(model.drawdown).toMatchObject({
      status: "insufficient_history",
      target: "5Y",
      proxyType: "historical_allocation_proxy_not_actual_depot_history",
      coverage: expect.objectContaining({ qualifiedObservationCount: 552, complete: false, benchmarkOutlierCount: 1 }),
      stressEvidence: expect.objectContaining({ benchmark: "SPI (Swiss Performance Index)", qualified: false }),
    });
    expect(model.kpis.find((kpi) => kpi.key === "max_drawdown")?.value).toBeNull();
    expect(model.dataQualityNotes).toEqual(expect.arrayContaining([
      expect.stringContaining("ISRG"),
      expect.stringContaining("kein verkürzter Ersatzwert"),
      expect.stringContaining("Benchmark-Massstabsbrüche"),
    ]));
  });
});
