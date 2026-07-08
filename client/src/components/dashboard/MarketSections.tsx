// Markt-/Analyse-Sektionen des alten Dashboards (F-01, Block 2a):
// TickerBar, MarktPuls, KIAnalyse und AnstehendeTermine — unverändert aus
// pages/Dashboard.tsx hierher verschoben, weil die Portfolios-Übersicht
// diese Inhalte übernimmt (Vorgabe Auftraggeber Teil 1, Punkt 2) und das
// Dashboard durch das neue Mockup-Design ersetzt wurde.

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Calendar, ArrowUpRight, ArrowDownRight, RefreshCw, TrendingUp,
  Bell, AlertTriangle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

// ----------------------------------------------------------------
// TickerBar – Indizes mit Sparkline-Platzhalter
// ----------------------------------------------------------------
export function TickerBar() {
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
              <div className="text-xs text-gray-400 uppercase tracking-wide">{idx.label}</div>
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
            <span className={`text-sm font-medium ${isPositive ? 'text-positive' : 'text-negative'}`}>
              {isPositive ? '+' : ''}{change.toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------
// MarktPuls – Sektor-Heatmap + Top Gewinner/Verlierer
// ----------------------------------------------------------------
export function MarktPuls() {
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
          <span className="text-xs text-gray-400">Sektoren heute</span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Sector Heatmap Grid */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {sectors.slice(0, 10).map((s: any) => {
            const change = s.changePercent ?? 0;
            // G-04: Neutralfall bei exakt 0.0 % — Kachel und Text grau, kein Widerspruch
            const bgColor = change > 1 ? 'bg-emerald-600' : change > 0 ? 'bg-emerald-700/60' : change === 0 ? 'bg-gray-600/60' : change > -1 ? 'bg-red-700/60' : 'bg-red-600';
            const textColor = change > 0 ? 'text-emerald-200' : change === 0 ? 'text-gray-200' : 'text-red-200';
            return (
              <div key={s.label} className={`${bgColor} rounded px-2 py-1.5 text-center`}>
                <div className="text-xs text-gray-200 truncate">{s.label}</div>
                <div className={`text-xs font-bold ${textColor}`}>
                  {change > 0 ? '+' : ''}{change.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Top Gainers / Losers */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1 mb-2">
              <ArrowUpRight className="h-3 w-3 text-positive" />
              <span className="text-xs text-gray-400 uppercase tracking-wide">Top-Gewinner</span>
            </div>
            {topGainers.slice(0, 4).map((g: any) => (
              <div key={g.ticker} className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-mono w-10">{g.ticker?.split('.')[0]}</span>
                  <span className="text-xs text-gray-300 truncate max-w-[80px]">{g.name || g.ticker}</span>
                </div>
                <span className="text-xs text-positive font-medium">+{(g.changePercent ?? 0).toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <div>
            <div className="flex items-center gap-1 mb-2">
              <ArrowDownRight className="h-3 w-3 text-negative" />
              <span className="text-xs text-gray-400 uppercase tracking-wide">Top-Verlierer</span>
            </div>
            {topLosers.slice(0, 4).map((l: any) => (
              <div key={l.ticker} className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-mono w-10">{l.ticker?.split('.')[0]}</span>
                  <span className="text-xs text-gray-300 truncate max-w-[80px]">{l.name || l.ticker}</span>
                </div>
                <span className="text-xs text-negative font-medium">{(l.changePercent ?? 0).toFixed(1)}%</span>
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
export function KIAnalyse() {
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
                className="h-8 text-xs text-gray-400 hover:text-white"
                onClick={() => triggerMutation.mutate({ period })}
                disabled={triggerMutation.isPending}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${triggerMutation.isPending ? 'animate-spin' : ''}`} />
                {triggerMutation.isPending ? 'Analysiere…' : 'Jetzt analysieren'}
              </Button>
            )}
            <div className="flex bg-[#1a2332] rounded-md p-0.5">
              <button
                className={`px-2 py-1 text-xs rounded ${period === 'day' ? 'bg-[#00CFC1] text-black font-semibold' : 'text-gray-400'}`}
                onClick={() => setPeriod('day')}
              >
                Tagesbericht
              </button>
              <button
                className={`px-2 py-1 text-xs rounded ${period === 'week' ? 'bg-[#00CFC1] text-black font-semibold' : 'text-gray-400'}`}
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
          <div className="text-center py-8 text-gray-400 text-sm">
            Noch kein Bericht vorhanden. Der Bericht wird täglich um 08:00 Uhr erstellt.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header: Badge + Date */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-[#00CFC1]/20 text-[#00CFC1] border-[#00CFC1]/30 text-xs">
                  KI-{period === 'day' ? 'TAGESANALYSE' : 'WOCHENANALYSE'}
                </Badge>
                <Badge className={`text-xs ${regimeToneColors[analysis.regimeTone] || regimeToneColors.warn}`}>
                  {analysis.regime}
                </Badge>
              </div>
              <span className="text-xs text-gray-400">{todayFormatted}</span>
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
                          <span className="text-xs text-gray-400">▲ {sector.subcategory}</span>
                        )}
                      </div>
                      {sector.action && (
                        <Badge className={`text-xs px-2 py-0 font-bold ${actionColors[sector.action] || actionColors.ABWARTEN}`}>
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
                              <span className="text-xs font-mono font-bold text-gray-300">{stock.ticker}</span>
                              <span className={`text-xs font-medium ${isPos ? 'text-positive' : 'text-negative'}`}>
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
export function AnstehendeTermine({ maxItems, withinDays }: { maxItems?: number; withinDays?: number } = {}) {
  const { data: events, isLoading } = trpc.dashboard.getUpcomingEvents.useQuery();

  // Optional: auf ein Zeitfenster begrenzen und auf die wichtigsten N kürzen.
  // Beim Kürzen zählt die Wichtigkeit (HOCH > MITTEL > INFO), danach das Datum;
  // die Anzeige bleibt anschliessend chronologisch sortiert.
  const displayEvents = useMemo(() => {
    let list = (events ?? []) as any[];
    if (withinDays != null) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + withinDays * 86_400_000);
      list = list.filter((e) => {
        const d = new Date(e.date + "T00:00:00");
        return d >= start && d <= end;
      });
    }
    if (maxItems != null && list.length > maxItems) {
      const rank: Record<string, number> = { HOCH: 0, MITTEL: 1, INFO: 2 };
      list = [...list]
        .sort((a, b) => (rank[a.importance] ?? 2) - (rank[b.importance] ?? 2) || String(a.date).localeCompare(String(b.date)))
        .slice(0, maxItems)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    }
    return list;
  }, [events, maxItems, withinDays]);

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
          <span className="text-xs text-gray-400">Makro · diese Woche</span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {displayEvents.length === 0 ? (
          <div className="text-center py-4 text-gray-400 text-xs">
            {withinDays != null
              ? "Keine Termine in dieser Woche gefunden."
              : "Keine Termine in den nächsten 14 Tagen gefunden."}
          </div>
        ) : (
          <div className="space-y-2">
            {displayEvents.map((event: any, i: number) => {
              const { day, date, isToday } = getDayLabel(event.date);
              return (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-[#1e2840] last:border-b-0">
                  {/* Day + Date */}
                  <div className="flex flex-col items-center min-w-[32px]">
                    <span className="text-xs text-gray-400 uppercase">{day}</span>
                    <span className="text-xs font-bold text-gray-300">{date}</span>
                  </div>

                  {/* Event Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white truncate">{event.label}</span>
                      {isToday && (
                        <Badge className="bg-[#00CFC1]/20 text-[#00CFC1] border-[#00CFC1]/30 text-xs px-1 py-0">HEUTE</Badge>
                      )}
                    </div>
                    {event.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{event.description}</p>
                    )}
                  </div>

                  {/* Time + Importance */}
                  <div className="flex flex-col items-end gap-0.5">
                    {event.time && <span className="text-xs text-gray-400">{event.time}</span>}
                    <Badge className={`text-xs px-1 py-0 ${importanceBadge[event.importance || 'INFO']}`}>
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
// Aktive Alarme – aktive Preis-/Änderungs-Alarme (aus der Portfolios-Übersicht)
// ----------------------------------------------------------------
export function AktiveAlarme() {
  const { data: alerts } = trpc.priceAlerts.list.useQuery();
  const activeAlerts = (alerts ?? []).filter((a: any) => a.status === "active").slice(0, 3);

  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
      <div className="px-4 pt-4 pb-2">
        <div className="text-sm font-semibold text-white flex items-center gap-2">
          <Bell className="h-4 w-4 text-[#00CFC1]" />
          Aktive Alarme
          {activeAlerts.length > 0 && (
            <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
              {activeAlerts.length}
            </span>
          )}
        </div>
      </div>
      <div className="px-4 pb-4 space-y-2">
        {activeAlerts.length === 0 ? (
          <div className="text-center py-3 text-gray-400 text-xs">Keine aktiven Alarme</div>
        ) : (
          activeAlerts.map((alert: any) => (
            <div key={alert.id} className="flex items-center gap-2 bg-[#0f1420]/50 border border-white/5 rounded-lg p-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                alert.alertType === "below_price" ? "bg-amber-500/20" : "bg-emerald-500/20"
              }`}>
                <AlertTriangle className={`h-3.5 w-3.5 ${
                  alert.alertType === "below_price" ? "text-amber-400" : "text-emerald-400"
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-semibold">{alert.ticker}</div>
                <div className="text-gray-400 text-xs">
                  {/* L-13: alle drei Alarmtypen korrekt beschriften (nicht nur Preis) */}
                  {alert.alertType === "percent_change"
                    ? `Änderung ${alert.percentChange ?? "0"}%`
                    : alert.alertType === "below_price"
                    ? `Unter CHF ${parseFloat(alert.targetPrice || "0").toFixed(2)}`
                    : `Über CHF ${parseFloat(alert.targetPrice || "0").toFixed(2)}`}
                </div>
              </div>
            </div>
          ))
        )}
        <Link href="/price-alerts">
          <div className="text-center pt-1">
            <span className="text-[#00CFC1] text-xs hover:underline cursor-pointer">Alle Alarme verwalten →</span>
          </div>
        </Link>
      </div>
    </Card>
  );
}
