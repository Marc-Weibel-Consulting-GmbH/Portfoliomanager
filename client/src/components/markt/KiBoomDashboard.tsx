/**
 * KI-Boom Warnsystem Dashboard
 * Integriert in die Markt-Seite (MarktHub) als eigener Tab.
 * Zeigt Echtzeit-Signale, Warnstufen, historische Charts und Ausstiegsempfehlungen.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Info,
  Zap,
  History,
  Activity,
  Newspaper,
  ExternalLink,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

// ── Typen ──────────────────────────────────────────────────────────────────
type BoomZone = "gruen" | "gelb" | "rot";

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

function zoneColor(zone: BoomZone): string {
  switch (zone) {
    case "gruen": return "text-[#00CFC1]";
    case "gelb":  return "text-amber-400";
    case "rot":   return "text-red-400";
  }
}

function zoneBg(zone: BoomZone): string {
  switch (zone) {
    case "gruen": return "bg-[#00CFC1]/10 border-[#00CFC1]/30";
    case "gelb":  return "bg-amber-400/10 border-amber-400/30";
    case "rot":   return "bg-red-400/10 border-red-400/30";
  }
}

function zoneLabel(zone: BoomZone): string {
  switch (zone) {
    case "gruen": return "OK";
    case "gelb":  return "Warnung";
    case "rot":   return "Kritisch";
  }
}

function ZoneIcon({ zone, size = "w-4 h-4" }: { zone: BoomZone; size?: string }) {
  switch (zone) {
    case "gruen": return <CheckCircle2 className={`${size} text-[#00CFC1]`} />;
    case "gelb":  return <AlertTriangle className={`${size} text-amber-400`} />;
    case "rot":   return <XCircle className={`${size} text-red-400`} />;
  }
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  switch (trend) {
    case "up":     return <TrendingUp className="w-3.5 h-3.5 text-[#00CFC1]" />;
    case "down":   return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
    case "stable": return <Minus className="w-3.5 h-3.5 text-gray-400" />;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("de-CH", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" });
}

// ── Subkomponenten ─────────────────────────────────────────────────────────

function OverallStatusBanner({ zone, warnings, critical, exitRecommended, exitReason, szenarioKontext }: {
  zone: BoomZone;
  warnings: number;
  critical: number;
  exitRecommended: boolean;
  exitReason: string | null;
  szenarioKontext: string | null;
}) {
  const bgClass = zoneBg(zone);
  const colorClass = zoneColor(zone);
  const statusText = {
    gruen: "GRÜNE ZONE – Boom intakt",
    gelb:  "GELBE ZONE – Erhöhte Vorsicht",
    rot:   "ROTE ZONE – Ausstieg prüfen",
  }[zone];

  // Unterscheide zwischen "sofortigem Ausstieg" und "Beobachten"
  const isSofortigerAusstieg = critical >= 2 || warnings >= 5;

  return (
    <div className={`border rounded-lg p-5 ${bgClass}`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ZoneIcon zone={zone} size="w-6 h-6" />
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">KI-BOOM STATUS</p>
            <h2 className={`text-xl font-bold ${colorClass}`}>{statusText}</h2>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-400">{warnings}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Warnungen</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-400">{critical}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Kritisch</p>
          </div>
        </div>
      </div>

      {exitRecommended && exitReason && (
        <div className={`mt-4 flex items-start gap-2 rounded p-3 ${
          isSofortigerAusstieg
            ? "bg-red-500/10 border border-red-500/30"
            : "bg-amber-500/10 border border-amber-500/30"
        }`}>
          {isSofortigerAusstieg
            ? <Zap className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            : <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          }
          <div>
            <p className={`text-sm font-semibold ${isSofortigerAusstieg ? "text-red-300" : "text-amber-300"}`}>
              {isSofortigerAusstieg ? "Ausstiegsempfehlung:" : "Beobachtungsmodus:"}
            </p>
            <p className={`text-sm ${isSofortigerAusstieg ? "text-red-300" : "text-amber-300"}`}>{exitReason}</p>
          </div>
        </div>
      )}

      {szenarioKontext && (
        <div className="mt-3 flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded p-3">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-300">{szenarioKontext}</p>
        </div>
      )}
    </div>
  );
}

function SignalCard({ signal }: { signal: any }) {
  const bgClass = zoneBg(signal.zone as BoomZone);
  const colorClass = zoneColor(signal.zone as BoomZone);

  return (
    <TooltipProvider>
      <div className={`border rounded-lg p-4 ${bgClass} transition-all hover:scale-[1.01]`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <ZoneIcon zone={signal.zone as BoomZone} />
            <span className="text-sm font-semibold text-white">{signal.label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendIcon trend={signal.trend} />
            <Badge
              variant="outline"
              className={`text-[10px] px-2 py-0 border ${
                signal.zone === "gruen" ? "border-[#00CFC1]/40 text-[#00CFC1]" :
                signal.zone === "gelb"  ? "border-amber-400/40 text-amber-400" :
                                          "border-red-400/40 text-red-400"
              }`}
            >
              {zoneLabel(signal.zone as BoomZone)}
            </Badge>
          </div>
        </div>

        <p className={`text-2xl font-bold font-mono ${colorClass} mb-2`}>{signal.value}</p>

        <p className="text-xs text-gray-400 leading-relaxed mb-3">{signal.description}</p>

        <div className="flex gap-4 text-[10px] text-gray-500">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 cursor-help">
                <AlertTriangle className="w-3 h-3 text-amber-400/60" />
                Warnung: {signal.warnThreshold}
              </span>
            </TooltipTrigger>
            <TooltipContent className="bg-[#1a1f2e] border-white/10 text-xs">
              Warnschwelle: {signal.warnThreshold}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 cursor-help">
                <XCircle className="w-3 h-3 text-red-400/60" />
                Kritisch: {signal.criticalThreshold}
              </span>
            </TooltipTrigger>
            <TooltipContent className="bg-[#1a1f2e] border-white/10 text-xs">
              Kritische Schwelle: {signal.criticalThreshold}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}

function RadarOverview({ signals }: { signals: any[] }) {
  const data = signals.map((s) => ({
    subject: s.label.length > 18 ? s.label.slice(0, 16) + "…" : s.label,
    value: s.zone === "gruen" ? 3 : s.zone === "gelb" ? 2 : 1,
    fullMark: 3,
  }));

  return (
    <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-white mb-1">Signal-Radar</h3>
      <p className="text-[11px] text-gray-500 mb-4">Grün = 3 (OK) · Gelb = 2 (Warnung) · Rot = 1 (Kritisch)</p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="#1e2840" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <Radar
              name="Status"
              dataKey="value"
              stroke="#00CFC1"
              fill="#00CFC1"
              fillOpacity={0.25}
              strokeWidth={2}
            />
            <RechartsTooltip
              contentStyle={{ backgroundColor: "#1a1f2e", border: "1px solid #00CFC1", borderRadius: "6px", fontSize: "12px" }}
              formatter={(v: number) => [v === 3 ? "OK" : v === 2 ? "Warnung" : "Kritisch", "Status"]}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ScenarioBar({ label, prob, color }: { label: string; prob: number; color: string }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="font-mono font-semibold text-white">{prob}%</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${prob}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function StaticMetricsGrid({ metrics }: { metrics: any }) {
  const items = [
    { label: "OpenAI Umsatz H1 2025", value: metrics.openAiUmsatz2025, note: "Bloomberg" },
    { label: "OpenAI Verlust H1 2025", value: metrics.openAiVerlust2025, note: "Bloomberg", negative: true },
    { label: "Anthropic Bewertung", value: metrics.anthropicBewertung, note: "Q2 2026" },
    { label: "OpenAI Bewertung", value: metrics.openAiBewertung, note: "Q2 2026" },
    { label: "Hyperscaler CapEx 2026", value: metrics.hyperscalerCapex2026, note: "4 Unternehmen" },
    { label: "VC-Anteil KI 2025", value: `${metrics.vcAnteilKI}%`, note: "PitchBook" },
    { label: "VC-Gesamtvolumen", value: metrics.vcGesamtvolumen, note: "PitchBook 2025" },
    { label: "Pilotprojekte mit ROI", value: `${metrics.pilotProjektROIQuote}%`, note: "McKinsey/Gartner", negative: true },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border border-white/10 rounded-lg overflow-hidden">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`bg-[#0f1420] p-4 ${i % 4 !== 3 ? "border-r border-white/10" : ""} ${i < 4 ? "border-b border-white/10" : ""}`}
        >
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5 leading-tight">{item.label}</p>
          <p className={`text-lg font-bold font-mono ${item.negative ? "text-red-400" : "text-white"}`}>{item.value}</p>
          <p className="text-[10px] text-gray-600 mt-0.5">{item.note}</p>
        </div>
      ))}
    </div>
  );
}

// ── Historische Charts ─────────────────────────────────────────────────────

interface MetricChartConfig {
  key: string;
  label: string;
  unit: string;
  color: string;
  warnLevel?: number;
  critLevel?: number;
  higherIsBetter: boolean;
  description: string;
}

const METRIC_CHARTS: MetricChartConfig[] = [
  {
    key: "mag7AvgYtd",
    label: "Magnificent Seven YTD",
    unit: "%",
    color: "#6366f1",
    warnLevel: 5,
    critLevel: -10,
    higherIsBetter: true,
    description: "Durchschnittliche YTD-Performance der 7 grössten KI-Aktien",
  },
  {
    key: "soxPrice",
    label: "SOX Halbleiter-ETF",
    unit: "$",
    color: "#f59e0b",
    warnLevel: 180,
    critLevel: 140,
    higherIsBetter: true,
    description: "SOXX ETF – Proxy für KI-Chip-Nachfrage (Warnung <$180, Kritisch <$140)",
  },
  {
    key: "arkkPrice",
    label: "ARKK Innovation ETF",
    unit: "$",
    color: "#8b5cf6",
    warnLevel: 55,
    critLevel: 40,
    higherIsBetter: true,
    description: "ARKK – Proxy für Spekulationsfieber / Risikoappetit (Warnung <$55, Kritisch <$40)",
  },
  {
    key: "creditSpreadHY",
    label: "Credit Spreads (High Yield)",
    unit: "$",
    color: "#f97316",
    warnLevel: 75,
    critLevel: 65,
    higherIsBetter: true,
    description: "HYG ETF – High Yield Bond Proxy (fallender Kurs = steigende Spreads = Risikoaversion)",
  },
  {
    key: "creditSpreadIG",
    label: "Credit Spreads (Investment Grade)",
    unit: "$",
    color: "#ec4899",
    warnLevel: 100,
    critLevel: 90,
    higherIsBetter: true,
    description: "LQD ETF – Investment Grade Bond Proxy (fallender Kurs = steigende IG-Spreads)",
  },
  {
    key: "vixLevel",
    label: "VIX Volatilitätsindex",
    unit: "",
    color: "#10b981",
    warnLevel: 25,
    critLevel: 35,
    higherIsBetter: false,
    description: "VIX – Marktangst-Indikator (Warnung >25, Kritisch >35)",
  },
];

function MetricHistoryChart({
  config,
  history,
}: {
  config: MetricChartConfig;
  history: any[];
}) {
  // Deduplicate by date: keep only the last entry per calendar day to avoid
  // vertical spikes caused by multiple intra-day snapshots on the same date label.
  const dedupMap = new Map<string, number>();
  history
    .filter((h) => h[config.key] != null)
    .forEach((h) => {
      const dateKey = h.date; // already ISO date string YYYY-MM-DD
      dedupMap.set(dateKey, h[config.key]);
    });
  const chartData = Array.from(dedupMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date: formatShortDate(date),
      value,
    }));

  if (chartData.length === 0) {
    return (
      <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-white/10 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-3.5 h-3.5 text-gray-500" />
          <h4 className="text-xs font-semibold text-white">{config.label}</h4>
        </div>
        <p className="text-[10px] text-gray-500 mb-3">{config.description}</p>
        <div className="h-28 flex items-center justify-center">
          <p className="text-[11px] text-gray-600">Noch keine historischen Daten verfügbar.</p>
          <p className="text-[10px] text-gray-700 mt-1">Daten werden täglich um 23:30 UTC gespeichert.</p>
        </div>
      </div>
    );
  }

  const values = chartData.map((d) => d.value).filter((v) => v != null);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const padding = (maxVal - minVal) * 0.15 || 5;

  return (
    <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-white/10 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="w-3.5 h-3.5" style={{ color: config.color }} />
        <h4 className="text-xs font-semibold text-white">{config.label}</h4>
      </div>
      <p className="text-[10px] text-gray-500 mb-3">{config.description}</p>
      <div style={{ height: 120 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2840" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#6b7280", fontSize: 9 }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#6b7280", fontSize: 9 }}
              tickLine={false}
              domain={[minVal - padding, maxVal + padding]}
              tickFormatter={(v) => `${v.toFixed(0)}${config.unit === "$" ? "" : ""}`}
            />
            <RechartsTooltip
              contentStyle={{ backgroundColor: "#1a1f2e", border: `1px solid ${config.color}`, borderRadius: "6px", fontSize: "11px" }}
              formatter={(v: number) => [`${config.unit === "$" ? "$" : ""}${v.toFixed(1)}${config.unit !== "$" ? config.unit : ""}`, config.label]}
              labelStyle={{ color: "#9ca3af" }}
            />
            {/* Warn-Linie */}
            {config.warnLevel != null && (
              <ReferenceLine
                y={config.warnLevel}
                stroke="#f59e0b"
                strokeDasharray="4 2"
                strokeWidth={1}
                label={{ value: "Warn", fill: "#f59e0b", fontSize: 8, position: "insideTopRight" }}
              />
            )}
            {/* Kritisch-Linie */}
            {config.critLevel != null && (
              <ReferenceLine
                y={config.critLevel}
                stroke="#ef4444"
                strokeDasharray="4 2"
                strokeWidth={1}
                label={{ value: "Krit.", fill: "#ef4444", fontSize: 8, position: "insideTopRight" }}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={config.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: config.color }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Live-Ausstiegskriterien mit Ampel ──────────────────────────────────────

function ExitCriteriaLive({ signals }: { signals: any[] }) {
  const gelbeKriterien = [
    { label: "VC-Finanzierung KI fällt unter 50%", signalKey: "VC-Anteil KI-Startups", threshold: "< 50%" },
    { label: "Magnificent Seven YTD unter +5%", signalKey: "Magnificent Seven YTD", threshold: "< +5% YTD" },
    { label: "Hyperscaler CapEx-Wachstum über 30% (Überhitzung)", signalKey: "Hyperscaler CapEx-Wachstum", threshold: "> 30% YoY" },
    { label: "OpenAI Verlustquote steigt über 50%", signalKey: "OpenAI Verlustquote", threshold: "> 50%" },
    { label: "KI-Projekt ROI-Erfolgsquote unter 30%", signalKey: "KI-Projekt ROI-Erfolgsquote", threshold: "< 30%" },
  ];

  const roteKriterien = [
    { label: "VC-Finanzierung KI fällt unter 40%", signalKey: "VC-Anteil KI-Startups", threshold: "< 40%" },
    { label: "Magnificent Seven YTD unter -10%", signalKey: "Magnificent Seven YTD", threshold: "< -10% YTD" },
    { label: "Hyperscaler CapEx-Wachstum fällt unter 0%", signalKey: "Hyperscaler CapEx-Wachstum", threshold: "< 0% (Rückgang = Boom-Ende)" },
    { label: "OpenAI Verlustquote über 70%", signalKey: "OpenAI Verlustquote", threshold: "> 70%" },
    { label: "HYG ETF unter $65 (Credit Spreads stark ausgeweitet)", signalKey: "Credit Spreads (High Yield)", threshold: "< $65" },
  ];

  function getSignalZone(signalKey: string): BoomZone {
    const s = signals.find((sig) => sig.label === signalKey);
    return s?.zone ?? "gruen";
  }

  function CriterionRow({ label, signalKey, threshold, targetZone }: {
    label: string;
    signalKey: string;
    threshold: string;
    targetZone: BoomZone;
  }) {
    const currentZone = getSignalZone(signalKey);
    // Kriterium ist "ausgelöst" wenn das Signal in der Zielzone oder schlechter ist
    const isTriggered = targetZone === "gelb"
      ? currentZone === "gelb" || currentZone === "rot"
      : currentZone === "rot";

    return (
      <li className="flex items-start gap-2.5 py-1.5 border-b border-white/5 last:border-0">
        <div className="mt-0.5 shrink-0">
          {isTriggered
            ? <ZoneIcon zone={targetZone} />
            : <CheckCircle2 className="w-4 h-4 text-[#00CFC1]/60" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs ${isTriggered ? (targetZone === "rot" ? "text-red-300 font-semibold" : "text-amber-300 font-semibold") : "text-gray-400"}`}>
            {label}
          </p>
          <p className="text-[10px] text-gray-600 mt-0.5">Schwelle: {threshold}</p>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 shrink-0 ${
            isTriggered
              ? targetZone === "rot"
                ? "border-red-400/40 text-red-400 bg-red-400/10"
                : "border-amber-400/40 text-amber-400 bg-amber-400/10"
              : "border-[#00CFC1]/30 text-[#00CFC1]/60"
          }`}
        >
          {isTriggered ? "Ausgelöst" : "OK"}
        </Badge>
      </li>
    );
  }

  const triggeredGelb = gelbeKriterien.filter((k) => {
    const z = getSignalZone(k.signalKey);
    return z === "gelb" || z === "rot";
  }).length;

  const triggeredRot = roteKriterien.filter((k) => {
    return getSignalZone(k.signalKey) === "rot";
  }).length;

  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-amber-400/20">
      <CardHeader className="pb-2 pt-5 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Ausstiegskriterien – Live-Status</h3>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-[10px] border-amber-400/40 text-amber-400">
              {triggeredGelb} / {gelbeKriterien.length} Warnungen
            </Badge>
            <Badge variant="outline" className="text-[10px] border-red-400/40 text-red-400">
              {triggeredRot} / {roteKriterien.length} Kritisch
            </Badge>
          </div>
        </div>
        <p className="text-[11px] text-gray-500">Echtzeit-Abgleich der Ausstiegskriterien mit aktuellen Signalwerten</p>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest mb-3">Gelbe Zone (Warnung)</p>
            <ul className="space-y-0">
              {gelbeKriterien.map((k) => (
                <CriterionRow key={k.label} {...k} targetZone="gelb" />
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest mb-3">Rote Zone (Sofortiger Ausstieg)</p>
            <ul className="space-y-0">
              {roteKriterien.map((k) => (
                <CriterionRow key={k.label} {...k} targetZone="rot" />
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-white/10 space-y-2">
          <div className="flex items-start gap-2 bg-blue-500/5 border border-blue-500/20 rounded p-3">
            <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-300">
              <strong className="text-blue-400">Szenario-Logik:</strong> Sofortiger Ausstieg erst bei ≥2 kritischen Signalen gleichzeitig oder ≥5 Warnungen. Neutrales Szenario: Heisse Phase 2027/28 – einzelne Warnsignale sind im aktuellen Zyklus normal.
            </p>
          </div>
          <div className="flex items-start gap-2 bg-[#00CFC1]/5 border border-[#00CFC1]/20 rounded p-3">
            <CheckCircle2 className="w-4 h-4 text-[#00CFC1] mt-0.5 shrink-0" />
            <p className="text-xs text-gray-300">
              <strong className="text-[#00CFC1]">Erforderlich für Boom-Fortsetzung:</strong> OpenAI oder andere KI-Startups zeigen Profitabilität · Hyperscaler-Margen steigen durch KI-Umsätze · Copilot/KI-Produkte werden massiv monetarisiert · KI-Pilotprojekte zeigen &gt;30% ROI-Erfolgsquote.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WatchlistTable() {
  const items = [
    { freq: "Täglich",      metric: "MSFT, GOOGL, AMZN, META, AAPL, TSLA Kurse + HYG/LQD Credit Spreads", source: "Markt-Daten" },
    { freq: "Täglich",      metric: "GPU-Preise (H100/H200) und Lieferzeiten", source: "NVIDIA IR / Broker" },
    { freq: "Täglich",      metric: "Fed Funds Rate und 10Y Treasury Yield", source: "Fed / Bloomberg" },
    { freq: "Wöchentlich",  metric: "VC-Finanzierungsankündigungen KI-Startups", source: "Crunchbase / PitchBook" },
    { freq: "Wöchentlich",  metric: "KI-Startup Bewertungsrunden", source: "TechCrunch / Bloomberg" },
    { freq: "Monatlich",    metric: "Hyperscaler CapEx-Ankündigungen", source: "Quartalsberichte" },
    { freq: "Monatlich",    metric: "Energiekosten Rechenzentren", source: "EIA / Versorger" },
    { freq: "Monatlich",    metric: "Regulatorische Entwicklungen (EU AI Act)", source: "EU-Kommission" },
    { freq: "Quartalsweise", metric: "Hyperscaler Gewinnmargen und CapEx-Effizienz", source: "Quartalsberichte" },
    { freq: "Quartalsweise", metric: "OpenAI / Anthropic Verlustquoten", source: "Bloomberg / FT" },
    { freq: "Quartalsweise", metric: "Private Debt Ausfallquoten KI-Sektor", source: "Moody's / S&P" },
    { freq: "Quartalsweise", metric: "Copilot / KI-Produkt Adoption-Metriken", source: "Microsoft / Google IR" },
  ];

  const freqColor: Record<string, string> = {
    "Täglich":       "text-[#00CFC1] bg-[#00CFC1]/10 border-[#00CFC1]/30",
    "Wöchentlich":   "text-blue-400 bg-blue-400/10 border-blue-400/30",
    "Monatlich":     "text-amber-400 bg-amber-400/10 border-amber-400/30",
    "Quartalsweise": "text-purple-400 bg-purple-400/10 border-purple-400/30",
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Frequenz</th>
            <th className="text-left py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Metrik</th>
            <th className="text-left py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Quelle</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-white/5 hover:bg-white/3 transition-colors">
              <td className="py-2 px-3">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${freqColor[item.freq]}`}>
                  {item.freq}
                </span>
              </td>
              <td className="py-2 px-3 text-gray-300 text-xs">{item.metric}</td>
              <td className="py-2 px-3 text-gray-500 text-xs">{item.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Hauptkomponente ────────────────────────────────────────────────────────

export function KiBoomDashboard() {
  const [historyDays, setHistoryDays] = useState(90);

  const { data, isLoading, isError, refetch, isFetching } = trpc.kiBoom.getDashboard.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: 2,
  });

  const utils = trpc.useUtils();
  const { data: historyData, isLoading: historyLoading } = trpc.kiBoom.getHistory.useQuery(
    { days: historyDays },
    { staleTime: 10 * 60 * 1000 }
  );

  const triggerSnapshot = trpc.kiBoom.triggerSnapshot.useMutation({
    onError: (err) => alert(`Snapshot fehlgeschlagen: ${err.message}`),
  });
  const backfillCreditSpreads = trpc.kiBoom.backfillCreditSpreads.useMutation({
    onSuccess: (data) => {
      alert(`Backfill abgeschlossen: ${data.inserted} Einträge eingefügt (${data.dateRange?.from} – ${data.dateRange?.to})`);
      utils.kiBoom.getHistory.invalidate();
    },
    onError: (err) => alert(`Backfill fehlgeschlagen: ${err.message}`),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 bg-white/5 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-48 bg-white/5 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
        <XCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-red-300 mb-3">Dashboard konnte nicht geladen werden.</p>
        <button
          onClick={() => refetch()}
          className="text-xs text-[#00CFC1] hover:text-[#00CFC1]/80 underline transition-colors"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-semibold text-[#00CFC1] uppercase tracking-widest mb-1">KI-BOOM WARNSYSTEM</p>
          <h2 className="text-xl font-bold text-white">KI-Blase Monitor</h2>
          <p className="text-xs text-gray-400 mt-1">
            Echtzeit-Signale zur Beurteilung des KI-Investitionszyklus · Auto-Update alle 10 Min.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-500">
            Stand: {formatDate(data.lastUpdated)}
          </span>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs text-[#00CFC1] hover:text-[#00CFC1]/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Gesamtstatus-Banner */}
      <OverallStatusBanner
        zone={data.overallZone as BoomZone}
        warnings={data.activeWarnings}
        critical={data.activeCritical}
        exitRecommended={data.ausstiegsEmpfehlung}
        exitReason={data.ausstiegsGrund}
        szenarioKontext={(data as any).szenarioKontext ?? null}
      />

      {/* Goldman Sachs Warnung – Aktuelle Forschungswarnung */}
      {(data as any).goldmanSachsWarning && (
        <div className="bg-amber-400/8 border border-amber-400/40 rounded-lg p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="bg-amber-400/15 rounded-md p-1.5 shrink-0 mt-0.5">
              <Newspaper className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">Aktuelle Marktwarnung</span>
                <span className="text-[9px] text-gray-500">{(data as any).goldmanSachsWarning.date} · {(data as any).goldmanSachsWarning.source}</span>
              </div>
              <h3 className="text-sm font-semibold text-white leading-snug">
                {(data as any).goldmanSachsWarning.headline}
              </h3>
            </div>
          </div>
          <p className="text-[12px] text-gray-300 leading-relaxed mb-3">
            {(data as any).goldmanSachsWarning.summary}
          </p>
          <ul className="space-y-1.5">
            {(data as any).goldmanSachsWarning.bullets.map((b: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-gray-400">
                <span className="text-amber-400 mt-0.5 shrink-0">▸</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-amber-400/20 flex items-center gap-2">
            <Info className="w-3 h-3 text-amber-400 shrink-0" />
            <p className="text-[10px] text-gray-500">
              Dieser Datenpunkt fliesst als Signal «Tech-Anleihenmarkt Stress» in den KI-Blase Monitor ein.
            </p>
          </div>
        </div>
      )}

      {/* Statische Schlüsselmetriken */}
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Schlüsselmetriken (Research-basiert)</p>
        <StaticMetricsGrid metrics={data.staticMetrics} />
      </div>

      {/* Signal-Grid + Radar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Live-Signale</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.signals.map((signal: any) => (
              <SignalCard key={signal.label} signal={signal} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <RadarOverview signals={data.signals} />

          {/* Szenarien */}
          <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-1">Szenarien 2026–2029</h3>
            <p className="text-[11px] text-gray-500 mb-4">Wahrscheinlichkeiten basierend auf historischen Zyklen</p>
            <ScenarioBar label="Sanfte Verlangsamung" prob={data.scenarioProbabilities.sanfteVerlangsamung} color="#00CFC1" />
            <ScenarioBar label="Schneller Crash" prob={data.scenarioProbabilities.schnellerCrash} color="#f59e0b" />
            <ScenarioBar label="Weiterhin Boom" prob={data.scenarioProbabilities.weiterhinBoom} color="#6366f1" />
            <div className="mt-4 pt-3 border-t border-white/10">
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Wahrscheinlichstes Szenario: <strong className="text-amber-400">Schneller Crash (40%)</strong> — Erste Risse 2026–27, starker Rückgang 2027–28. Heisse Phase erwartet: <strong className="text-white">2027/28</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live-Ausstiegskriterien */}
      <ExitCriteriaLive signals={data.signals} />

      {/* Historische Charts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#00CFC1]" />
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Historische Entwicklung der Ausstiegskriterien</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">Zeitraum:</span>
            {[30, 60, 90, 180].map((d) => (
              <button
                key={d}
                onClick={() => setHistoryDays(d)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  historyDays === d
                    ? "border-[#00CFC1]/60 text-[#00CFC1] bg-[#00CFC1]/10"
                    : "border-white/10 text-gray-500 hover:border-white/20"
                }`}
              >
                {d}T
              </button>
            ))}
            <button
              onClick={() => triggerSnapshot.mutate()}
              disabled={triggerSnapshot.isPending}
              className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-gray-500 hover:border-white/20 transition-colors disabled:opacity-50"
              title="Manuell einen Snapshot speichern"
            >
              {triggerSnapshot.isPending ? "..." : "Snapshot"}
            </button>
            <button
              onClick={() => backfillCreditSpreads.mutate({ yearsBack: 5 })}
              disabled={backfillCreditSpreads.isPending}
              className="text-[10px] px-2 py-0.5 rounded border border-orange-500/30 text-orange-400 hover:border-orange-500/60 transition-colors disabled:opacity-50"
              title="5 Jahre HYG/LQD Preishistorie von EODHD laden und in DB speichern"
            >
              {backfillCreditSpreads.isPending ? "Lade..." : "Backfill HYG/LQD"}
            </button>
          </div>
        </div>

        {historyLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {METRIC_CHARTS.map((_, i) => (
              <Skeleton key={i} className="h-48 bg-white/5 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {METRIC_CHARTS.map((config) => (
              <MetricHistoryChart
                key={config.key}
                config={config}
                history={historyData?.history ?? []}
              />
            ))}
          </div>
        )}

        {(historyData?.history?.length ?? 0) === 0 && !historyLoading && (
          <div className="mt-2 text-center">
            <p className="text-[11px] text-gray-600">
              Historische Daten werden täglich um 23:30 UTC automatisch gespeichert. Der erste Snapshot wird 8 Minuten nach Server-Start erstellt.
            </p>
          </div>
        )}
      </div>

      {/* Beobachtungs-Roadmap */}
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
        <CardHeader className="pb-2 pt-5 px-5">
          <h3 className="text-sm font-semibold text-white">Beobachtungs-Roadmap</h3>
          <p className="text-[11px] text-gray-500">Welche Metriken in welcher Frequenz zu beobachten sind</p>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <WatchlistTable />
        </CardContent>
      </Card>

      {/* Quellen-Hinweis */}
      <p className="text-[10px] text-gray-600 text-center">
        Quellen: Bloomberg, Financial Times, PitchBook, McKinsey Global Institute, Gartner Hype Cycle, OpenAI Finanzdaten · Statische Metriken werden quartalsweise aktualisiert · Marktdaten via Echtzeit-API · Historische Snapshots täglich 23:30 UTC.
      </p>
    </div>
  );
}
