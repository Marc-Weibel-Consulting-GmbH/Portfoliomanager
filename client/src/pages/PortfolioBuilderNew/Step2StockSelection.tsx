import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StockLogo } from "@/components/StockLogo";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Sparkles, X, TrendingUp, DollarSign, Loader2, ChevronDown, Info, Building2, BarChart3, Percent, Activity, Star, ArrowUpDown } from "lucide-react";
import { PortfolioBuilderState, Position } from "../PortfolioBuilderNew";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

interface Step2StockSelectionProps {
  state: PortfolioBuilderState;
  addPosition: (position: Position) => void;
  removePosition: (ticker: string) => void;
  updatePosition: (ticker: string, updates: Partial<Position>) => void;
}

// Fuzzy search helper - matches partial strings and similar spellings
function fuzzyMatch(text: string, query: string): boolean {
  if (!text || !query) return false;
  
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Direct substring match
  if (textLower.includes(queryLower)) return true;
  
  // Word-by-word match (for multi-word queries)
  const queryWords = queryLower.split(/\s+/);
  if (queryWords.every(word => textLower.includes(word))) return true;
  
  // Character sequence match (fuzzy)
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }
  if (queryIndex === queryLower.length) return true;
  
  // Levenshtein distance for short queries (typo tolerance)
  if (queryLower.length <= 5 && textLower.length <= 20) {
    const distance = levenshteinDistance(textLower.substring(0, 10), queryLower);
    if (distance <= 2) return true;
  }
  
  return false;
}

// Levenshtein distance for typo tolerance
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Favorites storage key
const FAVORITES_STORAGE_KEY = 'portfolio_builder_favorites';

// Get favorites from localStorage
function getFavorites(): string[] {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save favorites to localStorage
function saveFavorites(favorites: string[]): void {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    console.error('Failed to save favorites');
  }
}

type SortOption = 'name' | 'ytd_desc' | 'ytd_asc' | 'dividend_desc' | 'sector' | 'favorites';

export default function Step2StockSelection({
  state,
  addPosition,
  removePosition,
  updatePosition,
}: Step2StockSelectionProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'dividends' | 'growth' | 'etf'>('all');
  const [showAutoPrompt, setShowAutoPrompt] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(20);
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [showStockDetails, setShowStockDetails] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('name');

  // Load favorites from localStorage on mount
  useEffect(() => {
    setFavorites(getFavorites());
  }, []);

  // Toggle favorite
  const toggleFavorite = (ticker: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setFavorites(prev => {
      const newFavorites = prev.includes(ticker)
        ? prev.filter(t => t !== ticker)
        : [...prev, ticker];
      saveFavorites(newFavorites);
      return newFavorites;
    });
  };

  // Fetch all stocks
  const { data: allStocks = [], isLoading: stocksLoading } = trpc.stocks.list.useQuery();

  // Filter and sort stocks
  const filteredStocksAll = useMemo(() => {
    let filtered = allStocks;

    // Apply search filter with fuzzy matching
    if (searchQuery) {
      filtered = filtered.filter(
        (stock: any) =>
          fuzzyMatch(stock.ticker, searchQuery) ||
          fuzzyMatch(stock.companyName || '', searchQuery) ||
          fuzzyMatch(stock.sector || '', searchQuery)
      );
    }

    // Apply category filter
    if (selectedFilter === 'dividends') {
      filtered = filtered.filter((stock: any) => (parseFloat(stock.dividendYield) || 0) > 2);
    } else if (selectedFilter === 'growth') {
      filtered = filtered.filter((stock: any) => (parseFloat(stock.ytdPerformance) || 0) > 10);
    } else if (selectedFilter === 'etf') {
      filtered = filtered.filter((stock: any) => stock.ticker.includes('ETF') || stock.companyName?.includes('ETF'));
    }

    // Exclude already selected stocks
    const selectedTickers = state.positions.map(p => p.ticker);
    filtered = filtered.filter((stock: any) => !selectedTickers.includes(stock.ticker));

    // Sort stocks
    filtered = [...filtered].sort((a: any, b: any) => {
      // Favorites always first when sorting by favorites
      if (sortBy === 'favorites') {
        const aFav = favorites.includes(a.ticker);
        const bFav = favorites.includes(b.ticker);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        // Then by name
        return (a.companyName || a.ticker).localeCompare(b.companyName || b.ticker);
      }
      
      // For other sorts, favorites still come first
      const aFav = favorites.includes(a.ticker);
      const bFav = favorites.includes(b.ticker);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      
      switch (sortBy) {
        case 'ytd_desc':
          return (parseFloat(b.ytdPerformance) || 0) - (parseFloat(a.ytdPerformance) || 0);
        case 'ytd_asc':
          return (parseFloat(a.ytdPerformance) || 0) - (parseFloat(b.ytdPerformance) || 0);
        case 'dividend_desc':
          return (parseFloat(b.dividendYield) || 0) - (parseFloat(a.dividendYield) || 0);
        case 'sector':
          return (a.sector || 'ZZZ').localeCompare(b.sector || 'ZZZ');
        case 'name':
        default:
          return (a.companyName || a.ticker).localeCompare(b.companyName || b.ticker);
      }
    });

    return filtered;
  }, [allStocks, searchQuery, selectedFilter, state.positions, sortBy, favorites]);

  // Apply pagination
  const filteredStocks = useMemo(() => {
    return filteredStocksAll.slice(0, displayLimit);
  }, [filteredStocksAll, displayLimit]);

  const hasMoreStocks = filteredStocksAll.length > displayLimit;
  const remainingCount = filteredStocksAll.length - displayLimit;

  const selectedStocks = state.positions.filter(p => p.type === 'stock');
  const totalWeight = selectedStocks.reduce((sum, p) => sum + p.weight, 0);
  // Target weight for stocks is (100 - cashPercentage)
  const targetStockWeight = 100 - state.cashPercentage;
  const remainingWeight = targetStockWeight - totalWeight;

  const handleAddStock = (stock: any) => {
    // Calculate suggested weight (equal distribution of remaining weight)
    const numPositions = selectedStocks.length + 1;
    const suggestedWeight = remainingWeight > 0 ? Math.min(remainingWeight, 100 / numPositions) : 0;

    addPosition({
      ticker: stock.ticker,
      companyName: stock.companyName || stock.ticker,
      weight: parseFloat(suggestedWeight.toFixed(2)),
      type: 'stock',
      currentPrice: parseFloat(stock.currentPrice || '0'),
      currency: stock.currency || 'CHF',
      exchangeRateToChf: parseFloat(stock.exchangeRateToChf || '1.0'),
      ytdPerformance: parseFloat(stock.ytdPerformance || '0'),
      dividendYield: parseFloat(stock.dividendYield || '0'),
      sector: stock.sector,
    });
  };

  const handleWeightChange = (ticker: string, newWeight: number) => {
    updatePosition(ticker, { weight: newWeight });
  };

  const handleLoadMore = () => {
    setDisplayLimit(prev => prev + 20);
  };

  const handleStockClick = (stock: any) => {
    setSelectedStock(stock);
    setShowStockDetails(true);
  };

  const formatCurrency = (price: number | string, currency: string) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) return '-';
    return `${currency} ${numPrice.toFixed(2)}`;
  };

  const formatPerformance = (perf: number | string | null | undefined) => {
    if (perf === null || perf === undefined) return null;
    const numPerf = typeof perf === 'string' ? parseFloat(perf) : perf;
    if (isNaN(numPerf)) return null;
    return numPerf;
  };

  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');

  const generateMutation = trpc.autoPortfolio.generatePortfolio.useMutation({
    onSuccess: (data) => {
      setProgressMessage('Portfolio wird finalisiert...');
      setProgress(90);
      
      // Calculate adjustment factor for cash reserve
      // If user wants 5% cash, stocks should only use 95% of capital
      const investmentPercentage = 100 - state.cashPercentage;
      const adjustmentFactor = investmentPercentage / 100;
      
      // Add all generated positions with adjusted weights
      data.positions.forEach((position: any) => {
        addPosition({
          ticker: position.ticker,
          companyName: position.companyName,
          weight: parseFloat((position.weight * adjustmentFactor).toFixed(2)),
          type: 'stock',
          currentPrice: parseFloat(position.currentPrice || '0'),
          currency: position.currency || 'CHF',
          exchangeRateToChf: parseFloat(position.exchangeRateToChf || '1.0'),
          ytdPerformance: position.ytdPerformance,
          dividendYield: position.dividendYield,
          sector: position.sector,
        });
      });
      
      setProgress(100);
      setProgressMessage('Portfolio erfolgreich erstellt!');
      
      // Close dialog after a short delay
      setTimeout(() => {
        setIsGenerating(false);
        setProgress(0);
        setProgressMessage('');
      }, 1000);
    },
    onError: (error) => {
      console.error('Auto-generation failed:', error);
      setProgressMessage('Fehler bei der Erstellung');
      setTimeout(() => {
        alert('Automatische Erstellung fehlgeschlagen: ' + error.message);
        setIsGenerating(false);
        setProgress(0);
        setProgressMessage('');
      }, 1000);
    },
  });

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    setShowAutoPrompt(false);
    setProgress(10);
    setProgressMessage('Analysiere Anlagestrategie...');
    
    // Simulate progress updates
    setTimeout(() => {
      setProgress(30);
      setProgressMessage('Suche passende Aktien...');
    }, 500);
    
    setTimeout(() => {
      setProgress(60);
      setProgressMessage('Optimiere Portfolio-Gewichtung...');
    }, 1500);
    
    // Call API to generate portfolio
    generateMutation.mutate({
      strategy: state.strategy as 'growth' | 'dividends' | 'balanced',
      investmentHorizon: state.investmentHorizon as 'short' | 'medium' | 'long',
      targetStockCount: 10,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel - Selected Positions */}
      <div className="lg:col-span-1">
        <Card className="bg-[#0f1420]/50 border-white/10 sticky top-4">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span>Ausgewählte Positionen ({selectedStocks.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedStocks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">Noch keine Aktien ausgewählt</p>
                <p className="text-gray-500 text-xs mt-1">Wähle mindestens 3 Aktien aus</p>
              </div>
            ) : (
              <>
                {selectedStocks.map((position) => (
                  <div
                    key={position.ticker}
                    className="bg-[#0a0f1a] border border-white/10 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <StockLogo ticker={position.ticker} companyName={position.companyName} size="sm" />
                        <div>
                          <p className="font-semibold text-white text-sm">{position.ticker}</p>
                          <p className="text-xs text-gray-400 line-clamp-1">{position.companyName}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removePosition(position.ticker)}
                        className="text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Weight Slider */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Gewichtung</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={position.weight}
                          onChange={(e) => handleWeightChange(position.ticker, parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-1 text-xs bg-[#0a0f1a] border border-white/10 rounded text-white text-right"
                        />
                      </div>
                      <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="absolute top-0 left-0 h-full bg-[#00CFC1] transition-all"
                          style={{ width: `${Math.min(position.weight, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="flex items-center gap-3 text-xs">
                      {position.currentPrice != null && (
                        <span className="text-gray-400">
                          {formatCurrency(position.currentPrice, position.currency || 'CHF')}
                        </span>
                      )}
                      {formatPerformance(position.ytdPerformance) !== null && (
                        <span className={formatPerformance(position.ytdPerformance)! >= 0 ? "text-green-400" : "text-red-400"}>
                          {formatPerformance(position.ytdPerformance)! >= 0 ? "+" : ""}{formatPerformance(position.ytdPerformance)!.toFixed(1)}%
                        </span>
                      )}
                      {position.dividendYield != null && Number(position.dividendYield) > 0 && (
                        <span className="text-blue-400">{Number(position.dividendYield).toFixed(2)}%</span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Total Weight Indicator */}
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">Aktien</span>
                    <span className={`text-sm font-semibold ${Math.abs(totalWeight - targetStockWeight) < 0.1 ? "text-green-400" : "text-amber-400"}`}>
                      {totalWeight.toFixed(1)}% / {targetStockWeight.toFixed(0)}%
                    </span>
                  </div>
                  <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`absolute top-0 left-0 h-full transition-all ${
                        Math.abs(totalWeight - targetStockWeight) < 0.01 ? "bg-green-500" : totalWeight > targetStockWeight ? "bg-red-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${Math.min((totalWeight / targetStockWeight) * 100, 100)}%` }}
                    />
                  </div>
                  {state.cashPercentage > 0 && (
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-gray-400">Cash-Reserve</span>
                      <span className="text-[#00CFC1] font-semibold">{state.cashPercentage.toFixed(0)}%</span>
                    </div>
                  )}
                  {Math.abs(totalWeight - targetStockWeight) >= 0.01 && (
                    <p className="text-xs text-amber-400 mt-2">
                      {totalWeight < targetStockWeight ? `Noch ${remainingWeight.toFixed(1)}% zu verteilen` : `${(totalWeight - targetStockWeight).toFixed(1)}% zu viel`}
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Stock Search */}
      <div className="lg:col-span-2 space-y-4">
        {/* Auto-Generate Prompt */}
        {showAutoPrompt && selectedStocks.length === 0 && user && (
          <Card className="bg-gradient-to-br from-[#00CFC1]/10 to-[#0f1420]/50 border-[#00CFC1]/30">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[#00CFC1]/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-6 w-6 text-[#00CFC1]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">Automatisches Portfolio erstellen</h3>
                  <p className="text-sm text-gray-300 mb-4">
                    Lass unser System ein diversifiziertes Portfolio basierend auf deinem Anlageprofil erstellen.
                  </p>
                  <div className="flex items-center gap-4 mb-4">
                    <Button
                      onClick={handleAutoGenerate}
                      disabled={isGenerating}
                      className="bg-[#00CFC1] hover:bg-[#00CFC1]/90 text-white"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Wird erstellt...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Automatisch erstellen
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowAutoPrompt(false)}
                      className="border-white/20"
                    >
                      Manuell auswählen
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search, Filters and Sorting */}
        <Card className="bg-[#0f1420]/50 border-white/10">
          <CardContent className="p-4 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Aktien suchen (Ticker, Name oder Sektor)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setDisplayLimit(20); // Reset pagination on search
                }}
                className="pl-10 bg-[#0a0f1a] border-white/10 text-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter and Sort Row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Filter Buttons */}
              <div className="flex flex-wrap gap-2 flex-1">
                {[
                  { id: 'all' as const, label: 'Alle', icon: null },
                  { id: 'dividends' as const, label: 'Dividenden', icon: DollarSign },
                  { id: 'growth' as const, label: 'Wachstum', icon: TrendingUp },
                  { id: 'etf' as const, label: 'ETF', icon: null },
                ].map((filter) => {
                  const Icon = filter.icon;
                  return (
                    <Button
                      key={filter.id}
                      variant={selectedFilter === filter.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedFilter(filter.id);
                        setDisplayLimit(20); // Reset pagination on filter change
                      }}
                      className={selectedFilter === filter.id ? "bg-[#00CFC1] hover:bg-[#00CFC1]/90" : ""}
                    >
                      {Icon && <Icon className="mr-1 h-3 w-3" />}
                      {filter.label}
                    </Button>
                  );
                })}
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-gray-400" />
                <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                  <SelectTrigger className="w-[180px] bg-[#0a0f1a] border-white/10 text-white">
                    <SelectValue placeholder="Sortieren nach..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f1420] border-white/10">
                    <SelectItem value="favorites" className="text-white hover:bg-white/10">
                      <span className="flex items-center gap-2">
                        <Star className="h-3 w-3 text-yellow-400" />
                        Favoriten zuerst
                      </span>
                    </SelectItem>
                    <SelectItem value="name" className="text-white hover:bg-white/10">Name (A-Z)</SelectItem>
                    <SelectItem value="ytd_desc" className="text-white hover:bg-white/10">YTD Performance ↓</SelectItem>
                    <SelectItem value="ytd_asc" className="text-white hover:bg-white/10">YTD Performance ↑</SelectItem>
                    <SelectItem value="dividend_desc" className="text-white hover:bg-white/10">Dividendenrendite ↓</SelectItem>
                    <SelectItem value="sector" className="text-white hover:bg-white/10">Sektor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stock count info */}
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{filteredStocksAll.length} Titel verfügbar • {filteredStocks.length} angezeigt</span>
              {favorites.length > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                  {favorites.length} Favoriten
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stock Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {stocksLoading ? (
            <div className="col-span-full text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#00CFC1] mx-auto mb-2" />
              <p className="text-gray-400">Aktien werden geladen...</p>
            </div>
          ) : filteredStocks.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-400">Keine Aktien gefunden</p>
              <p className="text-gray-500 text-sm mt-1">Versuche einen anderen Suchbegriff</p>
            </div>
          ) : (
            filteredStocks.map((stock: any) => {
              const currency = stock.currency || 'CHF';
              const ytdPerf = formatPerformance(stock.ytdPerformance);
              const divYield = formatPerformance(stock.dividendYield);
              const isFavorite = favorites.includes(stock.ticker);
              
              return (
                <Card
                  key={stock.ticker}
                  className={`bg-[#0a0f1a] border-white/10 hover:border-[#00CFC1]/50 transition-all cursor-pointer group ${
                    isFavorite ? 'ring-1 ring-yellow-400/30' : ''
                  }`}
                  onClick={() => handleStockClick(stock)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <StockLogo ticker={stock.ticker} companyName={stock.companyName} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white">{stock.ticker}</p>
                          <button
                            onClick={(e) => toggleFavorite(stock.ticker, e)}
                            className={`transition-colors ${
                              isFavorite 
                                ? 'text-yellow-400 hover:text-yellow-300' 
                                : 'text-gray-500/50 hover:text-yellow-400'
                            }`}
                          >
                            <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-2">{stock.companyName}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {stock.currentPrice != null && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Preis</span>
                          <span className="text-white font-medium">
                            {formatCurrency(stock.currentPrice, currency)}
                          </span>
                        </div>
                      )}
                      {ytdPerf !== null && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">YTD</span>
                          <span className={ytdPerf >= 0 ? "text-green-400 font-medium" : "text-red-400 font-medium"}>
                            {ytdPerf >= 0 ? "+" : ""}{ytdPerf.toFixed(1)}%
                          </span>
                        </div>
                      )}
                      {divYield !== null && divYield > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Div. Rendite</span>
                          <span className="text-blue-400 font-medium">{divYield.toFixed(2)}%</span>
                        </div>
                      )}
                    </div>

                    {stock.sector && (
                      <Badge variant="secondary" className="text-xs">
                        {stock.sector}
                      </Badge>
                    )}

                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddStock(stock);
                      }}
                      className="w-full bg-[#00CFC1]/10 hover:bg-[#00CFC1]/20 text-[#00CFC1] border border-[#00CFC1]/30"
                      size="sm"
                    >
                      + Hinzufügen
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Load More Button */}
        {hasMoreStocks && (
          <div className="text-center py-4">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              className="border-white/20 text-white hover:bg-white/10"
            >
              <ChevronDown className="mr-2 h-4 w-4" />
              Weitere {Math.min(remainingCount, 20)} Titel laden ({remainingCount} verbleibend)
            </Button>
          </div>
        )}
      </div>

      {/* Progress Dialog */}
      <Dialog open={isGenerating} onOpenChange={() => {}}>
        <DialogContent className="bg-[#0f1420] border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#00CFC1]" />
              Portfolio wird erstellt
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{progressMessage}</span>
                <span className="text-[#00CFC1] font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            <div className="text-xs text-gray-400 text-center">
              Bitte warten, dies kann einen Moment dauern...
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stock Details Dialog */}
      <Dialog open={showStockDetails} onOpenChange={setShowStockDetails}>
        <DialogContent className="bg-[#0f1420] border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-3">
              {selectedStock && (
                <>
                  <StockLogo ticker={selectedStock.ticker} companyName={selectedStock.companyName} size="md" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{selectedStock.ticker}</p>
                      <button
                        onClick={() => toggleFavorite(selectedStock.ticker)}
                        className={`transition-colors ${
                          favorites.includes(selectedStock.ticker) 
                            ? 'text-yellow-400 hover:text-yellow-300' 
                            : 'text-gray-500 hover:text-yellow-400'
                        }`}
                      >
                        <Star className={`h-4 w-4 ${favorites.includes(selectedStock.ticker) ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                    <p className="text-sm text-gray-400 font-normal">{selectedStock.companyName}</p>
                  </div>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedStock && (
            <div className="space-y-4 py-4">
              {/* Price and Performance */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0a0f1a] rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <DollarSign className="h-4 w-4" />
                    Aktueller Kurs
                  </div>
                  <p className="text-xl font-bold text-white">
                    {formatCurrency(selectedStock.currentPrice, selectedStock.currency || 'CHF')}
                  </p>
                  {selectedStock.currency !== 'CHF' && selectedStock.exchangeRateToChf && (
                    <p className="text-xs text-gray-500 mt-1">
                      ≈ CHF {(parseFloat(selectedStock.currentPrice) * parseFloat(selectedStock.exchangeRateToChf)).toFixed(2)}
                    </p>
                  )}
                </div>
                
                <div className="bg-[#0a0f1a] rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <TrendingUp className="h-4 w-4" />
                    YTD Performance
                  </div>
                  {formatPerformance(selectedStock.ytdPerformance) !== null ? (
                    <p className={`text-xl font-bold ${formatPerformance(selectedStock.ytdPerformance)! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPerformance(selectedStock.ytdPerformance)! >= 0 ? '+' : ''}{formatPerformance(selectedStock.ytdPerformance)!.toFixed(2)}%
                    </p>
                  ) : (
                    <p className="text-xl font-bold text-gray-500">-</p>
                  )}
                </div>
              </div>

              {/* Key Metrics */}
              <div className="bg-[#0a0f1a] rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-medium text-white flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[#00CFC1]" />
                  Kennzahlen
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Dividendenrendite</span>
                    <span className="text-white font-medium">
                      {formatPerformance(selectedStock.dividendYield) !== null 
                        ? `${formatPerformance(selectedStock.dividendYield)!.toFixed(2)}%` 
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">KGV (P/E)</span>
                    <span className="text-white font-medium">
                      {selectedStock.peRatio ? parseFloat(selectedStock.peRatio).toFixed(1) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">PEG Ratio</span>
                    <span className="text-white font-medium">
                      {selectedStock.pegRatio ? parseFloat(selectedStock.pegRatio).toFixed(2) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Beta</span>
                    <span className="text-white font-medium">
                      {selectedStock.beta ? parseFloat(selectedStock.beta).toFixed(2) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Volatilität</span>
                    <span className="text-white font-medium">
                      {selectedStock.volatility ? `${parseFloat(selectedStock.volatility).toFixed(1)}%` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Sharpe Ratio</span>
                    <span className="text-white font-medium">
                      {selectedStock.sharpeRatio ? parseFloat(selectedStock.sharpeRatio).toFixed(2) : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 52 Week Range */}
              {(selectedStock.week52High || selectedStock.week52Low) && (
                <div className="bg-[#0a0f1a] rounded-lg p-4 space-y-2">
                  <h4 className="text-sm font-medium text-white flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#00CFC1]" />
                    52-Wochen Spanne
                  </h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-red-400">
                      {selectedStock.week52Low ? formatCurrency(selectedStock.week52Low, selectedStock.currency || 'CHF') : '-'}
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className="text-green-400">
                      {selectedStock.week52High ? formatCurrency(selectedStock.week52High, selectedStock.currency || 'CHF') : '-'}
                    </span>
                  </div>
                </div>
              )}

              {/* Sector */}
              {selectedStock.sector && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <Badge variant="secondary">{selectedStock.sector}</Badge>
                </div>
              )}

              {/* Add Button */}
              <Button
                onClick={() => {
                  handleAddStock(selectedStock);
                  setShowStockDetails(false);
                }}
                className="w-full bg-[#00CFC1] hover:bg-[#00CFC1]/90 text-white"
              >
                + Zum Portfolio hinzufügen
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
