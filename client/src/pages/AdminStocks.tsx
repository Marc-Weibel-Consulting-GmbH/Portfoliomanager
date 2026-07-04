import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Database, RefreshCw, ArrowRight, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { AdminTopbar } from "@/components/AdminTopbar";

// L-15: robuste Zahl-Formatierung — auch der String «NaN» ist truthy und würde sonst als
// «NaN» gerendert. Nur echte, endliche Werte anzeigen, sonst «—».
function fmtNum(v: unknown, decimals: number, suffix = ""): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(decimals) + suffix : "—";
}

export default function AdminStocks() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: stocks = [], refetch, isLoading } = trpc.stocks.list.useQuery();
  const refreshMutation = trpc.stocks.refreshData.useMutation({
    onSuccess: () => {
      toast.success("Aktiendaten aktualisiert");
      refetch();
    },
    onError: (error) => {
      toast.error(`Fehler beim Aktualisieren: ${error.message}`);
    }
  });

  // Redirect if not admin
  if (!user || user.role !== 'admin') {
    setLocation("/dashboard");
    return null;
  }

  const filteredStocks = stocks.filter((stock: any) => 
    stock.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stock.companyName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AdminTopbar />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Database className="h-8 w-8" />
              Stammdaten (stocks-Tabelle)
            </h1>
            <p className="text-muted-foreground mt-1">
              Nur-Lese-Ansicht der Aktien-Stammdaten (von Portfolios, Optimizer und Kursalarmen genutzt)
            </p>
          </div>
          <Button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
            Alle aktualisieren
          </Button>
        </div>

        {/* F-13: Hinweis — Kuratierung erfolgt in der zusammengeführten Watchlist-Seite */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Die Kuratierung des Aktien-Universums (Empfehlungen und Watchlist) erfolgt auf der
                  zusammengeführten Seite <span className="font-medium text-foreground">Aktienliste &amp; Watchlist</span>.
                  Diese Ansicht zeigt nur die Stammdaten.
                </p>
              </div>
              <Link href="/admin/watchlist">
                <Button variant="outline" size="sm">
                  Zur Aktienliste &amp; Watchlist
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Aktien ({filteredStocks.length})</CardTitle>
              <Input
                placeholder="Suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Lade Aktiendaten...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 text-muted-foreground">Ticker</th>
                      <th className="text-left py-2 px-2 text-muted-foreground">Unternehmen</th>
                      <th className="text-left py-2 px-2 text-muted-foreground">Kategorie</th>
                      <th className="text-right py-2 px-2 text-muted-foreground">Kurs</th>
                      <th className="text-right py-2 px-2 text-muted-foreground">YTD</th>
                      <th className="text-right py-2 px-2 text-muted-foreground">P/E</th>
                      <th className="text-right py-2 px-2 text-muted-foreground">Div. %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStocks.map((stock: any) => (
                      <tr key={stock.id} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-2 px-2 font-mono font-semibold">{stock.ticker}</td>
                        <td className="py-2 px-2">{stock.companyName}</td>
                        <td className="py-2 px-2 text-muted-foreground">{stock.category}</td>
                        <td className="py-2 px-2 text-right">
                          {Number.isFinite(Number(stock.currentPrice))
                            ? `${Number(stock.currentPrice).toFixed(2)} ${stock.currency || 'CHF'}`
                            : '—'}
                        </td>
                        <td className={`py-2 px-2 text-right font-semibold ${
                          Number(stock.ytdPerformance) >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {Number.isFinite(Number(stock.ytdPerformance))
                            ? (Number(stock.ytdPerformance) >= 0 ? '+' : '') + Number(stock.ytdPerformance).toFixed(1) + '%'
                            : '—'}
                        </td>
                        <td className="py-2 px-2 text-right">{fmtNum(stock.peRatio, 1)}</td>
                        <td className="py-2 px-2 text-right">{fmtNum(stock.dividendYield, 2, '%')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statistiken</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Gesamt Aktien</p>
                <p className="text-2xl font-bold">{stocks.length}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Kategorien</p>
                <p className="text-2xl font-bold">
                  {new Set(stocks.map((s: any) => s.category)).size}
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Ø P/E Ratio</p>
                <p className="text-2xl font-bold">
                  {stocks.filter((s: any) => s.peRatio).length > 0 ? (stocks.filter((s: any) => s.peRatio).reduce((sum: number, s: any) => sum + Number(s.peRatio), 0) / 
                    stocks.filter((s: any) => s.peRatio).length).toFixed(1) : 'N/A'}
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Ø Div. Rendite</p>
                <p className="text-2xl font-bold">
                  {stocks.length > 0 ? (stocks.reduce((sum: number, s: any) => sum + Number(s.dividendYield || 0), 0) / stocks.length).toFixed(2) + '%' : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
