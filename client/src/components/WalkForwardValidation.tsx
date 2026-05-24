/**
 * WalkForwardValidation Component
 * ================================
 * UI for running Walk-Forward Validation on a broad stock universe
 * with configurable screening criteria and result visualization.
 */

import { useState } from 'react';
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
} from 'lucide-react';

export default function WalkForwardValidation() {
  const [universeSource, setUniverseSource] = useState<'watchlist' | 'screener' | 'combined'>('combined');
  const [trainWindowMonths, setTrainWindowMonths] = useState(6);
  const [testWindowMonths, setTestWindowMonths] = useState(1);
  const [topQuartilePercent, setTopQuartilePercent] = useState(25);
  const [region, setRegion] = useState('');
  const [sector, setSector] = useState('');
  const [minMarketCap, setMinMarketCap] = useState('');
  const [minScore, setMinScore] = useState('70');
  const [targetSharpe, setTargetSharpe] = useState('');
  const [maxTickers, setMaxTickers] = useState('100');

  const walkForwardMutation = trpc.copilot.runWalkForward.useMutation();
  const { data: history } = trpc.copilot.getWalkForwardHistory.useQuery();

  const handleRun = () => {
    walkForwardMutation.mutate({
      universeSource,
      trainWindowMonths,
      testWindowMonths,
      topQuartilePercent,
      screeningCriteria: {
        region: region || undefined,
        sector: sector || undefined,
        minMarketCap: minMarketCap ? Number(minMarketCap) * 1e9 : undefined,
        minScore: minScore ? Number(minScore) : undefined,
        targetSharpe: targetSharpe ? Number(targetSharpe) : undefined,
        maxTickers: Number(maxTickers) || 100,
      },
    });
  };

  const result = walkForwardMutation.data?.result;
  const apiError = walkForwardMutation.data?.error;

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
          {/* Universe Source */}
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
                      <SelectItem value="">Alle Regionen</SelectItem>
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
                      <SelectItem value="">Alle Sektoren</SelectItem>
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

          {/* Run Button */}
          <Button
            onClick={handleRun}
            disabled={walkForwardMutation.isPending}
            className="w-full md:w-auto min-w-[200px]"
          >
            {walkForwardMutation.isPending ? (
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
          {walkForwardMutation.isPending && (
            <p className="text-xs text-muted-foreground">
              ⏳ Lade Kursdaten für das Universum und berechne rollierende Rankings... Dies kann 1-3 Minuten dauern.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {apiError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive">{apiError}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <WFKPICard
              label="OOS Alpha"
              value={`${result.summary.oosAlpha > 0 ? '+' : ''}${(result.summary.oosAlpha * 100).toFixed(2)}%`}
              positive={result.summary.oosAlpha > 0}
              icon={<TrendingUp className="h-4 w-4" />}
              tooltip="Out-of-Sample Alpha: Überperformance des Top-Quartils gegenüber dem Gesamtuniversum"
            />
            <WFKPICard
              label="OOS Hit Rate"
              value={`${(result.summary.oosHitRate * 100).toFixed(0)}%`}
              positive={result.summary.oosHitRate > 0.5}
              icon={<Target className="h-4 w-4" />}
              tooltip="Anteil der OOS-Perioden mit positivem Alpha"
            />
            <WFKPICard
              label="Overfit Ratio"
              value={result.summary.overfitRatio.toFixed(2)}
              positive={result.summary.overfitRatio < 1.5}
              icon={<BarChart3 className="h-4 w-4" />}
              tooltip="Verhältnis In-Sample zu Out-of-Sample Performance. < 1.5 = gut, > 2.0 = Overfitting-Risiko"
            />
            <WFKPICard
              label="Universum"
              value={`${result.summary.universeTickers} Titel`}
              positive={true}
              icon={<Globe className="h-4 w-4" />}
              tooltip="Anzahl Titel im getesteten Universum"
            />
          </div>

          {/* Window Results */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Rollierende Fenster-Ergebnisse
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-muted">
                      <th className="text-left py-2 px-2 text-xs text-muted-foreground">Periode</th>
                      <th className="text-right py-2 px-2 text-xs text-muted-foreground">Top-Q Return</th>
                      <th className="text-right py-2 px-2 text-xs text-muted-foreground">Universum Return</th>
                      <th className="text-right py-2 px-2 text-xs text-muted-foreground">Alpha</th>
                      <th className="text-center py-2 px-2 text-xs text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.windowResults.map((w: any, i: number) => (
                      <tr key={i} className="border-b border-muted/50 hover:bg-muted/20">
                        <td className="py-2 px-2 text-xs">
                          {w.testStart} → {w.testEnd}
                        </td>
                        <td className={`py-2 px-2 text-xs text-right font-mono ${w.topQuartileReturn > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {(w.topQuartileReturn * 100).toFixed(1)}%
                        </td>
                        <td className={`py-2 px-2 text-xs text-right font-mono ${w.universeReturn > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {(w.universeReturn * 100).toFixed(1)}%
                        </td>
                        <td className={`py-2 px-2 text-xs text-right font-mono font-medium ${w.alpha > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {w.alpha > 0 ? '+' : ''}{(w.alpha * 100).toFixed(2)}%
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

          {/* Top Suggestions */}
          {result.topSuggestions && result.topSuggestions.length > 0 && (
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
                  {result.topSuggestions.map((s: any, i: number) => (
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
                          Score: {s.avgScore?.toFixed(0) || 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.topQuartileCount}/{s.totalWindows} Perioden
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
                  <span>{h.universeTickers} Titel</span>
                  <span className={h.oosAlpha > 0 ? 'text-emerald-500' : 'text-red-500'}>
                    Alpha: {(h.oosAlpha * 100).toFixed(2)}%
                  </span>
                  <span>Hit: {(h.oosHitRate * 100).toFixed(0)}%</span>
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
