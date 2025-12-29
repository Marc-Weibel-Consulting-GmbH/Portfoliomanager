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
import { ArrowLeft, TrendingUp, TrendingDown, Play } from "lucide-react";
import { toast } from "sonner";
import { StockLogo } from "@/components/StockLogo";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#06b6d4", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#6366f1"];

export default function PortfolioDetailRedesign() {
  const [, params] = useRoute<{ id: string }>("/portfolio/:id");
  const [, setLocation] = useLocation();
  const portfolioId = params?.id ? parseInt(params.id) : null;

  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
  const [startCapital, setStartCapital] = useState("");
  const [selectedBenchmark, setSelectedBenchmark] = useState<"SMI" | "SP500" | "MSCI_WORLD">("SMI");

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

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Lädt Portfolio-Details...</div>
      </div>
    );
  }

  if (!portfolioDetails) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Portfolio nicht gefunden</div>
      </div>
    );
  }

  const { portfolio, holdings, transactions, metrics } = portfolioDetails;
  const isLive = portfolio.status === "live";

  // Prepare chart data for performance
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

  // Prepare asset allocation data
  const allocationData = useMemo(() => {
    if (!holdings || holdings.length === 0) return [];

    return holdings.map((holding: any) => ({
      name: holding.ticker,
      value: parseFloat(holding.weight || "0"),
    }));
  }, [holdings]);

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <TableHead>Aktie</TableHead>
                  <TableHead className="text-right">Gewichtung</TableHead>
                  <TableHead className="text-right">Aktueller Preis</TableHead>
                  {isLive && <TableHead className="text-right">Anteile</TableHead>}
                  {isLive && <TableHead className="text-right">Wert (CHF)</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings.map((holding: any) => (
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
                    <TableCell className="text-right">{holding.weight}%</TableCell>
                    <TableCell className="text-right">
                      {holding.currentPrice} {holding.currency}
                    </TableCell>
                    {isLive && (
                      <>
                        <TableCell className="text-right">{holding.shares || "0"}</TableCell>
                        <TableCell className="text-right">
                          {(
                            parseFloat(holding.shares || "0") *
                            parseFloat(holding.currentPrice || "0")
                          ).toFixed(2)}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
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
