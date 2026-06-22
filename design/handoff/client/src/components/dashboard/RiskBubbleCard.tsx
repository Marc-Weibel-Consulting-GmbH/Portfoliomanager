// Risk + LPPL bubble card. The Gauge is custom SVG (see Gauge.tsx) and
// is wrapped here together with the supporting risk metrics (volatility,
// max drawdown) so it reads as one self-contained "risk profile" tile.

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gauge } from "./Gauge";
import { Sparkline } from "./Sparkline";
import { formatPercent } from "./format";
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

  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <div className="text-sm font-semibold text-white">Risiko & Bubble</div>
          <div className="text-[11px] text-gray-400">LPPL-Indikator</div>
        </div>
        <Badge variant="outline" className={badgeClass}>
          {bubble.label}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex justify-center">
          <Gauge
            value={bubble.score}
            size={170}
            color="#00CFC1"
            label="Bubble Score"
            segments={[
              { from: 0, to: 33, color: "#34d399" },
              { from: 33, to: 66, color: "#fbbf24" },
              { from: 66, to: 100, color: "#f87171" },
            ]}
          />
        </div>

        <div>
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
            <span>8-Wochen-Verlauf</span>
            <span className="text-gray-500 font-mono">aktuell {bubble.score}</span>
          </div>
          <Sparkline data={bubble.history} width={300} height={32} color="#00CFC1" strokeWidth={1.6} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <RiskTile label="Volatilität" value={`${risk.volatility.toFixed(1)}%`} sub={`SMI ${risk.volBenchmark.toFixed(1)}%`} />
          <RiskTile
            label="Max Drawdown"
            value={formatPercent(risk.maxDrawdown, 1)}
            sub={`SMI ${formatPercent(risk.drawdownBenchmark, 1)}`}
            negative
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
}

function RiskTile({ label, value, sub, negative }: RiskTileProps) {
  return (
    <div className="bg-[#0a0f1a]/60 rounded-md px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-gray-400">{label}</div>
      <div className={`font-mono font-semibold mt-0.5 ${negative ? "text-red-400" : "text-white"}`}>
        {value}
      </div>
      <div className="text-[9px] text-gray-500 font-mono">{sub}</div>
    </div>
  );
}
