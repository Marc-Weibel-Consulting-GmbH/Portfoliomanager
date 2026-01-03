import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StockLogo } from "@/components/StockLogo";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Search, Sparkles, X, TrendingUp, DollarSign, Loader2 } from "lucide-react";
import { PortfolioBuilderState, Position } from "../PortfolioBuilderNew";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

interface Step2StockSelectionProps {
  state: PortfolioBuilderState;
  addPosition: (position: Position) => void;
  removePosition: (ticker: string) => void;
  updatePosition: (ticker: string, updates: Partial<Position>) => void;
}

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

  // Fetch all stocks
  const { data: allStocks = [], isLoading: stocksLoading } = trpc.stocks.list.useQuery();

  // Filter stocks based on search and filter
  const filteredStocks = useMemo(() => {
    let filtered = allStocks;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (stock: any) =>
          stock.ticker.toLowerCase().includes(query) ||
          stock.companyName?.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (selectedFilter === 'dividends') {
      filtered = filtered.filter((stock: any) => (stock.dividendYield || 0) > 2);
    } else if (selectedFilter === 'growth') {
      filtered = filtered.filter((stock: any) => (stock.ytdPerformance || 0) > 10);
    } else if (selectedFilter === 'etf') {
      filtered = filtered.filter((stock: any) => stock.ticker.includes('ETF') || stock.companyName?.includes('ETF'));
    }

    // Exclude already selected stocks
    const selectedTickers = state.positions.map(p => p.ticker);
    filtered = filtered.filter((stock: any) => !selectedTickers.includes(stock.ticker));

    return filtered.slice(0, 20); // Limit to 20 results
  }, [allStocks, searchQuery, selectedFilter, state.positions]);

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
      currentPrice: stock.currentPrice,
      ytdPerformance: stock.ytdPerformance,
      dividendYield: stock.dividendYield,
      sector: stock.sector,
    });
  };

  const handleWeightChange = (ticker: string, newWeight: number) => {
    updatePosition(ticker, { weight: newWeight });
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
          currentPrice: position.currentPrice,
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
                        <span className="text-gray-400">CHF {Number(position.currentPrice).toFixed(2)}</span>
                      )}
                      {position.ytdPerformance != null && (
                        <span className={Number(position.ytdPerformance) >= 0 ? "text-green-400" : "text-red-400"}>
                          {Number(position.ytdPerformance) >= 0 ? "+" : ""}{Number(position.ytdPerformance).toFixed(1)}%
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
                    <span className={`text-sm font-bold ${Math.abs(totalWeight - targetStockWeight) < 0.01 ? "text-green-400" : "text-amber-400"}`}>
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

        {/* Search and Filters */}
        <Card className="bg-[#0f1420]/50 border-white/10">
          <CardContent className="p-4 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Aktien suchen (Ticker oder Name)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#0a0f1a] border-white/10 text-white"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
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
                    onClick={() => setSelectedFilter(filter.id)}
                    className={selectedFilter === filter.id ? "bg-[#00CFC1] hover:bg-[#00CFC1]/90" : ""}
                  >
                    {Icon && <Icon className="mr-1 h-3 w-3" />}
                    {filter.label}
                  </Button>
                );
              })}
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
            filteredStocks.map((stock: any) => (
              <Card
                key={stock.ticker}
                className="bg-[#0a0f1a] border-white/10 hover:border-[#00CFC1]/50 transition-all cursor-pointer group"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <StockLogo ticker={stock.ticker} companyName={stock.companyName} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">{stock.ticker}</p>
                      <p className="text-xs text-gray-400 line-clamp-2">{stock.companyName}</p>
                    </div>
                  </div>

                    <div className="space-y-1">
                      {stock.currentPrice != null && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Preis</span>
                          <span className="text-white font-medium">CHF {Number(stock.currentPrice).toFixed(2)}</span>
                        </div>
                      )}
                      {stock.ytdPerformance != null && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">YTD</span>
                          <span className={Number(stock.ytdPerformance) >= 0 ? "text-green-400 font-medium" : "text-red-400 font-medium"}>
                            {Number(stock.ytdPerformance) >= 0 ? "+" : ""}{Number(stock.ytdPerformance).toFixed(1)}%
                          </span>
                        </div>
                      )}
                      {stock.dividendYield != null && Number(stock.dividendYield) > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Div. Rendite</span>
                          <span className="text-blue-400 font-medium">{Number(stock.dividendYield).toFixed(2)}%</span>
                        </div>
                      )}
                    </div>

                  {stock.sector && (
                    <Badge variant="secondary" className="text-xs">
                      {stock.sector}
                    </Badge>
                  )}

                  <Button
                    onClick={() => handleAddStock(stock)}
                    className="w-full bg-[#00CFC1]/10 hover:bg-[#00CFC1]/20 text-[#00CFC1] border border-[#00CFC1]/30"
                    size="sm"
                  >
                    + Hinzufügen
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
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
    </div>
  );
}
