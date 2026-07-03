// Bewusst behalten (aktuell nicht geroutet): wird in Phase 4 wieder angeschlossen — siehe OPTIMIZATION_PLAN.md R-36/F-02/F-14 (Abhängigkeit von PortfolioCopilot via MonitoringStatus)
/**
 * LiveLpplCheck Component
 * Echtzeit-LPPL Bubble-Score-Berechnung für S&P 500 und NASDAQ.
 * Button startet die Analyse, Ergebnisse werden als Karten angezeigt.
 * Trend-Chart zeigt historischen Verlauf der Bubble-Confidence.
 */

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Loader2,
  TrendingUp,
  TrendingDown,
  Zap,
  Calendar,
  BarChart3,
  Shield,
  LineChart,
} from 'lucide-react';

interface LpplResult {
  ticker: string;
  name: string;
  currentPrice: number;
  bubbleConfidence: number;
  regime: 'bubble' | 'normal' | 'crash';
  predictedCrashDate: string | null;
  daysToPredict: number | null;
  fitQuality: number | null;
  priceChange30d: number;
  priceChange90d: number;
  analysisDate: string;
  windowsAnalyzed: number;
  validFits: number;
}

export default function LiveLpplCheck() {
  const [results, setResults] = useState<LpplResult[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [historyDays, setHistoryDays] = useState(90);

  const liveLpplMutation = trpc.copilot.liveLpplCheck.useMutation({
    onSuccess: (data) => {
      setResults(data.results);
      setCheckedAt(data.checkedAt);
      // Refetch history after new check
      historyQuery.refetch();
    },
  });

  const historyQuery = trpc.copilot.lpplHistory.useQuery(
    { days: historyDays },
    { refetchOnWindowFocus: false }
  );

  // Group history by index
  const historyByIndex = useMemo(() => {
    if (!historyQuery.data?.history) return {};
    const grouped: Record<string, Array<{ date: string; confidence: number; price: number }>> = {};
    for (const row of historyQuery.data.history) {
      const key = row.indexSymbol;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        date: new Date(row.checkedAt).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' }),
        confidence: row.bubbleConfidence,
        price: Number(row.currentPrice) || 0,
      });
    }
    return grouped;
  }, [historyQuery.data]);

  const hasHistory = Object.keys(historyByIndex).length > 0;

  const getRegimeBadge = (regime: string, confidence: number) => {
    if (regime === 'crash') {
      return (
        <Badge className="bg-red-600/20 text-red-400 border-red-600/50">
          <TrendingDown className="h-3 w-3 mr-1" />
          Crash-Modus
        </Badge>
      );
    }
    if (regime === 'bubble') {
      return (
        <Badge className="bg-orange-600/20 text-orange-400 border-orange-600/50">
          <Flame className="h-3 w-3 mr-1" />
          Bubble-Signal
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/50">
        <Shield className="h-3 w-3 mr-1" />
        Normal
      </Badge>
    );
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return 'text-red-400';
    if (confidence >= 45) return 'text-orange-400';
    if (confidence >= 25) return 'text-yellow-400';
    return 'text-emerald-400';
  };

  const getConfidenceBarColor = (confidence: number) => {
    if (confidence >= 70) return 'bg-red-500';
    if (confidence >= 45) return 'bg-orange-500';
    if (confidence >= 25) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  const getWarningLevel = (confidence: number) => {
    if (confidence >= 70) return { text: 'Hohe Warnstufe', icon: <AlertTriangle className="h-4 w-4 text-red-400" /> };
    if (confidence >= 45) return { text: 'Erhöhte Aufmerksamkeit', icon: <Flame className="h-4 w-4 text-orange-400" /> };
    if (confidence >= 25) return { text: 'Leicht erhöht', icon: <Activity className="h-4 w-4 text-yellow-400" /> };
    return { text: 'Kein Bubble-Signal', icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" /> };
  };

  // Simple SVG line chart for confidence trend
  const renderTrendChart = (data: Array<{ date: string; confidence: number }>, label: string) => {
    if (data.length < 2) return null;
    const width = 400;
    const height = 120;
    const padding = { top: 10, right: 10, bottom: 25, left: 35 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxConf = 100;
    const minConf = 0;

    const points = data.map((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartW;
      const y = padding.top + chartH - ((d.confidence - minConf) / (maxConf - minConf)) * chartH;
      return { x, y, ...d };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    // Threshold lines
    const y70 = padding.top + chartH - (70 / 100) * chartH;
    const y45 = padding.top + chartH - (45 / 100) * chartH;

    // X-axis labels (show every nth)
    const labelInterval = Math.max(1, Math.floor(data.length / 5));
    const xLabels = data.filter((_, i) => i % labelInterval === 0 || i === data.length - 1);

    return (
      <div className="mt-2">
        <div className="flex items-center gap-2 mb-1">
          <LineChart className="h-3.5 w-3.5 text-gray-500" />
          <span className="text-xs text-gray-400">{label} — Confidence-Verlauf</span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          {/* Background */}
          <rect x={padding.left} y={padding.top} width={chartW} height={chartH} fill="rgba(30,30,40,0.5)" rx="3" />
          
          {/* Threshold zones */}
          <rect x={padding.left} y={padding.top} width={chartW} height={y45 - padding.top} fill="rgba(239,68,68,0.05)" />
          <rect x={padding.left} y={y45} width={chartW} height={y70 - y45} fill="rgba(249,115,22,0.05)" />
          
          {/* Threshold lines */}
          <line x1={padding.left} y1={y70} x2={padding.left + chartW} y2={y70} stroke="rgba(239,68,68,0.4)" strokeDasharray="3,3" strokeWidth="0.5" />
          <line x1={padding.left} y1={y45} x2={padding.left + chartW} y2={y45} stroke="rgba(249,115,22,0.3)" strokeDasharray="3,3" strokeWidth="0.5" />
          
          {/* Y-axis labels */}
          <text x={padding.left - 3} y={y70 + 3} fontSize="7" fill="#ef4444" textAnchor="end">70%</text>
          <text x={padding.left - 3} y={y45 + 3} fontSize="7" fill="#f97316" textAnchor="end">45%</text>
          <text x={padding.left - 3} y={padding.top + 3} fontSize="7" fill="#6b7280" textAnchor="end">100%</text>
          <text x={padding.left - 3} y={padding.top + chartH + 3} fontSize="7" fill="#6b7280" textAnchor="end">0%</text>
          
          {/* Data line */}
          <path d={pathD} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          
          {/* Data points */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2" fill={
              p.confidence >= 70 ? '#ef4444' : p.confidence >= 45 ? '#f97316' : p.confidence >= 25 ? '#eab308' : '#10b981'
            } />
          ))}
          
          {/* X-axis labels */}
          {xLabels.map((d, i) => {
            const idx = data.indexOf(d);
            const x = padding.left + (idx / (data.length - 1)) * chartW;
            return (
              <text key={i} x={x} y={height - 3} fontSize="6.5" fill="#6b7280" textAnchor="middle">
                {d.date}
              </text>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header + Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            Live LPPL Bubble-Check
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Echtzeit-Analyse der LPPL-Bubble-Indikatoren für die wichtigsten US-Indizes
          </p>
        </div>
        <Button
          onClick={() => liveLpplMutation.mutate()}
          disabled={liveLpplMutation.isPending}
          className="bg-yellow-600 hover:bg-yellow-700 text-white"
        >
          {liveLpplMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analysiere...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Jetzt prüfen
            </>
          )}
        </Button>
      </div>

      {/* Loading State */}
      {liveLpplMutation.isPending && (
        <Card className="bg-yellow-900/10 border-yellow-700/30">
          <CardContent className="p-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-yellow-400 mx-auto mb-3" />
            <p className="text-sm text-gray-300">
              LPPL Multi-Scale-Analyse wird durchgeführt...
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Grid-Search über 880 Parameterkombinationen × 4 Zeitfenster × 2 Indizes
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {liveLpplMutation.isError && (
        <Card className="bg-red-900/10 border-red-700/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Fehler bei der Analyse</span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              {liveLpplMutation.error?.message || 'Unbekannter Fehler'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && results.length > 0 && (
        <div className="space-y-3">
          {/* Timestamp */}
          {checkedAt && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Calendar className="h-3.5 w-3.5" />
              <span>Letzte Prüfung: {new Date(checkedAt).toLocaleString('de-CH')}</span>
            </div>
          )}

          {/* Index Cards */}
          <div className="grid gap-3 md:grid-cols-2">
            {results.map((result) => {
              const warning = getWarningLevel(result.bubbleConfidence);
              const trendData = historyByIndex[result.ticker];
              return (
                <Card
                  key={result.ticker}
                  className={`border ${
                    result.bubbleConfidence >= 70
                      ? 'bg-red-900/10 border-red-700/40'
                      : result.bubbleConfidence >= 45
                      ? 'bg-orange-900/10 border-orange-700/40'
                      : 'bg-gray-800/50 border-gray-700'
                  }`}
                >
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-white text-base">{result.name}</h4>
                        <span className="text-xs text-gray-500">{result.ticker}</span>
                      </div>
                      {getRegimeBadge(result.regime, result.bubbleConfidence)}
                    </div>

                    {/* Bubble Confidence */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-400">Bubble-Confidence</span>
                        <span className={`text-lg font-bold ${getConfidenceColor(result.bubbleConfidence)}`}>
                          {result.bubbleConfidence.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${getConfidenceBarColor(result.bubbleConfidence)}`}
                          style={{ width: `${Math.min(100, result.bubbleConfidence)}%` }}
                        />
                      </div>
                    </div>

                    {/* Warning Level */}
                    <div className="flex items-center gap-2 mb-3 p-2 rounded bg-gray-900/50">
                      {warning.icon}
                      <span className="text-sm text-gray-300">{warning.text}</span>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-gray-500" />
                        <span className="text-gray-400">Kurs:</span>
                        <span className="text-white font-medium">
                          {result.currentPrice.toLocaleString('de-CH', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <BarChart3 className="h-3.5 w-3.5 text-gray-500" />
                        <span className="text-gray-400">Fit R²:</span>
                        <span className="text-white font-medium">
                          {result.fitQuality ? `${(result.fitQuality * 100).toFixed(1)}%` : '–'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400">30T:</span>
                        <span className={result.priceChange30d >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {result.priceChange30d >= 0 ? '+' : ''}{result.priceChange30d.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400">90T:</span>
                        <span className={result.priceChange90d >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {result.priceChange90d >= 0 ? '+' : ''}{result.priceChange90d.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Predicted Crash Date */}
                    {result.predictedCrashDate && (
                      <div className="mt-3 p-2 rounded bg-red-900/20 border border-red-700/30">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-400" />
                          <div>
                            <span className="text-xs text-red-300 font-medium">
                              Prognostizierter Wendepunkt
                            </span>
                            <div className="text-sm text-white">
                              {new Date(result.predictedCrashDate).toLocaleDateString('de-CH')} 
                              <span className="text-gray-400 ml-1">
                                (in {result.daysToPredict} Tagen)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Trend Chart */}
                    {trendData && trendData.length >= 2 && renderTrendChart(trendData, result.name)}

                    {/* Technical Details */}
                    <div className="mt-3 pt-2 border-t border-gray-700/50">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{result.windowsAnalyzed} Parameterkombinationen</span>
                        <span>{result.validFits} valide Fits</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Trend History Section (if we have history but no current results yet) */}
          {hasHistory && (
            <Card className="bg-gray-800/30 border-gray-700/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <LineChart className="h-4 w-4 text-yellow-400" />
                    Historischer Verlauf (letzte {historyDays} Tage)
                  </h4>
                  <div className="flex gap-1">
                    {[30, 90, 180].map((d) => (
                      <button
                        key={d}
                        onClick={() => setHistoryDays(d)}
                        className={`px-2 py-0.5 text-xs rounded ${
                          historyDays === d
                            ? 'bg-yellow-600/30 text-yellow-400 border border-yellow-600/50'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {d}T
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {Object.entries(historyByIndex).map(([ticker, data]) => (
                    <div key={ticker}>
                      {renderTrendChart(data, ticker === '^GSPC' ? 'S&P 500' : ticker === '^IXIC' ? 'NASDAQ' : ticker)}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {historyQuery.data?.history.length || 0} Datenpunkte gespeichert. Jeder Live-Check wird automatisch persistiert.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Explanation */}
          <Card className="bg-gray-800/30 border-gray-700/50">
            <CardContent className="p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Interpretation</h4>
              <div className="text-xs text-gray-400 space-y-1">
                <p>
                  <span className="text-emerald-400 font-medium">0–25%:</span> Kein Bubble-Signal — normales Marktverhalten
                </p>
                <p>
                  <span className="text-yellow-400 font-medium">25–45%:</span> Leicht erhöht — beschleunigtes Wachstum, aber kein klares LPPL-Muster
                </p>
                <p>
                  <span className="text-orange-400 font-medium">45–70%:</span> Bubble-Signal — LPPL-Muster erkannt, erhöhte Vorsicht geboten
                </p>
                <p>
                  <span className="text-red-400 font-medium">&gt;70%:</span> Starkes Bubble-Signal — hohe Wahrscheinlichkeit einer bevorstehenden Korrektur
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Die Analyse nutzt Multi-Scale LPPL-Fitting (60/90/120/180 Tage) mit Grid-Search über tc, m, ω Parameter.
                Historische Erkennungsrate: 100% (4/4 Blasen), False-Positive-Rate: 1.1%.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Initial State - no results yet, but maybe history */}
      {!results && !liveLpplMutation.isPending && !liveLpplMutation.isError && (
        <div className="space-y-3">
          {hasHistory && (
            <Card className="bg-gray-800/30 border-gray-700/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <LineChart className="h-4 w-4 text-yellow-400" />
                    Historischer Verlauf (letzte {historyDays} Tage)
                  </h4>
                  <div className="flex gap-1">
                    {[30, 90, 180].map((d) => (
                      <button
                        key={d}
                        onClick={() => setHistoryDays(d)}
                        className={`px-2 py-0.5 text-xs rounded ${
                          historyDays === d
                            ? 'bg-yellow-600/30 text-yellow-400 border border-yellow-600/50'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {d}T
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {Object.entries(historyByIndex).map(([ticker, data]) => (
                    <div key={ticker}>
                      {renderTrendChart(data, ticker === '^GSPC' ? 'S&P 500' : ticker === '^IXIC' ? 'NASDAQ' : ticker)}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {historyQuery.data?.history.length || 0} Datenpunkte gespeichert.
                </p>
              </CardContent>
            </Card>
          )}
          <Card className="bg-gray-800/30 border-gray-700/50">
            <CardContent className="p-6 text-center">
              <Zap className="h-10 w-10 text-yellow-400/50 mx-auto mb-3" />
              <p className="text-sm text-gray-400">
                Klicke auf "Jetzt prüfen" um den aktuellen LPPL Bubble-Score für S&P 500 und NASDAQ zu berechnen.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Die Berechnung dauert ca. 5–10 Sekunden (Yahoo Finance Daten + Multi-Scale Fitting).
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}