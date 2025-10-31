import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, TrendingUp, HelpCircle } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { optimizePortfolioSharpe, weightsToPositions, calculateSharpeRatio } from "@/utils/sharpeOptimizer";
import { useState, useEffect } from "react";
import ConflictResolutionDialog from "@/components/ConflictResolutionDialog";
import PortfolioAdjustmentDialog from "@/components/PortfolioAdjustmentDialog";

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
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showMinInvestmentWarning, setShowMinInvestmentWarning] = useState(false);
  const [minInvestmentConflict, setMinInvestmentConflict] = useState<{
    tooExpensiveStocks: number;
    suggestedPositions: number;
    suggestedAmount: number;
  } | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictData, setConflictData] = useState<any>(null);
  const [optimizationStrategy, setOptimizationStrategy] = useState<"balanced" | "reduce_positions">("balanced");
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);
  const [adjustedInputs, setAdjustedInputs] = useState(inputs);

  // Sync adjustedInputs with inputs prop changes
  useEffect(() => {
    setAdjustedInputs(inputs);
  }, [inputs]);

  // Use adjustedInputs for all calculations (allows user adjustments)
  const currentInputs = adjustedInputs;

  // SIMPLIFIED PORTFOLIO OPTIMIZATION - No complex dividend swapping
  const optimizedPortfolio = useMemo((): {
    positions: OptimizedPosition[];
    totalInvested: number;
    remainingCash: number;
    totalShares: number;
    avgDividendYield: number;
  } => {
    if (!allStocks.length) return { 
      positions: [], 
      totalInvested: 0, 
      remainingCash: currentInputs.investmentAmount, 
      totalShares: 0, 
      avgDividendYield: 0 
    };

    // Dynamic limits based on portfolio size
    const maxPositionPercent = currentInputs.investmentAmount < 20000 ? 0.10 : 0.05; // 10% for small, 5% for large
    const minPositionPercent = currentInputs.investmentAmount < 20000 ? 0 : 0.01; // No min for small, 1% for large
    const targetInvestmentPercent = 0.90; // 90% MINIMUM investment target (changed from 98%)
    const flexibleMaxPercent = currentInputs.investmentAmount < 20000 ? 0.15 : 0.08; // Flexible max for final distribution
    const maxPositionAmount = currentInputs.investmentAmount * maxPositionPercent;
    const minPositionAmount = minPositionPercent > 0 ? currentInputs.investmentAmount * minPositionPercent : 0;

    // Step 1: Calculate score with dividend-aware weighting
    const scored = allStocks.map((stock: any) => {
      let score = 0;
      const divYield = parseFloat(stock.dividendYield || "0");
      const ytdPerf = parseFloat(stock.ytdPerformance || "0");
      const peRatio = parseFloat(stock.peRatio || "0");

      // Classify stock type
      const isDividendStock = divYield >= 2.5;
      const isGrowthStock = ytdPerf > 10 || ["Technology", "E-Commerce", "Fintech", "Biotech"].includes(stock.category);

      // Investor type specific scoring
      if (currentInputs.investorType === "conservative") {
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
      } else if (currentInputs.investorType === "balanced") {
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
      } else if (currentInputs.investorType === "dynamic") {
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

      // IMPORTANT: Boost score based on how close dividend is to target
      const divDiff = Math.abs(divYield - currentInputs.expectedDividendYield);
      if (divDiff < 0.5) {
        score += 30; // Very close to target
      } else if (divDiff < 1.0) {
        score += 20; // Close to target
      } else if (divDiff < 2.0) {
        score += 10; // Somewhat close
      }

      // Note: 'reduce_positions' strategy uses same scoring but selects fewer stocks (70% of requested)

      return {
        ...stock,
        score,
        isDividendStock,
        isGrowthStock,
      };
    });

    // Step 3: Sort by score and take top N
    const sorted = scored.sort((a, b) => b.score - a.score);
    const topN = sorted.slice(0, currentInputs.numberOfPositions);

    // Step 4: Ensure sector diversification (max 30% per sector)
    const sectorCounts: Record<string, number> = {};
    const maxPerSector = Math.ceil(currentInputs.numberOfPositions * 0.3);
    
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
    if (diversified.length < currentInputs.numberOfPositions) {
      const remaining = sorted.filter(s => !diversified.find(d => d.ticker === s.ticker));
      for (const stock of remaining) {
        if (diversified.length >= currentInputs.numberOfPositions) break;
        const count = sectorCounts[stock.category] || 0;
        if (count < maxPerSector) {
          diversified.push(stock);
          sectorCounts[stock.category] = count + 1;
        }
      }
    }

    // Third pass: If still not enough, relax sector constraint
    if (diversified.length < currentInputs.numberOfPositions) {
      const remaining = sorted.filter(s => !diversified.find(d => d.ticker === s.ticker));
      for (const stock of remaining) {
        if (diversified.length >= currentInputs.numberOfPositions) break;
        diversified.push(stock);
      }
    }

    // Step 2: Select top stocks and check affordability
    // Check if we can afford 1% minimum for all positions
    const maxAffordablePositions = Math.floor(currentInputs.investmentAmount / minPositionAmount);
    let selectedStocks = diversified;
    
    // Apply reduce_positions strategy: use 70% of requested positions
    if (optimizationStrategy === 'reduce_positions') {
      const reducedCount = Math.max(5, Math.floor(currentInputs.numberOfPositions * 0.7));
      selectedStocks = diversified.slice(0, Math.min(reducedCount, maxAffordablePositions));
    } else if (diversified.length > maxAffordablePositions) {
      // If we can't afford 1% for all, reduce number of positions
      selectedStocks = diversified.slice(0, maxAffordablePositions);
    }
    
    // Calculate equal allocation with 1% minimum
    const baseAllocation = currentInputs.investmentAmount / selectedStocks.length;
    
    // CONFLICT DETECTION: Check if any stocks are too expensive for 1% minimum
    const tooExpensiveStocks = selectedStocks.filter(stock => {
      const currentPrice = parseFloat(stock.currentPrice || "0");
      if (currentPrice === 0) return false;
      // Can we buy at least 1 share with 1% minimum?
      const minShares = Math.floor(minPositionAmount / currentPrice);
      return minShares === 0; // Too expensive
    });
    
    // If conflict detected, calculate suggestions
    if (tooExpensiveStocks.length > 0) {
      const maxStockPrice = Math.max(...selectedStocks.map(s => parseFloat(s.currentPrice || "0")));
      const suggestedAmount = Math.ceil(maxStockPrice * 100 / 1) * selectedStocks.length; // Amount needed for 1% min
      const suggestedPositions = Math.floor(currentInputs.investmentAmount / maxStockPrice); // Max positions we can afford
      
      // Store conflict info for warning display
      setMinInvestmentConflict({
        tooExpensiveStocks: tooExpensiveStocks.length,
        suggestedPositions: Math.max(1, suggestedPositions),
        suggestedAmount,
      });
      setShowMinInvestmentWarning(true);
    }
    
    const positions: OptimizedPosition[] = selectedStocks.map((stock) => {
      const currentPrice = parseFloat(stock.currentPrice || "0");
      if (currentPrice === 0) {
        return null;
      }

      // Start with base allocation, enforce min 1% and max 5%
      let positionAmount = Math.min(baseAllocation, maxPositionAmount);
      positionAmount = Math.max(positionAmount, minPositionAmount);
      
      const shares = Math.floor(positionAmount / currentPrice);
      const actualInvestment = shares * currentPrice;
      
      // Only skip if NO shares can be bought (price too high)
      if (shares === 0) {
        return null;
      }
      
      // For small portfolios: Allow any amount
      // For large portfolios: Enforce 1% minimum with tolerance
      if (minPositionPercent > 0 && actualInvestment < minPositionAmount * 0.95) {
        return null;
      }
      
      const portfolioWeight = (actualInvestment / currentInputs.investmentAmount) * 100;

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

    // Calculate current investment level
    let totalInvested = positions.reduce((sum, p) => sum + p.investmentAmount, 0);
    let remainingCash = currentInputs.investmentAmount - totalInvested;
    const investmentPercent = totalInvested / currentInputs.investmentAmount;

    // PHASE 1: Distribute remaining cash with standard limits (reach ~90%)
    if (investmentPercent < targetInvestmentPercent && positions.length > 0) {
      // Sort by price (cheapest first) to maximize shares bought
      const sortedByPrice = [...positions].sort((a, b) => parseFloat(a.currentPrice) - parseFloat(b.currentPrice));

      let iterations = 0;
      while (totalInvested / currentInputs.investmentAmount < targetInvestmentPercent && remainingCash > 0 && iterations < 100) {
        iterations++;
        let addedThisRound = false;

        for (const position of sortedByPrice) {
          const currentPrice = parseFloat(position.currentPrice);
          const maxPositionAmount = currentInputs.investmentAmount * maxPositionPercent;
          const currentAmount = position.investmentAmount;
          const availableForPosition = maxPositionAmount - currentAmount;

          if (remainingCash >= currentPrice && availableForPosition >= currentPrice) {
            position.shares += 1;
            const additionalInvestment = currentPrice;
            position.investmentAmount += additionalInvestment;
            position.portfolioWeight = (position.investmentAmount / currentInputs.investmentAmount) * 100;
            remainingCash -= additionalInvestment;
            totalInvested += additionalInvestment;
            addedThisRound = true;

            if (totalInvested / currentInputs.investmentAmount >= targetInvestmentPercent) {
              break;
            }
          }
        }

        if (!addedThisRound) break;
      }
    }

    // PHASE 2: If still below 90%, use FLEXIBLE limits to guarantee 90%
    if (totalInvested / currentInputs.investmentAmount < targetInvestmentPercent && positions.length > 0 && remainingCash > 0) {
      const sortedByPrice = [...positions].sort((a, b) => parseFloat(a.currentPrice) - parseFloat(b.currentPrice));
      
      let iterations = 0;
      while (totalInvested / currentInputs.investmentAmount < targetInvestmentPercent && remainingCash > 0 && iterations < 100) {
        iterations++;
        let addedThisRound = false;

        for (const position of sortedByPrice) {
          const currentPrice = parseFloat(position.currentPrice);
          const flexibleMaxAmount = currentInputs.investmentAmount * flexibleMaxPercent; // Higher limit
          const currentAmount = position.investmentAmount;
          const availableForPosition = flexibleMaxAmount - currentAmount;

          if (remainingCash >= currentPrice && availableForPosition >= currentPrice) {
            position.shares += 1;
            const additionalInvestment = currentPrice;
            position.investmentAmount += additionalInvestment;
            position.portfolioWeight = (position.investmentAmount / currentInputs.investmentAmount) * 100;
            remainingCash -= additionalInvestment;
            totalInvested += additionalInvestment;
            addedThisRound = true;

            if (totalInvested / currentInputs.investmentAmount >= targetInvestmentPercent) {
              break;
            }
          }
        }

        if (!addedThisRound) break;
      }
    }

    // Calculate average dividend yield weighted by investment amount
    let avgDividendYield = positions.length > 0
      ? positions.reduce((sum, p) => {
          const divYield = parseFloat(p.dividendYield || "0");
          return sum + (divYield * p.investmentAmount);
        }, 0) / totalInvested
      : 0;

    // Step 4: FINAL FILTER - Remove any positions with 0 shares or < 1% weight
    const minWeight = 0.95; // 0.95% to account for rounding (slightly below 1%)
    let finalPositions = positions.filter(p => {
      const weight = (p.investmentAmount / currentInputs.investmentAmount) * 100;
      return p.shares > 0 && weight >= minWeight;
    });
    
    // Recalculate totals after filtering
    let finalTotalInvested = finalPositions.reduce((sum, p) => sum + p.investmentAmount, 0);
    let finalRemainingCash = currentInputs.investmentAmount - finalTotalInvested;
    const finalInvestmentPercent = finalTotalInvested / currentInputs.investmentAmount;

    // ENFORCE 90% MINIMUM: Distribute remaining cash with FLEXIBLE limits
    if (finalInvestmentPercent < targetInvestmentPercent && finalPositions.length > 0 && finalRemainingCash > 0) {
      // Sort by price (cheapest first) to maximize investment
      const sortedByPrice = [...finalPositions].sort((a, b) => parseFloat(a.currentPrice) - parseFloat(b.currentPrice));
      let iterations = 0;

      // Phase 1: Try with standard limits
      while (finalTotalInvested / currentInputs.investmentAmount < targetInvestmentPercent && finalRemainingCash > 0 && iterations < 100) {
        iterations++;
        let addedThisRound = false;

        for (const position of sortedByPrice) {
          const currentPrice = parseFloat(position.currentPrice);
          const maxPositionAmount = currentInputs.investmentAmount * maxPositionPercent;
          const currentAmount = position.investmentAmount;
          const availableForPosition = maxPositionAmount - currentAmount;

          if (finalRemainingCash >= currentPrice && availableForPosition >= currentPrice) {
            position.shares += 1;
            const additionalInvestment = currentPrice;
            position.investmentAmount += additionalInvestment;
            position.portfolioWeight = (position.investmentAmount / currentInputs.investmentAmount) * 100;
            finalRemainingCash -= additionalInvestment;
            finalTotalInvested += additionalInvestment;
            addedThisRound = true;

            if (finalTotalInvested / currentInputs.investmentAmount >= targetInvestmentPercent) {
              break;
            }
          }
        }

        if (!addedThisRound) break;
      }

      // Phase 2: If still below 90%, use FLEXIBLE limits
      iterations = 0;
      while (finalTotalInvested / currentInputs.investmentAmount < targetInvestmentPercent && finalRemainingCash > 0 && iterations < 100) {
        iterations++;
        let addedThisRound = false;

        for (const position of sortedByPrice) {
          const currentPrice = parseFloat(position.currentPrice);
          const flexibleMaxAmount = currentInputs.investmentAmount * flexibleMaxPercent; // Higher limit
          const currentAmount = position.investmentAmount;
          const availableForPosition = flexibleMaxAmount - currentAmount;

          if (finalRemainingCash >= currentPrice && availableForPosition >= currentPrice) {
            position.shares += 1;
            const additionalInvestment = currentPrice;
            position.investmentAmount += additionalInvestment;
            position.portfolioWeight = (position.investmentAmount / currentInputs.investmentAmount) * 100;
            finalRemainingCash -= additionalInvestment;
            finalTotalInvested += additionalInvestment;
            addedThisRound = true;

            if (finalTotalInvested / currentInputs.investmentAmount >= targetInvestmentPercent) {
              break;
            }
          }
        }

        if (!addedThisRound) break;
      }
    }
    
    const finalAvgDividendYield = finalPositions.length > 0
      ? finalPositions.reduce((sum, p) => {
          const divYield = parseFloat(p.dividendYield || "0");
          return sum + (divYield * p.investmentAmount);
        }, 0) / finalTotalInvested
      : 0;

    return {
      positions: finalPositions,
      totalInvested: finalTotalInvested,
      remainingCash: finalRemainingCash,
      totalShares: finalPositions.reduce((sum, p) => sum + p.shares, 0),
      avgDividendYield: finalAvgDividendYield,
    };
  }, [allStocks, adjustedInputs, optimizationStrategy]);

  // Detect conflicts and show dialog
  useEffect(() => {
    if (!optimizedPortfolio.positions.length || showConflictDialog) return;

    // Calculate Sharpe Ratio for current portfolio
    const weights: Record<string, number> = {};
    const totalInvested = optimizedPortfolio.totalInvested;
    optimizedPortfolio.positions.forEach(pos => {
      weights[pos.ticker] = pos.investmentAmount / totalInvested;
    });

    const { sharpeRatio } = calculateSharpeRatio(
      optimizedPortfolio.positions.map(p => ({
        ticker: p.ticker,
        ytdPerformance: p.ytdPerformance,
        dividendYield: p.dividendYield,
        currentPrice: p.currentPrice,
      })),
      weights
    );

    // Define thresholds
    const dividendDiff = Math.abs(optimizedPortfolio.avgDividendYield - currentInputs.expectedDividendYield);
    const targetSharpe = 1.5; // Good Sharpe Ratio target
    const sharpeDiff = targetSharpe - sharpeRatio;

    // Check if there's a conflict (dividend off by >0.5% OR sharpe below 1.0)
    const hasConflict = dividendDiff > 0.5 || sharpeRatio < 1.0;

    // Show conflict dialog ONLY on initial optimization (strategy is 'balanced')
    // Once user chooses a strategy, don't show again
    if (hasConflict && optimizationStrategy === "balanced") {
      // Show conflict dialog
      setConflictData({
        targetDividend: currentInputs.expectedDividendYield,
        achievedDividend: optimizedPortfolio.avgDividendYield,
        targetSharpe,
        achievedSharpe: sharpeRatio,
        currentPositions: currentInputs.numberOfPositions,
        suggestedPositions: Math.max(10, Math.floor(currentInputs.numberOfPositions * 0.75)),
      });
      setShowConflictDialog(true);
    }
  }, [optimizedPortfolio, currentInputs, showConflictDialog, optimizationStrategy]);

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

      if (currentInputs.investorType === "conservative") {
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
      } else if (currentInputs.investorType === "balanced") {
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
      } else if (currentInputs.investorType === "dynamic") {
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

      if (divYield >= currentInputs.expectedDividendYield) {
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
      currentInputs.numberOfPositions,
      5000 // 5000 iterations
    );

    // Convert weights to positions
    const selectedStocks = sorted.slice(0, currentInputs.numberOfPositions);
    const weightedPositions = weightsToPositions(
      selectedStocks,
      optimizationResult.weights,
      currentInputs.investmentAmount,
      0.05 // 5% max
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
          portfolioWeight: (wp.amount / currentInputs.investmentAmount) * 100,
          score: stock.score,
          isDividendStock: stock.isDividendStock,
          isGrowthStock: stock.isGrowthStock,
        };
      });

    const totalInvested = positions.reduce((sum, p) => sum + p.investmentAmount, 0);
    const remainingCash = currentInputs.investmentAmount - totalInvested;

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
    doc.text(`Anlagebetrag: CHF ${currentInputs.investmentAmount.toLocaleString('de-CH')}`, 14, 30);
    doc.text(`Erwartete Dividendenrendite: ${currentInputs.expectedDividendYield}%`, 14, 36);
    doc.text(`Anzahl Positionen: ${currentInputs.numberOfPositions}`, 14, 42);
    doc.text(`Anlegertyp: ${currentInputs.investorType === 'conservative' ? 'Konservativ' : currentInputs.investorType === 'balanced' ? 'Ausgewogen' : 'Dynamisch'}`, 14, 48);
    
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
                                      optimizedPortfolio.positions.length < Math.min(currentInputs.numberOfPositions, 10);

  if (!optimizedPortfolio.positions?.length) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-white text-xl font-bold mb-2">
            Keine Aktien gefunden
          </p>
          <p className="text-slate-400 mt-2">
            Mit einer Dividendenrendite von <span className="font-bold text-white">{currentInputs.expectedDividendYield}%</span> wurden keine passenden Aktien gefunden.
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

  // Always use optimizedPortfolio (single variant)
  const displayPortfolio = optimizedPortfolio;

  // Calculate composition for display portfolio
  const dividendAmount = displayPortfolio.positions
    .filter((p: any) => p.isDividendStock)
    .reduce((sum, p) => sum + p.investmentAmount, 0);
  const growthAmount = displayPortfolio.positions
    .filter((p: any) => p.isGrowthStock && !p.isDividendStock)
    .reduce((sum, p) => sum + p.investmentAmount, 0);
  const dividendPercent = (dividendAmount / currentInputs.investmentAmount) * 100;
  const growthPercent = (growthAmount / currentInputs.investmentAmount) * 100;
  const cashPercent = (displayPortfolio.remainingCash / currentInputs.investmentAmount) * 100;

  return (
    <div className="space-y-4">
      {/* Conflict Resolution Dialog */}
      {conflictData && (
        <ConflictResolutionDialog
          open={showConflictDialog}
          onClose={() => setShowConflictDialog(false)}
          onResolve={(strategy) => {
            setOptimizationStrategy(strategy);
            setShowConflictDialog(false);
          }}
          conflict={conflictData}
        />
      )}

      {/* Portfolio Adjustment Dialog */}
      <PortfolioAdjustmentDialog
        open={showAdjustmentDialog}
        onClose={() => setShowAdjustmentDialog(false)}
        currentInputs={adjustedInputs}
        onAdjust={(newInputs) => {
          setAdjustedInputs(newInputs);
          setShowAdjustmentDialog(false);
        }}
      />

      {/* Minimum Investment Conflict Warning */}
      {showMinInvestmentWarning && minInvestmentConflict && (
        <Card className="bg-amber-900/20 border-amber-600">
          <CardHeader>
            <CardTitle className="text-amber-400 flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              1% Minimum-Gewichtung nicht erreichbar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-300">
              Mit einem Investitionsbetrag von <strong>CHF {currentInputs.investmentAmount.toLocaleString('de-CH')}</strong> und <strong>{currentInputs.numberOfPositions} Positionen</strong> können {minInvestmentConflict.tooExpensiveStocks} Aktien nicht mit der Mindestgewichtung von 1% gekauft werden (zu teuer).
            </p>
            <p className="text-slate-300 font-bold">Wählen Sie eine Option:</p>
            <div className="grid gap-3">
              <Button
                onClick={() => {
                  setShowMinInvestmentWarning(false);
                  // Continue with flexible minimum (< 1% allowed)
                }}
                variant="outline"
                className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600 justify-start h-auto py-4"
              >
                <div className="text-left">
                  <div className="font-bold">Option 1: Minimum unterschreiten (flexibel)</div>
                  <div className="text-sm text-slate-400 mt-1">
                    Erlaubt Positionen unter 1% für teure Aktien. Portfolio wird trotzdem erstellt.
                  </div>
                </div>
              </Button>
              <Button
                onClick={() => {
                  setShowMinInvestmentWarning(false);
                  // Go back and suggest fewer positions
                  onBack();
                }}
                variant="outline"
                className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600 justify-start h-auto py-4"
              >
                <div className="text-left">
                  <div className="font-bold">Option 2: Anzahl Titel reduzieren</div>
                  <div className="text-sm text-slate-400 mt-1">
                    Empfohlen: Maximal {minInvestmentConflict.suggestedPositions} Positionen für 1% Minimum.
                  </div>
                </div>
              </Button>
              <Button
                onClick={() => {
                  setShowMinInvestmentWarning(false);
                  onBack();
                }}
                variant="outline"
                className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600 justify-start h-auto py-4"
              >
                <div className="text-left">
                  <div className="font-bold">Option 3: Investitionsbetrag erhöhen</div>
                  <div className="text-sm text-slate-400 mt-1">
                    Empfohlen: Mindestens CHF {minInvestmentConflict.suggestedAmount.toLocaleString('de-CH')} für {currentInputs.numberOfPositions} Positionen mit 1% Minimum.
                  </div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}



      {/* Dividend Yield Warning */}
      {Math.abs(displayPortfolio.avgDividendYield - currentInputs.expectedDividendYield) > 0.5 && (
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div className="flex-1">
                <h3 className="text-yellow-400 font-bold mb-1">
                  Ziel-Dividendenrendite nicht vollständig erreichbar
                </h3>
                <p className="text-slate-300 text-sm mb-2">
                  Die durchschnittliche Dividendenrendite von <strong>{displayPortfolio.avgDividendYield.toFixed(2)}%</strong> weicht von Ihrer Vorgabe (<strong>{currentInputs.expectedDividendYield}%</strong>) ab.
                </p>
                <p className="text-slate-400 text-xs">
                  💡 <strong>Grund:</strong> Unter Einhaltung der 5% Maximalgewichtung (1% Minimum) pro Position und Berücksichtigung Ihres Anlegertyps ({currentInputs.investorType === 'conservative' ? 'Konservativ' : currentInputs.investorType === 'balanced' ? 'Ausgewogen' : 'Dynamisch'}) ist dies die bestmögliche Annäherung.
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
            <Button onClick={() => setShowAdjustmentDialog(true)} variant="outline" className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Portfolio anpassen
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
                  <th className="text-right p-3 text-slate-400 font-medium">Risk Score</th>
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
                    <td className="p-3 text-right">
                      {(() => {
                        const ytd = parseFloat(pos.ytdPerformance);
                        const volatility = Math.abs(ytd) > 0 ? Math.abs(ytd) / 2 : 10;
                        const riskScore = Math.min(10, Math.max(0, (ytd / volatility) * 2));
                        const color = riskScore >= 7 ? "text-green-400" : riskScore >= 4 ? "text-yellow-400" : "text-red-400";
                        return <span className={`font-medium ${color}`}>{riskScore.toFixed(1)}</span>;
                      })()}
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
                    {((displayPortfolio.totalInvested / currentInputs.investmentAmount) * 100).toFixed(2)}%
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

