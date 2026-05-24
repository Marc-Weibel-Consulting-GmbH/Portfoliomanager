/**
 * Admin Signal-Optimizer Page
 * ===========================
 * Shows current signal weights, optimization history, and allows
 * triggering the auto-optimizer (grid search over indicator weights).
 */

import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, RotateCcw, CheckCircle2, AlertTriangle, Zap } from "lucide-react";

export default function AdminOptimizer() {
  const [pollingEnabled, setPollingEnabled] = useState(false);

  const { data: weights, isLoading: weightsLoading } = trpc.optimizer.getWeights.useQuery();
  const { data: history, isLoading: historyLoading } = trpc.optimizer.getHistory.useQuery();
  const { data: status, refetch: refetchStatus } = trpc.optimizer.getStatus.useQuery(undefined, {
    refetchInterval: pollingEnabled ? 3000 : false,
  });
  const { data: defaultWeights } = trpc.optimizer.getDefaultWeights.useQuery();

  const startMutation = trpc.optimizer.startOptimizer.useMutation({
    onSuccess: () => {
      setPollingEnabled(true);
    },
  });

  const activateMutation = trpc.optimizer.activateWeights.useMutation({
    onSuccess: () => {
      window.location.reload();
    },
  });

  const resetMutation = trpc.optimizer.resetToDefault.useMutation({
    onSuccess: () => {
      window.location.reload();
    },
  });

  // Stop polling when optimizer finishes
  useEffect(() => {
    if (status && !status.isRunning && pollingEnabled) {
      setPollingEnabled(false);
    }
  }, [status, pollingEnabled]);

  const weightLabels: Record<string, string> = {
    pe: "P/E Ratio",
    peg: "PEG Ratio",
    rsi: "RSI (14)",
    macd: "MACD",
    dividend: "Dividende",
    week52: "52W-Range",
    ytd: "YTD Perf.",
    rf: "Random Forest",
    sentiment: "Sentiment",
    bubble: "Bubble (LPPLS)",
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="w-6 h-6 text-yellow-500" />
              Signal Auto-Optimizer
            </h1>
            <p className="text-muted-foreground mt-1">
              Backtestet alle Watchlist-Titel und optimiert die Indikator-Gewichtungen für maximale Trefferquote.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending || weights?.isDefault}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Standard-Gewichte
            </Button>
            <Button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending || status?.isRunning}
            >
              {status?.isRunning ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {status?.isRunning ? "Läuft..." : "Optimizer starten"}
            </Button>
          </div>
        </div>

        {/* Optimizer Status / Progress */}
        {(status?.isRunning || (status?.progress && status.progress.length > 0)) && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                {status.isRunning ? (
                  <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
                {status.isRunning ? "Optimierung läuft..." : "Letzte Optimierung abgeschlossen"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Progress Bar */}
              {status.isRunning && (() => {
                // Parse progress from messages to estimate completion
                const msgs = status.progress || [];
                let phase = 0; // 0=loading, 1=pass1, 2=pass2, 3=pass3, 4=walkforward
                let gridProgress = 0;
                for (const msg of msgs) {
                  if (msg.includes('Pass 1:')) phase = 1;
                  if (msg.includes('Pass 2:') || msg.includes('Grid Search')) phase = 2;
                  if (msg.includes('Pass 3:')) phase = 3;
                  if (msg.includes('Walk-Forward')) phase = 4;
                  // Parse grid search percentage
                  const gridMatch = msg.match(/Grid Search Fortschritt: \d+\/\d+ \((\d+)%\)/);
                  if (gridMatch) gridProgress = parseInt(gridMatch[1]);
                }
                // Estimate total progress: loading=10%, pass1=20%, pass2=50%, pass3=10%, walkforward=10%
                let totalProgress = 0;
                if (phase === 0) {
                  // Loading data phase - estimate from "Preisdaten geladen" messages
                  const loadMatch = msgs.filter(m => m.includes('Preisdaten geladen'));
                  totalProgress = loadMatch.length > 0 ? Math.min(10, loadMatch.length * 2) : 2;
                } else if (phase === 1) {
                  totalProgress = 15;
                } else if (phase === 2) {
                  totalProgress = 20 + (gridProgress * 0.5); // 20-70%
                } else if (phase === 3) {
                  totalProgress = 75;
                } else if (phase === 4) {
                  totalProgress = 90;
                }
                const pct = Math.min(95, Math.max(2, totalProgress));
                const phaseLabels = ['Daten laden...', 'Pass 1: Lookforward optimieren', 'Pass 2: Grid Search', 'Pass 3: Feinabstimmung', 'Walk-Forward Validierung'];
                return (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{phaseLabels[phase]}</span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                    <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-500 to-emerald-500 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
              <div className="bg-black/50 rounded p-3 max-h-48 overflow-y-auto font-mono text-xs text-green-400">
                {status.progress?.slice(-15).map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
              </div>
              {status.lastResult && !status.isRunning && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Trefferquote:</span>{" "}
                      <span className="font-bold text-green-500">{status.lastResult.hitRate.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Signale getestet:</span>{" "}
                      <span className="font-bold">{status.lastResult.totalBacktested}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Korrekte Signale:</span>{" "}
                      <span className="font-bold">{status.lastResult.correctSignals}</span>
                    </div>
                  </div>
                  {status.lastResult.walkForward && (
                    <div className="border-t pt-3">
                      <div className="text-xs font-semibold text-muted-foreground mb-2">Walk-Forward Validierung (80/20)</div>
                      <div className="grid grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">In-Sample:</span>{" "}
                          <span className="font-bold">{status.lastResult.walkForward.inSampleHitRate.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Out-of-Sample:</span>{" "}
                          <span className="font-bold text-blue-500">{status.lastResult.walkForward.outOfSampleHitRate.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Overfit-Ratio:</span>{" "}
                          <span className={`font-bold ${status.lastResult.walkForward.overfitRatio > 1.3 ? 'text-yellow-500' : 'text-green-500'}`}>
                            {status.lastResult.walkForward.overfitRatio.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Titel:</span>{" "}
                          <span className="font-bold">{status.lastResult.totalStocksProcessed || '?'}</span>
                        </div>
                      </div>
                      {status.lastResult.walkForward.overfitRatio > 1.3 && (
                        <div className="mt-2 text-xs text-yellow-500 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Overfitting erkannt — Gewichte wurden automatisch regularisiert (60/40 Blend)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Current Active Weights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Aktuelle Gewichtungen</span>
              {weights?.isDefault && (
                <Badge variant="secondary">Standard</Badge>
              )}
              {!weights?.isDefault && (
                <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Optimiert</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weightsLoading ? (
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            ) : weights ? (
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(weights.weights).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded bg-muted/50">
                    <span className="text-sm font-medium">{weightLabels[key] || key}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(value as number) * 100 * 3}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono w-12 text-right">
                        {((value as number) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Top 5 Combinations from Last Run */}
        {status?.lastResult?.topCombinations && (
          <Card>
            <CardHeader>
              <CardTitle>Top 5 Gewichtungskombinationen (letzter Durchlauf)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">#</th>
                      <th className="text-left py-2 px-2">Trefferquote</th>
                      <th className="text-left py-2 px-2">P/E</th>
                      <th className="text-left py-2 px-2">PEG</th>
                      <th className="text-left py-2 px-2">RSI</th>
                      <th className="text-left py-2 px-2">MACD</th>
                      <th className="text-left py-2 px-2">Div.</th>
                      <th className="text-left py-2 px-2">52W</th>
                      <th className="text-left py-2 px-2">YTD</th>
                      <th className="text-left py-2 px-2">RF</th>
                      <th className="text-left py-2 px-2">Sent.</th>
                      <th className="text-left py-2 px-2">Bubble</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.lastResult.topCombinations.map((combo: any, i: number) => (
                      <tr key={i} className={`border-b ${i === 0 ? 'bg-green-500/10' : ''}`}>
                        <td className="py-2 px-2 font-bold">{i + 1}</td>
                        <td className="py-2 px-2 font-bold text-green-500">{combo.hitRate.toFixed(1)}%</td>
                        <td className="py-2 px-2">{(combo.weights.pe * 100).toFixed(0)}%</td>
                        <td className="py-2 px-2">{(combo.weights.peg * 100).toFixed(0)}%</td>
                        <td className="py-2 px-2">{(combo.weights.rsi * 100).toFixed(0)}%</td>
                        <td className="py-2 px-2">{(combo.weights.macd * 100).toFixed(0)}%</td>
                        <td className="py-2 px-2">{(combo.weights.dividend * 100).toFixed(0)}%</td>
                        <td className="py-2 px-2">{(combo.weights.week52 * 100).toFixed(0)}%</td>
                        <td className="py-2 px-2">{(combo.weights.ytd * 100).toFixed(0)}%</td>
                        <td className="py-2 px-2">{(combo.weights.rf * 100).toFixed(0)}%</td>
                        <td className="py-2 px-2">{(combo.weights.sentiment * 100).toFixed(0)}%</td>
                        <td className="py-2 px-2">{combo.weights.bubble ? (combo.weights.bubble * 100).toFixed(0) + '%' : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Optimization History */}
        <Card>
          <CardHeader>
            <CardTitle>Optimierungs-Verlauf</CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            ) : history && history.length > 0 ? (
              <div className="space-y-2">
                {history.map((entry: any) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between p-3 rounded border ${
                      entry.isActive ? 'border-green-500/50 bg-green-500/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {entry.isActive && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      <div>
                        <div className="font-medium text-sm">{entry.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleDateString('de-CH')} · {entry.totalBacktested} Signale getestet
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={parseFloat(String(entry.hitRate)) > 60 ? "default" : "secondary"}>
                        {parseFloat(String(entry.hitRate)).toFixed(1)}% Trefferquote
                      </Badge>
                      {!entry.isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => activateMutation.mutate({ id: entry.id })}
                          disabled={activateMutation.isPending}
                        >
                          Aktivieren
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Noch keine Optimierung durchgeführt.</p>
                <p className="text-xs mt-1">Klicken Sie auf "Optimizer starten" um die erste Optimierung zu starten.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Explanation */}
        <Card>
          <CardHeader>
            <CardTitle>Wie funktioniert der Optimizer?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Der Signal Auto-Optimizer backtestet alle {history?.length ? '' : '113'} Watchlist-Titel mit verschiedenen
              Indikator-Gewichtungen und findet die Kombination mit der höchsten Trefferquote.
            </p>
            <p>
              <strong>Methode:</strong> Multi-Pass Optimierung: (1) Lookforward & Threshold optimieren,
              (2) Grid Search über 200 Gewichtungskombinationen, (3) Feinabstimmung der Top-5.
              Anschliessend Walk-Forward Validierung (80/20 Split) zur Overfitting-Erkennung.
            </p>
            <p>
              <strong>Indikatoren:</strong> P/E, PEG, RSI, MACD, Dividendenrendite, 52-Wochen-Range,
              YTD-Performance, Random Forest ML-Signal, News-Sentiment, LPPLS Bubble-Score.
            </p>
            <p>
              <strong>Empfehlung:</strong> Optimierung monatlich durchführen, um die Gewichte an aktuelle
              Marktbedingungen anzupassen.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
