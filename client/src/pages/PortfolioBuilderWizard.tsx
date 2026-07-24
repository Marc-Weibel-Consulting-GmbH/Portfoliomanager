import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  TrendingUp,
  Briefcase,
  Upload,
  Search,
  Plus,
  X,
  Target,
  Shield,
  Flame,
  Leaf,
  Building2,
  Landmark,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  RefreshCw,
  ArrowDownCircle,
  ArrowUpCircle,
  Info,
  ShieldCheck,
} from "lucide-react";
import InsightPanel from "@/components/InsightPanel";
import { SwissquotePDFImport } from "@/components/SwissquotePDFImport";

// Types
type StockSelection = {
  ticker: string;
  companyName: string;
  quantity: number;
  purchasePrice: number;
  assetType: "stock" | "bond" | "etf";
  /** Multi-Asset-Anlageklasse aus dem KI-Vorschlag (equity|bond|commodity|gold|realestate|crypto). */
  assetClass?: string;
  /** Weight as % of total capital (inkl. Cash-Reserve). Stored directly from proposal weightPct. */
  weightPct?: number;
};

type PortfolioType = "simple" | "live";
type BuilderPath = "auto" | "manual" | "import" | null;

// Portfolio types
const portfolioTypes = [
  {
    value: "simple" as const,
    label: "Einfaches Portfolio",
    description: "Statische Übersicht Ihrer Anlagen ohne Transaktionsverfolgung",
    icon: <Briefcase className="h-10 w-10" />,
  },
  {
    value: "live" as const,
    label: "Live Portfolio (Premium)",
    description: "Mit Transaktionsverfolgung, IRR/MWR Performance-Berechnung und Echtzeit-Analysen",
    icon: <TrendingUp className="h-10 w-10" />,
  },
];

// Investment goals
const INVESTMENT_GOALS = [
  { value: "income", label: "Einkommen", description: "Regelmässige Dividenden und Erträge", icon: <Landmark className="h-7 w-7" /> },
  { value: "growth", label: "Wachstum", description: "Langfristiger Kapitalzuwachs", icon: <TrendingUp className="h-7 w-7" /> },
  { value: "balanced", label: "Ausgewogen", description: "Balance zwischen Einkommen und Wachstum", icon: <Target className="h-7 w-7" /> },
  { value: "preservation", label: "Kapitalerhalt", description: "Sicherheit und Stabilität stehen im Vordergrund", icon: <Shield className="h-7 w-7" /> },
];

// Risk profiles
const RISK_PROFILES = [
  { value: "konservativ", label: "Konservativ", description: "Minimales Risiko, Stabilität zuerst", icon: <Shield className="h-7 w-7" /> },
  { value: "ausgewogen", label: "Ausgewogen", description: "Moderates Risiko für solide Rendite", icon: <Target className="h-7 w-7" /> },
  { value: "wachstum", label: "Wachstumsorientiert", description: "Höheres Risiko für höhere Rendite", icon: <TrendingUp className="h-7 w-7" /> },
  { value: "aggressiv", label: "Aggressiv", description: "Maximale Rendite, hohe Schwankungen bewusst akzeptiert", icon: <Flame className="h-7 w-7" /> },
];

// Empfohlene Aktienquote je Risikoprofil (%) — Spiegel von
// server/lib/multiAssetSleeve.ts (MULTI_ASSET_ALLOCATION[].equity).
// Bei «Nur Aktien»-Wahl wird damit die Profil-Abweichung angezeigt.
const PROFILE_EQUITY_SHARE: Record<string, number> = {
  konservativ: 30,
  ausgewogen: 55,
  wachstum: 70,
  aggressiv: 80,
};

// Anzeigenamen der Multi-Asset-Anlageklassen (Badges im Vorschlag).
const ASSET_CLASS_LABELS: Record<string, string> = {
  equity: "Aktien",
  bond: "Obligationen",
  commodity: "Rohstoffe",
  gold: "Gold",
  realestate: "Immobilien",
  crypto: "Krypto",
};

// Horizons
const HORIZONS = [
  { value: 3, label: "Kurzfristig", description: "Bis 3 Jahre" },
  { value: 7, label: "Mittelfristig", description: "3–7 Jahre" },
  { value: 15, label: "Langfristig", description: "Über 7 Jahre" },
];

// Excluded sectors
const EXCLUDED_SECTORS = [
  { value: "tabak", label: "Tabak", icon: <X className="h-5 w-5" /> },
  { value: "ruediag", label: "Rüstung", icon: <X className="h-5 w-5" /> },
  { value: "fossil", label: "Fossile Energie", icon: <X className="h-5 w-5" /> },
  { value: "glücksspiel", label: "Glücksspiel", icon: <X className="h-5 w-5" /> },
  { value: "kernkraft", label: "Kernkraft", icon: <X className="h-5 w-5" /> },
];

const loadingMessages = [
  "Wir analysieren Ihre Anlageziele und suchen passende Titel für Sie…",
  "Wir bewerten einzelne Aktien nach Qualität, Bewertung und Marktlage…",
  "Wir prüfen Branchen-Mischung und Diversifikation Ihres Portfolios…",
  "Wir optimieren die Gewichtung für ein gutes Rendite-Risiko-Profil…",
  "Gleich geschafft — wir erstellen Ihren persönlichen Vorschlag…",
];

export default function PortfolioBuilderWizard() {
  const [, navigate] = useLocation();

  // Path selection
  const [path, setPath] = useState<BuilderPath>(null);
  const [currentStep, setCurrentStep] = useState(0);

  // Auto builder state
  const [autoStep, setAutoStep] = useState(1);
  const [autoGoal, setAutoGoal] = useState("balanced");
  const [autoRisk, setAutoRisk] = useState("ausgewogen");
  const [autoHorizon, setAutoHorizon] = useState(10);
  const [autoExcluded, setAutoExcluded] = useState<string[]>([]);
  const [autoProposal, setAutoProposal] = useState<any>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [profilePrefilled, setProfilePrefilled] = useState(false);

  // Shared state
  const [portfolioType, setPortfolioType] = useState<PortfolioType>("simple");
  const [portfolioName, setPortfolioName] = useState("");
  const [portfolioDescription, setPortfolioDescription] = useState("");
  const [initialCapital, setInitialCapital] = useState<string>("");
  const [currency, setCurrency] = useState("CHF");
  const [isLive, setIsLive] = useState(false);
  const [selectedStocks, setSelectedStocks] = useState<StockSelection[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [stockInputs, setStockInputs] = useState<Record<string, { quantity: string; price: string }>>({});
  const [isAdminReviewed, setIsAdminReviewed] = useState(false); // true nach Rückkehr vom Admin-Review
  const [skipAdminReview, setSkipAdminReview] = useState(false); // true = direkt erstellen ohne Admin-Review
  const [stocksOnly, setStocksOnly] = useState(false); // false = Multi-Asset-Mix gemäss Anlegerprofil (empfohlen)

  // Fetch current user to check role
  const { data: currentUser } = trpc.auth.me.useQuery();
  const isAdmin = currentUser?.role === "admin";

  // Fetch existing investment profile for pre-fill
  const { data: existingProfile } = trpc.investmentProfile.get.useQuery();

  // Pre-fill auto builder from existing profile
  useEffect(() => {
    if (existingProfile && !profilePrefilled) {
      if (existingProfile.goal) setAutoGoal(existingProfile.goal);
      if (existingProfile.riskProfile) setAutoRisk(existingProfile.riskProfile);
      if (existingProfile.investmentHorizon) {
        const h = existingProfile.investmentHorizon;
        setAutoHorizon(h <= 3 ? 3 : h <= 7 ? 7 : 15);
      }
      if (existingProfile.excludedSectors?.length) setAutoExcluded(existingProfile.excludedSectors);
      if (existingProfile.availableCapital) setInitialCapital(String(existingProfile.availableCapital));
      setProfilePrefilled(true);
    }
  }, [existingProfile, profilePrefilled]);

  // Handle return from admin review with reviewed proposal data
  useEffect(() => {
    const reviewedData = sessionStorage.getItem("reviewedProposal");
    if (reviewedData) {
      try {
        const parsed = JSON.parse(reviewedData);
        // Restore all wizard state from the reviewed proposal
        if (parsed.positions) {
          setAutoProposal({
            positions: parsed.positions,
            metrics: parsed.metrics,
            profile: parsed.profile,
            adminReviewed: parsed.adminReviewed,
            adminReviewedAt: parsed.adminReviewedAt,
            adminReviewNotes: parsed.adminReviewNotes,
          });
        }
        if (parsed.portfolioName) setPortfolioName(parsed.portfolioName);
        if (parsed.initialCapital) setInitialCapital(String(parsed.initialCapital));
        if (parsed.autoGoal) setAutoGoal(parsed.autoGoal);
        if (parsed.autoRisk) setAutoRisk(parsed.autoRisk);
        if (parsed.autoHorizon) setAutoHorizon(parsed.autoHorizon);
        if (parsed.autoExcluded) setAutoExcluded(parsed.autoExcluded);
        setPath("auto");
        setAutoStep(5);
        setIsAdminReviewed(true);
        sessionStorage.removeItem("reviewedProposal");
        toast.success("Geprüfter Vorschlag geladen", {
          description: "Sie können das Portfolio jetzt direkt erstellen.",
        });
      } catch (e) {
        console.error("Failed to parse reviewed proposal:", e);
        sessionStorage.removeItem("reviewedProposal");
      }
    }
  }, []);

  // Stocks query for manual selection
  const { data: availableStocks = [], isLoading: stocksLoading } = trpc.stock.list.useQuery();

  // Mutations
  const createPortfolioMutation = trpc.portfolio.create.useMutation();
  const setProfileMutation = trpc.investmentProfile.set.useMutation();

  // Async proposal job (PR #173): start + poll statt synchronem buildProposal-Call.
  // Der Job läuft serverseitig weiter, auch wenn der Client zwischenzeitlich
  // die Verbindung verliert; der Client pollt getProposalStatus im 3s-Rhythmus.
  const [proposalJobId, setProposalJobId] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const startProposal = trpc.autoPortfolio.startProposal.useMutation({
    onSuccess: (data) => {
      setProposalJobId(data.jobId);
    },
    onError: (err) => {
      toast.error("Portfolio-Vorschlag fehlgeschlagen", { description: err.message });
    },
  });
  const proposalStatus = trpc.autoPortfolio.getProposalStatus.useQuery(
    { jobId: proposalJobId! },
    {
      enabled: !!proposalJobId,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === "done" || status === "error" ? false : 3000;
      },
    }
  );
  // Verarbeitet den Job-Status: bei done → Vorschlag übernehmen (ggf. Enhancing-
  // Phase, wenn der Synthesizer noch läuft), bei error → Fehler anzeigen.
  useEffect(() => {
    const data = proposalStatus.data;
    if (!data) return;
    if (data.status === "done" && data.result) {
      const result = data.result as any;
      setAutoProposal(result);
      // Wenn adjustedPositions noch fehlen, läuft die KI-Gegenprüfung noch
      setIsEnhancing(!result.adjustedPositions && !result.enhancingSkipped);
      if (result.adjustedPositions || result.enhancingSkipped) setIsEnhancing(false);
      setProposalJobId(null);
      toast.success("Portfolio-Vorschlag ist bereit");
    } else if (data.status === "error") {
      setProposalJobId(null);
      setIsEnhancing(false);
      toast.error("Portfolio-Vorschlag fehlgeschlagen", { description: data.error ?? "Unbekannter Fehler" });
    }
  }, [proposalStatus.data]);
  // Wenn der Synthesizer nachliefert (adjustedPositions erscheinen in einer
  // späteren Poll-Runde), Enhancing-Flag zurücksetzen. Da der Job nach done
  // nicht mehr gepollt wird, ist das vor allem ein Safety-Net.
  useEffect(() => {
    if (autoProposal?.adjustedPositions || autoProposal?.enhancingSkipped) setIsEnhancing(false);
  }, [autoProposal?.adjustedPositions, autoProposal?.enhancingSkipped]);
  // Kompatibilitäts-Shim: bestehender JSX-Code referenziert buildProposal.isPending
  // für den Ladezustand. Neu: pending = Job gestartet und noch kein Ergebnis.
  const buildProposal = { isPending: startProposal.isPending || !!proposalJobId };

  // Cycle loading messages while proposal is being built
  useEffect(() => {
    if (!buildProposal.isPending) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % loadingMessages.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [buildProposal.isPending]);

  // Portfolio creation error handling
  useEffect(() => {
    if (createPortfolioMutation.error) {
      toast.error("Fehler beim Erstellen", { description: createPortfolioMutation.error.message });
    }
  }, [createPortfolioMutation.error]);

  // Reset when choosing a path
  const handlePathSelect = (p: BuilderPath) => {
    setPath(p);
    setCurrentStep(p === "auto" ? 0 : 1);
    if (p === "auto") {
      setAutoStep(1);
      setAutoProposal(null);
      setAutoGoal("balanced");
      setAutoRisk("ausgewogen");
      setAutoHorizon(10);
      setStocksOnly(false);
      setAutoExcluded([]);
    }
  };

  // Auto builder navigation
  const TOTAL_AUTO_STEPS = 5;
  const autoStepMeta: Record<number, { title: string; subtitle: string }> = {
    1: { title: "Anlageziel", subtitle: "Was möchten Sie mit Ihrer Anlage erreichen?" },
    2: { title: "Risikoprofil", subtitle: "Wie viel Risiko möchten Sie eingehen?" },
    3: { title: "Anlagehorizont", subtitle: "Wie lange möchten Sie investiert bleiben?" },
    4: { title: "Ausschlüsse", subtitle: "Welche Branchen möchten Sie ausschliessen? (optional)" },
    5: { title: "Ihr Portfolio", subtitle: "Name, Betrag und KI-Vorschlag" },
  };

  const goNextAuto = () => {
    if (autoStep < TOTAL_AUTO_STEPS) setAutoStep(autoStep + 1);
  };
  const goPrevAuto = () => {
    if (autoStep > 1) setAutoStep(autoStep - 1);
    else setPath(null);
  };

  const toggleExcluded = (value: string) => {
    setAutoExcluded((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  // Build auto proposal
  const handleBuildProposal = async () => {
    // Save profile first
    try {
      await setProfileMutation.mutateAsync({
        goal: autoGoal,
        riskProfile: autoRisk,
        investmentHorizon: autoHorizon,
        excludedSectors: autoExcluded,
        availableCapital: parseFloat(initialCapital) || 0,
      });
    } catch (e: any) {
      toast.error("Profil konnte nicht gespeichert werden", { description: e.message });
      return;
    }
    const capital = parseFloat(initialCapital);
    if (!(capital > 0)) {
      toast.error("Bitte geben Sie einen Anlagebetrag ein");
      return;
    }
    // Job starten; Ergebnis kommt über getProposalStatus-Polling (siehe useEffect oben)
    setAutoProposal(null);
    startProposal.mutate({ investmentAmount: capital, stocksOnly });
  };

  // Accept auto proposal → pre-fill manual builder
  const handleAcceptProposal = (useAdjusted: boolean = true) => {
    const positions = (useAdjusted && (autoProposal as any).adjustedPositions)
      ? (autoProposal as any).adjustedPositions
      : autoProposal.positions;
    const totalCapital = parseFloat(initialCapital) || 100000;
    const stocks: StockSelection[] = positions.map((p: any) => {
      const price = parseFloat(p.currentPrice ?? "0");
      const fxRate = p.exchangeRateToChf ? parseFloat(p.exchangeRateToChf) : 1;
      const priceCHF = price * fxRate;
      const qty = priceCHF > 0 ? (totalCapital * p.weightPct / 100) / priceCHF : 0;
      // assetType aus dem Vorschlag übernehmen (Multi-Asset): Obligationen-ETF
      // → "bond", übrige ETF-/ETP-Sleeves → "etf", Aktien → "stock" (Default).
      const mappedAssetType: "stock" | "bond" | "etf" =
        p.assetClass === "bond" ? "bond" : p.assetType === "etf" || p.assetClass ? "etf" : "stock";
      return { ticker: p.ticker, companyName: p.companyName, quantity: Math.round(qty), purchasePrice: priceCHF, assetType: mappedAssetType, assetClass: p.assetClass ?? (mappedAssetType === "stock" ? "equity" : undefined), weightPct: p.weightPct };
    });
    setSelectedStocks(stocks);
    setPortfolioType("live");
    setIsLive(true);
    if (!portfolioName) setPortfolioName("KI-Portfolio");
    setPath("manual");
    setCurrentStep(2);
    toast.success("Vorschlag übernommen — Sie können die Positionen jetzt anpassen");
  };

  // Send proposal to admin review
  const handleSendToAdminReview = () => {
    // Store proposal data in sessionStorage so AdminPortfolioReview can pick it up
    const reviewData = {
      positions: autoProposal.positions,
      metrics: autoProposal.metrics,
      profile: autoProposal.profile,
      portfolioName: portfolioName || "KI-Portfolio",
      initialCapital: parseFloat(initialCapital) || 100000,
      autoGoal,
      autoRisk,
      autoHorizon,
      autoExcluded,
    };
    sessionStorage.setItem("pendingAdminReview", JSON.stringify(reviewData));
    toast.info("Vorschlag wird zur Admin-Prüfung vorbereitet", {
      description: "Sie werden zum Admin-Review weitergeleitet.",
    });
    navigate("/admin/portfolio-review");
  };

  // Manual builder helpers
  const filteredStocks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return availableStocks;
    return availableStocks.filter(
      (s) => s.ticker.toLowerCase().includes(q) || s.companyName.toLowerCase().includes(q)
    );
  }, [availableStocks, searchQuery]);

  const getStockInput = (ticker: string, field: "quantity" | "price") =>
    stockInputs[ticker]?.[field] ?? "";

  const setStockInput = (ticker: string, field: "quantity" | "price", value: string) =>
    setStockInputs((prev) => ({ ...prev, [ticker]: { ...prev[ticker], [field]: value } }));

  const handleAddStock = (stock: (typeof availableStocks)[0]) => {
    const quantity = parseFloat(getStockInput(stock.ticker, "quantity")) || 0;
    const price = parseFloat(getStockInput(stock.ticker, "price")) || parseFloat(stock.currentPrice ?? "0") || 0;
    if (quantity <= 0 || price <= 0) {
      toast.error("Bitte Anzahl und Preis eingeben");
      return;
    }
    setSelectedStocks((prev) => [
      ...prev,
      {
        ticker: stock.ticker,
        companyName: stock.companyName,
        quantity,
        purchasePrice: price,
        assetType: currentStep === 3 ? "etf" : "stock",
      },
    ]);
    setStockInput(stock.ticker, "quantity", "");
    setStockInput(stock.ticker, "price", "");
  };

  const handleRemoveStock = (ticker: string) => {
    setSelectedStocks((prev) => prev.filter((s) => s.ticker !== ticker));
  };

  const totalValue = useMemo(
    () => selectedStocks.reduce((sum, s) => sum + s.quantity * s.purchasePrice, 0),
    [selectedStocks]
  );

  const allocation = useMemo(() => {
    if (totalValue <= 0) return [];
    return selectedStocks.map((s) => ({
      ...s,
      value: s.quantity * s.purchasePrice,
      weight: (s.quantity * s.purchasePrice / totalValue) * 100,
    }));
  }, [selectedStocks, totalValue]);

  const assetTypeBreakdown = useMemo(() => {
    const total = totalValue || 1;
    const stocks = selectedStocks.filter((s) => s.assetType === "stock").reduce((sum, s) => sum + s.quantity * s.purchasePrice, 0);
    const bonds = selectedStocks.filter((s) => s.assetType === "bond").reduce((sum, s) => sum + s.quantity * s.purchasePrice, 0);
    const etfs = selectedStocks.filter((s) => s.assetType === "etf").reduce((sum, s) => sum + s.quantity * s.purchasePrice, 0);
    return { stocks: (stocks / total) * 100, bonds: (bonds / total) * 100, etfs: (etfs / total) * 100 };
  }, [selectedStocks, totalValue]);

  // Create portfolio (manual flow final step)
  const handleFinish = async () => {
    if (!portfolioName.trim()) {
      toast.error("Bitte geben Sie einen Portfolio-Namen ein");
      return;
    }
    try {
      const result = await createPortfolioMutation.mutateAsync({
        name: portfolioName,
        description: portfolioDescription,
        portfolioType: isLive ? "live" : "simple",
        initialCapital: parseFloat(initialCapital) || 0,
        currency,
        positions: selectedStocks.map((s) => ({
          ticker: s.ticker,
          companyName: s.companyName,
          quantity: s.quantity,
          purchasePrice: s.purchasePrice,
          assetType: s.assetType,
          assetClass: s.assetClass,
          weightPct: s.weightPct,
        })),
      });
      toast.success(`Portfolio "${portfolioName}" wurde erstellt`);
      navigate("/portfolios");
    } catch (e: any) {
      // error toast handled by useEffect above
    }
  };

  // Create portfolio for import flow
  const handleCreateImportPortfolio = async () => {
    if (!portfolioName.trim()) {
      toast.error("Bitte geben Sie einen Portfolio-Namen ein");
      return;
    }
    if (!(parseFloat(initialCapital) > 0)) {
      toast.error("Bitte geben Sie das Startkapital ein");
      return;
    }
    try {
      const result = await createPortfolioMutation.mutateAsync({
        name: portfolioName,
        description: portfolioDescription,
        portfolioType: "live",
        initialCapital: parseFloat(initialCapital),
        currency: "CHF",
        positions: [],
      });
      toast.success(`Portfolio "${portfolioName}" wurde angelegt — importieren Sie jetzt Ihre PDF`);
      // Navigate to the portfolio detail page where the PDF import lives
      navigate(`/portfolios/${(result as any)?.id ?? ""}`);
    } catch (e: any) {
      // error toast handled by useEffect above
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ── RENDER: Path Selection ────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────

  if (currentStep === 0 && path === null) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 text-white">Portfolio erstellen</h1>
              <p className="text-gray-400">Wählen Sie, wie Sie Ihr Portfolio aufbauen möchten</p>
            </div>
            <button onClick={() => navigate("/portfolios")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors shrink-0">
              <X className="h-4 w-4" /> Abbrechen
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card
              className="cursor-pointer transition-all hover:border-[#00CFC1] bg-gradient-to-b from-[#1a1f2e] to-[#0f1420] border-white/10"
              onClick={() => handlePathSelect("auto")}
            >
              <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-[#00CFC1]/15 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-[#00CFC1]" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-white">KI-Vorschlag</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Beantworten Sie 4 Fragen — unsere KI erstellt Ihnen einen persönlichen Portfoliovorschlag
                  </p>
                </div>
                <Badge className="bg-[#00CFC1]/20 text-[#00CFC1] border-[#00CFC1]/30">Empfohlen</Badge>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer transition-all hover:border-[#00CFC1] bg-gradient-to-b from-[#1a1f2e] to-[#0f1420] border-white/10"
              onClick={() => handlePathSelect("manual")}
            >
              <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-blue-500/15 flex items-center justify-center">
                  <Briefcase className="h-8 w-8 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-white">Manuell erstellen</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Wählen Sie selbst Aktien, Anleihen und ETFs aus und bestimmen Sie die Gewichtung
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer transition-all hover:border-[#00CFC1] bg-gradient-to-b from-[#1a1f2e] to-[#0f1420] border-white/10"
              onClick={() => handlePathSelect("import")}
            >
              <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-purple-500/15 flex items-center justify-center">
                  <Upload className="h-8 w-8 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-white">Depot importieren</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Importieren Sie Ihr bestehendes Depot aus einer Bank-PDF (z.B. Swissquote)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── RENDER: Auto Builder (KI-Vorschlag) ──────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────

  if (path === "auto") {
    const meta = autoStepMeta[autoStep];
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <button onClick={goPrevAuto} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> Zurück
          </button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL_AUTO_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i + 1 === autoStep ? "w-8 bg-[#00CFC1]" : i + 1 < autoStep ? "w-4 bg-[#00CFC1]/50" : "w-4 bg-white/10"
                }`}
              />
            ))}
          </div>
          <button onClick={() => navigate("/portfolios")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors">
            <X className="h-4 w-4" /> Abbrechen
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-start justify-center p-6 overflow-y-auto">
          <div className="w-full max-w-2xl space-y-6 py-4">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white">{meta.title}</h1>
              <p className="text-gray-400">{meta.subtitle}</p>
            </div>

            {profilePrefilled && autoStep === 1 && existingProfile && (
              <div className="flex items-center gap-2 justify-center">
                <p className="text-xs text-[#00CFC1]/90">
                  Ihr Anlageprofil wurde übernommen. Sie können die Einstellungen hier anpassen.
                </p>
              </div>
            )}

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
                {/* N-08: Alle auswählen / Alle abwählen */}
                <div className="flex items-center justify-end gap-2 mb-3">
                  <button
                    onClick={() => setAutoExcluded(EXCLUDED_SECTORS.map(s => s.value))}
                    className="text-xs text-gray-400 hover:text-white underline underline-offset-2 transition-colors"
                  >
                    Alle ausschliessen
                  </button>
                  <span className="text-gray-600">·</span>
                  <button
                    onClick={() => setAutoExcluded([])}
                    className="text-xs text-gray-400 hover:text-white underline underline-offset-2 transition-colors"
                  >
                    Alle abwählen
                  </button>
                </div>
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

                {/* Name + Capital — always visible so user can adjust before accepting */}
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
                      placeholder="z.B. CHF 100'000"
                      value={initialCapital}
                      onChange={(e) => setInitialCapital(e.target.value)}
                      className={`bg-[#0f1420] border-white/10 text-white mt-1 ${
                        initialCapital && parseFloat(initialCapital) > 0 && parseFloat(initialCapital) < 100000
                          ? "border-yellow-500/60"
                          : ""
                      }`}
                    />
                    {!initialCapital && autoProposal && (
                      <p className="text-xs text-amber-400 mt-1">
                        ⚠ Kein Betrag eingegeben — Standardwert CHF 100'000 wird verwendet.
                      </p>
                    )}
                    {initialCapital && parseFloat(initialCapital) > 0 && parseFloat(initialCapital) < 100000 && (
                      <p className="text-xs text-yellow-400 mt-1">
                        Empfehlung: Mindestens CHF 100'000 für ein diversifiziertes Aktienportfolio.
                      </p>
                    )}
                  </div>
                </div>

                {/* Anlageklassen-Wahl: Multi-Asset-Mix (Default, gemäss Profil) vs. Nur Aktien */}
                <div className="rounded-lg border border-white/10 bg-[#0f1420] p-4 space-y-3">
                  <p className="text-sm font-medium text-white">Anlageklassen</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setStocksOnly(false)}
                      className={`text-left rounded-lg border p-3 transition-all ${
                        !stocksOnly
                          ? "border-[#00CFC1] bg-[#00CFC1]/10"
                          : "border-white/10 hover:border-white/25"
                      }`}
                    >
                      <p className={`text-sm font-medium ${!stocksOnly ? "text-[#00CFC1]" : "text-white"}`}>
                        Multi-Asset-Mix <span className="text-xs font-normal">(empfohlen)</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Aktien, Obligationen, Gold, Rohstoffe, Immobilien{PROFILE_EQUITY_SHARE[autoRisk] > 30 ? " und Krypto" : ""} — gemischt nach Ihrem Anlegerprofil
                        {PROFILE_EQUITY_SHARE[autoRisk] ? ` (ca. ${PROFILE_EQUITY_SHARE[autoRisk]}% Aktien)` : ""}.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStocksOnly(true)}
                      className={`text-left rounded-lg border p-3 transition-all ${
                        stocksOnly
                          ? "border-amber-500/60 bg-amber-500/10"
                          : "border-white/10 hover:border-white/25"
                      }`}
                    >
                      <p className={`text-sm font-medium ${stocksOnly ? "text-amber-300" : "text-white"}`}>
                        Nur Aktien
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        100% Aktienquote — wie bisher, ohne andere Anlageklassen.
                      </p>
                    </button>
                  </div>
                  {stocksOnly && PROFILE_EQUITY_SHARE[autoRisk] && PROFILE_EQUITY_SHARE[autoRisk] < 100 && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                      <span className="text-amber-400 mt-0.5">⚠</span>
                      <p className="text-xs text-amber-200 leading-relaxed">
                        Achtung: «Nur Aktien» (100% Aktienanteil) weicht von Ihrem Anlegerprofil
                        «{RISK_PROFILES.find((r) => r.value === autoRisk)?.label ?? autoRisk}» ab —
                        empfohlene Aktienquote ca. {PROFILE_EQUITY_SHARE[autoRisk]}%. Erhöhtes Risiko.
                      </p>
                    </div>
                  )}
                </div>

                {/* Proposal result */}
                {autoProposal ? (
                  <div className="space-y-4">
                    {/* A: Hinweis, dass die KI-Gegenprüfung noch läuft und sich der Vorschlag noch ändern kann */}
                    {isEnhancing && (
                      <div className="flex items-start gap-3 rounded-lg border border-[#00CFC1]/25 bg-[#00CFC1]/8 px-4 py-3">
                        <div className="h-4 w-4 mt-0.5 border-2 border-[#00CFC1] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        <p className="text-sm text-slate-200 leading-relaxed">
                          Ihr Portfolio steht schon — die KI prüft es gerade noch kritisch gegen und verfeinert es.
                          <span className="text-slate-400"> Einzelne Titel oder Gewichte können sich gleich noch ändern.</span>
                        </p>
                      </div>
                    )}
                    {/* Abweichungs-Hinweis (z. B. «Nur Aktien» gegen Profil-Empfehlung) */}
                    {(autoProposal as any).deviationFromProfile && (
                      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                        <span className="text-amber-400 mt-0.5">⚠</span>
                        <p className="text-sm text-amber-200 leading-relaxed">{(autoProposal as any).deviationFromProfile}</p>
                      </div>
                    )}
                    {/* Ein kompakter KPI-Balken mit den wichtigsten Kennzahlen
                        (statt mehrerer gestapelter Info-Zeilen), grössere Schrift. */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-[#0f1420] border border-white/10 rounded-lg px-5 py-3.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-bold text-[#00CFC1]">{autoProposal.positions.length}</span>
                        <span className="text-sm text-gray-400">Titel</span>
                      </div>
                      {(autoProposal as any).metrics && (
                        <>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-base font-mono font-semibold text-white">~{(autoProposal as any).metrics.expectedReturnPct.toFixed(1)}%</span>
                            <span className="text-sm text-gray-400">Rendite p.a.</span>
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-base font-mono font-semibold text-white">~{(autoProposal as any).metrics.volatilityPct.toFixed(1)}%</span>
                            <span className="text-sm text-gray-400">Schwankung</span>
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-base font-mono font-semibold text-white">{(autoProposal as any).metrics.sharpe.toFixed(2)}</span>
                            <span className="text-sm text-gray-400">Sharpe</span>
                          </div>
                        </>
                      )}
                      {(autoProposal as any).profile?.liquidityNeedPct > 0 && (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-mono font-semibold text-emerald-400">{(autoProposal as any).profile.liquidityNeedPct}%</span>
                          <span className="text-sm text-gray-400">Cash-Reserve</span>
                        </div>
                      )}
                      <span className="text-xs text-gray-500 ml-auto self-center">historisch geschätzt</span>
                    </div>
                    {/* Multi-Asset-Mischung des Vorschlags (Anlageklassen-Badges) */}
                    {(autoProposal as any).assetAllocation && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-500">Mischung:</span>
                        {Object.entries((autoProposal as any).assetAllocation as Record<string, number>)
                          .filter(([, v]) => v > 0)
                          .map(([k, v]) => (
                            <span key={k} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">
                              {ASSET_CLASS_LABELS[k] ?? k} {v}%
                            </span>
                          ))}
                      </div>
                    )}
                    {(autoProposal as any).weighting?.note && (
                      <p className="text-xs text-amber-400">
                        Hinweis zur Gewichtung: {(autoProposal as any).weighting.note}
                      </p>
                    )}
                    {/* Ehrliche Hinweise (ESG nicht verfügbar, Qualitätsstufe, Cap-Überschreitungen) */}
                    {Array.isArray((autoProposal as any).notes) && (autoProposal as any).notes.length > 0 && (
                      <div className="space-y-1">
                        {(autoProposal as any).notes.map((n: string, i: number) => (
                          <p key={i} className="text-xs text-amber-400">⚠ {n}</p>
                        ))}
                      </div>
                    )}
                    {/* KI-Portfolio-Qualitätserklärung */}
                    {(() => {
                      const metrics = (autoProposal as any).metrics;
                      const confidence = (autoProposal as any).overallConfidence;
                      const qualityTier = (autoProposal as any).stats?.qualityTier;
                      if (!metrics && !confidence) return null;
                      const sharpe = metrics?.sharpe ?? null;
                      const ret = metrics?.expectedReturnPct ?? null;
                      const vol = metrics?.volatilityPct ?? null;
                      const fxPct = (autoProposal as any).allocation?.fxWeightPct ?? null;
                      // Bevorzugt die ausführliche KI-Gesamtbewertung (verdict, nach
                      // dem Enhancing-Schritt vorhanden); vorher/als Fallback das
                      // einfache Kennzahlen-Template.
                      const llmVerdict = (autoProposal as any).synthesizerVerdict;
                      const portfolioSummary =
                        (typeof llmVerdict === 'string' && llmVerdict.trim().length > 40)
                          ? llmVerdict.trim()
                          : `Dieses Portfolio umfasst ${autoProposal.positions.length} Titel` +
                            (ret != null ? ` mit einer erwarteten Rendite von ~${ret.toFixed(1)}% p.a.` : '') +
                            (sharpe != null ? ` und einer Sharpe-Ratio von ${sharpe.toFixed(2)}` : '') +
                            (vol != null ? ` (Volatilität ~${vol.toFixed(1)}%)` : '') +
                            '. Die Zusammensetzung basiert auf Score-Ranking, Sektor-Diversifikation und Markt-Regime-Analyse.'
                      const portfolioFactors = [
                        ...(sharpe != null ? [{ label: 'Sharpe', value: sharpe.toFixed(2), sentiment: sharpe >= 0.5 ? 'positive' as const : sharpe >= 0.3 ? 'neutral' as const : 'negative' as const }] : []),
                        ...(ret != null ? [{ label: 'Erw. Rendite', value: `${ret.toFixed(1)}% p.a.`, sentiment: ret >= 8 ? 'positive' as const : ret >= 5 ? 'neutral' as const : 'negative' as const }] : []),
                        ...(vol != null ? [{ label: 'Volatilität', value: `${vol.toFixed(1)}%`, sentiment: vol <= 15 ? 'positive' as const : vol <= 25 ? 'neutral' as const : 'negative' as const }] : []),
                        ...(fxPct != null ? [{ label: 'Fremdwährung', value: `${fxPct.toFixed(0)}%`, sentiment: fxPct <= 30 ? 'positive' as const : fxPct <= 50 ? 'neutral' as const : 'negative' as const }] : []),
                        ...(confidence ? [{ label: 'KI-Konfidenz', value: confidence, sentiment: confidence === 'hoch' ? 'positive' as const : confidence === 'mittel' ? 'neutral' as const : 'negative' as const }] : []),
                      ];
                      const panelVariant = confidence === 'hoch' ? 'success' as const : confidence === 'niedrig' ? 'warning' as const : 'default' as const;
                      return (
                        <InsightPanel
                          title="KI-Portfolio-Analyse"
                          summary={portfolioSummary}
                          factors={portfolioFactors}
                          variant={panelVariant}
                          collapsible
                          defaultOpen={false}
                          riskNote="Historische Schätzungen — keine Garantie für zukünftige Ergebnisse. Alle Angaben basieren auf Vergangenheitsdaten."
                        />
                      );
                    })()}
                    <div className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden">
                      {autoProposal.positions.map((p: any) => {
                        const score = p.combinedScore ?? 0;
                        const signal = p.signal ?? 'HOLD';
                        const scoreGrade = score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 45 ? 'C' : score >= 30 ? 'D' : 'F';
                        // ytdPerf is the field name in proposal result (not ytdPerformance)
                        const ytdNum = p.ytdPerf != null ? parseFloat(String(p.ytdPerf)) : (p.ytdPerformance ? parseFloat(p.ytdPerformance) : null);
                        const divYield = p.dividendYield ? parseFloat(p.dividendYield) : null;
                        const priceNum = p.currentPrice ? parseFloat(String(p.currentPrice)) : null;

                        // Einfache, nicht-technische Begründung in 2–3 Sätzen: WARUM
                        // dieser Titel vorgeschlagen wird (statt roher Score-Fachbegriffe).
                        const isBuy = signal === 'BUY' || signal === 'STRONG_BUY';
                        const isSell = signal === 'SELL' || signal === 'STRONG_SELL';
                        const gradeWord = score >= 75 ? 'sehr gut' : score >= 60 ? 'gut' : score >= 45 ? 'solide' : 'eher zurückhaltend';
                        const whyParts: string[] = [];
                        whyParts.push(`${p.companyName} ist ein Wert aus dem Bereich ${p.sector}.`);
                        if (isBuy) whyParts.push(`Unsere Analyse bewertet ihn aktuell als ${gradeWord} und sieht einen guten Einstiegszeitpunkt.`);
                        else if (isSell) whyParts.push(`Unsere Analyse bewertet ihn als ${gradeWord}, rät derzeit aber eher zur Zurückhaltung.`);
                        else whyParts.push(`Unsere Analyse bewertet ihn als ${gradeWord} und empfiehlt, ihn ruhig zu halten.`);
                        let whyThird = `Deshalb schlagen wir dafür ${p.weightPct.toFixed(1)} % Ihres Kapitals vor.`;
                        if (divYield && divYield > 0.5) whyThird += ` Er zahlt zudem eine Dividende von rund ${divYield.toFixed(1)} %.`;
                        whyParts.push(whyThird);
                        if ((p.reason ?? '').includes('Watchlist')) whyParts.push('Dieser Titel stammt aus Ihrer Merkliste.');
                        // Bevorzugt die individuelle KI-Begründung (nach dem Enhancing-
                        // Schritt vorhanden); vorher/als Fallback das einfache Template.
                        const whyText = (typeof p.aiReason === 'string' && p.aiReason.trim()) ? p.aiReason.trim() : whyParts.join(' ');

                        // Erklärung des Scores für den Info-Button (einfach gehalten).
                        const scoreInfo = 'Der Signal-Score (0–100) fasst Bewertung, Kursverlauf und Markttrend zu einer Empfehlung zusammen. Note A = sehr gut, F = schwach. Er ist ein Anhaltspunkt, keine Garantie.';

                        // 3 key facts
                        const keyFacts = [
                          {
                            label: signal === 'BUY' || signal === 'STRONG_BUY' ? '↑ Kaufsignal' : signal === 'SELL' || signal === 'STRONG_SELL' ? '↓ Verkaufssignal' : '→ Halten',
                            color: signal === 'BUY' || signal === 'STRONG_BUY' ? 'text-emerald-400 bg-emerald-500/10' : signal === 'SELL' || signal === 'STRONG_SELL' ? 'text-red-400 bg-red-500/10' : 'text-slate-400 bg-slate-500/10',
                          },
                          {
                            label: `Note ${scoreGrade} · ${score}/100`,
                            color: score >= 70 ? 'text-emerald-300 bg-emerald-500/10' : score >= 50 ? 'text-teal-300 bg-teal-500/10' : 'text-amber-300 bg-amber-500/10',
                          },
                          {
                            label: p.isUniverseExpansion ? '✨ Universum' : ytdNum !== null ? `YTD ${ytdNum > 0 ? '+' : ''}${ytdNum.toFixed(1)}%` : divYield && divYield > 0.5 ? `Div. ${divYield.toFixed(1)}%` : p.sector,
                            color: p.isUniverseExpansion ? 'text-violet-300 bg-violet-500/10' : ytdNum !== null && ytdNum > 0 ? 'text-emerald-300 bg-emerald-500/10' : ytdNum !== null && ytdNum < -5 ? 'text-red-300 bg-red-500/10' : 'text-slate-300 bg-slate-500/10',
                          },
                        ];

                        return (
                          <div key={p.ticker} className="px-4 py-3 bg-[#0f1420]">
                            <div className="flex items-start gap-4">
                              {/* Left: ticker + company + sector + price */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs text-[#00CFC1]">{p.ticker}</span>
                                  <span className="text-sm text-white">{p.companyName}</span>
                                  {p.isUniverseExpansion && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30">
                                      ✨ Universum
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-xs text-gray-500">{p.sector}</p>
                                  {priceNum != null && priceNum > 0 && (
                                    <p className="text-xs text-slate-400">
                                      {p.currency || 'CHF'} {priceNum.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Right: einfache Begründung (WARUM) + Score-Info-Button */}
                              <div className="hidden md:flex flex-col items-end gap-1.5 shrink-0 max-w-[340px]">
                                <p className="text-sm text-slate-300 text-right leading-relaxed">{whyText}</p>
                                <div className="flex flex-wrap gap-1 justify-end items-center">
                                  {keyFacts.map((f, i) => (
                                    <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${f.color}`}>{f.label}</span>
                                  ))}
                                  <button type="button" title={scoreInfo} aria-label="Erklärung des Signal-Scores" className="ml-0.5 text-slate-400 hover:text-[#00CFC1] cursor-help">
                                    <Info className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Weight always visible */}
                              <span className="text-sm font-mono font-semibold text-white shrink-0">{p.weightPct.toFixed(1)}%</span>
                            </div>

                            {/* Mobile: Begründung + Badges + Score-Info */}
                            <div className="flex md:hidden flex-col gap-2 mt-2">
                              <p className="text-sm text-slate-300 leading-relaxed">{whyText}</p>
                              <div className="flex flex-wrap gap-1 items-center">
                                {keyFacts.map((f, i) => (
                                  <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${f.color}`}>{f.label}</span>
                                ))}
                                <button type="button" title={scoreInfo} aria-label="Erklärung des Signal-Scores" className="ml-0.5 text-slate-400 hover:text-[#00CFC1] cursor-help">
                                  <Info className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
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
                    {/* KI-Empfehlungen des Synthesizers (finalAdjustments) — für Admins
                        ausgeblendet; bei Auto-Übernahme ebenfalls (bereits eingearbeitet,
                        der Nutzer sieht direkt das fertige Portfolio). */}
                    {(autoProposal as any).finalAdjustments?.length > 0 && !isAdmin && !(autoProposal as any).autoApplied && (
                      <div className="border border-white/10 rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-[#0f1420] border-b border-white/5 flex items-center gap-2">
                          <Sparkles className="h-3.5 w-3.5 text-[#00CFC1]" />
                          <span className="text-xs font-semibold text-[#00CFC1]">KI-Empfehlungen (Synthesizer)</span>
                          {(autoProposal as any).adjustedPositions && (
                            <span className="ml-auto text-xs text-emerald-400 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> Eingearbeitet — im nächsten Schritt anpassbar
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

                    {/* Admin-geprüft Badge — erscheint nach Rückkehr vom Admin-Review */}
                    {isAdminReviewed && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                        <div>
                          <span className="text-xs font-semibold text-emerald-400">Admin-geprüft</span>
                          <p className="text-xs text-emerald-400/70">Dieser Vorschlag wurde vom Admin überprüft und angepasst. Sie können ihn jetzt direkt übernehmen.</p>
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-gray-600">
                      ⚠️ Automatischer Vorschlag auf Basis historischer Daten — keine Anlageberatung.
                    </p>
                    <div className="flex flex-col gap-2">
                      {/* Admin-Review Toggle + Button (nur für Admins sichtbar, nicht wenn bereits geprüft) */}
                      {isAdmin && !isAdminReviewed && (
                        <div className="border border-amber-500/30 rounded-lg p-3 bg-amber-500/5 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4 text-amber-400" />
                              <span className="text-xs font-semibold text-amber-400">Admin-Review</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">{skipAdminReview ? 'Direkt erstellen' : 'Mit Admin-Review'}</span>
                              <Switch
                                checked={!skipAdminReview}
                                onCheckedChange={(checked) => setSkipAdminReview(!checked)}
                                className="data-[state=checked]:bg-amber-500"
                              />
                            </div>
                          </div>
                          {!skipAdminReview ? (
                            <>
                              <p className="text-xs text-gray-400">Vorschlag im Admin-Bereich prüfen und genehmigen, bevor das Portfolio erstellt wird.</p>
                              <Button
                                variant="outline"
                                className="w-full border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-sm"
                                onClick={handleSendToAdminReview}
                              >
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Im Admin-Bereich prüfen &amp; genehmigen
                              </Button>
                            </>
                          ) : (
                            <p className="text-xs text-gray-400">Portfolio wird direkt ohne Admin-Review erstellt. Verwenden Sie die Schaltflächen unten.</p>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap justify-between gap-3">
                        <Button variant="outline" className="border-white/10 text-gray-300"
                          onClick={() => setAutoProposal(null)} disabled={buildProposal.isPending}>
                          Neu erstellen
                        </Button>
                        {/* After admin review: show green accept button */}
                        {isAdmin && isAdminReviewed && (
                          <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                            onClick={() => handleAcceptProposal(true)}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Admin-geprüften Vorschlag übernehmen
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        )}
                        {/* Admin without review: show direct-create buttons when skipAdminReview is true */}
                        {isAdmin && !isAdminReviewed && skipAdminReview && (
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
                              {(autoProposal as any).adjustedPositions ? 'KI-Angepasst übernehmen' : 'Direkt erstellen'}
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        )}
                        {/* Non-admins: show standard accept buttons */}
                        {!isAdmin && (
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
                        )}
                      </div>
                    </div>
                  </div>
                ) : buildProposal.isPending ? (
                  <div className="space-y-3 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 border-2 border-[#00CFC1] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        <span className="text-sm text-[#00CFC1] font-medium">Ihr Portfolio wird erstellt…</span>
                      </div>
                      <span className="text-xs text-gray-500">meist 1–3 Minuten</span>
                    </div>
                    {/* Indeterminate progress bar */}
                    <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-[#00CFC1] rounded-full" style={{ animation: 'indeterminate 2s ease-in-out infinite' }} />
                    </div>
                    {/* Eine freundliche, wechselnde Botschaft statt technischer Einzelschritte */}
                    <p className="text-sm text-slate-300 leading-relaxed min-h-[3rem]">
                      {loadingMessages[loadingMsgIdx]}
                    </p>
                  </div>
                ) : (
                  <Button
                    className="bg-[#00CFC1] text-[#0a0f1a] hover:bg-[#00CFC1]/90 font-semibold w-full py-6 text-base"
                    disabled={setProfileMutation.isPending || !(parseFloat(initialCapital) > 0)}
                    onClick={handleBuildProposal}
                  >
                    <Sparkles className="h-5 w-5 mr-2" />
                    {setProfileMutation.isPending ? "Profil wird gespeichert…" : "KI-Vorschlag erstellen"}
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
                      <Label htmlFor="capital">
                        Startkapital (CHF)
                        {path === "auto" && initialCapital && parseFloat(initialCapital) > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground font-normal">(aus Schritt 1 übernommen)</span>
                        )}
                      </Label>
                      {path === "auto" && initialCapital && parseFloat(initialCapital) > 0 ? (
                        // Read-only display when coming from KI-flow
                        <div className="flex items-center h-10 px-3 rounded-md border border-white/10 bg-white/5 text-sm font-medium">
                          {currency} {parseFloat(initialCapital).toLocaleString("de-CH")}
                        </div>
                      ) : (
                        <Input
                          id="capital"
                          type="number"
                          placeholder="z.B. 100000"
                          value={initialCapital || ""}
                          onChange={(e) => setInitialCapital(e.target.value)}
                        />
                      )}
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
                              <div className="text-sm font-medium">{Math.round(stock.quantity)} × {currency} {stock.purchasePrice.toFixed(2)}</div>
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
                          {["Titel", "Anzahl", "Preis", "Wert", "Gewichtung"].map((h) => (
                            <th key={h} className={`p-3 text-sm font-medium ${h === "Titel" ? "text-left" : "text-right"}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allocation.map((item) => (
                          <tr key={item.ticker} className="border-t">
                            <td className="p-3"><div className="font-medium font-mono text-xs text-[#00CFC1]">{item.ticker}</div><div className="text-xs text-muted-foreground">{item.companyName}</div></td>
                            <td className="text-right p-3">{Math.round(item.quantity)}</td>
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
                          {["Titel", "Anzahl", "Preis", "Wert", "Gewichtung"].map((h) => (
                            <th key={h} className={`p-2 font-medium ${h === "Titel" ? "text-left" : "text-right"}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allocation.map((item) => (
                          <tr key={item.ticker} className="border-t">
                            <td className="p-2"><div className="font-mono text-xs text-[#00CFC1]">{item.ticker}</div><div className="text-xs text-muted-foreground">{item.companyName}</div></td>
                            <td className="text-right p-2">{Math.round(item.quantity)}</td>
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
                  {/* N-12: Erklärung Rundungsdifferenz */}
                  {initialCapital && Math.abs(totalValue - parseFloat(initialCapital)) > 1 && (
                    <p className="text-xs text-gray-500 mt-2">
                      ⓘ Differenz zum Startkapital ({currency} {parseFloat(initialCapital).toLocaleString("de-CH")}) durch Rundung auf ganze Aktienstückzahlen.
                    </p>
                  )}
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
            <div className="flex flex-col items-end gap-2">
              {createPortfolioMutation.isPending && (
                <div className="w-64">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Portfolio wird angelegt…
                    </span>
                    <span className="text-gray-600">Bitte warten</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{ width: '60%', animation: 'indeterminate 1.5s ease-in-out infinite' }} />
                  </div>
                </div>
              )}
              <Button onClick={handleFinish} disabled={createPortfolioMutation.isPending} className="bg-green-600 hover:bg-green-700">
                <Check className="h-4 w-4 mr-1" />
                {createPortfolioMutation.isPending ? "Wird angelegt…" : "Portfolio erstellen"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
