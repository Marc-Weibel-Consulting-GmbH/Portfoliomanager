import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Calendar, DollarSign } from "lucide-react";
import { useState } from "react";

export default function DividendCalendar() {
  const { user } = useAuth();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const { data: portfolios = [] } = trpc.portfolios.list.useQuery();
  const { data: dividendData, isLoading } = trpc.dividendCalendar.calendar.useQuery(
    { portfolioId: selectedPortfolioId! },
    { enabled: !!selectedPortfolioId }
  );

  if (!user) {
    return null;
  }

  const livePortfolios = portfolios.filter((p: any) => p.isLive);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dividendenkalender</h1>
            <p className="text-muted-foreground mt-1">
              Übersicht über bevorstehende Dividendenzahlungen
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
                  {livePortfolios.map((portfolio: any) => (
                    <Button
                      key={portfolio.id}
                      variant={selectedPortfolioId === portfolio.id ? "default" : "outline"}
                      onClick={() => setSelectedPortfolioId(portfolio.id)}
                      className="h-auto py-4"
                    >
                      <div className="text-left">
                        <div className="font-semibold">{portfolio.name}</div>
                        <div className="text-xs opacity-70">
                          {JSON.parse(portfolio.portfolioData).stocks?.length || 0} Aktien
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {selectedPortfolioId && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Bevorstehende Dividenden
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Lade Dividendendaten...
                    </div>
                  ) : !dividendData || dividendData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Keine bevorstehenden Dividenden in den nächsten 12 Monaten.
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 p-4 bg-muted rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Erwarteter Gesamtertrag (12 Monate)</span>
                          <span className="text-2xl font-bold text-green-500">
                            CHF {dividendData.reduce((sum: number, d: any) => sum + d.expectedAmount, 0).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-2 text-muted-foreground">Ticker</th>
                              <th className="text-left py-2 px-2 text-muted-foreground">Unternehmen</th>
                              <th className="text-left py-2 px-2 text-muted-foreground">Ex-Datum</th>
                              <th className="text-left py-2 px-2 text-muted-foreground">Zahltag</th>
                              <th className="text-right py-2 px-2 text-muted-foreground">Div./Aktie</th>
                              <th className="text-right py-2 px-2 text-muted-foreground">Aktien</th>
                              <th className="text-right py-2 px-2 text-muted-foreground">Ertrag</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dividendData.map((div: any, idx: number) => (
                              <tr key={idx} className="border-b border-border/50 hover:bg-muted/50">
                                <td className="py-2 px-2 font-mono">{div.ticker}</td>
                                <td className="py-2 px-2">{div.companyName}</td>
                                <td className="py-2 px-2">
                                  {new Date(div.exDate).toLocaleDateString('de-DE')}
                                </td>
                                <td className="py-2 px-2">
                                  {div.paymentDate ? new Date(div.paymentDate).toLocaleDateString('de-DE') : 'N/A'}
                                </td>
                                <td className="py-2 px-2 text-right">{div.dividendPerShare.toFixed(2)}</td>
                                <td className="py-2 px-2 text-right">{div.shares}</td>
                                <td className="py-2 px-2 text-right font-semibold text-green-500">
                                  CHF {div.expectedAmount.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
