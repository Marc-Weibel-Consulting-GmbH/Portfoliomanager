// Bewusst behalten (aktuell nicht geroutet): wird in Phase 4 wieder angeschlossen — siehe OPTIMIZATION_PLAN.md R-36/F-02/F-14
import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import CopilotBacktest from '@/components/CopilotBacktest';
import WalkForwardValidation from '@/components/WalkForwardValidation';
import LPPLBacktest from '@/components/LPPLBacktest';
import CopilotHistory from '@/components/CopilotHistory';
import MonitoringStatus from '@/components/MonitoringStatus';
import { useAuth } from '@/_core/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Info,
  Loader2,
  RefreshCw,
  Target,
  BarChart3,
  Zap,
  CheckCircle,
  Play,
  History,
  Globe,
  Flame,
  Bell,
} from 'lucide-react';

export default function PortfolioCopilot() {
  const { user } = useAuth();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);

  // Fetch portfolios
  const { data: portfolios } = trpc.portfolios.list.useQuery(undefined, {
    enabled: !!user,
  });

  // Fetch copilot analysis
  const {
    data: copilotData,
    isLoading,
    isFetching,
    refetch,
  } = trpc.copilot.analyze.useQuery(
    { portfolioId: selectedPortfolioId! },
    { enabled: !!selectedPortfolioId, staleTime: 5 * 60 * 1000 }
  );

  const analysis = copilotData?.analysis;
  const explanation = copilotData?.explanation;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Brain className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Portfolio Copilot</h1>
              <p className="text-sm text-muted-foreground">
                ML-basierte Entscheidungshilfe mit Ranking, Rebalancing und Risikowarnungen
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select
              value={selectedPortfolioId?.toString() || ''}
              onValueChange={(v) => setSelectedPortfolioId(Number(v))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Portfolio wählen" />
              </SelectTrigger>
              <SelectContent>
                {portfolios?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedPortfolioId && (
              <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && selectedPortfolioId && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            <p className="text-muted-foreground">Copilot analysiert dein Portfolio...</p>
            <p className="text-xs text-muted-foreground">Daten werden geladen und ML-Modelle berechnet (ca. 15-30s)</p>
          </div>
        )}

        {/* Error State */}
        {copilotData?.error && (
          <Card className="border-destructive/50">
            <CardContent className="p-6">
              <p className="text-destructive">{copilotData.error}</p>
            </CardContent>
          </Card>
        )}

        {/* No Portfolio Selected */}
        {!selectedPortfolioId && (
          <Card>
            <CardContent className="p-12 text-center">
              <Brain className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">Portfolio auswählen</h3>
              <p className="text-muted-foreground">
                Wähle ein Portfolio aus, um die ML-basierte Analyse zu starten.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {analysis && !isLoading && (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                title="Erwartete Rendite"
                value={`${(analysis.portfolioMetrics.expectedReturn * 100).toFixed(1)}%`}
                subtitle="p.a."
                icon={<TrendingUp className="h-4 w-4" />}
                color="emerald"
              />
              <MetricCard
                title="Volatilität"
                value={`${(analysis.portfolioMetrics.expectedVolatility * 100).toFixed(1)}%`}
                subtitle="p.a."
                icon={<BarChart3 className="h-4 w-4" />}
                color="amber"
              />
              <MetricCard
                title="Sharpe Ratio"
                value={analysis.portfolioMetrics.sharpeRatio.toFixed(2)}
                subtitle="Risiko-adj. Rendite"
                icon={<Target className="h-4 w-4" />}
                color={analysis.portfolioMetrics.sharpeRatio > 1 ? 'emerald' : 'amber'}
              />
              <MetricCard
                title="Diversifikation"
                value={`${analysis.diversificationScore.overall}/100`}
                subtitle={getDiversificationLabel(analysis.diversificationScore.overall)}
                icon={<Shield className="h-4 w-4" />}
                color={analysis.diversificationScore.overall > 60 ? 'emerald' : analysis.diversificationScore.overall > 40 ? 'amber' : 'red'}
              />
            </div>

            {/* AI Explanation */}
            {explanation && (
              <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-emerald-500" />
                    KI-Zusammenfassung
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                    {explanation}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Warnings */}
            {analysis.warnings.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Warnungen ({analysis.warnings.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysis.warnings.map((warning, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${
                        warning.severity === 'high'
                          ? 'border-red-500/30 bg-red-500/5'
                          : warning.severity === 'medium'
                          ? 'border-amber-500/30 bg-amber-500/5'
                          : 'border-muted'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Badge
                          variant={warning.severity === 'high' ? 'destructive' : 'secondary'}
                          className="text-xs shrink-0 mt-0.5"
                        >
                          {warning.severity === 'high' ? 'Hoch' : warning.severity === 'medium' ? 'Mittel' : 'Niedrig'}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">{warning.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{warning.description}</p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                            → {warning.suggestedAction}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Rankings Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Titel-Ranking (relativ)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4">#</th>
                        <th className="pb-2 pr-4">Titel</th>
                        <th className="pb-2 pr-4">Score</th>
                        <th className="pb-2 pr-4 hidden md:table-cell">Outperf. %</th>
                        <th className="pb-2 pr-4">Signal</th>
                        <th className="pb-2 pr-4 hidden md:table-cell">Gewicht</th>
                        <th className="pb-2 hidden lg:table-cell">Treiber</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.rankings.map((rank, i) => (
                        <tr key={rank.ticker} className="border-b border-muted/50 hover:bg-muted/30">
                          <td className="py-2.5 pr-4 text-muted-foreground">{i + 1}</td>
                          <td className="py-2.5 pr-4">
                            <div>
                              <span className="font-medium">{rank.ticker}</span>
                              <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
                                {rank.companyName}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16">
                                <Progress
                                  value={rank.rankScore}
                                  className="h-2"
                                />
                              </div>
                              <span className="font-mono text-xs font-medium">{rank.rankScore}</span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 hidden md:table-cell">
                            <Tooltip>
                              <TooltipTrigger>
                                <span className={`font-mono text-xs ${rank.outperformProbability > 0.5 ? 'text-emerald-500' : 'text-red-500'}`}>
                                  {(rank.outperformProbability * 100).toFixed(0)}%
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Wahrscheinlichkeit, den Portfolio-Durchschnitt zu übertreffen.
                                Unsicherheit: {(rank.uncertainty * 100).toFixed(0)}%
                              </TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="py-2.5 pr-4">
                            <SignalBadge signal={rank.signal} />
                          </td>
                          <td className="py-2.5 pr-4 hidden md:table-cell font-mono text-xs">
                            {(rank.currentWeight * 100).toFixed(1)}%
                          </td>
                          <td className="py-2.5 hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {rank.drivers.slice(0, 2).map((d, j) => (
                                <span key={j} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                  {d}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Rebalancing Suggestions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                  Rebalancing-Vorschläge
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysis.rebalancingSuggestions
                    .filter((s) => s.action !== 'hold')
                    .map((suggestion) => (
                      <div
                        key={suggestion.ticker}
                        className="flex items-center justify-between p-3 rounded-lg border border-muted hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <ActionIcon action={suggestion.action} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{suggestion.ticker}</span>
                              <span className="text-xs text-muted-foreground">{suggestion.companyName}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{suggestion.reason}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">
                              {(suggestion.currentWeight * 100).toFixed(1)}%
                            </span>
                            <span className="text-xs">→</span>
                            <span className="text-xs font-medium">
                              {(suggestion.targetWeight * 100).toFixed(1)}%
                            </span>
                          </div>
                          <span
                            className={`text-xs font-mono ${
                              suggestion.delta > 0 ? 'text-emerald-500' : 'text-red-500'
                            }`}
                          >
                            {suggestion.delta > 0 ? '+' : ''}
                            {(suggestion.delta * 100).toFixed(1)}pp
                          </span>
                        </div>
                      </div>
                    ))}
                  {analysis.rebalancingSuggestions.filter((s) => s.action !== 'hold').length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Keine Umschichtungen empfohlen — Portfolio ist gut ausbalanciert.
                    </p>
                  )}
                </div>
                {/* Apply Rebalancing Button */}
                {analysis.rebalancingSuggestions.filter((s) => s.action !== 'hold').length > 0 && (
                  <ApplyRebalancingButton
                    portfolioId={selectedPortfolioId!}
                    suggestions={analysis.rebalancingSuggestions.filter((s) => s.action !== 'hold')}
                  />
                )}
              </CardContent>
            </Card>

            {/* Diversification Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  Diversifikations-Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <DiversificationMetric
                    label="Konzentration"
                    value={analysis.diversificationScore.concentrationScore}
                    description={`HHI: ${analysis.diversificationScore.herfindahlIndex.toFixed(3)}`}
                  />
                  <DiversificationMetric
                    label="Sektor-Diversifikation"
                    value={analysis.diversificationScore.sectorDiversification}
                    description="Verteilung über Sektoren"
                  />
                  <DiversificationMetric
                    label="Korrelation"
                    value={analysis.diversificationScore.correlationDiversification}
                    description="Unabhängigkeit der Titel"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Tabs for Backtest, Walk-Forward, LPPL, History, Monitoring */}
            <Tabs defaultValue="backtest" className="w-full">
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="backtest" className="text-xs">
                  <BarChart3 className="h-3.5 w-3.5 mr-1" />
                  Backtest
                </TabsTrigger>
                <TabsTrigger value="walkforward" className="text-xs">
                  <Globe className="h-3.5 w-3.5 mr-1" />
                  Walk-Forward
                </TabsTrigger>
                <TabsTrigger value="lppl" className="text-xs">
                  <Flame className="h-3.5 w-3.5 mr-1" />
                  LPPL Blasen
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs">
                  <History className="h-3.5 w-3.5 mr-1" />
                  Historie
                </TabsTrigger>
                <TabsTrigger value="monitoring" className="text-xs">
                  <Bell className="h-3.5 w-3.5 mr-1" />
                  Monitoring
                </TabsTrigger>
              </TabsList>
              <TabsContent value="backtest" className="mt-4">
                <CopilotBacktest portfolioId={selectedPortfolioId!} />
              </TabsContent>
              <TabsContent value="walkforward" className="mt-4">
                <WalkForwardValidation />
              </TabsContent>
              <TabsContent value="lppl" className="mt-4">
                <LPPLBacktest />
              </TabsContent>
              <TabsContent value="history" className="mt-4">
                <CopilotHistory portfolioId={selectedPortfolioId!} />
              </TabsContent>
              <TabsContent value="monitoring" className="mt-4">
                <MonitoringStatus />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color: 'emerald' | 'amber' | 'red';
}) {
  const colorClasses = {
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    red: 'text-red-500',
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{title}</span>
          <span className={colorClasses[color]}>{icon}</span>
        </div>
        <p className={`text-xl font-bold ${colorClasses[color]}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function SignalBadge({ signal }: { signal: string }) {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    strong_buy: { label: 'Stark Kaufen', variant: 'default' },
    buy: { label: 'Kaufen', variant: 'default' },
    hold: { label: 'Halten', variant: 'secondary' },
    sell: { label: 'Verkaufen', variant: 'destructive' },
    strong_sell: { label: 'Stark Verkaufen', variant: 'destructive' },
  };
  const c = config[signal] || { label: signal, variant: 'outline' as const };
  return <Badge variant={c.variant} className="text-xs">{c.label}</Badge>;
}

function ActionIcon({ action }: { action: string }) {
  if (action === 'increase') return <ArrowUpRight className="h-5 w-5 text-emerald-500" />;
  if (action === 'decrease') return <ArrowDownRight className="h-5 w-5 text-red-500" />;
  if (action === 'exit') return <TrendingDown className="h-5 w-5 text-red-600" />;
  return <Minus className="h-5 w-5 text-muted-foreground" />;
}

function DiversificationMetric({ label, value, description }: { label: string; value: number; description: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm">{label}</span>
        <span className="text-sm font-mono font-medium">{value}/100</span>
      </div>
      <Progress value={value} className="h-2" />
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function getDiversificationLabel(score: number): string {
  if (score >= 80) return 'Ausgezeichnet';
  if (score >= 60) return 'Gut';
  if (score >= 40) return 'Mittel';
  if (score >= 20) return 'Schwach';
  return 'Kritisch';
}

// ============================================================
// APPLY REBALANCING BUTTON
// ============================================================

function ApplyRebalancingButton({
  portfolioId,
  suggestions,
}: {
  portfolioId: number;
  suggestions: Array<{
    ticker: string;
    companyName: string;
    action: string;
    currentWeight: number;
    targetWeight: number;
    delta: number;
  }>;
}) {
  const [isApplying, setIsApplying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const applyMutation = trpc.copilot.applyRebalancing.useMutation();
  const utils = trpc.useUtils();

  const handleApply = async () => {
    setIsApplying(true);
    try {
      // R-36: Zielgewichte senden — der Server berechnet echte Stückzahlen
      // aus Portfoliowert, aktuellem Kurs und FX (kein Platzhalter mehr).
      const targetWeights = suggestions.map((s) => ({
        ticker: s.ticker,
        companyName: s.companyName,
        targetWeight: s.targetWeight,
      }));

      const result = await applyMutation.mutateAsync({
        portfolioId,
        targetWeights,
        saveToHistory: true,
      });

      if (result.error) {
        toast.error(`Teilweise fehlgeschlagen: ${result.error}`);
      } else {
        toast.success(`${result.applied} Transaktionen erfolgreich gebucht!`);
      }

      // Invalidate portfolio data
      utils.copilot.getHistory.invalidate();
      utils.portfolios.invalidate();
      setShowConfirm(false);
    } catch (err: any) {
      toast.error(err.message || 'Rebalancing fehlgeschlagen');
    } finally {
      setIsApplying(false);
    }
  };

  if (!showConfirm) {
    return (
      <div className="mt-4 pt-4 border-t border-muted">
        <Button
          onClick={() => setShowConfirm(true)}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
        >
          <Play className="h-4 w-4 mr-2" />
          Rebalancing anwenden ({suggestions.length} Trades)
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Bucht die vorgeschlagenen Trades als echte Transaktionen in Ihr Portfolio.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-muted space-y-3">
      <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-600">Bestätigung erforderlich</p>
            <p className="text-xs text-muted-foreground mt-1">
              {suggestions.length} Transaktionen werden als echte Trades gebucht. 
              Dies kann nicht rückgängig gemacht werden.
            </p>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={handleApply}
          disabled={isApplying}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
        >
          {isApplying ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buche Trades...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Bestätigen & Buchen
            </span>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowConfirm(false)}
          disabled={isApplying}
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}