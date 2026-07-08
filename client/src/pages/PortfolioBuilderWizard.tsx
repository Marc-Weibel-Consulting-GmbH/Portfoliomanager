import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, Check, Search, Plus, X, TrendingUp, DollarSign, Scale, PieChart, LayoutTemplate, PencilRuler, Upload, Shield, Flame, Sparkles, Info, Target } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

type PortfolioType = "dividends" | "growth" | "balanced" | "etf";

type BuilderPath = "auto" | "manual" | "template" | "import";
type RiskProfile = "konservativ" | "mittel" | "mutig";

const pathOptions: Array<{
  value: BuilderPath;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    value: "auto",
    label: "Automatisch (KI)",
    icon: <Sparkles className="h-8 w-8" />,
    description: "Vorschlag aus Ihrem Anlageprofil — nach Scores, Regeln & Optimierung",
  },
  {
    value: "template",
    label: "Vorlage",
    icon: <LayoutTemplate className="h-8 w-8" />,
    description: "Starten Sie mit einer vorkonfigurierten Vorlage je nach Risikoprofil",
  },
  {
    value: "manual",
    label: "Manuell",
    icon: <PencilRuler className="h-8 w-8" />,
    description: "Erstellen Sie Ihr Portfolio Schritt für Schritt von Grund auf",
  },
  {
    value: "import",
    label: "Import",
    icon: <Upload className="h-8 w-8" />,
    description: "Übernehmen Sie Ihr bestehendes Depot aus einer Swissquote-PDF-Abrechnung",
  },
];

// Client-side template defaults per risk profile. There is no backend template
// endpoint, so each profile pre-seeds the manual wizard's initial state and then
// drops the user into the existing step flow (which ends with the same
// portfolios.create mutation).
const riskProfiles: Array<{
  value: RiskProfile;
  label: string;
  icon: React.ReactNode;
  description: string;
  portfolioType: PortfolioType;
  defaultName: string;
}> = [
  {
    value: "konservativ",
    label: "Konservativ",
    icon: <Shield className="h-8 w-8" />,
    description: "Kapitalerhalt im Fokus – Schwerpunkt auf Dividenden & Stabilität",
    portfolioType: "dividends",
    defaultName: "Konservatives Portfolio",
  },
  {
    value: "mittel",
    label: "Mittel",
    icon: <Scale className="h-8 w-8" />,
    description: "Ausgewogene Mischung aus Wachstum und laufenden Erträgen",
    portfolioType: "balanced",
    defaultName: "Ausgewogenes Portfolio",
  },
  {
    value: "mutig",
    label: "Mutig",
    icon: <Flame className="h-8 w-8" />,
    description: "Maximales Wachstum – Schwerpunkt auf Wachstumswerten",
    portfolioType: "growth",
    defaultName: "Wachstums-Portfolio",
  },
];

type StockSelection = {
  ticker: string;
  companyName: string;
  quantity: number;
  purchasePrice: number;
  assetType: "stock" | "bond" | "etf";
};

const portfolioTypes: Array<{
  value: PortfolioType;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    value: "dividends",
    label: "Dividenden",
    icon: <DollarSign className="h-8 w-8" />,
    description: "Fokus auf regelmäßige Dividendenerträge",
  },
  {
    value: "growth",
    label: "Wachstum",
    icon: <TrendingUp className="h-8 w-8" />,
    description: "Langfristiges Kapitalwachstum",
  },
  {
    value: "balanced",
    label: "Balanced",
    icon: <Scale className="h-8 w-8" />,
    description: "Ausgewogene Mischung aus Wachstum und Dividenden",
  },
  {
    value: "etf",
    label: "ETF",
    icon: <PieChart className="h-8 w-8" />,
    description: "Diversifizierung durch ETFs",
  },
];

export default function PortfolioBuilderWizard() {
  const [, navigate] = useLocation();
  // Step 0 = path picker; steps 1-5 = manual/template flow
  const [currentStep, setCurrentStep] = useState(0);
  const [path, setPath] = useState<BuilderPath | null>(null);
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null);

  // Step 1: Portfolio Type & Grundlagen
  const [portfolioType, setPortfolioType] = useState<PortfolioType | null>(null);
  const [portfolioName, setPortfolioName] = useState("");
  const [portfolioDescription, setPortfolioDescription] = useState("");
  const [currency, setCurrency] = useState("CHF");
  const [initialCapital, setInitialCapital] = useState("");
  
  // Step 2 & 3: Aktien, Anleihen & ETFs
  const [selectedStocks, setSelectedStocks] = useState<StockSelection[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState("");
  const [selectedPrice, setSelectedPrice] = useState("");
  const [perStockInputs, setPerStockInputs] = useState<Record<string, { quantity: string; price: string }>>({});
  
  // Step 4: Live Tracking
  const [isLive, setIsLive] = useState(false);
  
  // Queries
  const { data: allStocks = [] } = trpc.stocks.list.useQuery();
  const createPortfolioMutation = trpc.portfolios.create.useMutation();

  // F4: Auto-Portfolio (KI) — gated auf das Anlageprofil
  const { data: investmentProfile } = trpc.investmentProfile.get.useQuery();
  const [autoProposal, setAutoProposal] = useState<any | null>(null);
  const buildProposal = trpc.autoPortfolio.buildProposal.useMutation({
    onSuccess: (data) => setAutoProposal(data),
    onError: (e) => toast.error("Vorschlag konnte nicht erstellt werden", { description: e.message }),
  });
  
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
  
  const getStockInput = (ticker: string, field: 'quantity' | 'price') => {
    return perStockInputs[ticker]?.[field] || '';
  };
  const setStockInput = (ticker: string, field: 'quantity' | 'price', value: string) => {
    setPerStockInputs(prev => ({ ...prev, [ticker]: { ...prev[ticker], [field]: value } }));
  };

  const handleAddStock = (stock: typeof allStocks[0]) => {
    const inputs = perStockInputs[stock.ticker] || { quantity: '', price: '' };
    const quantity = parseFloat(inputs.quantity) || 10;
    // Use current stock price as fallback if user didn't enter a price
    const price = parseFloat(inputs.price) || parseFloat(stock.currentPrice || '0');
    
    if (!quantity || quantity <= 0) {
      toast.error("Bitte geben Sie eine gültige Anzahl ein");
      return;
    }
    
    if (!price || price <= 0) {
      toast.error("Kein aktueller Preis verfügbar. Bitte geben Sie einen Preis ein.");
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
    
    setPerStockInputs(prev => {
      const next = { ...prev };
      delete next[stock.ticker];
      return next;
    });
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
  
  const startManual = () => {
    setPath("manual");
    setRiskProfile(null);
    setCurrentStep(1);
  };

  // U-02: Importpfad — legt ein leeres Live-Portfolio mit den Grunddaten an und
  // führt direkt zum Swissquote-PDF-Import auf der Detailseite (?import=1
  // öffnet den Import-Dialog dort automatisch). Live, weil der Import echte
  // Transaktionen erfasst (Demo-Portfolios haben keine Transaktionen).
  const handleCreateImportPortfolio = async () => {
    if (!portfolioName.trim()) {
      toast.error("Bitte geben Sie einen Portfolio-Namen ein");
      return;
    }
    const capital = parseFloat(initialCapital);
    if (!(capital > 0)) {
      toast.error("Bitte geben Sie Ihr Startkapital ein");
      return;
    }
    try {
      const result = await createPortfolioMutation.mutateAsync({
        name: portfolioName,
        description: portfolioDescription || undefined,
        portfolioData: JSON.stringify({ stocks: [] }),
        investmentAmount: capital,
        portfolioType: "live",
      });
      if (result?.portfolio?.id) {
        toast.success("Portfolio erstellt — Sie können jetzt Ihr Swissquote-PDF hochladen");
        navigate(`/portfolios/${result.portfolio.id}?tab=transaktionen&import=1`);
      } else {
        navigate("/portfolios");
      }
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Erstellen des Portfolios");
    }
  };

  // F4: KI-Vorschlag in den Builder übernehmen (seedet Schritt 1-5 wie die Vorlage).
  const handleAcceptProposal = () => {
    if (!autoProposal?.positions?.length) return;
    const capital = parseFloat(initialCapital) || 0;
    const seeded: StockSelection[] = autoProposal.positions.map((p: any) => {
      const value = (p.weightPct / 100) * capital;
      const qty = p.currentPrice > 0 ? value / p.currentPrice : 0;
      return {
        ticker: p.ticker,
        companyName: p.companyName,
        quantity: parseFloat(qty.toFixed(4)),
        purchasePrice: p.currentPrice,
        assetType: "stock" as const,
      };
    });
    setSelectedStocks(seeded);
    const goalToType: Record<string, PortfolioType> = { dividends: "dividends", growth: "growth", balanced: "balanced" };
    setPortfolioType(goalToType[autoProposal.profile?.investmentGoal] ?? "balanced");
    if (!portfolioName.trim()) setPortfolioName("KI-Portfolio");
    setPath("auto");
    setCurrentStep(1);
  };

  const startTemplate = (profile: RiskProfile) => {
    const preset = riskProfiles.find((p) => p.value === profile);
    if (!preset) return;
    setPath("template");
    setRiskProfile(profile);
    // Pre-seed the manual wizard's initial state with sensible defaults.
    setPortfolioType(preset.portfolioType);
    if (!portfolioName.trim()) {
      setPortfolioName(preset.defaultName);
    }
    setCurrentStep(1);
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!portfolioType) {
        toast.error("Bitte wählen Sie einen Portfolio-Typ");
        return;
      }
      if (!portfolioName.trim()) {
        toast.error("Bitte geben Sie einen Portfolio-Namen ein");
        return;
      }
    }
    
    // When leaving step 2 or 3: auto-add any pending inputs that have quantity filled (use current price as fallback)
    if (currentStep === 2 || currentStep === 3) {
      const pendingTickers = Object.entries(perStockInputs).filter(([ticker, inputs]) => {
        const qty = parseFloat(inputs.quantity);
        if (!(qty > 0)) return false;
        if (selectedStocks.some(s => s.ticker === ticker)) return false;
        // Accept if user typed a price OR if the stock has a current price we can use
        const price = parseFloat(inputs.price);
        if (price > 0) return true;
        const stockInfo = allStocks.find(s => s.ticker === ticker);
        const fallbackPrice = parseFloat(stockInfo?.currentPrice || '0');
        return fallbackPrice > 0;
      });
      
      if (pendingTickers.length > 0) {
        const newStocks: StockSelection[] = [];
        for (const [ticker, inputs] of pendingTickers) {
          const stockInfo = allStocks.find(s => s.ticker === ticker);
          if (stockInfo) {
            const assetType: "stock" | "bond" | "etf" = 
              stockInfo.category === "ETF" ? "etf" :
              stockInfo.category?.includes("Anleihe") ? "bond" :
              "stock";
            const price = parseFloat(inputs.price) || parseFloat(stockInfo.currentPrice || '0');
            newStocks.push({
              ticker,
              companyName: stockInfo.companyName,
              quantity: parseFloat(inputs.quantity),
              purchasePrice: price,
              assetType,
            });
          }
        }
        if (newStocks.length > 0) {
          setSelectedStocks(prev => [...prev, ...newStocks]);
          setPerStockInputs(prev => {
            const next = { ...prev };
            newStocks.forEach(s => delete next[s.ticker]);
            return next;
          });
          toast.success(`${newStocks.length} Position(en) automatisch hinzugefügt`);
        }
      }
      
      // Block transition from step 3 to step 4 if no positions at all
      if (currentStep === 3 && selectedStocks.length === 0 && pendingTickers.length === 0) {
        toast.error("Bitte fügen Sie mindestens eine Position hinzu, bevor Sie fortfahren");
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
    } else if (currentStep === 1) {
      // Back from step 1 returns to the path picker
      setCurrentStep(0);
      setPath(null);
      setRiskProfile(null);
    }
  };
  
  const handleFinish = async () => {
    if (selectedStocks.length === 0) {
      toast.error("Bitte fügen Sie mindestens eine Position hinzu");
      return;
    }
    
    try {
      const allocation = calculateAllocation();
      const portfolioData = {
        stocks: selectedStocks.map((s) => {
          const alloc = allocation.find((a) => a.ticker === s.ticker);
          return {
            ticker: s.ticker,
            companyName: s.companyName,
            weight: alloc?.weight || 0,
            shares: s.quantity.toFixed(6),
            currentPrice: s.purchasePrice.toFixed(2),
            avgBuyPrice: s.purchasePrice.toFixed(2),
            totalValue: (s.quantity * s.purchasePrice).toFixed(2),
            currency: currency || 'CHF',
            assetType: s.assetType,
          };
        }),
      };
      
      const result = await createPortfolioMutation.mutateAsync({
        name: portfolioName,
        description: portfolioDescription || undefined,
        portfolioData: JSON.stringify(portfolioData),
        investmentAmount: parseFloat(initialCapital) || 0,
        portfolioType: isLive ? "live" : "demo",
      });
      
      // U-12: nur ein Erfolgs-Toast — kein ?onboarding=success mehr (löste auf
      // der Detailseite einen zweiten Toast aus)
      toast.success("Portfolio erstellt 🎉");
      if (result?.portfolio?.id) {
        navigate(`/portfolios/${result.portfolio.id}`);
      } else {
        navigate('/portfolios');
      }
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
  
  // ── Step 0: Path picker ──
  if (currentStep === 0) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 text-white">Wählen Sie Ihren Pfad</h1>
              <p className="text-gray-400">
                Wie möchten Sie Ihr Portfolio erstellen?
              </p>
            </div>
            {/* U-09: sichtbarer Ausstieg aus dem Builder (auch in Schritt 0) */}
            <button
              onClick={() => navigate("/portfolios")}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors shrink-0"
              aria-label="Abbrechen und zurück zu den Portfolios"
            >
              <X className="h-4 w-4" />
              Abbrechen
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {pathOptions.map((option) => (
              <Card
                key={option.value}
                className={`cursor-pointer transition-all bg-gradient-to-b from-[#1a1f2e] to-[#0f1420] hover:border-[#00CFC1]/60 ${
                  path === option.value
                    ? "border-[#00CFC1] ring-2 ring-[#00CFC1]/30"
                    : "border-white/10"
                }`}
                onClick={() => setPath(option.value)}
              >
                <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                  <div className={path === option.value ? "text-[#00CFC1]" : "text-gray-400"}>
                    {option.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-white">{option.label}</h3>
                    <p className="text-sm text-gray-400 mt-1">{option.description}</p>
                  </div>
                  {path === option.value && (
                    <Badge className="mt-2 bg-[#00CFC1] text-[#0a0f1a] hover:bg-[#00CFC1]">
                      <Check className="h-3 w-3 mr-1" />
                      Ausgewählt
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Template: risk profile choice */}
          {path === "template" && (
            <Card className="bg-gradient-to-b from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20 mb-8">
              <CardHeader>
                <CardTitle className="text-white">Risikoprofil wählen</CardTitle>
                <CardDescription className="text-gray-400">
                  Ihr Profil bestimmt den vorausgewählten Portfolio-Typ. Sie können
                  alles in den folgenden Schritten anpassen.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {riskProfiles.map((profile) => (
                    <Card
                      key={profile.value}
                      className={`cursor-pointer transition-all bg-[#0f1420] hover:border-[#00CFC1]/60 ${
                        riskProfile === profile.value
                          ? "border-[#00CFC1] ring-2 ring-[#00CFC1]/30"
                          : "border-white/10"
                      }`}
                      onClick={() => setRiskProfile(profile.value)}
                    >
                      <CardContent className="p-5 flex flex-col items-center text-center space-y-2">
                        <div className={riskProfile === profile.value ? "text-[#00CFC1]" : "text-gray-400"}>
                          {profile.icon}
                        </div>
                        <h4 className="font-semibold text-white">{profile.label}</h4>
                        <p className="text-xs text-gray-400">{profile.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="flex justify-end mt-6">
                  <Button
                    className="bg-[#00CFC1] text-[#0a0f1a] hover:bg-[#00CFC1]/90"
                    disabled={!riskProfile}
                    onClick={() => riskProfile && startTemplate(riskProfile)}
                  >
                    Vorlage verwenden
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Auto (KI): gated auf Anlageprofil → Vorschlag → Übernahme in den Builder */}
          {path === "auto" && (
            <Card className="bg-gradient-to-b from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20 mb-8">
              <CardHeader>
                <CardTitle className="text-white">Automatischer Portfolio-Vorschlag</CardTitle>
                <CardDescription className="text-gray-400">
                  Die KI stellt aus Ihrem Anlageprofil einen Vorschlag zusammen — bewertet nach
                  Momentum/Qualität, gefiltert nach Ihren Zielen und gewichtet unter den
                  Diversifikationsregeln. Sie prüfen und bestätigen alles in den folgenden Schritten.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!investmentProfile?.isSet ? (
                  <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/40 rounded-lg px-4 py-3">
                    <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-200">
                      Für den automatischen Vorschlag benötigen wir zuerst Ihr Anlageprofil
                      (Risikoprofil + Anlageziele).{" "}
                      <button
                        onClick={() => navigate("/einstellungen?tab=anlageprofil")}
                        className="underline font-semibold text-amber-100 hover:text-white"
                      >
                        Jetzt Anlageprofil festlegen
                      </button>
                      .
                    </p>
                  </div>
                ) : !autoProposal ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Target className="w-4 h-4 text-[#00CFC1]" />
                      <span className="text-gray-400">Ihr Profil:</span>
                      <span className="text-white font-medium capitalize">{investmentProfile.riskProfile}</span>
                      <span className="text-gray-600">·</span>
                      <span className="text-white font-medium capitalize">{investmentProfile.investmentGoal}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="auto-name" className="text-gray-300">Portfolio-Name</Label>
                        <Input
                          id="auto-name"
                          placeholder="z.B. Mein KI-Portfolio"
                          value={portfolioName}
                          onChange={(e) => setPortfolioName(e.target.value)}
                          className="bg-[#0f1420] border-white/10 text-white"
                        />
                      </div>
                      <div>
                        <Label htmlFor="auto-capital" className="text-gray-300">Anlagebetrag (CHF) *</Label>
                        <Input
                          id="auto-capital"
                          type="number"
                          placeholder="z.B. 50000"
                          value={initialCapital}
                          onChange={(e) => setInitialCapital(e.target.value)}
                          className="bg-[#0f1420] border-white/10 text-white"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        className="bg-[#00CFC1] text-[#0a0f1a] hover:bg-[#00CFC1]/90"
                        disabled={buildProposal.isPending || !(parseFloat(initialCapital) > 0)}
                        onClick={() => buildProposal.mutate({ investmentAmount: parseFloat(initialCapital) || undefined })}
                      >
                        <Sparkles className="h-4 w-4 mr-1" />
                        {buildProposal.isPending ? "Vorschlag wird erstellt…" : "KI-Vorschlag erstellen"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                      <span className="px-2 py-0.5 rounded bg-[#00CFC1]/15 text-[#00CFC1] font-medium">
                        {autoProposal.positions.length} Titel
                      </span>
                      <span>Methode: {autoProposal.methodLabel}</span>
                      <span>·</span>
                      <span>{autoProposal.stats.scoredCount} Titel bewertet, {autoProposal.stats.buySignals} Kaufsignale</span>
                    </div>
                    <div className="divide-y divide-white/5 border border-white/10 rounded-lg overflow-hidden">
                      {autoProposal.positions.map((p: any) => (
                        <div key={p.ticker} className="flex items-center justify-between px-4 py-2.5 bg-[#0f1420]">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-[#00CFC1]">{p.ticker}</span>
                              <span className="text-sm text-white truncate">{p.companyName}</span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">{p.sector} · {p.reason}</p>
                          </div>
                          <span className="text-sm font-mono font-semibold text-white ml-3 shrink-0">{p.weightPct.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600">
                      ⚠️ Automatischer Vorschlag auf Basis historischer Daten — keine Anlageberatung.
                      Sie können jede Position in den nächsten Schritten anpassen.
                    </p>
                    <div className="flex justify-between">
                      <Button variant="outline" className="border-white/10 text-gray-300"
                        onClick={() => setAutoProposal(null)} disabled={buildProposal.isPending}>
                        Neu erstellen
                      </Button>
                      <Button className="bg-[#00CFC1] text-[#0a0f1a] hover:bg-[#00CFC1]/90" onClick={handleAcceptProposal}>
                        In den Builder übernehmen
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Manual: start the existing 5-step wizard */}
          {path === "manual" && (
            <div className="flex justify-end mb-8">
              <Button
                className="bg-[#00CFC1] text-[#0a0f1a] hover:bg-[#00CFC1]/90"
                onClick={startManual}
              >
                Manuell starten
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Import: Portfolio-Grunddaten anlegen, dann direkt zum Swissquote-PDF-Import (U-02) */}
          {path === "import" && (
            <Card className="bg-gradient-to-b from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
              <CardHeader>
                <CardTitle className="text-white">Depot aus Swissquote-PDF übernehmen</CardTitle>
                <CardDescription className="text-gray-400">
                  So funktioniert es: Sie legen zuerst Ihr Portfolio mit den Grunddaten an.
                  Direkt danach laden Sie Ihre Swissquote-Transaktionsbelege als PDF hoch —
                  Käufe, Verkäufe, Dividenden und Einzahlungen werden automatisch erkannt
                  und vor der Übernahme zur Überprüfung angezeigt.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="import-name" className="text-gray-300">Portfolio-Name *</Label>
                  <Input
                    id="import-name"
                    placeholder="z.B. Mein Swissquote-Depot"
                    value={portfolioName}
                    onChange={(e) => setPortfolioName(e.target.value)}
                    className="bg-[#0f1420] border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="import-capital" className="text-gray-300">Startkapital (CHF) *</Label>
                  <Input
                    id="import-capital"
                    type="number"
                    placeholder="z.B. 50000"
                    value={initialCapital}
                    onChange={(e) => setInitialCapital(e.target.value)}
                    className="bg-[#0f1420] border-white/10 text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Der Betrag, den Sie insgesamt in dieses Depot eingezahlt haben.
                  </p>
                </div>
                <div>
                  <Label htmlFor="import-description" className="text-gray-300">Beschreibung (optional)</Label>
                  <Textarea
                    id="import-description"
                    placeholder="z.B. Übertrag meines Swissquote-Depots"
                    value={portfolioDescription}
                    onChange={(e) => setPortfolioDescription(e.target.value)}
                    rows={2}
                    className="bg-[#0f1420] border-white/10 text-white"
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    className="bg-[#00CFC1] text-[#0a0f1a] hover:bg-[#00CFC1]/90"
                    disabled={createPortfolioMutation.isPending}
                    onClick={handleCreateImportPortfolio}
                  >
                    {createPortfolioMutation.isPending ? "Portfolio wird angelegt…" : "Portfolio anlegen & PDF importieren"}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Portfolio erstellen</h1>
            <p className="text-muted-foreground">
              {path === "template"
                ? "Vorlage angepasst – verfeinern Sie Ihr Portfolio in 5 Schritten"
                : "Erstellen Sie Ihr Portfolio in 5 einfachen Schritten"}
            </p>
          </div>
          {/* U-09: sichtbarer Ausstieg aus dem Builder auf jedem Schritt */}
          <button
            onClick={() => navigate("/portfolios")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Abbrechen und zurück zu den Portfolios"
          >
            <X className="h-4 w-4" />
            Abbrechen
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Schritt {currentStep} von {totalSteps}</span>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />

          <div className="flex justify-between mt-4 text-xs text-muted-foreground">
            <span className={currentStep === 1 ? "text-primary font-medium" : ""}>Portfolio-Typ</span>
            <span className={currentStep === 2 ? "text-primary font-medium" : ""}>Aktien</span>
            <span className={currentStep === 3 ? "text-primary font-medium" : ""}>Anleihen & ETFs</span>
            <span className={currentStep === 4 ? "text-primary font-medium" : ""}>Details</span>
            <span className={currentStep === 5 ? "text-primary font-medium" : ""}>Abschluss</span>
          </div>
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>
              {currentStep === 1 && "Portfolio-Typ & Grundlagen"}
              {currentStep === 2 && "Aktien auswählen"}
              {currentStep === 3 && "Anleihen & ETFs auswählen"}
              {currentStep === 4 && "Portfolio-Details"}
              {currentStep === 5 && "Zusammenfassung"}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && "Wählen Sie Ihren Portfolio-Typ und definieren Sie die Basis-Informationen"}
              {currentStep === 2 && "Wählen Sie Aktien aus und geben Sie Ihre Positionen ein"}
              {currentStep === 3 && "Ergänzen Sie Ihr Portfolio mit Anleihen und ETFs"}
              {currentStep === 4 && "Konfigurieren Sie Live-Tracking und weitere Details"}
              {currentStep === 5 && "Überprüfen Sie alle Details und erstellen Sie Ihr Portfolio"}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Step 1: Portfolio Type & Grundlagen */}
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* Portfolio Type Selection */}
                <div>
                  <Label className="text-base font-semibold mb-4 block">Portfolio-Typ wählen *</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {portfolioTypes.map((type) => (
                      <Card
                        key={type.value}
                        className={`cursor-pointer transition-all hover:border-primary ${
                          portfolioType === type.value
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        }`}
                        onClick={() => setPortfolioType(type.value)}
                      >
                        <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                          <div className={portfolioType === type.value ? "text-primary" : "text-muted-foreground"}>
                            {type.icon}
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{type.label}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                          </div>
                          {portfolioType === type.value && (
                            <Badge variant="default" className="mt-2">
                              <Check className="h-3 w-3 mr-1" />
                              Ausgewählt
                            </Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Basic Information */}
                <div className="space-y-4 pt-4 border-t">
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
              </div>
            )}
            
            {/* Step 2 & 3: Stock Selection */}
            {(currentStep === 2 || currentStep === 3) && (
              <div className="space-y-6">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={currentStep === 2 ? "Aktien suchen..." : "Anleihen & ETFs suchen..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {/* Selected Stocks Panel */}
                {selectedStocks.length > 0 && (
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Ausgewählte Positionen ({selectedStocks.length})</h3>
                      <Badge variant="outline">
                        Gesamtwert: {currency} {totalValue.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {selectedStocks.map((stock) => {
                        const alloc = allocation.find((a) => a.ticker === stock.ticker);
                        return (
                          <div key={stock.ticker} className="flex items-center justify-between p-3 bg-background rounded-md">
                            <div className="flex-1">
                              <div className="font-medium">{stock.ticker}</div>
                              <div className="text-sm text-muted-foreground">{stock.companyName}</div>
                            </div>
                            <div className="text-right mr-4">
                              <div className="text-sm font-medium">{stock.quantity} × {currency} {stock.purchasePrice.toFixed(2)}</div>
                              <div className="text-xs text-muted-foreground">
                                {alloc ? `${alloc.weight.toFixed(1)}%` : ""}
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
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Stock List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredStocks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchQuery ? "Keine Ergebnisse gefunden" : "Keine Aktien verfügbar"}
                    </div>
                  ) : (
                    filteredStocks.map((stock) => {
                      const isSelected = selectedStocks.some((s) => s.ticker === stock.ticker);
                      return (
                        <Card key={stock.ticker} className={isSelected ? "opacity-50" : ""}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold">{stock.ticker}</span>
                                  {stock.category && (
                                    <Badge variant="outline" className="text-xs">
                                      {stock.category}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">{stock.companyName}</div>
                                {stock.currentPrice && !isNaN(parseFloat(stock.currentPrice)) && parseFloat(stock.currentPrice) > 0 && (
                                  <div className="text-sm mt-1">
                                    Aktueller Preis: {stock.currency} {parseFloat(stock.currentPrice).toFixed(2)}
                                  </div>
                                )}
                                {stock.currentPrice && (isNaN(parseFloat(stock.currentPrice)) || parseFloat(stock.currentPrice) <= 0) && (
                                  <div className="text-sm mt-1 text-yellow-500">
                                    Kein aktueller Preis verfügbar
                                  </div>
                                )}
                              </div>
                              
                              {!isSelected && (
                                <div className="flex items-end gap-2">
                                  <div>
                                    <Label className="text-xs">Anzahl</Label>
                                    <Input
                                      type="number"
                                      placeholder="10"
                                      value={getStockInput(stock.ticker, 'quantity')}
                                      onChange={(e) => setStockInput(stock.ticker, 'quantity', e.target.value)}
                                      className="w-20"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Preis</Label>
                                    <Input
                                      type="number"
                                      placeholder={stock.currentPrice && !isNaN(parseFloat(stock.currentPrice)) && parseFloat(stock.currentPrice) > 0 ? stock.currentPrice : "Preis eingeben"}
                                      value={getStockInput(stock.ticker, 'price')}
                                      onChange={(e) => setStockInput(stock.ticker, 'price', e.target.value)}
                                      className="w-24"
                                    />
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => handleAddStock(stock)}
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Hinzufügen
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
              </div>
            )}
            
            {/* Step 4: Portfolio Details & Live Tracking */}
            {currentStep === 4 && (
              <div className="space-y-6">
                {/* Live Tracking Toggle */}
                <Card className="border-2">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">Live-Tracking aktivieren</h3>
                          {isLive && (
                            <Badge variant="default" className="bg-green-500">
                              <span className="relative flex h-2 w-2 mr-1">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                              </span>
                              Live
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Mit Live-Tracking können Sie Transaktionen verfolgen und die Performance Ihres Portfolios in Echtzeit analysieren (IRR/MWR).
                          Dies ist eine Premium-Funktion.
                        </p>
                        {isLive && (
                          <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-900">
                            <p className="text-sm text-green-800 dark:text-green-200">
                              ✓ Live-Tracking ist aktiviert. Sie können nach der Erstellung Transaktionen hinzufügen und die Performance verfolgen.
                            </p>
                          </div>
                        )}
                      </div>
                      <Switch
                        checked={isLive}
                        onCheckedChange={setIsLive}
                        className="ml-4"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Asset Allocation Overview */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Asset-Verteilung</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {assetTypeBreakdown.stocks.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">Aktien</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {assetTypeBreakdown.bonds.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">Anleihen</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {assetTypeBreakdown.etfs.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">ETFs</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Holdings Summary */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Positionen ({selectedStocks.length})</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-3 text-sm font-medium">Ticker</th>
                          <th className="text-right p-3 text-sm font-medium">Anzahl</th>
                          <th className="text-right p-3 text-sm font-medium">Preis</th>
                          <th className="text-right p-3 text-sm font-medium">Wert</th>
                          <th className="text-right p-3 text-sm font-medium">Gewichtung</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allocation.map((item) => (
                          <tr key={item.ticker} className="border-t">
                            <td className="p-3">
                              <div className="font-medium">{item.ticker}</div>
                              <div className="text-xs text-muted-foreground">{item.companyName}</div>
                            </td>
                            <td className="text-right p-3">{item.quantity}</td>
                            <td className="text-right p-3">{currency} {item.purchasePrice.toFixed(2)}</td>
                            <td className="text-right p-3">{currency} {item.value.toFixed(2)}</td>
                            <td className="text-right p-3">
                              <Badge variant="outline">{item.weight.toFixed(1)}%</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted font-semibold">
                        <tr>
                          <td className="p-3" colSpan={3}>Gesamt</td>
                          <td className="text-right p-3">{currency} {totalValue.toFixed(2)}</td>
                          <td className="text-right p-3">100.0%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}
            
            {/* Step 5: Summary */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm text-muted-foreground">Portfolio-Typ</Label>
                    <div className="mt-1 flex items-center gap-2">
                      {portfolioTypes.find((t) => t.value === portfolioType)?.icon}
                      <span className="font-semibold text-lg">
                        {portfolioTypes.find((t) => t.value === portfolioType)?.label}
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Live-Tracking</Label>
                    <div className="mt-1">
                      {isLive ? (
                        <Badge variant="default" className="bg-green-500">
                          <span className="relative flex h-2 w-2 mr-1">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                          </span>
                          Aktiviert
                        </Badge>
                      ) : (
                        <Badge variant="outline">Deaktiviert</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">Portfolio-Name</Label>
                  <div className="mt-1 font-semibold text-lg">{portfolioName}</div>
                </div>

                {portfolioDescription && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Beschreibung</Label>
                    <div className="mt-1 text-sm">{portfolioDescription}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm text-muted-foreground">Währung</Label>
                    <div className="mt-1 font-medium">{currency}</div>
                  </div>
                  {initialCapital && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Startkapital</Label>
                      <div className="mt-1 font-medium">
                        {currency} {parseFloat(initialCapital).toLocaleString("de-CH")}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground mb-3 block">Positionen ({selectedStocks.length})</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-2 font-medium">Ticker</th>
                          <th className="text-right p-2 font-medium">Anzahl</th>
                          <th className="text-right p-2 font-medium">Preis</th>
                          <th className="text-right p-2 font-medium">Wert</th>
                          <th className="text-right p-2 font-medium">Gewichtung</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allocation.map((item) => (
                          <tr key={item.ticker} className="border-t">
                            <td className="p-2 font-medium">{item.ticker}</td>
                            <td className="text-right p-2">{item.quantity}</td>
                            <td className="text-right p-2">{currency} {item.purchasePrice.toFixed(2)}</td>
                            <td className="text-right p-2">{currency} {item.value.toFixed(2)}</td>
                            <td className="text-right p-2">{item.weight.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted font-semibold">
                        <tr>
                          <td className="p-2" colSpan={3}>Gesamt</td>
                          <td className="text-right p-2">{currency} {totalValue.toFixed(2)}</td>
                          <td className="text-right p-2">100.0%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    <p className="text-sm text-center">
                      Durch Klicken auf "Portfolio erstellen" bestätigen Sie, dass alle Angaben korrekt sind.
                      {isLive && " Ihr Portfolio wird für Live-Tracking aktiviert."}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={handleBack}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Zurück
          </Button>
          
          {currentStep < totalSteps ? (
            <Button onClick={handleNext}>
              Weiter
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={createPortfolioMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-1" />
              {createPortfolioMutation.isPending ? "Erstelle..." : "Portfolio erstellen"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
