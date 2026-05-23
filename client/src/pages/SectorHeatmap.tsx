import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity, TrendingUp, TrendingDown } from "lucide-react";

interface HeatmapStock {
  ticker: string;
  companyName: string;
  sector: string;
  category: string;
  currentPrice: number | null;
  peRatio: number | null;
  dividendYield: number | null;
  signalScore: number | null;
  signalType: string | null;
  marketCap: string | null;
}

function getColorForScore(score: number | null): string {
  if (score === null) return "bg-muted";
  if (score >= 80) return "bg-green-600";
  if (score >= 70) return "bg-green-500";
  if (score >= 60) return "bg-green-400/80";
  if (score >= 50) return "bg-yellow-400/70";
  if (score >= 40) return "bg-orange-400/80";
  if (score >= 30) return "bg-red-400/80";
  return "bg-red-600";
}

function getTextColorForScore(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 60) return "text-white";
  if (score >= 40) return "text-gray-900";
  return "text-white";
}

function getSizeClass(marketCap: string | null): string {
  if (!marketCap) return "w-16 h-16";
  const cap = parseFloat(marketCap);
  if (cap > 500e9) return "w-24 h-20";
  if (cap > 100e9) return "w-20 h-18";
  if (cap > 50e9) return "w-18 h-16";
  if (cap > 10e9) return "w-16 h-14";
  return "w-14 h-12";
}

export default function SectorHeatmap() {
  const { user } = useAuth();
  const [sortBy, setSortBy] = useState<"score" | "pe" | "dividend">("score");

  const watchlistQuery = trpc.watchlist.list.useQuery({ source: "all", sortBy: "signalScore", sortOrder: "desc" });

  const stocks: HeatmapStock[] = useMemo(() => {
    if (!watchlistQuery.data?.stocks) return [];
    return watchlistQuery.data.stocks.map((s: any) => ({
      ticker: s.ticker,
      companyName: s.companyName,
      sector: s.sector || "Sonstige",
      category: s.category || "Sonstige",
      currentPrice: s.currentPrice ? parseFloat(s.currentPrice) : null,
      peRatio: s.peRatio ? parseFloat(s.peRatio) : null,
      dividendYield: s.dividendYield ? parseFloat(s.dividendYield) : null,
      signalScore: s.signalScore,
      signalType: s.signalType,
      marketCap: s.marketCap,
    }));
  }, [watchlistQuery.data]);

  // Group by sector
  const sectorGroups = useMemo(() => {
    const groups: Record<string, HeatmapStock[]> = {};
    for (const stock of stocks) {
      if (!groups[stock.sector]) groups[stock.sector] = [];
      groups[stock.sector].push(stock);
    }

    // Sort stocks within each sector
    for (const sector of Object.keys(groups)) {
      groups[sector].sort((a, b) => {
        if (sortBy === "score") return (b.signalScore || 0) - (a.signalScore || 0);
        if (sortBy === "pe") return (a.peRatio || 999) - (b.peRatio || 999);
        if (sortBy === "dividend") return (b.dividendYield || 0) - (a.dividendYield || 0);
        return 0;
      });
    }

    // Sort sectors by average score
    const sortedSectors = Object.entries(groups).sort((a, b) => {
      const avgA = a[1].reduce((sum, s) => sum + (s.signalScore || 50), 0) / a[1].length;
      const avgB = b[1].reduce((sum, s) => sum + (s.signalScore || 50), 0) / b[1].length;
      return avgB - avgA;
    });

    return sortedSectors;
  }, [stocks, sortBy]);

  // Summary stats
  const stats = useMemo(() => {
    const withScore = stocks.filter(s => s.signalScore !== null);
    const avgScore = withScore.length > 0 ? withScore.reduce((sum, s) => sum + (s.signalScore || 0), 0) / withScore.length : 0;
    const buySignals = stocks.filter(s => s.signalType === "buy" || (s.signalScore && s.signalScore >= 70)).length;
    const sellSignals = stocks.filter(s => s.signalType === "sell" || (s.signalScore && s.signalScore <= 30)).length;
    return { total: stocks.length, avgScore, buySignals, sellSignals };
  }, [stocks]);

  if (watchlistQuery.isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Activity className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sektor-Heatmap</h1>
          <p className="text-muted-foreground mt-1">Visuelle Übersicht aller Watchlist-Titel nach Sektor und Performance</p>
        </div>
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Signal-Score</SelectItem>
            <SelectItem value="pe">P/E Ratio</SelectItem>
            <SelectItem value="dividend">Dividendenrendite</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Titel im Universum</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{stats.avgScore.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Ø Signal-Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-green-500">{stats.buySignals}</p>
            <p className="text-xs text-muted-foreground">Kaufsignale</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-red-500">{stats.sellSignals}</p>
            <p className="text-xs text-muted-foreground">Verkaufssignale</p>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Score:</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-red-600"></div>
          <span>&lt;30</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-orange-400/80"></div>
          <span>30-50</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-yellow-400/70"></div>
          <span>50-60</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-green-400/80"></div>
          <span>60-70</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-green-500"></div>
          <span>70-80</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-green-600"></div>
          <span>&gt;80</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="space-y-6">
        {sectorGroups.map(([sector, sectorStocks]) => {
          const avgScore = sectorStocks.reduce((sum, s) => sum + (s.signalScore || 50), 0) / sectorStocks.length;
          return (
            <Card key={sector}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">{sector}</CardTitle>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{sectorStocks.length} Titel</span>
                    <Badge variant={avgScore >= 60 ? "default" : avgScore >= 40 ? "secondary" : "destructive"} className="text-xs">
                      Ø {avgScore.toFixed(0)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {sectorStocks.map((stock) => {
                    const colorClass = getColorForScore(stock.signalScore);
                    const textClass = getTextColorForScore(stock.signalScore);
                    return (
                      <Tooltip key={stock.ticker}>
                        <TooltipTrigger asChild>
                          <a
                            href={`/invest/${stock.ticker.replace('.US', '').replace('.SW', '')}`}
                            className={`${colorClass} ${textClass} rounded-md p-2 flex flex-col items-center justify-center min-w-[70px] min-h-[56px] cursor-pointer hover:opacity-80 transition-opacity border border-white/10`}
                          >
                            <span className="text-xs font-bold leading-tight">{stock.ticker.replace('.US', '').replace('.SW', '')}</span>
                            <span className="text-[10px] leading-tight opacity-80">
                              {stock.signalScore !== null ? stock.signalScore : "–"}
                            </span>
                          </a>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[250px]">
                          <div className="space-y-1">
                            <p className="font-semibold">{stock.companyName}</p>
                            <p className="text-xs">{stock.ticker}</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
                              <span className="text-muted-foreground">Score:</span>
                              <span className="font-medium">{stock.signalScore ?? "–"}</span>
                              <span className="text-muted-foreground">P/E:</span>
                              <span>{stock.peRatio?.toFixed(1) ?? "–"}</span>
                              <span className="text-muted-foreground">Dividende:</span>
                              <span>{stock.dividendYield?.toFixed(2) ?? "–"}%</span>
                              <span className="text-muted-foreground">Signal:</span>
                              <span className={stock.signalType === "buy" ? "text-green-500" : stock.signalType === "sell" ? "text-red-500" : ""}>
                                {stock.signalType === "buy" ? "Kaufen" : stock.signalType === "sell" ? "Verkaufen" : "Halten"}
                              </span>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {stocks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Keine Titel in der Watchlist. Füge Titel über Admin → Watchlist hinzu oder generiere KI-Empfehlungen.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
