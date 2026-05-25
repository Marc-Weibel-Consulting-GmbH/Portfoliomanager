// Shared types for the dashboard subsystem.
// Every server endpoint listed in dashboardRouter.additions.ts MUST return
// data in exactly the shape declared here — these types are the contract.

export type ScopeId = "aggregate" | number; // number = portfolioId

export type RangeKey = "1T" | "1M" | "YTD" | "1J" | "3J" | "5J" | "Max";

export interface AggregatedMetrics {
  // Existing fields (already returned by dashboard.getAggregatedMetrics)
  totalValue: number;                  // CHF
  totalInvested: number;               // CHF
  totalPerformance: number;            // CHF
  totalPerformancePercent: number;     // YTD %
  totalDividends: number;              // CHF YTD
  portfolioCount: number;
  livePortfolioCount: number;
  benchmarkPerformance: number;        // SPY YTD %, used as fallback if SMI/MSCI not available
  avgDividendYield: number;            // %

  // New fields — required for the redesigned dashboard
  // (will need to be added to dashboard.getAggregatedMetrics)
  dayChange?: number;                  // CHF — today's portfolio delta
  dayChangePercent?: number;           // %
  totalReturnPercent?: number;         // since-inception % (across all portfolios)
  benchmarkSmiYtd?: number;            // %
  benchmarkMsciYtd?: number;           // %
}

export interface TimeseriesPoint {
  label: string;                       // e.g. "Jan", "Feb" or ISO date
  portfolio: number;                   // % return from base
  smi: number;
  msci: number;
}

export interface PerformanceTimeseries {
  range: RangeKey;
  scope: ScopeId;
  points: TimeseriesPoint[];
}

export interface Holding {
  ticker: string;
  name: string;
  sector: string;
  region: "CH" | "US" | "EU" | "Other";
  weight: number;                      // %
  value: number;                       // CHF
  shares: number;
  currentPrice: number;
  currency: string;
  change1d: number;                    // %
  ytd: number;                         // %
  dividendYield?: number;              // %
  /**
   * Display color used by treemap/constellation. Server may set it based on
   * sector, or client falls back to SECTOR_COLOR[holding.sector].
   */
  color?: string;
}

export interface SectorBucket {
  name: string;
  weight: number;                      // %
  ytd: number;                         // weighted average YTD %
  color: string;
}

export interface RegionBucket {
  name: string;
  weight: number;                      // %
  color: string;
}

export interface RiskMetrics {
  volatility: number;                  // annualized %
  volBenchmark: number;
  maxDrawdown: number;                 // %
  drawdownBenchmark: number;
  var95: number;                       // daily VaR at 95%
  concentrationTop3: number;           // % weight in top 3 holdings
  sharpeRatio: number;
  beta: number;
}

export interface BubbleIndicator {
  score: number;                       // 0..100
  label: "Niedrig" | "Mittel" | "Hoch";
  history: number[];                   // last 8 weekly readings, oldest first
  interpretation: string;              // short German sentence
}

export interface CopilotInsight {
  id: string;
  severity: "positive" | "watch" | "info";
  title: string;
  body: string;
  action: string;                      // CTA label
  actionHref?: string;                 // optional deep link (e.g. /portfolio-optimizer)
}
