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
  const [, navigate] = useLocation();
  const portfolioId = params.id ? parseInt(params.id) : 0;
  
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
              <Button size="sm" className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black">
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
        
        {/* KPI Row — matches design PDF: WERT | YTD | GESAMT | SHARPE */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* WERT */}
          <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 border-t-2 border-t-[#00CFC1] rounded-lg p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">WERT</p>
            <p className="text-2xl font-bold font-mono text-white">
              {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(totalValueCHF)}
            </p>
            {portfolio?.investmentAmount && (
              <p className="text-xs text-gray-500 mt-1">Gest. {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(Number(portfolio.investmentAmount))}</p>
            )}
          </div>

          {/* YTD */}
          <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 border-t-2 border-t-[#00CFC1] rounded-lg p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">YTD</p>
            {(() => {
              const ytdPerf = chartData.data.length > 0 ? (chartData.data[chartData.data.length - 1]?.portfolio || 0) : 0;
              return (
                <p className={`text-2xl font-bold font-mono ${ytdPerf >= 0 ? 'text-[#00CFC1]' : 'text-red-400'}`}>
                  {ytdPerf >= 0 ? '+' : ''}{ytdPerf.toFixed(1)}%
                </p>
              );
            })()}
            <p className="text-xs text-gray-500 mt-1">vs. {benchmarkOptions.find(b => b.value === selectedBenchmark)?.label}</p>
          </div>

          {/* GESAMT */}
          <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 border-t-2 border-t-[#00CFC1] rounded-lg p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">GESAMT</p>
            {(() => {
              const invested = Number(portfolio?.investmentAmount || 0);
              const gain = totalValueCHF - invested;
              const pct = invested > 0 ? (gain / invested) * 100 : 0;
              return (
                <>
                  <p className={`text-2xl font-bold font-mono ${pct >= 0 ? 'text-[#00CFC1]' : 'text-red-400'}`}>
                    {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                  </p>
                  <p className={`text-xs mt-1 ${gain >= 0 ? 'text-gray-400' : 'text-red-400'}`}>
                    {gain >= 0 ? '+' : ''}{new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(gain)}
                  </p>
                </>
              );
            })()}
          </div>

          {/* TTWROR p.a. */}
          <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 border-t-2 border-t-[#00CFC1] rounded-lg p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">TTWROR P.A.</p>
            <p className="text-2xl font-bold font-mono text-white">
              {perfMetrics?.annualizedTtwror ? `${(perfMetrics.annualizedTtwror * 100).toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs text-gray-500 mt-1">TTWROR p.a.</p>
          </div>
        </div>

        {/* Tabs Section — matches design PDF */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="flex flex-wrap gap-0 bg-transparent border-b border-white/10 p-0 h-auto rounded-none">
            {[
              { value: 'overview', label: 'Übersicht' },
              { value: 'positions', label: `Positionen`, badge: holdings.length },
              { value: 'transactions', label: 'Transaktionen', badge: transactions.length },
              { value: 'performance', label: 'Performance' },
              { value: 'risk', label: 'Risiko' },
              { value: 'optimize', label: 'Optimieren' },
              { value: 'ai', label: 'AI' },
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

          {/* OVERVIEW TAB — 2 columns: chart left, top-positions + activity right */}
          <TabsContent value="overview" className="mt-6">
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

          {/* POSITIONS TAB */}
          <TabsContent value="positions" className="mt-6">
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-white text-sm">Positionen ({holdings.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)} className="border-[#00CFC1]/40 text-[#00CFC1] hover:bg-[#00CFC1]/10 text-xs h-7">
                  + Position hinzufügen
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-white/10">
                      <tr className="text-gray-400 text-xs">
                        <th className="text-left p-2">Ticker</th>
                        <th className="text-left p-2">Name</th>
                        <th className="text-right p-2">Stk.</th>
                        <th className="text-right p-2">Ø Kauf</th>
                        <th className="text-right p-2">Kurs (CHF)</th>
                        <th className="text-right p-2">Wert (CHF)</th>
                        <th className="text-right p-2">YTD</th>
                        <th className="text-right p-2">Div.</th>
                        <th className="text-right p-2">Gew.</th>
                        <th className="text-right p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((h: any) => (
                        <tr key={h.ticker} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-2">
                            <Link href={`/stock/${h.ticker}?from=${portfolioId}`}>
                              <div className="flex items-center gap-1.5">
                                <StockLogo ticker={h.ticker} companyName={h.companyName} size="sm" />
                                <span className="text-[#00CFC1] font-semibold hover:underline cursor-pointer text-xs">{h.ticker}</span>
                              </div>
                            </Link>
                          </td>
                          <td className="p-2 text-gray-300 text-xs truncate max-w-[120px]">{h.companyName}</td>
                          <td className="text-right p-2 text-white text-xs">{h.shares ? parseFloat(h.shares).toFixed(2) : '-'}</td>
                          <td className="text-right p-2 text-gray-400 text-xs">{h.avgBuyPrice > 0 ? formatCurrency(h.avgBuyPrice, h.currency || 'USD') : '-'}</td>
                          <td className="text-right p-2 text-white text-xs">{formatCurrency(h.currentPriceCHF || 0, 'CHF')}</td>
                          <td className="text-right p-2 text-white font-semibold text-xs">{formatCurrency((h.shares || 0) * (h.currentPriceCHF || 0), 'CHF')}</td>
                          <td className="text-right p-2 text-xs">
                            <span className={parseFloat(h.ytdPerformance || '0') >= 0 ? 'text-[#00CFC1]' : 'text-red-400'}>
                              {parseFloat(h.ytdPerformance || '0') >= 0 ? '+' : ''}{parseFloat(h.ytdPerformance || '0').toFixed(1)}%
                            </span>
                          </td>
                          <td className="text-right p-2 text-gray-400 text-xs">{parseFloat(h.dividendYield || '0').toFixed(1)}%</td>
                          <td className="text-right p-2 text-gray-400 text-xs">{parseFloat(h.weight || '0').toFixed(1)}%</td>
                          <td className="text-right p-2">
                            <Button variant="ghost" size="sm" className="text-[#00CFC1] hover:bg-[#00CFC1]/10 h-6 text-xs px-2" onClick={() => handleEditPosition(h)}>Bearb.</Button>
                          </td>
                        </tr>
                      ))}
                      {portfolio?.cashBalance && parseFloat(portfolio.cashBalance) > 0 && (
                        <tr className="border-b border-white/5 bg-[#00CFC1]/5">
                          <td className="p-2 text-gray-400 text-xs">-</td>
                          <td className="p-2 text-gray-300 font-semibold text-xs">Cash (CHF)</td>
                          <td className="text-right p-2 text-gray-400 text-xs">-</td>
                          <td className="text-right p-2 text-gray-400 text-xs">-</td>
                          <td className="text-right p-2 text-gray-400 text-xs">-</td>
                          <td className="text-right p-2 text-white font-semibold text-xs">{formatCurrency(parseFloat(portfolio.cashBalance), 'CHF')}</td>
                          <td className="text-right p-2 text-gray-400 text-xs">-</td>
                          <td className="text-right p-2 text-gray-400 text-xs">-</td>
                          <td className="text-right p-2 text-gray-400 text-xs">{((parseFloat(portfolio.cashBalance) / totalValueCHF) * 100).toFixed(1)}%</td>
                          <td></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TRANSACTIONS TAB */}
          <TabsContent value="transactions" className="mt-6">
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
              <CardHeader>
                <CardTitle className="text-white text-sm">Transaktionen ({transactions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <p className="text-gray-400 text-center py-4 text-sm">Keine Transaktionen vorhanden</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-white/10">
                        <tr className="text-gray-400 text-xs">
                          <th className="text-left p-2">Datum</th>
                          <th className="text-left p-2">Typ</th>
                          <th className="text-left p-2">Ticker</th>
                          <th className="text-right p-2">Stk.</th>
                          <th className="text-right p-2">Preis</th>
                          <th className="text-right p-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.slice(0, 30).map((t: any) => (
                          <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                            <td className="p-2 text-gray-400 text-xs">{new Date(t.date || t.transactionDate).toLocaleDateString('de-CH')}</td>
                            <td className="p-2 text-xs">
                              <Badge variant="outline" className={`text-[9px] ${
                                (t.type || t.transactionType) === 'BUY' || (t.type || t.transactionType) === 'buy' ? 'border-emerald-500/50 text-emerald-400' :
                                (t.type || t.transactionType) === 'dividend' ? 'border-[#00CFC1]/50 text-[#00CFC1]' :
                                'border-red-500/50 text-red-400'
                              }`}>
                                {(t.type || t.transactionType) === 'BUY' || (t.type || t.transactionType) === 'buy' ? 'Kauf' :
                                 (t.type || t.transactionType) === 'SELL' || (t.type || t.transactionType) === 'sell' ? 'Verkauf' :
                                 (t.type || t.transactionType) === 'dividend' ? 'Dividende' : (t.type || t.transactionType)}
                              </Badge>
                            </td>
                            <td className="p-2 text-[#00CFC1] text-xs font-semibold">{t.ticker}</td>
                            <td className="text-right p-2 text-white text-xs">{t.shares || t.quantity || '-'}</td>
                            <td className="text-right p-2 text-gray-300 text-xs">{formatCurrency(t.price || t.pricePerShare || 0, t.currency || 'CHF')}</td>
                            <td className="text-right p-2 text-white text-xs font-semibold">{formatCurrency((t.shares || t.quantity || 0) * (t.price || t.pricePerShare || 0), t.currency || 'CHF')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
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

          {/* RISK TAB */}
          <TabsContent value="risk" className="mt-6">
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <div className="text-lg font-semibold text-white mb-2">Risikoanalyse</div>
                  <p className="text-gray-400 text-sm mb-4">Detaillierte Risikokennzahlen für dieses Portfolio</p>
                  <Link href="/risk-dashboard"><Button className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black">Zum Risk-Dashboard</Button></Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* OPTIMIZE TAB */}
          <TabsContent value="optimize" className="mt-6">
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <div className="text-lg font-semibold text-white mb-2">Portfolio-Optimierung</div>
                  <p className="text-gray-400 text-sm mb-4">Markowitz-Optimierung und Rebalancing-Vorschläge</p>
                  <Link href="/portfolio-optimizer"><Button className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black">Zum Optimizer</Button></Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI TAB */}
          <TabsContent value="ai" className="mt-6">
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <div className="text-lg font-semibold text-white mb-2">AI-Analyse</div>
                  <p className="text-gray-400 text-sm mb-4">KI-gestützte Insights und Empfehlungen für dieses Portfolio</p>
                  <Link href="/copilot"><Button className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black">Zum Copilot</Button></Link>
                </div>
              </CardContent>
            </Card>
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
