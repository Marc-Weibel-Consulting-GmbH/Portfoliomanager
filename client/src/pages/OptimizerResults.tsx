import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, TrendingUp } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { optimizePortfolioSharpe, weightsToPositions } from "@/utils/sharpeOptimizer";
import { useState } from "react";

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
  isDividendStock: boolean;
  isGrowthStock: boolean;
}

export default function OptimizerResults({ inputs, onBack }: OptimizerResultsProps) {
  const { data: allStocks = [] } = trpc.stocks.list.useQuery();
  const [showSharpeOptimized, setShowSharpeOptimized] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const optimizedPortfolio = useMemo((): {
    positions: OptimizedPosition[];
    totalInvested: number;
    remainingCash: number;
    totalShares: number;
    avgDividendYield: number;
  } => {
    if (!allStocks.length) return { positions: [], totalInvested: 0, remainingCash: inputs.investmentAmount, totalShares: 0, avgDividendYield: 0 };

    // Step 1: Calculate score for ALL stocks (no dividend filter)
    const scored = allStocks.map((stock: any) => {
      let score = 0;
      const divYield = parseFloat(stock.dividendYield || "0");
      const ytdPerf = parseFloat(stock.ytdPerformance || "0");
      const peRatio = parseFloat(stock.peRatio || "0");
      const currentPrice = parseFloat(stock.currentPrice || "0");

      // Classify stock type
      const isDividendStock = divYield >= 2.5;
      const isGrowthStock = ytdPerf > 10 || ["Technology", "E-Commerce", "Fintech", "Biotech"].includes(stock.category);

      // Investor type specific scoring
      if (inputs.investorType === "conservative") {
        // Prefer dividend stocks (70%), some growth (30%)
        if (isDividendStock) {
          score += divYield * 20; // High weight on dividends
          score += 50; // Bonus for dividend stocks
        }
        if (peRatio > 0 && peRatio < 20) score += 15;
        if (["Healthcare", "Consumer Staples", "Utilities"].includes(stock.category)) {
          score += 20;
        }
        // Small bonus for growth stocks (diversification)
        if (isGrowthStock) score += ytdPerf * 0.3;
        // Penalize negative performance
        if (ytdPerf < -5) score -= Math.abs(ytdPerf) * 2;
      } else if (inputs.investorType === "balanced") {
        // 50% dividend, 50% growth
        if (isDividendStock) {
          score += divYield * 12;
          score += 30;
        }
        if (isGrowthStock) {
          score += ytdPerf * 1.2;
          score += 30;
        }
        if (peRatio > 0 && peRatio < 30) score += 10;
        // Bonus for stocks that are both
        if (isDividendStock && isGrowthStock) score += 20;
      } else if (inputs.investorType === "dynamic") {
        // Prefer growth stocks (70%), some dividend (30%)
        if (isGrowthStock) {
          score += ytdPerf * 2;
          score += 50; // Bonus for growth stocks
        }
        if (["Technology", "E-Commerce", "Fintech", "Biotech"].includes(stock.category)) {
          score += 30;
        }
        // Small bonus for dividend stocks (diversification)
        if (isDividendStock) score += divYield * 8;
        // Reward high performance
        if (ytdPerf > 20) score += 25;
      }

      // Bonus for expected dividend yield match (but not a filter)
      if (divYield >= inputs.expectedDividendYield) {
        score += 15;
      }

      return {
        ...stock,
        score,
        isDividendStock,
        isGrowthStock,
      };
    });

    // Step 3: Sort by score and take top N
    const sorted = scored.sort((a, b) => b.score - a.score);
    const topN = sorted.slice(0, inputs.numberOfPositions);

    // Step 4: Ensure sector diversification (max 30% per sector)
    const sectorCounts: Record<string, number> = {};
    const maxPerSector = Math.ceil(inputs.numberOfPositions * 0.3);
    
    const diversified: any[] = [];
    
    // First pass: Add stocks respecting sector limits
    for (const stock of topN) {
      const count = sectorCounts[stock.category] || 0;
      if (count < maxPerSector) {
        diversified.push(stock);
        sectorCounts[stock.category] = count + 1;
      }
    }

    // Second pass: If we don't have enough, add more from remaining sorted stocks
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

    // Third pass: If still not enough, relax sector constraint
    if (diversified.length < inputs.numberOfPositions) {
      const remaining = sorted.filter(s => !diversified.find(d => d.ticker === s.ticker));
      for (const stock of remaining) {
        if (diversified.length >= inputs.numberOfPositions) break;
        diversified.push(stock);
      }
    }

    // Step 5: Calculate position sizes with 10% max rule (more flexible)
    const maxPositionPercent = 0.10; // 10% max per position
    const maxPositionAmount = inputs.investmentAmount * maxPositionPercent;
    const baseAllocation = inputs.investmentAmount / diversified.length;
    
    const positions: OptimizedPosition[] = diversified.map((stock) => {
      const currentPrice = parseFloat(stock.currentPrice || "0");
      if (currentPrice === 0) {
        return null;
      }

      // Limit position size to 10% max
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
        isDividendStock: stock.isDividendStock,
        isGrowthStock: stock.isGrowthStock,
      };
    }).filter(Boolean) as OptimizedPosition[];

    // Redistribute any remaining cash from rounding to invest full amount
    let totalInvested = positions.reduce((sum, p) => sum + p.investmentAmount, 0);
    let remainingCash = inputs.investmentAmount - totalInvested;

    // Distribute remaining cash by buying additional shares where possible
    if (remainingCash > 0 && positions.length > 0) {
      // Sort positions by price (cheapest first) to maximize additional shares
      const sortedByPrice = [...positions].sort((a, b) => 
        parseFloat(a.currentPrice) - parseFloat(b.currentPrice)
      );

      for (const position of sortedByPrice) {
        const currentPrice = parseFloat(position.currentPrice);
        const maxPositionAmount = inputs.investmentAmount * maxPositionPercent; // 10% max
        const currentAmount = position.investmentAmount;
        const availableForPosition = maxPositionAmount - currentAmount;

        if (remainingCash >= currentPrice && availableForPosition >= currentPrice) {
          const additionalShares = Math.floor(Math.min(remainingCash, availableForPosition) / currentPrice);
          if (additionalShares > 0) {
            position.shares += additionalShares;
            const additionalInvestment = additionalShares * currentPrice;
            position.investmentAmount += additionalInvestment;
            position.portfolioWeight = (position.investmentAmount / inputs.investmentAmount) * 100;
            remainingCash -= additionalInvestment;
            totalInvested += additionalInvestment;
          }
        }

        if (remainingCash < 1) break; // Stop if less than 1 CHF remaining
      }
    }

    // Calculate average dividend yield weighted by investment amount
    let avgDividendYield = positions.length > 0
      ? positions.reduce((sum, p) => {
          const divYield = parseFloat(p.dividendYield || "0");
          return sum + (divYield * p.investmentAmount);
        }, 0) / totalInvested
      : 0;

    // Step 6: Optimize to match target dividend yield (iterative approach)
    const targetDividendYield = inputs.expectedDividendYield;
    const tolerance = 0.1; // ±0.1% tolerance
    const maxIterations = 10;
    let iteration = 0;
    let optimizedPositions = [...positions];
    
    // Get all available stocks sorted by dividend yield
    const availableStocks = scored.filter(s => 
      !optimizedPositions.find(p => p.ticker === s.ticker)
    );
    const highDivStocks = availableStocks
      .filter(s => parseFloat(s.dividendYield || "0") >= targetDividendYield)
      .sort((a, b) => parseFloat(b.dividendYield || "0") - parseFloat(a.dividendYield || "0"));
    const lowDivStocks = availableStocks
      .filter(s => parseFloat(s.dividendYield || "0") < targetDividendYield)
      .sort((a, b) => parseFloat(a.dividendYield || "0") - parseFloat(b.dividendYield || "0"));

    while (Math.abs(avgDividendYield - targetDividendYield) > tolerance && iteration < maxIterations) {
      iteration++;
      let swapMade = false;

      if (avgDividendYield < targetDividendYield && highDivStocks.length > 0) {
        // Need to increase dividend yield: replace lowest dividend stock with highest available
        const lowestDivPosition = optimizedPositions
          .sort((a, b) => parseFloat(a.dividendYield || "0") - parseFloat(b.dividendYield || "0"))[0];
        const replacementStock = highDivStocks[0];

        if (replacementStock && parseFloat(replacementStock.dividendYield || "0") > parseFloat(lowestDivPosition.dividendYield || "0")) {
          // Remove lowest div stock
          optimizedPositions = optimizedPositions.filter(p => p.ticker !== lowestDivPosition.ticker);
          
          // Add high div stock
          const currentPrice = parseFloat(replacementStock.currentPrice || "0");
          if (currentPrice > 0) {
            const positionAmount = Math.min(baseAllocation, maxPositionAmount);
            const shares = Math.floor(positionAmount / currentPrice);
            const actualInvestment = shares * currentPrice;
            
            optimizedPositions.push({
              ticker: replacementStock.ticker,
              companyName: replacementStock.companyName,
              category: replacementStock.category,
              currentPrice: replacementStock.currentPrice,
              dividendYield: replacementStock.dividendYield,
              ytdPerformance: replacementStock.ytdPerformance,
              peRatio: replacementStock.peRatio,
              shares,
              investmentAmount: actualInvestment,
              portfolioWeight: (actualInvestment / inputs.investmentAmount) * 100,
              score: replacementStock.score,
              isDividendStock: replacementStock.isDividendStock,
              isGrowthStock: replacementStock.isGrowthStock,
            });

            // Move used stock to end of list
            highDivStocks.shift();
            swapMade = true;
          }
        }
      } else if (avgDividendYield > targetDividendYield && lowDivStocks.length > 0) {
        // Need to decrease dividend yield: replace highest dividend stock with lowest available
        const highestDivPosition = optimizedPositions
          .sort((a, b) => parseFloat(b.dividendYield || "0") - parseFloat(a.dividendYield || "0"))[0];
        const replacementStock = lowDivStocks[0];

        if (replacementStock && parseFloat(replacementStock.dividendYield || "0") < parseFloat(highestDivPosition.dividendYield || "0")) {
          // Remove highest div stock
          optimizedPositions = optimizedPositions.filter(p => p.ticker !== highestDivPosition.ticker);
          
          // Add low div stock
          const currentPrice = parseFloat(replacementStock.currentPrice || "0");
          if (currentPrice > 0) {
            const positionAmount = Math.min(baseAllocation, maxPositionAmount);
            const shares = Math.floor(positionAmount / currentPrice);
            const actualInvestment = shares * currentPrice;
            
            optimizedPositions.push({
              ticker: replacementStock.ticker,
              companyName: replacementStock.companyName,
              category: replacementStock.category,
              currentPrice: replacementStock.currentPrice,
              dividendYield: replacementStock.dividendYield,
              ytdPerformance: replacementStock.ytdPerformance,
              peRatio: replacementStock.peRatio,
              shares,
              investmentAmount: actualInvestment,
              portfolioWeight: (actualInvestment / inputs.investmentAmount) * 100,
              score: replacementStock.score,
              isDividendStock: replacementStock.isDividendStock,
              isGrowthStock: replacementStock.isGrowthStock,
            });

            // Move used stock to end of list
            lowDivStocks.shift();
            swapMade = true;
          }
        }
      }

      if (!swapMade) break; // Can't improve further

      // Recalculate total invested and avg dividend yield
      totalInvested = optimizedPositions.reduce((sum, p) => sum + p.investmentAmount, 0);
      avgDividendYield = optimizedPositions.length > 0
        ? optimizedPositions.reduce((sum, p) => {
            const divYield = parseFloat(p.dividendYield || "0");
            return sum + (divYield * p.investmentAmount);
          }, 0) / totalInvested
        : 0;
    }

    // Use optimized positions if we got closer to target
    const finalPositions = optimizedPositions;
    const finalTotalInvested = finalPositions.reduce((sum, p) => sum + p.investmentAmount, 0);
    const finalAvgDividendYield = finalPositions.length > 0
      ? finalPositions.reduce((sum, p) => {
          const divYield = parseFloat(p.dividendYield || "0");
          return sum + (divYield * p.investmentAmount);
        }, 0) / finalTotalInvested
      : 0;

    return {
      positions: finalPositions,
      totalInvested: finalTotalInvested,
      remainingCash: inputs.investmentAmount - finalTotalInvested,
      totalShares: finalPositions.reduce((sum, p) => sum + p.shares, 0),
      avgDividendYield: finalAvgDividendYield,
    };
  }, [allStocks, inputs]);

  // Calculate Sharpe-optimized portfolio
  const sharpeOptimizedPortfolio = useMemo(() => {
    if (!optimizedPortfolio.positions.length) return null;

    // Get the scored stocks from the original optimization
    const scored = allStocks.map((stock: any) => {
      let score = 0;
      const divYield = parseFloat(stock.dividendYield || "0");
      const ytdPerf = parseFloat(stock.ytdPerformance || "0");
      const peRatio = parseFloat(stock.peRatio || "0");

      const isDividendStock = divYield >= 2.5;
      const isGrowthStock = ytdPerf > 10 || ["Technology", "E-Commerce", "Fintech", "Biotech"].includes(stock.category);

      if (inputs.investorType === "conservative") {
        if (isDividendStock) {
          score += divYield * 20;
          score += 50;
        }
        if (peRatio > 0 && peRatio < 20) score += 15;
        if (["Healthcare", "Consumer Staples", "Utilities"].includes(stock.category)) {
          score += 20;
        }
        if (isGrowthStock) score += ytdPerf * 0.3;
        if (ytdPerf < -5) score -= Math.abs(ytdPerf) * 2;
      } else if (inputs.investorType === "balanced") {
        if (isDividendStock) {
          score += divYield * 12;
          score += 30;
        }
        if (isGrowthStock) {
          score += ytdPerf * 1.2;
          score += 30;
        }
        if (peRatio > 0 && peRatio < 30) score += 10;
        if (isDividendStock && isGrowthStock) score += 20;
      } else if (inputs.investorType === "dynamic") {
        if (isGrowthStock) {
          score += ytdPerf * 2;
          score += 50;
        }
        if (["Technology", "E-Commerce", "Fintech", "Biotech"].includes(stock.category)) {
          score += 30;
        }
        if (isDividendStock) score += divYield * 8;
        if (ytdPerf > 20) score += 25;
      }

      if (divYield >= inputs.expectedDividendYield) {
        score += 15;
      }

      return {
        ...stock,
        score,
        isDividendStock,
        isGrowthStock,
      };
    });

    const sorted = scored.sort((a, b) => b.score - a.score);

    // Run Sharpe optimization
    const optimizationResult = optimizePortfolioSharpe(
      sorted,
      inputs.numberOfPositions,
      5000 // 5000 iterations
    );

    // Convert weights to positions
    const selectedStocks = sorted.slice(0, inputs.numberOfPositions);
    const weightedPositions = weightsToPositions(
      selectedStocks,
      optimizationResult.weights,
      inputs.investmentAmount,
      0.10 // 10% max
    );

    // Build full position objects and filter out 0% positions
    const positions: OptimizedPosition[] = weightedPositions
      .filter(wp => wp.shares > 0 && wp.amount > 0) // Filter out 0% positions
      .map(wp => {
        const stock = selectedStocks.find(s => s.ticker === wp.ticker)!;
        return {
          ticker: stock.ticker,
          companyName: stock.companyName,
          category: stock.category,
          currentPrice: stock.currentPrice,
          dividendYield: stock.dividendYield,
          ytdPerformance: stock.ytdPerformance,
          peRatio: stock.peRatio,
          shares: wp.shares,
          investmentAmount: wp.amount,
          portfolioWeight: (wp.amount / inputs.investmentAmount) * 100,
          score: stock.score,
          isDividendStock: stock.isDividendStock,
          isGrowthStock: stock.isGrowthStock,
        };
      });

    const totalInvested = positions.reduce((sum, p) => sum + p.investmentAmount, 0);
    const remainingCash = inputs.investmentAmount - totalInvested;

    const avgDividendYield = positions.length > 0
      ? positions.reduce((sum, p) => {
          const divYield = parseFloat(p.dividendYield || "0");
          return sum + (divYield * p.investmentAmount);
        }, 0) / totalInvested
      : 0;

    return {
      positions,
      totalInvested,
      remainingCash,
      totalShares: positions.reduce((sum, p) => sum + p.shares, 0),
      avgDividendYield,
      sharpeRatio: optimizationResult.sharpeRatio,
      expectedReturn: optimizationResult.expectedReturn * 100, // Convert to percentage
      volatility: optimizationResult.volatility * 100, // Convert to percentage
    };
  }, [allStocks, inputs, optimizedPortfolio.positions]);

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

  // Check if too few stocks for good diversification
  const showDiversificationWarning = optimizedPortfolio.positions.length > 0 && 
                                      optimizedPortfolio.positions.length < Math.min(inputs.numberOfPositions, 10);

  if (!optimizedPortfolio.positions?.length) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-white text-xl font-bold mb-2">
            Keine Aktien gefunden
          </p>
          <p className="text-slate-400 mt-2">
            Mit einer Dividendenrendite von <span className="font-bold text-white">{inputs.expectedDividendYield}%</span> wurden keine passenden Aktien gefunden.
          </p>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mt-6 max-w-md mx-auto">
            <p className="text-yellow-400 text-sm">
              💡 <strong>Vorschlag:</strong> Senken Sie die erwartete Dividendenrendite auf 2.0-3.0% für bessere Diversifikation.
            </p>
          </div>
          <Button onClick={onBack} className="mt-6 bg-cyan-600 hover:bg-cyan-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück und anpassen
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Select which portfolio to display
  const displayPortfolio = showSharpeOptimized && sharpeOptimizedPortfolio 
    ? sharpeOptimizedPortfolio 
    : optimizedPortfolio;

  // Calculate composition for display portfolio
  const dividendAmount = displayPortfolio.positions
    .filter((p: any) => p.isDividendStock)
    .reduce((sum, p) => sum + p.investmentAmount, 0);
  const growthAmount = displayPortfolio.positions
    .filter((p: any) => p.isGrowthStock && !p.isDividendStock)
    .reduce((sum, p) => sum + p.investmentAmount, 0);
  const dividendPercent = (dividendAmount / inputs.investmentAmount) * 100;
  const growthPercent = (growthAmount / inputs.investmentAmount) * 100;
  const cashPercent = (displayPortfolio.remainingCash / inputs.investmentAmount) * 100;

  return (
    <div className="space-y-4">
      {/* Variant Switcher */}
      {sharpeOptimizedPortfolio && (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold mb-1">Portfolio-Varianten</h3>
                <p className="text-slate-400 text-sm">
                  Wählen Sie zwischen dem ursprünglichen Portfolio und der Sharpe-Ratio-optimierten Variante
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowSharpeOptimized(false)}
                  variant={!showSharpeOptimized ? "default" : "outline"}
                  className={!showSharpeOptimized ? "bg-cyan-600 hover:bg-cyan-700" : "text-white border-slate-600 hover:bg-slate-700"}
                >
                  Original
                </Button>
                <Button
                  onClick={() => setShowSharpeOptimized(true)}
                  variant={showSharpeOptimized ? "default" : "outline"}
                  className={showSharpeOptimized ? "bg-green-600 hover:bg-green-700" : "text-white border-slate-600 hover:bg-slate-700"}
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Sharpe-optimiert
                </Button>
              </div>
            </div>
            {showSharpeOptimized && sharpeOptimizedPortfolio && (
              <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-slate-700">
                <div>
                  <p className="text-slate-400 text-xs">Sharpe Ratio</p>
                  <p className="text-white font-bold text-lg">
                    {sharpeOptimizedPortfolio.sharpeRatio.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Erwartete Rendite</p>
                  <p className="text-green-400 font-bold text-lg">
                    {sharpeOptimizedPortfolio.expectedReturn.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Volatilität</p>
                  <p className="text-yellow-400 font-bold text-lg">
                    {sharpeOptimizedPortfolio.volatility.toFixed(1)}%
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dividend Yield Warning */}
      {Math.abs(displayPortfolio.avgDividendYield - inputs.expectedDividendYield) > 0.5 && (
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div className="flex-1">
                <h3 className="text-yellow-400 font-bold mb-1">
                  Ziel-Dividendenrendite nicht vollständig erreichbar
                </h3>
                <p className="text-slate-300 text-sm mb-2">
                  Die durchschnittliche Dividendenrendite von <strong>{displayPortfolio.avgDividendYield.toFixed(2)}%</strong> weicht von Ihrer Vorgabe (<strong>{inputs.expectedDividendYield}%</strong>) ab.
                </p>
                <p className="text-slate-400 text-xs">
                  💡 <strong>Grund:</strong> Unter Einhaltung der 10% Maximalgewichtung pro Position und Berücksichtigung Ihres Anlegertyps ({inputs.investorType === 'conservative' ? 'Konservativ' : inputs.investorType === 'balanced' ? 'Ausgewogen' : 'Dynamisch'}) ist dies die bestmögliche Annäherung.
                </p>
                <p className="text-slate-400 text-xs mt-2">
                  <strong>Tipp:</strong> Passen Sie die Ziel-Dividende an oder wählen Sie mehr Positionen für bessere Flexibilität.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Portfolio Composition */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Portfolio-Zusammensetzung</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 p-4 rounded-lg">
              <p className="text-slate-400 text-sm mb-1">Dividendenaktien</p>
              <p className="text-2xl font-bold text-blue-400">{dividendPercent.toFixed(1)}%</p>
              <p className="text-slate-500 text-xs mt-1">
                CHF {dividendAmount.toLocaleString('de-CH', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="bg-slate-900 p-4 rounded-lg">
              <p className="text-slate-400 text-sm mb-1">Wachstumsaktien</p>
              <p className="text-2xl font-bold text-green-400">{growthPercent.toFixed(1)}%</p>
              <p className="text-slate-500 text-xs mt-1">
                CHF {growthAmount.toLocaleString('de-CH', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="bg-slate-900 p-4 rounded-lg">
              <p className="text-slate-400 text-sm mb-1">Cash</p>
              <p className="text-2xl font-bold text-yellow-400">{cashPercent.toFixed(1)}%</p>
              <p className="text-slate-500 text-xs mt-1">
                CHF {optimizedPortfolio.remainingCash.toLocaleString('de-CH', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Investiert</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              CHF {displayPortfolio.totalInvested.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Restbetrag</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              CHF {displayPortfolio.remainingCash.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Positionen</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {displayPortfolio.positions.length}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Ø Dividendenrendite</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {displayPortfolio.avgDividendYield.toFixed(2)}%
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
                {displayPortfolio.positions.map((pos) => (
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
                    CHF {displayPortfolio.totalInvested.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right text-white">
                    {((displayPortfolio.totalInvested / inputs.investmentAmount) * 100).toFixed(2)}%
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

