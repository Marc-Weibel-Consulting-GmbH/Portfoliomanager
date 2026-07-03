import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { formatCHF } from "@/lib/format";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, FolderOpen, Target, Search, Sparkles, MessageCircle, Bell,
  TrendingUp, TrendingDown, Calendar, ArrowUpRight, ArrowDownRight, Info, RefreshCw, AlertTriangle
} from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

// ----------------------------------------------------------------
// TickerBar – Indizes mit Sparkline-Platzhalter
// ----------------------------------------------------------------
function TickerBar() {
  const { data: indicesData, isLoading } = trpc.marketRegime.getIndices.useQuery();

  if (isLoading) return <Skeleton className="h-16 bg-[#111827] rounded-xl" />;

  const items = (indicesData && 'indices' in indicesData ? indicesData.indices : Array.isArray(indicesData) ? indicesData : []) as any[];
  return (
    <div className="bg-[#0d1220] border border-[#1e2840] rounded-xl px-4 py-3 flex items-center justify-between">
      {items.map((idx: any) => {
        const change = idx.dayChange ?? idx.changePercent ?? 0;
        const isPositive = change >= 0;
        const price = idx.value ?? idx.price ?? 0;
        return (
          <div key={idx.label} className="flex items-center gap-2">
            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">{idx.label}</div>
              <div className="text-white font-bold text-sm">
                {price ? Number(price).toLocaleString('de-CH', { maximumFractionDigits: 0 }) : '—'}
              </div>
            </div>
            {/* Mini SVG sparkline from real series data */}
            {(() => {
              const series = (idx.series ?? []).slice(-20).map((s: any) => s.close ?? s);
              if (series.length < 2) return null;
              const min = Math.min(...series);
              const max = Math.max(...series);
              const range = max - min || 1;
              const w = 48, h = 20;
              const points = series.map((v: number, i: number) => 
                `${(i / (series.length - 1)) * w},${h - ((v - min) / range) * h}`
              ).join(' ');
              return (
                <svg width={w} height={h} className="shrink-0">
                  <polyline fill="none" stroke={isPositive ? '#10b981' : '#ef4444'} strokeWidth="1.5" points={points} />
                </svg>
              );
            })()}
            <span className={`text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{change.toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------
// QuickActions – Horizontal scrollbare Buttons
// ----------------------------------------------------------------
function QuickActions() {
  const [, navigate] = useLocation();

  const actions = [
    { label: "Portfolio erstellen", icon: Plus, href: "/portfolio-builder", primary: true },
    { label: "Meine Portfolios", icon: FolderOpen, href: "/portfolios" },
    { label: "Aktienempfehlungen", icon: Target, href: "/aktien" },
    { label: "Aktiensuche", icon: Search, href: "/aktien" },
    { label: "Portfolio optimieren", icon: Sparkles, href: "/copilot" },
    { label: "Copilot fragen", icon: MessageCircle, href: "/copilot" },
    { label: "Preisalarm setzen", icon: Bell, href: "/price-alerts" },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {actions.map((a) => (
        <Button
          key={a.label}
          variant={a.primary ? "default" : "outline"}
          size="sm"
          className={`whitespace-nowrap shrink-0 ${
            a.primary
              ? 'bg-[#00CFC1] hover:bg-[#00b3a6] text-black font-semibold'
              : 'bg-[#1a2332] border-[#2a3a4e] text-gray-200 hover:bg-[#243044]'
          }`}
          onClick={() => navigate(a.href)}
        >
          <a.icon className="h-3.5 w-3.5 mr-1.5" />
          {a.label}
        </Button>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------
// PortfolioCompact – Gesamtwert + Portfolios
// ----------------------------------------------------------------
function PortfolioCompact() {
  const { data: metrics, isLoading: metricsLoading, isError: metricsError, refetch: refetchMetrics } = trpc.dashboard.getAggregatedMetrics.useQuery();
  const { data: portfolios, isLoading: portfoliosLoading, isError: portfoliosError, refetch: refetchPortfolios } = trpc.dashboard.getPortfolioCompact.useQuery();
  const [, navigate] = useLocation();

  if (metricsLoading || portfoliosLoading) return <Skeleton className="h-48 bg-[#111827] rounded-xl" />;

  // U-07: Fehlgeschlagene Abfrage nicht als «CHF 0» rendern, sondern klar ausweisen
  if (metricsError || portfoliosError) {
    return (
      <Card className="bg-[#0d1220] border-[#1e2840]">
        <CardContent className="p-4">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider">Gesamtwert · Aggregiert</span>
          <div className="flex items-center gap-2 mt-3 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span className="text-sm text-gray-300">Daten derzeit nicht verfügbar</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs bg-[#1a2332] border-[#2a3a4e] text-gray-200 hover:bg-[#243044]"
            onClick={() => { if (metricsError) refetchMetrics(); if (portfoliosError) refetchPortfolios(); }}
          >
            <RefreshCw className="h-3 w-3 mr-1.5" aria-hidden="true" />
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    );
  }

  // U-10: hilfreicher Leerzustand statt «CHF 0» ohne Kontext
  if ((portfolios ?? []).length === 0) {
    return (
      <Card className="bg-[#0d1220] border-[#1e2840]">
        <CardContent className="p-6 text-center">
          <FolderOpen className="h-10 w-10 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">
            Noch kein Portfolio vorhanden
          </h3>
          <p className="text-gray-400 mb-4 text-sm">
            Erstellen Sie Ihr erstes Portfolio, um Wert und Entwicklung Ihrer
            Anlagen hier im Überblick zu sehen.
          </p>
          <Button
            size="sm"
            className="bg-[#00CFC1] hover:bg-[#00b3a6] text-black font-semibold"
            onClick={() => navigate('/portfolio-builder')}
          >
            <Plus className="h-4 w-4 mr-2" />
            Erstes Portfolio erstellen
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalValue = metrics?.totalValue ?? 0;
  const dayChange = metrics?.dayChange ?? 0;
  const dayChangePercent = metrics?.dayChangePercent ?? 0;
  const ytdPercent = metrics?.totalPerformancePercent ?? 0;
  const isPositiveDay = dayChange >= 0;

  return (
    <Card className="bg-[#0d1220] border-[#1e2840]">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider">Gesamtwert · Aggregiert</span>
          <Button size="sm" variant="outline" className="h-6 text-[10px] bg-[#00CFC1] text-black border-none hover:bg-[#00b3a6] font-semibold" onClick={() => navigate('/portfolio-builder')}>
            + Neu
          </Button>
        </div>

        {/* Total Value */}
        <div className="text-3xl font-bold text-white mb-1">
          {formatCHF(totalValue, { decimals: 0 })}
        </div>

        {/* Day Change + YTD */}
        <div className="flex items-center gap-2 text-xs mb-4">
          <span className={isPositiveDay ? 'text-emerald-400' : 'text-red-400'}>
            {/* G-01: echtes Minuszeichen statt Math.abs + Farbe */}
            {formatCHF(dayChange, { decimals: 0, signDisplay: 'always' })}
          </span>
          <span className="text-gray-500">·</span>
          <span className={isPositiveDay ? 'text-emerald-400' : 'text-red-400'}>
            {isPositiveDay ? '+' : ''}{dayChangePercent.toFixed(1)}%
          </span>
          <span className="text-gray-500">·</span>
          <span className={ytdPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            YTD {ytdPercent >= 0 ? '+' : ''}{ytdPercent.toFixed(1)}%
          </span>
        </div>

        {/* Portfolio List */}
        <div className="space-y-2">
          {(portfolios ?? []).map((p: any) => {
            const perf = p.livePerformance;
            const perfNum = perf ?? 0;
            const isPos = perfNum >= 0;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#111827] hover:bg-[#162032] cursor-pointer transition-colors"
                onClick={() => navigate(`/portfolios/${p.id}`)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{p.name}</span>
                  {p.isLive ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] px-1 py-0">LIVE</Badge>
                  ) : null}
                  <span className="text-[10px] text-gray-500">
                    {p.benchmark || 'Diversifiziert'} · {p.numberOfPositions ?? '?'} Pos.
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-white">
                    CHF {(p.currentValue ?? p.investmentAmount ?? 0).toLocaleString('de-CH', { maximumFractionDigits: 0 })}
                  </div>
                  {perf !== null && perf !== undefined && perf !== 0 ? (
                    <div className={`text-[10px] ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isPos ? '+' : ''}{perfNum.toFixed(1)}%
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------
// MarktPuls – Sektor-Heatmap + Top Gewinner/Verlierer
// ----------------------------------------------------------------
function MarktPuls() {
  const { data: snapshot, isLoading } = trpc.dashboard.getMarketSnapshot.useQuery();

  if (isLoading) return <Skeleton className="h-48 bg-[#111827] rounded-xl" />;

  const sectors = snapshot?.sectors ?? [];
  const topGainers = (snapshot as any)?.gainers ?? [];
  const topLosers = (snapshot as any)?.losers ?? [];

  return (
    <Card className="bg-[#0d1220] border-[#1e2840]">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#00CFC1]" />
          <span className="text-sm font-semibold text-white">Markt-Puls</span>
          <span className="text-[10px] text-gray-500">Sektoren heute</span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Sector Heatmap Grid */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {sectors.slice(0, 10).map((s: any) => {
            const change = s.changePercent ?? 0;
            const bgColor = change > 1 ? 'bg-emerald-600' : change > 0 ? 'bg-emerald-700/60' : change > -1 ? 'bg-red-700/60' : 'bg-red-600';
            return (
              <div key={s.label} className={`${bgColor} rounded px-2 py-1.5 text-center`}>
                <div className="text-[9px] text-gray-200 truncate">{s.label}</div>
                <div className={`text-xs font-bold ${change >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>
                  {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Top Gainers / Losers */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1 mb-2">
              <ArrowUpRight className="h-3 w-3 text-emerald-400" />
              <span className="text-[10px] text-gray-400 uppercase tracking-wide">Top-Gewinner</span>
            </div>
            {topGainers.slice(0, 4).map((g: any) => (
              <div key={g.ticker} className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-mono w-10">{g.ticker?.split('.')[0]}</span>
                  <span className="text-xs text-gray-300 truncate max-w-[80px]">{g.name || g.ticker}</span>
                </div>
                <span className="text-xs text-emerald-400 font-medium">+{(g.changePercent ?? 0).toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <div>
            <div className="flex items-center gap-1 mb-2">
              <ArrowDownRight className="h-3 w-3 text-red-400" />
              <span className="text-[10px] text-gray-400 uppercase tracking-wide">Top-Verlierer</span>
            </div>
            {topLosers.slice(0, 4).map((l: any) => (
              <div key={l.ticker} className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-mono w-10">{l.ticker?.split('.')[0]}</span>
                  <span className="text-xs text-gray-300 truncate max-w-[80px]">{l.name || l.ticker}</span>
                </div>
                <span className="text-xs text-red-400 font-medium">{(l.changePercent ?? 0).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------
// KI-Analyse – Tages-/Wochenbericht mit Szenarien + Sektoren
// ----------------------------------------------------------------
function KIAnalyse() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'day' | 'week'>('day');
  const { data: analysis, isLoading, refetch } = trpc.dashboard.getLatestMarketAnalysis.useQuery({ period });
  const triggerMutation = trpc.dashboard.triggerMarketAnalysis.useMutation({
    onSuccess: () => { toast.success('KI-Analyse abgeschlossen'); refetch(); },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  if (isLoading) return <Skeleton className="h-64 bg-[#111827] rounded-xl" />;

  const regimeToneColors: Record<string, string> = {
    good: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    warn: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    bad: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const scenarioColors: Record<string, string> = {
    good: 'text-emerald-400',
    warn: 'text-yellow-400',
    bad: 'text-red-400',
  };

  const actionColors: Record<string, string> = {
    KAUFEN: 'bg-[#00CFC1] text-black',
    ABWARTEN: 'bg-gray-600 text-gray-200',
  };

  const todayFormatted = new Date().toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Card className="bg-[#0d1220] border-[#1e2840]">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#00CFC1]" />
            <span className="text-sm font-semibold text-white">KI-Analyse</span>
          </div>
          <div className="flex items-center gap-2">
            {user?.role === 'admin' && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] text-gray-400 hover:text-white"
                onClick={() => triggerMutation.mutate({ period })}
                disabled={triggerMutation.isPending}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${triggerMutation.isPending ? 'animate-spin' : ''}`} />
                {triggerMutation.isPending ? 'Analysiere…' : 'Jetzt analysieren'}
              </Button>
            )}
            <div className="flex bg-[#1a2332] rounded-md p-0.5">
              <button
                className={`px-2 py-0.5 text-[10px] rounded ${period === 'day' ? 'bg-[#00CFC1] text-black font-semibold' : 'text-gray-400'}`}
                onClick={() => setPeriod('day')}
              >
                Tagesbericht
              </button>
              <button
                className={`px-2 py-0.5 text-[10px] rounded ${period === 'week' ? 'bg-[#00CFC1] text-black font-semibold' : 'text-gray-400'}`}
                onClick={() => setPeriod('week')}
              >
                Wochenbericht
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {!analysis ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            Noch kein Bericht vorhanden. Der Bericht wird täglich um 08:00 Uhr erstellt.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header: Badge + Date */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-[#00CFC1]/20 text-[#00CFC1] border-[#00CFC1]/30 text-[9px]">
                  KI-{period === 'day' ? 'TAGESANALYSE' : 'WOCHENANALYSE'}
                </Badge>
                <Badge className={`text-[9px] ${regimeToneColors[analysis.regimeTone] || regimeToneColors.warn}`}>
                  {analysis.regime}
                </Badge>
              </div>
              <span className="text-[10px] text-gray-500">{todayFormatted}</span>
            </div>

            {/* Headline */}
            <h3 className="text-lg font-bold text-white leading-tight">{analysis.headline}</h3>

            {/* Body */}
            <p className="text-sm text-gray-300 leading-relaxed">{analysis.body}</p>

            {/* Scenarios – NEBENEINANDER */}
            {analysis.scenarios && (analysis.scenarios as any[]).length > 0 && (
              <div className="flex items-center gap-4 pt-1">
                {(analysis.scenarios as any[]).map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{s.label}</span>
                    <span className={`text-sm font-bold ${scenarioColors[s.tone] || 'text-gray-300'}`}>
                      {s.prob}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Sector Analysis – Detailed Cards */}
            {analysis.sectorData && (analysis.sectorData as any[]).length > 0 && (
              <div className="space-y-3 pt-2 border-t border-[#1e2840]">
                {(analysis.sectorData as any[]).map((sector: any, i: number) => (
                  <div key={i} className="py-3 border-b border-[#1e2840] last:border-b-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-white">{sector.label}</h4>
                        {sector.subcategory && (
                          <span className="text-[10px] text-gray-500">▲ {sector.subcategory}</span>
                        )}
                      </div>
                      {sector.action && (
                        <Badge className={`text-[9px] px-2 py-0 font-bold ${actionColors[sector.action] || actionColors.ABWARTEN}`}>
                          {sector.action}
                        </Badge>
                      )}
                    </div>

                    {/* Detailed description (4-5 sentences) */}
                    <p className="text-xs text-gray-300 leading-relaxed mb-2">{sector.comment}</p>

                    {/* 3 Stock tickers with performance */}
                    {sector.stocks && sector.stocks.length > 0 && (
                      <div className="flex items-center gap-3">
                        {sector.stocks.map((stock: any, j: number) => {
                          const isPos = (stock.change ?? 0) >= 0;
                          return (
                            <span key={j} className="flex items-center gap-1">
                              <span className="text-[10px] font-mono font-bold text-gray-300">{stock.ticker}</span>
                              <span className={`text-[10px] font-medium ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                                {isPos ? '+' : ''}{(stock.change ?? 0).toFixed(1)}%
                                {isPos ? ' ▲' : ' ▼'}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------
// Anstehende Termine – Makro + Earnings + Dividenden
// ----------------------------------------------------------------
function AnstehendeTermine() {
  const { data: events, isLoading } = trpc.dashboard.getUpcomingEvents.useQuery();

  if (isLoading) return <Skeleton className="h-48 bg-[#111827] rounded-xl" />;

  const importanceBadge: Record<string, string> = {
    HOCH: 'bg-red-500/20 text-red-400 border-red-500/30',
    MITTEL: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    INFO: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  const getDayLabel = (dateStr: string): { day: string; date: string; isToday: boolean } => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const days = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA'];
    return {
      day: days[d.getDay()],
      date: `${d.getDate()}.`,
      isToday,
    };
  };

  return (
    <Card className="bg-[#0d1220] border-[#1e2840]">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#00CFC1]" />
          <span className="text-sm font-semibold text-white">Anstehende Termine</span>
          <span className="text-[10px] text-gray-500">Makro · diese Woche</span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {(!events || events.length === 0) ? (
          <div className="text-center py-4 text-gray-500 text-xs">
            Keine Termine in den nächsten 14 Tagen gefunden.
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event: any, i: number) => {
              const { day, date, isToday } = getDayLabel(event.date);
              return (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-[#1e2840] last:border-b-0">
                  {/* Day + Date */}
                  <div className="flex flex-col items-center min-w-[32px]">
                    <span className="text-[9px] text-gray-500 uppercase">{day}</span>
                    <span className="text-xs font-bold text-gray-300">{date}</span>
                  </div>

                  {/* Event Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white truncate">{event.label}</span>
                      {isToday && (
                        <Badge className="bg-[#00CFC1]/20 text-[#00CFC1] border-[#00CFC1]/30 text-[8px] px-1 py-0">HEUTE</Badge>
                      )}
                    </div>
                    {event.description && (
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">{event.description}</p>
                    )}
                  </div>

                  {/* Time + Importance */}
                  <div className="flex flex-col items-end gap-0.5">
                    {event.time && <span className="text-[10px] text-gray-400">{event.time}</span>}
                    <Badge className={`text-[8px] px-1 py-0 ${importanceBadge[event.importance || 'INFO']}`}>
                      {event.importance || 'INFO'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------
// Main Dashboard Component
// ----------------------------------------------------------------
export default function Dashboard() {
  const { user } = useAuth();

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Guten Morgen';
    if (hour < 18) return 'Guten Tag';
    return 'Guten Abend';
  };

  const todayFormatted = new Date().toLocaleDateString('de-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).toUpperCase();

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="mb-2">
          <div className="text-[10px] text-[#00CFC1] uppercase tracking-wider mb-1">{todayFormatted}</div>
          <h1 className="text-2xl font-bold text-white">{getGreeting()}, {user?.name?.split(' ')[0] || 'Investor'}</h1>
        </div>

        {/* TickerBar */}
        <TickerBar />

        {/* Quick Actions */}
        <QuickActions />

        {/* Portfolio Compact */}
        <PortfolioCompact />

        {/* Markt-Puls */}
        <MarktPuls />

        {/* KI-Analyse */}
        <KIAnalyse />

        {/* Anstehende Termine */}
        <AnstehendeTermine />
      </div>
    </DashboardLayout>
  );
}
