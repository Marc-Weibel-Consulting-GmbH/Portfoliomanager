/**
 * LPPLBacktest Component
 * =======================
 * Visualizes the LPPL Bubble Indicator backtest results
 * against historical bubble periods (Dotcom, Financial Crisis, etc.)
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle,
  Play,
  CheckCircle,
  XCircle,
  TrendingDown,
  Loader2,
  Flame,
  BarChart3,
  Search,
} from 'lucide-react';

export default function LPPLBacktest() {
  const [customTicker, setCustomTicker] = useState('SPY');
  const [customStart, setCustomStart] = useState('2020-01-01');
  const [customEnd, setCustomEnd] = useState('2022-01-01');
  const [showCustom, setShowCustom] = useState(false);

  const fullBacktestMutation = trpc.copilot.runLpplBacktest.useMutation();
  const { data: bubblePeriods } = trpc.copilot.getLpplBubblePeriods.useQuery();
  const { data: customResult, isLoading: customLoading } = trpc.copilot.runLpplCustom.useQuery(
    { ticker: customTicker, startDate: customStart, endDate: customEnd },
    { enabled: showCustom, staleTime: 5 * 60 * 1000 }
  );

  const result = fullBacktestMutation.data?.result;
  const apiError = fullBacktestMutation.data?.error;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            LPPL Bubble Indicator — Historischer Backtest
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Testet den Log-Periodic Power Law (LPPL) Indikator anhand bekannter historischer 
            Blasenbildungen. Zeigt wie gut der Indikator Crashes vorhersagen konnte.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Known Bubbles */}
          {bubblePeriods && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Bekannte Blasen-Perioden:</h4>
              <div className="flex flex-wrap gap-2">
                {bubblePeriods.map((b: any, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {b.name} ({b.peakDate?.split('-')[0]})
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={() => fullBacktestMutation.mutate()}
              disabled={fullBacktestMutation.isPending}
              className="min-w-[200px]"
            >
              {fullBacktestMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Berechne...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  Alle Blasen testen
                </span>
              )}
            </Button>
          </div>
          {fullBacktestMutation.isPending && (
            <p className="text-xs text-muted-foreground">
              ⏳ Lade historische Daten für alle Blasen-Perioden und berechne LPPL-Fits... Dies kann 1-2 Minuten dauern.
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

      {/* Full Backtest Results */}
      {result && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard
              label="Getestete Blasen"
              value={String(result.results?.length || 0)}
              icon={<Flame className="h-4 w-4" />}
            />
            <SummaryCard
              label="Erkannt (True Positive)"
              value={String(result.results?.filter((r: any) => r.detectedBubble).length || 0)}
              icon={<CheckCircle className="h-4 w-4 text-emerald-500" />}
            />
            <SummaryCard
              label="Verpasst (False Negative)"
              value={String(result.results?.filter((r: any) => !r.detectedBubble).length || 0)}
              icon={<XCircle className="h-4 w-4 text-red-500" />}
            />
            <SummaryCard
              label="Erkennungsrate"
              value={`${(result.overallAccuracy || 0).toFixed(0)}%`}
              icon={<BarChart3 className="h-4 w-4 text-primary" />}
            />
          </div>

          {/* Per-Bubble Results */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ergebnisse pro Blasen-Periode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(result.results || []).map((b: any, i: number) => (
                  <div key={i} className="p-4 rounded-lg border border-muted hover:bg-muted/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {b.detectedBubble ? (
                          <CheckCircle className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <div>
                          <span className="font-medium">{b.period?.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({b.period?.ticker}, {b.period?.peakDate})
                          </span>
                        </div>
                      </div>
                      <Badge variant={b.detectedBubble ? 'default' : 'destructive'}>
                        {b.detectedBubble ? 'Erkannt' : 'Verpasst'}
                      </Badge>
                    </div>
                    {b.detectedBubble && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Signal-Datum:</span>
                          <span className="ml-1 font-mono">{b.detectionDate || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Vorlaufzeit:</span>
                          <span className="ml-1 font-mono">{b.daysBeforePeak || 0} Tage</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Crash-Tiefe:</span>
                          <span className="ml-1 font-mono text-red-500">{b.period?.peakToTroughDrop}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">LPPL Confidence:</span>
                          <span className="ml-1 font-mono">{b.maxConfidence?.toFixed(0) || 0}%</span>
                        </div>
                      </div>
                    )}
                    {!b.detectedBubble && (
                      <p className="text-xs text-muted-foreground mt-1">Qualität: {b.accuracy || 'unbekannt'}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Interpretation */}
          <Card className="border-orange-500/20 bg-orange-500/5">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Interpretation</p>
                  <p className="text-muted-foreground">
                    Der LPPL-Indikator ist ein probabilistisches Werkzeug — er erkennt 
                    <strong> super-exponentielle Wachstumsmuster</strong>, die auf Blasenbildung hindeuten.
                    Eine Erkennungsrate von {(result.overallAccuracy || 0).toFixed(0)}% bei historischen 
                    Blasen zeigt {(result.overallAccuracy || 0) >= 70 ? 'eine gute' : 'eine moderate'} prädiktive Kraft.
                    Falsch-positive Signale (Fehlalarme) sind möglich und sollten mit anderen Indikatoren validiert werden.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Custom LPPL Analysis */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Custom LPPL-Analyse
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Teste den LPPL-Indikator auf einem beliebigen Ticker und Zeitraum.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ticker</label>
              <Input
                value={customTicker}
                onChange={(e) => { setCustomTicker(e.target.value.toUpperCase()); setShowCustom(false); }}
                placeholder="z.B. SPY, AAPL"
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Start</label>
              <Input
                type="date"
                value={customStart}
                onChange={(e) => { setCustomStart(e.target.value); setShowCustom(false); }}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ende</label>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => { setCustomEnd(e.target.value); setShowCustom(false); }}
                className="h-9"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => setShowCustom(true)} disabled={customLoading} className="w-full h-9">
                {customLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Analysieren'}
              </Button>
            </div>
          </div>

          {/* Custom Results */}
          {showCustom && customResult && !customResult.error && customResult.signals && (
            <div className="mt-4 space-y-2">
              {customResult.signals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Keine LPPL-Signale im gewählten Zeitraum gefunden.
                </p>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">
                    {customResult.signals.length} Signal(e) gefunden:
                  </h4>
                  {customResult.signals.map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-orange-500/30 bg-orange-500/5">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-mono">{s.date}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span>Confidence: <strong>{(s.confidence * 100).toFixed(0)}%</strong></span>
                        <span>tc (Crash-Datum): <strong>{s.tc}</strong></span>
                        <Badge variant={s.confidence > 0.7 ? 'destructive' : 'outline'}>
                          {s.confidence > 0.7 ? 'Hohes Risiko' : 'Moderate Warnung'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {showCustom && customResult?.error && (
            <p className="text-sm text-destructive mt-2">{customResult.error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
