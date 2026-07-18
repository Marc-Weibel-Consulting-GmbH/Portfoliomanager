/**
 * PortfolioSignalsTab — Handelssignale für die aktuellen Positionen eines Portfolios
 * (signals.generate). Lebt als Subtab in der Portfolio-Detailseite (nach «Positionen»)
 * und wird auch von der Aktien-Signale-Seite wiederverwendet.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, AlertTriangle, Info } from "lucide-react";
import { InsightTooltip } from "@/components/InsightPanel";
import { Link } from "wouter";

type SignalType = "all" | "buy" | "sell" | "hold";
type SignalStrength = "all" | "strong" | "moderate" | "weak";

const ACTION_LABELS: Record<string, { label: string; className: string }> = {
  buy: { label: "Kaufen", className: "bg-green-500 hover:bg-green-600 text-white" },
  add: { label: "Erhöhen", className: "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30" },
  hold: { label: "Halten", className: "bg-secondary text-secondary-foreground" },
  reduce: { label: "Reduzieren", className: "bg-amber-500/20 text-amber-500 border border-amber-500/30" },
  sell: { label: "Verkaufen", className: "bg-red-500 hover:bg-red-600 text-white" },
  hedge: { label: "Absichern", className: "bg-purple-500/20 text-purple-400 border border-purple-500/30" },
  rebalance: { label: "Umschichten", className: "bg-blue-500/20 text-blue-400 border border-blue-500/30" },
};

export function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_LABELS[action] ?? ACTION_LABELS.hold;
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
}

function getSignalIcon(type: string) {
  switch (type) {
    case "buy": return <TrendingUp className="h-5 w-5 text-green-500" />;
    case "sell": return <TrendingDown className="h-5 w-5 text-red-500" />;
    default: return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  }
}
function getSignalBadge(type: string) {
  switch (type) {
    case "buy": return <Badge className="bg-green-500 hover:bg-green-600">KAUFEN</Badge>;
    case "sell": return <Badge className="bg-red-500 hover:bg-red-600">VERKAUFEN</Badge>;
    default: return <Badge variant="secondary">HALTEN</Badge>;
  }
}
function getStrengthBadge(strength: string) {
  switch (strength) {
    case "strong": return <Badge variant="default">Stark</Badge>;
    case "moderate": return <Badge variant="secondary">Mittel</Badge>;
    default: return <Badge variant="outline">Schwach</Badge>;
  }
}

export function PortfolioSignalsTab({
  portfolioId,
  portfolioValueCHF,
}: {
  portfolioId: number;
  portfolioValueCHF?: number | null;
}) {
  const [signalTypeFilter, setSignalTypeFilter] = useState<SignalType>("all");
  const [strengthFilter, setStrengthFilter] = useState<SignalStrength>("all");

  const { data: signals, isLoading } = trpc.signals.generate.useQuery(
    { portfolioId },
    { enabled: portfolioId > 0 }
  );

  const filteredSignals = (signals ?? []).filter((signal: any) => {
    const typeMatch = signalTypeFilter === "all" || signal.type === signalTypeFilter;
    const strengthMatch = strengthFilter === "all" || signal.strength === strengthFilter;
    return typeMatch && strengthMatch;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Signaltyp</label>
          <Select value={signalTypeFilter} onValueChange={(v) => setSignalTypeFilter(v as SignalType)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="buy">Kaufen</SelectItem>
              <SelectItem value="hold">Halten</SelectItem>
              <SelectItem value="sell">Verkaufen</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Signalstärke</label>
          <Select value={strengthFilter} onValueChange={(v) => setStrengthFilter(v as SignalStrength)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="strong">Stark</SelectItem>
              <SelectItem value="moderate">Mittel</SelectItem>
              <SelectItem value="weak">Schwach</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aktuelle Signale ({filteredSignals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Generiere Signale…</div>
          ) : filteredSignals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Keine Signale gefunden. Passen Sie die Filter an.</div>
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
                          {/* overallGrade nur anzeigen wenn combinedScore vorhanden und erklärt */}
                          {signal.overallGrade && signal.combinedScore !== undefined && (
                            <span
                              className="text-xs font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5"
                              title={`Score-Grade: A (≥75), B (≥60), C (≥45), D (≥30), F (<30). Basiert auf Momentum + Qualität + LPPL-Risiko.`}
                            >
                              {signal.overallGrade}
                            </span>
                          )}
                          <Link href={`/aktien/${signal.ticker}`}>
                            <button
                              title={`Detailseite von ${signal.ticker} öffnen`}
                              className="ml-1 p-1 rounded hover:bg-muted text-muted-foreground hover:text-[#00CFC1] transition-colors"
                            >
                              <Info className="h-4 w-4" />
                            </button>
                          </Link>
                        </div>
                        <p className="text-sm text-muted-foreground">{signal.companyName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {signal.combinedScore !== undefined && (
                        <InsightTooltip
                          title="Wie wird der Score berechnet?"
                          summary={`Der kombinierte Score von ${signal.combinedScore}/100 setzt sich aus drei Modellen zusammen: Momentum (technische Analyse), Qualität (Fundamentaldaten) und LPPL-Risikomodell (Blasenerkennung).`}
                          factors={[
                            { label: 'Momentum', value: signal.rfScore ? `${signal.rfScore}/100` : '—', sentiment: signal.rfSignal === 'buy' || signal.rfSignal === 'strong_buy' ? 'positive' : signal.rfSignal === 'sell' || signal.rfSignal === 'strong_sell' ? 'negative' : 'neutral', description: 'Technische Analyse: RSI, Kursmomentum, Algorithmus-Signal' },
                            { label: 'Bewertung', value: signal.peRatio ? `KGV ${signal.peRatio.toFixed(1)}` : '—', sentiment: signal.peRatio && signal.peRatio < 20 ? 'positive' : signal.peRatio && signal.peRatio > 35 ? 'negative' : 'neutral', description: 'Fundamentale Bewertung: KGV, PEG-Ratio, Dividendenrendite' },
                            { label: 'Sentiment', value: signal.sentimentLabel ?? '—', sentiment: signal.sentimentLabel === 'bullish' ? 'positive' : signal.sentimentLabel === 'bearish' ? 'negative' : 'neutral', description: 'Marktstimmung aus Nachrichten und Analystenmeinungen' },
                            { label: 'Score-Note', value: signal.overallGrade ?? '—', sentiment: signal.overallGrade === 'A' ? 'positive' : signal.overallGrade === 'F' || signal.overallGrade === 'D' ? 'negative' : 'neutral', description: 'A (≥75), B (≥60), C (≥45), D (≥30), F (<30)' },
                          ]}
                          variant={signal.combinedScore >= 65 ? 'success' : signal.combinedScore >= 45 ? 'default' : 'warning'}
                        >
                          <div className="mb-1 cursor-help">
                            <p className="text-xs text-muted-foreground">Score (M+Q+LPPL) ℹ️</p>
                            <p className={`text-lg font-bold font-mono ${
                              signal.combinedScore >= 70 ? "text-emerald-500" :
                              signal.combinedScore >= 55 ? "text-[#00CFC1]" :
                              signal.combinedScore >= 45 ? "text-yellow-500" : "text-red-500"
                            }`}>{signal.combinedScore}<span className="text-sm text-muted-foreground">/100</span></p>
                          </div>
                        </InsightTooltip>
                      )}
                      <p className="text-xs text-muted-foreground">Aktueller Kurs</p>
                      <p className="text-base font-bold">{signal.currentPrice?.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-3 text-sm">
                    <div><p className="text-muted-foreground">P/E Ratio</p><p className="font-semibold">{signal.peRatio?.toFixed(1) || "N/A"}</p></div>
                    <div><p className="text-muted-foreground">PEG Ratio</p><p className="font-semibold">{signal.pegRatio?.toFixed(2) || "N/A"}</p></div>
                    <div><p className="text-muted-foreground">Div. Rendite</p><p className="font-semibold">{signal.dividendYield?.toFixed(2)}%</p></div>
                    <div>
                      <p className="text-muted-foreground">YTD Performance</p>
                      <p className={`font-semibold ${signal.ytdPerformance >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {signal.ytdPerformance >= 0 ? "+" : ""}{signal.ytdPerformance?.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">RSI (14)</p>
                      <p className={`font-semibold ${signal.rsi14 && signal.rsi14 < 30 ? "text-green-500" : signal.rsi14 && signal.rsi14 > 70 ? "text-red-500" : ""}`}>
                        {signal.rsi14?.toFixed(0) || "N/A"}
                      </p>
                    </div>
                    <div><p className="text-muted-foreground">Zielkurs</p><p className="font-semibold">{signal.targetPrice?.toFixed(2)} CHF</p></div>
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-1">Begründung:</p>
                    <p className="text-sm text-muted-foreground">{signal.reason}</p>
                  </div>

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

                  {/* Indikatoren-Bereich: alle als Erklärung, kein Widerspruch zum Signal-Typ */}
                  <div className="mt-3">
                    {/* Kriterien aus P/E-Score */}
                    {signal.criteria && signal.criteria.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {signal.criteria.map((criterion: string, i: number) => (
                          <InsightTooltip
                            key={i}
                            title={criterion}
                            summary={`Dieses Kriterium wurde bei der Signalgenerierung für ${signal.ticker} als relevant identifiziert und trägt zum Gesamtsignal bei.`}
                            variant="info"
                          >
                            <Badge variant="outline" className="text-xs text-muted-foreground cursor-help">{criterion}</Badge>
                          </InsightTooltip>
                        ))}
                      </div>
                    )}
                    {/* Modell-Inputs: nur anzeigen wenn RF mit finalem Signal übereinstimmt */}
                    {(() => {
                      const finalIsBuy = signal.type === 'buy';
                      const finalIsSell = signal.type === 'sell';
                      const rfIsBuy = signal.rfSignal === 'buy' || signal.rfSignal === 'strong_buy';
                      const rfIsSell = signal.rfSignal === 'sell' || signal.rfSignal === 'strong_sell';
                      const rfAgrees = signal.rfSignal && ((finalIsBuy && rfIsBuy) || (finalIsSell && rfIsSell));
                      const showSentiment = signal.sentimentLabel && signal.sentimentLabel !== 'neutral';
                      if (!rfAgrees && !showSentiment) return null;
                      return (
                        <div className="text-[11px] text-muted-foreground border-t border-border pt-2 mt-1">
                          <span className="font-medium text-foreground/60">Bestätigende Indikatoren: </span>
                          {rfAgrees && (
                            <span className="mr-3">
                              Algorithmus: <span className={rfIsBuy ? 'text-emerald-500' : 'text-red-400'}>
                                {rfIsBuy ? 'Kauf' : 'Verkauf'}
                              </span> (Score: {signal.rfScore ?? '—'})
                            </span>
                          )}
                          {showSentiment && (
                            <span>
                              Sentiment: <span className={signal.sentimentLabel === 'bullish' ? 'text-emerald-500' : 'text-red-400'}>
                                {signal.sentimentLabel === 'bullish' ? 'Positiv' : 'Negativ'}
                              </span>
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {signals && signals.length > 0 && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Portfolio-Empfehlung
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm mb-2">Basierend auf den aktuellen Signalen empfehlen wir:</p>
              <p className="text-lg font-semibold">
                {signals.filter((s: any) => s.type === "buy").length > signals.filter((s: any) => s.type === "sell").length
                  ? "📈 Cashquote reduzieren – Kaufgelegenheiten nutzen"
                  : signals.filter((s: any) => s.type === "sell").length > signals.filter((s: any) => s.type === "buy").length
                  ? "💰 Cashquote erhöhen – Gewinne sichern"
                  : "⚖️ Aktuelle Allokation beibehalten"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
