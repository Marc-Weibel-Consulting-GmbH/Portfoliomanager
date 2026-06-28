/**
 * PegContextCard
 * ==============
 * Interaktive PEG-Analyse-Karte mit:
 * - PEG-Quadrant-Visualisierung (4 Felder: PE-Niveau × Wachstum)
 * - Adjusted PEG (volatilitätskorrigiert)
 * - ROIC, EPS-Volatilität, Surprise-Rate
 * - KI-Interpretations-Button (invokeLLM via tRPC)
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sparkles,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// ─── Props ────────────────────────────────────────────────────────────────────

interface PegContextCardProps {
  ticker: string;
  companyName?: string;
  sector?: string;
  /** Kompaktmodus für StockDetail Quick-Metrics (nur Badge + Tooltip) */
  compact?: boolean;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

/** Exported helper: maps (peg, epsGrowth) to quadrant for table coloring */
export function getPegQuadrant(
  peg: number | null,
  epsGrowth: number | null
): 'value_growth' | 'growth_premium' | 'value_slow' | 'expensive_slow' | null {
  if (peg === null) return null;
  const isLowPeg = peg < 1.5;
  const isHighGrowth = epsGrowth !== null ? epsGrowth > 10 : peg < 1.0;
  if (isLowPeg && isHighGrowth) return 'value_growth';
  if (!isLowPeg && isHighGrowth) return 'growth_premium';
  if (isLowPeg && !isHighGrowth) return 'value_slow';
  return 'expensive_slow';
}

function fmt(v: number | null | undefined, suffix = "", decimals = 1): string {
  if (v === null || v === undefined) return "—";
  return `${v.toFixed(decimals)}${suffix}`;
}

function pegColor(peg: number | null): string {
  if (peg === null) return "text-gray-400";
  if (peg < 1) return "text-emerald-400";
  if (peg < 1.5) return "text-yellow-400";
  if (peg < 2.5) return "text-orange-400";
  return "text-red-400";
}

function pegBadgeVariant(peg: number | null): "default" | "secondary" | "destructive" | "outline" {
  if (peg === null) return "outline";
  if (peg < 1) return "default";
  if (peg < 2) return "secondary";
  return "destructive";
}

function stabilityColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-yellow-400";
  return "text-red-400";
}

function qualityColor(score: number): string {
  if (score >= 65) return "text-emerald-400";
  if (score >= 45) return "text-yellow-400";
  return "text-red-400";
}

function ampelIcon(ampel: "gruen" | "gelb" | "rot") {
  if (ampel === "gruen") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (ampel === "gelb") return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
  return <XCircle className="h-4 w-4 text-red-400" />;
}

// ─── Quadrant-Visualisierung ─────────────────────────────────────────────────

function PegQuadrantChart({
  quadrant,
  trailingPE,
  epsGrowth,
}: {
  quadrant: string;
  trailingPE: number | null;
  epsGrowth: number | null;
}) {
  const isValueGrowth = quadrant === "value_growth";
  const isValueSlow = quadrant === "value_slow";
  const isGrowthPremium = quadrant === "growth_premium";
  const isExpensiveSlow = quadrant === "expensive_slow";

  const cellBase = "flex flex-col items-center justify-center p-2 rounded text-center text-xs transition-all";
  const active = "ring-2 ring-[#00CFC1] bg-[#00CFC1]/15 text-white font-semibold";
  const inactive = "bg-white/5 text-gray-500";

  return (
    <div className="space-y-1">
      {/* Achsenbeschriftung oben */}
      <div className="flex items-center justify-between px-1 text-[10px] text-gray-500">
        <span className="w-12 text-center">Niedriges PE</span>
        <span className="flex-1 text-center text-gray-600">← KGV →</span>
        <span className="w-12 text-center">Hohes PE</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {/* Oben links: Value + Wachstum (ideal) */}
        <div className={`${cellBase} ${isValueGrowth ? active : inactive}`}>
          <TrendingUp className={`h-3 w-3 mb-0.5 ${isValueGrowth ? "text-emerald-400" : ""}`} />
          <span>Value + Wachstum</span>
          <span className="text-[9px] opacity-70">Attraktiv</span>
        </div>
        {/* Oben rechts: Wachstumsprämie */}
        <div className={`${cellBase} ${isGrowthPremium ? active : inactive}`}>
          <TrendingUp className={`h-3 w-3 mb-0.5 ${isGrowthPremium ? "text-yellow-400" : ""}`} />
          <span>Wachstumsprämie</span>
          <span className="text-[9px] opacity-70">Prüfen</span>
        </div>
        {/* Unten links: Value / Niedriges Wachstum */}
        <div className={`${cellBase} ${isValueSlow ? active : inactive}`}>
          <Minus className={`h-3 w-3 mb-0.5 ${isValueSlow ? "text-blue-400" : ""}`} />
          <span>Value / Langsam</span>
          <span className="text-[9px] opacity-70">Value-Falle?</span>
        </div>
        {/* Unten rechts: Teuer / Niedriges Wachstum */}
        <div className={`${cellBase} ${isExpensiveSlow ? active : inactive}`}>
          <TrendingDown className={`h-3 w-3 mb-0.5 ${isExpensiveSlow ? "text-red-400" : ""}`} />
          <span>Teuer / Langsam</span>
          <span className="text-[9px] opacity-70">Meiden</span>
        </div>
      </div>
      {/* Achsenbeschriftung unten */}
      <div className="flex items-center justify-between px-1 text-[10px] text-gray-500">
        <span className="w-12 text-center">Hohes Wachstum</span>
        <span className="flex-1 text-center text-gray-600">← EPS-Wachstum →</span>
        <span className="w-12 text-center">Niedriges Wachstum</span>
      </div>
    </div>
  );
}

// ─── KI-Interpretation Panel ─────────────────────────────────────────────────

function KiInterpretationPanel({
  ticker,
  companyName,
  sector,
}: {
  ticker: string;
  companyName?: string;
  sector?: string;
}) {
  const [open, setOpen] = useState(false);
  const interpret = trpc.analytics.interpretQualityMetrics.useMutation();

  const handleClick = () => {
    if (!open && !interpret.data) {
      interpret.mutate({ ticker, companyName, sector });
    }
    setOpen(!open);
  };

  return (
    <div className="border-t border-white/10 pt-3">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        className="w-full gap-2 border-[#00CFC1]/30 text-[#00CFC1] hover:bg-[#00CFC1]/10 hover:text-[#00CFC1]"
        disabled={interpret.isPending}
      >
        {interpret.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        KI-Interpretation
        {open ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
      </Button>

      {open && interpret.data && (
        <div className="mt-3 space-y-3 rounded-lg bg-[#0f1420] border border-[#00CFC1]/20 p-4">
          {/* Ampel + Fazit */}
          <div className="flex items-start gap-2">
            {ampelIcon(interpret.data.ampel)}
            <p className="text-sm text-white font-medium leading-snug">{interpret.data.fazit}</p>
          </div>

          <div className="grid gap-3">
            {/* Bewertung */}
            <div>
              <div className="text-[10px] font-semibold text-[#00CFC1] uppercase tracking-wider mb-1">
                Bewertung
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">{interpret.data.bewertung}</p>
            </div>
            {/* Qualität */}
            <div>
              <div className="text-[10px] font-semibold text-[#00CFC1] uppercase tracking-wider mb-1">
                Qualität
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">{interpret.data.qualitaet}</p>
            </div>
            {/* Risiko */}
            <div>
              <div className="text-[10px] font-semibold text-[#00CFC1] uppercase tracking-wider mb-1">
                Risiko
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">{interpret.data.risiko}</p>
            </div>
          </div>
        </div>
      )}

      {open && interpret.isError && (
        <div className="mt-2 text-xs text-red-400 text-center">
          Fehler: {interpret.error?.message}
        </div>
      )}
    </div>
  );
}

// ─── Kompakt-Badge (für StockDetail Quick-Metrics) ────────────────────────────

export function PegBadge({ ticker }: { ticker: string }) {
  const { data, isLoading } = trpc.analytics.qualityMetrics.useQuery({ ticker });

  if (isLoading) return <span className="text-gray-500 text-sm">—</span>;
  if (!data) return <span className="text-gray-500 text-sm">—</span>;

  const peg = data.adjustedPeg ?? data.trailingPeg;
  const label = data.pegQuadrantLabel;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1 cursor-help">
          <Badge
            variant={pegBadgeVariant(peg)}
            className="font-mono text-xs"
          >
            {fmt(peg, "", 2)}
          </Badge>
          <span className="text-[10px] text-gray-500">{label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs bg-[#1a1f2e] border-[#00CFC1]/20 text-white">
        <div className="space-y-1 text-xs">
          <div className="font-semibold text-[#00CFC1]">Adjusted PEG</div>
          <div>Trailing PEG: {fmt(data.trailingPeg, "", 2)}</div>
          <div>Forward PEG: {fmt(data.forwardPeg, "", 2)}</div>
          <div>EPS-Stabilität: {data.epsStabilityScore}/100</div>
          <div>ROIC: {fmt(data.roic, "%")}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function PegContextCard({ ticker, companyName, sector, compact }: PegContextCardProps) {
  const { data, isLoading, error } = trpc.analytics.qualityMetrics.useQuery({ ticker });

  if (compact) {
    return <PegBadge ticker={ticker} />;
  }

  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-[#00CFC1]" />
          PEG-Analyse & Qualitätsbewertung
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-gray-500 cursor-help ml-1" />
            </TooltipTrigger>
            <TooltipContent className="max-w-sm bg-[#1a1f2e] border-[#00CFC1]/20 text-white text-xs">
              <p>
                <strong>Adjusted PEG</strong> = Trailing PEG × (1 + EPS-Volatilität) ÷ Qualitätsmultiplikator.
                Korrigiert den PEG für Gewinnstabilität und Unternehmensqualität (ROIC, Margen, ROE).
              </p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#00CFC1]" />
            <span className="ml-2 text-sm text-gray-400">Lade EODHD-Daten…</span>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-400 text-center py-4">
            Fehler beim Laden: {error.message}
          </div>
        )}

        {data && (
          <>
            {/* ── PEG-Kennzahlen ─────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#0f1420] rounded-lg p-3 border border-white/10">
                <div className="text-[10px] text-gray-400 mb-1">Trailing PEG</div>
                <div className={`text-lg font-bold font-mono ${pegColor(data.trailingPeg)}`}>
                  {fmt(data.trailingPeg, "", 2)}
                </div>
                <div className="text-[9px] text-gray-500 mt-0.5">EODHD</div>
              </div>
              <div className="bg-[#0f1420] rounded-lg p-3 border border-white/10">
                <div className="text-[10px] text-gray-400 mb-1">Forward PEG</div>
                <div className={`text-lg font-bold font-mono ${pegColor(data.forwardPeg)}`}>
                  {fmt(data.forwardPeg, "", 2)}
                </div>
                <div className="text-[9px] text-gray-500 mt-0.5">Nächstes Jahr</div>
              </div>
              <div className="bg-[#0f1420] rounded-lg p-3 border border-[#00CFC1]/30">
                <div className="text-[10px] text-[#00CFC1] mb-1 flex items-center gap-1">
                  Adjusted PEG
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-2.5 w-2.5 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs bg-[#1a1f2e] border-[#00CFC1]/20 text-white text-xs">
                      Korrigiert für EPS-Volatilität (CV={fmt(data.epsVolatility, "", 2)}) und
                      Qualitätsscore ({data.qualityScore}/100)
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className={`text-lg font-bold font-mono ${pegColor(data.adjustedPeg)}`}>
                  {fmt(data.adjustedPeg, "", 2)}
                </div>
                <div className="text-[9px] text-gray-500 mt-0.5">Volatilitätskorrigiert</div>
              </div>
            </div>

            {/* ── PEG-Quadrant ───────────────────────────────────────────── */}
            <div>
              <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                Quadrant-Einordnung
                <Badge variant="outline" className="text-[10px] border-[#00CFC1]/30 text-[#00CFC1]">
                  {data.pegQuadrantLabel}
                </Badge>
              </div>
              <PegQuadrantChart
                quadrant={data.pegQuadrant}
                trailingPE={data.trailingPE}
                epsGrowth={data.epsGrowthTTM}
              />
            </div>

            {/* ── Qualitäts- und Risikokennzahlen ────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              {/* Qualität */}
              <div className="space-y-2">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Qualität
                </div>
                <MetricRow label="ROIC" value={fmt(data.roic, "%")} color={data.roic !== null ? (data.roic > 15 ? "text-emerald-400" : data.roic > 8 ? "text-yellow-400" : "text-red-400") : "text-gray-400"} tooltip="Return on Invested Capital: NOPAT / Investiertes Kapital. > 15% = exzellent" />
                <MetricRow label="ROE" value={fmt(data.returnOnEquity, "%")} color={data.returnOnEquity !== null ? (data.returnOnEquity > 20 ? "text-emerald-400" : data.returnOnEquity > 10 ? "text-yellow-400" : "text-red-400") : "text-gray-400"} tooltip="Return on Equity" />
                <MetricRow label="Bruttomarge" value={fmt(data.grossMargin, "%")} color="text-white" tooltip="Bruttomarge TTM" />
                <MetricRow label="Betriebsmarge" value={fmt(data.operatingMargin, "%")} color="text-white" tooltip="Operative Marge TTM" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">Quality-Score</span>
                  <div className="flex items-center gap-1">
                    <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${data.qualityScore >= 65 ? "bg-emerald-400" : data.qualityScore >= 45 ? "bg-yellow-400" : "bg-red-400"}`}
                        style={{ width: `${data.qualityScore}%` }}
                      />
                    </div>
                    <span className={`text-xs font-mono font-bold ${qualityColor(data.qualityScore)}`}>
                      {data.qualityScore}
                    </span>
                  </div>
                </div>
              </div>

              {/* Risiko / Stabilität */}
              <div className="space-y-2">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Stabilität & Risiko
                </div>
                <MetricRow
                  label="EPS-Volatilität (CV)"
                  value={data.epsVolatility !== null ? data.epsVolatility.toFixed(2) : "—"}
                  color={data.epsVolatility !== null ? (data.epsVolatility < 0.3 ? "text-emerald-400" : data.epsVolatility < 0.7 ? "text-yellow-400" : "text-red-400") : "text-gray-400"}
                  tooltip="Variationskoeffizient der jährlichen EPS-Wachstumsraten (10J). Niedrig = stabile Gewinne."
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">EPS-Stabilität</span>
                  <div className="flex items-center gap-1">
                    <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${data.epsStabilityScore >= 70 ? "bg-emerald-400" : data.epsStabilityScore >= 40 ? "bg-yellow-400" : "bg-red-400"}`}
                        style={{ width: `${data.epsStabilityScore}%` }}
                      />
                    </div>
                    <span className={`text-xs font-mono font-bold ${stabilityColor(data.epsStabilityScore)}`}>
                      {data.epsStabilityScore}
                    </span>
                  </div>
                </div>
                <MetricRow
                  label="EPS Surprise-Rate"
                  value={fmt(data.surpriseRate, "%", 0)}
                  color={data.surpriseRate !== null ? (data.surpriseRate >= 75 ? "text-emerald-400" : data.surpriseRate >= 50 ? "text-yellow-400" : "text-red-400") : "text-gray-400"}
                  tooltip="Anteil der letzten 8 Quartale mit positivem EPS-Surprise (Actual > Estimate)"
                />
                <MetricRow
                  label="Net Debt/EBITDA"
                  value={fmt(data.netDebtToEbitda, "x", 2)}
                  color={data.netDebtToEbitda !== null ? (data.netDebtToEbitda < 1.5 ? "text-emerald-400" : data.netDebtToEbitda < 3 ? "text-yellow-400" : "text-red-400") : "text-gray-400"}
                  tooltip="Nettoverschuldung / EBITDA. < 1.5x = konservativ, > 3x = hoch"
                />
                <MetricRow label="EPS-CAGR 5J" value={fmt(data.epsGrowth5y, "% p.a.")} color="text-white" tooltip="Jährliches EPS-Wachstum der letzten 5 Jahre" />
              </div>
            </div>

            {/* ── Wachstum ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/10">
              <div className="text-center">
                <div className="text-[10px] text-gray-400">EPS-Wachstum TTM</div>
                <div className={`text-sm font-bold font-mono mt-0.5 ${data.epsGrowthTTM !== null ? (data.epsGrowthTTM > 10 ? "text-emerald-400" : data.epsGrowthTTM > 0 ? "text-yellow-400" : "text-red-400") : "text-gray-400"}`}>
                  {fmt(data.epsGrowthTTM, "%")}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-400">Umsatz TTM</div>
                <div className={`text-sm font-bold font-mono mt-0.5 ${data.revenueGrowthTTM !== null ? (data.revenueGrowthTTM > 10 ? "text-emerald-400" : data.revenueGrowthTTM > 0 ? "text-yellow-400" : "text-red-400") : "text-gray-400"}`}>
                  {fmt(data.revenueGrowthTTM, "%")}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-400">EPS-CAGR 5J</div>
                <div className={`text-sm font-bold font-mono mt-0.5 ${data.epsGrowth5y !== null ? (data.epsGrowth5y > 10 ? "text-emerald-400" : data.epsGrowth5y > 0 ? "text-yellow-400" : "text-red-400") : "text-gray-400"}`}>
                  {fmt(data.epsGrowth5y, "% p.a.")}
                </div>
              </div>
            </div>

            {/* ── KI-Interpretation ───────────────────────────────────────── */}
            <KiInterpretationPanel ticker={ticker} companyName={companyName} sector={sector} />

            {/* Datenquelle */}
            <div className="text-[9px] text-gray-600 text-right">
              Quelle: {data.dataSource} · {new Date(data.lastUpdated).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Hilfskomponente ─────────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  color,
  tooltip,
}: {
  label: string;
  value: string;
  color: string;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-gray-400">{label}</span>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-2.5 w-2.5 text-gray-600 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs bg-[#1a1f2e] border-[#00CFC1]/20 text-white text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <span className={`text-xs font-mono font-semibold ${color}`}>{value}</span>
    </div>
  );
}
