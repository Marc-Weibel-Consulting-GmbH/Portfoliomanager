import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Calendar, DollarSign, Clock, History, TrendingUp } from "lucide-react";
import { useState } from "react";

export default function DividendCalendar() {
  const { user } = useAuth();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const { data: portfolios = [] } = trpc.portfolios.list.useQuery();
  const { data: allDividendData, isLoading } = trpc.dividendCalendar.allDividends.useQuery(
    { portfolioId: selectedPortfolioId! },
    { enabled: !!selectedPortfolioId }
  );

  if (!user) {
    return null;
  }

  const livePortfolios = portfolios.filter((p: any) => p.isLive);

  // Split dividends into upcoming and past
  const today = new Date().toISOString().split("T")[0];
  const upcomingDividends = (allDividendData || []).filter(
    (d: any) => d.type === "upcoming" || d.type === "estimated"
  );
  const pastDividends = (allDividendData || [])
    .filter((d: any) => d.type === "past")
    .sort((a: any, b: any) => new Date(b.exDate).getTime() - new Date(a.exDate).getTime());

  const totalUpcoming = upcomingDividends.reduce((sum: number, d: any) => sum + d.expectedAmount, 0);
  const totalPast = pastDividends.reduce((sum: number, d: any) => sum + d.expectedAmount, 0);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "upcoming":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Bestätigt</Badge>;
      case "estimated":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Geschätzt</Badge>;
      case "past":
        return <Badge className="bg-muted text-muted-foreground border-border text-xs">Bezahlt</Badge>;
      default:
        return null;
    }
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case "Quarterly": return "Quartalsweise";
      case "Annual": return "Jährlich";
      case "Semi-Annual": return "Halbjährlich";
      case "Interim": return "Interim";
      case "Final": return "Final";
      case "Monthly": return "Monatlich";
      default: return period;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dividendenkalender</h1>
            <p className="text-muted-foreground mt-1">
              Übersicht über bevorstehende und vergangene Dividendenzahlungen (EODHD)
            </p>
          </div>
        </div>

        {livePortfolios.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Keine Live-Portfolios</h3>
              <p className="text-muted-foreground">
                Aktivieren Sie Live-Tracking für ein Portfolio, um Dividenden zu verfolgen.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Portfolio auswählen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {livePortfolios.map((portfolio: any) => {
                    let stockCount = 0;
                    try {
                      const data = JSON.parse(portfolio.portfolioData);
                      stockCount = Array.isArray(data) ? data.length : (data.stocks?.length || 0);
                    } catch {}
                    return (
                      <Button
                        key={portfolio.id}
                        variant={selectedPortfolioId === portfolio.id ? "default" : "outline"}
                        onClick={() => setSelectedPortfolioId(portfolio.id)}
                        className="h-auto py-4"
                      >
                        <div className="text-left">
                          <div className="font-semibold">{portfolio.name}</div>
                          <div className="text-xs opacity-70">{stockCount} Aktien</div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {selectedPortfolioId && (
              <>
                {/* Summary Cards */}
                {!isLoading && allDividendData && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-green-500/10">
                            <TrendingUp className="h-5 w-5 text-green-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Erwarteter Ertrag</p>
                            <p className="text-xl font-bold text-green-500">
                              CHF {totalUpcoming.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-500/10">
                            <Clock className="h-5 w-5 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Bevorstehende</p>
                            <p className="text-xl font-bold">{upcomingDividends.length} Zahlungen</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <History className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Erhalten (12 Mt.)</p>
                            <p className="text-xl font-bold">CHF {totalPast.toFixed(2)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Tabs */}
                <div className="flex gap-2">
                  <Button
                    variant={activeTab === "upcoming" ? "default" : "outline"}
                    onClick={() => setActiveTab("upcoming")}
                    size="sm"
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Bevorstehend ({upcomingDividends.length})
                  </Button>
                  <Button
                    variant={activeTab === "past" ? "default" : "outline"}
                    onClick={() => setActiveTab("past")}
                    size="sm"
                  >
                    <History className="h-4 w-4 mr-1" />
                    Vergangene ({pastDividends.length})
                  </Button>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {activeTab === "upcoming" ? "Bevorstehende Dividenden" : "Vergangene Dividenden (12 Monate)"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <div className="animate-pulse">Lade Dividendendaten von EODHD...</div>
                      </div>
                    ) : (activeTab === "upcoming" ? upcomingDividends : pastDividends).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {activeTab === "upcoming"
                          ? "Keine bevorstehenden Dividenden gefunden. Die meisten Schweizer Aktien zahlen jährlich im Frühling."
                          : "Keine vergangenen Dividenden in den letzten 12 Monaten."}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-2 text-muted-foreground">Ticker</th>
                              <th className="text-left py-2 px-2 text-muted-foreground">Unternehmen</th>
                              <th className="text-left py-2 px-2 text-muted-foreground">Ex-Datum</th>
                              <th className="text-left py-2 px-2 text-muted-foreground">Zahltag</th>
                              <th className="text-left py-2 px-2 text-muted-foreground">Frequenz</th>
                              <th className="text-right py-2 px-2 text-muted-foreground">Div./Aktie</th>
                              <th className="text-right py-2 px-2 text-muted-foreground">Aktien</th>
                              <th className="text-right py-2 px-2 text-muted-foreground">Ertrag (CHF)</th>
                              <th className="text-center py-2 px-2 text-muted-foreground">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(activeTab === "upcoming" ? upcomingDividends : pastDividends).map((div: any, idx: number) => (
                              <tr key={idx} className="border-b border-border/50 hover:bg-muted/50">
                                <td className="py-2 px-2 font-mono text-xs">{div.ticker}</td>
                                <td className="py-2 px-2">{div.companyName}</td>
                                <td className="py-2 px-2">
                                  {new Date(div.exDate).toLocaleDateString("de-CH", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  })}
                                </td>
                                <td className="py-2 px-2">
                                  {div.paymentDate
                                    ? new Date(div.paymentDate).toLocaleDateString("de-CH", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                      })
                                    : "N/A"}
                                </td>
                                <td className="py-2 px-2 text-xs">{getPeriodLabel(div.period)}</td>
                                <td className="py-2 px-2 text-right">
                                  {div.currency} {div.dividendPerShare.toFixed(2)}
                                </td>
                                <td className="py-2 px-2 text-right">{div.shares}</td>
                                <td className="py-2 px-2 text-right font-semibold text-green-500">
                                  {div.expectedAmount.toFixed(2)}
                                </td>
                                <td className="py-2 px-2 text-center">{getTypeBadge(div.type)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-border">
                              <td colSpan={7} className="py-2 px-2 font-semibold text-right">
                                Total:
                              </td>
                              <td className="py-2 px-2 text-right font-bold text-green-500">
                                CHF{" "}
                                {(activeTab === "upcoming" ? totalUpcoming : totalPast).toFixed(2)}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
