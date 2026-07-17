import { useState, useMemo, useEffect } from "react";
import { useRoute, Link, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, Shield, Users, Lightbulb, Bell, Plus, ExternalLink, X, Info, Newspaper, BarChart3, Activity, DollarSign } from "lucide-react";
import { StockLogo } from "@/components/StockLogo";
import { formatMarketCap } from "@/lib/format";
import DashboardLayout from "@/components/DashboardLayout";
import { TradingViewWidget, ADVANCED_CHART_CONFIG, TECHNICAL_ANALYSIS_CONFIG, COMPANY_FINANCIALS_CONFIG } from "@/components/TradingViewWidget";
import TradingViewSignalsTab from "@/components/stock/TradingViewSignalsTab";
import StockScoringWidget from "@/components/stock/StockScoringWidget";
import BubbleRiskCard from "@/components/stock/BubbleRiskCard";
import AnalystConsensusCard from "@/components/stock/AnalystConsensusCard";
import { PegBadge } from "@/components/stock/PegContextCard";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

type TimePeriod = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "10Y" | "YTD" | "All";

// Score circle component with explanation
function ScoreCircle({ score, onClick }: { score: number; onClick?: () => void }) {
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  // UX2-7: Farbskala deckungsgleich mit der erklärten Notenskala im
  // Score-Dialog (>80 Ausgezeichnet · 61–80 Gut · 41–60 Mittel · ≤40 Schwach).
  const getColor = (score: number) => {
    if (score > 80) return "#00CFC1";
    if (score > 60) return "#eab308";
    if (score > 40) return "#fb923c";
    return "#ef4444";
  };
  
  return (
    <div 
      className={`relative w-20 h-20 ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
      onClick={onClick}
      title={onClick ? "Klicken für Score-Erklärung" : ""}
    >
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="#1a1f2e"
          strokeWidth="8"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={getColor(score)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold text-white">{score}</span>
        <span className="text-xs text-gray-400">/100</span>
      </div>
    </div>
  );
}

// Metric card component with rating
function MetricCard({ label, value, suffix = "", rating }: { label: string; value: string | number; suffix?: string; rating?: "good" | "neutral" | "bad" }) {
  const getRatingColor = () => {
    if (!rating) return "text-white";
    switch (rating) {
      case "good": return "text-[#00CFC1]";
      case "neutral": return "text-yellow-500";
      case "bad": return "text-red-500";
      default: return "text-white";
    }
  };
  
  const getRatingBorder = () => {
    if (!rating) return "border-white/10";
    switch (rating) {
      case "good": return "border-[#00CFC1]/30";
      case "neutral": return "border-yellow-500/30";
      case "bad": return "border-red-500/30";
      default: return "border-white/10";
    }
  };
  
  return (
    <div className={`bg-[#1a1f2e] rounded-lg p-3 border ${getRatingBorder()}`}>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-bold ${getRatingColor()}`}>
        {value}{suffix}
      </div>
    </div>
  );
}

// Moat card component
function MoatCard({ number, title, icon: Icon }: { number: number; title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 bg-[#1a1f2e] rounded-lg p-4 border border-white/10 hover:border-[#00CFC1]/30 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-[#00CFC1]/20 flex items-center justify-center">
        <Icon className="w-5 h-5 text-[#00CFC1]" />
      </div>
      <div>
        <div className="text-sm text-gray-400">{number}.</div>
        <div className="text-white font-medium">{title}</div>
      </div>
    </div>
  );
}

// Financial highlight component
function FinancialHighlight({ label, value, isPositive }: { label: string; value: string; isPositive?: boolean }) {
  return (
    <div className="bg-[#1a1f2e] rounded-lg p-4 border border-white/10 text-center">
      <div className="text-xs text-gray-400 mb-2">{label}</div>
      <div className={`text-lg font-bold ${isPositive ? 'text-[#00CFC1]' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}

export default function StockDetail() {
  // Active route is /aktien/:ticker (legacy /stock/:ticker redirects here).
  // Must match the live route or the page renders blank via `if (!match) return null`.
  const [match, params] = useRoute<{ ticker: string }>("/aktien/:ticker");
  const ticker = params?.ticker || '';
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("6M");
  const [showScoreExplanation, setShowScoreExplanation] = useState(false);
  const [showSignalExplanation, setShowSignalExplanation] = useState(false);
  const [showAddToPortfolio, setShowAddToPortfolio] = useState(false);
  const [showPriceAlert, setShowPriceAlert] = useState(false);
  // UX2-1: Alarm-Dialog verdrahtet (vorher toter Button ohne onClick/State)
  const [alertType, setAlertType] = useState<"above_price" | "below_price" | "percent_change">("above_price");
  const [alertValue, setAlertValue] = useState("");
  const [alertEmail, setAlertEmail] = useState(true);
  const [alertWhatsapp, setAlertWhatsapp] = useState(false);
  // Kauf-Modal-State (echte Transaktion)
  const [buyPortfolioId, setBuyPortfolioId] = useState<string>("");
  const [buyShares, setBuyShares] = useState<string>("");
  const [buyPrice, setBuyPrice] = useState<string>("");
  const [, navigate] = useLocation();
  
  // Parse query parameters to get referrer portfolio and active tab
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const fromPortfolioId = searchParams.get('from');
  const urlTab = searchParams.get('tab') || 'overview';
  // F-09: alte Deep-Links auf entfernte Tabs (KI-Prognose, Backtest, Bewertung/DCF) auf die Übersicht umleiten
  const [activeStockTab, setActiveStockTab] = useState(
    urlTab === 'prediction' || urlTab === 'backtest' || urlTab === 'valuation'
      ? 'overview'
      : urlTab === 'signals'
      ? 'chart-ta'
      : urlTab
  );
  
  const handleStockTabChange = (tab: string) => {
    setActiveStockTab(tab);
    const newParams = new URLSearchParams(searchString);
    if (tab === 'overview') {
      newParams.delete('tab');
    } else {
      newParams.set('tab', tab);
    }
    const newSearch = newParams.toString() ? `?${newParams.toString()}` : '';
    navigate(`/aktien/${ticker}${newSearch}`, { replace: true });
  };

  // Fetch stock data
  const { data: stock, isLoading } = trpc.stocks.byTicker.useQuery(ticker, {
    enabled: !!ticker,
    retry: false,
  });

  // Fetch historical prices for chart
  const { data: historicalPrices = [], isLoading: isLoadingPrices } = trpc.stocks.getHistoricalPrices.useQuery(
    { ticker, period: selectedPeriod },
    { enabled: !!ticker, retry: false, staleTime: 5 * 60 * 1000 }
  );

  // Fetch news for this stock (using the inline router which takes just a string)
  const { data: newsData = [] } = trpc.news.getByTicker.useQuery(
    ticker,
    { enabled: !!ticker, retry: false }
  );

  // Check if stock is already in a portfolio (for hiding "Add to Portfolio" button)
  const { data: userPortfolios = [] } = trpc.portfolios.list.useQuery();
  const utils = trpc.useUtils();

  // Signal-Score (Strategie) für den Header-Kreis neben dem Qualitäts-Score.
  const { data: signalScoringData } = trpc.tradingview.stockScoring.useQuery(
    { symbol: ticker },
    { enabled: !!ticker, staleTime: 5 * 60 * 1000, retry: false }
  );
  const signalScoring = (signalScoringData as any)?.json ?? signalScoringData;
  const signalScore: number | null =
    typeof signalScoring?.combinedScore === "number" ? signalScoring.combinedScore : null;

  // Echte Kauf-Transaktion (Mockup S.07: "Kaufen" → Portfolio-Picker → Transaktion)
  const createTransaction = trpc.portfolioTransactions.create.useMutation({
    onSuccess: () => {
      toast.success("Kauf erfasst");
      setShowAddToPortfolio(false);
      setBuyShares("");
      setBuyPrice("");
      const pid = Number(buyPortfolioId);
      if (pid > 0) {
        utils.portfolios.getWithCurrency.invalidate(pid);
        utils.portfolioTransactions.list.invalidate({ portfolioId: pid });
      }
      utils.portfolios.list.invalidate();
    },
    onError: (e) => toast.error(`Fehler beim Kauf: ${e.message}`),
  });

  // UX2-1: Preisalarm wirklich anlegen (gleicher Endpoint wie die Alarme-Seite)
  const createAlert = trpc.priceAlerts.create.useMutation({
    onSuccess: () => {
      toast.success("Alarm erfolgreich erstellt");
      setShowPriceAlert(false);
      setAlertValue("");
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const handleCreateAlert = () => {
    if (!alertValue || !(parseFloat(alertValue) !== 0)) {
      toast.error(alertType === "percent_change" ? "Bitte Prozentänderung eingeben" : "Bitte Zielpreis eingeben");
      return;
    }
    createAlert.mutate({
      ticker,
      alertType,
      targetPrice: alertType === "percent_change" ? undefined : alertValue,
      percentChange: alertType === "percent_change" ? alertValue : undefined,
      notificationMethod: alertEmail && alertWhatsapp ? "both" : alertWhatsapp ? "whatsapp" : "email",
    });
  };

  const handleBuy = () => {
    const pid = Number(buyPortfolioId || userPortfolios[0]?.id);
    const sharesNum = parseFloat(buyShares);
    const priceNum = parseFloat(buyPrice) || parseFloat(stock?.currentPrice || "0");
    if (!pid || !(sharesNum > 0)) {
      toast.error("Bitte Portfolio und Anzahl Aktien angeben");
      return;
    }
    createTransaction.mutate({
      portfolioId: pid,
      transactionType: "buy",
      ticker,
      shares: String(sharesNum),
      pricePerShare: String(priceNum),
      totalAmount: String(sharesNum * priceNum),
      fees: "0",
      notes: null,
      transactionDate: new Date().toISOString(),
    });
  };
  
  // Check if this stock exists in any of the user's portfolios
  const isInPortfolio = useMemo(() => {
    if (!ticker || userPortfolios.length === 0) return false;
    
    // If we came from a portfolio, the stock is definitely in that portfolio
    if (fromPortfolioId) return true;
    
    // Otherwise check all portfolios (this would need a separate query for holdings)
    return false;
  }, [ticker, userPortfolios, fromPortfolioId]);

  // Generate chart data from historical prices or simulate if not available
  const chartData = useMemo(() => {
    // Use real historical prices if available
    if (historicalPrices.length > 0) {
      const data = historicalPrices.map((d: any) => ({
        date: d.date,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
      }));
      
      // Add current price as the last data point if it's newer than the last historical price
      // This ensures the chart shows the most up-to-date price
      if (stock?.currentPrice) {
        const currentPrice = parseFloat(stock.currentPrice);
        const today = new Date().toISOString().split('T')[0];
        const lastHistoricalDate = data[data.length - 1]?.date;
        
        // Only add if today is different from the last historical date
        if (lastHistoricalDate && today > lastHistoricalDate) {
          data.push({
            date: today,
            open: currentPrice,
            high: currentPrice,
            low: currentPrice,
            close: currentPrice,
            volume: 0,
          });
        } else if (lastHistoricalDate === today) {
          // Update the last data point with the current price
          data[data.length - 1].close = currentPrice;
          data[data.length - 1].high = Math.max(data[data.length - 1].high || currentPrice, currentPrice);
          data[data.length - 1].low = Math.min(data[data.length - 1].low || currentPrice, currentPrice);
        }
      }
      
      return data;
    }
    
    // Fallback: Try to parse stored chart data from stock
    if (stock?.chartData) {
      try {
        const parsed = JSON.parse(stock.chartData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((d: any) => ({
            date: d.date,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            volume: d.volume,
          }));
        }
      } catch (e) {
        console.warn("Failed to parse chart data", e);
      }
    }
    
    // DAT-1 (Audit 2026-07): KEINE simulierten Kursverläufe mehr — der frühere
    // Random-Walk-Fallback zeigte erfundene Kurse (inkl. Performance-Badge) als
    // echte Historie an. Ohne Daten wird ein ehrlicher Leerzustand gerendert.
    return [];
  }, [stock, historicalPrices, selectedPeriod]);

  // Calculate price change
  const priceChange = useMemo(() => {
    if (chartData.length < 2) return { absolute: 0, percent: 0 };
    const first = chartData[0].close;
    const last = chartData[chartData.length - 1].close;
    return {
      absolute: last - first,
      percent: ((last - first) / first) * 100,
    };
  }, [chartData]);

  // Handle back navigation
  const handleBackClick = () => {
    if (fromPortfolioId) {
      // Navigate back to the specific portfolio (use /portfolios/ route)
      navigate(`/portfolios/${fromPortfolioId}`);
    } else {
      // Default: go to portfolios list
      navigate('/portfolios');
    }
  };

  if (!match) return null;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Lade Aktien-Details...</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!stock) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">Aktie nicht gefunden</p>
            <Button variant="outline" onClick={handleBackClick}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const currentPrice = parseFloat(stock.currentPrice || "0");
  const currency = stock.currency || "CHF";
  // Kein Fallback auf erfundene Werte: fehlt der Score, wird keiner angezeigt
  const score = stock.score ?? null;
  
  // Rating logic for metrics
  const getRating = (metric: string, value: string | null | undefined): "good" | "neutral" | "bad" | undefined => {
    if (!value) return undefined;
    const numValue = parseFloat(value);
    
    switch (metric) {
      case "peRatio":
        if (numValue < 15) return "good";
        if (numValue < 25) return "neutral";
        return "bad";
      case "pegRatio":
        if (numValue < 1) return "good";
        if (numValue < 2) return "neutral";
        return "bad";
      case "dividendYield":
        if (numValue > 3) return "good";
        if (numValue > 1) return "neutral";
        return "bad";
      case "beta":
        if (numValue < 1) return "good";
        if (numValue < 1.5) return "neutral";
        return "bad";
      case "volatility":
        if (numValue < 15) return "good";
        if (numValue < 25) return "neutral";
        return "bad";
      case "sharpeRatio":
        if (numValue > 1.5) return "good";
        if (numValue > 0.5) return "neutral";
        return "bad";
      default:
        return undefined;
    }
  };

  // DAT-1 (Audit 2026-07): keine generischen Fantasie-Moats mehr — es werden
  // nur real hinterlegte Wettbewerbsvorteile gezeigt, sonst ein Leer-Hinweis.
  const moats = [
    stock.moat1 ? { title: stock.moat1, icon: Shield } : null,
    stock.moat2 ? { title: stock.moat2, icon: Users } : null,
    stock.moat3 ? { title: stock.moat3, icon: Lightbulb } : null,
  ].filter(Boolean) as Array<{ title: string; icon: any }>;

  // DAT-1 (Audit 2026-07): keine erfundenen Kennzahlen mehr («+12.5 % YoY» für
  // jeden datenlosen Titel) — fehlende Werte werden ehrlich als «—» gezeigt.
  const financialHighlights = [
    { label: "Revenue Growth", value: stock.financialHighlight1 || "—", isPositive: !!stock.financialHighlight1 },
    { label: "Net Income Margin", value: stock.financialHighlight2 || "—", isPositive: false },
    { label: "Free Cash Flow", value: stock.financialHighlight3 || "—", isPositive: false },
  ];

  const periods: TimePeriod[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "10Y", "YTD", "All"];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
          <Link href="/aktien"><span className="hover:text-gray-300 cursor-pointer">Aktien</span></Link>
          {fromPortfolioId && (
            <>
              <span>/</span>
              <Link href={`/portfolios/${fromPortfolioId}`}><span className="hover:text-gray-300 cursor-pointer">Portfolio</span></Link>
            </>
          )}
          <span>/</span>
          <span className="text-gray-300">{ticker}</span>
        </div>

        {/* Header — matches design: logo + name + price + score circle */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleBackClick}
              className="p-2 rounded-lg bg-[#1a1f2e] border border-white/10 hover:border-[#00CFC1]/50 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
            <StockLogo ticker={ticker} companyName={stock.companyName} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-white">{ticker}</h1>
{(stock as any).exchange && <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">{(stock as any).exchange}</span>}
                {(stock as any).sector && <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">{(stock as any).sector}</span>}
              </div>
              <p className="text-gray-400 text-sm mt-0.5">{stock.companyName}</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-3xl font-bold text-white font-mono">
                {currency} {currentPrice.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`flex items-center justify-end gap-1 mt-1 ${priceChange.percent >= 0 ? 'text-[#00CFC1]' : 'text-red-500'}`}>
                {priceChange.percent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="font-semibold">{priceChange.percent >= 0 ? '+' : ''}{priceChange.absolute.toFixed(2)}</span>
                <span className="text-gray-400">({priceChange.percent >= 0 ? '+' : ''}{priceChange.percent.toFixed(2)}%)</span>
              </div>
              <div className="flex items-center justify-end gap-2 mt-2">
                <Button size="sm" onClick={() => setShowPriceAlert(true)} className="h-7 text-xs bg-[#00CFC1]/10 border border-[#00CFC1]/40 text-[#00CFC1] hover:bg-[#00CFC1]/20">
                  <Bell className="h-3 w-3 mr-1" /> Alert
                </Button>
                <Button size="sm" onClick={() => setShowAddToPortfolio(true)} className="h-7 text-xs bg-[#00CFC1] text-black hover:bg-[#00CFC1]/80">
                  <Plus className="h-3 w-3 mr-1" /> Portfolio
                </Button>
              </div>
            </div>
            {score !== null && (
              /* F-07: Qualitäts-Score (langfristig, fundamental) — Klick öffnet Erklärung */
              <div className="flex flex-col items-center gap-1">
                <ScoreCircle score={score} onClick={() => setShowScoreExplanation(true)} />
                <span className="text-xs text-gray-400">Qualität</span>
              </div>
            )}
            {signalScore !== null && (
              /* Signal-Score (Strategie) — gleichwertiger Kreis; Klick öffnet Detail/Berechnung */
              <div className="flex flex-col items-center gap-1">
                <ScoreCircle score={signalScore} onClick={() => setShowSignalExplanation(true)} />
                <span className="text-xs text-gray-400">Signal</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs per IA-Optimierung (F-10): Übersicht | Chart & TA | Signale | Bewertung | News.
            F-09: KI-Prognose-Tab ausgeblendet (Vorgabe Auftraggeber: unzuverlässig).
            Backtest-Tab ausgeblendet (Vorgabe Teil 2 «kein Alpha») — Route /backtesting
            bleibt für Direktaufrufe; Rückbau-Entscheid offen.
            PredictionTab.tsx/predictionRouter bleiben für den Rückbau-Entscheid bestehen. */}
        <Tabs value={activeStockTab} onValueChange={handleStockTabChange} className="w-full">
          <TabsList className="flex flex-wrap gap-0 bg-transparent border-b border-white/10 p-0 h-auto rounded-none mb-6">
            {[
              { value: 'overview', label: 'Übersicht' },
              { value: 'chart-ta', label: 'Chart & TA' },
              { value: 'news', label: 'News', badge: newsData.length },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00CFC1] data-[state=active]:text-[#00CFC1] data-[state=active]:bg-transparent text-gray-400 text-sm px-4 pb-3 pt-2 gap-1.5"
              >
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="bg-[#00CFC1]/20 text-[#00CFC1] text-[10px] px-1.5 py-0.5 rounded-full">{tab.badge}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Übersicht Tab */}
          <TabsContent value="overview">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Chart */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chart Card */}
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
              <CardContent className="p-4">
                {/* Period Selector with Performance */}
                <div className="flex items-center justify-between mb-4">
                  {/* Performance Badge */}
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${priceChange.percent >= 0 ? 'bg-[#00CFC1]/10' : 'bg-red-500/10'}`}>
                    {priceChange.percent >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-[#00CFC1]" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    )}
                    <span className={`text-lg font-bold ${priceChange.percent >= 0 ? 'text-[#00CFC1]' : 'text-red-500'}`}>
                      {priceChange.percent >= 0 ? '+' : ''}{priceChange.percent.toFixed(2)}%
                    </span>
                    <span className="text-xs text-gray-400">({selectedPeriod})</span>
                  </div>
                  
                  {/* Period Buttons */}
                  <div className="flex items-center gap-1">
                    {periods.map((period) => (
                      <button
                        key={period}
                        onClick={() => setSelectedPeriod(period)}
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${
                          selectedPeriod === period
                            ? 'bg-[#00CFC1] text-black font-semibold'
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chart - Price Only (without Volume) */}
                {chartData.length === 0 ? (
                  <div className="h-[400px] flex flex-col items-center justify-center text-center gap-2">
                    {isLoadingPrices ? (
                      <>
                        <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                        <p className="text-gray-400 text-sm">Kursdaten werden geladen…</p>
                        <p className="text-gray-500 text-xs">Erstmaliger Abruf für diesen Titel — bitte einen Moment warten.</p>
                      </>
                    ) : (
                      <>
                        <p className="text-gray-400 text-sm">Für diesen Titel liegen keine Kursdaten vor.</p>
                        <p className="text-gray-500 text-xs">Die Kurshistorie konnte nicht geladen werden.</p>
                      </>
                    )}
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="priceAreaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00CFC1" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#00CFC1" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#718096"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString('de-CH', { month: 'short', day: 'numeric', year: '2-digit' });
                      }}
                    />
                    <YAxis
                      yAxisId="price"
                      stroke="#718096"
                      tick={{ fontSize: 11 }}
                      domain={['dataMin - 5', 'dataMax + 5']}
                      tickFormatter={(value) => `${currency} ${value.toFixed(0)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1a1f2e',
                        border: '1px solid rgba(0, 207, 193, 0.3)',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      formatter={(value: any, name: string) => {
                        if (name === 'close') return [`${currency} ${value.toFixed(2)}`, 'Kurs'];
                        return [value, name];
                      }}
                      labelFormatter={(label) => new Date(label).toLocaleDateString('de-CH', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    />
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="close"
                      stroke="#00CFC1"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#00CFC1' }}
                    />
                    {chartData.length > 0 && (
                      <ReferenceLine
                        yAxisId="price"
                        y={chartData[0].close}
                        stroke="#4a5568"
                        strokeDasharray="3 3"
                        label={{ value: 'Start', fill: '#718096', fontSize: 10 }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Moats Section */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Wettbewerbsvorteile (Moats)</h3>
              {moats.length === 0 ? (
                <p className="text-sm text-gray-500">Für diesen Titel sind noch keine Wettbewerbsvorteile hinterlegt.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {moats.map((moat: any, index: number) => (
                    <MoatCard key={index} number={index + 1} title={moat.title || moat} icon={moat.icon || Shield} />
                  ))}
                </div>
              )}
            </div>

            {/* Financial Highlights */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Finanzkennzahlen</h3>
              <div className="flex flex-wrap gap-4">
                <div className="flex gap-4">
                  {financialHighlights.map((highlight, index) => (
                    <FinancialHighlight
                      key={index}
                      label={highlight.label}
                      value={highlight.value}
                      isPositive={highlight.isPositive}
                    />
                  ))}
                </div>
                <div className="flex gap-2 items-center ml-auto">
                  <Badge variant="secondary" className="bg-[#00CFC1]/20 text-[#00CFC1] border-[#00CFC1]/30">
                    {stock.category || "Wachstumsaktie"}
                  </Badge>
                  <Badge variant="secondary" className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                    {stock.sector || "Technology"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Action Buttons - Only show "Add to Portfolio" if not already in portfolio */}
            <div className={`grid grid-cols-1 ${isInPortfolio ? 'md:grid-cols-1' : 'md:grid-cols-2'} gap-4`}>
              {!isInPortfolio && (
                <Button 
                  onClick={() => setShowAddToPortfolio(true)}
                  className="bg-[#00CFC1] hover:bg-[#00b8ad] text-black font-semibold h-12"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Kaufen
                </Button>
              )}
              <Button
                onClick={() => setShowPriceAlert(true)}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 h-12"
              >
                <Bell className="w-4 h-4 mr-2" />
                Preisalarm erstellen
              </Button>
              {/* UX2-1: toter «Factsheet ansehen»-Button entfernt — es gibt (noch)
                  keine Factsheet-Funktion; ein Button ohne Wirkung untergräbt Vertrauen. */}
            </div>
          </div>

          {/* Right Column - Metrics (F-10: News aus der Übersicht entfernt — eigener News-Tab) */}
          <div className="space-y-6">
            {/* LPPLS Bubble-Risiko (Sornette) — nur sichtbar bei relevantem Risiko */}
            <BubbleRiskCard ticker={ticker} />
            {/* F-07: Signal-Score (Strategie) in den Signale-Tab verschoben —
                die Übersicht zeigt nur noch den Qualitäts-Score im Header. */}
            {/* Analysten-Konsens */}
            <AnalystConsensusCard ticker={ticker} />
            {/* Key Metrics */}
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard 
                    label="P/E Ratio" 
                    value={stock.peRatio ? parseFloat(stock.peRatio).toFixed(1) : "-"} 
                    rating={getRating("peRatio", stock.peRatio)}
                  />
                  <div className="bg-[#1a1f2e] rounded-lg p-3 border border-white/10">
                    <div className="text-xs text-gray-400 mb-1">PEG Ratio</div>
                    <PegBadge ticker={stock.ticker} />
                  </div>
                  <MetricCard 
                    label="Dividendenrendite" 
                    value={stock.dividendYield ? parseFloat(stock.dividendYield).toFixed(2) : "-"} 
                    suffix="%" 
                    rating={getRating("dividendYield", stock.dividendYield)}
                  />
                  <MetricCard 
                    label="Beta" 
                    value={stock.beta ? parseFloat(stock.beta).toFixed(2) : "-"} 
                    rating={getRating("beta", stock.beta)}
                  />
                  <MetricCard 
                    label="Volatilität" 
                    value={stock.volatility ? parseFloat(stock.volatility).toFixed(1) : "-"} 
                    suffix="%" 
                    rating={getRating("volatility", stock.volatility)}
                  />
                  <MetricCard 
                    label="Sharpe Ratio" 
                    value={stock.sharpeRatio ? parseFloat(stock.sharpeRatio).toFixed(2) : "-"} 
                    rating={getRating("sharpeRatio", stock.sharpeRatio)}
                  />
                  <MetricCard
                    label="Marktkapitalisierung"
                    value={formatMarketCap(stock.marketCap, currency)}
                  />
                  <MetricCard 
                    label="52W Hoch" 
                    value={stock.week52High ? `${currency} ${parseFloat(stock.week52High).toFixed(2)}` : "-"} 
                  />
                  <MetricCard 
                    label="52W Tief" 
                    value={stock.week52Low ? `${currency} ${parseFloat(stock.week52Low).toFixed(2)}` : "-"} 
                  />
                  <MetricCard 
                    label="YTD Performance" 
                    value={stock.ytdPerformance ? `${parseFloat(stock.ytdPerformance) >= 0 ? '+' : ''}${parseFloat(stock.ytdPerformance).toFixed(1)}` : "-"} 
                    suffix="%" 
                  />
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
        
        </TabsContent>

          {/* Chart & TA Tab — inkl. technischer Signale (aus dem früheren Signale-Tab).
              Der Signal-Score (Strategie) lebt neu als Kreis im Seitenkopf. */}
          <TabsContent value="chart-ta">
            <div className="space-y-4">
              <TradingViewSection ticker={ticker} stock={stock} />
              <TradingViewSignalsTab ticker={ticker} />
            </div>
          </TabsContent>

          {/* News Tab */}
          <TabsContent value="news">
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
              <CardContent className="p-4">
                <h3 className="text-lg font-semibold text-white mb-3">News zu {stock.companyName}</h3>
                <div className="space-y-3">
                  {newsData.length > 0 ? (
                    newsData.map((news: any, index: number) => (
                      <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                        <Newspaper className="w-4 h-4 text-[#00CFC1] mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <a href={news.url} target="_blank" rel="noopener noreferrer" className="text-sm text-white hover:text-[#00CFC1] transition-colors">
                            {news.title}
                          </a>
                          {news.publishedAt && (
                            <p className="text-xs text-gray-500 mt-1">{new Date(news.publishedAt).toLocaleDateString('de-CH')}</p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 text-sm">Keine aktuellen News verfügbar</p>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full mt-4 text-[#00CFC1] hover:text-[#00b8ad] hover:bg-[#00CFC1]/10"
                  onClick={() => navigate(`/newsroom?ticker=${ticker}`)}
                >
                  Alle News im Newsroom
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add to Portfolio Dialog */}
        {showAddToPortfolio && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0f1420] border border-[#00CFC1]/30 rounded-lg max-w-md w-full p-6 relative">
              <button
                onClick={() => setShowAddToPortfolio(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#00CFC1]/20 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-[#00CFC1]" />
                </div>
                <h3 className="text-xl font-bold text-white">Zu Portfolio hinzufügen</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Portfolio auswählen</label>
                  <select
                    value={buyPortfolioId || (userPortfolios[0]?.id?.toString() ?? "")}
                    onChange={(e) => setBuyPortfolioId(e.target.value)}
                    className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white focus:border-[#00CFC1] focus:outline-none"
                  >
                    {userPortfolios.length > 0 ? (
                      userPortfolios.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))
                    ) : (
                      <option value="">Kein Portfolio vorhanden</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Anzahl Aktien</label>
                  <input
                    type="number"
                    placeholder="10"
                    value={buyShares}
                    onChange={(e) => setBuyShares(e.target.value)}
                    className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white focus:border-[#00CFC1] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Kaufpreis (optional)</label>
                  <input
                    type="number"
                    placeholder={currentPrice.toFixed(2)}
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white focus:border-[#00CFC1] focus:outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Aktuell: {currency} {currentPrice.toFixed(2)}</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => setShowAddToPortfolio(false)}
                    variant="outline"
                    className="flex-1 border-white/20 text-white hover:bg-white/10"
                  >
                    Abbrechen
                  </Button>
                  <Button
                    onClick={handleBuy}
                    disabled={createTransaction.isPending || userPortfolios.length === 0}
                    className="flex-1 bg-[#00CFC1] hover:bg-[#00b8ad] text-black font-semibold"
                  >
                    {createTransaction.isPending ? "Wird gekauft…" : "Kaufen"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Price Alert Dialog */}
        {showPriceAlert && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0f1420] border border-[#00CFC1]/30 rounded-lg max-w-md w-full p-6 relative">
              <button
                onClick={() => setShowPriceAlert(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#00CFC1]/20 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-[#00CFC1]" />
                </div>
                <h3 className="text-xl font-bold text-white">Preisalarm erstellen</h3>
              </div>
              
              <div className="space-y-4">
                <div className="bg-[#1a1f2e] rounded-lg p-3 border border-white/10">
                  <div className="text-xs text-gray-400">Aktueller Preis</div>
                  <div className="text-lg font-bold text-white">
                    {currency} {currentPrice.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Alarm-Typ</label>
                  <select
                    value={alertType}
                    onChange={(e) => setAlertType(e.target.value as typeof alertType)}
                    className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white focus:border-[#00CFC1] focus:outline-none"
                  >
                    <option value="above_price">Über Preis</option>
                    <option value="below_price">Unter Preis</option>
                    <option value="percent_change">Änderung in % (±)</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">
                    {alertType === "percent_change" ? `Änderung in % (z. B. 5 oder -5)` : `Zielpreis (${currency})`}
                  </label>
                  <input
                    type="number"
                    value={alertValue}
                    onChange={(e) => setAlertValue(e.target.value)}
                    placeholder={alertType === "percent_change" ? "5" : (currentPrice * 1.1).toFixed(2)}
                    className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white focus:border-[#00CFC1] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Benachrichtigung via</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input type="checkbox" className="rounded" checked={alertEmail} onChange={(e) => setAlertEmail(e.target.checked)} />
                      E-Mail
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input type="checkbox" className="rounded" checked={alertWhatsapp} onChange={(e) => setAlertWhatsapp(e.target.checked)} />
                      WhatsApp
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => setShowPriceAlert(false)}
                    variant="outline"
                    className="flex-1 border-white/20 text-white hover:bg-white/10"
                  >
                    Abbrechen
                  </Button>
                  <Button
                    onClick={handleCreateAlert}
                    disabled={createAlert.isPending}
                    className="flex-1 bg-[#00CFC1] hover:bg-[#00b8ad] text-black font-semibold"
                  >
                    {createAlert.isPending ? "Wird erstellt…" : "Alarm erstellen"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Score Explanation Dialog */}
        {showSignalExplanation && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0f1420] border border-[#00CFC1]/30 rounded-lg max-w-lg w-full p-6 relative max-h-[85vh] overflow-y-auto">
              <button
                onClick={() => setShowSignalExplanation(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#00CFC1]/20 flex items-center justify-center">
                  <Info className="w-5 h-5 text-[#00CFC1]" />
                </div>
                <h3 className="text-xl font-bold text-white">Signal-Score (Strategie)</h3>
              </div>

              <p className="text-sm text-gray-300 mb-4">
                Der <strong className="text-[#00CFC1]">Signal-Score</strong> ist die kurz- bis
                mittelfristige Strategie-Sicht und fliesst ins Handelssignal ein — kein Qualitätsurteil
                über die Aktie. Zusammensetzung und Gewichtung (40% Momentum · 40% Qualität · 20% LPPL-Malus):
              </p>

              <StockScoringWidget ticker={ticker} />
            </div>
          </div>
        )}

        {showScoreExplanation && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0f1420] border border-[#00CFC1]/30 rounded-lg max-w-md w-full p-6 relative">
              <button
                onClick={() => setShowScoreExplanation(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#00CFC1]/20 flex items-center justify-center">
                  <Info className="w-5 h-5 text-[#00CFC1]" />
                </div>
                <h3 className="text-xl font-bold text-white">Qualitäts-Score</h3>
              </div>

              {/* F-07: Erklärung entspricht der echten Gewichtung in server/scoring.ts
                  (calculateStockScore, Dividenden- vs. Wachstumsprofil). */}
              <div className="space-y-4 text-sm text-gray-300">
                <p>
                  Der <strong className="text-[#00CFC1]">Qualitäts-Score ({score}/100)</strong> misst
                  die langfristige Qualität einer Aktie anhand von Fundamental- und Risikokennzahlen.
                  Er sagt nichts über den richtigen Kaufzeitpunkt aus — dafür gibt es den
                  Signal-Score im Seitenkopf.
                </p>

                <p>
                  Je nach Profil der Aktie werden unterschiedliche Kennzahlen gewichtet:
                </p>

                <div>
                  <p className="font-semibold text-white mb-1">Dividendentitel</p>
                  <ul className="space-y-1">
                    <li className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div><span><strong>Dividendenrendite (40%):</strong> Wie viel Ausschüttung Sie im Verhältnis zum Kurs erhalten</span></li>
                    <li className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div><span><strong>KGV (30%):</strong> Wie teuer die Aktie im Verhältnis zum Gewinn ist — tiefer ist besser</span></li>
                    <li className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div><span><strong>Beta (20%):</strong> Wie stark die Aktie mit dem Markt schwankt — stabiler ist besser</span></li>
                    <li className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div><span><strong>Volatilität (10%):</strong> Wie stark der Kurs schwankt — ruhiger ist besser</span></li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-white mb-1">Wachstumstitel</p>
                  <ul className="space-y-1">
                    <li className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div><span><strong>Sharpe Ratio (30%):</strong> Rendite im Verhältnis zum eingegangenen Risiko</span></li>
                    <li className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div><span><strong>PEG Ratio (25%):</strong> Bewertung im Verhältnis zum Gewinnwachstum — tiefer ist besser</span></li>
                    <li className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div><span><strong>Gewinnwachstum (25%):</strong> Erwartetes jährliches Gewinnwachstum (aus KGV/PEG abgeleitet)</span></li>
                    <li className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div><span><strong>Beta (20%):</strong> Marktschwankung — stabiler ist besser</span></li>
                    <li className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div><span><strong>Momentum YTD (15%):</strong> Kursentwicklung seit Jahresbeginn</span></li>
                  </ul>
                </div>

                <p className="text-xs text-gray-500">
                  Fehlt eine Kennzahl, wird sie herausgerechnet und die übrigen Gewichte werden
                  entsprechend hochskaliert (die Prozentwerte sind relative Gewichte).
                </p>

                <div className="pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#00CFC1]">&gt;80: Ausgezeichnet</span>
                    <span className="text-yellow-500">61–80: Gut</span>
                    <span className="text-orange-400">41–60: Mittel</span>
                    <span className="text-red-500">≤40: Schwach</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// Helper: Convert EODHD ticker to TradingView symbol
function toTradingViewSymbol(ticker: string): string {
  // EODHD format: NESN.SW, SAP.DE, AAPL.US
  // TradingView format: SIX:NESN, XETR:SAP, NASDAQ:AAPL
  const parts = ticker.split('.');
  if (parts.length < 2) return ticker;
  
  const symbol = parts[0];
  const exchange = parts[parts.length - 1];
  
  const exchangeMap: Record<string, string> = {
    'SW': 'SIX',
    'DE': 'XETR',
    'US': 'NASDAQ', // Default to NASDAQ for US stocks
    'LSE': 'LSE',
    'PA': 'EURONEXT',
    'AS': 'EURONEXT',
    'MI': 'MIL',
    'TO': 'TSX',
    'HK': 'HKEX',
  };
  
  const tvExchange = exchangeMap[exchange] || exchange;
  return `${tvExchange}:${symbol}`;
}

type TVTab = "chart" | "technical" | "financials";

function TradingViewSection({ ticker, stock }: { ticker: string; stock: any }) {
  const [activeTab, setActiveTab] = useState<TVTab>("chart");
  const tvSymbol = toTradingViewSymbol(ticker);

  const tabs: { id: TVTab; label: string; icon: any }[] = [
    { id: "chart", label: "Interaktiver Chart", icon: BarChart3 },
    { id: "technical", label: "Technische Analyse", icon: Activity },
    { id: "financials", label: "Finanzkennzahlen", icon: DollarSign },
  ];

  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
      <CardContent className="p-4">
        {/* Tab Header */}
        <div className="flex items-center gap-1 mb-4 border-b border-white/10 pb-3">
          <span className="text-sm text-gray-400 mr-3">TradingView:</span>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#00CFC1]/20 text-[#00CFC1] font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* SIG-5: TradingView-Inhalte sind eine unabhängige Zweitmeinung. */}
        <p className="text-xs text-gray-500 mb-3">
          Unabhängige Zweitmeinung von TradingView (eigene Datenquelle und Methodik) —
          fliesst nicht in den Score und das Signal des Portfolio Managers ein.
        </p>

        {/* Tab Content */}
        {activeTab === "chart" && (
          <TradingViewWidget
            widgetType="advanced-chart"
            config={{
              ...ADVANCED_CHART_CONFIG,
              symbol: tvSymbol,
            }}
            height={500}
          />
        )}

        {activeTab === "technical" && (
          <TradingViewWidget
            widgetType="technical-analysis"
            config={{
              ...TECHNICAL_ANALYSIS_CONFIG,
              symbol: tvSymbol,
            }}
            height={450}
          />
        )}

        {activeTab === "financials" && (
          <TradingViewWidget
            widgetType="financials"
            config={{
              ...COMPANY_FINANCIALS_CONFIG,
              symbol: tvSymbol,
            }}
            height={500}
          />
        )}

        {/* Attribution */}
        <div className="text-xs text-gray-500 mt-3 text-center">
          Daten und Charts bereitgestellt von TradingView
        </div>
      </CardContent>
    </Card>
  );
}
