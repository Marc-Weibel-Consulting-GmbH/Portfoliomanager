// Risk + LPPL bubble card. Improved visual design with cleaner gauge,
// interpretation text, and better spacing.

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gauge } from "./Gauge";
import { Sparkline } from "./Sparkline";
import { formatPercent } from "./format";
import { AlertTriangle, Shield, ShieldAlert, TrendingDown, Activity } from "lucide-react";
import type { BubbleIndicator, RiskMetrics } from "./types";

interface RiskBubbleCardProps {
  bubble: BubbleIndicator;
  risk: RiskMetrics;
}

export function RiskBubbleCard({ bubble, risk }: RiskBubbleCardProps) {
  const badgeClass =
    bubble.label === "Niedrig"
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
      : bubble.label === "Mittel"
        ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
        : "bg-red-500/20 text-red-400 border-red-500/40";

  const StatusIcon = bubble.label === "Niedrig" ? Shield : bubble.label === "Mittel" ? AlertTriangle : ShieldAlert;
  const statusColor = bubble.label === "Niedrig" ? "#34d399" : bubble.label === "Mittel" ? "#fbbf24" : "#f87171";

  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            <StatusIcon className="h-4 w-4" style={{ color: statusColor }} />
            Risiko & Bubble Index
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">LPPL Multi-Scale Indikator</div>
        </div>
        <Badge variant="outline" className={`${badgeClass} text-[10px] px-2 py-0.5`}>
          {bubble.label}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Gauge - centered with better proportions */}
        <div className="flex justify-center py-1">
          <Gauge
            value={bubble.score}
            size={140}
            color={statusColor}
            label="Bubble Score"
            segments={[
              { from: 0, to: 33, color: "#34d399" },
              { from: 33, to: 66, color: "#fbbf24" },
              { from: 66, to: 100, color: "#f87171" },
            ]}
          />
        </div>

        {/* Interpretation */}
        {bubble.interpretation && (
          <div className="text-[11px] text-gray-300 text-center leading-relaxed px-3 py-2 bg-[#0a0f1a]/80 rounded-lg border border-white/5">
            {bubble.interpretation}
          </div>
        )}

        {/* Sparkline history */}
        {bubble.history.length > 0 && (
          <div className="bg-[#0a0f1a]/40 rounded-lg px-3 py-2">
            <div className="flex justify-between items-center text-[10px] text-gray-400 mb-1.5">
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                8-Wochen-Verlauf
              </span>
              <span className="font-mono font-semibold" style={{ color: statusColor }}>{bubble.score}/100</span>
            </div>
            <Sparkline data={bubble.history} width={300} height={36} color={statusColor} strokeWidth={1.8} />
          </div>
        )}

        {/* Risk metrics grid */}
        <div className="grid grid-cols-2 gap-2">
          <RiskTile
            label="Volatilität"
            value={`${risk.volatility.toFixed(1)}%`}
            sub={`SMI ${risk.volBenchmark.toFixed(1)}%`}
            icon={<Activity className="h-3 w-3 text-gray-500" />}
          />
          <RiskTile
            label="Max Drawdown"
            value={formatPercent(risk.maxDrawdown, 1)}
            sub={`SMI ${formatPercent(risk.drawdownBenchmark, 1)}`}
            negative
            icon={<TrendingDown className="h-3 w-3 text-red-400" />}
          />
          <RiskTile
            label="VaR (95%)"
            value={`${risk.var95.toFixed(1)}%`}
            sub="Tägliches Risiko"
            icon={<ShieldAlert className="h-3 w-3 text-gray-500" />}
          />
          <RiskTile
            label="Top-3 Konz."
            value={`${risk.concentrationTop3.toFixed(0)}%`}
            sub={risk.concentrationTop3 > 40 ? "Hoch" : "Moderat"}
            negative={risk.concentrationTop3 > 40}
            icon={<Shield className="h-3 w-3 text-gray-500" />}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface RiskTileProps {
  label: string;
  value: string;
  sub: string;
  negative?: boolean;
  icon?: React.ReactNode;
}

function RiskTile({ label, value, sub, negative, icon }: RiskTileProps) {
  return (
    <div className="bg-[#0a0f1a]/60 rounded-lg px-3 py-2.5 border border-white/5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-gray-400 mb-1">
        {icon}
        {label}
      </div>
      <div className={`font-mono font-bold text-sm ${negative ? "text-red-400" : "text-white"}`}>
        {value}
      </div>
      <div className="text-[9px] text-gray-500 font-mono mt-0.5">{sub}</div>
    </div>
  );
}
