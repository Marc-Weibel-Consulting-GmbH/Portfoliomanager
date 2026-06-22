// Six KPI cards in a strip. Same visual style as the rest of the app
// (gradient surfaces, teal accent, monospace numbers).

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity, Gauge as GaugeIcon } from "lucide-react";
import { formatCHF, formatPercent } from "./format";
import type { AggregatedMetrics, RiskMetrics, BubbleIndicator } from "./types";

interface KpiRowProps {
  metrics: AggregatedMetrics;
  risk: RiskMetrics;
  bubble: BubbleIndicator;
}

export function KpiRow({ metrics, risk, bubble }: KpiRowProps) {
  const ytdPos = metrics.totalPerformancePercent >= 0;
  const totalPos = (metrics.totalReturnPercent ?? metrics.totalPerformancePercent) >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      <KpiCard
        label="Gesamtwert"
        value={formatCHF(metrics.totalValue)}
        sub={
          <>
            <span className="text-emerald-400">
              {formatCHF(metrics.dayChange ?? 0)}
            </span>
            <span className="text-gray-500"> · {formatPercent(metrics.dayChangePercent ?? 0)} heute</span>
          </>
        }
      />
      <KpiCard
        label="Performance YTD"
        value={
          <span className={ytdPos ? "text-emerald-400" : "text-red-400"}>
            {formatPercent(metrics.totalPerformancePercent)}
          </span>
        }
        icon={ytdPos ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
        sub={
          <span className="text-gray-500 font-mono text-[10px]">
            SMI {formatPercent(metrics.benchmarkSmiYtd ?? metrics.benchmarkPerformance)} · MSCI {formatPercent(metrics.benchmarkMsciYtd ?? 0)}
          </span>
        }
      />
      <KpiCard
        label="Performance Total"
        value={
          <span className={totalPos ? "text-emerald-400" : "text-red-400"}>
            {formatPercent(metrics.totalReturnPercent ?? metrics.totalPerformancePercent)}
          </span>
        }
        sub={<span className="text-gray-500">{formatCHF(metrics.totalPerformance)} G/V</span>}
      />
      <KpiCard
        label="Sharpe Ratio"
        value={risk.sharpeRatio.toFixed(2)}
        icon={<Activity className="h-4 w-4 text-[#00CFC1]" />}
        sub={<span className="text-gray-500">Benchmark 1.05</span>}
      />
      <KpiCard
        label="Beta vs. SMI"
        value={risk.beta.toFixed(2)}
        sub={
          <span className="text-gray-500">
            {risk.beta < 1 ? "Defensiver" : "Aggressiver"} als Markt
          </span>
        }
      />
      <KpiCard
        label="Bubble-Indikator"
        value={
          <span>
            {bubble.score}
            <span className="text-gray-500 text-sm ml-1">/100</span>
          </span>
        }
        icon={<GaugeIcon className="h-4 w-4 text-[#00CFC1]" />}
        sub={<span className="text-gray-500">LPPL · {bubble.label}</span>}
      />
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
}

function KpiCard({ label, value, sub, icon }: KpiCardProps) {
  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
      <CardContent className="p-4 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-gray-400">
            {label}
          </span>
          {icon}
        </div>
        <div className="text-xl font-semibold text-white font-mono leading-tight">
          {value}
        </div>
        {sub && <div className="text-[11px] text-gray-500 font-mono">{sub}</div>}
      </CardContent>
    </Card>
  );
}
