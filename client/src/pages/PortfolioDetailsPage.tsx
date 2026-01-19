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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            
            {/* Portfolio Switcher */}
            {allPortfolios && allPortfolios.length > 1 && (
              <Select value={portfolioId.toString()} onValueChange={handlePortfolioSwitch}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allPortfolios.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{p.name}</span>
                        {p.isLive === 1 && (
                          <Badge variant="default" className="bg-green-500 text-white text-xs">Live</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Aktivierungs-Button nur für Demo-Portfolios */}
            {isDemo && (
              <Button 
                size="sm" 
                onClick={() => setIsActivationModalOpen(true)}
                className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black"
              >
                <Play className="h-4 w-4 mr-2" />
                Portfolio aktivieren
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setIsSettingsModalOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Einstellungen
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Positionen
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Teilen
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeleteClick}>
              <Trash2 className="h-4 w-4 mr-2" />
              Löschen
            </Button>
          </div>
        </div>
        
        {/* Portfolio Title & Info */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">{portfolio.name}</h1>
            {portfolio.isLive === 1 && (
              <Badge variant="default" className="bg-green-500 text-white">
                <span className="relative flex h-2 w-2 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                Live
              </Badge>
            )}
            {typeConfig && (
              <Badge variant="outline" className="flex items-center gap-1">
                {typeConfig.icon}
                {typeConfig.label}
              </Badge>
            )}
          </div>
          {portfolio.description && (
            <p className="text-gray-400">{portfolio.description}</p>
          )}
          <p className="text-sm text-gray-500 mt-1">
            Erstellt: {formatDate(portfolio.createdAt)} · Aktualisiert: {formatDate(portfolio.updatedAt)}
          </p>
        </div>
        
        {/* Performance Overview */}
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart */}
              <div className="lg:col-span-2">
                <div className="flex flex-col gap-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-white">Portfolio-Wertentwicklung</h3>
                      {/* Performance Badge */}
                      {chartData.data.length > 0 && (() => {
                        const lastPoint = chartData.data[chartData.data.length - 1];
                        const performance = lastPoint?.portfolio || 0;
                        return (
                          <div className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 ${
                            performance >= 0 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            <span>{performance >= 0 ? '↗' : '↘'}</span>
                            <span>{performance >= 0 ? '+' : ''}{performance.toFixed(2)}%</span>
                            <span className="text-xs opacity-70">({selectedPeriod})</span>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Benchmark:</span>
                      <Select value={selectedBenchmark} onValueChange={setSelectedBenchmark}>
                        <SelectTrigger className="w-[140px] h-8 bg-[#0f1420] border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1f2e] border-white/10">
                          {benchmarkOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-white hover:bg-white/10">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {["1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y", "All"].map((period) => (
                      <Button
                        key={period}
                        variant={selectedPeriod === period ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setSelectedPeriod(period)}
                        className={selectedPeriod === period ? "bg-[#00CFC1] text-black" : "text-gray-400"}
                      >
                        {period}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="h-64 bg-[#0f1420]/50 rounded-lg">
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">Lade Kursdaten...</p>
                    </div>
                  ) : chartData.data.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">Keine historischen Daten verfügbar</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00CFC1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#00CFC1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#666" 
                          fontSize={11} 
                          tickLine={false}
                          axisLine={{ stroke: '#333' }}
                        />
                        <YAxis 
                          stroke="#666" 
                          fontSize={11} 
                          tickFormatter={(v) => `${v.toFixed(0)}%`}
                          tickLine={false}
                          axisLine={false}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #00CFC1', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff' }}
                          formatter={(value: number, name: string) => [
                            `${value.toFixed(2)}%`, 
                            name === 'portfolio' ? portfolio.name : benchmarkOptions.find(b => b.value === selectedBenchmark)?.label || 'Benchmark'
                          ]}
                        />
                        <RechartsLegend 
                          verticalAlign="bottom" 
                          height={36}
                          formatter={(value: string) => {
                            if (value === 'portfolio') return portfolio.name;
                            if (value === 'benchmark') return benchmarkOptions.find(b => b.value === selectedBenchmark)?.label || 'Benchmark';
                            return value;
                          }}
                          wrapperStyle={{ paddingTop: '10px' }}
                        />
                        {/* Hypothetical performance (before creation date) - dashed line */}
                        {chartData.hasHypothetical && (
                          <Area 
                            type="monotone" 
                            dataKey="hypothetical" 
                            name="hypothetical" 
                            stroke="rgba(0, 207, 193, 0.5)" 
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            fill="none"
                            connectNulls={false}
                          />
                        )}
                        {/* Real performance (after creation date) - solid line */}
                        <Area 
                          type="monotone" 
                          dataKey="portfolio" 
                          name="portfolio" 
                          stroke="#00CFC1" 
                          strokeWidth={2}
                          fill="url(#portfolioGradient)"
                          connectNulls={false}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="benchmark" 
                          name="benchmark" 
                          stroke="#6366f1" 
                          strokeWidth={1.5}
                          fill="none"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              
              {/* Performance Stats */}
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-400 mb-1">Portfolio-Übersicht</div>
                  <div className="text-2xl font-bold text-white">{holdings.length} Positionen</div>
                </div>
                
                <div className="pt-4 border-t border-white/10 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Durchschn. Dividendenrendite</span>
                    <span className="text-sm font-semibold text-[#00CFC1]">{avgDividendYield.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Sektoren</span>
                    <span className="text-sm font-semibold text-white">{Object.keys(sectorWeights).length}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Holdings & Allocation */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Holdings Table */}
          <div className="lg:col-span-3">
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
              <CardHeader>
                <CardTitle className="text-white">Positionen ({holdings.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-white/10">
                      <tr className="text-gray-400">
                        <th className="text-left p-3">Ticker</th>
                        <th className="text-left p-3">Name</th>
                        <th className="text-right p-3">Anzahl</th>
                        <th className="text-right p-3">Ø Kaufpreis</th>
                        <th className="text-right p-3">Kurs (Lokal)</th>
                        <th className="text-right p-3">Kurs (CHF)</th>
                        <th className="text-right p-3">Wert (CHF)</th>
                        <th className="text-right p-3">YTD</th>
                        <th className="text-right p-3">Div. Rendite</th>
                        <th className="text-right p-3">Gewicht</th>
                        <th className="text-right p-3">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((holding: any) => {
                        const avgBuyPrice = holding.avgBuyPrice || 0;
                        const totalValueCHF = (holding.shares || 0) * (holding.currentPriceCHF || 0);
                        
                        return (
                        <tr key={holding.ticker} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-3">
                            <Link href={`/stock/${holding.ticker}?from=${portfolioId}`}>
                              <div className="flex items-center gap-2">
                                <StockLogo ticker={holding.ticker} companyName={holding.companyName} size="sm" />
                                <span className="font-semibold text-[#00CFC1] hover:underline cursor-pointer">
                                  {holding.ticker}
                                </span>
                              </div>
                            </Link>
                          </td>
                          <td className="p-3 text-gray-300">{holding.companyName}</td>
                          <td className="text-right p-3 text-white">
                            {holding.shares ? parseFloat(holding.shares).toFixed(2) : '-'}
                          </td>
                          <td className="text-right p-3 text-gray-300">
                            {avgBuyPrice > 0 ? formatCurrency(avgBuyPrice, holding.currency || 'USD') : '-'}
                          </td>
                          <td className="text-right p-3 text-white">
                            <div className="flex flex-col items-end">
                              <span>{formatCurrency(holding.currentPriceLocal || 0, holding.currency || 'USD')}</span>
                              {holding.currency !== 'CHF' && (
                                <span className="text-xs text-gray-500">
                                  FX: {holding.fxRate?.toFixed(4) || '1.0000'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="text-right p-3 text-white">
                            {formatCurrency(holding.currentPriceCHF || 0, 'CHF')}
                          </td>
                          <td className="text-right p-3 text-white font-semibold">
                            {formatCurrency(totalValueCHF, 'CHF')}
                          </td>
                          <td className="text-right p-3">
                            <span className={parseFloat(holding.ytdPerformance || '0') >= 0 ? "text-green-500" : "text-red-500"}>
                              {parseFloat(holding.ytdPerformance || '0') >= 0 ? "+" : ""}{parseFloat(holding.ytdPerformance || '0').toFixed(2)}%
                            </span>
                          </td>
                          <td className="text-right p-3 text-gray-300">
                            {parseFloat(holding.dividendYield || '0').toFixed(2)}%
                          </td>
                          <td className="text-right p-3">
                            <Badge variant="outline">{parseFloat(holding.weight || '0').toFixed(2)}%</Badge>
                          </td>
                          <td className="text-right p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[#00CFC1] hover:bg-[#00CFC1]/10"
                              onClick={() => handleEditPosition(holding)}
                            >
                              Bearbeiten
                            </Button>
                          </td>
                        </tr>
                        );
                      })}
                      {/* Cash Position Row */}
                      {portfolio?.cashBalance && parseFloat(portfolio.cashBalance) > 0 && (
                        <tr className="border-b border-white/5 bg-[#00CFC1]/5">
                          <td className="p-3">
                            <span className="font-semibold text-gray-400">-</span>
                          </td>
                          <td className="p-3 text-gray-300 font-semibold">Cash (CHF)</td>
                          <td className="text-right p-3 text-white">-</td>
                          <td className="text-right p-3 text-gray-300">-</td>
                          <td className="text-right p-3 text-white">-</td>
                          <td className="text-right p-3 text-white">-</td>
                          <td className="text-right p-3 text-white font-semibold">
                            {formatCurrency(parseFloat(portfolio.cashBalance), 'CHF')}
                          </td>
                          <td className="text-right p-3 text-gray-400">-</td>
                          <td className="text-right p-3 text-gray-400">-</td>
                          <td className="text-right p-3">
                            <Badge variant="outline">
                              {((parseFloat(portfolio.cashBalance) / totalValueCHF) * 100).toFixed(2)}%
                            </Badge>
                          </td>
                          <td className="text-right p-3 text-gray-400">-</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Allocation Charts */}
          <div className="space-y-6">
            {/* Asset Allocation */}
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
              <CardHeader>
                <CardTitle className="text-white">Asset-Allokation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={assetAllocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {assetAllocationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #00CFC1', borderRadius: '8px', color: '#ffffff' }}
                        formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {assetAllocationData.map((item, index) => (
                    <div key={item.name} className="flex justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-gray-400">{item.name}</span>
                      </div>
                      <span className="text-white font-semibold">{item.value.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Sector Allocation */}
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
              <CardHeader>
                <CardTitle className="text-white">Sektor-Allokation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={sectorAllocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {sectorAllocationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #00CFC1', borderRadius: '8px', color: '#ffffff' }}
                        formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2 max-h-32 overflow-y-auto">
                  {sectorAllocationData
                    .sort((a, b) => b.value - a.value)
                    .map((item, index) => (
                      <div key={item.name} className="flex justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="text-gray-400">{item.name}</span>
                        </div>
                        <span className="text-white font-semibold">{item.value.toFixed(2)}%</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Tabs Section */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-[#1a1f2e] border border-[#00CFC1]/30">
            <TabsTrigger value="overview" className="data-[state=active]:bg-[#00CFC1]/20 data-[state=active]:text-[#00CFC1]">Übersicht</TabsTrigger>
            <TabsTrigger value="realized-gains" className="data-[state=active]:bg-[#00CFC1]/20 data-[state=active]:text-[#00CFC1]">Realisierte Gewinne</TabsTrigger>
            <TabsTrigger value="costs-fees" className="data-[state=active]:bg-[#00CFC1]/20 data-[state=active]:text-[#00CFC1]">Kosten & Gebühren</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="mt-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-400">Gesamtwert</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{formatCurrency(totalValueCHF, String((portfolio && 'currency' in portfolio ? portfolio.currency : null) || 'CHF'))}</div>
                  <p className="text-xs text-gray-500 mt-1">Aktueller Portfoliowert</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-400">Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Use chart performance for both demo and live portfolios
                    const chartPerformance = chartData.data.length > 0 
                      ? chartData.data[chartData.data.length - 1]?.portfolio || 0 
                      : 0;
                    return (
                      <>
                        <div className="flex items-center gap-2">
                          <div className={`text-2xl font-bold ${chartPerformance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {chartPerformance >= 0 ? '+' : ''}{chartPerformance.toFixed(2)}%
                          </div>
                          {chartPerformance >= 0 ? (
                            <TrendingUp className="h-5 w-5 text-green-500" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-red-500" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedPeriod} Performance
                        </p>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-400">Durchschn. Div. Rendite</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-[#00CFC1]">{avgDividendYield.toFixed(2)}%</div>
                  <p className="text-xs text-gray-500 mt-1">Gewichteter Durchschnitt</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-400">Positionen</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{holdings.length}</div>
                  <p className="text-xs text-gray-500 mt-1">{Object.keys(sectorWeights).length} Sektoren</p>
                </CardContent>
              </Card>
            </div>
            
            {/* Recent Activity Summary */}
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30 mt-4">
              <CardHeader>
                <CardTitle className="text-white">Portfolio-Zusammenfassung</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-3">Top Positionen</h4>
                    <div className="space-y-2">
                      {holdings
                        .sort((a: any, b: any) => parseFloat(b.weight || '0') - parseFloat(a.weight || '0'))
                        .slice(0, 5)
                        .map((h: any) => (
                          <div key={h.ticker} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-[#00CFC1] font-semibold">{h.ticker}</span>
                              <span className="text-gray-400 text-sm">{h.companyName}</span>
                            </div>
                            <Badge variant="outline">{parseFloat(h.weight || '0').toFixed(2)}%</Badge>
                          </div>
                        ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-3">Beste Performance (YTD)</h4>
                    <div className="space-y-2">
                      {holdings
                        .sort((a: any, b: any) => parseFloat(b.ytdPerformance || '0') - parseFloat(a.ytdPerformance || '0'))
                        .slice(0, 5)
                        .map((h: any) => (
                          <div key={h.ticker} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-[#00CFC1] font-semibold">{h.ticker}</span>
                              <span className="text-gray-400 text-sm">{h.companyName}</span>
                            </div>
                            <span className={parseFloat(h.ytdPerformance || '0') >= 0 ? 'text-green-500' : 'text-red-500'}>
                              {parseFloat(h.ytdPerformance || '0') >= 0 ? '+' : ''}{parseFloat(h.ytdPerformance || '0').toFixed(2)}%
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="realized-gains" className="mt-6">
            {realizedGains.length > 0 ? (
              <RealizedGainsTable gains={realizedGains} />
            ) : (
              <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
                <CardContent className="pt-6">
                  <p className="text-gray-400 text-center">Keine realisierten Gewinne vorhanden</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="costs-fees" className="mt-6">
            {transactions.length > 0 ? (
              <CostFeesReport transactions={transactions} portfolioId={portfolioId} />
            ) : (
              <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
                <CardContent className="pt-6">
                  <p className="text-gray-400 text-center">Keine Transaktionen vorhanden</p>
                </CardContent>
              </Card>
            )}
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
