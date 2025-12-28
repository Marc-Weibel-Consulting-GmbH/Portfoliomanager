import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Briefcase,
  Bell,
  Newspaper,
  TrendingUp,
  ArrowUpRight,
  Plus,
  Zap,
  Trash2,
  DollarSign,
  Scale,
  PieChart,
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import PremiumTeaser from "@/components/PremiumTeaser";
import { Activity, TrendingUp as TrendingUpIcon, Bell as BellIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const portfolioTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  dividends: { label: "Dividenden", icon: <DollarSign className="h-3 w-3" />, color: "bg-blue-500" },
  growth: { label: "Wachstum", icon: <TrendingUp className="h-3 w-3" />, color: "bg-green-500" },
  balanced: { label: "Balanced", icon: <Scale className="h-3 w-3" />, color: "bg-purple-500" },
  etf: { label: "ETF", icon: <PieChart className="h-3 w-3" />, color: "bg-orange-500" },
};

const formatDate = (date: Date | string) => {
  const d = new Date(date);
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export default function UserDashboard() {
  const { user } = useAuth();

  // Fetch user portfolios
  const { data: portfolios, isLoading: portfoliosLoading } = trpc.portfolios.list.useQuery();
  const utils = trpc.useUtils();
  const deletePortfolio = trpc.portfolios.delete.useMutation({
    onSuccess: () => {
      utils.portfolios.list.invalidate();
    },
  });

  const handleDeletePortfolio = async (e: React.MouseEvent, portfolioId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Möchten Sie dieses Portfolio wirklich löschen?')) {
      await deletePortfolio.mutateAsync({ id: portfolioId });
    }
  };

  // Mock data for dashboard
  const summaryCards = [
    { label: "Gesamtwert", value: "CHF 125,430", change: "+12.5%", trend: "up" },
    { label: "Performance", value: "+12.5%", change: "+2.3%", trend: "up" },
    { label: "Dividenden", value: "CHF 3,240", change: "+5.2%", trend: "up" },
    { label: "Portfolios", value: portfolios?.length.toString() || "0", change: "", trend: "neutral" },
  ];

  const mockPortfolios = [
    {
      name: "Wachstums-Portfolio",
      type: "Aktien",
      value: "CHF 65,200",
      performance: "+18.3%",
      chart: "up",
    },
    {
      name: "Dividenden-Strategie",
      type: "Mix",
      value: "CHF 42,800",
      performance: "+7.5%",
      chart: "up",
    },
    {
      name: "Krypto-Bestände",
      type: "Krypto",
      value: "CHF 17,430",
      performance: "+25.1%",
      chart: "up",
    },
  ];

  const mockAlerts = [
    { ticker: "AAPL", message: "Apple (AAPL) unter CHF 150", time: "Vor 30 Minuten", type: "warning" },
    { ticker: "BTC", message: "Bitcoin (BTC) über CHF 35,000", time: "Vor 1 Stunde", type: "success" },
  ];

  const mockNews = [
    {
      title: "Marktanalyse: Technologieaktien treiben den Aufschwung",
      time: "Vor 30 Minuten",
      image: "tech",
    },
    {
      title: "EZB erhöht Leitzinsen: Auswirkungen auf Ihr Portfolio",
      time: "Vor 1 Stunde",
      image: "ecb",
    },
    {
      title: "Nachhaltige Investments: Trend oder Zukunft?",
      time: "Vor 1 Stunde",
      image: "sustainable",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Welcome Message */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Willkommen zurück, {user?.name || "Max"}
        </h1>
        <p className="text-gray-400">28. Oktober 2024</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {summaryCards.map((card, index) => (
          <Card key={index} className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-400">{card.label}</div>
                {card.trend === "up" && (
                  <div className="w-8 h-8 bg-[#00CFC1]/20 rounded-lg flex items-center justify-center">
                    <ArrowUpRight className="h-4 w-4 text-[#00CFC1]" />
                  </div>
                )}
              </div>
              <div className="text-2xl font-bold text-white mb-1">{card.value}</div>
              {card.change && (
                <div className="text-sm text-[#00CFC1] flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {card.change}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Portfolios */}
        <div className="lg:col-span-2 space-y-6">
          {/* My Portfolios */}
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-[#00CFC1]" />
                  Meine Portfolios
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {portfoliosLoading ? (
                <div className="text-gray-400 text-center py-8">Portfolios werden geladen...</div>
              ) : portfolios && portfolios.length > 0 ? (
                portfolios.map((portfolio) => {
                  const typeConfig = portfolio.portfolioType ? portfolioTypeConfig[portfolio.portfolioType] : null;
                  return (
                  <Link key={portfolio.id} href={`/portfolio/${portfolio.id}`}>
                    <div className="bg-[#0f1420]/50 border border-white/10 rounded-lg p-4 hover:border-[#00CFC1]/50 transition-all cursor-pointer relative group">
                      <button
                        onClick={(e) => handleDeletePortfolio(e, portfolio.id)}
                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500"
                        title="Portfolio löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-[#00CFC1] font-semibold text-lg">{portfolio.name}</div>
                            {portfolio.isLive === 1 && (
                              <Badge variant="default" className="bg-green-500 text-white text-xs">
                                <span className="relative flex h-2 w-2 mr-1">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                </span>
                                Live
                              </Badge>
                            )}
                            {typeConfig && (
                              <Badge variant="outline" className="text-xs flex items-center gap-1">
                                {typeConfig.icon}
                                {typeConfig.label}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-400">{portfolio.description || "Portfolio"}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Aktualisiert: {formatDate(portfolio.updatedAt)}
                          </div>
                        </div>
                        <div className="text-right mr-10">
                          <div className="text-white font-semibold">Value</div>
                          <div className="text-sm text-gray-400">CHF --</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-400">Performance</div>
                        <div className="text-[#00CFC1] font-semibold">{portfolio.livePerformance || "--"}</div>
                      </div>
                      <div className="mt-3 h-12 bg-gradient-to-t from-[#00CFC1]/20 to-transparent rounded relative">
                        <svg className="w-full h-full" viewBox="0 0 200 40" preserveAspectRatio="none">
                          <path
                            d="M 0,35 L 40,30 L 80,25 L 120,20 L 160,15 L 200,10"
                            fill="none"
                            stroke="#00CFC1"
                            strokeWidth="2"
                          />
                        </svg>
                      </div>
                    </div>
                  </Link>
                  );
                })
              ) : (
                mockPortfolios.map((portfolio, index) => (
                  <div
                    key={index}
                    className="bg-[#0f1420]/50 border border-white/10 rounded-lg p-4 hover:border-[#00CFC1]/50 transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-[#00CFC1] font-semibold text-lg">{portfolio.name}</div>
                        <div className="text-sm text-gray-400">{portfolio.type}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-semibold">Value</div>
                        <div className="text-sm text-gray-400">{portfolio.value}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-400">Performance</div>
                      <div className="text-[#00CFC1] font-semibold">{portfolio.performance}</div>
                    </div>
                    <div className="mt-3 h-12 bg-gradient-to-t from-[#00CFC1]/20 to-transparent rounded relative">
                      <svg className="w-full h-full" viewBox="0 0 200 40" preserveAspectRatio="none">
                        <path
                          d="M 0,35 L 40,30 L 80,25 L 120,20 L 160,15 L 200,10"
                          fill="none"
                          stroke="#00CFC1"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                  </div>
                ))
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
              <div className="grid grid-cols-3 gap-4">
                <Link href="/portfolios/create">
                  <Button className="w-full bg-[#00CFC1] hover:bg-[#00b8ad] text-black font-semibold flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Neues Portfolio
                  </Button>
                </Link>
                <Link href="/transactions/new">
                  <Button variant="outline" className="w-full border-[#00CFC1]/50 text-[#00CFC1] hover:bg-[#00CFC1]/10">
                    Transaktion hinzufügen
                  </Button>
                </Link>
                <Link href="/price-alerts/new">
                  <Button variant="outline" className="w-full border-[#00CFC1]/50 text-[#00CFC1] hover:bg-[#00CFC1]/10">
                    Alarm erstellen
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Premium Features Section */}
          <div className="space-y-6">
            {user?.subscriptionTier === "free" && (
              <>
                {/* Live-Tracking Teaser */}
                <PremiumTeaser
                  title="Live-Tracking"
                  description="Verfolge dein Portfolio in Echtzeit mit IRR, MWR und detaillierten Performance-Metriken."
                  icon={<Activity className="w-8 h-8 text-teal-500" />}
                />

                {/* Trading-Signale Teaser */}
                <PremiumTeaser
                  title="Trading-Signale"
                  description="Erhalte KI-gestützte Kauf- und Verkaufsempfehlungen basierend auf Fundamentalanalyse."
                  icon={<TrendingUpIcon className="w-8 h-8 text-teal-500" />}
                />

                {/* Erweiterte Metriken Teaser */}
                <PremiumTeaser
                  title="Erweiterte Metriken"
                  description="Zugriff auf vollständige Fundamentalanalyse, Sharpe Ratio, Beta, und mehr."
                  icon={<BellIcon className="w-8 h-8 text-teal-500" />}
                />
              </>
            )}
          </div>
        </div>

        {/* Right Column: Alerts & News */}
        <div className="space-y-6">
          {/* Alerts */}
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Bell className="h-5 w-5 text-[#00CFC1]" />
                Aktuelle Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockAlerts.map((alert, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    alert.type === "warning"
                      ? "bg-yellow-500/10 border-yellow-500/30"
                      : "bg-[#00CFC1]/10 border-[#00CFC1]/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 ${
                        alert.type === "warning" ? "bg-yellow-500" : "bg-[#00CFC1]"
                      }`}
                    ></div>
                    <div className="flex-1">
                      <div className="text-white text-sm font-medium">{alert.message}</div>
                      <div className="text-xs text-gray-400 mt-1">{alert.time}</div>
                    </div>
                  </div>
                </div>
              ))}
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
              {mockNews.map((news, index) => (
                <div
                  key={index}
                  className="flex gap-3 p-3 rounded-lg bg-[#0f1420]/50 border border-white/10 hover:border-[#00CFC1]/50 transition-all cursor-pointer"
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-[#00CFC1]/20 to-[#00CFC1]/5 rounded-lg flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium line-clamp-2">{news.title}</div>
                    <div className="text-xs text-gray-400 mt-1">{news.time}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
