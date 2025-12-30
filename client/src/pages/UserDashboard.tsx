import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Briefcase,
  Bell,
  Newspaper,
  TrendingUp,
  ArrowUpRight,
  Plus,
  Zap,
  DollarSign,
  AlertTriangle,
  Calendar,
  TrendingDown,
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
};

const formatDate = () => {
  return new Date().toLocaleDateString("de-DE", { 
    day: "numeric", 
    month: "long", 
    year: "numeric" 
  });
};

export default function UserDashboard() {
  const { user } = useAuth();
  const [showLiveOnly, setShowLiveOnly] = useState(true);

  // Fetch aggregated metrics
  const { data: metrics, isLoading: metricsLoading } = trpc.dashboard.getAggregatedMetrics.useQuery();
  
  // Fetch top portfolios
  const { data: allPortfolios, isLoading: portfoliosLoading } = trpc.dashboard.getTopPortfolios.useQuery();
  
  // Filter portfolios based on live toggle
  const topPortfolios = useMemo(() => {
    if (!allPortfolios) return [];
    if (showLiveOnly) {
      return allPortfolios.filter(p => p.isLive);
    }
    return allPortfolios;
  }, [allPortfolios, showLiveOnly]);
  
  // Fetch price alerts
  const { data: alerts } = trpc.priceAlerts.list.useQuery();
  const activeAlerts = alerts?.filter(a => a.status === 'active').slice(0, 2) || [];

  // Fetch real news from API
  const { data: newsData } = trpc.news.getAll.useQuery();
  
  // Format time ago helper
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 60) return `Vor ${diffMins} Minuten`;
    if (diffHours < 24) return `Vor ${diffHours} Stunde${diffHours > 1 ? 'n' : ''}`;
    return `Vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;
  };
  
  // Transform news data for display (limit to 3)
  const displayNews = (newsData?.slice(0, 3) || []).map(n => {
    let timeStr = 'Kürzlich';
    if (n.publishedAt) {
      const pubDate = n.publishedAt as unknown;
      if (typeof pubDate === 'string') {
        timeStr = formatTimeAgo(pubDate);
      } else if (pubDate instanceof Date) {
        timeStr = formatTimeAgo(pubDate.toISOString());
      }
    }
    return {
      title: n.title,
      excerpt: n.description || n.title.substring(0, 80) + '...',
      time: timeStr,
      url: n.url || '',
      ticker: n.ticker,
    };
  });

  return (
    <div className="max-w-7xl mx-auto">
      {/* Welcome Message */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Willkommen zurück, {user?.name || "Marc Weibel"}
        </h1>
        <p className="text-gray-400">{formatDate()}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-400">Portfolio-Wert (Wertschriften)</div>
              <div className="w-8 h-8 bg-[#00CFC1]/20 rounded-lg flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4 text-[#00CFC1]" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {metricsLoading ? "..." : formatCurrency(metrics?.totalValue || 0)}
            </div>
            {!metricsLoading && metrics && (
              <div className="text-sm text-gray-400">
                Aktueller Marktwert
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-400">Performance YTD</div>
              <div className="w-8 h-8 bg-[#00CFC1]/20 rounded-lg flex items-center justify-center">
                {!metricsLoading && metrics && metrics.totalPerformancePercent >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-[#00CFC1]" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                )}
              </div>
            </div>
            <div className={`text-2xl font-bold mb-1 ${
              !metricsLoading && metrics && metrics.totalPerformancePercent >= 0 
                ? 'text-[#00CFC1]' 
                : 'text-red-400'
            }`}>
              {metricsLoading ? "..." : formatPercent(metrics?.totalPerformancePercent || 0)}
            </div>
            {!metricsLoading && metrics && (
              <div className="text-sm text-gray-400">
                Seit 1. Januar {new Date().getFullYear()}
              </div>
            )}
          </CardContent>
        </Card>

        <Link href="/dividends">
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30 hover:border-[#00CFC1]/50 transition-all cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-400">Dividenden YTD</div>
                <div className="w-8 h-8 bg-[#00CFC1]/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-[#00CFC1]" />
                </div>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {metricsLoading ? "..." : formatCurrency(metrics?.totalDividends || 0)}
              </div>
              <div className="text-sm text-[#00CFC1] flex items-center gap-1 hover:underline">
                <Calendar className="h-3 w-3" />
                Zum Dividenden-Kalender
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-400">Portfolios</div>
              <div className="w-8 h-8 bg-[#00CFC1]/20 rounded-lg flex items-center justify-center">
                <Briefcase className="h-4 w-4 text-[#00CFC1]" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {metricsLoading ? "..." : metrics?.portfolioCount || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Top Portfolios */}
        <div className="lg:col-span-2 space-y-6">
          {/* My Portfolios */}
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-[#00CFC1]" />
                  Meine Portfolios
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor="live-toggle" className="text-sm text-gray-400 cursor-pointer">
                    Nur Live
                  </Label>
                  <Switch 
                    id="live-toggle"
                    checked={showLiveOnly} 
                    onCheckedChange={setShowLiveOnly}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {portfoliosLoading ? (
                <div className="text-gray-400 text-center py-8">Portfolios werden geladen...</div>
              ) : topPortfolios && topPortfolios.length > 0 ? (
                topPortfolios.map((portfolio) => (
                  <Link key={portfolio.id} href={`/portfolios/${portfolio.id}`}>
                    <div className="bg-[#0f1420]/50 border border-white/10 rounded-lg p-4 hover:border-[#00CFC1]/50 transition-all cursor-pointer">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="text-[#00CFC1] font-semibold text-lg mb-1">
                            {portfolio.name}
                          </div>
                          <div className="text-sm text-gray-400">Performance</div>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-semibold text-lg">
                            {formatCurrency(portfolio.value)}
                          </div>
                          <div className={`text-sm font-semibold ${portfolio.performance >= 0 ? 'text-[#00CFC1]' : 'text-red-500'}`}>
                            {formatPercent(portfolio.performance)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 h-12 bg-gradient-to-t from-[#00CFC1]/20 to-transparent rounded relative">
                        <svg className="w-full h-full" viewBox="0 0 200 40" preserveAspectRatio="none">
                          <path
                            d={portfolio.performance >= 0 
                              ? "M 0,35 L 40,30 L 80,25 L 120,20 L 160,15 L 200,10"
                              : "M 0,10 L 40,15 L 80,20 L 120,25 L 160,30 L 200,35"
                            }
                            fill="none"
                            stroke="#00CFC1"
                            strokeWidth="2"
                          />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">Noch keine Live-Portfolios vorhanden</p>
                  <Link href="/portfolio-builder/new">
                    <Button className="bg-[#00CFC1] hover:bg-[#00CFC1]/90 text-white">
                      <Plus className="h-4 w-4 mr-2" />
                      Erstes Portfolio erstellen
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-[#00CFC1]" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Link href="/portfolio-builder/new">
                  <Button 
                    variant="outline" 
                    className="w-full bg-transparent border-[#00CFC1]/50 hover:bg-[#00CFC1]/10 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Neues Portfolio
                  </Button>
                </Link>
                <Link href="/portfolios">
                  <Button 
                    variant="outline" 
                    className="w-full bg-transparent border-[#00CFC1]/50 hover:bg-[#00CFC1]/10 text-white"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Transaktion hinzufügen
                  </Button>
                </Link>
                <Link href="/price-alerts">
                  <Button 
                    variant="outline" 
                    className="w-full bg-transparent border-[#00CFC1]/50 hover:bg-[#00CFC1]/10 text-white"
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    Alarm erstellen
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Alerts & News */}
        <div className="space-y-6">
          {/* Aktuelle Alerts */}
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Bell className="h-5 w-5 text-[#00CFC1]" />
                Aktuelle Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeAlerts.length > 0 ? (
                activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="bg-[#0f1420]/50 border border-white/10 rounded-lg p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        alert.alertType === 'below_price' ? 'bg-yellow-500/20' : 'bg-green-500/20'
                      }`}>
                        {alert.alertType === 'below_price' ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-semibold">{alert.ticker}</div>
                        <div className="text-sm text-gray-400">
                          {alert.alertType === 'below_price' ? 'Unter' : 'Über'} {formatCurrency(parseFloat(alert.targetPrice || '0'))}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Aktiv</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-gray-400 text-sm">
                  Keine aktiven Alerts
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top News */}
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-[#00CFC1]" />
                Top News
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {displayNews.length > 0 ? (
                displayNews.map((news, index) => (
                  <div
                    key={index}
                    className="bg-[#0f1420]/50 border border-white/10 rounded-lg p-3 hover:border-[#00CFC1]/50 transition-all cursor-pointer"
                    onClick={() => news.url && window.open(news.url, '_blank')}
                  >
                    <div className="flex gap-3">
                      <div className="w-20 h-14 bg-gradient-to-br from-[#00CFC1]/20 to-[#00CFC1]/5 rounded flex-shrink-0 flex items-center justify-center">
                        <span className="text-[#00CFC1] text-xs font-bold">{news.ticker || 'NEWS'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium line-clamp-2 mb-1">
                          {news.title}
                        </div>
                        <div className="text-xs text-gray-400 line-clamp-1">{news.excerpt}</div>
                        <div className="text-xs text-gray-500 mt-1">{news.time}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-gray-400 text-sm">
                  Keine News verfügbar
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
