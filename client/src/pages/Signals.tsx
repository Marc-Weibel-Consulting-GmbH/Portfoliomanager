import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { TrendingUp, TrendingDown, AlertTriangle, Signal as SignalIcon, Filter } from "lucide-react";
import { useState } from "react";

type SignalType = "all" | "buy" | "sell" | "hold";
type SignalStrength = "all" | "strong" | "moderate" | "weak";

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

  if (!user) {
    return null;
  }

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
                            </div>
                            <p className="text-sm text-muted-foreground">{signal.companyName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Aktueller Kurs</p>
                          <p className="text-lg font-bold">{signal.currentPrice?.toFixed(2)} CHF</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">P/E Ratio</p>
                          <p className="font-semibold">{signal.peRatio?.toFixed(1) || 'N/A'}</p>
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
                          <p className="text-muted-foreground">Zielkurs</p>
                          <p className="font-semibold">{signal.targetPrice?.toFixed(2)} CHF</p>
                        </div>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-1">Begründung:</p>
                        <p className="text-sm text-muted-foreground">{signal.reason}</p>
                      </div>

                      {signal.criteria && signal.criteria.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {signal.criteria.map((criterion: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {criterion}
                            </Badge>
                          ))}
                        </div>
                      )}
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
      </div>
    </DashboardLayout>
  );
}
