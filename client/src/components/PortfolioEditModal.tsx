import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { StockLogo } from "@/components/StockLogo";
import { Plus, Trash2, Save, X, Search, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PortfolioStock {
  ticker: string;
  companyName?: string;
  weight: number;
  shares?: number;
  currentPrice?: number;
  currency?: string;
}

interface PortfolioEditModalProps {
  open: boolean;
  onClose: () => void;
  portfolioId: number;
  portfolioName: string;
  initialStocks: PortfolioStock[];
  isLive?: boolean;
  onSuccess?: () => void;
}

export function PortfolioEditModal({
  open,
  onClose,
  portfolioId,
  portfolioName,
  initialStocks,
  isLive = false,
  onSuccess
}: PortfolioEditModalProps) {
  const [stocks, setStocks] = useState<PortfolioStock[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const utils = trpc.useUtils();

  // Initialize stocks when modal opens
  useEffect(() => {
    if (open) {
      setStocks(initialStocks.map(s => ({ ...s })));
      setHasChanges(false);
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [open, initialStocks]);

  // Search for stocks
  const { data: allStocks } = trpc.stocks.getAll.useQuery();

  const filteredStocks = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    if (!allStocks) return [];

    const query = searchQuery.toLowerCase();
    return allStocks
      .filter((s: any) => 
        (s.ticker?.toLowerCase().includes(query) || 
         s.companyName?.toLowerCase().includes(query)) &&
        !stocks.some(existing => existing.ticker === s.ticker)
      )
      .slice(0, 10);
  }, [searchQuery, allStocks, stocks]);

  // Update portfolio mutation
  const updatePortfolio = trpc.portfolios.update.useMutation({
    onSuccess: () => {
      toast.success("Portfolio erfolgreich aktualisiert");
      utils.portfolios.list.invalidate();
      utils.portfolios.getWithCurrency.invalidate();
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast.error(`Fehler beim Speichern: ${error.message}`);
    },
  });

  // Calculate total weight
  const totalWeight = useMemo(() => {
    return stocks.reduce((sum, s) => sum + (s.weight || 0), 0);
  }, [stocks]);

  // Handle weight change
  const handleWeightChange = (ticker: string, newWeight: string) => {
    const weight = parseFloat(newWeight) || 0;
    setStocks(prev => prev.map(s => 
      s.ticker === ticker ? { ...s, weight: Math.max(0, Math.min(100, weight)) } : s
    ));
    setHasChanges(true);
  };

  // Add stock
  const handleAddStock = (stock: any) => {
    const newStock: PortfolioStock = {
      ticker: stock.ticker,
      companyName: stock.companyName,
      weight: 0,
      currentPrice: parseFloat(stock.currentPrice || '0'),
      currency: stock.currency || 'CHF'
    };
    setStocks(prev => [...prev, newStock]);
    setSearchQuery("");
    setSearchResults([]);
    setHasChanges(true);
  };

  // Remove stock
  const handleRemoveStock = (ticker: string) => {
    setStocks(prev => prev.filter(s => s.ticker !== ticker));
    setHasChanges(true);
  };

  // Normalize weights to 100%
  const handleNormalizeWeights = () => {
    if (totalWeight === 0) {
      // Distribute equally
      const equalWeight = 100 / stocks.length;
      setStocks(prev => prev.map(s => ({ ...s, weight: parseFloat(equalWeight.toFixed(2)) })));
    } else {
      // Normalize proportionally
      const factor = 100 / totalWeight;
      setStocks(prev => prev.map(s => ({ ...s, weight: parseFloat((s.weight * factor).toFixed(2)) })));
    }
    setHasChanges(true);
  };

  // Save changes
  const handleSave = () => {
    if (stocks.length === 0) {
      toast.error("Portfolio muss mindestens eine Position enthalten");
      return;
    }

    // Prepare portfolio data
    const portfolioData = JSON.stringify({
      stocks: stocks.map(s => ({
        ticker: s.ticker,
        companyName: s.companyName,
        weight: s.weight.toString(),
        currentPrice: s.currentPrice?.toString() || '0',
        currency: s.currency || 'CHF'
      }))
    });

    updatePortfolio.mutate({
      id: portfolioId,
      portfolioData
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <span>Portfolio bearbeiten</span>
            <Badge variant="outline" className="text-cyan-400 border-cyan-400/50">
              {portfolioName}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Positionen hinzufügen, entfernen oder Gewichtungen anpassen
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Search for new stocks */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Neue Position hinzufügen</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ticker oder Firmenname suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-700 border-slate-600 text-white"
              />
            </div>
            
            {/* Search results */}
            {filteredStocks.length > 0 && (
              <div className="bg-slate-700 rounded-lg border border-slate-600 max-h-48 overflow-y-auto">
                {filteredStocks.map((stock: any) => (
                  <button
                    key={stock.ticker}
                    onClick={() => handleAddStock(stock)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-600 transition-colors text-left"
                  >
                    <StockLogo ticker={stock.ticker} companyName={stock.companyName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{stock.ticker}</p>
                      <p className="text-sm text-muted-foreground truncate">{stock.companyName}</p>
                    </div>
                    <Plus className="h-4 w-4 text-cyan-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Weight summary */}
          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Gesamtgewicht:</span>
              <span className={`font-bold ${Math.abs(totalWeight - 100) < 0.1 ? 'text-green-400' : 'text-yellow-400'}`}>
                {totalWeight.toFixed(2)}%
              </span>
            </div>
            {Math.abs(totalWeight - 100) > 0.1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleNormalizeWeights}
                className="text-cyan-400 border-cyan-400/50 hover:bg-cyan-400/10"
              >
                Auf 100% normalisieren
              </Button>
            )}
          </div>

          {/* Positions list */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Positionen ({stocks.length})</Label>
            
            {stocks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Keine Positionen vorhanden. Fügen Sie oben neue Positionen hinzu.
              </div>
            ) : (
              <div className="space-y-2">
                {stocks.map((stock) => (
                  <div
                    key={stock.ticker}
                    className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg border border-slate-600"
                  >
                    <StockLogo ticker={stock.ticker} companyName={stock.companyName} size="sm" />
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white">{stock.ticker}</p>
                      <p className="text-xs text-muted-foreground truncate">{stock.companyName}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={stock.weight}
                        onChange={(e) => handleWeightChange(stock.ticker, e.target.value)}
                        className="w-20 h-8 text-right bg-slate-600 border-slate-500 text-white"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveStock(stock.ticker)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-slate-700 pt-4">
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-muted-foreground hover:text-white"
            >
              <X className="h-4 w-4 mr-2" />
              Abbrechen
            </Button>
            
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updatePortfolio.isPending}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {updatePortfolio.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Speichern...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Änderungen speichern
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
