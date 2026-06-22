// Mock data — used by useDashboardData.ts as fallback while the new tRPC
// endpoints are still being built on the server. Delete this file (and the
// `?? MOCK_*` fallbacks in useDashboardData.ts) once everything is wired up.

import type {
  AggregatedMetrics,
  PerformanceTimeseries,
  Holding,
  SectorBucket,
  RegionBucket,
  RiskMetrics,
  BubbleIndicator,
  CopilotInsight,
} from "./types";
import { SECTOR_COLOR, REGION_COLOR } from "./format";

export const MOCK_METRICS: AggregatedMetrics = {
  totalValue: 487_650,
  totalInvested: 341_550,
  totalPerformance: 146_100,
  totalPerformancePercent: 11.4,
  totalDividends: 8_920,
  portfolioCount: 3,
  livePortfolioCount: 2,
  benchmarkPerformance: 7.6,
  avgDividendYield: 2.3,
  dayChange: 1_834,
  dayChangePercent: 0.38,
  totalReturnPercent: 42.8,
  benchmarkSmiYtd: 7.6,
  benchmarkMsciYtd: 14.2,
};

const TS_LABELS = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

export const MOCK_PERFORMANCE: PerformanceTimeseries = {
  range: "YTD",
  scope: "aggregate",
  points: TS_LABELS.map((label, i) => ({
    label,
    portfolio: [0, 1.2, 2.6, 1.8, 3.4, 4.9, 6.2, 5.4, 7.8, 9.1, 10.6, 11.4][i],
    smi:       [0, 0.8, 1.6, 1.1, 2.0, 2.4, 3.1, 2.6, 4.2, 5.1, 6.8, 7.6][i],
    msci:      [0, 1.4, 3.1, 2.3, 4.1, 5.8, 7.4, 6.9, 9.6, 11.2, 13.0, 14.2][i],
  })),
};

export const MOCK_HOLDINGS: Holding[] = [
  { ticker: "NESN.SW", name: "Nestlé",             sector: "Consumer Staples", region: "CH", weight: 11.8, value: 57_543, shares: 480, currentPrice: 119.88, currency: "CHF", change1d:  0.6, ytd:  4.2, dividendYield: 3.1, color: SECTOR_COLOR["Consumer Staples"] },
  { ticker: "ROG.SW",  name: "Roche",              sector: "Healthcare",       region: "CH", weight: 10.4, value: 50_716, shares: 195, currentPrice: 260.08, currency: "CHF", change1d: -0.3, ytd:  8.9, dividendYield: 3.4, color: SECTOR_COLOR["Healthcare"] },
  { ticker: "NOVN.SW", name: "Novartis",           sector: "Healthcare",       region: "CH", weight:  9.1, value: 44_376, shares: 480, currentPrice:  92.45, currency: "CHF", change1d:  1.2, ytd: 11.7, dividendYield: 3.6, color: SECTOR_COLOR["Healthcare"] },
  { ticker: "ABBN.SW", name: "ABB",                sector: "Industrials",      region: "CH", weight:  7.2, value: 35_111, shares: 580, currentPrice:  60.54, currency: "CHF", change1d:  1.8, ytd: 22.4, dividendYield: 2.0, color: SECTOR_COLOR["Industrials"] },
  { ticker: "ZURN.SW", name: "Zurich Insurance",   sector: "Financials",       region: "CH", weight:  6.8, value: 33_160, shares:  62, currentPrice: 534.84, currency: "CHF", change1d:  0.4, ytd: 14.1, dividendYield: 4.6, color: SECTOR_COLOR["Financials"] },
  { ticker: "UBSG.SW", name: "UBS Group",          sector: "Financials",       region: "CH", weight:  6.1, value: 29_747, shares: 1100,currentPrice:  27.04, currency: "CHF", change1d: -0.8, ytd:  6.3, dividendYield: 2.8, color: SECTOR_COLOR["Financials"] },
  { ticker: "SIKA.SW", name: "Sika",               sector: "Materials",        region: "CH", weight:  5.4, value: 26_333, shares: 110, currentPrice: 239.39, currency: "CHF", change1d:  2.1, ytd: 18.6, dividendYield: 1.4, color: SECTOR_COLOR["Materials"] },
  { ticker: "LOGN.SW", name: "Logitech",           sector: "Tech",             region: "CH", weight:  4.2, value: 20_481, shares: 270, currentPrice:  75.85, currency: "CHF", change1d:  3.4, ytd: 31.2, dividendYield: 1.5, color: SECTOR_COLOR["Tech"] },
  { ticker: "MSFT",    name: "Microsoft",          sector: "Tech",             region: "US", weight:  8.4, value: 40_963, shares: 102, currentPrice: 401.60, currency: "USD", change1d:  0.9, ytd: 19.8, dividendYield: 0.7, color: SECTOR_COLOR["Tech"] },
  { ticker: "AAPL",    name: "Apple",              sector: "Tech",             region: "US", weight:  6.7, value: 32_672, shares: 204, currentPrice: 160.20, currency: "USD", change1d: -0.2, ytd:  7.3, dividendYield: 0.5, color: SECTOR_COLOR["Tech"] },
  { ticker: "ASML.AS", name: "ASML",               sector: "Tech",             region: "EU", weight:  5.3, value: 25_846, shares:  35, currentPrice: 738.45, currency: "EUR", change1d:  1.6, ytd: 12.4, dividendYield: 0.9, color: SECTOR_COLOR["Tech"] },
  { ticker: "BRK.B",   name: "Berkshire Hathaway", sector: "Financials",       region: "US", weight:  4.6, value: 22_432, shares:  62, currentPrice: 361.81, currency: "USD", change1d:  0.1, ytd: 16.2, color: SECTOR_COLOR["Financials"] },
  { ticker: "CASH",    name: "Liquidität",         sector: "Cash",             region: "CH", weight: 14.0, value: 68_269, shares:   0, currentPrice:   1.00, currency: "CHF", change1d:  0.0, ytd:  1.2, color: SECTOR_COLOR["Cash"] },
];

export const MOCK_SECTORS: SectorBucket[] = [
  { name: "Healthcare",       weight: 19.5, ytd: 10.1, color: SECTOR_COLOR["Healthcare"] },
  { name: "Tech",             weight: 24.6, ytd: 16.8, color: SECTOR_COLOR["Tech"] },
  { name: "Financials",       weight: 17.5, ytd: 11.4, color: SECTOR_COLOR["Financials"] },
  { name: "Consumer Staples", weight: 11.8, ytd:  4.2, color: SECTOR_COLOR["Consumer Staples"] },
  { name: "Industrials",      weight:  7.2, ytd: 22.4, color: SECTOR_COLOR["Industrials"] },
  { name: "Materials",        weight:  5.4, ytd: 18.6, color: SECTOR_COLOR["Materials"] },
  { name: "Cash",             weight: 14.0, ytd:  1.2, color: SECTOR_COLOR["Cash"] },
];

export const MOCK_REGIONS: RegionBucket[] = [
  { name: "Schweiz", weight: 61.0, color: REGION_COLOR["Schweiz"] },
  { name: "USA",     weight: 19.7, color: REGION_COLOR["USA"] },
  { name: "Europa",  weight:  5.3, color: REGION_COLOR["Europa"] },
  { name: "Cash",    weight: 14.0, color: REGION_COLOR["Cash"] },
];

export const MOCK_RISK: RiskMetrics = {
  volatility:        13.2,
  volBenchmark:      15.8,
  maxDrawdown:       -8.4,
  drawdownBenchmark: -12.1,
  var95:             -2.4,
  concentrationTop3: 32.1,
  sharpeRatio:        1.38,
  beta:               0.83,
};

export const MOCK_BUBBLE: BubbleIndicator = {
  score: 24,
  label: "Niedrig",
  history: [12, 18, 15, 22, 28, 31, 27, 24],
  interpretation: "Markt zeigt keine Überhitzung. Strategie kann beibehalten werden.",
};

export const MOCK_INSIGHTS: CopilotInsight[] = [
  {
    id: "concentration-healthcare",
    severity: "watch",
    title: "Healthcare-Konzentration hoch",
    body: "Roche + Novartis machen zusammen 19.5% aus. Erwäge eine Reduktion auf 15% für besseren Diversifikationsschutz.",
    action: "Im Optimizer prüfen",
    actionHref: "/portfolio-optimizer",
  },
  {
    id: "sharpe-above-benchmark",
    severity: "positive",
    title: "Sharpe Ratio über Benchmark",
    body: "Dein risikoadjustiertes Rendite (1.38) liegt klar über SMI (1.05). Strategie funktioniert.",
    action: "Detail-Report",
    actionHref: "/analysis",
  },
  {
    id: "cash-opportunity",
    severity: "info",
    title: "Cash-Quote 14% — Gelegenheit?",
    body: "Hohe Liquidität bei moderatem Bubble-Score (24). Staffel-Einstieg in defensive Werte möglich.",
    action: "Vorschläge anzeigen",
    actionHref: "/invest",
  },
];
