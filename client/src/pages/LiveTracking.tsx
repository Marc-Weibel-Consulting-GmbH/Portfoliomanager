import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { TrendingUp, TrendingDown, Activity, DollarSign, Calendar, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";
import { useMemo } from "react";

export default function LiveTracking() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: portfolios = [] } = trpc.portfolios.list.useQuery();

  // Filter only LIVE portfolios
  const livePortfolios = portfolios.filter((p: any) => p.isLive);

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
              <Button onClick={() => setLocation("/portfolios")}>
                Zu Portfolios
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {livePortfolios.map((portfolio: any) => (
              <LivePortfolioCard
                key={portfolio.id}
                portfolio={portfolio}
                onNavigate={() => setLocation(`/portfolio/${portfolio.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function LivePortfolioCard({ portfolio, onNavigate }: { portfolio: any; onNavigate: () => void }) {
  const { data: livePerformance } = trpc.portfolios.calculateLivePerformance.useQuery(
    portfolio.id,
    { enabled: !!portfolio.isLive }
  );

  const { data: chfHoldings = [] } = trpc.portfolios.getHoldingsWithChfPerformance.useQuery(
    portfolio.id,
    { enabled: !!portfolio.isLive }
  );

  const portfolioData = useMemo(() => {
    try {
      const data = JSON.parse(portfolio.portfolioData);
      return data.stocks || [];
    } catch {
      return [];
    }
  }, [portfolio.portfolioData]);

  // Calculate metrics
  const totalInvestedCHF = livePerformance?.totalInvestedCHF || 0;
  const totalValueCHF = livePerformance?.totalValueCHF || 0;
  const cashPosition = livePerformance?.cashPosition || 0;
  const performanceCHF = livePerformance?.performanceCHF || 0;
  const performancePercent = livePerformance?.performancePercent || 0;
  const irr = livePerformance?.irr || 0;
  const mwr = livePerformance?.mwr || 0;

  const isPositive = performancePercent >= 0;

  // Calculate average dividend yield
  const avgDividendYield = useMemo(() => {
    if (chfHoldings.length === 0) return 0;
    const totalValue = chfHoldings.reduce((sum: number, h: any) => sum + h.currentValueCHF, 0);
    if (totalValue === 0) return 0;
    const weightedYield = chfHoldings.reduce((sum: number, h: any) => {
      const weight = h.currentValueCHF / totalValue;
      return sum + (h.dividendYield || 0) * weight;
    }, 0);
    return weightedYield;
  }, [chfHoldings]);

  return (
    <Card
      className="hover:border-primary/50 transition-all cursor-pointer group"
      onClick={onNavigate}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-2xl">{portfolio.name}</CardTitle>
            {portfolio.portfolioType && (
              <span
                className={`px-3 py-1 text-sm rounded-full font-medium ${
                  portfolio.portfolioType === "Dividenden"
                    ? "bg-green-600/20 text-green-400 border border-green-600/30"
                    : portfolio.portfolioType === "Wachstum"
                    ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
                    : portfolio.portfolioType === "ETF"
                    ? "bg-yellow-600/20 text-yellow-400 border border-yellow-600/30"
                    : "bg-purple-600/20 text-purple-400 border border-purple-600/30"
                }`}
              >
                {portfolio.portfolioType}
              </span>
            )}
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm text-green-500 font-medium">Live</span>
            </div>
          </div>
          <div
            className={`flex items-center gap-2 text-2xl font-bold ${
              isPositive ? "text-green-500" : "text-red-500"
            }`}
          >
            {isPositive ? (
              <TrendingUp className="h-6 w-6" />
            ) : (
              <TrendingDown className="h-6 w-6" />
            )}
            {isPositive ? "+" : ""}
            {performancePercent.toFixed(2)}%
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-cyan-400" />
              <p className="text-sm text-muted-foreground">Gesamtwert</p>
            </div>
            <p className="text-2xl font-bold text-white">
              CHF {Math.round(totalValueCHF).toLocaleString("de-CH")}
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <p className="text-sm text-muted-foreground">Performance</p>
            </div>
            <p
              className={`text-2xl font-bold ${
                performanceCHF >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {performanceCHF >= 0 ? "+" : ""}CHF {Math.round(performanceCHF).toLocaleString("de-CH")}
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              <p className="text-sm text-muted-foreground">IRR / MWR</p>
            </div>
            <p className="text-2xl font-bold text-white">
              {irr.toFixed(1)}% / {mwr.toFixed(1)}%
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-purple-400" />
              <p className="text-sm text-muted-foreground">Dividende</p>
            </div>
            <p className="text-2xl font-bold text-white">{avgDividendYield.toFixed(2)}%</p>
          </div>
        </div>

        {/* Portfolio Details */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-700">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Positionen</p>
            <p className="text-lg font-semibold">{portfolioData.length} Aktien</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Investiert</p>
            <p className="text-lg font-semibold">
              CHF {Math.round(totalInvestedCHF).toLocaleString("de-CH")}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Live seit</p>
            <p className="text-lg font-semibold">
              {portfolio.liveStartDate
                ? new Date(portfolio.liveStartDate).toLocaleDateString("de-DE")
                : "N/A"}
            </p>
          </div>
        </div>

        {/* View Details Button */}
        <Button
          className="w-full mt-4"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate();
          }}
        >
          Details anzeigen →
        </Button>
      </CardContent>
    </Card>
  );
}
