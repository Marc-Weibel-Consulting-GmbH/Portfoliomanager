import { useState, useMemo, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend as RechartsLegend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Edit,
  Trash2,
  Share2,
  DollarSign,
  Scale,
  PieChart,
  Bell,
  Play,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { PortfolioEditModal } from "@/components/PortfolioEditModal";
import { PortfolioSettingsModal } from "@/components/PortfolioSettingsModal";
import { EditPositionModal } from "@/components/EditPositionModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RealizedGainsTable } from "@/components/RealizedGainsTable";
import { CostFeesReport } from "@/components/CostFeesReport";
import RiskTab from "@/components/portfolio/RiskTab";
import OptimierenTab from "@/components/portfolio/OptimierenTab";
import { StockLogo } from "@/components/StockLogo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const portfolioTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  dividends: { label: "Dividenden", icon: <DollarSign className="h-4 w-4" />, color: "bg-blue-500" },
  growth: { label: "Wachstum", icon: <TrendingUp className="h-4 w-4" />, color: "bg-green-500" },
  balanced: { label: "Balanced", icon: <Scale className="h-4 w-4" />, color: "bg-purple-500" },
  etf: { label: "ETF", icon: <PieChart className="h-4 w-4" />, color: "bg-orange-500" },
};

const formatDate = (date: Date | string) => {
  const d = new Date(date);
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const formatCurrency = (value: number, currency: string = 'CHF') => {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export default function PortfolioDetailsPage() {
  const params = useParams<{ id: string }>();
  const [location, navigate] = useLocation();
  const portfolioId = params.id ? parseInt(params.id) : 0;
  
  // URL-based tab persistence: ?tab=positionen etc. (German keys per Mockup S.01-06)
  const legacyTabMap: Record<string, string> = {
    overview: 'uebersicht', positions: 'positionen', transactions: 'transaktionen',
    risk: 'risiko', optimize: 'optimieren', ai: 'optimieren',
  };
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const rawTab = searchParams.get('tab') || 'uebersicht';
  const urlTab = legacyTabMap[rawTab] || rawTab;
  const [activeTab, setActiveTab] = useState(urlTab);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const newSearch = tab === 'uebersicht' ? '' : `?tab=${tab}`;
    navigate(`/portfolios/${portfolioId}${newSearch}`, { replace: true });
  };

  // Erfolgs-Toast nach dem Portfolio-Builder (redirect mit ?onboarding=success)
  useEffect(() => {
    if (searchParams.get('onboarding') === 'success') {
      toast.success('Portfolio erstellt 🎉');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // State for transactions filter
  const [txFilter, setTxFilter] = useState<string>('alle');
  
  // State for edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<any>(null);
  const [isEditPositionModalOpen, setIsEditPositionModalOpen] = useState(false);
  
  // State for share
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  
  // State for activation modal (Demo -> Live)
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
  const [startCapital, setStartCapital] = useState("");
  const [selectedActivationBenchmark, setSelectedActivationBenchmark] = useState<"SMI" | "SP500" | "MSCI_WORLD">("SMI");
  
  // Fetch transactions for edit modal
  const { data: transactions = [] } = trpc.portfolioTransactions.list.useQuery(
    { portfolioId },
    { enabled: portfolioId > 0 }
  );
  
  // Fetch realized gains
  const { data: realizedGains = [] } = trpc.realizedGainsHistory.getAll.useQuery(
    { portfolioId },
    { enabled: portfolioId > 0 }
  );
  
  const handleEditPosition = (holding: any) => {
    setEditingPosition({
      ticker: holding.ticker,
      name: holding.companyName,
      shares: holding.shares || 0,
      avgBuyPrice: holding.currentPriceLocal,
      currency: holding.currency,
      totalInvestedCHF: holding.valueCHF
    });
    setIsEditPositionModalOpen(true);
  };
  
  // Fetch portfolio data with currency information
  const { data: portfolio, isLoading, refetch } = trpc.portfolios.getWithCurrency.useQuery(
    portfolioId,
    {
      enabled: portfolioId > 0,
      refetchOnMount: true, // Always fetch fresh data on mount
      refetchOnWindowFocus: true, // Refetch when window regains focus
    }
  );
  const { data: allPortfolios } = trpc.portfolios.list.useQuery();
  const deletePortfolio = trpc.portfolios.delete.useMutation();
  const utils = trpc.useUtils();
  
  // Activate portfolio mutation (Demo -> Live)
  const activatePortfolio = trpc.portfolioManagement.activatePortfolio.useMutation({
    onSuccess: (data) => {
      toast.success(`Portfolio aktiviert! ${data.transactionsCreated} Transaktionen erstellt.`);
      setIsActivationModalOpen(false);
      setStartCapital("");
      utils.portfolios.getWithCurrency.invalidate(portfolioId);
      utils.portfolios.list.invalidate();
      refetch();
    },
    onError: (error) => {
      toast.error(`Fehler beim Aktivieren: ${error.message}`);
    },
  });
  
  const [selectedPeriod, setSelectedPeriod] = useState("YTD");
  const [selectedBenchmark, setSelectedBenchmark] = useState("SPY");
  
  const benchmarkOptions = [
    { value: "SPY", label: "S&P 500" },
    { value: "QQQ", label: "Nasdaq 100" },
    { value: "SSMI.SW", label: "SMI" },
    { value: "FEZ", label: "EuroStoxx 50" },
  ];
  
  // Use enriched stocks from the API (must be before conditional returns)
  const holdings = portfolio?.enrichedStocks || [];
  
  // Calculate sector allocation
  const sectorWeights: Record<string, number> = useMemo(() => {
    const weights: Record<string, number> = {};
    holdings.forEach((h: any) => {
      const sector = h.sector || 'Other';
      weights[sector] = (weights[sector] || 0) + (h.weight || 0);
    });
    return weights;
  }, [holdings]);
  
  // Calculate total portfolio value based on initial capital and weights
  // Backend already includes cash balance in totalValueCHF
  const cashBalance = parseFloat(portfolio?.cashBalance || "0");
  const totalValueCHF = Number(portfolio?.totalValueCHF) || 0;
  const avgDividendYield = portfolio?.avgDividendYield || 0;
  
  // Determine creation date for visual separation in chart
  const creationDate = useMemo(() => {
    if (!portfolio?.liveStartDate) return null;
    if (typeof portfolio.liveStartDate === 'string') {
      return portfolio.liveStartDate.split('T')[0];
    }
    return new Date(portfolio.liveStartDate).toISOString().split('T')[0];
  }, [portfolio?.liveStartDate]);
  
  // Map period labels to getPerformanceMetrics range values
  const perfRange = useMemo(() => {
    const map: Record<string, '1M' | '3M' | '6M' | 'YTD' | '1J' | '3J' | '5J' | 'Max'> = {
      '1M': '1M', '3M': '3M', '6M': '6M', 'YTD': 'YTD',
      '1Y': '1J', '3Y': '3J', '5Y': '5J', 'All': 'Max',
    };
    return map[selectedPeriod] || 'YTD';
  }, [selectedPeriod]);

  // TTWROR + IRR metrics from the new performance engine
  const { data: perfMetrics, isLoading: isLoadingPerfMetrics } = trpc.portfolios.getPerformanceMetrics.useQuery(
    { portfolioId, range: perfRange },
    { enabled: portfolioId > 0 && !!portfolio?.isLive }
  );

  // Risk metrics (real Sharpe ratio + benchmark Sharpe) scoped to this portfolio
  const { data: riskMetrics } = trpc.dashboard.getRiskMetrics.useQuery(
    { scope: portfolioId },
    { enabled: portfolioId > 0 }
  );

  // Fetch historical performance data from API
  const { data: historicalData, isLoading: isLoadingHistory } = trpc.portfolios.getHistoricalPerformance.useQuery(
    { 
      portfolioId, 
      period: selectedPeriod as '1M' | '3M' | '6M' | '1Y' | 'YTD' | '3Y' | '5Y' | 'All',
      debug: true, // Enable debug payload
      benchmark: selectedBenchmark,
    },
    { enabled: portfolioId > 0 }
  );
  
  // Process chart data - SIMPLIFIED (12.01.2026): No hypothetical line, only Portfolio and Benchmark
  const chartData = useMemo(() => {
    if (!historicalData?.chartData || historicalData.chartData.length === 0) {
      return { data: [], creationDateIndex: -1, hasHypothetical: false };
    }
    
    const realData = historicalData.chartData;
    
    // Sample data to show roughly one point per week for better visualization
    const sampleInterval = Math.max(1, Math.floor(realData.length / 52));
    const sampledData = realData.filter((_: any, index: number) => index % sampleInterval === 0 || index === realData.length - 1);
    
    // Format dates - all data is now "real" (no hypothetical distinction)
    const formattedData = sampledData.map((d: any) => ({
      date: new Date(d.date).toLocaleDateString('de-CH', { day: '2-digit', month: 'short', year: '2-digit' }),
      portfolio: d.portfolio,
      hypothetical: null, // No hypothetical data anymore
      benchmark: d.benchmark,
    }));
    
    return { 
      data: formattedData, 
      creationDateIndex: -1,
      hasHypothetical: false // No hypothetical data anymore
    };
  }, [historicalData]);
  
  // Prepare pie chart data for asset allocation
  const assetAllocationData = useMemo(() => {
    // Group by category/type
    const categories: Record<string, number> = {};
    holdings.forEach((h: any) => {
      const category = h.category || 'Aktien';
      const weight = parseFloat(h.weight || '0');
      categories[category] = (categories[category] || 0) + weight;
    });
    
    // Add cash position if exists
    if (portfolio?.cashBalance && parseFloat(portfolio.cashBalance) > 0 && totalValueCHF > 0) {
      const cashWeight = (parseFloat(portfolio.cashBalance) / totalValueCHF) * 100;
      categories['Cash'] = parseFloat(cashWeight.toFixed(2));
    }
    
    return Object.entries(categories).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
    }));
  }, [holdings, portfolio?.cashBalance, totalValueCHF]);
  
  // Prepare pie chart data for sector allocation  
  const sectorAllocationData = useMemo(() => {
    return Object.entries(sectorWeights).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
    }));
  }, [sectorWeights]);
  
  // Colors for pie charts
  const COLORS = ['#00CFC1', '#00A89D', '#007D74', '#00524C', '#003D38', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];
  
  // Prepare stocks for edit modal
  const stocksForEdit = useMemo(() => {
    return holdings.map((h: any) => ({
      ticker: h.ticker,
      companyName: h.companyName,
      weight: parseFloat(h.weight || '0'),
      currentPrice: h.currentPriceLocal || h.currentPriceCHF || 0,
      currency: h.currency || 'CHF'
    }));
  }, [holdings]);
  
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-lg text-muted-foreground">Portfolio wird geladen...</div>
        </div>
      </DashboardLayout>
    );
  }
  
  if (!portfolio) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <div className="text-lg text-muted-foreground">Portfolio nicht gefunden</div>
          <Button onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zum Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }
  
  const typeConfig = portfolio.portfolioType ? portfolioTypeConfig[portfolio.portfolioType] : null;
  
  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    try {
      await deletePortfolio.mutateAsync({ id: portfolioId });
      toast.success("Portfolio gelöscht");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Löschen");
    }
    setIsDeleteDialogOpen(false);
  };
  
  const handlePortfolioSwitch = (newId: string) => {
    navigate(`/portfolios/${newId}`);
  };
  
  const handleEditSuccess = () => {
    // Invalidate and refetch data
    utils.portfolios.list.invalidate();
    utils.portfolios.getWithCurrency.invalidate(portfolioId);
    utils.portfolios.getHistoricalPerformance.invalidate({ portfolioId });
    refetch();
  };
  
  // Handle portfolio activation (Demo -> Live)
  const handleActivatePortfolio = () => {
    if (!portfolioId || !startCapital) {
      toast.error("Bitte Startkapital eingeben");
      return;
    }

    activatePortfolio.mutate({
      portfolioId,
      startCapital,
      benchmark: selectedActivationBenchmark,
    });
  };
  
  // Check if portfolio is in demo mode (not live)
  const isDemo = portfolio.isLive !== 1;
  
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header — matches design PDF: breadcrumb + title + subtitle + action buttons */}
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <button onClick={() => navigate('/portfolios')} className="hover:text-[#00CFC1] transition-colors">Portfolios</button>
            <span>›</span>
            <span className="text-gray-300">{portfolio.name}</span>
            {portfolio.isLive === 1 && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0 h-4">
                <span className="relative flex h-1.5 w-1.5 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400"></span>
                </span>
                LIVE
              </Badge>
            )}
          </div>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">{portfolio.name}</h1>
              <p className="text-sm text-gray-400 mt-1">
                {typeConfig?.label || 'Portfolio'} · {holdings.length} Positionen
                {portfolio.createdAt && ` · seit ${new Date(portfolio.createdAt).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {isDemo && (
                <Button
                  size="sm"
                  onClick={() => setIsActivationModalOpen(true)}
                  className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Aktivieren
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)}>
                + Position
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsSettingsModalOpen(true)}>
                <Edit className="h-4 w-4 mr-1" />
                Bearbeiten
              </Button>
              <Button size="sm" onClick={() => handleTabChange('optimieren')} className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black">
                Optimieren
              </Button>
            </div>
          </div>
        </div>

        {/* Portfolio Switcher — compact */}
        {allPortfolios && allPortfolios.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Portfolio wechseln:</span>
            <Select value={portfolioId.toString()} onValueChange={handlePortfolioSwitch}>
              <SelectTrigger className="w-48 h-7 text-xs bg-[#1a1f2e] border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1f2e] border-white/10">
                {allPortfolios.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span>{p.name}</span>
                      {p.isLive === 1 && (
                        <Badge variant="default" className="bg-green-500 text-white text-[9px] px-1 py-0">Live</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* KPI Row — matches design PDF: WERT | YTD | GESAMT | SHARPE — flat style, no teal top border */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border border-white/10 rounded-lg overflow-hidden">
          {/* WERT */}
          <div className="bg-[#0f1420] p-5 border-r border-white/10">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">WERT</p>
            <p className="text-2xl font-bold font-mono text-white">
              CHF {new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(totalValueCHF)}
            </p>
            {portfolio?.investmentAmount && (
              <p className="text-xs text-gray-500 mt-1">Cost CHF {new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(Number(portfolio.investmentAmount))}</p>
            )}
          </div>

          {/* YTD */}
          <div className="bg-[#0f1420] p-5 border-r border-white/10">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">YTD</p>
            {(() => {
              const lastPoint = chartData.data.length > 0 ? chartData.data[chartData.data.length - 1] : null;
              const ytdPerf = lastPoint?.portfolio || 0;
              const benchPerf = lastPoint?.benchmark ?? null;
              const benchmarkLabel = benchmarkOptions.find(b => b.value === selectedBenchmark)?.label || 'Benchmark';
              return (
                <>
                  <p className={`text-2xl font-bold font-mono ${ytdPerf >= 0 ? 'text-[#00CFC1]' : 'text-red-400'}`}>
                    {ytdPerf >= 0 ? '+' : ''}{ytdPerf.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {benchmarkLabel} {benchPerf !== null ? `${benchPerf >= 0 ? '+' : ''}${benchPerf.toFixed(1)}%` : '—'}
                  </p>
                </>
              );
            })()}
          </div>

          {/* GESAMT */}
          <div className="bg-[#0f1420] p-5 border-r border-white/10">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">GESAMT</p>
            {(() => {
              const invested = Number(portfolio?.investmentAmount || 0);
              const gain = totalValueCHF - invested;
              const pct = invested > 0 ? (gain / invested) * 100 : 0;
              return (
                <>
                  <p className={`text-2xl font-bold font-mono ${pct >= 0 ? 'text-[#00CFC1]' : 'text-red-400'}`}>
                    {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                  </p>
                  <p className={`text-xs mt-1 ${gain >= 0 ? 'text-gray-500' : 'text-red-400'}`}>
                    G/V CHF {new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(Math.abs(gain))}
                  </p>
                </>
              );
            })()}
          </div>

          {/* SHARPE */}
          <div className="bg-[#0f1420] p-5">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">SHARPE</p>
            <p className="text-2xl font-bold font-mono text-white">
              {riskMetrics?.sharpeRatio !== undefined ? riskMetrics.sharpeRatio.toFixed(2) : '—'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Bench {riskMetrics?.sharpeBenchmark !== undefined ? riskMetrics.sharpeBenchmark.toFixed(2) : '—'}
            </p>
          </div>
        </div>

        {/* Tabs Section — matches design PDF, with URL persistence */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="flex flex-wrap gap-0 bg-transparent border-b border-white/10 p-0 h-auto rounded-none">
            {[
              { value: 'uebersicht', label: 'Übersicht' },
              { value: 'positionen', label: `Positionen`, badge: holdings.length },
              { value: 'transaktionen', label: 'Transaktionen', badge: transactions.length },
              { value: 'performance', label: 'Performance' },
              { value: 'risiko', label: 'Risiko' },
              { value: 'optimieren', label: 'Optimieren', aiBadge: true },
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
                {tab.aiBadge && (
                  <span className="bg-[#00CFC1]/20 text-[#00CFC1] text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider">AI</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* OVERVIEW TAB — 2 columns: chart left, top-positions + activity right */}
          <TabsContent value="uebersicht" className="mt-6">
            <div className="grid lg:grid-cols-5 gap-6">
              {/* Left: Wertentwicklung Chart */}
              <div className="lg:col-span-3">
                <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Wertentwicklung seit Erstauf</h3>
                    </div>
                    <div className="flex gap-1">
                      {['1M', 'YTD', '1J', 'Max'].map(p => (
                        <button
                          key={p}
                          onClick={() => setSelectedPeriod(p === '1J' ? '1Y' : p === 'Max' ? 'All' : p)}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            (selectedPeriod === p || (p === '1J' && selectedPeriod === '1Y') || (p === 'Max' && selectedPeriod === 'All'))
                              ? 'bg-[#00CFC1]/20 text-[#00CFC1] font-medium'
                              : 'text-gray-500 hover:text-gray-300'
                          }`}
                        >{p}</button>
                      ))}
                    </div>
                  </div>
                  <div className="h-56">
                    {isLoadingHistory ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="w-5 h-5 border-2 border-[#00CFC1] border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : chartData.data.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500 text-sm">Keine historischen Daten verfügbar</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData.data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="overviewGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00CFC1" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#00CFC1" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" vertical={false} />
                          <XAxis dataKey="date" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#444" fontSize={10} tickFormatter={(v) => `${v.toFixed(0)}%`} tickLine={false} axisLine={false} width={40} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #00CFC1', borderRadius: '6px', fontSize: '12px' }}
                            labelStyle={{ color: '#fff' }}
                            formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name === 'portfolio' ? portfolio.name : 'Benchmark']}
                          />
                          <Area type="monotone" dataKey="portfolio" stroke="#00CFC1" strokeWidth={2} fill="url(#overviewGradient)" />
                          <Area type="monotone" dataKey="benchmark" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Top-Positionen + Letzte Aktivität */}
              <div className="lg:col-span-2 space-y-4">
                {/* Top-Positionen */}
                <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Top-Positionen nach Gewicht</h3>
                  <div className="space-y-2">
                    {holdings
                      .slice()
                      .sort((a: any, b: any) => parseFloat(b.weight || '0') - parseFloat(a.weight || '0'))
                      .slice(0, 5)
                      .map((h: any) => (
                        <div key={h.ticker} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[#00CFC1] text-xs w-16">{h.ticker}</span>
                            <span className="text-gray-400 text-xs truncate max-w-[100px]">{h.companyName}</span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-gray-300 text-xs">{parseFloat(h.weight || '0').toFixed(1)}%</span>
                            <span className={`text-xs font-mono ${parseFloat(h.ytdPerformance || '0') >= 0 ? 'text-[#00CFC1]' : 'text-red-400'}`}>
                              {parseFloat(h.ytdPerformance || '0') >= 0 ? '+' : ''}{parseFloat(h.ytdPerformance || '0').toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Letzte Aktivität */}
                <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Letzte Aktivität</h3>
                  <div className="space-y-2">
                    {transactions.slice(0, 4).map((tx: any) => {
                      const txDate = new Date(tx.transactionDate);
                      const isToday = txDate.toDateString() === new Date().toDateString();
                      const isYesterday = txDate.toDateString() === new Date(Date.now() - 86400000).toDateString();
                      const dateLabel = isToday ? 'Heute' : isYesterday ? 'Gestern' : txDate.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
                      const isBuy = tx.transactionType === 'buy';
                      const isDividend = tx.transactionType === 'dividend';
                      return (
                        <div key={tx.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 w-12">{dateLabel}</span>
                            <span className={`${isDividend ? 'text-[#00CFC1]' : isBuy ? 'text-blue-400' : 'text-red-400'}`}>
                              {isDividend ? 'Dividende' : isBuy ? 'Kauf' : 'Verkauf'} {tx.ticker}
                            </span>
                          </div>
                          <span className={`font-mono ${isDividend || isBuy ? 'text-[#00CFC1]' : 'text-red-400'}`}>
                            {isDividend || isBuy ? '+' : '-'}{tx.shares ? `${Math.abs(parseFloat(tx.shares)).toFixed(0)} Stk.` : `CHF ${Math.abs(parseFloat(tx.totalAmount || '0')).toFixed(0)}`}
                          </span>
                        </div>
                      );
                    })}
                    {transactions.length === 0 && (
                      <p className="text-xs text-gray-500">Keine Transaktionen vorhanden</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* POSITIONS TAB — matches design: TICKER | NAME | SEKTOR | GEWICHT | WERT | HEUTE | YTD */}
          <TabsContent value="positionen" className="mt-6">
            <div className="bg-[#0f1420] border border-white/10 rounded-lg">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div>
                  <h3 className="text-sm font-semibold text-white">{holdings.length} Positionen</h3>
                  <p className="text-xs text-gray-500">sortiert nach Gewicht</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-white/5 rounded-md p-1">
                    <button className="px-2.5 py-1 text-xs rounded bg-white/10 text-white font-medium">Tabelle</button>
                    <button className="px-2.5 py-1 text-xs rounded text-gray-400 hover:text-white">Heatmap</button>
                    <button className="px-2.5 py-1 text-xs rounded text-gray-400 hover:text-white">Konstellation</button>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)} className="border-white/20 text-white hover:bg-white/5 text-xs h-8 gap-1">
                    + Position
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Ticker</th>
                      <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Sektor</th>
                      <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Gewicht</th>
                      <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Wert</th>
                      <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Heute</th>
                      <th className="text-right px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">YTD</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings
                      .slice()
                      .sort((a: any, b: any) => parseFloat(b.weight || '0') - parseFloat(a.weight || '0'))
                      .map((h: any) => {
                        const ytd = parseFloat(h.ytdPerformance || '0');
                        const today = parseFloat(h.dailyChangePercent || h.changePercent || '0');
                        const weight = parseFloat(h.weight || '0');
                        const value = (h.shares || 0) * (h.currentPriceCHF || 0);
                        return (
                          <tr key={h.ticker} className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer" onClick={() => navigate(`/aktien/${h.ticker}?from=${portfolioId}`)}>  
                            <td className="px-5 py-3.5">
                              <span className="font-mono text-xs font-semibold text-gray-300 tracking-wide">{h.ticker}</span>
                            </td>
                            <td className="px-3 py-3.5 text-sm text-white">{h.companyName}</td>
                            <td className="px-3 py-3.5">
                              <span className="text-xs text-[#00CFC1]/80">{h.sector || '—'}</span>
                            </td>
                            <td className="px-3 py-3.5 text-right text-sm text-gray-300">{weight.toFixed(1)}%</td>
                            <td className="px-3 py-3.5 text-right">
                              <span className="text-sm text-white">CHF {new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(value)}</span>
                            </td>
                            <td className="px-3 py-3.5 text-right">
                              <span className={`text-sm font-mono ${today >= 0 ? 'text-[#00CFC1]' : 'text-red-400'}`}>
                                {today >= 0 ? '+' : ''}{today.toFixed(2)}%
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <span className={`text-sm font-mono ${ytd >= 0 ? 'text-[#00CFC1]' : 'text-red-400'}`}>
                                {ytd >= 0 ? '+' : ''}{ytd.toFixed(1)}%
                              </span>
                            </td>
                            <td className="pr-4 text-right">
                              <span className="text-gray-600 text-xs">↗</span>
                            </td>
                          </tr>
                        );
                      })}
                    {portfolio?.cashBalance && parseFloat(portfolio.cashBalance) > 0 && (
                      <tr className="border-b border-white/5">
                        <td className="px-5 py-3.5"><span className="font-mono text-xs text-gray-500">CASH</span></td>
                        <td className="px-3 py-3.5 text-sm text-gray-400">Cash (CHF)</td>
                        <td className="px-3 py-3.5"><span className="text-xs text-gray-600">—</span></td>
                        <td className="px-3 py-3.5 text-right text-sm text-gray-400">{((parseFloat(portfolio.cashBalance) / totalValueCHF) * 100).toFixed(1)}%</td>
                        <td className="px-3 py-3.5 text-right text-sm text-white">CHF {new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(parseFloat(portfolio.cashBalance))}</td>
                        <td className="px-3 py-3.5 text-right text-gray-500 text-sm">—</td>
                        <td className="px-5 py-3.5 text-right text-gray-500 text-sm">—</td>
                        <td></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* TRANSACTIONS TAB — matches design: 4 KPIs + filter chips + table */}
          <TabsContent value="transaktionen" className="mt-6">
            {(() => {
              const buys = transactions.filter((t: any) => (t.type || t.transactionType) === 'BUY' || (t.type || t.transactionType) === 'buy');
              const sells = transactions.filter((t: any) => (t.type || t.transactionType) === 'SELL' || (t.type || t.transactionType) === 'sell');
              const dividends = transactions.filter((t: any) => (t.type || t.transactionType) === 'dividend');
              // Volumen in CHF (totalAmountCHF ist der vom Server umgerechnete Betrag; Fallback shares*price)
              const volCHF = (t: any) => parseFloat(t.totalAmountCHF ?? '') || (parseFloat(t.shares || t.quantity || 0) * parseFloat(t.price || t.pricePerShare || 0));
              const buyVolume = buys.reduce((s: number, t: any) => s + volCHF(t), 0);
              const sellVolume = sells.reduce((s: number, t: any) => s + volCHF(t), 0);
              const divTotal = dividends.reduce((s: number, t: any) => s + volCHF(t), 0);
              const realizedTotal = realizedGains.reduce((s: number, g: any) => s + (g.netProfit ?? g.totalGain ?? 0), 0);
              return (
                <>
                  {/* 4 KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border border-white/10 rounded-lg overflow-hidden mb-6">
                    <div className="bg-[#0f1420] p-4 border-r border-white/10">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">KÄUFE</p>
                      <p className="text-xl font-bold font-mono text-emerald-400">{buys.length}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Vol. CHF {new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(buyVolume)}</p>
                    </div>
                    <div className="bg-[#0f1420] p-4 border-r border-white/10">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">VERKÄUFE</p>
                      <p className="text-xl font-bold font-mono text-red-400">{sells.length}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Vol. CHF {new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(sellVolume)}</p>
                    </div>
                    <div className="bg-[#0f1420] p-4 border-r border-white/10">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">DIVIDENDEN</p>
                      <p className="text-xl font-bold font-mono text-[#00CFC1]">{dividends.length}</p>
                      <p className="text-xs text-gray-500 mt-0.5">CHF {new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(divTotal)}</p>
                    </div>
                    <div className="bg-[#0f1420] p-4">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">REAL. G/V</p>
                      <p className={`text-xl font-bold font-mono ${realizedTotal >= 0 ? 'text-[#00CFC1]' : 'text-red-400'}`}>
                        {realizedTotal >= 0 ? '+' : ''}CHF {new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(Math.abs(realizedTotal))}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{realizedGains.length} Positionen</p>
                    </div>
                  </div>

                  {/* Filter Chips + Table */}
                  {(() => {
                    const isRealized = txFilter === 'realisierte';
                    const filteredTx = txFilter === 'alle' ? transactions :
                      txFilter === 'kaeufe' ? buys :
                      txFilter === 'verkaeufe' ? sells :
                      txFilter === 'dividenden' ? dividends : transactions;

                    // CSV-Export der aktuell sichtbaren Ansicht
                    const handleExport = () => {
                      const csvEscape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
                      let rows: string[][];
                      if (isRealized) {
                        rows = [["Datum", "Ticker", "Name", "Stk.", "Kaufpreis", "Verkaufspreis", "Netto G/V", "Rendite %"]];
                        realizedGains.forEach((g: any) => rows.push([
                          new Date(g.transactionDate).toLocaleDateString('de-CH'), g.ticker, g.stockName,
                          g.shares, g.avgCostBasis, g.sellPrice, g.netProfit ?? g.totalGain ?? 0, g.realizedGainPercent ?? 0,
                        ]));
                      } else {
                        rows = [["Datum", "Typ", "Ticker", "Stk.", "Preis", "Waehrung", "Total CHF"]];
                        filteredTx.forEach((t: any) => rows.push([
                          new Date(t.date || t.transactionDate).toLocaleDateString('de-CH'),
                          (t.type || t.transactionType), t.ticker, t.shares || t.quantity,
                          t.price || t.pricePerShare, t.currency || 'CHF', volCHF(t).toFixed(2),
                        ]));
                      }
                      const csv = rows.map(r => r.map(csvEscape).join(';')).join('\n');
                      const blob = new Blob(["﻿" + csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${portfolio.name.replace(/[^a-z0-9]/gi, '_')}_${isRealized ? 'realisierte_gewinne' : 'transaktionen'}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success('Export erstellt');
                    };

                    return (
                      <div className="bg-[#0f1420] border border-white/10 rounded-lg">
                        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10">
                          {[['alle', 'Alle'], ['kaeufe', 'Käufe'], ['verkaeufe', 'Verkäufe'], ['dividenden', 'Dividenden'], ['realisierte', 'Realisierte Gewinne']].map(([key, label]) => (
                            <button
                              key={key}
                              onClick={() => setTxFilter(key)}
                              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                                txFilter === key ? 'bg-[#00CFC1]/20 text-[#00CFC1] font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'
                              }`}
                            >{label}</button>
                          ))}
                          <span className="ml-auto text-xs text-gray-500">{isRealized ? realizedGains.length : filteredTx.length} Einträge</span>
                          <button
                            onClick={handleExport}
                            disabled={isRealized ? realizedGains.length === 0 : filteredTx.length === 0}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-white/15 text-gray-300 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Share2 className="h-3 w-3" /> Export
                          </button>
                        </div>
                        {isRealized ? (
                          realizedGains.length === 0 ? (
                            <p className="text-gray-400 text-center py-8 text-sm">Keine realisierten Gewinne vorhanden</p>
                          ) : (
                            <div className="p-4"><RealizedGainsTable gains={realizedGains} /></div>
                          )
                        ) : filteredTx.length === 0 ? (
                          <p className="text-gray-400 text-center py-8 text-sm">Keine Transaktionen vorhanden</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-white/10">
                                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Datum</th>
                                  <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Typ</th>
                                  <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Ticker</th>
                                  <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Stk.</th>
                                  <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Preis</th>
                                  <th className="text-right px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredTx.slice(0, 50).map((t: any) => {
                                  const txType = t.type || t.transactionType;
                                  const isBuy = txType === 'BUY' || txType === 'buy';
                                  const isSell = txType === 'SELL' || txType === 'sell';
                                  const isDiv = txType === 'dividend';
                                  return (
                                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                                      <td className="px-5 py-3 text-sm text-gray-400">{new Date(t.date || t.transactionDate).toLocaleDateString('de-CH')}</td>
                                      <td className="px-3 py-3">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                          isBuy ? 'bg-emerald-500/10 text-emerald-400' :
                                          isDiv ? 'bg-[#00CFC1]/10 text-[#00CFC1]' :
                                          'bg-red-500/10 text-red-400'
                                        }`}>
                                          {isBuy ? 'Kauf' : isSell ? 'Verkauf' : isDiv ? 'Dividende' : txType}
                                        </span>
                                      </td>
                                      <td className="px-3 py-3 text-sm font-mono font-semibold text-gray-300">{t.ticker}</td>
                                      <td className="px-3 py-3 text-right text-sm text-white">{t.shares || t.quantity || '—'}</td>
                                      <td className="px-3 py-3 text-right text-sm text-gray-300">{formatCurrency(t.price || t.pricePerShare || 0, t.currency || 'CHF')}</td>
                                      <td className="px-5 py-3 text-right text-sm text-white font-semibold">{formatCurrency((t.shares || t.quantity || 0) * (t.price || t.pricePerShare || 0), t.currency || 'CHF')}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </TabsContent>

          {/* PERFORMANCE TAB */}
          <TabsContent value="performance" className="mt-6">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">TTWROR (Zeitgewichtet)</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-mono text-white">{perfMetrics ? `${(perfMetrics.ttwror * 100).toFixed(2)}%` : '–'}</div>
                  <p className="text-xs text-gray-500 mt-1">True Time-Weighted Rate of Return</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">IRR (Geldgewichtet)</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-mono text-white">{perfMetrics ? `${(perfMetrics.irr * 100).toFixed(2)}%` : '–'}</div>
                  <p className="text-xs text-gray-500 mt-1">Internal Rate of Return p.a.</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">Absoluter Gewinn</CardTitle></CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold font-mono ${(perfMetrics?.absoluteGainCHF ?? 0) >= 0 ? 'text-[#00CFC1]' : 'text-red-400'}`}>
                    {perfMetrics ? formatCurrency(perfMetrics.absoluteGainCHF, 'CHF') : '–'}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Realisiert + Unrealisiert</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">Realisierte Gewinne</CardTitle></CardHeader>
                <CardContent>
                  {realizedGains.length > 0 ? <RealizedGainsTable gains={realizedGains} /> : <p className="text-gray-400 text-sm">Keine realisierten Gewinne</p>}
                </CardContent>
              </Card>
            </div>
            {transactions.length > 0 && (
              <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30 mt-4">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">Kosten & Gebühren</CardTitle></CardHeader>
                <CardContent><CostFeesReport transactions={transactions} portfolioId={portfolioId} /></CardContent>
              </Card>
            )}
          </TabsContent>

          {/* RISK TAB — echte Kennzahlen + LPPL-Bubble-Indikator (S.05) */}
          <TabsContent value="risiko" className="mt-6">
            <RiskTab portfolioId={portfolioId} />
          </TabsContent>

          {/* OPTIMIZE TAB — KI-Re-Allocation + Effizienzgrenze (S.06) */}
          <TabsContent value="optimieren" className="mt-6">
            <OptimierenTab portfolioId={portfolioId} holdings={holdings} />
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
          <CardHeader>
            <CardTitle className="text-white">Schnellaktionen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm">
                <Bell className="h-4 w-4 mr-2" />
                Alarm erstellen
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsEditModalOpen(true)}
                className="border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10"
              >
                <Edit className="h-4 w-4 mr-2" />
                Portfolio bearbeiten
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeleteClick}>
                <Trash2 className="h-4 w-4 mr-2" />
                Portfolio löschen
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Settings Modal */}
      <PortfolioSettingsModal
        open={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        portfolioId={portfolioId}
        initialName={portfolio.name}
        initialDescription={portfolio.description || undefined}
        initialInvestmentAmount={portfolio.investmentAmount}
        portfolioType={portfolio.portfolioType as 'demo' | 'live'}
        onSuccess={() => refetch()}
      />
      
      {/* Edit Modal */}
      <PortfolioEditModal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        portfolioId={portfolioId}
        portfolioName={portfolio.name}
        initialStocks={stocksForEdit}
        isLive={portfolio.isLive === 1}
        onSuccess={handleEditSuccess}
      />
      
      <EditPositionModal
        open={isEditPositionModalOpen}
        onClose={() => setIsEditPositionModalOpen(false)}
        portfolioId={portfolioId}
        position={editingPosition}
        transactions={transactions}
        onSuccess={() => {
          refetch();
          setIsEditPositionModalOpen(false);
        }}
      />
      
      {/* Activation Modal (Demo -> Live) */}
      <Dialog open={isActivationModalOpen} onOpenChange={setIsActivationModalOpen}>
        <DialogContent className="bg-[#1a1f2e] border-[#00CFC1]/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Portfolio aktivieren</DialogTitle>
            <DialogDescription className="text-gray-400">
              Geben Sie Ihr Startkapital ein, um das Portfolio zu aktivieren. Es werden automatisch
              Kauf-Transaktionen basierend auf den Gewichtungen erstellt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="startCapital" className="text-gray-300">Startkapital (CHF)</Label>
              <Input
                id="startCapital"
                type="number"
                placeholder="z.B. 10000"
                value={startCapital}
                onChange={(e) => setStartCapital(e.target.value)}
                className="bg-[#0f1420] border-white/10 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="benchmark" className="text-gray-300">Benchmark (optional)</Label>
              <Select value={selectedActivationBenchmark} onValueChange={(v: any) => setSelectedActivationBenchmark(v)}>
                <SelectTrigger className="bg-[#0f1420] border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1f2e] border-white/10">
                  <SelectItem value="SMI" className="text-white hover:bg-white/10">SMI</SelectItem>
                  <SelectItem value="SP500" className="text-white hover:bg-white/10">S&P 500</SelectItem>
                  <SelectItem value="MSCI_WORLD" className="text-white hover:bg-white/10">MSCI World</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActivationModalOpen(false)} className="border-white/10 text-gray-300 hover:bg-white/10">
              Abbrechen
            </Button>
            <Button 
              onClick={handleActivatePortfolio} 
              disabled={activatePortfolio.isPending}
              className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black"
            >
              {activatePortfolio.isPending ? "Aktiviere..." : "Aktivieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Share Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="bg-[#1a1f2e] border-[#00CFC1]/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Portfolio teilen</DialogTitle>
            <DialogDescription className="text-gray-400">
              Teilen Sie Ihr Portfolio mit anderen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Portfolio-Link</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/portfolios/${portfolioId}`}
                  className="bg-[#0f1420] border-white/10 text-white text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#00CFC1]/30 text-[#00CFC1] hover:bg-[#00CFC1]/10 whitespace-nowrap"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/portfolios/${portfolioId}`);
                    toast.success('Link kopiert!');
                    setIsShareDialogOpen(false);
                  }}
                >
                  Kopieren
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Portfolio-Zusammenfassung</Label>
              <div className="bg-[#0f1420] border border-white/10 rounded-lg p-3 text-sm text-gray-300">
                <p className="font-medium text-white">{portfolio.name}</p>
                <p>{holdings.length} Positionen</p>
                {portfolio.portfolioType && <p>Typ: {portfolioTypeConfig[portfolio.portfolioType]?.label || portfolio.portfolioType}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-white/10 text-gray-300 hover:bg-white/10"
                onClick={() => {
                  const text = `Schau dir mein Portfolio "${portfolio.name}" an: ${window.location.origin}/portfolios/${portfolioId}`;
                  if (navigator.share) {
                    navigator.share({ title: portfolio.name, text, url: `${window.location.origin}/portfolios/${portfolioId}` });
                  } else {
                    navigator.clipboard.writeText(text);
                    toast.success('Text kopiert!');
                  }
                  setIsShareDialogOpen(false);
                }}
              >
                {navigator.share ? 'Teilen...' : 'Als Text kopieren'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#1a1f2e] border-[#00CFC1]/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Portfolio löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Möchten Sie das Portfolio "{portfolio.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
              Alle Transaktionen und Daten werden unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/20 text-white hover:bg-white/10">
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Portfolio löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
