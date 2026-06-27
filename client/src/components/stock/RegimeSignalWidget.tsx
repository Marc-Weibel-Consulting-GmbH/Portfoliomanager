/**
 * RegimeSignalWidget — Zeigt das Regime-basierte Signal aus dem neuen Signal-Framework.
 *
 * Zeigt:
 * - Markt-Regime (Trending Bull/Bear, Ranging, Crisis, etc.)
 * - Ensemble-Signal (BUY/SELL/HOLD/ADD/REDUCE)
 * - Conviction (Konfidenz)
 * - Risk Overlay (LPPL-Bubble-Warnung)
 * - Rationale (Begründung)
 */

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, ShieldAlert } from "lucide-react";

interface Props {
  ticker: string;
}

const REGIME_LABELS: Record<string, { label: string; color: string }> = {
  trending_bull:    { label: "Trend Bullisch",    color: "text-emerald-400" },
  trending_bear:    { label: "Trend Bärisch",     color: "text-red-400" },
  ranging_neutral:  { label: "Seitwärts Neutral", color: "text-slate-400" },
  ranging_bullish:  { label: "Seitwärts Bullisch",color: "text-emerald-300" },
  ranging_bearish:  { label: "Seitwärts Bärisch", color: "text-red-300" },
  crisis:           { label: "Krisenregime",       color: "text-orange-400" },
  unknown:          { label: "Unbekannt",          color: "text-slate-500" },
};

const ACTION_CONFIG: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline"; icon: React.ReactNode }> = {
  buy:    { label: "KAUFEN",    variant: "default",     icon: <TrendingUp className="w-3 h-3" /> },
  add:    { label: "AUFSTOCKEN",variant: "default",     icon: <TrendingUp className="w-3 h-3" /> },
  hold:   { label: "HALTEN",    variant: "secondary",   icon: <Minus className="w-3 h-3" /> },
  reduce: { label: "REDUZIEREN",variant: "outline",     icon: <TrendingDown className="w-3 h-3" /> },
  sell:   { label: "VERKAUFEN", variant: "destructive", icon: <TrendingDown className="w-3 h-3" /> },
};

export default function RegimeSignalWidget({ ticker }: Props) {
  const { data, isLoading, error } = trpc.signals.getRegimeSignal.useQuery(
    { ticker },
    { staleTime: 5 * 60 * 1000, retry: 1 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Regime-Analyse wird berechnet…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-slate-500 text-sm py-2">
        Regime-Signal nicht verfügbar.
      </div>
    );
  }

  const action = ACTION_CONFIG[data.action] ?? ACTION_CONFIG.hold;
  const regime = REGIME_LABELS[data.regime] ?? REGIME_LABELS.unknown;
  const convictionPct = Math.round(data.conviction * 100);
  const isRiskBlocked = data.riskOverlay?.decision === "block";
  const isRiskReduced = data.riskOverlay?.decision === "reduce";

  return (
    <div className="space-y-4">
      {/* Header: Regime + Action */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Markt-Regime</p>
          <p className={`text-sm font-semibold ${regime.color}`}>{regime.label}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Konfidenz: {Math.round(data.regimeConfidence * 100)}%
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Signal</p>
          <Badge variant={action.variant} className="flex items-center gap-1 text-sm px-3 py-1">
            {action.icon}
            {action.label}
          </Badge>
          <p className="text-xs text-slate-500 mt-1">Überzeugung: {convictionPct}%</p>
        </div>
      </div>

      {/* Conviction Bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Überzeugung</span>
          <span>{convictionPct}%</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              data.action === "buy" || data.action === "add"
                ? "bg-emerald-500"
                : data.action === "sell" || data.action === "reduce"
                ? "bg-red-500"
                : "bg-slate-400"
            }`}
            style={{ width: `${convictionPct}%` }}
          />
        </div>
      </div>

      {/* Risk Overlay Warning */}
      {(isRiskBlocked || isRiskReduced) && (
        <div className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${
          isRiskBlocked ? "bg-red-900/30 text-red-300" : "bg-orange-900/30 text-orange-300"
        }`}>
          {isRiskBlocked ? (
            <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          )}
          <div>
            <p className="font-semibold mb-0.5">
              {isRiskBlocked ? "Risiko-Sperre aktiv" : "Risiko-Reduktion empfohlen"}
            </p>
            {data.riskOverlay?.rationale?.slice(0, 2).map((r, i) => (
              <p key={i} className="opacity-80">{r}</p>
            ))}
          </div>
        </div>
      )}

      {/* Rationale */}
      {data.rationale && data.rationale.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Begründung</p>
          <ul className="space-y-1">
            {data.rationale.slice(0, 4).map((r, i) => (
              <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                <span className="text-slate-600 mt-0.5">•</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Triggered By */}
      {data.triggeredBy && data.triggeredBy.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-700/50">
          {data.triggeredBy.map((engine) => (
            <span key={engine} className="text-xs bg-slate-700/60 text-slate-400 px-2 py-0.5 rounded">
              {engine}
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-600">
        Berechnet: {new Date(data.computedAt).toLocaleTimeString("de-CH")}
      </p>
    </div>
  );
}
