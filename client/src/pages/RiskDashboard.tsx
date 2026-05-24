import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, TrendingDown, TrendingUp, Activity, BarChart3, Shield, Info, RefreshCw, Wifi, WifiOff } from "lucide-react";
import RiskRadarChart from "@/components/RiskRadarChart";
import RiskBulletChart from "@/components/RiskBulletChart";
import RiskScoreOverview from "@/components/RiskScoreOverview";
import RiskScoreTimeline from "@/components/RiskScoreTimeline";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val: number | null | undefined, decimals = 2, suffix = "%") {
  if (val === null || val === undefined || isNaN(val)) return "–";
  return `${val >= 0 ? "+" : ""}${val.toFixed(decimals)}${suffix}`;
}

function fmtRatio(val: number | null | undefined) {
  if (val === null || val === undefined || isNaN(val)) return "–";
  return val.toFixed(2);
}

function riskColor(value: number | null | undefined, thresholds: [number, number]) {
  if (value === null || value === undefined) return "text-muted-foreground";
  if (value >= thresholds[1]) return "text-green-400";
  if (value >= thresholds[0]) return "text-yellow-400";
  return "text-red-400";
}

function varColor(value: number | null | undefined) {
  if (value === null || value === undefined) return "text-muted-foreground";
  const abs = Math.abs(value);
  if (abs <= 1.5) return "text-green-400";
  if (abs <= 3) return "text-yellow-400";
  return "text-red-400";
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: string;
  description: string;
  tooltip: string;
  icon: React.ReactNode;
  colorClass?: string;
  badge?: { label: string; variant: "default" | "secondary" | "destructive" | "outline" };
}

function MetricCard({ title, value, description, tooltip, icon, colorClass, badge }: MetricCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-muted-foreground">{icon}</div>
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          </div>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colorClass ?? ""}`}>{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
        {badge && (
          <Badge variant={badge.variant} className="mt-2 text-xs">
            {badge.label}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RiskDashboard() {
  const { user } = useAuth();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [benchmark, setBenchmark] = useState("SPY");
  const [confidenceLevel, setConfidenceLevel] = useState(0.95);
  const [lookbackDays, setLookbackDays] = useState(252);

  // Load portfolios
  const { data: portfolios } = trpc.portfolios.list.useQuery(undefined, { enabled: !!user });

  // Auto-select first portfolio
  const activePortfolioId = selectedPortfolioId ?? portfolios?.[0]?.id ?? null;

  // Load portfolio holdings
  const { data: portfolioData } = trpc.portfolios.getWithCurrency.useQuery(
    activePortfolioId!,
    { enabled: !!activePortfolioId }
  );

  // Build holdings array for analytics
  const holdings = useMemo(() => {
    if (!portfolioData?.enrichedStocks) return [];
    return portfolioData.enrichedStocks
      .filter((p: any) => p.weight > 0 && p.ticker !== 'CASH')
      .map((p: any) => ({
        ticker: p.ticker,
        weight: (p.weight || 0) / 100,
        currency: p.currency || "USD",
      }));
  }, [portfolioData]);

  // Check analytics service health
  const { data: healthData } = trpc.analytics.health.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Fetch risk metrics
  const {
    data: riskData,
    isLoading: riskLoading,
    error: riskError,
    refetch: refetchRisk,
  } = trpc.analytics.riskMetrics.useQuery(
    {
      holdings,
      benchmark,
      riskFreeRate: 0.02,
      confidenceLevel,
      lookbackDays,
    },
    {
      enabled: !!user && holdings.length > 0,
      staleTime: 5 * 60 * 1000,
    }
  );

  // Fetch risk score history (timeline)
  const {
    data: riskScoreHistory,
    isLoading: historyLoading,
  } = trpc.analytics.riskScoreHistory.useQuery(
    {
      holdings,
      benchmark,
      riskFreeRate: 0.02,
      confidenceLevel,
      weeks: 52,
      windowDays: 63,
    },
    {
      enabled: !!user && holdings.length > 0,
      staleTime: 10 * 60 * 1000, // Cache for 10 min (expensive calculation)
    }
  );

  // The service returns { portfolio: {...}, benchmarkMetrics: {...}, benchmarkNormalizedScores: {...}, assets: [...] }
  const portfolio = (riskData as any)?.portfolio;
  const benchmarkMetrics = (riskData as any)?.benchmarkMetrics;
  const benchmarkNormalizedScores = (riskData as any)?.benchmarkNormalizedScores;
  const assets = (riskData as any)?.assets ?? [];
  const serviceOnline = healthData?.status === "online";

  // ── Sharpe rating ──────────────────────────────────────────────────────────
  function sharpeRating(v: number | null | undefined) {
    if (!v) return null;
    if (v >= 2) return { label: "Ausgezeichnet", variant: "default" as const };
    if (v >= 1) return { label: "Gut", variant: "secondary" as const };
    if (v >= 0) return { label: "Akzeptabel", variant: "outline" as const };
    return { label: "Schlecht", variant: "destructive" as const };
  }

  const benchmarkLabel = benchmark === "SPY" ? "S&P 500" : benchmark === "QQQ" ? "NASDAQ" : benchmark === "EWL" ? "SMI" : "MSCI World";

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Risiko-Analyse
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Institutionelle Risikoanalyse mit Benchmark-Vergleich
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${serviceOnline ? "border-green-500/30 text-green-400 bg-green-500/10" : "border-red-500/30 text-red-400 bg-red-500/10"}`}>
              {serviceOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {serviceOnline ? "Analytics Online" : "Analytics Offline"}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchRisk()} disabled={riskLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${riskLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3">
          <Select
            value={activePortfolioId?.toString() ?? ""}
            onValueChange={(v) => setSelectedPortfolioId(parseInt(v))}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Portfolio wählen..." />
            </SelectTrigger>
            <SelectContent>
              {portfolios?.map((p: any) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={benchmark} onValueChange={setBenchmark}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SPY">S&P 500 (SPY)</SelectItem>
              <SelectItem value="QQQ">NASDAQ (QQQ)</SelectItem>
              <SelectItem value="EWL">SMI (EWL)</SelectItem>
              <SelectItem value="URTH">MSCI World</SelectItem>
            </SelectContent>
          </Select>

          <Select value={confidenceLevel.toString()} onValueChange={(v) => setConfidenceLevel(parseFloat(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.90">VaR 90%</SelectItem>
              <SelectItem value="0.95">VaR 95%</SelectItem>
              <SelectItem value="0.99">VaR 99%</SelectItem>
            </SelectContent>
          </Select>

          <Select value={lookbackDays.toString()} onValueChange={(v) => setLookbackDays(parseInt(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="63">3 Monate</SelectItem>
              <SelectItem value="126">6 Monate</SelectItem>
              <SelectItem value="252">1 Jahr</SelectItem>
              <SelectItem value="504">2 Jahre</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Error / Offline State */}
        {!serviceOnline && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Der Analytics-Service ist nicht erreichbar. Bitte stellen Sie sicher, dass der Python-Microservice läuft.
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {riskError && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{riskError.message}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading Skeleton */}
        {riskLoading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="bg-card border-border animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-4 bg-muted rounded w-24" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted rounded w-20 mb-2" />
                  <div className="h-3 bg-muted rounded w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Main Content with Tabs */}
        {portfolio && !riskLoading && (
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Risikometriken</TabsTrigger>
              <TabsTrigger value="einzeltitel">Einzeltitel</TabsTrigger>
              <TabsTrigger value="weitere">Weitere Tools</TabsTrigger>
            </TabsList>

            {/* ─── Tab: Risikometriken ─── */}
            <TabsContent value="overview" className="space-y-6">
              {/* Top Section: Radar + KPI Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Radar Chart */}
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="text-base">Radar Chart</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Alle Achsen sind auf einen Score von 0 bis 100 normiert. Aussen bedeutet hier immer „besser" im Verhältnis zur gewünschten Risikoeigenschaft.
                    </p>
                  </CardHeader>
                  <CardContent>
                    {portfolio.normalizedScores && (
                      <RiskRadarChart
                        portfolioScores={portfolio.normalizedScores}
                        benchmarkScores={benchmarkNormalizedScores ?? null}
                        benchmarkName={benchmarkLabel}
                      />
                    )}
                  </CardContent>
                </Card>

                {/* KPI Overview + Interpretation */}
                <RiskScoreOverview
                  riskScore={portfolio.riskScore ?? 50}
                  portfolioMetrics={{
                    volatility: portfolio.volatility,
                    maxDrawdown: portfolio.maxDrawdown,
                    varHistorical95: portfolio.varHistorical95,
                    informationRatio: portfolio.informationRatio,
                    trackingError: portfolio.trackingError,
                    sharpeRatio: portfolio.sharpeRatio,
                    beta: portfolio.beta,
                  }}
                  benchmarkMetrics={benchmarkMetrics}
                  benchmarkName={benchmarkLabel}
                />
              </div>

              {/* Bullet Charts Section */}
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Bullet Charts je Kennzahl
                </h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Balken = Portfolio, Marker = Benchmark oder Zielwert, Hintergrund = Einordnung entlang der Skala.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <RiskBulletChart
                    title="Volatilität"
                    subtitle="Niedriger ist besser"
                    value={portfolio.volatility}
                    benchmarkValue={benchmarkMetrics?.volatility ?? null}
                    min={0}
                    max={25}
                    zones={[8, 15]}
                    invertColors={true}
                  />
                  <RiskBulletChart
                    title="Max Drawdown"
                    subtitle="Niedriger ist besser"
                    value={Math.abs(portfolio.maxDrawdown)}
                    benchmarkValue={benchmarkMetrics ? Math.abs(benchmarkMetrics.maxDrawdown) : null}
                    min={0}
                    max={35}
                    zones={[10, 20]}
                    invertColors={true}
                  />
                  <RiskBulletChart
                    title={`VaR ${(confidenceLevel * 100).toFixed(0)}%`}
                    subtitle="Niedriger ist besser"
                    value={Math.abs(portfolio.varHistorical95)}
                    benchmarkValue={benchmarkMetrics ? Math.abs(benchmarkMetrics.varHistorical95) : null}
                    min={0}
                    max={15}
                    zones={[4, 8]}
                    invertColors={true}
                  />
                  <RiskBulletChart
                    title="Tracking Error"
                    subtitle="Niedriger = näher am Benchmark"
                    value={portfolio.trackingError ?? 0}
                    benchmarkValue={0}
                    min={0}
                    max={20}
                    zones={[5, 12]}
                    invertColors={true}
                  />
                </div>
              </div>

              {/* Rendite-Risiko Kennzahlen */}
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Rendite-Risiko-Kennzahlen
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard
                    title="Sharpe Ratio"
                    value={fmtRatio(portfolio.sharpeRatio)}
                    description={`Risikobereinigt vs. 2% risikofreier Zins`}
                    tooltip="Misst die Überrendite pro Einheit Gesamtrisiko (Standardabweichung). Werte > 1 gelten als gut, > 2 als ausgezeichnet."
                    icon={<TrendingUp className="h-4 w-4" />}
                    colorClass={riskColor(portfolio.sharpeRatio, [0, 1])}
                    badge={sharpeRating(portfolio.sharpeRatio) ?? undefined}
                  />
                  <MetricCard
                    title="Sortino Ratio"
                    value={fmtRatio(portfolio.sortinoRatio)}
                    description="Nur Abwärtsrisiko berücksichtigt"
                    tooltip="Wie Sharpe, aber bestraft nur negative Volatilität (Abwärtsrisiko). Besser geeignet für asymmetrische Renditeverteilungen."
                    icon={<Activity className="h-4 w-4" />}
                    colorClass={riskColor(portfolio.sortinoRatio, [0, 1])}
                  />
                  <MetricCard
                    title="Treynor Ratio"
                    value={fmtRatio(portfolio.treynorRatio)}
                    description="Überrendite pro Marktrisiko-Einheit"
                    tooltip="Misst die Überrendite pro Einheit systematisches Risiko (Beta). Höher ist besser."
                    icon={<BarChart3 className="h-4 w-4" />}
                    colorClass={riskColor(portfolio.treynorRatio, [0, 0.05])}
                  />
                  <MetricCard
                    title="Calmar Ratio"
                    value={fmtRatio(portfolio.calmarRatio)}
                    description="Rendite / Max. Drawdown"
                    tooltip="Verhältnis von annualisierter Rendite zu maximalem Drawdown. Höher ist besser."
                    icon={<TrendingDown className="h-4 w-4" />}
                    colorClass={riskColor(portfolio.calmarRatio, [0, 1])}
                  />
                </div>
              </div>

              {/* Risikokennzahlen */}
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Risikokennzahlen
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard
                    title={`VaR hist. (${(confidenceLevel * 100).toFixed(0)}%)`}
                    value={fmt(portfolio.varHistorical95 !== null ? -Math.abs(portfolio.varHistorical95) : null)}
                    description="Historisch, täglicher Verlust"
                    tooltip={`Value at Risk: Mit ${(confidenceLevel * 100).toFixed(0)}% Wahrscheinlichkeit wird der tägliche Verlust diesen Wert nicht überschreiten.`}
                    icon={<AlertTriangle className="h-4 w-4" />}
                    colorClass={varColor(portfolio.varHistorical95)}
                  />
                  <MetricCard
                    title={`VaR param. (${(confidenceLevel * 100).toFixed(0)}%)`}
                    value={fmt(portfolio.varParametric95 !== null ? -Math.abs(portfolio.varParametric95) : null)}
                    description="Parametrisch (Normalverteilung)"
                    tooltip="Parametrischer VaR basierend auf Normalverteilungsannahme."
                    icon={<AlertTriangle className="h-4 w-4" />}
                    colorClass={varColor(portfolio.varParametric95)}
                  />
                  <MetricCard
                    title={`CVaR (${(confidenceLevel * 100).toFixed(0)}%)`}
                    value={fmt(portfolio.cvar95 !== null ? -Math.abs(portfolio.cvar95) : null)}
                    description="Expected Shortfall"
                    tooltip="Conditional VaR / Expected Shortfall: Durchschnittlicher Verlust in den schlechtesten Szenarien (jenseits des VaR)."
                    icon={<AlertTriangle className="h-4 w-4" />}
                    colorClass={varColor(portfolio.cvar95)}
                  />
                  <MetricCard
                    title="Max. Drawdown"
                    value={fmt(portfolio.maxDrawdown)}
                    description="Maximaler Wertverlust vom Höchststand"
                    tooltip="Der grösste Wertverlust vom Höchststand bis zum Tiefpunkt im Betrachtungszeitraum."
                    icon={<TrendingDown className="h-4 w-4" />}
                    colorClass={varColor(portfolio.maxDrawdown)}
                  />
                </div>
              </div>

              {/* Risikoscore-Entwicklung Timeline */}
              <RiskScoreTimeline
                data={riskScoreHistory ?? []}
                isLoading={historyLoading}
              />

              {/* Marktrisiko & Performance */}
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Marktrisiko & Performance
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard
                    title="Beta"
                    value={fmtRatio(portfolio.beta)}
                    description={`Sensitivität vs. ${benchmarkLabel}`}
                    tooltip="Beta misst die Sensitivität des Portfolios gegenüber dem Markt. Beta > 1 = aggressiver als Markt, < 1 = defensiver."
                    icon={<BarChart3 className="h-4 w-4" />}
                    colorClass={
                      portfolio.beta > 1.2 ? "text-red-400" : portfolio.beta < 0.8 ? "text-yellow-400" : "text-green-400"
                    }
                    badge={
                      portfolio.beta > 1.2
                        ? { label: "Aggressiv", variant: "destructive" }
                        : portfolio.beta < 0.8
                        ? { label: "Defensiv", variant: "secondary" }
                        : { label: "Neutral", variant: "outline" }
                    }
                  />
                  <MetricCard
                    title="Volatilität (ann.)"
                    value={fmt(portfolio.volatility)}
                    description="Annualisierte Standardabweichung"
                    tooltip="Annualisierte Standardabweichung der täglichen Renditen. Misst die Gesamtschwankungsbreite des Portfolios."
                    icon={<Activity className="h-4 w-4" />}
                    colorClass={varColor(portfolio.volatility)}
                  />
                  <MetricCard
                    title="Annualisierte Rendite"
                    value={fmt(portfolio.annualReturn)}
                    description={`Über ${lookbackDays} Handelstage`}
                    tooltip="Annualisierte Portfoliorendite im Betrachtungszeitraum."
                    icon={<TrendingUp className="h-4 w-4" />}
                    colorClass={portfolio.annualReturn > 0 ? "text-green-400" : "text-red-400"}
                  />
                  <MetricCard
                    title="Information Ratio"
                    value={fmtRatio(portfolio.informationRatio)}
                    description={`Aktive Rendite vs. ${benchmarkLabel}`}
                    tooltip="Misst die Überrendite gegenüber dem Benchmark pro Einheit Tracking Error. Höher ist besser."
                    icon={<BarChart3 className="h-4 w-4" />}
                    colorClass={riskColor(portfolio.informationRatio, [0, 0.5])}
                  />
                </div>
              </div>
            </TabsContent>

            {/* ─── Tab: Einzeltitel ─── */}
            <TabsContent value="einzeltitel" className="space-y-4">
              {assets.length > 0 && (
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="text-base">Einzeltitel-Analyse</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Risikokennzahlen pro Position im Portfolio
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-3 text-muted-foreground font-medium">Ticker</th>
                            <th className="text-right py-2 px-3 text-muted-foreground font-medium">Gewicht</th>
                            <th className="text-right py-2 px-3 text-muted-foreground font-medium">Rendite (ann.)</th>
                            <th className="text-right py-2 px-3 text-muted-foreground font-medium">Volatilität</th>
                            <th className="text-right py-2 px-3 text-muted-foreground font-medium">Sharpe</th>
                            <th className="text-right py-2 px-3 text-muted-foreground font-medium">Beta</th>
                            <th className="text-right py-2 px-3 text-muted-foreground font-medium">VaR 95%</th>
                            <th className="text-right py-2 px-3 text-muted-foreground font-medium">Max DD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assets.map((asset: any) => (
                            <tr key={asset.ticker} className="border-b border-border/50 hover:bg-muted/20">
                              <td className="py-2 px-3 font-medium">{asset.ticker}</td>
                              <td className="py-2 px-3 text-right">{(asset.weight * 100).toFixed(1)}%</td>
                              <td className={`py-2 px-3 text-right ${asset.annualReturn > 0 ? "text-green-400" : "text-red-400"}`}>
                                {fmt(asset.annualReturn)}
                              </td>
                              <td className={`py-2 px-3 text-right ${varColor(asset.volatility)}`}>
                                {fmt(asset.volatility)}
                              </td>
                              <td className={`py-2 px-3 text-right ${riskColor(asset.sharpe, [0, 1])}`}>
                                {fmtRatio(asset.sharpe)}
                              </td>
                              <td className="py-2 px-3 text-right">{fmtRatio(asset.beta)}</td>
                              <td className={`py-2 px-3 text-right ${varColor(asset.var95)}`}>
                                {fmt(-Math.abs(asset.var95 ?? 0))}
                              </td>
                              <td className={`py-2 px-3 text-right ${varColor(asset.maxDrawdown)}`}>
                                {fmt(asset.maxDrawdown)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ─── Tab: Weitere Tools ─── */}
            <TabsContent value="weitere" className="space-y-4">
              <Card className="border-border">
                <CardContent className="pt-6 text-center">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Weitere Analyse-Tools</h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    Stress-Tests, Monte-Carlo-Simulationen und Korrelationsmatrizen werden in einer zukünftigen Version verfügbar sein.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Methodology Note */}
        {portfolio && !riskLoading && (
          <Card className="border-border bg-muted/20">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">
                <strong>Methodik:</strong> Berechnungen basieren auf historischen Tagesrenditen der letzten {lookbackDays} Handelstage via Yahoo Finance.
                VaR und CVaR werden historisch und parametrisch (Normalverteilung) berechnet. Sharpe/Sortino verwenden einen risikofreien Zinssatz von 2%.
                Datenpunkte: {portfolio.dataPoints}. Benchmark: {portfolio.benchmark}.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!riskLoading && !portfolio && !riskError && holdings.length === 0 && (
          <Card className="border-border">
            <CardContent className="pt-8 pb-8 text-center">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Wählen Sie ein Portfolio mit mindestens einer Position aus.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
