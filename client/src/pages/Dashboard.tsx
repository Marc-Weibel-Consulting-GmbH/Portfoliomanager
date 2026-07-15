// Dashboard — neues UI/UX-Design gemäss Review-Mockup (F-01, Block 2a).
// Referenz: design/review-mockups/teil1-image1.png (+ README.md dort).
// Aufbau: Header mit Scope-Auswahl (Aggregiert-Button + Portfolio-Dropdown,
// Vorgabe Teil 1 Punkt 3) · KPI-Reihe Gesamtwert/YTD/Sharpe/Bubble (Tooltips
// für Sharpe + Bubble, Punkt 4) · Performance-Chart vs. SMI/MSCI ·
// Allokation-Donut (Sektor/Region) · Positionen-Treemap · Copilot-Insights.
// Das Dashboard ist der einzige Übersichts-Hub: Portfolio-Übersicht (Karten,
// Klick → Portfolio-Details) + Aggregiert, plus drei Widgets aus der früheren
// Portfolios-Seite (Markt-Puls Sektoren, Anstehende Termine, Aktive Alarme).
// Die separate Portfolios-Übersichtsseite wurde entfernt (Doppelspurigkeit).

import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { formatCHF, formatPercent } from "@/lib/format";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, FolderOpen, Info, RefreshCw, AlertTriangle, Trash2, Camera } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as RechartsTooltip,
} from "recharts";
import { PositionsTreemap } from "@/components/dashboard/PositionsTreemap";
import { MarktPuls, AnstehendeTermine, AktiveAlarme } from "@/components/dashboard/MarketSections";

type Scope = "aggregate" | number;
type RangeKey = "1T" | "1M" | "YTD" | "1J" | "Max";

const RANGES: RangeKey[] = ["1T", "1M", "YTD", "1J", "Max"];

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#1a1f2e",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  fontSize: 12,
  color: "#fff",
} as const;

// ----------------------------------------------------------------
// KPI-Reihe: Gesamtwert · YTD · Sharpe · Bubble (Mockup, obere Reihe)
// ----------------------------------------------------------------
function KpiRow({ scope }: { scope: Scope }) {
  const { data: metrics, isLoading, isError, refetch } =
    trpc.dashboard.getAggregatedMetrics.useQuery({ scope });
  // Use TTWROR from chart timeseries as the authoritative YTD value (consistent with chart line)
  const { data: perfData, refetch: refetchPerf } = trpc.dashboard.getPerformanceTimeseries.useQuery(
    { scope, range: "YTD" as any },
    { staleTime: 5 * 60 * 1000, retry: false },
  );
  const { data: riskMetrics, refetch: refetchRisk } = trpc.dashboard.getRiskMetrics.useQuery(
    { scope },
    { staleTime: 5 * 60 * 1000, retry: false },
  );
  const { data: bubbleData, refetch: refetchBubble } = trpc.dashboard.getBubbleIndicator.useQuery(
    { scope },
    { staleTime: 5 * 60 * 1000, retry: false },
  );

  const refetchAll = () => {
    refetch();
    refetchPerf();
    refetchRisk();
    refetchBubble();
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 bg-[#111827] rounded-xl" />
        ))}
      </div>
    );
  }

  // U-07: Fehlgeschlagene Abfrage nicht als «CHF 0» rendern, sondern klar ausweisen
  if (isError) {
    return (
      <Card className="bg-[#0f1420] border-white/10">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
          <span className="text-sm text-gray-300">Daten derzeit nicht verfügbar</span>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs bg-[#1a2332] border-[#2a3a4e] text-gray-200 hover:bg-[#243044]"
            onClick={() => refetchAll()}
          >
            <RefreshCw className="h-3 w-3 mr-1.5" aria-hidden="true" />
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalValue = metrics?.totalValue ?? 0;
  const dayChange = metrics?.dayChange ?? 0;
  const dayChangePercent = metrics?.dayChangePercent ?? 0;
  // Use chart TTWROR endpoint as YTD (consistent with chart line)
  const chartPoints = (perfData as any)?.points;
  const chartYtd = chartPoints?.length > 0 ? chartPoints[chartPoints.length - 1]?.portfolio : null;
  const ytdPercent = chartYtd != null ? chartYtd : (metrics?.totalPerformancePercent ?? 0);
  const smiYtd = (metrics as any)?.benchmarkSmiYtd ?? 0;
  const msciYtd = (metrics as any)?.benchmarkMsciYtd ?? 0;
  const isLive = (metrics?.livePortfolioCount ?? 0) > 0;

  const riskAvailable = (riskMetrics as any)?.dataAvailable !== false && riskMetrics !== undefined;
  const sharpe = (riskMetrics as any)?.sharpeRatio;
  const sharpeBench = (riskMetrics as any)?.sharpeBenchmark;

  const bubbleScore = (bubbleData as any)?.score;
  const bubbleLabel = (bubbleData as any)?.label;
  const bubbleColor =
    (bubbleScore ?? 0) >= 66 ? "text-red-400" : (bubbleScore ?? 0) >= 33 ? "text-amber-400" : "text-emerald-400";

  const tileClass = "bg-[#0f1420] border-white/10 rounded-xl";
  const labelClass = "text-xs text-gray-400 uppercase tracking-wider";

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {/* Gesamtwert */}
      <Card className={tileClass}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className={labelClass}>Gesamtwert</span>
            {isLive && (
              <span className="flex items-center gap-1 text-xs text-positive">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                Live
              </span>
            )}
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2">
            {formatCHF(totalValue, { decimals: 0 })}
          </div>
          <div className="text-xs font-mono mt-2">
            <span className={dayChange >= 0 ? "text-positive" : "text-negative"}>
              {formatCHF(dayChange, { decimals: 0, signDisplay: "always" })}
            </span>
            <span className="text-gray-400"> heute · </span>
            <span className={dayChangePercent >= 0 ? "text-positive" : "text-negative"}>
              {formatPercent(dayChangePercent)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* YTD */}
      <Card className={tileClass}>
        <CardContent className="p-4">
          <div className="flex items-center gap-1.5">
            <span className={labelClass} title="YTD = seit Jahresbeginn">YTD</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="Was bedeutet YTD?" className="text-gray-500 hover:text-gray-300 cursor-help">
                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[#1a1f2e] border-white/20 text-white max-w-[250px] p-3">
                <p className="text-xs font-semibold mb-1">YTD (Year to Date)</p>
                <p className="text-xs text-gray-300">
                  Wertentwicklung Ihrer Portfolios seit Jahresbeginn, in CHF gerechnet.
                  Darunter zum Vergleich die YTD-Entwicklung von SPI und MSCI World.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className={`text-2xl font-bold font-mono mt-2 ${ytdPercent >= 0 ? "text-positive" : "text-negative"}`}>
            {formatPercent(ytdPercent)}
          </div>
          <div className="text-xs font-mono text-gray-400 mt-2">
            SPI {formatPercent(smiYtd, { decimals: 1 })} · MSCI {formatPercent(msciYtd, { decimals: 1 })}
          </div>
        </CardContent>
      </Card>

      {/* Sharpe (mit Hover-Tooltip, Vorgabe Teil 1 Punkt 4) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className={`${tileClass} cursor-help`} aria-label="Sharpe Ratio — Erklärung per Mauszeiger">
            <CardContent className="p-4">
              <span className={labelClass}>Sharpe</span>
              <div className="text-2xl font-bold font-mono text-white mt-2">
                {riskAvailable && typeof sharpe === "number" ? sharpe.toFixed(2) : "—"}
              </div>
              <div className="text-xs font-mono text-gray-400 mt-2">
                {riskAvailable && typeof sharpeBench === "number"
                  ? `Benchmark: ${sharpeBench.toFixed(2)}`
                  : "Keine Daten verfügbar"}
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-[#1a1f2e] border-white/20 text-white max-w-[260px] p-3">
          <p className="text-xs font-semibold mb-1">Sharpe Ratio</p>
          <p className="text-xs text-gray-300">
            Misst die risikoadjustierte Rendite: (Rendite − risikofreier Zins) / Volatilität.
            Werte über 1.0 gelten als gut, über 2.0 als sehr gut. Die Benchmark-Zeile zeigt
            den Vergleichswert des SPI über denselben Zeitraum.
          </p>
        </TooltipContent>
      </Tooltip>

      {/* Bubble (mit Hover-Tooltip, Vorgabe Teil 1 Punkt 4) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className={`${tileClass} cursor-help`} aria-label="Bubble-Indikator — Erklärung per Mauszeiger">
            <CardContent className="p-4">
              <span className={labelClass}>Bubble</span>
              <div className="mt-2">
                {typeof bubbleScore === "number" ? (
                  <span className={`text-2xl font-bold font-mono ${bubbleColor}`}>
                    {bubbleScore}
                    <span className="text-sm text-gray-400 font-normal"> /100</span>
                  </span>
                ) : (
                  <span className="text-2xl font-bold font-mono text-white">—</span>
                )}
              </div>
              <div className="text-xs font-mono text-gray-400 mt-2">{bubbleLabel ?? "Keine Daten verfügbar"}</div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-[#1a1f2e] border-white/20 text-white max-w-[280px] p-3">
          <p className="text-xs font-semibold mb-1">Bubble-Indikator (Sornette/LPPL)</p>
          <p className="text-xs text-gray-300">
            Globaler Markt-Indikator auf Basis des Log-Periodic-Power-Law-Modells (S&P 500) —
            identisch für alle Portfolios. Er schätzt die Wahrscheinlichkeit einer Marktblase:
            0–32 niedrig, 33–65 mittel, 66–100 hoch.
          </p>
          {(bubbleData as any)?.interpretation && (
            <p className="text-xs text-gray-400 mt-1.5">{(bubbleData as any).interpretation}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// ----------------------------------------------------------------
// Performance-Chart: Portfolio vs. SMI · MSCI World (Mockup, linke Karte)
// ----------------------------------------------------------------
function PerformanceCard({ scope }: { scope: Scope }) {
  const [range, setRange] = useState<RangeKey>("YTD");
  const { data, isLoading } = trpc.dashboard.getPerformanceTimeseries.useQuery(
    { scope, range },
    { staleTime: 5 * 60 * 1000 },
  );

  const points = data?.points ?? [];

  return (
    <Card className="bg-[#0f1420] border-white/10 rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
          <div>
            <h2 className="text-base font-semibold text-white">Performance</h2>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <span className="inline-block w-3 h-0.5 bg-[#00CFC1]" />
                <span className="text-[#00CFC1]">Portfolio</span>
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <span className="inline-block w-3 h-0.5 bg-[#94A3B8]" style={{borderTop:'1.5px dashed #94A3B8'}} />
                SPI
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <span className="inline-block w-3 h-0.5" style={{background:'rgba(255,165,0,0.85)',borderTop:'1.5px dashed rgba(255,165,0,0.85)'}} />
                S&amp;P 500
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <span className="inline-block w-3 h-0.5 bg-[#A78BFA]" style={{borderTop:'1.5px dashed #A78BFA'}} />
                MSCI
              </span>
            </div>
          </div>
          <div className="flex bg-[#1a2332] rounded-md p-0.5" role="group" aria-label="Zeitraum wählen">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={range === r}
                className={`px-2.5 py-1 text-xs rounded ${range === r ? "bg-[#00CFC1] text-black font-semibold" : "text-gray-400 hover:text-gray-200"}`}
                onClick={() => setRange(r)}
              >
                {r === "1T" ? "1T" : r}
              </button>
            ))}
          </div>
        </div>

        {/* Ehrlicher Hinweis, wenn die Portfolio-Linie mangels historischer Kurse nicht
            gezeichnet werden kann (sonst widerspräche eine flache 0 %-Linie der YTD-Kachel). */}
        {!isLoading && (data as any)?.portfolioIncomplete && points.length >= 2 && (
          <p className="text-xs text-amber-400/80 mb-2">
            Für diese Titel fehlen historische Kursdaten — die Portfolio-Linie kann für diesen
            Zeitraum nicht dargestellt werden. Die YTD-Kennzahl oben basiert auf dem investierten Betrag.
          </p>
        )}

        {isLoading ? (
          <Skeleton className="h-64 bg-[#111827] rounded-lg" />
        ) : points.length < 2 ? (
          <div className="h-64 flex items-center justify-center text-sm text-gray-400">
            Keine Daten für diesen Zeitraum verfügbar.
          </div>
        ) : (
          <div className="h-64" aria-label={`Performance-Verlauf ${range}: Portfolio, SPI und MSCI World in Prozent`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} minTickGap={40} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <RechartsTooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: any, name: any) => [
                    formatPercent(Number(value)),
                    name === "portfolio" ? "Portfolio" : name === "smi" ? "SPI" : name === "spy" ? "S&P 500" : "MSCI World",
                  ]}
                />
                <Line type="monotone" dataKey="portfolio" stroke="#00CFC1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="smi" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="spy" stroke="rgba(255,165,0,0.85)" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                <Line type="monotone" dataKey="msci" stroke="#A78BFA" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------
// Allokation: Donut mit Sektor/Region-Umschalter (Mockup, rechte Karte)
// ----------------------------------------------------------------
function AllocationCard({ scope }: { scope: Scope }) {
  const [mode, setMode] = useState<"sektor" | "region">("sektor");
  const { data: sectors, isLoading: sectorsLoading } = trpc.dashboard.getSectorAllocation.useQuery(
    { scope },
    { staleTime: 5 * 60 * 1000 },
  );
  const { data: regions, isLoading: regionsLoading } = trpc.dashboard.getRegionAllocation.useQuery(
    { scope },
    { staleTime: 5 * 60 * 1000 },
  );

  const isLoading = mode === "sektor" ? sectorsLoading : regionsLoading;
  const buckets = ((mode === "sektor" ? sectors : regions) ?? []) as Array<{ name: string; weight: number; color: string }>;

  return (
    <Card className="bg-[#0f1420] border-white/10 rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h2 className="text-base font-semibold text-white">Allokation</h2>
          <div className="flex bg-[#1a2332] rounded-md p-0.5" role="group" aria-label="Allokation nach Sektor oder Region anzeigen">
            {(["sektor", "region"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                className={`px-2.5 py-1 text-xs rounded ${mode === m ? "bg-[#00CFC1] text-black font-semibold" : "text-gray-400 hover:text-gray-200"}`}
                onClick={() => setMode(m)}
              >
                {m === "sektor" ? "Sektor" : "Region"}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 bg-[#111827] rounded-lg" />
        ) : buckets.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-gray-400">
            Keine Positionen vorhanden.
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="relative h-44 w-44" aria-label={`Allokation nach ${mode === "sektor" ? "Sektor" : "Region"}`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={buckets}
                    dataKey="weight"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {buckets.map((b) => (
                      <Cell key={b.name} fill={b.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value: any, name: any) => [`${Number(value).toFixed(1)}%`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-bold text-white">100%</span>
                <span className="text-xs text-gray-400 uppercase tracking-wider">Allokation</span>
              </div>
            </div>
            <ul className="w-full mt-3 space-y-1.5">
              {buckets.slice(0, 6).map((b) => (
                <li key={b.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-gray-300 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} aria-hidden="true" />
                    <span className="truncate">{b.name}</span>
                  </span>
                  <span className="text-gray-400 font-mono">{b.weight.toFixed(1)}%</span>
                </li>
              ))}
              {buckets.length > 6 && (
                <li className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Übrige</span>
                  <span className="text-gray-400 font-mono">
                    {buckets.slice(6).reduce((s, b) => s + b.weight, 0).toFixed(1)}%
                  </span>
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------
// Positionen nach Gewicht (Treemap, bestehende Komponente)
// ----------------------------------------------------------------
function PositionsCard({ scope }: { scope: Scope }) {
  const { data: holdings, isLoading } = trpc.dashboard.getAggregatedHoldings.useQuery(
    { scope },
    { staleTime: 5 * 60 * 1000 },
  );

  return (
    <Card className="bg-[#0f1420] border-white/10 rounded-xl">
      <CardContent className="p-4">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-white">Positionen nach Gewicht</h2>
          <p className="text-xs text-gray-400">Grösse = Gewicht · Farbe = YTD-Performance · Klick öffnet den Titel</p>
        </div>
        {isLoading ? (
          <Skeleton className="h-64 bg-[#111827] rounded-lg" />
        ) : !holdings || holdings.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-gray-400">
            Keine Positionen vorhanden.
          </div>
        ) : (
          <PositionsTreemap
            holdings={holdings as any[]}
            bgColor="#0f1420"
            textColor="#ffffff"
            mutedColor="#94a3b8"
            cardAltColor="#1a2332"
          />
        )}
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------
// Main Dashboard Component
// ----------------------------------------------------------------
// ----------------------------------------------------------------
// Portfolio-Übersicht: kompakte Karten, Klick → Portfolio-Details
// ----------------------------------------------------------------
function PortfolioOverviewGrid({ portfolios, onOpen, onCompare, onDelete }: { portfolios: any[]; onOpen: (id: number) => void; onCompare?: (idA: number, idB: number) => void; onDelete?: (id: number, name: string) => void }) {
  // Trenne Haupt-Portfolios von Snapshots
  const mainPortfolios = portfolios.filter((p: any) => !p.isSnapshot || p.isSnapshot === 0);
  const snapshots = portfolios.filter((p: any) => p.isSnapshot === 1);

  return (
    <div>
      <h2 className="text-base font-semibold text-white mb-2">Meine Portfolios</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {mainPortfolios.map((p: any) => {
          const portfolioSnapshots = snapshots.filter((s: any) => s.snapshotOfPortfolioId === p.id);
          const perf = typeof p.livePerformance === "number" ? p.livePerformance : null;
          const perfColor = perf == null ? "text-gray-400" : perf >= 0 ? "text-[#00CFC1]" : "text-negative";
          return (
            <Card
              key={p.id}
              role="button"
              tabIndex={0}
              aria-label={`Portfolio ${p.name} öffnen`}
              onClick={() => onOpen(p.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(p.id);
                }
              }}
              className="bg-[#0f1420] border-white/10 hover:border-[#00CFC1]/40 transition-colors cursor-pointer"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-white truncate">{p.name}</h3>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      p.isLive === 1 ? "bg-emerald-500/15 text-emerald-400" : "bg-white/10 text-gray-400"
                    }`}>
                      {p.isLive === 1 ? "Live" : "Demo"}
                    </span>
                    {onDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(p.id, p.name); }}
                        className="ml-1 p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Portfolio löschen"
                        aria-label="Portfolio löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-xl font-bold text-white font-mono">{formatCHF(p.currentValue ?? 0)}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-400">{p.numberOfPositions ?? 0} Positionen</span>
                  {perf != null && (
                    <span className={`text-xs font-medium font-mono ${perfColor}`}>{formatPercent(perf)}</span>
                  )}
                </div>
                {/* Snapshot-Unter-Einträge unter dem Haupt-Portfolio */}
                {portfolioSnapshots.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-white/10">
                    <div className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider">Snapshots</div>
                    <div className="space-y-1">
                      {portfolioSnapshots.map((snap: any) => (
                        <div key={snap.id} className="flex items-center justify-between gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); onOpen(snap.id); }}
                            className="flex items-center gap-1.5 text-[10px] text-amber-400/80 hover:text-amber-300 transition-colors truncate"
                          >
                            <Camera className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{snap.snapshotNote || snap.name}</span>
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            {onCompare && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onCompare(p.id, snap.id); }}
                                className="text-[9px] text-[#00CFC1]/60 hover:text-[#00CFC1] transition-colors"
                                title="Vergleichen"
                              >⇄</button>
                            )}
                            {onDelete && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onDelete(snap.id, snap.snapshotNote || snap.name); }}
                                className="p-0.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Snapshot löschen"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [scope, setScope] = useState<Scope>("aggregate");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  const { data: portfolios, isLoading: portfoliosLoading } = trpc.dashboard.getPortfolioCompact.useQuery();
  const utils = trpc.useUtils();
  const deleteMut = trpc.portfolios.delete.useMutation({
    onSuccess: () => {
      // Invalidate portfolio lists
      // Use refetchType:'all' to force refetch even for inactive/unmounted queries
      utils.dashboard.getPortfolioCompact.invalidate(undefined, { refetchType: 'all' });
      utils.portfolios.list.invalidate(undefined, { refetchType: 'all' });
      utils.portfolios.getMultiPeriodPerformanceV2.invalidate(undefined, { refetchType: 'all' });
      utils.dashboard.getAggregatedMetrics.invalidate(undefined, { refetchType: 'all' });
      utils.dashboard.getRiskMetrics.invalidate(undefined, { refetchType: 'all' });
      utils.dashboard.getPerformanceTimeseries.invalidate(undefined, { refetchType: 'all' });
      utils.dashboard.getBubbleIndicator.invalidate(undefined, { refetchType: 'all' });
      utils.dashboard.getSectorAllocation.invalidate(undefined, { refetchType: 'all' });
      utils.dashboard.getRegionAllocation.invalidate(undefined, { refetchType: 'all' });
      utils.dashboard.getAggregatedHoldings.invalidate(undefined, { refetchType: 'all' });
      setDeleteConfirm(null);
    },
  });

  const scopeName = useMemo(() => {
    if (scope === "aggregate") return null;
    return (portfolios ?? []).find((p: any) => p.id === scope)?.name ?? null;
  }, [scope, portfolios]);

  const nowLabel = new Date().toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
  const firstName = user?.name?.split(" ")[0] || "Investor";

  const hasPortfolios = (portfolios ?? []).length > 0;

  // Profil-Mismatch-Check: Portfolios die nicht mehr zum Anlegerprofil passen
  const { data: mismatchData } = trpc.investmentProfile.checkMismatch.useQuery(
    undefined,
    { staleTime: 10 * 60 * 1000, retry: false, enabled: hasPortfolios }
  );
  const mismatches = mismatchData?.mismatches ?? [];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Header (Mockup: Eyebrow + Willkommen + Scope-Auswahl rechts) */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs text-[#00CFC1] uppercase tracking-wider mb-1">Dashboard</div>
            <h1 className="text-2xl font-bold text-white">Willkommen zurück, {firstName}</h1>
            <p className="text-sm text-gray-400 mt-1">
              {scope === "aggregate"
                ? "Aggregiert über alle Live-Portfolios"
                : `Portfolio «${scopeName ?? "…"}»`}
              {" · "}Daten von heute, {nowLabel}
            </p>
          </div>

          {/* Scope-Auswahl: «Aggregiert»-Button + Dropdown statt einzelner
              Portfolio-Buttons (Vorgabe Teil 1, Punkt 3 — Platz) */}
          {hasPortfolios && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-9 w-9 p-0 bg-[#1a2332] border-[#2a3a4e] text-[#00CFC1] hover:bg-[#243044] hover:text-[#00CFC1]"
                onClick={() => navigate("/portfolio-builder")}
                title="Neues Portfolio erstellen"
                aria-label="Neues Portfolio erstellen"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                aria-pressed={scope === "aggregate"}
                className={`h-9 text-xs font-semibold ${
                  scope === "aggregate"
                    ? "bg-[#00CFC1] hover:bg-[#00b3a6] text-black"
                    : "bg-[#1a2332] border border-[#2a3a4e] text-gray-200 hover:bg-[#243044]"
                }`}
                onClick={() => setScope("aggregate")}
              >
                Aggregiert
              </Button>
              <Select
                value={scope === "aggregate" ? "" : String(scope)}
                onValueChange={(v) => setScope(Number(v))}
              >
                <SelectTrigger
                  className="w-[200px] h-9 text-xs bg-[#1a2332] border-[#2a3a4e] text-white"
                  aria-label="Einzelnes Portfolio wählen"
                >
                  <SelectValue placeholder="Portfolio wählen…" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1f2e] border-white/10">
                  {(portfolios ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)} className="text-white hover:bg-white/10">
                      {p.name} {p.isLive === 1 ? "(Live)" : "(Demo)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Profil-Mismatch-Banner: erscheint wenn Portfolios nicht mehr zum Anlegerprofil passen */}
        {mismatches.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-amber-300 mb-1">
                  {mismatches.length === 1
                    ? "1 Portfolio entspricht nicht mehr Ihrem Anlegerprofil"
                    : `${mismatches.length} Portfolios entsprechen nicht mehr Ihrem Anlegerprofil`}
                </h3>
                <div className="space-y-2">
                  {mismatches.map((m) => (
                    <div key={m.portfolioId} className="text-xs text-amber-200/80">
                      <button
                        onClick={() => navigate(`/portfolios/${m.portfolioId}`)}
                        className="font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-2 mr-2"
                      >
                        {m.portfolioName}
                      </button>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mr-2 ${
                        m.severity === "high" ? "bg-red-500/20 text-red-300" :
                        m.severity === "medium" ? "bg-amber-500/20 text-amber-300" :
                        "bg-yellow-500/20 text-yellow-300"
                      }`}>
                        {m.severity === "high" ? "Hoch" : m.severity === "medium" ? "Mittel" : "Niedrig"}
                      </span>
                      {m.reasons.slice(0, 1).map((r, i) => <span key={i}>{r}</span>)}
                    </div>
                  ))}
                </div>
                {mismatches.some(m => m.aiSuggestion) && (
                  <div className="mt-3 pt-2 border-t border-amber-500/20">
                    <div className="text-[11px] text-amber-400/70 font-medium mb-1">KI-Anpassungsvorschläge:</div>
                    {mismatches.filter(m => m.aiSuggestion).map((m) => (
                      <div key={m.portfolioId} className="text-xs text-amber-200/70 mb-1">
                        <span className="font-medium text-amber-300">{m.portfolioName}:</span>{" "}
                        {m.aiSuggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* U-10: hilfreicher Leerzustand statt leerer Kacheln */}
        {!portfoliosLoading && !hasPortfolios ? (
          <Card className="bg-[#0f1420] border-white/10">
            <CardContent className="p-6 text-center">
              <FolderOpen className="h-10 w-10 text-gray-600 mx-auto mb-3" aria-hidden="true" />
              <h3 className="text-lg font-semibold text-white mb-2">Noch kein Portfolio vorhanden</h3>
              <p className="text-gray-400 mb-4 text-sm">
                Erstellen Sie Ihr erstes Portfolio, um Wert und Entwicklung Ihrer
                Anlagen hier im Überblick zu sehen.
              </p>
              <Button
                size="sm"
                className="bg-[#00CFC1] hover:bg-[#00b3a6] text-black font-semibold"
                onClick={() => navigate("/portfolio-builder")}
              >
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                Erstes Portfolio erstellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Portfolio-Übersicht (Karten → Details) */}
            <PortfolioOverviewGrid
              portfolios={portfolios ?? []}
              onOpen={(id) => navigate(`/portfolios/${id}`)}
              onCompare={(a, b) => navigate(`/portfolio-comparison?a=${a}&b=${b}`)}
              onDelete={(id, name) => setDeleteConfirm({ id, name })}
            />

            {/* Löschen-Bestätigung */}
            {deleteConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDeleteConfirm(null)}>
                <div className="bg-[#0f1420] border border-white/10 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-base font-semibold text-white mb-2">Portfolio löschen?</h3>
                  <p className="text-sm text-gray-400 mb-5">
                    «Das Portfolio <span className="text-white font-medium">{deleteConfirm.name}</span>» und alle zugehörigen Transaktionen werden unwiderruflich gelöscht.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-4 py-2 text-sm rounded-lg bg-white/10 text-gray-300 hover:bg-white/15 transition-colors"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={() => deleteMut.mutate({ id: deleteConfirm.id })}
                      disabled={deleteMut.isPending}
                      className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50"
                    >
                      {deleteMut.isPending ? 'Lösche...' : 'Endgültig löschen'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* KPI-Reihe */}
            <KpiRow scope={scope} />

            {/* Performance + Allokation */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <PerformanceCard scope={scope} />
              </div>
              <AllocationCard scope={scope} />
            </div>

            {/* Positionen */}
            <PositionsCard scope={scope} />

            {/* Markt-Widgets aus der früheren Portfolios-Seite */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <MarktPuls />
              <AnstehendeTermine maxItems={5} withinDays={7} />
              <AktiveAlarme />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
