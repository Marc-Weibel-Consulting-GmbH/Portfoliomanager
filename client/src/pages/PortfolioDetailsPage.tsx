import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
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
  Plus,
  Bell,
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

export default function PortfolioDetailsPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const portfolioId = params.id ? parseInt(params.id) : 0;
  
  console.log('[PortfolioDetailsPage] params:', params);
  console.log('[PortfolioDetailsPage] portfolioId:', portfolioId, 'type:', typeof portfolioId);
  
  // Fetch portfolio data
  const { data: portfolio, isLoading } = trpc.portfolios.get.useQuery(
    { id: portfolioId },
    {
      enabled: portfolioId > 0, // Only fetch if portfolioId is valid
    }
  );
  const { data: allPortfolios } = trpc.portfolios.list.useQuery();
  const deletePortfolio = trpc.portfolios.delete.useMutation();
  const utils = trpc.useUtils();
  
  const [selectedPeriod, setSelectedPeriod] = useState("6M");
  
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
  
  // Parse portfolio data
  let portfolioData: { stocks: Array<{ ticker: string; weight: number }> } = { stocks: [] };
  try {
    portfolioData = JSON.parse(portfolio.portfolioData);
  } catch (e) {
    console.error("Failed to parse portfolio data:", e);
  }
  
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
  
  // Mock data for charts and metrics (replace with real data later)
  const mockMetrics = {
    totalValue: "CHF 45,230",
    performance: "+18.5%",
    performanceValue: "+7,230",
    irr: "16.2%",
    beta: "1.15",
    volatility: "18.3%",
    sharpeRatio: "1.42",
    dividendYield: "2.1%",
  };
  
  const mockHoldings = [
    { ticker: "GOOGL", name: "Alphabet Inc.", shares: 50, weight: 55, currentPrice: 2501.45, value: 125072.5, performance: 12.3, dividendYield: 0.0 },
    { ticker: "MSFT", name: "Microsoft Corp.", shares: 100, weight: 22, currentPrice: 368.8, value: 36880, performance: 8.4, dividendYield: 0.8 },
    { ticker: "AAPL", name: "Apple Inc.", shares: 150, weight: 20, currentPrice: 160.3, value: 24045, performance: 11.1, dividendYield: 0.5 },
    { ticker: "AMZN", name: "Amazon.com Inc.", shares: 60, weight: 18, currentPrice: 3340.6, value: 200436, performance: 15.3, dividendYield: 0.0 },
    { ticker: "TSLA", name: "Tesla Inc.", shares: 40, weight: 15, currentPrice: 1031.5, value: 41260, performance: 21.1, dividendYield: 0.0 },
  ];
  
  const mockTransactions = [
    { date: "2024-06-15", type: "Kauf", ticker: "MSFT", shares: 10, price: 335.2, total: 3352 },
    { date: "2024-06-10", type: "Dividende", ticker: "AAPL", shares: 150, price: 0.24, total: 36 },
    { date: "2024-06-01", type: "Kauf", ticker: "GOOGL", shares: 5, price: 2501.45, total: 12507.25 },
  ];
  
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Portfolio Value Over Time (6 Months)</h3>
                  <div className="flex gap-2">
                    {["1M", "3M", "6M", "1Y", "YTD", "All"].map((period) => (
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
                <div className="h-64 bg-[#0f1420]/50 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">Chart Placeholder (Portfolio vs. Benchmark)</p>
                </div>
              </div>
              
              {/* Performance Stats */}
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-400 mb-1">Portfolio Value</div>
                  <div className="text-3xl font-bold text-white">{mockMetrics.totalValue}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-green-500 font-semibold">{mockMetrics.performance}</span>
                    <span className="text-sm text-gray-400">({mockMetrics.performanceValue})</span>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-white/10 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">IRR</span>
                    <span className="text-sm font-semibold text-white">{mockMetrics.irr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Beta</span>
                    <span className="text-sm font-semibold text-white">{mockMetrics.beta}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Volatilität</span>
                    <span className="text-sm font-semibold text-white">{mockMetrics.volatility}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Sharpe Ratio</span>
                    <span className="text-sm font-semibold text-white">{mockMetrics.sharpeRatio}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Dividendenrendite</span>
                    <span className="text-sm font-semibold text-white">{mockMetrics.dividendYield}</span>
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
                <CardTitle className="text-white">Holdings ({mockHoldings.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-white/10">
                      <tr className="text-gray-400">
                        <th className="text-left p-3">Ticker</th>
                        <th className="text-left p-3">Name</th>
                        <th className="text-right p-3">Shares</th>
                        <th className="text-right p-3">Weight %</th>
                        <th className="text-right p-3">Current Price</th>
                        <th className="text-right p-3">Value</th>
                        <th className="text-right p-3">Performance %</th>
                        <th className="text-right p-3">Div. Yield</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockHoldings.map((holding) => (
                        <tr key={holding.ticker} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-3">
                            <Link href={`/stocks/${holding.ticker}`}>
                              <span className="font-semibold text-[#00CFC1] hover:underline cursor-pointer">
                                {holding.ticker}
                              </span>
                            </Link>
                          </td>
                          <td className="p-3 text-gray-300">{holding.name}</td>
                          <td className="text-right p-3 text-white">{holding.shares}</td>
                          <td className="text-right p-3">
                            <Badge variant="outline">{holding.weight}%</Badge>
                          </td>
                          <td className="text-right p-3 text-white">CHF {holding.currentPrice.toFixed(2)}</td>
                          <td className="text-right p-3 text-white">CHF {holding.value.toLocaleString("de-CH", { minimumFractionDigits: 2 })}</td>
                          <td className="text-right p-3">
                            <span className={holding.performance > 0 ? "text-green-500" : "text-red-500"}>
                              {holding.performance > 0 ? "+" : ""}{holding.performance}%
                            </span>
                          </td>
                          <td className="text-right p-3 text-gray-300">{holding.dividendYield}%</td>
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
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
              <CardHeader>
                <CardTitle className="text-white">Asset Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-center justify-center">
                  <p className="text-gray-500 text-sm">Donut Chart Placeholder</p>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Aktien</span>
                    <span className="text-white font-semibold">85%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Anleihen</span>
                    <span className="text-white font-semibold">10%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">ETFs</span>
                    <span className="text-white font-semibold">5%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
              <CardHeader>
                <CardTitle className="text-white">Sector Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-center justify-center">
                  <p className="text-gray-500 text-sm">Donut Chart Placeholder</p>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Technology</span>
                    <span className="text-white font-semibold">60%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Healthcare</span>
                    <span className="text-white font-semibold">20%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Finance</span>
                    <span className="text-white font-semibold">15%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Other</span>
                    <span className="text-white font-semibold">5%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Transactions (only for Live portfolios) */}
        {portfolio.isLive === 1 && (
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Letzte Transaktionen</CardTitle>
                <Link href={`/portfolios/${portfolioId}/transactions`}>
                  <Button variant="outline" size="sm">
                    Alle anzeigen
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/10">
                    <tr className="text-gray-400">
                      <th className="text-left p-3">Datum</th>
                      <th className="text-left p-3">Typ</th>
                      <th className="text-left p-3">Ticker</th>
                      <th className="text-right p-3">Anzahl</th>
                      <th className="text-right p-3">Preis</th>
                      <th className="text-right p-3">Gesamt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockTransactions.map((tx, index) => (
                      <tr key={index} className="border-b border-white/5">
                        <td className="p-3 text-gray-300">{tx.date}</td>
                        <td className="p-3">
                          <Badge variant={tx.type === "Kauf" ? "default" : "outline"}>
                            {tx.type}
                          </Badge>
                        </td>
                        <td className="p-3 text-[#00CFC1] font-semibold">{tx.ticker}</td>
                        <td className="text-right p-3 text-white">{tx.shares}</td>
                        <td className="text-right p-3 text-white">CHF {tx.price.toFixed(2)}</td>
                        <td className="text-right p-3 text-white">CHF {tx.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Quick Actions */}
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
          <CardHeader>
            <CardTitle className="text-white">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {portfolio.isLive === 1 && (
                <Button className="bg-[#00CFC1] hover:bg-[#00b8ad] text-black font-semibold">
                  <Plus className="h-4 w-4 mr-2" />
                  Transaktion hinzufügen
                </Button>
              )}
              <Button variant="outline" className="border-[#00CFC1]/50 text-[#00CFC1] hover:bg-[#00CFC1]/10">
                <Bell className="h-4 w-4 mr-2" />
                Alarm erstellen
              </Button>
              <Button variant="outline" className="border-[#00CFC1]/50 text-[#00CFC1] hover:bg-[#00CFC1]/10">
                <Edit className="h-4 w-4 mr-2" />
                Portfolio bearbeiten
              </Button>
              <Button variant="outline" className="border-red-500/50 text-red-500 hover:bg-red-500/10" onClick={handleDelete}>
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
