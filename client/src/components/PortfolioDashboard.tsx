import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Plus, Edit, Eye, Settings } from "lucide-react";
import { toast } from "sonner";
import { StockLogo } from "@/components/StockLogo";
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function PortfolioDashboard() {
  const [, setLocation] = useLocation();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Fetch all portfolios
  const { data: portfolios = [], refetch: refetchPortfolios } = trpc.portfolios.list.useQuery();
  
  // Get selected portfolio or default to first
  const selectedPortfolio = useMemo(() => {
    if (selectedPortfolioId) {
      return portfolios.find(p => p.id === selectedPortfolioId);
    }
    return portfolios[0];
  }, [selectedPortfolioId, portfolios]);

  // Mutations
  const toggleLiveMutation = trpc.portfolios.toggleLive.useMutation({
    onSuccess: () => {
      refetchPortfolios();
      toast.success('Modus geändert');
    },
    onError: (error) => {
      toast.error('Fehler: ' + error.message);
    },
  });

  const updatePortfolioMutation = trpc.portfolios.update.useMutation({
    onSuccess: () => {
      refetchPortfolios();
      toast.success('Portfolio aktualisiert');
      setIsEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Fehler: ' + error.message);
    },
  });

  // Parse portfolio data
  const portfolioData = useMemo(() => {
    if (!selectedPortfolio) return null;
    try {
      const data = JSON.parse(selectedPortfolio.portfolioData);
      return Array.isArray(data) ? data : (data.stocks || []);
    } catch {
      return [];
    }
  }, [selectedPortfolio]);

  // Calculate portfolio metrics
  const portfolioMetrics = useMemo(() => {
    if (!portfolioData || portfolioData.length === 0) {
      return {
        totalValue: 0,
        ytdPerformance: 0,
        holdings: [],
        sectorAllocation: [],
      };
    }

    let totalValue = 0;
    let totalInvested = 0;
    const holdings: any[] = [];
    const sectorMap: Record<string, number> = {};

    portfolioData.forEach((stock: any) => {
      const currentPrice = parseFloat(stock.currentPrice || '0');
      const shares = parseFloat(stock.shares || '0');
      const value = currentPrice * shares;
      const investmentAmount = parseFloat(stock.investmentAmount || stock.totalInvested || '0');
      
      totalValue += value;
      totalInvested += investmentAmount;

      const ytdStartPrice = parseFloat(stock.ytdStartPrice || currentPrice);
      const change = ytdStartPrice > 0 ? ((currentPrice - ytdStartPrice) / ytdStartPrice) * 100 : 0;

      holdings.push({
        ticker: stock.ticker,
        companyName: stock.companyName,
        price: currentPrice,
        currency: stock.currency || 'CHF',
        change,
        value,
        category: stock.category || 'Other',
      });

      const category = stock.category || 'Other';
      sectorMap[category] = (sectorMap[category] || 0) + value;
    });

    const ytdPerformance = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;

    const sectorAllocation = Object.entries(sectorMap)
      .map(([name, value]) => ({
        name,
        value,
        percentage: (value / totalValue) * 100,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      totalValue,
      ytdPerformance,
      holdings: holdings.sort((a, b) => b.value - a.value),
      sectorAllocation,
    };
  }, [portfolioData]);

  // Chart data for performance
  const performanceChartData = useMemo(() => {
    // Generate mock historical data for demonstration
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const baseValue = portfolioMetrics.totalValue * 0.9; // Start at 90% of current value
    const data = months.map((_, i) => {
      const progress = i / 11;
      return baseValue + (portfolioMetrics.totalValue - baseValue) * progress;
    });

    return {
      labels: months,
      datasets: [
        {
          label: 'Portfolio Value',
          data,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.4,
          fill: true,
        },
      ],
    };
  }, [portfolioMetrics.totalValue]);

  // Chart data for asset allocation
  const allocationChartData = useMemo(() => {
    const colors = [
      'rgb(59, 130, 246)',  // blue
      'rgb(139, 92, 246)',  // purple
      'rgb(236, 72, 153)',  // pink
      'rgb(251, 146, 60)',  // orange
      'rgb(34, 197, 94)',   // green
    ];

    return {
      labels: portfolioMetrics.sectorAllocation.map(s => s.name),
      datasets: [
        {
          data: portfolioMetrics.sectorAllocation.map(s => s.value),
          backgroundColor: colors,
          borderColor: 'rgb(30, 41, 59)',
          borderWidth: 2,
        },
      ],
    };
  }, [portfolioMetrics.sectorAllocation]);

  const handleToggleLive = () => {
    if (!selectedPortfolio) return;
    toggleLiveMutation.mutate({
      id: selectedPortfolio.id,
      isLive: !selectedPortfolio.isLive,
    });
  };

  const handleEditPortfolio = () => {
    if (!selectedPortfolio) return;
    setEditName(selectedPortfolio.name);
    setEditDescription(selectedPortfolio.description || '');
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedPortfolio) return;
    updatePortfolioMutation.mutate({
      id: selectedPortfolio.id,
      name: editName,
      description: editDescription,
    });
  };

  const handleViewDetails = () => {
    if (!selectedPortfolio) return;
    if (selectedPortfolio.isLive) {
      setLocation(`/portfolio/${selectedPortfolio.id}`);
    } else {
      toast.info('Aktivieren Sie den Live-Modus für detaillierte Tracking-Funktionen');
    }
  };

  if (portfolios.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
        <Card className="max-w-md w-full bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-center">Kein Portfolio vorhanden</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-slate-300">
              Erstellen Sie Ihr erstes Portfolio mit dem Portfolio Optimizer.
            </p>
            <Button onClick={() => setLocation('/portfolio-builder/new')} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Neues Portfolio erstellen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Controls */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-1 min-w-[300px]">
            <Select
              value={selectedPortfolio?.id.toString()}
              onValueChange={(value) => setSelectedPortfolioId(parseInt(value))}
            >
              <SelectTrigger className="w-[300px] bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Portfolio auswählen" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {portfolios.map((portfolio) => (
                  <SelectItem 
                    key={portfolio.id} 
                    value={portfolio.id.toString()}
                    className="text-white hover:bg-slate-700"
                  >
                    {portfolio.name} {portfolio.isLive && '(LIVE)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setLocation('/portfolio-builder/new')}
              variant="default"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Neues Portfolio
            </Button>

            {selectedPortfolio && (
              <>
                <Button
                  onClick={handleViewDetails}
                  variant="outline"
                  className="border-slate-600 text-white hover:bg-slate-800"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Details
                </Button>

                <Button
                  onClick={handleEditPortfolio}
                  variant="outline"
                  className="border-slate-600 text-white hover:bg-slate-800"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Bearbeiten
                </Button>

                <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                  <span className="text-sm text-slate-300">
                    {selectedPortfolio.isLive ? 'LIVE' : 'TEST'}
                  </span>
                  <Switch
                    checked={!!selectedPortfolio.isLive}
                    onCheckedChange={handleToggleLive}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Portfolio Value & Chart */}
          <div className="lg:col-span-2 space-y-6">
            {/* Portfolio Value Card */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-300 text-sm font-medium">
                  Portfolio Value
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-4xl font-bold text-white">
                    CHF {portfolioMetrics.totalValue.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <div className={`text-lg mt-2 ${portfolioMetrics.ytdPerformance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    YTD {portfolioMetrics.ytdPerformance >= 0 ? '+' : ''}{portfolioMetrics.ytdPerformance.toFixed(1)}%
                  </div>
                </div>

                {/* Performance Chart */}
                <div className="h-[200px]">
                  <Line
                    data={performanceChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          backgroundColor: 'rgb(30, 41, 59)',
                          titleColor: 'rgb(255, 255, 255)',
                          bodyColor: 'rgb(203, 213, 225)',
                          borderColor: 'rgb(71, 85, 105)',
                          borderWidth: 1,
                        },
                      },
                      scales: {
                        x: {
                          grid: {
                            color: 'rgba(71, 85, 105, 0.3)',
                          },
                          ticks: {
                            color: 'rgb(148, 163, 184)',
                          },
                        },
                        y: {
                          grid: {
                            color: 'rgba(71, 85, 105, 0.3)',
                          },
                          ticks: {
                            color: 'rgb(148, 163, 184)',
                            callback: (value) => 'CHF ' + value.toLocaleString('de-CH'),
                          },
                        },
                      },
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Holdings Table */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-xl">Holdings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-2 text-slate-400 font-medium">Asset</th>
                        <th className="text-right py-3 px-2 text-slate-400 font-medium">Price</th>
                        <th className="text-right py-3 px-2 text-slate-400 font-medium">Change</th>
                        <th className="text-right py-3 px-2 text-slate-400 font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolioMetrics.holdings.map((holding, idx) => (
                        <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-3">
                              <StockLogo ticker={holding.ticker} companyName={holding.companyName} size="sm" />
                              <div>
                                <div className="text-white font-medium">{holding.companyName}</div>
                                <div className="text-slate-400 text-sm">{holding.ticker}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-right py-3 px-2 text-white">
                            {holding.currency} {holding.price.toFixed(2)}
                          </td>
                          <td className={`text-right py-3 px-2 ${holding.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {holding.change >= 0 ? '^' : ''}{holding.change.toFixed(2)}%
                          </td>
                          <td className="text-right py-3 px-2 text-white">
                            CHF {holding.value.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Asset Allocation */}
          <div className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-xl">Asset Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center">
                  <Doughnut
                    data={allocationChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          backgroundColor: 'rgb(30, 41, 59)',
                          titleColor: 'rgb(255, 255, 255)',
                          bodyColor: 'rgb(203, 213, 225)',
                          borderColor: 'rgb(71, 85, 105)',
                          borderWidth: 1,
                          callbacks: {
                            label: (context) => {
                              const label = context.label || '';
                              const value = context.parsed || 0;
                              const percentage = ((value / portfolioMetrics.totalValue) * 100).toFixed(1);
                              return `${label}: ${percentage}%`;
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>

                {/* Legend */}
                <div className="mt-6 space-y-2">
                  {portfolioMetrics.sectorAllocation.map((sector, idx) => {
                    const colors = [
                      'bg-blue-500',
                      'bg-purple-500',
                      'bg-pink-500',
                      'bg-orange-500',
                      'bg-green-500',
                    ];
                    return (
                      <div key={sector.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${colors[idx % colors.length]}`}></div>
                          <span className="text-slate-300">{sector.name}</span>
                        </div>
                        <span className="text-white font-medium">{sector.percentage.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Edit Portfolio Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Portfolio bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-300 mb-2 block">Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-2 block">Beschreibung</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white"
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                className="border-slate-600 text-white hover:bg-slate-700"
              >
                Abbrechen
              </Button>
              <Button onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-700">
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
