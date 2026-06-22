// Dashboard — main route at /dashboard. Replaces the previous wrapper
// around UserDashboard. Pulls data from a single hook and composes the
// section cards in a 12-col-ish grid that matches the rest of the app.

import * as React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { KpiRow } from "@/components/dashboard/KpiRow";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { RiskBubbleCard } from "@/components/dashboard/RiskBubbleCard";
import { AllocationCard } from "@/components/dashboard/AllocationCard";
import { RegionCard } from "@/components/dashboard/RegionCard";
import { CopilotInsights } from "@/components/dashboard/CopilotInsights";
import { PositionsView } from "@/components/dashboard/PositionsView";
import { useDashboardData } from "@/components/dashboard/useDashboardData";
import type { ScopeId, RangeKey } from "@/components/dashboard/types";

export default function Dashboard() {
  const [scope, setScope] = React.useState<ScopeId>("aggregate");
  const [range, setRange] = React.useState<RangeKey>("YTD");

  const data = useDashboardData({ scope, range });

  return (
    <DashboardLayout>
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <DashboardHeader
          scope={scope}
          onScopeChange={setScope}
          portfolios={data.portfolios}
        />

        <KpiRow metrics={data.metrics} risk={data.risk} bubble={data.bubble} />

        {/* Main grid — performance chart spans 2/3, risk card 1/3 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
          <div className="lg:col-span-2">
            <PerformanceChart data={data.performance} range={range} onRangeChange={setRange} />
          </div>
          <RiskBubbleCard bubble={data.bubble} risk={data.risk} />
        </div>

        {/* Allocation + Region + Insights — 3 equal columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <AllocationCard sectors={data.sectors} />
          <RegionCard regions={data.regions} />
          <CopilotInsights insights={data.insights} />
        </div>

        <PositionsView holdings={data.holdings} sectors={data.sectors} />
      </div>
    </DashboardLayout>
  );
}
