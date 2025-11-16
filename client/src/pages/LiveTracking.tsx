import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { TrendingUp, TrendingDown, DollarSign, Activity } from "lucide-react";
import { useLocation } from "wouter";

export default function LiveTracking() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: savedPortfolios = [] } = trpc.savedPortfolios.list.useQuery();

  // Filter only LIVE portfolios
  const livePortfolios = savedPortfolios.filter((p: any) => p.isLive);

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Live Tracking</h1>
            <p className="text-muted-foreground mt-1">
              Echtzeit-Überwachung Ihrer aktiven Portfolios
            </p>
          </div>
        </div>

        {livePortfolios.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Keine Live-Portfolios</h3>
              <p className="text-muted-foreground mb-4">
                Aktivieren Sie Live-Tracking für ein Portfolio, um Echtzeit-Daten zu sehen.
              </p>
              <Button onClick={() => setLocation("/optimizer")}>
                Zu Portfolios
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {livePortfolios.map((portfolio: any) => {
              const data = JSON.parse(portfolio.portfolioData);
              const stocks = data.stocks || [];
              const livePerformance = portfolio.livePerformance || 0;
              const isPositive = livePerformance >= 0;

              return (
                <Card key={portfolio.id} className="hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => setLocation(`/portfolio/${portfolio.id}`)}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{portfolio.name}</CardTitle>
                      <div className={`flex items-center gap-2 text-lg font-bold ${
                        isPositive ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {isPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                        {isPositive ? '+' : ''}{livePerformance.toFixed(2)}%
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Aktien</p>
                        <p className="text-lg font-semibold">{stocks.length}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Live seit</p>
                        <p className="text-lg font-semibold">
                          {portfolio.liveStartDate 
                            ? new Date(portfolio.liveStartDate).toLocaleDateString('de-DE')
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                          <p className="text-lg font-semibold">Live</p>
                        </div>
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
