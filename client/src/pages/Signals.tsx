/**
 * Signals — Signale-Tab der Aktien-Sektion (F-14), geroutet unter /aktien/signale.
 * Portfolio-basierte Handelssignale (signals.generate) + Empfehlungs-Historie
 * (signals.getHistory aus signal_history inkl. Benchmark/Alpha).
 */
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import AktienTabsNav from "@/components/AktienTabsNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { TrendingUp, TrendingDown, AlertTriangle, Signal as SignalIcon, History } from "lucide-react";
import { useState } from "react";

type SignalType = "all" | "buy" | "sell" | "hold";
type SignalStrength = "all" | "strong" | "moderate" | "weak";

// Orchestrator-Aktionen (PortfolioAction) → deutsche Labels
const ACTION_LABELS: Record<string, { label: string; className: string }> = {
  buy: { label: "Kaufen", className: "bg-green-500 hover:bg-green-600 text-white" },
  add: { label: "Erhöhen", className: "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30" },
  hold: { label: "Halten", className: "bg-secondary text-secondary-foreground" },
  reduce: { label: "Reduzieren", className: "bg-amber-500/20 text-amber-500 border border-amber-500/30" },
  sell: { label: "Verkaufen", className: "bg-red-500 hover:bg-red-600 text-white" },
  hedge: { label: "Absichern", className: "bg-purple-500/20 text-purple-400 border border-purple-500/30" },
  rebalance: { label: "Umschichten", className: "bg-blue-500/20 text-blue-400 border border-blue-500/30" },
};

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_LABELS[action] ?? ACTION_LABELS.hold;
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
}

// Prozentformat für Dezimalbrüche (0.0123 → «+1.2%»)
function fmtPct(v: number | null | undefined) {
  if (v == null || isNaN(v)) return "–";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
}

export default function Signals() {
  const { user } = useAuth();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [signalTypeFilter, setSignalTypeFilter] = useState<SignalType>("all");
  const [strengthFilter, setStrengthFilter] = useState<SignalStrength>("all");

  const { data: portfolios = [] } = trpc.portfolios.list.useQuery();
  const { data: signals, isLoading } = trpc.signals.generate.useQuery(
    { portfolioId: selectedPortfolioId! },
    { enabled: !!selectedPortfolioId }
  );
  // F-14: Empfehlungs-Historie aus signal_history (global, neueste zuerst)
  const { data: history = [], isLoading: historyLoading } = trpc.signals.getHistory.useQuery();

  if (!user) {
    return null;
  }

  // Portfolio-Gesamtwert (CHF) für den CHF-Hinweis beim Zielgewicht
  const selectedPortfolio = portfolios.find((p: any) => p.id === selectedPortfolioId) as any;
  const portfolioValueCHF: number | null =
    typeof selectedPortfolio?.currentValue === "number" && selectedPortfolio.currentValue > 0
      ? selectedPortfolio.currentValue
      : null;

  const filteredSignals = signals?.filter((signal: any) => {
    const typeMatch = signalTypeFilter === "all" || signal.type === signalTypeFilter;
    const strengthMatch = strengthFilter === "all" || signal.strength === strengthFilter;
    return typeMatch && strengthMatch;
  }) || [];

  const getSignalIcon = (type: string) => {
    switch (type) {
      case "buy": return <TrendingUp className="h-5 w-5 text-green-500" />;
      case "sell": return <TrendingDown className="h-5 w-5 text-red-500" />;
      default: return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getSignalBadge = (type: string) => {
    switch (type) {
      case "buy": return <Badge className="bg-green-500 hover:bg-green-600">KAUFEN</Badge>;
      case "sell": return <Badge className="bg-red-500 hover:bg-red-600">VERKAUFEN</Badge>;
      default: return <Badge variant="secondary">HALTEN</Badge>;
    }
  };

  const getStrengthBadge = (strength: string) => {
    switch (strength) {
      case "strong": return <Badge variant="default">Stark</Badge>;
      case "moderate": return <Badge variant="secondary">Mittel</Badge>;
      default: return <Badge variant="outline">Schwach</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* F-14: Aktien-Sektion mit Tabs «Titel | Signale» */}
        <AktienTabsNav active="signale" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Handelssignale</h1>
            <p className="text-muted-foreground mt-1">
              KI-gestützte Kauf- und Verkaufsempfehlungen basierend auf Kennzahlen und Marktdaten
            </p>
          </div>
        </div>

        {/* Portfolio Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SignalIcon className="h-5 w-5" />
              Portfolio & Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Portfolio auswählen</label>
                <Select value={selectedPortfolioId?.toString()} onValueChange={(v) => setSelectedPortfolioId(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Portfolio wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {portfolios.map((p: any) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Signaltyp</label>
                <Select value={signalTypeFilter} onValueChange={(v) => setSignalTypeFilter(v as SignalType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="buy">Kaufen</SelectItem>
                    <SelectItem value="sell">Verkaufen</SelectItem>
                    <SelectItem value="hold">Halten</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Signalstärke</label>
                <Select value={strengthFilter} onValueChange={(v) => setStrengthFilter(v as SignalStrength)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="strong">Stark</SelectItem>
                    <SelectItem value="moderate">Mittel</SelectItem>
                    <SelectItem value="weak">Schwach</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Signals List */}
        {selectedPortfolioId && (
          <Card>
            <CardHeader>
              <CardTitle>Aktuelle Signale ({filteredSignals.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Generiere Signale...
                </div>
              ) : filteredSignals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Signale gefunden. Passen Sie die Filter an.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSignals.map((signal: any, idx: number) => (
                    <div key={idx} className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {getSignalIcon(signal.type)}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-lg">{signal.ticker}</span>
                              {getSignalBadge(signal.type)}
                              {getStrengthBadge(signal.strength)}
                              {signal.overallGrade && (
                                <Badge variant="outline" className="text-xs font-mono">{signal.overallGrade}</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{signal.companyName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {signal.combinedScore !== undefined && (
                            <div className="mb-1">
                              <p className="text-xs text-muted-foreground">Score (M+Q+LPPL)</p>
                              <p className={`text-lg font-bold font-mono ${
                                signal.combinedScore >= 70 ? 'text-emerald-500' :
                                signal.combinedScore >= 55 ? 'text-[#00CFC1]' :
                                signal.combinedScore >= 45 ? 'text-yellow-500' : 'text-red-500'
                              }`}>{signal.combinedScore}<span className="text-sm text-muted-foreground">/100</span></p>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">Aktueller Kurs</p>
                          <p className="text-base font-bold">{signal.currentPrice?.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">P/E Ratio</p>
                          <p className="font-semibold">{signal.peRatio?.toFixed(1) || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">PEG Ratio</p>
                          <p className="font-semibold">{signal.pegRatio?.toFixed(2) || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Div. Rendite</p>
                          <p className="font-semibold">{signal.dividendYield?.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">YTD Performance</p>
                          <p className={`font-semibold ${signal.ytdPerformance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {signal.ytdPerformance >= 0 ? '+' : ''}{signal.ytdPerformance?.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">RSI (14)</p>
                          <p className={`font-semibold ${signal.rsi14 && signal.rsi14 < 30 ? 'text-green-500' : signal.rsi14 && signal.rsi14 > 70 ? 'text-red-500' : ''}`}>
                            {signal.rsi14?.toFixed(0) || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Zielkurs</p>
                          <p className="font-semibold">{signal.targetPrice?.toFixed(2)} CHF</p>
                        </div>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-1">Begründung:</p>
                        <p className="text-sm text-muted-foreground">{signal.reason}</p>
                      </div>

                      {/* F-14: Orchestrator-Empfehlung (Kaufen/Erhöhen/Halten/Reduzieren/Verkaufen)
                          mit Überzeugung und CHF-Hinweis aus Zielgewicht × Portfoliowert */}
                      {signal.regimeSignal && (
                        <div className="mt-3 p-3 border border-border rounded-lg flex flex-wrap items-center gap-x-4 gap-y-2">
                          <span className="text-sm font-medium">Portfolio-Empfehlung:</span>
                          <ActionBadge action={signal.regimeSignal.action} />
                          <span className="text-sm text-muted-foreground">
                            Überzeugung {Math.round((signal.regimeSignal.conviction ?? 0) * 100)}%
                          </span>
                          {signal.regimeSignal.targetWeight != null && (
                            <span className="text-sm text-muted-foreground">
                              Zielgewicht {(signal.regimeSignal.targetWeight * 100).toFixed(0)}%
                              {portfolioValueCHF != null && (
                                <> ≈ CHF {Math.round(signal.regimeSignal.targetWeight * portfolioValueCHF).toLocaleString("de-CH")}</>
                              )}
                            </span>
                          )}
                        </div>
                      )}

                      {/* ML Badges */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {signal.rfSignal && signal.rfSignal !== 'hold' && (
                          <Badge className={`text-xs ${signal.rfSignal.includes('buy') ? 'bg-green-500/20 text-green-500 border-green-500/30' : 'bg-red-500/20 text-red-500 border-red-500/30'}`}>
                            RF: {signal.rfSignal === 'strong_buy' ? 'Starker Kauf' : signal.rfSignal === 'buy' ? 'Kauf' : signal.rfSignal === 'strong_sell' ? 'Starker Verkauf' : 'Verkauf'} ({signal.rfScore})
                          </Badge>
                        )}
                        {signal.sentimentLabel && signal.sentimentLabel !== 'neutral' && (
                          <Badge className={`text-xs ${signal.sentimentLabel === 'bullish' ? 'bg-green-500/20 text-green-500 border-green-500/30' : 'bg-red-500/20 text-red-500 border-red-500/30'}`}>
                            Sentiment: {signal.sentimentLabel === 'bullish' ? 'Positiv' : 'Negativ'}
                          </Badge>
                        )}
                        {signal.criteria && signal.criteria.map((criterion: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {criterion}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Portfolio-Level Recommendation */}
        {selectedPortfolioId && signals && signals.length > 0 && (
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Portfolio-Empfehlung
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm mb-2">
                  Basierend auf den aktuellen Signalen empfehlen wir:
                </p>
                <p className="text-lg font-semibold">
                  {signals.filter((s: any) => s.type === 'buy').length > signals.filter((s: any) => s.type === 'sell').length
                    ? '📈 Cashquote reduzieren - Kaufgelegenheiten nutzen'
                    : signals.filter((s: any) => s.type === 'sell').length > signals.filter((s: any) => s.type === 'buy').length
                    ? '💰 Cashquote erhöhen - Gewinne sichern'
                    : '⚖️ Aktuelle Allokation beibehalten'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* F-14: Empfehlungs-Historie aus signal_history (täglicher Snapshot,
            Auswertung nach Ablauf der Haltedauer inkl. Benchmark/Alpha) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Empfehlungs-Historie
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Vergangene Signale mit tatsächlicher Rendite seit Empfehlung, Benchmark (SMI) und Alpha.
              Die Auswertung erfolgt automatisch nach Ablauf der Haltedauer.
            </p>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="text-center py-8 text-muted-foreground">Lade Historie...</div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Noch keine ausgewerteten Signale — die Auswertung läuft täglich.
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((h) => {
                  const cfg = ACTION_LABELS[h.action] ?? ACTION_LABELS.hold;
                  const dateStr = h.date ? new Date(h.date as any).toLocaleDateString("de-CH") : "–";
                  return (
                    <div
                      key={h.id}
                      className="p-3 border border-border rounded-lg flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
                    >
                      <span className="text-muted-foreground whitespace-nowrap">Empfehlung vom {dateStr}:</span>
                      <ActionBadge action={h.action} />
                      <span className="font-mono font-semibold">{h.ticker}</span>
                      {h.evaluated ? (
                        <span className="text-muted-foreground">
                          — seither{" "}
                          <span className={`font-semibold ${(h.actualReturnPct ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                            {fmtPct(h.actualReturnPct)}
                          </span>
                          {h.benchmarkReturnPct != null && (
                            <>
                              , Benchmark <span className="font-semibold text-foreground">{fmtPct(h.benchmarkReturnPct)}</span>
                            </>
                          )}
                          {h.alphaPct != null && (
                            <>
                              , Alpha{" "}
                              <span className={`font-semibold ${h.alphaPct >= 0 ? "text-green-500" : "text-red-500"}`}>
                                {fmtPct(h.alphaPct)}
                              </span>
                            </>
                          )}
                          {h.directionCorrect === 1 && <span className="text-green-500 ml-1">✓</span>}
                          {h.directionCorrect === 0 && <span className="text-red-500 ml-1">✗</span>}
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Auswertung ausstehend</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}