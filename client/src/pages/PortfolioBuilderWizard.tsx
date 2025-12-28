import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Check, Search, Plus, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

type StockSelection = {
  ticker: string;
  companyName: string;
  quantity: number;
  purchasePrice: number;
  assetType: "stock" | "bond" | "etf";
};

export default function PortfolioBuilderWizard() {
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1: Grundlagen
  const [portfolioName, setPortfolioName] = useState("");
  const [portfolioDescription, setPortfolioDescription] = useState("");
  const [currency, setCurrency] = useState("CHF");
  const [initialCapital, setInitialCapital] = useState("");
  
  // Step 2 & 3: Aktien, Anleihen & ETFs
  const [selectedStocks, setSelectedStocks] = useState<StockSelection[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState("");
  const [selectedPrice, setSelectedPrice] = useState("");
  
  // Queries
  const { data: allStocks = [] } = trpc.stocks.list.useQuery();
  const createPortfolioMutation = trpc.portfolios.create.useMutation();
  
  const totalSteps = 5;
  const progress = (currentStep / totalSteps) * 100;
  
  // Filter stocks based on search and current step
  const filteredStocks = allStocks.filter((stock) => {
    const matchesSearch = 
      stock.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.companyName.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (currentStep === 2) {
      // Step 2: Only stocks
      return matchesSearch && stock.category !== "ETF";
    } else if (currentStep === 3) {
      // Step 3: Bonds & ETFs
      return matchesSearch && (stock.category === "ETF" || stock.category?.includes("Anleihe"));
    }
    return matchesSearch;
  });
  
  const handleAddStock = (stock: typeof allStocks[0]) => {
    const quantity = parseFloat(selectedQuantity);
    const price = parseFloat(selectedPrice);
    
    if (!quantity || quantity <= 0) {
      toast.error("Bitte geben Sie eine gültige Anzahl ein");
      return;
    }
    
    if (!price || price <= 0) {
      toast.error("Bitte geben Sie einen gültigen Preis ein");
      return;
    }
    
    const assetType: "stock" | "bond" | "etf" = 
      stock.category === "ETF" ? "etf" :
      stock.category?.includes("Anleihe") ? "bond" :
      "stock";
    
    setSelectedStocks([
      ...selectedStocks,
      {
        ticker: stock.ticker,
        companyName: stock.companyName,
        quantity,
        purchasePrice: price,
        assetType,
      },
    ]);
    
    setSelectedQuantity("");
    setSelectedPrice("");
    setSearchQuery("");
    toast.success(`${stock.ticker} hinzugefügt`);
  };
  
  const handleRemoveStock = (ticker: string) => {
    setSelectedStocks(selectedStocks.filter((s) => s.ticker !== ticker));
    toast.success("Position entfernt");
  };
  
  const calculateAllocation = () => {
    const totalValue = selectedStocks.reduce(
      (sum, stock) => sum + stock.quantity * stock.purchasePrice,
      0
    );
    
    return selectedStocks.map((stock) => ({
      ...stock,
      value: stock.quantity * stock.purchasePrice,
      weight: ((stock.quantity * stock.purchasePrice) / totalValue) * 100,
    }));
  };
  
  const handleNext = () => {
    if (currentStep === 1) {
      if (!portfolioName.trim()) {
        toast.error("Bitte geben Sie einen Portfolio-Namen ein");
        return;
      }
    }
    
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };
  
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const handleFinish = async () => {
    if (selectedStocks.length === 0) {
      toast.error("Bitte fügen Sie mindestens eine Position hinzu");
      return;
    }
    
    try {
      const portfolioData = {
        stocks: selectedStocks.map((s) => ({
          ticker: s.ticker,
          weight: calculateAllocation().find((a) => a.ticker === s.ticker)?.weight || 0,
        })),
      };
      
      await createPortfolioMutation.mutateAsync({
        name: portfolioName,
        description: portfolioDescription || undefined,
        portfolioData: JSON.stringify(portfolioData),
        isLive: false,
      });
      
      toast.success("Portfolio erfolgreich erstellt!");
      navigate("/portfolios");
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Erstellen des Portfolios");
    }
  };
  
  const allocation = calculateAllocation();
  const totalValue = allocation.reduce((sum, item) => sum + item.value, 0);
  
  const assetTypeBreakdown = {
    stocks: allocation.filter((a) => a.assetType === "stock").reduce((sum, a) => sum + a.weight, 0),
    bonds: allocation.filter((a) => a.assetType === "bond").reduce((sum, a) => sum + a.weight, 0),
    etfs: allocation.filter((a) => a.assetType === "etf").reduce((sum, a) => sum + a.weight, 0),
  };
  
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Portfolio erstellen</h1>
          <p className="text-muted-foreground">
            Erstellen Sie Ihr Portfolio in 5 einfachen Schritten
          </p>
        </div>
        
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Schritt {currentStep} von {totalSteps}</span>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          
          <div className="flex justify-between mt-4 text-xs text-muted-foreground">
            <span className={currentStep === 1 ? "text-primary font-medium" : ""}>Grundlagen</span>
            <span className={currentStep === 2 ? "text-primary font-medium" : ""}>Aktien</span>
            <span className={currentStep === 3 ? "text-primary font-medium" : ""}>Anleihen & ETFs</span>
            <span className={currentStep === 4 ? "text-primary font-medium" : ""}>Verteilung</span>
            <span className={currentStep === 5 ? "text-primary font-medium" : ""}>Abschluss</span>
          </div>
        </div>
        
        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>
              {currentStep === 1 && "Portfolio-Grundlagen"}
              {currentStep === 2 && "Aktien auswählen"}
              {currentStep === 3 && "Anleihen & ETFs auswählen"}
              {currentStep === 4 && "Verteilung & Risiko"}
              {currentStep === 5 && "Zusammenfassung"}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && "Definieren Sie die Basis-Informationen für Ihr Portfolio"}
              {currentStep === 2 && "Wählen Sie Aktien aus und geben Sie Ihre Positionen ein"}
              {currentStep === 3 && "Ergänzen Sie Ihr Portfolio mit Anleihen und ETFs"}
              {currentStep === 4 && "Überprüfen Sie die Asset-Verteilung und Risikometriken"}
              {currentStep === 5 && "Überprüfen Sie alle Details und erstellen Sie Ihr Portfolio"}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Step 1: Grundlagen */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Portfolio-Name *</Label>
                  <Input
                    id="name"
                    placeholder="z.B. Mein Dividenden-Portfolio"
                    value={portfolioName}
                    onChange={(e) => setPortfolioName(e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Beschreibung (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Beschreiben Sie Ihre Anlagestrategie..."
                    value={portfolioDescription}
                    onChange={(e) => setPortfolioDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="currency">Währung</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CHF">CHF (Schweizer Franken)</SelectItem>
                        <SelectItem value="USD">USD (US-Dollar)</SelectItem>
                        <SelectItem value="EUR">EUR (Euro)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="capital">Startkapital (optional)</Label>
                    <Input
                      id="capital"
                      type="number"
                      placeholder="10000"
                      value={initialCapital}
                      onChange={(e) => setInitialCapital(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Step 2 & 3: Stock Selection */}
            {(currentStep === 2 || currentStep === 3) && (
              <div className="space-y-6">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Ticker oder Firmenname suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {/* Selected Stocks Summary */}
                {selectedStocks.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-medium mb-3">Ausgewählte Positionen ({selectedStocks.length})</h4>
                    <div className="space-y-2">
                      {selectedStocks.map((stock) => (
                        <div key={stock.ticker} className="flex items-center justify-between bg-background rounded p-2">
                          <div className="flex items-center gap-3">
                            <Badge variant={
                              stock.assetType === "stock" ? "default" :
                              stock.assetType === "etf" ? "secondary" :
                              "outline"
                            }>
                              {stock.assetType === "stock" ? "Aktie" :
                               stock.assetType === "etf" ? "ETF" : "Anleihe"}
                            </Badge>
                            <div>
                              <div className="font-medium">{stock.ticker}</div>
                              <div className="text-sm text-muted-foreground">
                                {stock.quantity} × {stock.purchasePrice} {currency}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveStock(stock.ticker)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Stock List */}
                {searchQuery && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredStocks.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Keine Ergebnisse gefunden
                      </p>
                    ) : (
                      filteredStocks.slice(0, 10).map((stock) => {
                        const isSelected = selectedStocks.some((s) => s.ticker === stock.ticker);
                        
                        return (
                          <Card key={stock.ticker} className={isSelected ? "opacity-50" : ""}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold">{stock.ticker}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {stock.category || "Aktie"}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground mb-2">
                                    {stock.companyName}
                                  </p>
                                  <div className="text-sm">
                                    Aktueller Preis: <span className="font-medium">{stock.currentPrice} {stock.currency}</span>
                                  </div>
                                </div>
                                
                                {!isSelected && (
                                  <div className="flex gap-2">
                                    <Input
                                      type="number"
                                      placeholder="Anzahl"
                                      value={selectedQuantity}
                                      onChange={(e) => setSelectedQuantity(e.target.value)}
                                      className="w-24"
                                    />
                                    <Input
                                      type="number"
                                      placeholder="Preis"
                                      value={selectedPrice}
                                      onChange={(e) => setSelectedPrice(e.target.value)}
                                      className="w-24"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => handleAddStock(stock)}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Step 4: Allocation & Risk */}
            {currentStep === 4 && (
              <div className="space-y-6">
                {selectedStocks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Keine Positionen ausgewählt. Gehen Sie zurück und fügen Sie Positionen hinzu.
                  </p>
                ) : (
                  <>
                    {/* Asset Type Breakdown */}
                    <div>
                      <h4 className="font-medium mb-3">Asset-Verteilung</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Aktien</span>
                          <span className="text-sm font-medium">{assetTypeBreakdown.stocks.toFixed(1)}%</span>
                        </div>
                        <Progress value={assetTypeBreakdown.stocks} className="h-2" />
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm">ETFs</span>
                          <span className="text-sm font-medium">{assetTypeBreakdown.etfs.toFixed(1)}%</span>
                        </div>
                        <Progress value={assetTypeBreakdown.etfs} className="h-2" />
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Anleihen</span>
                          <span className="text-sm font-medium">{assetTypeBreakdown.bonds.toFixed(1)}%</span>
                        </div>
                        <Progress value={assetTypeBreakdown.bonds} className="h-2" />
                      </div>
                    </div>
                    
                    {/* Position Weights */}
                    <div>
                      <h4 className="font-medium mb-3">Positions-Gewichtung</h4>
                      <div className="space-y-2">
                        {allocation.map((item) => (
                          <div key={item.ticker} className="flex items-center justify-between text-sm">
                            <span>{item.ticker}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground">
                                {item.value.toFixed(2)} {currency}
                              </span>
                              <span className="font-medium w-16 text-right">
                                {item.weight.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="mt-4 pt-4 border-t flex items-center justify-between font-medium">
                        <span>Gesamt</span>
                        <span>{totalValue.toFixed(2)} {currency}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            
            {/* Step 5: Summary */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div>
                    <span className="text-sm text-muted-foreground">Portfolio-Name</span>
                    <p className="font-medium">{portfolioName}</p>
                  </div>
                  
                  {portfolioDescription && (
                    <div>
                      <span className="text-sm text-muted-foreground">Beschreibung</span>
                      <p className="text-sm">{portfolioDescription}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Währung</span>
                      <p className="font-medium">{currency}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Positionen</span>
                      <p className="font-medium">{selectedStocks.length}</p>
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-sm text-muted-foreground">Gesamtwert</span>
                    <p className="text-2xl font-bold">{totalValue.toFixed(2)} {currency}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">Positionen</h4>
                  <div className="space-y-2">
                    {allocation.map((item) => (
                      <div key={item.ticker} className="flex items-center justify-between p-3 bg-muted/30 rounded">
                        <div>
                          <div className="font-medium">{item.ticker}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.quantity} × {item.purchasePrice} {currency}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{item.value.toFixed(2)} {currency}</div>
                          <div className="text-sm text-muted-foreground">{item.weight.toFixed(1)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          
          {currentStep < totalSteps ? (
            <Button onClick={handleNext}>
              Weiter
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={createPortfolioMutation.isPending}>
              <Check className="h-4 w-4 mr-2" />
              {createPortfolioMutation.isPending ? "Erstelle..." : "Portfolio erstellen"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
