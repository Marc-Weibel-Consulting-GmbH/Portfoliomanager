import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, TrendingUp, HelpCircle, Save, FolderOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
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
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictData, setConflictData] = useState<any>(null);
  const [optimizationStrategy, setOptimizationStrategy] = useState<"balanced" | "reduce_positions">("balanced");
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);
  const [adjustedInputs, setAdjustedInputs] = useState(inputs);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [portfolioName, setPortfolioName] = useState('');
  const [portfolioDescription, setPortfolioDescription] = useState('');

  const saveMutation = trpc.savedPortfolios.create.useMutation({
    onSuccess: () => {
      toast.success('Portfolio erfolgreich gespeichert!');
      setShowSaveDialog(false);
      setPortfolioName('');
      setPortfolioDescription('');
    },
    onError: (error) => {
      toast.error('Fehler beim Speichern: ' + error.message);
    },
  });

  const { data: savedPortfolios = [], refetch: refetchPortfolios } = trpc.savedPortfolios.list.useQuery();
  const loadMutation = trpc.savedPortfolios.delete.useMutation({
    onSuccess: () => {
      refetchPortfolios();
      toast.success('Portfolio gelöscht!');
    },
  });

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
    avgYtdPerformance: number;
  } => {
    if (!allStocks.length) return { 
      positions: [], 
      totalInvested: 0, 
      remainingCash: currentInputs.investmentAmount, 
      totalShares: 0, 
      avgDividendYield: 0,
      avgYtdPerformance: 0 
    };

    // PRIORITY 3: Enforce CHF 1'000 minimum position size (due to transaction costs)
    const MIN_POSITION_SIZE = 1000; // CHF 1'000 absolute minimum
    const avgPositionSize = currentInputs.investmentAmount / currentInputs.numberOfPositions;
    
    // Auto-reduce number of positions if average position size < CHF 1'000
    let effectiveNumberOfPositions = currentInputs.numberOfPositions;
    if (avgPositionSize < MIN_POSITION_SIZE) {
      effectiveNumberOfPositions = Math.max(1, Math.floor(currentInputs.investmentAmount / MIN_POSITION_SIZE));
    }
    
    // Dynamic limits based on portfolio size
    const maxPositionPercent = currentInputs.investmentAmount < 20000 ? 0.10 : 0.05; // 10% for small, 5% for large
    const minPositionPercent = currentInputs.investmentAmount < 20000 ? 0 : 0.01; // No min for small, 1% for large
    const targetInvestmentPercent = 0.90; // 90% MINIMUM investment target (changed from 98%)
    const flexibleMaxPercent = currentInputs.investmentAmount < 20000 ? 0.15 : 0.08; // Flexible max for final distribution
    const maxPositionAmount = currentInputs.investmentAmount * maxPositionPercent;
    const minPositionAmount = minPositionPercent > 0 ? currentInputs.investmentAmount * minPositionPercent : 0;

    // PRIORITY 2: Dividend yield guarantee (3% ±0.2% tolerance)
    // Use conservative scoring when dividend target > 0 to prioritize dividend stocks
    // BUT maintain 20-30% growth stocks for balanced portfolio
    const hasDividendTarget = currentInputs.expectedDividendYield > 0;
    const effectiveInvestorType = hasDividendTarget ? "conservative" : currentInputs.investorType;
    
    // No hard filtering - use all stocks
    const stocksToScore = allStocks;
    
    // Step 1: Calculate score with dividend-aware weighting (using effective investor type and filtered stocks)
    const scored = stocksToScore.map((stock: any) => {
      let score = 0;
      const divYield = parseFloat(stock.dividendYield || "0");
      const ytdPerf = parseFloat(stock.ytdPerformance || "0");
      const peRatio = parseFloat(stock.peRatio || "0");

      // Classify stock type
      const isDividendStock = divYield >= 2.5;
      const isGrowthStock = ytdPerf > 10 || ["Technology", "E-Commerce", "Fintech", "Biotech"].includes(stock.category);

      // Investor type specific scoring (using effectiveInvestorType)
      if (effectiveInvestorType === "conservative") {
        // Prefer dividend stocks (70%), some growth (30%)
        if (isDividendStock) {
          // MASSIVELY increase dividend weight when target exists
          const dividendMultiplier = hasDividendTarget ? 50 : 20;
          score += divYield * dividendMultiplier;
          score += hasDividendTarget ? 100 : 50; // Bonus for dividend stocks
        }
        if (peRatio > 0 && peRatio < 20) score += 15;
        if (["Healthcare", "Consumer Staples", "Utilities"].includes(stock.category)) {
          score += 20;
        }
        // Small bonus for growth stocks (diversification)
        if (isGrowthStock) score += ytdPerf * 0.3;
        // Penalize negative performance
        if (ytdPerf < -5) score -= Math.abs(ytdPerf) * 2;
      } else if (effectiveInvestorType === "balanced") {
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
      } else if (effectiveInvestorType === "dynamic") {
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
      if (hasDividendTarget && currentInputs.expectedDividendYield > 0) {
        const divDiff = Math.abs(divYield - currentInputs.expectedDividendYield);
        if (divDiff < 0.5) {
          score += 150; // Very close to target - MASSIVE boost
        } else if (divDiff < 1.0) {
          score += 80; // Close to target
        } else if (divDiff < 2.0) {
          score += 40; // Somewhat close
        }
        // Penalize stocks far from target
        if (divDiff > 2.0) {
          score -= 50;
        }
      }

      // Note: 'reduce_positions' strategy uses same scoring but selects fewer stocks (70% of requested)

      return {
        ...stock,
        score,
        isDividendStock,
        isGrowthStock,
      };
    });

    // Step 3: Sort by score and take top N (using effectiveNumberOfPositions)
    const sorted = scored.sort((a, b) => b.score - a.score);
    const topN = sorted.slice(0, effectiveNumberOfPositions);

    // Step 4: Ensure sector diversification (max 30% per sector)
    const sectorCounts: Record<string, number> = {};
    const maxPerSector = Math.ceil(effectiveNumberOfPositions * 0.3);
    
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

    // GROWTH STOCK MINIMUM: Ensure 20-30% growth stocks when dividend target exists
    if (hasDividendTarget && currentInputs.investorType === "balanced") {
      const growthStocksInPortfolio = diversified.filter(s => s.isGrowthStock).length;
      const minGrowthStocks = Math.ceil(diversified.length * 0.25); // 25% minimum
      
      if (growthStocksInPortfolio < minGrowthStocks) {
        // Need to add more growth stocks
        const growthStocksAvailable = sorted.filter(s => 
          s.isGrowthStock && !diversified.find(d => d.ticker === s.ticker)
        );
        
        const neededGrowthStocks = minGrowthStocks - growthStocksInPortfolio;
        const growthToAdd = growthStocksAvailable.slice(0, neededGrowthStocks);
        
        // Replace lowest scoring dividend stocks with growth stocks
        const dividendStocksToReplace = diversified
          .filter(s => s.isDividendStock && !s.isGrowthStock)
          .sort((a, b) => a.score - b.score)
          .slice(0, growthToAdd.length);
        
        dividendStocksToReplace.forEach((divStock, idx) => {
          const indexToReplace = diversified.findIndex(s => s.ticker === divStock.ticker);
          if (indexToReplace >= 0 && growthToAdd[idx]) {
            diversified[indexToReplace] = growthToAdd[idx];
          }
        });
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
    
    // DYNAMIC WEIGHTING: Dividend stocks get higher weight, growth stocks lower weight
    // This helps achieve exact dividend target (e.g., 3%)
    const dividendStocksCount = selectedStocks.filter(s => s.isDividendStock && !s.isGrowthStock).length;
    const growthStocksCount = selectedStocks.filter(s => s.isGrowthStock && !s.isDividendStock).length;
    const mixedStocksCount = selectedStocks.filter(s => s.isDividendStock && s.isGrowthStock).length;
    
    // Calculate target weights based on dividend goal
    const dividendWeight = hasDividendTarget ? 0.08 : 0.05; // 8% for dividend stocks (vs 5% default)
    const growthWeight = hasDividendTarget ? 0.02 : 0.05; // 2% for growth stocks (vs 5% default)
    const mixedWeight = 0.05; // 5% for mixed stocks
    
    // Calculate total target allocation
    const targetDividendAllocation = dividendStocksCount * dividendWeight * currentInputs.investmentAmount;
    const targetGrowthAllocation = growthStocksCount * growthWeight * currentInputs.investmentAmount;
    const targetMixedAllocation = mixedStocksCount * mixedWeight * currentInputs.investmentAmount;
    const totalTargetAllocation = targetDividendAllocation + targetGrowthAllocation + targetMixedAllocation;
    
    // Scale to fit investment amount (90% target)
    const scaleFactor = (currentInputs.investmentAmount * 0.90) / totalTargetAllocation;
    
    const positions: OptimizedPosition[] = selectedStocks.map((stock) => {
      const currentPrice = parseFloat(stock.currentPrice || "0");
      if (currentPrice === 0) {
        return null;
      }

      // Determine position weight based on stock type
      let targetWeight = 0.05; // default
      if (stock.isDividendStock && !stock.isGrowthStock) {
        targetWeight = dividendWeight;
      } else if (stock.isGrowthStock && !stock.isDividendStock) {
        targetWeight = growthWeight;
      } else if (stock.isDividendStock && stock.isGrowthStock) {
        targetWeight = mixedWeight;
      }
      
      // Calculate position amount with scaling
      let positionAmount = targetWeight * currentInputs.investmentAmount * scaleFactor;
      
      // Enforce limits
      const maxForType = stock.isDividendStock ? currentInputs.investmentAmount * 0.10 : maxPositionAmount; // 10% max for dividend stocks
      positionAmount = Math.min(positionAmount, maxForType);
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

    // Calculate average YTD performance weighted by investment amount
    let avgYtdPerformance = positions.length > 0
      ? positions.reduce((sum, p) => {
          const ytd = parseFloat(p.ytdPerformance || "0");
          return sum + (ytd * p.investmentAmount);
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
    
    let finalAvgDividendYield = finalTotalInvested > 0
        ? finalPositions.reduce((sum, p) => {
            const divYield = parseFloat(p.dividendYield || "0");
            return sum + (divYield * p.investmentAmount);
          }, 0) / finalTotalInvested
        : 0;

    // Dividend optimization removed - show warning instead if target not met

    return {
      positions: finalPositions,
      totalInvested: finalTotalInvested,
      remainingCash: currentInputs.investmentAmount - finalTotalInvested,
      totalShares: finalPositions.reduce((sum, p) => sum + p.shares, 0),
      avgDividendYield: finalAvgDividendYield,
      avgYtdPerformance: finalPositions.length > 0
        ? finalPositions.reduce((sum, p) => {
            const ytd = parseFloat(p.ytdPerformance || "0");
            return sum + (ytd * p.investmentAmount);
          }, 0) / finalTotalInvested
        : 0,
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

      {/* Minimum Investment Warning removed - new priority logic implemented */}



      {/* ETF Recommendation Warning */}
      {(displayPortfolio.positions.length < 10 || 
        (displayPortfolio.totalInvested / displayPortfolio.positions.length) < 1000) && (
        <Card className="bg-amber-900/20 border-amber-600">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div className="flex-1">
                <h3 className="text-amber-400 font-bold mb-1">
                  Mangelnde Diversifikation
                </h3>
                <p className="text-slate-300 text-sm mb-2">
                  {displayPortfolio.positions.length < 10 && (
                    <span>Ihr Portfolio enthält nur <strong>{displayPortfolio.positions.length} Positionen</strong>. </span>
                  )}
                  {(displayPortfolio.totalInvested / displayPortfolio.positions.length) < 1000 && (
                    <span>Die durchschnittliche Positionsgröße beträgt nur <strong>CHF {Math.round(displayPortfolio.totalInvested / displayPortfolio.positions.length).toLocaleString('de-CH')}</strong>. </span>
                  )}
                </p>
                <p className="text-slate-400 text-xs">
                  💡 <strong>Empfehlung:</strong> Für bessere Diversifikation und geringere Transaktionskosten empfehlen wir den Einsatz von ETFs (Exchange Traded Funds).
                </p>
                <p className="text-slate-400 text-xs mt-2">
                  <strong>Tipp:</strong> Erhöhen Sie den Investitionsbetrag oder reduzieren Sie die Anzahl der Positionen für größere Einzelpositionen.
                </p>
              </div>
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
                <Button
                  onClick={() => setShowAdjustmentDialog(true)}
                  className="mt-3 bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  Portfolio anpassen
                </Button>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-slate-400">Investiert</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-lg font-bold text-white">
              CHF {displayPortfolio.totalInvested.toLocaleString('de-CH', { minimumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-slate-400">Positionen</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-lg font-bold text-white">
              {displayPortfolio.positions.length}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-slate-400">Ø Dividende</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-lg font-bold text-white">
              {displayPortfolio.avgDividendYield.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-slate-400">Ø YTD Perf.</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className={`text-lg font-bold ${
              displayPortfolio.avgYtdPerformance >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {displayPortfolio.avgYtdPerformance >= 0 ? '+' : ''}{displayPortfolio.avgYtdPerformance.toFixed(1)}%
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
            <Button onClick={() => setShowAdjustmentDialog(true)} variant="outline" className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600">
              Portfolio anpassen
            </Button>
            <Button onClick={() => setShowSaveDialog(true)} className="bg-green-600 hover:bg-green-700 text-white">
              <Save className="w-4 h-4 mr-2" />
              Speichern
            </Button>
            <Button onClick={() => setShowLoadDialog(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
              <FolderOpen className="w-4 h-4 mr-2" />
              Laden
            </Button>
            <Button onClick={exportToPDF} className="bg-purple-600 hover:bg-purple-700 text-white">
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

      {/* Save Portfolio Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Portfolio speichern</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Portfolio-Name</label>
              <Input
                value={portfolioName}
                onChange={(e) => setPortfolioName(e.target.value)}
                placeholder="z.B. Mein Dividenden-Portfolio"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Beschreibung (optional)</label>
              <Textarea
                value={portfolioDescription}
                onChange={(e) => setPortfolioDescription(e.target.value)}
                placeholder="Notizen zu diesem Portfolio..."
                className="bg-slate-700 border-slate-600 text-white"
                rows={3}
              />
            </div>
            <Button
              onClick={() => {
                const portfolioData = {
                  name: portfolioName,
                  description: portfolioDescription,
                  stocks: displayPortfolio.positions.map(pos => ({
                    ticker: pos.ticker,
                    companyName: pos.companyName,
                    shares: pos.shares,
                    investmentAmount: pos.investmentAmount,
                    portfolioWeight: pos.portfolioWeight,
                  })),
                  totalInvested: displayPortfolio.totalInvested,
                  numberOfPositions: displayPortfolio.positions.length,
                  avgDividendYield: displayPortfolio.avgDividendYield,
                  avgYtdPerformance: displayPortfolio.avgYtdPerformance,
                };
                saveMutation.mutate(portfolioData);
              }}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={!portfolioName.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Speichern...' : 'Speichern'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Load Portfolio Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-3xl">
          <DialogHeader>
            <DialogTitle>Portfolio laden</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {savedPortfolios.length === 0 ? (
              <p className="text-slate-400 text-center py-8">Keine gespeicherten Portfolios gefunden.</p>
            ) : (
              savedPortfolios.map((portfolio: any) => (
                <div key={portfolio.id} className="bg-slate-700 p-4 rounded-lg border border-slate-600">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-white font-semibold text-lg">{portfolio.name}</h3>
                      {portfolio.description && (
                        <p className="text-slate-400 text-sm mt-1">{portfolio.description}</p>
                      )}
                      <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                        <div>
                          <span className="text-slate-400">Positionen:</span>
                          <span className="text-white ml-2">{portfolio.numberOfPositions}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Total:</span>
                          <span className="text-white ml-2">CHF {portfolio.totalInvested.toLocaleString('de-CH')}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Ø Div.:</span>
                          <span className="text-green-400 ml-2">{portfolio.avgDividendYield.toFixed(2)}%</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Ø YTD:</span>
                          <span className={`ml-2 ${portfolio.avgYtdPerformance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {portfolio.avgYtdPerformance >= 0 ? '+' : ''}{portfolio.avgYtdPerformance.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => loadMutation.mutate(portfolio.id)}
                      variant="outline"
                      size="sm"
                      className="bg-red-600 border-red-500 text-white hover:bg-red-700"
                    >
                      Löschen
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

