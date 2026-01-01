import { useState, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Calendar, PieChart, Activity, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { StockLogo } from "@/components/StockLogo";
import { RealizedGainsTable } from "@/components/RealizedGainsTable";
import { CostFeesReport } from "@/components/CostFeesReport";

export default function PortfolioDetail() {
  const [, params] = useRoute<{ id: string }>("/portfolio/:id");
  const portfolioId = params?.id ? parseInt(params.id) : null;
  
  // Edit position modal state
  const [isEditPositionOpen, setIsEditPositionOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<any>(null);
  const [editShares, setEditShares] = useState("");
  const [editEntryPrice, setEditEntryPrice] = useState("");

  // Fetch portfolio details
  const { data: portfolios = [], isLoading: portfoliosLoading } = trpc.portfolios.list.useQuery();
  const portfolio = portfolios.find((p: any) => p.id === portfolioId);

  // Fetch transactions
  const { data: transactions = [] } = trpc.portfolioTransactions.list.useQuery(
    { portfolioId: portfolioId! },
    { enabled: !!portfolioId }
  );

  // Fetch realized gains with detailed breakdown
  const { data: realizedGainsDetailed = [] } = trpc.realizedGainsHistory.getAll.useQuery(
    { portfolioId: portfolioId! },
    { enabled: !!portfolioId }
  );

  // Calculate simple total for the summary card
  const realizedGainsTotal = useMemo(() => {
    return realizedGainsDetailed.reduce((sum, g) => sum + g.totalGain, 0);
  }, [realizedGainsDetailed]);

  // Get unique tickers from transactions
  const uniqueTickers = useMemo(() => {
    const tickers = new Set<string>();
    transactions.forEach((tx: any) => {
      if (tx.ticker) tickers.add(tx.ticker);
    });
    return Array.from(tickers);
  }, [transactions]);

  // Fetch stocks
  const { data: portfolioStocks = [] } = trpc.stocks.getAll.useQuery(undefined, {
    enabled: uniqueTickers.length > 0
  });

  const allStocks = useMemo(() => {
    return portfolioStocks.filter((s: any) => uniqueTickers.includes(s.ticker));
  }, [portfolioStocks, uniqueTickers]);

  // Calculate holdings from transactions
  const holdingsByTicker = useMemo(() => {
    const holdings: Record<string, { shares: number; totalInvested: number; avgBuyPrice: number }> = {};
    
    transactions.forEach((tx: any) => {
      if (!holdings[tx.ticker]) {
        holdings[tx.ticker] = { shares: 0, totalInvested: 0, avgBuyPrice: 0 };
      }
      
      const shares = parseFloat(tx.shares || '0');
      const price = parseFloat(tx.pricePerShare || '0');
      const amount = parseFloat(tx.totalAmount || '0') || (shares * price);
      
      if (tx.transactionType === 'buy') {
        holdings[tx.ticker].shares += shares;
        holdings[tx.ticker].totalInvested += amount;
        holdings[tx.ticker].avgBuyPrice = holdings[tx.ticker].totalInvested / holdings[tx.ticker].shares;
      } else if (tx.transactionType === 'sell') {
        holdings[tx.ticker].shares -= shares;
        const costBasis = shares * holdings[tx.ticker].avgBuyPrice;
        holdings[tx.ticker].totalInvested -= costBasis;
      }
    });
    
    return holdings;
  }, [transactions]);

  // Calculate portfolio data
  const portfolioData = useMemo(() => {
    return Object.entries(holdingsByTicker)
      .filter(([_, holding]) => holding.shares > 0)
      .map(([ticker, holding]) => {
        const stock = allStocks.find((s: any) => s.ticker === ticker);
        const currentPrice = stock?.currentPrice || 0;
        const currentValue = holding.shares * currentPrice;
        const performance = holding.totalInvested > 0 
          ? ((currentValue - holding.totalInvested) / holding.totalInvested) * 100 
          : 0;

        return {
          ticker,
          name: stock?.name || ticker,
          shares: holding.shares,
          avgBuyPrice: holding.avgBuyPrice,
          currentPrice,
          totalInvested: holding.totalInvested,
          currentValue,
          performance,
          dividendYield: stock?.dividendYield || 0,
          ytdPerformance: stock?.ytdPerformance || 0,
          sector: stock?.sector || 'Unknown',
          weight: 0 // Will be calculated after totalValue is known
        };
      })
      .sort((a, b) => b.currentValue - a.currentValue);
  }, [holdingsByTicker, allStocks]);

  // Calculate totals
  const totalInvested = portfolioData.reduce((sum, pos) => sum + pos.totalInvested, 0);
  const totalValue = portfolioData.reduce((sum, pos) => sum + pos.currentValue, 0);
  const totalPerformance = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;
  const totalPerformanceAmount = totalValue - totalInvested;
  const avgDividendYield = portfolioData.length > 0
    ? portfolioData.reduce((sum, pos) => sum + (pos.dividendYield * pos.currentValue / totalValue), 0)
    : 0;
  
  // Calculate weight for each position
  portfolioData.forEach(pos => {
    pos.weight = totalValue > 0 ? (pos.currentValue / totalValue) * 100 : 0;
  });

  // Calculate sector allocation
  const sectorAllocation = useMemo(() => {
    const sectors: Record<string, number> = {};
    portfolioData.forEach(pos => {
      sectors[pos.sector] = (sectors[pos.sector] || 0) + pos.currentValue;
    });
    return Object.entries(sectors)
      .map(([sector, value]) => ({
        sector,
        value,
        percentage: (value / totalValue) * 100
      }))
      .sort((a, b) => b.value - a.value);
  }, [portfolioData, totalValue]);

  if (portfoliosLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Lädt Portfolio...</p>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Portfolio nicht gefunden</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zurück
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-foreground">{portfolio.name}</h1>
                {portfolio.isLive ? (
                  <Badge variant="default" className="bg-[#00CFC1]/20 text-[#00CFC1] border-[#00CFC1]/30">
                    <Activity className="w-3 h-3 mr-1" />
                    Live
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-gray-600 text-gray-400">
                    Test
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm mt-1">
                {portfolioData.length} Position{portfolioData.length !== 1 ? 'en' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="live-toggle" className="text-sm text-muted-foreground cursor-pointer">
                Live-Tracking
              </Label>
              <Switch 
                id="live-toggle"
                checked={portfolio.isLive === 1}
                onCheckedChange={async (checked) => {
                  try {
                    await trpc.portfolios.toggleLive.mutate({ 
                      id: portfolioId!, 
                      isLive: checked 
                    });
                    toast.success(checked ? 'Live-Tracking aktiviert' : 'Live-Tracking deaktiviert');
                    // Refetch portfolio data
                    window.location.reload();
                  } catch (error: any) {
                    console.error('[Live Toggle] Error:', error);
                    const errorMessage = error?.message || 'Fehler beim Aktualisieren des Live-Status';
                    toast.error(errorMessage);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Gesamtwert
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                CHF {totalValue.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Investiert: CHF {totalInvested.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${totalPerformance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {totalPerformance >= 0 ? '+' : ''}{totalPerformance.toFixed(2)}%
              </p>
              <p className={`text-xs mt-1 ${totalPerformanceAmount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {totalPerformanceAmount >= 0 ? '+' : ''}CHF {Math.abs(totalPerformanceAmount).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Ø Dividende
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-500">
                {avgDividendYield.toFixed(2)}%
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                Sektoren
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {sectorAllocation.length}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Realisierte Gewinne
              </CardTitle>
            </CardHeader>
            <CardContent>
              {realizedGainsDetailed.length > 0 ? (
                <>
                  <p className={`text-2xl font-bold ${
                    realizedGainsTotal >= 0 
                      ? 'text-green-500' 
                      : 'text-red-500'
                  }`}>
                    {realizedGainsTotal >= 0 ? '+' : ''}
                    CHF {Math.abs(realizedGainsTotal).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {realizedGainsDetailed.length} Transaktion{realizedGainsDetailed.length !== 1 ? 'en' : ''}
                  </p>
                </>
              ) : (
                <p className="text-2xl font-bold text-muted-foreground">-</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Holdings Table */}
        <Card className="border-border/50 mb-8">
          <CardHeader>
            <CardTitle>Positionen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Aktie</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Stückzahl</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Ø Kaufpreis</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Aktueller Kurs</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Wert (CHF)</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Performance</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Dividende</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Gewicht</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioData.map((position) => (
                    <tr key={position.ticker} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <StockLogo ticker={position.ticker} size="sm" />
                          <div>
                            <p className="font-medium text-foreground">{position.ticker}</p>
                            <p className="text-xs text-muted-foreground">{position.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 text-foreground">
                        {position.shares.toFixed(2)}
                      </td>
                      <td className="text-right py-3 px-4 text-foreground">
                        CHF {position.avgBuyPrice.toFixed(2)}
                      </td>
                      <td className="text-right py-3 px-4 text-foreground">
                        CHF {position.currentPrice.toFixed(2)}
                      </td>
                      <td className="text-right py-3 px-4 font-medium text-foreground">
                        CHF {position.currentValue.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={`text-right py-3 px-4 font-medium ${position.performance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        <div className="flex items-center justify-end gap-1">
                          {position.performance >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          {position.performance >= 0 ? '+' : ''}{position.performance.toFixed(2)}%
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 text-green-500">
                        {position.dividendYield.toFixed(2)}%
                      </td>
                      <td className="text-right py-3 px-4 text-foreground">
                        {position.weight.toFixed(2)}%
                      </td>
                      <td className="text-right py-3 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingPosition(position);
                            setEditShares(position.shares.toString());
                            setEditEntryPrice(position.avgBuyPrice.toString());
                            setIsEditPositionOpen(true);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Sector Allocation */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Sektor-Allokation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sectorAllocation.map((sector) => (
                <div key={sector.sector}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{sector.sector}</span>
                    <span className="text-sm text-muted-foreground">
                      {sector.percentage.toFixed(1)}% · CHF {sector.value.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${sector.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Reports Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="realized-gains">Realisierte Gewinne</TabsTrigger>
          <TabsTrigger value="costs-fees">Kosten & Gebühren</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <Card className="border-border/50">
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
          {realizedGainsDetailed.length > 0 ? (
            <RealizedGainsTable gains={realizedGainsDetailed} />
          ) : (
            <Card className="border-border/50">
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
            <Card className="border-border/50">
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

      {/* Edit Position Dialog */}
      <Dialog open={isEditPositionOpen} onOpenChange={setIsEditPositionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Position bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeiten Sie die Anzahl Aktien und den Einstandspreis für {editingPosition?.ticker}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-shares">Anzahl Aktien</Label>
              <Input
                id="edit-shares"
                type="number"
                step="0.01"
                value={editShares}
                onChange={(e) => setEditShares(e.target.value)}
                placeholder="z.B. 10.5"
              />
            </div>
            <div>
              <Label htmlFor="edit-entry-price">Einstandspreis (CHF)</Label>
              <Input
                id="edit-entry-price"
                type="number"
                step="0.01"
                value={editEntryPrice}
                onChange={(e) => setEditEntryPrice(e.target.value)}
                placeholder="z.B. 150.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditPositionOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={async () => {
                if (!editingPosition || !portfolioId) return;
                
                try {
                  // Calculate the difference and create adjustment transactions
                  const currentShares = editingPosition.shares;
                  const newShares = parseFloat(editShares);
                  const sharesDiff = newShares - currentShares;
                  
                  const newEntryPrice = parseFloat(editEntryPrice);
                  
                  if (sharesDiff !== 0) {
                    // Create buy or sell transaction to adjust shares
                    const transactionType = sharesDiff > 0 ? 'buy' : 'sell';
                    const absShares = Math.abs(sharesDiff);
                    
                    await trpc.portfolioTransactions.create.mutate({
                      portfolioId: portfolioId,
                      transactionType: transactionType,
                      ticker: editingPosition.ticker,
                      shares: absShares.toString(),
                      pricePerShare: newEntryPrice.toString(),
                      currency: 'CHF',
                      totalAmount: (absShares * newEntryPrice).toString(),
                      totalAmountCHF: (absShares * newEntryPrice).toString(),
                      fees: '0',
                      transactionDate: new Date(),
                      notes: 'Manuelle Anpassung der Position',
                    });
                  }
                  
                  toast.success('Position erfolgreich aktualisiert');
                  setIsEditPositionOpen(false);
                  window.location.reload();
                } catch (error) {
                  toast.error('Fehler beim Aktualisieren der Position');
                }
              }}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
