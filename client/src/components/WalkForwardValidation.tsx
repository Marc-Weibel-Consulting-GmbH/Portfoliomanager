/**
 * WalkForwardValidation Component
 * ================================
 * UI for running Walk-Forward Validation on a broad stock universe
 * with configurable screening criteria, strategy presets, progress bar,
 * and result visualization.
 * 
 * Uses non-blocking backend pattern with polling for progress updates.
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Globe,
  Play,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Star,
  Zap,
} from 'lucide-react';

export default function WalkForwardValidation() {
  const [universeSource, setUniverseSource] = useState<'watchlist' | 'screener' | 'combined'>('combined');
  const [trainWindowMonths, setTrainWindowMonths] = useState(6);
  const [testWindowMonths, setTestWindowMonths] = useState(1);
  const [topQuartilePercent, setTopQuartilePercent] = useState(25);
  const [strategyProfile, setStrategyProfile] = useState<'shortTerm' | 'midTerm' | 'longTerm'>('midTerm');
  const [quickMode, setQuickMode] = useState(true);
  const [region, setRegion] = useState('all');
  const [sector, setSector] = useState('all');
  const [minMarketCap, setMinMarketCap] = useState('');
  const [minScore, setMinScore] = useState('70');
  const [targetSharpe, setTargetSharpe] = useState('');
  const [maxTickers, setMaxTickers] = useState('100');
  const [pollingEnabled, setPollingEnabled] = useState(false);

  const startMutation = trpc.copilot.startWalkForward.useMutation({
    onSuccess: (data) => {
      if (data.started) {
        setPollingEnabled(true);
      }
    },
  });

  const { data: status, refetch: refetchStatus } = trpc.copilot.getWalkForwardStatus.useQuery(undefined, {
    refetchInterval: pollingEnabled ? 2500 : false,
  });

  const { data: history } = trpc.copilot.getWalkForwardHistory.useQuery();

  // Stop polling when walk-forward finishes
  useEffect(() => {
    if (status && !status.isRunning && pollingEnabled) {
      setPollingEnabled(false);
    }
  }, [status, pollingEnabled]);

  const handleRun = () => {
    startMutation.mutate({
      universeSource,
      trainWindowMonths,
      testWindowMonths,
      topQuartilePercent,
      strategyProfile,
      quickMode,
      screeningCriteria: {
        region: region === 'all' ? undefined : region,
        sector: sector === 'all' ? undefined : sector,
        minMarketCap: minMarketCap ? Number(minMarketCap) * 1e9 : undefined,
        minScore: minScore ? Number(minScore) : undefined,
        targetSharpe: targetSharpe ? Number(targetSharpe) : undefined,
        maxTickers: Number(maxTickers) || 100,
      },
    });
  };

  const isRunning = status?.isRunning || pollingEnabled;
  const result = status?.result;
  const apiError = status?.error;

  // Calculate progress percentage from progress messages
  const calculateProgress = () => {
    const msgs = status?.progress || [];
    if (msgs.length === 0) return { pct: 0, label: 'Initialisierung...' };

    // Detect phases from messages
    let totalPeriods = 0;
    let currentPeriod = 0;
    let phase = 'init';

    for (const msg of msgs) {
      const periodsMatch = msg.match(/Erwartete Perioden: (\d+)/);
      if (periodsMatch) totalPeriods = parseInt(periodsMatch[1]);

      const periodMatch = msg.match(/Periode (\d+)\/(\d+)/);
      if (periodMatch) {
        currentPeriod = parseInt(periodMatch[1]);
        totalPeriods = parseInt(periodMatch[2]);
        phase = 'scoring';
      }

      if (msg.includes('Aggregiere')) phase = 'aggregating';
      if (msg.includes('Speichere')) phase = 'saving';
      if (msg.includes('✅')) phase = 'done';
      if (msg.includes('❌')) phase = 'error';
    }

    let pct = 0;
    let label = 'Initialisierung...';

    if (phase === 'init') {
      // Loading tickers phase
      const hasWatchlist = msgs.some(m => m.includes('Watchlist-Titel geladen'));
      const hasScreener = msgs.some(m => m.includes('Screener-Titel geladen'));
      if (hasWatchlist || hasScreener) {
        pct = 10;
        label = 'Universum geladen';
      } else {
        pct = 3;
        label = 'Lade Aktienuniversum...';
      }
    } else if (phase === 'scoring') {
      // Main computation: periods 
      pct = 10 + (currentPeriod / Math.max(1, totalPeriods)) * 75;
      label = `Periode ${currentPeriod}/${totalPeriods} berechnet`;
    } else if (phase === 'aggregating') {
      pct = 88;
      label = 'Ergebnisse aggregieren...';
    } else if (phase === 'saving') {
      pct = 95;
      label = 'In Datenbank speichern...';
    } else if (phase === 'done') {
      pct = 100;
      label = 'Abgeschlossen!';
    } else if (phase === 'error') {
      pct = 100;
      label = 'Fehler aufgetreten';
    }

    return { pct: Math.min(99, Math.max(2, pct)), label };
  };

  const { pct: progressPct, label: progressLabel } = calculateProgress();

  const STRATEGY_LABELS: Record<string, { name: string; description: string; icon: React.ReactNode }> = {
    shortTerm: {
      name: 'Kurzfristig (Swing)',
      description: 'Momentum & Timing: RSI, MACD, 52W-High dominieren',
      icon: <Zap className="h-4 w-4 text-yellow-500" />,
    },
    midTerm: {
      name: 'Mittelfristig (Trend)',
      description: 'Ausgewogen: Momentum, Qualität, Relative Stärke',
      icon: <TrendingUp className="h-4 w-4 text-blue-500" />,
    },
    longTerm: {
      name: 'Langfristig (Investor)',
      description: 'Bewertung & Qualität: P/E, Sharpe, Dividende dominieren',
      icon: <Target className="h-4 w-4 text-emerald-500" />,
    },
  };

  return (
    <div className="space-y-6">
      {/* Configuration */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Walk-Forward Validation
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Testet den Ranking-Algorithmus auf einem breiten Aktienuniversum mit rollierender 
            Out-of-Sample Validation — ohne Overfitting-Risiko.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Strategy Profile */}
          <div className="border border-primary/20 rounded-lg p-4 bg-primary/5">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Strategie-Profil
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(STRATEGY_LABELS).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => setStrategyProfile(key as any)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    strategyProfile === key
                      ? 'border-primary bg-primary/10 ring-1 ring-primary/50'
                      : 'border-muted hover:border-primary/30 hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {info.icon}
                    <span className="text-sm font-medium">{info.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{info.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Universe Source & Windows */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Universum</label>
              <Select value={universeSource} onValueChange={(v: any) => setUniverseSource(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="watchlist">Nur Watchlist (123 Titel)</SelectItem>
                  <SelectItem value="screener">Welt-Screener (EODHD)</SelectItem>
                  <SelectItem value="combined">Watchlist + Screener</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Training-Fenster</label>
              <Select value={String(trainWindowMonths)} onValueChange={(v) => setTrainWindowMonths(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Monate</SelectItem>
                  <SelectItem value="6">6 Monate</SelectItem>
                  <SelectItem value="9">9 Monate</SelectItem>
                  <SelectItem value="12">12 Monate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Test-Fenster (OOS)</label>
              <Select value={String(testWindowMonths)} onValueChange={(v) => setTestWindowMonths(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Monat</SelectItem>
                  <SelectItem value="2">2 Monate</SelectItem>
                  <SelectItem value="3">3 Monate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Screening Criteria */}
          {(universeSource === 'screener' || universeSource === 'combined') && (
            <div className="border border-muted rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Vorselektions-Kriterien
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Region</label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger>
                      <SelectValue placeholder="Alle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Regionen</SelectItem>
                      <SelectItem value="us">USA</SelectItem>
                      <SelectItem value="ch">Schweiz</SelectItem>
                      <SelectItem value="de">Deutschland</SelectItem>
                      <SelectItem value="gb">UK</SelectItem>
                      <SelectItem value="eu">Europa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Sektor</label>
                  <Select value={sector} onValueChange={setSector}>
                    <SelectTrigger>
                      <SelectValue placeholder="Alle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Sektoren</SelectItem>
                      <SelectItem value="Technology">Technologie</SelectItem>
                      <SelectItem value="Healthcare">Gesundheit</SelectItem>
                      <SelectItem value="Financial Services">Finanzen</SelectItem>
                      <SelectItem value="Consumer Cyclical">Konsum (zyklisch)</SelectItem>
                      <SelectItem value="Industrials">Industrie</SelectItem>
                      <SelectItem value="Energy">Energie</SelectItem>
                      <SelectItem value="Communication Services">Kommunikation</SelectItem>
                      <SelectItem value="Utilities">Versorger</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Min. Score</label>
                  <Input
                    type="number"
                    value={minScore}
                    onChange={(e) => setMinScore(e.target.value)}
                    placeholder="z.B. 70"
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Ziel-Sharpe</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={targetSharpe}
                    onChange={(e) => setTargetSharpe(e.target.value)}
                    placeholder="z.B. 1.5"
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Min. MarketCap (Mrd.)</label>
                  <Input
                    type="number"
                    value={minMarketCap}
                    onChange={(e) => setMinMarketCap(e.target.value)}
                    placeholder="z.B. 10"
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Max. Titel</label>
                  <Input
                    type="number"
                    value={maxTickers}
                    onChange={(e) => setMaxTickers(e.target.value)}
                    placeholder="100"
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Top-Quartil %</label>
                  <Select value={String(topQuartilePercent)} onValueChange={(v) => setTopQuartilePercent(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">Top 10%</SelectItem>
                      <SelectItem value="20">Top 20%</SelectItem>
                      <SelectItem value="25">Top 25%</SelectItem>
                      <SelectItem value="33">Top 33%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Quick Mode Toggle */}
          <div className="flex items-center gap-3 p-3 rounded-lg border border-muted bg-muted/20">
            <button
              onClick={() => setQuickMode(!quickMode)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                quickMode ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  quickMode ? 'translate-x-4.5' : 'translate-x-0.5'
                }`}
              />
            </button>
            <div>
              <span className="text-sm font-medium">Quick-Mode</span>
              <span className="text-xs text-muted-foreground ml-2">
                {quickMode ? '(Letzte 3 Jahre, ~36 Perioden, ca. 3–5 Min.)' : '(Vollständig, alle verfügbaren Daten, ca. 15–25 Min.)'}
              </span>
            </div>
          </div>

          {/* Run Button */}
          <Button
            onClick={handleRun}
            disabled={isRunning || startMutation.isPending}
            className="w-full md:w-auto min-w-[200px]"
          >
            {isRunning ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Walk-Forward läuft...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Walk-Forward starten
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Progress Bar */}
      {isRunning && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-5 pb-4">
            <div className="mb-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{progressLabel}</span>
                <span>{Math.round(progressPct)}%</span>
              </div>
              <div className="w-full h-2.5 bg-black/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-500 to-emerald-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
            <div className="bg-black/50 rounded p-3 max-h-36 overflow-y-auto font-mono text-xs text-green-400">
              {(status?.progress || []).slice(-12).map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {apiError && !isRunning && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive">{apiError}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !isRunning && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <WFKPICard
              label="OOS Alpha"
              value={`${result.oosAlpha > 0 ? '+' : ''}${result.oosAlpha.toFixed(2)}%`}
              positive={result.oosAlpha > 0}
              icon={<TrendingUp className="h-4 w-4" />}
              tooltip="Out-of-Sample Alpha: Überperformance des Top-Quartils gegenüber dem Benchmark"
            />
            <WFKPICard
              label="OOS Hit Rate"
              value={`${(result.oosHitRate * 100).toFixed(0)}%`}
              positive={result.oosHitRate > 0.5}
              icon={<Target className="h-4 w-4" />}
              tooltip="Anteil der Top-Quartil-Titel die den Benchmark schlagen"
            />
            <WFKPICard
              label="Overfit Ratio"
              value={result.overfitRatio.toFixed(2)}
              positive={result.overfitRatio < 1.5}
              icon={<BarChart3 className="h-4 w-4" />}
              tooltip="Verhältnis In-Sample zu Out-of-Sample Performance. < 1.5 = gut, > 2.0 = Overfitting-Risiko"
            />
            <WFKPICard
              label="Universum"
              value={`${result.tickerCount} Titel`}
              positive={true}
              icon={<Globe className="h-4 w-4" />}
              tooltip="Anzahl Titel im getesteten Universum"
            />
          </div>

          {/* Window Results */}
          {result.periodResults && result.periodResults.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Rollierende Fenster-Ergebnisse ({result.periodResults.length} Perioden)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-muted">
                        <th className="text-left py-2 px-2 text-xs text-muted-foreground">Periode</th>
                        <th className="text-right py-2 px-2 text-xs text-muted-foreground">Top-Q Return</th>
                        <th className="text-right py-2 px-2 text-xs text-muted-foreground">Benchmark</th>
                        <th className="text-right py-2 px-2 text-xs text-muted-foreground">Alpha</th>
                        <th className="text-right py-2 px-2 text-xs text-muted-foreground">Hit Rate</th>
                        <th className="text-center py-2 px-2 text-xs text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.periodResults.map((w: any, i: number) => (
                        <tr key={i} className="border-b border-muted/50 hover:bg-muted/20">
                          <td className="py-2 px-2 text-xs">
                            {w.testStart} → {w.testEnd}
                          </td>
                          <td className={`py-2 px-2 text-xs text-right font-mono ${w.topReturn > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {w.topReturn > 0 ? '+' : ''}{w.topReturn.toFixed(1)}%
                          </td>
                          <td className={`py-2 px-2 text-xs text-right font-mono ${w.benchmarkReturn > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {w.benchmarkReturn > 0 ? '+' : ''}{w.benchmarkReturn.toFixed(1)}%
                          </td>
                          <td className={`py-2 px-2 text-xs text-right font-mono font-medium ${w.alpha > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {w.alpha > 0 ? '+' : ''}{w.alpha.toFixed(2)}%
                          </td>
                          <td className="py-2 px-2 text-xs text-right font-mono">
                            {(w.hitRate * 100).toFixed(0)}%
                          </td>
                          <td className="py-2 px-2 text-center">
                            {w.alpha > 0 ? (
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 inline" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-red-500 inline" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Performers */}
          {result.topPerformers && result.topPerformers.length > 0 && (
            <Card className="border-emerald-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  KI-Titelvorschläge (konsistent Top-Quartil)
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Titel die über mehrere Walk-Forward Perioden konsistent im Top-Quartil ranken.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {result.topPerformers.map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-muted hover:bg-muted/20">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-xs font-bold text-emerald-500">
                          #{i + 1}
                        </div>
                        <div>
                          <span className="font-medium text-sm">{s.ticker}</span>
                          {s.companyName && (
                            <span className="text-xs text-muted-foreground ml-2">{s.companyName}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono text-emerald-500">
                          Konsistenz: {(s.consistencyScore * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.timesInTopQuartile}/{s.totalPeriods} Perioden
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* History */}
      {history && history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Vergangene Walk-Forward Läufe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.slice(0, 5).map((h: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 rounded border border-muted/50">
                  <span className="text-muted-foreground">{new Date(h.createdAt).toLocaleDateString('de-CH')}</span>
                  <span>{h.tickerCount || h.universeTickers} Titel</span>
                  <span className={Number(h.oosAlpha) > 0 ? 'text-emerald-500' : 'text-red-500'}>
                    Alpha: {Number(h.oosAlpha) > 0 ? '+' : ''}{Number(h.oosAlpha).toFixed(2)}%
                  </span>
                  <span>Hit: {(Number(h.oosHitRate) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper component
function WFKPICard({ label, value, positive, icon, tooltip }: {
  label: string;
  value: string;
  positive: boolean;
  icon: React.ReactNode;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={positive ? 'text-emerald-500' : 'text-red-500'}>{icon}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
              <Info className="h-3 w-3 text-muted-foreground/50" />
            </div>
            <p className={`text-lg font-bold ${positive ? 'text-emerald-500' : 'text-red-500'}`}>
              {value}
            </p>
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs text-xs">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
