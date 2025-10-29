import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OptimizerInputs {
  investmentAmount: number;
  expectedDividendYield: number;
  numberOfPositions: number;
  investorType: "conservative" | "balanced" | "dynamic";
}

interface OptimizerResultsProps {
  inputs: OptimizerInputs;
  onBack: () => void;
}

interface OptimizedPosition {
  ticker: string;
  companyName: string;
  category: string;
  currentPrice: string;
  dividendYield: string;
  ytdPerformance: string;
  peRatio: string;
  shares: number;
  investmentAmount: number;
  portfolioWeight: number;
  score: number;
}

export default function OptimizerResults({ inputs, onBack }: OptimizerResultsProps) {
  const { data: allStocks = [] } = trpc.stocks.list.useQuery();

  const optimizedPortfolio = useMemo((): {
    positions: OptimizedPosition[];
    totalInvested: number;
    remainingCash: number;
    totalShares: number;
  } => {
    if (!allStocks.length) return { positions: [], totalInvested: 0, remainingCash: inputs.investmentAmount, totalShares: 0 };

    // Step 1: Filter by dividend yield
    const filtered = allStocks.filter((stock: any) => {
      const divYield = parseFloat(stock.dividendYield || "0");
      return divYield >= inputs.expectedDividendYield;
    });

    // Step 2: Calculate score for each stock based on investor type
    const scored = filtered.map((stock: any) => {
      let score = 0;
      const divYield = parseFloat(stock.dividendYield || "0");
      const ytdPerf = parseFloat(stock.ytdPerformance || "0");
      const peRatio = parseFloat(stock.peRatio || "0");

      // Base score from dividend yield
      score += divYield * 10;

      // Investor type specific scoring
      if (inputs.investorType === "conservative") {
        // Prefer high dividends, low P/E, defensive sectors
        score += divYield * 15; // Extra weight on dividends
        if (peRatio > 0 && peRatio < 20) score += 20;
        if (["Healthcare", "Consumer Staples", "Utilities"].includes(stock.category)) {
          score += 25;
        }
        // Penalize high volatility (negative YTD is a proxy)
        if (ytdPerf < 0) score -= Math.abs(ytdPerf) * 0.5;
      } else if (inputs.investorType === "balanced") {
        // Balanced approach
        score += ytdPerf * 0.5; // Moderate weight on performance
        score += divYield * 10;
        if (peRatio > 0 && peRatio < 30) score += 10;
      } else if (inputs.investorType === "dynamic") {
        // Prefer growth, high performance, tech
        score += ytdPerf * 1.5; // High weight on performance
        if (["Technology", "E-Commerce", "Fintech"].includes(stock.category)) {
          score += 30;
        }
        // Less weight on dividends
        score += divYield * 5;
      }

      return {
        ...stock,
        score,
      };
    });

    // Step 3: Sort by score and take top N
    const sorted = scored.sort((a, b) => b.score - a.score);
    const topN = sorted.slice(0, inputs.numberOfPositions);

    // Step 4: Ensure sector diversification (max 30% per sector)
    const sectorCounts: Record<string, number> = {};
    const maxPerSector = Math.ceil(inputs.numberOfPositions * 0.3);
    
    const diversified = topN.filter((stock) => {
      const count = sectorCounts[stock.category] || 0;
      if (count < maxPerSector) {
        sectorCounts[stock.category] = count + 1;
        return true;
      }
      return false;
    });

    // If we filtered out too many, add back lower-scored stocks from underrepresented sectors
    if (diversified.length < inputs.numberOfPositions) {
      const remaining = sorted.filter(s => !diversified.find(d => d.ticker === s.ticker));
      for (const stock of remaining) {
        if (diversified.length >= inputs.numberOfPositions) break;
        const count = sectorCounts[stock.category] || 0;
        if (count < maxPerSector) {
          diversified.push(stock);
          sectorCounts[stock.category] = count + 1;
        }
      }
    }

    // Step 5: Calculate position sizes with 5% max rule
    const maxPositionAmount = inputs.investmentAmount * 0.05; // 5% max
    const baseAllocation = inputs.investmentAmount / diversified.length;
    
    const positions: OptimizedPosition[] = diversified.map((stock) => {
      const currentPrice = parseFloat(stock.currentPrice || "0");
      if (currentPrice === 0) {
        return null;
      }

      // Limit position size to 5% max
      const positionAmount = Math.min(baseAllocation, maxPositionAmount);
      const shares = Math.floor(positionAmount / currentPrice);
      const actualInvestment = shares * currentPrice;
      const portfolioWeight = (actualInvestment / inputs.investmentAmount) * 100;

      return {
        ticker: stock.ticker,
        companyName: stock.companyName,
        category: stock.category,
        currentPrice: stock.currentPrice,
        dividendYield: stock.dividendYield,
        ytdPerformance: stock.ytdPerformance,
        peRatio: stock.peRatio,
        shares,
        investmentAmount: actualInvestment,
        portfolioWeight,
        score: stock.score,
      };
    }).filter(Boolean) as OptimizedPosition[];

    // Redistribute any remaining cash from rounding
    const totalInvested = positions.reduce((sum, p) => sum + p.investmentAmount, 0);
    const remainingCash = inputs.investmentAmount - totalInvested;

    return {
      positions,
      totalInvested,
      remainingCash,
      totalShares: positions.reduce((sum, p) => sum + p.shares, 0),
    };
  }, [allStocks, inputs]);

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Portfolio Optimizer - Ergebnis", 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Anlagebetrag: CHF ${inputs.investmentAmount.toLocaleString('de-CH')}`, 14, 30);
    doc.text(`Erwartete Dividendenrendite: ${inputs.expectedDividendYield}%`, 14, 36);
    doc.text(`Anzahl Positionen: ${inputs.numberOfPositions}`, 14, 42);
    doc.text(`Anlegertyp: ${inputs.investorType === 'conservative' ? 'Konservativ' : inputs.investorType === 'balanced' ? 'Ausgewogen' : 'Dynamisch'}`, 14, 48);
    
    const tableData = optimizedPortfolio.positions.map((pos) => [
      pos.ticker,
      pos.companyName,
      pos.shares.toString(),
      `CHF ${parseFloat(pos.currentPrice).toFixed(2)}`,
      `CHF ${pos.investmentAmount.toFixed(2)}`,
      `${pos.portfolioWeight.toFixed(2)}%`,
      `${pos.dividendYield}%`,
      `${pos.ytdPerformance}%`,
    ]);
    
    autoTable(doc, {
      startY: 55,
      head: [['Ticker', 'Unternehmen', 'Stück', 'Kurs', 'Total', 'Gewicht', 'Div.%', 'YTD%']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });
    
    doc.save(`portfolio-optimizer-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (!optimizedPortfolio.positions?.length) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-8 text-center">
          <p className="text-white text-lg">
            Keine Aktien gefunden, die Ihren Kriterien entsprechen.
          </p>
          <p className="text-slate-400 mt-2">
            Versuchen Sie, die Dividendenrendite zu senken oder andere Parameter anzupassen.
          </p>
          <Button onClick={onBack} className="mt-6 bg-cyan-600 hover:bg-cyan-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Investiert</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              CHF {optimizedPortfolio.totalInvested.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Restbetrag</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              CHF {optimizedPortfolio.remainingCash.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Positionen</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {optimizedPortfolio.positions.length}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Gesamt Aktien</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {optimizedPortfolio.totalShares}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Table */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">Optimiertes Portfolio</CardTitle>
          <div className="flex gap-2">
            <Button onClick={onBack} variant="outline" className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück
            </Button>
            <Button onClick={exportToPDF} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Download className="w-4 h-4 mr-2" />
              PDF Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left p-3 text-slate-400 font-medium">Ticker</th>
                  <th className="text-left p-3 text-slate-400 font-medium">Unternehmen</th>
                  <th className="text-left p-3 text-slate-400 font-medium">Kategorie</th>
                  <th className="text-right p-3 text-slate-400 font-medium">Stück</th>
                  <th className="text-right p-3 text-slate-400 font-medium">Kurs</th>
                  <th className="text-right p-3 text-slate-400 font-medium">Total CHF</th>
                  <th className="text-right p-3 text-slate-400 font-medium">Gewicht</th>
                  <th className="text-right p-3 text-slate-400 font-medium">Div. %</th>
                  <th className="text-right p-3 text-slate-400 font-medium">YTD %</th>
                </tr>
              </thead>
              <tbody>
                {optimizedPortfolio.positions.map((pos) => (
                  <tr key={pos.ticker} className="border-b border-slate-700 hover:bg-slate-700/50">
                    <td className="p-3 text-blue-400 font-medium">{pos.ticker}</td>
                    <td className="p-3 text-white">{pos.companyName}</td>
                    <td className="p-3 text-slate-300">{pos.category}</td>
                    <td className="p-3 text-right text-white font-medium">{pos.shares}</td>
                    <td className="p-3 text-right text-slate-300">
                      CHF {parseFloat(pos.currentPrice).toFixed(2)}
                    </td>
                    <td className="p-3 text-right text-white font-medium">
                      CHF {pos.investmentAmount.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right text-slate-300">
                      {pos.portfolioWeight.toFixed(2)}%
                    </td>
                    <td className="p-3 text-right text-green-400">
                      {pos.dividendYield}%
                    </td>
                    <td className={`p-3 text-right font-medium ${
                      parseFloat(pos.ytdPerformance) >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {parseFloat(pos.ytdPerformance) >= 0 ? '+' : ''}{pos.ytdPerformance}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-600 font-bold">
                  <td colSpan={5} className="p-3 text-white">Total</td>
                  <td className="p-3 text-right text-white">
                    CHF {optimizedPortfolio.totalInvested.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right text-white">
                    {((optimizedPortfolio.totalInvested / inputs.investmentAmount) * 100).toFixed(2)}%
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

