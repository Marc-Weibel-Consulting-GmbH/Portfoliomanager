// Four KPI cards in a strip per IA-Optimierung spec.
// Gesamtwert | YTD (TTWROR) | Sharpe | Bubble

import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { formatCHF, formatPercent } from "./format";
import type { AggregatedMetrics, RiskMetrics, BubbleIndicator } from "./types";

interface KpiRowProps {
  metrics: AggregatedMetrics;
  risk: RiskMetrics;
  bubble: BubbleIndicator;
}

export function KpiRow({ metrics, risk, bubble }: KpiRowProps) {
  const ttwrorVal = metrics.ttwrorYtd ?? metrics.totalPerformancePercent;
  const ytdPos = ttwrorVal >= 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {/* 1. Gesamtwert */}
      <KpiCard
        label="GESAMTWERT"
        value={formatCHF(metrics.totalValue)}
        sub={
          <span className="flex items-center gap-1.5">
            <span className={`${(metrics.dayChange ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCHF(metrics.dayChange ?? 0)}
            </span>
            <span className="text-gray-500">heute · {formatPercent(metrics.dayChangePercent ?? 0)}</span>
          </span>
        }
        accent={
          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        }
      />

      {/* 2. YTD (TTWROR) */}
      <KpiCard
        label={
          <span className="flex items-center gap-1">
            YTD
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-gray-500 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                <p className="font-semibold mb-1">TTWROR (True Time-Weighted Rate of Return)</p>
                <p>Zeitgewichtete Rendite seit Jahresbeginn, bereinigt um Ein-/Auszahlungen.</p>
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

      {/* 3. Sharpe Ratio */}
      <KpiCard
        label="SHARPE"
        value={risk.sharpeRatio.toFixed(2)}
        sub={<span className="text-gray-500">Benchmark: 1.05</span>}
      />

      {/* 4. Bubble-Indikator */}
      <KpiCard
        label="BUBBLE"
        value={
          <span>
            {bubble.score}
            <span className="text-gray-500 text-sm ml-1">/100</span>
          </span>
        }
        sub={<span className="text-gray-500">{bubble.label}</span>}
      />
    </div>
  );
}

interface KpiCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: React.ReactNode;
}

function KpiCard({ label, value, sub, icon, accent }: KpiCardProps) {
  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20 border-t-[#00CFC1]/50 border-t-2">
      <CardContent className="p-4 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
            {label}
          </span>
          {icon}
          {accent}
        </div>
        <div className="text-xl font-semibold text-white font-mono leading-tight">
          {value}
        </div>
        {sub && <div className="text-[11px] text-gray-500 font-mono">{sub}</div>}
      </CardContent>
    </Card>
  );
}
