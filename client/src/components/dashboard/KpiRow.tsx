// Six KPI cards in a strip. Same visual style as the rest of the app
// (gradient surfaces, teal accent, monospace numbers).

import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Activity, Gauge as GaugeIcon, Info } from "lucide-react";
import { formatCHF, formatPercent } from "./format";
import type { AggregatedMetrics, RiskMetrics, BubbleIndicator } from "./types";

interface KpiRowProps {
  metrics: AggregatedMetrics;
  risk: RiskMetrics;
  bubble: BubbleIndicator;
}

export function KpiRow({ metrics, risk, bubble }: KpiRowProps) {
  const ttwrorVal = metrics.ttwrorYtd ?? metrics.totalPerformancePercent;
  const irrVal = metrics.irrYtd ?? null;
  const ytdPos = ttwrorVal >= 0;
  const totalPos = (metrics.totalReturnPercent ?? ttwrorVal) >= 0;

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
        label={
          <span className="flex items-center gap-1">
            TTWROR YTD
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-gray-500 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                <p className="font-semibold mb-1">True Time-Weighted Rate of Return</p>
                <p>Misst die reine Anlageperformance, unabhängig von Ein-/Auszahlungen. Ideal zum Vergleich mit Benchmarks.</p>
              </TooltipContent>
            </Tooltip>
          </span>
        }
        value={
          <span className={ytdPos ? "text-emerald-400" : "text-red-400"}>
            {formatPercent(ttwrorVal)}
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
        label={
          <span className="flex items-center gap-1">
            IRR (MWR)
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-gray-500 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                <p className="font-semibold mb-1">Internal Rate of Return</p>
                <p>Geldgewichtete Rendite – berücksichtigt Timing und Höhe deiner Ein-/Auszahlungen. Zeigt deine persönliche Erfahrung.</p>
              </TooltipContent>
            </Tooltip>
          </span>
        }
        value={
          irrVal !== null ? (
            <span className={irrVal >= 0 ? "text-emerald-400" : "text-red-400"}>
              {formatPercent(irrVal)}
            </span>
          ) : (
            <span className="text-gray-500">—</span>
          )
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
  label: React.ReactNode;
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
