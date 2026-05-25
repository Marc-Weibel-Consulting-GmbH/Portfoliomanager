// Central data hook for the redesigned dashboard. ONE place that calls
// every backend endpoint the dashboard needs. Components only ever read
// from useDashboardData — they don't touch tRPC directly.

import { trpc } from "@/lib/trpc";
import { keepPreviousData } from "@tanstack/react-query";
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
  const { data: rawMetrics, isLoading: metricsLoading } =
    trpc.dashboard.getAggregatedMetrics.useQuery();

  const { data: rawPortfolios } = trpc.dashboard.getTopPortfolios.useQuery();

  // ───── New endpoints (real data) ──────────────────────────────────────
  const { data: rawPerformance, isLoading: perfLoading } =
    trpc.dashboard.getPerformanceTimeseries.useQuery(
      { scope, range },
      { placeholderData: keepPreviousData }
    );

  const { data: rawHoldings, isLoading: holdingsLoading } =
    trpc.dashboard.getAggregatedHoldings.useQuery(
      { scope },
      { placeholderData: keepPreviousData }
    );

  const { data: rawSectors } =
    trpc.dashboard.getSectorAllocation.useQuery(
      { scope },
      { placeholderData: keepPreviousData }
    );

  const { data: rawRegions } =
    trpc.dashboard.getRegionAllocation.useQuery(
      { scope },
      { placeholderData: keepPreviousData }
    );

  const { data: rawRisk } =
    trpc.dashboard.getRiskMetrics.useQuery(
      { scope },
      { placeholderData: keepPreviousData }
    );

  const { data: rawBubble } =
    trpc.dashboard.getBubbleIndicator.useQuery(
      { scope },
      { placeholderData: keepPreviousData }
    );

  const { data: rawInsights } =
    trpc.dashboard.getCopilotInsights.useQuery(
      { scope },
      { placeholderData: keepPreviousData }
    );

  // Merge: real metrics where available, mock for missing fields.
  const metrics: AggregatedMetrics = {
    ...MOCK_METRICS,
    ...(rawMetrics ?? {}),
  };

  return {
    metrics,
    performance: (rawPerformance as PerformanceTimeseries | undefined) ?? MOCK_PERFORMANCE,
    holdings: (rawHoldings as Holding[] | undefined) ?? MOCK_HOLDINGS,
    sectors: (rawSectors as SectorBucket[] | undefined) ?? MOCK_SECTORS,
    regions: (rawRegions as RegionBucket[] | undefined) ?? MOCK_REGIONS,
    risk: (rawRisk as RiskMetrics | undefined) ?? MOCK_RISK,
    bubble: (rawBubble as BubbleIndicator | undefined) ?? MOCK_BUBBLE,
    insights: (rawInsights as CopilotInsight[] | undefined) ?? MOCK_INSIGHTS,
    portfolios: (rawPortfolios ?? []).map(p => ({
      id: p.id,
      name: p.name,
      isLive: !!p.isLive,
    })),
    isLoading: metricsLoading || perfLoading || holdingsLoading,
  };
}
