import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  ChevronLeft, ChevronRight, Check, Search, Plus, X,
  TrendingUp, DollarSign, Scale, PieChart, PencilRuler,
  Upload, Shield, Flame, Sparkles, Clock, Ban, Leaf,
  ArrowDownCircle, ArrowUpCircle, RefreshCw, CheckCircle, ShieldCheck
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

// ─── Types ───────────────────────────────────────────────────────────────────

type PortfolioType = "dividends" | "growth" | "balanced" | "etf";
type BuilderPath = "auto" | "manual" | "import";

// Sub-steps for the Auto (KI) flow
// autoStep 1 = Anlageziel, 2 = Risikoprofil, 3 = Anlagehorizont,
// 4 = Ausgeschlossene Sektoren, 5 = Portfolio-Details + KI-Vorschlag
type AutoStep = 1 | 2 | 3 | 4 | 5;

type StockSelection = {
  ticker: string;
  companyName: string;
  quantity: number;
  purchasePrice: number;
  assetType: "stock" | "bond" | "etf";
};

// ─── Static data ─────────────────────────────────────────────────────────────

const pathOptions: Array<{ value: BuilderPath; label: string; icon: React.ReactNode; description: string }> = [
  {
    value: "auto",
    label: "Automatisch (KI)",
    icon: <Sparkles className="h-8 w-8" />,
    description: "KI erstellt Ihren Vorschlag basierend auf Ihrem Anlageprofil — bewertet nach Scores, Regeln & Optimierung",
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

const portfolioTypes: Array<{ value: PortfolioType; label: string; icon: React.ReactNode; description: string }> = [
  { value: "dividends", label: "Dividenden", icon: <DollarSign className="h-8 w-8" />, description: "Fokus auf regelmäßige Dividendenerträge" },
  { value: "growth", label: "Wachstum", icon: <TrendingUp className="h-8 w-8" />, description: "Langfristiges Kapitalwachstum" },
  { value: "balanced", label: "Balanced", icon: <Scale className="h-8 w-8" />, description: "Ausgewogene Mischung aus Wachstum und Dividenden" },
  { value: "etf", label: "ETF", icon: <PieChart className="h-8 w-8" />, description: "Diversifizierung durch ETFs" },
];

// Auto-flow step data
const autoStepMeta: Record<AutoStep, { title: string; subtitle: string }> = {
  1: { title: "Was ist Ihr Anlageziel?", subtitle: "Wählen Sie das Ziel, das am besten zu Ihnen passt" },
  2: { title: "Wie viel Schwankung akzeptieren Sie?", subtitle: "Ihr Risikoprofil bestimmt die Zusammensetzung" },
  3: { title: "Wie lange möchten Sie anlegen?", subtitle: "Der Anlagehorizont beeinflusst die Titelauswahl" },
  4: { title: "Welche Sektoren möchten Sie ausschliessen?", subtitle: "Optional — lassen Sie alle leer, wenn keine Einschränkungen gewünscht" },
  5: { title: "Portfolio-Details & KI-Vorschlag", subtitle: "Geben Sie Ihrem Portfolio einen Namen und starten Sie die KI-Analyse" },
};

const INVESTMENT_GOALS = [
  { value: "dividends", label: "Dividenden & Ertrag", description: "Regelmässige Ausschüttungen, stabile Titel", icon: <DollarSign className="h-7 w-7" /> },
  { value: "growth", label: "Wachstum", description: "Langfristiger Kapitalzuwachs, Wachstumswerte", icon: <TrendingUp className="h-7 w-7" /> },
  { value: "balanced", label: "Ertrag & Wachstum", description: "Kombination aus Ertrag und Wachstum", icon: <Scale className="h-7 w-7" /> },
];

const RISK_PROFILES = [
  { value: "konservativ", label: "Konservativ", description: "Kapitalerhalt im Fokus, geringe Schwankungen akzeptiert", icon: <Shield className="h-7 w-7" /> },
  { value: "ausgewogen", label: "Ausgewogen", description: "Moderate Schwankungen für bessere Rendite", icon: <Scale className="h-7 w-7" /> },
  { value: "wachstum", label: "Wachstum", description: "Höhere Schwankungen für mehr Rendite", icon: <TrendingUp className="h-7 w-7" /> },
  { value: "aggressiv", label: "Aggressiv", description: "Maximale Rendite, hohe Schwankungen bewusst akzeptiert", icon: <Flame className="h-7 w-7" /> },
];

const HORIZONS = [
  { value: 2, label: "1–3 Jahre", description: "Kurzfristig — Kapital bald benötigt", icon: <Clock className="h-7 w-7" /> },
  { value: 5, label: "3–7 Jahre", description: "Mittelfristig — moderater Zeithorizont", icon: <Clock className="h-7 w-7" /> },
  { value: 10, label: "7–15 Jahre", description: "Langfristig — Zeit für Wachstum", icon: <Clock className="h-7 w-7" /> },
  { value: 20, label: "15+ Jahre", description: "Sehr langfristig — maximales Wachstumspotenzial", icon: <Clock className="h-7 w-7" /> },
];

// Values must match DB sector names exactly for filtering to work in buildProposal
const EXCLUDED_SECTORS = [
  { value: "Energy", label: "Energie (u. a. Öl & Gas)", icon: <Flame className="h-5 w-5" /> },
  { value: "Industrials", label: "Industrie (u. a. Rüstung)", icon: <Shield className="h-5 w-5" /> },
  { value: "Consumer", label: "Basiskonsum (u. a. Alkohol & Tabak)", icon: <Ban className="h-5 w-5" /> },
  { value: "Consumer Cyclical", label: "Zyklischer Konsum (u. a. Glücksspiel, Handel, Reisen)", icon: <Ban className="h-5 w-5" /> },
  { value: "Finance", label: "Finanzsektor", icon: <Ban className="h-5 w-5" /> },
  { value: "Telecommunications", label: "Telekommunikation", icon: <Ban className="h-5 w-5" /> },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PortfolioBuilderWizard() {
  const [location, navigate] = useLocation();

  // ── Global state ──
  const [currentStep, setCurrentStep] = useState(0); // 0 = path picker, 1-5 = manual flow
  const [path, setPath] = useState<BuilderPath | null>(null);

  // ── Auto (KI) sub-flow state ──
  const [autoStep, setAutoStep] = useState<AutoStep>(1);
  const [autoGoal, setAutoGoal] = useState<string>("balanced");
  const [autoRisk, setAutoRisk] = useState<string>("ausgewogen");
  const [autoHorizon, setAutoHorizon] = useState<number>(10);
  const [autoExcluded, setAutoExcluded] = useState<string[]>([]);
  const [autoProposal, setAutoProposal] = useState<any | null>(null);

  // ── Manual / shared state ──
  const [portfolioType, setPortfolioType] = useState<PortfolioType | null>(null);
  const [portfolioName, setPortfolioName] = useState("");
  const [portfolioDescription, setPortfolioDescription] = useState("");
  const [currency, setCurrency] = useState("CHF");
  const [initialCapital, setInitialCapital] = useState("");
  const [selectedStocks, setSelectedStocks] = useState<StockSelection[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [perStockInputs, setPerStockInputs] = useState<Record<string, { quantity: string; price: string }>>({});
  const [isLive, setIsLive] = useState(false);
  const [isAiOptimized, setIsAiOptimized] = useState(false); // true wenn aus KI-angepasstem Vorschlag

  // ── Queries & mutations ──
  const { data: savedProfile } = trpc.investmentProfile.get.useQuery();
  const { data: allStocks = [] } = trpc.stocks.list.useQuery();
  const createPortfolioMutation = trpc.portfolios.create.useMutation();
  const setProfileMutation = trpc.investmentProfile.set.useMutation();
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === 'admin';

  const buildProposal = trpc.autoPortfolio.buildProposal.useMutation({
    onSuccess: (data) => setAutoProposal(data),
    onError: (e) => toast.error("Vorschlag konnte nicht erstellt werden", { description: e.message }),
  });

  // Reset all wizard state whenever the user navigates (back) to /portfolio-builder.
  // Using location as dependency ensures the reset fires on every visit, not just on first mount.
  useEffect(() => {
    if (location === "/portfolio-builder") {
      setCurrentStep(0);
      setPath(null);
      setAutoStep(1);
      setAutoGoal("balanced");
      setAutoRisk("ausgewogen");
      setAutoHorizon(10);
      setAutoExcluded([]);
      setAutoProposal(null);
      setPortfolioType(null);
      setPortfolioName("");
      setPortfolioDescription("");
      setCurrency("CHF");
      setInitialCapital("");
      setSelectedStocks([]);
      setSearchQuery("");
      setPerStockInputs({});
      setIsLive(false);
    }
  }, [location]); // fires on every navigation to this route

  // Pre-fill auto wizard from saved profile when user selects auto path
  useEffect(() => {
    if (savedProfile && path === "auto") {
      if (savedProfile.investmentGoal) setAutoGoal(savedProfile.investmentGoal);
      if (savedProfile.riskProfile) setAutoRisk(savedProfile.riskProfile);
      if (savedProfile.investmentHorizonYears) {
        const yr = savedProfile.investmentHorizonYears;
        setAutoHorizon(yr <= 3 ? 2 : yr <= 7 ? 5 : yr <= 15 ? 10 : 20);
      }
      if (Array.isArray(savedProfile.excludedSectors) && savedProfile.excludedSectors.length > 0) {
        setAutoExcluded(savedProfile.excludedSectors);
      }
    }
  }, [savedProfile, path]);

  // ── Derived ──
  const totalSteps = 5;
  const progress = (currentStep / totalSteps) * 100;

  const filteredStocks = allStocks.filter((stock) => {
    const matchesSearch =
      stock.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.companyName.toLowerCase().includes(searchQuery.toLowerCase());
    if (currentStep === 2) return matchesSearch && stock.category !== "ETF";
    if (currentStep === 3) return matchesSearch && (stock.category === "ETF" || stock.category?.includes("Anleihe"));
    return matchesSearch;
  });

  const getStockInput = (ticker: string, field: "quantity" | "price") => perStockInputs[ticker]?.[field] || "";
  const setStockInput = (ticker: string, field: "quantity" | "price", value: string) =>
    setPerStockInputs((prev) => ({ ...prev, [ticker]: { ...prev[ticker], [field]: value } }));

  const calculateAllocation = () => {
    const totalValue = selectedStocks.reduce((sum, s) => sum + s.quantity * s.purchasePrice, 0);
    return selectedStocks.map((s) => ({
      ...s,
      value: s.quantity * s.purchasePrice,
      weight: ((s.quantity * s.purchasePrice) / totalValue) * 100,
    }));
  };

  const allocation = calculateAllocation();
  const totalValue = allocation.reduce((sum, item) => sum + item.value, 0);
  const assetTypeBreakdown = {
    stocks: allocation.filter((a) => a.assetType === "stock").reduce((sum, a) => sum + a.weight, 0),
    bonds: allocation.filter((a) => a.assetType === "bond").reduce((sum, a) => sum + a.weight, 0),
    etfs: allocation.filter((a) => a.assetType === "etf").reduce((sum, a) => sum + a.weight, 0),
  };

  // ── Handlers ──

  const handleAddStock = (stock: (typeof allStocks)[0]) => {
    const inputs = perStockInputs[stock.ticker] || { quantity: "", price: "" };
    const quantity = parseFloat(inputs.quantity) || 10;
    const price = parseFloat(inputs.price) || parseFloat(stock.currentPrice || "0");
    if (!quantity || quantity <= 0) { toast.error("Bitte geben Sie eine gültige Anzahl ein"); return; }
    if (!price || price <= 0) { toast.error("Kein aktueller Preis verfügbar. Bitte geben Sie einen Preis ein."); return; }
    const assetType: "stock" | "bond" | "etf" =
      stock.category === "ETF" ? "etf" : stock.category?.includes("Anleihe") ? "bond" : "stock";
    setSelectedStocks([...selectedStocks, { ticker: stock.ticker, companyName: stock.companyName, quantity, purchasePrice: price, assetType }]);
    setPerStockInputs((prev) => { const next = { ...prev }; delete next[stock.ticker]; return next; });
    setSearchQuery("");
    toast.success(`${stock.ticker} hinzugefügt`);
  };

  const handleRemoveStock = (ticker: string) => {
    setSelectedStocks(selectedStocks.filter((s) => s.ticker !== ticker));
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!portfolioType) { toast.error("Bitte wählen Sie einen Portfolio-Typ"); return; }
      if (!portfolioName.trim()) { toast.error("Bitte geben Sie einen Portfolio-Namen ein"); return; }
    }
    if (currentStep === 2 || currentStep === 3) {
      const pendingTickers = Object.entries(perStockInputs).filter(([ticker, inputs]) => {
        const qty = parseFloat(inputs.quantity);
        if (!(qty > 0)) return false;
        if (selectedStocks.some((s) => s.ticker === ticker)) return false;
        const price = parseFloat(inputs.price);
        if (price > 0) return true;
        const stockInfo = allStocks.find((s) => s.ticker === ticker);
        return parseFloat(stockInfo?.currentPrice || "0") > 0;
      });
      if (pendingTickers.length > 0) {
        const newStocks: StockSelection[] = [];
        for (const [ticker, inputs] of pendingTickers) {
          const stockInfo = allStocks.find((s) => s.ticker === ticker);
          if (stockInfo) {
            const assetType: "stock" | "bond" | "etf" =
              stockInfo.category === "ETF" ? "etf" : stockInfo.category?.includes("Anleihe") ? "bond" : "stock";
            const price = parseFloat(inputs.price) || parseFloat(stockInfo.currentPrice || "0");
            newStocks.push({ ticker, companyName: stockInfo.companyName, quantity: parseFloat(inputs.quantity), purchasePrice: price, assetType });
          }
        }
        if (newStocks.length > 0) {
          setSelectedStocks((prev) => [...prev, ...newStocks]);
          setPerStockInputs((prev) => { const next = { ...prev }; newStocks.forEach((s) => delete next[s.ticker]); return next; });
          toast.success(`${newStocks.length} Position(en) automatisch hinzugefügt`);
        }
      }
      if (currentStep === 3 && selectedStocks.length === 0 && pendingTickers.length === 0) {
        toast.error("Bitte fügen Sie mindestens eine Position hinzu, bevor Sie fortfahren");
        return;
      }
    }
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else if (currentStep === 1) {
      setCurrentStep(0);
      setPath(null);
    }
  };

  const handleFinish = async () => {
    if (selectedStocks.length === 0) { toast.error("Bitte fügen Sie mindestens eine Position hinzu"); return; }
    try {
      const alloc = calculateAllocation();
      const portfolioData = {
        stocks: selectedStocks.map((s) => {
          const a = alloc.find((x) => x.ticker === s.ticker);
          return {
            ticker: s.ticker, companyName: s.companyName,
            weight: a?.weight || 0, shares: s.quantity.toFixed(6),
            currentPrice: s.purchasePrice.toFixed(2), avgBuyPrice: s.purchasePrice.toFixed(2),
            totalValue: (s.quantity * s.purchasePrice).toFixed(2),
            currency: currency || "CHF", assetType: s.assetType,
          };
        }),
      };
      const result = await createPortfolioMutation.mutateAsync({
        name: portfolioName, description: portfolioDescription || undefined,
        portfolioData: JSON.stringify(portfolioData),
        investmentAmount: parseFloat(initialCapital) || 0,
        portfolioType: isLive ? "live" : "demo",
        isAiOptimized,
      });
      toast.success("Portfolio erstellt 🎉");
      if (result?.portfolio?.id) navigate(`/portfolios/${result.portfolio.id}`);
      else navigate("/portfolios");
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Erstellen des Portfolios");
    }
  };

  const handleCreateImportPortfolio = async () => {
    if (!portfolioName.trim()) { toast.error("Bitte geben Sie einen Portfolio-Namen ein"); return; }
    const capital = parseFloat(initialCapital);
    if (!(capital > 0)) { toast.error("Bitte geben Sie Ihr Startkapital ein"); return; }
    try {
      const result = await createPortfolioMutation.mutateAsync({
        name: portfolioName, description: portfolioDescription || undefined,
        portfolioData: JSON.stringify({ stocks: [] }),
        investmentAmount: capital, portfolioType: "live",
      });
      if (result?.portfolio?.id) {
        toast.success("Portfolio erstellt — Sie können jetzt Ihr Swissquote-PDF hochladen");
        navigate(`/portfolios/${result.portfolio.id}?tab=transaktionen&import=1`);
      } else navigate("/portfolios");
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Erstellen des Portfolios");
    }
  };

  // Save profile + trigger proposal
  const handleBuildProposal = async () => {
    const capital = parseFloat(initialCapital);
    if (!(capital > 0)) { toast.error("Bitte geben Sie einen Anlagebetrag ein"); return; }
    if (!portfolioName.trim()) setPortfolioName("KI-Portfolio");
    // Reset any previous mutation state so the button is re-enabled on retry
    buildProposal.reset();
    try {
      await setProfileMutation.mutateAsync({
        riskProfile: autoRisk as any,
        investmentHorizonYears: autoHorizon,
        maxDrawdownTolerancePct: autoRisk === "konservativ" ? 15 : autoRisk === "ausgewogen" ? 25 : autoRisk === "wachstum" ? 35 : 50,
        investmentGoal: autoGoal as any,
        // Gespeicherte Cash-Quote aus dem Anlegerprofil übernehmen (nicht überschreiben)
        liquidityNeedPct: savedProfile?.liquidityNeedPct ?? 0,
        excludedSectors: autoExcluded,
        esgOnly: false,
      });
    } catch (e) {
      // Non-fatal — continue even if profile save fails
      console.warn("[handleBuildProposal] Profile save failed (non-fatal):", e);
    }
    buildProposal.mutate({ investmentAmount: capital });
  };

  // Accepts the proposal — uses adjustedPositions (KI-Empfehlungen eingearbeitet) if available
  const handleAcceptProposal = (useAdjusted = true) => {
    if (!autoProposal?.positions?.length) return;
    const capital = parseFloat(initialCapital) || 0;
    // Use adjustedPositions (KI-Empfehlungen automatically applied) if available and requested
    const positionsToUse = (useAdjusted && (autoProposal as any).adjustedPositions?.length)
      ? (autoProposal as any).adjustedPositions
      : autoProposal.positions;
    // Track whether KI adjustments were applied
    setIsAiOptimized(useAdjusted && !!(autoProposal as any).adjustedPositions?.length);
    const seeded: StockSelection[] = positionsToUse.map((p: any) => {
      const value = (p.weightPct / 100) * capital;
      const fxRate = parseFloat(p.exchangeRateToChf || '1') || 1;
      const priceCHF = p.currentPrice * fxRate;
      const qty = priceCHF > 0 ? value / priceCHF : 0;
      return { ticker: p.ticker, companyName: p.companyName, quantity: parseFloat(qty.toFixed(4)), purchasePrice: priceCHF, assetType: "stock" as const };
    });
    setSelectedStocks(seeded);
    const goalToType: Record<string, PortfolioType> = { dividends: "dividends", growth: "growth", balanced: "balanced" };
    setPortfolioType(goalToType[autoGoal] ?? "balanced");
    if (!portfolioName.trim()) setPortfolioName("KI-Portfolio");
    setPath("auto");
    setCurrentStep(1);
  };

  const handleSendToAdminReview = () => {
    const logId = (autoProposal as any)?.proposalLogId;
    if (logId) {
      navigate(`/admin/proposal-analysis?proposalId=${logId}`);
    } else {
      navigate('/admin/proposal-analysis');
    }
  };

  const toggleExcluded = (sector: string) => {
    setAutoExcluded((prev) => prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ── RENDER: Step 0 — Path Picker ──────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────

  if (currentStep === 0 && path === null) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 text-white">Neues Portfolio erstellen</h1>
              <p className="text-gray-400">Wie möchten Sie Ihr Portfolio erstellen?</p>
            </div>
            <button onClick={() => navigate("/portfolios")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors shrink-0">
              <X className="h-4 w-4" /> Abbrechen
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {pathOptions.map((option) => (
              <Card
                key={option.value}
                className="cursor-pointer transition-all bg-gradient-to-b from-[#1a1f2e] to-[#0f1420] border-white/10 hover:border-[#00CFC1]/60 hover:ring-1 hover:ring-[#00CFC1]/20"
                onClick={() => { setPath(option.value); if (option.value === "manual") { setCurrentStep(1); } }}
              >
                <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                  <div className="text-[#00CFC1]">{option.icon}</div>
                  <div>
                    <h3 className="font-semibold text-xl text-white">{option.label}</h3>
                    <p className="text-sm text-gray-400 mt-2">{option.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── RENDER: Auto (KI) Flow ────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────

  if (currentStep === 0 && path === "auto") {
    const TOTAL_AUTO_STEPS = 5;
    const autoProgress = ((autoStep - 1) / TOTAL_AUTO_STEPS) * 100;
    const meta = autoStepMeta[autoStep];

    const goNextAuto = () => {
      if (autoStep < TOTAL_AUTO_STEPS) setAutoStep((s) => (s + 1) as AutoStep);
    };
    const goPrevAuto = () => {
      if (autoStep > 1) setAutoStep((s) => (s - 1) as AutoStep);
      else { setPath(null); }
    };

    return (
      <div className="h-screen bg-[#0a0f1a] flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-2 text-[#00CFC1]">
            <Sparkles className="h-5 w-5" />
            <span className="font-semibold text-white">KI-Portfolio erstellen</span>
          </div>
          <button onClick={() => navigate("/portfolios")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors">
            <X className="h-4 w-4" /> Abbrechen
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Schritt {autoStep} von {TOTAL_AUTO_STEPS}</span>
            <span className="text-xs text-gray-500">{Math.round(autoProgress)}%</span>
          </div>
          <Progress value={autoProgress} className="h-1 bg-white/10" />
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 overflow-y-auto">
          <div className="w-full max-w-2xl">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">{meta.title}</h2>
            <p className="text-gray-400 mb-8">{meta.subtitle}</p>

            {/* Step 1: Anlageziel */}
            {autoStep === 1 && (
              <div className="space-y-3">
                {INVESTMENT_GOALS.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => setAutoGoal(g.value)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                      autoGoal === g.value
                        ? "border-[#00CFC1] bg-[#00CFC1]/10 ring-1 ring-[#00CFC1]/30"
                        : "border-white/10 bg-[#1a1f2e] hover:border-white/30"
                    }`}
                  >
                    <div className={autoGoal === g.value ? "text-[#00CFC1]" : "text-gray-400"}>{g.icon}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-white">{g.label}</div>
                      <div className="text-sm text-gray-400">{g.description}</div>
                    </div>
                    {autoGoal === g.value && <Check className="h-5 w-5 text-[#00CFC1] shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Risikoprofil */}
            {autoStep === 2 && (
              <div className="space-y-3">
                {RISK_PROFILES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setAutoRisk(r.value)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                      autoRisk === r.value
                        ? "border-[#00CFC1] bg-[#00CFC1]/10 ring-1 ring-[#00CFC1]/30"
                        : "border-white/10 bg-[#1a1f2e] hover:border-white/30"
                    }`}
                  >
                    <div className={autoRisk === r.value ? "text-[#00CFC1]" : "text-gray-400"}>{r.icon}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-white">{r.label}</div>
                      <div className="text-sm text-gray-400">{r.description}</div>
                    </div>
                    {autoRisk === r.value && <Check className="h-5 w-5 text-[#00CFC1] shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            {/* Step 3: Anlagehorizont */}
            {autoStep === 3 && (
              <div className="space-y-3">
                {HORIZONS.map((h) => (
                  <button
                    key={h.value}
                    onClick={() => setAutoHorizon(h.value)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                      autoHorizon === h.value
                        ? "border-[#00CFC1] bg-[#00CFC1]/10 ring-1 ring-[#00CFC1]/30"
                        : "border-white/10 bg-[#1a1f2e] hover:border-white/30"
                    }`}
                  >
                    <div className={autoHorizon === h.value ? "text-[#00CFC1]" : "text-gray-400"}>{h.icon}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-white">{h.label}</div>
                      <div className="text-sm text-gray-400">{h.description}</div>
                    </div>
                    {autoHorizon === h.value && <Check className="h-5 w-5 text-[#00CFC1] shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            {/* Step 4: Ausgeschlossene Sektoren */}
            {autoStep === 4 && (
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {EXCLUDED_SECTORS.map((s) => {
                    const active = autoExcluded.includes(s.value);
                    return (
                      <button
                        key={s.value}
                        onClick={() => toggleExcluded(s.value)}
                        className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                          active
                            ? "border-red-500/60 bg-red-500/10 ring-1 ring-red-500/20"
                            : "border-white/10 bg-[#1a1f2e] hover:border-white/30"
                        }`}
                      >
                        <div className={active ? "text-red-400" : "text-gray-400"}>{s.icon}</div>
                        <span className={`text-sm font-medium ${active ? "text-red-300" : "text-white"}`}>{s.label}</span>
                        {active && <X className="h-4 w-4 text-red-400 ml-auto shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                {autoExcluded.length === 0 && (
                  <p className="text-sm text-gray-500 mt-4">Keine Sektoren ausgeschlossen — alle Titel werden berücksichtigt.</p>
                )}
              </div>
            )}

            {/* Step 5: Portfolio-Details + KI-Vorschlag */}
            {autoStep === 5 && (
              <div className="space-y-6">
                {/* Profile summary */}
                <div className="flex flex-wrap gap-2">
                  {[
                    INVESTMENT_GOALS.find((g) => g.value === autoGoal)?.label,
                    RISK_PROFILES.find((r) => r.value === autoRisk)?.label,
                    HORIZONS.find((h) => h.value === autoHorizon)?.label,
                  ].map((label, i) => label && (
                    <span key={i} className="px-3 py-1 rounded-full bg-[#00CFC1]/15 text-[#00CFC1] text-sm font-medium">
                      {label}
                    </span>
                  ))}
                  {autoExcluded.map((s) => (
                    <span key={s} className="px-3 py-1 rounded-full bg-red-500/15 text-red-400 text-sm">
                      Ohne {EXCLUDED_SECTORS.find((e) => e.value === s)?.label ?? s}
                    </span>
                  ))}
                </div>

                {/* Name + Capital */}
                {!autoProposal && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300">Portfolio-Name</Label>
                      <Input
                        placeholder="z.B. Mein KI-Portfolio"
                        value={portfolioName}
                        onChange={(e) => setPortfolioName(e.target.value)}
                        className="bg-[#0f1420] border-white/10 text-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300">Anlagebetrag (CHF) *</Label>
                      <Input
                        type="number"
                        placeholder="Min. CHF 100'000"
                        value={initialCapital}
                        onChange={(e) => setInitialCapital(e.target.value)}
                        className={`bg-[#0f1420] border-white/10 text-white mt-1 ${
                          initialCapital && parseFloat(initialCapital) > 0 && parseFloat(initialCapital) < 100000
                            ? "border-yellow-500/60"
                            : ""
                        }`}
                      />
                      {initialCapital && parseFloat(initialCapital) > 0 && parseFloat(initialCapital) < 100000 && (
                        <p className="text-xs text-yellow-400 mt-1">
                          Empfehlung: Mindestens CHF 100'000 für ein diversifiziertes Aktienportfolio.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Proposal result */}
                {autoProposal ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                      <span className="px-2 py-0.5 rounded bg-[#00CFC1]/15 text-[#00CFC1] font-medium">
                        {autoProposal.positions.length} Titel
                      </span>
                      <span>Methode: {autoProposal.methodLabel}</span>
                      <span>·</span>
                      <span>{autoProposal.stats.scoredCount} bewertet, {autoProposal.stats.buySignals} Kaufsignale</span>
                      {(autoProposal.stats as any).watchlistRecommendations > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-[#00CFC1]">
                            {(autoProposal.stats as any).watchlistRecommendations} Watchlist-Empfehlung{(autoProposal.stats as any).watchlistRecommendations > 1 ? "en" : ""}
                          </span>
                        </>
                      )}
                      {autoExcluded.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-red-400">
                            {autoExcluded.length} Sektor{autoExcluded.length > 1 ? "en" : ""} ausgeschlossen
                            {" ("}{autoExcluded.map((s) => EXCLUDED_SECTORS.find((e) => e.value === s)?.label ?? s).join(", ")}{")"}  
                          </span>
                        </>
                      )}
                      {autoProposal.profile?.referenceCurrency && (
                        <>
                          <span>·</span>
                          <span className="text-blue-300">
                            Ref.-Währung: {autoProposal.profile.referenceCurrency} · FX-Limit: {autoProposal.profile.maxFxExposurePct}%
                          </span>
                        </>
                      )}
                    </div>
                    {(autoProposal as any).weighting?.note && (
                      <p className="text-xs text-amber-400">
                        Hinweis zur Gewichtung: {(autoProposal as any).weighting.note}
                      </p>
                    )}
                    {/* Erwartete Kennzahlen des optimierten Vorschlags («was darf ich erwarten?») */}
                    {(autoProposal as any).metrics && (
                      <div className="flex flex-wrap gap-4 text-xs bg-[#0f1420] border border-white/10 rounded-lg px-4 py-2.5">
                        <span className="text-gray-400">Erwartet (historisch geschätzt):</span>
                        <span className="text-white font-mono">Rendite ~{(autoProposal as any).metrics.expectedReturnPct.toFixed(1)}% p.a.</span>
                        <span className="text-white font-mono">Schwankung ~{(autoProposal as any).metrics.volatilityPct.toFixed(1)}%</span>
                        <span className="text-white font-mono">Sharpe {(autoProposal as any).metrics.sharpe.toFixed(2)}</span>
                        {(autoProposal as any).allocation && (
                          <span className="text-gray-400">Fremdwährung {(autoProposal as any).allocation.fxWeightPct.toFixed(0)}%</span>
                        )}
                        {(autoProposal as any).profile?.liquidityNeedPct > 0 && (
                          <span className="text-emerald-400 font-mono">Cash-Reserve {(autoProposal as any).profile.liquidityNeedPct}%</span>
                        )}
                      </div>
                    )}
                    {/* Ehrliche Hinweise (ESG nicht verfügbar, Qualitätsstufe, Cap-Überschreitungen) */}
                    {Array.isArray((autoProposal as any).notes) && (autoProposal as any).notes.length > 0 && (
                      <div className="space-y-1">
                        {(autoProposal as any).notes.map((n: string, i: number) => (
                          <p key={i} className="text-xs text-amber-400">⚠ {n}</p>
                        ))}
                      </div>
                    )}
                    <div className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden">
                      {autoProposal.positions.map((p: any) => (
                        <div key={p.ticker} className="flex items-center justify-between px-4 py-3 bg-[#0f1420]">
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
                      {/* Cash-Reserve Position anzeigen wenn Cash-Quote > 0 */}
                      {(autoProposal as any).profile?.liquidityNeedPct > 0 && (
                        <div className="flex items-center justify-between px-4 py-3 bg-[#0f1420]">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-emerald-400">CASH</span>
                              <span className="text-sm text-white">Liquiditätsreserve</span>
                            </div>
                            <p className="text-xs text-gray-500">Gemäss Anlegerprofil — nicht investiert</p>
                          </div>
                          <span className="text-sm font-mono font-semibold text-emerald-400 ml-3 shrink-0">{(autoProposal as any).profile.liquidityNeedPct.toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                    {/* KI-Empfehlungen des Synthesizers (finalAdjustments) */}
                    {(autoProposal as any).finalAdjustments?.length > 0 && (
                      <div className="border border-white/10 rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-[#0f1420] border-b border-white/5 flex items-center gap-2">
                          <Sparkles className="h-3.5 w-3.5 text-[#00CFC1]" />
                          <span className="text-xs font-semibold text-[#00CFC1]">KI-Empfehlungen (Synthesizer)</span>
                          {(autoProposal as any).adjustedPositions && (
                            <span className="ml-auto text-xs text-emerald-400 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> Automatisch eingearbeitet
                            </span>
                          )}
                        </div>
                        <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
                          {(autoProposal as any).finalAdjustments.map((adj: any, i: number) => (
                            <div key={i} className="flex items-start gap-3 px-4 py-2.5 bg-[#0a0f1a]">
                              <span className={`shrink-0 mt-0.5 ${
                                adj.action === 'reduce' ? 'text-orange-400' :
                                adj.action === 'increase' ? 'text-emerald-400' :
                                adj.action === 'replace' ? 'text-blue-400' : 'text-gray-500'
                              }`}>
                                {adj.action === 'reduce' && <ArrowDownCircle className="h-3.5 w-3.5" />}
                                {adj.action === 'increase' && <ArrowUpCircle className="h-3.5 w-3.5" />}
                                {adj.action === 'replace' && <RefreshCw className="h-3.5 w-3.5" />}
                                {adj.action === 'keep' && <CheckCircle className="h-3.5 w-3.5" />}
                              </span>
                              <div className="min-w-0">
                                <span className={`text-xs font-semibold font-mono ${
                                  adj.action === 'reduce' ? 'text-orange-400' :
                                  adj.action === 'increase' ? 'text-emerald-400' :
                                  adj.action === 'replace' ? 'text-blue-400' : 'text-gray-400'
                                }`}>
                                  {adj.action === 'reduce' ? 'Reduzieren' :
                                   adj.action === 'increase' ? 'Aufstocken' :
                                   adj.action === 'replace' ? 'Austauschen' : 'Behalten'}: {adj.ticker}
                                </span>
                                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{adj.reason}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {(autoProposal as any).adjustedPositions && (
                          <div className="px-4 py-2 bg-emerald-500/5 border-t border-emerald-500/20">
                            <p className="text-xs text-emerald-400">Die angepassten Positionen wurden bereits in den Vorschlag eingearbeitet. Sie können diese in den nächsten Schritten weiter anpassen.</p>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-gray-600">
                      ⚠️ Automatischer Vorschlag auf Basis historischer Daten — keine Anlageberatung.
                    </p>
                    <div className="flex flex-col gap-2">
                      {/* Admin-Review Button (nur für Admins sichtbar) */}
                      {isAdmin && (
                        <div className="border border-amber-500/30 rounded-lg p-3 bg-amber-500/5">
                          <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck className="h-4 w-4 text-amber-400" />
                            <span className="text-xs font-semibold text-amber-400">Admin-Review</span>
                          </div>
                          <p className="text-xs text-gray-400 mb-2">Vorschlag im Admin-Bereich prüfen und genehmigen, bevor das Portfolio erstellt wird.</p>
                          <Button
                            variant="outline"
                            className="w-full border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-sm"
                            onClick={handleSendToAdminReview}
                          >
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            Im Admin-Bereich prüfen &amp; genehmigen
                          </Button>
                        </div>
                      )}
                      <div className="flex flex-wrap justify-between gap-3">
                        <Button variant="outline" className="border-white/10 text-gray-300"
                          onClick={() => setAutoProposal(null)} disabled={buildProposal.isPending}>
                          Neu erstellen
                        </Button>
                        <div className="flex gap-2 flex-wrap">
                          {(autoProposal as any).adjustedPositions && (
                            <Button
                              variant="outline"
                              className="border-white/20 text-gray-300 hover:bg-white/5 text-sm"
                              onClick={() => handleAcceptProposal(false)}
                              title="Roher Algorithmus-Vorschlag ohne KI-Anpassungen"
                            >
                              Ohne KI-Anpassungen
                            </Button>
                          )}
                          <Button className="bg-[#00CFC1] text-[#0a0f1a] hover:bg-[#00CFC1]/90 font-semibold" onClick={() => handleAcceptProposal(true)}>
                            {(autoProposal as any).adjustedPositions ? 'KI-Angepasst übernehmen' : 'In den Builder übernehmen'}
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button
                    className="bg-[#00CFC1] text-[#0a0f1a] hover:bg-[#00CFC1]/90 font-semibold w-full py-6 text-base"
                    disabled={buildProposal.isPending || setProfileMutation.isPending || !(parseFloat(initialCapital) > 0)}
                    onClick={handleBuildProposal}
                  >
                    <Sparkles className="h-5 w-5 mr-2" />
                    {buildProposal.isPending || setProfileMutation.isPending ? "Vorschlag wird erstellt…" : "KI-Vorschlag erstellen"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-[#0a0f1a] shrink-0">
          <button
            onClick={goPrevAuto}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Zurück
          </button>

          {/* Breadcrumb chips */}
          <div className="hidden md:flex items-center gap-2 text-xs text-gray-600">
            {autoStep > 1 && <span className="flex items-center gap-1"><Check className="h-3 w-3 text-[#00CFC1]" />{INVESTMENT_GOALS.find((g) => g.value === autoGoal)?.label}</span>}
            {autoStep > 2 && <span className="flex items-center gap-1"><Check className="h-3 w-3 text-[#00CFC1]" />{RISK_PROFILES.find((r) => r.value === autoRisk)?.label}</span>}
            {autoStep > 3 && <span className="flex items-center gap-1"><Check className="h-3 w-3 text-[#00CFC1]" />{HORIZONS.find((h) => h.value === autoHorizon)?.label}</span>}
          </div>

          {autoStep < TOTAL_AUTO_STEPS ? (
            <Button
              className="bg-[#00CFC1] text-[#0a0f1a] hover:bg-[#00CFC1]/90 font-semibold"
              onClick={goNextAuto}
            >
              Weiter
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <span /> // Step 5 has its own CTA button
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── RENDER: Import Flow ───────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────

  if (currentStep === 0 && path === "import") {
    return (
      <div className="min-h-screen bg-[#0a0f1a] p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <button onClick={() => setPath(null)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-3">
                <ChevronLeft className="h-4 w-4" /> Zurück
              </button>
              <h1 className="text-3xl font-bold mb-2 text-white">Depot importieren</h1>
              <p className="text-gray-400">Übernehmen Sie Ihr bestehendes Depot aus einer Swissquote-PDF-Abrechnung.</p>
            </div>
            <button onClick={() => navigate("/portfolios")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors shrink-0">
              <X className="h-4 w-4" /> Abbrechen
            </button>
          </div>
          <Card className="bg-gradient-to-b from-[#1a1f2e] to-[#0f1420] border-white/10">
            <CardContent className="p-6 space-y-4">
              <div>
                <Label className="text-gray-300">Portfolio-Name *</Label>
                <Input id="import-name" placeholder="z.B. Mein Swissquote-Depot" value={portfolioName}
                  onChange={(e) => setPortfolioName(e.target.value)} className="bg-[#0f1420] border-white/10 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-300">Startkapital (CHF) *</Label>
                <Input id="import-capital" type="number" placeholder="z.B. 50000" value={initialCapital}
                  onChange={(e) => setInitialCapital(e.target.value)} className="bg-[#0f1420] border-white/10 text-white mt-1" />
                <p className="text-xs text-gray-500 mt-1">Der Betrag, den Sie insgesamt in dieses Depot eingezahlt haben.</p>
              </div>
              <div>
                <Label className="text-gray-300">Beschreibung (optional)</Label>
                <Textarea placeholder="z.B. Übertrag meines Swissquote-Depots" value={portfolioDescription}
                  onChange={(e) => setPortfolioDescription(e.target.value)} rows={2}
                  className="bg-[#0f1420] border-white/10 text-white mt-1" />
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="outline" className="border-white/10 text-gray-300" onClick={() => setPath(null)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Zurück
                </Button>
                <Button className="bg-[#00CFC1] text-[#0a0f1a] hover:bg-[#00CFC1]/90"
                  disabled={createPortfolioMutation.isPending} onClick={handleCreateImportPortfolio}>
                  {createPortfolioMutation.isPending ? "Portfolio wird angelegt…" : "Portfolio anlegen & PDF importieren"}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── RENDER: Manual 5-Step Flow (steps 1–5) ────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Portfolio erstellen</h1>
            <p className="text-muted-foreground">
              {path === "auto" ? "KI-Vorschlag verfeinern — 5 Schritte" : "Erstellen Sie Ihr Portfolio in 5 einfachen Schritten"}
            </p>
          </div>
          <button onClick={() => navigate("/portfolios")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <X className="h-4 w-4" /> Abbrechen
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
            {["Portfolio-Typ", "Aktien", "Anleihen & ETFs", "Details", "Abschluss"].map((label, i) => (
              <span key={label} className={currentStep === i + 1 ? "text-primary font-medium" : ""}>{label}</span>
            ))}
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
            {/* Step 1 */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-base font-semibold mb-4 block">Portfolio-Typ wählen *</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {portfolioTypes.map((type) => (
                      <Card key={type.value} className={`cursor-pointer transition-all hover:border-primary ${portfolioType === type.value ? "border-primary bg-primary/5" : "border-border"}`}
                        onClick={() => setPortfolioType(type.value)}>
                        <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                          <div className={portfolioType === type.value ? "text-primary" : "text-muted-foreground"}>{type.icon}</div>
                          <div>
                            <h3 className="font-semibold text-lg">{type.label}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                          </div>
                          {portfolioType === type.value && <Badge variant="default" className="mt-2"><Check className="h-3 w-3 mr-1" />Ausgewählt</Badge>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <Label htmlFor="name">Portfolio-Name *</Label>
                    <Input id="name" placeholder="z.B. Mein Dividenden-Portfolio" value={portfolioName} onChange={(e) => setPortfolioName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="description">Beschreibung (optional)</Label>
                    <Textarea id="description" placeholder="Beschreiben Sie Ihre Anlagestrategie..." value={portfolioDescription} onChange={(e) => setPortfolioDescription(e.target.value)} rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="currency">Währung</Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CHF">CHF (Schweizer Franken)</SelectItem>
                          <SelectItem value="USD">USD (US-Dollar)</SelectItem>
                          <SelectItem value="EUR">EUR (Euro)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="capital">Startkapital (optional)</Label>
                      <Input id="capital" type="number" placeholder="10000" value={initialCapital} onChange={(e) => setInitialCapital(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Steps 2 & 3 */}
            {(currentStep === 2 || currentStep === 3) && (
              <div className="space-y-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder={currentStep === 2 ? "Aktien suchen..." : "Anleihen & ETFs suchen..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                </div>
                {selectedStocks.length > 0 && (
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Ausgewählte Positionen ({selectedStocks.length})</h3>
                      <Badge variant="outline">Gesamtwert: {currency} {totalValue.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Badge>
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
                              <div className="text-xs text-muted-foreground">{alloc ? `${alloc.weight.toFixed(1)}%` : ""}</div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveStock(stock.ticker)}><X className="h-4 w-4" /></Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredStocks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">{searchQuery ? "Keine Ergebnisse gefunden" : "Keine Aktien verfügbar"}</div>
                  ) : filteredStocks.map((stock) => {
                    const isSelected = selectedStocks.some((s) => s.ticker === stock.ticker);
                    return (
                      <Card key={stock.ticker} className={isSelected ? "opacity-50" : ""}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold">{stock.ticker}</span>
                                {stock.category && <Badge variant="outline" className="text-xs">{stock.category}</Badge>}
                              </div>
                              <div className="text-sm text-muted-foreground">{stock.companyName}</div>
                              {stock.currentPrice && !isNaN(parseFloat(stock.currentPrice)) && parseFloat(stock.currentPrice) > 0 && (
                                <div className="text-sm mt-1">Aktueller Preis: {stock.currency} {parseFloat(stock.currentPrice).toFixed(2)}</div>
                              )}
                            </div>
                            {!isSelected && (
                              <div className="flex items-end gap-2">
                                <div>
                                  <Label className="text-xs">Anzahl</Label>
                                  <Input type="number" placeholder="10" value={getStockInput(stock.ticker, "quantity")} onChange={(e) => setStockInput(stock.ticker, "quantity", e.target.value)} className="w-20" />
                                </div>
                                <div>
                                  <Label className="text-xs">Preis</Label>
                                  <Input type="number" placeholder={stock.currentPrice || "Preis"} value={getStockInput(stock.ticker, "price")} onChange={(e) => setStockInput(stock.ticker, "price", e.target.value)} className="w-24" />
                                </div>
                                <Button size="sm" onClick={() => handleAddStock(stock)}><Plus className="h-4 w-4 mr-1" />Hinzufügen</Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 4 */}
            {currentStep === 4 && (
              <div className="space-y-6">
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
                        <p className="text-sm text-muted-foreground">Mit Live-Tracking können Sie Transaktionen verfolgen und die Performance Ihres Portfolios in Echtzeit analysieren (IRR/MWR). Dies ist eine Premium-Funktion.</p>
                        {isLive && (
                          <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-900">
                            <p className="text-sm text-green-800 dark:text-green-200">✓ Live-Tracking ist aktiviert. Sie können nach der Erstellung Transaktionen hinzufügen und die Performance verfolgen.</p>
                          </div>
                        )}
                      </div>
                      <Switch checked={isLive} onCheckedChange={setIsLive} className="ml-4" />
                    </div>
                  </CardContent>
                </Card>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Asset-Verteilung</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Aktien", value: assetTypeBreakdown.stocks, color: "text-blue-600" },
                      { label: "Anleihen", value: assetTypeBreakdown.bonds, color: "text-green-600" },
                      { label: "ETFs", value: assetTypeBreakdown.etfs, color: "text-purple-600" },
                    ].map((item) => (
                      <Card key={item.label}>
                        <CardContent className="p-4 text-center">
                          <div className={`text-2xl font-bold ${item.color}`}>{item.value.toFixed(1)}%</div>
                          <div className="text-sm text-muted-foreground mt-1">{item.label}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Positionen ({selectedStocks.length})</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          {["Ticker", "Anzahl", "Preis", "Wert", "Gewichtung"].map((h) => (
                            <th key={h} className={`p-3 text-sm font-medium ${h === "Ticker" ? "text-left" : "text-right"}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allocation.map((item) => (
                          <tr key={item.ticker} className="border-t">
                            <td className="p-3"><div className="font-medium">{item.ticker}</div><div className="text-xs text-muted-foreground">{item.companyName}</div></td>
                            <td className="text-right p-3">{item.quantity}</td>
                            <td className="text-right p-3">{currency} {item.purchasePrice.toFixed(2)}</td>
                            <td className="text-right p-3">{currency} {item.value.toFixed(2)}</td>
                            <td className="text-right p-3"><Badge variant="outline">{item.weight.toFixed(1)}%</Badge></td>
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

            {/* Step 5 */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm text-muted-foreground">Portfolio-Typ</Label>
                    <div className="mt-1 flex items-center gap-2">
                      {portfolioTypes.find((t) => t.value === portfolioType)?.icon}
                      <span className="font-semibold text-lg">{portfolioTypes.find((t) => t.value === portfolioType)?.label}</span>
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
                      ) : <Badge variant="outline">Deaktiviert</Badge>}
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
                      <div className="mt-1 font-medium">{currency} {parseFloat(initialCapital).toLocaleString("de-CH")}</div>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-3 block">Positionen ({selectedStocks.length})</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          {["Ticker", "Anzahl", "Preis", "Wert", "Gewichtung"].map((h) => (
                            <th key={h} className={`p-2 font-medium ${h === "Ticker" ? "text-left" : "text-right"}`}>{h}</th>
                          ))}
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

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={handleBack}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Zurück
          </Button>
          {currentStep < totalSteps ? (
            <Button onClick={handleNext}>Weiter <ChevronRight className="h-4 w-4 ml-1" /></Button>
          ) : (
            <Button onClick={handleFinish} disabled={createPortfolioMutation.isPending} className="bg-green-600 hover:bg-green-700">
              <Check className="h-4 w-4 mr-1" />
              {createPortfolioMutation.isPending ? "Erstelle..." : "Portfolio erstellen"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
