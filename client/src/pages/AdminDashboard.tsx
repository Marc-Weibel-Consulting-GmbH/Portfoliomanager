import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Grid3x3, PieChart, Key, BarChart3, Eye, BrainCircuit, Activity, Wallet, Brain, RefreshCw, CheckCircle2, XCircle, TrendingUp, FlaskConical, AlertTriangle, Clock, Database } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [refreshStatus, setRefreshStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [cacheStatus, setCacheStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [qualityCacheStatus, setQualityCacheStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [sectorStatus, setSectorStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [metricsSnapshotStatus, setMetricsSnapshotStatus] = useState<string | null>(null);
  const [historicalPricesStatus, setHistoricalPricesStatus] = useState<string | null>(null);
  const importHistoricalPrices = trpc.admin.importHistoricalPrices.useMutation({
    onSuccess: (data: any) => {
      const msg = data?.message ?? (data?.success ? 'Import gestartet — läuft im Hintergrund' : 'Fehler beim Import');
      setHistoricalPricesStatus(msg);
      if (data?.success) {
        toast.success('Kursdaten-Import gestartet', { description: msg });
      } else {
        toast.error('Fehler beim Kursdaten-Import', { description: msg });
      }
    },
    onError: (err: any) => {
      setHistoricalPricesStatus('Fehler: ' + err.message);
      toast.error('Fehler', { description: err.message });
    },
  });
  const clearQualityCache = trpc.admin.clearQualityMetricsCache.useMutation({
    onSuccess: (data) => {
      setQualityCacheStatus({ success: data.success, message: data.message });
      toast.success('Quality-Cache geleert', { description: data.message });
    },
    onError: (err) => {
      setQualityCacheStatus({ success: false, message: err.message });
      toast.error('Fehler', { description: err.message });
    },
  });
  const triggerCacheRefresh = trpc.admin.triggerSignalCacheRefresh.useMutation({
    onSuccess: (data) => {
      setCacheStatus({ success: data.success, message: data.message });
      if (data.success) {
        toast.success('Signal-Cache aktualisiert', { description: data.message });
      } else {
        toast.error('Fehler beim Cache-Refresh', { description: data.message });
      }
    },
    onError: (err) => {
      setCacheStatus({ success: false, message: err.message });
      toast.error('Fehler', { description: err.message });
    },
  });
  const refreshSectors = trpc.admin.refreshSectors.useMutation({
    onSuccess: (data) => {
      setSectorStatus({ success: data.success, message: data.message });
      if (data.success) {
        toast.success('Sektoren aktualisiert', { description: data.message });
      } else {
        toast.error('Fehler', { description: data.message });
      }
    },
    onError: (err) => {
      setSectorStatus({ success: false, message: err.message });
      toast.error('Fehler', { description: err.message });
    },
  });
  const triggerMetricsSnapshot = trpc.admin.triggerPortfolioMetricsSnapshot.useMutation({
    onSuccess: (data: any) => {
      const msg = data?.message ?? (data?.saved !== undefined
        ? `${data.saved} Snapshots gespeichert (${data.skipped} übersprungen)`
        : 'Gestartet — läuft im Hintergrund');
      setMetricsSnapshotStatus(msg);
      toast.success('Portfolio-Metriken Backfill gestartet', { description: msg });
    },
    onError: (err: any) => {
      setMetricsSnapshotStatus('Fehler: ' + err.message);
      toast.error('Fehler beim Backfill', { description: err.message });
    },
  });
  const backfillStatus = trpc.admin.getBackfillStatus.useQuery(undefined, { refetchInterval: 10_000 });
  const clearPermanentlyFailed = trpc.admin.clearPermanentlyFailedBackfills.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      backfillStatus.refetch();
    },
    onError: (err) => toast.error('Fehler', { description: err.message }),
  });

  const triggerRefresh = trpc.admin.triggerSignalScoreRefresh.useMutation({
    onSuccess: (data) => {
      setRefreshStatus({ success: data.success, message: data.message });
      if (data.success) {
        toast.success("Signal-Scores aktualisiert", { description: data.message });
      } else {
        toast.error("Fehler beim Aktualisieren", { description: data.message });
      }
    },
    onError: (err) => {
      setRefreshStatus({ success: false, message: err.message });
      toast.error("Fehler", { description: err.message });
    },
  });

  const adminSections = [
    {
      icon: Grid3x3,
      title: "Kategorien-Verwaltung",
      description: "Kategorien erstellen und bearbeiten",
      path: "/admin/categories",
      color: "text-green-500",
    },
    {
      icon: PieChart,
      title: "Sektoren-Verwaltung",
      description: "Sektoren erstellen und bearbeiten",
      path: "/admin/sectors",
      color: "text-purple-500",
    },
    {
      icon: Key,
      title: "Secrets-Verwaltung",
      description: "API-Keys und Secrets verwalten",
      path: "/admin/secrets",
      color: "text-orange-500",
    },
    {
      icon: BarChart3,
      title: "Platform-KPIs",
      description: "Benutzer-Statistiken und Metriken",
      path: "/admin/kpis",
      color: "text-cyan-500",
    },
    {
      icon: Eye,
      title: "Aktienliste & Watchlist",
      description: "Aktien-Universum kuratieren (max. 200 Titel) — inkl. nicht-kuratierter Portfolio-Titel",
      path: "/admin/watchlist",
      color: "text-emerald-500",
    },
    {
      icon: BrainCircuit,
      title: "ML Trainer",
      description: "Gradient-Boosting Modell trainieren, Metriken & Historie",
      path: "/admin/ml-trainer",
      color: "text-violet-500",
    },
    {
      icon: Activity,
      title: "Signal-Performance",
      description: "Trefferquote, Rendite und Kalibrierung je Signal-Engine — Basis für Signalmix-Optimierung",
      path: "/admin/signal-performance",
      color: "text-teal-500",
    },
    {
      icon: Wallet,
      title: "Wikifolio Portfolio",
      description: "Portfoliopositionen aus Wikifolio abrufen, analysieren und in die Watchlist importieren",
      path: "/admin/wikifolio",
      color: "text-amber-500",
    },
    {
      icon: Brain,
      title: "Research & Multi-Agent",
      description: "Dokumente hochladen, KI-Analyse und Multi-Agent-System (Anthropic + Perplexity + Manus)",
      path: "/admin/research",
      color: "text-pink-500",
    },
    {
      icon: Brain,
      title: "KI-Analyse Protokoll",
      description: "Multi-Agent Portfolio-Vorschläge: Vertrauen, Kennzahlen-Filter, Challenger-Kritik — intern für Training",
      path: "/admin/proposal-analysis",
      color: "text-violet-500",
    },
    {
      icon: FlaskConical,
      title: "Algo Self-Learning Backtest",
      description: "Monatliche Test-Portfolios (6 Profile), 30-Tage-Performance, LLM-Analyse & Tuning-Log mit Overfitting-Schutz",
      path: "/admin/algo-backtest",
      color: "text-emerald-400",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Zentrale Verwaltung der Platform
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3 p-4 bg-muted/30 rounded-lg border">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Schnellaktionen</p>
            <p className="text-xs text-muted-foreground mt-0.5">Manuelle Trigger für geplante Jobs</p>
          </div>
          <div className="flex items-center gap-3">
            {refreshStatus && (
              <div className={`flex items-center gap-1.5 text-xs ${
                refreshStatus.success ? "text-green-500" : "text-red-500"
              }`}>
                {refreshStatus.success
                  ? <CheckCircle2 className="h-4 w-4" />
                  : <XCircle className="h-4 w-4" />}
                <span className="max-w-xs truncate">{refreshStatus.message}</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQualityCacheStatus(null);
                clearQualityCache.mutate();
              }}
              disabled={clearQualityCache.isPending}
              className="gap-2 border-teal-500/50 text-teal-400 hover:text-teal-300"
            >
              <RefreshCw className={`h-4 w-4 ${clearQualityCache.isPending ? 'animate-spin' : ''}`} />
              {clearQualityCache.isPending ? 'Lösche...' : 'Quality-Cache leeren'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCacheStatus(null);
                triggerCacheRefresh.mutate();
              }}
              disabled={triggerCacheRefresh.isPending}
              className="gap-2 border-violet-500/50 text-violet-400 hover:text-violet-300"
            >
              <RefreshCw className={`h-4 w-4 ${triggerCacheRefresh.isPending ? 'animate-spin' : ''}`} />
              {triggerCacheRefresh.isPending ? 'Cache läuft...' : 'Signal-Cache neu berechnen'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSectorStatus(null);
                refreshSectors.mutate();
              }}
              disabled={refreshSectors.isPending}
              className="gap-2 border-amber-500/50 text-amber-400 hover:text-amber-300"
            >
              <RefreshCw className={`h-4 w-4 ${refreshSectors.isPending ? 'animate-spin' : ''}`} />
              {refreshSectors.isPending ? 'Aktualisiert...' : 'Sektoren aktualisieren'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMetricsSnapshotStatus(null);
                triggerMetricsSnapshot.mutate({ backfill: true });
              }}
              disabled={triggerMetricsSnapshot.isPending}
              className="gap-2 border-blue-500/50 text-blue-400 hover:text-blue-300"
            >
              <RefreshCw className={`h-4 w-4 ${triggerMetricsSnapshot.isPending ? 'animate-spin' : ''}`} />
              {triggerMetricsSnapshot.isPending ? 'Starte...' : 'Portfolio-Metriken Backfill (1 Jahr)'}
            </Button>
            {metricsSnapshotStatus && (
              <span className="text-xs text-blue-400 max-w-xs">{metricsSnapshotStatus}</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setHistoricalPricesStatus(null);
                // D6: rollierendes 1-Jahres-Fenster statt hartkodiertem Startdatum
                const today = new Date().toISOString().split('T')[0];
                const oneYearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().split('T')[0];
                importHistoricalPrices.mutate({ fromDate: oneYearAgo, toDate: today, forceRefresh: true });
              }}
              disabled={importHistoricalPrices.isPending}
              className="gap-2 border-emerald-500/50 text-emerald-400 hover:text-emerald-300"
            >
              <TrendingUp className={`h-4 w-4 ${importHistoricalPrices.isPending ? 'animate-spin' : ''}`} />
              {importHistoricalPrices.isPending ? 'Importiert...' : 'Kursdaten aktualisieren'}
            </Button>
            {historicalPricesStatus && (
              <span className="text-xs text-emerald-400 max-w-xs">{historicalPricesStatus}</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRefreshStatus(null);
                triggerRefresh.mutate();
              }}
              disabled={triggerRefresh.isPending}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${triggerRefresh.isPending ? "animate-spin" : ""}`} />
              {triggerRefresh.isPending ? "Aktualisiert..." : "Scores jetzt aktualisieren"}
            </Button>
          </div>
        </div>

        {/* Backfill-Status */}
        <div className="p-4 bg-muted/30 rounded-lg border space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium flex items-center gap-2"><Database className="h-4 w-4 text-emerald-400" />Backfill-Status</p>
              <p className="text-xs text-muted-foreground mt-0.5">Kurshistorie-Nachlade-Status (aktualisiert alle 10s)</p>
            </div>
            {backfillStatus.data?.pendingCount != null && backfillStatus.data.pendingCount > 0 && (
              <Badge variant="outline" className="text-amber-400 border-amber-500/50 gap-1">
                <Clock className="h-3 w-3" />{backfillStatus.data.pendingCount} ausstehend
              </Badge>
            )}
          </div>

          {/* Pending */}
          {backfillStatus.data?.pendingTickers && backfillStatus.data.pendingTickers.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-400 mb-1">Wird gerade geladen:</p>
              <div className="flex flex-wrap gap-1">
                {backfillStatus.data.pendingTickers.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs text-amber-300 border-amber-500/30">{t}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Recently Completed */}
          {backfillStatus.data?.recentlyCompleted && backfillStatus.data.recentlyCompleted.length > 0 && (
            <div>
              <p className="text-xs font-medium text-emerald-400 mb-1">Zuletzt nachgeladen (letzte Stunde):</p>
              <div className="flex flex-wrap gap-1">
                {backfillStatus.data.recentlyCompleted.map((item) => (
                  <Badge key={item.ticker} variant="outline" className="text-xs text-emerald-300 border-emerald-500/30 gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" />{item.ticker}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Permanently Failed */}
          {backfillStatus.data?.permanentlyFailed && backfillStatus.data.permanentlyFailed.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-red-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />Dauerhaft keine EODHD-Daten ({backfillStatus.data.permanentlyFailed.length} Ticker):
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-xs text-red-400 hover:text-red-300 px-1"
                  onClick={() => clearPermanentlyFailed.mutate({})}
                  disabled={clearPermanentlyFailed.isPending}
                >
                  Alle löschen
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {backfillStatus.data.permanentlyFailed.map((item) => (
                  <Badge
                    key={item.ticker}
                    variant="outline"
                    className="text-xs text-red-300 border-red-500/30 gap-1 cursor-pointer hover:border-red-400"
                    onClick={() => clearPermanentlyFailed.mutate({ ticker: item.ticker })}
                    title={`${item.reason} — ${new Date(item.failedAt).toLocaleString('de-CH')} — Klicken zum Entfernen`}
                  >
                    <XCircle className="h-2.5 w-2.5" />{item.ticker}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {backfillStatus.data?.pendingCount === 0 && backfillStatus.data?.recentlyCompleted?.length === 0 && backfillStatus.data?.permanentlyFailed?.length === 0 && (
            <p className="text-xs text-muted-foreground">Keine ausstehenden oder kürzlich abgeschlossenen Backfills.</p>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {adminSections.map((section) => (
            <Card
              key={section.path}
              className="hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => setLocation(section.path)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg bg-muted group-hover:bg-accent transition-colors`}>
                    <section.icon className={`h-6 w-6 ${section.color}`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">
                  {section.description}
                </CardDescription>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocation(section.path);
                  }}
                >
                  Öffnen →
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
