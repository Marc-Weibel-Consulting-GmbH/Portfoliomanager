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
  
  // Use enriched stocks from the API
  const holdings = portfolio.enrichedStocks || [];
  
  // Calculate sector allocation
  const sectorWeights: Record<string, number> = {};
  holdings.forEach((h: any) => {
    const sector = h.sector || 'Other';
    sectorWeights[sector] = (sectorWeights[sector] || 0) + (h.weight || 0);
  });
  
  // Calculate total portfolio value based on initial capital and weights
  // For now, we use a placeholder calculation
  const totalValueCHF = portfolio.totalValueCHF || 0;
  const avgDividendYield = portfolio.avgDividendYield || 0;
  
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Portfolio-Wertentwicklung</h3>
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
                            <Badge variant="outline">{holding.weight}%</Badge>
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
                <div className="h-48 flex items-center justify-center">
                  <p className="text-gray-500 text-sm">Donut Chart Placeholder</p>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Aktien</span>
                    <span className="text-white font-semibold">100%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Sector Allocation */}
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
              <CardHeader>
                <CardTitle className="text-white">Sektor-Allokation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-center justify-center">
                  <p className="text-gray-500 text-sm">Donut Chart Placeholder</p>
                </div>
                <div className="mt-4 space-y-2">
                  {Object.entries(sectorWeights)
                    .sort((a, b) => b[1] - a[1])
                    .map(([sector, weight]) => (
                      <div key={sector} className="flex justify-between text-sm">
                        <span className="text-gray-400">{sector}</span>
                        <span className="text-white font-semibold">{weight.toFixed(0)}%</span>
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
