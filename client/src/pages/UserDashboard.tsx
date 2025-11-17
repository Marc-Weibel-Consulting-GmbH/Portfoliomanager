import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { PlusCircle, TrendingUp, TrendingDown, DollarSign, PieChart, Calendar } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function UserDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);

  // Fetch user's portfolios
  const { data: portfolios = [], isLoading } = trpc.savedPortfolios.list.useQuery();

  // Select first portfolio by default
  const selectedPortfolio = selectedPortfolioId 
    ? portfolios.find(p => p.id === selectedPortfolioId)
    : portfolios[0];

  // Parse portfolio data
  const portfolioData = selectedPortfolio?.portfolioData 
    ? JSON.parse(selectedPortfolio.portfolioData) 
    : null;

  // Calculate portfolio metrics
  const totalValue = portfolioData?.stocks?.reduce((sum: number, stock: any) => {
    const price = parseFloat(stock.currentPrice || '0');
    const shares = parseFloat(stock.shares || '0');
    return sum + (price * shares);
  }, 0) || 0;

  const livePerformance = selectedPortfolio?.livePerformance 
    ? parseFloat(selectedPortfolio.livePerformance) 
    : 0;

  const isPositivePerformance = livePerformance >= 0;

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
    <div className="space-y-6">
      {/* Header with Portfolio Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Übersicht Ihrer Portfolio-Performance
          </p>
        </div>
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
                  {portfolio.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Portfolio Wert
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              CHF {totalValue.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {portfolioData?.stocks?.length || 0} Positionen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Performance
            </CardTitle>
            {isPositivePerformance ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isPositivePerformance ? 'text-green-600' : 'text-red-600'}`}>
              {isPositivePerformance ? '+' : ''}{livePerformance.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedPortfolio?.isLive ? 'Live-Tracking' : 'Test-Modus'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Portfolio Typ
            </CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {selectedPortfolio?.portfolioType || 'Balanced'}
            </div>
            <p className="text-xs text-muted-foreground">
              Strategie
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Erstellt am
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {selectedPortfolio?.createdAt 
                ? new Date(selectedPortfolio.createdAt).toLocaleDateString('de-CH')
                : '-'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Datum
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Holdings */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Positionen</CardTitle>
          <CardDescription>
            Aktuelle Zusammensetzung Ihres Portfolios
          </CardDescription>
        </CardHeader>
        <CardContent>
          {portfolioData?.stocks && portfolioData.stocks.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-5 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                <div>Ticker</div>
                <div>Unternehmen</div>
                <div className="text-right">Aktien</div>
                <div className="text-right">Kurs</div>
                <div className="text-right">Wert</div>
              </div>
              {portfolioData.stocks.map((stock: any, index: number) => {
                const price = parseFloat(stock.currentPrice || '0');
                const shares = parseFloat(stock.shares || '0');
                const value = price * shares;
                
                return (
                  <div key={index} className="grid grid-cols-5 gap-4 text-sm items-center py-2 border-b last:border-0">
                    <div className="font-medium">{stock.ticker}</div>
                    <div className="text-muted-foreground truncate">{stock.companyName}</div>
                    <div className="text-right">{shares.toFixed(0)}</div>
                    <div className="text-right">
                      {stock.currency || 'CHF'} {price.toFixed(2)}
                    </div>
                    <div className="text-right font-medium">
                      CHF {value.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Keine Positionen im Portfolio
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button onClick={() => setLocation('/optimizer')}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Neues Portfolio erstellen
        </Button>
        {selectedPortfolio && (
          <Button 
            variant="outline"
            onClick={() => setLocation(`/portfolio/${selectedPortfolio.id}`)}
          >
            Portfolio Details anzeigen
          </Button>
        )}
      </div>
    </div>
  );
}
