import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, TrendingDown, Calendar, Trash2, Edit2 } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function PortfolioBuilder() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: savedPortfolios = [], refetch } = trpc.savedPortfolios.list.useQuery();
  const deleteMutation = trpc.savedPortfolios.delete.useMutation();

  if (!user) {
    return null;
  }

  const handleDelete = async (id: number, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Möchten Sie das Portfolio "${name}" wirklich löschen?`)) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Gelöscht', { description: `Portfolio "${name}" wurde gelöscht` });
      refetch();
    } catch (error) {
      console.error('Failed to delete portfolio:', error);
      toast.error('Fehler', { description: 'Portfolio konnte nicht gelöscht werden' });
    }
  };

  const handlePortfolioClick = (portfolio: any) => {
    if (portfolio.isLive) {
      // For LIVE portfolios: Navigate to detail page
      setLocation(`/portfolio/${portfolio.id}`);
    } else {
      // For TEST portfolios: Navigate to optimizer with portfolio data
      setLocation(`/home?loadPortfolio=${portfolio.id}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Portfolio Builder</h1>
            <p className="text-muted-foreground mt-1">
              Erstellen und verwalten Sie Ihre Portfolios
            </p>
          </div>
          <Button onClick={() => setLocation("/home")} size="lg">
            <Plus className="mr-2 h-5 w-5" />
            Neues Portfolio erstellen
          </Button>
        </div>

        {/* Portfolio Grid */}
        {savedPortfolios.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-muted p-4 mb-4">
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Noch keine Portfolios</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Erstellen Sie Ihr erstes Portfolio mit dem Portfolio Optimizer und beginnen Sie mit der Analyse.
              </p>
              <Button onClick={() => setLocation("/home")}>
                <Plus className="mr-2 h-4 w-4" />
                Erstes Portfolio erstellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedPortfolios.map((portfolio: any) => {
              const data = JSON.parse(portfolio.portfolioData);
              const stocks = data.stocks || [];
              const totalValue = stocks.reduce((sum: number, stock: any) => {
                return sum + parseFloat(stock.investmentAmount || stock.totalInvested || '0');
              }, 0);
              
              const livePerf = portfolio.livePerformance;
              const hasLivePerf = typeof livePerf === 'number' && !isNaN(livePerf);

              return (
                <Card 
                  key={portfolio.id} 
                  className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50"
                  onClick={() => handlePortfolioClick(portfolio)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="truncate">{portfolio.name}</CardTitle>
                        {portfolio.description && (
                          <CardDescription className="mt-1 line-clamp-2">
                            {portfolio.description}
                          </CardDescription>
                        )}
                      </div>
                      <Badge variant={portfolio.isLive ? "default" : "secondary"} className="ml-2 shrink-0">
                        {portfolio.isLive ? "LIVE" : "TEST"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Portfolio Stats */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Positionen</p>
                          <p className="text-lg font-semibold">{stocks.length}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Wert</p>
                          <p className="text-lg font-semibold">
                            CHF {totalValue.toLocaleString('de-CH', { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>

                      {/* Live Performance */}
                      {portfolio.isLive && hasLivePerf && (
                        <div className="pt-4 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Live Performance</span>
                            <div className="flex items-center gap-1">
                              {livePerf >= 0 ? (
                                <TrendingUp className="h-4 w-4 text-green-500" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-500" />
                              )}
                              <span className={`text-lg font-bold ${livePerf >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {livePerf >= 0 ? '+' : ''}{livePerf.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Creation Date */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                        <Calendar className="h-3 w-3" />
                        <span>Erstellt: {new Date(portfolio.createdAt).toLocaleDateString('de-DE')}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePortfolioClick(portfolio);
                          }}
                        >
                          {portfolio.isLive ? 'Details' : 'Laden'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleDelete(portfolio.id, portfolio.name, e)}
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
