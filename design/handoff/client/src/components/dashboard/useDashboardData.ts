// Central data hook for the redesigned dashboard. ONE place that calls
// every backend endpoint the dashboard needs. Components only ever read
// from useDashboardData — they don't touch tRPC directly. That keeps the
// data layer easy to change later (cache, prefetch, swap mock for real, …).
//
// Strategy: while the new endpoints are still in flight, every query is
// either (a) optional with `enabled: false` until the endpoint exists, or
// (b) falls back to MOCK_* from mockData.ts. Once a real endpoint lands,
// drop its mock fallback and flip `enabled: true`.

import { trpc } from "@/lib/trpc";
import type {
  AggregatedMetrics,
  PerformanceTimeseries,
  Holding,
  SectorBucket,
  RegionBucket,
  RiskMetrics,
  BubbleIndicator,
  CopilotInsight,
  RangeKey,
  ScopeId,
} from "./types";
import {
  MOCK_METRICS,
  MOCK_PERFORMANCE,
  MOCK_HOLDINGS,
  MOCK_SECTORS,
  MOCK_REGIONS,
  MOCK_RISK,
  MOCK_BUBBLE,
  MOCK_INSIGHTS,
} from "./mockData";

interface UseDashboardDataParams {
  scope: ScopeId;
  range: RangeKey;
}

export interface DashboardData {
  metrics: AggregatedMetrics;
  performance: PerformanceTimeseries;
  holdings: Holding[];
  sectors: SectorBucket[];
  regions: RegionBucket[];
  risk: RiskMetrics;
  bubble: BubbleIndicator;
  insights: CopilotInsight[];
  portfolios: { id: number; name: string; isLive: boolean }[];
  isLoading: boolean;
}

export function useDashboardData({ scope, range }: UseDashboardDataParams): DashboardData {
  // ───── Existing endpoints ─────────────────────────────────────────────
  // These already live in dashboardRouter.ts and just need the new
  // fields (dayChange, totalReturnPercent, benchmarkMsciYtd) appended.
  const { data: rawMetrics, isLoading: metricsLoading } =
    trpc.dashboard.getAggregatedMetrics.useQuery();

  const { data: rawPortfolios } = trpc.dashboard.getTopPortfolios.useQuery();

  // ───── New endpoints (see server/routers/dashboardRouter.additions.ts) ─
  // Each query stays disabled until its endpoint exists on the server.
  // Manus: when you add the endpoint, flip `enabled: true` and remove the
  // matching `?? MOCK_*` fallback below.

  // const { data: rawPerformance } =
  //   trpc.dashboard.getPerformanceTimeseries.useQuery({ scope, range }, { enabled: true });
  // const { data: rawHoldings } =
  //   trpc.dashboard.getAggregatedHoldings.useQuery({ scope }, { enabled: true });
  // const { data: rawSectors } =
  //   trpc.dashboard.getSectorAllocation.useQuery({ scope }, { enabled: true });
  // const { data: rawRegions } =
  //   trpc.dashboard.getRegionAllocation.useQuery({ scope }, { enabled: true });
  // const { data: rawRisk } =
  //   trpc.dashboard.getRiskMetrics.useQuery({ scope }, { enabled: true });
  // const { data: rawBubble } =
  //   trpc.dashboard.getBubbleIndicator.useQuery({ scope }, { enabled: true });
  // const { data: rawInsights } =
  //   trpc.dashboard.getCopilotInsights.useQuery({ scope }, { enabled: true });

  const rawPerformance: PerformanceTimeseries | undefined = undefined;
  const rawHoldings: Holding[] | undefined = undefined;
  const rawSectors: SectorBucket[] | undefined = undefined;
  const rawRegions: RegionBucket[] | undefined = undefined;
  const rawRisk: RiskMetrics | undefined = undefined;
  const rawBubble: BubbleIndicator | undefined = undefined;
  const rawInsights: CopilotInsight[] | undefined = undefined;

  // Merge: real metrics where available, mock for missing fields.
  // The new dashboard expects fields like `dayChange` and
  // `totalReturnPercent` which the current endpoint doesn't return yet.
  const metrics: AggregatedMetrics = {
    ...MOCK_METRICS,
    ...(rawMetrics ?? {}),
  };

  return {
    metrics,
    performance: rawPerformance ?? MOCK_PERFORMANCE,
    holdings: rawHoldings ?? MOCK_HOLDINGS,
    sectors: rawSectors ?? MOCK_SECTORS,
    regions: rawRegions ?? MOCK_REGIONS,
    risk: rawRisk ?? MOCK_RISK,
    bubble: rawBubble ?? MOCK_BUBBLE,
    insights: rawInsights ?? MOCK_INSIGHTS,
    portfolios: (rawPortfolios ?? []).map(p => ({
      id: p.id,
      name: p.name,
      isLive: !!p.isLive,
    })),
    isLoading: metricsLoading,
  };
}
