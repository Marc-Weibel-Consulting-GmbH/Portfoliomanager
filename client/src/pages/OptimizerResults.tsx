import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, TrendingUp, HelpCircle, Save, FolderOpen, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { optimizePortfolioSharpe, weightsToPositions, calculateSharpeRatio } from "@/utils/sharpeOptimizer";
import ConflictResolutionDialog from "@/components/ConflictResolutionDialog";
import PortfolioAdjustmentDialog from "@/components/PortfolioAdjustmentDialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

interface OptimizerInputs {
  investmentAmount: number;
  expectedDividendYield: number;
  numberOfPositions: number;
  investorType: "conservative" | "balanced" | "dynamic";
}

interface OptimizerResultsProps {
  inputs: OptimizerInputs;
  onBack: () => void;
  onPortfolioSaved?: () => void;
  initialStocks?: OptimizedPosition[];
  loadedPortfolioId?: string;
  loadedPortfolioName?: string;
}

interface OptimizedPosition {
  ticker: string;
  companyName: string;
  category: string;
  currentPrice: string;
  dividendYield: string;
  ytdPerformance: string;
  peRatio: string;
  pegRatio?: string;
  sharpeRatio?: string;
  logoUrl?: string;
  shares: number;
  investmentAmount: number;
  portfolioWeight: number;
  score: number;
  isDividendStock: boolean;
  currency?: string;
  fxRate?: string;
  isGrowthStock: boolean;
}

export default function OptimizerResults({ inputs, onBack, onPortfolioSaved, initialStocks, loadedPortfolioId, loadedPortfolioName }: OptimizerResultsProps) {
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
  const [showDiversificationDialog, setShowDiversificationDialog] = useState(false);
  const [hideDiversificationWarning, setHideDiversificationWarning] = useState(() => {
    return localStorage.getItem('hideDivWarning') === 'true';
  });
  
  // Editable portfolio state (separate from optimized suggestion)
  const [editablePositions, setEditablePositions] = useState<OptimizedPosition[] | null>(initialStocks || null);
  
  // Fetch FX rates for currency conversion (MUST be declared before useEffect that uses it)
  const { data: fxRates } = trpc.stocks.getFxRates.useQuery();
  
  // Helper function to get FX rate for a currency
  const getFxRate = (currency: string | undefined): string => {
    if (!currency || currency === 'CHF') return '1.0000';
    if (!fxRates) {
      console.log('[getFxRate] fxRates not loaded yet, returning 1.0000 for', currency);
      return '1.0000';
    }
    
    let rate = '1.0000';
    if (currency === 'USD') rate = fxRates.USDCHF.toFixed(4);
    else if (currency === 'EUR') rate = fxRates.EURCHF.toFixed(4);
    else if (currency === 'GBP') rate = fxRates.GBPCHF.toFixed(4);
    
    console.log(`[getFxRate] ${currency} -> ${rate}`);
    return rate;
  };
  
  // Update initialStocks with current prices when allStocks is loaded
  useEffect(() => {
    if (initialStocks && initialStocks.length > 0 && allStocks.length > 0) {
      console.log('[OptimizerResults] Updating initialStocks with current prices');
      const updatedStocks = initialStocks.map(stock => {
        const currentStock = allStocks.find(s => s.ticker === stock.ticker);
        if (currentStock) {
          return {
            ...stock,
            currentPrice: currentStock.currentPrice || stock.currentPrice,
            currency: currentStock.currency || stock.currency || 'USD',
            fxRate: getFxRate(currentStock.currency || stock.currency),
            dividendYield: currentStock.dividendYield || stock.dividendYield,
            ytdPerformance: currentStock.ytdPerformance || stock.ytdPerformance,
            peRatio: currentStock.peRatio || stock.peRatio,
            pegRatio: currentStock.pegRatio || stock.pegRatio,
            sharpeRatio: currentStock.sharpeRatio || stock.sharpeRatio,
          };
        }
        return stock;
      });
      setEditablePositions(updatedStocks);
    }
  }, [initialStocks, allStocks, fxRates]);
  const [showAddStockDialog, setShowAddStockDialog] = useState(false);
  const [addStockFormData, setAddStockFormData] = useState<any>({});
  const [tickerSearchQuery, setTickerSearchQuery] = useState("");
  const [showTickerSuggestions, setShowTickerSuggestions] = useState(false);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(loadedPortfolioId || null);
  const [loadedPortfolioMetadata, setLoadedPortfolioMetadata] = useState<any>(null);
  const [selectedBenchmark, setSelectedBenchmark] = useState<string>('sp500');
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<string>('ytd');

  // Ticker search query for auto-complete
  const { data: tickerSuggestions = [] } = trpc.stocks.searchTicker.useQuery(
    tickerSearchQuery,
    { enabled: tickerSearchQuery.length >= 2 }
  );

  // Fetch dynamic scores (same as Home page)
  const { data: stockScores = [] } = trpc.score.calculateAll.useQuery();
  
  // Debug: Log fxRates when they change
  useEffect(() => {
    console.log('[FX Rates] Loaded:', fxRates);
  }, [fxRates]);

  // Get tRPC utils for imperative queries
  const utils = trpc.useUtils();

  // Fetch stock data mutation for auto-fill
  const fetchStockDataMutation = trpc.stocks.fetchStockData.useMutation({
    onSuccess: (data: any) => {
      // Calculate YTD Performance if both prices are available
      let ytdPerformance = null;
      if (data.ytdStartPrice && data.currentPrice) {
        const ytdStart = parseFloat(data.ytdStartPrice);
        const current = parseFloat(data.currentPrice);
        if (ytdStart > 0 && current > 0) {
          ytdPerformance = (((current - ytdStart) / ytdStart) * 100).toFixed(2);
        }
      }

      setAddStockFormData((prev: any) => ({
        ...prev,
        companyName: data.companyName || prev.companyName,
        ticker: data.ticker || prev.ticker,
        currency: data.currency || 'USD',
        currentPrice: data.currentPrice?.toString() || prev.currentPrice,
        dividendYield: data.dividendYield?.toString() || prev.dividendYield,
        ytdPerformance: ytdPerformance || prev.ytdPerformance,
      }));
      toast.success("Erfolgreich", { description: "Daten wurden geladen" });
    },
    onError: (error: any) => {
      toast.error("Fehler", { description: error.message || "Daten konnten nicht geladen werden" });
    },
  });

  const saveMutation = trpc.portfolios.create.useMutation({
    onSuccess: () => {
      toast.success('Portfolio erfolgreich gespeichert!');
      setShowSaveDialog(false);
      setPortfolioName('');
      setPortfolioDescription('');
      setSelectedPortfolioId(null); // Clear after saving as new
      onPortfolioSaved?.(); // Notify parent to refresh portfolio list
    },
    onError: (error) => {
      toast.error('Fehler beim Speichern: ' + error.message);
    },
  });

  const updateMutation = trpc.portfolios.update.useMutation({
    onSuccess: (data, variables) => {
      // Only show toast if it's a manual save (from dialog)
      if (!variables || !('isAutoSave' in variables) || !(variables as any).isAutoSave) {
        toast.success('Portfolio erfolgreich aktualisiert!');
        setShowSaveDialog(false);
      } else {
        console.log('[AutoSave] Save successful');
      }
      onPortfolioSaved?.(); // Notify parent to refresh portfolio list
      refetchPortfolios(); // Refresh portfolio list to show updated data
    },
    onError: (error) => {
      console.error('[AutoSave] Save failed:', error.message);
      toast.error('Fehler beim Aktualisieren: ' + error.message);
    },
  });

  const { data: portfolios = [], refetch: refetchPortfolios } = trpc.portfolios.list.useQuery();
  
  // Track if this is the first change to trigger save dialog for new portfolios
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Reset hasUnsavedChanges when a portfolio is loaded
  useEffect(() => {
    if (selectedPortfolioId) {
      console.log('[Portfolio] selectedPortfolioId changed to:', selectedPortfolioId);
      setHasUnsavedChanges(false);
    } else {
      console.log('[Portfolio] selectedPortfolioId is null/undefined');
    }
  }, [selectedPortfolioId]);
  
  const loadMutation = trpc.portfolios.delete.useMutation({
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
    console.log('[OptimizerResults] useMemo triggered');
    console.log('[OptimizerResults] initialStocks:', initialStocks);
    console.log('[OptimizerResults] initialStocks length:', initialStocks?.length);
    
    // If initialStocks provided, skip optimization and use preloaded data
    if (initialStocks && initialStocks.length > 0) {
      console.log('[OptimizerResults] Using initialStocks - skipping optimization');
      const totalInvested = initialStocks.reduce((sum, stock) => sum + stock.investmentAmount, 0);
      const totalShares = initialStocks.reduce((sum, stock) => sum + stock.shares, 0);
      const avgDividendYield = initialStocks.reduce((sum, stock) => sum + parseFloat(stock.dividendYield || '0'), 0) / initialStocks.length;
      const avgYtdPerformance = initialStocks.reduce((sum, stock) => sum + parseFloat(stock.ytdPerformance || '0'), 0) / initialStocks.length;
      
      return {
        positions: initialStocks,
        totalInvested,
        remainingCash: currentInputs.investmentAmount - totalInvested,
        totalShares,
        avgDividendYield,
        avgYtdPerformance
      };
    }
    
    if (!allStocks.length) return { 
      positions: [], 
      totalInvested: 0, 
      remainingCash: currentInputs.investmentAmount, 
      totalShares: 0, 
      avgDividendYield: 0,
      avgYtdPerformance: 0 
    };

    // PRIORITY 3: Enforce CHF 10'000 minimum position size (due to transaction costs)
    const MIN_POSITION_SIZE = 10000; // CHF 10'000 absolute minimum
    
    // Automatically calculate optimal number of positions based on investment amount
    // Each position should be at least CHF 10'000 for cost-efficiency
    const effectiveNumberOfPositions = Math.max(1, Math.floor(currentInputs.investmentAmount / MIN_POSITION_SIZE));
    
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
        currency: stock.currency || 'USD',
        fxRate: getFxRate(stock.currency),
        dividendYield: stock.dividendYield,
        ytdPerformance: stock.ytdPerformance,
        peRatio: stock.peRatio,
        pegRatio: stock.pegRatio,
        sharpeRatio: stock.sharpeRatio,
        logoUrl: stock.logoUrl,
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
  }, [allStocks, adjustedInputs, optimizationStrategy, fxRates]);

  // Show diversification dialog automatically if needed
  useEffect(() => {
    if (!hideDiversificationWarning && optimizedPortfolio) {
      const shouldShow = optimizedPortfolio.positions.length < 10 || 
        (optimizedPortfolio.totalInvested / optimizedPortfolio.positions.length) < 1000;
      if (shouldShow) {
        setShowDiversificationDialog(true);
      }
    }
  }, [optimizedPortfolio, hideDiversificationWarning]);

  // Conflict detection removed - only diversification warning remains

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
      0.05, // 5% max
      (currency) => parseFloat(getFxRate(currency))
    );

    // Build full position objects and filter out 0% positions
    const positions: OptimizedPosition[] = weightedPositions
      .filter(wp => wp.shares > 0 && wp.amount > 0) // Filter out 0% positions
      .map(wp => {
        const stock = selectedStocks.find(s => s.ticker === wp.ticker)!;
        console.log(`[Optimizer] Stock ${stock.ticker}: currency=${stock.currency}, price=${stock.currentPrice}`);
        return {
          ticker: stock.ticker,
          companyName: stock.companyName,
          category: stock.category,
          currentPrice: stock.currentPrice,
          currency: stock.currency || 'USD',
          fxRate: getFxRate(stock.currency),
          dividendYield: stock.dividendYield,
          ytdPerformance: stock.ytdPerformance,
          peRatio: stock.peRatio,
          pegRatio: stock.pegRatio,
          sharpeRatio: stock.sharpeRatio,
          logoUrl: stock.logoUrl,
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
    doc.text(`Anlagebetrag: CHF ${currentInputs.investmentAmount?.toLocaleString('de-CH') || '0'}`, 14, 30);
    doc.text(`Erwartete Dividendenrendite: ${currentInputs.expectedDividendYield}%`, 14, 36);
    doc.text(`Anzahl Positionen: ${currentInputs.numberOfPositions}`, 14, 42);
    doc.text(`Anlegertyp: ${currentInputs.investorType === 'conservative' ? 'Konservativ' : currentInputs.investorType === 'balanced' ? 'Ausgewogen' : 'Dynamisch'}`, 14, 48);
    
    const tableData = optimizedPortfolio.positions.map((pos) => [
      pos.ticker,
      pos.companyName,
      pos.shares.toString(),
      `CHF ${parseFloat(pos.currentPrice || '0').toFixed(2)}`,
      `CHF ${(pos.investmentAmount || 0).toFixed(2)}`,
      `${(pos.portfolioWeight || 0).toFixed(2)}%`,
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

  // Use editable positions if available, otherwise use optimized portfolio
  const displayPortfolio = useMemo(() => {
    if (!editablePositions) return optimizedPortfolio;
    
    // ALWAYS recalculate from editablePositions (ignore cached metadata)
    const totalInvested = editablePositions.reduce((sum, p) => sum + (p.investmentAmount || 0), 0);
    const avgDividendYield = editablePositions.length > 0 && totalInvested > 0
      ? editablePositions.reduce((sum, p) => {
          const divYield = parseFloat(p.dividendYield || '0');
          return sum + (divYield * p.investmentAmount);
        }, 0) / totalInvested
      : 0;
    const avgYtdPerformance = editablePositions.length > 0 && totalInvested > 0
      ? editablePositions.reduce((sum, p) => {
          const ytdPerf = parseFloat(p.ytdPerformance || '0');
          return sum + (ytdPerf * p.investmentAmount);
        }, 0) / totalInvested
      : 0;
    
    // Calculate portfolio weights based on total including cash
    const remainingCash = Math.max(0, currentInputs.investmentAmount - totalInvested);
    const grandTotal = totalInvested + remainingCash;
    
    const positionsWithCorrectWeights = editablePositions.map(p => {
      const newWeight = grandTotal > 0 ? (p.investmentAmount / grandTotal) * 100 : 0;
      console.log(`[DisplayPortfolio] ${p.ticker}: investmentAmount=${p.investmentAmount}, grandTotal=${grandTotal}, newWeight=${newWeight.toFixed(2)}%`);
      return {
        ...p,
        portfolioWeight: newWeight
      };
    });
    
    return {
      positions: positionsWithCorrectWeights,
      totalInvested,
      remainingCash,
      totalShares: positionsWithCorrectWeights.reduce((sum, p) => sum + p.shares, 0),
      avgDividendYield,
      avgYtdPerformance,
    };
  }, [editablePositions, currentInputs.investmentAmount, optimizedPortfolio]);
  
  // Initialize editable positions from optimized portfolio on first render
  useEffect(() => {
    if (!editablePositions && optimizedPortfolio.positions.length > 0) {
      console.log('[useEffect] Setting editablePositions from optimizedPortfolio');
      console.log('[useEffect] First position currency:', optimizedPortfolio.positions[0]?.currency);
      setEditablePositions([...optimizedPortfolio.positions]);
    }
  }, [optimizedPortfolio.positions, editablePositions]);
  
  // Auto-save when editablePositions changes (ONLY for loaded portfolios)
  useEffect(() => {
    console.log('[AutoSave] useEffect triggered, selectedPortfolioId:', selectedPortfolioId, 'editablePositions:', editablePositions?.length);
    
    // Only auto-save if a portfolio is loaded
    if (!selectedPortfolioId || !editablePositions || editablePositions.length === 0) {
      console.log('[AutoSave] Skipping - no portfolio loaded or no positions');
      return;
    }
    
    console.log('[AutoSave] Starting debounce timer...');
    
    // Debounce auto-save by 1 second to avoid too frequent saves
    const timeoutId = setTimeout(() => {
      const portfolioDataObj = {
        inputs: currentInputs,
        stocks: editablePositions.map(pos => ({
          ticker: pos.ticker,
          companyName: pos.companyName,
          category: pos.category,
          currency: pos.currency,
          fxRate: pos.fxRate,
          currentPrice: pos.currentPrice,
          dividendYield: pos.dividendYield,
          ytdPerformance: pos.ytdPerformance,
          peRatio: pos.peRatio,
          pegRatio: pos.pegRatio,
          sharpeRatio: pos.sharpeRatio,
          logoUrl: pos.logoUrl,
          shares: pos.shares,
          investmentAmount: pos.investmentAmount,
          portfolioWeight: pos.portfolioWeight,
          score: pos.score,
          isDividendStock: pos.isDividendStock,
          isGrowthStock: pos.isGrowthStock,
        })),
        totalInvested: editablePositions.reduce((sum, p) => sum + (p.investmentAmount || 0), 0),
        numberOfPositions: editablePositions.length,
        avgDividendYield: editablePositions.length > 0
          ? editablePositions.reduce((sum, p) => sum + parseFloat(p.dividendYield || '0'), 0) / editablePositions.length
          : 0,
        avgYtdPerformance: editablePositions.length > 0
          ? editablePositions.reduce((sum, p) => sum + parseFloat(p.ytdPerformance || '0'), 0) / editablePositions.length
          : 0,
      };
      
      // Find the current portfolio to get its name
      const currentPortfolio = portfolios.find(p => p.id.toString() === selectedPortfolioId);
      if (currentPortfolio) {
        console.log('[AutoSave] Saving portfolio:', currentPortfolio.name, 'ID:', selectedPortfolioId);
        console.log('[AutoSave] Total positions:', editablePositions.length);
        console.log('[AutoSave] Total invested:', portfolioDataObj.totalInvested);
        updateMutation.mutate({
          id: parseInt(selectedPortfolioId),
          name: currentPortfolio.name,
          description: currentPortfolio.description || '',
          portfolioData: JSON.stringify(portfolioDataObj),
          // Note: isAutoSave is handled client-side only
        });
      } else {
        console.warn('[AutoSave] Portfolio not found in portfolios, ID:', selectedPortfolioId);
      }
    }, 1000); // 1 second debounce
    
    return () => clearTimeout(timeoutId);
  }, [editablePositions, selectedPortfolioId, currentInputs]);

  // Calculate composition for display portfolio
  // Calculate composition amounts (ETFs are exclusive, not counted in dividend/growth)
  const etfAmount = displayPortfolio.positions
    .filter((p: any) => p.category === 'ETF')
    .reduce((sum, p) => sum + p.investmentAmount, 0);
  const dividendAmount = displayPortfolio.positions
    .filter((p: any) => p.isDividendStock && p.category !== 'ETF')
    .reduce((sum, p) => sum + p.investmentAmount, 0);
  const growthAmount = displayPortfolio.positions
    .filter((p: any) => !p.isDividendStock && p.category !== 'ETF')
    .reduce((sum, p) => sum + p.investmentAmount, 0);
  
  // Use TOTAL including cash as base (100%)
  const totalInvestedAmount = displayPortfolio.totalInvested;
  const remainingCashAmount = Math.max(0, displayPortfolio.remainingCash); // No negative cash
  const grandTotal = totalInvestedAmount + remainingCashAmount;
  
  // Calculate percentages based on TOTAL including cash
  const dividendPercent = grandTotal > 0 ? (dividendAmount / grandTotal) * 100 : 0;
  const growthPercent = grandTotal > 0 ? (growthAmount / grandTotal) * 100 : 0;
  const etfPercent = grandTotal > 0 ? (etfAmount / grandTotal) * 100 : 0;
  const cashPercent = grandTotal > 0 ? (remainingCashAmount / grandTotal) * 100 : 0;

  // Prepare data for performance chart
  const tickers = displayPortfolio.positions.map(p => p.ticker);
  const weights = displayPortfolio.positions.map(p => p.portfolioWeight / 100);

  // Convert time period to years
  const timePeriodToYears = (period: string) => {
    switch (period) {
      case '1m': return 1/12;  // 1 month
      case '3m': return 3/12;  // 3 months
      case '6m': return 6/12;  // 6 months
      case 'ytd': {
        // Calculate months from start of year to now
        const now = new Date();
        const monthsSinceYearStart = now.getMonth() + 1; // +1 because getMonth() is 0-indexed
        const dayOfMonth = now.getDate();
        // Add fractional month based on day of month
        return (monthsSinceYearStart + (dayOfMonth / 30)) / 12;
      }
      case '1y': return 1;
      case '3y': return 3;
      case '5y': return 5;
      default: return 5;
    }
  };

  // Fetch portfolio historical data
  const { data: portfolioData, isLoading: isLoadingPortfolio } = trpc.portfolioPerformance.getHistoricalData.useQuery(
    { 
      tickers, 
      weights, 
      years: timePeriodToYears(selectedTimePeriod),
      ytd: selectedTimePeriod === 'ytd'
    },
    { enabled: tickers.length > 0 && weights.length > 0 }
  );

  // Fetch benchmark data
  const { data: benchmarkData, isLoading: isLoadingBenchmark } = trpc.portfolioPerformance.getBenchmarkData.useQuery(
    { 
      benchmark: selectedBenchmark, 
      years: timePeriodToYears(selectedTimePeriod),
      ytd: selectedTimePeriod === 'ytd'
    },
    { enabled: !!selectedBenchmark }
  );

  // Combine portfolio and benchmark data for chart
  const chartData = useMemo(() => {
    if (!portfolioData || !portfolioData.dates || portfolioData.dates.length === 0) return [];
    if (!benchmarkData || !benchmarkData.dates || benchmarkData.dates.length === 0) return [];
    
    // Find common dates between portfolio and benchmark
    const commonDates = portfolioData.dates.filter(date => benchmarkData.dates.includes(date));
    
    if (commonDates.length === 0) return [];
    
    // Filter dates by selected time period
    const now = new Date();
    let filteredDates = commonDates;
    
    switch (selectedTimePeriod) {
      case '1m':
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - 1);
        filteredDates = commonDates.filter(d => new Date(d) >= oneMonthAgo);
        break;
      case '3m':
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        filteredDates = commonDates.filter(d => new Date(d) >= threeMonthsAgo);
        break;
      case '6m':
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(now.getMonth() - 6);
        filteredDates = commonDates.filter(d => new Date(d) >= sixMonthsAgo);
        break;
      case 'ytd':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        filteredDates = commonDates.filter(d => new Date(d) >= yearStart);
        break;
      case '1y':
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - 1);
        filteredDates = commonDates.filter(d => new Date(d) >= oneYearAgo);
        break;
      case '3y':
        const threeYearsAgo = new Date(now);
        threeYearsAgo.setFullYear(now.getFullYear() - 3);
        filteredDates = commonDates.filter(d => new Date(d) >= threeYearsAgo);
        break;
      case '5y':
        const fiveYearsAgo = new Date(now);
        fiveYearsAgo.setFullYear(now.getFullYear() - 5);
        filteredDates = commonDates.filter(d => new Date(d) >= fiveYearsAgo);
        break;
      default:
        filteredDates = commonDates;
    }
    
    if (filteredDates.length === 0) return [];
    
    // Get values for filtered dates
    const portfolioValues = filteredDates.map(date => {
      const index = portfolioData.dates.indexOf(date);
      return portfolioData.values[index] || 0;
    });
    
    const benchmarkValues = filteredDates.map(date => {
      const index = benchmarkData.dates.indexOf(date);
      return benchmarkData.values[index] || 0;
    });
    
    // Normalize both to start at 0% (relative to first filtered date)
    const portfolioStart = portfolioValues[0];
    const benchmarkStart = benchmarkValues[0];
    
    return filteredDates.map((date, index) => ({
      date,
      portfolio: portfolioValues[index] - portfolioStart,
      benchmark: benchmarkValues[index] - benchmarkStart,
    }));
  }, [portfolioData, benchmarkData, selectedTimePeriod]);

  const benchmarkOptions = [
    { value: 'sp500', label: 'S&P 500' },
    { value: 'nasdaq', label: 'Nasdaq' },
    { value: 'smi', label: 'SMI' },
    { value: 'msci_world', label: 'MSCI World' },
    { value: 'eurostoxx', label: 'Eurostoxx' },
  ];

  return (
    <div className="container mx-auto px-4 space-y-4">
      {/* Conflict Resolution Dialog - REMOVED (only diversification warning remains) */}

      {/* Portfolio Adjustment Dialog */}
      <PortfolioAdjustmentDialog
        open={showAdjustmentDialog}
        onClose={() => setShowAdjustmentDialog(false)}
        currentInputs={adjustedInputs}
        onAdjust={(newInputs) => {
          setAdjustedInputs(newInputs);
          
          // If only investment amount changed, keep current positions and scale proportionally
          if (editablePositions && 
              newInputs.investmentAmount !== adjustedInputs.investmentAmount &&
              newInputs.expectedDividendYield === adjustedInputs.expectedDividendYield &&
              newInputs.numberOfPositions === adjustedInputs.numberOfPositions &&
              newInputs.investorType === adjustedInputs.investorType) {
            
            // Calculate scaling factor
            const currentTotal = editablePositions.reduce((sum, p) => sum + (p.investmentAmount || 0), 0);
            const scaleFactor = newInputs.investmentAmount / currentTotal;
            
            // Scale all positions proportionally
            const scaledPositions = editablePositions.map(p => {
              const newInvestmentAmount = (p.investmentAmount || 0) * scaleFactor;
              const currentPrice = parseFloat(p.currentPrice || '0');
              const fxRate = parseFloat(p.fxRate || '1');
              const newShares = Math.floor(newInvestmentAmount / (currentPrice * fxRate));
              
              return {
                ...p,
                shares: newShares,
                investmentAmount: newShares * currentPrice * fxRate,
              };
            });
            
            setEditablePositions(scaledPositions);
            console.log('[Adjust] Scaled positions proportionally, factor:', scaleFactor.toFixed(2));
          } else {
            // Other parameters changed, reset to new optimization
            setEditablePositions(null);
            setLoadedPortfolioMetadata(null);
            console.log('[Adjust] Parameters changed, resetting to new optimization');
          }
          
          setShowAdjustmentDialog(false);
        }}
      />

      {/* Minimum Investment Warning removed - new priority logic implemented */}



      {/* ETF Recommendation Warning - Show dialog on first view */}
      {!hideDiversificationWarning && (displayPortfolio.positions.length < 10 || 
        (displayPortfolio.totalInvested / displayPortfolio.positions.length) < 1000) && (
        <Dialog open={showDiversificationDialog} onOpenChange={setShowDiversificationDialog}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-amber-400 flex items-center gap-2">
                <span className="text-2xl">⚠️</span>
                Mangelnde Diversifikation
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-slate-300 text-sm">
                {displayPortfolio.positions.length < 10 && (
                  <span>Ihr Portfolio enthält nur <strong>{displayPortfolio.positions.length} Positionen</strong>. </span>
                )}
                {(displayPortfolio.totalInvested / displayPortfolio.positions.length) < 1000 && (
                  <span>Die durchschnittliche Positionsgröße beträgt nur <strong>CHF {Math.round(displayPortfolio.totalInvested / displayPortfolio.positions.length)?.toLocaleString('de-CH') || '0'}</strong>. </span>
                )}
              </p>
              <p className="text-slate-300 text-sm">
                💡 <strong>Empfehlung:</strong> Für bessere Diversifikation und geringere Transaktionskosten empfehlen wir den Einsatz von ETFs (Exchange Traded Funds).
              </p>
              <p className="text-slate-300 text-sm">
                <strong>Tipp:</strong> Erhöhen Sie den Investitionsbetrag oder reduzieren Sie die Anzahl der Positionen für größere Einzelpositionen.
              </p>
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setShowDiversificationDialog(false)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  OK
                </Button>
                <Button
                  onClick={() => {
                    localStorage.setItem('hideDivWarning', 'true');
                    setHideDiversificationWarning(true);
                    setShowDiversificationDialog(false);
                  }}
                  variant="outline"
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Nicht mehr anzeigen
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dividend Yield Warning - REMOVED per user request */}

      {/* Compact Portfolio Header */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Portfolio Selector */}
            <div className="space-y-2">
              <h3 className="text-slate-300 text-base font-bold">Portfolio-Auswahl</h3>
              <Select
                value={selectedPortfolioId || ""}
                onValueChange={async (value) => {
                  if (value === "current") {
                    setSelectedPortfolioId(null);
                    setEditablePositions(null);
                    toast.info('Aktuelles optimiertes Portfolio angezeigt');
                  } else {
                    const portfolio = portfolios.find((p: any) => p.id.toString() === value);
                    if (portfolio) {
                      try {
                        const data = JSON.parse(portfolio.portfolioData);
                        if (data.stocks && Array.isArray(data.stocks)) {
                          // Fetch full stock data from database for enrichment
                          const tickers = data.stocks.map((s: any) => s.ticker).filter(Boolean);
                          const stocksDataResult = await utils.stocks.getByTickers.fetch({ tickers });
                          const stocksMap = new Map(stocksDataResult.map(s => [s.ticker, s]));
                          
                          // Enrich loaded stocks with database data
                          const enrichedStocks = data.stocks.map((stock: any) => {
                            const dbStock = stocksMap.get(stock.ticker);
                            const divYieldRaw = dbStock?.dividendYield || stock.dividendYield || '0';
                            const divYield = typeof divYieldRaw === 'string' ? parseFloat(divYieldRaw) : divYieldRaw;
                            return {
                              ticker: stock.ticker,
                              companyName: stock.companyName || dbStock?.companyName || '',
                              shares: stock.shares || 0,
                              investmentAmount: stock.investmentAmount || 0,
                              portfolioWeight: stock.portfolioWeight || 0,
                              currentPrice: dbStock?.currentPrice || stock.currentPrice || 0,
                              logoUrl: dbStock?.logoUrl || stock.logoUrl || '',
                              dividendYield: divYield,
                              ytdPerformance: dbStock?.ytdPerformance || stock.ytdPerformance || 0,
                              peRatio: dbStock?.peRatio || stock.peRatio || null,
                              pegRatio: dbStock?.pegRatio || stock.pegRatio || null,
                              sharpeRatio: dbStock?.sharpeRatio || stock.sharpeRatio || null,
                              score: dbStock?.score || stock.score || 0,
                              category: dbStock?.category || stock.category || '',
                              currency: dbStock?.currency || stock.currency || 'CHF',
                              isDividendStock: divYield >= 2.5,
                              isGrowthStock: (dbStock?.ytdPerformance ? parseFloat(dbStock.ytdPerformance) > 10 : false) || ["Technology", "E-Commerce", "Fintech", "Biotech"].includes(dbStock?.category || stock.category || '')
                            };
                          });
                          
                          // ALWAYS normalize weights to 100%
                          const totalWeight = enrichedStocks.reduce((sum, s) => sum + s.portfolioWeight, 0);
                          if (totalWeight > 0) {
                            enrichedStocks.forEach(s => {
                              s.portfolioWeight = (s.portfolioWeight / totalWeight) * 100;
                            });
                            const newTotal = enrichedStocks.reduce((sum, s) => sum + s.portfolioWeight, 0);
                          }
                          
                          setEditablePositions(enrichedStocks);
                          setLoadedPortfolioMetadata({
                            totalInvested: data.totalInvested,
                            avgDividendYield: data.avgDividendYield,
                            avgYtdPerformance: data.avgYtdPerformance,
                          });
                          setSelectedPortfolioId(value);
                          toast.success(`Portfolio "${portfolio.name}" geladen!`);
                        } else {
                          toast.error('Portfolio-Daten haben ungültiges Format');
                        }
                      } catch (error) {
                        console.error('[Portfolio Load] Error:', error);
                        console.error('[Portfolio Load] Portfolio data:', portfolio.portfolioData);
                        toast.error(`Portfolio konnte nicht geladen werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
                      }
                    }
                  }
                }}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white h-9">
                  <SelectValue placeholder="Portfolio wählen..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="current" className="text-white hover:bg-slate-600">
                    🎯 Aktuelles Portfolio
                  </SelectItem>
                  {portfolios.map((portfolio: any) => (
                    <SelectItem 
                      key={portfolio.id} 
                      value={portfolio.id.toString()}
                      className="text-white hover:bg-slate-600"
                    >
                      {portfolio.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Middle: Composition */}
            <div className="space-y-2">
              <h3 className="text-slate-300 text-base font-bold">Zusammensetzung</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900 p-2 rounded text-center">
                  <p className="text-xs text-slate-400">Dividenden</p>
                  <p className="text-sm font-bold text-blue-400">{(dividendPercent || 0).toFixed(1)}%</p>
                </div>
                <div className="bg-slate-900 p-2 rounded text-center">
                  <p className="text-xs text-slate-400">Wachstum</p>
                  <p className="text-sm font-bold text-green-400">{(growthPercent || 0).toFixed(1)}%</p>
                </div>
                <div className="bg-slate-900 p-2 rounded text-center">
                  <p className="text-xs text-slate-400">Cash</p>
                  <p className="text-sm font-bold text-yellow-400">{(cashPercent || 0).toFixed(1)}%</p>
                </div>
                <div className="bg-slate-900 p-2 rounded text-center">
                  <p className="text-xs text-slate-400">ETF</p>
                  <p className="text-sm font-bold text-purple-400">{(etfPercent || 0).toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* Right: Stats */}
            <div className="space-y-2">
              <h3 className="text-slate-300 text-base font-bold">Performance & Kennzahlen</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900 p-2 rounded">
                  <p className="text-xs text-slate-400">Investiert</p>
                  <p className="text-sm font-bold text-white">
                    CHF {(displayPortfolio.totalInvested || 0).toLocaleString('de-CH', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-slate-900 p-2 rounded">
                  <p className="text-xs text-slate-400">Positionen</p>
                  <p className="text-sm font-bold text-white">{displayPortfolio.positions.length}</p>
                </div>
                <div className="bg-slate-900 p-2 rounded">
                  <p className="text-xs text-slate-400">Ø Dividende</p>
                  <p className="text-sm font-bold text-white">{(displayPortfolio.avgDividendYield || 0).toFixed(2)}%</p>
                </div>
                <div className="bg-slate-900 p-2 rounded">
                  <p className="text-xs text-slate-400">Ø YTD Perf</p>
                  <p className={`text-sm font-bold ${
                    (displayPortfolio.avgYtdPerformance || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {(displayPortfolio.avgYtdPerformance || 0) >= 0 ? '+' : ''}{(displayPortfolio.avgYtdPerformance || 0).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>



      {/* Performance Chart */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-white">Portfolio Performance</CardTitle>
            <div className="flex gap-4 items-center flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-400">Zeitraum:</label>
                <Select value={selectedTimePeriod} onValueChange={setSelectedTimePeriod}>
                  <SelectTrigger className="w-28 bg-slate-700 border-slate-600 text-white h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="1m" className="text-white hover:bg-slate-600">1 Monat</SelectItem>
                    <SelectItem value="3m" className="text-white hover:bg-slate-600">3 Monate</SelectItem>
                    <SelectItem value="6m" className="text-white hover:bg-slate-600">6 Monate</SelectItem>
                    <SelectItem value="ytd" className="text-white hover:bg-slate-600">YTD</SelectItem>
                    <SelectItem value="1y" className="text-white hover:bg-slate-600">1 Jahr</SelectItem>
                    <SelectItem value="3y" className="text-white hover:bg-slate-600">3 Jahre</SelectItem>
                    <SelectItem value="5y" className="text-white hover:bg-slate-600">5 Jahre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-400">Benchmark:</label>
                <Select value={selectedBenchmark} onValueChange={setSelectedBenchmark}>
                  <SelectTrigger className="w-40 bg-slate-700 border-slate-600 text-white h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {benchmarkOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="text-white hover:bg-slate-600">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingPortfolio || isLoadingBenchmark ? (
            <div className="h-96 flex items-center justify-center text-slate-400">
              <p>Lade Daten...</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-96 flex items-center justify-center text-slate-400">
              <p>Keine historischen Daten verfügbar</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8"
                  tick={{ fill: '#94a3b8' }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getFullYear().toString().slice(-2)}`;
                  }}
                />
                <YAxis 
                  stroke="#94a3b8"
                  tick={{ fill: '#94a3b8' }}
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '6px' }}
                  labelStyle={{ color: '#94a3b8' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value: any) => `${value.toFixed(2)}%`}
                  labelFormatter={(label) => {
                    const date = new Date(label);
                    return date.toLocaleDateString('de-DE');
                  }}
                />
                <Legend 
                  wrapperStyle={{ color: '#94a3b8' }}
                  formatter={(value) => {
                    if (value === 'portfolio') {
                      const portfolioName = selectedPortfolioId 
                        ? portfolios.find(p => p.id.toString() === selectedPortfolioId)?.name
                        : null;
                      return portfolioName || 'Portfolio';
                    }
                    return benchmarkOptions.find(b => b.value === selectedBenchmark)?.label || 'Benchmark';
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="portfolio" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={false}
                  name="portfolio"
                />
                <Line 
                  type="monotone" 
                  dataKey="benchmark" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  dot={false}
                  name="benchmark"
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Portfolio Table */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-white">
            {selectedPortfolioId 
              ? portfolios.find(p => p.id.toString() === selectedPortfolioId)?.name || 'Optimiertes Portfolio'
              : 'Optimiertes Portfolio'
            }
          </CardTitle>
          <div className="flex gap-2 items-center flex-wrap">
            {portfolios && portfolios.length > 0 && (
              <Select
                value={selectedPortfolioId || ""}
                onValueChange={async (value) => {
                  console.log('[Portfolio Load] Starting load, value:', value);
                  const portfolio = portfolios.find(p => p.id.toString() === value);
                  if (portfolio) {
                    console.log('[Portfolio Load] Found portfolio:', portfolio.name, 'ID:', value);
                    setSelectedPortfolioId(value);
                    console.log('[Portfolio Load] setSelectedPortfolioId called with:', value);
                    // Load the selected portfolio with enrichment
                    try {
                      const data = JSON.parse(portfolio.portfolioData);
                      if (data.stocks && Array.isArray(data.stocks)) {
                        // Fetch full stock data from database
                        const tickers = data.stocks.map((s: any) => s.ticker).filter(Boolean);
                        const stocksDataResult = await utils.stocks.getByTickers.fetch({ tickers });
                        
                        // Ensure stocksDataResult is an array
                        if (!Array.isArray(stocksDataResult)) {
                          console.error('[Portfolio Load] stocksDataResult is not an array:', stocksDataResult);
                          toast.error('Portfolio konnte nicht geladen werden: Ungültige Daten');
                          return;
                        }
                        
                        const stocksMap = new Map(stocksDataResult.map(s => [s.ticker, s]));
                        
                        // Enrich loaded stocks
                        const enrichedStocks = data.stocks.map((stock: any) => {
                          const dbStock = stocksMap.get(stock.ticker);
                          const divYieldRaw = dbStock?.dividendYield || stock.dividendYield || '0';
                          const divYield = typeof divYieldRaw === 'string' ? parseFloat(divYieldRaw) : divYieldRaw;
                          return {
                            ticker: stock.ticker,
                            companyName: stock.companyName || dbStock?.companyName || '',
                            shares: stock.shares || 0,
                            investmentAmount: stock.investmentAmount || 0,
                            portfolioWeight: stock.portfolioWeight || 0,
                            currentPrice: dbStock?.currentPrice || stock.currentPrice || 0,
                            logoUrl: dbStock?.logoUrl || stock.logoUrl || '',
                            dividendYield: divYield,
                            ytdPerformance: dbStock?.ytdPerformance || stock.ytdPerformance || 0,
                            peRatio: dbStock?.peRatio || stock.peRatio || null,
                            pegRatio: dbStock?.pegRatio || stock.pegRatio || null,
                            sharpeRatio: dbStock?.sharpeRatio || stock.sharpeRatio || null,
                            score: dbStock?.score || stock.score || 0,
                            category: dbStock?.category || stock.category || '',
                            currency: dbStock?.currency || stock.currency || 'CHF',
                            isDividendStock: divYield >= 2.5,
                            isGrowthStock: (dbStock?.ytdPerformance ? parseFloat(dbStock.ytdPerformance) > 10 : false) || ["Technology", "E-Commerce", "Fintech", "Biotech"].includes(dbStock?.category || stock.category || '')
                          };
                        });
                        
                        // ALWAYS normalize weights to 100%
                        const totalWeight = enrichedStocks.reduce((sum, s) => sum + s.portfolioWeight, 0);
                        if (totalWeight > 0) {
                          enrichedStocks.forEach(s => {
                            s.portfolioWeight = (s.portfolioWeight / totalWeight) * 100;
                          });
                        }
                        
                        console.log('[Portfolio Load] About to setEditablePositions with', enrichedStocks.length, 'positions');
                        console.log('[Portfolio Load] First position:', enrichedStocks[0]?.ticker, enrichedStocks[0]?.investmentAmount);
                        console.log('[Portfolio Load] Total invested:', enrichedStocks.reduce((sum, s) => sum + s.investmentAmount, 0));
                        setEditablePositions(enrichedStocks);
                        setLoadedPortfolioMetadata({
                          totalInvested: data.totalInvested,
                          avgDividendYield: data.avgDividendYield,
                          avgYtdPerformance: data.avgYtdPerformance,
                        });
                        console.log('[Portfolio Load] Successfully loaded', enrichedStocks.length, 'positions');
                        console.log('[Portfolio Load] selectedPortfolioId should now be:', value);
                        toast.success(`Portfolio "${portfolio.name}" geladen!`);
                      } else {
                        toast.error('Portfolio-Daten haben ungültiges Format');
                      }
                      } catch (error) {
                        console.error('[Portfolio Load 2] Error:', error);
                        console.error('[Portfolio Load 2] Portfolio data:', portfolio.portfolioData);
                        toast.error(`Portfolio konnte nicht geladen werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
                      }
                  }
                }}
              >
                <SelectTrigger className="w-[200px] bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Portfolio wählen..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {portfolios.map((portfolio) => (
                    <SelectItem 
                      key={portfolio.id} 
                      value={portfolio.id.toString()}
                      className="text-white hover:bg-slate-700"
                    >
                      {portfolio.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={onBack} variant="outline" className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück
            </Button>
            <Button onClick={() => setShowSaveDialog(true)} className="bg-green-600 hover:bg-green-700 text-white">
              <Save className="w-4 h-4 mr-2" />
              Speichern
            </Button>

            <Button 
              onClick={() => setShowAddStockDialog(true)} 
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Aktie hinzufügen
            </Button>
            <Button onClick={() => setShowAdjustmentDialog(true)} variant="outline" className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600">
              Portfolio anpassen
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
                <tr className="border-b border-slate-600 bg-slate-700/30">
                  <th className="text-left p-2 text-slate-300 font-semibold text-xs">Logo</th>
                  <th className="text-left p-2 text-slate-300 font-semibold text-xs">Ticker</th>
                  <th className="text-left p-2 text-slate-300 font-semibold text-xs">Unternehmen</th>
                  <th className="text-left p-2 text-slate-300 font-semibold text-xs">Kategorie</th>
                  <th className="text-right p-2 text-slate-300 font-semibold text-xs">Stück</th>
                  <th className="text-right p-2 text-slate-300 font-semibold text-xs">Kurs FW</th>
                  <th className="text-right p-2 text-slate-300 font-semibold text-xs">Betrag FW</th>
                  <th className="text-right p-2 text-slate-300 font-semibold text-xs">FX</th>
                  <th className="text-right p-2 text-slate-300 font-semibold text-xs">Betrag CHF</th>
                  <th className="text-right p-2 text-slate-300 font-semibold text-xs">Gewicht</th>
                  <th className="text-right p-2 text-slate-300 font-semibold text-xs">Div. %</th>
                  <th className="text-right p-2 text-slate-300 font-semibold text-xs">YTD %</th>
                  <th className="text-right p-2 text-slate-300 font-semibold text-xs">P/E</th>
                  <th className="text-right p-2 text-slate-300 font-semibold text-xs">PEG</th>
                  <th className="text-right p-2 text-slate-300 font-semibold text-xs">Sharpe</th>
                  <th className="text-center p-2 text-slate-300 font-semibold text-xs">Score</th>
                  <th className="text-center p-2 text-slate-300 font-semibold text-xs">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {displayPortfolio.positions
                  .sort((a, b) => {
                    // ETFs go to bottom
                    if (a.category === 'ETF' && b.category !== 'ETF') return 1;
                    if (a.category !== 'ETF' && b.category === 'ETF') return -1;
                    return 0;
                  })
                  .map((pos) => (
                  <tr key={pos.ticker} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="p-2">
                      {pos.logoUrl ? (
                        <img 
                          src={pos.logoUrl} 
                          alt={pos.ticker}
                          className="w-10 h-10 rounded object-contain bg-white p-1"
                          onError={(e) => {
                            // Fallback to placeholder if image fails to load
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div 
                        className={`w-10 h-10 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-lg ${pos.logoUrl ? 'hidden' : ''}`}
                      >
                        {pos.ticker.substring(0, 2)}
                      </div>
                    </td>
                    <td className="p-2 text-blue-400 font-semibold">{pos.ticker}</td>
                    <td className="p-2 text-white">{pos.companyName}</td>
                    <td className="p-2 text-slate-300">{pos.category}</td>
                    <td className="p-2 text-right text-white font-medium">{pos.shares}</td>
                    <td className="p-2 text-right text-slate-300">
                      {pos.currency || 'CHF'} {parseFloat(pos.currentPrice || '0').toFixed(2)}
                    </td>
                    <td className="p-2 text-right text-slate-300">
                      {pos.currency || 'CHF'} {(pos.shares * parseFloat(pos.currentPrice || '0')).toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 text-right text-slate-300">
                      {pos.fxRate || '1.0000'}
                    </td>
                    <td className="p-2 text-right text-white font-semibold">
                       CHF {pos.investmentAmount?.toLocaleString('de-CH', { minimumFractionDigits: 2 }) || '0.00'}
                    </td>
                    <td className="p-2 text-right text-slate-300">
                      {(pos.portfolioWeight || 0).toFixed(2)}%
                    </td>
                    <td className="p-2 text-right text-green-400">
                      {parseFloat(pos.dividendYield || '0').toFixed(1)}%
                    </td>
                    <td className={`p-2 text-right font-medium ${
                      parseFloat(pos.ytdPerformance) >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {parseFloat(pos.ytdPerformance) >= 0 ? '+' : ''}{pos.ytdPerformance}%
                    </td>
                    <td className="p-2 text-right text-slate-300">
                      {pos.peRatio ? parseFloat(pos.peRatio).toFixed(1) : '-'}
                    </td>
                    <td className="p-2 text-right text-slate-300">
                      {pos.pegRatio ? parseFloat(pos.pegRatio).toFixed(1) : '-'}
                    </td>
                    <td className={`p-2 text-right font-medium ${
                      parseFloat(pos.sharpeRatio || '0') >= 1 ? 'text-green-400' : 
                      parseFloat(pos.sharpeRatio || '0') >= 0 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {pos.sharpeRatio ? parseFloat(pos.sharpeRatio).toFixed(1) : '-'}
                    </td>
                    <td className="p-2 text-center">
                      {(() => {
                        // Use dynamic score from stockScores query (same as Home page)
                        const scoreData = stockScores.find((s: any) => s.ticker === pos.ticker);
                        const scoreValue = scoreData?.totalScore || 0;
                        if (scoreValue === 0) return <span className="text-slate-500">-</span>;
                        
                        // Color based on score value
                        let bgColor = 'bg-slate-500';
                        if (scoreValue >= 70) bgColor = 'bg-amber-500';
                        else if (scoreValue >= 50) bgColor = 'bg-amber-500';
                        else if (scoreValue >= 30) bgColor = 'bg-orange-500';
                        else bgColor = 'bg-red-500';
                        
                        return (
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm text-white ${bgColor}`}>
                            {Math.round(scoreValue)}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="p-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const updatedPositions = editablePositions.filter(p => p.ticker !== pos.ticker);
                          setEditablePositions(updatedPositions);
                          
                          toast.success(`${pos.ticker} wurde entfernt`);
                        }}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {displayPortfolio.remainingCash > 0 && (
                  <tr key="cash" className="border-b border-slate-700 bg-slate-800/50">
                    <td className="p-3">
                      <div className="w-8 h-8 rounded bg-green-600 flex items-center justify-center text-xs text-white font-bold">$</div>
                    </td>
                    <td className="p-3 text-blue-400 font-medium">CASH</td>
                    <td className="p-3 text-white">Cash Position</td>
                    <td className="p-3 text-slate-300">Liquidität</td>
                    <td className="p-3 text-right text-white font-medium">-</td>
                    <td className="p-3 text-right text-slate-300">-</td>
                    <td className="p-3 text-right text-slate-300">-</td>
                    <td className="p-3 text-right text-slate-300">-</td>
                    <td className="p-3 text-right text-white font-medium">
                      CHF {displayPortfolio.remainingCash?.toLocaleString('de-CH', { minimumFractionDigits: 2 }) || '0.00'}
                    </td>
                    <td className="p-3 text-right text-slate-300">{cashPercent.toFixed(2)}%</td>
                    <td className="p-3 text-right text-slate-400">-</td>
                    <td className="p-3 text-right text-slate-400">-</td>
                    <td className="p-3 text-right text-slate-400">-</td>
                    <td className="p-3 text-right text-slate-400">-</td>
                    <td className="p-3 text-right text-slate-400">-</td>
                    <td className="p-3 text-center"><span className="text-slate-500">-</span></td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                {displayPortfolio.remainingCash > 0 && (
                  <tr className="border-t border-slate-700">
                    <td colSpan={2} className="p-3 text-slate-300">💰 Cash</td>
                    <td className="p-3 text-center text-slate-400">-</td>
                    <td className="p-3 text-right text-slate-400">-</td>
                    <td className="p-3 text-right text-slate-400">-</td>
                    <td className="p-3 text-right text-slate-400">-</td>
                    <td className="p-3 text-right text-slate-400">-</td>
                    <td className="p-3 text-right text-slate-400">-</td>
                    <td className="p-3 text-right text-green-400 font-semibold">
                      CHF {displayPortfolio.remainingCash.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right text-slate-300">
                      {(displayPortfolio.remainingCash / (displayPortfolio.totalInvested + displayPortfolio.remainingCash) * 100).toFixed(2)}%
                    </td>
                    <td colSpan={6}></td>
                  </tr>
                )}
                <tr className="border-t-2 border-slate-600 font-bold">
                  <td colSpan={8} className="p-3 text-white">Total</td>
                  <td className="p-3 text-right text-white">
                    CHF {((displayPortfolio.totalInvested || 0) + (displayPortfolio.remainingCash || 0)).toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right text-white">
                    {(((displayPortfolio.totalInvested || 0) + (displayPortfolio.remainingCash || 0)) / currentInputs.investmentAmount * 100 || 0).toFixed(2)}%
                  </td>
                  <td colSpan={6}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Save Portfolio Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={(open) => {
        if (open) {
          console.log('[SaveDialog] Opening with selectedPortfolioId:', selectedPortfolioId);
          console.log('[SaveDialog] portfolioName:', portfolioName);
          console.log('[SaveDialog] portfolioDescription:', portfolioDescription);
        }
        setShowSaveDialog(open);
      }}>
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
            <div className="flex gap-3">
              {selectedPortfolioId && (
                <Button
                  onClick={() => {
                    const portfolioDataObj = {
                      inputs: currentInputs,
                      stocks: displayPortfolio.positions.map(pos => ({
                        ticker: pos.ticker,
                        companyName: pos.companyName,
                        category: pos.category,
                        currency: pos.currency,
                        fxRate: pos.fxRate,
                        currentPrice: pos.currentPrice,
                        dividendYield: pos.dividendYield,
                        ytdPerformance: pos.ytdPerformance,
                        peRatio: pos.peRatio,
                        pegRatio: pos.pegRatio,
                        sharpeRatio: pos.sharpeRatio,
                        logoUrl: pos.logoUrl,
                        shares: pos.shares,
                        investmentAmount: pos.investmentAmount,
                        portfolioWeight: pos.portfolioWeight,
                        score: pos.score,
                        isDividendStock: pos.isDividendStock,
                        isGrowthStock: pos.isGrowthStock,
                      })),
                      totalInvested: displayPortfolio.totalInvested,
                      numberOfPositions: displayPortfolio.positions.length,
                      avgDividendYield: displayPortfolio.avgDividendYield,
                      avgYtdPerformance: displayPortfolio.avgYtdPerformance,
                    };
                    updateMutation.mutate({
                      id: parseInt(selectedPortfolioId),
                      name: portfolioName,
                      description: portfolioDescription,
                      portfolioData: JSON.stringify(portfolioDataObj),
                    });
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={!portfolioName.trim() || updateMutation.isPending || !displayPortfolio || displayPortfolio.positions.length === 0}
                >
                  {updateMutation.isPending ? 'Überschreiben...' : 'Überschreiben'}
                </Button>
              )}
              <Button
                onClick={() => {
                  // Check for duplicate names (only when saving as new)
                  const trimmedName = portfolioName.trim();
                  const isDuplicate = portfolios.some(p => 
                    p.name.toLowerCase() === trimmedName.toLowerCase() && 
                    p.id.toString() !== selectedPortfolioId
                  );
                  
                  if (isDuplicate) {
                    toast.error(`Ein Portfolio mit dem Namen "${trimmedName}" existiert bereits. Bitte wählen Sie einen anderen Namen.`);
                    return;
                  }
                  
                  const portfolioDataObj = {
                    inputs: currentInputs,
                    stocks: displayPortfolio.positions.map(pos => ({
                      ticker: pos.ticker,
                      companyName: pos.companyName,
                      category: pos.category,
                      currency: pos.currency,
                      fxRate: pos.fxRate,
                      currentPrice: pos.currentPrice,
                      dividendYield: pos.dividendYield,
                      ytdPerformance: pos.ytdPerformance,
                      peRatio: pos.peRatio,
                      pegRatio: pos.pegRatio,
                      sharpeRatio: pos.sharpeRatio,
                      logoUrl: pos.logoUrl,
                      shares: pos.shares,
                      investmentAmount: pos.investmentAmount,
                      portfolioWeight: pos.portfolioWeight,
                      score: pos.score,
                      isDividendStock: pos.isDividendStock,
                      isGrowthStock: pos.isGrowthStock,
                    })),
                    totalInvested: displayPortfolio.totalInvested,
                    numberOfPositions: displayPortfolio.positions.length,
                    avgDividendYield: displayPortfolio.avgDividendYield,
                    avgYtdPerformance: displayPortfolio.avgYtdPerformance,
                  };
                  saveMutation.mutate({
                    name: trimmedName,
                    description: portfolioDescription,
                    portfolioData: JSON.stringify(portfolioDataObj),
                    investmentAmount: '10000', // Default investment amount
                    portfolioType: 'demo',
                  });
                }}
                className={selectedPortfolioId ? "flex-1 bg-green-600 hover:bg-green-700" : "w-full bg-green-600 hover:bg-green-700"}
                disabled={!portfolioName.trim() || saveMutation.isPending || !displayPortfolio || displayPortfolio.positions.length === 0}
              >
                {saveMutation.isPending ? 'Speichern...' : (selectedPortfolioId ? 'Als neu speichern' : 'Speichern')}
              </Button>
            </div>
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
            {portfolios.length === 0 ? (
              <p className="text-slate-400 text-center py-8">Keine gespeicherten Portfolios gefunden.</p>
            ) : (
              portfolios.map((portfolio: any) => (
                <div key={portfolio.id} className="bg-slate-700 p-3 rounded-lg border border-slate-600">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-white font-semibold text-lg truncate">{portfolio.name}</h3>
                        <p className="text-slate-400 text-xs whitespace-nowrap ml-2">
                          Zuletzt gespeichert {new Date(portfolio.updatedAt).toLocaleDateString('de-CH', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })} {new Date(portfolio.updatedAt).toLocaleTimeString('de-CH', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {portfolio.description && (
                        <p className="text-slate-400 text-sm mb-2 line-clamp-1">{portfolio.description}</p>
                      )}
                      <div className="grid grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-slate-400">Positionen:</span>
                          <span className="text-white ml-1">{portfolio.numberOfPositions}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Total:</span>
                          <span className="text-white ml-1">CHF {portfolio.totalInvested?.toLocaleString('de-CH') || '0'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Ø Div.:</span>
                          <span className="text-green-400 ml-1">{(portfolio.avgDividendYield || 0).toFixed(2)}%</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Ø YTD:</span>
                          <span className={`ml-1 ${(portfolio.avgYtdPerformance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(portfolio.avgYtdPerformance || 0) >= 0 ? '+' : ''}{(portfolio.avgYtdPerformance || 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        onClick={async () => {
                          try {
                            const data = JSON.parse(portfolio.portfolioData);
                            if (data.stocks && Array.isArray(data.stocks)) {
                              // Fetch full stock data from database for each ticker
                              const tickers = data.stocks.map((s: any) => s.ticker).filter(Boolean);
                              const stocksDataResult = await utils.stocks.getByTickers.fetch({ tickers });
                              const stocksMap = new Map(stocksDataResult.map(s => [s.ticker, s]));
                              
                              // Enrich loaded stocks with database data
                              const enrichedStocks = data.stocks.map((stock: any) => {
                                const dbStock = stocksMap.get(stock.ticker);
                                const divYieldRaw = dbStock?.dividendYield || stock.dividendYield || '0';
                                const divYield = typeof divYieldRaw === 'string' ? parseFloat(divYieldRaw) : divYieldRaw;
                                return {
                                  ticker: stock.ticker,
                                  companyName: stock.companyName || dbStock?.companyName || '',
                                  shares: stock.shares || 0,
                                  investmentAmount: stock.investmentAmount || 0,
                                  portfolioWeight: stock.portfolioWeight || 0,
                                  currentPrice: dbStock?.currentPrice || stock.currentPrice || 0,
                                  logoUrl: dbStock?.logoUrl || stock.logoUrl || '',
                                  dividendYield: divYield,
                                  ytdPerformance: dbStock?.ytdPerformance || stock.ytdPerformance || 0,
                                  peRatio: dbStock?.peRatio || stock.peRatio || null,
                                  pegRatio: dbStock?.pegRatio || stock.pegRatio || null,
                                  sharpeRatio: dbStock?.sharpeRatio || stock.sharpeRatio || null,
                                  score: dbStock?.score || stock.score || 0,
                                  category: dbStock?.category || stock.category || '',
                                  currency: dbStock?.currency || stock.currency || 'CHF',
                                isDividendStock: divYield >= 2.5,
                                isGrowthStock: (dbStock?.ytdPerformance ? parseFloat(dbStock.ytdPerformance) > 10 : false) || ["Technology", "E-Commerce", "Fintech", "Biotech"].includes(dbStock?.category || stock.category || '')
                                };
                              });
                              
                              // ALWAYS normalize weights to 100%
                              const totalWeight = enrichedStocks.reduce((sum, s) => sum + s.portfolioWeight, 0);
                              if (totalWeight > 0) {
                                enrichedStocks.forEach(s => {
                                  s.portfolioWeight = (s.portfolioWeight / totalWeight) * 100;
                                });
                              }
                              
                              setEditablePositions(enrichedStocks);
                              setLoadedPortfolioMetadata({
                                totalInvested: data.totalInvested,
                                avgDividendYield: data.avgDividendYield,
                                avgYtdPerformance: data.avgYtdPerformance,
                              });
                              setSelectedPortfolioId(portfolio.id.toString());
                              setPortfolioName(portfolio.name);
                              setPortfolioDescription(portfolio.description || '');
                              setShowLoadDialog(false);
                              toast.success(`Portfolio "${portfolio.name}" geladen!`);
                            } else {
                              toast.error('Portfolio-Daten haben ungültiges Format');
                            }
                          } catch (error) {
                            console.error('Failed to parse portfolio data:', error);
                            toast.error('Portfolio konnte nicht geladen werden');
                          }
                        }}
                        variant="outline"
                        size="sm"
                        className="bg-blue-600 border-blue-500 text-white hover:bg-blue-700"
                      >
                        Laden
                      </Button>
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
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Stock Dialog */}
      <Dialog open={showAddStockDialog} onOpenChange={(open) => {
        setShowAddStockDialog(open);
        if (!open) {
          // Reset form when closing
          setAddStockFormData({});
          setTickerSearchQuery("");
          setShowTickerSuggestions(false);
        }
      }}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Aktie zum Portfolio hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <label className="text-sm text-slate-400 mb-1 block">Firmenname oder Ticker suchen</label>
              <Input
                placeholder="z.B. Apple, AAPL, Novartis, NOVN.SW..."
                value={tickerSearchQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setTickerSearchQuery(value);
                  setAddStockFormData({ ...addStockFormData, companyName: value });
                  setShowTickerSuggestions(true);
                }}
                onFocus={() => setShowTickerSuggestions(true)}
                className="bg-slate-700 border-slate-600 text-white"
              />
              {showTickerSuggestions && tickerSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-700 border border-slate-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {tickerSuggestions.map((suggestion: any) => (
                    <button
                      key={suggestion.symbol}
                      type="button"
                      onClick={() => {
                        const ticker = suggestion.displaySymbol;
                        setAddStockFormData({
                          ...addStockFormData,
                          companyName: suggestion.shortname,
                          ticker: ticker,
                        });
                        setTickerSearchQuery(ticker);
                        setShowTickerSuggestions(false);
                        // Automatically load data after selection
                        toast.info("Laden...", { description: "Daten werden geladen..." });
                        fetchStockDataMutation.mutate(ticker);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-600 text-white"
                    >
                      <div className="font-medium">{suggestion.shortname}</div>
                      <div className="text-sm text-slate-400">
                        {suggestion.displaySymbol}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Firmenname</label>
              <Input
                placeholder="z.B. Apple Inc."
                value={addStockFormData.companyName || ''}
                onChange={(e) => setAddStockFormData({ ...addStockFormData, companyName: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
                disabled
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Ticker</label>
              <Input
                placeholder="z.B. AAPL"
                value={addStockFormData.ticker || ''}
                onChange={(e) => setAddStockFormData({ ...addStockFormData, ticker: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
                disabled
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Kategorie</label>
              <Select 
                value={addStockFormData.category || ''} 
                onValueChange={(v) => setAddStockFormData({ ...addStockFormData, category: v })}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Kategorie wählen" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="Technologie" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Technologie</SelectItem>
                  <SelectItem value="E-Commerce" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">E-Commerce</SelectItem>
                  <SelectItem value="Automotive" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Automotive</SelectItem>
                  <SelectItem value="Healthcare" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Healthcare</SelectItem>
                  <SelectItem value="Biotech" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Biotech</SelectItem>
                  <SelectItem value="Energie" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Energie</SelectItem>
                  <SelectItem value="Finanzdienstleistungen" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Finanzdienstleistungen</SelectItem>
                  <SelectItem value="Infrastruktur" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Infrastruktur</SelectItem>
                  <SelectItem value="Industrie" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Industrie</SelectItem>
                  <SelectItem value="Konsumgüter" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Konsumgüter</SelectItem>
                  <SelectItem value="Rohstoffe" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Rohstoffe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Aktueller Kurs ({addStockFormData.currency || 'CHF'})</label>
              <Input
                type="number"
                step="0.01"
                placeholder="z.B. 150.50"
                value={addStockFormData.currentPrice || ''}
                onChange={(e) => setAddStockFormData({ ...addStockFormData, currentPrice: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Dividendenrendite (%)</label>
              <Input
                type="number"
                step="0.1"
                placeholder="z.B. 2.5"
                value={addStockFormData.dividendYield || ''}
                onChange={(e) => setAddStockFormData({ ...addStockFormData, dividendYield: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">YTD Performance (%)</label>
              <Input
                type="number"
                step="0.1"
                placeholder="z.B. 15.3"
                value={addStockFormData.ytdPerformance || ''}
                onChange={(e) => setAddStockFormData({ ...addStockFormData, ytdPerformance: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Anzahl Aktien</label>
              <Input
                type="number"
                step="1"
                placeholder="z.B. 10"
                value={addStockFormData.shares || ''}
                onChange={(e) => setAddStockFormData({ ...addStockFormData, shares: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => {
                  setShowAddStockDialog(false);
                  setAddStockFormData({});
                  setTickerSearchQuery("");
                  setShowTickerSuggestions(false);
                }}
                variant="outline"
                className="flex-1 bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              >
                Abbrechen
              </Button>
              <Button
                onClick={() => {
                  if (!addStockFormData.ticker || !addStockFormData.companyName || !addStockFormData.currentPrice || !addStockFormData.shares) {
                    toast.error('Bitte füllen Sie alle Pflichtfelder aus');
                    return;
                  }
                  
                  const shares = parseInt(addStockFormData.shares);
                  const currentPrice = parseFloat(addStockFormData.currentPrice);
                  const currency = addStockFormData.currency || 'USD';
                  const fxRate = getFxRate(currency);
                  const fxRateNum = parseFloat(fxRate);
                  const investmentAmount = shares * currentPrice * fxRateNum;
                  
                  const newPosition: OptimizedPosition = {
                    ticker: addStockFormData.ticker,
                    companyName: addStockFormData.companyName,
                    category: addStockFormData.category || 'Wachstumstitel',
                    currency: currency,
                    fxRate: fxRate,
                    shares: Math.floor(investmentAmount / (parseFloat(addStockFormData.currentPrice || '1') * fxRateNum)),
                    currentPrice: addStockFormData.currentPrice || '0',
                    investmentAmount: investmentAmount,
                    portfolioWeight: (investmentAmount / currentInputs.investmentAmount) * 100,
                    dividendYield: addStockFormData.dividendYield || '0',
                    ytdPerformance: addStockFormData.ytdPerformance || '0',
                    peRatio: addStockFormData.peRatio || '0',
                    pegRatio: addStockFormData.pegRatio || '0',
                    sharpeRatio: addStockFormData.sharpeRatio || '0',
                    logoUrl: addStockFormData.logoUrl,
                    score: 0,
                    isDividendStock: parseFloat(addStockFormData.dividendYield || '0') >= 2,
                    isGrowthStock: parseFloat(addStockFormData.dividendYield || '0') < 2,
                  };
                  
                  const updatedPositions = [...(editablePositions || optimizedPortfolio.positions), newPosition];
                  console.log('[AddStock] Adding new position:', newPosition.ticker, 'Total positions:', updatedPositions.length);
                  console.log('[AddStock] New position data:', JSON.stringify(newPosition, null, 2));
                  setEditablePositions(updatedPositions);
                  
                  setShowAddStockDialog(false);
                  setAddStockFormData({});
                  setTickerSearchQuery("");
                  setShowTickerSuggestions(false);
                  toast.success(`${newPosition.companyName} wurde hinzugefügt`);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Hinzufügen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

