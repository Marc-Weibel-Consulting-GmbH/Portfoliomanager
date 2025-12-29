import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, TrendingUp, TrendingDown, Briefcase, Eye, Trash2, Calendar } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Portfolios() {
  const [, setLocation] = useLocation();
  
  // Fetch portfolios from database
  const { data: portfolios = [], refetch, isLoading } = trpc.portfolios.list.useQuery();
  const deleteMutation = trpc.portfolios.delete.useMutation({
    onSuccess: () => {
      toast.success('Portfolio gelöscht');
      refetch();
    },
    onError: (error) => {
      toast.error('Fehler beim Löschen', { description: error.message });
    }
  });

  // Calculate summary statistics
  const totalPortfolios = portfolios.length;
  const livePortfolios = portfolios.filter((p: any) => p.isLive).length;
  
  // Calculate total value and performance from live portfolios
  let totalValue = 0;
  let totalPerformance = 0;
  let performanceCount = 0;
  
  portfolios.forEach((portfolio: any) => {
    if (portfolio.isLive && portfolio.portfolioData) {
      try {
        const data = JSON.parse(portfolio.portfolioData);
        if (data.totalValue) {
          totalValue += parseFloat(data.totalValue);
        }
        if (data.performance !== undefined) {
          totalPerformance += parseFloat(data.performance);
          performanceCount++;
        }
      } catch (error) {
        console.error('Error parsing portfolio data:', error);
      }
    }
  });
  
  const avgPerformance = performanceCount > 0 ? totalPerformance / performanceCount : 0;

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Möchten Sie das Portfolio "${name}" wirklich löschen?`)) {
      return;
    }
    await deleteMutation.mutateAsync({ id });
  };

  const handleViewPortfolio = (portfolio: any) => {
    // Navigate to portfolio detail page for both Live and Test portfolios
    setLocation(`/portfolio/${portfolio.id}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Portfolios</h1>
            <p className="text-muted-foreground mt-1">
              Verwalten Sie Ihre Anlageportfolios
            </p>
          </div>
          <Button
            onClick={() => setLocation("/portfolio-builder/new")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Neues Portfolio
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Gesamt-Portfolios
              </CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPortfolios}</div>
              <p className="text-xs text-muted-foreground">
                {livePortfolios} Live, {totalPortfolios - livePortfolios} Test
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Gesamtwert
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                CHF {totalValue.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Live Portfolios
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Performance
              </CardTitle>
              {avgPerformance >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${avgPerformance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {avgPerformance >= 0 ? '+' : ''}{avgPerformance.toFixed(2)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Durchschnittlich
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Portfolios List */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Lade Portfolios...</p>
            </CardContent>
          </Card>
        ) : portfolios.length === 0 ? (
          /* Empty State */
          <Card>
            <CardHeader>
              <CardTitle>Ihre Portfolios</CardTitle>
              <CardDescription>
                Erstellen Sie Ihr erstes Portfolio, um zu beginnen
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Briefcase className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Noch keine Portfolios</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                Beginnen Sie mit der Erstellung Ihres ersten Portfolios, um Ihre Investitionen zu verfolgen und zu analysieren.
              </p>
              <Button
                onClick={() => setLocation("/portfolio-builder/new")}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Portfolio erstellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Portfolios Grid */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {portfolios.map((portfolio: any) => {
              let portfolioData: any = {};
              let stocks: any[] = [];
              
              try {
                portfolioData = JSON.parse(portfolio.portfolioData);
                stocks = Array.isArray(portfolioData) ? portfolioData : (portfolioData.stocks || []);
              } catch (error) {
                console.error('Error parsing portfolio data:', error);
              }

              const totalValue = portfolioData.totalValue || 0;
              const performance = portfolioData.performance || 0;
              const stockCount = stocks.length;

              return (
                <Card key={portfolio.id} className="hover:border-primary/50 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {portfolio.name}
                          {portfolio.isLive && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-500">
                              Live
                            </span>
                          )}
                          {!portfolio.isLive && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-500">
                              Test
                            </span>
                          )}
                        </CardTitle>
                        {portfolio.description && (
                          <CardDescription className="mt-1">
                            {portfolio.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Portfolio Stats */}
                      {portfolio.isLive && (
                        <>
                          <div>
                            <p className="text-sm text-muted-foreground">Gesamtwert</p>
                            <p className="text-xl font-bold">
                              CHF {parseFloat(totalValue).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Performance</p>
                            <p className={`text-lg font-semibold ${performance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {performance >= 0 ? '+' : ''}{parseFloat(performance).toFixed(2)}%
                            </p>
                          </div>
                        </>
                      )}
                      
                      <div>
                        <p className="text-sm text-muted-foreground">Positionen</p>
                        <p className="text-lg font-semibold">{stockCount} Aktien</p>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Erstellt: {new Date(portfolio.createdAt).toLocaleDateString('de-DE')}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={() => handleViewPortfolio(portfolio)}
                          variant="default"
                          size="sm"
                          className="flex-1"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ansehen
                        </Button>
                        <Button
                          onClick={() => handleDelete(portfolio.id, portfolio.name)}
                          variant="outline"
                          size="sm"
                          className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
