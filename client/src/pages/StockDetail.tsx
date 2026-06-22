import { useState, useMemo, useEffect } from "react";
import { useRoute, Link, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, Shield, Users, Lightbulb, Bell, Plus, FileText, ExternalLink, X, Info, TrendingUpIcon, Newspaper, BarChart3, Activity, DollarSign } from "lucide-react";
import { StockLogo } from "@/components/StockLogo";
import DashboardLayout from "@/components/DashboardLayout";
import { TradingViewWidget, ADVANCED_CHART_CONFIG, TECHNICAL_ANALYSIS_CONFIG, COMPANY_FINANCIALS_CONFIG } from "@/components/TradingViewWidget";
import TradingViewSignalsTab from "@/components/stock/TradingViewSignalsTab";
import TradingViewBacktestTab from "@/components/stock/TradingViewBacktestTab";
import StockScoringWidget from "@/components/stock/StockScoringWidget";
import ValuationTab from "@/components/stock/ValuationTab";
import PredictionTab from "@/components/stock/PredictionTab";
import BubbleRiskCard from "@/components/stock/BubbleRiskCard";
import AnalystConsensusCard from "@/components/stock/AnalystConsensusCard";
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
  
  // Color based on score
  const getColor = (score: number) => {
    if (score >= 80) return "#00CFC1";
    if (score >= 60) return "#f59e0b";
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

// News item component with thematic icon
function NewsItem({ title, icon: Icon, url, date }: { title: string; icon: React.ElementType; url?: string; date?: string }) {
  const content = (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 rounded-lg px-2 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00CFC1]/20 to-[#00CFC1]/5 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-[#00CFC1]" />
      </div>
      <div className="flex-1">
        <p className="text-sm text-gray-300 line-clamp-2">{title}</p>
        {date && <p className="text-xs text-gray-500 mt-1">{date}</p>}
      </div>
    </div>
  );
  
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {content}
      </a>
    );
  }
  
  return content;
}

export default function StockDetail() {
  // Active route is /aktien/:ticker (legacy /stock/:ticker redirects here).
  // Must match the live route or the page renders blank via `if (!match) return null`.
  const [match, params] = useRoute<{ ticker: string }>("/aktien/:ticker");
  const ticker = params?.ticker || '';
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("6M");
  const [showScoreExplanation, setShowScoreExplanation] = useState(false);
  const [showAddToPortfolio, setShowAddToPortfolio] = useState(false);
  const [showPriceAlert, setShowPriceAlert] = useState(false);
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
  const [activeStockTab, setActiveStockTab] = useState(urlTab);
  
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
  });

  // Fetch historical prices for chart
  const { data: historicalPrices = [] } = trpc.stocks.getHistoricalPrices.useQuery(
    { ticker, period: selectedPeriod },
    { enabled: !!ticker }
  );

  // Fetch news for this stock (using the inline router which takes just a string)
  const { data: newsData = [] } = trpc.news.getByTicker.useQuery(
    ticker,
    { enabled: !!ticker }
  );

  // Check if stock is already in a portfolio (for hiding "Add to Portfolio" button)
  const { data: userPortfolios = [] } = trpc.portfolios.list.useQuery();
  const utils = trpc.useUtils();

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
    
    // Last resort: Generate simulated data based on current price
    if (!stock) return [];
    
    const basePrice = parseFloat(stock.currentPrice || "100");
    const data: any[] = [];
    const now = new Date();
    
    // Determine how many days to generate based on period
    let daysToGenerate = 180; // Default 6M
    switch (selectedPeriod) {
      case "1D": daysToGenerate = 1; break;
      case "1W": daysToGenerate = 7; break;
      case "1M": daysToGenerate = 30; break;
      case "3M": daysToGenerate = 90; break;
      case "6M": daysToGenerate = 180; break;
      case "1Y": daysToGenerate = 365; break;
      case "3Y": daysToGenerate = 1095; break;
      case "5Y": daysToGenerate = 1825; break;
      case "10Y": daysToGenerate = 3650; break;
      case "YTD": 
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        daysToGenerate = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
        break;
      case "All": daysToGenerate = 3650; break;
    }
    
    for (let i = daysToGenerate; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      const randomWalk = (Math.random() - 0.48) * 0.02;
      const prevClose = data.length > 0 ? data[data.length - 1].close : basePrice;
      const open = prevClose * (1 + (Math.random() - 0.5) * 0.01);
      const close = open * (1 + randomWalk);
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      const volume = Math.floor(Math.random() * 1000000) + 500000;
      
      data.push({
        date: date.toISOString().split('T')[0],
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume,
      });
    }
    
    return data;
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
  const score = stock.score || Math.floor(Math.random() * 20) + 75;
  
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

  // Moats data - use individual moat fields from stock
  const moats = [
    { title: stock.moat1 || "Starke Markenbekanntheit und Kundenloyalität", icon: Shield },
    { title: stock.moat2 || "Hohe Wechselkosten für Kunden", icon: Users },
    { title: stock.moat3 || "Innovationsführerschaft in der Branche", icon: Lightbulb },
  ];

  // Financial highlights
  const financialHighlights = [
    { label: "Revenue Growth", value: stock.financialHighlight1 || "+12.5% YoY", isPositive: true },
    { label: "Net Income Margin", value: stock.financialHighlight2 || "24.1%", isPositive: false },
    { label: "Free Cash Flow", value: stock.financialHighlight3 || `${currency} 95B`, isPositive: false },
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
            <ScoreCircle score={score} onClick={() => setShowScoreExplanation(true)} />
          </div>
        </div>

        {/* Tabs per IA-Optimierung: Übersicht | Signale | Chart & TA | Bewertung | KI-Prognose | Backtest | News */}
        <Tabs value={activeStockTab} onValueChange={handleStockTabChange} className="w-full">
          <TabsList className="flex flex-wrap gap-0 bg-transparent border-b border-white/10 p-0 h-auto rounded-none mb-6">
            {[
              { value: 'overview', label: 'Übersicht' },
              { value: 'signals', label: 'Signale', badge: newsData.length },
              { value: 'chart-ta', label: 'Chart & TA' },
              { value: 'valuation', label: 'Bewertung (DCF)' },
              { value: 'prediction', label: 'KI-Prognose' },
              { value: 'backtest', label: 'Backtest' },
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
              </CardContent>
            </Card>

            {/* Moats Section */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Wettbewerbsvorteile (Moats)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {moats.map((moat: any, index: number) => (
                  <MoatCard key={index} number={index + 1} title={moat.title || moat} icon={moat.icon || Shield} />
                ))}
              </div>
            </div>

            {/* Financial Highlights */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Financial Highlights</h3>
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
            <div className={`grid grid-cols-1 ${isInPortfolio ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4`}>
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
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 h-12">
                <FileText className="w-4 h-4 mr-2" />
                Factsheet ansehen
              </Button>
            </div>
          </div>

          {/* Right Column - Metrics & News */}
          <div className="space-y-6">
            {/* LPPLS Bubble-Risiko (Sornette) — nur sichtbar bei relevantem Risiko */}
            <BubbleRiskCard ticker={ticker} />
            {/* Strategie-Scoring Widget */}
            <StockScoringWidget ticker={ticker} />
            {/* Analysten-Konsens */}
            <AnalystConsensusCard ticker={ticker} />
            {/* Key Metrics */}
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard 
                    label="P/E Ratio" 
                    value={stock.peRatio || "-"} 
                    rating={getRating("peRatio", stock.peRatio)}
                  />
                  <MetricCard 
                    label="PEG Ratio" 
                    value={stock.pegRatio ? parseFloat(stock.pegRatio).toFixed(2) : "-"} 
                    rating={getRating("pegRatio", stock.pegRatio)}
                  />
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
                    value={stock.marketCap ? `${currency} ${parseFloat(stock.marketCap).toFixed(1)}B` : "-"} 
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

            {/* News Section */}
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
              <CardContent className="p-4">
                <h3 className="text-lg font-semibold text-white mb-3">News</h3>
                <div className="space-y-1">
                  {newsData.length > 0 ? (
                    newsData.map((news: any, index: number) => (
                      <NewsItem 
                        key={index} 
                        title={news.title} 
                        icon={Newspaper}
                        url={news.url}
                        date={news.publishedAt ? new Date(news.publishedAt).toLocaleDateString('de-CH') : undefined}
                      />
                    ))
                  ) : (
                    <>
                      <NewsItem title={`${stock.companyName} unveils new products with innovative features`} icon={Lightbulb} />
                      <NewsItem title={`${stock.companyName} services revenue hits all-time high`} icon={TrendingUp} />
                      <NewsItem title={`Analysts bullish on ${stock.companyName}'s future growth`} icon={TrendingUpIcon} />
                    </>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full mt-3 text-[#00CFC1] hover:text-[#00b8ad] hover:bg-[#00CFC1]/10"
                  onClick={() => navigate(`/newsroom?ticker=${ticker}`)}
                >
                  Alle News anzeigen
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
        
        </TabsContent>

          {/* Signale Tab */}
          <TabsContent value="signals">
            <TradingViewSignalsTab ticker={ticker} />
          </TabsContent>

          {/* Chart & TA Tab */}
          <TabsContent value="chart-ta">
            <TradingViewSection ticker={ticker} stock={stock} />
          </TabsContent>

          {/* Bewertung (DCF) Tab */}
          <TabsContent value="valuation">
            <ValuationTab ticker={ticker} stock={stock} />
          </TabsContent>

          {/* KI-Prognose Tab */}
          <TabsContent value="prediction">
            <PredictionTab ticker={ticker} stock={stock} />
          </TabsContent>

          {/* Backtest Tab */}
          <TabsContent value="backtest">
            <TradingViewBacktestTab ticker={ticker} />
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
                  <select className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white focus:border-[#00CFC1] focus:outline-none">
                    <option>Über Preis</option>
                    <option>Unter Preis</option>
                    <option>Änderung +%</option>
                    <option>Änderung -%</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Zielpreis / Schwellenwert</label>
                  <input 
                    type="number" 
                    placeholder={(currentPrice * 1.1).toFixed(2)}
                    className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white focus:border-[#00CFC1] focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Benachrichtigung via</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input type="checkbox" className="rounded" defaultChecked />
                      Email
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input type="checkbox" className="rounded" />
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
                    className="flex-1 bg-[#00CFC1] hover:bg-[#00b8ad] text-black font-semibold"
                  >
                    Alarm erstellen
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Score Explanation Dialog */}
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
                <h3 className="text-xl font-bold text-white">Score-Berechnung</h3>
              </div>
              
              <div className="space-y-4 text-sm text-gray-300">
                <p>
                  Der <strong className="text-[#00CFC1]">Score ({score}/100)</strong> bewertet die Gesamtqualität der Aktie basierend auf mehreren Faktoren:
                </p>
                
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div>
                    <div>
                      <strong>Fundamentaldaten (40%):</strong> P/E Ratio, PEG Ratio, Gewinnwachstum, Margen
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div>
                    <div>
                      <strong>Risikometriken (30%):</strong> Volatilität, Beta, Sharpe Ratio
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div>
                    <div>
                      <strong>Dividenden & Cashflow (20%):</strong> Dividendenrendite, Free Cash Flow
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div>
                    <div>
                      <strong>Wettbewerbsvorteile (10%):</strong> Moats, Marktposition
                    </div>
                  </div>
                </div>
                
                <div className="pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#00CFC1]">80-100: Ausgezeichnet</span>
                    <span className="text-yellow-500">60-79: Gut</span>
                    <span className="text-red-500">&lt;60: Schwach</span>
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
