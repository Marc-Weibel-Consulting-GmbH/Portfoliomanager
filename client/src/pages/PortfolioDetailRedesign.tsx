import { useState, useMemo } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, TrendingUp, TrendingDown, Play, Share2, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { StockLogo } from "@/components/StockLogo";
import { RealizedGainsTable } from "@/components/RealizedGainsTable";
import { CostFeesReport } from "@/components/CostFeesReport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#06b6d4", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#6366f1"];

export default function PortfolioDetailRedesign() {
  const [, params] = useRoute<{ id: string }>("/portfolio/:id");
  const [, setLocation] = useLocation();
  const portfolioId = params?.id ? parseInt(params.id) : null;

  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
  const [startCapital, setStartCapital] = useState("");
  const [selectedBenchmark, setSelectedBenchmark] = useState<"SMI" | "SP500" | "MSCI_WORLD">("SMI");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const utils = trpc.useUtils();

  // Fetch portfolio details with new endpoint
  const { data: portfolioDetails, isLoading } = trpc.portfolioManagement.getPortfolioDetails.useQuery(
    { portfolioId: portfolioId! },
    { enabled: !!portfolioId }
  );

  // Fetch benchmark data if portfolio has benchmark selected
  const { data: benchmarkData = [] } = trpc.portfolioManagement.getBenchmarkData.useQuery(
    {
      benchmark: portfolioDetails?.portfolio?.benchmark || selectedBenchmark,
      startDate: portfolioDetails?.portfolio?.liveStartDate
        ? new Date(portfolioDetails.portfolio.liveStartDate).toISOString().split("T")[0]
        : undefined,
    },
    {
      enabled: !!portfolioDetails?.portfolio?.benchmark || !!portfolioDetails?.portfolio?.liveStartDate,
    }
  );

  // Activate portfolio mutation
  const activatePortfolio = trpc.portfolioManagement.activatePortfolio.useMutation({
    onSuccess: (data) => {
      toast.success(`Portfolio aktiviert! ${data.transactionsCreated} Transaktionen erstellt.`);
      setIsActivationModalOpen(false);
      utils.portfolioManagement.getPortfolioDetails.invalidate();
      utils.portfolios.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Fehler beim Aktivieren: ${error.message}`);
    },
  });

  const handleActivatePortfolio = () => {
    if (!portfolioId || !startCapital) {
      toast.error("Bitte Startkapital eingeben");
      return;
    }

    activatePortfolio.mutate({
      portfolioId,
      startCapital,
      benchmark: selectedBenchmark,
    });
  };

  // Extract data safely for hooks (must be before any early returns)
  const portfolio = portfolioDetails?.portfolio;
  const holdings = portfolioDetails?.holdings;
  const transactions = portfolioDetails?.transactions || [];
  const metrics = portfolioDetails?.metrics;
  const isLive = portfolio?.status === "live";

  // Fetch realized gains
  const { data: realizedGains = [] } = trpc.realizedGainsHistory.getAll.useQuery(
    { portfolioId: portfolioId! },
    { enabled: !!portfolioId }
  );

  // Prepare chart data for performance (must be before early returns)
  const performanceChartData = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    // Group transactions by date and calculate cumulative value
    const dataByDate: Record<string, { date: string; value: number }> = {};

    transactions.forEach((tx: any) => {
      const date = new Date(tx.transactionDate).toISOString().split("T")[0];
      if (!dataByDate[date]) {
        dataByDate[date] = { date, value: 0 };
      }

      if (tx.transactionType === "buy") {
        dataByDate[date].value += parseFloat(tx.totalAmountCHF || "0");
      }
    });

    return Object.values(dataByDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions]);

  // Prepare asset allocation data (must be before early returns)
  const allocationData = useMemo(() => {
    if (!holdings || holdings.length === 0) return [];

    return holdings.map((holding: any) => ({
      name: holding.ticker,
      value: parseFloat(holding.weight || "0"),
    }));
  }, [holdings]);

  // Sort holdings based on selected column
  const sortedHoldings = useMemo(() => {
    if (!holdings || holdings.length === 0) return [];
    if (!sortColumn) return holdings;

    const sorted = [...holdings].sort((a: any, b: any) => {
      let aVal, bVal;
      
      switch (sortColumn) {
        case 'ticker':
          aVal = a.ticker || '';
          bVal = b.ticker || '';
          return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'shares':
          aVal = parseFloat(a.shares || a.quantity || '0');
          bVal = parseFloat(b.shares || b.quantity || '0');
          break;
        case 'weight':
          aVal = parseFloat(a.weight || '0');
          bVal = parseFloat(b.weight || '0');
          break;
        case 'price':
          aVal = parseFloat(a.currentPriceCHF || a.currentPrice || '0');
          bVal = parseFloat(b.currentPriceCHF || b.currentPrice || '0');
          break;
        case 'ytd':
          aVal = parseFloat(a.ytdPerformance || '0');
          bVal = parseFloat(b.ytdPerformance || '0');
          break;
        case 'dividend':
          aVal = parseFloat(a.dividendYield || '0');
          bVal = parseFloat(b.dividendYield || '0');
          break;
        default:
          return 0;
      }
      
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    return sorted;
  }, [holdings, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/portfolio/${portfolioId}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: portfolio?.name || 'Mein Portfolio',
          text: `Schau dir mein Portfolio an: ${portfolio?.name}`,
          url: shareUrl,
        });
        toast.success('Portfolio geteilt!');
      } catch (error) {
        // User cancelled or error occurred
        if ((error as Error).name !== 'AbortError') {
          copyToClipboard(shareUrl);
        }
      }
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Link in Zwischenablage kopiert!');
    }).catch(() => {
      toast.error('Fehler beim Kopieren');
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Lädt Portfolio-Details...</div>
      </div>
    );
  }

  if (!portfolioDetails || !portfolio) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Portfolio nicht gefunden</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/portfolios")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{portfolio.name}</h1>
            <p className="text-muted-foreground">{portfolio.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isLive ? "default" : "secondary"}>
            {isLive ? "Live" : "Geplant"}
          </Badge>
          <Button variant="outline" onClick={handleShare} className="gap-2">
            <Share2 className="h-4 w-4" />
            Teilen
          </Button>
          {!isLive && (
            <Button onClick={() => setIsActivationModalOpen(true)} className="gap-2">
              <Play className="h-4 w-4" />
              Portfolio aktivieren
            </Button>
          )}
        </div>
      </div>

      {/* Performance Chart */}
      {isLive && performanceChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  name="Portfolio Wert (CHF)"
                />
                {benchmarkData.length > 0 && (
                  <Line
                    type="monotone"
                    dataKey="benchmark"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    name={portfolio.benchmark || "Benchmark"}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      {isLive && metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Return
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                {parseFloat(metrics.totalReturn) >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )}
                {metrics.totalReturn}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">IRR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.irr}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Beta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.beta}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sharpe Ratio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.sharpeRatio}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Volatilität
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.volatility ? `${metrics.volatility}%` : 'N/A'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Div. Rendite
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.dividendYield ? `${metrics.dividendYield}%` : 'N/A'}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Holdings and Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Holdings Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('ticker')}>
                    <div className="flex items-center gap-1">
                      Aktie
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('shares')}>
                    <div className="flex items-center justify-end gap-1">
                      Stückzahl
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('weight')}>
                    <div className="flex items-center justify-end gap-1">
                      Gewicht
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Kurs (Lokal)</TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('price')}>
                    <div className="flex items-center justify-end gap-1">
                      Kurs (CHF)
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('ytd')}>
                    <div className="flex items-center justify-end gap-1">
                      YTD
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('dividend')}>
                    <div className="flex items-center justify-end gap-1">
                      Div. Rendite
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedHoldings.map((holding: any) => {
                  const shares = parseFloat(holding.shares || holding.quantity || "0");
                  const currentPrice = parseFloat(holding.currentPrice || "0");
                  const currentPriceCHF = parseFloat(holding.currentPriceCHF || holding.currentPrice || "0");
                  const ytdPerformance = parseFloat(holding.ytdPerformance || "0");
                  const dividendYield = parseFloat(holding.dividendYield || "0");
                  
                  return (
                    <TableRow key={holding.ticker} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <Link href={`/stock/${holding.ticker}`}>
                          <div className="flex items-center gap-2">
                            <StockLogo ticker={holding.ticker} companyName={holding.companyName} size="sm" />
                            <div>
                              <div className="font-medium text-primary hover:underline">{holding.ticker}</div>
                              <div className="text-sm text-muted-foreground">
                                {holding.companyName}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        {shares > 0 ? shares.toLocaleString('de-CH') : '-'}
                      </TableCell>
                      <TableCell className="text-right">{holding.weight}%</TableCell>
                      <TableCell className="text-right">
                        {holding.currency || 'CHF'} {currentPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        CHF {currentPriceCHF.toFixed(2)}
                      </TableCell>
                      <TableCell className={`text-right ${ytdPerformance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {ytdPerformance >= 0 ? '+' : ''}{ytdPerformance.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right">
                        {dividendYield.toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Asset Allocation Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Asset Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={(entry) => `${entry.name} ${entry.value}%`}
                >
                  {allocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Additional Reports Tabs */}
      <Tabs defaultValue="overview" className="w-full mt-8">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="realized-gains">Realisierte Gewinne</TabsTrigger>
          <TabsTrigger value="costs-fees">Kosten & Gebühren</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio-Übersicht</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Wählen Sie einen der Tabs oben, um detaillierte Berichte zu Ihren realisierten Gewinnen oder Kosten & Gebühren anzuzeigen.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="realized-gains">
          {realizedGains.length > 0 ? (
            <RealizedGainsTable gains={realizedGains} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Keine realisierten Gewinne</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Es wurden noch keine Verkaufstransaktionen erfasst.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="costs-fees">
          {transactions.length > 0 ? (
            <CostFeesReport transactions={transactions} portfolioId={portfolioId!} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Keine Transaktionen</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Es wurden noch keine Transaktionen erfasst.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Activation Modal */}
      <Dialog open={isActivationModalOpen} onOpenChange={setIsActivationModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Portfolio aktivieren</DialogTitle>
            <DialogDescription>
              Geben Sie Ihr Startkapital ein, um das Portfolio zu aktivieren. Es werden automatisch
              Kauf-Transaktionen basierend auf den Gewichtungen erstellt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="startCapital">Startkapital (CHF)</Label>
              <Input
                id="startCapital"
                type="number"
                placeholder="z.B. 10000"
                value={startCapital}
                onChange={(e) => setStartCapital(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="benchmark">Benchmark (optional)</Label>
              <Select value={selectedBenchmark} onValueChange={(v: any) => setSelectedBenchmark(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SMI">SMI</SelectItem>
                  <SelectItem value="SP500">S&P 500</SelectItem>
                  <SelectItem value="MSCI_WORLD">MSCI World</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActivationModalOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleActivatePortfolio} disabled={activatePortfolio.isPending}>
              {activatePortfolio.isPending ? "Aktiviere..." : "Aktivieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
