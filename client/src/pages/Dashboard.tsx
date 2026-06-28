/**
 * Dashboard "Heute" — einspaltiger Feed
 * Gemäss Design-Handoff: TickerBar, Quick-Actions, PortfolioCompact,
 * Markt-Puls (SektorHeatmap + Movers), KI-Analyse (MarketTakeHero + SectorNewsCards),
 * Anstehende Termine.
 */
import * as React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, RefreshCw, Bell, Briefcase, TrendingUp, TrendingDown,
  ChevronRight, ArrowUpRight, ArrowDownRight,
  Calendar, Bot, Activity, Sparkles, Loader2
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function fmtPct(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined) return "–";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(decimals)}%`;
}
function fmtCHF(v: number): string {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(v);
}
function isMarketOpen(): boolean {
  const now = new Date();
  const hour = now.getUTCHours();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  return hour >= 8 && hour < 22;
}
function toneColor(tone: string | null | undefined): string {
  if (tone === "good") return "text-emerald-400";
  if (tone === "bad") return "text-red-400";
  return "text-amber-400";
}
function toneBg(tone: string | null | undefined): string {
  if (tone === "good") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (tone === "bad") return "bg-red-500/20 text-red-300 border-red-500/30";
  return "bg-amber-500/20 text-amber-300 border-amber-500/30";
}
function changeColor(v: number | null | undefined): string {
  if (v === null || v === undefined) return "text-gray-400";
  return v >= 0 ? "text-emerald-400" : "text-red-400";
}
function heatmapColor(v: number | null | undefined): string {
  if (v === null || v === undefined) return "bg-gray-800 text-gray-400";
  if (v >= 2) return "bg-emerald-600/80 text-white";
  if (v >= 1) return "bg-emerald-500/60 text-white";
  if (v >= 0.3) return "bg-emerald-400/40 text-emerald-200";
  if (v >= -0.3) return "bg-gray-700/60 text-gray-300";
  if (v >= -1) return "bg-red-400/40 text-red-200";
  if (v >= -2) return "bg-red-500/60 text-white";
  return "bg-red-600/80 text-white";
}

// ─────────────────────────────────────────────────────────────
// Sub-Components
// ─────────────────────────────────────────────────────────────

function TickerBar({ indices }: { indices: { key: string; label: string; price: number | null; change: number | null }[] }) {
  const items = indices.filter(i => i.price !== null || i.change !== null);
  if (items.length === 0) return null;
  return (
    <div className="w-full overflow-hidden bg-[#0d1220] border-b border-[#1e2840] py-1.5">
      <div className="flex gap-6 px-4 overflow-x-auto scrollbar-none whitespace-nowrap">
        {items.map(idx => (
          <div key={idx.key} className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-gray-400 font-medium">{idx.label}</span>
            {idx.price !== null && (
              <span className="text-[11px] font-mono text-white">
                {idx.price.toLocaleString("de-CH", { maximumFractionDigits: 0 })}
              </span>
            )}
            <span className={`text-[11px] font-mono ${changeColor(idx.change)}`}>
              {fmtPct(idx.change, 2)}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${isMarketOpen() ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-700/50 text-gray-400"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isMarketOpen() ? "bg-emerald-400 animate-pulse" : "bg-gray-500"}`} />
            {isMarketOpen() ? "Markt offen" : "Markt geschlossen"}
          </span>
        </div>
      </div>
    </div>
  );
}

function QuickActions() {
  const [, setLocation] = useLocation();
  const scrollToKI = () => document.getElementById("ki-analyse")?.scrollIntoView({ behavior: "smooth" });
  const actions = [
    { icon: Plus, label: "Transaktion", action: () => setLocation("/portfolios") },
    { icon: Bell, label: "Kurs-Alarm", action: () => setLocation("/price-alerts") },
    { icon: Bot, label: "KI-Analyse", action: scrollToKI },
    { icon: Briefcase, label: "Watchlist", action: () => setLocation("/admin/watchlist") },
  ];
  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {actions.map(a => (
        <button
          key={a.label}
          onClick={a.action}
          className="flex flex-col items-center gap-1.5 py-3 px-2 bg-[#111827] hover:bg-[#1a2235] border border-[#1e2840] hover:border-[#00CFC1]/30 rounded-xl transition-all group"
        >
          <a.icon className="h-4 w-4 text-[#00CFC1] group-hover:scale-110 transition-transform" />
          <span className="text-[10px] text-gray-400 group-hover:text-white transition-colors">{a.label}</span>
        </button>
      ))}
    </div>
  );
}

function PortfolioCompact({ portfolios, metrics }: {
  portfolios: { id: number; name: string; isLive: number; investmentAmount: number; livePerformance: number | null; numberOfPositions: number; benchmark: string | null }[];
  metrics: any;
}) {
  const [, setLocation] = useLocation();
  const totalValue = metrics?.totalValue ?? 0;
  const dayChangePct = metrics?.dayChangePercent ?? 0;
  const ytdPct = metrics?.totalPerformancePercent ?? 0;

  return (
    <Card className="bg-[#0d1220] border-[#1e2840] mb-4">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[22px] font-mono font-bold text-white tracking-tight">
              {totalValue > 0 ? fmtCHF(totalValue) : "–"}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className={`text-xs font-mono ${changeColor(dayChangePct)}`}>
                {dayChangePct >= 0 ? <ArrowUpRight className="inline h-3 w-3" /> : <ArrowDownRight className="inline h-3 w-3" />}
                {fmtPct(dayChangePct)} heute
              </span>
              <span className={`text-xs font-mono ${changeColor(ytdPct)}`}>
                YTD {fmtPct(ytdPct)}
              </span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setLocation("/portfolio-builder")}
            className="h-8 px-3 bg-[#00CFC1]/10 hover:bg-[#00CFC1]/20 text-[#00CFC1] border border-[#00CFC1]/30 text-xs"
            variant="outline"
          >
            <Plus className="h-3 w-3 mr-1" /> Neu
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex flex-col gap-1.5">
        {portfolios.length === 0 && (
          <div className="text-center py-4 text-sm text-gray-500">Noch keine Portfolios</div>
        )}
        {portfolios.map(p => {
          const ytd = p.livePerformance;
          return (
            <button
              key={p.id}
              onClick={() => setLocation(`/portfolios/${p.id}`)}
              className="w-full flex items-center gap-3 px-3 py-2.5 bg-[#111827]/60 hover:bg-[#1a2235] rounded-lg transition-colors text-left group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white truncate">{p.name}</span>
                  {p.isLive === 1 && (
                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">LIVE</Badge>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {p.numberOfPositions} Positionen
                  {p.benchmark && ` · ${p.benchmark}`}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-mono text-gray-300">
                  {fmtCHF(p.investmentAmount)}
                </div>
                {ytd !== null && (
                  <div className={`text-[11px] font-mono ${changeColor(ytd)}`}>
                    {fmtPct(ytd)}
                  </div>
                )}
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-gray-600 group-hover:text-[#00CFC1] shrink-0" />
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SektorHeatmap({ sectors }: { sectors: { key: string; label: string; change: number | null }[] }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 mb-2">
      {sectors.map(s => (
        <div key={s.key} className={`rounded-lg px-2 py-2 text-center ${heatmapColor(s.change)}`}>
          <div className="text-[10px] font-medium truncate">{s.label}</div>
          <div className="text-[11px] font-mono font-bold mt-0.5">{fmtPct(s.change, 1)}</div>
        </div>
      ))}
    </div>
  );
}

function MoversPanel({ gainers, losers }: {
  gainers: { ticker: string; change: number; price: number | null }[];
  losers: { ticker: string; change: number; price: number | null }[];
}) {
  const [, setLocation] = useLocation();
  const Row = ({ m, isGainer }: { m: typeof gainers[0]; isGainer: boolean }) => (
    <button
      onClick={() => setLocation(`/aktien/${m.ticker}`)}
      className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-[#1a2235] rounded-lg transition-colors"
    >
      <span className="text-xs font-semibold text-white">{m.ticker}</span>
      <span className={`text-xs font-mono ${isGainer ? "text-emerald-400" : "text-red-400"}`}>
        {isGainer ? <TrendingUp className="inline h-3 w-3 mr-0.5" /> : <TrendingDown className="inline h-3 w-3 mr-0.5" />}
        {fmtPct(m.change)}
      </span>
    </button>
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1 px-2">Top Gewinner</div>
        {gainers.length === 0 ? <div className="text-xs text-gray-600 px-2">–</div> : gainers.map(m => <Row key={m.ticker} m={m} isGainer />)}
      </div>
      <div>
        <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1 px-2">Top Verlierer</div>
        {losers.length === 0 ? <div className="text-xs text-gray-600 px-2">–</div> : losers.map(m => <Row key={m.ticker} m={m} isGainer={false} />)}
      </div>
    </div>
  );
}

function MarketTakeHero({ analysis, period }: { analysis: any; period: "day" | "week" }) {
  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Bot className="h-8 w-8 text-[#00CFC1]/40 mb-2" />
        <div className="text-sm text-gray-400">KI-Analyse wird täglich um 08:00 Uhr erstellt</div>
        <div className="text-xs text-gray-600 mt-1">Noch kein Bericht für heute verfügbar</div>
      </div>
    );
  }
  const scenarios: { label: string; prob: number; tone: string; description: string }[] = analysis.scenarios ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Badge className={`shrink-0 text-[10px] px-2 py-0.5 border ${toneBg(analysis.regimeTone)}`}>
          {analysis.regime}
        </Badge>
        <div>
          <div className="text-sm font-semibold text-white leading-snug">{analysis.headline}</div>
          <div className="text-xs text-gray-400 mt-1 leading-relaxed">{analysis.body}</div>
        </div>
      </div>
      {scenarios.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Szenarien</div>
          {scenarios.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`text-[10px] font-medium w-12 shrink-0 ${toneColor(s.tone)}`}>{s.label}</div>
              <div className="flex-1 bg-[#1a2235] rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${s.tone === "good" ? "bg-emerald-500" : s.tone === "bad" ? "bg-red-500" : "bg-amber-500"}`}
                  style={{ width: `${s.prob}%` }}
                />
              </div>
              <div className="text-[10px] font-mono text-gray-400 w-8 text-right shrink-0">{s.prob}%</div>
            </div>
          ))}
        </div>
      )}
      <div className="text-[10px] text-gray-600">
        Erstellt: {analysis.generatedAt ? new Date(analysis.generatedAt).toLocaleString("de-CH") : "–"}
        {" · "}{period === "day" ? "Tagesbericht" : "Wochenbericht"}
      </div>
    </div>
  );
}

function SectorNewsCards({ sectorData }: { sectorData: any[] }) {
  if (!sectorData || sectorData.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-2 mt-3">
      {sectorData.map((s: any, i: number) => (
        <div key={i} className="flex items-start gap-3 px-3 py-2.5 bg-[#111827]/60 rounded-lg">
          <div className="shrink-0 mt-0.5">
            {s.change !== null && s.change >= 0
              ? <TrendingUp className="h-4 w-4 text-emerald-400" />
              : <TrendingDown className="h-4 w-4 text-red-400" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-semibold text-white">{s.label}</span>
              {s.change !== null && (
                <span className={`text-[10px] font-mono ${changeColor(s.change)}`}>{fmtPct(s.change, 1)}</span>
              )}
            </div>
            <div className="text-[11px] text-gray-400 leading-relaxed">{s.comment}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TermineList({ events }: { events: { type: string; ticker: string; date: string; label: string; amount?: number }[] }) {
  const today = new Date().toISOString().split("T")[0];
  if (events.length === 0) {
    return <div className="text-xs text-gray-500 py-4 text-center">Keine anstehenden Termine in den nächsten 14 Tagen</div>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      {events.map((e, i) => {
        const isToday = e.date === today;
        return (
          <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isToday ? "bg-[#00CFC1]/10 border border-[#00CFC1]/20" : "bg-[#111827]/60"}`}>
            <div className={`shrink-0 text-center w-10 ${isToday ? "text-[#00CFC1]" : "text-gray-500"}`}>
              <div className="text-[10px] font-medium">{new Date(e.date).toLocaleDateString("de-CH", { weekday: "short" })}</div>
              <div className="text-sm font-bold">{new Date(e.date).getDate()}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">{e.ticker}</span>
                <Badge className={`text-[9px] px-1.5 py-0 h-4 border ${e.type === "earnings" ? "bg-blue-500/20 text-blue-300 border-blue-500/30" : "bg-purple-500/20 text-purple-300 border-purple-500/30"}`}>
                  {e.label}
                </Badge>
                {isToday && <Badge className="text-[9px] px-1.5 py-0 h-4 bg-[#00CFC1]/20 text-[#00CFC1] border border-[#00CFC1]/30">Heute</Badge>}
              </div>
              {e.amount !== undefined && (
                <div className="text-[11px] text-gray-500 mt-0.5">Dividende: {e.amount.toFixed(2)}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [analysisPeriod, setAnalysisPeriod] = React.useState<"day" | "week">("day");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const triggerAnalysis = trpc.dashboard.triggerMarketAnalysis.useMutation({
    onSuccess: () => {
      toast.success("KI-Analyse erfolgreich erstellt!");
      utils.dashboard.getLatestMarketAnalysis.invalidate();
    },
    onError: (err) => {
      toast.error(`Fehler: ${err.message}`);
    },
  });

  const { data: marketSnapshot, isLoading: snapshotLoading, refetch: refetchSnapshot } =
    trpc.dashboard.getMarketSnapshot.useQuery(undefined, { staleTime: 5 * 60 * 1000 });

  const { data: marketAnalysis, isLoading: analysisLoading } =
    trpc.dashboard.getLatestMarketAnalysis.useQuery({ period: analysisPeriod }, { staleTime: 10 * 60 * 1000 });

  const { data: upcomingEvents = [], isLoading: eventsLoading } =
    trpc.dashboard.getUpcomingEvents.useQuery(undefined, { staleTime: 30 * 60 * 1000 });

  const { data: portfolioCompact = [], isLoading: portfoliosLoading } =
    trpc.dashboard.getPortfolioCompact.useQuery(undefined, { staleTime: 5 * 60 * 1000 });

  const { data: metrics, isLoading: metricsLoading } =
    trpc.dashboard.getAggregatedMetrics.useQuery(undefined, { staleTime: 5 * 60 * 1000 });

  const today = new Date();
  const dateStr = today.toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <DashboardLayout>
      {snapshotLoading
        ? <div className="h-8 bg-[#0d1220] border-b border-[#1e2840]" />
        : <TickerBar indices={marketSnapshot?.indices ?? []} />
      }

      <div className="max-w-2xl mx-auto px-4 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white">Heute</h1>
            <div className="text-xs text-gray-500 mt-0.5 capitalize">{dateStr}</div>
          </div>
          <button
            onClick={() => refetchSnapshot()}
            className="p-2 hover:bg-[#1a2235] rounded-lg transition-colors"
            title="Aktualisieren"
          >
            <RefreshCw className={`h-4 w-4 text-gray-500 ${snapshotLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Portfolio Compact */}
        {portfoliosLoading || metricsLoading
          ? <Skeleton className="h-48 mb-4 bg-[#111827]" />
          : <PortfolioCompact portfolios={portfolioCompact} metrics={metrics} />
        }

        {/* Markt-Puls */}
        <Card className="bg-[#0d1220] border-[#1e2840] mb-4">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#00CFC1]" />
              <span className="text-sm font-semibold text-white">Markt-Puls</span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {snapshotLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-24 bg-[#111827]" />
                <Skeleton className="h-16 bg-[#111827]" />
              </div>
            ) : (
              <>
                <SektorHeatmap sectors={marketSnapshot?.sectors ?? []} />
                <div className="mt-3 pt-3 border-t border-[#1e2840]">
                  <MoversPanel gainers={marketSnapshot?.gainers ?? []} losers={marketSnapshot?.losers ?? []} />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* KI-Analyse */}
        <Card id="ki-analyse" className="bg-[#0d1220] border-[#1e2840] mb-4">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-[#00CFC1]" />
                <span className="text-sm font-semibold text-white">KI-Analyse</span>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => triggerAnalysis.mutate({ period: analysisPeriod })}
                    disabled={triggerAnalysis.isPending}
                    title="KI-Analyse jetzt auslösen"
                    className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-[#00CFC1]/10 hover:bg-[#00CFC1]/20 text-[#00CFC1] border border-[#00CFC1]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {triggerAnalysis.isPending
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Sparkles className="h-3 w-3" />}
                    {triggerAnalysis.isPending ? "Analysiere…" : "Jetzt analysieren"}
                  </button>
                )}
                <div className="flex items-center bg-[#111827] rounded-lg p-0.5 border border-[#1e2840]">
                  {(["day", "week"] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setAnalysisPeriod(p)}
                      className={`text-[10px] px-2.5 py-1 rounded-md transition-colors ${analysisPeriod === p ? "bg-[#00CFC1]/20 text-[#00CFC1] font-medium" : "text-gray-500 hover:text-gray-300"}`}
                    >
                      {p === "day" ? "Tagesbericht" : "Wochenbericht"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {analysisLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-3/4 bg-[#111827]" />
                <Skeleton className="h-12 bg-[#111827]" />
                <Skeleton className="h-20 bg-[#111827]" />
              </div>
            ) : (
              <>
                <MarketTakeHero analysis={marketAnalysis} period={analysisPeriod} />
                {marketAnalysis?.sectorData && (
                  <SectorNewsCards sectorData={marketAnalysis.sectorData as any[]} />
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Anstehende Termine */}
        <Card className="bg-[#0d1220] border-[#1e2840] mb-4">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#00CFC1]" />
              <span className="text-sm font-semibold text-white">Anstehende Termine</span>
              <span className="text-[10px] text-gray-500">nächste 14 Tage</span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {eventsLoading
              ? <Skeleton className="h-24 bg-[#111827]" />
              : <TermineList events={upcomingEvents} />
            }
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
