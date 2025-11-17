import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { PlusCircle, Edit, Eye, Settings2 } from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
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

export default function UserDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Fetch user's portfolios
  const { data: portfolios = [], isLoading, refetch: refetchPortfolios } = trpc.savedPortfolios.list.useQuery();

  // Mutations
  const toggleLiveMutation = trpc.savedPortfolios.toggleLive.useMutation({
    onSuccess: () => {
      refetchPortfolios();
      toast.success('Modus geändert');
    },
    onError: (error) => {
      toast.error('Fehler: ' + error.message);
    },
  });

  const updatePortfolioMutation = trpc.savedPortfolios.update.useMutation({
    onSuccess: () => {
      refetchPortfolios();
      toast.success('Portfolio aktualisiert');
      setIsEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Fehler: ' + error.message);
    },
  });

  // Select first portfolio by default
  const selectedPortfolio = useMemo(() => {
    if (selectedPortfolioId) {
      return portfolios.find(p => p.id === selectedPortfolioId);
    }
    return portfolios[0];
  }, [selectedPortfolioId, portfolios]);

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

  // Chart data for performance (mock historical data)
  const performanceChartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const baseValue = portfolioMetrics.totalValue * 0.88; // Start at 88% of current value
    const data = months.map((_, i) => {
      const progress = i / 11;
      const variance = Math.sin(progress * Math.PI * 2) * 0.05; // Add some variance
      return baseValue + (portfolioMetrics.totalValue - baseValue) * progress + (portfolioMetrics.totalValue * variance);
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
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    };
  }, [portfolioMetrics.totalValue]);

  // Chart data for asset allocation
  const allocationChartData = useMemo(() => {
    const colors = [
      'rgb(59, 130, 246)',  // Health Care - blue
      'rgb(139, 92, 246)',  // Financials - purple  
      'rgb(236, 72, 153)',  // Consumer - pink
      'rgb(251, 146, 60)',  // Industrials - orange
      'rgb(34, 197, 94)',   // Other - green
    ];

    return {
      labels: portfolioMetrics.sectorAllocation.map(s => s.name),
      datasets: [
        {
          data: portfolioMetrics.sectorAllocation.map(s => s.value),
          backgroundColor: colors,
          borderColor: 'rgb(30, 41, 59)',
          borderWidth: 3,
        },
      ],
    };
  }, [portfolioMetrics.sectorAllocation]);

  const handleToggleLive = () => {
    if (!selectedPortfolio) return;
    toggleLiveMutation.mutate({
      id: selectedPortfolio.id,
      isLive: !selectedPortfolio.isLive,
      liveStartDate: !selectedPortfolio.isLive ? new Date() : undefined,
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

  // Empty state: No portfolios
  if (!isLoading && portfolios.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center space-y-6 max-w-md">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Willkommen!</h1>
            <p className="text-muted-foreground">
              Sie haben noch kein Portfolio erstellt. Erstellen Sie jetzt Ihr erstes Portfolio und beginnen Sie mit der Analyse.
            </p>
          </div>
          <Button 
            size="lg" 
            className="gap-2"
            onClick={() => setLocation('/optimizer')}
          >
            <PlusCircle className="h-5 w-5" />
            Neues Portfolio erstellen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-1 min-w-[300px]">
          <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
          {portfolios.length > 1 && (
            <Select
              value={selectedPortfolio?.id.toString()}
              onValueChange={(value) => setSelectedPortfolioId(parseInt(value))}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Portfolio auswählen" />
              </SelectTrigger>
              <SelectContent>
                {portfolios.map((portfolio) => (
                  <SelectItem key={portfolio.id} value={portfolio.id.toString()}>
                    {portfolio.name} {portfolio.isLive && '(LIVE)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setLocation('/optimizer')}
            variant="default"
            size="sm"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Neues Portfolio
          </Button>

          {selectedPortfolio && (
            <>
              <Button
                onClick={handleViewDetails}
                variant="outline"
                size="sm"
              >
                <Eye className="w-4 h-4 mr-2" />
                Portfoliodetails
              </Button>

              <Button
                onClick={handleEditPortfolio}
                variant="outline"
                size="sm"
              >
                <Edit className="w-4 h-4 mr-2" />
                Bearbeiten
              </Button>

              <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg">
                <span className="text-sm font-medium">
                  {selectedPortfolio.isLive ? 'LIVE' : 'TEST'}
                </span>
                <Switch
                  checked={selectedPortfolio.isLive}
                  onCheckedChange={handleToggleLive}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Portfolio Value & Holdings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Portfolio Value Card */}
          <Card className="bg-slate-800/50 border-slate-700/50">
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
                <div className={`text-lg mt-2 font-semibold ${portfolioMetrics.ytdPerformance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                          label: (context) => {
                            return 'CHF ' + context.parsed.y.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                          },
                        },
                      },
                    },
                    scales: {
                      x: {
                        grid: {
                          color: 'rgba(71, 85, 105, 0.2)',
                          drawBorder: false,
                        },
                        ticks: {
                          color: 'rgb(148, 163, 184)',
                          font: {
                            size: 11,
                          },
                        },
                      },
                      y: {
                        grid: {
                          color: 'rgba(71, 85, 105, 0.2)',
                          drawBorder: false,
                        },
                        ticks: {
                          color: 'rgb(148, 163, 184)',
                          font: {
                            size: 11,
                          },
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
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-white text-xl">Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-2 text-slate-400 font-medium text-sm">Asset</th>
                      <th className="text-right py-3 px-2 text-slate-400 font-medium text-sm">Price</th>
                      <th className="text-right py-3 px-2 text-slate-400 font-medium text-sm">Change</th>
                      <th className="text-right py-3 px-2 text-slate-400 font-medium text-sm">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioMetrics.holdings.map((holding, idx) => (
                      <tr key={idx} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-3">
                            <StockLogo ticker={holding.ticker} size="sm" />
                            <div>
                              <div className="text-white font-medium text-sm">{holding.companyName}</div>
                              <div className="text-slate-400 text-xs">{holding.ticker}</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-right py-3 px-2 text-white text-sm">
                          {holding.currency} {holding.price.toFixed(2)}
                        </td>
                        <td className={`text-right py-3 px-2 text-sm font-medium ${holding.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {holding.change >= 0 ? '^' : ''}{holding.change.toFixed(2)}%
                        </td>
                        <td className="text-right py-3 px-2 text-white text-sm font-medium">
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
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-white text-xl">Asset Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] flex items-center justify-center mb-6">
                <Doughnut
                  data={allocationChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
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
                        padding: 12,
                        displayColors: true,
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
              <div className="space-y-3">
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

      {/* Edit Portfolio Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Portfolio bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Beschreibung</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button onClick={handleSaveEdit}>
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
