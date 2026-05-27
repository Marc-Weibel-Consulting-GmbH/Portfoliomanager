// Dashboard — main route at /dashboard. Consolidated view replacing
// Dashboard.tsx + Home.tsx + LiveTracking.tsx per IA-Optimierung spec.

import * as React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { KpiRow } from "@/components/dashboard/KpiRow";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { AllocationCard } from "@/components/dashboard/AllocationCard";
import { CopilotInsights } from "@/components/dashboard/CopilotInsights";
import { useDashboardData } from "@/components/dashboard/useDashboardData";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "wouter";
import { formatCHF, formatPercent } from "@/components/dashboard/format";
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

        {/* Main grid — performance chart 2/3, allocation 1/3 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
          <div className="lg:col-span-2">
            <PerformanceChart data={data.performance} range={range} onRangeChange={setRange} />
          </div>
          <AllocationCard sectors={data.sectors} />
        </div>

        {/* Bottom section — Copilot Insights + Meine Portfolios */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <CopilotInsights
            insights={data.insights}
            loading={data.insightsLoading}
            onRefresh={data.refetchInsights}
          />
          <MyPortfoliosCard portfolios={data.portfolios} />
        </div>
      </div>
    </DashboardLayout>
  );
}

// "Meine Portfolios" card for the dashboard bottom section
function MyPortfoliosCard({ portfolios }: { portfolios: { id: number; name: string; isLive: boolean; value?: number; ytdPercent?: number; positionCount?: number; strategy?: string }[] }) {
  const liveCount = portfolios.filter(p => p.isLive).length;
  const totalCount = portfolios.length;

  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <div className="text-sm font-semibold text-white">Meine Portfolios</div>
          <div className="text-[11px] text-gray-400">
            {liveCount} aktiv · {totalCount - liveCount} in Bearbeitung
          </div>
        </div>
        <Link href="/portfolio-builder">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-[11px] border-[#00CFC1]/40 text-[#00CFC1] hover:bg-[#00CFC1]/10"
          >
            <Plus className="h-3 w-3 mr-1" />
            Neu
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {portfolios.length === 0 && (
          <div className="text-center py-6">
            <div className="text-sm text-gray-400 mb-2">Noch keine Portfolios</div>
            <Link href="/portfolio-builder">
              <Button size="sm" className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black text-xs">
                Erstes Portfolio erstellen
              </Button>
            </Link>
          </div>
        )}
        {portfolios.slice(0, 4).map(p => {
          const ytd = (p as any).ytdPercent ?? 0;
          const value = (p as any).value ?? 0;
          const isPositive = ytd >= 0;

          return (
            <Link key={p.id} href={`/portfolios/${p.id}`}>
              <div className="flex items-center gap-3 px-3 py-2.5 bg-[#0a0f1a]/60 rounded-lg hover:bg-[#0a0f1a] transition-colors cursor-pointer group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-white truncate">{p.name}</span>
                    {p.isLive && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-emerald-500/50 text-emerald-400 bg-emerald-500/10">
                        LIVE
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {(p as any).strategy ?? "Portfolio"} · {(p as any).positionCount ?? "–"} Pos.
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {value > 0 && (
                    <div className="text-xs font-mono text-white">{formatCHF(value)}</div>
                  )}
                  <div className={`text-[11px] font-mono flex items-center gap-0.5 justify-end ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                    {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {formatPercent(ytd)}
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-gray-600 group-hover:text-[#00CFC1] transition-colors shrink-0" />
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
