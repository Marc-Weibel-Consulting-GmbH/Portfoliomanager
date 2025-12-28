import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StockLogo } from "@/components/StockLogo";
import { PieChart, TrendingUp, Shield, Target } from "lucide-react";
import { PortfolioBuilderState } from "../PortfolioBuilderNew";

interface Step4AllocationProps {
  state: PortfolioBuilderState;
}

export default function Step4Allocation({ state }: Step4AllocationProps) {
  // Calculate sector allocation
  const sectorAllocation = useMemo(() => {
    const sectors: Record<string, number> = {};
    state.positions.forEach(pos => {
      if (pos.sector) {
        sectors[pos.sector] = (sectors[pos.sector] || 0) + pos.weight;
      }
    });
    return Object.entries(sectors)
      .map(([sector, weight]) => ({ sector, weight }))
      .sort((a, b) => b.weight - a.weight);
  }, [state.positions]);

  // Calculate portfolio metrics
  const metrics = useMemo(() => {
    const avgYTD = state.positions.reduce((sum, p) => sum + (p.ytdPerformance || 0) * (p.weight / 100), 0);
    const avgDivYield = state.positions.reduce((sum, p) => sum + (p.dividendYield || 0) * (p.weight / 100), 0);
    const numStocks = state.positions.length;
    const numSectors = new Set(state.positions.map(p => p.sector).filter(Boolean)).size;
    
    return {
      expectedReturn: avgYTD,
      avgDividendYield: avgDivYield,
      diversificationScore: Math.min(100, (numStocks * 5 + numSectors * 10)),
      numStocks,
      numSectors,
    };
  }, [state.positions]);

  // Calculate risk level based on strategy
  const riskLevel = state.strategy === 'growth' ? 'Hoch' : state.strategy === 'dividends' ? 'Niedrig' : 'Mittel';
  const riskColor = state.strategy === 'growth' ? 'text-amber-400' : state.strategy === 'dividends' ? 'text-green-400' : 'text-blue-400';

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <Card className="bg-[#0f1420]/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <PieChart className="h-5 w-5 text-[#00CFC1]" />
            Portfolio-Übersicht
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0a0f1a] border border-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span className="text-sm text-gray-400">Erwartete Rendite</span>
              </div>
              <p className="text-2xl font-bold text-white">{Number(metrics.expectedReturn || 0).toFixed(1)}%</p>
              <p className="text-xs text-gray-500 mt-1">Basierend auf YTD Performance</p>
            </div>

            <div className="bg-[#0a0f1a] border border-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-gray-400">Risiko-Level</span>
              </div>
              <p className={`text-2xl font-bold ${riskColor}`}>{riskLevel}</p>
              <p className="text-xs text-gray-500 mt-1">Basierend auf Strategie</p>
            </div>

            <div className="bg-[#0a0f1a] border border-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-gray-400">Diversifikation</span>
              </div>
              <p className="text-2xl font-bold text-white">{metrics.diversificationScore}/100</p>
              <p className="text-xs text-gray-500 mt-1">{metrics.numStocks} Aktien, {metrics.numSectors} Sektoren</p>
            </div>
          </div>

          {/* Additional Metrics */}
          {metrics.avgDividendYield > 0 && (
            <div className="bg-[#00CFC1]/10 border border-[#00CFC1]/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Durchschnittliche Dividendenrendite</span>
                <span className="text-lg font-bold text-[#00CFC1]">{Number(metrics.avgDividendYield || 0).toFixed(2)}%</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Position Details */}
      <Card className="bg-[#0f1420]/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Positionen ({state.positions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {state.positions
              .sort((a, b) => b.weight - a.weight)
              .map((position) => (
                <div
                  key={position.ticker}
                  className="bg-[#0a0f1a] border border-white/10 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <StockLogo ticker={position.ticker} companyName={position.companyName} size="sm" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">{position.ticker}</p>
                        {position.sector && (
                          <Badge variant="secondary" className="text-xs">
                            {position.sector}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">{position.companyName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {position.ytdPerformance !== undefined && (
                      <div className="text-right">
                        <p className="text-xs text-gray-400">YTD</p>
                        <p className={`text-sm font-medium ${Number(position.ytdPerformance || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {Number(position.ytdPerformance || 0) >= 0 ? "+" : ""}{Number(position.ytdPerformance || 0).toFixed(1)}%
                        </p>
                      </div>
                    )}
                    {position.dividendYield && position.dividendYield > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Div. Rendite</p>
                        <p className="text-sm font-medium text-blue-400">{Number(position.dividendYield || 0).toFixed(2)}%</p>
                      </div>
                    )}
                    <div className="text-right min-w-[80px]">
                      <p className="text-xs text-gray-400">Gewichtung</p>
                      <p className="text-lg font-bold text-[#00CFC1]">{Number(position.weight || 0).toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Sector Allocation */}
      {sectorAllocation.length > 0 && (
        <Card className="bg-[#0f1420]/50 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Sektor-Verteilung</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sectorAllocation.map(({ sector, weight }) => (
                <div key={sector} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{sector}</span>
                    <span className="text-white font-medium">{Number(weight || 0).toFixed(1)}%</span>
                  </div>
                  <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full bg-[#00CFC1] transition-all"
                      style={{ width: `${weight}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <Card className="bg-[#00CFC1]/10 border-[#00CFC1]/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-2"></div>
            <div>
              <p className="text-white font-medium mb-1">Portfolio-Analyse</p>
              <ul className="text-sm text-gray-300 space-y-1">
                {metrics.diversificationScore >= 80 && (
                  <li>✓ Sehr gute Diversifikation über {metrics.numSectors} Sektoren</li>
                )}
                {metrics.diversificationScore < 60 && (
                  <li>⚠️ Erwäge mehr Diversifikation über verschiedene Sektoren</li>
                )}
                {state.positions.length < 5 && (
                  <li>⚠️ Portfolio könnte von mehr Positionen profitieren (empfohlen: 8-15)</li>
                )}
                {state.positions.some(p => p.weight > 20) && (
                  <li>⚠️ Einige Positionen sind sehr hoch gewichtet (&gt; 20%)</li>
                )}
                {metrics.avgDividendYield > 3 && state.strategy === 'dividends' && (
                  <li>✓ Gute Dividendenrendite für deine Strategie</li>
                )}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
