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
import { InsightExpandable, InsightPanel } from "@/components/InsightPanel";
import { ProposalPositionEditor, type EditablePosition } from "@/components/portfolio/ProposalPositionEditor";

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
  /** Weight as % of total capital (inkl. Cash-Reserve). Stored directly from proposal weightPct. */
  weightPct?: number;
  /** Multi-Asset-Anlageklasse (bond/commodity/gold/realestate/crypto) — nur bei Sleeve-ETFs aus dem KI-Vorschlag gesetzt. */
  assetClass?: string;
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

/** Empfohlene Aktienquote je Anlegerprofil (%) — Spiegel von server/lib/multiAssetSleeve.ts (STRATEGIC_EQUITY_SHARE). */
const PROFILE_EQUITY_SHARE: Record<string, number> = {
  konservativ: 30,
  ausgewogen: 55,
  wachstum: 70,
  aggressiv: 80,
};

/** Deutsche Labels der Multi-Asset-Anlageklassen (für Allokations-Badges im Vorschlag). */
const ASSET_CLASS_LABELS: Record<string, string> = {
  equity: "Aktien",
  bond: "Obligationen",
  commodity: "Rohstoffe",
  gold: "Gold",
  realestate: "Immobilien",
  crypto: "Krypto",
};

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

/**
 * Vorschlags-Positionen → editierbare Positionen für den Bearbeiten-Bereich.
 *
 * Wird von BEIDEN Wegen zu Schritt 5 gebraucht: dem frisch berechneten
 * Vorschlag (Polling-Ergebnis) und dem admin-geprüften Vorschlag aus dem
 * KI-Protokoll. Letzterer hatte das Seeding bisher nicht, weshalb dort das
 * Bearbeiten-Panel (`reviewPositions.length > 0`) gar nicht erschien.
 */
function toEditablePositions(src: any[]): EditablePosition[] {
  return (src ?? []).map((p: any) => {
    const w = parseFloat(String(p.weightPct ?? p.weight ?? '0')) || 0;
    return {
      ticker: p.ticker,
      companyName: p.companyName,
      sector: p.sector,
      currency: p.currency,
      currentPrice: parseFloat(String(p.currentPrice ?? '0')) || 0,
      exchangeRateToChf: parseFloat(String(p.exchangeRateToChf ?? '1')) || 1,
      weightPct: w,
      originalWeightPct: w,
      aiReason: p.aiReason,
      assetType: p.assetType,
      assetClass: p.assetClass,
      combinedScore: p.combinedScore ?? null,
      signal: p.signal,
      isUniverseExpansion: p.isUniverseExpansion,
    } as EditablePosition;
  });
}

export default function PortfolioBuilderWizard() {
  const [, navigate] = useLocation();

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
  const [stocksOnly, setStocksOnly] = useState(false); // true = «Nur Aktien» (Abweichung vom Profil-Mix)

  // ── Manual / shared state ──
  const [portfolioType, setPortfolioType] = useState<PortfolioType | null>(null);
  const [portfolioName, setPortfolioName] = useState("");
  const [portfolioDescription, setPortfolioDescription] = useState("");
  const [currency, setCurrency] = useState("CHF");
  const [initialCapital, setInitialCapital] = useState("");
  const [selectedStocks, setSelectedStocks] = useState<StockSelection[]>([]);
  // Editierbare Vorschlags-Positionen (Gewicht/Austausch/Löschen/Hinzufügen VOR der Übernahme).
  const [reviewPositions, setReviewPositions] = useState<EditablePosition[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [perStockInputs, setPerStockInputs] = useState<Record<string, { quantity: string; price: string }>>({});
  const [isLive, setIsLive] = useState(false);
  const [isAiOptimized, setIsAiOptimized] = useState(false); // true wenn aus KI-angepasstem Vorschlag
  const [isAdminReviewed, setIsAdminReviewed] = useState(false); // true wenn Vorschlag vom Admin geprüft wurde
  const [skipAdminReview, setSkipAdminReview] = useState(true); // true = direkt erstellen ohne Admin-Review (Default; Review optional per Toggle)

  // ── Async proposal job polling state ──
  const [proposalJobId, setProposalJobId] = useState<string | null>(null);
  const [proposalProgress, setProposalProgress] = useState<string[]>([]);
  const [isProposalRunning, setIsProposalRunning] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  // ── Queries & mutations ──
  const utils = trpc.useUtils();
  const { data: savedProfile } = trpc.investmentProfile.get.useQuery();
  const { data: allStocks = [] } = trpc.stocks.list.useQuery();
  const createPortfolioMutation = trpc.portfolios.create.useMutation();
  const setProfileMutation = trpc.investmentProfile.set.useMutation();
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === 'admin';

  // Async job: start proposal (returns immediately with jobId)
  const startProposal = trpc.autoPortfolio.startProposal.useMutation({
    onSuccess: (data) => {
      setProposalJobId(data.jobId);
      setIsProposalRunning(true);
      setProposalProgress(['Job gestartet...']);
    },
    onError: (e) => {
      setIsProposalRunning(false);
      toast.error('Vorschlag konnte nicht gestartet werden', { description: e.message });
    },
  });

  // Polling query: only active when we have a jobId and job is running
  const proposalStatus = trpc.autoPortfolio.getProposalStatus.useQuery(
    { jobId: proposalJobId ?? '' },
    {
      enabled: !!proposalJobId && isProposalRunning,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return 3000;
        // Auch während der KI-Verfeinerung (enhancing) weiterpollen.
        if (data.status === 'running' || data.status === 'enhancing') return 3000;
        return false; // stop polling when done/error
      },
      refetchIntervalInBackground: true,
    }
  );

  // React to polling results — beim Rendern statt im Effect (React: "adjusting state
  // while rendering"). Der Rumpf läuft exakt einmal pro neuer Status-Antwort; react-query
  // liefert bei unverändertem Inhalt dieselbe Referenz, also identische Trigger wie zuvor.
  const [handledStatusData, setHandledStatusData] = useState<unknown>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);
  if (proposalStatus.data && proposalStatus.data !== handledStatusData) {
    setHandledStatusData(proposalStatus.data);
    const { status, progress, result, error } = proposalStatus.data;
    if (progress && progress.length > proposalProgress.length) {
      setProposalProgress(progress);
    }
    if (status === 'enhancing' && result) {
      // A: deterministisches Zwischenergebnis anzeigen, KI verfeinert im Hintergrund.
      setAutoProposal(result);
      setIsEnhancing(true);
      // isProposalRunning bleibt true → Polling läuft bis 'done' weiter.
    } else if (status === 'done' && result) {
      setIsProposalRunning(false);
      setIsEnhancing(false);
      setProposalJobId(null);
      setAutoProposal(result);
      // Editierbare Positionen aus dem FINALEN Vorschlag (inkl. Austausch-Titel) seeden.
      const src = ((result as any).adjustedPositions?.length ? (result as any).adjustedPositions : (result as any).positions) || [];
      setReviewPositions(toEditablePositions(src));
    } else if (status === 'error' || status === 'not_found') {
      setIsProposalRunning(false);
      setIsEnhancing(false);
      setProposalJobId(null);
      setProposalError(
        status === 'not_found'
          ? 'Der Vorschlag-Job wurde nicht gefunden (Server-Neustart?). Bitte erneut versuchen.'
          : (error ?? 'Unbekannter Fehler')
      );
    }
  }

  // Fehler-Toast als echter Seiteneffekt (nach dem Commit, nicht im Render).
  // proposalError wird beim Start eines neuen Jobs via buildProposal.reset() geleert.
  useEffect(() => {
    if (proposalError == null) return;
    toast.error('Vorschlag konnte nicht erstellt werden', { description: proposalError });
  }, [proposalError]);

  // Compatibility shim: buildProposal.isPending is used in the JSX below
  const buildProposal = {
    isPending: isProposalRunning || startProposal.isPending,
    reset: () => { setIsProposalRunning(false); setIsEnhancing(false); setProposalJobId(null); setProposalProgress([]); setLoadingMsgIdx(0); setProposalError(null); startProposal.reset(); },
  };

  // Freundliche, wechselnde Lade-Botschaften (statt technischer Einzelschritte).
  // Mischt Beruhigung + einfache Erklärungen, wie das System arbeitet.
  const universeCount = allStocks.length;
  const loadingMessages = [
    universeCount > 0
      ? `Einen Moment bitte — ich prüfe gerade ein Universum von ${universeCount} Titeln und suche die Aktien mit der besten Qualität für Sie.`
      : `Einen Moment bitte — ich prüfe gerade mehrere Hundert Titel und suche die Aktien mit der besten Qualität für Sie.`,
    `So bewerte ich: Jeder Titel bekommt einen Score von 0–100 aus drei Bausteinen — ist er günstig bewertet, wie verläuft der Kurs, und passt er zum aktuellen Markttrend.`,
    `Jetzt stelle ich Ihr Portfolio zusammen und achte auf eine gute Streuung über verschiedene Branchen und Währungen.`,
    `Ein zweites KI-Modell prüft den Vorschlag nun kritisch gegen und verbessert ihn dort, wo es sinnvoll ist.`,
    `Fast geschafft — ich berechne noch die erwartete Rendite, das Risiko und die wichtigsten Kennzahlen.`,
  ];
  useEffect(() => {
    if (!buildProposal.isPending) return;
    const id = setInterval(() => setLoadingMsgIdx((i) => (i + 1) % loadingMessages.length), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildProposal.isPending]);

  // Der Wizard-Reset bei jedem Besuch von /portfolio-builder passiert strukturell:
  // <Switch> in App.tsx matcht den Pfad exakt, d. h. die Komponente wird beim Verlassen
  // der Route unmountet und beim Zurückkommen neu gemountet — die useState-Initialwerte
  // oben sind identisch mit den Werten, die der frühere Reset-Effect gesetzt hat.

  // Pre-fill auto wizard from saved profile when user selects auto path.
  // Beim Rendern statt im Effect — der Rumpf läuft wie zuvor bei jeder Änderung von
  // savedProfile oder path, also insbesondere auch beim erneuten Betreten des Auto-Pfads.
  // Der Startwert entspricht den Initialwerten (savedProfile lädt noch, path === null),
  // damit beim ersten Render — wie beim früheren Effect — nichts gesetzt wird.
  const [profileSeed, setProfileSeed] = useState<{ profile: unknown; path: BuilderPath | null }>({ profile: undefined, path: null });
  if (profileSeed.profile !== savedProfile || profileSeed.path !== path) {
    setProfileSeed({ profile: savedProfile, path });
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
  }

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
      // Extract cash reserve percentage from KI proposal profile (liquidityNeedPct)
      // This ensures the server stores the correct cashBalance when positions only cover e.g. 50% of capital
      const liquidityNeedPct = (autoProposal as any)?.profile?.liquidityNeedPct ?? 0;
      const portfolioData: Record<string, any> = {
        stocks: selectedStocks.map((s) => {
          const a = alloc.find((x) => x.ticker === s.ticker);
          // Prefer weightPct from proposal (= % of total capital incl. cash reserve).
          // Fall back to calculateAllocation weight (= % of equity only) for manually-built portfolios.
          const weight = s.weightPct != null ? s.weightPct : (a?.weight || 0);
          const chfValue = s.quantity * s.purchasePrice;
          // Bond-Sleeve (z. B. Staatsanleihen-ETF): Der Bewertungspfad rechnet für
          // assetType "bond" Nominal-Logik (Wert = nominalValue × Kurs/100). Ein Bond-ETF
          // ist aber pro Stück bepreist — ohne nominalValue deutete der Read-Pfad den
          // ETF-Kurs (~120) als Prozent-vom-Nennwert und der Wert kollabierte auf ~1/100
          // (23 % → 0.3 %). Deshalb als Nominal zu 100 % Par speichern:
          // nominalValue = CHF-Wert, Kurs = 100 → Wert = CHF-Wert. So stimmt das Gewicht
          // und die Obligationen-Einstufung (aus assetType "bond") bleibt erhalten.
          if (s.assetType === 'bond') {
            return {
              ticker: s.ticker, companyName: s.companyName,
              weight, shares: Math.round(s.quantity).toString(),
              nominalValue: chfValue.toFixed(2),
              currentPrice: "100", avgBuyPrice: "100",
              totalValue: chfValue.toFixed(2),
              currency: currency || "CHF", assetType: "bond",
            };
          }
          return {
            ticker: s.ticker, companyName: s.companyName,
            weight, shares: Math.round(s.quantity).toString(),
            currentPrice: s.purchasePrice.toFixed(2), avgBuyPrice: s.purchasePrice.toFixed(2),
            totalValue: chfValue.toFixed(2),
            currency: currency || "CHF", assetType: s.assetType,
          };
        }),
      };
      // If KI proposal has a cash reserve, store it so server calculates cashBalance correctly
      if (liquidityNeedPct > 0) {
        portfolioData.cashPercentage = liquidityNeedPct;
      }
      const result = await createPortfolioMutation.mutateAsync({
        name: portfolioName, description: portfolioDescription || undefined,
        portfolioData: JSON.stringify(portfolioData),
        investmentAmount: parseFloat(initialCapital) || 0,
        portfolioType: isLive ? "live" : "demo",
        isAiOptimized,
      });
      toast.success("Portfolio erstellt 🎉");
      // M-02: Invalidate dashboard caches so data loads immediately after navigation
      await Promise.all([
        utils.dashboard.getPortfolioCompact.invalidate(),
        utils.portfolios.list.invalidate(),
        utils.dashboard.getSectorAllocation.invalidate(),
        utils.dashboard.getRegionAllocation.invalidate(),
        utils.dashboard.getAggregatedHoldings.invalidate(),
        utils.dashboard.getAggregatedMetrics.invalidate(),
        utils.dashboard.getPerformanceTimeseries.invalidate(),
      ]);
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

  // Save profile + trigger proposal (async job pattern — avoids HTTP 524 timeout)
  const handleBuildProposal = async () => {
    const capital = parseFloat(initialCapital);
    if (!(capital > 0)) { toast.error("Bitte geben Sie einen Anlagebetrag ein"); return; }
    if (!portfolioName.trim()) setPortfolioName("KI-Portfolio");
    // Reset any previous job state
    buildProposal.reset();
    setAutoProposal(null);
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
    // Start async job (returns immediately with jobId, polling handles the rest)
    startProposal.mutate({ investmentAmount: capital, stocksOnly });
  };

  // Accepts the proposal — uses adjustedPositions (KI-Empfehlungen eingearbeitet) if available
  const handleAcceptProposal = (useAdjusted = true) => {
    if (!autoProposal?.positions?.length) return;
    // Use entered capital, or fall back to 100'000 CHF if not set
    const capital = parseFloat(initialCapital) || 100000;
    // Use adjustedPositions (KI-Empfehlungen automatically applied) if available and requested
    // Bevorzugt die im Vorschlag bearbeiteten Positionen (Gewicht/Austausch/Löschen/
    // Hinzufügen), sonst der KI-Vorschlag. "Ohne KI-Anpassungen" nimmt bewusst die Rohliste.
    const rawSource = (useAdjusted && (autoProposal as any).adjustedPositions?.length)
      ? (autoProposal as any).adjustedPositions
      : autoProposal.positions;
    const source: any[] = (useAdjusted && reviewPositions.length) ? reviewPositions : rawSource;
    // Gewichte normieren — der Editor lässt beliebige Summen zu.
    //
    // Zielsumme ist NICHT 100 %, sondern der investierte Anteil: Die
    // Liquiditätsquote aus dem Anlegerprofil wird beim Anlegen als eigener
    // Cash-Betrag auf das Kapital gerechnet (portfoliosRouter, cashPercentage).
    // Eine Normierung auf 100 % hätte die Positionen also auf das volle Kapital
    // dimensioniert und die Reserve obendrauf gelegt — das Portfolio wäre mit
    // 110 % des Einsatzes gestartet und «Seit Kauf» am ersten Tag bei +10 %.
    const cashPct = parseFloat(String((autoProposal as any)?.profile?.liquidityNeedPct ?? 0)) || 0;
    const zielSumme = cashPct > 0 && cashPct < 100 ? 100 - cashPct : 100;
    const totalW = source.reduce((s: number, p: any) => s + (parseFloat(String(p.weightPct ?? p.weight ?? '0')) || 0), 0);
    const positionsToUse: any[] = totalW > 0
      ? source.map((p: any) => ({ ...p, weightPct: (parseFloat(String(p.weightPct ?? p.weight ?? '0')) || 0) / totalW * zielSumme }))
      : source;
    // Track whether KI adjustments were applied
    setIsAiOptimized(useAdjusted && !!(autoProposal as any).adjustedPositions?.length);
    // Build a lookup map from the allStocks list as a fallback for missing prices
    const stockPriceMap = new Map<string, { price: number; fxRate: number }>();
    allStocks.forEach((s) => {
      const p = parseFloat(s.currentPrice || '0');
      if (p > 0) stockPriceMap.set(s.ticker.toUpperCase(), { price: p, fxRate: 1 });
    });
    const seeded: StockSelection[] = positionsToUse.map((p: any) => {
      const value = (p.weightPct / 100) * capital;
      const fxRate = parseFloat(String(p.exchangeRateToChf || '1')) || 1;
      // currentPrice can be a string (raw DB value) or a number — always coerce to float
      let rawPrice = parseFloat(String(p.currentPrice ?? '0')) || 0;
      // Fallback: if price is missing, try allStocks lookup
      if (rawPrice <= 0) {
        const fallback = stockPriceMap.get(String(p.ticker ?? '').toUpperCase());
        if (fallback) rawPrice = fallback.price;
      }
      // exchangeRateToChf = "1 foreign currency unit = X CHF" → to convert foreign→CHF: multiply by fxRate
      // For CHF stocks fxRate=1 so rawPrice*1=rawPrice ✓
      const priceCHF = fxRate > 0 ? rawPrice * fxRate : rawPrice;
      const qty = priceCHF > 0 ? value / priceCHF : 0;
      // Multi-Asset-Sleeve: ETF-Positionen (inkl. Anlageklasse) korrekt typisieren,
      // Aktien bleiben "stock" (assetClass "equity"/undefined → stock).
      const mappedAssetType: StockSelection["assetType"] =
        p.assetClass === "bond" ? "bond" : (p.assetType === "etf" || (p.assetClass && p.assetClass !== "equity")) ? "etf" : "stock";
      return { ticker: p.ticker, companyName: p.companyName, quantity: Math.round(qty), purchasePrice: priceCHF, assetType: mappedAssetType, weightPct: p.weightPct, assetClass: p.assetClass && p.assetClass !== "equity" ? p.assetClass : undefined };
    });
    setSelectedStocks(seeded);
    const goalToType: Record<string, PortfolioType> = { dividends: "dividends", growth: "growth", balanced: "balanced" };
    setPortfolioType(goalToType[autoGoal] ?? "balanced");
    if (!portfolioName.trim()) setPortfolioName("KI-Portfolio");
    setPath("auto");
    // Direkt zum Abschluss: Strategie, Name, Anlagebetrag und die Titelauswahl
    // sind aus dem KI-Vorschlag bereits gesetzt. Bis Juli 2026 landete man hier
    // in Schritt 1 und wurde dieselben vier Dinge nochmals gefragt — inklusive
    // einer Aktien- und Anleihen-Auswahl, die der Vorschlag längst getroffen
    // hatte. Über «Zurück» bleiben die früheren Schritte erreichbar, falls doch
    // etwas angepasst werden soll.
    setCurrentStep(5);
  };

  const handleSendToAdminReview = () => {
    const logId = (autoProposal as any)?.proposalLogId;
    if (logId) {
      // Use window.location.href so query params (proposalId, returnTo) are preserved
      // Wouter's navigate() does not pass query params to window.location.search
      window.location.href = `/admin/proposal-analysis?proposalId=${logId}&returnTo=/portfolio-builder`;
    } else {
      window.location.href = '/admin/proposal-analysis';
    }
  };

  // Handle return from admin review: load reviewed proposal and pre-fill wizard
  const getReviewedProposal = trpc.admin.getProposalById.useQuery(
    { proposalId: (() => {
      if (typeof window === 'undefined') return 0;
      const p = new URLSearchParams(window.location.search).get('reviewedProposalId');
      return p ? parseInt(p, 10) : 0;
    })() },
    { enabled: typeof window !== 'undefined' && !!new URLSearchParams(window.location.search).get('reviewedProposalId') }
  );
  // Übernahme eines admin-geprüften Vorschlags — beim Rendern statt im Effect.
  // Der Rumpf läuft wie zuvor genau einmal pro neuer Query-Antwort.
  const [handledReviewedProposal, setHandledReviewedProposal] = useState<unknown>(null);
  const applyReviewedProposal = (proposal: NonNullable<typeof getReviewedProposal.data>) => {
    const rawReviewed = (proposal.adminReviewedPositions as any[]) ?? (proposal.positions as any[]) ?? [];
    if (rawReviewed.length === 0) return;
    // Enrich adminReviewedPositions with currentPrice + exchangeRateToChf from the original positions
    // (adminReviewedPositions only store ticker/weightPct, not price data)
    const origByTicker = new Map<string, any>();
    ((proposal.positions as any[]) ?? []).forEach((p: any) => origByTicker.set(String(p.ticker ?? '').toUpperCase(), p));
    const reviewedPositions = rawReviewed.map((p: any) => {
      const orig = origByTicker.get(String(p.ticker ?? '').toUpperCase());
      return {
        ...p,
        currentPrice: (p.currentPrice != null && p.currentPrice !== 0) ? p.currentPrice : (orig?.currentPrice ?? 0),
        exchangeRateToChf: (p.exchangeRateToChf != null && p.exchangeRateToChf !== 0) ? p.exchangeRateToChf : (orig?.exchangeRateToChf ?? 1),
        companyName: p.companyName ?? orig?.companyName ?? p.ticker,
        // Übertrage aiReason aus den Original-Positionen falls nicht vorhanden
        aiReason: (typeof p.aiReason === 'string' && p.aiReason.trim()) ? p.aiReason : (orig?.aiReason ?? undefined),
        // Übertrage weitere Felder aus Original-Positionen für die Anzeige
        signal: p.signal ?? orig?.signal,
        combinedScore: p.combinedScore ?? orig?.combinedScore,
        sector: p.sector ?? orig?.sector,
        currency: p.currency ?? orig?.currency,
        dividendYield: p.dividendYield ?? orig?.dividendYield,
        ytdPerf: p.ytdPerf ?? orig?.ytdPerf,
        reason: p.reason ?? orig?.reason,
        // Multi-Asset-Sleeve-Felder durchreichen (ETF-Typisierung im Accept-Schritt)
        assetType: p.assetType ?? orig?.assetType,
        assetClass: p.assetClass ?? orig?.assetClass,
      };
    });
    const capital = parseFloat(initialCapital) || 100000;
    // Build a synthetic autoProposal from the reviewed positions
    const methodLabelMap: Record<string, string> = {
      max_sharpe: 'Max. Sharpe',
      min_variance: 'Min. Varianz',
      max_dividend: 'Max. Dividende',
      equal_weight: 'Gleichgewichtet',
      hrp: 'HRP',
    };
    // finalAdjustments kann neu als { autoApplied, items } gewrappt sein
    // (Auto-Übernahme markiert) — für die Anzeige immer das Array entpacken.
    const faRaw: any = (proposal as any).finalAdjustments;
    const finalAdjustmentsArr: any[] = Array.isArray(faRaw)
      ? faRaw
      : (Array.isArray(faRaw?.items) ? faRaw.items : []);
    const adjustmentsAutoApplied = !!(faRaw && !Array.isArray(faRaw) && faRaw.autoApplied);
    setAutoProposal({
      // Verwende reviewedPositions als positions (mit aiReason + Admin-Gewichten)
      positions: reviewedPositions,
      adjustedPositions: reviewedPositions,
      finalAdjustments: finalAdjustmentsArr,
      autoApplied: adjustmentsAutoApplied,
      synthesizerVerdict: proposal.synthesizerVerdict,
      challengerCritique: proposal.challengerCritique,
      overallConfidence: proposal.overallConfidence,
      proposalLogId: proposal.id,
      expectedReturn: proposal.expectedReturnPct,
      volatility: proposal.volatilityPct,
      sharpe: proposal.sharpe,
      fxWeightPct: proposal.fxWeightPct,
      meetsKennzahlenFilter: proposal.meetsKennzahlenFilter,
      // Synthetic fields required by the Wizard UI
      methodLabel: methodLabelMap[proposal.method ?? ''] ?? 'KI-Optimiert (Admin-geprüft)',
      stats: {
        scoredCount: reviewedPositions.length,
        buySignals: reviewedPositions.length,
        watchlistRecommendations: 0,
      },
      weighting: { source: 'optimizer', method: proposal.method ?? 'max_sharpe' },
    });
    // Auch auf diesem Weg die Positionen zum Bearbeiten freigeben — sonst
    // landet man in Schritt 5 auf einer reinen Leseansicht.
    setReviewPositions(toEditablePositions(reviewedPositions));
    setPath('auto');
    setAutoStep(5);
    setInitialCapital(capital.toString());
    setIsAdminReviewed(true);
  };
  if (getReviewedProposal.data && getReviewedProposal.data !== handledReviewedProposal) {
    setHandledReviewedProposal(getReviewedProposal.data);
    applyReviewedProposal(getReviewedProposal.data);
  }

  // Seiteneffekte nach dem Übernehmen des geprüften Vorschlags (Toast + URL bereinigen).
  // isAdminReviewed wird nur hier gesetzt und nie zurückgesetzt → feuert genau einmal.
  useEffect(() => {
    if (!isAdminReviewed) return;
    toast.success('Admin-geprüfter Vorschlag geladen — Sie können ihn jetzt übernehmen');
    // Clean up URL param
    window.history.replaceState({}, '', '/portfolio-builder');
  }, [isAdminReviewed]);

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
        <div className="flex-1 flex flex-col items-center justify-start px-4 py-8 overflow-y-auto">
          <div className={`w-full ${autoStep === 5 && autoProposal ? 'max-w-4xl' : 'max-w-2xl'}`}>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">{meta.title}</h2>
            <p className="text-gray-400 mb-8">{meta.subtitle}</p>

            {/* N-07: Profile hint when savedProfile was loaded */}
            {autoStep === 1 && savedProfile && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#00CFC1]/10 border border-[#00CFC1]/20 mb-4">
                <CheckCircle className="h-4 w-4 text-[#00CFC1] shrink-0" />
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

                {/* Anlageklassen: Multi-Asset-Mix (empfohlen) vs. «Nur Aktien».
                    Die Wahl fliesst in startProposal ein — nach einem erstellten
                    Vorschlag ist sie gesperrt (neue Analyse nötig). */}
                <div className="rounded-lg border border-white/10 bg-[#0f1420] p-4 space-y-3">
                  <Label className="text-gray-300">Anlageklassen</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={isProposalRunning || !!autoProposal}
                      onClick={() => setStocksOnly(false)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        !stocksOnly
                          ? "border-[#00CFC1]/60 bg-[#00CFC1]/10"
                          : "border-white/10 hover:border-white/25"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className={`text-sm font-semibold ${!stocksOnly ? "text-[#00CFC1]" : "text-white"}`}>
                        Multi-Asset-Mix (empfohlen)
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Aktien plus Obligationen, Rohstoffe, Gold, Immobilien und ggf. Krypto — passend zu Ihrem Anlegerprofil.
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={isProposalRunning || !!autoProposal}
                      onClick={() => setStocksOnly(true)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        stocksOnly
                          ? "border-amber-500/60 bg-amber-500/10"
                          : "border-white/10 hover:border-white/25"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className={`text-sm font-semibold ${stocksOnly ? "text-amber-400" : "text-white"}`}>
                        Nur Aktien
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Wie bisher: 100% Aktienanteil, keine Beimischung anderer Anlageklassen.
                      </div>
                    </button>
                  </div>
                  {stocksOnly && (PROFILE_EQUITY_SHARE[autoRisk] ?? 100) < 100 && (
                    <p className="text-xs text-amber-400">
                      ⚠ «Nur Aktien» weicht von Ihrem Anlegerprofil ab — empfohlene Aktienquote für «
                      {RISK_PROFILES.find((r) => r.value === autoRisk)?.label ?? autoRisk}» ca. {PROFILE_EQUITY_SHARE[autoRisk]}%.
                      Das bedeutet ein höheres Risiko als Ihr Profil vorsieht.
                    </p>
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
                    {/* Abweichungs-Hinweis bei «Nur Aktien» (kommt vom Server, profilabhängig) */}
                    {(autoProposal as any).deviationFromProfile && (
                      <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
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
                      <span className="text-xs text-gray-500 ml-auto self-center">
                        {/* Nachprüfbare Basis statt blosses «historisch geschätzt» —
                            die Rendite ist ein Langfrist-Mittel, kein Jahresversprechen. */}
                        {(autoProposal as any).metrics?.basisJahreMedian != null
                          ? `historisch geschätzt · Ø ${(autoProposal as any).metrics.basisJahreMedian} J. Kurshistorie`
                          : 'historisch geschätzt'}
                      </span>
                    </div>
                    {/* Anlageklassen-Mischung des Vorschlags (Multi-Asset-Sleeve, vor Cash-Quote) */}
                    {(autoProposal as any).assetAllocation && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-400">Mischung:</span>
                        {Object.entries((autoProposal as any).assetAllocation as Record<string, number>)
                          .filter(([, v]) => v > 0)
                          .map(([k, v]) => (
                            <span key={k} className="px-2.5 py-0.5 rounded-full bg-white/8 text-gray-200 text-xs border border-white/10">
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
                            '. Die Zusammensetzung basiert auf Score-Ranking, Sektor-Diversifikation und Markt-Regime-Analyse.';
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
                    {/* Die frühere schreibgeschützte Positionsliste ist entfallen —
                        sie führte dieselben Titel ein zweites Mal auf. Kurs, Note,
                        Signal und die KI-Begründung stehen jetzt direkt im
                        Bearbeiten-Bereich weiter unten. */}
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

                    {/* Positionen VOR der Übernahme direkt bearbeiten: Gewicht anpassen,
                        Titel austauschen (Ticker anklicken), löschen oder hinzufügen.
                        Nur wenn der Vorschlag final ist (nicht während der KI-Verfeinerung). */}
                    {!isEnhancing && reviewPositions.length > 0 && (
                      <div className="bg-[#0f1420] border border-white/10 rounded-lg p-4">
                        <ProposalPositionEditor
                          positions={reviewPositions}
                          allStocks={allStocks}
                          onChange={setReviewPositions}
                          cashReservePct={(autoProposal as any).profile?.liquidityNeedPct}
                        />
                        <p className="text-xs text-gray-500 mt-3">
                          Gewichte anpassen, Titel austauschen (Ticker anklicken), entfernen oder
                          hinzufügen. Beim Übernehmen werden die Gewichte auf 100 % normiert.
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-gray-600">
                      ⚠️ Automatischer Vorschlag auf Basis historischer Daten — keine Anlageberatung.
                    </p>
                    {/* Direkte Übernahme-Buttons — Admin-Review entfernt, Challenger/Synthesizer-Anpassungen werden automatisch eingearbeitet */}
                    <div className="flex flex-wrap justify-between gap-3">
                      <Button variant="outline" className="border-white/10 text-gray-300"
                        onClick={() => setAutoProposal(null)} disabled={buildProposal.isPending}>
                        Neu erstellen
                      </Button>
                      <div className="flex gap-2 flex-wrap">
                        {(autoProposal as any).adjustedPositions && (
                          <Button
                            variant="outline"
                            className="border-white/20 text-gray-300 hover:bg-white/5 text-sm disabled:opacity-50"
                            onClick={() => handleAcceptProposal(false)}
                            disabled={isEnhancing}
                            title="Roher Algorithmus-Vorschlag ohne KI-Anpassungen"
                          >
                            Ohne KI-Anpassungen
                          </Button>
                        )}
                        {/* Während der KI-Verfeinerung (enhancing) sind Titel/Gewichte noch das
                            Zwischenergebnis (Vor-Swap). Übernehmen erst zulassen, wenn der Vorschlag
                            final ist — sonst wird die unfertige Version gespeichert (Austausch-Titel fehlen). */}
                        <Button className="bg-[#00CFC1] text-[#0a0f1a] hover:bg-[#00CFC1]/90 font-semibold disabled:opacity-50" disabled={isEnhancing} onClick={() => handleAcceptProposal(true)}>
                          {isEnhancing ? 'KI verfeinert noch…' : ((autoProposal as any).adjustedPositions ? 'KI-Optimiert übernehmen' : 'Vorschlag übernehmen')}
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
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
