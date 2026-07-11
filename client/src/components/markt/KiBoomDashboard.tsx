/**
 * KI-Boom Warnsystem Dashboard
 * Integriert in die Markt-Seite (MarktHub) als eigener Tab.
 * Zeigt Echtzeit-Signale, Warnstufen und Ausstiegsempfehlungen.
 */
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

// ── Subkomponenten ─────────────────────────────────────────────────────────

function OverallStatusBanner({ zone, warnings, critical, exitRecommended, exitReason }: {
  zone: BoomZone;
  warnings: number;
  critical: number;
  exitRecommended: boolean;
  exitReason: string | null;
}) {
  const bgClass = zoneBg(zone);
  const colorClass = zoneColor(zone);
  const statusText = {
    gruen: "GRÜNE ZONE – Boom intakt",
    gelb:  "GELBE ZONE – Erhöhte Vorsicht",
    rot:   "ROTE ZONE – Ausstieg prüfen",
  }[zone];

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
        <div className="mt-4 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded p-3">
          <Zap className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-300"><strong>Ausstiegsempfehlung:</strong> {exitReason}</p>
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

function WatchlistTable() {
  const items = [
    { freq: "Täglich",      metric: "Nvidia, MSFT, GOOGL, AMZN, META, AAPL, TSLA Kurse", source: "Markt-Daten" },
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
  const { data, isLoading, isError, refetch, isFetching } = trpc.kiBoom.getDashboard.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,   // 5 Minuten Cache
    refetchInterval: 10 * 60 * 1000, // Auto-Update alle 10 Minuten
    retry: 2,
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
      />

      {/* Statische Schlüsselmetriken */}
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Schlüsselmetriken (Research-basiert)</p>
        <StaticMetricsGrid metrics={data.staticMetrics} />
      </div>

      {/* Signal-Grid + Radar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Signale */}
        <div className="xl:col-span-2 space-y-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Live-Signale</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.signals.map((signal: any) => (
              <SignalCard key={signal.label} signal={signal} />
            ))}
          </div>
        </div>

        {/* Radar + Szenarien */}
        <div className="space-y-4">
          <RadarOverview signals={data.signals} />

          {/* Szenarien */}
          <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-1">Szenarien 2026–2029</h3>
            <p className="text-[11px] text-gray-500 mb-4">Wahrscheinlichkeiten basierend auf historischen Zyklen</p>
            <ScenarioBar
              label="Sanfte Verlangsamung"
              prob={data.scenarioProbabilities.sanfteVerlangsamung}
              color="#00CFC1"
            />
            <ScenarioBar
              label="Schneller Crash"
              prob={data.scenarioProbabilities.schnellerCrash}
              color="#f59e0b"
            />
            <ScenarioBar
              label="Weiterhin Boom"
              prob={data.scenarioProbabilities.weiterhinBoom}
              color="#6366f1"
            />
            <div className="mt-4 pt-3 border-t border-white/10">
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Wahrscheinlichstes Szenario: <strong className="text-amber-400">Schneller Crash (40%)</strong> — Erste Risse 2026–27, starker Rückgang 2027–28.
                </p>
              </div>
            </div>
          </div>
        </div>
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

      {/* Ausstiegskriterien */}
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-amber-400/20">
        <CardHeader className="pb-2 pt-5 px-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Ausstiegskriterien</h3>
          </div>
          <p className="text-[11px] text-gray-500">Ausstieg empfohlen, wenn folgende Bedingungen eintreten</p>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest mb-2">Gelbe Zone (Warnung)</p>
              <ul className="space-y-1.5">
                {[
                  "VC-Finanzierung KI fällt unter 50%",
                  "Magnificent Seven YTD unter +5%",
                  "Hyperscaler kündigen CapEx-Kürzungen an",
                  "OpenAI Verlustquote steigt über 70%",
                  "Mehrere KI-Startups mit Entlassungswellen",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-gray-300">
                    <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest mb-2">Rote Zone (Sofortiger Ausstieg)</p>
              <ul className="space-y-1.5">
                {[
                  "VC-Finanzierung KI fällt unter 40%",
                  "Magnificent Seven YTD unter -10%",
                  "GPU-Lieferzeiten unter 10 Wochen (Überangebot)",
                  "Private Debt Ausfallquoten KI über 5%",
                  "Hyperscaler-Aktien -30% vs. S&P 500",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-gray-300">
                    <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-start gap-2 bg-[#00CFC1]/5 border border-[#00CFC1]/20 rounded p-3">
              <CheckCircle2 className="w-4 h-4 text-[#00CFC1] mt-0.5 shrink-0" />
              <p className="text-xs text-gray-300">
                <strong className="text-[#00CFC1]">Erforderlich für Boom-Fortsetzung:</strong> OpenAI oder andere KI-Startups zeigen Profitabilität · Hyperscaler-Margen steigen durch KI-Umsätze · Copilot/KI-Produkte werden massiv monetarisiert · KI-Pilotprojekte zeigen &gt;30% ROI-Erfolgsquote.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quellen-Hinweis */}
      <p className="text-[10px] text-gray-600 text-center">
        Quellen: Bloomberg, Financial Times, PitchBook, McKinsey Global Institute, Gartner Hype Cycle, OpenAI Finanzdaten · Statische Metriken werden quartalsweise aktualisiert · Marktdaten via Echtzeit-API.
      </p>
    </div>
  );
}
