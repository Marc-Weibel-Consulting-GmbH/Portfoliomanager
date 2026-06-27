/**
 * SignalDashboard — Interaktives Signal-Transparenz-Dashboard
 *
 * Visualisiert den vollständigen Output des SignalOrchestrators:
 *   1. Regime-Panel: Aktuelles Markt-Regime + Features
 *   2. Engine-Vergleich: Alle 4 Engines mit Score-Balken
 *   3. ModelSelector: Gewählte Engine + Walk-Forward-Metriken
 *   4. RiskOverlay: Dämpfungsfaktor + Entscheidung
 *   5. Audit-Trail: Aufklappbare Indikator-Details je Engine
 *   6. Stop-Loss / Take-Profit Visualisierung
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, TrendingDown, Minus, ShieldAlert, AlertTriangle,
  ChevronDown, ChevronRight, RefreshCw, Info, CheckCircle2,
  Activity, BarChart3, Zap, GitBranch, Shield, Clock
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip as ReTooltip
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// Typen & Konstanten
// ─────────────────────────────────────────────────────────────────────────────

type MarketRegime = "bull_trend" | "bear_trend" | "sideways_low_vol" | "sideways_high_vol" | "crisis" | "recovery" | "unknown";
type PortfolioActionType = "buy" | "add" | "hold" | "reduce" | "sell" | "hedge" | "rebalance";
type SignalEngineType = "trend" | "mean_reversion" | "breakout" | "ensemble";

const REGIME_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  bull_trend:        { label: "Aufwärtstrend",       color: "text-emerald-400", bg: "bg-emerald-900/20 border-emerald-700/30", dot: "bg-emerald-400" },
  bear_trend:        { label: "Abwärtstrend",         color: "text-red-400",     bg: "bg-red-900/20 border-red-700/30",         dot: "bg-red-400" },
  sideways_low_vol:  { label: "Seitwärts (ruhig)",    color: "text-blue-400",    bg: "bg-blue-900/20 border-blue-700/30",       dot: "bg-blue-400" },
  sideways_high_vol: { label: "Seitwärts (volatil)",  color: "text-orange-400",  bg: "bg-orange-900/20 border-orange-700/30",   dot: "bg-orange-400" },
  crisis:            { label: "Krisenregime",          color: "text-red-500",     bg: "bg-red-950/30 border-red-800/40",         dot: "bg-red-500" },
  recovery:          { label: "Erholung",              color: "text-teal-400",    bg: "bg-teal-900/20 border-teal-700/30",       dot: "bg-teal-400" },
  unknown:           { label: "Unbekannt",             color: "text-slate-400",   bg: "bg-slate-800/30 border-slate-700/30",     dot: "bg-slate-400" },
};

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  buy:       { label: "KAUFEN",      color: "text-emerald-300", bg: "bg-emerald-900/30", border: "border-emerald-600/50", icon: <TrendingUp className="w-4 h-4" /> },
  add:       { label: "AUFSTOCKEN", color: "text-emerald-300", bg: "bg-emerald-900/30", border: "border-emerald-600/50", icon: <TrendingUp className="w-4 h-4" /> },
  hold:      { label: "HALTEN",      color: "text-slate-300",   bg: "bg-slate-800/40",   border: "border-slate-600/50",   icon: <Minus className="w-4 h-4" /> },
  reduce:    { label: "REDUZIEREN",  color: "text-orange-300",  bg: "bg-orange-900/30",  border: "border-orange-600/50",  icon: <TrendingDown className="w-4 h-4" /> },
  sell:      { label: "VERKAUFEN",   color: "text-red-300",     bg: "bg-red-900/30",     border: "border-red-600/50",     icon: <TrendingDown className="w-4 h-4" /> },
  hedge:     { label: "ABSICHERN",   color: "text-purple-300",  bg: "bg-purple-900/30",  border: "border-purple-600/50",  icon: <Shield className="w-4 h-4" /> },
  rebalance: { label: "REBALANCEN",  color: "text-blue-300",    bg: "bg-blue-900/30",    border: "border-blue-600/50",    icon: <GitBranch className="w-4 h-4" /> },
};

const ENGINE_CONFIG: Record<SignalEngineType, { label: string; icon: React.ReactNode; description: string }> = {
  trend:          { label: "Trend",          icon: <TrendingUp className="w-3.5 h-3.5" />,  description: "MA-Alignment, ADX, Slope" },
  mean_reversion: { label: "Mean Reversion", icon: <Activity className="w-3.5 h-3.5" />,    description: "RSI, Stochastik, Bollinger, Z-Score, CCI" },
  breakout:       { label: "Breakout",       icon: <Zap className="w-3.5 h-3.5" />,         description: "Donchian, ATR, Momentum, BB-Squeeze" },
  ensemble:       { label: "Ensemble",       icon: <BarChart3 className="w-3.5 h-3.5" />,   description: "Regime-gewichtete Kombination" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

function ScoreBar({ score, size = "md" }: { score: number; size?: "sm" | "md" }) {
  const pct = Math.round(Math.abs(score) * 100);
  const isPos = score >= 0;
  const h = size === "sm" ? "h-1" : "h-1.5";
  return (
    <div className={`flex items-center gap-2 ${size === "sm" ? "text-xs" : "text-sm"}`}>
      <div className={`flex-1 ${h} bg-slate-700/60 rounded-full overflow-hidden flex`}>
        {/* Negative side (left) */}
        <div className="w-1/2 flex justify-end">
          {!isPos && (
            <div
              className="h-full bg-red-500 rounded-l-full transition-all"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
        {/* Center divider */}
        <div className="w-px bg-slate-500/50" />
        {/* Positive side (right) */}
        <div className="w-1/2">
          {isPos && (
            <div
              className="h-full bg-emerald-500 rounded-r-full transition-all"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
      </div>
      <span className={`w-12 text-right font-mono ${isPos ? "text-emerald-400" : "text-red-400"}`}>
        {isPos ? "+" : ""}{score.toFixed(2)}
      </span>
    </div>
  );
}

function MetricPill({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex flex-col items-center bg-slate-800/50 rounded-lg px-3 py-2 min-w-[72px]">
      <span className={`text-sm font-bold font-mono ${good === true ? "text-emerald-400" : good === false ? "text-red-400" : "text-slate-200"}`}>
        {value}
      </span>
      <span className="text-[10px] text-slate-500 mt-0.5 text-center leading-tight">{label}</span>
    </div>
  );
}

function ConfidenceRing({ value, size = 56 }: { value: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * value;
  const color = value > 0.65 ? "#10b981" : value > 0.4 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text
        x={size / 2} y={size / 2 + 5}
        textAnchor="middle" fontSize={12} fontWeight="bold"
        fill={color} style={{ transform: "rotate(90deg)", transformOrigin: `${size / 2}px ${size / 2}px` }}
      >
        {Math.round(value * 100)}%
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Panels
// ─────────────────────────────────────────────────────────────────────────────

function RegimePanel({ data }: { data: any }) {
  const regime = REGIME_CONFIG[data.regime] ?? REGIME_CONFIG.unknown;
  const features = data.regimeFeatures ?? {};
  return (
    <div className={`rounded-xl border p-4 ${regime.bg}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${regime.dot} animate-pulse`} />
        <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Markt-Regime</span>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-lg font-bold ${regime.color}`}>{regime.label}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Konfidenz: <span className="text-slate-300">{Math.round(data.regimeConfidence * 100)}%</span>
          </p>
        </div>
        <ConfidenceRing value={data.regimeConfidence} size={52} />
      </div>
      {/* Regime Features */}
      {Object.keys(features).length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/40 grid grid-cols-2 gap-x-4 gap-y-1">
          {[
            { key: "trend20", label: "Trend 20T" },
            { key: "trend60", label: "Trend 60T" },
            { key: "volatility30", label: "Volatilität" },
            { key: "drawdown", label: "Drawdown" },
            { key: "adx14", label: "ADX(14)" },
            { key: "rsi14", label: "RSI(14)" },
          ].map(({ key, label }) => features[key] != null ? (
            <div key={key} className="flex justify-between text-xs">
              <span className="text-slate-500">{label}</span>
              <span className={`font-mono ${
                key === "drawdown" && features[key] < -0.15 ? "text-red-400" :
                key === "volatility30" && features[key] > 0.35 ? "text-orange-400" :
                key === "trend20" && features[key] > 0 ? "text-emerald-400" :
                key === "trend20" && features[key] < 0 ? "text-red-400" :
                "text-slate-300"
              }`}>
                {key.includes("trend") || key === "drawdown"
                  ? `${(features[key] * 100).toFixed(1)}%`
                  : key === "volatility30"
                  ? `${(features[key] * 100).toFixed(1)}%`
                  : features[key].toFixed(1)}
              </span>
            </div>
          ) : null)}
        </div>
      )}
    </div>
  );
}

function ActionPanel({ data }: { data: any }) {
  const action = ACTION_CONFIG[data.action] ?? ACTION_CONFIG.hold;
  const convPct = Math.round(data.conviction * 100);
  const rawPct = Math.round(Math.abs(data.rawScore) * 100);
  const adjPct = Math.round(Math.abs(data.adjustedScore) * 100);
  const dampened = data.rawScore !== 0 && Math.abs(data.adjustedScore) < Math.abs(data.rawScore) * 0.9;

  return (
    <div className={`rounded-xl border p-4 ${action.bg} ${action.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Empfehlung</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg ${action.bg} border ${action.border}`}>
            <span className={action.color}>{action.icon}</span>
          </div>
          <div>
            <p className={`text-xl font-bold tracking-wide ${action.color}`}>{action.label}</p>
            <p className="text-xs text-slate-500">via <span className="text-slate-300">{data.selectedModel}</span></p>
          </div>
        </div>
        <ConfidenceRing value={data.conviction} size={52} />
      </div>

      {/* Score comparison: raw vs adjusted */}
      <div className="mt-3 pt-3 border-t border-slate-700/40 space-y-2">
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Raw Score</span>
            <span className="font-mono">{data.rawScore >= 0 ? "+" : ""}{data.rawScore.toFixed(3)}</span>
          </div>
          <ScoreBar score={data.rawScore} size="sm" />
        </div>
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Adjusted Score {dampened && <span className="text-orange-400">(gedämpft)</span>}</span>
            <span className="font-mono">{data.adjustedScore >= 0 ? "+" : ""}{data.adjustedScore.toFixed(3)}</span>
          </div>
          <ScoreBar score={data.adjustedScore} size="sm" />
        </div>
      </div>

      {/* Stop-Loss / Take-Profit */}
      {(data.stopLossPct != null || data.takeProfitPct != null) && (
        <div className="mt-3 pt-3 border-t border-slate-700/40 flex gap-3">
          {data.stopLossPct != null && (
            <div className="flex-1 bg-red-950/30 border border-red-800/30 rounded-lg px-3 py-2 text-center">
              <p className="text-[10px] text-slate-500 mb-0.5">Stop-Loss</p>
              <p className="text-sm font-bold text-red-400 font-mono">{data.stopLossPct.toFixed(1)}%</p>
            </div>
          )}
          {data.takeProfitPct != null && (
            <div className="flex-1 bg-emerald-950/30 border border-emerald-800/30 rounded-lg px-3 py-2 text-center">
              <p className="text-[10px] text-slate-500 mb-0.5">Take-Profit</p>
              <p className="text-sm font-bold text-emerald-400 font-mono">+{data.takeProfitPct.toFixed(1)}%</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EngineComparisonPanel({ data }: { data: any }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const signalOutputs: any[] = data.signalOutputs ?? [];
  // Exclude the "adjusted" output (last one) — show only the 4 engines
  const engines = signalOutputs.filter((s: any) =>
    ["trend", "mean_reversion", "breakout", "ensemble"].includes(s.engine)
  );

  // Radar chart data
  const radarData = engines.map((e: any) => ({
    engine: ENGINE_CONFIG[e.engine as SignalEngineType]?.label ?? e.engine,
    score: Math.round(Math.abs(e.rawScore) * 100),
    confidence: Math.round(e.confidence * 100),
  }));

  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Engine-Vergleich</span>
        <span className="ml-auto text-xs text-slate-600">4 Engines</span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {engines.map((engine: any) => {
          const cfg = ENGINE_CONFIG[engine.engine as SignalEngineType];
          const isSelected = engine.engine === data.selectedModel;
          const isExpanded = expanded === engine.engine;
          const dirLabel = engine.direction === 1 ? "bullisch" : engine.direction === -1 ? "bärisch" : "neutral";
          const dirColor = engine.direction === 1 ? "text-emerald-400" : engine.direction === -1 ? "text-red-400" : "text-slate-400";

          return (
            <div
              key={engine.engine}
              className={`rounded-lg border transition-all ${
                isSelected
                  ? "border-[#00CFC1]/40 bg-[#00CFC1]/5"
                  : "border-slate-700/30 bg-slate-800/30"
              }`}
            >
              <button
                className="w-full px-3 py-2.5 flex items-center gap-3 text-left"
                onClick={() => setExpanded(isExpanded ? null : engine.engine)}
              >
                {/* Engine icon + label */}
                <div className={`p-1.5 rounded ${isSelected ? "bg-[#00CFC1]/10 text-[#00CFC1]" : "bg-slate-700/50 text-slate-400"}`}>
                  {cfg?.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isSelected ? "text-[#00CFC1]" : "text-slate-200"}`}>
                      {cfg?.label ?? engine.engine}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] bg-[#00CFC1]/20 text-[#00CFC1] px-1.5 py-0.5 rounded font-medium">
                        GEWÄHLT
                      </span>
                    )}
                    <span className={`text-xs ml-auto ${dirColor}`}>{dirLabel}</span>
                  </div>
                  <ScoreBar score={engine.rawScore} size="sm" />
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className="text-xs text-slate-400">{Math.round(engine.confidence * 100)}%</span>
                  {isExpanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                </div>
              </button>

              {/* Expanded: Rationale */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-slate-700/30 pt-2.5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">{cfg?.description}</p>
                  <div className="space-y-1">
                    {(engine.rationale ?? []).map((r: string, i: number) => (
                      <p key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                        <span className="text-slate-600 mt-0.5 shrink-0">
                          {r.startsWith("✓") ? "✓" : r.startsWith("✗") ? "✗" : r.startsWith("⚠") ? "⚠" : r.startsWith("~") ? "~" : "•"}
                        </span>
                        <span className={
                          r.startsWith("✓") ? "text-emerald-400/80" :
                          r.startsWith("✗") ? "text-red-400/80" :
                          r.startsWith("⚠") ? "text-orange-400/80" :
                          "text-slate-400"
                        }>
                          {r.replace(/^[✓✗⚠~•]\s*/, "")}
                        </span>
                      </p>
                    ))}
                  </div>
                  {/* Entry / Exit / Holding */}
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {engine.entry && <span className="text-[10px] bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded">Entry-Signal</span>}
                    {engine.exit && <span className="text-[10px] bg-red-900/30 text-red-400 px-2 py-0.5 rounded">Exit-Signal</span>}
                    {engine.holdingPeriodHint && (
                      <span className="text-[10px] bg-slate-700/50 text-slate-400 px-2 py-0.5 rounded flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />{engine.holdingPeriodHint}T Haltedauer
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModelSelectorPanel({ data }: { data: any }) {
  const [open, setOpen] = useState(false);
  const rationale: string[] = data.rationale ?? [];
  // Split rationale into ModelSelector section and signal section
  const selectorLines = rationale.filter(l => l.includes("Walk-Forward") || l.includes(":") && (l.includes("WF-Score") || l.includes("Ausgewählt")));
  const signalLines = rationale.filter(l => !selectorLines.includes(l) && l.trim() !== "" && !l.startsWith("──"));

  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-4">
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">ModelSelector</span>
        <button
          onClick={() => setOpen(!open)}
          className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Info className="w-3 h-3" />
          {open ? "Weniger" : "Audit-Trail"}
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
      </div>

      {/* Selected model summary */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#00CFC1]" />
            <span className="text-sm font-semibold text-[#00CFC1]">
              {ENGINE_CONFIG[data.selectedModel as SignalEngineType]?.label ?? data.selectedModel}
            </span>
            <span className="text-xs text-slate-500">bevorzugt für</span>
            <span className="text-xs text-slate-300">{REGIME_CONFIG[data.regime]?.label ?? data.regime}</span>
          </div>
        </div>
      </div>

      {/* Walk-Forward line */}
      {selectorLines.length > 0 && (
        <div className="bg-slate-900/40 rounded-lg px-3 py-2 mb-3">
          {selectorLines.slice(0, 1).map((l, i) => (
            <p key={i} className="text-xs text-slate-400 font-mono">{l}</p>
          ))}
        </div>
      )}

      {/* Expanded audit trail */}
      {open && (
        <div className="border-t border-slate-700/30 pt-3 space-y-1 max-h-64 overflow-y-auto">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Vollständiger Audit-Trail</p>
          {rationale.map((line, i) => (
            <p key={i} className={`text-xs font-mono leading-relaxed ${
              line.startsWith("──") ? "text-slate-600 mt-2" :
              line.includes("Ausgewählt") || line.startsWith("✓") ? "text-[#00CFC1]/80" :
              line.startsWith("⚠") ? "text-orange-400/80" :
              line.trim() === "" ? "hidden" :
              "text-slate-400"
            }`}>
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function RiskOverlayPanel({ data }: { data: any }) {
  const overlay = data.riskOverlay;
  if (!overlay) return null;

  const isBlocked = overlay.decision === "block";
  const isReduced = overlay.decision === "reduce";
  const isAllowed = overlay.decision === "allow";

  const decisionConfig = {
    block:  { label: "GESPERRT",   color: "text-red-400",    bg: "bg-red-950/30 border-red-800/40",     icon: <ShieldAlert className="w-4 h-4" /> },
    reduce: { label: "REDUZIERT",  color: "text-orange-400", bg: "bg-orange-950/30 border-orange-800/40", icon: <AlertTriangle className="w-4 h-4" /> },
    allow:  { label: "FREIGEGEBEN", color: "text-emerald-400", bg: "bg-emerald-950/20 border-emerald-800/30", icon: <CheckCircle2 className="w-4 h-4" /> },
    hedge:  { label: "HEDGE",      color: "text-purple-400", bg: "bg-purple-950/30 border-purple-800/40", icon: <Shield className="w-4 h-4" /> },
  };
  const cfg = decisionConfig[overlay.decision as keyof typeof decisionConfig] ?? decisionConfig.allow;

  const convPct = Math.round((overlay.convictionMultiplier ?? 1) * 100);
  const exposurePct = Math.round((overlay.targetExposureMultiplier ?? 1) * 100);

  return (
    <div className={`rounded-xl border p-4 ${cfg.bg}`}>
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Risk Overlay</span>
        <div className={`ml-auto flex items-center gap-1.5 ${cfg.color}`}>
          {cfg.icon}
          <span className="text-xs font-bold">{cfg.label}</span>
        </div>
      </div>

      <div className="flex gap-3 mb-3">
        <MetricPill label="Überzeugung" value={`${convPct}%`} good={convPct > 70} />
        <MetricPill label="Exposure" value={`${exposurePct}%`} good={exposurePct > 70} />
      </div>

      {/* Conviction multiplier bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Dämpfungsfaktor</span>
          <span className="font-mono">{convPct}%</span>
        </div>
        <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              convPct > 70 ? "bg-emerald-500" : convPct > 40 ? "bg-orange-500" : "bg-red-500"
            }`}
            style={{ width: `${convPct}%` }}
          />
        </div>
      </div>

      {/* Rationale */}
      {overlay.rationale && overlay.rationale.length > 0 && (
        <div className="space-y-1">
          {overlay.rationale.slice(0, 4).map((r: string, i: number) => (
            <p key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
              <span className="text-slate-600 mt-0.5 shrink-0">•</span>
              {r}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hauptkomponente
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  ticker: string;
}

export default function SignalDashboard({ ticker }: Props) {
  const { data, isLoading, error, refetch, isFetching } = trpc.signals.getRegimeSignal.useQuery(
    { ticker },
    { staleTime: 5 * 60 * 1000, retry: 1 }
  );

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-slate-800/40 rounded-xl" />
        ))}
        <p className="text-xs text-slate-500 text-center pt-2">
          Signal-Framework wird berechnet…
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <p className="text-sm text-slate-400">Signal-Dashboard nicht verfügbar</p>
        <p className="text-xs text-slate-600 mt-1">{error?.message ?? "Keine Daten"}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          <RefreshCw className="w-3 h-3 mr-1.5" /> Erneut versuchen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#00CFC1]" />
          <span className="text-sm font-semibold text-slate-200">Signal-Dashboard</span>
          <span className="text-xs text-slate-500">— {ticker}</span>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Lädt…" : new Date(data.computedAt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
        </button>
      </div>

      {/* Row 1: Regime + Action */}
      <div className="grid grid-cols-2 gap-3">
        <RegimePanel data={data} />
        <ActionPanel data={data} />
      </div>

      {/* Row 2: Engine Comparison */}
      <EngineComparisonPanel data={data} />

      {/* Row 3: ModelSelector + RiskOverlay */}
      <div className="grid grid-cols-1 gap-3">
        <ModelSelectorPanel data={data} />
        <RiskOverlayPanel data={data} />
      </div>

      {/* Footer: Triggered by */}
      {data.triggeredBy && data.triggeredBy.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="text-xs text-slate-600">Ausgelöst von:</span>
          {data.triggeredBy.map((e: string) => (
            <span key={e} className="text-xs bg-slate-800/60 text-slate-400 px-2 py-0.5 rounded border border-slate-700/30">
              {e}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
