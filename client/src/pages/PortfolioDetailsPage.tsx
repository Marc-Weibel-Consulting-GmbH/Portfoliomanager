import { useState, useMemo } from "react";
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
  Legend,
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
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

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
  
  // Fetch portfolio data with currency information
  const { data: portfolio, isLoading } = trpc.portfolios.getWithCurrency.useQuery(
    portfolioId,
    {
      enabled: portfolioId > 0,
    }
  );
  const { data: allPortfolios } = trpc.portfolios.list.useQuery();
  const deletePortfolio = trpc.portfolios.delete.useMutation();
  
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
  const totalValueCHF = portfolio?.totalValueCHF || 0;
  const avgDividendYield = portfolio?.avgDividendYield || 0;
  
  // Fetch historical performance data from API
  const { data: historicalData, isLoading: isLoadingHistory } = trpc.portfolios.getHistoricalPerformance.useQuery(
    { 
      portfolioId, 
      period: selectedPeriod as '1M' | '3M' | '6M' | '1Y' | 'YTD' | '3Y' | '5Y' | 'All',
      benchmark: selectedBenchmark,
    },
    { enabled: portfolioId > 0 }
  );
  
  // Process chart data - sample to reduce data points for display
  const chartData = useMemo(() => {
    if (!historicalData?.chartData || historicalData.chartData.length === 0) {
      return [];
    }
    
    const data = historicalData.chartData;
    
    // Sample data to show roughly one point per week for better visualization
    const sampleInterval = Math.max(1, Math.floor(data.length / 52));
    const sampledData = data.filter((_: any, index: number) => index % sampleInterval === 0 || index === data.length - 1);
    
    // Format dates for display
    return sampledData.map((d: any) => ({
      date: new Date(d.date).toLocaleDateString('de-CH', { day: '2-digit', month: 'short' }),
      portfolio: d.portfolio,
      benchmark: d.benchmark,
    }));
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
    
    return Object.entries(categories).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
    }));
  }, [holdings]);
  
  // Prepare pie chart data for sector allocation  
  const sectorAllocationData = useMemo(() => {
    return Object.entries(sectorWeights).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
    }));
  }, [sectorWeights]);
  
  // Colors for pie charts
  const COLORS = ['#00CFC1', '#00A89D', '#007D74', '#00524C', '#003D38', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];
  
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
  
  const handleDelete = async () => {
    if (confirm("Möchten Sie dieses Portfolio wirklich löschen?")) {
      try {
        await deletePortfolio.mutateAsync({ id: portfolioId });
        toast.success("Portfolio gelöscht");
        navigate("/dashboard");
      } catch (error: any) {
        toast.error(error.message || "Fehler beim Löschen");
      }
    }
  };
  
  const handlePortfolioSwitch = (newId: string) => {
    navigate(`/portfolios/${newId}`);
  };
  
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
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Bearbeiten
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Teilen
            </Button>
            <Button variant="outline" size="sm" onClick={handleDelete}>
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
                    <h3 className="text-lg font-semibold text-white">Portfolio-Wertentwicklung</h3>
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
                  ) : chartData.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">Keine historischen Daten verfügbar</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                            name === 'portfolio' ? 'Portfolio' : benchmarkOptions.find(b => b.value === selectedBenchmark)?.label || 'Benchmark'
                          ]}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="portfolio" 
                          name="Portfolio" 
                          stroke="#00CFC1" 
                          strokeWidth={2}
                          fill="url(#portfolioGradient)"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="benchmark" 
                          name="Benchmark" 
                          stroke="#6366f1" 
                          strokeWidth={1.5}
                          strokeDasharray="5 5"
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
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Holdings Table */}
          <div className="lg:col-span-2">
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
                        <th className="text-right p-3">Gewicht</th>
                        <th className="text-right p-3">Kurs (Lokal)</th>
                        <th className="text-right p-3">Kurs (CHF)</th>
                        <th className="text-right p-3">YTD</th>
                        <th className="text-right p-3">Div. Rendite</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((holding: any) => (
                        <tr key={holding.ticker} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-3">
                            <Link href={`/stocks/${holding.ticker}`}>
                              <span className="font-semibold text-[#00CFC1] hover:underline cursor-pointer">
                                {holding.ticker}
                              </span>
                            </Link>
                          </td>
                          <td className="p-3 text-gray-300">{holding.companyName}</td>
                          <td className="text-right p-3">
                            <Badge variant="outline">{parseFloat(holding.weight || '0').toFixed(2)}%</Badge>
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
                          <td className="text-right p-3">
                            <span className={parseFloat(holding.ytdPerformance || '0') >= 0 ? "text-green-500" : "text-red-500"}>
                              {parseFloat(holding.ytdPerformance || '0') >= 0 ? "+" : ""}{parseFloat(holding.ytdPerformance || '0').toFixed(2)}%
                            </span>
                          </td>
                          <td className="text-right p-3 text-gray-300">
                            {parseFloat(holding.dividendYield || '0').toFixed(2)}%
                          </td>
                        </tr>
                      ))}
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
                        contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #00CFC1', borderRadius: '8px' }}
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
                        contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #00CFC1', borderRadius: '8px' }}
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
        
        {/* Quick Actions */}
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
          <CardHeader>
            <CardTitle className="text-white">Schnellaktionen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm">
                <TrendingUp className="h-4 w-4 mr-2" />
                Alarm erstellen
              </Button>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Portfolio bearbeiten
              </Button>
              <Button variant="outline" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Portfolio löschen
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
